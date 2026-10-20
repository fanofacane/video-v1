'use strict';
// TYPE IN MOTION — 30s kinetic typography, 120 BPM (beat = 0.5s).
// Stage is 1280x720 (rendered at 1.5x = 1920x1080). Every scene is a function of local time.

const W = 1280, H = 720, RES = 3;
const BLUE = '#3400f3', YEL = '#efff0c', WHITE = '#ffffff', INK = '#0b0820';
const stage = document.getElementById('stage'), bgEl = document.getElementById('bg');
const hudEls = [...document.querySelectorAll('.hud')], tabEl = document.getElementById('tab');

// ---------- easing ----------
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const L = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const eOut3 = t => 1 - Math.pow(1 - t, 3), eIn3 = t => t * t * t;
const eOutX = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)), eInX = t => (t <= 0 ? 0 : Math.pow(2, 10 * (t - 1)));
const eIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const back = (t, s = 1.7) => { t -= 1; return t * t * ((s + 1) * t + s) + 1; };
const hash = n => { let h = Math.imul(n | 0, 2654435761) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };

// ---------- drawables ----------
function textCanvas(str, weight, size, o = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `${weight} ${size * RES}px Mont`, ls = (o.track || 0) * size * RES;
  g.font = font; g.letterSpacing = ls + 'px';
  const m = g.measureText(str);
  const Lb = m.actualBoundingBoxLeft, R = m.actualBoundingBoxRight, A = m.actualBoundingBoxAscent, D = m.actualBoundingBoxDescent;
  const pad = (o.pad ?? 8) * RES;
  c.width = Math.ceil(Lb + R + 2 * pad); c.height = Math.ceil(A + D + 2 * pad);
  if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, c.width, c.height); }
  g.font = font; g.letterSpacing = ls + 'px';
  if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.stroke * RES; g.strokeStyle = o.color || WHITE; g.strokeText(str, pad + Lb, pad + A); }
  else { g.fillStyle = o.color || WHITE; g.fillText(str, pad + Lb, pad + A); }
  const sx = o.scaleX || 1;
  c.className = 'el';
  c.style.width = c.width / RES * sx + 'px'; c.style.height = c.height / RES + 'px';
  c._bw = c.width / RES * sx; c._bh = c.height / RES; c._inkW = (Lb + R) / RES * sx; c._inkH = (A + D) / RES;
  return c;
}
// text whose cap/ink height is h (and optionally ink width w)
function T(str, weight, h, o = {}) {
  const p = textCanvas(str, weight, 100, { ...o, scaleX: 1 }), size = 100 * h / p._inkH;
  if (!o.w) return textCanvas(str, weight, size, o);
  const p2 = textCanvas(str, weight, size, { ...o, scaleX: 1 });
  return textCanvas(str, weight, size, { ...o, scaleX: o.w / p2._inkW });
}
function star(r, color = YEL) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), R = r * RES, pad = 4 * RES;
  c.width = c.height = Math.ceil(2 * R + 2 * pad);
  g.fillStyle = color; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.45 : R; g.lineTo(c.width / 2 + Math.cos(a) * rr, c.height / 2 + Math.sin(a) * rr); }
  g.closePath(); g.fill();
  c.className = 'el'; c.style.width = c.style.height = c.width / RES + 'px'; c._bw = c._bh = c.width / RES;
  return c;
}
function tag(str, h = 22) { return T(str, 800, h, { bg: INK, pad: 5 }); }
function place(el, p) {
  if (p.v === false || (p.s ?? 1) <= 0.001) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.style.opacity = p.op ?? 1;
  el.style.transform = `translate(${p.x - el._bw / 2}px,${p.y - el._bh / 2}px) perspective(${p.persp || 900}px) rotateZ(${p.rz || 0}deg) rotateY(${p.ry || 0}deg) rotateX(${p.rx || 0}deg) scale(${(p.sx ?? 1) * (p.s ?? 1)},${p.s ?? 1})`;
}
function group(div, g) { div.style.transform = `translate(${g.x || 0}px,${g.y || 0}px) rotate(${g.r || 0}deg) scale(${g.s ?? 1})`; div.style.opacity = g.op ?? 1; }
// whip-rotate exit: fast spin + shrink + drop
const whip = (lt, a, b, dir = -1) => { const q = eInX(P(lt, a, b)); return { r: dir * 52 * q, s: L(1, 0.5, q), x: -70 * q, y: 190 * q }; };
// whip-rotate entry (the WOIAM move)
const spinIn = (lt, a, b) => { const q = eOutX(P(lt, a, b)); return { rz: L(62, 0, q), dx: L(-110, 0, q), dy: L(250, 0, q), s: L(0.8, 1, q) }; };
// frame-held sample time (no motion blur: the giant slams are held per frame)
const held = t => Math.round(t * 30) / 30;
function clipDiv(parent, x0, x1, tilt = 10, cy = 380) {
  const d = document.createElement('div'); d.className = 'lyr'; const a = Math.tan(tilt * Math.PI / 180);
  d.style.clipPath = `polygon(${x0 + a * cy}px 0px, ${x1 + a * cy}px 0px, ${x1 - a * (H - cy)}px ${H}px, ${x0 - a * (H - cy)}px ${H}px)`;
  parent.appendChild(d); return d;
}
// wavy two-line text (the SHIVERS look) rendered to its own canvas each frame
function waveBlock(top, bottom, w = 300) {
  const SW = w + 40, SH = 170;
  const flat = document.createElement('canvas'); flat.width = SW * RES; flat.height = SH * RES;
  const g = flat.getContext('2d');
  const a = T(top, 900, 30, { w, track: 0.06, pad: 0 }), b = T(bottom, 900, 78, { w, track: -0.02, pad: 0 });
  g.drawImage(a, 20 * RES, 16 * RES, w * RES, a._bh * RES);
  g.drawImage(b, 20 * RES, (16 + a._bh + 7) * RES, w * RES, b._bh * RES);
  const c = document.createElement('canvas'); c.width = flat.width; c.height = flat.height; c.className = 'el';
  c.style.width = SW + 'px'; c.style.height = SH + 'px'; c._bw = SW; c._bh = SH;
  c.draw = t => {
    const cg = c.getContext('2d'); cg.clearRect(0, 0, c.width, c.height); const step = 2 * RES;
    for (let x = 0; x < c.width; x += step) { const u = x / RES; const dy = Math.sin(u / 48 + t * 10) * 7 + Math.sin(u / 21 - t * 6.3) * 2.5; cg.drawImage(flat, x, 0, step, flat.height, x, dy * RES, step, flat.height); }
  };
  return c;
}

