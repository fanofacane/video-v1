'use strict';
// "Making of" intro: a fictional editor (KEYFRAME) builds the film, renders it,
// then the program monitor zooms to full screen and hands off to the real video.

const FPS = 30, PLAY_AT = 7.7, ZOOM = [7.75, 8.55];
const $ = id => document.getElementById(id);
const app = $('app'), view = $('view');
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const L = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const eIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eOut = t => 1 - Math.pow(1 - t, 3);
const back = (t, s = 1.8) => { t -= 1; return t * t * ((s + 1) * t + s) + 1; };
const tc = s => { const f = Math.max(0, Math.round(s * FPS)); const p = n => String(n).padStart(2, '0'); return `00:${p(Math.floor(f / 1800))}:${p(Math.floor(f / 30) % 60)}:${p(f % 30)}`; };

// ---------------- build the UI ----------------
const COLORS = ['#7b61ff', '#e9c46a', '#2ec4b6', '#ff6b6b', '#4cc9f0', '#f78fb3', '#90be6d', '#f4a261'];
const LAYERS = [
  ['TYPE IN / MOTION', 27.85, 30], ['MAKE IT · MOVE', 26.0, 27.95], ['DON’T STOP', 23.5, 26.0], ['SPIN', 21.0, 23.6],
  ['BLUR · THE LINES', 18.5, 21.0], ['MOTION · marquee', 16.0, 18.5], ['01 → 30 FRAMES', 13.55, 16.0], ['LEFT RIGHT UP DOWN', 11.0, 13.6],
  ['FEEL THE BEAT', 9.0, 11.0], ['AND AGAIN', 6.5, 9.0], ['THEN / ANOTHER', 4.55, 6.5], ['FRAME', 2.5, 4.6], ['IT STARTS / ONE', 0, 2.6],
  ['★ stars', 0, 30], ['BG · gradient', 0, 30],
];
const SEL = 11; // FRAME is the selected layer
const ROW0 = 58, RH = 24, TX0 = 426, TW = 1460;
const tx = t => TX0 + t / 30 * TW;
const rows = $('rows'), ruler = $('ruler');
for (let s = 0; s <= 30; s++) {
  const x = tx(s) - 420, d = document.createElement('div'); d.className = 'tick';
  d.style.left = x + 'px'; d.style.height = s % 5 ? '6px' : '28px'; d.style.top = s % 5 ? '22px' : '0'; ruler.appendChild(d);
  if (s % 5 === 0) { const l = document.createElement('div'); l.className = 'tlab'; l.style.left = x + 5 + 'px'; l.textContent = `00:00:${String(s).padStart(2, '0')}:00`; ruler.appendChild(l); }
}
const kfEls = [];
LAYERS.forEach(([name, a, b], i) => {
  const y = ROW0 + i * RH, col = COLORS[i % COLORS.length];
  const lr = document.createElement('div'); lr.className = 'lrow'; lr.style.top = y + 'px';
  lr.innerHTML = `<span style="color:var(--dim)">👁</span><span class="ico" style="background:${col}"></span><span class="mono" style="color:var(--dim);width:22px">${i + 1}</span><span>${name}</span><span style="margin-left:auto;color:var(--dim)">${i < 13 ? 'T' : i === 13 ? '★' : '▭'}</span>`;
  if (i === SEL) { lr.style.background = 'var(--sel)'; lr.style.color = '#fff'; }
  rows.appendChild(lr);
  const tr = document.createElement('div'); tr.className = 'trow'; tr.style.top = y + 'px'; if (i === SEL) tr.style.background = 'rgba(42,59,102,.35)';
  const c = document.createElement('div'); c.className = 'clip'; c.style.left = tx(a) - 420 + 'px'; c.style.width = tx(b) - tx(a) - 2 + 'px'; c.style.background = col;
  c.textContent = i < 13 ? name : ''; tr.appendChild(c);
  const ks = i === SEL ? [a + 0.05, a + 0.55, b - 0.25] : [];
  ks.forEach(k => { if (k < a || k > b) return; const d = document.createElement('div'); d.className = 'kf'; d.style.left = tx(k) - 420 - 4 + 'px'; tr.appendChild(d); });
  rows.appendChild(tr);
});
// audio track (score drops in later)
const AY = ROW0 + LAYERS.length * RH;
const alr = document.createElement('div'); alr.className = 'lrow'; alr.style.top = AY + 'px'; alr.style.height = '34px';
alr.innerHTML = `<span style="color:var(--dim)">🔊</span><span class="ico" style="background:#2ec48a"></span><span class="mono" style="color:var(--dim);width:22px">A1</span><span id="aname" style="color:var(--dim)">—</span>`;
rows.appendChild(alr);
const atr = document.createElement('div'); atr.className = 'trow'; atr.style.top = AY + 'px'; atr.style.height = '34px'; rows.appendChild(atr);
const aclip = document.createElement('canvas'); aclip.width = TW * 2; aclip.height = 68;
aclip.style.cssText = `position:absolute;left:${TX0 - 420}px;top:3px;height:28px;width:${TW}px;border-radius:4px`;
atr.appendChild(aclip);
// the new keyframe that gets added on FRAME
const newKf = document.createElement('div'); newKf.className = 'kf'; newKf.style.background = '#5b8cff';
rows.children[SEL * 2 + 1].appendChild(newKf);

