"""120 BPM score for the product promo (30s): bright future-house, Am – F – C – G, one chord per bar.
Every camera move gets a whoosh, every callout a pop, every on-screen click a mouse click. Cue times match promo.js.
usage: python3 score.py out.wav"""
import numpy as np, wave, sys
SR = 48000; DUR = 30.0; N = int(SR * DUR); BT = 0.4; BAR = 1.6
rng = np.random.default_rng(5)
L = np.zeros(N); R = np.zeros(N)
MUS = np.zeros((2, N))   # sidechained music bus
VERB = np.zeros(N)       # reverb send
mf = lambda m: 440.0 * 2 ** ((m - 69) / 12)
TT = lambda d: np.arange(int(d * SR)) / SR

def put(buf, sig, t0):
    i = int(round(t0 * SR)); j = min(len(buf), i + len(sig))
    if 0 <= i < len(buf) and j > i: buf[i:j] += sig[: j - i]
def add(sig, t0, pan=0.0, g=1.0, send=0.0, mus=False):
    sig = sig * g
    if send: put(VERB, sig * send, t0)
    gl, gr = np.sqrt(0.5 * (1 - pan)) * 1.41, np.sqrt(0.5 * (1 + pan)) * 1.41
    if mus: put(MUS[0], sig * gl, t0); put(MUS[1], sig * gr, t0); return
    put(L, sig * gl, t0); put(R, sig * gr, t0)

def spec(x, fn):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); return np.fft.irfft(X * fn(f), len(x))
lp = lambda x, fc: spec(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** 4))
hp = lambda x, fc: spec(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1)) ** 4))
def sweep_lp(x, f0, f1, seg=1024):
    out = np.zeros_like(x); n = len(x)
    for s in range(0, n, seg):
        fc = f0 * (f1 / f0) ** (s / n); blk = x[s:s + seg]; out[s:s + seg] = lp(np.pad(blk, (256, 256)), fc)[256:256 + len(blk)]
    return out
def saw(f, t, ph=0.0): return 2 * ((f * t + ph) % 1) - 1
noise = lambda n: rng.standard_normal(n)

# ---------- drums ----------
def kick(g=1.0):
    t = TT(0.38); f = 46 + 170 * np.exp(-t * 32)
    body = np.tanh(2.8 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t * 7.5)
    click = hp(noise(len(t)), 3000) * np.exp(-t * 300) * 0.4
    return (body + click) * 0.85 * g
def clap(g=1.0):
    t = TT(0.3); n = noise(len(t))
    env = sum((t >= d) * np.exp(-np.maximum(0, t - d) * 80) for d in (0, 0.009, 0.019, 0.028)) * 0.4 + np.exp(-t * 14) * 0.6
    return hp(lp(n * env, 7500), 900) * 0.5 * g
def snare(g=1.0):
    t = TT(0.2); return (hp(noise(len(t)), 1800) * 0.6 * np.exp(-t * 22) + np.sin(2 * np.pi * 200 * t) * np.exp(-t * 30) * 0.5) * 0.4 * g
def hat(op=False, g=1.0):
    t = TT(0.22 if op else 0.045); return hp(noise(len(t)), 7500) * np.exp(-t * (15 if op else 95)) * 0.17 * g
def crash(d=2.0, g=1.0):
    t = TT(d); return hp(noise(len(t)), 4000) * np.exp(-t * 2.4) * 0.26 * g
def boom(g=1.0):
    t = TT(1.6); f = 30 + 90 * np.exp(-t * 9)
    return np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t * 2.4) * 0.95 * g
def wood():
    t = TT(0.06); return np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 90) * 0.3

# ---------- synths ----------
def bass(m, d, g=1.0):
    t = TT(d); f = mf(m); s = np.tanh(3 * (np.sin(2 * np.pi * f * t) + 0.5 * saw(f, t) * 0.4))
    return lp(s, 900) * np.minimum(1, t / 0.003) * np.clip((d - t) / 0.015, 0, 1) * 0.42 * g
