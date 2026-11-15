import Phaser from 'phaser';
import { warnCircle, warnLane } from '../ui/Telegraph';
import type {Enemy} from '../entities/Enemy';
import type {Player} from '../entities/Player';
import type {Legion} from './Legion';
import type {EnemyKind} from '../types';
import {GUANDU_STAGES, type GuanduStage} from '../data/guanduChapter';
import {GRAIN} from './GrainDepots';

interface Host {
  scene: Phaser.Scene; boss: Enemy; player: Player; army: Legion; spawn: (kind: EnemyKind, x: number, y: number) => Enemy | null;
  /** 焚粮：首领受伤倍率（未焚粮草越多越低）与已焚数量。 */
  morale?: () => {multiplier: number; burned: number; intact: number};
  /** 劫粮（4-2）：最近完好粮草与抢夺。 */
  depots?: {nearest(x: number, y: number): {x: number; y: number; id: number} | null; loot(id: number, now: number): boolean};
}
/** 线形区（length/width）或圆环区（radius，inner>0 时为环）。due 为出手后延迟（毫秒）。 */
interface Zone {x: number; y: number; angle: number; length: number; width: number; radius: number; inner: number; due: number; done: boolean;}

/** 颜良（4-1）技能参数（伤害与第三章首领同量级）。 */
export const YANLIANG = {
  dash: {length: 300, width: 56, speed: 420, speed2: 480, damage: 16, cleaveRadius: 72, cleaveRadius2: 92, cleaveDamage: 20},
  spin: {radius: 140, damage: 18, innerRadius2: 110, outerRadius2: 215, outerDelay2: 420},
  siege: {count: 3, count2: 5, distance: 170, radius: 36},
};
/** 文丑（4-2）技能参数。 */
export const WENCHOU = {
  feint: {back: 90, backMs: 300, length: 300, width: 44, speed: 560, damage: 15, side: .34, sideLength: 230, sideWidth: 34, sideDamage: 12},
  volley: {lanes: 5, lanes2: 7, spread: .62, length: 330, width: 22, damage: 9, stagger: 60},
  loot: {speed: 400, width: 50, damage: 14, reach: 46, cavalry: 2, fallback: 3, fallback2: 4, distance: 180, radius: 34},
};
/** 淳于琼（4-3）技能参数。 */
export const CHUNYU = {
  guard: {count: 4, count2: 6, distance: 110, radius: 30},
  volley: {count: 3, count2: 5, radius: 70, radius2: 60, distance: 150, damage: 14, stagger: 150},
  catapult: {count: 3, count2: 5, radius: 82, damage: 22, stagger: 300, spread: 140},
};
const TIMING = {warnMs: 950, attackMs: 1000, recoverMs: 650, rest: 1700, rest2: 1000};

/**
 * 第四章首领控制器：颜良（4-1）、文丑（4-2）、淳于琼（4-3）。
 * 与第三章首领同一套“预警 → 出手 → 收势”节奏、半血强化与免控；焚粮影响受伤倍率与援军数量，
 * 首领在场时焚毁粮草会令其“军心动摇”僵直（反击窗口）。全部计时为战斗时钟毫秒。
 */
export class GuanduBoss {
  state: 'approach' | 'warn' | 'attack' | 'recover' | 'rage' | 'dead' = 'approach'; phase2 = false;
  private at = 0; private until = 0; private attackLen = TIMING.attackMs; private next = 0; private index = 0; private skill = 0; private angle = 0;
  private zones: Zone[] = []; private seen = new Set<string>(); private travelled = 0; private hitAt = 0; private dashEnd = 0;
  private lootId = -1; private lootDone = false; private shakenUntil = 0;
  private gfx: Phaser.GameObjects.Graphics; private corpse?: Phaser.GameObjects.Image; private deathMs = 0;
  readonly metrics = {dash: 0, cleave: 0, spin: 0, siege: 0, feint: 0, volley: 0, loot: 0, looted: 0, healed: 0, guard: 0, arrows: 0, catapult: 0, shaken: 0, rage: 0, damage: 0};

