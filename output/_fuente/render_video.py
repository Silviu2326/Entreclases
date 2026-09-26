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

# Expresividad de la voz: VOZ_STYLE alto y VOZ_STAB bajo dan una lectura más viva. Cambiarlos regenera las frases.
STYLE = float(os.environ.get("VOZ_STYLE", "0.35")); STAB = float(os.environ.get("VOZ_STAB", "0.45"))
# Aire antes y después de cada frase. Bajarlos aprieta el ritmo.
LEAD = float(os.environ.get("VOZ_LEAD", "0.35")); TAIL = float(os.environ.get("VOZ_TAIL", "0.55"))

LANG = os.environ.get("VOZ_LANG", "")  # "es" fuerza el idioma: evita que una palabra suelta se lea a la inglesa

def tts(text, voice=VOICE, prev="", nxt=""):
    vdir = HERE / "voz"; vdir.mkdir(exist_ok=True)
    key = text if (STYLE, STAB) == (0.35, 0.45) else f"{text}|{STYLE}|{STAB}"
    if voice != VOICE: key += f"|{voice}"  # diálogos: cada plano puede traer su propia voz
    if LANG: key += f"|{LANG}"
    if prev or nxt: key += f"|ctx:{prev[:40]}|{nxt[:40]}"
    f = vdir / (hashlib.sha1(key.encode()).hexdigest()[:12] + ".mp3")
    if not f.exists() and os.environ.get("SIN_VOZ"):
        # Sin clave: duración estimada para revisar la imagen; el mp3 se genera al render final.
        return None, 0.065 * len(text) + 0.4
    if not f.exists():
        body = {"text": text, "model_id": "eleven_multilingual_v2",
                "voice_settings": {"stability": STAB, "similarity_boost": 0.8, "style": STYLE, "use_speaker_boost": True}}
        if LANG: body["language_code"] = LANG
        if prev: body["previous_text"] = prev
        if nxt: body["next_text"] = nxt
        req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
            data=json.dumps(body).encode(), headers={"xi-api-key": os.environ["XI_KEY"], "content-type": "application/json", "accept": "audio/mpeg"})
        with urllib.request.urlopen(req) as r: f.write_bytes(r.read())
    # ElevenLabs deja silencio en los bordes; sin él, las frases se encadenan como en una conversación.
    trimmed = f.with_suffix(".trim.wav")
    if not trimmed.exists():
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(f), "-af",
            "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.08,areverse",
            str(trimmed)], check=True)
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(trimmed)]).decode())
    return trimmed, dur / TEMPO

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
    ids = pg.evaluate("window.getVoiceIds ? getVoiceIds() : null") or [None] * len(voices)
    clips, times, t, vdurs = [], [], 0.0, []
    for i, (text, mn) in enumerate(zip(voices, mins)):
        lead = LEAD
        if text:
            short = len(text) < 14
            f, d = tts(text, ids[i] or VOICE, voices[i - 1] if short and i > 0 else "", voices[i + 1] if short and i + 1 < len(voices) else "")
            if f: clips.append((f, t + lead))
            dur = max(mn, lead + d + TAIL); vdurs.append(round(d, 3))
        else:
            dur = mn; vdurs.append(0)
        if i == len(voices) - 1: dur += 1.2
        times.append({"start": round(t, 3), "dur": round(dur, 3)}); t += dur
    total = round(t, 3)
    (HERE / f".voz-{pathlib.Path(name).stem}.json").write_text(json.dumps(vdurs), encoding="utf-8")
    # efectos: nombre@segundos dentro del plano; el archivo vive en sfx/<nombre>.mp3
    sfx = []
    for i, spec in enumerate(pg.evaluate("window.getSfx ? getSfx() : []") or []):
        for item in filter(None, (spec or "").split(",")):
            sname, _, at = item.strip().partition("@")
            f = HERE / "sfx" / f"{sname}.mp3"
            if f.exists(): sfx.append((f, times[i]["start"] + float(at or 0)))
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
MUSIC = os.environ.get("MUSICA", ""); MUSIC_DB = float(os.environ.get("MUSICA_DB", "-20")); SFX_DB = float(os.environ.get("SFX_DB", "-6"))
cmd = ["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", str(frames / "f%05d.jpg")]
for f, _ in clips: cmd += ["-i", str(f)]
for f, _ in sfx: cmd += ["-i", str(f)]
music_index = None
if MUSIC and (HERE / MUSIC).exists():
    # en bucle pero acotada a la duración del vídeo: sin el -t, ffmpeg no termina nunca
    music_index = 1 + len(clips) + len(sfx); cmd += ["-stream_loop", "-1", "-t", str(total), "-i", str(HERE / MUSIC)]
parts, mix_in = [], []
if clips:
    parts += [f"[{k + 1}]atempo={TEMPO},adelay={int(at * 1000)}:all=1[a{k}]" for k, (_, at) in enumerate(clips)]
    parts.append("".join(f"[a{k}]" for k in range(len(clips))) + f"amix=inputs={len(clips)}:normalize=0,apad,atrim=0:{total}[voz]")
else:
    parts.append(f"anullsrc=r=44100:cl=stereo,atrim=0:{total}[voz]")
if sfx:
    base = 1 + len(clips)
    parts += [f"[{base + k}]volume={SFX_DB}dB,adelay={int(at * 1000)}:all=1[s{k}]" for k, (_, at) in enumerate(sfx)]
    parts.append("".join(f"[s{k}]" for k in range(len(sfx))) + f"amix=inputs={len(sfx)}:normalize=0,apad,atrim=0:{total}[sfx]")
    mix_in.append("[sfx]")
if music_index is not None:
    # la música baja sola cuando hay voz (sidechain) y vuelve despacio en los silencios
    parts.append("[voz]asplit[voz1][vozsc]")
    parts.append(f"[{music_index}]atrim=0:{total},volume={MUSIC_DB}dB,afade=t=in:d=0.4,afade=t=out:st={max(0, total - 1.5)}:d=1.5[mus0]")
    parts.append("[mus0][vozsc]sidechaincompress=threshold=0.04:ratio=6:attack=30:release=600[mus]")
    mix_in = ["[voz1]", "[mus]"] + mix_in
else:
    mix_in = ["[voz]"] + mix_in
if len(mix_in) > 1:
    parts.append("".join(mix_in) + f"amix=inputs={len(mix_in)}:normalize=0,apad,atrim=0:{total},aformat=channel_layouts=stereo,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[a]")
else:
    parts.append(f"{mix_in[0]}loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[a]")
fc = ";".join(parts)
cmd += ["-filter_complex", fc, "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(dest)]
subprocess.run(cmd, check=True)
shutil.rmtree(frames, ignore_errors=True)
print("ok", dest.relative_to(OUT))
