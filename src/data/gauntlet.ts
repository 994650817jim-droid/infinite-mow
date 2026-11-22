/**
 * 名将连战（共享笔记 gauntlet-design.md；统筹 2026-11-21「第一版」，用户批准）：一位武将在一张开阔场地里不停割草，每阵末尾闯进来一位名将，
 * 斩将后清场、三样战利品选一样，接下一阵；十阵通关后可继续「无尽」。没有行营、没有剧情、不用整军。
 * 开关 gauntletOn()：网址 ?gauntlet=1 / 0 优先，其次存档设置 im_gauntlet = '1'；默认关（关着时天下地图没有入口、开发构建也不直接进）。
 * 所有数值都是初值（统筹合并前给用户看），集中在这一个文件。
 */
export const GAUNTLET_KEY = 'im_gauntlet';
export function gauntletOn(search: string = typeof location !== 'undefined' ? location.search : ''): boolean {
  const q = new URLSearchParams(search).get('gauntlet'); if (q === '1') return true; if (q === '0') return false;
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(GAUNTLET_KEY) === '1'; } catch { return false; }
}

/** 名将怎么出招：native = 战斗场景原生控制器（张角 / 吕布）；moveset = 首领招式框架（data/bossMoves）；yuanshu / caoren / guandu = 各自的专属控制器。 */
export type GauntletCtrl = 'native' | 'moveset' | 'yuanshu' | 'caoren' | 'guandu';
/** 名将属于哪一篇（取首领图、首领数值用）。 */
export type GauntletArc = 'huangjin' | 'hulao' | 'qunxiong' | 'guandu' | 'chibi' | 'jingnan' | 'shu' | 'hanzhong' | 'xiangfan' | 'yiling' | 'nanzheng' | 'beifa';
export interface GauntletBoss {
  id: string; name: string; chapter: number; arc: GauntletArc; stage: 1 | 2 | 3; ctrl: GauntletCtrl;
  /** 战役里打败过他的那一关（HeroProgress.stageCleared 的键）：没打过的不抽（开发测试存档全开）。 */
  clearKey: string;
  /** 换掉了本章哪位最终首领（依赖关卡机关）；关掉了他招式之外的哪些关卡机关（写进交接）。 */
  replaces?: string; off?: string;
}
/**
 * 名将池第一版：每章一位（优先本章最终首领）。逐个核对过：
 * - 招式框架首领（moveset）的招式只有冲锋 / 扇射 / 横扫 / 地裂 / 落点 / 突刺 / 奔射 / 隐身 / 召兵 / 插旗，都不依赖关卡机关；关卡层的机关（山头、攻城、限时突围、七擒、劝降黄忠）在本模式不建。
 * - 换人：董卓（2-3 城头 + 营寨 + 吕布双首领演出）→ 吕布；陆逊（10-3 火线 / 风向，没有招式框架）→ 朱然（10-2）；司马懿（12-3 坚守不出 → 出营 → 天象三阶段，第一阶段靠营寨）→ 郝昭（12-2）。
 * - 关掉：淳于琼「焚粮减伤」（乌巢粮仓，GuanduBoss 的 morale 钩子不接 = 不减伤）；张角 1-3 法坛 / 广宗城门（场景布景，不建）。
 */
export const GAUNTLET_POOL: readonly GauntletBoss[] = [
  { id: 'zhangjiao', name: '张角', chapter: 1, arc: 'huangjin', stage: 3, ctrl: 'native', clearKey: 'huangjin-3', off: '1-3 法坛、广宗城门（场景布景）' },
  { id: 'lubu', name: '吕布', chapter: 2, arc: 'hulao', stage: 3, ctrl: 'native', clearKey: 'hulao-3', replaces: '董卓（2-3 城头、营寨、吕布双首领演出）' },
  { id: 'yuanshu', name: '袁术', chapter: 3, arc: 'qunxiong', stage: 3, ctrl: 'yuanshu', clearKey: 'third-3' },
  { id: 'chunyuqiong', name: '淳于琼', chapter: 4, arc: 'guandu', stage: 3, ctrl: 'guandu', clearKey: 'guandu-3', off: '焚粮减伤（乌巢粮仓）' },
  { id: 'caoren', name: '曹仁', chapter: 5, arc: 'chibi', stage: 3, ctrl: 'caoren', clearKey: 'chibi-3' },
  { id: 'hanxuan', name: '韩玄', chapter: 6, arc: 'jingnan', stage: 3, ctrl: 'moveset', clearKey: 'jingnan-3', off: '先战黄忠、劝降（关卡层）' },
  { id: 'liuzhang', name: '刘璋', chapter: 7, arc: 'shu', stage: 3, ctrl: 'moveset', clearKey: 'shu-3', off: '冲车破城、巷战、州府（关卡层）' },
  { id: 'caocao', name: '曹操', chapter: 8, arc: 'hanzhong', stage: 3, ctrl: 'moveset', clearKey: 'hanzhong-3', off: '汉水两处山头（关卡层）' },
  { id: 'lvmeng', name: '吕蒙', chapter: 9, arc: 'xiangfan', stage: 3, ctrl: 'moveset', clearKey: 'xiangfan-3', off: '麦城限时突围（关卡层）' },
  { id: 'zhuran', name: '朱然', chapter: 10, arc: 'yiling', stage: 2, ctrl: 'moveset', clearKey: 'yiling-2', replaces: '陆逊（10-3 火线 / 风向，没有招式框架）', off: '连营营帐（关卡层）' },
  { id: 'menghuo', name: '孟获', chapter: 11, arc: 'nanzheng', stage: 3, ctrl: 'moveset', clearKey: 'nanzheng-3', off: '七擒（擒而复纵，关卡层）' },
  { id: 'haozhao', name: '郝昭', chapter: 12, arc: 'beifa', stage: 2, ctrl: 'moveset', clearKey: 'beifa-2', replaces: '司马懿（12-3 坚守不出 → 出营 → 天象，第一阶段靠营寨）', off: '陈仓城门、城头箭楼（关卡层）' },
];

