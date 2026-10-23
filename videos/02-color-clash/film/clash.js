'use strict';
// COLOR CLASH — 30s pop kinetic typography, 150 BPM (beat = 0.4s = 12 frames, bar = 1.6s).
// Fixed four-colour palette: PINK, BLUE, YELLOW + INK. Nothing else appears on screen.
// Each section owns one signature effect: extrusion, slice reveal, cross-line inversion, text tunnel,
// halftone type, slice wobble, rubber bounce, clapping panels, glitch slices, split-flap, text drum,
// iris wipes, stripe-inverted type.
// Energy: groove 0–9.6 → break → build → silence → DROP 12.8 → STOP + silence → DROP 2 20.8 → finale.

const W = 1920, H = 1080, CX = W / 2, CY = H / 2, FPS = 30, DUR = 30;
const BT = 0.4, BAR = 1.6, D2R = Math.PI / 180, TAU = Math.PI * 2;
const PINK = '#FF2E88', BLUE = '#2B2BFF', YEL = '#FFE500', INK = '#14101F';
const TRIO = [PINK, BLUE, YEL];
// readable text / depth colour for each background
const ON = { [BLUE]: [YEL, PINK], [PINK]: [YEL, INK], [YEL]: [BLUE, PINK], [INK]: [YEL, PINK] };
// hard cuts (colour changes, scene switches) use frame-snapped time so a cut never blends two colours
let TH = 0, HUDC = YEL;
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
const since = (t, from = 0, step = BT) => (t < from ? 99 : (t - from) % step);
const kick = (t, from = 0, k = 12, step = BT) => Math.exp(-since(t, from, step) * k);
// beats elapsed since t0, each beat snapping in with expoOut (for stepped motion)
const steps = (t, t0, n, d = 0.16) => { let s = 0; for (let k = 0; k < n; k++) s += eOutX(P(t, t0 + k * BT, t0 + k * BT + d)); return s; };
// giant slam: frame 0 huge, frame 1 big, then lands; whole-frame sampled so both big frames stay crisp
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
// draw `str` centred on its ink box.
// o: x y h(cap height) w(weight) c s sx sy rot skew a sh=[dx,dy,c] stroke track
//    slices={n, off:i=>dx}  cuts the word into n horizontal bands, each shifted sideways
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
  const paint = (dx = 0) => {
    if (o.sh) { ctx.fillStyle = o.sh[2]; ctx.fillText(str, bx + o.sh[0] + dx, by + o.sh[1]); }
    if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.c; ctx.strokeText(str, bx + dx, by); }
    else { ctx.fillStyle = o.c; ctx.fillText(str, bx + dx, by); }
  };
  if (o.slices) {
    const n = o.slices.n, top = by - A - 4, hh = (A + D + 8 + (o.sh ? o.sh[1] : 0)) / n;
    for (let i = 0; i < n; i++) { ctx.save(); ctx.beginPath(); ctx.rect(-5000, top + i * hh, 10000, hh + 0.6); ctx.clip(); paint(o.slices.off(i)); ctx.restore(); }
  } else paint();
  ctx.restore(); ctx.globalAlpha = 1;
}
// 3D extrusion: n stacked copies behind the face, stepping (dx, dy) per layer
function extrude(str, o, n, dx, dy, depthC) {
  for (let k = Math.round(n); k >= 1; k--) txt(str, { ...o, x: o.x + dx * k, y: o.y + dy * k, c: depthC, sh: null, stroke: 0 });
  txt(str, o);
}
function glyphs(str, h, wt = 900, tr = 0) {
  const px = h / CAP[wt]; font(wt, px, tr);
  const m = ctx.measureText(str), mid = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
  return [...str].map((ch, i) => {
    const left = i ? ctx.measureText(str.slice(0, i)).width : 0, g = ctx.measureText(ch);
    return { ch, dx: left + (g.actualBoundingBoxRight - g.actualBoundingBoxLeft) / 2 - mid };
  });
}
const SKEW = Math.tan(-12 * D2R);
// text set around a circle, repeated to fill it (measured once at 100px, then scaled)
const CW = {};
function circleText(str, cx, cy, r, h, rot, c) {
  if (r < 8) return;
  font(900, 100); if (!CW[str]) CW[str] = [...str].map(ch => ctx.measureText(ch).width);
  const sc = h / (100 * CAP[900]), ws = CW[str], unit = ws.reduce((a, b) => a + b, 0) * sc;
  const reps = Math.max(1, Math.floor(TAU * r / unit)), k = TAU * r / (reps * unit);
  ctx.fillStyle = c; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let acc = 0;
  for (let rep = 0; rep < reps; rep++) for (let i = 0; i < ws.length; i++) {
    const w = ws[i] * sc, a = rot + (acc + w / 2) * k / r; acc += w;
    if (str[i] === ' ') continue;
    ctx.save(); ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.rotate(a + Math.PI / 2); ctx.scale(sc * k, sc); ctx.fillText(str[i], 0, 0); ctx.restore();
  }
}
// halftone type: a word sampled once into a coverage grid, drawn as dots
function makeDots(str, h, step) {
  const c = document.createElement('canvas'); c.width = 1800; c.height = Math.ceil(h * 1.6); const g = c.getContext('2d');
  g.font = `900 ${h / CAP[900]}px Mont`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const m = g.measureText(str), by = c.height / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  g.setTransform(1, 0, SKEW, 1, -SKEW * by, 0); g.fillStyle = '#000'; g.fillText(str, c.width / 2, by);
  const d = g.getImageData(0, 0, c.width, c.height).data, pts = [];
  for (let y = step / 2; y < c.height; y += step) for (let x = step / 2; x < c.width; x += step) {
    let cov = 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) cov += d[((Math.round(y + j * step / 5)) * c.width + Math.round(x + i * step / 5)) * 4 + 3];
    cov /= 25 * 255; if (cov > 0.04) pts.push([x - c.width / 2, y - c.height / 2, cov]);
  }
  return pts;
}
const DOTS = makeDots('LOUDER', 250, 17);

