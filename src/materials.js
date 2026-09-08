// 材质与程序化贴图。所有贴图用 Canvas 现画（石缝、地面棋盘格），无外部资源。
// 在无 DOM 环境（如 node 冒烟测试）下自动退化为纯色。

import * as THREE from '../lib/three.module.js';

const hasDOM = typeof document !== 'undefined';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w, h, draw) {
  if (!hasDOM) return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 16;            // 各向异性过滤：掠射角下地面才不会摩尔纹闪烁（渲染器会自动截到硬件上限）
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// 砌石贴图：错缝石块 + 明度噪声
function stoneTexture(base, joint, seed = 7) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const rnd = mulberry32(seed);
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const rows = 10, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * 40 + rnd() * 20;
      for (let x = -60; x < w + 60; x += 96 + rnd() * 30) {
        const v = (rnd() - 0.5) * 18;
        ctx.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 230 : 20},${Math.abs(v) / 255})`;
        ctx.fillRect(x + off, r * rh, 110, rh);
      }
      ctx.strokeStyle = joint; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, r * rh); ctx.lineTo(w, r * rh); ctx.stroke();
      for (let x = off; x < w; x += 118) {
        ctx.beginPath(); ctx.moveTo(x, r * rh); ctx.lineTo(x, (r + 1) * rh); ctx.stroke();
      }
    }
    for (let i = 0; i < 2200; i++) {
      const v = rnd() * 26 - 13;
      ctx.fillStyle = `rgba(${v > 0 ? 255 : 30},${v > 0 ? 252 : 26},${v > 0 ? 235 : 18},0.05)`;
      ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 4, 2 + rnd() * 4);
    }
  });
}

// 棋盘地砖：一张贴图 = FLOOR_TILES × FLOOR_TILES 格，边长 FLOOR_TILE 米（由 worldFloorUV 按世界坐标铺开）
export const FLOOR_TILES = 8;
export const FLOOR_TILE = 0.6;

function checkerTexture() {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    const n = FLOOR_TILES, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#3a3733' : '#b8ad9c';
      ctx.fillRect(i * s, j * s, s, s);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i <= n; i++) { ctx.fillRect(i * s - 2, 0, 4, h); ctx.fillRect(0, i * s - 2, w, 4); }
  });
}

export function makeMaterials() {
  const stoneTex = stoneTexture('#cfc6b4', 'rgba(70,60,48,0.35)', 7);
  if (stoneTex) stoneTex.repeat.set(0.14, 0.14);
  const stone = new THREE.MeshStandardMaterial({
    color: '#d8cfbd', map: stoneTex, roughness: 0.95, metalness: 0.0,
  });
  const stoneLight = new THREE.MeshStandardMaterial({ color: '#e2dac9', roughness: 0.9 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: '#b3a68f', roughness: 0.95 });
  const roof = new THREE.MeshStandardMaterial({ color: '#5b6672', roughness: 0.8 });
  const dark = new THREE.MeshBasicMaterial({ color: '#171310' });
  const floorTex = checkerTexture();   // repeat 保持 1：UV 由各地坪按世界坐标生成，格子处处等大且跨块连续
  const floor = new THREE.MeshStandardMaterial({ color: '#cfc8ba', map: floorTex, roughness: 0.85 });
  const ground = new THREE.MeshStandardMaterial({ color: '#8b9077', roughness: 1 });
  const plaza = new THREE.MeshStandardMaterial({ color: '#9a948a', roughness: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d9b64a', roughness: 0.35, metalness: 0.7 });
  return { stone, stoneLight, stoneDark, roof, dark, floor, ground, plaza, gold };
}

export { canvasTexture, hasDOM };
