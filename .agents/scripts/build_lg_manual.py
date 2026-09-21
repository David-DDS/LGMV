"""Bundle the user-provided manufacturer excerpt without modifying its pages."""
import hashlib
import json
import re
import shutil
from pathlib import Path
import pymupdf

source = Path("attached_assets/LGMV_Total_ENG_1790020957514.pdf")
target = Path("artifacts/api-server/assets/lg-multi-v5")
images = target / "pages"
images.mkdir(parents=True, exist_ok=True)
shutil.copyfile(source, target / "original.pdf")
doc = pymupdf.open(source)
pages = []
for index, page in enumerate(doc):
    text = page.get_text()
    number = re.search(r"-\s*(\d{3})\s*-", text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    candidates = [line for line in lines if not any(
        word in line for word in ["Copyright", "reserved", "Self-diagnosis",
                                  "Only training", "LG Electronics"])
        and not re.fullmatch(r"[-\d\s]+", line)]
    pages.append({
        "page": index + 1,
        "printedPage": number.group(1) if number else "",
        "title": " / ".join(candidates[:2])[:160],
        "text": text,
    })
    page.get_pixmap(matrix=pymupdf.Matrix(1.4, 1.4)).save(images / f"page-{index+1}.png")
(target / "pages.json").write_text(json.dumps(pages, ensure_ascii=False, indent=2))
(target / "provenance.json").write_text(json.dumps({
    "documentId": "lg-multi-v5-troubleshooting-2021",
    "sourceFilename": source.name,
    "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "pageCount": len(pages),
    "printedPages": f"{pages[0]['printedPage']}–{pages[-1]['printedPage']}",
    "notice": "LG Electronics © 2021. Only training and service purposes. "
              "Excerpt supplied by the user; applicability must be checked for the specific model.",
}, indent=2, ensure_ascii=False))
print(f"Bundled {len(pages)} pages; original preserved.")