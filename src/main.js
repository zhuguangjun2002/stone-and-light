// 入口：渲染、光照与日夜、相机（环视 / 第一人称行走）、剖面、结构标注、
// 建造过程动画、参数化设计面板。所有初始化逻辑集中在文件底部的 init() 之后执行。

import * as THREE from '../lib/three.module.js';
import { OrbitControls } from '../lib/OrbitControls.js';
import { buildCathedral } from './cathedral.js';
import { canvasTexture } from './materials.js';
import { P, recomputeDerived } from './params.js';
import { archApex } from './gothic.js';
import { TOUR } from './tour.js';
import { createWorksite } from './worksite.js';
import { createAudio } from './audio.js';
import { PRESETS, applyPreset } from './presets.js';

// ---------- 渲染器与场景 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#d8d4c6', 0.0016);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxDistance = 400;

// ---------- 光照与日夜 ----------
const hemi = new THREE.HemisphereLight('#cfe0f5', '#6d6a5b', 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1da', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -70;
sun.shadow.camera.near = 20; sun.shadow.camera.far = 350;
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);
for (const [x, y, z] of [[0, 13, 22], [0, 13, -14], [0, 10, 42]]) {
  const p = new THREE.PointLight('#ffd9a0', 220, 70, 2);
  p.position.set(x, y, z);
  scene.add(p);
}

