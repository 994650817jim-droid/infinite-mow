import { FORTUNE_BUFFS, FORTUNE, type FortuneBuff } from '../data/fortunes';
import { SCHOOLS, type SchoolId } from '../data/schools';
import type { UpgradeOption } from '../types';

/**
 * 升级三选一的新卡池（wave-progression-redesign.md §4.6，2026-11-19 用户「3选一里面加入更多东西」「我想往3选一池子加更多东西」）：
 * 战法位按章节概率换成新卡；核心位只剩固本培元时也换。第一章不出新卡（教学期只出构筑）。
 * - 战场机缘：本关增益（同机缘事件，记 StageBuffs，关末撤销）；另有成长型「乘胜追击」（每 10 杀伤害 +1%，本关最多 +15%）
 * - 锦囊妙计：一次性主动技，身上最多 1 个，R 键 / 右侧锦囊钮使用
 * - 兵源：本关一队义军随你冲阵；名将来投：本章同时代一名武将率部助战（名牌 + 义军，本关）
 * - 军资：随军粮 + 立即回血；心法：研读一派心法（本次征程势 +1，每派一次）
 * - 赌命：本关有代价的增益；悬赏军令：本关达成条件才给奖励
 * 信物卡只在首领宝箱那次出（chestCharmCard）。数值是初值，交平衡会话复核。
 */
export type NewCardKind = 'fortune' | 'jinnang' | 'troops' | 'supply' | 'manual' | 'general' | 'gamble' | 'bounty';
/** 各类权重：[二～四章, 五～八章, 九～十二章]。 */
export const NEW_CARD_WEIGHTS: Record<NewCardKind, readonly [number, number, number]> = {
  fortune: [35, 25, 20], jinnang: [20, 20, 20], troops: [15, 10, 8], supply: [15, 10, 8], manual: [10, 10, 8], general: [0, 10, 12], gamble: [5, 10, 12], bounty: [0, 5, 8],
};
export function newCardWeight(kind: NewCardKind, chapter: number): number { const w = NEW_CARD_WEIGHTS[kind]; return chapter <= 1 ? 0 : chapter <= 4 ? w[0] : chapter <= 8 ? w[1] : w[2]; }
export const NEW_CARDS = {
  /** 战法位换成新卡的概率（第一章不换）。 */
  replaceChance: (chapter: number): number => chapter <= 1 ? 0 : chapter <= 4 ? .2 : chapter <= 8 ? .3 : .4,
  troops: { n: 6, ms: 40000 },
  supply: { grain: (chapter: number) => 30 + 10 * chapter, heal: .25 },
  general: { n: (chapter: number) => 6 + Math.floor(chapter / 2), ms: 45000 },
  momentum: { per: 10, step: .01, max: 15 },
} as const;

