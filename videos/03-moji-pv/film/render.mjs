// node render.mjs stills <t1,t2,...> <outdir>     -> single-sample PNG stills at 1080x1920
// node render.mjs video <out.mp4> [subframes]      -> 1080x1920 @30fps; motion blur is averaged inside the page
import { createRequire } from 'module';
import { spawn } from 'child_process';
import path from 'path'; import fs from 'fs';
const require = createRequire(import.meta.url);
const pw = require('/opt/node22/lib/node_modules/playwright');
const url = 'file://' + path.resolve('index.html') + '?render';
const FPS = 30, NF = 900;
async function open(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e)); page.on('console', m => console.log('console:', m.text()));
  await page.goto(url); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready);
  return page;
}
const [mode, a, b] = process.argv.slice(2);
const browser = await pw.chromium.launch({ args: ['--allow-file-access-from-files'] });
if (mode === 'stills') {
  const page = await open(browser); fs.mkdirSync(b, { recursive: true });
  for (const t of a.split(',').map(Number)) {
    await page.evaluate(t => window.setTime(t), t);
    fs.writeFileSync(path.join(b, `t${t.toFixed(2).padStart(5, '0')}.png`), await page.screenshot({ type: 'png' }));
  }
} else {
  const SUB = +(b || 16), WK = 4, per = Math.ceil(NF / WK), segs = []; let done = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: WK }, async (_, w) => {
    const page = await open(browser);
    const seg = a.replace(/\.mp4$/, `.seg${w}.mp4`); segs[w] = seg;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-crf', '12', '-preset', 'medium', '-pix_fmt', 'yuv420p', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    const closed = new Promise(r => ff.on('close', r));
    for (let f = w * per; f < Math.min(NF, (w + 1) * per); f++) {
      const buf = Buffer.from(await page.evaluate(([f, S]) => window.renderFrame(f, S), [f, SUB]), 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (++done % 100 === 0) console.log(`${done}/${NF} frames ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await closed;
  }));
  fs.writeFileSync(a + '.txt', segs.map(s => `file '${path.resolve(s)}'`).join('\n'));
  console.log('done');
}
await browser.close();
