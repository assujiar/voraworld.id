"""Synthesize the VORA promo soundtrack (music stem + SFX stem) from code.

120 BPM, D major, I-V-vi-IV (D A Bm G), 60 seconds, 48 kHz stereo.
Every hit is placed on the same clock as the animation (see src/timeline.json).

Usage: python scripts/synth_audio.py  -> public/audio/music.wav, public/audio/sfx.wav
"""
import os
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
DUR = 62.0
N = int(SR * DUR)
BEAT = 0.5
BAR = 2.0
rng = np.random.default_rng(7)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "audio")


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(d):
    return np.arange(int(d * SR)) / SR


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


class Bus:
    def __init__(self):
        self.x = np.zeros((2, N))

    def add(self, t0, sig, gain=1.0, pan=0.0):
        if sig.ndim == 1:
            l = sig * np.sqrt(0.5 * (1 - pan))
            r = sig * np.sqrt(0.5 * (1 + pan))
            sig = np.stack([l, r]) * np.sqrt(2)
        i = int(round(t0 * SR))
        if i >= N:
            return
        if i < 0:
            sig = sig[:, -i:]
            i = 0
        e = min(N, i + sig.shape[1])
        self.x[:, i:e] += sig[:, : e - i] * gain


# ---------------------------------------------------------------- instruments
def kick(dur=0.45, punch=1.0):
    t = tt(dur)
    f = 44 + 140 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 6.5)
    click = hp(rng.standard_normal(len(t)), 2000) * np.exp(-t * 400) * 0.35
    return np.tanh((body + click) * 1.6 * punch) * 0.9


def boom(dur=2.6, size=1.0):
    t = tt(dur)
    f = 30 + 70 * np.exp(-t * 9)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sub = np.sin(ph) * np.exp(-t * 1.6)
    rumble = lp(rng.standard_normal(len(t)), 180) * np.exp(-t * 2.5) * 0.9
    crack = bp(rng.standard_normal(len(t)), 300, 4000) * np.exp(-t * 28) * 0.7
    return np.tanh((sub * 1.3 + rumble + crack + kick(dur) * 0.6) * size)


def clap():
    t = tt(0.3)
    n = bp(rng.standard_normal(len(t)), 900, 3200)
    env = np.zeros(len(t))
    for d in (0.0, 0.011, 0.023):
        k = t - d
        env += np.where(k >= 0, np.exp(-np.clip(k, 0, None) * 140), 0)
    env += np.where(t > 0.023, np.exp(-(t - 0.023) * 18), 0) * 0.6
    return n * env * 0.8


def hat(open_=False):
    d = 0.28 if open_ else 0.06
    t = tt(d)
    n = hp(rng.standard_normal(len(t)), 7500)
    return n * np.exp(-t * (9 if open_ else 70)) * (0.45 if open_ else 0.35)


def snare():
    t = tt(0.22)
    n = bp(rng.standard_normal(len(t)), 1200, 7000) * np.exp(-t * 16)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 28) * 0.5
    return (n + tone) * 0.7


def tom(f0=120):
    t = tt(0.4)
    f = f0 * (0.7 + 0.3 * np.exp(-t * 12))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 0.9


def crash(dur=2.2):
    t = tt(dur)
    n = hp(rng.standard_normal(len(t)), 3500)
    n2 = hp(rng.standard_normal(len(t)), 3500)
    env = np.exp(-t * 2.0) * (1 - np.exp(-t * 400))
    return np.stack([n, n2]) * env * 0.35


def saw(f, t, phase=0.0):
    return 2 * ((f * t + phase) % 1.0) - 1


def supersaw(notes, dur, cutoff=4500, attack=0.01, release=0.25, detune=0.18):
    t = tt(dur)
    L = np.zeros(len(t))
    R = np.zeros(len(t))
    for m in notes:
        f = mtof(m)
        for k, d in enumerate((-detune, -detune / 2, -detune / 5, 0, detune / 5, detune / 2, detune)):
            s = saw(f * 2 ** (d / 12), t, rng.random())
            if k % 2:
                L += s
            else:
                R += s
    env = np.minimum(1, t / attack) * np.where(t > dur - release, np.clip((dur - t) / release, 0, 1), 1)
    L = lp(L, cutoff) * env
    R = lp(R, cutoff) * env
    return np.stack([L, R]) / (len(notes) * 3.2)


