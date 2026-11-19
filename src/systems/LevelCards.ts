import { FORTUNE_BUFFS, FORTUNE, type FortuneBuff } from '../data/fortunes';
import { SCHOOLS, SCHOOL_IDS, type SchoolId } from '../data/schools';
import type { UpgradeOption } from '../types';

/**
 * 升级三选一的新卡池（wave-progression-redesign.md §4.3，2026-11-19 用户批准「3选一里面加入更多东西」）：
 * 战法位每张有一定概率（按章）换成新卡；没有可学的战法 / 核心位只剩固本培元时也出新卡。
 * - 战场机缘：本关增益（同机缘事件，记 StageBuffs，关末撤销）
 * - 锦囊：一次性主动技，身上最多 1 个，R 键 / 右侧「锦囊」钮使用（伏兵 / 鸣金 / 疑兵 / 擂鼓）
 * - 兵源：本关一队义军随你冲阵
 * - 军资：随军粮 + 立即回血
 * - 心法：研读一派心法（本次征程该派势 +1，每派一次；只出已学该派战法的派）
 * 信物卡（只在首领宝箱那次出）留到后面一期。数值是初值，交平衡会话复核。
 */
export type NewCardKind = 'fortune' | 'jinnang' | 'troops' | 'supply' | 'manual';
export const NEW_CARDS = {
  weights: { fortune: 35, jinnang: 20, troops: 15, supply: 15, manual: 10 } as Record<NewCardKind, number>,
  /** 战法位换成新卡的概率（第一章不换，教学期只出战法）。 */
  replaceChance: (chapter: number): number => chapter <= 1 ? 0 : chapter <= 4 ? .2 : chapter <= 8 ? .3 : .4,
  troops: { n: 6, ms: 40000 },
  supply: { grain: (chapter: number) => 30 + 10 * chapter, heal: .25 },
} as const;

export type JinnangId = 'ambush' | 'gong' | 'feint' | 'drum';
export const JINNANG: Record<JinnangId, { name: string; desc: string; icon: string }> = {
  ambush: { name: '伏兵', desc: '召 6 名伏兵随你冲阵 20 秒', icon: 'growth_icon_gujun' },
  gong: { name: '鸣金', desc: '收拢全场经验\n并立即回复 20% 生命', icon: 'growth_icon_recovery' },
  feint: { name: '疑兵', desc: '周围敌兵惊疑：减速 60%，持续 5 秒', icon: 'growth_icon_dahe' },
  drum: { name: '擂鼓', desc: '10 秒内武器伤害 +25%、攻速 +20%', icon: 'growth_icon_berserk' },
};

export interface CardHost {
  chapter: number;
  /** 本关已拿的机缘增益次数。 */
  taken: Readonly<Record<string, number>>;
  applyBuff: (b: FortuneBuff) => void;
  jinnangHeld: () => boolean;
  giveJinnang: (id: JinnangId) => void;
  escort: (n: number, ms: number) => void;
  addGrain: (n: number) => void;
  healFrac: (f: number) => void;
  /** 可研读心法的派（已学该派战法、还没研读过）。 */
  manualSchools: () => SchoolId[];
  readManual: (s: SchoolId) => void;
}

const card = (id: string, name: string, desc: string, label: string, icon: string, apply: () => void): UpgradeOption => ({ id, name, desc, kind: 'foundation', categoryLabel: label, icon, apply: () => apply() });

function make(kind: NewCardKind, h: CardHost, rnd: () => number): UpgradeOption | null {
  if (kind === 'fortune') {
    const pool = FORTUNE_BUFFS.filter(b => (h.taken[b.id] ?? 0) < FORTUNE.maxSame); if (!pool.length) return null;
    const b = pool[Math.floor(rnd() * pool.length)];
    return card('new_' + b.id, b.name, b.desc, '战场机缘 · 本关有效', b.icon, () => h.applyBuff(b));
  }
  if (kind === 'jinnang') {
    if (h.jinnangHeld()) return null;
    const ids = Object.keys(JINNANG) as JinnangId[], id = ids[Math.floor(rnd() * ids.length)], j = JINNANG[id];
    return card('jinnang_' + id, '锦囊 · ' + j.name, j.desc + '\n（R 键 / 右侧锦囊钮使用，限 1 个）', '锦囊 · 一次性', j.icon, () => h.giveJinnang(id));
  }
  if (kind === 'troops') { const T = NEW_CARDS.troops; return card('new_troops', '援军', `一队义军（${T.n} 人）随你冲阵 ${T.ms / 1000} 秒`, '兵源 · 本关', 'growth_icon_tiger_tally', () => h.escort(T.n, T.ms)); }
  if (kind === 'supply') { const g = NEW_CARDS.supply.grain(h.chapter); return card('new_supply', '军资', `随军粮 +${g}\n并立即回复 ${Math.round(NEW_CARDS.supply.heal * 100)}% 生命`, '军资 · 立即', 'growth_icon_pickup', () => { h.addGrain(g); h.healFrac(NEW_CARDS.supply.heal); }); }
  const ss = h.manualSchools(); if (!ss.length) return null;
  const s = ss[Math.floor(rnd() * ss.length)], d = SCHOOLS[s];
  return card('new_manual_' + s, '研读心法 · ' + d.name, `${d.name}势 +1（本次征程有效，每派一次）`, '心法 · 本次征程', 'growth_icon_eight_trigrams', () => h.readManual(s));
}

/** 抽 n 张新卡（按权重、类不重复；某类出不了就跳过）。 */
export function drawNewCards(h: CardHost, n: number, avoid: ReadonlySet<NewCardKind> = new Set(), rnd: () => number = Math.random): UpgradeOption[] {
  const out: UpgradeOption[] = [], used = new Set<NewCardKind>(avoid);
  for (let tries = 0; out.length < n && tries < 12; tries++) {
    const kinds = (Object.keys(NEW_CARDS.weights) as NewCardKind[]).filter(k => !used.has(k)); if (!kinds.length) break;
    const total = kinds.reduce((t, k) => t + NEW_CARDS.weights[k], 0); let r = rnd() * total, pick = kinds[0];
    for (const k of kinds) { r -= NEW_CARDS.weights[k]; if (r <= 0) { pick = k; break; } }
    used.add(pick); const c = make(pick, h, rnd); if (c) out.push(c);
  }
  return out;
}
/** 卡属于哪一类新卡（不是新卡返回 null）。 */
export function newCardKind(o: UpgradeOption): NewCardKind | null {
  return o.id.startsWith('new_f_') ? 'fortune' : o.id.startsWith('jinnang_') ? 'jinnang' : o.id === 'new_troops' ? 'troops' : o.id === 'new_supply' ? 'supply' : o.id.startsWith('new_manual_') ? 'manual' : null;
}
export const ALL_SCHOOLS: readonly SchoolId[] = SCHOOL_IDS;
