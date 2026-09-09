// 总装：把结构件按真实大教堂的逻辑组装成整体。
// 平面是拉丁十字：西端中厅（6 开间）→ 交叉部 + 南北耳堂 → 东端歌坛（3 开间）→ 半十边形后殿。
// 剖面是三段式骨架结构：拱廊 / 楼廊 / 高侧窗，石拱顶之上另有木屋架坡屋面。

import * as THREE from '../lib/three.module.js';
import { P } from './params.js';
import { makeMaterials, canvasTexture, mulberry32, FLOOR_TILES, FLOOR_TILE } from './materials.js';
import { makeGlassMaterials } from './glass.js';
import {
  wallWithOpenings, openingGlassGeometry, makePier, makePinnacle,
  gableGeometry, gableRoofGeometry, shedRoofGeometry, archApex,
} from './gothic.js';
import { quadripartiteVault } from './vault.js';
import { flyingButtress, flyerMesh } from './buttress.js';
import { roseAssembly, portal, westFront } from './facade.js';

export function buildCathedral() {
  const VAULT_APEX = P.vaultSpring + archApex(P.naveHW, P.vaultK); // 默认参数下 ≈28.4
  const AISLE_APEX = P.aisleVaultSpring + archApex(P.aisleW / 2, 1.0);
  const mats = makeMaterials();
  const glassMats = makeGlassMaterials(P.glazing);
  const root = new THREE.Group();
  const labels = [];
  const vaultMats = { web: new THREE.MeshStandardMaterial({ color: '#ded5c2', roughness: 0.95, side: THREE.DoubleSide }), rib: mats.stoneDark };

  // ---------- 共享几何：一次构建，逐开间复用 ----------
  const arcA = (P.bay - P.pierW) / 2;
  const arcadeWallG = wallWithOpenings(P.bay, 0, P.trifBot, P.arcadeT,
    [{ cx: 0, a: arcA, y0: 0, springY: P.arcSpring, k: P.arcK }]);
  const trifG = wallWithOpenings(P.bay, P.trifBot, P.trifTop, 0.5,
    Array.from({ length: 4 }, (_, i) => ({ cx: -2.625 + i * 1.75, a: 0.5, y0: P.trifBot + 0.3, springY: 15.9, k: 1.0 })));
  const clerOpening = { cx: 0, a: 2.2, y0: P.clerSill, springY: P.clerSpring, k: 1.15 };
  const clerWallG = wallWithOpenings(P.bay, P.trifTop, P.naveWallTop, P.arcadeT, [clerOpening]);
  const clerGlassG = openingGlassGeometry(clerOpening);
  const aisleOpening = { cx: 0, a: 1.6, y0: 2.5, springY: 8.5, k: 1.3 };
  const aisleWallG = wallWithOpenings(P.bay, 0, P.aisleWallTop, P.aisleWallT, [aisleOpening]);
  const aisleGlassG = openingGlassGeometry(aisleOpening);
  const respondG = new THREE.CylinderGeometry(0.32, 0.32, P.vaultSpring, 8); // 墙面束柱（拱肋落地的"力线"）
  const trifBackG = new THREE.BoxGeometry(P.bay, P.trifTop - P.trifBot, 0.2);

  const naveVault = quadripartiteVault(P.naveHW * 2, P.bay, P.vaultSpring, VAULT_APEX, vaultMats);
  const aisleVault = quadripartiteVault(P.aisleW, P.bay, P.aisleVaultSpring, AISLE_APEX, vaultMats, { ribR: 0.12 });

  // ---------- 中厅 + 歌坛：逐开间装配 ----------
  // 开间列表：[z 中心, 是否中厅]
  const bayCenters = [];
  for (let i = 0; i < P.naveBays; i++) bayCenters.push(P.naveZ0 + P.bay / 2 + i * P.bay);
  for (let i = 0; i < P.choirBays; i++) bayCenters.push(-P.naveHW - P.bay / 2 - i * P.bay);
  // 开间分界线（束柱、飞扶壁的位置）
  const bayLines = [];
  for (let i = 0; i <= P.naveBays; i++) bayLines.push(P.naveZ0 + i * P.bay);
  for (let i = 0; i <= P.choirBays; i++) bayLines.push(-P.naveHW - i * P.bay);

  const arcadeX = P.naveHW + P.arcadeT / 2;
  const aisleMid = (P.aisleIn + P.aisleOut) / 2;
  const outerWallX = P.aisleOut + P.aisleWallT / 2;

  let glassIdx = 0;
  for (const zc of bayCenters) {
    for (const s of [1, -1]) {
      // 拱廊层（大拱洞通向侧廊）
      const arc = new THREE.Mesh(arcadeWallG, mats.stone);
      arc.rotation.y = Math.PI / 2;
      arc.position.set(s * arcadeX, 0, zc);
      arc.castShadow = arc.receiveShadow = true;
      root.add(arc);
      // 楼廊（triforium）+ 暗背板
      const tri = new THREE.Mesh(trifG, mats.stoneLight);
      tri.rotation.y = Math.PI / 2;
      tri.position.set(s * (P.naveHW + 0.25), 0, zc);
      root.add(tri);
      const back = new THREE.Mesh(trifBackG, mats.dark);
      back.rotation.y = Math.PI / 2;
      back.position.set(s * (P.naveHW + 0.8), (P.trifBot + P.trifTop) / 2, zc);
      root.add(back);
      // 高侧窗层 + 彩色玻璃
      const cler = new THREE.Mesh(clerWallG, mats.stone);
      cler.rotation.y = Math.PI / 2;
      cler.position.set(s * arcadeX, 0, zc);
      cler.castShadow = cler.receiveShadow = true;
      root.add(cler);
      const cg = new THREE.Mesh(clerGlassG, glassMats.lancets[glassIdx++ % 4]);
      cg.rotation.y = Math.PI / 2;
      cg.position.set(s * arcadeX, 0, zc);
      root.add(cg);
      // 侧廊外墙 + 玻璃
      const aw = new THREE.Mesh(aisleWallG, mats.stone);
      aw.rotation.y = Math.PI / 2;
      aw.position.set(s * outerWallX, 0, zc);
      aw.castShadow = aw.receiveShadow = true;
      root.add(aw);
      const ag = new THREE.Mesh(aisleGlassG, glassMats.lancets[glassIdx++ % 4]);
      ag.rotation.y = Math.PI / 2;
      ag.position.set(s * outerWallX, 0, zc);
      root.add(ag);
      // 侧廊拱顶
      const av = aisleVault.clone();
      av.position.set(s * aisleMid, 0, zc);
      root.add(av);
    }
    // 中厅拱顶
    const nv = naveVault.clone();
    nv.position.set(0, 0, zc);
    root.add(nv);
  }

  // 束柱与墙面束柱（在开间分界线上）
  for (const zl of bayLines) {
    for (const s of [1, -1]) {
      const pier = makePier(P.arcSpring, P.pierW, mats.stoneDark, mats.stoneLight);
      pier.position.set(s * arcadeX, 0, zl);
      root.add(pier);
      const resp = new THREE.Mesh(respondG, mats.stoneDark);
      resp.position.set(s * (P.naveHW + 0.15), P.vaultSpring / 2, zl);
      root.add(resp);
      const pier2 = makePier(P.aisleVaultSpring, 0.8, mats.stoneDark, mats.stoneLight);
      pier2.position.set(s * outerWallX, 0, zl);
      pier2.scale.set(1, 1, 1);
      root.add(pier2);
    }
  }
  labels.push({ text: '拱廊（尖拱开间）', pos: [5.2, 12.5, 27.5], scope: 'in' });
  labels.push({ text: '楼廊（暗楼层）', pos: [5.4, 16.1, 20.5], scope: 'in' });
  labels.push({ text: '高侧窗（墙变成了窗）', pos: [5.6, 23, 31], scope: 'in' });
  labels.push({ text: '高侧窗（墙变成了窗）', pos: [8.2, 23, 34.5], scope: 'out' });
  labels.push({ text: '四分肋拱顶', pos: [0, VAULT_APEX + 0.8, 16.5], scope: 'in' });
  labels.push({ text: '中厅', pos: [0, 8.5, 33.5], scope: 'in' });
  labels.push({ text: '侧廊', pos: [10.2, 5, 23.5], scope: 'in' });

  // ---------- 飞扶壁（中厅与歌坛两侧，每条开间分界线一榀） ----------
  const flyerLines = bayLines.filter((z) => Math.abs(z - P.naveZ1) > 0.1); // 西端由双塔顶住
  for (const zl of flyerLines) {
    for (const s of [1, -1]) {
      const fb = flyingButtress(s, P.naveHW + P.arcadeT, 14.9, P, mats);
      fb.position.z = zl;
      root.add(fb);
    }
  }
  labels.push({ text: '飞扶壁（推力的接力）', pos: [11.3, 24.5, 27], scope: 'out' });
  labels.push({ text: '扶壁墩与小尖塔', pos: [15.4, 28.5, 13], scope: 'out' });

  // ---------- 屋面（木屋架在拱顶之上——石拱是天花，木架是雨伞） ----------
  // 中厅与歌坛屋面分开两段（建造动画按区域生长），但都要一直盖到交叉部上方：
  // 屋面是 0.7 m 厚的薄板，只有中厅、歌坛、耳堂三片屋面在交叉部真正交叠，
  // 十字屋面才是一顶完整的帐篷。原来中厅屋面从 z = naveZ0 才起，交叉部只有耳堂
  // 那片（低）盖着，四个角上就缺了一块——从外面看是个三角形的洞，一眼看进阁楼，
  // 斜雨也从那儿灌进去（tools/check-rain.mjs 报的就是这里）。
  for (const [z0, z1] of [[P.choirZ1, -P.naveHW - 0.5], [-P.naveHW - 0.5, P.naveZ1]]) {
    const roof = new THREE.Mesh(
      gableRoofGeometry(P.naveHW + 1.8, P.roofEave, P.roofRidge, z1 - z0), mats.roof);
    roof.position.z = (z0 + z1) / 2;
    roof.castShadow = roof.receiveShadow = true;
    root.add(roof);
  }
  for (const s of [1, -1]) {
    for (const [z0, z1] of [[P.naveZ0, P.naveZ1], [P.choirZ1, -P.naveHW]]) {
      const ar = new THREE.Mesh(
        shedRoofGeometry(P.outerX + 0.3, P.aisleWallTop + 0.3, P.aisleIn + 0.1, P.aisleRoofHi, z1 - z0), mats.roof);
      ar.position.z = (z0 + z1) / 2;
      if (s < 0) ar.rotation.y = Math.PI;
      ar.castShadow = ar.receiveShadow = true;
      root.add(ar);
    }
  }

  // ---------- 耳堂（南北翼） ----------
  buildTransept(root, mats, glassMats, labels);

  // ---------- 交叉部：四根大束柱 + 拱顶 + 尖塔（flèche） ----------
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    // 交叉部大墩与相邻拱廊墩在平面上交叠，等高会让柱身/附柱顶面成片共面 → 抬高 0.15 错开
    const big = makePier(P.vaultSpring + 0.15, 2.6, mats.stoneDark, mats.stoneLight, 1.15);
    big.position.set(sx * (P.naveHW + 0.8), 0, sz * (P.naveHW + 0.8));
    root.add(big);
  }
  const crossVault = quadripartiteVault(P.naveHW * 2, P.naveHW * 2, P.vaultSpring, VAULT_APEX + 1.2, vaultMats, { ribR: 0.2 });
  root.add(crossVault);
  labels.push({ text: '交叉部', pos: [0, 10, 0], scope: 'in' });

  const flecheBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 8, 3.2), mats.roof);
  flecheBase.position.y = P.roofRidge + 1.5;
  flecheBase.castShadow = true;
  root.add(flecheBase);
  const fleche = new THREE.Mesh(new THREE.ConeGeometry(2.3, P.flecheTop - P.roofRidge - 5.5, 8), mats.roof);
  fleche.position.y = (P.roofRidge + 5.5 + P.flecheTop) / 2;
  fleche.castShadow = true;
  root.add(fleche);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.6, 0.24), mats.gold);
  crossV.position.y = P.flecheTop + 1.1;
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.24, 0.24), mats.gold);
  crossH.position.y = P.flecheTop + 1.5;
  root.add(crossV, crossH);
  labels.push({ text: '交叉部尖塔（flèche）', pos: [0, P.flecheTop + 2, 0], scope: 'out' });

  // ---------- 后殿（东端半十边形 + 回廊环 + 放射飞券） ----------
  buildApse(root, mats, glassMats, labels, vaultMats);

  // ---------- 西立面 ----------
  root.add(westFront(P, mats, glassMats, labels));

  // ---------- 室内地面 ----------
  // 三块地坪严格不重叠（重叠会在同一高度 z-fighting，走动时地面就会闪）；
  // UV 一律按世界坐标生成，棋盘格处处等大、跨块连续。
  const floors = [];
  const addFloor = (geo, z, x = 0) => {
    const f = new THREE.Mesh(geo, mats.floor);
    f.rotation.x = -Math.PI / 2;
    f.position.set(x, 0.05, z);
    f.receiveShadow = true;
    f.userData.floorUV = true;
    floors.push(f);
    return f;
  };
  // 中厅 + 交叉部 + 歌坛（贯通的矩形长条）
  addFloor(new THREE.PlaneGeometry(P.aisleOut * 2, P.naveZ1 - P.choirZ1), (P.naveZ1 + P.choirZ1) / 2);
  // 耳堂两臂：只补长条以外的部分
  const armW = P.transeptEnd - P.aisleOut;
  for (const sx of [-1, 1]) {
    addFloor(new THREE.PlaneGeometry(armW, P.naveHW * 2 + 1.2), 0, sx * (P.aisleOut + armW / 2));
  }
  // 后殿半圆：向东（z < choirZ1）展开，与长条端头相接
  addFloor(new THREE.CircleGeometry(P.aisleOut, 24, 0, Math.PI), P.choirZ1);
  for (const f of floors) {
    f.userData.buildFirst = true;   // 建造动画：地坪与地基最先出现
    root.add(f);
  }

  // 祭坛（东端焦点：整个空间的方向感所在）
  const altar = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 2), mats.stoneLight);
  altar.position.set(0, 0.7, P.choirZ1 + 3);
  root.add(altar);
  const altarCross = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 0.18), mats.gold);
  altarCross.position.set(0, 2.5, P.choirZ1 + 3);
  const altarCrossH = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.18), mats.gold);
  altarCrossH.position.set(0, 2.9, P.choirZ1 + 3);
  root.add(altarCross, altarCrossH);
  labels.push({ text: '祭坛（东向——朝向日出）', pos: [0, 4.5, P.choirZ1 + 3], scope: 'in' });

  // 中厅会众长椅：中线留出走道，全部面向祭坛。建造动画里作为"家具"最后进场。
  const pewMat = new THREE.MeshStandardMaterial({ color: '#5d4429', roughness: 0.85 });
  const seatG = new THREE.BoxGeometry(3.8, 0.5, 0.45);
  const backG = new THREE.BoxGeometry(3.8, 0.55, 0.09);
  for (const zc of bayCenters) {
    if (zc < P.naveZ0 + P.bay / 2) continue;      // 只放中厅，歌坛留给唱诗班
    for (const dz of [-2.1, 0, 2.1]) {
      // 西门里侧留 2.8 m 空场：门扇开到 80° 会扫进来（真教堂这一跨也是空的，
      // 进门先是一片过渡空间，长椅从第二跨才开始）
      if (zc + dz > P.naveZ1 - 2.8) continue;
      for (const sx of [1, -1]) {
        const seat = new THREE.Mesh(seatG, pewMat);
        seat.position.set(sx * 2.75, 0.3, zc + dz);
        seat.userData.buildY = 50;
        const back = new THREE.Mesh(backG, pewMat);
        back.position.set(sx * 2.75, 0.82, zc + dz + 0.24);
        back.userData.buildY = 50;
        root.add(seat, back);
      }
    }
  }

  // ---------- 管风琴（西端楼廊，玫瑰窗之下、大门之上——历史定位） ----------
  buildOrgan(root, mats, labels);

  // ---------- 阳光透窗的光斑与光柱（南侧受光） ----------
  addLightPools(root, bayCenters);

  root.updateMatrixWorld(true);

  // 去重：完全重合的网格。相邻开间共用的那道横向券会被两跨各画一遍，
  // 同几何 + 同材质 + 同位置，深度值一模一样，必然打架（抬头看拱顶会闪）。
  // 删掉重复的一份，观感不变，还少一批三角形。
  const seen = new Set(), dup = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mid = Array.isArray(o.material) ? o.material.map((m) => m.uuid).join() : o.material.uuid;
    const key = `${o.geometry.uuid}|${mid}|${o.matrixWorld.elements.map((v) => Math.round(v * 1000)).join()}`;
    if (seen.has(key)) dup.push(o); else seen.add(key);
  });
  for (const o of dup) o.parent.remove(o);

  // 所有铺地（含三座门的门槛）统一按世界坐标铺 UV——此时层级变换已确定
  root.traverse((o) => { if (o.userData.floorUV) worldFloorUV(o); });

  return { root, labels, VAULT_APEX };
}

