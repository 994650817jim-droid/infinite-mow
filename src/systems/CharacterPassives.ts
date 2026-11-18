import type { Enemy } from '../entities/Enemy';
import type { CharacterId } from '../data/characters';
import type { WeaponId } from '../types';
import { CHARACTER_PASSIVES, PASSIVE_RULES as R } from '../data/passives';
export interface PassiveCast {
  owner: CharacterId; generation: number; weapon: WeaponId; empowered: boolean;
  radiusMul: number; damageMul: number; extraSpear: boolean; spearLengthMul: number;
  /** 张飞满怒：本次出枪附带燕人咆哮（震慑周围敌人）。 */
  roar: boolean;
  /** 马超满铁骑：本次出枪化为冲锋突进。 */
  dash: boolean;
  /** 魏延 / 刘备满层：回复自身最大生命的比例；刘备另为部曲回复（比例）。 */
  heal: number; rally: number;
  /** 黄月英满层：额外扇形机关弩。 */
  fan: boolean;
  /** 魏延满层：谁敢杀我（6 向裂波 + 减伤）；庞统满层：火烧连环（身边环形火雷）。 */
  whoDares: boolean; formation: boolean;
  /** 孙尚香满层：召执刀侍婢护身；貂蝉满层：闭月（舞带环身旋舞，圈内敌人离间）。 */
  maids: boolean; moonDance: boolean;
  /** 张飞满层：据水断桥（360° 喝断 + 断桥区）；马超满层：锦马冲锋（向前突进）。 */
  bridge: boolean; charge: boolean;
  hits: Set<number>; awarded: boolean;
}
/** 貂蝉离间：魅惑层数（4 秒没被扇中就消散）、倒戈截止、首领易伤截止。 */
interface Charm { enemy: Enemy; spawnId: number; marks: number; lastMark: number; turnedUntil: number; vulnUntil: number; }
export type CharmView = Readonly<Charm>;
interface Burn { enemy: Enemy; spawnId: number; until: number; nextTick: number; damage: number; }
/** Character-only state. No Phaser timers, permanent stat mutations or extra equipment slots. */
export class CharacterPassives {
  private character: CharacterId = 'zhaoyun';
  private stacks = 0; private lastGain = -Infinity; private lastDamage = 0;
  /** 黄忠：进入神射所需的不受伤时间（技艺「静心」缩短）；「宝刀未老」期间受伤不退出神射。 */
  private calmMs: number = R.calmMs; private sharpGuardUntil = -Infinity;
  /** 本关击杀数，及黄忠神射中射杀的精锐 / 首领数（技艺「老骥伏枥」读取）。 */
  private stageKills = 0; private sharpEliteKills = 0;
  private generation = 0; private stopped = false;
  private gains = 0; private triggers = 0;
  private readonly burns = new Map<number, Burn>();
  private readonly charms = new Map<number, Charm>();
  /** 魏延「谁敢杀我」减伤截止时间。 */
  private guardUntil = -Infinity;
  /** 马超锦马冲锋：冲锋中无敌截止、冲锋后「铁骑余威」减伤截止。 */
  private chargeInvulnUntil = -Infinity; chargeGuardUntil = -Infinity;
  /** 孙尚香最近一次移动的时间（移动中掷刀更快）。 */
  private lastMoveAt = -Infinity;
  constructor(character: CharacterId = 'zhaoyun', now = 0) { this.reset(character, now); }
  reset(character: CharacterId, now: number): void {
    this.character = character; this.stacks = 0; this.lastGain = -Infinity; this.charmKillAt = -Infinity; this.lastDamage = now; this.calmMs = R.calmMs; this.sharpGuardUntil = -Infinity; this.stageKills = 0; this.sharpEliteKills = 0;
    this.generation++; this.stopped = false; this.gains = 0; this.triggers = 0; this.burns.clear(); this.charms.clear(); this.guardUntil = -Infinity; this.chargeInvulnUntil = this.chargeGuardUntil = -Infinity;
  }
  get characterId(): CharacterId { return this.character; }
  stop(): void { this.stopped = true; this.stacks = 0; this.generation++; this.burns.clear(); this.charms.clear(); this.chargeInvulnUntil = this.chargeGuardUntil = -Infinity; }
  private get maxStacks(): number { return CHARACTER_PASSIVES[this.character].maxStacks; }
  onDamage(now: number): void {
    if (this.stopped) return;
    if (this.character === 'huangzhong' && now < this.sharpGuardUntil) return; // 宝刀未老：受伤不退出神射
    this.lastDamage = now;
    // 魏延·镇守汉中：每次受伤积 1 层拒敌（每 0.5 秒最多 1 层）
    if (this.character === 'weiyan' && this.stacks < this.maxStacks && now - this.lastGain + 1e-6 >= R.guardStepMs) { this.lastGain = now; this.stacks++; this.gains++; }
  }
  /** 魏延「谁敢杀我」期间受到伤害的倍率。 */
  damageTakenMultiplier(now: number): number { if (this.stopped) return 1; return (now < this.guardUntil ? R.whoDaresGuardMul : 1) * (now < this.chargeGuardUntil && now >= this.chargeInvulnUntil ? R.chargeGuardMul : 1); }
  /** 马超锦马冲锋：invulnMs 内无敌（不吃伤害、不被外力击退），之后 guardMs 内受伤减免。 */
  startChargeGuard(now: number, invulnMs: number, guardMs: number): void { if (this.stopped) return; this.chargeInvulnUntil = now + invulnMs; this.chargeGuardUntil = now + invulnMs + guardMs; }
  /** 冲锋无敌中。 */
  isInvulnerable(now: number): boolean { return !this.stopped && now < this.chargeInvulnUntil; }
  /** 「铁骑余威」减伤中（冲锋结束后）。 */
  chargeGuardLeft(now: number): number { return !this.stopped && now >= this.chargeInvulnUntil && now < this.chargeGuardUntil ? this.chargeGuardUntil - now : 0; }
  startGuard(now: number): void { if (!this.stopped) this.guardUntil = now + R.whoDaresGuardMs; }
  /** 庞统·连环计：一次连锁引爆的火雷数达到门槛时积 1 层。 */
  onMineChain(count: number): void {
    if (this.stopped || this.character !== 'pangtong' || count < R.mineChainStack || this.stacks >= this.maxStacks) return;
    this.stacks++; this.gains++;
  }
  onWeaponHit(now: number): void {
    const interval = this.character === 'zhaoyun' ? R.dragonIntervalMs : this.character === 'zhangfei' ? R.roarIntervalMs : this.character === 'machao' ? R.cavalryIntervalMs : this.character === 'huangyueying' ? R.mechIntervalMs : -1;
    if (this.stopped || interval < 0 || this.stacks >= this.maxStacks || now - this.lastGain + 1e-6 < interval) return;
    this.lastGain = now; this.stacks++; this.gains++;
  }
  /** 孙尚香：移动中积疾步（每 0.5 秒最多 1 层，停下不掉层）。 */
  onMove(now: number): void {
    this.lastMoveAt = now;
    // 孙尚香疾步：移动中每 0.5 秒积 1 层（马超已改回命中积铁骑）
    const interval = this.character === 'sunshangxiang' ? R.stepIntervalMs : -1;
    if (this.stopped || interval < 0 || this.stacks >= this.maxStacks || now - this.lastGain + 1e-6 < interval) return;
    this.lastGain = now; this.stacks++; this.gains++;
  }
  /** 最近 0.15 秒内是否在移动（孙尚香掷刀加速、回身飞刀）。 */
  isMoving(now: number): boolean { return now - this.lastMoveAt <= 150; }
  private charmOf(enemy: Enemy): Charm | undefined { const c = this.charms.get(enemy.uid); return c && c.spawnId === enemy.spawnId ? c : undefined; }
  /** 貂蝉离间：倒戈的敌人受伤 +20%，被魅惑满层的首领受伤 +25%。 */
  vulnerability(enemy: Enemy, now: number): number {
    if (!this.charms.size) return 1;
    const c = this.charmOf(enemy); if (!c) return 1;
    return c.turnedUntil > now ? R.turnVulnerability : c.vulnUntil > now ? R.charmVulnerability : 1;
  }
  isTurned(enemy: Enemy, now: number): boolean { const c = this.charms.size ? this.charmOf(enemy) : undefined; return !!c && c.turnedUntil > now; }
  /** 扇子命中：加 1 层魅惑；满 need 层时普通敌人倒戈 turnMs（精锐减半），首领改为易伤。返回是否刚好倒戈。 */
  addCharm(enemy: Enemy, now: number, need: number, turnMs: number): boolean {
    if (this.stopped || !enemy.active || enemy.isSupplySlot) return false;
    let c = this.charmOf(enemy);
    if (!c) { if (this.charms.size >= 200) return false; c = { enemy, spawnId: enemy.spawnId, marks: 0, lastMark: now, turnedUntil: 0, vulnUntil: 0 }; this.charms.set(enemy.uid, c); }
    if (c.turnedUntil > now) return false; // 已在倒戈中不叠层
    c.marks++; c.lastMark = now;
    if (c.marks < need) return false;
    c.marks = 0;
    if (enemy.kind === 'boss' || enemy.controlImmune) { c.vulnUntil = now + R.turnMs; return false; }
    return this.turn(c, now, enemy.kind === 'elite' ? turnMs / 2 : turnMs);
  }
  /** 貂蝉：飞扇打死身上带魅惑的敌人，也算离间成功 +1 层（弱敌一两扇就死，光靠倒戈攒不满）。 */
  charmKill(enemy: Enemy, now: number): void {
    if (this.stopped || this.character !== 'diaochan' || enemy.isSupplySlot) return;
    const c = this.charmOf(enemy); if (!c || c.marks <= 0) return;
    c.marks = 0; this.charms.delete(enemy.uid);
    // 击杀攒层每秒最多 1 层：割草时击杀极多，不限的话闭月会接连不断（又变成「一直闭月不扔扇子」）
    if (now < this.charmKillAt) return;
    this.charmKillAt = now + R.charmKillGapMs;
    if (this.stacks < this.maxStacks) { this.stacks++; this.gains++; }
  }
  private charmKillAt = -Infinity;
  /** 闭月：直接让敌人倒戈（首领改为易伤）。 */
  forceTurn(enemy: Enemy, now: number, turnMs: number): boolean {
    if (this.stopped || !enemy.active || enemy.isSupplySlot) return false;
    let c = this.charmOf(enemy);
    if (!c) { if (this.charms.size >= 200) return false; c = { enemy, spawnId: enemy.spawnId, marks: 0, lastMark: now, turnedUntil: 0, vulnUntil: 0 }; this.charms.set(enemy.uid, c); }
    if (enemy.kind === 'boss' || enemy.controlImmune) { c.vulnUntil = now + R.turnMs; return false; }
    if (c.turnedUntil > now) return false;
    // 闭月造成的倒戈不叠「离间」层数：否则一次闭月就把层数叠满，下一次出手又是闭月，循环下去再也不掷扇子
    return this.turn(c, now, enemy.kind === 'elite' ? turnMs / 2 : turnMs, false);
  }
  private turn(c: Charm, now: number, ms: number, gainStack = true): boolean {
    c.turnedUntil = now + ms; c.marks = 0;
    if (gainStack && this.character === 'diaochan' && this.stacks < this.maxStacks) { this.stacks++; this.gains++; }
    return true;
  }
  /**
   * 倒戈中的敌人：不追主将，转身冲向最近的同伴，碰到后每 0.5 秒用自己的接触伤害打它。
   * 由 GameScene 的敌人行动循环调用；返回 true 表示本帧已接管该敌人的行动。
   */
  driveTurned(enemy: Enemy, dt: number, now: number, nearby: (x: number, y: number, r: number) => Enemy[], hit: (target: Enemy, amount: number) => void): boolean {
    if (!this.isTurned(enemy, now)) return false;
    let best: Enemy | null = null, bd: number = R.turnSeek;
    for (const o of nearby(enemy.x, enemy.y, R.turnSeek)) {
      if (o === enemy || !o.active || o.isSupplySlot || o.def.behavior === 'wall') continue;
      const d = Math.hypot(o.x - enemy.x, o.y - enemy.y); if (d < bd) { bd = d; best = o; }
    }
    enemy.moveVx = enemy.moveVy = 0;
    if (!best) return true;
    const reach = enemy.radius + best.radius + 4;
    if (bd > reach) { const s = Math.min(bd - reach, enemy.def.speed * dt); enemy.sprite.x += (best.x - enemy.x) / bd * s; enemy.sprite.y += (best.y - enemy.y) / bd * s; }
    else if (enemy.contactCd <= 0) { enemy.contactCd = R.turnHitMs / 1000; hit(best, enemy.def.damage); }
    return true;
  }
  /** 测试 / 表现用：当前魅惑与倒戈状态。 */
  charmViews(): CharmView[] { return [...this.charms.values()]; }
  isSharpshooter(now: number): boolean { return !this.stopped && this.character === 'huangzhong' && now - this.lastDamage >= this.calmMs; }
  /** 敌人被击杀（GameScene.killEnemy 调用）：计本关击杀；黄忠神射中击杀精锐 / 首领另计。 */
  onKill(kind: string, now: number): void {
    if (this.stopped) return;
    this.stageKills++;
    if ((kind === 'elite' || kind === 'boss') && this.isSharpshooter(now)) this.sharpEliteKills++;
  }
  get kills(): number { return this.stageKills; }
  get sharpEliteKillCount(): number { return this.sharpEliteKills; }
  /** 黄忠「静心」：设定进入神射所需的不受伤时间（毫秒）。 */
  setCalmMs(ms: number): void { this.calmMs = Math.max(500, ms); }
  get sharpCalmMs(): number { return this.calmMs; }
  /** 黄忠「宝刀未老」：立刻进入神射，guardMs 内受伤不退出。 */
  grantSharp(now: number, guardMs: number): void { if (this.stopped) return; this.lastDamage = Math.min(this.lastDamage, now - this.calmMs); this.sharpGuardUntil = now + guardMs; }
  sharpGuarded(now: number): boolean { return now < this.sharpGuardUntil; }
  critBonus(now: number): number { return this.isSharpshooter(now) ? R.critBonus : 0; }
  /** 智力的范围倍率（GameScene 开局 / 加点后设置，RunGrowth.areaMultiplier）。 */
  areaMul = 1;
  rangeMultiplier(weapon: WeaponId): number {
    return (!this.stopped && this.character === 'guanyu' && weapon === 'guandao' ? 1 + this.stacks * R.guandaoRangePerStack : 1) * this.areaMul;
  }
  beginCast(weapon: WeaponId): PassiveCast {
    const c: PassiveCast = { owner: this.character, generation: this.generation, weapon, empowered: false, radiusMul: this.rangeMultiplier(weapon), damageMul: 1, extraSpear: false, spearLengthMul: 1, roar: false, dash: false, heal: 0, rally: 0, fan: false, whoDares: false, formation: false, maids: false, moonDance: false, bridge: false, charge: false, hits: new Set(), awarded: false };
    if (this.stopped) return c;
    if (this.character === 'zhaoyun' && weapon === 'spear_orbit' && this.stacks === this.maxStacks) {
      c.empowered = c.extraSpear = true; c.spearLengthMul = R.spearLengthMul;
    } else if (this.character === 'pangtong' && weapon === 'lianhuan_mines' && this.stacks === this.maxStacks) {
      c.empowered = c.formation = true;
    } else if (this.character === 'huangyueying' && weapon === 'crossbow' && this.stacks === this.maxStacks) {
      c.empowered = c.fan = true;
    } else if (this.character === 'sunshangxiang' && weapon === 'sun_knives' && this.stacks === this.maxStacks) {
      c.empowered = c.maids = true;
    } else if (this.character === 'diaochan' && weapon === 'diaochan_fans' && this.stacks === this.maxStacks) {
      c.empowered = c.moonDance = true;
    } else if (this.character === 'weiyan' && weapon === 'zhenbei_blade' && this.stacks === this.maxStacks) {
      c.empowered = c.whoDares = true;
    } else if (this.character === 'liubei' && weapon === 'shuanggu_swords' && this.stacks === this.maxStacks) {
      c.empowered = true; c.damageMul = R.liubeiDamageMul; c.heal = R.liubeiHeal; c.rally = R.liubeiRally;
    } else if (this.character === 'machao' && weapon === 'zhanjin_lance' && this.stacks === this.maxStacks) {
      c.empowered = c.charge = true;
    } else if (this.character === 'zhangfei' && weapon === 'dangyang_roar' && this.stacks === this.maxStacks) {
      c.empowered = c.bridge = true;
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
    const qualifying = this.character === 'guanyu' && cast.weapon === 'guandao' || this.character === 'zhuge' && cast.weapon === 'flame_banner' || this.character === 'liubei' && cast.weapon === 'shuanggu_swords';
    // 刘备双股剑一剑最多砍两人：砍中 2 人即积仁德；其余扇形 / 爆发类为 3 人
    if (qualifying && !cast.empowered && !cast.awarded && cast.hits.size >= (cast.weapon === 'shuanggu_swords' ? 2 : R.coneThreshold)) {
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
    for (const [uid, c] of this.charms) {
      if (!c.enemy.active || c.enemy.spawnId !== c.spawnId) { this.charms.delete(uid); continue; }
      if (c.marks && now - c.lastMark > R.charmDecayMs) c.marks = 0; // 4 秒没被扇中，魅惑消散
      if (!c.marks && c.turnedUntil <= now && c.vulnUntil <= now) this.charms.delete(uid);
    }
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
      calmProgress: this.stopped ? 0 : Math.min(1, Math.max(0, (now - this.lastDamage) / this.calmMs)),
      critBonus: this.critBonus(now), guandaoRangeMul: this.rangeMultiplier('guandao'), burns: this.burns.size, charms: this.charms.size, turned: [...this.charms.values()].filter(c => c.turnedUntil > now).length, gains: this.gains, triggers: this.triggers, stopped: this.stopped };
  }
  label(now: number): string {
    const name = CHARACTER_PASSIVES[this.character].name;
    if (this.character === 'huangzhong') return this.isSharpshooter(now) ? `${name} · 神射：暴击+10% / 重箭爆裂` : `${name} · 蓄势 ${Math.min(this.calmMs / 1000, Math.max(0, (now - this.lastDamage) / 1000)).toFixed(1)}/${this.calmMs / 1000}秒`;
    return `${name} · ${this.character === 'zhaoyun' ? '龙胆' : this.character === 'guanyu' ? '武势' : this.character === 'zhangfei' ? '怒气' : this.character === 'huangyueying' ? '机括' : this.character === 'pangtong' ? '计策' : this.character === 'liubei' ? '仁德' : this.character === 'weiyan' ? '拒敌' : this.character === 'machao' ? '铁骑' : this.character === 'sunshangxiang' ? '疾步' : this.character === 'diaochan' ? '舞势' : '谋略'} ${this.stacks}/${CHARACTER_PASSIVES[this.character].maxStacks}${this.snapshot(now).ready ? ' · 下次强化' : ''}${this.character === 'zhuge' && this.burns.size ? ` · 灼烧${this.burns.size}` : ''}${this.character === 'diaochan' && this.snapshot(now).turned ? ` · 离间${this.snapshot(now).turned}` : ''}${this.character === 'weiyan' && this.damageTakenMultiplier(now) < 1 ? ' · 谁敢杀我' : ''}`;
  }
}
