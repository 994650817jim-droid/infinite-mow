/**
 * 首领阶段防拖（用户 11-21「boss 出来后不打 boss 只刷小兵，是否可以无限刷」；总制作人派单，数值按平衡会话 boss-farm-guard.md）。
 * 首领在场时杂兵照样刷（每分钟 130～190 个）、经验 ×2，随军粮 / 兵装 / 战功 / 残卷原来没有上限。三层：
 * 1) 收益额度（按时间）：首领可交战累计 quotaSec 秒内的击杀照常给；之后刷出来的杂兵 / 精锐随军粮 0、不掉兵装 / 残卷、不计战功，
 *    经验 ×over.xpMul（且不再吃首领在场的 ×2）。首领本体、副将、首领宝箱、结算奖励不受影响；押粮卒被截的粮也算在内。
 *    平衡会话：正常偏慢的首领战（p90）本身就杀 120～250 个，按杀数给会误伤，所以按时间（p90 × 1.2 上下取整）。
 * 2) 首领震怒：可交战累计满 enrageSec 秒还没打倒，每 enrage.stepSec 秒一层（最多 maxStacks）：首领移速 +speedPerStack、
 *    主将受到的伤害 +dmgPerStack。起点不早于正常 p90 的 2 倍。双首领从第二名首领出场起算（两人用同一个钟：取在场两人里较短的那个）。
 *    伤害加在主将受伤一侧：多数首领的招式伤害写在各自控制器里（华雄 / 吕布 / 张角……），只改 def.damage 盖不全；
 *    震怒时杂兵也跟着打得更疼（全军压上），绕着首领刷兵更不划算。提示：一次横幅 + 首领身上的辉光转朱红、身体染红（不另画特效）。
 * 3) 额度用完后首领段刷兵再降一档（spent：上限 / 间隔 / 每批），留少量杂兵给割草手感，不让屏幕空。
 * 「可交战」= 首领不无敌、不在城头（2-3 董卓）、不在过场。双首领（主首领 this.boss 轮换）、攻城守将、守城关、军情 / 支线都走同一套；
 * 战线推进关（1-1、1-2、2-1、2-2：首领 90 秒没打倒就推进下一关，data/frontline.ts）不加额度和震怒，追兵首领也不震怒，免得两套计时打架。
 * 数值按章（下标 = 章 − 1），按关覆盖写在 stages（键「章-关」，如 '12-3'）；平衡会话直接改这张表。
 */
export const BOSS_STALL = {
  /** 收益额度（秒）：第 1～8 章 75、第 9～11 章 / 12-1 / 12-2 90（12-3 见 stages）。 */
  quotaSec: [75, 75, 75, 75, 75, 75, 75, 75, 90, 90, 90, 90] as readonly number[],
  /** 震怒起点（秒）：第 1～9 章 150、第 10～11 章 / 12-1 / 12-2 180（12-3 见 stages）。 */
  enrageSec: [150, 150, 150, 150, 150, 150, 150, 150, 150, 180, 180, 180] as readonly number[],
  /** 按关覆盖：12-3 五丈原（营垒 + 坚守；p90 103 秒、最长 142 秒）。 */
  stages: { '12-3': { quotaSec: 150, enrageSec: 240 } } as Readonly<Record<string, { quotaSec?: number; enrageSec?: number }>>,
  /** 超出额度：经验倍率（替代首领在场的 ×2）。 */
  over: { xpMul: .25 },
  /** 震怒：每 stepSec 秒一层，每层首领伤害 +10%、移速 +5%，最多 5 层；tint = 满层时身体染的色（按层数从白渐变过去）。 */
  enrage: { stepSec: 30, dmgPerStack: .10, speedPerStack: .05, maxStacks: 5, tint: 0xff8a74, glow: 0xff3a1e },
  /** 额度用完：在首领段刷兵（BALANCE.bossSpawn 上限 ×.5、间隔 ×2、每批 ×.5）上再乘。上限 75 → 30。 */
  spent: { capMul: .4, intervalMul: 1.5, burstMul: .6 },
} as const;

/** 本关的额度 / 震怒起点（秒）。chapter 1–12（超出按两头算），stage 关序。 */
export function stallFor(chapter: number, stage: number): { quotaSec: number; enrageSec: number } {
  const i = Math.max(0, Math.min(BOSS_STALL.quotaSec.length - 1, Math.round(chapter) - 1)), o = BOSS_STALL.stages[`${i + 1}-${stage}`];
  return { quotaSec: o?.quotaSec ?? BOSS_STALL.quotaSec[i], enrageSec: o?.enrageSec ?? BOSS_STALL.enrageSec[i] };
}

/** 一次击杀给哪些收益。 */
export interface KillGrant { /** 随军粮（含押粮卒被截的粮）。 */ food: boolean; /** 兵装与武学残卷掉落（ItemDrops.onKill）。 */ drops: boolean; /** 战功（精锐）。 */ merit: boolean; /** 经验倍率；null = 照原规则（首领在场 ×2）。 */ xpMul: number | null }
export const GRANT_FULL: KillGrant = Object.freeze({ food: true, drops: true, merit: true, xpMul: null });
export const GRANT_OVER: KillGrant = Object.freeze({ food: false, drops: false, merit: false, xpMul: BOSS_STALL.over.xpMul });

/** 首领在场时一次击杀的收益：首领、副将（exempt）照常；首领可交战 sec 秒还在额度内照常，超出按 GRANT_OVER。 */
export function killGrant(kind: string, sec: number, quotaSec: number, exempt = false): KillGrant {
  return kind === 'boss' || exempt || sec < quotaSec ? GRANT_FULL : GRANT_OVER;
}

/** 首领可交战 sinceSec 秒时的震怒层数（没到起点 0；到起点即 1 层，最多 maxStacks）。 */
export function enrageStacks(sinceSec: number, startSec: number): number {
  const E = BOSS_STALL.enrage;
  return sinceSec < startSec ? 0 : Math.min(E.maxStacks, Math.floor((sinceSec - startSec) / E.stepSec) + 1);
}
/** 层数 → 倍率（伤害 / 移速）。 */
export function enrageMul(stacks: number): { damage: number; speed: number } {
  const E = BOSS_STALL.enrage, n = Math.max(0, Math.min(E.maxStacks, stacks));
  return { damage: 1 + n * E.dmgPerStack, speed: 1 + n * E.speedPerStack };
}
/** 层数 → 身体染色（0 层白，满层 enrage.tint），再按通道乘上原来的底色 base。 */
export function rageTint(stacks: number, base = 0xffffff): number {
  const E = BOSS_STALL.enrage, k = Math.max(0, Math.min(1, stacks / E.maxStacks));
  const ch = (c: number, s: number): number => { const t = (E.tint >> s) & 255, v = Math.round(255 + (t - 255) * k); return Math.round(((c >> s) & 255) * v / 255) << s; };
  return ch(base, 16) | ch(base, 8) | ch(base, 0);
}
