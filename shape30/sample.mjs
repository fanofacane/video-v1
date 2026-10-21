// quick preview without motion blur: node sample.mjs out.mp4 fromSec toSec
import { createRequire } from 'module'; import { spawn } from 'child_process'; import path from 'path';
const require = createRequire(import.meta.url); const pw = require('/opt/node22/lib/node_modules/playwright');
const [out, a, b] = process.argv.slice(2), FPS = 30;
const br = await pw.chromium.launch({ args: ['--allow-file-access-from-files'] });
const pg = await br.newPage({ viewport: { width: 1920, height: 1080 } });
await pg.goto('file://' + path.resolve('index.html')); await pg.waitForFunction(() => window.ready); await pg.evaluate(() => window.ready);
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const closed = new Promise(r => ff.on('close', r));
for (let f = Math.round(a * FPS); f < Math.round(b * FPS); f++) {
  await pg.evaluate(t => window.setTime(t), f / FPS); const buf = await pg.screenshot({ type: 'png' });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
}
ff.stdin.end(); await closed; await br.close(); console.log('done');
