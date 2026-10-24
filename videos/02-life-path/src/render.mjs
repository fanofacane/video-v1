// node render.mjs stills <t1,t2,...> <outdir>
// node render.mjs video <out.mp4> <fromSec> <toSec> [workers]   -> 1920x1080 @30fps, segments + <out>.txt for concat
import { createRequire } from 'module';
import { spawn } from 'child_process';
import path from 'path'; import fs from 'fs';
const require = createRequire(import.meta.url);
const pw = require('/opt/node22/lib/node_modules/playwright');
const url = 'file://' + path.resolve(path.dirname(new URL(import.meta.url).pathname), 'index.html');
const FPS = 30;
const browser = await pw.chromium.launch({ args: ['--allow-file-access-from-files'] });
async function open() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.error('PAGE ERROR', e));
  await page.goto(url); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready);
  return page;
}
const shot = async (page, t) => { await page.evaluate(t => window.setTime(t), t); return page.screenshot({ type: 'png' }); };
const [mode, a, b, c, d] = process.argv.slice(2);
if (mode === 'stills') {
  const page = await open(); fs.mkdirSync(b, { recursive: true });
  for (const t of a.split(',').map(Number)) fs.writeFileSync(path.join(b, `t${t.toFixed(2).padStart(5, '0')}.png`), await shot(page, t));
} else {
  const f0 = Math.round(+b * FPS), f1 = Math.round(+c * FPS), WK = +(d || 4), per = Math.ceil((f1 - f0) / WK), segs = [];
  await Promise.all(Array.from({ length: WK }, async (_, w) => {
    const page = await open(), seg = a.replace(/\.mp4$/, `.seg${w}.mp4`); segs[w] = path.resolve(seg);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    const closed = new Promise(r => ff.on('close', r));
    for (let f = f0 + w * per; f < Math.min(f1, f0 + (w + 1) * per); f++) {
      const buf = await shot(page, f / FPS);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await closed;
  }));
  fs.writeFileSync(a + '.txt', segs.map(s => `file '${s}'`).join('\n'));
  console.log('done');
}
await browser.close();
