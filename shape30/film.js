'use strict';
// SHAPE OF SOUND — 30s beat-synced kinetic poster film. 128 BPM, 16 bars of 4/4 = 64 beats = 30.0s.
// Swiss / Bauhaus look: paper, ink, vermilion (+ a touch of teal). Everything is a pure function of time.
const W = 1920, H = 1080, FPS = 30, B = 60 / 128, NB = 64;
const PAPER = '#F1EADB', INK = '#141414', RED = '#FF3B1F', TEAL = '#1E5E52';
const cv = document.getElementById('c'), g = cv.getContext('2d');

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const L = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const eOutX = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)), eInX = t => (t <= 0 ? 0 : Math.pow(2, 10 * (t - 1)));
const eOut3 = t => 1 - Math.pow(1 - t, 3), eIn3 = t => t * t * t, eIn2 = t => t * t;
const eIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const back = (t, s = 1.7) => { t -= 1; return t * t * ((s + 1) * t + s) + 1; };
const arc = p => 4 * p * (1 - p);
// scene cuts land in the gap between two frames' shutters, so no frame blends two scenes
const Q = beat => (Math.round(beat * B * FPS - 0.5) + 0.5) / FPS / B;
// value that steps through keys [[beat, value], ...] easing each step over `d` beats
function steps(b, v0, keys, d = 0.3, ease = eOutX) { let v = v0; for (const [t, x] of keys) v = L(v, x, ease(P(b, t, t + d))); return v; }

// ---------- type ----------
const F = { anton: s => `${s}px Anton`, serif: s => `italic 400 ${s}px ISerif`, sg: (s, w = 700) => `${w} ${s}px SG` };
let CAP = 0.7;                         // Anton cap height / font size (measured once fonts load)
const AS = cap => cap / CAP;           // font size for a given cap height
function setFont(font, ls = 0) { g.font = font; g.letterSpacing = ls + 'px'; }
function measure(str, font, ls = 0) { setFont(font, ls); return g.measureText(str).width; }
function text(str, x, y, font, color, align = 'center', ls = 0) {
  setFont(font, ls); g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillStyle = color; g.fillText(str, x, y); g.letterSpacing = '0px';
}
// per-letter layout: left offsets and widths (keeps kerning)
function layout(str, font, ls = 0) {
  setFont(font, ls); const xs = [], ws = [];
  for (let i = 0; i < str.length; i++) { xs.push(g.measureText(str.slice(0, i)).width); ws.push(g.measureText(str.slice(0, i + 1)).width - xs[i]); }
  const w = g.measureText(str).width - ls; g.letterSpacing = '0px'; return { xs, ws, w };
}
// draw one glyph anchored at its baseline centre
function glyph(ch, cx, by, font, color, sx = 1, sy = 1, rot = 0, alpha = 1, stroke = 0) {
  if (sx <= 0.001 || sy <= 0.001 || alpha <= 0.001) return;
  g.save(); g.translate(cx, by); g.rotate(rot); g.scale(sx, sy); g.globalAlpha = alpha;
  setFont(font); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  if (stroke) { g.lineJoin = 'round'; g.lineWidth = stroke; g.strokeStyle = PAPER; g.strokeText(ch, 0, 0); }
  g.fillStyle = color; g.fillText(ch, 0, 0); g.restore();
}
// a whole word, scaled around its baseline centre
function word(str, cx, by, font, color, sx = 1, sy = 1, o = {}) {
  if (sx <= 0.001 || sy <= 0.001) return;
  g.save(); g.translate(cx, by); g.scale(sx, sy); setFont(font, o.ls || 0); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  if (o.outline) { g.lineJoin = 'round'; g.lineWidth = o.outline / Math.max(sx, sy); g.strokeStyle = color; g.strokeText(str, 0, 0); }
  else { g.fillStyle = color; g.fillText(str, 0, 0); }
  g.letterSpacing = '0px'; g.restore();
}

