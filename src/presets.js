// 名堂预设：用参数近似几座世界知名大教堂的"性格"——塔式、拱顶高、开间节奏。
// 是致意而非复刻：所有预设共享同一套哥特构件系统，差别全部落在参数上，
// 这本身就是哥特的真相——同一套结构语言，各城各唱各的调。

import { P, recomputeDerived } from './params.js';

const DEFAULTS = { ...P };

export const PRESETS = [
  {
    key: 'proto', name: '石头与光', desc: '本项目的原型设计',
    params: {},
    card: {
      dates: '2026 · 程序化生成',
      place: '此仓库 · Three.js',
      stats: ['拱顶 28.4 米', '尖塔 62 米', '网格约 1100 块'],
      story: '本项目的原型：一座"标准盛期哥特"教堂，比例参照亚眠与沙特尔。每一块石头都由代码按结构逻辑砌出——它存在的意义，是让下面这几位前辈可以被参数化地致意。',
    },
  },
  {
    key: 'notredame', name: '巴黎圣母院', desc: '平顶双塔，纤细的交叉部木尖塔',
    params: {
      naveBays: 7, vaultSpring: 20, arcK: 1.15,
      towerH: 44, towerSpires: false, flecheTop: 58,
      roseR: 5.2, roseY: 25,
    },
    card: {
      dates: '1163 动工 · 主体约 1250 年成',
      place: '巴黎 · 塞纳河西岱岛',
      stats: ['拱顶约 33 米', '平顶双塔 69 米', '飞扶壁在此走向成熟'],
      story: '早期哥特的里程碑：飞扶壁正是在这里发展成熟。标志性的平顶双塔从未加建尖锥，反而成就了它的剪影；细若桅杆的交叉部木尖塔是 19 世纪维奥莱-勒-杜克的重建，2019 年大火中坠落，2024 年底带着新塔重开——一座仍在被建造的教堂。',
    },
  },
  {
    key: 'chartres', name: '沙特尔', desc: '不对称双尖塔，一代人建成主体',
    params: {
      naveBays: 6, vaultSpring: 19, arcK: 1.3,
      towerH: 44, spireH: 22, towerAsym: true, flecheTop: 48,
    },
    card: {
      dates: '1194 大火后重建 · 约 26 年成',
      place: '法国沙特尔 · 朝圣重镇',
      stats: ['拱顶约 37 米', '南塔 105 米 / 北塔 113 米', '彩窗 170 余扇存世'],
      story: '1194 年大火烧掉旧堂，新堂以中世纪罕见的速度一代人建成——这就是为什么它风格如此统一。唯独双塔不对称：南塔是 12 世纪的朴素锥体，北塔的火焰式尖冠是 16 世纪补的。"沙特尔蓝"的钴蓝玻璃至今无人能完全复配。',
    },
  },
  {
    key: 'amiens', name: '亚眠', desc: '42 米级拱顶，盛期哥特教科书',
    params: {
      naveBays: 7, vaultSpring: 24, arcK: 1.4,
      towerH: 40, spireH: 10, flecheTop: 66,
    },
    card: {
      dates: '1220 动工 · 主体约 50 年成',
      place: '法国亚眠 · 皮卡第',
      stats: ['拱顶 42.3 米', '内部空间约 20 万立方米', '法国最大教堂'],
      story: '盛期哥特的教科书：总石匠罗贝尔·德·吕扎尔什把比例推到当时的极限，42.3 米的拱顶至今是完整保存的最高纪录。西立面的雕塑群被称作"亚眠圣经"——给不识字的人读的石头经文。再往上一步，就是博韦的坍塌。',
    },
  },
  {
    key: 'cologne', name: '科隆', desc: '巨型双尖塔，工期 632 年',
    params: {
      naveBays: 7, vaultSpring: 25, arcK: 1.45,
      towerH: 58, spireH: 32, flecheTop: 52,
    },
    card: {
      dates: '1248 动工 · 1560 停工 · 1880 完工',
      place: '德国科隆 · 莱茵河畔',
      stats: ['双塔 157 米', '工期 632 年', '完工时世界最高建筑'],
      story: '为安放三王圣髑而起，1560 年财力耗尽停工，未完的南塔上那台中世纪木吊车悬了三百年，成了城市天际线的一部分。19 世纪人们找回 1280 年的原设计图纸，严格按图完工——动工时的石匠与完工时的工程师，隔着 632 年共用一张图。',
    },
  },
];

export function applyPreset(preset) {
  Object.assign(P, DEFAULTS, preset.params);
  recomputeDerived();
}
