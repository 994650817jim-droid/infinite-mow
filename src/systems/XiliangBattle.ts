import Phaser from 'phaser';
import type {Enemy} from '../entities/Enemy';
import type {Player} from '../entities/Player';
import type {Legion} from './Legion';
import type {EnemyDef} from '../data/enemies';
import type {EnemyKind} from '../types';
import {warnLane} from '../ui/Telegraph';
import {XILIANG_RAID as R, FEIXIONG as F} from '../data/xiliang';
import {ensureTroopArt, troopArtReady} from './TroopArt';
import {DongzhuoBoss} from './DongzhuoBoss';

/** 铁骑突阵参数（西凉铁骑见 XILIANG_RAID；虎豹骑见 data/hubao.ts）。 */
export type RaidParams = {readonly riders: number; readonly spacing: number; readonly lead: number; readonly aimJitter: number; readonly distance: number; readonly speed: number; readonly warnMs: number; readonly damage: number; readonly knockback: number; readonly troopRadius: number; readonly troopDamage: number};
export interface TacticsOptions {
  raid?: RaidParams;
  /** 首次突阵秒数、各关间隔（返回 null 表示该关不突阵）。 */
  first?: number; interval?: (stage: 1 | 2 | 3) => number | null;
  /** 突阵骑兵定义（默认当前关骑兵）。 */
  riderDef?: () => EnemyDef;
  /** 首次突阵提示。 */
  banner?: [string, string];
  /** 是否出飞熊军（只有第二章）。 */
  feixiong?: boolean;
  /** 冲锋道图形名（测试用）。 */
  laneName?: string;
}
export interface Host {
  scene: Phaser.Scene; player: Player; army: Legion; enemies: Enemy[];
  spawn: (kind: EnemyKind, x: number, y: number, override?: EnemyDef) => Enemy | null;
  /** 当前关（2-1 汜水关 / 2-2 荥阳 / 2-3 虎牢关）与本关已过秒数。 */
  stage: () => 1 | 2 | 3; elapsed: () => number;
  /** 当前关的西凉骑兵 / 刀盾兵定义（飞熊军以刀盾兵为底）。 */
  def: (kind: 'cavalry' | 'shield') => EnemyDef;
  banner: (text: string, caption: string) => void; sfx: (key: 'chargeWarn' | 'hitHeavy') => void;
  /** 2-3 董卓（DongzhuoBoss）：当前首领、首领招式组、敌兵寻路移动。 */
  boss?: () => Enemy | null; bossStyle?: () => string; move?: (e: Enemy, nx: number, ny: number, dt: number) => void;
  /** 战场上的建筑碰撞框（城墙、城门等）：突阵选道时避开，免得骑兵从墙后起冲被挡住。 */
  obstacles?: () => ReadonlyArray<{left: number; right: number; top: number; bottom: number}>;
}
/** 线段（加宽 r）是否穿过任一碰撞框。 */
function laneBlocked(x0: number, y0: number, x1: number, y1: number, r: number, boxes: ReadonlyArray<{left: number; right: number; top: number; bottom: number}>): boolean {
  for (let i = 0; i <= 24; i++) { const t = i / 24, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; if (boxes.some(b => x > b.left - r && x < b.right + r && y > b.top - r && y < b.bottom + r)) return true; }
  return false;
}
export interface Raid {id: number; x: number; y: number; dx: number; dy: number; warnUntil: number; riders: Array<{e: Enemy; life: number; ox: number; oy: number; hit: boolean; hurtAt: number}>; g: Phaser.GameObjects.Graphics; traveled: number}
interface Bash {e: Enemy; life: number; state: 'windup' | 'lunge'; until: number; dx: number; dy: number; hit: boolean; anim?: boolean; g: Phaser.GameObjects.Graphics}

/**
 * 第二章 · 讨伐董卓 的西凉军专属战法（只在主线第二章三关生效，攻守城 / 军情不启用）：
 * - 铁骑突阵：三骑并排，地面先亮一条冲锋道（约 1.1 秒），随后高速贯穿战场；撞到主将造成伤害并横向撞开，撞到部曲同样受伤。冲过后归入普通骑兵。
 * - 飞熊军（董卓亲军重甲步兵，荥阳、虎牢关出现）：受弓弩伤害减半；贴身时蓄力（地面短预警）后举盾猛撞，撞退主将。
 * 飞熊军造型：ChatGPT 生成的行走图与盾击动作图（public/assets/xiliang/feixiong-*.png，战斗开始时加载）；加载完成前为西凉刀盾兵放大并染铁青色。
 */
