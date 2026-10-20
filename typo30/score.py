"""120 BPM electro-pop score + sound design for TYPE IN MOTION (30s). Cues match motion.js."""
import numpy as np, wave, sys
SR = 48000; DUR = 30.0; N = int(SR * DUR); B = 0.5
rng = np.random.default_rng(11)
L = np.zeros(N); R = np.zeros(N); PAD = np.zeros(N)  # PAD bus gets sidechained
mf = lambda m: 440.0 * 2 ** ((m - 69) / 12)
TT = lambda d: np.arange(int(d * SR)) / SR

def add(sig, t0, pan=0.0, g=1.0, bus=None):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if i >= N or j <= i: return
    s = sig[: j - i] * g
    if bus is not None: bus[i:j] += s; return
    L[i:j] += s * np.sqrt(0.5 * (1 - pan)) * 1.41; R[i:j] += s * np.sqrt(0.5 * (1 + pan)) * 1.41

def onepole(x, a):
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc += a * (x[i] - acc); y[i] = acc
    return y
def lp(x, fc):  # fast FFT lowpass
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / np.sqrt(1 + (f / fc) ** 4); return np.fft.irfft(X, len(x))
def saw(f, t, ph=0.0): return 2 * ((f * t + ph) % 1) - 1

# ---- instruments ----
def kick(g=1.0):
    t = TT(0.42); f = 48 + 140 * np.exp(-t * 28)
    return np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t * 6.5) * 0.9 * g
def clap():
    t = TT(0.32); n = np.diff(np.concatenate([[0], rng.standard_normal(len(t))]))
    env = sum((t >= d) * np.exp(-np.maximum(0, t - d) * 70) for d in (0, 0.011, 0.023)) * 0.45 + np.exp(-t * 13) * 0.55
    return lp(n * env, 7000) * 0.42
def hat(op=False):
    t = TT(0.22 if op else 0.05); n = np.diff(np.concatenate([[0], rng.standard_normal(len(t))]))
    return n * np.exp(-t * (16 if op else 85)) * 0.11
def bass(m, d):
    t = TT(d); f = mf(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.tanh(3 * np.sin(2 * np.pi * f * t))
    return s * np.minimum(1, t / 0.004) * np.minimum(1, (d - t) / 0.02).clip(0) * 0.32
def supersaw(ms, d, fc=2600, vol=0.05):
    t = TT(d); s = np.zeros_like(t)
    for m in ms:
        for k, det in enumerate((-0.11, -0.04, 0.03, 0.1)):
            s += saw(mf(m) * 2 ** (det / 12), t, rng.random())
    s = lp(s, fc) / (len(ms) * 4)
    env = np.minimum(1, t / 0.03) * np.minimum(1, (d - t) / 0.08).clip(0)
    return s * env * vol * 6
def pluck(m, vol=0.12):
    t = TT(0.4); f = mf(m)
    s = saw(f, t) * 0.6 + np.sign(np.sin(2 * np.pi * f * 2 * t)) * 0.2
    return lp(s * np.exp(-t * 11), 3500) * vol
def pop(f0=900, g=1.0):
    t = TT(0.11); f = f0 * (1 + 1.6 * np.exp(-t * 45))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 38) * 0.26 * g
def whoosh(d=0.45, lo=600, hi=5000, g=1.0, rise=True):
    n = int(d * SR); x = rng.standard_normal(n); out = np.zeros(n); seg = 2048
    for s0 in range(0, n, seg):
        p = s0 / n; fc = lo + (hi - lo) * (p if rise else 1 - p)
        out[s0:s0 + seg] = lp(x[s0:s0 + seg], fc)[: len(out[s0:s0 + seg])]
    tt = np.linspace(0, 1, n); env = (np.sin(np.pi * tt) ** 2) if not rise else tt ** 2.2 * (1 - tt ** 12)
    return out / (np.abs(out).max() + 1e-9) * env * 0.22 * g
def impact(g=1.0):
    t = TT(1.4); f = 34 + 70 * np.exp(-t * 9)
    b = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.4)
    n = lp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 9) * 0.35
    return np.tanh(1.8 * (b + n)) * 0.75 * g
def tick(f=2400): t = TT(0.03); return np.sin(2 * np.pi * f * t) * np.exp(-t * 160) * 0.18
def riser(d=2.0):
    t = TT(d); f = 200 * 2 ** (t / d * 3)
    s = saw(1, np.cumsum(f) / SR) * 0.3 + lp(rng.standard_normal(len(t)), 4000) * 0.4
    return s * (t / d) ** 2 * 0.16

