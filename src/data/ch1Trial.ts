/**
 * 第一章试验数值 ch1v6（2026-11-21 总制作人：五轮机器人实测后让用户亲手试；数据见共享笔记 hero-balance-review.md 第 21～26 节）。
 *
 * 用法：开发服务器网址加 `?balance=ch1v6`（只在开发构建里生效，正式构建里这个开关恒为关）。默认关，关着时第一章与 main 完全一样。
 * 开着时：
 * - 只改第一章（huangjin 1-1～1-3）的数值，第二章起不受影响；
 * - 存档走独立的试验存档（dev/TestSave，键前缀 imtrial-ch1v6:），第一次打开自动是全新空档，正式存档一个字节都不动；
 *   以后每次带同样的网址打开都接着上次的试验进度；右下角有「试验数值 ch1v6 · 独立存档」角标，战斗结算面板多一行「试验数值 ch1v6」。
 */
export const CH1_TRIAL_ID = 'ch1v6';
export const CH1_TRIAL: boolean = (() => {
  if (!import.meta.env.DEV) return false;
  try { return new URLSearchParams(window.location.search).get('balance') === CH1_TRIAL_ID; } catch { return false; }
})();

/** ch1v6 的各项数值（开关开着时才用；括号里是 main 的原值）。 */
export const CH1V6 = {
  /** 武将升级所需经验 Lv1→2 … Lv9→10（原 16 / 20 / 28 / 36 / 120 / 150 / 180 / 210 / 240，累计 Lv10 1000 → 2690）：1-1 打完约 Lv4、1-2 约 Lv7、1-3 约 Lv10。 */
  xpTable: [60, 120, 200, 300, 330, 360, 400, 440, 480] as readonly number[],
  /** 战后经验（首通等）按本关建议等级算软上限（原按本章上限：1-1 战后首通经验会把 Lv7 推到 Lv8）。 */
  postXpSoftByStage: true,
  /** 小兵生命 / 伤害、首领生命（原 1-1 1 / 1 / .48，1-2 1.3 / 1.05 / .65，1-3 1.7 / 1.1 / .5）。 */
  tuning: [{ hp: .8, damage: .9, bossHp: .48 }, { hp: 1.05, damage: .95, bossHp: .65 }, { hp: 1.4, damage: 1, bossHp: .9 }] as ReadonlyArray<{ hp: number; damage: number; bossHp: number }>,
  /** 同屏杂兵上限（原都是 150）；首领在场时上限 = 基数 × .5——1-1 基数 bossCapBase1（原 75 → 25），另两关按 enemyCap。 */
  enemyCap: [80, 100, 110] as readonly number[],
  bossCapBase1: 50,
  /** 1-1 刷兵节奏（原 间隔 .8 / .6 秒、每次 1 / 2 个）：每次 1 个，间隔 先锋段 .8、精锐段 .5、事件段起 .42 秒（at = 换档时刻，刷怪时间轴秒）。 */
  stage1Spawn: { interval: [.8, .5, .42] as readonly number[], at: [45, 100] as readonly number[], burst: 1 },
  /** 1-1 精锐段起（t ≥ 45）刀兵占比（原 85%，其余刀盾）；流民权重 10 → 15（data/enemyRoster huangjin.1）。刀兵贴身围殴是 1-1 的主要承伤（第 26 节）。 */
  stage1Mix: { infantry: .7, liumin: 15 },
  /** 1-2 精锐段起（t ≥ 50）刀兵 / 刀盾占比，其余弓手（原 60% / 22% / 弓手 18%）。 */
  stage2Mix: { infantry: .68, shield: .22 },
  /** 1-2 弓手伤害倍率（待「箭按射手拆分」后定：普通弓手为主 → .85；法术弹为主 → 保持 1，改首领战飞弹）。 */
  stage2ArcherDamage: 1,
  /** 随军粮（原 每杀 1 粮、精锐 5、首领 20）：每 2 杀 1 粮、精锐 3、首领 40。 */
  food: { perKills: 2, elite: 3, boss: 40 },
  /** 部曲生命倍率（原 1；第一章新手期）。 */
  troopHp: 1.5,
  /** 1-1 首领出场时主将生命 < below：在主将与首领之间必出一处回血点（泉眼 / 水井），这一处水量 charge 最大生命（原泉眼 .15）。 */
  bossEntryAid: { below: .5, charge: .5, dist: [200, 320] as readonly [number, number], distFrac: .6 },
} as const;

/** 现在是不是 ch1v6 的第一章战斗（chapterId = GameScene.hardKey()）。 */
export function ch1TrialOn(chapterId: string | undefined): boolean { return CH1_TRIAL && chapterId === 'huangjin'; }
