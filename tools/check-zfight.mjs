// 静态查 z-fighting：把全场景三角形按支撑平面分桶，找出"几乎共面 + 投影有重叠"的面对。
// 这类面对的深度值几乎相同，谁被画出来由视角/浮点误差决定，走动时就会闪。
// 用法：node tools/check-zfight.mjs [最大间距m] [最小重叠面积m2]
import * as THREE from '../lib/three.module.js';
import { buildCathedral } from '../src/cathedral.js';

const TOL_D = Number(process.argv[2] ?? 0.06);    // 间距小于此值视为"几乎共面"
const MIN_AREA = Number(process.argv[3] ?? 0.20); // 重叠面积小于此值不报
const NORMAL_TOL = 0.03;                          // 法线量化步长（约 1.7°）

// ---------- 场景：教堂 + main.js 里的大地与广场 ----------
const scene = new THREE.Group();
const { root } = buildCathedral();
scene.add(root);
const ground = new THREE.Mesh(new THREE.CircleGeometry(600, 48),
  new THREE.MeshStandardMaterial({ color: '#89906f' }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.25; ground.userData.tag = '大地';
const plaza = new THREE.Mesh(new THREE.PlaneGeometry(110, 190),
  new THREE.MeshStandardMaterial({ color: '#9b968b' }));
plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, -0.08, 20); plaza.userData.tag = '广场';
scene.add(ground, plaza);
scene.updateMatrixWorld(true);

// ---------- 收集世界坐标三角形 ----------
const meshes = [];
const tris = [];
scene.traverse((o) => {
  if (!o.isMesh || !o.geometry?.attributes?.position) return;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!m || m.transparent || m.depthWrite === false) return;   // 不写深度的（光斑/光柱）不会打架
  const id = meshes.length;
  const box = new THREE.Box3().setFromObject(o);
  meshes.push({
    id, obj: o, tag: o.userData.tag || '', geo: o.geometry.type,
    col: m.color?.getHexString?.() ?? '', box,
    ctr: box.getCenter(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)),
  });
  const pos = o.geometry.attributes.position, idx = o.geometry.index;
  const n = idx ? idx.count : pos.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), nv = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld);
    b.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld);
    c.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld);
    ab.subVectors(b, a); ac.subVectors(c, a); nv.crossVectors(ab, ac);
    const len = nv.length();
    if (len < 1e-9) continue;                    // 退化三角形
    nv.divideScalar(len);
    const no = nv.clone();                       // 原始朝向（判断同向/背对背）
    // 法线取正向规范化，使正反两面落进同一个桶
    let s = 0;
    for (const k of ['x', 'y', 'z']) if (Math.abs(nv[k]) > 1e-6) { s = Math.sign(nv[k]); break; }
    if (s < 0) nv.negate();
    tris.push({ mesh: id, p: [a.clone(), b.clone(), c.clone()], n: nv.clone(), no, d: nv.dot(a), area: len / 2 });
  }
});

// ---------- 按 (法线, 平面偏移) 分桶 ----------
const q = (v) => Math.round(v / NORMAL_TOL);
const buckets = new Map();
for (const t of tris) {
  const key = `${q(t.n.x)},${q(t.n.y)},${q(t.n.z)}|${Math.round(t.d / TOL_D)}`;
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(t);
}
// 相邻偏移桶也要比（间距跨桶边界的情况）
const groups = [];
for (const [key, arr] of buckets) {
  const [nk, dk] = key.split('|');
  const nb = buckets.get(`${nk}|${Number(dk) + 1}`);
  groups.push(nb ? arr.concat(nb) : arr);
}

// ---------- 2D 投影 + 三角形裁剪求重叠面积 ----------
function basis(n) {
  const t1 = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  t1.crossVectors(n, t1).normalize();
  return [t1, new THREE.Vector3().crossVectors(n, t1).normalize()];
}
function clipPoly(poly, a, b) {                 // 保留在有向边 a→b 左侧的部分
  const out = [];
  const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], nx = poly[(i + 1) % poly.length];
    const sp = side(p), sn = side(nx);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sn >= 0)) {
      const t = sp / (sp - sn);
      out.push([p[0] + (nx[0] - p[0]) * t, p[1] + (nx[1] - p[1]) * t]);
    }
  }
  return out;
}
function polyArea(p) {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}

