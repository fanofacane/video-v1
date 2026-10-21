'use strict';
// TYPE IN MOTION — Glitch edition. Same copy and beat grid as the original film;
// only the STYLE block (colours, type, texture) and the MOTION block (verbs) change.
// Everything is drawn on a canvas, then run through a glitch "post" pass.

const W = 1280, H = 720, K = 1.5;                 // design space, output scale
const BG = '#06070b', TXT = '#eafff3', GRN = '#39ff88', MAG = '#ff2bd6', CYN = '#00e5ff', DIM = '#2a3b33';
const cv = document.getElementById('c'), out = cv.getContext('2d');
const mk = () => { const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; return c; };
const S = mk(), sx = S.getContext('2d');            // scene buffer
const T1 = mk(), t1 = T1.getContext('2d'), T2 = mk(), t2 = T2.getContext('2d'), T3 = mk(), t3 = T3.getContext('2d');
const B = document.createElement('canvas'); B.width = 1920; B.height = 1080; const bx = B.getContext('2d'); // band-jitter buffer

// ---------- maths ----------
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const L = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const eOut3 = t => 1 - Math.pow(1 - t, 3), eOutX = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)), eInX = t => (t <= 0 ? 0 : Math.pow(2, 10 * (t - 1)));
const eIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function hash(a, b = 0) { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const step = (t, fps = 12) => Math.floor(t * fps) / fps;   // choppy, frame-stepped motion
let FR = 0;                                               // whole output frame (seeds stay fixed across sub-frames)

// ---------- type ----------
const font = (sz, w = 800) => `${w} ${sz}px JBM`;
function text(c, str, x, y, o = {}) {
  c.save(); c.font = font(o.size || 80, o.weight || 800); c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
  c.letterSpacing = (o.track || 0) + 'px'; c.globalAlpha = o.alpha ?? 1; c.fillStyle = o.color || TXT;
  c.translate(x, y); if (o.rot) c.rotate(o.rot); if (o.sx || o.sy) c.scale(o.sx || 1, o.sy || 1);
  c.fillText(str, 0, 0); c.restore();
}
const GLY = '!<>-_\\/[]{}=+*^?#01%$&@';
// characters scramble through random glyphs, then lock in one by one
function decode(c, str, x, y, t, t0, dur, o = {}) {
  if (t < t0) return;
  let s = '';
  for (let i = 0; i < str.length; i++) {
    const lock = t0 + dur * (0.35 + 0.65 * i / Math.max(1, str.length - 1));
    s += str[i] === ' ' || t >= lock ? str[i] : GLY[Math.floor(hash(FR * 7 + i, i * 13) * GLY.length)];
  }
  text(c, s, x, y, o);
}
function typeOn(c, str, x, y, t, t0, cps, o = {}) {
  if (t < t0) return;
  const n = Math.min(str.length, Math.floor((t - t0) * cps) + 1), s = str.slice(0, n);
  c.save(); c.font = font(o.size || 80, o.weight || 800); c.letterSpacing = (o.track || 0) + 'px';
  const w = c.measureText(str).width; c.restore();
  const left = x - w / 2;
  text(c, s, left, y, { ...o, align: 'left' });
  c.save(); c.font = font(o.size || 80, o.weight || 800); c.letterSpacing = (o.track || 0) + 'px';
  const wc = c.measureText(s).width; c.restore();
  if (o.cursor !== false && Math.floor(t * 4) % 2 === 0) { c.fillStyle = GRN; c.fillRect(left + wc + 6, y - (o.size || 80) * 0.42, (o.size || 80) * 0.5, (o.size || 80) * 0.84); }
}
function tag(c, str, x, y, size = 22, p = 1) {
  if (p <= 0) return;
  c.save(); c.font = font(size, 700); c.textAlign = 'center'; c.textBaseline = 'middle';
  const full = `[ ${str} ]`, n = Math.ceil(full.length * p), s = full.slice(0, n);
  const w = c.measureText(full).width + 18;
  c.fillStyle = 'rgba(6,7,11,.85)'; c.fillRect(x - w / 2, y - size * 0.8, w, size * 1.6);
  c.strokeStyle = GRN; c.lineWidth = 1.5; c.strokeRect(x - w / 2, y - size * 0.8, w * Math.min(1, p * 1.4), size * 1.6);
  c.fillStyle = GRN; c.textAlign = 'left'; c.fillText(s, x - w / 2 + 9, y + 1); c.restore();
}
// replaces the stars: a targeting reticle
function reticle(c, x, y, r, rot, col = MAG, p = 1) {
  if (p <= 0) return;
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(p, p); c.strokeStyle = col; c.lineWidth = 3;
  c.beginPath(); c.arc(0, 0, r, 0.15, Math.PI / 2 - 0.15); c.stroke(); c.beginPath(); c.arc(0, 0, r, Math.PI + 0.15, Math.PI * 1.5 - 0.15); c.stroke();
  c.beginPath(); c.arc(0, 0, r * 0.55, 0, Math.PI * 2); c.stroke();
  for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(r * 0.7, 0); c.lineTo(r * 1.25, 0); c.stroke(); }
  c.fillStyle = col; c.fillRect(-3, -3, 6, 6); c.restore();
}
function brackets(c, x, y, w, h, len, col = GRN, lw = 4) {
  c.save(); c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
  for (const [sx_, sy_] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = x + sx_ * w / 2, cy = y + sy_ * h / 2;
    c.moveTo(cx, cy - sy_ * len); c.lineTo(cx, cy); c.lineTo(cx - sx_ * len, cy);
  }
  c.stroke(); c.restore();
}
// draw something into a temp buffer, then copy it back in horizontal bands that jitter sideways
function bands(fn, amp, bandH = 7, seed = 0) {
  bx.setTransform(1, 0, 0, 1, 0, 0); bx.clearRect(0, 0, 1920, 1080); bx.setTransform(K, 0, 0, K, 0, 0); fn(bx);
  sx.save(); sx.setTransform(1, 0, 0, 1, 0, 0);
  const bh = bandH * K;
  for (let y = 0; y < 1080; y += bh) {
    const r = hash(FR + seed, y | 0), dx = (r - 0.5) * 2 * amp * K * (r > 0.7 ? 2.2 : 0.6);
    sx.drawImage(B, 0, y, 1920, bh, dx, y, 1920, bh);
  }
  sx.restore();
}

