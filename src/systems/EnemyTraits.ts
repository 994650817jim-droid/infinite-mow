import Phaser from 'phaser';
import { actorDepth, DEPTH } from '../config';
import type { EnemyDef } from '../data/enemies';
import { ROSTER, STAGE_MIX, type RosterType, type TraitDef } from '../data/enemyRoster';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { EnemyKind } from '../types';
import { warnFx } from '../ui/WarnFx';
import { isV2Texture, loadV2TroopSheets, V2_TROOP_SCALE, v2TroopGround } from './ArtStyle';
import { addCount, canAdd, mixSummary, pickRoster, tallyRoster, type MixPick } from './RosterMix';
import { playSheet } from './SkillFxSheets';

/**
 * 各章新兵种的机制（data/enemyRoster；共享笔记 enemy-roster-design.md）。
 * GameScene 每帧对每个敌人先问 step()：返回 true = 本帧移动 / 出招由这里管（重装、治疗、投掷、纵火、毒箭、弓骑），
 * false = 照底层兵种的普通逻辑走（蜂拥、驯兽师、猛兽只是数值和成群）。
 * 刷怪：pick() 按本关 STAGE_ROSTER 的比例把一次普通刷怪换成新兵种，spawnSpecial() 刷出（蜂拥成群、驯兽师带兽）。
 * 只用现成的手绘图：预警圈 / 落下（WarnFx）、地火 / 爆燃 / 尘土序列帧、滚石（蜀道滚石图）、箭矢；兵种专属图由美术风格会话出，键不存在就用底层兵种图染色。
 */
export interface TraitHost {
  scene: Phaser.Scene;
  player: Player;
  enemies: () => readonly Enemy[];
  /** 'huangjin.1' 这样的关卡键（同 stageMaps）。 */
  stageKey: () => string;
  /** 当前第几波（1 起算）。 */
  wave: () => number;
  /** 只在普通难度、正常关卡里出新兵种。 */
  enabled: () => boolean;
  /** 本章该底层兵种的基础定义（含本章外观）。 */
  baseDef: (kind: EnemyKind) => EnemyDef;
  spawn: (kind: EnemyKind, x: number, y: number, def: EnemyDef) => Enemy | null;
  fireArrow: (e: Enemy, tx: number, ty: number, damage: number, speed: number) => void;
  hurtTroops: (x: number, y: number, r: number, damage: number) => void;
  move: (e: Enemy, nx: number, ny: number, dt: number) => void;
  sfx: (key: string) => void;
}

interface St { life: number; next: number; drop: number; slamAt: number; sx: number; sy: number; owner?: Enemy; ownerLife?: number; ang: number }
interface Hazard { id: string; kind: 'stone' | 'fire'; x: number; y: number; r: number; from: number; at: number; end: number; damage: number; allyDamage: number; tick: number; img?: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite }
interface Dart { img: Phaser.GameObjects.Image; x0: number; y0: number; tx: number; ty: number; from: number; at: number; t: Extract<TraitDef, { kind: 'poison' }> }

const STONE_FRAME = 4; // shu_pass 第 5 格：滚石
const MAX_FIRES = 28;

export class EnemyTraits {
  private st = new Map<Enemy, St>();
  private hazards: Hazard[] = [];
  private darts: Dart[] = [];
  private poison: number[] = []; // 每层毒的结束时间
  private poisonTick = 0;
  private poisonDps = 0;
  private seq = 0;
  /** 测试 / 调试用计数。 */
  readonly metrics = { spawned: 0, slams: 0, heals: 0, throws: 0, fires: 0, bursts: 0, darts: 0, poisonTicks: 0, arrows: 0, enraged: 0 };

  constructor(private h: TraitHost) {
    const ids = Object.keys(STAGE_MIX[h.stageKey()]?.traits ?? {}), sc = h.scene;
    for (const id of [...ids]) { const t = ROSTER[id]; if (t?.trait.kind === 'tamer') ids.push(t.trait.beast); }
    // 专属图（美术风格会话登记在 ART_V2_FILES；没登记 / 没到的键 isV2Texture 为 false，自动跳过）
    loadV2TroopSheets(sc, ids.flatMap(id => ROSTER[id] ? [ROSTER[id].art.walk, ROSTER[id].art.attack] : []));
    if (ids.some(id => ROSTER[id]?.trait.kind === 'lobber') && !sc.textures.exists('shu_pass')) sc.load.spritesheet('shu_pass', 'assets/shu/pass.png', { frameWidth: 384, frameHeight: 384 });
    if (sc.load.list.size && !sc.load.isLoading()) sc.load.start();
  }

