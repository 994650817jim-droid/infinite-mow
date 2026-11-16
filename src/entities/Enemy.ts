import {visualTextureKey} from '../systems/ReadableTextures';
import {figureCorrection,sheetFigureHeight} from '../systems/SpriteMetrics';
import {isV2Texture, V2_TROOP_SCALE, v2TroopGround} from '../systems/ArtStyle';
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
  isSupplySlot=false;
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
  /** 素材比例校正倍数（按行走表标准身高统一攻击表与个别画小的帧）。 */
  frameScale = 1;
  private stepStretch = 0;
  private baseOriginY = .5;
  /** 步伐相位：每 1.0 换一帧；按实际速度自适应步幅，慢速被挤动时也保持每秒约 7 次换帧。 */
  private stepPhase = 0;
  walkPhase = Math.random() * Math.PI * 2;
  /** 四方向行走（仅普通步兵启用）。 */
  static walkEnabled = true;
  walkSheet = '';
  attackSheet = '';
  /** 出手时长超过 360ms 时（蓄力），蓄力段停在攻击图的第几帧（张梁砍击用 1 = 抬刀）。 */
  windupCol = 0;
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
  /** 盾牌兵两段血（data/shields.ts）：当前盾值与上限，0 表示没有盾。 */
  shieldHp = 0;
  shieldMax = 0;
  hp = 1;
  maxHp = 1;
  active = false;
  invulnerable = false;
  controlImmune = false;
  stunUntil = 0;
  martialSlow = 1;
  martialSlowUntil = 0;

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
    this.martialSlow=1;this.martialSlowUntil=0;
    this.spawnId = (Enemy.spawnSeq += 1);
    this.hp = Math.round(def.hp * hpScale);
    this.shieldHp = this.shieldMax = 0;
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
      // 普通兵按人物实际像素身高统一：不同章节/批次的素材留白不同，按格子缩放会一高一矮。
      const figureTarget: Partial<Record<EnemyKind, number>> = { infantry: 48, archer: 46, shield: 50 };
      const median = figureTarget[this.kind] && !def.walkVisual?.matched ? sheetFigureHeight(this.scene, sheetKey) : undefined;
      this.sprite.setScale(median ? figureTarget[this.kind]! / median : def.walkVisual?.scale ?? displayH / 96);
      const frameH = this.scene.textures.getFrame(sheetKey, 'down_0')?.height ?? 96;
      this.sprite.setOrigin(.5, (def.walkVisual?.groundY ?? 94 / 96) - def.radius * .72 / (frameH * this.sprite.scaleY));
      this.baseScaleY = this.sprite.scaleY;
      this.baseOriginY = this.sprite.originY;
      this.frameScale = 1;
      this.applyFrame(this.walkSheet, 'down_0');
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
    if(def.attackVisual&&this.scene.textures.exists(def.attackVisual))this.attackSheet=def.attackVisual;
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

  /** 盾破：换成无盾造型（同章步兵行走表），保留生命、位置与编号；keepLook 时只去掉盾值（飞熊军等专属造型）。 */
  dropShield(look: EnemyDef | null): void {
    this.shieldHp = 0;
    if (look) this.reskin(look);
  }
  /** 换造型（行走表 / 攻击表 / 色调），保留生命、位置与编号：碎盾换步兵、董卓正式图加载完成后换图。 */
  reskin(look: EnemyDef): void {
    const sheet = look.walkVisual?.texture ?? 'enemy_infantry_walk_sheet';
    this.def = {...this.def, texture: look.texture, walkVisual: look.walkVisual, attackVisual: look.attackVisual, tint: look.tint};
    this.baseTint = look.tint ?? 0xffffff; this.sprite.clearTint(); if (this.baseTint !== 0xffffff) this.sprite.setTint(this.baseTint);
    if (!Enemy.walkEnabled || !this.scene.textures.exists(sheet)) return;
    this.walkSheet = sheet; this.attackSheet = look.attackVisual && this.scene.textures.exists(look.attackVisual) ? look.attackVisual : '';
    const median = !look.walkVisual?.matched ? sheetFigureHeight(this.scene, sheet) : undefined;
    this.sprite.setScale(median ? 48 / median : look.walkVisual?.scale ?? 46 / 96);
    const frameH = this.scene.textures.getFrame(sheet, 'down_0')?.height ?? 96;
    this.sprite.setOrigin(.5, (look.walkVisual?.groundY ?? 94 / 96) - this.def.radius * .72 / (frameH * this.sprite.scaleY));
    this.baseScaleY = this.sprite.scaleY; this.baseOriginY = this.sprite.originY;
    this.appliedFrame = ''; this.applyFrame(this.walkSheet, `${this.direction}_0`); this.appliedFrame = `${this.direction}_0`;
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
    // 冲锋表现复用奔跑表（v1 charge 表切图有边缘/朝向问题，暂不使用）；v2 冲锋表干净，直接用：勒马蓄势帧
    if (isV2Texture(this.chargeSheet)) { this.applyFrame(this.chargeSheet, `${dir}_0`); this.chargeFrame = `${dir}_0`; this.sprite.setTint(0xff8888); return; }
    if (this.walkSheet) this.applyFrame(this.walkSheet, `${dir}_${this.def.walkVisual ? 0 : 1}`);
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
    if (isV2Texture(this.chargeSheet)) {
      // v2 冲锋表 4 帧：0 勒马蓄势 / 1~2 冲刺交替 / 3 收缰
      const col = this.chargeState === 'warn' ? 0 : this.chargeState === 'charge' ? 1 + Math.floor(now / 110) % 2 : 3, key = `${this.direction}_${col}`;
      if (key !== this.chargeFrame) { this.applyFrame(this.chargeSheet, key); this.chargeFrame = key; }
      return;
    }
    if (!this.walkSheet) return;
    const frame = this.def.walkVisual ? (this.chargeState === 'charge' ? Math.floor(now / 90) % 4 : 0) : this.chargeState === 'charge' ? 2 : 1;
    const key = `${this.direction}_${frame}`;
    if (key !== this.chargeFrame) {
      this.applyFrame(visualTextureKey(this.scene,this.walkSheet), key);
      this.chargeFrame = key;
    }
  }

  startAttack(now: number, dir: 'down' | 'up' | 'left' | 'right'): void {
    if (!this.attackSheet && !this.def.walkVisual) return;
    this.attackUntil = now + 360;
    this.attackFrame = '';
    this.direction = dir;
    // Walk-only assets hold a neutral pose; never impersonate an attack animation.
    if (this.def.walkVisual && !this.def.attackVisual) {
      this.applyFrame(this.walkSheet, `${dir}_0`);
      return;
    }
    this.applyFrame(visualTextureKey(this.scene,this.attackSheet), this.def.attackVisual?`${dir}_0`:`atk_${dir}_0`);
    this.attackFrame = `atk_${dir}_0`;
  }

  /** 攻击状态：0-180ms 拉弓帧，180-360ms 放箭帧。 */
  updateAttackVisual(now: number): void {
    if ((!this.attackSheet && !this.def.walkVisual) || this.attackUntil <= now) {
      if (this.attackUntil > 0) this.appliedFrame = '';
      this.attackUntil = 0;
      return;
    }
    if (this.def.walkVisual && !this.def.attackVisual) return;
    const remain = this.attackUntil - now;
    const col = remain > 180 ? 0 : 1;
    const key = this.def.attackVisual ? `${this.direction}_${remain > 360 ? this.windupCol : Math.min(3,Math.max(0,Math.floor((360-remain)/90)))}`/* 出手时长 >360ms 时开头会算出 -1 帧 */ : `atk_${this.direction}_${col}`;
    if (key !== this.attackFrame) {
      this.applyFrame(visualTextureKey(this.scene,this.attackSheet), key);
      this.attackFrame = key;
    }
  }

  holdAttackPose(now: number, angle: number, duration: number): void {
    if (!this.def.walkVisual || !this.walkSheet) return;
    this.poseUntil = now + duration;
    this.direction = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle)) ? (Math.cos(angle) < 0 ? 'left' : 'right') : (Math.sin(angle) < 0 ? 'up' : 'down');
    this.applyFrame(this.walkSheet, `${this.direction}_0`);
    this.appliedFrame = '';
  }

  updateWalk(dt: number, dx: number, dy: number): void {
    if (!this.walkSheet) return;
    if (this.attackUntil > 0 || this.chargeState !== 'none' || this.poseUntil > ((this.scene as Phaser.Scene & { combatNow?: number }).combatNow ?? 0)) return;
    const moved = Math.hypot(dx, dy);
    const actualSpeed = moved / Math.max(dt, 0.0001);
    const intentSpeed = Math.hypot(this.intentDx, this.intentDy) / Math.max(dt, 0.0001);
    // 按实际位移判定走路：与蜀军缠斗、相互挤开、被友军推着走时也播放步伐，避免定格站立帧“平移”。
    // 单帧位移远超自身步速视为被击退/冲撞，不算走路。
    const startSpeed = Math.min(12, this.def.speed * .18);
    const stopSpeed = Math.min(5, this.def.speed * .08);
    const shoved = moved > Math.max(5, this.def.speed * Math.max(dt, 1 / 60) * 2.5);
    const wantsMove = !shoved && actualSpeed >= startSpeed;
    if (wantsMove) this.walkTimer += dt;
    else if (!shoved) this.walkTimer = 0;
    if (this.walkTimer >= 0.06) this.walking = true;
    if (actualSpeed < stopSpeed) this.walking = false;
    const intended = intentSpeed >= startSpeed;

    // The newer 4-frame Yellow Turban sheets have a short, readable step cycle.
    const stride = this.walkSheet==='yellow_spear_walk'?7:this.walkSheet.startsWith('yellow_')?10:WALK_STRIDES[this.kind] ?? 18;
    if (this.walking && !shoved) {
      // 朝向跟随自己的移动意图；纯被推挤时保持原朝向（不随推力乱转身）。
      const blend = 1 - Math.exp(-12 * dt);
      const fx = intended ? this.intentDx : 0, fy = intended ? this.intentDy : 0;
      if (intended) {
        this.facingVx += (fx / Math.max(dt, .0001) - this.facingVx) * blend;
        this.facingVy += (fy / Math.max(dt, .0001) - this.facingVy) * blend;
      }
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
      // Tie cadence to travelled distance so eased movement and low FPS stay in sync, but never
      // slower than ~7 frame changes per second (slow archers / crowd-pushed units no longer slide).
      const effStride = Math.min(stride, Math.max(4, actualSpeed / 7));
      this.stepPhase += moved / effStride;
    } else if (!this.walking) {
      this.walkDistance = 0;
      this.stepPhase = 0;
    }
    const frame = this.walking ? Math.floor(this.stepPhase) % 4 : 0;
    const key = `${this.direction}_${frame}`;
    if (key !== this.appliedFrame || this.sprite.texture.key !== visualTextureKey(this.scene,this.walkSheet)) {
      this.applyFrame(visualTextureKey(this.scene,this.walkSheet), key);
      this.appliedFrame = key;
    }
    // 行走帧本身腿部变化很小（尤其正对/背对镜头）：叠加每步约 2.5px 的上下起伏、伸缩与左右摆动，
    // 缩到 50px 左右也能一眼看出在走。
    const step = this.walking ? Math.sin(Math.PI * this.stepPhase) : 0;
    this.stepStretch = Math.abs(step);
    this.sprite.setRotation(step * (this.direction === 'left' || this.direction === 'right' ? .06 : .05));
    this.applyScale();
  }

  /** 设置帧并按素材比例校正缩放；非行走调用会清除步伐摆动。 */
  private applyFrame(key: string, frame: string): void {
    this.sprite.setTexture(key, frame);
    if (isV2Texture(key)) {
      // 人物画风 v2：0.5 倍（1080p 像素 1:1），脚底 = 帧高-7；行走 / 攻击格子大小可以不同，按当前帧重算锚点
      const fh = this.sprite.frame.height || 96;
      this.baseScaleY = V2_TROOP_SCALE;
      this.baseOriginY = v2TroopGround(fh) - this.def.radius * .72 / (fh * V2_TROOP_SCALE);
      this.frameScale = 1;
    } else
    this.frameScale = this.walkSheet && this.kind !== 'boss' && !this.def.walkVisual?.matched ? figureCorrection(this.scene, this.walkSheet, key, frame) : 1;
    this.stepStretch = 0;
    this.sprite.setRotation(0);
    this.applyScale();
  }

  private applyScale(): void {
    if (!this.walkSheet) return;
    const k = this.baseScaleY * this.frameScale;
    this.sprite.setScale(k * (1 - .025 * this.stepStretch), k * (1 + .05 * this.stepStretch));
    // 起伏：抬高原点即整体上移（脚底阴影不动），每步最高约 2.5 像素。
    this.sprite.setOrigin(this.sprite.originX, this.baseOriginY + 2.5 * this.stepStretch / Math.max(1, this.sprite.frame.height * k));
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
