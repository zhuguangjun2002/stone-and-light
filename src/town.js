// 教堂领地（cathedral close / precinct）：围墙与门楼、回廊、教士住宅、墓地、市场。
// 中世纪大教堂从来不是孤零零一座房子，它嵌在一片有围墙的"领地"里：南侧回廊是
// 修士的日常动线，四周是教士住宅与墓地，西端前庭是集市。这里全部程序化生成，
// 无外部资源。
//
// 接入方式：本模块的 group 被 buildCathedral() 挂进 root，于是自动进入
//   · 第一人称碰撞（src/grid.js 从 root 建射线网格）
//   · 参数重建与资源释放
// 领地的材质都标了 userData.noBake，网格都标了 userData.buildSkip：
// 前者让 bake.js 跳过（室外靠天光/日照，不需要顶点色烘焙），
// 后者让建造动画把镇子排除在外（教堂是在既有的镇子里盖起来的）。

import * as THREE from '../lib/three.module.js';
import { wallWithOpenings, gableRoofGeometry, gableGeometry, makePinnacle } from './gothic.js';
import { mulberry32, pavingTexture } from './materials.js';

// 领地围墙的四至（世界坐标；+x 南、-x 北、+z 西、-z 东）
const SX = 56, NX = -52, WZ = 78, EZ = -58;
const WALL_H = 4.2, WALL_T = 0.85;

// 回廊方位（南侧、中厅与耳堂之间），尺寸由外层方框与内院定。
// x0 取 18.5：扶壁墩最远伸到 x≈15.9，回廊与它之间留 ~2.6 m 的过道（类 slype），
// 让 22 m 高的扶壁墩完整露出来。
// garth 取 16（而非 18）：东缘落到 x = 42.9，与南墙那排住宅前脸（最浅时 x≈45.4）
// 之间也宽出 ~2.5 m——回廊东西两侧的过道因此差不多宽，走起来不再挤。
const CLO = { x0: 18.5, z0: 13.0, garth: 16.0, depth: 4.2 };

function townMaterials() {
  const M = (color, roughness = 0.95, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    m.userData.noBake = true;   // 室外：不参与室内光照烘焙
    return m;
  };
  const paveTex = pavingTexture();   // 无 DOM 时为 null，退回纯色
  return {
    wall: M('#c4b9a1'),        // 领地围墙
    wallDark: M('#a2957c'),
    plaster: M('#d8c9a8'),     // 抹灰墙面
    timber: M('#5a4128', 0.85),// 木构架
    tile: M('#7c4a38', 0.85),  // 陶瓦
    slate: M('#4e5766', 0.8),  // 石板瓦
    wood: M('#4a3320', 0.8),
    grass: M('#6d7c4c', 1),
    path: M('#948e80', 1),
    paving: M(paveTex ? '#ffffff' : '#c4b690', 1, paveTex ? { map: paveTex } : {}),   // 前庭石板（贴图按世界坐标铺）
    earth: M('#8a7d62', 1),      // 压实土
    grave: M('#9a9384'),
    tree: M('#4d5f36', 1),
    trunk: M('#4a3a28'),
    water: new THREE.MeshStandardMaterial({ color: '#5f7f96', roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.85 }),
    win: M('#2b3a4a', 0.35, { metalness: 0.1 }),
    lead: M('#61666d', 0.5, { metalness: 0.35 }),   // 檐沟 / 落水管
    gold: M('#c9a24a', 0.4, { metalness: 0.7 }),
    awning: [M('#8a3a34', 0.9), M('#3a5a6a', 0.9), M('#7a6a2a', 0.9)],
  };
}

// 建一块网格：统一定阴影、标 buildSkip（不参与建造动画）
function solid(geo, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  m.userData.buildSkip = true;
  return m;
}

