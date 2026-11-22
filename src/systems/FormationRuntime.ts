import type { Ally } from '../entities/Ally';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Legion } from './Legion';
import type { SchoolId } from '../data/schools';
import type { Order } from '../data/legion';
import { FORMATION, FORMATIONS, formationLoadout, formationPower, formationSlots, formationSwitchMs, formationsKnown, type FormationId } from '../data/formations';
import { timerProgress, type BuffProgress } from '../ui/BuffProgress';

/** 随从这边要的接口（FollowerSquad 读）。 */
export interface FormationFollowerHooks { slot(i: number, n: number): { x: number; y: number } | null; dmg(template: string): number; taken(): number }
export interface FormationHost {
  player: Player; legion: Legion; hero: string;
  followerHeroes(): string[];
  followers(): { formation?: FormationFollowerHooks | null } | null;
  majors(): readonly SchoolId[];
  command(): number;
  enemiesNear(x: number, y: number, r: number): Enemy[];
  stun(e: Enemy, ms: number, now: number): void;
  hit(e: Enemy, dmg: number): void;
  banner(title: string, sub: string): void;
  sfx?(key: string): void;
}
/**
 * 军阵（data/formations.ts、formation-design.md）战斗中的一切：当前阵、变阵冷却、成阵时间、阵势加成（接进 Legion / FollowerSquad / Player）、
 * 各阵的出击打法与持续效果（长蛇绕击、八阵困阵、锋矢冲锋）。
 * 阵势只在护阵（E）且成阵后生效、只给入阵人数以内的士兵；主将加成（受伤 / 移速 / 范围）出击时也保留。
 */
export class FormationRuntime {
  known: FormationId[] = []; loadout: FormationId[] = []; idx = 0;
  current: FormationId | null = null;
  settleUntil = 0; cdUntil = 0; private cdMs: number = FORMATION.switchMs; private clock = 0;
  private power = { mul: 1, echo: false, favored: false, half: false }; private powerAt = -1e9;
  private chargeReadyAt = 0; private charging = new Map<Ally, { until: number; hits: Set<number> }>();
  private grazeAt = new Map<number, number>(); private trapAt = 0; private volleys: Array<{ at: number; x: number; y: number }> = [];
  private pincerCache = new WeakMap<Enemy, { t: number; v: boolean }>(); private scratch: Ally[] = [];
  readonly stats = { switches: 0, graze: 0, trapped: 0, pincer: 0, volleys: 0, charges: 0, chargeHits: 0, pushed: 0, flank: 0, sortie: 0 };
  constructor(private readonly h: FormationHost) { h.legion.fm = this; h.legion.onOrder = o => this.onOrder(o); this.refresh(); }

  /** 重读学会的阵与布阵（开局、行营改布阵后）。 */
  /** 名将连战：阵靠局内奇遇卡拿（不读主线进度 / 行营布阵）。setLoadout 之后 refresh 只用这一组，前两个是主阵 / 备阵。 */
  private fixed: FormationId[] | null = null;
  setLoadout(ids: readonly FormationId[]): void { this.fixed = [...ids]; this.refresh(); }
  refresh(): void {
    this.known = this.fixed ? [...this.fixed] : formationsKnown(this.h.hero, this.h.followerHeroes());
    this.loadout = this.fixed ? this.fixed.slice(0, 2) : formationLoadout(this.h.hero, this.known);
    this.idx = 0; this.current = this.loadout[0] ?? null; this.settleUntil = 0; this.powerAt = -1e9; this.apply();
  }
  private apply(): void { this.h.legion.formation.setShape(this.current, this.current ? formationSlots(this.h.command()) : Infinity); }
  private pow() { if (this.current && this.clock - this.powerAt > 1000) { this.powerAt = this.clock; this.power = formationPower(this.current, this.h.hero, this.h.majors()); } return this.power; }
  /** 主效果（封顶）。 */
  private main(base: number): number { return Math.min(FORMATION.mainCap, base * this.pow().mul); }
  /** 阵势生效：有阵、成阵、护阵。 */
  get formed(): boolean { return !!this.current && this.clock >= this.settleUntil && this.h.legion.order === 'guard'; }
  private on(u: Ally): boolean { return this.formed && this.h.legion.formation.inForm.has(u.id); }

