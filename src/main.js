// 入口：渲染、光照与日夜、相机（环视 / 第一人称行走）、剖面、结构标注、
// 建造过程动画、参数化设计面板。所有初始化逻辑集中在文件底部的 init() 之后执行。

import * as THREE from '../lib/three.module.js';
import { OrbitControls } from '../lib/OrbitControls.js';
import { buildCathedral } from './cathedral.js';
import { applyBakedColors, bakeableMeshes } from './bake.js';
import { collectDoors, setDoorState, nextState, updateDoors, doorBlocks, STATE_NAMES } from './doors.js';
import { buildGrid } from './grid.js';
import { canvasTexture, mulberry32 } from './materials.js';
import { P, recomputeDerived, sunPos } from './params.js';
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
// 阴影正交相机：**必须罩住整片领地**，否则出了视锥的建筑直接没有影子、地面上会看到
// 一道硬边界。新领地四至（x 76 / z ±78）在斜阳时视空间要 ±150（x）/ ±110（y），早先的
// ±110/(120,−70) 已经压线、全天有 133 处投影越界。这组数在 params.js 的 P.shadow，
// 静态校验：node tools/check-shadow.mjs（0 处越界才算过）。
{
  const S = P.shadow;
  sun.shadow.mapSize.set(S.map, S.map);
  sun.shadow.camera.left = -S.H; sun.shadow.camera.right = S.H;
  sun.shadow.camera.top = S.top; sun.shadow.camera.bottom = S.bottom;
  sun.shadow.camera.near = S.near; sun.shadow.camera.far = S.far;
  sun.shadow.bias = S.bias;
}
scene.add(sun, sun.target);
// 室内那三盏点光是"没有间接光时的替身"。烘焙一旦生效就该调暗，否则会把烘出来的
// 层次冲平（现在的又平又匀，就是它们照的）。
const PT_RAW = 220, PT_BAKED = 110;
const interiorLights = [];
for (const [x, y, z] of [[0, 13, 22], [0, 13, -14], [0, 10, 42]]) {
  const p = new THREE.PointLight('#ffd9a0', PT_RAW, 70, 2);
  p.position.set(x, y, z);
  scene.add(p);
  interiorLights.push(p);
}

const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color();
let currentSunT = 0.42;
// t ∈ [0,1] → 7:00 – 19:00。太阳自东（-z）经南（+x）向西（+z）。
function setSunTime(t) {
  currentSunT = t;
  const slider = document.getElementById('sunT');
  if (slider && Number(slider.value) !== t) slider.value = t;
  const s = Math.sin(Math.PI * t);                       // 高度因子：正午 1，晨昏 0
  sunPos(t, sun.position);                               // 轨迹在 params.js，影子视锥按它校验
  sun.color.lerpColors(_c1.set('#ff9a4f'), _c2.set('#fff3dc'), s);
  sun.intensity = (1.0 + 1.5 * s) * WEATHER[weather].sun;
  hemi.intensity = (0.3 + 0.6 * s) * WEATHER[weather].hemi;
  const w = WEATHER[weather], grey = new THREE.Color(w.sky);
  const top = _c1.set('#3a4a78').lerp(_c2.set('#4f7fc0'), s).lerp(grey, w.mix).getStyle();
  const mid = _c2.set('#c98d6b').lerp(_c3.set('#a8c0dc'), s).lerp(grey, w.mix).getStyle();
  const bot = _c3.set('#f0bd90').lerp(new THREE.Color('#e9e3d3'), s).lerp(grey, w.mix).getStyle();
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
  scene.fog.density = w.fog;
  const hh = Math.floor(7 + t * 12), mm = Math.round(((7 + t * 12) % 1) * 60);
  const lab = document.getElementById('sunLabel');
  if (lab) lab.textContent = `${hh}:${String(mm).padStart(2, '0')}`;
}