// ---------- shapes ----------
function bg(c) { ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); }
function circle(x, y, r, c) { if (r <= 0) return; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
function ring(x, y, r, lw, c) { if (r <= 0 || lw <= 0) return; ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
function seal(x, y, r, rot, c, n = 22, depth = 0.1) {
  if (r <= 0) return; ctx.fillStyle = c; ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot * D2R + i * Math.PI / n, rr = i % 2 ? r * (1 - depth) : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
function burst(x, y, rot, n, c, R = 2600) {
  ctx.fillStyle = c; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = rot * D2R + i * TAU / n, a1 = a0 + TAU / n / 2;
    ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a0) * R, y + Math.sin(a0) * R); ctx.lineTo(x + Math.cos(a1) * R, y + Math.sin(a1) * R); ctx.closePath();
  }
  ctx.fill();
}
function chevron(x, y, s, lw, c) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineJoin = 'miter'; ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.6); ctx.lineTo(x, y - s * 0.4); ctx.lineTo(x + s, y + s * 0.6); ctx.stroke(); }
function halftone(x0, y0, w, h, step, rFn, c) {
  ctx.fillStyle = c; ctx.beginPath();
  for (let y = y0; y < y0 + h; y += step) for (let x = x0 + ((y - y0) / step % 2) * step / 2; x < x0 + w; x += step) {
    const r = rFn(x, y); if (r > 0.3) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  }
  ctx.fill();
}
function marquee(str, y, h, speed, t, o) {
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
function halfPlane(ang, off, c, clipOnly = false) {
  const d = [Math.cos(ang), Math.sin(ang)], n = [-Math.sin(ang), Math.cos(ang)], cx = CX + n[0] * off, cy = CY + n[1] * off;
  ctx.beginPath();
  ctx.moveTo(cx - d[0] * 4000, cy - d[1] * 4000); ctx.lineTo(cx + d[0] * 4000, cy + d[1] * 4000);
  ctx.lineTo(cx + d[0] * 4000 + n[0] * 4000, cy + d[1] * 4000 + n[1] * 4000); ctx.lineTo(cx - d[0] * 4000 + n[0] * 4000, cy - d[1] * 4000 + n[1] * 4000);
  ctx.closePath(); if (clipOnly) ctx.clip(); else { ctx.fillStyle = c; ctx.fill(); }
}
function shake(t, amt) { if (amt > 0.2) { const f = Math.floor(t * 60); ctx.translate((hash(f * 2) - 0.5) * 2 * amt, (hash(f * 2 + 1) - 0.5) * 2 * amt); } }
function cam(o) { ctx.translate(CX + (o.x || 0), CY + (o.y || 0)); ctx.rotate((o.r || 0) * D2R); ctx.scale(o.s ?? 1, o.s ?? 1); ctx.translate(-CX, -CY); }

// ============================================================
// S1 0–3.2  TURN IT UP — slice reveal + 3D extruded UP whose light swings every beat
// ============================================================
function s1(t) {
  const bi = clamp(Math.floor(TH / BT + 1e-6), 0, 7), bgs = [BLUE, BLUE, BLUE, BLUE, PINK, YEL, BLUE, PINK];
  const B0 = bgs[bi], [fg, dep] = ON[B0];
  HUDC = fg;
  cam({ y: -1250 * eInX(P(t, 3.0, 3.2)) });
  bg(B0);
  if (t >= 1.2) burst(CX, CY + 160, t * 18 + 6 * kick(t, 1.2, 10), 18, rgba(fg, 0.13 * eOutX(P(t, 1.2, 1.5))));
  if (t >= 2.8) for (let i = 0; i < 6; i++) for (const sx of [260, W - 260]) chevron(sx, H + 120 - frac((t - 2.8) * 2.6 + i / 6) * (H + 300), 70, 22, dep);
  // TURN / IT: six slices fly in from alternating sides
  const up1 = eInX(P(t, 1.6, 1.85)) * 600;
  const sl = t0 => ({ n: 6, off: i => (i % 2 ? 1 : -1) * 900 * (1 - eOutX(P(t, t0 + i * 0.025, t0 + 0.32 + i * 0.025))) });
  txt('TURN', { x: CX - 190, y: 270 - up1, h: 120, c: YEL, sh: [8, 8, PINK], slices: sl(0) });
  if (t >= 0.4) txt('IT', { x: CX + 270, y: 270 - up1, h: 120, c: PINK, sh: [8, 8, YEL], slices: sl(0.4) });
  // UP: slam, then a deep extrusion whose direction swings 90° on each beat of bar 2
  const s = slam(t, 0.8, 14, 8);
  if (s > 0) {
    const e = t >= 1.6 ? kick(t, 1.6, 14) : kick(t, 0.8) * (t >= 1.2 ? 1 : 0);
    const ang = (45 + 90 * steps(t, 1.6, 4)) * D2R, n = (t < 1.0 ? 0 : 16) + 10 * e;
    extrude('UP', { x: CX + 10, y: 650 - steps(t, 1.6, 4) * 40, h: 380, c: fg, s: s * (1 + 0.08 * e), sx: 1 + 0.1 * e, sy: 1 - 0.08 * e }, n, Math.cos(ang) * 3.2, Math.sin(ang) * 3.2, dep);
  }
}

// ============================================================
// S2 3.2–6.4  COLOR vs CLASH — words cross a split line and invert colour where they cross it;
//             in bar 2 the line swings 45° per beat, sweeping the inversion through the letters
// ============================================================
function s2(t) {
  const lt = t - 3.2, A = YEL, Bc = BLUE, kk = lt >= 0.8 ? kick(t, 4.0, 11) : 0;
  const angD = -16 + 45 * steps(t, 4.8, 4, 0.22), ang = angD * D2R, off = L(1300, 0, eOutX(P(lt, 0, 0.35)));
  HUDC = INK;
  ctx.save(); cam({ s: 1 + 0.03 * kk });
  bg(A); halfPlane(ang, off, Bc);
  halftone(0, 0, 700, 420, 34, (x, y) => 11 * (1 - Math.hypot(x, y) / 760), PINK);
  halftone(W - 700, H - 420, 700, 420, 34, (x, y) => 11 * (1 - Math.hypot(W - x, H - y) / 760), PINK);
  const clash = eOutX(P(lt, 0.8, 0.95)) - eOut3(P(lt, 0.95, 1.6)) * 0.6;
  const words = [];
  glyphs('COLOR', 210).forEach((g, i) => { const q = eOutX(P(lt, 0.02 + i * 0.045, 0.5 + i * 0.045)); if (q > 0) words.push([g.ch, CX - 300 + g.dx - 1900 * (1 - q) + 50 * clash, CY - 130]); });
  glyphs('CLASH', 210).forEach((g, i) => { const q = eOutX(P(lt, 0.4 + (4 - i) * 0.045, 0.88 + (4 - i) * 0.045)); if (q > 0) words.push([g.ch, CX + 300 + g.dx + 1900 * (1 - q) - 50 * clash, CY + 130]); });
  const drawAll = (c, sh) => words.forEach(([ch, x, y]) => txt(ch, { x, y, h: 210, c, sh: [12, 12, sh], s: 1 + 0.1 * kk }));
  drawAll(Bc, PINK);                                            // over yellow: blue letters
  ctx.save(); halfPlane(ang, off, null, true); drawAll(A, PINK); ctx.restore();   // over blue: yellow letters
  const vs = pop(t, 4.0, 0.35, 2.6);
  if (vs > 0) { const r = 120 * vs * (1 + 0.15 * kk), rot = lt * 40; seal(CX + 8, CY + 12, r, rot, INK); seal(CX, CY, r, rot, PINK); txt('VS', { x: CX, y: CY, h: 70 * vs * (1 + 0.15 * kk), c: YEL, rot: -10 }); }
  for (let j = 0; j < 8; j++) {
    const t0 = 4.8 + j * BT / 2, q = P(t, t0, t0 + 0.45); if (q <= 0 || q >= 1) continue;
    circle(200 + hash(j * 7 + 1) * (W - 400), 140 + hash(j * 7 + 2) * (H - 280), (24 + 40 * hash(j * 7 + 3)) * back(q * 2.5, 2.5) * (1 - eIn3(q)), PINK);
  }
  if (lt > 3.0) halfPlane(ang, L(1300, -1300, eInX(P(lt, 3.0, 3.2))), PINK);
  ctx.restore();
}

// ============================================================
// S3 6.4–9.6  HOT — an infinite tunnel of circular text rings; the HOT sticker pops in the middle
// ============================================================
function s3(t) {
  const lt = t - 6.4, kk = kick(t, 6.4, 11);
  HUDC = INK;
  bg(PINK);
  const intro = eOutX(P(lt, 0, 0.6)), z = lt * 0.9 + Math.max(0, lt - 1.6) * 1.1 + 0.25 * kk;
  for (let k = 8; k >= -1; k--) {
    const id = k + Math.floor(z), r = 64 * Math.pow(1.6, k - frac(z)) * L(0.2, 1, intro) * (1 + 0.04 * kk);
    if (r > 1500) continue;
    circleText(id % 2 ? 'HOT  ' : 'HOT · ', CX, CY, r, r * 0.2, (id % 2 ? 1 : -1) * lt * 0.8 + id, id % 2 ? YEL : INK);
  }
  const p = pop(t, 7.2, 0.4, 2.4), ex = eInX(P(t, 9.15, 9.6));
  if (p > 0) {
    const spin = 360 * eIO(P(t, 8.0, 8.45)), s = p * (1 + 0.12 * kk) * (1 + 14 * ex), rot = -10 + spin + lt * 12;
    seal(CX + 14, CY + 16, 250 * s, rot, INK, 24); seal(CX, CY, 250 * s, rot, YEL, 24);
    ring(CX, CY, 198 * s, 6 * s, PINK);
    txt('HOT', { x: CX, y: CY, h: 150 * s, c: PINK, rot: -8 + spin, a: 1 - P(ex, 0.2, 0.5) });
    if (t >= 7.6) txt('100%', { x: CX + 30 * s, y: CY + 122 * s, h: 34 * s, w: 800, c: INK, rot: -8 + spin, a: (1 - P(ex, 0.1, 0.3)) * pop(t, 7.6, 0.25) });
  }
  if (ex > 0.55) bg(YEL);
}

// ============================================================
// S4 9.6–11.2  BREAK — quiet, small, lots of empty space
// ============================================================
function s4(t) {
  HUDC = INK; bg(YEL);
  for (const [w, x, t0] of [['WAIT', -280, 9.6], ['FOR', 0, 10.0], ['IT', 200, 10.4]]) {
    const q = P(t, t0, t0 + 0.3); if (q > 0) txt(w, { x: CX + x, y: L(-60, CY, back(q, 1.3)), h: 64, c: INK, rot: L(-16, 0, eOut3(q)) });
  }
  for (let i = 0; i < 3; i++) circle(CX + 290 + i * 34, CY + 26, 9 * pop(t, 10.8 + i * 0.133, 0.2, 3), PINK);
  const a = 26 * Math.sin(Math.PI * (t - 9.6) / BT) * eOut3(P(t, 9.6, 9.9));
  ctx.save(); ctx.translate(CX, CY + 250); ctx.rotate(a * D2R);
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -120); ctx.stroke(); circle(0, -90, 14, PINK);
  ctx.restore(); ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(CX - 40, CY + 262); ctx.lineTo(CX + 40, CY + 262); ctx.lineTo(CX, CY + 230); ctx.fill();
}