  // ———— Legion 接口 ————
  dmg(u: Ally, e: Enemy): number {
    if (!this.on(u)) return 1;
    switch (this.current) {
      case 'circle': return 1 + FORMATION.circle.dmg;
      case 'wedge': { const l = this.h.legion.formation.local(e.x, e.y), a = Math.abs(Math.atan2(l.x, l.y)) * 180 / Math.PI; return a <= FORMATION.wedge.arcDeg ? 1 + this.main(FORMATION.wedge.front) : 1; }
      case 'crane': { if (!this.pinched(e)) return 1; this.stats.pincer++; return 1 + this.main(FORMATION.crane.pincer); }
      case 'geese': return u.def.ranged ? 1 + this.main(FORMATION.geese.ranged) : 1 + FORMATION.geese.melee;
      case 'snake': return 1 + FORMATION.snake.dmg;
      case 'bazhen': return 1 + FORMATION.bazhen.dmg;
      default: return 1;
    }
  }
  taken(u: Ally): number {
    if (!this.on(u)) return 1;
    switch (this.current) {
      case 'circle': return 1 - Math.min(FORMATION.circle.cap, this.main(FORMATION.circle.taken));
      case 'wedge': return 1 + FORMATION.wedge.taken;
      case 'crane': return 1 + FORMATION.crane.taken;
      case 'bazhen': return 1 - FORMATION.bazhen.taken;
      default: return 1;
    }
  }
  range(u: Ally): number {
    if (!this.on(u)) return 1;
    if (this.current === 'crane') return 1 + FORMATION.crane.range;
    if (this.current === 'geese' && u.def.ranged) return 1 + FORMATION.geese.range;
    return 1;
  }
  /** 被夹击：120 像素内有两名我方士兵分处两侧（夹角 ≥ 120°）。每个敌人 0.2 秒算一次。 */
  private pinched(e: Enemy): boolean {
    const c = this.pincerCache.get(e); if (c && this.clock - c.t < 200) return c.v;
    const R = FORMATION.crane.pincerR, list = this.h.legion.grid.query(e.x, e.y, R, this.scratch).filter(a => a.active && Math.hypot(a.x - e.x, a.y - e.y) <= R).slice(0, 10);
    let v = false; const ang = list.map(a => Math.atan2(a.y - e.y, a.x - e.x));
    for (let i = 0; i < ang.length && !v; i++) for (let j = i + 1; j < ang.length; j++) if (Math.cos(ang[i] - ang[j]) <= -.5) { v = true; break; }
    this.pincerCache.set(e, { t: this.clock, v }); return v;
  }

