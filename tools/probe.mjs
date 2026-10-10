// check-zfight 的差分探针：跑一遍共面检查，把结果按**去重后的网格对**写出来，
// 用来回答"这轮改动到底有没有新引入共面"。
//
// 为什么不能直接看 check-zfight 报的那个数：地面上那些补丁本来就有 145 对被**记两遍**
// （总面积对不上是重叠区被分块统计），所以"525 → 526"很可能只是同一对被多记了一次。
// 去重的键取「几何类型@中心坐标」，同一对翻来覆去也只留一条，两个状态直接 diff 就干净了。
//
// 用法：
//   node tools/probe.mjs                 # 当前状态 → /tmp/distinct-cur.txt，并打印去重后的对数
//   # 与动工前的基线对比（要手动 stash 一下）：
//   git stash push src/town.js && node tools/probe.mjs && cp /tmp/distinct-cur.txt /tmp/distinct-base.txt
//   git stash pop && node tools/probe.mjs && diff /tmp/distinct-base.txt /tmp/distinct-cur.txt
//   # diff 为空 = 这轮一个共面对都没多。
//
// 注意：它比的是**共面对**，不代替 check-zfight 本身；严格档（0.004 m）仍要看
// `node tools/check-zfight.mjs 0.004 0.2` 的 0 处。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

function run() {
  const r = spawnSync('node', ['tools/check-zfight.mjs'], { encoding: 'utf8', env: { ...process.env, TOP: '3000' } });
  const lines = (r.stdout || '').split('\n');
  const pairs = new Set();
  let raw = 0;
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i].match(/^ +A: (\S+) #[0-9a-f]+ .*?中心\[([\d.-]+),([\d.-]+),([\d.-]+)\]/);
    if (!a) continue;
    const b = (lines[i + 1] || '').match(/^ +B: (\S+) #[0-9a-f]+ .*?中心\[([\d.-]+),([\d.-]+),([\d.-]+)\]/);
    if (!b) continue;
    raw++;
    const A = `${a[1]}@${a[2]},${a[3]},${a[4]}`, B = `${b[1]}@${b[2]},${b[3]},${b[4]}`;
    pairs.add(A < B ? `${A} <-> ${B}` : `${B} <-> ${A}`);
  }
  return { pairs, raw };
}

const { pairs, raw } = run();
fs.writeFileSync('/tmp/distinct-cur.txt', [...pairs].sort().join('\n'));
console.log(`当前去重后：${pairs.size} 对（原始记录 ${raw} 条，重复记录 ${raw - pairs.size} 条）`);