def supersaw(ms, d, fc=3200, g=1.0, att=0.005, rel=0.06):
    t = TT(d); s = np.zeros_like(t)
    for m in ms:
        for det in (-0.14, -0.05, 0.04, 0.13): s += saw(mf(m) * 2 ** (det / 12), t, rng.random())
    s = lp(s, fc) / (len(ms) * 4)
    return s * np.minimum(1, t / att) * np.clip((d - t) / rel, 0, 1) * 0.42 * g
def lead(m, d, g=1.0):
    t = TT(d); f = mf(m) * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * t))
    s = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + saw(f * 1.003, t) * 0.5
    return lp(s, 4200) * np.minimum(1, t / 0.004) * np.clip((d - t) / 0.03, 0, 1) * 0.11 * g
def pluck(m, g=1.0):
    t = TT(0.45); f = mf(m); s = saw(f, t) * 0.7 + saw(2 * f, t) * 0.3
    return lp(s * np.exp(-t * 10), 3800) * 0.16 * g
def blip(f0, g=1.0):
    t = TT(0.12); f = f0 * (1 + 1.4 * np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30) * 0.3 * g
VOW = {'ah': (750, 1150, 2500), 'uh': (640, 1190, 2400), 'ur': (500, 1350, 1700), 'ih': (400, 1900, 2550), 'ey': (450, 2000, 2600),
       'or': (500, 850, 2400), 'oo': (330, 800, 2300), 'oh': (450, 800, 2500), 'ai': (720, 1250, 2500), 'ae': (700, 1700, 2450), 'ow': (680, 1050, 2400)}
def chop(vowel, m, d=0.24, g=1.0, cons=True):
    """formant 'vocal chop': pulse source through three formant bumps, short consonant burst on the front"""
    t = TT(d); f = mf(m) * (1 + 0.006 * np.sin(2 * np.pi * 6 * t)) * (1 - 0.04 * (t / d) ** 2)
    ph = np.cumsum(f) / SR; src = sum(saw(1, ph * k) / k ** 0.3 for k in (1,)) + 0.3 * saw(2, ph)
    F = VOW[vowel]
    v = spec(src, lambda fr: sum(a * np.exp(-((fr - fc) / bw) ** 2) for fc, a, bw in zip(F, (1.0, 0.7, 0.35), (110, 160, 220))))
    v = v / (np.abs(v).max() + 1e-9)
    env = np.minimum(1, t / 0.008) * np.clip((d - t) / 0.05, 0, 1)
    out = v * env * 0.33
    if cons: out[: int(0.02 * SR)] += hp(noise(int(0.02 * SR)), 3500) * np.exp(-np.arange(int(0.02 * SR)) / SR * 150) * 0.2
    return out * g
def whoosh(d, f0, f1, g=1.0, shape=2.0, rev=False):
    n = int(d * SR); x = sweep_lp(noise(n), f0, f1); tt = np.linspace(0, 1, n)
    env = tt ** shape if not rev else (1 - tt) ** shape
    return x / (np.abs(x).max() + 1e-9) * env * 0.32 * g


BT = 0.5; BAR = 2.0
CH = [(45, [57, 60, 64]), (41, [57, 60, 65]), (48, [55, 60, 64]), (43, [55, 59, 62])]
chord = lambda b: CH[b % 4]
kicks = []
def click(g=1.0):
    t = TT(0.04); return (hp(noise(len(t)), 3000) * np.exp(-t * 260) * 0.5 + np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 300) * 0.3) * g
def popfx(f0=900, g=1.0):
    t = TT(0.12); f = f0 * (1 + 1.5 * np.exp(-t * 45)); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 32) * 0.28 * g
def swish(g=1.0, d=0.35):
    return whoosh(d, 600, 9000, 0.7 * g, 1.6)
def drums(t0, t1, clap_on=True, hats16=False, g=1.0):
    k = 0
    while t0 + k * BT < t1 - 1e-6:
        tb = t0 + k * BT; add(kick(g), tb); kicks.append(tb)
        if clap_on and k % 2 == 1: add(clap(0.9), tb, send=0.2)
        add(hat(True, 0.7), tb + BT / 2, pan=0.2)
        if hats16:
            for s in (1, 3): add(hat(False, 0.6), tb + s * BT / 4, pan=-0.2)
        k += 1
