"""Synthesize a 30s impressionist score, timed to the video's scene cuts."""
import numpy as np, wave, sys
SR = 48000; DUR = 30.0; N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)
f = lambda m: 440.0 * 2 ** ((m - 69) / 12)

def add(sig, t0, pan=0.0, gain=1.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[: j - i] * gain
    L[i:j] += s * np.sqrt(0.5 * (1 - pan)); R[i:j] += s * np.sqrt(0.5 * (1 + pan))

def piano(m, dur=3.5, vel=0.5):
    t = np.arange(int(dur * SR)) / SR; fr = f(m)
    s = np.zeros_like(t)
    for k, a in enumerate([1, 0.45, 0.22, 0.12, 0.06], 1):
        s += a * np.sin(2 * np.pi * fr * k * (1 + 0.0004 * k * k) * t) * np.exp(-t * (1.2 + k * 0.9))
    env = np.minimum(1, t / 0.004) * np.exp(-t * 0.7)
    return s * env * vel * 0.18

def pad(ms, dur, att=1.5, rel=1.8, vol=0.06):
    t = np.arange(int(dur * SR)) / SR; s = np.zeros_like(t)
    for m in ms:
        for d in (-0.08, 0.08):
            fr = f(m) * 2 ** (d / 12)
            s += np.sin(2 * np.pi * fr * t + rng.random() * 6) + 0.25 * np.sin(4 * np.pi * fr * t)
    env = np.minimum(1, t / att) * np.minimum(1, (dur - t) / rel).clip(0)
    trem = 1 + 0.08 * np.sin(2 * np.pi * 0.25 * t)
    return s * env * trem * vol / len(ms)

def whoosh(dur=1.3, vol=0.12, lo=300, hi=2600):
    n = int(dur * SR); x = rng.standard_normal(n); t = np.arange(n) / n
    X = np.fft.rfft(x); fr = np.fft.rfftfreq(n, 1 / SR)
    c = lo + (hi - lo) * 0.5
    X *= np.exp(-((np.log(fr + 1) - np.log(c)) ** 2) / 0.9)
    y = np.fft.irfft(X, n); y /= np.abs(y).max() + 1e-9
    return y * np.sin(np.pi * t) ** 2 * vol

def bell(m, vol=0.12):
    t = np.arange(int(4 * SR)) / SR; fr = f(m)
    s = np.sin(2 * np.pi * fr * t) + 0.5 * np.sin(2 * np.pi * fr * 2.76 * t) * np.exp(-t * 2) + 0.3 * np.sin(2 * np.pi * fr * 5.4 * t) * np.exp(-t * 4)
    return s * np.exp(-t * 1.1) * np.minimum(1, t / 0.002) * vol

# chord plan (MIDI) synced to scenes
sections = [  # start, end, pad notes, arpeggio pool
    (0.0, 4.2,  [41, 48, 52, 57],        [65, 69, 72, 76, 79]),         # Fmaj9
    (4.2, 8.0,  [38, 45, 53, 55],        [62, 65, 69, 72, 74]),         # Dm11
    (8.0, 11.0, [34, 41, 45, 52],        [62, 64, 69, 70, 74]),         # Bbmaj7#11
    (11.0, 13.6,[36, 43, 50, 52],        [62, 64, 67, 69, 72]),         # C6/9
    (13.6, 18.8,[33, 40, 47, 48, 55],    [64, 67, 71, 72, 76]),         # Am9
    (18.8, 24.2,[37, 44, 48, 53, 55],    [63, 65, 67, 72, 75, 79]),     # Dbmaj7#11 (dreamy shift)
    (24.2, 30.0,[29, 36, 52, 55, 57, 62],[64, 67, 69, 72, 74, 76, 81]), # Fmaj9(13) resolve
]
for i, (a, b, pn, ar) in enumerate(sections):
    if i == 0:
        add(pad(pn, b - 1.2 + 1.5, att=1.2), 1.2)
    else:
        add(pad(pn, min(30, b + 1.0) - a, att=0.9 if i < 6 else 1.2, rel=1.6 if i < 6 else 3.0, vol=0.06 if i < 6 else 0.075), a - 0.2)
    add(piano(pn[0] + 12, 5, 0.55), a, -0.2)  # bass note
    # arpeggio: rising ripples, stepped at ~0.27s, start sparse
    step = 0.27 if i else 0.42
    t = a + (0.35 if i == 0 else 0.1); k = 0
    while t < b - 0.1 and t < 29.0:
        m = ar[(k * 2 + (k // len(ar))) % len(ar)]
        add(piano(m, 3.5, 0.32 + 0.12 * rng.random()), t + rng.random() * 0.02, pan=np.sin(k * 1.3) * 0.6)
        t += step * (1.0 if i < 6 else 1.35); k += 1

# sound design
add(bell(88, 0.07), 0.32, 0.3)       # the sun appears
add(bell(81, 0.05), 0.45, -0.3)
for tc in (2.15, 8.0, 13.6, 18.8, 24.2):
    add(whoosh(1.6, 0.10 if tc != 24.2 else 0.13), tc - 0.3, pan=0.0)
    add(whoosh(1.2, 0.05, 900, 5000), tc + 0.1, pan=0.4)
for k in range(4):                    # odometer ticks
    for tc in (8.4, 13.9, 19.1):
        add(bell(96 - k, 0.012), tc + k * 0.08, 0.6)
# title swell + chime
t = np.arange(int(4 * SR)) / SR
add(np.sin(2 * np.pi * f(29) * t) * np.exp(-t * 0.6) * np.minimum(1, t / 0.4) * 0.12, 25.2)
for k, m in enumerate([77, 81, 84, 88]):
    add(bell(m, 0.05), 25.3 + k * 0.11, pan=-0.5 + k * 0.33)

# reverb (stereo decorrelated exponential noise IR)
def reverb(x, seed, sec=3.2):
    n = int(sec * SR); tt = np.arange(n) / SR
    ir = np.random.default_rng(seed).standard_normal(n) * np.exp(-tt * 2.1)
    ir[: int(0.012 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum())
    m = 1 << int(np.ceil(np.log2(len(x) + n)))
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)]
wetL, wetR = reverb(L, 1), reverb(R, 2)
L2 = 0.62 * L + 0.55 * wetL; R2 = 0.62 * R + 0.55 * wetR
tt = np.arange(N) / SR
fade = np.minimum(1, tt / 0.3) * np.clip((DUR - tt) / 1.4, 0, 1)
out = np.stack([L2, R2], 1) * fade[:, None]
out = np.tanh(out / np.abs(out).max() * 1.15) * 0.89
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype('<i2').tobytes())
print('wrote', sys.argv[1])
