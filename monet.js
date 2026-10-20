'use strict';
// Claude Monet — a 30s procedural impressionist showreel.
// Every frame is re-painted from thousands of brushstrokes that sample a hidden
// "reference" painting. Strokes paint themselves in, boil on twos, and carry
// broken color, so each scene reads as paint rather than pixels.

const W = 1920, H = 1080, DUR = 30, FPS = 30;
const OX = W * 0.08, OY = H * 0.08;          // overscan so the camera never sees an edge
const WW = W * 1.16, WH = H * 1.16;          // world size in px
const RW = 464, RH = 261;                     // reference resolution
const GROW = 0.34;                            // seconds for one stroke to be laid down

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOut3 = t => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = t => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOutExpo = t => { t = clamp(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); };
function rng(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => noise(x, y) * 0.55 + noise(x * 2.1 + 7, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3 + 3) * 0.15;
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
function piecewise(keys, t) { // keys: [[t,v],...] smooth between
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) return lerp(v0, v1, easeInOut((t - t0) / (t1 - t0)));
  }
  return keys[keys.length - 1][1];
}

// ---------- reference painting ----------
const refCv = document.createElement('canvas'); refCv.width = RW; refCv.height = RH;
const rctx = refCv.getContext('2d', { willReadFrequently: true });
function renderRef(scene, t) {
  rctx.setTransform(1, 0, 0, 1, 0, 0);
  rctx.globalAlpha = 1; rctx.globalCompositeOperation = 'source-over';
  rctx.fillStyle = '#000'; rctx.fillRect(0, 0, RW, RH);
  rctx.setTransform(RW / WW, 0, 0, RH / WH, 0, 0);
  scene.ref(rctx, t);
  rctx.setTransform(1, 0, 0, 1, 0, 0);
  return rctx.getImageData(0, 0, RW, RH).data;
}
const SAMP = [0, 0, 0];
function sample(d, wx, wy) {
  const x = clamp((wx / WW * RW) | 0, 0, RW - 1), y = clamp((wy / WH * RH) | 0, 0, RH - 1);
  const i = (y * RW + x) * 4;
  SAMP[0] = d[i]; SAMP[1] = d[i + 1]; SAMP[2] = d[i + 2];
  return SAMP;
}

// ---------- stroke field ----------
function genStrokes(sc) {
  const R = rng(sc.seed); const S = [];
  let id = 0;
  const add = (wx, wy, layer, len, wid) => {
    const u = wx / WW, v = wy / WH;
    const ang = sc.flow(u, v, wx, wy) + (R() - 0.5) * (layer === 0 ? 0.7 : 0.38);
    S.push({ id: id++, x: wx, y: wy, layer, len, wid, ang, curv: (R() - 0.5) * 0.55,
      s: R(), j0: R() - 0.5, j1: R() - 0.5, j2: R() - 0.5, hl: R(), d: 0 });
  };
  const cols = 38, rows = 21;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) for (let k = 0; k < 2; k++)
    add((c + R()) * WW / cols, (r + R()) * WH / rows, 0, lerp(95, 150, R()), lerp(48, 70, R()));
  for (let i = 0; i < sc.nMid; i++) add(R() * WW, R() * WH, 1, lerp(48, 96, R()), lerp(14, 25, R()));
  let n = 0, tries = 0;
  while (n < sc.nFine && tries < sc.nFine * 8) {
    tries++;
    const wx = R() * WW, wy = R() * WH;
    if (R() > sc.density(wx / WW, wy / WH, wx, wy)) continue;
    add(wx, wy, 2, lerp(15, 40, R()), lerp(4.5, 9, R())); n++;
  }
  let end = 0;
  const lay = [0, 0.1, 0.22];
  for (const s of S) {
    s.d = sc.revealStart + clamp(sc.pattern(s.x / WW, s.y / WH, s.x, s.y)) * sc.spread + lay[s.layer] + s.s * 0.18;
    end = Math.max(end, s.d + GROW);
    s.slice = sc.slices ? Math.floor(clamp((s.x / WW) * 0.75 + s.s * 0.25) * (sc.slices - 0.001)) : 0;
  }
  sc.revealEnd = end;
  sc.strokes = S;
}

function strokePath(x0, y0, cx, cy, x1, y1, g) {
  ctx.moveTo(x0, y0);
  if (g >= 1) { ctx.quadraticCurveTo(cx, cy, x1, y1); return; }
  const qx = lerp(x0, cx, g), qy = lerp(y0, cy, g);
  const rx = lerp(cx, x1, g), ry = lerp(cy, y1, g);
  ctx.quadraticCurveTo(qx, qy, lerp(qx, rx, g), lerp(qy, ry, g));
}

