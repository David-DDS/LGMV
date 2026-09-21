import fs from "fs";
import { Router, type IRouter } from "express";
import {
  MANUFACTURER_GUIDE_DOCUMENT_ID,
  MANUFACTURER_GUIDE_TITLE,
  manufacturerGuideFile,
  loadManufacturerManualPages,
  parseManufacturerGuidePage,
} from "../../lib/manufacturer-guide";

const router: IRouter = Router();

router.get("/manufacturer-guide", (_req, res): void => {
  try {
    const pages = loadManufacturerManualPages();
    res.json({
      version: 1,
      documentId: MANUFACTURER_GUIDE_DOCUMENT_ID,
      title: MANUFACTURER_GUIDE_TITLE,
      year: 2021,
      language: "en",
      scope: "Trecho de treinamento/serviço LG para autodiagnóstico; a aplicabilidade ao modelo deve ser confirmada.",
      pageCount: pages.length,
      printedPageRange: `${pages[0].printedPage}-${pages[pages.length - 1].printedPage}`,
      pdfUrl: "/api/manufacturer-guide/pdf",
      pageUrlTemplate: "/api/manufacturer-guide/pages/{page}",
    });
  } catch {
    res.status(503).json({ error: "Manufacturer guide is unavailable" });
  }
});

router.get("/manufacturer-guide/pdf", (_req, res): void => {
  const file = manufacturerGuideFile("pdf");
  if (!file || !fs.existsSync(file)) {
    res.status(503).json({ error: "Manufacturer guide PDF is unavailable" });
    return;
  }
  res.type("application/pdf").sendFile(file);
});

router.get("/manufacturer-guide/pages/:page", (req, res): void => {
  const parsed = parseManufacturerGuidePage(req.params.page);
  if (parsed.status === 400) {
    res.status(400).json({ error: "page must be an integer from 1 to 66" });
    return;
  }
  if (parsed.status === 404 || parsed.page === undefined) {
    res.status(404).json({ error: "Manufacturer guide page not found" });
    return;
  }
  const page = parsed.page;
  const file = manufacturerGuideFile("page", page);
  if (!file || !fs.existsSync(file)) {
    res.status(503).json({ error: "Manufacturer guide page image is unavailable" });
    return;
  }
  res.type("image/png").sendFile(file);
});

export default router;