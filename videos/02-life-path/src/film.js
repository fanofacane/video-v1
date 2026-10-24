'use strict';
// Text-only narration film: every character appears when it is spoken (timeline.js, from ASR),
// lines already read dim to grey and stay, building a wall of words per screen (video-1 style).
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const P = (t, a, b) => clamp((t - a) / (b - a));
const eOut = t => 1 - Math.pow(1 - t, 3);
const mix = (c1, c2, k) => 'rgb(' + c1.map((v, i) => Math.round(v + (c2[i] - v) * k)).join(',') + ')';
const WHITE = [243, 239, 230], GREY = [112, 108, 101], MAINGREY = [168, 163, 152], GOLD = [226, 182, 108], GOLDDIM = [140, 116, 76];
const stage = document.getElementById('stage');

const L = window.LINES.map(l => ({ ...l, role: l.role || 'side' }));
const scr = s => window.SCREENS.findIndex(x => x.id === s);
function screenSpan(s) { const i = scr(s); return [i ? window.SCREENS[i - 1].end : 0, window.SCREENS[i].end]; }

function build() {
  for (const l of L) {
    const d = document.createElement('div'); d.className = 'line';
    const w = l.role === 'main' ? 600 : l.role === 'finale' ? 900 : 400;
    Object.assign(d.style, { fontSize: l.size + 'px', fontWeight: w, letterSpacing: l.role === 'side' ? '0.08em' : '0.04em' });
    const hi = l.hl ? l.text.indexOf(l.hl) : -1;
    l.spans = [...l.text].map((c, i) => { const s = document.createElement('span'); s.textContent = c; s.hl = hi >= 0 && i >= hi && i < hi + l.hl.length; d.appendChild(s); return s; });
    stage.appendChild(d); l.el = d;
    // centre the finished line on (x, y); typing grows from its left edge
    d.style.left = l.x - d.offsetWidth / 2 + 'px'; d.style.top = l.y - d.offsetHeight / 2 + 'px';
    l.ends = l.spans.map(s => s.offsetLeft + s.offsetWidth);
    if (l.role !== 'side') { const c = document.createElement('div'); c.className = 'cur'; Object.assign(c.style, { height: l.size * 0.9 + 'px', top: l.size * 0.08 + 'px' }); d.appendChild(c); l.cur = c; }
  }
  // when each line hands over to the next one in its screen
  for (const l of L) {
    const nx = L.filter(m => m.s === l.s && m.t[0][0] > l.t[0][0]).map(m => m.t[0][0]);
    l.next = nx.length ? Math.min(...nx) : screenSpan(l.s)[1];
  }
}

function render(t) {
  const cur = window.SCREENS.find(s => t < s.end) || window.SCREENS[window.SCREENS.length - 1];
  const [s0, s1] = screenSpan(cur.id);
  stage.style.transform = `scale(${1 + 0.035 * P(t, s0, s1)})`;
  stage.style.opacity = 1 - P(t, s1 - 0.7, s1);
  const fin = L.find(l => l.s === cur.id && l.role === 'finale');
  const away = fin ? P(t, fin.t[0][0] - 0.7, fin.t[0][0] - 0.1) : 0;       // the finale clears the wall
  for (const l of L) {
    if (l.s !== cur.id) { l.el.style.display = 'none'; continue; }
    l.el.style.display = 'block';
    const dim = l.role === 'finale' ? 0 : P(t, l.next, l.next + 0.6);
    const base = mix(WHITE, l.role === 'main' ? MAINGREY : GREY, dim), gold = mix(GOLD, GOLDDIM, dim);
    l.el.style.opacity = l.role === 'finale' ? 1 : 1 - away;
    let shown = -1;
    l.spans.forEach((s, i) => {
      const p = P(t, l.t[i][0] - 0.03, l.t[i][0] + 0.22), e = eOut(p);
      if (p > 0) shown = i;
      s.style.opacity = e; s.style.transform = `translateY(${(1 - e) * 14}px)`; s.style.filter = p < 1 ? `blur(${(1 - e) * 6}px)` : 'none';
      s.style.color = s.hl ? mix(base.match(/\d+/g).map(Number), gold.match(/\d+/g).map(Number), P(t, l.t[i][0], l.t[i][0] + 0.4)) : base;
    });
    if (l.cur) {
      const active = t >= l.t[0][0] - 0.4 && t < l.next + 0.2;
      l.cur.style.display = active && Math.floor(t * 2.2) % 2 === 0 ? 'block' : 'none';
      l.cur.style.left = (shown >= 0 ? l.ends[shown] : 0) + 6 + 'px';
    }
  }
}
window.setTime = t => render(t);
window.ready = (async () => {
  await Promise.all(['400', '600', '900'].map(w => document.fonts.load(`${w} 40px NotoSerifSC`, window.LINES.map(l => l.text).join(''))));
  build(); render(0); return true;
})();
