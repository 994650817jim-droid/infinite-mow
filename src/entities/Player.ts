import { SCHOOL_TIER } from '../data/schools';
import {visualTextureKey} from '../systems/ReadableTextures';
import {framesFigure, sheetFigureHeight} from '../systems/SpriteMetrics';
import {ACTION_MS, HERO_ACTIONS, IDLE_FRAME_MS, ZHUGE_FALLBACK, type ActionFrame, type HeroActionKind, type HeroActionSet} from '../data/heroActions';
import type {CharacterId} from '../data/characters';
import Phaser from 'phaser';
import { CharacterPassives } from '../systems/CharacterPassives';
import { RunGrowth, xpToNext } from '../systems/RunGrowth';
import { BALANCE, DEPTH, FONT, actorDepth } from '../config';
import type { PlayerStats, WeaponState } from '../types';
import { WalkGait } from '../systems/WalkGait';
import { DRAG_WALK_SHEET } from '../data/dragArt';
import { HERO_ACTION_SCALE } from '../data/heroActionFit';
import { isV2Texture, V2_MARKER_LIFT, V2_WALK_DISPLAY, V2_WALK_ORIGIN_Y } from '../systems/ArtStyle';

/**
 * 枪将普攻节奏（260ms）：蓄力 31ms → 刺出 36ms → 刺到底 109ms → 收枪 84ms。
 * 枪芒在出手后约 18–72ms 伸出、72ms 起逐枪结算伤害（多枪每枪晚 25ms），
 * 让“刺到底”帧从 68ms 停到约 176ms，命中判定都落在这一帧上。均分时它要到 130ms 才出现，比伤害晚一拍。
 */
/**
 * 刀将（偃月刀，出手当帧即结算伤害）：举刀只留 16ms，下劈 42ms，砍到底帧 57–172ms，收刀 88ms。
 * 均分时砍到底要到 130ms 才出现，刀光与掉血明显早于挥刀动作。
 * 弓弩 / 火旗（箭与挥旗特效都在出手当帧生成）：拉弓 10ms、满弓 21ms，放箭 / 挥扇帧 31–161ms；
 * 均分时放箭帧到 130ms 才出现，箭已飞出约 70 像素。
 */
const ATTACK_WEIGHTS: Partial<Record<CharacterId, readonly number[]>> = (() => { const w = [.12, .14, .42, .32] as const, blade = [.06, .16, .44, .34] as const, release = [.04, .08, .50, .38] as const;
  return {zhaoyun: w, machao: w, zhangfei: w, guanyu: blade, weiyan: blade, liubei: blade, huangzhong: release, huangyueying: release, zhuge: release, pangtong: release, sunshangxiang: release, diaochan: release}; })();
function weightedIndex(t: number, n: number, weights?: readonly number[]): number {
  if (!weights) return Math.min(n - 1, Math.floor(t * n));
  let acc = 0; for (let i = 0; i < n; i++) { acc += weights[i]; if (t < acc) return i; }
  return n - 1;
}

/** 赵云：位置/生命/等级/属性。表现层只负责把 sprite 摆到位。 */
export class Player {
  armyDamageTakenMul = 1;
  readonly passive = new CharacterPassives();
  growth = new RunGrowth('zhaoyun');
  readonly scene: Phaser.Scene;
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  private readonly commandRing:Phaser.GameObjects.Graphics;
  private readonly commandGlow:Phaser.GameObjects.Image;
  private readonly markerLabel: Phaser.GameObjects.Text;
  private readonly marker: Phaser.GameObjects.Graphics;

  hp: number = BALANCE.player.maxHp;
  level = 1;
  xp = 0;
  /** 本场累计获得的经验（已乘来源倍率；等级 / 经验即武将等级，见 data/heroLevels.ts）。 */
  runXp = 0;
  /** 到武将等级上限后多出来的经验（超过「再存 1 级」的部分，结算时每 50 折 1 军粮）。 */
  overflowXp = 0;
  xpNext = 16;
  alive = true;
  invulnUntil = 0;
  damageImmune = false;
  damageGuard?: (damage:number,now:number)=>number;
  /** 骑马（HeroMount）：受伤先经马挡、移速倍率、骑者抬高的像素。 */
  mountGuard?: (damage:number,now:number)=>number;
  mountSpeedMul = 1;
  riseY = 0;

