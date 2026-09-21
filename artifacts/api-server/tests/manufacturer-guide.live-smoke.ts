import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateManufacturerGuide } from "../src/lib/manufacturer-guide";
import { buildTechnicalReport } from "../src/lib/technical-report";

async function main(): Promise<void> {
const guide = await generateManufacturerGuide(openai, {
  vrfType: "multi_v_5",
  model: "ARUN100LTE5 (controlled smoke-test fixture; field confirmation still required)",
  condensationType: "air",
  mode: "cooling",
  healthStatus: "warning",
  notes: "Código CH26 explicitamente observado no display. Nenhuma medição elétrica foi fornecida.",
  summary: "Falha de partida do compressor indicada por CH26; causa ainda não confirmada.",
  insights: ["CH26 é observação; sobrecarga, conexão e compressor permanecem hipóteses."],
  recommendations: ["Seguir somente o fluxo oficial aplicável após confirmar placa/modelo e alimentação."],
  baselineSource: "none",
  readings: [{
    parameter: "Código de erro CH26",
    value: null,
    unit: "",
    minNormal: null,
    maxNormal: null,
    baselineValue: null,
    source: "Foto 1",
    status: "critical",
  }],
});

if (guide.status !== "grounded" && guide.status !== "no_match") {
  throw new Error(`Live grounding did not validate: ${guide.status}: ${guide.reason}`);
}

const result = await buildTechnicalReport({
  system: {
    id: 999999, code: "SMOKE", name: "Controlled smoke fixture", category: "escritorios_xp",
    vrfType: "multi_v_5", location: null, floor: null, servedArea: null, model: "ARUN100LTE5",
    startupDate: null, building: null, condensationType: "air", notes: null, healthStatus: "warning",
    lastReadingDate: "2026-01-01", deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
  },
  sessions: [{
    session: {
      id: 999999, systemId: 999999, sessionDate: "2026-01-01", mode: "cooling",
      notes: "CH26", healthStatus: "warning",
      analysisResult: JSON.stringify({ summary: "Controlled smoke fixture", recommendations: [], manufacturerGuide: guide }),
      createdAt: new Date(),
    },
    photos: [],
    readings: [],
  }],
  startupReports: [],
  lgReferenceRequired: false,
  lgReferenceBuffer: null,
});

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "manufacturer-guide-live-"));
try {
  const docx = path.join(temporary, "live-smoke.docx");
  fs.writeFileSync(docx, result.buffer);
  const xml = execFileSync("unzip", ["-p", docx, "word/document.xml"], { encoding: "utf8" });
  const citations = [...xml.matchAll(/PDF p\. (\d+) \/ página impressa ([^<.]+)/g)].map((match) => ({
    page: Number(match[1]),
    printedPage: match[2],
  }));
  const imageReferences = (xml.match(/<a:blip r:embed=/g) ?? []).length;
  if (guide.status === "grounded" && (citations.length === 0 || imageReferences === 0)) {
    throw new Error("DOCX smoke output is missing citations or source images");
  }
  console.log(JSON.stringify({
    status: guide.status,
    references: guide.references,
    procedures: guide.procedures.length,
    steps: guide.procedures.reduce((count, procedure) => count + procedure.steps.length, 0),
    docxCitations: citations,
    docxImageReferences: imageReferences,
    docxBytes: result.buffer.length,
  }, null, 2));
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});