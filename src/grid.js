// 射线加速：把全场景的三角形装进一张均匀网格，射线走 3D DDA 逐格试。
// 之前逐网格试包围盒（1200 多次/条射线）再整块试三角形，烘焙只能跑到 ~1800 条/秒；
// 室内的射线四面八方发散，几乎每块网格的包围盒都被穿到，那种做法必然慢。
//
// 特大网格（大地、广场这种上百米的面）不进网格——它们会占满每一格；单独存一份逐条试。
import * as THREE from '../lib/three.module.js';

export function buildGrid(scene, opt = {}) {
  const cell = opt.cell ?? 1.2;
  const maxSpan = opt.maxSpan ?? 120;

  const meshes = [], big = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.depthWrite === false) return;
    const b = new THREE.Box3().setFromObject(o);
    const s = b.getSize(new THREE.Vector3());
    (Math.max(s.x, s.y, s.z) > maxSpan ? big : meshes).push({ obj: o, box: b });
  });

  // ---------- 摊平成世界坐标三角形 ----------
  let triCount = 0;
  for (const { obj } of meshes) {
    const g = obj.geometry;
    triCount += (g.index ? g.index.count : g.attributes.position.count) / 3;
  }
  const V = new Float32Array(triCount * 9);
  const M = new Int32Array(triCount);
  const bbox = new THREE.Box3();
  const a = new THREE.Vector3(), b2 = new THREE.Vector3(), c = new THREE.Vector3();
  let t = 0;
  meshes.forEach(({ obj }, mi) => {
    const g = obj.geometry, pos = g.attributes.position, idx = g.index;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(obj.matrixWorld);
      b2.fromBufferAttribute(pos, i1).applyMatrix4(obj.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(obj.matrixWorld);
      V.set([a.x, a.y, a.z, b2.x, b2.y, b2.z, c.x, c.y, c.z], t * 9);
      M[t] = mi; t++;
      bbox.expandByPoint(a); bbox.expandByPoint(b2); bbox.expandByPoint(c);
    }
  });
  bbox.expandByScalar(0.5);

  // ---------- 装格（计数排序成 CSR） ----------
  const min = bbox.min, size = bbox.getSize(new THREE.Vector3());
  const nx = Math.max(1, Math.ceil(size.x / cell)), ny = Math.max(1, Math.ceil(size.y / cell)),
    nz = Math.max(1, Math.ceil(size.z / cell));
  const nCell = nx * ny * nz;
  const gi = (x, y, z) => (z * ny + y) * nx + x;
  const cx0 = new Int32Array(triCount), cy0 = new Int32Array(triCount), cz0 = new Int32Array(triCount);
  const cx1 = new Int32Array(triCount), cy1 = new Int32Array(triCount), cz1 = new Int32Array(triCount);
  const counts = new Int32Array(nCell + 1);
  const clamp = (v, hi) => (v < 0 ? 0 : v > hi ? hi : v);
  for (let i = 0; i < triCount; i++) {
    const o = i * 9;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k = 0; k < 3; k++) {
      const x = V[o + k * 3], y = V[o + k * 3 + 1], z = V[o + k * 3 + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    cx0[i] = clamp(Math.floor((x0 - min.x) / cell), nx - 1); cx1[i] = clamp(Math.floor((x1 - min.x) / cell), nx - 1);
    cy0[i] = clamp(Math.floor((y0 - min.y) / cell), ny - 1); cy1[i] = clamp(Math.floor((y1 - min.y) / cell), ny - 1);
    cz0[i] = clamp(Math.floor((z0 - min.z) / cell), nz - 1); cz1[i] = clamp(Math.floor((z1 - min.z) / cell), nz - 1);
    for (let z = cz0[i]; z <= cz1[i]; z++) for (let y = cy0[i]; y <= cy1[i]; y++) for (let x = cx0[i]; x <= cx1[i]; x++) counts[gi(x, y, z) + 1]++;
  }
  for (let i = 0; i < nCell; i++) counts[i + 1] += counts[i];
  const items = new Int32Array(counts[nCell]);
  const fill = counts.slice(0, nCell);
  for (let i = 0; i < triCount; i++) {
    for (let z = cz0[i]; z <= cz1[i]; z++) for (let y = cy0[i]; y <= cy1[i]; y++) for (let x = cx0[i]; x <= cx1[i]; x++) items[fill[gi(x, y, z)]++] = i;
  }

  // ---------- 射线：先走网格，再补试特大网格 ----------
  const rc = new THREE.Raycaster();
  const bigHits = [];
  const _o = new THREE.Vector3(), _d = new THREE.Vector3();
  const stamp = new Int32Array(triCount).fill(-1);      // 同一三角形跨多格，一条射线只试一次
  let rayId = 0;

  function hit(ox, oy, oz, dx, dy, dz, far = 1e9) {
    rayId++;
    let tMin = 0, tMax = far;
    // 与网格外框求交，把射线截到框内
    for (const [o, d, lo, hi] of [[ox, dx, min.x, min.x + nx * cell], [oy, dy, min.y, min.y + ny * cell], [oz, dz, min.z, min.z + nz * cell]]) {
      if (Math.abs(d) < 1e-12) { if (o < lo || o > hi) { tMin = Infinity; break; } continue; }
      let t0 = (lo - o) / d, t1 = (hi - o) / d;
      if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
      if (t0 > tMin) tMin = t0;
      if (t1 < tMax) tMax = t1;
      if (tMin > tMax) { tMin = Infinity; break; }
    }
    let best = Infinity, bestTri = -1;
    if (tMin !== Infinity) {
      const px = ox + dx * (tMin + 1e-6), py = oy + dy * (tMin + 1e-6), pz = oz + dz * (tMin + 1e-6);
      let x = clamp(Math.floor((px - min.x) / cell), nx - 1);
      let y = clamp(Math.floor((py - min.y) / cell), ny - 1);
      let z = clamp(Math.floor((pz - min.z) / cell), nz - 1);
      const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
      const dtx = Math.abs(cell / (dx || 1e-12)), dty = Math.abs(cell / (dy || 1e-12)), dtz = Math.abs(cell / (dz || 1e-12));
      const nextEdge = (i, s, o, d) => min[o] + (i + (s > 0 ? 1 : 0)) * cell;
      let tx = Math.abs(dx) < 1e-12 ? Infinity : (min.x + (x + (sx > 0 ? 1 : 0)) * cell - ox) / dx;
      let ty = Math.abs(dy) < 1e-12 ? Infinity : (min.y + (y + (sy > 0 ? 1 : 0)) * cell - oy) / dy;
      let tz = Math.abs(dz) < 1e-12 ? Infinity : (min.z + (z + (sz > 0 ? 1 : 0)) * cell - oz) / dz;
      for (;;) {
        const c0 = gi(x, y, z);
        for (let k = counts[c0]; k < counts[c0 + 1]; k++) {
          const ti = items[k];
          if (stamp[ti] === rayId) continue;
          stamp[ti] = rayId;
          const t = triHit(ti, ox, oy, oz, dx, dy, dz);
          if (t > 1e-4 && t < best) { best = t; bestTri = ti; }
        }
        const tExit = Math.min(tx, ty, tz);
        if (best <= tExit || tExit > tMax) break;
        if (tx <= ty && tx <= tz) { x += sx; tx += dtx; if (x < 0 || x >= nx) break; }
        else if (ty <= tz) { y += sy; ty += dty; if (y < 0 || y >= ny) break; }
        else { z += sz; tz += dtz; if (z < 0 || z >= nz) break; }
      }
    }
    if (big.length) {                                   // 大地、广场：逐块试
      _o.set(ox, oy, oz); _d.set(dx, dy, dz);
      rc.set(_o, _d); rc.far = Math.min(far, best === Infinity ? 1e9 : best);
      for (const { obj } of big) {
        bigHits.length = 0;
        obj.raycast(rc, bigHits);
        for (const h of bigHits) if (h.distance > 1e-4 && h.distance < best) { best = h.distance; bestTri = -2; }
      }
    }
    if (best === Infinity) return null;
    return { t: best, mesh: bestTri >= 0 ? M[bestTri] : -1 };   // mesh = -1 表示打在大地/广场上
  }

  // Möller–Trumbore
  function triHit(i, ox, oy, oz, dx, dy, dz) {
    const o = i * 9;
    const ax = V[o], ay = V[o + 1], az = V[o + 2];
    const e1x = V[o + 3] - ax, e1y = V[o + 4] - ay, e1z = V[o + 5] - az;
    const e2x = V[o + 6] - ax, e2y = V[o + 7] - ay, e2z = V[o + 8] - az;
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (det > -1e-9 && det < 1e-9) return -1;
    const inv = 1 / det;
    const tx = ox - ax, ty = oy - ay, tz = oz - az;
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < -1e-6 || u > 1 + 1e-6) return -1;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < -1e-6 || u + v > 1 + 1e-6) return -1;
    return (e2x * qx + e2y * qy + e2z * qz) * inv;
  }

  return { hit, meshes: meshes.map((m) => m.obj), triCount, cells: nCell, entries: items.length };
}
