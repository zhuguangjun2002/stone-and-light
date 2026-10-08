// 酿酒坊大院的水路：落在八座屋面上的雨，是不是真有一套东西接住、送走、最后离开系统。
// 构件在 src/town.js 的 buildBreweryDrain 里打 userData.brew 标签
// （roof / gutter / spout / channel / culvert / soak），关键几何由 brewInfo().drain 回传。
// 这里只做正向连通校验；雨到底漏不漏，看 tools/check-rain.mjs（整座领地都归它管）。
// 用法：node tools/check-brew.mjs
import * as THREE from '../lib/three.module.js';
import { buildCathedral } from '../src/cathedral.js';
import { brewInfo } from '../src/town.js';

const root = buildCathedral().root;
root.updateMatrixWorld(true);

function brewCheck(root) {
  const D = brewInfo().drain;
  const groups = {};
  root.traverse((o) => { if (o.isMesh && o.userData.brew) (groups[o.userData.brew] ??= []).push(o); });
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
  const DOWN = new THREE.Vector3(0, -1, 0);
  const hitAt = (p, far) => {
    rc.set(p, DOWN); rc.far = far;
    return rc.intersectObjects(meshes, false)[0];
  };
  const tag = (h) => (h ? (h.object.userData.brew || h.object.geometry.type) : '空');

  // 1. 屋面 → 檐沟：每座建筑沿檐口取 5 点——
  //    檐口正下方 0.4 m 内要有檐沟（水落下来有东西接），
  //    檐口正上方 0.3 m 内要有屋面（檐口上头确实盖着瓦）。
  const gutterSet = new Set(groups.gutter || []);
  const roofSet = new Set(groups.roof || []);
  const miss = [];
  let nS = 0, nG = 0, nR = 0;
  for (const r of D.runs) {
    for (let k = 0; k < 5; k++) {
      const t = r.z0 + (r.z1 - r.z0) * (k + 0.5) / 5;
      nS++;
      const h1 = hitAt(new THREE.Vector3(r.eaveX, r.eaveY - 0.3, t), 0.4);
      if (h1 && gutterSet.has(h1.object)) nG++;
      else miss.push(`${r.name}·檐下${t.toFixed(1)}→${tag(h1)}`);
      const h2 = hitAt(new THREE.Vector3(r.eaveX + 0.05, r.eaveY + 0.1, t), 0.3);
      if (h2 && roofSet.has(h2.object)) nR++;
      else miss.push(`${r.name}·檐上${t.toFixed(1)}→${tag(h2)}`);
    }
  }
  add('屋面 → 檐沟：檐口下有沟、檐口上有瓦', nG === nS && nR === nS,
    `${nG}/${nS} 有沟、${nR}/${nS} 有瓦${miss.length ? '，落空 ' + miss.slice(0, 4).join(' ') : ''}`);

  // 2. 檐沟（含集水管）→ 落水管：管顶落在沟里
  const gb = boxes('gutter'), sb = boxes('spout');
  let maxGap = 0;
  for (const p of sb) {
    const c = p.getCenter(new THREE.Vector3());
    maxGap = Math.max(maxGap, Math.min(...gb.map((g) => gapXZ(g, new THREE.Vector3(c.x, 0, c.z)))));
  }
  add('檐沟 → 落水管：每根管顶都落在沟上', sb.length === D.runs.length && maxGap < 0.25,
    `${sb.length} 根管（应为 ${D.runs.length}），管顶离檐沟最大 ${maxGap.toFixed(3)} m`);

  // 3. 落水管 → 明沟：管底低于沟面，且管底正在沟的正上方
  const cb = boxes('channel');
  const bottomMax = sb.length ? Math.max(...sb.map((p) => p.min.y)) : 999;
  let gapChan = 0;
  for (const p of sb) {
    const c = p.getCenter(new THREE.Vector3());
    gapChan = Math.max(gapChan, Math.min(...cb.map((b) => gapXZ(b, new THREE.Vector3(c.x, 0, c.z)))));
  }
  add('落水管 → 明沟：管底能落进沟里', cb.length > 0 && gapChan < 0.25 && bottomMax < D.yChan + 0.1,
    `管底最高 ${bottomMax.toFixed(2)} m（沟面 ${D.yChan} m），离沟最大 ${gapChan.toFixed(3)} m`);

  // 4. 明沟 → 暗管：暗管起点在明沟的东端出口
  const cul = boxes('culvert');
  const outP = new THREE.Vector3(D.outlet.x, 0, D.outlet.z);
  const dCul = cul.length ? Math.min(...cul.map((c) => gapXZ(c, outP))) : 999;
  add('明沟 → 暗管：暗管起点在明沟出口', cul.length > 0 && dCul < 0.4, `离出口 ${dCul.toFixed(3)} m`);

  // 5. 暗管 → 渗井
  const sk = boxes('soak');
  const soakP = new THREE.Vector3(D.soak.x, 0, D.soak.z);
  const dSoak = sk.length ? Math.min(...sk.map((s) => gapXZ(s, soakP))) : 999;
  add('暗管 → 渗井：暗管终点通到渗井', sk.length > 0 && dSoak < 0.2, `离渗井 ${dSoak.toFixed(3)} m`);

  // 6. 终点露天（水从这里离开系统）+ 暗管埋在地下
  const grate = sk.length ? sk.reduce((a, b) => (b.max.y > a.max.y ? b : a)) : null;
  rc.set(new THREE.Vector3(D.soak.x, (grate ? grate.max.y : 0) + 0.05, D.soak.z), new THREE.Vector3(0, 1, 0));
  rc.far = 60;
  const up = rc.intersectObjects(meshes, false)[0];
  add('渗井露天（水从这里离开系统）', !up, up ? `正上方 60 m 内被 ${up.object.geometry.type} 挡住` : '正上方无遮挡');
  const culTop = cul.length ? Math.max(...cul.map((c) => c.max.y)) : 999;
  add('暗管埋在地下（看不见）', culTop < 0.02, `管顶 ${culTop.toFixed(2)} m（地面 0）`);

  return { checks: out, groups };
}

const { checks, groups } = brewCheck(root);
const cnt = (t) => (groups[t] || []).length;
console.log(`—— 酿酒坊水路（正向校验）——`);
for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}  —— ${c.detail}`);
const bad = checks.filter((c) => !c.ok).length;
console.log(`\n构件：roof×${cnt('roof')}  gutter×${cnt('gutter')}  spout×${cnt('spout')}  `
  + `channel×${cnt('channel')}  culvert×${cnt('culvert')}  soak×${cnt('soak')}`);
console.log(bad ? `\n✗ 酿酒坊水路 ${bad} 处不通` : '\n✓ 酿酒坊水路完整：八座屋面的雨全部可被收集并送走');
if (bad) process.exitCode = 1;