# ---- harmony: 4 chords x 2s, A minor-ish pop loop ----
PROG = [([53, 57, 60, 64], 41), ([55, 59, 62, 67], 43), ([52, 55, 59, 62], 40), ([57, 60, 64, 67], 45)]  # Fmaj7 G6 Em7 Am7
def chord_at(t): return PROG[int(t // 2) % 4]

# ---- arrangement ----
for k in range(int(DUR / B)):
    t = k * B
    if t >= 29.75: break
    yellow = 9.0 <= t < 11.0
    sweep = 16.0 <= t < 16.75
    # kick: four on the floor (half-time in the yellow break, drops for the MOTION sweep)
    if not sweep and not (yellow and k % 2): add(kick(), t)
    # clap on 2 & 4 after the intro
    if t >= 2.5 and k % 2 == 1 and not yellow and not sweep: add(clap(), t)
    # hats
    if t >= 4.5 and not sweep:
        for s in range(2 if not yellow else 1): add(hat(s == 1 and k % 2 == 1), t + s * 0.25, pan=0.25 if s else -0.25)
        if t >= 11: add(hat(), t + 0.125, 0.4, 0.6); add(hat(), t + 0.375, -0.4, 0.6)
    ch, root = chord_at(t)
    # bass 8ths
    if t >= 2.5 and not sweep:
        add(bass(root, 0.22), t); add(bass(root + 12, 0.18), t + 0.25, g=0.7)
    # plucks on the off-beats
    if t >= 6.5 and not yellow and not sweep:
        add(pluck(ch[(k * 2) % 4] + 12), t + 0.25, pan=0.5 * np.sin(k)); add(pluck(ch[(k * 2 + 1) % 4] + 12, 0.08), t + 0.375, pan=-0.4)
for c in range(15):  # sustained pads, one per chord
    t0 = c * 2.0
    if t0 >= 29.75: break
    ch, _ = chord_at(t0)
    fc = 900 if t0 < 2.5 else (5000 if t0 >= 26 else 2600)
    add(supersaw(ch, 2.0, fc=fc, vol=0.055 if t0 >= 2.5 else 0.04), t0, bus=PAD)

# FEEL THE BEAT: stab hits on 8ths
for i, t in enumerate((10.0, 10.25, 10.5, 10.75)):
    ch, root = chord_at(t); add(supersaw([m + 12 for m in ch], 0.2, fc=6000, vol=0.09), t, bus=PAD); add(kick(0.9), t); add(clap(), t, g=0.6)
for t in (9.0, 9.5): add(supersaw([m + 12 for m in chord_at(t)[0]], 0.3, fc=5000, vol=0.08), t, bus=PAD)

# ---- sound design (cue sheet) ----
for t in (2.2, 4.32, 13.25, 15.6, 20.7, 23.2, 27.55): add(whoosh(0.4, 500, 7000, 1.0), t)     # whip transitions
for t in (2.5, 4.55, 11.0, 11.5, 12.0, 12.5, 18.5, 19.0, 19.5, 27.85): add(whoosh(0.28, 900, 6000, 0.7, rise=False), t - 0.05, pan=0.3)
add(whoosh(0.8, 300, 4000, 1.4, rise=False), 16.0)                                            # MOTION sweep
for t in (7.5, 24.5): add(impact(), t); add(whoosh(0.3, 800, 8000, 1.0), t - 0.3)            # giant slams
add(impact(0.7), 13.55)                                                                       # star fills the frame
for t, f in [(0.05, 1300), (0.1, 900), (0.55, 700), (0.62, 760), (0.69, 820), (2.5, 1100), (6.55, 900), (6.67, 1000), (6.79, 1100),
             (9.0, 600), (9.5, 800), (13.8, 1000), (14.15, 1300), (14.55, 900), (16.8, 1500), (20.1, 1300), (20.2, 1600),
             (21.0, 900), (21.12, 1000), (21.24, 1100), (21.36, 1200), (23.6, 900), (23.7, 950), (23.8, 1000), (23.9, 1050), (24.0, 1100),
             (26.05, 1300), (26.1, 900), (26.5, 700), (26.56, 760), (26.62, 820), (26.68, 880), (28.3, 1400)]:
    add(pop(f), t, pan=0.3 if f % 200 else -0.3)
for i in range(4): add(pop(1200 + i * 200, 1.2), 10.0 + i * 0.25)
for i in range(4): add(pop(1500 - i * 120), 24.97 + i * 0.04)
# odometer ticks: one per number (counts 1 -> 30 with an ease-out)
tt = np.linspace(0, 1, 4000); v = 1 + 29 * (1 - (1 - tt) ** 3); last = 1
for p, val in zip(tt, v):
    if int(val) != last: last = int(val); add(tick(1800 + last * 25), 13.55 + 0.05 + p * 1.4)
add(riser(2.0), 7.0); add(riser(1.5), 24.5)

# ---- mix ----
env = np.ones(N)  # sidechain pump from the kick grid
for k in range(int(DUR / B)):
    t = k * B; i = int(t * SR); seg = TT(B)
    if 16.0 <= t < 16.75: continue
    env[i:i + len(seg)] = np.minimum(env[i:i + len(seg)], 1 - 0.65 * np.exp(-seg * 9))[: len(env[i:i + len(seg)])]
PADs = PAD * env
L += PADs * 0.9; R += PADs * 0.9
def reverb(x, seed, sec=1.8):
    n = int(sec * SR); t = np.arange(n) / SR
    ir = np.random.default_rng(seed).standard_normal(n) * np.exp(-t * 3.2); ir[:int(0.01 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum())
    m = 1 << int(np.ceil(np.log2(len(x) + n))); return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)]
L2 = L + 0.22 * reverb(L, 1); R2 = R + 0.22 * reverb(R, 2)
t = np.arange(N) / SR
out = np.stack([L2, R2], 1) * np.clip((29.95 - t) / 0.2, 0, 1)[:, None]
out = np.tanh(out / np.abs(out).max() * 1.6) * 0.92
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype('<i2').tobytes())
print('ok')
