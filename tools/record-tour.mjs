// 逐帧录制导览：连到 ?record=1 页面，固定步长推进 __tourStep(1/24)，逐帧截屏。
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const FPS = 24;
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--enable-unsafe-swiftshader', '--disable-gpu',
    '--window-size=1280,720', '--hide-scrollbars', '--mute-audio',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('console', (m) => {
  if (m.type() === 'error') console.error('PAGE:', m.text());
});
await page.goto('http://localhost:8123/?record=1', { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction('typeof window.__tourStep === "function"', { timeout: 60000 });

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
