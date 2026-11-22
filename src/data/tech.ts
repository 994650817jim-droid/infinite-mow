/**
 * 讲武堂科技树（CITY_SIMPLIFY：用户 2026-11-16 批准）。三条分支 × 三层，每个科技花军粮研究一次、永久生效。
 * 层数受讲武堂等级限制（第 n 层需要讲武堂 Lv n）。数值为占位初值，由「平衡与数值」会话调整。
 */
import type {TroopKind} from './legion';

export type TechBranch = 'supply' | 'troops' | 'arms';
export type TechId =
  | 'potion' | 'potion2' | 'medicine' | 'tuntian' | 'levy'
  | 'drill_melee' | 'drill_ranged' | 'drill_guard' | 'elite_cav'
  | 'forge' | 'armor' | 'drill_points' | 'forge2';

export interface TechEffect {
  /** 开局放进药囊的回血药：份数与每份回复（最大生命比例）。取已研究中最大的一档。 */
  potions?: {count: number; ratio: number};
  /** 军医治疗量加成（累加）。 */
  heal?: number;
  /** 战后军粮收益加成（累加）。 */
  grain?: number;
  /** 招募后备兵价格折扣（累加，最多 50%）。 */
  recruitDiscount?: number;
  /** 这些兵种出征开局即为该等级。 */
  troopLevel?: {kinds: TroopKind[]; level: number};
  /** 主将：伤害、最大生命、开局属性点（累加）。 */
  damage?: number; maxHp?: number; attributePoints?: number;
}
export interface TechDef {
  name: string; branch: TechBranch; tier: 1 | 2 | 3; cost: number;
  /** 前置科技。 */
  needs?: TechId;
  desc: string; effect: TechEffect;
}

export const BRANCH_NAME: Record<TechBranch, string> = {supply: '军需', troops: '兵略', arms: '武备'};
export const BRANCH_ORDER: TechBranch[] = ['supply', 'troops', 'arms'];

export const TECHS: Record<TechId, TechDef> = {
  // 2026-11-16 平衡（用户批准，city-values-balance.md）：科技价一层 150 / 二层 400 / 三层 800；募兵有方 −15% → −10%
  potion: {name: '回血药', branch: 'supply', tier: 1, cost: 150, desc: '出征开局药囊里带 2 份回血药，每份回复 30% 生命（Q 键 / 用药按钮）', effect: {potions: {count: 2, ratio: .3}}},
  potion2: {name: '良药', branch: 'supply', tier: 2, cost: 400, needs: 'potion', desc: '回血药改为 3 份，每份回复 40% 生命', effect: {potions: {count: 3, ratio: .4}}},
  medicine: {name: '医术', branch: 'supply', tier: 2, cost: 400, desc: '军医治疗量 +12%', effect: {heal: .12}},
  tuntian: {name: '屯田', branch: 'supply', tier: 3, cost: 800, desc: '每场出征的钱币收益 +15%', effect: {grain: .15}},
  levy: {name: '募兵有方', branch: 'supply', tier: 3, cost: 800, desc: '招募后备兵花费 −10%', effect: {recruitDiscount: .1}},

  drill_melee: {name: '刀枪操练', branch: 'troops', tier: 1, cost: 150, desc: '刀盾兵、长枪兵出征开局即为 Lv2', effect: {troopLevel: {kinds: ['swordsman', 'spearman'], level: 2}}},
  drill_ranged: {name: '弓弩操练', branch: 'troops', tier: 2, cost: 400, needs: 'drill_melee', desc: '弓箭兵、连弩兵出征开局即为 Lv2', effect: {troopLevel: {kinds: ['archer', 'crossbowman'], level: 2}}},
  drill_guard: {name: '重盾操练', branch: 'troops', tier: 2, cost: 400, needs: 'drill_melee', desc: '重盾兵、军医出征开局即为 Lv2', effect: {troopLevel: {kinds: ['guardian', 'medic'], level: 2}}},
  elite_cav: {name: '骑戟精锐', branch: 'troops', tier: 3, cost: 800, needs: 'drill_ranged', desc: '轻骑兵、精锐戟兵出征开局即为 Lv2', effect: {troopLevel: {kinds: ['rider', 'halberdier'], level: 2}}},

  forge: {name: '磨砺兵刃', branch: 'arms', tier: 1, cost: 150, desc: '主将伤害 +4%', effect: {damage: .04}},
  armor: {name: '坚甲', branch: 'arms', tier: 2, cost: 400, desc: '主将生命上限 +6%', effect: {maxHp: .06}},
  drill_points: {name: '操练', branch: 'arms', tier: 2, cost: 400, needs: 'forge', desc: '出征开局属性点 +1', effect: {attributePoints: 1}},
  forge2: {name: '百炼', branch: 'arms', tier: 3, cost: 800, needs: 'forge', desc: '主将伤害再 +6%', effect: {damage: .06}},
};
export const TECH_IDS = Object.keys(TECHS) as TechId[];

export interface TechTotals {
  potions: {count: number; ratio: number} | null; heal: number; grain: number; recruitDiscount: number;
  troopLevels: Partial<Record<TroopKind, number>>; damage: number; maxHp: number; attributePoints: number;
}
/** 已研究科技的合计效果。 */
export function techTotals(done: readonly string[]): TechTotals {
  const out: TechTotals = {potions: null, heal: 0, grain: 0, recruitDiscount: 0, troopLevels: {}, damage: 0, maxHp: 0, attributePoints: 0};
  for (const id of done) {
    const e = TECHS[id as TechId]?.effect; if (!e) continue;
    if (e.potions && (!out.potions || e.potions.count * e.potions.ratio > out.potions.count * out.potions.ratio)) out.potions = {...e.potions};
    out.heal += e.heal ?? 0; out.grain += e.grain ?? 0; out.recruitDiscount = Math.min(.5, out.recruitDiscount + (e.recruitDiscount ?? 0));
    out.damage += e.damage ?? 0; out.maxHp += e.maxHp ?? 0; out.attributePoints += e.attributePoints ?? 0;
    if (e.troopLevel) for (const k of e.troopLevel.kinds) out.troopLevels[k] = Math.max(out.troopLevels[k] ?? 1, e.troopLevel.level);
  }
  return out;
}
/** 研究某科技还缺什么（空数组 = 可以研究，不含军粮）。 */
export function techBlockers(id: TechId, done: readonly string[], academyLevel: number): string[] {
  const t = TECHS[id], out: string[] = [];
  if (done.includes(id)) return ['已研究'];
  if (academyLevel < t.tier) out.push(academyLevel ? `讲武堂 Lv${t.tier}` : '先建讲武堂');
  if (t.needs && !done.includes(t.needs)) out.push(TECHS[t.needs].name);
  return out;
}