const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color();
let currentSunT = 0.42;
// t ∈ [0,1] → 7:00 – 19:00。太阳自东（-z）经南（+x）向西（+z）。
function setSunTime(t) {
  currentSunT = t;
  const slider = document.getElementById('sunT');
  if (slider && Number(slider.value) !== t) slider.value = t;
  const s = Math.sin(Math.PI * t);                       // 高度因子：正午 1，晨昏 0
  const az = Math.PI * t;
  const elev = THREE.MathUtils.degToRad(7 + 56 * s);
  const R = 170;
  sun.position.set(
    R * Math.cos(elev) * Math.sin(az),
    R * Math.sin(elev),
    -R * Math.cos(elev) * Math.cos(az));
  sun.color.lerpColors(_c1.set('#ff9a4f'), _c2.set('#fff3dc'), s);
  sun.intensity = 1.0 + 1.5 * s;
  hemi.intensity = 0.3 + 0.6 * s;
  const top = _c1.set('#3a4a78').lerp(_c2.set('#4f7fc0'), s).getStyle();
  const mid = _c2.set('#c98d6b').lerp(_c3.set('#a8c0dc'), s).getStyle();
  const bot = _c3.set('#f0bd90').lerp(new THREE.Color('#e9e3d3'), s).getStyle();
  const old = scene.background;
  scene.background = canvasTexture(16, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(0.55, mid);
    g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  old?.dispose?.();
  scene.fog.color.set(bot);
  const hh = Math.floor(7 + t * 12), mm = Math.round(((7 + t * 12) % 1) * 60);
  const lab = document.getElementById('sunLabel');
  if (lab) lab.textContent = `${hh}:${String(mm).padStart(2, '0')}`;
}

// ---------- 地面与前庭广场（不随重建变化） ----------
const ground = new THREE.Mesh(new THREE.CircleGeometry(600, 48),
  new THREE.MeshStandardMaterial({ color: '#89906f', roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const plaza = new THREE.Mesh(new THREE.PlaneGeometry(110, 190),
  new THREE.MeshStandardMaterial({ color: '#9b968b', roughness: 1 }));
plaza.rotation.x = -Math.PI / 2;
plaza.position.set(0, 0.02, 20);
plaza.receiveShadow = true;
scene.add(plaza);

// ---------- 结构标注 ----------
function makeLabelSprite(text) {
  const fs = 40, padX = 26, padY = 15, tail = 18;
  const font = `500 ${fs}px "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif`;
  const c = document.createElement('canvas');
  const meas = c.getContext('2d');
  meas.font = font;
  const tw = meas.measureText(text).width;
  c.width = Math.ceil(tw + padX * 2);
  c.height = fs + padY * 2 + tail;
  const ctx = c.getContext('2d');
  ctx.font = font;
  const bh = c.height - tail;
  ctx.fillStyle = 'rgba(16,13,9,0.8)';
  ctx.beginPath();
  ctx.roundRect(1.5, 1.5, c.width - 3, bh - 3, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,210,0.45)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(16,13,9,0.8)';
  ctx.beginPath();
  ctx.moveTo(c.width / 2 - 13, bh - 3);
  ctx.lineTo(c.width / 2 + 13, bh - 3);
  ctx.lineTo(c.width / 2, c.height - 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fdf4e0';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, padX, bh / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false, sizeAttenuation: false,
  }));
  sp.center.set(0.5, 0);           // 锚点在标签下缘（三角尖端）
  const targetH = 0.052;           // 屏幕高度的固定比例，与距离无关
  sp.scale.set(targetH * c.width / c.height, targetH, 1);
  sp.renderOrder = 10;
  return sp;
}

function insideCathedral(p) {
  if (p.y > 29) return false;
  const inNave = Math.abs(p.x) < 13.5 && p.z > P.choirZ1 && p.z < P.naveZ1 - 0.5;
  const inTransept = Math.abs(p.x) < 23.5 && Math.abs(p.z) < 6.2;
  const inApse = p.z <= P.choirZ1 && p.x * p.x + (p.z - P.choirZ1) ** 2 < 13.5 * 13.5;
  return inNave || inTransept || inApse;
}

// 每帧：按室内外筛选 → 投影到屏幕 → 近处优先，互相压盖的标签自动隐藏
const _lv = new THREE.Vector3();
function updateLabels() {
  if (!labelGroup || !labelGroup.visible) return;
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  const inside = insideCathedral(camera.position);
  const f = 1 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const cands = [];
  for (const sp of labelSprites) {
    const s = sp.userData.scope;
    sp.visible = false;
    if (!(s === 'both' || (inside ? s === 'in' : s === 'out'))) continue;
    _lv.copy(sp.position).applyMatrix4(camera.matrixWorldInverse);
    if (_lv.z > -1) continue;                       // 在相机背后
    _lv.copy(sp.position).project(camera);
    if (Math.abs(_lv.x) > 1.2 || Math.abs(_lv.y) > 1.2) continue;
    cands.push({
      sp, x: _lv.x, y: _lv.y,
      w: sp.scale.x * f / camera.aspect,
      h: sp.scale.y * f,
      d: camera.position.distanceToSquared(sp.position),
    });
  }
  cands.sort((a, b) => a.d - b.d);
  const placed = [];
  const pad = 0.02;
  for (const c of cands) {
    const r = { x0: c.x - c.w / 2, x1: c.x + c.w / 2, y0: c.y, y1: c.y + c.h };
    if (placed.some((p) => r.x0 < p.x1 + pad && r.x1 > p.x0 - pad && r.y0 < p.y1 + pad && r.y1 > p.y0 - pad)) continue;
    placed.push(r);
    c.sp.visible = true;
  }
}

// ---------- 大教堂的装配 / 重建 ----------
let root = null, labelGroup = null;
let labelSprites = [];
let cathedralMats = new Set();
let buildList = [];               // 建造动画的构件次序
let labelsOn = false;

function disposeCathedral() {
  if (!root) return;
  const geos = new Set(), mats = new Set();
  root.traverse((o) => {
    if (o.geometry) geos.add(o.geometry);
    if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.add(m);
  });
  labelGroup.traverse((o) => {
    if (o.material) { o.material.map?.dispose(); o.material.dispose(); }
  });
  scene.remove(root, labelGroup);
  for (const g of geos) g.dispose();
  for (const m of mats) { m.map?.dispose(); m.dispose(); }
  root = labelGroup = null;
}

// 建造次序：区域（歌坛→耳堂→中厅逐开间→西立面→尖塔）+ 区域内自下而上
function computeBuildOrder() {
  const box = new THREE.Box3();
  const entries = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    box.setFromObject(o);
    const cx = (box.min.x + box.max.x) / 2;
    const cy = (box.min.y + box.max.y) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    const yTop = o.userData.buildY ?? box.max.y;
    let key;
    if (o.userData.buildFirst) {
      key = -1000;
      o.userData.buildRegion = -1;
    } else {
      let region;
      if (cy > 36 && Math.abs(cx) < 5 && Math.abs(cz) < 5) region = 9;
      else if (cz > P.naveZ1 - 0.5) region = 8;
      else if (cz < -P.naveHW - 0.5) region = 0;
      else if (cz <= P.naveHW + 0.5) region = 1;
      else region = 2 + Math.min(P.naveBays - 1, Math.floor((cz - P.naveZ0) / P.bay));
      o.userData.buildRegion = region;
      key = region * 100 + yTop;
    }
    entries.push({ o, key });
  });
  entries.sort((a, b) => a.key - b.key);
  buildList = entries.map((e) => e.o);
}

