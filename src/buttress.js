// 飞扶壁体系 = 扶壁墩（pier buttress）+ 飞券（flyer）+ 小尖塔（pinnacle）。
// 拱顶在起拱处产生持续的水平外推力；飞券像一根斜撑，把这股推力从高侧墙
// 接力到侧廊之外的扶壁墩上；小尖塔用自重把斜向合力压回墩身截面之内。
// 有了这套体系，中厅高墙不再承担推力，才能开出整层的高侧窗。

import * as THREE from '../lib/three.module.js';
import { makePinnacle } from './gothic.js';

// 飞券石带本体：局部坐标里从墙头 (wx, yH) 落到墩顶 (px, yT)，可整体旋转复用（后殿放射飞券）
export function flyerMesh(wx, yH, px, yT, depth, mat) {
  const A = px - wx, B = yH - yT;
  const shape = new THREE.Shape();
  const under = [];
  for (let i = 0; i <= 20; i++) {
    const phi = (i / 20) * Math.PI / 2;   // 0 → 墙头，π/2 → 墩
    under.push([wx + A * Math.sin(phi), yT + B * Math.cos(phi)]);
  }
  shape.moveTo(under[0][0], under[0][1]);
  for (const [x, y] of under) shape.lineTo(x, y);
  shape.lineTo(px, yT + 1.1);
  shape.lineTo(wx, yH + 0.8);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 });
  g.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = true;
  return mesh;
}

// 单侧一榀飞扶壁（位于某条开间分界线上）。sideSign: +1 南 / -1 北。
// wallX: 中厅墙外皮 |x|；pierX: 扶壁墩中心 |x|。
export function flyingButtress(sideSign, wallX, pierX, P, mats) {
  const grp = new THREE.Group();
  const s = sideSign;

  // 扶壁墩：分级收分（越往上越薄，中世纪砌法如此）
  const stages = [
    { w: 2.0, d: 1.6, y0: 0, y1: 12 },
    { w: 1.6, d: 1.4, y0: 12, y1: 17.5 },
    { w: 1.2, d: 1.2, y0: 17.5, y1: P.butPierTop },
  ];
  for (const st of stages) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(st.w, st.y1 - st.y0, st.d), mats.stone);
    m.position.set(s * pierX, (st.y0 + st.y1) / 2, 0);
    m.castShadow = m.receiveShadow = true;
    grp.add(m);
  }

  // 小尖塔压顶
  const pin = makePinnacle(mats.stoneLight, 0.9);
  pin.position.set(s * pierX, P.butPierTop, 0);
  grp.add(pin);

  // 飞券：下缘为四分之一椭圆（从墙头切向下落到墩上），上缘直坡，截面成一条石带
  const wx = wallX - 0.06, px = pierX - 0.4;   // 券脚往墙里插 6 cm：端面与墙面齐平会共面打架
  const yH = P.flyerHeadY, yT = P.flyerTailY;
  const flyer = flyerMesh(wx, yH, px, yT, 0.7, mats.stone);
  if (s < 0) flyer.scale.x = -1;
  grp.add(flyer);
  const A = px - wx, B = yH - yT;

  // 飞券背上的小连拱装饰（排水沟兼装饰，简化为几根小柱）
  for (let i = 1; i <= 3; i++) {
    const phi = (i / 4) * Math.PI / 2;
    const x = wx + A * Math.sin(phi), y = yT + B * Math.cos(phi);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.5, 0.5), mats.stoneLight);
    const topY = yH + 0.8 + (yT + 1.1 - (yH + 0.8)) * Math.sin(phi);
    post.position.set(s * x, (y + topY) / 2 + 0.3, 0);
    grp.add(post);
  }
  return grp;
}
