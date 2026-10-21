"""128 BPM score + sound design for SHAPE OF SOUND (30s, 64 beats). Every cue mirrors an event in film.js.
usage: python3 score.py out/score.wav"""
import numpy as np, wave, sys
SR = 48000; B = 60 / 128; DUR = 64 * B; N = int(SR * DUR) + 1
rng = np.random.default_rng(7)
mix = np.zeros((N, 2)); duckbus = np.zeros((N, 2)); send = np.zeros((N, 2))
mf = lambda m: 440.0 * 2 ** ((m - 69) / 12)
TT = lambda d: np.arange(int(d * SR)) / SR
bt = lambda b: b * B                                   # beat -> seconds

def add(sig, b, g=1.0, pan=0.0, bus=None, rev=0.0):
    i = int(bt(b) * SR); j = min(N, i + len(sig))
    if i < 0 or i >= N or j <= i: return
    s = sig[: j - i] * g; st = np.stack([s * np.sqrt(0.5 * (1 - pan)) * 1.41, s * np.sqrt(0.5 * (1 + pan)) * 1.41], 1)
    (bus if bus is not None else mix)[i:j] += st
    if rev: send[i:j] += st * rev
def lp(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / np.sqrt(1 + (f / fc) ** 4); return np.fft.irfft(X, len(x))
def hp(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / np.sqrt(1 + (fc / np.maximum(f, 1)) ** 4); return np.fft.irfft(X, len(x))
def bp(x, lo, hi): return hp(lp(x, hi), lo)
noise = lambda d: rng.standard_normal(int(d * SR))
def env(t, a, d): return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t * d)

# ---------- instruments ----------
def kick(g=1.0):
    t = TT(0.5); f = 46 + 160 * np.exp(-t * 32)
    return (np.tanh(2.0 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t * 6) + lp(noise(0.5), 3000) * np.exp(-t * 120) * 0.25) * 0.95 * g
def clap():
    t = TT(0.35); n = noise(0.35)
    e = sum((t >= d) * np.exp(-np.maximum(0, t - d) * 90) for d in (0, 0.009, 0.019, 0.03)) * 0.4 + np.exp(-t * 15) * 0.6
    return bp(n * e, 900, 7500) * 0.5
def hat(op=False):
    d = 0.24 if op else 0.045; t = TT(d); return hp(noise(d), 7000) * np.exp(-t * (14 if op else 95)) * (0.16 if op else 0.12)
def shaker():
    t = TT(0.07); return bp(noise(0.07), 4000, 11000) * env(t, 0.012, 60) * 0.09
def marimba(m, d=0.7, g=1.0):
    t = TT(d); f = mf(m)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 7) + 0.3 * np.sin(2 * np.pi * 3.93 * f * t) * np.exp(-t * 32) + 0.1 * np.sin(2 * np.pi * 9.2 * f * t) * np.exp(-t * 70)) * np.minimum(1, t / 0.002) * 0.16 * g
def bass(m, d=0.2, drive=1.0):
    t = TT(d); f = mf(m); ph = 2 * np.pi * f * t
    s = np.sin(ph + 1.4 * np.exp(-t * 18) * np.sin(2 * ph)) + 0.25 * np.sin(2 * ph)
    s = np.tanh(s * drive) / np.tanh(drive) if drive > 1 else s
    return s * np.minimum(1, t / 0.003) * np.minimum(1, (d - t) / 0.015).clip(0) * 0.36
def pad(ch, d, fc=1600):
    t = TT(d); s = sum(2 * ((mf(m) * 2 ** (dt / 1200) * t + rng.random()) % 1) - 1 for m in ch for dt in (-9, 0, 9))
    return lp(s, fc) / (len(ch) * 3) * np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.5).clip(0) * 0.32
def stab(ch, d=0.32, fc=2600, g=1.0):
    t = TT(d); s = sum(2 * ((mf(m) * 2 ** (dt / 1200) * t) % 1) - 1 for m in ch for dt in (-12, 12))
    return lp(s, fc) / (len(ch) * 2) * env(t, 0.003, 9) * 0.5 * g
