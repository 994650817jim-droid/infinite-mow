import Phaser from 'phaser';
import type {Player} from '../entities/Player';
import type {Enemy} from '../entities/Enemy';
import type {CharacterId} from '../data/characters';
import {MOUNT, CAVALRY_HEROES, CAVALRY_BONUS, mountStyle, type MountStyle} from '../data/mounts';
import {ensureHorseTextures, HORSE_FRAME, HORSE_FOOT} from './HorseTexture';
import {actorDepth, FONT} from '../config';

interface Host {
  scene: Phaser.Scene; player: Player; enemies: Enemy[];
  hit: (e: Enemy, damage: number, now: number) => void;
  notice: (text: string) => void;
}

/**
 * 骑马（data/mounts.ts）：行囊坐骑槽有马即骑马出征。
 * 表现为拼接法：通用战马图（按坐骑换毛色）+ 武将行走 / 动作帧的上半身叠在马鞍上（下半身裁掉）。
 * 骑马：移速加成、践踏撞开普通兵、受伤减免并扣马的耐力；耐力掉光落马，约 15 秒后重新上马。
 */
export class HeroMount {
  mounted = true; stamina: number; readonly maxStamina: number; remountAt = 0;
  readonly style: MountStyle; readonly name: string;
  private horse: Phaser.GameObjects.Image; private front: Phaser.GameObjects.Image; private tack: Phaser.GameObjects.Image; private bar: Phaser.GameObjects.Graphics; private label: Phaser.GameObjects.Text;
  private lastX: number; private lastY: number; private phase = 0; private speed = 0;
  private readonly trampled = new WeakMap<Enemy, number>(); private readonly trampleMul: number;
  /** 本局践踏次数、落马次数（测试与结算用）。 */
  tramples = 0; falls = 0;
  constructor(private h: Host, item: {base: string; name: string}, hero: CharacterId) {
    ensureHorseTextures(h.scene);
    this.style = mountStyle(item.base); this.name = item.name;
    const cav = CAVALRY_HEROES.includes(hero);
    this.maxStamina = MOUNT.stamina + (this.style.stamina ?? 0) + (cav ? CAVALRY_BONUS.stamina : 0); this.stamina = this.maxStamina;
    this.trampleMul = (this.style.trampleMul ?? 1) * (cav ? CAVALRY_BONUS.trample : 1);
    const k = MOUNT.horseSize / HORSE_FRAME;
    this.horse = h.scene.add.image(h.player.x, h.player.y, 'mount_horse', 'down_0').setOrigin(.5, HORSE_FOOT / HORSE_FRAME).setScale(k).setTint(this.style.tint).setName('hero-mount');
    this.tack = h.scene.add.image(h.player.x, h.player.y, 'mount_tack', 'down_0').setOrigin(.5, HORSE_FOOT / HORSE_FRAME).setScale(k);
    // 朝镜头时马头马颈挡在骑者前面
    this.front = h.scene.add.image(h.player.x, h.player.y, 'mount_front', 'down_0').setOrigin(.5, HORSE_FOOT / HORSE_FRAME).setScale(k).setTint(this.style.tint);
    this.bar = h.scene.add.graphics();
    this.label = h.scene.add.text(h.player.x, h.player.y, '', {fontFamily: FONT, fontSize: '12px', resolution: 2, color: '#ffd9a0', stroke: '#1a120b', strokeThickness: 3}).setOrigin(.5, 0);
    this.lastX = h.player.x; this.lastY = h.player.y;
    this.applyRider(true);
  }
  private applyRider(on: boolean): void {
    const p = this.h.player; p.mountSpeedMul = on ? (this.style.speedMul ?? MOUNT.speedMul) : 1; p.riseY = on ? MOUNT.riderRise : 0;
    if (!on) p.sprite.setCrop();
  }
  /** 受伤：骑马时马替人挡一部分并扣耐力，耐力掉光落马。返回骑者实际承受的伤害。 */
  guard(damage: number, now: number): number {
    if (!this.mounted) return damage;
    this.stamina -= damage * (damage >= MOUNT.heavyHit ? MOUNT.heavyMul : MOUNT.lightMul);
    if (this.stamina <= 0) { this.dismount(now); return this.style.leap ? 0 : damage; }
    return Math.max(1, Math.round(damage * MOUNT.damageTakenMul));
  }
  dismount(now: number): void {
    if (!this.mounted) return;
    const p = this.h.player; this.mounted = false; this.stamina = 0; this.remountAt = now + MOUNT.remountMs; this.falls++;
    this.applyRider(false);
    const dx = p.direction === 'left' ? -1 : p.direction === 'right' ? 1 : 0, dy = p.direction === 'up' ? -1 : p.direction === 'down' ? 1 : 0;
    if (this.style.leap) { p.invulnUntil = Math.max(p.invulnUntil, now + 1200); p.knockUp(now, 380, dx * 120, dy * 120); this.h.notice(`${this.name}一跃 · 落马无伤`); }
    else this.h.notice('落马！');
    // 马受惊跑开后淡出
    const horse = this.horse, tack = this.tack, sx = -dx || 1;
    this.h.scene.tweens.add({targets: [horse, tack, this.front], x: horse.x + sx * 140, alpha: 0, duration: 650, ease: 'Quad.easeIn'});
  }
  remount(now: number): void {
    if (this.mounted) return;
    this.mounted = true; this.stamina = this.maxStamina; this.remountAt = 0;
    this.h.scene.tweens.killTweensOf([this.horse, this.tack, this.front]); this.horse.setAlpha(0); this.tack.setAlpha(0);
    this.h.scene.tweens.add({targets: [this.horse, this.tack, this.front], alpha: 1, duration: 300});
    this.applyRider(true); this.h.notice(`上马 · ${this.name}`); void now;
  }
  update(dt: number, now: number): void {
    const p = this.h.player;
    const moved = Math.hypot(p.x - this.lastX, p.y - this.lastY); this.speed = dt > 0 ? moved / dt : 0; this.lastX = p.x; this.lastY = p.y;
    if (!this.mounted) {
      if (p.alive && now >= this.remountAt) this.remount(now);
      this.bar.clear(); this.label.setPosition(p.x, p.y + 30).setDepth(actorDepth(p.y + 40)).setText(p.alive ? `${Math.ceil((this.remountAt - now) / 1000)} 秒后上马` : '');
      return;
    }
    // 骑者：抬到马鞍上，裁掉下半身（腿被马身挡住）
    const f = p.sprite.frame; if (f) p.sprite.setCrop(0, 0, f.width, f.height * MOUNT.riderCrop);
    const running = this.speed > MOUNT.trampleMinSpeed; if (running) this.phase += dt * 10;
    const key = `${p.direction}_${running ? Math.floor(this.phase) % 4 : 0}`;
    for (const img of [this.horse, this.tack, this.front]) { img.setPosition(p.x, p.y + 30); if (img.frame.name !== key) img.setFrame(key); img.setDepth(p.sprite.depth + (img === this.front ? .001 : -.001)); }
    this.label.setText('');
    // 耐力条（不满时显示在马蹄下）
    this.bar.clear().setDepth(p.sprite.depth + .001);
    if (this.stamina < this.maxStamina) { const w = 40, r = Math.max(0, this.stamina / this.maxStamina); this.bar.fillStyle(0x140d08, .8).fillRect(p.x - w / 2 - 1, p.y + 34, w + 2, 5).fillStyle(r > .5 ? 0xe2c06a : r > .25 ? 0xe28a3a : 0xd65a3f).fillRect(p.x - w / 2, p.y + 35, w * r, 3); }
    if (running && !this.style.noTrample) this.trample(now);
  }
  private trample(now: number): void {
    const p = this.h.player, r = MOUNT.trampleRadius;
    for (const e of this.h.enemies) {
      if (!e.active || e.kind === 'boss' || e.kind === 'elite' || e.isSupplySlot || e.invulnerable || e.def.behavior === 'wall') continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > r + e.radius || now < (this.trampled.get(e) ?? 0)) continue;
      this.trampled.set(e, now + MOUNT.trampleCooldownMs); this.tramples++;
      const nx = dx / (d || 1), ny = dy / (d || 1); e.sprite.x += nx * MOUNT.tramplePush; e.sprite.y += ny * MOUNT.tramplePush;
      this.h.hit(e, MOUNT.trampleDamage * this.trampleMul, now);
    }
  }
  clear(): void { this.horse.destroy(); this.tack.destroy(); this.front.destroy(); this.bar.destroy(); this.label.destroy(); }
}
