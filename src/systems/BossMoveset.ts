import { meleeReach } from '../data/bossReach';
import { BOSS_CHARGE } from '../data/legion';
import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import { DEPTH, HEADING_FONT, actorDepth } from '../config';
import { playSheet } from './SkillFxSheets';
import type { BossMovesetDef, MoveDef, PhaseDef } from '../data/bossMoves';
import { ArcBossV2, type ArcHost } from './ArcBossV2';
import type { BossDebug } from './BossKit';
import { BossMount } from './BossMount';
import { emitBossPhase } from './BossPhase';
import { warnFx } from '../ui/WarnFx';
import { ensureBossCast, ensureBossTheme, playCastFx, playThemeFx, themeOf, themeShake, type BossTheme } from './BossThemeFx';

type Shape = { kind: 'circle'; x: number; y: number; r: number; inner?: number; fx: 'slam' | 'arrows' | 'fire' }
  | { kind: 'lane'; x: number; y: number; angle: number; len: number; width: number }
  | { kind: 'sector'; x: number; y: number; r: number; angle: number; arc: number };
interface Hazard { id: string; shape: Shape; from: number; at: number; dmg: number; hit: boolean; visualOnly?: boolean }

/**
 * 首领招式框架（配置见 data/bossMoves.ts）：招式表 + 起手预警（现成手绘 WarnFx）+ 冷却 + 半血换阶段。
 *  - 两种画面：'arc'（第三章起的 4×8 首领图，按 ThirdBoss 帧位摆姿势）/ 'walk'（第一章首领的 4 方向行走表，动画交给 Enemy 自己）。
 *  - 骑马首领：一阶段 BossMount 画马、骑者上半身；半血发 boss-phase（dismount）→ 坠马、换二阶段步战招式。
 *  - 阶段切换统一走 emitBossPhase（顿帧 / 慢动作由武将会话接这个事件，这里不做）。
 */
/** 'walk' 画面（第一章首领：行走 / 攻击两张 4×4 表）的出招对位：命中后多留 hitLeadMs 收招；冲锋奔跑每 dashStride 像素换一帧。 */
export const MOVESET_WALK = { hitLeadMs: 120, dashStride: 40 } as const;

export class BossMoveset extends ArcBossV2<string> {
  phase: 1 | 2 = 1;
  private cds = new Map<string, number>(); private hazards: Hazard[] = []; private seq = 0; private order = 0;
  private cur: MoveDef | null = null; private dash: { ax: number; ay: number; t0: number; ms: number; hitPlayer: boolean; back: boolean; len: number; fireAt: number; hitTroops: Set<unknown> } | null = null;
  private ride: { a0: number; t0: number; ms: number; dropAt: number; drops: number; cx: number; cy: number; dir: number } | null = null;
  private hideUntil = 0; private flags: { e: Enemy; img: Phaser.GameObjects.Image | null }[] = []; private flagMul = 1;
  private guards: Enemy[] = []; mount?: BossMount;
  /** 双首领关（DualBoss）：伤害 / 招式间隔 / 召兵数量倍数。 */
  dmgMul = 1; gapMul = 1; summonMul = 1; readonly defDamage = true;
  readonly metrics: Record<string, number> = { moves: 0, phase2: 0, dismount: 0, playerHits: 0, troopHits: 0 };
  private moveNames: string[] = [];
  /** 主题特效组（BossThemeFx）：按首领 id 取；没图时退回通用 shapeImpact。 */
  private readonly theme: BossTheme | null;
  private trailAt = 0;
  readonly debug: BossDebug = {
    moves: this.moveNames,
    force: (i, now) => { const m = this.phaseDef.moves[i % this.phaseDef.moves.length]; if (m) { this.cds.set(m.name, 0); this.beat.set(null, 'idle', now, 0); this.dash = null; this.ride = null; this.start(m, now); } },
    phase2: now => { const b = this.h.boss; if (b.hp > b.maxHp * this.def.phaseAt) b.hp = Math.floor(b.maxHp * this.def.phaseAt); this.enterPhase2(now); },
  };
  constructor(h: ArcHost, tex: string, now: number, readonly def: BossMovesetDef, private mode: 'arc' | 'walk' = 'arc') {
    super(h, tex, def.name, now);
    this.theme = themeOf(def.id); ensureBossTheme(h.scene, this.theme); ensureBossCast(h.scene, this.theme);
    this.moveNames.push(...def.p1.moves.map(m => m.name));
    if (def.mount) this.mount = new BossMount(h.scene, h.boss, { ...def.mount, rider: def.mount.rider ?? def.id }, () => this.state === 'warn' || this.state === 'attack');
    this.next = now + 1800;
    h.banner(def.p1.name, def.p1.caption);
  }
  get phaseDef(): PhaseDef { return this.phase === 1 ? this.def.p1 : this.def.p2; }
  get mounted(): boolean { return !!this.mount?.mounted; }
  protected takenMul(): number {
    if (this.kit.now < this.hideUntil) return 0;
    const guardMul = this.phaseDef.guards && this.guards.some(g => g.active) ? this.phaseDef.guards.takenMul : 1;
    return guardMul * (this.flags.some(f => f.e.active) ? this.flagMul : 1);
  }
  get label(): string {
    if (this.state === 'dead') return this.def.name + '败退';
    const b = this.beat, guard = this.phaseDef.guards && this.guards.some(g => g.active) ? ' · 亲卫护体（先打亲卫）' : '', flag = this.flags.some(f => f.e.active) ? ' · 旗在减伤（砍旗）' : '';
    return (b.phase === 'recover' ? '收势 · 反击机会' : this.cur ? this.cur.name : this.phaseDef.name) + guard + flag + (this.mounted ? ' · 马上' : '');
  }
  /** 'walk' 画面：姿势交给 Enemy 的行走 / 攻击表，不改贴图。 */
  protected pose(frame: number, now: number): void { if (this.mode === 'arc') super.pose(frame, now); }