def bassline(t0, t1, g=1.0):
    k = 0
    while t0 + k * BT / 2 < t1 - 1e-6:
        tb = t0 + k * BT / 2; root = chord(int(tb / BAR + 1e-6))[0]
        if k % 2: add(bass(root + 12 * (k % 4 == 3), BT / 2 - 0.02, g), tb, mus=True)
        k += 1
def stabs(t0, t1, fc=3500, g=1.0, every=1):
    k = 0
    while t0 + k * BT / 2 < t1 - 1e-6:
        tb = t0 + k * BT / 2
        if k % 2 == 1 or every == 2: root, ns = chord(int(tb / BAR + 1e-6)); add(supersaw(ns + [ns[0] + 12], BT / 2 - 0.04, fc, g), tb, mus=True, send=0.2)
        k += 1
def pads(t0, t1, fc, g=1.0):
    b = int(t0 / BAR + 1e-6)
    while b * BAR < t1 - 1e-6:
        root, ns = chord(b); s0 = max(t0, b * BAR); d = min(t1, (b + 1) * BAR) - s0
        add(supersaw(ns, d, fc, g, att=0.05, rel=0.1), s0, mus=True, send=0.3); b += 1
def arps(t0, t1, g=1.0):
    k = 0
    while t0 + k * BT / 4 < t1 - 1e-6:
        tb = t0 + k * BT / 4; ns = chord(int(tb / BAR + 1e-6))[1]; seq = ns + [n + 12 for n in ns]
        add(pluck(seq[[0, 2, 4, 1, 3, 5, 4, 2][k % 8]] + 12, 0.7 * g), tb, pan=0.4 * np.sin(k), send=0.25); k += 1
LEAD = [[76, 0, 76, 79, 81, 0, 79, 76], [77, 0, 76, 72, 74, 0, 72, 69], [76, 0, 79, 81, 84, 0, 83, 79], [79, 0, 77, 76, 74, 0, 74, 71]]
def lead_line(t0, t1, g=1.0):
    k = 0
    while t0 + k * BT / 2 < t1 - 1e-6:
        tb = t0 + k * BT / 2; b = int(tb / BAR + 1e-6); m = LEAD[b % 4][k % 8]
        if m: add(lead(m, BT / 2 - 0.03, g), tb, pan=0.1, send=0.3)
        k += 1