// 墙头收口：压顶石 + 垤口。沿墙方向用世界坐标给（alongX 表示墙沿 x 延伸，否则沿 z）。
function wallTop(g, mats, { alongX, cx, cz, len, wallH, wallT, gaps = [] }) {
  const copeH = 0.16, copeD = wallT + 0.28;
  g.add(solid(new THREE.BoxGeometry(alongX ? len : copeD, copeH, alongX ? copeD : len), mats.wallDark,
    cx, wallH + copeH / 2 + 0.01, cz));
  const mw = 1.05, mh = 0.62, pitch = 2.0, md = wallT + 0.05;   // 齿略宽于缺口，才像垤口不像掉牙
  for (let t = -len / 2 + mw / 2; t <= len / 2 - mw / 2; t += pitch) {
    const wp = alongX ? cx + t : cz + t;                 // 沿墙方向的世界坐标，用于跳开门洞/门楼
    if (gaps.some(([a, b]) => wp > a && wp < b)) continue;
    g.add(solid(new THREE.BoxGeometry(alongX ? mw : md, mh, alongX ? md : mw), mats.wall,
      alongX ? cx + t : cx, wallH + copeH + mh / 2 + 0.01, alongX ? cz : cz + t));
  }
}

// 领地围墙：四面墙，西面开正门、东面开殡门、南北各开一道便门
function buildWalls(mats) {
  const g = new THREE.Group();
  const spanX = SX - NX, cx = (SX + NX) / 2;   // 108 / 2
  const spanZ = WZ - EZ, cz = (WZ + EZ) / 2;   // 136 / 10

  // 西墙（正门在 x = 0）
  const west = solid(wallWithOpenings(spanX, 0, WALL_H, WALL_T,
    [{ cx: -cx, a: 1.7, y0: 0, springY: 1.25, k: 1.0 }]), mats.wall, cx, 0, WZ);
  g.add(west);
  // 东墙（殡门）
  const east = solid(wallWithOpenings(spanX, 0, WALL_H + 0.02, WALL_T,
    [{ cx: -cx, a: 1.7, y0: 0, springY: 1.25, k: 1.0 }]), mats.wallDark, cx, 0, EZ);
  g.add(east);
  // 南墙 + 便门（世界 z = 20 → 局部 cx = -(20 - cz)）
  const south = solid(wallWithOpenings(spanZ, 0, WALL_H - 0.03, WALL_T,
    [{ cx: -(20 - cz), a: 1.0, y0: 0, springY: 1.0, k: 1.0 }]), mats.wall, SX, 0, cz, Math.PI / 2);
  g.add(south);
  // 北墙 + 便门（世界 z = -20）
  const north = solid(wallWithOpenings(spanZ, 0, WALL_H + 0.05, WALL_T,
    [{ cx: -(-20 - cz), a: 1.0, y0: 0, springY: 1.0, k: 1.0 }]), mats.wallDark, NX, 0, cz, Math.PI / 2);
  g.add(north);

  // 西正门门楼：一整个带尖拱门洞的楼体，上覆双坡顶，四角小尖塔
  const GH_W = 10.5, GH_D = 5.2, GH_H = 8.6;
  g.add(solid(wallWithOpenings(GH_W, 0, GH_H, GH_D,
    [{ cx: 0, a: 1.5, y0: 0, springY: 1.45, k: 1.0 }]), mats.wall, 0, 0, WZ));
  const ghRoof = new THREE.Mesh(gableRoofGeometry(GH_D / 2 + 0.4, GH_H, GH_H + 2.2, GH_W + 0.6), mats.slate);
  ghRoof.rotation.y = Math.PI / 2;
  ghRoof.position.set(0, 0, WZ);
  ghRoof.castShadow = ghRoof.receiveShadow = true;
  ghRoof.userData.buildSkip = true;
  g.add(ghRoof);
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const pin = makePinnacle(mats.wallDark, 1.1);
    pin.position.set(sx * (GH_W / 2 - 0.7), GH_H, WZ + sz * (GH_D / 2 - 0.7));
    pin.traverse((o) => { if (o.isMesh) o.userData.buildSkip = true; });
    g.add(pin);
  }

  // 墙头收口：压顶石 + 垤口（跳过门洞与门楼），四角小塔楼
  wallTop(g, mats, { alongX: true,  cx,     cz: WZ, len: spanX, wallH: WALL_H,         wallT: WALL_T, gaps: [[-5.6, 5.6]] });
  wallTop(g, mats, { alongX: true,  cx,     cz: EZ, len: spanX, wallH: WALL_H + 0.02,  wallT: WALL_T, gaps: [[-2.2, 2.2]] });
  wallTop(g, mats, { alongX: false, cx: SX, cz,     len: spanZ, wallH: WALL_H - 0.03,  wallT: WALL_T, gaps: [[18.5, 21.5]] });
  wallTop(g, mats, { alongX: false, cx: NX, cz,     len: spanZ, wallH: WALL_H + 0.05,  wallT: WALL_T, gaps: [[-21.5, -18.5]] });
  const cornerH = WALL_H + 1.0;
  for (const [tx, tz] of [[SX, WZ], [SX, EZ], [NX, WZ], [NX, EZ]]) {
    g.add(solid(new THREE.BoxGeometry(1.1, cornerH, 1.1), mats.wallDark, tx, cornerH / 2, tz));
    const pin = makePinnacle(mats.wall, 0.8);
    pin.position.set(tx, cornerH, tz);
    pin.traverse((o) => { if (o.isMesh) o.userData.buildSkip = true; });
    g.add(pin);
  }
  return g;
}

