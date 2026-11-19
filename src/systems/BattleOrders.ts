import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';

/**
 * 军令（战场目标追踪，用户 2026-11-18「设计战斗地图，小地图可以看到目标要完成的任务之类的」；设计见共享笔记 battle-map-design.md）。
 * 一条军令 = 一项当前要做的事（带进度、可选的地图位置）；军令面板（ui/OrdersPanel）列出来，小地图（ui/BattleMap）标位置。
 *
 * 对外 API（其他系统往里推，不用 import 场景）：
 *   ordersOf(scene)?.set(id, { label, kind, progress, at })   // 新建或整条替换
 *   ordersOf(scene)?.patch(id, { progress: { cur, max } })     // 改几项
 *   ordersOf(scene)?.done(id) / .fail(id) / .remove(id)
 *   ordersOf(scene)?.timer('限时', endsAtElapsedSeconds)       // 一条倒计时（按场景 elapsed 秒）
 * 外部推进来的军令优先：同 id 的自动军令不再覆盖它。
 *
 * 自动来源（每 0.2 秒同步，全部只读）：关卡目标（StageObjectives）、首领 / 双首领、攻城（SiegeMidCity.goalLine 与巷战据点）、
 * 9-3 突围出口。各来源的读取都按字段名「看有没有」，不依赖那些系统的类型，也不改它们。
 */
export type OrderKind = 'main' | 'side' | 'boss';
export type OrderState = 'active' | 'done' | 'failed';
export interface OrderPos { x: number; y: number }
export interface BattleOrder {
  id: string; label: string; kind: OrderKind; state: OrderState;
  progress?: { cur: number; max: number };
  /** 地图位置（每次取最新；null = 暂时没有）。 */
  at?: () => OrderPos | null;
  /** 排序（小的在前）；默认按加入顺序。 */
  order: number;
  /** 完成时的显示（如「已归降」）。 */
  doneText?: string;
  /** 第二行小字（如攻城目标原文）。 */
  detail?: string;
}
export type OrderInput = Partial<Omit<BattleOrder, 'id' | 'order'>> & { label: string; order?: number };

/** 宿主（GameScene）给的只读视图。 */
export interface OrdersHost {
  scene: Phaser.Scene;
  elapsed(): number;
  over(): { over: boolean; victory: boolean };
  banner(title: string, caption: string): void;
  /** 关卡目标（data/objectives）：没有返回 null。 */
  stageObjective(): { kind: 'kills' | 'destroy' | 'hold'; cur: number; max: number; label: string; target?: string; limit: number; done: boolean; failed: boolean; points: OrderPos[] } | null;
  /** 当前在场的首领（双首领各一个）。 */
  bosses(): Array<{ key: string; name: string; e: Enemy; label?: string }>;
  /** 普通关（没有关卡目标）：当前波次与首领出阵时刻（elapsed 秒）；没有返回 null。 */
  waves?(): { cur: number; total: number; name: string; bossAt: number } | null;
  /** 本关首领名（登场前也知道，用于「首领将至」）。 */
  bossName(): string;
  bossSpawned(): boolean;
  bossKilled(): boolean;
  /** 双首领了结结果（劝降 / 败退显示用）。 */
  bossOutcome(key: string): 'killed' | 'persuaded' | 'retreated' | null;
}

const SYNC_MS = 200;
const KEY = '__battleOrders';
/** 取场景上的军令表（没有返回 null；手机布局也有，只是不显示小地图）。 */
export function ordersOf(scene: Phaser.Scene | null | undefined): BattleOrders | null {
  return (scene as unknown as Record<string, BattleOrders | undefined> | null)?.[KEY] ?? null;
}

