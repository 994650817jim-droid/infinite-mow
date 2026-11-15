import type { Enemy } from '../entities/Enemy';
import type { CharacterId } from '../data/characters';
import type { WeaponId } from '../types';
import { CHARACTER_PASSIVES, PASSIVE_RULES as R } from '../data/passives';
export interface PassiveCast {
  owner: CharacterId; generation: number; weapon: WeaponId; empowered: boolean;
  radiusMul: number; damageMul: number; extraSpear: boolean; spearLengthMul: number;
  /** 张飞满怒：本次出枪附带燕人咆哮（震慑周围敌人）。 */
  roar: boolean;
  hits: Set<number>; awarded: boolean;
}
interface Burn { enemy: Enemy; spawnId: number; until: number; nextTick: number; damage: number; }
/** Character-only state. No Phaser timers, permanent stat mutations or extra equipment slots. */
export class CharacterPassives {
  private character: CharacterId = 'zhaoyun';
  private stacks = 0; private lastGain = -Infinity; private lastDamage = 0;
  private generation = 0; private stopped = false;
  private gains = 0; private triggers = 0;
  private readonly burns = new Map<number, Burn>();
  constructor(character: CharacterId = 'zhaoyun', now = 0) { this.reset(character, now); }
  reset(character: CharacterId, now: number): void {
    this.character = character; this.stacks = 0; this.lastGain = -Infinity; this.lastDamage = now;
    this.generation++; this.stopped = false; this.gains = 0; this.triggers = 0; this.burns.clear();
  }
  stop(): void { this.stopped = true; this.stacks = 0; this.generation++; this.burns.clear(); }
  private get maxStacks(): number { return CHARACTER_PASSIVES[this.character].maxStacks; }
  onDamage(now: number): void { if (!this.stopped) this.lastDamage = now; }
  onWeaponHit(now: number): void {
    const interval = this.character === 'zhaoyun' ? R.dragonIntervalMs : this.character === 'zhangfei' ? R.roarIntervalMs : -1;
    if (this.stopped || interval < 0 || this.stacks >= this.maxStacks || now - this.lastGain + 1e-6 < interval) return;
    this.lastGain = now; this.stacks++; this.gains++;
  }
  isSharpshooter(now: number): boolean { return !this.stopped && this.character === 'huangzhong' && now - this.lastDamage >= R.calmMs; }
  critBonus(now: number): number { return this.isSharpshooter(now) ? R.critBonus : 0; }
  rangeMultiplier(weapon: WeaponId): number {
    return !this.stopped && this.character === 'guanyu' && weapon === 'guandao' ? 1 + this.stacks * R.guandaoRangePerStack : 1;
  }
  beginCast(weapon: WeaponId): PassiveCast {
    const c: PassiveCast = { owner: this.character, generation: this.generation, weapon, empowered: false, radiusMul: this.rangeMultiplier(weapon), damageMul: 1, extraSpear: false, spearLengthMul: 1, roar: false, hits: new Set(), awarded: false };
    if (this.stopped) return c;
    if (this.character === 'zhaoyun' && weapon === 'spear_orbit' && this.stacks === this.maxStacks) {
      c.empowered = c.extraSpear = true; c.spearLengthMul = R.spearLengthMul;
    } else if (this.character === 'zhangfei' && weapon === 'spear_orbit' && this.stacks === this.maxStacks) {
      c.empowered = c.roar = true;
    } else if (this.character === 'guanyu' && weapon === 'guandao' && this.stacks === this.maxStacks) {
      c.empowered = true; c.damageMul = R.guandaoDamageMul;
    } else if (this.character === 'zhuge' && weapon === 'flame_banner' && this.stacks === this.maxStacks) {
      c.empowered = true; c.radiusMul = R.fireRadiusMul;
    }
    if (c.empowered) { this.stacks = 0; this.triggers++; }
    return c;
  }
  recordHit(cast: PassiveCast, enemy: Enemy, now: number, explosionDamage = 0): void {
    if (this.stopped || cast.owner !== this.character || cast.generation !== this.generation || cast.hits.has(enemy.spawnId)) return;
    cast.hits.add(enemy.spawnId);
    if (this.character === 'zhuge' && cast.weapon === 'flame_banner' && cast.empowered && enemy.active) this.refreshBurn(enemy, explosionDamage, now);
    const qualifying = this.character === 'guanyu' && cast.weapon === 'guandao' || this.character === 'zhuge' && cast.weapon === 'flame_banner';
    if (qualifying && !cast.empowered && !cast.awarded && cast.hits.size >= R.coneThreshold) {
      cast.awarded = true; this.stacks = Math.min(this.maxStacks, this.stacks + 1); this.gains++;
    }
  }
  private refreshBurn(enemy: Enemy, explosionDamage: number, now: number): void {
    const previous = this.burns.get(enemy.uid);
    if (previous?.spawnId === enemy.spawnId && previous.until >= now) {
      previous.until = now + R.burnMs;
      return; // Refresh duration only: preserve both potency and the next tick.
    }
    this.burns.set(enemy.uid, { enemy, spawnId: enemy.spawnId, until: now + R.burnMs,
      nextTick: now + R.burnTickMs, damage: explosionDamage * R.burnDamageFraction });
  }
  update(now: number, damage: (enemy: Enemy, amount: number) => void): void {
    if (this.stopped) return;
    for (const [uid, burn] of this.burns) {
      if (!burn.enemy.active || burn.enemy.spawnId !== burn.spawnId) { this.burns.delete(uid); continue; }
      while (!this.stopped && burn.enemy.active && burn.enemy.spawnId === burn.spawnId && burn.nextTick <= now && burn.nextTick <= burn.until) {
        damage(burn.enemy, burn.damage); burn.nextTick += R.burnTickMs;
      }
      if (now >= burn.until || !burn.enemy.active || burn.enemy.spawnId !== burn.spawnId) this.burns.delete(uid);
    }
  }
  snapshot(now: number) {
    return { character: this.character, stacks: this.stacks, maxStacks: CHARACTER_PASSIVES[this.character].maxStacks,
      ready: !this.stopped && (this.character === 'huangzhong' ? this.isSharpshooter(now) : this.stacks === CHARACTER_PASSIVES[this.character].maxStacks),
      calmProgress: this.stopped ? 0 : Math.min(1, Math.max(0, (now - this.lastDamage) / R.calmMs)),
      critBonus: this.critBonus(now), guandaoRangeMul: this.rangeMultiplier('guandao'), burns: this.burns.size, gains: this.gains, triggers: this.triggers, stopped: this.stopped };
  }
  label(now: number): string {
    const name = CHARACTER_PASSIVES[this.character].name;
    if (this.character === 'huangzhong') return this.isSharpshooter(now) ? `${name} · 神射：暴击+10% / 连弩+1` : `${name} · 蓄势 ${Math.min(3, Math.max(0, (now - this.lastDamage) / 1000)).toFixed(1)}/3秒`;
    return `${name} · ${this.character === 'zhaoyun' ? '龙胆' : this.character === 'guanyu' ? '武势' : this.character === 'zhangfei' ? '怒气' : '谋略'} ${this.stacks}/${CHARACTER_PASSIVES[this.character].maxStacks}${this.snapshot(now).ready ? ' · 下次强化' : ''}${this.character === 'zhuge' && this.burns.size ? ` · 灼烧${this.burns.size}` : ''}`;
  }
}
