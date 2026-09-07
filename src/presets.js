// 名堂预设：用参数近似几座世界知名大教堂的"性格"——塔式、拱顶高、开间节奏。
// 是致意而非复刻：所有预设共享同一套哥特构件系统，差别全部落在参数上，
// 这本身就是哥特的真相——同一套结构语言，各城各唱各的调。

import { P, recomputeDerived } from './params.js';

const DEFAULTS = { ...P };

export const PRESETS = [
  {
    key: 'proto', name: '石头与光', desc: '本项目的原型设计',
    params: {},
  },
  {
    key: 'notredame', name: '巴黎圣母院', desc: '平顶双塔，纤细的交叉部木尖塔',
    params: {
      naveBays: 7, vaultSpring: 20, arcK: 1.15,
      towerH: 44, towerSpires: false, flecheTop: 58,
      roseR: 5.2, roseY: 25,
    },
  },
  {
    key: 'chartres', name: '沙特尔', desc: '不对称双尖塔，一代人建成主体',
    params: {
      naveBays: 6, vaultSpring: 19, arcK: 1.3,
      towerH: 44, spireH: 22, towerAsym: true, flecheTop: 48,
    },
  },
  {
    key: 'amiens', name: '亚眠', desc: '42 米级拱顶，盛期哥特教科书',
    params: {
      naveBays: 7, vaultSpring: 24, arcK: 1.4,
      towerH: 40, spireH: 10, flecheTop: 66,
    },
  },
  {
    key: 'cologne', name: '科隆', desc: '巨型双尖塔，工期 632 年',
    params: {
      naveBays: 7, vaultSpring: 25, arcK: 1.45,
      towerH: 58, spireH: 32, flecheTop: 52,
    },
  },
];

export function applyPreset(preset) {
  Object.assign(P, DEFAULTS, preset.params);
  recomputeDerived();
}
