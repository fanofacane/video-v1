// node render_range.mjs <page.html> <out.mp4> <from_s> <to_s>
import { createRequire } from 'module'; import { spawn } from 'child_process'; import path from 'path';
const require = createRequire(import.meta.url); const pw = require('/opt/node22/lib/node_modules/playwright');
const [page_, out, a, b] = process.argv.slice(2); const FPS = 30;
const browser = await pw.chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('file://' + path.resolve(page_) + '?render'); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready);
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const closed = new Promise(r => ff.on('close', r));
for (let f = Math.round(+a * FPS); f < Math.round(+b * FPS); f++) { await page.evaluate(t => window.setTime(t), f / FPS); const buf = await page.screenshot({ type: 'png' }); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
ff.stdin.end(); await closed; await browser.close(); console.log('done');
