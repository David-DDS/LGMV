import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import path from "path";
import fs from "fs";
import multer from "multer";
import {
  db,
  vrfSystemsTable,
  readingSessionsTable,
  readingPhotosTable,
  lgmvReadingsTable,
  startupReportsTable,
} from "@workspace/db";
import {
  ListReadingSessionsParams,
  CreateReadingSessionParams,
  CreateReadingSessionBody,
  GetReadingSessionParams,
  UploadReadingPhotoParams,
  AnalyzeReadingSessionParams,
  DeleteReadingPhotoParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../../lib/logger";
import { getLgParamRanges } from "../../lib/lg-param-ranges";
import { uploadBlob, downloadBlobBuffer, deleteBlob, isObjectStorageUrl } from "../../lib/blobStorage";
import {
  generateManufacturerGuide,
} from "../../lib/manufacturer-guide";
// Tabela referência LG (condensação a Ar) — usada como baseline padrão quando o sistema
// é condensação a Ar e ainda não tem relatório de partida cadastrado.
// O api-server roda com cwd = artifacts/api-server e o asset vive em src/lib/assets.
const LG_REFERENCE_TABLE_CANDIDATES = [
  path.join(process.cwd(), "src", "lib", "assets", "lg-reference-table.png"),
  path.join(process.cwd(), "assets", "lg-reference-table.png"),
];

let cachedLgReferenceDataUrl: string | null = null;
let lgReferenceLoadAttempted = false;
function loadLgReferenceDataUrl(): string | null {
  if (cachedLgReferenceDataUrl) return cachedLgReferenceDataUrl;
  if (lgReferenceLoadAttempted) return null;
  lgReferenceLoadAttempted = true;
  for (const p of LG_REFERENCE_TABLE_CANDIDATES) {
    try {
      const buf = fs.readFileSync(p);
      cachedLgReferenceDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
      logger.info({ path: p, bytes: buf.length }, "Loaded LG reference table image");
      return cachedLgReferenceDataUrl;
    } catch {
      // try next
    }
  }
  logger.warn({ candidates: LG_REFERENCE_TABLE_CANDIDATES }, "LG reference table image not found");
  return null;
}

const router: IRouter = Router();

const uploadsDir = path.join(process.cwd(), "uploads");

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function photoLabel(index: number): string {
  return `Foto ${index + 1}`;
}

function annotateReadingPhoto<T extends { id: number; filename: string }>(p: T, index: number) {
  return { ...p, label: photoLabel(index), filename: p.filename };
}

router.get("/systems/:systemId/reading-sessions", async (req, res): Promise<void> => {
  const params = ListReadingSessionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const sessions = await db
    .select()
    .from(readingSessionsTable)
    .where(eq(readingSessionsTable.systemId, params.data.systemId))
    .orderBy(desc(readingSessionsTable.sessionDate));

  res.json(sessions);
});

router.post("/systems/:systemId/reading-sessions", async (req, res): Promise<void> => {
  const params = CreateReadingSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateReadingSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [system] = await db
    .select()
    .from(vrfSystemsTable)
    .where(eq(vrfSystemsTable.id, params.data.systemId));

  if (!system) {
    res.status(404).json({ error: "System not found" });
    return;
  }

  const [session] = await db
    .insert(readingSessionsTable)
    .values({
      systemId: params.data.systemId,
      sessionDate: parsed.data.sessionDate,
      mode: parsed.data.mode,
      notes: parsed.data.notes,
    })
    .returning();

  res.status(201).json(session);
});

router.get("/systems/:systemId/reading-sessions/:sessionId", async (req, res): Promise<void> => {
  const params = GetReadingSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(readingSessionsTable)
    .where(eq(readingSessionsTable.id, params.data.sessionId));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const photos = await db
    .select()
    .from(readingPhotosTable)
    .where(eq(readingPhotosTable.sessionId, params.data.sessionId))
    .orderBy(readingPhotosTable.uploadedAt, readingPhotosTable.id);

  const labelById = new Map<number, string>();
  const annotatedPhotos = photos.map((p, i) => {
    labelById.set(p.id, photoLabel(i));
    return annotateReadingPhoto(p, i);
  });

  const readingsRows = await db
    .select()
    .from(lgmvReadingsTable)
    .where(eq(lgmvReadingsTable.sessionId, params.data.sessionId));

  const readings = readingsRows.map((r) => ({
    ...r,
    sourcePhotoLabel: r.sourcePhotoId ? labelById.get(r.sourcePhotoId) ?? null : null,
  }));

  res.json({
    ...session,
    photos: annotatedPhotos,
    readings,
  });
});

router.post(
  "/systems/:systemId/reading-sessions/:sessionId/photos",
  photoUpload.single("photo"),
  async (req, res): Promise<void> => {
    const params = UploadReadingPhotoParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No photo uploaded" });
      return;
    }

    const [session] = await db
      .select()
      .from(readingSessionsTable)
      .where(eq(readingSessionsTable.id, params.data.sessionId));

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    let upload;
    try {
      upload = await uploadBlob({
        buffer: req.file.buffer,
        contentType: req.file.mimetype || "image/jpeg",
        folder: "lgmv-photos",
      });
    } catch (err) {
      req.log?.error({ err }, "Failed to upload photo to object storage");
      res.status(500).json({ error: "Falha ao salvar a foto no armazenamento. Tente novamente." });
      return;
    }

    const [photo] = await db
      .insert(readingPhotosTable)
      .values({
        sessionId: params.data.sessionId,
        filename: req.file.originalname,
        fileUrl: upload.fileUrl,
      })
      .returning();

    // Compute label index
    const all = await db
      .select()
      .from(readingPhotosTable)
      .where(eq(readingPhotosTable.sessionId, params.data.sessionId))
      .orderBy(readingPhotosTable.uploadedAt, readingPhotosTable.id);
    const idx = all.findIndex((p) => p.id === photo.id);

    res.status(201).json(annotateReadingPhoto(photo, idx >= 0 ? idx : all.length - 1));
  }
);

