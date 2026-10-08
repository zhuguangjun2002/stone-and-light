// 酒坊院内的陈设：每座房子按它那道工序摆对应的器具。
//
// 为什么单独一个文件：这些小件与"墙怎么砌"是两件事——墙壳在 town.js 的 brewHouse()，
// 器具在这里；两者都由 buildBrewery() 挨着调。工序与建筑的对应关系写在 BREW 的 stage 上
// （src/town.js），演示页 tools/brewprocess.html 从 brewInfo().process 取同一份。
//
// 全部程序化、无外部资源；材质复用 townMaterials() 的 wood / timber / lead 系，
// 另加三条本模块专用的（brew 内壁、地坪、铜锅）。

import * as THREE from '../lib/three.module.js';

// 本模块自带的网格：不设 buildSkip 之外的任何 userData 键。
// 领地网格由 buildTown() 统一打 userData.town，所以这里的件自动被穿刺检查器跳过。
function solid(geo, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  m.userData.buildSkip = true;
  m.userData.gear = true;      // tools/check-gear.mjs 靠这个标签认出"屋里的东西"
  return m;
}

// 自发光的小火（灶膛、发酵桶的火）：不进烘焙（noBake 材质自带），但要有颜色，
// 不然白天从屋里看也是一块黑。仍要标 buildSkip，让它别进建造动画。
function ember(w, h, d, x, y, z, intensity = 1.5) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: '#c2410c', emissive: '#ff7a1a', emissiveIntensity: intensity, roughness: 1 }));
  m.position.set(x, y, z);
  m.userData.buildSkip = true;
  return m;
}

// ---------- 每道工序的器具 ----------
// 全部以房子**局部坐标**给出（组原点 = 房子中心，x 是进深、z 是长度，与 town.js 一致）。
// 屋里的可用范围：进深 x ∈ [-w/2+T, w/2-T]，长度 z ∈ [-d/2+T, d/2-T]（T = 墙厚 0.5）。

const T = 0.5;              // 墙厚，与 town.js 的 brewHouse 一致

// 粮仓：麻袋垛（错开朝向，免得看起来像一堵墙）+ 量麦斗 + 盘梯 + 推车
function granary(g, mats, rnd, w, d, h) {
  const ix = w / 2 - T - 1.1;                   // 靠南墙摆，留出中间的走道
  // 麻袋：三层，每层几袋，方向错开（横向 1.05 长 / 纵向 0.62 宽交替）
  const sackG = new THREE.BoxGeometry(1.05, 0.34, 0.62);
  const sackG2 = new THREE.BoxGeometry(0.62, 0.34, 1.05);
  for (let row = 0; row < 3; row++) {
    const n = 3 - row;
    for (let i = 0; i < n; i++) {
      const z = -d / 2 + 2.6 + i * 1.16 + row * 0.28;
      g.add(solid(row % 2 ? sackG : sackG2, mats.sack, ix + (rnd() - 0.5) * 0.1,
        0.18 + row * 0.35, z + (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.12));
    }
  }
  // 量麦斗：方斗 + 上口四条边 + 支腿
  const hopX = -w / 2 + T + 1.5, hopZ = d / 2 - 2.4;
  g.add(solid(new THREE.CylinderGeometry(0.42, 0.16, 0.72, 8), mats.brewBeam, hopX, 1.05, hopZ));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(solid(new THREE.BoxGeometry(0.08, 0.72, 0.08), mats.brewBeam, hopX + sx * 0.28, 0.36, hopZ + sz * 0.28));
  }
  g.add(solid(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 8), mats.lead, hopX, 1.44, hopZ));
  // 盘梯：靠东墙（z0 面），一跑一跑往上
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const zz = -d / 2 + T + 2.0 + i * 1.5;
    g.add(solid(new THREE.BoxGeometry(1.1, 0.1, 0.34), mats.brewWood, -w / 2 + T + 0.9, y + 0.9, zz));
    g.add(solid(new THREE.BoxGeometry(1.1, 0.5, 0.06), mats.brewWood, -w / 2 + T + 0.9, y + 1.15, zz));
    y += 1.5;
    if (y > h - 0.6) break;
  }
  // 麻袋推车：斗 + 两个轮 + 一对把手
  const cartX = -w / 2 + T + 1.4, cartZ = -d / 2 + T + 2.2;
  g.add(solid(new THREE.BoxGeometry(0.8, 0.44, 1.2), mats.brewWood, cartX, 0.52, cartZ));
  for (const sz of [-1, 1]) {
    g.add(solid(new THREE.CylinderGeometry(0.24, 0.24, 0.09, 10), mats.brewWood,
      cartX - 0.3, 0.24, cartZ + sz * 0.42, Math.PI / 2));
    g.add(solid(new THREE.BoxGeometry(0.07, 0.07, 1.1), mats.brewBeam,
      cartX + 0.28, 0.66, cartZ + sz * 0.3));
  }
}

