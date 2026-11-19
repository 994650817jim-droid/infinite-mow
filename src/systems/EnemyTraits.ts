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
  /** 第二批：是否在水里 / 附近找一处水面（水卒、火船从江面出）/ 加军粮（截住运粮卒）/ 远处的去处（运粮卒往那跑）。 */
  inWater?: (x: number, y: number) => boolean;
  waterPoint?: (x: number, y: number) => { x: number; y: number } | null;
  gainFood?: (n: number) => void;
  farPoint?: (x: number, y: number) => { x: number; y: number } | null;
  /** 当前首领（虎卫护主）。 */
  boss?: () => Enemy | null;
}

interface St { life: number; next: number; drop: number; slamAt: number; sx: number; sy: number; owner?: Enemy; ownerLife?: number; ang: number;
  /** 第二批：朝向（盾墙 / 举盾）、两态 / 预警 / 腾空、伏兵是否还藏着、目标点、出生时间、跟随的布景（火船）、冲刺到何时、腾空起点 */
  disguised?: boolean; face?: number; phase?: 'up' | 'down' | 'move' | 'warn' | 'air' | 'roll'; until?: number; shots?: number; hidden?: boolean; tx?: number; ty?: number; born?: number; imgs?: Phaser.GameObjects.Components.Transform[]; dashUntil?: number; air?: { x0: number; y0: number; from: number }; boom?: boolean }
interface Hazard { look?: 'slam' | 'arrows'; fire?: { ms: number; r: number; dmg: number }; id: string; kind: 'stone' | 'fire'; x: number; y: number; r: number; from: number; at: number; end: number; damage: number; allyDamage: number; tick: number; img?: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite }
interface Dart { img: Phaser.GameObjects.Image; x0: number; y0: number; tx: number; ty: number; from: number; at: number; dmg: number; hit: (now: number) => void }

const STONE_FRAME = 4; // shu_pass 第 5 格：滚石
const MAX_FIRES = 28;
/** 攻击表 4 帧 = 起手 / 出击 / 收招 / 复位（Enemy.updateAttackVisual 每 90ms 一帧）：弓骑第 2 帧放箭、投石第 3 帧出手。 */
const ARROW_MS = 110, RELEASE_MS = 180;
/** 地形层水里的减速（TERRAIN.waterMul）：水卒 / 火船按它抵掉减速。 */
const WATER_MUL = .6;

