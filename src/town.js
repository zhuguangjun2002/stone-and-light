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
import { buildGear, gearAnchor } from './brewery-gear.js';
import { buildVineyard, buildHopYard } from './plantations.js';

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
// 大院排水：八座建筑贴巷那面的檐口下挂檐沟 → 巷东缘一列落水管 → 服务巷东缘的明沟 →
// 东端出口转暗管 → 渗井。构件都打 userData.brew 标签，tools/check-brew.mjs 做正向连通校验，
// tools/brewery.html 拿同一份几何画水路（与 buildBreweryDrain 同源，改一处两边一起变）。
const DRAIN = {
  pipeX: 61.86,               // 落水管全排在巷东缘同一条线上（各建筑檐口深浅不一，靠集水管找齐）
  chX0: 61.0, chX1: 61.95,    // 明沟压着服务巷东缘；x1 让开粮仓/酒窖的墙面（x0=62）
  chY0: 0.07, chY1: 0.19,     // 沟面 0.19 比巷面（0.05）高一截，水才落得进去
  // 明沟东端原在 z=-40（＝服务巷东头）。葡萄酒窖 spout 落在 z=-61.85、压榨房 -45.85，
  // 都在旧沟端以东，不把沟延过去这两根管子就会掉在裸地上。延到 -63（不是更远的 -64/-78）：
  // 再往东就从渗井头顶上穿过去了，check-brew 第 6 项"渗井露天"会当场报错。
  chZ0: -63, chZ1: 76,        // 西头到巷的尽头为止
  // 渗井跟着挪到明沟**东端出口的外侧**（z -64，就在出口东边 1 m）：水从沟尾直接掉进井里。
  // 原址 (61.475,-46) 现在正压在延长后的明沟底下，同样过不了"渗井露天"。
  // 井不在葡萄园里：园子的行从 z=-65.5 起，井篦边到 -64.8，还差 0.55 m。
  soak: { x: 61.475, z: -64 },
};
// 暗管：明沟出口 → 渗井，整根埋在地下。**只算一次**：buildBreweryDrain 拿它摆几何，
// brewInfo().drain 拿它回传给 tools/brewery.html 画水路——两边必须是同一个数。
// （上一版几何那边由 chZ0/soak 现算、brewInfo 这边却还写死 `z0:-46.4, z1:-40`，
//   沟延到 -63、渗井挪到 -64 之后两者就对不上了：演示页的水会飞到一根不存在的管子里。）
// 两端各多伸 0.3 m：一头咬住明沟出口，一头咬进渗井井圈。
function brewCulvert() {
  const z0 = Math.min(DRAIN.chZ0, DRAIN.soak.z) - 0.3;
  const z1 = Math.max(DRAIN.chZ0, DRAIN.soak.z) + 0.3;
  return { x: DRAIN.soak.x, z0, z1, y0: -0.44, y1: -0.04, y: -0.24, len: z1 - z0, cz: (z0 + z1) / 2 };
}
// 教士住宅东排（外移后的新址）：x≈0 留出 6.8 m 的殡门通道，原 [-5.5, 6] 会挡住轴线。
// -17 改成 -18.5：房宽 9.2 m，-17 与 -8 只隔 9 m，两栋会咬在一起（压墙面共面）。
const EAST_HOUSE_X = [-40, -28.5, -18.5, -8, 8, 17.5, 29, 40.5];