// ============================================================
// S5 11.2–12.8  BUILD — halftone LOUDER: dots swell from specks to solid type as the strobe speeds up
// ============================================================
function s5(t) {
  const lt = t - 11.2, lh = TH - 11.2 + 1e-6;
  if (lh >= 1.4) { HUDC = YEL; bg(INK); return; }
  const k = lh < 0.8 ? Math.floor(lh / 0.4) : lh < 1.2 ? 2 + Math.floor((lh - 0.8) / 0.2) : 4 + Math.floor((lh - 1.2) / 0.1);
  const c = [BLUE, PINK, YEL, INK][k % 4], fg = ON[c][0]; HUDC = fg;
  bg(c);
  const q = eIn3(P(lt, 0, 1.4)), sp = lt + 1.2 * q * q;
  for (let j = 0; j < 6; j++) { const r = 1300 * frac(j / 6 - sp * 0.9); ring(CX, CY, r, 4 + 30 * (r / 1300), rgba(fg, 0.3)); }
  const grow = L(0.42, 1.08, q) * (1 + 0.25 * kick(t, 11.2, 10, lh < 0.8 ? 0.4 : lh < 1.2 ? 0.2 : 0.1));
  const sc = L(0.7, 1.15, q), jx = (hash(k * 3) - 0.5) * 30 * q, jy = (hash(k * 3 + 1) - 0.5) * 30 * q;
  ctx.fillStyle = fg; ctx.beginPath();
  for (const [x, y, cov] of DOTS) {
    const r = 17 / 2 * 1.15 * cov * grow * (0.75 + 0.25 * Math.sin(x / 60 - lt * 14)); if (r < 0.4) continue;
    const px = CX + jx + x * sc, py = CY + jy + y * sc; ctx.moveTo(px + r * sc, py); ctx.arc(px, py, r * sc, 0, TAU);
  }
  ctx.fill();
}