// 回廊一翼：局部坐标里 x 沿长度、z=0 是朝内院的敞廊（尖拱列）、z=depth 是外实墙。
// 四面各建一次再旋转摆位；彼此在角部略微重叠，四片的 y 各差几厘米，避免共面。
function cloisterWalk(len, mats, yOff, seed) {
  const g = new THREE.Group();
  const D = CLO.depth, H = 4.4;

  // 地台
  g.add(solid(new THREE.BoxGeometry(len, 0.32, D), mats.path, 0, 0.16 + yOff, D / 2));
  // 朝内院的敞廊：一排尖拱
  const op = [];
  for (let i = -2; i <= 2; i++) op.push({ cx: i * 4.7, a: 1.55, y0: 0, springY: 1.3, k: 1.0 });
  g.add(solid(wallWithOpenings(len, 0, H, 0.5, op), mats.wall, 0, 0.02 + yOff, 0.1));
  // 外实墙 + 小窗
  const win = [];
  for (let i = -2; i <= 2; i++) win.push({ cx: i * 4.7, a: 0.55, y0: 1.75, springY: 2.5, k: 1.0 });
  g.add(solid(wallWithOpenings(len, 0, H + 0.25, 0.6, win), mats.wallDark, 0, 0.02 + yOff, D - 0.1));
  // 敞廊柱：半嵌在墙面上，给拱列两根细柱的读数
  const colG = new THREE.CylinderGeometry(0.2, 0.2, H, 8);
  for (const i of [-2, -1, 0, 1, 2]) {
    for (const s of [-1, 1]) {
      g.add(solid(colG, mats.wall, i * 4.7 + s * 2.35, H / 2 + 0.02 + yOff, -0.06));
    }
  }
  // 单坡屋面：外高内低
  const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 0.7, 0.3, D + 0.9), mats.slate);
  roof.rotation.x = -Math.atan2(1.1, D);
  roof.position.set(0, H + 0.95 + yOff, D / 2);
  roof.castShadow = roof.receiveShadow = true;
  roof.userData.buildSkip = true;
  g.add(roof);

  // 内檐沟：屋面外高内低，水都往院子里走；真回廊沿内檐一圈水槽把水收住，
  // 再由四角落水管引到院角雨水口（落水管见 buildCloister）。
  const eaveY = H + 0.16 + yOff, gl = len + 0.7;
  g.add(solid(new THREE.BoxGeometry(gl, 0.05, 0.36), mats.lead, 0, eaveY - 0.18, -0.5));       // 槽底
  g.add(solid(new THREE.BoxGeometry(gl, 0.18, 0.05), mats.lead, 0, eaveY - 0.09, -0.70));      // 院侧翻边
  g.add(solid(new THREE.BoxGeometry(gl, 0.18, 0.05), mats.lead, 0, eaveY - 0.09, -0.29));      // 墙侧翻边
  return g;
}

