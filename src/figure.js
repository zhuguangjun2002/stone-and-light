// 石像：把一条"下摆 → 肩"的半径曲线沿竖轴**放样（loft）**成一圈壳，再沿周向压出衣褶。
//
// 为什么不是拿几个基本体拼：中世纪门龛上的柱像是**极瘦长**的，下摆微微外张、身子
// 收成一根柱、肩上再收进去，通身竖直的衣褶——这条轮廓线是它的全部性格。锥台 + 球头
// 拼不出这个轮廓（近看是象棋子）。放样只要给一串 [高度, 半径] 控制点，中间插值，
// 想要什么轮廓就有什么轮廓。
//
// 衣褶：把半径沿周向乘一点 cos(nθ)，n 取 5–8。真石像的褶子是竖直的深沟，正好是
// 这个形式；褶深往上收到 0，肩以上就光了。
//
// 每尊像给一个种子：褶数、褶深、身体比例、微微的侧倾都随种子变——真门龛上几十尊
// 像没有两尊一样的，这一点比"一个模型复制几十遍"更接近实物。
import * as THREE from '../lib/three.module.js';
import { mulberry32 } from './materials.js';

// [y/h, r/h]：下摆外张 → 身子收细 → 胸肩略张 → 颈部收紧
// 真柱像的高宽比在 7:1 上下（沙特尔王门那些像高约 2.5 m、宽才 0.35 m），
// 第一版按 3:1 做，看着像保龄球瓶——半径整体收到原来的六成。
const PROFILE = [
  [0.000, 0.089], [0.045, 0.090], [0.120, 0.079], [0.300, 0.069],
  [0.480, 0.064], [0.620, 0.063], [0.720, 0.066], [0.800, 0.067],
  [0.860, 0.061], [0.905, 0.034], [0.935, 0.029],
];

function lerpProfile(t) {
  for (let i = 1; i < PROFILE.length; i++) {
    if (t <= PROFILE[i][0] || i === PROFILE.length - 1) {
      const [y0, r0] = PROFILE[i - 1], [y1, r1] = PROFILE[i];
      const u = Math.min(1, Math.max(0, (t - y0) / (y1 - y0 || 1)));
      return r0 + (r1 - r0) * (u * u * (3 - 2 * u));      // 平滑插值，别出现折角
    }
  }
  return PROFILE[PROFILE.length - 1][1];
}

// 身子：放样壳。RINGS 段 × SEG 边
export function figureBody(h, seed = 1, opts = {}) {
  const rnd = mulberry32(seed);
  const RINGS = opts.rings ?? 26, SEG = opts.seg ?? 14;
  // 宽度系数：7:1 是等身柱像的比例；门楣上那种半米高的小像照这个比例做就成了钉子，
  // 真浮雕里的小像也确实更敦实——按尺寸给它加宽。
  const wide = opts.width ?? 1;
  const folds = 5 + Math.floor(rnd() * 4);          // 褶子道数
  const foldD = 0.085 + rnd() * 0.06;               // 褶子深浅（身子收细了，褶要更深才看得见）
  const phase = rnd() * Math.PI * 2;
  const lean = (rnd() - 0.5) * 0.035;               // 微微侧倾（真像很少笔直）
  const pos = [], idx = [];
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS;
    const y = t * h * 0.94;
    const base = lerpProfile(t) * h * wide;
    const taper = Math.max(0, 1 - Math.max(0, (t - 0.72) / 0.2));   // 褶子到肩收干净
    for (let j = 0; j < SEG; j++) {
      const a = (j / SEG) * Math.PI * 2;
      const r = base * (1 + foldD * taper * Math.cos(folds * a + phase));
      pos.push(Math.cos(a) * r + lean * h * Math.sin(t * Math.PI), y, Math.sin(a) * r * 0.82);
    }
  }
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEG; j++) {
      const a = i * SEG + j, b = i * SEG + (j + 1) % SEG;
      idx.push(a, a + SEG, b, b, a + SEG, b + SEG);   // 绕向要朝外，反了整尊像的法线朝里、看着发黑
    }
  }
  // 下摆封底：壳是开口的，不封住能一眼看穿到里面
  const base = pos.length / 3;
  pos.push(lean * 0, 0, 0);
  for (let j = 0; j < SEG; j++) idx.push(base, (j + 1) % SEG, j);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 一尊完整的像：身子 + 颈头 + 抱在身前的双臂（柱像的手多半捧着书或卷轴）
export function makeStatue(h, mat, opts = {}) {
  const seed = opts.seed ?? 7;
  const rnd = mulberry32(seed * 31 + 5);
  const g = new THREE.Group();
  const body = new THREE.Mesh(figureBody(h, seed, opts), mat);
  g.add(body);
  const wide = opts.width ?? 1;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.022 * wide, h * 0.032 * wide, h * 0.05, 8), mat);
  neck.position.y = h * 0.955;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(h * 0.048 * (0.55 + 0.45 * wide), 12, 10), mat);
  head.position.y = h * 1.02;
  head.scale.set(1, 1.12, 0.92);
  g.add(head);
  if (opts.halo) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.082, h * 0.082, h * 0.012, 14), mat);
    n.rotation.x = Math.PI / 2;
    n.position.set(0, h * 1.03, -h * 0.05);
    g.add(n);
  }
  if (opts.arms !== false) {                        // 双臂抱在身前
    for (const sx of [1, -1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.014, h * 0.018, h * 0.22, 6), mat);
      arm.position.set(sx * h * 0.045, h * 0.73, h * 0.038);
      arm.rotation.set(0.42, 0, sx * 0.2);
      g.add(arm);
    }
    if (rnd() < 0.5) {                              // 一半的像手里捧着书
      const bk = new THREE.Mesh(new THREE.BoxGeometry(h * 0.07, h * 0.09, h * 0.025), mat);
      bk.position.set(0, h * 0.665, h * 0.07);
      bk.rotation.x = 0.35;
      g.add(bk);
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