// 烘干窑：砖砌炉膛（口朝门）+ 带孔铁烘盘 + 麦芽耙 + 灰坑 + 通向已有烟囱的烟道
function kiln(g, mats, rnd, w, d, h) {
  // 炉膛贴东墙（z0），砖砌三面 + 敞口朝西。灰坑在炉膛**里侧**（炉膛中心以西），
  // 且比炉膛矮：原先灰坑 (1.1 × 0.9 × 1.6) 摆在炉膛正中、高 0.9，炉膛只有 1.5 高，
  // 两者的顶/侧皮落在同一高度上，check-zfight 报成共面。往里挪 + 降矮就分开了。
  const kx = w / 2 - T - 1.3, kz = -d / 2 + T + 2.0;
  g.add(solid(new THREE.BoxGeometry(2.2, 1.5, 2.6), mats.brewStone, kx, 0.75, kz));
  g.add(solid(new THREE.BoxGeometry(2.4, 0.3, 2.8), mats.brewStone, kx, 1.65, kz));
  g.add(solid(new THREE.BoxGeometry(0.9, 0.5, 1.4), mats.ash, kx - 0.5, 0.25, kz));
  // 灶口：拱在炉膛口上的一块铁挡板 + 里面的炭火（自发光，白天也看得见）。
  // 挡板要**探出炉膛口**（伸出 0.25 m），不是贴在口上：贴着时两者相距 5 cm，
  // check-zfight 判成共面（间距 0.000 m）。
  g.add(solid(new THREE.BoxGeometry(0.5, 0.72, 1.1), mats.lead, kx - 1.35, 0.36, kz - 0.6));
  g.add(ember(0.06, 0.34, 0.8, kx - 1.05, 0.2, kz - 0.6, 1.5));
  // 烟道：从炉膛顶斜着往上，穿进已有的烟囱（烟囱在房子北侧 x=73 一带）
  g.add(solid(new THREE.BoxGeometry(1.0, h - 1.8, 1.0), mats.brewStone, kx, (h - 1.8) / 2 + 1.65, kz, 0));
  // 铁烘盘：架在炉膛上方的一层带孔铁板 + 盘沿（麦芽就摊在这里）
  const malX = -w / 2 + T + 2.2;
  g.add(solid(new THREE.BoxGeometry(2.6, 0.08, 3.2), mats.lead, malX, 1.95, kz + 1.6));
  for (const [bw, bh, bd, bx, by, bz] of [
    [2.7, 0.22, 0.08, 0, 2.06, -1.6], [2.7, 0.22, 0.08, 0, 2.06, 1.6],
    [0.08, 0.22, 3.3, -1.3, 2.06, 0], [0.08, 0.22, 3.3, 1.3, 2.06, 0]]) {
    g.add(solid(new THREE.BoxGeometry(bw, bh, bd), mats.lead, malX + bx, by, kz + 1.6 + bz));
  }
  // 盘上的麦芽：薄薄一层，别铺满（不然看不见铁盘）
  g.add(solid(new THREE.BoxGeometry(2.3, 0.1, 2.9), mats.malt, malX, 2.03, kz + 1.6));
  // 麦芽耙：一根长柄（斜靠）+ 一把齿板，摆在烘盘边上。
  // 原先只有一把耙子摆在盘边，耙齿悬在半空——看不出它是"靠在盘上"还是"浮着"。
  // 改成柄从盘沿斜插到盘面，齿板压在盘沿上：一件工具，摆明了在盘上用过。
  const rakeZ = kz + 3.2;
  const rake = new THREE.Group();
  rake.add(solid(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 6), mats.brewWood, 0, 1.0, 0));
  rake.add(solid(new THREE.BoxGeometry(1.1, 0.08, 0.16), mats.brewWood, 0, 0, 0));
  for (let i = 0; i < 5; i++) {
    rake.add(solid(new THREE.BoxGeometry(0.07, 0.24, 0.06), mats.lead, -0.44 + i * 0.22, -0.14, 0));
  }
  rake.position.set(malX + 0.1, 2.14, rakeZ);
  rake.rotation.set(0.12, 0.25, 0.42);
  g.add(rake);
  // 木铲：斜靠在墙上
  const shX = w / 2 - T - 0.3;
  g.add(solid(new THREE.BoxGeometry(0.06, 1.5, 0.34), mats.brewWood, shX, 0.8, kz + 4.4));
  g.add(solid(new THREE.CylinderGeometry(0.045, 0.045, 1.2, 6), mats.brewWood, shX - 0.1, 0.65, kz + 4.4));
}