// 酿酒坊大院的八座建筑（世界坐标；x 是进深、贴服务巷的那面开门（x0 朝西），z 是长度、沿院墙）。
// 按 z 升序排，也就是**自东向西**一条啤酒生产流：收粮 → 烘干 → 浸麦发芽 → 煮酒 → 冷却发酵 → 陈酿售卖。
// 东头再接上葡萄酒那条线：葡萄园(z -78…-64) → 葡萄酒窖(-62…-48) → 压榨房(-46…-32)，
// 与啤酒线并排，物理上读得出先后（依据 docs/brew-plan.md 二·最终布局、docs/wine-research.md）。
//
// 每条另带一个 stage（这道工序在做什么）。它有两个用处：
//   · buildTown() 把它拼进主站标注，于是 L 键一开每座房子自己说得出是干什么的
//     （此前这六个名字只喂给 tools/brewery.html，主站一个都没有）；
//   · tools/brewprocess.html 演示页从 brewInfo().buildings[].stage 取同一份，
//     不在页面里另抄一遍。加工序只改这张表。
//
// 新增两座的坐标是**被旁边的东西挤出来的**，不是随手画的：
//   · x0 = 62.4 而不是 62：巷里要塞檐沟(61.62)、落水管(61.86)、明沟(61.0…61.95)
//     与渗井井篦（半径 0.8，边在 62.275），酒坊北墙再往外挪就压上去了（见 DRAIN）；
//   · z 之间一律留 2 m：葡萄酒窖 -62…-48、压榨房 -46…-32、粮仓 -30…-12，
//     两栋贴死会把山墙挤在同一平面上，check-zfight 按 6 cm 阈值判成共面。
const BREW = [
  { key: 'winecellar', name: '葡萄酒窖', stage: '陈酿 · 存酒', x0: 62.4, x1: 75, z0: -62, z1: -48, h: 4.8, rh: 1.9, roof: 'tile', stone: true },
  { key: 'press',      name: '压榨房',   stage: '压榨 · 取汁', x0: 62.4, x1: 74, z0: -46, z1: -32, h: 6.2, rh: 2.6, roof: 'slate' },
  { key: 'granary',   name: '粮仓',      stage: '收大麦 · 麦芽', x0: 62, x1: 74, z0: -30, z1: -12, h: 7.2, rh: 3.0, roof: 'slate', hoist: true },
  { key: 'kiln',      name: '烘干窑',    stage: '烘麦芽', x0: 64, x1: 74, z0: -6,  z1: 6,   h: 6.4, rh: 2.6, roof: 'tile', stone: true,
    chimney: { x: 73, z: -5, h: 13.5 } },
  { key: 'malthouse', name: '麦芽楼',    stage: '浸麦 · 发芽', x0: 63, x1: 74, z0: 8,   z1: 24,  h: 8.8, rh: 3.4, roof: 'slate' },
  { key: 'brewhouse', name: '煮酒房',    stage: '糖化 · 煮酒', x0: 63, x1: 74, z0: 28,  z1: 44,  h: 8.0, rh: 3.2, roof: 'tile' },
  { key: 'cooling',   name: '冷却·发酵', stage: '冷却麦汁 · 发酵', x0: 63, x1: 74, z0: 50,  z1: 60,  h: 5.6, rh: 2.4, roof: 'tile' },
  { key: 'cellar',    name: '酒窖·酒肆', stage: '陈酿 · 售卖', x0: 62, x1: 75, z0: 62,  z1: 76,  h: 6.6, rh: 2.8, roof: 'tile', stone: true },
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
  const steam = new THREE.MeshStandardMaterial({
    color: '#e8e4dc', roughness: 1, transparent: true, opacity: 0.3,
    depthWrite: false, emissive: '#8a857c',
  });
  steam.userData.noBake = true;
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
    // ---------- 葡萄与酒花（buildVineyard / buildHopYard 用）----------
    // 两种藤的绿不是一个色：葡萄叶宽而密、酒花叶窄茎粗，混成一个绿就分不出哪片是葡萄。
    vine: M('#556b39', 1),          // 葡萄藤的叶
    trunkV: M('#6a563a', 0.9),      // 葡萄的老藤干
    // 深紫（#4b2a52）在领地这套偏暗的光里会糊成黑点，远看像"没有果子"，
    // 所以提亮到 #5e3160——比真葡萄显眼，品种与年份一概不写（docs/wine-research.md 第五节）。
    grape: M('#5e3160', 0.42),     // 葡萄（紫）；果串走 InstancedMesh，零星几串白葡萄
    grapeW: M('#a8ad6a', 0.42),    // 白葡萄
    hopLeaf: M('#6d8442', 1),      // 酒花藤
    hopCone: M('#8fa23f', 0.9),    // 酒花球果（垂在铁丝下）
    fence: M('#6f5a3e', 0.95),     // 园圃的矮篱（编枝）
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
    // ---------- 酒坊"半室内"材质 ----------
    // 房子从实心盒子改成空壳之后，室内只剩 HemisphereLight 与天光，太阳被屋面挡住，
    // 于是屋里是全暗的（实测墙面 RGB 40 上下，铜锅与麦芽堆基本看不出形体）。
    // 回廊踩过同一个坑，README 记着"屋面底面实测 RGB 1,2,2"，当时就是靠给 clo* 那组材质
    // 加自发光当漫射补光解决的。这里照抄那个办法，但自发光要**更强**：
    // 酒坊屋里没有天穹漏进来（回廊顶有缝），补光得自己把整个屋子照到能读出器物。
    // **不要**为此把这些材质从 noBake 里放出来让它们进烘焙——BAKE_VER 与 IndexedDB
    // 缓存会整片失效、Worker 时间翻倍，代价远大于这点补光。
    // 值是试出来的：brewInner 自发光 '#7d7057' 时墙面到 RGB 150 上下、器物轮廓读得出；
    // 再高就发灰、失掉"屋里比屋外暗"的层次。
    brewInner: M('#cabd9e', 0.95, { emissive: '#7d7057' }),   // 墙的屋内那一面
    // 地坪自发光要比墙再低一档：地是屋里受光最多的面（半球光直接打进来），
    // 给到跟墙一样亮会过曝成一片白，反而看不出器物落在地上的影子。
    brewFloor: M('#9c9078', 1, { emissive: '#4a4437' }),
    // ---------- 器具（src/brewery-gear.js 用） ----------
    // 器具只在屋里出现，所以一律带一点自发光（约本色的一半），
    // 否则木桶、铜锅、麦芽堆在暗屋里会糊成一片黑，连轮廓都读不出。
    sack: M('#9c8b66', 1, { emissive: '#4e4633' }),          // 麻袋 / 湿麻布
    malt: M('#c2a464', 1, { emissive: '#615132' }),          // 摊开的麦芽、槽里的醪
    wort: M('#b3712a', 0.55, { emissive: '#593815' }),       // 麦汁
    ash: M('#4a423a', 1, { emissive: '#25211d' }),           // 灰坑
    copper: M('#b5743a', 0.35, { emissive: '#4a3018', metalness: 0.75 }),   // 煮酒锅 / 龙头
    oak: M('#6b4c2c', 0.8, { emissive: '#352616' }),         // 橡木大桶
    earthen: M('#a9714a', 0.9, { emissive: '#543825' }),      // 陶杯
    // 蒸汽：糖化/煮酒那几步冒的白汽。**必须透明** —— rainscan 的 blocksRain() 会跳过透明材质，
    // 这正是我们要的：一团蒸汽挡在屋里不该被算成"屋顶漏雨"。depthWrite: false 同理（纯视觉）。
    steam,
    // 屋里的木料与石作同理：木料本身很暗，屋里又没光，不补一点就只剩几道黑线。
    // 这几条只给**屋内**用（brewHouse 的立贴/腰梁、brewery-gear.js 的全部器具），
    // 屋外的木构仍用 timber / wallDark，免得整个院子的木料都在夜里发亮。
    brewBeam: M('#5a4128', 0.85, { emissive: '#2f2517' }),   // 立贴、腰梁、器具上的木架
    brewWood: M('#4a3320', 0.8, { emissive: '#291d12' }),    // 器具上的木板、桶、桌凳
    brewStone: M('#a2957c', 0.95, { emissive: '#524a3c' }),   // 炉膛、灶台、石台基
    awning: [M('#8a3a34', 0.9), M('#3a5a6a', 0.9), M('#7a6a2a', 0.9)],
    // 回廊是"半室内"：屋面盖住走廊，阴影里只有天穹底色漏一点，墙和顶会黑到读不出体量
    // （实测屋面底面 RGB 1,2,2）。这四条是回廊专用材质，加一点自发光当作来自内院/天光的
    // 漫射补光，把墙身和顶重新抬出来。不用全局 AmbientLight：教堂内部靠烘焙顶点色吃饭。
    cloWall: M('#c4b9a1', 0.95, { emissive: '#4a4438' }),
    cloWallDark: M('#a2957c', 0.95, { emissive: '#3e382e' }),
    cloSlate: M('#4e5766', 0.8, { emissive: '#242a33' }),
    cloPath: M('#948e80', 1, { emissive: '#332f28' }),
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

// 一片墙：厚 tw、沿局部 X 长 len、高 h，可选在正中开一个 dw×dh 的方门洞。
// 网格用**六面材质数组**：朝屋内的那一面换成 brewInner，其余面还是外面的墙料。
// BoxGeometry 的六个 group 顺序是 +X / -X / +Y / -Y / +Z / -Z，innerIdx 指哪一个是屋内面。
function wallSlab(len, tw, h, outer, inner, innerIdx, door) {
  const six = [outer, outer, outer, outer, outer, outer];
  six[innerIdx] = inner;
  const put = (l, hh, cx, cy) => {
    if (l <= 0.02 || hh <= 0.02) return null;
    const m = new THREE.Mesh(new THREE.BoxGeometry(l, hh, tw), six);
    m.position.set(cx, cy, 0);
    m.castShadow = m.receiveShadow = true;
    m.userData.buildSkip = true;
    return m;
  };
  // 永远返回 Group（哪怕只有一片）：调用方要在组上摆位置与朝向，
  // 若无门洞时返回 Mesh，调用方那一句 position.set 就会把 put() 里算好的 y=h/2 覆盖成 0，
  // 墙会掉到地面以下去（南墙/东西两面都中过这个招）。
  const g = new THREE.Group();
  if (!door) { const m = put(len, h, 0, h / 2); if (m) g.add(m); return g; }
  // 门洞：左右两片 + 洞顶以上一片。三片共用同一组材质数组，屋内面还是同一面。
  // 两片的中心 = 各自那一段的**中点**（左片 [-half, -dw/2]、右片 [dw/2, half]），
  // 也就是 `-half + side/2`、`half - side/2`。
  // 早先写的是 `-half - dw/2 + side / 2`，多减了一次 dw/2，整片往外挪了 1.8 m：
  // 门两侧各空出一道 1.8 m 宽、通高的口子，墙还越过山墙伸到屋外 1.8 m。
  // 单看某一座房子时它只是"墙比房子长一点"，八座挨着摆就露馅 —— 两座 x0 相同的房子
  // （葡萄酒窖与压榨房都是 62.4）伸出去的两段正好落在同一张 x 平面上，
  // tools/check-zfight.mjs 按"几乎共面 + 投影重叠"报成一对（严格模式 0.004 m 仍报 2 处）。
  const half = len / 2, dw = door.w, dh = door.h, side = half - dw / 2;
  if (side > 0.02) {
    const m = put(side, h, -half + side / 2, h / 2); if (m) g.add(m);
    const m2 = put(side, h, half - side / 2, h / 2); if (m2) g.add(m2);
  }
  const above = h - dh;
  if (above > 0.02) { const m = put(dw, above, 0, dh + above / 2); if (m) g.add(m); }
  return g;
}

// 屋内地坪顶面高度。院子那张压实土平面（buildGround 的 mats.earth）在 y = 0.03，
// 它是一整张 PlaneGeometry，**从房子底下穿过去**——所以地坪顶面必须高过它，
// 否则从屋里往外看，那张土平面就浮在室内地面上方 3 cm，比地坪还高。
// 0.10 − 0.03 = 7 cm，大于 check-zfight 的 6 cm 共面阈值，不会判成打架；
// 同时 7 cm 又是个真实的门槛高：从巷里进屋要抬一下脚。
export const BREW_FLOOR_Y = 0.10;

// 酒坊的大门：门洞开在贴巷那面（房子局部 x = -w/2）。
// 结构照 src/facade.js 的 doorAssembly()，但简化：只做两扇大门板 + 铁铰链带 + 门环，
// 不做便门（酒坊的大门本来就是推开来往搬麦芽桶的）。枢轴组挂 userData.door，于是
// src/doors.js 的 collectDoors / setDoorState / updateDoors / doorBlocks 全都认得它——
// 开关、缓动、关门挡人、雨雪天自动关，全部直接拿到，不用再写一遍。
//
// 朝向：门组的局部 **+Z 指向屋外**（世界 -x，靠服务巷那面），局部 +X 指向门宽方向
// （世界 +z），用 ry = -π/2 达成。**门宽必须在局部 X 上**：门洞开在北墙里，墙沿 z 走，
// 两扇门的铰轴要沿 z 分开才落在门洞两侧；放错到局部 Z 就会分到墙的厚度方向去，
// 两扇门一前一后错开、门洞中间是空的（几何上仍然过 doorBlocks，但看着是道错门）。
// doors.js 的 targetFor() 给的角度符号（-side × max）正好让门扇朝局部 -Z 摆，也就是往屋里开——
// 巷子只有 4 m 宽，门扇扫到巷里会挡修士走路，也会插进对面停着的粮车。
function brewDoor(spec, mats, dw, dh) {
  const grp = new THREE.Group();
  const DT = 0.12;                      // 门板厚（沿局部 Z）
  const REB = 0.03;                     // 门板比门洞宽出的一点：压在门框上，不漏光缝
  const leafW = dw / 2 + REB;
  for (const side of [-1, 1]) {         // -1 沿 -z 的那扇，+1 沿 +z 的那扇
    const pivot = new THREE.Group();
    pivot.position.set(side * (dw / 2 + REB), 0, 0);
    pivot.userData.door = { side, max: 1.35 };    // 只开到 77°，再大门板尖端会插进门框石头
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, dh + REB, DT), mats.wood);
    leaf.position.set(-side * leafW / 2, (dh + REB) / 2, 0);
    leaf.castShadow = leaf.receiveShadow = true;
    leaf.userData.buildSkip = true;
    pivot.add(leaf);
    // 正面三道铁铰链带 + 门框里的销轴（pintle）：中世纪的做法是转轴在门框上，不在门板上
    for (const hy of [dh * 0.16, dh * 0.52, dh * 0.88]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(leafW * 0.72, 0.13, 0.03), mats.lead);
      strap.position.set(-side * leafW / 2, hy, DT / 2 + 0.015);
      strap.castShadow = true;
      strap.userData.buildSkip = true;
      pivot.add(strap);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), mats.lead);
      pin.position.set(side * (leafW / 2 - 0.01), hy, 0);
      pin.userData.buildSkip = true;
      pivot.add(pin);
    }
    // 门环：铁底板 + 拉环（1.05 m 高）
    const ringX = -side * (leafW / 2 - 0.24);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 12), mats.lead);
    plate.rotation.x = Math.PI / 2;
    plate.position.set(ringX, 1.05, DT / 2 + 0.012);
    plate.userData.buildSkip = true;
    pivot.add(plate);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.017, 6, 14), mats.lead);
    ring.position.set(ringX, 1.0, DT / 2 + 0.03);
    ring.rotation.x = 0.5;
    ring.userData.buildSkip = true;
    pivot.add(ring);
    grp.add(pivot);
  }
  // 门楣：洞顶那根过梁木（从前是"在门洞上方贴一块板"，现在洞是真的，得有东西兜住）。
  // 两处尺寸都要挑：
  //  · **上缘探进门楣以上的墙体**（中心放在 dh - 0.03，厚 0.34 ⇒ 上缘到 dh + 0.14），
  //    正好停在 dh 上时门楣下皮与墙下皮共面；
  //  · **进深 0.3，比 0.5 的墙薄**——做成 0.42 时两端离墙面只有 4 cm，正好压在
  //    check-zfight 的 6 cm 阈值上（每座报两处 0.5 m²）。0.3 则两端各留 10 cm。
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.7, 0.34, 0.3), mats.timber);
  lintel.position.set(0, dh - 0.03, 0);
  lintel.castShadow = lintel.receiveShadow = true;
  lintel.userData.buildSkip = true;
  grp.add(lintel);
  grp.userData.doorId = `brew-${spec.key}`;
  grp.userData.doorName = spec.name;    // 名字跟 BREW 走，不在 doors.js 的表里再抄一遍
  grp.userData.doorTown = true;         // K 键不管它、雨雪天照样关、主站平面图里不画
  grp.userData.doorHalf = dw / 2;       // 碰撞用：门洞半宽（沿 z）
  return grp;
}

