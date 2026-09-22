import pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent.parent / "24-09" / "instagram"
PUB = pathlib.Path(r"C:\Users\usuario\Downloads\universe-proyecto-v8\universe\public").as_uri()
src = (HERE / "carrusel.html").read_text(encoding="utf-8").replace("PUB/", PUB + "/")
built = HERE / "carrusel.built.html"
built.write_text(src, encoding="utf-8")

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--allow-file-access-from-files"])
    pg = b.new_page(viewport={"width": 1080, "height": 1350})
    pg.goto(built.as_uri())
    pg.evaluate("document.fonts.ready")
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(400)
    for i, el in enumerate(pg.query_selector_all(".slide"), 1):
        el.screenshot(path=str(OUT / f"{i:02d}.png"))
        print("slide", i)
    b.close()
built.unlink()
