import { ArtEffects } from './ArtEffects';
import Phaser from 'phaser';
import { Ally, type AllyView } from '../entities/Ally';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { LegionTactics, TACTICS } from './LegionTactics';
import { LegionProjectiles } from './LegionProjectiles';
import { SpatialGrid } from './SpatialGrid';
import { LEGION, TROOPS, TROOP_KINDS, type Order, type TroopKind } from '../data/legion';
import { DEPTH } from '../config';
export interface LegionState { food: number; dead: number; recruited: number; levels: Record<TroopKind, number>; soldiers: Array<{ kind: TroopKind; hp: number }> }

export class Legion {
  readonly grid = new SpatialGrid<Ally>(64);
  readonly levels = Object.fromEntries(TROOP_KINDS.map(k => [k, 1])) as Record<TroopKind, number>;
  readonly squads = new Map<TroopKind, Ally[][]>();
  healingMultiplier = 1;
  food: number = LEGION.startingFood; dead = 0; recruited = 0;
  order: Order = 'guard';
  private readonly projectiles: LegionProjectiles;
  private readonly tactics: LegionTactics;
  private readonly heals: Array<{ owner: Ally; life: number; target: Ally; targetLife: number; due: number; amount: number }> = [];
  visibleCount = 0;
  private viewClock = 0; private combatClock = 0; private nextSquadSlot = 0;
  private stopped = false;
  private readonly views: AllyView[] = [];
  private readonly near: Enemy[] = []; private readonly friends: Ally[] = [];
  private readonly effects: Array<{ x: number; y: number; tx: number; ty: number; until: number; heal: boolean; sweep: boolean }> = [];
  private readonly artEffects: ArtEffects;
  private readonly gfx: Phaser.GameObjects.Graphics;
  constructor(private readonly scene: Phaser.Scene, readonly units: Ally[], private readonly player: Player, readonly capacity = 5) {
    this.artEffects=new ArtEffects(scene);
    this.gfx = scene.add.graphics().setDepth(DEPTH.fx);
    this.projectiles = new LegionProjectiles(scene); this.tactics = new LegionTactics(player);
  }
  get count(): number { let n = 0; for (const u of this.units) if (u.active) n++; return n; }
  recover(): void { for (const u of this.units) if (u.active) u.hp = u.maxHp; }
  exportState(): LegionState { return { food: this.food, dead: this.dead, recruited: this.recruited, levels: { ...this.levels }, soldiers: this.units.filter(u => u.active).map(u => ({ kind: u.kind, hp: u.hp })) }; }
  restore(state: LegionState): void {
    this.clear(); Object.assign(this.levels, state.levels);
    for (const soldier of state.soldiers) { this.recruit(soldier.kind, 1, true, true); const u = this.units[this.units.length - 1]; u.hp = Math.min(u.maxHp, soldier.hp); }
    this.food = state.food; this.dead = state.dead; this.recruited = state.recruited; this.rebuildGrid();
  }
  /** Bypass only for restoring existing armies and explicit DEV spawns; free recruitment still obeys capacity. */
  recruit(kind: TroopKind, count = 1, free = false, bypassCapacity = false): boolean {
    if (!TROOPS[kind] || !Number.isSafeInteger(count) || count <= 0) return false;
    if (!bypassCapacity && count > this.capacity - this.count) return false;
    const cost = TROOPS[kind].cost * count; if (!free && this.food < cost) return false;
    if (!free) this.food -= cost;
    for (let i = 0; i < count; i++) {
      const x = this.player.x + (i % 3 - 1) * 26, y = this.player.y + 55 + Math.floor(i / 3) * 26;
      let u = this.units.find(a => !a.active);
      if (u) u.reset(x, y, kind, this.levels[kind], this.nextSquadSlot++);
      else { u = new Ally(this.scene, x, y, kind, this.nextSquadSlot++); u.train(this.levels[kind]); this.units.push(u); }
      this.recruited++;
    }
    this.regroup(); this.viewClock = 1; this.rebuildGrid(); return true;
  }
  train(kind: TroopKind, free = false): boolean {
    const level = this.levels[kind]; if (!level || level >= 3) return false;
    const cost = LEGION.trainCost[level]; if (!free && this.food < cost) return false;
    if (!free) this.food -= cost; this.levels[kind]++;
    for (const u of this.units) if (u.active && u.kind === kind) u.train(this.levels[kind]);
    return true;
  }
  cycleOrder(): void { this.order = this.order === 'guard' ? 'sortie' : 'guard'; for (const u of this.units) u.ai.nextThink = 0; }
  private regroup(): void {
    this.squads.clear();
    for (const k of TROOP_KINDS) {
      const members = this.units.filter(u => u.active && u.kind === k), groups: Ally[][] = [];
      for (let i = 0; i < members.length; i += LEGION.squadSize) groups.push(members.slice(i, i + LEGION.squadSize));
      this.squads.set(k, groups);
    }
    let slot = 0;
    // Ranged and healers occupy later, rearward slots in line formations.
    for (const k of ['guardian', 'swordsman', 'spearman', 'halberdier', 'rider', 'archer', 'crossbowman', 'medic'] as TroopKind[]) for (const squad of this.squads.get(k) ?? []) for (const u of squad) u.slot = slot++;
  }
  position(slot: number, count = this.count): { x: number; y: number } {
    const columns = Math.max(3, Math.min(9, Math.ceil(Math.sqrt(count))));
    return { x: (slot % columns - (columns - 1) / 2) * 32, y: 45 + Math.floor(slot / columns) * 34 };
  }
  rebuildGrid(): void { this.grid.clear(); for (const u of this.units) if (u.active) this.grid.insert(u); }
  hurt(u: Ally, raw: number, now: number, source?: { x: number; y: number; normal: boolean }): boolean {
    if (!u.active || now < u.hurtUntil) return false;
    const armor = u.def.armor + (u.kind === 'guardian' && u.level === 3 ? 5 : 0);
    let mitigation = 1;
    if (source?.normal) {
      const dx = source.x - u.x, dy = source.y - u.y, d = Math.hypot(dx, dy) || 1;
      const frontal = (dx * u.facingX + dy * u.facingY) / d >= .25;
      if (frontal && u.kind === 'guardian') { mitigation = .55; u.ai.blockUntil = now + 180; }
      if (frontal && u.kind === 'swordsman' && now >= u.ai.blockReady) { mitigation = .5; u.ai.blockReady = now + TACTICS.blockMs; u.ai.blockUntil = now + 180; }
    }
    u.hp = Math.max(0, u.hp - Math.max(1, Math.round(Math.max(1, raw - armor) * mitigation)));
    u.hurtUntil = now + 350;
    if (!u.hp) {
      u.active = false; this.dead++; u.deathsReported = true; const v = u.release(); if (v) this.views.push(v); this.regroup();
     
    }
    return true;
  }
  hurtArea(x: number, y: number, radius: number, damage: number, now: number, angle?: number, arc = Math.PI * 2): void {
    for (const u of this.grid.query(x, y, radius + 20, this.friends)) if (u.active && Math.hypot(u.x - x, u.y - y) <= radius + u.radius && (angle === undefined || Math.cos(Math.atan2(u.y - y, u.x - x) - angle) >= Math.cos(arc / 2))) this.hurt(u, damage, now);
  }
  onKill(enemy: Enemy): void { this.food += enemy.kind === 'boss' ? 20 : enemy.kind === 'elite' ? 5 : 1; }
  stop(): void { this.stopped = true; this.player.armyDamageTakenMul = 1; this.effects.length = 0; this.artEffects.clear(); this.heals.length = 0; this.projectiles.clear(); this.gfx.clear(); }
  clear(): void { this.projectiles.clear(); this.heals.length = 0; for (const u of this.units) { const v = u.release(); if (v) this.views.push(v); } this.units.length = 0; this.squads.clear(); this.grid.clear(); }
  update(dt: number, now: number, enemies: Enemy[], enemyGrid: SpatialGrid<Enemy>, damage: (e: Enemy, n: number) => void): void {
    if (this.stopped) return;
    this.projectiles.update(dt, now, enemyGrid, damage);
    if (this.stopped) return;
    for (let i = this.heals.length - 1; i >= 0; i--) {
      const h = this.heals[i]; if (now < h.due) continue;
      this.heals.splice(i, 1);
      if (h.owner.active && h.owner.lifeId === h.life && h.target.active && h.target.lifeId === h.targetLife && Math.hypot(h.owner.x - h.target.x, h.owner.y - h.target.y) <= h.owner.def.range) { h.target.hp = Math.min(h.target.maxHp, h.target.hp + h.amount); this.fx(h.owner, h.target.x, h.target.y, now, true); }
    }
    this.viewClock += dt; this.combatClock += dt;
    const stats = { range: 1, melee: 1, attackSpeed: 1 };
    for (const u of this.units) {
      if (!u.active) continue;
      u.beginStep();
      u.simDebt += dt; const nearPlayer = Math.hypot(u.x - this.player.x, u.y - this.player.y) < 900;
      if (!nearPlayer && u.simDebt < LEGION.farStep) continue;
      const step = nearPlayer ? dt : u.simDebt; u.simDebt = 0;
      this.tactics.think(u, now, this.order, enemyGrid, this.grid);
      this.tactics.move(u, step, now, this.grid);
      u.cooldown = Math.max(0, u.cooldown - step);
    }
    this.rebuildGrid();
    if (this.combatClock >= LEGION.nearStep) {
      this.combatClock = 0;
      for (const u of this.units) {
        if (!u.active || u.cooldown > 0 || u.kind === 'rider' && u.ai.mode === 'return') continue;
        const range = u.def.range * (u.def.ranged ? stats.range : u.kind === 'halberdier' && u.level === 3 ? 1.25 : 1);
        if (u.kind === 'medic') {
          const wounded = this.grid.query(u.x, u.y, range, this.friends).filter(a => a.active && a.hp < a.maxHp && Math.hypot(a.x - u.x, a.y - u.y) <= range).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
          for (const friend of wounded.slice(0, u.level === 3 ? 3 : 1)) { u.act(friend.x, friend.y, now, 480); this.heals.push({ owner: u, life: u.lifeId, target: friend, targetLife: friend.lifeId, amount: u.def.damage * (1 + .35 * (u.level - 1)) * this.healingMultiplier, due: now + 240 }); }
          if (wounded.length) u.cooldown = u.def.cooldown * (1 - .1 * (u.level - 1)) / stats.attackSpeed;
          continue;
        }
        const defensive = !this.tactics.canAttack(u);
        const seekRange = defensive && !u.def.ranged ? Math.min(range, 55) : range;
        const target = this.tactics.select(u, enemyGrid, seekRange, defensive ? Infinity : this.order === 'guard' ? TACTICS.guardLeash : TACTICS.sortieLeash);
        if (!target) continue;
        const candidates = enemyGrid.query(u.x, u.y, seekRange, this.near).filter(e => e.active && !e.invulnerable && Math.hypot(e.x - u.x, e.y - u.y) <= seekRange);
        candidates.sort((a, b) => a === target ? -1 : b === target ? 1 : (a.x - u.x) ** 2 + (a.y - u.y) ** 2 - (b.x - u.x) ** 2 - (b.y - u.y) ** 2);
        const hits = u.kind === 'halberdier' ? candidates.filter(e => Math.hypot(e.x - candidates[0].x, e.y - candidates[0].y) < 75) : candidates.slice(0, u.level === 3 && ['swordsman', 'archer'].includes(u.kind) ? 2 : u.kind === 'rider' && u.level === 3 ? 3 : 1);
        u.cooldown = u.def.cooldown / stats.attackSpeed; u.act(candidates[0].x, candidates[0].y, now, u.kind === 'crossbowman' ? 420 : u.def.ranged ? 340 : 300);
        for (const e of hits) {
          if (u.kind === 'rider' && u.ai.mode === 'charge') {
            if (u.ai.chargeHits.has(e.spawnId) || u.ai.chargeHits.size >= (u.level === 3 ? 3 : 1)) continue;
            u.ai.chargeHits.add(e.spawnId);
          }
          const amount = u.def.damage * (1 + .25 * (u.level - 1)) * (u.def.ranged ? 1 : stats.melee) * (u.kind === 'spearman' && e.kind === 'cavalry' && u.level === 3 ? 2 : 1);
          if (u.def.ranged) { if (u.kind === 'crossbowman') { const total = Math.max(1, Math.round(amount)), first = u.level === 3 ? total : Math.ceil(total / 2), second = u.level === 3 ? total : Math.floor(total / 2); this.projectiles.fire(u, e, first, now + 180); if (second) this.projectiles.fire(u, e, second, now + 260); } else this.projectiles.fire(u, e, amount, now + 180); }
          else { this.fx(u, e.x, e.y, now, false); damage(e, amount); }
          if (this.stopped) return;
        }
      }
      for (const e of enemies) if (e.active && e.def.behavior!=='wall' && !e.isSupplySlot && !e.invulnerable && (e.controlImmune || now >= e.stunUntil) && e.contactCd <= 0) {
        const victims = this.grid.query(e.x, e.y, e.radius + 22, this.friends);
        for (const u of victims) if (u.active && Math.hypot(u.x - e.x, u.y - e.y) < u.radius + e.radius + 2) { this.hurt(u, e.def.damage, now, { x: e.x, y: e.y, normal: e.kind !== 'boss' }); e.contactCd = 1; if (e.kind !== 'boss' && e.kind !== 'cavalry') e.startAttack(now, Math.abs(u.x - e.x) > Math.abs(u.y - e.y) ? u.x < e.x ? 'left' : 'right' : u.y < e.y ? 'up' : 'down'); break; }
      }
    }
   
    if (this.viewClock >= .25) { this.viewClock = 0; this.selectViews(); }
    this.artEffects.update(now);
    this.gfx.clear();
    for (const u of this.units) if (u.active && u.view) {
      u.render(now);
      u.view.label.setVisible(false);
      if (now < u.ai.blockUntil) {
        const x=u.x+u.facingX*16,y=u.y+u.facingY*16-9;
        this.gfx.lineStyle(2,0xe1d5a7,.85).lineBetween(x-6,y-5,x-10,y-9).lineBetween(x+6,y-5,x+10,y-9);
        this.gfx.fillStyle(0xffedc0,.9).fillRect(x-2,y-6,4,3);
      }
      if (u.ai.mode === 'retreat') this.gfx.lineStyle(1, 0x8fd1b3, .55).lineBetween(u.x - 5, u.y + 17, u.x + 5, u.y + 17);
      if (u.ai.mode === 'charge') for(let trail=0;trail<3;trail++) {
        const offset=(trail-1)*6,dx=-u.ai.faceY*offset,dy=u.ai.faceX*offset;
        this.gfx.lineStyle(trail===1?3:1,0xd8c79c,trail===1?.35:.2)
          .lineBetween(u.x+dx-u.ai.faceX*(24+trail*4),u.y+dy-u.ai.faceY*(24+trail*4),u.x+dx-u.ai.faceX*5,u.y+dy-u.ai.faceY*5);
      }

    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]; if (now >= e.until) { this.effects.splice(i, 1); continue; }
      const fade = (e.until-now)/160;
      if (e.heal) {
        this.gfx.lineStyle(2,0x91cda7,fade).lineBetween(e.tx-4,e.ty-18,e.tx+4,e.ty-18).lineBetween(e.tx,e.ty-22,e.tx,e.ty-14);
        this.gfx.fillStyle(0xc8efbd,fade).fillRect(e.tx-10,e.ty-23-(1-fade)*7,2,2).fillRect(e.tx+8,e.ty-12-(1-fade)*8,2,2);
      } else {
        this.gfx.lineStyle(2,0xe6d1a4,fade).lineBetween(e.x,e.y,e.tx,e.ty);
        this.gfx.fillStyle(0xffedc2,fade).fillRect(e.tx-2,e.ty-6,4,4);
        if (e.sweep) {
          const angle=Math.atan2(e.ty-e.y,e.tx-e.x),radius=Math.min(100,Math.hypot(e.tx-e.x,e.ty-e.y));
          this.gfx.lineStyle(3,0xc4dbbf,fade*.6).beginPath().arc(e.x,e.y,radius,angle-.4,angle+.4,false).strokePath();
        }
      }
    }
  }
  private fx(u: Ally, x: number, y: number, now: number, heal: boolean): void { if(heal)this.artEffects.show(5,x,y-10,38,now,260); else if(u.kind==='rider')this.artEffects.show(6,x,y,44,now,180); else if(u.kind==='halberdier')this.artEffects.show(1,u.x,u.y,65,now,140,Math.atan2(y-u.y,x-u.x)); if (this.effects.length < 48 && u.view) this.effects.push({ x: u.x, y: u.y, tx: x, ty: y, until: now + 160, heal, sweep: u.kind === 'halberdier' }); }
  private selectViews(): void {
    const active = this.units.filter(u => u.active).sort((a, b) => Math.hypot(a.x - this.player.x, a.y - this.player.y) - Math.hypot(b.x - this.player.x, b.y - this.player.y));
    const show = new Set(active.slice(0, LEGION.visualBudget).map(u => u.id));
    for (const u of this.units) if (u.view && (!u.active || !show.has(u.id))) { const v = u.release(); if (v) this.views.push(v); }
    for (const u of active.slice(0, LEGION.visualBudget)) if (!u.view) u.attach(this.views.pop() ?? Ally.makeView(this.scene));
    this.visibleCount = Math.min(active.length, LEGION.visualBudget);
  }
}
