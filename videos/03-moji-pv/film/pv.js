'use strict';
// 文字PV — 30s landscape (1920x1080) Japanese lyric motion video, 150 BPM (beat 0.4s = 12 frames).
// Look: red / black / white with dark teal (diagonal black lattice, white web lines, cracks); thin Mincho
// lyrics, white with a black edge, popping in one character at a time — mostly horizontal and scattered.
// Scenes: teal + boxed pause-heart, white paper with bars and rows of red outlined digits, pixel heart on a
// wall of text, mosaic tunnel with a wavy line of text, I LOVE YOU / HATE, film strips with slot-machine 9s,
// red noise with boxed kanji and black X marks, a shattering heart, 好 → 嘘, さよなら dissolving.
// Every frame is a pure function of t. Lyrics + timings live in lyrics.js (shared with score.py).

const W = 1920, H = 1080, CX = W / 2, CY = H / 2, FPS = 30, DUR = 30, BT = 0.4, D2R = Math.PI / 180, TAU = Math.PI * 2;
const RED = '#E8121C', DRED = '#6E0A10', BLACK = '#0A0A0B', WHITE = '#F4F2EE', PAPER = '#F1EFEA';
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let TH = 0;

// ---------- maths ----------
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const L = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const eOut3 = t => 1 - Math.pow(1 - t, 3), eIn3 = t => t * t * t;
const eOutX = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)), eInX = t => (t <= 0 ? 0 : Math.pow(2, 10 * (t - 1)));
const eIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const back = (t, s = 1.7) => { if (t <= 0) return 0; if (t >= 1) return 1; t -= 1; return t * t * ((s + 1) * t + s) + 1; };
const hash = n => { let h = Math.imul(n | 0, 2654435761) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };
const since = (t, from = 0, step = BT) => (t < from ? 99 : (t - from) % step);
const kick = (t, from = 0, k = 12, step = BT) => Math.exp(-since(t, from, step) * k);
const slam = (t, t0, b0 = 6, b1 = 3) => { const f = Math.round(t * FPS) - Math.round(t0 * FPS); if (f < 0) return 0; if (f === 0) return b0; if (f === 1) return b1; return 1 + 0.1 * Math.exp(-(t - t0 - 2 / FPS) * 14); };
const pop = (t, t0, d = 0.3, s = 2.2) => back(P(t, t0, t0 + d), s);
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${clamp(a)})`; };
const step8 = t => Math.floor(t / (BT / 2) + 1e-6);

// ---------- pre-baked textures (deterministic) ----------
function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
let seed = 1; const rnd = () => hash(seed++);
const TW = 2300, THH = 1400;   // texture size: larger than the frame so it can drift
const TEAL = mk(TW, THH, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0b2a24'); gr.addColorStop(0.5, '#1c5a4b'); gr.addColorStop(1, '#0c2e27');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 220; i++) { const x = rnd() * w, y = rnd() * h, r = 40 + rnd() * 220, rg = g.createRadialGradient(x, y, 0, x, y, r), light = rnd() > 0.5;
    rg.addColorStop(0, light ? 'rgba(90,160,135,0.16)' : 'rgba(0,15,12,0.25)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  for (let i = 0; i < 40000; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(160,220,200,0.07)' : 'rgba(0,0,0,0.12)'; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
  // diagonal black lattice
  g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 3;
  for (let k = -h; k < w + h; k += 270) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k + h, 0); g.lineTo(k, h); g.stroke(); }
  // cracks
  const crack = (x, y, a, n, wd) => { g.beginPath(); g.moveTo(x, y); for (let i = 0; i < n; i++) { a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * 24; y += Math.sin(a) * 24; g.lineTo(x, y); if (rnd() < 0.06 && wd > 0.6) crack(x, y, a + (rnd() - 0.5) * 2, n / 2 | 0, wd * 0.6); } g.lineWidth = wd; g.stroke(); };
  g.strokeStyle = 'rgba(225,255,240,0.3)'; for (let i = 0; i < 30; i++) crack(rnd() * w, rnd() * h, rnd() * TAU, 20 + rnd() * 40, 1 + rnd());
});
// white web: long wandering lines laid over the teal (drawn live so they can drift a little)
const WEB = Array.from({ length: 34 }, () => { const pts = []; let x = rnd() * W * 1.4 - W * 0.2, y = rnd() < 0.5 ? -40 : rnd() * H, a = rnd() * TAU;
  for (let i = 0; i < 26; i++) { a += (rnd() - 0.5) * 0.7; x += Math.cos(a) * 90; y += Math.sin(a) * 90; pts.push([x, y]); } return { pts, w: 0.8 + rnd() * 1.8, a: 0.35 + rnd() * 0.5 }; });
function web(t, alpha = 1) {
  for (const l of WEB) { ctx.strokeStyle = `rgba(235,240,238,${l.a * alpha})`; ctx.lineWidth = l.w; ctx.beginPath();
    l.pts.forEach(([x, y], i) => { const dx = Math.sin(t * 0.7 + i) * 6, dy = Math.cos(t * 0.6 + i) * 6; i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy); }); ctx.stroke(); }
}
const REDN = mk(TW, THH, (g, w, h) => {
  g.fillStyle = '#C80F19'; g.fillRect(0, 0, w, h);
  g.font = '800 120px Mincho'; g.textBaseline = 'middle';
  for (let y = 40; y < h; y += 130) for (let x = -rnd() * 300; x < w; x += 130) { g.fillStyle = rnd() > 0.5 ? 'rgba(60,0,4,0.35)' : 'rgba(255,70,70,0.25)'; g.fillText('愛嘘壊心'[(rnd() * 4) | 0], x, y); }
  for (let i = 0; i < 1500; i++) { g.fillStyle = rnd() > 0.35 ? 'rgba(40,0,4,0.5)' : 'rgba(255,60,60,0.45)'; const s = 4 + rnd() * 40; g.fillRect(rnd() * w, rnd() * h, s * (0.3 + rnd()), s * (0.2 + rnd() * 0.5)); }
  for (let i = 0; i < 60000; i++) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
});
const MOSAIC = Array.from({ length: 6 }, () => mk(W, H, (g, w, h) => {
  for (let y = 0; y < h; y += 48) for (let x = 0; x < w; x += 48) {
    if (rnd() < 0.45) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const c = Math.pow(rnd(), 1.5) * 235 | 0; g.fillStyle = `rgb(${c},${c},${c})`; g.fillRect(x + i * 24, y + j * 24, 24, 24); }
    else { const c = Math.pow(rnd(), 1.5) * 235 | 0; g.fillStyle = `rgb(${c},${c},${c})`; g.fillRect(x, y, 48, 48); }
  }
  for (let i = 0; i < 40; i++) { const c = rnd() * 255 | 0; g.fillStyle = `rgba(${c},${c},${c},0.8)`; g.fillRect(rnd() * w, rnd() * h, 96 + rnd() * 240, 48); }
}));
const GRAIN = [0, 1, 2].map(k => ctx.createPattern(mk(256, 256, (g) => { const im = g.createImageData(256, 256); for (let i = 0; i < 65536; i++) { const v = hash(i * 7 + k * 99991) * 255; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); }), 'repeat'));
const VIG = mk(W, H, (g) => { const gr = g.createRadialGradient(CX, CY, H * 0.35, CX, CY, W * 0.62); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
const TMP = mk(W, H, () => {}), tctx = TMP.getContext('2d');

// pixel heart: cells of the implicit heart curve, with a ragged edge
const HEART = (() => {
  const N = 34, cells = [];
  for (let j = 0; j < N * 1.1; j++) for (let i = 0; i < N; i++) {
    const u = -1.25 + (i + 0.5) * 2.5 / N, v = 1.35 - (j + 0.5) * 2.5 / N, f = Math.pow(u * u + v * v - 1, 3) - u * u * v * v * v;
    const r = hash(i * 131 + j * 977);
    if (f < -0.03 || (f < 0.05 && r < 0.55)) cells.push({ u, v, edge: f > -0.03, r, i, j });
  }
  return { cells, cs: 2.5 / N };
})();
function pixelHeart(cx, cy, sc, color, o = {}) {
  const cs = HEART.cs * sc, st = o.step ?? 0;
  ctx.fillStyle = color;
  for (const c of HEART.cells) {
    if (c.edge && hash(c.i * 7 + c.j * 13 + st * 101) < 0.35) continue;
    let x = cx + c.u * sc, y = cy - c.v * sc, s = cs + 0.6;
    if (o.fall) { const f = o.fall(c); if (f.gone) continue; x += f.dx; y += f.dy; s *= f.s; }
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
}
function heartPath(cx, cy, s) {
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) { const a = i / 80 * TAU, x = 16 * Math.pow(Math.sin(a), 3), y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); i ? ctx.lineTo(cx + x * s, cy - y * s) : ctx.moveTo(cx + x * s, cy - y * s); }
  ctx.closePath();
}

// ---------- text ----------
function jch(ch, x, y, size, o = {}) {
  const s = o.s ?? 1, a = o.a ?? 1; if (s <= 0.001 || a <= 0.001) return;
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot * D2R); ctx.scale(s * (o.sx ?? 1), s * (o.sy ?? 1)); ctx.globalAlpha = a;
  ctx.font = `${o.w || 500} ${size}px Mincho`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '0px';
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.sw || size * 0.09; ctx.strokeStyle = o.stroke; ctx.strokeText(ch, 0, 0); }
  if (o.fill) { ctx.fillStyle = o.fill; ctx.fillText(ch, 0, 0); }
  if (o.outline) { ctx.lineJoin = 'round'; ctx.lineWidth = o.ow || 2; ctx.strokeStyle = o.outline; ctx.strokeText(ch, 0, 0); }
  ctx.restore(); ctx.globalAlpha = 1;
}
function latin(str, x, y, size, o = {}) {
  const s = o.s ?? 1; if (s <= 0.001) return;
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot * D2R); ctx.scale(s, s); ctx.globalAlpha = o.a ?? 1;
  ctx.font = `900 ${size}px Mont`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = (o.track || 0) + 'px';
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.sw || 6; ctx.strokeStyle = o.stroke; ctx.strokeText(str, 0, 0); }
  if (o.fill) { ctx.fillStyle = o.fill; ctx.fillText(str, 0, 0); }
  if (o.outline) { ctx.lineWidth = o.ow || 3; ctx.strokeStyle = o.outline; ctx.strokeText(str, 0, 0); }
  ctx.restore(); ctx.globalAlpha = 1;
}
const LY = Object.fromEntries(window.LYRICS.map(l => [l.id, l]));
// a lyric line; characters pop in at their times.
// lay: {x, y, size, dir:'h'|'v', gap, style:'white'|'black'|'outline', red:[i], out:t, wave:{amp,len,speed}, at:[[x,y],...]}
function lyric(id, t, lay) {
  const l = LY[id], chars = [...l.text], dir = lay.dir || 'h', gap = lay.gap ?? 1.0;
  let pos = 0;
  chars.forEach((ch, i) => {
    const sz = lay.size * (lay.vary === false ? 1 : 0.84 + 0.34 * hash(i * 17 + id.length * 5 + lay.size));
    const at = l.t[Math.min(i, l.t.length - 1)], half = sz * gap / 2;
    pos += half; const p = pos; pos += half;
    if (t < at) return;
    const q = P(t, at, at + 0.14), jit = (hash(i * 3 + lay.size) - 0.5) * (lay.jit ?? 60), rot = (hash(i * 5 + lay.size) - 0.5) * (lay.rj ?? 16);
    let x, y;
    if (lay.at) [x, y] = lay.at[i]; else { x = dir === 'v' ? lay.x + jit * 0.6 : lay.x + p; y = dir === 'v' ? lay.y + p : lay.y + jit; }
    if (lay.wave) y += Math.sin(x / lay.wave.len + t * lay.wave.speed) * lay.wave.amp;
    let a = 1, extra = 0;
    if (lay.out !== undefined && t > lay.out) { const o = eIn3(P(t, lay.out + i * 0.03, lay.out + i * 0.03 + 0.35)); a = 1 - o; y += 140 * o * (hash(i) - 0.3); x += 260 * o * (hash(i + 9) - 0.5); extra = 40 * o; }
    const red = (lay.red || []).includes(i), st = lay.style || 'white';
    const look = st === 'black' ? { fill: red ? RED : BLACK } : st === 'outline' ? { outline: red ? RED : WHITE, ow: 2.5 } : { fill: red ? RED : WHITE, stroke: BLACK, sw: sz * 0.08 };
    jch(ch, x, y, sz, { ...look, w: red && st !== 'outline' ? 800 : (lay.w || 500), s: L(1.8, 1, eOutX(q)) * (1 + 0.06 * Math.exp(-(t - at) * 12)), rot: rot + extra, a: a * (0.3 + 0.7 * eOutX(q)) });
  });
}

// ---------- shapes ----------
function bg(c) { ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); }
function tex(img, t, drift = 1, jump = 0) {
  const j = jump ? step8(t) : 0, ox = -190 + Math.sin(t * 0.3) * 90 * drift + (hash(j * 3) - 0.5) * jump, oy = -160 + Math.cos(t * 0.23) * 60 * drift + (hash(j * 3 + 1) - 0.5) * jump;
  ctx.drawImage(img, ox, oy);
}
function teal(t, s = 1.04, r = 0) { ctx.save(); ctx.translate(CX, CY); ctx.rotate(r * D2R); ctx.scale(s, s); ctx.translate(-CX, -CY); tex(TEAL, t); web(t); ctx.restore(); }
function poly(pts, c, lw) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke(); }
function ngon(cx, cy, rx, ry, n, rot, c, lw) { poly(Array.from({ length: n }, (_, i) => { const a = rot + i * TAU / n - Math.PI / 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; }), c, lw); }
function pauseIcon(cx, cy, s, c) { ctx.fillStyle = c; ctx.fillRect(cx - s * 0.32, cy - s * 0.45, s * 0.2, s * 0.9); ctx.fillRect(cx + s * 0.12, cy - s * 0.45, s * 0.2, s * 0.9); }
function playIcon(cx, cy, s, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(cx - s * 0.35, cy - s * 0.45); ctx.lineTo(cx - s * 0.35, cy + s * 0.45); ctx.lineTo(cx + s * 0.45, cy); ctx.closePath(); ctx.fill(); }
function crossMark(cx, cy, s, rot) { // the red/black "+" symbol from the reference
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * D2R);
  ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(0, 0, s * 0.55, 0, TAU); ctx.fill();
  ctx.fillStyle = BLACK; ctx.fillRect(-s * 0.08, -s * 0.75, s * 0.16, s * 1.5); ctx.fillRect(-s * 0.6, -s * 0.08, s * 1.2, s * 0.16);
  ctx.strokeStyle = WHITE; ctx.lineWidth = 3; ctx.strokeRect(-s * 0.08, -s * 0.75, s * 0.16, s * 1.5); ctx.restore();
}
function bigX(cx, cy, s, rot, c = BLACK) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * D2R); ctx.fillStyle = c; ctx.fillRect(-s, -s * 0.13, 2 * s, s * 0.26); ctx.fillRect(-s * 0.13, -s, s * 0.26, 2 * s); ctx.restore(); }
function filmStrip(y, h, off, c = RED) {
  ctx.fillStyle = c; ctx.fillRect(-40, y - h / 2, W + 80, h);
  ctx.fillStyle = BLACK; const hw = h * 0.42, sp = h * 0.78; for (let x = (off % sp) - sp; x < W + sp; x += sp) ctx.fillRect(x, y - h * 0.26, hw, h * 0.52);
}
function textRow(str, size, color, y, off, o = {}) {
  ctx.font = `${o.w || 800} ${size}px ${o.font || 'Mincho'}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
  const unit = ctx.measureText(str).width; let x = ((off % unit) + unit) % unit - unit;
  for (; x < W; x += unit) { if (o.stroke) { ctx.strokeStyle = color; ctx.lineWidth = o.stroke; ctx.strokeText(str, x, y); } else { ctx.fillStyle = color; ctx.fillText(str, x, y); } }
}
function textRows(str, size, color, t, speed, y0, gap, o = {}) { for (let r = 0, y = y0; y < H + gap; r++, y += gap) textRow(str, size, color, y, (r % 2 ? 1 : -1) * speed * t + r * 137, o); }
function scribble(t, y0, amp, seedN, c, lw) {
  ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath();
  for (let x = -20; x <= W + 20; x += 14) { const y = y0 + Math.sin(x / 90 + t * 9 + seedN) * amp + Math.sin(x / 29 + seedN * 3) * amp * 0.35 + (hash(step8(t) * 50 + x + seedN) - 0.5) * 10; x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke();
}
function arrow(x, y, ang, len, c, lw) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(-lw * 2, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-lw * 4, -lw * 2.4); ctx.lineTo(-lw * 4, lw * 2.4); ctx.closePath(); ctx.fill(); ctx.restore();
}
function cam(o) { ctx.translate(CX + (o.x || 0), CY + (o.y || 0)); ctx.rotate((o.r || 0) * D2R); ctx.scale(o.s ?? 1, o.s ?? 1); ctx.translate(-CX, -CY); }
function blackBox(cx, cy, w, h, rot, s = 1) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * D2R); ctx.scale(s, s); ctx.fillStyle = BLACK; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore(); }

