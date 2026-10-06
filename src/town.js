// 教堂领地（cathedral close / precinct）：回廊、教士住宅、墓地、市场、酿酒坊大院。
// 中世纪大教堂从来不是孤零零一座房子，它嵌在一片"领地"里（2026-10 起领地不设围墙）：
// 南侧回廊是修士的日常动线，四周是教士住宅与墓地，西端前庭是集市。这里全部程序化生成，
// 无外部资源。
//
// 接入方式：本模块的 group 被 buildCathedral() 挂进 root，于是自动进入
//   · 第一人称碰撞（src/grid.js 从 root 建射线网格）
//   · 参数重建与资源释放
// 领地的材质都标了 userData.noBake，网格都标了 userData.buildSkip：
// 前者让 bake.js 跳过（室外靠天光/日照，不需要顶点色烘焙），
// 后者让建造动画把镇子排除在外（教堂是在既有的镇子里盖起来的）。

import * as THREE from '../lib/three.module.js';
import { wallWithOpenings, gableRoofGeometry, gableGeometry } from './gothic.js';
import { mulberry32, pavingTexture } from './materials.js';

// 领地四至（世界坐标；+x 南、-x 北、+z 西、-z 东）。围墙于 2026-10 按用户要求整体拆除，
// 四至仅作为院落布局坐标保留。
// 旧四至：南 / 北 / 东三面旧墙在扩建后曾降为"庭墙"，现已连同外圈一并移除。
const SX = 56, NX = -52, WZ = 78, EZ = -58;
// 新四至：南扩 +20（南墙 56→76）、东扩 +20（东墙 -58→-78）、北扩 +12（北墙 -52→-64），
// 西面不动。方案图：docs/expansion-plan.png（tools/expansion-plan.py 出图）。
const SX2 = 76, NX2 = -64, EZ2 = -78;

// 门位（世界坐标）——建墙、画图、酿酒坊演示页共用同一组数
const WAGON_Z = -35;    // 粮车门：新南墙与旧南墙各一道，粮车从这里进院
const WICKET_Z = -20;   // 便门：新北墙与旧北墙各一道（正对教堂北侧）
const FUNERAL_X = 0;    // 殡门：新东墙与旧东墙各一道（送葬队伍出东门去墓地）
const WELL = { x: 68.5, z: 47 };   // 院坝水井（煮酒房与冷却发酵间之间的空档）
const LANE = { x0: 57.5, x1: 61.5, z0: -40, z1: 76 };   // 服务巷：旧南墙与酒坊之间
// 大院排水：六座建筑贴巷那面的檐口下挂檐沟 → 巷东缘一列落水管 → 服务巷东缘的明沟 →
// 东端出口转暗管 → 渗井。构件都打 userData.brew 标签，tools/check-brew.mjs 做正向连通校验，
// tools/brewery.html 拿同一份几何画水路（与 buildBreweryDrain 同源，改一处两边一起变）。
const DRAIN = {
  pipeX: 61.86,               // 落水管全排在巷东缘同一条线上（各建筑檐口深浅不一，靠集水管找齐）
  chX0: 61.0, chX1: 61.95,    // 明沟压着服务巷东缘；x1 让开粮仓/酒窖的墙面（x0=62）
  chY0: 0.07, chY1: 0.19,     // 沟面 0.19 比巷面（0.05）高一截，水才落得进去
  chZ0: -40, chZ1: 76,        // 东端出口 z=-40（＝服务巷的东头），西头到巷的尽头为止
  soak: { x: 61.475, z: -46 },// 渗井在东头外侧的院地上（＝明沟中线）
};
// 教士住宅东排（外移后的新址）：x≈0 留出 6.8 m 的殡门通道，原 [-5.5, 6] 会挡住轴线。
// -17 改成 -18.5：房宽 9.2 m，-17 与 -8 只隔 9 m，两栋会咬在一起（压墙面共面）。
const EAST_HOUSE_X = [-40, -28.5, -18.5, -8, 8, 17.5, 29, 40.5];