  update(dt: number, now: number): void {
    const b = this.h.boss; if (this.gone || !b.active || this.state === 'dead') return;
    this.kit.update(now); this.gfx.clear();
    this.updateHazards(now);
    this.updateFlags();
    if (this.phase === 1 && b.hp <= b.maxHp * this.def.phaseAt) this.enterPhase2(now);
    this.updateRage(now);
    b.sprite.setAlpha(now < this.hideUntil ? .12 : 1);
    if (this.kit.inShift) { this.pose(25, now); return; }
    if (this.dash) { this.updateDash(dt, now); return; }
    if (this.mode === 'walk' && b.externalWalk) b.externalWalk = false; // 冲锋结束（或被打断）：步态交回通用走路
    if (this.ride) { this.updateRide(now); return; }
    const B = this.beat, p = this.h.player;
    if (B.phase === 'idle') {
      this.state = 'approach'; this.angle = Math.atan2(p.y - b.y, p.x - b.x);
      if (now >= this.hideUntil) this.walk(dt, now, 120, this.phaseDef.speedMul);
      if (now >= this.next) { const m = this.pick(now); if (m) this.start(m, now); }
      return;
    }
    if (B.phase === 'windup') { this.state = 'warn'; this.pose(this.cur?.kind === 'summon' || this.cur?.kind === 'flags' ? 24 : 17, now); this.kit.pose(this.cur?.kind === 'charge' ? 'crouch' : 'cast', B.progress(now)); if (B.done(now)) this.release(now); return; }
    if (B.phase === 'release') { this.state = 'attack'; this.pose([18, 19, 20, 22, 23][Math.min(4, Math.floor(B.age(now) / 120))], now); if (B.done(now)) this.toRecover(now, 650); return; }
    this.pose(23, now); if (B.done(now)) { this.cur = null; this.toIdle(now, this.phaseDef.gapMs * this.gapMul); }
  }