export class EnemyTraits {
  private st = new Map<Enemy, St>();
  private hazards: Hazard[] = [];
  private darts: Dart[] = [];
  private poison: number[] = []; // 每层毒的结束时间
  private poisonTick = 0;
  private poisonDps = 0;
  private seq = 0;
  /** 测试 / 调试用计数。 */
  readonly metrics = { spawned: 0, slams: 0, heals: 0, throws: 0, fires: 0, bursts: 0, darts: 0, poisonTicks: 0, arrows: 0, enraged: 0,
    fromWater: 0, nets: 0, snared: 0, auraPulses: 0, volleyZones: 0, rolls: 0, firepots: 0, bursts3: 0, guarded: 0, fireArrows: 0, reveals: 0, blocked: 0, bashes: 0, javelins: 0, sweeps: 0, volleys: 0, delivered: 0, intercepted: 0, shipBooms: 0, thrusts: 0, leaps: 0, snipes: 0 };

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
    // 伏兵刷在主将附近的暗处（380～640），水卒 / 火船从附近水面出；其余在主将外圈
    let c0: { x: number; y: number } | null = at ?? null;
    if (!c0 && t.hide) { const a2 = Math.random() * Math.PI * 2, d2 = 380 + Math.random() * 260; c0 = { x: p.x + Math.cos(a2) * d2, y: p.y + Math.sin(a2) * d2 }; }
    // 水面在场地外（如 5-2 江面是北边界）时，刷兵会被挪到岸边——等于「从江里上岸」
    if (!c0 && t.from === 'north') c0 = { x: p.x + (Math.random() - .5) * 700, y: p.y - 760 - Math.random() * 120 }; // 山地轻骑从北面高处冲下
    if (!c0 && (t.trait.kind === 'amphibious' || t.trait.kind === 'fireship')) { c0 = this.h.waterPoint?.(p.x, p.y) ?? null; if (c0) this.metrics.fromWater += 1; }
    const cx = c0?.x ?? p.x + Math.cos(a) * d, cy = c0?.y ?? p.y + Math.sin(a) * d;
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
      xp: Math.max(1, Math.round(base.xp * Math.max(1, Math.sqrt(t.mul.hp)) * (t.xpMul ?? 1))), radius: base.radius * (art ? Math.max(1, t.art.cell / 144) : k),
      // 专属图：同 ArtStyle.withV2Sheets（v2 4×4 表，显示 ×0.5，脚底 = (格 − 7) / 格）
      ...(art ? { walkVisual: { texture: t.art.walk, scale: V2_TROOP_SCALE, groundY: v2TroopGround(t.art.cell) }, attackVisual: isV2Texture(t.art.attack) && sc.textures.exists(t.art.attack) ? t.art.attack : undefined, tint: 0xffffff }
        : { tint: t.fallback.tint }),
    };
    const e = this.h.spawn(t.base, x, y, def); if (!e) return null;
    if (k !== 1) { e.baseScaleY *= k; e.sprite.setScale(e.sprite.scaleX * k, e.sprite.scaleY * k); }
    e.controlImmune = t.trait.kind === 'heavy' || t.trait.kind === 'shieldwall' || t.trait.kind === 'sweeper' || t.trait.kind === 'fireship';
    if (t.noCharge) e.dashCd = 1e9;
    const s = this.state(e); s.born = this.now();
    // 伏兵：半透明、刀枪不入（自动索敌跳过 invulnerable）、不动，等主将走近
    if (t.hide) { s.hidden = true; e.invulnerable = true; if (t.hide.disguise) { s.disguised = true; if (!art) e.sprite.setTint(0xf4efe4); /* 专属图的行走表就是白衣伪装形态，不再染白 */ } else e.sprite.setAlpha(.16); }
    // 火船没有专属图时：本体隐去，用辎重车 + 地火序列帧当一条着火的船（图到了换成 enemy_huochuan_walk）
    if (t.trait.kind === 'fireship' && !art) this.fireshipLook(e, s);
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
    if (s.hidden) return this.lurk(e, s, now, target);
    const dx = target.x - e.x, dy = target.y - e.y, dist = Math.hypot(dx, dy) || 1, nx = dx / dist, ny = dy / dist;
    switch (t.kind) {
      case 'heavy': return this.heavy(e, s, t, dt, now, target, dist, nx, ny);
      case 'healer': return this.healer(e, s, t, dt, now, dist, nx, ny);
      case 'lobber': return this.lobber(e, s, t, dt, now, dist, nx, ny);
      case 'torch': return this.torch(e, s, t, dt, now, nx, ny);
      case 'poison': return this.poisoner(e, s, t, dt, now, dist, nx, ny);
      case 'horsearcher': return this.horseArcher(e, s, t, dt, now, nx, ny, dist);
      case 'ambusher': if (s.dashUntil && now < s.dashUntil) { this.h.move(e, nx * t.dash, ny * t.dash, dt); return true; } return false; // 冲刺完照常追
      case 'shieldwall': return this.shieldwall(e, s, t, dt, now, dist, nx, ny);
      case 'javelin': return this.javelin(e, s, t, dt, now, dist, nx, ny);
      case 'sweeper': return this.sweeper(e, s, t, dt, now, dist, nx, ny);
      case 'stance': return this.stance(e, s, t, dt, now, dist, nx, ny);
      case 'courier': return this.courier(e, s, t, dt, now);
      case 'amphibious': { const w = this.h.inWater?.(e.x, e.y) ? t.waterSpeed / WATER_MUL : 1; this.h.move(e, nx * w, ny * w, dt); return true; }
      case 'fireship': return this.fireship(e, s, t, dt, now, dist, nx, ny);
      case 'lancer': return this.lancer(e, s, t, dt, now, dist, nx, ny);
      case 'leaper': return this.leaper(e, s, t, dt, now, dist, nx, ny);
      case 'sniper': return this.sniper(e, s, t, dt, now, dist, nx, ny);
      case 'net': return this.net(e, s, t, dt, now, dist, nx, ny);
      case 'aura': return this.aura(e, s, t, dt, now, dist, nx, ny);
      case 'volley': return this.volleyStep(e, s, t, dt, now, dist, nx, ny);
      case 'roller': return this.roller(e, s, t, dt, now, dist, nx, ny);
      case 'firepot': return this.firepot(e, s, t, dt, now, dist, nx, ny);
      case 'burst': return this.burstStep(e, s, t, dt, now, dist, nx, ny);
      case 'guard': return this.guard(e, s, t, dt, now, dist, nx, ny);
      case 'firearrow': return this.firearrow(e, s, t, dt, now, dist, nx, ny);
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
      // 攻击表 4 帧 = 起手 / 出击 / 收招 / 复位（力士第 2～3 帧锤砸地）：预警期间停在起手帧，砸下那一刻正好播到第 3 帧（Enemy.updateAttackVisual：最后 360ms 每 90ms 一帧）
      e.poseUntil = Math.max(e.poseUntil, s.slamAt + 180); e.startAttack(now, dirOf(nx, ny)); e.windupCol = 0; e.attackUntil = s.slamAt + 180;
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
      // 攻击表：第 2 帧举石过顶（石头画在图里），第 3 帧出手——飞行石从出手那一刻（+RELEASE_MS）才飞
      e.poseUntil = now + 360; e.startAttack(now, dirOf(nx, ny)); this.h.sfx('mn_lob');
      this.hazards.push({ id: `trait-stone-${++this.seq}`, kind: 'stone', x: tx, y: ty, r: t.radius, from: now, at: now + t.warnMs, end: now + t.warnMs, damage: t.damage, allyDamage: t.allyDamage, tick: 0 });
      this.flyStone(e.x, e.y - 40, tx, ty, now + RELEASE_MS, Math.max(400, t.warnMs - RELEASE_MS));
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
      this.darts.push({ img, x0: e.x, y0: e.y - 18, tx: p.x, ty: p.y - 10, from: now, at: now + flight, dmg: t.hitDamage, hit: n => this.addPoison(t, n) });
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
      // 马上张弓：第 2 帧满弓放箭——箭在那一帧射出（攻击动画最后 360ms 每 90ms 一帧）
      e.startAttack(now, dirOf(nx, ny)); const life = e.spawnId;
      this.h.scene.time.delayedCall(ARROW_MS, () => { if (e.active && e.spawnId === life) this.h.fireArrow(e, this.h.player.x, this.h.player.y, e.def.damage, t.arrowSpeed); });
    }
    return true;
  }

  // ———— 第二批 ————
  /** 伏兵：藏着不动；主将走进 reveal → 伏兵旗影预警、现身（夜袭兵点一把火、猛冲）。 */
  private lurk(e: Enemy, s: St, now: number, target: { x: number; y: number }): boolean {
    e.moveVx = e.moveVy = 0;
    const t = ROSTER[e.def.roster ?? '']; const reveal = t?.hide?.reveal ?? 260;
    if (Math.hypot(this.h.player.x - e.x, this.h.player.y - e.y) > reveal) return true;
    s.hidden = false; e.invulnerable = false; e.sprite.setAlpha(1); this.metrics.reveals += 1;
    if (s.disguised) { s.disguised = false; e.sprite.setTint(e.baseTint); if (e.def.attackVisual) e.startAttack(now, dirOf(this.h.player.x - e.x, this.h.player.y - e.y)); } // 露刀：播攻击表（抽刀、脱白衣）
    warnFx(this.h.scene).ambush(e.x, e.y, 70); this.h.sfx('bossSummon');
    const tr = e.def.trait;
    if (tr?.kind === 'ambusher') { s.dashUntil = now + tr.dashMs; this.addFire(e.x, e.y + 4, 46, now, tr.fireMs, 4); }
    void target; return true;
  }
  /** 正面角度差（弧度）：朝向 face 与指向主将的方向。 */
  private frontDiff(e: Enemy, face: number): number { const a = Math.atan2(this.h.player.y - e.y, this.h.player.x - e.x); return Math.abs(Phaser.Math.Angle.Wrap(a - face)); }
  /** 受伤倍率（GameScene.hitEnemy 调）：盾墙 / 举盾时正面 ±60° 减伤。 */
  damageTakenMul(e: Enemy): number {
    const t = e.def.trait; if (!t) return 1;
    const s = this.st.get(e); if (!s || s.life !== e.spawnId) return 1;
    if (t.kind === 'shieldwall' && s.face !== undefined && this.frontDiff(e, s.face) < Math.PI / 3) { this.metrics.blocked += 1; return 1 - t.front; }
    if (t.kind === 'stance' && s.phase === 'up' && s.face !== undefined && this.frontDiff(e, s.face) < Math.PI / 3) { this.metrics.blocked += 1; return 1 - t.front; }
    if (t.kind === 'guard') { const b = this.h.boss?.(); if (b?.active && Math.hypot(b.x - e.x, b.y - e.y) <= t.radius) { this.metrics.guarded += 1; return t.mul; } }
    return 1;
  }
  /** 陷阵营：慢慢转身对准主将（绕到侧后就破防），顺着朝向推进；贴近盾击。 */
  private shieldwall(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'shieldwall' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    const want = Math.atan2(ny, nx); s.face ??= want;
    s.face = Phaser.Math.Angle.RotateTo(s.face, want, Phaser.Math.DegToRad(t.turnDeg) * dt);
    const fx = Math.cos(s.face), fy = Math.sin(s.face), along = Math.max(0, fx * nx + fy * ny);
    this.h.move(e, fx * along, fy * along, dt);
    if (dist < t.bashRange && now >= s.next) { s.next = now + t.everyMs; this.metrics.bashes += 1; e.startAttack(now, dirOf(fx, fy)); const life = e.spawnId; this.h.scene.time.delayedCall(ARROW_MS, () => { if (e.active && e.spawnId === life) this.hitPlayer(e.x + Math.cos(s.face ?? 0) * 40, e.y + Math.sin(s.face ?? 0) * 40, t.bashRange * .7, t.bashDamage, this.now()); }); } // 盾击在出击帧（第 2 帧）打到
    return true;
  }
  /** 丹阳兵：保持距离掷标枪，被贴近就后撤。 */
  private javelin(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'javelin' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    if (dist > t.range) this.h.move(e, nx, ny, dt); else if (dist < t.range * .5) this.h.move(e, -nx, -ny, dt); else this.h.move(e, -ny * .4, nx * .4, dt);
    if (now >= s.next && dist < t.range + 80 && e.attackUntil <= now) {
      s.next = now + t.everyMs * (.85 + Math.random() * .3); this.metrics.javelins += 1;
      e.startAttack(now, dirOf(nx, ny)); const life = e.spawnId;
      this.h.scene.time.delayedCall(ARROW_MS, () => { if (e.active && e.spawnId === life) this.h.fireArrow(e, this.h.player.x, this.h.player.y, e.def.damage * 1.2, t.speed); });
    }
    return true;
  }
  /** 大戟士：贴近后扇形预警，横扫。 */
  private sweeper(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'sweeper' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    const id = `trait-sweep-${e.spawnId}`, wf = warnFx(this.h.scene);
    if (s.phase === 'warn') {
      e.moveVx = e.moveVy = 0; wf.sector(id, e.x, e.y, t.range, s.face ?? 0, 1 - ((s.until ?? now) - now) / t.warnMs, now);
      if (now >= (s.until ?? 0)) {
        s.phase = undefined; this.metrics.sweeps += 1; wf.shapeImpact(id, 'sweep', e.x, e.y, t.range, s.face ?? 0, now); this.h.sfx('hitHeavy');
        const p = this.h.player, d = Math.hypot(p.x - e.x, p.y - e.y);
        if (p.alive && d <= t.range + p.radius * .5 && this.frontDiff(e, s.face ?? 0) <= Phaser.Math.DegToRad(t.arcDeg / 2) && p.takeDamage(t.damage, now)) this.h.scene.cameras.main.flash(90, 180, 40, 40, false);
        this.h.hurtTroops(e.x + Math.cos(s.face ?? 0) * t.range * .5, e.y + Math.sin(s.face ?? 0) * t.range * .5, t.range * .6, t.allyDamage);
      }
      return true;
    }
    if (dist < t.range * .9 && now >= s.next) { s.next = now + t.everyMs; s.phase = 'warn'; s.until = now + t.warnMs; s.face = Math.atan2(ny, nx); e.poseUntil = Math.max(e.poseUntil, now + t.warnMs + 270); e.startAttack(now, dirOf(nx, ny)); e.windupCol = 0; e.attackUntil = now + t.warnMs + 270; return true; } // 横扫弧光在攻击表第 2 帧：扫到那一刻播到第 2 帧
    this.h.move(e, nx, ny, dt); return true;
  }
  /** 先登死士：走到射程 → 举盾（正面减伤）↔ 放盾连射。 */
  private stance(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'stance' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    s.face = Math.atan2(ny, nx);
    if (!s.phase || s.phase === 'move') { if (dist > t.range) { this.h.move(e, nx, ny, dt); return true; } s.phase = 'up'; s.until = now + t.upMs; }
    e.moveVx = e.moveVy = 0;
    if (s.phase === 'up') { e.sprite.setTint(0xb8c0c8); if (now >= (s.until ?? 0)) { s.phase = 'down'; s.until = now + t.downMs; s.shots = 0; e.sprite.setTint(e.baseTint); } return true; }
    if ((s.shots ?? 0) < t.shots && now >= (s.until ?? 0) - t.downMs + (s.shots ?? 0) * t.shotGapMs) {
      s.shots = (s.shots ?? 0) + 1; this.metrics.volleys += 1; e.startAttack(now, dirOf(nx, ny)); this.h.sfx('mn_xbow');
      const life = e.spawnId; this.h.scene.time.delayedCall(ARROW_MS, () => { if (e.active && e.spawnId === life) this.h.fireArrow(e, this.h.player.x + (Math.random() - .5) * 30, this.h.player.y + (Math.random() - .5) * 30, e.def.damage, t.arrowSpeed); }); // 弩箭在攻击表第 2 帧射出
    }
    if (now >= (s.until ?? 0)) { s.phase = dist > t.range * 1.2 ? 'move' : 'up'; s.until = now + t.upMs; }
    return true;
  }
  /** 押粮卒：背粮往远处跑；runMs 内没被截住 → 粮到、来援兵（本体离场，不算击杀）。 */
  private courier(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'courier' }>, dt: number, now: number): boolean {
    if (s.tx === undefined) { const f = this.h.farPoint?.(e.x, e.y); const p = this.h.player, a = Math.atan2(e.y - p.y, e.x - p.x); s.tx = f?.x ?? e.x + Math.cos(a) * 1000; s.ty = f?.y ?? e.y + Math.sin(a) * 1000; }
    const dx = s.tx - e.x, dy = (s.ty ?? 0) - e.y, d = Math.hypot(dx, dy) || 1;
    if (d < 60 || now - (s.born ?? now) > t.runMs) {
      this.metrics.delivered += 1; const x = e.x, y = e.y, base = ROSTER[e.def.roster ?? '']?.base ?? 'infantry';
      e.deactivate(); this.st.delete(e);
      for (let i = 0; i < t.reinforce; i++) this.h.spawn(i ? 'infantry' : 'shield', x + (i - 1) * 40, y, this.h.baseDef(i ? 'infantry' : 'shield'));
      void base; return true;
    }
    this.h.move(e, dx / d, dy / d, dt); return true;
  }
  /** 火船：没有专属图时用辎重车 + 地火当船。 */
  private fireshipLook(e: Enemy, s: St): void {
    const sc = this.h.scene; e.sprite.setAlpha(0); s.imgs = [];
    if (sc.textures.exists('yellow_props')) s.imgs.push(sc.add.image(e.x, e.y, 'yellow_props', 24).setOrigin(.5, .85).setDisplaySize(120, 120).setTint(0x8a5a3a).setName('trait-fireship'));
    if (sc.textures.exists('ground_fire')) { const sp = sc.add.sprite(e.x, e.y - 30, 'ground_fire', 0).setOrigin(.5, .85).setDisplaySize(90, 90).setName('trait-fireship'); const f = { v: 0 }; sc.tweens.add({ targets: f, v: 8, duration: 800, repeat: -1, onUpdate: () => { if (sp.active) sp.setFrame(Math.floor(f.v) % 8); } }); s.imgs.push(sp); }
  }
  private fireship(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'fireship' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    const w = this.h.inWater?.(e.x, e.y) ? 1.3 / WATER_MUL : 1; this.h.move(e, nx * w, ny * w, dt);
    // 碰到主将（两者身体互相挤开，按两边半径 + 40 算碰到）就爆燃
    if (s.phase === 'warn') { e.moveVx = e.moveVy = 0; return true; } // 爆燃动画播着
    if (dist < this.h.player.radius + e.radius + 40) {
      // 有专属图：攻击表就是爆燃（第 2 帧大火球）——撞上先播，火球那一帧才炸；没图直接炸
      if (e.def.attackVisual) { s.phase = 'warn'; e.startAttack(now, dirOf(nx, ny)); const life = e.spawnId; this.h.scene.time.delayedCall(ARROW_MS, () => { if (e.active && e.spawnId === life) { this.shipBoom(e, s, t, this.now()); e.hp = 0; this.h.scene.time.delayedCall(250, () => { if (e.active && e.spawnId === life) e.deactivate(); }); } }); }
      else { this.shipBoom(e, s, t, now); e.hp = 0; e.deactivate(); }
    }
    return true;
  }
  private shipBoom(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'fireship' }>, now: number): void {
    if (s.boom) return; s.boom = true; this.metrics.shipBooms += 1;
    if (!e.def.attackVisual) playSheet(this.h.scene, 'fx_explosion', e.x, e.y - 20, { size: t.radius * 2.2, depth: DEPTH.fx, ms: 520 }); // 有专属图时爆燃画在攻击表里，不再叠
    this.h.sfx('ship_boom'); this.h.scene.cameras.main.shake(160, .005);
    this.hitPlayer(e.x, e.y, t.radius, t.damage, now); this.h.hurtTroops(e.x, e.y, t.radius, t.allyDamage);
    for (let i = 0; i < 3; i++) { const a = i * 2.1; this.addFire(e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 30, t.fireRadius, now, t.fireMs, t.fireDamage); }
    for (const im of s.imgs ?? []) (im as unknown as Phaser.GameObjects.GameObject).destroy(); s.imgs = [];
  }
  /** 曹军枪阵兵：贴近后预警一条直线，长枪贯穿。 */
  private lancer(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'lancer' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    const id = `trait-lance-${e.spawnId}`, wf = warnFx(this.h.scene);
    if (s.phase === 'warn') {
      e.moveVx = e.moveVy = 0; const a = s.face ?? 0;
      wf.lane(id, 'charge', e.x, e.y, a, t.range, t.width, 1 - ((s.until ?? now) - now) / t.warnMs, now);
      if (now >= (s.until ?? 0)) {
        s.phase = undefined; this.metrics.thrusts += 1; wf.shapeImpact(id, 'charge', e.x, e.y, t.range, a, now, t.width); this.h.sfx('hitHeavy');
        if (this.inLane(e.x, e.y, a, t.range, t.width)) { const p = this.h.player; if (p.takeDamage(t.damage, now)) this.h.scene.cameras.main.flash(90, 180, 40, 40, false); }
        this.h.hurtTroops(e.x + Math.cos(a) * t.range * .5, e.y + Math.sin(a) * t.range * .5, t.width, t.allyDamage);
      }
      return true;
    }
    if (dist < t.range * .95 && now >= s.next) { s.next = now + t.everyMs; s.phase = 'warn'; s.until = now + t.warnMs; s.face = Math.atan2(ny, nx); e.startAttack(now, dirOf(nx, ny)); e.windupCol = 0; e.attackUntil = now + t.warnMs + 180; return true; }
    this.h.move(e, nx, ny, dt); return true;
  }
  /** 主将是否在 (x, y) 沿 a 方向长 len、宽 w 的直线里。 */
  private inLane(x: number, y: number, a: number, len: number, w: number): boolean {
    const p = this.h.player; if (!p.alive) return false; const dx = p.x - x, dy = p.y - y, along = dx * Math.cos(a) + dy * Math.sin(a), side = -dx * Math.sin(a) + dy * Math.cos(a);
    return along >= -10 && along <= len + p.radius && Math.abs(side) <= w / 2 + p.radius * .6;
  }
  /** 五溪蛮兵：落点预警 → 一跃 → 落地伤害。 */
  private leaper(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'leaper' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    const id = `trait-leap-${e.spawnId}`, wf = warnFx(this.h.scene);
    if (s.phase === 'warn') {
      e.moveVx = e.moveVy = 0; wf.circle(id, 'slam', s.tx ?? e.x, s.ty ?? e.y, t.radius, 1 - ((s.until ?? now) - now) / t.warnMs, now);
      if (now >= (s.until ?? 0)) { s.phase = 'air'; s.air = { x0: e.x, y0: e.y, from: now }; e.controlImmune = true; this.h.sfx('mn_leap'); }
      return true;
    }
    if (s.phase === 'air' && s.air) {
      e.moveVx = e.moveVy = 0; const k = Math.min(1, (now - s.air.from) / t.flightMs), tx = s.tx ?? e.x, ty = s.ty ?? e.y;
      e.sprite.setPosition(s.air.x0 + (tx - s.air.x0) * k, s.air.y0 + (ty - s.air.y0) * k - Math.sin(k * Math.PI) * 90);
      if (k >= 1) { s.phase = undefined; e.controlImmune = false; this.metrics.leaps += 1; this.h.sfx('mn_land'); wf.shapeImpact(id, 'slam', tx, ty, t.radius, 0, now); playSheet(this.h.scene, 'fx_collapse_dust', tx, ty - 10, { size: t.radius * 2.2, depth: DEPTH.fx, ms: 420, alpha: .8 }); this.hitPlayer(tx, ty, t.radius, t.damage, now); }
      return true;
    }
    if (dist <= t.range && dist >= t.minRange && now >= s.next) { s.next = now + t.everyMs; s.phase = 'warn'; s.until = now + t.warnMs; s.tx = this.h.player.x; s.ty = this.h.player.y; e.startAttack(now, dirOf(nx, ny)); e.windupCol = 0; e.attackUntil = now + t.warnMs + t.flightMs + 180; e.poseUntil = Math.max(e.poseUntil, e.attackUntil); return true; } // 攻击表：预警时蹲低蓄力（第 1 帧）、落地前腾空劈下（第 2 帧）、落地那一刻砍到（第 3 帧）
    this.h.move(e, nx, ny, dt); return true;
  }
  /** 长沙强弓：远处站定、蓄力（预警线）、一箭穿透。 */
  private sniper(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'sniper' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    const id = `trait-snipe-${e.spawnId}`, wf = warnFx(this.h.scene);
    if (s.phase === 'warn') {
      e.moveVx = e.moveVy = 0; const a = s.face ?? 0;
      wf.lane(id, 'charge', e.x, e.y, a, t.length, t.width, 1 - ((s.until ?? now) - now) / t.chargeMs, now);
      if (now >= (s.until ?? 0)) {
        s.phase = undefined; this.metrics.snipes += 1; this.h.sfx('enemyArrow');
        this.h.fireArrow(e, e.x + Math.cos(a) * t.length, e.y + Math.sin(a) * t.length, 0, 900); // 只是那一箭的样子；伤害按预警线判
        if (this.inLane(e.x, e.y, a, t.length, t.width)) { const p = this.h.player; if (p.takeDamage(t.damage, now)) this.h.scene.cameras.main.flash(90, 180, 40, 40, false); }
        for (let k = 1; k <= 4; k++) this.h.hurtTroops(e.x + Math.cos(a) * t.length * k / 4, e.y + Math.sin(a) * t.length * k / 4, t.width, t.damage);
      }
      return true;
    }
    if (dist > t.range) { this.h.move(e, nx, ny, dt); return true; }
    if (dist < t.range * .55) { this.h.move(e, -nx, -ny, dt); return true; }
    e.moveVx = e.moveVy = 0;
    if (now >= s.next) { s.next = now + t.everyMs; s.phase = 'warn'; s.until = now + t.chargeMs; s.face = Math.atan2(ny, nx); e.startAttack(now, dirOf(nx, ny)); e.windupCol = 0; e.attackUntil = now + t.chargeMs + 270; } // 攻击表：蓄力时拉满停住（第 1 帧），放箭那一刻播到箭离弦（第 2 帧）
    return true;
  }

  // ———— 第三批 ————
  /** 毒镖命中：叠一层毒。 */
  private addPoison(t: Extract<TraitDef, { kind: 'poison' }>, now: number): void {
    this.poison = this.poison.filter(x => x > now);
    if (this.poison.length >= t.maxStacks) this.poison.shift();
    this.poison.push(now + t.seconds * 1000); this.poisonDps = t.dps;
    if (!this.poisonTick) this.poisonTick = now + 1000;
  }
  /** 主将被网住：移速 × (1 − slow)，slowMs 后恢复（Player.snareSpeedMul）。 */
  private snareUntil = 0;
  /** 巴蜀猎户：保持距离投网（飞的是网——缺专属图时用箭矢图染麻色），中了减速。 */
  private net(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'net' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    if (dist > t.range) this.h.move(e, nx, ny, dt); else if (dist < t.range * .55) this.h.move(e, -nx, -ny, dt); else this.h.move(e, -ny * .35, nx * .35, dt);
    if (now >= s.next && dist < t.range + 80 && e.attackUntil <= now) {
      s.next = now + t.everyMs * (.85 + Math.random() * .3); this.metrics.nets += 1; e.startAttack(now, dirOf(nx, ny));
      const p = this.h.player, key = this.h.scene.textures.exists('arrow') ? 'arrow' : ''; if (!key) return true;
      const flight = Math.max(280, Math.hypot(p.x - e.x, p.y - e.y) / .4);
      const img = this.h.scene.add.image(e.x, e.y - 18, key).setDepth(DEPTH.projectile).setScale(.6).setTint(0xc8b080).setRotation(Math.atan2(p.y - e.y, p.x - e.x));
      this.darts.push({ img, x0: e.x, y0: e.y - 18, tx: p.x, ty: p.y - 10, from: now, at: now + flight, dmg: t.hitDamage, hit: n => { this.snareUntil = n + t.slowMs; this.h.player.snareSpeedMul = 1 - t.slow; this.metrics.snared += 1; } });
    }
    return true;
  }
  /** 增益光环：每 250ms 给半径内友军（首领除外）记一笔「到何时、加多少」，GameScene 移动 / 伤害时乘上。 */
  private auraTill = new Map<Enemy, { until: number; speed: number; damage: number }>();
  private aura(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'aura' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    if (dist < t.keepAway) this.h.move(e, -nx * .9, -ny * .9, dt); else if (dist > t.keepAway + 160) this.h.move(e, nx, ny, dt); else this.h.move(e, -ny * .3, nx * .3, dt);
    if (now >= s.next) {
      s.next = now + 250; let n = 0;
      for (const o of this.h.enemies()) { if (!o.active || o === e || o.kind === 'boss' || o.isSupplySlot || Math.hypot(o.x - e.x, o.y - e.y) > t.radius) continue; this.auraTill.set(o, { until: now + 400, speed: t.speedMul, damage: t.damageMul }); n++; }
      if (n && now >= (s.until ?? 0)) { s.until = now + 1800; e.startAttack(now, dirOf(nx, ny)); this.metrics.auraPulses += 1; playSheet(this.h.scene, 'fx_heal_fushui', e.x, e.y - 20, { size: t.radius * .9, depth: actorDepth(e.y) - .05, ms: 700, alpha: .45, tint: 0xffb070 }); }
    }
    return true;
  }
  /** 光环中的友军：移速倍率（GameScene.advanceEnemy 乘）。 */
  speedMul(e: Enemy): number { const a = this.auraTill.get(e); return a && a.until > this.now() ? a.speed : 1; }
  /** 光环中的友军：伤害倍率（接触伤害 / 放箭乘）。 */
  damageMul(e: Enemy): number { const a = this.auraTill.get(e); return a && a.until > this.now() ? a.damage : 1; }
  /** 伏弩手：远处站定，在主将脚下标一圈，落箭。 */
  private volleyStep(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'volley' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    if (dist > t.range) this.h.move(e, nx, ny, dt); else if (dist < t.range * .5) this.h.move(e, -nx, -ny, dt); else e.moveVx = e.moveVy = 0;
    if (now >= s.next && dist < t.range + 80) {
      s.next = now + t.everyMs * (.85 + Math.random() * .3); this.metrics.volleyZones += 1; e.startAttack(now, dirOf(nx, ny));
      const p = this.h.player; this.hazards.push({ id: `trait-volley-${++this.seq}`, kind: 'stone', look: 'arrows', x: p.x, y: p.y, r: t.radius, from: now, at: now + t.warnMs, end: now + t.warnMs, damage: t.damage, allyDamage: t.allyDamage, tick: 0 });
    }
    return true;
  }
  /** 樊城擂木兵：沿直线预警，滚木从脚下滚出，碾到就伤。 */
  private roller(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'roller' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    const id = `trait-roll-${e.spawnId}`, wf = warnFx(this.h.scene), a = s.face ?? 0;
    if (s.phase === 'warn') {
      e.moveVx = e.moveVy = 0; wf.lane(id, 'charge', e.x, e.y, a, t.length, t.width, 1 - ((s.until ?? now) - now) / t.warnMs, now);
      if (now >= (s.until ?? 0)) {
        s.phase = undefined; this.metrics.rolls += 1; this.h.sfx('hitHeavy');
        const x0 = e.x, y0 = e.y, ms = t.length / t.speed * 1000, sc = this.h.scene, key = sc.textures.exists('siege_mid_barb') ? 'siege_mid_barb' : null;
        const img = key ? sc.add.image(x0, y0, key, 5).setDisplaySize(t.width * 1.3, t.width * 1.3).setDepth(DEPTH.projectile).setRotation(a + Math.PI / 2) : null;
        let hit = false; const t0 = now;
        sc.tweens.addCounter({ from: 0, to: 1, duration: ms, onUpdate: tw => { const k = tw.getValue() ?? 0, x = x0 + Math.cos(a) * t.length * k, y = y0 + Math.sin(a) * t.length * k; img?.setPosition(x, y);
          const p = this.h.player; if (!hit && p.alive && Math.hypot(p.x - x, p.y - y) < t.width / 2 + p.radius) { hit = true; if (p.takeDamage(t.damage, this.now())) sc.cameras.main.flash(90, 180, 40, 40, false); } },
          onComplete: () => { img?.destroy(); this.h.hurtTroops(x0 + Math.cos(a) * t.length * .5, y0 + Math.sin(a) * t.length * .5, t.width, t.allyDamage); void t0; } });
      }
      return true;
    }
    if (dist < t.range && now >= s.next) { s.next = now + t.everyMs; s.phase = 'warn'; s.until = now + t.warnMs; s.face = Math.atan2(ny, nx); e.startAttack(now, dirOf(nx, ny)); e.windupCol = 0; e.attackUntil = now + t.warnMs + 270; return true; }
    if (dist > t.range * .9) this.h.move(e, nx, ny, dt); else e.moveVx = e.moveVy = 0;
    return true;
  }
  /** 吴军火攻兵：同投掷，落点留火；倒下爆燃（onKilled）。 */
  private firepot(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'firepot' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    if (e.poseUntil > now) { e.moveVx = e.moveVy = 0; return true; }
    if (dist > t.range) this.h.move(e, nx, ny, dt); else if (dist < t.range * .55) this.h.move(e, -nx * .8, -ny * .8, dt); else e.moveVx = e.moveVy = 0;
    if (now >= s.next && dist < t.range + 60) {
      s.next = now + t.everyMs * (.85 + Math.random() * .3); this.metrics.throws += 1;
      const p = this.h.player, tx = p.x + Phaser.Math.Between(-20, 20), ty = p.y + Phaser.Math.Between(-20, 20);
      e.poseUntil = now + 360; e.startAttack(now, dirOf(nx, ny));
      this.hazards.push({ id: `trait-pot-${++this.seq}`, kind: 'stone', fire: { ms: t.fireMs, r: t.fireRadius, dmg: t.fireDamage }, x: tx, y: ty, r: t.radius, from: now, at: now + t.warnMs, end: now + t.warnMs, damage: t.damage, allyDamage: t.allyDamage, tick: 0 });
      this.flyStone(e.x, e.y - 40, tx, ty, now + RELEASE_MS, Math.max(400, t.warnMs - RELEASE_MS));
    }
    return true;
  }
  /** 林中伏弓：现身后保持距离，连射 shots 支。 */
  private burstStep(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'burst' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    if (dist > t.range) this.h.move(e, nx, ny, dt); else if (dist < t.range * .5) this.h.move(e, -nx, -ny, dt); else e.moveVx = e.moveVy = 0;
    if (now >= s.next && dist < t.range + 80) {
      s.next = now + t.everyMs; this.metrics.bursts3 += 1; const life = e.spawnId;
      for (let i = 0; i < t.shots; i++) this.h.scene.time.delayedCall(i * t.gapMs, () => { if (!e.active || e.spawnId !== life) return; e.startAttack(this.now(), dirOf(nx, ny)); this.h.sfx('enemyArrow'); this.h.scene.time.delayedCall(ARROW_MS, () => { if (e.active && e.spawnId === life) this.h.fireArrow(e, this.h.player.x, this.h.player.y, e.def.damage, t.arrowSpeed); }); });
    }
    return true;
  }
  /** 魏国虎卫：主将近了就上前打（普通追击）；否则回到首领身边（离首领 radius 内受伤减半）。 */
  private guard(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'guard' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    const b = this.h.boss?.(); if (!b?.active || dist < t.engage) return false;
    const a = s.ang + now / 3000, gx = b.x + Math.cos(a) * t.radius * .6, gy = b.y + Math.sin(a) * t.radius * .4, dx = gx - e.x, dy = gy - e.y, d = Math.hypot(dx, dy) || 1;
    if (d < 20) e.moveVx = e.moveVy = 0; else this.h.move(e, dx / d, dy / d, dt);
    void nx; void ny; return true;
  }
  /** 火箭手：保持距离放火箭，箭落处留火。 */
  private firearrow(e: Enemy, s: St, t: Extract<TraitDef, { kind: 'firearrow' }>, dt: number, now: number, dist: number, nx: number, ny: number): boolean {
    if (dist > t.range) this.h.move(e, nx, ny, dt); else if (dist < t.range * .5) this.h.move(e, -nx, -ny, dt); else e.moveVx = e.moveVy = 0;
    if (now >= s.next && dist < t.range + 80 && e.attackUntil <= now) {
      s.next = now + t.everyMs * (.85 + Math.random() * .3); this.metrics.fireArrows += 1; e.startAttack(now, dirOf(nx, ny)); this.h.sfx('enemyArrow');
      const p = this.h.player, tx = p.x, ty = p.y, life = e.spawnId, fly = Math.hypot(tx - e.x, ty - e.y) / t.speed * 1000;
      this.h.scene.time.delayedCall(ARROW_MS, () => { if (e.active && e.spawnId === life) this.h.fireArrow(e, tx, ty, e.def.damage, t.speed); });
      this.h.scene.time.delayedCall(ARROW_MS + fly, () => this.addFire(tx, ty, t.fireRadius, this.now(), t.fireMs, t.fireDamage));
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
      this.h.sfx('mn_firepot');
      this.hitPlayer(e.x, e.y, t.burstRadius, t.burstDamage, now);
      this.h.hurtTroops(e.x, e.y, t.burstRadius, t.burstDamage);
      this.addFire(e.x, e.y, t.fireRadius * 1.3, now, t.fireMs, t.fireDamage);
    } else if (t.kind === 'firepot') {
      this.metrics.bursts += 1; playSheet(this.h.scene, 'fx_explosion', e.x, e.y - 16, { size: t.burstRadius * 2, depth: DEPTH.fx, ms: 480 }); this.h.sfx('hitHeavy');
      this.hitPlayer(e.x, e.y, t.burstRadius, t.burstDamage, now); this.h.hurtTroops(e.x, e.y, t.burstRadius, t.burstDamage); this.addFire(e.x, e.y, t.fireRadius, now, t.fireMs, t.fireDamage);
    } else if (t.kind === 'courier') {
      this.h.gainFood?.(t.food); this.metrics.intercepted += 1;
    } else if (t.kind === 'fireship') {
      const s = this.st.get(e); if (s && s.life === e.spawnId) this.shipBoom(e, s, t, now);
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
    if (this.snareUntil && now >= this.snareUntil) { this.snareUntil = 0; p.snareSpeedMul = 1; } // 绳网到时松开
    if (this.auraTill.size > 200) for (const [e, a] of this.auraTill) if (a.until < now || !e.active) this.auraTill.delete(e);
    // 跟着本体走的布景（火船）；本体没了就收掉
    for (const [e, s] of this.st) { if (!s.imgs?.length) continue; if (!e.active || e.spawnId !== s.life) { for (const im of s.imgs) (im as unknown as Phaser.GameObjects.GameObject).destroy(); s.imgs = []; continue; } s.imgs[0]?.setPosition(e.x, e.y + 10); (s.imgs[0] as unknown as Phaser.GameObjects.Image)?.setDepth?.(actorDepth(e.y)); s.imgs[1]?.setPosition(e.x, e.y - 18); (s.imgs[1] as unknown as Phaser.GameObjects.Image)?.setDepth?.(actorDepth(e.y) + .02); }
    for (let i = this.hazards.length - 1; i >= 0; i -= 1) {
      const z = this.hazards[i];
      if (z.kind === 'stone') {
        const look = z.look ?? 'slam';
        if (now < z.at) { wf.circle(z.id, look, z.x, z.y, z.r, (now - z.from) / (z.at - z.from), now); continue; }
        wf.shapeImpact(z.id, look, z.x, z.y, z.r, 0, now);
        if (look === 'slam') playSheet(this.h.scene, 'fx_collapse_dust', z.x, z.y - 14, { size: z.r * 2.4, depth: DEPTH.fx, ms: 480, alpha: .85 });
        this.h.sfx(look === 'arrows' ? 'enemyArrow' : 'mn_stone');
        if (z.fire) { this.addFire(z.x, z.y, z.fire.r, now, z.fire.ms, z.fire.dmg); this.metrics.firepots += 1; }
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
      if (p.alive && Math.hypot(p.x - d.tx, p.y - 10 - d.ty) < p.radius + 18 && p.takeDamage(d.dmg, now)) d.hit(now);
    }
    if (this.poisonTick && now >= this.poisonTick) {
      this.poison = this.poison.filter(x => x > now - 1);
      if (!this.poison.length || !p.alive) { this.poisonTick = 0; this.poison = []; }
      else {
        this.poisonTick = now + 1000; this.metrics.poisonTicks += 1;
        // 毒不致命：最多掉到 1（真正的威胁是叠毒时被围）
        if (!p.damageImmune) p.hp = Math.max(1, p.hp - this.poisonDps * this.poison.length);
        playSheet(this.h.scene, 'fx_poison_mist', p.x, p.y - 30, { size: 64, depth: DEPTH.fx, ms: 600, alpha: .55 }); // 毒雾整团偏实，叠在人物身上降到 .55（美术会话建议 .5～.6）
      }
    }
  }

  /** 当前叠了几层毒（HUD / 测试）。 */
  poisonStacks(now = this.now()): number { return this.poison.filter(x => x > now).length; }

  clear(): void {
    for (const z of this.hazards) z.img?.destroy();
    for (const d of this.darts) d.img.destroy();
    for (const s of this.st.values()) for (const im of s.imgs ?? []) (im as unknown as Phaser.GameObjects.GameObject).destroy();
    this.hazards = []; this.darts = []; this.poison = []; this.poisonTick = 0; this.st.clear(); this.auraTill.clear(); this.snareUntil = 0; this.h.player.snareSpeedMul = 1;
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