// 酿酒坊大院的六座建筑（世界坐标；x 是进深、贴服务巷的那面开门（x0 朝北），z 是长度、沿院墙）。
// 从东到西正好是一条生产流：收粮 → 烘干 → 浸麦发芽 → 煮酒 → 冷却发酵 → 陈酿售卖。
const BREW = [
  { key: 'granary',   name: '粮仓',      x0: 62, x1: 74, z0: -30, z1: -12, h: 7.2, rh: 3.0, roof: 'slate', hoist: true },
  { key: 'kiln',      name: '烘干窑',    x0: 64, x1: 74, z0: -6,  z1: 6,   h: 6.4, rh: 2.6, roof: 'tile', stone: true,
    chimney: { x: 73, z: -5, h: 13.5 } },
  { key: 'malthouse', name: '麦芽楼',    x0: 63, x1: 74, z0: 8,   z1: 24,  h: 8.8, rh: 3.4, roof: 'slate' },
  { key: 'brewhouse', name: '煮酒房',    x0: 63, x1: 74, z0: 28,  z1: 44,  h: 8.0, rh: 3.2, roof: 'tile' },
  { key: 'cooling',   name: '冷却·发酵', x0: 63, x1: 74, z0: 50,  z1: 60,  h: 5.6, rh: 2.4, roof: 'tile' },
  { key: 'cellar',    name: '酒窖·酒肆', x0: 62, x1: 75, z0: 62,  z1: 76,  h: 6.6, rh: 2.8, roof: 'tile', stone: true },
];

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
    wall: M('#c4b9a1'),        // 院内建筑墙
    wallDark: M('#a2957c'),
    plaster: M('#d8c9a8'),     // 抹灰墙面
    timber: M('#5a4128', 0.85),// 木构架
    tile: M('#7c4a38', 0.85),  // 陶瓦
    slate: M('#4e5766', 0.8),  // 石板瓦
    wood: M('#4a3320', 0.8),
    grass: M('#6d7c4c', 1),
    bed: M('#5c6a3c', 1),       // 园圃（菜园 / 药圃 / 酒花圃）的畦地
    row: M('#7f8d52', 1),       // 畦垄上的作物
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

