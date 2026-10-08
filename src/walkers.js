// 领地里的修士 NPC：几位修士沿着院落的动线来回走，用的是第三人称替身
// （src/person.js 的 buildPerson）与同一套正弦摆臂（poseWalk）。
//
// 为什么挂 scene 而不挂 root：root 是"教堂+领地"这个会进碰撞网格、会进室内烘焙、
// 会被七个检查器扫描的对象。NPC 是**会动的**——丢进加速网格（src/grid.js 建一次就不动）
// 会留下残影，碰撞、烘焙、检查器也都不该看见它们。所以跟第三人称替身一样挂在 scene 上，
// 只做纯视觉。代价：围墙拆除后的领地很开敞，这里靠**路径本身**贴着过道走来保证不穿墙；
// tools/check-npc.mjs 用同一份路由 + 同一张碰撞网格做静态校验（走一圈不撞任何东西）。
//
// 路由坐标与 src/town.js 的 CLO / LANE / BREW 对齐（改了那边记得改这里，校验器会报）。

import * as THREE from '../lib/three.module.js';
import { buildPerson, poseWalk } from './person.js';

// ---------- 路由 ----------
// 每条是一个折线（世界坐标 xz，y 是脚下的地坪高度），closed=true 是闭合环（绕圈走），
// closed=false 是开放路（走到头掉头，适合巷道/甬道）。四角做圆化。

// 回廊：CLO = { x0:18.5, z0:13.0, garth:16, depth:4.2 } → gx=22.7、gz=17.2，
//   内院 x[22.7,38.7] z[17.2,33.2]。四面敞廊的走道板落地后是：南 x[20.6,40.8] z[13,17.2]、
//   北 x[20.6,40.8] z[33.4,37.4]，但四角的敞廊拱墙会横到走道里（角上并不贯通），
//   所以回廊里让修士**沿一条走廊来回踱步**（开放路），不绕整圈。
const CLO_SOUTH = [[24.0, 15.0], [37.5, 15.0]];
const CLO_NORTH = [[24.0, 35.4], [37.5, 35.4]];
// 内院环道：绕中央水井（30.7,25.2，井圈半径1.25）外一圈；草地 y≈0.11，
// 离排水明沟内缘（x 23.2 / 38.2、z 17.7 / 32.7）各留 1.2 m。
const CLO_GARTH = [[24.4, 18.9], [37.0, 18.9], [37.0, 31.5], [24.4, 31.5]];

// 酿酒坊：LANE = { x0:57.5, x1:61.5, z0:-40, z1:76 }，巷面 y≈0.05。
// 酒坊紧贴巷东缘（x0 = 62 / 62.4），所以"巡查酒坊"就是沿巷来回走一条开放路。
const BREW_LANE_A = [[59.0, -36], [59.0, 72]];
const BREW_LANE_B = [[60.3, 74], [60.3, -38]];

// 西前庭集市：石板前庭 58×24 @(0,65)，y≈0.06。摊位在 (18,58)/(24,68)/(-14,64)/(-22,58)，
// 市场十字在 (13,66)（台座 3.6×3.6）。挑前庭西侧一块空场绕小圈。
const MARKET = [[0.0, 60.0], [8.5, 60.0], [8.5, 67.0], [0.0, 67.0]];

// 北侧墓地：碑林网格（x −46..−26 / z −44..46，列距 3.0、排距 3.2）里没有现成甬道，
//   沿碑林内缘走一圈（x = −45.3 / −27.3、z = −42 / 44），离最近的碑还有 0.9 m 以上。
const GRAVE = [[-45.3, -42.0], [-27.3, -42.0], [-27.3, 44.0], [-45.3, 44.0]];

// 一位修士：会衣调色板（robe 会衣 / robeDark 披肩兜帽 / belt 腰带）+ 路由 + 速度。
// 由近到远：回廊内院、走道、集市快些像在做事；墓园最慢像在默想。
const WALKERS = [
  // 回廊：两位在南北两条走廊里来回踱步，一位绕内院水井转经
  { key: 'clo-south', poly: CLO_SOUTH, closed: false, y: 0.32, speed: 1.05, r: 0.40, phase: 0, start: 0.08,
    pal: { robe: 0x4a4436, robeDark: 0x3a352b, belt: 0xd8ccb0 } },
  { key: 'clo-north', poly: CLO_NORTH, closed: false, y: 0.32, speed: 0.95, r: 0.40, phase: 2.1, start: 0.58,
    pal: { robe: 0x5c4a38, robeDark: 0x463829, belt: 0xccb894 } },
  { key: 'clo-garth', poly: CLO_GARTH, closed: true, y: 0.11, speed: 1.15, r: 0.34, phase: 1.0, start: 0.30,
    pal: { robe: 0x6b5a44, robeDark: 0x54462f, belt: 0xd2c39c } },
  // 酿酒坊：两位沿服务巷来回巡查（开放路，走到头掉头）
  { key: 'brew-a', poly: BREW_LANE_A, closed: false, y: 0.05, speed: 1.15, r: 0.38, phase: 0.6, start: 0.15,
    pal: { robe: 0x5a4a38, robeDark: 0x433528, belt: 0xc9b294 } },
  { key: 'brew-b', poly: BREW_LANE_B, closed: false, y: 0.05, speed: 1.00, r: 0.38, phase: 2.6, start: 0.62,
    pal: { robe: 0x4f4a3e, robeDark: 0x3d3830, belt: 0xcfc2a4 } },
  // 集市：一位在前庭西侧空场转
  { key: 'market', poly: MARKET, closed: true, y: 0.06, speed: 1.20, r: 0.36, phase: 1.7, start: 0.45,
    pal: { robe: 0x63503c, robeDark: 0x4a3a2b, belt: 0xd0c0a0 } },
  // 墓地：一位沿碑林内缘慢走（闭合环绕）
  { key: 'grave', poly: GRAVE, closed: true, y: 0.04, speed: 0.75, r: 0.42, phase: 0.9, start: 0.10,
    pal: { robe: 0x3f3b34, robeDark: 0x302d28, belt: 0xb9ac92 } },
];