// ---------- scenes ----------
const scenes = [];
function scene(t0, t1, build) {
  const div = document.createElement('div'); div.className = 'lyr'; stage.insertBefore(div, hudEls[0]);
  scenes.push({ t0, t1, div, update: build(div) });
}

// ===== 1. IT STARTS / WITH / ONE (0 – 2.6) =====
scene(0, 2.6, d => {
  const word = T('IT STARTS', 900, 92, { track: -0.01 }), s1 = star(30), tg = tag('WITH'), big = star(150);
  const clip = clipDiv(d, 250, 975);
  const ONE = ['O', 'N', 'E'].map(ch => T(ch, 900, 200));
  d.append(word, s1, tg); clip.append(...ONE); d.appendChild(big);
  return lt => {
    group(d, whip(lt, 2.2, 2.6));
    const p = eOut3(P(lt, 0, 0.35)), s = L(0.85, 1, p) * (1 + lt * 0.06);
    const x = L(470, 600, eOutX(P(lt, 0, 0.5))) - lt * 8, y = L(250, 222, p) - lt * 10, rz = L(-6, -2, p) - lt * 2.2;
    place(word, { x, y, s, rz, ry: L(-86, 0, p), persp: 700 });
    place(s1, { x: x - 205 * s, y: y - 58 * s, s: back(P(lt, 0.05, 0.35)) * 1.7, rz: -20 + lt * 40 });
    place(tg, { v: lt > 0.1, x: x + 170 * s + lt * 18, y: y + 66 * s, s: L(0.5, 1.15, eOutX(P(lt, 0.1, 0.4))), rz: L(12, 3, eOutX(P(lt, 0.1, 0.4))) - lt * 3 });
    const q = P(lt, 0.05, 0.45);
    place(big, { x: L(220, 900, eOutX(P(lt, 0, 0.6))) + lt * 30, y: L(560, 470, eOut3(P(lt, 0, 0.5))) - lt * 10,
      s: (0.95 - 0.38 * Math.sin(Math.PI * q)) * L(1, 1.12, P(lt, 0.5, 1.4)), ry: L(0, 180, eIO(q)), rz: -18 + lt * 12, persp: 1400 });
    const tgt = [[390, 210], [600, 175], [790, 150]];
    ONE.forEach((el, i) => {
      const a = 0.5 + i * 0.07, k = eOutX(P(lt, a, a + 0.9)), grow = 1 + lt * 0.08;
      const w = tgt[i][1] * grow, h = 175 * grow * (i === 0 ? 1.06 : 1);
      place(el, { v: lt > a, x: tgt[i][0] + L(560, 0, k) - lt * 22, y: L(560, 548, k) - h / 2 + i * -22 + lt * 14, s: h / el._inkH, sx: (w / el._inkW) / (h / el._inkH), rz: -12 });
    });
  };
});

