// 哥特几何基础件：尖拱曲线、带尖拱洞口的墙体、束柱、小尖塔。
// 尖拱由两段圆弧组成，圆心互换到对侧起拱点一侧；R = 2a·k（a 为半跨）。
// k = 1 即"等边尖拱"；k 越大拱越陡。尖拱的关键自由度：同一高度可配任意跨度。

import * as THREE from '../lib/three.module.js';

// 尖拱高度：x ∈ [-a, a] 处拱腹线相对起拱点的高度
export function archY(x, a, k = 1) {
  const R = 2 * a * k, c = R - a, u = Math.abs(x);
  if (u >= a) return 0;
  return Math.sqrt(R * R - (u + c) * (u + c));
}

// 尖拱顶点高（相对起拱点）
export function archApex(a, k = 1) {
  return a * Math.sqrt(4 * k - 1);
}

// 给定顶点高 h 反解 k（肋拱顶里用：不同跨度的券要拱到同一高度）
export function kForApex(a, h) {
  return (h * h / (a * a) + 1) / 4;
}

// 尖拱轮廓点列：从 (-a, springY) 经顶点到 (a, springY)
export function pointedArchPoints(a, springY, k = 1, seg = 20) {
  const R = 2 * a * k, c = R - a;
  const h = archApex(a, k);
  const a0 = Math.PI, a1 = Math.atan2(h, -c);
  const left = [];
  for (let i = 0; i <= seg; i++) {
    const t = a0 + (a1 - a0) * (i / seg);
    left.push(new THREE.Vector2(c + R * Math.cos(t), springY + R * Math.sin(t)));
  }
  const pts = left.slice();
  for (let i = seg - 1; i >= 0; i--) pts.push(new THREE.Vector2(-left[i].x, left[i].y));
  return pts;
}

// 在 Shape/Path 上画一个尖拱洞口（含起拱点以下的直边），底在 y0
function tracePointedOpening(path, cx, a, y0, springY, k, seg = 20) {
  path.moveTo(cx - a, y0);
  path.lineTo(cx - a, springY);
  const arch = pointedArchPoints(a, springY, k, seg);
  for (const p of arch) path.lineTo(cx + p.x, p.y);
  path.lineTo(cx + a, y0);
  path.closePath();
}

// 矩形墙体，开若干尖拱洞口（也可开圆洞）。墙以自身中面为原点，宽沿 x，高沿 y，厚沿 z。
// openings: { cx, a, y0, springY, k } 或 { circle: true, cx, cy, r }
export function wallWithOpenings(width, y0, y1, thickness, openings = [], seg = 20) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, y0);
  shape.lineTo(width / 2, y0);
  shape.lineTo(width / 2, y1);
  shape.lineTo(-width / 2, y1);
  shape.closePath();
  for (const o of openings) {
    const hole = new THREE.Path();
    if (o.circle) hole.absarc(o.cx, o.cy, o.r, 0, Math.PI * 2, true);
    else tracePointedOpening(hole, o.cx, o.a, o.y0, o.springY, o.k ?? 1, seg);
    shape.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -thickness / 2);
  return g;
}

// 洞口形状的平面玻璃几何（UV 归一化到洞口包围盒，便于贴彩色玻璃图案）
export function openingGlassGeometry(o, seg = 20) {
  const shape = new THREE.Shape();
  if (o.circle) shape.absarc(o.cx, o.cy, o.r, 0, Math.PI * 2, false);
  else tracePointedOpening(shape, o.cx, o.a, o.y0, o.springY, o.k ?? 1, seg);
  const g = new THREE.ShapeGeometry(shape, seg);
  g.computeBoundingBox();
  const bb = g.boundingBox, w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y;
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - bb.min.x) / w, (pos.getY(i) - bb.min.y) / h);
  }
  return g;
}

// 束柱（compound pier）：圆核 + 四根附壁小柱 + 柱础/柱头。哥特束柱把拱肋的力流"画"在柱身上。
export function makePier(height, w, mat, matCap) {
  const grp = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.5, height, 12), mat);
  core.position.y = height / 2;
  grp.add(core);
  const shaftG = new THREE.CylinderGeometry(w * 0.16, w * 0.16, height, 8);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const s = new THREE.Mesh(shaftG, mat);
    s.position.set(dx * w * 0.48, height / 2, dz * w * 0.48);
    grp.add(s);
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.75, w * 0.85, 0.9, 8), mat);
  base.position.y = 0.45;
  grp.add(base);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.62, w * 0.5, 0.7, 12), matCap ?? mat);
  cap.position.y = height - 0.35;
  grp.add(cap);
  return grp;
}

// 小尖塔（pinnacle）：给扶壁墩压重，把飞券斜推力"压"回竖直方向
export function makePinnacle(mat, scale = 1) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1 * scale, 2.2 * scale, 1 * scale), mat);
  body.position.y = 1.1 * scale;
  grp.add(body);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.75 * scale, 3.2 * scale, 4), mat);
  spire.position.y = (2.2 + 1.6) * scale;
  spire.rotation.y = Math.PI / 4;
  grp.add(spire);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14 * scale, 6, 6), mat);
  tip.position.y = (2.2 + 3.2) * scale;
  grp.add(tip);
  return grp;
}

// 山墙（三角形），用于西立面与耳堂端头
export function gableGeometry(halfW, y0, y1, thickness) {
  const s = new THREE.Shape();
  s.moveTo(-halfW, y0);
  s.lineTo(halfW, y0);
  s.lineTo(0, y1);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false });
  g.translate(0, 0, -thickness / 2);
  return g;
}

// 坡屋面（双坡三棱柱），沿 z 方向延伸 length
export function gableRoofGeometry(halfW, eaveY, ridgeY, length, drop = 0.7) {
  const s = new THREE.Shape();
  s.moveTo(-halfW, eaveY);
  s.lineTo(0, ridgeY);
  s.lineTo(halfW, eaveY);
  s.lineTo(halfW, eaveY - drop);
  s.lineTo(0, ridgeY - drop);
  s.lineTo(-halfW, eaveY - drop);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false });
  g.translate(0, 0, -length / 2);
  return g;
}

// 单坡屋面（侧廊用），截面梯形，沿 z 延伸
export function shedRoofGeometry(xLo, yLo, xHi, yHi, length, t = 0.6) {
  const s = new THREE.Shape();
  s.moveTo(xLo, yLo);
  s.lineTo(xHi, yHi);
  s.lineTo(xHi, yHi - t);
  s.lineTo(xLo, yLo - t);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false });
  g.translate(0, 0, -length / 2);
  return g;
}
