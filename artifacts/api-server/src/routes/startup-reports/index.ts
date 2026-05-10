import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import path from "path";
import fs from "fs";
import multer from "multer";
import { execFile } from "child_process";
import { db, vrfSystemsTable, startupReportsTable } from "@workspace/db";
import {
  ListStartupReportsParams,
  UploadStartupReportParams,
  GetStartupReportParams,
  DeleteStartupReportParams,
  ReprocessStartupReportParams,
  AttachExtractedStartupReportParams,
  AttachExtractedStartupReportBody,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.get("/systems/:systemId/startup-reports", async (req, res): Promise<void> => {
  const params = ListStartupReportsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const reports = await db
    .select()
    .from(startupReportsTable)
    .where(eq(startupReportsTable.systemId, params.data.systemId))
    .orderBy(desc(startupReportsTable.uploadedAt));

  res.json(
    reports.map((r) => ({
      ...r,
      extractedData: r.extractedData ? JSON.parse(r.extractedData) : null,
    }))
  );
});

router.post(
  "/systems/:systemId/startup-reports",
  upload.single("file"),
  async (req, res): Promise<void> => {
    const params = UploadStartupReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
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

    const fileUrl = `/api/uploads/${req.file.filename}`;

    const [report] = await db
      .insert(startupReportsTable)
      .values({
        systemId: params.data.systemId,
        filename: req.file.originalname,
        fileUrl,
        processingStatus: "processing",
      })
      .returning();

    // Process PDF with AI in background
    processStartupReportAsync(report.id, system.id, req.file.path, system.vrfType).catch((err) =>
      logger.error({ err, reportId: report.id }, "Failed to process startup report")
    );

    res.status(201).json({
      ...report,
      extractedData: null,
    });
  }
);

// Extract PDF data WITHOUT persisting a system or report.
// Stages the file in uploads/ and returns prefill data for the new-system form.
router.post(
  "/systems/extract-startup-pdf",
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    try {
      const result = await extractFromPdf(req.file.path);
      res.json({
        fileToken: req.file.filename,
        originalFilename: req.file.originalname,
        formData: result.formData,
        baselineData: result.baselineData,
      });
    } catch (err) {
      logger.error({ err }, "Failed to extract startup PDF");
      // Clean up failed file
      fs.promises.unlink(req.file.path).catch(() => undefined);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Extraction failed",
      });
    }
  }
);

// Attach a previously-extracted PDF (staged via extract-startup-pdf) to a system.
router.post(
  "/systems/:systemId/startup-reports/from-extraction",
  async (req, res): Promise<void> => {
    const params = AttachExtractedStartupReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const body = AttachExtractedStartupReportBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
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

    // Strict fileToken validation — reject path separators, "." and ".."
    const token = body.data.fileToken;
    if (
      !token ||
      token === "." ||
      token === ".." ||
      token.includes("/") ||
      token.includes("\\") ||
      token.includes("\0") ||
      token !== path.basename(token)
    ) {
      res.status(400).json({ error: "Invalid fileToken" });
      return;
    }
    const filePath = path.join(uploadsDir, token);
    // Ensure resolved path is still inside uploadsDir
    const resolvedUploads = fs.realpathSync(uploadsDir);
    let resolvedFile: string;
    try {
      resolvedFile = fs.realpathSync(filePath);
    } catch {
      res.status(410).json({ error: "Staged file not found" });
      return;
    }
    if (
      !resolvedFile.startsWith(resolvedUploads + path.sep) ||
      !fs.statSync(resolvedFile).isFile()
    ) {
      res.status(400).json({ error: "Invalid fileToken" });
      return;
    }
    const safeName = token;

    const [report] = await db
      .insert(startupReportsTable)
      .values({
        systemId: params.data.systemId,
        filename: body.data.originalFilename,
        fileUrl: `/api/uploads/${safeName}`,
        processingStatus: "done",
        extractedData: body.data.baselineData
          ? JSON.stringify(body.data.baselineData)
          : null,
      })
      .returning();

    res.status(201).json({
      ...report,
      extractedData: report.extractedData ? JSON.parse(report.extractedData) : null,
    });
  }
);

router.get("/systems/:systemId/startup-reports/:reportId", async (req, res): Promise<void> => {
  const params = GetStartupReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [report] = await db
    .select()
    .from(startupReportsTable)
    .where(eq(startupReportsTable.id, params.data.reportId));

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  res.json({
    ...report,
    extractedData: report.extractedData ? JSON.parse(report.extractedData) : null,
  });
});