// 麦芽楼：两层架空发芽地板（下面是进风口）+ 厚麦芽堆 + 耙子 + 墙上通风百叶 + 吊麦绞盘
function malthouse(g, mats, rnd, w, d, h) {
  // 两层地板：下层 0.9 m（放麦芽、下面进风），上层 h - 0.5（摊麦芽、采光）
  const zC = -d / 2 + T + (d - 2 * T) / 2;
  // 门内走道：西墙内皮往里 3.8 m 这条带子里不许有**齐腰以上**的家伙（tools/check-gear「门口净空」；
  // 麻布叠只有 0.44 m 高，在腰射线 0.55 以下，从脚边过去，不算挡路）。
  // 原来下层地板与厚麦芽堆铺满全屋、离西墙只剩 0.7 m，麦芽堆顶面 1.64 比眼位 1.7 只低 6 cm，
  // 一开门就是一堵齐脸的麦芽墙，腰（0.55）头（1.55）两档射线全打在上面，一步都进不去。
  const xW = -w / 2 + T, xE = w / 2 - T;
  const WALK = xW + 3.8;
  const fw = d - 2 * T - 0.6;
  for (const [fy, fx0, fx1] of [
    [0.9, WALK, xE - 0.2],                 // 下层：只铺东半边，西边留出走道
    [h - 0.55, -xE + 0.2, xE - 0.2]]) {    // 上层：满跨（在头顶 8 m 高处，不挡路）
    const fs = fx1 - fx0, fc = (fx0 + fx1) / 2;
    g.add(solid(new THREE.BoxGeometry(fs, 0.14, fw), mats.brewBeam, fc, fy, zC));
    // 地板下的托梁，一排排从下面看得见
    for (let i = 0; i < 7; i++) {
      const z = zC - fw / 2 + (i + 0.5) * (fw / 7);
      g.add(solid(new THREE.BoxGeometry(fs, 0.2, 0.16), mats.brewBeam, fc, fy - 0.16, z));
    }
  }
  // 上层地板四周的矮栏杆（翻麦芽时挡着人）
  for (const s of [-1, 1]) {
    g.add(solid(new THREE.BoxGeometry(0.1, 0.7, d - 2 * T - 0.6), mats.brewWood, s * (w / 2 - T - 0.2), h - 0.55 + 0.42, zC));
  }
  // 厚麦芽堆：下层 0.6 m 厚（顶面 1.54）。跟着下层地板一起缩到东半边，西边留出走道。
  // 堆的西沿比地板西沿再往东 0.5 m：齐平就跟地板侧面共成一个面（check-zfight 判共面）。
  const pX0 = WALK + 0.5, pX1 = xE - 0.7;
  g.add(solid(new THREE.BoxGeometry(pX1 - pX0, 0.6, d - 2 * T - 1.8), mats.malt, (pX0 + pX1) / 2, 1.24, zC));
  // 麻布叠放在**下层地板中间的空档里**，不是紧贴墙根：地板托梁顶面在 1.05，
// 麻布叠最高 0.34，再靠墙摆时叠顶（1.05）与梁顶只差 2 cm，check-zfight 判成共面。
  const clX = -w / 2 + T + 1.5, clZ = zC - (d - 2 * T) / 2 + 2.4;
  for (let i = 0; i < 3; i++) {
    g.add(solid(new THREE.BoxGeometry(1.0, 0.12, 0.7), mats.sack, clX, 0.06 + i * 0.13, clZ,
      (i - 1) * 0.06));
  }
  // 上层摊的麦芽：薄一点，两条垄
  for (const s of [-1, 1]) {
    g.add(solid(new THREE.BoxGeometry(w - 2 * T - 1.6, 0.12, 1.5), mats.malt, 0, h - 0.41, zC + s * 1.9));
  }
  // 墙上通风百叶（下层地板下面进风）：门两边各三片，**要绕开门洞**。
  // 原先 6 片沿墙均分，落在门心 ±1.11 的两片正好骑在 3.6 m 宽的门洞里（离地 0.40…0.84 m），
  // 门缝被夹到只剩 0.56 m 宽，人要贴着门心 ±0.28 m 才挤得进去。
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const z = zC + s * (Math.min(3.6, d - 3) / 2 + 0.9 + i * 1.6);
    g.add(solid(new THREE.BoxGeometry(0.1, 0.44, 0.9), mats.brewWood, -w / 2 + T + 0.05, 0.52, z));
  }
  // 耙子：靠西墙（x0 那面）斜靠一把，把一把插在麦芽堆里
  const rake1 = new THREE.Group();
  rake1.add(solid(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), mats.brewWood, 0, 1.2, 0));
  rake1.add(solid(new THREE.BoxGeometry(1.2, 0.08, 0.18), mats.brewWood, 0, 0.1, 0));
  for (let i = 0; i < 5; i++) rake1.add(solid(new THREE.BoxGeometry(0.07, 0.26, 0.06), mats.lead, -0.5 + i * 0.25, -0.06, 0));
  // 贴南墙摆（离墙 0.9 m，耙子横摆宽 1.2 m，斜靠时最远端才不会戳出墙）
  rake1.position.set(w / 2 - T - 1.0, 1.2, zC - 2.2);
  rake1.rotation.z = 0.24;
  g.add(rake1);
  // 吊麦绞盘：屋架下一根横梁 + 一个滑轮 + 一条绳从下层往上提麦子。
  // 吊着的麻袋要**停在楼板之下**：袋顶原先到 1.05，正好压在楼板托梁（0.97–1.05）上，
  // check-zfight 判成共面（0.5 m²）。降到袋顶 0.8，离托梁还有 0.17 m。
  g.add(solid(new THREE.BoxGeometry(0.24, 0.24, d - 2 * T), mats.brewBeam, 0, h - 1.15, zC));
  const wpos = zC + 1.6;
  g.add(solid(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12), mats.brewBeam, 0, h - 1.32, wpos, Math.PI / 2));
  g.add(solid(new THREE.CylinderGeometry(0.03, 0.03, h - 2.4, 6), mats.brewWood, 0.22, (h - 2.4) / 2 + 0.9, wpos));
  g.add(solid(new THREE.BoxGeometry(0.7, 0.5, 0.7), mats.sack, 0.22, 0.55, wpos));
}