  /** opts：攻城战大将借用技能时覆盖图集与名字。 */
  constructor(private h: Host, readonly stage: GuanduStage, now: number, private opts: {atlas?: string; name?: string} = {}) {
    this.gfx = h.scene.add.graphics().setDepth(39); this.next = now + 800; h.boss.controlImmune = true;
  }
  private get info() { const d = GUANDU_STAGES[this.stage - 1]; return {...d, atlas: this.opts.atlas ?? d.atlas, boss: this.opts.name ?? d.boss}; }
  private get kit(): 'yanliang' | 'wenchou' | 'chunyuqiong' { return this.stage === 2 ? 'wenchou' : this.stage === 3 ? 'chunyuqiong' : 'yanliang'; }
  get name() { return this.info.boss; }
  forceSkill(now: number) { this.state = 'approach'; this.next = now; this.update(0, now); }
  get label() {
    const names = this.kit === 'wenchou' ? ['回马枪', '骑射', '劫粮'] : this.kit === 'chunyuqiong' ? ['守粮阵', '弓阵齐射', '霹雳车投石'] : ['斩将突进', '大刀回旋', '号令攻城'];
    const m = this.h.morale?.(), morale = m && m.intact > 0 ? ' · 军心×' + m.intact : '';
    if (this.state === 'dead') return this.name + '授首';
    if (this.state === 'rage') return '军势强化 · 躲避下一轮' + morale;
    if (this.shakenUntil > this.at) return '军心动摇 · 反击机会' + morale;
    return (this.state === 'warn' ? '预警 · ' : this.state === 'recover' ? '收势 · 反击机会 · ' : '') + names[this.skill] + morale;
  }
  /** 与第三章一致：预警中减伤、强化瞬间大幅减伤、大军集火按人数开方分摊；另乘焚粮“军心”倍率。 */
  incoming(ally: boolean) { return (this.state === 'rage' ? .25 : this.state === 'warn' ? .6 : 1) * (ally ? 1 / Math.sqrt(Math.max(1, this.h.army.count / 12)) : 1) * (this.h.morale?.().multiplier ?? 1); }
  hit(now: number) { this.hitAt = now + 100; }
  /** 首领在场时一处粮草被焚：打断当前招式，僵直 GRAIN.shakenMs（不打断半血强化与败退）。 */
  shaken(now: number) {
    if (this.state === 'dead' || this.state === 'rage' || !this.h.boss.active) return;
    this.metrics.shaken++; this.zones = []; this.gfx.clear(); this.state = 'recover'; this.at = now;
    this.until = this.shakenUntil = now + GRAIN.shakenMs;
  }

  private pose(frame: number) {
    const b = this.h.boss;
    b.sprite.setTexture(this.info.atlas, frame).setDisplaySize(144, 144).setOrigin(.5, 114 / 128)
      .setFlipX(frame >= 16 && Math.cos(this.angle) < 0).setTint(this.hitAt > this.at ? 0xffbbbb : 0xffffff);
  }
  private zone(z: Partial<Zone> & {x: number; y: number}) { this.zones.push({angle: 0, length: 0, width: 0, radius: 0, inner: 0, due: 0, done: false, ...z}); }

