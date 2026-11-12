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

EDIT = os.environ.get("EDIT", "full")
SUF = "_gbp" if EDIT == "gbp" else ""


def to_edit(t):
    if EDIT != "gbp" or t < 14.3:
        return t
    if t < 19.9:
        return 14.3 + (t - 14.3) * (3.6 / 5.6)
    if t < 52:
        return t - 2
    if t < 56:
        return None
    return t - 6


music, _ = sf.read(os.path.join(A, f"music{SUF}.wav"), always_2d=True)
sfx, _ = sf.read(os.path.join(A, f"sfx{SUF}.wav"), always_2d=True)
N = music.shape[0]
vo = np.zeros(N)
for line in T["vo"]:
    x, sr = sf.read(os.path.join(os.environ.get("VO_DIR") or os.path.join(A, "vo"), f"{line['id']}.wav"))
    if sr != SR:
        x = resample_poly(x, SR, sr)
    st = to_edit(line["start"])
    if st is None:
        continue
    i = int(st * SR)
    e = min(N, i + len(x))
    vo[i:e] += x[: e - i]

# voice clarity: cut rumble, lift presence (2-5 kHz), then gentle compression
from scipy.signal import butter, sosfilt
vo = sosfilt(butter(2, 90, btype="high", fs=SR, output="sos"), vo)
vo = vo + 0.4 * sosfilt(butter(2, [2000, 5000], btype="band", fs=SR, output="sos"), vo)
vo /= np.max(np.abs(vo)) + 1e-9

# leveler: ride quiet and low-pitched syllables up (max +9 dB) so phrase ends stay audible
blk = int(0.04 * SR)
rms = np.sqrt(np.convolve(vo**2, np.ones(blk) / blk, mode="same")) + 1e-6
target = 0.22
gain = np.clip(target / rms, 1.0, 10 ** (9 / 20))
gain = np.where(rms < 0.01, 1.0, gain)  # leave silence alone
gain = np.convolve(gain, np.ones(blk) / blk, mode="same")
vo = np.tanh(vo * gain * 1.4)

# ducking envelope from the voice (held through short pauses between words)
env = np.abs(vo)
win = int(0.03 * SR)
env = np.convolve(env, np.ones(win) / win, mode="same")
active = (env > 0.02).astype(float)
hold = int(0.3 * SR)
active = (np.convolve(active, np.ones(hold), mode="same") > 0).astype(float)
att, rel = int(0.06 * SR), int(0.35 * SR)
smooth = np.zeros(N)
g = 0.0
for i in range(0, N, 240):  # 5 ms blocks
    tgt = active[i]
    step = 240 / (att if tgt > g else rel)
    g = min(tgt, g + step) if tgt > g else max(tgt, g - step)
    smooth[i : i + 240] = g
duck = 1 - 0.68 * smooth  # about -10 dB under voice

# carve the voice's own range (low-mid body 150-700 Hz, consonants 1.5-4 kHz) out of the music while she talks
body = sosfilt(butter(2, [150, 700], btype="band", fs=SR, output="sos"), music, axis=0)
pres = sosfilt(butter(2, [1500, 4000], btype="band", fs=SR, output="sos"), music, axis=0)
music_carved = music - (0.55 * body + 0.45 * pres) * smooth[:, None]

voice = np.stack([vo, vo], 1) * 1.0
mix = music_carved * duck[:, None] * 0.62 + sfx * 0.32 + voice

# report how far the voice sits above the music while she talks
_m = pyln.Meter(SR)
_mask = smooth > 0.9
_v = voice[_mask]
_b = (music_carved * duck[:, None] * 0.62 + sfx * 0.32)[_mask]
print(f"voice over bed while talking: {_m.integrated_loudness(_v) - _m.integrated_loudness(_b):+.1f} dB")

meter = pyln.Meter(SR)
loud = meter.integrated_loudness(mix)
mix = mix * 10 ** ((-14.0 - loud) / 20)
# soft peak limiting to about -1 dBFS
ceil = 10 ** (-1.0 / 20)
mix = np.where(np.abs(mix) > ceil * 0.8, np.sign(mix) * (ceil * 0.8 + (ceil * 0.2) * np.tanh((np.abs(mix) - ceil * 0.8) / (ceil * 0.2))), mix)
final = meter.integrated_loudness(mix)
sf.write(os.environ.get("MIX_OUT") or os.path.join(A, f"soundtrack{SUF}.wav"), mix.astype(np.float32), SR)
print(f"integrated {final:.1f} LUFS, peak {20*np.log10(np.max(np.abs(mix))):.1f} dBFS")
for a, b in T["scenes"].values():
    seg = mix[int(a * SR) : int(b * SR)]
    if len(seg) > SR * 0.4:
        print(f"{a:5.1f}-{b:5.1f}s  {meter.integrated_loudness(seg) if len(seg) > SR*0.5 else float('nan'):6.1f} LUFS")