  // ———— 随从接口（FollowerSquad.formation） ————
  readonly followerHooks: FormationFollowerHooks = {
    slot: (i, n) => this.current ? this.h.legion.formation.followerSlot(i, n) : null,
    dmg: t => this.followerDmg(t),
    taken: () => !this.formed ? 1 : this.current === 'circle' ? 1 - Math.min(FORMATION.circle.cap, this.main(FORMATION.circle.taken)) : this.current === 'bazhen' ? 1 - FORMATION.bazhen.taken : 1,
  };
  /** 随从伤害（随从不占入阵名额，阵在就吃）。 */
  private followerDmg(template: string): number {
    if (!this.formed) return 1;
    switch (this.current) {
      case 'wedge': return 1 + this.main(FORMATION.wedge.front) * .5;
      case 'crane': return 1 + this.main(FORMATION.crane.pincer) * .5;
      case 'geese': return template === 'bow' ? 1 + this.main(FORMATION.geese.ranged) : 1;
      case 'bazhen': return 1 + FORMATION.bazhen.dmg;
      default: return 1;
    }
  }
  // ———— 变阵 ————
  /** X 键：主阵 ⇄ 备阵。冷却中 / 只有一个阵时返回 false（横幅说明原因）。 */
  switch(now: number): boolean {
    this.clock = now;
    if (!this.current) return false;
    if (this.loadout.length < 2) { this.h.banner('只布了一个阵', '行营「布阵」再选一个备阵'); return false; }
    if (now < this.cdUntil) { this.h.banner('变阵冷却', Math.ceil((this.cdUntil - now) / 1000) + ' 秒后可变阵'); return false; }
    this.idx = 1 - this.idx; this.current = this.loadout[this.idx];
    this.settleUntil = now + (this.current === 'bazhen' ? FORMATION.bazhenSettleMs : FORMATION.settleMs);
    this.cdMs = formationSwitchMs(this.h.majors()); this.cdUntil = now + this.cdMs; this.powerAt = -1e9; this.charging.clear();
    this.apply(); this.stats.switches++;
    const d = FORMATIONS[this.current]; this.h.banner('变阵 · ' + d.name, d.main); this.h.sfx?.('formation_switch');
    return true;
  }
  /** 增益图标进度：变阵冷却 / 成阵中。 */
  progress(now: number): BuffProgress | null {
    if (!this.current) return null;
    if (now < this.settleUntil) return timerProgress(this.settleUntil, this.current === 'bazhen' ? FORMATION.bazhenSettleMs : FORMATION.settleMs, now, '', '成阵');
    if (this.loadout.length < 2) return null;
    return now < this.cdUntil ? timerProgress(this.cdUntil, this.cdMs, now, '', '变阵冷却') : { cur: 1, max: 1, seg: 0, ready: true, text: '可变阵（X）' };
  }
  /** 增益图标说明。 */
  info(): { name: string; desc: string; kind: string; mark: string; icon?: string } | null {
    if (!this.current) return null;
    const d = FORMATIONS[this.current], p = this.pow(), f = this.h.legion.formation, n = this.h.legion.units.filter(u => u.active).length;
    const tags = [p.echo ? '呼应 ×1.5' : '', p.favored ? '擅阵 ×1.25' : '', p.half ? '诸葛亮随行 · 半效' : ''].filter(Boolean).join(' · ');
    const ik = 'formation_icon_' + this.current;
    return { name: '阵 · ' + d.name, mark: d.short, icon: this.h.player.scene.textures.exists(ik) ? ik : undefined,
      desc: `${d.main}\n代价：${d.cost}\n主将：${d.hero}\n${d.sortie}\n适用：${d.fit}\n入阵${Math.min(n, f.cap)} / ${Number.isFinite(f.cap) ? f.cap : n} 人（8 + 2 × 统御）${tags ? '\n' + tags : ''}`,
      kind: (this.formed ? '军阵 · 护阵生效' : this.h.legion.order === 'sortie' ? '军阵 · 出击散阵' : '军阵 · 成阵中') + (this.loadout.length > 1 ? ' · X 变阵' : '') };
  }