  // ———— 刷怪 ————
  /** 这次普通刷怪刷什么（data/enemyRoster 的配兵表）：{trait} 新兵种 / {base} 底层兵种 / null 交给本章原有刷怪表。 */
  pick(): MixPick {
    if (!this.h.enabled()) return null;
    return pickRoster(this.h.stageKey(), this.h.wave(), tallyRoster(this.h.enemies()));
  }

  count(id: string): number { let n = 0; for (const e of this.h.enemies()) if (e.active && e.def.roster === id) n += 1; return n; }

  /** 测试面板：在场新兵种占比。 */
  summary(): string { return mixSummary(tallyRoster(this.h.enemies())); }

  /** 在主将外圈刷一个（蜂拥成群）新兵种；返回刷出的第一个。 */
  spawnSpecial(id: string, at?: { x: number; y: number }): Enemy | null {
    const t = ROSTER[id]; if (!t) return null;
    const p = this.h.player, a = Math.random() * Math.PI * 2, d = Math.max(1280, 720) * .5 + Math.random() * 100;
    const cx = at?.x ?? p.x + Math.cos(a) * d, cy = at?.y ?? p.y + Math.sin(a) * d;
    const n = t.group ? Phaser.Math.Between(t.group[0], t.group[1]) : 1;
    let first: Enemy | null = null; const c = tallyRoster(this.h.enemies());
    for (let i = 0; i < n; i += 1) {
      if (!canAdd(id, c)) break;
      const e = this.spawnOne(t, cx + (i ? Phaser.Math.Between(-70, 70) : 0), cy + (i ? Phaser.Math.Between(-70, 70) : 0));
      if (!e) break; first ??= e; addCount(id, c);
    }
    if (first && t.trait.kind === 'tamer') {
      const bt = ROSTER[t.trait.beast];
      if (bt) for (let i = 0; i < t.trait.beasts; i += 1) {
        if (!canAdd(bt.id, c)) break;
        const b = this.spawnOne(bt, first.x + Math.cos(i * 2.1) * 50, first.y + Math.sin(i * 2.1) * 50); if (!b) break; addCount(bt.id, c);
        const s = this.state(b); s.owner = first; s.ownerLife = first.spawnId;
      }
    }
    return first;
  }

  private spawnOne(t: RosterType, x: number, y: number): Enemy | null {
    const sc = this.h.scene, base = this.h.baseDef(t.base), art = isV2Texture(t.art.walk) && sc.textures.exists(t.art.walk), k = art ? 1 : t.fallback.scale;
    const def: EnemyDef = {
      ...base, behavior: undefined, variant: undefined, roster: t.id, trait: t.trait,
      hp: base.hp * t.mul.hp, speed: base.speed * t.mul.speed, damage: base.damage * t.mul.damage,
      xp: Math.max(1, Math.round(base.xp * Math.max(1, Math.sqrt(t.mul.hp)))), radius: base.radius * (art ? Math.max(1, t.art.cell / 144) : k),
      // 专属图：同 ArtStyle.withV2Sheets（v2 4×4 表，显示 ×0.5，脚底 = (格 − 7) / 格）
      ...(art ? { walkVisual: { texture: t.art.walk, scale: V2_TROOP_SCALE, groundY: v2TroopGround(t.art.cell) }, attackVisual: isV2Texture(t.art.attack) && sc.textures.exists(t.art.attack) ? t.art.attack : undefined, tint: 0xffffff }
        : { tint: t.fallback.tint }),
    };
    const e = this.h.spawn(t.base, x, y, def); if (!e) return null;
    if (k !== 1) { e.baseScaleY *= k; e.sprite.setScale(e.sprite.scaleX * k, e.sprite.scaleY * k); }
    e.controlImmune = t.trait.kind === 'heavy';
    if (t.noCharge) e.dashCd = 1e9;
    this.metrics.spawned += 1;
    return e;
  }

