'use strict';
// "Choco Cornet" — a 16s kinetic-typography anime edit cut to 120 BPM.
// Footage: frames/NNNN.jpg (30fps, 1920x1080). Mattes: masks/NNNN.png (Konata cut-outs, mid shots).

const W = 1920, H = 1080, FPS = 30, DUR = 16, BPM = 120, BEAT = 60 / BPM;
const NFRAMES = 317;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

// palette
const BLUE = '#2b1cf6', YEL = '#ffe51c', LIME = '#38f238', PINK = '#ff4fa8', WHITE = '#ffffff', INK = '#140f3c';

// ---------- math / easing ----------
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut3 = t => 1 - Math.pow(1 - clamp(t), 3);
const easeIn3 = t => Math.pow(clamp(t), 3);
const easeInOut = t => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const backOut = (t, s = 2.2) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
const elastic = t => { t = clamp(t); return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1; };
function hash(n) { let h = Math.imul(n | 0, 2654435761) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; }
const pad = n => String(n).padStart(4, '0');
const fnum = s => Math.max(1, Math.min(NFRAMES, Math.round(s * FPS) + 1));

// ---------- image loading (draw -> collect misses -> load -> redraw) ----------
const loaded = new Map(); let missing = [];
function img(path) {
  const im = loaded.get(path);
  if (!im) { missing.push(path); return null; }
  loaded.delete(path); loaded.set(path, im); // LRU touch
  return im;
}
function loadInto(path) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => { loaded.set(path, im); while (loaded.size > 90) loaded.delete(loaded.keys().next().value); res(); };
    im.onerror = () => { console.log('missing ' + path); loaded.set(path, null); res(); };
    im.src = path;
  });
}

// ---------- camera / footage ----------
function applyCam(c, cam) {
  const z = cam.z || 1;
  let cx = cam.cx ?? W / 2, cy = cam.cy ?? H / 2;
  if (!cam.free) { // keep frame covered
    cx = clamp(cx, W / (2 * z), W - W / (2 * z));
    cy = clamp(cy, H / (2 * z), H - H / (2 * z));
  }
  c.translate(W / 2 + (cam.dx || 0), H / 2 + (cam.dy || 0));
  if (cam.rot) c.rotate(cam.rot);
  c.scale(z, z);
  c.translate(-cx, -cy);
}
function shot(src, cam, filter) {
  const f = img(`frames/${pad(fnum(src))}.jpg`); if (!f) return;
  ctx.save(); applyCam(ctx, cam);
  if (filter) ctx.filter = filter;
  ctx.drawImage(f, 0, 0, W, H);
  ctx.restore();
}
const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const tctx = tmp.getContext('2d');
function cutout(src, cam) { // re-draw the character on top of "behind" text
  const n = Math.min(252, Math.max(153, fnum(src)));
  const m = img(`masks/${pad(n)}.png`), f = img(`frames/${pad(fnum(src))}.jpg`);
  if (!m || !f) return;
  tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.globalCompositeOperation = 'source-over'; tctx.clearRect(0, 0, W, H);
  applyCam(tctx, cam); tctx.drawImage(m, 0, 0, W, H);
  tctx.globalCompositeOperation = 'source-in'; tctx.drawImage(f, 0, 0, W, H);
  tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(tmp, 0, 0);
}
// a beat-synced zoom pulse
function pulse(t, from, to, amt = 0.035) {
  if (t < from || t >= to) return 1;
  const since = (t - from) % BEAT;
  return 1 + amt * Math.exp(-since * 11);
}

// ---------- shake ----------
const HITS = [[0, 10], [0.5, 8], [1.0, 10], [1.5, 22], [2.5, 12], [3.0, 6], [3.5, 8], [4.0, 14], [4.5, 18], [5.0, 18], [5.5, 26],
  [6.0, 10], [6.75, 14], [7.0, 8], [7.75, 12], [8.25, 12], [9.25, 22], [10.25, 10], [11.4, 10],
  [12.5, 22], [12.625, 18], [12.75, 22], [12.875, 18], [13.0, 22], [13.125, 18], [13.25, 30], [13.5, 18], [15.5, 14]];
