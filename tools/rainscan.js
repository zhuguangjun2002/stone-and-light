// 下雨天哪里漏：把雨当成一束平行射线撒下来，看雨滴最后落在哪。
// 判据不是"撞到了什么材质"，而是落点还看不看得见天：
//   落在屋面、地面上 → 抬头就是天（天空可见度高）；
//   落进室内、阁楼里 → 四面八方都被挡住（天空可见度≈0），那就是漏进来的。
// 这样不用给每块网格打标签，也能把"雨本不该到的地方"找出来。
// node 与浏览器共用：scanLeaks 是生成器，可以分片跑，浏览器里不卡帧。
import * as THREE from '../lib/three.module.js';

// 上半球均匀采样的方向（仰角 ≥ minEl，避免贴着地面擦出去）
export function skyDirs(n = 24, minEl = 12 * Math.PI / 180) {
  const out = [], ga = Math.PI * (3 - Math.sqrt(5)), s0 = Math.sin(minEl);
  for (let i = 0; i < n; i++) {
    const s = s0 + (1 - s0) * (i + 0.5) / n, c = Math.sqrt(Math.max(0, 1 - s * s)), az = i * ga;
    out.push(new THREE.Vector3(c * Math.cos(az), s, c * Math.sin(az)));
  }
  return out;
}

// 雨能不能被这块网格挡住：光柱、光斑这类不写深度的纯视觉面片挡不住雨
const blocksRain = (o) => {
  if (!o.isMesh || !o.visible) return false;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  return !!m && m.depthWrite !== false && !m.transparent;
};