function mountCathedral() {
  const built = buildCathedral();
  root = built.root;
  scene.add(root);

  labelGroup = new THREE.Group();
  labelGroup.visible = labelsOn;
  labelSprites = [];
  for (const { text, pos, scope = 'out' } of built.labels) {
    const sp = makeLabelSprite(text);
    sp.position.set(...pos);
    sp.userData.scope = scope;
    labelSprites.push(sp);
    labelGroup.add(sp);
  }
  scene.add(labelGroup);

  cathedralMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) cathedralMats.add(m);
    }
  });
  applySection(SECTIONS[sectionIdx].planes);
  computeBuildOrder();
}

// ---------- 剖面 ----------
const SECTIONS = [
  { planes: [], name: '完整外观' },
  { planes: [new THREE.Plane(new THREE.Vector3(0, 0, -1), 27)], name: '横剖面 · 经典的结构解剖图' },
  { planes: [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)], name: '纵剖面 · 沿中厅轴线' },
];
let sectionIdx = 0;
function applySection(planes) {
  for (const m of cathedralMats) {
    m.clippingPlanes = planes.length ? planes : null;
    m.needsUpdate = true;
  }
}

// ---------- 工地装备与声音 ----------
const worksite = createWorksite();
scene.add(worksite.group);
const audio = createAudio();

// ---------- 建造过程动画 ----------
const build = { active: false, playing: false, t: 0, dur: 42, lastCount: -1 };
const PHASE_NAMES = {
  '-1': '放线与地坪',
  0: '营建歌坛与后殿——先让弥撒开始',
  1: '耳堂与交叉部',
  8: '西立面与双塔',
  9: '交叉部尖塔合龙',
};
function phaseName(region) {
  if (region >= 2 && region <= 7) return `中厅 · 自东向西第 ${region - 1} 开间`;
  return PHASE_NAMES[region] ?? '';
}
function applyBuild() {
  const n = buildList.length;
  const count = build.active ? Math.round(build.t * n) : n;
  if (count === build.lastCount) return;
  const prev = build.lastCount;
  for (let i = 0; i < n; i++) buildList[i].visible = i < count;
  build.lastCount = count;
  // 工地装备跟随施工前沿；完工鸣钟
  worksite.update(build.active && count < n ? (buildList[count]?.userData.buildRegion ?? null) : null, P);
  if (build.active && prev !== -1 && prev < n && count >= n) audio.toll(5);
  const ui = document.getElementById('timeline');
  if (build.active && ui) {
    document.getElementById('buildT').value = build.t;
    const frontier = buildList[Math.min(n - 1, Math.max(0, count - 1))];
    document.getElementById('phaseName').textContent =
      count >= n ? '落成——献堂礼' : phaseName(frontier?.userData.buildRegion ?? -1);
  }
}
function setBuildActive(on) {
  build.active = on;
  build.lastCount = -1;
  const ui = document.getElementById('timeline');
  if (on) {
    build.t = 0;
    build.playing = true;
    ui.classList.remove('hidden');
    toast('建造过程：自东向西、自下而上（拖动时间轴或 ⏸ 暂停）');
  } else {
    build.playing = false;
    ui.classList.add('hidden');
  }
  applyBuild();
}