// 酒坊单体：墙身 + 两片坡板屋面（脊沿 z）+ 山墙 + 西面的大门。
// 屋面是两片有厚度的坡板而不是整块三棱柱：山墙因此露在外面（抹灰三角 + 檐口挑出），
// 两片坡板在脊线上共用一条棱、山墙把两端封死，屋架下的空腔雨水进不去。
function brewHouse(spec, mats) {
  const g = new THREE.Group();
  const w = spec.x1 - spec.x0, d = spec.z1 - spec.z0, h = spec.h, rh = spec.rh;
  const wallMat = spec.stone ? mats.wall : mats.plaster;
  const roofMat = spec.roof === 'slate' ? mats.slate : mats.tile;
  const cx = (spec.x0 + spec.x1) / 2, cz = (spec.z0 + spec.z1) / 2;

  g.add(solid(new THREE.BoxGeometry(w, h, d), wallMat, 0, h / 2, 0));
  // 木构：四角立贴 + 腰梁（石砌体不打构架）
  if (!spec.stone) {
    const postG = new THREE.BoxGeometry(0.26, h, 0.26);
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      g.add(solid(postG, mats.timber, sx * (w / 2 - 0.17), h / 2, sz * (d / 2 - 0.17)));
    }
    g.add(solid(new THREE.BoxGeometry(w + 0.06, 0.2, d + 0.06), mats.timber, 0, h * 0.64, 0));
  }

  // 屋面：半宽比墙多挑 0.5 m（檐口），坡板厚 0.26，顶面正好过脊线与檐口
  const halfW = w / 2 + 0.5, L = Math.hypot(halfW, rh), t = 0.26;
  const phi = Math.atan2(rh, halfW), nx = rh / L, ny = halfW / L;
  for (const s of [1, -1]) {
    const slab = solid(new THREE.BoxGeometry(L, t, d + 0.8), roofMat,
      s * (halfW / 2 - nx * t / 2), h + rh / 2 - ny * t / 2, 0);
    slab.rotation.z = -s * phi;
    slab.userData.brew = 'roof';   // check-brew / brewery.html 靠这个标签认出屋面
    g.add(slab);
  }
  // 山墙（两端）：三角抹灰板，把屋架下的空腔封住，也补出屋顶下的墙面。
  // 三角比坡板顶面缩进 ~0.1 m：让山墙的斜边埋进坡板里，而不是跟坡板顶面共面（否则会闪）。
  const gableG = gableGeometry(halfW - 0.12, h - 0.05, h + rh - 0.14, 0.3);
  for (const s of [1, -1]) {
    const tri = new THREE.Mesh(gableG, wallMat);
    tri.position.z = s * (d / 2 - 0.1);
    tri.castShadow = tri.receiveShadow = true;
    tri.userData.buildSkip = true;
    g.add(tri);
  }

  // 贴服务巷那面（x0，朝北）的大门：门板比墙面凸出 4 cm，不做洞口，免得屋里漏光进雨
  const dw = Math.min(3.6, d - 3), dh = Math.min(3.6, h - 1.2);
  g.add(solid(new THREE.BoxGeometry(0.16, dh, dw), mats.wood, -w / 2 - 0.04, dh / 2, 0));
  g.add(solid(new THREE.BoxGeometry(0.2, 0.18, dw + 0.5), mats.timber, -w / 2 - 0.05, dh + 0.1, 0));
  // 另两面（x1 朝南、z0 朝东）开窗（一排小窗，够采光即可）
  const winG = new THREE.BoxGeometry(0.14, 1.15, 0.95);
  const nWin = Math.max(2, Math.floor(d / 5));
  for (let i = 0; i < nWin; i++) {
    const z = -d / 2 + (i + 0.5) * (d / nWin);
    g.add(solid(winG, mats.win, w / 2 + 0.03, h * 0.62, z));
  }
  g.add(solid(new THREE.BoxGeometry(1.0, 1.3, 0.14), mats.win, 0, h * 0.5, -d / 2 - 0.06));

  // 烘干窑烟囱：从地面直上，穿出屋面
  if (spec.chimney) {
    const c = spec.chimney, ch = c.h;
    g.add(solid(new THREE.BoxGeometry(1.15, ch, 1.15), mats.wallDark, c.x - cx, ch / 2, c.z - cz));
    g.add(solid(new THREE.BoxGeometry(1.5, 0.3, 1.5), mats.wallDark, c.x - cx, ch + 0.15, c.z - cz));
  }
  // 粮仓的吊装口：山墙上开个小门 + 伸出去的挑梁（粮包从这里吊上楼）
  if (spec.hoist) {
    g.add(solid(new THREE.BoxGeometry(1.2, 1.7, 0.16), mats.wood, 0, h + 1.1, d / 2 + 0.14));
    g.add(solid(new THREE.BoxGeometry(0.26, 0.26, 2.4), mats.timber, 0, h + 2.4, d / 2 + 1.0));
    g.add(solid(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), mats.wood, 0, h + 1.6, d / 2 + 2.0));
  }
  return g;
}

// 酿酒坊大院：六座生产建筑 + 院坝水井 + 酒桶 + 排水
function buildBrewery(mats) {
  const g = new THREE.Group();
  for (const spec of BREW) {
    const b = brewHouse(spec, mats);
    b.position.set((spec.x0 + spec.x1) / 2, 0, (spec.z0 + spec.z1) / 2);
    g.add(b);
  }
  // 院坝水井：煮酒与冷却都要水
  g.add(yardWell(mats, WELL.x, WELL.z));
  // 酒桶堆在煮酒房与冷却发酵间之间的空档
  const barrelG = new THREE.CylinderGeometry(0.5, 0.54, 1.3, 12);
  for (const [bx, bz] of [[64.5, 45.4], [64.5, 47.4], [66.2, 46.4], [68.0, 44.6]]) {
    g.add(solid(barrelG, mats.wood, bx, 0.65, bz));
  }
  g.add(buildBreweryDrain(mats));
  return g;
}