  stats: PlayerStats = {
    damageMul: 1,
    cooldownMul: 1,
    moveMul: 1,
    critChance: 0.05,
    regen: 0.25,
    pickupRadius: BALANCE.player.pickupRadius,
    armor: 0,
    maxHpBonus: 0,
    meleeMul: 1,
    arrowMul: 1,
    fireMul: 1,
    fireAreaMul: 1,
    damageTakenMul: 1,
  };


  weapons: WeaponState[] = [{ id: 'spear_orbit', level: 1, cooldownLeft: 0 }];

  knockedUntil = 0;
  private knockedAt = 0;
  private knockVx = 0;
  private knockVy = 0;
  private faceLeft = false;
  direction: 'down' | 'up' | 'left' | 'right' = 'down';
  private forcedDir: 'down' | 'up' | 'left' | 'right' | null = null;
  private forcedUntil = 0;
  private walkPhase = 0;
  /** 画面朝向（选行走帧用）：斜向移动优先侧面帧；direction 仍按主轴，供武器 / 坐骑等玩法逻辑使用。 */
  private facing: 'down' | 'up' | 'left' | 'right' = 'down';
  /** 最近一次移动的方向（单位向量，键盘 / 手柄都经 move 进来；站定时保持上一次）。马超冲锋按它「朝头前冲」。 */
  heading = { x: 0, y: 1 };
  /** 步态（步频随移速、起伏、前倾、阴影、扬尘，src/systems/WalkGait.ts）。 */
  readonly gait: WalkGait;
  private gaitHero = '';
  private gaitLift = 0;
  /** 行走帧整格的显示高度（逻辑像素）。v2 整格 88（原生 176，全屏 1080p 下像素 1:1），v1 为 66。 */
  private get targetHeight(): number { return isV2Texture(this.walkSheet) ? V2_WALK_DISPLAY : 66; }
  /** 行走帧纵向锚点：v1 居中；v2 让脚底仍落在中心下方 31 像素。 */
  /** 停步帧：v2 行走图有 <方向>_stand（双脚并拢的站立帧，见 ArtStyle.rotateV2StandFrames），否则用 <方向>_0。 */
  private standFrame(key: string, dir: string): string { const t = this.scene.textures.get(key); return t.has(`${dir}_stand`) ? `${dir}_stand` : `${dir}_0`; }
  private get walkOriginY(): number { return isV2Texture(this.walkSheet) ? V2_WALK_ORIGIN_Y : .5; }
  /** 「主将」标记离精灵中心的高度。 */
  private get markerLift(): number { return isV2Texture(this.walkSheet) ? V2_MARKER_LIFT : 38; }
  /** 当前帧的纵向锚点（行走帧 0.5；动作帧按脚线换算，使站姿脚底与行走时同一位置）。 */
  private baseOriginY = .5;
  /** 每套动作图集相对行走表的统一缩放与锚点（按待机站姿测量，一次计算后缓存）。 */
  private actionFit = new Map<string, { k: number; originY: number; foot: number; frameH: number }>();
  private readonly charTexture = 'hero_zhaoyun';
  /** 当前使用的行走表 key；关羽/黄忠正式素材到位后替换。 */
  walkSheet = 'hero_walk_sheet';
  /** 动作层（HERO_ACTIONS_PLAN.md）：当前武将的动作素材与正在播放的动作。 */
  private actionSet?: HeroActionSet;
  /** 招牌技动作的节流（战斗时间，黄忠用）。 */
  nextSkillAction = 0;
  private action: {kind: HeroActionKind; frames: ActionFrame[]; mirror: boolean; start: number; until: number; hold: boolean; weights?: readonly number[]; texture?: string} | null = null;
  /** 本帧是否在用拖刀行走图（关羽学了拖刀斩且在移动；DraggingBladeFx 据此把火星放到刀尖）。 */
  dragWalking = false;
  /** 当前武将普攻四帧的时长占比（蓄力 / 出手 / 命中 / 收势）；未设置时四帧均分。 */
  private attackWeights?: readonly number[];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.gait = new WalkGait(scene);
    scene.events.once('shutdown', () => this.gait.destroy());
    this.shadow = scene.add.image(x, y + 16, 'shadow').setDisplaySize(48, 20).setDepth(DEPTH.enemy - 1).setAlpha(0.8);
    this.sprite = scene.add.image(x, y, 'hero_zhaoyun').setDepth(actorDepth(y + 26));
    this.commandRing=scene.add.graphics().setDepth(DEPTH.enemy-.7);
    // 主将脚下：暖金色地面柔光 + 两段缓慢旋转的细金弧（取代原先深色/金/青三层椭圆与侧点，减少瞄准圈感）。
    if(!scene.textures.exists('hero-ground-glow')){const c=document.createElement('canvas');c.width=128;c.height=48;const g=c.getContext('2d')!;g.translate(64,24);g.scale(1,24/64);const r=g.createRadialGradient(0,0,4,0,0,62);r.addColorStop(0,'rgba(255,214,140,0)');r.addColorStop(.55,'rgba(255,206,120,.22)');r.addColorStop(.82,'rgba(240,186,96,.30)');r.addColorStop(1,'rgba(240,186,96,0)');g.fillStyle=r;g.beginPath();g.arc(0,0,64,0,Math.PI*2);g.fill();scene.textures.addCanvas('hero-ground-glow',c);}
    this.commandGlow=scene.add.image(x,y+21,'hero-ground-glow').setDisplaySize(54,20).setDepth(DEPTH.enemy-.8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(.9);
    this.marker=scene.add.graphics().setDepth(DEPTH.fx+1);
    this.marker.fillStyle(0x17251c).fillTriangle(-7,-3,7,-3,0,6)
      .fillStyle(0xf3e6b0).fillTriangle(-4,-1,4,-1,0,3);
    this.marker.setPosition(x,y-38);
    this.markerLabel=scene.add.text(x,y-45,'主将',{fontFamily:FONT,fontSize:'12px',resolution:2,color:'#f3e6b0',stroke:'#16241b',strokeThickness:3}).setOrigin(.5,1).setDepth(DEPTH.hud-1);
    this.applyTextureScale();
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get maxHp(): number {
    return BALANCE.player.maxHp + this.stats.maxHpBonus + this.growth.bonusMaxHp();
  }

  get radius(): number {
    return BALANCE.player.radius;
  }

  /** 地形减速（第九章洪水涉水等），场景每帧设置，默认 1。 */
  envSpeedMul = 1;
  /** 地形（河水）移动倍率：GameScene 每帧按所站位置设，水里 0.6（data/terrain.ts） */
  terrainSpeedMul = 1;
  /** 打碎甲胄架 / 盾牌堆偶得的短时减伤：截止时间与受伤倍率（data/propLoot.ts PROP_LOOT.armor） */
  propGuardUntil = 0; propGuardMul = 1;
  get speed(): number {
    return BALANCE.player.speed * Math.min(1.6, this.stats.moveMul * this.growth.movementMultiplier()*(this.growth.build.tier('cavalry')>=2?1+SCHOOL_TIER.cavalry.move:1)) * this.mountSpeedMul * this.envSpeedMul * this.terrainSpeedMul;
  }

  /** 被外力击退 / 挑起；self 为自己的突进（冲锋、龙胆突刺）。马超冲锋无敌中不被外力击退。 */
  knockUp(now: number, duration: number, dx: number, dy: number, self = false): void {
    if (!self && this.passive.isInvulnerable(now)) return;
    this.knockedAt = now; this.knockedUntil = now + duration;
    this.knockVx = dx / (duration / 1000); this.knockVy = dy / (duration / 1000);
  }
  move(dt: number, vx: number, vy: number): void {
    // Keep the identification marker above crowds, but let the body pass behind buildings.
    this.sprite.setDepth(actorDepth(this.y + 26) + .002);
    const now = (this.scene as Phaser.Scene & { combatNow?: number }).combatNow ?? this.scene.time.now;
    if (now < this.knockedUntil) {
      this.sprite.x += this.knockVx * dt * this.terrainSpeedMul; this.sprite.y += this.knockVy * dt * this.terrainSpeedMul; // 河里被击退 / 马超锦马冲锋也减速
      this.applyWalkVisual(this.stepGait(dt, false)); this.applyGaitPose(dt); return;
    }
    const len = Math.hypot(vx, vy);
    let moving = false;
    if (len > 0.001) {
      const nx = vx / len;
      const ny = vy / len;
      moving = true;
      this.heading.x = nx; this.heading.y = ny;
      this.sprite.x += nx * this.speed * dt;
      this.sprite.y += ny * this.speed * dt;
      // 四方向朝向：左右翻转，上下使用不同行走帧（有素材时）或占位步态
      const forced = this.forcedDir && ((this.scene as Phaser.Scene & { combatNow?: number }).combatNow ?? this.scene.time.now) < this.forcedUntil ? this.forcedDir : null;
      this.direction = forced ?? (Math.abs(nx) > Math.abs(ny) ? (nx < 0 ? 'left' : 'right') : ny < 0 ? 'up' : 'down');
      // 骑马时马匹按 direction 出帧，骑者保持一致
      this.facing = forced ?? (this.riseY > 0 ? this.direction : this.sideFacing(nx, ny));
      this.faceLeft = this.facing === 'left';
      this.passive.onMove(now); // 孙尚香：移动积疾步
    }
    // 行走表本身已经分方向，不能再翻转，否则向左会变成向右
    const directional = this.scene.textures.exists('hero_walk_sheet') || this.scene.textures.exists(`hero_walk_${this.direction}_0`);
    this.sprite.setFlipX(directional ? false : this.faceLeft);
    this.applyWalkVisual(this.stepGait(dt, moving));
    this.applyGaitPose(dt);
  }

  /** 斜向优先用侧面帧（侧面帧腿部动作最明显）；带回滞，摇杆在 45° 附近不来回跳行。 */
  private sideFacing(nx: number, ny: number): 'down' | 'up' | 'left' | 'right' {
    const side = this.facing === 'left' || this.facing === 'right';
    return Math.abs(nx) >= Math.abs(ny) * (side ? .45 : .65) ? (nx < 0 ? 'left' : 'right') : ny < 0 ? 'up' : 'down';
  }

  /** 推进步态：步频按当前实际移速换算；返回本帧是否仍在行走。 */
  private stepGait(dt: number, moving: boolean): boolean {
    const hero = this.growth.character;
    if (hero !== this.gaitHero) { this.gaitHero = hero; this.gait.setHero(hero); }
    const steps = this.gait.steps;
    this.gait.advance(dt, moving ? this.speed : 0);
    this.walkPhase = this.gait.phase;
    // 落脚扬尘（骑马时由马蹄负责，不出）
    if (moving && this.gait.steps > steps && this.riseY <= 0) this.gait.puff(this.x, this.y + 25, this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0);
    return moving;
  }

  /** 把步态叠到当前帧（行走帧或攻击等动作帧）上：缩放、前倾、起伏（在 update 里并入锚点）、阴影。 */
  private applyGaitPose(dt: number): void {
    const pose = this.gait.pose(this.facing, this.riseY > 0);
    this.gaitLift = pose.lift;
    this.sprite.setScale(this.sprite.scaleX * pose.scaleX, this.sprite.scaleY * pose.scaleY).setRotation(pose.rotation);
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 26).setDisplaySize(pose.shadowW, pose.shadowH).setAlpha(pose.shadowAlpha);
    this.gait.updateDust(dt);
  }

