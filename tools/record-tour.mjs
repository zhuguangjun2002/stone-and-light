// 逐帧录制导览：连到 ?record=1 页面，固定步长推进 __tourStep(1/24)，逐帧截屏。
// 默认走 GPU（headless=new + ANGLE→Vulkan，NVIDIA/Intel/AMD 都行）——软件渲染
// （SwiftShader）实测 0.9 s/帧，GPU 只要 0.07 s/帧，快十几倍。
// 无 GPU 或不稳时加 --swiftshader 回退到旧办法。
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const FPS = 24;
const soft = process.argv.includes('--swiftshader');
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: soft ? true : 'new',
  args: soft
    ? ['--enable-unsafe-swiftshader', '--disable-gpu', '--use-gl=swiftshader',
       '--window-size=1280,720', '--hide-scrollbars', '--mute-audio', '--no-sandbox']
    : ['--ignore-gpu-blocklist', '--use-angle=vulkan',
       '--window-size=1280,720', '--hide-scrollbars', '--mute-audio', '--no-sandbox'],
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
console.log('渲染器:', gpu, soft ? '(软件渲染，慢)' : '(GPU)');

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
