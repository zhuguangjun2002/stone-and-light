// 查"露出来的部分"：某块构件的一小角戳穿了外皮，在大片屋面/墙面当中留下一个孤零零
// 的小色块。做法见 tools/poke.html——把每块网格涂成编号色渲染成 ID 图，找被同一块
// 大面包围的小岛，再打两条射线比深度：小岛与外皮几乎等距 = 真的插在里面。
// 用法：node tools/check-poke.mjs [--size=900x640] [--r=55,90] [--top=20] [--port=8201]
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const arg = (k, d) => {
  const a = process.argv.find((s) => s.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const [W, H] = arg('size', '900x640').split('x').map(Number);
const PORT = +arg('port', 8201);
const TOP = +arg('top', 20);
const GAP = +arg('gap', 0.06);           // 小岛与外皮的距离差小于这个值 = 插进去了（大了就只是贴在前面的构件）
const radii = arg('r', '55,90').split(',').map(Number);
const CENTER = arg('c', '0,22,4').split(',').map(Number);

// 机位：几个半径 × 几圈方位角 × 几个仰角，再加一个正俯视
const views = [];
for (const r of radii) {
  for (const el of [12, 35, 60]) {
    for (let a = 0; a < 360; a += 45) {
      const t = a * Math.PI / 180, e = el * Math.PI / 180;
      views.push({
        pos: [CENTER[0] + r * Math.cos(t) * Math.cos(e), CENTER[1] + r * Math.sin(e), CENTER[2] + r * Math.sin(t) * Math.cos(e)],
        tgt: CENTER, name: `r${r} 方位${a}° 仰角${el}°`,
      });
    }
  }
}
views.push({ pos: [CENTER[0] + 1, CENTER[1] + 80, CENTER[2] + 1], tgt: CENTER, name: '正俯视' });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURI(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(b);
  });
}).listen(PORT);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--disable-gpu', '--use-gl=swiftshader', '--no-sandbox', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
page.on('pageerror', (e) => console.error('PAGE ERR:', e.message));
await page.goto(`http://localhost:${PORT}/tools/poke.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__ready === true', { timeout: 180000 });

const found = new Map();                 // 同一对（小岛, 外皮）在多个机位重复出现，只留最显眼的一次
let scanned = 0;
for (const v of views) {
  const r = await page.evaluate((cfg) => window.__idscan(cfg), { w: W, h: H, pos: v.pos, tgt: v.tgt });
  scanned++;
  process.stderr.write(`\r机位 ${scanned}/${views.length}`);
  for (const isl of r.islands) {
    if (isl.gap > GAP) continue;         // 差得远：只是前面挡着的构件，不是穿刺
    const key = `${isl.islandIdx}_${isl.hostIdx}`;
    const prev = found.get(key);
    if (!prev || isl.px > prev.px) found.set(key, { ...isl, view: v.name });
  }
}
process.stderr.write('\r');
await browser.close();
server.close();

const list = [...found.values()].sort((a, b) => b.px - a.px);
const d = (o) => `${o.tag || o.geo} #${o.col} 包围盒[${o.min}]~[${o.max}]`;
console.log(`${views.length} 个机位 × ${W}×${H}，找到 ${list.length} 处穿刺（外皮当中的孤岛，且与外皮几乎等距）\n`);
for (const p of list.slice(0, TOP)) {
  console.log(`${String(p.px).padStart(5)} px  距相机 ${p.dist} m  与外皮距离差 ${p.gap} m  @ [${p.point}]  （${p.view}）`);
  console.log(`        露出来的：${d(p.island)}`);
  console.log(`        被戳穿的：${d(p.host)}`);
}
