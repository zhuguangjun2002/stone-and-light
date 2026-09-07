// 中世纪工地装备：脚手架、大车轮踏轮吊车（great wheel）、石料堆。
// 只有一套装备，跟随建造动画的"施工前沿"区域移动——模架循环复用，
// 正是中世纪工地的真实做法。

import * as THREE from '../lib/three.module.js';

const WOOD = new THREE.LineBasicMaterial({ color: '#6e5233' });
const WOOD_SOLID = new THREE.MeshStandardMaterial({ color: '#7a5c36', roughness: 0.9 });
const STONE = new THREE.MeshStandardMaterial({ color: '#c7bda8', roughness: 0.95 });
const ROPE = new THREE.LineBasicMaterial({ color: '#3a3226' });

// 单位高度脚手架塔（底面 4×4），用 LineSegments，scale.y 拉到目标高度
function scaffoldTower() {
  const pts = [];
  const s = 2;                       // 半宽
  const levels = 10;                 // 单位高度内的横撑层数（scale 后视觉密度合适）
  const corners = [[-s, -s], [s, -s], [s, s], [-s, s]];
  for (const [x, z] of corners) pts.push(x, 0, z, x, 1, z);          // 立杆
  for (let l = 1; l <= levels; l++) {
    const y = l / levels;
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = corners[i], [x2, z2] = corners[(i + 1) % 4];
      pts.push(x1, y, z1, x2, y, z2);                                 // 横杆
      if (l < levels) pts.push(x1, y, z1, x2, y + 1 / levels, z2);    // 斜撑
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, WOOD);
}

// 大车轮吊车：双柱架 + 踏轮 + 悬臂 + 吊索 + 吊着的石料
function greatWheelCrane() {
  const grp = new THREE.Group();
  const mastG = new THREE.BoxGeometry(0.45, 20, 0.45);
  for (const dz of [-1.4, 1.4]) {
    const m = new THREE.Mesh(mastG, WOOD_SOLID);
    m.position.set(0, 10, dz);
    grp.add(m);
  }
  // 踏轮（两人在轮内行走的绞盘）
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.3, 8, 20), WOOD_SOLID);
  wheel.position.set(0, 4.5, 0);
  wheel.rotation.y = Math.PI / 2;
  grp.add(wheel);
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.6, 0.2), WOOD_SOLID);
    sp.position.set(0, 4.5, 0);
    sp.rotation.x = (i / 6) * Math.PI;
    grp.add(sp);
  }
  // 悬臂伸向建筑一侧（-x），端头吊索
  const jib = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 0.4), WOOD_SOLID);
  jib.position.set(-3.5, 19.5, 0);
  grp.add(jib);
  const strut = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), WOOD_SOLID);
  strut.position.set(-7.5, 19, 0);
  grp.add(strut);
  const ropeG = new THREE.BufferGeometry().setAttribute('position',
    new THREE.Float32BufferAttribute([-7.5, 19.3, 0, -7.5, 12.5, 0], 3));
  grp.add(new THREE.Line(ropeG, ROPE));
  const block = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.9), STONE);
  block.position.set(-7.5, 12, 0);
  grp.add(block);
  return grp;
}

function stonePile() {
  const grp = new THREE.Group();
  const g = new THREE.BoxGeometry(1.3, 0.8, 0.9);
  const spots = [[0, 0.4, 0], [1.5, 0.4, 0.4], [0.7, 0.4, 1.3], [0.8, 1.2, 0.5], [-0.6, 0.4, 1.1]];
  for (const [x, y, z] of spots) {
    const b = new THREE.Mesh(g, STONE);
    b.position.set(x, y, z);
    b.rotation.y = x * 1.7 + z;
    grp.add(b);
  }
  return grp;
}

export function createWorksite() {
  const group = new THREE.Group();
  group.visible = false;

  const scaffS = scaffoldTower();
  const scaffN = scaffoldTower();
  const crane = greatWheelCrane();
  const pile = stonePile();
  group.add(scaffS, scaffN, crane, pile);

  // 施工前沿 → 装备位置。P 在调用时读取，参数重建后自动适应新布局。
  function update(region, P) {
    if (region == null) {
      group.visible = false;
      return;
    }
    group.visible = true;
    let zc = 20, sx = 10.5, h = 32, cx = 19;
    if (region <= 0) { zc = P.choirZ1 + 8; sx = 10.5; h = 30; cx = 19; }
    else if (region === 1) { zc = 10; sx = 19; h = 32; cx = 29; }
    else if (region >= 8) {
      zc = P.naveZ1 + 4;
      sx = P.naveHW + P.arcadeT + P.towerW / 2 - 0.4;
      h = region === 9 ? P.flecheTop - 4 : P.towerH + 6;
      cx = sx + 10;
      if (region === 9) { zc = 6; sx = 5; cx = 19; }
    } else {
      zc = P.naveZ0 + (region - 2) * P.bay + P.bay / 2;
      sx = 10.5; h = 32; cx = 19;
    }
    scaffS.position.set(sx, 0, zc);
    scaffN.position.set(-sx, 0, zc);
    scaffS.scale.y = scaffN.scale.y = h;
    crane.position.set(cx, 0, zc + 3);
    pile.position.set(cx + 3, 0, zc + 8);
  }

  return { group, update };
}
