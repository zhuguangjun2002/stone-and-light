// 阴影视锥够不够罩住整片领地：太阳走一天，把每块"投影的 / 接影的"网格的角点投进
// 阴影正交相机的视空间，越界 = 那块地方根本不出影子，地面上会留一道"影子到此为止"
// 的硬边界。领地一扩（墙推远）最先撞的就是这个。
// 静态、无浏览器、几秒跑完。改领地范围 / 太阳轨迹（params.js 的 sunPos）/ P.shadow
// 任一处都要重跑。
// 用法：node tools/check-shadow.mjs
import * as THREE from '../lib/three.module.js';
import { buildCathedral } from '../src/cathedral.js';
import { P, sunPos } from '../src/params.js';

const root = buildCathedral().root;
root.updateMatrixWorld(true);

const casters = [], receivers = [];
root.traverse((o) => { if (o.isMesh) { if (o.castShadow) casters.push(o); if (o.receiveShadow) receivers.push(o); } });
const all = [...new Set([...casters, ...receivers])];

// 包围盒算一次就够（太阳再转也只是换视矩阵）
const boxOf = new Map();
for (const m of all) boxOf.set(m, new THREE.Box3().setFromObject(m));
const cornersOf = new Map();
for (const [m, b] of boxOf) {
  const cs = [];
  if (isFinite(b.min.x)) {
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z])
      cs.push(new THREE.Vector3(x, y, z));
  }
  cornersOf.set(m, cs);
}

const S = P.shadow;
const _v = new THREE.Vector3();
const badCast = new Set(), badRecv = new Set();
let needX = 0, needXt = 0, needY = 0, needYt = 0;
const STEPS = 48;

for (let i = 1; i < STEPS; i++) {
  const t = i / STEPS;
  const cam = new THREE.OrthographicCamera(-S.H, S.H, S.top, S.bottom, S.near, S.far);
  cam.position.copy(sunPos(t, new THREE.Vector3()));
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();

  for (const m of all) {
    let nx = 0, ny = 0, out = false;
    for (const c of cornersOf.get(m)) {
      _v.copy(c).applyMatrix4(cam.matrixWorldInverse);   // 视空间：x 右、y 上，相机看 −z
      nx = Math.max(nx, Math.abs(_v.x));
      ny = Math.max(ny, Math.abs(_v.y));
      const dist = -_v.z;
      if (Math.abs(_v.x) > S.H || _v.y > S.top || _v.y < S.bottom || dist < S.near || dist > S.far) out = true;
    }
    if (out) { if (m.castShadow) badCast.add(m); if (m.receiveShadow) badRecv.add(m); }
    if (nx > needX) { needX = nx; needXt = t; }
    if (ny > needY) { needY = ny; needYt = t; }
  }
}

const tag = (m) => (m.userData.town ? '领地' : '教堂') + ' ' + m.geometry.type;
const where = (set) => {
  const names = [...set].slice(0, 3).map(tag);
  return names.length ? names.join('、') : '无';
};

console.log('—— 阴影视锥覆盖（静态）——');
console.log(`  ${badCast.size ? '✗' : '✓'} 投影的网格都在视锥内  —— `
  + `越界 ${badCast.size}/${casters.length}，${where(badCast)}`);
console.log(`  ${badRecv.size ? '✗' : '✓'} 接影的网格都在视锥内  —— `
  + `越界 ${badRecv.size}/${receivers.length}，${where(badRecv)}`);
console.log(`  视空间需求：x ±${needX.toFixed(0)}（t=${needXt.toFixed(2)}）`
  + `、y ±${needY.toFixed(0)}（t=${needYt.toFixed(2)}）`
  + `　｜　配置 x ±${S.H}、y +${S.top}/${S.bottom}`);
console.log(`  贴图精度：${(2 * S.H)} m / ${S.map} px = ${(2 * S.H / S.map * 100).toFixed(1)} cm/px`
  + `　（太阳半径 170 m，视深 ${S.near}–${S.far} m）`);

const bad = badCast.size + badRecv.size;
console.log(bad
  ? `\n✗ 阴影视锥罩不住：${bad} 块网格在某个时刻会没影子（该加大 P.shadow.H/top/bottom）`
  : '\n✓ 阴影视锥罩住全场景：太阳走一天，没有哪块地方会突然丢影子');
if (bad) process.exitCode = 1;