  // ———— 出击打法 ————
  private onOrder(o: Order): void {
    if (o !== 'sortie' || !this.current || this.clock < this.settleUntil) return;
    const now = this.clock, L = this.h.legion, P = this.h.player, inForm = L.units.filter(u => u.active && L.formation.inForm.has(u.id));
    this.stats.sortie++;
    const cluster = (r: number): { x: number; y: number } | null => {
      const list = this.h.enemiesNear(P.x, P.y, r).filter(e => e.active && !e.isSupplySlot).slice(0, 40); if (!list.length) return null;
      let best = list[0], bn = -1; for (const e of list.slice(0, 24)) { let n = 0; for (const o2 of list) if (Math.hypot(o2.x - e.x, o2.y - e.y) < 90) n++; if (n > bn) { bn = n; best = e; } }
      return { x: best.x, y: best.y };
    };
    switch (this.current) {
      case 'circle': { const C = FORMATION.circle, R = L.formation.extent + C.pushR;
        for (const e of this.h.enemiesNear(P.x, P.y, R)) { if (!e.active || e.kind === 'boss' || e.controlImmune || e.isSupplySlot || e.def.behavior === 'wall') continue; const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1; e.sprite.x += dx / d * C.push; e.sprite.y += dy / d * C.push; e.martialSlow = Math.min(now >= e.martialSlowUntil ? 1 : e.martialSlow, C.slow); e.martialSlowUntil = Math.max(e.martialSlowUntil, now + C.slowMs); this.stats.pushed++; }
        break; }
      case 'wedge': { const W = FORMATION.wedge; if (now < this.chargeReadyAt) break; this.chargeReadyAt = now + W.chargeCd; const a = L.formation.facing;
        for (const u of inForm) { if (u.kind === 'medic') continue; const ai = u.ai; ai.mode = 'charge'; ai.until = now + W.chargeMs; ai.nextThink = now + W.chargeMs; ai.target = null; ai.x = u.x + Math.cos(a) * W.chargeDist; ai.y = u.y + Math.sin(a) * W.chargeDist; ai.faceX = Math.cos(a); ai.faceY = Math.sin(a); this.charging.set(u, { until: now + W.chargeMs, hits: new Set() }); }
        this.stats.charges++; break; }
      case 'crane': { const c = cluster(420); if (!c) break; const dx = c.x - P.x, dy = c.y - P.y, d = Math.hypot(dx, dy) || 1, px = -dy / d, py = dx / d;
        for (const u of inForm) { if (u.def.ranged || u.kind === 'medic') continue; const l = L.formation.local(u.x, u.y), side = l.x >= 0 ? 1 : -1; u.ai.mode = 'advance'; u.ai.x = c.x + px * side * 70; u.ai.y = c.y + py * side * 70; u.ai.nextThink = now + FORMATION.crane.flankMs; this.stats.flank++; }
        break; }
      case 'geese': { const c = cluster(560); if (!c) break; const G = FORMATION.geese; for (let k = 0; k < G.volleys; k++) this.volleys.push({ at: now + k * G.volleyGapMs, x: c.x, y: c.y }); break; }
      case 'snake': { inForm.forEach((u, i) => { const p = L.formation.position(u), q = { x: p.x + (P.x - p.x) * .6, y: p.y + (P.y - p.y) * .6 }; u.ai.mode = 'advance'; u.ai.x = q.x + (i % 2 ? 24 : -24); u.ai.y = q.y; u.ai.nextThink = now + 900; }); break; }
      case 'bazhen': { const c = cluster(FORMATION.bazhen.r + 80); if (!c) break; for (const u of inForm) { if (u.kind === 'medic') continue; u.ai.mode = 'advance'; u.ai.x = c.x + (Math.random() - .5) * 60; u.ai.y = c.y + (Math.random() - .5) * 60; u.ai.nextThink = now + 900; } break; }
    }
  }

