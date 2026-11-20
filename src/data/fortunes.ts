import type { PlayerStats } from '../types';

/**
 * 战场机缘（wave-progression-redesign.md §2.1b，2026-11-19 用户批准「可以加入战场机缘」）：
 * 每关 2 次关内事件，做完弹一次「本关有效」的三选一。增益只改本关：记在 player.stageDelta，征程构筑存档时扣掉（CharmEffects.statsWithoutCharms），
 * 战线推进到下一关时撤销。数值是初值，交平衡会话复核。
 */
export type FortuneEventKind = 'cart' | 'rescue' | 'defector' | 'beacon';
export const FORTUNE = {
  /** 第 1 次：精锐段开始后多少秒出现粮车；第 2 次：事件段开始后多少秒出现本关事件。 */
  cartDelay: 20, eventDelay: 8,
  /** 离主将的距离（地图像素）。 */
  distance: [240, 320] as readonly [number, number],
  /** 互动圈半径；站满秒数（粮车 / 烽火）。 */
  radius: 70, holdSec: 3,
  /** 没去理会：多少秒后消失（「机缘已失」）。 */
  lifeSec: 40,
  /** 粮车守卫 / 被围义军外的敌兵数。 */
  cartGuards: 3, rescueGuards: 6,
  /** 解救义军：随你冲阵的人数与时长。 */
  rescueEscort: 5, rescueEscortMs: 30000,
  /** 同一张增益本关最多拿几次。 */
  maxSame: 2,
} as const;

export const FORTUNE_EVENT: Record<FortuneEventKind, { name: string; hint: string; done: string }> = {
  cart: { name: '敌军粮车', hint: '站进圈里 3 秒夺下粮车', done: '夺下粮车' },
  rescue: { name: '义军被围', hint: '击退围困的敌兵', done: '义军脱困 · 随你冲阵' },
  defector: { name: '降将来投', hint: '走到他身边受降', done: '受降' },
  beacon: { name: '烽燧', hint: '站进圈里 3 秒点燃烽火', done: '烽火燃起' },
};

export interface FortuneBuff {
  id: string; name: string; desc: string; /** 卡面图标（升级图标 growth_icon_*）。 */ icon: string;
  /** 改本关属性（返回后由场景记下差值，好在关末撤销）。 */
  apply: (s: PlayerStats, maxHp: number) => void;
  /** 选完立即生效的额外效果（回血等，不需撤销）。 */
  now?: 'heal15';
}
export const FORTUNE_BUFFS: readonly FortuneBuff[] = [
  // 2026-11-19 三选一文案审校：卡底徽记已写「本关有效」，说明里不再重复「本关」；与保底卡「固本培元」、战法「鹰眼」重名的两张改名（养精蓄锐、洞察）
  { id: 'f_morale', icon: 'growth_icon_might', name: '士气如虹', desc: '伤害 +15%', apply: s => { s.damageMul *= 1.15; } },
  { id: 'f_swift', icon: 'growth_icon_wind_boots', name: '疾行', desc: '移速 +12%\n拾取范围 +40%', apply: s => { s.moveMul *= 1.12; s.pickupRadius *= 1.4; } },
  { id: 'f_vigor', icon: 'growth_icon_constitution', name: '养精蓄锐', desc: '生命上限 +15%\n立即回复 15% 生命', apply: (s, hp) => { s.maxHpBonus += Math.round(hp * .15); }, now: 'heal15' },
  { id: 'f_fire', icon: 'growth_icon_wildfire', name: '火攻之机', desc: '火焰伤害 +25%\n火焰范围 +15%', apply: s => { s.fireMul *= 1.25; s.fireAreaMul *= 1.15; } },
  { id: 'f_orders', icon: 'growth_icon_quickness', name: '军令如山', desc: '武器冷却 −10%', apply: s => { s.cooldownMul *= .9; } },
  { id: 'f_armor', icon: 'growth_icon_heart_mirror', name: '披坚', desc: '受到伤害 −12%', apply: s => { s.damageTakenMul *= .88; } },
  { id: 'f_eagle', icon: 'growth_icon_critical', name: '洞察', desc: '暴击率 +8%', apply: s => { s.critChance += .08; } },
];
/** 从可选的增益里抽 3 张不同的（同一张本关已拿满 maxSame 次的不出）。 */
export function rollFortuneBuffs(taken: Readonly<Record<string, number>>, rnd: () => number = Math.random): FortuneBuff[] {
  const pool = FORTUNE_BUFFS.filter(b => (taken[b.id] ?? 0) < FORTUNE.maxSame).map(b => ({ b, k: rnd() }));
  return pool.sort((x, y) => x.k - y.k).slice(0, 3).map(x => x.b);
}
/** 第 2 次机缘（事件段）从这几种里随机。 */
export const EVENT_FORTUNES: readonly FortuneEventKind[] = ['rescue', 'defector', 'beacon'];