export { WALKERS };

// 折线圆角：闭合环每个顶点都圆；开放路只圆中间顶点、两端保持尖角。
// 圆角用二次贝塞尔（控制点取原顶点）近似圆弧——行走看不出与正圆的差别。
function roundPolyline(poly, cornerR, closed = true, segStep = 0.4) {
  const n = poly.length;
  const V = poly.map(([x, z]) => new THREE.Vector2(x, z));
  const out = [];
  const pushArc = (p1, B, p2) => {
    const steps = Math.max(2, Math.ceil(p1.distanceTo(p2) / segStep));
    for (let s = 0; s <= steps; s++) {
      const u = s / steps, w = 1 - u;
      out.push(new THREE.Vector2(
        w * w * p1.x + 2 * w * u * B.x + u * u * p2.x,
        w * w * p1.y + 2 * w * u * B.y + u * u * p2.y));
    }
  };
  const corners = [];
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) continue;
    const A = V[(i - 1 + n) % n], B = V[i], C = V[(i + 1) % n];
    const v1 = A.clone().sub(B); const l1 = v1.length(); v1.divideScalar(l1 || 1);
    const v2 = C.clone().sub(B); const l2 = v2.length(); v2.divideScalar(l2 || 1);
    const d = Math.min(cornerR, l1 * 0.5, l2 * 0.5);
    corners.push({ B, p1: B.clone().addScaledVector(v1, d), p2: B.clone().addScaledVector(v2, d) });
  }
  if (!closed) out.push(V[0].clone());
  for (const c of corners) pushArc(c.p1, c.B, c.p2);
  if (!closed) out.push(V[n - 1].clone());
  return out;
}

// 弧长参数化：cum[i] 是到第 i 个点的累计长度；闭合环再补上回到起点的一段。
function arcParam(pts, closed) {
  const cum = [0];
  const m = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    cum.push(cum[i] + a.distanceTo(b));
  }
  return { pts, cum, total: cum[cum.length - 1], closed };
}

// 一条路由 = 圆角 + 弧长参数化。校验器 tools/check-npc.mjs 也用它，
// 保证"算出来的走线"与场景里真走的是同一条。
export function buildRoute(poly, closed = true) {
  const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
  const short = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  const pts = roundPolyline(poly, Math.min(2.2, Math.max(0.45, short * 0.28)), closed);
  return arcParam(pts, closed);
}

// 按弧长在路由上取点：位置 + 朝向。开放路到两端掉头（三角波反射，返程朝向 +π）。
// 朝向以模型面向 -z 为准（与替身/第三人称一致）。
export function pointAt(route, s) {
  const { pts, cum, total, closed } = route;
  let headingFlip = 0;
  if (closed) {
    s = ((s % total) + total) % total;
  } else {
    const x = ((s % (2 * total)) + 2 * total) % (2 * total);
    if (x <= total) s = x;
    else { s = 2 * total - x; headingFlip = Math.PI; }
  }
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
  const seg = cum[lo + 1] - cum[lo] || 1;
  const u = (s - cum[lo]) / seg;
  const a = pts[lo], b = pts[(lo + 1) % pts.length];
  const heading = Math.atan2(-(b.x - a.x), -(b.y - a.y)) + headingFlip;
  return { x: a.x + (b.x - a.x) * u, z: a.y + (b.y - a.y) * u, heading };
}

// ---------- 创建与更新 ----------
export function createWalkers() {
  const group = new THREE.Group();
  group.name = 'walkers';
  const list = [];
  for (const def of WALKERS) {
    const person = buildPerson(def.pal);
    person.visible = true;
    const route = buildRoute(def.poly, def.closed !== false);
    group.add(person);
    list.push({
      def, person, route, y: def.y ?? 0,
      s: route.total * (def.start ?? 0), x: 0, z: 0, heading: 0,
    });
  }

  // 每帧推进：s 前进、摆臂、走路的上下轻重（bob）。
  function update(dt) {
    for (const w of list) {
      w.s += w.def.speed * dt;
      const p = pointAt(w.route, w.s);
      w.x = p.x; w.z = p.z; w.heading = p.heading;
      const phase = (w.s / (w.def.speed * 1.2)) * Math.PI * 2 + w.def.phase;
      poseWalk(w.person, phase, 0.55, true);
      const bob = Math.abs(Math.sin(phase)) * 0.02;
      w.person.position.set(w.x, w.y + bob, w.z);
      w.person.rotation.y = w.heading;
    }
  }

  // 供校验/无头脚本探针：每位的当前世界位置
  function positions() {
    return list.map((w) => ({ key: w.def.key, x: w.x, y: w.y, z: w.z, heading: w.heading }));
  }

  group.userData.count = list.length;
  return { group, update, positions, list };
}