// 回廊整体：四面敞廊 + 内院草地 + 中央水井
function buildCloister(mats) {
  const g = new THREE.Group();
  const { x0, z0, garth, depth } = CLO;
  const gx = x0 + depth;                 // 内院西缘
  const gz = z0 + depth;                 // 内院南缘
  const gcx = gx + garth / 2, gcz = gz + garth / 2;
  const sideLen = garth + depth * 2 - 0.06;  // 端墙略短：端面别与侧翼端面共面

  // 端墙（东西两翼，沿 z 通长）。组原点在敞廊面上：西翼敞廊在 x=gx，东翼在 x=gx+garth。
  g.add(placeWalk(cloisterWalk(sideLen, mats, 0, 1), gx, gcz, -Math.PI / 2));
  g.add(placeWalk(cloisterWalk(sideLen, mats, 0.02, 2), gx + garth, gcz, Math.PI / 2));
  // 侧翼（南北两翼，沿 x）。稍短，端面埋进端墙里，避免贴面对贴面共面。
  const sideShort = garth + depth;
  g.add(placeWalk(cloisterWalk(sideShort, mats, 0.04, 3), gcx, gz + garth, 0));
  g.add(placeWalk(cloisterWalk(sideShort, mats, 0.06, 4), gcx, gz, Math.PI));

  // 内院草地与十字路径
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(garth - 0.4, garth - 0.4), mats.grass);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(gcx, 0.11, gcz);
  grass.receiveShadow = true;
  grass.userData.buildSkip = true;
  g.add(grass);
  g.add(solid(new THREE.BoxGeometry(garth - 0.3, 0.06, 1.8), mats.path, gcx, 0.14, gcz));
  g.add(solid(new THREE.BoxGeometry(1.8, 0.06, garth - 0.3), mats.path, gcx, 0.15, gcz));

  // 中央水井
  const well = new THREE.Group();
  well.add(solid(new THREE.CylinderGeometry(1.15, 1.25, 0.9, 12), mats.wall, 0, 0.45, 0));
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.0, 16), mats.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.88;
  water.userData.buildSkip = true;
  well.add(water);
  const postG = new THREE.CylinderGeometry(0.09, 0.09, 2.0, 6);
  for (const s of [-1, 1]) well.add(solid(postG, mats.timber, s * 0.95, 1.9, 0));
  well.add(solid(new THREE.BoxGeometry(2.6, 0.16, 1.2), mats.timber, 0, 3.0, 0));
  const wroofG = gableRoofGeometry(0.85, 0, 1.0, 3.0);
  const wroof = new THREE.Mesh(wroofG, mats.tile);
  wroof.position.set(0, 3.05, 0);
  wroof.rotation.y = Math.PI / 2;
  wroof.castShadow = true;
  wroof.userData.buildSkip = true;
  well.add(wroof);
  well.position.set(gcx, 0, gcz);
  g.add(well);

  // 四角落水管 + 院角雨水口：内檐沟的水从这儿排下去，不是让雨直接泻到草地上。
  // 水槽在院内偏 0.5 m，管就站在四条槽相交的四个点上。
  const pipeG = new THREE.CylinderGeometry(0.09, 0.09, 4.4, 8);
  const gullyG = new THREE.CylinderGeometry(0.32, 0.4, 0.16, 10);
  for (const cx of [gx + 0.5, gx + garth - 0.5]) {
    for (const cz of [gz + 0.5, gz + garth - 0.5]) {
      g.add(solid(pipeG, mats.lead, cx, 2.2, cz));
      g.add(solid(gullyG, mats.wallDark, cx, 0.08, cz));
    }
  }
  return g;
}

function placeWalk(walk, x, z, ry) {
  walk.position.set(x, 0, z);
  walk.rotation.y = ry;
  return walk;
}