// 耳堂：侧墙两层窗 + 端头玫瑰窗立面 + 双坡屋面 + 两跨拱顶
function buildTransept(root, mats, glassMats, labels) {
  const armZ = P.naveHW + P.arcadeT / 2 + 0.05;   // 侧墙中心 z = ±6.65（错开 0.05：否则内皮与中厅拱廊墙端面共面）
  const wallLen = P.transeptEnd - P.naveHW + 1.4; // 6.6 → 24.7
  const cx0 = (P.naveHW + 0.6 + P.transeptEnd + 0.7) / 2;

  // 侧墙（含通往侧廊的拱洞 + 下层窗 + 高侧窗）
  const mkOpenings = (mirror) => {
    const m = mirror ? -1 : 1;
    return [
      { cx: m * ((P.aisleIn + P.aisleOut) / 2 - cx0), a: 2.4, y0: 0, springY: 7, k: 1.3 },
      { cx: m * (17.2 - cx0), a: 1.4, y0: 2.5, springY: 9, k: 1.3 },
      { cx: m * (21.4 - cx0), a: 1.4, y0: 2.5, springY: 9, k: 1.3 },
      { cx: m * (15.6 - cx0), a: 1.7, y0: P.clerSill, springY: P.clerSpring, k: 1.2 },
      { cx: m * (20.6 - cx0), a: 1.7, y0: P.clerSill, springY: P.clerSpring, k: 1.2 },
    ];
  };
  let gi = 0;
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const ops = mkOpenings(sx < 0);
      const wallG = wallWithOpenings(wallLen, 0, P.naveWallTop + 0.06, P.arcadeT, ops);   // 墙顶抬 0.06：避开与拱廊墙顶共面
      const w = new THREE.Mesh(wallG, mats.stone);
      w.position.set(sx * cx0, 0, sz * armZ);
      w.castShadow = w.receiveShadow = true;
      root.add(w);
      for (const o of ops.slice(1)) {
        const g = new THREE.Mesh(openingGlassGeometry(o), glassMats.lancets[gi++ % 4]);
        g.position.set(sx * cx0, 0, sz * armZ);
        root.add(g);
      }
    }
    // 端头立面（面朝 ±x）
    const endWallG = wallWithOpenings(P.naveHW * 2 + P.arcadeT * 2, 0, P.naveWallTop + 2, 1.4, [
      { circle: true, cx: 0, cy: 21.5, r: 3.6 },
      { cx: 0, a: 2.4, y0: 0, springY: 6.5, k: 1.3 },
    ]);
    const ew = new THREE.Mesh(endWallG, mats.stone);
    ew.rotation.y = Math.PI / 2;
    ew.position.set(sx * (P.transeptEnd + 0.7), 0, 0);
    ew.castShadow = ew.receiveShadow = true;
    root.add(ew);
    const rose = roseAssembly(3.3, mats, glassMats.rose);
    rose.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    rose.position.set(sx * (P.transeptEnd + 1.5), 21.5, 0);
    root.add(rose);
    const pt = portal(2.2, 6.5, mats, 2, 1.3, -1.47, 5.2,
      { cx: 0, a: 2.4, y0: 0, springY: 6.5, k: 1.3 },    // 门槛不压到耳堂臂铺地
      // 南耳堂门是真教堂的日常入口（南面朝阳背风），所以这扇也开便门
      { id: sx > 0 ? 'transept-south' : 'transept-north', doorA: 1.65, doorH: 3.9, wicket: sx > 0 });
    pt.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    pt.position.set(sx * (P.transeptEnd + 1.4), 0, 0);
    root.add(pt);
    const gable = new THREE.Mesh(gableGeometry(P.naveHW + 1.8, P.naveWallTop + 2, P.roofRidge + 1, 1.2), mats.stone);
    gable.rotation.y = Math.PI / 2;
    gable.position.set(sx * (P.transeptEnd + 0.7), 0, 0);
    gable.castShadow = true;
    root.add(gable);
    // 端头角墩
    for (const sz of [1, -1]) {
      const cb = new THREE.Mesh(new THREE.BoxGeometry(1.8, 24, 1.8), mats.stone);
      cb.position.set(sx * (P.transeptEnd + 0.4), 12, sz * (armZ + 0.9));
      cb.castShadow = true;
      root.add(cb);
      const pin = makePinnacle(mats.stoneLight, 0.9);
      pin.position.set(sx * (P.transeptEnd + 0.4), 24, sz * (armZ + 0.9));
      root.add(pin);
    }
    // 耳堂拱顶（两跨）
    const vaultMats2 = { web: new THREE.MeshStandardMaterial({ color: '#ded5c2', roughness: 0.95, side: THREE.DoubleSide }), rib: mats.stoneDark };
    for (const xc of [P.naveHW + 4.5, P.naveHW + 13.5]) {
      const v = quadripartiteVault(P.naveHW * 2, 9, P.vaultSpring, P.vaultSpring + archApex(P.naveHW, P.vaultK), vaultMats2);
      v.rotation.y = Math.PI / 2;
      v.position.set(sx * xc, 0, 0);
      root.add(v);
    }
  }
  // 耳堂屋面（沿 x 向双坡，与中厅屋面等高十字相交）
  const troof = new THREE.Mesh(gableRoofGeometry(P.naveHW + 1.8, P.roofEave, P.roofRidge, (P.transeptEnd + 1.5) * 2), mats.roof)   // 屋面比端墙外皮出挑 0.1，避免端面共面;
  troof.rotation.y = Math.PI / 2;
  troof.castShadow = troof.receiveShadow = true;
  root.add(troof);
  labels.push({ text: '耳堂（十字的横臂）', pos: [19, 13, 9.5], scope: 'out' });
  labels.push({ text: '耳堂玫瑰窗', pos: [P.transeptEnd + 3, 26.5, 0], scope: 'out' });
}

