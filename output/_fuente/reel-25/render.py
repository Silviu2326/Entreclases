import sys, pathlib, subprocess
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent  # frames y previas se guardan aquí
PUB = pathlib.Path(r"C:\Users\usuario\Downloads\universe-proyecto-v8\universe\public").as_uri()
src = (HERE / "reel.html").read_text(encoding="utf-8").replace("PUB/", PUB + "/")
built = HERE / "reel.built.html"
built.write_text(src, encoding="utf-8")

FPS = 30
mode = sys.argv[1] if len(sys.argv) > 1 else "preview"
frames = HERE / "frames"
frames.mkdir(exist_ok=True)

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--allow-file-access-from-files"])
    pg = b.new_page(viewport={"width": 1080, "height": 1920})
    pg.goto(built.as_uri())
    pg.evaluate("document.fonts.ready")
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(400)
    if mode == "preview":
        for t in [float(x) for x in sys.argv[2:]]:
            pg.evaluate(f"render({t})")
            pg.screenshot(path=str(HERE / f"prev_{t:05.2f}.png"))
    else:
        dur = pg.evaluate("DURATION")
        n = int(round(dur * FPS))
        for i in range(n):
            pg.evaluate(f"render({i / FPS})")
            pg.screenshot(path=str(frames / f"f{i:04d}.png"))
        print("frames", n)
    b.close()