// 一栋教士住宅：抹灰墙 + 木构架角柱 + 双坡瓦顶 + 烟囱，门与窗开在正面（局部 +z）。
function canonHouse(w, d, h, mats, rnd, roofStyle = 'tile') {
  const g = new THREE.Group();
  g.add(solid(new THREE.BoxGeometry(w, h, d), mats.plaster, 0, h / 2, 0));
  // 木构架：四角立贴 + 腰梁
  const postG = new THREE.BoxGeometry(0.22, h, 0.22);
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    g.add(solid(postG, mats.timber, sx * (w / 2 - 0.16), h / 2, sz * (d / 2 - 0.16)));
  }
  g.add(solid(new THREE.BoxGeometry(w + 0.05, 0.18, d + 0.05), mats.timber, 0, h * 0.62, 0));
  // 门
  g.add(solid(new THREE.BoxGeometry(1.15, 2.25, 0.14), mats.wood, 0, 1.12, d / 2 + 0.02));
  // 窗（上下两排，正面 + 山墙）
  const winG = new THREE.BoxGeometry(0.85, 1.0, 0.12);
  for (const wx of [-w * 0.32, w * 0.32]) {
    g.add(solid(winG, mats.win, wx, h * 0.42, d / 2 + 0.02));
    g.add(solid(winG, mats.win, wx, h * 0.76, d / 2 + 0.02));
  }
  // 双坡屋面（脊沿房屋长边）
  const rh = 1.1 + rnd() * 0.8;
  const roof = new THREE.Mesh(gableRoofGeometry(d / 2 + 0.35, h, h + rh, w + 0.5), roofStyle === 'slate' ? mats.slate : mats.tile);
  roof.rotation.y = Math.PI / 2;
  roof.castShadow = roof.receiveShadow = true;
  roof.userData.buildSkip = true;
  g.add(roof);
  // 山墙补齐（把屋顶下的三角形填上，免得从山墙侧看进屋内）
  const gableG = gableGeometry(d / 2 + 0.3, h, h + rh, 0.25);   // 三角板，沿 z 挤出厚度
  for (const s of [1, -1]) {
    const tri = new THREE.Mesh(gableG, mats.plaster);
    tri.rotation.y = Math.PI / 2;
    tri.position.x = s * (w / 2 - 0.12);
    tri.castShadow = tri.receiveShadow = true;
    tri.userData.buildSkip = true;
    g.add(tri);
  }
  // 烟囱
  g.add(solid(new THREE.BoxGeometry(0.75, rh + 1.7, 0.75), mats.timber, w * 0.26, h + (rh + 1.7) / 2 - 0.2, 0));
  return g;
}

// 沿南墙与东墙内侧排一列住宅（面向教堂）
function buildHouses(mats, rnd) {
  const g = new THREE.Group();
  const hh = [5.4, 6.2, 5.0, 7.0, 5.8, 6.6, 5.2, 6.0];
  // 南墙一排：正面朝北（-x）
  let k = 0;
  for (let z = 70; z >= 4; z -= 9.6) {
    const h = hh[k % hh.length];
    const hd = 8.4 + rnd() * 1.8;
    const house = canonHouse(8.6, hd, h, mats, rnd, k % 3 === 2 ? 'slate' : 'tile');
    house.position.set(SX - 0.4 - hd / 2, 0, z);
    house.rotation.y = -Math.PI / 2;
    g.add(house);
    k++;
  }
  // 东墙一排：正面朝西（+z）
  for (let x = -40; x <= 44; x += 11.5) {
    const h = hh[(k + 3) % hh.length];
    const hd = 8.0 + rnd() * 1.6;
    const house = canonHouse(9.2, hd, h, mats, rnd, 'tile');
    house.position.set(x, 0, EZ + 0.4 + hd / 2);
    g.add(house);
    k++;
  }
  return g;
}

// 墓地：北侧划一块地，成排的墓碑与十字，另种几棵紫杉
function buildGraveyard(mats, rnd) {
  const g = new THREE.Group();
  const gx0 = -46, gx1 = -26, gz0 = -44, gz1 = 46;   // 东缘停在耳堂臂（x≈-24）之外，免得草坪压到地坪
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(gx1 - gx0, gz1 - gz0), mats.grass);
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set((gx0 + gx1) / 2, 0.04, (gz0 + gz1) / 2);
  lawn.receiveShadow = true;
  lawn.userData.buildSkip = true;
  g.add(lawn);
  const tombG = new THREE.BoxGeometry(0.66, 0.9, 0.18);
  const crossV = new THREE.BoxGeometry(0.12, 1.15, 0.12);
  const crossH = new THREE.BoxGeometry(0.6, 0.12, 0.12);
  for (let z = gz0 + 3, row = 0; z <= gz1 - 3; z += 3.2, row++) {
    for (let x = gx0 + 2 + (row % 2) * 1.4; x <= gx1 - 2; x += 3.0) {
      if (rnd() < 0.18) continue;
      if (rnd() < 0.28) {          // 十字
        const xc = x, zc = z;
        const v = solid(crossV, mats.grave, xc, 0.58, zc, (rnd() - 0.5) * 0.2);
        const hbar = solid(crossH, mats.grave, xc, 0.9, zc, (rnd() - 0.5) * 0.2);
        g.add(v, hbar);
      } else {                     // 立碑
        const tilt = (rnd() - 0.5) * 0.16;
        g.add(solid(tombG, mats.grave, x, 0.45, z, tilt));
      }
    }
  }
  // 紫杉（墓地常青树）
  for (const [tx, tz] of [[-24, -38], [-42, -30], [-42, 34], [-24, 40], [-30, 6]]) {
    g.add(makeTree(mats, 1.15 + rnd() * 0.3, rnd, tx, tz, true));
  }
  return g;
}

