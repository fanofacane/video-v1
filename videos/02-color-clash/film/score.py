"""150 BPM score + sound design for COLOR CLASH (30s). Cue times match clash.js.
24.0–25.2 chops: PINK / BLUE / GOLD / CLASH!
Energy map: groove 0–9.6 | break 9.6–11.2 | build 11.2–12.6 | silence | DROP 12.8–19.2 | tape stop 19.2,
silence 19.6–20.0 | ONE MORE TIME | DROP 2 20.8–27.2 | finale 27.2, last hit 28.8.
usage: python3 score.py out.wav"""
import numpy as np, wave, sys
SR = 48000; DUR = 30.0; N = int(SR * DUR); BT = 0.4; BAR = 1.6
rng = np.random.default_rng(7)
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

# ---------- harmony: Bb – F – Gm – Eb, one chord per bar ----------
CH = [(46, [62, 65, 70]), (41, [60, 65, 69]), (43, [62, 67, 70]), (39, [63, 67, 70])]
RIFF = [[74, 0, 77, 74, 82, 0, 77, 74], [72, 0, 77, 72, 81, 0, 77, 72], [74, 0, 79, 74, 82, 0, 79, 77], [75, 0, 79, 75, 82, 0, 79, 77]]
chord = lambda b: CH[b % 4]
kicks = []

def drums(t0, t1, hats16=False, clap_g=1.0, kick_g=1.0):
    k = 0
    while t0 + k * BT < t1 - 1e-6:
        tb = t0 + k * BT; add(kick(kick_g), tb); kicks.append(tb)
        if k % 2 == 1: add(clap(clap_g), tb, send=0.15)
        add(hat(True, 0.8), tb + BT / 2, pan=0.2)
        if hats16:
            for s in (1, 3): add(hat(False, 0.8), tb + s * BT / 4, pan=-0.25)
        k += 1
def groove_bass(t0, t1, rolling=False, g=1.0):
    k = 0
    while t0 + k * BT / 2 < t1 - 1e-6:
        tb = t0 + k * BT / 2; root = chord(int(tb / BAR + 1e-6))[0]
        if rolling: add(bass(root + (12 if k % 2 else 0), BT / 2 - 0.01, g), tb, mus=True)
        elif k % 2: add(bass(root, BT / 2 - 0.02, g), tb, mus=True)
        k += 1
def pads(t0, t1, fc, g=1.0, stabs=False):
    b = int(t0 / BAR + 1e-6)
    while b * BAR < t1 - 1e-6:
        root, ns = chord(b); s0 = max(t0, b * BAR); d = min(t1, (b + 1) * BAR) - s0
        if stabs:
            k = 0
            while s0 + k * BT / 2 < s0 + d - 1e-6:
                if k % 2: add(supersaw(ns + [ns[0] + 12], BT / 2 - 0.03, fc, g), s0 + k * BT / 2, mus=True, send=0.2)
                k += 1
        else: add(supersaw(ns, d, fc, g, att=0.02, rel=0.05), s0, mus=True, send=0.25)
        b += 1
def riff(t0, t1, g=1.0, octave=0):
    k = 0
    while t0 + k * BT / 2 < t1 - 1e-6:
        tb = t0 + k * BT / 2; b = int(tb / BAR + 1e-6); m = RIFF[b % 4][int(round((tb - b * BAR) / (BT / 2))) % 8]
        if m: add(lead(m + octave, BT / 2 - 0.02, g), tb, pan=0.15 * (-1) ** k, send=0.25)
        k += 1

