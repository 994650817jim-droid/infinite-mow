import type { FollowerTemplate } from './recruits';

/**
 * 无名之辈 / 史事名将（按模板出手的随行）的招式与被动（用户 2026-11-17「需要设计大众脸的自己的技能被动攻击，就是属于大众脸的强度」）。
 * 强度：明显弱于名将（名将随行的被动已按 FOLLOW.passiveScale = 50% 折算；这里的初值大致是名将同类效果的 40–60%），初值交「平衡与数值」会话复核。
 * 将阶：兵器线每升一次（weapon picks）提高招式数值，被动线每升一次（passive picks）提高被动数值。
 * 特效：「新增可玩武将」会话的手绘序列帧（FollowerSquad 的 Fx kind：blade-sweep / spear-thrust / arrow / heal / block，c884ef1）；这里只管机制与数值。
 * 可玩名将当随行仍用自己的本命武器与天赋被动，不走这张表。
 */
export interface CommonerSkillDef {
  active: { name: string; desc: string };
  passive: { name: string; desc: string };
}

export const COMMONER = {
  /** 每出手这么多下，第 n 下换成招式（谋士的包扎同样按出手次数）。 */
  activeEvery: 3,
  /** 刀「横斩」：身边一圈横扫，半径 radius，伤害 ×(mul + mulPerRank × 兵器阶数)，最多打 maxHits 个。
   *  刀「格挡」：每次受伤有 chance + chancePerRank × 被动阶数 的几率完全挡下（上限 maxChance）。 */
  blade: { radius: 95, mul: 1.3, mulPerRank: .08, maxHits: 8, block: { chance: .1, chancePerRank: .015, maxChance: .3 } },
  /** 枪「突刺」：朝目标一条直线（长 length、半宽 halfWidth），穿透 pierce 个（兵器阶数 ≥ pierceUpAt 时 +1），伤害 ×(mul + mulPerRank × 兵器阶数)。
   *  枪「列阵」：身边 radius 内有部曲士兵时，伤害 +(bonus + bonusPerRank × 被动阶数)。 */
  spear: { length: 160, halfWidth: 26, pierce: 2, pierceUpAt: 5, mul: 1.5, mulPerRank: .1, formation: { radius: 120, bonus: .08, bonusPerRank: .012 } },
  /** 弓「连射」：连发 shots 箭（有第二个目标时分给它），每箭伤害 ×(mul + mulPerRank × 兵器阶数)。
   *  弓「瞄准」：站定 stillSec 秒后，暴击率 +(chance + chancePerRank × 被动阶数)，暴击伤害 ×critMul。 */
  bow: { shots: 2, mul: .8, mulPerRank: .06, aim: { stillSec: .4, chance: .12, chancePerRank: .02, critMul: 1.6 } },
  /** 谋「包扎」：给身边 radius 内的部曲士兵与随行回血 (heal + healPerRank × 兵器阶数) × 各自最大生命，最多 maxTargets 个。
   *  谋「鼓舞」：身边 radius 内的其他模板随行攻速 +(haste + hastePerRank × 被动阶数)（多个谋士不叠加，取最高）。 */
  strategist: { heal: { radius: 160, heal: .04, healPerRank: .005, maxTargets: 6 }, rally: { radius: 180, haste: .06, hastePerRank: .01 } },
} as const;

export const COMMONER_SKILLS: Record<FollowerTemplate, CommonerSkillDef> = {
  blade: { active: { name: '横斩', desc: '每第 3 刀改为身边一圈横扫' }, passive: { name: '格挡', desc: '受伤时有几率完全挡下' } },
  spear: { active: { name: '突刺', desc: '每第 3 下朝目标直刺，穿透多名敌人' }, passive: { name: '列阵', desc: '身边有部曲士兵时伤害提高' } },
  bow: { active: { name: '连射', desc: '每第 3 下连发两箭' }, passive: { name: '瞄准', desc: '站定时暴击率提高' } },
  strategist: { active: { name: '包扎', desc: '每第 3 次施术给身边士兵与随行回血' }, passive: { name: '鼓舞', desc: '身边其他随行攻速提高' } },
};

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const x2 = (v: number) => `×${(Math.round(v * 100) / 100).toFixed(2)}`;
/** 招式数值（兵器阶数 w）。 */
export function activeValue(t: FollowerTemplate, w: number): string {
  if (t === 'blade') return `横扫 ${x2(COMMONER.blade.mul + COMMONER.blade.mulPerRank * w)}`;
  if (t === 'spear') return `直刺 ${x2(COMMONER.spear.mul + COMMONER.spear.mulPerRank * w)} 穿 ${COMMONER.spear.pierce + (w >= COMMONER.spear.pierceUpAt ? 1 : 0)}`;
  if (t === 'bow') return `两箭各 ${x2(COMMONER.bow.mul + COMMONER.bow.mulPerRank * w)}`;
  return `回血 ${pct(COMMONER.strategist.heal.heal + COMMONER.strategist.heal.healPerRank * w)}`;
}
/** 被动数值（被动阶数 p）。 */
export function passiveValue(t: FollowerTemplate, p: number): string {
  if (t === 'blade') return `格挡 ${pct(blockChance(p))}`;
  if (t === 'spear') return `伤害 +${pct(COMMONER.spear.formation.bonus + COMMONER.spear.formation.bonusPerRank * p)}`;
  if (t === 'bow') return `暴击 +${pct(COMMONER.bow.aim.chance + COMMONER.bow.aim.chancePerRank * p)}`;
  return `攻速 +${pct(COMMONER.strategist.rally.haste + COMMONER.strategist.rally.hastePerRank * p)}`;
}
export function blockChance(p: number): number { const b = COMMONER.blade.block; return Math.min(b.maxChance, b.chance + b.chancePerRank * p); }
