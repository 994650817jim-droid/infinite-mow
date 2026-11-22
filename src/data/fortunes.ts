import type { PlayerStats } from '../types';

/**
 * 战场机缘（wave-progression-redesign.md §2.1b；2026-11-19 用户「需要远，不可以太近……根据不同随机事件会奖励不同奖励」，设计表 stage-event-rewards.md）：
 * 每关 2 次关内事件，刷在离主将 600–900 的可走处（小场地取最远处），各类事件给不同奖励，越远奖励越多（×1–1.25）。
 * 本关增益（降将献策的三选一）记在 StageBuffs，征程构筑存档时扣掉、换关撤销。数值是初值，交平衡会话复核。
 */
export type FortuneEventKind = 'cart' | 'armory' | 'courier' | 'rescue' | 'defector' | 'beacon';
export const FORTUNE = {
  /** 第 1 次：精锐段开始后多少秒；第 2 次：事件段开始后多少秒。 */
  cartDelay: 20, eventDelay: 8,
  /** 刷点：目标距离、至少多远（小场地取能到的最远处）、试几个方向；距离奖励倍率（600 → ×1，900 → ×1.25）。 */
  far: { target: 900, min: 600, tries: 16, bonusMax: 1.25 },
  /** 互动圈半径；站满秒数（粮车 / 烽燧 3 秒、军械库 4 秒）。 */
  radius: 70, holdSec: 3, armoryHoldSec: 4,
  /** 没去理会：多少秒后消失（「机缘已失」）；军械库 45 秒。 */
  lifeSec: 40, armoryLifeSec: 45,
  /** 守卫：粮车 3、被围义军外 6；军械库 2 精锐 + 4 盾兵。 */
  cartGuards: 3, rescueGuards: 6, armoryElites: 2, armoryShields: 4,
  /** 解救义军：随你冲阵的人数与时长；另补部曲人数。 */
  rescueEscort: 5, rescueEscortMs: 30000, rescueRecruits: 2,
  /** 传令兵：主将进到 spot 内就开跑（速度），之后 chaseSec 秒内追到 catch 内截下。 */
  courier: { spot: 520, speed: 125, chaseSec: 15, catch: 60 },
  /** 烽燧：之后多少毫秒刷兵减半；立即回血比例。 */
  beaconCalmMs: 20000, beaconHeal: .25,
  /** 粮车：随军粮 40 + 10 × 章（× 距离倍率）。 */
  cartGrain: (chapter: number): number => 40 + 10 * chapter,
  /** 同一张增益本关最多拿几次。 */
  maxSame: 2,
} as const;

export interface FortuneEventDef { name: string; hint: string; reward: string; done: string; icon: string }
export const FORTUNE_EVENT: Record<FortuneEventKind, FortuneEventDef> = {
  cart: { name: '敌军粮车', hint: '站进圈里 3 秒夺下粮车', reward: '随军钱币 + 回春丹', done: '夺下粮车', icon: 'growth_icon_pickup' },
  armory: { name: '敌军军械库', hint: '击退守军，站进圈里 4 秒', reward: '兵装一件', done: '夺下军械', icon: 'growth_icon_heart_mirror' },
  courier: { name: '敌军传令兵', hint: '追上他截下军情（15 秒）', reward: '多一次军略三选一', done: '截获军情', icon: 'growth_icon_wind_boots' },
  rescue: { name: '义军被围', hint: '击退围困的敌兵', reward: '义军随冲 + 部曲补员', done: '义军脱困', icon: 'growth_icon_gujun' },
  defector: { name: '降将来投', hint: '走近应战，击败后他随你作战', reward: '降将本关随战 + 献策三选一', done: '受降', icon: 'growth_icon_wanrendi' },
  beacon: { name: '烽燧', hint: '站进圈里 3 秒点燃烽火', reward: '20 秒刷兵减半 + 回血', done: '烽火燃起', icon: 'growth_icon_wildfire' },
};

