import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
  extractExplicitChCodes,
  generateManufacturerGuide,
  parseManufacturerGuidePage,
  validateGroundedManufacturerGuide,
  type ManufacturerManualPage,
} from "../src/lib/manufacturer-guide";
import { buildTechnicalReport } from "../src/lib/technical-report";

const sourcePage: ManufacturerManualPage = {
  page: 21,
  printedPage: "133",
  title: "Compressor initial operation error",
  text: "Check compressor wire connector condition. Is the connector connected correctly? Yes No",
};

test("fault extraction recognizes CH26 without digit coincidences", () => {
  assert.deepEqual(extractExplicitChCodes("Pressão 26 bar; corrente 2.6 A; alarme CH26."), ["26"]);
  assert.deepEqual(extractExplicitChCodes("Leituras 126, 260 e página 26 sem código de erro."), []);
});

test("strict validation retains only citations grounded on the supplied page", () => {
  const valid = {
    procedures: [{
      title: "Verificação",
      evidence: "CH26 observado",
      steps: [{
        instruction: "Verifique o conector.",
        expectedResult: "Conexão correta.",
        onPass: "Prossiga no ramo Yes.",
        onFail: "Corrija a conexão.",
        page: 21,
        sourceQuote: "Is the connector connected correctly?",
      }],
    }],
  };
  const guide = validateGroundedManufacturerGuide(valid, [sourcePage]);
  assert.equal(guide.status, "grounded");
  assert.deepEqual(guide.references.map((reference) => reference.page), [21]);
  assert.throws(
    () => validateGroundedManufacturerGuide({
      ...valid,
      procedures: [{
        ...valid.procedures[0],
        steps: [{ ...valid.procedures[0].steps[0], sourceQuote: "Replace every PCB immediately" }],
      }],
    }, [sourcePage]),
    /does not occur/,
  );
});

test("non-grounded statuses are explicit and invalid page bounds are rejected", async () => {
  const neverCalled = {
    chat: { completions: { create: async () => { throw new Error("must not be called"); } } },
  };
  const base = {
    vrfType: "multi_v_5",
    model: "configured-model",
    condensationType: "air",
    mode: "cooling",
    healthStatus: "healthy",
    notes: null,
    summary: "Operação normal sem alarme.",
    insights: [],
    recommendations: [],
    readings: [],
    baselineSource: "lg-air-reference" as const,
  };
  assert.equal((await generateManufacturerGuide(neverCalled, { ...base, vrfType: "multi_v_iv" })).status, "not_applicable");
  assert.equal((await generateManufacturerGuide(neverCalled, base)).status, "no_match");
  assert.equal(
    (await generateManufacturerGuide(neverCalled, {
      ...base,
      healthStatus: "warning",
      notes: "Código confirmado CH26",
    })).status,
    "unavailable",
  );
  assert.deepEqual(parseManufacturerGuidePage("0"), { status: 400 });
  assert.deepEqual(parseManufacturerGuidePage("67"), { status: 404 });
  assert.deepEqual(parseManufacturerGuidePage("abc"), { status: 400 });
  assert.deepEqual(parseManufacturerGuidePage("26"), { page: 26 });
});

test("DOCX contains readable branches, citations, safety, and one official page appendix", async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "manufacturer-guide-report-"));
  const previousCwd = process.cwd();
  try {
    process.chdir(temporary);
    const pageDirectory = path.join(temporary, "assets", "lg-multi-v5", "pages");
    fs.mkdirSync(pageDirectory, { recursive: true });
    fs.writeFileSync(path.join(temporary, "assets", "lg-multi-v5", "pages.json"), "[]");
    fs.writeFileSync(
      path.join(pageDirectory, "page-21.png"),
      Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    );
    const manufacturerGuide = validateGroundedManufacturerGuide({
      procedures: [{
        title: "Verificação",
        evidence: "CH26 observado",
        steps: [{
          instruction: "Verifique o conector.",
          expectedResult: "Conexão correta.",
          onPass: "Prossiga no ramo Yes.",
          onFail: "Corrija a conexão.",
          page: 21,
          sourceQuote: "Is the connector connected correctly?",
        }],
      }],
    }, [sourcePage]);
    const result = await buildTechnicalReport({
      system: {
        id: 1, code: "MV5", name: "Teste", category: "escritorios_xp", vrfType: "multi_v_5",
        location: null, floor: null, servedArea: null, model: null, startupDate: null, building: null,
        condensationType: "water", notes: null, healthStatus: "warning", lastReadingDate: "2026-01-01",
        deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
      },
      sessions: [{
        session: {
          id: 1, systemId: 1, sessionDate: "2026-01-01", mode: "cooling", notes: "CH26",
          healthStatus: "warning", analysisResult: JSON.stringify({
            summary: "Teste", recommendations: [], manufacturerGuide,
          }), createdAt: new Date(),
        },
        photos: [],
        readings: [],
      }],
      startupReports: [],
      lgReferenceRequired: false,
      lgReferenceBuffer: null,
    });
    const output = path.join(temporary, "report.docx");
    fs.writeFileSync(output, result.buffer);
    const xml = execFileSync("unzip", ["-p", output, "word/document.xml"], { encoding: "utf8" });
    assert.match(xml, /Resultado esperado/);
    assert.match(xml, /Se SIM\/aprovado/);
    assert.match(xml, /PDF p\. 21 \/ página impressa 133/);
    assert.match(xml, /Uso exclusivo por pessoal qualificado/);
    assert.match(xml, /Original oficial em inglês/);
    const imageReferences = xml.match(/<a:blip r:embed=/g) ?? [];
    assert.equal(imageReferences.length, 1);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});