// ===== 2. FRAME (2.5 – 4.6) =====
scene(2.5, 4.6, d => {
  const word = T('FRAME', 900, 128, { w: 470, track: -0.03 }), a = star(46), b = star(32);
  d.append(word, a, b);
  return lt => {
    const si = spinIn(lt, 0, 0.55), out = eInX(P(lt, 1.85, 2.1));
    const x = 640 + si.dx - out * 260, y = 340 + si.dy, s = si.s * (1 + lt * 0.03) * L(1, 0.6, out), rz = si.rz;
    place(word, { x, y, s, rz, op: 1 - P(lt, 2.0, 2.1) });
    const rad = rz * Math.PI / 180, co = Math.cos(rad), sn = Math.sin(rad);
    const at = (dx, dy) => [x + (dx * co - dy * sn) * s, y + (dx * sn + dy * co) * s];
    const ks = L(3.2, 1, eOutX(P(lt, 0, 0.8))), [ax, ay] = at(-225, -98), [bx, by] = at(238, 90);
    place(a, { x: ax, y: ay, s: s * ks, rz: rz + L(-260, 0, eOutX(P(lt, 0, 0.8))) + lt * 25, op: 1 - P(lt, 2.0, 2.1) });
    place(b, { x: bx, y: by, s: s * ks * 0.95, rz: rz + L(-200, 0, eOutX(P(lt, 0, 0.8))) + lt * 40, op: 1 - P(lt, 2.0, 2.1) });
  };
});

// ===== 3. THEN / ANOTHER (4.55 – 6.5) =====
scene(4.55, 6.5, d => {
  const wb = waveBlock('THEN', 'ANOTHER', 300); d.appendChild(wb);
  return (lt, t) => {
    wb.draw(t);
    const k = eOutX(P(lt, 0, 0.28));
    place(wb, { x: L(980, 640, k), y: 360, s: L(1.35, 1.12, k) * L(1, 0.8, eOut3(P(lt, 0.2, 1.95))) });
  };
});

