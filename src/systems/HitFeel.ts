import Phaser from 'phaser';
import { HIT_FEEL, BOSS_FEEL, shakeLevel, shakeMul } from '../data/hitFeel';

/**
 * 打击感时钟：顿帧 / 慢动作 / 震屏。
 * - 顿帧、慢动作都按真实时间（performance.now）计，GameScene 每帧取 scale() 统一乘到 dt、计时器、补间、动画上，
 *   所以战斗时钟、刷兵、升级暂停都保持一致（升级 / 暂停时不施加）。
 * - 震屏统一经过这里：按设置「强 / 弱 / 关」缩放；GameScene 也把主相机的 shake 包了一层，其它地方的震屏同样受设置控制。
 */
export class HitFeel {
  private stopUntil = 0;
  private stopEndAt = -1e9;
  private critStopAt = -1e9;
  private slowUntil = 0;
  private slowScale = 1;
  /** 本帧主将武器命中的敌人数（帧末判定技能 / 大招命中） */
  private frameHits = 0;
  readonly stats = { stops: 0, critStops: 0, skippedStops: 0, slows: 0, shakes: 0 };
  constructor(private readonly scene: Phaser.Scene, private readonly clock: () => number = () => performance.now()) {}

  /** 当前时间倍率（1 = 正常）。 */
  scale(now = this.clock()): number {
    if (now < this.stopUntil) return HIT_FEEL.stopScale;
    if (now < this.slowUntil) return this.slowScale;
    return 1;
  }
  stopping(now = this.clock()): boolean { return now < this.stopUntil; }

  /** 顿帧；force=true 时无视冷却（转阶段 / 破势）。返回是否生效。 */
  hitStop(ms: number, force = false, now = this.clock()): boolean {
    if (!force && (now < this.stopUntil || now - this.stopEndAt < HIT_FEEL.stopCooldownMs)) { this.stats.skippedStops++; return false; }
    this.stopUntil = Math.max(this.stopUntil, now + ms); this.stopEndAt = this.stopUntil; this.stats.stops++;
    return true;
  }
  /** 暴击顿帧：在通用冷却之外还有暴击专用冷却。 */
  critStop(now = this.clock()): boolean {
    if (now - this.critStopAt < HIT_FEEL.critStopCooldownMs) { this.stats.skippedStops++; return false; }
    if (!this.hitStop(HIT_FEEL.critStopMs, false, now)) return false;
    this.critStopAt = now; this.stats.critStops++; return true;
  }
  /** 慢动作（与顿帧叠加时顿帧优先，顿帧结束后继续慢动作）。 */
  slowMo(ms: number, scale: number, now = this.clock()): void {
    this.slowScale = now < this.slowUntil ? Math.min(this.slowScale, scale) : scale;
    this.slowUntil = Math.max(this.slowUntil, now + ms); this.stats.slows++;
  }
  shake(kind: 'small' | 'medium' | 'big'): void {
    if (shakeLevel() === 'off') return;
    const [ms, k] = HIT_FEEL.shake[kind]; this.stats.shakes++;
    // 已在震的比这次强就不打断（Phaser 的 shake 默认不覆盖正在进行的震动）；更强的强制覆盖
    const cam = this.scene.cameras.main as Phaser.Cameras.Scene2D.Camera & { shakeEffect: { isRunning: boolean; intensity: Phaser.Math.Vector2 } };
    const running = cam.shakeEffect.isRunning ? cam.shakeEffect.intensity.x : 0;
    cam.shake(ms, k, running < k * shakeMul() - 1e-6);
  }
  /** 主将武器命中一名敌人（帧末汇总）。 */
  noteHit(): void { this.frameHits++; }
  /** 帧末：同帧命中多名 → 技能 / 大招的震屏与顿帧。 */
  endFrame(): void {
    const n = this.frameHits; this.frameHits = 0;
    if (n >= HIT_FEEL.bigHitTargets) { this.hitStop(HIT_FEEL.bigHitStopMs); this.shake('medium'); }
    else if (n >= HIT_FEEL.skillHitTargets) this.shake('small');
  }
  bossPhase(): void { this.hitStop(BOSS_FEEL.phaseStopMs, true); this.slowMo(BOSS_FEEL.phaseStopMs + BOSS_FEEL.phaseSlowMs, BOSS_FEEL.phaseSlowScale); this.shake('big'); }
  bossDeath(): void { this.slowMo(BOSS_FEEL.deathSlowMs, BOSS_FEEL.deathSlowScale); this.shake('big'); }
  reset(): void { this.stopUntil = this.slowUntil = 0; this.slowScale = 1; this.frameHits = 0; this.stopEndAt = this.critStopAt = -1e9; }
}

/** 首领硬直值（破势）与白色残血条。 */
export class BossStagger {
  value = 0;
  gainMul = 1;
  breaks = 0;
  private spawnId = -1;
  private trail = 1;
  private trailHoldUntil = 0;
  /** 换了首领（或同一首领重生）时重置。 */
  track(spawnId: number, ratio: number): void {
    if (spawnId === this.spawnId) return;
    this.spawnId = spawnId; this.value = 0; this.gainMul = 1; this.breaks = 0; this.trail = ratio; this.trailHoldUntil = 0;
  }
  /** 受击累积；返回 true = 本次满值破势。 */
  hit(damage: number, maxHp: number, crit: boolean): boolean {
    const gain = Math.max(BOSS_FEEL.minGain, damage / Math.max(1, maxHp) * 100 * BOSS_FEEL.gainPerHpPct + (crit ? BOSS_FEEL.critBonus : 0)) * this.gainMul;
    this.value += gain;
    if (this.value < BOSS_FEEL.staggerMax) return false;
    this.value = 0; this.breaks++; this.gainMul = Math.max(BOSS_FEEL.floorMul, this.gainMul * BOSS_FEEL.afterMul);
    return true;
  }
  decay(dt: number): void { this.value = Math.max(0, this.value - BOSS_FEEL.decayPerSec * dt); }
  /** 受击后调用，开始保持白条。 */
  hold(realNow: number): void { this.trailHoldUntil = realNow + BOSS_FEEL.trailHoldMs; }
  /** 白条位置（按真实时间缩，不跟顿帧慢动作走）。 */
  trailRatio(ratio: number, realNow: number, dtReal: number): number {
    if (ratio >= this.trail) { this.trail = ratio; return ratio; }
    if (realNow >= this.trailHoldUntil) this.trail = Math.max(ratio, this.trail - BOSS_FEEL.trailDrainPerSec * dtReal);
    return this.trail;
  }
}
