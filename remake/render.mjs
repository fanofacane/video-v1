// node render.mjs frames <f1,f2,..|all> <outdir> [dsf]     -> single-sample PNG/JPG stills (frame numbers 1-based)
// node render.mjs video <out.mp4> [subframes]               -> 1920x1080, motion blur by sub-frame averaging
import { createRequire } from 'module';
import { spawn } from 'child_process';
import path from 'path'; import fs from 'fs';
const require = createRequire(import.meta.url);
const pw = require('/opt/node22/lib/node_modules/playwright');
const url = 'file://' + path.resolve('index.html') + '?render';
const NF = 111;
async function open(browser, dsf) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: dsf });
  page.on('pageerror', e => console.error('PAGE ERROR', e)); page.on('console', m => console.log('console:', m.text()));
  await page.goto(url); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready);
  return page;
}
const shot = async (page, f) => { await page.evaluate(f => window.setFrame(f), f); return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1280, height: 720 } }); };
const [mode, a, b, c] = process.argv.slice(2);
const browser = await pw.chromium.launch({ args: ['--allow-file-access-from-files'] });
if (mode === 'frames') {
  const page = await open(browser, +(c || 1)); fs.mkdirSync(b, { recursive: true });
  const list = a === 'all' ? Array.from({ length: NF }, (_, i) => i + 1) : a.split(',').map(Number);
  for (const f of list) fs.writeFileSync(path.join(b, `${String(f).padStart(3, '0')}.png`), await shot(page, f));
} else {
  const SUB = +(b || 8), W = 4, per = Math.ceil(NF / W), segs = [];
  await Promise.all(Array.from({ length: W }, async (_, w) => {
    const page = await open(browser, 1.5);
    const seg = a.replace(/\.mp4$/, `.seg${w}.mp4`); segs[w] = seg;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(30 * SUB), '-c:v', 'png', '-i', '-',
      '-vf', `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/30/TB`, '-r', '30', '-c:v', 'libx264', '-crf', '12', '-preset', 'slow', '-pix_fmt', 'yuv420p', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise(r => ff.on('close', r));
    for (let f = w * per + 1; f <= Math.min(NF, (w + 1) * per); f++)
      for (let k = 0; k < SUB; k++) { // 180-degree shutter centred on the frame
        const buf = await shot(page, f - 0.25 + (k + 0.5) * 0.5 / SUB);
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      }
    ff.stdin.end(); await done;
  }));
  fs.writeFileSync(a + '.txt', segs.map(s => `file '${path.resolve(s)}'`).join('\n'));
  console.log('done');
}
await browser.close();