// ===== 4. AND → AGAIN (6.5 – 9.0) =====
scene(6.5, 9.0, d => {
  const letters = ['A', 'N', 'D'].map(ch => T(ch, 800, 46, { scaleX: 1.08 }));
  const andW = T('AND', 800, 46, { scaleX: 1.08, track: 0.01 }), again = T('AGAIN', 800, 46, { scaleX: 1.08, track: 0.01 });
  const echoes = [-2, -1, 1, 2].map(() => T('AND AGAIN', 800, 46, { scaleX: 1.08, track: 0.01, stroke: 1.6 }));
  d.append(...letters, andW, again, ...echoes);
  const lx = [-48, 0, 49];
  return lt => {
    const LAND = 1.0;
    if (lt < LAND + 0.05) {
      letters.forEach((el, i) => { const a = 0.05 + i * 0.12, q = P(lt, a, a + 0.3); place(el, { v: lt > a, x: 640 + lx[i] - lt * 18, y: L(-40, 360, back(q, 1.2)), rz: L(-16, 0, q) }); });
      place(andW, { v: false }); echoes.forEach(el => place(el, { v: false }));
      const k = Math.round((held(lt) - LAND) * 30);
      if (k >= 0 && k < 2) place(again, { x: k === 0 ? 700 : 820, y: k === 0 ? 380 : 352, s: [16, 9.5][k] });
      else place(again, { v: false });
    } else {
      letters.forEach(el => place(el, { v: false }));
      const s = 1.2 * (1 + (lt - LAND) * 0.05) * (lt < LAND + 0.1 ? L(1.1, 1, P(lt, LAND, LAND + 0.1)) : 1);
      const wA = andW._inkW * s, wB = again._inkW * s, sp = 18 * s, tot = wA + sp + wB, left = 640 - tot / 2;
      place(andW, { x: left + wA / 2, y: 360, s }); place(again, { x: left + wA + sp + wB / 2, y: 360, s });
      echoes.forEach((el, i) => {
        const lvl = [-2, -1, 1, 2][i], a = LAND + 0.5 + (Math.abs(lvl) - 1) * 0.5, q = eOutX(P(lt, a, a + 0.25));
        place(el, { v: lt > a, x: 640, y: 360 + lvl * 74 * s, s: s * L(1.4, 1, q), op: q * 0.9 });
      });
    }
  };
});

// ===== 5. FEEL THE BEAT — inverted (9.0 – 11.0) =====
scene(9.0, 11.0, d => {
  const feel = T('FEEL', 900, 170, { color: BLUE }), the = T('THE', 900, 120, { color: BLUE }), beat = T('BEAT', 900, 230, { color: BLUE });
  const stars = [0, 1, 2, 3].map(() => star(40, BLUE));
  d.append(feel, the, beat, ...stars);
  return lt => {
    d._bg = YEL;
    const punch = (a) => { const q = lt - a; return q >= 0 && q < 0.25 ? 1 + 0.22 * Math.exp(-q * 14) : 1; };
    place(feel, { v: lt < 0.5, x: 640, y: 360, s: L(1.6, 1, eOutX(P(lt, 0, 0.18))) * punch(0.25), rz: -4 });
    place(the, { v: lt >= 0.5 && lt < 1.0, x: 640, y: 360, ry: L(-80, 0, eOut3(P(lt, 0.5, 0.75))), s: punch(0.75), rz: 3, persp: 600 });
    let pb = 1, rz = 0;
    for (let i = 0; i < 4; i++) { const a = 1.0 + i * 0.25; if (lt >= a) { pb = 1 + 0.28 * Math.exp(-(lt - a) * 12); rz = i % 2 ? 4 : -4; } }
    place(beat, { v: lt >= 1.0, x: 640, y: 365, s: pb, rz });
    const pos = [[190, 160], [1090, 170], [200, 560], [1080, 560]];
    stars.forEach((el, i) => place(el, { v: lt >= 1.0 + i * 0.25, x: pos[i][0], y: pos[i][1], s: back(P(lt, 1.0 + i * 0.25, 1.25 + i * 0.25), 2.6) * 1.2, rz: lt * 90 + i * 30 }));
  };
});

