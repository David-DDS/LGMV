import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import path from "path";
import fs from "fs";
import multer from "multer";
import { db, vrfSystemsTable, startupReportsTable } from "@workspace/db";
import {
  ListStartupReportsParams,
  UploadStartupReportParams,
  GetStartupReportParams,
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
    processStartupReportAsync(report.id, req.file.path, system.vrfType).catch((err) =>
      logger.error({ err, reportId: report.id }, "Failed to process startup report")
    );

    res.status(201).json({
      ...report,
      extractedData: null,
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

async function processStartupReportAsync(reportId: number, filePath: string, vrfType: string) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString("base64");

    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Você é um especialista em sistemas de ar condicionado VRF LG. Analise este relatório de startup de um sistema VRF LG e extraia os dados da leitura LGMV (parâmetros medidos durante o startup).

O sistema é do tipo: ${vrfType}

Por favor extraia e retorne um JSON com a seguinte estrutura:
{
  "systemInfo": {
    "obra": "nome da obra",
    "codigoSistema": "código",
    "modeloMestre": "modelo",
    "numSerie": "número de série",
    "numUnidadesInternas": número,
    "simultaneidade": percentual,
    "dataStartup": "data"
  },
  "baselineReadings": {
    "cooling": {
      "pressaoDescarga": valor em kPa ou null,
      "pressaoSucao": valor em kPa ou null,
      "eevUnidadeInterna": valor em Pulso ou null,
      "eevUnidadeExterna": valor em Pulso ou null,
      "serpentinaEntrada": valor em °C ou null,
      "serpentinaSaida": valor em °C ou null,
      "descargaCompressor": valor em °C ou null,
      "superaquecimentoSucao": valor em °C ou null
    },
    "heating": {
      "pressaoDescarga": valor em kPa ou null,
      "pressaoSucao": valor em kPa ou null,
      "eevUnidadeInterna": valor em Pulso ou null,
      "eevUnidadeExterna": valor em Pulso ou null,
      "superaquecimentoDescarga": valor em °C ou null,
      "descargaCompressor": valor em °C ou null,
      "superaquecimentoSucao": valor em °C ou null
    }
  }
}

Retorne APENAS o JSON válido, sem texto adicional.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${base64}`,
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    let extractedData: unknown;
    try {
      extractedData = JSON.parse(content);
    } catch {
      // Try to extract JSON from the response
      const match = content.match(/\{[\s\S]*\}/);
      extractedData = match ? JSON.parse(match[0]) : {};
    }

    await db
      .update(startupReportsTable)
      .set({
        processingStatus: "done",
        extractedData: JSON.stringify(extractedData),
      })
      .where(eq(startupReportsTable.id, reportId));
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