  // ---------- 选招 / 起手 / 出手 ----------
  private pick(now: number): MoveDef | null {
    const ms = this.phaseDef.moves;
    for (let i = 0; i < ms.length; i++) { const m = ms[(this.order + i) % ms.length]; if ((this.cds.get(m.name) ?? 0) <= now) { this.order = (this.order + i + 1) % ms.length; return m; } }
    return null;
  }
  private start(m: MoveDef, now: number, o: { aim?: { x: number; y: number }; warnMul?: number } = {}): void {
    this.cur = m; this.cds.set(m.name, now + m.cd); this.metrics.moves++; this.metrics[m.name] = (this.metrics[m.name] ?? 0) + 1;
    const b = this.h.boss, p = this.h.player, t = o.aim ?? p, a = Math.atan2(t.y - b.y, t.x - b.x); this.angle = a;
    const windup = m.windupMs * (o.warnMul ?? 1);
    this.h.banner(m.name); this.castStart(m, windup);
    this.h.sfx(m.kind === 'summon' || m.kind === 'flags' ? 'bossSummon' : 'chargeWarn');
    const at = now + windup;
    // 'walk' 画面（第一章首领）：攻击图起手时持起手帧，最后 360ms 播 起手 → 挥 → 刺 → 收，刚好在命中（at）时挥到第三帧；冲锋在起冲那一刻收招、接奔跑帧
    if (this.mode === 'walk') { b.startAttack(now, Math.abs(Math.cos(a)) > .7 ? (Math.cos(a) < 0 ? 'left' : 'right') : Math.sin(a) < 0 ? 'up' : 'down'); b.attackUntil = m.kind === 'charge' ? at : at + MOVESET_WALK.hitLeadMs; }
    switch (m.kind) {
      case 'charge': {
        this.add({ kind: 'lane', x: b.x, y: b.y, angle: a, len: m.len, width: m.width }, now, at, 0, true);
        // 两侧并行的骑兵道（虎豹冲阵）：同时冲过，只出预警与伤害
        for (let k = 1; k < (m.lanes ?? 1); k++) { const side = k % 2 ? 1 : -1, off = Math.ceil(k / 2) * (m.width + 26) * side; this.add({ kind: 'lane', x: b.x - Math.sin(a) * off, y: b.y + Math.cos(a) * off, angle: a, len: m.len, width: m.width }, now, at + m.dashMs * .5, m.dmg); }
        break;
      }
      case 'fan': for (let k = 0; k < m.count; k++) { const ang = a + (m.count > 1 ? (k / (m.count - 1) - .5) * m.spread : 0); this.add({ kind: 'lane', x: b.x, y: b.y, angle: ang, len: m.len, width: m.width }, now, at + k * 70, m.dmg); } break;
      case 'sweep': this.add({ kind: 'sector', x: b.x, y: b.y, r: meleeReach(m.r), angle: a, arc: m.arc }, now, at, m.dmg); for (let k = 1; k < (m.times ?? 1); k++) this.add({ kind: 'sector', x: b.x, y: b.y, r: meleeReach(m.r), angle: a + (k % 2 ? .35 : -.35), arc: m.arc }, now, at + k * 320, m.dmg); break;
      case 'rings': m.radii.forEach((r, k) => this.add({ kind: 'circle', x: b.x, y: b.y, r, inner: Math.max(0, r - m.band), fx: 'slam' }, now, at + k * m.gapMs, m.dmg)); break;
      case 'volley': for (let k = 0; k < m.count; k++) { const ang = Math.random() * Math.PI * 2, d = k === 0 ? 0 : 40 + Math.random() * m.spread; this.add({ kind: 'circle', x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d * .7, r: m.r, fx: m.fx }, now, at + k * 90, m.dmg); } break;
      case 'thrust': this.add({ kind: 'lane', x: b.x, y: b.y, angle: a, len: m.len, width: m.width }, now, at, m.dmg); break;
      case 'summon': { const wf = warnFx(this.h.scene), c = m.around === 'player' ? p : b; for (let k = 0; k < this.summonCount(m.count); k += 2) { const ang = k / m.count * Math.PI * 2; wf.ambush(c.x + Math.cos(ang) * m.radius, c.y + Math.sin(ang) * m.radius * .8, 110); } break; }
      default: break;
    }
    this.beat.set(m.name, 'windup', now, windup);
  }
  /** 出招起手特效（BossThemeFx cast）：蓄力光包在首领身上，大招再加脚下法阵；只在首领周围，不盖地面预警。 */
  private castStart(m: MoveDef, windup: number): void {
    if (!this.theme) return;
    const b = this.h.boss, sc = this.h.scene, follow = (): { x: number; y: number } | null => (b.active && !this.gone ? { x: b.x, y: b.y } : null);
    const big = m.kind === 'charge' || m.kind === 'rings' || m.kind === 'thrust' || m.kind === 'ride' || (m.kind === 'volley' && m.fx === 'slam') || (m.kind !== 'summon' && m.kind !== 'flags' && m.dmg >= 1.5);
    playCastFx(sc, this.theme, 'aura', b.x, b.y, 170, { ms: windup, follow });
    if (big) playCastFx(sc, this.theme, 'sigil', b.x, b.y + 4, 150, { ms: windup, follow: () => (follow() ? { x: b.x, y: b.y + 4 } : null) });
  }
  private summonCount(n: number): number { return Math.max(1, Math.ceil(n * this.summonMul)); }
  private release(now: number): void {
    const m = this.cur!, b = this.h.boss, p = this.h.player;
    if (this.theme && m.kind !== 'summon' && m.kind !== 'flags') playCastFx(this.h.scene, this.theme, 'glint', b.x + Math.cos(this.angle) * 44, b.y - 30 + Math.sin(this.angle) * 18, 90);   // 兵器闪光：出手瞬间
    switch (m.kind) {
      case 'charge': playThemeFx(this.h.scene, this.theme, { kind: 'lane', x: b.x, y: b.y, angle: this.angle, len: m.len, width: m.width }, { ms: m.dashMs + 120, alpha: .8 });   // 主题冲击带：冲锋一开始铺在冲锋道上，跟着首领冲过去
        this.dash = { ax: Math.cos(this.angle), ay: Math.sin(this.angle), t0: now, ms: m.dashMs, hitPlayer: false, back: !!m.back, len: m.len, fireAt: now, hitTroops: new Set() }; return;
      case 'ride': { const a0 = Math.atan2(b.y - p.y, b.x - p.x); this.ride = { a0, t0: now, ms: m.ms, dropAt: now, drops: 0, cx: p.x, cy: p.y, dir: Math.random() < .5 ? 1 : -1 }; return; }
      case 'vanish': { playThemeFx(this.h.scene, this.theme, { kind: 'puff', x: b.x, y: b.y, size: 150 }); this.hideUntil = now + m.hideMs; this.beat.set(m.name, 'release', now, m.hideMs); this.h.scene.time.delayedCall(m.hideMs, () => this.reappear(m)); return; }
      case 'summon': for (let k = 0, n = this.summonCount(m.count); k < n; k++) { const c = m.around === 'player' ? p : b, ang = k / n * Math.PI * 2; this.h.spawn(m.troop, c.x + Math.cos(ang) * m.radius, c.y + Math.sin(ang) * m.radius * .8); } break;
      case 'flags': this.plantFlags(m); break;
      default: break;
    }
    this.beat.set(m.name, 'release', now, 600);
  }
  /** 隐身后在主将身侧现身，扇形突刺。 */
  private reappear(m: Extract<MoveDef, { kind: 'vanish' }>): void {
    const b = this.h.boss, p = this.h.player; if (!b.active || this.gone) return;
    const side = Math.random() < .5 ? 1 : -1, a = Math.atan2(p.y - b.y, p.x - b.x) + Math.PI / 2 * side;
    b.sprite.x = p.x + Math.cos(a) * 110; b.sprite.y = p.y + Math.sin(a) * 80; playThemeFx(this.h.scene, this.theme, { kind: 'puff', x: b.sprite.x, y: b.sprite.y, size: 150 });
    const now = this.kit.now, aim = Math.atan2(p.y - b.sprite.y, p.x - b.sprite.x); this.angle = aim;
    this.add({ kind: 'sector', x: b.sprite.x, y: b.sprite.y, r: meleeReach(m.r), angle: aim, arc: m.arc }, now, now + 420, m.dmg);
    this.h.banner('现身突刺', '侧面来袭 · 快闪开');
  }
  private plantFlags(m: Extract<MoveDef, { kind: 'flags' }>): void {
    for (const f of this.flags) { f.img?.destroy(); if (f.e.active) f.e.deactivate(); }
    this.flags = []; this.flagMul = m.takenMul;
    const b = this.h.boss, s = this.h.scene;
    for (let k = 0; k < m.count; k++) {
      const a = k / m.count * Math.PI * 2 - Math.PI / 2, x = b.x + Math.cos(a) * m.radius, y = b.y + Math.sin(a) * m.radius * .8;
      const e = this.spawnProp(x, y, m.hp, 0xffffff); if (!e) continue;
      const img = s.textures.exists('zhuge_banner') ? s.add.image(x, y, 'zhuge_banner').setOrigin(.32, 1).setDisplaySize(48, 74).setTint(0xf2d070).setDepth(actorDepth(y)).setName('boss-flag') : null;
      this.flags.push({ e, img });
    }
    this.h.banner(m.name, '旗在时首领减伤 · 先砍旗');
  }
  private updateFlags(): void { for (const f of this.flags) if (!f.e.active && f.img) { f.img.destroy(); f.img = null; } }

