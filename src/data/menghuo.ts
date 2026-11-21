/**
 * P3 第二批可玩武将 · 孟获（共享笔记 p3-heroes-plan.md §三，2026-11-20；初值，交平衡会话）：南蛮王，猛将 + 兵阵。
 * - 本命「南蛮大刀」：前方大扇面重劈（reach、arc），沿劈的方向裂地一线（crackLen × crackW，crackMul）。
 * - 被动「南蛮王」：任意击杀攒 1 点，满 need 点「驱兽冲阵」：beasts 头猛兽从主将身后沿最密一线冲过 chargeLen（chargeMs），每头每个敌兵最多撞一下（chargeMul、推开 shove）。
 * - 分支（猛将）「七擒不服」：受伤攒「不服」（gapMs 内最多 1 层，最多 max 层），每层伤害 +per，decayMs 没再挨打就清空。进阶：满层时重劈裂地两次。
 * - 分支（兵阵）「南中象阵」：猛兽换成象兵（xiang.beasts 头），撞中眩晕 xiang.stunMs，只需 xiang.need 点。进阶：象兵冲过去再冲回来。
 * - 武艺「蛮力」：重劈距离每级 +manli；「藤甲」：受伤每级 −tengjia。
 * 图：首领版 bosses-v2/nz_menghuo（tools/boss-to-hero-sheets.py 拼成）；水墨 ink-cast 孟获。
 *   特效借现成手绘：刀光 fx_md_slash（换赤）、裂地 weiyan_crack（魏延）；猛兽 / 象兵借第十一章南中兵种图 enemy_beast_walk / nz_elephant_walk（另起键载入）。
 */
export const MENGHUO = {
  reach: [118, 124, 130, 137, 145] as readonly number[], arc: 1.15, cleaveMul: 1.2, crackLen: 170, crackW: 48, crackMul: .7,
  need: 20, beasts: 4, chargeLen: 540, chargeMs: 760, chargeW: 44, chargeGap: 46, chargeMul: 1.4, shove: 40,
  bufu: { gapMs: 1000, max: 7, per: .06, decayMs: 6000 },
  xiang: { beasts: 6, stunMs: 800, need: 16 },
  manli: .1, tengjia: .04,
  /** 2026-11-20 平衡（P3 复核）：首领体型大，重劈 ×1.2 + 裂地 ×0.7 每刀都两下全中，首领用时只有中位数的 0.38 倍；重劈 / 裂地打首领 ×bossMul（猛兽冲阵不变）。 */
  bossMul: .45, // 先试 .6 仍 0.51 倍
} as const;