// ---------- shapes ----------
const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const disc = (x, y, r, c) => { if (r <= 0) return; g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
function tri(x, y, s, rot, c) { // equilateral, centroid at (x,y), side s
  g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = c; g.beginPath();
  const R = s / Math.sqrt(3); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 3; g.lineTo(Math.cos(a) * R, Math.sin(a) * R); }
  g.closePath(); g.fill(); g.restore();
}
function semi(x, y, r, rot, c) { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = c; g.beginPath(); g.arc(0, 0, r, Math.PI, 2 * Math.PI); g.closePath(); g.fill(); g.restore(); }
function square(x, y, s, rot, c) { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = c; g.fillRect(-s / 2, -s / 2, s, s); g.restore(); }
const clipRect = (x, y, w, h) => { g.beginPath(); g.rect(x, y, w, h); g.clip(); };
const clipDisc = (x, y, r) => { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, Math.PI * 2); g.clip(); };
// a squash on landing: returns [sx, sy] decaying after beat `land`
function squash(b, land, amt = 0.35, k = 9) { if (b < land) return [1, 1]; const q = amt * Math.exp(-(b - land) * k) * Math.cos((b - land) * 10); return [1 + q * 0.8, 1 - q]; }

// ---------- the "SHAPE of SOUND." lockup (opening + ending) ----------
const LINE_Y = 650, LCAP = 232;
let LK = null;
function lockupLayout() {
  const fa = F.anton(AS(LCAP)), fs = F.serif(LCAP * 1.25);
  const a = layout('SHAPE', fa), o = measure('of', fs), c = layout('SOUND', fa);
  const gap = LCAP * 0.2, r = LCAP * 0.11, dg = LCAP * 0.1;
  const total = a.w + gap + o + gap + c.w + dg + 2 * r, x0 = W / 2 - total / 2;
  LK = { fa, fs, a, c, r, ax: x0, ox: x0 + a.w + gap + o / 2, cx: x0 + a.w + gap + o + gap, dx: x0 + total - r };
}
// letters rise from behind the baseline (clipped above the line)
function riseWord(lay, str, x0, b, start, color, stag = 0.1, dur = 0.7) {
  for (let i = 0; i < str.length; i++) {
    const p = eOutX(P(b, start + i * stag, start + i * stag + dur)); if (p <= 0) continue;
    glyph(str[i], x0 + lay.xs[i] + lay.ws[i] / 2, LINE_Y - 4 + (1 - p) * LCAP * 1.3, LK.fa, color);
  }
}
function lockup(b, t0, cols, stag, dur) {
  g.save(); clipRect(0, 0, W, LINE_Y - 4);
  riseWord(LK.a, 'SHAPE', LK.ax, b, t0, cols[0], stag, dur);
  const po = eOutX(P(b, t0 + 0.75 * (stag / 0.1), t0 + 0.75 * (stag / 0.1) + dur));
  if (po > 0) text('of', LK.ox, LINE_Y - 4 + (1 - po) * LCAP * 1.4, LK.fs, cols[1]);
  riseWord(LK.c, 'SOUND', LK.cx, b, t0 + 1.0 * (stag / 0.1) + 0.25, cols[0], stag, dur);
  g.restore();
}
function line(b, t0, d, col, from = 0.5) { const p = eOutX(P(b, t0, t0 + d)); if (p <= 0) return; const w = 1700 * p; rect(110 + (1700 - w) * from, LINE_Y - 3, w, 6, col); }

// ---------- scenes (b = global beat) ----------
function s1(b) {                        // 0–8: line, bouncing dot, lockup rises, dot becomes the full stop, iris
  rect(0, 0, W, H, PAPER);
  line(b, 0, 0.9, INK);
  lockup(b, 4, [INK, RED], 0.1, 0.7);
  const cp = eOutX(P(b, 6, 6.6));
  if (cp > 0) { g.globalAlpha = cp; text('A STUDY IN RHYTHM & FORM', W / 2, LINE_Y + 70 + (1 - cp) * 20, F.sg(30, 500), INK, 'center', 9); g.globalAlpha = 1; }
  const r = LK.r; let x = W / 2, y, sq = [1, 1];
  if (b < 1) y = L(-120, LINE_Y - 3 - r, eIn2(P(b, 0, 1)));
  else if (b < 3) { const h = b < 2 ? 230 : 110, p = (b % 1); y = LINE_Y - 3 - r - h * arc(p); }
  else if (b < 4) { const p = b - 3; x = L(W / 2, LK.dx, eIO(p)); y = LINE_Y - 3 - r - 330 * arc(p); }
  else { x = LK.dx; y = LINE_Y - 3 - r; }
  for (const land of [1, 2, 3, 4]) if (b >= land && b < land + 1) sq = squash(b, land, 0.42);
  const ir = r + 2500 * eIn3(P(b, 7.1, 8));
  if (ir > r + 0.5) { disc(x, y, ir, RED); return; }
  g.save(); g.translate(x, y + r); g.scale(sq[0], sq[1]); disc(0, -r, r, RED); g.restore();
}