  // ---------- 冲锋 / 绕阵 ----------
  private updateDash(dt: number, now: number): void {
    const d = this.dash!, b = this.h.boss, p = this.h.player, m = this.cur as Extract<MoveDef, { kind: 'charge' }>;
    const sp = d.len / d.ms * 1000; b.sprite.x += d.ax * sp * dt; b.sprite.y += d.ay * sp * dt;
    // 'walk' 画面：冲锋时自己出奔跑帧（按跑过的距离），否则一帧十来像素被通用步态当成击退、整段定格平移
    if (this.mode === 'walk') { b.externalWalk = true; b.attackUntil = 0; b.driveRun(d.ax * sp * dt, d.ay * sp * dt, MOVESET_WALK.dashStride); }
    this.state = 'attack'; this.pose((Math.abs(d.ax) > Math.abs(d.ay) ? (d.ax < 0 ? 1 : 2) : d.ay < 0 ? 3 : 0) * 4 + Math.floor(now / 70) % 4, now);
    if (!d.hitPlayer && p.alive && Math.hypot(p.x - b.x, p.y - b.y) < 44 + p.radius) { d.hitPlayer = true; p.takeDamage(b.def.damage * m.dmg * this.dmgMul, now); this.metrics.playerHits++; }
    // 冲过部曲：每名士兵每次冲锋判定一次（Legion.hurtByCharge：约半管血、按当前时间结算、不吃士兵自身受击间隔；「一次冲锋最多打死 3 个」按冲锋起点算），并往冲锋道两侧推开一点
    for (const u of this.h.army.units) if (u.active && !d.hitTroops.has(u) && Math.hypot(u.x - b.x, u.y - b.y) <= 46 + u.radius) {
      d.hitTroops.add(u);
      if (this.h.army.hurtByCharge(u, now, d.t0)) { this.metrics.troopHits++; if (u.active) { const side = (u.x - b.x) * -d.ay + (u.y - b.y) * d.ax >= 0 ? 1 : -1; u.setPosition(u.x - d.ay * side * BOSS_CHARGE.knock + d.ax * 8, u.y + d.ax * side * BOSS_CHARGE.knock + d.ay * 8); } }
    }
    if (this.theme && now >= this.trailAt) { this.trailAt = now + 90; playThemeFx(this.h.scene, this.theme, { kind: 'puff', x: b.x - d.ax * 26, y: b.y - d.ay * 26 + 4, size: 90 }, { ms: 360, alpha: .75 }); }
    if (m.fire && now >= d.fireAt) { d.fireAt = now + 120; this.add({ kind: 'circle', x: b.x, y: b.y, r: 40, fx: 'fire' }, now, now + 380, m.dmg * .5); }
    if (now - d.t0 >= d.ms) {
      if (d.back) { const a = Math.atan2(p.y - b.y, p.x - b.x); this.angle = a; this.dash = { ...d, ax: Math.cos(a), ay: Math.sin(a), t0: now + 380, back: false, hitPlayer: false, hitTroops: new Set() }; this.add({ kind: 'lane', x: b.x, y: b.y, angle: a, len: d.len, width: m.width }, now, now + 380, 0, true); this.beat.set(m.name, 'windup', now, 380); this.dash = null; this.cur = { ...m, back: false, windupMs: 380 }; this.h.banner('折返再冲'); return; }
      this.dash = null; this.toRecover(now, 700);
    }
  }
  private updateRide(now: number): void {
    const r = this.ride!, b = this.h.boss, m = this.cur as Extract<MoveDef, { kind: 'ride' }>, t = Math.min(1, (now - r.t0) / r.ms), a = r.a0 + r.dir * Math.PI * t;
    const x = r.cx + Math.cos(a) * m.radius, y = r.cy + Math.sin(a) * m.radius * .75; this.angle = a + r.dir * Math.PI / 2;
    const dx = x - b.x; b.sprite.x = x; b.sprite.y = y; this.state = 'attack';
    this.pose((Math.abs(dx) > .5 ? (dx < 0 ? 1 : 2) : 0) * 4 + Math.floor(now / 70) % 4, now);
    if (now >= r.dropAt && r.drops < m.drops) { r.dropAt = now + r.ms / m.drops; r.drops++; const p = this.h.player; this.add({ kind: 'circle', x: p.x + (Math.random() - .5) * 120, y: p.y + (Math.random() - .5) * 90, r: m.r, fx: 'arrows' }, now, now + 1000, m.dmg); }
    if (t >= 1) { this.ride = null; this.toRecover(now, 700); }
  }