// 低多边形树：树干 + 两三团树冠。yew=true 收成瘦高的紫杉形。
function makeTree(mats, s, rnd, x, z, yew = false) {
  const g = new THREE.Group();
  const trunkH = (yew ? 2.6 : 3.0) * s;
  g.add(solid(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, trunkH, 6), mats.trunk, 0, trunkH / 2, 0));
  const blobs = yew ? 2 : 3;
  for (let i = 0; i < blobs; i++) {
    const r = (yew ? 1.0 : 1.5) * s * (1 - i * 0.16);
    const geo = yew ? new THREE.ConeGeometry(r, 2.4 * s, 7) : new THREE.IcosahedronGeometry(r, 0);
    const m = solid(geo, mats.tree,
      (rnd() - 0.5) * 0.6 * s,
      trunkH + (yew ? i * 1.5 * s : i * 0.9 * s) + r * 0.5,
      (rnd() - 0.5) * 0.6 * s);
    m.rotation.y = rnd() * Math.PI;
    g.add(m);
  }
  g.traverse((o) => { if (o.isMesh) o.userData.noFoundation = true; });  // 树不长地基
  g.position.set(x, 0, z);
  return g;
}

// 院内地面分级：把原来一整块灰广场，拆成 前庭石板 / 草地 / 压实土 几档。
// 每档用薄平面叠在广场上（y 各差几厘米，避免共面），材质 noBake、网格 buildSkip。
// 铺地图的 UV 直接由世界 XZ 生成（局部平面绕 x 转 -90°：(x,y) → (x, -y)），
// 于是不同尺寸的石板区缝距一致、相邻区块对得上。
function buildGround(mats) {
  const g = new THREE.Group();
  const PAVE_TILE = 6;   // 一张石板贴图 = 6 m × 6 m
  const patch = (mat, w, d, x, z, y) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.userData.buildSkip = true;
    if (mat.map) {
      const uv = m.geometry.attributes.uv, pos = m.geometry.attributes.position, s = 1 / PAVE_TILE;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + x) * s, (-pos.getY(i) + z) * s);
      uv.needsUpdate = true;
    }
    g.add(m);
  };
  // 西前庭石板（正门到西立面，集市所在）
  patch(mats.paving, 58, 24, 0, 65, 0.06);
  // 教堂北侧草地（两段，让开耳堂横臂）
  patch(mats.grass, 10, 38, -20, 27, 0.04);
  patch(mats.grass, 10, 38, -20, -27, 0.04);
  // 西北角草地（墓地与前庭之间）
  patch(mats.grass, 15, 22, -37.5, 64, 0.04);
  // 后殿东侧压实土院子（铺满整个东端，别在边上留一圈灰广场）
  patch(mats.earth, 72, 14, 5, -45, 0.03);
  // 南侧长条土院子（回廊与南墙之间）
  patch(mats.earth, 9, 125, 47.5, 12.5, 0.03);
  // 北侧步道（前庭 → 北侧草地）
  patch(mats.paving, 2, 42, -17.5, 31, 0.06);
  return g;
}

