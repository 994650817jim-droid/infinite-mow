import type { AttributeId } from './attributes';
import type { CharacterId } from './characters';

/**
 * 武将四维「本色值」与等效点（2026-11-20 用户批准 attribute-redesign.md：「可以开工」；数值是初值，交平衡会话校准）：
 * 每位武将自带 力量 / 敏捷 / 智力 / 统御（0–100 量级），本色折算成「等效点」，加点在其上继续叠加，单项没有上限，靠分段折扣防爆炸。
 *   本色成长  B(lv) = B0 + GROWTH_PER_LEVEL × (lv − 1) × 倾向权重       （每级自动，不占点数、不被洗点）
 *   等效点    e     = 加点数 p + max(0, B(lv) − STAT_NEUTRAL) ÷ STAT_DIV
 *   折扣后    g(e)  = e（≤10）｜10 + 0.5(e−10)（10–20）｜15 + 0.25(e−20)（>20）
 *   实际效果 = 倍率 × g(e) × 每点效果        倍率：本色 ≥90 擅长 ×1.25；75–89 熟练 ×1.1；其余 ×1
 */
export const STAT_NEUTRAL = 45, STAT_DIV = 12, GROWTH_PER_LEVEL = .6;
export const STAT_DISCOUNT = [{ upTo: 10, slope: 1 }, { upTo: 20, slope: .5 }, { upTo: Infinity, slope: .25 }] as const;
export const STAT_MASTER = { expert: 90, expertMul: 1.25, skilled: 75, skilledMul: 1.1 } as const;
/** 四维顺序：力 / 敏 / 智 / 统。 */
export const STAT_ORDER: readonly AttributeId[] = ['strength', 'agility', 'intellect', 'command'];
export type Stat4 = readonly [number, number, number, number];

/** 十七位可玩武将本色（力 / 敏 / 智 / 统）与每级成长权重（四项，合计 1）。 */
export const HERO_STATS: Record<CharacterId, { base: Stat4; growth: Stat4 }> = {
  guanyu: { base: [97, 72, 75, 92], growth: [.5, .2, 0, .3] },
  zhangfei: { base: [98, 70, 30, 80], growth: [.5, .2, 0, .3] },
  zhaoyun: { base: [96, 95, 76, 91], growth: [.3, .4, 0, .3] },
  machao: { base: [97, 93, 42, 80], growth: [.4, .4, 0, .2] },
  huangzhong: { base: [93, 70, 55, 82], growth: [.4, .4, 0, .2] },
  weiyan: { base: [90, 78, 62, 84], growth: [.5, .2, 0, .3] },
  zhuge: { base: [38, 60, 100, 95], growth: [0, .2, .5, .3] },
  pangtong: { base: [34, 55, 98, 70], growth: [0, .2, .6, .2] },
  huangyueying: { base: [30, 62, 92, 55], growth: [0, .2, .6, .2] },
  liubei: { base: [70, 65, 78, 98], growth: [.2, 0, .2, .6] },
  sunshangxiang: { base: [74, 90, 65, 60], growth: [.3, .5, .2, 0] },
  diaochan: { base: [20, 72, 88, 50], growth: [0, .3, .5, .2] },
  lvbu: { base: [100, 88, 30, 55], growth: [.6, .3, 0, .1] },
  zhangliao: { base: [94, 88, 78, 92], growth: [.3, .4, 0, .3] },
  zhouyu: { base: [66, 72, 96, 98], growth: [0, .2, .5, .3] },
  taishici: { base: [95, 86, 64, 82], growth: [.4, .4, 0, .2] },
  mengde: { base: [72, 70, 95, 100], growth: [.2, 0, .3, .5] },
};

/** 无名随从模板底子（力 / 敏 / 智 / 统）与成长权重；品质加成：白 +0 / 蓝 +6 / 紫 +12（四项）。 */
export const TEMPLATE_STATS: Record<string, { base: Stat4; growth: Stat4 }> = {
  spear: { base: [52, 48, 36, 46], growth: [.5, .2, 0, .3] },
  blade: { base: [56, 46, 34, 44], growth: [.6, .2, 0, .2] },
  bow: { base: [44, 54, 40, 40], growth: [.2, .6, .2, 0] },
  strategist: { base: [34, 46, 56, 44], growth: [0, .2, .6, .2] },
};
export const QUALITY_STAT_BONUS: Record<string, number> = { white: 0, blue: 6, purple: 12 };

