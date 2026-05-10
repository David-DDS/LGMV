import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
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
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../../lib/logger";
import { getLgParamRanges } from "../../lib/lg-param-ranges";

const router: IRouter = Router();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const photoUpload = multer({ storage: photoStorage, limits: { fileSize: 20 * 1024 * 1024 } });

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
    .orderBy(readingPhotosTable.uploadedAt);

  const readings = await db
    .select()
    .from(lgmvReadingsTable)
    .where(eq(lgmvReadingsTable.sessionId, params.data.sessionId));

  res.json({
    ...session,
    photos,
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

    const fileUrl = `/api/uploads/${req.file.filename}`;

    const [photo] = await db
      .insert(readingPhotosTable)
      .values({
        sessionId: params.data.sessionId,
        filename: req.file.originalname,
        fileUrl,
      })
      .returning();

    res.status(201).json(photo);
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
      .where(eq(readingPhotosTable.sessionId, params.data.sessionId));

    if (photos.length === 0) {
      res.status(400).json({ error: "No photos uploaded for this session" });
      return;
    }

    // Get baseline readings from the most recent processed startup report
    const [latestReport] = await db
      .select()
      .from(startupReportsTable)
      .where(eq(startupReportsTable.systemId, system.id))
      .orderBy(desc(startupReportsTable.uploadedAt));

    const baselineData = latestReport?.extractedData
      ? JSON.parse(latestReport.extractedData)
      : null;

    const paramRanges = getLgParamRanges(system.vrfType, session.mode as "cooling" | "heating");

    // Build photo content for AI
    const photoContents: { type: "image_url"; image_url: { url: string } }[] = [];

    for (const photo of photos) {
      const filePath = path.join(uploadsDir, path.basename(photo.fileUrl));
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString("base64");
        const ext = path.extname(photo.filename).toLowerCase();
        const mimeType =
          ext === ".png"
            ? "image/png"
            : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : "image/jpeg";
        photoContents.push({
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64}` },
        });
      }
    }

    const baselineText = baselineData?.baselineReadings
      ? `\nLeituras de baseline do startup:\n${JSON.stringify(baselineData.baselineReadings[session.mode] ?? {}, null, 2)}`
      : "\nSem dados de baseline disponíveis.";

    const rangesText = `\nRanges normais LG (${system.vrfType}, modo ${session.mode}):\n${JSON.stringify(paramRanges, null, 2)}`;

    const systemPrompt = `Você é um especialista em sistemas de ar condicionado VRF LG com amplo conhecimento em manutenção preditiva.

Sistema: ${system.name} (${system.code})
Modelo: ${system.model ?? "N/A"}
Tipo VRF: ${system.vrfType}
Modo de operação: ${session.mode === "cooling" ? "Refrigeração (Cooling)" : "Aquecimento (Heating)"}
Data da leitura: ${session.sessionDate}
${baselineText}
${rangesText}

Analise as fotos das leituras LGMV e:
1. Extraia todos os valores de parâmetros visíveis
2. Compare com os ranges normais do fabricante LG
3. Compare com os valores de baseline do startup (se disponível)
4. Identifique parâmetros fora do range normal
5. Gere insights sobre a saúde do sistema
6. Forneça recomendações de manutenção se necessário

Retorne APENAS um JSON válido com esta estrutura:
{
  "healthStatus": "healthy|warning|critical",
  "summary": "Resumo em português da saúde do sistema",
  "readings": [
    {
      "parameter": "Nome do parâmetro",
      "unit": "unidade",
      "value": valor_numerico_ou_null,
      "minNormal": valor_minimo_normal_ou_null,
      "maxNormal": valor_maximo_normal_ou_null,
      "status": "normal|warning|critical|unknown",
      "baselineValue": valor_baseline_ou_null,
      "deviationPercent": percentual_desvio_do_baseline_ou_null
    }
  ],
  "insights": ["insight 1", "insight 2", ...],
  "recommendations": ["recomendação 1", "recomendação 2", ...],
  "maintenanceRequired": true|false
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            ...photoContents,
          ],
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
      res.status(500).json({ error: "Failed to parse AI analysis" });
      return;
    }

    // Delete old readings for this session
    await db.delete(lgmvReadingsTable).where(eq(lgmvReadingsTable.sessionId, params.data.sessionId));

    // Insert new readings
    if (analysisData.readings && analysisData.readings.length > 0) {
      await db.insert(lgmvReadingsTable).values(
        analysisData.readings.map((r) => ({
          sessionId: params.data.sessionId,
          parameter: r.parameter,
          unit: r.unit,
          value: r.value,
          minNormal: r.minNormal,
          maxNormal: r.maxNormal,
          status: r.status,
          baselineValue: r.baselineValue,
          deviationPercent: r.deviationPercent,
        }))
      );
    }

    // Update session health status
    await db
      .update(readingSessionsTable)
      .set({
        healthStatus: analysisData.healthStatus,
        analysisResult: JSON.stringify({
          summary: analysisData.summary,
          insights: analysisData.insights,
          recommendations: analysisData.recommendations,
          maintenanceRequired: analysisData.maintenanceRequired,
        }),
      })
      .where(eq(readingSessionsTable.id, params.data.sessionId));

    // Update system health status
    await db
      .update(vrfSystemsTable)
      .set({
        healthStatus: analysisData.healthStatus,
        lastReadingDate: session.sessionDate,
      })
      .where(eq(vrfSystemsTable.id, system.id));

    const readings = await db
      .select()
      .from(lgmvReadingsTable)
      .where(eq(lgmvReadingsTable.sessionId, params.data.sessionId));

    res.json({
      sessionId: params.data.sessionId,
      healthStatus: analysisData.healthStatus,
      summary: analysisData.summary,
      readings,
      insights: analysisData.insights,
      recommendations: analysisData.recommendations,
      maintenanceRequired: analysisData.maintenanceRequired,
    });
  }
);

export default router;