  /** 攻击时短暂面向目标方向，结束后恢复移动面向。 */
  faceDirection(dir: 'down' | 'up' | 'left' | 'right', ms = 130): void {
    this.forcedDir = dir;
    this.forcedUntil = ((this.scene as Phaser.Scene & { combatNow?: number }).combatNow ?? this.scene.time.now) + ms;
    this.direction = dir; this.facing = dir;
    this.faceLeft = dir === 'left';
    if (this.playAction('attack', dir)) return;
    if (this.scene.textures.exists(this.walkSheet) && this.scene.textures.get(this.walkSheet).has(`${dir}_0`)) {
      const key = visualTextureKey(this.scene,this.walkSheet); this.sprite.setTexture(key, this.standFrame(key, dir));
    }
  }

  /** 按武将设置动作素材；没有素材的武将保持原样（只有行走）。 */
  setActionSet(id: CharacterId): void { this.attackWeights = ATTACK_WEIGHTS[id]; let set = HERO_ACTIONS[id]; if (id === 'zhuge' && set && !this.scene.textures.exists(set.texture)) set = ZHUGE_FALLBACK; this.actionSet = set && this.scene.textures.exists(set.texture) ? set : undefined; this.action = null; }
  get hasActions(): boolean { return !!this.actionSet; }
  /** 当前动作（测试与调试用）。 */
  get currentAction(): HeroActionKind | null { return this.action && (this.action.hold || this.clock() < this.action.until) ? this.action.kind : null; }
  private clock(): number { return (this.scene as Phaser.Scene & { combatNow?: number }).combatNow ?? this.scene.time.now; }
  /**
   * 播放动作。优先级：倒地 / 胜利 > 招牌技 > 受伤 > 普攻；招牌技播放中不被普攻、受伤打断。
   * 没有对应素材时返回 false（招牌技缺图时用普攻帧代替）。
   */
  /** 放招牌技 / 专属武艺时（playAction('skill')）回调：出招起手特效（systems/HeroCastFx.ts），动作没播成也算出手 */
  onSkillAction?: () => void;
  playAction(kind: HeroActionKind, dir: 'down' | 'up' | 'left' | 'right' = this.direction): boolean {
    if (kind === 'skill') this.onSkillAction?.();
    const set = this.actionSet; if (!set) return false;
    const now = this.clock(), cur = this.currentAction;
    if (cur === 'die' || cur === 'win') return false;
    if (cur === 'skill' && (kind === 'attack' || kind === 'hurt')) return false;
    if (cur === 'hurt' && kind === 'attack') return false;
    let frames: ActionFrame[] | undefined, mirror = false;
    if (kind === 'attack' || (kind === 'skill' && !set.skill?.length)) {
      if (dir === 'left') { frames = set.attack.left ?? set.attack.right; mirror = !set.attack.left; } else frames = set.attack[dir];
    } else { frames = set[kind]; mirror = dir === 'left'; }
    if (!frames?.length) return false;
    // 胜利 / 倒地发生在结算时：战斗时钟已停、主角不再更新，改用真实时钟并由计时器逐帧刷新
    const hold = kind === 'win' || kind === 'die', start = hold ? this.scene.time.now : now;
    this.action = {kind, frames, mirror, start, until: start + ACTION_MS[kind], hold, weights: kind === 'attack' && this.attackWeights?.length === frames.length ? this.attackWeights : undefined};
    this.renderAction(false);
    // 结算后场景计时器暂停（time.paused），改挂每帧的 postupdate，播完自动解除
    if (hold) { const tick = (): void => { if (!this.action?.hold || !this.sprite.active) { this.scene.events.off('postupdate', tick); return; } this.renderAction(false); if (this.scene.time.now >= this.action.until + 60) this.scene.events.off('postupdate', tick); }; this.scene.events.on('postupdate', tick); this.scene.events.once('shutdown', () => this.scene.events.off('postupdate', tick)); }
    return true;
  }
  /** 动作或待机帧；返回 true 表示已覆盖行走帧。 */
  private renderAction(moving: boolean): boolean {
    const set = this.actionSet; if (!set) return false;
    const a = this.action, now = a?.hold ? this.scene.time.now : this.clock();
    let frame: ActionFrame | undefined, mirror = false;
    if (a && (a.hold || now < a.until)) {
      const t = Math.min(.999, Math.max(0, (now - a.start) / Math.max(1, a.until - a.start)));
      frame = a.frames[a.hold && now >= a.until ? a.frames.length - 1 : weightedIndex(t, a.frames.length, a.weights)]; mirror = a.mirror;
    } else {
      if (a) {
        // 动作结束：站着不动时行走层不会换帧，须主动切回当前朝向的站立帧
        this.action = null;
        if (this.scene.textures.exists(this.walkSheet)) { const key = visualTextureKey(this.scene, this.walkSheet); this.sprite.setTexture(key, this.standFrame(key, this.facing)).setFlipX(false); this.applyTextureScale(moving); }
      }
      if (moving || !set.idle?.length || this.facing !== 'down') return false;
      frame = set.idle[Math.floor(now / IDLE_FRAME_MS) % set.idle.length];
    }
    const key = visualTextureKey(this.scene, a && (a.hold || now < a.until) && a.texture ? a.texture : set.texture);
    if (this.sprite.texture.key !== key || this.sprite.frame.name !== String(frame)) this.sprite.setTexture(key, frame);
    this.sprite.setFlipX(mirror);
    // 按行走表的帧高换算：figureCorrection 给的是“人物像素高度”之比，动作表帧（128）与行走表帧（96）大小不同，
    // 若按动作帧高缩放，人物会比行走时小约两成
    const fit = this.actionFitFor(key, set);
    // 整套动作用同一个比例（举刀过顶、下蹲前刺等姿势本来就高矮不同，不按每帧高度校正）；
    // 但图集里某些行整体画小 / 画大（v2 赵云攻击行比待机行小约一成），按 data/heroActionFit.ts 自动量出的逐帧系数补回，脚线不动
    const s = this.actionFrameScale(key, set, frame, a && (a.hold || now < a.until) ? a.texture : undefined);
    this.sprite.setScale(fit.k * s, fit.k * s);
    this.baseOriginY = s === 1 ? fit.originY : Phaser.Math.Clamp((fit.foot - (fit.foot - fit.originY * fit.frameH) / s) / fit.frameH, .3, .95);
    this.sprite.setOrigin(.5, this.baseOriginY);
    this.dragWalking = false; // 动作帧覆盖了拖刀行走（同一帧里武器在移动之后出手）
    return true;
  }