// 酒坊单体：四片墙 + 地坪 + 两片坡板屋面（脊沿 z）+ 山墙 + 贴巷那面的真门洞与真门扇，
// 外加屋内那套对应工序的陈设。
//
// 2026-10-08 之前这里是**一整块实心** BoxGeometry(w, h, d)，门是贴在墙外的一块 16 cm 薄板、
// 没有 userData.doorId —— 所以 src/doors.js 的门系统里从来就没有这八座房子，
// `K` 键、`E` 键、第一人称碰撞全都够不着它们，屋里也什么都没有。
// 改成空壳之后下面几件事必须同时做，否则会踩坑：
//   · 门：brewDoor() 给它 userData.doorId，doors.js 整套（开关/缓动/挡人/天气）直接生效；
//   · 墙面：屋里那一面换 brewInner（带自发光当漫射补光），不然读不出器物
//     —— 参考回廊那组 clo* 材质当初就是为了同一件事才加的；
//   · 墙厚 0.5 m：足够让 1.4 m 一格的碰撞网格（src/grid.js）在门洞两侧留下实体、
//     中间让开，门才真的走得进去。
function brewHouse(spec, mats, rnd) {
  const g = new THREE.Group();
  const w = spec.x1 - spec.x0, d = spec.z1 - spec.z0, h = spec.h, rh = spec.rh;
  const wallMat = spec.stone ? mats.wall : mats.plaster;
  const roofMat = spec.roof === 'slate' ? mats.slate : mats.tile;
  const cx = (spec.x0 + spec.x1) / 2, cz = (spec.z0 + spec.z1) / 2;
  const TW = 0.5;

  // 门洞：净宽 3.6 m。修士身体半径 0.38 m，门洞净宽要明显大于碰撞格 1.4 m 才让得开。
  const dw = Math.min(3.6, d - 3), dh = Math.min(3.6, h - 1.2);

  // 地坪：厚 0.12，顶面在 BREW_FLOOR_Y（0.10），比院子那张压实土平面（0.03）高 7 cm。
// 见 BREW_FLOOR_Y 的注释：为什么必须是 0.10 而不是 0。
  g.add(solid(new THREE.BoxGeometry(w - 2 * TW + 0.02, 0.12, d - 2 * TW + 0.02),
    mats.brewFloor, 0, BREW_FLOOR_Y - 0.06, 0));

  // 四片墙。北墙（贴巷，局部 x = -w/2）与南墙（+w/2）沿 z 走：用 ry = ∓π/2 把"沿局部 X 长"
  // 转到"沿世界 z 长"，它们的 +Z 面分别指向世界 +x / -x，也就是屋内。
  const north = wallSlab(d, TW, h, wallMat, mats.brewInner, 4, { w: dw, h: dh });
  north.position.set(-w / 2 + TW / 2, 0, 0);
  north.rotation.y = Math.PI / 2;
  g.add(north);
  const south = wallSlab(d, TW, h, wallMat, mats.brewInner, 4, null);
  south.position.set(w / 2 - TW / 2, 0, 0);
  south.rotation.y = -Math.PI / 2;
  g.add(south);
  // 东西两面（z0 朝东、z1 朝西）：不转，屋内面分别是 +Z（东墙）与 -Z（西墙）。
  const east = wallSlab(w - 2 * TW, TW, h, wallMat, mats.brewInner, 4, null);
  east.position.set(0, 0, -d / 2 + TW / 2);
  g.add(east);
  const west = wallSlab(w - 2 * TW, TW, h, wallMat, mats.brewInner, 5, null);
  west.position.set(0, 0, d / 2 - TW / 2);
  g.add(west);

  // 门扇：装在门洞中间那圈墙里（x = -w/2 + TW/2），朝屋里开
  const door = brewDoor(spec, mats, dw, dh);
  door.position.set(-w / 2 + TW / 2, 0, 0);
  door.rotation.y = -Math.PI / 2;
  g.add(door);

  // 木构：四角立贴 + 一圈腰梁（石砌体不打构架）。
  // 腰梁是**沿四边一圈**的四根梁，不是实心板：原先这里是一整块 w×d 的薄板，藏在
  // 墙身内部看不见；墙改成空壳之后它就成了一块横贯屋内的实心楼板，把器物全埋了。
  // 四角立贴：贴**墙内侧皮**摆，而不是穿在墙厚中间。原来摆成 ±(w/2 - 0.17)，
  // 而墙现在厚 0.5（内侧皮在 ±(w/2 - 0.5)），于是这根 0.26 见方的柱子有一半埋在墙里，
  // 它贴着墙的那一面与墙的内皮落在同一个平面上——check-zfight 每座报一处
  // "间距 0.000 m"。贴内侧皮摆就分开了。
  if (!spec.stone) {
    const postG = new THREE.BoxGeometry(0.26, h, 0.26);
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      g.add(solid(postG, mats.brewBeam,
        sx * (w / 2 - TW - 0.13), h / 2, sz * (d / 2 - TW - 0.13)));
    }
    // 腰梁：一圈四根，沿墙面**内侧皮**摆（同样理由：贴着内皮摆才不会与墙面共面）。
  // 中间是空的，别做成实心板——原先是一整块 w×d 的薄板，藏在墙里看不见；
  // 墙改成空壳之后它就成了一块横贯屋内的实心楼板，把器物全埋了。
  const bw = 0.22, by = h * 0.64;
  for (const sz of [-1, 1]) {
    g.add(solid(new THREE.BoxGeometry(w - 2 * TW, bw, bw), mats.brewBeam, 0, by,
      sz * (d / 2 - TW - bw / 2)));
  }
  for (const sx of [-1, 1]) {
    g.add(solid(new THREE.BoxGeometry(bw, bw, d - 2 * TW), mats.brewBeam,
      sx * (w / 2 - TW - bw / 2), by, 0));
  }
  }

  // 屋面：半宽比墙多挑 0.5 m（檐口），坡板厚 0.26，顶面正好过脊线与檐口。
  // 坡板朝下的那一面（-Y）换成 brewInner —— 那就是屋里的"天花"。不换的话朝下的面只吃到
  // 天穹底色，黑到读不出屋架（回廊那组 clo* 材质当初就是为了这个才加的）。
  const halfW = w / 2 + 0.5, L = Math.hypot(halfW, rh), t = 0.26;
  const phi = Math.atan2(rh, halfW), nx = rh / L, ny = halfW / L;
  const roofMats = [roofMat, roofMat, roofMat, mats.brewInner, roofMat, roofMat];
  for (const s of [1, -1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(L, t, d + 0.8), roofMats);
    slab.position.set(s * (halfW / 2 - nx * t / 2), h + rh / 2 - ny * t / 2, 0);
    slab.rotation.z = -s * phi;
    slab.castShadow = slab.receiveShadow = true;
    slab.userData.buildSkip = true;
    slab.userData.brew = 'roof';   // check-brew / brewery.html 靠这个标签认出屋面
    g.add(slab);
  }
  // 山墙（两端）：三角抹灰板，把屋架下的空腔封住，也补出屋顶下的墙面。
  // 三角比坡板顶面缩进 ~0.1 m：让山墙的斜边埋进坡板里，而不是跟坡板顶面共面（否则会闪）。
  // **位置要压进端墙的厚度里**：墙厚 TW 0.5，所以山墙中心从 s*(d/2 - 0.1) 改成
  // s*(d/2 - TW/2)（0.25）。原先的 -0.1 让山墙那块 0.3 厚的板只与端墙重叠 5 cm，
  // 板的两片面与墙面差 5 cm，check-zfight 按 6 cm 阈值判成共面（每座两处 0.5 m²）。
  const gableG = gableGeometry(halfW - 0.12, h - 0.05, h + rh - 0.14, 0.3);
  for (const s of [1, -1]) {
    const tri = new THREE.Mesh(gableG, wallMat);
    tri.position.z = s * (d / 2 - TW / 2);
    tri.castShadow = tri.receiveShadow = true;
    tri.userData.buildSkip = true;
    g.add(tri);
  }

  // 另两面（x1 朝南、z0 朝东）开窗（一排小窗，够采光即可）
  const winG = new THREE.BoxGeometry(0.14, 1.15, 0.95);
  const nWin = Math.max(2, Math.floor(d / 5));
  for (let i = 0; i < nWin; i++) {
    const z = -d / 2 + (i + 0.5) * (d / nWin);
    g.add(solid(winG, mats.win, w / 2 + 0.03, h * 0.62, z));
  }
  g.add(solid(new THREE.BoxGeometry(1.0, 1.3, 0.14), mats.win, 0, h * 0.5, -d / 2 - 0.06));

  // 半地下酒窖的土坡（spec.berm）：墙外堆三级土台，读作"挖进地里的窖"。
  // 依据 docs/wine-research.md：Clos de Vougeot 的 cellier 是半地下 + 石柱，恒温靠土。
  // **门前那个 1.2 m 地坑不挖**：门外只剩 1.4 m 宽、还要过大院明沟，挖下去会把水路挖断；
  // 改成朝葡萄园那一侧堆土，读的是同一件事，且不碰任何既有构件。
  // 三级台子的内缘一律**探进墙里 0.3 m**：贴着墙面放才是共面（同向法线 + 投影重叠），
  // 埋进墙里就不是了。两端缩进 0.6 m 也一样 —— 顶到 x0/x1 会与端墙外皮落在同一个 x 平面上。
  if (spec.berm) {
    // brewHouse 的组原点在房子中心，而 spec 是世界坐标 —— 这里全部换算成局部坐标再摆。
    const bx0 = spec.x0 + 0.6 - cx, bx1 = spec.x1 - 0.6 - cx, bcx = (bx0 + bx1) / 2;
    const z0 = spec.z0 - cz;
    for (const [bh, zi, zo, bmat] of [
      [1.5, z0 + 0.3, z0 - 0.7, mats.earth],
      [1.0, z0 - 0.7, z0 - 1.6, mats.earth],
      [0.5, z0 - 1.6, z0 - 2.5, mats.grass],
    ]) {
      g.add(solid(new THREE.BoxGeometry(bx1 - bx0, bh, zi - zo), bmat, bcx, bh / 2, (zi + zo) / 2));
    }
  }

  // 屋内陈设：按这道工序摆器具（src/brewery-gear.js，跟"墙怎么砌"分开写）。
  // 器具组整体抬到 BREW_FLOOR_Y：那个文件里所有 y 都按"脚下就是地面"写，
  // 这里把组抬到地坪顶面，器具才正好站在地上而不是陷进去。
  const gear = buildGear(spec, mats, rnd);
  gear.position.y = BREW_FLOOR_Y;
  g.add(gear);

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

