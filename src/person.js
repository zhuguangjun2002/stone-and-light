import * as THREE from '../lib/three.module.js';

// 第三人称替身构造器（从 src/main.js 抽出来，供 src/main.js 与 tools/monk.html 共用）。
export function buildPerson() {
  const robeCol = 0x6f5b45, robeDark = 0x5d4c39, beltCol = 0xc9b294,
        skin = 0xc8957a, beardCol = 0x54453a, hairCol = 0x5e4a38, pouchCol = 0x8a653f;
  const M = (c, rough = 0.9) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: rough });

  const g = new THREE.Group();

  // 1) 长袍：圆柱旋转放样，衣摆略外张，腰收窄、胸口微张，收到颈部
  const robePts = [[0.001, 0], [0.30, 0], [0.285, 0.06], [0.26, 0.18],
                   [0.21, 0.55], [0.175, 0.78], [0.20, 1.02],
                   [0.185, 1.18], [0.12, 1.30], [0.085, 1.36]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const robe = new THREE.Mesh(new THREE.LatheGeometry(robePts, 18), M(robeCol));
  // 垂直衣褶：径向按 cos(6θ) 轻微扰动，越往肩上扰动越小（与 figure.js 石像同一招）
  {
    const attr = robe.geometry.attributes.position;
    for (let i = 0; i < attr.count; i++) {
      const x = attr.getX(i), y = attr.getY(i), z = attr.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      const wobble = Math.cos(Math.atan2(z, x) * 6) * 0.016 * Math.max(0, 1 - y / 1.2);
      const s = (r + wobble) / r;
      attr.setX(i, x * s);
      attr.setZ(i, z * s);
    }
    attr.needsUpdate = true;
    robe.geometry.computeVertexNormals();
  }
  robe.position.y = 0;
  g.add(robe);

  // 2) 肩部披罩（大披肩，更深的色）
  const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.29, 0.26, 14, 1, true), M(robeDark));
  cape.position.y = 1.16;
  g.add(cape);

  // 3) 腰间绳带 + 垂挂 + 念珠
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.016, 8, 20), M(beltCol));
  belt.rotation.x = Math.PI / 2;
  belt.position.set(0, 0.74, 0);
  g.add(belt);
  for (const dx of [0.055, 0.10]) {          // 腰间两条绳带沿身体垂下
    const strip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.45, 6), M(beltCol));
    strip.position.set(-0.04 + dx, 0.53, -0.195);
    strip.rotation.x = 0.1064;
    g.add(strip);
  }
  const pts = [[0.001,0],[0.30,0],[0.285,0.06],[0.26,0.18],[0.21,0.55],[0.175,0.78],[0.20,1.02],[0.185,1.18],[0.12,1.30],[0.085,1.36]];
  const robeR = (y) => {
    for (let i = 1; i < pts.length; i++) if (y <= pts[i][1]) {
      const [r0, y0] = pts[i - 1], [r1, y1] = pts[i];
      const u = (y - y0) / ((y1 - y0) || 1);
      return r0 + u * (r1 - r0);
    }
    return 0.165;
  };
  for (let i = 0; i < 6; i++) {                  // 念珠珠串沿身
    const y = 0.55 - i * 0.05;
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), M(0x4a3b2e, 0.8));
    bead.position.set(0.02 + i * 0.016, y, -(robeR(y) + 0.012));
    g.add(bead);
  }

  // 4) 皮挂包（腰侧）
  const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), M(pouchCol, 0.85));
  pouch.scale.set(1, 1.25, 0.55);
  pouch.position.set(0.185, 0.66, 0.06);
  g.add(pouch);

  // 5) 头：肉色球 + 环头发 + 兜帽盖住头顶
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 18, 14), M(skin, 0.7));
  head.position.y = 1.5;
  g.add(head);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.024, 8, 14, Math.PI), M(hairCol, 0.85));
  halo.position.set(0, 1.5, 0);
  halo.rotation.z = Math.PI / 2;
  halo.rotation.y = Math.PI / 2;
  g.add(halo);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M(robeDark));
  hood.position.set(0, 1.52, 0.01);
  g.add(hood);

  // 6) 粗短胡须 + 鼻头
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), M(beardCol, 0.95));
  beard.scale.set(1, 1.35, 0.75);
  beard.position.set(0, 1.425, -0.095);
  g.add(beard);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 8), M(skin, 0.7));
  nose.rotation.x = -Math.PI * 0.5;
  nose.position.set(0, 1.485, -0.125);
  g.add(nose);

  // 7) 双手从长袍袖口伸出
  for (const s of [-1, 1]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), M(skin, 0.7));
    hand.position.set(s * 0.12, 0.80, -0.155);
    g.add(hand);
  }

  // 8) 脚：两条短深色椭圆
  for (const s of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M(0x3a332a, 0.95));
    foot.scale.set(0.8, 0.4, 1.6);
    foot.position.set(s * 0.09, 0.05, -0.04);
    g.add(foot);
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.visible = false;
  return g;
}
