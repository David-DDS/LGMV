import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type {
  LgmvReading,
  ReadingPhoto,
  ReadingSession,
  StartupReport,
  VrfSystem,
} from "@workspace/db";
import { downloadBlobBuffer, isObjectStorageUrl } from "./blobStorage";
import { renderPdfPagesToBuffers } from "./pdf";
import { logger } from "./logger";
import { manufacturerGuideFile, type ManufacturerGuide } from "./manufacturer-guide";

const execFileAsync = promisify(execFile);
const uploadsDir = path.join(process.cwd(), "uploads");

const COLORS = {
  black: "1A1A1A",
  teal: "00ADA9",
  gray: "555555",
  lightGray: "F2F2F2",
  warningFill: "FCEBD5",
  warningText: "E07B00",
  greenFill: "E2F0E3",
  greenText: "2E7D32",
  blueFill: "DCE9F8",
  blueText: "1565C0",
  redFill: "F8D7D7",
  redText: "C62828",
};

const CONTENT_WIDTH_TWIPS = 10_080;
const CONTENT_WIDTH_PX = 650;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type ReportAttachmentIssue = {
  kind: "startup" | "photo" | "lg-reference" | "manufacturer-guide";
  name: string;
  reason: string;
};

export type TechnicalReportData = {
  system: VrfSystem;
  sessions: Array<{
    session: ReadingSession;
    photos: ReadingPhoto[];
    readings: LgmvReading[];
  }>;
  startupReports: StartupReport[];
  lgReferenceRequired: boolean;
  lgReferenceBuffer: Buffer | null;
};

function text(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Não informado";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

function parseJson(value: string | null | undefined): JsonValue | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as JsonValue;
  } catch {
    return null;
  }
}

function savedManufacturerGuide(value: JsonValue | null): ManufacturerGuide | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const guide = value.manufacturerGuide;
  if (!guide || typeof guide !== "object" || Array.isArray(guide)) return null;
  if (
    guide.version !== 1 ||
    guide.documentId !== "lg-multi-v5-troubleshooting-2021" ||
    typeof guide.title !== "string" ||
    typeof guide.status !== "string" ||
    typeof guide.safetyNotice !== "string" ||
    !Array.isArray(guide.references) ||
    !Array.isArray(guide.procedures)
  ) {
    return null;
  }
  return guide as unknown as ManufacturerGuide;
}

function displayMode(mode: string): string {
  return mode === "heating" ? "Aquecimento (Heating)" : "Refrigeração (Cooling)";
}

function displayStatus(status: string | null | undefined): string {
  switch (status) {
    case "healthy":
    case "normal":
      return "Normal";
    case "warning":
      return "Atenção";
    case "critical":
      return "Crítico";
    case "unknown":
      return "Não determinado";
    default:
      return text(status);
  }
}

function cell(
  value: unknown,
  options: { header?: boolean; fill?: string; color?: string; bold?: boolean; align?: "left" | "center" } = {},
): TableCell {
  const header = options.header === true;
  return new TableCell({
    shading: { fill: options.fill ?? (header ? COLORS.black : "FFFFFF"), type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: options.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 20, after: 20 },
        children: [
          new TextRun({
            text: text(value),
            bold: options.bold ?? header,
            color: options.color ?? (header ? "FFFFFF" : COLORS.black),
            size: 18,
          }),
        ],
      }),
    ],
  });
}

function twoColumnTable(rows: Array<[string, unknown]>, firstColumnWidth = 2_700): Table {
  return new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    columnWidths: [firstColumnWidth, CONTENT_WIDTH_TWIPS - firstColumnWidth],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
    },
    rows: rows.map(
      ([key, value], index) =>
        new TableRow({
          children: [
            cell(key, { bold: true, fill: index % 2 === 0 ? COLORS.lightGray : "FFFFFF" }),
            cell(value, { fill: index % 2 === 0 ? COLORS.lightGray : "FFFFFF" }),
          ],
        }),
    ),
  });
}

function sectionHeading(
  title: string,
  level: "Heading1" | "Heading2" | "Heading3" = HeadingLevel.HEADING_1,
): Paragraph {
  return new Paragraph({
    heading: level,
    spacing: { before: 260, after: 120 },
    children: [
      new TextRun({
        text: title,
        bold: true,
        color: COLORS.teal,
        size: level === HeadingLevel.HEADING_1 ? 28 : 23,
      }),
    ],
  });
}

