"""Vídeo vertical con locución de ElevenLabs.
Uso: python render_video.py tiktok-24.html 24-09/tiktok/entreclases-24-09.mp4
Necesita XI_KEY en el entorno la primera vez que se genera cada frase (se guardan en voz/)."""
import sys, os, json, hashlib, pathlib, subprocess, shutil, urllib.request
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent
PUB = pathlib.Path(r"C:\Users\usuario\Downloads\universe-proyecto-v8\universe\public").as_uri()
REC = (OUT / "_recursos").as_uri()
VOICE = "RwzBDEn5f6FIgpAjH9YN"
FPS = 30
TEMPO = float(os.environ.get("VOZ_TEMPO", "1"))  # >1 acelera la locución sin cambiar el tono
name, dest = sys.argv[1], OUT / sys.argv[2]
only = sys.argv[3] if len(sys.argv) > 3 else None  # "preview:1.0,2.5" para capturas sueltas

def tts(text):
    vdir = HERE / "voz"; vdir.mkdir(exist_ok=True)
    f = vdir / (hashlib.sha1(text.encode()).hexdigest()[:12] + ".mp3")
    if not f.exists() and os.environ.get("SIN_VOZ"):
        # Sin clave: duración estimada para revisar la imagen; el mp3 se genera al render final.
        return None, 0.065 * len(text) + 0.4
    if not f.exists():
        body = {"text": text, "model_id": "eleven_multilingual_v2",
                "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.35, "use_speaker_boost": True}}
        req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
            data=json.dumps(body).encode(), headers={"xi-api-key": os.environ["XI_KEY"], "content-type": "application/json", "accept": "audio/mpeg"})
        with urllib.request.urlopen(req) as r: f.write_bytes(r.read())
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)]).decode())
    return f, dur / TEMPO

src = (HERE / name).read_text(encoding="utf-8")
css = (HERE / "base.css").read_text(encoding="utf-8") + (HERE / "video.css").read_text(encoding="utf-8")
js = (HERE / "engine.js").read_text(encoding="utf-8")
src = src.replace("<!--BASE-->", f"<style>{css}</style>").replace("<!--ENGINE-->", f"<script>{js}</script>")
src = src.replace("PUB/", PUB + "/").replace("REC/", REC + "/")
built = HERE / f".{name}.built.html"; built.write_text(src, encoding="utf-8")

frames = HERE / f".frames-{pathlib.Path(name).stem}"
with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--allow-file-access-from-files"])
    pg = b.new_page(viewport={"width": 1080, "height": 1920})
    pg.goto(built.as_uri()); pg.evaluate("document.fonts.ready"); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(300)
    voices, mins = pg.evaluate("getVoices()"), pg.evaluate("getMinDurations()")
    clips, times, t = [], [], 0.0
    for i, (text, mn) in enumerate(zip(voices, mins)):
        lead = 0.35
        if text:
            f, d = tts(text)
            if f: clips.append((f, t + lead))
            dur = max(mn, lead + d + 0.55)
        else:
            dur = mn
        if i == len(voices) - 1: dur += 1.2
        times.append({"start": round(t, 3), "dur": round(dur, 3)}); t += dur
    total = round(t, 3)
    pg.evaluate(f"window.TIMES = {json.dumps(times)}; window.TOTAL = {total}")
    print(name, "duración", total, "s")
    if only:
        pts = only.split(":")[1]
        xs = [str(round(tm["start"] + tm["dur"] * 0.75, 2)) for tm in times] if pts == "auto" else pts.split(",")
        for x in xs:
            pg.evaluate(f"render({x})"); pg.screenshot(path=str(HERE / f".prev-{pathlib.Path(name).stem}-{x}.png"))
        b.close(); built.unlink(); sys.exit()
    if frames.exists(): shutil.rmtree(frames)
    frames.mkdir()
    n = int(round(total * FPS))
    for i in range(n):
        pg.evaluate(f"render({i / FPS})")
        pg.screenshot(path=str(frames / f"f{i:05d}.jpg"), type="jpeg", quality=93)
    b.close()
built.unlink()

dest.parent.mkdir(parents=True, exist_ok=True)
cmd = ["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", str(frames / "f%05d.jpg")]
for f, _ in clips: cmd += ["-i", str(f)]
if clips:
    parts = [f"[{k + 1}]atempo={TEMPO},adelay={int(at * 1000)}:all=1[a{k}]" for k, (_, at) in enumerate(clips)]
    mix = "".join(f"[a{k}]" for k in range(len(clips)))
    fc = ";".join(parts) + f";{mix}amix=inputs={len(clips)}:normalize=0,apad,atrim=0:{total},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[a]"
else:  # revisión sin voz: pista muda para que el archivo sea válido en cualquier reproductor
    fc = f"anullsrc=r=44100:cl=stereo,atrim=0:{total}[a]"
cmd += ["-filter_complex", fc, "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(dest)]
subprocess.run(cmd, check=True)
shutil.rmtree(frames, ignore_errors=True)
print("ok", dest.relative_to(OUT))