// ============================================================
// S6 12.8–19.2  DROP — BOOM / BOUNCE / CLAP / SHAKE
// ============================================================
function s6a(t) { // BOOM: slam, then the word wobbles in horizontal slices on every kick
  const lt = t - 12.8, kk = kick(t, 12.8, 9), ex = eInX(P(lt, 1.42, 1.62));
  HUDC = YEL;
  ctx.save(); cam({ x: -2200 * ex }); shake(t, 14 * kick(t, 12.8, 14));
  bg(BLUE);
  burst(CX, CY, lt * 25 + 10 * Math.floor(lt / BT), 20, rgba(INK, 0.16));
  for (let k = 0; k < 4; k++) { const d = t - (12.8 + k * BT); if (d < 0 || d > 0.7) continue; const q = eOut3(d / 0.7); ring(CX, CY, L(80, 1150, q), L(46, 2, q), k % 2 ? YEL : PINK); }
  const s = slam(t, 12.8, 18, 10), beat = Math.floor((t - 12.8) / BT);
  txt('BOOM', { x: CX, y: CY + 12, h: 260, c: YEL, sh: [18, 18, PINK], s: s * (1 + 0.06 * kk),
    slices: { n: 9, off: i => Math.sin(i * 1.4 + beat * 2.1) * 110 * kk * (t > 12.9 ? 1 : 0) } });
  ctx.restore();
}
function s6b(t) { // BOUNCE: rubber letters — stretch on the way up, squash on landing, pink echo trails
  const lt = t - 14.4, en = eOutX(P(lt, -0.15, 0.1)), ex = eInX(P(lt, 1.35, 1.6));
  HUDC = INK;
  ctx.save(); cam({ x: 2200 * (1 - en), r: -50 * ex, s: L(1, 0.4, ex), y: 260 * ex });
  bg(YEL);
  halftone(0, 0, W, H, 46, (x, y) => 9 + 7 * Math.sin(x / 140 + y / 110 - lt * 6), rgba(PINK, 0.3));
  const base = CY + 150; ctx.fillStyle = INK; ctx.fillRect(140, base + 108, W - 280, 10);
  const pos = ph => { const u = frac(ph), h = 4 * u * (1 - u); return { u, h, y: base - 280 * h }; };
  glyphs('BOUNCE', 210).forEach((g, i) => {
    const ph = lt / BT - i * 0.12; if (ph < 0) return;
    const x = CX + g.dx * 1.08, { u, h, y } = pos(ph), speed = Math.abs(1 - 2 * u), contact = Math.exp(-u * 18) + Math.exp(-(1 - u) * 18);
    ctx.fillStyle = rgba(INK, 0.25 * (1 - h * 0.7)); ctx.beginPath(); ctx.ellipse(x, base + 104, 70 * (1 - h * 0.5), 12, 0, 0, TAU); ctx.fill();
    for (let e = 3; e >= 1; e--) { if (ph - e * 0.07 > 0) txt(g.ch, { x, y: pos(ph - e * 0.07).y, h: 210, c: PINK, stroke: 3, a: 0.6 - e * 0.15 }); }
    const st = 1 + 0.3 * speed * (1 - contact), sq = 0.24 * contact;
    txt(g.ch, { x, y: y + 40 * contact - 30 * (st - 1), h: 210, c: BLUE, sh: [10, 10, PINK], sx: (1 + sq) / Math.sqrt(st), sy: (1 - sq) * st, s: back(P(ph, 0, 0.5), 2) });
  });
  ctx.restore();
}
function s6c(t) { // CLAP: two yellow panels slam shut like hands on 2 and 4, then spring open on CLAP!
  const lt = t - 16.0, ex = eInX(P(lt, 1.42, 1.6));
  HUDC = INK;
  ctx.save(); cam({ s: 1 + 7 * ex });
  bg(PINK);
  for (let i = 0; i < 4; i++) marquee('CLAP  CLAP  CLAP  ', 150 + i * 260, 140, (i % 2 ? 1 : -1) * 220, lt, { c: rgba(INK, 0.2), stroke: 3 });
  const hits = [16.4, 17.2], last = hits.filter(h => t >= h).pop();
  if (last) {
    const d = t - last, side = last === 16.4 ? -1 : 1, q = eOutX(P(d, 0, 0.12)), kk = kick(t, 16.0, 12);
    ctx.save(); ctx.translate(CX, CY); ctx.strokeStyle = rgba(YEL, Math.exp(-d * 5)); ctx.lineWidth = 12;
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16 + 0.1, r0 = 420 + 200 * eOut3(P(d, 0, 0.4)); ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * 0.7); ctx.lineTo(Math.cos(a) * (r0 + 160), Math.sin(a) * (r0 + 160) * 0.7); ctx.stroke(); }
    ctx.restore();
    txt('CLAP!', { x: CX + side * 40, y: CY, h: 280, c: YEL, sh: [18, 18, INK], rot: side * 7, s: L(1.6, 1, q) * (1 + 0.06 * kk) });
    const b = pop(t, last + 0.05, 0.3, 3);
    seal(CX + side * 520, CY - 230, 95 * b, t * 60, INK, 16, 0.16); txt(last === 16.4 ? 'x1' : 'x2', { x: CX + side * 520, y: CY - 230, h: 54 * b, c: YEL });
  } else txt('CLAP', { x: CX, y: CY, h: 120, c: INK, stroke: 4, s: pop(t, 16.0, 0.25) });
  // the hands: close over the 0.14s before each hit, open again after it
  for (const h of hits) {
    const close = eIn3(P(t, h - 0.14, h)), open = eOutX(P(t, h + 0.02, h + 0.3)), g = close * (1 - open);
    if (g <= 0.001) continue;
    const hh = (H / 2) * g;
    ctx.fillStyle = YEL; ctx.fillRect(0, 0, W, hh); ctx.fillRect(0, H - hh, W, hh);
    ctx.fillStyle = INK; ctx.fillRect(0, hh - 14, W, 14); ctx.fillRect(0, H - hh, W, 14);
    ctx.fillStyle = PINK; for (let i = 0; i < 9; i++) { ctx.fillRect(120 + i * 210, hh - 60, 90, 24); ctx.fillRect(120 + i * 210, H - hh + 36, 90, 24); }
  }
  ctx.restore();
}
function s6d(t) { // SHAKE: glitch — every letter is cut into bands that jump sideways on each 16th, pink/blue ghosts
  const lt = t - 17.6, step = Math.floor(t / 0.1), amp = L(1, 2.6, eIn3(P(lt, 1.2, 1.6))), kk = kick(t, 17.6, 12);
  HUDC = YEL;
  ctx.save(); shake(t, (5 + 8 * kk) * amp);
  bg(INK);
  for (let i = 0; i < 5; i++) marquee('SHAKE IT  SHAKE IT  ', 110 + i * 215, 120, (i % 2 ? 1 : -1) * 520, lt, { c: rgba(BLUE, 0.7), stroke: 3 });
  glyphs('SHAKE', 270).forEach((g, i) => {
    const jx = (hash(step * 11 + i) - 0.5) * 30 * amp, jy = (hash(step * 13 + i) - 0.5) * 30 * amp, jr = (hash(step * 17 + i) - 0.5) * 12 * amp;
    const o = { x: CX + g.dx * 1.06 + jx, y: CY + jy, h: 270, rot: jr, s: pop(t, 17.6 + i * 0.04, 0.25, 2.2) * (1 + 0.1 * kk),
      slices: { n: 6, off: b => (hash(step * 31 + i * 7 + b) - 0.5) * 70 * amp * (hash(step * 5 + b) > 0.45 ? 1 : 0) } };
    txt(g.ch, { ...o, x: o.x - 16 * amp, c: PINK }); txt(g.ch, { ...o, x: o.x + 16 * amp, c: BLUE }); txt(g.ch, { ...o, c: YEL });
  });
  ctx.restore();
}

