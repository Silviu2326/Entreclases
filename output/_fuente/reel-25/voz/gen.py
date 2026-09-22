import json, os, urllib.request
KEY = os.environ["XI_KEY"]; VOICE = "RwzBDEn5f6FIgpAjH9YN"
LINES = [
  "Busco gente para estudiar.",
  "Me apetece hacer algo esta tarde.",
  "Quiero conocer gente fuera de mi clase.",
  "Tengo una idea y necesito colaboradores.",
  "Para eso existe Entreclases.",
  "Veintiocho de septiembre. Valencia.",
]
for i, text in enumerate(LINES):
    body = {"text": text, "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.35, "use_speaker_boost": True}}
    if i: body["previous_text"] = " ".join(LINES[:i])
    if i < len(LINES) - 1: body["next_text"] = LINES[i + 1]
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
        data=json.dumps(body).encode(), headers={"xi-api-key": KEY, "content-type": "application/json", "accept": "audio/mpeg"})
    with urllib.request.urlopen(req) as r, open(f"l{i+1}.mp3", "wb") as f:
        f.write(r.read())
    print("ok", i + 1)
