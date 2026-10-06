// 无头 Chrome 的启动参数，取景/检查工具共用一份（`bakeshot` / `check-flicker` /
// `check-poke` / `shoot`）。**抄一份就会漂**——所以只留这一处。
//
// 默认走**本机显卡**（这台机器上 Chrome 报 ANGLE → NVIDIA Vulkan → **MX230**）：
// `check-flicker` 全扫 24.6 s → 5.3 s，快 4.6 倍；`record-tour.mjs` 也是这个默认。
// `--enable-unsafe-swiftshader` 在这里是**兜底**而不是"强制软渲"——没显卡、驱动不稳、
// 换了台机器时 Chrome 自己回落软件渲染，不会因为拿不到 WebGL 把整条检查链路打断。
//
// 要复现 README 里那套跨机器可复现的 SwiftShader 基线，加 `--swiftshader`（或 `CHROME_SW=1`）：
//
//     node tools/check-flicker.mjs --swiftshader   # 合计抖动 3501 px（可移植基线）
//     node tools/check-flicker.mjs                 # 合计抖动 3547 px（本机 MX230，默认）
//
// 别强制走 Intel 核显：实测 56 ms/帧，比软渲的 45 ms/帧还慢。
export const CHROME = process.env.CHROME ?? '/usr/bin/google-chrome';

const HARD = ['--ignore-gpu-blocklist', '--use-angle=vulkan', '--enable-unsafe-swiftshader'];
const SOFT = ['--enable-unsafe-swiftshader', '--disable-gpu', '--use-gl=swiftshader'];

/** 默认真显卡；`--swiftshader` / `CHROME_SW=1` 退回软渲染。（`CHROME_GPU=1` 仍是显卡，留着不让旧命令失效。） */
export function useGPU() {
  if (process.env.CHROME_SW === '1' || process.argv.includes('--swiftshader')) return false;
  return true;
}

/** puppeteer 的 `args`；`extra` 追加给个别页面的特殊开关。 */
export function chromeArgs(extra = []) {
  return [
    ...(useGPU() ? HARD : SOFT),
    '--hide-scrollbars', '--mute-audio', '--no-sandbox',
    ...extra,
  ];
}
