// 烘焙前后的 A/B 对照：两套镶玻方案 × 两个机位 × 烘焙前后，共八张图。
// 用法：node tools/bakeshot.mjs <输出目录>
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] ?? '.';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURI(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(b);
  });
}).listen(8202);
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, protocolTimeout: 1200000,
  args: ['--enable-unsafe-swiftshader','--disable-gpu','--no-sandbox','--hide-scrollbars'] });
const CAMS = [
  { name: 'nave', pos: [-4.5, 5.5, 31], tgt: [6.5, 16, 22], sun: 0.35 },
  { name: 'axis', pos: [0, 6.5, 42], tgt: [0, 15, 12], sun: 0.35 },
];
const BOX = null;   // 整座烘，免得在剖分边界上留下明暗接缝
for (const glaze of ['chartres', 'late']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 640 });
  page.on('pageerror', (e) => console.error('ERR', e.message));
  await page.goto(`http://localhost:8202/tools/bakeshot.html?glazing=${glaze}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__ready === true', { timeout: 180000 });
  for (const c of CAMS) {                                  // 先拍烘焙前
    const d = await page.evaluate((cfg) => window.__shot(cfg), { w: 900, h: 640, ...c });
    fs.writeFileSync(`${OUT}/${glaze}-${c.name}-raw.png`, Buffer.from(d.split(',')[1], 'base64'));
  }
  const t0 = Date.now();
  const st = await page.evaluate((b) => window.__bake({ box: b, rays: 32, bounce: 0.45, floor: 0.28, points: 110 }), BOX);
  console.log(`${glaze} 烘焙：${JSON.stringify(st)}  用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const c of CAMS) {                                  // 再拍烘焙后
    const d = await page.evaluate((cfg) => window.__shot(cfg), { w: 900, h: 640, ...c });
    fs.writeFileSync(`${OUT}/${glaze}-${c.name}-baked.png`, Buffer.from(d.split(',')[1], 'base64'));
  }
  await page.close();
}
await browser.close(); server.close();
