"""Intro sound (clicks, scrub preview, keys, render chime) + the film's mix from PLAY_AT onwards."""
import json, wave, sys, numpy as np
SR = 48000
d = json.load(open('playhead.json')); ph, cues = d['ph'], d['cues']
PLAY = cues['play']
def readwav(p):
    w = wave.open(p); a = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').reshape(-1, w.getnchannels()).astype(float) / 32768
    assert w.getframerate() == SR; return a
film = readwav(sys.argv[1])                     # the finished film's (already mastered) audio
N = int((PLAY + len(film) / SR) * SR)
out = np.zeros((N, 2)); rng = np.random.default_rng(5)
def add(sig, t, g=1.0, pan=0.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[: j - i] * g
    if s.ndim == 1: out[i:j, 0] += s * (1 - max(0, pan)); out[i:j, 1] += s * (1 + min(0, pan))
    else: out[i:j] += s
T = lambda dd: np.arange(int(dd * SR)) / SR
def lp(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / np.sqrt(1 + (f / fc) ** 4); return np.fft.irfft(X, len(x))
def click(g=1.0, bright=1.0):
    t = T(0.04); n = rng.standard_normal(len(t)) * np.exp(-t * 260)
    tone = np.sin(2 * np.pi * 2900 * bright * t) * np.exp(-t * 400) * 0.6
    return lp(n + tone, 6000 * bright) * 0.35 * g
def key(): t = T(0.07); return lp(rng.standard_normal(len(t)) * np.exp(-t * 90), 3500) * 0.3 + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 60) * 0.15
def chime():
    t = T(1.2); return sum(np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, k in ((1318.5, 4), (1975.5, 5), (2637, 7))) * 0.07
def pop(): t = T(0.18); f = 520 * (1 + 0.8 * np.exp(-t * 30)); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22) * 0.12
def whoosh(dd=0.8, g=1.0):
    n = int(dd * SR); x = lp(rng.standard_normal(n), 2500); tt = np.linspace(0, 1, n); return x / np.abs(x).max() * np.sin(np.pi * tt) ** 2 * 0.12 * g
# room tone
out[: int(PLAY * SR)] += (lp(rng.standard_normal(int(PLAY * SR)), 400) * 0.004)[:, None]
for c in cues['clicks']: add(click(), c, pan=0.2)
for c in cues['releases']: add(click(0.6, 0.8), c, pan=0.2)
for k in cues['keys']: add(key(), k)
add(whoosh(3.6, 0.5), cues['zoom'][0])
# scrub preview: grains of the film audio at the playhead while dragging (1.1s – 2.4s)
for f, p in enumerate(ph):
    t = f / 30
    if cues['scrub'][0] <= t < cues['scrub'][1]:
        i = int(p * SR); g = film[i:i + int(SR / 30) + 200].copy()
        if len(g) < 300: continue
        env = np.ones(len(g)); r = 200; env[:r] = np.linspace(0, 1, r); env[-r:] = np.linspace(1, 0, r)
        add(g * env[:, None] * 0.35, t)
# the film starts when ▶ is pressed
add(film, PLAY)
out = np.tanh(out * 1.05) * 0.97
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(out, -1, 1) * 32767).astype('<i2').tobytes())
print('ok', N / SR)
