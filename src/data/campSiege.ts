/**
 * 营寨攻坚（用户 2026-11-20「和营寨太容易被摧毁了，需要设计一下」；设计见共享笔记 camp-siege-design.md）。
 * 套用于：破营目标营寨（StageObjectives，2-3 五座）、敌营（EnemyCamps）、关前营帐（SishuiPass，小营帐档）。
 * 数值是初值，交平衡会话复核。
 */
export type CampTier = 'camp' | 'tent';
export const CAMP_SIEGE = {
  /** 耐久 = 本章精锐血量（含章节成长）× eliteMul，至少 minHp；每秒最多掉 最大耐久 / minSec（不管什么分支都至少要打这么久）。 */
  tier: {
    camp: { eliteMul: 9, minHp: 900, minSec: 15 },
    tent: { eliteMul: 4, minHp: 400, minSec: 7 },
  } as Record<CampTier, { eliteMul: number; minHp: number; minSec: number }>,
  /** 速度上限可以蓄多少秒的量（连打一阵后停一下再打，不会一下全吃掉）。 */
  bankSec: 1.5,
  /** 火伤加成（烧营）。 */
  fireMul: 1.5,
  /** 主将离营寨超过 rangedFrom 时，非火伤害 × rangedMul（隔着营栅 / 远远射）。 */
  rangedFrom: 200, rangedMul: .6,
  /** 部曲 / 义军打营寨的伤害倍率。 */
  allyMul: .5,
  /** 主将第一次走近多少内，营门出一队守军。 */
  guardR: 520,
  /** 营寨挨打后多少毫秒内算「正被攻打」：本营出兵间隔再 × hitHurryMul。 */
  hitHurryMs: 3000, hitHurryMul: .6,
  /** 半血：起火 + 号角 + 伏兵 ambush 人；附近 nearbyR 内其他营寨马上出兵。 */
  burnAt: .5, ambush: 4, ambushR: 170, nearbyR: 900,
  /** 快拆完：守将出营。 */
  captainAt: .2,
  /** 拆掉：撒几颗军功宝石、每颗经验。 */
  gems: 6, gemXp: 3,
} as const;
