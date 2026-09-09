// 下雨天哪里漏：撒一场雨，把落进室内的雨滴聚成漏点，并回溯它是从哪个口子钻进来的。
// 判据见 tools/rainscan.js——落点看不看得见天。
// 用法：node tools/check-rain.mjs [--step=1] [--wind=0.35,0] [--top=20] [--json=文件]
//   --step 是雨滴间距，越细越不容易漏掉窄缝（0.5 m 约 2 万滴、半分钟）
//   --wind 是水平风速与下落速度之比：0,0 是垂直雨（只查水平的洞），
//          0.35,0 相当于风从南边（+x）吹来，能查出侧面的口子。
import * as THREE from '../lib/three.module.js';
import fs from 'node:fs';
import { buildCathedral } from '../src/cathedral.js';
import { scanLeaks } from './rainscan.js';

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
scene.add(buildCathedral().root);
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
console.log(`雨滴 ${res.nx * res.nz} 滴（${step} m 一滴，风 ${wind}），落进室内 ${nLeak} 滴`);
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
