'use strict';
// COLOR CLASH — 30s pop-art kinetic typography, 150 BPM (beat = 0.4s = 12 frames, bar = 1.6s).
// Every section owns a saturated colour pair; colours cut on the beat. Energy map:
//   groove 0–9.6 → break 9.6–11.2 → build 11.2–12.6 → silence → DROP 12.8–19.2 → STOP + silence
//   → "ONE MORE TIME" → DROP 2 20.8–27.2 → finale 27.2–30.
// Every frame is a pure function of t.

const W = 1920, H = 1080, CX = W / 2, CY = H / 2, FPS = 30, DUR = 30;
const BT = 0.4, BAR = 1.6, D2R = Math.PI / 180, TAU = Math.PI * 2;
const PINK = '#FF2E88', YEL = '#FFE500', BLUE = '#2B2BFF', CYAN = '#00D8FF', ORANGE = '#FF6B00',
  LIME = '#B4FF00', VIOLET = '#7B2BFF', RED = '#FF2A2A', WHITE = '#FFFFFF', INK = '#14101F';
const RAINBOW = [PINK, ORANGE, YEL, LIME, CYAN, BLUE, VIOLET];
// hard cuts (colour changes, scene switches) use frame-snapped time so a cut never blends two colours
let TH = 0;
const cv = document.getElementById('c'), ctx = cv.getContext('2d');

