// 葡萄园与酒花圃：两条原料的生产线，也是整个酿造叙事的起点。
//
// 依据见 docs/wine-research.md（葡萄）与 docs/brewery-research.md（酒花）：
//   · 葡萄：中世纪北方的葡萄是"密植不成行 + 矮桩绑扎"（Champagne 考古与圣雷米多联画），
//     不是波尔多高立木、也不是树缠藤（arborée）。所以这里做**矮桩 + 双铁丝 + 藤 + 垂串**，
//     让玩家一眼看得出"这是一行行的葡萄"，而不是又一圈酒花架。
//   · 酒花：采下极难保存运输，历史上酒花圃**永远贴着酒厂**（Weihenstephan 768 年的
//     Hopfengarten 就在修道院"附近"）。所以主圃紧邻服务巷东端，巷边再贴一行。
//
// 果串与球果都走 InstancedMesh：几千个小球若各建独立 Mesh，会把 src/grid.js 的射线网格
// 和七个检查器全拖垮。一份 InstancedMesh = 1 个 draw call、网格里也只当一块。

import * as THREE from '../lib/three.module.js';

// 统一建网格：打 town/buildSkip 标记（领地不进建造动画、不进穿刺检查）。
function solid(geo, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  m.userData.buildSkip = true;
  m.userData.town = true;
  return m;
}

// 一批小球（葡萄果粒 / 酒花球果）合成一个 InstancedMesh。
// items: [[x,y,z,r], ...]，用同一个低面几何，按各自半径缩放。
function balls(geo, mat, items) {
  const im = new THREE.InstancedMesh(geo, mat, items.length);
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  items.forEach(([x, y, z, r], i) => {
    v.set(x, y, z); q.identity(); s.set(r, r, r);
    m4.compose(v, q, s);
    im.setMatrixAt(i, m4);
  });
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = im.receiveShadow = true;
  im.userData.buildSkip = true;
  im.userData.town = true;
  return im;
}

// ---------- 葡萄园 ----------
// 位置 x 56…76 / z -78…-64（领地最东头那一块，正好是新东墙到旧东墙之间空出来的带子）。
// 5 行沿 x（行长 15 m、桩距 2.5 m），行距 2.8 m，双铁丝 0.9 / 1.8，果串垂在下铁丝下。
// **行的起点 z=-65.5 是被挤出来的**：葡萄酒窖北墙在 z=-62，留 3.5 m 当运葡萄的步道，
// 行再往西就撞墙了（原先 z 起点 -60.5，加了葡萄酒窖之后正好穿过它）。
// 地面原来是裸广场，由 buildGround() 补草地。
function buildVineyard(mats, rnd) {
  const g = new THREE.Group();
  const ROWS = 5, Z0 = -65.5, PITCH_Z = 2.8;
  const X0 = 57.5, X1 = 72.5, PITCH_X = 2.5;
  const stakeG = new THREE.BoxGeometry(0.09, 1.9, 0.09);
  // 果粒：低面二十面体，半径 0.07。**不能再小**——0.05 时在阴影里只剩几个像素点，
  // 远看整片园子"没有果子"，那正是要解决的问题。颜色也提亮一档（见 town.js 的 grape）。
  const berryGeo = new THREE.IcosahedronGeometry(0.07, 0);
  const berries = [], berriesW = [];

  for (let r = 0; r < ROWS; r++) {
    const rz = Z0 - r * PITCH_Z;
    // 矮桩
    for (let x = X0; x <= X1 + 1e-6; x += PITCH_X) {
      g.add(solid(stakeG, mats.trunkV, x, 0.95, rz));
    }
    // 两道铁丝（沿 x）。上铁丝略高于藤冠带，免得铁丝埋在叶子里看不见。
    for (const wy of [0.9, 1.8]) {
      g.add(solid(new THREE.BoxGeometry(X1 - X0 + 0.5, 0.025, 0.025), mats.lead, (X0 + X1) / 2, wy, rz));
    }
    // 藤冠：沿上铁丝一道压扁的绿带（读起来就是一行修剪过的葡萄）
    g.add(solid(new THREE.BoxGeometry(X1 - X0 + 0.4, 0.34, 0.30), mats.vine, (X0 + X1) / 2, 1.62, rz));
    // 果串：沿下行铁丝挂下来，每约 0.8 m 一串。每串是一个朝下的锥形果粒堆。
    for (let x = X0 + 0.5; x <= X1 - 0.3; x += 0.8) {
      const white = rnd() < 0.2;                // 零星白葡萄，一色紫会显得是塑料
      const list = white ? berriesW : berries;
      const n = 14 + Math.floor(rnd() * 4);
      for (let b = 0; b < n; b++) {
        const t = b / n;
        const ang = b * 2.39996;               // 黄金角，避免果粒规则排布
        const rad = 0.03 + t * 0.14;
        list.push([x + Math.cos(ang) * rad, 0.86 - t * 0.3, rz + Math.sin(ang) * rad, 1]);
      }
    }
  }
  g.add(balls(berryGeo, mats.grape, berries));
  if (berriesW.length) g.add(balls(berryGeo, mats.grapeW, berriesW));
  // 采收筐 + 一架木梯（都靠葡萄园，人在园里干活）
  const bx = X1 + 0.6;
  for (let i = 0; i < 3; i++) {
    g.add(solid(new THREE.BoxGeometry(0.5, 0.34, 0.4), mats.brewWood, bx + i * 0.55, 0.17, Z0 - 2.0));
  }
  g.add(solid(new THREE.BoxGeometry(0.08, 2.2, 0.06), mats.brewWood, X0 + 0.2, 1.1, Z0 - PITCH_Z * 0.5));
  return g;
}

