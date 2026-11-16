import Phaser from 'phaser';
import { DEPTH, FONT } from '../config';
import { getCharacter } from '../data/characters';
import { QUALITIES, type ItemQuality } from '../data/items';
import { FOLLOW, TEMPLATES, type FollowerTemplate } from '../data/recruits';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { visualTextureKey } from './ReadableTextures';
import { rankBonus, type Recruit } from './RosterStore';

/**
 * 随行武将（RECRUIT_PLAN.md §4，参考《战锤：幸存者》的随从）：贴着主将站位，自动打主将附近的敌人。
 * - 站位：主将周围 70–140 像素环带，按人数均分角度；离开 260 像素放弃目标回来；超过 480 像素或卡住 2 秒瞬移回身边。
 * - 攻击：四种模板（枪扫一圈 / 刀前方扇形 / 弓单发远射 / 谋延迟火点）。可玩名将暂用与其兵器相近的模板（专属武器跟随版待做，见计划）。
 * - 受伤：每 0.4 秒结算贴身敌人的接触伤害（首领 ×3）；倒下撤下休整 20 秒后在主将身边归队，不会本局阵亡。
 * - 不进后备兵编制，不占同屏敌人名额；目标查找走空间网格，每人每 0.15 秒最多查一次。
 * 美术：可玩名将用自己的行走图；史事名将 / 大众脸用蜀军兵种行走图（程序化过渡）+ 头顶品质色名牌。
 */
type Query = (x: number, y: number, r: number) => Enemy[];
type Hit = (enemy: Enemy, damage: number, fire: boolean) => void;
interface Fx { kind: FollowerTemplate | 'arrow'; x: number; y: number; tx: number; ty: number; angle: number; at: number; until: number; hitAt?: number; damage?: number; owner?: Follower }

const QUALITY_POWER: Record<ItemQuality, number> = { white: 1, green: 1.15, blue: 1.3, purple: 1.5, orange: 1.6 };
const TROOP_SHEET: Record<FollowerTemplate, string> = { spear: 'shu_spearman_walk_sheet', blade: 'shu_swordsman_walk_sheet', bow: 'shu_archer_walk_sheet', strategist: 'shu_archer_walk_sheet' };
const heroSheet = (id: string) => id === 'zhaoyun' ? 'hero_walk_sheet' : `${id}_walk_sheet`;

export class Follower {
  hp = 1; maxHp = 1; cooldown = 0; restUntil = 0; target: Enemy | null = null; nextQuery = 0; nextContact = 0;
  slot = 0; dir: 'down' | 'up' | 'left' | 'right' = 'down'; walk = 0; stuckAt = 0; lastX = 0; lastY = 0; hurtUntil = 0; downs = 0; kills = 0; hits = 0;
  readonly sprite: Phaser.GameObjects.Image; readonly shadow: Phaser.GameObjects.Ellipse; readonly label: Phaser.GameObjects.Text; readonly bar: Phaser.GameObjects.Graphics;
  readonly sheet: string; readonly template: FollowerTemplate; readonly damage: number; readonly speedMul: number;
  constructor(readonly scene: Phaser.Scene, readonly recruit: Recruit, x: number, y: number, leaderLevelHp: number) {
    this.template = recruit.template;
    const t = TEMPLATES[this.template], b = rankBonus(recruit), hero = recruit.hero ? getCharacter(recruit.hero) : null, q = QUALITY_POWER[recruit.quality];
    const own = hero ? heroSheet(hero.id) : '';
    this.sheet = own && scene.textures.exists(own) ? own : scene.textures.exists(TROOP_SHEET[this.template]) ? TROOP_SHEET[this.template] : 'hero_walk_sheet';
    this.damage = t.damage * q * (hero?.damageMul ?? 1) * (1 + b.damage);
    this.maxHp = Math.round(t.hp * q * (hero?.hpMul ?? 1) * (1 + b.hp) * leaderLevelHp); this.hp = this.maxHp;
    this.speedMul = t.speed * (hero?.speedMul ?? 1);
    this.cooldown = .3 + Math.random() * .4;
    this.shadow = scene.add.ellipse(x, y + 2, 34, 12, 0x000000, .28).setDepth(DEPTH.player - 2);
    this.sprite = scene.add.image(x, y, visualTextureKey(scene, this.sheet), 'down_0').setOrigin(.5, .86).setDepth(DEPTH.player - 1);
    const fh = this.sprite.frame.height || 96; this.sprite.setScale(70 / fh);
    if (!hero && this.sheet === 'hero_walk_sheet') this.sprite.setTint(QUALITIES[recruit.quality].color);
    this.label = scene.add.text(x, y - 66, recruit.name.replace(/（.*）/, ''), { fontFamily: FONT, fontSize: '13px', color: QUALITIES[recruit.quality].css, resolution: 2 }).setOrigin(.5).setDepth(DEPTH.player + 1).setStroke('#120c06', 3);
    this.bar = scene.add.graphics().setDepth(DEPTH.player + 1);
    this.lastX = x; this.lastY = y;
  }
  get x() { return this.sprite.x; } get y() { return this.sprite.y; }
  get resting() { return this.restUntil > 0; }
  setVisible(on: boolean) { this.sprite.setVisible(on); this.shadow.setVisible(on); this.label.setVisible(on); this.bar.setVisible(on); }
  place(x: number, y: number) { this.sprite.setPosition(x, y); this.lastX = x; this.lastY = y; }
  destroy() { this.sprite.destroy(); this.shadow.destroy(); this.label.destroy(); this.bar.destroy(); }
}