function bodyParagraph(value: unknown, options: { bold?: boolean; italic?: boolean; color?: string } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 100, line: 276 },
    children: [
      new TextRun({
        text: text(value),
        bold: options.bold,
        italics: options.italic,
        color: options.color ?? COLORS.black,
        size: 20,
      }),
    ],
  });
}

function numberedParagraph(value: string): Paragraph {
  return new Paragraph({
    numbering: { reference: "report-numbered", level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text: value, size: 20 })],
  });
}

function flattenJson(value: JsonValue, prefix = ""): Array<[string, string]> {
  if (value === null || typeof value !== "object") {
    return [[prefix || "valor", text(value)]];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return [[prefix || "valor", "Lista vazia"]];
    return value.flatMap((item, index) => flattenJson(item, `${prefix}[${index}]`));
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return [[prefix || "valor", "Objeto vazio"]];
  return entries.flatMap(([key, item]) => flattenJson(item, prefix ? `${prefix}.${key}` : key));
}

function jsonTable(title: string, value: JsonValue | null): Array<Paragraph | Table> {
  if (value === null) {
    return [bodyParagraph(`${title}: ${value === null ? "não disponível" : "não informado"}`)];
  }
  const rows = flattenJson(value);
  return [
    bodyParagraph(title, { bold: true, color: COLORS.gray }),
    new Table({
      width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
      columnWidths: [5_200, CONTENT_WIDTH_TWIPS - 5_200],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
      },
      rows: [
        new TableRow({
          children: [cell("Campo", { header: true }), cell("Valor", { header: true })],
        }),
        ...rows.map(
          ([key, item], index) =>
            new TableRow({
              children: [
                cell(key, { bold: true, fill: index % 2 === 0 ? COLORS.lightGray : "FFFFFF" }),
                cell(item, { fill: index % 2 === 0 ? COLORS.lightGray : "FFFFFF" }),
              ],
            }),
        ),
      ],
    }),
  ];
}