  /**
   * 动作图集 → 世界缩放与锚点。参照帧选“站姿”：行走表全部 16 帧 vs 动作表待机行。
   * 以前用整张动作表（含下蹲、前刺）的中位身高做参照，中位被攻击姿势拉低，待机时人物比行走大 4–11%。
   * 锚点：让待机脚线落在行走帧脚线的同一世界位置，切换动作时脚不上下跳。
   */
  /** 动作图集逐帧尺寸系数（只对 v2 正式动作图集；单独动作条 / v1 图为 1）。 */
  private actionFrameScale(key: string, set: HeroActionSet, frame: ActionFrame | undefined, strip?: string): number {
    if (strip || typeof frame !== 'number' || !isV2Texture(key)) return 1;
    return HERO_ACTION_SCALE[set.texture]?.[frame] ?? 1;
  }
  /** 测试用：当前帧的逐帧尺寸系数。 */
  get actionScaleNow(): number { const a = this.action, set = this.actionSet; if (!set) return 1; const f = this.sprite.frame.name, n = Number(f); return Number.isFinite(n) ? this.actionFrameScale(this.sprite.texture.key, set, n, a?.texture) : 1; }
  private actionFitFor(key: string, set: HeroActionSet): { k: number; originY: number; foot: number; frameH: number } {
    const walkKey = visualTextureKey(this.scene, this.walkSheet), cacheKey = walkKey + '|' + key;
    const hit = this.actionFit.get(cacheKey); if (hit) return hit;
    const walkFrameH = this.scene.textures.exists(walkKey) ? this.scene.textures.getFrame(walkKey, 'down_0')?.height || 96 : 96;
    const actFrameH = this.scene.textures.getFrame(key, set.idle?.[0] ?? set.attack.down[0])?.height || 128;
    const walkNames = (['down', 'left', 'right', 'up'] as const).flatMap(d => [0, 1, 2, 3].map(i => `${d}_${i}`));
    const walkRef = framesFigure(this.scene, walkKey, walkNames);
    const actRef = framesFigure(this.scene, key, set.idle?.length ? set.idle : set.attack.down);
    const walkH = walkRef?.height ?? sheetFigureHeight(this.scene, walkKey) ?? 90, actH = actRef?.height ?? sheetFigureHeight(this.scene, key) ?? 90;
    const kw = this.targetHeight / walkFrameH, k = kw * walkH / actH;
    const walkFoot = ((walkRef?.bottom ?? walkFrameH * .96) + 1 - walkFrameH * this.walkOriginY) * kw; // 行走脚底相对中心（世界像素）
    const originY = ((actRef?.bottom ?? actFrameH * .89) + 1 - walkFoot / k) / actFrameH;
    const fit = { k, originY: Phaser.Math.Clamp(originY, .3, .95), foot: (actRef?.bottom ?? actFrameH * .89) + 1, frameH: actFrameH };
    // 测量失败（纹理未就绪）时不缓存，下次再算
    if (walkRef && actRef) this.actionFit.set(cacheKey, fit);
    return fit;
  }