// ---------- 第一人称行走 ----------
const walk = { active: false, yaw: 0, pitch: 0, keys: new Set() };
const _fwd = new THREE.Vector3();
function setWalk(on) {
  walk.active = on;
  controls.enabled = !on;
  if (on) {
    camera.getWorldDirection(_fwd);
    walk.yaw = Math.atan2(-_fwd.x, -_fwd.z);
    walk.pitch = Math.asin(THREE.MathUtils.clamp(_fwd.y, -1, 1));
    camera.position.y = 1.7;
    toast('行走模式：点击画面锁定鼠标 · WASD 移动 · Shift 加速 · F 返回环视');
  } else {
    document.exitPointerLock?.();
    camera.getWorldDirection(_fwd);
    controls.target.copy(camera.position).addScaledVector(_fwd, 10);
    toast('环视模式');
  }
}
function updateWalk(dt) {
  if (!walk.active) return;
  camera.quaternion.setFromEuler(new THREE.Euler(walk.pitch, walk.yaw, 0, 'YXZ'));
  const speed = (walk.keys.has('ShiftLeft') || walk.keys.has('ShiftRight')) ? 16 : 5.5;
  const fx = -Math.sin(walk.yaw), fz = -Math.cos(walk.yaw);
  const rx = Math.cos(walk.yaw), rz = -Math.sin(walk.yaw);
  let mx = 0, mz = 0;
  if (walk.keys.has('KeyW')) { mx += fx; mz += fz; }
  if (walk.keys.has('KeyS')) { mx -= fx; mz -= fz; }
  if (walk.keys.has('KeyD')) { mx += rx; mz += rz; }
  if (walk.keys.has('KeyA')) { mx -= rx; mz -= rz; }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    camera.position.x += (mx / len) * speed * dt;
    camera.position.z += (mz / len) * speed * dt;
  }
  camera.position.y = 1.7;
}
renderer.domElement.addEventListener('click', () => {
  if (walk.active && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }
});
addEventListener('mousemove', (e) => {
  if (walk.active && document.pointerLockElement === renderer.domElement) {
    walk.yaw -= e.movementX * 0.0022;
    walk.pitch = THREE.MathUtils.clamp(walk.pitch - e.movementY * 0.0022, -1.45, 1.45);
  }
});