const AMP = [9, 15, 22];
const ALPHA = [0.94, 0.86, 0.9];
function drawScene(sc, t, isBottom) {
  const refs = [];
  const nS = sc.slices || 1;
  for (let k = 0; k < nS; k++) refs.push(renderRef(sc, t - (nS > 1 ? k * sc.smear / (nS - 1) : 0)));
  ctx.save();
  applyCamera(sc.camera(t));
  ctx.translate(-OX, -OY);
  if (isBottom) { ctx.fillStyle = sc.bg; ctx.fillRect(-50, -50, WW + 100, WH + 100); }
  if (sc.under) sc.under(ctx, t);
  ctx.lineCap = 'round';
  const tq = Math.floor(t * 12);
  const ja = sc.jitter || 1;
  for (const s of sc.strokes) {
    const a = (t - s.d) / GROW;
    if (a <= 0) continue;
    const g = easeOut3(a);
    let x = s.x, y = s.y, ang = s.ang;
    if (s.layer > 0) { // boil on twos
      x += (hash2(s.id, tq) - 0.5) * 1.6;
      y += (hash2(s.id + 9999, tq) - 0.5) * 1.6;
      ang += (hash2(s.id + 5555, tq) - 0.5) * 0.05;
    }
    if (sc.move) { const m = sc.move(s, t); x += m[0]; y += m[1]; }
    const c = sample(refs[s.slice], x, y);
    const amp = AMP[s.layer] * ja;
    const L = s.j1 * amp * 0.9;
    let r = c[0] + s.j0 * amp + L, gg = c[1] + s.j2 * amp * 0.6 + L, b = c[2] - s.j0 * amp * 0.5 + L;
    if (s.layer === 2 && s.hl < 0.2) { // broken color: violet shadows, warm lights
      const lum = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255;
      if (lum < 0.45) { r += 14; gg -= 10; b += 26; } else { r += 22; gg += 12; b -= 18; }
    }
    const col = `rgb(${r | 0},${gg | 0},${b | 0})`;
    const hl2 = s.len * 0.5, dx = Math.cos(ang) * hl2, dy = Math.sin(ang) * hl2;
    const nx = -dy * s.curv, ny = dx * s.curv;
    ctx.globalAlpha = ALPHA[s.layer] * Math.min(1, a * 3);
    ctx.strokeStyle = col;
    ctx.lineWidth = s.wid * (0.55 + 0.45 * g);
    ctx.beginPath(); strokePath(x - dx, y - dy, x + nx, y + ny, x + dx, y + dy, g); ctx.stroke();
    if (s.layer === 0) { // broad brush: bristle grooves
      const ca = Math.cos(ang), sa = Math.sin(ang), base = ctx.globalAlpha;
      ctx.lineWidth = s.wid * 0.16;
      for (let k = -2; k <= 2; k++) {
        if (!k) continue;
        const off = k * s.wid * 0.19, px = -sa * off, py = ca * off, sh = (hash2(s.id, k + 7) - 0.5) * 50;
        ctx.globalAlpha = base * 0.4;
        ctx.strokeStyle = `rgb(${(r + sh) | 0},${(gg + sh) | 0},${(b + sh) | 0})`;
        const kk = 1 - Math.abs(k) * 0.12;
        ctx.beginPath(); strokePath(x - dx * kk + px, y - dy * kk + py, x + nx + px, y + ny + py, x + dx * kk + px, y + dy * kk + py, g); ctx.stroke();
      }
    } else { // bristle highlight
      const off = s.wid * 0.24, px = -Math.sin(ang) * off, py = Math.cos(ang) * off;
      ctx.globalAlpha *= 0.42;
      ctx.strokeStyle = `rgb(${(r + 30) | 0},${(gg + 28) | 0},${(b + 24) | 0})`;
      ctx.lineWidth = s.wid * 0.28;
      ctx.beginPath(); strokePath(x - dx * 0.9 + px, y - dy * 0.9 + py, x + nx + px, y + ny + py, x + dx * 0.8 + px, y + dy * 0.8 + py, g); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  if (sc.accents) sc.accents(ctx, t);
  ctx.restore();
}

function applyCamera(c) {
  ctx.translate(W / 2, H / 2);
  if (c.r) ctx.rotate(c.r);
  ctx.scale(c.s, c.s);
  ctx.translate(-W / 2 + (c.x || 0), -H / 2 + (c.y || 0));
}

// a hand-placed dab (used by accents)
function dab(c, x, y, ang, len, wid, col, alpha, g = 1) {
  const dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2;
  c.globalAlpha = alpha; c.strokeStyle = col; c.lineWidth = wid; c.lineCap = 'round';
  c.beginPath(); strokePath(x - dx, y - dy, x - dy * 0.15, y + dx * 0.15, x + dx, y + dy, g); c.stroke();
}

// ======================================================================
// SCENES
// ======================================================================
const T = { s2: 8.0, s3: 13.6, s4: 18.8, s5: 24.2 };

// ---------- I. Impression, soleil levant ----------
const sunPos = t => ({ x: 1306, y: 500 - t * 3.2 });
const harbor = (() => {
  const R = rng(11), b = [], m = [], st = [];
  for (let i = 0; i < 16; i++) b.push({ x: 60 + i * 64 + R() * 30, w: 50 + R() * 50, h: 20 + R() * 70 });
  for (let i = 0; i < 11; i++) m.push({ x: 180 + R() * 880, h: 150 + R() * 200, w: 13 + R() * 8 });
  for (let i = 0; i < 4; i++) st.push({ x: 1650 + i * 95 + R() * 30, h: 120 + R() * 140 });
  return { b, m, st };
})();
function boat(r, x, y, k, col = '#1b2731') {
  r.fillStyle = col;
  r.beginPath(); r.ellipse(x, y, 135 * k, 17 * k, 0.02, 0, Math.PI * 2); r.fill();
  r.fillRect(x - 10 * k, y - 66 * k, 18 * k, 58 * k);
  r.beginPath(); r.arc(x - 1 * k, y - 74 * k, 11 * k, 0, 7); r.fill();
  r.strokeStyle = col; r.lineWidth = 6 * k;
  r.beginPath(); r.moveTo(x - 4 * k, y - 40 * k); r.lineTo(x + 120 * k, y + 30 * k); r.stroke();
}
const S1 = {
  seed: 101, nMid: 2300, nFine: 4600, revealStart: 2.15, spread: 1.9, bg: '#110e0c',
  pattern(u, v) { const s = sunPos(3); return Math.hypot((u - s.x / WW) * 1.78, v - s.y / WH) / 1.25 + (noise(u * 6, v * 6) - 0.5) * 0.18; },
  flow(u, v, wx, wy) {
    if (wy < 640) return -0.32 + (noise(u * 3, v * 3) - 0.5) * 1.5;
    return (noise(u * 4, v * 9) - 0.5) * 0.28;
  },
  density(u, v, wx, wy) {
    const s = sunPos(3);
    const ds = Math.exp(-(((wx - s.x) / 260) ** 2 + ((wy - s.y - 180) / 380) ** 2));
    const hz = Math.exp(-(((wy - 650) / 110) ** 2));
    const bt = Math.exp(-(((wx - 860) / 220) ** 2 + ((wy - 920) / 90) ** 2));
    return 0.32 + 0.68 * Math.max(ds, hz * 0.8, bt);
  },
  ref(r, t) {
    const s = sunPos(t);
    let g = r.createLinearGradient(0, 0, 0, 660);
    g.addColorStop(0, '#4a5e76'); g.addColorStop(0.55, '#7b8592'); g.addColorStop(1, '#a89b90');
    r.fillStyle = g; r.fillRect(0, 0, WW, 660);
    g = r.createRadialGradient(s.x, s.y, 0, s.x, s.y, 640);
    g.addColorStop(0, 'rgba(244,150,88,.8)'); g.addColorStop(0.32, 'rgba(214,138,112,.38)'); g.addColorStop(1, 'rgba(200,140,120,0)');
    r.fillStyle = g; r.fillRect(0, 0, WW, 660);
    g = r.createLinearGradient(0, 640, 0, WH);
    g.addColorStop(0, '#77848b'); g.addColorStop(0.35, '#4c6576'); g.addColorStop(1, '#283f4f');
    r.fillStyle = g; r.fillRect(0, 640, WW, WH - 640);
    r.save(); r.translate(s.x, 760); r.scale(1, 0.5);
    g = r.createRadialGradient(0, 0, 0, 0, 0, 520);
    g.addColorStop(0, 'rgba(226,130,84,.55)'); g.addColorStop(1, 'rgba(200,120,90,0)');
    r.fillStyle = g; r.fillRect(-600, -700, 1200, 1400); r.restore();
    // harbor haze
    r.fillStyle = 'rgba(98,112,126,.8)';
    for (const b of harbor.b) r.fillRect(b.x, 600 - b.h, b.w, b.h + 50);
    r.fillStyle = 'rgba(72,88,104,.75)';
    for (const m of harbor.m) r.fillRect(m.x, 640 - m.h, m.w, m.h);
    r.strokeStyle = 'rgba(72,88,104,.7)'; r.lineWidth = 6;
    r.beginPath(); r.moveTo(420, 300); r.lineTo(640, 520); r.moveTo(420, 300); r.lineTo(420, 640); r.stroke();
    r.fillStyle = 'rgba(88,98,112,.75)';
    for (const m of harbor.st) r.fillRect(m.x, 640 - m.h, 28, m.h);
    r.fillStyle = 'rgba(120,128,136,.35)';
    for (const m of harbor.st) { r.beginPath(); r.ellipse(m.x - 30, 640 - m.h - 60, 90, 40, -0.3, 0, 7); r.fill(); }
    // mast reflections
    r.fillStyle = 'rgba(60,78,92,.3)';
    for (const m of harbor.m) r.fillRect(m.x - 4, 650, m.w + 8, m.h * 0.6);
    // sun reflection
    for (let i = 0; i < 15; i++) {
      const y = 672 + i * 30, w = (84 - i * 3.6) * (0.65 + 0.35 * Math.sin(t * 2.3 + i * 1.3));
      r.fillStyle = `rgba(242,108,38,${0.9 - i * 0.04})`;
      r.fillRect(s.x - w / 2 + Math.sin(t * 1.7 + i) * 12, y, w, 11);
    }
    boat(r, 860, 930, 1.0); boat(r, 1430, 800, 0.62, '#22303a'); boat(r, 560, 736, 0.38, '#34434e');
    r.fillStyle = '#ff6a1c'; r.beginPath(); r.arc(s.x, s.y, 38, 0, 7); r.fill();
  },
  camera(t) {
    const e = easeInOut((t - 0.2) / 4.4);
    const s = sunPos(t);
    const sx = s.x - OX, sy = s.y - OY;
    return { s: lerp(2.5, 1.0, e) + Math.max(0, t - 4.6) * 0.01, x: (1 - e) * (W / 2 - sx), y: (1 - e) * (H / 2 - sy) };
  },
  move(s, t) { return s.y > 650 && s.layer > 0 ? [Math.sin(t * 1.3 + s.y * 0.05 + s.s * 6) * 3.5, 0] : [0, 0]; },
  accents(c, t) {
    const s = sunPos(t);
    const gr = clamp((t - 0.25) / 1.2);
    // glow
    c.save(); c.globalCompositeOperation = 'lighter';
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.2);
    const g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, 190);
    g.addColorStop(0, `rgba(255,140,60,${0.42 * gr * pulse})`); g.addColorStop(1, 'rgba(255,120,40,0)');
    c.fillStyle = g; c.globalAlpha = 1; c.fillRect(s.x - 200, s.y - 200, 400, 400);
    c.restore();
    const sr = 36 * easeOutExpo((t - 0.3) / 0.9);
    if (sr > 0.5) {
      c.globalAlpha = 1;
      const sg = c.createRadialGradient(s.x - 8, s.y - 6, 0, s.x, s.y, sr);
      sg.addColorStop(0, '#ff9a48'); sg.addColorStop(0.7, '#ff6a1c'); sg.addColorStop(1, '#f25a14');
      c.fillStyle = sg; c.beginPath(); c.arc(s.x, s.y, sr, 0, 7); c.fill();
      const cols = ['#ffb060', '#ff8434', '#ff7426', '#ffc070'];
      for (let k = 0; k < 4; k++) {
        const a = (t - 0.7 - k * 0.12) / 0.45; if (a <= 0) continue;
        dab(c, s.x - 4 + (k - 1.5) * 3, s.y - 18 + k * 12, -0.08 + k * 0.05, sr * (k === 0 || k === 3 ? 1.0 : 1.5), 9, cols[k], 0.7 * Math.min(1, a * 2), easeOut3(a));
      }
    }
    for (let i = 0; i < 14; i++) {
      const a = (t - 3.0 - i * 0.08) / 0.4; if (a <= 0) continue;
      const y = 680 + i * 30, w = (70 - i * 3.4);
      const sh = 0.55 + 0.45 * Math.sin(t * 4.1 + i * 1.7);
      dab(c, s.x + Math.sin(t * 1.7 + i) * 12 + Math.sin(i * 3.7) * 10, y, 0.03 * Math.sin(i), w, 9, i % 3 ? '#ff7a2c' : '#ffa050', Math.min(1, a * 2) * sh, easeOut3(a));
    }
  },
};

