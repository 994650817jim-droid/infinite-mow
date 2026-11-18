import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { EnemyKind } from '../types';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, actorDepth } from '../config';
import type { Parley } from './Parley';
import type { BossMount } from './BossMount';
import { BossKit } from './BossKit';
import { emitBossPhase } from './BossPhase';
import { PARTNER_ODDS } from '../data/surrender';

/**
 * 双首领关（设计会话 dual-boss-spec.md，用户 2026-11-18 确认）：两个首领同场，各有控制器、坐骑、招降窗、名牌、辉光、火环。
 *  - 压力控制：每人生命 ×0.65、伤害 ×0.8、招式间隔 ×1.4、召兵减半；首领在场时本关小怪刷新 ×0.7。
 *  - 大招令牌：同一时间只有一人能起手有预警的招，两人起手至少隔 0.8 秒（配合技除外）。
 *  - 配合技：两人都在场、都在主将 500 像素内，每 28 秒（任一人进二阶段后 20 秒）一次；横幅 + 预警 ×1.5 → 两人同时出手 → 两人 1.5 秒收招破绽。
 *  - 一人了结（斩杀 / 劝降 / 退走）：先了结的不掉宝箱；剩下的斩杀 / 退走 → 狂怒（2 秒转场、伤害 +25%、间隔 −25%、移速 +15%、立刻进二阶段、悲愤招），
 *    劝降 → 「心乱」15 秒（伤害 −15%、劝降把握 +20%）；某组可自定（夏侯渊张郃：张郃代督退兵）。被斩一方的同伴劝降把握 −10%。
 *  - 最后一人了结才走宝箱 → 结算（宿主 GameScene 照常处理）；双降不掉宝箱，改军粮 +100、横幅「{组名} · 同归麾下」。
 *  - 血条：屏幕下方两条并排（各 210，中间 20）；一人了结后灰掉 3 秒淡出，剩下那条滑到中间放宽到 440、标「狂怒」。
 * 数值都是初值，交平衡会话。演出全用现成手绘素材（WarnFx 预警、warcry_paint 战吼、BossKit 收招火星）。
 */
export const DUAL = {
  hpMul: .65, dmgMul: .8, gapMul: 1.4, summonMul: .5, spawnMul: .7,
  tokenGapMs: 800, entranceGapMs: 1200,
  combo: { everyMs: 28000, every2Ms: 20000, range: 500, warnMul: 1.5, recoverMs: 1500, gatherMs: 450, timeoutMs: 7000 },
  rage: { dmg: 1.25, gap: .75, speed: 1.15, cap: 1.4, shiftMs: 2000, signatureMul: 1.2, auraMs: 2600 },
  shaken: { dmg: .85, ms: 15000 },
  doubleProvisions: 100,
  hud: { barW: 210, gap: 20, mergedW: 440, fadeMs: 3000, slideMs: 450 },
} as const;

