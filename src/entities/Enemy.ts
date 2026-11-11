import Phaser from 'phaser';
import { DEPTH } from '../config';
import { ENEMY_DEFS, type EnemyDef } from '../data/enemies';
import type { Ally } from './Ally';
import type { EnemyKind } from '../types';

/** 敌人（含精英与 Boss）：数值 + sprite；AI 行为在 GameScene 中调度。 */
let enemyUidSeq = 0;
const WALK_STRIDES: Partial<Record<EnemyKind, number>> = { infantry: 11, shield: 13, archer: 12, cavalry: 12, elite: 15 };

export class Enemy {
  static spawnSeq = 0;
  readonly uid: number = (enemyUidSeq += 1);
  /** 每次 spawn 递增的实例 ID：池复用后仍能区分新旧生成。 */
  spawnId = 0;
  targetAlly: Ally | null = null;
  targetLife = 0;
  readonly scene: Phaser.Scene;
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;

  kind: EnemyKind = 'infantry';
  /** 普通杂兵临时步动：记录基础缩放与相位。 */
  baseScaleY = 1;
  walkPhase = Math.random() * Math.PI * 2;
  /** 四方向行走（仅普通步兵启用）。 */
  static walkEnabled = true;
  walkSheet = '';
  attackSheet = '';
  attackUntil = 0;
  poseUntil = 0;
  chargeSheet = '';
  chargeState: 'none' | 'warn' | 'charge' | 'recover' = 'none';
  chargeAt = 0;
  chargeHit = false;
  chargeVx = 0;
  chargeVy = 0;
  private chargeFrame = '';
  private attackFrame = '';
  direction: 'down' | 'up' | 'left' | 'right' = 'down';
  private frameElapsed = 0;
  private walkDistance = 0;
  /** 本帧开始位置：用于碰撞/分离后的真实位移判断步态。 */
  frameStartX = 0;
  frameStartY = 0;
  intentDx = 0;
  intentDy = 0;
  moveVx = 0;
  moveVy = 0;
  private facingVx = 0;
  private facingVy = 0;
  private walking = false;
  private walkTimer = 0;
  private appliedFrame = '';
  def: EnemyDef = ENEMY_DEFS.infantry;
  hp = 1;
  maxHp = 1;
  active = false;
  invulnerable = false;
  controlImmune = false;
  stunUntil = 0;

  flashUntil = 0;
  private baseTint = 0xffffff;
  contactCd = 0;
  shootCd = 0;
  dashCd = 0;
  dashUntil = 0;
  orbitCd = 0;
  dashVx = 0;
  dashVy = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.shadow = scene.add.image(0, 0, 'shadow').setDepth(DEPTH.enemy - 1).setAlpha(0.5).setVisible(false);
    this.sprite = scene.add.image(0, 0, 'enemy_infantry').setDepth(DEPTH.enemy).setVisible(false);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get radius(): number {
    return this.def.radius;
  }