  // ---------- 二阶段 ----------
  private enterPhase2(now: number): void {
    if (this.phase === 2) return;
    const dismount = this.mounted;
    playCastFx(this.h.scene, this.theme, 'burst', this.h.boss.x, this.h.boss.y + 6, 300);   // 换阶段爆发
    this.phase = 2; this.phase2 = true; this.metrics.phase2++; if (dismount) this.metrics.dismount++;
    this.dash = null; this.ride = null; this.cur = null; this.hideUntil = 0; this.beat.set(null, 'idle', now, 0); this.next = now + 2200;
    // 一阶段的旗阵随换阶段撤掉（不带进二阶段减伤）；步战首领的狂暴演出里旗帜是倒下的
    if (this.def.rage && !dismount) this.rageShow(now);
    for (const f of this.flags) { f.img?.destroy(); if (f.e.active) f.e.deactivate(); } this.flags = [];
    emitBossPhase(this.h.scene, { boss: this.h.boss, phase: 2, dismount, name: this.def.name, bossId: this.def.id }); // 坐骑在 BossMount 里收到事件后坠马
    this.kit.phaseShift(now, dismount ? '坠马！' + this.def.p2.name : this.def.p2.name, this.def.p2.caption, 0x8a4a2a, .1);
    this.moveNames.length = 0; this.moveNames.push(...this.def.p2.moves.map(m => m.name));
    const g = this.def.p2.guards, b = this.h.boss;
    if (g) for (let k = 0, n = this.summonCount(g.count); k < n; k++) { const a = k / n * Math.PI * 2; const e = this.h.spawn(g.troop, b.x + Math.cos(a) * 90, b.y + Math.sin(a) * 70); if (e) this.guards.push(e); }
  }

