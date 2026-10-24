'use strict';
// One line at a time. Each character pops in with a wave when it is spoken (timeline.js, from ASR).
// Most lines just do that; a few key lines act out their meaning (fx): fog, lost, petal, bloom, walk.
// The background tint follows the mood (window.TINT keyframes).
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const P = (t, a, b) => clamp((t - a) / (b - a));
const eIn = t => t * t, eOut = t => 1 - Math.pow(1 - t, 3), eIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const hash = n => { let h = Math.imul(n | 0, 2654435761) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const lerpC = (a, b, k) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',') + ')';
const LIGHT = window.BG && window.BG.light;
const WHITE = LIGHT ? '#1E1B18' : '#F3EFE6', GOLD = LIGHT ? '#B23A2E' : '#E2B66C', GREY = LIGHT ? '#9A9080' : '#8A867E';
const stage = document.getElementById('stage'), bg = document.getElementById('bg');
const fx = document.getElementById('fx'), g = fx.getContext('2d');
const L = window.LINES;

function build() {
  L.forEach((l, n) => {
    const size = l.size || (l.emph ? 128 : 96);
    const d = document.createElement('div'); d.className = 'line';
    Object.assign(d.style, { fontSize: size + 'px', fontWeight: l.emph || size >= 150 ? 900 : 600, letterSpacing: '0.06em', color: l.emph ? GOLD : WHITE });
    const hi = l.hl ? l.text.indexOf(l.hl) : -1, wk = l.walk ? l.text.indexOf(l.walk) : -1;
    l.spans = [...l.text].map((c, i) => {
      const s = document.createElement('span'); s.textContent = c;
      if (hi >= 0 && i >= hi && i < hi + l.hl.length) { s.style.color = l.hlc === 'grey' ? GREY : GOLD; s.hl = true; }
      s.walk = wk >= 0 && i >= wk;
      d.appendChild(s); return s;
    });
    stage.appendChild(d); l.el = d;
    const x = l.x ?? 960, y = l.y ?? 540, w = d.offsetWidth;
    d.style.left = (l.align === 'left' ? x : l.align === 'right' ? x - w : x - w / 2) + 'px';
    d.style.top = y - d.offsetHeight / 2 + 'px';
    l.cx = l.spans.map(s => d.offsetLeft + s.offsetLeft + s.offsetWidth / 2); l.cy = y; l.size = size;
    const st = l.t.map(x => x[0]);
    l.start = st[0]; l.last = Math.max(...st);
    const next = n + 1 < L.length ? L[n + 1].t[0][0] : window.END;
    l.exit = n + 1 < L.length ? Math.max(next - 0.28, l.last + 0.15) : window.END - 0.9;
    if (l.fx === 'petal') l.exit = l.last + 0.12;            // the petals fall instead of floating away
    if (l.fx === 'walk') l.exit = l.last + 0.55;            // the walkers step out to the right
    l.gone = l.fx === 'petal' ? l.exit + 1.4 : l.fx === 'walk' ? l.exit + 1.6 : l.exit + 0.3 + l.spans.length * 0.012;
  });
}

// ---------- per-character motion ----------
function charState(l, i, t) {
  const u = t - l.t[i][0];
  if (u < 0) return null;
  let x = 0, y = 38 * Math.exp(-u * 8) * Math.cos(u * 15), sc = 1 - 0.45 * Math.exp(-u * 11), rot = 0, op = P(u, 0, 0.12), blur = (1 - P(u, 0, 0.16)) * 6, glow = 0;
  for (let j = i + 1; j < l.spans.length; j++) {           // ripple sent back by later characters
    const v = t - l.t[j][0] - (j - i) * 0.035; if (v <= 0) continue;
    y -= 9 * Math.exp(-v * 7) * Math.sin(v * 17) * Math.exp(-(j - i) * 0.3);
  }
  y += 3 * P(t, l.last + 0.3, l.last + 1.2) * Math.sin(t * 2.6 - i * 0.55);   // the finished line breathes
  if (l.fx === 'fog') blur += 12 * (1 - eOut(P(u, 0, 1.6)));                   // emerges slowly out of the fog
  if (l.fx === 'lost') {                                                        // never quite in focus, drifting
    blur += 2.5 + 2.5 * Math.sin(t * 2.1 + i * 1.7);
    x += 10 * Math.sin(t * 1.3 + i * 2.1); y += 8 * Math.cos(t * 1.1 + i * 1.3); rot += 3 * Math.sin(t * 0.9 + i);
  }
  if (l.fx === 'bloom') {                                                       // opens like a flower
    const b = P(u, 0, 0.7); sc = 1 - Math.exp(-u * 7) * Math.cos(u * 9) * 0.9; rot += -30 * Math.exp(-u * 6);
    if (l.spans[i].hl) glow = Math.exp(-u * 1.6);
    void b;
  }
  if (l.fx === 'petal') {                                                       // falls like petals, in a scattered order
    const f0 = l.exit + hash(i * 7 + 3) * 0.25, p = P(t, f0, f0 + 1.1), side = (l.cx[i] - 960) / 960;
    if (p > 0) { y += 380 * eIn(p); x += (220 * side + 50 * Math.sin(p * 5 + i * 2)) * p; rot += (hash(i + 11) - 0.5) * 160 * p; op *= 1 - P(p, 0.2, 0.75); }
  } else if (l.fx === 'walk' && l.spans[i].walk) {                              // step, step, step… off to the right
    const w0 = l.exit + (l.text.length - 1 - i) * 0.07, v = Math.max(0, t - w0), step = 0.15, k = Math.floor(v / step), ph = (v % step) / step;
    if (v > 0) { x += (k + eIO(ph)) * 95; y -= 22 * Math.sin(Math.PI * ph); rot += 6 * Math.sin(Math.PI * ph); }
  } else if (l.fx === 'walk') {
    op *= 1 - P(t, l.exit + 0.3, l.exit + 0.8);
  } else {                                                                      // default exit: float up and fade
    const e = P(t, l.exit + i * 0.012, l.exit + i * 0.012 + 0.3);
    y -= 30 * eIn(e); op *= 1 - e; blur += e * 5;
  }
  return { x, y, sc, rot, op, blur, glow };
}

