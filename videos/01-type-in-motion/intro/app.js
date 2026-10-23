'use strict';
// Editing-session intro in a dark CapCut-style editor: scrub, select, keyframe,
// press play, watch at normal speed, then the player slowly grows to full screen.

const FPS = 30, PLAY = 4.1, ZOOM = [5.6, 9.55];
const VR = { x: 535, y: 76, w: 832, h: 468 };          // player picture rect (app coords)
const $ = id => document.getElementById(id);
const app = $('app');
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const L = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const eIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eSine = t => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t));
const eOut = t => 1 - Math.pow(1 - t, 3);
const back = (t, s = 2) => { t -= 1; return t * t * ((s + 1) * t + s) + 1; };
const tc = s => { const f = Math.max(0, Math.round(s * FPS)); const p = n => String(n).padStart(2, '0'); return `00:${p(Math.floor(f / 1800))}:${p(Math.floor(f / 30) % 60)}:${p(f % 30)}`; };

// ---------------- timeline ----------------
const X0 = 170, PPS = 48;                                // timeline x for t (in #tl coords)
const tx = t => X0 + t * PPS;
const ruler = $('ruler'), tracks = $('tracks');
for (let s = 0; s <= 36; s++) {
  const d = document.createElement('div'); d.style.cssText = `position:absolute;left:${tx(s)}px;bottom:0;width:1px;height:${s % 5 ? 4 : 9}px;background:#55555c`; ruler.appendChild(d);
  if (s % 5 === 0) { const l = document.createElement('div'); l.className = 'mono'; l.style.cssText = `position:absolute;left:${tx(s) + 4}px;top:2px;font-size:10px;color:#77777e`; l.textContent = `00:${String(s).padStart(2, '0')}`; ruler.appendChild(l); }
}
const ROWS = [{ y: 70, h: 44 }, { y: 116, h: 44 }, { y: 162, h: 44 }, { y: 208, h: 44 }, { y: 256, h: 62, main: 1 }, { y: 322, h: 46, audio: 1 }];
ROWS.forEach((r, i) => {
  const d = document.createElement('div'); d.className = 'trk'; d.style.top = r.y + 'px'; d.style.height = r.h + 'px'; d.style.background = '#1b1b1e';
  const icons = r.audio ? '🔒 🔊' : '🔒 👁 🔊';
  d.innerHTML = `<div class="thd">${icons}${r.main ? '<span style="margin-left:8px;width:46px;height:40px;border-radius:3px;background:url(th/01.jpg) center/cover;color:#fff;font-size:10px;display:flex;align-items:flex-end;justify-content:center">封面</span>' : ''}</div>`;
  tracks.appendChild(d); r.el = d;
});
const SCENES = [['IT STARTS / ONE', 0, 2.6], ['FRAME', 2.5, 4.6], ['THEN / ANOTHER', 4.55, 6.5], ['AND AGAIN', 6.5, 9], ['FEEL THE BEAT', 9, 11], ['LEFT RIGHT UP DOWN', 11, 13.6],
  ['01→30 FRAMES', 13.55, 16], ['MOTION', 16, 18.5], ['BLUR', 18.5, 21], ['SPIN', 21, 23.6], ['DON’T STOP', 23.5, 26], ['MAKE IT MOVE', 26, 27.95], ['TYPE IN MOTION', 27.85, 30]];
