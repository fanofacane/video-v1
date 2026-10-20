// node render.mjs stills <t1,t2,..> <outdir>   |   node render.mjs intro <out.mp4>
import { createRequire } from 'module';
import { spawn } from 'child_process';
import path from 'path'; import fs from 'fs';
const require = createRequire(import.meta.url);
const pw = require('/opt/node22/lib/node_modules/playwright');
const url = 'file://' + path.resolve('index.html') + '?render';
const FPS = 30, NF = 258; // intro frames: the hand-off to the real video happens at frame 258 (video frame 27)
const browser = await pw.chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGE ERROR', e));
await page.goto(url); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready);
const shot = async t => { await page.evaluate(t => window.setTime(t), t); return page.screenshot({ type: 'png' }); };
const [mode, a, b] = process.argv.slice(2);
if (mode === 'stills') {
  fs.mkdirSync(b, { recursive: true });
  for (const t of a.split(',').map(Number)) fs.writeFileSync(path.join(b, `t${t.toFixed(2).padStart(5, '0')}.png`), await shot(t));
} else {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-pix_fmt', 'yuv420p', a], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise(r => ff.on('close', r));
  const ph = [];
  for (let f = 0; f < NF; f++) {
    const t = f / FPS; const buf = await shot(t);
    ph.push(await page.evaluate(t => window.playheadAt(t), t));
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await closed;
  fs.writeFileSync('playhead.json', JSON.stringify({ ph, cues: await page.evaluate(() => window.cues) }));
  console.log('done');
}
await browser.close();