  private begin(now: number) {
    const b = this.h.boss, p = this.h.player;
    this.skill = this.index++ % 3; this.angle = Math.atan2(p.y - b.y, p.x - b.x);
    this.zones = []; this.seen.clear(); this.travelled = 0; this.state = 'warn'; this.at = now; this.until = now + TIMING.warnMs; this.attackLen = TIMING.attackMs;
    if (this.kit === 'yanliang') this.beginYanliang(); else if (this.kit === 'wenchou') this.beginWenchou(now); else this.beginChunyu();
  }
  private beginYanliang() {
    const b = this.h.boss, p = this.h.player, Y = YANLIANG;
    if (this.skill === 0) {
      this.metrics.dash++;
      const ex = b.x + Math.cos(this.angle) * Y.dash.length, ey = b.y + Math.sin(this.angle) * Y.dash.length;
      this.zone({x: b.x, y: b.y, angle: this.angle, length: Y.dash.length, width: Y.dash.width});
      this.zone({x: ex, y: ey, radius: this.phase2 ? Y.dash.cleaveRadius2 : Y.dash.cleaveRadius});
    } else if (this.skill === 1) {
      this.metrics.spin++;
      if (this.phase2) { this.zone({x: b.x, y: b.y, radius: Y.spin.innerRadius2}); this.zone({x: b.x, y: b.y, radius: Y.spin.outerRadius2, inner: Y.spin.innerRadius2, due: Y.spin.outerDelay2}); }
      else this.zone({x: b.x, y: b.y, radius: Y.spin.radius});
    } else {
      this.metrics.siege++;
      // 每焚一处粮草，号令攻城少一路援军（至少一路）
      const n = Math.max(1, (this.phase2 ? Y.siege.count2 : Y.siege.count) - (this.h.morale?.().burned ?? 0));
      for (let i = 0; i < n; i++) { const a = this.angle + Math.PI + (i - (n - 1) / 2) * (Math.PI * 2 / Math.max(3, n)); this.zone({x: p.x + Math.cos(a) * Y.siege.distance, y: p.y + Math.sin(a) * Y.siege.distance, radius: Y.siege.radius}); }
    }
  }
  private beginWenchou(_now: number) {
    const b = this.h.boss, p = this.h.player, W = WENCHOU;
    if (this.skill === 0) {
      // 回马枪：先后撤，再沿预警线突刺（预警线从后撤点起算）
      this.metrics.feint++;
      const sx = b.x - Math.cos(this.angle) * W.feint.back, sy = b.y - Math.sin(this.angle) * W.feint.back;
      this.zone({x: sx, y: sy, angle: this.angle, length: W.feint.length + W.feint.back, width: W.feint.width});
      if (this.phase2) for (const s of [-1, 1]) this.zone({x: b.x, y: b.y, angle: this.angle + s * W.feint.side, length: W.feint.sideLength, width: W.feint.sideWidth, due: W.feint.backMs + 160});
      this.attackLen = Math.max(TIMING.attackMs, W.feint.backMs + (W.feint.length + W.feint.back) / W.feint.speed * 1000 + 200);
    } else if (this.skill === 1) {
      this.metrics.volley++;
      const n = this.phase2 ? W.volley.lanes2 : W.volley.lanes;
      for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1) - .5; this.zone({x: b.x, y: b.y, angle: this.angle + t * 2 * W.volley.spread, length: W.volley.length, width: W.volley.width, due: Math.abs(i - (n - 1) / 2) * W.volley.stagger}); }
    } else {
      this.metrics.loot++;
      const target = this.h.depots?.nearest(b.x, b.y);
      this.lootId = -1; this.lootDone = false;
      if (target) {
        // 劫粮：冲向最近辎重车，抵达即抢走并回血
        this.lootId = target.id; this.angle = Math.atan2(target.y - b.y, target.x - b.x);
        const length = Math.hypot(target.x - b.x, target.y - b.y);
        this.zone({x: b.x, y: b.y, angle: this.angle, length, width: W.loot.width});
        this.attackLen = Math.max(TIMING.attackMs, length / W.loot.speed * 1000 + 250);
      } else {
        // 辎重已尽：改为号令骑兵包抄
        const n = this.phase2 ? W.loot.fallback2 : W.loot.fallback;
        for (let i = 0; i < n; i++) { const a = this.angle + Math.PI + (i - (n - 1) / 2) * (Math.PI * 2 / Math.max(3, n)); this.zone({x: p.x + Math.cos(a) * W.loot.distance, y: p.y + Math.sin(a) * W.loot.distance, radius: W.loot.radius}); }
      }
    }
  }
  private beginChunyu() {
    const b = this.h.boss, p = this.h.player, C = CHUNYU;
    if (this.skill === 0) {
      // 守粮阵：首领四周召出刀盾护卫（二阶段六名并带弓手）
      this.metrics.guard++;
      const n = this.phase2 ? C.guard.count2 : C.guard.count;
      for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n; this.zone({x: b.x + Math.cos(a) * C.guard.distance, y: b.y + Math.sin(a) * C.guard.distance, radius: C.guard.radius}); }
    } else if (this.skill === 1) {
      // 弓阵齐射：主将身边依次落下箭雨圈
      this.metrics.arrows++;
      const n = this.phase2 ? C.volley.count2 : C.volley.count, r = this.phase2 ? C.volley.radius2 : C.volley.radius;
      for (let i = 0; i < n; i++) { const a = this.angle + i * Math.PI * 2 / n; this.zone({x: p.x + (i ? Math.cos(a) * C.volley.distance : 0), y: p.y + (i ? Math.sin(a) * C.volley.distance : 0), radius: r, due: i * C.volley.stagger}); }
      this.attackLen = Math.max(TIMING.attackMs, (n - 1) * C.volley.stagger + 400);
    } else {
      // 霹雳车投石：大范围落点，依次砸下（预警更长）
      this.metrics.catapult++;
      const n = this.phase2 ? C.catapult.count2 : C.catapult.count;
      for (let i = 0; i < n; i++) { const a = this.angle + 1.3 + i * 2.4; this.zone({x: p.x + (i ? Math.cos(a) * C.catapult.spread : 0), y: p.y + (i ? Math.sin(a) * C.catapult.spread : 0), radius: C.catapult.radius, due: i * C.catapult.stagger}); }
      this.attackLen = Math.max(TIMING.attackMs, (n - 1) * C.catapult.stagger + 500);
    }
  }
  private inside(z: Zone, x: number, y: number, r: number) {
    if (z.radius) { const d = Math.hypot(x - z.x, y - z.y); return d <= z.radius + r && d >= z.inner - r; }
    const dx = x - z.x, dy = y - z.y, c = Math.cos(z.angle), s = Math.sin(z.angle), along = dx * c + dy * s;
    return along >= -r && along <= z.length + r && Math.abs(-dx * s + dy * c) <= z.width / 2 + r;
  }
  private impact(z: Zone, now: number, damage: number, key: string) {
    const p = this.h.player;
    const hit = (id: string, x: number, y: number, r: number, fn: () => void) => { const k = key + ':' + id; if (!this.seen.has(k) && this.inside(z, x, y, r)) { this.seen.add(k); fn(); this.metrics.damage++; } };
    hit('p', p.x, p.y, p.radius, () => p.takeDamage(damage, now));
    const cx = z.radius ? z.x : z.x + Math.cos(z.angle) * z.length / 2, cy = z.radius ? z.y : z.y + Math.sin(z.angle) * z.length / 2;
    for (const u of this.h.army.grid.query(cx, cy, z.radius || z.length / 2 + z.width)) if (u.active) hit(u.id + ':' + u.lifeId, u.x, u.y, u.radius, () => this.h.army.hurt(u, damage, now));
  }
  private draw(z: Zone, alpha: number) {
    const g = this.gfx; g.lineStyle(2, 0xe4ba78, .9).fillStyle(this.kit === 'wenchou' ? 0xa8603a : 0xb8502f, alpha);
    if (z.radius) {
      if (z.inner > 0) { g.lineStyle(z.radius - z.inner, 0xb8502f, alpha * .55).strokeCircle(z.x, z.y, (z.radius + z.inner) / 2); g.lineStyle(1.4, 0xe4ba78, .5).strokeCircle(z.x, z.y, z.radius).strokeCircle(z.x, z.y, z.inner); }
      else warnCircle(g, z.x, z.y, z.radius, alpha >= .3 ? 1 : .45, this.kit === 'wenchou' ? 0xa8603a : 0xb8502f, 0xe4ba78, alpha >= .3, this.at);
    } else {
      warnLane(g, z.x, z.y, z.angle, z.length, z.width, alpha >= .3 ? 1 : .45, this.kit === 'wenchou' ? 0xa8603a : 0xb8502f, 0xe4ba78, alpha >= .3);
    }
  }
  /** 沿线移动首领并结算路径伤害；返回本帧位移。 */
  private travel(line: Zone, dt: number, speed: number, damage: number, now: number, key: string) {
    const b = this.h.boss, step = Math.min(line.length - this.travelled, dt * speed); if (step <= 0) return 0;
    b.sprite.x += Math.cos(line.angle) * step; b.sprite.y += Math.sin(line.angle) * step;
    this.impact({...line, x: b.x - Math.cos(line.angle) * step, y: b.y - Math.sin(line.angle) * step, length: step}, now, damage, key);
    this.travelled += step; this.gfx.lineStyle(3, 0xd5b77f, .6).lineBetween(b.x - Math.cos(line.angle) * 35, b.y - Math.sin(line.angle) * 35, b.x, b.y);
    return step;
  }

  update(dt: number, now: number) {
    const b = this.h.boss, p = this.h.player;
    if (!b.active || this.state === 'dead') return;
    this.gfx.clear(); this.at = now;
    if (!this.phase2 && b.hp <= b.maxHp * .5) { this.phase2 = true; this.metrics.rage++; this.state = 'rage'; this.until = now + 650; }
    if (this.state === 'rage') { this.pose(25); this.gfx.lineStyle(2, 0xe1bd77, .7).strokeCircle(b.x, b.y, 40); if (now >= this.until) { this.state = 'approach'; this.next = now + 150; } return; }
    if (this.state === 'approach') {
      const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1, dir = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 1 : 2 : dy < 0 ? 3 : 0;
      if (d > 115) { b.sprite.x += dx / d * b.def.speed * dt; b.sprite.y += dy / d * b.def.speed * dt; }
      this.pose(dir * 4 + (d > 115 ? Math.floor(now / 120) % 4 : 0));
      if (now >= this.next) this.begin(now);
    }
    if (this.state === 'warn') {
      this.pose(this.skill === 2 ? 24 : 17);
      for (const z of this.zones) this.draw(z, .13);
      if (now >= this.until) { this.state = 'attack'; this.until = now + this.attackLen; this.at = now; this.travelled = 0; this.dashEnd = 0; }
    }
    if (this.state === 'attack') {
      const age = this.attackLen - (this.until - now), frames = [18, 19, 20, 22, 23];
      this.pose(frames[Math.min(4, Math.floor(age / 160))]);
      if (this.kit === 'yanliang') this.attackYanliang(dt, now, age); else if (this.kit === 'wenchou') this.attackWenchou(dt, now, age); else this.attackChunyu(now, age);
      if (now >= this.until) { this.state = 'recover'; this.until = now + TIMING.recoverMs; }
    } else if (this.state === 'recover') {
      this.pose(23);
      if (now >= this.until) { this.state = 'approach'; this.next = now + (this.phase2 ? TIMING.rest2 : TIMING.rest); }
    }
  }
  private attackYanliang(dt: number, now: number, age: number) {
    const Y = YANLIANG;
    if (this.skill === 0) {
      const line = this.zones[0], circle = this.zones[1];
      if (this.travelled < line.length) {
        this.travel(line, dt, this.phase2 ? Y.dash.speed2 : Y.dash.speed, Y.dash.damage, now, 'dash'); this.draw(circle, .15);
        if (this.travelled >= line.length) this.dashEnd = age;
      } else if (!circle.done) { circle.done = true; this.metrics.cleave++; this.impact(circle, now, Y.dash.cleaveDamage, 'cleave'); }
      if (circle.done && age - this.dashEnd < 260) this.burst(circle);
    } else if (this.skill === 1) {
      this.zones.forEach((z, i) => { if (age < z.due) { this.draw(z, .15); return; } if (!z.done) { z.done = true; this.impact(z, now, Y.spin.damage, 'spin' + i); } if (age - z.due < 260) this.burst(z); });
    } else {
      this.zones.forEach(z => { if (z.done) return; z.done = true; this.h.spawn('shield', z.x, z.y); this.h.spawn('infantry', z.x + 24, z.y + 16); if (this.phase2) this.h.spawn('archer', z.x - 24, z.y + 16); });
    }
  }
  private attackWenchou(dt: number, now: number, age: number) {
    const W = WENCHOU, b = this.h.boss;
    if (this.skill === 0) {
      const line = this.zones[0];
      if (age < W.feint.backMs) {
        // 后撤（不造成伤害）
        const back = W.feint.back * dt * 1000 / W.feint.backMs;
        b.sprite.x -= Math.cos(line.angle) * back; b.sprite.y -= Math.sin(line.angle) * back; this.draw(line, .15);
      } else if (this.travelled < line.length) this.travel(line, dt, W.feint.speed, W.feint.damage, now, 'feint');
      for (let i = 1; i < this.zones.length; i++) { const z = this.zones[i]; if (age < z.due) { this.draw(z, .15); continue; } if (!z.done) { z.done = true; this.impact(z, now, W.feint.sideDamage, 'side' + i); } if (age - z.due < 220) this.draw(z, .4); }
    } else if (this.skill === 1) {
      this.zones.forEach((z, i) => { if (age < z.due) { this.draw(z, .15); return; } if (!z.done) { z.done = true; this.impact(z, now, W.volley.damage, 'arrow' + i); } if (age - z.due < 200) this.draw(z, .4); });
    } else if (this.lootId >= 0) {
      const line = this.zones[0];
      if (this.travelled < line.length - W.loot.reach) this.travel({...line, length: line.length - W.loot.reach}, dt, W.loot.speed, W.loot.damage, now, 'loot');
      else if (!this.lootDone) {
        this.lootDone = true;
        if (this.h.depots?.loot(this.lootId, now)) {
          this.metrics.looted++; const heal = b.maxHp * (this.phase2 ? GRAIN.lootHeal2 : GRAIN.lootHeal);
          b.hp = Math.min(b.maxHp, b.hp + heal); this.metrics.healed += heal;
          for (let i = 0; i < W.loot.cavalry; i++) this.h.spawn('cavalry', b.x + (i ? 30 : -30), b.y + 24);
        }
      }
    } else {
      this.zones.forEach(z => { if (z.done) return; z.done = true; this.h.spawn('cavalry', z.x, z.y); if (this.phase2) this.h.spawn('archer', z.x + 24, z.y + 16); });
    }
  }
  private attackChunyu(now: number, age: number) {
    const C = CHUNYU;
    if (this.skill === 0) {
      this.zones.forEach(z => { if (z.done) return; z.done = true; this.h.spawn('shield', z.x, z.y); if (this.phase2) this.h.spawn('archer', z.x + 20, z.y + 14); });
    } else {
      const damage = this.skill === 1 ? C.volley.damage : C.catapult.damage;
      this.zones.forEach((z, i) => { if (age < z.due) { this.draw(z, .15); return; } if (!z.done) { z.done = true; this.impact(z, now, damage, (this.skill === 1 ? 'arrows' : 'rock') + i); } if (age - z.due < 260) this.burst(z); });
    }
  }
  private burst(z: Zone) {
    this.draw(z, .4);
    for (let n = 0; n < 6; n++) { const a = n * Math.PI / 3, r0 = Math.max(10, z.inner); this.gfx.lineStyle(2, 0xffdb99, .6).lineBetween(z.x + Math.cos(a) * r0, z.y + Math.sin(a) * r0, z.x + Math.cos(a) * z.radius, z.y + Math.sin(a) * z.radius); }
  }
  defeat() { this.state = 'dead'; this.gfx.clear(); const b = this.h.boss; this.corpse = this.h.scene.add.image(b.x, b.y, this.info.atlas, 28).setDisplaySize(144, 144).setOrigin(.5, 114 / 128).setDepth(28); }
  updateDeath(delta: number) { if (this.corpse) { this.deathMs += delta; this.corpse.setFrame(28 + Math.min(3, Math.floor(this.deathMs / 180))); } }
  clear() { this.gfx.clear(); }
}