// ===== 6. LEFT / RIGHT / UP / DOWN (11.0 – 13.6) =====
scene(11.0, 13.6, d => {
  const words = ['LEFT', 'RIGHT', 'UP', 'DOWN'].map(w => T(w, 900, 110));
  const st = star(60); d.append(...words, st);
  const fin = [[400, 260], [880, 260], [440, 470], [860, 470]];
  const from = [[-320, 260], [1600, 260], [440, 920], [860, -200]];
  return lt => {
    const col = eInX(P(lt, 2.0, 2.35));
    words.forEach((el, i) => {
      const a = i * 0.5, k = eOutX(P(lt, a, a + 0.32));
      const x = L(from[i][0], fin[i][0], k), y = L(from[i][1], fin[i][1], k);
      place(el, { v: lt >= a, x: L(x, 640, col), y: L(y, 360, col), s: L(1, 0.05, col), rz: L(i % 2 ? 4 : -4, 0, k) * (1 - col) + col * 90 });
    });
    const sg = P(lt, 2.25, 2.55);
    place(st, { v: lt > 2.2, x: 640, y: 360, s: lt < 2.25 ? back(P(lt, 2.2, 2.25)) * 0.6 : L(0.6, 34, eInX(sg)), rz: lt * 200 });
  };
});

// ===== 7. 01 → 30 FRAMES EVERY SECOND (13.55 – 16.0) =====
scene(13.55, 16.0, d => {
  const DH = 300, dW = 210;
  const odo = document.createElement('canvas'); odo.className = 'el'; odo.width = 2 * dW * RES; odo.height = DH * 1.3 * RES;
  odo.style.width = 2 * dW + 'px'; odo.style.height = DH * 1.3 + 'px'; odo._bw = 2 * dW; odo._bh = DH * 1.3;
  const digits = [...'0123456789'].map(ch => T(ch, 900, DH, { pad: 0 }));
  const frames = T('FRAMES', 900, 92), every = tag('EVERY', 24), second = T('SECOND', 900, 92), st = star(70);
  const clip = clipDiv(d, 640, 1262, 8, 470); d.append(odo, frames, every, st); clip.appendChild(second);
  const drawOdo = v => {
    const g = odo.getContext('2d'); g.clearRect(0, 0, odo.width, odo.height);
    const units = v % 10, tensPos = Math.floor(v / 10) + Math.max(0, units - 9);
    [[tensPos, 0], [units, 1]].forEach(([pos, col]) => {
      const base = Math.floor(pos), fr = pos - base, lh = DH * 1.18;
      for (const [dig, off] of [[base % 10, -fr * lh], [(base + 1) % 10, (1 - fr) * lh]]) {
        const im = digits[dig]; const w = im._bw, h = im._bh;
        g.drawImage(im, (col * dW + (dW - w) / 2) * RES, ((DH * 1.3 - h) / 2 + off) * RES, w * RES, h * RES);
      }
    });
  };
  return lt => {
    group(d, whip(lt, 2.05, 2.45));
    drawOdo(L(1, 30, eOut3(P(lt, 0.05, 1.45))));
    place(odo, { x: 340 + lt * 6, y: 360, s: L(0.6, 1, eOutX(P(lt, 0, 0.3))) * (1 + lt * 0.03), rz: -3, ry: L(-70, 0, eOut3(P(lt, 0, 0.35))), persp: 900 });
    const pf = eOut3(P(lt, 0.25, 0.6));
    place(frames, { v: lt > 0.25, x: 900 + lt * 8, y: 280 - lt * 6, ry: L(-85, 0, pf), s: L(0.85, 1, pf), rz: -3, persp: 700 });
    place(every, { v: lt > 0.6, x: 1010 + lt * 10, y: 345, s: L(0.5, 1.2, eOutX(P(lt, 0.6, 0.85))), rz: L(10, 2, eOutX(P(lt, 0.6, 0.85))) });
    const ks = eOutX(P(lt, 1.0, 1.8));
    place(second, { v: lt > 1.0, x: L(1500, 940, ks) - lt * 10, y: 452 + lt * 8, s: 1 + lt * 0.03, rz: -8 });
    const qs = P(lt, 0.15, 0.6);
    place(st, { v: lt > 0.1, x: 1150, y: 150, s: (1 - 0.6 * Math.sin(Math.PI * qs)) * back(P(lt, 0.1, 0.3)), ry: L(0, 180, eIO(qs)), rz: lt * 20, persp: 1200 });
  };
});

