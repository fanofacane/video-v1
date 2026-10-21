'use strict';
// Tutorial v2 — narration on the left, real footage on the right. 162s, music + no voice.
const FPS = 30, DUR = 162;
const v = document.getElementById('v'), left = document.getElementById('left');
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const L = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const eOut = t => 1 - Math.pow(1 - clamp(t), 3), eOutX = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
const eIO = t => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const p4 = n => String(n).padStart(4, '0'), p3 = n => String(n).padStart(3, '0');
const pending = [];
const setImg = (im, src) => { if (im._src !== src) { im._src = src; im.src = src; pending.push(im.decode().catch(() => {})); } };
const fr = (s, lo, hi) => Math.max(lo, Math.min(hi, Math.round(s * FPS) + 1));
const SRC = {
  a: s => `a960/${p4(fr(s, 1, 900))}.jpg`, A: s => `afull/${p4(fr(s, 211, 330))}.jpg`,
  b: s => `b960/${p4(fr(s, 1, 900))}.jpg`, B: s => `bfull/${p4(fr(s, 601, 900))}.jpg`,
  m: s => `m960/${p4(fr(s, 1, 360))}.jpg`, ref: s => `ref/${p3(fr(s, 1, 111))}.jpg`, rmk: s => `rmk/${p3(fr(s, 1, 111))}.jpg`,
};
const el = (parent, cls, html = '', st = {}) => { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; Object.assign(d.style, st); parent.appendChild(d); return d; };
function media(parent, x, y, w, h, label) {
  const d = el(parent, 'media', '', { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  const im = document.createElement('img'); d.appendChild(im); d.im = im;
  if (label) d.lab = el(d, 'tagl', label);
  d.show = (k, s) => setImg(im, SRC[k](s));
  return d;
}
const appear = (d, t, t0, dy = 26) => { const q = eOutX(P(t, t0, t0 + 0.5)); d.style.opacity = q; d.style.transform = `translateY(${(1 - q) * dy}px)`; return q; };

// ---------- left narration ----------
const LINES = [];
function line(t0, t1, y, html, cls = '') { const d = el(left, 'ln ' + cls, html, { top: y + 'px', display: 'none' }); LINES.push({ t0, t1, d }); }
function updateLines(t) {
  for (const { t0, t1, d } of LINES) {
    const on = t >= t0 && t < t1; d.style.display = on ? 'block' : 'none'; if (!on) continue;
    const q = eOutX(P(t, t0, t0 + 0.45)), o = 1 - P(t, t1 - 0.25, t1);
    d.style.opacity = q * o; d.style.transform = `translateY(${(1 - q) * 34}px)`;
  }
}

// ---------- segments ----------
const SEGS = [];
function seg(t0, t1, chap, build, full = false) { const d = el(v, 'seg'); v.insertBefore(d, left); SEGS.push({ t0, t1, chap, d, full, up: build(d) }); }
const RX = 920, RY = 270, RW = 920, RH = 518;

// 0 · cold open
seg(0, 4, '', d => { const m = media(d, 0, 0, 1920, 1080); m.style.borderRadius = 0; return (t, lt) => m.show('A', 7.3 + lt); }, true);

// 1 · last episode
seg(4, 12, '', d => { const m = media(d, RX, RY, RW, RH, '上期作品'); return (t, lt) => { appear(m, lt, 0.1); m.show('m', 1.5 + lt); }; });
line(4.2, 12, 330, '上期视频的'); line(4.55, 12, 415, '教程来了 <span class="y">✦</span>');
line(6.8, 12, 560, '很多人在评论区问：', 's'); line(7.4, 12, 615, '这到底是怎么做出来的？', 's');

// 2 · the Codex recording (rough-cut: 1.6s–27.3s of the capture, muted)
const CROP = { r1: [320, 120, 680, 383], r2: [300, 160, 640, 360], r3: [255, 140, 1025, 577] };
function recBox(parent) {
  const d = el(parent, 'media', '', { left: RX + 'px', top: RY + 'px', width: RW + 'px', height: RH + 'px', background: '#fff' });
  const im = document.createElement('img'); im.style.width = 'auto'; im.style.height = 'auto'; d.appendChild(im);
  el(d, 'tagl', 'Codex 录屏');
  d.show = (rt, blur = 0) => {
    let c;
    if (rt >= 17.4) c = CROP.r3;
    else { const k = eIO(P(rt, 3.3, 4.0)); c = CROP.r1.map((v_, i) => L(v_, CROP.r2[i], k)); }
    const s = RW / c[2];
    Object.assign(im.style, { width: 1280 * s + 'px', height: 720 * s + 'px', left: -c[0] * s + 'px', top: -c[1] * s + 'px', filter: blur ? `blur(${blur}px)` : 'none' });
    setImg(im, `rec/${p4(fr(rt, 49, 821))}.jpg`);
  };
  return d;
}
seg(12, 35, '', d => { const r = recBox(d); return (t, lt) => { appear(r, lt, 0); r.show(1.6 + lt * (25.7 / 23)); }; });
line(12.2, 35, 290, '其实，'); line(12.8, 35, 375, '只用了<span class="y">一段提示词</span>');
line(16.3, 35, 520, '把它丢给 Codex', 's'); line(18.3, 35, 575, '它自己写代码、自己渲染', 's'); line(21.0, 35, 630, '连剪辑软件界面，都是它画的', 's');
line(26.4, 35, 760, '这就是那段提示词 →', 's');

// 3 · suspense
seg(35, 41, '', d => {
  const r = recBox(d); const q = el(d, 'abs', '?', { left: RX + RW / 2 - 70 + 'px', top: RY + RH / 2 - 150 + 'px', font: '900 260px Mont', color: 'var(--yel)', zIndex: 4 });
  return (t, lt) => { r.show(23.8 + lt * 0.3, L(0, 14, eOut(P(lt, 0.4, 1.5)))); q.style.opacity = P(lt, 0.8, 1.2); q.style.transform = `scale(${1 + 0.06 * Math.sin(lt * 5)})`; };
});
line(35.2, 41, 380, '这种提示词，'); line(35.7, 41, 470, '到底<span class="y">怎么写</span>？');

// 4 · six blocks intro
const SIX = ['① 规格', '② 风格', '③ 文案', '④ 动效', '⑤ 节奏', '⑥ 验收'];
seg(41, 44, '六块法', d => {
  const m = media(d, RX, RY, RW, RH, '上期正片');
  const chips = el(left, 'abs', SIX.map(s => `<span style="display:inline-block;width:220px;margin:0 16px 18px 0;padding:10px 0;text-align:center;border-radius:12px;background:#1d1d2c;font:700 34px SC">${s}</span>`).join(''), { top: '560px', width: '760px', display: 'none' });
  d._chips = chips;
  return (t, lt) => { appear(m, lt, 0); m.show('a', 2.5 + lt); chips.style.display = 'block'; appear(chips, lt, 0.6); };
});
line(41.2, 44, 330, '把一支视频'); line(41.6, 44, 415, '拆成 <span class="y">6</span> 块说清楚');

// 5 · the six blocks — left: real prompt excerpt + takeaway; right: what it produced
function block(t0, t1, num, title, excerpt, takeaway, right) {
  seg(t0, t1, '六块法 · ' + title, d => {
    const head = el(left, 'abs', `<span class="num">${num}</span><span style="font:700 60px SC;margin-left:18px;vertical-align:4px">${title}</span>`, { top: '190px', display: 'none' });
    const doc = el(left, 'doc', `<div class="hd">提示词原文</div>${excerpt}`, { top: '320px', display: 'none' });
    const tk = el(left, 'abs', `<span style="color:var(--yel)">→</span> ${takeaway}`, { top: '820px', font: '700 46px SC', whiteSpace: 'nowrap', display: 'none' });
    const up = right(d);
    return (t, lt) => {
      for (const [x, a] of [[head, 0], [doc, 0.35], [tk, 2.6]]) { x.style.display = 'block'; appear(x, lt, a); }
      doc.querySelectorAll('.hl').forEach((h, i) => (h.style.backgroundSize = eOut(P(lt, 1.3 + i * 0.5, 1.9 + i * 0.5)) * 100 + '% 100%'));
      up(t, lt);
    };
  });
}
const film = (from, label = '对应画面', loop = 0) => d => { const m = media(d, RX, RY, RW, RH, label); return (t, lt) => { appear(m, lt, 0.1); m.show('a', from + (loop ? lt % loop : lt)); }; };
block(44, 53, '①', '规格', '请用代码从零制作一支 <span class="hl">34.1 秒、1920×1080、30fps</span>、H.264 + AAC 的横屏视频……',
  '先把时长、尺寸、帧率说死', film(2.5));
block(53, 62, '②', '风格', '主背景：<span class="hl">电光蓝 #3400F3</span>，上下边缘轻微压暗<br>星星：<span class="hl">黄色 #EFFF0C</span>，正五角星<br>字体：Montserrat 900，白色粗体',
  '颜色直接给色号，别让 AI 猜', film(13.65, '对应画面', 2.2));
block(62, 71, '③', '文案', '0.00–2.60　<span class="hl">"IT STARTS"</span>（字高 92）3D 翻入；右下弹出标签 "WITH"；大星从左下硬币翻转入场；"O N E" 穿遮罩从右滑入……',
  '每一句：几秒出现、多大、怎么动', film(0.0));
const VOCAB = [['3D 翻入', 0.0, 0.9], ['硬币翻转', 0.0, 0.8], ['穿遮罩滑入', 0.45, 1.7], ['旋转甩出', 2.0, 2.9], ['波浪字', 4.6, 6.4], ['巨字砸落', 6.8, 8.3], ['节拍冲击', 10.0, 11.0], ['跑马灯矩阵', 16.0, 17.9]];
block(71, 85, '④', '动效', '<span class="hl">3D 翻入</span>：rotateY 从 −86° 到 0°，0.35s，cubicOut<br><span class="hl">巨字砸落</span>：第 0 帧放大约 16 倍，两帧定格、不要模糊<br>……一共 13 个动作，全部点名',
  '别说"酷一点"，直接点名动作', d => {
    const m = media(d, RX, RY, RW, RH, '巨字砸落');
    const grid = el(d, 'abs', '', { left: RX - 4 + 'px', top: '230px', width: '940px', height: '380px' });
    const tiles = VOCAB.map(([n], i) => el(grid, 'tile', `<img><b>${n}</b>`, { left: (i % 4) * 240 + 'px', top: Math.floor(i / 4) * 190 + 'px' }));
    const gl = el(d, 'abs', '动作词库 · 每格都是成片里的真实画面', { left: RX + 'px', top: '640px', font: '500 28px SC', color: 'var(--dim)' });
    return (t, lt) => {
      const g = lt >= 4.2; m.style.display = g ? 'none' : 'block'; grid.style.display = gl.style.display = g ? 'block' : 'none';
      if (!g) { appear(m, lt, 0.1); m.show('a', 6.8 + (lt % 1.6)); return; }
      appear(gl, lt, 4.6);
      tiles.forEach((tl, i) => { const q = eOutX(P(lt, 4.2 + i * 0.18, 4.7 + i * 0.18)); tl.style.opacity = q; tl.style.transform = `scale(${L(0.85, 1, q)})`;
        const [, a, b] = VOCAB[i]; setImg(tl.querySelector('img'), SRC.a(a + (lt % (b - a)))); });
    };
  });
block(85, 93, '⑤', '节奏', '速度：<span class="hl">120 BPM</span>，和弦 Fmaj7 → G6 → Em7 → Am7<br>每个转场、砸字、弹出都<span class="hl">落在节拍上</span>',
  '给出 BPM，动作全部卡拍', d => {
    const m = media(d, RX, RY, RW, RH, 'FEEL THE BEAT');
    const dots = el(d, 'abs', [0, 1, 2, 3].map(i => `<span id="dt${i}" style="display:inline-block;width:46px;height:46px;border-radius:50%;margin-right:24px;background:#2a2a40"></span>`).join('') + '<span style="font:900 52px Mont;vertical-align:6px;margin-left:16px">120 <span style="font-size:26px;color:var(--dim)">BPM</span></span>', { left: RX + 'px', top: RY + RH + 34 + 'px' });
    return (t, lt) => { appear(m, lt, 0.1); appear(dots, lt, 0.5); m.show('a', 9.1 + (lt % 1.85));
      const ph = (lt % 2.0) * 2, k = Math.floor(ph) % 4; for (let i = 0; i < 4; i++) { const b = document.getElementById('dt' + i); b.style.background = i === k ? 'var(--yel)' : '#2a2a40'; b.style.transform = `scale(${i === k ? 1 + 0.3 * Math.exp(-(ph % 1) * 5) : 1})`; } };
  });
block(93, 101, '⑥', '验收', '抽查第 7.5s 和 24.5s：巨字砸落那两帧<span class="hl">实心、清晰、不透明</span><br>快速运动处是平滑拖影，<span class="hl">没有重影</span>',
  '让 AI 做完自己检查', d => {
    const a = el(d, 'media', '<img src="bugs/stop_bad.jpg"><div class="tagl" style="color:var(--red)">检查前 · 半透明</div>', { left: RX + 'px', top: '300px', width: '450px', height: '253px' });
    const b = el(d, 'media', '<img src="bugs/stop_good.jpg"><div class="tagl" style="color:var(--grn)">修正后 · 实心</div>', { left: RX + 470 + 'px', top: '300px', width: '450px', height: '253px' });
    const n = el(d, 'abs', '第 <span style="color:var(--yel);font:900 44px Mont">24.5</span> 秒 · "STOP" 砸落', { left: RX + 'px', top: '590px', font: '700 34px SC' });
    return (t, lt) => { appear(a, lt, 0.2); appear(b, lt, 1.6); appear(n, lt, 0.6); };
  });

// 6 · suspense 2
seg(101, 107, '', d => { const m = media(d, RX, 330, RW, 400, '参考：网络作品（静音）'); return (t, lt) => { appear(m, lt, 0.1); m.show('ref', 0.1 + (lt % 3.6)); fitBand(m); }; });
line(101.2, 107, 380, '不会写提示词'); line(101.7, 107, 470, '<span class="y">怎么办</span>？');
line(103.4, 107, 610, '把想学的视频直接丢给 AI', 's');
function fitBand(m) { const s = RW / 1280; Object.assign(m.im.style, { width: 1280 * s + 'px', height: 720 * s + 'px', top: -72 * s + 'px' }); } // show the 1280×556 design band

// 7 · reference method
const STEPS = [[107, '01', '把对标视频发给 AI'], [113, '02', '让它把视频逐帧拆开'], [119, '03', '测出每个字的位置、大小、颜色'], [124, '04', '和原片逐帧对比，再修正'], [130, '05', '得到接近原片的复刻']];
seg(107, 135, '对标法', d => {
  const st = STEPS.map(([a, n, s], i) => el(left, 'abs', `<span class="num" style="font-size:34px">${n}</span><span style="margin-left:20px">${s}</span>`, { top: 250 + i * 104 + 'px', font: '700 44px SC', whiteSpace: 'nowrap', display: 'none' }));
  const ref = media(d, RX, 330, RW, 400, '对标：网络作品（静音）');
  const sheet = el(d, 'media', '<img src="big13.jpg" style="width:100%;height:auto">', { left: RX + 'px', top: RY + 'px', width: RW + 'px', height: RH + 'px' });
  const lines = (window.BBOX || '').split('\n');
  const data = el(d, 'data', '', { left: RX + 'px', top: '220px', width: RW + 'px', height: '620px' });
  const top = media(d, RX, 150, RW, 400, '原片'), bot = media(d, RX, 570, RW, 400, 'AI 复刻');
  return (t, lt) => {
    st.forEach((s, i) => { s.style.display = t >= STEPS[i][0] ? 'block' : 'none'; appear(s, t, STEPS[i][0]); const act = t >= STEPS[i][0] && (i === 4 || t < STEPS[i + 1][0]); s.style.color = act ? '#fff' : '#55556e'; });
    const k = STEPS.findIndex((s, i) => t >= s[0] && (i === 4 || t < STEPS[i + 1][0]));
    ref.style.display = k === 0 ? 'block' : 'none'; sheet.style.display = k === 1 ? 'block' : 'none'; data.style.display = k === 2 ? 'block' : 'none';
    top.style.display = bot.style.display = k >= 3 ? 'block' : 'none';
    if (k === 0) { appear(ref, lt, 0.1); ref.show('ref', lt % 3.6); fitBand(ref); }
    if (k === 1) { const q = P(t, 113, 119); appear(sheet, t, 113); sheet.firstChild.style.transform = `scale(${L(1, 1.5, eIO(q))}) translate(${L(0, -8, q)}%,${L(0, -6, q)}%)`; sheet.firstChild.style.transformOrigin = '0 0'; }
    if (k === 2) { appear(data, t, 119); const first = 10 + Math.floor(P(t, 119.3, 124) * 48);
      data.innerHTML = '<div style="color:var(--dim);margin-bottom:8px"># 每一帧白色文字 / 黄色星星的包围框（像素）</div>' + lines.slice(first, first + 20).map((l, i) => `<div style="${i === 10 ? 'color:#fff;background:rgba(239,255,12,.12)' : ''}">${l.replace(/np\.int64\((\d+)\)/g, '$1')}</div>`).join(''); }
    if (k >= 3) { appear(top, t, 124); appear(bot, t, 124.2); const s = k === 3 ? (P(t, 124, 130) * 6 * 0.5) % 3.7 : (t - 130) % 3.7; top.show('ref', s); bot.show('rmk', s); fitBand(top); fitBand(bot); }
  };
});

// 8 · new style, wipe
seg(135, 145, '换风格', d => {
  const box = el(d, 'media', '', { left: RX + 'px', top: RY + 'px', width: RW + 'px', height: RH + 'px' });
  const ia = document.createElement('img'), ib = document.createElement('img'); box.append(ia, ib);
  const bar = el(box, 'abs', '', { top: 0, width: '4px', height: '100%', background: '#fff', zIndex: 3, boxShadow: '0 0 20px rgba(0,0,0,.6)' });
  el(box, 'tagl', '原版'); const tb = el(box, 'tagl', '故障版'); tb.style.left = 'auto'; tb.style.right = '16px'; tb.style.color = 'var(--grn)';
  return (t, lt) => {
    appear(box, lt, 0.1);
    setImg(ia, SRC.a(10 + lt)); setImg(ib, SRC.b(10 + lt));
    const x = lt < 2.5 ? L(1, 0.5, eIO(P(lt, 0.6, 2.3))) : 0.5 + 0.42 * Math.sin((lt - 2.5) * 0.9);
    ib.style.clipPath = `inset(0 0 0 ${x * 100}%)`; bar.style.left = x * RW - 2 + 'px';
  };
});
line(135.2, 145, 330, '学会以后，'); line(135.7, 145, 415, '换一种风格'); line(136.3, 145, 500, '只要改<span class="y">两句描述</span>');
line(138.6, 145, 650, '② 风格 + ④ 动效，其他不变', 's');

// 9 · glitch film full screen
seg(145, 155, '', d => {
  const m = media(d, 0, 0, 1920, 1080); m.style.borderRadius = 0;
  const lab = el(d, 'abs', '另一种风格 · 赛博故障版', { left: '60px', top: '56px', font: '700 30px SC', padding: '8px 18px', borderRadius: '10px', background: 'rgba(0,0,0,.6)', color: 'var(--grn)' });
  return (t, lt) => { m.show('B', 20 + lt); lab.style.opacity = P(lt, 0.3, 0.8) * (1 - P(lt, 3.5, 4.0)); };
}, true);

// 10 · outro
seg(155, 162, '', d => { const r = recBox(d); return (t, lt) => { appear(r, lt, 0.1); r.show(18.5 + lt * 1.1); }; });
line(155.2, 162, 330, '评论区扣 <span class="y">1</span>'); line(155.7, 162, 415, '领这份提示词'); line(157.6, 162, 560, '下期见 ✦', 's');

// ---------- frame ----------
async function setTime(t) {
  pending.length = 0; let chap = '', full = false;
  for (const s of SEGS) { const on = t >= s.t0 && t < s.t1; s.d.style.display = on ? 'block' : 'none'; if (on) { chap = s.chap; full = s.full; } }
  // hide per-segment left elements that belong to inactive segments
  left.querySelectorAll('.abs,.doc').forEach(x => (x.style.display = 'none'));
  for (const s of SEGS) if (t >= s.t0 && t < s.t1) s.up(t, t - s.t0);
  updateLines(t);
  left.style.display = full ? 'none' : 'block';
  document.getElementById('glow').style.display = full ? 'none' : 'block';
  document.getElementById('chap').textContent = full ? '' : chap;
  document.getElementById('prog').style.width = t / DUR * 1920 + 'px';
  const fin = 1 - P(t, DUR - 0.6, DUR); v.style.filter = fin < 1 ? `brightness(${fin})` : '';
  await Promise.all(pending);
  return true;
}
window.setTime = setTime; window.DUR = DUR;
window.AUD = [{ set: 'a', at: 0, from: 7.3, dur: 4.0, pan: 0, g: 1 }, { set: 'b', at: 145, from: 20.0, dur: 10, pan: 0, g: 1 }];
window.WHOOSH = [4, 12, 35, 41, 44, 53, 62, 71, 85, 93, 101, 107, 113, 119, 124, 130, 135, 145, 155];
window.ready = Promise.all(['400 30px SC', '500 30px SC', '700 30px SC', '800 30px Mont', '900 30px Mont'].map(f => document.fonts.load(f))).then(() => true);
if (!/render/.test(location.search)) window.ready.then(() => { const t0 = performance.now(); const loop = async () => { await setTime(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); });
