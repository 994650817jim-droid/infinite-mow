export type TroopKind = 'swordsman' | 'spearman' | 'archer' | 'crossbowman' | 'guardian' | 'rider' | 'halberdier' | 'medic';
export type Formation = 'wedge' | 'scales' | 'geese' | 'circle';
export type Order = 'guard' | 'sortie';
export interface TroopDef { name: string; mark: string; hp: number; damage: number; armor: number; range: number; cooldown: number; speed: number; cost: number; art: string; tint: number; ranged?: boolean; perk: string; actionVisual?: { texture: string }; walkVisual?: { texture: string; scale: number; groundY: number }; }
export const TROOPS: Record<TroopKind, TroopDef> = {
  swordsman: { name: '刀盾兵', mark: '刀', hp: 85, damage: 15, armor: 2, range: 75, cooldown: .95, speed: 150, cost: 10, art: 'shu_swordsman', tint: 0xffffff, perk: 'Lv3 连斩两敌' },
  spearman: { name: '长枪兵', mark: '枪', hp: 70, damage: 18, armor: 1, range: 125, cooldown: 1.1, speed: 150, cost: 12, art: 'shu_spearman', tint: 0xffffff, perk: 'Lv3 对骑兵伤害翻倍' },
  archer: { name: '弓箭兵', mark: '弓', hp: 50, damage: 7.8, armor: 0, range: 260, cooldown: 1.15, speed: 145, cost: 12, art: 'shu_archer', tint: 0xffffff, ranged: true, perk: 'Lv3 双目标齐射' },
  crossbowman: { name: '连弩兵', mark: '弩', hp: 46, damage: 5.2, armor: 0, range: 220, cooldown: .5, speed: 145, cost: 16, art: 'shu_archer', tint: 0xffffff, ranged: true, perk: 'Lv3 每次两矢', walkVisual: { texture: 'legion_crossbowman_walk', scale: 0.72, groundY: .875 }, actionVisual: { texture: 'legion_crossbowman_action' } },
  guardian: { name: '重盾兵', mark: '盾', hp: 180, damage: 9, armor: 6, range: 65, cooldown: 1.3, speed: 115, cost: 18, art: 'xiliang_shield', tint: 0xffffff, perk: 'Lv3 护甲额外+5', walkVisual: { texture: 'legion_guardian_walk', scale: 0.728429721, groundY: .875 } },
  rider: { name: '轻骑兵', mark: '骑', hp: 95, damage: 16.9, armor: 2, range: 90, cooldown: 1.5, speed: 215, cost: 22, art: 'xiliang_cavalry', tint: 0xffffff, perk: 'Lv3 冲击三敌', walkVisual: { texture: 'legion_rider_walk', scale: 0.936170213, groundY: .875 } },
  halberdier: { name: '精锐戟兵', mark: '戟', hp: 105, damage: 15.6, armor: 3, range: 100, cooldown: 1.35, speed: 140, cost: 24, art: 'xiliang_elite', tint: 0xffffff, actionVisual: {texture:'legion_halberdier_action'}, perk: 'Lv3 扩大范围+25%', walkVisual: { texture: 'legion_halberdier_walk', scale: 0.779661017, groundY: .875 } },
  medic: { name: '军医', mark: '医', hp: 55, damage: 8, armor: 0, range: 150, cooldown: 2, speed: 145, cost: 20, art: 'zhuge', tint: 0xffffff, perk: 'Lv3 同时治疗三人', walkVisual: { texture: 'legion_medic_walk', scale: 0.72, groundY: .875 }, actionVisual: { texture: 'legion_medic_action' } },
};
export const TROOP_KINDS = Object.keys(TROOPS) as TroopKind[];
export const ORDERS: Record<Order, string> = { guard: '护阵', sortie: '出击' };
export const LEGION = { startingFood: 0, waveFood: 0, trainCost: [0, 40, 80], squadSize: 12, nearStep: .1, farStep: .5 } as const;

export const INITIAL_TROOPS:readonly TroopKind[]=['swordsman','spearman','archer'];

/** Living soldiers, including starting reinforcements and reserves. */
/** Compatibility helper; barracks upgrades no longer restrict army size. */
export function armyCapacity(_level: number): number { return Infinity; }

/**
 * 首领对部曲（2026-11-16 用户要求：首领能快速清理小兵，不至于被小兵围死）。只影响打士兵，打主将不变。
 * contactMul：首领横扫伤害倍率——每秒打到身边 sweepReach 像素内的所有士兵（长枪 / 弓兵不贴身也躲不开）；skillMul：首领招式（范围 / 冲锋 / 箭雨等）打士兵的倍率。
 */
export const BOSS_VS_TROOPS = { contactMul: 3, skillMul: 2, sweepReach: 60 } as const;
/**
 * 招兵价随在场兵数浮动（用户要求：兵越多越贵、越少越便宜）：每人 = 基础价 ×（a + b·n + c·n²）。
 * 0 人半价；10 人约 2.4 倍、20 人约 4.1 倍、33 人约 9.8 倍（原为 1 + 0.2n）。
 */
export const RECRUIT_PRICE = { a: .5, b: .15, c: .004 } as const;