/** 双首领关里两类控制器（GuanduBoss / BossMoveset）共有的接口。 */
export interface DualCtrl {
  state: string; phase2: boolean; readonly label: string;
  /** 伤害 / 招式间隔 / 召兵数量倍数（双将压力控制 + 狂怒 / 心乱）。 */
  dmgMul: number; gapMul: number; summonMul: number;
  /** 伤害是否按 boss.def.damage 算（劝降失败的 +20% 已经乘在 def 上）。 */
  readonly defDamage: boolean;
  update(dt: number, now: number): void; incoming(ally: boolean): number; hit(now: number): void;
  defeat(): void; updateDeath(delta: number): void; clear(): void;
  /** 正在起手 / 出手（大招令牌）。 */ busy(): boolean;
  /** 不早于 at 起下一招。 */ holdUntil(at: number): void;
  /** 收招破绽（配合技之后）。 */ forceRecover(now: number, ms: number): void;
  /** 立刻进二阶段（狂怒；生命不回）。 */ forcePhase2(now: number): void;
  /** 狂怒转场：定住 ms（BossMoveset 走 BossKit.phaseShift）。返回是否自己做了转场演出。 */ enrage(now: number, ms: number, line: string, caption: string): boolean;
  /** 悲愤招：立刻放一次招牌招。 */ signature(now: number, mul: number): void;
  readonly mounted?: boolean;
}
export type DualOutcome = 'killed' | 'persuaded' | 'retreated';
type P = { x: number; y: number };
export interface DualEntry {
  id: string; name: string; color: 'gold' | 'red'; side: 0 | 1;
  enemy: Enemy; spawnId: number; ctrl: DualCtrl; parley: Parley | null; mount: BossMount | null;
  /** GuanduBoss 没有 BossKit：双将关给它补一个（收招火星、狂怒转场）。 */ kit: BossKit | null;
  done: DualOutcome | null; doneAt: number;
  rage: boolean; shakenUntil: number; sigAt: number; auraAt: number; invulnUntil: number;
  lastStart: number; wasBusy: boolean; phase2Sent: boolean; baseSpeed: number;
  /** 代督退兵等：倒计时到点退走（战斗时钟）。 */ retreatAt: number; status: string;
  /** 亲卫（代督退兵）：还有活着的时，首领受伤 ×guardMul。 */ guards: Enemy[]; guardMul: number;
  /** 登场时刻（战斗时钟）。 */ spawnedAt: number;
  /** 了结时刻（真实时间，血条灰掉淡出用）。 */ doneReal: number;
  /** 单挑时的生命上限（×0.65 之前）。 */ baseMaxHp: number;
}
export interface DualCombo {
  id: string; name: string; caption: string;
  /** 横幅后两人各喊一句：[首领 id, 台词]。 */ lines?: Array<[string, string]>;
  /** 摆位：返回 [左首领, 右首领] 的目标点（null = 原地）。 */
  place: (a: DualEntry, b: DualEntry, p: P) => [P | null, P | null];
  /** 两人同时起手（预警 ×warnMul）。 */
  fire: (a: DualEntry, b: DualEntry, p: P, now: number, warnMul: number) => void;
}
export interface DualPlan {
  group: string;
  lines: Record<string, { intro?: string; fall?: string; rage?: string; shaken?: string; retreat?: string; /** 同伴已了结时退走的台词（张郃代督后撤军）。 */ retreatLast?: string }>;
  combos: DualCombo[];
  /** 选这次的配合技（默认轮流）；返回 null = 这次不放。 */
  pick?: (d: DualBoss, n: number) => DualCombo | null;
  /** 一人了结后的特殊规则；返回 true = 已处理（不走默认狂怒 / 心乱）。 */
  react?: (d: DualBoss, fallen: DualEntry, other: DualEntry, how: DualOutcome, now: number) => boolean;
  /** 打到这条血线就退走（不死、不弹窗）：张郃 0.15。 */
  retreatAt?: Record<string, number>;
  /** 结果旗标（剧情分支）：值 = 两人结果首字母（k 斩 / p 降 / r 退），按左右顺序。 */
  outcomeFlag?: string;
}
export interface DualHost {
  scene: Phaser.Scene;
  player: () => { x: number; y: number };
  banner: (t: string, danger: boolean, caption?: string) => void;
  sfx: (k: string) => void;
  bark: (target: P, name: string, text: string) => void;
  /** 剧情按首领的倒下台词 + 横幅（关羽斩颜良）；返回是否说了。 */
  storyFall: (id: string, at: P & { displayHeight: number }) => boolean;
  /** 让场景把这个首领了结（退走、代督计时到）：宿主走 killEnemy。 */
  retire: (e: Enemy) => void;
  /** 当前主目标换人（this.boss）；parley：undefined = 不动、null = 清掉、否则指到这一个（结算读）。 */
  setPrimary: (e: Enemy | null, parley: Parley | null | undefined) => void;
  /** 白色残血拖尾（BossStagger）。 */
  trail: (spawnId: number, ratio: number) => number;
  live: () => boolean;
  setFlag: (k: string, v: string) => void;
  doubleSurrender: (group: string) => void;
  spawn: (kind: EnemyKind, x: number, y: number) => Enemy | null;
}

/** 关掉双首领（对比 / 单首领招式测试用）：?dual=0 或 window.__IM_DUAL_OFF。 */
export function dualOff(): boolean { try { return new URLSearchParams(globalThis.location?.search ?? '').get('dual') === '0' || !!(globalThis as Record<string, unknown>).__IM_DUAL_OFF; } catch { return false; } }