/** 史事名将（名将悬赏名单，只能跟随）：名字 → 本色（力 / 敏 / 智 / 统）；成长权重按最高两项自动生成。 */
export const GENERAL_STATS: Record<string, Stat4> = {
  郭汜: [80, 62, 40, 62], 樊稠: [84, 60, 38, 66], 牛辅: [60, 50, 45, 62], 胡轸: [72, 58, 35, 58],
  张郃: [88, 80, 76, 88], 高览: [84, 62, 45, 70], 鞠义: [86, 64, 60, 86], 蒋奇: [65, 55, 40, 55],
  许褚: [98, 70, 32, 72], 典韦: [98, 66, 28, 70], 夏侯惇: [92, 68, 50, 86], 乐进: [88, 76, 48, 80],
  纪灵: [88, 62, 42, 74], 桥蕤: [70, 55, 40, 62], 雷薄: [68, 56, 38, 60], 陈兰: [66, 56, 40, 58],
  严纲: [74, 58, 40, 62], 田楷: [66, 56, 50, 64], 单经: [62, 56, 50, 58],
  曹豹: [66, 54, 42, 60], 臧霸: [82, 72, 60, 80], 笮融: [50, 50, 62, 66],
  黄祖: [66, 52, 48, 66], 文聘: [82, 66, 60, 84], 王威: [58, 50, 50, 54],
  程普: [82, 62, 68, 88], 黄盖: [84, 56, 66, 78], 韩当: [80, 62, 48, 74],
  庞德: [94, 76, 52, 82], 阎行: [88, 72, 46, 70], 马岱: [80, 76, 50, 70],
  张任: [86, 72, 70, 84], 严颜: [84, 54, 62, 86], 冷苞: [72, 60, 40, 60],
  杨任: [74, 58, 42, 62], 杨昂: [74, 60, 42, 62], 张卫: [70, 56, 45, 58],
  孟获: [92, 62, 28, 86], 祝融: [82, 85, 50, 70],
};
export const GENERIC_STATS: Stat4 = [56, 50, 40, 46];

/** 按最高两项（6:4）生成成长权重。 */
export function growthFromBase(b: Stat4): Stat4 {
  const order = [0, 1, 2, 3].sort((x, y) => b[y] - b[x]), w = [0, 0, 0, 0]; w[order[0]] = .6; w[order[1]] = .4; return w as unknown as Stat4;
}
export interface StatSource { base: Stat4; growth: Stat4 }
/** 谁的四维：可玩武将 id / 模板名 / 史事名将名；查不到返回通用值。 */
export function statSource(key: string, opts: { quality?: string } = {}): StatSource {
  const h = (HERO_STATS as Record<string, StatSource>)[key]; if (h) return h;
  const g = GENERAL_STATS[key]; if (g) return { base: g, growth: growthFromBase(g) };
  const t = TEMPLATE_STATS[key]; if (t) { const q = QUALITY_STAT_BONUS[opts.quality ?? 'white'] ?? 0; return { base: t.base.map(v => v + q) as unknown as Stat4, growth: t.growth }; }
  return { base: GENERIC_STATS, growth: growthFromBase(GENERIC_STATS) };
}

const idx = (id: AttributeId): number => STAT_ORDER.indexOf(id);
/** 当前等级的本色值（含每级自动成长）。 */
export function baseStat(src: StatSource, id: AttributeId, level: number): number {
  const i = idx(id); return src.base[i] + GROWTH_PER_LEVEL * Math.max(0, Math.floor(level) - 1) * src.growth[i];
}
/** 分段折扣。 */
export function discount(e: number): number {
  let out = 0, from = 0;
  for (const s of STAT_DISCOUNT) { if (e <= from) break; out += (Math.min(e, s.upTo) - from) * s.slope; from = s.upTo; }
  return out;
}
/** 本色折算的等效点（不含加点）。 */
export function baseEquiv(src: StatSource, id: AttributeId, level: number): number { return Math.max(0, baseStat(src, id, level) - STAT_NEUTRAL) / STAT_DIV; }
/** 擅长（本色 ≥90）/ 熟练（≥75）倍率，按 Lv1 本色判定（成长不改称号）。 */
export function statMultiplier(src: StatSource, id: AttributeId): number {
  const b = src.base[idx(id)]; return b >= STAT_MASTER.expert ? STAT_MASTER.expertMul : b >= STAT_MASTER.skilled ? STAT_MASTER.skilledMul : 1;
}
export function statTag(src: StatSource, id: AttributeId): '擅' | '熟' | '' {
  const b = src.base[idx(id)]; return b >= STAT_MASTER.expert ? '擅' : b >= STAT_MASTER.skilled ? '熟' : '';
}
/** 等效点（未折扣）与折扣后的生效点数。 */
export function statEquiv(src: StatSource, id: AttributeId, points: number, level: number): number { return Math.max(0, points) + baseEquiv(src, id, level); }
export function statEffective(src: StatSource, id: AttributeId, points: number, level: number): number {
  return statMultiplier(src, id) * discount(statEquiv(src, id, points, level));
}