// ===== 8. MOTION — sweep + marquee (16.0 – 18.5) =====
scene(16.0, 18.5, d => {
  const giant = T('MOTION', 900, 600, { track: -0.02 }), inW = T('IN', 800, 44);
  const rows = [-3, -2, -1, 0, 1, 2, 3].map(r => { const el = T('MOTION  MOTION  MOTION  MOTION', 900, 66, r === 0 ? {} : { stroke: 1.8 }); el._r = r; return el; });
  d.append(inW, giant, ...rows);
  return lt => {
    const sw = P(lt, 0, 0.75);
    place(giant, { v: lt < 0.75, x: L(W + giant._bw / 2, -giant._bw / 2, eIO(sw)), y: 380 });
    place(inW, { v: lt < 0.8, x: 640, y: 360, s: back(P(lt, 0, 0.15)) });
    rows.forEach(el => {
      const a = 0.75 + Math.abs(el._r) * 0.06, k = eOutX(P(lt, a, a + 0.4)), dir = el._r % 2 ? -1 : 1;
      const drift = dir * (lt - a) * 160;
      place(el, { v: lt > a, x: 640 + drift + dir * L(-1400, 0, k), y: 360 + el._r * 92, op: el._r === 0 ? 1 : 0.9 });
    });
  };
});

// ===== 9. BLUR / THE LINES (18.5 – 21.0) =====
scene(18.5, 21.0, d => {
  const blur = T('BLUR', 900, 210), tg = tag('THE LINES', 30), st = star(46);
  d.append(blur, tg, st);
  return lt => {
    let x = 640;
    for (let i = 0; i < 3; i++) { const a = i * 0.5, k = eOutX(P(lt, a, a + 0.2)); if (lt >= a) x = 640 + (i % 2 ? -1 : 1) * 620 * (1 - k); }
    const zo = eInX(P(lt, 2.2, 2.5));
    group(d, { s: L(1, 7, zo), op: 1 - P(lt, 2.4, 2.5) });
    place(blur, { x, y: 350, rz: -4, s: 1 + lt * 0.03 });
    place(tg, { v: lt > 1.6, x: 860, y: 470, s: L(0.5, 1.2, eOutX(P(lt, 1.6, 1.85))), rz: L(12, -3, eOutX(P(lt, 1.6, 1.85))) });
    place(st, { v: lt > 1.7, x: 390, y: 220, s: back(P(lt, 1.7, 1.95), 2.6) * 1.4, rz: lt * 60 });
  };
});

// ===== 10. SPIN (21.0 – 23.6) =====
scene(21.0, 23.6, d => {
  const letters = [...'SPIN'].map(ch => T(ch, 900, 200)), stars = [0, 1, 2].map(() => star(42));
  d.append(...letters, ...stars);
  const xs = [430, 590, 715, 850];
  return lt => {
    group(d, whip(lt, 2.2, 2.6));
    letters.forEach((el, i) => {
      const a = i * 0.12, q = P(lt, a, a + 0.6);
      place(el, { v: lt > a - 0.02, x: xs[i], y: 360 + Math.sin(lt * 4 + i) * 6, ry: L(-360, 0, eOut3(q)) + Math.sin(lt * 3 + i) * 6, s: L(0.4, 1, eOutX(q)), rz: -4, persp: 700 });
    });
    stars.forEach((el, i) => {
      const ang = lt * 2.6 + i * (Math.PI * 2 / 3);
      place(el, { v: lt > 0.3, x: 640 + Math.cos(ang) * 470, y: 360 + Math.sin(ang) * 210, s: back(P(lt, 0.3 + i * 0.1, 0.55 + i * 0.1)) * (1 + 0.25 * Math.sin(ang)), ry: (lt * 400 + i * 60) % 360, rz: lt * 40, persp: 900 });
    });
  };
});

