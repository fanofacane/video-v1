'use strict';
// ORBIT — 30s generative motion study, 96 BPM (beat = 0.625s, bar = 2.5s, 12 bars).
// One dot -> a planet and its moons -> a nine-body system -> collapse -> galaxy drop -> back to one dot.
// Everything is a pure function of time t, so any frame (or sub-frame) can be rendered in any order.

const W = 1920, H = 1080, CX = W / 2, CY = H / 2, FPS = 30;
const B = 0.625, BAR = 2.5, DUR = 30;
const INK = '#07080f', CREAM = '#f2ead9', CORAL = '#ff4d2e';
const cv = document.getElementById('c'), ctx = cv.getContext('2d');

// ---------- maths ----------
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const L = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const eOut3 = t => 1 - Math.pow(1 - t, 3), eIn3 = t => t * t * t;
const eOutX = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)), eInX = t => (t <= 0 ? 0 : Math.pow(2, 10 * (t - 1)));
const eIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const hash = n => { let h = Math.imul(n | 0, 2654435761) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };
const TAU = Math.PI * 2;
const sinceBeat = (t, from = 0) => (t < from ? 99 : (t - from) % B);           // seconds since the last beat
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${clamp(a)})`; };

// ---------- pre-baked layers ----------
const grain = [0, 1, 2].map(k => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), im = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) { const v = hash(i * 7 + k * 99991) * 255; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); return ctx.createPattern(c, 'repeat');
});
const vignette = (() => {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const gr = g.createRadialGradient(CX, CY, H * 0.35, CX, CY, H * 1.05);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); return c;
})();

// ---------- the nine-body system ----------
const BODIES = [150, 230, 320, 430, 560, 700, 850, 1010, 1180].map((R, i) => ({
  R, size: [10, 14, 9, 22, 30, 18, 12, 16, 8][i], w: 1.5 * Math.pow(150 / R, 1.5), ph: hash(i + 3) * TAU,
  color: i === 3 ? CORAL : CREAM, ringed: i === 4,
  appear: i < 3 ? 5 + i * B : 10 + (i - 3) * B / 2,
}));
const NAMES = ['M-01  ·  0.39 AU', 'M-02  ·  0.72 AU', 'M-03  ·  1.00 AU'];
// time warp for the build: orbits accelerate smoothly from 15s
const warp = t => t + (t > 15 ? 1.6 * Math.pow(t - 15, 3) : 0);

function systemCam(t) {
  let z = t < 10 ? L(1.15, 0.95, eIO(P(t, 5, 10))) : t < 11.6 ? L(0.95, 0.5, eIO(P(t, 10, 11.6))) : L(0.5, 0.45, P(t, 11.6, 15));
  const k = L(0.36, 0.82, eIO(P(t, 12.5, 15)));                     // how far we look down on the plane
  const rot = (-14 + 6 * Math.sin(t * 0.25) + 40 * eIn3(P(t, 15, 17.5))) * Math.PI / 180;
  const collapse = L(1, 0.04, eIn3(P(t, 15, 17.5)));
  return { z, k, rot, collapse };
}
function project(cam, R, a) {
  const x = R * Math.cos(a), y = R * Math.sin(a) * cam.k, c = Math.cos(cam.rot), s = Math.sin(cam.rot);
  return { x: CX + (x * c - y * s) * cam.z, y: CY + (x * s + y * c) * cam.z, d: Math.sin(a) };
}

function drawPlanet(x, y, r, t, glow) {
  if (r <= 0.2) return;
  if (glow > 0) { // beat halo
    const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 3.2);
    g.addColorStop(0, rgba(CORAL, 0.35 * glow)); g.addColorStop(1, rgba(CORAL, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, TAU); ctx.fill();
  }
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = CREAM; ctx.fill(); ctx.clip();
  const sa = 0.6 + t * 0.12; // terminator drifts slowly
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + Math.cos(sa) * r * 0.55, y + Math.sin(sa) * r * 0.55, r * 1.02, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = rgba(CREAM, 0.9); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
}

function system(t) {
  const cam = systemCam(t), tw = warp(t), bt = sinceBeat(t, 5), pulse = Math.exp(-bt * 7);
  const fade = 1 - P(t, 17.2, 17.5);
  // orbit paths, drawn in as arcs
  for (const b of BODIES) {
    const prog = eOut3(P(t, b.appear, b.appear + 0.6)); if (prog <= 0) continue;
    const R = b.R * cam.collapse, a0 = b.ph + b.w * tw - prog * TAU;
    ctx.beginPath();
    for (let i = 0; i <= 128; i++) { const p = project(cam, R, a0 + prog * TAU * i / 128); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    ctx.strokeStyle = rgba(CREAM, (0.16 + 0.1 * pulse) * fade); ctx.lineWidth = 1.2; ctx.stroke();
  }
  // constellation: one line per beat links body j to body j+1 (10.625s .. 15s)
  const pos = BODIES.map(b => project(cam, b.R * cam.collapse, b.ph + b.w * tw));
  const lineA = (1 - P(t, 15, 16.5)) * fade;
  for (let j = 0; j < 8; j++) {
    const t0 = 10.625 + j * B, q = eOut3(P(t, t0, t0 + 0.35)); if (q <= 0 || lineA <= 0) continue;
    const a = pos[j], b = pos[j + 1];
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(L(a.x, b.x, q), L(a.y, b.y, q));
    ctx.strokeStyle = rgba(CORAL, 0.85 * lineA); ctx.lineWidth = 2; ctx.stroke();
    const f = Math.exp(-(t - t0) * 5); if (f > 0.01) { ctx.strokeStyle = rgba(CORAL, f); ctx.beginPath(); ctx.arc(b.x, b.y, 10 + 60 * (1 - f), 0, TAU); ctx.stroke(); }
  }
  // gravity strings during the build
  const gs = P(t, 15, 15.6) * fade;
  if (gs > 0) for (const p of pos) { ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(p.x, p.y); ctx.strokeStyle = rgba(CREAM, 0.35 * gs); ctx.lineWidth = 1; ctx.stroke(); }
  // bodies + central planet, back to front
  const pr = (t < 5 ? L(6, 58, eOutX(P(t, 4.375, 5))) : 58 * Math.max(cam.z, 0.6)) * L(1, 0.35, eIn3(P(t, 15, 17.5)));
  const items = BODIES.map((b, i) => ({ b, i, p: pos[i] })).filter(o => t >= o.b.appear);
  items.push({ center: true, p: { d: 0 } }); items.sort((u, v) => u.p.d - v.p.d);
  for (const o of items) {
    if (o.center) { drawPlanet(CX, CY, pr * (1 + 0.06 * pulse), t, t >= 5 ? pulse : 0); continue; }
    const { b, i, p } = o, grow = eOutX(P(t, b.appear + 0.3, b.appear + 0.7));
    const r = b.size * Math.max(cam.z, 0.5) * grow * L(1, 0.6, eIn3(P(t, 15, 17.5))); if (r <= 0.2) continue;
    // trail
    for (let s = 0; s < 18; s++) {
      const a1 = b.ph + b.w * tw - s * 0.05, a2 = a1 - 0.05, p1 = project(cam, b.R * cam.collapse, a1), p2 = project(cam, b.R * cam.collapse, a2);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.strokeStyle = rgba(b.color, 0.5 * (1 - s / 18) * grow); ctx.lineWidth = r * 0.9 * (1 - s / 18); ctx.stroke();
    }
    if (b.ringed) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-0.35); ctx.scale(1, 0.32); ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, TAU); ctx.restore(); ctx.strokeStyle = rgba(CREAM, 0.8); ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    // labels on the first three moons
    if (i < 3) {
      const la = P(t, b.appear + 0.4, b.appear + 0.8) * (1 - P(t, 10, 10.6)); if (la <= 0) continue;
      const lx = p.x + 26, ly = p.y - 34;
      ctx.strokeStyle = rgba(CREAM, 0.6 * la); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x + r * 0.8, p.y - r * 0.8); ctx.lineTo(lx, ly); ctx.lineTo(lx + 150 * eOut3(la), ly); ctx.stroke();
      text(NAMES[i].slice(0, Math.round(NAMES[i].length * la)), lx + 4, ly - 14, 500, 17, rgba(CREAM, 0.85 * la), 'left', 0.12);
    }
  }
}

// ---------- the galaxy ----------
const NG = 4500;
const STARS = Array.from({ length: NG }, (_, i) => {
  const h1 = hash(i * 3 + 1), h2 = hash(i * 3 + 2), h3 = hash(i * 3 + 3), h4 = hash(i * 5 + 11);
  const r = 30 + 600 * Math.pow(h1, 0.75), arm = i % 3;
  return { r, a: arm * TAU / 3 + r * 0.0085 + (h2 - 0.5) * L(1.2, 0.45, r / 630), s: 0.9 + 2.6 * h3 * h3 * h3,
    w: 0.5 * Math.pow(120 / (r + 40), 0.6), coral: h4 < 0.16, al: 0.35 + 0.65 * h4 };
});
function galaxy(t) {
  const lt = t - 17.5, bt = sinceBeat(t, 17.5), kick = Math.exp(-bt * 9);
  const burst = eOutX(P(lt, 0, 0.9)), suck = eIn3(P(t, 23.75, 25));
  const k = L(0.5, 0.78, eIO(P(t, 17.5, 25))), rot = (-22 + 7 * lt) * Math.PI / 180, c = Math.cos(rot), s = Math.sin(rot);
  const zoom = L(1.18, 1.0, eOut3(P(lt, 0, 2))) * (1 + 0.025 * kick);
  // core glow
  const cr = 240 * (1 - suck) + 20, g = ctx.createRadialGradient(CX, CY, 0, CX, CY, cr);
  g.addColorStop(0, rgba(CREAM, 0.55 * (0.7 + 0.3 * kick))); g.addColorStop(0.25, rgba(CORAL, 0.22)); g.addColorStop(1, rgba(CORAL, 0));
  ctx.fillStyle = g; ctx.fillRect(CX - cr, CY - cr, 2 * cr, 2 * cr);
  for (const st of STARS) {
    const r = st.r * burst * (1 - suck) * (1 + 0.05 * kick * (st.r / 600)), a = st.a + st.w * lt + suck * 4 * (1 - st.r / 700);
    const x = r * Math.cos(a), y = r * Math.sin(a) * k;
    const px = CX + (x * c - y * s) * zoom, py = CY + (x * s + y * c) * zoom, sz = st.s * (1 + 0.6 * kick);
    ctx.fillStyle = st.coral ? rgba(CORAL, st.al) : rgba(CREAM, st.al); ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
  }
}
const WORDS = [[17.5, 'PULL'], [18.75, 'SPIN'], [20, 'BEND'], [21.25, 'BURN'], [22.5, 'FALL'], [23.75, 'IN']];
function words(t) {
  for (let i = 0; i < WORDS.length; i++) {
    const [t0, w] = WORDS[i], t1 = i + 1 < WORDS.length ? WORDS[i + 1][0] : 25; if (t < t0 || t >= t1) continue;
    const lt = t - t0, slam = eOutX(P(lt, 0, 0.16));
    let sc = L(1.5, 1, slam) * (1 + 0.03 * lt), al = slam;
    if (w === 'IN') { const q = eIn3(P(t, 24.2, 25)); sc *= 1 - 0.97 * q; }
    ctx.save(); ctx.globalCompositeOperation = 'difference';
    ctx.translate(CX, CY + 10); ctx.scale(sc, sc);
    text(w, 0, 0, 900, 340, rgba(CREAM, al), 'center', 0.02 + 0.06 * (1 - slam));
    ctx.restore();
    // outlined echoes above and below
    const ea = 0.5 * Math.exp(-lt * 2.5) * slam;
    for (const dy of [-260, 260]) {
      ctx.save(); ctx.translate(CX, CY + 10 + dy * L(0.6, 1, eOut3(P(lt, 0, 0.5)))); ctx.scale(sc * 0.9, sc * 0.9);
      ctx.font = `900 340px Mont`; ctx.letterSpacing = '6px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = rgba(CREAM, ea); ctx.lineWidth = 2; ctx.strokeText(w, 0, 0); ctx.restore();
    }
  }
}

// ---------- intro / outro ----------
function rings(t, from, to, maxR, alpha) {
  for (let k = Math.ceil(from / B - 1e-6); k * B < to && k * B <= t; k++) {
    const dt = t - k * B; if (dt > 1.8) continue; const q = eOut3(dt / 1.8);
    ctx.strokeStyle = rgba(CREAM, Math.pow(1 - q, 1.6) * alpha); ctx.lineWidth = L(3, 0.6, q);
    ctx.beginPath(); ctx.arc(CX, CY, L(8, maxR, q), 0, TAU); ctx.stroke();
  }
}
function crosshair(t) {
  const a = 0.28 * (1 - P(t, 4.5, 5.4)); if (a <= 0) return;
  const hx = eOutX(P(t, 1.25, 2.3)) * W / 2, vy = eOutX(P(t, 1.875, 2.9)) * H / 2;
  ctx.strokeStyle = rgba(CREAM, a); ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(CX - hx, CY); ctx.lineTo(CX - 40, CY); ctx.moveTo(CX + 40, CY); ctx.lineTo(CX + hx, CY);
  ctx.moveTo(CX, CY - vy); ctx.lineTo(CX, CY - 40); ctx.moveTo(CX, CY + 40); ctx.lineTo(CX, CY + vy); ctx.stroke();
  for (let x = 80; x < hx; x += 80) { const h = x % 400 === 0 ? 12 : 5; ctx.beginPath(); ctx.moveTo(CX - x, CY - h); ctx.lineTo(CX - x, CY + h); ctx.moveTo(CX + x, CY - h); ctx.lineTo(CX + x, CY + h); ctx.stroke(); }
}
function spaced(str, t, t0, step, y, size, weight, track, alpha, outAt) {
  ctx.font = `${weight} ${size}px Mont`; ctx.letterSpacing = '0px';
  const ws = [...str].map(ch => ctx.measureText(ch).width), gap = size * track, total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
  let x = CX - total / 2;
  [...str].forEach((ch, i) => {
    const q = eOut3(P(t, t0 + i * step, t0 + i * step + 0.35)), o = outAt ? eIn3(P(t, outAt + i * 0.03, outAt + i * 0.03 + 0.5)) : 0;
    const drift = (x + ws[i] / 2 - CX) * 0.6 * o;
    if (q > 0 && o < 1) text(ch, x + ws[i] / 2 + drift, y + 18 * (1 - q) - 10 * o, weight, size, rgba(CREAM, alpha * q * (1 - o)), 'center', 0);
    x += ws[i] + gap;
  });
}
function intro(t) {
  rings(t, 0.625, 4.4, 380, 0.75);
  crosshair(t);
  if (t < 4.375) { // the signal dot
    const r = 7 * eOutX(P(t, 0.3, 0.7)) * (1 + 0.7 * Math.exp(-sinceBeat(t, 0.625) * 9));
    ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(CX, CY, r, 0, TAU); ctx.fill();
  }
  spaced('ORBIT', t, 2.5, B / 2, CY + 150, 58, 800, 0.9, 1, 4.1);
  spaced('STUDY Nº02   ·   96 BPM', t, 3.125, 0.03, CY + 215, 17, 500, 0.35, 0.6, 4.2);
}
function outro(t) {
  const lt = t - 25;
  // impact ring
  const iq = eOut3(P(lt, 0, 1.4)); if (iq < 1) { ctx.strokeStyle = rgba(CORAL, 1 - iq); ctx.lineWidth = L(8, 1, iq); ctx.beginPath(); ctx.arc(CX, CY, L(20, 1100, iq), 0, TAU); ctx.stroke(); }
  rings(t, 25.625, 28.2, 330, 0.55);
  const r = 7 * (1 + 0.7 * Math.exp(-sinceBeat(t, 25) * 9) * (1 - P(t, 28, 28.5))) * (1 - eIn3(P(t, 29.0, 29.5)));
  if (r > 0.1) { ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(CX, CY, r, 0, TAU); ctx.fill(); }
  spaced('EVERYTHING RETURNS', t, 25.625, 0.05, CY + 150, 40, 800, 0.55, 1, 28.4);
  spaced('ORBIT  —  STUDY Nº02', t, 26.875, 0.03, CY + 205, 17, 500, 0.35, 0.6, 28.6);
}

// ---------- chrome ----------
function text(s, x, y, weight, size, color, align = 'left', track = 0) {
  ctx.font = `${weight} ${size}px Mont`; ctx.letterSpacing = (track * size) + 'px';
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  // letterSpacing adds trailing space after the last glyph: compensate when centring
  ctx.fillText(s, align === 'center' ? x + track * size / 2 : x, y);
}
function hud(t) {
  const a = 0.7 * P(t, 0.6, 1.4) * (1 - P(t, 29.0, 29.5)); if (a <= 0) return;
  const c = rgba(CREAM, a), f = Math.floor(t * FPS + 1e-6);
  text('ORBIT', 48, 46, 500, 18, c, 'left', 0.2);
  text('STUDY Nº02', W - 48, 46, 500, 18, c, 'right', 0.2);
  const tc = [Math.floor(f / FPS / 60), Math.floor(f / FPS) % 60, f % FPS].map(n => String(n).padStart(2, '0')).join(':');
  text(tc, 48, H - 46, 500, 18, c, 'left', 0.12);
  const bar = Math.min(12, Math.floor(t / BAR) + 1), beat = Math.floor((t % BAR) / B);
  text(`BAR ${String(bar).padStart(2, '0')} / 12`, W - 150, H - 46, 500, 18, c, 'right', 0.12);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = i === beat ? rgba(CORAL, a / 0.7) : rgba(CREAM, a * 0.4); ctx.fillRect(W - 140 + i * 24, H - 54, 14, 14); }
}
function countdown(t) {
  for (let i = 0; i < 4; i++) {
    const t0 = 15 + i * B, lt = t - t0; if (lt < 0 || lt > B) continue;
    ctx.save(); ctx.translate(CX, CY); const sc = L(1.25, 1, eOutX(P(lt, 0, 0.2))); ctx.scale(sc, sc);
    ctx.font = '900 520px Mont'; ctx.letterSpacing = '0px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = rgba(CREAM, 0.7 * (1 - lt / B)); ctx.lineWidth = 2.5; ctx.strokeText(String(4 - i), 0, 20); ctx.restore();
  }
}

// ---------- frame ----------
function draw(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  // build-up shake
  const sh = 9 * eIn3(P(t, 15, 17.5)) * (t < 17.5 ? 1 : 0);
  if (sh > 0) ctx.translate(Math.sin(t * 97) * sh, Math.cos(t * 83) * sh);
  if (t < 5.2) intro(t);
  if (t >= 4.375 && t < 17.5) system(t);
  if (t >= 15 && t < 17.5) countdown(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (t >= 17.5 && t < 25) { galaxy(t); words(t); }
  if (t >= 25) outro(t);
  ctx.globalCompositeOperation = 'source-over';
  hud(t);
  // flashes on the drop and the return
  const fl = Math.max(t >= 17.5 ? Math.exp(-(t - 17.5) * 9) : 0, t >= 25 ? 0.6 * Math.exp(-(t - 25) * 10) : 0);
  if (fl > 0.004) { ctx.fillStyle = rgba(CREAM, fl); ctx.fillRect(0, 0, W, H); }
  ctx.drawImage(vignette, 0, 0);
  const gi = Math.floor(t * FPS) % 3; ctx.globalAlpha = 0.045; ctx.fillStyle = grain[gi];
  ctx.save(); ctx.translate((gi * 97) % 256, (gi * 61) % 256); ctx.fillRect(-256, -256, W + 512, H + 512); ctx.restore();
  ctx.globalAlpha = 1;
  // fade in / out of black
  const blk = Math.max(1 - P(t, 0, 0.3), P(t, 29.5, 30));
  if (blk > 0) { ctx.fillStyle = `rgba(0,0,0,${blk})`; ctx.fillRect(0, 0, W, H); }
}

window.setTime = t => draw(clamp(t, 0, DUR - 1e-4));
// motion blur: average SUB samples across a 180-degree shutter centred on frame f, blended on the GPU
// (running average, so rounding error stays under one 8-bit step), then return one PNG
const acc = document.createElement('canvas'); acc.width = W; acc.height = H; const actx = acc.getContext('2d');
window.renderFrame = (f, SUB) => {
  for (let k = 0; k < SUB; k++) {
    window.setTime((f - 0.25 + (k + 0.5) * 0.5 / SUB) / FPS);
    actx.globalAlpha = 1 / (k + 1); actx.drawImage(cv, 0, 0);
  }
  actx.globalAlpha = 1; return acc.toDataURL('image/png').slice(22);
};
if (!location.search.includes('render')) { // live preview in a browser
  const t0 = performance.now(); const loop = () => { draw(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); }; loop();
}