// 后殿：上层半十边形高窗环 + 下层回廊环 + 放射状扶壁与飞券 + 半锥屋面
function buildApse(root, mats, glassMats, labels, vaultMats) {
  const zc = P.choirZ1;                 // 后殿圆心
  const rU = P.naveHW + 0.6;            // 上层半径（延续中厅墙线）
  const rL = P.aisleOut + P.aisleWallT / 2; // 下层回廊半径（延续侧廊外墙线）
  const facetAngles = [-72, -36, 0, 36, 72].map((d) => (d * Math.PI) / 180);
  // ±90° 处已经站着歌坛最后一榀扶壁（z = choirZ1），再放一榀就是两根墩子重叠打架
  const jointAngles = [-54, -18, 18, 54].map((d) => (d * Math.PI) / 180);

  const upperOp = { cx: 0, a: 1.5, y0: 16, springY: 24, k: 1.2 };
  // 相邻面的墙在转角处交叠，等高会让上下两个端面共面 → 隔一面差 3 cm（在檐口以下，看不出来）
  const upperWallG = [0, 1].map((k) => wallWithOpenings(
    2 * rU * Math.sin(Math.PI / 10) + 0.4, 12 + k * 0.03, P.naveWallTop + k * 0.03, 1.0, [upperOp]));
  const upperGlassG = openingGlassGeometry(upperOp);
  const lowerOp = { cx: 0, a: 1.3, y0: 2.2, springY: 8, k: 1.3 };
  const lowerWallG = wallWithOpenings(2 * rL * Math.sin(Math.PI / 10) + 0.4, 0, P.aisleWallTop - 0.5, 1.0, [lowerOp]);
  const lowerGlassG = openingGlassGeometry(lowerOp);

  let gi = 1, fi = 0;
  for (const phi of facetAngles) {
    const rotY = Math.PI - phi;
    const u = new THREE.Mesh(upperWallG[fi++ % 2], mats.stone);
    u.rotation.y = rotY;
    u.position.set(rU * Math.sin(phi), 0, zc - rU * Math.cos(phi));
    u.castShadow = u.receiveShadow = true;
    root.add(u);
    const ug = new THREE.Mesh(upperGlassG, glassMats.lancets[gi % 4]);
    ug.rotation.y = rotY;
    ug.position.copy(u.position);
    root.add(ug);
    const l = new THREE.Mesh(lowerWallG, mats.stone);
    l.rotation.y = rotY;
    l.position.set(rL * Math.sin(phi), 0, zc - rL * Math.cos(phi));
    l.castShadow = l.receiveShadow = true;
    root.add(l);
    const lg = new THREE.Mesh(lowerGlassG, glassMats.lancets[++gi % 4]);
    lg.rotation.y = rotY;
    lg.position.copy(l.position);
    root.add(lg);
  }

  // 放射状扶壁墩 + 飞券（从回廊之外顶住上层高墙——与中厅飞扶壁同一逻辑，绕圆周展开）
  for (const phi of jointAngles) {
    const dir = new THREE.Vector3(Math.sin(phi), 0, -Math.cos(phi));
    const pr = rL + 0.8;
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.4, 17, 1.4), mats.stone);
    pier.position.set(dir.x * pr, 8.5, zc + dir.z * pr);
    pier.rotation.y = -phi;
    pier.castShadow = true;
    root.add(pier);
    const pin = makePinnacle(mats.stoneLight, 0.8);
    pin.position.set(dir.x * pr, 17, zc + dir.z * pr);
    root.add(pin);
    const fl = flyerMesh(rU + 0.34, 24.5, pr - 0.3, 15.2, 0.6, mats.stone);   // 券脚插进上层墙 6 cm，避免端面共面
    fl.rotation.y = Math.PI / 2 - phi;
    fl.position.set(0, 0, zc);
    root.add(fl);
  }

  // 屋面：上层半锥 + 回廊环坡（半锥朝东，θ 从 π/2 起转 π，只盖 z<0 一侧）
  // 半锥的切面要往歌坛屋面里搭 0.6 m：原来切面在 zc-0.4、歌坛屋面端面在 zc，
  // 中间空着 0.4 m 的缝，从上面看就是一道贯通的裂口，雨直接灌进后殿。
  // 半径要盖得住多边形墙的**角**：墙是 5 面折线（外皮半径 rU+0.5，转角处还要更远
  // sqrt(外皮² + 半面宽²)），锥面又是 12 边形（平面处比外接圆矮 cos(π/12)）。
  // 原来 rU+1.6 只比墙外皮大一点，墙角就从锥面里戳出来——远看是屋面上一片小尖角。
  const cone = new THREE.Mesh(new THREE.ConeGeometry(rU + 2.4, 7, 12, 1, false, Math.PI / 2, Math.PI), mats.roof);
  cone.position.set(0, P.naveWallTop + 3.2, zc + 0.6);
  cone.castShadow = true;
  root.add(cone);
  const ring = new THREE.Mesh(new THREE.ConeGeometry(rL + 2.1, 5.5, 14, 1, false, Math.PI / 2, Math.PI), mats.roof);   // 同上，回廊环坡也要盖住下层墙的转角
  ring.position.set(0, P.aisleWallTop + 2.2, zc + 0.6);
  ring.castShadow = true;
  root.add(ring);

  // 歌坛侧廊单坡屋面到回廊环坡之间是一道错台：单坡的檐口比环坡高出半米到两米，
  // 从外面斜着看能看进两片屋面之间的空当（雨进不去——单坡屋面在 z = choirZ1 有端面
  // 封着，落进空当的水淌到环坡上就流走了——但看着像个破口）。现实中这种交接是铺
  // 铅皮泛水盖住的，这里补一片封头板当泛水。
  const ringApexY = P.aisleWallTop + 2.2 + 2.75, ringSlope = 5.5 / (rL + 2.1);
  const shedY = (x) => P.aisleWallTop + 0.3 + (P.outerX + 0.3 - x) / (P.outerX + 0.3 - (P.aisleIn + 0.1))
    * (P.aisleRoofHi - P.aisleWallTop - 0.3);           // 单坡屋面的上表面
  for (const sx of [1, -1]) {
    const x0 = P.aisleIn + 0.1, x1 = P.outerX + 0.7;
    const sh = new THREE.Shape();
    sh.moveTo(sx * x0, shedY(x0));
    sh.lineTo(sx * x1, shedY(x1));
    sh.lineTo(sx * x1, ringApexY - ringSlope * x1 - 0.3);   // 下缘埋进环坡里 0.3
    sh.lineTo(sx * x0, ringApexY - ringSlope * x0 - 0.3);
    sh.closePath();
    const flash = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false }), mats.roof);
    flash.position.z = zc - 0.25;                        // 贴在单坡屋面端面外侧，别与端面共面
    flash.castShadow = flash.receiveShadow = true;
    root.add(flash);
  }

  // 后殿拱顶近似：半锥形天花
  const apseVault = new THREE.Mesh(
    new THREE.ConeGeometry(P.naveHW * 2 * 0.5, 6, 10, 1, true, Math.PI / 2, Math.PI),
    vaultMats.web);
  apseVault.position.set(0, P.vaultSpring + 4.5, zc);
  root.add(apseVault);

  labels.push({ text: '后殿（半环高窗）', pos: [0, 27, zc - 10], scope: 'out' });
  labels.push({ text: '放射状飞券', pos: [11.5, 19, zc - 8], scope: 'out' });
}