// ===== 11. DON'T STOP (23.55 – 26.0) =====
scene(23.55, 26.0, d => {
  const chars = [...'DON’T'], letters = chars.map(ch => T(ch, 800, 46, { scaleX: 1.08 }));
  const dont = T('DON’T', 800, 46, { scaleX: 1.08, track: 0.01 }), stop = T('STOP', 800, 46, { scaleX: 1.08, track: 0.01 });
  const stars = [0, 1, 2, 3].map(() => star(34));
  d.append(...letters, dont, stop, ...stars);
  const lx = [-70, -22, 26, 56, 82];
  return lt => {
    const LAND = 0.95;
    if (lt < LAND + 0.05) {
      letters.forEach((el, i) => { const a = 0.05 + i * 0.1, q = P(lt, a, a + 0.28); place(el, { v: lt > a, x: 640 + lx[i] - lt * 16, y: L(-40, 360, back(q, 1.2)), rz: L(-16, 0, q) }); });
      place(dont, { v: false });
      const k = Math.round((held(lt) - LAND) * 30);
      if (k >= 0 && k < 2) place(stop, { x: k === 0 ? 690 : 800, y: k === 0 ? 380 : 350, s: [17, 10][k] });
      else place(stop, { v: false });
      stars.forEach(el => place(el, { v: false }));
    } else {
      letters.forEach(el => place(el, { v: false }));
      let s = 1.25 * (1 + (lt - LAND) * 0.05);
      for (const a of [1.45, 1.95]) if (lt >= a) s *= 1 + 0.12 * Math.exp(-(lt - a) * 12);
      const wA = dont._inkW * s, wB = stop._inkW * s, sp = 18 * s, tot = wA + sp + wB, left = 640 - tot / 2;
      place(dont, { x: left + wA / 2, y: 360, s }); place(stop, { x: left + wA + sp + wB / 2, y: 360, s });
      const pos = [[430, 270], [880, 250], [400, 460], [870, 470]];
      stars.forEach((el, i) => { const q = P(lt, LAND + 0.02 + i * 0.04, LAND + 0.3 + i * 0.04); place(el, { x: L(640, pos[i][0], eOutX(q)), y: L(360, pos[i][1], eOutX(q)), s: back(q, 2.4) * (0.8 + 0.3 * (i % 2)), rz: lt * 120 + i * 40 }); });
    }
  };
});

