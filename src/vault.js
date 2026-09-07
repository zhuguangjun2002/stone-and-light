// 四分肋拱顶（quadripartite rib vault）。
// 结构逻辑：先立对角肋与横向券（骨架），再在骨架之间填轻薄的蹼面（web）。
// 蹼面把荷载传给肋，肋把荷载集中到四角起拱点——荷载从"面"变成"点"，
// 墙才得以解放成窗。这里蹼面取两个尖筒拱的相贯面：y = max(横向拱, 纵向拱)，
// 与真实十字拱几何一致。矩形开间上两个方向跨度不同，靠调整尖拱曲率 k
// 让两个方向的券拱到同一顶高——这正是尖拱取代半圆拱的根本原因。

import * as THREE from '../lib/three.module.js';
import { archY, archApex, kForApex } from './gothic.js';

// 蹼面网格：开间 [−W/2..W/2]×[−L/2..L/2]，起拱高 springY
function webGeometry(W, L, springY, kW, kL, n = 24) {
  const aW = W / 2, aL = L / 2;
  const verts = [], uvs = [], idx = [];
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const x = -aW + (i / n) * W, z = -aL + (j / n) * L;
      const y = springY + Math.max(archY(x, aW, kW), archY(z, aL, kL));
      verts.push(x, y, z);
      uvs.push(i / n, j / n);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j, b = a + n + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 沿平面直线采样蹼面高度得到肋曲线，再走管几何
function ribAlong(x0, z0, x1, z1, W, L, springY, kW, kL, radius, mat, lift = 0.02) {
  const aW = W / 2, aL = L / 2, pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    const y = springY + Math.max(archY(x, aW, kW), archY(z, aL, kL)) - lift;
    pts.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, radius, 8, false), mat);
  return mesh;
}

// 一跨四分拱顶：W 跨度（x），L 进深（z），apexY 顶高
export function quadripartiteVault(W, L, springY, apexY, mats, opts = {}) {
  const aW = W / 2, aL = L / 2;
  const h = apexY - springY;
  const kW = kForApex(aW, h);   // 两个方向的券调到同一顶高
  const kL = kForApex(aL, h);
  const grp = new THREE.Group();

  const web = new THREE.Mesh(webGeometry(W, L, springY, kW, kL), mats.web);
  grp.add(web);

  const rr = opts.ribR ?? 0.16;
  // 对角肋（十字交叉）
  grp.add(ribAlong(-aW, -aL, aW, aL, W, L, springY, kW, kL, rr, mats.rib));
  grp.add(ribAlong(-aW, aL, aW, -aL, W, L, springY, kW, kL, rr, mats.rib));
  // 横向券（开间分界处，粗一些）
  grp.add(ribAlong(-aW, -aL, aW, -aL, W, L, springY, kW, kL, rr * 1.6, mats.rib));
  grp.add(ribAlong(-aW, aL, aW, aL, W, L, springY, kW, kL, rr * 1.6, mats.rib));
  // 拱顶石（boss）：对角肋交点上的锁石
  const boss = new THREE.Mesh(new THREE.SphereGeometry(rr * 2.6, 10, 8), mats.rib);
  boss.position.set(0, apexY - 0.05, 0);
  grp.add(boss);
  return grp;
}