  spawn(x: number, y: number, def: EnemyDef, hpScale: number, now: number): void {
    this.def = def;
    this.kind = def.kind;
    this.spawnId = (Enemy.spawnSeq += 1);
    this.hp = Math.round(def.hp * hpScale);
    this.maxHp = this.hp;
    this.active = true;
    this.invulnerable = false;
    this.controlImmune = false;
    this.stunUntil = 0;
    this.targetAlly = null; this.targetLife = 0;
    this.flashUntil = 0;
    this.contactCd = 0;
    this.shootCd = 1 + Math.random();
    this.dashCd = 1.5;
    this.dashUntil = 0;
    this.orbitCd = 0;
    const aiScale: Record<string, number> = {
      enemy_infantry: 46 / 128,
      enemy_archer: 46 / 128,
      enemy_shield: 50 / 128,
      enemy_cavalry: 68 / 128,
      enemy_elite: 78 / 128,
      boss_zhangjiao: 120 / 192,
      boss_lubu: 110 / 64,
    };
    const visualScale = aiScale[def.texture] ?? (def.kind === 'boss' ? 1.45 : def.kind === 'elite' ? 1.35 : def.kind === 'cavalry' ? 1.4 : def.kind === 'shield' ? 1.5 : 1.6);
    this.sprite
      .setOrigin(.5)
      .setTexture(def.texture)
      .setScale(visualScale)
      .setPosition(x, y)
      .setVisible(true)
      .setActive(true)
      .setAlpha(1)
      .clearTint();
    this.baseTint = def.tint ?? 0xffffff;
    if (this.baseTint !== 0xffffff) this.sprite.setTint(this.baseTint);
    this.sprite.setRotation(0);
    this.baseScaleY = visualScale;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.direction = 'down';
    this.frameElapsed = 0;
    this.walkDistance = 0;
    this.frameStartX = x;
    this.frameStartY = y;
    this.intentDx = 0;
    this.intentDy = 0;
    this.moveVx = this.moveVy = this.facingVx = this.facingVy = 0;
    this.walking = false;
    this.walkTimer = 0;
    this.appliedFrame = '';
    this.walkSheet = '';
    const walkSheets: Partial<Record<EnemyKind, string>> = {
      infantry: 'enemy_infantry_walk_sheet',
      shield: 'enemy_shield_walk_sheet',
      archer: 'enemy_archer_walk_sheet',
      cavalry: 'enemy_cavalry_run_sheet',
      elite: 'enemy_officer_walk_sheet',
    };
    const sheetKey = def.walkVisual?.texture ?? walkSheets[this.kind];
    if (sheetKey && Enemy.walkEnabled && this.scene.textures.exists(sheetKey)) {
      this.walkSheet = sheetKey;
      // 行走表为 96 帧：按该兵种目标显示高度重新定缩放（校尉 78px、步兵 46px…）
      const displayHeights: Partial<Record<EnemyKind, number>> = {
        infantry: 46, shield: 50, archer: 46, cavalry: 68, elite: 78,
      };
      const displayH = displayHeights[this.kind] ?? 66;
      this.sprite.setScale(def.walkVisual?.scale ?? displayH / 96);
      this.sprite.setOrigin(.5, (def.walkVisual?.groundY ?? 94 / 96) - def.radius * .72 / (96 * this.sprite.scaleY));
      this.baseScaleY = this.sprite.scaleY;
      this.sprite.setTexture(this.walkSheet, 'down_0');
      this.appliedFrame = 'down_0';
    }
    if (def.texture === 'boss_lubu' && this.scene.textures.get('boss_lubu').has('down_0')) {
      this.sprite.setTexture('boss_lubu', 'down_0').setScale(218 / 256).setOrigin(.5, .875 - def.radius * .7 / 218);
      this.baseScaleY = this.sprite.scaleY;
    }
    this.attackSheet = '';
    this.attackUntil = 0;
    this.poseUntil = 0;
    this.attackFrame = '';
    if (!def.walkVisual && this.kind === 'archer' && this.scene.textures.exists('enemy_archer_attack_sheet')) {
      this.attackSheet = 'enemy_archer_attack_sheet';
    }
    this.chargeSheet = '';
    this.chargeState = 'none';
    this.chargeAt = 0;
    this.chargeHit = false;
    this.chargeVx = 0;
    this.chargeVy = 0;
    this.chargeFrame = '';
    if (this.kind === 'cavalry' && this.scene.textures.exists('enemy_cavalry_charge_sheet')) {
      this.chargeSheet = 'enemy_cavalry_charge_sheet';
    }
    const shadowSize = def.kind === 'boss'
      ? { w: 120, h: 50 }
      : def.kind === 'elite'
        ? { w: 70, h: 28 }
        : def.kind === 'cavalry'
          ? { w: 66, h: 26 }
          : def.kind === 'shield'
            ? { w: 54, h: 22 }
            : { w: 48, h: 19 };
    this.shadow
      .setVisible(true)
      .setPosition(x, y + def.radius * 0.7)
      .setDisplaySize(shadowSize.w, shadowSize.h)
      .setRotation(0);
    void now;
  }

  deactivate(): void {
    this.active = false;
    this.moveVx = this.moveVy = this.facingVx = this.facingVy = 0;
    this.intentDx = this.intentDy = 0;
    this.sprite.setVisible(false).setActive(false);
    this.shadow.setVisible(false);
  }

  /** 根据实际移动向量切换朝向；主轴判定 + 迟滞，避免斜向抖动。 */
  startCharge(now: number, dir: 'down' | 'up' | 'left' | 'right'): void {
    if (!this.chargeSheet) return;
    this.chargeState = 'warn';
    this.chargeAt = now + 450;
    this.chargeHit = false;
    this.direction = dir;
    // 冲锋表现复用奔跑表（charge 表切图有边缘/朝向问题，暂不使用）
    if (this.walkSheet) this.sprite.setTexture(this.walkSheet, `${dir}_${this.def.walkVisual ? 0 : 1}`);
    this.chargeFrame = this.walkSheet ? `${dir}_${this.def.walkVisual ? 0 : 1}` : '';
    this.sprite.setTint(0xff8888);
  }

  updateChargeVisual(now: number): void {
    if (!this.chargeSheet || this.chargeState === 'none') return;
    if (this.chargeState === 'warn' && now >= this.chargeAt) {
      this.chargeState = 'charge';
      this.chargeAt = now + 600;
      this.sprite.setTint(this.baseTint);
    } else if (this.chargeState === 'charge' && now >= this.chargeAt) {
      this.chargeState = 'recover';
      this.chargeAt = now + 350;
    } else if (this.chargeState === 'recover' && now >= this.chargeAt) {
      this.chargeState = 'none';
      this.sprite.setTint(this.baseTint);
      this.chargeFrame = '';
    }
    if (this.chargeState === 'none') return;
    if (!this.walkSheet) return;
    const frame = this.def.walkVisual ? (this.chargeState === 'charge' ? Math.floor(now / 90) % 4 : 0) : this.chargeState === 'charge' ? 2 : 1;
    const key = `${this.direction}_${frame}`;
    if (key !== this.chargeFrame) {
      this.sprite.setTexture(this.walkSheet, key);
      this.chargeFrame = key;
    }
  }