// 巷口酒肆招牌：docs/wine-research.md 实测表末行记着的那条"**巷口的酒肆招牌还没挂**"，这里补上。
//
// 挂在酒窖·酒肆（BREW 里的 cellar）朝服务巷那面墙上、**门楣正上方**：北墙外皮在 x = x0，
// 门洞开在这面墙正中，门楣顶在 dh - 0.03 + 0.17（brewDoor 的过梁）。坐标全部从 cellar 这条
// spec 现算，改了房子的位置或门宽，这里自动跟过去。
//
// **挑出去，不贴墙**——这是这一版改动最大的地方。服务巷是南北走向的长条
// （LANE：x 57.5…61.5 / z −40…76），修士沿 z 走；牌面若平行于墙（法线朝 −x），
// 走过的人只有正好与它齐平的那一瞬间才看得正脸，前后 20 m 全是侧看，等于没挂
// （第一版就是这么写的，巷子里实测确实只看得见一条竖线）。改成中世纪酒馆常见的
// **挑出招牌**：挑臂伸出门楣，匾挂在挑臂外端、**板面与墙垂直**（法线朝 ±z），
// 南北两个方向走来的人都正对牌面；两面都做浮雕，谁来都看得见。
//
// 高度：挑臂在门楣之上 0.55 m，匾下沿落在 3.05 m，比一个 1.8 m 的人高出 1.25 m。
// 修士动线在 x 59.0 / 60.3，而匾挂在 x 60.7…61.9、z 69 上下 —— 既够不着人的身体，
// 也不挡道（挑臂最低处 4.22 m）。check-npc 那 0.9 m 高的身体射线打不着（实测跑过）。
//
// 埋与不埋：挑臂内端埋进墙 0.08 m、墙上贴木埋进墙 0.04 m、吊耳两头各埋 0.03 m、
// 桶身埋进匾面（它是浮雕，本来就只露一半）。凡是两块**同向法线**的面不是拉开 6 cm
// 以上就是埋进去——齐平/贴面就是两块同向法线 + 投影重叠的面，check-zfight 按 6 cm 阈值
// 判成共面（同檐沟、灶身、托板那些坑）。
function cellarSign(mats, spec) {
  const g = new THREE.Group();
  const cz = (spec.z0 + spec.z1) / 2;       // 门在墙正中，牌就挂在门楣正上方
  const dh = Math.min(3.6, spec.h - 1.2);
  const lintel = dh - 0.03 + 0.17;          // 过梁顶面（brewDoor：中心 dh-0.03，厚 0.34）
  const armY = lintel + 0.55;               // 挑臂高度
  const bW = 1.15, bH = 1.05, bT = 0.08;    // 匾面：宽（沿 x）1.15 / 高 1.05 / 厚（沿 z）8 cm
  const bx = spec.x0 - 0.70, bY = armY - 0.72;

  // 挑臂：一根横木从墙上伸出去（内端埋进墙 0.08 m）+ 一根斜撑从墙上斜下来托住它的外端
  g.add(solid(new THREE.BoxGeometry(1.40, 0.14, 0.14), mats.timber, spec.x0 - 0.62, armY, cz));
  const brace = solid(new THREE.BoxGeometry(0.95, 0.1, 0.1), mats.timber, spec.x0 - 0.4, armY - 0.36, cz);
  brace.rotation.z = -0.62;
  g.add(brace);
  // 墙上那块贴木（挑臂的座）：薄板钉在墙上，**埋进墙里** 0.04 m，不是贴在墙面上
  g.add(solid(new THREE.BoxGeometry(0.1, 0.46, 0.34), mats.wood, spec.x0 + 0.02, armY, cz));

  // 匾面：竖在挑臂外端、板面与墙垂直。上沿在挑臂底之下 0.055 m，靠两道吊耳连着
  g.add(solid(new THREE.BoxGeometry(bW, bH, bT), mats.wood, bx, bY, cz));
  for (const sx of [-0.42, 0.42]) {
    g.add(solid(new THREE.BoxGeometry(0.07, 0.30, 0.07), mats.lead, bx + sx, armY - 0.09, cz));
  }
  // 上下压边：两面各两道。厚 0.10、**埋进匾面 0.005 m**，露出的那道边离匾面 0.095 m
  // （只露 0.06 就在阈值边上晃，宁可厚一点）
  for (const by of [bY + bH / 2 - 0.045, bY - bH / 2 + 0.045]) {
    for (const sz of [-1, 1]) {
      g.add(solid(new THREE.BoxGeometry(bW + 0.06, 0.09, 0.10), mats.timber,
        bx, by, cz + sz * 0.07));
    }
  }

  // 牌面浮雕：一只横躺的小酒桶（横轴沿 x，跟着匾面的方向横过来）。桶是躺着放的，
  // 两道铁箍要**绕 y 转 90°** 才箍得住 —— 箍默认躺在 XY 平面，直接摆就是一个立着的圈，
  // 比桶还高一大截（cellar() 里那批横躺橡木大桶踩过同一个坑）。
  // 桶心离匾面 0.10、半径 0.24 → 桶背陷进匾面 0.14 m，露出来那一半正好读作浮雕。
  const kegY = bY + 0.09;
  for (const sz of [-1, 1]) {
    g.add(solid(new THREE.CylinderGeometry(0.24, 0.24, 0.60, 12), mats.oak,
      bx, kegY, cz + sz * 0.10).rotateZ(Math.PI / 2));
    for (const sx of [-0.17, 0.17]) {
      g.add(solid(new THREE.TorusGeometry(0.245, 0.02, 6, 14), mats.lead,
        bx + sx, kegY, cz + sz * 0.10).rotateY(Math.PI / 2));
    }
  }
  // 龙头：匾面左下一个铅龙头（内端埋进匾面 0.02 m：齐平就是同向法线 + 投影重叠）
  // + 出水口上一道铜横把，一眼就知道卖的是酒。只挂在朝北那一面，
  // 反面不做 —— 两面各伸一个龙头，朝南看就变成两根管子杵在匾上了。
  g.add(solid(new THREE.CylinderGeometry(0.028, 0.028, 0.22, 8), mats.lead,
    bx - 0.36, bY - 0.26, cz - 0.13).rotateX(Math.PI / 2));
  g.add(solid(new THREE.BoxGeometry(0.14, 0.03, 0.03), mats.copper,
    bx - 0.36, bY - 0.26, cz - 0.24));
  return g;
}

