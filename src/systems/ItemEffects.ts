import type { CharacterId } from '../data/characters';
import { AFFIXES, AFFIX_IDS, type AffixId, type ItemInstance, type SpecialId } from '../data/items';
import { loadout } from './ItemStore';

/** 一位武将全身兵装折算后的加成（RunGrowth.gear）。数值词条受 AFFIXES.gearCap 约束；名器专属特效另计、不受上限。 */
export type GearStats = Record<AffixId, number> & { boss: number; specials: SpecialId[] };

export function emptyGear(): GearStats {
  const g = { boss: 0, specials: [] as SpecialId[] } as GearStats;
  for (const id of AFFIX_IDS) g[id] = 0;
  return g;
}

export function gearFromItems(items: ItemInstance[]): GearStats {
  const g = emptyGear();
  for (const item of items) for (const a of item.affixes) g[a.id] += a.value;
  for (const id of AFFIX_IDS) g[id] = Math.round(Math.min(AFFIXES[id].gearCap, g[id]) * 1000) / 1000;
  for (const item of items) if (item.special && !g.specials.includes(item.special)) g.specials.push(item.special);
  // 静态专属特效直接折进数值
  if (g.specials.includes('slayer')) g.boss += .25;
  if (g.specials.includes('scholar')) g.xp += .15;
  if (g.specials.includes('rally')) g.ally += .15;
  if (g.specials.includes('ironwall')) g.reduce += .1;
  if (g.specials.includes('swift')) g.attackSpeed += .1;
  return g;
}

/** 出征开局：读该武将穿戴的兵装。存档不可用时返回空加成。 */
export function gearFor(hero: CharacterId): GearStats {
  try { return gearFromItems(Object.values(loadout(hero)).filter((i): i is ItemInstance => !!i)); } catch { return emptyGear(); }
}

/** 面板用的加成汇总（只列非零项）。 */
export function gearSummary(g: GearStats): string[] {
  const out: string[] = [];
  for (const id of AFFIX_IDS) if (g[id] > 0) { const d = AFFIXES[id]; out.push(d.percent ? `${d.name} ${id === 'reduce' ? '−' : '+'}${Math.round(g[id] * 1000) / 10}%` : `${d.name} +${g[id].toFixed(1)}`); }
  if (g.boss > 0) out.push(`对首领伤害 +${Math.round(g.boss * 100)}%`);
  return out;
}
