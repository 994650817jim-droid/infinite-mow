/**
 * 3-2 宛城夜袭「典韦守营」（剧情 story-ch03.md 第五节，用户 2026-11-17 批准）：
 * 后营寨门站一名友军典韦（不可操作，原地挥双戟），有血条；约四成敌兵改打他（ThirdGameScene.customEnemyStep 按 lures 改目标）。
 * 张绣倒下时典韦还活着 → 旗标 dianwei = saved（军功 +80）；典韦血空 → 倒地 + 横幅「典韦力战而死」，不判负，战斗继续 → dianwei = fell。
 * 数值都是初值（交平衡会话）。
 * 11-19 用户「这一关有很多bug……穿模」：
 *  - 典韦有身体（半径 body）：贴上来的敌兵 / 友军被推开，不再一群人站在他身上；
 *  - 友军名牌（碧色「典韦」）+ 血条；军令面板「保护典韦」（带舆图位置 → 舆图军令旗、屏外箭头）；
 *  - 朝最近的敌人站；挥戟时播攻击帧（专属双戟图 dianwei_walk / dianwei_attack 到位就用，否则友军刀兵图放大占位）。
 */
import Phaser from 'phaser';
import { DEPTH, FONT, actorDepth } from '../config';
import type { Enemy } from '../entities/Enemy';
import { playSheet } from './SkillFxSheets';
import { ordersOf } from './BattleOrders';
import { ART_V2_FILES, isV2Texture, regridV2 } from './ArtStyle';

export const DIANWEI = {
  hp: 1500,
  /** 双戟：每 swingMs 打身边 swingRadius 一圈，每个敌人 swingDamage */
  swingMs: 1200, swingDamage: 30, swingRadius: 80,
  /** 约这么多比例的敌兵（按出生编号）改打典韦 */
  lureShare: .4,
  /** 贴身敌兵的接触伤害倍率与间隔（秒） */
  contactMul: .6, contactCd: .9,
  /** 站位：主将出生点正后方（后营寨门） */
  offsetY: 220,
  /** 救下典韦的军功 */
  meritSaved: 80,
  /** 身体半径：别的单位进不来（防穿模） */
  body: 26,
  /** 显示高度 = 主将 × heightMul（比主将高大） */
  heightMul: 1.35,
  /** 挥戟攻击帧时长（4 帧） */
  attackMs: 380,
  /** 专属双戟图显示倍率（同首领 v2：格 288 × 0.5） */
  artScale: .5,
} as const;

/** 专属双戟图（v2 4×4：行 下 / 左 / 右 / 上）；没有就用友军刀兵图占位。 */
const ART = { walk: 'dianwei_walk', attack: 'dianwei_attack' } as const;
const FALLBACK = { walk: 'shu_swordsman_walk_sheet', attack: 'shu_swordsman_attack_sheet' } as const;
type Dir = 'down' | 'left' | 'right' | 'up';
const PLATE = { w: 64, h: 6, color: 0x5fd27a, back: 0x13200f, nameColor: '#b8f5c4' } as const;

export interface DianweiHost {
  scene: Phaser.Scene; player: { x: number; y: number; sprite: { displayHeight: number } };
  enemies: () => readonly Enemy[];
  /** 友军兵（推开用，可选） */
  allies?: () => ReadonlyArray<{ x: number; y: number; active: boolean; setPosition(x: number, y: number): void }>;
  /** 典韦打敌人（算友军伤害） */
  hit: (e: Enemy, damage: number) => void;
  banner: (title: string, danger: boolean, caption?: string) => void;
}

