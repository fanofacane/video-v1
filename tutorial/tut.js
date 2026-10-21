'use strict';
// Tutorial: "how to describe a kinetic-type video to an AI" — 175s, subtitles + music.
// Clip sources: a = original film (960px), A = original full-res (frames 211–330),
//               b = glitch film (960px),  B = glitch full-res (frames 601–900).

const FPS = 30, DUR = 175;
const v = document.getElementById('v'), capEl = document.getElementById('cap');
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const L = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const eOut = t => 1 - Math.pow(1 - clamp(t), 3), eOutX = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
const back = (t, s = 1.7) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
const pad4 = n => String(n).padStart(4, '0');

// ---------- image clips ----------
const pending = [];
function frameSrc(set, s) {
  const n = Math.max(1, Math.min(900, Math.round(s * FPS) + 1));
  if (set === 'A') return `afull/${pad4(Math.min(330, Math.max(211, n)))}.jpg`;
  if (set === 'B') return `bfull/${pad4(Math.min(900, Math.max(601, n)))}.jpg`;
  return `${set}960/${pad4(n)}.jpg`;
}
function clipBox(parent, x, y, w, h, label, labelColor) {
  const d = document.createElement('div'); d.className = 'clip'; Object.assign(d.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  const im = document.createElement('img'); d.appendChild(im);
  if (label) { const l = document.createElement('div'); l.className = 'lbl'; l.textContent = label; if (labelColor) l.style.color = labelColor; d.appendChild(l); }
  parent.appendChild(d);
  d.show = (set, s) => { const src = frameSrc(set, s); if (im._src !== src) { im._src = src; im.src = src; pending.push(im.decode().catch(() => {})); } };
  return d;
}
function stillBox(parent, x, y, w, h, src, label, col) {
  const d = clipBox(parent, x, y, w, h, label, col); d.querySelector('img').src = src; pending.push(d.querySelector('img').decode().catch(() => {})); return d;
}
// ---------- helpers ----------
const el = (parent, cls, html, style = {}) => { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; Object.assign(d.style, style); parent.appendChild(d); return d; };
const pop = (d, t, t0, dy = 30) => { const q = eOutX(P(t, t0, t0 + 0.45)); d.style.opacity = q; d.style.transform = `translateY(${(1 - q) * dy}px) scale(${L(0.96, 1, q)})`; };
function typed(box, str, t, t0, cps = 16) {
  const n = Math.max(0, Math.min(str.length, Math.floor((t - t0) * cps)));
  box.querySelector('.body').innerHTML = str.slice(0, n) + (t >= t0 && (n < str.length || Math.floor(t * 2.5) % 2) ? '<span class="caret"></span>' : '');
}
function promptBox(parent, x, y, w, h, head = '发给 AI 的描述') { return el(parent, 'prompt', `<div class="hd">${head}</div><div class="body"></div>`, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }); }
const heading = (parent, num, title, sub) => el(parent, 'abs', `<div style="font:900 30px Mont;color:var(--yel);letter-spacing:.1em">${num}</div><div class="h1" style="margin-top:6px">${title}</div>${sub ? `<div class="dim" style="font:500 30px SC;margin-top:10px">${sub}</div>` : ''}`, { left: '120px', top: '110px' });

// ---------- segments ----------
const SEGS = [];
function seg(t0, t1, chap, build) { const d = document.createElement('div'); d.className = 'seg'; v.insertBefore(d, capEl); SEGS.push({ t0, t1, chap, d, up: build(d) }); }
const CAPS = [];
const cap = (a, b, s) => CAPS.push([a, b, s]);
const AUD = [];   // film audio to place under the tutorial music: {set, at, from, dur, pan}