// project bin
const BIN = [['type_in_motion', 'comp', '2 scenes · 30s'], ['Scenes', 'folder', '13 items'], ['Montserrat Black.ttf', 'font', 'OTF'], ['Montserrat ExtraBold.ttf', 'font', 'OTF'],
  ['star.svg', 'svg', 'vector'], ['score.wav', 'audio', '48k · 30s'], ['blue_gradient', 'solid', '1920×1080'], ['tag_black', 'shape', 'shape'], ['renders', 'folder', '—']];
const bin = $('bin');
BIN.forEach(([n, k, m], i) => {
  const r = document.createElement('div'); r.className = 'row'; r.id = 'bin' + i;
  const th = k === 'comp' ? `<span class="thumb" style="background-image:url(fs/0091.jpg)"></span>` :
    `<span class="thumb" style="background:${{ folder: '#3a3d46', font: '#2b2d35', svg: '#efff0c', audio: '#1f7a55', solid: '#3400f3', shape: '#0b0820' }[k]};display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff">${{ folder: '▤', font: 'Aa', svg: '★', audio: '∿', solid: '', shape: '▬' }[k]}</span>`;
  r.innerHTML = `${th}<span style="flex:1">${n}</span><span style="color:var(--dim);font-size:11px">${m}</span>`;
  bin.appendChild(r);
});
// effect controls
const fx = $('fx');
fx.insertAdjacentHTML('beforeend', `
  <div class="row" style="color:#fff;font-weight:600"><span class="ico" style="background:${COLORS[SEL % 8]}"></span>FRAME <span style="color:var(--dim);font-weight:500">· Text Layer</span></div>
  <div class="sec">▾ Transform</div>
  <div class="prop"><span class="sw"></span><span class="nm">Anchor Point</span><span class="val mono">0.0, 0.0</span></div>
  <div class="prop"><span class="sw on"></span><span class="nm">Position</span><span class="val mono" id="vpos">960.0, 510.0</span></div>
  <div class="prop"><span class="sw on"></span><span class="nm">Scale</span><span class="val mono" id="vscl">100.0, 100.0%</span></div>
  <div class="prop" id="prot"><span class="sw" id="swrot"></span><span class="nm">Rotation</span><span class="val mono" id="vrot">0x +0.0°</span></div>
  <div class="prop"><span class="sw"></span><span class="nm">Opacity</span><span class="val mono">100%</span></div>
  <div class="sec">▾ Text</div>
  <div class="prop"><span class="sw"></span><span class="nm">Source Text</span><span class="val">FRAME</span></div>
  <div class="prop"><span class="sw"></span><span class="nm">Font</span><span class="val">Montserrat Black</span></div>
  <div class="prop"><span class="sw"></span><span class="nm">Size · Tracking</span><span class="val mono">128 px · −30</span></div>
  <div class="sec">▾ Motion Blur</div>
  <div class="prop"><span class="sw"></span><span class="nm">Shutter</span><span class="val mono">180°</span></div>
  <div class="prop"><span class="sw"></span><span class="nm">Samples</span><span class="val mono">16</span></div>
  <div class="sec">▾ Preset · Spin In</div>
  <div class="prop"><span class="sw"></span><span class="nm">Duration · Ease</span><span class="val mono">0.55s · Expo Out</span></div>`);

// positions of things the cursor touches (app coordinates, measured before any transform)
const pos = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const RULER_Y = $('ruler').getBoundingClientRect().top + 14;
const SW = pos($('swrot')), VROT = pos($('vrot')), SCORE = pos($('bin5')), PLAY = pos($('playbtn'));
const atrR = atr.getBoundingClientRect(), A_DROP = { x: tx(0) + 130 + $('tl').getBoundingClientRect().left - 8 + 8, y: atrR.top + 17 };
const tlLeft = $('tl').getBoundingClientRect().left;
const rx = t => tlLeft + 1 + tx(t); // ruler x in app coords for a timeline time

