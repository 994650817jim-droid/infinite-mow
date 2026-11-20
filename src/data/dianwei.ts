/**
 * P3 第二批可玩武将 · 典韦（共享笔记 p3-heroes-plan.md §三 + 设计会话意见，2026-11-20；初值，交平衡会话）：古之恶来，猛将 + 兵阵。
 * - 本命「双铁戟」：朝最近的 throws 个敌兵各掷一支短戟（穿透、飞 throwRange），每第 whirlEvery 击原地旋风（半径 whirlR，whirlMul）。
 * - 被动「恶来」：每次受伤攒 1 点（gainGapMs 内最多 1 点），满 need 点「古之恶来」rageMs：受伤 ×rageGuard、每 rageWhirlMs 自动旋风一次。
 * - 分支（猛将）「宛城死战」：半血以下旋风半径 ×sizhan.rMul、旋风伤害的 sizhan.leech 回血；进阶：不看血量常驻，且每第 3 击就旋风。
 * - 分支（兵阵）「护主」：每 huzhu.everyMs 护主一次——身边 huzhu.r 内部曲得护盾（最大生命 × huzhu.shield，huzhu.shieldMs）；身边部曲常驻攻速 +huzhu.haste。
 *   进阶：护盾 ×huzhu.finalShieldMul、间隔 huzhu.finalEveryMs。（设计会话：两条都是猛将「契合」等于没得选，专职乙改兵阵。）
 * - 武艺「铁戟」：每掷多 tieji[级] 支；「护卫」：旋风半径每级 +huwei。
 * 图：随军典韦 allies-v2/dianwei_walk / _attack（tools/boss-to-hero-sheets.py 拼成可玩武将图集，没有受伤 / 倒地帧）；
 *   特效全用随军典韦那套手绘图 dianwei-fx（掷戟 / 旋风 / 命中 / 狂怒）与 dianwei_halberd 小戟。
 */
export const DIANWEI = {
  range: 260, throws: 2, throwRange: 300, throwSpeed: 720, throwW: 24, throwMul: .9,
  whirlEvery: 4, whirlR: [100, 104, 108, 114, 120] as readonly number[], whirlMul: 1.15, whirlShove: 22,
  need: 10, gainGapMs: 400, rageMs: 6000, rageGuard: .6, rageWhirlMs: 800,
  sizhan: { hpBelow: .5, rMul: 1.3, leech: .04, finalEvery: 3 },
  huzhu: { everyMs: 5000, r: 200, shield: .12, shieldMs: 4000, haste: .15, finalShieldMul: 1.6, finalEveryMs: 4000 },
  tieji: [0, 1, 1, 2] as readonly number[], huwei: .12,
} as const;