export class XiliangBattle {
  protected raids: Raid[] = []; private bashes: Bash[] = []; private nextRaidAt: number; private nextFeixiongAt: number = F.first; private raidSeq = 0; private lastT = 0; private announced = false; private feixiongAnnounced = false;
  private readonly bashCd = new WeakMap<Enemy, number>();
  /** 2-3 火烧洛阳：董卓首领控制。 */
  dongzhuo: DongzhuoBoss | null = null;
  protected readonly raid: RaidParams;
  constructor(protected h: Host, protected o: TacticsOptions = {}) { this.raid = o.raid ?? R; this.nextRaidAt = o.first ?? R.first; if (o.feixiong !== false) ensureTroopArt(h.scene, ['feixiong_walk', 'feixiong_attack', 'dongzhuo_walk', 'dongzhuo_attack']); }
  private intervalFor(stage: 1 | 2 | 3): number | null { return this.o.interval ? this.o.interval(stage) : R.interval[stage - 1]; }
  /** 子类（虎豹骑护驾）接管普通敌兵移动的钩子。 */
  protected guardStep(_e: Enemy, _dt: number, _now: number): boolean { return false; }
  /** 飞熊军定义（测试也用）。 */
  feixiongDef(): EnemyDef {
    const base = this.h.def('shield'), wv = base.walkVisual;
    const def: EnemyDef = {...base, variant: 'feixiong', hp: F.hp, speed: F.speed, damage: F.damage, xp: F.xp, radius: F.radius, tint: F.tint, walkVisual: wv ? {...wv, scale: wv.scale * F.scale} : undefined};
    // 正式美术（ChatGPT 行走 + 盾击动作图）就绪后不再染色
    if (wv && troopArtReady(this.h.scene, 'feixiong_walk')) { def.tint = undefined; def.walkVisual = {...wv, texture: 'feixiong_walk', scale: wv.scale * F.scale}; def.attackVisual = troopArtReady(this.h.scene, 'feixiong_attack') ? 'feixiong_attack' : undefined; }
    return def;
  }
  isFeixiong(e: Enemy): boolean { return e.def.variant === 'feixiong'; }
  /** 受击倍率：飞熊军重甲，弓弩伤害减半。 */
  incoming(e: Enemy, source: 'melee' | 'arrow' | 'fire'): number { return this.isFeixiong(e) && source === 'arrow' ? F.arrowMul : 1; }
  /** 本帧是否由西凉战法接管该敌兵的移动。 */
  handleEnemy(e: Enemy, dt: number, now: number): boolean {
    if (this.dongzhuo && e === this.dongzhuo.boss) { if (e.active) this.dongzhuo.step(dt, now); return true; }
    for (const r of this.raids) if (r.riders.some(x => x.e === e && x.e.spawnId === x.life)) return true;
    if (this.guardStep(e, dt, now)) return true;
    if (!this.isFeixiong(e)) return false;
    const b = this.bashes.find(x => x.e === e && x.e.spawnId === x.life);
    if (b) return this.stepBash(b, dt, now);
    const p = this.h.player, d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < F.bashRange && now >= (this.bashCd.get(e) ?? 0)) {
      this.bashCd.set(e, now + F.bashCooldown);
      const dx = (p.x - e.x) / (d || 1), dy = (p.y - e.y) / (d || 1);
      this.bashes.push({e, life: e.spawnId, state: 'windup', until: now + F.windupMs, dx, dy, hit: false, g: this.h.scene.add.graphics().setDepth(3)});
      e.moveVx = e.moveVy = 0; return true;
    }
    return false;
  }
  private stepBash(b: Bash, dt: number, now: number): boolean {
    const e = b.e;
    if (b.state === 'windup') {
      e.moveVx = e.moveVy = 0;
      const t = 1 - (b.until - now) / F.windupMs;
      b.g.clear(); warnLane(b.g, e.x, e.y, Math.atan2(b.dy, b.dx), F.lungeDistance + 20, 46, Math.max(0, Math.min(1, t)), 0x7d8bb0, 0xd8e2ff);
      // 盾击动作四帧（360ms）：蓄力末段起播，撞出时到最远帧
      if (!b.anim && now >= b.until - 190) { b.anim = true; e.startAttack(now, Math.abs(b.dx) > Math.abs(b.dy) ? (b.dx < 0 ? 'left' : 'right') : b.dy < 0 ? 'up' : 'down'); }
      if (now >= b.until) { b.state = 'lunge'; b.until = now + F.lungeMs; b.g.clear(); }
      return true;
    }
    const step = F.lungeDistance / (F.lungeMs / 1000) * dt;
    e.sprite.x += b.dx * step; e.sprite.y += b.dy * step;
    const p = this.h.player;
    if (!b.hit && Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius + 10) {
      b.hit = true; this.h.sfx('hitHeavy');
      if (p.takeDamage(F.bashDamage, now)) this.h.scene.cameras.main.shake(120, .004);
      p.sprite.x += b.dx * F.knockback; p.sprite.y += b.dy * F.knockback;
    }
    if (now >= b.until) { this.bashes.splice(this.bashes.indexOf(b), 1); b.g.destroy(); }
    return true;
  }
  update(dt: number, now: number): void {
    const t = this.h.elapsed(), stage = this.h.stage();
    // 战线推进到下一关时本关计时归零：战法排期随之重置
    if (t < this.lastT) { this.nextRaidAt = this.o.first ?? R.first; this.nextFeixiongAt = F.first; }
    this.lastT = t;
    // 失效的突阵 / 盾击（敌兵已死或被回收）
    for (const b of [...this.bashes]) if (!b.e.active || b.e.spawnId !== b.life) { b.g.destroy(); this.bashes.splice(this.bashes.indexOf(b), 1); }
    if (t >= this.nextRaidAt) { const iv = this.intervalFor(stage); this.nextRaidAt = iv === null ? Infinity : t + iv; if (iv !== null) this.startRaid(now); }
    if (this.o.feixiong !== false && stage >= 2 && t >= this.nextFeixiongAt) { this.nextFeixiongAt = t + F.interval[stage - 1]; this.spawnFeixiong(); }
    for (const r of [...this.raids]) this.stepRaid(r, dt, now);
    this.updateDongzhuo(now);
  }
  private updateDongzhuo(now: number): void {
    const b = this.h.boss?.();
    if (this.dongzhuo && (!this.dongzhuo.boss.active || this.dongzhuo.boss !== b)) { this.dongzhuo.clear(); this.dongzhuo = null; }
    if (!this.dongzhuo && b?.active && this.h.bossStyle?.() === 'dongzhuo' && this.h.move) {
      const move = this.h.move;
      this.dongzhuo = new DongzhuoBoss({scene: this.h.scene, player: this.h.player, army: this.h.army, move, raid: t => this.startRaid(t),
        guards: (n, x, y) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; this.h.spawn('shield', x + Math.cos(a) * 90, y + Math.sin(a) * 90, this.feixiongDef()); } },
        spawn: (k, x, y) => { this.h.spawn(k, x, y); },
        banner: (t, c) => this.h.banner(t, c ?? '')}, b, now);
    }
    this.dongzhuo?.update(now);
  }
  /** 立即发起一次铁骑突阵（测试与调试用）；返回突阵编号。 */
  startRaid(now: number): number {
    // 选一条从起点到主将之间没有建筑挡路的冲锋道（最多试 12 次，都不行就用最后一次）
    const p = this.h.player, boxes = this.h.obstacles?.() ?? [];
    let a = Math.random() * Math.PI * 2;
    for (let k = 0; k < 12 && boxes.length; k++) { const sx = p.x - Math.cos(a) * this.raid.lead, sy = p.y - Math.sin(a) * this.raid.lead; if (!laneBlocked(sx, sy, p.x + Math.cos(a) * 120, p.y + Math.sin(a) * 120, (this.raid.riders - 1) / 2 * this.raid.spacing + 20, boxes)) break; a = Math.random() * Math.PI * 2; }
    const dx = Math.cos(a), dy = Math.sin(a), side = (Math.random() - .5) * 2 * this.raid.aimJitter;
    const x = p.x - dx * this.raid.lead - dy * side, y = p.y - dy * this.raid.lead + dx * side;
    const riders: Raid['riders'] = [], def = this.o.riderDef?.() ?? this.h.def('cavalry'), dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    for (let i = 0; i < this.raid.riders; i++) {
      const off = (i - (this.raid.riders - 1) / 2) * this.raid.spacing, ox = -dy * off, oy = dx * off, e = this.h.spawn('cavalry', x + ox, y + oy, def);
      if (!e) continue;
      e.startCharge(now, dir); e.chargeAt = now + 1e7; e.moveVx = e.moveVy = 0;
      riders.push({e, life: e.spawnId, ox, oy, hit: false, hurtAt: 0});
    }
    if (!riders.length) return -1;
    const raid: Raid = {id: ++this.raidSeq, x, y, dx, dy, warnUntil: now + this.raid.warnMs, riders, g: this.h.scene.add.graphics().setDepth(3).setName(this.o.laneName ?? 'xiliang-raid-lane'), traveled: 0};
    this.raids.push(raid); this.h.sfx('chargeWarn');
    if (!this.announced) { this.announced = true; this.h.banner(...(this.o.banner ?? ['西凉铁骑 · 突阵！', '看准冲锋道，侧身闪开'])); }
    return raid.id;
  }
  protected stepRaid(r: Raid, dt: number, now: number): void {
    const live = r.riders.filter(x => x.e.active && x.e.spawnId === x.life);
    const width = this.raid.spacing * (this.raid.riders - 1) + 56, angle = Math.atan2(r.dy, r.dx);
    if (now < r.warnUntil) {
      const t = 1 - (r.warnUntil - now) / this.raid.warnMs;
      r.g.clear(); warnLane(r.g, r.x, r.y, angle, this.raid.distance, width, t);
      // 动作协调：刷出后 0.25 秒淡入（不凭空出现）；预警最后 25% 勒马后收约 10 像素蓄势，再冲出去
      const age = this.raid.warnMs - (r.warnUntil - now), back = t > .75 ? Math.sin((t - .75) / .25 * Math.PI / 2) * 10 : 0;
      for (const x of live) { x.e.sprite.x = r.x + x.ox - r.dx * back; x.e.sprite.y = r.y + x.oy - r.dy * back; x.e.moveVx = x.e.moveVy = 0; x.e.sprite.setAlpha(Math.min(1, age / 250)); }
      return;
    }
    r.g.clear(); for (const x of live) x.e.sprite.setAlpha(1);
    const step = this.raid.speed * dt; r.traveled += step;
    const p = this.h.player;
    for (const x of live) {
      const e = x.e, x0 = e.x, y0 = e.y; e.chargeState = 'charge'; e.sprite.x += r.dx * step; e.sprite.y += r.dy * step; e.moveVx = r.dx * this.raid.speed; e.moveVy = r.dy * this.raid.speed;
      // 按本帧走过的线段判定（低帧率时一帧可走几十像素，只看终点会穿过主将）
      const along = Math.max(0, Math.min(step, (p.x - x0) * r.dx + (p.y - y0) * r.dy)), cx = x0 + r.dx * along, cy = y0 + r.dy * along;
      if (!x.hit && Math.hypot(p.x - cx, p.y - cy) < p.radius + e.radius + 8) {
        x.hit = true; if (p.takeDamage(this.raid.damage, now)) this.h.scene.cameras.main.flash(120, 180, 40, 40, false);
        // 横向撞开（离开冲锋道）
        const cross = (p.x - e.x) * -r.dy + (p.y - e.y) * r.dx, s = cross >= 0 ? 1 : -1;
        p.sprite.x += -r.dy * s * this.raid.knockback + r.dx * 18; p.sprite.y += r.dx * s * this.raid.knockback + r.dy * 18;
      }
      if (now >= x.hurtAt) { x.hurtAt = now + 250; this.h.army.hurtArea(e.x, e.y, this.raid.troopRadius, this.raid.troopDamage, now); }
    }
    if (r.traveled >= this.raid.distance || !live.length) {
      // 冲过之后归入普通骑兵
      for (const x of live) { x.e.chargeState = 'recover'; x.e.chargeAt = now + 350; x.e.dashCd = 4; }
      r.g.destroy(); this.raids.splice(this.raids.indexOf(r), 1);
    }
  }
  private spawnFeixiong(): void {
    if (this.h.enemies.filter(e => e.active && this.isFeixiong(e)).length >= F.maxAlive) return;
    const p = this.h.player, a = Math.random() * Math.PI * 2, e = this.h.spawn('shield', p.x + Math.cos(a) * F.spawnDistance, p.y + Math.sin(a) * F.spawnDistance, this.feixiongDef());
    if (e && !this.feixiongAnnounced) { this.feixiongAnnounced = true; this.h.banner('飞熊军压阵', '董卓亲军重甲：弓弩难伤，近身会举盾猛撞'); }
  }
  /** 当前进行中的突阵数（测试用）。 */
  get activeRaids(): number { return this.raids.length; }
  clear(): void { this.dongzhuo?.clear(); this.dongzhuo = null; for (const r of this.raids) r.g.destroy(); for (const b of this.bashes) b.g.destroy(); this.raids = []; this.bashes = []; }
}
