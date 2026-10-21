// node render.mjs stills <t1,t2,..> <outdir>   |   node render.mjs video <out.mp4> [workers]   |   node render.mjs audio-cues
import { createRequire } from 'module';
import { spawn } from 'child_process';
import path from 'path'; import fs from 'fs';
const require = createRequire(import.meta.url);
const pw = require('/opt/node22/lib/node_modules/playwright');
const url = 'file://' + path.resolve('index2.html') + '?render';
const FPS = 30;
const browser = await pw.chromium.launch({ args: ['--allow-file-access-from-files'] });
async function open() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e));
  await page.goto(url); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready);
  return page;
}
const [mode, a, b] = process.argv.slice(2);
if (mode === 'stills') {
  const page = await open(); fs.mkdirSync(b, { recursive: true });
  for (const t of a.split(',').map(Number)) { await page.evaluate(t => window.setTime(t), t); fs.writeFileSync(path.join(b, `t${t.toFixed(1).padStart(5, '0')}.png`), await page.screenshot({ type: 'png' })); }
} else if (mode === 'audio-cues') {
  const page = await open(); fs.writeFileSync('audio_cues.json', JSON.stringify(await page.evaluate(() => ({ aud: window.AUD, dur: window.DUR, whoosh: window.WHOOSH, type: [] }))));
} else {
  const page0 = await open(); const DUR = await page0.evaluate(() => window.DUR); await page0.close();
  const NF = Math.round(DUR * FPS), WK = +(b || 4), per = Math.ceil(NF / WK), segs = []; let done = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: WK }, async (_, w) => {
    const page = await open(); const seg = a.replace(/\.mp4$/, `.seg${w}.mp4`); segs[w] = seg;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    const closed = new Promise(r => ff.on('close', r));
    for (let f = w * per; f < Math.min(NF, (w + 1) * per); f++) {
      await page.evaluate(t => window.setTime(t), f / FPS);
      const buf = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (++done % 300 === 0) console.log(`${done}/${NF} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await closed;
  }));
  fs.writeFileSync(a + '.txt', segs.map(s => `file '${path.resolve(s)}'`).join('\n'));
  console.log('done');
}
await browser.close();