def stab(notes, dur=0.32):
    t = tt(dur)
    out = supersaw(notes, dur, cutoff=7000, attack=0.003, release=0.12)
    env = np.exp(-t * 7)
    return out * env * 1.5


def pluck(m, dur=0.35, bright=1.0):
    t = tt(dur)
    f = mtof(m)
    s = np.zeros(len(t))
    for h, a in ((1, 1.0), (2, 0.5 * bright), (3, 0.28 * bright), (4, 0.15 * bright), (5, 0.08 * bright)):
        s += a * np.sin(2 * np.pi * f * h * t) * np.exp(-t * (6 + 5 * h))
    return s * np.minimum(1, t / 0.003) * 0.5


def pad(notes, dur, cutoff=1600, attack=0.6):
    t = tt(dur)
    out = supersaw(notes, dur, cutoff=cutoff, attack=attack, release=min(0.8, dur / 2), detune=0.12)
    trem = 1 + 0.05 * np.sin(2 * np.pi * 0.25 * t)
    return out * trem


def bass(m, dur):
    t = tt(dur)
    f = mtof(m)
    s = saw(f, t) * 0.6 + np.sin(2 * np.pi * f * t) * 0.8
    s = lp(s, 700) * np.minimum(1, t / 0.004) * np.where(t > dur - 0.03, np.clip((dur - t) / 0.03, 0, 1), 1)
    return np.tanh(s * 1.4) * 0.55


def riser(dur, lo=300, hi=7000):
    t = tt(dur)
    n = rng.standard_normal(len(t))
    out = np.zeros(len(t))
    seg = int(SR * 0.05)
    for i in range(0, len(t), seg):
        c = lo * (hi / lo) ** (i / len(t))
        out[i : i + seg] = bp(n[max(0, i - 2048) : i + seg], c * 0.7, min(c * 1.4, SR / 2 - 100))[-len(out[i : i + seg]) :]
    amp = (t / dur) ** 2.2
    f = mtof(50) * 2 ** (2 * t / dur)
    tone = saw(f, t) * 0.12
    return (out * 0.8 + lp(tone, 3000)) * amp


def whoosh(dur=0.45, up=True):
    t = tt(dur)
    n = rng.standard_normal(len(t))
    out = np.zeros(len(t))
    seg = int(SR * 0.02)
    for i in range(0, len(t), seg):
        p = i / len(t)
        c = 400 * (12 ** (p if up else 1 - p))
        out[i : i + seg] = bp(n[max(0, i - 1024) : i + seg], c * 0.6, c * 1.6)[-len(out[i : i + seg]) :]
    env = np.sin(np.pi * t / dur) ** 2
    return out * env * 0.9


def tick():
    t = tt(0.03)
    return np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 180) * 0.4


def key_click():
    t = tt(0.04)
    return (hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 220) * 0.5 + np.sin(2 * np.pi * 1400 * t) * np.exp(-t * 300) * 0.15)


def stamp():
    t = tt(0.35)
    f = 60 + 70 * np.exp(-t * 30)
    thud = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14)
    paper = bp(rng.standard_normal(len(t)), 700, 3500) * np.exp(-t * 35) * 0.6
    return np.tanh((thud + paper) * 1.5) * 0.9


def pop(f0=520):
    t = tt(0.12)
    f = f0 * (1 + 0.8 * (1 - np.exp(-t * 40)))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30) * 0.5


def zip_():
    t = tt(0.16)
    n = rng.standard_normal(len(t))
    return bp(n, 1500, 6000) * np.sin(np.pi * t / 0.16) * (0.5 + 0.5 * np.sin(2 * np.pi * 90 * t)) * 0.6


def slam():
    """Word hit: short kick + clap layer."""
    a = kick(0.3, 1.2)
    c = clap()
    n = max(len(a), len(c))
    out = np.zeros(n)
    out[: len(a)] += a
    out[: len(c)] += c * 0.6
    return out


def reverb(x, seconds=2.2, mix=0.25):
    t = tt(seconds)
    irL = rng.standard_normal(len(t)) * np.exp(-t * 3.2)
    irR = rng.standard_normal(len(t)) * np.exp(-t * 3.2)
    irL = lp(irL, 6000)
    irR = lp(irR, 6000)
    wetL = fftconvolve(x[0], irL)[:N]
    wetR = fftconvolve(x[1], irR)[:N]
    wet = np.stack([wetL, wetR])
    wet /= np.max(np.abs(wet)) + 1e-9
    wet *= np.max(np.abs(x)) + 1e-9
    return x * (1 - mix) + wet * mix * 1.4


