import type { CharacterId } from './characters';
export const CHARACTER_PASSIVES: Record<CharacterId, { name: string; maxStacks: number }> = {
  zhaoyun: { name: '七进七出', maxStacks: 7 },
  guanyu: { name: '势如破竹', maxStacks: 3 },
  huangzhong: { name: '老当益壮', maxStacks: 0 },
  zhuge: { name: '运筹帷幄', maxStacks: 3 },
  zhangfei: { name: '据水断桥', maxStacks: 5 },
  huangyueying: { name: '机关连弩', maxStacks: 8 },
  pangtong: { name: '连环计', maxStacks: 3 },
  liubei: { name: '仁德聚义', maxStacks: 4 },
  weiyan: { name: '镇守汉中', maxStacks: 5 },
  machao: { name: '西凉铁骑', maxStacks: 6 },
  sunshangxiang: { name: '侍婢执刀', maxStacks: 6 },
  diaochan: { name: '离间', maxStacks: 5 },
};
export const PASSIVE_RULES = {
  dragonIntervalMs: 150, spearLengthMul: 1.25,
  // 2026-11-16 平衡：势如破竹每层范围 +6% → +4%（关羽范围削弱）
  coneThreshold: 3, guandaoRangePerStack: .04, guandaoDamageMul: 1.25,
  calmMs: 5000, critBonus: .10, // 2026-11-16 用户要求：黄忠神射蓄势 3 → 5 秒
  mechIntervalMs: 250, mechBolts: 6, mechDamageMul: .6,
  /** 魏延·镇北环首刀：直线裂波（长 / 总宽 / 贴身距离与加成）；镇守汉中：受击积拒敌（每 0.5 秒最多 1 层）；
   *  满层「谁敢杀我」：6 向裂波各 80%，并 3 秒受伤 -30%。 */
  crackLen: 200, crackWidth: 56, crackCloseRange: 60, crackCloseMul: 1.3, guardStepMs: 500,
  whoDaresDirs: 6, whoDaresDamageMul: .8, whoDaresGuardMs: 3000, whoDaresGuardMul: .7,
  /** 庞统·凤雏连环令：定时在脚下落雷（间隔 / 身旁偏移）；火雷（上限 / 存在 / 落雷后待发 / 触发半径 / 爆炸半径 / 连锁距离 / 连锁间隔）；到期或超上限只原地炸开、不连锁；
   *  连环计：一次连锁引爆 ≥3 枚积 1 层计策，满层「火烧连环」：身边 6 枚环形火雷，踏入或 2 秒后齐爆并留火 2 秒；
   *  落凤坡：生命 <30% 时脚下布 4 枚火雷（每 30 秒最多一次）。 */
  // 2026-11-16 重做（用户批准）：脚下定时落雷（0.7 秒；Lv3 起 0.6 秒），生效 0.35 → 0.5 秒，连锁距离 130 → 150（移速加成时雷链仍连得上）
  mineDropSec: .7, mineDropFastSec: .6,
  /** 2026-11-16 方案 A「铁索连环」（用户选定，初值待平衡）：铁索最长 / 判定宽 / 减速 / Lv2 灼伤倍率与间隔 / Lv3 火走铁索倍率 / Lv4 火雷上限加成；
   *  Lv5 铁索连舟：新雷挨近至少 loopBackSteps 枚之前的旧雷即首尾相接，围出面积 ≥ loopMinArea 时圈内地火 loopMs（每 loopTickMs 灼伤 loopMul、减速 loopSlow），之后整圈齐爆。 */
  tetherLen: 150, tetherWidth: 16, tetherSlow: .25, tetherBurnMul: .2, tetherTickMs: 500, fireRunMul: .6, mineMaxLv4Bonus: 2,
  loopBackSteps: 3, loopMinArea: 9000, loopMs: 3000, loopTickMs: 500, loopMul: .25, loopSlow: .4,
  /** 2026-11-16 用户：「地雷触发太快了，炸不到人」→ 敌人踩雷后先烧引信 mineFuseMs 再爆（雷芯由慢到快闪红示警），期间再有人踩不重新计时，让后面的敌人也走进爆炸范围；
   *  火烧连环圈被踏入时同样改为引信。连锁（mineChainDelayMs）与到期自爆维持原速。 */
  mineFuseMs: 1000,
  mineMax: 6, mineLifeMs: 8000, mineArmMs: 500, mineTrigger: 26, mineRadius: 70, mineChainRange: 150, mineChainDelayMs: 150, mineChainStack: 3,
  ringMines: 6, ringRadius: 110, ringFuseMs: 2000, ringFireMs: 2000, fengpoHp: .3, fengpoCooldownMs: 30000, fengpoMines: 4,
  liubeiDamageMul: 1.15, liubeiHeal: .08, liubeiRally: .35,
  cavalryIntervalMs: 300, dashLength: 150, dashWidth: 56, dashDamageMul: 1.6, dashMs: 200,
  roarIntervalMs: 350, roarRadius: 175, roarStunMs: 1200, roarDamageMul: 1.4,
  /** 孙尚香·侍婢执刀：移动中每 0.5 秒积 1 层疾步（满 6）；满层召 2 名执刀侍婢护身 8 秒（上限 4 名），绕身 70 像素内每 0.5 秒挥刀 60% 伤害。 */
  // 2026-11-16 成长曲线调整（用户批准，平衡会话核对）：疾步 0.5 → 0.8 秒、侍婢上限 4 → 3、持续 8 → 6 秒；侍婢伤害随武器等级 50% → 70%（原固定 60%）
  stepIntervalMs: 800, maidSummon: 2, maidMax: 3, maidMs: 6000, maidRange: 70, maidSlashMs: 500, maidDamageByLevel: [.5, .55, .6, .65, .7],
  /** 孙尚香·弓腰姬飞刀：环绕刀（半径 / 每名敌人割伤间隔）、掷刀（射程 / 速度 / 穿透 / 补刀时间 / 移动中间隔倍率）。 */
  knifeOrbitR: 55, knifeOrbitHitMs: 500, knifeRange: 380, knifeSpeed: 650, knifeRegenMs: 1200, knifeMovingCdMul: .7,
  /** 每次掷几把（多出的飞向别的敌人、伤害 knifeExtraMul）与每把穿透人数，按武器等级 Lv1–Lv5。 */
  knifeCountByLevel: [1, 1, 2, 2, 3], knifePierceByLevel: [2, 2, 3, 3, 4], knifeExtraMul: .6,
  /** 貂蝉·双花扇：回旋飞扇（距离 / 速度）；离间：魅惑 3 层倒戈 3 秒（精锐减半），倒戈者受伤 +20%、冲向 260 内最近同伴每 0.5 秒撞一次；首领改为 3 秒受伤 +25%；4 秒没扇中魅惑消散。 */
  // 2026-11-16 平衡（12 将基线：1-1 整关放不出大招）：倒戈所需扇中次数 3 → 2
  fanRange: 230, fanSpeed: 520, charmNeed: 2, turnMs: 3000, turnVulnerability: 1.2, charmVulnerability: 1.25, turnSeek: 260, turnHitMs: 500, charmDecayMs: 4000,
  /** 貂蝉·闭月：舞带环身 2 秒，半径 160，每 0.4 秒 50% 伤害，圈内敌人倒戈。 */
  moonMs: 2000, moonRadius: 160, moonTickMs: 400, moonDamageMul: .5,
  /** 黄忠·宝雕弓：重箭（速度 / 射程 / 击退）；神射时命中处小范围爆裂（半径 / 伤害倍率）。 */
  heavyArrowSpeed: 900, heavyArrowRange: 600, heavyArrowKnock: 40, heavyBurstRadius: 60, heavyBurstMul: .5,
  /** 张飞·当阳喝断：声浪推进速度 / 推后力度；据水断桥：断桥区半径与持续。震慑与 140% 伤害沿用 roarRadius / roarStunMs / roarDamageMul。 */
  roarWaveSpeed: 480, roarWavePush: 2.5, bridgeRadius: 150, bridgeMs: 3000,
  /** 马超·枪挑破阵：挑飞（索敌距离 / 腾空时长 / 挑起伤害倍率）、落地范围半径；西凉铁骑满层冲锋（距离 / 宽 / 伤害倍率 / 突进时长）。命中积层间隔沿用 cavalryIntervalMs。 */
  liftRange: 150, liftMs: 600, liftHitMul: .6, landRadius: 70, chargeLen: 180, chargeWidth: 56, chargeDamageMul: 1.6, chargeMs: 220,
  /** 刘备·双股剑：出手距离、「×」斩溅射半径与倍率；一剑砍两人积 1 层仁德。 */
  swordsRange: 120, crossSplash: 30, crossSplashMul: .6, liubeiHaste: .3, liubeiHasteMs: 4000,
  fireRadiusMul: 1.25, burnMs: 2000, burnTickMs: 1000, burnDamageFraction: .10,
} as const;
