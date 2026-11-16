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
  sunshangxiang: { name: '弓腰姬', maxStacks: 6 },
  diaochan: { name: '闭月倾城', maxStacks: 3 },
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
  /** 庞统·凤雏连环令：火雷（上限 / 存在 / 布雷后待发 / 触发半径 / 爆炸半径 / 连锁距离 / 连锁间隔）；
   *  连环计：一次连锁引爆 ≥3 枚积 1 层计策，满层「火烧连环」：身边 6 枚环形火雷，踏入或 2 秒后齐爆并留火 2 秒；
   *  落凤坡：生命 <30% 时脚下布 4 枚火雷（每 30 秒最多一次）。 */
  mineMax: 6, mineLifeMs: 8000, mineArmMs: 350, mineTrigger: 26, mineRadius: 70, mineChainRange: 130, mineChainDelayMs: 150, mineChainStack: 3,
  ringMines: 6, ringRadius: 110, ringFuseMs: 2000, ringFireMs: 2000, fengpoHp: .3, fengpoCooldownMs: 30000, fengpoMines: 4,
  liubeiDamageMul: 1.15, liubeiHeal: .08, liubeiRally: .35,
  cavalryIntervalMs: 300, dashLength: 150, dashWidth: 56, dashDamageMul: 1.6, dashMs: 200,
  roarIntervalMs: 350, roarRadius: 175, roarStunMs: 1200, roarDamageMul: 1.4,
  /** 孙尚香：移动中每 0.5 秒积 1 层疾步；满层环身 8 向连射（60% 伤害）。 */
  stepIntervalMs: 500, ringBolts: 8, ringDamageMul: .6,
  /** 貂蝉：倾城——命中敌人 2.5 秒内受到的伤害 +25%、移速 -40%（首领只易伤不减速）。 */
  charmMs: 2500, charmVulnerability: 1.25, charmSlow: .6,
  fireRadiusMul: 1.25, burnMs: 2000, burnTickMs: 1000, burnDamageFraction: .10,
} as const;