// ============================================================ scenes
// S1 0–3.2  ねえ / 聞こえてる？ — teal lattice + web, a tilted red frame round a black box with the pause-heart
function s1(t) {
  const kk = kick(t, 0, 10);
  teal(t, 1.04 + 0.03 * t / 3.2);
  const d = pop(t, 0.4, 0.4, 1.6) * (1 + 0.04 * kk);
  if (d > 0) {
    ctx.save(); ctx.translate(CX + 40, CY + 20); ctx.rotate((18 + Math.sin(t) * 3) * D2R); ctx.strokeStyle = RED; ctx.lineWidth = 6; ctx.strokeRect(-300 * d, -300 * d, 600 * d, 600 * d); ctx.restore();
    blackBox(CX + 40, CY + 20, 340, 340, -12, pop(t, 0.6, 0.3, 2));
  }
  const hp = pop(t, 0.8, 0.35, 2);
  if (hp > 0) { pixelHeart(CX + 40, CY + 30, 140 * hp * (1 + 0.05 * kk), RED, { step: step8(t) }); pauseIcon(CX + 40, CY + 10, 120 * hp, WHITE); }
  lyric('L1a', t, { x: 230, y: 230, size: 210, gap: 0.95 });
  lyric('L1b', t, { x: 700, y: 800, size: 185, gap: 0.98, red: [5] });
}
// S2 3.2–6.4  何回目の / 嘘だろう — white paper, black bars, rows of red outlined digits and ？
function s2(t) {
  const lt = t - 3.2;
  bg(PAPER);
  ctx.save(); ctx.setLineDash([10, 12]); ctx.strokeStyle = rgba(BLACK, 0.8); ctx.lineWidth = 2; ctx.lineDashOffset = -lt * 60;
  ctx.beginPath(); ctx.arc(420, 300, 250, 0, TAU); ctx.stroke(); ctx.setLineDash([3, 9]); ctx.beginPath(); ctx.arc(1500, 760, 210, 0, TAU); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = rgba(BLACK, 0.7); ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5 + lt * 0.3; const x = 300 + Math.cos(a) * 240, y = 560 + Math.sin(a) * 240; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  // rows of outlined red characters between the bars
  const rows = [[150, '？？？？？？？？？？？？'], [560, '9999999999？？？？'], [930, '++++++3333333333']];
  rows.forEach(([y, s], i) => { const q = eOutX(P(lt, 0.1 + i * 0.1, 0.5 + i * 0.1)); if (q > 0) textRow(s, 150, rgba(RED, 0.85), y, (i % 2 ? 1 : -1) * (lt * 220) + (1 - q) * 1500 * (i % 2 ? -1 : 1), { stroke: 2.4, font: i === 0 ? 'Mincho' : 'Mont', w: i === 0 ? 800 : 900 }); });
  // black bars slam in on beats, jump on every beat of bar 2
  [[60, 46], [340, 30], [740, 38], [1040, 56]].forEach(([y, h], i) => {
    const q = eOutX(P(lt, i * BT * 0.5, i * BT * 0.5 + 0.18)), dir = i % 2 ? 1 : -1;
    const jump = lt > 1.6 ? (hash(Math.floor((lt - 1.6) / BT) * 7 + i) - 0.5) * 120 : 0, ex = eInX(P(lt, 3.0, 3.2));
    ctx.fillStyle = BLACK; ctx.fillRect(dir * (1 - q) * W, y + jump - h / 2 - ex * 400, W, h + ex * 900);
  });
  lyric('L2a', t, { x: L(560, 360, eOutX(P(lt, 1.6, 1.8))), y: 360, size: 240, style: 'black', rj: 10, jit: 40 });
  lyric('L2b', t, { x: 900, y: 740, size: 220, style: 'black', red: [0], jit: 50 });
}
// S3 6.4–9.6  愛してる — a red pixel heart on a wall of 愛してる
function s3(t) {
  const lt = t - 6.4, kk = kick(t, 6.4, 9), tilt = -6 * eIO(P(lt, 1.6, 2.0));
  bg(BLACK);
  ctx.save(); cam({ r: tilt * 0.5, s: 1.08 });
  textRows('愛してる我愛你愛してる', 118, DRED, lt, 80, 40, 132);
  ctx.restore();
  ctx.save(); cam({ r: tilt, s: 1 + 0.04 * kk });
  pixelHeart(1000, CY - 10, 400 * pop(t, 6.4, 0.3, 1.5), RED, { step: step8(t) });
  ctx.strokeStyle = rgba(BLACK, 0.7); ctx.lineWidth = 2; ctx.setLineDash([4, 7]);
  const pts = Array.from({ length: 5 }, (_, i) => { const a = -Math.PI / 2 + i * 4 * Math.PI / 5 + lt * 0.2; return [1000 + Math.cos(a) * 280, CY + Math.sin(a) * 280]; });
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
  lyric('L3', t, { at: [[560, 300], [700, 760], [1180, 420], [1260, 800]], size: 290, rj: 18 });
  ctx.restore();
}
// S4 9.6–11.2  なんて言わないで — mosaic tunnel, red outlined heart, the words run along a wave
function s4(t) {
  const lt = t - 9.6, st = step8(t);
  ctx.save(); cam({ s: 1.1 + lt * 0.25, r: lt * 6 }); ctx.drawImage(MOSAIC[st % 6], 0, 0); ctx.globalAlpha = 0.5; ctx.translate(CX, CY); ctx.scale(0.6, 0.6); ctx.translate(-CX, -CY); ctx.drawImage(MOSAIC[(st + 3) % 6], 0, 0); ctx.restore(); ctx.globalAlpha = 1;
  ctx.save(); cam({ r: Math.sin(lt * 3) * 4, s: 1 + 0.05 * kick(t, 9.6, 10) });
  heartPath(CX, CY - 30, 20); ctx.fillStyle = BLACK; ctx.fill(); ctx.strokeStyle = RED; ctx.lineWidth = 16; ctx.stroke();
  ctx.restore();
  for (let i = 0; i < 4; i++) scribble(t, 500 + i * 30, 50, i * 2.3, rgba(WHITE, 0.85), 2);
  bigX(330, 300, 70 * pop(t, 9.8, 0.25, 3), 10, RED);
  const q = eOutX(P(lt, 0.8, 1.1));
  if (q > 0) { ctx.save(); ctx.translate(L(2200, 1650, q), 800); ctx.rotate(-14 * D2R); ctx.fillStyle = WHITE; ctx.fillRect(-150, -200, 300, 400);
    ctx.strokeStyle = rgba(BLACK, 0.5); ctx.lineWidth = 2; for (let y = -170; y < 180; y += 22) { ctx.beginPath(); ctx.moveTo(-120, y); ctx.lineTo(120, y); ctx.stroke(); }
    ctx.strokeStyle = RED; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(40, -40, 60, 90, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  // both lines sit on one wavy baseline that sweeps across the screen
  const wave = { amp: 70, len: 160, speed: 6 };
  lyric('L4a', t, { at: [[260, 520], [430, 470], [600, 540]], size: 180, wave });
  lyric('L4b', t, { at: [[860, 560], [1030, 520], [1200, 600], [1370, 560], [1540, 520]], size: 165, wave, red: [0] });
}
// S5 11.2–12.8  I LOVE YOU → HATE
function s5(t) {
  const lt = t - 11.2, kk = kick(t, 11.2, 12), out = eInX(P(lt, 1.2, 1.4));
  teal(t);
  ctx.save(); cam({ r: -30 * out, s: L(1, 0.2, out) });
  blackBox(CX + 40, CY + 40, 920, 360, -4);
  const sa = L(2.4, 1, eOutX(P(lt, 0, 0.15))), sb = t >= 11.4 ? L(2.4, 1, eOutX(P(lt, 0.2, 0.35))) : 0, sc = t >= 11.6 ? L(2.4, 1, eOutX(P(lt, 0.4, 0.55))) : 0;
  latin('HATE', CX + 60, CY + 90, 200, { fill: rgba(RED, sb > 0 ? 0.55 : 0), s: sb });
  latin('I', 470, CY - 40, 300, { fill: WHITE, stroke: BLACK, sw: 10, s: sa * (1 + 0.05 * kk), rot: -8 });
  const hate = TH >= 12.0 && (TH >= 12.3 || Math.round(TH * FPS) % 2 === 0);
  latin(hate ? 'HATE' : 'LOVE', CX + 20, CY - 40, 220, { fill: hate ? RED : WHITE, stroke: BLACK, sw: 10, s: sb * (1 + 0.06 * kk), rot: -20 });
  latin('YOU', 1500, CY + 60, 190, { outline: WHITE, ow: 4, s: sc, rot: 70 });
  [[260, 140, 0.5], [1700, 160, 2.5], [300, 960, -0.6], [1650, 940, -2.4]].forEach(([x, y, a], i) => {
    const q = eOutX(P(lt, 0.1 + i * 0.08, 0.4 + i * 0.08)); if (q > 0) arrow(L(x - Math.cos(a) * 500, x, q), L(y - Math.sin(a) * 500, y, q), a, 160, WHITE, 9);
  });
  const sq = eOutX(P(t, 12.0, 12.1));
  if (sq > 0) { ctx.strokeStyle = RED; ctx.lineWidth = 30; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(560, 860); ctx.lineTo(L(560, 1420, sq), L(860, 180, sq)); ctx.stroke(); ctx.lineCap = 'butt';
    for (let i = 0; i < 18; i++) { const u = hash(i * 3), r = 6 + 22 * hash(i * 3 + 1) * sq; ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(L(560, 1420, u) + (hash(i * 3 + 2) - 0.5) * 160, L(860, 180, u) + (hash(i * 5) - 0.5) * 160, r, 0, TAU); ctx.fill(); } }
  ctx.restore();
  if (out > 0.6) bg(BLACK);
}
// S6 12.8–16.0  何十回 / 何百回 — black, red film strips, coloured cross lattice, slot-machine 9s
function s6(t) {
  const lt = t - 12.8, kk = kick(t, 12.8, 10);
  bg(BLACK);
  ctx.lineWidth = 1.6;
  for (let i = -2; i < 12; i++) { const x0 = i * 220, c = ['#C9B94A', '#3340E0', RED][(i + 3) % 3]; ctx.strokeStyle = rgba(c, 0.75); ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + H, H); ctx.moveTo(x0 + H, 0); ctx.lineTo(x0, H); ctx.stroke(); }
  ctx.strokeStyle = rgba(RED, 0.8); ctx.lineWidth = 2; for (let x = 60; x < W; x += 180) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  textRow('？？？？？？？？？？', 90, rgba(RED, 0.6), 990, -lt * 160, { stroke: 2 });
  const ang = lt < 1.6 ? -6 : 0;
  ctx.save(); ctx.translate(CX, CY); ctx.rotate(ang * D2R); ctx.translate(-CX, -CY);
  [[240, 46, 1], [600, 64, -1.3], [850, 40, 1.1]].forEach(([y, h, v], i) => {
    const q = eOutX(P(lt, i * 0.05, i * 0.05 + 0.3)); ctx.save(); ctx.translate(v > 0 ? -(1 - q) * 2200 : (1 - q) * 2200, 0);
    filmStrip(y + (lt > 1.6 ? 60 * Math.sin(i * 2) : 0), h, lt * 800 * v + 400 * kk * v); ctx.restore();
  });
  ctx.restore();
  const digit = (x, y, sz, t0, k) => { if (t < t0) return; const spin = t < t0 + 0.25, d = spin ? String(Math.floor(hash(Math.floor(t * 30) * 7 + k) * 10)) : '9';
    jch(d, x, y, sz, { fill: RED, w: 800, s: spin ? 1 : 1 + 0.12 * Math.exp(-(t - t0 - 0.25) * 12), sy: spin ? 0.8 : 1 }); };
  if (lt < 1.6) { digit(820, 380, 330, 13.2, 1); digit(1080, 380, 330, 13.6, 2); }
  else { digit(700, 760, 300, 14.8, 3); digit(940, 760, 300, 15.0, 4); digit(1180, 760, 300, 15.2, 5); }
  lyric('L6a', t, { at: [[400, 330], [960, 600], [1500, 380]], size: 230, out: 14.3 });
  lyric('L6b', t, { at: [[420, 420], [1000, 300], [1560, 520]], size: 230, red: [1] });
  if (lt < 0.15) { ctx.fillStyle = rgba(WHITE, 0.7 * (1 - lt / 0.15)); ctx.fillRect(0, 0, W, H); }
}
// S7 16.0–19.2  壊れた / 心臓 — red noise, a wide black box with a red giant kanji, black X marks
function s7(t) {
  const lt = t - 16.0, kk = kick(t, 16.0, 11);
  if (t >= 18.8) {
    const q = (t - 18.8) / 0.4;
    for (let k = 0; k < 4; k++) { ctx.save(); ctx.translate(CX, CY); ctx.rotate(k * Math.PI / 2 + q * 1.2); ctx.scale(k % 2 ? -1 : 1, 1); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1600, -1600); ctx.lineTo(1600, 1600); ctx.closePath(); ctx.clip(); ctx.drawImage(REDN, -300 - q * 400, -500); ctx.restore(); }
    return;
  }
  ctx.save(); cam({ s: 1.05 }); tex(REDN, t, 0.4, 40); ctx.restore();
  const big = t < 17.6 ? ['壊', 16.0] : ['心', 17.6], s = slam(t, big[1], 4, 2), rot = (Math.floor(lt / BT) % 2 ? 1.5 : -1.5);
  ctx.save(); ctx.translate(CX - 80, CY); ctx.rotate(rot * D2R); ctx.scale(s, s);
  ctx.fillStyle = BLACK; ctx.fillRect(-560, -330, 1120, 660); ctx.strokeStyle = WHITE; ctx.lineWidth = 4; ctx.strokeRect(-540, -310, 1080, 620);
  ctx.restore();
  jch(big[0], CX - 80, CY + 10, 560, { fill: RED, w: 800, s: s * (1 + 0.04 * kk), rot });
  if (t < 17.6) { const l = LY.L7a; [1, 2].forEach(i => { if (t < l.t[i]) return; const q = eOutX(P(t, l.t[i], l.t[i] + 0.14)); jch(l.text[i], 1380 + (i - 1) * 190, 380 + (i - 1) * 300, 230, { fill: WHITE, stroke: BLACK, sw: 16, s: L(1.8, 1, q), rot: (i - 1.5) * 12 }); }); }
  else if (t >= 18.0) { const q = eOutX(P(t, 18.0, 18.14)); jch('臓', 1450, 720, 380, { fill: WHITE, stroke: BLACK, sw: 22, s: L(1.8, 1, q), rot: -6 }); }
  // black X marks stamp in on beats
  [[1560, 230, 16.4], [330, 820, 16.8], [1650, 860, 17.2], [300, 200, 18.4]].forEach(([x, y, t0], i) => { const p = pop(t, t0, 0.2, 3); if (p > 0) bigX(x, y, 130 * p, 12 + i * 20); });
  ctx.strokeStyle = rgba(WHITE, 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 900); ctx.lineTo(W, 860 + 30 * kk); ctx.stroke();
}
// S8 19.2–22.4  それでも — the pixel heart breaks apart, cells falling from the bottom up
function s8(t) {
  const lt = t - 19.2;
  bg(BLACK);
  ctx.save(); ctx.globalAlpha = 0.45; textRows('愛してる我愛你愛してる', 118, DRED, lt * 0.4, 40, 40, 132); ctx.restore();
  const fall = c => {
    const rel = 19.5 + (c.v + 1.3) / 2.6 * 2.2 + c.r * 0.5, d = t - rel;
    if (d <= 0) return { dx: Math.sin(t * 40 + c.r * 50) * (t > rel - 0.4 ? 2 : 0), dy: 0, s: 1 };
    if (d > 1.4) return { gone: true };
    return { dx: (c.r - 0.5) * 200 * d, dy: 1100 * d * d, s: 1 - d * 0.4 };
  };
  pixelHeart(760, CY - 30, 380, RED, { step: step8(t), fall });
  lyric('L8', t, { x: 1170, y: 540, size: 200, gap: 1.02 });
  ctx.strokeStyle = rgba(WHITE, 0.5); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, CY + 280); ctx.lineTo(W, CY + 280 + Math.sin(lt * 2) * 30); ctx.stroke();
}
// S9 22.4–25.6  好きだった — teal; a long black box where red 好 flickers into 嘘; pause → play; red ? and the + mark
function s9(t) {
  const lt = t - 22.4, kk = kick(t, 22.4, 10);
  teal(t + 5, 1.08, 2);
  const bq = eOutX(P(lt, 0, 0.25));
  ctx.save(); ctx.translate(L(-800, 0, bq), 0); blackBox(1080, 470, 1000, 330, -2); ctx.restore();
  const sq = pop(t, 23.2, 0.3, 1.8);
  if (sq > 0) {
    const lie = TH >= 24.0 && (TH >= 24.4 || Math.round(TH * FPS) % 3 !== 0);
    jch(lie ? '嘘' : '好', 1380, 470, 300, { fill: RED, w: 800, s: sq * (1 + 0.05 * kk), rot: -2 });
    jch(lie ? '嘘' : '好', 1380 + 8, 470, 300, { outline: rgba(WHITE, 0.4), ow: 2, s: sq * (1 + 0.05 * kk), rot: -2 });
  }
  const pq = pop(t, 22.6, 0.3);
  if (pq > 0) { if (t < 24.0) pauseIcon(1080, 470, 150 * pq, WHITE); else playIcon(1080, 470, 150 * pop(t, 24.0, 0.25, 2), WHITE); }
  jch('？', 1660, 330, 260, { outline: RED, ow: 6, w: 800, s: pop(t, 23.6, 0.3, 2.5), rot: 12 });
  crossMark(560, 760, 170 * pop(t, 23.0, 0.3, 2), 6);
  lyric('L9', t, { at: [[420, 330], [620, 400], [860, 790], [1030, 830], [1200, 790]], size: 230, red: [0] });
}
// S10 25.6–28.8  さよなら — mosaic thinning to white paper, characters dissolve into pixels
function s10(t) {
  const paper = TH >= 27.2;
  if (!paper) { ctx.drawImage(MOSAIC[step8(t) % 6], 0, 0); ctx.fillStyle = rgba(BLACK, 0.35); ctx.fillRect(0, 0, W, H);
    ctx.save(); cam({ r: 12, s: 0.8 + 0.04 * kick(t, 25.6, 10) }); heartPath(CX, CY + 40, 22); ctx.strokeStyle = RED; ctx.lineWidth = 12; ctx.stroke(); ctx.restore();
    for (let i = 0; i < 3; i++) scribble(t, 860 + i * 30, 30, i * 1.7, rgba(WHITE, 0.7), 2); }
  else { bg(PAPER); heartPath(CX, 900, 3.5 * (1 - P(t, 28.2, 28.6))); ctx.fillStyle = RED; ctx.fill(); }
  const l = LY.L10, sz = 280;
  [...l.text].forEach((ch, i) => {
    if (t < l.t[i]) return; const q = P(t, l.t[i], l.t[i] + 0.2), x = 540 + i * 280, y = CY - 40 + (i % 2 ? 30 : -30), dis = P(t, 28.1 + i * 0.06, 28.6 + i * 0.06);
    const look = paper ? { fill: BLACK } : { fill: WHITE, stroke: BLACK, sw: 22 };
    if (dis <= 0) jch(ch, x, y, sz, { ...look, s: L(1.8, 1, eOutX(q)), rot: (hash(i * 4) - 0.5) * 10, a: eOutX(q) });
    else {
      tctx.clearRect(0, 0, W, H); tctx.font = `500 ${sz}px Mincho`; tctx.textAlign = 'center'; tctx.textBaseline = 'middle'; tctx.fillStyle = paper ? BLACK : WHITE; tctx.fillText(ch, x, y);
      const B = 24;
      for (let by = y - sz / 2; by < y + sz / 2; by += B) for (let bx = x - sz / 2; bx < x + sz / 2; bx += B) {
        const hsh = hash((bx * 31 + by * 17) | 0), go = clamp((dis - hsh * 0.5) * 2.5); if (go >= 1) continue;
        ctx.globalAlpha = 1 - go; ctx.drawImage(TMP, bx, by, B, B, bx + (hsh - 0.5) * 300 * go, by - 260 * go * hsh, B, B);
      }
      ctx.globalAlpha = 1;
    }
  });
}
// S11 28.8–30  end card
function s11(t) {
  bg(BLACK);
  const p = pop(t, 28.8, 0.3, 2) * (1 - eIn3(P(t, 29.4, 29.8)));
  pixelHeart(CX, CY - 80, 120 * p * (1 + 0.1 * kick(t, 28.8, 8)), RED, { step: step8(t) });
  const a = P(t, 29.0, 29.3) * (1 - P(t, 29.6, 29.9));
  ctx.globalAlpha = a; ctx.fillStyle = WHITE; ctx.font = '500 34px Mincho'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '8px';
  ctx.fillText('文字PV', CX + 4, CY + 120); ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
  latin('STUDY Nº03', CX, CY + 175, 20, { fill: rgba(WHITE, 0.7 * a), track: 6 });
}