  setWalkSheet(key: string): void {
    if (!this.scene.textures.exists(key)) return;
    this.walkSheet = key;
    // 立刻切到该武将的待机帧，避免进战斗先闪一下赵云
    try {
      if (this.scene.textures.get(key).has('down_0')) {
        this.sprite.setTexture(visualTextureKey(this.scene,key), this.standFrame(visualTextureKey(this.scene,key), 'down'));
        this.applyTextureScale();
      }
    } catch {
      /* ignore */
    }
  }

  /** 有 4 方向行走素材时播放；没有时用轻微步态占位。 */
  /**
   * 播放单独图集里的一段动作（如关羽拖刀上撩），按招牌技优先级（不被普攻 / 受伤打断）。缺图返回 false。
   */
  playStrip(texture: string, frames: ActionFrame[], ms: number, mirror: boolean, weights?: readonly number[]): boolean {
    if (!this.actionSet || !this.scene.textures.exists(texture) || !frames.length) return false;
    const cur = this.currentAction; if (cur === 'die' || cur === 'win') return false;
    const start = this.clock();
    this.action = {kind: 'skill', frames, mirror, start, until: start + ms, hold: false, weights: weights?.length === frames.length ? weights : undefined, texture};
    this.renderAction(false);
    return true;
  }

  /** 拖刀行走图：学了拖刀斩、在移动、人物画风 v2 且图已加载时启用；否则 null（照常用普通行走图）。 */
  private dragWalkSheet(moving: boolean): string | null {
    if (!moving || !this.growth.masteries.dragging_blade) return null;
    const key = DRAG_WALK_SHEET[this.growth.character];
    return key && this.scene.textures.exists(key) && this.scene.textures.get(key).has(`${this.facing}_0`) ? key : null;
  }

