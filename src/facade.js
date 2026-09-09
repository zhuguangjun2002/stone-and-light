// 西立面：哥特立面的"标准答案"——双塔 + 三门廊 + 玫瑰窗 + 山墙。
// 三座门对应中厅与两侧廊（平面直接写在立面上）；玫瑰窗给中厅轴线送光；
// 双塔在结构上压稳立面，在城市里是远眺的地标。

import * as THREE from '../lib/three.module.js';
import { wallWithOpenings, openingGlassGeometry, openingShape, gableGeometry, makePinnacle, archApex } from './gothic.js';
import { makeStatue } from './figure.js';

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

// 柱像的托座与华盖：脚下一块托石（socle），头上一顶小尖顶（dais）——
// 哥特门龛上的像几乎都有这两样，没有的话像是"贴"上去的。
function statueNiche(h, mat, opts = {}) {
  const { canopy = true, halo = false } = opts;
  const g = new THREE.Group();
  const socle = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.085, h * 0.105, h * 0.08, 8), mat);
  socle.position.y = h * 0.045;
  g.add(socle);
  const fig = makeStatue(h, mat, { halo, seed: opts.seed ?? 7 });
  fig.position.y = h * 0.09;
  g.add(fig);
  if (canopy) {
    // 华盖：小尖顶 + 一块托板，托板往墙里伸，看着是从墙上挑出来的，不是飘着的
    const cap = new THREE.Mesh(new THREE.ConeGeometry(h * 0.095, h * 0.17, 6), mat);
    cap.position.set(0, h * 1.31, -h * 0.05);
    g.add(cap);
    const abacus = new THREE.Mesh(new THREE.BoxGeometry(h * 0.19, h * 0.035, h * 0.3), mat);
    abacus.position.set(0, h * 1.21, -h * 0.08);
    g.add(abacus);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// 门楣浮雕：《最后的审判》的标准构图——
// 正中基督坐在杏仁形的**曼多拉（mandorla）**里，两侧天使托举；最下面紧贴过梁的一带
// 最小，是复活的死者与"称量灵魂"。这里按浮雕做：把轮廓挤出几厘米贴在门楣板上。
function tympanumRelief(innerA, lintelTop, apexY, mats, rich) {
  const g = new THREE.Group();
  const k = innerA / 1.9;                          // 按门洞大小整体缩放
  const midY = lintelTop + (apexY - lintelTop) * 0.46;
  const hw = 0.88 * k, hh = 1.75 * k;
  const m = new THREE.Shape();                     // 杏仁形
  m.moveTo(0, -hh);
  m.quadraticCurveTo(hw * 1.35, 0, 0, hh);
  m.quadraticCurveTo(-hw * 1.35, 0, 0, -hh);
  const mand = new THREE.Mesh(new THREE.ExtrudeGeometry(m, { depth: 0.09, bevelEnabled: false }), mats.stone);
  mand.position.set(0, midY, 0.16);
  mand.castShadow = true;
  g.add(mand);
  const christ = makeStatue(2.05 * k, mats.stoneLight, { halo: true, seed: 11 });
  christ.scale.y = 0.82;                           // 坐姿：身子压短
  christ.position.set(0, midY - hh * 0.72, 0.26);
  g.add(christ);
  if (rich) {
    for (const sx of [1, -1]) {                    // 托举曼多拉的天使
      const a = makeStatue(1.15 * k, mats.stoneLight, { seed: sx > 0 ? 21 : 22 });
      a.position.set(sx * (hw + 0.62 * k), midY - hh * 0.55, 0.2);
      a.rotation.y = -sx * 0.35;
      g.add(a);
    }
    // 最下一带：复活的死者，紧贴过梁，个子最小
    const n = 7, span = innerA * 1.5;
    for (let i = 0; i < n; i++) {
      const f = makeStatue(0.52 * k, mats.stoneLight, { seed: 40 + i, arms: false, rings: 12, seg: 10 });
      f.position.set(-span / 2 + span * (i / (n - 1)), lintelTop + 0.06, 0.2);
      g.add(f);
    }
  }
  return g;
}

// 一座门：过梁（lintel）+ 门楣（tympanum）+ 中柱（trumeau）+ 两扇门板 + 便门（wicket）
//
// 真教堂的大门远比门洞矮：门扇顶上横一道过梁，过梁以上的尖拱面是**实心的门楣浮雕**。
// 原来这里把整个尖拱洞口做成一整片门扇——中门就成了 6 m 宽、13.65 m 高的一块板，
// 比管风琴楼廊的底面（8.35 m）还高 5 m，向内开会直接撞进楼廊，根本开不了。
// 中门宽 6 m，两扇之间还要立一根中柱顶住过梁；左扇上挖一个便门——巨门要几个人合力
// 才推得开，日常都是从这扇小门进出，大扇只在庆典、出殡时才开。
//
// 门轴朝室内（-z）：门龛层层内收，向外开会撞上门龛。每扇门板都装在自己的枢轴组里，
// 组上记着 userData.door，之后做开关动画时直接转这个组就行。
export function doorAssembly(op, mats, cfg = {}) {
  const grp = new THREE.Group();
  const a = op.a;
  // 门扇要装在**最内一圈**门龛的洞口里（门龛层层内收，门在最窄那一圈），不能按外圈
  // 的洞口做——那样门比它要转进去的洞还宽，一开就撞门框。外圈到内圈之间的门颊不用
  // 另做：最内一圈门龛的墙体本身就是门颊（再补一块反而与它面对面共面，成片打架）。
  const doorA = cfg.doorA ?? a;
  const doorH = cfg.doorH ?? Math.min(4.6, op.springY * 0.62);
  const T = 0.12;                                  // 门板厚
  const lintelH = 0.42;
  const trW = cfg.trumeau ? 0.45 : 0;              // 中柱宽
  const lintelTop = doorH + lintelH;

  // 门楣：过梁以上整片填实（真教堂这里是《最后的审判》一类的浮雕）
  const tymp = new THREE.Mesh(
    new THREE.ExtrudeGeometry(openingShape({ ...op, y0: lintelTop }), { depth: 0.3, bevelEnabled: false }),
    mats.stoneLight);
  tymp.position.z = -0.15;
  tymp.castShadow = tymp.receiveShadow = true;
  grp.add(tymp);

  // 过梁
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(a * 2 + 0.1, lintelH, 0.5), mats.stone);
  lintel.position.set(op.cx, doorH + lintelH / 2, -0.1);
  lintel.castShadow = true;
  grp.add(lintel);

  // 中柱：门太宽时顶住过梁中点。中柱上立一尊像——高哥特中门的标配
  // （亚眠是"美丽的上帝"，沙特尔王门是国王像柱），像脚下有托座、头上有华盖。
  if (cfg.trumeau) {
    const tr = new THREE.Mesh(new THREE.BoxGeometry(trW, doorH + 0.05, 0.42), mats.stoneLight);
    tr.position.set(op.cx, (doorH + 0.05) / 2, -0.06);
    tr.castShadow = true;
    grp.add(tr);
    const st = statueNiche(Math.min(2.1, doorH * 0.46), mats.stone, { halo: true, seed: 3 });   // 中柱上是基督，有头光
    st.position.set(op.cx, doorH * 0.24, 0.19);
    grp.add(st);
  }

  // 门楣浮雕
  if (cfg.innerA) {
    grp.add(tympanumRelief(cfg.innerA, lintelTop, cfg.innerApex ?? (lintelTop + 4.5), mats, !!cfg.trumeau));
  }

  // 门板要比洞口"宽出一点"、铰链也往石头里挪一点：真门是压在门框上的（有裁口），
  // 门板正好卡进洞口的话，四边会漏出一条光缝——从暗的室内往亮处看尤其明显。
  const REB = 0.03;                                // 压过门框的量
  const leafW = doorA + REB - trW / 2;
  const wickW = Math.min(0.95, leafW * 0.5), wickH = Math.min(2.05, doorH * 0.46);
  // 便门往铰链一侧让开一点：它原来居中偏右，正好和大门环的底板打架，圆盘探进洞口里
  const wickCX = -leafW * 0.06, wickY0 = 0.12;   // 便门有道要跨过去的门槛
  for (const side of [-1, 1]) {                    // -1 左扇，+1 右扇
    const hasWick = cfg.wicket && side < 0;        // 便门只开在左扇上
    const pivot = new THREE.Group();               // 枢轴在门边侧的门框上
    pivot.position.set(op.cx + side * (doorA + REB), 0, 0);
    // 只开到 80°：门轴就在门洞边上，超过 90° 门板会往门框石头里钻（转到 100° 时
    // 门板尖端已经进墙 0.29 m）；而且正好 90° 时门板对着你是"刀刃朝前"，12 cm 厚
    // 什么也看不见——80° 留一点角度，门板能吃到光，也看得出它开着。
    pivot.userData.door = { side, max: cfg.max ?? 1.4 };
    grp.add(pivot);

    // 门板：有便门的那扇要**真的挖个洞**，不然把便门推开、后面还是整块门板
    const face = new THREE.Shape();
    face.moveTo(-leafW / 2, 0); face.lineTo(leafW / 2, 0);
    face.lineTo(leafW / 2, doorH); face.lineTo(-leafW / 2, doorH); face.closePath();
    if (hasWick) {
      const h = new THREE.Path();
      h.moveTo(wickCX - wickW / 2, wickY0); h.lineTo(wickCX + wickW / 2, wickY0);
      h.lineTo(wickCX + wickW / 2, wickY0 + wickH); h.lineTo(wickCX - wickW / 2, wickY0 + wickH);
      h.closePath();
      face.holes.push(h);
    }
    const leafG = new THREE.ExtrudeGeometry(face, { depth: T, bevelEnabled: false });
    leafG.translate(0, -doorH / 2, -T / 2);        // 原点挪到门板中心，配件的坐标照旧
    const leaf = new THREE.Mesh(leafG, mats.door);
    leaf.position.set(-side * leafW / 2, doorH / 2, -T / 2);
    leaf.castShadow = leaf.receiveShadow = true;
    pivot.add(leaf);

    // 中世纪教堂门的实际做法（资料出处见 README）：**竖向拼板**，背面横三四道
    // **撑条（ledge / batten）**把板钉在一起；正面是铁铰链带，钉子从正面打进、
    // 背面敲弯钉牢；铰链带不是钉死在门框上，而是套在门框里的 **L 形销轴（pintle）**
    // 上——所以转轴在门框上，不在门板上。钉子跟着撑条那几行走，不是满门乱撒。
    const wx0 = wickCX - wickW / 2, wy0 = wickY0, wy1 = wickY0 + wickH;
    const studG = new THREE.SphereGeometry(0.042, 8, 6);
    for (const hy of [doorH * 0.16, doorH * 0.55, doorH * 0.88]) {
      const x0 = side * leafW / 2;
      const inHole = hasWick && hy > wy0 - 0.1 && hy < wy1 + 0.1;   // 碰上便门洞要收住
      const w = inHole ? Math.max(0.12, Math.abs(x0 - (wx0 - 0.02))) : leafW * 0.66;
      const strap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.13, 0.03), mats.dark);
      strap.position.set(x0 - side * w / 2, hy - doorH / 2, T / 2 + 0.015);
      leaf.add(strap);
      const lw = inHole ? w : leafW * 0.94;                          // 背面撑条
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.16, 0.05), mats.door);
      ledge.position.set(inHole ? x0 - side * lw / 2 : 0, hy - doorH / 2, -T / 2 - 0.025);
      leaf.add(ledge);
      const n = Math.max(2, Math.round(w / 0.34));                   // 钉子沿铰链带排
      for (let i = 0; i < n; i++) {
        const stud = new THREE.Mesh(studG, mats.dark);
        stud.position.set(x0 - side * (0.08 + (w - 0.16) * (i / (n - 1 || 1))), hy - doorH / 2, T / 2 + 0.035);
        leaf.add(stud);
      }
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.19, 8), mats.dark);
      pin.position.set(side * (leafW / 2 + 0.012), hy - doorH / 2, T / 2 + 0.015);
      leaf.add(pin);                                                 // 销轴
    }
    // 门环：拉门的把手，钉在铁底板上，1.05 m 高。
    // （达勒姆主教座堂那只"庇护门环"是狮首衔环的**门锤**、挂在**北门**上，属于个例，
    //  不是每座门都有，所以这里就做成普通的拉环。）
    const ringY = 1.05 - doorH / 2, ringX = -side * (leafW / 2 - 0.22);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 12), mats.dark);
    plate.rotation.x = Math.PI / 2;
    plate.position.set(ringX, ringY, T / 2 + 0.012);
    leaf.add(plate);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 14), mats.dark);
    ring.position.set(ringX, ringY - 0.05, T / 2 + 0.03);
    ring.rotation.x = 0.5;
    leaf.add(ring);

    if (hasWick) {
      // 洞口一圈包边（真便门是拿铁条箍住洞口的）
      for (const [w, h, x, y] of [[wickW + 0.1, 0.05, wickCX, wickY0 + wickH + 0.02],
        [0.05, wickH + 0.1, wickCX - wickW / 2 - 0.02, wickY0 + wickH / 2],
        [0.05, wickH + 0.1, wickCX + wickW / 2 + 0.02, wickY0 + wickH / 2]]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, T + 0.03), mats.dark);
        bar.position.set(x, y - doorH / 2, 0);
        leaf.add(bar);
      }
      const wp = new THREE.Group();                // 便门自己的枢轴，可以单独开
      wp.position.set(wickCX - wickW / 2, wickY0 - doorH / 2, 0);
      wp.userData.door = { side: -1, max: cfg.wicketMax ?? 1.45, wicket: true, width: wickW };   // 同理，别超过 90°
      leaf.add(wp);
      const wleaf = new THREE.Mesh(new THREE.BoxGeometry(wickW - 0.02, wickH - 0.02, T * 0.8), mats.door);
      wleaf.position.set(wickW / 2, wickH / 2, 0);
      wleaf.castShadow = true;
      wp.add(wleaf);
      const wring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 12), mats.dark);
      wring.position.set(wickW / 2 - 0.16, wickH * 0.05, T * 0.4 + 0.02);
      wleaf.add(wring);
    }
  }
  grp.userData.doorId = cfg.id ?? '';
  grp.userData.doorHalf = doorA + REB;             // 门洞半宽，碰撞判断用
  return grp;
}

