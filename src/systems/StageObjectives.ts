import Phaser from 'phaser';
import type {Enemy} from '../entities/Enemy';
import type {Player} from '../entities/Player';
import type {EnemyKind} from '../types';
import {STAGE_DESTROY_HP, STAGE_HOLD as HD, type StageObjective} from '../data/objectives';
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
 * 关卡目标（data/objectives.ts）：歼敌 / 摧毁 / 坚守（2-2 伤兵车护送 2026-11-17 用户要求去掉）。目标完成即 done（GameScene 据此让首领出阵），
 * 军旗被夺判 failed，超过 limit 秒未完成由 GameScene 判时间耗尽。
 * 摧毁目标用战场物件（敌营）的命中、碰撞与破坏特效，第一章祭坛换成张宝祭坛图；军旗为程序绘制的过渡造型。
 */
export class StageObjectives {
  done = false; failed = false;
  private startKills: number; private destroyed = 0; private targets: Array<{e: Enemy; life: number; label?: Phaser.GameObjects.Text; art?: Phaser.GameObjects.Image}> = [];
  // 坚守
  private cart?: Phaser.GameObjects.Container; private bar?: Phaser.GameObjects.Graphics; private tag?: Phaser.GameObjects.Text;
  private hp = 0; private held = 0;
  constructor(private h: Host, readonly o: StageObjective) {
    this.startKills = h.kills();
    if (o.kind === 'destroy') this.placeTargets(o.count, o.target);
    if (o.kind === 'hold') this.buildFlag();
    h.banner(o.label, o.kind === 'hold' ? '守在军旗旁 · 敌兵贴近会夺旗' : '完成目标后首领出阵');
  }
  /** HUD 一行：目标与进度。 */
  get text(): string {
    const o = this.o; if (this.done) return '目标达成 · 击败首领';
    if (o.kind === 'kills') return `目标 · 歼敌 ${Math.min(o.count, this.h.kills() - this.startKills)}/${o.count}`;
    if (o.kind === 'destroy') return `目标 · ${o.target} ${this.destroyed}/${o.count}`;
    return `目标 · 坚守 ${Math.floor(this.held)}/${o.seconds} 秒 · 军旗 ${Math.ceil(this.hp)}/${HD.hp}`;
  }
  /** 还没摧毁的目标（营寨等，摧毁型关卡）：友军攻势、地图用。 */
  get standing(): Enemy[] { return this.done || this.failed || this.o.kind !== 'destroy' ? [] : this.targets.filter(t => t.e.active && t.e.spawnId === t.life && t.e.hp > 0).map(t => t.e); }
  /**
   * 关卡锁定目标（用户「武将攻击逻辑会一直不打营寨」）：主将 range 内最近的未摧毁目标（按营寨的身体半径算）。
   * GameScene.priorityWeaponTarget 把它排在首领、精锐前面——各武将的索敌（smartTarget / 优先目标）都会去打。
   */
  lockedTarget(px: number, py: number, range: number): Enemy | null {
    let best: Enemy | null = null, bd = Infinity;
    for (const e of this.standing) { const d = Math.hypot(e.x - px, e.y - py) - e.radius; if (d <= range && d < bd) { bd = d; best = e; } }
    return best;
  }
  /** 战场地图（ui/BattleMap）用：还没摧毁的目标 / 坚守军旗的位置。 */
  get points(): Array<{x: number; y: number}> {
    if (this.done || this.failed) return [];
    if (this.o.kind === 'destroy') return this.targets.filter(t => t.e.active && t.e.spawnId === t.life).map(t => ({x: t.e.x, y: t.e.y}));
    if (this.o.kind === 'hold' && this.cart?.active) return [{x: this.cart.x, y: this.cart.y + 40}];
    return [];
  }
  /** 战场地图用：当前进度（歼敌 / 摧毁个数 / 坚守秒数）。 */
  get progress(): {cur: number; max: number} {
    const o = this.o;
    return o.kind === 'kills' ? {cur: this.h.kills() - this.startKills, max: o.count} : o.kind === 'destroy' ? {cur: this.destroyed, max: o.count} : {cur: Math.floor(this.held), max: o.seconds};
  }
  /** 测试用状态。 */
  get state() { return {done: this.done, failed: this.failed, destroyed: this.destroyed, hp: this.hp, held: this.held, kills: this.h.kills() - this.startKills}; }
  private complete(): void { if (this.done) return; this.done = true; const b = this.o.kind === 'destroy' ? this.o.doneBanner : undefined; this.h.banner(b?.[0] ?? '目标达成', b?.[1] ?? '首领出阵！'); }
  onKill(e: Enemy): void {
    const t = this.targets.find(x => x.e === e && x.e.spawnId === x.life); if (!t) return;
    this.destroyed++; t.e.lockTarget = false; t.label?.destroy(); t.art?.destroy(); this.targets.splice(this.targets.indexOf(t), 1);
    if (this.o.kind === 'destroy' && this.destroyed >= this.o.count) this.complete();
  }
  private placeTargets(n: number, name: string): void {
    const p = this.h.player, a0 = Math.random() * Math.PI * 2, spots = this.o.kind === 'destroy' ? this.o.spots : undefined;
    for (let i = 0; i < n; i++) {
      // 固定位置（数据给了 spots，如 2-3 洛阳五座营寨）；没有就绕主将随机撒一圈
      const a = a0 + i / n * Math.PI * 2, sp = spots?.[i], x = sp ? p.x + sp[0] : p.x + Math.cos(a) * 420, y = sp ? p.y + sp[1] : p.y + Math.sin(a) * 330, e = this.h.spawnCamp(x, y, STAGE_DESTROY_HP);
      if (!e) continue;
      let art: Phaser.GameObjects.Image | undefined;
      // 第一章：张宝祭坛图替代营帐
      if (name.includes('祭坛') && this.h.scene.textures.exists('zhang_bao_altar')) { e.sprite.setAlpha(0); art = this.h.scene.add.image(x, y, 'zhang_bao_altar').setOrigin(.5, .85).setDisplaySize(150, 122).setDepth(actorDepth(y)); }
      const label = worldText(this.h.scene, x, y - 150, name, 15, '#ffd28a').setOrigin(.5).setStroke('#1a120b', 4).setDepth(36);
      e.lockTarget = true; // 武器把营寨当敌人打（用户「武将攻击逻辑会一直不打营寨」）
      this.targets.push({e, life: e.spawnId, label, art});
    }
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
    const max = HD.hp, w = 60, r = Math.max(0, this.hp / max), top = 104;
    this.bar.clear().setDepth(DEPTH.fx).fillStyle(0x140d08, .85).fillRect(c.x - w / 2 - 1, c.y - top, w + 2, 7).fillStyle(r > .5 ? 0x6fcf7a : r > .25 ? 0xe2b14a : 0xd65a3f).fillRect(c.x - w / 2, c.y - top + 1, w * r, 5);
    this.tag.setPosition(c.x, c.y - top - 12).setDepth(DEPTH.fx);
  }
  clear(): void { for (const t of this.targets) { t.e.lockTarget = false; t.label?.destroy(); t.art?.destroy(); } this.targets = []; this.cart?.destroy(); this.bar?.destroy(); this.tag?.destroy(); }
}
