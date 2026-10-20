'use strict';
// Frame-matched remake of the 0–3.7s lyric intro. All coordinates are in the
// 1280x556 design band; keys are reference frame numbers (1-based, 30fps).

const RES = 4;                 // canvas supersampling
const YEL = '#efff0c';
const $ = id => document.getElementById(id);

// ---------- monotone cubic track ----------
function track(keys) {
  const n = keys.length, xs = keys.map(k => k[0]), ys = keys.map(k => k[1]);
  if (n === 1) return () => ys[0];
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return f => {
    if (f <= xs[0]) return ys[0];
    if (f >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (f > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (f - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const T = o => { const r = {}; for (const k in o) r[k] = Array.isArray(o[k]) ? track(o[k]) : () => o[k]; return r; };

// ---------- drawable factories ----------
function textCanvas(str, weight, size, o = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `${weight} ${size * RES}px Mont`, ls = (o.track || 0) * size * RES;
  g.font = font; g.letterSpacing = ls + 'px';
  const m = g.measureText(str);
  const L = m.actualBoundingBoxLeft, R = m.actualBoundingBoxRight, A = m.actualBoundingBoxAscent, D = m.actualBoundingBoxDescent;
  const pad = (o.pad ?? 6) * RES;
  c.width = Math.ceil(L + R + 2 * pad); c.height = Math.ceil(A + D + 2 * pad);
  if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, c.width, c.height); }
  g.font = font; g.letterSpacing = ls + 'px'; g.fillStyle = o.color || '#fff'; g.textBaseline = 'alphabetic';
  g.fillText(str, pad + L, pad + A);
  const sx = o.scaleX || 1;
  c.className = 'el';
  c.style.width = c.width / RES * sx + 'px'; c.style.height = c.height / RES + 'px';
  c._bw = c.width / RES * sx; c._bh = c.height / RES;
  c._inkW = (L + R) / RES * sx; c._inkH = (A + D) / RES;
  c._sub = s => { g.font = font; g.letterSpacing = ls + 'px'; return g.measureText(s).width / RES * sx; }; // advance of a prefix
  c._L = L / RES * sx;
  return c;
}
// size a text so its ink is exactly w x h band px
function fitText(str, weight, w, h, o = {}) {
  const probe = textCanvas(str, weight, 100, { ...o, scaleX: 1 });
  const size = 100 * h / probe._inkH;
  const p2 = textCanvas(str, weight, size, { ...o, scaleX: 1 });
  return textCanvas(str, weight, size, { ...o, scaleX: w / p2._inkW });
}
function starCanvas(r, inner = 0.45) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const R = r * RES, pad = 4 * RES;
  c.width = c.height = Math.ceil(2 * R + 2 * pad);
  g.fillStyle = YEL; g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * inner : R;
    g.lineTo(c.width / 2 + Math.cos(a) * rr, c.height / 2 + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
  c.className = 'el'; c.style.width = c.style.height = c.width / RES + 'px';
  c._bw = c._bh = c.width / RES; c._r = r;
  return c;
}
// place: centre (x,y); anchor (ax,ay) is an offset from the box centre that lands on (x,y)
function place(el, p) {
  if (!p.v) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const ax = p.ax || 0, ay = p.ay || 0;
  el.style.opacity = p.op ?? 1;
  el.style.transformOrigin = `${el._bw / 2 + ax}px ${el._bh / 2 + ay}px`;
  el.style.transform = `translate(${p.x - el._bw / 2 - ax}px,${p.y - el._bh / 2 - ay}px) perspective(${p.persp || 900}px) rotateZ(${p.rz || 0}deg) rotateY(${p.ry || 0}deg) scale(${(p.sx ?? 1) * (p.s ?? 1)},${p.s ?? 1})`;
}

// ======================================================================
// ELEMENTS
// ======================================================================
const g1 = $('g1'), g2 = $('g2'), g3 = $('g3'), whoClip = $('whoClip');

// --- scene 1 ---
const cause = fitText('CAUSE', 900, 387, 90, { track: -0.01 });
const star1 = starCanvas(30);
const tag = textCanvas('KNOW', 800, 30, { bg: '#0b0820', pad: 4 });
const LW = textCanvas('W', 900, 200), LH = textCanvas('H', 900, 200), LO2 = textCanvas('O', 900, 200);
const iL = fitText('I', 900, 42, 180);
const bigStar = starCanvas(150);
g1.insertBefore(cause, whoClip); g1.insertBefore(star1, whoClip); g1.insertBefore(tag, whoClip);
whoClip.append(LW, LH, LO2); g1.appendChild(iL); g1.appendChild(bigStar);
// ink-centre of the H inside "WHO" (anchor so tracks can follow the H)

// --- scene 2 ---
const woiam = fitText('WOIAM', 900, 437, 127, { track: -0.035 });
const starA = starCanvas(46), starB = starCanvas(31);
g2.append(woiam, starA, starB);

// --- scene 3: WAVES / SHIVERS (wavy) ---
const shiv = document.createElement('canvas'); shiv.className = 'el';
const SW = 330, SH = 140; shiv.width = SW * RES; shiv.height = SH * RES;
shiv.style.width = SW + 'px'; shiv.style.height = SH + 'px'; shiv._bw = SW; shiv._bh = SH;
g3.appendChild(shiv);
const flat = document.createElement('canvas'); flat.width = SW * RES; flat.height = SH * RES;
function drawFlat() {
  const g = flat.getContext('2d'); g.clearRect(0, 0, flat.width, flat.height);
  const wav = fitText('WAVES', 900, 300, 30, { track: 0.04, pad: 0 });
  const sh = fitText('SHIVERS', 900, 300, 72, { track: -0.02, pad: 0 });
  g.drawImage(wav, 15 * RES, 12 * RES, 300 * RES, wav._bh * RES);
  g.drawImage(sh, 15 * RES, (12 + wav._bh + 6) * RES, 300 * RES, sh._bh * RES);
}
function drawWave(f) {
  const g = shiv.getContext('2d'); g.clearRect(0, 0, shiv.width, shiv.height);
  const step = 2 * RES;
  for (let x = 0; x < shiv.width; x += step) {
    const u = x / RES;
    const dy = Math.sin(u / 48 + f * 0.33) * 7 + Math.sin(u / 21 - f * 0.21) * 2.5;
    g.drawImage(flat, x, 0, step, flat.height, x, dy * RES, step, flat.height);
  }
}

// --- scene 4: GOD + DAMN ---
const GOD_W = 132, GOD_H = 41;
const godWord = fitText('GOD', 800, GOD_W, GOD_H, { track: 0.01 });
// same size + scaleX as the word
const godSize = (() => { const p = textCanvas('GOD', 800, 100, { track: 0.01 }); return 100 * GOD_H / p._inkH; })();
const godSX = (() => { const p = textCanvas('GOD', 800, godSize, { track: 0.01 }); return GOD_W / p._inkW; })();
const LG = textCanvas('G', 800, godSize, { scaleX: godSX }), LO = textCanvas('O', 800, godSize, { scaleX: godSX }), LD = textCanvas('D', 800, godSize, { scaleX: godSX });
const damn = textCanvas('DAMN', 800, godSize, { scaleX: godSX, track: 0.01 });
const godW = textCanvas('GOD', 800, godSize, { scaleX: godSX, track: 0.01 });
g3.append(LG, LO, LD, godW, damn);

// ======================================================================
// TRACKS (reference frame numbers)
// ======================================================================
const TR = {
  cause: T({
    x: [[2, 350], [3, 460], [4, 520], [5, 560], [6, 585], [7, 600], [8, 610], [9, 622], [12, 626], [13, 628], [16, 626], [19, 620], [25, 620], [31, 616], [37, 612], [43, 610]],
    y: [[2, 190], [3, 222], [4, 246], [5, 258], [6, 266], [7, 272], [9, 276], [12, 276], [13, 278], [16, 262], [19, 238], [22, 222], [25, 210], [31, 206], [37, 200], [43, 206]],
    s: [[2, 0.9], [3, 0.85], [4, 0.89], [5, 0.92], [6, 0.95], [7, 0.975], [8, 1], [12, 1], [13, 0.96], [16, 0.93], [19, 1], [22, 1.05], [25, 1.1], [28, 1.125], [31, 1.175], [34, 1.22], [37, 1.25], [43, 1.27]],
    ry: [[2, -82], [3, -60], [4, -38], [5, -22], [6, -12], [7, -6], [8, -2], [9, 0]],
    rz: [[2, -6], [9, -2], [22, -2], [25, -3], [31, -4], [37, -5], [43, -7]],
  }),
  star1: T({
    x: [[2, 250], [3, 424], [4, 510], [5, 544], [6, 556], [7, 564], [9, 556], [12, 540], [13, 530], [16, 504], [19, 466], [22, 436], [25, 420], [28, 406], [31, 390], [34, 372], [37, 360], [43, 342]],
    y: [[2, 165], [3, 182], [4, 194], [5, 204], [7, 208], [12, 212], [13, 200], [16, 192], [19, 158], [22, 142], [25, 138], [31, 136], [37, 140], [43, 150]],
    s: [[2, 0.8], [3, 0.95], [10, 1.4], [25, 1.85], [37, 2.0]],
    rz: [[2, -30], [13, -10], [25, 0], [43, 12]],
  }),
  tag: T({
    x: [[3, 450], [4, 530], [5, 590], [6, 634], [7, 656], [8, 672], [9, 684], [10, 700], [12, 710], [13, 714], [16, 724], [19, 740], [22, 752], [25, 764], [31, 772], [34, 784], [37, 790], [43, 800]],
    y: [[3, 285], [4, 304], [5, 314], [6, 320], [7, 324], [8, 328], [10, 332], [13, 334], [16, 324], [19, 302], [22, 284], [25, 280], [31, 286], [37, 286], [43, 270]],
    s: [[3, 0.55], [4, 0.75], [8, 1.0], [12, 1.05], [25, 1.15], [37, 1.25], [43, 1.25]],
    rz: [[3, 12], [12, 5], [25, 0], [37, -6], [43, -10]],
  }),
  // per-letter: centre x, ink width, lowest ink y (measured from the reference)
  W: T({ x: [[15.5, 1060], [16, 990], [17, 887], [18, 801], [19, 732], [20, 673], [22, 581], [25, 497], [28, 440], [31, 354], [34, 264], [37, 228], [40, 211], [43, 206]],
         w: [[16, 138], [18, 138], [19, 152], [20, 166], [22, 191], [25, 215], [28, 233], [31, 240], [34, 250], [37, 255], [40, 260], [43, 265]],
         b: [[16, 396], [18, 404], [19, 413], [20, 421], [22, 436], [25, 452], [28, 465], [31, 490], [34, 503], [37, 519], [40, 533], [43, 545]] }),
  H: T({ x: [[17.5, 1110], [18, 1030], [19, 966], [20, 906], [22, 805], [25, 720], [28, 664], [31, 581], [34, 499], [37, 466], [40, 455], [43, 457]],
         w: [[18, 112], [20, 115], [22, 118], [25, 129], [28, 134], [31, 142], [34, 165], [37, 176], [40, 182], [43, 192]],
         b: [[18, 378], [20, 388], [22, 398], [25, 412], [28, 423], [31, 445], [34, 475], [37, 491], [40, 504], [43, 524]] }),
  WO: T({ x: [[19.5, 1120], [20, 1060], [22, 997], [25, 890], [28, 830], [31, 757], [34, 688], [37, 660], [40, 650], [43, 651]],
         w: [[20, 120], [25, 125], [28, 131], [31, 143], [34, 163], [37, 170], [40, 171], [43, 170]],
         b: [[20, 352], [22, 360], [25, 368], [28, 383], [31, 401], [34, 425], [37, 435], [40, 439], [43, 441]] }),
  whoDy: T({ v: [[16, 4], [19, 8], [25, 12], [31, 13], [34, 22], [37, 32], [40, 30], [43, 25]] }),
  clipR: T({ v: [[16, 890], [17, 908], [19, 932], [21, 945], [23, 953], [43, 956]] }),
  iL: T({
    x: [[29.5, 1060], [30, 975], [31, 888], [32, 875], [34, 876], [37, 912], [40, 934], [43, 940]],
    y: [[30, 286], [31, 282], [34, 290], [37, 280], [40, 266], [43, 262]],
    rz: [[30, -8], [43, -12]],
  }),
  big: T({
    x: [[2, 216], [3, 424], [4, 556], [5, 636], [6, 702], [7, 760], [8, 800], [9, 818], [10, 830], [11, 840], [13, 850], [16, 862], [17, 880], [19, 920], [22, 950], [25, 978], [28, 990], [31, 1000], [34, 1018], [37, 1030], [40, 1040], [43, 1042]],
    y: [[2, 420], [3, 455], [4, 465], [5, 470], [8, 470], [11, 476], [13, 470], [16, 462], [17, 455], [19, 456], [22, 452], [25, 442], [28, 436], [31, 436], [34, 432], [37, 422], [40, 422], [43, 418]],
    s: [[2, 0.95], [3, 0.95], [4, 0.9], [6, 0.8], [8, 0.67], [10, 0.59], [13, 0.54], [16, 0.69], [19, 0.91], [22, 1.01], [25, 1.09], [37, 1.12], [43, 1.09]],
    ry: [[3, 0], [4, 31], [5, 46], [6, 61], [7, 75], [8, 87], [9, 93], [10, 112], [11, 125], [12, 139], [13, 160], [14, 180]],
    rz: [[2, -18], [13, 8], [25, 12], [37, 2], [43, -4]],
  }),
  // whip-rotate transition of the whole first group
  g1: T({
    r: [[43, 0], [44, -3], [45, -7], [46, -16], [47, -48]],
    s: [[43, 1], [45, 0.98], [46, 0.92], [47, 0.55]],
    x: [[45, 0], [46, -10], [47, -90]],
    y: [[44, 0], [45, -8], [46, 14], [47, 170]],
  }),
  woiam: T({
    x: [[46.6, 540], [47, 565], [48, 620], [49, 655], [50, 668], [51, 670], [52, 662], [54, 657], [57, 650], [61, 649], [62, 640], [62.6, 600]],
    y: [[46.6, 600], [47, 540], [48, 440], [49, 382], [50, 350], [51, 326], [52, 306], [54, 290], [56, 276], [58, 268], [61, 262], [62, 262]],
    rz: [[46.6, 75], [47, 58], [48, 38], [49, 25], [50, 18], [51, 12], [52, 6], [53, 3], [55, 1], [58, 0]],
    s: [[46.6, 0.8], [48, 1], [61, 1], [62, 0.88], [62.6, 0.55]],
  }),
  starA: T({ rz: [[46.6, -260], [49, -90], [52, -20], [61, 22]], s: [[46.6, 3.4], [48, 3.0], [49, 2.4], [50, 1.9], [52, 1.4], [55, 1.08], [57, 1]] }),
  starB: T({ rz: [[46.6, -200], [49, -60], [52, 0], [61, 40]], s: [[46.6, 3.0], [48, 2.6], [49, 2.1], [50, 1.7], [52, 1.3], [55, 1.06], [57, 1]] }),
  shiv: T({
    x: [[62.5, 820], [63, 720], [64, 650], [65, 641], [86, 640]],
    y: [[63, 285], [65, 290], [86, 290]],
    w: [[62.5, 340], [63, 345], [64, 333], [65, 317], [66, 300], [68, 281], [70, 271], [72, 264], [76, 256], [80, 252], [86, 249]],
  }),
  G: T({ x: [[87.4, 640], [88, 630], [89, 614], [90, 604], [91, 597], [92, 594], [93, 592], [94, 589], [95, 584], [96, 580], [97, 568]], y: [[87.4, 40], [88, 149], [89, 210], [90, 252], [91, 272], [92, 283], [93, 288], [96, 288]], rz: [[87.4, -14], [90, -6], [93, 0]] }),
  O: T({ x: [[88.4, 676], [89, 662], [90, 646], [91, 640], [92, 638], [93, 636], [94, 634], [95, 628], [96, 624], [97, 612]], y: [[87.6, -24], [88, 4], [89, 14], [90, 138], [91, 212], [92, 256], [93, 276], [94, 284], [95, 288], [96, 288]], rz: [[88.4, -14], [91, -6], [94, 0]] }),
  D: T({ x: [[90.4, 688], [91, 684], [92, 682], [93, 680], [94, 678], [95, 672], [96, 668], [97, 656]], y: [[90.4, -40], [91, 18], [92, 150], [93, 224], [94, 260], [95, 282], [96, 288]], rz: [[90.4, -14], [93, -6], [96, 0]] }),
  damn: T({
    s: [[97.6, 19], [98, 17], [99, 10.3], [99.6, 1.195]],
    x: [[97.6, 640], [98, 652], [99, 765], [99.6, 742]],
    y: [[98, 312], [99, 276], [99.6, 284]],
  }),
  gd: T({ cx: [[100, 668], [101, 656], [102, 657.5], [111, 647.5]], s: [[100, 1.17], [101, 1.12], [102, 1.2], [111, 1.235]], gap: [[100, 0], [101, 10], [102, 0]] }),
};

// ======================================================================
// FRAME
// ======================================================================
function setFrame(f) {
  // ---- scene 1 (f 1.6 – 47.4) ----
  const on1 = f >= 1.6 && f < 47.45;
  g1.style.display = on1 ? 'block' : 'none';
  if (on1) {
    const G = TR.g1;
    g1.style.transformOrigin = '640px 300px';
    g1.style.transform = `translate(${G.x(f)}px,${G.y(f)}px) rotate(${G.r(f)}deg) scale(${G.s(f)})`;
    const c = TR.cause; place(cause, { v: 1, x: c.x(f), y: c.y(f), s: c.s(f), ry: c.ry(f), rz: c.rz(f), persp: 700 });
    const s1 = TR.star1; place(star1, { v: f >= 1.8, x: s1.x(f), y: s1.y(f), s: s1.s(f), rz: s1.rz(f) });
    const t = TR.tag; place(tag, { v: f >= 2.8, x: t.x(f), y: t.y(f), s: t.s(f), rz: t.rz(f) });
    const RZ = -12, sn = Math.sin(-RZ * Math.PI / 180);
    for (const [el, tr, t0] of [[LW, TR.W, 15.5], [LH, TR.H, 17.5], [LO2, TR.WO, 19.5]]) {
      const isW = el === LW, w = tr.w(f) * (isW ? 1.12 : 1), h = TR.H.w(f) * 1.13 * (isW ? 1.08 : el === LO2 ? 0.96 : 1);
      const sy = h / el._inkH, sx = w / el._inkW;
      place(el, { v: f >= t0, x: tr.x(f) + (isW ? 8 : 0), y: tr.b(f) + TR.whoDy.v(f) - h / 2 - (w / 2) * sn, s: sy, sx: sx / sy, rz: RZ });
    }
    const il = TR.iL; place(iL, { v: f >= 29.5, x: il.x(f), y: il.y(f), rz: il.rz(f) });
    const b = TR.big; place(bigStar, { v: f >= 1.6, x: b.x(f), y: b.y(f), s: b.s(f), ry: b.ry(f), rz: b.rz(f), persp: 1400 });
    // invisible matte that trims the W on the left (tilts with the group)
    const a = Math.tan(10 * Math.PI / 180), cx = 266, cy = 380;
    const rx = TR.clipR.v(f);
    whoClip.style.clipPath = `polygon(${cx + a * cy}px 0px, ${rx + a * cy}px 0px, ${rx - a * (700 - cy)}px 700px, ${cx - a * (700 - cy)}px 700px)`;
  }
  // ---- scene 2 (WOIAM) ----
  const on2 = f >= 46.6 && f < 62.6;
  g2.style.display = on2 ? 'block' : 'none';
  if (on2) {
    const w = TR.woiam, x = w.x(f), y = w.y(f), rz = w.rz(f), s = w.s(f);
    place(woiam, { v: 1, x, y, rz, s });
    const rad = rz * Math.PI / 180, co = Math.cos(rad), si = Math.sin(rad);
    const at = (dx, dy) => [x + (dx * co - dy * si) * s, y + (dx * si + dy * co) * s];
    const [ax, ay] = at(-178, -108), [bx, by] = at(192, 106);
    place(starA, { v: 1, x: ax, y: ay, s: s * TR.starA.s(f), rz: rz + TR.starA.rz(f) });
    place(starB, { v: 1, x: bx, y: by, s: s * TR.starB.s(f), rz: rz + TR.starB.rz(f) });
  }
  // ---- scene 3 (SHIVERS) + scene 4 (GOD DAMN) ----
  const on3 = f >= 62.5 && f < 86.6;
  if (on3) { drawWave(f); place(shiv, { v: 1, x: TR.shiv.x(f), y: TR.shiv.y(f), s: TR.shiv.w(f) / 300 }); } else place(shiv, { v: 0 });
  const landed = f >= 99.6;
  for (const [el, tr, t0] of [[LG, TR.G, 87.4], [LO, TR.O, 87.6], [LD, TR.D, 90.4]])
    place(el, { v: f >= t0 && !landed, x: tr.x(f), y: tr.y(f), rz: tr.rz(f) });
  // the giant DAMN is held per frame in the reference (no motion blur), so sample it on whole frames
  if (f >= 97.6 && !landed) { const d = TR.damn, q = Math.min(99, Math.round(f)); place(damn, { v: 1, x: d.x(q), y: d.y(q), s: d.s(q) }); }
  if (landed) {
    const g = TR.gd, s = g.s(f), gap = g.gap(f);
    const wG = godW._inkW * s, wD = damn._inkW * s, sp = godSize * 0.035 * s, total = wG + sp + gap + wD;
    const left = g.cx(f) - total / 2;
    place(godW, { v: 1, x: left + wG / 2, y: 284, s });
    place(damn, { v: 1, x: left + wG + sp + gap + wD / 2, y: 284, s });
  } else place(godW, { v: 0 });
  if (f < 97.6) place(damn, { v: 0 });
}

drawFlat();
window.setFrame = setFrame;
if (!/render/.test(location.search)) { const t0 = performance.now(); const loop = () => { setFrame(1 + ((performance.now() - t0) / 1000 * 30) % 111); requestAnimationFrame(loop); }; loop(); }
