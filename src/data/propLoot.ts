import { BASE_ITEMS, QUALITY_ORDER, rollBaseItem, rollItem, type AffixId, type ItemInstance, type ItemQuality, type ItemSlot } from './items';

/**
 * 可破坏障碍物按「是什么」掉东西（用户 2026-11-17：「宝箱掉落可以设计在合适的障碍物掉落，比如说武器架可能会掉落攻击类型的武器道具……
 * 但是旗子什么的不会掉落宝箱，不然会太奇怪了」；统筹会话定的细则，概率为初值、待平衡会话复核）。
 * - 兵器架（刀枪架 / 戟架 / 剑架 / 弓架）→ 攻击类兵装（主词条是伤害 / 攻速 / 暴击）低概率；否则少量军功宝石，偶有一阵斗志（短时伤害提升）。
 * - 甲胄架 / 盾牌堆 → 护具（甲 / 盔 / 靴）低概率；否则偶有短时减伤。
 * - 木箱 / 钱箱 → 宝石，极低概率一件随机兵装。
 * - 粮袋 / 粮车 / 米缸 → 随军粮。
 * - 酒罐 / 药篓 → 回血（原逻辑不变）；火油桶 → 爆炸起火（原逻辑，不掉东西）。
 * - 军旗 / 营帐 / 拒马 / 栅栏 / 残骸 / 石碑 / 山石草木等景物 → 一律不掉宝箱和兵装（环境互动效果照旧）。
 * - 没在下表里登记的图（只有图、没有掉落表）→ 什么也不掉，不随机。
 * 障碍物掉的兵装最高蓝色（紫 / 金只从首领、精锐来），每关最多 PROP_LOOT.perStageItems 件。
 */
export type PropLootKind = 'weapons' | 'armor' | 'crate' | 'coins' | 'grain' | 'heal' | 'none';
export const PROP_LOOT = {
  perStageItems: 2,
  qualityCap: 'blue' as ItemQuality,
  /** 障碍物掉兵装的品质分布（再按 qualityCap 封顶）：白 / 绿 / 蓝 */
  quality: [['white', .3], ['green', .5], ['blue', .2]] as Array<[ItemQuality, number]>,
  weapons: { itemChance: .08, gems: 2, buffChance: .3, buffMs: 6000 },
  armor: { itemChance: .08, gems: 1, buffChance: .35, buffMs: 8000, guardMul: .7 },
  crate: { itemChance: .04, gems: 3 },
  coins: { itemChance: .04, gems: 5 },
  grain: { food: 6 },
} as const;
/** 攻击类兵装：主词条是这些的基础道具。 */
export const ATTACK_AFFIXES: readonly AffixId[] = ['damage', 'attackSpeed', 'crit'];
export const ARMOR_SLOTS: readonly ItemSlot[] = ['armor', 'helm', 'boots'];
/** 营地道具图集 yellow_props（6×6）的帧 → 掉落类别。没写的帧（营帐 0-3、军旗 4-9、栅栏 10-13、残骸 25-28、火盆 29/30/35、石碑 32 …）不掉。 */
export const CAMP_PROP_LOOT: Readonly<Record<number, PropLootKind>> = {
  14: 'crate', 15: 'crate', // 木箱 / 木箱捆
  16: 'grain', // 粮袋
  17: 'coins', // 钱袋（钱箱图到之前的过渡）
  18: 'heal', // 酒罐（原回血逻辑）
  19: 'weapons', 20: 'weapons', 21: 'weapons', 22: 'weapons', // 枪架 / 长兵架 / 剑架 / 弓架
  23: 'armor', // 盾牌堆（甲胄架图到之前的过渡）
  24: 'grain', // 粮车（辎重车）
  31: 'grain', // 米缸（吊锅）
};
/** 打碎时按真实贴图判定掉落类别（同一个补给格子会被换成别的贴图：汜水关物件、营帐、城门等都不掉）。 */
export function propLootKind(texture: string, frame: number, heal = false): PropLootKind {
  if (heal || texture === 'heal_props') return 'heal';
  if (texture === 'yellow_props') return CAMP_PROP_LOOT[frame] ?? 'none';
  return 'none';
}
export function capQuality(q: ItemQuality, cap: ItemQuality = PROP_LOOT.qualityCap): ItemQuality { return QUALITY_ORDER.indexOf(q) > QUALITY_ORDER.indexOf(cap) ? cap : q; }
export function rollPropQuality(rng: () => number = Math.random): ItemQuality {
  let r = rng(); for (const [q, p] of PROP_LOOT.quality) { if (r < p) return capQuality(q); r -= p; } return 'white';
}
/** 按障碍物类别出一件兵装（封顶蓝）：兵器架只出攻击类、甲胄架只出护具。别的类别返回 null。 */
export function rollPropItem(kind: PropLootKind, rng: () => number = Math.random, quality: ItemQuality = rollPropQuality(rng)): ItemInstance | null {
  const q = capQuality(quality);
  if (kind === 'weapons') {
    // 直接在攻击类基础道具里挑一种再按它出件（不靠反复重抽）
    const bases = BASE_ITEMS.filter(b => ATTACK_AFFIXES.includes(b.primary));
    return rollBaseItem(bases[Math.min(bases.length - 1, Math.floor(rng() * bases.length))].id, q, rng);
  }
  if (kind === 'armor') return rollItem(q, rng, ARMOR_SLOTS[Math.floor(rng() * ARMOR_SLOTS.length)]);
  if (kind === 'crate' || kind === 'coins') return rollItem(q, rng, (['armor', 'helm', 'boots', 'token'] as ItemSlot[])[Math.floor(rng() * 4)]);
  return null;
}
