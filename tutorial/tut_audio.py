"""Tutorial soundtrack: a calm 120 BPM bed (ducked under film clips) + film audio inserts + UI sounds."""
import json, wave, sys, numpy as np
SR = 48000
cues = json.load(open('audio_cues.json')); DUR = cues['dur']; N = int(DUR * SR)
rng = np.random.default_rng(21)
def readwav(p):
    w = wave.open(p); a = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').reshape(-1, w.getnchannels()).astype(float) / 32768
    return a if a.shape[1] == 2 else np.repeat(a, 2, 1)
FILM = {'a': readwav(sys.argv[1]), 'b': readwav(sys.argv[2])}
bed = np.zeros((N, 2)); fx = np.zeros((N, 2)); film = np.zeros((N, 2))
TT = lambda d: np.arange(int(d * SR)) / SR
mf = lambda m: 440.0 * 2 ** ((m - 69) / 12)
def put(buf, sig, t, g=1.0, pan=0.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[: j - i] * g
    if s.ndim == 1: buf[i:j, 0] += s * np.sqrt(0.5 * (1 - pan)) * 1.41; buf[i:j, 1] += s * np.sqrt(0.5 * (1 + pan)) * 1.41
    else: buf[i:j] += s
def lp(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / np.sqrt(1 + (f / fc) ** 4); return np.fft.irfft(X, len(x))
# --- bed: soft kick on 1 & 3, rim on 2 & 4, light hats, warm pads, sparse plucks ---
PROG = [[53, 57, 60, 64], [55, 59, 62, 67], [52, 55, 59, 62], [57, 60, 64, 67]]
def kick(): t = TT(0.35); f = 45 + 90 * np.exp(-t * 30); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.55
def rim(): t = TT(0.08); return lp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 60) * 0.12
def hat(): t = TT(0.04); return np.diff(np.concatenate([[0], rng.standard_normal(len(t))])) * np.exp(-t * 90) * 0.05
def pad(ch, d):
    t = TT(d); s = sum(np.sin(2 * np.pi * mf(m) * 2 ** (dt / 1200) * t + rng.random() * 6) for m in ch for dt in (-7, 7))
    return lp(s, 1400) / 8 * np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.6).clip(0) * 0.22
def pluck(m): t = TT(0.6); return lp(np.sin(2 * np.pi * mf(m) * t) + 0.3 * np.sin(4 * np.pi * mf(m) * t), 2500) * np.exp(-t * 6) * 0.07
B = 0.5
for k in range(int(DUR / B)):
    t = k * B
    if t >= DUR - 1.0: break
    if k % 4 in (0, 2) and t >= 7.0: put(bed, kick(), t)
    if k % 4 in (1, 3) and t >= 10.0: put(bed, rim(), t, pan=0.2)
    if t >= 28: put(bed, hat(), t + 0.25, pan=-0.3)
    ch = PROG[int(t // 2) % 4]
    if k % 4 == 0: put(bed, pad(ch, 2.2), t)
    if t >= 28 and k % 2 == 1: put(bed, pluck(ch[(k // 2) % 4] + 12), t + 0.25, pan=0.4 * np.sin(k))
# --- film inserts ---
duck = np.ones(N)
for c in cues['aud']:
    src = FILM[c['set']] if 'set' in c else readwav(c['file']); i0 = int(c['from'] * SR); seg = src[i0:i0 + int(c['dur'] * SR)].copy()
    n = len(seg); e = np.ones(n); r = int(0.05 * SR); e[:r] = np.linspace(0, 1, r); e[-r:] = np.linspace(1, 0, r)
    seg *= e[:, None]
    pan = c.get('pan', 0); g = c.get('g', 1)
    seg[:, 0] *= g * min(1, 1 - pan) ; seg[:, 1] *= g * min(1, 1 + pan)
    put(film, seg, c['at'])
    a, b = int(c['at'] * SR), min(N, int((c['at'] + c['dur']) * SR)); duck[a:b] = 0.12
# smooth the ducking
k = int(0.15 * SR); duck = np.convolve(duck, np.ones(k) / k, mode='same')
# --- UI sounds ---
def tick(): t = TT(0.025); return lp(rng.standard_normal(len(t)), 5000) * np.exp(-t * 220) * 0.06
def whoosh(d=0.5):
    n = int(d * SR); x = lp(rng.standard_normal(n), 3000); tt = np.linspace(0, 1, n); return x / np.abs(x).max() * np.sin(np.pi * tt) ** 2 * 0.07
for a, b in cues.get('type', [(39.0, 42.4), (49.5, 53.8), (60.0, 64.2), (80.6, 85.6), (90.0, 92.4), (114.0, 117.4), (119.0, 122.2)]):
    t = a
    while t < b: put(fx, tick(), t, pan=rng.random() * 0.4 - 0.2); t += 1 / 14 * (0.7 + rng.random() * 0.6)
for t in cues.get('whoosh', [10, 28, 36, 46, 58, 68, 88, 98, 106, 112, 124, 140, 150, 166, 171]): put(fx, whoosh(), t - 0.25)
# --- narration (optional argv[4] = vo_script.json, clips in vo/<id>.wav) ---
vo = np.zeros((N, 2)); vduck = np.ones(N)
if len(sys.argv) > 4:
    for c in json.load(open(sys.argv[4])):
        w = wave.open('vo/%s.wav' % c['id']); x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(float) / 32768
        if w.getframerate() != SR: raise SystemExit('vo must be 48k')
        x = x / (np.sqrt((x ** 2).mean()) + 1e-9) * 0.11          # even out loudness between clips
        put(vo, np.repeat(x[:, None], 2, 1), c['at'])
        a, b = int((c['at'] - 0.15) * SR), min(N, int((c['at'] + len(x) / SR + 0.25) * SR)); vduck[max(0, a):b] = 0.32
    k2 = int(0.3 * SR); vduck = np.convolve(vduck, np.ones(k2) / k2, mode='same')
mix = bed * (duck * vduck)[:, None] + film + fx * (0.6 + 0.4 * vduck)[:, None] + vo
tt = np.arange(N) / SR
mix *= (np.minimum(1, tt / 0.3) * np.clip((DUR - tt) / 1.5, 0, 1))[:, None]
mix = np.tanh(mix * 1.1) * 0.95
with wave.open(sys.argv[3], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix, -1, 1) * 32767).astype('<i2').tobytes())
print('ok', DUR)