export interface WaveScale { hp: number; dmg: number; count: number; bossHp: number; bossDmg: number }
export const GAUNTLET = {
  /** 一局几阵；每阵割草多少秒后名将登场；斩将后清场几秒再弹战利品。 */
  waves: 10, mowSec: 70, clearSec: 10,
  /**
   * 每阵强度（第 1～10 阵）：杂兵生命 / 伤害 / 刷兵量（间隔除以 count、每次数量乘 count）倍率；名将生命 / 伤害按他在战役里的数值再乘。
   * 杂兵底子是第二章西凉兵（生命 22 / 伤害 6 一档），玩家带着战役成长进来，所以后几阵翻得比较多。初值，交平衡。
   */
  scale: [
    { hp: 1.0, dmg: 1.0, count: 1.0, bossHp: .6, bossDmg: .8 }, { hp: 1.6, dmg: 1.15, count: 1.1, bossHp: .7, bossDmg: .85 },
    { hp: 2.3, dmg: 1.3, count: 1.2, bossHp: .8, bossDmg: .9 }, { hp: 3.1, dmg: 1.5, count: 1.3, bossHp: .9, bossDmg: .95 },
    { hp: 4.0, dmg: 1.7, count: 1.4, bossHp: 1.0, bossDmg: 1.0 }, { hp: 5.0, dmg: 1.9, count: 1.5, bossHp: 1.1, bossDmg: 1.05 },
    { hp: 6.2, dmg: 2.15, count: 1.6, bossHp: 1.2, bossDmg: 1.1 }, { hp: 7.5, dmg: 2.4, count: 1.7, bossHp: 1.35, bossDmg: 1.15 },
    { hp: 9.0, dmg: 2.7, count: 1.8, bossHp: 1.5, bossDmg: 1.2 }, { hp: 11, dmg: 3.0, count: 2.0, bossHp: 1.8, bossDmg: 1.3 },
  ] as readonly WaveScale[],
  /** 无尽（第十阵以后）：每多一阵在第十阵上再乘。刷兵量封顶 countCap（同屏敌人仍守 150 红线）。 */
  endless: { hp: 1.12, dmg: 1.06, count: 1.05, bossHp: 1.12, bossDmg: 1.05, countCap: 2.4 },
  /** 名将登场：带亲兵（各几个，围在他身边）；名将在场时杂兵刷新间隔 ×bossInterval、每次数量 ×bossBurst（刷新量减半）。 */
  guards: [['elite', 1], ['shield', 3]] as ReadonlyArray<readonly ['elite' | 'shield' | 'infantry', number]>,
  bossInterval: 2, bossBurst: .5,
  /** 割草段精锐：开阵 eliteFirst 秒后每 eliteEvery 秒一个。 */
  eliteFirst: 25, eliteEvery: 20,
  /**
   * 首领防拖（bossStall：首领阶段收益额度 / 久战震怒）在本模式关掉：阵数节奏已经限住了每阵的长度（不斩将就不进下一阵），
   * 再叠一层震怒会和阵数递增打架。名将不会因为拖得久变强。
   */
  stallOff: true,
  /** 战利品：收为副将（最多 followerMax 位，满了选替换谁）、取其辎重（随军钱币 legion.food + food + foodPerWave × 阵数，回满生命）、军资补位卡。 */
  followerMax: 3, loot: { food: 60, foodPerWave: 20 },
  /** 副将强度：按名将生涯（品质橙、模板按兵器）走随行系统；能用降将专属招式的（data/surrenderMoves）照样会用。 */
  followerQuality: 'orange' as const,
  /**
   * 结算奖励（存档货币，测试 / 调试战斗不给）：按斩了几位名将给钱币（world provisions，界面已改名「钱币」）与武学残卷（MasteryStore scrolls；「兵法残卷」改名后跟着改）。
   * 首次通关（斩满十位）再给一次大奖。初值，统筹合并前给用户看。
   */
  reward: { provisionsPerKill: 40, scrollsEvery: 2, firstClear: { provisions: 400, scrolls: 6 } },
  /** 存档键：最高连斩（单独一个键）、首次通关大奖领过没有。 */
  bestKey: 'im_gauntlet_best', firstClearKey: 'im_gauntlet_first_clear',
  /** 天下地图入口：第二章打完开放（同「挑战 · 虎牢关」）。dx/dy 是路线图（?map=v2）上相对虎牢关挑战点的位置；默认地图（V1）的点位写在 world/WorldNodes.ts。 */
  entry: { after: 'hulao', dx: 96, dy: -54 },
} as const;