export type JinnangId = 'ambush' | 'gong' | 'feint' | 'drum' | 'fire' | 'empty' | 'arrows' | 'chain';
export const JINNANG: Record<JinnangId, { name: string; desc: string; icon: string }> = {
  ambush: { name: '伏兵', desc: '召 6 名伏兵随你冲阵 20 秒', icon: 'growth_icon_gujun' },
  gong: { name: '鸣金', desc: '收拢全场经验\n并立即回复 20% 生命', icon: 'growth_icon_recovery' },
  feint: { name: '疑兵', desc: '周围敌兵惊疑：减速 60%，持续 5 秒', icon: 'growth_icon_dahe' },
  drum: { name: '擂鼓', desc: '10 秒内武器伤害 +25%、攻速 +20%', icon: 'growth_icon_berserk' },
  fire: { name: '火计', desc: '周围 220 内敌兵受一次火攻重创\n（武器伤害 ×4，火焰）', icon: 'growth_icon_wildfire' },
  empty: { name: '空城计', desc: '2.5 秒内不受任何伤害', icon: 'growth_icon_heart_mirror' },
  arrows: { name: '草船借箭', desc: '6 秒内受到的伤害减半，期满把挡下的伤害\n化作箭雨射向周围敌兵', icon: 'growth_icon_steady_aim' },
  chain: { name: '连环计', desc: '周围 8 名敌兵连在一起 8 秒：\n打一个，连着的各受 30%', icon: 'growth_icon_lianying' },
};
/** 名将来投：各章同时代、不是可玩武将的助战名将（第 n 章 = [n−1]）。 */
export const ERA_GENERALS: readonly (readonly string[])[] = [
  ['程远志', '邓茂'], ['孙坚', '公孙瓒'], ['臧霸', '陈到'], ['刘辟', '龚都'], ['甘宁', '周泰'], ['霍峻', '刘封'],
  ['法正', '严颜'], ['吴兰', '雷铜'], ['关平', '周仓'], ['冯习', '张南'], ['张嶷', '王平'], ['姜维', '廖化'],
];
export type GambleId = 'allin' | 'beiwei' | 'light';
export const GAMBLES: Record<GambleId, { name: string; desc: string; icon: string }> = {
  allin: { name: '孤注一掷', desc: '本关生命上限 −15%\n伤害 +25%', icon: 'growth_icon_berserk' },
  beiwei: { name: '背嵬', desc: '本关生命低于一半时\n伤害 +30%', icon: 'growth_icon_might' },
  light: { name: '轻装', desc: '本关受到伤害 +15%\n移速 +20%、技能冷却 −10%', icon: 'growth_icon_quickness' },
};
export type BountyId = 'lieutenant' | 'elites';
export const BOUNTIES: Record<BountyId, { name: string; desc: string; icon: string }> = {
  lieutenant: { name: '悬赏 · 斩将', desc: '副将出阵后 30 秒内斩之\n赏：再来一次军略三选一', icon: 'growth_icon_tiger_tally' },
  elites: { name: '悬赏 · 破锐', desc: '本关再击杀 8 名精锐\n赏：随军粮 +60、信物一件', icon: 'growth_icon_critical' },
};

export interface CardHost {
  chapter: number;
  /** 本关已拿的机缘增益次数。 */
  taken: Readonly<Record<string, number>>;
  applyBuff: (b: FortuneBuff) => void;
  momentum: () => boolean; startMomentum: () => void;
  jinnangHeld: () => boolean;
  giveJinnang: (id: JinnangId) => void;
  escort: (n: number, ms: number) => void;
  general: (name: string, n: number, ms: number) => void;
  addGrain: (n: number) => void;
  healFrac: (f: number) => void;
  /** 可研读心法的派（已学该派战法、还没研读过）。 */
  manualSchools: () => SchoolId[];
  readManual: (s: SchoolId) => void;
  gambleTaken: (id: GambleId) => boolean; gamble: (id: GambleId) => void;
  /** 悬赏能不能接（斩将：本关还没到副将段）。 */
  bountyOpen: (id: BountyId) => boolean; bounty: (id: BountyId) => void;
}

const card = (id: string, name: string, desc: string, label: string, icon: string, apply: () => void): UpgradeOption => ({ id, name, desc, kind: 'foundation', categoryLabel: label, icon, apply: () => apply() });
const pickOf = <T,>(a: readonly T[], rnd: () => number): T => a[Math.floor(rnd() * a.length) % a.length];