export class DianweiGuard {
  hp: number = DIANWEI.hp; down = false; readonly x: number; readonly y: number;
  private readonly img: Phaser.GameObjects.Image; private readonly label: Phaser.GameObjects.Text; private readonly bar: Phaser.GameObjects.Graphics;
  private nextSwing = 0; private hurtFlashUntil = 0; private attackUntil = 0; private dir: Dir = 'up'; private targetH: number; private barY = 0;
  /** 测试用 */
  readonly stats = { swings: 0, hurt: 0, pushed: 0, attackFrames: 0 };
  constructor(private readonly h: DianweiHost, now: number) {
    this.x = h.player.x; this.y = h.player.y + DIANWEI.offsetY;
    const sc = h.scene;
    this.targetH = (h.player.sprite.displayHeight || 96) * DIANWEI.heightMul;
    this.img = sc.add.image(this.x, this.y, this.walkKey(), 'up_0').setOrigin(.5, .88).setName('dianwei-guard').setDepth(actorDepth(this.y));
    this.fit();
    this.label = sc.add.text(this.x, 0, '典韦', { fontFamily: FONT, fontSize: '13px', color: PLATE.nameColor, resolution: 2 }).setOrigin(.5, 1).setStroke('#0d1a0c', 4).setDepth(DEPTH.hud - 1).setName('dianwei-label');
    this.bar = sc.add.graphics().setDepth(DEPTH.hud - 1).setName('dianwei-hpbar');
    this.nextSwing = now + DIANWEI.swingMs;
    this.loadArt();
    ordersOf(sc)?.set('dianwei', { label: '保护典韦', kind: 'side', detail: '守住后营寨门', progress: { cur: this.hp, max: DIANWEI.hp }, at: () => this.down ? null : { x: this.x, y: this.y } });
    this.refresh();
  }
  private walkKey(): string { const s = this.h.scene.textures; return s.exists(ART.walk) ? ART.walk : s.exists(FALLBACK.walk) ? FALLBACK.walk : 'hero_walk_sheet'; }
  private attackKey(): string | null { const s = this.h.scene.textures; return s.exists(ART.attack) ? ART.attack : s.exists(ART.walk) ? null : s.exists(FALLBACK.attack) ? FALLBACK.attack : null; }
  /** 按帧高缩到 targetH（换贴图后重算）。 */
  private fit(): void {
    // 专属图按首领 v2 标准（格 288、人高约 216）显示 ×0.5；占位图按主将身高 ×heightMul 缩放
    if (this.img.texture.key === ART.walk) this.img.setScale(DIANWEI.artScale); else { const fh = this.img.frame.height || 96; this.img.setScale(this.targetH / fh); }
    this.barY = this.y - this.img.displayHeight * (this.img.texture.key === ART.walk ? .8 : .88) - 4;
  }
  /** 专属双戟图在 ART_V2_FILES 里登记了才载（图还没到就一直用占位）。 */
  private loadArt(): void {
    const sc = this.h.scene; let n = 0;
    for (const k of [ART.walk, ART.attack]) if (ART_V2_FILES[k] && isV2Texture(k) && !sc.textures.exists(k)) { sc.load.once(`filecomplete-image-${k}`, () => { regridV2(sc, k); if (k === ART.walk && this.img.active) { this.img.setTexture(k, `${this.dir}_0`); this.fit(); this.refresh(); } }); sc.load.image(k, ART_V2_FILES[k]); n++; }
    if (n && !sc.load.isLoading()) sc.load.start();
  }
  get alive(): boolean { return !this.down; }
  /** 这名敌兵是否改打典韦（约四成，按出生编号固定）。 */
  lures(e: Enemy): boolean { return !this.down && e.kind !== 'boss' && !e.isSupplySlot && e.spawnId % 10 < DIANWEI.lureShare * 10; }
  hurt(d: number, now: number): void {
    if (this.down || d <= 0) return;
    this.hp -= d; this.stats.hurt += d; this.hurtFlashUntil = now + 90; this.img.setTintFill(0xffffff);
    if (this.hp <= 0) {
      this.hp = 0; this.down = true; this.img.clearTint().setTint(0x6a5050).setAlpha(.7).setAngle(80);
      this.h.banner('典韦力战而死', true, '恶来独守营门，至死不退');
      ordersOf(this.h.scene)?.fail('dianwei');
    }
    this.refresh();
  }
  /** 战斗结束时（张绣倒下）：典韦还活着 → 军令完成。 */
  finish(): void { if (!this.down) ordersOf(this.h.scene)?.done('dianwei', '典韦得救'); }
  private shownHp = -1;
  private refresh(): void {
    const g = this.bar, r = Math.max(0, this.hp / DIANWEI.hp), x = this.x - PLATE.w / 2, y = this.barY;
    this.label.setPosition(this.x, y - 2).setText(this.down ? '典韦 · 战死' : '典韦').setColor(this.down ? '#b9a99a' : PLATE.nameColor);
    g.clear(); if (this.down) return;
    g.fillStyle(0x000000, .55).fillRect(x - 1, y, PLATE.w + 2, PLATE.h + 2).fillStyle(PLATE.back, 1).fillRect(x, y + 1, PLATE.w, PLATE.h).fillStyle(PLATE.color, 1).fillRect(x, y + 1, PLATE.w * r, PLATE.h);
    const hp = Math.ceil(this.hp); if (hp !== this.shownHp) { this.shownHp = hp; ordersOf(this.h.scene)?.patch('dianwei', { progress: { cur: hp, max: DIANWEI.hp } }); }
  }
  /** 身体：把贴进来的敌兵 / 友军推到身体外（防一群人站在典韦身上）。 */
  private pushOut(o: { x: number; y: number }, r: number, set: (x: number, y: number) => void): void {
    const dx = o.x - this.x, dy = o.y - this.y, d = Math.hypot(dx, dy), min = DIANWEI.body + r;
    if (d >= min) return;
    const a = d > .5 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2; set(this.x + Math.cos(a) * min, this.y + Math.sin(a) * min); this.stats.pushed++;
  }
  private face(tx: number, ty: number): void { const dx = tx - this.x, dy = ty - this.y; this.dir = Math.abs(dx) > Math.abs(dy) * .8 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'; }
  private pose(now: number): void {
    const atk = this.attackKey();
    if (now < this.attackUntil && atk) { const f = Math.min(3, Math.floor((1 - (this.attackUntil - now) / DIANWEI.attackMs) * 4)), key = `${this.dir}_${f}`; if (this.img.texture.key !== atk || this.img.frame.name !== key) { this.img.setTexture(atk, key); this.stats.attackFrames++; } return; }
    const wk = this.walkKey(), key = `${this.dir}_0`; if (this.img.texture.key !== wk || this.img.frame.name !== key) this.img.setTexture(wk, key);
  }
  update(dt: number, now: number): void {
    if (this.down) return;
    if (this.hurtFlashUntil && now >= this.hurtFlashUntil) { this.hurtFlashUntil = 0; this.img.clearTint(); }
    const enemies = this.h.enemies();
    for (const e of enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') this.pushOut(e, e.radius * .7, (x, y) => e.sprite.setPosition(x, y));
    for (const a of this.h.allies?.() ?? []) if (a.active) this.pushOut(a, 12, (x, y) => a.setPosition(x, y));
    // 贴身敌兵砍典韦
    let nearest: Enemy | null = null, nd = 1e9;
    for (const e of enemies) {
      if (!e.active || e.isSupplySlot) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y); if (d < nd) { nd = d; nearest = e; }
      if (e.kind === 'boss' || d > e.radius + DIANWEI.body + 4 || e.contactCd > 0) continue;
      e.contactCd = DIANWEI.contactCd; this.hurt(e.def.damage * DIANWEI.contactMul, now); if (this.down) return;
    }
    if (nearest && nd < 360) this.face(nearest.x, nearest.y);
    // 双戟横扫身边一圈
    if (now >= this.nextSwing) {
      this.nextSwing = now + DIANWEI.swingMs;
      const near = enemies.filter(e => e.active && !e.isSupplySlot && Math.hypot(e.x - this.x, e.y - this.y) <= DIANWEI.swingRadius + e.radius);
      if (near.length) {
        this.stats.swings++; this.face(near[0].x, near[0].y); this.attackUntil = now + DIANWEI.attackMs;
        for (const e of near) this.h.hit(e, DIANWEI.swingDamage);
        const a = Math.atan2(near[0].y - this.y, near[0].x - this.x);
        playSheet(this.h.scene, 'fx_drag_wave', this.x + Math.cos(a) * 26, this.y - 30 + Math.sin(a) * 18, { size: 120, ms: 260, depth: DEPTH.fx, add: true, alpha: .7, rotation: a, name: 'dianwei-swing' });
      }
    }
    this.pose(now); this.refresh();
    void dt;
  }
  clear(): void { this.img.destroy(); this.label.destroy(); this.bar.destroy(); ordersOf(this.h.scene)?.remove('dianwei'); }
}
