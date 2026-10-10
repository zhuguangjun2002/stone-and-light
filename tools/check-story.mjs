// 故事动线检查器：tools/story.html 里那条故事（酿造小故事）里**走位的修士**
// 沿 brewStory() 给的折线走一遍，身体圆柱别撞进任何构件、脚也别悬空或陷进地里。
// 静态、无浏览器，秒级。
//
// 与 tools/check-npc.mjs 的关系：那位查的是领地里常驻的七位 NPC（src/walkers.js 的
// WALKERS），这里查的是**故事专用的临时动线**（src/town.js 的 brewStory().walk）——
// 同一套 buildRoute/pointAt、同一张碰撞网格、同样的判据，但两者互不相干：
// 改故事动线只会影响这里，改 NPC 路由只会影响那边。
//
// 为什么值得单独一个检查器：故事里的机位与动线是**从数据现算**的，
// 房子挪了位置（BREW 表一改）动线就跟着变，肉眼在演示页里看不出"他其实穿墙了"。
//
// 用法：
//   node tools/check-story.mjs
//   STEP=0.2 node tools/check-story.mjs       # 采密一点（默认 0.3 m 一点）
//   node tools/check-story.mjs --shots        # 顺便把每条动线的机位打出来

import * as THREE from '../lib/three.module.js';
import { buildCathedral } from '../src/cathedral.js';
import { collectDoors } from '../src/doors.js';
import { buildGrid } from '../src/grid.js';
import { buildRoute, pointAt } from '../src/walkers.js';
import { brewStory } from '../src/town.js';

const STEP = Number(process.env.STEP || 0.30);   // 沿弧长的采样间距（m）
const CLEAR = 0.10;                              // 除身体半径外再留的余量（m）
const R = 0.40;                                  // 修士身体半径（与 WALKERS 里那批一致）
const SHOTS = process.argv.includes('--shots');

// 场景 + 碰撞网格（与 main.js buildCollision / check-npc 一致：关着的门扇先藏起来）
const { root } = buildCathedral();
root.updateMatrixWorld(true);
const doors = collectDoors(root);
const hidden = [];
for (const d of doors) for (const p of [...d.leaves, ...d.wickets]) {
  p.traverse((o) => { if (o.isMesh && o.visible) { o.visible = false; hidden.push(o); } });
}
const grid = buildGrid(root, { cell: 1.4 });
for (const o of hidden) o.visible = true;

const DIRS = [0, 25, -25, 55, -55, 90, -90, 130, -130, 180];
const story = brewStory();
const walking = story.filter((s) => s.walk);

let bad = 0, checks = 0;
console.log(`故事动线检查：${story.length} 幕，其中 ${walking.length} 幕有走位。`
  + `采样间距 ${STEP} m，余量 ${CLEAR} m\n`);

for (const beat of story) {
  if (!beat.walk) {
    console.log(`· ${beat.id.padEnd(11)} ${beat.title}（无走位）`);
    continue;
  }
  const route = buildRoute(beat.walk.poly, false);
  const n = Math.max(8, Math.ceil(route.total / STEP));
  let minClear = Infinity, minClearAt = null, floorBad = null;
  const y0 = 0;   // 故事动线全在室外地面（y≈0）

  for (let i = 0; i <= n; i++) {
    const s = (i / n) * route.total;
    const p = pointAt(route, s);
    checks++;

    // 1) 脚底：从脚上方 2.5 m 竖直往下打，必须打到地坪且高度贴着 y0
    const down = grid.hit(p.x, y0 + 2.5, p.z, 0, -1, 0, 3.2);
    if (!down) floorBad = floorBad || { x: p.x, z: p.z, why: '脚下是空的' };
    else {
      const footY = y0 + 2.5 - down.t;
      if (footY < y0 - 0.15 || footY > y0 + 0.45) floorBad = floorBad || { x: p.x, z: p.z, footY };
    }
    // 2) 身体圆柱：十个方位平射，最近障碍不能近于 R + 余量
    for (const deg of DIRS) {
      const a = (deg * Math.PI) / 180 + p.heading;
      const dx = Math.sin(a), dz = -Math.cos(a);
      const h = grid.hit(p.x, y0 + 0.9, p.z, dx, 0, dz, R + CLEAR);
      if (h && h.t < minClear) { minClear = h.t; minClearAt = { x: p.x, z: p.z, deg, t: h.t }; }
    }
  }

  const ok = !floorBad && minClear >= R + CLEAR - 1e-3;
  bad += ok ? 0 : 1;
  console.log(`${ok ? '✓' : '✗'} ${beat.id.padEnd(11)} ${beat.title}`
    + `  长 ${route.total.toFixed(1)} m  采样 ${n + 1}`
    + `  最近障碍 ${minClear === Infinity ? '∞' : minClear.toFixed(2)} m (需 ≥ ${(R + CLEAR).toFixed(2)})`);
  if (SHOTS) {
    for (const [x, z] of beat.walk.poly) console.log(`      折线点 (${x}, ${z})`);
    console.log(`      机位 pos[${beat.cam.pos}] → tgt[${beat.cam.tgt}]`);
  }
  if (!ok) {
    if (floorBad) console.log(`    · 脚底不对：(${floorBad.x.toFixed(1)}, ${floorBad.z.toFixed(1)})`
      + ` 地面 ${floorBad.footY != null ? floorBad.footY.toFixed(2) : floorBad.why} 期望 ${y0}`);
    if (minClearAt) console.log(`    · 身体蹭到：(${minClearAt.x.toFixed(1)}, ${minClearAt.z.toFixed(1)})`
      + ` 方位 ${minClearAt.deg}° 距离 ${minClearAt.t.toFixed(2)} m`);
  }
}

console.log(`\n共 ${checks} 个采样点。`);
if (bad) { console.error(`${bad} 条故事动线有问题。`); process.exit(1); }
console.log('故事动线全部畅通 ✓');