// 西立面：哥特立面的"标准答案"——双塔 + 三门廊 + 玫瑰窗 + 山墙。
// 三座门对应中厅与两侧廊（平面直接写在立面上）；玫瑰窗给中厅轴线送光；
// 双塔在结构上压稳立面，在城市里是远眺的地标。

import * as THREE from '../lib/three.module.js';
import { wallWithOpenings, openingGlassGeometry, gableGeometry, makePinnacle, archApex } from './gothic.js';

// 玫瑰窗组件：石环 + 放射辐条 + 玻璃盘
export function roseAssembly(r, mats, roseMat) {
  const grp = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.42, 10, 40), mats.stoneLight);
  grp.add(ring);
  const spokeG = new THREE.BoxGeometry(0.22, r * 0.95, 0.3);
  for (let i = 0; i < 12; i++) {
    const sp = new THREE.Mesh(spokeG, mats.stoneLight);
    sp.position.set(Math.cos((i / 12) * Math.PI * 2) * r * 0.5, Math.sin((i / 12) * Math.PI * 2) * r * 0.5, 0);
    sp.rotation.z = (i / 12) * Math.PI * 2 + Math.PI / 2;
    grp.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.TorusGeometry(r * 0.3, 0.22, 8, 24), mats.stoneLight);
  grp.add(hub);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(r, 40), roseMat);
  glass.position.z = -0.18;
  grp.add(glass);
  return grp;
}

// 层叠退缩的尖拱门廊（voussoir 层层内收），朝 +z
export function portal(a, springY, mats, layers = 3, sillBack = layers * 0.8 + 0.2) {
  const grp = new THREE.Group();
  // 门槛地坪：层叠的几道墙都从 y=0 起，洞口底边各自生成一片 y=0 的水平面，
  // 彼此完全共面（stone / stoneLight 两种颜色打架），走近时忽明忽暗、发惨白。
  // 用一块实心门槛把它们全压在下面，同时把室内铺地接到门口。
  const sill = new THREE.Mesh(new THREE.BoxGeometry(a * 2 + 0.8, 0.2, sillBack + 0.15), mats.floor);
  sill.position.set(0, -0.05, 0.075 - sillBack / 2);
  sill.receiveShadow = true;
  sill.userData.floorUV = true;
  sill.userData.buildFirst = true;
  grp.add(sill);
  for (let i = 0; i < layers; i++) {
    const ai = a - i * 0.55;
    const g = wallWithOpenings((a + 0.8) * 2, 0, springY + archApex(ai, 1.3) + 1.2, 0.8,
      [{ cx: 0, a: ai, y0: 0, springY: springY - i * 0.7, k: 1.3 }]);
    const m = new THREE.Mesh(g, i === 0 ? mats.stone : mats.stoneLight);
    m.position.z = -i * 0.8;
    m.castShadow = true;
    grp.add(m);
  }
  // 门扇（暗色）
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry((a - layers * 0.55) * 2 + 0.6, springY),
    mats.door);
  door.position.set(0, springY / 2, -layers * 0.8 + 0.1);
  grp.add(door);
  // 门上山花
  const gable = new THREE.Mesh(gableGeometry(a + 0.8, springY + archApex(a, 1.3) + 0.8, springY + archApex(a, 1.3) + 4.2, 0.6), mats.stoneLight);
  gable.position.z = 0.2;
  grp.add(gable);
  return grp;
}

