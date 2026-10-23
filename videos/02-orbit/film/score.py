"""96 BPM score + sound design for ORBIT (30s, D minor). Cue times match orbit.js.
usage: python3 score.py out.wav"""
import numpy as np, wave, sys
SR = 48000; DUR = 30.0; N = int(SR * DUR); B = 0.625; BAR = 2.5
rng = np.random.default_rng(2)
L = np.zeros(N); R = np.zeros(N)
PAD = np.zeros(N)   # sidechained bus (pads, chords, bass)
VERB = np.zeros(N)  # reverb send
mf = lambda m: 440.0 * 2 ** ((m - 69) / 12)
TT = lambda d: np.arange(int(d * SR)) / SR

def put(buf, sig, t0):
    i = int(round(t0 * SR)); j = min(N, i + len(sig))
    if 0 <= i < N and j > i: buf[i:j] += sig[: j - i]
def add(sig, t0, pan=0.0, g=1.0, bus=None, send=0.0):
    sig = sig * g
    if send: put(VERB, sig * send, t0)
    if bus is not None: put(bus, sig, t0); return
    put(L, sig * np.sqrt(0.5 * (1 - pan)) * 1.41, t0); put(R, sig * np.sqrt(0.5 * (1 + pan)) * 1.41, t0)

def lp(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / np.sqrt(1 + (f / fc) ** 4); return np.fft.irfft(X, len(x))
def hp(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / np.sqrt(1 + (fc / np.maximum(f, 1)) ** 4); return np.fft.irfft(X, len(x))
def saw(f, t, ph=0.0): return 2 * ((f * t + ph) % 1) - 1
def noise(n): return rng.standard_normal(n)
def sweep_lp(x, f0, f1, seg=1024):  # time-varying lowpass, block-wise
    out = np.zeros_like(x); n = len(x)
    for s in range(0, n, seg):
        fc = f0 * (f1 / f0) ** (s / n); blk = x[s:s + seg]; out[s:s + seg] = lp(np.pad(blk, (256, 256)), fc)[256:256 + len(blk)]
    return out

# ---------- instruments ----------
def kick(g=1.0, d=0.5):
    t = TT(d); f = 44 + 150 * np.exp(-t * 30)
    return np.tanh(2.4 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t * 6) * 0.9 * g
def softkick(): t = TT(0.45); f = 50 + 70 * np.exp(-t * 25); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 0.7
def clap():
    t = TT(0.35); n = noise(len(t))
    env = sum((t >= d) * np.exp(-np.maximum(0, t - d) * 75) for d in (0, 0.01, 0.022)) * 0.45 + np.exp(-t * 12) * 0.55
    return hp(lp(n * env, 6500), 700) * 0.4
def snare(g=1.0):
    t = TT(0.18); return (hp(noise(len(t)), 1500) * 0.5 + np.sin(2 * np.pi * 190 * t) * 0.5) * np.exp(-t * 28) * 0.35 * g
def hat(op=False):
    t = TT(0.25 if op else 0.05); return hp(noise(len(t)), 7000) * np.exp(-t * (14 if op else 90)) * 0.16
def ping(m, d=1.2, g=1.0):
    t = TT(d); f = mf(m)
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t * 6)) * np.exp(-t * 4) * np.minimum(1, t / 0.002) * 0.22 * g
def pluck(m, g=1.0):
    t = TT(0.5); f = mf(m); s = saw(f, t) * 0.7 + saw(f * 1.005, t, 0.3) * 0.3
    return lp(s * np.exp(-t * 9), 2600) * 0.13 * g
def bass(m, d):
    t = TT(d); f = mf(m); s = np.sin(2 * np.pi * f * t) + 0.4 * np.tanh(4 * np.sin(2 * np.pi * f * t))
    return s * np.minimum(1, t / 0.004) * np.clip((d - t) / 0.02, 0, 1) * 0.3
def pad(ms, d, fc=1800, vol=1.0, att=0.4, rel=0.8):
    t = TT(d); s = np.zeros_like(t)
    for m in ms:
        for det in (-0.12, -0.04, 0.05, 0.13): s += saw(mf(m) * 2 ** (det / 12), t, rng.random())
    s = lp(s, fc) / (len(ms) * 4)
    return s * np.minimum(1, t / att) * np.clip((d - t) / rel, 0, 1) * 0.32 * vol