# ===== 0–3.2 TURN IT UP (filtered groove opening up) =====
drums(0, 3.2); groove_bass(0, 3.2)
pads(0, 1.6, 900, 0.8); pads(1.6, 3.2, 2600, 0.9)
for w, v, m, t0 in (('TURN', 'ur', 70, 0.0), ('IT', 'ih', 74, 0.4), ('UP', 'uh', 77, 0.8)): add(chop(v, m, 0.3), t0, send=0.25, g=1.1)
add(boom(0.5), 0.8)
for k in range(4): add(blip(700 * 1.26 ** k), 1.6 + k * BT, pan=(-0.5, 0.5, -0.3, 0.3)[k], send=0.2)
add(whoosh(0.45, 400, 7000, 0.9, 2.5), 2.85)
# ===== 3.2–6.4 COLOR vs CLASH =====
drums(3.2, 6.4); groove_bass(3.2, 6.4); pads(3.2, 6.4, 3000, 0.7, stabs=True)
add(whoosh(0.35, 6000, 500, 0.8, 1.5, rev=True), 3.2, pan=-0.4); add(whoosh(0.35, 6000, 500, 0.8, 1.5, rev=True), 3.6, pan=0.4)
add(boom(0.6), 4.0); add(crash(1.2, 0.7), 4.0); add(chop('ih', 77, 0.2, cons=False), 4.0, send=0.3)
for j in range(8): add(blip(900 + 300 * (j % 4)), 4.8 + j * BT / 2, pan=0.6 * (-1) ** j, g=0.8)
add(whoosh(0.25, 300, 6000, 0.9, 2.0), 6.15)
# ===== 6.4–9.6 RED HOT =====
drums(6.4, 9.6, hats16=True); groove_bass(6.4, 9.6, rolling=True, g=0.9); pads(6.4, 9.6, 3600, 0.85, stabs=True)
riff(6.4, 9.6, 0.7)
add(boom(0.7), 7.2); add(crash(1.5, 0.8), 7.2); add(chop('ah', 74, 0.35), 7.2, send=0.3)
add(whoosh(0.45, 800, 8000, 0.8, 1.2), 8.0); add(whoosh(0.45, 300, 9000, 1.1, 3.0), 9.15)
# ===== 9.6–11.2 BREAK: no kick, no bass =====
add(supersaw([62, 65, 70], 1.6, 700, 0.6, att=0.3, rel=0.4), 9.6, send=0.5)
for k in range(4): add(wood(), 9.6 + k * BT, pan=0.3 * (-1) ** k)
for t0 in (10.0, 10.8): add(clap(0.8), t0, send=0.5)
for v, m, t0 in (('ey', 70, 9.6), ('or', 72, 10.0), ('ih', 74, 10.4)): add(chop(v, m, 0.22), t0, send=0.45, g=0.9)
for i in range(3): add(blip(1500 + 250 * i, 0.6), 10.8 + i * 0.133, send=0.3)
# ===== 11.2–12.6 BUILD (then a hard gap until 12.8) =====
roll = [11.2, 11.6, 12.0, 12.2, 12.4, 12.5]   # 1/4 -> 1/8 -> 1/16, matching the strobe
for i, t0 in enumerate(roll): add(snare(0.6 + 0.08 * i), t0, send=0.2)
for i in range(16): add(snare(0.35 + 0.03 * i), 11.8 + i * 0.05, send=0.1)   # 1/32 roll, ends at the gap
for k in range(4): add(kick(0.8), 11.2 + k * BT)
t = TT(1.4); climb = np.sin(2 * np.pi * np.cumsum(mf(58) * 2 ** (2 * t / 1.4)) / SR) * (t / 1.4) ** 1.5 * 0.18
add(climb, 11.2, send=0.2); add(whoosh(1.4, 200, 11000, 1.4, 2.5), 11.2, send=0.15)
add(chop('ow', 74, 0.3), 11.2, send=0.3)
# ===== 12.8–19.2 DROP =====
add(boom(1.3), 12.8); add(crash(2.4, 1.2), 12.8, send=0.3); add(chop('oo', 62, 0.45, 1.2), 12.8, send=0.3)
drums(12.8, 19.2, hats16=True, kick_g=1.1); groove_bass(12.8, 19.2, rolling=True, g=1.1)
pads(12.8, 19.2, 4800, 1.0); riff(12.8, 19.2, 1.0)
add(whoosh(0.3, 6000, 400, 0.9, 1.5, rev=True), 14.25)                                     # BOUNCE slides in
for k in range(4): add(blip(500 + 120 * k, 0.6), 14.4 + k * BT, pan=0.4 * (-1) ** k)
add(chop('ow', 70, 0.3), 14.4, send=0.25)
add(whoosh(0.3, 500, 8000, 0.9, 2.0), 15.7)
for t0 in (16.4, 17.2): add(clap(1.6), t0, send=0.35); add(clap(1.0), t0 + 0.012, pan=0.5); add(crash(0.8, 0.6), t0)  # CLAP!
add(whoosh(0.25, 800, 9000, 1.0, 2.5), 17.38)
add(chop('ey', 77, 0.3), 17.6, send=0.25)
for i in range(16): add(hp(noise(int(0.05 * SR)), 5000) * np.exp(-TT(0.05) * 60) * 0.15, 17.6 + i * 0.1, pan=0.5 * (-1) ** i)  # shaker
for i in range(4): add(snare(0.7 + 0.1 * i), 18.8 + i * 0.1)
# ===== 20.0–20.8 ONE MORE TIME =====
for v, m, t0 in (('uh', 70, 20.0), ('or', 74, 20.2), ('ai', 77, 20.4)):
    add(chop(v, m, 0.2, 1.2), t0, send=0.3); add(supersaw(CH[0][1] + [74], 0.17, 4000, 0.8), t0, send=0.2); add(snare(0.9), t0); add(kick(0.7), t0)
