// node cover/render.mjs <out.png> [page.html]  -> 1080x1920 cover
import { createRequire } from 'module'; import path from 'path';
const require = createRequire(import.meta.url); const pw = require('/opt/node22/lib/node_modules/playwright');
const br = await pw.chromium.launch({ args: ['--allow-file-access-from-files'] });
const pg = await br.newPage({ viewport: { width: 1080, height: 1920 } }); pg.on('pageerror', e => console.error('PAGE ERROR', e.message));
await pg.goto('file://' + path.resolve(path.dirname(new URL(import.meta.url).pathname), process.argv[3] || 'cover.html'));
await pg.waitForFunction(() => window.ready); await pg.evaluate(() => window.ready);
await pg.screenshot({ path: process.argv[2] }); await br.close(); console.log('ok');