// 大院排水：檐沟 → 集水管 → 落水管 → 服务巷明沟 → 暗管 → 渗井。
// 跟回廊那套（buildCloister 里的 drain 构件）一个套路，只是标签换成 userData.brew，
// 两套校验互不干扰。几何常量在 DRAIN / BREW 里，brewInfo() 原样回传给演示页与校验器。
//
// 檐口贴巷一侧（x0），但六座的进深不一样（x0 = 62/63/64），檐口也就深浅不一：
//   粮仓、酒窖 x0=62 → 檐口 61.5，落水管 61.86 已经在檐沟正下方，不用拐
//   麦芽楼等三座 x0=63 → 檐口 62.5，用一段横的集水管把水引到 61.86
//   烘干窑   x0=64 → 檐口 63.5，同上，横管长一点
function buildBreweryDrain(mats) {
  const g = new THREE.Group();
  const dr = (tag, geo, mat, x, y, z) => {
    const m = solid(geo, mat, x, y, z); m.userData.brew = tag; g.add(m); return m;
  };
  for (const s of BREW) {
    const eaveX = s.x0 - 0.5, ey = s.h, cz = (s.z0 + s.z1) / 2, d = s.z1 - s.z0;
    // 檐沟：贴北檐的一道铅皮槽。顶面比檐口低 0.42 m，水从檐口垂直落进来；
    // 东端比檐口多伸 0.48 m，正好压住落水管，西端到 x0-0.02（离墙面 2 cm，看着是挂在墙上的）
    dr('gutter', new THREE.BoxGeometry(0.72, 0.16, d + 0.6), mats.lead, eaveX + 0.12, ey - 0.5, cz);
    // 集水管：檐沟与巷边落水管不在一条线上时，横一段把水引过去（接头埋进檐沟里）
    if (DRAIN.pipeX < eaveX - 0.24) {
      const a0 = DRAIN.pipeX - 0.16, a1 = eaveX - 0.1;
      dr('gutter', new THREE.BoxGeometry(a1 - a0, 0.16, 0.3), mats.lead,
        (a0 + a1) / 2, ey - 0.5, s.z0 + 0.15);
    }
    // 落水管：从檐沟底直落到明沟面上方 5 cm
    dr('spout', new THREE.CylinderGeometry(0.09, 0.09, ey - 0.82, 8), mats.lead,
      DRAIN.pipeX, (ey - 0.34) / 2, s.z0 + 0.15);
  }
  // 明沟：压服务巷东缘，通长一条，水沿它一直往东（z=-40）汇到出口
  dr('channel', new THREE.BoxGeometry(DRAIN.chX1 - DRAIN.chX0, DRAIN.chY1 - DRAIN.chY0,
    DRAIN.chZ1 - DRAIN.chZ0), mats.wallDark,
    (DRAIN.chX0 + DRAIN.chX1) / 2, (DRAIN.chY0 + DRAIN.chY1) / 2, (DRAIN.chZ0 + DRAIN.chZ1) / 2);
  // 暗管：从明沟东端出口穿到渗井（埋在地下，看不见）
  dr('culvert', new THREE.BoxGeometry(0.5, 0.4, 6.4), mats.lead,
    DRAIN.soak.x, -0.24, -43.2);
  // 渗井：井圈埋着、井篦露在地面上——水从这里离开系统
  dr('soak', new THREE.CylinderGeometry(0.72, 0.8, 0.55, 12), mats.wallDark, DRAIN.soak.x, -0.3, DRAIN.soak.z);
  dr('soak', new THREE.CylinderGeometry(0.6, 0.6, 0.12, 12), mats.lead, DRAIN.soak.x, 0.05, DRAIN.soak.z);
  return g;
}

// 院坝水井：井圈 + 水面 + 井架 + 小瓦顶（比回廊水井粗一号）
function yardWell(mats, x, z) {
  const g = new THREE.Group();
  g.add(solid(new THREE.CylinderGeometry(1.2, 1.3, 0.95, 12), mats.wall, 0, 0.47, 0));
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.02, 16), mats.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.9;
  water.userData.buildSkip = true;
  g.add(water);
  const postG = new THREE.CylinderGeometry(0.1, 0.1, 2.3, 6);
  for (const s of [-1, 1]) g.add(solid(postG, mats.timber, s * 1.0, 2.0, 0));
  g.add(solid(new THREE.BoxGeometry(2.9, 0.18, 1.3), mats.timber, 0, 3.15, 0));
  const roof = new THREE.Mesh(gableRoofGeometry(0.9, 0, 1.1, 3.3), mats.tile);
  roof.rotation.y = Math.PI / 2;
  roof.position.set(0, 3.2, 0);
  roof.castShadow = roof.userData.buildSkip = true;
  g.add(roof);
  g.add(solid(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), mats.wood, 0, 2.3, 0));
  g.position.set(x, 0, z);
  return g;
}