const S2W = [['LOOK', 8], ['AT', 8.5], ['THE', 9], ['BEAT', 10]];
const SHAPES = [['KICK', 330, b => b >= 12 ? b % 1 : 9], ['SNARE', 750, b => b >= 13 ? (b - 13) % 2 : 9],
  ['HAT', 1170, b => b >= 14 ? (b * 2 % 1) / 2 : 9], ['BASS', 1590, b => b >= 15 ? (b - 15) % 0.5 : 9]];
function s2(b) {                        // 8–16: stretched count words, then four shapes = four drums, blinds out
  rect(0, 0, W, H, RED);
  if (b < 12) {
    let k = 0; for (let i = 0; i < S2W.length; i++) if (b >= S2W[i][1]) k = i;
    const [str, st] = S2W[k], lw = b - st;
    let sy = L(2.15, 1, back(P(lw, 0, 0.42), 2.2)), sx = L(0.55, 1, eOutX(P(lw, 0, 0.3)));
    if (str === 'BEAT' && lw > 1) { const q = 0.14 * Math.exp(-(lw - 1) * 7); sy *= 1 + q; sx *= 1 - q * 0.4; }
    word(str, W / 2, 840, F.anton(AS(600)), INK, sx, sy);
    text(String(k + 1).padStart(2, '0') + ' / 04', W / 2, 960, F.sg(30, 700), INK, 'center', 8);
  } else {
    SHAPES.forEach(([lab, x, since], k) => {
      const lw = b - (12 + k); if (lw < 0) return;
      const e = back(P(lw, 0, 0.38), 2.4), sp = since(b), pulse = 1 + 0.12 * Math.exp(-sp * 9), s = 290 * e * pulse, y = 500;
      const rot = (1 - eOutX(P(lw, 0, 0.5))) * (k === 1 ? -Math.PI / 2 : k === 2 ? Math.PI * 0.66 : Math.PI);
      if (k === 0) disc(x, y, s / 2, INK); else if (k === 1) square(x, y, s * 0.9, rot, INK);
      else if (k === 2) tri(x, y + s * 0.08, s * 1.05, rot, INK); else semi(x, y + s * 0.22, s / 2, rot, PAPER);
      const lp = eOutX(P(lw, 0.05, 0.45));
      g.globalAlpha = lp; text(lab, x, 780 + (1 - lp) * 24, F.sg(36, 700), INK, 'center', 10); g.globalAlpha = 1;
    });
  }
  for (let i = 0; i < 12; i++) {        // venetian blinds into the ink scene
    const p = eIO(P(b, 15 + i * 0.04, 15.55 + i * 0.04)); if (p <= 0) continue;
    if (i % 2) rect(i * 160, 0, 161, H * p, INK); else rect(i * 160, H * (1 - p), 161, H * p, INK);
  }
}

const S3W = [['EVERY', 16, PAPER], ['SHAPE', 16.5, RED], ['HAS', 17, PAPER], ['A', 17.5, RED], ['SOUND', 18, PAPER]];
const RING = 'SHAPE OF SOUND · 128 BPM · STUDY Nº02 · ';
function ring(b, t0, r, col) {
  const e = back(P(b, t0, t0 + 0.5), 1.6); if (e <= 0) return;
  g.save(); g.translate(W / 2, H / 2); g.scale(e, e); g.rotate((b - t0) * 0.35 + 0.6);
  setFont(F.sg(40, 700)); g.textAlign = 'center'; g.fillStyle = col;
  for (let i = 0; i < RING.length; i++) { g.save(); g.rotate(i / RING.length * Math.PI * 2); g.fillText(RING[i], 0, -r); g.restore(); }
  g.restore();
}
function s3(b) {                        // 16–24: slot-reel words, SOUND slices open, ring
  rect(0, 0, W, H, INK);
  const cap = 400, by = 740, fa = F.anton(AS(cap)), mid = by - cap / 2;
  if (b < 20) {
    let k = 0; for (let i = 0; i < S3W.length; i++) if (b >= S3W[i][1]) k = i;
    const lw = b - S3W[k][1], e = eOutX(P(lw, 0, 0.36)), dy = cap + 80;
    g.save(); clipRect(0, by - cap - 40, W, cap + 80);
    word(S3W[k][0], W / 2, by + (1 - e) * dy, fa, S3W[k][2]);
    if (k > 0 && e < 1) word(S3W[k - 1][0], W / 2, by - e * dy, fa, S3W[k - 1][2]);
    g.restore();
    return;
  }
  let off = 150 * eOutX(P(b, 20, 20.35)) + 150 * eOutX(P(b, 21, 21.35)) + 200 * eOutX(P(b, 22, 22.35));
  const fly = eInX(P(b, 23, 23.9)), ox = off + 1700 * fly, oy = off * 0.42 + 500 * fly;
  ring(b, 23, 360, RED);
  g.save(); clipRect(0, mid - oy, W, 2 * oy);
  const sp = clamp(off / 500);
  text('listen closely', W / 2, mid + 36, F.serif(140), RED); g.restore();
  g.save(); clipRect(0, 0, W, mid - oy); word('SOUND', W / 2 - ox, by - oy, fa, PAPER); g.restore();
  g.save(); clipRect(0, mid + oy, W, H); word('SOUND', W / 2 + ox, by + oy, fa, PAPER); g.restore();
  void sp;
}