// ============================================================
// S7 19.2–20.8  STOP (squashed flat with the tape stop) — silence — ONE MORE TIME (split-flap)
// ============================================================
function s7(t) {
  HUDC = YEL; bg(INK);
  const s = slam(t, 19.2, 18, 10);
  if (t < 19.65) { const d = eIn3(P(t, 19.28, 19.6)); txt('STOP', { x: CX, y: CY + 180 * d, h: 280, c: YEL, sh: [16, 16, PINK], s, sy: 1 - 0.96 * d, sx: 1 + 0.2 * d }); }
  const zoom = eInX(P(t, 20.6, 20.8));
  ctx.save(); cam({ s: 1 + 9 * zoom });
  [['ONE', YEL, -270, 20.0], ['MORE', PINK, 0, 20.2], ['TIME', YEL, 270, 20.4]].forEach(([w, c, dy, t0], i) => {
    if (t < t0) return;
    // split-flap: the top half flips down onto the bottom half
    const q = P(t, t0, t0 + 0.14), fl = Math.cos(Math.PI * (1 - eOut3(q))), y = CY + dy;
    const o = { x: CX + (i - 1) * 60, y, h: 210, c, s: 1 + 0.08 * kick(t, t0, 14, 9) };
    ctx.save(); ctx.beginPath(); ctx.rect(0, y, W, 400); ctx.clip(); txt(w, o); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(0, y - 400, W, 400); ctx.clip();
    ctx.translate(0, y); ctx.scale(1, Math.max(0.001, Math.abs(fl))); ctx.translate(0, -y);
    if (fl > 0) txt(w, o); else { ctx.fillStyle = rgba(c, 0.25); ctx.fillRect(o.x - 300, y - 150, 600, 150); }
    ctx.restore();
    ctx.fillStyle = INK; ctx.fillRect(o.x - 420, y - 3, 840, 6);
  });
  ctx.restore();
  const fl = eIn3(P(t, 20.62, 20.8)); if (fl > 0) { ctx.fillStyle = rgba(YEL, fl); ctx.fillRect(0, 0, W, H); }
}

