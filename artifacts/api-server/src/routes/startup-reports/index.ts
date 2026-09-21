import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import path from "path";
import fs from "fs";
import os from "os";
import multer from "multer";
import { execFile } from "child_process";
import { randomUUID } from "crypto";
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
import { uploadBlob, downloadBlobBuffer, deleteBlob, isObjectStorageUrl } from "../../lib/blobStorage";
import { renderPdfPagesToBuffers } from "../../lib/pdf";

const router: IRouter = Router();
const PDF_TOOL_TIMEOUT_MS = 120_000;

// Aceita PDF e imagens (JPEG/PNG/WebP). Limite 50 MB por arquivo.
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function mimeTypeFromFilename(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return null;
}

function fileFilter(
  _req: unknown,
  file: { mimetype: string; originalname: string },
  cb: (err: Error | null, accept: boolean) => void,
) {
  const mime = (file.mimetype || "").toLowerCase();
  const fallback = mimeTypeFromFilename(file.originalname || "");
  if (ACCEPTED_MIME_TYPES.has(mime) || (fallback && ACCEPTED_MIME_TYPES.has(fallback))) {
    cb(null, true);
    return;
  }
  logger.warn(
    { mime, filename: file.originalname },
    "Startup report upload rejected by fileFilter",
  );
  cb(
    new Error("Formato nao suportado. Envie PDF, JPG, PNG ou WebP."),
    false,
  );
}

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter,
});

// Wrap multer middleware to convert errors (incl. fileFilter rejects) into JSON 400s
// instead of bubbling up to the default Express HTML error page.
function handleMulterErrors(
  middleware: (req: unknown, res: unknown, next: (err?: unknown) => void) => void,
) {
  return (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
    middleware(req, res, (err?: unknown) => {
      if (!err) {
        next();
        return;
      }
      const message =
        err instanceof Error ? err.message : "Falha no upload do arquivo.";
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Arquivo muito grande. Tamanho maximo: 50 MB." });
        return;
      }
      res.status(400).json({ error: message });
    });
  };
}

// Write a buffer to a temp file (so pdftotext can read it).
async function writeTempPdf(buffer: Buffer): Promise<string> {
  const tmp = path.join(os.tmpdir(), `vrf-${randomUUID()}.pdf`);
  await fs.promises.writeFile(tmp, buffer);
  return tmp;
}

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
  handleMulterErrors(uploadMemory.single("file")),
  async (req, res): Promise<void> => {
    const params = UploadStartupReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "Nenhum arquivo enviado." });
      return;
    }

    const mimeType =
      (req.file.mimetype && ACCEPTED_MIME_TYPES.has(req.file.mimetype.toLowerCase())
        ? req.file.mimetype.toLowerCase()
        : null) || mimeTypeFromFilename(req.file.originalname) || "application/octet-stream";

    if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
      res.status(400).json({ error: "Formato nao suportado. Envie PDF, JPG, PNG ou WebP." });
      return;
    }

    const [system] = await db
      .select()
      .from(vrfSystemsTable)
      .where(eq(vrfSystemsTable.id, params.data.systemId));

    if (!system) {
      res.status(404).json({ error: "Sistema nao encontrado." });
      return;
    }

    let upload;
    try {
      upload = await uploadBlob({
        buffer: req.file.buffer,
        contentType: mimeType,
        folder: "startup-reports",
      });
    } catch (err) {
      req.log?.error({ err }, "Failed to upload startup report to object storage");
      res
        .status(500)
        .json({ error: "Falha ao salvar o relatorio no armazenamento. Tente novamente." });
      return;
    }

    const [report] = await db
      .insert(startupReportsTable)
      .values({
        systemId: params.data.systemId,
        filename: req.file.originalname,
        fileUrl: upload.fileUrl,
        mimeType,
        processingStatus: "processing",
      })
      .returning();

    processStartupReportAsync(
      report.id,
      system.id,
      req.file.buffer,
      mimeType,
      system.vrfType,
    ).catch((err) =>
      logger.error({ err, reportId: report.id }, "Failed to process startup report"),
    );

    res.status(201).json({
      ...report,
      extractedData: null,
    });
  },
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
    res.status(404).json({ error: "Relatorio nao encontrado." });
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

  if (!report) {
    res.sendStatus(204);
    return;
  }

  if (report.fileUrl && isObjectStorageUrl(report.fileUrl)) {
    try {
      await deleteBlob(report.fileUrl);
    } catch (err) {
      req.log?.warn({ err, reportId: report.id }, "Failed to delete report blob");
    }
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
      res.status(404).json({ error: "Relatorio nao encontrado." });
      return;
    }

    const [system] = await db
      .select()
      .from(vrfSystemsTable)
      .where(eq(vrfSystemsTable.id, report.systemId));

    if (!system) {
      res.status(404).json({ error: "Sistema nao encontrado." });
      return;
    }

    let buffer: Buffer | null = null;
    if (report.fileUrl && isObjectStorageUrl(report.fileUrl)) {
      buffer = await downloadBlobBuffer(report.fileUrl);
    }

    if (!buffer) {
      res.status(410).json({ error: "Arquivo original nao esta mais disponivel. O PDF/imagem foi descartado apos a extracao." });
      return;
    }

    // Prefer the authoritative MIME persisted at upload time; fall back to filename
    // extension; finally default to PDF for legacy rows.
    const storedMime = (report.mimeType || "").toLowerCase();
    const reprocessMime = ACCEPTED_MIME_TYPES.has(storedMime)
      ? storedMime
      : mimeTypeFromFilename(report.filename) || "application/pdf";

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

    processStartupReportAsync(updated.id, system.id, buffer, reprocessMime, system.vrfType).catch((err) =>
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
    execFile("pdftotext", [filePath, "-"], { timeout: PDF_TOOL_TIMEOUT_MS }, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve("");
      } else {
        resolve(stdout.slice(0, 12000));
      }
    });
  });
}