// 储水塔：真实修道院的啤酒厂自己带一座塔（docs/brewery-research.md「后续可放的空间」第一条）。
// 落位在煮酒房与冷却·发酵之间的空档靠东（x 70.4…74 / z 44.4…49.6，tools/probe 实测该块
// 0.05…5 m 无实体），紧挨冷却间——冷却盘与糖化都要水，塔就立在用水的那几座旁边。
//
// 形制：四根石柱撑一只木桶（箍着两道铁圈），顶上盖一个小瓦顶，四面有斜撑。
// 高度约 7.5 m：够压过冷却间（h 5.6）与它自己的瓦顶，又不至于抢戏架的尖塔
// （主塔 64.5 m）。塔顶不冒烟也不参与排水——它是**储水**不是烘干，
// 所以不给 userData.brew 标签，check-brew 仍按八座屋面算（实测 40/40）。
//
// **层与层的接缝一律"埋进去"，不许齐平**：横枋埋进柱头 0.10 m、托板埋进横枋 0.08 m、
// 桶底埋进托板 0.02 m。齐平就是两块同向法线 + 投影重叠的面，check-zfight 按 6 cm 阈值
// 会判成共面——这一段第一版就把托板顶放在枋顶下 1 cm（正好卡在阈值内），
// 一跑就多出四处 0.5 m²，往里埋就干净了。
function waterTower(mats) {
  const g = new THREE.Group();
  const cx = 72.2, cz = 47.0;
  // 四根石柱：柱础 0→0.34，柱身 0.25→3.70（下端埋进柱础 0.09 m）
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = cx + sx * 1.05, pz = cz + sz * 1.05;
    g.add(solid(new THREE.BoxGeometry(0.42, 0.34, 0.42), mats.wallDark, px, 0.17, pz));
    g.add(solid(new THREE.BoxGeometry(0.26, 3.45, 0.26), mats.wall, px, 1.975, pz));
  }
  // 柱头横枋：四根方木围成一圈 3.60→3.80（上端埋进柱头 0.10 m；中间是空的，别做实心板）
  const bw = 0.2;
  for (const sz of [-1, 1]) {
    g.add(solid(new THREE.BoxGeometry(2.36, bw, bw), mats.timber, cx, 3.70, cz + sz * 1.05));
  }
  for (const sx of [-1, 1]) {
    g.add(solid(new THREE.BoxGeometry(bw, bw, 2.36), mats.timber, cx + sx * 1.05, 3.70, cz));
  }
  // 斜撑：四面各两根，从柱头斜撑到横枋（读作"撑住的"，不然像个悬空的木箱）
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const br = solid(new THREE.BoxGeometry(0.11, 2.1, 0.11), mats.timber,
      cx + sx * 0.62, 4.31, cz + sz * 0.62);
    br.rotation.set(sz * 0.72, 0, -sx * 0.72);
    g.add(br);
  }
  // 托板：铺在横枋上的一层板 3.72→3.94（下端埋进枋里 0.08 m，上端高出枋顶 0.14 m，
  // 两个面都离枋顶够远 —— 只埋 0.02 的话上表面仍在 6 cm 阈值内）
  g.add(solid(new THREE.BoxGeometry(2.3, 0.22, 2.3), mats.brewBeam, cx, 3.83, cz));
  // 塔身：一只大木桶（半径 1.18 / 高 2.5），桶底 3.92 埋进托板 0.02 m
  const tY = 3.92 + 1.25;
  g.add(solid(new THREE.CylinderGeometry(1.18, 1.12, 2.5, 16), mats.oak, cx, tY, cz));
  for (const ty of [tY - 0.82, tY + 0.82]) {
    g.add(solid(new THREE.TorusGeometry(1.2, 0.045, 6, 20), mats.lead, cx, ty, cz).rotateX(Math.PI / 2));
  }
  // 塔顶小瓦顶：盖住桶口，桶里的水才不白晒。檐口 6.30 比桶顶 6.42 低 0.12 m
  // （盖进去，不是浮在桶上面），脊 7.5 m
  const roof = new THREE.Mesh(gableRoofGeometry(1.45, 0, 1.2, 2.6), mats.tile);
  roof.rotation.y = Math.PI / 2;
  roof.position.set(cx, 6.3, cz);
  roof.castShadow = roof.userData.buildSkip = true;
  g.add(roof);
  // 出水嘴 + 石槽：塔摆在这儿不是为了看，是为了让煮酒与冷却随时有水可取，
  // 所以嘴要**真接着水**——从桶壁西侧斜伸出来的一截铅嘴，底下架一只石槽接着。
  // 第一版这块是"一根悬空的木槽"（两头都没有东西接），拍出来是根凭空杵着的棍子，删掉重做。
  // 嘴的内端埋进桶壁 0.03 m：桶壁半径在该高度约 1.128，嘴心放到 −1.10 才埋得住，
  // 放 −1.32 就整根悬在桶外（这正是第一版的毛病）。
  const spout = solid(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 8), mats.lead, cx - 1.28, 3.89, cz);
  spout.rotation.z = -0.5;                  // 局部 +y 指向东北 → 管身朝西南下坡
  g.add(spout);
  // 石槽架在 1.5 m 高的石墩上（墩顶 1.50 → 槽底 → 槽沿 1.88），嘴尖离槽面 1.7 m。
  // 槽身四壁**对接**不叠：短壁夹在两道长壁之间，端面正好顶在长壁内皮上，
  // 法线相反不打架；要是让短壁顶到长壁外面，两边外壁就只差 4.5 cm，check-zfight 照报。
  g.add(solid(new THREE.BoxGeometry(0.90, 1.50, 0.56), mats.wallDark, cx - 1.62, 0.75, cz));
  g.add(solid(new THREE.BoxGeometry(1.15, 0.08, 0.62), mats.wall, cx - 1.62, 1.54, cz));
  for (const sz of [-1, 1]) {
    g.add(solid(new THREE.BoxGeometry(1.15, 0.30, 0.09), mats.wall, cx - 1.62, 1.73, cz + sz * 0.265));
  }
  for (const sx of [-1, 1]) {
    g.add(solid(new THREE.BoxGeometry(0.09, 0.30, 0.44), mats.wall, cx - 1.62 + sx * 0.53, 1.73, cz));
  }
  // 槽里那层水：用一片平的面，不用方块 —— 方块埋进四壁里，侧脸离壁只有 1 cm，
  // 平面上只有一张脸，离槽底 0.16 m，两条都躲开 6 cm 阈值。
  const troughWater = new THREE.Mesh(new THREE.PlaneGeometry(0.97, 0.44), mats.water);
  troughWater.rotation.x = -Math.PI / 2;
  troughWater.position.set(cx - 1.62, 1.66, cz);
  troughWater.userData.buildSkip = true;
  g.add(troughWater);
  // 塔梯：贴着东侧柱挂一排横档（立柱内侧埋进石柱 0.03 m，横档搭在两柱之间）
  for (let i = 0; i < 7; i++) {
    g.add(solid(new THREE.BoxGeometry(0.1, 0.07, 0.44), mats.timber, cx + 1.15, 0.55 + i * 0.5, cz));
  }
  for (const sz of [-0.22, 0.22]) {
    g.add(solid(new THREE.BoxGeometry(0.09, 3.6, 0.09), mats.timber, cx + 1.15, 1.9, cz + sz));
  }
  return g;
}

