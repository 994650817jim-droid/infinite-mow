/**
 * 兵装「一键穿戴」与「有更好的没穿」规则（总制作人第一章试玩 r3：打完第一章行囊 20 件兵装一件没穿，全程没提示去穿）。
 * 好坏比较：先比品质（紫一定比蓝好），同品质再比评分 itemScore = 各词条数值 ÷ 该词条的兵装上限（AFFIXES.gearCap）之和 × 100，特技另加 35。
 * 规则：
 * - 甲胄 / 头盔 / 战靴 / 首领遗珍：每位挑没被任何武将穿着的道具里最好的一件；比身上的好（或那位空着）就换上。
 * - 信物：开放几位挑几件（第二位二章通关开放），同名信物只取一件（套装 / 机制按名字算，两件同名不叠）；身上的也参与排名，被挤下来的位换成新挑的。
 * - 别的武将穿着的不动；坐骑在马厩换，不在这里。
 * 用在：行囊「一键穿戴」、行营 / 结算的「行囊有更好的兵装」小红点与提示、第一次缴获兵装后的引导。
 */
import { AFFIXES, QUALITY_ORDER, itemSlot, type ItemInstance } from './items';

export type GearKey = 'armor' | 'helm' | 'boots' | 'token' | 'token2' | 'relic';
export const GEAR_AUTO = {
  /** 特技（饮血、背水……）折成的评分。 */
  special: 35,
} as const;

/** 评分：各词条按自己的兵装上限折成 0–1 再相加 × 100，特技 +35。 */
export function itemScore(item: ItemInstance): number {
  let s = 0;
  for (const a of item.affixes ?? []) { const d = AFFIXES[a.id]; if (d && d.gearCap > 0) s += Math.max(0, a.value) / d.gearCap; }
  return Math.round(s * 100) + (item.special ? GEAR_AUTO.special : 0);
}
/** a 比 b 好返回正数：先品质、再评分。 */
export function compareGear(a: ItemInstance, b: ItemInstance): number {
  return QUALITY_ORDER.indexOf(a.quality) - QUALITY_ORDER.indexOf(b.quality) || itemScore(a) - itemScore(b);
}
const best = (l: readonly ItemInstance[]): ItemInstance | undefined => [...l].sort((x, y) => compareGear(y, x))[0];

/**
 * 该换上的兵装（按位）：worn = 这位武将身上的，free = 没被任何武将穿着的（行囊里的 + 战斗中还没带回的缴获），tokenSlots = 信物开了几位。
 * 返回空表示身上已是最好的。
 */
export function gearPlan(worn: Partial<Record<GearKey, ItemInstance>>, free: readonly ItemInstance[], tokenSlots: number): Array<{ slot: GearKey; item: ItemInstance }> {
  const out: Array<{ slot: GearKey; item: ItemInstance }> = [];
  for (const slot of ['armor', 'helm', 'boots', 'relic'] as const) {
    const b = best(free.filter(i => itemSlot(i) === slot)), cur = worn[slot];
    if (b && (!cur || compareGear(b, cur) > 0)) out.push({ slot, item: b });
  }
  // 信物：身上的 + 没穿的一起排，同名只取最好的一件，取前 N 件；新挑中的放进「身上那件没被选中」的位
  const keys: GearKey[] = tokenSlots > 1 ? ['token', 'token2'] : ['token'];
  const wornTokens = keys.map(k => worn[k]).filter((i): i is ItemInstance => !!i);
  const pool = [...wornTokens, ...free.filter(i => itemSlot(i) === 'token')].sort((x, y) => compareGear(y, x));
  const chosen: ItemInstance[] = [];
  for (const i of pool) { if (chosen.length >= keys.length) break; if (!chosen.some(c => c.base === i.base)) chosen.push(i); }
  const open = keys.filter(k => !worn[k] || !chosen.includes(worn[k]!));
  for (const i of chosen) if (!wornTokens.includes(i)) { const slot = open.shift(); if (slot) out.push({ slot, item: i }); }
  return out;
}
