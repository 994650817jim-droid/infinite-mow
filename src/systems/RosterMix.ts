import { ROSTER, ROSTER_MIX, STAGE_MIX, type BaseKind, type RosterRole } from '../data/enemyRoster';

/**
 * 配兵（data/enemyRoster 的 STAGE_MIX + ROSTER_MIX）：每次普通刷怪决定刷底层兵种还是本关的某个新兵种。
 * 纯逻辑、不依赖 Phaser（tools/test-roster-mix.mjs 直接在 node 里抽样检查比例和上限）。
 */
export interface MixCounts { total: number; special: number; byId: Record<string, number>; byRole: Partial<Record<RosterRole, number>> }

export function tallyRoster(list: Iterable<{ active: boolean; isSupplySlot?: boolean; def: { roster?: string } }>): MixCounts {
  const c: MixCounts = { total: 0, special: 0, byId: {}, byRole: {} };
  for (const e of list) {
    if (!e.active || e.isSupplySlot) continue;
    c.total += 1;
    const id = e.def.roster, t = id ? ROSTER[id] : undefined; if (!t) continue;
    c.byId[t.id] = (c.byId[t.id] ?? 0) + 1;
    c.byRole[t.role] = (c.byRole[t.role] ?? 0) + 1;
    if (!isFodder(t.role)) c.special += 1;
  }
  return c;
}

export const isFodder = (role: RosterRole): boolean => role === 'fodder' || role === 'pack';

/** 新兵种上限：在场敌军 × maxTraitShare（至少 1）。 */
export function specialRoom(c: MixCounts): number { return Math.max(1, Math.floor((c.total + 1) * ROSTER_MIX.maxTraitShare)) - c.special; }

/** 还能不能再上一个 id（兵种上限 + 角色上限 + 新兵种占比）。 */
export function canAdd(id: string, c: MixCounts): boolean {
  const t = ROSTER[id]; if (!t) return false;
  if ((c.byId[id] ?? 0) >= t.cap) return false;
  if ((c.byRole[t.role] ?? 0) >= (ROSTER_MIX.roleCaps[t.role] ?? Infinity)) return false;
  return isFodder(t.role) || specialRoom(c) > 0;
}

/** 刷上一个后更新计数（成群刷时逐个记）。 */
export function addCount(id: string, c: MixCounts): void {
  const t = ROSTER[id]; if (!t) return;
  c.total += 1; c.byId[id] = (c.byId[id] ?? 0) + 1; c.byRole[t.role] = (c.byRole[t.role] ?? 0) + 1;
  if (!isFodder(t.role)) c.special += 1;
}

export type MixPick = { trait: string } | { base: BaseKind } | null;

/** 抽一次：{trait} = 刷新兵种；{base} = 刷这个底层兵种；null = 交给本章原有刷怪表（chapter.pickEnemy）。 */
export function pickRoster(stageKey: string, wave: number, c: MixCounts, rnd: () => number = Math.random): MixPick {
  const mix = STAGE_MIX[stageKey]; if (!mix) return null;
  const base: Array<[BaseKind, number]> = [];
  if (mix.base) for (const [k, e] of Object.entries(mix.base)) if (e && wave >= (e.wave ?? 1) && e.w > 0) base.push([k as BaseKind, e.w]);
  const baseTotal = mix.base ? base.reduce((s, [, w]) => s + w, 0) : 100;
  const traits: Array<[string, number]> = [];
  for (const [id, e] of Object.entries(mix.traits)) if (wave >= (e.wave ?? ROSTER_MIX.firstWave) && e.w > 0 && canAdd(id, c)) traits.push([id, e.w * ROSTER_MIX.traitMul]);
  const total = baseTotal + traits.reduce((s, [, w]) => s + w, 0); if (total <= 0) return null;
  let r = rnd() * total;
  if (r < baseTotal) {
    if (!mix.base || !base.length) return null;
    for (const [k, w] of base) { if (r < w) return { base: k }; r -= w; }
    return { base: base[base.length - 1][0] };
  }
  r -= baseTotal;
  for (const [id, w] of traits) { if (r < w) return { trait: id }; r -= w; }
  return traits.length ? { trait: traits[traits.length - 1][0] } : null;
}

/** 测试面板一行：在场新兵种占比和各兵种数量。 */
export function mixSummary(c: MixCounts): string {
  const ids = Object.entries(c.byId).map(([id, n]) => `${ROSTER[id]?.name ?? id}${n}`).join(' ');
  return ids ? `新兵 ${c.special}/${c.total}（${Math.round(c.special / Math.max(1, c.total) * 100)}%）${ids}` : '';
}