function make(kind: NewCardKind, h: CardHost, rnd: () => number): UpgradeOption | null {
  if (kind === 'fortune') {
    const pool = FORTUNE_BUFFS.filter(b => (h.taken[b.id] ?? 0) < FORTUNE.maxSame);
    if (!h.momentum() && rnd() < .2) { const M = NEW_CARDS.momentum; return card('new_momentum', '乘胜追击', `本关每击杀 ${M.per} 敌伤害 +${M.step * 100}%\n（最多 +${M.max}%）`, '战场机缘 · 本关有效', 'growth_icon_might', () => h.startMomentum()); }
    if (!pool.length) return null;
    const b = pickOf(pool, rnd);
    return card('new_' + b.id, b.name, b.desc, '战场机缘 · 本关有效', b.icon, () => h.applyBuff(b));
  }
  if (kind === 'jinnang') {
    if (h.jinnangHeld()) return null;
    const id = pickOf(Object.keys(JINNANG) as JinnangId[], rnd), j = JINNANG[id];
    return card('jinnang_' + id, '锦囊 · ' + j.name, j.desc + '\n（R 键使用，限 1 个）', '锦囊 · 一次性', j.icon, () => h.giveJinnang(id));
  }
  if (kind === 'troops') { const T = NEW_CARDS.troops; return card('new_troops', '援军', `一队义军（${T.n} 人）随你冲阵 ${T.ms / 1000} 秒`, '兵源 · 本关', 'growth_icon_tiger_tally', () => h.escort(T.n, T.ms)); }
  if (kind === 'general') {
    const names = ERA_GENERALS[Math.max(0, Math.min(11, h.chapter - 1))], name = pickOf(names, rnd), G = NEW_CARDS.general, n = G.n(h.chapter);
    return card('new_general', '名将来投 · ' + name, `${name}率 ${n} 名部众来投，\n随你冲阵 ${G.ms / 1000} 秒`, '名将来投 · 本关', 'growth_icon_wanrendi', () => h.general(name, n, G.ms));
  }
  if (kind === 'supply') { const g = NEW_CARDS.supply.grain(h.chapter); return card('new_supply', '军资', `随军粮 +${g}\n并立即回复 ${Math.round(NEW_CARDS.supply.heal * 100)}% 生命`, '军资 · 立即', 'growth_icon_pickup', () => { h.addGrain(g); h.healFrac(NEW_CARDS.supply.heal); }); }
  if (kind === 'gamble') {
    const ids = (Object.keys(GAMBLES) as GambleId[]).filter(id => !h.gambleTaken(id)); if (!ids.length) return null;
    const id = pickOf(ids, rnd), g = GAMBLES[id];
    return card('gamble_' + id, '赌命 · ' + g.name, g.desc, '赌命 · 本关', g.icon, () => h.gamble(id));
  }
  if (kind === 'bounty') {
    const ids = (Object.keys(BOUNTIES) as BountyId[]).filter(id => h.bountyOpen(id)); if (!ids.length) return null;
    const id = pickOf(ids, rnd), b = BOUNTIES[id];
    return card('bounty_' + id, b.name, b.desc, '悬赏军令 · 本关', b.icon, () => h.bounty(id));
  }
  const ss = h.manualSchools(); if (!ss.length) return null;
  const s = pickOf(ss, rnd), d = SCHOOLS[s];
  return card('new_manual_' + s, '研读心法 · ' + d.name, `${d.name}势 +1（本次征程有效，每派一次）`, '心法 · 本次征程', 'growth_icon_eight_trigrams', () => h.readManual(s));
}

/** 抽 n 张新卡（按本章权重、类不重复；某类出不了就跳过）。 */
export function drawNewCards(h: CardHost, n: number, avoid: ReadonlySet<NewCardKind> = new Set(), rnd: () => number = Math.random): UpgradeOption[] {
  const out: UpgradeOption[] = [], used = new Set<NewCardKind>(avoid);
  for (let tries = 0; out.length < n && tries < 16; tries++) {
    const kinds = (Object.keys(NEW_CARD_WEIGHTS) as NewCardKind[]).filter(k => !used.has(k) && newCardWeight(k, h.chapter) > 0); if (!kinds.length) break;
    const total = kinds.reduce((t, k) => t + newCardWeight(k, h.chapter), 0); let r = rnd() * total, pick = kinds[0];
    for (const k of kinds) { r -= newCardWeight(k, h.chapter); if (r <= 0) { pick = k; break; } }
    used.add(pick); const c = make(pick, h, rnd); if (c) out.push(c);
  }
  return out;
}
/** 卡属于哪一类新卡（不是新卡返回 null）。 */
export function newCardKind(o: UpgradeOption): NewCardKind | null {
  const id = o.id;
  return id.startsWith('new_f_') || id === 'new_momentum' ? 'fortune' : id.startsWith('jinnang_') ? 'jinnang' : id === 'new_troops' ? 'troops' : id === 'new_general' ? 'general' : id === 'new_supply' ? 'supply'
    : id.startsWith('new_manual_') ? 'manual' : id.startsWith('gamble_') ? 'gamble' : id.startsWith('bounty_') ? 'bounty' : null;
}
/** 信物卡（首领宝箱那次三选一固定一张）：按章节档次掷一件信物，进行囊。 */
export function chestCharmCard(chapter: number, grant: () => string): UpgradeOption {
  const q = chapter <= 4 ? '蓝' : chapter <= 8 ? '紫' : '橙';
  return { id: 'charm_card', name: '信物', desc: `从首领宝箱里挑一件${q}色信物\n（进行囊，永久）`, kind: 'trinket', categoryLabel: '信物 · 永久', icon: 'growth_icon_heart_mirror', apply: () => { grant(); } };
}