  private state(e: Enemy): St {
    let s = this.st.get(e);
    if (!s || s.life !== e.spawnId) { s = { life: e.spawnId, next: 0, drop: 0, slamAt: 0, sx: 0, sy: 0, ang: Math.random() * Math.PI * 2 }; this.st.set(e, s); }
    return s;
  }

  // ———— 每个敌人 ————
  step(e: Enemy, dt: number, now: number, target: { x: number; y: number }): boolean {
    const t = e.def.trait; if (!t) return false;
    const s = this.state(e);
    if (s.next === 0) s.next = now + 600 + Math.random() * 900;
    const dx = target.x - e.x, dy = target.y - e.y, dist = Math.hypot(dx, dy) || 1, nx = dx / dist, ny = dy / dist;
    switch (t.kind) {
      case 'heavy': return this.heavy(e, s, t, dt, now, target, dist, nx, ny);
      case 'healer': return this.healer(e, s, t, dt, now, dist, nx, ny);
      case 'lobber': return this.lobber(e, s, t, dt, now, dist, nx, ny);
      case 'torch': return this.torch(e, s, t, dt, now, nx, ny);
      case 'poison': return this.poisoner(e, s, t, dt, now, dist, nx, ny);
      case 'horsearcher': return this.horseArcher(e, s, t, dt, now, nx, ny, dist);
      default: return false; // swarm / tamer：普通追击
    }
  }