// 园圃：酒花圃（东扩带，搭架让酒花藤爬）、教士菜园与草药圃的畦垄
function buildGardens(mats) {
  const g = new THREE.Group();
  // 教士菜园（东扩带西段，x -4..44 / z -69..-58）：六畦沿 x 走
  for (let z = -67.5; z <= -59.5; z += 1.6) {
    g.add(solid(new THREE.BoxGeometry(42, 0.18, 0.95), mats.row, 20, 0.06 + 0.09, z));
  }
  // 草药圃（北扩带西段，x -63..-53 / z 47..77）：五畦沿 z 走
  for (let x = -61.5; x <= -54.5; x += 1.75) {
    g.add(solid(new THREE.BoxGeometry(0.95, 0.18, 27), mats.row, x, 0.06 + 0.09, 62));
  }
  // 酒花圃（东扩带北段，x -46..-8 / z -69..-58）：五行木杆 + 顶部铁丝 + 爬藤
  const postG = new THREE.BoxGeometry(0.16, 3.3, 0.16);
  const vineG = new THREE.BoxGeometry(0.22, 3.0, 0.22);
  for (let x = -43; x <= -11; x += 8) {
    for (const z of [-67.5, -63.5, -59.5]) g.add(solid(postG, mats.timber, x, 1.65, z));
    g.add(solid(new THREE.BoxGeometry(0.09, 0.09, 9.0), mats.lead, x, 3.2, -63.5));
    for (const z of [-65.5, -61.5]) g.add(solid(vineG, mats.tree, x, 1.5, z));
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
  const gut = (geo, y, z) => { const m = solid(geo, mats.lead, 0, y, z); m.userData.drain = 'gutter'; g.add(m); };
  gut(new THREE.BoxGeometry(gl, 0.05, 0.36), eaveY - 0.18, -0.5);       // 槽底
  gut(new THREE.BoxGeometry(gl, 0.18, 0.05), eaveY - 0.09, -0.70);      // 院侧翻边
  gut(new THREE.BoxGeometry(gl, 0.18, 0.05), eaveY - 0.09, -0.29);      // 墙侧翻边
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

  // 石砌排水明沟：沿回廊内侧绕院一周，把四角落水管连成一套排水。
  // 沟比草地略高，中间深色沟槽、两侧石帮；水从檐沟 → 落水管 → 明沟 → 院角小井。
  const CHW = 0.5, hw = CHW / 2, kb = 0.09;              // 沟宽、半宽、石帮宽
  const X0 = gx + 0.5, X1 = gx + garth - 0.5;
  const Z0 = gz + 0.5, Z1 = gz + garth - 0.5;
  const runZ = (Z1 + hw) - (Z0 - hw), runX = (X1 - hw) - (X0 + hw);
  const midX = (X0 + X1) / 2, midZ = (Z0 + Z1) / 2;
  // 排水构件都打 userData.drain 标签，供 tools/check-rain.mjs 做“水位连通”正向校验
  const dr = (tag, geo, mat, x, y, z) => { const m = solid(geo, mat, x, y, z); m.userData.drain = tag; g.add(m); };
  for (const cx of [X0, X1]) {                           // 西 / 东两条：沿 z
    dr('channel', new THREE.BoxGeometry(CHW, 0.08, runZ), mats.wallDark, cx, 0.1, midZ);
    for (const s of [-1, 1]) dr('channel', new THREE.BoxGeometry(kb, 0.18, runZ), mats.wall, cx + s * (hw - kb / 2 - 0.03), 0.13, midZ);
  }
  for (const cz of [Z0, Z1]) {                           // 北 / 南两条：沿 x
    dr('channel', new THREE.BoxGeometry(runX, 0.08, CHW), mats.wallDark, midX, 0.1, cz);
    for (const s of [-1, 1]) dr('channel', new THREE.BoxGeometry(runX, 0.18, kb), mats.wall, midX, 0.13, cz + s * (hw - kb / 2 - 0.03));
  }
  // 四角落水管 + 沟里的小井（雨水先落井、再沿沟走）
  const pipeG = new THREE.CylinderGeometry(0.09, 0.09, 4.4, 8);
  const basinG = new THREE.CylinderGeometry(0.22, 0.26, 0.22, 10);
  for (const cx of [X0, X1]) for (const cz of [Z0, Z1]) {
    dr('pipe', pipeG, mats.lead, cx, 2.2, cz);
    dr('basin', basinG, mats.lead, cx, 0.14, cz);
  }

  // 出水：四角的水都往东南角（X1,Z1）汇，接一根暗管（涵洞）穿过东翼地面，
  // 排到院外过道里的**渗井**——这就是这套排水的终点，水最后渗进地下。
  const soakX = 44.3;
  dr('culvert', new THREE.BoxGeometry(soakX - X1, 0.4, 0.4), mats.lead, (X1 + soakX) / 2, -0.24, Z1);
  dr('soak', new THREE.CylinderGeometry(0.72, 0.8, 0.55, 12), mats.wallDark, soakX, -0.3, Z1);    // 井圈（埋在地下）
  dr('soak', new THREE.CylinderGeometry(0.6, 0.6, 0.12, 12), mats.lead, soakX, 0.0, Z1);           // 井篦（看得见）
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
  // 东墙一排（外移到新东墙内侧）：正面朝西（+z），
  // x = ±8 之间留出 6.8 m 的殡门通道——送葬队伍出殡门一直望得见教堂。
  for (const x of EAST_HOUSE_X) {
    const h = hh[(k + 3) % hh.length];
    const hd = 8.0 + rnd() * 1.6;
    const house = canonHouse(9.2, hd, h, mats, rnd, 'tile');
    house.position.set(x, 0, EZ2 + 0.4 + hd / 2);
    g.add(house);
    k++;
  }
  return g;
}

// 墓地：北侧划一块地，成排的墓碑与十字，另种几棵紫杉。
// 北扩之后旧北墙外还有一条 12 m 宽的带子，接一块墓园扩展（同一套碑式）。
function buildGraveyard(mats, rnd) {
  const g = new THREE.Group();
  const PLOTS = [
    [-46, -26, -44, 46],    // 现状墓地：东缘停在耳堂臂（x≈-24）之外，免得草坪压到地坪
    [-63, -53, -43, 45],    // 北扩带的墓园扩展：贴着旧北墙外侧，与草药圃分居南北
  ];
  const tombG = new THREE.BoxGeometry(0.66, 0.9, 0.18);
  const crossV = new THREE.BoxGeometry(0.12, 1.15, 0.12);
  const crossH = new THREE.BoxGeometry(0.6, 0.12, 0.12);
  for (const [gx0, gx1, gz0, gz1] of PLOTS) {
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(gx1 - gx0, gz1 - gz0), mats.grass);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set((gx0 + gx1) / 2, 0.04, (gz0 + gz1) / 2);
    lawn.receiveShadow = true;
    lawn.userData.buildSkip = true;
    g.add(lawn);
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
  // 后殿东侧的绕殿巡游道（旧东排住宅外移后腾出来的环道，压实地）
  patch(mats.earth, 75, 17, 3.5, -49.5, 0.03);
  // 南侧长条土院子（回廊与旧南墙之间）
  patch(mats.earth, 9, 125, 47.5, 12.5, 0.03);
  // 北侧步道（前庭 → 北侧草地）
  patch(mats.paving, 2, 42, -17.5, 31, 0.06);

  // ---------- 扩建带地面 ----------
  // 南扩带：酿酒坊大院（压实土）
  patch(mats.earth, 20, 136, 66, 10, 0.03);
  // 服务巷：粮车与酒桶往来，铺一层碎石料
  patch(mats.path, LANE.x1 - LANE.x0, LANE.z1 - LANE.z0, (LANE.x0 + LANE.x1) / 2, (LANE.z0 + LANE.z1) / 2, 0.05);
  // 东扩带：宅地与园圃的草底
  patch(mats.grass, 100, 20, 6, -68, 0.035);
  patch(mats.grass, 20, 20, -54, -68, 0.035);
  // 酒花圃 / 教士菜园（东扩带西段，绕殿巡游道与教士住宅之间）
  patch(mats.bed, 38, 11, -27, -63.5, 0.05);
  patch(mats.bed, 48, 11, 20, -63.5, 0.05);
  // 北扩带：草底 + 药圃 + 墓园扩展的草坪（墓园那块由 buildGraveyard 铺）
  patch(mats.grass, 12, 136, (NX2 + NX) / 2, 10, 0.03);
  patch(mats.bed, 10, 30, -58, 62, 0.05);
  // 旧北墙缺口（z = 4）到草药圃的碎石踏步
  patch(mats.paving, 15, 3, -58, 4, 0.055);
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
    [20, 44], [38, 8], [66, -50],   // 原 [48,30] 压在南排 z=31.6 的教士住宅里，挪进酿酒坊大院
    [-24, -12], [-38, 18], [-20, 46],
    [44, 60], [-44, 64], [8, 74], [-10, 74], [50, -8], [-30, -50], [30, -50],
  ];
  for (const [x, z] of spots) g.add(makeTree(mats, 0.9 + rnd() * 0.6, rnd, x, z, false));
  return g;
}

