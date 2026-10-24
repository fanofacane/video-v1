// node cover.mjs <outdir>  -> cover_16x9.png (1920x1080) and cover_3x4.png (1080x1440)
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs';
const require = createRequire(import.meta.url); const pw = require('/opt/node22/lib/node_modules/playwright');
const out = process.argv[2] || '../output'; fs.mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ args: ['--allow-file-access-from-files'] });
for (const [v, w, h, name] of [['wide', 1920, 1080, 'cover_16x9.png'], ['tall', 1080, 1440, 'cover_3x4.png']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('file://' + path.resolve('cover.html') + '?v=' + v); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready);
  await page.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: w, height: h } });
}
await browser.close();