add(whoosh(0.4, 300, 12000, 1.2, 3.0), 20.4)
# ===== 20.8–27.2 DROP 2 (bigger) =====
add(boom(1.4), 20.8); add(crash(2.4, 1.3), 20.8, send=0.3); add(chop('ow', 70, 0.4, 1.2), 20.8, send=0.3)
drums(20.8, 27.2, hats16=True, kick_g=1.15, clap_g=1.1); groove_bass(20.8, 27.2, rolling=True, g=1.15)
pads(20.8, 27.2, 5600, 1.1); riff(20.8, 27.2, 1.0); riff(20.8, 27.2, 0.45, 12)
for b in range(4): add(crash(1.4, 0.5), 20.8 + b * BAR)
for i, m in enumerate((74, 77, 79, 82)): add(chop(('ih', 'ih', 'ih', 'ur')[i], m, 0.22), 22.4 + i * BT, send=0.3)   # FEEL IT IN COLOR
add(whoosh(0.3, 500, 7000, 0.7, 2.0), 23.6)
for i, (v, m) in enumerate((('ih', 77), ('oo', 74), ('oh', 82), ('ae', 79))): add(chop(v, m, 0.3, 1.1), 24.0 + i * BT, send=0.3); add(whoosh(0.12, 7000, 1500, 0.6, 1.0, rev=True), 24.0 + i * BT)
for v, m, t0 in (('ah', 74, 25.6), ('ae', 77, 26.0), ('uh', 82, 26.4)): add(chop(v, m, 0.3, 1.1), t0, send=0.3)
add(boom(0.6), 26.4); add(whoosh(0.35, 400, 9000, 1.0, 2.5), 26.85)
# ===== 27.2–30 FINALE =====
drums(27.2, 28.8, hats16=True); groove_bass(27.2, 28.8, rolling=True); pads(27.2, 28.8, 5000, 1.0); riff(27.2, 28.8, 0.9)
add(crash(1.5, 0.9), 27.2); add(blip(1200), 27.6, send=0.3); add(blip(1600), 28.0, send=0.3)
add(boom(1.4), 28.8); add(crash(3.0, 1.3), 28.8, send=0.4)
add(supersaw([46, 58, 62, 65, 70, 74], 1.2, 5000, 1.4, att=0.005, rel=1.0), 28.8, send=0.6)
add(chop('ah', 82, 0.5, 1.1), 28.8, send=0.5)
add(whoosh(0.45, 6000, 300, 0.7, 1.5, rev=True), 29.35)

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

# hard gaps: 12.6–12.8 (before the drop) and 19.6–20.0 (after the tape stop)
def gap(a, b, fade=0.004):
    g = np.ones(N); i, j = int(a * SR), int(b * SR); g[i:j] = 0
    r = int(fade * SR); g[i - r:i] = np.linspace(1, 0, r); g[j:j + r] = np.minimum(g[j:j + r], 1); return g
# tape stop 19.2–19.6: replay the drop (same beat position, 17.6s) slowing to a halt
src_l, src_r = L[int(17.6 * SR):int(18.2 * SR)].copy(), R[int(17.6 * SR):int(18.2 * SR)].copy()
tau = TT(0.4); pos = (tau - tau ** 2 / 0.8) * SR; gtape = (1 - tau / 0.4) ** 0.5
i0 = int(19.2 * SR)
for ch, src in ((L, src_l), (R, src_r)): ch[i0:i0 + len(tau)] = lp(np.interp(pos, np.arange(len(src)), src), 2500) * gtape * 1.1
g = gap(12.6, 12.8) * gap(19.6, 20.0)
L *= g; R *= g
# STOP hit lands on top of the tape stop
stop = boom(1.0)[: int(0.38 * SR)] * np.linspace(1, 0, int(0.38 * SR)); L[i0:i0 + len(stop)] += stop; R[i0:i0 + len(stop)] += stop
cl = clap(1.5); L[i0:i0 + len(cl)] += cl; R[i0:i0 + len(cl)] += cl

fade = np.clip((DUR - tn) / 0.25, 0, 1)
out = np.stack([L, R], 1) * fade[:, None]
out = np.tanh(out / np.percentile(np.abs(out), 99.9) * 1.1) * 0.95
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype('<i2').tobytes())
print('wrote', sys.argv[1])