/** 首领淡出退走（败退型 / 张郃代督退兵 / 4-1 颜良负伤败走）：留一张当前姿势的影子，背向主将退开、淡出。 */
export function retreatFade(scene: Phaser.Scene, e: Enemy, from: P): void {
  const sp = e.sprite, a = Math.atan2(sp.y - from.y, sp.x - from.x);
  const img = scene.add.image(sp.x, sp.y, sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setScale(sp.scaleX, sp.scaleY).setFlipX(sp.flipX).setDepth(sp.depth).setName('boss-retreat');
  sp.setAlpha(0);
  scene.tweens.add({ targets: img, x: img.x + Math.cos(a) * 90, y: img.y + Math.sin(a) * 60, alpha: 0, delay: 500, duration: 1100, ease: 'Quad.easeIn', onComplete: () => img.destroy() });
}

export class DualBoss {
  readonly entries: DualEntry[] = [];
  /** 测试读：令牌冲突（两人同时在普通招式里）、最短起手间隔、配合技记录、狂怒 / 心乱。 */
  readonly log = { overlap: 0, minGap: Infinity, combos: [] as Array<{ id: string; at: number; warnMul: number; inRange: boolean }>, rage: [] as string[], shaken: [] as string[], outcomes: [] as Array<{ id: string; how: DualOutcome }>, phase: [] as string[] };
  private combo: { def: DualCombo; at: number; fireAt: number; fired: boolean; from: [P, P]; to: [P | null, P | null] } | null = null;
  private nextCombo = 0; private comboCount = 0;
  private pending: Array<{ at: number; fn: () => void }> = [];
  /** 战斗时钟到 at 时执行（第二位首领登场：暂停 / 弹窗期间不走）。 */
  later(at: number, fn: () => void): void { this.pending.push({ at, fn }); }
  private hudTexts: Phaser.GameObjects.Text[] = [];
  private mergedAt = 0;
  /** 剧情横幅（斩颜良）刚出：狂怒 / 心乱横幅晚一点出，免得一下顶掉（真实时间）。 */
  private quietUntil = 0;
  private banner(t: string, danger: boolean, cap?: string): void { const wait = this.quietUntil - performance.now(); if (wait > 0) this.h.scene.time.delayedCall(wait, () => this.h.banner(t, danger, cap)); else this.h.banner(t, danger, cap); }
  private real = 0;
  constructor(readonly h: DualHost, readonly plan: DualPlan, now: number) {
    this.nextCombo = now + DUAL.combo.everyMs;
    const s = h.scene;
    s.events.on('postupdate', this.post, this);
    s.events.once('shutdown', () => this.clear());
  }

  /** 加一位首领（第二位在第一位之后 1.2 秒登场）：套用双将压力倍数、HP ×0.65。 */
  add(spec: { id: string; name: string; enemy: Enemy; ctrl: DualCtrl; parley: Parley | null; mount: BossMount | null; ownKit?: boolean }, now: number): DualEntry {
    const side = this.entries.length as 0 | 1, e = spec.enemy;
    const baseMaxHp = e.maxHp; e.maxHp = Math.max(1, Math.round(e.maxHp * DUAL.hpMul)); e.hp = e.maxHp;
    const c = spec.ctrl; c.dmgMul = DUAL.dmgMul; c.gapMul = DUAL.gapMul; c.summonMul = DUAL.summonMul;
    const kit = spec.ownKit ? new BossKit({ scene: this.h.scene, boss: e, banner: (t, cap) => this.banner(t, true, cap), sfx: k => this.h.sfx(k) }) : null;
    const entry: DualEntry = { id: spec.id, name: spec.name, color: side === 0 ? 'gold' : 'red', side, enemy: e, spawnId: e.spawnId, ctrl: c, parley: spec.parley, mount: spec.mount, kit,
      done: null, doneAt: 0, rage: false, shakenUntil: 0, sigAt: 0, auraAt: 0, invulnUntil: 0, lastStart: -1e9, wasBusy: false, phase2Sent: false, baseSpeed: e.def.speed, retreatAt: 0, status: '', guards: [], guardMul: 1, spawnedAt: now, doneReal: 0, baseMaxHp };
    this.entries.push(entry);
    if (side === 1) this.nextCombo = Math.max(this.nextCombo, now + DUAL.combo.everyMs);
    return entry;
  }
  entryOf(e: Enemy | null | undefined): DualEntry | undefined { return e ? this.entries.find(x => x.enemy === e && x.spawnId === e.spawnId) : undefined; }
  owns(e: Enemy | null | undefined): boolean { return !!this.entryOf(e); }
  partner(x: DualEntry): DualEntry | undefined { return this.entries.find(y => y !== x); }
  get alive(): DualEntry[] { return this.entries.filter(x => !x.done && x.enemy.active && x.enemy.spawnId === x.spawnId); }
  /** 主目标：离主将最近、还活着的那个。 */
  nearest(): DualEntry | undefined { const p = this.h.player(); return this.alive.sort((a, b) => Math.hypot(a.enemy.x - p.x, a.enemy.y - p.y) - Math.hypot(b.enemy.x - p.x, b.enemy.y - p.y))[0]; }
  get comboActive(): boolean { return !!this.combo; }
  /** 首领在场时本关小怪刷新间隔倍数（×0.7 → 间隔 ÷0.7）。 */
  get spawnIntervalMul(): number { return this.alive.length ? 1 / DUAL.spawnMul : 1; }

  /** 招降把握的同伴加减（surrenderOdds 的 partner）。 */
  partnerOdds(x: DualEntry): { id: string; persuaded: boolean; executed: boolean } | undefined {
    const o = this.partner(x); if (!o) return undefined;
    return { id: o.id, persuaded: o.done === 'persuaded', executed: o.done === 'killed' };
  }

  // ———— 每帧 ————
  /** 敌人循环里每个首领调一次（返回 true = 归双将框架管）。 */
  step(e: Enemy, dt: number, now: number): boolean {
    const x = this.entryOf(e); if (!x) return false;
    if (x.done) return true;
    const o = this.partner(x), c = x.ctrl;
    // 配合技摆位：两人快步到位（不出招）
    if (this.combo && !this.combo.fired) {
      const k = Math.min(1, (now - this.combo.at) / DUAL.combo.gatherMs), i = x.side, to = this.combo.to[i], from = this.combo.from[i];
      if (to) { e.sprite.x = from.x + (to.x - from.x) * k; e.sprite.y = from.y + (to.y - from.y) * k; }
      return true;
    }
    // 大招令牌：同伴在出招或刚起手不足 0.8 秒 → 先不起手
    if (!this.combo && o && !o.done && (o.ctrl.busy() || now - o.lastStart < DUAL.tokenGapMs)) c.holdUntil(now + 60);
    if (this.combo) c.holdUntil(now + 60);
    c.update(dt, now);
    x.kit?.update(now);
    const busy = c.busy();
    if (busy && !x.wasBusy && !this.combo) {
      if (o && !o.done && o.lastStart > -1e9) this.log.minGap = Math.min(this.log.minGap, now - o.lastStart);
      x.lastStart = now;
    }
    if (busy && !this.combo && o && !o.done && o.wasBusy && !this.combo) this.log.overlap++;
    x.wasBusy = busy;
    return true;
  }
  /** 场景 update（战斗中，mode none）：招降、二阶段事件、配合技调度、狂怒 / 心乱计时、退走线。 */
  update(now: number): void {
    for (let i = this.pending.length - 1; i >= 0; i--) if (now >= this.pending[i].at) { const f = this.pending[i].fn; this.pending.splice(i, 1); f(); }
    for (const x of this.entries) {
      if (x.done || !x.enemy.active) continue;
      x.parley?.update();
      const c = x.ctrl, e = x.enemy;
      // 二阶段事件（带首领 id；BossMoveset 自己也发，同一首领同一阶段只发一次）
      if (c.phase2 && !x.phase2Sent) { x.phase2Sent = true; this.log.phase.push(x.id); emitBossPhase(this.h.scene, { boss: e, phase: 2, dismount: !!x.mount?.mounted || !!c.mounted, name: x.name, bossId: x.id }); }
      // 伤害倍数：双将 ×0.8 × 狂怒（与劝降失败 +20% 合计最多 +40%）× 心乱
      const failed = x.parley?.state === 'failed' ? 1.2 : 1, bonus = x.rage ? Math.min(DUAL.rage.cap, DUAL.rage.dmg * failed) : failed;
      c.dmgMul = DUAL.dmgMul * bonus / (c.defDamage ? failed : 1) * (now < x.shakenUntil ? DUAL.shaken.dmg : 1);
      c.gapMul = DUAL.gapMul * (x.rage ? DUAL.rage.gap : 1);
      if (x.invulnUntil && now >= x.invulnUntil) { x.invulnUntil = 0; if (x.parley?.state !== 'open') e.invulnerable = false; } else if (x.invulnUntil) e.invulnerable = true; // 狂怒转场 2 秒无敌（BossKit 转场 1.5 秒就放开，这里撑满）
      if (x.sigAt && now >= x.sigAt && !c.busy()) { x.sigAt = 0; c.signature(now, DUAL.rage.signatureMul); }
      if (x.rage && now >= x.auraAt) { x.auraAt = now + DUAL.rage.auraMs; this.warcry(e, 1, .75, 130, 260, 11, .55); }
      // 退走线（张郃：不死、不弹窗）/ 退兵倒计时
      const line = this.plan.retreatAt?.[x.id];
      if ((line !== undefined && e.hp <= e.maxHp * line) || (x.retreatAt && now >= x.retreatAt)) { this.h.retire(e); continue; }
    }
    this.h.setPrimary(this.nearest()?.enemy ?? null, undefined);
    this.updateCombo(now);
  }
  private updateCombo(now: number): void {
    const [a, b] = this.entries; if (!a || !b) return;
    const both = !a.done && !b.done && a.enemy.active && b.enemy.active;
    if (this.combo) {
      const cb = this.combo;
      if (!both || now - cb.at > DUAL.combo.timeoutMs) { this.combo = null; this.nextCombo = now + this.every(); return; }
      if (!cb.fired && now - cb.at >= DUAL.combo.gatherMs) { cb.fired = true; cb.fireAt = now; cb.def.fire(a, b, this.h.player(), now, DUAL.combo.warnMul); a.lastStart = b.lastStart = now; }
      if (cb.fired && now - cb.fireAt > 120) {
        // 先收手的那个原地破绽等同伴；两人都收手 → 各 1.5 秒收招破绽
        for (const x of [a, b]) if (!x.ctrl.busy()) { x.ctrl.forceRecover(now, DUAL.combo.recoverMs); x.kit?.recover(now, DUAL.combo.recoverMs); }
        if (!a.ctrl.busy() && !b.ctrl.busy()) { this.combo = null; this.nextCombo = now + this.every(); }
      }
      return;
    }
    if (!both || now < this.nextCombo || a.ctrl.busy() || b.ctrl.busy() || a.sigAt || b.sigAt) return;
    const p = this.h.player(), inRange = [a, b].every(x => Math.hypot(x.enemy.x - p.x, x.enemy.y - p.y) <= DUAL.combo.range);
    if (!inRange) return;
    const def = this.plan.pick ? this.plan.pick(this, this.comboCount) : this.plan.combos[this.comboCount % this.plan.combos.length];
    if (!def) { this.nextCombo = now + 2000; return; }
    this.startCombo(def, now);
  }
  private every(): number { return this.entries.some(x => x.ctrl.phase2) ? DUAL.combo.every2Ms : DUAL.combo.everyMs; }
  /** 起一次配合技（测试也直接调）。 */
  startCombo(def: DualCombo, now: number): void {
    const [a, b] = this.entries, p = this.h.player();
    this.comboCount++;
    this.combo = { def, at: now, fireAt: 0, fired: false, from: [{ x: a.enemy.x, y: a.enemy.y }, { x: b.enemy.x, y: b.enemy.y }], to: def.place(a, b, p) };
    this.log.combos.push({ id: def.id, at: now, warnMul: DUAL.combo.warnMul, inRange: [a, b].every(x => Math.hypot(x.enemy.x - p.x, x.enemy.y - p.y) <= DUAL.combo.range) });
    this.h.banner(def.name, true, def.caption); this.h.sfx('gong');
    (def.lines ?? []).forEach(([id, text], i) => { const x = this.entries.find(y => y.id === id); if (!x) return; const say = (): void => { if (!x.done && x.enemy.active) this.h.bark(x.enemy, x.name, text); }; this.h.scene.time.delayedCall(700 + i * 800, say); }); // 等横幅亮过再喊，免得字叠在一起
  }

  /** 首领招降：没表态前不死（每人一个 Parley）。 */
  preventKill(e: Enemy): boolean { const x = this.entryOf(e); return !!x && !x.done && !!x.parley?.preventKill(e); }

  /**
   * 场景 killEnemy 里调用：了结这位首领。返回 'first'（还有同伴：不掉宝箱，宿主只做通用记账）/ 'last'（宿主照常走首领倒下 → 宝箱 → 结算）。
   * persuaded：劝降成功（Parley 跪降后宿主置的 persuadeKill）。
   */
  resolve(e: Enemy, persuaded: boolean, now: number): { order: 'first' | 'last'; how: DualOutcome } {
    const x = this.entryOf(e)!, o = this.partner(x);
    const how: DualOutcome = persuaded ? 'persuaded' : this.plan.retreatAt?.[x.id] !== undefined || x.retreatAt ? 'retreated' : 'killed';
    x.done = how; x.doneAt = now; x.doneReal = performance.now(); this.log.outcomes.push({ id: x.id, how });
    if (this.combo) this.combo = null;
    // 演出：斩杀倒地（控制器倒地帧）；劝降已跪降淡出；退走淡出
    const at = { x: e.x, y: e.y, displayHeight: e.sprite.displayHeight };
    if (how === 'killed') { x.ctrl.defeat(); x.mount?.destroy(); x.mount = null; }
    else { if (how === 'retreated') retreatFade(this.h.scene, e, this.h.player()); x.ctrl.clear(); x.mount?.destroy(); x.mount = null; }
    x.kit?.clear(); x.kit = null;
    // 台词：斩杀 → 剧情（关羽斩颜良）优先，否则本人临终台词；退走 → 退兵台词
    const L = this.plan.lines[x.id] ?? {};
    // 宁死不降（已弹过窗）：拒绝台词当临终台词；关羽在队：剧本「斩颜良」横幅 + 旗标
    if (how === 'killed') { this.quietUntil = performance.now() + 1600; /* 斩将横幅（斩颜良）先亮一会儿 */ if (!x.parley?.dyingLine(at) && !this.h.storyFall(x.id, at) && L.fall) this.h.bark(at, x.name, L.fall); }
    const last = !o || !!o.done, rl = last && L.retreatLast ? L.retreatLast : L.retreat;
    if (how === 'retreated' && rl) this.h.bark(at, x.name, rl);
    if (last) {
      this.h.setPrimary(e, x.parley);
      if (this.plan.outcomeFlag && this.h.live()) this.h.setFlag(this.plan.outcomeFlag, this.entries.map(y => y.done?.[0] ?? '?').join(''));
      if (this.entries.length === 2 && this.entries.every(y => y.done === 'persuaded')) this.h.doubleSurrender(this.plan.group);
      return { order: 'last', how };
    }
    this.h.setPrimary(o.enemy, undefined);
    this.mergedAt = performance.now();
    if (!this.plan.react?.(this, x, o, how, now)) {
      if (how === 'persuaded') this.shaken(o, now); else this.enrage(o, now);
    }
    return { order: 'first', how };
  }
  /** 同伴被劝降：心乱 15 秒（伤害 −15%），劝降把握 +20%；不狂怒。 */
  shaken(o: DualEntry, now: number): void {
    o.shakenUntil = now + DUAL.shaken.ms; o.status = '心乱'; this.log.shaken.push(o.id);
    const L = this.plan.lines[o.id] ?? {};
    this.h.scene.time.delayedCall(1700, () => { if (!o.done && o.enemy.active) { if (L.shaken) this.h.bark(o.enemy, o.name, L.shaken); this.banner(o.name + ' · 心乱', false, `伤害 −${Math.round((1 - DUAL.shaken.dmg) * 100)}% · 劝降把握 +${Math.round(PARTNER_ODDS.persuaded * 100)}%`); } });
  }
  /** 同伴被斩 / 退走：狂怒（2 秒无敌转场、悲愤台词、伤害 / 间隔 / 移速、立刻进二阶段、悲愤招）。 */
  enrage(o: DualEntry, now: number, line?: string): void {
    if (o.rage) return;
    o.rage = true; o.status = '狂怒'; this.log.rage.push(o.id);
    const e = o.enemy, c = o.ctrl, L = this.plan.lines[o.id] ?? {};
    e.def = { ...e.def, speed: o.baseSpeed * DUAL.rage.speed };
    e.invulnerable = true; o.invulnUntil = now + DUAL.rage.shiftMs;
    if (!c.phase2) c.forcePhase2(now);
    const own = c.enrage(now, DUAL.rage.shiftMs, o.name + ' · 狂怒', '伤害提高 · 出招更快');
    if (!own) { (o.kit ?? null)?.phaseShift(now, o.name + ' · 狂怒', '伤害提高 · 出招更快', 0x300808, .1); }
    this.h.scene.cameras.main.shake(320, .007); this.h.sfx('warCry');
    this.warcry(e, 0, .45, 320, 640, 16, 1); this.warcry(e, 1, .75, 170, 340, 13, 1);
    o.auraAt = now + 1800; o.sigAt = now + DUAL.rage.shiftMs;
    const text = line ?? L.rage;
    if (text) this.h.scene.time.delayedCall(1400, () => { if (!o.done && o.enemy.active) this.h.bark(o.enemy, o.name, text); });
  }
  /** 手绘战吼图集 warcry_paint（行 0 声浪、行 1 气势），暗红色调，跟着首领走。 */
  private warcry(e: Enemy, row: number, oy: number, w: number, hgt: number, fps: number, alpha: number): void {
    const s = this.h.scene; if (!s.textures.exists('warcry_paint')) return;
    const sp = s.add.sprite(e.x, e.y + 4, 'warcry_paint', row * 6).setOrigin(.5, oy).setDisplaySize(w, hgt).setBlendMode(Phaser.BlendModes.ADD).setAlpha(alpha).setTint(0xff6a4a).setDepth(row === 0 ? DEPTH.fx : actorDepth(e.y) + .05).setName(row === 0 ? 'dual-rage-wave' : 'dual-rage-aura');
    const st = { t: 0 };
    s.tweens.add({ targets: st, t: 5.99, duration: 6000 / fps, onUpdate: () => { if (!sp.active) return; sp.setFrame(row * 6 + Math.floor(st.t)).setPosition(e.x, e.y + 4); if (row) sp.setDepth(actorDepth(e.y) + .05); }, onComplete: () => sp.destroy() });
  }
  /** 受伤倍数（控制器自己的预警减伤 / 军势分摊 × 狂怒转场无敌由 invulnerable 管）。 */
  incoming(e: Enemy, ally: boolean, now: number): number { const x = this.entryOf(e); if (!x || x.done) return 1; x.ctrl.hit(now); return x.ctrl.incoming(ally) * (x.guards.some(g => g.active) ? x.guardMul : 1); }

  // ———— 镜头 ————
  /** 双首领取景：主将 ×0.7 + 两首领中点 ×0.3；主将始终在画面中间 60%；两人相距超过 0.8 屏宽就不偏（靠屏外箭头）。返回镜头左上角目标。 */
  cameraTarget(px: number, py: number): P | null {
    const al = this.alive; if (al.length < 2) return null;
    const [a, b] = al;
    if (Math.hypot(a.enemy.x - b.enemy.x, a.enemy.y - b.enemy.y) > GAME_WIDTH * .8) return null;
    const mx = (a.enemy.x + b.enemy.x) / 2, my = (a.enemy.y + b.enemy.y) / 2;
    let cx = px * .7 + mx * .3, cy = py * .7 + my * .3;
    // 主将在中间 60%：|主将 − 画面中心| ≤ 0.3 屏
    cx = Phaser.Math.Clamp(cx, px - GAME_WIDTH * .3, px + GAME_WIDTH * .3); cy = Phaser.Math.Clamp(cy, py - GAME_HEIGHT * .3, py + GAME_HEIGHT * .3);
    return { x: cx - GAME_WIDTH / 2, y: cy - GAME_HEIGHT / 2 };
  }

  // ———— 血条（屏幕下方两条并排） ————
  get hudActive(): boolean { const rn = performance.now(); return this.entries.some(x => !x.done || rn - x.doneReal < DUAL.hud.fadeMs); }
  drawHud(g: Phaser.GameObjects.Graphics, hpBarColor: number, danger: number): void {
    const s = this.h.scene, H = DUAL.hud, barY = GAME_HEIGHT - 68, rn = performance.now();
    if (!this.hudTexts.length) for (let i = 0; i < 6; i++) this.hudTexts.push(s.add.text(0, 0, '', { fontFamily: FONT, fontSize: i % 3 === 0 ? '15px' : '13px', color: i % 3 === 0 ? '#e8c76a' : '#f5efe6', stroke: '#140c06', strokeThickness: 3, resolution: 2 }).setScrollFactor(0).setDepth(DEPTH.hud + 1).setName('dual-hud-' + i));
    const two = H.barW * 2 + H.gap, left0 = (GAME_WIDTH - two) / 2;
    const alive = this.entries.filter(x => !x.done), merged = alive.length === 1 && this.entries.length === 2;
    // 了结那条灰着留 3 秒、最后三成时间淡出；剩下那条等它开始淡出再滑到中间放宽
    const slide = merged ? Phaser.Math.Clamp((rn - this.mergedAt - H.fadeMs * .7) / H.slideMs, 0, 1) : 0, ease = slide * slide * (3 - 2 * slide);
    this.entries.forEach((x, i) => {
      const [nameT, pctT, stT] = this.hudTexts.slice(i * 3, i * 3 + 3);
      const e = x.enemy, ratio = x.done ? 0 : Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
      let bx = left0 + i * (H.barW + H.gap), bw: number = H.barW, a = 1;
      if (x.done) { const t = (rn - x.doneReal) / H.fadeMs; a = t < .7 ? 1 : Math.max(0, 1 - (t - .7) / .3); }
      else if (merged) { const cx = (GAME_WIDTH - H.mergedW) / 2; bx = bx + (cx - bx) * ease; bw = H.barW + (H.mergedW - H.barW) * ease; }
      const show = a > .02;
      const word = x.done === 'killed' ? '授首' : x.done === 'persuaded' ? '归降' : x.done === 'retreated' ? '退走' : '';
      nameT.setVisible(show).setAlpha(a).setPosition(bx, barY - 24).setText(x.name + (word ? ' · ' + word : '')).setColor(x.done ? '#9a9088' : x.color === 'gold' ? '#e8c76a' : '#f0a890');
      pctT.setVisible(show).setAlpha(a).setOrigin(1, 0).setPosition(bx + bw, barY - 24).setText(x.done ? '' : Math.round(ratio * 100) + '%');
      const st = x.done ? '' : [x.rage ? '狂怒' : x.status === '心乱' && this.nowOf() < x.shakenUntil ? '心乱 ' + Math.ceil((x.shakenUntil - this.nowOf()) / 1000) + '秒' : x.status && x.status !== '心乱' ? x.status : '', x.ctrl.label].filter(Boolean).join(' · ');
      stT.setVisible(show && !!st).setAlpha(a).setOrigin(i === 0 && !merged ? 0 : 1, 0).setPosition(i === 0 && !merged ? bx : bx + bw, barY + 16).setText(st).setColor(x.rage ? '#ff6a4a' : '#d8c8a8');
      if (!show) return;
      g.fillStyle(0x000000, .72 * a).fillRect(bx, barY, bw, 12);
      if (!x.done) {
        const tr = this.h.trail(x.spawnId, ratio);
        if (tr > ratio) g.fillStyle(0xfff4e0, .92 * a).fillRect(bx + 2 + (bw - 4) * ratio, barY + 2, (bw - 4) * (tr - ratio), 8);
        g.fillStyle(x.rage ? danger : hpBarColor, .95 * a).fillRect(bx + 2, barY + 2, Math.max(0, (bw - 4) * ratio), 8);
        g.lineStyle(1, x.color === 'gold' ? 0xd8a23a : 0xc8321e, .7 * a).strokeRect(bx, barY, bw, 12);
      } else g.fillStyle(0x6a6460, .5 * a).fillRect(bx + 2, barY + 2, bw - 4, 8);
    });
  }
  hideHud(): void { for (const t of this.hudTexts) t.setVisible(false); }
  private nowOf(): number { return (this.h.scene as unknown as { combatNow?: number }).combatNow ?? 0; }
  /** 倒地帧按真实时间播（不跟模式暂停）。 */
  private post(): void {
    const rn = performance.now(), dt = this.real ? Math.min(100, rn - this.real) : 16; this.real = rn;
    for (const x of this.entries) if (x.done === 'killed') x.ctrl.updateDeath(dt);
  }
  /** 测试 / 调试快照。 */
  snapshot() {
    return { entries: this.entries.map(x => ({ id: x.id, name: x.name, side: x.side, hp: x.enemy.hp, maxHp: x.enemy.maxHp, baseMaxHp: x.baseMaxHp, active: x.enemy.active, done: x.done, rage: x.rage, shaken: x.shakenUntil > this.nowOf(), status: x.status, phase2: x.ctrl.phase2, busy: x.ctrl.busy(), state: x.ctrl.state, dmgMul: x.ctrl.dmgMul, gapMul: x.ctrl.gapMul, summonMul: x.ctrl.summonMul, speed: x.enemy.def.speed, baseSpeed: x.baseSpeed, spawnedAt: x.spawnedAt, guards: x.guards.filter(g => g.active).length, x: Math.round(x.enemy.x), y: Math.round(x.enemy.y), mounted: !!x.mount?.mounted || !!x.ctrl.mounted, parley: x.parley?.state ?? null, retreatAt: x.retreatAt, invulnerable: x.enemy.invulnerable })),
      combo: this.combo ? { id: this.combo.def.id, fired: this.combo.fired } : null, nextCombo: this.nextCombo, comboCount: this.comboCount, log: { ...this.log, minGap: this.log.minGap === Infinity ? null : this.log.minGap } };
  }
  /** 测试：下一次配合技马上可放。 */
  comboNow(now: number): void { this.nextCombo = now; }
  clear(): void {
    const s = this.h.scene; s.events.off('postupdate', this.post, this);
    for (const t of this.hudTexts) t.destroy(); this.hudTexts = [];
    for (const x of this.entries) { x.kit?.clear(); x.kit = null; if (!x.done) x.ctrl.clear(); x.mount?.destroy(); x.mount = null; x.parley?.clear(); }
  }
}