// 煮酒房：糖化槽（带盖大木槽 ×2）+ 架在砖灶上的大铜锅 + 搅拌桨 + 麦汁管 + 热水桶
function brewhouse(g, mats, rnd, w, d, h) {
  const zC = 0;
  // 砖灶：铜锅下面那台。灶身用 brewStone（带自发光），灶膛朝门那面再放一块更亮的火口 ——
  // 它是屋里唯一的暖光源；没有它，铜锅连同它后面那片墙在暗屋里仍是一坨黑。
  const stX = w / 2 - T - 1.6, stZ = zC + 1.2;
  g.add(solid(new THREE.BoxGeometry(2.6, 1.3, 2.6), mats.brewStone, stX, 0.65, stZ));
  g.add(solid(new THREE.BoxGeometry(2.8, 0.22, 2.8), mats.brewStone, stX, 1.4, stZ));
  g.add(ember(1.3, 0.36, 0.16, stX, 0.24, stZ - 1.32, 1.6));
  g.add(ember(0.14, 0.72, 1.5, stX - 1.28, 0.4, stZ, 0.85));
  // 铜锅：半球 + 平底沿 + 两道箍 + 两个耳
  g.add(solid(new THREE.CylinderGeometry(1.25, 1.1, 1.35, 20), mats.copper, stX, 2.22, stZ));
  g.add(solid(new THREE.TorusGeometry(1.25, 0.05, 6, 20), mats.copper, stX, 2.86, stZ, 0));
  g.add(solid(new THREE.TorusGeometry(1.16, 0.05, 6, 20), mats.copper, stX, 1.66, stZ, 0));
  for (const s of [-1, 1]) {
    g.add(solid(new THREE.BoxGeometry(0.1, 0.5, 0.34), mats.lead, stX + s * 1.28, 2.5, stZ));
  }
  // 锅里的麦汁：铜锅内一层深色液面。半径 1.18 比锅壁 1.25 小 7 cm、深度比锅口低 6 cm，
  // 两头都留出缝，免得与锅壁、与锅口共面。
  g.add(solid(new THREE.CylinderGeometry(1.18, 1.18, 0.05, 20), mats.wort, stX, 2.78, stZ));
  // 糖化槽 ×2：带盖的大木槽，槽沿比槽身高一圈。
  // **不能摆在门后**：原来槽身离西墙内皮只有 0.85 m，槽沿（y 1.53…1.67）与槽盖（1.45…1.99）
  // 正好骑在 1.55 m 那档头高射线上，槽身又跨过 0.55 m 腰高射线 —— 一开门两条路全断，
  // 第一人称一步都进不去（tools/check-gear 的「门口净空」一节）。往东挪 2.9 m 到屋当中，
  // 门里让出 3.8 m 净空带；槽北还剩 3.0 m、槽南还剩 5.2 m 的余宽，绕过去都通。
  for (let i = 0; i < 2; i++) {
    const tx = -w / 2 + T + 4.6, tz = zC - 2.6 + i * 3.0;
    g.add(solid(new THREE.BoxGeometry(1.7, 1.5, 2.2), mats.brewWood, tx, 0.75, tz));
    for (const [bw, bh, bd, bx, by, bz] of [
      [1.85, 0.14, 0.14, 0, 1.5, -1.1], [1.85, 0.14, 0.14, 0, 1.5, 1.1],
      [0.14, 0.14, 2.34, -0.85, 1.5, 0], [0.14, 0.14, 2.34, 0.85, 1.5, 0]]) {
      g.add(solid(new THREE.BoxGeometry(bw, bh, bd), mats.brewBeam, tx + bx, by, tz + bz));
    }
    // 槽盖：斜搭着的一块板（糖化要保温，但不全是盖死的）
    const lid = solid(new THREE.BoxGeometry(1.8, 0.09, 1.3), mats.brewWood, tx, 1.62, tz - 0.3);
    lid.rotation.z = 0.26;
    g.add(lid);
    // 槽里的麦芽醪：盖没盖到的那一半露出来。醪面比槽口低 6 cm —— 齐平会与槽沿共面。
    g.add(solid(new THREE.BoxGeometry(1.55, 0.06, 0.9), mats.malt, tx, 1.4, tz + 0.55));
  }
  // 搅拌桨：一根长柄 + 桨叶，靠在糖化槽上
  const paddle = new THREE.Group();
  paddle.add(solid(new THREE.CylinderGeometry(0.055, 0.055, 2.6, 6), mats.brewWood, 0, 1.3, 0));
  paddle.add(solid(new THREE.BoxGeometry(0.42, 0.9, 0.07), mats.brewWood, 0, 0.42, 0));
  paddle.position.set(-w / 2 + T + 3.4, 0.1, zC - 4.4);
  paddle.rotation.z = 0.2;
  g.add(paddle);
  // 麦汁管：糖化槽 → 铜锅，一根横着的木槽 + 一段铅管落到锅里。
  // 槽帮（挡板）**嵌进槽身**、并且两根帮错开一点距离：贴在壁上时两者只差 2.5 cm，
  // check-zfight 判成共面（两处 0.8 m²）。帮改成压进槽身、两帮中心距 0.34。
  const pipeY = 2.0;
  // 槽身从 4.2 m 收成 1.9 m（x 0.4…2.3）：糖化槽东挪后，原来的槽有 1.45 m 会悬在门里走道的
  // 半空上。西端仍压进槽东沿（0.45）；东端朝锅那侧（锅前那截铅管本就错在 z +0.6，与此无关）。
  const ptL = 1.9, ptX = 1.35;
  g.add(solid(new THREE.BoxGeometry(ptL, 0.3, 0.4), mats.brewBeam, ptX, pipeY, zC - 0.6));
  g.add(solid(new THREE.BoxGeometry(ptL, 0.5, 0.14), mats.brewBeam, ptX, pipeY + 0.2, zC - 0.56));
  g.add(solid(new THREE.BoxGeometry(ptL, 0.5, 0.14), mats.brewBeam, ptX, pipeY + 0.2, zC - 0.22));
  g.add(solid(new THREE.BoxGeometry(0.36, 0.09, 0.4), mats.lead, stX - 1.2, pipeY, zC + 0.6));
  g.add(solid(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 8), mats.lead, stX - 0.2, pipeY + 0.4, zC + 0.8));
  // 热水桶
  g.add(solid(new THREE.CylinderGeometry(0.55, 0.5, 1.0, 12), mats.brewWood, -w / 2 + T + 1.2, 0.5, zC + 3.4));
  g.add(solid(new THREE.TorusGeometry(0.55, 0.04, 6, 14), mats.lead, -w / 2 + T + 1.2, 0.95, zC + 3.4, 0));
}

