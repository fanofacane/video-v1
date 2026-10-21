// node render.mjs stills <t1,t2,...> <outdir>     -> single-sample PNG stills at 1280x720
// node render.mjs video <out.mp4> [subframes]      -> 1920x1080 @30fps, motion blur via sub-frame averaging
import { createRequire } from 'module';
import { spawn } from 'child_process';
import path from 'path'; import fs from 'fs';
const require = createRequire(import.meta.url);
const pw = require('/opt/node22/lib/node_modules/playwright');
const url = 'file://' + path.resolve('index.html') + '?render';
const FPS = 30, NF = 900;
async function open(browser, dsf) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e)); page.on('console', m => console.log('console:', m.text()));
  await page.goto(url); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready);
  return page;
}
const shot = async (page, t) => { await page.evaluate(t => window.setTime(t), t); return page.screenshot({ type: 'png' }); };
const [mode, a, b] = process.argv.slice(2);
const browser = await pw.chromium.launch({ args: ['--allow-file-access-from-files'] });
if (mode === 'stills') {
  const page = await open(browser, 1); fs.mkdirSync(b, { recursive: true });
  for (const t of a.split(',').map(Number)) fs.writeFileSync(path.join(b, `t${t.toFixed(2).padStart(5, '0')}.png`), await shot(page, t));
} else {
  const SUB = +(b || 16), WK = 4, per = Math.ceil(NF / WK), segs = []; let done = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: WK }, async (_, w) => {
    const page = await open(browser, 1.5);
    const seg = a.replace(/\.mp4$/, `.seg${w}.mp4`); segs[w] = seg;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'png', '-i', '-',
      '-vf', `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB`, '-r', String(FPS), '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-pix_fmt', 'yuv420p', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    const closed = new Promise(r => ff.on('close', r));
    for (let f = w * per; f < Math.min(NF, (w + 1) * per); f++) {
      for (let k = 0; k < SUB; k++) { // 180-degree shutter centred on the frame
        const buf = await shot(page, (f - 0.25 + (k + 0.5) * 0.5 / SUB) / FPS);
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      }
      if (++done % 60 === 0) console.log(`${done}/${NF} frames ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await closed;
  }));
  fs.writeFileSync(a + '.txt', segs.map(s => `file '${path.resolve(s)}'`).join('\n'));
  console.log('done');
}
await browser.close();