def tok(f=1150, g=1.0):
    t = TT(0.18); return (np.sin(2 * np.pi * f * t) * np.exp(-t * 38) + 0.4 * np.sin(2 * np.pi * f * 2.7 * t) * np.exp(-t * 70)) * 0.32 * g
def tom(f0, g=1.0):
    t = TT(0.4); f = f0 * (1 + 0.6 * np.exp(-t * 30)); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.5 * g
def click(g=1.0):
    t = TT(0.012); return hp(noise(0.012), 2500) * np.exp(-t * 500) * 0.25 * g
def whoosh(d=0.5, up=True, g=1.0, lo=300, hi=6000):
    n = int(d * SR); x = noise(d); tt = np.linspace(0, 1, n); out = np.zeros(n); seg = 1024
    for k in range(0, n, seg):           # sweeping band-pass, chunk by chunk
        p = tt[k] if up else 1 - tt[k]; fc = lo * (hi / lo) ** p
        out[k:k + seg] = bp(x[k:k + seg], fc * 0.6, fc * 1.6)
    shape = (tt ** 2 if up else (1 - tt) ** 2) * np.sin(np.pi * np.minimum(tt * 1.05, 1)) ** 0.3
    return out / (np.abs(out).max() + 1e-9) * shape * 0.22 * g
def boom(g=1.0):
    t = TT(1.6); f = 38 + 60 * np.exp(-t * 6)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2) * 0.8 + lp(noise(1.6), 1800) * np.exp(-t * 9) * 0.35) * g
def shimmer(d=1.0, g=1.0):
    t = TT(d); s = sum(np.sin(2 * np.pi * mf(m) * t + rng.random() * 6) * np.exp(-t * (2 + i)) for i, m in enumerate([86, 89, 93, 96, 100]))
    return s * np.minimum(1, t / 0.01) * 0.04 * g