/** 第 n 阵（从 1 起）的强度：第十阵以后按 endless 每阵再乘。 */
export function waveScale(n: number): WaveScale {
  const T = GAUNTLET.scale, E = GAUNTLET.endless, i = Math.max(1, Math.floor(n));
  if (i <= T.length) return T[i - 1];
  const k = i - T.length, last = T[T.length - 1];
  return { hp: last.hp * E.hp ** k, dmg: last.dmg * E.dmg ** k, count: Math.min(E.countCap, last.count * E.count ** k), bossHp: last.bossHp * E.bossHp ** k, bossDmg: last.bossDmg * E.bossDmg ** k };
}

/** 能抽的名将：战役里打败过的（cleared 判断）；all = 开发测试存档全开。至少保底第一章张角。 */
export function unlockedPool(cleared: (key: string) => boolean, all = false): GauntletBoss[] {
  const out = GAUNTLET_POOL.filter(b => all || cleared(b.clearKey));
  return out.length ? out : [GAUNTLET_POOL[0]];
}

/**
 * 一局十阵的名将顺序：前几阵抽前几章的、后几阵抽后几章的（第 i 阵的目标章 ≈ 池子里按章排好的第 i/9 处，在 ±1 档里随机），尽量不重复；
 * 第十阵是守关名将，从池子里最后一档（章最大的三分之一）里出。池子不到十位时轮着重复（不连着两阵同一位）。
 */
export function pickBosses(pool: readonly GauntletBoss[], rand: () => number = Math.random, n: number = GAUNTLET.waves): GauntletBoss[] {
  const sorted = [...pool].sort((a, b) => a.chapter - b.chapter), out: GauntletBoss[] = [], used = new Set<string>();
  if (!sorted.length) return out;
  const top = sorted.slice(Math.max(0, sorted.length - Math.max(1, Math.ceil(sorted.length / 3))));
  for (let i = 0; i < n; i++) {
    const last = out[out.length - 1];
    let cand: GauntletBoss[];
    if (i === n - 1) cand = top;
    else { const at = Math.round(i / Math.max(1, n - 1) * (sorted.length - 1)); cand = sorted.slice(Math.max(0, at - 1), at + 2); }
    let pickFrom = cand.filter(b => !used.has(b.id) && b !== last);
    if (!pickFrom.length) pickFrom = sorted.filter(b => !used.has(b.id) && b !== last);
    if (!pickFrom.length) pickFrom = sorted.filter(b => b !== last);
    if (!pickFrom.length) pickFrom = sorted;
    const b = pickFrom[Math.floor(rand() * pickFrom.length) % pickFrom.length]; out.push(b); used.add(b.id);
  }
  return out;
}
/** 无尽：再抽一位（偏后几章：池子后一半里随机，不和上一位相同）。 */
export function endlessBoss(pool: readonly GauntletBoss[], last: GauntletBoss | null, rand: () => number = Math.random): GauntletBoss {
  const sorted = [...pool].sort((a, b) => a.chapter - b.chapter), half = sorted.slice(Math.floor(sorted.length / 2));
  const c = half.filter(b => b !== last); const from = c.length ? c : sorted;
  return from[Math.floor(rand() * from.length) % from.length];
}
/** 结算奖励：斩了 kills 位名将；firstClear = 这一局是首次通关。 */
export function gauntletReward(kills: number, firstClear: boolean): { provisions: number; scrolls: number } {
  const R = GAUNTLET.reward, k = Math.max(0, Math.floor(kills));
  return { provisions: k * R.provisionsPerKill + (firstClear ? R.firstClear.provisions : 0), scrolls: Math.floor(k / R.scrollsEvery) + (firstClear ? R.firstClear.scrolls : 0) };
}
/** 最高连斩记录（存档单独一个键；开发测试存档 ?dev=1 用另一个键 _test，不碰正式记录）：读 / 写（只在超过时写，返回是否新纪录）。 */
export function bestKey(test = false): string { return GAUNTLET.bestKey + (test ? '_test' : ''); }
export function readGauntletBest(test = false): { kills: number; wave: number; ms: number } {
  try { const v = JSON.parse(localStorage.getItem(bestKey(test)) ?? 'null'); if (v && typeof v.kills === 'number') return { kills: v.kills, wave: v.wave ?? v.kills, ms: v.ms ?? 0 }; } catch { /* 存储不可用 */ }
  return { kills: 0, wave: 0, ms: 0 };
}
export function writeGauntletBest(kills: number, wave: number, ms: number, test = false): boolean {
  const b = readGauntletBest(test); if (kills <= b.kills) return false;
  try { localStorage.setItem(bestKey(test), JSON.stringify({ kills, wave, ms, at: Date.now() })); } catch { return false; }
  return true;
}
