import { warnCircle, TELEGRAPH_CLASSIC, groundCracks } from '../ui/Telegraph';
import { HINT_MOCK, keyOutline } from '../ui/HintStyle';
import { warnFx } from '../ui/WarnFx';
import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { LUBU_COMBAT as C } from '../data/chapters';
import { DEPTH } from '../config';
const HOVER_FRAMES = [0, 1, 4, 5, 6, 7] as const;
export class LubuUltimate {
  phase: 'idle' | 'takeoff' | 'airborne' | 'landing' = 'idle';
  private until = 0; private started = 0; private now = 0;
  private targetX = 0; private targetY = 0; private fieldUntil = 0;
  private origin = .5;
  private launchX = 0; private launchY = 0;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly slash: Phaser.GameObjects.Image;
  private readonly groundArt: Phaser.GameObjects.Image;
  private readonly warningArt: Phaser.GameObjects.Image;
  private readonly mask: Phaser.GameObjects.Graphics;
  constructor(private readonly scene: Phaser.Scene, private readonly boss: Enemy, private readonly player: Player, private readonly sfx: (kind: string) => void, private readonly hurtTroops?: (x: number, y: number, radius: number, damage: number, now: number) => void) {
    this.origin = boss.sprite.originY;
    this.groundArt = scene.add.image(0, 0, 'lubu_ult_field', 0).setDepth(DEPTH.ground + 2).setDisplaySize(C.ultRadius * 2, C.ultRadius * 2).setAlpha(.3).setVisible(false);
    this.warningArt = scene.add.image(0, 0, 'lubu_ult_warning', 0).setDepth(DEPTH.ground + 3).setDisplaySize(C.ultRadius * 2, C.ultRadius * 2).setAlpha(.3).setVisible(false);
    this.gfx = scene.add.graphics().setDepth(DEPTH.enemy - 1);
    this.mask = scene.add.graphics().setVisible(false);
    this.slash = scene.add.image(0, 0, 'lubu_slash', 0).setDepth(DEPTH.player - 1).setAlpha(.8).setVisible(false);
    this.slash.setMask(this.mask.createGeometryMask());
  }
  get active(): boolean { return this.phase !== 'idle'; }
  start(now: number): void {
    this.launchX = this.boss.x; this.launchY = this.boss.y;
    this.phase = 'takeoff'; this.started = now; this.until = now + C.ultTakeoffMs;
    this.boss.controlImmune = true; this.boss.invulnerable = false;
    this.sfx('chargeWarn');
  }
  damageMultiplier(source: 'melee' | 'arrow' | 'fire', now: number): number {
    if (now >= this.fieldUntil || Math.hypot(this.boss.x - this.targetX, this.boss.y - this.targetY) > C.ultRadius) return 1;
    return source === 'fire' ? C.ultMagicDamageMul : C.ultPhysicalDamageMul;
  }
  update(now: number): void {
    this.now = now; this.gfx.clear(); this.slash.setVisible(false); this.groundArt.setVisible(false); this.warningArt.setVisible(false);
    if (!this.boss.active) { this.clear(); return; }
    if (this.phase === 'takeoff' && now >= this.until) {
      // Lock once, then leave a full airborne warning window to dodge.
      this.targetX = this.player.x; this.targetY = this.player.y;
      this.phase = 'airborne'; this.started = now; this.until = now + C.ultAirborneMs;
      this.boss.invulnerable = true; this.boss.controlImmune = true;
    } else if (this.phase === 'airborne' && now >= this.until) {
      this.phase = 'landing'; this.started = now; this.until = now + C.ultLandingMs;
      if (!TELEGRAPH_CLASSIC && HINT_MOCK === 'c') warnFx(this.scene).impact('lubu', this.targetX, this.targetY, C.ultRadius);
      this.restore(); this.boss.sprite.setPosition(this.targetX, this.targetY);
      this.fieldUntil = now + C.ultFieldMs;
      this.paintMask();
      this.hurtTroops?.(this.targetX, this.targetY, C.ultRadius, C.ultDamage, now);
      if (Math.hypot(this.player.x - this.targetX, this.player.y - this.targetY) <= C.ultRadius + this.player.radius) {
        if (this.player.takeDamage(C.ultDamage, now)) {
          const a = Math.atan2(this.player.y - this.targetY, this.player.x - this.targetX);
          this.player.knockUp(now, C.ultKnockupMs, Math.cos(a) * 40, Math.sin(a) * 40);
        }
      }
      this.sfx('allySlash'); this.scene.cameras.main.shake(160, .005);
    } else if (this.phase === 'landing' && now >= this.until) {
      this.phase = 'idle'; this.restore();
    }
    if (this.phase === 'takeoff') {
      const t = Math.min(1, (now - this.started) / C.ultTakeoffMs);
      this.body('takeoff', Math.min(7, Math.floor(t * 8)), 150 * t * t);
      if (TELEGRAPH_CLASSIC) this.gfx.lineStyle(3, 0xffd28b, .8).strokeCircle(this.boss.x, this.boss.y, 32 + t * 28);
    } else if (this.phase === 'airborne') {
      const t = Math.min(1, (now - this.started) / C.ultAirborneMs);
      const travel = Math.min(1, t / .65);
      this.boss.sprite.setPosition(this.launchX + (this.targetX - this.launchX) * travel, this.launchY + (this.targetY - this.launchY) * travel);
      const remaining = this.until - now;
      const dropStartHeight = 150 + 55 * Math.sin(Math.PI * (1 - C.ultDropMs / C.ultAirborneMs));
      const fall = Math.max(0, 1 - remaining / C.ultDropMs);
      const height = remaining < C.ultDropMs ? dropStartHeight * (1 - fall * fall) : 150 + 55 * Math.sin(t * Math.PI);
      if (remaining < C.ultDropMs) this.body('landing', Math.min(2, Math.floor(fall * 3)), height);
      else {
        this.body('hover', HOVER_FRAMES[Math.floor((now - this.started) / 100) % HOVER_FRAMES.length], height);
      }
      this.boss.sprite.setAlpha(.95);
      this.warning(t);
    } else if (this.phase === 'landing') {
      const t = Math.min(1, (now - this.started) / C.ultLandingMs);
      this.body('landing', Math.min(7, 3 + Math.floor(t * 5)), 0);
      this.slash.setAlpha(.45).setVisible(t >= .15 && t < .75).setFrame(Math.min(5, Math.floor(t * 8))).setPosition(this.targetX, this.targetY)
        .setDisplaySize(C.ultRadius * 2, C.ultRadius * 2).setRotation(t * Math.PI * 2);
      if (HINT_MOCK !== 'a' && HINT_MOCK !== 'c') this.gfx.lineStyle(4 * (1 - t) + 1, 0xffe0b0, .85 * (1 - t)).strokeCircle(this.targetX, this.targetY, 30 + t * C.ultRadius);
      if (HINT_MOCK !== 'a' && HINT_MOCK !== 'c') for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; this.gfx.lineStyle(2, 0xffa151, .65 * (1 - t)); this.gfx.lineBetween(this.targetX + Math.cos(a) * 35, this.targetY + Math.sin(a) * 35, this.targetX + Math.cos(a) * C.ultRadius * .8, this.targetY + Math.sin(a) * C.ultRadius * .8); }
    }
    if (now < this.fieldUntil) {
      this.groundArt.setVisible(true).setFrame(Math.floor((C.ultFieldMs - this.fieldUntil + now) / 160) % 6).setPosition(this.targetX, this.targetY);
      // 特效型警示（默认）：火场外缘用红色杀气火舌圈（序列帧）标出，不再画 8 面小旗；缺图时照旧
      const ringArt = !TELEGRAPH_CLASSIC && HINT_MOCK === 'c' && warnFx(this.scene).ring('lubu-field', 'lubu', this.targetX, this.targetY, C.ultRadius, now, .55);
      if (!ringArt) warnCircle(this.gfx, this.targetX, this.targetY, C.ultRadius, 0, 0xdc5148, 0xffc77d, false, now);
      // Eight small perimeter standards, no opaque screen-sized glow.
      if (!ringArt) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, x = this.targetX + Math.cos(a) * C.ultRadius, y = this.targetY + Math.sin(a) * C.ultRadius; this.gfx.lineStyle(2, 0xd8b677, .8).lineBetween(x, y - 9, x, y + 6); this.gfx.fillStyle(0xa42e30, .9).fillTriangle(x, y - 9, x + 9, y - 5, x, y - 1); }
    }
  }
  private warning(t: number): void {
    this.warningArt.setVisible(true).setFrame(Math.min(7, Math.floor(t * 8))).setPosition(this.targetX, this.targetY);
    const r = C.ultRadius;
    // 首领大招预警保留但弱化（默认）：预警图从 0.3 调到 0.2，去掉实心外圈 / 进度圈 / 十字准星，改为落点地裂纹（?telegraph=1 恢复）
    if (!TELEGRAPH_CLASSIC) this.warningArt.setAlpha(HINT_MOCK === 'a' || HINT_MOCK === 'c' ? 0 : .2);
    // 特效型警示（默认）：方天戟虚影压下 + 红色杀气火舌圈；缺图时退回细虚线
    if (!TELEGRAPH_CLASSIC && HINT_MOCK === 'c' && warnFx(this.scene).warn('lubu-ult', 'lubu', this.targetX, this.targetY, r, t, this.now)) return;
    if (!TELEGRAPH_CLASSIC && HINT_MOCK === 'c') { keyOutline(this.gfx, this.targetX, this.targetY, r, t, this.now); return; }
    if (!TELEGRAPH_CLASSIC) { groundCracks(this.gfx, this.targetX, this.targetY, r, t); return; }
    // Fixed boundary markers distinguish the true hit area from the expanding countdown.
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4,x=this.targetX+Math.cos(a)*r,y=this.targetY+Math.sin(a)*r;
      this.gfx.lineStyle(3,0xffe0a3,.9).lineBetween(x-Math.cos(a)*6,y-Math.sin(a)*6,x,y);
    }
    this.gfx.lineStyle(3, 0xff6c4b, .9).strokeCircle(this.targetX, this.targetY, r);
    this.gfx.lineStyle(2, 0xffd08a, .8).strokeCircle(this.targetX, this.targetY, r * t);
    this.gfx.lineStyle(2, 0xffb67a, .85).lineBetween(this.targetX - 13, this.targetY, this.targetX + 13, this.targetY).lineBetween(this.targetX, this.targetY - 13, this.targetX, this.targetY + 13);
  }
  private paintMask(): void {
    this.mask.clear().fillStyle(0xffffff);
    for (let i = 0; i < 32; i++) { const a = i * Math.PI / 16, b = (i + 1) * Math.PI / 16; this.mask.fillTriangle(this.targetX, this.targetY, this.targetX + Math.cos(a) * C.ultRadius, this.targetY + Math.sin(a) * C.ultRadius, this.targetX + Math.cos(b) * C.ultRadius, this.targetY + Math.sin(b) * C.ultRadius); }
  }
  private body(kind: 'takeoff' | 'hover' | 'landing', frame: number, height: number): void {
    this.boss.sprite.setTexture(`lubu_ult_${kind}`, frame).setAlpha(1);
    // Processed cells share a hand-reviewed ground reference at (128,176).
    this.boss.sprite.setOrigin(.5, 176 / 256 - this.boss.radius * .7 / 218 + height / 218);
    this.boss.shadow.setVisible(height <= 0 && this.boss.active);
  }
  private restore(): void { this.boss.invulnerable = false; this.boss.controlImmune = false; this.boss.sprite.setTexture('boss_lubu', 'down_0').setOrigin(.5, this.origin).setAlpha(1); this.boss.shadow.setVisible(this.boss.active); }
  clear(): void { this.phase = 'idle'; this.fieldUntil = 0; this.gfx.clear(); this.slash.setVisible(false); this.groundArt.setVisible(false); this.warningArt.setVisible(false); this.restore(); }
  snapshot() { return { phase: this.phase, targetX: this.targetX, targetY: this.targetY, until: this.until, fieldRemaining: Math.max(0, this.fieldUntil - this.now), invulnerable: this.boss.invulnerable, controlImmune: this.boss.controlImmune }; }
}