// ============================================================
// S8 20.8–27.2  DROP 2 — text drum / flip tiles / iris colour cuts / stripe-inverted type
// ============================================================
function s8a(t) { // LOUDER rows wrapped round a rolling drum that turns one row per beat
  const lt = t - 20.8, kk = kick(t, 20.8, 12), ex = eInX(P(lt, 1.4, 1.6));
  HUDC = YEL;
  ctx.save(); cam({ y: -1250 * ex }); shake(t, 10 * kk);
  bg(BLUE);
  const roll = steps(t, 20.8, 4, 0.2) + lt * 0.15, R = 560, s = slam(t, 20.8, 6, 3);
  ctx.save(); cam({ s });
  for (let j = Math.floor(roll) - 5; j <= Math.floor(roll) + 5; j++) {
    const th = (j - roll) * 0.4, cs = Math.cos(th); if (cs < 0.06) continue;
    const y = CY + R * Math.sin(th), front = Math.abs(j - roll) < 0.5;
    ctx.save(); ctx.translate(0, y); ctx.scale(1, cs * (front ? 1 + 0.12 * kk : 1)); ctx.globalAlpha = 0.35 + 0.65 * cs * cs;
    marquee('LOUDER  LOUDER  ', 0, 200, (j % 2 ? 1 : -1) * 300, lt, front ? { c: YEL, a: 0.35 + 0.65 * cs * cs } : { c: j % 2 ? PINK : YEL, stroke: 4, a: 0.35 + 0.65 * cs * cs });
    ctx.restore();
  }
  ctx.restore();
  const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, rgba(INK, 0.55)); gr.addColorStop(0.3, rgba(INK, 0)); gr.addColorStop(0.7, rgba(INK, 0)); gr.addColorStop(1, rgba(INK, 0.55));
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const fl = Math.exp(-(t - 20.8) * 10); if (fl > 0.01) { ctx.fillStyle = rgba(YEL, fl); ctx.fillRect(0, 0, W, H); }
}
function s8b(t) { // four tiles flip over like cards, one per beat, then rotate one slot clockwise
  const lt = t - 22.4, kk = kick(t, 22.4, 12);
  HUDC = YEL; bg(INK);
  const panels = [[PINK, 'FEEL', INK], [BLUE, 'IT', YEL], [YEL, 'IN', BLUE], [PINK, 'COLOR', YEL]];
  const slots = [[0, 0], [1, 0], [1, 1], [0, 1]], rq = eIO(P(lt, 1.2, 1.5));
  panels.forEach(([c, w, tc], i) => {
    const q = P(lt, i * BT, i * BT + 0.3); if (q <= 0) return;
    const a = slots[i], b = slots[(i + 1) % 4], x = L(a[0], b[0], rq) * W / 2, y = L(a[1], b[1], rq) * H / 2;
    const fx = Math.cos(Math.PI * (1 - back(q, 1.6))), pcx = x + W / 4;
    ctx.save(); ctx.translate(pcx, 0); ctx.scale(Math.max(0.001, Math.abs(fx)), 1); ctx.translate(-pcx, 0);
    ctx.beginPath(); ctx.rect(x + 6, y + 6, W / 2 - 12, H / 2 - 12); ctx.clip();
    if (fx < 0) { bg(c); ctx.restore(); return; }   // the card's back: plain colour, no text
    bg(c);
    const on = i === Math.floor(lt / BT) % 4;
    txt(w, { x: x + W / 4, y: y + H / 4, h: w.length > 3 ? 120 : 150, c: tc, sh: [10, 10, rgba(INK, 0.35)], s: 1 + (on ? 0.18 * kk : 0) });
    ctx.restore();
  });
}
function s8c(t) { // PINK / BLUE / GOLD burst open from a circle; CLASH! splits into three bands
  const lt = t - 24.0, i = clamp(Math.floor((TH - 24.0) / BT + 1e-6), 0, 3), d = lt - i * BT;
  const cols = [[PINK, 'PINK', YEL], [BLUE, 'BLUE', YEL], [YEL, 'GOLD', BLUE]];
  if (i < 3) {
    const [c, w, tc] = cols[i]; HUDC = tc;
    bg(i > 0 ? cols[i - 1][0] : INK);
    circle(CX, CY, 1200 * eOutX(P(d, 0, 0.16)), c);
    for (let j = 0; j < 10; j++) { const a = j * TAU / 10 + lt, r = 430 + 40 * Math.sin(lt * 8 + j); circle(CX + Math.cos(a) * r * 1.3, CY + Math.sin(a) * r * 0.75, 18 * pop(t, 24.0 + i * BT + 0.2, 0.2, 3), tc); }
    const q = eOutX(P(d, 0, 0.14));
    txt(w, { x: CX, y: CY, h: 330, c: tc, sh: [18, 18, INK], s: L(1.5, 1, q) * (1 + 0.05 * Math.exp(-d * 10)), rot: i % 2 ? 5 : -5 });
  } else {
    HUDC = INK; bg(YEL);
    const bw = W / 3;
    for (let j = 0; j < 3; j++) {
      const q = eOutX(P(d, j * 0.04, j * 0.04 + 0.2)), dy = (j % 2 ? -1 : 1) * H * (1 - q);
      ctx.save(); ctx.beginPath(); ctx.rect(j * bw, dy, bw + 1, H); ctx.clip(); bg(TRIO[j]);
      txt('CLASH!', { x: CX, y: CY, h: 300, c: TRIO[(j + 2) % 3], sh: [16, 16, INK], s: 1 + 0.06 * Math.exp(-d * 10), rot: -4 });
      ctx.restore();
    }
  }
}
function s8d(t) { // stripes of the three colours slide; ALL AT ONCE changes colour inside every stripe
  const lt = t - 25.6, ex = eInX(P(lt, 1.3, 1.6)), kk = kick(t, 25.6, 12);
  HUDC = INK;
  ctx.save(); cam({ r: -70 * ex, s: L(1, 0.15, ex) });
  const n = 12, sw = W / n, shift = Math.floor((TH - 25.6) / BT + 1e-6);
  const words = [];
  if (t >= 25.6) words.push(['ALL', { x: CX - 240, y: CY - 170, h: 160, s: L(1.7, 1, eOutX(P(t, 25.6, 25.72))) * (1 + 0.06 * kk) }]);
  if (t >= 26.0) words.push(['AT', { x: CX + 250, y: CY - 170, h: 160, s: L(1.7, 1, eOutX(P(t, 26.0, 26.12))) * (1 + 0.06 * kk) }]);
  const s = slam(t, 26.4, 12, 7); if (s > 0) words.push(['ONCE', { x: CX, y: CY + 130, h: 290, s: s * (1 + 0.08 * kk) }]);
  for (let j = 0; j < n; j++) {
    const ci = (j + shift) % 3, y = Math.sin(lt * 7 + j * 0.9) * 60 * (j % 2 ? 1 : -1);
    ctx.save(); ctx.beginPath(); ctx.rect(j * sw - 0.5, y - 200, sw + 1, H + 400); ctx.clip();
    ctx.fillStyle = TRIO[ci]; ctx.fillRect(j * sw - 1, y - 200, sw + 2, H + 400);
    for (const [w, o] of words) txt(w, { ...o, c: TRIO[(ci + 2) % 3], sh: [14, 14, INK] });
    ctx.restore();
  }
  ctx.restore();
}

