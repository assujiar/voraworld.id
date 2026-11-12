"""Mix music + SFX + voiceover into public/audio/soundtrack.wav at about -14 LUFS.

The music ducks under each voiceover line; the drums stay audible.
"""
import json, os
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy.signal import resample_poly

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "public", "audio")
T = json.load(open(os.path.join(ROOT, "src", "timeline.json")))

music, _ = sf.read(os.path.join(A, "music.wav"), always_2d=True)
sfx, _ = sf.read(os.path.join(A, "sfx.wav"), always_2d=True)
N = music.shape[0]
vo = np.zeros(N)
for line in T["vo"]:
    x, sr = sf.read(os.path.join(os.environ.get("VO_DIR") or os.path.join(A, "vo"), f"{line['id']}.wav"))
    if sr != SR:
        x = resample_poly(x, SR, sr)
    i = int(line["start"] * SR)
    e = min(N, i + len(x))
    vo[i:e] += x[: e - i]

# voice clarity: cut rumble, lift presence (2-5 kHz), then gentle compression
from scipy.signal import butter, sosfilt
vo = sosfilt(butter(2, 90, btype="high", fs=SR, output="sos"), vo)
vo = vo + 0.4 * sosfilt(butter(2, [2000, 5000], btype="band", fs=SR, output="sos"), vo)
vo = np.tanh(vo / (np.max(np.abs(vo)) + 1e-9) * 1.3)

# ducking envelope from the voice
env = np.abs(vo)
win = int(0.03 * SR)
env = np.convolve(env, np.ones(win) / win, mode="same")
active = (env > 0.02).astype(float)
att, rel = int(0.06 * SR), int(0.35 * SR)
smooth = np.zeros(N)
g = 0.0
for i in range(0, N, 240):  # 5 ms blocks
    tgt = active[i]
    step = 240 / (att if tgt > g else rel)
    g = min(tgt, g + step) if tgt > g else max(tgt, g - step)
    smooth[i : i + 240] = g
duck = 1 - 0.62 * smooth  # about -8.4 dB under voice

mix = music * duck[:, None] * 0.62 + sfx * 0.38 + np.stack([vo, vo], 1) * 0.8

meter = pyln.Meter(SR)
loud = meter.integrated_loudness(mix)
mix = mix * 10 ** ((-14.0 - loud) / 20)
# soft peak limiting to about -1 dBFS
ceil = 10 ** (-1.0 / 20)
mix = np.where(np.abs(mix) > ceil * 0.8, np.sign(mix) * (ceil * 0.8 + (ceil * 0.2) * np.tanh((np.abs(mix) - ceil * 0.8) / (ceil * 0.2))), mix)
final = meter.integrated_loudness(mix)
sf.write(os.environ.get("MIX_OUT") or os.path.join(A, "soundtrack.wav"), mix.astype(np.float32), SR)
print(f"integrated {final:.1f} LUFS, peak {20*np.log10(np.max(np.abs(mix))):.1f} dBFS")
for a, b in T["scenes"].values():
    seg = mix[int(a * SR) : int(b * SR)]
    if len(seg) > SR * 0.4:
        print(f"{a:5.1f}-{b:5.1f}s  {meter.integrated_loudness(seg) if len(seg) > SR*0.5 else float('nan'):6.1f} LUFS")