// ---------- 地面与前庭广场（不随重建变化） ----------
const ground = new THREE.Mesh(new THREE.CircleGeometry(600, 48),
  new THREE.MeshStandardMaterial({ color: '#89906f', roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.2;    // 与广场拉开高差：两层水平面靠太近，远处会 z-fighting 闪烁
ground.receiveShadow = true;
scene.add(ground);
const plaza = new THREE.Mesh(new THREE.PlaneGeometry(148, 210),
  new THREE.MeshStandardMaterial({ color: '#9b968b', roughness: 1 }));
plaza.rotation.x = -Math.PI / 2;
plaza.position.set(6, 0, 10);        // 与墙脚齐平（低于墙脚会在墙下露出一道缝）
plaza.receiveShadow = true;
scene.add(plaza);

// 地面之下的泥土层：一张法线朝下的土色面片。大地/广场/地坪/草地都是单面朝上，
// 从下面看被背面剔除，露出的就是这层泥土——比"双面地面"那种一整片无光的黑幕真实。
const soilTex = canvasTexture(512, 512, (ctx, w, h) => {
  const rnd = mulberry32(7);
  ctx.fillStyle = '#5d4a33'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 4200; i++) {
    const v = rnd();
    ctx.fillStyle = v < 0.5
      ? `rgba(28,20,12,${0.10 + rnd() * 0.25})`
      : `rgba(122,100,72,${0.05 + rnd() * 0.18})`;
    ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 5, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 26; i++) {                 // 几道岩层
    ctx.strokeStyle = `rgba(18,12,7,${0.06 + rnd() * 0.12})`;
    ctx.lineWidth = 1 + rnd() * 3;
    const y = rnd() * h;
    ctx.beginPath(); ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + (rnd() - 0.5) * 46, w * 0.7, y + (rnd() - 0.5) * 46, w, y);
    ctx.stroke();
  }
});
if (soilTex) soilTex.repeat.set(150, 150);
const soil = new THREE.Mesh(new THREE.CircleGeometry(600, 48),
  new THREE.MeshBasicMaterial({ color: '#ffffff', map: soilTex }));
soil.rotation.x = Math.PI / 2;                   // 法线朝下（-y）
soil.position.y = -2.5;                         // 与地基配合：地基从 -0.02 埋到 -3.0，土面在 -2.5，地基半截入土
scene.add(soil);

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
let root = null, labelGroup = null, foundGroup = null;
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
  if (foundGroup) {
    foundGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    scene.remove(foundGroup);
    foundGroup = null;
  }
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
    if (o.userData.buildSkip) return;   // 领地不参与建造动画（镇子先于教堂存在）
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

// 地基：把着地的墙/柱往下延一段，从地下看"墙脚戳进土里"。
// 这是纯视觉层，挂在 scene 而不是 root：不进碰撞、不进烘焙、不进建造动画，
// 也不会被 check-zfight/rain/poke/flicker 看见（它们只 buildCathedral）。
function addFoundations(root) {
  const mat = new THREE.MeshBasicMaterial({ color: '#7d7160' });
  const group = new THREE.Group();
  const box = new THREE.Box3();
  const FT = -0.02, FB = -3.0;               // 地基顶/底（土面在 -2.5，地基埋进去半米）
  let i = 0;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noFoundation) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.transparent || m.depthWrite === false || m.userData?.glazing) return;
    box.setFromObject(o);
    if (box.min.y > 0.08) return;            // 不接地
    if (box.max.y < 1.2) return;             // 地坪/长椅/墓碑这类低矮件
    if (box.max.y > 50) return;              // 尖塔等高空构件
    const w = (box.max.x - box.min.x) * 0.96;
    const d = (box.max.z - box.min.z) * 0.96;
    if (w < 0.4 || d < 0.4) return;
    const j = (i++ % 9) * 0.02;              // 相邻/重叠地基的顶底各差一点，避免共面
    const top = FT - j, bot = FB - j;
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, top - bot, d), mat);
    f.position.set((box.min.x + box.max.x) / 2, (top + bot) / 2, (box.min.z + box.max.z) / 2);
    f.userData.foundation = true;
    group.add(f);
  });
  return group;
}

function mountCathedral() {
  const built = buildCathedral();
  root = built.root;
  scene.add(root);
  foundGroup = addFoundations(root);
  scene.add(foundGroup);

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
  doors = collectDoors(root);
  setAllDoors(WEATHER[weather].doors, true);
  buildDoorPlan();
  buildCollision();
  window.__baked = false;   // 供 tools/record-tour.mjs 等：等烘焙完成再开始
  startBake();
}

// ---------- 室内光照烘焙（顶点色） ----------
// 静态的光离线算、运行时只查表，就是游戏里 lightmap 的做法。这里把活分给几个
// Worker：每个 Worker 自己建一遍教堂、烘 index % n === k 的那些网格，结果按下标
// 拼回来。算过的结果按参数指纹存进 IndexedDB，下次进站直接贴上去。
const BAKE_VER = 2;   // v2：加入了领地（回廊/住宅）作为遮挡与反弹面
let bakeJob = 0, bakeWorkers = [], baking = false;
const bakeInfoEl = () => document.getElementById('bakeInfo');
const bakeKey = () => `v${BAKE_VER}:` + JSON.stringify(P);