// ---------- II. Les Meules (series) ----------
const HP = {
  dawn:   { skyTop: '#c4b2d8', skyBot: '#f4caa6', hills: '#a08fbb', fieldFar: '#e5bb90', field: '#c89a7c', lit: '#f4a468', shade: '#8a6ea9', shadow: '#6e62a6', glow: [255, 196, 150], ga: 0.55, snow: 0 },
  noon:   { skyTop: '#86acd8', skyBot: '#e2e8e6', hills: '#8aa1ba', fieldFar: '#d9d184', field: '#b4ad5a', lit: '#f3d47a', shade: '#9e7756', shadow: '#5b6e98', glow: [255, 250, 220], ga: 0.35, snow: 0 },
  dusk:   { skyTop: '#5e4888', skyBot: '#f7864a', hills: '#764a7a', fieldFar: '#d67046', field: '#954a3e', lit: '#ff7638', shade: '#55306a', shadow: '#3c285e', glow: [255, 110, 50], ga: 0.7, snow: 0 },
  winter: { skyTop: '#aebfdc', skyBot: '#f3e2e4', hills: '#97a4c6', fieldFar: '#eef1f7', field: '#dae1ee', lit: '#e8c8c2', shade: '#7a76aa', shadow: '#8790c6', glow: [255, 232, 228], ga: 0.4, snow: 1 },
};
const HKEYS = [HP.dawn, HP.noon, HP.dusk, HP.winter].map(p => {
  const o = {}; for (const k in p) o[k] = typeof p[k] === 'string' ? hex(p[k]) : p[k]; return o;
});
const hPhase = t => piecewise([[0, 0], [1.75, 0], [2.3, 1], [2.85, 1], [3.4, 2], [3.95, 2], [4.5, 3]], t - T.s2);
function hPal(t) {
  const ph = hPhase(t), i = Math.min(2, Math.floor(ph)), f = ph - i;
  const A = HKEYS[i], B = HKEYS[i + 1], o = {};
  for (const k in A) o[k] = Array.isArray(A[k]) ? mix(A[k], B[k], f) : lerp(A[k], B[k], f);
  return o;
}
function hayStack(r, P, cx, base, w, hb, hr) {
  let g = r.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, css(mix(P.lit, [255, 240, 220], 0.15))); g.addColorStop(0.45, css(P.lit)); g.addColorStop(0.62, css(mix(P.lit, P.shade, 0.6))); g.addColorStop(1, css(P.shade));
  r.fillStyle = g;
  r.beginPath(); r.moveTo(cx - w * 0.46, base);
  r.quadraticCurveTo(cx - w * 0.53, base - hb * 0.5, cx - w * 0.5, base - hb);
  r.bezierCurveTo(cx - w * 0.5, base - hb - hr * 0.62, cx - w * 0.22, base - hb - hr, cx, base - hb - hr);
  r.bezierCurveTo(cx + w * 0.22, base - hb - hr, cx + w * 0.5, base - hb - hr * 0.62, cx + w * 0.5, base - hb);
  r.quadraticCurveTo(cx + w * 0.53, base - hb * 0.5, cx + w * 0.46, base);
  r.closePath(); r.fill();
  r.strokeStyle = css(P.shade, 0.7); r.lineWidth = w * 0.03;
  r.beginPath(); r.moveTo(cx - w * 0.52, base - hb + 6); r.quadraticCurveTo(cx, base - hb + w * 0.08, cx + w * 0.52, base - hb + 6); r.stroke();
  if (P.snow > 0.01) {
    r.fillStyle = `rgba(246,244,250,${0.9 * P.snow})`;
    r.beginPath(); r.moveTo(cx - w * 0.46, base - hb - hr * 0.45);
    r.bezierCurveTo(cx - w * 0.42, base - hb - hr * 0.9, cx - w * 0.2, base - hb - hr - 6, cx, base - hb - hr - 6);
    r.bezierCurveTo(cx + w * 0.2, base - hb - hr - 6, cx + w * 0.42, base - hb - hr * 0.9, cx + w * 0.44, base - hb - hr * 0.45);
    r.quadraticCurveTo(cx, base - hb - hr * 0.28, cx - w * 0.46, base - hb - hr * 0.45); r.fill();
  }
}
const STK = { cx: 900, base: 1010, w: 540, hb: 270, hr: 270 };
const S2 = {
  seed: 202, nMid: 2300, nFine: 4400, revealStart: T.s2, spread: 1.05, bg: '#c9a98a', slices: 6, smear: 0.75,
  pattern(u, v) { return u * 0.85 + (noise(u * 5, v * 5) - 0.5) * 0.3; },
  flow(u, v, wx, wy) {
    const { cx, base, w, hb, hr } = STK;
    if (Math.abs(wx - cx) < w * 0.52 && wy < base && wy > base - hb - hr) {
      if (wy < base - hb) return (wx - cx) / (w * 0.5) * 1.1 + (noise(u * 9, v * 9) - 0.5) * 0.4;
      return Math.PI / 2 + (wx - cx) / w * 0.5;
    }
    if (wy < 700) return -0.12 + (noise(u * 3, v * 4) - 0.5) * 0.7;
    return (noise(u * 5, v * 8) - 0.5) * 0.35;
  },
  density(u, v, wx, wy) {
    const st = Math.exp(-(((wx - STK.cx) / 330) ** 2 + ((wy - 800) / 340) ** 2));
    const hz = Math.exp(-(((wy - 700) / 90) ** 2));
    return 0.33 + 0.67 * Math.max(st, hz * 0.7);
  },
  ref(r, t) {
    const P = hPal(t);
    let g = r.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, css(P.skyTop)); g.addColorStop(1, css(P.skyBot));
    r.fillStyle = g; r.fillRect(0, 0, WW, 720);
    g = r.createRadialGradient(240, 660, 0, 240, 660, 1100);
    g.addColorStop(0, css(P.glow, P.ga)); g.addColorStop(1, css(P.glow, 0));
    r.fillStyle = g; r.fillRect(0, 0, WW, WH);
    r.fillStyle = css(P.hills);
    r.beginPath(); r.moveTo(0, 730);
    for (let x = 0; x <= WW; x += 40) r.lineTo(x, 640 - fbm(x * 0.002, 3) * 90);
    r.lineTo(WW, 730); r.closePath(); r.fill();
    g = r.createLinearGradient(0, 700, 0, WH);
    g.addColorStop(0, css(P.fieldFar)); g.addColorStop(1, css(P.field));
    r.fillStyle = g; r.fillRect(0, 700, WW, WH - 700);
    r.fillStyle = css(P.shadow, 0.85);
    r.beginPath(); r.ellipse(STK.cx + STK.w * 0.62, STK.base - 8, STK.w * 0.78, 36, 0, 0, 7); r.fill();
    r.beginPath(); r.ellipse(1640 + 150, 846, 170, 18, 0, 0, 7); r.fill();
    hayStack(r, P, 1640, 850, 240, 120, 125);
    hayStack(r, P, STK.cx, STK.base, STK.w, STK.hb, STK.hr);
  },
  camera(t) { const lt = t - T.s2; return { s: 1.03 + lt * 0.009, x: -lt * 5, y: 0 }; },
};

