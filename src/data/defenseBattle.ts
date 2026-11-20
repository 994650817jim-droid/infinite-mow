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
  rampart: { top: 20, bottom: 110, rangeBonus: .2 },
  /** 城门 / 府衙耐久（按城池档，府衙每级 ×(1 + officeBonus)）；敌兵贴门每秒伤害 = 自身伤害 × contactMul；首领 × bossMul。 */
  gateHp: { small: 900, medium: 1300, large: 1800 } as Record<CityTier, number>,
  keepHp: { small: 1200, medium: 1600, large: 2200 } as Record<CityTier, number>,
  officeBonus: .15, contactMul: .6, bossMul: 3, gateReach: 70, keepReach: 90,
  /** 城门破了后，离主将远于 raidDist 的城内敌兵去打府衙。 */
  raidDist: 340,
  /** 城头弓手：人数按城池档 + 募兵所每级 1；射程、间隔、伤害（× 本关小兵成长的 0.5 次方，免得后期太弱）。 */
  archers: { small: 2, medium: 3, large: 4 } as Record<CityTier, number>, archerRange: 560, archerMs: 1600, archerDamage: 14, archerHp: 120,
  /** 城防设施（城头固定位，主将站上去自动放，有次数和冷却）：滚木沿墙脚滚一条、热油泼门前一片持续烧。 */
  logs: { charges: 2, cdMs: 6000, reach: 70, band: 150, damage: 160, rollMs: 1100 },
  oil: { charges: 2, cdMs: 8000, reach: 70, radius: 130, tickMs: 400, ticks: 10, damage: 22, engineMul: 4 },
  /** 喘息时布防（花随军粮）：修城门 +repair、补设施各 +1 次、补一名城头弓手；站在门内读条 channelMs 免费修 +freeRepair（每次喘息一回）。 */
  prep: { repairCost: 30, repair: .25, refillCost: 20, archerCost: 25, channelMs: 3000, freeRepair: .1, freeReach: 90 },
  /** 攻城器械（中档起）：冲车每波 rams 辆，撞门每 ramMs 一下 ramDamage；云梯每波 ladders 架，立起后每 climbMs 爬上来一个兵。 */
  rams: { mid: 1, late: 2 } as Partial<Record<DefenseTier, number>>, ramHp: 600, ramSpeed: 26, ramMs: 1600, ramDamage: 90,
  ladders: { mid: 2, late: 3 } as Partial<Record<DefenseTier, number>>, ladderHp: 260, ladderWarnMs: 2000, climbMs: 3200,
  /** 奖励：守住按攻城奖励 × DEFENSE_RULES.rewardMul（data/defenseRules.ts）。 */
} as const;

/** 第 i 波（0 起）开始的关内秒数；末波开始 = 首领出场。 */
export function defenseWaveStarts(n: number): number[] { const D = DEFENSE, out: number[] = []; for (let i = 0; i < n; i++) out.push(i * (D.attackSec + D.restSec)); return out; }
export function defenseTotalSec(n: number): number { return (n - 1) * (DEFENSE.attackSec + DEFENSE.restSec) + DEFENSE.finalSec; }
