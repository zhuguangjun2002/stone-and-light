// 大教堂总体尺寸（单位：米），比例参照亚眠/沙特尔一类盛期哥特教堂，略缩小。
// 坐标系：y 向上；中厅轴线沿 z，西立面在 +z，东端后殿在 -z；交叉部中心在原点。

export const P = {
  // 平面
  bay: 7,                 // 开间进深（一跨拱顶的长度）
  naveBays: 6,            // 中厅开间数（西侧）
  choirBays: 3,           // 歌坛开间数（东侧）
  naveHW: 6,              // 中厅内净半跨（全跨 12m）
  arcadeT: 1.2,           // 拱廊墙厚
  aisleW: 6,              // 侧廊净宽
  aisleWallT: 1.0,        // 侧廊外墙厚
  pierW: 1.4,             // 束柱名义粗细

  // 立面分层（哥特三段式：拱廊 / 楼廊 / 高侧窗）
  arcSpring: 9,           // 拱廊起拱高（柱头标高）
  arcK: 1.3,              // 拱廊尖拱半径系数（R = k·跨度）
  trifBot: 15.2,          // 楼廊（triforium）下缘
  trifTop: 17,            // 楼廊上缘
  clerSill: 18.5,         // 高侧窗窗台
  clerSpring: 24,         // 高侧窗起拱高
  naveWallTop: 30,        // 中厅墙顶（檐口下）

  // 拱顶
  vaultSpring: 18,        // 中厅拱顶起拱高
  vaultK: 1.0,            // 中厅拱顶横向券曲率（1.0 = 等边尖拱）
  aisleVaultSpring: 7.5,  // 侧廊拱顶起拱高
  aisleWallTop: 13,       // 侧廊外墙顶

  // 屋面（注意：木屋架在石拱顶之上，二者之间是阁楼空间）
  roofEave: 30.5, roofRidge: 37.5,
  aisleRoofLo: 13, aisleRoofHi: 17.2,

  // 扶壁体系
  butPierTop: 22,         // 扶壁墩顶
  flyerHeadY: 25.5,       // 飞券上端（抵住中厅墙的高度，正对拱顶起拱区）
  flyerTailY: 19,         // 飞券下端（落在扶壁墩上）

  // 耳堂（十字翼）
  transeptEnd: 24,        // 耳堂臂端（x 方向）

  // 西立面
  towerW: 8, towerH: 46, spireH: 18,
  towerSpires: true,      // false = 平顶塔（巴黎圣母院式）
  towerAsym: false,       // true = 北塔更高（沙特尔式）
  roseR: 4.6, roseY: 24,  // 玫瑰窗半径与圆心高

  // 交叉部尖塔（flèche）
  flecheTop: 62,

  // 镶玻方案：'chartres'（12–13 世纪叙事窗，深蓝深红、室内暗）
  //          'late'（14–16 世纪白地银黄，铅条疏、室内亮）见 glass.js 的 GLAZING
  glazing: 'chartres',

  // 日光阴影相机（OrthographicCamera）的视锥：**必须罩住整片领地**，越界的物体不出影子，
  // 地面上会留下一道"影子到此为止"的硬边界。H/top/bottom 是视空间的米数，map 是贴图边长，
  // bias 是深度偏置。领地范围或这组数一变，就重跑 `node tools/check-shadow.mjs`。
  shadow: { H: 150, top: 140, bottom: -140, near: 20, far: 350, map: 4096, bias: -0.0006 },
};

// 派生量。设计面板改动基础参数后需重算一次再重建。
export function recomputeDerived() {
  P.aisleIn  = P.naveHW + P.arcadeT;            // 7.2  侧廊内缘
  P.aisleOut = P.aisleIn + P.aisleW;            // 13.2 侧廊外缘（内面）
  P.outerX   = P.aisleOut + P.aisleWallT;       // 14.2 外墙外皮
  P.naveZ0   = P.naveHW;                        // 6    中厅起点（交叉部边）
  P.naveZ1   = P.naveZ0 + P.naveBays * P.bay;   // 48   中厅终点（西立面）
  P.choirZ1  = -P.naveHW - P.choirBays * P.bay; // -27  歌坛终点（后殿起点）
}
recomputeDerived();

// 太阳轨迹：t ∈ [0,1] → 7:00–19:00，自东（−z）经南（+x）向西（+z），半径 170 m。
// main.js 的日夜渲染与 tools/check-shadow.mjs 的影子视锥校验共用这一份——
// 轨迹一变，校验器查的就是同一条轨迹（P.shadow 必须罩住它）。
const SUN_R = 170, SUN_ELEV0 = 7, SUN_ELEVSPAN = 56;
export function sunPos(t, out) {
  const s = Math.sin(Math.PI * t);                      // 高度因子：正午 1，晨昏 0
  const az = Math.PI * t;
  const elev = (SUN_ELEV0 + SUN_ELEVSPAN * s) * Math.PI / 180;
  return out.set(SUN_R * Math.cos(elev) * Math.sin(az),
                 SUN_R * Math.sin(elev),
                 -SUN_R * Math.cos(elev) * Math.cos(az));
}