// 0 — hook
seg(0, 10, '', d => {
  const full = clipBox(d, 0, 0, 1920, 1080);
  const l = clipBox(d, 40, 250, 900, 506, '原版', 'var(--yel)'), r = clipBox(d, 980, 250, 900, 506, '换个描述', 'var(--grn)');
  const title = el(d, 'abs', `<div class="h1" style="font-size:96px;text-align:center">如何描述，</div><div class="h1" style="font-size:96px;text-align:center;margin-top:8px">让 <span class="en" style="color:var(--yel)">AI</span> 做出动态文字视频</div>
    <div style="text-align:center;margin-top:40px"><span class="chip" style="background:var(--blue)">2 分钟教程</span>&nbsp;&nbsp;<span class="chip" style="background:#222234">六块法</span>&nbsp;&nbsp;<span class="chip" style="background:#222234">实战换风格</span></div>`, { left: 0, right: 0, top: '330px' });
  return t => {
    full.style.display = t < 4 ? 'block' : 'none'; if (t < 4) full.show('A', 7.0 + t);
    const sp = t >= 4 && t < 7; l.style.display = r.style.display = sp ? 'block' : 'none';
    if (sp) { l.show('a', 21.0 + (t - 4)); r.show('b', 21.0 + (t - 4)); pop(l, t, 4); pop(r, t, 4.1); }
    title.style.display = t >= 7 ? 'block' : 'none'; pop(title, t, 7.05, 40);
  };
});
cap(0.2, 4, '这支视频，是 AI 写代码做出来的'); cap(4, 7, '同样的文案，换一种描述，就是另一种风格'); cap(7.6, 10, '今天教你：怎么把想要的视频描述给 AI');
AUD.push({ set: 'a', at: 0, from: 7.0, dur: 4.0, pan: 0, g: 1 }, { set: 'a', at: 4, from: 21.0, dur: 3.0, pan: -0.7, g: 0.8 }, { set: 'b', at: 4, from: 21.0, dur: 3.0, pan: 0.7, g: 0.8 });

// 1 — the truth: it's a loop
seg(10, 28, '01  一个真相', d => {
  const myth = el(d, 'abs', `<div class="h1" style="text-align:center;font-size:84px">一句提示词 <span style="color:var(--yel)">→</span> 一支成片</div>`, { left: 0, right: 0, top: '330px' });
  const strike = el(d, 'abs', '', { left: '470px', top: '378px', height: '10px', background: 'var(--red)', borderRadius: '5px' });
  const cross = el(d, 'abs', '✕', { left: '1480px', top: '300px', font: '900 120px Mont', color: 'var(--red)' });
  const nodes = [['①', '给出描述 / 参考'], ['②', 'AI 出第一版'], ['③', '截帧对比'], ['④', '指出问题 · 修改']];
  const pos = [[960, 240], [1400, 470], [960, 700], [520, 470]];
  const ring = el(d, 'abs', `<svg width="1920" height="1080"><ellipse cx="960" cy="470" rx="440" ry="230" fill="none" stroke="#33334a" stroke-width="4" stroke-dasharray="14 14"/></svg>`, { left: 0, top: 0 });
  const nd = nodes.map(([n, s], i) => el(d, 'abs', `<div style="font:900 44px Mont;color:var(--yel)">${n}</div><div style="font:700 36px SC;margin-top:4px;white-space:nowrap">${s}</div>`,
    { left: pos[i][0] - 170 + 'px', top: pos[i][1] - 70 + 'px', width: '340px', height: '140px', textAlign: 'center', paddingTop: '18px', boxSizing: 'border-box', borderRadius: '22px', background: 'var(--pn)', border: '2px solid var(--ln)' }));
  const centre = el(d, 'abs', `<div class="dim" style="font:500 30px SC;text-align:center">通常要</div><div style="font:700 60px SC;text-align:center">循环 <span class="en" style="color:var(--yel)">2–5</span> 轮</div>`, { left: '760px', top: '410px', width: '400px' });
  const ex = el(d, 'abs', '', { left: '0', right: '0', top: '860px', textAlign: 'center', font: '500 30px SC', color: 'var(--dim)' });
  const after = el(d, 'abs', `<div class="h1" style="text-align:center">要学的不是<del>咒语</del>，是<span style="color:var(--yel)">描述方法</span></div>`, { left: 0, right: 0, top: '420px' });
  const exs = ['例：「做一支 30 秒蓝黄配色的动态文字视频」', '例：AI 交出能播放的第一版', '例：拿第 24.5 秒和预期对比', '例：「STOP 那一帧是半透明的，要实心」'];
  return (t, lt) => {
    const m = lt < 4; myth.style.display = strike.style.display = cross.style.display = m ? 'block' : 'none';
    if (m) { pop(myth, lt, 0); strike.style.width = eOut(P(lt, 1.8, 2.3)) * 980 + 'px'; cross.style.opacity = P(lt, 2.3, 2.5); cross.style.transform = `scale(${back(P(lt, 2.3, 2.6), 3)})`; }
    const loop = lt >= 4 && lt < 16; ring.style.display = centre.style.display = ex.style.display = loop ? 'block' : 'none';
    nd.forEach((n, i) => { n.style.display = loop ? 'block' : 'none'; if (!loop) return; pop(n, lt, 4.2 + i * 0.25);
      const act = Math.floor((lt - 5.5) / 2.5) % 4 === i && lt >= 5.5; n.style.borderColor = act ? 'var(--yel)' : 'var(--ln)'; n.style.boxShadow = act ? '0 0 0 6px rgba(239,255,12,.15)' : 'none'; });
    if (loop) { pop(centre, lt, 4.8); const k = Math.floor((lt - 5.5) / 2.5) % 4; ex.textContent = lt >= 5.5 ? exs[k] : ''; }
    after.style.display = lt >= 16 ? 'block' : 'none'; pop(after, lt, 16);
  };
});
cap(10.2, 14, '很多人以为：写一句神奇的提示词，AI 就能直接出成片'); cap(14.2, 20, '但真实的过程，是一个循环');
cap(20, 26, '描述 → 出第一版 → 截帧对比 → 指出问题 → 再改'); cap(26, 28, '所以要学的，是一套描述方法');