  // ———— 每帧 ————
  update(_dt: number, now: number): void {
    this.clock = now;
    const P = this.h.player, L = this.h.legion, cur = this.current, settled = !!cur && now >= this.settleUntil;
    // 主将加成（出击时也保留）
    P.formationTakenMul = settled && cur === 'circle' ? 1 - FORMATION.circle.heroTaken : 1;
    P.formationSpeedMul = settled && cur === 'wedge' ? 1 + FORMATION.wedge.heroMove : settled && cur === 'snake' ? 1 + FORMATION.snake.heroMove : 1;
    P.passive.formationRangeMul = settled && cur === 'geese' ? 1 + FORMATION.geese.heroRange : 1;
    // 随从
    const fs = this.h.followers(); if (fs) fs.formation = cur ? this.followerHooks : null;
    // 士兵移速
    const formed = this.formed;
    for (const u of L.units) { if (!u.active) continue; const on = formed && L.formation.inForm.has(u.id); u.formSpeed = !on ? 1 : cur === 'circle' ? 1 + FORMATION.circle.speed : cur === 'snake' ? 1 + FORMATION.snake.speed : 1; }
    // 锋矢冲锋：沿途撞开并打一下
    if (this.charging.size) { const W = FORMATION.wedge; for (const [u, c] of this.charging) { if (!u.active || now >= c.until) { this.charging.delete(u); continue; }
      for (const e of this.h.enemiesNear(u.x, u.y, 34)) { if (!e.active || e.isSupplySlot || c.hits.has(e.spawnId)) continue; c.hits.add(e.spawnId); this.h.hit(e, this.allyDmg(u) * W.chargeHit); this.stats.chargeHits++;
        if (e.kind !== 'boss' && !e.controlImmune && e.def.behavior !== 'wall') { const side = (e.x - u.x) * -u.ai.faceY + (e.y - u.y) * u.ai.faceX >= 0 ? 1 : -1; e.sprite.x += -u.ai.faceY * side * W.chargePush; e.sprite.y += u.ai.faceX * side * W.chargePush; } } } }
    // 雁行齐射
    for (let i = this.volleys.length - 1; i >= 0; i--) { const v = this.volleys[i]; if (now < v.at) continue; this.volleys.splice(i, 1); const targets = this.h.enemiesNear(v.x, v.y, FORMATION.geese.volleyR).filter(e => e.active && !e.isSupplySlot); if (!targets.length) continue;
      for (const u of L.units) if (u.active && u.def.ranged && L.formation.inForm.has(u.id)) { const e = targets[Math.floor(Math.random() * targets.length)]; L.volley(u, e, this.allyDmg(u), now + 160); }
      this.stats.volleys++; }
    if (!formed) return;
    // 长蛇绕击
    if (cur === 'snake') { const S = FORMATION.snake, mul = Math.min(2, this.pow().mul);
      for (const u of L.units) { if (!u.active || !L.formation.inForm.has(u.id) || u.kind === 'medic') continue; if (now < (this.grazeAt.get(u.id) ?? 0)) continue;
        const e = this.h.enemiesNear(u.x, u.y, S.grazeR).find(x => x.active && !x.isSupplySlot && !x.invulnerable); if (!e) continue;
        this.grazeAt.set(u.id, now + S.grazeMs); this.h.hit(e, this.allyDmg(u) * S.graze * mul); this.stats.graze++; } }
    // 八阵：阵内减速、困阵
    if (cur === 'bazhen') { const B = FORMATION.bazhen, zone = this.h.enemiesNear(P.x, P.y, B.r).filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss' && Math.hypot(e.x - P.x, e.y - P.y) <= B.r);
      for (const e of zone) { e.martialSlow = Math.min(now >= e.martialSlowUntil ? 1 : e.martialSlow, 1 - B.slow); e.martialSlowUntil = Math.max(e.martialSlowUntil, now + 250); }
      if (now >= this.trapAt && zone.length) { this.trapAt = now + B.trapMs / Math.max(.5, this.pow().mul); const e = zone[Math.floor(Math.random() * zone.length)]; this.h.stun(e, B.stunMs, now); this.stats.trapped++; } }
  }
  /** 士兵一击的基础伤害（同 Legion 的出手公式，不含兵种特例）。 */
  private allyDmg(u: Ally): number { return u.def.damage * (1 + .25 * (u.level - 1)) * this.h.legion.drillMultiplier * this.h.player.growth.allyDamageMultiplier(); }
  clear(): void { this.charging.clear(); this.volleys.length = 0; this.grazeAt.clear(); const P = this.h.player; P.formationTakenMul = 1; P.formationSpeedMul = 1; P.passive.formationRangeMul = 1; }
}