// 烘干窑底下的麦香温床 + 窑前糖化槽：docs/brewery-research.md 同一条里点名的另两件。
// 落位在粮仓（z -30…-12）与烘干窑（z -6…6）之间那块空地（x 64…72 / z -11.6…-6.6，
// tools/probe 实测 0.05…5 m 无实体，只有粮仓的吊麦绞盘在 y 8 以上）。
//
// 为什么摆在这儿：麦芽从烘干窑出来是**滚烫**的，得先摊开降温（这叫 withening，就是
// 「麦香温床」的来处），凉了才好送去破碎；糖化槽则要水要热，紧挨窑与粮仓最顺路。
// 位置也就跟着这条工艺动线定，不是随手放的空地。
function maltYard(mats) {
  const g = new THREE.Group();
  // ---------- 麦香温床：一道 3.8 × 2.6 m 的低矮石床，面上摊一层薄麦芽 ----------
  const bx = 66.6, bz = -9.4;
  g.add(solid(new THREE.BoxGeometry(3.8, 0.72, 2.6), mats.brewStone, bx, 0.36, bz));
  // 床沿压边：四条略高的边，围出一圈浅槽（麦芽摊在槽里，不至于滚到地上）
  for (const [bw, bd, ox, oz] of [[3.9, 0.12, 0, 1.31], [3.9, 0.12, 0, -1.31],
    [0.12, 2.74, 1.91, 0], [0.12, 2.74, -1.91, 0]]) {
    g.add(solid(new THREE.BoxGeometry(bw, 0.16, bd), mats.brewStone, bx + ox, 0.8, bz + oz));
  }
  // 摊开的麦芽：薄薄一层，**离床沿内皮留 6 cm**（齐平会与压边内侧判成共面）
  g.add(solid(new THREE.BoxGeometry(3.56, 0.1, 2.32), mats.malt, bx, 0.77, bz));
  // 翻麦耙：两把插在麦芽堆里，柄斜靠着床沿
  for (const rz of [-0.9, 0.9]) {
    const rake = new THREE.Group();
    rake.add(solid(new THREE.CylinderGeometry(0.045, 0.045, 1.9, 6), mats.brewWood, 0, 0.95, 0));
    rake.add(solid(new THREE.BoxGeometry(0.95, 0.07, 0.14), mats.brewWood, 0, 0.06, 0));
    for (let i = 0; i < 5; i++) {
      rake.add(solid(new THREE.BoxGeometry(0.06, 0.2, 0.05), mats.lead, -0.38 + i * 0.19, -0.06, 0));
    }
    // 耙齿插进麦芽层（齿尖到 0.67，麦芽面 0.82，埋住 0.15 m），耙头横木刚好露在麦芽面上 ——
    // 耙子本来就是插在堆里的，压到 0.74 反而让耙头整根埋进麦芽、只看得见一根棍子。
    rake.position.set(bx + rz, 0.82, bz + 1.05);
    rake.rotation.set(0.18, 0.3, 0.34);
    g.add(rake);
  }
  // ---------- 窑前糖化槽：一只带盖的大木槽，坐在自己的砖灶上 ----------
  const tx = 70.6, tz = -9.2;
  g.add(solid(new THREE.BoxGeometry(1.7, 1.5, 2.4), mats.brewWood, tx, 0.75, tz));
  for (const [bw, bh, bd, ox, oy, oz] of [
    [1.86, 0.13, 0.13, 0, 1.5, -1.2], [1.86, 0.13, 0.13, 0, 1.5, 1.2],
    [0.13, 0.13, 2.54, -0.86, 1.5, 0], [0.13, 0.13, 2.54, 0.86, 1.5, 0]]) {
    g.add(solid(new THREE.BoxGeometry(bw, bh, bd), mats.brewBeam, tx + ox, oy, tz + oz));
  }
  // 槽盖：斜搭着的一块板（糖化要保温，但不是盖死的）
  const lid = solid(new THREE.BoxGeometry(1.8, 0.09, 1.3), mats.brewWood, tx, 1.63, tz - 0.32);
  lid.rotation.z = 0.24;
  g.add(lid);
  // 槽里的麦芽醪：盖没盖到的那一半露出来，醪面比槽口（槽身顶 1.50）低 7 cm
  g.add(solid(new THREE.BoxGeometry(1.5, 0.06, 0.86), mats.malt, tx, 1.4, tz + 0.58));
  // 蒸汽：几团半透明的白汽从盖缝里飘出来（糖化这步是热锅里冒汽的）。
  // **用球不用方块**：方块的棱角在亮天空上读作"几个白盒子"，球才读作汽；
  // 材质透明 + depthWrite:false，所以既不进 check-zfight（它跳过透明材质），
  // 也不会被 rainscan 的 blocksRain() 当成"屋顶漏雨"（那一项也跳过透明材质）。
  for (const [sx, sy, sz, ss] of [[-0.25, 1.86, 0.10, 0.30], [0.15, 2.05, 0.34, 0.24],
    [-0.05, 2.24, 0.04, 0.19], [0.30, 1.94, -0.24, 0.15]]) {
    const st = new THREE.Mesh(new THREE.SphereGeometry(ss, 7, 5), mats.steam);
    st.position.set(tx + sx, sy, tz + sz);
    st.userData.buildSkip = true;
    g.add(st);
  }
  // 搅拌桨：搅完**斜靠在槽边**——柄头顶住西侧那道压边，桨叶搁在地上。
  // 别再让桨叶泡在醪里：第一版那样摆，柄从槽口斜着伸出来，两头都不挨着什么，看着像
  // 悬在槽上；想让柄真搭到沿上，槽口离醪面只有 0.1 m，柄就得几乎平躺，那更不是桨。
  // 位置照着"靠着"算：桨尖落在 (tx−1.45, 0.02)，柄顶走到压边外皮 (x0−0.86−0.075) 的
  // 转角上，柄长 1.35、倾角 0.335 rad，末梢与压边交叠 6 cm —— 读作"顶着"，不是穿过去。
  const paddle = new THREE.Group();
  paddle.add(solid(new THREE.CylinderGeometry(0.045, 0.045, 1.35, 6), mats.brewWood, 0, 0.675, 0));
  paddle.add(solid(new THREE.BoxGeometry(0.22, 0.46, 0.06), mats.brewWood, 0, -0.23, 0));
  paddle.position.set(tx - 1.30, 0.47, tz + 0.25);
  paddle.rotation.set(0, 0.35, -0.335);
  g.add(paddle);
  // 柴堆：灶口朝南（+z），柴就码在灶口外侧一步远的地方。
  // 原来这儿摆的是一根"引水槽"——从窑那边斜伸过来、两头都没人接的悬空木板，
  // 拍出来是根凭空杵着的棍子。糖化槽自己就坐在砖灶上（热水自己烧），
  // 本来也不需要从别处引水，那根东西没有道理留着，换成灶真正要的东西：柴。
  // 柴**横躺着码在 z 上**：要横过来就得绕 **z** 转 90°——圆柱的轴本来就是 y，
  // 绕 y 转多少它都还是竖的（这个坑踩过一次：拍出来四根像小界桩一样杵在灶口）。
  // 最北那根离灶身还有 9 cm；要是顺着 z 摆，1.2 m 长的一根会插进灶身里。
  for (const [ly, lz] of [[0.11, -6.95], [0.11, -7.25], [0.11, -7.55], [0.32, -7.18]]) {
    const log = solid(new THREE.CylinderGeometry(0.11, 0.11, 1.2, 8), mats.trunk,
      tx + 0.1, ly, lz);
    log.rotation.z = Math.PI / 2;
    g.add(log);
  }
  // 槽脚下的砖灶：糖化槽要坐在火上（这是「窑前」那台，不是屋里 brewhouse 那两只）。
  // 灶身要比槽身**每边宽出 12 cm 以上**，而且长宽**都取不同的数**：只宽 5 cm 时灶侧皮与
  // 槽侧皮相距 0.05 m，正好卡在 check-zfight 的 6 cm 阈值里，一跑就多出两处 0.6 m²；
  // 改成跟槽一样深 2.6 之后两侧又**齐平**（间距 0.000），照样报——所以深度取 2.9。
  g.add(solid(new THREE.BoxGeometry(2.0, 0.34, 2.9), mats.brewStone, tx, 0.17, tz));
  // 灶口：朝南（+z）开一个拱形火口 + 里面一撮炭火（自发光，白天也看得见）。
  // 挡板**探出炉口** 0.08 m，不贴在口上：贴着时两者相距 2 cm，check-zfight 判成共面
  // （brewhouse 的砖灶当初踩过同一个坑）。自发光材质 inline 建，不复用器具里那只
  // —— ember() 是 brewery-gear.js 的私有函数，且那批火都在屋里。
  g.add(solid(new THREE.BoxGeometry(0.62, 0.62, 0.1), mats.wallDark, tx, 0.2, tz + 1.3));
  const fire = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.06),
    new THREE.MeshStandardMaterial({
      color: '#c2410c', emissive: '#ff7a1a', emissiveIntensity: 1.6, roughness: 1,
    }));
  fire.material.userData.noBake = true;
  fire.position.set(tx, 0.18, tz + 1.22);
  fire.userData.buildSkip = true;
  g.add(fire);
  return g;
}