function shake(t) {
  let x = 0, y = 0;
  for (const [h, a] of HITS) {
    const d = t - h; if (d < 0 || d > 0.4) continue;
    const e = a * Math.exp(-d * 16);
    x += e * Math.sin(d * 85 + h * 3); y += e * Math.cos(d * 71 + h * 5);
  }
  return [x, y];
}

// ---------- typography ----------
function setFont(c, size, fam) { c.font = fam === 'dela' ? `${size}px Dela` : `700 ${size}px Fredoka`; }
function word(str, x, y, o, t) {
  const { t0, t1 = 1e9, size = 200, fam = 'dela', fill = WHITE, stroke = null, sw = 0, rot = 0, st = 0.035, dur = 0.34,
    shadow = null, so = 0.045, align = 'center', track = 0, fx = 'pop', outDur = 0.16, wobble = 1.5, alpha = 1 } = o;
  if (t < t0 || t > t1) return;
  ctx.save(); setFont(ctx, size, fam); ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.globalAlpha = alpha;
  const n = str.length, xs = [], ws = [];
  for (let i = 0; i < n; i++) { xs.push(ctx.measureText(str.slice(0, i)).width + i * track); ws.push(ctx.measureText(str[i]).width); }
  const total = ctx.measureText(str).width + (n - 1) * track;
  ctx.translate(x, y); ctx.rotate(rot * Math.PI / 180);
  const x0 = align === 'center' ? -total / 2 : align === 'right' ? -total : 0;
  const outP = easeIn3((t - (t1 - outDur)) / outDur);
  for (let i = 0; i < n; i++) {
    const ch = str[i]; if (ch === ' ') continue;
    const p = (t - t0 - i * st) / dur; if (p <= 0) continue;
    let sc = 1, dy = 0, dx = 0;
    if (fx === 'pop') sc = backOut(p);
    else if (fx === 'drop') { dy = -(1 - backOut(p, 1.6)) * size * 0.9; sc = Math.min(1, p * 3); }
    else if (fx === 'slam') { sc = lerp(1.7, 1, easeOut3(p)); }
    else if (fx === 'up') { dy = (1 - easeOut3(p)) * size * 0.6; sc = clamp(p * 2); }
    sc *= 1 - outP; if (sc <= 0.002) continue;
    const cx = x0 + xs[i] + ws[i] / 2;
    const r = (hash(i * 31 + n) - 0.5) * 0.25 * (1 - clamp(p)) + Math.sin(t * 5 + i * 1.7) * wobble * Math.PI / 180;
    ctx.save(); ctx.translate(cx + dx, -size * 0.36 + dy); ctx.rotate(r); ctx.scale(sc, sc); ctx.translate(-ws[i] / 2, size * 0.36);
    if (shadow) { ctx.fillStyle = shadow; if (stroke) { ctx.strokeStyle = shadow; ctx.lineWidth = sw * 2; ctx.strokeText(ch, size * so, size * so); } ctx.fillText(ch, size * so, size * so); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw * 2; ctx.strokeText(ch, 0, 0); }
    ctx.fillStyle = fill; ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function tiles(str, x, y, o, t) {
  const { t0, t1 = 1e9, size = 110, st = 0.08, colors = [YEL, WHITE, BLUE], inks = [INK, INK, WHITE], outDur = 0.16 } = o;
  if (t < t0 || t > t1) return;
  const gap = size * 0.16, n = str.length, total = n * size + (n - 1) * gap;
  const outP = easeIn3((t - (t1 - outDur)) / outDur);
  ctx.save(); setFont(ctx, size * 0.66, 'fred'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (str[i] === ' ') continue;
    const p = (t - t0 - i * st) / 0.3; if (p <= 0) { k++; continue; }
    const sc = Math.min(1, p * 2.5) * (1 - outP); if (sc <= 0.002) { k++; continue; }
    const cx = x - total / 2 + i * (size + gap) + size / 2;
    const dy = -(1 - backOut(p, 1.8)) * size * 1.4 + Math.sin((t - t0) * Math.PI * 4 + i * 1.1) * size * 0.04;
    const rot = (hash(i + n * 7) - 0.5) * 0.3;
    ctx.save(); ctx.translate(cx, y + dy); ctx.rotate(rot); ctx.scale(sc, sc);
    ctx.fillStyle = INK; rrect(ctx, -size / 2 + size * 0.06, -size / 2 + size * 0.07, size, size, size * 0.18); ctx.fill();
    ctx.fillStyle = colors[k % colors.length]; rrect(ctx, -size / 2, -size / 2, size, size, size * 0.18); ctx.fill();
    ctx.fillStyle = inks[k % inks.length]; ctx.fillText(str[i], 0, size * 0.04);
    ctx.restore(); k++;
  }
  ctx.restore();
}
function pill(str, x, y, o, t) {
  const { t0, t1 = 1e9, size = 56, bg = YEL, fg = INK, from = 1, rot = 0 } = o;
  if (t < t0 || t > t1) return;
  ctx.save(); setFont(ctx, size, 'fred');
  const w = ctx.measureText(str).width + size * 1.3, h = size * 1.5;
  const pin = backOut((t - t0) / 0.38, 1.5), pout = easeIn3((t - (t1 - 0.2)) / 0.2);
  const ox = (1 - pin) * from * 1400 + pout * -from * 1400;
  ctx.translate(x + ox, y); ctx.rotate(rot * Math.PI / 180);
  ctx.fillStyle = INK; rrect(ctx, -w / 2 + 8, -h / 2 + 9, w, h, h / 2); ctx.fill();
  ctx.fillStyle = bg; rrect(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(str, 0, size * 0.05);
  ctx.restore();
}
function star(x, y, r, o, t) {
  const { t0, t1 = 1e9, fill = YEL, spin = 1.2 } = o;
  if (t < t0 || t > t1) return;
  const sc = backOut((t - t0) / 0.35, 2.6) * (1 - easeIn3((t - (t1 - 0.15)) / 0.15));
  if (sc <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate((t - t0) * spin + 0.3); ctx.scale(sc, sc);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.46 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.lineJoin = 'round';
  ctx.fillStyle = INK; ctx.save(); ctx.translate(r * 0.08, r * 0.1); ctx.fill(); ctx.restore();
  ctx.fillStyle = fill; ctx.fill();
  ctx.restore();
}
function vstrip(str, side, o, t) { // vertical marquee tag on a frame edge
  const { t0, t1 = 1e9, bg = YEL, fg = INK, w = 84 } = o;
  if (t < t0 || t > t1) return;
  const pin = easeOut3((t - t0) / 0.3), pout = easeIn3((t - (t1 - 0.2)) / 0.2);
  const off = (1 - pin + pout) * w * 1.3;
  const x = side < 0 ? -off : W - w + off;
  ctx.save(); ctx.fillStyle = bg; ctx.fillRect(x, 0, w, H);
  ctx.beginPath(); ctx.rect(x, 0, w, H); ctx.clip();
  setFont(ctx, w * 0.52, 'dela'); ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const step = w * 0.6, chars = (str + '  ★  ').repeat(6), scroll = ((t - t0) * 140) % ((str.length + 5) * step);
  for (let i = 0; i < chars.length; i++) { const yy = i * step - scroll; if (yy > -step && yy < H + step) ctx.fillText(chars[i], x + w / 2, yy); }
  ctx.restore();
}
function band(str, o, t) { // diagonal colour band, bottom-right
  const { t0, t1 = 1e9, bg = BLUE, fg = WHITE, size = 84 } = o;
  if (t < t0 || t > t1) return;
  const pin = backOut((t - t0) / 0.35, 1.3), pout = easeIn3((t - (t1 - 0.18)) / 0.18);
  ctx.save(); ctx.translate(W - 520 + (1 - pin + pout) * 1300, H - 120); ctx.rotate(-0.08);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-480, -70); ctx.lineTo(900, -95); ctx.lineTo(900, 95); ctx.lineTo(-520, 75); ctx.closePath(); ctx.fill();
  setFont(ctx, size, 'dela'); ctx.fillStyle = fg; ctx.textBaseline = 'middle'; ctx.fillText(str, -430, 6);
  ctx.restore();
}
function iris(t, t0, dur, cx, cy, inside, ring = YEL) {
  const p = easeInOut((t - t0) / dur); if (t < t0) return;
  const r = p * 1900;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip(); inside(); ctx.restore();
  if (p < 1) { ctx.save(); ctx.strokeStyle = ring; ctx.lineWidth = 70 * (1 - p) + 6; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
}
function flash(t, at, a = 0.75, col = '#fff') {
  const d = t - at; if (d < 0 || d > 0.12) return;
  ctx.save(); ctx.globalAlpha = a * (1 - d / 0.12); ctx.fillStyle = col; ctx.fillRect(-100, -100, W + 200, H + 200); ctx.restore();
}
function bg(col) { ctx.fillStyle = col; ctx.fillRect(-100, -100, W + 200, H + 200); }

// ---------- HUD ----------
function hud(t) {
  if (t > 15.6) return;
  const a = clamp(t / 0.3) * (1 - clamp((t - 15.4) / 0.2));
  ctx.save(); ctx.globalAlpha = 0.85 * a; ctx.fillStyle = WHITE; setFont(ctx, 20, 'fred');
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6;
  ctx.textBaseline = 'top'; ctx.fillText('CHOCO CORNET ☆ EDIT', 44, 34);
  ctx.textAlign = 'right'; ctx.font = '20px Dela'; ctx.fillText('らき☆すた', W - 44, 32);
  setFont(ctx, 20, 'fred'); ctx.textBaseline = 'bottom'; ctx.textAlign = 'left'; ctx.fillText('WHICH END FIRST?', 44, H - 30);
  const f = Math.floor(t * FPS), tc = `00:${String(Math.floor(t)).padStart(2, '0')}:${String(f % FPS).padStart(2, '0')}`;
  ctx.textAlign = 'right'; ctx.fillText(`${tc}  ·  ${BPM} BPM`, W - 44, H - 30);
  // beat dots
  const b = Math.floor(t / BEAT) % 4;
  for (let i = 0; i < 4; i++) { ctx.globalAlpha = a * (i === b ? 0.95 : 0.3); ctx.beginPath(); ctx.arc(W / 2 - 36 + i * 24, H - 42, 5, 0, 7); ctx.fill(); }
  ctx.restore();
}

// ======================================================================
// TIMELINE
// ======================================================================
const S = { A: 2.5, A2: 4.0, B: 4.5, C: 6.0, D1: 6.75, D2: 8.25, E: 10.25, ST: 12.5, OUT: 13.25 };
const camA = t => ({ z: lerp(1.22, 1.3, (t - S.A) / 1.5) * pulse(t, S.A, S.A2), cx: 1000, cy: 455 });
const srcA = t => 0.4 + (t - S.A);
const camB = t => ({ z: lerp(1.04, 1.12, (t - S.B) / 1.5) * pulse(t, S.B, S.C, 0.06), cx: 960, cy: 560 });
const srcB = t => 2.9 + (t - S.B);
const camC = t => ({ z: lerp(1.06, 1.16, (t - S.C) / 0.75), cx: 900, cy: 600 });
const srcC = t => 4.45 + (t - S.C) * 0.82;
const camD1 = t => ({ z: lerp(1.02, 1.08, (t - S.D1) / 1.5) * pulse(t, S.D1, S.D2, 0.025), cx: 960, cy: 520 });
const srcD1 = t => 5.08 + (t - S.D1) * 0.88;
const camD2 = t => ({ z: lerp(1.02, 1.1, (t - S.D2) / 2) * pulse(t, S.D2 + 1, S.E, 0.03), cx: 900, cy: 520 });
const srcD2 = t => 6.4 + (t - S.D2);
const camE = t => { const p = easeInOut((t - 11.2) / 1.2); return { z: lerp(1.0, 1.1, (t - S.E) / 2.25) * pulse(t, S.E, S.ST, 0.02), cx: lerp(900, 1180, p), cy: 560 }; };
const srcE = t => 8.42 + (t - S.E) * 0.95;
const STUT = [[3.7, 1.35, 900, 560], [4.9, 1.25, 700, 760], [5.45, 1.2, 760, 520], [4.0, 1.45, 960, 560], [7.2, 1.25, 820, 480], [1.0, 1.4, 960, 400]];

function frame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const [sx, sy] = shake(t);
  ctx.translate(sx, sy);

  // ---------------- INTRO (0 - 2.5) ----------------
  if (t < S.A + 0.01) {
    bg(BLUE);
    word('WHICH', W / 2, 500, { t0: 0.0, t1: 1.0, size: 250, rot: -5, shadow: INK, wobble: 2 }, t);
    star(1480, 300, 70, { t0: 0.08, t1: 1.0 }, t);
    word('END', W / 2, 780, { t0: 0.5, t1: 1.0, size: 290, fill: YEL, rot: -5, shadow: INK, st: 0.06 }, t);
    word('DO YOU EAT', W / 2, 470, { t0: 1.0, t1: 2.0, size: 190, rot: 4, shadow: INK, st: 0.03 }, t);
    word('FIRST?', W / 2, 800, { t0: 1.5, t1: 2.0, size: 330, fill: YEL, rot: -3, shadow: INK, fx: 'slam', dur: 0.2, st: 0.03 }, t);
    star(420, 820, 60, { t0: 1.55, t1: 2.0, fill: WHITE }, t);
    star(1560, 250, 46, { t0: 1.62, t1: 2.0 }, t);
    // giant sweeping letters
    if (t >= 2.0) {
      const p = (t - 2.0) / 0.5;
      ctx.save(); setFont(ctx, 1000, 'dela'); ctx.fillStyle = WHITE; ctx.textBaseline = 'middle';
      ctx.fillText('CHOCO', lerp(W * 0.9, -3600, easeInOut(p)), H / 2 + 40); ctx.restore();
      iris(t, 2.28, 0.24, W / 2, H / 2, () => shot(srcA(S.A), camA(S.A)), YEL);
    }
  }

  // ---------------- A: the explanation (2.5 - 4.0) ----------------
  if (t >= S.A && t < S.A2) {
    shot(srcA(t), camA(t));
    tiles('FAT END', 1240, 210, { t0: 2.62, t1: 4.0, size: 104, st: 0.07 }, t);
    pill('…or the skinny one?', 1250, 360, { t0: 3.25, t1: 4.0, size: 46, bg: WHITE }, t);
    word('?', 1640, 760, { t0: 3.5, t1: 4.0, size: 300, fill: YEL, stroke: INK, sw: 14, wobble: 8 }, t);
    vstrip('チョココロネ', -1, { t0: S.A, t1: S.A2 }, t);
  }
  // A2: freeze on Kagami's sweat drop
  if (t >= S.A2 && t < S.B) {
    const p = easeOut3((t - S.A2) / 0.2);
    shot(2.62, { z: lerp(1.3, 2.3, p), cx: lerp(1000, 640, p), cy: lerp(455, 280, p) }, 'saturate(0.55) contrast(1.1)');
    for (let i = 0; i < 3; i++) word('•', 1180 + i * 170, 640, { t0: 4.05 + i * 0.1, t1: 4.5, size: 260, fill: WHITE, stroke: INK, sw: 10, wobble: 0 }, t);
    pill('KAGAMI.EXE has stopped', 1300, 860, { t0: 4.12, t1: 4.5, size: 40, bg: WHITE }, t);
  }

  // ---------------- B: NOM (4.5 - 6.0) ----------------
  if (t >= S.B && t < S.C + 0.26) {
    shot(srcB(Math.min(t, S.C)), camB(Math.min(t, S.C)));
    word('NOM!', 420, 400, { t0: 4.5, t1: 5.25, size: 230, rot: -10, stroke: BLUE, sw: 18, fx: 'slam', dur: 0.16 }, t);
    word('NOM!', 1480, 330, { t0: 5.0, t1: 5.75, size: 230, rot: 9, fill: YEL, stroke: INK, sw: 18, fx: 'slam', dur: 0.16 }, t);
    word('NOM!!', 980, 930, { t0: 5.5, t1: 6.0, size: 270, rot: -4, fill: PINK, stroke: WHITE, sw: 18, fx: 'slam', dur: 0.16 }, t);
    star(250, 760, 54, { t0: 5.5, t1: 6.0 }, t);
    star(1720, 680, 40, { t0: 5.55, t1: 6.0, fill: WHITE }, t);
  }
  // ---------------- C: chocolate end, iris in (6.0 - 6.75) ----------------
  if (t >= S.C && t < S.D1) {
    iris(t, S.C, 0.26, 640, 860, () => { bg(WHITE); shot(srcC(t), camC(t)); }, BLUE);
    pill('← CHOCO SIDE', 1240, 840, { t0: 6.12, t1: 6.75, size: 58 }, t);
    star(1500, 260, 50, { t0: 6.2, t1: 6.75 }, t);
  }

  // ---------------- D1: WAIT (behind her) (6.75 - 8.25) ----------------
  if (t >= S.D1 && t < S.D2) {
    const cam = camD1(t), src = srcD1(t);
    shot(src, cam);
    word('WAIT', W / 2 + 40, 600, { t0: 6.75, t1: 7.75, size: 470, fill: YEL, shadow: INK, so: 0.03, st: 0.05, fx: 'up', dur: 0.3, wobble: 0.6 }, t);
    word('WHAT?!', W / 2 + 40, 560, { t0: 7.75, t1: 8.25, size: 380, fill: WHITE, stroke: BLUE, sw: 16, st: 0.03, fx: 'pop', dur: 0.22, wobble: 0.6 }, t);
    cutout(src, cam);
    band('WHICH END?!', { t0: 7.0, t1: 8.25 }, t);
    word('!?', 1640, 330, { t0: 7.4, t1: 7.78, size: 240, fill: YEL, stroke: INK, sw: 12, wobble: 6 }, t);
  }

  // ---------------- D2: sideways — picture-in-picture, then behind-text (8.25 - 10.25) ----------------
  if (t >= S.D2 && t < S.E) {
    const cam = camD2(t), src = srcD2(t);
    const pinIn = easeOut3((t - S.D2) / 0.22), pinOut = easeInOut((t - 9.25) / 0.22);
    const k = t < 9.25 ? pinIn : 1 - pinOut; // 0 = full frame, 1 = PiP
    if (k > 0.001) {
      bg(LIME);
      tiles('SIDEWAYS', W / 2, 150, { t0: 8.3, t1: 9.3, size: 96, st: 0.06, colors: [BLUE, YEL, WHITE], inks: [WHITE, INK, INK] }, t);
      const s = lerp(1, 0.62, k), rw = W * s, rh = H * s, rx = (W - rw) / 2, ry = (H - rh) / 2 + 70 * k, r = 46 * k;
      ctx.save();
      ctx.fillStyle = INK; rrect(ctx, rx + 16 * k, ry + 18 * k, rw, rh, r); ctx.fill();
      rrect(ctx, rx, ry, rw, rh, r); ctx.clip();
      ctx.translate(rx, ry); ctx.scale(s, s); shot(src, cam);
      ctx.restore();
      word('?', 1560, 900, { t0: 8.6, t1: 9.3, size: 250, fill: WHITE, stroke: INK, sw: 12, wobble: 8 }, t);
      star(330, 860, 64, { t0: 8.45, t1: 9.3, fill: YEL }, t);
      vstrip('TAIL FIRST', -1, { t0: 8.3, t1: 9.3, bg: BLUE, fg: WHITE }, t);
    } else {
      shot(src, cam);
      word('SIDEWAYS', W / 2, 470, { t0: 9.3, t1: 10.25, size: 300, fill: WHITE, stroke: BLUE, sw: 16, shadow: INK, so: 0.03, st: 0.04, fx: 'drop', wobble: 0.6 }, t);
      cutout(src, cam);
      pill('the bold strategy', 1380, 930, { t0: 9.6, t1: 10.25, size: 50, bg: PINK, fg: WHITE }, t);
    }
  }

  // ---------------- E: wide, Miyuki arrives (10.25 - 12.5) ----------------
  if (t >= S.E && t < S.ST) {
    shot(srcE(t), camE(t));
    tiles('NOM', 780, 250, { t0: 10.35, t1: 11.5, size: 86, st: 0.1 }, t);
    pill('MIYUKI-SAN ↓', 1450, 200, { t0: 11.35, t1: 12.5, size: 56, bg: PINK, fg: WHITE }, t);
    word('?', 1700, 520, { t0: 11.85, t1: 12.5, size: 230, fill: YEL, stroke: INK, sw: 12, wobble: 8 }, t);
    tiles('POLITE', 760, 880, { t0: 11.9, t1: 12.5, size: 78, st: 0.05, colors: [WHITE, PINK], inks: [INK, WHITE] }, t);
  }

  // ---------------- stutter montage (12.5 - 13.25) ----------------
  if (t >= S.ST && t < S.OUT) {
    const i = Math.min(5, Math.floor((t - S.ST) / 0.125)), [src, z, cx, cy] = STUT[i];
    shot(src, { z: z + (t - S.ST - i * 0.125) * 0.6, cx, cy }, i % 2 ? 'saturate(1.6) contrast(1.15)' : 'none');
    const cols = [YEL, WHITE, PINK, LIME, YEL, WHITE];
    word(i === 5 ? '!!' : 'NOM', W / 2 + (i % 2 ? 260 : -260), 620 + (i % 3 - 1) * 120, { t0: S.ST + i * 0.125, t1: S.ST + i * 0.125 + 0.125, size: 300, fill: cols[i], stroke: INK, sw: 16, fx: 'slam', dur: 0.08, st: 0.01, outDur: 0.01, rot: i % 2 ? 8 : -8 }, t);
  }

  // ---------------- OUTRO (13.25 - 16) ----------------
  if (t >= S.OUT) {
    bg(BLUE);
    const out = t >= 15.5 ? 15.75 : 1e9;
    word('CHOCO', W / 2 - 60, 500, { t0: 13.25, t1: out, size: 310, shadow: INK, fx: 'slam', dur: 0.2, st: 0.04 }, t);
    word('CORNET', W / 2 - 20, 790, { t0: 13.5, t1: out, size: 270, fill: YEL, shadow: INK, fx: 'slam', dur: 0.2, st: 0.04 }, t);
    star(1600, 260, 80, { t0: 13.62, t1: out }, t);
    star(300, 880, 56, { t0: 13.75, t1: out, fill: WHITE }, t);
    star(1720, 900, 40, { t0: 13.85, t1: out, fill: LIME }, t);
    vstrip('チョココロネ', 1, { t0: 13.5, t1: out }, t);
    pill('which end do you eat first?', W / 2, 965, { t0: 14.25, t1: out, size: 44, bg: WHITE }, t);
  }

  // cut flashes
  for (const at of [S.A, S.B, S.D1, S.D2, 9.25, S.E, S.OUT]) flash(t, at);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  hud(t);
  // closing iris to black
  if (t > 15.5) {
    const r = lerp(1250, 0, easeInOut((t - 15.5) / 0.4));
    ctx.save(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2, Math.max(0.1, r), 0, Math.PI * 2, true); ctx.fill(); ctx.restore();
  }
}

window.renderFrame = async t => {
  for (let k = 0; k < 5; k++) {
    missing = []; frame(t);
    if (!missing.length) return true;
    await Promise.all([...new Set(missing)].map(loadInto));
  }
  return true;
};
window.ready = Promise.all([document.fonts.load('40px Dela'), document.fonts.load('700 40px Fredoka'), document.fonts.load('600 40px Fredoka')]).then(() => true);
if (!/render/.test(location.search)) {
  window.ready.then(async () => {
    const t0 = performance.now();
    const loop = async () => { await window.renderFrame(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); };
    loop();
  });
}