def whoosh(d, f0, f1, g=1.0, shape=2.0):
    n = int(d * SR); x = sweep_lp(noise(n), f0, f1); tt = np.linspace(0, 1, n)
    return x / (np.abs(x).max() + 1e-9) * tt ** shape * 0.3 * g
def boom(g=1.0):
    t = TT(2.5); f = 32 + 60 * np.exp(-t * 6)
    return np.tanh(1.8 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t * 1.6) * 0.8 * g
def crash(d=2.5, g=1.0):
    t = TT(d); return hp(noise(len(t)), 3000) * np.exp(-t * 2.2) * 0.22 * g
def tick(): t = TT(0.03); return hp(noise(len(t)), 5000) * np.exp(-t * 200) * 0.25

# ---------- arrangement ----------
D2, F2, A2, C3, D3 = 38, 41, 45, 48, 50
kicks = []

# 0–5: drone, sonar pings on every ring, a tick per letter
t = TT(5.4); drone = (np.sin(2 * np.pi * mf(D2) * t) + 0.5 * np.sin(2 * np.pi * mf(A2) * t)) * np.minimum(1, t / 3) * np.clip((5.4 - t) / 0.6, 0, 1) * 0.12
add(drone, 0)
for k in range(1, 8): add(ping(86 if k % 4 == 1 else 81, 1.4, 0.9), k * B, pan=0.0, send=0.7)
for i in range(5): add(tick(), 2.5 + i * B / 2, pan=-0.4 + 0.2 * i, send=0.3)
add(whoosh(1.0, 300, 4000, 0.7), 4.0, send=0.3)

# 5–10: soft kick on 1 & 3, moons pluck in, arpeggio, hats from 6.25, Dm pad
for k in range(8): add(softkick(), 5 + k * 2 * B); kicks.append((5 + k * 2 * B, 0.4))
for i, m in enumerate((74, 77, 81)): add(ping(m, 1.0, 0.8), 5 + i * B, pan=(-0.5, 0.2, 0.6)[i], send=0.6)
arp = [62, 69, 72, 76, 74, 69, 65, 72]
for k in range(16): add(pluck(arp[k % 8]), 6.25 + k * B / 2, pan=0.35 * np.sin(k), send=0.35, g=0.8)
for k in range(12): add(hat(), 6.25 + B / 2 + k * B, pan=0.3)
add(pad([D3, 53, 57, 60], 5.1, 1200, 0.9, att=1.5, rel=0.3), 5, bus=PAD, send=0.4)
add(whoosh(1.25, 300, 7000, 1.0, 2.5), 8.75, send=0.3)

# 10–15: full beat, bass, constellation pings (one per line)
prog = [(10, [D2, 50, 53, 57, 60]), (12.5, [34, 50, 53, 58, 62])]   # Dm9 -> Bbmaj
for k in range(8): add(kick(), 10 + k * B); kicks.append((10 + k * B, 0.7))
for k in range(4): add(clap(), 10 + B + k * 2 * B, send=0.25)
for k in range(16): add(hat(k % 2 == 1), 10 + k * B / 2, pan=0.25)
for t0, ch in prog:
    add(pad(ch[1:], 2.6, 2200, 1.0, att=0.3), t0, bus=PAD, send=0.35)
    for k in range(4): add(bass(ch[0], B / 2 - 0.02), t0 + k * B + B / 2, bus=PAD)
pent = [74, 76, 81, 83, 86, 88, 93, 95]
for j in range(8): add(ping(pent[j], 0.9, 0.7), 10.625 + j * B, pan=-0.6 + 0.17 * j, send=0.5)

# 15–17.5: countdown, snare roll, riser, pitch climb, then a breath before the drop
for i in range(4): add(kick(0.9, 0.35), 15 + i * B); add(snare(1.2), 15 + i * B, send=0.3)
roll = [15 + i * B / 2 for i in range(4)] + [16.25 + i * B / 4 for i in range(4)]
for i, tt0 in enumerate(roll): add(snare(0.5 + 0.08 * i), tt0, pan=0.1, send=0.3)
t = TT(2.3); climb = np.sin(2 * np.pi * np.cumsum(mf(62) * 2 ** (t / 2.3 * 1.5)) / SR) * (t / 2.3) ** 2 * 0.12
add(climb, 15, send=0.3)
add(whoosh(2.3, 200, 9000, 1.2, 2.5), 15, send=0.2)

