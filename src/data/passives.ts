import type { CharacterId } from './characters';
export const CHARACTER_PASSIVES: Record<CharacterId, { name: string; maxStacks: number }> = {
  zhaoyun: { name: '七进七出', maxStacks: 7 },
  guanyu: { name: '势如破竹', maxStacks: 3 },
  huangzhong: { name: '老当益壮', maxStacks: 0 },
  zhuge: { name: '运筹帷幄', maxStacks: 3 },
  zhangfei: { name: '燕人咆哮', maxStacks: 5 },
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
  coneThreshold: 3, guandaoRangePerStack: .06, guandaoDamageMul: 1.25,
  calmMs: 3000, critBonus: .10,
  mechIntervalMs: 250, mechBolts: 6, mechDamageMul: .6,
  /** 魏延·镇北环首刀：直线裂波（长 / 总宽 / 贴身距离与加成）；镇守汉中：受击积拒敌（每 0.5 秒最多 1 层）；
   *  满层「谁敢杀我」：6 向裂波各 80%，并 3 秒受伤 -30%。 */
  crackLen: 200, crackWidth: 56, crackCloseRange: 60, crackCloseMul: 1.3, guardStepMs: 500,
  whoDaresDirs: 6, whoDaresDamageMul: .8, whoDaresGuardMs: 3000, whoDaresGuardMul: .7,
  /** 庞统·凤雏连环令：定时在脚下落雷（间隔 / 身旁偏移）；火雷（上限 / 存在 / 落雷后待发 / 触发半径 / 爆炸半径 / 连锁距离 / 连锁间隔）；到期或超上限只原地炸开、不连锁；
   *  连环计：一次连锁引爆 ≥3 枚积 1 层计策，满层「火烧连环」：身边 6 枚环形火雷，踏入或 2 秒后齐爆并留火 2 秒；
   *  落凤坡：生命 <30% 时脚下布 4 枚火雷（每 30 秒最多一次）。 */
  // 2026-11-16 重做（用户批准）：脚下定时落雷（0.7 秒；Lv3 起 0.6 秒），生效 0.35 → 0.5 秒，连锁距离 130 → 150（移速加成时雷链仍连得上）
  mineDropSec: .7, mineDropFastSec: .6, mineSideOffset: 45,
  mineMax: 6, mineLifeMs: 8000, mineArmMs: 500, mineTrigger: 26, mineRadius: 70, mineChainRange: 150, mineChainDelayMs: 150, mineChainStack: 3,
  ringMines: 6, ringRadius: 110, ringFuseMs: 2000, ringFireMs: 2000, fengpoHp: .3, fengpoCooldownMs: 30000, fengpoMines: 4,
  liubeiDamageMul: 1.15, liubeiHeal: .08, liubeiRally: .35,
  cavalryIntervalMs: 300, dashLength: 150, dashWidth: 56, dashDamageMul: 1.6, dashMs: 200,
  roarIntervalMs: 350, roarRadius: 175, roarStunMs: 1200, roarDamageMul: 1.4,
  /** 孙尚香·侍婢执刀：移动中每 0.5 秒积 1 层疾步（满 6）；满层召 2 名执刀侍婢护身 8 秒（上限 4 名），绕身 70 像素内每 0.5 秒挥刀 60% 伤害。 */
  stepIntervalMs: 500, maidSummon: 2, maidMax: 4, maidMs: 8000, maidRange: 70, maidSlashMs: 500, maidDamageMul: .6,
  /** 孙尚香·弓腰姬飞刀：环绕刀（半径 / 每名敌人割伤间隔）、掷刀（射程 / 速度 / 穿透 / 补刀时间 / 移动中间隔倍率）。 */
  knifeOrbitR: 55, knifeOrbitHitMs: 500, knifeRange: 380, knifeSpeed: 650, knifePierce: 2, knifeRegenMs: 1200, knifeMovingCdMul: .7,
  /** 貂蝉·双花扇：回旋飞扇（距离 / 速度）；离间：魅惑 3 层倒戈 3 秒（精锐减半），倒戈者受伤 +20%、冲向 260 内最近同伴每 0.5 秒撞一次；首领改为 3 秒受伤 +25%；4 秒没扇中魅惑消散。 */
  fanRange: 230, fanSpeed: 520, charmNeed: 3, turnMs: 3000, turnVulnerability: 1.2, charmVulnerability: 1.25, turnSeek: 260, turnHitMs: 500, charmDecayMs: 4000,
  /** 貂蝉·闭月：舞带环身 2 秒，半径 160，每 0.4 秒 50% 伤害，圈内敌人倒戈。 */
  moonMs: 2000, moonRadius: 160, moonTickMs: 400, moonDamageMul: .5,
  fireRadiusMul: 1.25, burnMs: 2000, burnTickMs: 1000, burnDamageFraction: .10,
} as const;