router.delete("/systems/:systemId/startup-reports/:reportId", async (req, res): Promise<void> => {
  const params = DeleteStartupReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [report] = await db
    .select()
    .from(startupReportsTable)
    .where(
      and(
        eq(startupReportsTable.id, params.data.reportId),
        eq(startupReportsTable.systemId, params.data.systemId)
      )
    );

  // Idempotent: 204 either way
  if (!report) {
    res.sendStatus(204);
    return;
  }

  // Best-effort filesystem cleanup
  if (report.fileUrl) {
    const filename = path.basename(report.fileUrl);
    const filePath = path.join(uploadsDir, filename);
    fs.promises.unlink(filePath).catch(() => undefined);
  }

  await db
    .delete(startupReportsTable)
    .where(
      and(
        eq(startupReportsTable.id, params.data.reportId),
        eq(startupReportsTable.systemId, params.data.systemId)
      )
    );
  res.sendStatus(204);
});

router.post(
  "/systems/:systemId/startup-reports/:reportId/reprocess",
  async (req, res): Promise<void> => {
    const params = ReprocessStartupReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [report] = await db
      .select()
      .from(startupReportsTable)
      .where(
        and(
          eq(startupReportsTable.id, params.data.reportId),
          eq(startupReportsTable.systemId, params.data.systemId)
        )
      );

    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    const [system] = await db
      .select()
      .from(vrfSystemsTable)
      .where(eq(vrfSystemsTable.id, report.systemId));

    if (!system) {
      res.status(404).json({ error: "System not found" });
      return;
    }

    const filename = path.basename(report.fileUrl ?? "");
    const filePath = path.join(uploadsDir, filename);

    if (!filename || !fs.existsSync(filePath)) {
      res.status(410).json({ error: "Original file is no longer available" });
      return;
    }

    const [updated] = await db
      .update(startupReportsTable)
      .set({ processingStatus: "processing", errorMessage: null })
      .where(
        and(
          eq(startupReportsTable.id, params.data.reportId),
          eq(startupReportsTable.systemId, params.data.systemId)
        )
      )
      .returning();

    processStartupReportAsync(updated.id, system.id, filePath, system.vrfType).catch((err) =>
      logger.error({ err, reportId: updated.id }, "Failed to reprocess startup report")
    );

    res.json({
      ...updated,
      extractedData: updated.extractedData ? JSON.parse(updated.extractedData) : null,
    });
  }
);

async function pdfToText(filePath: string): Promise<string> {
  return new Promise((resolve) => {
    execFile("pdftotext", [filePath, "-"], (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve("(Texto nao extraido do PDF)");
      } else {
        resolve(stdout.slice(0, 12000));
      }
    });
  });
}

type ExtractedFormData = {
  code: string | null;
  name: string | null;
  building: string | null;
  location: string | null;
  floor: string | null;
  servedArea: string | null;
  model: string | null;
  vrfType: "multi_v_ii" | "multi_v_iii" | "multi_v_iv" | "multi_v_5" | null;
  condensationType: "air" | "water" | null;
  startupDate: string | null;
  notes: string | null;
};

type ExtractionResult = {
  formData: ExtractedFormData;
  baselineData: unknown;
};