  // ---------- 步战首领狂暴（def.rage）：旗倒、大吼、黄色气焰（全部手绘素材：旗帜图、倒塌扬尘、战吼声浪 / 气势） ----------
  private auraAt = 0;
  private rageShow(now: number): void {
    const r = this.def.rage!, s = this.h.scene, b = this.h.boss; this.metrics.rage = (this.metrics.rage ?? 0) + 1;
    const topple = (img: Phaser.GameObjects.Image, dir: number, delay: number): void => {
      img.setName('boss-rage-flag');
      s.tweens.add({ targets: img, angle: dir * 84, y: img.y + 4, duration: 520, delay, ease: 'Quad.easeIn', onComplete: () => {
        playSheet(s, 'fx_collapse_dust', img.x + dir * 34, img.y, { size: 130, ms: 560, depth: actorDepth(img.y) + .1, originY: .8, name: 'boss-rage-dust' });
        s.tweens.add({ targets: img, alpha: 0, delay: 1100, duration: 500, onComplete: () => img.destroy() });
      } });
    };
    this.flags.forEach((f, i) => { if (f.img) { topple(f.img, f.img.x < b.x ? -1 : 1, 120 * i); f.img = null; } });
    // 身后的黄天大旗（一阶段旗都被砍倒了也有旗可倒）
    if (s.textures.exists('zhuge_banner')) topple(s.add.image(b.x + 46, b.y - 2, 'zhuge_banner').setOrigin(.32, 1).setDisplaySize(72, 112).setTint(r.color).setDepth(actorDepth(b.y) - .01), 1, 60);
    // 大吼：战吼声浪 + 身上腾起气势
    this.warcry(0, .45, 320, 640, 16, 'boss-rage-wave', 1);
    this.warcry(1, .75, 170, 340, 13, 'boss-rage-aura', 1);
    const t = s.add.text(b.x, b.y - 150, r.roar, { fontFamily: HEADING_FONT, fontSize: '30px', color: '#ffe08a', stroke: '#2a1206', strokeThickness: 6, resolution: 2 }).setOrigin(.5).setDepth(DEPTH.dmgText + 3).setScale(1.6).setName('boss-rage-roar');
    s.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.Out' });
    s.tweens.add({ targets: t, y: t.y - 30, alpha: 0, delay: 1300, duration: 450, onComplete: () => t.destroy() });
    this.h.sfx('warCry'); s.cameras.main.shake(260, .006);
    this.auraAt = now + 1800;
  }
  /** 手绘战吼图集 warcry_paint（2 行 × 6 帧，256×512；行 0 声浪、行 1 气势），跟着首领走，叠加混合。 */
  private warcry(row: number, oy: number, w: number, h: number, fps: number, name: string, alpha: number): void {
    const s = this.h.scene, b = this.h.boss; if (!s.textures.exists('warcry_paint')) return;
    this.metrics[row === 0 ? 'rageWave' : 'rageAura'] = (this.metrics[row === 0 ? 'rageWave' : 'rageAura'] ?? 0) + 1;
    const sp = s.add.sprite(b.x, b.y + 4, 'warcry_paint', row * 6).setOrigin(.5, oy).setDisplaySize(w, h).setBlendMode(Phaser.BlendModes.ADD).setAlpha(alpha).setDepth(row === 0 ? DEPTH.fx : actorDepth(b.y) + .05).setName(name);
    const st = { t: 0 };
    s.tweens.add({ targets: st, t: 5.99, duration: 6000 / fps, onUpdate: () => { if (!sp.active) return; sp.setFrame(row * 6 + Math.floor(st.t)).setPosition(b.x, b.y + 4); if (row) sp.setDepth(actorDepth(b.y) + .05); }, onComplete: () => sp.destroy() });
  }
  /** 二阶段：身上反复腾起黄色气焰。 */
  private updateRage(now: number): void {
    if (this.phase !== 2 || !this.def.rage || this.mounted || !this.h.boss.active || now < this.auraAt) return;
    this.auraAt = now + 2600; this.warcry(1, .75, 130, 260, 11, 'boss-rage-aura', .5);
  }

