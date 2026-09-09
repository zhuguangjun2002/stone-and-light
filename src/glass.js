// 彩色玻璃：Canvas 现画铅条镶嵌图案。
//
// 真彩窗是**半透明的滤光片**，不是不透明也不是透明：本体着色（pot metal）的玻璃
// 让光穿过来变成颜色，但看不清窗外。窗面上的深色也不只是铅条——还有烧结上去的
// 玻璃颜料（浓的画轮廓线，稀的刷阴影），以及比铅条粗得多的铁横档（armature）。
// 用不发光材质（MeshBasicMaterial）模拟"玻璃自己亮"：昏暗室内里窗子如同发光体，
// 正是哥特室内的观感。
//
// 两套镶玻方案（GLAZING），差别落在"图案密度"和"透光率"两件事上：
//   chartres 12–13 世纪：叙事圆章 + 密铅条 + 深蓝深红，透光率低——室内很暗，
//            光是墙上的一批宝石，彩色几乎落不到石头上。
//   late     14–16 世纪：白地 grisaille 菱形网 + 银黄（银盐烧出的黄）+ 少量彩边，
//            铅条疏、透光率高——室内明亮，看得清结构。
// transmit / tint 两个字段是给顶点色烘焙（tools/bake.js）用的：石头被窗子染成什么色。

import * as THREE from '../lib/three.module.js';
import { canvasTexture, mulberry32, hasDOM } from './materials.js';

export const GLAZING = {
  chartres: {
    name: '沙特尔式 · 12–13 世纪',
    palette: ['#12307a', '#1b3d8f', '#7e1220', '#a31d2b', '#b8891a', '#15603a', '#4d2470', '#aebfdd'],
    lead: '#0e0a06', leadHi: '#4a4238', leadW: 5,
    rows: 14, quarry: false, medallions: true, bars: 3,
    transmit: 0.35, tint: '#3f57a8', flat: '#26418f',
  },
  late: {
    name: '晚期银黄式 · 14–16 世纪',
    palette: ['#e9e7d6', '#dfdcc4', '#f0e4ae', '#d9c877', '#c3ab55', '#9fb59a', '#b6c6d8', '#8f5f2a'],
    lead: '#2b2318', leadHi: '#6b6152', leadW: 3,
    rows: 9, quarry: true, medallions: false, bars: 2,
    transmit: 0.75, tint: '#e6dcb2', flat: '#cfc79e',
  },
};

// 铅条：H 型断面，受光的一侧会亮起来——先描一道深的，再压一道细的浅色芯
function lead(ctx, g, w) {
  ctx.strokeStyle = g.lead; ctx.lineWidth = w; ctx.stroke();
  ctx.strokeStyle = g.leadHi; ctx.lineWidth = Math.max(1, w * 0.3); ctx.stroke();
}
// 玻璃颜料的轮廓线：烧在玻璃上的铁锈色，半遮光
function trace(ctx, x0, y0, x1, y1, a = 0.55) {
  ctx.strokeStyle = `rgba(30,18,10,${a})`;
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}
// pot metal 的不匀：条纹、气泡、浓淡——中世纪玻璃厚薄不均，颜色是"活"的
function pot(ctx, w, h, rnd, n = 900) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h;
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(x, y, 1 + rnd() * 3, 1 + rnd() * 2);
  }
}
// 铁横档（armature / saddle bar）：整扇窗横向的铁条，比铅条粗得多，纯黑
function armature(ctx, w, h, n) {
  ctx.fillStyle = 'rgba(8,6,4,0.92)';
  for (let i = 1; i <= n; i++) ctx.fillRect(0, (i / (n + 1)) * h - 3, w, 6);
}