router.delete(
  "/systems/:systemId/reading-sessions/:sessionId/photos/:photoId",
  async (req, res): Promise<void> => {
    const params = DeleteReadingPhotoParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [photo] = await db
      .select()
      .from(readingPhotosTable)
      .where(
        and(
          eq(readingPhotosTable.id, params.data.photoId),
          eq(readingPhotosTable.sessionId, params.data.sessionId)
        )
      );

    if (!photo) {
      res.sendStatus(204);
      return;
    }

    if (isObjectStorageUrl(photo.fileUrl)) {
      try {
        await deleteBlob(photo.fileUrl);
      } catch (err) {
        req.log?.warn({ err, photoId: photo.id }, "Failed to delete photo blob");
      }
    } else if (photo.fileUrl) {
      const filename = path.basename(photo.fileUrl);
      fs.promises.unlink(path.join(uploadsDir, filename)).catch(() => undefined);
    }

    await db.delete(readingPhotosTable).where(eq(readingPhotosTable.id, photo.id));
    res.sendStatus(204);
  }
);

router.post(
  "/systems/:systemId/reading-sessions/:sessionId/analyze",
  async (req, res): Promise<void> => {
    const params = AnalyzeReadingSessionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [session] = await db
      .select()
      .from(readingSessionsTable)
      .where(eq(readingSessionsTable.id, params.data.sessionId));

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (session.systemId !== params.data.systemId) {
      res.status(404).json({ error: "Sessao nao pertence a este sistema." });
      return;
    }

    const [system] = await db
      .select()
      .from(vrfSystemsTable)
      .where(eq(vrfSystemsTable.id, params.data.systemId));

    if (!system) {
      res.status(404).json({ error: "System not found" });
      return;
    }

    const photos = await db
      .select()
      .from(readingPhotosTable)
      .where(eq(readingPhotosTable.sessionId, params.data.sessionId))
      .orderBy(readingPhotosTable.uploadedAt, readingPhotosTable.id);

    if (photos.length === 0) {
      res.status(400).json({ error: "Nenhuma foto enviada para esta sessao." });
      return;
    }

    // Get baseline readings from the most recent processed startup report.
    const reportsForSystem = await db
      .select()
      .from(startupReportsTable)
      .where(eq(startupReportsTable.systemId, system.id))
      .orderBy(desc(startupReportsTable.uploadedAt));

    // Sistema com condensação a AR pode usar a tabela referência LG como baseline padrão
    // quando não há relatório de partida processado. Sistemas a Água exigem startup report.
    const isAirCooled = system.condensationType === "air";

    let latestReport = reportsForSystem.find((r) => r.processingStatus === "done" && r.extractedData) ?? null;
    let usingLgReference = false;

    if (!latestReport) {
      const stillProcessing = reportsForSystem.some(
        (r) => r.processingStatus === "processing" || r.processingStatus === "pending"
      );

      if (stillProcessing) {
        res.status(412).json({
          error: "O relatorio de partida ainda esta sendo processado pela IA. Aguarde a conclusao para iniciar a analise.",
        });
        return;
      }

      if (!isAirCooled) {
        res.status(412).json({
          error: reportsForSystem.length === 0
            ? "Este sistema (condensacao a agua) nao possui relatorio de partida cadastrado. Anexe um relatorio de partida antes de analisar leituras LGMV."
            : "O relatorio de partida nao pode ser processado e nao gerou baseline. Reprocesse o relatorio antes de analisar leituras LGMV.",
        });
        return;
      }

      // Air-cooled fallback: use LG reference table as baseline.
      usingLgReference = true;
    }

    const baselineData = latestReport?.extractedData ? JSON.parse(latestReport.extractedData) : null;
    const paramRanges = getLgParamRanges(system.vrfType, session.mode as "cooling" | "heating");

    // Build photo content for AI — labelled per photo
    const photoContents: Array<
      { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
    > = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      let buffer: Buffer | null = null;
      try {
        if (isObjectStorageUrl(photo.fileUrl)) {
          buffer = await downloadBlobBuffer(photo.fileUrl);
        } else {
          const filePath = path.join(uploadsDir, path.basename(photo.fileUrl));
          if (fs.existsSync(filePath)) buffer = fs.readFileSync(filePath);
        }
      } catch (err) {
        req.log?.warn({ err, photoId: photo.id }, "Failed to load photo for analysis");
      }
      if (!buffer) continue;

      const ext = path.extname(photo.filename).toLowerCase();
      const mimeType =
        ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/jpeg";
      const base64 = buffer.toString("base64");
      photoContents.push({
        type: "text",
        text: `\n--- ${photoLabel(i)} (${photo.filename}) ---`,
      });
      photoContents.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}` },
      });
    }

    if (photoContents.length === 0) {
      res
        .status(500)
        .json({ error: "Nenhuma das fotos pode ser carregada do armazenamento." });
      return;
    }

    const baselineText = baselineData?.baselineReadings
      ? `\nLeituras de baseline do startup:\n${JSON.stringify(
          baselineData.baselineReadings[session.mode] ?? {},
          null,
          2
        )}`
      : usingLgReference
        ? "\nSem relatorio de partida — usando a TABELA REFERENCIA LGMV (Equipamentos com condensacao a Ar) fornecida na imagem abaixo como baseline padrao. Compare os valores lidos contra as faixas dessa tabela para o tipo VRF e modo operacional informados."
        : "\nSem dados de baseline disponiveis.";

    // Injeta a tabela referência LG como imagem quando estamos usando ela como baseline.
    if (usingLgReference) {
      const refDataUrl = loadLgReferenceDataUrl();
      if (refDataUrl) {
        photoContents.unshift(
          { type: "text", text: "\n--- TABELA REFERENCIA LGMV (baseline padrao para condensacao a Ar) ---" },
          { type: "image_url", image_url: { url: refDataUrl } },
        );
      }
    }

    const rangesText = `\nRanges normais LG (${system.vrfType}, modo ${session.mode}):\n${JSON.stringify(
      paramRanges,
      null,
      2
    )}`;

    const photosListText = photos.map((p, i) => `- ${photoLabel(i)} (${p.filename})`).join("\n");

    const systemPrompt = `Voce e um especialista em sistemas de ar condicionado VRF LG com amplo conhecimento em manutencao preditiva.

Sistema: ${system.name} (${system.code})
Modelo: ${system.model ?? "N/A"}
Tipo VRF: ${system.vrfType}
Modo de operacao: ${session.mode === "cooling" ? "Refrigeracao (Cooling)" : "Aquecimento (Heating)"}
Data da leitura: ${session.sessionDate}
${baselineText}
${rangesText}

Voce recebera ${photos.length} foto(s) do LGMV, cada uma rotulada como "Foto N" no texto que precede a imagem:
${photosListText}

Analise as fotos das leituras LGMV e:
1. Extraia todos os valores de parametros visiveis. Para CADA leitura indique de qual foto ela veio em "sourcePhotoIndex" (numero inteiro 1-${photos.length}, correspondendo a "Foto 1", "Foto 2", etc).
2. Compare com os ranges normais do fabricante LG.
3. Compare com os valores de baseline do startup (se disponivel).
4. Identifique parametros fora do range normal.
5. Gere insights sobre a saude do sistema.
6. Forneca recomendacoes de manutencao se necessario.

Retorne APENAS um JSON valido com esta estrutura:
{
  "healthStatus": "healthy|warning|critical",
  "summary": "Resumo em portugues da saude do sistema",
  "readings": [
    {
      "parameter": "Nome do parametro",
      "unit": "unidade",
      "value": valor_numerico_ou_null,
      "minNormal": valor_minimo_normal_ou_null,
      "maxNormal": valor_maximo_normal_ou_null,
      "status": "normal|warning|critical|unknown",
      "baselineValue": valor_baseline_ou_null,
      "deviationPercent": percentual_desvio_do_baseline_ou_null,
      "sourcePhotoIndex": numero_da_foto_1_a_${photos.length}
    }
  ],
  "insights": ["insight 1", "insight 2"],
  "recommendations": ["recomendacao 1", "recomendacao 2"],
  "maintenanceRequired": true|false
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: systemPrompt }, ...photoContents],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    let analysisData: {
      healthStatus: string;
      summary: string;
      readings: {
        parameter: string;
        unit: string;
        value: number | null;
        minNormal: number | null;
        maxNormal: number | null;
        status: string;
        baselineValue: number | null;
        deviationPercent: number | null;
        sourcePhotoIndex?: number | null;
      }[];
      insights: string[];
      recommendations: string[];
      maintenanceRequired: boolean;
    };

    try {
      const match = content.match(/\{[\s\S]*\}/);
      analysisData = match ? JSON.parse(match[0]) : JSON.parse(content);
    } catch {
      logger.error({ content }, "Failed to parse AI analysis response");
      res.status(500).json({ error: "Falha ao interpretar resposta da IA." });
      return;
    }

    const manufacturerGuide = await generateManufacturerGuide(openai, {
      vrfType: system.vrfType,
      model: system.model,
      condensationType: system.condensationType,
      mode: session.mode,
      healthStatus: analysisData.healthStatus,
      notes: session.notes,
      summary: analysisData.summary,
      insights: analysisData.insights,
      recommendations: analysisData.recommendations,
      baselineSource: latestReport ? "startup-report" : usingLgReference ? "lg-air-reference" : "none",
      readings: analysisData.readings.map((reading) => ({
        parameter: reading.parameter,
        value: reading.value,
        unit: reading.unit,
        minNormal: reading.minNormal,
        maxNormal: reading.maxNormal,
        baselineValue: reading.baselineValue,
        status: reading.status,
        source:
          typeof reading.sourcePhotoIndex === "number" &&
          reading.sourcePhotoIndex >= 1 &&
          reading.sourcePhotoIndex <= photos.length
            ? photoLabel(reading.sourcePhotoIndex - 1)
            : "source-not-identified",
      })),
    });

    await db.transaction(async (tx) => {
      await tx.delete(lgmvReadingsTable).where(eq(lgmvReadingsTable.sessionId, params.data.sessionId));
      if (analysisData.readings && analysisData.readings.length > 0) {
        await tx.insert(lgmvReadingsTable).values(
          analysisData.readings.map((r) => {
            const idx =
              typeof r.sourcePhotoIndex === "number" && r.sourcePhotoIndex >= 1 && r.sourcePhotoIndex <= photos.length
                ? r.sourcePhotoIndex - 1
                : null;
            return {
              sessionId: params.data.sessionId,
              parameter: r.parameter,
              unit: r.unit,
              value: r.value,
              minNormal: r.minNormal,
              maxNormal: r.maxNormal,
              status: r.status,
              baselineValue: r.baselineValue,
              deviationPercent: r.deviationPercent,
              sourcePhotoId: idx !== null ? photos[idx].id : null,
            };
          }),
        );
      }
      await tx
        .update(readingSessionsTable)
        .set({
          healthStatus: analysisData.healthStatus,
          analysisResult: JSON.stringify({
            summary: analysisData.summary,
            insights: analysisData.insights,
            recommendations: analysisData.recommendations,
            maintenanceRequired: analysisData.maintenanceRequired,
            manufacturerGuide,
          }),
        })
        .where(eq(readingSessionsTable.id, params.data.sessionId));
      await tx
        .update(vrfSystemsTable)
        .set({
          healthStatus: analysisData.healthStatus,
          lastReadingDate: session.sessionDate,
        })
        .where(eq(vrfSystemsTable.id, system.id));
    });

    const labelById = new Map<number, string>();
    photos.forEach((p, i) => labelById.set(p.id, photoLabel(i)));

    const readings = (
      await db.select().from(lgmvReadingsTable).where(eq(lgmvReadingsTable.sessionId, params.data.sessionId))
    ).map((r) => ({
      ...r,
      sourcePhotoLabel: r.sourcePhotoId ? labelById.get(r.sourcePhotoId) ?? null : null,
    }));

    res.json({
      sessionId: params.data.sessionId,
      healthStatus: analysisData.healthStatus,
      summary: analysisData.summary,
      readings,
      insights: analysisData.insights,
      recommendations: analysisData.recommendations,
      maintenanceRequired: analysisData.maintenanceRequired,
      manufacturerGuide,
    });
  }
);

export default router;
