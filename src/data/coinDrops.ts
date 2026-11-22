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
export const COIN_DROP: Readonly<Record<CoinKind, { chance: number; expect: number; piles: number; noPity?: boolean }>> = {
  /**
   * 流民等成群的炮灰（enemyRoster role fodder）。noPity：不参与保底——既不累计计数、也不触发，面值不乘 PITY_COMP（= 4.5）。
   * 2026-11-22 平衡（coin-drops.md 8.1）：掉率只有 10%，计入保底时纯流民每杀期望 ×1.195，不计入后 ×1.003、1-1 混合 ×1.008。
   */
  fodder: { chance: .10, expect: .45, piles: 1, noPity: true },
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
export function coinValue(kind: CoinKind): number { const d = COIN_DROP[kind]; return d.expect / d.chance * (d.chance < 1 && !d.noPity ? PITY_COMP : 1); }

/**
 * 拾取：和经验军功符共用同一个吸取范围（主将拾取范围 × 磁石类加成）与吸取手感（data/gemFx）；钱币落地后 lifeMs 不捡就自动飞进行囊。
 * 对象池：钱币用自己的池（cap），不和经验的 GEM_FX.cap 200 抢——经验堆满时钱币照样能生成；降级阈值按两种掉落物合计算（liteAbove）。
 */
export const COIN_PICKUP = { lifeMs: 12000, cap: 60, liteAbove: 140 } as const;

// ───────────── 接入游戏（2026-11-21，系统实现；上面的数值表归平衡会话） ─────────────
/**
 * （2026-11-22 按平衡会话 coin-drops.md 第 8 节：上面的表给流民加了 noPity；第一章试验数值的钱币表在 data/ch1Trial CH1V6.coins。）
 * 总开关：默认开。关着时回到「击杀直接入账」（Legion.onKill：杂兵 +1、精锐 +5、首领 +20），和接入前完全一样，方便平衡对照。
 * 开发构建网址带 ?coinDrops=0 关掉（正式构建里网址不生效）；测试 / 模拟器用 setCoinDrops(false / true)，setCoinDrops(null) 还给默认。
 */
export const COIN_DROPS_DEFAULT = true;
let forced: boolean | null = null;
const urlOff: boolean = (() => {
  if (!import.meta.env?.DEV) return false; // 纯 node 测试里没有 import.meta.env
  try { return new URLSearchParams(window.location.search).get('coinDrops') === '0'; } catch { return false; }
})();
export function coinDropsOn(): boolean { return forced ?? (urlOff ? false : COIN_DROPS_DEFAULT); }
export function setCoinDrops(on: boolean | null): void { forced = on; }

/**
 * 敌人归哪一档：首领 / 精锐（副将也是精锐）按兵种；配了特性的兵（data/enemyRoster，def.roster）看 role——
 * 'fodder'（流民一类成群的炮灰）算炮灰档；'pack' / 'swim'（兽群、水卒：只是普通兵的变体）按它的基础兵种；其余 role 都算特性兵。
 * 没配特性的普通兵按基础兵种（刀兵 / 刀盾 / 弓手 / 骑兵）。
 */
export function coinKindOf(kind: string, role?: string): CoinKind {
  if (kind === 'boss' || kind === 'elite') return kind;
  if (role === 'fodder') return 'fodder';
  if (role && role !== 'pack' && role !== 'swim') return 'special';
  return kind === 'shield' || kind === 'archer' || kind === 'cavalry' ? kind : 'infantry';
}

/**
 * 一场战斗的掉落判定（纯逻辑，不碰画面）：保底计数 + 面值小数的余数累积。
 * roll(kind) 返回这次掉几堆、每堆多少（整数）；不掉返回 null。面值的小数部分留在 carry 里攒到下一次，所以长期总额 = 面值之和，没有取整偏差。
 * 首领阶段额度用完时调用方根本不调 roll（普通兵不掉、保底也不计数），首领 / 副将照常调。
 * tune（可选）：试验数值用的改写（data/ch1Trial CH1V6.coins）——普通兵面值 × minionMul，精锐必掉 elite，首领必掉 boss、分 bossPiles 堆；掉率、分档、保底不变。
 */
export interface CoinTune { minionMul: number; elite: number; boss: number; bossPiles: number }
export class CoinRoller {
  /** 普通兵连续没掉的个数（保底用）；carry = 还没发出去的小数。 */
  misses = 0; carry = 0;
  /** 统计（平衡 / 测试用）：判定次数、掉落次数、其中保底触发的次数、掉出的总额。 */
  readonly stats = { rolls: 0, drops: 0, pity: 0, total: 0 };
  roll(kind: CoinKind, rnd: () => number = Math.random, tune?: CoinTune): number[] | null {
    const d = COIN_DROP[kind]; this.stats.rolls++;
    if (d.noPity) { if (rnd() >= d.chance) return null; } // 流民：单纯按掉率，不碰保底计数
    else if (d.chance < 1) {
      const pity = this.misses >= COIN_PITY.misses;
      if (!pity && rnd() >= d.chance) { this.misses++; return null; }
      this.misses = 0; if (pity) this.stats.pity++;
    }
    const face = !tune ? coinValue(kind) : kind === 'boss' ? tune.boss : kind === 'elite' ? tune.elite : coinValue(kind) * tune.minionMul;
    const v = face + this.carry, n = Math.floor(v + 1e-9); this.carry = v - n;
    this.stats.drops++; this.stats.total += n;
    if (n <= 0) return null;
    const piles = Math.max(1, Math.min(tune && kind === 'boss' ? tune.bossPiles : d.piles, n)), each = Math.floor(n / piles), out = Array.from({ length: piles }, () => each);
    for (let i = 0; i < n - each * piles; i++) out[i]++;
    return out;
  }
}