// 2 — six blocks overview
const SIX = [['①', '规格', '多长 · 比例 · 平台'], ['②', '风格', '关键词 · 配色 · 字体'], ['③', '文案', '一行一个画面'], ['④', '动效', '点名动作，别说"酷"'], ['⑤', '节奏', 'BPM · 卡点'], ['⑥', '约束与验收', '怎么做 · 怎么查']];
seg(28, 36, '02  六块法', d => {
  const h = el(d, 'abs', `<div class="h1" style="text-align:center">六块法</div><div class="dim" style="text-align:center;margin-top:8px">每块说清一两句话，AI 就有足够的信息</div>`, { left: 0, right: 0, top: '120px' });
  const bs = SIX.map(([n, tt, s], i) => el(d, 'blk', `<div class="n">${n}</div><div class="t">${tt}</div><div class="s">${s}</div>`, { left: 140 + (i % 3) * 560 + 'px', top: 360 + Math.floor(i / 3) * 240 + 'px' }));
  return (t, lt) => { pop(h, lt, 0); bs.forEach((b, i) => pop(b, lt, 0.6 + i * 0.35)); };
});
cap(28.2, 36, '把一支视频拆成 6 块，每块说清一两句话');

// 3 — ① spec
seg(36, 46, '02  六块法 · ① 规格', d => {
  heading(d, '①', '规格', '多长 · 什么比例 · 发在哪');
  const specs = el(d, 'abs', ['30 秒', '16 : 9 横屏', '1920 × 1080', '30 帧/秒'].map(s => `<span class="chip" style="background:#222234;font-size:34px;margin:0 14px 18px 0">${s}</span>`).join(''), { left: '120px', top: '390px', width: '760px' });
  const wide = clipBox(d, 1000, 160, 800, 450, '16:9', 'var(--yel)');
  const tall = el(d, 'abs', '<div style="font:700 22px SC;color:var(--dim);padding:14px">9:16</div>', { left: '1580px', top: '650px', width: '120px', height: '213px', border: '3px dashed #44445c', borderRadius: '12px' });
  const pr = promptBox(d, 120, 640, 1400, 210);
  return (t, lt) => { pop(specs, lt, 0.4); pop(wide, lt, 0.7); wide.show('a', 2.5 + lt * 0.6); pop(tall, lt, 1.0); pop(pr, lt, 2.4); typed(pr, '做一支 30 秒、16:9 横屏、1920×1080、30 帧的动态文字视频，用来发抖音。', t, 39.0, 14); };
});
cap(36.2, 46, '先说清楚：多长、什么比例、发在哪个平台');