// 一座西塔：方身 + 角撑 + 钟室尖窗，顶部按 P.towerSpires 收成八角尖锥或平顶敞廊。
// extraH / extraSpire 用于不对称双塔（沙特尔式北塔更高）。
export function tower(P, mats, extraH = 0, extraSpire = 0) {
  const grp = new THREE.Group();
  const w = P.towerW;
  const H = P.towerH + extraH;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, H, w), mats.stone);
  body.position.y = H / 2;
  body.castShadow = body.receiveShadow = true;
  grp.add(body);
  // 四角扶壁条
  const cornerG = new THREE.BoxGeometry(1.2, H * 0.82, 1.2);
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const c = new THREE.Mesh(cornerG, mats.stone);
    c.position.set(dx * w / 2, H * 0.41, dz * w / 2);
    c.castShadow = true;
    grp.add(c);
  }
  // 钟室：每面两扇尖窗（百叶以暗面示意）
  const beltG = wallWithOpenings(w * 0.9, 0, 12, 0.5, [
    { cx: -w * 0.2, a: 1.1, y0: 1.2, springY: 8.2, k: 1.6 },
    { cx: w * 0.2, a: 1.1, y0: 1.2, springY: 8.2, k: 1.6 },
  ]);
  const dark = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 12, w * 0.86), mats.dark);
  dark.position.y = H - 7;
  grp.add(dark);
  for (let f = 0; f < 4; f++) {
    const belt = new THREE.Mesh(beltG, mats.stone);
    belt.position.y = H - 13;
    belt.rotation.y = (f * Math.PI) / 2;
    const off = w / 2 - 0.2;
    belt.position.x = [0, off, 0, -off][f];
    belt.position.z = [off, 0, -off, 0][f];
    belt.castShadow = true;
    grp.add(belt);
  }
  if (P.towerSpires !== false) {
    // 尖锥收顶
    const spireH = P.spireH + extraSpire;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(w * 0.52, spireH, 8), mats.roof);
    spire.position.y = H + spireH / 2;
    spire.castShadow = true;
    grp.add(spire);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), mats.gold);
    tip.position.y = H + spireH + 0.2;
    grp.add(tip);
  } else {
    // 平顶敞廊收顶（巴黎圣母院式）：栏杆沿 + 平台
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.9, 1.1, w + 0.9), mats.stoneLight);
    rim.position.y = H + 0.55;
    rim.castShadow = true;
    grp.add(rim);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.5, w * 0.9), mats.stone);
    deck.position.y = H + 1.1;
    grp.add(deck);
  }
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const pin = makePinnacle(mats.stoneLight, 0.8);
    pin.position.set(dx * (w / 2 - 0.4), H, dz * (w / 2 - 0.4));
    grp.add(pin);
  }
  return grp;
}

// 整个西立面，放在 z = P.naveZ1 处，面朝 +z
export function westFront(P, mats, glassMats, labels) {
  const grp = new THREE.Group();
  const z0 = P.naveZ1;
  const halfW = P.outerX;
  const T = 2.0;

  // 中央体块的墙：开玫瑰窗圆洞 + 中门洞
  const centerWall = new THREE.Mesh(
    wallWithOpenings(P.naveHW * 2 + P.arcadeT * 2, 0, P.naveWallTop + 2, T, [
      { circle: true, cx: 0, cy: P.roseY, r: P.roseR + 0.3 },
      { cx: 0, a: 3.0, y0: 0, springY: 7.5, k: 1.3 },
    ]),
    mats.stone);
  centerWall.position.z = z0 + T / 2;
  centerWall.castShadow = centerWall.receiveShadow = true;
  grp.add(centerWall);

  // 玫瑰窗
  const rose = roseAssembly(P.roseR, mats, glassMats.rose);
  rose.position.set(0, P.roseY, z0 + T + 0.05);
  grp.add(rose);
  labels.push({ text: '玫瑰窗', pos: [0, P.roseY + 6, z0 + 3], scope: 'out' });

  // 玫瑰窗下的国王廊（列龛，简化为小连拱带）
  const galleryG = wallWithOpenings(P.naveHW * 2, 0, 3.4, 0.5,
    Array.from({ length: 7 }, (_, i) => ({ cx: -5.1 + i * 1.7, a: 0.55, y0: 0.4, springY: 2.4, k: 1.5 })));
  const gallery = new THREE.Mesh(galleryG, mats.stoneLight);
  gallery.position.set(0, 14.5, z0 + T + 0.1);
  grp.add(gallery);

  // 中央山墙
  const gable = new THREE.Mesh(gableGeometry(P.naveHW + 1.2, P.naveWallTop + 2, P.roofRidge + 1.5, 1.2), mats.stone);
  gable.position.z = z0 + T / 2;
  gable.castShadow = true;
  grp.add(gable);

  // 三座门廊：中门 + 两塔基侧门
  const centerPortal = portal(3.0, 7.5, mats, 3, 2.0);   // 门槛向内接到中厅铺地（z = naveZ1）
  centerPortal.position.z = z0 + T;
  grp.add(centerPortal);
  labels.push({ text: '三门廊（层叠尖拱）', pos: [0, 15, z0 + 4], scope: 'out' });

  // 双塔（坐在侧廊端头上）
  const txc = P.naveHW + P.arcadeT + P.towerW / 2 - 0.4;
  for (const s of [1, -1]) {
    const asym = P.towerAsym && s < 0;   // 沙特尔式：北塔更高更尖
    const t = tower(P, mats, asym ? 7 : 0, asym ? 7 : 0);
    t.position.set(s * txc, 0, z0 + P.towerW / 2 - 0.5);
    grp.add(t);
    const side = portal(1.6, 5.5, mats, 2);
    side.position.set(s * txc, 0, z0 + P.towerW - 0.4);
    grp.add(side);
  }
  labels.push({ text: '西立面双塔', pos: [-txc, P.towerH + P.spireH + 2, z0 + 3], scope: 'out' });
  return grp;
}
