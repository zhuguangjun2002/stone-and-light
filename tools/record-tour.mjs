// 逐帧录制导览：连到 ?record=1 页面，固定步长推进 __tourStep(1/24)，逐帧截屏。
// 默认走 GPU（实测 0.07 s/帧）；软件渲染 0.9 s/帧，快十几倍——无 GPU 或不稳时加
// --swiftshader 回退。启动参数统一在 tools/chrome-args.mjs（抄一份就会漂）。
import puppeteer from 'puppeteer-core';
import { CHROME, chromeArgs, useGPU } from './chrome-args.mjs';
import fs from 'node:fs';

const FPS = 24;
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: chromeArgs(['--window-size=1280,720']),
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('console', (m) => {
  if (m.type() === 'error') console.error('PAGE:', m.text());
});
await page.goto('http://localhost:8123/?record=1', { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction('typeof window.__tourStep === "function"', { timeout: 60000 });
// 等室内光照烘焙完成，否则片子中途明暗会变
await page.waitForFunction('window.__baked === true', { timeout: 300000 });
console.log('烘焙完成，开始抓帧');
const gpu = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
  const e = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log('渲染器:', gpu, useGPU() ? '(GPU)' : '(软件渲染，慢)');

let i = 0;
let done = false;
const t0 = Date.now();
while (!done && i < FPS * 170) {
  done = await page.evaluate((dt) => window.__tourStep(dt), 1 / FPS);
  await page.screenshot({
    path: `frames/f${String(i).padStart(5, '0')}.jpg`,
    type: 'jpeg',
    quality: 85,
  });
  i++;
  if (i % 240 === 0) {
    const el = (Date.now() - t0) / 1000;
    console.log(`${i} 帧 / ${(i / FPS).toFixed(0)}s 片长 / 已用 ${el.toFixed(0)}s / ${(i / el).toFixed(1)} fps 抓取`);
  }
}
console.log('完成:', i, '帧, 片长', (i / FPS).toFixed(1), '秒');
await browser.close();
fs.writeFileSync('frames/DONE', String(i));