  private applyWalkVisual(moving: boolean): void {
    this.dragWalking = false;
    if (this.renderAction(moving)) return;
    const sheet = this.scene.textures.exists(this.walkSheet);
    const dirKey = `hero_walk_${this.facing}`;
    const hasFrames = this.scene.textures.exists(`${dirKey}_0`) || sheet;
    if (hasFrames && moving) {
      const frame = Math.floor(this.walkPhase) % 4;
      if (sheet) {
        const name = `${this.facing}_${frame}`, drag = this.dragWalkSheet(moving), sheetKey = drag ?? visualTextureKey(this.scene, this.walkSheet);
        this.dragWalking = !!drag;
        if (this.sprite.frame.name !== name || this.sprite.texture.key !== sheetKey) this.sprite.setTexture(sheetKey, name);
      } else {
        const key = `${dirKey}_${frame}`;
        if (this.sprite.texture.key !== key) this.sprite.setTexture(visualTextureKey(this.scene,key));
      }
    } else if (sheet) {
      // 停下：四个方向都回到站立帧（以前左 / 右 / 上会停在跨步帧上）
      const key = visualTextureKey(this.scene, this.walkSheet), name = this.standFrame(key, this.facing);
      if (this.sprite.texture.key !== key || this.sprite.frame.name !== name) this.sprite.setTexture(key, name);
    } else if (!hasFrames && this.sprite.texture.key !== this.charTexture) {
      this.sprite.setTexture(this.charTexture);
    }
    this.applyTextureScale(moving);
  }