export class FollowerSquad {
  readonly members: Follower[] = [];
  private readonly fx: Fx[] = [];
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly buf: Enemy[] = [];
  /** 统计（测试 / 平衡用）。 */
  readonly stats = { damage: 0, hits: 0, teleports: 0, downs: 0, maxDist: 0 };
  constructor(private readonly scene: Phaser.Scene, private readonly player: Player, recruits: Recruit[], private readonly query: Query, private readonly hit: Hit, private readonly leaderDamage: () => number) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.fx);
    const n = recruits.length;
    recruits.forEach((r, i) => { const a = this.slotAngle(i, n), f = new Follower(scene, r, player.x + Math.cos(a) * 100, player.y + Math.sin(a) * 100, 1); f.slot = i; this.members.push(f); });
  }
  private slotAngle(i: number, n: number) { return Math.PI / 2 + (i + .5) * Math.PI * 2 / Math.max(1, n) + Math.PI / Math.max(1, n); }

  update(dt: number, now: number): void {
    const p = this.player, n = this.members.length, dmgShare = 1 + FOLLOW.shareLeaderDamage * (Math.max(.2, this.leaderDamage()) - 1);
    this.gfx.clear();
    for (const f of this.members) {
      if (f.resting) {
        if (now < f.restUntil) continue;
        f.restUntil = 0; f.hp = f.maxHp; const a = this.slotAngle(f.slot, n); f.place(p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90); f.setVisible(true); f.sprite.setAlpha(0); this.scene.tweens.add({ targets: f.sprite, alpha: 1, duration: 300 });
      }
      const dist = Math.hypot(f.x - p.x, f.y - p.y);
      // 瞬移：太远或卡住
      if (dist > FOLLOW.teleport || (f.stuckAt && now - f.stuckAt > FOLLOW.stuckMs)) {
        const a = this.slotAngle(f.slot, n); f.place(p.x + Math.cos(a) * 100, p.y + Math.sin(a) * 100); f.stuckAt = 0; f.target = null; this.stats.teleports++;
        f.sprite.setAlpha(.2); this.scene.tweens.add({ targets: f.sprite, alpha: 1, duration: 260 });
      }
      // 索敌：以主将为中心
      if (f.target && (!f.target.active || Math.hypot(f.target.x - p.x, f.target.y - p.y) > FOLLOW.leash)) f.target = null;
      if (!f.target && now >= f.nextQuery) { f.nextQuery = now + 150; f.target = this.nearest(p.x, p.y, FOLLOW.aggro, f.x, f.y); }
      const t = TEMPLATES[f.template], speed = Math.max(200, p.speed) * f.speedMul * FOLLOW.chaseMul;
      let gx: number, gy: number;
      if (f.target) {
        const d = Math.hypot(f.target.x - f.x, f.target.y - f.y), want = t.range * .8;
        if (d > want) { gx = f.target.x - (f.target.x - f.x) / d * want; gy = f.target.y - (f.target.y - f.y) / d * want; } else { gx = f.x; gy = f.y; }
        // 不离主将超过拉回距离
        const lx = gx - p.x, ly = gy - p.y, ld = Math.hypot(lx, ly); if (ld > FOLLOW.leash - 20) { gx = p.x + lx / ld * (FOLLOW.leash - 20); gy = p.y + ly / ld * (FOLLOW.leash - 20); }
      } else {
        const a = this.slotAngle(f.slot, n) + Math.sin(now / 1800 + f.slot) * .25, r = (FOLLOW.ringMin + FOLLOW.ringMax) / 2;
        gx = p.x + Math.cos(a) * r; gy = p.y + Math.sin(a) * r;
        const ringD = Math.hypot(f.x - p.x, f.y - p.y); if (ringD >= FOLLOW.ringMin && ringD <= FOLLOW.ringMax && Math.hypot(gx - f.x, gy - f.y) < 40) { gx = f.x; gy = f.y; }
      }
      this.move(f, gx, gy, dt, speed, now);
      // 攻击
      f.cooldown -= dt;
      if (f.target && f.cooldown <= 0 && Math.hypot(f.target.x - f.x, f.target.y - f.y) <= t.range) { f.cooldown = t.cooldown / 1000; this.attack(f, f.target, now, f.damage * dmgShare); }
      // 接触伤害
      if (now >= f.nextContact) {
        f.nextContact = now + 400; let dmg = 0;
        for (const e of this.query(f.x, f.y, 26)) if (e.active && Math.hypot(e.x - f.x, e.y - f.y) < 22 + (e.def.radius ?? 14)) dmg += e.def.damage * (e.kind === 'boss' ? FOLLOW.bossMul : 1);
        if (dmg > 0) this.hurt(f, dmg, now);
      }
      this.render(f, now);
      this.stats.maxDist = Math.max(this.stats.maxDist, Math.hypot(f.x - p.x, f.y - p.y));
    }
    this.updateFx(now);
  }
  /** 外部伤害（首领技能等）。 */
  hurt(f: Follower, damage: number, now: number): void {
    if (f.resting) return;
    f.hp -= damage; f.hurtUntil = now + 140;
    if (f.hp <= 0) { f.hp = 0; f.restUntil = now + FOLLOW.restMs; f.downs++; this.stats.downs++; f.target = null; f.setVisible(false); this.puff(f.x, f.y, now); }
  }
  private nearest(cx: number, cy: number, r: number, fx: number, fy: number): Enemy | null {
    this.buf.length = 0; let best: Enemy | null = null, bd = Infinity;
    for (const e of this.query(cx, cy, r, )) { if (!e.active || e.invulnerable) continue; const d = (e.x - fx) ** 2 + (e.y - fy) ** 2; if (d < bd) { bd = d; best = e; } }
    return best;
  }
  private move(f: Follower, gx: number, gy: number, dt: number, speed: number, now: number) {
    const dx = gx - f.x, dy = gy - f.y, d = Math.hypot(dx, dy);
    if (d > 3) {
      const step = Math.min(d - 2, speed * dt);
      f.sprite.setPosition(f.x + dx / d * step, f.y + dy / d * step); f.walk += step;
      f.dir = Math.abs(dx) > Math.abs(dy) * 1.1 ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down';
      // 卡住检测：想走但 2 秒内几乎没动（被障碍挡住等）
      if (Math.hypot(f.x - f.lastX, f.y - f.lastY) > 6) { f.lastX = f.x; f.lastY = f.y; f.stuckAt = 0; } else if (!f.stuckAt) f.stuckAt = now;
    } else { f.stuckAt = 0; f.lastX = f.x; f.lastY = f.y; f.walk = 0; }
  }
  private attack(f: Follower, e: Enemy, now: number, damage: number) {
    const a = Math.atan2(e.y - f.y, e.x - f.x);
    f.dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? Math.cos(a) < 0 ? 'left' : 'right' : Math.sin(a) < 0 ? 'up' : 'down';
    const deal = (x: Enemy, n: number, fire = false) => { this.hit(x, n, fire); this.stats.damage += n; this.stats.hits++; f.hits++; };
    if (f.template === 'spear') {
      let k = 0; for (const x of this.query(f.x, f.y, TEMPLATES.spear.range)) { if (k >= 6) break; if (x.active && Math.hypot(x.x - f.x, x.y - f.y) <= TEMPLATES.spear.range) { deal(x, damage); k++; } }
      this.fx.push({ kind: 'spear', x: f.x, y: f.y, tx: 0, ty: 0, angle: a, at: now, until: now + 220 });
    } else if (f.template === 'blade') {
      let k = 0; const R = TEMPLATES.blade.range;
      for (const x of this.query(f.x, f.y, R)) { if (k >= 6) break; if (!x.active) continue; const d = Math.hypot(x.x - f.x, x.y - f.y), da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(x.y - f.y, x.x - f.x) - a)); if (d <= R && (da < .9 || d < 26)) { deal(x, damage); k++; } }
      this.fx.push({ kind: 'blade', x: f.x, y: f.y, tx: 0, ty: 0, angle: a, at: now, until: now + 200 });
    } else if (f.template === 'bow') {
      deal(e, damage); this.fx.push({ kind: 'arrow', x: f.x, y: f.y - 30, tx: e.x, ty: e.y - 20, angle: a, at: now, until: now + 140 });
    } else {
      this.fx.push({ kind: 'strategist', x: e.x, y: e.y, tx: e.x, ty: e.y, angle: a, at: now, until: now + 620, hitAt: now + 320, damage, owner: f });
    }
  }
  private updateFx(now: number) {
    const g = this.gfx;
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const fx = this.fx[i], k = Math.min(1, (now - fx.at) / (fx.until - fx.at));
      if (fx.hitAt && now >= fx.hitAt && fx.damage !== undefined) {
        let n = 0; for (const x of this.query(fx.tx, fx.ty, 48)) { if (n >= 8) break; if (x.active && Math.hypot(x.x - fx.tx, x.y - fx.ty) <= 48) { this.hit(x, fx.damage, true); this.stats.damage += fx.damage; this.stats.hits++; if (fx.owner) fx.owner.hits++; n++; } }
        fx.hitAt = undefined;
      }
      if (now >= fx.until) { this.fx.splice(i, 1); continue; }
      if (fx.kind === 'spear') { g.lineStyle(4, 0xe8f2ff, .8 * (1 - k)); g.beginPath(); g.arc(fx.x, fx.y - 16, TEMPLATES.spear.range * (.6 + .4 * k), fx.angle - 2.4 * k - .6, fx.angle + .6); g.strokePath(); }
      else if (fx.kind === 'blade') { g.lineStyle(5, 0xffe2a8, .85 * (1 - k)); g.beginPath(); g.arc(fx.x, fx.y - 16, TEMPLATES.blade.range * .8, fx.angle - .9, fx.angle - .9 + 1.8 * Math.min(1, k * 1.6)); g.strokePath(); }
      else if (fx.kind === 'arrow') { const hx = fx.x + (fx.tx - fx.x) * k, hy = fx.y + (fx.ty - fx.y) * k; g.lineStyle(2, 0xfff1c8, .9); g.lineBetween(hx - Math.cos(fx.angle) * 18, hy - Math.sin(fx.angle) * 18, hx, hy); }
      else { const pre = fx.hitAt !== undefined; g.fillStyle(pre ? 0xff8a3a : 0xffb347, pre ? .25 + .25 * k : .5 * (1 - k)); g.fillCircle(fx.tx, fx.ty, pre ? 48 * (.4 + .6 * k) : 48); if (pre) { g.lineStyle(2, 0xffc070, .7); g.strokeCircle(fx.tx, fx.ty, 48); } }
    }
  }
  private puff(x: number, y: number, now: number) { this.fx.push({ kind: 'spear', x, y, tx: 0, ty: 0, angle: 0, at: now, until: now + 300 }); }
  private render(f: Follower, now: number) {
    const moving = f.walk > 0, frame = moving ? Math.floor(f.walk / 14) % 4 : 0, key = visualTextureKey(this.scene, f.sheet), name = `${f.dir}_${frame}`;
    if (this.scene.textures.get(key).has(name) && (f.sprite.frame.name !== name || f.sprite.texture.key !== key)) f.sprite.setTexture(key, name);
    if (now < f.hurtUntil) f.sprite.setTintFill(0xffd0c0); else if (f.sprite.tintFill) { f.sprite.clearTint(); if (!f.recruit.hero && f.sheet === 'hero_walk_sheet') f.sprite.setTint(QUALITIES[f.recruit.quality].color); }
    f.shadow.setPosition(f.x, f.y + 2); f.label.setPosition(f.x, f.y - 66);
    f.sprite.setDepth(DEPTH.player - 1 + f.y / 100000);
    const w = 36, r = Math.max(0, f.hp / f.maxHp); f.bar.clear();
    if (r < 1) { f.bar.fillStyle(0x1a0f08, .8).fillRect(f.x - w / 2, f.y - 58, w, 4); f.bar.fillStyle(r > .4 ? 0x6fd06a : 0xe0603a, 1).fillRect(f.x - w / 2, f.y - 58, w * r, 4); }
  }
  clear(): void { for (const f of this.members) f.destroy(); this.members.length = 0; this.fx.length = 0; this.gfx.destroy(); }
}
