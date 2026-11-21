/**
 * 流派重做第 2 期（2026-11-19，设计稿 tactic-schools-redesign.md 3.5 / 3.6）：合击 15 个 + 六派觉醒。
 * - 合击：两派都到 COMBO_AT 势即生效（6 派两两一个）；第一次触发时打横幅「合击 · 名字」。
 * - 觉醒：某派到 6 势后自动释放（身边有一堆敌人时），每关最多 AWAKEN.perStage 次、两次之间至少 AWAKEN.cooldownMs（用户：「觉醒每关 1～2 次、有冷却，不刷屏」）。
 * 数值为开发期初值，平衡会话再调。
 */
import { mechOpen } from './mechanicUnlocks';
import type { SchoolId } from './schools';

export const COMBO_AT = 2;
export interface ComboDef { id: string; name: string; a: SchoolId; b: SchoolId; desc: string }
export const COMBOS: readonly ComboDef[] = [
  { id: 'fire_wind', name: '火借风势', a: 'fire', b: 'stratagem', desc: '被风吹开的燃烧敌人会点着一路撞到的人；被控制的燃烧敌人灼烧 ×2' },
  { id: 'fire_arrow', name: '火箭', a: 'fire', b: 'archery', desc: '暴击点燃敌人；打燃烧中的敌人伤害 +10%' },
  { id: 'fire_ox', name: '火牛阵', a: 'fire', b: 'formation', desc: '部曲、随行、义军的攻击有 25% 概率点燃敌人' },
  { id: 'fire_burst', name: '爆燃', a: 'fire', b: 'warrior', desc: '震荡 / 重击打到燃烧的敌人会炸开：再受 40% 伤害并点燃身边 2 人' },
  { id: 'fire_hoof', name: '烈马', a: 'fire', b: 'cavalry', desc: '跑动时每 0.7 秒在脚下留一小团火' },
  { id: 'ambush_bolt', name: '伏弩', a: 'stratagem', b: 'archery', desc: '对被控制的敌人暴击率 +25%' },
  { id: 'chaos_strike', name: '乘乱', a: 'stratagem', b: 'warrior', desc: '打被控制的敌人，连击层一次叠 2 层' },
  { id: 'ambush_ten', name: '十面埋伏', a: 'stratagem', b: 'formation', desc: '眩晕敌人时身边冒出 1 名伏兵砍 5 秒（场上最多 6 名）' },
  { id: 'feint', name: '声东击西', a: 'stratagem', b: 'cavalry', desc: '冲势打出时，主将身边的敌人减速 40%、1.2 秒' },
  { id: 'horse_archer', name: '骑射', a: 'archery', b: 'cavalry', desc: '移动中暴击率 +10%' },
  { id: 'pierce_combo', name: '破甲连击', a: 'archery', b: 'warrior', desc: '打破甲的敌人，连击层上限 +3' },
  { id: 'crossbow_line', name: '弩阵', a: 'archery', b: 'formation', desc: '部曲、随行、义军也会暴击（主将暴击率的一半）' },
  { id: 'take_general', name: '万军取首', a: 'cavalry', b: 'warrior', desc: '冲势一击打精锐 / 首领时伤害 +50%' },
  { id: 'iron_cavalry', name: '铁骑冲阵', a: 'cavalry', b: 'formation', desc: '冲势打出时，2 名骑卒随你冲阵（助战 4 秒）' },
  { id: 'last_stand', name: '背水一战', a: 'warrior', b: 'formation', desc: '主将生命低于 40% 时，你和全军伤害 +15%，你的武器命中吸血 3%' },
];
export type ComboId = typeof COMBOS[number]['id'];
export const COMBO_VALUES = {
  fireWindIgniteR: 46, fireWindBurnMul: 2,
  fireArrowBonus: .10,
  fireOxChance: .25,
  burstRatio: .4, burstTargets: 2, burstR: 70,
  hoofEveryMs: 700, hoofR: 34, hoofMs: 1400, hoofRatio: .15,
  ambushCrit: .25,
  chaosStacks: 2,
  ambushTenCap: 6, ambushTenLifeMs: 5000, ambushTenCdMs: 1500,
  feintR: 140, feintSlow: .4, feintMs: 1200,
  horseArcherCrit: .10,
  pierceComboCap: 3,
  crossbowLineCritShare: .5,
  takeGeneral: .5,
  ironCavalryN: 2, ironCavalryLifeMs: 4000,
  lastStandHp: .4, lastStandDmg: .15, lastStandLeech: .03, lastStandLeechCapPerSec: .015, // 11-19 平衡复核：原 .5 / .25 / .05 / .03 偏强
} as const;
/** 合击 3-2 开放（data/mechanicUnlocks.ts）：之前一律不生效、不显示。 */
export function activeCombos(tags: Record<SchoolId, number>, majors?: readonly SchoolId[]): ComboDef[] { if (!mechOpen('combo')) return []; return COMBOS.filter(c => !majors || (majors.includes(c.a) && majors.includes(c.b))).filter(/* 主修两派之间才有合击（用户 11-20「流派最多两派」） */ c => tags[c.a] >= COMBO_AT && tags[c.b] >= COMBO_AT); }
export function comboOf(a: SchoolId, b: SchoolId): ComboDef | undefined { return COMBOS.find(c => (c.a === a && c.b === b) || (c.a === b && c.b === a)); }

/** 觉醒：每关最多 perStage 次、间隔 cooldownMs；到 6 势后至少 firstDelayMs 才第一次；身边（minRange 内）至少 minEnemies 个敌人才放。 */
export const AWAKEN = {
  perStage: 2, cooldownMs: 45000, firstDelayMs: 2500, minEnemies: 6, minRange: 420,
  fire: { columns: 7, sweepMs: 1400, ratio: 2.2, burnMs: 4000, takenMul: 1.5, takenBossMul: 1.3, takenMs: 6000 },
  stratagem: { r: 150, ms: 5000, tickMs: 1000, stunMs: 700, taken: .3 },
  archery: { r: 160, waves: 3, waveMs: 450, ratio: 1.4, sunder: .15 },
  cavalry: { len: 540, width: 90, ratio: 2.6, push: 70, invulnMs: 1000 },
  warrior: { ms: 4000, haste: .4, shockR: 70, shockRatio: .2 },
  formation: { soldiers: 6, lifeMs: 8000, guardMs: 3000, guardMul: .5, allyDmgMs: 3000, allyDmgMul: 2 },
} as const;
