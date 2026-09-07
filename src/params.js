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