// 4 — ② style
seg(46, 58, '02  六块法 · ② 风格', d => {
  heading(d, '②', '风格', '三个关键词 + 配色 + 字体气质');
  const sw = el(d, 'abs', [['#3400F3', '电光蓝'], ['#EFFF0C', '荧光黄'], ['#FFFFFF', '纯白']].map(([c, n]) => `<div style="display:inline-block;margin-right:26px;text-align:center"><div style="width:150px;height:150px;border-radius:20px;background:${c}"></div><div style="font:700 26px SC;margin-top:10px">${n}</div><div class="dim en" style="font-size:22px;font-weight:800">${c}</div></div>`).join(''), { left: '120px', top: '380px' });
  const fnt = el(d, 'abs', `<div class="en" style="font-size:88px;line-height:1">Montserrat</div><div class="dim" style="font:500 28px SC;margin-top:6px">粗 · 圆 · 几何感的无衬线字体</div>`, { left: '120px', top: '640px' });
  const kw = el(d, 'abs', ['波普', '高对比', '干净'].map(s => `<span class="chip" style="background:var(--blue);margin-right:14px">${s}</span>`).join(''), { left: '700px', top: '440px' });
  const still = clipBox(d, 1100, 150, 720, 405); const pr = promptBox(d, 1100, 600, 720, 300);
  return (t, lt) => { pop(sw, lt, 0.4); pop(fnt, lt, 1.0); pop(kw, lt, 1.6); pop(still, lt, 0.6); still.show('a', 13.6 + (lt % 2.4)); pop(pr, lt, 3.0);
    typed(pr, '风格：电光蓝底 #3400F3，白色粗体无衬线大字，荧光黄五角星点缀，黑底白字小标签。关键词：波普、高对比、干净。', t, 49.5, 14); };
});
cap(46.2, 52, '风格 = 三个关键词 + 配色 + 字体气质'); cap(52, 58, '颜色最好直接给色号，AI 就不会乱猜');

// 5 — ③ copy
const LINES = [['IT STARTS WITH ONE', 0], ['FRAME', 2.5], ['THEN ANOTHER', 4.55], ['AND AGAIN', 6.5], ['FEEL THE BEAT', 9.0]];
seg(58, 68, '02  六块法 · ③ 文案', d => {
  heading(d, '③', '文案', '一行 = 一个画面');
  const list = LINES.map(([s, tt], i) => el(d, 'abs', `<span class="dim en" style="font-size:24px;font-weight:800;display:inline-block;width:110px">0:${String(Math.floor(tt)).padStart(2, '0')}</span><span class="en" style="font-size:44px">${s}</span>`, { left: '120px', top: 360 + i * 84 + 'px', padding: '10px 20px', borderRadius: '12px' }));
  const cl = clipBox(d, 1000, 200, 840, 473);
  const pr = promptBox(d, 1000, 710, 840, 180);
  return (t, lt) => { const s = lt; cl.show('a', s); pop(cl, lt, 0.3);
    list.forEach((li, i) => { pop(li, lt, 0.4 + i * 0.2); const on = s >= LINES[i][1] && (i === LINES.length - 1 || s < LINES[i + 1][1]); li.style.background = on ? 'rgba(239,255,12,.12)' : 'transparent'; li.style.boxShadow = on ? 'inset 6px 0 0 var(--yel)' : 'none'; });
    pop(pr, lt, 1.5); typed(pr, '文案（每行一个画面）：IT STARTS WITH ONE / FRAME / THEN ANOTHER / AND AGAIN / FEEL THE BEAT …', t, 60.0, 16); };
});
cap(58.2, 63, '文案一行对应一个画面，越短越好'); cap(63, 68, '短促的英文大字最好排版，也可以中英混用');