  /** 力士：慢慢逼近，贴近后原地举锤 warnMs、砸地（圈内主将 / 部曲受伤）；不吃击退。 */
  private heavy(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'heavy' }>, dt: number, now: number, target: { x: number; y: number }, dist: number, nx: number, ny: number): boolean {
    e.controlImmune = true;
    if (s.slamAt) {
      e.moveVx = e.moveVy = 0;
      const id = `trait-slam-${e.spawnId}`;
      warnFx(this.h.scene).circle(id, 'slam', s.sx, s.sy, t.slamRadius, 1 - (s.slamAt - now) / t.warnMs, now);
      if (now >= s.slamAt) {
        s.slamAt = 0; this.metrics.slams += 1;
        warnFx(this.h.scene).shapeImpact(id, 'slam', s.sx, s.sy, t.slamRadius, 0, now);
        playSheet(this.h.scene, 'fx_collapse_dust', s.sx, s.sy - 20, { size: t.slamRadius * 2.2, depth: DEPTH.fx, ms: 520, alpha: .85 });
        this.h.scene.cameras.main.shake(140, .004); this.h.sfx('hitHeavy');
        this.hitPlayer(s.sx, s.sy, t.slamRadius, t.damage, now);
        this.h.hurtTroops(s.sx, s.sy, t.slamRadius, t.allyDamage);
      }
      return true;
    }
    if (dist < t.slamRange && now >= s.next) {
      s.next = now + t.everyMs; s.slamAt = now + t.warnMs;
      s.sx = e.x + nx * Math.min(dist, t.slamRange * .6); s.sy = e.y + ny * Math.min(dist, t.slamRange * .6);
      e.poseUntil = Math.max(e.poseUntil, s.slamAt + 160); e.startAttack(now, dirOf(nx, ny));
      e.moveVx = e.moveVy = 0; void target;
      return true;
    }
    this.h.move(e, nx, ny, dt);
    return true;
  }

  /** 符水道徒：躲在离主将 keepAway 外，每 everyMs 给身边友军回血（首领不回）。 */
  private healer(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'healer' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    if (dist < t.keepAway) this.h.move(e, -nx * .9, -ny * .9, dt);
    else if (dist > t.keepAway + 140) this.h.move(e, nx, ny, dt);
    else this.h.move(e, -ny * .35, nx * .35, dt);
    if (now >= s.next) {
      s.next = now + t.everyMs;
      let healed = 0;
      for (const o of this.h.enemies()) {
        if (!o.active || o === e || o.kind === 'boss' || o.isSupplySlot || o.hp >= o.maxHp) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) > t.radius) continue;
        o.hp = Math.min(o.maxHp, o.hp + Math.max(1, Math.round(o.maxHp * t.share))); healed += 1;
        if (!playSheet(this.h.scene, 'fx_heal_fushui', o.x, o.y - 20, { size: 70, depth: actorDepth(o.y) + .05, ms: 600, alpha: .9 })) this.glow(o, 0xb8ffc0, now);
      }
      if (healed) { this.metrics.heals += healed; e.startAttack(now, dirOf(nx, ny)); this.glow(e, 0xfff0a0, now); }
    }
    return true;
  }

  /** 投掷（滚石兵 / 蛮族投石手）：站 range 外，往主将脚下抛石，落点圈预警，范围伤害。 */
  private lobber(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'lobber' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    if (e.poseUntil > now) { e.moveVx = e.moveVy = 0; return true; }
    if (dist > t.range) this.h.move(e, nx, ny, dt);
    else if (dist < t.range * .55) this.h.move(e, -nx * .8, -ny * .8, dt);
    else this.h.move(e, 0, 0, dt);
    if (now >= s.next && dist < t.range + 60) {
      s.next = now + t.everyMs * (.85 + Math.random() * .3); this.metrics.throws += 1;
      const p = this.h.player, tx = p.x + Phaser.Math.Between(-24, 24), ty = p.y + Phaser.Math.Between(-24, 24);
      e.poseUntil = now + 300; e.startAttack(now, dirOf(nx, ny));
      this.hazards.push({ id: `trait-stone-${++this.seq}`, kind: 'stone', x: tx, y: ty, r: t.radius, from: now, at: now + t.warnMs, end: now + t.warnMs, damage: t.damage, allyDamage: t.allyDamage, tick: 0 });
      this.flyStone(e.x, e.y - 30, tx, ty, now + t.warnMs - t.flightMs, t.flightMs);
    }
    return true;
  }

  /** 纵火兵：直冲主将，一路留下燃烧地面；倒下爆燃（onKilled）。 */
  private torch(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'torch' }>, dt: number, now: number, nx: number, ny: number): boolean {
    this.h.move(e, nx, ny, dt);
    if (now >= s.drop) {
      s.drop = now + t.dropEveryMs;
      if (this.hazards.filter(z => z.kind === 'fire').length < MAX_FIRES) this.addFire(e.x, e.y + 4, t.fireRadius, now, t.fireMs, t.fireDamage);
    }
    return true;
  }

  /** 毒箭蛮：站 range 外吹箭（箭飞到出手时主将位置，躲开就不中），中了掉血 + 叠毒。 */
  private poisoner(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'poison' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    if (dist > t.range) this.h.move(e, nx, ny, dt);
    else if (dist < t.range * .55) this.h.move(e, -nx * .8, -ny * .8, dt);
    else this.h.move(e, -ny * .3, nx * .3, dt);
    if (now >= s.next && dist < t.range + 80 && e.attackUntil <= now) {
      s.next = now + t.everyMs * (.85 + Math.random() * .3); this.metrics.darts += 1;
      e.startAttack(now, dirOf(nx, ny)); this.h.sfx('enemyArrow');
      const p = this.h.player, key = this.h.scene.textures.exists('arrow') ? 'arrow' : '';
      if (!key) return true;
      const flight = Math.max(260, Math.hypot(p.x - e.x, p.y - e.y) / .42);
      const img = this.h.scene.add.image(e.x, e.y - 18, key).setDepth(DEPTH.projectile).setScale(.55).setTint(0x9ed27a).setRotation(Math.atan2(p.y - e.y, p.x - e.x));
      this.darts.push({ img, x0: e.x, y0: e.y - 18, tx: p.x, ty: p.y - 10, from: now, at: now + flight, t });
    }
    return true;
  }

  /** 羌胡弓骑：绕主将 orbit 距离转圈，边跑边射，不冲锋。 */
  private horseArcher(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'horsearcher' }>, dt: number, now: number, nx: number, ny: number, dist: number): boolean {
    e.chargeState = 'none'; e.dashCd = 1e9;
    const radial = Phaser.Math.Clamp((dist - t.orbit) / 120, -1, 1), side = s.ang > Math.PI ? 1 : -1;
    const vx = nx * radial + -ny * side * .9, vy = ny * radial + nx * side * .9, l = Math.hypot(vx, vy) || 1;
    this.h.move(e, vx / l, vy / l, dt);
    if (now >= s.next && dist < t.orbit + 220) {
      s.next = now + t.everyMs * (.8 + Math.random() * .4); this.metrics.arrows += 1;
      this.h.sfx('enemyArrow');
      this.h.fireArrow(e, this.h.player.x, this.h.player.y, e.def.damage, t.arrowSpeed);
    }
    return true;
  }

  // ———— 倒下 ————
  /** GameScene.killEnemy 调：纵火兵爆燃、驯兽师倒下猛兽狂暴。 */
  onKilled(e: Enemy): void {
    const t = e.def.trait; if (!t) return;
    const now = this.now();
    if (t.kind === 'torch') {
      this.metrics.bursts += 1;
      playSheet(this.h.scene, 'fx_explosion', e.x, e.y - 16, { size: t.burstRadius * 2, depth: DEPTH.fx, ms: 480 });
      this.h.sfx('hitHeavy');
      this.hitPlayer(e.x, e.y, t.burstRadius, t.burstDamage, now);
      this.h.hurtTroops(e.x, e.y, t.burstRadius, t.burstDamage);
      this.addFire(e.x, e.y, t.fireRadius * 1.3, now, t.fireMs, t.fireDamage);
    } else if (t.kind === 'tamer') {
      for (const o of this.h.enemies()) {
        if (!o.active) continue;
        const s = this.st.get(o); if (!s || s.life !== o.spawnId || s.owner !== e || s.ownerLife !== e.spawnId) continue;
        o.def = { ...o.def, speed: o.def.speed * t.enrage, damage: o.def.damage * 1.2, tint: 0xff9070 };
        o.baseTint = 0xff9070; o.sprite.setTint(0xff9070); s.owner = undefined; this.metrics.enraged += 1;
      }
    }
    this.st.delete(e);
  }

  // ———— 每帧：落石、地火、毒箭、中毒 ————
  update(now: number): void {
    const p = this.h.player, wf = warnFx(this.h.scene);
    for (let i = this.hazards.length - 1; i >= 0; i -= 1) {
      const z = this.hazards[i];
      if (z.kind === 'stone') {
        if (now < z.at) { wf.circle(z.id, 'slam', z.x, z.y, z.r, (now - z.from) / (z.at - z.from), now); continue; }
        wf.shapeImpact(z.id, 'slam', z.x, z.y, z.r, 0, now);
        playSheet(this.h.scene, 'fx_collapse_dust', z.x, z.y - 14, { size: z.r * 2.4, depth: DEPTH.fx, ms: 480, alpha: .85 });
        this.h.sfx('hitHeavy');
        this.hitPlayer(z.x, z.y, z.r, z.damage, now);
        this.h.hurtTroops(z.x, z.y, z.r, z.allyDamage);
        this.hazards.splice(i, 1);
      } else {
        if (now >= z.end) { z.img?.destroy(); this.hazards.splice(i, 1); continue; }
        if (z.img && now > z.end - 400) z.img.setAlpha(Math.max(0, (z.end - now) / 400));
        if (now >= z.tick) { z.tick = now + 500; this.hitPlayer(z.x, z.y, z.r, z.damage, now); this.h.hurtTroops(z.x, z.y, z.r, z.allyDamage); }
      }
    }
    for (let i = this.darts.length - 1; i >= 0; i -= 1) {
      const d = this.darts[i], k = Math.min(1, (now - d.from) / (d.at - d.from));
      d.img.setPosition(d.x0 + (d.tx - d.x0) * k, d.y0 + (d.ty - d.y0) * k);
      if (k < 1) continue;
      d.img.destroy(); this.darts.splice(i, 1);
      if (p.alive && Math.hypot(p.x - d.tx, p.y - 10 - d.ty) < p.radius + 18 && p.takeDamage(d.t.hitDamage, now)) {
        this.poison = this.poison.filter(x => x > now);
        if (this.poison.length >= d.t.maxStacks) this.poison.shift();
        this.poison.push(now + d.t.seconds * 1000); this.poisonDps = d.t.dps;
        if (!this.poisonTick) this.poisonTick = now + 1000;
      }
    }
    if (this.poisonTick && now >= this.poisonTick) {
      this.poison = this.poison.filter(x => x > now - 1);
      if (!this.poison.length || !p.alive) { this.poisonTick = 0; this.poison = []; }
      else {
        this.poisonTick = now + 1000; this.metrics.poisonTicks += 1;
        // 毒不致命：最多掉到 1（真正的威胁是叠毒时被围）
        if (!p.damageImmune) p.hp = Math.max(1, p.hp - this.poisonDps * this.poison.length);
        playSheet(this.h.scene, 'fx_poison_mist', p.x, p.y - 30, { size: 64, depth: DEPTH.fx, ms: 600, alpha: .85 });
      }
    }
  }

  /** 当前叠了几层毒（HUD / 测试）。 */
  poisonStacks(now = this.now()): number { return this.poison.filter(x => x > now).length; }

  clear(): void {
    for (const z of this.hazards) z.img?.destroy();
    for (const d of this.darts) d.img.destroy();
    this.hazards = []; this.darts = []; this.poison = []; this.poisonTick = 0; this.st.clear();
  }

  // ———— 小工具 ————
  private now(): number { return (this.h.scene as unknown as { combatNow?: number }).combatNow ?? this.h.scene.time.now; }

  private hitPlayer(x: number, y: number, r: number, damage: number, now: number): void {
    const p = this.h.player;
    if (p.alive && Math.hypot(p.x - x, p.y - y) <= r + p.radius * .5 && p.takeDamage(damage, now)) this.h.scene.cameras.main.flash(90, 180, 40, 40, false);
  }

  private addFire(x: number, y: number, r: number, now: number, ms: number, damage: number): void {
    this.metrics.fires += 1;
    const sc = this.h.scene, z: Hazard = { id: `trait-fire-${++this.seq}`, kind: 'fire', x, y, r, from: now, at: now, end: now + ms, damage, allyDamage: damage, tick: now + 350 };
    if (sc.textures.exists('ground_fire')) {
      const sp = sc.add.sprite(x, y, 'ground_fire', 0).setOrigin(.5, .85).setDisplaySize(r * 2.2, r * 2.2).setDepth(actorDepth(y) - .05).setName('trait-fire');
      const f = { v: Math.random() * 7 }; sc.tweens.add({ targets: f, v: f.v + 8, duration: 900, repeat: Math.ceil(ms / 900), onUpdate: () => { if (sp.active) sp.setFrame(Math.floor(f.v) % 8); } });
      z.img = sp;
    }
    this.hazards.push(z);
  }

  /** 抛石：蜀道滚石图沿抛物线飞到落点（图没载好就只有落点圈）。 */
  private flyStone(x0: number, y0: number, tx: number, ty: number, startAt: number, ms: number): void {
    const sc = this.h.scene; if (!sc.textures.exists('shu_pass')) return;
    const delay = Math.max(0, startAt - this.now());
    sc.time.delayedCall(delay, () => {
      const img = sc.add.image(x0, y0, 'shu_pass', STONE_FRAME).setDisplaySize(40, 40).setDepth(DEPTH.projectile);
      sc.tweens.addCounter({ from: 0, to: 1, duration: ms, onUpdate: tw => { const k = tw.getValue() ?? 0; img.setPosition(x0 + (tx - x0) * k, y0 + (ty - y0) * k - Math.sin(k * Math.PI) * 140).setRotation(k * 6); }, onComplete: () => img.destroy() });
    });
  }

  /** 临时提示（专属特效图到之前）：短暂染色，之后回到本来的颜色。 */
  private glow(e: Enemy, tint: number, now: number): void {
    e.sprite.setTint(tint); e.flashUntil = now + 220;
  }
}

function dirOf(nx: number, ny: number): 'left' | 'right' | 'up' | 'down' {
  return Math.abs(nx) > Math.abs(ny) ? (nx < 0 ? 'left' : 'right') : ny < 0 ? 'up' : 'down';
}