  private applyTextureScale(moving = false): void {
    // 注意：雪碧图 texture 的高度是整张 sheet（384），要用当前 frame 的高度（96）
    const frameH = this.sprite.frame && this.sprite.frame.height ? this.sprite.frame.height : 0;
    const source = this.sprite.texture.getSourceImage() as { height?: number };
    const texH = frameH || (source && source.height ? source.height : 128);
    const base = this.targetHeight / texH;
    const bob = moving && !this.scene.textures.exists(this.walkSheet) && !this.scene.textures.exists(`hero_walk_${this.facing}_0`)
      ? 1 + Math.sin(this.walkPhase * 2) * 0.02
      : 1;
    this.sprite.setScale(base, base * bob);
    this.baseOriginY = this.walkOriginY; this.sprite.setOrigin(.5, this.baseOriginY);
  }

  takeDamage(raw: number, now: number): boolean {
    if (!this.alive || this.damageImmune || now < this.invulnUntil || this.passive.isInvulnerable(now)) return false; // 马超锦马冲锋中无敌
    if (Math.random() < this.growth.dodgeChance()) return false; // 敏捷·游刃：闪避
    const afterArmor = Math.max(1, raw - this.stats.armor);
    const unguarded = Math.max(1, Math.round(afterArmor * this.stats.damageTakenMul * this.armyDamageTakenMul * this.growth.incomingDamageMultiplier() * this.passive.damageTakenMultiplier(now) * (now < this.propGuardUntil ? this.propGuardMul : 1)));
    const ridden=this.mountGuard?this.mountGuard(unguarded,now):unguarded;if(ridden<=0)return false;
    const dmg=Math.max(1,this.damageGuard?.(ridden,now)??ridden);
    (this.scene as unknown as {sfx?:{play(k:string):void}}).sfx?.play('playerHurt');
    const ironRescue=false; // 旧「铁壁 4 件 · 绝境不屈」随流派重做删除（2026-11-19）
    if(ironRescue)this.growth.awakenRescueUsed=true;
    const rescue=!ironRescue&&this.hp<=dmg&&this.growth.build.treasures.includes('revival_jade')&&!this.growth.revivalUsed;
    if(rescue)this.growth.revivalUsed=true;
    this.hp = (rescue||ironRescue)?1:Math.max(0, this.hp - dmg);
    this.invulnUntil = now + BALANCE.player.invuln * 1000;
    if(rescue||ironRescue)this.invulnUntil=Math.max(this.invulnUntil,now+(rescue?this.growth.revivalMs:1000));
    this.passive.onDamage(now);
    if (this.hp <= 0) { this.alive = false; this.passive.stop(); this.playAction('die'); }
    else this.playAction('hurt');
    return true;
  }

