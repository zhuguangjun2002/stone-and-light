// 修士 NPC 走线检查器：各位修士沿着路由走一圈，身体圆柱别撞进任何构件里、
// 脚也别悬空或陷进地里。静态、无浏览器，秒级。
//
// 用的是**与场景同一套**东西：路由来自 src/walkers.js（buildRoute/pointAt/WALKERS），
// 碰撞网格就是 main.js 里那份（buildGrid(root, {cell:1.4})，关着的门扇先藏起来），
// 所以这里过了，运行时就不会有人穿墙。改了 walkers.js 的路由或 town.js 的布局都要重跑。
//
// 用法：
//   node tools/check-npc.mjs
//   STEP=0.25 node tools/check-npc.mjs     # 采密一点（默认 0.3 m 一点）

import * as THREE from '../lib/three.module.js';
import { buildCathedral } from '../src/cathedral.js';
import { collectDoors } from '../src/doors.js';
import { buildGrid } from '../src/grid.js';
import { WALKERS, buildRoute, pointAt } from '../src/walkers.js';

const STEP = Number(process.env.STEP || 0.30);   // 沿弧长的采样间距（m）
const CLEAR = 0.10;                              // 除身体半径外再留的余量（m）

// 建场景 + 碰撞网格（与 main.js buildCollision 一致：关着的门扇不算障碍，
// 免得"穿过关着的门"被误判成撞墙——不过我们的路由本来就不过门）。
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

let bad = 0, checks = 0;
console.log(`修士 NPC 走线检查：${WALKERS.length} 位，采样间距 ${STEP} m，余量 ${CLEAR} m\n`);
for (const def of WALKERS) {
  const closed = def.closed !== false;
  const route = buildRoute(def.poly, closed);
  const r = def.r ?? 0.40, y0 = def.y ?? 0;
  const span = closed ? route.total : 2 * route.total;   // 开放路要走个来回
  const n = Math.max(8, Math.ceil(span / STEP));
  let minClear = Infinity, minClearAt = null, floorBad = null, voidAt = null;

  for (let i = 0; i < n; i++) {
    const s = (i / n) * span;
    const p = pointAt(route, s);
    checks++;

    // 1) 脚底：从脚上方 2.5 m 竖直往下打，必须打到地坪，且地面高度贴着 def.y
    const down = grid.hit(p.x, y0 + 2.5, p.z, 0, -1, 0, 3.2);
    if (!down) { voidAt = voidAt || { x: p.x, z: p.z }; floorBad = floorBad || { x: p.x, z: p.z, why: '脚下是空的' }; }
    else {
      const footY = y0 + 2.5 - down.t;
      if (footY < y0 - 0.15 || footY > y0 + 0.45) {
        floorBad = floorBad || { x: p.x, z: p.z, footY, want: y0 };
      }
    }

    // 2) 身体圆柱：朝各方向平射，最近的障碍不能近于 r + 余量。
    for (const deg of DIRS) {
      const a = (deg * Math.PI) / 180 + p.heading;   // 相对朝向
      const dx = Math.sin(a), dz = -Math.cos(a);      // 与模型面向 -z 一致
      const h = grid.hit(p.x, y0 + 0.9, p.z, dx, 0, dz, r + CLEAR);
      if (h && h.t < minClear) { minClear = h.t; minClearAt = { x: p.x, z: p.z, deg, t: h.t }; }
    }
  }

  const ok = !floorBad && minClear >= r + CLEAR - 1e-3;
  const tag = ok ? '✓' : '✗';
  console.log(`${tag} ${def.key.padEnd(12)} 周长 ${route.total.toFixed(1)} m  采样 ${n}`
    + `  最近障碍 ${minClear === Infinity ? '∞' : minClear.toFixed(2)} m (需 ≥ ${(r + CLEAR).toFixed(2)})`);
  if (!ok) {
    bad++;
    if (floorBad) console.log(`    · 脚底不对：(${floorBad.x.toFixed(1)}, ${floorBad.z.toFixed(1)})`
      + ` 地面 ${floorBad.footY != null ? floorBad.footY.toFixed(2) : floorBad.why} 期望 ${y0}`);
    if (minClearAt) console.log(`    · 身体蹭到：(${minClearAt.x.toFixed(1)}, ${minClearAt.z.toFixed(1)})`
      + ` 方位 ${minClearAt.deg}° 距离 ${minClearAt.t.toFixed(2)} m`);
  }
}

console.log(`\n共 ${checks} 个采样点。`);
if (bad) { console.error(`${bad} 位修士的走线有问题。`); process.exit(1); }
console.log('修士走线全部畅通 ✓');