  startAttack(now: number, dir: 'down' | 'up' | 'left' | 'right'): void {
    if (!this.attackSheet && !this.def.walkVisual) return;
    this.attackUntil = now + 360;
    this.attackFrame = '';
    this.direction = dir;
    // Walk-only assets hold a neutral pose; never impersonate an attack animation.
    if (this.def.walkVisual) {
      this.sprite.setTexture(this.walkSheet, `${dir}_0`);
      return;
    }
    this.sprite.setTexture(this.attackSheet, `atk_${dir}_0`);
    this.attackFrame = `atk_${dir}_0`;
  }

  /** 攻击状态：0-180ms 拉弓帧，180-360ms 放箭帧。 */
  updateAttackVisual(now: number): void {
    if ((!this.attackSheet && !this.def.walkVisual) || this.attackUntil <= now) {
      if (this.attackUntil > 0) this.appliedFrame = '';
      this.attackUntil = 0;
      return;
    }
    if (this.def.walkVisual) return;
    const remain = this.attackUntil - now;
    const col = remain > 180 ? 0 : 1;
    const key = `atk_${this.direction}_${col}`;
    if (key !== this.attackFrame) {
      this.sprite.setTexture(this.attackSheet, key);
      this.attackFrame = key;
    }
  }

  holdAttackPose(now: number, angle: number, duration: number): void {
    if (!this.def.walkVisual || !this.walkSheet) return;
    this.poseUntil = now + duration;
    this.direction = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle)) ? (Math.cos(angle) < 0 ? 'left' : 'right') : (Math.sin(angle) < 0 ? 'up' : 'down');
    this.sprite.setTexture(this.walkSheet, `${this.direction}_0`);
    this.appliedFrame = '';
  }

  updateWalk(dt: number, dx: number, dy: number): void {
    if (!this.walkSheet) return;
    if (this.attackUntil > 0 || this.chargeState !== 'none' || this.poseUntil > ((this.scene as Phaser.Scene & { combatNow?: number }).combatNow ?? 0)) return;
    const moved = Math.hypot(dx, dy);
    const actualSpeed = moved / Math.max(dt, 0.0001);
    const intentSpeed = Math.hypot(this.intentDx, this.intentDy) / Math.max(dt, 0.0001);
    // 主动移动才算走：意图速度够 + 实际有位移；被挤开不算
    const startSpeed = Math.min(12, this.def.speed * .18);
    const stopSpeed = Math.min(5, this.def.speed * .08);
    const wantsMove = intentSpeed >= startSpeed && actualSpeed >= startSpeed;
    if (wantsMove) this.walkTimer += dt;
    else this.walkTimer = 0;
    if (this.walkTimer >= 0.08) this.walking = true;
    if (intentSpeed < stopSpeed || actualSpeed < stopSpeed) this.walking = false;

    if (this.walking) {
      const blend = 1 - Math.exp(-12 * dt);
      this.facingVx += (dx / Math.max(dt, .0001) - this.facingVx) * blend;
      this.facingVy += (dy / Math.max(dt, .0001) - this.facingVy) * blend;
      const ax = Math.abs(this.facingVx);
      const ay = Math.abs(this.facingVy);
      let next = this.direction;
      if (ax > ay * 1.35) next = this.facingVx < 0 ? 'left' : 'right';
      else if (ay > ax * 1.35) next = this.facingVy < 0 ? 'up' : 'down';
      if (next !== this.direction && this.frameElapsed > 0.16) {
        this.direction = next;
        this.frameElapsed = 0;
      }
      this.frameElapsed += dt;
      this.walkDistance += moved;
    } else {
      this.walkDistance = 0;
    }
    const stride = WALK_STRIDES[this.kind] ?? 18;
    const frame = this.walking ? Math.floor(this.walkDistance / stride) % 4 : 0;
    const key = `${this.direction}_${frame}`;
    if (key !== this.appliedFrame || this.sprite.texture.key !== this.walkSheet) {
      this.sprite.setTexture(this.walkSheet, key);
      this.appliedFrame = key;
    }
  }

  flash(now: number): void {
    this.flashUntil = now + 70;
    this.sprite.setTintFill(0xffffff);
    if (this.kind === 'elite' || this.kind === 'boss') this.sprite.setTintFill(0xffdddd);
  }

  updateVisual(now: number): void {
    if (this.flashUntil > 0 && now >= this.flashUntil) {
      this.flashUntil = 0;
      this.sprite.setTint(this.baseTint);
    }
  }
}
