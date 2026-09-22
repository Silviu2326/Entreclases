"""Exporta cada elemento con data-out="<día>/<carpeta>/<archivo>.png" de las páginas dadas.
Uso: python render_static.py historias-22.html carrusel-26.html ..."""
import sys, pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent
PUB = pathlib.Path(r"C:\Users\usuario\Downloads\universe-proyecto-v8\universe\public").as_uri()
REC = (OUT / "_recursos").as_uri()

def build(name):
    src = (HERE / name).read_text(encoding="utf-8")
    css = (HERE / "base.css").read_text(encoding="utf-8")
    src = src.replace("<!--BASE-->", f"<style>{css}</style>").replace("PUB/", PUB + "/").replace("REC/", REC + "/")
    built = HERE / f".{name}.built.html"
    built.write_text(src, encoding="utf-8")
    return built

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--allow-file-access-from-files"])
    pg = b.new_page(viewport={"width": 1160, "height": 2000})
    for name in sys.argv[1:]:
        built = build(name)
        pg.goto(built.as_uri())
        pg.evaluate("document.fonts.ready")
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(300)
        for el in pg.query_selector_all("[data-out]"):
            dest = OUT / el.get_attribute("data-out")
            dest.parent.mkdir(parents=True, exist_ok=True)
            el.screenshot(path=str(dest))
            print(dest.relative_to(OUT))
        built.unlink()
    b.close()
