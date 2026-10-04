// 无头取景：加载 tools/shot.html，按给定机位出 PNG，直接看效果（不经像素采样）。
// 用法：
//   node tools/shoot.mjs --view=1,2                       # 主视角书签（与 main.js 一致）
//   node tools/shoot.mjs --at=0,40,115,0,0,65             # 自定义：px,py,pz,tx,ty,tz
//   node tools/shoot.mjs --at=... --at=... --sun=0.7      # 可重复；--out 指定输出前缀
// 出图默认写到 /tmp/church-shot/。
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const arg = (k, d) => {
  const a = process.argv.find((s) => s.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const VIEWS = {
  1: { pos: [96, 62, 102], tgt: [0, 15, 5], name: 'view1-全景' },
  2: { pos: [0, 24, 122], tgt: [0, 21, 50], name: 'view2-西立面' },
  3: { pos: [0, 7, 44], tgt: [0, 13, -27], name: 'view3-中厅' },
  4: { pos: [2, 5, 26], tgt: [0, 29, 8], name: 'view4-拱顶' },
  5: { pos: [34, 27, 36], tgt: [8, 22, 18], name: 'view5-飞扶壁' },
  6: { pos: [34, 26, -66], tgt: [0, 15, -18], name: 'view6-后殿' },
  7: { pos: [0, 6, 24], tgt: [0, 14, 48], name: 'view7-管风琴' },
  8: { pos: [0, 20, 96], tgt: [0, 16, 0], name: 'view8-横剖面' },
  9: { pos: [96, 20, 6], tgt: [0, 16, 6], name: 'view9-纵剖面' },
};
const PORT = +arg('port', 8231);
const SUN = +arg('sun', 0.55);
const OUT = arg('out', path.join(os.tmpdir(), 'church-shot'));
const [W, H] = arg('size', '1280x720').split('x').map(Number);

const shots = [];
for (const k of arg('views', arg('view', '') || '').split(',').filter(Boolean)) {
  if (VIEWS[k]) shots.push({ ...VIEWS[k], tag: `v${k}` });
}
for (const a of process.argv.filter((s) => s.startsWith('--at='))) {
  const n = a.slice(5).split(',').map(Number);
  if (n.length !== 6) { console.error(`--at 要 6 个数：${a}`); process.exit(1); }
  shots.push({ pos: n.slice(0, 3), tgt: n.slice(3), name: 'custom', tag: `at${shots.length}` });
}
if (!shots.length) { console.error('给出 --view=1,2 或 --at=px,py,pz,tx,ty,tz'); process.exit(1); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURI(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(b);
  });
}).listen(PORT);

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--disable-gpu', '--use-gl=swiftshader',
    '--hide-scrollbars', '--mute-audio', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
page.on('console', (m) => { if (m.type() === 'error') console.error('PAGE:', m.text()); });
page.on('pageerror', (e) => console.error('PAGE ERR:', e.message));
await page.goto(`http://localhost:${PORT}/tools/shot.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__ready === true', { timeout: 180000 });

for (const s of shots) {
  await page.evaluate((cfg) => {
    window.__sunAt(cfg.sun);
    window.__shot(cfg.pos[0], cfg.pos[1], cfg.pos[2], cfg.tgt[0], cfg.tgt[1], cfg.tgt[2]);
  }, { sun: SUN, pos: s.pos, tgt: s.tgt });
  const file = path.join(OUT, `${s.tag}.png`);
  await page.screenshot({ path: file });
  console.log(`✓ ${file}  ${s.name}  pos[${s.pos}] tgt[${s.tgt}]`);
}
await browser.close();
server.close();