export function buildTown(labels = []) {
  const mats = townMaterials();
  const rnd = mulberry32(20260910);
  const root = new THREE.Group();

  root.add(buildGround(mats));
  // 领地之外是田野，别让灰色广场一直铺到天边（广场是主场景里铺好的，这里只盖外面）
  const outerGrass = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats.grass);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z);
    m.receiveShadow = true; m.userData.buildSkip = true;
    return m;
  };
  root.add(outerGrass(150, 48, 6, 102));    // 西墙外（按新四至加宽）
  root.add(outerGrass(150, 44, 6, -100));   // 东墙外（新东墙 -78 之外）
  root.add(outerGrass(5, 156, 78.5, 0));    // 新南墙外的窄边
  root.add(outerGrass(5, 156, -66.5, 0));   // 新北墙外的窄边
  root.add(buildCloister(mats));
  root.add(buildHouses(mats, rnd));
  root.add(buildGraveyard(mats, rnd));
  root.add(buildMarket(mats, rnd));
  root.add(buildBrewery(mats));
  root.add(buildGardens(mats));
  root.add(buildTrees(mats, rnd));

  labels.push({ text: '回廊（修士的日常动线）', pos: [30.7, 7.5, 25.2], scope: 'out' });
  labels.push({ text: '北侧墓地', pos: [-32, 3, 0], scope: 'out' });
  labels.push({ text: '西前庭集市', pos: [13, 6, 66], scope: 'out' });
  labels.push({ text: '酿酒坊大院', pos: [59, 12, 20], scope: 'out' });
  labels.push({ text: '绕殿巡游道 · 园圃', pos: [4, 9, -66], scope: 'out' });
  labels.push({ text: '墓园扩展（北扩）', pos: [-58, 8, 0], scope: 'out' });
  // 标记领地网格：针对教堂外壳的检查器（穿刺等）可以据此跳过领地
  root.traverse((o) => { if (o.isMesh) o.userData.town = true; });
  return root;
}