// 6 — ④ motion vocabulary
const VOCAB = [['3D 翻入', 0.0, 0.9], ['硬币翻转', 0.0, 0.8], ['穿遮罩滑入', 0.45, 1.7], ['旋转甩出', 2.0, 2.9], ['波浪字', 4.6, 6.4], ['逐字掉落 + 巨字砸落', 6.5, 8.3], ['节拍冲击', 10.0, 11.0], ['跑马灯矩阵', 16.0, 17.9]];
seg(68, 88, '02  六块法 · ④ 动效', d => {
  const h = el(d, 'abs', `<div style="font:900 30px Mont;color:var(--yel);letter-spacing:.1em">④</div><div class="h1" style="margin-top:6px">动效：动作词库</div>`, { left: '120px', top: '70px' });
  const tiles = VOCAB.map(([n], i) => { const tl = el(d, 'tile', `<img><b>${n}</b>`, { left: 60 + (i % 4) * 460 + 'px', top: 250 + Math.floor(i / 4) * 330 + 'px' }); return tl; });
  const pr = promptBox(d, 120, 260, 1680, 330, '发给 AI 的描述 · 动效');
  return (t, lt) => {
    pop(h, lt, 0);
    const showGrid = lt < 12;
    tiles.forEach((tl, i) => {
      tl.style.display = showGrid ? 'block' : 'none'; if (!showGrid) return;
      pop(tl, lt, 0.5 + i * 0.35);
      const [, a, b] = VOCAB[i], s = a + ((lt * 1.0) % (b - a)); const im = tl.querySelector('img'), src = frameSrc('a', s);
      if (im._src !== src) { im._src = src; im.src = src; pending.push(im.decode().catch(() => {})); }
    });
    pr.style.display = showGrid ? 'none' : 'block'; pop(pr, lt, 12.1);
    typed(pr, '动效：标题用「3D 翻入」，转场用「旋转甩出」，AGAIN 和 STOP 用「巨字砸落」（两帧定格、不要模糊），星星用「硬币翻转」，FEEL THE BEAT 每个八分音符做一次「节拍冲击」，全程开 16 子帧运动模糊。', t, 80.6, 18);
  };
});
cap(68.2, 74, '最关键的一块：别说"酷一点"，直接点名动作'); cap(74, 80, '这是这支片子用到的动作词库，想要哪个就点哪个'); cap(80, 88, '描述时，把"哪句话"和"哪个动作"对应起来');

// 7 — ⑤ rhythm
seg(88, 98, '02  六块法 · ⑤ 节奏', d => {
  heading(d, '⑤', '节奏', '给出 BPM，让动作落在拍子上');
  const dots = el(d, 'abs', [0, 1, 2, 3].map(i => `<span style="display:inline-block;width:64px;height:64px;border-radius:50%;margin-right:30px;background:#2a2a40" id="bd${i}"></span>`).join('') + '<span class="en" style="font-size:72px;vertical-align:-8px;margin-left:20px">120 <span style="font-size:36px" class="dim">BPM</span></span>', { left: '120px', top: '400px' });
  const cl = clipBox(d, 1000, 170, 840, 473);
  const bar = el(d, 'abs', '', { left: '1000px', top: '670px', width: '840px', height: '60px' });
  for (let k = 0; k <= 8; k++) el(bar, 'abs', '', { left: k * 105 + 'px', top: '18px', width: '3px', height: '24px', background: '#44445c' });
  const marks = [0, 0.5, 1.0, 1.25, 1.5, 1.75].map(s => el(bar, 'abs', '', { left: s / 2 * 420 * 2 / 2 + 'px', top: '10px', width: '14px', height: '40px', marginLeft: '-7px', borderRadius: '4px', background: 'var(--yel)' }));
  const ph = el(bar, 'abs', '', { top: '0', width: '3px', height: '60px', background: '#fff' });
  const pr = promptBox(d, 120, 700, 820, 190);
  return (t, lt) => {
    pop(dots, lt, 0.3); pop(cl, lt, 0.5); pop(bar, lt, 0.8); pop(pr, lt, 1.6);
    const s = 9.0 + (lt % 2.0); cl.show('a', s);
    const beat = Math.floor((t) * 2) % 4; for (let i = 0; i < 4; i++) { const b = document.getElementById('bd' + i); const on = i === beat; b.style.background = on ? 'var(--yel)' : '#2a2a40'; b.style.transform = `scale(${on ? 1 + 0.25 * Math.exp(-((t * 2) % 1) * 5) : 1})`; }
    marks.forEach((m, i) => { m.style.left = [0, 0.5, 1.0, 1.25, 1.5, 1.75][i] / 2 * 840 + 'px'; });
    ph.style.left = (s - 9.0) / 2 * 840 + 'px';
    typed(pr, '节奏：120 BPM，每 2 拍换一句；转场、砸字、星星弹出都卡在拍点上。', t, 90.0, 14);
  };
});
cap(88.2, 93, '节奏决定"高级感"：给出 BPM，让 AI 把动作卡在拍子上'); cap(93, 98, '配乐也可以让 AI 用代码原创合成，不用担心版权');