// 西前庭集市：市场十字 + 几处摊棚（正门到西立面的石板路现由 buildGround 的西前庭覆盖）
function buildMarket(mats, rnd) {
  const g = new THREE.Group();
  // 市场十字：三级台座 + 石柱 + 十字
  const mx = 13, mz = 66;
  for (let i = 0; i < 3; i++) {
    g.add(solid(new THREE.BoxGeometry(3.6 - i * 0.8, 0.28, 3.6 - i * 0.8), mats.wall, mx, 0.14 + i * 0.28, mz));
  }
  g.add(solid(new THREE.CylinderGeometry(0.28, 0.34, 3.4, 8), mats.wallDark, mx, 1.95, mz));
  g.add(solid(new THREE.BoxGeometry(0.2, 1.3, 0.2), mats.gold, mx, 4.3, mz));
  g.add(solid(new THREE.BoxGeometry(0.95, 0.2, 0.2), mats.gold, mx, 4.55, mz));
  // 摊棚：四根柱子 + 布篷 + 货台
  // 布篷向前倾（绕 x：前 = +z = 货台一侧压低，后高），柱高按各自正上方的篷底反推。
  const AWN_Y = 2.7, AWN_T = 0.16, AWN_TILT = 0.16;
  // 布篷倾斜后，底面在世界 z 处的高度
  const awnUnder = (sz, wz) => AWN_Y - (wz - sz) * Math.tan(AWN_TILT) - (AWN_T / 2) / Math.cos(AWN_TILT);
  for (const [sx, sz, ai] of [[-14, 64, 0], [-22, 58, 1], [18, 58, 2], [24, 68, 0]]) {
    for (const px of [-1.8, 1.8]) for (const pz of [-1.4, 1.4]) {
      const h = awnUnder(sz, sz + pz) + 0.03;   // 柱头插进布篷 3 cm，不留缝也不穿出篷面
      g.add(solid(new THREE.BoxGeometry(0.14, h, 0.14), mats.wood, sx + px, h / 2, sz + pz));
    }
    const awn = solid(new THREE.BoxGeometry(4.4, AWN_T, 3.6), mats.awning[ai], sx, AWN_Y, sz);
    awn.rotation.x = AWN_TILT;
    g.add(awn);
    // 货台：一张靠在前柱上的长桌（台面 + 两条板腿）。
    // 原来是一块竖着的板 BoxGeometry(3.4, 0.9, 0.16) 悬在 y=0.85，底下没腿、上面没台面，
    // 看起来就像一张缺腿的桌子。
    g.add(solid(new THREE.BoxGeometry(3.2, 0.12, 0.8), mats.wood, sx, 0.9, sz + 0.85));
    for (const lx of [-1.35, 1.35]) {
      g.add(solid(new THREE.BoxGeometry(0.14, 0.86, 0.7), mats.wood, sx + lx, 0.43, sz + 0.85));
    }
  }
  return g;
}

// 领地里的零星树木：回廊内院、墓地道旁、教堂四周
function buildTrees(mats, rnd) {
  const g = new THREE.Group();
  const spots = [
    [20, 44], [38, 8], [48, 30], [-24, -12], [-38, 18], [-20, 46],
    [44, 60], [-44, 64], [8, 74], [-10, 74], [50, -8], [-30, -50], [30, -50],
  ];
  for (const [x, z] of spots) g.add(makeTree(mats, 0.9 + rnd() * 0.6, rnd, x, z, false));
  return g;
}

export function buildTown(labels = []) {
  const mats = townMaterials();
  const rnd = mulberry32(20260910);
  const root = new THREE.Group();

  root.add(buildWalls(mats));
  root.add(buildGround(mats));
  // 围墙之外是田野，别让灰色广场一直铺到天边（广场是主场景里铺好的，这里只盖外面）
  const outerGrass = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats.grass);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z);
    m.receiveShadow = true; m.userData.buildSkip = true;
    return m;
  };
  root.add(outerGrass(124, 48, 2, 102));    // 西墙外
  root.add(outerGrass(124, 32, 2, -74));    // 东墙外
  root.add(buildCloister(mats));
  root.add(buildHouses(mats, rnd));
  root.add(buildGraveyard(mats, rnd));
  root.add(buildMarket(mats, rnd));
  root.add(buildTrees(mats, rnd));

  labels.push({ text: '回廊（修士的日常动线）', pos: [30.7, 7.5, 25.2], scope: 'out' });
  labels.push({ text: '教堂领地围墙', pos: [0, 6.5, WZ], scope: 'out' });
  labels.push({ text: '北侧墓地', pos: [-32, 3, 0], scope: 'out' });
  labels.push({ text: '西前庭集市', pos: [13, 6, 66], scope: 'out' });
  // 标记领地网格：针对教堂外壳的检查器（穿刺等）可以据此跳过领地
  root.traverse((o) => { if (o.isMesh) o.userData.town = true; });
  return root;
}
