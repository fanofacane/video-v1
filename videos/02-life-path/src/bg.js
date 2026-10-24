'use strict';
// Procedural backgrounds (no footage). Mode from ?bg=ink|paper|bokeh (default: none).
// Each mode pre-renders its static layers once, then only offsets/blends them per frame.
window.BG = (() => {
  const mode = new URLSearchParams(location.search).get('bg') || 'ink';
  const cv = document.getElementById('bgc'), g = cv.getContext('2d'), W = 1920, H = 1080;
  const hash = n => { let h = Math.imul(n | 0, 2654435761) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };
  const noise1 = (x, seed) => { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return hash(i * 31 + seed) * (1 - s) + hash((i + 1) * 31 + seed) * s; };
  const ridge = (x, seed, oct = 5) => { let v = 0, a = 1, f = 1, n = 0; for (let o = 0; o < oct; o++) { v += a * noise1(x * f, seed + o * 97); n += a; a *= 0.5; f *= 2.1; } return v / n; };
  function layer(seed, base, amp, scale, color, blur, wide = 3840) {
    const c = document.createElement('canvas'); c.width = wide; c.height = H; const q = c.getContext('2d');
    q.filter = blur ? `blur(${blur}px)` : 'none'; q.fillStyle = color; q.beginPath(); q.moveTo(0, H);
    for (let x = 0; x <= wide; x += 4) q.lineTo(x, base - amp * Math.pow(ridge(x / scale, seed), 1.6));
    q.lineTo(wide, H); q.closePath(); q.fill();
    // ink-wash: fade each layer toward its foot so the mist sits between ranges
    q.filter = 'none'; q.globalCompositeOperation = 'destination-out';
    const gr = q.createLinearGradient(0, base - amp * 0.2, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.85)');
    q.fillStyle = gr; q.fillRect(0, 0, wide, H); return c;
  }
  let S = {};
  function init() {
    if (mode === 'ink') {
      S.layers = [
        layer(1, 640, 330, 520, 'rgba(120,128,138,0.30)', 6),
        layer(2, 760, 300, 420, 'rgba(80,86,94,0.42)', 3),
        layer(3, 880, 260, 330, 'rgba(44,47,52,0.60)', 1.5),
        layer(4, 1010, 200, 260, 'rgba(18,19,21,0.92)', 0),
      ];
      S.speed = [6, 11, 18, 28];
      // 庐山: one tall peak that rises and fills the frame in the middle of the film
      const c = document.createElement('canvas'); c.width = W; c.height = H; const q = c.getContext('2d');
      q.fillStyle = 'rgba(26,29,34,0.96)'; q.beginPath(); q.moveTo(0, H);
      for (let x = 0; x <= W; x += 3) {
        const env = Math.exp(-Math.pow((x - 960) / 520, 2)), shoulder = Math.exp(-Math.pow((x - 1420) / 260, 2)) * 0.45;
        q.lineTo(x, 1040 - (env * 780 + shoulder * 520) * (0.82 + 0.18 * ridge(x / 90, 33)));
      }
      q.lineTo(W, H); q.closePath(); q.fill();
      q.globalCompositeOperation = 'destination-out';
      const fg = q.createLinearGradient(0, 520, 0, H); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,0.75)');
      q.fillStyle = fg; q.fillRect(0, 0, W, H); S.peak = c;
    }
    if (mode === 'paper') {
      const c = document.createElement('canvas'); c.width = W; c.height = H; const q = c.getContext('2d');
      q.fillStyle = '#ECE4D3'; q.fillRect(0, 0, W, H);
      const im = q.getImageData(0, 0, W, H); let s = 99;
      for (let i = 0; i < W * H; i++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; const v = ((s >>> 24) - 128) * 0.06; for (let k = 0; k < 3; k++) im.data[i * 4 + k] += v; }
      q.putImageData(im, 0, 0);
      q.strokeStyle = 'rgba(150,130,100,0.10)'; q.lineWidth = 1;                         // paper fibres
      for (let k = 0; k < 900; k++) { const x = hash(k) * W, y = hash(k + 5000) * H, a = hash(k + 77) * Math.PI, l = 10 + hash(k + 9) * 40; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 6, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); q.stroke(); }
      S.paper = c;
      S.layers = [layer(5, 800, 300, 460, 'rgba(70,66,60,0.10)', 5), layer(6, 930, 240, 340, 'rgba(50,46,42,0.16)', 2)];
      S.speed = [6, 12];
    }
    if (mode === 'bokeh') S.n = 46;
  }
  function draw(t, tint) {
    g.clearRect(0, 0, W, H);
    if (mode === 'ink') {
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, tint); sky.addColorStop(0.65, '#0b0b0c'); sky.addColorStop(1, '#050505');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      const P = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
      const sun = P(t, 28.4, 30.5) * (1 - P(t, 48.4, 50.4));                                 // a low dusk sun for the "two lives" part
      const mx = 1420, my = 250 + 120 * sun;                                                 // otherwise a faint moon
      const mg = g.createRadialGradient(mx, my, 0, mx, my, 220 + 160 * sun);
      mg.addColorStop(0, `rgba(${235 + 20 * sun},${225 - 60 * sun},${200 - 120 * sun},${0.16 + 0.22 * sun})`); mg.addColorStop(0.25, `rgba(235,${225 - 70 * sun},${200 - 130 * sun},${0.06 + 0.1 * sun})`); mg.addColorStop(1, 'rgba(235,190,120,0)');
      g.fillStyle = mg; g.fillRect(mx - 400, my - 400, 800, 800);
      S.layers.forEach((c, i) => {
        const off = (t * S.speed[i]) % (c.width - W); g.drawImage(c, -off, 0);
        // mist band drifting above each range
        const y = 600 + i * 120, mist = g.createLinearGradient(0, y - 70, 0, y + 70);
        mist.addColorStop(0, 'rgba(180,186,192,0)'); mist.addColorStop(0.5, `rgba(180,186,192,${0.05 + 0.02 * Math.sin(t * 0.4 + i)})`); mist.addColorStop(1, 'rgba(180,186,192,0)');
        g.fillStyle = mist; g.fillRect(0, y - 70, W, 140);
        if (i === 1) {                                                                       // 庐山 rises between the far and near ranges
          const e = x => 1 - Math.pow(1 - x, 3), rise = e(P(t, 51.4, 53.8)) * (1 - P(t, 61.2, 62.8) ** 2);
          if (rise > 0) {
            g.drawImage(S.peak, 0, (1 - rise) * 760 + 30 * Math.sin(t * 0.2));
            const m = g.createLinearGradient(0, 760, 0, 980); m.addColorStop(0, 'rgba(170,180,190,0)'); m.addColorStop(0.5, `rgba(170,180,190,${0.12 * rise})`); m.addColorStop(1, 'rgba(170,180,190,0)');
            g.fillStyle = m; g.fillRect(0, 760, W, 220);
          }
        }
      });
      // the river and the lone boat (我相信独游的小船 … to the end)
      const water = P(t, 76.2, 77.8);
      if (water > 0) {
        const wy = 920, wg = g.createLinearGradient(0, wy, 0, H); wg.addColorStop(0, `rgba(28,44,46,${0.95 * water})`); wg.addColorStop(1, `rgba(8,12,13,${water})`);
        g.fillStyle = wg; g.fillRect(0, wy, W, H - wy);
        g.strokeStyle = `rgba(200,225,215,${0.16 * water})`; g.lineWidth = 1.5; g.beginPath();
        for (let k = 0; k < 60; k++) { const y = wy + 8 + hash(k + 300) * 150, x = (hash(k + 301) * 2400 + t * (12 + hash(k + 302) * 18)) % 2400 - 240, l = 30 + hash(k + 303) * 90; g.moveTo(x, y); g.lineTo(x + l, y); }
        g.stroke();
        const bx = -160 + (t - 76.6) * 125, by = wy + 6 + 3 * Math.sin(t * 1.6), bob = 0.03 * Math.sin(t * 1.3);
        g.save(); g.translate(bx, by); g.rotate(bob); g.fillStyle = `rgba(10,12,13,${water})`;
        g.beginPath(); g.moveTo(-70, -8); g.quadraticCurveTo(0, 14, 70, -8); g.lineTo(52, -2); g.quadraticCurveTo(0, 6, -52, -2); g.closePath(); g.fill();   // hull
        g.fillRect(-3, -86, 4, 80);                                                                 // mast
        g.beginPath(); g.moveTo(2, -84); g.quadraticCurveTo(40, -48, 36, -12); g.lineTo(2, -12); g.closePath(); g.fill();                 // sail
        g.beginPath(); g.arc(-26, -18, 7, 0, Math.PI * 2); g.fill(); g.fillRect(-31, -14, 10, 10);                                           // the traveller
        g.restore();
        g.strokeStyle = `rgba(10,12,13,${0.5 * water})`; g.lineWidth = 3; g.beginPath();                // its reflection, broken by ripples
        for (let k = 0; k < 6; k++) { const y = by + 14 + k * 9, w = 70 - k * 9; g.moveTo(bx - w + 6 * Math.sin(t * 3 + k), y); g.lineTo(bx + w + 6 * Math.sin(t * 3 + k), y); }
        g.stroke();
      }
      // 虫鸟同鸣: a few birds cross the sky
      if (t > 82.6) for (let k = 0; k < 7; k++) {
        const v = t - 82.6 - hash(k + 500) * 1.2; if (v < 0) continue;
        const x = 2000 - v * (170 + hash(k + 501) * 90), y = 170 + hash(k + 502) * 260 + 12 * Math.sin(v * 2 + k), f = Math.sin(t * 11 + k * 1.7) * 9, s2 = 0.8 + hash(k + 503) * 0.6;
        g.strokeStyle = 'rgba(14,20,18,0.85)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x - 16 * s2, y - f * s2); g.quadraticCurveTo(x - 6 * s2, y - 3, x, y); g.quadraticCurveTo(x + 6 * s2, y - 3, x + 16 * s2, y - f * s2); g.stroke();
      }
      // 青翠: the whole landscape turns green and brighter at the end
      const green = P(t, 78.6, 84.5);
      if (green > 0) {
        g.save(); g.globalCompositeOperation = 'color'; g.fillStyle = `rgba(80,150,115,${0.3 * green})`; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'screen'; g.fillStyle = `rgba(48,62,52,${0.32 * green})`; g.fillRect(0, 0, W, H); g.restore();
      }
    }
    if (mode === 'paper') {
      g.drawImage(S.paper, 0, 0);
      S.layers.forEach((c, i) => g.drawImage(c, -((t * S.speed[i]) % (c.width - W)), 0));
      const v = g.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1200); v.addColorStop(0, 'rgba(60,40,20,0)'); v.addColorStop(1, 'rgba(60,40,20,0.22)');
      g.fillStyle = v; g.fillRect(0, 0, W, H);
    }
    if (mode === 'bokeh') {
      const bgG = g.createRadialGradient(W / 2, H * 0.48, 0, W / 2, H * 0.48, 1100); bgG.addColorStop(0, tint); bgG.addColorStop(1, '#030303');
      g.fillStyle = bgG; g.fillRect(0, 0, W, H);
      for (let k = 0; k < S.n; k++) {
        const z = hash(k + 3), r = 6 + z * 60, sp = 8 + (1 - z) * 20;
        const x = (hash(k) * (W + 400) + t * sp * (hash(k + 8) > 0.5 ? 1 : -1) + 4000) % (W + 400) - 200, y = (hash(k + 1) * (H + 200) - t * sp * 0.6 + 4000) % (H + 200) - 100;
        const a = (0.05 + 0.12 * (1 - z)) * (0.6 + 0.4 * Math.sin(t * (0.5 + hash(k + 4)) + k));
        const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(240,200,130,${a})`); gr.addColorStop(0.7, `rgba(240,200,130,${a * 0.6})`); gr.addColorStop(1, 'rgba(240,200,130,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
    }
  }
  return { mode, init, draw, light: mode === 'paper' };
})();
