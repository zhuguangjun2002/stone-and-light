// 查酒坊屋里的陈设有没有出屋：每件器具必须完整落在自己那座房子的"屋内净空"里
// （四面各留半米墙厚、天花板在脊高以下、地坪在地面以上），且不许跑到别座房子去。
// 器具装在 src/brewery-gear.js，用同一份材料色识别（跟建造动画无关，纯静态几何核对）。
// 用法：node tools/check-gear.mjs
import * as THREE from '../lib/three.module.js';
import { buildCathedral } from '../src/cathedral.js';
import { brewInfo } from '../src/town.js';

const T = 0.5;                    // 墙厚，与 town.js 的 brewHouse 一致

const root = buildCathedral().root;
root.updateMatrixWorld(true);

// 靠 userData.gear 标签认（src/brewery-gear.js 的 solid() 打的），
// 不用按材质颜色猜——器具里有几只桶和地坪共用 oak/wood 一类的料，
// 按颜色认会漏掉它们，也会把地坪（本来就该贴地）算进来。
const items = [];
root.traverse((o) => {
  if (!o.isMesh || !o.userData.gear) return;
  items.push({ o, box: new THREE.Box3().setFromObject(o) });
});

// 哪一座房子装得下这个盒子（要求四边都在屋内、天花板以下、地坪以上）
// 屋内地坪顶面（src/town.js 的 BREW_FLOOR_Y）：器具站在这上面，最低点容许再低 5 cm
//（有些件故意插进地里一点：耙子插在麦芽堆里、酒桶坐进坑里）。
const FLOOR = 0.10;
const fits = (s, b) => b.min.x >= s.x0 + T - 0.02 && b.max.x <= s.x1 - T + 0.02
  && b.min.z >= s.z0 + T - 0.02 && b.max.z <= s.z1 - T + 0.02
  && b.min.y >= FLOOR - 0.05 && b.max.y <= s.h + s.rh - 0.05;

const B = brewInfo().buildings;
const bad = [];
for (const { o, box } of items) {
  const host = B.find((s) => fits(s, box));
  if (!host) {
    // 找最接近的一座，把差在哪个方向说清楚
    let best = null;
    for (const s of B) {
      const over = [];
      if (box.min.x < s.x0 + T - 0.02) over.push(`西 ${(s.x0 + T - box.min.x).toFixed(2)}`);
      if (box.max.x > s.x1 - T + 0.02) over.push(`东 ${(box.max.x - (s.x1 - T)).toFixed(2)}`);
      if (box.min.z < s.z0 + T - 0.02) over.push(`北 ${(s.z0 + T - box.min.z).toFixed(2)}`);
      if (box.max.z > s.z1 - T + 0.02) over.push(`南 ${(box.max.z - (s.z1 - T)).toFixed(2)}`);
      if (box.min.y < FLOOR - 0.05) over.push(`沉地 ${(FLOOR - 0.05 - box.min.y).toFixed(2)}`);
      if (box.max.y > s.h + s.rh - 0.05) over.push(`顶穿 ${(box.max.y - (s.h + s.rh - 0.05)).toFixed(2)}`);
      const score = over.length;
      if (!best || score < best.over.length) best = { s, over };
    }
    const c = (Array.isArray(o.material) ? o.material[0] : o.material).color.getHexString();
    bad.push({ geo: o.geometry.type, col: c, near: best.s.name, why: best.over.join(' / ') || '—' });
  }
}

const perHouse = new Map(B.map((s) => [s.name, 0]));
for (const { o, box } of items) {
  const host = B.find((s) => fits(s, box));
  if (host) perHouse.set(host.name, perHouse.get(host.name) + 1);
}

console.log('—— 酒坊屋内陈设（越界检查）——');
for (const [name, n] of perHouse) console.log(`  ${name.padEnd(12)} 屋内 ${n} 件`);
console.log(`  合计 ${items.length} 件`);
if (!bad.length) {
  console.log('\n✓ 没有器具出屋：都落在自己那座房子的净空里，且不顶穿屋面、不沉到地下');
} else {
  console.log(`\n✗ ${bad.length} 件出屋：`);
  for (const b of bad.slice(0, 20)) {
    console.log(`  ${b.geo} #${b.col}  最近的 ${b.near}：${b.why}`);
  }
  process.exitCode = 1;
}