// ---------- 电影导览 ----------
let RECORD = false;   // ?record=1：确定性逐帧步进，供无头浏览器抓帧成片
const tour = { active: false, idx: 0, t: 0, savedTime: 0.42, savedSection: 0 };
const _tv = new THREE.Vector3();
function startShot(i) {
  tour.idx = i;
  tour.t = 0;
  const s = TOUR[i];
  sectionIdx = s.section ?? 0;
  applySection(SECTIONS[sectionIdx].planes);
  if (s.time != null) setSunTime(s.time);
  if (s.buildTo != null) {
    build.active = true;
    build.playing = false;
    build.t = s.buildFrom;
    build.lastCount = -1;
    applyBuild();
  } else if (build.active) {
    build.active = false;
    build.lastCount = -1;
    applyBuild();
  }
  const box = document.getElementById('subtitle');
  box.classList.remove('show');
  setTimeout(() => {
    document.getElementById('subTitle').textContent = s.title;
    document.getElementById('subText').textContent = s.text;
    document.getElementById('subProg').textContent = `${i + 1} / ${TOUR.length}`;
    box.classList.add('show');
  }, 350);
}
function setTour(on, { keepTime = false } = {}) {
  if (on === tour.active) return;
  tour.active = on;
  document.body.classList.toggle('touring', on);
  const cine = document.getElementById('cine');
  if (on) {
    if (walk.active) setWalk(false);
    fly = null;
    tour.savedTime = currentSunT;
    controls.enabled = false;
    labelGroup.visible = false;
    document.getElementById('help').classList.add('hidden');
    document.getElementById('panel').classList.add('hidden');
    document.getElementById('presetCard').classList.add('hidden');
    cine.classList.add('on');
    if (!RECORD) { audio.ensure(); audio.toll(2); }
    startShot(0);
  } else {
    cine.classList.remove('on');
    document.getElementById('subtitle').classList.remove('show');
    sectionIdx = 0;
    applySection([]);
    if (build.active) { build.active = false; build.lastCount = -1; applyBuild(); }
    if (!keepTime) setSunTime(tour.savedTime);
    labelGroup.visible = labelsOn;
    controls.enabled = true;
    camera.getWorldDirection(_tv);
    controls.target.copy(camera.position).addScaledVector(_tv, 20);
  }
}
function updateTour(dt) {
  const s = TOUR[tour.idx];
  tour.t += dt;
  const u = Math.min(tour.t / s.dur, 1);
  const e = u * u * (3 - 2 * u);   // smoothstep：镜头缓入缓出
  camera.position.set(
    s.p0[0] + (s.p1[0] - s.p0[0]) * e,
    s.p0[1] + (s.p1[1] - s.p0[1]) * e,
    s.p0[2] + (s.p1[2] - s.p0[2]) * e);
  _tv.set(
    s.t0[0] + (s.t1[0] - s.t0[0]) * e,
    s.t0[1] + (s.t1[1] - s.t0[1]) * e,
    s.t0[2] + (s.t1[2] - s.t0[2]) * e);
  camera.lookAt(_tv);
  if (s.buildTo != null) {
    build.t = s.buildFrom + (s.buildTo - s.buildFrom) * u;
    applyBuild();
  }
  if (u >= 1) {
    if (tour.idx < TOUR.length - 1) startShot(tour.idx + 1);
    else {
      setTour(false, { keepTime: true });   // 停在黄昏
      if (!RECORD) {
        audio.toll(3);
        toast('导览结束——按 T 可再看一遍');
      }
    }
  }
}

// ---------- 视角书签与镜头飞行 ----------
const VIEWS = {
  1: { pos: [96, 62, 102], tgt: [0, 15, 5], name: '全景 · 东南上空' },
  2: { pos: [0, 24, 122], tgt: [0, 21, 50], name: '西立面 · 双塔与玫瑰窗' },
  3: { pos: [0, 7, 44], tgt: [0, 13, -27], name: '中厅 · 朝祭坛望去' },
  4: { pos: [2, 5, 26], tgt: [0, 29, 8], name: '仰望肋拱顶' },
  5: { pos: [34, 27, 36], tgt: [8, 22, 18], name: '飞扶壁特写' },
  6: { pos: [34, 26, -66], tgt: [0, 15, -18], name: '后殿 · 放射飞券' },
};
let fly = null;
function flyTo(v, dur = 1.6) {
  if (walk.active) setWalk(false);
  fly = {
    t: 0, dur,
    p0: camera.position.clone(), p1: new THREE.Vector3(...v.pos),
    t0: controls.target.clone(), t1: new THREE.Vector3(...v.tgt),
  };
  toast(v.name);
}