// ---------- background layers ----------
const FOG = [[10.0, 11.2], [14.0, 15.8]];       // fog rolls in with 站在雾里, clears with 所以不必回头看
function drawFx(t) {
  g.clearRect(0, 0, 1920, 1080);
  const fog = P(t, FOG[0][0], FOG[0][1]) * (1 - P(t, FOG[1][0], FOG[1][1]));
  if (fog > 0) {
    for (let k = 0; k < 14; k++) {
      const r = 260 + hash(k) * 420, sp = 18 + hash(k + 40) * 40;
      const x = ((hash(k + 7) * 2600 + t * sp) % 2600) - 340, y = 180 + hash(k + 21) * 720 + 40 * Math.sin(t * 0.3 + k);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(200,210,220,${0.1 * fog})`); gr.addColorStop(1, 'rgba(200,210,220,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  }
  // drifting petals while 蔷薇今年谢了 falls
  const pl = L.find(l => l.fx === 'petal');
  if (pl && t > pl.exit - 0.4 && t < pl.gone + 0.5) {
    for (let k = 0; k < 16; k++) {
      const t0 = pl.exit - 0.4 + hash(k + 90) * 1.2, p = (t - t0) / 2.2; if (p < 0 || p > 1) continue;
      const x = 300 + hash(k + 3) * 1320 + 90 * Math.sin(p * 6 + k), y = -40 + p * 1160, a = 0.55 * (1 - P(p, 0.7, 1));
      g.save(); g.translate(x, y); g.rotate(p * 6 + k); g.scale(1, 0.55 + 0.4 * Math.sin(p * 9 + k));
      g.fillStyle = `rgba(226,182,108,${a})`; g.beginPath(); g.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }
  // a soft ring opening behind each blooming keyword
  const bl = L.find(l => l.fx === 'bloom');
  if (bl) bl.spans.forEach((s, i) => {
    if (!s.hl) return; const u = t - bl.t[i][0]; if (u < 0 || u > 1.6) return;
    const r = 30 + 260 * eOut(P(u, 0, 1.6)), a = 0.35 * (1 - P(u, 0, 1.6));
    g.strokeStyle = `rgba(226,182,108,${a})`; g.lineWidth = 2; g.beginPath(); g.arc(bl.cx[i], bl.cy, r, 0, Math.PI * 2); g.stroke();
  });
}
function tint(t) {
  const K = window.TINT; let c = K[0][1];
  for (let i = 0; i + 1 < K.length; i++) if (t >= K[i][0]) c = t < K[i + 1][0] ? lerpC(hex(K[i][1]), hex(K[i + 1][1]), (t - K[i][0]) / (K[i + 1][0] - K[i][0])) : K[i + 1][1];
  if (c[0] === '#') c = lerpC(hex(c), hex(c), 0);
  bg.style.background = `radial-gradient(ellipse 70% 65% at 50% 48%, ${c} 0%, #070707 62%, #020202 100%)`;
  if (window.BG.mode !== 'none') window.BG.draw(t, c);
}

function render(t) {
  tint(t);
  for (const l of L) {
    if (t < l.start - 0.05 || t > l.gone) { l.el.style.display = 'none'; continue; }
    l.el.style.display = 'block';
    l.el.style.transform = `scale(${1 + 0.025 * P(t, l.start, l.gone)})`;
    l.spans.forEach((s, i) => {
      const c = charState(l, i, t);
      if (!c) { s.style.opacity = 0; return; }
      s.style.opacity = c.op;
      s.style.transform = `translate(${c.x}px,${c.y}px) rotate(${c.rot}deg) scale(${c.sc})`;
      s.style.filter = c.blur > 0.05 ? `blur(${c.blur}px)` : 'none';
      s.style.textShadow = c.glow > 0.01 ? `0 0 ${40 * c.glow}px rgba(226,182,108,${0.9 * c.glow})` : 'none';
    });
  }
  drawFx(t);
}
window.setTime = t => render(t);
window.ready = (async () => {
  await Promise.all(['600', '900'].map(w => document.fonts.load(`${w} 40px NotoSerifSC`, L.map(l => l.text).join(''))));
  window.BG.init(); build(); render(0); return true;
})();