// 酿酒坊大院：八座生产建筑 + 院坝水井 + 酒桶 + 排水
function buildBrewery(mats) {
  const g = new THREE.Group();
  const rnd = mulberry32(20261008);   // 器具的随机朝向（麻袋歪一点、耙子斜一点）
  for (const spec of BREW) {
    const b = brewHouse(spec, mats, rnd);
    b.position.set((spec.x0 + spec.x1) / 2, 0, (spec.z0 + spec.z1) / 2);
    // 给这座房子挂个 key：演示页 tools/brewprocess.html 靠它把屋里的器具
    // （userData.gear）按房子分组，走过哪座就点亮哪座的陈设。
    b.userData.brewKey = spec.key;
    g.add(b);
  }
  // 院坝水井：煮酒与冷却都要水
  g.add(yardWell(mats, WELL.x, WELL.z));
  // 巷口酒肆招牌：挂在 cellar 朝巷那面墙上，门楣正上方（docs/wine-research.md 实测表末行）
  const cellarSpec = BREW.find((b) => b.key === 'cellar');
  if (cellarSpec) g.add(cellarSign(mats, cellarSpec));
  // 院里的两件"真实修道院也有"的家伙（docs/brewery-research.md「后续可放的空间」）：
  // 储水塔 + 窑前麦香温床与糖化槽。落位见各自函数头的注释（都是 tools/probe 实测过的空地）。
  g.add(waterTower(mats));
  g.add(maltYard(mats));
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
// 檐口贴巷一侧（x0），但八座的进深不一样（x0 = 62 / 62.4 / 63 / 64），檐口也就深浅不一：
//   粮仓、酒窖     x0=62   → 檐口 61.5，落水管 61.86 已经在檐沟正下方，不用拐
//   葡萄酒窖、压榨房 x0=62.4 → 檐口 61.9，同样不用拐（61.9 与 61.86 只差 4 cm，仍在檐沟里）
//   麦芽楼等三座   x0=63   → 檐口 62.5，用一段横的集水管把水引到 61.86
//   烘干窑       x0=64   → 檐口 63.5，同上，横管长一点
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
  // 暗管：从明沟东端出口穿到渗井（埋在地下，看不见）。
  // 长度与位置由 chZ0 / soak 现算，两端各多伸 0.3 m 咬住出口与井圈——
  // 上一版是写死的 `6.4 / -43.2`（对应旧的 chZ0=-40、渗井 -46），改了那两个常量它就脱开了。
  const cul = brewCulvert();
  dr('culvert', new THREE.BoxGeometry(0.5, 0.4, cul.len), mats.lead, cul.x, cul.y, cul.cz);
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
  // 旧酒花架（东扩带北段，x -46..-8 / z -69..-58）：保留在西边给教士住宅添点绿，
  // 但不再是"酒花圃"了——酒花已搬进酿酒坊大院（见 buildHopYard）。
  // 这圈只留杆与铁丝，藤叶也换成菜圃的绿，免得跟大院那两处真酒花混淆。
  const postG = new THREE.BoxGeometry(0.16, 3.3, 0.16);
  const vineG = new THREE.BoxGeometry(0.22, 3.0, 0.22);
  for (let x = -43; x <= -11; x += 8) {
    for (const z of [-67.5, -63.5, -59.5]) g.add(solid(postG, mats.timber, x, 1.65, z));
    g.add(solid(new THREE.BoxGeometry(0.09, 0.09, 9.0), mats.lead, x, 3.2, -63.5));
    for (const z of [-65.5, -61.5]) g.add(solid(vineG, mats.row, x, 1.5, z));
  }
  return g;
}

// 一排等距洞口的拱心：间距按墙长收，保证最外一洞的外沿仍留在墙内、端头留得住墙垛。
// 南北短翼的墙长只有 garth+depth=20.2（半宽 10.1）；若照长翼沿用 ±9.4 的拱心、半宽 1.55，
// 最外洞口会探到 ±10.95、越过墙端。ExtrudeGeometry 对越界洞口的三角化会在越界处拉出
// 一条细长片，渲出来就是回廊里那根"只有轮廓、没有实体"的悬空亮线（隐藏该墙即消失）。
function bayCenters(len, a, n = 5, pad = 0.5) {
  const room = Math.max(0, len / 2 - a - pad);
  const pitch = Math.min(4.7, (room * 2) / (n - 1));
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * pitch);
}

// 回廊一翼：局部坐标里 x 沿长度、z=0 是朝内院的敞廊（尖拱列）、z=depth 是外实墙。
// 四面各建一次再旋转摆位；彼此在角部略微重叠，四片的 y 各差几厘米，避免共面。
function cloisterWalk(len, mats, yOff, seed) {
  const g = new THREE.Group();
  const D = CLO.depth, H = 4.4;

  // 地台
  g.add(solid(new THREE.BoxGeometry(len, 0.32, D), mats.cloPath, 0, 0.16 + yOff, D / 2));
  // 朝内院的敞廊：一排尖拱
  const cxs = bayCenters(len, 1.55);
  const pitch = cxs[1] - cxs[0];
  const op = cxs.map((cx) => ({ cx, a: 1.55, y0: 0, springY: 1.3, k: 1.0 }));
  g.add(solid(wallWithOpenings(len, 0, H, 0.5, op), mats.cloWall, 0, 0.02 + yOff, 0.1));
  // 外实墙 + 小窗（与拱列同一组拱心，保持上下对位）
  const win = cxs.map((cx) => ({ cx, a: 0.55, y0: 1.75, springY: 2.5, k: 1.0 }));
  g.add(solid(wallWithOpenings(len, 0, H + 0.25, 0.6, win), mats.cloWallDark, 0, 0.02 + yOff, D - 0.1));
  // 敞廊柱：半嵌在墙面上，给拱列两根细柱的读数；落在拱间的墙垛上。
  // 柱子有 0.2 m 半径，最外一根要连柱身一起留在墙内，不能只卡柱心。
  const colG = new THREE.CylinderGeometry(0.2, 0.2, H, 8);
  const colX = Math.min(len / 2 - 0.2);
  for (const cx of cxs) {
    for (const s of [-1, 1]) {
      g.add(solid(colG, mats.cloWall, Math.min(colX, cx + s * pitch / 2), H / 2 + 0.02 + yOff, -0.06));
    }
  }
  // 单坡屋面：外高内低。朝下的底面（走廊顶）在阴影里只吃到天穹底色，不补一点就直接全黑，
  // 所以屋面用回廊专用材质带一点自发光当漫射补光。
  const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 0.7, 0.3, D + 0.9), mats.cloSlate);
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
  // ---------- 葡萄园与酒花圃（src/plantations.js）----------
  // 葡萄园（x 56…76 / z -78…-64）：这一片原来**是裸广场**（东扩带的草底只铺到 x=56、
  // 大院压实土只铺到 z=-58，两块都盖不住这个角），葡萄园落在灰板上不成样子，
  // 所以先补草地（0.035，压过广场 y=0 且不与它共面），再压行间畦 0.05。
  patch(mats.grass, 20, 20, 66, -68, 0.035);
  // 葡萄园的行间畦（沿 x 的绿带，5 行；起点跟着 plantations 的 Z0 走，改那边记得改这里）
  for (let r = 0; r < 5; r++) patch(mats.bed, 15, 1.4, 65, -65.5 - r * 2.8, 0.05);
  // 酒花主圃（x 56…61 / z -62…-41，葡萄酒窖西边那条边带）：两行沿 z 的畦
  for (const x of [57.6, 60.0]) patch(mats.bed, 1.2, 21, x, -51.5, 0.05);
  // 巷边酒花行（x 56…57.5 那条窄边）：一道细畦
  patch(mats.bed, 1.2, 93, 56.9, 18.5, 0.05);
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
    [20, 44], [38, 8], [52, -72],   // 原 [66,-50] 在酿酒坊大院；现在大院东头被压榨房/葡萄酒窖/
    //   葡萄园占满（x 62.4…76 / z -78…-32 全是房子和园子），挪到葡萄园**西侧**这条 11 m 宽的
    //   空带（东排住宅到 x=45.1、葡萄园从 x=56 起）当遮荫树，树冠 3 m 谁也压不着。
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
  // 葡萄园与酒花圃：两条原料的生产线，紧邻酿酒坊大院（依据见 docs/wine-research.md /
  // docs/brewery-research.md）。位置 x 56…75 / z -72…-34，都在领地东扩带里。
  root.add(buildVineyard(mats, rnd));
  root.add(buildHopYard(mats, rnd));
  root.add(buildTrees(mats, rnd));

  labels.push({ text: '回廊（修士的日常动线）', pos: [30.7, 7.5, 25.2], scope: 'out' });
  labels.push({ text: '北侧墓地', pos: [-32, 3, 0], scope: 'out' });
  labels.push({ text: '西前庭集市', pos: [13, 6, 66], scope: 'out' });
  labels.push({ text: '酿酒坊大院', pos: [59, 12, 20], scope: 'out' });
  labels.push({ text: '绕殿巡游道 · 园圃', pos: [4, 9, -66], scope: 'out' });
  labels.push({ text: '墓园扩展（北扩）', pos: [-58, 8, 0], scope: 'out' });
  // 八座酒坊各挂一条，挂在山墙上方（脊高 + 1.2 m），名字后面缀上这道工序在做什么。
  // 从 BREW 表生成而不是手写坐标：往后往 BREW 里加一座（压榨房 / 葡萄酒窖），
  // 标注自动跟上来，不会漏，也不会和几何对不上。
  for (const b of BREW) {
    labels.push({
      text: `${b.name}（${b.stage}）`,
      pos: [(b.x0 + b.x1) / 2, b.h + b.rh + 1.2, (b.z0 + b.z1) / 2],
      scope: 'out',
    });
  }
  // 两条原料线：葡萄园（葡萄酒原料）与酒花圃（啤酒原料）。它们挂在 3.6 / 4.2 m，
  // 比山墙上那批（10–14 m）低得多，两层标注不会互相抢位置。
  // 位置跟着 src/plantations.js 的实际范围走：葡萄园 z -78…-64（中心 -71），
  // 酒花主圃 x 56…61 / z -62…-41（中心 58, -51）——主圃已经从大院东头挪到巷子西边了。
  labels.push({ text: '葡萄园（葡萄酒原料）', pos: [65, 3.6, -71], scope: 'out' });
  labels.push({ text: '酒花圃（啤酒原料）', pos: [58, 4.2, -51], scope: 'out' });
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