// ===== 12. MAKE IT / MOVE → TYPE IN / MOTION (26.0 – 30.0) =====
scene(26.0, 27.95, d => {
  const word = T('MAKE IT', 900, 96), s1 = star(30), tg = tag('NOW'), big = star(140);
  const clip = clipDiv(d, 230, 990);
  const MOVE = [...'MOVE'].map(ch => T(ch, 900, 190));
  d.append(word, s1, tg); clip.append(...MOVE); d.appendChild(big);
  return lt => {
    group(d, whip(lt, 1.55, 1.95));
    const p = eOut3(P(lt, 0, 0.35)), s = L(0.85, 1, p) * (1 + lt * 0.06);
    const x = L(480, 590, eOutX(P(lt, 0, 0.5))) - lt * 8, y = L(240, 212, p) - lt * 8, rz = L(-6, -2, p) - lt * 2.2;
    place(word, { x, y, s, rz, ry: L(-86, 0, p), persp: 700 });
    place(s1, { x: x - 190 * s, y: y - 60 * s, s: back(P(lt, 0.05, 0.35)) * 1.7, rz: -20 + lt * 40 });
    place(tg, { v: lt > 0.1, x: x + 175 * s, y: y + 68 * s, s: L(0.5, 1.2, eOutX(P(lt, 0.1, 0.4))), rz: L(12, 3, eOutX(P(lt, 0.1, 0.4))) });
    const q = P(lt, 0.05, 0.45);
    place(big, { x: L(1300, 1010, eOutX(P(lt, 0, 0.6))) + lt * 10, y: L(620, 470, eOut3(P(lt, 0, 0.5))), s: (0.95 - 0.38 * Math.sin(Math.PI * q)), ry: L(0, -180, eIO(q)), rz: 18 - lt * 10, persp: 1400 });
    const tgt = [[350, 230], [575, 175], [760, 165], [925, 140]];
    MOVE.forEach((el, i) => {
      const a = 0.5 + i * 0.06, k = eOutX(P(lt, a, a + 0.9)), grow = 1 + lt * 0.08;
      const w = tgt[i][1] * grow, h = 168 * grow * (i === 0 ? 1.06 : 1);
      place(el, { v: lt > a, x: tgt[i][0] + L(620, 0, k) - lt * 22, y: L(560, 540, k) - h / 2 - i * 20 + lt * 14, s: h / el._inkH, sx: (w / el._inkW) / (h / el._inkH), rz: -12 });
    });
  };
});
scene(27.85, 30.0, d => {
  const a = T('TYPE IN', 900, 96, { w: 440, track: -0.02 }), b = T('MOTION', 900, 120, { w: 440, track: -0.03 });
  const sa = star(44), sb = star(30), tg = tag('STUDY Nº01', 24);
  d.append(a, b, sa, sb, tg);
  return lt => {
    const si = spinIn(lt, 0, 0.6), end = eInX(P(lt, 1.85, 2.15));
    const cx = 640 + si.dx, cy = 360 + si.dy, s = si.s * (1 + lt * 0.025) * L(1, 0.2, end), rz = si.rz;
    const rad = rz * Math.PI / 180, co = Math.cos(rad), sn = Math.sin(rad);
    const at = (dx, dy) => [cx + (dx * co - dy * sn) * s, cy + (dx * sn + dy * co) * s];
    const [ax, ay] = at(0, -62), [bx, by] = at(0, 58);
    place(a, { x: ax, y: ay, s, rz }); place(b, { x: bx, y: by, s, rz });
    const ks = L(3.2, 1, eOutX(P(lt, 0, 0.8)));
    const [sax, say] = at(-232, -125), [sbx, sby] = at(240, 125);
    place(sa, { x: sax, y: say, s: s * ks, rz: rz + L(-260, 0, eOutX(P(lt, 0, 0.8))) + lt * 25 });
    place(sb, { x: sbx, y: sby, s: s * ks, rz: rz + L(-200, 0, eOutX(P(lt, 0, 0.8))) + lt * 40 });
    const [tx, ty] = at(150, 140);
    place(tg, { v: lt > 0.45, x: tx, y: ty, s: s * L(0.5, 1.15, eOutX(P(lt, 0.45, 0.7))), rz: rz + L(12, 4, eOutX(P(lt, 0.45, 0.7))) });
    group(d, { op: 1 - P(lt, 2.1, 2.15) });
  };
});

// ---------- frame ----------
function setTime(t) {
  let bg = null;
  for (const s of scenes) {
    const on = t >= s.t0 && t < s.t1;
    s.div.style.display = on ? 'block' : 'none';
    if (on) { s.div._bg = null; s.div.style.transform = ''; s.div.style.opacity = 1; s.update(t - s.t0, t); if (s.div._bg) bg = s.div._bg; }
  }
  const inv = !!bg;
  bgEl.style.background = inv ? bg : 'linear-gradient(to bottom,#3100de 0px,#3400f3 120px,#3400f3 600px,#3200dc 720px)';
  hudEls.forEach(h => (h.style.color = inv ? BLUE : WHITE));
  tabEl.style.background = inv ? BLUE : INK; tabEl.style.color = inv ? YEL : WHITE;
}
window.setTime = setTime;
if (!/render/.test(location.search)) { const t0 = performance.now(); const loop = () => { setTime(((performance.now() - t0) / 1000) % 30); requestAnimationFrame(loop); }; loop(); }
