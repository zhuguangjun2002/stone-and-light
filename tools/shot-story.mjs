// 故事分镜截图：加载 tools/story.html，按 brewStory() 的机位逐幕出 PNG，直接看效果。
// 与 tools/shoot-main.mjs（拍主站）同一套路，只是场景换成故事页。
//
// 用法：
//   node tools/shot-story.mjs                 # 全部 11 幕
//   node tools/shot-story.mjs --beat=mash     # 只拍一幕（可重复）
//   node tools/shot-story.mjs --at=1.5        # 幕内进度（秒），默认拍 2.5 s 处（动效都起来了）
//   node tools/shot-story.mjs --xray=0        # 关掉透视墙体
//   node tools/shot-story.mjs --out=/tmp/x    # 输出目录，默认 /tmp/church-story
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
const PORT = +arg('port', 8251);
const OUT = arg('out', path.join(os.tmpdir(), 'church-story'));
const AT = Number(arg('at', 2.5));
const XRAY = arg('xray', '1');
const [W, H] = arg('size', '1280x720').split('x').map(Number);

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

// 幕 id 列表从 town.js 取（不另抄一份；--beat= 可以只拍其中几幕）
const { brewStory } = await import('../src/town.js');
const story = brewStory();
const only = process.argv.filter((s) => s.startsWith('--beat='))
  .map((s) => s.slice(7));
const shots = only.length ? story.filter((s) => only.includes(s.id)) : story;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: chromeArgs(['--window-size=1280,720']) });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
// 诊断都挂上：tools/ 下的页面用相对路径引 ../lib 与 ../src，
// 少一个 </script> 或引错一个模块都整页不跑，而浏览器只在 console 里轻描淡写一句。
page.on('pageerror', (e) => console.error('PAGE ERR:', e.message));
page.on('console', (m) => console.error(`PAGE[${m.type()}]`, m.text()));
page.on('requestfailed', (r) => console.error('REQ FAIL:', r.url(), r.failure()?.errorText));
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) {
    console.error(`HTTP ${r.status()}: ${r.url()}`);
  }
});
await page.goto(`http://localhost:${PORT}/tools/story.html`, { waitUntil: 'load', timeout: 120000 });
try {
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
} catch (e) {
  console.error('页面没到 __ready。多半是模块加载时报错了——看上面的 PAGE ERR / PAGE CONSOLE。');
  throw e;
}
if (XRAY !== '1') await page.evaluate(() => window.__storyXray(false));

for (const [i, s] of shots.entries()) {
  // 跳到这一幕，推进 AT 秒，让动效跑起来，再定帧。
  // 循环里**每一步都要判停**：__storyStep 一旦推完这一幕就会自动切到下一幕，
  // 不判停的话 at 给大了（比如 10 s > 本幕 8 s）就跑到下一幕去了——出图全是隔幕的镜头。
  await page.evaluate((idx, at, want, dur) => {
    window.__storyPause();
    window.__storyGoto(idx);
    window.__storyPause();
    // 上限压到这一幕的末尾前一帧：__storyStep 推满会自动切到下一幕，
    // 循环里的判停只能挡住"下一帧"，那一帧已经把镜头推出去了（序幕 7 s、at 给 8 s 就串幕）。
    const step = 1 / 60;
    const lim = Math.min(at, dur - step);
    for (let t = 0; t < lim; t += step) {
      if (window.__storyBeat() !== want) break;
      window.__storyStep(step);
    }
  }, story.indexOf(s), AT, s.id, s.dur);
  const file = path.join(OUT, `${String(i).padStart(2, '0')}-${s.id}.png`);
  await page.screenshot({ path: file });
  console.log(`✓ ${file}  ${s.act}｜${s.title}  机位 [${s.cam.pos}]`);
}

await browser.close();
server.close();