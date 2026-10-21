'use strict';
// Tutorial v3 — alternating text/footage sides, centred Codex recording with a push-in on the prompt message.
const FPS = 30, DUR = 168;
const v = document.getElementById('v');
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
  a: s => `a960/${p4(fr(s, 1, 900))}.jpg`, b: s => `b960/${p4(fr(s, 1, 900))}.jpg`, B: s => `bfull/${p4(fr(s, 601, 900))}.jpg`,
  a2: s => `a2full/${p4(fr(s, 361, 603))}.jpg`, b2: s => `b2full/${p4(fr(s, 361, 603))}.jpg`,
  m: s => `m960/${p4(fr(s, 1, 360))}.jpg`, ref: s => `ref/${p3(fr(s, 1, 111))}.jpg`, rmk: s => `rmk/${p3(fr(s, 1, 111))}.jpg`,
};
const el = (parent, cls, html = '', st = {}) => { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; Object.assign(d.style, st); parent.appendChild(d); return d; };
const appear = (d, t, t0, dy = 26) => { const q = eOutX(P(t, t0, t0 + 0.5)); d.style.opacity = q; d.style.transform = `translateY(${(1 - q) * dy}px)`; return q; };

// two text columns; footage sits on the other side
const COLS = { L: el(v, '', '', { position: 'absolute', left: '96px', top: 0, width: '780px', height: '1080px', zIndex: 5 }),
               R: el(v, '', '', { position: 'absolute', left: '1060px', top: 0, width: '780px', height: '1080px', zIndex: 5 }) };