// ---------- maths ----------
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const L = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const eOut3 = t => 1 - Math.pow(1 - t, 3), eIn3 = t => t * t * t;
const eOutX = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)), eInX = t => (t <= 0 ? 0 : Math.pow(2, 10 * (t - 1)));
const eIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const back = (t, s = 1.7) => { if (t <= 0) return 0; if (t >= 1) return 1; t -= 1; return t * t * ((s + 1) * t + s) + 1; };
const hash = n => { let h = Math.imul(n | 0, 2654435761) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };
const frac = x => x - Math.floor(x);
// seconds since the most recent beat at or after `from`
const since = (t, from = 0, step = BT) => (t < from ? 99 : (t - from) % step);
// beat punch: 1 → 0 decay after each beat
const kick = (t, from = 0, k = 12, step = BT) => Math.exp(-since(t, from, step) * k);
// giant-slam: frame 0 huge, frame 1 big, then lands — sampled on whole frames so the two big frames stay crisp
const slam = (t, t0, b0 = 16, b1 = 9) => {
  const f = Math.round(t * FPS) - Math.round(t0 * FPS);
  if (f < 0) return 0; if (f === 0) return b0; if (f === 1) return b1;
  return 1 + 0.12 * Math.exp(-(t - t0 - 2 / FPS) * 14);
};
const pop = (t, t0, d = 0.3, s = 2.2) => back(P(t, t0, t0 + d), s);
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${clamp(a)})`; };

// ---------- text ----------
const CAP = {};
function font(w, px, track = 0) { ctx.font = `${w} ${px}px Mont`; ctx.letterSpacing = (track * px) + 'px'; }
for (const w of [500, 800, 900]) { font(w, 100); CAP[w] = ctx.measureText('H').actualBoundingBoxAscent / 100; }
// draw `str` centred on its ink box. o: x y h(cap height) w(weight) c(colour) s sx sy rot skew a sh=[dx,dy,colour] stroke track
function txt(str, o) {
  const wt = o.w || 900, px = (o.h || 100) / CAP[wt], tr = o.track || 0;
  font(wt, px, tr); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(str), l = m.actualBoundingBoxLeft, r = m.actualBoundingBoxRight, A = m.actualBoundingBoxAscent, D = m.actualBoundingBoxDescent;
  const s = o.s ?? 1; if (s <= 0.001 || (o.a ?? 1) <= 0.001) return;
  const bx = -(r - l) / 2, by = (A - D) / 2;
  ctx.save(); ctx.translate(o.x, o.y);
  if (o.rot) ctx.rotate(o.rot * D2R);
  ctx.transform(1, 0, Math.tan((o.skew ?? -12) * D2R), 1, 0, 0);
  ctx.scale(s * (o.sx ?? 1), s * (o.sy ?? 1));
  ctx.globalAlpha = o.a ?? 1;
  if (o.sh) { ctx.fillStyle = o.sh[2]; ctx.fillText(str, bx + o.sh[0], by + o.sh[1]); }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.c; ctx.strokeText(str, bx, by); }
  else { ctx.fillStyle = o.c; ctx.fillText(str, bx, by); }
  ctx.restore(); ctx.globalAlpha = 1;
}
// per-letter layout: centre offsets of each glyph relative to the word's ink centre
function glyphs(str, h, wt = 900, tr = 0) {
  const px = h / CAP[wt]; font(wt, px, tr);
  const m = ctx.measureText(str), mid = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
  return [...str].map((ch, i) => {
    const left = i ? ctx.measureText(str.slice(0, i)).width : 0, g = ctx.measureText(ch);
    return { ch, dx: left + (g.actualBoundingBoxRight - g.actualBoundingBoxLeft) / 2 - mid };
  });
}
const SKEW = Math.tan(-12 * D2R);

// ---------- shapes ----------
function bg(c) { ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); }
function circle(x, y, r, c) { if (r <= 0) return; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
function ring(x, y, r, lw, c) { if (r <= 0 || lw <= 0) return; ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
function seal(x, y, r, rot, c, n = 22, depth = 0.1) { // zig-zag sticker badge
  if (r <= 0) return; ctx.fillStyle = c; ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot * D2R + i * Math.PI / n, rr = i % 2 ? r * (1 - depth) : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
function burst(x, y, rot, n, c, R = 2600) { // alternating sun rays
  ctx.fillStyle = c; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = rot * D2R + i * TAU / n, a1 = a0 + TAU / n / 2;
    ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a0) * R, y + Math.sin(a0) * R); ctx.lineTo(x + Math.cos(a1) * R, y + Math.sin(a1) * R); ctx.closePath();
  }
  ctx.fill();
}
function stripes(angle, width, colors, offset) { // full-screen diagonal stripes
  ctx.save(); ctx.translate(CX, CY); ctx.rotate(angle * D2R);
  const n = colors.length, span = 2400, k0 = Math.floor((-span - offset) / width);
  for (let k = k0; k * width + offset < span; k++) { ctx.fillStyle = colors[((k % n) + n) % n]; ctx.fillRect(k * width + offset, -span, width + 1, 2 * span); }
  ctx.restore();
}
function chevron(x, y, s, lw, c) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineJoin = 'miter'; ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.6); ctx.lineTo(x, y - s * 0.4); ctx.lineTo(x + s, y + s * 0.6); ctx.stroke(); }
function halftone(x0, y0, w, h, step, rFn, c) {
  ctx.fillStyle = c; ctx.beginPath();
  for (let y = y0; y < y0 + h; y += step) for (let x = x0 + ((y - y0) / step % 2) * step / 2; x < x0 + w; x += step) {
    const r = rFn(x, y); if (r > 0.3) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  }
  ctx.fill();
}
function marquee(str, y, h, speed, t, o) { // a horizontally scrolling row of repeated text
  const px = h / CAP[900]; font(900, px, 0.02); const unit = ctx.measureText(str).width;
  let x = ((speed * t) % unit + unit) % unit - unit;
  ctx.save(); ctx.translate(0, y); ctx.transform(1, 0, SKEW, 1, 0, 0);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.globalAlpha = o.a ?? 1;
  for (; x < W + unit; x += unit) {
    if (o.stroke) { ctx.lineWidth = o.stroke; ctx.strokeStyle = o.c; ctx.lineJoin = 'round'; ctx.strokeText(str, x, 0); }
    else { ctx.fillStyle = o.c; ctx.fillText(str, x, 0); }
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
function shake(t, amt) { if (amt > 0.2) { const f = Math.floor(t * 60); ctx.translate((hash(f * 2) - 0.5) * 2 * amt, (hash(f * 2 + 1) - 0.5) * 2 * amt); } }
function cam(o) { // scene camera about the screen centre
  ctx.translate(CX + (o.x || 0), CY + (o.y || 0)); ctx.rotate((o.r || 0) * D2R); ctx.scale(o.s ?? 1, o.s ?? 1); ctx.translate(-CX, -CY);
}

// ============================================================
// S1 0–3.2  TURN IT UP — colour cut on every beat of bar 2
// ============================================================
function s1(t) {
  const bi = clamp(Math.floor(TH / BT + 1e-6), 0, 7), bgs = [PINK, PINK, PINK, PINK, ORANGE, CYAN, VIOLET, YEL];
  const ex = eInX(P(t, 3.0, 3.2));
  cam({ y: -1250 * ex });
  bg(bgs[bi]);
  const fg = bi === 7 ? BLUE : WHITE, sh = bi === 7 ? PINK : INK;
  const kk = kick(t, 0.8);
  // rays fade in on beat 3 and turn with the beat
  if (t >= 1.2) burst(CX, CY + 160, t * 18 + 6 * kick(t, 1.2, 10), 18, rgba(WHITE, 0.16 * eOutX(P(t, 1.2, 1.5))));
  // rising chevrons on the last beat
  if (t >= 2.8) for (let i = 0; i < 6; i++) for (const sx of [260, W - 260]) {
    const y = H + 120 - frac((t - 2.8) * 2.6 + i / 6) * (H + 300); chevron(sx, y, 70, 22, rgba(fg, 0.9));
  }
  // TURN IT
  const up1 = eInX(P(t, 1.6, 1.85)) * 600;
  txt('TURN', { x: CX - 190, y: 270 - up1, h: 120, c: WHITE, sh: [10, 10, INK], s: L(1.8, 1, eOutX(P(t, 0, 0.16))) * (t >= 0 ? 1 : 0) });
  if (t >= 0.4) txt('IT', { x: CX + 270, y: 270 - up1, h: 120, c: YEL, sh: [10, 10, INK], s: L(1.8, 1, eOutX(P(t, 0.4, 0.56))) });
  // UP — held slam on beat 2, then steps upward on every beat of bar 2
  const sl = slam(t, 0.8, 14, 8);
  if (sl > 0) {
    let step = 0; for (let k = 0; k < 4; k++) step += eOutX(P(t, 1.6 + k * BT, 1.6 + k * BT + 0.15));
    const e = t >= 1.6 ? kick(t, 1.6, 14) : kk * (t >= 1.2 ? 1 : 0);
    txt('UP', { x: CX + 10, y: 650 - step * 45, h: 400, c: fg, sh: [18, 18, sh], s: sl * (1 + 0.1 * e), sx: 1 + 0.12 * e, sy: 1 - 0.1 * e, rot: (bi % 2 ? 3 : -3) * (t >= 1.6 ? 1 : 0) });
  }
}

// ============================================================
// S2 3.2–6.4  COLOR vs CLASH — diagonal split, colours swap on each beat of bar 2
// ============================================================
function halfPlane(ang, off, c) {
  const d = [Math.cos(ang), Math.sin(ang)], n = [-Math.sin(ang), Math.cos(ang)], cx = CX + n[0] * off, cy = CY + n[1] * off;
  ctx.fillStyle = c; ctx.beginPath();
  ctx.moveTo(cx - d[0] * 4000, cy - d[1] * 4000); ctx.lineTo(cx + d[0] * 4000, cy + d[1] * 4000);
  ctx.lineTo(cx + d[0] * 4000 + n[0] * 4000, cy + d[1] * 4000 + n[1] * 4000); ctx.lineTo(cx - d[0] * 4000 + n[0] * 4000, cy - d[1] * 4000 + n[1] * 4000);
  ctx.closePath(); ctx.fill();
}
function s2(t) {
  const lt = t - 3.2, angD = -16 + 3 * Math.sin(lt * 2.2), ang = angD * D2R;
  const lh = TH - 3.2, k = lh >= 1.6 ? Math.floor((lh - 1.6) / BT + 1e-6) + 1 : 0, swap = k % 2 === 1;
  const A = swap ? BLUE : YEL, Bc = swap ? YEL : BLUE;
  const kk = lt >= 0.8 ? kick(t, 4.0, 11) : 0;
  ctx.save(); cam({ s: 1 + 0.03 * kk });
  bg(A);
  halfPlane(ang, L(1300, 0, eOutX(P(lt, 0, 0.35))), Bc);
  // halftone dots drifting in the corners
  halftone(0, 0, 700, 420, 34, (x, y) => 11 * (1 - Math.hypot(x, y) / 760), rgba(PINK, 0.85));
  halftone(W - 700, H - 420, 700, 420, 34, (x, y) => 11 * (1 - Math.hypot(W - x, H - y) / 760), rgba(PINK, 0.85));
  // COLOR slides in from the left, letter by letter; CLASH from the right
  const clash = eOutX(P(lt, 0.8, 0.95)) - eOut3(P(lt, 0.95, 1.6)) * 0.6;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const g1 = glyphs('COLOR', 190), g2 = glyphs('CLASH', 190);
  g1.forEach((g, i) => {
    const q = eOutX(P(lt, 0.02 + i * 0.045, 0.45 + i * 0.045)), off = -1500 * (1 - q) + 40 * clash;
    const bx = CX - 330 + g.dx * Math.cos(ang) + off * dx, by = CY - 170 + g.dx * Math.sin(ang) + off * dy;
    if (q > 0) txt(g.ch, { x: bx, y: by, h: 190, c: Bc, rot: angD, sh: [12, 12, PINK], s: 1 + 0.12 * kk });
  });
  g2.forEach((g, i) => {
    const q = eOutX(P(lt, 0.4 + (4 - i) * 0.045, 0.85 + (4 - i) * 0.045)), off = 1500 * (1 - q) - 40 * clash;
    const bx = CX + 330 + g.dx * Math.cos(ang) + off * dx, by = CY + 190 + g.dx * Math.sin(ang) + off * dy;
    if (q > 0) txt(g.ch, { x: bx, y: by, h: 190, c: A, rot: angD, sh: [12, 12, PINK], s: 1 + 0.12 * kk });
  });
  // VS sticker pops at the collision
  const vs = pop(t, 4.0, 0.35, 2.6);
  if (vs > 0) {
    const r = 120 * vs * (1 + 0.15 * kk), rot = lt * 40;
    seal(CX + 8, CY + 12, r, rot, INK); seal(CX, CY, r, rot, PINK);
    txt('VS', { x: CX, y: CY, h: 70 * vs * (1 + 0.15 * kk), c: WHITE, rot: -10 });
  }
  // pink dots popping on every eighth of bar 2
  for (let j = 0; j < 8; j++) {
    const t0 = 4.8 + j * BT / 2, q = P(t, t0, t0 + 0.45); if (q <= 0 || q >= 1) continue;
    const x = 200 + hash(j * 7 + 1) * (W - 400), y = 140 + hash(j * 7 + 2) * (H - 280), r = (24 + 40 * hash(j * 7 + 3)) * back(q * 2.5, 2.5) * (1 - eIn3(q));
    circle(x, y, r, j % 2 ? PINK : WHITE);
  }
  // exit: a red half-plane swallows the screen
  if (lt > 3.0) halfPlane(ang, L(1300, -1300, eInX(P(lt, 3.0, 3.2))), RED);
  ctx.restore();
}

// ============================================================
// S3 6.4–9.6  RED HOT — marquee rows + HOT sticker
// ============================================================
function s3(t) {
  const lt = t - 6.4, kk = kick(t, 6.4, 11);
  bg(RED);
  const fast = 1 + 1.6 * P(lt, 1.6, 1.7), xs = lt * 1 + Math.max(0, lt - 1.6) * 1.6;
  const ys = [130, 400, 680, 950], late = lt >= 2.4;
  ys.forEach((y, i) => {
    const q = eOutX(P(lt, i * 0.06, i * 0.06 + 0.5)), dir = i % 2 ? 1 : -1, off = dir * -2200 * (1 - q);
    ctx.save(); ctx.translate(off, 0);
    marquee(i % 2 ? 'HOT  HOT  HOT  ' : 'RED  HOT  ', y, 170, dir * 280, xs, i % 2 ? { c: late ? YEL : WHITE, stroke: 4 } : { c: late ? YEL : '#FFFFFF', a: 0.95 });
    ctx.restore();
  });
  // the HOT sticker
  const p = pop(t, 7.2, 0.4, 2.4), ex = eInX(P(t, 9.15, 9.6));
  if (p > 0) {
    const spin = 360 * eIO(P(t, 8.0, 8.45)), s = p * (1 + 0.12 * (t >= 7.2 ? kk : 0)) * (1 + 14 * ex), rot = -10 + spin + lt * 12;
    seal(CX + 14, CY + 16, 260 * s, rot, INK, 24); seal(CX, CY, 260 * s, rot, YEL, 24);
    ring(CX, CY, 205 * s, 6 * s, RED);
    txt('HOT', { x: CX, y: CY, h: 150 * s, c: RED, rot: -8 + spin, a: 1 - P(ex, 0.2, 0.5) });
    if (t >= 7.6) txt('100%', { x: CX + 30 * s, y: CY + 125 * s, h: 34 * s, w: 800, c: INK, rot: -8 + spin, a: (1 - P(ex, 0.1, 0.3)) * pop(t, 7.6, 0.25) });
  }
  if (ex > 0.55) bg(YEL);
}

// ============================================================
// S4 9.6–11.2  BREAK — quiet, small, lots of empty space
// ============================================================
function s4(t) {
  bg(YEL);
  const words = [['WAIT', -280, 9.6], ['FOR', 0, 10.0], ['IT', 200, 10.4]];
  for (const [w, x, t0] of words) {
    const q = P(t, t0, t0 + 0.3); if (q <= 0) continue;
    txt(w, { x: CX + x, y: L(-60, CY, back(q, 1.3)), h: 64, w: 900, c: INK, rot: L(-16, 0, eOut3(q)) });
  }
  for (let i = 0; i < 3; i++) { const p = pop(t, 10.8 + i * 0.133, 0.2, 3); circle(CX + 290 + i * 34, CY + 26, 9 * p, INK); }
  // metronome
  const a = 26 * Math.sin(Math.PI * (t - 9.6) / BT) * eOut3(P(t, 9.6, 9.9));
  ctx.save(); ctx.translate(CX, CY + 250); ctx.rotate(a * D2R);
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -120); ctx.stroke(); circle(0, -90, 14, PINK);
  ctx.restore(); ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(CX - 40, CY + 262); ctx.lineTo(CX + 40, CY + 262); ctx.lineTo(CX, CY + 230); ctx.fill();
}

// ============================================================
// S5 11.2–12.8  BUILD — strobing colours 1/4 → 1/8 → 1/16, converging rings, then black
// ============================================================
function s5(t) {
  const lt = t - 11.2, lh = TH - 11.2 + 1e-6;
  if (lh >= 1.4) { bg(INK); return; }
  const k = lh < 0.8 ? Math.floor(lh / 0.4) : lh < 1.2 ? 2 + Math.floor((lh - 0.8) / 0.2) : 4 + Math.floor((lh - 1.2) / 0.1);
  const cols = [PINK, CYAN, VIOLET, ORANGE, BLUE, LIME, PINK, YEL, BLUE], c = cols[k % cols.length], light = c === YEL || c === LIME || c === CYAN;
  bg(c);
  const q = eIn3(P(lt, 0, 1.4)), sp = lt + 1.2 * q * q;
  for (let j = 0; j < 6; j++) { const r = 1300 * frac(j / 6 - sp * 0.9); ring(CX, CY, r, 4 + 30 * (r / 1300), rgba(light ? INK : WHITE, 0.35)); }
  const jit = 30 * q;
  txt('LOUDER', { x: CX + (hash(k * 3) - 0.5) * jit, y: CY + (hash(k * 3 + 1) - 0.5) * jit, h: L(90, 270, q), c: light ? INK : WHITE, sh: [12, 12, light ? PINK : INK], rot: (hash(k) - 0.5) * 8 * q });
}

// ============================================================
// S6 12.8–19.2  DROP — BOOM / BOUNCE / CLAP / SHAKE
// ============================================================
function s6a(t) {
  const lt = t - 12.8, kk = kick(t, 12.8, 12), ex = eInX(P(lt, 1.42, 1.62));
  ctx.save(); cam({ x: -2200 * ex });
  shake(t, 16 * kk);
  bg(BLUE);
  burst(CX, CY, lt * 25 + 10 * Math.floor(lt / BT), 20, 'rgba(255,255,255,0.09)');
  for (let k = 0; k < 4; k++) { const d = t - (12.8 + k * BT); if (d < 0 || d > 0.7) continue; const q = eOut3(d / 0.7); ring(CX, CY, L(80, 1150, q), L(46, 2, q), k % 2 ? CYAN : PINK); }
  const sl = slam(t, 12.8, 18, 10);
  txt('BOOM', { x: CX, y: CY + 12, h: 260, c: YEL, sh: [18, 18, PINK], s: sl * (1 + 0.08 * kk), sx: 1 + 0.12 * kk, sy: 1 - 0.12 * kk });
  ctx.restore();
}
function s6b(t) {
  const lt = t - 14.4, en = eOutX(P(lt, -0.15, 0.1)), ex = eInX(P(lt, 1.35, 1.6));
  ctx.save(); cam({ x: 2200 * (1 - en), r: -50 * ex, s: L(1, 0.4, ex), y: 260 * ex });
  bg(LIME);
  halftone(0, 0, W, H, 46, (x, y) => 9 + 7 * Math.sin(x / 140 + y / 110 - lt * 6), rgba(VIOLET, 0.16));
  const base = CY + 150, gl = glyphs('BOUNCE', 210);
  ctx.fillStyle = VIOLET; ctx.fillRect(140, base + 108, W - 280, 10);
  gl.forEach((g, i) => {
    const ph = lt / BT - i * 0.12; if (ph < 0) return;
    const u = frac(ph), h = 4 * u * (1 - u), contact = Math.exp(-u * 18) + Math.exp(-(1 - u) * 18);
    const y = base - 260 * h, x = CX + g.dx * 1.08;
    ctx.fillStyle = rgba(INK, 0.22 * (1 - h * 0.7)); ctx.beginPath(); ctx.ellipse(x, base + 104, 70 * (1 - h * 0.5), 12, 0, 0, TAU); ctx.fill();
    txt(g.ch, { x, y: y + 40 * contact, h: 210, c: VIOLET, sh: [10, 10, PINK], sx: 1 + 0.22 * contact, sy: 1 - 0.2 * contact, s: back(P(ph, 0, 0.5), 2) });
  });
  ctx.restore();
}
function s6c(t) {
  const lt = t - 16.0, ex = eInX(P(lt, 1.42, 1.6));
  ctx.save(); cam({ s: 1 + 7 * ex });
  bg(ORANGE);
  for (let i = 0; i < 4; i++) marquee('CLAP  CLAP  CLAP  ', 150 + i * 260, 140, (i % 2 ? 1 : -1) * 220, lt, { c: rgba(INK, 0.22), stroke: 3 });
  const hits = [16.4, 17.2], last = hits.filter(h => t >= h).pop();
  if (last) {
    const d = t - last, side = last === 16.4 ? -1 : 1, q = eOutX(P(d, 0, 0.12));
    // speed lines
    ctx.save(); ctx.translate(CX, CY); ctx.strokeStyle = rgba(WHITE, Math.exp(-d * 5)); ctx.lineWidth = 10;
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16 + 0.1, r0 = 420 + 200 * eOut3(P(d, 0, 0.4)); ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * 0.7); ctx.lineTo(Math.cos(a) * (r0 + 160), Math.sin(a) * (r0 + 160) * 0.7); ctx.stroke(); }
    ctx.restore();
    const kk = kick(t, 16.0, 12);
    txt('CLAP!', { x: CX + side * 40, y: CY, h: 280, c: WHITE, sh: [18, 18, INK], rot: side * 7, s: L(1.6, 1, q) * (1 + 0.06 * kk) });
    const b = pop(t, last + 0.05, 0.3, 3);
    seal(CX + side * 520, CY - 230, 95 * b, t * 60, YEL, 16, 0.16); txt(last === 16.4 ? 'x1' : 'x2', { x: CX + side * 520, y: CY - 230, h: 54 * b, c: INK });
  } else {
    txt('CLAP', { x: CX, y: CY, h: 120, c: WHITE, stroke: 4, s: pop(t, 16.0, 0.25) });
  }
  ctx.restore();
}
function s6d(t) {
  const lt = t - 17.6, step = Math.floor(t / 0.1), amp = L(1, 2.6, eIn3(P(lt, 1.2, 1.6))), kk = kick(t, 17.6, 12);
  ctx.save(); shake(t, (6 + 10 * kk) * amp);
  bg(VIOLET);
  for (let i = 0; i < 5; i++) marquee('SHAKE IT  SHAKE IT  ', 110 + i * 215, 120, (i % 2 ? 1 : -1) * 520, lt, { c: rgba(LIME, 0.35), stroke: 3 });
  const gl = glyphs('SHAKE', 270);
  gl.forEach((g, i) => {
    const jx = (hash(step * 11 + i) - 0.5) * 34 * amp, jy = (hash(step * 13 + i) - 0.5) * 34 * amp, jr = (hash(step * 17 + i) - 0.5) * 14 * amp;
    const p = pop(t, 17.6 + i * 0.04, 0.25, 2.2), o = { x: CX + g.dx * 1.06 + jx, y: CY + jy, h: 270, rot: jr, s: p * (1 + 0.1 * kk) };
    txt(g.ch, { ...o, x: o.x - 16 * amp, c: PINK }); txt(g.ch, { ...o, x: o.x + 16 * amp, c: CYAN }); txt(g.ch, { ...o, c: LIME });
  });
  ctx.restore();
}

// ============================================================
// S7 19.2–20.8  STOP (tape stop) — silence — ONE MORE TIME
// ============================================================
function s7(t) {
  bg(INK);
  const sl = slam(t, 19.2, 18, 10);
  if (t < 19.65) {
    const d = eIn3(P(t, 19.28, 19.6));
    txt('STOP', { x: CX, y: CY + 180 * d, h: 280, c: WHITE, sh: [16, 16, RED], s: sl, sy: 1 - 0.96 * d, sx: 1 + 0.2 * d });
  }
  const zoom = eInX(P(t, 20.6, 20.8));
  ctx.save(); cam({ s: 1 + 9 * zoom });
  [['ONE', PINK, -270, 20.0], ['MORE', YEL, 0, 20.2], ['TIME', CYAN, 270, 20.4]].forEach(([w, c, dy, t0], i) => {
    if (t < t0) return; const q = eOutX(P(t, t0, t0 + 0.12));
    txt(w, { x: CX + (i - 1) * 60, y: CY + dy, h: 210, c, s: L(1.8, 1, q) * (1 + 0.1 * kick(t, t0, 14, 9)), rot: -4 });
  });
  ctx.restore();
  const fl = eIn3(P(t, 20.62, 20.8)); if (fl > 0) { ctx.fillStyle = rgba(WHITE, fl); ctx.fillRect(0, 0, W, H); }
}

// ============================================================
// S8 20.8–27.2  DROP 2 — LOUDER / FEEL IT IN COLOR / PINK LIME BLUE GOLD / ALL AT ONCE
// ============================================================
function s8a(t) {
  const lt = t - 20.8, kk = kick(t, 20.8, 12), ex = eInX(P(lt, 1.4, 1.6));
  ctx.save(); cam({ y: -1250 * ex }); shake(t, 10 * kk);
  let step = 0; for (let k = 1; k <= 4; k++) step += eOutX(P(lt, k * BT - 0.4 + 0.4, k * BT + 0.15)) * (lt >= k * BT ? 1 : 0);
  stripes(30, 170, RAINBOW, lt * 380 + step * 170);
  const sl = slam(t, 20.8, 16, 9);
  txt('LOUDER', { x: CX, y: CY + 10, h: 270, c: WHITE, sh: [20, 20, INK], s: sl * (1 + 0.08 * kk), sx: 1 + 0.1 * kk, sy: 1 - 0.1 * kk, rot: Math.floor((TH - 20.8) / BT + 1e-6) % 2 ? 3 : -3 });
  ctx.restore();
  const fl = Math.exp(-(t - 20.8) * 10); if (fl > 0.01) { ctx.fillStyle = rgba(WHITE, fl); ctx.fillRect(0, 0, W, H); }
}
function s8b(t) {
  const lt = t - 22.4, kk = kick(t, 22.4, 12);
  bg(INK);
  const panels = [[PINK, 'FEEL', WHITE, -1, 0], [CYAN, 'IT', INK, 0, -1], [YEL, 'IN', BLUE, 1, 0], [VIOLET, 'COLOR', LIME, 0, 1]];
  const slots = [[0, 0], [1, 0], [1, 1], [0, 1]], rotq = eIO(P(lt, 1.2, 1.5));
  panels.forEach(([c, w, tc, ix, iy], i) => {
    const q = eOutX(P(lt, i * BT, i * BT + 0.25)); if (q <= 0) return;
    const a = slots[i], b = slots[(i + 1) % 4];
    const sx = L(a[0], b[0], rotq) * W / 2, sy = L(a[1], b[1], rotq) * H / 2;
    const x = sx + ix * (1 - q) * 1100, y = sy + iy * (1 - q) * 700;
    ctx.save(); ctx.beginPath(); ctx.rect(x + 6, y + 6, W / 2 - 12, H / 2 - 12); ctx.clip();
    bg(c);
    const on = i === Math.floor(lt / BT) % 4;
    txt(w, { x: x + W / 4, y: y + H / 4, h: w.length > 3 ? 120 : 150, c: tc, sh: [10, 10, rgba(INK, 0.35)], s: 1 + (on ? 0.18 * kk : 0) });
    ctx.restore();
  });
}
function s8c(t) {
  const lt = t - 24.0, i = clamp(Math.floor((TH - 24.0) / BT + 1e-6), 0, 3);
  const cols = [[PINK, 'PINK', WHITE], [LIME, 'LIME', VIOLET], [BLUE, 'BLUE', YEL], [YEL, 'GOLD', BLUE]];
  const [c, w, tc] = cols[i], d = lt - i * BT;
  if (i > 0) bg(cols[i - 1][0]);
  // the new colour wipes in from the left on the beat
  ctx.fillStyle = c; const wx = i === 0 ? W : W * eOutX(P(d, 0, 0.12));
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(wx + 300, 0); ctx.lineTo(wx, H); ctx.lineTo(0, H); ctx.fill();
  for (let j = 0; j < 10; j++) { const a = j * TAU / 10 + lt, r = 430 + 40 * Math.sin(lt * 8 + j); circle(CX + Math.cos(a) * r * 1.3, CY + Math.sin(a) * r * 0.75, 18 * pop(t, 24.0 + i * BT + 0.2, 0.2, 3), tc); }
  const q = eOutX(P(d, 0, 0.14));
  txt(w, { x: CX, y: CY, h: 330, c: tc, sh: [18, 18, INK], s: L(1.5, 1, q) * (1 + 0.05 * Math.exp(-d * 10)), rot: i % 2 ? 5 : -5 });
}
function s8d(t) {
  const lt = t - 25.6, ex = eInX(P(lt, 1.3, 1.6)), kk = kick(t, 25.6, 12);
  ctx.save(); cam({ r: -70 * ex, s: L(1, 0.15, ex) });
  const n = 12, sw = W / n, shift = Math.floor((TH - 25.6) / BT + 1e-6);
  for (let j = 0; j < n; j++) {
    ctx.fillStyle = RAINBOW[(j + shift) % RAINBOW.length];
    const y = Math.sin(lt * 7 + j * 0.9) * 60 * (j % 2 ? 1 : -1);
    ctx.fillRect(j * sw - 1, y - 200, sw + 2, H + 400);
  }
  if (t >= 25.6) txt('ALL', { x: CX - 240, y: CY - 170, h: 160, c: WHITE, sh: [14, 14, INK], s: L(1.7, 1, eOutX(P(t, 25.6, 25.72))) * (1 + 0.06 * kk) });
  if (t >= 26.0) txt('AT', { x: CX + 250, y: CY - 170, h: 160, c: WHITE, sh: [14, 14, INK], s: L(1.7, 1, eOutX(P(t, 26.0, 26.12))) * (1 + 0.06 * kk) });
  const sl = slam(t, 26.4, 12, 7);
  if (sl > 0) txt('ONCE', { x: CX, y: CY + 130, h: 290, c: YEL, sh: [18, 18, INK], s: sl * (1 + 0.08 * kk) });
  ctx.restore();
}

// ============================================================
// S9 27.2–30  COLOR CLASH title card, final slam, collapse
// ============================================================
const CONF = Array.from({ length: 36 }, (_, i) => ({ a: hash(i * 5 + 1) * TAU, v: 700 + 900 * hash(i * 5 + 2), r: 10 + 18 * hash(i * 5 + 3), c: RAINBOW[i % 7] }));
function s9(t) {
  const lt = t - 27.2, kk = kick(t, 27.2, 12), fin = t >= 28.8 ? Math.exp(-(t - 28.8) * 8) : 0, out = eInX(P(t, 29.35, 29.8));
  bg(PINK);
  burst(CX, CY, lt * 14, 22, rgba(WHITE, 0.12 + 0.25 * fin));
  ctx.save();
  const q = eOutX(P(lt, 0, 0.5));
  cam({ r: L(40, 0, q) - 4 - 300 * out, s: L(0.5, 1, q) * (1 + 0.05 * kk + 0.2 * fin) * (1 - out), x: -110 * (1 - q), y: 250 * (1 - q) });
  txt('COLOR', { x: CX - 20, y: CY - 125, h: 200, c: YEL, sh: [16, 16, BLUE] });
  txt('CLASH', { x: CX + 20, y: CY + 125, h: 200, c: BLUE, sh: [16, 16, YEL] });
  const b = pop(t, 27.6, 0.35, 2.6);
  seal(CX + 440, CY + 240, 95 * b, lt * 40, INK, 18, 0.14); seal(CX + 432, CY + 232, 95 * b, lt * 40, WHITE, 18, 0.14);
  txt('Nº02', { x: CX + 432, y: CY + 232, h: 42 * b, c: PINK, rot: -10 });
  const tg = pop(t, 28.0, 0.3);
  if (tg > 0) { ctx.save(); ctx.translate(CX - 420, CY - 260); ctx.rotate(-8 * D2R); ctx.scale(tg, tg); ctx.fillStyle = INK; ctx.fillRect(-130, -32, 260, 64); ctx.restore(); txt('STUDY', { x: CX - 420, y: CY - 260, h: 34 * tg, w: 800, c: WHITE, rot: -8, skew: 0, track: 0.12 }); }
  ctx.restore();
  // confetti on the final hit
  if (t >= 28.8) {
    const d = t - 28.8;
    for (const p of CONF) circle(CX + Math.cos(p.a) * p.v * d, CY + Math.sin(p.a) * p.v * d + 900 * d * d, p.r * (1 - P(d, 0.6, 1.1)), p.c);
  }
}

// ---------- the timeline: [start, end, scene, z] (z: higher draws later) ----------
const SCENES = [
  [0, 3.2, s1, 2], [3.0, 6.4, s2, 1], [6.4, 9.6, s3, 1], [9.6, 11.2, s4, 1], [11.2, 12.8, s5, 1],
  [12.8, 14.45, s6a, 2], [14.25, 16.0, s6b, 3], [15.8, 16.0, s6c, 1], [16.0, 17.6, s6c, 2], [17.4, 17.6, s6d, 1], [17.6, 19.2, s6d, 1],
  [19.2, 20.8, s7, 1], [20.8, 22.4, s8a, 2], [22.2, 24.0, s8b, 1], [24.0, 25.6, s8c, 1], [25.6, 27.2, s8d, 2], [26.9, 30, s9, 1],
];

// ---------- HUD (difference blend keeps it readable on every colour) ----------
function hud(t) {
  ctx.save(); ctx.globalCompositeOperation = 'difference';
  const c = WHITE;
  txt('COLOR CLASH', { x: 120, y: 34, h: 13, w: 500, c, skew: 0, track: 0.06 });
  txt('STUDY Nº02', { x: W - 100, y: 34, h: 13, w: 500, c, skew: 0, track: 0.06 });
  txt('COLOR CLASH', { x: 120, y: H - 34, h: 13, w: 500, c, skew: 0, track: 0.06 });
  txt('STUDY Nº02', { x: W - 100, y: H - 34, h: 13, w: 500, c, skew: 0, track: 0.06 });
  ctx.restore();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(CX - 96, H - 39, 192, 39, [5, 5, 0, 0]); ctx.fill();
  txt('CLAUDE', { x: CX, y: H - 19, h: 14, w: 800, c: WHITE, skew: 0, track: 0.08 });
}

function draw(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  bg(INK); TH = Math.round(t * FPS) / FPS;
  const act = SCENES.filter(([a, b]) => TH >= a - 1e-6 && TH < b - 1e-6).sort((u, v) => u[3] - v[3]);
  for (const [, , fn] of act) { ctx.save(); fn(t); ctx.restore(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; }
  hud(t);
  const blk = P(t, 29.8, 30); if (blk > 0) { ctx.fillStyle = `rgba(0,0,0,${blk})`; ctx.fillRect(0, 0, W, H); }
}

window.setTime = t => draw(clamp(t, 0, DUR - 1e-4));
// motion blur: SUB samples across a 180° shutter, running average on the GPU, one PNG out
const acc = document.createElement('canvas'); acc.width = W; acc.height = H; const actx = acc.getContext('2d');
window.renderFrame = (f, SUB) => {
  for (let k = 0; k < SUB; k++) { window.setTime((f - 0.25 + (k + 0.5) * 0.5 / SUB) / FPS); actx.globalAlpha = 1 / (k + 1); actx.drawImage(cv, 0, 0); }
  actx.globalAlpha = 1; return acc.toDataURL('image/png').slice(22);
};
if (!location.search.includes('render')) { const t0 = performance.now(); const loop = () => { draw(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); }