// ---------- glitch events (time, duration, strength) ----------
const GE = [[2.35, .3, 1], [2.5, .15, .8], [4.3, .3, .8], [4.55, .12, .6], [6.5, .1, .4], [7.5, .25, 1], [8.0, .1, .45], [8.5, .1, .45], [9.0, .14, .7],
  [11, .1, .35], [11.5, .1, .35], [12, .1, .35], [12.5, .1, .35], [13.25, .3, 1], [13.55, .14, .6], [15.6, .4, .9], [16.0, .2, .6], [18.5, .15, .75], [19, .15, .75],
  [19.5, .15, .75], [20.7, .3, .9], [21, .12, .5], [23.2, .35, .9], [24.5, .3, 1], [24.95, .1, .5], [25.45, .1, .5], [26, .12, .5], [27.55, .35, .9], [27.85, .15, .6], [29.55, .2, .6]];
const glitchAt = t => { let g = 0; for (const [a, d, s] of GE) if (t >= a && t < a + d) g = Math.max(g, s * (1 - (t - a) / d * 0.6)); return g; };

// ---------- scenes (draw into sx, design units) ----------
const scenes = [];
const scene = (t0, t1_, fn) => scenes.push({ t0, t1: t1_, fn });

scene(0, 2.5, (c, lt, t) => {
  decode(c, 'IT STARTS', 640, 232, t, 0.0, 0.5, { size: 84, color: TXT });
  tag(c, 'WITH', 880, 300, 22, P(lt, 0.3, 0.55));
  const L3 = [['O', 420], ['N', 640], ['E', 860]];
  L3.forEach(([ch, x], i) => {
    const a = 0.5 + i * 0.12; if (lt < a) return;
    const q = Math.min(1, Math.floor((lt - a) * 30) / 3);       // 3-frame stepped slam
    text(c, ch, x, 470, { size: 250, sx: L(1.8, 1, q), sy: L(0.4, 1, q), color: i === 1 ? GRN : TXT });
  });
  const lock = eOut3(P(lt, 0.2, 1.2));
  reticle(c, L(120, 860, lock), L(600, 470, lock), 70, lt * 2.4, MAG, P(lt, 0.15, 0.3));
});
scene(2.5, 4.6, (c, lt) => {
  const on = eOutX(P(lt, 0, 0.12)), open = eOutX(P(lt, 0.1, 0.3)), off = P(lt, 1.8, 1.95), off2 = P(lt, 1.95, 2.08);
  const sy = (lt < 1.8 ? L(0.02, 1, open) : L(1, 0.02, eInX(off))), sxx = lt < 1.95 ? on : L(1, 0, eInX(off2));
  if (sxx <= 0) return;
  c.save(); c.translate(640, 350); c.scale(sxx, sy);
  if (sy < 0.1) { c.fillStyle = TXT; c.fillRect(-520, -3, 1040, 6); }
  text(c, 'FRAME', 0, 0, { size: 168, color: TXT });
  c.restore();
  const bp = eOutX(P(lt, 0.25, 0.55)) * (1 - P(lt, 1.75, 1.85));
  if (bp > 0) brackets(c, 640, 350, L(1100, 640, bp), L(520, 230, bp), 38, GRN, 5);
  if (lt > 0.4 && lt < 1.8) text(c, `FRM ${String(75 + Math.floor((lt - 0.4) * 30)).padStart(3, '0')}  ·  1920×1080`, 640, 500, { size: 18, weight: 500, color: GRN });
});
scene(4.55, 6.5, (c, lt, t) => {
  let amp = 0; for (const a of [0, 0.45, 0.95, 1.45]) if (lt >= a) amp = 26 * Math.exp(-(lt - a) * 9);
  bands(b => { text(b, 'THEN', 640, 300, { size: 44, track: 28, color: GRN }); text(b, 'ANOTHER', 640, 385, { size: 130, color: TXT }); }, amp + 1.5, 6, 3);
});
scene(6.5, 9.0, (c, lt, t) => {
  const LAND = 1.0;
  if (lt < LAND) typeOn(c, 'AND', 640, 360, t, 6.55, 7, { size: 64 });
  const k = Math.round(lt * 30) - LAND * 30;
  if (k === 0 || k === 1) { text(c, 'AGAIN', 700, 380, { size: [600, 330][k], color: k ? GRN : TXT }); return; }
  if (lt >= LAND) {
    const s = 1 + (lt - LAND) * 0.04;
    text(c, 'AND AGAIN', 640, 360, { size: 74 * s });
    [[8.0, -1, MAG], [8.0, 1, CYN], [8.5, -2, MAG], [8.5, 2, CYN]].forEach(([a, lv, col]) => {
      if (t < a) return; const q = eOutX(P(t, a, a + 0.15));
      text(c, 'AND AGAIN', 640 + lv * 7 * (1 - q) * 6, 360 + lv * 82 * s, { size: 74 * s, color: col, alpha: 0.85 });
    });
  }
});
scene(9.0, 11.0, (c, lt) => {
  const beat = Math.floor(lt * 4), inv = lt >= 1.0 ? beat % 2 === 1 : false;
  c.fillStyle = inv ? BG : GRN; c.fillRect(-10, -10, W + 20, H + 20);
  const ink = inv ? GRN : BG;
  if (lt < 0.5) text(c, 'FEEL', 640, 360, { size: 190, color: ink, sx: lt < 0.06 ? 1.25 : 1 });
  else if (lt < 1.0) text(c, 'THE', 640, 360, { size: 150, color: ink, sy: lt < 0.56 ? 0.2 : 1 });
  else {
    const q = lt - 1.0 - Math.floor((lt - 1.0) * 4) / 4;
    text(c, 'BEAT', 640, 365, { size: 260, color: ink, sx: 1 + 0.18 * Math.exp(-q * 18) });
  }
  for (let i = 0; i < 4 && lt >= 1.0; i++) if (lt >= 1.0 + i * 0.25) { const [x, y] = [[190, 150], [1090, 150], [190, 570], [1090, 570]][i]; c.fillStyle = ink; c.fillRect(x - 14, y - 14, 28, 28); }
});
scene(11.0, 13.55, (c, lt, t) => {
  const words = [['← LEFT', -360, 260, 380, 260], ['RIGHT →', 1640, 260, 900, 260], ['↑ UP', 420, 900, 420, 470], ['↓ DOWN', 870, -200, 870, 470]];
  const px = P(lt, 2.0, 2.3);
  const draw = cc => words.forEach(([w, fx, fy, tx_, ty], i) => {
    const a = i * 0.5; if (lt < a) return;
    const k = eOutX(P(step(lt, 12), a, a + 0.34));
    text(cc, w, L(fx, tx_, k), L(fy, ty, k), { size: 92, color: i % 2 ? GRN : TXT });
  });
  if (px <= 0) { draw(c); return; }
  // pixelate: draw tiny, scale up without smoothing
  const f = Math.max(2, Math.round(L(1, 40, eInX(px))));
  t1.setTransform(1, 0, 0, 1, 0, 0); t1.clearRect(0, 0, 1920, 1080); t1.setTransform(K, 0, 0, K, 0, 0); draw(t1);
  t2.setTransform(1, 0, 0, 1, 0, 0); t2.clearRect(0, 0, 1920, 1080); t2.imageSmoothingEnabled = true; t2.drawImage(T1, 0, 0, 1920 / f, 1080 / f);
  sx.save(); sx.setTransform(1, 0, 0, 1, 0, 0); sx.imageSmoothingEnabled = false; sx.drawImage(T2, 0, 0, 1920 / f, 1080 / f, 0, 0, 1920, 1080); sx.imageSmoothingEnabled = true; sx.restore();
  if (lt > 2.3) for (let i = 0; i < 60; i++) { c.fillStyle = [GRN, MAG, CYN, TXT][i % 4]; c.fillRect(hash(FR, i) * W, hash(FR + 9, i) * H, 20 + hash(i, FR) * 160, 6 + hash(FR, i * 3) * 30); }
});
scene(13.55, 16.0, (c, lt, t) => {
  const v = Math.round(L(1, 30, eOut3(P(lt, 0.05, 1.45))));
  const str = String(v).padStart(2, '0').split('').map((d, i) => (lt < 1.45 && hash(FR, i) > 0.82 ? String(Math.floor(hash(FR + 3, i) * 10)) : d)).join('');
  text(c, str, 340, 370, { size: 330, color: TXT });
  decode(c, 'FRAMES', 900, 270, t, 13.8, 0.35, { size: 84, color: GRN });
  tag(c, 'EVERY', 900, 345, 22, P(lt, 0.6, 0.85));
  decode(c, 'SECOND', 900, 430, t, 14.55, 0.4, { size: 84 });
  const bars = Math.round(v / 3);
  text(c, `[${'█'.repeat(bars)}${'░'.repeat(10 - bars)}] ${String(v).padStart(2, '0')}/30`, 900, 520, { size: 22, weight: 700, color: GRN });
});
scene(16.0, 18.5, (c, lt) => {
  if (lt < 0.75) {
    const x = L(W + 1300, -1300, eIO(P(step(lt, 15), 0, 0.75)));
    text(c, 'MOTION', x, 380, { size: 520, color: TXT });
    text(c, 'IN', 640, 360, { size: 40, color: GRN });
    return;
  }
  for (let r = -3; r <= 3; r++) {
    const a = 0.75 + Math.abs(r) * 0.06; if (lt < a) continue;
    const dir = r % 2 ? -1 : 1, k = eOutX(P(lt, a, a + 0.4));
    const x = 640 + dir * ((lt - a) * 160 + L(-1400, 0, k));
    text(c, 'MOTION  MOTION  MOTION  MOTION', x, 360 + r * 92, { size: 66, color: r === 0 ? TXT : (Math.abs(r) === 1 ? GRN : DIM) });
  }
});
scene(18.5, 21.0, (c, lt, t) => {
  let sm = 0; for (const a of [0, 0.5, 1.0]) if (lt >= a) sm = 1 - eOutX(P(lt, a, a + 0.22));
  const zo = eInX(P(lt, 2.2, 2.5));
  c.save(); c.translate(640, 350); c.scale(L(1, 6, zo), L(1, 6, zo));
  for (let k = 8; k >= 0; k--) text(c, 'BLUR', -k * 60 * sm * ((Math.floor(lt * 2) % 2) ? -1 : 1), 0, { size: 220, color: k ? (k % 2 ? MAG : CYN) : TXT, alpha: k ? 0.16 : 1 });
  c.restore();
  tag(c, 'THE LINES', 860, 470, 26, P(lt, 1.6, 1.85) * (1 - zo));
  reticle(c, 380, 220, 46, lt * 3, GRN, P(lt, 1.7, 1.85) * (1 - zo));
});
scene(21.0, 23.6, (c, lt) => {
  const xs = [430, 590, 715, 850];
  [...'SPIN'].forEach((ch, i) => {
    const a = i * 0.12; if (lt < a) return;
    const turns = Math.min(4, Math.floor((lt - a) / 0.12));   // snaps through 90° steps
    text(c, ch, xs[i], 360, { size: 210, rot: (turns % 4) * Math.PI / 2, color: i === 2 ? GRN : TXT });
  });
  for (let i = 0; i < 3; i++) {
    const ang = step(lt, 12) * 2.6 + i * 2.094; if (lt < 0.3) continue;
    c.fillStyle = [MAG, CYN, GRN][i]; const x = 640 + Math.cos(ang) * 470, y = 360 + Math.sin(ang) * 210, s = 22 + 8 * Math.sin(ang);
    c.fillRect(x - s / 2, y - s / 2, s, s);
  }
  if (lt > 2.2) { c.fillStyle = BG; c.globalAlpha = eInX(P(lt, 2.2, 2.6)); c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
});
scene(23.5, 26.0, (c, lt, t) => {
  const LAND = 1.0;
  if (lt < LAND) typeOn(c, 'DON’T', 640, 360, t, 23.55, 9, { size: 64 });
  const k = Math.round(lt * 30) - LAND * 30;
  if (k === 0 || k === 1) { text(c, 'STOP', 690, 380, { size: [640, 360][k], color: k ? MAG : TXT }); return; }
  if (lt >= LAND) {
    let s = 1.25; for (const a of [1.45, 1.95]) if (lt >= a) s *= 1 + 0.12 * Math.exp(-(lt - a) * 12);
    c.save(); c.font = font(66 * s, 800); const w1 = c.measureText('DON’T ').width, w2 = c.measureText('STOP').width; c.restore();
    const left = 640 - (w1 + w2) / 2;
    text(c, 'DON’T ', left, 360, { size: 66 * s, align: 'left' }); text(c, 'STOP', left + w1, 360, { size: 66 * s, align: 'left', color: MAG });
    [[430, 260], [880, 250], [400, 470], [880, 470]].forEach(([x, y], i) => { const q = eOutX(P(lt, LAND + i * 0.04, LAND + 0.3 + i * 0.04)); reticle(c, L(640, x, q), L(360, y, q), 26, lt * 3 + i, [GRN, CYN, MAG, GRN][i], q); });
  }
});
scene(26.0, 27.85, (c, lt, t) => {
  decode(c, 'MAKE IT', 600, 220, t, 26.0, 0.45, { size: 90 });
  tag(c, 'NOW', 860, 285, 22, P(lt, 0.15, 0.4));
  [...'MOVE'].forEach((ch, i) => {
    const a = 0.5 + i * 0.07; if (lt < a) return;
    const q = Math.min(1, Math.floor((lt - a) * 30) / 3);
    text(c, ch, 360 + i * 200, 470, { size: 220, sx: L(1.8, 1, q), sy: L(0.4, 1, q), color: i === 3 ? GRN : TXT });
  });
  reticle(c, L(1300, 1050, eOut3(P(lt, 0, 0.6))), 480, 60, -lt * 2.4, MAG, P(lt, 0.05, 0.2));
});
scene(27.85, 30.0, (c, lt, t) => {
  const boot = eOutX(P(lt, 0, 0.25)), off = P(lt, 1.7, 2.1);
  let sy = L(0.02, 1, boot), sxx = 1;
  if (off > 0) { sy = L(1, 0.01, eInX(P(off, 0, 0.5))); sxx = L(1, 0, eInX(P(off, 0.5, 1))); }
  c.save(); c.translate(640, 360); c.scale(sxx, sy);
  if (sy < 0.06) { c.fillStyle = TXT; c.fillRect(-560, -3, 1120, 6); }
  text(c, '> TYPE_IN_MOTION', 0, -30, { size: 70, color: TXT });
  if (Math.floor(t * 4) % 2 === 0) { c.fillStyle = GRN; c.fillRect(372, -64, 34, 66); }
  c.restore();
  if (off <= 0) tag(c, 'STUDY Nº02 · GLITCH', 640, 440, 24, P(lt, 0.4, 0.8));
});

// ---------- background + HUD ----------
function background(c, t) {
  c.fillStyle = BG; c.fillRect(-20, -20, W + 40, H + 40);
  c.strokeStyle = 'rgba(57,255,136,.05)'; c.lineWidth = 1;
  for (let x = 0; x <= W; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y <= H; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
}
function hud(c, t) {
  if (t > 29.6) return;
  const f = Math.floor(t * 30), p = n => String(n).padStart(2, '0');
  const col = t >= 9.0 && t < 11.0 && !(t >= 10.0 && Math.floor((t - 9) * 4) % 2) ? BG : GRN;
  c.save(); c.font = font(16, 500); c.fillStyle = col; c.textBaseline = 'top';
  c.fillText('> TYPE_IN_MOTION', 20, 16);
  c.textAlign = 'right'; c.fillText(`REC  00:00:${p(Math.floor(t))}:${p(f % 30)}`, W - 22, 16);
  if (Math.floor(t * 2) % 2 === 0) { c.fillStyle = MAG; c.beginPath(); c.arc(W - 192, 25, 5, 0, 7); c.fill(); c.fillStyle = col; }
  c.textBaseline = 'bottom'; c.textAlign = 'left'; c.fillText('STUDY Nº02 / GLITCH', 20, H - 14);
  c.textAlign = 'right'; c.fillText('30FPS · 120BPM', W - 22, H - 14);
  c.strokeStyle = col; c.lineWidth = 1.5; c.strokeRect(576, H - 30, 128, 24); c.textAlign = 'center'; c.font = font(13, 800); c.fillText('CLAUDE', 640, H - 11);
  c.restore();
}

// ---------- post: RGB split, slices, scanlines, grain ----------
const tint = (dst, src, col) => { dst.setTransform(1, 0, 0, 1, 0, 0); dst.imageSmoothingEnabled = true; dst.globalCompositeOperation = 'source-over'; dst.drawImage(src, 0, 0); dst.globalCompositeOperation = 'multiply'; dst.fillStyle = col; dst.fillRect(0, 0, 1920, 1080); dst.globalCompositeOperation = 'source-over'; };
const scan = document.createElement('canvas'); scan.width = 4; scan.height = 4;
{ const g = scan.getContext('2d'); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, 4, 1.5); }
function post(t) {
  const g = glitchAt(t), d = (1.6 + g * 16) * K;
  tint(t1, S, '#ff0000'); tint(t2, S, '#00ff00'); tint(t3, S, '#0000ff');
  out.globalCompositeOperation = 'source-over'; out.fillStyle = '#000'; out.fillRect(0, 0, 1920, 1080);
  out.globalCompositeOperation = 'lighter';
  out.drawImage(T1, -d, 0); out.drawImage(T2, 0, 0); out.drawImage(T3, d, g * 4);
  out.globalCompositeOperation = 'source-over';
  if (g > 0.25) { // tear horizontal slices
    for (let i = 0; i < 4 + g * 14; i++) {
      const y = hash(FR, i) * 1080, h = 8 + hash(FR + 1, i) * 90 * g, dx = (hash(FR + 2, i) - 0.5) * 380 * g;
      out.drawImage(cv, 0, y, 1920, h, dx, y, 1920, h);
    }
    if (g > 0.6) for (let i = 0; i < 6; i++) { out.fillStyle = [MAG, CYN, GRN][i % 3]; out.globalAlpha = 0.5; out.fillRect(hash(FR, i + 40) * 1920, hash(FR, i + 80) * 1080, 40 + hash(FR, i) * 300, 4 + hash(FR, i + 5) * 14); }
    out.globalAlpha = 1;
  }
  out.fillStyle = out.createPattern(scan, 'repeat'); out.fillRect(0, 0, 1920, 1080);
  const v = out.createRadialGradient(960, 540, 300, 960, 540, 1150); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
  out.fillStyle = v; out.fillRect(0, 0, 1920, 1080);
}

function setTime(t) {
  FR = Math.floor(t * 30 + 0.5);
  sx.setTransform(K, 0, 0, K, 0, 0); sx.globalAlpha = 1;
  background(sx, t);
  const shake = glitchAt(t) * 10;
  for (const s of scenes) if (t >= s.t0 && t < s.t1) {
    sx.save(); sx.translate((hash(FR, 1) - 0.5) * shake, (hash(FR, 2) - 0.5) * shake); s.fn(sx, t - s.t0, t); sx.restore();
    sx.setTransform(K, 0, 0, K, 0, 0);
  }
  hud(sx, t);
  if (t >= 29.95) { sx.fillStyle = '#000'; sx.fillRect(0, 0, W, H); }
  post(t);
}
window.setTime = setTime;
if (!/render/.test(location.search)) { const t0 = performance.now(); const loop = () => { setTime(((performance.now() - t0) / 1000) % 30); requestAnimationFrame(loop); }; loop(); }
