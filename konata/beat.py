"""120 BPM guide beat + sound design for the Choco Cornet edit (16s)."""
import numpy as np, wave, sys
SR = 48000; DUR = 16.0; N = int(SR * DUR); B = 0.5
rng = np.random.default_rng(3)
L = np.zeros(N); R = np.zeros(N)
def add(sig, t0, pan=0.0, g=1.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if i >= N or j <= i: return
    s = sig[: j - i] * g; L[i:j] += s * (1 - max(0, pan)); R[i:j] += s * (1 + min(0, pan))
T = lambda d: np.arange(int(d * SR)) / SR
def kick():
    t = T(0.45); f = 50 + 120 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 0.9
def clap():
    t = T(0.3); n = rng.standard_normal(len(t))
    env = sum(np.exp(-np.maximum(0, t - d) * 60) * (t >= d) for d in (0, 0.01, 0.022)) * 0.5 + np.exp(-t * 14) * 0.5
    n = np.diff(np.concatenate([[0], n]))
    return n * env * 0.35
def hat(open_=False):
    t = T(0.25 if open_ else 0.06); n = np.diff(np.concatenate([[0], rng.standard_normal(len(t))]))
    return n * np.exp(-t * (14 if open_ else 70)) * 0.12
def bass(m, d):
    t = T(d); f = 440 * 2 ** ((m - 69) / 12)
    s = np.sign(np.sin(2 * np.pi * f * t)) * 0.3 + np.sin(2 * np.pi * f * t)
    return s * np.minimum(1, t / 0.005) * np.exp(-t * 3) * 0.22
def pop(f0=900):
    t = T(0.12); f = f0 * (1 + 1.5 * np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 35) * 0.25
def whoosh(d=0.45, up=True):
    n = int(d * SR); x = rng.standard_normal(n); X = np.fft.rfft(x); fr = np.fft.rfftfreq(n, 1 / SR)
    X *= np.exp(-((np.log(fr + 1) - np.log(2200)) ** 2) / 1.2); y = np.fft.irfft(X, n); y /= np.abs(y).max()
    tt = np.linspace(0, 1, n); env = tt ** 2 if up else (1 - tt) ** 2
    return y * env * 0.2
def chord(ms, d):
    t = T(d); s = sum(np.sin(2 * np.pi * 440 * 2 ** ((m - 69) / 12) * t) for m in ms)
    return s * np.exp(-t * 4) * np.minimum(1, t / 0.003) * 0.06
# drums: intro builds, drop at 2.5, breakdown on the outro hold
for k in range(int(DUR / B)):
    t = k * B
    if t >= 15.5: break
    if t < 2.0: add(kick(), t, g=0.8 if k % 2 == 0 else 0.0)
    elif t < 2.5: pass  # riser gap
    else: add(kick(), t)
    if t >= 2.5 and k % 2 == 1: add(clap(), t)
    if t >= 1.0:
        add(hat(), t + 0.25, 0.3); add(hat(), t, -0.3, 0.6)
    if 2.5 <= t < 13.25:
        roots = [45, 45, 41, 43]  # A F G pattern
        add(bass(roots[(k // 2) % 4], 0.24), t); add(bass(roots[(k // 2) % 4] + 12, 0.2), t + 0.25, g=0.6)
    if t >= 13.25: add(chord([57, 61, 64, 69], 0.5), t, g=1.0)
for k in range(8):  # snare-ish roll into the drop
    add(clap(), 2.0 + k * 0.0625, g=0.25 + k * 0.08)
add(whoosh(0.5), 2.0)
for t, f in [(0, 700), (0.5, 900), (1.0, 700), (1.5, 1200), (2.62, 1000), (2.69, 1100), (2.76, 1200), (2.97, 1300), (3.04, 1400), (3.11, 1500), (3.5, 1700),
             (4.05, 600), (4.15, 700), (4.25, 800), (6.12, 900), (7.5, 1500), (8.3, 1000), (8.36, 1060), (8.42, 1120), (8.48, 1180), (8.54, 1240), (8.6, 1300), (8.66, 1360), (8.72, 1420),
             (10.35, 900), (10.45, 1000), (10.55, 1100), (11.85, 1500), (11.9, 1200), (13.25, 600), (13.5, 800), (14.25, 1200)]:
    add(pop(f), t, pan=0.2 if f % 200 else -0.2)
for t in (5.98, 8.23, 9.23, 12.48, 15.45): add(whoosh(0.3), t - 0.27)
for t in (4.5, 5.0, 5.5): add(kick(), t, g=0.5)
for k in range(6): add(pop(1800 - k * 150), 12.5 + k * 0.125, g=1.2)
tt = np.arange(N) / SR
out = np.stack([L, R], 1) * np.clip((15.95 - tt) / 0.4, 0, 1)[:, None]
out = np.tanh(out / np.abs(out).max() * 1.4) * 0.9
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype('<i2').tobytes())
print('ok')
