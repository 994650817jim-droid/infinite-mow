/**
 * 重整构筑（用户 2026-11-19：「技能3选一……选了之后就不可以改，只有返回休整才可以花费军粮改回初始」）。
 * 战斗中三选一选了就定（GameScene.chooseUpgrade 立即生效、没有撤回）；只有在行营休整「将帅帐」花随军粮重整：
 * 本次征程的构筑退回初始（战法 / 武艺 / 本命兵器等级 / 兵器专职 / 研读的心法），退回的强化次数当场在休整里一张张重选（选不完的下一关开打时补上）。
 * 不退：武将等级与属性点、兵装信物、随从、军需商人花粮买的战法 / 心法。
 * 价格 = (base + perPick × 退回次数) × (1 + chapterMul × (章 − 1))，每章最多 perChapter 次。初值，交平衡会话。
 */
// 2026-11-19 平衡：perPick 10 → 6、chapterMul .25 → .15（原第五章 40 次构筑要 880 粮，约一整章的随军粮；现约 450，第十章约 770）
export const RESPEC = { base: 40, perPick: 6, chapterMul: .15, perChapter: 2 } as const;
export function respecCost(picks: number, chapter: number): number {
  return Math.round((RESPEC.base + RESPEC.perPick * Math.max(0, picks)) * (1 + RESPEC.chapterMul * Math.max(0, chapter - 1)));
}
