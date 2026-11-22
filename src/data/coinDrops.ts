/**
 * 钱币掉落（草案，未接入游戏；2026-11-21 用户：「拾取钱币音效 + 动画飞进行囊」「不要每个小怪都掉，越厉害的越多，兼顾前后期」
 * 「钱币总收入你来决定」→ 总制作人定：总收入保持与现在 main 一样，只改掉落方式和观感）。设计见共享笔记 coin-drops.md。
 *
 * - 钱币 = 原「随军粮」（legion.food，界面改名中）。经验掉落规则与数值完全不动（照旧每个敌人掉、照旧要捡，只换成青玉军功符的样子），钱币是另一种掉落物。
 * - 取代 main 的击杀记账 Legion.onKill（杂兵 +1、精锐 +5、首领 +20，每杀必得、看不见）：改成按概率掉、每枚面值更高，**期望与原来对齐**，没有章节倍率（原来就没有）。
 * - 其他来源（粮袋、粮车、军资卡、押粮卒、8 精锐奖励、守城波次、城中市集）全部不动。
 * - 面值带小数，实现时每场一个余数累积：显示与入账取整，小数攒到下一枚。
 * - 首领阶段防刷：与随军粮同一套（data/bossStall killGrant）——额度用完（GRANT_OVER.food = false）普通兵不掉钱币、保底也不计数；首领 / 副将照掉。
 */
export type CoinKind = 'fodder' | 'infantry' | 'shield' | 'archer' | 'cavalry' | 'special' | 'elite' | 'boss';

/**
 * 每类敌人：掉落概率 chance、每杀期望 expect（与 main 的 1 / 5 / 20 对齐）、分几堆撒 piles（只影响表现）。
 * 每次掉落的总面值 = expect ÷ chance × PITY_COMP（见 coinValue）。普通兵按「越强越多」分档，典型兵种比例下平均约每杀 1。
 */
export const COIN_DROP: Readonly<Record<CoinKind, { chance: number; expect: number; piles: number }>> = {
  /** 流民等成群的炮灰（enemyRoster role fodder） */
  fodder: { chance: .10, expect: .45, piles: 1 },
  infantry: { chance: .18, expect: 1, piles: 1 },
  shield: { chance: .22, expect: 1.1, piles: 1 },
  archer: { chance: .22, expect: 1.1, piles: 1 },
  cavalry: { chance: .25, expect: 1.25, piles: 1 },
  /** 带特性的兵（符水道徒、力士、祭酒……enemyRoster 里 role 不是 fodder 的特性兵） */
  special: { chance: .30, expect: 1.6, piles: 1 },
  /** 精锐（副将在 main 里也按精锐入账，同此） */
  elite: { chance: 1, expect: 5, piles: 1 },
  /** 首领（章中 / 章末 / 双首领各自一样，与 main 的 +20 对齐） */
  boss: { chance: 1, expect: 20, piles: 4 },
};

/** 保底：普通兵连续 misses 个没掉，下一个必掉（刀兵连续 15 个不掉的概率约 5%）。 */
export const COIN_PITY = { misses: 15 } as const;
/** 保底会让期望多出约 2.5%（模拟 4000 局），面值乘这个系数抵掉，使期望与 main 对齐。 */
export const PITY_COMP = .975;

/** 某类敌人一次掉落的总面值（带小数；实现时每场余数累积）。 */
export function coinValue(kind: CoinKind): number { const d = COIN_DROP[kind]; return d.expect / d.chance * (d.chance < 1 ? PITY_COMP : 1); }

/**
 * 拾取：和经验军功符共用同一个吸取范围（主将拾取范围 × 磁石类加成）与吸取手感（data/gemFx）；钱币落地后 lifeMs 不捡就自动飞进行囊。
 * 对象池：钱币用自己的池（cap），不和经验的 GEM_FX.cap 200 抢——经验堆满时钱币照样能生成；降级阈值按两种掉落物合计算（liteAbove）。
 */
export const COIN_PICKUP = { lifeMs: 12000, cap: 60, liteAbove: 140 } as const;