// 层叠退缩的尖拱门廊（voussoir 层层内收），朝 +z
export function portal(a, springY, mats, layers = 3, sillBack = layers * 0.8 + 0.2, doorZ = -layers * 0.8 + 0.1, sillW = a * 2 + 0.8, doorOp = null, doorCfg = {}) {
  const grp = new THREE.Group();
  // 门槛地坪：层叠的几道墙都从 y=0 起，洞口底边各自生成一片 y=0 的水平面，
  // 彼此完全共面（stone / stoneLight 两种颜色打架），走近时忽明忽暗、发惨白。
  // 用一块实心门槛把它们全压在下面，同时把室内铺地接到门口。
  const sill = new THREE.Mesh(new THREE.BoxGeometry(sillW, 0.2, sillBack + 0.15), mats.floor);
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
  // 门：过梁 + 门楣 + （中门另加）中柱 + 两扇门板
  const op = doorOp || { cx: 0, a: a - (layers - 1) * 0.55, y0: 0, springY: springY - (layers - 1) * 0.7, k: 1.3 };
  const innerA = a - (layers - 1) * 0.55, innerSpring = springY - (layers - 1) * 0.7;
  const door = doorAssembly(op, mats, {
    ...doorCfg, innerA, innerApex: innerSpring + archApex(innerA, 1.3),
  });
  door.position.set(0, 0, doorZ);
  grp.add(door);
  // 门龛侧壁的柱像（jamb / column figures）：哥特门龛最标志性的一件事，
  // 一层门龛立一对，越往里越小。最内一圈不放——那儿要留给门扇转进来。
  for (let i = 0; i < layers - 1; i++) {
    const ai = a - i * 0.55;
    const h = Math.min(2.5, springY * 0.42) * (1 - i * 0.12);
    for (const sx of [1, -1]) {
      // 门龛柱像是先知与列王，不带头光；每尊给不同种子——真门龛上没有两尊一样的
      const st = statueNiche(h, mats.stoneLight, { seed: 60 + i * 7 + (sx > 0 ? 3 : 0) });
      st.position.set(sx * (ai - 0.3), springY * 0.16, -i * 0.8 + 0.3);
      st.rotation.y = -sx * 0.5;                   // 略朝门洞里侧转
      grp.add(st);
    }
  }

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
  // 底层是可穿行的塔下开间（西立面三座门都要通到室内：中门进中厅，侧门穿过塔底进侧廊），
  // 所以塔身不是实心墩子：baseH 以下做四面厚墙，东西两面开门洞，以上才是实心塔体。
  const baseH = 9.2, wt = 1.4;   // 9.2 而不是 9：侧廊墩顶正好在 9，等高会顶面共面
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, H - baseH, w), mats.stone);
  body.position.y = baseH + (H - baseH) / 2;
  body.castShadow = body.receiveShadow = true;
  grp.add(body);
  const baseOp = [{ cx: 0, a: 1.15, y0: 0, springY: 5.2, k: 1.3 }];
  // 东西两面满宽，南北两面缩到净宽嵌在中间——四面都做满宽会在角上重叠、外皮共面
  const baseG = { pierced: wallWithOpenings(w, 0, baseH, wt, baseOp), solid: wallWithOpenings(w - 2 * wt, 0, baseH, wt, []) };
  for (let f = 0; f < 4; f++) {
    const bw = new THREE.Mesh(f % 2 === 0 ? baseG.pierced : baseG.solid, mats.stone);
    bw.rotation.y = (f * Math.PI) / 2;
    const off = w / 2 - wt / 2;
    bw.position.x = [0, off, 0, -off][f];
    bw.position.z = [off, 0, -off, 0][f];
    bw.castShadow = bw.receiveShadow = true;
    grp.add(bw);
  }
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
      { cx: 0, a: 3.05, y0: 0, springY: 7.55, k: 1.3 },   // 比门廊洞口大 0.05：否则两圈门龛侧壁共面
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
  const centerPortal = portal(3.0, 7.5, mats, 3, 2.12, -1.95, 6.8,
    { cx: 0, a: 3.0, y0: 0, springY: 7.5, k: 1.3 },    // 门槛接到中厅铺地；门落在西墙内皮
    { id: 'west-center', doorA: 1.9, doorH: 4.6, trumeau: true, wicket: true });
  centerPortal.position.z = z0 + T + 0.12;   // 错开 0.12：否则最内层门廊背面与西墙背面共面（z = 48）
  grp.add(centerPortal);
  labels.push({ text: '三门廊（层叠尖拱）', pos: [0, 15, z0 + 4], scope: 'out' });

  // 双塔（坐在侧廊端头上）
  const txc = P.naveHW + P.arcadeT + P.towerW / 2 - 0.4;
  for (const s of [1, -1]) {
    const asym = P.towerAsym && s < 0;   // 沙特尔式：北塔更高更尖
    const t = tower(P, mats, asym ? 7 : 0, asym ? 7 : 0);
    t.position.set(s * txc, 0, z0 + P.towerW / 2 - 0.5);
    grp.add(t);
    const side = portal(1.6, 5.5, mats, 2, 7.6, -0.18, 5.2,
      { cx: 0, a: 1.15, y0: 0, springY: 5.2, k: 1.3 },    // 门槛铺满塔下开间直到侧廊铺地
      { id: s > 0 ? 'west-south' : 'west-north', doorA: 1.05, doorH: 3.3 });
    side.position.set(s * txc, 0, z0 + P.towerW - 0.4);
    grp.add(side);
  }
  labels.push({ text: '西立面双塔', pos: [-txc, P.towerH + P.spireH + 2, z0 + 3], scope: 'out' });
  return grp;
}
