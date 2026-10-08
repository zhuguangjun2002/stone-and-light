// 查酒坊屋里的陈设有没有出屋：每件器具必须完整落在自己那座房子的"屋内净空"里
// （四面各留半米墙厚、天花板在脊高以下、地坪在地面以上），且不许跑到别座房子去。
// 再查一遍**门口净空**：门开在西墙正中，门里那条带子不许站东西（否则一开门就进不去）。
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

// —— 门口净空：门开在西墙正中，从门里往屋中那条带子不许站东西 ——
// 第一人称的碰撞是往行进方向在 y = 0.55（腰）与 1.55（头）两档打射线（src/main.js 的
// hitsWall），玩家半径 0.38 —— 所以判据不是"器具离门几米"，是按那两档射线实算：
//   ① 门洞（墙厚 × 门宽 × 门高）里不许有东西：挂进洞里的百叶会把门缝夹窄到 0.56 m；
//   ② 沿门心中线往里至少白走 2.0 m；
//   ③ 器具按 0.38 膨胀后从门口做一遍 BFS，可达面积 ≥ 20%（不许进门就被围死）。
const R = 0.38, WALL = 0.5, RAYS = [0.55, 1.55];
const blocks = (b) => RAYS.some((h) => b.min.y <= h && b.max.y >= h);
const doorBad = [];
console.log('\n—— 门口净空（第一人称能不能走进去）——');
for (const s of B) {
  const cz = (s.z0 + s.z1) / 2;
  const dw = Math.min(3.6, (s.z1 - s.z0) - 3);      // 门宽/门高，与 town.js 的 brewHouse 一致
  const dh = Math.min(3.6, s.h - 1.2);
  const ix0 = s.x0 + T, ix1 = s.x1 - T, iz0 = s.z0 + T, iz1 = s.z1 - T;
  const own = items.filter(({ box }) => box.min.x >= s.x0 - 0.8 && box.max.x <= s.x1 + 0.8
    && box.min.z >= s.z0 - 0.8 && box.max.z <= s.z1 + 0.8);

  // ① 门洞
  const hole = new THREE.Box3(new THREE.Vector3(s.x0 - 0.05, 0, cz - dw / 2),
    new THREE.Vector3(s.x0 + WALL + 0.05, dh, cz + dw / 2));
  const inHole = own.filter(({ box }) => box.clone().intersect(hole)
    .getSize(new THREE.Vector3()).length() > 0.01);

  // ② 中线净深 / ③ 可达面积：挡路的按 0.38 膨胀（玩家半径），再从门口 BFS
  const q = own.filter(({ box }) => blocks(box)).map(({ box }) => ({
    x0: box.min.x - R, x1: box.max.x + R, z0: box.min.z - R, z1: box.max.z + R, box }));
  const hit = (x, z) => q.find((k) => x >= k.x0 && x <= k.x1 && z >= k.z0 && z <= k.z1);
  let clear = ix1 - ix0;
  for (let x = ix0 + R; x < ix1 - R; x += 0.05) { if (hit(x, cz)) { clear = x - (ix0 + R); break; } }

  const cell = 0.2;
  const x0 = ix0 + R, x1 = ix1 - R, z0 = iz0 + R, z1 = iz1 - R;
  const nx = Math.max(1, Math.round((x1 - x0) / cell)), nz = Math.max(1, Math.round((z1 - z0) / cell));
  const free = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    free[i * nz + j] = hit(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell) ? 0 : 1;
  }
  const si = Math.max(0, Math.min(nx - 1, Math.round(0.2 / cell - 0.5)));   // 起点：门内 0.2 m
  const sj = Math.max(0, Math.min(nz - 1, Math.round((cz - z0) / cell - 0.5)));
  const seen = new Uint8Array(nx * nz);
  let area = 0;
  if (free[si * nz + sj]) {
    const st = [[si, sj]]; seen[si * nz + sj] = 1;
    while (st.length) {
      const [i, j] = st.pop(); area += cell * cell;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, c = j + dj;
        if (a < 0 || a >= nx || c < 0 || c >= nz || seen[a * nz + c] || !free[a * nz + c]) continue;
        seen[a * nz + c] = 1; st.push([a, c]);
      }
    }
  }
  const total = nx * nz * cell * cell, ratio = area / total;
  const why = [];
  if (inHole.length) why.push(`门洞里 ${inHole.length} 件`);
  if (clear < 2.0) why.push(`中线净深 ${clear.toFixed(2)} m`);
  if (ratio < 0.2) why.push(`可达只有 ${(ratio * 100).toFixed(0)}%`);
  console.log(`  ${s.name.padEnd(12)} 门洞 ${inHole.length ? `✗${inHole.length} 件` : '清'}   `
    + `中线净深 ${clear.toFixed(2)} m   可达 ${area.toFixed(1)}/${total.toFixed(1)} m² (${(ratio * 100).toFixed(0)}%)`);
  if (why.length) {
    doorBad.push(s.name);
    for (const { box: b } of inHole) {
      console.log(`      门洞里：中心 z 偏门心 ${((b.min.z + b.max.z) / 2 - cz).toFixed(2)}、`
        + `y ${b.min.y.toFixed(2)}…${b.max.y.toFixed(2)}、尺寸 `
        + `${(b.max.x - b.min.x).toFixed(1)}×${(b.max.y - b.min.y).toFixed(2)}×${(b.max.z - b.min.z).toFixed(1)}`);
    }
    for (const k of q) {
      if (k.z0 < cz + dw / 2 && k.z1 > cz - dw / 2 && k.x0 < ix0 + 2.0 + R && !inHole.length) {
        console.log(`      挡中线：x ${k.box.min.x.toFixed(2)}…${k.box.max.x.toFixed(2)}（离内皮 `
          + `${(k.box.min.x - ix0).toFixed(2)}）、z ${k.box.min.z.toFixed(2)}…${k.box.max.z.toFixed(2)}、`
          + `y ${k.box.min.y.toFixed(2)}…${k.box.max.y.toFixed(2)}`);
      }
    }
    console.log(`      → ${why.join(' / ')}`);
  }
}
if (doorBad.length) {
  console.log(`\n✗ ${doorBad.length} 座进不去或走不动：${doorBad.join('、')}`);
  process.exitCode = 1;
} else {
  console.log('\n✓ 8 座都能从门里走进去：门洞里没东西、中线至少白走 2.0 m、可达 ≥ 20%');
}