function clip(row, a, b, label, head, body, dashes = []) {
  const c = document.createElement('div'); c.className = 'clip';
  c.style.cssText += `left:${tx(a)}px;width:${(b - a) * PPS - 2}px;top:${2}px;height:${ROWS[row].h - 4}px;background:${body}`;
  c.innerHTML = `<div class="h" style="background:${head}">${label}</div><div class="b"></div>`;
  dashes.forEach(k => { const d = document.createElement('div'); d.className = 'dash'; d.style.left = (k - a) * PPS - 3 + 'px'; c.querySelector('.b').appendChild(d); });
  ROWS[row].el.appendChild(c); return c;
}
let selClip = null;
SCENES.forEach(([n, a, b], i) => {
  const c = clip(i % 2, a, b, `T&nbsp; ${n}&nbsp;&nbsp;${tc(b - a)}`, '#2a8b91', '#0e4247', [a + 0.08, a + 0.4, (a + b) / 2, b - 0.3]);
  if (n === 'FRAME') selClip = c;
});
[[0.05, 2.4], [2.5, 4.4], [9.9, 11], [13.6, 15.4], [21.2, 23.5], [24.4, 26], [26, 27.9], [27.9, 30]].forEach(([a, b]) => clip(2, a, b, `★ 星星贴纸&nbsp;&nbsp;${tc(b - a)}`, '#b9772e', '#4a3015', [a + 0.1, b - 0.2]));
[[0, 30]].forEach(([a, b]) => clip(3, a, b, `✦ 动态模糊 · 快门180° · 16采样`, '#6d55c9', '#2c2457', []));
// main track: the composed video with a filmstrip
const main = clip(4, 0, 30, `type_in_motion.mp4&nbsp;&nbsp;00:00:30:00`, '#1d6fd1', '#123e78');
const strip = main.querySelector('.b'); strip.style.display = 'flex'; strip.style.overflow = 'hidden';
for (let i = 1; i <= 30; i++) { const im = document.createElement('div'); im.style.cssText = `flex:none;width:${PPS}px;height:100%;background:url(th/${String(i).padStart(2, '0')}.jpg) center/cover;border-right:1px solid #0b2a52`; strip.appendChild(im); }
// audio
const aud = clip(5, 0, 30, `♫ score.wav&nbsp;&nbsp;00:00:30:00`, '#1f7a55', '#123d2c');
const wc = document.createElement('canvas'); wc.width = 30 * PPS * 2; wc.height = 52; wc.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
aud.querySelector('.b').appendChild(wc);
{ const g = wc.getContext('2d'); g.fillStyle = '#5ee6a8'; const mid = wc.height / 2;
  for (let i = 0; i < wc.width; i++) { const v = window.WAVE[Math.floor(i / wc.width * window.WAVE.length)] || 0; g.fillRect(i, mid - v * mid * 0.9, 1, v * mid * 1.8); } }
// keyframe dot that gets added on the selected clip
const newKf = document.createElement('div'); newKf.style.cssText = 'position:absolute;top:50%;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;background:#22d3e0;transform:rotate(45deg);display:none';
selClip.querySelector('.b').appendChild(newKf);

// ---------------- measure cursor targets ----------------
const pos = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
$('props').style.display = 'block'; $('draft').style.display = 'none';
const KFROT = pos($('kfrot')), KNOB = pos($('ssclb'));
$('props').style.display = 'none'; $('draft').style.display = 'block';
const TL = $('tl').getBoundingClientRect();
const RY = TL.top + 44 + 11, rx = t => TL.left + tx(t);
const SEL = pos(selClip), PLAYB = pos($('playbtn'));

const WAY = [[0, 960, 980], [0.35, 960, 980], [1.0, rx(2.0), RY], [1.08, rx(2.0), RY], [1.55, rx(9.5), RY], [1.95, rx(4.0), RY], [2.05, rx(4.0), RY],
  [2.4, SEL.x + 10, SEL.y + 6], [2.55, SEL.x + 10, SEL.y + 6], [2.85, KFROT.x, KFROT.y], [3.05, KFROT.x, KFROT.y], [3.22, KNOB.x, KNOB.y], [3.3, KNOB.x, KNOB.y],
  [3.6, KNOB.x + 26, KNOB.y], [3.68, KNOB.x + 26, KNOB.y], [4.0, PLAYB.x + 2, PLAYB.y + 2], [4.25, PLAYB.x + 2, PLAYB.y + 2], [4.9, PLAYB.x + 180, PLAYB.y + 120]];
const CLICKS = [1.05, 2.45, 2.9, 3.28, 4.05], RELEASES = [2.02, 3.64], PRESS = [[1.05, 2.02], [3.28, 3.64]];
function cursorAt(t) {
  for (let i = 0; i < WAY.length - 1; i++) { const [t0, x0, y0] = WAY[i], [t1, x1, y1] = WAY[i + 1]; if (t <= t1) { const k = eIO(P(t, t0, t1)); return [L(x0, x1, k), L(y0, y1, k)]; } }
  const w = WAY[WAY.length - 1]; return [w[1], w[2]];
}
const xToT = x => clamp((x - TL.left - X0) / PPS, 0, 30);
function playheadAt(t) {
  if (t < 1.05) return 0;
  if (t < 2.05) return xToT(cursorAt(t)[0]);
  if (t < 4.05) return 4.0;
  if (t < PLAY) return 0;
  return t - PLAY;                                    // normal-speed playback
}
window.playheadAt = playheadAt;
window.cues = { clicks: CLICKS, releases: RELEASES, keys: [], dialog: null, done: null, drop: null, play: PLAY, zoom: ZOOM, scrub: [1.05, 2.05] };

