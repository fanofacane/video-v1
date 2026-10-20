// Usage: node render.mjs stills <t1,t2,...> <outdir>
//        node render.mjs video <outfile.mp4> [workers]
import { createRequire } from 'module';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const FPS = 30, DUR = 16, N = FPS * DUR;
const url = 'file://' + path.resolve('index.html') + '?render';
const launch = () => pw.chromium.launch({ args: ['--disable-web-security', '--allow-file-access-from-files'] });

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e));
  page.on('console', m => console.log('console:', m.text()));
  await page.goto(url);
  await page.evaluate(() => window.ready);
  return page;
}
const shot = async (page, t, type = 'jpeg') => {
  await page.evaluate(t => window.renderFrame(t), t);
  return page.screenshot(type === 'png' ? { type: 'png' } : { type: 'jpeg', quality: 94 });
};

const [mode, a, b] = process.argv.slice(2);
if (mode === 'stills') {
  const browser = await launch(); const page = await openPage(browser);
  fs.mkdirSync(b, { recursive: true });
  for (const t of a.split(',').map(Number)) {
    const s = Date.now(); const buf = await shot(page, t);
    fs.writeFileSync(path.join(b, `t${t.toFixed(2)}.jpg`), buf);
    console.log(t, Date.now() - s, 'ms');
  }
  await browser.close();
} else if (mode === 'video') {
  const workers = +(b || 4);
  const browser = await launch();
  const per = Math.ceil(N / workers);
  const segs = [];
  const t0 = Date.now(); let done = 0;
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await openPage(browser);
    const seg = a.replace(/\.mp4$/, `.seg${w}.mp4`); segs[w] = seg;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    const closed = new Promise(r => ff.on('close', r));
    for (let f = w * per; f < Math.min(N, (w + 1) * per); f++) {
      const buf = await shot(page, f / FPS);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (++done % 30 === 0) console.log(`${done}/${N} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await closed;
  }));
  await browser.close();
  fs.writeFileSync(a + '.txt', segs.map(s => `file '${path.resolve(s)}'`).join('\n'));
  console.log('segments done', segs);
}