// 管风琴：西端楼廊上的琴——木质琴箱 + 三塔式锡管阵列，正对祭坛。
// 巴赫在莱比锡圣托马斯教堂的位置就是这样一个西楼廊。按 O 键它会真的出声。
function buildOrgan(root, mats, labels) {
  const zWall = P.naveZ1;                 // 西墙内面
  const wood = new THREE.MeshStandardMaterial({ color: '#4a3320', roughness: 0.7 });
  const tin = new THREE.MeshStandardMaterial({ color: '#d8d2c2', roughness: 0.35, metalness: 0.75 });
  const grp = new THREE.Group();

  // 楼廊平台与栏板
  const loft = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.5, 2.6), mats.stoneLight);
  loft.position.set(0, 8.6, zWall - 1.5);
  grp.add(loft);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(10.5, 1.1, 0.25), mats.stoneLight);
  rail.position.set(0, 9.4, zWall - 2.7);
  grp.add(rail);

  // 琴箱
  const caseBox = new THREE.Mesh(new THREE.BoxGeometry(9, 3.4, 1.4), wood);
  caseBox.position.set(0, 10.6, zWall - 0.9);
  grp.add(caseBox);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.45, 1.7), wood);
  crown.position.set(0, 12.4, zWall - 0.9);
  grp.add(crown);

  // 管列：三塔式（中塔最高），塔间为平列小管
  const pipeAt = (x, h, r = 0.17) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), tin);
    p.position.set(x, 12.6 + h / 2, zWall - 0.9);
    grp.add(p);
  };
  for (const [cx, h0] of [[-3.4, 4.6], [0, 6.2], [3.4, 4.6]]) {  // 三塔
    for (let i = -2; i <= 2; i++) pipeAt(cx + i * 0.42, h0 - Math.abs(i) * 0.55, 0.19);
  }
  for (const cx of [-1.7, 1.7]) {                                 // 平列
    for (let i = -1; i <= 1; i++) pipeAt(cx + i * 0.4, 2.6, 0.14);
  }

  grp.traverse((o) => { if (o.isMesh) o.userData.buildY = 50; }); // 家具：最后进场
  root.add(grp);
  labels.push({ text: '管风琴（西端楼廊）', pos: [0, 15.5, P.naveZ1 - 4], scope: 'in' });
}