// ---------------- per frame ----------------
const vimg = $('vimg'); let lastSrc = '';
async function setTime(t) {
  const ph = playheadAt(t);
  // camera: gentle push, then the player picture slowly grows to fill the screen
  const c = L(1, 1.02, eSine(P(t, 0, ZOOM[0])));
  const pre = { x: 960 + (VR.x - 960) * c, y: 540 + (VR.y - 540) * c, w: VR.w * c };
  const z = eIO(P(t, ZOOM[0], ZOOM[1]));
  const rx_ = L(pre.x, 0, z), ry_ = L(pre.y, 0, z), s = L(pre.w, 1920, z) / VR.w;
  app.style.transform = `translate(${rx_ - VR.x * s}px,${ry_ - VR.y * s}px) scale(${s})`;
  app.style.opacity = clamp(t / 0.4);
  // UI state
  $('tcur').textContent = tc(ph);
  $('ph').style.left = tx(ph) + 'px';
  const selected = t >= 2.45;
  selClip.style.outline = selected ? '2px solid #fff' : 'none'; selClip.style.outlineOffset = '-1px';
  $('props').style.display = selected ? 'block' : 'none'; $('draft').style.display = selected ? 'none' : 'block';
  $('kfrot').className = 'kfb' + (t >= 2.9 ? ' on' : '');
  newKf.style.display = t >= 2.9 ? 'block' : 'none'; newKf.style.left = (4.0 - 2.5) * PPS + 'px';
  newKf.style.transform = `rotate(45deg) scale(${t >= 2.9 ? back(P(t, 2.9, 3.1)) * 1.2 : 1})`;
  const sd = eOut(P(t, 3.3, 3.6)), sc = Math.round(100 + 12 * sd);
  $('vscl').textContent = sc + '%'; $('sscli').style.width = L(40, 46, sd) + '%'; $('ssclb').style.left = L(40, 46, sd) + '%';
  $('kfscl').className = 'kfb' + (t >= 3.6 ? ' on' : '');
  const playing = t >= PLAY;
  $('playico').setAttribute('d', playing ? 'M4 2h3v12H4zM9 2h3v12H9z' : 'M4 2l10 6-10 6z');
  $('playbtn').style.transform = t >= 4.05 && t < 4.15 ? 'scale(0.85)' : '';
  // cursor (outside the zooming app)
  const [cx, cy] = cursorAt(t), sx = rx_ - VR.x * s + cx * s, sy = ry_ - VR.y * s + cy * s;
  const down = CLICKS.some(k => t >= k && t < k + 0.08) || PRESS.some(([a, b]) => t >= a && t < b);
  $('cursor').style.transform = `translate(${sx}px,${sy}px) scale(${down ? 0.88 : 1})`;
  $('cursor').style.opacity = 1 - P(t, 4.6, 4.95);
  const ck = CLICKS.find(k => t >= k && t < k + 0.32);
  if (ck !== undefined) { const q = P(t, ck, ck + 0.32); Object.assign($('ripple').style, { display: 'block', left: sx + 'px', top: sy + 'px', transform: `scale(${L(0.3, 1.4, eOut(q))})`, opacity: 1 - q }); }
  else $('ripple').style.display = 'none';
  // the picture
  const n = Math.min(900, Math.max(1, Math.round(ph * FPS) + 1));
  const src = (t >= ZOOM[0] && n <= 160 ? 'fh/' : 'fs/') + String(n).padStart(4, '0') + '.jpg';
  if (src !== lastSrc) { vimg.src = src; lastSrc = src; await vimg.decode().catch(() => {}); }
  return true;
}
window.setTime = setTime;
window.ready = Promise.all([document.fonts.load('400 12px SC'), document.fonts.load('500 12px SC'), document.fonts.load('700 13px SC')]).then(() => document.fonts.ready);
if (!/render/.test(location.search)) { const t0 = performance.now(); const loop = async () => { await setTime(((performance.now() - t0) / 1000) % 11); requestAnimationFrame(loop); }; window.ready.then(loop); }