# 17.5–25: the drop. Hit on each word, sidechained chords + offbeat bass
words = [17.5, 18.75, 20, 21.25, 22.5, 23.75]
add(boom(1.2), 17.5); add(crash(3.0, 1.2), 17.5, send=0.4)
for tw in words[1:]: add(kick(0.9, 0.3), tw); add(crash(0.6, 0.6), tw, send=0.3)
drop = [(17.5, [D2, 62, 65, 69, 72]), (20, [34, 62, 65, 70, 74]), (22.5, [41, 60, 65, 69, 72])]
for k in range(10): add(kick(1.1), 17.5 + k * B); kicks.append((17.5 + k * B, 0.85))
for k in range(5): add(clap(), 17.5 + B + k * 2 * B, send=0.3)
for k in range(20): add(hat(k % 2 == 1), 17.5 + k * B / 2, pan=-0.25)
for t0, ch in drop:
    d = 2.5 if t0 < 22.5 else 1.25
    add(pad(ch[1:], d + 0.05, 3800, 1.5, att=0.02, rel=0.2), t0, bus=PAD, send=0.3)
    for k in range(int(d / B)): add(bass(ch[0] + 12 * (k % 2), B / 2 - 0.02), t0 + k * B + B / 2, bus=PAD, g=1.2)
for k in range(8): add(pluck([86, 81, 77, 81][k % 4], 0.8), 17.5 + k * B * 1.5, pan=0.5 * (-1) ** k, send=0.5)
# galaxy collapses: everything gets sucked inward
t = TT(1.25); suck = sweep_lp(noise(len(t)), 8000, 150) * (t / 1.25) ** 1.5 * 0.35
add(suck, 23.75, send=0.3)
add(pad([50, 57, 62, 65], 1.3, 900, 1.0, att=0.6, rel=0.1), 23.75, send=0.4)

# 25–30: return — impact, pings again, a Dsus2 that resolves and dies away
add(boom(0.8), 25); add(crash(2.0, 0.6), 25, send=0.5)
for k in range(1, 6): add(ping(86 if k == 1 else 81, 1.6, 0.85 - 0.12 * k), 25 + k * B, send=0.8)
add(pad([D3, 57, 62, 64, 69], 4.6, 1400, 1.0, att=0.8, rel=2.5), 25, send=0.6)
add(pad([D3, 57, 62, 66, 69], 2.5, 1100, 0.7, att=1.0, rel=1.6), 27.5, send=0.6)
for i, m in enumerate((74, 76, 81, 86)): add(pluck(m, 0.6), 25.625 + i * 0.3, pan=-0.3 + 0.2 * i, send=0.7)

# ---------- mix ----------
env = np.ones(N); tn = np.arange(N) / SR
for kt, depth in kicks:
    m = tn >= kt; env[m] = np.minimum(env[m], 1 - depth * np.exp(-(tn[m] - kt) * 7))
PAD *= env
L += PAD * 0.97; R += PAD * 1.03
# reverb: stereo exponential-noise IR, FFT convolution
ir_t = TT(2.6)
def ir(): x = noise(len(ir_t)) * np.exp(-ir_t * 2.4); return lp(x, 5000) / np.sqrt(np.sum(x ** 2))
nfft = 1 << int(np.ceil(np.log2(N + len(ir_t))))
V = np.fft.rfft(VERB, nfft)
L += np.fft.irfft(V * np.fft.rfft(ir(), nfft), nfft)[:N] * 0.55
R += np.fft.irfft(V * np.fft.rfft(ir(), nfft), nfft)[:N] * 0.55
fade = np.clip((DUR - tn) / 1.2, 0, 1) ** 1.5 * np.clip(tn / 0.05, 0, 1)
out = np.stack([L, R], 1) * fade[:, None]
out = np.tanh(out / (np.abs(out).max() + 1e-9) * 1.6) * 0.9
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype('<i2').tobytes())
print('wrote', sys.argv[1])
