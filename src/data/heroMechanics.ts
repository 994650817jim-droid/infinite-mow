/**
 * 武将机制改动（2026-11-18 平衡审查第 2、3 步，用户同意；方案见统筹笔记 hero-balance-review.md）。
 * 与平衡组的全局数值（data/passives.ts 等）分开放，避免两边同时改同一文件。初值待平衡组复测。
 */

/** 黄忠·神射（方案 1）：重箭命中积「蓄势」，满层进入神射一段时间；受伤只掉 1 层（不再要求 5 秒不受伤）。 */
export const HZ_SHARP = {
  /** 进入神射所需蓄势层数（每支重箭命中积 1 层；三连扇形的两侧箭、爆裂溅射不积层） */
  need: 4, // 2026-11-18 平衡：5 → 4
  /** 神射持续（毫秒）；静心每级再 +jingxinExtraMs */
  sharpMs: 6000, jingxinExtraMs: 1000,
  /** 受伤掉 1 层蓄势（神射中不掉、也不退出）；两次掉层至少间隔 */
  hurtDropGapMs: 500,
  /** 老骥伏枥 3 级「宝刀未老」：神射中射杀精锐 / 首领，神射延长 */
  laojiExtendMs: 2000,
} as const;

/** 魏延·拒敌（方案 1）：除了受伤积层，身边 radius 内每有 perEnemies 名敌人，每秒再积 stacksPerSec 层（孤军深入、被围反击）。 */
export const WY_SURROUND = { radius: 120, perEnemies: 3, stacksPerSec: 1 } as const;

/** 刘备·统御（主属性）对本人也有收益（平衡审查：统御 10 点本人 DPS 只 +2%，全给了部曲）：每点（按实际加点，不乘主属性倍率）本人受伤 −selfGuardPerPoint，最多 maxPoints 点。 */
export const LB_COMMAND = { selfGuardPerPoint: .01, maxPoints: 10 } as const;

/**
 * 诸葛亮重做（2026-11-18，用户选方案 A，见统筹笔记 zhuge-rework-proposal.md）：单点爆发军师，和庞统（布雷控场）分开。
 *  - 七星灯 · 天火（武器 id 仍为 flame_banner）：目标脚下标星位，delayMs 后天火落下；单体高伤（约旧单发 2.5 倍），周围 splashRadius 溅射 splashMul；
 *    选靶：关卡锁定 > 首领 > 精锐 > 当前血最多；冷却 cooldown 秒（每级 −cdPerLevel）。智力每点（按实际加点）天火伤害 +intPerPoint。
 *  - 观星（被动）：同一目标每吃一发天火积 1 层星象，满 starNeed 层后，下一发对它必暴击且伤害 ×burstMul（「算无遗策」），然后清层；
 *    最多同时记 starTargets 个目标，starDecayMs 没再打中就散。
 *  - 借东风（技艺，替换烽火燎原，id 仍为 wildfire）：每第 every 发天火同时放出东风火龙，朝目标方向直线扫过（长 len、宽 width），每级伤害 mul。
 *  - 八阵图（技艺，id 仍为 eight_trigrams）：观星爆发命中处布阵 ms（半径 radius），阵内非首领减速 slow、所有敌人受伤 ×vuln；3 级时阵内首领出招间隔 ×bossGapMul。
 */
/** 庞统·火烧连环（平衡审查：和诸葛亮分开，强调控场）：火环从布下到落火结束，圈内非首领敌人减速 slow。 */
export const PT_RING = { slow: .2 } as const;

export const ZG_TIANHUO = {
  base: 55, perLevel: .18, cooldown: 2.6, cdPerLevel: .05, range: 420,
  delayMs: 800, splashRadius: 50, splashMul: .3, intPerPoint: .015,
  /** 2026-11-18 用户试玩：「诸葛亮的普通攻击打不到集群的怪堆」→ 没有首领 / 精锐时按通用 smartTarget 的「群怪」规则打进怪堆中心，
   *  打杂兵时溅射加大（crowdSplashRadius / crowdSplashMul）；打首领 / 精锐维持单点 + 小溅射。借东风朝怪最密的方向扫。初值，交平衡组复测。 */
  crowdSplashRadius: 90, crowdSplashMul: .4,
  starNeed: 3, starTargets: 5, starDecayMs: 4000, burstMul: 2,
  eastWind: { every: 4, len: [300, 340, 380] as readonly number[], width: 56, mul: [.6, .75, .9] as readonly number[] },
  bazhen: { radius: [90, 105, 120] as readonly number[], ms: [2000, 2500, 3000] as readonly number[], slow: .4, vuln: 1.15, bossGapMul: 1.25 },
} as const;
/** 某武将某属性的额外说明（属性面板 / 主属性章悬停里追加）；没有返回 ''。 */
export function heroAttributeExtra(hero: string, attr: string): string {
  return hero === 'liubei' && attr === 'command' ? `刘备本人受伤 −${Math.round(LB_COMMAND.selfGuardPerPoint * 100)}% / 点` : '';
}