// ---------- 酒花圃 ----------
// 两处，都贴着酒厂（采下极难保存运输，酒花圃永远在酒厂跟前）：
//   · 主圃 x 56…61 / z -62…-41，两行沿 z，杆在 x 57.6 与 60.0。这一条是**被挤出来的**：
//     原先放在大院东头 x 63…74，加了压榨房（x 62.4…74 / z -46…-32）与葡萄酒窖
//     （x 62.4…75 / z -62…-48）之后整片被占掉；挪到巷子西边这条 5 m 宽的边带，
//     又正好在服务巷东头（LANE.z0 = -40）**以北**，所以碰不到修士动线 x 59.0 / 60.3。
//     行距巷东缘的明沟（x 61.0…61.95）还差 0.75 m，藤冠压到 0.5 m 才让得开。
//   · 巷边一行 x=56.9 / z -28…65，沿服务巷西缘；藤冠也只 0.5 m 宽（净宽只有 1.5 m）。
// 杆高 3.5 m（酒花要爬到 3 m 以上才结得好），顶铁丝 3.3 m 挂球果。
function buildHopYard(mats, rnd) {
  const g = new THREE.Group();
  const coneGeo = new THREE.ConeGeometry(0.06, 0.18, 6);
  coneGeo.rotateX(Math.PI);                    // 球果宽端朝上、尖端朝下，挂在铁丝下
  const cones = [];

  // 一行酒花：竖杆 + 两道铁丝 + 顶端藤带；球果挂顶铁丝下。
  const hopRow = (x, z0, z1, postPitch, canW) => {
    const poleG = new THREE.CylinderGeometry(0.055, 0.08, 3.5, 6);
    for (let z = z0; z <= z1 + 1e-6; z += postPitch) {
      g.add(solid(poleG, mats.timber, x, 1.75, z));
    }
    for (const wy of [1.6, 3.3]) {
      g.add(solid(new THREE.BoxGeometry(0.025, 0.025, z1 - z0 + 0.4), mats.lead, x, wy, (z0 + z1) / 2));
    }
    g.add(solid(new THREE.BoxGeometry(canW, 0.26, z1 - z0 + 0.2), mats.hopLeaf, x, 3.12, (z0 + z1) / 2));
    // 球果：每约 2 m 一小簇，簇内三四颗
    for (let z = z0 + 0.8; z <= z1 - 0.6; z += 2.0) {
      const n = 3 + Math.floor(rnd() * 2);
      for (let b = 0; b < n; b++) {
        cones.push([x + (rnd() - 0.5) * 0.12, 3.0 - rnd() * 0.1, z + (b - n / 2) * 0.09, 1]);
      }
    }
  };

  // 主圃：两行沿 z（葡萄酒窖西边那条边带）
  for (const x of [57.6, 60.0]) hopRow(x, -62, -41, 2.5, 0.5);
  // 巷边一行：藤冠压到 0.5 m（净宽只有 1.5 m，且不能碰修士动线）
  hopRow(56.9, -28, 65, 2.5, 0.5);

  g.add(balls(coneGeo, mats.hopCone, cones));
  return g;
}

export { buildVineyard, buildHopYard };