// 冷却·发酵：冷却盘（浅长木盘层层叠）+ 麦汁桶 + 发酵桶（带盖压石）+ 量酒尺
function cooling(g, mats, rnd, w, d, h) {
  const zC = -0.6;
  // 冷却盘：三层，每层两块浅盘，层层往外挑出一小截（读起来就是"层层叠"）
  for (let lv = 0; lv < 3; lv++) {
    for (const s of [-1, 1]) {
      const px = -w / 2 + T + 1.4 + lv * 0.22, pz = zC + s * (2.4 - lv * 0.1);
      g.add(solid(new THREE.BoxGeometry(2.4, 0.5, 1.5), mats.brewWood, px, 0.5 + lv * 0.62, pz));
      for (const [bw, bh, bd, bx, by, bz] of [
        [2.5, 0.1, 0.1, 0, 0.25, -0.75], [2.5, 0.1, 0.1, 0, 0.25, 0.75],
        [0.1, 0.1, 1.6, -1.2, 0.25, 0], [0.1, 0.1, 1.6, 1.2, 0.25, 0]]) {
        g.add(solid(new THREE.BoxGeometry(bw, bh, bd), mats.brewWood, px + bx, 0.5 + lv * 0.62 + by, pz + bz));
      }
      // 盘里的麦汁：薄一层。**要低于盘沿一截**（盘沿顶在 0.5+lv*0.62+0.30），
      // 齐平或只低一点点都会被 check-zfight 判成与盘沿共面（报 2 处 90+ m²）。
      g.add(solid(new THREE.BoxGeometry(2.3, 0.04, 1.4), mats.wort, px, 0.58 + lv * 0.62, pz));
    }
  }
  // 麦汁桶：大木桶 + 两道铁箍 + 一个木盖。
  // 箍是 TorusGeometry，天然躺在 XY 平面（轴沿 z）；要箍住一根**竖着**的桶，
  // 得把它转 90° 躺成水平（轴沿 y），不然箍就是一个立着的圈，比桶还高、还往地下扎。
  const hoop = (r, x, y, z) => solid(new THREE.TorusGeometry(r, 0.045, 6, 16), mats.lead, x, y, z)
    .rotateX(Math.PI / 2);
  const tunX = w / 2 - T - 1.5, tunZ = zC + 2.6;
  g.add(solid(new THREE.CylinderGeometry(1.05, 0.9, 1.7, 14), mats.brewWood, tunX, 0.85, tunZ));
  for (const yy of [0.5, 1.2]) g.add(hoop(1.0, tunX, yy, tunZ));
  g.add(solid(new THREE.CylinderGeometry(1.06, 1.06, 0.1, 14), mats.brewBeam, tunX, 1.74, tunZ));
  // 发酵桶：矮一些、带盖、盖上压一块石头（把酒里的二氧化碳压住）
  for (let i = 0; i < 2; i++) {
    const fx = w / 2 - T - 1.5, fz = zC - 3.0 + i * 2.4;
    g.add(solid(new THREE.CylinderGeometry(0.85, 0.78, 1.3, 14), mats.brewWood, fx, 0.65, fz));
    for (const yy of [0.4, 1.0]) g.add(hoop(0.84, fx, yy, fz));
    g.add(solid(new THREE.CylinderGeometry(0.9, 0.9, 0.09, 14), mats.brewBeam, fx, 1.34, fz));
    g.add(solid(new THREE.BoxGeometry(0.42, 0.2, 0.42), mats.wall, fx, 1.48, fz));
  }
  // 量酒尺：一根带刻度的小板插在麦汁桶里
  g.add(solid(new THREE.BoxGeometry(0.05, 1.3, 0.14), mats.brewWood, tunX + 0.3, 1.9, tunZ));
  for (let i = 0; i < 5; i++) {
    g.add(solid(new THREE.BoxGeometry(0.07, 0.02, 0.1), mats.lead, tunX + 0.31, 1.5 + i * 0.22, tunZ));
  }
}

