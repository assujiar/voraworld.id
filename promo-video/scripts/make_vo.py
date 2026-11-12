"""Generate the English voiceover, one WAV per line, with Kokoro-82M (Apache-2.0).

Usage: KOKORO_DIR=<dir with model.onnx + voices.npz> python scripts/make_vo.py
"""
import json, os
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KD = os.environ["KOKORO_DIR"]
T = json.load(open(os.path.join(ROOT, "src", "timeline.json")))
k = Kokoro(os.path.join(KD, "model.onnx"), os.path.join(KD, "voices.npz"))
voice = json.loads(os.environ["VOICE_JSON"]) if os.environ.get("VOICE_JSON") else T["voice"]
speed_mul = float(os.environ.get("SPEED_MUL", T.get("speedMul", 1.0)))
style = sum(w * k.get_voice_style(n) for n, w in voice.items())
out = os.environ.get("VO_OUT") or os.path.join(ROOT, "public", "audio", "vo")
os.makedirs(out, exist_ok=True)
report = {}
for line in T["vo"]:
    a, sr = k.create(line["say"], voice=style, speed=line.get("speed", 1.0) * speed_mul, lang="en-us")
    # trim leading/trailing silence
    idx = np.where(np.abs(a) > 0.01)[0]
    a = a[max(0, idx[0] - 240): idx[-1] + 2400]
    sf.write(os.path.join(out, f"{line['id']}.wav"), a, sr)
    report[line["id"]] = round(len(a) / sr, 2)
    print(f"{line['id']:12s} {len(a)/sr:5.2f}s  start {line['start']}  max {line['max']}  {'OK' if len(a)/sr <= line['max'] else 'TOO LONG'}")
json.dump(report, open(os.path.join(out, "durations.json"), "w"), indent=1)