// ---------- UI ----------
const toastEl = document.getElementById('toast');
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// 设计面板：滑块 → 参数 → 防抖重建
const PARAM_SLIDERS = [
  ['naveBays', 'pBays', (v) => `${v} 间`],
  ['vaultSpring', 'pSpring', (v) => `${v} m`],
  ['arcK', 'pArcK', (v) => `k = ${Number(v).toFixed(2)}`],
  ['towerH', 'pTower', (v) => `${v} m`],
];
let rebuildTimer = 0;
function readPanelAndRebuild() {
  for (const [key, id] of PARAM_SLIDERS) P[key] = Number(document.getElementById(id).value);
  recomputeDerived();
  if (build.active) setBuildActive(false);
  disposeCathedral();
  mountCathedral();
  updatePanelReadout();
}
function updatePanelReadout() {
  for (const [key, id, fmt] of PARAM_SLIDERS) {
    const el = document.getElementById(id);
    el.value = P[key];
    document.getElementById(id + 'Val').textContent = fmt(el.value);
  }
  const apex = P.vaultSpring + archApex(P.naveHW, P.vaultK);
  document.getElementById('apexVal').textContent = `拱顶顶高 ≈ ${apex.toFixed(1)} m`;
  document.getElementById('beauvaisWarn').classList.toggle('hidden', P.vaultSpring <= 22);
}
let activePresetKey = 'proto';
// 解说卡片：预设的年代、数据与故事
function showPresetCard(preset) {
  const c = preset.card;
  if (!c) return;
  document.getElementById('cardName').textContent = preset.name;
  document.getElementById('cardDates').textContent = c.dates;
  document.getElementById('cardPlace').textContent = c.place;
  const ul = document.getElementById('cardStats');
  ul.innerHTML = '';
  for (const s of c.stats) {
    const li = document.createElement('li');
    li.textContent = s;
    ul.appendChild(li);
  }
  document.getElementById('cardStory').textContent = c.story;
  document.getElementById('presetCard').classList.remove('hidden');
}
function selectPreset(preset) {
  activePresetKey = preset.key;
  applyPreset(preset);
  if (build.active) setBuildActive(false);
  disposeCathedral();
  mountCathedral();
  updatePanelReadout();
  for (const b of document.querySelectorAll('#presets button')) {
    b.classList.toggle('active', b.dataset.key === preset.key);
  }
  showPresetCard(preset);
  toast(`${preset.name} · ${preset.desc}`);
}
function wirePanel() {
  document.getElementById('cardClose').addEventListener('click', () => {
    document.getElementById('presetCard').classList.add('hidden');
  });
  const box = document.getElementById('presets');
  for (const preset of PRESETS) {
    const b = document.createElement('button');
    b.textContent = preset.name;
    b.dataset.key = preset.key;
    b.title = preset.desc;
    if (preset.key === activePresetKey) b.classList.add('active');
    b.addEventListener('click', () => selectPreset(preset));
    box.appendChild(b);
  }
  for (const [, id] of PARAM_SLIDERS) {
    document.getElementById(id).addEventListener('input', () => {
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(readPanelAndRebuild, 350);
    });
  }
  document.getElementById('sunT').addEventListener('input', (e) => setSunTime(Number(e.target.value)));
  document.getElementById('playBtn').addEventListener('click', () => {
    build.playing = !build.playing;
    document.getElementById('playBtn').textContent = build.playing ? '⏸' : '▶';
  });
  document.getElementById('buildT').addEventListener('input', (e) => {
    build.playing = false;
    document.getElementById('playBtn').textContent = '▶';
    build.t = Number(e.target.value);
    applyBuild();
  });
}

// 统一动作入口：键盘与屏幕按钮共用（触屏设备没有键盘）
function doAction(name) {
  audio.ensure();
  // 导览中只允许：退出导览、声音
  if (tour.active && !['tour', 'bell', 'mute'].includes(name)) return;
  switch (name) {
    case 'tour': setTour(!tour.active); break;
    case 'build': setBuildActive(!build.active); break;
    case 'walk': setWalk(!walk.active); break;
    case 'panel': document.getElementById('panel').classList.toggle('hidden'); break;
    case 'section':
      sectionIdx = (sectionIdx + 1) % SECTIONS.length;
      applySection(SECTIONS[sectionIdx].planes);
      toast(SECTIONS[sectionIdx].name);
      break;
    case 'labels':
      labelsOn = !labelsOn;
      labelGroup.visible = labelsOn;
      updateLabels();
      toast(labelsOn ? '结构标注：开（随室内 / 室外自动切换）' : '结构标注：关');
      break;
    case 'bell': audio.toll(1); break;
    case 'mute': toast(audio.toggleMute() ? '静音' : '声音开'); break;
    case 'help': document.getElementById('help').classList.toggle('hidden'); break;
  }
}