function imageType(filename: string, buffer: Buffer): "jpg" | "png" | "gif" | "bmp" | "webp" | null {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg" || buffer.subarray(0, 3).toString("hex") === "ffd8ff") return "jpg";
  if (extension === ".png" || buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "png";
  if (extension === ".gif" || buffer.subarray(0, 3).toString() === "GIF") return "gif";
  if (extension === ".bmp" || buffer.subarray(0, 2).toString() === "BM") return "bmp";
  if (extension === ".webp" || buffer.subarray(0, 4).toString() === "RIFF") return "webp";
  return null;
}

function imageDimensions(type: "jpg" | "png" | "gif" | "bmp", buffer: Buffer): { width: number; height: number } | null {
  if (type === "png" && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if ((type === "gif" || type === "bmp") && buffer.length >= 26) {
    return type === "gif"
      ? { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) }
      : { width: buffer.readUInt32LE(18), height: Math.abs(buffer.readInt32LE(22)) };
  }
  if (type === "jpg") {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3 && offset + 8 < buffer.length) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

async function convertWebpToPng(buffer: Buffer): Promise<Buffer> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "vrf-report-image-"));
  const input = path.join(tempDir, "input.webp");
  const output = path.join(tempDir, "output.png");
  try {
    await fs.promises.writeFile(input, buffer);
    await execFileAsync("convert", [input, output]);
    return await fs.promises.readFile(output);
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function imageRun(filename: string, buffer: Buffer): Promise<ImageRun> {
  let imageBuffer = buffer;
  let type = imageType(filename, imageBuffer);
  if (type === "webp") {
    imageBuffer = await convertWebpToPng(imageBuffer);
    type = "png";
  }
  if (!type) throw new Error("Formato de imagem não suportado pelo Word.");
  const dimensions = imageDimensions(type, imageBuffer);
  const sourceWidth = dimensions?.width || CONTENT_WIDTH_PX;
  const sourceHeight = dimensions?.height || Math.round(CONTENT_WIDTH_PX * 0.75);
  const scale = Math.min(1, CONTENT_WIDTH_PX / sourceWidth);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  return new ImageRun({
    type,
    data: imageBuffer,
    transformation: { width, height },
    altText: { title: filename, description: filename, name: filename },
  });
}

async function loadAttachment(fileUrl: string | null | undefined): Promise<Buffer | null> {
  if (!fileUrl) return null;
  if (isObjectStorageUrl(fileUrl)) {
    return downloadBlobBuffer(fileUrl);
  }
  const legacyPath = path.join(uploadsDir, path.basename(fileUrl));
  try {
    return await fs.promises.readFile(legacyPath);
  } catch {
    return null;
  }
}

async function renderStartupAttachment(
  report: StartupReport,
): Promise<{ pages: Buffer[]; type: "pdf" | "image" } | null> {
  const buffer = await loadAttachment(report.fileUrl);
  if (!buffer) return null;
  const mime = (report.mimeType || "").toLowerCase();
  const type = mime === "application/pdf" || path.extname(report.filename).toLowerCase() === ".pdf" ? "pdf" : "image";
  if (type === "pdf") {
    const tempPdf = path.join(os.tmpdir(), `vrf-report-${Date.now()}-${Math.random().toString(16).slice(2)}.pdf`);
    try {
      await fs.promises.writeFile(tempPdf, buffer);
      return { pages: await renderPdfPagesToBuffers(tempPdf), type };
    } finally {
      await fs.promises.unlink(tempPdf).catch(() => undefined);
    }
  }
  return { pages: [buffer], type };
}

function statusCell(status: string): TableCell {
  const lower = status.toLowerCase();
  const warning = lower === "warning";
  const critical = lower === "critical";
  const normal = lower === "normal" || lower === "healthy";
  return cell(displayStatus(status), {
    bold: true,
    align: "center",
    fill: critical ? COLORS.redFill : warning ? COLORS.warningFill : normal ? COLORS.greenFill : COLORS.lightGray,
    color: critical ? COLORS.redText : warning ? COLORS.warningText : normal ? COLORS.greenText : COLORS.gray,
  });
}

function readingsTable(readings: LgmvReading[]): Table {
  const headers = [
    "Parâmetro",
    "Unidade",
    "Valor",
    "Mín. normal",
    "Máx. normal",
    "Baseline",
    "Desvio (%)",
    "Status",
    "Foto origem",
  ];
  return new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    columnWidths: [1_850, 700, 850, 950, 950, 950, 950, 1_150, 730],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
    },
    rows: [
      new TableRow({ children: headers.map((header) => cell(header, { header: true, align: "center" })) }),
      ...readings.map(
        (reading, index) =>
          new TableRow({
            children: [
              cell(reading.parameter, { fill: index % 2 === 0 ? COLORS.lightGray : "FFFFFF" }),
              cell(reading.unit, { fill: index % 2 === 0 ? COLORS.lightGray : "FFFFFF", align: "center" }),
              cell(reading.value, { fill: index % 2 === 0 ? COLORS.lightGray : "FFFFFF", align: "center" }),
              cell(reading.minNormal, { fill: index % 2 === 0 ? COLORS.lightGray : "FFFFFF", align: "center" }),
              cell(reading.maxNormal, { fill: index % 2 === 0 ? COLORS.lightGray : "FFFFFF", align: "center" }),
              cell(reading.baselineValue, { fill: index % 2 === 0 ? COLORS.lightGray : "FFFFFF", align: "center" }),
              cell(reading.deviationPercent, { fill: index % 2 === 0 ? COLORS.lightGray : "FFFFFF", align: "center" }),
              statusCell(reading.status),
              cell(reading.sourcePhotoId, { fill: index % 2 === 0 ? COLORS.lightGray : "FFFFFF", align: "center" }),
            ],
          }),
      ),
    ],
  });
}

function photoCaption(filename: string, index: number, sessionDate: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80 },
    children: [
      new TextRun({
        text: `Foto ${index + 1} — ${filename} — sessão ${sessionDate}`,
        bold: true,
        color: COLORS.gray,
        size: 18,
      }),
    ],
  });
}

