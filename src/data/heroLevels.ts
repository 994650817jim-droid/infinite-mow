/**
 * 只留武将等级（2026-11-17 用户：「没用局内等级只有总等级」，选「武将升级时弹三选一」；数值见共享笔记 level-merge-proposal.md）。
 * 打怪经验直接加武将等级；每升 1 级弹一次三选一并给 1 个属性点。每章大约打完最后一关时刚好到上限。
 */
/** 升到下一级所需经验（Lv1→2 起）。累计：Lv5 100、Lv10 1280、Lv15 7280、Lv20 16030、Lv25 27280、Lv30 40780。 */
const TABLE: readonly number[] = [
  16, 20, 28, 36,                 // Lv1–5
  120, 160, 220, 300, 380,        // Lv5–10
  1100, 1150, 1200, 1250, 1300,   // Lv10–15（第二章）
];
export function heroXpToNext(level: number): number {
  const lv = Math.max(1, Math.floor(level));
  if (lv - 1 < TABLE.length) return TABLE[lv - 1];
  return lv < 20 ? 1750 : lv < 25 ? 2250 : 2700;
}

/** 经验倍率：主线首次打 1.0；攻城 / 军情 / 挑战 / 重打旧关 0.5。首次通关经验另加，不乘。 */
export const HERO_XP_RATE = { main: 1, side: .5 } as const;
/** 到上限后：经验最多再存 1 级的量，其余每 50 经验折 1 军粮。 */
export const OVERFLOW_XP_PER_GRAIN = 50;
/**
 * 每关保底三选一次数：升级次数不够时补「军略」（同一个三选一，但不给属性点）。
 * 补发时点：第 1 / 2 / 3 波清完至少 1 / 2 / 3 次，打开首领宝箱至少 4 次（攻城 / 军情 / 挑战 / 重打旧关最多保底 3 次）。
 */
export const PICK_GUARANTEE = { main: 4, side: 3, waves: [1, 2, 3] } as const;