// 柳叶窗
function lancetGlassTexture(seed, g) {
  return canvasTexture(256, 512, (ctx, w, h) => {
    const rnd = mulberry32(seed);
    const pick = () => g.palette[Math.floor(rnd() * g.palette.length)];
    ctx.fillStyle = g.palette[0]; ctx.fillRect(0, 0, w, h);

    if (g.quarry) {
      // 白地菱形网（quarry）：晚期窗的底子，叶饰是画上去的，不是拼出来的
      const s = w / 3.2;
      for (let r = -1; r * s < h + s; r++) {
        for (let c = -1; c * s < w + s; c++) {
          const x = c * s + (r % 2 ? s / 2 : 0), y = r * s * 0.72;
          ctx.beginPath();
          ctx.moveTo(x, y - s * 0.36); ctx.lineTo(x + s / 2, y);
          ctx.lineTo(x, y + s * 0.36); ctx.lineTo(x - s / 2, y);
          ctx.closePath();
          ctx.fillStyle = g.palette[rnd() < 0.82 ? (rnd() < 0.5 ? 0 : 1) : 5];
          ctx.fill(); lead(ctx, g, g.leadW);
          // 画上去的叶饰
          if (rnd() < 0.55) {
            trace(ctx, x - s * 0.18, y, x + s * 0.18, y - s * 0.12, 0.35);
            trace(ctx, x, y - s * 0.16, x, y + s * 0.16, 0.3);
          }
        }
      }
      // 银黄边饰（银盐涂在玻璃外侧烧出来的黄，不用另配黄玻璃）
      for (const bx of [0, w - w * 0.16]) {
        ctx.fillStyle = g.palette[2]; ctx.fillRect(bx, 0, w * 0.16, h);
        for (let y = 0; y < h; y += 26) {
          ctx.beginPath(); ctx.rect(bx, y, w * 0.16, 26);
          ctx.fillStyle = g.palette[y % 52 ? 2 : 3]; ctx.fill(); lead(ctx, g, g.leadW);
        }
      }
      // 中段一枚小彩色圆章，剩下全是白地——晚期窗的典型配比
      const cy = h * 0.42, cx = w / 2, r0 = w * 0.26;
      ctx.beginPath(); ctx.arc(cx, cy, r0, 0, Math.PI * 2);
      ctx.fillStyle = g.palette[7]; ctx.fill(); lead(ctx, g, g.leadW + 2);
      ctx.beginPath(); ctx.arc(cx, cy, r0 * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = g.palette[3]; ctx.fill(); lead(ctx, g, g.leadW);
    } else {
      // 叙事窗：不规则小格拼出底子
      for (let r = 0; r < g.rows; r++) {
        const y0 = (r / g.rows) * h, y1 = ((r + 1) / g.rows) * h;
        let x = 0;
        while (x < w) {
          const cw = 24 + rnd() * 40, skew = (rnd() - 0.5) * 14;
          ctx.beginPath();
          ctx.moveTo(x, y0); ctx.lineTo(x + cw + skew, y0);
          ctx.lineTo(x + cw - skew, y1); ctx.lineTo(x - skew, y1);
          ctx.closePath();
          ctx.fillStyle = pick(); ctx.fill(); lead(ctx, g, g.leadW);
          x += cw;
        }
      }
      // 圆章（medallion）：叙事玻璃画的基本单元，里面用颜料画人物
      const n = 2 + Math.floor(rnd() * 2);
      for (let m = 0; m < n; m++) {
        const cy = h * (0.25 + m * 0.32), cx = w / 2, r0 = w * 0.3;
        ctx.beginPath(); ctx.arc(cx, cy, r0, 0, Math.PI * 2);
        ctx.fillStyle = g.palette[2]; ctx.fill(); lead(ctx, g, g.leadW + 3);
        ctx.beginPath(); ctx.arc(cx, cy, r0 * 0.62, 0, Math.PI * 2);
        ctx.fillStyle = g.palette[4]; ctx.fill(); lead(ctx, g, g.leadW);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r0 * 0.62, cy + Math.sin(a) * r0 * 0.62);
          ctx.lineTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
          lead(ctx, g, g.leadW - 1);
        }
        // 圆章里的人物：三笔轮廓线，远看就是"里面有画"
        trace(ctx, cx, cy - r0 * 0.4, cx, cy + r0 * 0.35);
        trace(ctx, cx - r0 * 0.22, cy - r0 * 0.1, cx + r0 * 0.22, cy - r0 * 0.1);
        trace(ctx, cx - r0 * 0.18, cy + r0 * 0.3, cx + r0 * 0.18, cy + r0 * 0.3);
      }
    }
    armature(ctx, w, h, g.bars);
    pot(ctx, w, h, rnd);
  });
}

// 玫瑰窗：中心花蕊 + 放射花瓣 + 外圈小圆窗，全部按圆周对称
function roseTexture(seed, g) {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    const rnd = mulberry32(seed);
    const cx = w / 2, cy = h / 2, R = w / 2;
    ctx.fillStyle = g.lead; ctx.fillRect(0, 0, w, h);
    const N = 12;
    for (let i = 0; i < N * 2; i++) {                 // 外圈小圆窗
      const a = (i / (N * 2)) * Math.PI * 2, r = R * 0.88;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, R * 0.085, 0, Math.PI * 2);
      ctx.fillStyle = g.palette[i % 2 ? 0 : 2]; ctx.fill(); lead(ctx, g, 10);
    }
    for (let i = 0; i < N; i++) {                     // 花瓣
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
      ctx.fillStyle = g.palette[[0, 2, 4, 3, 0, 6][i % 6]]; ctx.fill(); lead(ctx, g, 12);
      ctx.beginPath(); ctx.arc(0, 0, W2 * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = g.palette[4]; ctx.fill(); lead(ctx, g, 7);
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.3, 0, Math.PI * 2);   // 中心花蕊
    ctx.fillStyle = g.palette[1]; ctx.fill(); lead(ctx, g, 14);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * R * 0.19, cy + Math.sin(a) * R * 0.19, R * 0.075, 0, Math.PI * 2);
      ctx.fillStyle = g.palette[i % 2 ? 2 : 4]; ctx.fill(); lead(ctx, g, 8);
    }
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.075, 0, Math.PI * 2);
    ctx.fillStyle = g.palette[7]; ctx.fill(); lead(ctx, g, 6);
    pot(ctx, w, h, rnd, 1800);
  });
}

export function makeGlassMaterials(style = 'chartres') {
  const g = GLAZING[style] ?? GLAZING.chartres;
  const mats = [];
  for (let i = 0; i < 4; i++) {
    mats.push(new THREE.MeshBasicMaterial({
      map: lancetGlassTexture(101 + i * 37, g),
      color: hasDOM ? '#ffffff' : g.flat,          // 无 DOM（node 里跑测试）时退成平色
      side: THREE.DoubleSide,
      toneMapped: false,
    }));
  }
  const rose = new THREE.MeshBasicMaterial({
    map: roseTexture(9, g),
    color: hasDOM ? '#ffffff' : g.flat,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  for (const m of [...mats, rose]) m.userData.glazing = style;   // 烘焙时要认出"这是玻璃"
  return { lancets: mats, rose, style: g };
}