  // ---------- 地面预警与结算 ----------
  private add(shape: Shape, now: number, at: number, dmg: number, visualOnly = false): void { this.hazards.push({ id: `bm-${this.def.id}-${++this.seq}`, shape, from: now, at, dmg, hit: false, visualOnly }); }
  private updateHazards(now: number): void {
    const wf = warnFx(this.h.scene), p = this.h.player, b = this.h.boss;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const z = this.hazards[i], s = z.shape, prog = (now - z.from) / Math.max(1, z.at - z.from);
      if (now < z.at) {
        if (s.kind === 'circle') wf.circle(z.id, s.fx, s.x, s.y, s.r, prog, now);
        else if (s.kind === 'lane') wf.lane(z.id, 'charge', s.x, s.y, s.angle, s.len, s.width, prog, now);
        else wf.sector(z.id, s.x, s.y, s.r, s.angle, prog, now);
        continue;
      }
      this.hazards.splice(i, 1);
      if (z.visualOnly) continue;
      const themed = s.kind === 'circle' ? playThemeFx(this.h.scene, this.theme, { kind: 'circle', x: s.x, y: s.y, r: s.r })
        : s.kind === 'lane' ? playThemeFx(this.h.scene, this.theme, { kind: 'lane', x: s.x, y: s.y, angle: s.angle, len: s.len, width: s.width })
        : playThemeFx(this.h.scene, this.theme, { kind: 'sector', x: s.x, y: s.y, r: s.r, angle: s.angle });
      if (!themed) { if (s.kind === 'circle') wf.shapeImpact(z.id, s.fx, s.x, s.y, s.r * 2, 0, now); else if (s.kind === 'lane') wf.shapeImpact(z.id, 'charge', s.x, s.y, s.len, s.angle, now, s.width); else wf.shapeImpact(z.id, 'sweep', s.x, s.y, s.r, s.angle, now); }
      const inside = (x: number, y: number, pad: number): boolean => {
        if (s.kind === 'circle') { const d = Math.hypot(x - s.x, y - s.y); return d <= s.r + pad && d >= (s.inner ?? 0) - pad; }
        if (s.kind === 'lane') { const dx = x - s.x, dy = y - s.y, along = dx * Math.cos(s.angle) + dy * Math.sin(s.angle), across = Math.abs(-dx * Math.sin(s.angle) + dy * Math.cos(s.angle)); return along >= -pad && along <= s.len + pad && across <= s.width / 2 + pad; }
        const d = Math.hypot(x - s.x, y - s.y), da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(y - s.y, x - s.x) - s.angle)); return d <= s.r + pad && da <= s.arc / 2;
      };
      if (p.alive && inside(p.x, p.y, p.radius * .5)) { p.takeDamage(b.def.damage * z.dmg * this.dmgMul, now); this.metrics.playerHits++; if (this.theme) themeShake(this.h.scene, z.dmg >= 1.6); }
      const cx = s.kind === 'lane' ? s.x + Math.cos(s.angle) * s.len / 2 : s.x, cy = s.kind === 'lane' ? s.y + Math.sin(s.angle) * s.len / 2 : s.y;
      this.h.army.hurtArea(cx, cy, s.kind === 'lane' ? s.len / 2 : s.r, b.def.damage * z.dmg * .6 * this.dmgMul, now, s.kind === 'sector' ? s.angle : undefined, s.kind === 'sector' ? s.arc : undefined);
    }
  }

  // ———— 双首领关（DualBoss）接口 ————
  busy(): boolean { return !!this.dash || !!this.ride || this.beat.phase === 'windup' || this.beat.phase === 'release'; }
  holdUntil(at: number): void { if (!this.busy()) this.next = Math.max(this.next, at); }
  forceRecover(now: number, ms: number): void { if (this.state === 'dead' || this.busy()) return; if (this.beat.phase !== 'recover' || this.beat.done(now + ms - 50)) this.toRecover(now, ms); }
  forcePhase2(now: number): void { this.enterPhase2(now); }
  /** 狂怒转场：BossKit 转场（无敌、震屏、横幅、暗红色调）。 */
  enrage(now: number, _ms: number, line: string, caption: string): boolean { this.dash = null; this.ride = null; this.cur = null; this.beat.set(null, 'idle', now, 0); this.kit.phaseShift(now, line, caption, 0x300808, .1); return true; }
  /** 悲愤招：本阶段第一招，伤害 ×mul。 */
  signature(now: number, mul: number): void { const m = this.phaseDef.moves[0]; if (m) this.combo({ ...m, dmg: m.dmg * mul } as MoveDef, now); }
  /** 配合技：立刻起手指定招式（aim 朝向点、warnMul 预警倍数）；不受冷却限制。 */
  combo(m: MoveDef, now: number, o: { aim?: { x: number; y: number }; warnMul?: number } = {}): void { this.dash = null; this.ride = null; this.beat.set(null, 'idle', now, 0); this.start(m, now, o); }
  /** 配合技「枪墙」：一排落点圈，预警后连砸 times 次（每 every 毫秒，合起来就是持续的墙）。 */
  comboWall(name: string, pts: Array<{ x: number; y: number }>, r: number, windupMs: number, dmg: number, times: number, every: number, now: number): void {
    this.dash = null; this.ride = null;
    this.cur = { kind: 'volley', name, windupMs, cd: 0, dmg, count: 0, r, spread: 0, fx: 'slam' } as MoveDef;
    for (let k = 0; k < times; k++) for (const q of pts) this.add({ kind: 'circle', x: q.x, y: q.y, r, fx: 'slam' }, now, now + windupMs + k * every, dmg);
    this.h.banner(name); this.h.sfx('chargeWarn');
    this.beat.set(name, 'windup', now, windupMs);
  }
  defeat(): void { if (this.mode === 'arc') super.defeat(); else { this.state = 'dead'; this.gfx.clear(); this.onDefeat(); } }
  protected onDefeat(): void { this.hazards = []; for (const f of this.flags) f.img?.destroy(); this.flags = []; this.mount?.destroy(); this.mount = undefined; this.h.boss.sprite.setAlpha(1); }
  snapshot() { return { phase: this.phase, mounted: this.mounted, horse: !!this.mount?.hasHorse, state: this.state, cur: this.cur?.name ?? null, hazards: this.hazards.length, flags: this.flags.filter(f => f.e.active).length, guards: this.guards.filter(g => g.active).length, metrics: { ...this.metrics }, label: this.label }; }
  /** 当前打击判定用（DEV / 测试）。 */
  get depthHint(): number { return DEPTH.fx; }
}
