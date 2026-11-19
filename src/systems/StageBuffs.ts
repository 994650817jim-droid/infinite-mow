import type { PlayerStats } from '../types';

/**
 * 本关有效的增益（战场机缘，wave-progression-redesign.md §2.1b）：记下每次改了 player.stats 多少，
 * 关末 / 战线推进时撤销；征程构筑存档（statsWithoutCharms）时扣掉，不会带到下一关。
 * 倍率类按「乘了多少」记、加法类按「加了多少」记（同信物 CharmEffects 的做法）。
 */
const MUL: ReadonlyArray<keyof PlayerStats> = ['damageMul', 'cooldownMul', 'moveMul', 'pickupRadius', 'meleeMul', 'arrowMul', 'fireMul', 'fireAreaMul', 'damageTakenMul'];
const ADD: ReadonlyArray<keyof PlayerStats> = ['critChance', 'regen', 'armor', 'maxHpBonus'];
interface Delta { mul: Partial<Record<keyof PlayerStats, number>>; add: Partial<Record<keyof PlayerStats, number>> }
const DELTAS = new WeakMap<object, Delta>();

/** 对 holder.stats 执行 fn，并记下差值。 */
export function applyStageBuff(holder: { stats: PlayerStats }, fn: (s: PlayerStats) => void): void {
  const before = { ...holder.stats }; fn(holder.stats);
  const d = DELTAS.get(holder) ?? { mul: {}, add: {} };
  for (const k of MUL) if (holder.stats[k] !== before[k] && before[k] !== 0) d.mul[k] = (d.mul[k] ?? 1) * holder.stats[k] / before[k];
  for (const k of ADD) if (holder.stats[k] !== before[k]) d.add[k] = (d.add[k] ?? 0) + holder.stats[k] - before[k];
  DELTAS.set(holder, d);
}
/** 从一份属性里扣掉本关增益（存档用，不改 holder 本身）。 */
export function stripStageBuffs(stats: PlayerStats, holder: object): PlayerStats {
  const d = DELTAS.get(holder); if (!d) return stats;
  for (const k of MUL) if (d.mul[k]) stats[k] /= d.mul[k]!;
  for (const k of ADD) if (d.add[k]) stats[k] -= d.add[k]!;
  return stats;
}
/** 撤销本关增益（战线推进到下一关 / 关末）。 */
export function clearStageBuffs(holder: { stats: PlayerStats }): void { stripStageBuffs(holder.stats, holder); DELTAS.delete(holder); }
export function hasStageBuffs(holder: object): boolean { return DELTAS.has(holder); }
