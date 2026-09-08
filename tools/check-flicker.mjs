// 动态查闪烁：用 headless Chrome 真渲染，再用"微扰对比"找出画面上不稳定的像素。
// 三种微扰各自对应一种成因（见 tools/flicker.html）：
//   z  改深度量化（屏幕上什么都不动）→ 变了 = 两个面深度打架（z-fighting）
//   c  把剖切面挪 4 mm          → 变了 = 面正好躺在剖切面上，裁剪判据 ≈0，逐像素抖
//   p  相机挪 1 mm（亚像素）    → 变了 = 其他不稳定（透明体排序跳变等）
// 每个抖动斑块再从该像素打一条射线，报出挡在那儿的是哪几块网格。
//
// 用法：node tools/check-flicker.mjs [--views=1,3,7] [--sections=0,1,2] [--size=640x400]
//       [--pos=x,y,z --tgt=x,y,z] [--sun=0.42] [--out=/tmp/flicker] [--port=8123]
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
const VIEWS = {                                   // 与 main.js 的视角书签一致
  1: { pos: [96, 62, 102], tgt: [0, 15, 5], name: '全景 · 东南上空' },
  2: { pos: [0, 24, 122], tgt: [0, 21, 50], name: '西立面' },
  3: { pos: [0, 7, 44], tgt: [0, 13, -27], name: '中厅 · 朝祭坛' },
  4: { pos: [2, 5, 26], tgt: [0, 29, 8], name: '仰望肋拱顶' },
  5: { pos: [34, 27, 36], tgt: [8, 22, 18], name: '飞扶壁' },
  6: { pos: [34, 26, -66], tgt: [0, 15, -18], name: '后殿' },
  7: { pos: [0, 6, 24], tgt: [0, 14, 48], name: '管风琴楼廊' },
  8: { pos: [0, 20, 96], tgt: [0, 16, 0], name: '横剖面正视（剖面图机位）' },
  9: { pos: [96, 20, 6], tgt: [0, 16, 6], name: '纵剖面正视（剖面图机位）' },
};
const SEC_NAME = ['完整外观', '横剖面 z=27', '纵剖面 x=0'];
const CAUSE = { z: 'z-fighting 深度打架', c: '面躺在剖切面上（裁剪抖动）', p: '视点微动不稳定' };

const PORT = +arg('port', 8199);
const [W, H] = arg('size', '640x400').split('x').map(Number);
const OUT = arg('out', path.join(os.tmpdir(), 'church-flicker'));
const SUN = +arg('sun', 0.42);
const custom = arg('pos') ? { pos: arg('pos').split(',').map(Number), tgt: arg('tgt', '0,15,0').split(',').map(Number), name: '自定义机位' } : null;
const views = custom ? { c: custom } : Object.fromEntries(
  arg('views', '1,3,4,7,8,9').split(',').map((k) => [k, VIEWS[k]]).filter(([, v]) => v));
const sections = arg('sections', '0,1,2').split(',').map(Number);

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
await page.goto(`http://localhost:${PORT}/tools/flicker.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__ready === true', { timeout: 180000 });

const probeAt = arg('probe') ? arg('probe').split(',').map(Number) : null;
let grand = 0;
for (const s of sections) {
  for (const [k, v] of Object.entries(views)) {
    if (probeAt) {                                  // 只查一个像素上压着什么，不做扫描
      const hits = await page.evaluate((cfg, x, y) => window.__probe(cfg, x, y),
        { w: W, h: H, pos: v.pos, tgt: v.tgt, section: s, sunT: SUN }, probeAt[0], probeAt[1]);
      console.log(`\n=== ${SEC_NAME[s]} · 视角${k} ${v.name} — 像素[${probeAt}] 上压着：`);
      for (const h of hits) {
        const t = [h.transparent ? '透明' : '', h.depthWrite ? '' : '不写深度'].filter(Boolean).join('/');
        console.log(`      ${String(h.d).padStart(8)} m  ${h.tag || h.geo} #${h.col} ${t}  命中点[${h.p}]  包围盒[${h.min}]~[${h.max}]`);
      }
      continue;
    }
    const r = await page.evaluate((cfg) => window.__scan(cfg),
      { w: W, h: H, pos: v.pos, tgt: v.tgt, section: s, sunT: SUN, top: 12 });
    const pct = (100 * r.flagged / r.total).toFixed(2);
    const file = path.join(OUT, `s${s}-v${k}.png`);
    fs.writeFileSync(file, Buffer.from(r.png.split(',')[1], 'base64'));
    grand += r.flagged;
    console.log(`\n=== ${SEC_NAME[s]} · 视角${k} ${v.name} — 抖动像素 ${r.flagged}/${r.total}（${pct}%），${r.clusters.length} 处斑块`);
    console.log(`    标注图（红=抖动）：${file}`);
    for (const c of r.clusters) {
      console.log(`  ▸ ${String(c.pixels).padStart(5)} px  屏幕[${c.center}]  成因：${c.causes.map((x) => CAUSE[x]).join(' + ')}`);
      for (const h of c.hits) {
        const t = [h.transparent ? '透明' : '', h.depthWrite ? '' : '不写深度'].filter(Boolean).join('/');
        console.log(`      ${String(h.d).padStart(8)} m  ${h.tag || h.geo} #${h.col} ${t}  命中点[${h.p}]  包围盒[${h.min}]~[${h.max}]`);
      }
    }
  }
}
console.log(`\n合计抖动像素 ${grand}`);
await browser.close();
server.close();
