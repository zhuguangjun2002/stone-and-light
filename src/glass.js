// 彩色玻璃：Canvas 现画铅条镶嵌图案。中世纪玻璃以钴蓝与红宝石色为主调
// （"沙特尔蓝"），用铅条（came）拼接小块玻璃。这里用不发光材质（MeshBasicMaterial）
// 模拟"玻璃自己亮"的效果——室内昏暗环境下窗子如同发光体，正是哥特室内的观感。

import * as THREE from '../lib/three.module.js';
import { canvasTexture, mulberry32, hasDOM } from './materials.js';

const PALETTE = ['#1b3d8f', '#22509e', '#8f1522', '#a31d2b', '#c79a1e', '#1d6b3a', '#5b2a7e', '#c9d4e8'];
const LEAD = '#120d08';

// 柳叶窗镶嵌：不规则小格 + 中央圣像圆章
function lancetGlassTexture(seed) {
  return canvasTexture(256, 512, (ctx, w, h) => {
    const rnd = mulberry32(seed);
    ctx.fillStyle = PALETTE[0]; ctx.fillRect(0, 0, w, h);
    const rows = 14;
    for (let r = 0; r < rows; r++) {
      const y0 = (r / rows) * h, y1 = ((r + 1) / rows) * h;
      let x = 0;
      while (x < w) {
        const cw = 24 + rnd() * 40;
        ctx.fillStyle = PALETTE[Math.floor(rnd() * PALETTE.length)];
        const skew = (rnd() - 0.5) * 14;
        ctx.beginPath();
        ctx.moveTo(x, y0); ctx.lineTo(x + cw + skew, y0);
        ctx.lineTo(x + cw - skew, y1); ctx.lineTo(x - skew, y1);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = LEAD; ctx.lineWidth = 5; ctx.stroke();
        x += cw;
      }
    }
    // 圆章（medallion）：叙事玻璃画的基本单元
    const medallions = 2 + Math.floor(rnd() * 2);
    for (let m = 0; m < medallions; m++) {
      const cy = h * (0.25 + m * 0.32), cx = w / 2, r0 = w * 0.3;
      ctx.beginPath(); ctx.arc(cx, cy, r0, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE[2]; ctx.fill();
      ctx.strokeStyle = LEAD; ctx.lineWidth = 8; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r0 * 0.62, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE[4]; ctx.fill();
      ctx.lineWidth = 5; ctx.stroke();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0 * 0.62, cy + Math.sin(a) * r0 * 0.62);
        ctx.lineTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 500; i++) ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
  });
}

// 玫瑰窗：中心花蕊 + 放射花瓣 + 外圈小圆窗，全部按圆周对称
function roseTexture(seed) {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    const rnd = mulberry32(seed);
    const cx = w / 2, cy = h / 2, R = w / 2;
    ctx.fillStyle = LEAD; ctx.fillRect(0, 0, w, h);
    const N = 12;
    // 外圈小圆窗
    for (let i = 0; i < N * 2; i++) {
      const a = (i / (N * 2)) * Math.PI * 2;
      const r = R * 0.88;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, R * 0.085, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE[i % 2 ? 0 : 2]; ctx.fill();
      ctx.strokeStyle = LEAD; ctx.lineWidth = 10; ctx.stroke();
    }
    // 花瓣（尖瓣形，用两段圆弧近似）
    for (let i = 0; i < N; i++) {
      const a = ((i + 0.5) / N) * Math.PI * 2;
      const r1 = R * 0.42, r2 = R * 0.74;
      const px = cx + Math.cos(a) * (r1 + r2) / 2, py = cy + Math.sin(a) * (r1 + r2) / 2;
      ctx.save();
      ctx.translate(px, py); ctx.rotate(a + Math.PI / 2);
      const L = (r2 - r1) / 2 + R * 0.06, W2 = R * 0.115;
      ctx.beginPath();
      ctx.moveTo(0, -L);
      ctx.quadraticCurveTo(W2 * 1.6, 0, 0, L);
      ctx.quadraticCurveTo(-W2 * 1.6, 0, 0, -L);
      ctx.fillStyle = PALETTE[[0, 2, 4, 3, 0, 6][i % 6]]; ctx.fill();
      ctx.strokeStyle = LEAD; ctx.lineWidth = 12; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, W2 * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE[4]; ctx.fill(); ctx.lineWidth = 7; ctx.stroke();
      ctx.restore();
    }
    // 中心花蕊
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE[1]; ctx.fill();
    ctx.strokeStyle = LEAD; ctx.lineWidth = 14; ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * R * 0.19, cy + Math.sin(a) * R * 0.19, R * 0.075, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE[i % 2 ? 2 : 4]; ctx.fill();
      ctx.lineWidth = 8; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.075, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE[7]; ctx.fill(); ctx.stroke();
    // 整体加一点玻璃颗粒感
    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
  });
}

export function makeGlassMaterials() {
  const mats = [];
  for (let i = 0; i < 4; i++) {
    mats.push(new THREE.MeshBasicMaterial({
      map: lancetGlassTexture(101 + i * 37),
      color: hasDOM ? '#ffffff' : '#26418f',
      side: THREE.DoubleSide,
      toneMapped: false,
    }));
  }
  const rose = new THREE.MeshBasicMaterial({
    map: roseTexture(9),
    color: hasDOM ? '#ffffff' : '#26418f',
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  return { lancets: mats, rose };
}
