/**
 * 首领阶段防拖（用户 11-21「boss 出来后不打 boss 只刷小兵，是否可以无限刷」；总制作人派单）。
 * 首领在场时杂兵照样刷、经验 ×2，随军粮 / 兵装 / 战功 / 残卷原来没有上限，可以绕着首领一直割草刷收益。三层：
 * 1) 收益额度：首领登场后前 quota.normal 个杂兵、前 quota.elite 个精锐照常给；超出后随军粮 0、不掉兵装、不计战功、不掉残卷，
 *    经验 ×over.xpMul（且不再吃首领在场的 ×2）。首领本体、首领宝箱不受影响；押粮卒被截的粮也算在额度里。
 * 2) 首领震怒：登场满 enrageStartSec 秒还没打倒开始叠层，每 enrage.stepSec 秒一层：首领移速 +speedPerStack、
 *    主将受到的伤害 +dmgPerStack（封顶 +dmgCap / +speedCap）。血条旁一个小「怒」印 + 一次横幅。
 *    伤害加在主将受伤一侧：多数首领的招式伤害写在各自控制器里（华雄 / 吕布 / 张角……），只改 def.damage 盖不全；
 *    震怒时杂兵也跟着打得更疼（全军压上），绕着首领刷兵更不划算，正好是目的。
 * 3) 额度用完后首领段刷兵再降一档（spent：上限 / 间隔 / 每批），留少量杂兵给割草手感，不让屏幕空。
 * 双首领（主首领 this.boss 轮换）、追兵首领、攻城守将、守城关都走 GameScene 同一套。
 */
export const BOSS_STALL = {
  /** 首领登场后照常给收益的击杀数：杂兵（含押粮卒等新兵种）、精锐单算。 */
  quota: { normal: 60, elite: 2 },
  /** 超出额度：经验倍率（替代首领在场的 ×2）。 */
  over: { xpMul: .25 },
  /**
   * 震怒：startSec 起叠层（该关预期首领战更长的，起点 = 预期用时 × expectMul，取大），每 stepSec 秒一层。
   * 普通章末首领战 36–49 秒（hero-balance-review.md 7.1），150 秒约是 3 倍；不是要秒杀正常打法。
   */
  enrage: { startSec: 150, stepSec: 20, dmgPerStack: .10, speedPerStack: .04, dmgCap: 1, speedCap: .30, expectMul: 2.5 },
  /**
   * 首领战预期用时（秒，按 hardKey.stage）：没写的按 default。12-3 司马懿赢的局约 80 秒、只 1/6 通关（hero-balance-review.md 7.1），
   * 给 100 → 起点 250 秒；以后平衡会话量到哪关长再补。
   */
  expectSec: { default: 45, 'beifa.3': 100 } as Readonly<Record<string, number>>,
  /** 额度用完：在首领段刷兵（BALANCE.bossSpawn 上限 ×.5、间隔 ×2、每批 ×.5）上再乘。上限 75 → 30。 */
  spent: { capMul: .4, intervalMul: 1.5, burstMul: .6 },
} as const;

/** 一次击杀给哪些收益。 */
export interface KillGrant { /** 随军粮（含押粮卒被截的粮）。 */ food: boolean; /** 兵装与武学残卷掉落（ItemDrops.onKill）。 */ drops: boolean; /** 战功（精锐）。 */ merit: boolean; /** 经验倍率；null = 照原规则（首领在场 ×2）。 */ xpMul: number | null }
export const GRANT_FULL: KillGrant = Object.freeze({ food: true, drops: true, merit: true, xpMul: null });
export const GRANT_OVER: KillGrant = Object.freeze({ food: false, drops: false, merit: false, xpMul: BOSS_STALL.over.xpMul });

/** 首领阶段收益额度：spawnBoss 时 reset，首领在场时每个杂兵 / 精锐击杀调一次 onKill。 */
export class BossQuota {
  normal = 0; elite = 0;
  reset(): void { this.normal = 0; this.elite = 0; }
  /** 记一次击杀（首领不算），返回这次给哪些收益。 */
  onKill(kind: string): KillGrant {
    if (kind === 'boss') return GRANT_FULL;
    const Q = BOSS_STALL.quota;
    if (kind === 'elite') return ++this.elite <= Q.elite ? GRANT_FULL : GRANT_OVER;
    return ++this.normal <= Q.normal ? GRANT_FULL : GRANT_OVER;
  }
  /** 杂兵额度用完（刷兵再降一档）。 */
  get spent(): boolean { return this.normal >= BOSS_STALL.quota.normal; }
}

/** 震怒起点（秒）：max(startSec, 该关预期用时 × expectMul)。 */
export function enrageStartSec(stageKey: string): number {
  const E = BOSS_STALL.enrage, x = BOSS_STALL.expectSec[stageKey] ?? BOSS_STALL.expectSec.default;
  return Math.max(E.startSec, x * E.expectMul);
}
/** 首领登场 sinceSec 秒时的震怒层数（没到起点 0；到起点即 1 层）。 */
export function enrageStacks(sinceSec: number, startSec: number): number {
  return sinceSec < startSec ? 0 : Math.floor((sinceSec - startSec) / BOSS_STALL.enrage.stepSec) + 1;
}
/** 层数 → 倍率（伤害 / 移速，各自封顶）。 */
export function enrageMul(stacks: number): { damage: number; speed: number } {
  const E = BOSS_STALL.enrage;
  return { damage: 1 + Math.min(E.dmgCap, stacks * E.dmgPerStack), speed: 1 + Math.min(E.speedCap, stacks * E.speedPerStack) };
}