// ---------- III. Le Pont japonais ----------
const BR = { p0: [150, 660], c: [1113, 262], p1: [2077, 660] };
const brPt = s => [lerp(lerp(BR.p0[0], BR.c[0], s), lerp(BR.c[0], BR.p1[0], s), s), lerp(lerp(BR.p0[1], BR.c[1], s), lerp(BR.c[1], BR.p1[1], s), s)];
const brPoly = Array.from({ length: 81 }, (_, i) => brPt(i / 80));
const garden = (() => {
  const R = rng(33), fol = [], pads = [];
  const fc = ['#5f8a3c', '#86a84a', '#3d6b4f', '#2a4a32', '#a9c060', '#4f7a5a', '#6d9440', '#33573c'];
  for (let i = 0; i < 170; i++) {
    const y = R() * 700;
    const lil = y < 330 && R() < 0.35;
    fol.push({ x: R() * WW, y, rx: lil ? 25 + R() * 45 : 40 + R() * 90, ry: lil ? 40 + R() * 90 : 70 + R() * 170, col: lil ? (R() < 0.5 ? '#a996c8' : '#c6b2de') : fc[(R() * fc.length) | 0], a: 0.55 + R() * 0.4 });
  }
  for (const [y, n] of [[700, 14], [760, 12], [840, 10], [940, 9], [1060, 8], [1190, 7]]) {
    for (let i = 0; i < n; i++) {
      const rx = 26 + (y - 640) * 0.2 * (0.7 + R() * 0.6);
      pads.push({ x: (i + R()) * WW / n, y: y + (R() - 0.5) * 30, rx, ry: rx * 0.3, col: ['#7fa65a', '#5c8a4a', '#9cbf6a', '#4e7a46'][(R() * 4) | 0], fl: R() < 0.3 ? (R() < 0.6 ? '#eea2b6' : '#f6eee2') : null });
    }
  }
  return { fol, pads };
})();
function bridgeCurve(r, dy, flip = 0) {
  r.beginPath();
  if (!flip) { r.moveTo(BR.p0[0], BR.p0[1] + dy); r.quadraticCurveTo(BR.c[0], BR.c[1] + dy, BR.p1[0], BR.p1[1] + dy); }
  else { const m = 700; r.moveTo(BR.p0[0], 2 * m - BR.p0[1] - dy); r.quadraticCurveTo(BR.c[0], 2 * m - BR.c[1] - dy - 120, BR.p1[0], 2 * m - BR.p1[1] - dy); }
}
const S3 = {
  seed: 303, nMid: 2400, nFine: 4600, revealStart: T.s3, spread: 1.0, bg: '#2e4a32',
  pattern(u, v) { return (1 - v) * 0.72 + (noise(u * 5, v * 5) - 0.5) * 0.4; },
  flow(u, v, wx, wy) {
    let best = 1e9, bi = 0;
    for (let i = 0; i < brPoly.length; i++) { const d = Math.hypot(wx - brPoly[i][0], wy - brPoly[i][1] + 40); if (d < best) { best = d; bi = i; } }
    if (best < 70) { const a = brPoly[Math.max(0, bi - 1)], b = brPoly[Math.min(80, bi + 1)]; return Math.atan2(b[1] - a[1], b[0] - a[0]); }
    if (wy < 680) return Math.PI / 2 + (noise(u * 4, v * 3) - 0.5) * 0.8;
    return (noise(u * 5, v * 9) - 0.5) * 0.3;
  },
  density(u, v, wx, wy) {
    let best = 1e9;
    for (const p of brPoly) best = Math.min(best, Math.hypot(wx - p[0], wy - p[1] + 40));
    return 0.36 + 0.64 * Math.max(Math.exp(-((best / 120) ** 2)), wy > 680 ? 0.55 : 0);
  },
  ref(r, t) {
    let g = r.createLinearGradient(0, 0, 0, 700);
    g.addColorStop(0, '#21392a'); g.addColorStop(1, '#3b5c33');
    r.fillStyle = g; r.fillRect(0, 0, WW, 700);
    for (const f of garden.fol) { r.globalAlpha = f.a; r.fillStyle = f.col; r.beginPath(); r.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, 7); r.fill(); }
    r.globalAlpha = 1;
    g = r.createLinearGradient(0, 660, 0, WH);
    g.addColorStop(0, '#4d6e58'); g.addColorStop(0.5, '#36594c'); g.addColorStop(1, '#2c4a46');
    r.fillStyle = g; r.fillRect(0, 660, WW, WH - 660);
    for (const f of garden.fol) { if (f.y < 350) continue; r.globalAlpha = 0.28; r.fillStyle = f.col; r.fillRect(f.x - f.rx * 0.5, 680 + (700 - f.y) * 0.6, f.rx, f.ry * 0.9); }
    r.globalAlpha = 0.45; r.fillStyle = '#9db8a6'; r.fillRect(0, 770, WW, 50);
    r.globalAlpha = 0.3; r.strokeStyle = '#7fa576'; r.lineWidth = 26; bridgeCurve(r, 0, 1); r.stroke();
    r.globalAlpha = 1;
    for (const p of garden.pads) {
      const x = p.x + Math.sin(t * 0.6 + p.y) * 6;
      r.fillStyle = p.col; r.beginPath(); r.ellipse(x, p.y, p.rx, p.ry, 0, 0, 7); r.fill();
      if (p.fl) { r.fillStyle = p.fl; r.beginPath(); r.ellipse(x + p.rx * 0.2, p.y - p.ry * 0.3, p.rx * 0.28, p.ry * 0.5, 0, 0, 7); r.fill(); }
    }
    r.strokeStyle = 'rgba(26,44,30,.85)'; r.lineWidth = 20; bridgeCurve(r, 20); r.stroke();
    r.strokeStyle = '#7aa06a'; r.lineWidth = 11;
    for (let k = 1; k < 26; k++) { const [x, y] = brPt(k / 26); r.beginPath(); r.moveTo(x, y); r.lineTo(x, y - 86); r.stroke(); }
    r.strokeStyle = '#6c935c'; r.lineWidth = 32; bridgeCurve(r, 0); r.stroke();
    r.strokeStyle = '#94b67c'; r.lineWidth = 8; bridgeCurve(r, -44); r.stroke();
    r.strokeStyle = '#b0cc92'; r.lineWidth = 14; bridgeCurve(r, -88); r.stroke();
  },
  camera(t) { const lt = t - T.s3; return { s: 1.0 + lt * 0.013, x: -lt * 3, y: lt * 2 }; },
  accents(c, t) {
    for (let k = 1; k < 26; k++) {
      const [x, y] = brPt(k / 26);
      const a = (t - (this.revealStart + clamp(this.pattern(x / WW, (y - 40) / WH)) * this.spread + 0.35)) / 0.35; if (a <= 0) continue;
      dab(c, x + (hash2(k, 3) - 0.5) * 4, y - 42, Math.PI / 2 + (hash2(k, 4) - 0.5) * 0.12, 74, 8, k % 2 ? '#8db57a' : '#a6c68e', 0.85 * clamp(a * 2), easeOut3(a));
    }
    for (let k = 0; k < 48; k++) {
      const s0 = k / 48, [x0, y0] = brPt(s0), [x1, y1] = brPt(s0 + 1 / 48);
      const a = (t - (this.revealStart + clamp(this.pattern(x0 / WW, (y0 - 88) / WH)) * this.spread + 0.45)) / 0.35; if (a <= 0) continue;
      const ang = Math.atan2(y1 - y0, x1 - x0);
      dab(c, (x0 + x1) / 2, (y0 + y1) / 2 - 88, ang, 52, 11, k % 3 ? '#c4dca6' : '#e2ecc6', 0.85 * clamp(a * 2), easeOut3(a));
      dab(c, (x0 + x1) / 2, (y0 + y1) / 2 + 2, ang, 50, 16, k % 2 ? '#5f8a52' : '#729c62', 0.6 * clamp(a * 2), easeOut3(a));
    }
  },
  move(s, t) { return s.y > 700 && s.layer > 0 ? [Math.sin(t * 1.1 + s.y * 0.04 + s.s * 6) * 3, 0] : [0, 0]; },
};