// 排水演示页（tools/drainage.html）用：把回廊排水的关键几何算出来，与 buildCloister 同步。
// 返回世界坐标：明沟四角、屋面内/外檐的位置与高度、坡屋面走向、渗井位置。
export function drainageInfo() {
  const { x0, z0, garth, depth } = CLO;
  const gx = x0 + depth, gz = z0 + depth, D = depth, H = 4.4;
  const hd = (D + 0.9) / 2, th = -Math.atan2(1.1, D);
  const ct = Math.cos(th), st = Math.sin(th);
  const zAt = (lz, ly) => D / 2 + ly * st + lz * ct;   // 屋面局部 z → 走廊局部 z
  const yAt = (lz, ly) => H + 0.95 + ly * ct - lz * st;
  const zIn = zAt(-hd, -0.15), zOut = zAt(hd, -0.15);
  const yIn = yAt(-hd, -0.15), yOut = yAt(hd, -0.15);
  const X0 = gx + 0.5, X1 = gx + garth - 0.5, Z0 = gz + 0.5, Z1 = gz + garth - 0.5;
  return {
    gx, gz, garth, depth, X0, X1, Z0, Z1, yIn, yOut, yGut: yIn - 0.16, yChan: 0.14,
    // 四面屋面的内檐（低）/ 外檐（高）世界坐标（西/东给 x，北/南给 z）
    eaveIn: { W: gx - zIn, E: gx + garth + zIn, N: gz - zIn, S: gz + garth + zIn },
    eaveOut: { W: gx - zOut, E: gx + garth + zOut, N: gz - zOut, S: gz + garth + zOut },
    soak: { x: 44.3, z: Z1 },
  };
}