// ============================================================
// S9 27.2–30  COLOR CLASH title card: extruded logo, final hit, collapse
// ============================================================
const CONF = Array.from({ length: 36 }, (_, i) => ({ a: hash(i * 5 + 1) * TAU, v: 700 + 900 * hash(i * 5 + 2), r: 10 + 18 * hash(i * 5 + 3), c: [YEL, BLUE, INK][i % 3] }));
function s9(t) {
  const lt = t - 27.2, kk = kick(t, 27.2, 12), fin = t >= 28.8 ? Math.exp(-(t - 28.8) * 8) : 0, out = eInX(P(t, 29.35, 29.8));
  HUDC = YEL; bg(PINK);
  burst(CX, CY, lt * 14, 22, rgba(YEL, 0.14 + 0.3 * fin));
  ctx.save();
  const q = eOutX(P(lt, 0, 0.5));
  cam({ r: L(40, 0, q) - 4 - 300 * out, s: L(0.5, 1, q) * (1 + 0.05 * kk + 0.2 * fin) * (1 - out), x: -110 * (1 - q), y: 250 * (1 - q) });
  const depth = 8 + 6 * kk + 18 * fin, ang = (40 + 60 * Math.sin(lt * 1.3)) * D2R;
  extrude('COLOR', { x: CX - 20, y: CY - 125, h: 200, c: YEL }, depth, Math.cos(ang) * 3, Math.sin(ang) * 3, INK);
  extrude('CLASH', { x: CX + 20, y: CY + 125, h: 200, c: BLUE }, depth, Math.cos(ang) * 3, Math.sin(ang) * 3, INK);
  const b = pop(t, 27.6, 0.35, 2.6);
  seal(CX + 440, CY + 240, 95 * b, lt * 40, INK, 18, 0.14); seal(CX + 432, CY + 232, 95 * b, lt * 40, YEL, 18, 0.14);
  txt('Nº02', { x: CX + 432, y: CY + 232, h: 42 * b, c: PINK, rot: -10 });
  const tg = pop(t, 28.0, 0.3);
  if (tg > 0) { ctx.save(); ctx.translate(CX - 420, CY - 270); ctx.rotate(-8 * D2R); ctx.scale(tg, tg); ctx.fillStyle = INK; ctx.fillRect(-130, -32, 260, 64); ctx.restore(); txt('STUDY', { x: CX - 420, y: CY - 270, h: 34 * tg, w: 800, c: YEL, rot: -8, skew: 0, track: 0.12 }); }
  ctx.restore();
  if (t >= 28.8) { const d = t - 28.8; for (const p of CONF) circle(CX + Math.cos(p.a) * p.v * d, CY + Math.sin(p.a) * p.v * d + 900 * d * d, p.r * (1 - P(d, 0.6, 1.1)), p.c); }
}

