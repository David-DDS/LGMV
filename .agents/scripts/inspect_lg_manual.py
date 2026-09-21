import fitz, json
from pathlib import Path
doc=fitz.open("attached_assets/LGMV_Total_ENG_1790020957514.pdf")
out=Path(".agents/outputs/lg-manual")
out.mkdir(parents=True,exist_ok=True)
pages=[{"page":i+1,"text":p.get_text()} for i,p in enumerate(doc)]
(out/"pages.json").write_text(json.dumps(pages,ensure_ascii=False))
print("pages",len(pages),"characters",sum(len(p["text"]) for p in pages))
for p in pages[:5]: print(p["page"],p["text"][:1300])
for i in [0,min(5,len(doc)-1),min(15,len(doc)-1)]:
    doc[i].get_pixmap(matrix=fitz.Matrix(1,1)).save(out/f"page-{i+1}.png")