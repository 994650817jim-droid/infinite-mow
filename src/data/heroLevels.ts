/**
 * 只留武将等级（2026-11-17 用户：「没用局内等级只有总等级」，选「武将升级时弹三选一」；数值见共享笔记 level-merge-proposal.md）。
 * 打怪经验直接加武将等级；每升 1 级弹一次三选一并给 1 个属性点。每章大约打完最后一关时刚好到上限。
 */
/** 升到下一级所需经验（Lv1→2 起）。累计：Lv5 100、Lv10 1280、Lv15 7280、Lv20 16030、Lv25 27280、Lv30 40780。 */
const TABLE: readonly number[] = [
  16, 20, 28, 36,                 // Lv1–5
  120, 150, 180, 210, 240,        // Lv5–10（第一章）
];
/**
 * 2026-11-19 波数 / 等级重做（wave-progression-redesign.md §3.3，用户选上限 B：10 / 14 / … / 54，每章 +4）：
 * 每章可得 = 3 关 × 约 320 局内经验 × 章节倍率 + 3 × 首通，摊到本章的 4 级。实现后由平衡会话实测再校。
 */
const BANDS: ReadonlyArray<readonly [number, number]> = [[14, 550], [18, 765], [22, 985], [26, 1200], [30, 1420], [34, 1635], [38, 1855], [42, 2070], [46, 2290], [50, 2505], [54, 2725]];
export function heroXpToNext(level: number): number {
  const lv = Math.max(1, Math.floor(level));
  if (lv - 1 < TABLE.length) return TABLE[lv - 1];
  for (const [top, xp] of BANDS) if (lv < top) return xp;
  return BANDS[BANDS.length - 1][1];
}
/** 宝石经验的章节倍率：第 n 章 ×(1 + 0.5 × (n − 1))，第十二章 ×6.5（小兵经验各章一样，靠这个让经验跟上更高的等级上限）。 */
export function chapterXpMul(chapter: number): number { return 1 + .5 * (Math.max(1, Math.min(12, Math.floor(chapter))) - 1); }

/** 经验倍率：主线首次打 1.0；攻城 / 军情 / 挑战 / 重打旧关 0.5。首次通关经验另加，不乘。 */
export const HERO_XP_RATE = { main: 1, side: .5 } as const;
/** 到上限后：经验最多再存 1 级的量，其余每 50 经验折 1 军粮。 */
export const OVERFLOW_XP_PER_GRAIN = 50;
/**
 * 每关保底三选一次数：升级次数不够时补「军略」（同一个三选一，但不给属性点）。
 * 补发时点：第 1 / 2 / 3 波清完至少 1 / 2 / 3 次，打开首领宝箱至少 4 次（攻城 / 军情 / 挑战 / 重打旧关最多保底 3 次）。
 */
export const PICK_GUARANTEE = { main: 4, side: 3, waves: [1, 2, 3] } as const;
/**
 * 三选一节奏（2026-11-17 用户：「中期好像3选一触发的太频繁了」；初值，待平衡会话复核）。第一章（新手期）不套用，节奏照旧。
 * 测量（tools/measure-levelup-pace.mjs）：第二章起每关几乎不升级（关内 0–1 级），4 次三选一基本都是军略保底，
 * 落在 0:45 / 1:30 / 1:30（第 2 波清完与首领登场同时补，连弹两次）/ 首领宝箱，短关 2 分半里停 4 回。
 * - 保底「次数」（每关可选张数）不变：主线 4、其余 3，总强度不降；
 * - 但第 2 波不再单独补，首领登场补到 2，首领宝箱一次补齐剩下的（同一个面板「连选 2 张」）→ 每关弹 3 次面板；
 * - 同一关两次面板至少隔 minGapSec 秒（关内时间），不到时间的升级 / 保底先攒着，到点合成一个面板连选；
 * - 一次攒了几张就在同一个面板里连选几张（选完一张原地换一批），不再一张一张地开关面板。
 */
export const PICK_PACE = {
  /** 从第几章起套用（第一章 huangjin 不变）。 */
  fromChapter: 2,
  /** 同一关两次三选一面板的最短间隔（秒，关内时间）。宝箱 / 转关时的补发不受限。 */
  minGapSec: 50,
  /** 保底节点：第 1 / 2 / 3 波清完（首领登场按最后一项）至少给几张；宝箱时补到 PICK_GUARANTEE.main / side。 */
  waves: [1, 1, 2],
} as const;

/**
 * 等级软上限（2026-11-20 用户「等级有上限不太行……可以慢慢提升在那一关适合的需要升级的经验」，统筹定 A+C；共享笔记 level-curve-redesign.md）：
 * - 没有硬上限：每关有「建议等级」（HeroProgress.suggestedLevel，原上限表当参考），越过之后每级所需经验 ×overMul（逐级相乘）。
 * - 经验条分 steps 段：每满一段（不到整级）一次「小成」——不暂停，屏幕上方滑出 3 个小图标（心法 / 军资 / 体魄 / 回血），按 1 / 2 / 3 或点击选，autoMs 没选自动给第一个。
 *   满一整级照旧暂停弹三选一、给属性点。
 */
export const SOFT_CAP = { overMul: 1.45, steps: 4, autoMs: 5000 } as const;
/**
 * 经验挪进关内（统筹 2026-11-20：关内大升级从约 1 次变成 1–2 次，总经验与长期曲线基本不变）：
 * 宝石经验（击杀 / 精锐 / 副将 / 首领 / 机缘宝石）×gem，首次通关经验 ×firstClear。实测（tools/measure-stage-xp.mjs，捡满）一关局内 650–1150：
 * 按 ×1.4 / ×0.35 一章总经验约 −10%～+11%，交平衡会话（local_1085cd6a）模拟复核。
 */
export const XP_SHIFT = { gem: 1.4, firstClear: .35 } as const;
/** 升到下一级所需经验（软上限后）：soft = 建议等级（不给 = 不加成）。 */
export function heroXpNeed(level: number, soft = Infinity): number {
  const lv = Math.max(1, Math.floor(level)), over = Math.max(0, lv - soft);
  return Math.round(heroXpToNext(lv) * Math.pow(SOFT_CAP.overMul, over));
}
