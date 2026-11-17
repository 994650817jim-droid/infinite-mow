/**
 * 战功换武学残卷（2026-11-17 用户：「战功变成可以换残卷」）。数值待复核（平衡会话定）。
 * 战功 = 局内等级，跨关继承（征程构筑）。每关打赢结算时，只按本关新涨的等级换残卷：
 * 每跨过一个「每 levelsPerScroll 级」的门槛给 1 张（Lv.1→4 给 1 张，Lv.4→7 再给 1 张……），
 * 所以零头会留到下一关接着算，同一段等级不会换两次。失败 / 放弃不给（构筑退回开打前，等级会重打）。
 */
export const MERIT_SCROLL = { levelsPerScroll: 3 } as const;

/** 从 startLevel 升到 endLevel 换得的残卷张数。 */
export function meritScrolls(startLevel: number, endLevel: number): number {
  const k = MERIT_SCROLL.levelsPerScroll, a = Math.max(1, Math.floor(startLevel)), b = Math.max(a, Math.floor(endLevel));
  return Math.floor((b - 1) / k) - Math.floor((a - 1) / k);
}
