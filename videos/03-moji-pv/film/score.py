"""150 BPM score for 文字PV (30s, J-rock / Vocaloid feel). Cue times match pv.js; the sung vowels and
notes come straight from lyrics.js, so every character that pops on screen is voiced.
Energy: intro 0–3.2 | verse | pre 6.4 | glitch break 9.6 | build 11.2, silence 12.6–12.8 | DROP 12.8–19.2
| breakdown 19.2 (heart falls) | final drop 22.4 | thinning out 25.6 | last hit 28.8.
usage: python3 score.py out.wav"""
import json, re
import numpy as np, wave, sys
SR = 48000; DUR = 30.0; N = int(SR * DUR); BT = 0.4; BAR = 1.6
rng = np.random.default_rng(3)
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
VOW = {'a': (800, 1200, 2600), 'i': (300, 2300, 3000), 'u': (350, 1250, 2400), 'e': (480, 1900, 2600), 'o': (480, 820, 2500), 'n': (260, 1100, 2500),
       'ah': (750, 1150, 2500), 'uh': (640, 1190, 2400), 'ur': (500, 1350, 1700), 'ih': (400, 1900, 2550), 'ey': (450, 2000, 2600),
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


LYR = json.loads(re.search(r'window\.LYRICS\s*=\s*(\[.*\]);', open('lyrics.js', encoding='utf-8').read(), re.S).group(1))

def piano(m, d=0.9, g=1.0):
    t = TT(d); f = mf(m); s = np.zeros_like(t)
    for k, a in enumerate((1, 0.5, 0.32, 0.2, 0.12, 0.06), 1): s += a * np.sin(2 * np.pi * f * k * 1.0008 ** k * t) * np.exp(-t * (2.2 + k * 1.6))
    s[: int(0.004 * SR)] += hp(noise(int(0.004 * SR)), 2000) * 0.3
    return s * np.clip((d - t) / 0.05, 0, 1) * 0.16 * g
def stutter(g=1.0):  # crushed noise burst for the glitch sections
    t = TT(0.09); x = np.sign(noise(len(t))) * (np.floor(np.arange(len(t)) / 40) % 2) ; return hp(x, 1200) * np.exp(-t * 25) * 0.18 * g

# ---------- harmony: Bb – C – Am – Dm, one chord per bar ----------
CH = [(46, [58, 62, 65]), (48, [60, 64, 67]), (45, [57, 60, 64]), (50, [62, 65, 69])]
chord = lambda b: CH[b % 4]
kicks = []
def arps(t0, t1, g=1.0, oct=12):
    k = 0
    while t0 + k * BT / 4 < t1 - 1e-6:
        tb = t0 + k * BT / 4; ns = chord(int(tb / BAR + 1e-6))[1]; seq = ns + [n + 12 for n in ns]
        pat = [0, 2, 4, 5, 3, 4, 2, 1]; add(piano(seq[pat[k % 8]] + oct - 12, 0.5, g), tb, pan=0.3 * np.sin(k), send=0.25); k += 1
def rock(t0, t1, four=True, hats16=False, kick_g=1.0, snare_g=1.0):
    k = 0
    while t0 + k * BT < t1 - 1e-6:
        tb = t0 + k * BT
        if four or k % 2 == 0: add(kick(kick_g), tb); kicks.append(tb)
        if k % 2 == 1: add(snare(1.4 * snare_g), tb, send=0.25); add(clap(0.6 * snare_g), tb)
        add(hat(False, 0.9), tb + BT / 2, pan=0.2); add(hat(False, 0.6), tb, pan=0.2)
        if hats16:
            for s in (1, 3): add(hat(False, 0.6), tb + s * BT / 4, pan=-0.2)
        k += 1
def bassline(t0, t1, g=1.0, rolling=True):
    k = 0
    while t0 + k * BT / 2 < t1 - 1e-6:
        tb = t0 + k * BT / 2; root = chord(int(tb / BAR + 1e-6))[0]
        add(bass(root + (12 if rolling and k % 4 == 3 else 0), BT / 2 - 0.015, g), tb, mus=True); k += 1
def pads(t0, t1, fc, g=1.0):
    b = int(t0 / BAR + 1e-6)
    while b * BAR < t1 - 1e-6:
        root, ns = chord(b); s0 = max(t0, b * BAR); d = min(t1, (b + 1) * BAR) - s0
        add(supersaw(ns + [ns[0] + 12], d, fc, g, att=0.02, rel=0.06), s0, mus=True, send=0.3); b += 1
LEAD = [[77, 0, 74, 77, 79, 77, 74, 72], [76, 0, 72, 76, 79, 76, 72, 71], [76, 0, 72, 69, 72, 76, 77, 76], [74, 0, 77, 81, 79, 77, 74, 72]]
def lead_line(t0, t1, g=1.0):
    k = 0
    while t0 + k * BT / 2 < t1 - 1e-6:
        tb = t0 + k * BT / 2; b = int(tb / BAR + 1e-6); m = LEAD[b % 4][int(round((tb - b * BAR) / (BT / 2))) % 8]
        if m: add(lead(m, BT / 2 - 0.02, g), tb, pan=0.1, send=0.3)
        k += 1

# 0–3.2 intro
arps(0, 3.2, 0.9); pads(0, 3.2, 900, 0.5); add(kick(0.7), 0); add(kick(0.7), 1.6); add(crash(1.5, 0.4), 0)
add(whoosh(0.4, 400, 6000, 0.7), 2.85)
# 3.2–6.4 verse
rock(3.2, 6.4, four=False); bassline(3.2, 6.4, 0.9, rolling=False); arps(3.2, 6.4, 0.8)
for i in range(3): add(boom(0.25), 3.2 + i * BT)                     # black bars slamming in
add(whoosh(0.3, 300, 7000, 0.8), 6.1)
# 6.4–9.6 pre-chorus on the heart
rock(6.4, 9.6); bassline(6.4, 9.6); arps(6.4, 9.6, 0.7); pads(6.4, 9.6, 2600, 0.8)
add(crash(1.5, 0.6), 6.4); add(whoosh(0.35, 400, 9000, 0.9), 9.25)
# 9.6–11.2 glitch break: no kick, no bass
pads(9.6, 11.2, 700, 0.6); arps(9.6, 11.2, 0.5)
for k in range(8): add(stutter(1.0 if k % 3 else 1.6), 9.6 + k * BT / 2, pan=0.5 * (-1) ** k)
add(clap(0.8), 10.0, send=0.5); add(clap(0.8), 10.8, send=0.5)
# 11.2–12.6 I LOVE YOU build, slash on 12.0, gap to 12.8
for i, t0 in enumerate([11.2, 11.4, 11.6, 11.8, 12.0, 12.1, 12.2, 12.3, 12.4, 12.45, 12.5, 12.55]): add(snare(0.6 + 0.05 * i), t0, send=0.2)
add(whoosh(1.4, 200, 11000, 1.3, 2.5), 11.2, send=0.15); add(boom(0.8), 12.0); add(crash(0.8, 0.8), 12.0)
for k in range(4): add(kick(0.8), 11.2 + k * BT)
# 12.8–19.2 DROP
add(boom(1.3), 12.8); add(crash(2.4, 1.2), 12.8, send=0.3)
rock(12.8, 19.2, hats16=True, kick_g=1.1); bassline(12.8, 19.2, 1.1); pads(12.8, 19.2, 4500, 1.0); lead_line(12.8, 19.2, 0.9); arps(12.8, 19.2, 0.5, 24)
for t0 in (13.2, 13.6, 14.8, 15.0, 15.2):                            # slot-machine digits
    for j in range(8): add(blip(1800 + 200 * j, 0.25), t0 + j * 0.03)
add(boom(1.0), 16.0); add(crash(1.6, 1.0), 16.0); add(boom(1.0), 17.6); add(crash(1.2, 0.8), 17.6)
for k in range(7): add(whoosh(0.12, 6000, 1500, 0.6, 1.0, rev=True), 16.2 + k * BT, pan=0.5 * (-1) ** k)
add(whoosh(0.4, 6000, 300, 0.9, 1.4, rev=True)[::-1], 18.8, send=0.3)
# 19.2–22.4 breakdown: the heart falls apart
add(boom(0.9), 19.2); add(crash(2.0, 0.6), 19.2, send=0.6)
pads(19.2, 22.4, 1200, 0.8); arps(19.2, 22.4, 0.6, 24)
for b in range(2): add(kick(1.0), 19.2 + b * BAR); add(snare(1.3), 19.2 + b * BAR + 2 * BT, send=0.5); kicks.append(19.2 + b * BAR)
for j in range(40): add(blip(2400 - 30 * j, 0.22), 19.6 + j * 0.06 + 0.02 * np.sin(j), pan=np.sin(j * 1.7) * 0.7, send=0.4)
add(whoosh(0.8, 300, 9000, 1.1, 2.5), 21.6)
for i, t0 in enumerate([21.6, 21.8, 22.0, 22.1, 22.2, 22.3]): add(snare(0.6 + 0.08 * i), t0)
# 22.4–25.6 final drop; 好 → 嘘 glitch on 24.0
add(boom(1.3), 22.4); add(crash(2.4, 1.2), 22.4, send=0.3)
rock(22.4, 25.6, hats16=True, kick_g=1.15); bassline(22.4, 25.6, 1.15); pads(22.4, 25.6, 5200, 1.1); lead_line(22.4, 25.6, 1.0); arps(22.4, 25.6, 0.5, 24)
add(boom(0.9), 24.0); [add(stutter(1.4), 24.0 + k * 0.067) for k in range(6)]
# 25.6–28.8 thinning out: mosaic, then bare paper
rock(25.6, 27.2, four=False, kick_g=0.8, snare_g=0.7); arps(25.6, 28.8, 0.8); pads(25.6, 28.8, 1500, 0.6)
add(whoosh(0.5, 8000, 800, 0.4, 1.0, rev=True), 28.1)
for k in range(12): add(stutter(0.5), 28.1 + k * 0.04)
# 28.8 last hit and tail
add(boom(1.2), 28.8); add(crash(2.0, 0.8), 28.8, send=0.5)
for m in (50, 57, 62, 65, 69, 74): add(piano(m, 1.2, 1.4), 28.8, send=0.6)

# lyrics: one sung vowel per character
for line in LYR:
    ts = line['t']
    for i, (t0, v, m) in enumerate(zip(ts, line['v'], line['n'])):
        if not v or not m: continue
        gap = (ts[i + 1] - t0) if i + 1 < len(ts) else 0.45
        add(chop(v, m, max(0.12, min(0.42, gap * 0.92)), 1.0, cons=v != 'n'), t0, send=0.3)
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

g = np.ones(N); g[int(12.6 * SR):int(12.8 * SR)] = 0                    # silence before the drop
L *= g; R *= g
fade = np.clip((DUR - tn) / 0.6, 0, 1)
out = np.stack([L, R], 1) * fade[:, None]
out = np.tanh(out / np.percentile(np.abs(out), 99.9) * 1.1) * 0.95
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype('<i2').tobytes())
print('wrote', sys.argv[1])