# ---------- harmony: Dm9 | Bbmaj9 | Gm9 | A7sus4, one chord per bar ----------
CH = [[50, 53, 57, 60, 64], [46, 50, 53, 57, 60], [43, 50, 53, 58, 62], [45, 50, 52, 55, 57]]
ROOT = [38, 34, 31, 33]
chord = lambda b: CH[int(b // 4) % 4]; root = lambda b: ROOT[int(b // 4) % 4]
ARP = [0, 2, 4, 3, 1, 3, 4, 2]

# pads all the way through (darker in the intro and the break)
for bar in range(16):
    b = bar * 4
    if 61.25 <= b: continue
    fc = 900 if bar < 2 else 1300 if 12 <= bar < 14 else 2000
    d = min(4 * B + 0.4, bt(61.25) - bt(b) + 0.3)
    add(pad(chord(b), d, fc), b, 0.9 if bar < 2 else 0.75, bus=duckbus, rev=0.25)
# marimba arpeggio: 8ths in the intro, 16ths later; off during the drop's first beat
for k in range(int(61.25 * 4)):
    b = k / 4
    if b < 8 and k % 2: continue
    if 8 <= b < 16 and k % 2: continue
    if 32 <= b < 33: continue
    ch = chord(b); m = ch[ARP[k % 8] % len(ch)] + 12 + (12 if (k // 8) % 4 == 3 else 0)
    add(marimba(m, g=0.7 if b < 8 else 1.0 if 48 <= b < 56 else 0.55), b, pan=0.35 * np.sin(k * 0.9), bus=duckbus, rev=0.3)

# ---------- groove ----------
def groove(b0, b1, kick_on=True, clap_on=True, hats=True, bass_on=True, drive=1.0):
    b = b0
    while b < b1 - 1e-9:
        if kick_on and abs(b - round(b)) < 1e-9: add(kick(), b)
        if clap_on and abs(b % 2 - 1) < 1e-9: add(clap(), b, 0.9, rev=0.2)
        if hats:
            add(hat(), b, 0.8 if abs(b % 0.5) < 1e-9 else 0.45, pan=0.25)
            if abs(b % 1 - 0.5) < 1e-9: add(hat(True), b, 0.7, pan=-0.2)
            add(shaker(), b + 0.125, 0.8, pan=-0.4)
        if bass_on and abs(b % 1 - 0.5) < 1e-9: add(bass(root(b), 0.2, drive), b, 1.0, bus=duckbus)
        b += 0.25
# intro: dot bounces + rising letters
for b, f in [(1, 1250), (2, 1150), (3, 1050), (4, 1400)]: add(tok(f), b, 1.0 if b < 4 else 1.2, rev=0.35)
add(whoosh(0.55 * B * 2, True, 0.6), 3.4); add(whoosh(0.5, True, 0.5), 5.0 * 1 + 0.6)
for i in range(5): add(click(0.6), 4 + i * 0.1); add(click(0.6), 5.75 + i * 0.1)
add(marimba(74, 1.2, 1.0), 5.0, rev=0.5)
add(whoosh(bt(8) - bt(6.6), True, 1.0, 200, 9000), 6.6); add(shimmer(1.2, 0.8), 6.8, rev=0.6)
# iris -> red: impact, then the four word hits
add(boom(0.9), 8);
for b in (8, 8.5, 9, 10): add(kick(), b); add(stab(CH[0], 0.3), b, 1.0, rev=0.3)
add(clap(), 11, 1.0, rev=0.3); add(stab(CH[0], 0.6, 1800), 11, 0.7)
# the four shapes = the four drums
groove(12, 16, clap_on=False, hats=False, bass_on=False)
for b in (13, 15): add(clap(), b, 1.0, rev=0.25)
for k in range(4): add(hat(), 14 + k * 0.5, 0.9, pan=0.25)
for b in (15, 15.5): add(bass(38, 0.3), b, 1.1)
add(whoosh(bt(16) - bt(15), True, 0.9, 400, 9000), 15)
# ink scene: full groove; reel words whip; slice thunks; ring shimmer
groove(16, 31.35)
for b in (16, 16.5, 17, 17.5, 18): add(whoosh(0.16, False, 0.7, 800, 7000), b - 0.05)
for b in (20, 21, 22): add(stab(chord(b), 0.35, 2200, 0.9), b, rev=0.3); add(tom(90, 0.6), b)
add(whoosh(bt(24) - bt(23), True, 0.8), 23); add(shimmer(1.6, 1.0), 23, rev=0.6)
# split screen: every seam jump gets a swish + stab
for b in (24, 25, 26, 27, 28, 29, 30, 30.5, 31): add(whoosh(0.18, False, 0.8, 600, 6000), b - 0.04); add(stab(chord(b), 0.22, 3000, 0.7), b, pan=0.3 if int(b) % 2 else -0.3)
k = 0; b = 30.0
while b < 31.35: add(clap(), b, 0.35 + 0.5 * (b - 30) / 1.35, rev=0.2); b += 0.25 if b < 30.75 else 0.125
add(whoosh(bt(32) - bt(28), True, 1.1, 200, 10000), 28)
# DROP
add(boom(1.1), 32); groove(32, 48, drive=1.0)
for i in range(16):                      # checker wave sparkle
    add(marimba(86 + (i * 5) % 12, 0.3, 0.5), 32 + i * 0.05, pan=np.sin(i), rev=0.4)
def odo(v, land):                        # one click per digit that rolls past
    last = None
    for s in np.arange(land - 1.1, land, 1 / 400):
        p = min(1, max(0, (s - (land - 1.1)) / 1.1)); pos = v + 14 * (1 - p) ** 3   # same roll curve as film.js
        n = int(np.floor(pos))
        if last is not None and n != last: add(click(0.55), s, pan=-0.3 + 0.3 * (v % 3))
        last = n
    add(stab([74, 77, 81], 0.3, 4000, 0.8), land, rev=0.3)
for v, land in [(1, 33), (2, 33.5), (8, 34)]: odo(v, land)
add(whoosh(0.3, False, 0.7), 34.15); add(whoosh(bt(36) - bt(35.4), True, 0.6), 35.4)
for i in range(6): add(tom(110 * 2 ** (i * 2 / 12), 1.0), 36 + i * 0.5)
add(tom(220, 0.8), 39.45); add(whoosh(bt(40) - bt(39.6), True, 0.9, 400, 9000), 39.6)
# LOUDER: lens hops, then a driven bass under the stack
add(boom(0.6), 40)
for b in (41, 42, 43): add(bass(root(b) + 12, 0.35, 4.0), b, 1.0); add(stab(chord(b), 0.25, 3500), b, 0.8)
add(whoosh(bt(44) - bt(43.55), True, 0.8), 43.55)
for k in range(7): add(click(0.4), 44.5 + k * 0.5, pan=0.4 * np.sin(k))
add(whoosh(bt(48) - bt(47.4), False, 1.0, 300, 8000), 47.4)
# break: no kick; letters pop, tracking snaps
for i in range(5): add(marimba(74 + [0, 3, 7, 10, 14][i], 0.5, 1.2), 48 + i * 0.06, rev=0.4)
for b in (49, 50, 51, 51.5): add(tok(1600, 0.9), b); add(click(1.0), b)
add(whoosh(bt(52) - bt(51.7), True, 0.6), 51.7)
for b in (49, 51): add(clap(), b, 0.6, rev=0.4)
# poster pieces snap in
add(boom(0.6), 52); add(kick(), 52); add(click(1.0), 52.5); add(tom(70, 0.8), 52.5)
add(tom(140, 0.9), 53); add(shimmer(0.8, 0.8), 53.5, rev=0.5); add(stab(CH[1], 0.3), 54); add(kick(), 54); add(tok(900), 54.5)
add(kick(), 55); add(clap(), 55, 1.0, rev=0.3)
for b in (53, 53.5, 54.5, 55.5): add(hat(), b, 0.7)
add(whoosh(bt(56) - bt(55.3), True, 1.1, 200, 10000), 55.3)
# finale
add(boom(1.0), 56); groove(56, 61.25)
for i in range(5): add(click(0.5), 56.2 + i * 0.07)
for i in range(5): add(click(0.5), 57.0 + 0.25 + i * 0.07)
add(tok(1400, 1.1), 58, rev=0.35)
cap = 'STUDY Nº02 — 128 BPM — 16 BARS — MADE WITH CODE'
for i, ch in enumerate(cap):
    if ch != ' ': add(click(0.35), 58 + 1.5 * (i + 1) / len(cap) - 0.005, pan=-0.5 + i / len(cap))
add(stab(CH[0], 1.2, 1500, 0.8), 61.25, rev=0.7); add(whoosh(bt(62.25) - bt(61.25), False, 0.9, 200, 6000), 61.25)
add(tok(1250, 0.8), 62.3, rev=0.4); add(tok(1400, 1.0), 63.7, rev=0.5); add(marimba(74, 1.4, 1.0), 63.7, rev=0.6); add(marimba(62, 1.4, 0.8), 63.7, rev=0.6)

# ---------- sidechain, reverb, master ----------
kenv = np.zeros(N)
for b in [x * 1.0 for x in range(64)]:
    on = (12 <= b < 31.35) or (32 <= b < 48) or (56 <= b < 61.25) or b in (8, 9, 10, 52, 54, 55)
    if on: i = int(bt(b) * SR); n = min(N - i, int(0.3 * SR)); kenv[i:i + n] = np.maximum(kenv[i:i + n], np.exp(-np.arange(n) / SR * 9))
mix += duckbus * (1 - 0.6 * kenv)[:, None]
ir_n = int(1.9 * SR); irt = np.arange(ir_n) / SR
for c in range(2):
    ir = rng.standard_normal(ir_n) * np.exp(-irt * 3.2); ir = lp(ir, 5000); ir /= np.sqrt((ir ** 2).sum())
    n = 1 << int(np.ceil(np.log2(N + ir_n)))
    wet = np.fft.irfft(np.fft.rfft(send[:, c], n) * np.fft.rfft(ir, n), n)[:N]
    mix[:, c] += wet * 0.5
mix[:, 0] = hp(mix[:, 0], 28); mix[:, 1] = hp(mix[:, 1], 28)
t = np.arange(N) / SR; mix *= np.clip((DUR - t) / 0.08, 0, 1)[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2) * 0.8
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix, -1, 1) * 32767).astype('<i2').tobytes())
print('ok', DUR, np.abs(mix).max())