export interface FortuneBuff {
  id: string; name: string; desc: string; /** 卡面图标（升级图标 growth_icon_*）。 */ icon: string;
  /** 改本关属性（返回后由场景记下差值，好在关末撤销）。 */
  apply: (s: PlayerStats, maxHp: number) => void;
  /** 选完立即生效的额外效果（回血等，不需撤销）。 */
  now?: 'heal15';
}
export const FORTUNE_BUFFS: readonly FortuneBuff[] = [
  // 2026-11-19 三选一文案审校：卡底徽记已写「本关有效」，说明里不再重复「本关」；与保底卡「固本培元」、战法「鹰眼」重名的两张改名（养精蓄锐、洞察）
  { id: 'f_morale', icon: 'growth_icon_might', name: '士气如虹', desc: '伤害 +15%', apply: s => { s.damageMul *= 1.15; } },
  { id: 'f_swift', icon: 'growth_icon_wind_boots', name: '疾行', desc: '移速 +12%\n拾取范围 +40%', apply: s => { s.moveMul *= 1.12; s.pickupRadius *= 1.4; } },
  { id: 'f_vigor', icon: 'growth_icon_constitution', name: '养精蓄锐', desc: '生命上限 +15%\n立即回复 15% 生命', apply: (s, hp) => { s.maxHpBonus += Math.round(hp * .15); }, now: 'heal15' },
  { id: 'f_fire', icon: 'growth_icon_wildfire', name: '火攻之机', desc: '火焰伤害 +25%\n火焰范围 +15%', apply: s => { s.fireMul *= 1.25; s.fireAreaMul *= 1.15; } },
  { id: 'f_orders', icon: 'growth_icon_quickness', name: '军令如山', desc: '武器冷却 −10%', apply: s => { s.cooldownMul *= .9; } },
  { id: 'f_armor', icon: 'growth_icon_heart_mirror', name: '披坚', desc: '受到伤害 −12%', apply: s => { s.damageTakenMul *= .88; } },
  { id: 'f_eagle', icon: 'growth_icon_critical', name: '洞察', desc: '暴击率 +8%', apply: s => { s.critChance += .08; } },
];
/** 从可选的增益里抽 3 张不同的（同一张本关已拿满 maxSame 次的不出）。 */
export function rollFortuneBuffs(taken: Readonly<Record<string, number>>, rnd: () => number = Math.random): FortuneBuff[] {
  const pool = FORTUNE_BUFFS.filter(b => (taken[b.id] ?? 0) < FORTUNE.maxSame).map(b => ({ b, k: rnd() }));
  return pool.sort((x, y) => x.k - y.k).slice(0, 3).map(x => x.b);
}
/** 第 1 次（精锐段）候选：军械库、传令兵第三章起才出。 */
export function firstFortunes(chapter: number): readonly FortuneEventKind[] { return chapter >= 3 ? ['cart', 'armory', 'courier'] : ['cart']; }
/** 第 2 次机缘（事件段）从这几种里随机。 */
export const EVENT_FORTUNES: readonly FortuneEventKind[] = ['rescue', 'defector', 'beacon'];

/**
 * 机缘「降将来投」（2026-11-19 用户「关于地图随机事件的降将来投也做个动画和击败后会跟着你一起打，也做个小台词」）：
 * 降将带亲兵从远处走到事件点、插旗、头顶「来投」→ 主将走近 → 他先要「以一战相试」（小首领：副将一档的生命，带 3 名亲兵，名牌 + 血条）
 * → 打到残血跪地请降 → 本关作为临时随从随你作战（复用随行系统：名牌、普攻、无名之辈招式；本关有效，不入人才库）+ 原来的机缘三选一保留。
 * 降将是本章敌方阵营的无名将领（随机姓名），不用史实名将，免得和劝降规则冲突。台词走左下角电影感对话卡。
 */
export const DEFECTOR = {
  /** 出场：从事件点再往外多远走过来、走多久（毫秒）；靠近多少开打。 */
  approach: 320, walkMs: 2600, duelRange: 180,
  /** 亲兵数（出场跟着走的、开打时刷的）。 */
  guards: 3,
  /** 打到多少血跪地请降；跪多久后归附（毫秒）。 */
  kneelAt: .12, kneelMs: 1400,
  /** 随战台词：最短间隔（秒）、一关最多几句。 */
  barkGap: 32, barkMax: 3,
} as const;
/** 各章敌方阵营（降将的出身）。 */
export const DEFECTOR_CAMP: Record<number, string> = { 1: '黄巾', 2: '董卓军', 3: '西凉军', 4: '袁军', 5: '曹军', 6: '荆南军', 7: '益州军', 8: '曹军', 9: '曹军', 10: '吴军', 11: '南蛮', 12: '魏军' };
const SURNAMES = ['王', '陈', '杨', '吴', '徐', '朱', '胡', '何', '林', '罗', '梁', '宋', '郑', '谢', '韩', '唐', '冯', '董', '萧', '程'];
const GIVEN = ['勇', '恒', '冲', '略', '奋', '茂', '邈', '凯', '谦', '肃', '武', '彪', '毅', '烈', '诚', '远', '昭', '弘', '翊', '骏'];
const RANKS = ['校尉', '司马', '都尉', '牙门将'];
/** 降将台词（简短）：出场、被打败、随战、告别。 */
export const DEFECTOR_LINES = {
  intro: ['久闻将军威名，愿以一战相试！', '某欲投明主——先过我这一关！', '将军若胜我，某愿执鞭随镫！'],
  yield: ['将军神勇，某心服口服，愿效犬马之劳！', '服了！某愿随将军破敌！', '某输得心服——这条命，交给将军了！'],
  fight: ['某来助阵！', '将军且看某的手段！', '杀！随将军破敌！', '后路有某，将军放心冲！'],
  farewell: ['能随将军一战，此生无憾。就此别过！', '将军保重，他日江湖再会！'],
} as const;
export interface DefectorInfo { name: string; title: string; camp: string; template: 'blade' | 'spear' | 'bow' }
/** 抽一名无名降将（本章敌方阵营 + 随机姓名 + 兵器）。 */
export function rollDefector(chapter: number, rnd: () => number = Math.random): DefectorInfo {
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
  const camp = DEFECTOR_CAMP[chapter] ?? '敌军', name = pick(SURNAMES) + pick(GIVEN.filter(Boolean));
  return { name, title: camp + pick(RANKS), camp, template: pick(['blade', 'spear', 'bow'] as const) };
}