# ---------------------------------------------------------------- harmony
CHORDS = {
    "D": [50, 57, 62, 66, 69],
    "A": [52, 57, 61, 64, 69],
    "Bm": [54, 59, 62, 66, 71],
    "G": [55, 59, 62, 67, 71],
}
ROOTS = {"D": 38, "A": 33, "Bm": 35, "G": 31}
PROG = ["D", "A", "Bm", "G"]


def chord_at(t, origin):
    return PROG[int((t - origin) // BAR) % 4]


drums = Bus()
bassb = Bus()
synth = Bus()   # chords / stabs / pads (sidechained)
lead = Bus()    # plucks
fx = Bus()      # music fx: risers, booms, crashes
sfx = Bus()     # visual sound effects (separate stem)
kick_times = []


def kick_at(t, g=1.0):
    drums.add(t, kick(), 0.95 * g)
    kick_times.append(t)


def groove(t0, t1, origin, level):
    """level 1 = light groove, 2 = fuller, 3 = full drop."""
    t = t0
    while t < t1 - 1e-6:
        beat_in_bar = int(round((t - origin) / BEAT)) % 4
        kick_at(t)
        if beat_in_bar in (1, 3):
            drums.add(t, clap(), 0.75 if level < 3 else 0.9)
        # hats
        drums.add(t + BEAT / 2, hat(open_=level >= 3), 0.9 if level >= 3 else 0.7, pan=0.25)
        if level >= 2:
            for k in (1, 3):
                drums.add(t + k * BEAT / 4, hat(), 0.45, pan=-0.25)
        # bass in 8ths
        c = chord_at(t, origin)
        r = ROOTS[c]
        for k in range(2):
            m = r + (12 if (level >= 3 and k == 1) else 0)
            bassb.add(t + k * BEAT / 2, bass(m, BEAT / 2 - 0.01), 1.0)
        # arp 16ths
        tones = CHORDS[c][1:] + [n + 12 for n in CHORDS[c][2:4]]
        for k in range(4):
            idx = (int(round((t - origin) / BEAT)) * 4 + k) % len(tones)
            lead.add(t + k * BEAT / 4, pluck(tones[idx] + 12, 0.3, 1.0), 0.32 if level < 3 else 0.28, pan=(-0.3 if k % 2 else 0.3))
        t += BEAT
    # chords per bar
    t = t0
    while t < t1 - 1e-6:
        c = chord_at(t, origin)
        d = min(BAR, t1 - t)
        if level == 1:
            synth.add(t, pad(CHORDS[c], d, cutoff=1400, attack=0.3), 0.5)
        elif level == 2:
            synth.add(t, pad(CHORDS[c], d, cutoff=2200, attack=0.15), 0.55)
            for off in (0.75, 1.75):
                if t + off < t1:
                    synth.add(t + off, stab(CHORDS[c][2:]), 0.35)
        else:
            synth.add(t, supersaw(CHORDS[c], d, cutoff=6500, attack=0.01, release=0.05), 0.85)
            for off in (0.0, 0.75, 1.5):
                if t + off < t1:
                    synth.add(t + off, stab([n + 12 for n in CHORDS[c][1:]]), 0.55)
        t += BAR


# ================================================================ ARRANGEMENT
# A. Opening logo 0-6: ticks, riser, four stamp booms, pad on D
for i in range(8):
    fx.add(i * 0.125, tick(), 0.5)
fx.add(0.0, riser(1.0, 400, 5000), 0.5)
for t, s in ((2.0, 0.8), (2.5, 0.85), (3.0, 0.9)):
    fx.add(t, boom(1.4, s), 0.7)
    kick_times.append(t)
fx.add(3.5, boom(2.8, 1.25), 1.0)
fx.add(3.5, crash(2.5), 0.8)
kick_times.append(3.5)
synth.add(3.5, pad(CHORDS["D"], 2.5, cutoff=1800, attack=0.05), 0.6)
for k, m in enumerate([62, 66, 69, 74, 78, 81, 78, 74]):
    lead.add(4.0 + k * 0.25, pluck(m + 12, 0.4), 0.3, pan=(-0.3 if k % 2 else 0.3))
fx.add(5.0, riser(1.0, 600, 6000), 0.35)

# B. Hook + meet + brief groove 6-19.5
groove(6.0, 10.0, 6.0, 1)
groove(10.0, 19.5, 6.0, 2)
for k in range(4):
    drums.add(19.5 + k * 0.1, snare(), 0.5 + 0.1 * k)
# ink flood into the map
fx.add(19.9, boom(1.6, 0.9), 0.75)
fx.add(19.9, crash(1.6), 0.4)
kick_times.append(19.9)

# C. Map 20-27.6: groove, pings climb the D-major pentatonic with every arc, then the build
groove(20.0, 25.5, 20.0, 2)
PENTA = [74, 76, 78, 81, 83, 86, 88, 90, 93, 95]
for k in range(10):
    lead.add(20.6 + k * 0.4, pluck(PENTA[k] + 12, 0.55, 0.6), 0.34, pan=(-0.4 if k % 2 else 0.4))
for k in range(8):
    lead.add(25.6 + k * 0.3, pluck(PENTA[min(9, k + 2)] + 12, 0.45, 0.6), 0.3, pan=(-0.4 if k % 2 else 0.4))
for k in range(8):
    drums.add(25.5 + k * 0.25, snare(), 0.5 + 0.04 * k)
t = 27.5 - 1.0
step = 0.125
while t < 27.55:
    drums.add(t, snare(), 0.8)
    t += step
    step = max(0.045, step * 0.85)
for k in range(4):
    kick_at(25.5 + k * 0.5, 0.9)
fx.add(23.6, riser(4.0, 250, 9000), 0.75)
synth.add(25.5, pad(CHORDS["G"], 2.1, cutoff=4500, attack=1.2), 0.55)

# E. DROP 28-48 with an impact on every service
groove(28, 48, 28, 3)
for T in (28, 32, 36, 40, 44):
    fx.add(T, boom(2.2, 1.1 if T == 28 else 0.95), 0.95 if T == 28 else 0.7)
    fx.add(T, crash(2.0), 0.7 if T == 28 else 0.45)
for tm, f in [(47, 160), (47.25, 140), (47.5, 120), (47.75, 95)]:
    drums.add(tm, tom(f), 0.9)

# F. Breakdown 48-52: pad, plucks, half-time pulse, three stamp hits
synth.add(48, pad(CHORDS["D"], 2.0, cutoff=1800, attack=0.05), 0.6)
synth.add(50, pad(CHORDS["A"], 2.0, cutoff=1800, attack=0.2), 0.6)
fx.add(48, boom(2.0, 0.9), 0.6)
fx.add(48, crash(2.0), 0.4)
for k in range(8):
    t = 48 + k * 0.5
    c = chord_at(t, 48)
    lead.add(t, pluck(CHORDS[c][3] + 12, 0.45), 0.3, pan=0.2)
    lead.add(t + 0.25, pluck(CHORDS[c][4] + 12, 0.45), 0.22, pan=-0.2)
for t in (48, 49, 50, 51):
    kick_at(t, 0.7)
for t in (49, 49.5, 50):
    fx.add(t, boom(1.0, 0.75), 0.55)

# G. Final build 52-56, BIG HIT at 56
groove(52, 54, 52, 2)
for k in range(8):
    drums.add(54 + k * 0.25, snare(), 0.55 + 0.04 * k)
t = 55
step = 0.125
while t < 55.95:
    drums.add(t, snare(), 0.85)
    t += step
    step = max(0.045, step * 0.82)
for tm, f in ((55.5, 150), (55.62, 130), (55.75, 110), (55.88, 90)):
    drums.add(tm, tom(f), 0.85)
fx.add(52, riser(4.0, 200, 10000), 0.85)
synth.add(54, pad(CHORDS["G"], 2.0, cutoff=5000, attack=1.0), 0.6)
fx.add(56, boom(4.0, 1.4), 1.15)
fx.add(56, crash(4.0), 1.0)
kick_times.append(56)
synth.add(56, supersaw(CHORDS["D"] + [74, 78], 4.2, cutoff=7000, attack=0.01, release=2.5), 1.0)
synth.add(56, pad([38, 45, 50, 57, 62, 66, 69], 5.8, cutoff=3000, attack=0.02), 0.6)
for k in range(12):
    drums.add(56.5 + k * 0.25, hat(), 0.35, pan=0.2)
for t in (57, 58, 59):
    kick_at(t, 0.55)
synth.add(60, stab([62, 66, 69, 74]), 0.5)
fx.add(60, boom(1.8, 0.8), 0.5)
kick_times.append(60)
for k, m in enumerate([74, 78, 81, 86]):
    lead.add(60 + k * 0.12, pluck(m + 12, 0.8), 0.22)

# ================================================================ SFX (visual)
S = sfx.add
S(0.55, whoosh(0.45, True), 0.8)
S(1.0, stamp(), 0.7); S(1.0, pop(700), 0.4)
for t in (2.0, 2.5, 3.0):
    S(t, stamp(), 0.8)
S(3.5, stamp(), 1.0)
S(4.0, whoosh(0.35, True), 0.35)
S(5.0, whoosh(0.6, False), 0.7)
for t in (6.5, 7.0, 7.5, 8.0):
    S(t, slam(), 0.7)
S(8.4, pop(820), 0.6)
S(9.3, whoosh(0.4, False), 0.4)
S(9.7, whoosh(0.35, True), 0.5)
S(10.0, pop(500), 0.6)
S(10.85, whoosh(0.5, True), 0.4)
S(13.95, whoosh(0.5, False), 0.4)
S(14.2, whoosh(0.5, False), 0.5)
S(14.4, whoosh(1.2, True), 0.45)
S(15.5, whoosh(0.4, True), 0.45)
for f0, n in ((16.3, 5), (17.0, 7), (17.7, 9), (18.4, 6)):
    for k in range(n):
        S(f0 + k * 0.05, key_click(), 0.5)
S(19.0, stamp(), 0.5)
S(19.5, whoosh(0.45, False), 0.6)
S(20.3, pop(900), 0.4)
for k in range(10):
    S(20.6 + k * 0.4, zip_(), 0.25)
S(24.2, whoosh(1.3, False), 0.6)
for k in range(8):
    S(25.6 + k * 0.3, zip_(), 0.25)
S(27.25, whoosh(0.6, True), 0.7)
S(28.3, whoosh(0.8, True), 0.8)    # plane sweep
for T in (32, 36, 40, 44):
    S(T - 0.45, whoosh(0.5, True), 0.7)
S(33, stamp(), 1.0)               # customs stamp
S(40.15, whoosh(0.5, False), 0.8)   # truck
for k in range(3):
    S(45 + k * 0.2, zip_(), 0.6)  # sling wraps
S(47.7, whoosh(0.6, True), 0.7)     # card flip
for t in (49, 49.5, 50):
    S(t, stamp(), 1.0)
S(51.5, whoosh(0.7, False), 0.6)
for k in range(7):
    S(52.6 + k * 0.42, zip_(), 0.7)
S(55.5, whoosh(0.3, True), 0.6)
S(58, pop(600), 0.5)
S(58.5, whoosh(0.4, True), 0.4)
S(59.4, pop(450), 0.4)

# ================================================================ MIX
side = np.ones(N)
for kt in kick_times:
    i = int(kt * SR)
    L = int(0.35 * SR)
    if i >= N:
        continue
    seg = 1 - 0.55 * np.exp(-np.arange(min(L, N - i)) / SR * 9)
    side[i : i + len(seg)] = np.minimum(side[i : i + len(seg)], seg)

music = (
    drums.x * 1.0
    + bassb.x * side * 0.9
    + reverb(synth.x * side, 2.0, 0.3) * 0.8
    + reverb(lead.x, 1.6, 0.3) * 0.9
    + reverb(fx.x, 2.6, 0.2) * 1.0
)
music = np.tanh(music * 1.1) / 1.1
# hard silence for the breath 25.6-26.0, short fades around it
a, b = int(27.55 * SR), int(28.0 * SR) - 1
fade = int(0.05 * SR)
music[:, a : a + fade] *= np.linspace(1, 0, fade)
music[:, a + fade : b] = 0
music[:, int(61.6 * SR):] *= np.linspace(1, 0, N - int(61.6 * SR))
sfxm = reverb(sfx.x, 1.2, 0.15)

os.makedirs(OUT, exist_ok=True)
sf.write(os.path.join(OUT, "music.wav"), (music / (np.max(np.abs(music)) + 1e-9) * 0.9).T.astype(np.float32), SR)
sf.write(os.path.join(OUT, "sfx.wav"), (sfxm / (np.max(np.abs(sfxm)) + 1e-9) * 0.9).T.astype(np.float32), SR)
print("music + sfx written")
