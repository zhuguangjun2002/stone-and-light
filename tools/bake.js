// 顶点色光照烘焙：把"静态的光"离线算完，运行时只查表——游戏里 lightmap 的第一性原理。
//
// 对每个顶点，朝法线所在的半球撒 N 条射线，看它们各自撞到什么：
//   跑出去了      → 天光（这条贡献 1.0，所以露天的面烘出来是白的，画面不变）
//   撞到彩窗      → 窗的颜色 × 透光率 × 增益（窗比天空亮得多）→ 石头被窗子染色
//   撞到别的石头  → 一次弹射的近似：那块材质的固有色 × bounce
// 平均之后写进 geometry 的 color 属性，材质开 vertexColors——运行时零成本。
//
// 太阳不参与烘焙（时刻滑块要能实时变），烘的是天光 + 窗光 + 一次弹射这三样不随时间变的。
import * as THREE from '../lib/three.module.js';
import { GLAZING } from '../src/glass.js';
import { buildGrid } from './grid.js';

// 半球上的一组方向（黄金角螺旋，余弦加权：越贴近法线的方向权重越大）
function hemiDirs(n) {
  const out = [], ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const r = Math.sqrt(t), y = Math.sqrt(Math.max(0, 1 - t));   // 余弦分布
    const a = i * ga;
    out.push(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)));
  }
  return out;
}

export function* bakeVertexLight(scene, opt = {}) {
  const rays = opt.rays ?? 32;
  const bounce = opt.bounce ?? 0.45;          // 一次弹射的强度（石灰石反照率约 0.5，再补一点多次弹射）
  const boost = opt.glassBoost ?? 2.6;        // 窗比天空亮多少倍
  const floor = opt.floor ?? 0.28;            // 最暗到哪，别烘成纯黑
  const box = opt.box ?? null;                // 只烘这个范围里的顶点（其余给白色）
  const chunk = opt.chunk ?? 500;
  const sky = new THREE.Color(opt.skyColor ?? '#cfe0f5');

  // ---------- 射线加速网格 + 每块网格"撞上之后算什么颜色" ----------
  const grid = buildGrid(scene, { cell: opt.cell ?? 1.2 });
  const info = grid.meshes.map((o) => {
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const gz = m?.userData?.glazing;
    return gz
      ? { col: new THREE.Color(GLAZING[gz].tint), k: GLAZING[gz].transmit * boost }
      : { col: (m?.color ?? new THREE.Color('#888888')).clone(), k: bounce };
  });
  const groundInfo = { col: new THREE.Color(opt.groundColor ?? '#8b8d78'), k: bounce };

  // ---------- 逐网格逐顶点 ----------
  const DIRS = hemiDirs(rays);
  const meshes = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !o.geometry.attributes.normal) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.userData?.glazing || m.depthWrite === false) return;   // 玻璃和光柱不烘
    if (!m.isMeshStandardMaterial && !m.isMeshLambertMaterial && !m.isMeshPhongMaterial) return;
    meshes.push(o);
  });

  const p = new THREE.Vector3(), nrm = new THREE.Vector3(), o3 = new THREE.Vector3();
  const t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), dir = new THREE.Vector3();
  const nmat = new THREE.Matrix3();
  const acc = new THREE.Color();
  let done = 0, total = 0, litVerts = 0;
  for (const o of meshes) total += o.geometry.attributes.position.count;

  for (const o of meshes) {
    // 几何体是多处共用的（同一开间的墙复用一份），不克隆的话一处的烘焙结果会串到别处
    if (o.geometry.userData.__bakedBy !== o.uuid) {
      o.geometry = o.geometry.clone();
      o.geometry.userData.__bakedBy = o.uuid;
    }
    const geo = o.geometry, pos = geo.attributes.position, nAttr = geo.attributes.normal;
    const col = new Float32Array(pos.count * 3).fill(1);
    nmat.getNormalMatrix(o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (box && !box.containsPoint(p)) { done++; continue; }    // 范围外留白，画面不变
      nrm.fromBufferAttribute(nAttr, i).applyMatrix3(nmat).normalize();
      // 以法线为轴建一组基
      t1.set(1, 0, 0);
      if (Math.abs(nrm.x) > 0.9) t1.set(0, 1, 0);
      t1.crossVectors(nrm, t1).normalize();
      t2.crossVectors(nrm, t1);
      o3.copy(p).addScaledVector(nrm, 0.02);
      acc.setRGB(0, 0, 0);
      for (const d of DIRS) {
        dir.copy(t1).multiplyScalar(d.x).addScaledVector(nrm, d.y).addScaledVector(t2, d.z).normalize();
        const h = grid.hit(o3.x, o3.y, o3.z, dir.x, dir.y, dir.z);
        if (!h) { acc.add(sky); continue; }                      // 看得见天
        const inf = h.mesh >= 0 ? info[h.mesh] : groundInfo;
        acc.r += inf.col.r * inf.k; acc.g += inf.col.g * inf.k; acc.b += inf.col.b * inf.k;
      }
      acc.multiplyScalar(1 / DIRS.length);
      col[i * 3] = Math.min(1, Math.max(floor, acc.r));
      col[i * 3 + 1] = Math.min(1, Math.max(floor, acc.g));
      col[i * 3 + 2] = Math.min(1, Math.max(floor, acc.b));
      litVerts++;
      if (++done % chunk === 0) yield { done, total };
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }

  // 材质是共用的，开 vertexColors 之前必须保证**每一块**用到这些材质的网格都有 color
  // 属性——缺了的话着色器拿不到属性，会当成黑色，那块网格直接变黑。
  const mats = new Set();
  for (const o of meshes) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) mats.add(m);
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || o.geometry.attributes.color) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (!ms.some((m) => mats.has(m))) return;
    o.geometry = o.geometry.clone();
    const n = o.geometry.attributes.position.count;
    o.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  });
  for (const m of mats) { m.vertexColors = true; m.needsUpdate = true; }

  return { meshes: meshes.length, vertices: total, baked: litVerts };
}
