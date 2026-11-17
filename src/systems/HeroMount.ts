import Phaser from 'phaser';
import type {Player} from '../entities/Player';
import type {Enemy} from '../entities/Enemy';
import type {CharacterId} from '../data/characters';
import {MOUNT, CAVALRY_HEROES, CAVALRY_BONUS, mountStyle, type MountStyle} from '../data/mounts';
import {ensureHorseTextures, HORSE_FRAME, HORSE_FOOT} from './HorseTexture';
import {actorDepth, FONT} from '../config';
import {ART_V2_FILES, artStyle, isV2Texture, regridV2} from './ArtStyle';

/**
 * 人物画风 v2 战马（ChatGPT 手绘厚涂、鞍辔画在马上，4 方向 × 4 帧，每格 288、脚底 280）：
 * 名马各一张，其余坐骑用浅灰白通用马按毛色乘色。缺图或 ?art=v1 时仍用程序画的旧马。
 */
const V2_HORSE: Record<string, string> = {chitu: 'horse_v2_chitu_walk', dilu: 'horse_v2_dilu_walk', black_horse: 'horse_v2_wuzhui_walk', jueying: 'horse_v2_jueying_walk', west_horse: 'horse_v2_dawan_walk', mule: 'horse_v2_mule_walk'};
const V2_GENERIC = 'horse_v2_generic_walk';
/** v2 马的显示：0.5 倍（1080p 像素 1:1）；脚底行；朝镜头时盖在骑者前面的是帧高 frontTop~frontCut 这一段（马眼以下的头颈），
 * 耳朵与额鬃留在骑者身后；骑者抬高，朝镜头时再多抬 downRise（骑者的头要高过马头）。 */
export const HORSE_V2 = {cell: 288, foot: 280, scale: .5, frontTop: .34, frontCut: .54, riderRise: 40, downRise: 16} as const;
function v2HorseKey(base: string): string { return V2_HORSE[base] ?? V2_GENERIC; }
/** 个别坐骑鞍子更低（骡比马矮），骑者少抬一些。 */
const V2_RISE: Record<string, number> = {horse_v2_mule_walk: 22};
const v2Rise = (key: string): number => V2_RISE[key] ?? HORSE_V2.riderRise;

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
  /** 正在用的 v2 马图集键（未载入 / v1 时为空，用旧马）。 */
  private v2Key = ''; private readonly tinted: boolean;
  private readonly trampled = new WeakMap<Enemy, number>(); private readonly trampleMul: number;
  /** 本局践踏次数、落马次数（测试与结算用）。 */
  tramples = 0; falls = 0;
  /** opts：遗珍「虎豹铁面」践踏 ×2、上马间隔缩短（BossRelics.RELIC.hubao*）。 */
  private readonly remountMs: number;
  constructor(private h: Host, item: {base: string; name: string}, hero: CharacterId, opts: {trampleMul?: number; remountMs?: number} = {}) {
    this.remountMs = opts.remountMs ?? MOUNT.remountMs;
    ensureHorseTextures(h.scene);
    this.style = mountStyle(item.base); this.name = item.name;
    const cav = CAVALRY_HEROES.includes(hero);
    this.maxStamina = MOUNT.stamina + (this.style.stamina ?? 0) + (cav ? CAVALRY_BONUS.stamina : 0); this.stamina = this.maxStamina;
    this.trampleMul = (this.style.trampleMul ?? 1) * (cav ? CAVALRY_BONUS.trample : 1) * (opts.trampleMul ?? 1);
    const k = MOUNT.horseSize / HORSE_FRAME;
    this.horse = h.scene.add.image(h.player.x, h.player.y, 'mount_horse', 'down_0').setOrigin(.5, HORSE_FOOT / HORSE_FRAME).setScale(k).setTint(this.style.tint).setName('hero-mount');
    this.tack = h.scene.add.image(h.player.x, h.player.y, 'mount_tack', 'down_0').setOrigin(.5, HORSE_FOOT / HORSE_FRAME).setScale(k);
    // 朝镜头时马头马颈挡在骑者前面
    this.front = h.scene.add.image(h.player.x, h.player.y, 'mount_front', 'down_0').setOrigin(.5, HORSE_FOOT / HORSE_FRAME).setScale(k).setTint(this.style.tint);
    this.bar = h.scene.add.graphics();
    this.label = h.scene.add.text(h.player.x, h.player.y, '', {fontFamily: FONT, fontSize: '12px', resolution: 2, color: '#ffd9a0', stroke: '#1a120b', strokeThickness: 3}).setOrigin(.5, 0);
    this.lastX = h.player.x; this.lastY = h.player.y;
    this.tinted = !V2_HORSE[item.base];
    if (artStyle() === 'v2') this.loadV2(v2HorseKey(item.base));
    this.applyRider(true);
  }
  /** v2 马按需载入，到位后换掉旧马（载入失败就一直用旧马）。 */
  private loadV2(key: string): void {
    const scene = this.h.scene;
    const ready = (): void => { if (!isV2Texture(key) || !scene.textures.exists(key) || !this.horse.active) return; if (!scene.textures.get(key).has('down_0') || scene.textures.get(key).get('down_0').width !== HORSE_V2.cell) regridV2(scene, key); this.useV2(key); };
    if (scene.textures.exists(key)) { ready(); return; }
    if (!ART_V2_FILES[key]) return;
    scene.load.image(key, ART_V2_FILES[key]);
    scene.load.once('filecomplete-image-' + key, ready);
    if (!scene.load.isLoading()) scene.load.start();
  }
  private useV2(key: string): void {
    this.v2Key = key;
    const o = HORSE_V2.foot / HORSE_V2.cell;
    this.horse.setTexture(key, 'down_0').setOrigin(.5, o).setScale(HORSE_V2.scale);
    if (this.tinted) this.horse.setTint(this.style.tint); else this.horse.clearTint();
    this.front.setTexture(key, 'down_0').setOrigin(.5, o).setScale(HORSE_V2.scale);
    if (this.tinted) this.front.setTint(this.style.tint); else this.front.clearTint();
    this.tack.setVisible(false);
    if (this.mounted) this.applyRider(true);
  }
  private applyRider(on: boolean): void {
    const p = this.h.player; p.mountSpeedMul = on ? (this.style.speedMul ?? MOUNT.speedMul) : 1; p.riseY = on ? (this.v2Key ? v2Rise(this.v2Key) : MOUNT.riderRise) : 0;
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
    const p = this.h.player; this.mounted = false; this.stamina = 0; this.remountAt = now + this.remountMs; this.falls++;
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
    // v2：朝镜头时只把帧上部（马头马颈）盖在骑者前面；其余方向不显示前景层
    if (this.v2Key) {
      const down = p.direction === 'down'; this.front.setVisible(down);
      if (down) this.front.setCrop(0, HORSE_V2.cell * HORSE_V2.frontTop, HORSE_V2.cell, HORSE_V2.cell * (HORSE_V2.frontCut - HORSE_V2.frontTop));
      p.riseY = v2Rise(this.v2Key) + (down ? HORSE_V2.downRise : 0);
    }
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
