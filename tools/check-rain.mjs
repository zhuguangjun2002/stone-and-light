// 下雨天哪里漏：撒一场雨，把落进室内的雨滴聚成漏点，并回溯它是从哪个口子钻进来的。
// 判据见 tools/rainscan.js——落点看不看得见天。
// 用法：node tools/check-rain.mjs [--step=1] [--wind=0.35,0] [--top=20] [--json=文件]
//   --doors=closed|wicket|open 门的状态（默认关）
//   --step 是雨滴间距，越细越不容易漏掉窄缝（0.5 m 约 2 万滴、半分钟）
//   --wind 是水平风速与下落速度之比：0,0 是垂直雨（只查水平的洞），
//          0.35,0 相当于风从南边（+x）吹来，能查出侧面的口子。
import * as THREE from '../lib/three.module.js';
import fs from 'node:fs';
import { buildCathedral } from '../src/cathedral.js';
import { drainageInfo } from '../src/town.js';
import { scanLeaks } from './rainscan.js';
import { collectDoors, setDoorState } from '../src/doors.js';

const arg = (k, d) => {
  const a = process.argv.find((s) => s.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const step = Number(arg('step', 0.6));   // 雨滴间距：洞小的时候要调细，1 m 会漏掉窄缝
const wind = arg('wind', '0.35,0').split(',').map(Number);
const TOP = Number(arg('top', 20));
// 只扫一小块（查某处细节时用）：--box=x0,x1,z0,z1
const box = arg('box') ? arg('box').split(',').map(Number) : null;

const scene = new THREE.Group();
const root = buildCathedral().root;
scene.add(root);
// 门的状态：closed / wicket / open。开着门的时候斜雨会从门口灌进来，这一项能量出来
const doorState = arg('doors', 'closed');
const doors = collectDoors(root);
for (const d of doors) setDoorState(d, doorState === 'wicket' && !d.hasWicket ? 'closed' : doorState, true);
const ground = new THREE.Mesh(new THREE.CircleGeometry(600, 48), new THREE.MeshStandardMaterial());
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.25;
ground.userData.tag = '大地'; ground.userData.outdoor = true;
const plaza = new THREE.Mesh(new THREE.PlaneGeometry(110, 190), new THREE.MeshStandardMaterial());
plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, -0.08, 20);
plaza.userData.tag = '广场'; plaza.userData.outdoor = true;
scene.add(ground, plaza);
scene.updateMatrixWorld(true);

const t0 = Date.now();
const it = scanLeaks(scene, { step, wind, entryTop: TOP,
  ...(box ? { x0: box[0], x1: box[1], z0: box[2], z1: box[3] } : {}) });
let r = it.next();
while (!r.done) {
  if (r.value.done % 4000 === 0) process.stderr.write(`\r雨滴 ${r.value.done}/${r.value.total}`);
  r = it.next();
}
process.stderr.write('\r');
const res = r.value;

const desc = (o) => {
  if (!o) return '(没打到)';
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  const b = new THREE.Box3().setFromObject(o);
  return `${o.userData.tag || o.geometry.type} #${m?.color?.getHexString?.() ?? ''} `
    + `包围盒[${b.min.toArray().map((v) => +v.toFixed(1))}]~[${b.max.toArray().map((v) => +v.toFixed(1))}]`;
};
const f2 = (v) => +v.toFixed(2);
const nLeak = [...res.leak].filter((v) => v === 1).length;
const nSusp = [...res.leak].filter((v) => v === 2).length;
const cell = step * step;
console.log(`雨滴 ${res.nx * res.nz} 滴（${step} m 一滴，风 ${wind}，门 ${doorState}），落进室内 ${nLeak} 滴`);
console.log(`= 有效进水面积 ${(nLeak * cell).toFixed(1)} m²；按 20 mm/h 的雨算，${(nLeak * cell * 20).toFixed(0)} 升/小时`);
console.log(`另有 ${nSusp} 滴钻到了屋面下方（半开的夹层，不是封闭室内，但雨本不该进去）`);
console.log(`漏点 ${res.clusters.length} 处，用时 ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);
for (const c of res.clusters.slice(0, TOP)) {
  console.log(`${c.kind === 1 ? '【漏进室内】' : '【钻到屋面下】'}`
    + `${c.area.toFixed(1).padStart(7)} m²  ${String(c.drops).padStart(4)} 滴  `
    + `落点[${c.center.toArray().map(f2)}]  天空可见度 ${c.sky.toFixed(2)}`);
  if (c.entry) console.log(`            雨从这个口子进来：[${c.entry.toArray().map(f2)}]`);
  console.log(`            落在：${desc(c.hit)}`);
}
if (arg('json')) {
  fs.writeFileSync(arg('json'), JSON.stringify({
    step, wind, clusters: res.clusters.map((c) => ({
      area: c.area, drops: c.drops, center: c.center.toArray().map(f2),
      entry: c.entry?.toArray().map(f2) ?? null, hit: desc(c.hit),
    })),
  }, null, 1));
  console.log(`\n→ ${arg('json')}`);
}

// ---------- 正向校验：回廊排水通路 ----------
// 上面查的是"哪里漏"（雨进了不该进的地方）；这一段反过来问：
// "落在回廊屋面上的雨，是不是真有一套东西接住、送走、最后离开系统"。
// 排水构件在 src/town.js 里打了 userData.drain 标签（gutter/pipe/basin/channel/culvert/soak）。
function drainCheck(root) {
  const info = drainageInfo();
  const groups = {};
  root.traverse((o) => { if (o.isMesh && o.userData.drain) (groups[o.userData.drain] ??= []).push(o); });
  const boxes = (t) => (groups[t] || []).map((o) => new THREE.Box3().setFromObject(o));
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const rc = new THREE.Raycaster();
  const out = [];
  const add = (name, ok, detail) => out.push({ name, ok: !!ok, detail });
  const gapXZ = (box, p) => {
    const dx = Math.max(box.min.x - p.x, 0, p.x - box.max.x);
    const dz = Math.max(box.min.z - p.z, 0, p.z - box.max.z);
    return Math.hypot(dx, dz);
  };

  // 1. 屋面 → 内檐沟：檐口正下方应该有檐沟
  const gutterSet = new Set(groups.gutter || []);
  const sides = [
    ['西', (t) => [info.eaveIn.W, info.yIn + 0.05, t], 13.6, 36.8],
    ['东', (t) => [info.eaveIn.E, info.yIn + 0.05, t], 13.6, 36.8],
    ['北', (t) => [t, info.yIn + 0.05, info.eaveIn.N], 21.2, 40.2],
    ['南', (t) => [t, info.yIn + 0.05, info.eaveIn.S], 21.2, 40.2],
  ];
  let nS = 0, nOk = 0;
  const miss = [];
  for (const [side, mk, a, b] of sides) for (let k = 0; k < 6; k++) {
    const t = a + (b - a) * (k + 0.5) / 6;
    rc.set(new THREE.Vector3(...mk(t)), new THREE.Vector3(0, -1, 0)); rc.far = 1.2;
    const h = rc.intersectObjects(meshes, false)[0];
    nS++;
    if (h && gutterSet.has(h.object)) nOk++;
    else miss.push(`${side}${t.toFixed(1)}→${h ? (h.object.userData.drain || h.object.geometry.type) : '空'}`);
  }
  add('屋面 → 内檐沟：檐口正下方都有檐沟', nOk === nS, `${nOk}/${nS} 个取点${miss.length ? '，落空 ' + miss.slice(0, 4).join(' ') : ''}`);

  // 2. 檐沟 → 落水管：管顶落在檐沟上
  const gb = boxes('gutter'), pb = boxes('pipe');
  let maxGap = 0;
  for (const p of pb) {
    const c = p.getCenter(new THREE.Vector3());
    maxGap = Math.max(maxGap, Math.min(...gb.map((g) => gapXZ(g, c))));
  }
  add('檐沟 → 落水管：四根管顶落在檐沟上', pb.length >= 4 && maxGap < 0.25, `${pb.length} 根管，管顶离檐沟最大 ${maxGap.toFixed(3)} m`);

  // 3. 落水管 → 明沟：管底低于明沟面
  const cb = boxes('channel');
  const bottomMax = pb.length ? Math.max(...pb.map((p) => p.min.y)) : 999;
  add('落水管 → 明沟：管底能落进沟', cb.length > 0 && bottomMax < info.yChan + 0.1, `管底最高 ${bottomMax.toFixed(2)} m，明沟面 ${info.yChan} m`);

  // 4. 明沟 → 暗管：暗管起点在明沟出口角
  const cul = boxes('culvert');
  const outCorner = new THREE.Vector3(info.X1, 0, info.Z1);
  const dCul = cul.length ? Math.min(...cul.map((c) => gapXZ(c, outCorner))) : 999;
  add('明沟 → 暗管：暗管起点在明沟出口角', cul.length > 0 && dCul < 0.4, `离出口角 ${dCul.toFixed(3)} m`);

  // 5. 暗管 → 渗井
  const sk = boxes('soak');
  const soakP = new THREE.Vector3(info.soak.x, 0, info.soak.z);
  const dSoak = sk.length ? Math.min(...sk.map((s) => gapXZ(s, soakP))) : 999;
  add('暗管 → 渗井：暗管终点通到渗井', sk.length > 0 && dSoak < 0.2, `离渗井 ${dSoak.toFixed(3)} m`);

  // 6. 终点露天 + 暗管埋地
  const grate = sk.length ? sk.reduce((a, b) => (b.max.y > a.max.y ? b : a)) : null;
  rc.set(new THREE.Vector3(info.soak.x, (grate ? grate.max.y : 0) + 0.05, info.soak.z), new THREE.Vector3(0, 1, 0)); rc.far = 60;
  const up = rc.intersectObjects(meshes, false)[0];
  add('渗井露天（水从这里离开系统）', !up, up ? `正上方 60 m 内被 ${up.object.geometry.type} 挡住` : '正上方无遮挡');
  const culTop = cul.length ? Math.max(...cul.map((c) => c.max.y)) : 999;
  add('暗管埋在地下（看不见）', culTop < 0.02, `管顶 ${culTop.toFixed(2)} m（地面 0）`);

  return out;
}

if (!arg('no-drain')) {
  const checks = drainCheck(root);
  console.log('—— 回廊排水通路（正向校验）——');
  for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}  —— ${c.detail}`);
  const bad = checks.filter((c) => !c.ok).length;
  console.log(bad ? `\n✗ 排水通路 ${bad} 处不通` : '\n✓ 排水通路完整：屋面雨全部可被收集并送走');
  if (bad) process.exitCode = 1;
}