// 地坪 UV：直接由世界 XZ 生成，一张贴图铺 FLOOR_TILES 格 × FLOOR_TILE 米。
// 这样无论地坪多大多长，格子都是正方形且相邻地坪对得上（原来按几何体归一化 UV，
// 中厅 0.33×0.67 m、耳堂 0.60×0.12 m，格子被拉成条纹，也就是"地面不对"）。
function worldFloorUV(mesh) {
  const geo = mesh.geometry;
  const uv = geo.attributes.uv;
  if (!uv) return;
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const s = 1 / (FLOOR_TILES * FLOOR_TILE);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    uv.setXY(i, v.x * s, v.z * s);
  }
  uv.needsUpdate = true;
}

// 阳光透窗的光斑（地面彩色光池）与斜射光柱——彩色玻璃存在的全部意义
function addLightPools(root, bayCenters) {
  const poolTex = canvasTexture(256, 256, (ctx, w, h) => {
    const rnd = mulberry32(42);
    const grad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(120,150,255,0.9)');
    grad.addColorStop(0.5, 'rgba(180,60,80,0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = ['rgba(255,80,80,0.25)', 'rgba(80,120,255,0.25)', 'rgba(255,210,90,0.3)'][i % 3];
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, 8 + rnd() * 18, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, color: poolTex ? '#ffffff' : '#5566aa',
    transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const shaftMat = new THREE.MeshBasicMaterial({
    color: '#fff4d6', transparent: true, opacity: 0.055,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const poolG = new THREE.PlaneGeometry(6, 4.5);
  // 光柱按「窗口端 → 地面端」两点摆：上头搭在南侧高侧窗上，下头落在地面光斑上，
  // 整片留在中厅之内。原来是 4.4×24 的大矩形斜插着放（rotation.z = +0.42），
  // 方向还是反的——上端在北 x=-1.5、下端在南 x=8.3——四角伸到 x = -3.5…10.3，
  // 斜穿拱廊墙戳进侧廊，在侧廊里看就是一片浮在空中的亮矩形（tools/check-flicker.mjs
  // 的射线报告里能看到它挡在侧廊前面）。
  const beamTop = [P.naveHW - 0.1, P.clerSill + 1];   // 窗口端：贴着中厅内墙、窗台稍上
  const beamBot = [2.6, 0.2];                         // 地面端：落在光斑中心上
  const beamDx = beamTop[0] - beamBot[0], beamDy = beamTop[1] - beamBot[1];
  const beamLen = Math.hypot(beamDx, beamDy);
  // 宽度上限由「四角不许穿出拱廊墙外皮」定：w/2·cosθ + len/2·sinθ ≤ arcadeT + naveHW - 中心x
  const shaftG = new THREE.PlaneGeometry(2.4, beamLen);
  for (const zc of bayCenters) {
    const pool = new THREE.Mesh(poolG, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(2.6, 0.12, zc);
    pool.userData.buildY = 27;      // 建造动画：光随高侧窗玻璃一起出现
    root.add(pool);
    const shaft = new THREE.Mesh(shaftG, shaftMat);
    shaft.position.set((beamTop[0] + beamBot[0]) / 2, (beamTop[1] + beamBot[1]) / 2, zc);
    shaft.rotation.z = Math.atan2(-beamDx, beamDy);   // 局部 +y 指向窗口端
    shaft.userData.buildY = 27;
    root.add(shaft);
  }
  // 玫瑰窗晚祷光柱（自西向东）
  const roseShaft = new THREE.Mesh(new THREE.PlaneGeometry(9, 30), shaftMat);
  roseShaft.position.set(0, 14, 36);
  roseShaft.rotation.set(0.6, Math.PI / 2, 0);
  roseShaft.userData.buildY = 27;
  root.add(roseShaft);
}
