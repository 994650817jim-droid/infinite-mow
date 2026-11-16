import Phaser from 'phaser';
import type {Enemy} from '../entities/Enemy';
import type {Player} from '../entities/Player';
import type {EnemyKind} from '../types';
import {STAGE_DESTROY_HP, STAGE_ESCORT as E, STAGE_HOLD as HD, type StageObjective} from '../data/objectives';
import {actorDepth, DEPTH} from '../config';
import {worldText} from '../world/WorldUI';

interface Host {
  scene: Phaser.Scene; player: Player; enemies: Enemy[];
  spawn: (kind: EnemyKind, x: number, y: number) => Enemy | null;
  spawnCamp: (x: number, y: number, hp: number) => Enemy | null;
  kills: () => number; elapsed: () => number;
  banner: (text: string, caption?: string) => void;
}

/**
 * 关卡目标（data/objectives.ts）：歼敌 / 摧毁 / 护送 / 坚守。目标完成即 done（GameScene 据此让首领出阵），
 * 护送车被毁、军旗被夺判 failed，超过 limit 秒未完成由 GameScene 判时间耗尽。
 * 摧毁目标用战场物件（敌营）的命中、碰撞与破坏特效，第一章祭坛换成张宝祭坛图；护送车、军旗为程序绘制的过渡造型。
 */
