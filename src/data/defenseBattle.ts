import type { CityTier } from '../world/WorldCities';

/**
 * 守城战本身（共享笔记 defense-redesign.md 第二节；用户 11-20「Approve defaults」）。初值，交平衡会话。
 * 坐标相对开局点：城墙在北（wallY），敌营在墙外更北，府衙在城里最南；城头带 = 墙内侧一条（城防设施、云梯爬上来的落点）。
 */
export type DefenseTier = 'early' | 'mid' | 'late';
/** 按章节分三档：早（第二、三章）只有步兵弓手冲门；中（四到七章）冲车 + 云梯；后（八章起）再多一波。井阑等第八章出图再加。 */
export function defenseTier(chapter: number): DefenseTier { return chapter <= 3 ? 'early' : chapter <= 7 ? 'mid' : 'late'; }

export const DEFENSE = {
  /** 每档几波（含末波）；攻 / 喘息 / 末波各多少秒。 */
  waves: { early: 3, mid: 4, late: 5 } as Record<DefenseTier, number>,
  attackSec: 70, restSec: 15, finalSec: 90,
  /** 城墙线、府衙、敌营刷兵口（相对开局点）。 */
  wallY: -360, keep: { x: 0, y: 460 }, spawn: { y: -1050, xs: [-700, 0, 700] as readonly number[], jitter: 180 },
  /** 城头带：墙内侧 wallLine + [top, bottom]；主将站在带里 = 登城（射程 +rangeBonus）。 */
  rampart: { top: 20, bottom: 110, rangeBonus: .2 }, // 登城：主将站在城头带里武器范围 ×(1 + rangeBonus)（CharacterPassives.rampartMul）
  /** 城门 / 府衙耐久（按城池档，府衙每级 ×(1 + officeBonus)）；敌兵贴门每秒伤害 = 自身伤害 × contactMul；首领 × bossMul。 */
  // 11-20 夜间回归：小城无人防守约 50 秒破门（原 900 / 1300 / 1800、贴门 ×0.6 不限人数）→ 加耐久、贴门同时最多 gateCap 人、×0.4
  gateHp: { small: 1500, medium: 1900, large: 2500 } as Record<CityTier, number>,
  keepHp: { small: 1600, medium: 2000, large: 2600 } as Record<CityTier, number>,
  officeBonus: .15, contactMul: .4, bossMul: 3, gateReach: 70, keepReach: 90,
  /** 同时能砍城门 / 府衙的人数（其余在后面排着等）。 */
  gateCap: 6, keepCap: 8,
  /** 城门破了后，离主将远于 raidDist 的城内敌兵去打府衙。 */
  raidDist: 340,
  /** 城头弓手：人数按城池档 + 募兵所每级 1；射程、间隔、伤害（× 本关小兵成长的 0.5 次方，免得后期太弱）。 */
  // 弓手先射砍城门的（门前 gateFocus 以内），小城 2 → 3、伤害 14 → 18（同上，夜间回归）
  archers: { small: 3, medium: 3, large: 4 } as Record<CityTier, number>, archerRange: 560, archerMs: 1600, archerDamage: 18, archerHp: 120, gateFocus: 170,
  /** 城防设施（城头固定位，主将站上去自动放，有次数和冷却）：滚木沿墙脚滚一条、热油泼门前一片持续烧。 */
  logs: { charges: 2, cdMs: 6000, reach: 70, band: 150, damage: 160, rollMs: 1100 },
  oil: { charges: 2, cdMs: 8000, reach: 70, radius: 130, tickMs: 400, ticks: 10, damage: 22, engineMul: 4 },
  /** 喘息时布防（花随军粮）：修城门 +repair、补设施各 +1 次、补一名城头弓手；站在门内读条 channelMs 免费修 +freeRepair（每次喘息一回）。 */
  // 价格（总制作人第四轮：原 20～30 粮、守完还剩 4344 粮，等于免费）= 底价 ×(1 + chapterStep ×(章 − 2)) ×(1 + waveStep × 第几次喘息)，同一次喘息里同一项再买 ×repeatMul^已买次数（prepCost）。初值，和平衡会话的随军粮减收一起调
  prep: { repairCost: 120, repair: .3, refillCost: 80, archerCost: 100, chapterStep: .25, waveStep: .5, repeatMul: 1.6, channelMs: 3000, freeRepair: .15, freeReach: 90 },
  /** 攻城器械（中档起）：冲车每波 rams 辆，撞门每 ramMs 一下 ramDamage；云梯每波 ladders 架，立起后每 climbMs 爬上来一个兵。 */
  rams: { mid: 1, late: 2 } as Partial<Record<DefenseTier, number>>, ramHp: 600, ramSpeed: 26, ramMs: 1600, ramDamage: 90,
  ladders: { mid: 2, late: 3 } as Partial<Record<DefenseTier, number>>, ladderHp: 260, ladderWarnMs: 2000, climbMs: 3200,
  /** 止血（用户 11-21「士兵四面八方围攻中心、和守城不关联」）：云梯爬进城里的兵同时最多 climberCap 个（各梯子合计），满了梯子上的人等着；守城重做见共享笔记 defense-redesign-v2.md。 */
  climberCap: 5,
  /** 奖励：守住按攻城奖励 × DEFENSE_RULES.rewardMul（data/defenseRules.ts）。 */
} as const;

/** 喘息布防价格：base 底价、chapter 章节（1–12）、wave 第几次喘息（0 起）、bought 这次喘息里这一项已买几次。 */
export function prepCost(base: number, chapter: number, wave: number, bought: number): number {
  const P = DEFENSE.prep;
  return Math.round(base * (1 + P.chapterStep * Math.max(0, chapter - 2)) * (1 + P.waveStep * Math.max(0, wave)) * Math.pow(P.repeatMul, Math.max(0, bought)));
}
/** 第一次守城、第一次喘息时的引导（只一次）。 */
export const DEFENSE_PREP_GUIDE_KEY = 'im_defense_prep_guide_v1';
export function defensePrepGuide(gatePct: number): string { return '喘息只有 15 秒：城门还剩 ' + gatePct + '%——站到城门内读条免费修一点，或花随军钱币「修城门」；滚木 / 热油、城头弓手也在这时补。不修城门，撑不过第三波。'; }

/** 第 i 波（0 起）开始的关内秒数；末波开始 = 首领出场。 */
export function defenseWaveStarts(n: number): number[] { const D = DEFENSE, out: number[] = []; for (let i = 0; i < n; i++) out.push(i * (D.attackSec + D.restSec)); return out; }
export function defenseTotalSec(n: number): number { return (n - 1) * (DEFENSE.attackSec + DEFENSE.restSec) + DEFENSE.finalSec; }