function idb() {
  return new Promise((res, rej) => {
    const q = indexedDB.open('stone-and-light', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('bake');
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
async function cacheGet(key) {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const r = db.transaction('bake').objectStore('bake').get(key);
      r.onsuccess = () => res(r.result ?? null);
      r.onerror = () => res(null);
    });
  } catch { return null; }
}
async function cachePut(key, val) {
  try {
    const db = await idb();
    const st = db.transaction('bake', 'readwrite').objectStore('bake');
    const all = st.getAllKeys();                  // 一份两三兆，留最近四份就够（够两套玻璃来回切）
    all.onsuccess = () => {
      const ks = all.result.filter((k) => k !== key);
      for (let i = 0; i <= ks.length - 4; i++) st.delete(ks[i]);
      st.put(val, key);
    };
  } catch { /* 隐私模式下没有 IndexedDB，算了 */ }
}

function applyBake(colors) {
  applyBakedColors(root, colors);
  for (const p of interiorLights) p.intensity = PT_BAKED;
}
function stopBake() {
  for (const w of bakeWorkers) w.terminate();
  bakeWorkers = [];
  baking = false;
}
async function startBake() {
  stopBake();
  for (const p of interiorLights) p.intensity = PT_RAW;   // 还没烘好之前先照亮
  if (q.get('bake') === '0' || typeof Worker === 'undefined') { window.__baked = true; return; }
  const job = ++bakeJob, key = bakeKey();
  const el = bakeInfoEl();
  if (el) el.textContent = '室内光照：准备烘焙…';

  const hit = await cacheGet(key);
  if (job !== bakeJob) return;
  if (hit && hit.meshes === bakeableMeshes(root).length) {
    const colors = new Array(hit.meshes).fill(null);
    hit.idx.forEach((mi, k) => { colors[mi] = hit.colors[k]; });
    applyBake(colors);
    if (el) el.textContent = '室内光照：已烘焙（缓存）';
    window.__baked = true;
    return;
  }

  // 每个 Worker 都要自己建一遍教堂加射线网格，四五十兆内存——手机上开多了会被系统
  // 直接杀掉标签页，所以按"小设备档"整体降规格：少开 Worker、少打射线、顶点缓存
  // 放粗、射线网格放粗（网格粗一格，条目数少四成，内存跟着降）。
  // 桌面实测（8 线程）：4 个 Worker 17 s、6 个 12.5 s、8 个 13.5 s——超线程吃满之后
  // 反而变慢，6 个是拐点。
  // 注意 iOS 的 Safari 不支持 navigator.deviceMemory，取不到值时不能当成大内存机器，
  // 所以屏幕宽度、核数、指针类型三样一起判。
  const mem = navigator.deviceMemory ?? 0;
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = matchMedia?.('(pointer: coarse)')?.matches;
  const low = innerWidth < 820 || (mem && mem <= 4) || cores <= 4 || (coarse && !mem);
  const n = Math.max(1, Math.min(low ? 2 : mem && mem <= 8 ? 3 : 6, cores - 1));
  const rays = low ? 14 : 32;
  const prof = low ? { cell: 1.6, cachePos: 0.45 } : {};
  if (el) el.textContent = `室内光照：烘焙中 0%${low ? '（低精度）' : ''}`;
  const total = bakeableMeshes(root).length;
  const colors = new Array(total).fill(null);
  const idx = [], flat = [];
  const prog = new Array(n).fill(0), progTotal = new Array(n).fill(0);
  const t0 = performance.now();
  let left = n;
  baking = true;
  for (let k = 0; k < n; k++) {
    let w;
    try {
      w = new Worker(new URL('./bakeworker.js', import.meta.url), { type: 'module' });
    } catch {
      if (el) el.textContent = '室内光照：这台设备跑不动，用替身光照';
      stopBake();
      window.__baked = true;
      return;
    }
    bakeWorkers.push(w);
    w.onmessage = (ev) => {
      if (job !== bakeJob) return;
      const d = ev.data;
      if (d.progress) {
        prog[k] = d.progress.done; progTotal[k] = d.progress.total;
        const a = prog.reduce((x, y) => x + y, 0), b = progTotal.reduce((x, y) => x + y, 0);
        if (el && b) el.textContent = `室内光照：烘焙中 ${Math.round(100 * a / b)}%`;
        return;
      }
      d.idx.forEach((mi, i) => { colors[mi] = d.colors[i]; idx.push(mi); flat.push(d.colors[i]); });
      applyBakedColors(root, colors);            // 边算边贴：哪一片算完哪一片先亮起来
      w.terminate();
      if (--left) return;
      applyBake(colors);
      baking = false;
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      if (el) el.textContent = `室内光照：已烘焙（${secs} s）`;
      cachePut(key, { meshes: total, idx, colors: flat });
      window.__baked = true;
    };
    w.onerror = () => { if (el) el.textContent = '室内光照：烘焙失败（用替身光照）'; stopBake(); window.__baked = true; };
    w.postMessage({ params: { ...P }, slice: { k, n }, rays, prof });
  }
}

// ---------- 剖面 ----------
// 刻意让剖切面躲开构件自己的平面，偏出 5 cm：
//   z = 27 正好是开间接缝（墙体逐跨挤出，接缝两侧各有一片端面），
//   x = 0  正好是玫瑰窗光柱所在的平面。
// 面正好躺在剖切面上时裁剪判据恒等于 0，每个像素的生死由浮点误差决定，就成片抖动；
// 往"保留"的一侧偏一点，画面内容不变，抖动消失（tools/check-flicker.mjs 可复现）。
const CUT_EPS = 0.05;
const SECTIONS = [
  { planes: [], name: '完整外观' },
  // z = 27 是中厅自东数第三道开间接缝
  { planes: [new THREE.Plane(new THREE.Vector3(0, 0, -1), P.naveZ0 + 3 * P.bay + CUT_EPS)], name: '横剖面 · 经典的结构解剖图' },
  { planes: [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0 + CUT_EPS)], name: '纵剖面 · 沿中厅轴线' },
];
let sectionIdx = 0;
function applySection(planes) {
  for (const m of cathedralMats) {
    m.clippingPlanes = planes.length ? planes : null;
    m.needsUpdate = true;
  }
}

