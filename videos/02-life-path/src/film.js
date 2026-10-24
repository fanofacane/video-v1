'use strict';
// One line at a time, centred. Each character pops in with a wave when it is spoken (timeline.js, from ASR):
// it rises with a springy overshoot, sends a small ripple back through the characters already shown,
// the finished line breathes in a gentle wave, then floats up and away just before the next line.
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const P = (t, a, b) => clamp((t - a) / (b - a));
const eIn = t => t * t;
const WHITE = '#F3EFE6', GOLD = '#E2B66C';
const stage = document.getElementById('stage');
const L = window.LINES;

function build() {
  L.forEach((l, n) => {
    const d = document.createElement('div'); d.className = 'line';
    Object.assign(d.style, { fontSize: (l.emph ? 128 : 96) + 'px', fontWeight: l.emph ? 900 : 600, letterSpacing: '0.06em', color: l.emph ? GOLD : WHITE });
    const hi = l.hl ? l.text.indexOf(l.hl) : -1;
    l.spans = [...l.text].map((c, i) => {
      const s = document.createElement('span'); s.textContent = c;
      if (hi >= 0 && i >= hi && i < hi + l.hl.length) s.style.color = GOLD;
      d.appendChild(s); return s;
    });
    stage.appendChild(d); l.el = d;
    d.style.left = 960 - d.offsetWidth / 2 + 'px'; d.style.top = 540 - d.offsetHeight / 2 + 'px';
    l.ends = l.spans.map(s => s.offsetLeft + s.offsetWidth);
    const c = document.createElement('div'); c.className = 'cur';
    Object.assign(c.style, { height: (l.emph ? 128 : 96) * 0.86 + 'px', top: (l.emph ? 128 : 96) * 0.1 + 'px' }); d.appendChild(c); l.cur = c;
    const st = l.t.map(x => x[0]);
    l.start = st[0]; l.last = Math.max(...st);
    const next = n + 1 < L.length ? L[n + 1].t[0][0] : window.END;
    l.exit = n + 1 < L.length ? Math.max(next - 0.28, l.last + 0.15) : window.END - 0.9;   // when the line starts leaving
    l.gone = l.exit + 0.3 + l.spans.length * 0.012;
  });
}

function render(t) {
  for (const l of L) {
    if (t < l.start - 0.05 || t > l.gone) { l.el.style.display = 'none'; continue; }
    l.el.style.display = 'block';
    l.el.style.transform = `scale(${1 + 0.025 * P(t, l.start, l.gone)})`;
    const settled = P(t, l.last + 0.3, l.last + 1.2);
    let shown = -1;
    l.spans.forEach((s, i) => {
      const u = t - l.t[i][0];
      if (u < 0) { s.style.opacity = 0; return; }
      shown = i;
      // pop-in: springy rise from below + scale
      let y = 38 * Math.exp(-u * 8) * Math.cos(u * 15), sc = 1 - 0.45 * Math.exp(-u * 11);
      // ripple sent back by every later character as it lands
      for (let j = i + 1; j < l.spans.length; j++) {
        const v = t - l.t[j][0] - (j - i) * 0.035; if (v <= 0) continue;
        y -= 9 * Math.exp(-v * 7) * Math.sin(v * 17) * Math.exp(-(j - i) * 0.3);
      }
      // the finished line breathes in a soft travelling wave
      y += 3 * settled * Math.sin(t * 2.6 - i * 0.55);
      // leave: float up and fade, character by character
      const e = P(t, l.exit + i * 0.012, l.exit + i * 0.012 + 0.3);
      y -= 30 * eIn(e);
      const op = P(u, 0, 0.12) * (1 - e), blur = (1 - P(u, 0, 0.16)) * 6 + e * 5;
      s.style.opacity = op;
      s.style.transform = `translateY(${y}px) scale(${sc})`;
      s.style.filter = blur > 0.05 ? `blur(${blur}px)` : 'none';
    });
    const typing = t < l.last + 0.5 && t < l.exit;
    l.cur.style.display = typing && shown >= 0 && Math.floor(t * 2.4) % 2 === 0 ? 'block' : 'none';
    l.cur.style.left = (shown >= 0 ? l.ends[shown] : 0) + 8 + 'px';
  }
}
window.setTime = t => render(t);
window.ready = (async () => {
  await Promise.all(['600', '900'].map(w => document.fonts.load(`${w} 40px NotoSerifSC`, L.map(l => l.text).join(''))));
  build(); render(0); return true;
})();