// 酒窖·酒肆：横躺的橡木大桶排 + 灌装台（桶架 + 龙头）+ 长凳与桌子 + 酒杯架 + 账台
function cellar(g, mats, rnd, w, d, h) {
  const zC = 1.0;
  // 横躺的橡木大桶：躺在木托架上，桶口朝巷（-x），每层 3 个、上下两层。
  // 桶是绕 z 转 90° 躺下的（axis 沿 x），所以两道铁箍要绕 y 转 90° 才箍得住
  // ——箍默认躺在 XY 平面，直接摆就是一个立着的圈，比桶还高一大截。
  // 桶心距取 2.9：横躺的桶沿 z 占 1.5 m，心距若只 2.6，相邻两只桶连箍的投影会压到一起，
  // check-zfight 按"投影重叠"判成一对共面（这里报了几十 m²）。
  const caskG = new THREE.CylinderGeometry(0.62, 0.62, 1.5, 14);
  const caskX = w / 2 - T - 1.1;
  for (let lv = 0; lv < 2; lv++) {
    for (let i = 0; i < 3; i++) {
      const cz = zC - 2.9 + i * 2.9;
      const cy = 0.78 + lv * 1.5;
      g.add(solid(caskG, mats.oak, caskX, cy, cz).rotateZ(Math.PI / 2));
      for (const s of [-1, 1]) {
        g.add(solid(new THREE.TorusGeometry(0.63, 0.04, 6, 16), mats.lead,
          caskX + s * 0.5, cy, cz).rotateY(Math.PI / 2));
      }
      // 托架：两块底板 + 四条腿
      for (const sz of [-1, 1]) {
        g.add(solid(new THREE.BoxGeometry(1.7, 0.12, 0.16), mats.brewBeam, caskX, cy - 0.66, cz + sz * 0.5));
        for (const s of [-1, 1]) {
          g.add(solid(new THREE.BoxGeometry(0.14, 0.66, 0.16), mats.brewBeam, caskX + s * 0.7, cy - 0.33, cz + sz * 0.5));
        }
      }
    }
  }
  // 灌装台：一张长台 + 台上一个立着的空桶（桶口朝上）+ 一个龙头架
  const fhX = -w / 2 + T + 1.6, fhZ = zC + 3.4;
  g.add(solid(new THREE.BoxGeometry(1.0, 0.14, 3.0), mats.brewBeam, fhX, 0.95, fhZ));
  for (const sz of [-1, 1]) {
    g.add(solid(new THREE.BoxGeometry(0.8, 0.9, 0.14), mats.brewBeam, fhX, 0.47, fhZ + sz * 1.3));
  }
  g.add(solid(new THREE.CylinderGeometry(0.5, 0.44, 0.9, 12), mats.oak, fhX, 1.5, fhZ - 0.8));
  for (const yy of [1.2, 1.75]) {
    g.add(solid(new THREE.TorusGeometry(0.49, 0.035, 6, 14), mats.lead, fhX, yy, fhZ - 0.8).rotateX(Math.PI / 2));
  }
  // 龙头：铅管 + 一个铜把手
  g.add(solid(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), mats.lead, fhX - 0.3, 1.1, fhZ - 0.8));
  g.add(solid(new THREE.BoxGeometry(0.06, 0.06, 0.28), mats.copper, fhX - 0.42, 1.1, fhZ - 0.8));
  // 酒肆：一张长桌 + 两条长凳（对着门，修士和来买酒的人站着喝）
  const tbX = -w / 2 + T + 3.0, tbZ = zC - 3.6;
  g.add(solid(new THREE.BoxGeometry(1.0, 0.12, 4.0), mats.brewWood, tbX, 0.86, tbZ));
  for (const sz of [-1, 1]) {
    g.add(solid(new THREE.BoxGeometry(0.14, 0.8, 3.6), mats.brewBeam, tbX, 0.43, tbZ + sz * 1.7));
    // 长凳
    g.add(solid(new THREE.BoxGeometry(0.42, 0.1, 3.6), mats.brewWood, tbX + (sz < 0 ? 1.0 : -1.0), 0.46, tbZ));
    for (const bx of [-1.5, 1.5]) {
      g.add(solid(new THREE.BoxGeometry(0.36, 0.44, 0.1), mats.brewBeam, tbX + (sz < 0 ? 1.0 : -1.0), 0.22, tbZ + bx));
    }
  }
  // 酒杯架：东墙（x1 那面）上一块板，挂着五只陶杯。
  // 板是 0.1 薄、2.6 长，长的方向必须沿 **z**（顺着墙），厚度沿 x（贴着墙）。
  // 写成 (2.6, 0.9, 0.1) 就是把 2.6 m 长的板横着怼进墙里，两头各戳出墙外 1.3 m。
  const cupX = w / 2 - T - 0.12;
  g.add(solid(new THREE.BoxGeometry(0.1, 0.9, 2.6), mats.brewBeam, cupX, 1.9, d / 2 - T - 1.6));
  for (let i = 0; i < 5; i++) {
    g.add(solid(new THREE.CylinderGeometry(0.11, 0.08, 0.24, 10), mats.earthen,
      cupX - 0.16, 1.72, d / 2 - T - 2.6 + i * 0.5));
  }
  // 石台基：酒肆这侧铺一段矮石台（比地坪高两级），酒肆就在台上喝。
  // 原先这里写的是"下窖石阶"——但屋里没有挖地坑，台阶往下就是穿到地坪以下变成露天的坑。
  // 改成向上的两级石台，比"一个没有底的台阶"诚实，也不穿地。
  const stX = -w / 2 + T + 1.5, stZ = zC - 4.6;
  g.add(solid(new THREE.BoxGeometry(2.4, 0.22, 2.2), mats.brewStone, stX, 0.11, stZ));
  g.add(solid(new THREE.BoxGeometry(2.4, 0.22, 2.2), mats.brewStone, stX, 0.33, stZ));
  // 账台：靠门那侧一张小桌 + 一本摊开的账簿
  const acX = -w / 2 + T + 0.9, acZ = -d / 2 + T + 1.4;
  g.add(solid(new THREE.BoxGeometry(0.7, 0.1, 1.4), mats.brewWood, acX, 0.9, acZ));
  for (const sz of [-1, 1]) {
    g.add(solid(new THREE.BoxGeometry(0.6, 0.86, 0.12), mats.brewBeam, acX, 0.45, acZ + sz * 0.55));
  }
  g.add(solid(new THREE.BoxGeometry(0.44, 0.06, 0.6), mats.sack, acX, 0.97, acZ));
}