  heal(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** 返回本次获得的等级数。cap = 武将等级上限（到上限后经验最多再存 1 级的量）。 */
  gainXp(amount: number, cap = Infinity): number {
    this.xp += amount; this.runXp += amount;
    let gained = 0;
    while (this.level < cap && this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level += 1;
      gained += 1;
      this.xpNext = xpToNext(this.level);
    }
    if (this.level >= cap && this.xp > this.xpNext) { this.overflowXp += this.xp - this.xpNext; this.xp = this.xpNext; }
    // 2026-11-17：等级即武将等级，每升 1 级一次三选一并给 1 个属性点（GameScene.onHeroLevelUp）
    return gained;
  }

  private drawCommandRing(now:number):void{
    const g=this.commandRing.clear().setPosition(this.x,this.y+21).setVisible(this.alive);if(!this.alive)return;
    const rx=24,ry=8.5,spin=now/1600;
    for(const base of[0,Math.PI]){g.lineStyle(2,0xf6dc9a,.9).beginPath();for(let i=0;i<=14;i++){const a=spin+base+(-.7+1.4*i/14);const px=Math.cos(a)*rx,py=Math.sin(a)*ry;if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}g.strokePath();}
  }

  update(now: number, dt: number): void {
    this.commandGlow.setPosition(this.x,this.y+21).setVisible(this.alive).setAlpha(.75+.15*Math.sin(now/420));
    this.drawCommandRing(now);
    this.marker.setPosition(this.x,this.y-this.markerLift-this.riseY).setVisible(this.alive);
    this.markerLabel.setPosition(this.x,this.y-this.markerLift-7-this.riseY).setVisible(this.alive);
    // 胜利 / 倒地在结算后播放，move 已不再调用：清掉残留的步伐起伏与前倾
    if (this.action?.hold && (this.gaitLift || this.sprite.rotation)) { this.gaitLift = 0; this.sprite.setRotation(0); }
    const t = now < this.knockedUntil ? (now - this.knockedAt) / (this.knockedUntil - this.knockedAt) : 1;
    const lift = t < 1 ? Math.sin(Math.PI * Math.max(0, t)) * 42 : 0;
    // 被挑飞时的抬升按当前帧的实际显示高度换算（动作帧 128 格与行走帧 96 格不同）
    this.sprite.setOrigin(.5, this.baseOriginY + (lift + this.riseY + this.gaitLift) / Math.max(1, this.sprite.displayHeight));
    const regen = this.stats.regen + this.growth.gear.regen;
    if (regen > 0) this.heal(regen * dt);
    this.growth.lowHp = this.hp < this.maxHp * .35;
    const blinking = now < this.invulnUntil;
    this.sprite.setAlpha(blinking ? (Math.floor(now / 80) % 2 === 0 ? 0.35 : 1) : 1);
    if (this.action?.hold) this.renderAction(false);
  }
}