# 0–2 hook
arps(0, 2.0, 1.3); pads(0, 2.0, 1400, 0.8)
add(popfx(700), 0.0); add(swish(0.8, 0.4), 0.25)
for k in range(4): add(chop('ah', 69 + [0, 3, 5, 7][k], 0.12, 0.5), 1.0 + k * 0.125)       # "却有水印？" stutter
add(swish(1.0, 0.3), 1.45); add(whoosh(0.5, 300, 10000, 1.0, 2.5), 1.5)
# 2–4 title
add(boom(1.2), 2.0); add(crash(2.0, 0.9), 2.0, send=0.3)
drums(2.0, 4.0, clap_on=False); bassline(2.0, 4.0); pads(2.0, 4.0, 2400, 0.8)
add(popfx(1200), 2.5); add(swish(0.9), 3.6)
# 4–10 home footage
drums(4.0, 10.0); bassline(4.0, 10.0); stabs(4.0, 10.0, 3200, 0.8); arps(4.0, 10.0, 0.5)
for tt in (5.0, 7.0, 8.5): add(swish(0.8), tt - 0.05)
for tt in (5.25, 7.25, 9.0): add(popfx(1000), tt)
for i in range(10): add(popfx(1300 + 60 * i, 0.4), 7.5 + i * 0.06, pan=np.sin(i))
add(click(1.2), 9.5); add(whoosh(0.3, 500, 11000, 1.0, 2.5), 9.7)
# 10–12 一个入口 多个平台
add(boom(1.1), 10.0); add(crash(1.8, 0.9), 10.0, send=0.3); add(boom(0.6), 10.5)
drums(10.0, 12.0, hats16=True, g=1.05); bassline(10.0, 12.0, 1.05); pads(10.0, 12.0, 4500, 1.0); add(popfx(900), 11.0)
add(whoosh(0.3, 500, 11000, 0.9, 2.5), 11.7)
# 12–18 results footage
drums(12.0, 18.0, hats16=True); bassline(12.0, 18.0); stabs(12.0, 18.0, 3800, 0.9); lead_line(12.0, 18.0, 0.8)
for tt in (12.0, 13.0, 14.0, 15.5, 16.0, 17.0): add(swish(0.8), tt - 0.05)
for tt in (13.05, 14.4, 16.2, 16.45, 17.15): add(popfx(1100), tt)
add(click(1.2), 16.95); add(whoosh(0.3, 500, 11000, 0.9, 2.5), 17.7)
# 18–20 无水印
add(boom(1.3), 18.0); add(crash(1.8, 1.0), 18.0, send=0.3)
drums(18.0, 20.0, hats16=True, g=1.05); bassline(18.0, 20.0); pads(18.0, 20.0, 4500, 0.9)
for tt in (18.5, 19.0, 19.5): add(popfx(1000 + 200 * (tt - 18.5) * 2), tt)
# 20–24 guide + FAQ, then a build
drums(20.0, 23.5); bassline(20.0, 23.5); stabs(20.0, 23.5, 3000, 0.7); arps(20.0, 23.5, 0.5)
add(swish(0.9), 19.95)
for i in range(4): add(click(0.8), 20.5 + i * 0.25); add(popfx(1200 + 150 * i, 0.6), 20.5 + i * 0.25)
add(popfx(1000), 21.55); add(swish(0.8), 22.45)
for i, tt in enumerate((23.0, 23.25, 23.5)): add(popfx(1100 + 200 * i), tt)
for i, tt in enumerate([23.5, 23.625, 23.75, 23.8125, 23.875]): add(snare(0.6 + 0.1 * i), tt)
add(whoosh(0.5, 300, 12000, 1.2, 2.5), 23.4)
# 24–28 benefits: one hit per beat
add(boom(1.3), 24.0)
drums(24.0, 28.0, hats16=True, g=1.1); bassline(24.0, 28.0, 1.1); stabs(24.0, 28.0, 5200, 1.1, every=2); lead_line(24.0, 28.0, 0.9)
for k in range(8): add(crash(0.5, 0.35), 24.0 + k * BT); add(chop(['ah', 'ih', 'oh', 'ey'][k % 4], [76, 79, 81, 84, 76, 79, 83, 84][k], 0.18, 0.45), 24.0 + k * BT, send=0.3)
add(whoosh(0.4, 400, 11000, 1.0, 2.5), 27.6)
# 28–30 end card
add(boom(1.4), 28.0); add(crash(2.4, 1.1), 28.0, send=0.5)
add(supersaw([45, 57, 60, 64, 69, 72], 1.6, 5000, 1.4, att=0.005, rel=1.2), 28.0, send=0.6)
add(popfx(1300), 28.6); arps(28.0, 29.5, 0.5)
# ---------- mix ----------
tn = np.arange(N) / SR; env = np.ones(N)
for kt in kicks:
    i = int(kt * SR); j = min(N, i + int(0.4 * SR)); env[i:j] = np.minimum(env[i:j], 1 - 0.7 * np.exp(-(tn[i:j] - kt) * 9))
L += MUS[0] * env; R += MUS[1] * env; VERB += (MUS[0] + MUS[1]) * env * 0.08
ir_t = TT(1.6)
def ir(): x = noise(len(ir_t)) * np.exp(-ir_t * 3.5); return lp(x, 6000) / np.sqrt(np.sum(x ** 2))
nfft = 1 << int(np.ceil(np.log2(N + len(ir_t)))); V = np.fft.rfft(VERB, nfft)
L += np.fft.irfft(V * np.fft.rfft(ir(), nfft), nfft)[:N] * 0.5
R += np.fft.irfft(V * np.fft.rfft(ir(), nfft), nfft)[:N] * 0.5

g = np.ones(N); g[int(23.92 * SR):int(24.0 * SR)] = 0.05                  # a breath before the benefits
L *= g; R *= g
fade = np.clip((DUR - tn) / 0.5, 0, 1)
out = np.stack([L, R], 1) * fade[:, None]
out = np.tanh(out / np.percentile(np.abs(out), 99.9) * 1.1) * 0.95
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype('<i2').tobytes())
print('wrote', sys.argv[1])
