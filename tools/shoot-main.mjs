// 主站无头截图：加载 index.html（含 NPC、烘焙），等烘焙完成再定点出图，直接看效果。
// 用法：node tools/shoot-main.mjs --at=px,py,pz,tx,ty,tz [--at=...] [--out=/tmp/...]
// 出图默认写到 /tmp/church-main/。
import puppeteer from 'puppeteer-core';
import { CHROME, chromeArgs } from './chrome-args.mjs';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const arg = (k, d) => {
  const a = process.argv.find((s) => s.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const PORT = +arg('port', 8241);
const OUT = arg('out', path.join(os.tmpdir(), 'church-main'));
const [W, H] = arg('size', '1280x720').split('x').map(Number);
const shots = process.argv.filter((s) => s.startsWith('--at=')).map((a) => a.slice(5).split(',').map(Number));
if (!shots.length) { console.error('给出 --at=px,py,pz,tx,ty,tz'); process.exit(1); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURI(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(b);
  });
}).listen(PORT);
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: chromeArgs() });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
page.on('pageerror', (e) => console.error('PAGE ERR:', e.message));
await page.goto(`http://localhost:${PORT}/index.html?bake=0`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__lookAt && window.__walkers', { timeout: 120000 });
// NPC 正面朝我们：先推进一小段，让人别贴着原点站着
await page.evaluate(() => { for (let i = 0; i < 40; i++) window.__walkers.update(0.1); });
for (let i = 0; i < shots.length; i++) {
  const n = shots[i];
  await page.evaluate((c) => window.__lookAt(c[0], c[1], c[2], c[3], c[4], c[5]), n);
  const file = path.join(OUT, `main${i}.png`);
  await page.screenshot({ path: file });
  console.log(`✓ ${file}  at[${n}]`);
}
await browser.close();
server.close();