const S4P = [[24, 'LEFT', 'RIGHT'], [26, 'PUSH', 'PULL'], [28, 'TICK', 'TOCK'], [29, 'ON', 'OFF'], [30, 'YES', 'NO'], [30.5, 'IN', 'OUT'], [31, 'UP', 'DOWN']];
const S4X = [[25, 1260], [26, 660], [27, 960], [28, 1320], [29, 600], [30, 960], [30.5, 1120], [31, 800]];
function s4(b) {                        // 24–32: split screen, the seam jumps on the beat
  rect(0, 0, W, H, INK); ring(b, 23, 360, RED);
  let X = steps(b, 960, S4X, 0.3); X = L(X, -80, eIn3(P(b, 31.35, 32)));
  const e = eOutX(P(b, 24, 24.5)), lx1 = -(1 - e) * X, rx0 = X + (1 - e) * (W - X);
  rect(lx1, 0, X, H, PAPER); rect(rx0, 0, W - X + 2, H, RED);
  let k = 0; for (let i = 0; i < S4P.length; i++) if (b >= S4P[i][0]) k = i;
  const [st, a, c] = S4P[k], lw = b - st, we = eOutX(P(lw, 0, 0.3)), cap = 280, fa = F.anton(AS(cap)), by = 540 + cap / 2;
  const lw0 = Math.max(1, X), rw0 = Math.max(1, W - X);
  const sa = Math.min(1, lw0 * 0.62 / measure(a, fa)), sc = Math.min(1, rw0 * 0.62 / measure(c, fa));
  g.save(); clipRect(lx1, 0, X, H); word(a, lx1 + X / 2 - (1 - we) * 700, by, fa, INK, sa, sa); g.restore();
  g.save(); clipRect(rx0, 0, W - X, H); word(c, rx0 + (W - X) / 2 + (1 - we) * 700, by, fa, PAPER, sc, sc); g.restore();
  const be = back(P(b, 24.4, 24.8), 2) * (1 - P(b, 31.3, 31.6));
  if (be > 0) {
    let spin = 0; for (const [t] of S4X) spin += eOutX(P(b, t, t + 0.35));
    g.save(); g.translate(X, 540); g.scale(be, be); disc(0, 0, 82, INK);
    g.strokeStyle = PAPER; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 70, 0, Math.PI * 2); g.stroke();
    g.rotate(spin * Math.PI * 2); text('&', 0, 40, F.serif(130), PAPER); g.restore();
  }
}