async function photoParagraphs(
  photos: ReadingPhoto[],
  sessionDate: string,
  issues: ReportAttachmentIssue[],
): Promise<Array<Paragraph | Table>> {
  const children: Array<Paragraph | Table> = [];
  if (photos.length === 0) {
    children.push(bodyParagraph("Nenhuma foto de leitura persistida para esta sessão."));
    return children;
  }
  for (const [index, photo] of photos.entries()) {
    const buffer = await loadAttachment(photo.fileUrl).catch(() => null);
    if (!buffer) {
      issues.push({
        kind: "photo",
        name: `Foto ${index + 1} — ${photo.filename}`,
        reason: "arquivo não encontrado ou indisponível no armazenamento",
      });
      continue;
    }
    try {
      const run = await imageRun(photo.filename, buffer);
      children.push(photoCaption(photo.filename, index, sessionDate));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run] }));
    } catch (error) {
      issues.push({
        kind: "photo",
        name: `Foto ${index + 1} — ${photo.filename}`,
        reason: error instanceof Error ? error.message : "imagem não renderizável",
      });
    }
  }
  return children;
}

export async function buildTechnicalReport(data: TechnicalReportData): Promise<{ buffer: Buffer; issues: ReportAttachmentIssue[] }> {
  const issues: ReportAttachmentIssue[] = [];
  const system = data.system;
  const guidePages = new Map<number, { printedPage: string; title: string }>();
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "RELATÓRIO TÉCNICO DE ANÁLISE – CLIMATIZAÇÃO VRF",
          bold: true,
          color: COLORS.teal,
          size: 34,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: `Sistema ${text(system.code)} — ${text(system.name)}`,
          color: COLORS.gray,
          size: 22,
        }),
      ],
    }),
    bodyParagraph(
      "Este documento consolida os dados persistidos no VRF Monitor, incluindo análises geradas anteriormente. A análise de IA é um apoio e deve ser revisada e validada por profissional técnico habilitado antes de qualquer intervenção.",
      { italic: true, color: COLORS.warningText },
    ),
    sectionHeading("Identificação do sistema"),
    twoColumnTable([
      ["Código", system.code],
      ["Nome", system.name],
      ["Categoria", system.category],
      ["Edificação", system.building],
      ["Localização", system.location],
      ["Andar", system.floor],
      ["Área atendida", system.servedArea],
      ["Modelo", system.model],
      ["Tipo VRF", system.vrfType],
      ["Condensação", system.condensationType === "air" ? "Ar" : system.condensationType === "water" ? "Água" : null],
      ["Data de startup cadastrada", system.startupDate],
      ["Status atual persistido", displayStatus(system.healthStatus)],
      ["Última leitura", system.lastReadingDate],
      ["Observações", system.notes],
    ]),
    sectionHeading("1. Objetivo e escopo"),
    numberedParagraph("Registrar tecnicamente a identificação do sistema VRF e o escopo das evidências disponíveis no VRF Monitor."),
    numberedParagraph("Apresentar as sessões de leitura, valores de baseline, faixas normais, desvios e status persistidos."),
    numberedParagraph("Reproduzir integralmente, em conteúdo editável, os diagnósticos, insights e recomendações de IA já armazenados, sem executar nova chamada de IA."),
    numberedParagraph("Anexar visualmente os arquivos de startup e as fotografias de leitura disponíveis, registrando de forma explícita qualquer arquivo ausente ou não renderizável."),
    sectionHeading("2. Inventário"),
    twoColumnTable([
      ["Sessões de leitura persistidas", data.sessions.length],
      ["Leituras LGMV persistidas", data.sessions.reduce((count, item) => count + item.readings.length, 0)],
      ["Fotos de leitura persistidas", data.sessions.reduce((count, item) => count + item.photos.length, 0)],
      ["Relatórios de startup cadastrados", data.startupReports.length],
      ["Baseline de referência LG aplicável", data.lgReferenceRequired ? "Sim — somente condensação a ar" : "Não"],
    ]),
  ];

  for (const [sessionIndex, item] of data.sessions.entries()) {
    const { session, readings, photos } = item;
    children.push(sectionHeading(`3.${sessionIndex + 1}. Sessão de leitura — ${session.sessionDate}`, HeadingLevel.HEADING_2));
    children.push(
      twoColumnTable([
        ["ID da sessão", session.id],
        ["Data", session.sessionDate],
        ["Modo", displayMode(session.mode)],
        ["Status de saúde persistido", displayStatus(session.healthStatus)],
        ["Notas", session.notes],
      ]),
    );
    children.push(new Paragraph({ children: [new TextRun({ text: "Leituras LGMV", bold: true, color: COLORS.gray, size: 22 })] }));
    children.push(
      readings.length
        ? readingsTable(readings)
        : bodyParagraph("Nenhuma leitura LGMV persistida para esta sessão."),
    );

    const parsedAnalysis = parseJson(session.analysisResult);
    children.push(sectionHeading("Diagnóstico completo persistido", HeadingLevel.HEADING_3));
    if (parsedAnalysis) {
      children.push(...jsonTable(`Análise de IA da sessão ${session.id}`, parsedAnalysis));
    } else {
      children.push(bodyParagraph(session.analysisResult ?? "Nenhuma análise persistida para esta sessão."));
    }

    const guide = savedManufacturerGuide(parsedAnalysis);
    children.push(sectionHeading("Orientação fundamentada no fabricante", HeadingLevel.HEADING_3));
    if (!guide) {
      children.push(
        bodyParagraph(
          "Esta análise legada não possui guia do fabricante salvo. Reanalise a sessão para gerar fundamentação; nenhuma nova IA é executada durante esta exportação.",
          { italic: true, color: COLORS.warningText },
        ),
      );
    } else {
      children.push(bodyParagraph(guide.safetyNotice, { bold: true, color: COLORS.warningText }));
      if (guide.status !== "grounded") {
        children.push(
          bodyParagraph(
            `Status: ${guide.status}. ${guide.reason || "Nenhum procedimento fundamentado foi salvo."}`,
            { italic: true },
          ),
        );
      } else {
        for (const reference of guide.references) {
          if (guidePages.size < 6 || guidePages.has(reference.page)) {
            guidePages.set(reference.page, {
              printedPage: reference.printedPage,
              title: reference.title,
            });
          }
        }
        for (const procedure of guide.procedures) {
          children.push(bodyParagraph(procedure.title, { bold: true, color: COLORS.gray }));
          children.push(bodyParagraph(`Evidência: ${procedure.evidence}`, { italic: true }));
          for (const [stepIndex, step] of procedure.steps.entries()) {
            const reference = guide.references.find((item) => item.page === step.page);
            children.push(
              numberedParagraph(
                `${stepIndex + 1}. ${step.instruction}\nResultado esperado: ${step.expectedResult}\nSe SIM/aprovado: ${step.onPass}\nSe NÃO/reprovado: ${step.onFail}\nFonte: PDF p. ${step.page} / página impressa ${reference?.printedPage ?? "não informada"}.`,
              ),
            );
          }
        }
      }
    }

    const recommendations = parsedAnalysis && typeof parsedAnalysis === "object" && !Array.isArray(parsedAnalysis)
      ? parsedAnalysis.recommendations
      : null;
    children.push(sectionHeading("Plano de ação existente", HeadingLevel.HEADING_3));
    if (Array.isArray(recommendations) && recommendations.length > 0) {
      recommendations.forEach((recommendation, index) => {
        children.push(numberedParagraph(`${index + 1}. ${text(recommendation)}`));
      });
    } else {
      children.push(bodyParagraph("Nenhuma recomendação persistida na análise desta sessão."));
    }

    children.push(sectionHeading("Evidências fotográficas", HeadingLevel.HEADING_3));
    children.push(...(await photoParagraphs(photos, session.sessionDate, issues)));
  }

  children.push(sectionHeading("Apêndice — fontes oficiais originais LG"));
  if (guidePages.size === 0) {
    children.push(
      bodyParagraph(
        "Nenhuma página de fluxo de diagnóstico foi salva nas análises selecionadas. O trecho do fabricante não foi anexado.",
        { italic: true },
      ),
    );
  } else {
    children.push(
      bodyParagraph(
        "Páginas originais oficiais em inglês do trecho de treinamento/serviço citado. Este apêndice não representa um manual completo e a aplicabilidade ao modelo deve ser confirmada.",
        { italic: true, color: COLORS.warningText },
      ),
    );
    for (const [page, reference] of guidePages) {
      const file = manufacturerGuideFile("page", page);
      if (!file) {
        issues.push({
          kind: "manufacturer-guide",
          name: `Página PDF ${page}`,
          reason: "imagem oficial não encontrada no servidor",
        });
        continue;
      }
      try {
        const buffer = await fs.promises.readFile(file);
        const pageImage = await imageRun(`lg-multi-v5-page-${page}.png`, buffer);
        children.push(new Paragraph({ children: [new PageBreak()] }));
        children.push(
          bodyParagraph(
            `Original oficial em inglês — PDF p. ${page} / página impressa ${reference.printedPage} — ${reference.title}`,
            { bold: true, color: COLORS.gray },
          ),
        );
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [pageImage] }));
      } catch (error) {
        issues.push({
          kind: "manufacturer-guide",
          name: `Página PDF ${page}`,
          reason: error instanceof Error ? error.message : "imagem não renderizável",
        });
      }
    }
  }

  children.push(sectionHeading("4. Dados completos dos startups"));
  if (data.startupReports.length === 0) {
    children.push(bodyParagraph("Nenhum relatório de startup está cadastrado para este sistema."));
    issues.push({
      kind: "startup",
      name: "Relatório de startup",
      reason: "nenhum relatório foi cadastrado para o sistema",
    });
  } else {
    for (const [reportIndex, report] of data.startupReports.entries()) {
      children.push(sectionHeading(`Startup ${reportIndex + 1} — ${report.filename}`, HeadingLevel.HEADING_2));
      children.push(
        twoColumnTable([
          ["ID do startup", report.id],
          ["Arquivo", report.filename],
          ["Tipo MIME", report.mimeType],
          ["Data de upload", report.uploadedAt],
          ["Status de processamento", report.processingStatus],
          ["Mensagem de erro", report.errorMessage],
        ]),
      );
      const extracted = parseJson(report.extractedData);
      if (report.extractedData && extracted === null) {
        children.push(bodyParagraph("Dados extraídos completos (JSON persistido):", { bold: true, color: COLORS.gray }));
        children.push(bodyParagraph(report.extractedData));
      } else {
        children.push(...jsonTable("Dados extraídos completos", extracted));
      }
    }
  }

  if (data.lgReferenceRequired) {
    children.push(sectionHeading("Baseline de referência LG", HeadingLevel.HEADING_2));
    children.push(
      bodyParagraph(
        "Não há startup processado com dados extraídos para este sistema de condensação a ar. A análise persistida pode ter utilizado a tabela de referência LG como baseline padrão; ela não é aplicável como substituta para sistemas de condensação a água.",
        { italic: true },
      ),
    );
    if (data.lgReferenceBuffer) {
      try {
        const referenceImage = await imageRun("lg-reference-table.png", data.lgReferenceBuffer);
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [referenceImage] }));
        children.push(bodyParagraph("Tabela de referência LG utilizada no sistema de condensação a ar.", { italic: true, color: COLORS.gray }));
      } catch (error) {
        issues.push({
          kind: "lg-reference",
          name: "Tabela de referência LG",
          reason: error instanceof Error ? error.message : "imagem não renderizável",
        });
      }
    } else {
      issues.push({
        kind: "lg-reference",
        name: "Tabela de referência LG",
        reason: "imagem de referência não encontrada no servidor",
      });
    }
  } else if (data.startupReports.length === 0 || !data.startupReports.some((report) => report.processingStatus === "done" && report.extractedData)) {
    children.push(bodyParagraph("Startup ausente ou sem dados extraídos. Por se tratar de sistema que não tem fallback de referência LG aplicável, não foi criada uma baseline substituta.", { italic: true, color: COLORS.warningText }));
  }

  children.push(sectionHeading("5. Anexos visuais dos startups"));
  if (data.startupReports.length === 0) {
    children.push(bodyParagraph("Não há PDFs/imagens de startup anexáveis."));
  } else {
    let renderedStartupCount = 0;
    for (const report of data.startupReports) {
      try {
        const rendered = await renderStartupAttachment(report);
        if (!rendered) {
          issues.push({
            kind: "startup",
            name: report.filename,
            reason: report.fileUrl ? "arquivo original não encontrado no armazenamento" : "arquivo original não foi preservado",
          });
          continue;
        }
        renderedStartupCount += 1;
        children.push(sectionHeading(`Anexo visual — ${report.filename}`, HeadingLevel.HEADING_2));
        for (const [pageIndex, page] of rendered.pages.entries()) {
          if (pageIndex > 0 || renderedStartupCount > 1) {
            children.push(new Paragraph({ children: [new PageBreak()] }));
          }
          const pageImage = await imageRun(`${report.filename}-pagina-${pageIndex + 1}.jpg`, page);
          children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [pageImage] }));
          children.push(
            bodyParagraph(
              `${report.filename} — ${rendered.type === "pdf" ? `página ${pageIndex + 1} de ${rendered.pages.length}` : "imagem original"}`,
              { italic: true, color: COLORS.gray },
            ),
          );
        }
      } catch (error) {
        issues.push({
          kind: "startup",
          name: report.filename,
          reason: error instanceof Error ? error.message : "arquivo não renderizável",
        });
      }
    }
    if (renderedStartupCount === 0) {
      children.push(bodyParagraph("Nenhum arquivo visual de startup pôde ser incorporado."));
    }
  }

  children.push(sectionHeading("6. Conclusão"));
  children.push(
    bodyParagraph(
      "A conclusão deste relatório deve ser formada a partir dos dados e diagnósticos persistidos acima. Este documento não substitui inspeção, medições de campo, validação do fabricante ou responsabilidade técnica.",
    ),
  );

  children.push(sectionHeading("Pendências de anexos"));
  if (issues.length === 0) {
    children.push(bodyParagraph("Nenhum anexo ausente ou não renderizável foi identificado."));
  } else {
    children.push(bodyParagraph("Os itens abaixo não foram incorporados e são listados explicitamente para evitar omissão:"));
    issues.forEach((issue, index) => {
      children.push(bodyParagraph(`${index + 1}. [${issue.kind}] ${issue.name}: ${issue.reason}`, { color: COLORS.warningText }));
    });
  }

  children.push(sectionHeading("Responsável técnico"));
  children.push(bodyParagraph("Nome: ______________________________________________________________"));
  children.push(bodyParagraph("Registro profissional: ______________________________________________"));
  children.push(bodyParagraph("Assinatura: _________________________________________________________"));
  children.push(bodyParagraph("Data: ____/____/________"));
  children.push(
    bodyParagraph(
      "Declaração: a análise de IA contida neste documento requer revisão técnica, validação em campo e aprovação do responsável antes de orientar qualquer ação.",
      { italic: true, color: COLORS.warningText },
    ),
  );

  const document = new Document({
    creator: "VRF Monitor",
    title: "Relatório Técnico de Análise – Climatização VRF",
    description: "Exportação editável do VRF Monitor",
    styles: {
      default: {
        document: {
          run: { font: "Aptos", size: 20, color: COLORS.black },
          paragraph: { spacing: { after: 100 } },
        },
      },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", run: { bold: true, color: COLORS.teal, size: 28 }, paragraph: { spacing: { before: 260, after: 120 }, keepNext: true } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", run: { bold: true, color: COLORS.teal, size: 23 }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", run: { bold: true, color: COLORS.gray, size: 21 }, paragraph: { spacing: { before: 160, after: 90 }, keepNext: true } },
      ],
    },
    numbering: {
      config: [
        {
          reference: "report-numbered",
          levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 280 } } } }],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, right: 900, bottom: 900, left: 900, header: 450, footer: 450 },
          },
        },
        headers: {
          default: {
            options: { children: [new Paragraph({ children: [new TextRun({ text: "VRF Monitor — Relatório Técnico", color: COLORS.gray, size: 16 })] })] },
          },
        },
        footers: {
          default: {
            options: { children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Revisão técnica obrigatória — documento editável", color: COLORS.gray, size: 15 })] })] },
          },
        },
        children,
      },
    ],
  });

  return { buffer: await Packer.toBuffer(document), issues };
}

export async function loadLgReferenceTable(): Promise<Buffer | null> {
  const candidates = [
    path.join(process.cwd(), "src", "lib", "assets", "lg-reference-table.png"),
    path.join(process.cwd(), "assets", "lg-reference-table.png"),
  ];
  for (const candidate of candidates) {
    try {
      return await fs.promises.readFile(candidate);
    } catch {
      // Try the next server asset location.
    }
  }
  logger.warn({ candidates }, "LG reference table image not found for technical report");
  return null;
}