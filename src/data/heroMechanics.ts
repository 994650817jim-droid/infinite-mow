/**
 * 武将机制改动（2026-11-18 平衡审查第 2、3 步，用户同意；方案见统筹笔记 hero-balance-review.md）。
 * 与平衡组的全局数值（data/passives.ts 等）分开放，避免两边同时改同一文件。初值待平衡组复测。
 */

/** 黄忠·神射（方案 1）：重箭命中积「蓄势」，满层进入神射一段时间；受伤只掉 1 层（不再要求 5 秒不受伤）。 */
export const HZ_SHARP = {
  /** 进入神射所需蓄势层数（每支重箭命中积 1 层；三连扇形的两侧箭、爆裂溅射不积层） */
  need: 5,
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

/** 诸葛亮前期（平衡审查第 3 步之一，方案 2：1-1 首领掉血 0%、DPS 26 全员最低）：烈焰战旗 Lv1–3 伤害 ×earlyMul（审查建议 Lv1–2 各 +40%，
 *  但那样 Lv2 36 > Lv3 30、升级反而掉伤害，改成逐级递减的加成：Lv1–5 = 30.8 / 32.5 / 33.5 / 33.9 / 37.8，仍逐级递增）；谋略满层 3 → stratagemMax。
 *  单点爆发重做另写方案（统筹转用户确认后再做）。 */
export const ZG_EARLY = { earlyMul: [1.4, 1.25, 1.12] as readonly number[], stratagemMax: 2 } as const;
/** 某武将某属性的额外说明（属性面板 / 主属性章悬停里追加）；没有返回 ''。 */
export function heroAttributeExtra(hero: string, attr: string): string {
  return hero === 'liubei' && attr === 'command' ? `刘备本人受伤 −${Math.round(LB_COMMAND.selfGuardPerPoint * 100)}% / 点` : '';
}
