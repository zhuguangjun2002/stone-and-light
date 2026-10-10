// 逐帧录制「酿造小故事」：连到 tools/story.html，固定步长推进 __storyStep(1/24)，
// 逐帧截屏，再由 ffmpeg 合成 mp4（命令见文件末尾，README 里也有一份）。
//
// 与 tools/record-tour.mjs 一个路子（那支录的是主站导览），区别有两处：
//   · 页面自带时间轴（brewStory()），所以**不用等 __baked**——故事页没有烘焙，
//     而且屋里的器具本来就靠自发光补光（HDR 烘焙只对主站有意义）。
//   · 每帧都判一次"还在这一幕里吗"：故事走完会自动切下一幕，判晚了整支片子会串幕。
//
// 默认走 GPU（本机 MX230 约 15 fps）。没显卡或不稳时加 --swiftshader。
import puppeteer from 'puppeteer-core';
import { CHROME, chromeArgs, useGPU } from './chrome-args.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const a = process.argv.find((s) => s.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const FPS = Number(arg('fps', 24));
const OUT = arg('out', 'storyframes');
const W = Number(arg('w', 1280)), H = Number(arg('h', 720));
const PORT = Number(arg('port', 8281));

const ROOT = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURI(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(b);
  });
}).listen(PORT);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: chromeArgs(['--window-size=1280,720']),
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
page.on('pageerror', (e) => console.error('PAGE ERR:', e.message));
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) console.error(`HTTP ${r.status()}: ${r.url()}`);
});
await page.goto(`http://localhost:${PORT}/tools/story.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__ready === true', { timeout: 120000 });

const total = await page.evaluate(() => window.__storyTotal());
const want = Math.ceil(total * FPS);
console.log(`故事总长 ${total.toFixed(1)} s，${FPS} fps → ${want} 帧`);

const gpu = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
  const e = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log('渲染器:', gpu, useGPU() ? '(GPU)' : '(软件渲染，慢)');

// 字幕与进度条：录片子里不该有 UI。
// **并且必须先暂停页面自己的 rAF 循环**：story.html 用 setAnimationLoop 一直在按真实时间
// 推进故事，而下面每帧又显式调 __storyStep(1/fps)——两路一起走，进度是二倍速
// （实测 91 s 的故事 45 s 就"演完"了，每一幕只有原定时长的三分之一）。
await page.evaluate(() => {
  window.__storyPause();
  for (const id of ['ui', 'bar', 'hint']) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
});

const t0 = Date.now();
let i = 0, beat = '', done = false;
while (!done && i < want) {
  const r = await page.evaluate((dt) => {
    const b = window.__storyBeat();
    window.__storyStep(dt);
    return { b, beat: window.__storyBeat(), done: window.__storyDone() };
  }, 1 / FPS);
  if (r.b !== beat) { beat = r.b; console.log(`  ${(i / FPS).toFixed(1)}s  ${beat}`); }
  done = r.done;
  await page.screenshot({
    path: path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`),
    type: 'jpeg', quality: 88,
  });
  i++;
  if (i % (FPS * 20) === 0) {
    const el = (Date.now() - t0) / 1000;
    console.log(`${i} 帧 / ${(i / FPS).toFixed(0)}s / 已用 ${el.toFixed(0)}s / ${(i / el).toFixed(1)} fps`);
  }
}
await browser.close();
server.close();
console.log(`完成：${i} 帧，片长 ${(i / FPS).toFixed(1)} s → ${OUT}/`);

console.log(`\n合成视频：\n  ffmpeg -framerate ${FPS} -i ${OUT}/f%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 24 docs/story.mp4`);