// Renderiza as primeiras paginas do PDF como JPEG (data URLs) para enviar ao GPT-4o Vision.
async function renderPdfPagesToDataUrls(
  filePath: string,
  maxPages = 3,
): Promise<string[]> {
  try {
    const pages = await renderPdfPagesToBuffers(filePath, maxPages);
    return pages
      .slice(0, maxPages)
      .map((buffer) => `data:image/jpeg;base64,${buffer.toString("base64")}`);
  } catch (err) {
    logger.warn({ err }, "pdftoppm rendering failed; continuing with text only");
    return [];
  }
}

// Trunca mensagens longas e remove HTML/CSS bruto para nao quebrar a UI.
function truncateForUser(input: string, max = 600): string {
  const stripped = input
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max - 3) + "...";
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

// Extrai dados de cadastro + baseline LGMV de um relatorio de partida.
// Aceita PDF (usa pdftotext + render das primeiras paginas via Vision) ou
// imagem direta (JPEG/PNG/WebP) enviada para Vision.
async function extractFromFile(
  buffer: Buffer,
  mimeType: string,
): Promise<ExtractionResult> {
  let pdfText = "";
  let imageDataUrls: string[] = [];
  let tempPdfPath: string | null = null;

  try {
    if (mimeType === "application/pdf") {
      tempPdfPath = await writeTempPdf(buffer);
      // Texto + imagens das primeiras paginas (melhora tabelas/graficos).
      [pdfText, imageDataUrls] = await Promise.all([
        pdfToText(tempPdfPath),
        renderPdfPagesToDataUrls(tempPdfPath, 3),
      ]);

      if (!pdfText.trim() && imageDataUrls.length === 0) {
        throw new Error(
          "Nao foi possivel ler o conteudo do PDF (texto vazio e renderizacao falhou).",
        );
      }
    } else if (mimeType.startsWith("image/")) {
      // Para imagens enviadas direto, usa apenas Vision.
      imageDataUrls = [`data:${mimeType};base64,${buffer.toString("base64")}`];
    } else {
      throw new Error(`Tipo de arquivo nao suportado para extracao: ${mimeType}`);
    }

    return await callExtractionLLM(pdfText, imageDataUrls);
  } finally {
    if (tempPdfPath) {
      fs.promises.unlink(tempPdfPath).catch(() => undefined);
    }
  }
}

async function callExtractionLLM(
  pdfText: string,
  imageDataUrls: string[],
): Promise<ExtractionResult> {
  const promptIntro = `Analise este relatorio de startup de um sistema VRF LG e extraia DOIS conjuntos de dados:

1. Dados de CADASTRO do sistema (para preencher formulario)
2. BASELINE de leituras LGMV (para comparacao futura)

${pdfText.trim() ? `TEXTO EXTRAIDO DO ARQUIVO:\n${pdfText}\n\n` : ""}${imageDataUrls.length > 0 ? `IMAGENS DO RELATORIO (paginas/foto fornecidas a seguir).\n\n` : ""}Retorne UM UNICO JSON com esta estrutura exata:
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
}`;

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } }
  > = [{ type: "text", text: promptIntro }];

  for (const url of imageDataUrls) {
    userContent.push({
      type: "image_url",
      image_url: { url, detail: "high" },
    });
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 4096,
    messages: [
      {
        role: "system",
        content:
          "Voce e um especialista em sistemas de ar condicionado VRF LG. Analise relatorios de startup (PDF ou foto) e extraia dados de cadastro e baseline LGMV com precisao. Retorne APENAS JSON valido, sem texto adicional, sem markdown, sem HTML/CSS. Se um campo nao estiver visivel, use null.",
      },
      {
        role: "user",
        content: userContent,
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
  buffer: Buffer,
  mimeType: string,
  vrfType: string
) {
  try {
    const { formData, baselineData } = await extractFromFile(buffer, mimeType);
    const dataToStore = baselineData ?? { vrfType };
    // Preserve the original attachment. Technical report exports include all
    // startup PDF pages as editable-document visual annexes; removing the
    // source after extraction would make that requirement impossible to meet.
    await db
      .update(startupReportsTable)
      .set({
        processingStatus: "done",
        extractedData: JSON.stringify(dataToStore),
      })
      .where(eq(startupReportsTable.id, reportId));

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
      await db.update(vrfSystemsTable).set(systemUpdate).where(eq(vrfSystemsTable.id, systemId));
    }
  } catch (err) {
    logger.error({ err, reportId }, "Error processing startup report");
    const rawMsg = err instanceof Error ? err.message : "Erro desconhecido durante a extracao.";
    await db
      .update(startupReportsTable)
      .set({
        processingStatus: "error",
        errorMessage: truncateForUser(rawMsg),
      })
      .where(eq(startupReportsTable.id, reportId));
  }
}

export default router;