export class StageObjectives {
  done = false; failed = false;
  private startKills: number; private destroyed = 0; private targets: Array<{e: Enemy; life: number; label?: Phaser.GameObjects.Text; art?: Phaser.GameObjects.Image}> = [];
  // 护送 / 坚守
  private cart?: Phaser.GameObjects.Container; private bar?: Phaser.GameObjects.Graphics; private tag?: Phaser.GameObjects.Text;
  private hp = 0; private startY = 0; private held = 0; private ambush = 0; stopped = false;
  constructor(private h: Host, readonly o: StageObjective) {
    this.startKills = h.kills();
    if (o.kind === 'destroy') this.placeTargets(o.count, o.target);
    if (o.kind === 'escort') this.buildCart(o.goal);
    if (o.kind === 'hold') this.buildFlag();
    h.banner(o.label, o.kind === 'escort' ? '守在车旁它才前进 · 别让敌兵围车' : o.kind === 'hold' ? '守在军旗旁 · 敌兵贴近会夺旗' : '完成目标后首领出阵');
  }
  /** HUD 一行：目标与进度。 */
  get text(): string {
    const o = this.o; if (this.done) return '目标达成 · 击败首领';
    if (o.kind === 'kills') return `目标 · 歼敌 ${Math.min(o.count, this.h.kills() - this.startKills)}/${o.count}`;
    if (o.kind === 'destroy') return `目标 · ${o.target} ${this.destroyed}/${o.count}`;
    if (o.kind === 'escort') return `目标 · 护送 ${Math.round(this.progress * 100)}% · 车 ${Math.ceil(this.hp)}/${E.hp}`;
    return `目标 · 坚守 ${Math.floor(this.held)}/${o.seconds} 秒 · 军旗 ${Math.ceil(this.hp)}/${HD.hp}`;
  }
  get progress(): number { return this.cart ? Math.min(1, (this.startY - this.cart.y) / E.distance) : 0; }
  /** 测试用状态。 */
  get state() { return {done: this.done, failed: this.failed, destroyed: this.destroyed, hp: this.hp, progress: this.progress, held: this.held, stopped: this.stopped, cartX: this.cart?.x, cartY: this.cart?.y, kills: this.h.kills() - this.startKills}; }
  private complete(): void { if (this.done) return; this.done = true; this.h.banner('目标达成', '首领出阵！'); }
  onKill(e: Enemy): void {
    const t = this.targets.find(x => x.e === e && x.e.spawnId === x.life); if (!t) return;
    this.destroyed++; t.label?.destroy(); t.art?.destroy(); this.targets.splice(this.targets.indexOf(t), 1);
    if (this.o.kind === 'destroy' && this.destroyed >= this.o.count) this.complete();
  }
  private placeTargets(n: number, name: string): void {
    const p = this.h.player, a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * Math.PI * 2, x = p.x + Math.cos(a) * 420, y = p.y + Math.sin(a) * 330, e = this.h.spawnCamp(x, y, STAGE_DESTROY_HP);
      if (!e) continue;
      let art: Phaser.GameObjects.Image | undefined;
      // 第一章：张宝祭坛图替代营帐
      if (name.includes('祭坛') && this.h.scene.textures.exists('zhang_bao_altar')) { e.sprite.setAlpha(0); art = this.h.scene.add.image(x, y, 'zhang_bao_altar').setOrigin(.5, .85).setDisplaySize(150, 122).setDepth(actorDepth(y)); }
      const label = worldText(this.h.scene, x, y - 150, name, 15, '#ffd28a').setOrigin(.5).setStroke('#1a120b', 4).setDepth(36);
      this.targets.push({e, life: e.spawnId, label, art});
    }
  }
  private buildCart(goal: string): void {
    this.hp = E.hp; const p = this.h.player; this.startY = p.y + 70;
    const g = this.h.scene.add.graphics();
    g.fillStyle(0x000000, .28).fillEllipse(0, 4, 70, 16);
    g.fillStyle(0x3b2616).fillCircle(-20, -2, 11).fillCircle(20, -2, 11); g.fillStyle(0x8a6a44).fillCircle(-20, -2, 5).fillCircle(20, -2, 5);
    g.fillStyle(0x6e4a2a).fillRect(-32, -26, 64, 18).lineStyle(2, 0x2a1a0e).strokeRect(-32, -26, 64, 18);
    g.fillStyle(0xd8d0bc).fillRoundedRect(-28, -44, 56, 18, 6).fillStyle(0xb02a22).fillRect(-6, -42, 12, 14).fillRect(-12, -36, 24, 4);
    this.cart = this.h.scene.add.container(p.x, this.startY, [g]).setName('stage-escort-cart');
    this.bar = this.h.scene.add.graphics();
    this.tag = worldText(this.h.scene, 0, 0, '伤兵车', 13, '#e9f6dc').setOrigin(.5).setStroke('#10170f', 3);
    worldText(this.h.scene, p.x, this.startY - E.distance + 40, `${goal} · 终点`, 16, '#ffe1a0').setOrigin(.5).setStroke('#1a120b', 4).setDepth(36);
  }
  private buildFlag(): void {
    this.hp = HD.hp; const p = this.h.player, g = this.h.scene.add.graphics();
    g.lineStyle(3, 0x3a2716).lineBetween(0, 0, 0, -70); g.fillStyle(0xb02a22).fillRect(0, -70, 34, 24); g.fillStyle(0x000000, .25).fillEllipse(0, 2, 40, 12);
    this.cart = this.h.scene.add.container(p.x, p.y - 40, [g]).setName('stage-hold-flag');
    this.bar = this.h.scene.add.graphics();
    this.tag = worldText(this.h.scene, 0, 0, '军旗', 13, '#ffe1a0').setOrigin(.5).setStroke('#1a120b', 3);
  }
  private raiders(x: number, y: number, r: number): number { let n = 0; for (const e of this.h.enemies) if (e.active && !e.isSupplySlot && Math.hypot(e.x - x, e.y - y) <= r) n++; return n; }
  update(dt: number): void {
    if (this.done || this.failed) { this.drawCart(); return; }
    const o = this.o;
    if (o.kind === 'kills' && this.h.kills() - this.startKills >= o.count) this.complete();
    if (o.kind === 'escort' && this.cart) {
      const p = this.h.player, c = this.cart, near = Math.hypot(p.x - c.x, p.y - c.y) <= E.near; this.stopped = !near;
      if (near) c.y -= E.speed * dt;
      this.hp -= Math.min(this.raiders(c.x, c.y, E.raidRadius), E.raidCap) * E.raidDps * dt;
      // 第 2 / 3 波：车前方伏兵
      const wave = Math.floor(this.h.elapsed() / 45);
      if (wave > this.ambush && wave <= 2) { this.ambush = wave; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .35; this.h.spawn(i % 2 ? 'infantry' : 'shield', c.x + Math.cos(a) * 300, c.y + Math.sin(a) * 300); } }
      if (this.hp <= 0) { this.hp = 0; this.failed = true; this.h.banner('伤兵车被劫', '护送失败'); }
      else if (this.progress >= 1) this.complete();
    }
    if (o.kind === 'hold' && this.cart) {
      this.held += dt; this.hp -= Math.min(this.raiders(this.cart.x, this.cart.y, HD.radius), HD.cap) * HD.dps * dt;
      if (this.hp <= 0) { this.hp = 0; this.failed = true; this.h.banner('军旗被夺', '坚守失败'); }
      else if (this.held >= o.seconds) this.complete();
    }
    this.drawCart();
  }
  private drawCart(): void {
    const c = this.cart; if (!c || !this.bar || !this.tag) return;
    c.setDepth(actorDepth(c.y + 6));
    const max = this.o.kind === 'escort' ? E.hp : HD.hp, w = 60, r = Math.max(0, this.hp / max), top = this.o.kind === 'escort' ? 104 : 104;
    this.bar.clear().setDepth(DEPTH.fx).fillStyle(0x140d08, .85).fillRect(c.x - w / 2 - 1, c.y - top, w + 2, 7).fillStyle(r > .5 ? 0x6fcf7a : r > .25 ? 0xe2b14a : 0xd65a3f).fillRect(c.x - w / 2, c.y - top + 1, w * r, 5);
    this.tag.setPosition(c.x, c.y - top - 12).setDepth(DEPTH.fx);
  }
  /** 测试 / 调试：直接把护送车推到终点。 */
  forceArrive(): void { if (this.cart) this.cart.y = this.startY - E.distance - 1; }
  clear(): void { for (const t of this.targets) { t.label?.destroy(); t.art?.destroy(); } this.targets = []; this.cart?.destroy(); this.bar?.destroy(); this.tag?.destroy(); }
}