export function* scanLeaks(scene, opt = {}) {
  const step = opt.step ?? 1.0;
  const [wx, wz] = opt.wind ?? [0.35, 0];            // 风：水平位移与下落之比
  const x0 = opt.x0 ?? -30, x1 = opt.x1 ?? 30, z0 = opt.z0 ?? -38, z1 = opt.z1 ?? 54;
  const skyThresh = opt.skyThresh ?? 0.03;           // 天空可见度低于此值 = 被围在里面（20 条射线一条也跑不出去）
  const topY = opt.topY ?? 90;                       // 雨从这个高度落下
  const dirs = skyDirs(opt.skyRays ?? 20);
  const chunk = opt.chunk ?? 300;                    // 每片处理多少个雨滴

  const dir = new THREE.Vector3(wx, -1, wz).normalize();
  const targets = [], boxes = [];
  scene.traverse((o) => {
    if (!blocksRain(o)) return;
    targets.push(o); boxes.push(new THREE.Box3().setFromObject(o));
  });

  // 自己做一层包围盒粗筛：three.js 的 intersectObjects 会把所有命中都算出来再排序，
  // 而"挡不挡得住"只要问有没有，撞上第一块就能收工——这一下把天空可见度的开销砍掉大半。
  const rc = new THREE.Raycaster();
  rc.far = opt.far ?? 400;
  const _hits = [];
  const firstHit = (origin, d) => {
    rc.set(origin, d);
    _hits.length = 0;
    for (let i = 0; i < targets.length; i++) {
      if (!rc.ray.intersectsBox(boxes[i])) continue;
      targets[i].raycast(rc, _hits);
    }
    if (!_hits.length) return null;
    let best = _hits[0];
    for (const h of _hits) if (h.distance < best.distance) best = h;
    return best;
  };
  const NEAR = opt.near ?? 1.2;                       // 这么近就撞上 = 贴着面，不是"屋子"
  const probe = (origin, d) => {                     // 最近命中距离；撞得很近就提前收工
    rc.set(origin, d);
    let best = Infinity;
    for (let i = 0; i < targets.length; i++) {
      if (!rc.ray.intersectsBox(boxes[i])) continue;
      _hits.length = 0;
      targets[i].raycast(rc, _hits);
      for (const h of _hits) if (h.distance < best) best = h.distance;
      if (best < NEAR) return best;
    }
    return best;
  };
  // 天空可见度：从落点朝上半球打一圈。看两件事——
  //   open  跑出去的比例：0 = 头顶四面都被挡住
  //   tight 一伸手就撞上的比例：飞券与墙之间那种一指宽的缝，也是"四面被挡住"，
  //         但它不是屋子，雨落在那儿只是积在缝里，不算漏进室内。
  const _o = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  // 起点沿"雨来的方向"退 5 cm：贴着落点起算会被自己这块面挡住，而沿法线退又可能
  // 退进实体里（命中的是背面时法线朝里，那样一圈全被挡住，反倒误判成室内）。
  const sky = (p) => {
    _o.copy(p).addScaledVector(dir, -0.05);
    let esc = 0, near = 0;
    for (const d of dirs) {
      const t = probe(_o, d);
      if (t === Infinity) esc++; else if (t < NEAR) near++;
    }
    return { open: esc / dirs.length, tight: near / dirs.length };
  };
  // 头顶是不是罩着一片东西：正上方 + 一圈 20°/35° 的斜上方，共 9 条。
  // 不能要求"全被挡住"——雨恰恰是从头顶那个口子进来的，正上方那条往往正好跑掉；
  // 也不能只看一条——飞券、券脚从头顶掠过也会挡住。取七成为界。
  const UP = [new THREE.Vector3(0, 1, 0)];
  for (const el of [20, 35]) {
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + (el === 35 ? Math.PI / 4 : 0), t = Math.tan(el * Math.PI / 180);
      UP.push(new THREE.Vector3(t * Math.cos(a), 1, t * Math.sin(a)).normalize());
    }
  }
  const coverFrac = (p) => {
    _o.copy(p).addScaledVector(dir, -0.05);
    let n = 0;
    for (const d of UP) if (probe(_o, d) !== Infinity) n++;
    return n / UP.length;
  };
  const indoors = (f) => f.open < skyThresh && f.tight < (opt.tightMax ?? 0.6);

  const nx = Math.round((x1 - x0) / step) + 1, nz = Math.round((z1 - z0) / step) + 1;
  const total = nx * nz;
  const land = new Float32Array(total * 3).fill(NaN);
  const leak = new Uint8Array(total);
  const skyv = new Float32Array(total).fill(NaN);
  const hitObj = new Array(total).fill(null);
  const t = topY / -dir.y;                           // 从 topY 落到 y=0 要走多远
  const s = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();
  // 落面朝不朝上：雨打在竖墙、玻璃上会顺着流走，只有朝上的面（拱顶背、夹层楼板、
  // 窗台、地坪）才存得住水，也才谈得上"漏"。
  const faceUp = (h) => {
    if (!h.face) return true;
    _n.copy(h.face.normal).applyNormalMatrix(_m3.getNormalMatrix(h.object.matrixWorld)).normalize();
    if (_n.dot(dir) > 0) _n.negate();                  // 法线拧到迎着雨的一侧
    return _n.y > (opt.upMin ?? 0.3);
  };

  let done = 0;
  for (let i = 0; i < total; i++) {
    const ix = i % nx, iz = (i / nx) | 0;
    // 网格整体错开 0.137 m：正好落在开间接缝（z = -13、-20…）上的雨线会平行于两片
    // 端面之间的零宽缝溜过去，报出一堆假漏点——错开一点就不会骑在缝上。
    const x = x0 + ix * step + 0.137, z = z0 + iz * step + 0.137;
    s.set(x - dir.x * t, topY, z - dir.z * t);
    const h = firstHit(s, dir);
    if (h) {
      land[i * 3] = h.point.x; land[i * 3 + 1] = h.point.y; land[i * 3 + 2] = h.point.z;
      hitObj[i] = h.object;
      skyv[i] = 1;
      // 落在大地、广场上的不用问——那本来就是露天的；落在檐口以上的也不用问。
      // 先看头顶有没有罩着（5 条射线，便宜），罩着了再问天空可见度（20 条，贵）。
      if (!h.object.userData.outdoor && h.point.y < (opt.eaveY ?? 30.6) && faceUp(h) && coverFrac(h.point) >= (opt.coverMin ?? 0.9)) {
        const f = sky(h.point);
        skyv[i] = f.open;
        if (f.tight < (opt.tightMax ?? 0.6)) leak[i] = indoors(f) ? 1 : 2;
      }
    }
    if (++done % chunk === 0) yield { done, total };
  }

  // ---------- 漏点聚类（八邻域连通） ----------
  const seen = new Uint8Array(total), clusters = [];
  for (let i = 0; i < total; i++) {
    if (!leak[i] || seen[i]) continue;
    const kind = leak[i];                              // 1 = 落进封闭空间；2 = 钻到屋面下方
    const stack = [i]; seen[i] = 1;
    const cell = [];
    while (stack.length) {
      const k = stack.pop(); cell.push(k);
      const kx = k % nx, kz = (k / nx) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const ax = kx + dx, az = kz + dz;
        if (ax < 0 || az < 0 || ax >= nx || az >= nz) continue;
        const a = az * nx + ax;
        if (leak[a] === kind && !seen[a]) { seen[a] = 1; stack.push(a); }
      }
    }
    const c = new THREE.Vector3(), box = new THREE.Box3();
    for (const k of cell) {
      const p = new THREE.Vector3(land[k * 3], land[k * 3 + 1], land[k * 3 + 2]);
      c.add(p); box.expandByPoint(p);
    }
    c.divideScalar(cell.length);
    clusters.push({ kind, drops: cell.length, area: cell.length * step * step, center: c, box, cells: cell,
      hit: hitObj[cell[0]], sky: skyv[cell[0]] });
  }
  clusters.sort((a, b) => (a.kind - b.kind) || (b.area - a.area));

  // ---------- 找"雨是从哪个口子进来的" ----------
  // 沿雨滴的轨迹从天上往落点二分：天空可见度从高变低的那一段，就是它钻进来的口子。
  for (const cl of clusters.slice(0, opt.entryTop ?? 24)) {
    const p1 = cl.center.clone();
    const p0 = p1.clone().addScaledVector(dir, -(topY - p1.y) / -dir.y);   // 同一条雨线上、天上那一头
    let lo = 0, hi = 1;
    for (let k = 0; k < 9; k++) {
      const mid = (lo + hi) / 2;
      const pm = p0.clone().lerp(p1, mid);
      if (coverFrac(pm) >= (opt.coverMin ?? 0.9)) hi = mid; else lo = mid;
      yield { done, total };
    }
    cl.entry = p0.clone().lerp(p1, hi);
  }

  return { nx, nz, x0, z0, step, dir, land, leak, skyv, hitObj, clusters };
}
