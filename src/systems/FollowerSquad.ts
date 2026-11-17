import Phaser from 'phaser';
import { heroAttrs, heroLevel, type HeroKey } from './HeroProgress';
import { DEPTH, FONT } from '../config';
import { getCharacter } from '../data/characters';
import { QUALITIES, type ItemQuality } from '../data/items';
import { FOLLOW, TEMPLATES, type FollowerTemplate } from '../data/recruits';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { visualTextureKey } from './ReadableTextures';
import { HINT_MOCK, groundScar } from '../ui/HintStyle';
import { rankBonus, type Recruit } from './RosterStore';
import { loadout, type GearOwner } from './ItemStore';
import { emptyGear, gearFromItems, type GearStats } from './ItemEffects';
import type { ItemInstance } from '../data/items';

/**
 * 随行武将（RECRUIT_PLAN.md §4，参考《战锤：幸存者》的随从）：一直紧贴主公，不离阵去追敌人。
 * - 阵位：主公身后固定阵位（1 人正后；2 人左后 / 右后；3 人左后 / 右后 / 正后），离主公约 56 像素，随主公移动方向平滑转动；
 *   用指数平滑追阵位（几乎同步，不抖、不滑步），不做碰撞，不会被敌人卡住；偏离超过 160 像素直接归位。
 * - 攻击：只打自己射程内的敌人；近战（枪 / 刀）出手时朝目标前出 22 像素，随后自动回位。四种模板（枪扫一圈 / 刀前方扇形 / 弓单发远射 / 谋延迟火点）。可玩名将暂用与其兵器相近的模板（专属武器跟随版待做，见计划）。
 * - 受伤：每 0.4 秒结算贴身敌人的接触伤害（首领 ×3）；倒下撤下休整 20 秒后在主将身边归队，不会本局阵亡。
 * - 不进后备兵编制，不占同屏敌人名额；目标查找走空间网格，每人每 0.15 秒最多查一次。
 * 美术：可玩名将用自己的行走图；史事名将 / 大众脸用蜀军兵种行走图（程序化过渡）+ 头顶品质色名牌。
 */
type Query = (x: number, y: number, r: number) => Enemy[];
type Hit = (enemy: Enemy, damage: number, fire: boolean) => void;
interface Fx { kind: FollowerTemplate | 'arrow'; x: number; y: number; tx: number; ty: number; angle: number; at: number; until: number; hitAt?: number; damage?: number; owner?: Follower; scar?: boolean }

const QUALITY_POWER: Record<ItemQuality, number> = { white: 1, green: 1.15, blue: 1.3, purple: 1.5, orange: 1.6 };
const TROOP_SHEET: Record<FollowerTemplate, string> = { spear: 'shu_spearman_walk_sheet', blade: 'shu_swordsman_walk_sheet', bow: 'shu_archer_walk_sheet', strategist: 'shu_archer_walk_sheet' };
const heroSheet = (id: string) => id === 'zhaoyun' ? 'hero_walk_sheet' : `${id}_walk_sheet`;