// 8 — ⑥ constraints & acceptance
seg(98, 106, '02  六块法 · ⑥ 约束与验收', d => {
  heading(d, '⑥', '约束与验收', '告诉 AI 怎么做，以及做完怎么检查');
  const items = ['用代码生成，不使用任何版权素材', '先出 5 张静帧，确认风格再做动画', '做完逐帧检查：没有重影、没有闪烁', '配乐原创，节拍和画面对齐'];
  const rows = items.map((s, i) => el(d, 'abs chk', `<i></i><span>${s}</span>`, { left: '160px', top: 390 + i * 110 + 'px' }));
  return (t, lt) => rows.forEach((r, i) => { pop(r, lt, 0.4 + i * 0.5); const on = lt > 1.0 + i * 1.3; const b = r.querySelector('i'); b.textContent = on ? '✓' : ''; b.style.background = on ? 'var(--grn)' : 'transparent'; b.style.borderColor = on ? 'var(--grn)' : '#44445c'; });
});
cap(98.2, 106, '最后告诉 AI：怎么做，以及做完怎么检查');

// 9 — practice: change two blocks only
seg(106, 112, '03  实战换风格', d => {
  const h = el(d, 'abs', `<div class="h1" style="text-align:center">实战：只改两块</div>`, { left: 0, right: 0, top: '230px' });
  const bs = SIX.map(([n, tt], i) => el(d, 'abs', `<div style="font:900 40px Mont;color:var(--yel)">${n}</div><div style="font:700 34px SC;margin-top:6px">${tt}</div><div class="st" style="font:500 22px SC;margin-top:8px"></div>`,
    { left: 120 + i * 285 + 'px', top: '460px', width: '255px', height: '190px', padding: '24px', boxSizing: 'border-box', borderRadius: '20px', background: 'var(--pn)', border: '3px solid var(--ln)' }));
  return (t, lt) => { pop(h, lt, 0); bs.forEach((b, i) => { pop(b, lt, 0.4 + i * 0.12); const ch = i === 1 || i === 3, on = lt > 2.0;
    b.style.borderColor = on && ch ? 'var(--grn)' : 'var(--ln)'; b.style.opacity = on && !ch ? 0.35 : b.style.opacity; b.querySelector('.st').textContent = on ? (ch ? '改这里' : '不变') : ''; b.querySelector('.st').style.color = ch ? 'var(--grn)' : 'var(--dim)'; }); };
});
cap(106.2, 112, '实战：同一支片子，只改 ② 风格 和 ④ 动效');

// 10 — prompt diff
seg(112, 124, '03  实战换风格', d => {
  const p2 = el(d, 'prompt', `<div class="hd">② 风格</div><div class="old"></div><div class="body" style="color:var(--grn)"></div>`, { left: '120px', top: '150px', width: '1680px', height: '360px' });
  const p4 = el(d, 'prompt', `<div class="hd">④ 动效</div><div class="old"></div><div class="body" style="color:var(--grn)"></div>`, { left: '120px', top: '540px', width: '1680px', height: '360px' });
  const O2 = '电光蓝底 #3400F3，白色粗体无衬线大字，荧光黄五角星点缀，黑底白字小标签。', N2 = '近黑底 + 扫描线和细网格，荧光绿 #39FF88、洋红 #FF2BD6、青色 #00E5FF，等宽粗体字，像黑客终端。';
  const O4 = '3D 翻入、旋转甩出转场、巨字砸落、硬币翻转的星星、节拍冲击。', N4 = '字符乱码解码入场、故障切片转场、CRT 开机/关机、RGB 色彩分离、逐格跳动的运动；星星换成瞄准镜。';
  p2.querySelector('.old').innerHTML = O2; p4.querySelector('.old').innerHTML = O4;
  return (t, lt) => { pop(p2, lt, 0); pop(p4, lt, 0.3);
    for (const [p, a] of [[p2, 1.5], [p4, 6.5]]) { const o = p.querySelector('.old'); o.style.textDecoration = lt > a ? 'line-through' : 'none'; o.style.textDecorationColor = 'var(--red)'; o.style.color = lt > a ? 'var(--dim)' : '#e8e8f0'; }
    typed(p2, N2, t, 114.0, 16); typed(p4, N4, t, 119.0, 16); };
});
cap(112.2, 118, '风格：从波普的蓝黄，换成黑底赛博故障'); cap(118, 124, '动效：从翻转甩动，换成乱码解码、故障切片、CRT 开关机');