const KEY_ACTIONS = {
  t: 'tour', b: 'build', f: 'walk', p: 'panel',
  c: 'section', l: 'labels', g: 'bell', m: 'mute', h: 'help',
};
addEventListener('keydown', (e) => {
  audio.ensure();
  if (e.code.startsWith('Key') || e.code.startsWith('Shift')) walk.keys.add(e.code);
  if (e.repeat) return;
  if (tour.active) {
    if (e.key === 'Escape') { setTour(false); return; }
    if (e.key === 'ArrowRight') {
      if (tour.idx < TOUR.length - 1) startShot(tour.idx + 1);
      else { setTour(false, { keepTime: true }); toast('导览结束'); }
      return;
    }
  }
  if (!tour.active && e.key >= '1' && e.key <= '6') flyTo(VIEWS[e.key]);
  else if (KEY_ACTIONS[e.key.toLowerCase()]) doAction(KEY_ACTIONS[e.key.toLowerCase()]);
});
addEventListener('keyup', (e) => walk.keys.delete(e.code));

// 屏幕按钮栏（触屏设备的主要入口；行走模式需要鼠标指针锁定，触屏上隐藏）
function wireCtrlbar() {
  const bar = document.getElementById('ctrlbar');
  const touchOnly = 'ontouchstart' in window;
  for (const btn of bar.querySelectorAll('button')) {
    if (touchOnly && btn.dataset.act === 'walk') { btn.remove(); continue; }
    btn.addEventListener('click', () => doAction(btn.dataset.act));
  }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let firstFrame = true;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  if (fly) {
    fly.t += dt;
    const u = Math.min(fly.t / fly.dur, 1);
    const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
    camera.position.lerpVectors(fly.p0, fly.p1, e);
    controls.target.lerpVectors(fly.t0, fly.t1, e);
    if (u >= 1) fly = null;
  }
  if (!tour.active && build.active && build.playing) {
    build.t = Math.min(build.t + dt / build.dur, 1);
    applyBuild();
    if (build.t >= 1) {
      build.playing = false;
      document.getElementById('playBtn').textContent = '▶';
    }
  }
  if (tour.active) updateTour(dt);
  else if (walk.active) updateWalk(dt);
  else controls.update();
  audio.setInside(insideCathedral(camera.position));
  updateLabels();
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    document.getElementById('loading')?.remove();
  }
}

// ---------- 启动 ----------
const q = new URLSearchParams(location.search);
const presetQ = PRESETS.find((p) => p.key === q.get('preset'));
if (presetQ) { activePresetKey = presetQ.key; applyPreset(presetQ); }
mountCathedral();
wirePanel();
wireCtrlbar();
updatePanelReadout();
if (presetQ) showPresetCard(presetQ);
setSunTime(q.get('time') != null ? Number(q.get('time')) : 0.42);
document.getElementById('sunT').value = q.get('time') ?? 0.42;
if (q.get('section')) {
  sectionIdx = (+q.get('section')) % SECTIONS.length;
  applySection(SECTIONS[sectionIdx].planes);
}
if (q.get('labels')) { labelsOn = true; labelGroup.visible = true; }
if (q.get('panel')) document.getElementById('panel').classList.remove('hidden');
if (q.get('build') != null) {
  setBuildActive(true);
  build.playing = false;
  document.getElementById('playBtn').textContent = '▶';
  build.t = Number(q.get('build'));
  applyBuild();
}
flyTo(VIEWS[q.get('view')] ?? VIEWS[1], 0.01);
addEventListener('pointerdown', () => audio.ensure());
if (q.get('record')) {
  // 录制模式：不跑 rAF 主循环，外部逐帧调用 __tourStep(dt) 并截屏
  RECORD = true;
  renderer.setPixelRatio(1);
  document.getElementById('loading')?.remove();
  document.getElementById('ctrlbar').style.display = 'none';   // 成片画面保持干净
  setTour(true);
  window.__tourStep = (dt) => {
    if (tour.active) updateTour(dt);
    renderer.render(scene, camera);
    return !tour.active;
  };
} else {
  if (q.get('tour')) setTour(true);
  animate();
}