export class Follower {
  hp = 1; maxHp = 1; cooldown = 0; restUntil = 0; target: Enemy | null = null; nextQuery = 0; nextContact = 0;
  slot = 0; dir: 'down' | 'up' | 'left' | 'right' = 'down'; walk = 0; lastX = 0; lastY = 0; hurtUntil = 0; downs = 0; kills = 0; hits = 0;
  /** 近战前出的偏移（出手时设、之后衰减回 0）与面向目标的时限。 */
  lx = 0; ly = 0; faceUntil = 0;
  /** 可玩名将随行：本命武器执行器（战斗场景 createFollowerWeapon 提供）、武器等级、伤害 / 冷却倍率。没有执行器时用模板攻击。 */
  weaponRun: ((dt: number, now: number) => void) | null = null; weaponLevel = 1; weaponDamageMul = 1; weaponCooldownMul = 1;
  readonly sprite: Phaser.GameObjects.Image; readonly shadow: Phaser.GameObjects.Ellipse; readonly label: Phaser.GameObjects.Text; readonly bar: Phaser.GameObjects.Graphics;
  readonly sheet: string; readonly template: FollowerTemplate; readonly damage: number; readonly speedMul: number; readonly haste: number; readonly gear: GearStats; level: number;
  constructor(readonly scene: Phaser.Scene, readonly recruit: Recruit, x: number, y: number, leaderLevelHp: number) {
    this.template = recruit.template;
    const t = TEMPLATES[this.template], b = rankBonus(recruit), hero = recruit.hero ? getCharacter(recruit.hero) : null, q = QUALITY_POWER[recruit.quality];
    const own = hero ? heroSheet(hero.id) : '';
    this.sheet = own && scene.textures.exists(own) ? own : scene.textures.exists(TROOP_SHEET[this.template]) ? TROOP_SHEET[this.template] : 'hero_walk_sheet';
    // 自己身上的兵装（行囊里给这名武将穿的，不叠到主将身上；招来的 r_ 武将不骑马）
    let g = emptyGear(); try { g = gearFromItems(Object.values(loadout((recruit.hero ?? recruit.id) as GearOwner)).filter((i): i is ItemInstance => !!i)); } catch { /* 行囊不可用 */ }
    this.gear = g;
    // 武将等级：可玩名将用自己加过的属性点（武力 / 体魄），招来的 r_ 武将按等级直接成长
    let dmgLv = 1, hpLv = 1; this.level = 1;
    try { const key = (recruit.hero ?? recruit.id) as HeroKey; this.level = heroLevel(key);
      if (recruit.hero) { const a = heroAttrs(key); dmgLv = 1 + FOLLOW.mightDamage * a.might; hpLv = 1 + FOLLOW.constitutionHp * a.constitution; }
      else { dmgLv = 1 + FOLLOW.levelDamage * Math.max(0, this.level - 1); hpLv = 1 + FOLLOW.levelHp * Math.max(0, this.level - 1); } } catch { /* 等级存档不可用 */ }
    this.damage = t.damage * q * (hero?.damageMul ?? 1) * (1 + b.damage) * (1 + g.damage) * (1 + g.crit) * dmgLv;
    this.maxHp = Math.round(t.hp * q * (hero?.hpMul ?? 1) * (1 + b.hp) * (1 + g.hp) * hpLv * leaderLevelHp); this.hp = this.maxHp;
    this.speedMul = t.speed * (hero?.speedMul ?? 1) * (1 + g.move);
    this.haste = (1 + b.haste) * (1 + g.attackSpeed);
    if (hero) {
      this.weaponLevel = Math.max(1, FOLLOW.weaponLevelAt.filter(lv => this.level >= lv).length);
      this.weaponDamageMul = FOLLOW.heroDamageMul * hero.damageMul * (1 + b.damage) * (1 + g.damage) * (1 + g.crit) * dmgLv;
      this.weaponCooldownMul = FOLLOW.heroCooldownMul / this.haste;
    }
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
  /** 当前吃主将全局伤害加成的倍率（本命武器结算时用）。 */
  share = 1;
  /** 本命武器命中时记账（测试 / 平衡用）。 */
  credit(f: Follower, damage: number): void { this.stats.damage += damage; this.stats.hits++; f.hits++; }
  /** 阵位朝向（给本命武器的 heading 用）。 */
  get facing(): number { return this.heading; }
  /** 阵位朝向（主公移动方向，平滑后；起始朝下）。 */
  private heading = Math.PI / 2; private px = NaN; private py = NaN;
  /** 主公速度（平滑后）：追阵位时提前量（前馈），匀速跑动时不落后。 */
  private vx = 0; private vy = 0;
  constructor(private readonly scene: Phaser.Scene, private readonly player: Player, recruits: Recruit[], private readonly query: Query, private readonly hit: Hit, private readonly leaderDamage: () => number) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.fx);
    const n = recruits.length;
    recruits.forEach((r, i) => { const s = this.slotPos(i, n), f = new Follower(scene, r, s.x, s.y, 1); f.slot = i; this.members.push(f); });
    // 可玩名将用本命武器（场景支持时）；测试面板与正式出征共用这里
    const make = (scene as { createFollowerWeapon?: (f: Follower, squad: FollowerSquad) => ((dt: number, now: number) => void) | null }).createFollowerWeapon;
    if (make) for (const f of this.members) if (f.recruit.hero) f.weaponRun = make.call(scene, f, this);
  }
  /** 阵位相对主公后方的角度偏移：1 人正后；2 人左后 / 右后；3 人左后 / 右后 / 正后。 */
  private static readonly OFFSETS: readonly (readonly number[])[] = [[0], [0], [-.8, .8], [-1, 1, 0]];
  private slotPos(i: number, n: number): { x: number; y: number } {
    const offs = FollowerSquad.OFFSETS[Math.min(3, Math.max(1, n))], a = this.heading + Math.PI + (offs[i] ?? 0), r = FOLLOW.slotRadius * (offs[i] === 0 && n === 3 ? 1.15 : 1);
    return { x: this.player.x + Math.cos(a) * r, y: this.player.y + Math.sin(a) * r };
  }

  update(dt: number, now: number): void {
    const p = this.player, n = this.members.length, dmgShare = 1 + FOLLOW.shareLeaderDamage * (Math.max(.2, this.leaderDamage()) - 1); this.share = dmgShare;
    this.gfx.clear();
    for (const f of this.members) {
      if (f.resting) {
        if (now < f.restUntil) continue;
        f.restUntil = 0; f.hp = f.maxHp; const s = this.slotPos(f.slot, n); f.place(s.x, s.y); f.lx = f.ly = 0; f.setVisible(true); f.sprite.setAlpha(0); this.scene.tweens.add({ targets: f.sprite, alpha: 1, duration: 300 });
      }
      // 阵位 + 近战前出偏移（指数衰减回位）
      const decay = Math.exp(-8 * dt); f.lx *= decay; f.ly *= decay;
      const s = this.slotPos(f.slot, n), lead = 1 / FOLLOW.followK, gx = s.x + f.lx + this.vx * lead, gy = s.y + f.ly + this.vy * lead;
      if (Math.hypot(gx - f.x, gy - f.y) > FOLLOW.snap) { f.place(gx, gy); f.target = null; this.stats.teleports++; f.sprite.setAlpha(.3); this.scene.tweens.add({ targets: f.sprite, alpha: 1, duration: 220 }); }
      this.move(f, gx, gy, dt, now);
      // 可玩名将：本命武器自己找目标、出手（以随行为发射源）
      if (f.weaponRun) { f.weaponRun(dt, now); }
      else {
      // 索敌：只找自己射程内的敌人，不离阵去追
      const t = TEMPLATES[f.template];
      if (f.target && (!f.target.active || Math.hypot(f.target.x - f.x, f.target.y - f.y) > t.range)) f.target = null;
      if (!f.target && now >= f.nextQuery) { f.nextQuery = now + 150; f.target = this.nearest(f.x, f.y, t.range, f.x, f.y); }
      // 攻击
      f.cooldown -= dt;
      if (f.target && f.cooldown <= 0) {
        f.cooldown = t.cooldown / 1000 / f.haste; this.attack(f, f.target, now, f.damage * dmgShare); f.faceUntil = now + 320;
        if (f.template === 'spear' || f.template === 'blade') { const a = Math.atan2(f.target.y - f.y, f.target.x - f.x); f.lx = Math.cos(a) * FOLLOW.lunge; f.ly = Math.sin(a) * FOLLOW.lunge; }
      }
      }
      if (f.gear.regen > 0) f.hp = Math.min(f.maxHp, f.hp + f.gear.regen * dt);
      // 接触伤害
      if (now >= f.nextContact) {
        f.nextContact = now + 400; let dmg = 0;
        for (const e of this.query(f.x, f.y, 26)) if (e.active && Math.hypot(e.x - f.x, e.y - f.y) < 22 + (e.def.radius ?? 14)) dmg += e.def.damage * (e.kind === 'boss' ? FOLLOW.bossMul : 1);
        if (dmg > 0) this.hurt(f, dmg, now);
      }
      this.render(f, now);
      this.stats.maxDist = Math.max(this.stats.maxDist, Math.hypot(f.x - p.x, f.y - p.y));
    }
    // 阵位朝向：跟主公的移动方向平滑转动（停下时保持）
    if (Number.isFinite(this.px) && dt > 0) { const mx = p.x - this.px, my = p.y - this.py, kv = 1 - Math.exp(-10 * dt), jump = Math.hypot(mx, my) > 60; this.vx = jump ? 0 : this.vx + (mx / dt - this.vx) * kv; this.vy = jump ? 0 : this.vy + (my / dt - this.vy) * kv; if (Math.hypot(mx, my) > .4) { const to = Math.atan2(my, mx), d = Phaser.Math.Angle.Wrap(to - this.heading); this.heading += d * (1 - Math.exp(-FOLLOW.turnRate * dt)); } }
    this.px = p.x; this.py = p.y;
    this.updateFx(now);
  }
  /** 外部伤害（首领技能等）。 */
  hurt(f: Follower, damage: number, now: number): void {
    if (f.resting) return;
    f.hp -= damage * Math.max(0, 1 - f.gear.reduce); f.hurtUntil = now + 140;
    if (f.hp <= 0) { f.hp = 0; f.restUntil = now + FOLLOW.restMs; f.downs++; this.stats.downs++; f.target = null; f.setVisible(false); this.puff(f.x, f.y, now); }
  }
  private nearest(cx: number, cy: number, r: number, fx: number, fy: number): Enemy | null {
    this.buf.length = 0; let best: Enemy | null = null, bd = Infinity;
    for (const e of this.query(cx, cy, r, )) { if (!e.active || e.invulnerable) continue; const d = (e.x - fx) ** 2 + (e.y - fy) ** 2; if (d < bd) { bd = d; best = e; } }
    return best;
  }
  /** 指数平滑追阵位（与帧率无关），走路距离推动行走帧，朝向跟随移动方向（出手后短时间朝向目标）。 */
  private move(f: Follower, gx: number, gy: number, dt: number, now: number) {
    const k = 1 - Math.exp(-FOLLOW.followK * dt), dx = (gx - f.x) * k, dy = (gy - f.y) * k, step = Math.hypot(dx, dy);
    f.sprite.setPosition(f.x + dx, f.y + dy);
    if (step > .25) {
      f.walk += step;
      if (now >= f.faceUntil && step > .6) { const horiz = f.dir === 'left' || f.dir === 'right', useX = horiz ? Math.abs(dx) * 1.2 >= Math.abs(dy) : Math.abs(dx) > Math.abs(dy) * 1.2; f.dir = useX ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down'; }
    } else f.walk = 0;
    f.lastX = f.x; f.lastY = f.y;
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
      else if (HINT_MOCK) { if (HINT_MOCK === 'b' && fx.hitAt === undefined && !fx.scar) { fx.scar = true; groundScar(this.scene, fx.tx, fx.ty, 48, 'fire'); } }
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