// 酿酒坊演示页（tools/brewery.html）与酿酒排水校验用：把大院的几何算出来，
// 与 buildBrewery 同源同一组常量，改一处两边一起变。
export function brewInfo() {
  return {
    // 领地四至（新 / 旧）
    bounds: { SX: SX2, NX: NX2, WZ, EZ: EZ2 },
    oldBounds: { SX, NX, EZ },
    // 大院与服务巷、水井
    yard: { x0: SX, x1: SX2, z0: EZ, z1: WZ },
    lane: { ...LANE },
    well: { ...WELL },
    // 六座建筑：footprint + 檐高 / 脊高（脊高 = h + rh），屋面挑檐 0.5 m
    buildings: BREW.map((b) => ({
      key: b.key, name: b.name, x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1,
      h: b.h, rh: b.rh, eaveY: b.h, ridgeY: b.h + b.rh, overhang: 0.5,
      stone: !!b.stone, roof: b.roof,
      eaveW: b.x0 - 0.5, eaveE: b.x1 + 0.5,   // 东 / 西檐口的世界 x
      eaveN: b.z0 - 0.4, eaveS: b.z1 + 0.4,   // 北 / 南檐口的世界 z
    })),
    // 门位（世界坐标）
    gates: {
      wagon: { x: SX2, z: WAGON_Z, a: 2.6 },   // 新南墙粮车门
      wagonOld: { x: SX, z: WAGON_Z, a: 2.6 }, // 旧南墙（大院与领地之间）
      funeral: { x: FUNERAL_X, z: EZ2, a: 1.7 },
      wicket: { x: NX2, z: WICKET_Z, a: 1.0 },
    },
    // 教士住宅东排新址（x）与旧址（z），画图时对得上
    houses: { x: [...EAST_HOUSE_X], oldZ: { z0: EZ + 0.4, z1: EZ + 9.6 } },
    // 排水：与 buildBreweryDrain 同源。runs 是每座建筑自己的檐沟 / 集水管 / 落水管，
    // check-brew 拿它逐座比对场景里的网格，brewery.html 拿它铺水路动画。
    drain: {
      pipeX: DRAIN.pipeX,
      yChan: DRAIN.chY1,
      channel: {
        x0: DRAIN.chX0, x1: DRAIN.chX1, y0: DRAIN.chY0, y1: DRAIN.chY1,
        z0: DRAIN.chZ0, z1: DRAIN.chZ1,
      },
      outlet: { x: (DRAIN.chX0 + DRAIN.chX1) / 2, z: DRAIN.chZ0 },   // 明沟东端出口
      culvert: { x: DRAIN.soak.x, z0: -46.4, z1: -40, y0: -0.44, y1: -0.04 },
      soak: { ...DRAIN.soak },
      runs: BREW.map((s) => {
        const eaveX = s.x0 - 0.5, ey = s.h, arm = DRAIN.pipeX < eaveX - 0.24;
        return {
          key: s.key, name: s.name, eaveX, eaveY: ey, z0: s.z0, z1: s.z1,
          ridgeX: (s.x0 + s.x1) / 2, ridgeY: ey + s.rh,
          gutter: {
            x0: eaveX - 0.24, x1: eaveX + 0.48, y0: ey - 0.58, y1: ey - 0.42,
            z0: s.z0 - 0.3, z1: s.z1 + 0.3,
          },
          arm: arm ? {
            x0: DRAIN.pipeX - 0.16, x1: eaveX - 0.1, y0: ey - 0.58, y1: ey - 0.42,
            z0: s.z0, z1: s.z0 + 0.3,
          } : null,
          spout: { x: DRAIN.pipeX, z: s.z0 + 0.15, y0: 0.24, y1: ey - 0.58 },
        };
      }),
    },
  };
}