// ---------------- choreography ----------------
const WAY = [ // [time, x, y] — cursor eases between consecutive points
  [0.0, 980, 930], [0.35, 980, 930], [1.0, rx(2.2), RULER_Y], [1.15, rx(2.2), RULER_Y],
  [1.85, rx(12.0), RULER_Y], [2.35, rx(3.4), RULER_Y], [2.45, rx(3.4), RULER_Y],
  [2.85, SW.x, SW.y], [3.15, SW.x, SW.y], [3.3, VROT.x - 20, VROT.y], [3.4, VROT.x - 20, VROT.y], [3.95, VROT.x + 70, VROT.y], [4.05, VROT.x + 70, VROT.y],
  [4.55, SCORE.x - 40, SCORE.y], [4.65, SCORE.x - 40, SCORE.y], [5.25, A_DROP.x, A_DROP.y], [5.35, A_DROP.x, A_DROP.y],
  [5.9, 1240, 760], [7.2, 1240, 760], [7.6, PLAY.x + 3, PLAY.y + 3], [7.9, PLAY.x + 3, PLAY.y + 3],
];
const CLICKS = [1.1, 2.9, 3.4, 4.6, 7.65];       // mouse downs (sound + ripple)
const RELEASES = [2.4, 3.97, 5.27];
const KEYS = [5.72, 5.8];                         // ⌘ M
function cursorAt(t) {
  for (let i = 0; i < WAY.length - 1; i++) {
    const [t0, x0, y0] = WAY[i], [t1, x1, y1] = WAY[i + 1];
    if (t <= t1) { const k = eIO(P(t, t0, t1)); return [L(x0, x1, k), L(y0, y1, k)]; }
  }
  const w = WAY[WAY.length - 1]; return [w[1], w[2]];
}
const xToT = x => clamp((x - tlLeft - 1 - TX0) / TW * 30, 0, 30);
function playheadAt(t) {
  if (t < 1.1) return 0;
  if (t < 2.4) return xToT(cursorAt(t)[0]);        // scrubbing with the mouse
  if (t < 6.05) return 3.4;
  if (t < 7.15) return 30 * P(t, 6.05, 7.15);       // render preview races through
  if (t < 7.65) return 30;
  if (t < PLAY_AT) return 0;
  return t - PLAY_AT;                                // real-time playback
}
window.playheadAt = playheadAt;
window.cues = { clicks: CLICKS, releases: RELEASES, keys: KEYS, dialog: 5.95, done: 7.15, drop: 5.27, play: PLAY_AT, zoom: ZOOM };

// waveform
const wave = window.WAVE;
document.fonts.ready.then(drawWave);
function drawWave() {
  const g = aclip.getContext('2d'); g.fillStyle = '#1f7a55'; g.fillRect(0, 0, aclip.width, aclip.height);
  g.fillStyle = '#5ee6a8'; const mid = aclip.height / 2;
  for (let i = 0; i < aclip.width; i++) { const v = wave[Math.floor(i / aclip.width * wave.length)] || 0; g.fillRect(i, mid - v * mid * 0.92, 1, v * mid * 1.84); }
  g.fillStyle = '#0c0d10'; g.font = '700 21px Inter'; g.fillText('score.wav', 14, 26);
}