const MEDIA = { L: [920, 270], R: [80, 270] };   // text side → media position
const MW = 920, MH = 518;
function media(parent, side, label, w = MW, h = MH, y = 270) {
  const [x] = MEDIA[side];
  const d = el(parent, 'media', '', { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  const im = document.createElement('img'); d.appendChild(im); d.im = im;
  if (label) d.lab = el(d, 'tagl', label);
  d.show = (k, s) => setImg(im, SRC[k](s));
  return d;
}
function fitBand(m, w = MW) { const s = w / 1280; Object.assign(m.im.style, { width: 1280 * s + 'px', height: 720 * s + 'px', top: -72 * s + 'px' }); }

// ---------- narration lines ----------
const LINES = [];
function line(t0, t1, y, html, cls = '', side = 'L') { const d = el(COLS[side], 'ln ' + cls, html, { top: y + 'px', display: 'none' }); LINES.push({ t0, t1, d }); }
function updateLines(t) {
  for (const { t0, t1, d } of LINES) {
    const on = t >= t0 && t < t1; d.style.display = on ? 'block' : 'none'; if (!on) continue;
    const q = eOutX(P(t, t0, t0 + 0.45)), o = 1 - P(t, t1 - 0.25, t1);
    d.style.opacity = q * o; d.style.transform = `translateY(${(1 - q) * 34}px)`;
  }
}
const CAPS = []; const cap = (a, b, s) => CAPS.push([a, b, s]);

// ---------- segments ----------
const SEGS = [];
function seg(t0, t1, chap, build, full = false) { const d = el(v, 'seg'); v.insertBefore(d, COLS.L); SEGS.push({ t0, t1, chap, d, full, up: build(d) }); }

// 0 · cold open: original ↔ glitch wipe, 2× speed
seg(0, 4, '', d => {
  const box = el(d, 'abs', '', { left: 0, top: 0, width: '1920px', height: '1080px', overflow: 'hidden' });
  const ia = document.createElement('img'), ib = document.createElement('img');
  for (const im of [ia, ib]) Object.assign(im.style, { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' });
  box.append(ia, ib);
  const bar = el(box, 'abs', '', { top: 0, width: '6px', height: '100%', background: '#fff', boxShadow: '0 0 30px rgba(0,0,0,.6)' });
  const la = el(box, 'tagl', '原版', { fontSize: '30px', left: '40px', top: '40px' }), lb = el(box, 'tagl', '换一种描述', { fontSize: '30px', left: 'auto', right: '40px', top: '40px', color: 'var(--grn)' });
  return (t, lt) => {
    setImg(ia, SRC.a2(12 + lt * 2)); setImg(ib, SRC.b2(12 + lt * 2));
    const x = lt < 1.0 ? L(0.98, 0.5, eIO(P(lt, 0.05, 0.9))) : 0.5 + 0.38 * Math.sin((lt - 1.0) * 1.9);
    ib.style.clipPath = `inset(0 0 0 ${x * 100}%)`; bar.style.left = x * 1920 - 3 + 'px';
  };
}, true);

// 1 · last episode (footage left, text right)
seg(4, 12, '', d => { const m = media(d, 'R', '上期作品'); return (t, lt) => { appear(m, lt, 0.1); m.show('m', 1.5 + lt); }; });
line(4.2, 12, 330, '上期视频的', '', 'R'); line(4.55, 12, 415, '教程来了 <span class="y">✦</span>', '', 'R');
line(6.8, 12, 560, '很多人在评论区问：', 's', 'R'); line(7.4, 12, 615, '这到底是怎么做出来的？', 's', 'R');

// 2 · the answer, then a centred recording with a push-in on the prompt message
seg(12, 16, '', d => {
  const t1_ = el(d, 'abs', `<div class="ln" style="position:static;text-align:center;font-size:88px">其实，只用了<span class="y">一段提示词</span></div>`, { left: 0, right: 0, top: '380px' });
  const t2_ = el(d, 'abs', `<div class="ln s" style="position:static;text-align:center;font-size:44px">这里拿 <b style="color:#fff">Codex</b> 做演示 ↓</div>`, { left: 0, right: 0, top: '560px' });
  return (t, lt) => { appear(t1_, lt, 0.2); appear(t2_, lt, 1.6); d.style.opacity = 1 - P(lt, 3.7, 4.0); };
});
const REC = { x: 240, y: 60, w: 1440, h: 810 };
const VIEW = { full: [0, 0, 1280, 720], msg: [647, 32, 400, 225], player: [300, 160, 640, 360], doc: [255, 140, 1025, 577] };
// recording time + camera (crop in recording pixels) for a given local time
function recPlan(lt) {
  const ZIN = [0.7, 1.3], HOLD = 1.5, ZOUT = [ZIN[1] + HOLD, ZIN[1] + HOLD + 0.6], FREEZE = 2.3, RATE = 1.15;
  let rt, cam;
  if (lt < ZIN[0]) { rt = 1.6 + lt; cam = VIEW.full; }
  else if (lt < ZOUT[1]) {
    rt = FREEZE;   // playback pauses on the message while the camera pushes in and holds
    const k = lt < ZIN[1] ? eIO(P(lt, ZIN[0], ZIN[1])) : 1 - eIO(P(lt, ZOUT[0], ZOUT[1]));
    cam = VIEW.full.map((v_, i) => L(v_, VIEW.msg[i], k));
  } else {
    const u = lt - ZOUT[1]; rt = FREEZE + u * RATE;
    const toPlayer = eIO(P(rt, 4.5, 6.0)) * (1 - eIO(P(rt, 15.6, 17.2)));
    const toDoc = eIO(P(rt, 18.4, 20.0));
    cam = VIEW.full.map((v_, i) => L(L(v_, VIEW.player[i], toPlayer * 0.75), VIEW.doc[i], toDoc * 0.6));
  }
  return { rt: Math.min(27.3, rt), cam };
}
seg(16, 41, '', d => {
  const box = el(d, 'media', '', { left: REC.x + 'px', top: REC.y + 'px', width: REC.w + 'px', height: REC.h + 'px', background: '#fff' });
  const im = document.createElement('img'); Object.assign(im.style, { position: 'absolute' }); box.appendChild(im);
  el(box, 'tagl', 'Codex 录屏');
  const ring = el(box, 'abs', '', { border: '4px solid var(--yel)', borderRadius: '18px', boxShadow: '0 0 0 9999px rgba(0,0,0,0)', pointerEvents: 'none' });
  return (t, lt) => {
    const q = eOutX(P(lt, 0, 0.5)); box.style.opacity = q; box.style.transform = `scale(${L(0.94, 1, q)})`;
    const { rt, cam } = recPlan(lt), s = REC.w / cam[2];
    Object.assign(im.style, { width: 1280 * s + 'px', height: 720 * s + 'px', left: -cam[0] * s + 'px', top: -cam[1] * s + 'px' });
    setImg(im, `rec/${p4(fr(rt, 49, 821))}.jpg`);
    // highlight frame around the message while in close-up
    const hk = P(lt, 1.2, 1.5) * (1 - P(lt, 2.6, 2.9));
    const mx = (757 - cam[0]) * s, my = (104 - cam[1]) * s, mw = 186 * s, mh = 78 * s;
    Object.assign(ring.style, { left: mx - 10 + 'px', top: my - 10 + 'px', width: mw + 20 + 'px', height: mh + 20 + 'px', opacity: hk });
  };
});
cap(17.3, 20.3, '把这段提示词，丢给 Codex'); cap(20.5, 25.5, '它自己写代码、自己渲染'); cap(25.5, 31, '连剪辑软件界面，都是它画的'); cap(31, 33.4, '做出来的，就是上期那支视频'); cap(33.6, 41, '这就是那段提示词');

// 3 · suspense (footage left, text right)
seg(41, 47, '', d => {
  const m = media(d, 'R'); const q = el(d, 'abs', '?', { left: MEDIA.R[0] + MW / 2 - 70 + 'px', top: 270 + MH / 2 - 150 + 'px', font: '900 260px Mont', color: 'var(--yel)', zIndex: 4 });
  const im = m.im; im.style.width = 'auto'; im.style.height = 'auto';
  return (t, lt) => { appear(m, lt, 0); const c = VIEW.doc, s = MW / c[2];
    Object.assign(im.style, { width: 1280 * s + 'px', height: 720 * s + 'px', left: -c[0] * s + 'px', top: -c[1] * s + 'px', filter: `blur(${L(0, 14, eOut(P(lt, 0.4, 1.5)))}px)` });
    setImg(im, `rec/${p4(fr(23.8 + lt * 0.3, 49, 821))}.jpg`); q.style.opacity = P(lt, 0.8, 1.2); q.style.transform = `scale(${1 + 0.06 * Math.sin(lt * 5)})`; };
});
line(41.2, 47, 380, '这种提示词，', '', 'R'); line(41.7, 47, 470, '到底<span class="y">怎么写</span>？', '', 'R');

// 4 · six blocks intro (text left)
const SIX = ['① 动效', '② 风格', '③ 文案', '④ 节奏', '⑤ 规格', '⑥ 验收'];
seg(47, 50, '六块法', d => {
  const m = media(d, 'L', '上期正片');
  const chips = el(COLS.L, 'abs', SIX.map(s => `<span style="display:inline-block;width:220px;margin:0 16px 18px 0;padding:10px 0;text-align:center;border-radius:12px;background:#1d1d2c;font:700 34px SC">${s}</span>`).join(''), { top: '560px', width: '760px', display: 'none' });
  return (t, lt) => { appear(m, lt, 0); m.show('a', 2.5 + lt); chips.style.display = 'block'; appear(chips, lt, 0.6); };
});
line(47.2, 50, 330, '把一支视频'); line(47.6, 50, 415, '拆成 <span class="y">6</span> 块说清楚');

// 5 · the six blocks, alternating sides
function block(t0, t1, side, num, title, excerpt, takeaway, right) {
  seg(t0, t1, '六块法 · ' + title, d => {
    const C = COLS[side];
    const head = el(C, 'abs', `<span class="num">${num}</span><span style="font:700 60px SC;margin-left:18px;vertical-align:4px">${title}</span>`, { top: '190px', display: 'none' });
    const doc = el(C, 'doc', `<div class="hd">提示词原文</div>${excerpt}`, { top: '320px', display: 'none' });
    const tk = el(C, 'abs', `<span style="color:var(--yel)">→</span> ${takeaway}`, { top: '820px', font: '700 46px SC', whiteSpace: 'nowrap', display: 'none' });
    const up = right(d, side);
    return (t, lt) => {
      for (const [x, a] of [[head, 0], [doc, 0.35], [tk, 2.6]]) { x.style.display = 'block'; appear(x, lt, a); }
      doc.querySelectorAll('.hl').forEach((h, i) => (h.style.backgroundSize = eOut(P(lt, 1.3 + i * 0.5, 1.9 + i * 0.5)) * 100 + '% 100%'));
      up(t, lt);
    };
  });
}
const film = (from, label = '对应画面', loop = 0) => (d, side) => { const m = media(d, side, label); return (t, lt) => { appear(m, lt, 0.1); m.show('a', from + (loop ? lt % loop : lt)); }; };
const VOCAB = [['3D 翻入', 0.0, 0.9], ['硬币翻转', 0.0, 0.8], ['穿遮罩滑入', 0.45, 1.7], ['旋转甩出', 2.0, 2.9], ['波浪字', 4.6, 6.4], ['巨字砸落', 6.8, 8.3], ['节拍冲击', 10.0, 11.0], ['跑马灯矩阵', 16.0, 17.9]];
block(50, 64, 'L', '①', '动效', '<span class="hl">3D 翻入</span>：rotateY 从 −86° 到 0°，0.35s，cubicOut<br><span class="hl">巨字砸落</span>：第 0 帧放大约 16 倍，两帧定格、不要模糊<br>……一共 13 个动作，全部点名',
  '别说"酷一点"，直接点名动作', (d, side) => {
    const x0 = MEDIA[side][0];
    const m = media(d, side, '巨字砸落');
    const grid = el(d, 'abs', '', { left: x0 - 4 + 'px', top: '230px', width: '940px', height: '380px' });
    const tiles = VOCAB.map(([n], i) => el(grid, 'tile', `<img><b>${n}</b>`, { left: (i % 4) * 240 + 'px', top: Math.floor(i / 4) * 190 + 'px' }));
    const gl = el(d, 'abs', '动作词库 · 每格都是成片里的真实画面', { left: x0 + 'px', top: '640px', font: '500 28px SC', color: 'var(--dim)' });
    return (t, lt) => {
      const g = lt >= 4.2; m.style.display = g ? 'none' : 'block'; grid.style.display = gl.style.display = g ? 'block' : 'none';
      if (!g) { appear(m, lt, 0.1); m.show('a', 6.8 + (lt % 1.6)); return; }
      appear(gl, lt, 4.6);
      tiles.forEach((tl, i) => { const q = eOutX(P(lt, 4.2 + i * 0.18, 4.7 + i * 0.18)); tl.style.opacity = q; tl.style.transform = `scale(${L(0.85, 1, q)})`;
        const [, a, b] = VOCAB[i]; setImg(tl.querySelector('img'), SRC.a(a + (lt % (b - a)))); });
    };
  });
block(64, 73, 'R', '②', '风格', '主背景：<span class="hl">电光蓝 #3400F3</span>，上下边缘轻微压暗<br>星星：<span class="hl">黄色 #EFFF0C</span>，正五角星<br>字体：Montserrat 900，白色粗体',
  '颜色直接给色号，别让 AI 猜', film(13.65, '对应画面', 2.2));
block(73, 82, 'L', '③', '文案', '0.00–2.60　<span class="hl">"IT STARTS"</span>（字高 92）3D 翻入；右下弹出标签 "WITH"；大星从左下硬币翻转入场；"O N E" 穿遮罩从右滑入……',
  '每一句：几秒出现、多大、怎么动', film(0.0));
block(82, 90, 'R', '④', '节奏', '速度：<span class="hl">120 BPM</span>，和弦 Fmaj7 → G6 → Em7 → Am7<br>每个转场、砸字、弹出都<span class="hl">落在节拍上</span>',
  '给出 BPM，动作全部卡拍', (d, side) => {
    const m = media(d, side, 'FEEL THE BEAT');
    const dots = el(d, 'abs', [0, 1, 2, 3].map(i => `<span class="bdot" style="display:inline-block;width:46px;height:46px;border-radius:50%;margin-right:24px;background:#2a2a40"></span>`).join('') + '<span style="font:900 52px Mont;vertical-align:6px;margin-left:16px">120 <span style="font-size:26px;color:var(--dim)">BPM</span></span>', { left: MEDIA[side][0] + 'px', top: 270 + MH + 34 + 'px' });
    const ds = dots.querySelectorAll('.bdot');
    return (t, lt) => { appear(m, lt, 0.1); appear(dots, lt, 0.5); m.show('a', 9.1 + (lt % 1.85));
      const ph = (lt % 1.85) * 2, k = Math.floor(ph) % 4; ds.forEach((b, i) => { b.style.background = i === k ? 'var(--yel)' : '#2a2a40'; b.style.transform = `scale(${i === k ? 1 + 0.3 * Math.exp(-(ph % 1) * 5) : 1})`; }); };
  });
block(90, 99, 'L', '⑤', '规格', '请用代码从零制作一支 <span class="hl">34.1 秒、1920×1080、30fps</span>、H.264 + AAC 的横屏视频……',
  '先把时长、尺寸、帧率说死', film(2.5));
block(99, 107, 'R', '⑥', '验收', '抽查第 7.5s 和 24.5s：巨字砸落那两帧<span class="hl">实心、清晰、不透明</span><br>快速运动处是平滑拖影，<span class="hl">没有重影</span>',
  '让 AI 做完自己检查', (d, side) => {
    const x0 = MEDIA[side][0];
    const a = el(d, 'media', '<img src="bugs/stop_bad.jpg"><div class="tagl" style="color:var(--red)">检查前 · 半透明</div>', { left: x0 + 'px', top: '300px', width: '450px', height: '253px' });
    const b = el(d, 'media', '<img src="bugs/stop_good.jpg"><div class="tagl" style="color:var(--grn)">修正后 · 实心</div>', { left: x0 + 470 + 'px', top: '300px', width: '450px', height: '253px' });
    const n = el(d, 'abs', '第 <span style="color:var(--yel);font:900 44px Mont">24.5</span> 秒 · "STOP" 砸落', { left: x0 + 'px', top: '590px', font: '700 34px SC' });
    return (t, lt) => { appear(a, lt, 0.2); appear(b, lt, 1.6); appear(n, lt, 0.6); };
  });

// 6 · suspense 2 (text left)
seg(107, 113, '', d => { const m = media(d, 'L', '参考：网络作品（静音）', MW, 400, 330); return (t, lt) => { appear(m, lt, 0.1); m.show('ref', 0.1 + (lt % 3.6)); fitBand(m); }; });
line(107.2, 113, 380, '不会写提示词'); line(107.7, 113, 470, '<span class="y">怎么办</span>？'); line(109.4, 113, 610, '把想学的视频直接丢给 AI', 's');

// 7 · reference method (text left)
const STEPS = [[113, '01', '把对标视频发给 AI'], [119, '02', '让它把视频逐帧拆开'], [125, '03', '测出每个字的位置、大小、颜色'], [130, '04', '和原片逐帧对比，再修正'], [136, '05', '得到接近原片的复刻']];
seg(113, 141, '对标法', d => {
  const RXc = MEDIA.L[0];
  const st = STEPS.map(([a, n, s]) => el(COLS.L, 'abs', `<span class="num" style="font-size:34px">${n}</span><span style="margin-left:20px">${s}</span>`, { top: 250 + STEPS.findIndex(x => x[0] === a) * 104 + 'px', font: '700 44px SC', whiteSpace: 'nowrap', display: 'none' }));
  const ref = media(d, 'L', '对标：网络作品（静音）', MW, 400, 330);
  const sheet = el(d, 'media', '<img src="big13.jpg" style="width:100%;height:auto">', { left: RXc + 'px', top: '270px', width: MW + 'px', height: MH + 'px' });
  const lines = (window.BBOX || '').split('\n');
  const data = el(d, 'data', '', { left: RXc + 'px', top: '220px', width: MW + 'px', height: '620px' });
  const top = media(d, 'L', '原片', MW, 400, 150), bot = media(d, 'L', 'AI 复刻', MW, 400, 570);
  return (t, lt) => {
    st.forEach((s, i) => { s.style.display = t >= STEPS[i][0] ? 'block' : 'none'; appear(s, t, STEPS[i][0]); const act = t >= STEPS[i][0] && (i === 4 || t < STEPS[i + 1][0]); s.style.color = act ? '#fff' : '#55556e'; });
    const k = STEPS.findIndex((s, i) => t >= s[0] && (i === 4 || t < STEPS[i + 1][0]));
    ref.style.display = k === 0 ? 'block' : 'none'; sheet.style.display = k === 1 ? 'block' : 'none'; data.style.display = k === 2 ? 'block' : 'none';
    top.style.display = bot.style.display = k >= 3 ? 'block' : 'none';
    if (k === 0) { appear(ref, lt, 0.1); ref.show('ref', lt % 3.6); fitBand(ref); }
    if (k === 1) { const q = P(t, 119, 125); appear(sheet, t, 119); sheet.firstChild.style.transformOrigin = '0 0'; sheet.firstChild.style.transform = `scale(${L(1, 1.5, eIO(q))}) translate(${L(0, -8, q)}%,${L(0, -6, q)}%)`; }
    if (k === 2) { appear(data, t, 125); const first = 10 + Math.floor(P(t, 125.3, 130) * 48);
      data.innerHTML = '<div style="color:var(--dim);margin-bottom:8px"># 每一帧白色文字 / 黄色星星的包围框（像素）</div>' + lines.slice(first, first + 20).map((l, i) => `<div style="${i === 10 ? 'color:#fff;background:rgba(239,255,12,.12)' : ''}">${l.replace(/np\.int64\((\d+)\)/g, '$1')}</div>`).join(''); }
    if (k >= 3) { appear(top, t, 130); appear(bot, t, 130.2); const s = k === 3 ? (P(t, 130, 136) * 6 * 0.5) % 3.7 : (t - 136) % 3.7; top.show('ref', s); bot.show('rmk', s); fitBand(top); fitBand(bot); }
  };
});

// 8 · new style, wipe (footage left, text right)
seg(141, 151, '换风格', d => {
  const x0 = MEDIA.R[0];
  const box = el(d, 'media', '', { left: x0 + 'px', top: '270px', width: MW + 'px', height: MH + 'px' });
  const ia = document.createElement('img'), ib = document.createElement('img'); box.append(ia, ib);
  const bar = el(box, 'abs', '', { top: 0, width: '4px', height: '100%', background: '#fff', zIndex: 3, boxShadow: '0 0 20px rgba(0,0,0,.6)' });
  el(box, 'tagl', '原版'); const tb = el(box, 'tagl', '故障版'); tb.style.left = 'auto'; tb.style.right = '16px'; tb.style.color = 'var(--grn)';
  return (t, lt) => { appear(box, lt, 0.1); setImg(ia, SRC.a(10 + lt)); setImg(ib, SRC.b(10 + lt));
    const x = lt < 2.5 ? L(1, 0.5, eIO(P(lt, 0.6, 2.3))) : 0.5 + 0.42 * Math.sin((lt - 2.5) * 0.9);
    ib.style.clipPath = `inset(0 0 0 ${x * 100}%)`; bar.style.left = x * MW - 2 + 'px'; };
});
line(141.2, 151, 330, '学会以后，', '', 'R'); line(141.7, 151, 415, '换一种风格', '', 'R'); line(142.3, 151, 500, '只要改<span class="y">两句描述</span>', '', 'R');
line(144.6, 151, 650, '① 动效 + ② 风格，其他不变', 's', 'R');

// 9 · glitch film full screen
seg(151, 161, '', d => {
  const m = media(d, 'L', '', 1920, 1080, 0); m.style.left = 0; m.style.borderRadius = 0;
  const lab = el(d, 'abs', '另一种风格 · 赛博故障版', { left: '60px', top: '56px', font: '700 30px SC', padding: '8px 18px', borderRadius: '10px', background: 'rgba(0,0,0,.6)', color: 'var(--grn)' });
  return (t, lt) => { m.show('B', 20 + lt); lab.style.opacity = P(lt, 0.3, 0.8) * (1 - P(lt, 3.5, 4.0)); };
}, true);

// 10 · outro (footage left, text right)
seg(161, 168, '', d => {
  const m = media(d, 'R', '完整提示词'); const im = m.im; im.style.width = 'auto'; im.style.height = 'auto';
  return (t, lt) => { appear(m, lt, 0.1); const c = VIEW.doc, s = MW / c[2];
    Object.assign(im.style, { width: 1280 * s + 'px', height: 720 * s + 'px', left: -c[0] * s + 'px', top: -c[1] * s + 'px' }); setImg(im, `rec/${p4(fr(18.5 + lt * 1.1, 49, 821))}.jpg`); };
});
line(161.2, 168, 330, '需要这份提示词', '', 'R'); line(161.7, 168, 415, '<span class="y">评论区留言</span>', '', 'R'); line(163.6, 168, 560, '下期见 ✦', 's', 'R');

// ---------- frame ----------
const capEl = document.getElementById('cap');
async function setTime(t) {
  pending.length = 0; let chap = '', full = false;
  for (const s of SEGS) { const on = t >= s.t0 && t < s.t1; s.d.style.display = on ? 'block' : 'none'; if (on) { chap = s.chap; full = s.full; } }
  for (const C of Object.values(COLS)) C.querySelectorAll('.abs,.doc').forEach(x => (x.style.display = 'none'));
  for (const s of SEGS) if (t >= s.t0 && t < s.t1) s.up(t, t - s.t0);
  updateLines(t);
  for (const C of Object.values(COLS)) C.style.display = full ? 'none' : 'block';
  const c = CAPS.find(([a, b]) => t >= a && t < b);
  capEl.style.display = c ? 'block' : 'none';
  if (c) { capEl.textContent = c[2]; capEl.style.opacity = eOutX(P(t, c[0], c[0] + 0.3)) * (1 - P(t, c[1] - 0.15, c[1])); }
  document.getElementById('glow').style.display = full ? 'none' : 'block';
  document.getElementById('chap').textContent = full ? '' : chap;
  document.getElementById('prog').style.width = t / DUR * 1920 + 'px';
  const fin = 1 - P(t, DUR - 0.6, DUR); v.style.filter = fin < 1 ? `brightness(${fin})` : '';
  await Promise.all(pending);
  return true;
}
window.setTime = setTime; window.DUR = DUR;
window.AUD = [{ file: 'out/open_a.wav', at: 0, from: 0, dur: 4.0, pan: -0.6, g: 0.75 }, { file: 'out/open_b.wav', at: 0, from: 0, dur: 4.0, pan: 0.6, g: 0.75 },
  { set: 'b', at: 151, from: 20.0, dur: 10, pan: 0, g: 1 }];
window.WHOOSH = [4, 12, 16, 41, 47, 50, 64, 73, 82, 90, 99, 107, 113, 119, 125, 130, 136, 141, 151, 161];
window.ready = Promise.all(['400 30px SC', '500 30px SC', '700 30px SC', '800 30px Mont', '900 30px Mont'].map(f => document.fonts.load(f))).then(() => true);
if (!/render/.test(location.search)) window.ready.then(() => { const t0 = performance.now(); const loop = async () => { await setTime(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); });