// 酿造工序：演示页 tools/brewprocess.html 沿这条线走，字幕与高亮器物都从这儿取。
// 器具在屋里哪个位置由 src/brewery-gear.js 的 gearAnchor() 算（与真实几何同源），
// 这里只负责把"哪座房子、第几步、说什么"这三件事排成一条线。
// 工序说明只写做法，不写葡萄品种与产量——那两样在 docs/wine-research.md 第五节
// 说明了查不到，别在文案里当结论用。
export function brewProcess() {
  return [
    { key: 'granary', title: '粮仓 · 收大麦',
      text: '大麦从外面运来先在这里落脚：过磅、量斗、把坏的挑出去，好的囤进垛里。麦子要干燥，发芽全靠后面那一步的干透。' },
    { key: 'kiln', title: '烘干窑 · 烘麦芽',
      text: '大麦泡水发了芽，芽长到麦粒那么长就停手，摊在带孔的铁盘上烘干——这一步把淀粉变成糖，是啤酒的甜味来源，也是颜色来源。烘完的麦芽叫 malt。' },
    { key: 'malthouse', title: '麦芽楼 · 浸麦发芽',
      text: '麦子在地板上堆成厚厚一层，中间每天翻一遍、摊平，让每一粒都均匀发芽。这层麦芽叫 green malt，接下来送烘干窑。楼下的架空层是进风口，发芽要透气。' },
    { key: 'brewhouse', title: '煮酒房 · 糖化煮酒',
      text: '麦芽砸碎进糖化槽，加热水把糖溶出来，这一步叫糖化（mashing）。甜麦汁再进大铜锅煮沸——高温与煮沸既灭掉杂菌，也把麦汁里的蛋白质沉出来，酒才清。这一锅是苦味与酒精度的主要来源。' },
    { key: 'cooling', title: '冷却 · 发酵',
      text: '滚烫的麦汁先摊在浅盘里快速降温（麦汁温度高的话，酵母活不了），凉了进发酵桶，加酒花与酵母。头几天泡沫翻涌，之后渐渐安静，酒就出来了。' },
    { key: 'cellar', title: '酒窖 · 陈酿售卖',
      text: '新酒在橡木桶里放上几个月乃至几年，酒体慢慢变得圆润，来喝的人从巷口那头就闻得见。这是这条线的最后一站，也是唯一一间有酒肆的——修院自己喝、待客、也卖一点。' },
    // ---------- 第二条线：葡萄酒 ----------
    // 四站：葡萄 → 葡萄园 → 压榨房 → 葡萄酒窖。葡萄园没有房子，所以它不进 BREW 表，
    // 直接给一组 point / out 机位（下面的 map 对没有房子的站会走这条分支）。
    // 只写做法，不写品种与年份：docs/wine-research.md 第五节说明那两样查不到。
    { key: 'vineyard', title: '葡萄园 · 收葡萄',
      name: '葡萄园', stage: '收葡萄 · 原料',
      text: '中世纪北方的葡萄是矮桩密植、绑在两道铁丝上，不是波尔多那种高立木。果串垂在下铁丝底下，熟了整串剪下来装筐。地里这五行的架式与行距，照的是 Champagne 考古与圣雷米多联画里那套。',
      point: { x: 65, z: -69.7 }, ridgeY: 1.8,
      out: { x: 44, y: 7, z: -67 } },
    { key: 'press', title: '压榨房 · 压榨取汁',
      text: '葡萄倒进压筐，压板压下去，汁顺着台基上那圈槽流出来。中央螺杆穿过顶横梁，人推着顶上的杠杆吊臂转螺杆——这是中世纪最有辨识度的器物之一。Clos de Vougeot 1477 年盖的压榨房 cuverie 就是"四台巨型压榨机 + 双排酒槽"这个组合。' },
    { key: 'winecellar', title: '葡萄酒窖 · 陈酿存酒',
      text: '汁进了发酵槽就开始变成酒，再装进比啤酒桶小而高的橡木桶，或者埋进半截陶瓮 pithos 里陈放。窖比别的房子矮一截、墙外还堆着土——半地下是为了恒温，土就是它的保温层。' },
  ].map((s) => {
    const b = BREW.find((x) => x.key === s.key);
    if (!b) {
      // 没有房子的那一站（葡萄园）：机位与名字由站点自己给
      return {
        key: s.key, title: s.title, text: s.text, name: s.name, stage: s.stage,
        cx: s.point.x, cz: s.point.z, ridgeY: s.ridgeY,
        out: s.out, in: { x: s.point.x, y: 1.7, z: s.point.z }, noHouse: true,
      };
    }
    const a = gearAnchor(b);
    return {
      key: s.key, title: s.title, text: s.text,
      name: b.name, stage: b.stage,
      cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2,
      ridgeY: b.h + b.rh,
      // 屋外看的机位：从服务巷那侧（x 小的一侧）斜看山墙
      out: { x: b.x0 - 9, y: 5.2, z: (b.z0 + b.z1) / 2 - 3 },
      // 屋里看的机位：站在屋内中线，眼高 1.7 m
      in: a,
    };
  });
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
    // 八座建筑：footprint + 檐高 / 脊高（脊高 = h + rh），屋面挑檐 0.5 m
    buildings: BREW.map((b) => ({
      key: b.key, name: b.name, stage: b.stage, x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1,
      h: b.h, rh: b.rh, eaveY: b.h, ridgeY: b.h + b.rh, overhang: 0.5,
      stone: !!b.stone, roof: b.roof,
      eaveW: b.x0 - 0.5, eaveE: b.x1 + 0.5,   // 东 / 西檐口的世界 x
      eaveN: b.z0 - 0.4, eaveS: b.z1 + 0.4,   // 北 / 南檐口的世界 z
    })),
    // 酿造工序（演示页 brewprocess.html 走这条线）
    process: brewProcess(),
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
      culvert: (({ x, z0, z1, y0, y1 }) => ({ x, z0, z1, y0, y1 }))(brewCulvert()),
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
