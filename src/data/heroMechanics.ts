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