// ---------- IV. Nymphéas ----------
const pond = (() => {
  const R = rng(44), pads = [], refl = [];
  for (let i = 0; i < 30; i++) {
    const y = R() * WH, rx = 60 + R() * 90 + y * 0.04;
    pads.push({ x: R() * (WW + 400), y, rx, ry: rx * (0.34 + R() * 0.12), a0: R() * 6.28, col: ['#5f8f4e', '#86ad5e', '#3f6f4a', '#9dbd6c', '#4d7f52'][(R() * 5) | 0], fl: R() < 0.38 ? ['#f2a6bd', '#f8d0da', '#fbf4ea', '#e98aa6'][(R() * 4) | 0] : null, sp: 12 + R() * 10 });
  }
  for (let i = 0; i < 6; i++) refl.push({ x: R() * WW, y: R() * WH, rx: 300 + R() * 400, ry: 70 + R() * 90, rot: -0.35 + R() * 0.2, col: R() < 0.6 ? '#c3cce6' : '#ead6e4', a: 0.35 + R() * 0.25 });
  return { pads, refl };
})();
const padX = (p, t) => ((p.x + (t - T.s4) * p.sp) % (WW + 400)) - 200;
const S4 = {
  seed: 404, nMid: 2400, nFine: 4500, revealStart: T.s4, spread: 1.1, bg: '#30477a',
  pattern(u, v) { return u * 0.55 + v * 0.45 + (noise(u * 5, v * 5) - 0.5) * 0.35; },
  flow(u, v) { return 0.08 + (noise(u * 2.5, v * 3) - 0.5) * 0.7; },
  density(u, v) { return 0.45 + 0.55 * noise(u * 4, v * 4); },
  ref(r, t) {
    let g = r.createLinearGradient(0, 0, 0, WH);
    g.addColorStop(0, '#33467a'); g.addColorStop(0.5, '#2c4a7c'); g.addColorStop(1, '#43629e');
    r.fillStyle = g; r.fillRect(0, 0, WW, WH);
    for (const x of [280, 1120, 1860]) {
      g = r.createLinearGradient(x - 140, 0, x + 140, 0);
      g.addColorStop(0, 'rgba(24,58,70,0)'); g.addColorStop(0.5, 'rgba(24,58,70,.55)'); g.addColorStop(1, 'rgba(24,58,70,0)');
      r.fillStyle = g; r.fillRect(x - 140, 0, 280, WH);
    }
    for (const q of pond.refl) {
      r.save(); r.translate(q.x + Math.sin(t * 0.3 + q.y) * 30, q.y); r.rotate(q.rot); r.globalAlpha = q.a;
      g = r.createRadialGradient(0, 0, 0, 0, 0, q.rx); g.addColorStop(0, q.col); g.addColorStop(1, 'rgba(200,210,235,0)');
      r.scale(1, q.ry / q.rx); r.fillStyle = g; r.beginPath(); r.arc(0, 0, q.rx, 0, 7); r.fill(); r.restore();
    }
    r.globalAlpha = 1;
    for (const p of pond.pads) {
      const x = padX(p, t);
      r.fillStyle = p.col; r.beginPath(); r.moveTo(x, p.y);
      r.ellipse(x, p.y, p.rx, p.ry, 0, p.a0 + 0.28, p.a0 + Math.PI * 2 - 0.28); r.closePath(); r.fill();
      r.fillStyle = 'rgba(190,220,140,.35)'; r.beginPath(); r.ellipse(x - p.rx * 0.2, p.y - p.ry * 0.3, p.rx * 0.5, p.ry * 0.4, 0, 0, 7); r.fill();
    }
  },
  camera(t) { const lt = t - T.s4; return { s: 1.03 + lt * 0.01, r: -0.012 + lt * 0.004, x: lt * 4, y: 0 }; },
  move(s, t) { return s.layer > 0 ? [Math.sin(t * 0.9 + s.y * 0.012 + s.s * 6) * 3.5, Math.cos(t * 0.7 + s.x * 0.01) * 1.2] : [0, 0]; },
  accents(c, t) {
    for (const p of pond.pads) {
      if (!p.fl) continue;
      const a = (t - (T.s4 + 0.9 + clamp(this.pattern(p.x / WW, p.y / WH)) * 1.1)) / 0.5; if (a <= 0) continue;
      const x = padX(p, t) + p.rx * 0.15, y = p.y - p.ry * 0.25, k = p.rx / 130;
      const R = rng(Math.floor(p.x * 13));
      const tq = Math.floor(t * 12);
      for (let i = 0; i < 11; i++) {
        const ang = -Math.PI / 2 + (R() - 0.5) * 2.6;
        const ai = clamp(a * 1.4 - i * 0.04);
        const ll = (18 + R() * 20) * k, rr = (4 + R() * 9) * k;
        const col = R() < 0.55 ? p.fl : (R() < 0.5 ? '#fff1f3' : '#f6c2cf');
        const bx = (hash2(i, tq) - 0.5) * 1.5;
        dab(c, x + Math.cos(ang) * rr + bx, y + Math.sin(ang) * rr * 0.7, ang + (R() - 0.5) * 0.6, ll, (6 + R() * 6) * k, col, (0.55 + R() * 0.35) * ai, easeOut3(ai));
      }
      dab(c, x + 2 * k, y - 3 * k, 0.3, 9 * k, 7 * k, '#f2cf62', 0.75 * clamp(a), 1);
    }
  },
};