// 11 — side by side
seg(124, 140, '03  实战换风格 · 对比', d => {
  const l = clipBox(d, 30, 220, 920, 518, '原版 · 波普', 'var(--yel)'), r = clipBox(d, 970, 220, 920, 518, '新版 · 故障', 'var(--grn)');
  const tc = el(d, 'abs', '', { left: 0, right: 0, top: '780px', textAlign: 'center', font: '800 30px Mont', color: 'var(--dim)' });
  return (t, lt) => { pop(l, lt, 0); pop(r, lt, 0.1); l.show('a', lt); r.show('b', lt); tc.textContent = `0:${String(Math.floor(lt)).padStart(2, '0')}  ·  同一句文案  ·  同一个节拍`; };
});
cap(124.2, 132, '同一句文案、同一个节拍'); cap(132, 140, '只是换了两块描述，整支片子的气质完全不同');
AUD.push({ set: 'a', at: 124, from: 0, dur: 16, pan: -0.75, g: 0.75 }, { set: 'b', at: 124, from: 0, dur: 16, pan: 0.75, g: 0.75 });

// 12 — new film full screen
seg(140, 150, '03  新成片', d => { const f = clipBox(d, 0, 0, 1920, 1080); return (t, lt) => f.show('B', 20.0 + lt); });
cap(140.3, 145, '这就是新成片 ✦ 全程 AI 用代码完成'); cap(145, 150, '文案和节拍没变，看起来像另一个作者的作品');
AUD.push({ set: 'b', at: 140, from: 20.0, dur: 10, pan: 0, g: 1 });

// 13 — how to give feedback
seg(150, 166, '04  怎么提修改意见', d => {
  heading(d, '04', '怎么给 AI 提修改意见');
  const bad = el(d, 'abs', `<span style="color:var(--red);font:900 44px Mont">✕</span>&nbsp;&nbsp;「感觉不太对，再改改」`, { left: '120px', top: '360px', font: '700 44px SC' });
  const good = el(d, 'abs', `<span style="color:var(--grn);font:900 44px Mont">✓</span>&nbsp;&nbsp;「第 <b style="color:var(--yel)">24.5</b> 秒的 STOP 是半透明的，应该是实心」`, { left: '120px', top: '450px', font: '700 44px SC' });
  const rule = el(d, 'abs', ['时间点', '看到了什么', '应该是什么'].map(s => `<span class="chip" style="background:var(--blue);margin-right:16px">${s}</span>`).join(''), { left: '120px', top: '580px' });
  const sb = stillBox(d, 120, 360, 820, 461, 'bugs/stop_bad.jpg', '修改前 · 半透明', 'var(--red)'), sg = stillBox(d, 980, 360, 820, 461, 'bugs/stop_good.jpg', '修改后 · 实心', 'var(--grn)');
  const gb = stillBox(d, 120, 360, 820, 461, 'bugs/ghost_bad.jpg', '修改前 · 红色重影', 'var(--red)'), gg = stillBox(d, 980, 360, 820, 461, 'bugs/ghost_good.jpg', '修改后', 'var(--grn)');
  const q2 = el(d, 'abs', '', { left: 0, right: 0, top: '860px', textAlign: 'center', font: '700 36px SC' });
  return (t, lt) => {
    const a = lt < 4; bad.style.display = good.style.display = rule.style.display = a ? 'block' : 'none';
    if (a) { pop(bad, lt, 0.3); pop(good, lt, 1.2); pop(rule, lt, 2.2); }
    const s1 = lt >= 4 && lt < 10, s2 = lt >= 10; sb.style.display = sg.style.display = s1 ? 'block' : 'none'; gb.style.display = gg.style.display = s2 ? 'block' : 'none';
    if (s1) { pop(sb, lt, 4); pop(sg, lt, 4.6); q2.innerHTML = '「第 <b style="color:var(--yel)">24.5</b> 秒的 STOP 是半透明的，应该是实心」'; }
    if (s2) { pop(gb, lt, 10); pop(gg, lt, 10.6); q2.innerHTML = '「<b style="color:var(--yel)">13</b> 秒之后出现了红色重影，应该没有」'; }
    q2.style.display = lt >= 4 ? 'block' : 'none';
  };
});
cap(150.2, 154, '提修改意见时，别说"感觉不对"'); cap(154, 160, '要说清：第几秒、看到了什么、应该是什么样'); cap(160, 166, '这两个，都是做这支视频时真实遇到、再让 AI 修好的问题');

