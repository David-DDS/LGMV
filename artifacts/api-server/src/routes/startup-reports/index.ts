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

    processStartupReportAsync(updated.id, filePath, system.vrfType).catch((err) =>
      logger.error({ err, reportId: updated.id }, "Failed to reprocess startup report")
    );

    res.json({
      ...updated,
      extractedData: updated.extractedData ? JSON.parse(updated.extractedData) : null,
    });
  }
);

async function processStartupReportAsync(reportId: number, filePath: string, vrfType: string) {
  try {
    const pdfText = await new Promise<string>((resolve) => {
      execFile("pdftotext", [filePath, "-"], (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve("(Texto nao extraido do PDF)");
        } else {
          resolve(stdout.slice(0, 12000));
        }
      });
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "system",
          content: "Voce e um especialista em sistemas de ar condicionado VRF LG. Analise relatorios de startup e extraia dados tecnicos com precisao. Retorne APENAS JSON valido, sem texto adicional.",
        },
        {
          role: "user",
          content: `Analise este relatorio de startup de um sistema VRF LG (tipo: ${vrfType}) e extraia os dados de leitura LGMV.

TEXTO DO PDF:
${pdfText.slice(0, 12000)}

Retorne um JSON com esta estrutura:
{
  "systemInfo": {
    "obra": "nome da obra",
    "codigoSistema": "codigo",
    "modeloMestre": "modelo",
    "numSerie": "numero de serie",
    "numUnidadesInternas": numero ou null,
    "simultaneidade": percentual ou null,
    "dataStartup": "data"
  },
  "baselineReadings": {
    "cooling": {
      "pressaoDescarga": valor numerico em kPa ou null,
      "pressaoSucao": valor numerico em kPa ou null,
      "eevUnidadeInterna": valor numerico em Pulso ou null,
      "eevUnidadeExterna": valor numerico em Pulso ou null,
      "serpentinaEntrada": valor numerico em C ou null,
      "serpentinaSaida": valor numerico em C ou null,
      "descargaCompressor": valor numerico em C ou null,
      "superaquecimentoSucao": valor numerico em C ou null
    },
    "heating": {
      "pressaoDescarga": valor numerico em kPa ou null,
      "pressaoSucao": valor numerico em kPa ou null,
      "eevUnidadeInterna": valor numerico em Pulso ou null,
      "eevUnidadeExterna": valor numerico em Pulso ou null,
      "superaquecimentoDescarga": valor numerico em C ou null,
      "descargaCompressor": valor numerico em C ou null,
      "superaquecimentoSucao": valor numerico em C ou null
    }
  }
}`,
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