function s5(b) {                        // 32–40: checker wave, odometer 128 BPM, BOUNCE drops in
  rect(0, 0, W, H, b < 33.3 ? RED : INK);
  if (b < 33.3) for (let i = 0; i < 16; i++) for (let j = 0; j < 9; j++) {
    const d = (i + j) / 23 * 0.8, p = eOutX(P(b, 32 + d, 32 + d + 0.35)); if (p <= 0) continue;
    square(i * 120 + 60, j * 120 + 60, 121 * p, (1 - p) * Math.PI / 4, INK);
  }
  const up = 950 * eInX(P(b, 35.4, 36));
  if (b < 36) {                         // odometer
    const cap = 430, fa = F.anton(AS(cap)), dw = measure('0', fa) * 1.06, cell = cap * 1.35, by = 540 + cap / 2 - up;
    const digits = [[1, 33], [2, 33.5], [8, 34]], x0 = 900 - dw * 1.5;
    digits.forEach(([v, land], k) => {
      const vis = eOutX(P(b, 32.5 + k * 0.12, 32.9 + k * 0.12)); if (vis <= 0) return;
      const pos = v + 14 * (1 - eOut3(P(b, land - 1.1, land))), cx = x0 + dw * (k + 0.5);
      g.save(); clipRect(cx - dw / 2, by - cap - 30, dw, cap + 60); g.globalAlpha = vis;
      for (let n = Math.floor(pos) - 1; n <= Math.floor(pos) + 1; n++) word(String(((n % 10) + 10) % 10), cx, by + (n - pos) * cell, fa, PAPER);
      g.restore();
    });
    const bp = eOutX(P(b, 34.2, 34.6));
    if (bp > 0) { g.save(); clipRect(x0 + dw * 3 + 20, 0, 600, H); text('BPM', x0 + dw * 3 + 40 - (1 - bp) * 300, by, F.sg(110, 700), RED, 'left', 4); g.restore(); }
  }
  const cap = 380, fa = F.anton(AS(cap)), lay = layout('BOUNCE', fa, 6), x0 = W / 2 - lay.w / 2, by = 800;
  for (let i = 0; i < 6; i++) {
    const land = 36 + i * 0.5; if (b < land - 0.5) continue;
    let y = by - (1 - eIn2(P(b, land - 0.5, land))) * 1150, [sx, sy] = squash(b, land, 0.4, 8);
    const hs = 39 + i * 0.05, hp = P(b, hs, hs + 0.45);
    if (hp > 0 && hp < 1) { y -= 170 * arc(hp); sx = 0.94; sy = 1.08; }
    if (b > hs + 0.45) [sx, sy] = squash(b, hs + 0.45, 0.3, 9);
    glyph('BOUNCE'[i], x0 + lay.xs[i] + lay.ws[i] / 2, y, fa, RED, sx, sy);
  }
  const wp = eInX(P(b, 39.6, 40)); if (wp > 0) rect(0, H * (1 - wp), W, H * wp + 1, PAPER);
}

const S6C = [[41, 1470, 560], [42, 820, 500], [43, 1170, 570], [43.5, 960, 540]];
function s6(b) {                        // 40–48: LOUDER seen through a hopping red lens, then a stepping stack
  if (b < 44) {
    rect(0, 0, W, H, PAPER);
    const fa0 = F.anton(AS(100)), sz = AS(100) * 1780 / measure('LOUDER', fa0), fa = F.anton(sz), cap = sz * CAP, by = 540 + cap / 2;
    word('LOUDER', W / 2, by, fa, INK, 1, 1, { outline: 5 });
    const x = steps(b, 450, S6C.map(([t, x]) => [t, x]), 0.35), y = steps(b, 520, S6C.map(([t, , y]) => [t, y]), 0.35);
    const r = 285 * back(P(b, 40, 40.45), 2) + 1500 * eIn3(P(b, 43.55, 44));
    g.save(); clipDisc(x, y, r); disc(x, y, r, RED); word('LOUDER', W / 2, by, fa, INK); g.restore();
    for (let i = 0; i < 4; i++) rect(80 + i * 34, 990, 24, 24 * eOutX(P(b, 40 + i, 40.2 + i)), INK);
    return;
  }
  rect(0, 0, W, H, RED);
  const cap = 112, fa = F.anton(AS(cap)), hi = Math.floor((b - 44.5) * 2), col = P(b, 47.4, 47.9);
  for (let r = 0; r < 7; r++) {
    const e = eOutX(P(b, 44 + r * 0.07, 44.45 + r * 0.07)), dx = (r % 2 ? 1 : -1) * 1500 * (1 - e);
    const yc = L(540 + (r - 3) * 134, 540, eInX(col)), sy = L(1, 0.04, eInX(col));
    const on = b >= 44.5 && ((hi % 7) + 7) % 7 === r;
    word('LOUDER  LOUDER  LOUDER  LOUDER  LOUDER', W / 2 + dx + (r % 2 ? 160 : -160), yc + cap / 2 * sy, fa, on ? PAPER : INK, 1, sy, on ? {} : { outline: 3 });
  }
  const pb = eInX(P(b, 47.55, 48)); if (pb > 0) rect(0, 540 - H / 2 * pb, W, H * pb, PAPER);
}