// 14 — outro
seg(166, 175, '', d => {
  const row = el(d, 'abs', SIX.map(([n, tt]) => `<span class="chip" style="background:#222234;margin:0 10px"><span class="en" style="color:var(--yel)">${n}</span> ${tt}</span>`).join(''), { left: 0, right: 0, top: '260px', textAlign: 'center' });
  const big = el(d, 'abs', `<div class="h1" style="text-align:center">完整提示词模板</div><div class="h2" style="text-align:center;margin-top:16px;color:var(--yel)">→ 放在评论区</div>`, { left: 0, right: 0, top: '420px' });
  const card = el(d, 'abs', `<div class="en" style="font-size:150px;line-height:1">TYPE IN</div><div class="en" style="font-size:180px;line-height:1">MOTION</div><div style="font:700 36px SC;margin-top:30px">关注我，下期见 ✦</div>`, { left: 0, right: 0, top: '230px', textAlign: 'center' });
  return (t, lt) => {
    const a = lt < 5; row.style.display = big.style.display = a ? 'block' : 'none'; card.style.display = a ? 'none' : 'block';
    if (a) { pop(row, lt, 0.2); pop(big, lt, 1.0); }
    else { pop(card, lt, 5.0, 60); }
    d.style.background = a ? 'transparent' : `rgba(52,0,243,${eOut(P(lt, 5, 5.4))})`;
  };
});
cap(166.2, 171, '六块法：规格 · 风格 · 文案 · 动效 · 节奏 · 验收'); cap(171, 175, '完整提示词模板放在评论区，关注我，下期见');

// ---------- frame ----------
async function setTime(t) {
  pending.length = 0;
  let chap = '';
  for (const s of SEGS) { const on = t >= s.t0 && t < s.t1; s.d.style.display = on ? 'block' : 'none'; if (on) { s.up(t, t - s.t0); chap = s.chap; } }
  const c = CAPS.find(([a, b]) => t >= a && t < b);
  capEl.style.display = c ? 'block' : 'none';
  if (c) { capEl.textContent = c[2]; const q = eOutX(P(t, c[0], c[0] + 0.3)); capEl.style.opacity = q * (1 - P(t, c[1] - 0.15, c[1])); }
  const full = (t < 4) || (t >= 140 && t < 150);
  document.getElementById('chap').textContent = full ? '' : chap;
  document.getElementById('prog').style.width = (t / DUR * 1920) + 'px';
  await Promise.all(pending);
  return true;
}
window.setTime = setTime; window.AUD = AUD; window.DUR = DUR;
window.ready = Promise.all(['400 30px SC', '500 30px SC', '700 30px SC', '800 30px Mont', '900 30px Mont'].map(f => document.fonts.load(f))).then(() => true);
if (!/render/.test(location.search)) window.ready.then(() => { const t0 = performance.now(); const loop = async () => { await setTime(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); });
