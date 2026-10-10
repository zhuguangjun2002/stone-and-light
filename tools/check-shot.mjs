// 故事机位检查器：每一幕的机位到目标之间有没有被东西挡住，以及挡它的是什么。
// 静态、无浏览器，秒级——先跑它，再开浏览器，省得白等一趟 headless。
//
// 为什么要有：brewStory() 里的机位是**从房屋尺寸现算**的（见 town.js 的 inhouse()），
// 房子一挪、深度一改，机位就可能正对着墙或者站进家具堆里。片子里表现为"镜头一推过去
// 就是一堵墙"，而这个错在浏览器里很难看出来是哪儿错了。
//
// 判据分三档：
//   视线通   —— 目标可见
//   近处挡   —— 目标仍可见，但近处 1/3 路程被挡（画面里会有一坨黑前景）
//   挡死     —— 目标看不见
// 打到目标**自己**（离目标 0.6 m 以内）不算挡：像"招牌"那一幕，镜头就是冲着匾去的，
// 先撞上匾面才对——那就是要看的东西。
//
// 用法：
//   node tools/check-shot.mjs
//   node tools/check-shot.mjs --list     # 连机位坐标一起打出来
import * as THREE from '../lib/three.module.js';
import { buildCathedral } from '../src/cathedral.js';
import { brewStory } from '../src/town.js';

const LIST = process.argv.includes('--list');
const { root } = buildCathedral();
root.updateMatrixWorld(true);

// 只挡"实心"的东西：演示页开 xray 时墙是半透明的，墙不算挡。
// 但屋里那些器具不透明，要算——站进家具堆里一样看不见东西。
function blockerOf(obj) {
  const chain = [];
  let p = obj;
  while (p) {
    if (p.userData && p.userData.brewKey) chain.unshift('屋:' + p.userData.brewKey);
    p = p.parent;
  }
  const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
  const solid = mat && !mat.transparent && mat.opacity !== 0 && mat.depthWrite !== false;
  return { solid, chain: chain.join(' ') };
}

const story = brewStory();
let dead = 0, near = 0;
console.log(`故事机位检查：${story.length} 幕\n`);
for (const s of story) {
  const p = new THREE.Vector3(...s.cam.pos);
  const t = new THREE.Vector3(...s.cam.tgt);
  const dir = t.clone().sub(p);
  const len = dir.length();
  dir.normalize();
  const hits = new THREE.Raycaster(p, dir, 0.001, len).intersectObject(root, true)
    .filter((h) => h.object.visible);

  // 找第一个"实心"的挡。**打到目标自己头上不算挡**——"招牌"那一幕的机位是冲着
  // 匾去的，射线必然先撞上匾面/浮雕，那正是要看的东西。所以近目标的 0.6 m 视为"到了"。
  const REACH = 0.6;
  let solidHit = null;
  for (const h of hits) {
    if (h.distance >= len - REACH) break;      // 已经贴着目标了，后面的都是目标自己
    const b = blockerOf(h.object);
    if (b.solid) { solidHit = { d: h.distance, ...b, geo: h.object.geometry.type }; break; }
  }
  const ratio = solidHit ? solidHit.d / len : Infinity;
  let tag = '视线通', ok = true;
  if (ratio < 0.98) {
    if (ratio > 0.62) { tag = `近处挡（${(ratio * 100) | 0}%）`; near++; }
    else { tag = `挡死（${(ratio * 100) | 0}%）`; dead++; ok = false; }
  }
  console.log(`${ok ? '✓' : '✗'} ${s.id.padEnd(11)} ${s.title.padEnd(18)} 机位→目标 ${len.toFixed(1).padStart(5)} m  ${tag}`
    + (solidHit ? `  [${solidHit.geo} ${solidHit.chain}]` : ''));
  if (LIST) {
    console.log(`      pos [${s.cam.pos.join(', ')}]  tgt [${s.cam.tgt.join(', ')}]`);
  }
}

console.log(`\n近处挡 ${near} 幕、挡死 ${dead} 幕。`);
if (dead) process.exit(1);
console.log('每一幕的目标都看得见 ✓');