const hits = new Map();
let cmp = 0;
for (const g of groups) {
  if (g.length < 2) continue;
  const [u, v] = basis(g[0].n);
  const P = g.map((t) => {
    const pts = t.p.map((p) => [p.dot(u), p.dot(v)]);
    let ccw = 0;
    for (let i = 0; i < 3; i++) { const a = pts[i], b = pts[(i + 1) % 3]; ccw += a[0] * b[1] - b[0] * a[1]; }
    if (ccw < 0) pts.reverse();
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { pts, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    if (g[i].mesh === g[j].mesh) continue;                 // 同一个网格内部不算
    // 只报法线同向的：背对背的两面是两块实体贴在一起的接触面，被包在实体内部，不会闪
    if (g[i].no.dot(g[j].no) < 0.9) continue;
    if (Math.abs(g[i].d - g[j].d) > TOL_D) continue;
    const A = P[i], B = P[j];
    if (A.x1 < B.x0 || B.x1 < A.x0 || A.y1 < B.y0 || B.y1 < A.y0) continue;
    cmp++;
    let poly = A.pts;
    for (let k = 0; k < 3 && poly.length; k++) poly = clipPoly(poly, B.pts[k], B.pts[(k + 1) % 3]);
    if (poly.length < 3) continue;
    const area = polyArea(poly);
    if (area < 1e-4) continue;
    const key = g[i].mesh < g[j].mesh ? `${g[i].mesh}_${g[j].mesh}` : `${g[j].mesh}_${g[i].mesh}`;
    const rec = hits.get(key) || { a: Math.min(g[i].mesh, g[j].mesh), b: Math.max(g[i].mesh, g[j].mesh),
      area: 0, gap: Infinity, box: new THREE.Box3(), n: g[i].n.clone(), pd: g[i].d,
      no: g[i].no.clone(), spot: null };
    if (!rec.spot || area > rec.spotArea) {      // 记下最大一块重叠的重心，用来做可见性判定
      let cx = 0, cy = 0;
      for (const q of poly) { cx += q[0]; cy += q[1]; }
      cx /= poly.length; cy /= poly.length;
      rec.spot = new THREE.Vector3().addScaledVector(u, cx).addScaledVector(v, cy)
        .addScaledVector(g[i].n, g[i].d - g[i].n.dot(new THREE.Vector3().addScaledVector(u, cx).addScaledVector(v, cy)));
      rec.spotArea = area;
    }
    rec.area += area;
    rec.gap = Math.min(rec.gap, Math.abs(g[i].d - g[j].d));
    for (const p of g[i].p) rec.box.expandByPoint(p);
    hits.set(key, rec);
  }
}

// 可见性：从重叠处沿法线出射，0.3 m 内就撞到东西 → 这对面被埋在实体里，看不见也就不会闪
const rc = new THREE.Raycaster();
rc.far = 200;
const BURIED = 0.3;
for (const h of hits.values()) {
  h.visible = true;
  if (!h.spot) continue;
  // 从重叠处朝法线半球打一束射线：只要有一条先撞到背面，说明出发点在实体内部（被埋住）
  const [bu, bv] = basis(h.no);
  const dirs = [h.no.clone()];
  for (const [su, sv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    dirs.push(h.no.clone().addScaledVector(bu, su * 0.6).addScaledVector(bv, sv * 0.6).normalize());
  }
  let inside = false, open = 0;
  for (const d of dirs) {
    rc.set(h.spot.clone().addScaledVector(d, 0.006), d);
    const hit = rc.intersectObject(scene, true).find((x) => x.distance > 0.002
      && x.object !== meshes[h.a].obj && x.object !== meshes[h.b].obj);   // 打架的这两块自己不算遮挡
    if (!hit) { open = Infinity; continue; }
    open = Math.max(open, hit.distance);
    if (hit.face) {
      const wn = hit.face.normal.clone().applyNormalMatrix(
        new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
      if (wn.dot(d) > 0) { inside = true; break; }
    }
  }
  h.clear = open;                       // 半球内最远的一条通路：只要有一条能出去就算露在外面
  h.visible = !inside && open > BURIED;
}
const all = [...hits.values()].filter((h) => h.area >= MIN_AREA);
const list = all.filter((h) => h.visible).sort((x, y) => y.area - x.area);
const buried = all.length - list.length;
console.log(`三角形 ${tris.length}  网格 ${meshes.length}  平面桶 ${buckets.size}  相交测试 ${cmp}`);
console.log(`共面阈值 ${TOL_D} m，最小重叠 ${MIN_AREA} m²  →  露在外面 ${list.length} 处（另有 ${buried} 处被实体埋住，不会闪）\n`);
const TOP = Number(process.env.TOP ?? 40);
for (const h of list.slice(0, TOP)) {
  const A = meshes[h.a], B = meshes[h.b];
  const c = h.box.getCenter(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2));
  const ax = ['x', 'y', 'z'][[Math.abs(h.n.x), Math.abs(h.n.y), Math.abs(h.n.z)].indexOf(Math.max(Math.abs(h.n.x), Math.abs(h.n.y), Math.abs(h.n.z)))];
  const plane = Math.abs(h.n[ax]) > 0.999 ? `${ax} = ${(h.pd / h.n[ax]).toFixed(2)}` : `法线[${h.n.toArray().map((v) => +v.toFixed(2))}] d=${h.pd.toFixed(2)}`;
  console.log(`${h.area.toFixed(1).padStart(7)} m²  间距 ${h.gap.toFixed(3)} m  平面 ${plane}  @ [${c}]`);
  console.log(`          A: ${A.geo} #${A.col} ${A.tag} 中心[${A.ctr}]`);
  console.log(`          B: ${B.geo} #${B.col} ${B.tag} 中心[${B.ctr}]`);
}