const TRK = [[48, '+800'], [49, '+400'], [50, '0'], [51, '−40'], [51.5, '0']];
function s7(b) {                        // 48–56: tracking collapses, then a Bauhaus poster snaps together
  rect(0, 0, W, H, PAPER);
  if (b < 52) {
    const cap = 360, fa = F.anton(AS(cap)), lay = layout('SPACE', fa), x0 = W / 2 - lay.w / 2, by = 540 + cap / 2 - 950 * eInX(P(b, 51.75, 52));
    let s = 1; s = L(s, 0.55, eOutX(P(b, 49, 49.3))); s = L(s, 0, eOutX(P(b, 50, 50.3))); s = L(s, -0.14, eOutX(P(b, 51, 51.22))); s = L(s, 0, back(P(b, 51.5, 51.75), 2));
    for (let i = 0; i < 5; i++) {
      const nat = x0 + lay.xs[i] + lay.ws[i] / 2, spread = 230 + i * 365, x = nat + s * (spread - nat);
      const sc = back(P(b, 48 + i * 0.06, 48.38 + i * 0.06), 2.2);
      glyph('SPACE'[i], x, by, fa, INK, sc, sc, 0, 1, 10);
    }
    let lab = TRK[0][1]; for (const [t, v] of TRK) if (b >= t) lab = v;
    text('TRACKING  ' + lab, W / 2, 900 - 950 * eInX(P(b, 51.75, 52)), F.sg(34, 500), INK, 'center', 6);
    return;
  }
  const iris = eIn3(P(b, 55.35, 56)), pulse = 1 + 0.05 * Math.exp(-Math.max(0, b - 55) * 7) * (b >= 55 ? 1 : 0);
  const cx = L(-420, 560, eOutX(P(b, 52, 52.45))), cr = 330 * pulse;
  const drawCircle = () => { disc(cx, 540, cr + 2400 * iris, RED); };
  if (iris <= 0) drawCircle();
  const bh = 840 * eOutX(P(b, 52.5, 52.9)); rect(1000, 120, 36, bh, INK);
  const se = back(P(b, 53, 53.45), 1.8); if (se > 0) semi(1470, 450, 230 * se, (1 - eOutX(P(b, 53, 53.5))) * Math.PI, TEAL);
  const te = back(P(b, 54.5, 54.9), 2.2); if (te > 0) tri(560, 560, 250 * te * pulse, (1 - eOutX(P(b, 54.5, 55))) * -Math.PI * 0.66, INK);
  const fw = measure('form follows', F.serif(130)), fe = eOutX(P(b, 53.5, 54));
  if (fe > 0) { g.save(); clipRect(1090, 480, fw * fe + 10, 200); text('form follows', 1090, 640, F.serif(130), INK, 'left'); g.restore(); }
  const f0 = F.anton(100), sz = AS(100) * Math.min(1, 1) * 1, rs = 100 * 730 / measure('RHYTHM', f0), fa = F.anton(rs), lay = layout('RHYTHM', fa);
  g.save(); clipRect(0, 0, W, 924);
  for (let i = 0; i < 6; i++) { const p = eOutX(P(b, 54 + i * 0.06, 54.55 + i * 0.06)); if (p > 0) glyph('RHYTHM'[i], 1090 + lay.xs[i] + lay.ws[i] / 2, 920 + (1 - p) * rs * 0.9, fa, INK); }
  g.restore(); void sz;
  const le = eOutX(P(b, 55, 55.4)); if (le > 0) { g.globalAlpha = le; text('Nº02 — FORM FOLLOWS RHYTHM', 1090, 990, F.sg(26, 500), INK, 'left', 6); g.globalAlpha = 1; }
  if (iris > 0) drawCircle();
}

