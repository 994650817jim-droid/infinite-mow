/**
 * P3 第二批可玩武将 · 孙权（共享笔记 p3-heroes-plan.md §三，2026-11-20；初值，交平衡会话）：坐断东南的碧眼儿，兵阵 + 弓弩。
 * - 本命「古锭刀 · 令箭」：近身扇形刀斩（reach），每第 volleyEvery 斩令江东弓手朝最密处齐射（volleyDelayMs 后落下，半径 volleyR，volleyMul）。
 * - 被动「制衡」：任意击杀攒 1 点，满 need 点切到下一阵势（守 → 攻 → 疾 → 守…，开局守势）：
 *   守势：受伤 ×stance.guard，身边部曲每秒回 stance.heal 最大生命；攻势：每第 stance.atkEvery 斩就齐射、齐射伤害 ×stance.atkMul；疾势：移速 ×stance.speed、出手间隔 ÷stance.haste。
 * - 分支（兵阵）「坐断东南」：阵势效果加倍（向 1 的距离 ×2）；切阵势时身边部曲得护盾（zuoduan.shield）。进阶：切阵势时再朝最密处齐射一次。
 * - 分支（弓弩）「江东弓弩」：齐射半径 ×gongnu.rMul、每第 gongnu.every 斩就齐射，落点留减速 gongnu.slowMs。进阶：齐射连发两轮。
 * - 武艺「碧眼」：齐射伤害每级 +biyan；「紫髯」：刀斩距离每级 +ziran。
 * 图：首领版 bosses-v2/side_sunquan（tools/boss-to-hero-sheets.py 拼成）；水墨用 ink-cast 孙权（紫袍，行走图绿袍，缺图清单 #7 可选）。
 *   特效借现成手绘：刀光 fx_md_slash（曹操剑斩换青）、齐射 fx_awaken_archery、阵势 fx_awaken_formation / archery / cavalry。
 */
export const SUNQUAN = {
  reach: [100, 105, 110, 116, 124] as readonly number[], arc: 1, slashMul: 1,
  volleyEvery: 4, volleyRange: 360, volleyDelayMs: 450, volleyR: 86, volleyMul: 1.1,
  need: 15,
  stance: { guard: .85, heal: .01, atkEvery: 3, atkMul: 1.25, speed: 1.15, haste: 1.15 },
  zuoduan: { shield: .12, shieldMs: 4000, r: 220 },
  gongnu: { rMul: 1.3, every: 3, slowMs: 2000, slow: .4, finalRounds: 2, roundGapMs: 260 },
  biyan: .15, ziran: .1,
} as const;
export const SUNQUAN_STANCES = ['守势', '攻势', '疾势'] as const;
