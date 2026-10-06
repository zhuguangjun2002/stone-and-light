// 无头 Chrome 的启动参数，取景/检查工具共用一份（`bakeshot` / `check-flicker` /
// `check-poke` / `shoot`）。**抄一份就会漂**——所以只留这一处。
//
// 默认走 SwiftShader：跨机器、跨驱动给出同一套像素，README/HANDOFF 里记录的
// 抖动、穿刺、漏雨基线才对得上（换了显卡基线就变）。
//
// 本机有显卡时设 `CHROME_GPU=1` 改走真 GPU（本机实测 ANGLE→Vulkan→**MX230**，
// 45→35 ms/帧，约快 25%；**Intel 核显反而更慢**，56 ms/帧，别选它）。
// 真 GPU 只用于"看图 / 录片"，不能拿来和记录的基线比。
//
// 注意 `record-tour.mjs` 另有一套（默认 GPU、`--swiftshader` 回退），没并到这里。
export const CHROME = process.env.CHROME ?? '/usr/bin/google-chrome';

const SOFT = ['--enable-unsafe-swiftshader', '--disable-gpu', '--use-gl=swiftshader'];
const HARD = ['--ignore-gpu-blocklist', '--use-angle=vulkan'];

export const useGPU = () => process.env.CHROME_GPU === '1';

/** puppeteer 的 `args`；`extra` 追加给个别页面的特殊开关。 */
export function chromeArgs(extra = []) {
  return [
    ...(useGPU() ? HARD : SOFT),
    '--hide-scrollbars', '--mute-audio', '--no-sandbox',
    ...extra,
  ];
}
