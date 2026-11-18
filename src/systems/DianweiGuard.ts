/**
 * 3-2 宛城夜袭「典韦守营」（剧情 story-ch03.md 第五节，用户 2026-11-17 批准）：
 * 后营寨门站一名友军典韦（不可操作，原地挥双戟），有血条；约四成敌兵改打他（ThirdGameScene.customEnemyStep 按 lures 改目标）。
 * 张绣倒下时典韦还活着 → 旗标 dianwei = saved（军功 +80）；典韦血空 → 倒地 + 横幅「典韦力战而死」，不判负，战斗继续 → dianwei = fell。
 * 数值都是初值（交平衡会话）。美术：还没有典韦战斗图，先用友军刀兵行走图放大加名牌（占位）；挥戟用现成手绘刀气序列帧。
 */
import Phaser from 'phaser';
import { DEPTH, FONT, actorDepth } from '../config';
import type { Enemy } from '../entities/Enemy';
import { playSheet } from './SkillFxSheets';

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
} as const;

export interface DianweiHost {
  scene: Phaser.Scene; player: { x: number; y: number; sprite: { displayHeight: number } };
  enemies: () => readonly Enemy[];
  /** 典韦打敌人（算友军伤害） */
  hit: (e: Enemy, damage: number) => void;
  banner: (title: string, danger: boolean, caption?: string) => void;
}

export class DianweiGuard {
  hp: number = DIANWEI.hp; down = false; readonly x: number; readonly y: number;
  private readonly img: Phaser.GameObjects.Image; private readonly label: Phaser.GameObjects.Text;
  private nextSwing = 0; private hurtFlashUntil = 0;
  /** 测试用 */
  readonly stats = { swings: 0, hurt: 0 };
  constructor(private readonly h: DianweiHost, now: number) {
    this.x = h.player.x; this.y = h.player.y + DIANWEI.offsetY;
    const sc = h.scene, key = sc.textures.exists('shu_swordsman_walk_sheet') ? 'shu_swordsman_walk_sheet' : 'hero_walk_sheet';
    // 占位：友军刀兵行走图放大 1.35 倍（比主将高大）；典韦专属战斗图到位后换贴图键即可
    const targetH = (h.player.sprite.displayHeight || 96) * 1.35;
    this.img = sc.add.image(this.x, this.y, key, 'up_0').setOrigin(.5, .88).setName('dianwei-guard');
    this.img.setScale(targetH / (this.img.height || 96)).setDepth(actorDepth(this.y));
    this.label = sc.add.text(this.x, this.y - targetH - 10, '', { fontFamily: FONT, fontSize: '13px', color: '#ffe0b0', resolution: 2 }).setOrigin(.5).setStroke('#1a120b', 4).setDepth(DEPTH.hud - 1).setName('dianwei-label');
    this.nextSwing = now + DIANWEI.swingMs; this.refresh();
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
    }
    this.refresh();
  }
  private refresh(): void { this.label.setText(this.down ? '典韦 · 战死' : `典韦 ${Math.ceil(this.hp)}/${DIANWEI.hp}`); }
  update(dt: number, now: number): void {
    if (this.down) return;
    if (this.hurtFlashUntil && now >= this.hurtFlashUntil) { this.hurtFlashUntil = 0; this.img.clearTint(); }
    // 贴身敌兵砍典韦
    for (const e of this.h.enemies()) {
      if (!e.active || e.isSupplySlot || e.kind === 'boss' || Math.hypot(e.x - this.x, e.y - this.y) > e.radius + 22) continue;
      if (e.contactCd > 0) continue;
      e.contactCd = DIANWEI.contactCd; this.hurt(e.def.damage * DIANWEI.contactMul, now); if (this.down) return;
    }
    // 双戟横扫身边一圈
    if (now >= this.nextSwing) {
      this.nextSwing = now + DIANWEI.swingMs;
      const near = this.h.enemies().filter(e => e.active && !e.isSupplySlot && Math.hypot(e.x - this.x, e.y - this.y) <= DIANWEI.swingRadius + e.radius);
      if (near.length) {
        this.stats.swings++;
        for (const e of near) this.h.hit(e, DIANWEI.swingDamage);
        const a = Math.atan2(near[0].y - this.y, near[0].x - this.x);
        playSheet(this.h.scene, 'fx_drag_wave', this.x + Math.cos(a) * 26, this.y - 30 + Math.sin(a) * 18, { size: 120, ms: 260, depth: DEPTH.fx, add: true, alpha: .7, rotation: a, name: 'dianwei-swing' });
      }
    }
    void dt;
  }
  clear(): void { this.img.destroy(); this.label.destroy(); }
}