// ---------- 压榨房（葡萄酒线第 2 站） ----------
// 两台**螺旋压榨机**：中世纪最有辨识度的器物之一 —— 石台基上一圈槽帮接住流下来的葡萄汁，
// 筐里堆葡萄，压板压下去，中央螺杆穿过顶横梁，人推着顶上的杠杆吊臂转螺杆。
// 参考 docs/wine-research.md：Clos de Vougeot 1477 年的压榨房 cuverie 就是"四台巨型压榨机 +
// 双排酒槽"这个组合，我们要的正是它。
//
// 堆叠一律**贴平**（上下两块的接触面严丝合缝）：check-zfight 第 120 行明确跳过法线相反的面
// （"背对背的两面被包在实体内部，不会闪"），反而留 1–5 cm 的缝才会被 6 cm 阈值判成几乎共面。
function press(g, mats, rnd, w, d, h) {
  const screwPress = (px, pz) => {
    // 石台基
    g.add(solid(new THREE.BoxGeometry(3.0, 0.3, 3.0), mats.brewStone, px, 0.15, pz));
    // 一圈槽帮（坐在台基上）+ 台基上那层葡萄汁
    for (const s of [-1, 1]) {
      g.add(solid(new THREE.BoxGeometry(0.16, 0.28, 3.0), mats.brewBeam, px + s * 1.3, 0.44, pz));
      g.add(solid(new THREE.BoxGeometry(3.0, 0.28, 0.16), mats.brewBeam, px, 0.44, pz + s * 1.3));
    }
    g.add(solid(new THREE.BoxGeometry(2.2, 0.08, 2.2), mats.grape, px, 0.34, pz));  // 汁面
    // 压筐 + 筐里那堆葡萄（压扁的球：圆柱顶是平的，堆葡萄得鼓出来才像）
    g.add(solid(new THREE.CylinderGeometry(0.75, 0.6, 1.1, 12), mats.brewWood, px, 0.85, pz));
    const mound = solid(new THREE.SphereGeometry(0.66, 14, 8), mats.grape, px, 1.38, pz);
    mound.scale.set(1, 0.34, 1);
    g.add(mound);
    // 压板：正压进葡萄堆里
    g.add(solid(new THREE.CylinderGeometry(0.92, 0.92, 0.16, 14), mats.brewWood, px, 1.55, pz));
    // 两根立柱托住顶横梁（柱脚落在台基外侧，柱顶与梁底贴平）
    for (const s of [-1, 1]) {
      g.add(solid(new THREE.BoxGeometry(0.34, 3.6, 0.34), mats.brewBeam, px + s * 1.45, 1.8, pz));
    }
    g.add(solid(new THREE.BoxGeometry(3.4, 0.4, 0.6), mats.brewBeam, px, 3.8, pz));
    // 中央螺杆 + 几道螺纹（螺纹是套在杆上的圈，读起来才像螺杆而不是根铁棍）
    g.add(solid(new THREE.CylinderGeometry(0.13, 0.13, 2.9, 10), mats.lead, px, 3.0, pz));
    for (const ry of [2.0, 2.4, 2.8, 3.2, 4.2]) {
      g.add(solid(new THREE.TorusGeometry(0.17, 0.045, 6, 14), mats.lead, px, ry, pz).rotateX(Math.PI / 2));
    }
    // 杠杆吊臂：插在螺杆头上，人推着它转
    g.add(solid(new THREE.BoxGeometry(0.34, 0.34, 4.0), mats.brewBeam, px, 4.55, pz));
  };
  screwPress(-0.6, -3.6);
  screwPress(-0.6, 3.6);

  // 发酵槽：压出来的葡萄汁在这里开始变成酒
  const vx = 3.9, vz = -3.4;
  g.add(solid(new THREE.CylinderGeometry(1.05, 0.95, 1.5, 16), mats.brewWood, vx, 0.75, vz));
  for (const yy of [0.5, 1.15]) {
    g.add(solid(new THREE.TorusGeometry(1.0, 0.045, 6, 18), mats.lead, vx, yy, vz).rotateX(Math.PI / 2));
  }
  g.add(solid(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 16), mats.brewBeam, vx, 1.55, vz));
  g.add(solid(new THREE.BoxGeometry(0.24, 0.2, 0.24), mats.brewStone, vx, 1.7, vz));   // 盖上压石

  // 葡萄筐堆：三只叠着，顶上一只敞着口露葡萄
  for (let i = 0; i < 3; i++) {
    g.add(solid(new THREE.CylinderGeometry(0.55, 0.48, 0.5, 12), mats.brewWood, 4.3, 0.25 + i * 0.5, 0.6));
  }
  const top = solid(new THREE.SphereGeometry(0.5, 12, 8), mats.grape, 4.3, 1.55, 0.6);
  top.scale.set(1, 0.4, 1);
  g.add(top);

  // 晾葡萄的架：三层浅盘，破摘下来的葡萄先摊在上面吹干
  for (const s of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(solid(new THREE.BoxGeometry(0.14, 2.4, 0.14), mats.brewBeam, 4.4 + s * 0.55, 1.2, 4.8 + sz * 0.9));
  }
  for (const ty of [0.9, 1.5, 2.1]) {
    g.add(solid(new THREE.BoxGeometry(1.5, 0.06, 2.0), mats.brewWood, 4.4, ty, 4.8));
  }

  // 门口的搬运车（停在门内侧、但要让开门那一段：门洞在 z ±1.8）
  const cx0 = -4.4, cz0 = -4.2;
  g.add(solid(new THREE.BoxGeometry(0.8, 0.44, 1.2), mats.brewWood, cx0, 0.52, cz0));
  for (const sz of [-1, 1]) {
    g.add(solid(new THREE.CylinderGeometry(0.24, 0.24, 0.09, 10), mats.brewWood, cx0 - 0.3, 0.24, cz0 + sz * 0.42, Math.PI / 2));
    g.add(solid(new THREE.BoxGeometry(0.07, 0.07, 1.1), mats.brewBeam, cx0 + 0.28, 0.66, cz0 + sz * 0.3));
  }
  // 门边两只空筐（等着装压完的葡萄渣）
  for (let i = 0; i < 2; i++) {
    g.add(solid(new THREE.CylinderGeometry(0.5, 0.42, 0.5, 12), mats.brewWood, -4.6, 0.25, 4.0 + i * 0.9));
  }
}