// ---------- V. Finale ----------
const S5 = {
  seed: 505, nMid: 1900, nFine: 3000, revealStart: T.s5, spread: 1.3, bg: '#efe5d2', jitter: 0.75,
  pattern(u, v) { return Math.hypot((u - 0.5) * 1.78, v - 0.5) / 1.0 + (noise(u * 5, v * 5) - 0.5) * 0.2; },
  flow(u, v) { return Math.atan2(v - 0.5, (u - 0.5) * 1.78) + Math.PI / 2 + (noise(u * 3, v * 3) - 0.5) * 0.6; },
  density(u, v) { return 0.5 + 0.5 * clamp(Math.hypot((u - 0.5) * 1.78, v - 0.5) * 1.6); },
  ref(r, t) {
    r.fillStyle = '#efe5d2'; r.fillRect(0, 0, WW, WH);
    const B = [[260, 220, '240,176,136', 0.6, 760], [1980, 260, '182,176,224', 0.55, 780], [300, 1160, '184,210,160', 0.55, 720], [1940, 1120, '240,184,200', 0.55, 720], [1113, 626, '249,243,232', 0.95, 680]];
    for (const [x, y, c, a, rr] of B) {
      const g = r.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`);
      r.fillStyle = g; r.fillRect(0, 0, WW, WH);
    }
  },
  camera(t) { const lt = t - T.s5; return { s: 1.05 - lt * 0.007, x: 0, y: 0 }; },
};

const SCENES = [S1, S2, S3, S4, S5];
for (const s of SCENES) genStrokes(s);

// ======================================================================
// TYPOGRAPHY & MOTION GRAPHICS
// ======================================================================
const CREAM = '#f5eddd';
function text(str, x, y, o, t) {
  const t0 = o.t0, t1 = o.t1, out = o.out ?? 0.55;
  if (t < t0 || t > t1) return;
  ctx.save();
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 300} ${o.size}px ${o.family || 'CG'}`;
  ctx.textBaseline = 'alphabetic';
  const tr = o.track || 0, n = str.length;
  const xs = []; for (let i = 0; i < n; i++) xs.push(ctx.measureText(str.slice(0, i)).width + i * tr);
  const total = ctx.measureText(str).width + (n - 1) * tr;
  const x0 = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  const op = clamp((t - (t1 - out)) / out);
  const st = o.stagger ?? 0.035, dur = o.dur ?? 0.7;
  if (o.shadow !== false) { ctx.shadowColor = o.shadowColor || 'rgba(10,8,6,.45)'; ctx.shadowBlur = o.size * 0.35; }
  ctx.fillStyle = o.color || CREAM;
  for (let i = 0; i < n; i++) {
    const ch = str[i]; if (ch === ' ') continue;
    const p = easeOutExpo((t - t0 - i * st) / dur);
    if (p <= 0) continue;
    const eo = easeInOut(op);
    const alpha = Math.min(1, p * 1.2) * (1 - eo) * (o.alpha ?? 1);
    if (alpha <= 0.003) continue;
    const blur = (1 - p) * o.size * 0.12 + eo * o.size * 0.1;
    ctx.filter = blur > 0.4 ? `blur(${blur.toFixed(1)}px)` : 'none';
    ctx.globalAlpha = alpha;
    const dy = (1 - p) * o.size * 0.32 - eo * o.size * 0.12;
    const spread = eo * (i - n / 2) * o.size * 0.02;
    ctx.fillText(ch, x0 + xs[i] + spread, y + dy);
  }
  ctx.restore();
}
const caps = (str, x, y, o, t) => text(str, x, y, Object.assign({ family: 'Inter', weight: 500, size: 15, track: 5.5, stagger: 0.018, dur: 0.6 }, o), t);

const CHAPTERS = [
  { t0: 3.6, t1: 8.3, num: 'I', name: 'Impression', title: 'Impression, soleil levant', place: 'LE HAVRE', year: '1872' },
  { t0: 9.0, t1: 13.8, num: 'II', name: 'The Series', title: 'Les Meules', place: 'GIVERNY', year: '1890' },
  { t0: 14.5, t1: 19.0, num: 'III', name: 'The Garden', title: 'Le Pont japonais', place: 'GIVERNY', year: '1899' },
  { t0: 19.7, t1: 24.3, num: 'IV', name: 'The Water', title: 'Nymphéas', place: 'L’ORANGERIE', year: '1914' },
];
function hairline(x, y, len, t, t0, t1, alpha = 0.8) {
  const p = easeOutExpo((t - t0) / 0.9) * (1 - easeInOut((t - (t1 - 0.5)) / 0.5));
  if (p <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha * Math.min(1, p * 1.5); ctx.fillStyle = CREAM;
  ctx.fillRect(x, y, len * p, 1.5); ctx.restore();
}
function odometer(t) {
  const keys = [[3.6, '1872'], [8.4, '1890'], [13.9, '1899'], [19.1, '1914']];
  const vis = clamp((t - 3.7) / 0.6) * (1 - clamp((t - 23.9) / 0.5));
  if (vis <= 0) return;
  let k = 0; for (let i = 0; i < keys.length; i++) if (t >= keys[i][0]) k = i;
  const from = keys[Math.max(0, k - 1)][1], to = keys[k][1];
  const size = 84, cw = size * 0.5, lh = size * 1.05;
  const xr = W - 150, yb = 990;
  ctx.save();
  ctx.font = `300 ${size}px CG`; ctx.textAlign = 'center'; ctx.fillStyle = CREAM;
  ctx.shadowColor = 'rgba(10,8,6,.45)'; ctx.shadowBlur = 24;
  ctx.globalAlpha = vis;
  ctx.beginPath(); ctx.rect(xr - cw * 4 - 10, yb - lh * 0.82, cw * 4 + 20, lh); ctx.clip();
  for (let d = 0; d < 4; d++) {
    const a = +from[d], b = +to[d], steps = (b - a + 10) % 10;
    const p = k === 0 ? 1 : easeInOut((t - keys[k][0] - d * 0.08) / 1.0);
    const pos = a + steps * p, base = Math.floor(pos), fr = pos - base;
    const cx = xr - cw * (3.5 - d);
    ctx.fillText(String(base % 10), cx, yb - fr * lh);
    if (fr > 0.001) ctx.fillText(String((base + 1) % 10), cx, yb + (1 - fr) * lh);
  }
  ctx.restore();
}
function chapterUI(t) {
  for (const c of CHAPTERS) {
    if (t < c.t0 || t > c.t1) continue;
    hairline(150, 899, 56, t, c.t0, c.t1);
    caps(`${c.num}   ${c.name.toUpperCase()}`, 224, 906, { t0: c.t0 + 0.1, t1: c.t1 }, t);
    text(c.title, 148, 972, { t0: c.t0 + 0.25, t1: c.t1, size: 50, italic: true, weight: 300, stagger: 0.025 }, t);
    caps(c.place, W - 150, 906 - 0, { t0: c.t0 + 0.2, t1: c.t1, align: 'right' }, t);
  }
  odometer(t);
  // progress hairline
  const vis = clamp((t - 3.4) / 0.6) * (1 - clamp((t - 24.0) / 0.5));
  if (vis > 0) {
    ctx.save(); ctx.globalAlpha = 0.22 * vis; ctx.fillStyle = CREAM; ctx.fillRect(150, 1030, W - 300, 1);
    ctx.globalAlpha = 0.85 * vis; ctx.fillRect(150, 1029.5, (W - 300) * clamp((t - 3.4) / (24.3 - 3.4)), 2);
    for (const c of CHAPTERS) { const x = 150 + (W - 300) * clamp((c.t0 - 3.4) / (24.3 - 3.4)); ctx.globalAlpha = (t >= c.t0 ? 0.9 : 0.35) * vis; ctx.beginPath(); ctx.arc(x, 1030.5, 3.2, 0, 7); ctx.fill(); }
    ctx.restore();
  }
}
function hayTicker(t) {
  const t0 = 9.4, t1 = 13.7;
  if (t < t0 || t > t1) return;
  const labels = ['DAWN', 'NOON', 'DUSK', 'WINTER'];
  const ph = hPhase(t);
  const vis = clamp((t - t0) / 0.5) * (1 - clamp((t - (t1 - 0.4)) / 0.4));
  ctx.save();
  ctx.font = '500 14px Inter'; ctx.letterSpacing = '5px';
  ctx.shadowColor = 'rgba(10,8,6,.4)'; ctx.shadowBlur = 12;
  const gap = 150, xr = W - 150, y = 128;
  const xs = labels.map((_, i) => xr - (3 - i) * gap);
  labels.forEach((l, i) => {
    const act = 1 - clamp(Math.abs(ph - i) * 1.4);
    ctx.globalAlpha = vis * (0.38 + 0.62 * act); ctx.fillStyle = CREAM; ctx.textAlign = 'center';
    ctx.fillText(l, xs[i], y);
  });
  const dx = lerp(xs[0], xs[3], ph / 3);
  ctx.globalAlpha = vis; ctx.fillStyle = CREAM;
  ctx.beginPath(); ctx.arc(dx, y + 22, 3.5, 0, 7); ctx.fill();
  ctx.globalAlpha = vis * 0.3; ctx.fillRect(xs[0], y + 21.5, xs[3] - xs[0], 1);
  ctx.restore();
}
const PALETTE = ['#e8743b', '#f0a24a', '#e7c25a', '#8fb35f', '#5f9a78', '#5b7fb8', '#8a86c8', '#c79ad0'].map(hex);
function paintedUnderline(t, t0) {
  const p = easeInOut((t - t0) / 1.1);
  if (p <= 0) return;
  const R = rng(77), N = 150;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < N * p; i++) {
    const u = i / N, x = lerp(650, 1270, u), y = 628 + Math.sin(u * 3.4 + 0.4) * 9 - u * 6;
    const ci = u * (PALETTE.length - 1), c = mix(PALETTE[Math.floor(ci)], PALETTE[Math.min(PALETTE.length - 1, Math.floor(ci) + 1)], ci % 1);
    const w = 13 * Math.sin(Math.PI * clamp(u * 1.05 + 0.02)) ** 0.5 + 2;
    for (let k = 0; k < 3; k++) {
      const jy = (R() - 0.5) * w * 0.8;
      ctx.globalAlpha = 0.5 + R() * 0.4;
      ctx.strokeStyle = css(mix(c, [255, 250, 240], R() * 0.25));
      ctx.lineWidth = w * (0.35 + R() * 0.5);
      ctx.beginPath(); ctx.moveTo(x - 6, y + jy); ctx.lineTo(x + 6, y + jy + (R() - 0.5) * 2); ctx.stroke();
    }
  }
  ctx.restore();
}
function finale(t) {
  if (t < 24.8) return;
  const ink = '#2a231e', sh = { shadow: false };
  caps('THE FATHER OF IMPRESSIONISM', W / 2, 395, Object.assign({ t0: 25.0, t1: 31, align: 'center', color: '#8a6a52', size: 16, track: 9 }, sh), t);
  text('Claude Monet', W / 2, 575, Object.assign({ t0: 25.3, t1: 31, size: 210, italic: true, weight: 300, align: 'center', color: ink, stagger: 0.055, dur: 1.1 }, sh), t);
  paintedUnderline(t, 26.2);
  text('1840 — 1926', W / 2, 720, Object.assign({ t0: 26.9, t1: 31, size: 46, weight: 300, align: 'center', color: '#5a4a3e', track: 6, stagger: 0.04 }, sh), t);
  caps('PARIS  ·  LE HAVRE  ·  ARGENTEUIL  ·  GIVERNY', W / 2, 800, Object.assign({ t0: 27.4, t1: 31, align: 'center', color: '#9a8270', size: 13, track: 6 }, sh), t);
}
function statements(t) {
  text('He didn’t paint things.', W / 2, 760, { t0: 0.45, t1: 2.55, size: 70, italic: true, align: 'center', stagger: 0.03 }, t);
  text('He painted light.', 150, 360, { t0: 3.3, t1: 7.7, size: 124, italic: true, stagger: 0.045, dur: 0.9 }, t);
  text('One subject.', 150, 285, { t0: 9.3, t1: 11.5, size: 104, italic: true, stagger: 0.04 }, t);
  text('Every hour of light.', 150, 285, { t0: 11.35, t1: 13.6, size: 104, italic: true, stagger: 0.035 }, t);
  text('He built a garden', W / 2, 210, { t0: 14.6, t1: 16.9, size: 100, italic: true, align: 'center', stagger: 0.035 }, t);
  text('to paint it for 43 years.', W / 2, 210, { t0: 16.75, t1: 18.85, size: 100, italic: true, align: 'center', stagger: 0.03 }, t);
  text('250 canvases', W / 2, 520, { t0: 19.8, t1: 22.0, size: 130, italic: true, align: 'center', stagger: 0.045 }, t);
  text('of water, sky & light.', W / 2, 520, { t0: 21.85, t1: 24.1, size: 110, italic: true, align: 'center', stagger: 0.03 }, t);
}

// ======================================================================
// POST
// ======================================================================
const small = document.createElement('canvas'); small.width = 480; small.height = 270; const sctx = small.getContext('2d');
const blurC = document.createElement('canvas'); blurC.width = 480; blurC.height = 270; const bctx = blurC.getContext('2d');
const vign = document.createElement('canvas'); vign.width = W; vign.height = H;
{ const v = vign.getContext('2d'); const g = v.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(12,9,7,0)'); g.addColorStop(1, 'rgba(12,9,7,.62)'); v.fillStyle = g; v.fillRect(0, 0, W, H); }
const tex = document.createElement('canvas'); tex.width = W; tex.height = H;
{ const tc = tex.getContext('2d'); const id = tc.createImageData(W, H); const d = id.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const weave = Math.sin(x * 1.7) * Math.sin(y * 1.7) * 9 + Math.sin((x + y) * 0.35) * 3;
    const n = (hash2(x, y) - 0.5) * 22 + (noise(x * 0.01, y * 0.01) - 0.5) * 26;
    const val = 128 + weave + n, i = (y * W + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = val; d[i + 3] = 255;
  }
  tc.putImageData(id, 0, 0); }
const grains = [0, 1, 2, 3].map(k => { const g = document.createElement('canvas'); g.width = 256; g.height = 256; const gc = g.getContext('2d'); const id = gc.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) { const v = 128 + (hash2(i, k * 7919) - 0.5) * 90; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
  gc.putImageData(id, 0, 0); return g; });

function post(t) {
  const bloom = t < 24.6 ? 0.2 : lerp(0.2, 0.06, clamp((t - 24.6) / 1));
  sctx.drawImage(cv, 0, 0, 480, 270);
  bctx.clearRect(0, 0, 480, 270); bctx.filter = 'blur(6px)'; bctx.drawImage(small, 0, 0); bctx.filter = 'none';
  ctx.save();
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = bloom; ctx.drawImage(blurC, 0, 0, W, H);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.55; ctx.drawImage(tex, 0, 0);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = t < 24.6 ? 1 : lerp(1, 0.35, clamp((t - 24.6) / 1)); ctx.drawImage(vign, 0, 0);
  ctx.restore();
}
function grain(t) {
  const f = Math.floor(t * FPS);
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.13;
  const p = ctx.createPattern(grains[f % 4], 'repeat');
  ctx.translate((hash2(f, 1) * 256) | 0, (hash2(f, 2) * 256) | 0);
  ctx.fillStyle = p; ctx.fillRect(-256, -256, W + 512, H + 512);
  ctx.restore();
}

// ======================================================================
// FRAME
// ======================================================================
function frame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#110e0c'; ctx.fillRect(0, 0, W, H);
  // which scenes are on screen: each until the next one has fully painted over it
  const vis = [];
  for (let i = 0; i < SCENES.length; i++) {
    const sc = SCENES[i], next = SCENES[i + 1];
    const start = i === 0 ? 0 : sc.revealStart;
    const end = next ? next.revealEnd : 1e9;
    if (t >= start && t < end) vis.push(sc);
  }
  vis.forEach((sc, k) => drawScene(sc, t, k === 0));
  post(t);
  statements(t);
  hayTicker(t);
  chapterUI(t);
  finale(t);
  grain(t);
  // fades
  const fin = clamp(t / 0.35), fout = smooth((t - 29.15) / 0.85);
  const a = Math.max(1 - fin, fout);
  if (a > 0) { ctx.globalAlpha = a; ctx.fillStyle = '#0b0908'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

window.renderFrame = t => { frame(t); return true; };
window.ready = Promise.all([
  document.fonts.load('300 40px CG'), document.fonts.load('500 40px CG'),
  document.fonts.load('italic 300 40px CG'), document.fonts.load('italic 400 40px CG'),
  document.fonts.load('500 14px Inter'),
]).then(() => true);

if (!/render/.test(location.search)) {
  window.ready.then(() => {
    const t0 = performance.now();
    const m = location.search.match(/t=([\d.]+)/);
    const off = m ? +m[1] : 0;
    const loop = () => { frame(((performance.now() - t0) / 1000 + off) % DUR); requestAnimationFrame(loop); };
    loop();
  });
}