// ---------- timeline: [start, end, scene, z] (z: higher draws later) ----------
const SCENES = [
  [0, 3.2, s1, 2], [3.0, 6.4, s2, 1], [6.4, 9.6, s3, 1], [9.6, 11.2, s4, 1], [11.2, 12.8, s5, 1],
  [12.8, 14.45, s6a, 2], [14.25, 16.0, s6b, 3], [15.8, 16.0, s6c, 1], [16.0, 17.6, s6c, 2], [17.4, 17.6, s6d, 1], [17.6, 19.2, s6d, 1],
  [19.2, 20.8, s7, 1], [20.8, 22.4, s8a, 2], [22.2, 24.0, s8b, 1], [24.0, 25.6, s8c, 1], [25.6, 27.2, s8d, 2], [26.9, 30, s9, 1],
];

function hud() {
  const c = HUDC;
  txt('COLOR CLASH', { x: 120, y: 34, h: 13, w: 500, c, skew: 0, track: 0.06 });
  txt('STUDY Nº02', { x: W - 100, y: 34, h: 13, w: 500, c, skew: 0, track: 0.06 });
  txt('COLOR CLASH', { x: 120, y: H - 34, h: 13, w: 500, c, skew: 0, track: 0.06 });
  txt('STUDY Nº02', { x: W - 100, y: H - 34, h: 13, w: 500, c, skew: 0, track: 0.06 });
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(CX - 96, H - 39, 192, 39, [5, 5, 0, 0]); ctx.fill();
  txt('CLAUDE', { x: CX, y: H - 19, h: 14, w: 800, c: YEL, skew: 0, track: 0.08 });
}

function draw(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  bg(INK); TH = Math.round(t * FPS) / FPS;
  const act = SCENES.filter(([a, b]) => TH >= a - 1e-6 && TH < b - 1e-6).sort((u, v) => u[3] - v[3]);
  for (const [, , fn] of act) { ctx.save(); fn(t); ctx.restore(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; }
  hud();
  const blk = P(t, 29.8, 30); if (blk > 0) { ctx.fillStyle = rgba(INK, blk); ctx.fillRect(0, 0, W, H); }
}

window.setTime = t => draw(clamp(t, 0, DUR - 1e-4));
// motion blur: SUB samples across a 180° shutter, running average on the GPU, one PNG out
const acc = document.createElement('canvas'); acc.width = W; acc.height = H; const actx = acc.getContext('2d');
window.renderFrame = (f, SUB) => {
  for (let k = 0; k < SUB; k++) { window.setTime((f - 0.25 + (k + 0.5) * 0.5 / SUB) / FPS); actx.globalAlpha = 1 / (k + 1); actx.drawImage(cv, 0, 0); }
  actx.globalAlpha = 1; return acc.toDataURL('image/png').slice(22);
};
if (!location.search.includes('render')) { const t0 = performance.now(); const loop = () => { draw(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); }