const SCENES = [[0, 3.2, s1], [3.2, 6.4, s2], [6.4, 9.6, s3], [9.6, 11.2, s4], [11.2, 12.8, s5], [12.8, 16.0, s6], [16.0, 19.2, s7], [19.2, 22.4, s8], [22.4, 25.6, s9], [25.6, 28.8, s10], [28.8, 30, s11]];
const CUTS = [3.2, 6.4, 9.6, 11.2, 12.8, 16.0, 19.2, 22.4, 25.6, 27.2, 28.8];

// glitch on every cut: horizontal bands of the finished frame shoved sideways, a few inverted blocks
function glitch(t) {
  let g = 0; for (const c of CUTS) g = Math.max(g, Math.exp(-Math.abs(t - c) * 26)); if (g < 0.05) return;
  tctx.clearRect(0, 0, W, H); tctx.drawImage(cv, 0, 0);
  const f = Math.floor(t * 60);
  for (let i = 0; i < 12; i++) { const y = hash(f * 31 + i) * H, h = 8 + hash(f * 17 + i) * 90, dx = (hash(f * 7 + i) - 0.5) * 360 * g; ctx.drawImage(TMP, 0, y, W, h, dx, y, W, h); }
  ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = WHITE;
  for (let i = 0; i < 3; i++) if (hash(f * 3 + i) < g) ctx.fillRect(hash(f * 5 + i) * W, hash(f * 9 + i) * H, 150 + hash(f + i) * 500, 16 + hash(f * 2 + i) * 60);
  ctx.globalCompositeOperation = 'source-over';
}