// ---------------- per-frame ----------------
const monimg = $('monimg');
let lastSrc = '';
async function setTime(t) {
  const ph = playheadAt(t);
  // camera: slow push, then the monitor flies to full screen
  const c = L(1.0, 1.035, eIO(P(t, 0, ZOOM[0])));
  const pre = { x: 960 - (960 - 1010) * c, y: 540 - (540 - 70) * c, w: 880 * c };
  pre.x = 960 + (1010 - 960) * c; pre.y = 540 + (70 - 540) * c;
  const z = eIO(P(t, ZOOM[0], ZOOM[1]));
  const rxx = L(pre.x, 0, z), ryy = L(pre.y, 0, z), rw = L(pre.w, 1920, z), s = rw / 880;
  app.style.transform = `translate(${rxx - 1010 * s}px,${ryy - 70 * s}px) scale(${s})`;
  view.style.background = '#000';
  app.style.opacity = clamp(t / 0.45);
  $('monov').style.opacity = 1 - z;
  // timecodes + playhead
  $('montc').textContent = tc(ph); $('tltc').textContent = tc(ph);
  $('ph').style.left = tx(ph) - 1 + 'px';
  // effect values follow the playhead
  $('vpos').textContent = `${(960 + Math.sin(ph * 1.7) * 42).toFixed(1)}, ${(510 - Math.cos(ph * 1.3) * 28).toFixed(1)}`;
  $('vscl').textContent = `${(100 + Math.sin(ph * 2.1) * 6).toFixed(1)}, ${(100 + Math.sin(ph * 2.1) * 6).toFixed(1)}%`;
  const rot = t < 3.4 ? 0 : 18 * eOut(P(t, 3.42, 3.95));
  $('vrot').textContent = `0x +${rot.toFixed(1)}°`;
  $('swrot').className = 'sw' + (t >= 2.9 ? ' on' : '');
  $('prot').style.background = t >= 3.4 && t < 4.1 ? 'rgba(91,140,255,.12)' : '';
  newKf.style.display = t >= 2.9 ? 'block' : 'none';
  newKf.style.left = tx(3.4) - 420 - 4 + 'px';
  newKf.style.transform = `rotate(45deg) scale(${t >= 2.9 ? back(P(t, 2.9, 3.1), 3) * 1.25 : 1})`;
  // score clip drops in
  const ag = eOut(P(t, 5.27, 5.6));
  aclip.style.display = t >= 5.27 ? 'block' : 'none'; aclip.style.clipPath = `inset(0 ${(1 - ag) * 100}% 0 0)`;
  $('aname').textContent = t >= 5.27 ? 'score.wav' : '—'; $('aname').style.color = t >= 5.27 ? 'var(--txt)' : 'var(--dim)';
  $('bin5').style.background = t >= 4.6 && t < 5.3 ? 'var(--sel)' : '';
  // drag chip
  const dragging = t >= 4.65 && t < 5.27, [cx, cy] = cursorAt(t);
  $('drag').style.display = dragging ? 'block' : 'none';
  $('drag').style.transform = `translate(${cx + 14}px,${cy + 10}px)`;
  // toast + render dialog
  const ta = P(t, 5.7, 5.8) * (1 - P(t, 6.25, 6.4));
  $('toast').style.opacity = ta; $('toast').style.transform = `translateY(${(1 - ta) * 12}px)`;
  const da = t < 7.35 ? back(P(t, 5.95, 6.15), 1.4) : 1 - eOut(P(t, 7.35, 7.5));
  $('dlg').style.display = t >= 5.95 && t < 7.5 ? 'block' : 'none';
  $('dlg').style.opacity = clamp(da); $('dlg').style.transform = `scale(${L(0.92, 1, clamp(da))})`;
  const rp = P(t, 6.05, 7.15), fr = Math.round(rp * 900);
  $('bari').style.width = rp * 100 + '%'; $('bari').style.background = rp >= 1 ? '#2ec48a' : '';
  $('rpct').textContent = Math.round(rp * 100) + '%'; $('rfr').textContent = `Frame ${fr} / 900`;
  $('rstat').textContent = rp >= 1 ? 'Render complete ✓' : 'Rendering…';
  $('playbtn').style.transform = t >= 7.65 && t < 7.8 ? 'scale(0.85)' : '';
  // cursor + click ripple (cursor lives outside the zooming app, so map through the camera)
  const sx = rxx - 1010 * s + cx * s, sy = ryy - 70 * s + cy * s;
  const down = CLICKS.some(c => t >= c && t < c + 0.09) || (t >= 1.1 && t < 2.4) || (t >= 3.4 && t < 3.97) || (t >= 4.6 && t < 5.27);
  $('cursor').style.transform = `translate(${sx}px,${sy}px) scale(${down ? 0.88 : 1})`;
  $('cursor').style.opacity = 1 - P(t, ZOOM[0], ZOOM[0] + 0.2);
  const ck = CLICKS.find(c => t >= c && t < c + 0.35);
  if (ck !== undefined) { const q = P(t, ck, ck + 0.35); $('ripple').style.display = 'block'; $('ripple').style.left = sx + 'px'; $('ripple').style.top = sy + 'px'; $('ripple').style.transform = `scale(${L(0.3, 1.4, eOut(q))})`; $('ripple').style.opacity = 1 - q; }
  else $('ripple').style.display = 'none';
  // monitor picture: full-res frames once the zoom starts
  const n = Math.min(900, Math.max(1, Math.round(ph * FPS) + 1));
  const src = t >= ZOOM[0] ? `fh/${String(n).padStart(4, '0')}.jpg` : `fs/${String(n).padStart(4, '0')}.jpg`;
  if (src !== lastSrc) { monimg.src = src; lastSrc = src; await monimg.decode().catch(() => {}); }
  return true;
}
window.setTime = setTime;
window.ready = Promise.all([document.fonts.ready, new Promise(r => { const i = setInterval(() => { if (wave) { clearInterval(i); r(); } }, 20); })]);
if (!/render/.test(location.search)) { const t0 = performance.now(); const loop = async () => { await setTime(((performance.now() - t0) / 1000) % 9); requestAnimationFrame(loop); }; window.ready.then(loop); }