// ---------- 门 ----------
// 真教堂的门平时是关的：巨门要几个人合力才推得开，日常从门板上挖的便门进出；
// 雨雪天更是关着。所以"晴天"的默认状态是中门与南耳堂门开便门，其余关死。
let doors = [];
function refreshDoorUI() {
  const info = document.getElementById('doorInfo');
  if (info) {
    const open = doors.filter((d) => d.state !== 'closed');
    info.textContent = open.length ? `开着：${open.map((d) => `${d.name}（${STATE_NAMES[d.state]}）`).join('、')}` : '五座门全关';
  }
  for (const d of doors) {
    const el = document.getElementById(`dot-${d.id}`);
    if (el) el.setAttribute('fill', d.state === 'open' ? '#ffd98f' : d.state === 'wicket' ? '#c9a24f' : 'rgba(20,16,12,.9)');
  }
}
function cycleDoor(d) {
  const before = d.state;
  setDoorState(d, nextState(d));
  audio.door(d.state !== 'closed', d.state === 'open' || before === 'open');
  toast(`${d.name}：${STATE_NAMES[d.state]}`);
  refreshDoorUI();
}
function setAllDoors(state, instant = false) {
  let changed = false;
  for (const d of doors) {
    const want = state === 'wicket' && !d.hasWicket ? 'closed' : state;
    if (d.state !== want) changed = true;
    setDoorState(d, want, instant);
  }
  if (changed && !instant) audio.door(state !== 'closed', true);
  refreshDoorUI();
}
// 面板里的小平面图：十字平面 + 半圆后殿，五个点就是五座门，点一下换一档。
// 图是横放的（后殿在左、西立面在右），竖着放的话在面板里会高得离谱。
function buildDoorPlan() {
  const host = document.getElementById('doorPlan');
  if (!host) return;
  // 世界 → 图：z 横向（后殿在左、西立面在右），x 竖向（北在上）。范围要盖到 z=59——
  // 西面那两座侧门开在塔基里（z≈55.4），原来图只画到 51，它们直接被裁掉了。
  const X0 = -27, Z0 = -43, W = 102, H = 54;
  const px = (z) => (z - Z0).toFixed(1), py = (x) => (x - X0).toFixed(1);
  const r = (x0, z0, x1, z1) =>
    `<rect class="wall" x="${px(z0)}" y="${py(x0)}" width="${(z1 - z0).toFixed(1)}" height="${(x1 - x0).toFixed(1)}"/>`;
  const tw = P.towerW / 2, txc = P.naveHW + P.arcadeT + P.towerW / 2 - 0.4, tz = P.naveZ1 + P.towerW / 2 - 0.5;
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}">
    <path class="wall" d="M ${px(P.choirZ1)} ${py(-P.aisleOut - 1)} A ${P.aisleOut + 1} ${P.aisleOut + 1} 0 0 0 ${px(P.choirZ1)} ${py(P.aisleOut + 1)}"/>
    ${r(-P.outerX, P.choirZ1, P.outerX, P.naveZ1)}
    ${r(-(P.transeptEnd + 1.5), -P.naveHW - 1.8, P.transeptEnd + 1.5, P.naveHW + 1.8)}
    ${r(txc - tw, tz - tw, txc + tw, tz + tw)}${r(-txc - tw, tz - tw, -txc + tw, tz + tw)}
    <text class="lab" x="2" y="6">北</text><text class="lab" x="${W - 8}" y="${H - 2}">西</text>
    <g id="doorDots"></g></svg>`;
  const g = host.querySelector('#doorDots');
  for (const d of doors) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('class', 'dot'); c.setAttribute('id', `dot-${d.id}`);
    c.setAttribute('cx', px(d.z)); c.setAttribute('cy', py(d.x)); c.setAttribute('r', '2.8');
    c.addEventListener('click', () => cycleDoor(d));
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    t.textContent = d.name;
    c.appendChild(t);
    g.appendChild(c);
  }
  refreshDoorUI();
}

// ---------- 碰撞 ----------
// 拿烘焙用的那张射线网格当碰撞体：走的时候朝前打两条射线（腰、头各一条），
// 撞上就把这个方向的位移吃掉，再分轴各试一次——贴着墙走就会自然滑过去。
// 门扇会转，不进网格；关着的门单独用平面判（见 doors.js 的 doorBlocks）。
let collGrid = null;
const PLAYER_R = 0.38;
function buildCollision() {
  const hidden = [];
  for (const d of doors) for (const p of [...d.leaves, ...d.wickets]) {
    p.traverse((o) => { if (o.isMesh && o.visible) { o.visible = false; hidden.push(o); } });
  }
  try {
    collGrid = buildGrid(root, { cell: 1.4 });
  } catch { collGrid = null; }
  for (const o of hidden) o.visible = true;
}
function hitsWall(x, z, dx, dz, len) {
  if (!collGrid) return false;
  const nx = dx / len, nz = dz / len;
  for (const h of [0.55, 1.55]) {                 // 腰、头两个高度
    const hit = collGrid.hit(x, h, z, nx, 0, nz, len + PLAYER_R);
    if (hit && hit.t < len + PLAYER_R) return true;
  }
  return false;
}
function canStep(x, z, dx, dz) {
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return true;
  if (hitsWall(x, z, dx, dz, len)) return false;
  for (const d of doors) if (doorBlocks(d, x, z, x + dx, z + dz)) return false;
  return true;
}

// 第一人称：走到门前 4 m 内按 E 开关这一扇（大门就该是走过去推的）
let nearDoor = null;
function updateNearDoor() {
  if (!walk.active || !doors.length) { nearDoor = null; return; }
  const p = camera.position;
  let best = null, bd = 16;                       // 4 m 以内
  for (const d of doors) {
    const dist = (d.x - p.x) ** 2 + (d.z - p.z) ** 2;
    if (dist < bd) { bd = dist; best = d; }
  }
  if (best !== nearDoor) {
    nearDoor = best;
    if (best) toast(`${best.name} · 按 E 开关`);
  }
}

// ---------- 天气 ----------
// 门与天气是连着的：雨雪天全关。开着门的时候斜雨真的会灌进去——
// tools/check-rain.mjs 加 --doors=open 就能算出"今天从大门进了多少升水"。
const WEATHER = {
  clear: { name: '晴', sun: 1, hemi: 1, sky: '#8fa2b8', mix: 0, fog: 0.0016, doors: 'wicket' },
  rain: { name: '雨', sun: 0.32, hemi: 0.85, sky: '#6b7480', mix: 0.75, fog: 0.006, doors: 'closed' },
  snow: { name: '雪', sun: 0.45, hemi: 1.05, sky: '#9aa3ad', mix: 0.8, fog: 0.0075, doors: 'closed' },
};
let weather = 'clear', precip = null;
function makePrecip() {
  const N = 2600;
  const pos = new Float32Array(N * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.LineSegments(geo,
    new THREE.LineBasicMaterial({ color: '#cfe0f0', transparent: true, opacity: 0.55 }));
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const snow = new THREE.Points(sgeo,
    new THREE.PointsMaterial({ color: '#ffffff', size: 0.22, transparent: true, opacity: 0.85, depthWrite: false }));
  rain.frustumCulled = snow.frustumCulled = false;
  rain.visible = snow.visible = false;
  scene.add(rain, snow);
  const p = new Float32Array(N * 3);
  const R = 70, HI = 40;
  for (let i = 0; i < N; i++) {
    p[i * 3] = (Math.random() - 0.5) * 2 * R;
    p[i * 3 + 1] = Math.random() * HI;
    p[i * 3 + 2] = (Math.random() - 0.5) * 2 * R;
  }
  return { N, R, HI, p, rain, snow, pos, spos: sgeo.attributes.position.array };
}
function updatePrecip(dt) {
  if (!precip) return;
  const on = weather !== 'clear' && !insideCathedral(camera.position);   // 屋顶底下当然看不见雨
  precip.rain.visible = on && weather === 'rain';
  precip.snow.visible = on && weather === 'snow';
  if (!on) return;
  const { N, R, HI, p } = precip;
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  const fall = weather === 'rain' ? 26 : 1.6, wind = weather === 'rain' ? 5 : 1.2;
  const t = performance.now() / 1000;
  for (let i = 0; i < N; i++) {
    let x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    y -= fall * dt;
    x += wind * dt + (weather === 'snow' ? Math.sin(t + i) * 0.4 * dt : 0);
    if (y < 0) { y += HI; x = (Math.random() - 0.5) * 2 * R; z = (Math.random() - 0.5) * 2 * R; }
    if (x > R) x -= 2 * R; else if (x < -R) x += 2 * R;
    if (z > R) z -= 2 * R; else if (z < -R) z += 2 * R;
    p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    const wx = cx + x, wy = cy - HI / 2 + y, wz = cz + z;
    if (weather === 'rain') {
      const o = i * 6;
      precip.pos[o] = wx; precip.pos[o + 1] = wy; precip.pos[o + 2] = wz;
      precip.pos[o + 3] = wx - wind * 0.05; precip.pos[o + 4] = wy + 0.9; precip.pos[o + 5] = wz;
    } else {
      precip.spos[i * 3] = wx; precip.spos[i * 3 + 1] = wy; precip.spos[i * 3 + 2] = wz;
    }
  }
  if (weather === 'rain') precip.rain.geometry.attributes.position.needsUpdate = true;
  else precip.snow.geometry.attributes.position.needsUpdate = true;
}
function setWeather(w) {
  weather = WEATHER[w] ? w : 'clear';
  const sel = document.getElementById('pWeather');
  if (sel) sel.value = weather;
  if (!precip) precip = makePrecip();
  setSunTime(currentSunT);                        // 重算天色、雾、日照强度
  setAllDoors(WEATHER[weather].doors);
  toast(`天气：${WEATHER[weather].name}${weather === 'clear' ? '' : ' · 门都关上了'}`);
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

// ---------- 第一人称/第三人称行走 ----------
const walk = { active: false, tp: false, yaw: 0, pitch: 0, keys: new Set() };
const walkPos = { x: 0, z: 0 };
const _fwd = new THREE.Vector3();

// 第三人称相机——真人大小（约 1.7m）修士替身，用来判断院落/过道尺度。
// 全部用几何体程序化拼：衣摆张开、腰间绑绳、念珠垂坠、挂包、兜帽、环头粗须。
const person = (() => {
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
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.014, 8, 20), M(beltCol));
  belt.rotation.x = Math.PI / 2;
  belt.position.set(0, 0.74, 0);
  g.add(belt);
  for (const [dx, rz] of [[0.055, 0.25], [0.10, 0.12]]) {
    const strip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 6), M(beltCol));
    strip.position.set(-0.04 + dx, 0.62, -0.13);
    strip.rotation.z = rz;
    g.add(strip);
  }
  for (let i = 0; i < 6; i++) {                  // 念珠珠串
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), M(0x4a3b2e, 0.8));
    bead.position.set(0.02 + i * 0.016, 0.55 - i * 0.05, -0.14 - i * 0.012);
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
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M(skin, 0.7));
    hand.position.set(s * 0.11, 0.80, -0.14);
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
})();
scene.add(person);

function setWalk(on) {
  walk.active = on;
  walk.tp = false;
  walkPos.x = camera.position.x; walkPos.z = camera.position.z;
  controls.enabled = !on;
  person.visible = false;
  if (on) {
    camera.getWorldDirection(_fwd);
    walk.yaw = Math.atan2(-_fwd.x, -_fwd.z);
    walk.pitch = Math.asin(THREE.MathUtils.clamp(_fwd.y, -1, 1));
    toast('行走模式：点击画面锁定鼠标 · WASD 移动 · Shift 加速 · V 第三人称 · F 返回环视');
  } else {
    document.exitPointerLock?.();
    camera.getWorldDirection(_fwd);
    controls.target.copy(camera.position).addScaledVector(_fwd, 10);
    toast('环视模式');
  }
}
function setWalkTP(on) {
  walk.tp = on;
  person.visible = on;
  toast(on ? '第三人称：相机跟随替身 · V 切回第一人称' : '第一人称');
}
function updateWalk(dt) {
  if (!walk.active) return;
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
    const sx = (mx / len) * speed * dt, sz = (mz / len) * speed * dt;
    const { x, z } = walkPos;
    if (canStep(x, z, sx, sz)) { walkPos.x += sx; walkPos.z += sz; }
    else {                                        // 撞上了就分轴各试一次：贴着墙滑
      if (canStep(x, z, sx, 0)) walkPos.x += sx;
      if (canStep(walkPos.x, z, 0, sz)) walkPos.z += sz;
    }
  }
  person.position.set(walkPos.x, 0, walkPos.z);
  person.rotation.y = walk.yaw;
  if (walk.tp) {                                  // 第三人称：相机在替身后上方，按 pitch 微调高度
    const d = 4.2;
    camera.position.set(walkPos.x - fx * d, 2.0 - walk.pitch * 1.1, walkPos.z - fz * d);
    camera.lookAt(walkPos.x, 1.5, walkPos.z);
  } else {                                        // 第一人称：相机即替身的眼睛
    camera.quaternion.setFromEuler(new THREE.Euler(walk.pitch, walk.yaw, 0, 'YXZ'));
    camera.position.set(walkPos.x, 1.7, walkPos.z);
  }
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

// 无头回归脚本用的入口（与之前的 window.__baked / window.__tourStep 同级）
window.__setWalk = setWalk;
window.__setWalkTP = setWalkTP;
window.__walk = walk;
window.__walkPos = walkPos;

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
    setPanel(false);
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
  7: { pos: [0, 6, 24], tgt: [0, 14, 48], name: '管风琴楼廊 · 西端' },
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

// ---------- UI 缩放 ----------
// 档位由 CSS 的媒体查询按屏宽给（--ui-auto），这里只记一个**相对倍数**（--ui-boost）。
// 记倍数而不是记绝对值：换一块屏幕时自动档仍然生效，不会把手机上的界面撑爆。
let uiBoost = Number(localStorage.getItem('uiBoost')) || 1;
const cssNum = (n) => Number(getComputedStyle(document.documentElement).getPropertyValue(n)) || 1;
function applyUIBoost(v) {
  uiBoost = Math.max(0.6, Math.min(2.2, v));
  document.documentElement.style.setProperty('--ui-boost', uiBoost.toFixed(2));
  localStorage.setItem('uiBoost', String(uiBoost));
  return cssNum('--ui-auto') * uiBoost;
}
if (uiBoost !== 1) applyUIBoost(uiBoost);

// ---------- UI ----------
const toastEl = document.getElementById('toast');
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// 面板与右侧按钮栏都贴着右边，面板一开就压在按钮上——开面板时把按钮栏往左让开
function setPanel(open) {
  const el = document.getElementById('panel');
  el.classList.toggle('hidden', !open);
  document.body.classList.toggle('panel-open', open);
  if (!open) return;
  // 按面板**实测**宽度把按钮栏推开：面板宽度会随内容和界面缩放变，写死一个数迟早对不上。
  // 两者的 zoom 相同，所以换算回未缩放的单位再算。
  const z = cssNum('--ui-auto') * cssNum('--ui-boost');
  const w = el.getBoundingClientRect().width / z;
  document.documentElement.style.setProperty('--bar-right', `${Math.round(22 + w + 12)}px`);
}

// 设计面板：滑块 → 参数 → 防抖重建
const PARAM_SLIDERS = [
  ['naveBays', 'pBays', (v) => `${v} 间`],
  ['vaultSpring', 'pSpring', (v) => `${v} m`],
  ['arcK', 'pArcK', (v) => `k = ${Number(v).toFixed(2)}`],
  ['towerH', 'pTower', (v) => `${v} m`],
];
let rebuildTimer = 0;
function setGlazing(style) {
  if (P.glazing === style) return;
  P.glazing = style;
  if (build.active) setBuildActive(false);
  disposeCathedral();
  mountCathedral();
}
function readPanelAndRebuild() {
  for (const [key, id] of PARAM_SLIDERS) P[key] = Number(document.getElementById(id).value);
  recomputeDerived();
  if (build.active) setBuildActive(false);
  disposeCathedral();
  mountCathedral();
  updatePanelReadout();
}
function updatePanelReadout() {
  document.getElementById('pGlazing').value = P.glazing;
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
  document.getElementById('pGlazing').addEventListener('change', (e) => setGlazing(e.target.value));
  document.getElementById('pWeather').addEventListener('change', (e) => setWeather(e.target.value));
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
    case 'tpView':
      if (walk.active) setWalkTP(!walk.tp);
      else toast('先按 F 进入行走模式，再按 V 切第三人称');
      break;
    case 'panel': setPanel(document.getElementById('panel').classList.contains('hidden')); break;
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
    case 'organ':
      audio.playToccata();
      toast('管风琴 · 巴赫《d 小调托卡塔与赋格》BWV 565 开头');
      break;
    case 'mute': toast(audio.toggleMute() ? '静音' : '声音开'); break;
    case 'help': document.getElementById('help').classList.toggle('hidden'); break;
    case 'nearDoor':
      if (!walk.active) break;                    // 只在第一人称里有意义
      if (nearDoor) cycleDoor(nearDoor);
      else toast('走到门前再按 E');
      break;
    case 'doors': {
      const anyOpen = doors.some((d) => d.state !== 'closed');
      setAllDoors(anyOpen ? 'closed' : 'open');
      toast(anyOpen ? '五座门全关' : '五座门全开');
      break;
    }
    case 'uiSmaller':
    case 'uiBigger': {
      const eff = applyUIBoost(uiBoost + (name === 'uiBigger' ? 0.12 : -0.12));
      toast(`界面缩放 ${Math.round(eff * 100)}%`);
      break;
    }
  }
}

// 用物理键位 e.code 而非 e.key：中文输入法等会截走字母 e.key，但 code 始终是键位本身
const CODE_ACTIONS = {
  KeyT: 'tour', KeyB: 'build', KeyF: 'walk', KeyP: 'panel',
  KeyC: 'section', KeyL: 'labels', KeyG: 'bell', KeyO: 'organ', KeyM: 'mute', KeyH: 'help',
  KeyK: 'doors', KeyE: 'nearDoor', KeyV: 'tpView', Minus: 'uiSmaller', Equal: 'uiBigger',
};
addEventListener('keydown', (e) => {
  audio.ensure();
  if (e.code.startsWith('Key') || e.code.startsWith('Shift')) walk.keys.add(e.code);
  if (e.repeat) return;
  if (tour.active) {
    if (e.code === 'Escape') { setTour(false); return; }
    if (e.code === 'ArrowRight') {
      if (tour.idx < TOUR.length - 1) startShot(tour.idx + 1);
      else { setTour(false, { keepTime: true }); toast('导览结束'); }
      return;
    }
  }
  const digit = /^(Digit|Numpad)([1-7])$/.exec(e.code);
  if (!tour.active && digit) flyTo(VIEWS[digit[2]]);
  else if (CODE_ACTIONS[e.code]) doAction(CODE_ACTIONS[e.code]);
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
let lastDraw = 0;

function animate() {
  requestAnimationFrame(animate);
  // 烘焙时把帧率压到 ~12 fps：这个场景一帧一千两百多个 draw call，主线程本身就吃满
  // 一个核，跟 Worker 抢 CPU 会把烘焙拖慢一倍还多。反正这会儿画面基本是静止的。
  if (baking && !fly && !tour.active && !walk.active) {
    const now = performance.now();
    if (now - lastDraw < 80) return;
    lastDraw = now;
  }
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
  updateDoors(doors, dt);
  updateNearDoor();
  updatePrecip(dt);
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
if (q.get('weather')) setWeather(q.get('weather'));
setSunTime(q.get('time') != null ? Number(q.get('time')) : 0.42);
if (q.get('doors')) setAllDoors(q.get('doors'), true);
document.getElementById('sunT').value = q.get('time') ?? 0.42;
if (q.get('section')) {
  sectionIdx = (+q.get('section')) % SECTIONS.length;
  applySection(SECTIONS[sectionIdx].planes);
}
if (q.get('labels')) { labelsOn = true; labelGroup.visible = true; }
if (q.get('panel')) setPanel(true);
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