// ---------- 葡萄酒窖（葡萄酒线第 3 站，独立于啤酒酒窖） ----------
// 比啤酒酒窖矮一截（h 4.8 / rh 1.9），加上外墙那道土坡，读作"挖进地里的窖"。
// 依据 docs/wine-research.md：Clos de Vougeot 1160–1190 建的大酒窖 cellier 是半地下 + 石柱 +
// 橡木大梁；恒温靠土。**门前不挖 1.2 m 地坑**：门外只剩 1.4 m 宽、还要过明沟，
// 挖下去会把大院水路挖断 —— 改成墙外堆土坡（town.js 的 berm），读的是同一件事。
function winecellar(g, mats, rnd, w, d, h) {
  // 站立的橡木桶：比啤酒桶**小而高**（直径 1.0、高 1.9），沿东墙一排。
  // 啤酒酒窖那边是横躺的大桶，两种桶一眼分得出是两条酒。
  const caskG = new THREE.CylinderGeometry(0.5, 0.45, 1.9, 14);
  for (let i = 0; i < 5; i++) {
    const cz = -4.8 + i * 2.4, cx = 4.6;
    g.add(solid(caskG, mats.oak, cx, 0.95, cz));
    for (const yy of [0.45, 1.5]) {
      g.add(solid(new THREE.TorusGeometry(0.49, 0.04, 6, 16), mats.lead, cx, yy, cz).rotateX(Math.PI / 2));
    }
    // 桶顶的取酒口塞
    g.add(solid(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8), mats.brewWood, cx, 1.98, cz));
  }

  // 半埋的陶瓮 pithos ×2：石头箍圈埋在地坪里，陶瓮插进去，露出来的不到一半。
  // 陶瓮下端**整段埋在箍圈里**（不碰地坪），所以不会与地坪底面打架。
  for (const pz of [-4.6, 4.6]) {
    const px = -3.9;
    g.add(solid(new THREE.CylinderGeometry(0.9, 0.95, 0.8, 14), mats.brewStone, px, 0.4, pz));
    g.add(solid(new THREE.CylinderGeometry(0.66, 0.42, 1.7, 14), mats.earthen, px, 1.25, pz));
    // 蒙布 + 压石
    g.add(solid(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 14), mats.sack, px, 2.14, pz));
    g.add(solid(new THREE.BoxGeometry(0.3, 0.18, 0.3), mats.brewStone, px, 2.27, pz));
  }

  // 酒架：三层搁板 + 搁板上横躺的小桶
  for (const sx of [-1, 1]) {
    g.add(solid(new THREE.BoxGeometry(0.16, 2.6, 0.16), mats.brewBeam, 0.6 + sx * 1.6, 1.3, 6.0));
  }
  for (const sy of [0.5, 1.3, 2.1]) {
    g.add(solid(new THREE.BoxGeometry(3.6, 0.12, 0.7), mats.brewWood, 0.6, sy, 6.0));
    for (const i of [-1, 0, 1]) {
      g.add(solid(new THREE.CylinderGeometry(0.24, 0.24, 0.9, 10), mats.oak, 0.6 + i * 1.0, sy + 0.3, 6.0)
        .rotateZ(Math.PI / 2));
      for (const hs of [-0.28, 0.28]) {
        g.add(solid(new THREE.TorusGeometry(0.25, 0.03, 6, 12), mats.lead, 0.6 + i * 1.0 + hs, sy + 0.3, 6.0)
          .rotateY(Math.PI / 2));
      }
    }
  }

  // 油灯 ×2：墙上探出一小段托架，托架上一只油碗 + 一点火。
  // 屋里没有天光（h 4.8 的矮窖更暗），这两点火是唯一的暖光，跟灶膛的 ember 一个道理。
  for (const [lx, lz] of [[-5.6, -2.6], [5.6, 2.6]]) {
    g.add(solid(new THREE.BoxGeometry(0.26, 0.06, 0.06), mats.brewBeam, lx, 2.3, lz));
    g.add(solid(new THREE.CylinderGeometry(0.15, 0.09, 0.14, 10), mats.earthen, lx + (lx < 0 ? 0.2 : -0.2), 2.24, lz));
    g.add(ember(0.1, 0.16, 0.1, lx + (lx < 0 ? 0.2 : -0.2), 2.38, lz, 2.2));
  }
}

// ---------- 派工 ----------
// 每座房子按 key 取自己的器具。新增建筑时在这里加一行（并去 town.js 的 BREW 里补一条）。
const GEAR = {
  granary, kiln, malthouse, brewhouse, cooling, cellar, press, winecellar,
};

// 器具组在房子局部坐标里建好后挂上去；返回组，方便调用方再加东西。
export function buildGear(spec, mats, rnd) {
  const g = new THREE.Group();
  const w = spec.x1 - spec.x0, d = spec.z1 - spec.z0;
  const fn = GEAR[spec.key];
  if (fn) fn(g, mats, rnd, w, d, spec.h);
  return g;
}

// 演示页 tools/brewprocess.html 用：每道工序在屋里"该看哪里"的机位（世界坐标）。
// 从 spec 直接算，与真实几何同源；页面里不再另抄一组相机坐标。
// 眼高 1.7 m（真人），站位偏向屋内中线——多数器具沿两侧墙摆，站在中间看得最全。
export function gearAnchor(spec) {
  const cx = (spec.x0 + spec.x1) / 2, cz = (spec.z0 + spec.z1) / 2;
  return { x: cx, y: 1.7, z: cz };
}