function draw(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash([]);
  TH = Math.round(t * FPS) / FPS;
  bg(BLACK);
  for (const [a, b, fn] of SCENES) if (TH >= a - 1e-6 && TH < b - 1e-6) { ctx.save(); fn(t); ctx.restore(); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.setLineDash([]);
  glitch(t);
  ctx.drawImage(VIG, 0, 0);
  const gi = Math.floor(t * FPS) % 3; ctx.globalAlpha = 0.07; ctx.fillStyle = GRAIN[gi];
  ctx.save(); ctx.translate((gi * 97) % 256, (gi * 61) % 256); ctx.fillRect(-256, -256, W + 512, H + 512); ctx.restore(); ctx.globalAlpha = 1;
  const blk = Math.max(1 - P(t, 0, 0.15), P(t, 29.85, 30)); if (blk > 0) { ctx.fillStyle = `rgba(0,0,0,${blk})`; ctx.fillRect(0, 0, W, H); }
}

window.setTime = t => draw(clamp(t, 0, DUR - 1e-4));
const acc = mk(W, H, () => {}), actx = acc.getContext('2d');
window.renderFrame = (f, SUB) => {
  for (let k = 0; k < SUB; k++) { window.setTime((f - 0.25 + (k + 0.5) * 0.5 / SUB) / FPS); actx.globalAlpha = 1 / (k + 1); actx.drawImage(cv, 0, 0); }
  actx.globalAlpha = 1; return acc.toDataURL('image/png').slice(22);
};
if (!location.search.includes('render')) { const t0 = performance.now(); const loop = () => { draw(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); }