function s8(b) {                        // 56–64: the lockup returns on red, the iris closes on its full stop
  const r = LK.r, close = eIO(P(b, 61.25, 62.25));
  const scene = () => {
    rect(0, 0, W, H, RED);
    line(b, 56, 0.5, INK);
    lockup(b, 56.2, [INK, PAPER], 0.07, 0.55);
    const dp = P(b, 57.5, 58); let sq = squash(b, 58, 0.42);
    if (dp > 0) { const y = L(-120, LINE_Y - 3 - r, eIn2(dp)); g.save(); g.translate(LK.dx, y + r); g.scale(sq[0], sq[1]); disc(0, -r, r, b >= 61.25 ? RED : PAPER); g.restore(); }
    const cap = 'STUDY Nº02 — 128 BPM — 16 BARS — MADE WITH CODE', n = Math.floor(clamp((b - 58) / 1.5) * cap.length);
    if (n > 0) text(cap.slice(0, n) + (n < cap.length && (b * 4 % 1) < 0.5 ? '▌' : ''), W / 2, LINE_Y + 90, F.sg(34, 700), INK, 'center', 7);
  };
  if (close <= 0) { scene(); return; }
  rect(0, 0, W, H, PAPER);
  const dcx = LK.dx, dcy = LINE_Y - 3 - r;
  if (b < 62.25) { g.save(); clipDisc(dcx, dcy, L(2400, r, close)); scene(); g.restore(); return; }
  // paper again: line redraws, the dot hops back to the centre — the loop point of the film
  line(b, 62.3, 0.6, INK);
  const hp = P(b, 62.9, 63.7); let x = L(dcx, W / 2, eIO(hp)), y = dcy - 300 * arc(hp), sq = squash(b, 63.7, 0.42);
  g.save(); g.translate(x, y + r); g.scale(sq[0], sq[1]); disc(0, -r, r, RED); g.restore();
}

// ---------- HUD ----------
function hud(b) {
  const paperHud = (b >= Q(16) && b < Q(24)) || (b >= 33.3 && b < 39.8);
  const c = paperHud ? PAPER : INK, a = P(b, 0.3, 0.9) * (1 - P(b, 61, 61.4)) ; if (a <= 0) return;
  g.globalAlpha = a;
  text('SHAPE OF SOUND', 60, 70, F.sg(24, 700), c, 'left', 5);
  text('STUDY Nº02  ·  128 BPM', W - 60, 70, F.sg(24, 500), c, 'right', 5);
  const bar = Math.min(16, Math.floor(b / 4) + 1);
  text('BAR ' + String(bar).padStart(2, '0') + '/16', 60, 1046, F.sg(24, 700), c, 'left', 4);
  const t = b * B, tc = `00:${String(Math.floor(t)).padStart(2, '0')}:${String(Math.floor((t % 1) * 30)).padStart(2, '0')}`;
  text(tc, W - 60, 1046, F.sg(24, 500), c, 'right', 4);
  const x0 = 300, x1 = W - 300;
  rect(x0, 1037, x1 - x0, 2, c);
  for (let i = 0; i <= 16; i++) rect(x0 + (x1 - x0) * i / 16 - 1, 1029, 2, i % 4 ? 10 : 18, c);
  const mx = x0 + (x1 - x0) * b / NB, kick = 1 + 0.5 * Math.exp(-(b % 1) * 8);
  square(mx, 1038, 14 * kick, 0, c);
  g.globalAlpha = 1;
}

// ---------- paper grain ----------
let GRAIN = null;
function makeGrain() {
  GRAIN = document.createElement('canvas'); GRAIN.width = W; GRAIN.height = H;
  const q = GRAIN.getContext('2d'), im = q.createImageData(W, H); let s = 1234567;
  for (let i = 0; i < W * H; i++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; const v = (s >>> 24); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  q.putImageData(im, 0, 0);
}

const SCENES = [[0, s1], [8, s2], [16, s3], [24, s4], [32, s5], [40, s6], [48, s7], [56, s8]].map(([t, f]) => [t === 0 ? 0 : Q(t), f]);
function render(t) {
  const b = clamp(t / B, 0, NB - 1e-6);
  let f = s1; for (const [st, fn] of SCENES) if (b >= st) f = fn;
  g.save(); f(b); g.restore();
  hud(b);
  g.save(); g.globalAlpha = 0.045; g.globalCompositeOperation = 'overlay'; g.drawImage(GRAIN, 0, 0); g.restore();
}
window.setTime = t => { render(t); };
window.DUR = NB * B;
window.ready = (async () => {
  await Promise.all([F.anton(100), F.serif(100), F.sg(40, 500), F.sg(40, 700)].map(f => document.fonts.load(f, 'ABCOof0128Nº')));
  setFont(F.anton(100)); CAP = g.measureText('H').actualBoundingBoxAscent / 100;
  lockupLayout(); makeGrain(); render(0); return true;
})();