async function extractFromPdf(filePath: string): Promise<ExtractionResult> {
  const pdfText = await pdfToText(filePath);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 4096,
    messages: [
      {
        role: "system",
        content:
          "Voce e um especialista em sistemas de ar condicionado VRF LG. Analise relatorios de startup e extraia dados de cadastro e baseline LGMV com precisao. Retorne APENAS JSON valido, sem texto adicional, sem markdown.",
      },
      {
        role: "user",
        content: `Analise este relatorio de startup de um sistema VRF LG e extraia DOIS conjuntos de dados:

1. Dados de CADASTRO do sistema (para preencher formulario)
2. BASELINE de leituras LGMV (para comparacao futura)

TEXTO DO PDF:
${pdfText}

Retorne UM UNICO JSON com esta estrutura exata:
{
  "formData": {
    "code": "codigo do sistema, ex: IST-1286-17 ou similar (string ou null)",
    "name": "nome curto identificando o sistema, ex: 'Bloco A - Sistema 01' (string ou null)",
    "building": "nome do edificio/predio, ex: 'Escritorio RLJ' (string ou null)",
    "location": "endereco completo, ex: 'Avenida Presidente Juscelino Kubitschek, 1909, Vila Olimpia, Sao Paulo - SP' (string ou null)",
    "floor": "andar, ex: '12' ou 'Cobertura' (string ou null)",
    "servedArea": "area atendida pelo sistema, ex: 'Sala de reunioes, TI' (string ou null)",
    "model": "modelo da unidade mestre/condensadora, ex: 'CRNU260LTE5' (string ou null)",
    "vrfType": "uma das opcoes EXATAS: 'multi_v_ii', 'multi_v_iii', 'multi_v_iv', 'multi_v_5'. Identifique a partir do texto (Multi V II/III/IV/5) (string ou null)",
    "condensationType": "'air' (Condensacao a Ar) ou 'water' (Condensacao a Agua), null se desconhecido",
    "startupDate": "data de partida no formato YYYY-MM-DD (string ou null)",
    "notes": "observacao tecnica concisa em portugues, com no maximo 2 frases. Inclua: situacao da aprovacao (ex: 'Sistema aprovado com restricao'), unidade mestre, numero de unidades internas, refrigerante adicional em kg e simultaneidade em %. Exemplo: 'Sistema aprovado com restricao. Unidade mestre: CRNU260LTE5. 8 unidades internas. Refrigerante adicional: 28,14 kg. Simultaneidade: 105%.' (string ou null)"
  },
  "baselineData": {
    "systemInfo": {
      "obra": "nome da obra ou null",
      "codigoSistema": "codigo ou null",
      "modeloMestre": "modelo ou null",
      "numSerie": "numero de serie ou null",
      "numUnidadesInternas": numero ou null,
      "simultaneidade": percentual numerico ou null,
      "dataStartup": "data ou null"
    },
    "baselineReadings": {
      "cooling": {
        "pressaoDescarga": numero kPa ou null,
        "pressaoSucao": numero kPa ou null,
        "eevUnidadeInterna": numero pulso ou null,
        "eevUnidadeExterna": numero pulso ou null,
        "serpentinaEntrada": numero C ou null,
        "serpentinaSaida": numero C ou null,
        "descargaCompressor": numero C ou null,
        "superaquecimentoSucao": numero C ou null
      },
      "heating": {
        "pressaoDescarga": numero kPa ou null,
        "pressaoSucao": numero kPa ou null,
        "eevUnidadeInterna": numero pulso ou null,
        "eevUnidadeExterna": numero pulso ou null,
        "superaquecimentoDescarga": numero C ou null,
        "descargaCompressor": numero C ou null,
        "superaquecimentoSucao": numero C ou null
      }
    }
  }
}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  let parsed: { formData?: Partial<ExtractedFormData>; baselineData?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : {};
  }

  const fd = parsed.formData ?? {};
  const allowedVrf = ["multi_v_ii", "multi_v_iii", "multi_v_iv", "multi_v_5"] as const;
  const allowedCond = ["air", "water"] as const;

  const formData: ExtractedFormData = {
    code: typeof fd.code === "string" ? fd.code : null,
    name: typeof fd.name === "string" ? fd.name : null,
    building: typeof fd.building === "string" ? fd.building : null,
    location: typeof fd.location === "string" ? fd.location : null,
    floor: typeof fd.floor === "string" ? fd.floor : null,
    servedArea: typeof fd.servedArea === "string" ? fd.servedArea : null,
    model: typeof fd.model === "string" ? fd.model : null,
    vrfType:
      typeof fd.vrfType === "string" && (allowedVrf as readonly string[]).includes(fd.vrfType)
        ? (fd.vrfType as ExtractedFormData["vrfType"])
        : null,
    condensationType:
      typeof fd.condensationType === "string" &&
      (allowedCond as readonly string[]).includes(fd.condensationType)
        ? (fd.condensationType as ExtractedFormData["condensationType"])
        : null,
    startupDate:
      typeof fd.startupDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fd.startupDate)
        ? fd.startupDate
        : null,
    notes: typeof fd.notes === "string" ? fd.notes : null,
  };

  return {
    formData,
    baselineData: parsed.baselineData ?? null,
  };
}

async function processStartupReportAsync(
  reportId: number,
  systemId: number,
  filePath: string,
  vrfType: string
) {
  try {
    const { formData, baselineData } = await extractFromPdf(filePath);
    const dataToStore = baselineData ?? { vrfType };
    await db
      .update(startupReportsTable)
      .set({
        processingStatus: "done",
        extractedData: JSON.stringify(dataToStore),
      })
      .where(eq(startupReportsTable.id, reportId));

    // Sync system row with extracted PDF data (PDF is the source of truth).
    // Only overwrite with non-empty extracted values; never wipe existing fields.
    const systemUpdate: Record<string, unknown> = {};
    if (formData.code) systemUpdate.code = formData.code;
    if (formData.name) systemUpdate.name = formData.name;
    if (formData.building) systemUpdate.building = formData.building;
    if (formData.location) systemUpdate.location = formData.location;
    if (formData.floor) systemUpdate.floor = formData.floor;
    if (formData.servedArea) systemUpdate.servedArea = formData.servedArea;
    if (formData.model) systemUpdate.model = formData.model;
    if (formData.vrfType) systemUpdate.vrfType = formData.vrfType;
    if (formData.condensationType) systemUpdate.condensationType = formData.condensationType;
    if (formData.startupDate) systemUpdate.startupDate = formData.startupDate;
    if (formData.notes) systemUpdate.notes = formData.notes;

    if (Object.keys(systemUpdate).length > 0) {
      systemUpdate.updatedAt = new Date();
      await db
        .update(vrfSystemsTable)
        .set(systemUpdate)
        .where(eq(vrfSystemsTable.id, systemId));
    }
  } catch (err) {
    logger.error({ err, reportId }, "Error processing startup report");
    await db
      .update(startupReportsTable)
      .set({
        processingStatus: "error",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      })
      .where(eq(startupReportsTable.id, reportId));
  }
}

export default router;