type Any = Record<string, unknown> & { [k: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export class BattleOrders {
  private readonly list = new Map<string, BattleOrder>();
  /** 外部推进来的 id（自动来源不覆盖）。 */
  private readonly external = new Set<string>();
  private seq = 0; private acc = 0; private timerLabel = ''; private timerEnd = -1; private timerDanger = false;
  /** 测试用：完成过的军令（id → label）。 */
  readonly completed: Array<{ id: string; label: string }> = [];
  /** 本次同步里自动来源出现过的 id（没出现的自动军令清掉，已完成的保留到关卡结束）。 */
  private seen = new Set<string>();
  /** 面板 / 地图据此判断要不要重画。 */
  revision = 0;
  constructor(private readonly h: OrdersHost) {
    (h.scene as unknown as Record<string, unknown>)[KEY] = this;
    h.scene.events.once('shutdown', () => { const s = h.scene as unknown as Record<string, unknown>; if (s[KEY] === this) delete s[KEY]; });
  }

  // ———— 对外 API ————
  set(id: string, o: OrderInput): void { this.external.add(id); this.put(id, o); }
  patch(id: string, o: Partial<OrderInput>): void { const cur = this.list.get(id); if (!cur) return; this.external.add(id); this.put(id, { ...cur, ...o }); }
  done(id: string, doneText?: string): void { const o = this.list.get(id); if (!o || o.state === 'done') return; o.state = 'done'; if (doneText) o.doneText = doneText; this.onDone(o); }
  fail(id: string): void { const o = this.list.get(id); if (!o || o.state === 'failed') return; o.state = 'failed'; this.revision++; }
  remove(id: string): void { if (this.list.delete(id)) this.revision++; this.external.delete(id); }
  timer(label: string, endsAt: number, danger = false): void { if (this.timerLabel !== label || this.timerEnd !== endsAt || this.timerDanger !== danger) { this.timerLabel = label; this.timerEnd = endsAt; this.timerDanger = danger; this.revision++; } }
  clearTimer(): void { if (this.timerEnd >= 0) { this.timerEnd = -1; this.timerLabel = ''; this.revision++; } }
  get(id: string): BattleOrder | undefined { return this.list.get(id); }
  /** 按顺序：进行中在前，再完成 / 失败。 */
  all(): BattleOrder[] {
    const rank = (o: BattleOrder) => (o.state === 'active' ? 0 : 1);
    return [...this.list.values()].sort((a, b) => rank(a) - rank(b) || a.order - b.order);
  }
  /** 当前首要军令（进行中、有位置；首领排在主线目标之后）。 */
  current(): (BattleOrder & { pos: OrderPos }) | null {
    for (const o of this.all()) { if (o.state !== 'active' || !o.at) continue; const pos = o.at(); if (pos) return { ...o, pos }; }
    return null;
  }
  /** 倒计时：剩余秒数（没有返回 null）。 */
  timeLeft(): { label: string; left: number; danger: boolean } | null {
    if (this.timerEnd < 0) return null; const left = Math.max(0, this.timerEnd - this.h.elapsed());
    return { label: this.timerLabel, left, danger: this.timerDanger || left <= 60 };
  }
  clear(): void { this.list.clear(); this.external.clear(); this.bossRefs.clear(); this.revision++; }
  /** 战线推进到下一关：撤掉自动军令和首领记录（外部推进来的保留，由推的系统自己管）、清倒计时。 */
  resetAuto(): void {
    for (const id of [...this.list.keys()]) if (!this.external.has(id)) this.list.delete(id);
    this.bossRefs.clear(); this.clearTimer(); this.acc = SYNC_MS; this.revision++;
  }

  private put(id: string, o: OrderInput): void {
    const prev = this.list.get(id);
    const next: BattleOrder = { id, label: o.label, kind: o.kind ?? prev?.kind ?? 'main', state: o.state ?? prev?.state ?? 'active', progress: o.progress, at: o.at ?? prev?.at, order: o.order ?? prev?.order ?? ++this.seq, doneText: o.doneText ?? prev?.doneText, detail: o.detail ?? prev?.detail };
    const changed = !prev || prev.label !== next.label || prev.detail !== next.detail || prev.state !== next.state || prev.progress?.cur !== next.progress?.cur || prev.progress?.max !== next.progress?.max;
    this.list.set(id, next);
    if (changed) this.revision++;
    if (next.state === 'done' && prev?.state !== 'done') this.onDone(next);
  }
  private onDone(o: BattleOrder): void {
    this.revision++; this.completed.push({ id: o.id, label: o.label });
    if (!this.h.over().over && o.id !== 'waves' && o.id !== 'stage') this.h.banner('军令完成', o.doneText ? `${o.label} · ${o.doneText}` : o.label); // 波次那条和首领登场横幅同时出，不另弹
  }
  /** 自动来源写一条（外部推过的 id 跳过）。 */
  private auto(id: string, o: OrderInput): void { this.seen.add(id); if (this.external.has(id)) return; this.put(id, o); }

  // ———— 每帧 ————
  update(dt: number): void {
    this.acc += dt * 1000; if (this.acc < SYNC_MS) return; this.acc = 0;
    this.seen = new Set();
    this.syncStage(); this.syncSiege(); this.syncBreakout(); this.syncBosses();
    // 自动军令：这次没出现、又没完成的，撤掉（例如攻城换段后上一段的阶段军令）
    for (const [id, o] of this.list) if (!this.external.has(id) && !this.seen.has(id) && o.state === 'active') { this.list.delete(id); this.revision++; }
    const end = this.h.over(); if (end.over && end.victory) for (const o of this.list.values()) if (o.state === 'active' && o.kind !== 'side') { o.state = 'done'; this.revision++; }
  }

  private syncStage(): void {
    const s = this.h.stageObjective();
    if (!s) {
      // 普通关：「击退敌军 第 n/3 波」+ 首领出阵倒计时；首领登场后这条完成、倒计时撤掉
      if (this.isSiege() || (this.h.scene as unknown as Any).breakout) return;
      const w = this.h.waves?.(); if (!w) return;
      const spawned = this.h.bossSpawned();
      this.auto('waves', { label: '击退敌军', kind: 'main', order: 1, state: spawned ? 'done' : 'active', progress: { cur: Math.max(0, w.cur), max: w.total }, detail: w.name ? `第 ${w.cur}/${w.total} 波 · ${w.name}` : undefined });
      if (!spawned) this.timer('首领出阵', w.bossAt); else if (this.timerLabel === '首领出阵') this.clearTimer();
      return;
    }
    const label = s.kind === 'kills' ? '歼敌' : s.kind === 'destroy' ? '摧毁' + (s.target ?? '目标') : '坚守军旗';
    const pts = s.points;
    this.auto('stage', { label, kind: 'main', progress: { cur: Math.min(s.cur, s.max), max: s.max }, state: s.failed ? 'failed' : s.done ? 'done' : 'active', order: 1,
      at: pts.length ? () => { const p = this.h.stageObjective()?.points ?? []; return p.length ? this.nearest(p) : null; } : undefined });
    // 限时：很长的（如 2-3 洛阳 9999 秒，实际不判超时）不显示
    if (!this.isSiege()) { if (!s.done && !s.failed && s.limit < 3600) this.timer('限时', s.limit); else if (this.timerLabel === '限时') this.clearTimer(); }
    if (s.done && !this.h.bossSpawned()) this.auto('boss-wait', { label: `击败${this.h.bossName()}（即将出阵）`, kind: 'boss', order: 50 });
  }

  private isSiege(): boolean { const m = (this.h.scene as unknown as Any).mid; return !!m && typeof m.goalLine === 'function'; }
  private syncSiege(): void {
    const sc = this.h.scene as unknown as Any, m = sc.mid as Any | undefined; if (!m || typeof m.goalLine !== 'function') return;
    const phase = String(m.phase ?? ''), line = String(m.goalLine() ?? '');
    const PHASE: Record<string, string> = { outside: '城外 · 破城门', barbican: '瓮城 · 破内门', street: '巷战 · 占据点', hall: '府衙 · 击败守将', done: '占领完成' };
    // 阶段军令：整句目标（goalLine 原文）
    const gate = phase === 'outside' ? (m.gateImg ?? null) : phase === 'barbican' ? (m.innerGateImg ?? null) : null;
    this.auto('siege-phase', { label: PHASE[phase] ?? '攻城', kind: 'main', order: 2, state: phase === 'done' ? 'done' : 'active', detail: line.replace(/^[^·]+· /, ''),
      at: gate ? () => (gate.active === false ? null : { x: gate.x, y: gate.y }) : undefined });
    // 巷战据点
    if (phase === 'street' && Array.isArray(m.points)) {
      const pts = m.points as Array<{ name: string; x: number; y: number; state: string }>;
      pts.forEach((p, i) => this.auto('siege-point-' + p.name, { label: '占领' + p.name, detail: p.state === 'held' ? '已插旗 · 守住反扑' : undefined, kind: 'main', order: 3 + i, state: p.state === 'secured' ? 'done' : 'active',
        at: () => ({ x: p.x, y: p.y }) }));
    }
    // 攻城限时（援军阶段改「敌援抵达」）
    const t = sc.siegeTimer as { phase: string; limit: number; reinforceSeconds: number } | undefined;
    if (t && typeof t.limit === 'number') {
      if (t.phase === 'reinforce') this.timer('敌援抵达 · 撤军', t.limit + t.reinforceSeconds, true); else this.timer('限时', t.limit, t.phase === 'warn');
    }
  }
  private syncBreakout(): void {
    const b = (this.h.scene as unknown as Any).breakout as Any | undefined; if (!b || typeof b.distance !== 'number') return;
    this.auto('breakout', { label: '冲出麦城', detail: b.exited ? undefined : `距出口 ${b.distance} 步`, kind: 'main', order: 2, state: b.exited ? 'done' : 'active', at: () => ({ x: 0, y: -2520 }) });
  }
  /** 首领：登场后每人一条「击败 XX」，跟着首领走；了结（斩杀 / 劝降 / 败退）即完成。 */
  private bossRefs = new Map<string, { e: Enemy; life: number; name: string; label?: string }>();
  private syncBosses(): void {
    for (const b of this.h.bosses()) {
      // 同一个 key 换了新的首领（战线推进到下一关、首领重召）：当新首领重新记
      const id = 'boss-' + b.key, ref = this.bossRefs.get(id); if (!ref || ref.e !== b.e || ref.life !== b.e.spawnId) this.bossRefs.set(id, { e: b.e, life: b.e.spawnId, name: b.name, label: b.label });
    }
    for (const [id, r] of this.bossRefs) {
      const alive = r.e.active && r.e.spawnId === r.life && r.e.hp > 0, key = id.slice(5), out = this.h.bossOutcome(key);
      const doneText = out === 'persuaded' ? '已归降' : out === 'retreated' ? '已败退' : undefined;
      this.auto(id, { label: r.label ?? '击败' + r.name, kind: 'boss', order: 60, state: alive ? 'active' : 'done', doneText, at: () => (r.e.active && r.e.spawnId === r.life ? { x: r.e.x, y: r.e.y } : null) });
    }
    if (this.bossRefs.size) this.seen.add('boss-wait'); // 首领已登场：「即将出阵」那条交给下面清掉
    const wait = this.list.get('boss-wait'); if (wait && this.bossRefs.size) { this.list.delete('boss-wait'); this.revision++; }
  }
  private nearest(ps: OrderPos[]): OrderPos {
    const pl = (this.h.scene as unknown as Any).player as { x: number; y: number } | undefined; if (!pl) return ps[0];
    let best = ps[0], d = Infinity; for (const p of ps) { const k = (p.x - pl.x) ** 2 + (p.y - pl.y) ** 2; if (k < d) { d = k; best = p; } } return best;
  }
}
