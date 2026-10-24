'use strict';
// 产品宣传片 — 30s, 1920x1080, 120 BPM (beat 0.5s = 15 frames, bar 2s).
// Screen recording (browser + OBS cropped away) shown in a clean rounded window; every camera move
// (push-in, pan, whip) starts on a beat. Between footage shots: kinetic type cards.
// Palette = the product's own: lavender, brand purple, ink, white.
// Footage frames: ../out/footage/NNNNN.jpg, frame n = source time 1.0 + (n-1)/30 (1102x620 crop).

const W = 1920, H = 1080, CX = W / 2, CY = H / 2, FPS = 30, DUR = 30, BT = 0.5, D2R = Math.PI / 180, TAU = Math.PI * 2;
const PUR = '#5B3DF5', LAV = '#E9E5FF', INK = '#121018', WHITE = '#FFFFFF';
const FW = 1102, FH = 620, BASEK = 1500 / FW;          // footage size; window is 1500 px wide at zoom 1
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let TH = 0;

// ---------- maths ----------
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const L = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const eOut3 = t => 1 - Math.pow(1 - t, 3), eIn3 = t => t * t * t;
const eOutX = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)), eInX = t => (t <= 0 ? 0 : Math.pow(2, 10 * (t - 1)));
const eIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eIOX = t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2);
const back = (t, s = 1.7) => { if (t <= 0) return 0; if (t >= 1) return 1; t -= 1; return t * t * ((s + 1) * t + s) + 1; };
const hash = n => { let h = Math.imul(n | 0, 2654435761) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };
const since = (t, from = 0, step = BT) => (t < from ? 99 : (t - from) % step);
const kick = (t, from = 0, k = 12, step = BT) => Math.exp(-since(t, from, step) * k);
const pop = (t, t0, d = 0.3, s = 2.2) => back(P(t, t0, t0 + d), s);
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${clamp(a)})`; };
const slam = (t, t0, b0 = 5, b1 = 2.6) => { const f = Math.round(t * FPS) - Math.round(t0 * FPS); if (f < 0) return 0; if (f === 0) return b0; if (f === 1) return b1; return 1 + 0.08 * Math.exp(-(t - t0 - 2 / FPS) * 14); };

// ---------- footage ----------
// segments: [t0, t1, src0, src1] (linear time remap; speed = (src1-src0)/(t1-t0))
const SEGS = [
  [4.0, 9.5, 1.1, 6.6], [9.5, 10.0, 6.6, 7.1],                         // home: paste → click
  [12.0, 12.5, 7.0, 8.5], [12.5, 13.5, 8.5, 10.5], [13.5, 15.0, 13.9, 15.4], [15.0, 16.0, 15.4, 19.4], // parse → copy text
  [16.0, 17.0, 24.75, 25.75], [17.0, 18.0, 28.25, 29.25],               // download (browser panel cut out)
  [20.0, 22.0, 34.2, 36.2], [22.0, 24.0, 39.4, 41.4],                   // guide, FAQ
];
function srcAt(t) {
  const f = ([a, b, s0, s1]) => clamp(L(s0, s1, (t - a) / (b - a)), 1.0, 43.4);
  for (const s of SEGS) if (t >= s[0] && t < s[1]) return f(s);
  for (const s of SEGS) if (t >= s[0] - 0.5 && t < s[1] + 0.3) return f(s);   // a little either side, for transitions
  return null;
}
const fidx = s => Math.round((s - 1.0) * 30) + 1;
const IMG = new Map();
function load(i) {
  if (IMG.has(i)) return IMG.get(i).p;
  const im = new Image(), p = new Promise(r => { im.onload = r; im.onerror = r; });
  im.src = `../out/footage/${String(i).padStart(5, '0')}.jpg`; IMG.set(i, { im, p });
  if (IMG.size > 90) IMG.delete(IMG.keys().next().value);
  return p;
}
const frameAt = t => { const s = srcAt(t); if (s === null) return null; const e = IMG.get(fidx(s)); return e && e.im.complete ? e.im : null; };

// camera keyframes per footage shot: {t, z, x, y, r, d} — each move starts at t and eases over d
function camAt(keys, t) {
  let v = { ...keys[0] };
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i], q = (k.ease || eIOX)(P(t, k.t, k.t + (k.d ?? 0.45)));
    for (const p of ['z', 'x', 'y', 'r', 'ox', 'oy']) if (k[p] !== undefined) v[p] = L(v[p] ?? 0, k[p], q);
  }
  return v;
}
// draw the footage window with camera v (z zoom, x/y = footage point at screen centre, r tilt, ox/oy screen offset)
function footage(t, v, o = {}) {
  const img = frameAt(t), k = BASEK * v.z * (1 + 0.012 * kick(t, 0, 10));
  ctx.save(); ctx.translate(CX + (v.ox || 0), CY + (v.oy || 0)); ctx.rotate((v.r || 0) * D2R); ctx.scale(k, k); ctx.translate(-v.x, -v.y);
  const rad = 22 / BASEK;
  ctx.shadowColor = 'rgba(40,20,120,0.35)'; ctx.shadowBlur = 60 / k * BASEK; ctx.shadowOffsetY = 24 / k * BASEK;
  ctx.fillStyle = WHITE; ctx.beginPath(); ctx.roundRect(0, 0, FW, FH, rad); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, FW, FH, rad); ctx.clip(); if (img) ctx.drawImage(img, 0, 0, FW, FH); ctx.restore();
  ctx.strokeStyle = 'rgba(91,61,245,0.25)'; ctx.lineWidth = 2 / k; ctx.beginPath(); ctx.roundRect(0, 0, FW, FH, rad); ctx.stroke();
  if (o.marks) o.marks(k);
  ctx.restore();
  return { k, map: (x, y) => { const c = Math.cos((v.r || 0) * D2R), s = Math.sin((v.r || 0) * D2R), dx = (x - v.x) * k, dy = (y - v.y) * k; return [CX + (v.ox || 0) + dx * c - dy * s, CY + (v.oy || 0) + dx * s + dy * c]; } };
}

// ---------- type ----------
const CAP = {};
function font(w, px, tr = 0) { ctx.font = `${w} ${px}px NSC`; ctx.letterSpacing = tr + 'px'; }
for (const w of [500, 900]) { font(w, 100); CAP[w] = ctx.measureText('国').actualBoundingBoxAscent / 100; }
function txt(str, x, y, size, o = {}) {
  const s = o.s ?? 1, a = o.a ?? 1; if (s <= 0.001 || a <= 0.001) return 0;
  font(o.w || 900, size, o.tr || 0); ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
  const wd = ctx.measureText(str).width;
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot * D2R); ctx.scale(s * (o.sx ?? 1), s * (o.sy ?? 1)); ctx.globalAlpha = a;
  if (o.clipUp !== undefined) { ctx.beginPath(); ctx.rect(-wd, -size * 0.62, wd * 2, size * 1.24); ctx.clip(); ctx.translate(0, size * 1.2 * (1 - o.clipUp)); }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.sw || 3; ctx.strokeStyle = o.stroke; ctx.strokeText(str, 0, size * 0.04); }
  if (o.c) { ctx.fillStyle = o.c; ctx.fillText(str, 0, size * 0.04); }
  ctx.restore(); ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
  return wd * s;
}
// per-character reveal: each char rises out of a mask, staggered
function rise(str, x, y, size, t0, t, o = {}) {
  font(o.w || 900, size, o.tr || 0); const chars = [...str], ws = chars.map(c => ctx.measureText(c).width + (o.tr || 0)), total = ws.reduce((a, b) => a + b, 0);
  let cx = o.align === 'left' ? x : x - total / 2;
  chars.forEach((ch, i) => { const q = eOutX(P(t, t0 + i * (o.st ?? 0.035), t0 + i * (o.st ?? 0.035) + 0.45)); txt(ch, cx + ws[i] / 2, y, size, { ...o, clipUp: q, align: 'center', tr: 0 }); cx += ws[i]; });
  return total;
}
// several coloured pieces on one centred line; returns [x0, width] of each piece
function riseLine(parts, y, size, t) {
  font(900, size); const ws = parts.map(([str]) => [...str].reduce((a, c) => a + ctx.measureText(c).width, 0)), gap = size * 0.12;
  let x = CX - (ws.reduce((a, b) => a + b, 0) + gap * (parts.length - 1)) / 2; const boxes = [];
  parts.forEach(([str, c, t0], i) => { rise(str, x, y, size, t0, t, { c, align: 'left' }); boxes.push([x, ws[i]]); x += ws[i] + gap; });
  return boxes;
}
// the site's purple corner brackets around a box
function brackets(x, y, w, h, q, c = PUR, lw = 5, len = 26) {
  if (q <= 0) return; const ox = (1 - q) * 40, oy = (1 - q) * 30; ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.globalAlpha = clamp(q * 2);
  [[x - ox, y - oy, 1, 1], [x + w + ox, y - oy, -1, 1], [x - ox, y + h + oy, 1, -1], [x + w + ox, y + h + oy, -1, -1]].forEach(([px, py, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(px, py + sy * len); ctx.lineTo(px, py); ctx.lineTo(px + sx * len, py); ctx.stroke(); });
  ctx.globalAlpha = 1;
}
// callout pill: pops near (x, y)
function pill(str, x, y, t0, t, o = {}) {
  const q = pop(t, t0, 0.35, 2.4), out = o.out ? eIn3(P(t, o.out, o.out + 0.2)) : 0; if (q <= 0 || out >= 1) return;
  const size = o.size || 46; font(900, size); const w = ctx.measureText(str).width + size * 1.3, h = size * 1.75;
  ctx.save(); ctx.translate(x, y); ctx.scale(q * (1 - out), q * (1 - out)); ctx.rotate((o.rot || 0) * D2R);
  ctx.shadowColor = 'rgba(40,20,120,0.35)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  ctx.fillStyle = o.bg || PUR; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.restore();
  txt(str, x, y, size, { c: o.fg || WHITE, s: q * (1 - out), rot: o.rot || 0 });
}
function ring(x, y, t0, t, c = PUR) { const q = P(t, t0, t0 + 0.5); if (q <= 0 || q >= 1) return; ctx.strokeStyle = rgba(c, 1 - q); ctx.lineWidth = 8 * (1 - q) + 1; ctx.beginPath(); ctx.arc(x, y, 20 + 110 * eOut3(q), 0, TAU); ctx.stroke(); circle(x, y, 18 * (1 - q), rgba(c, 0.8)); }
function circle(x, y, r, c) { if (r <= 0) return; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }

// ---------- backgrounds ----------
function lavender(t, k = 1) {
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#F4F2FF'); g.addColorStop(0.5, '#E3DEFF'); g.addColorStop(1, '#F1EEFF');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 5; i++) {
    const x = CX + Math.cos(t * 0.5 + i * 1.7) * 700, y = CY + Math.sin(t * 0.4 + i * 2.3) * 380, r = 420 + 120 * Math.sin(t + i);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, rgba(i % 2 ? '#8E7BFF' : '#B9ACFF', 0.38 * k)); rg.addColorStop(1, 'rgba(185,172,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.strokeStyle = 'rgba(91,61,245,0.07)'; ctx.lineWidth = 1; for (let x = (t * 20) % 80; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}
function bg(c) { ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); }
function cam(o) { ctx.translate(CX + (o.x || 0), CY + (o.y || 0)); ctx.rotate((o.r || 0) * D2R); ctx.scale(o.s ?? 1, o.s ?? 1); ctx.translate(-CX, -CY); }

const PLATS = ['抖音', '快手', '小红书', '哔哩哔哩', '微博', '视频号', '西瓜视频', '知乎', '微信公众号', '网易云音乐'];

// ============================================================ scenes
// A 0–2  hook: 刷到好视频 → 想保存却有水印？ → the watermark gets wiped off
function sA(t) {
  lavender(t);
  // a phone-ish video card on the right
  const cq = eOutX(P(t, 0.25, 0.7)), cx = L(2300, 1320, cq), cy = CY + 20;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(L(14, 6, cq) * D2R);
  ctx.shadowColor = 'rgba(40,20,120,0.4)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(-230, -400, 460, 800, 46); ctx.fill(); ctx.shadowColor = 'transparent';
  const gg = ctx.createLinearGradient(0, -370, 0, 370); gg.addColorStop(0, PUR); gg.addColorStop(1, '#2A1A8F'); ctx.fillStyle = gg; ctx.beginPath(); ctx.roundRect(-208, -376, 416, 752, 32); ctx.fill();
  ctx.fillStyle = WHITE; ctx.beginPath(); ctx.moveTo(-40, -60); ctx.lineTo(-40, 60); ctx.lineTo(60, 0); ctx.closePath(); ctx.fill();
  // watermark tag: grows and shakes at 1.0, wiped at 1.5
  const wipe = eInX(P(t, 1.5, 1.8)), wq = t < 1.0 ? 1 : 1 + 0.4 * pop(t, 1.0, 0.25, 3), sh = t > 1.0 && t < 1.5 ? Math.sin(t * 80) * 6 : 0;
  ctx.save(); ctx.translate(-60 + sh, 270); ctx.scale(wq, wq); ctx.globalAlpha = 1 - wipe;
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.roundRect(-110, -34, 220, 68, 12); ctx.fill();
  txt('@ 水印', 0, 0, 40, { c: 'rgba(255,255,255,0.9)', w: 900 }); ctx.restore(); ctx.globalAlpha = 1;
  if (t > 1.45) { const q = eIOX(P(t, 1.45, 1.8)); ctx.fillStyle = WHITE; ctx.fillRect(-208 + q * 0, 220, 416 * q, 100); ctx.fillStyle = rgba(PUR, 1); ctx.fillRect(-208 + 416 * q - 10, 205, 14, 130); }
  ctx.restore();
  // copy on the left
  if (t < 1.0) rise('刷到好视频', 620, CY - 20, 150, 0.0, t, { c: INK });
  else { const out = eInX(P(t, 1.85, 2.0)); ctx.save(); cam({ s: 1 + out * 0.2 }); ctx.globalAlpha = 1 - out;
    rise('想保存', 560, CY - 100, 130, 1.0, t, { c: INK }); rise('却有水印？', 620, CY + 70, 130, 1.12, t, { c: PUR }); ctx.restore(); ctx.globalAlpha = 1; }
}
// B 2–4  title: 免费解析 + [去水印] with the site's corner brackets, 一个入口 · 支持 30+ 平台
function sB(t) {
  lavender(t, 1.3);
  const out = eInX(P(t, 3.6, 4.0));
  ctx.save(); cam({ y: -900 * out, s: 1 + 0.03 * kick(t, 2.0, 8) });
  const [, bx] = riseLine([['免费解析', INK, 2.0], ['去水印', PUR, 2.25]], CY - 90, 190, t);
  brackets(bx[0] - 26, CY - 90 - 120, bx[1] + 52, 240, eOutX(P(t, 2.5, 2.8)), PUR, 7, 40);
  rise('一个入口 · 支持 30+ 平台', CX, CY + 130, 64, 3.0, t, { c: rgba(INK, 0.75), w: 500, st: 0.02 });
  ctx.restore();
  // the footage window rises in underneath from 3.6
  if (t > 3.6) { const q = eOutX(P(t, 3.6, 4.0)); footage(t, { z: 0.62, x: FW / 2, y: FH / 2, oy: L(1000, 60, q), r: -4 }); }
}
// C 4–10  home: paste the link → 30+ platforms → click 解析
const CAM_C = [
  { t: 4.0, z: 0.62, x: FW / 2, y: FH / 2, oy: 60, r: -4 },
  { t: 4.0, z: 1.0, oy: 0, r: 0, d: 0.5, ease: eOutX },
  { t: 5.0, z: 2.0, x: 551, y: 356 },
  { t: 7.0, z: 1.55, x: 551, y: 540 },
  { t: 8.5, z: 2.6, x: 830, y: 356 },
  { t: 9.75, z: 4.2, x: 881, y: 356, d: 0.25, ease: eInX },
];
function sC(t) {
  lavender(t);
  const v = camAt(CAM_C, t), f = footage(t, v, { marks: k => {
    if (t >= 5.2 && t < 7.0) brackets(194, 318, 715, 77, eOutX(P(t, 5.2, 5.5)), PUR, 4 / k * 1.4, 18);
    if (t >= 7.2 && t < 8.5) brackets(70, 500, 962, 95, eOutX(P(t, 7.2, 7.5)), PUR, 4 / k * 1.4, 18);
  } });
  pill('粘贴分享链接', CX, CY - 200, 5.25, t, { out: 6.9, rot: -3 });
  if (t >= 7.0) {
    const n = Math.round(30 * eOut3(P(t, 7.25, 8.0)));
    pill(`支持 ${n}+ 平台`, CX, CY - 230, 7.25, t, { out: 8.45, size: 54, rot: 2 });
    PLATS.forEach((p, i) => { const tq = 7.5 + i * 0.06; if (t < tq || t > 8.5) return; const a = i / PLATS.length * TAU + t * 0.6, r = 520;
      pill(p, CX + Math.cos(a) * r * 1.3, CY + 40 + Math.sin(a) * r * 0.62, tq, t, { size: 30, bg: WHITE, fg: INK, out: 8.4 }); });
  }
  if (t >= 9.0) { const [x, y] = f.map(881, 356); pill('一键解析', x - 40, y - 150, 9.0, t, { size: 50 }); ring(x, y, 9.5, t, PUR); }
}
// D 10–12  一个入口 / 多个平台 — platform chips stream past
function sD(t) {
  bg(PUR);
  ctx.save(); cam({ s: 1 + 0.03 * kick(t, 10, 8) });
  for (let r = 0; r < 5; r++) {
    const y = 110 + r * 215, dir = r % 2 ? 1 : -1, off = dir * (t - 10) * 260 + r * 170;
    font(900, 46); let x = ((off % 1400) + 1400) % 1400 - 1400;
    for (let n = 0; x < W + 200; n++) { const p = PLATS[(n + r * 3) % PLATS.length], w = ctx.measureText(p).width + 70;
      ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.beginPath(); ctx.roundRect(x, y - 38, w, 76, 38); ctx.fill(); txt(p, x + w / 2, y, 46, { c: 'rgba(255,255,255,0.55)', font: 900 }); x += w + 30; font(900, 46); }
  }
  ctx.restore();
  ctx.fillStyle = rgba(INK, 0.35); ctx.fillRect(0, CY - 210, W, 420);
  const s1 = slam(t, 10.0, 3, 1.8), s2 = slam(t, 10.5, 3, 1.8);
  txt('一个入口', CX, CY - 80, 170, { c: WHITE, s: s1 });
  txt('多个平台', CX, CY + 110, 170, { c: LAV, s: s2 });
  if (t >= 11.0) { const q = pop(t, 11.0, 0.3, 2.6); txt('30+', CX + 560, CY - 170, 150, { c: PUR, stroke: WHITE, sw: 8, s: q, rot: -10 }); }
  if (t >= 11.5) { const q = eInX(P(t, 11.7, 12.0)); ctx.fillStyle = rgba(WHITE, q); ctx.fillRect(0, 0, W, H); }
}
// E 12–18  results: parsing → 文案一键提取 → 无水印下载
const CAM_E = [
  { t: 12.0, z: 1.0, x: FW / 2, y: 345, ox: 1900, r: 3 },
  { t: 12.0, ox: 0, r: 0, d: 0.45, ease: eOutX },
  { t: 13.0, z: 1.55, x: 352, y: 349 },
  { t: 14.0, z: 1.85, x: 757, y: 392 },
  { t: 15.5, z: 1.15, x: 551, y: 345 },
  { t: 16.0, z: 2.4, x: 792, y: 122 },
  { t: 17.0, z: 1.45, x: 500, y: 420 },
  { t: 17.75, z: 1.45, x: 500, y: 420, oy: -1200, d: 0.25, ease: eInX },
];
function sE(t) {
  lavender(t);
  const v = camAt(CAM_E, t), f = footage(t, v, { marks: k => {
    if (t >= 14.3 && t < 15.5) brackets(571, 272, 372, 241, eOutX(P(t, 14.3, 14.6)), PUR, 4 / k * 1.6, 16);
    if (t >= 16.2 && t < 17.0) brackets(642, 107, 301, 30, eOutX(P(t, 16.2, 16.5)), PUR, 4 / k * 1.6, 10);
  } });
  if (t >= 13.0 && t < 14.0) pill('解析中…', CX, CY - 300, 13.05, t, { out: 13.9, size: 40, bg: WHITE, fg: PUR });
  pill('文案一键提取', CX - 120, CY - 330, 14.4, t, { out: 15.45, size: 54, rot: -2 });
  pill('无水印下载', CX - 260, CY + 210, 16.2, t, { out: 16.95, size: 54, rot: 2 });
  pill('视频 · 封面 · 音频', CX + 260, CY + 300, 16.45, t, { out: 16.95, size: 40, bg: WHITE, fg: INK });
  if (t >= 16.6) { const [x, y] = f.map(676, 122); ring(x, y, 17.0 - 0.05, t, PUR); }
  pill('高清原画 · 无水印', CX + 300, CY - 330, 17.15, t, { out: 17.7, size: 50, rot: -2 });
}
// F 18–20  无水印 + 视频 / 图片 / 文案
function sF(t) {
  bg(INK);
  const s = slam(t, 18.0, 4, 2.2);
  txt('无水印', CX, CY - 150, 230, { c: WHITE, s });
  const items = [['视频', 18.5, -480], ['图片', 19.0, 0], ['文案', 19.5, 480]];
  for (const [w, t0, dx] of items) { if (t < t0) continue; const q = pop(t, t0, 0.3, 2.4);
    ctx.save(); ctx.translate(CX + dx, CY + 190); ctx.scale(q, q); ctx.fillStyle = w === '图片' ? LAV : PUR; ctx.beginPath(); ctx.roundRect(-190, -85, 380, 170, 85); ctx.fill(); ctx.restore();
    txt(w, CX + dx, CY + 190, 90, { c: w === '图片' ? INK : WHITE, s: q }); }
  brackets(CX - 380, CY - 290, 760, 280, eOutX(P(t, 18.2, 18.5)), PUR, 8, 44);
  if (t > 19.8) { const q = eInX(P(t, 19.8, 20.0)); ctx.fillStyle = rgba(LAV, q); ctx.fillRect(0, 0, W, H); }
}
// G 20–24  four steps (one card per half-beat) → FAQ: free, no sign-up, no daily limit
const CARDS = [[171, 291], [425, 291], [678, 291], [932, 291]];
const CAM_G = [
  { t: 20.0, z: 1.0, x: FW / 2, y: 260, oy: 1100 },
  { t: 20.0, oy: 0, d: 0.4, ease: eOutX },
  { t: 20.5, z: 2.1, x: 171, y: 291, d: 0.22 }, { t: 20.75, x: 425, d: 0.22 }, { t: 21.0, x: 678, d: 0.22 }, { t: 21.25, x: 932, d: 0.22 },
  { t: 21.5, z: 1.25, x: 551, y: 240, d: 0.4 },
  { t: 22.0, z: 1.05, x: FW / 2, y: 300, d: 0.01 },
  { t: 22.5, z: 2.05, x: 547, y: 330 },
  { t: 23.75, z: 2.05, x: 547, y: 330, ox: -2200, d: 0.25, ease: eInX },
];
function sG(t) {
  lavender(t);
  const v = camAt(CAM_G, t);
  footage(t, v, { marks: k => {
    if (t >= 20.5 && t < 21.5) { const i = clamp(Math.floor((t - 20.5) / 0.25), 0, 3), [x, y] = CARDS[i]; brackets(x - 128, y - 82, 256, 164, eOutX(P(t, 20.5 + i * 0.25, 20.65 + i * 0.25)), PUR, 3.5 / k * 2, 14); }
    if (t >= 22.6 && t < 23.75) { ctx.fillStyle = rgba(PUR, 0.9); const q = eOutX(P(t, 22.6, 23.0)); ctx.fillRect(250, 352, 540 * q, 4); }
  } });
  if (t >= 20.5 && t < 21.5) { const i = clamp(Math.floor((t - 20.5) / 0.25), 0, 3); txt(`0${i + 1}`, CX - 340, CY - 200, 160, { c: PUR, s: pop(t, 20.5 + i * 0.25, 0.2, 2.5), rot: -8 }); }
  pill('四步搞定', CX, CY - 330, 21.55, t, { out: 21.95, size: 54 });
  pill('不收费', CX - 520, CY - 300, 23.0, t, { out: 23.7, size: 50, rot: -4 });
  pill('免注册', CX, CY - 340, 23.25, t, { out: 23.7, size: 50, rot: 2 });
  pill('不限次数', CX + 520, CY - 300, 23.5, t, { out: 23.7, size: 50, rot: -2 });
}
// H 24–28  benefits, one per beat, each with its own move
function sH(t) {
  const items = [
    ['免费使用', PUR, WHITE, 'slam'], ['无需注册', INK, LAV, 'up'], ['不限次数', LAV, PUR, 'flip'], ['30+ 平台', PUR, WHITE, 'stretch'],
    ['一个入口', WHITE, INK, 'slam'], ['无水印下载', INK, WHITE, 'side'], ['图片 · 视频', PUR, LAV, 'flip'], ['文案提取', LAV, INK, 'stretch'],
  ];
  const i = clamp(Math.floor((TH - 24.0) / BT + 1e-6), 0, 7), [w, b, c, mv] = items[i], t0 = 24.0 + i * BT, d = t - t0;
  bg(b);
  // previous colour slides off as a band — keeps cuts from feeling flat
  if (i > 0) { const q = eOutX(P(d, 0, 0.18)); ctx.fillStyle = items[i - 1][1]; ctx.fillRect(0, 0, W, H * (1 - q)); }
  const q = eOutX(P(d, 0, 0.16)), kk = Math.exp(-d * 10);
  const o = { c, s: 1 + 0.05 * kk };
  if (mv === 'slam') o.s = slam(t, t0, 3.2, 1.8);
  if (mv === 'up') o.clipUp = q;
  if (mv === 'flip') o.sy = Math.max(0.001, Math.abs(Math.cos(Math.PI / 2 * (1 - q))));
  if (mv === 'stretch') { o.sx = L(1.8, 1, q); o.sy = L(0.4, 1, q); }
  const x = mv === 'side' ? L(-800, CX, q) : CX;
  txt(w, x, CY, w.length > 4 ? 190 : 230, o);
  if (i % 2 === 0) brackets(CX - 600, CY - 190, 1200, 380, eOutX(P(d, 0.08, 0.3)), c, 7, 50);
  font(500, 30); txt(`0${i + 1} / 08`, W - 150, H - 80, 30, { c: rgba(c, 0.6), w: 500 });
}
// I 28–30  end card
function sI(t) {
  lavender(t, 1.4);
  const kk = kick(t, 28.0, 6), fin = 1 - P(t, 29.6, 30);
  ctx.save(); cam({ s: 1 + 0.02 * kk }); ctx.globalAlpha = fin;
  const [, bx] = riseLine([['免费解析', INK, 28.0], ['去水印工具', PUR, 28.1]], CY - 170, 150, t);
  brackets(bx[0] - 22, CY - 270, bx[1] + 44, 200, eOutX(P(t, 28.4, 28.7)), PUR, 7, 34);
  rise('一个入口，支持多个平台', CX, CY - 10, 60, 28.35, t, { c: rgba(INK, 0.75), w: 500, st: 0.02 });
  const uq = pop(t, 28.6, 0.35, 2);
  if (uq > 0) {
    ctx.save(); ctx.translate(CX - 170, CY + 160); ctx.scale(uq, uq); ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(-330, -55, 660, 110, 55); ctx.fill(); ctx.restore();
    txt('media.agentcore.top', CX - 170, CY + 160, 46, { c: WHITE, w: 500, s: uq });
    ctx.save(); ctx.translate(CX + 390, CY + 160); ctx.scale(uq * (1 + 0.04 * Math.sin(t * 10)), uq); ctx.fillStyle = PUR; ctx.beginPath(); ctx.roundRect(-150, -55, 300, 110, 55); ctx.fill(); ctx.restore();
    txt('立即使用 →', CX + 390, CY + 160, 44, { c: WHITE, s: uq });
  }
  ctx.restore(); ctx.globalAlpha = 1;
  if (t < 28.15) { ctx.fillStyle = rgba(WHITE, 1 - P(t, 28.0, 28.15)); ctx.fillRect(0, 0, W, H); }
}

const SCENES = [[0, 2, sA], [2, 4, sB], [4, 10, sC], [10, 12, sD], [12, 18, sE], [18, 20, sF], [20, 24, sG], [24, 28, sH], [28, 30, sI]];

function draw(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  TH = Math.round(t * FPS) / FPS;
  bg(LAV);
  for (const [a, b, fn] of SCENES) if (TH >= a - 1e-6 && TH < b - 1e-6) { ctx.save(); fn(t); ctx.restore(); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const blk = Math.max(1 - P(t, 0, 0.12), P(t, 29.88, 30)); if (blk > 0) { ctx.fillStyle = `rgba(0,0,0,${blk})`; ctx.fillRect(0, 0, W, H); }
}
async function ensure(ts) { const need = new Set(); for (const t of ts) { const s = srcAt(t); if (s !== null) need.add(fidx(s)); } await Promise.all([...need].map(load)); }
window.setTime = async t => { t = clamp(t, 0, DUR - 1e-4); await ensure([t]); draw(t); };
const acc = document.createElement('canvas'); acc.width = W; acc.height = H; const actx = acc.getContext('2d');
window.renderFrame = async (f, SUB) => {
  const ts = Array.from({ length: SUB }, (_, k) => clamp((f - 0.25 + (k + 0.5) * 0.5 / SUB) / FPS, 0, DUR - 1e-4));
  await ensure(ts);
  ts.forEach((t, k) => { draw(t); actx.globalAlpha = 1 / (k + 1); actx.drawImage(cv, 0, 0); });
  actx.globalAlpha = 1; return acc.toDataURL('image/png').slice(22);
};
if (!location.search.includes('render')) { const t0 = performance.now(); const loop = async () => { await window.setTime(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); }
