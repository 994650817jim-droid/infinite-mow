import type { Enemy } from '../entities/Enemy';
import { LVBU } from '../data/lvbu';
import { ZHANGLIAO } from '../data/zhangliao';
import { ZHOUYU } from '../data/zhouyu';
import { TAISHICI } from '../data/taishici';
import { MENGDE } from '../data/mengde';
import { DIANWEI } from '../data/dianwei';
import { MENGHUO } from '../data/menghuo';
/** P3 第二批可玩武将（共用量表 p3*）。 */
const P3_HEROES = new Set<string>(['ganning', 'dianwei', 'sunquan', 'menghuo', 'zhurong']);
/** P3 限时状态的名字（被动条显示）。 */
const P3_ACTIVE_NAME: Record<string, string> = { ganning: '百骑劫营', dianwei: '古之恶来' };
import type { CharacterId } from '../data/characters';
import type { WeaponId } from '../types';
import { CHARACTER_PASSIVES, PASSIVE_RULES as R } from '../data/passives';
import { HZ_SHARP, WY_SURROUND, ZG_TIANHUO } from '../data/heroMechanics';
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
interface Charm { enemy: Enemy; spawnId: number; marks: number; lastMark: number; turnedUntil: number; vulnUntil: number;
  /** 闭月分支进阶「被魅惑的精锐会攻击首领」：倒戈时先找首领。 */ huntBoss?: boolean;
  /** 闭月分支的魅惑：出手用分支自己的伤害（替代接触伤害）。 */ strike?: (target: Enemy) => void; }
export type CharmView = Readonly<Charm>;
interface Burn { enemy: Enemy; spawnId: number; until: number; nextTick: number; damage: number; }
/** Character-only state. No Phaser timers, permanent stat mutations or extra equipment slots. */
export class CharacterPassives {
  private character: CharacterId = 'zhaoyun';
  private stacks = 0; private lastGain = -Infinity; private lastDamage = 0;
  /** 黄忠（2026-11-18 改为命中积层，data/heroMechanics.ts HZ_SHARP）：神射截止时间、神射时长（静心加长）、上次受伤掉层时间。 */
  private sharpUntil = -Infinity; private sharpMs: number = HZ_SHARP.sharpMs; private hurtDropAt = -Infinity;
  /** 魏延：被围积层的进度（满 1 积 1 层）。 */
  private surroundAcc = 0;
  /** 诸葛亮观星：各目标的星象层数（uid → 层数 / 最后命中），与八阵图区域（易伤）。 */
  private readonly stars = new Map<number, { spawnId: number; marks: number; last: number }>();
  /** 观星·怪堆（2026-11-18 夜）：场上没有首领 / 精锐时，天火每发都积 1 层（不分打中谁），满层下一发算无遗策。 */
  private crowdStar = { marks: 0, last: -Infinity };
  private bazhen: { x: number; y: number; r: number; until: number }[] = [];
  /** 本关击杀数，及黄忠神射中射杀的精锐 / 首领数（技艺「老骥伏枥」读取）。 */
  private stageKills = 0; private sharpEliteKills = 0;
  private generation = 0; private stopped = false;
  private gains = 0; private triggers = 0;
  /** 被动触发了几次（出招起手特效 HeroCastFx 每帧比对） */
  triggerCount(): number { return this.triggers; }
  private readonly burns = new Map<number, Burn>();
  private readonly charms = new Map<number, Charm>();
  /** 魏延「谁敢杀我」减伤截止时间。 */
  private guardUntil = -Infinity;
  /** 马超锦马冲锋：冲锋中无敌截止、冲锋后「铁骑余威」减伤截止。 */
  private chargeInvulnUntil = -Infinity; chargeGuardUntil = -Infinity;
  /** 吕布「无双」：人中吕布截止；分支「人中吕布」时每次击杀延长多少（武器每帧写入）。 */
  private wsUntil = -Infinity; private wsStart = -Infinity; lvbuExtendMs = 0;
  isWushuang(now: number): boolean { return !this.stopped && this.character === 'lvbu' && now < this.wsUntil; }
  wushuangLeft(now: number): number { return this.isWushuang(now) ? this.wsUntil - now : 0; }
  /** 测试 / 开发：立刻进入人中吕布。 */
  grantWushuang(now: number): void { if (this.stopped || this.character !== 'lvbu') return; this.stacks = 0; this.wsStart = now; this.wsUntil = now + LVBU.frenzyMs; this.triggers++; }
  /** 张辽「止啼」：溃逃中的敌兵被击杀时攒 1 点，满了出一次「八百虎贲」（weapons/zhangliaoWeapon 取走）。 */
  private hubenPending = 0;
  onRoutKill(now: number): void { if (this.stopped || this.character !== 'zhangliao') return; this.stacks++; this.gains++; this.lastGain = now; if (this.stacks >= ZHANGLIAO.need) { this.stacks = 0; this.triggers++; this.hubenPending++; } }
  /** 周瑜「英发」：火船 / 火场烧死敌兵攒 1 点，满 zyNeed（武艺雅量会改）刮一次「东风」（weapons/zhouyuWeapon 取走）。 */
  zyNeed: number = ZHOUYU.need; private dongfengPending = 0;
  onFireKill(now: number): void { if (this.stopped || this.character !== 'zhouyu') return; this.stacks++; this.gains++; this.lastGain = now; if (this.stacks >= this.zyNeed) { this.stacks = 0; this.triggers++; this.dongfengPending++; } }
  takeDongfeng(): boolean { if (this.dongfengPending <= 0 || this.stopped) return false; this.dongfengPending--; return true; }
  /** 太史慈「信义」：身边部曲每挨一次打攒 1 点，满 tscNeed（北海突围会改）出一次「单骑突围」（weapons/taishiciWeapon 取走）。 */
  tscNeed: number = TAISHICI.need; private breakoutPending = 0;
  onAllyHurt(now: number): void { if (this.stopped || this.character !== 'taishici') return; this.stacks++; this.gains++; this.lastGain = now; if (this.stacks >= this.tscNeed) { this.stacks = 0; this.triggers++; this.breakoutPending++; } }
  takeBreakout(): boolean { if (this.breakoutPending <= 0 || this.stopped) return false; this.breakoutPending--; return true; }
  /** 曹操「奸雄」：部曲阵亡攒 1 点（回血在 GameScene），满 mdNeed（虎豹骑分支会改）召一次「虎豹骑」（weapons/mengdeWeapon 取走）；mdMarkVuln：军令易伤（武艺唯才是举会改）。 */
  mdNeed: number = MENGDE.need; mdMarkVuln: number = MENGDE.markVuln; private hubaoPending = 0;
  onAllyDeath(now: number): void { if (this.stopped || this.character !== 'mengde') return; this.stacks++; this.gains++; this.lastGain = now; if (this.stacks >= this.mdNeed) { this.stacks = 0; this.triggers++; this.hubaoPending++; } }
  takeHubao(): boolean { if (this.hubaoPending <= 0 || this.stopped) return false; this.hubaoPending--; return true; }
  takeHuben(): boolean { if (this.hubenPending <= 0 || this.stopped) return false; this.hubenPending--; return true; }
  /**
   * P3 第二批可玩武将（甘宁 / 典韦 / 孙权 / 孟获 / 祝融，共享笔记 p3-heroes-plan.md）共用一套量表：
   * 攒满 p3Need（武器每帧写入，分支会改）出一次招（p3Pending，武器 takeP3 取走）；甘宁「百骑劫营」、典韦「古之恶来」等限时状态记在 p3Until，
   * 期间移速 ×p3SpeedMul、受伤 ×p3GuardMul（Player.speed / takeDamage 读）。攒法按武将：p3KillCounts（击杀）/ onDamage（典韦受伤）。
   */
  p3Need = 10; private p3Pending = 0; p3Until = -Infinity; p3SpeedMul = 1; p3GuardMul = 1;
  /** 孙权「制衡」当前阵势名（武器写入，被动条显示）。 */
  p3StanceName = '';
  /** P3 常驻减伤（孟获武艺「藤甲」，武器每帧写入）。 */
  p3Armor = 1;
  /** 孟获分支「七擒不服」：受伤攒不服层（gapMs 内最多 1 层，decayMs 没挨打清空），伤害加成在武器里算。 */
  mhBufuOn = false; private mhStacks = 0; private mhLastHit = -Infinity;
  mhBufuStacks(now: number): number { if (now - this.mhLastHit > MENGHUO.bufu.decayMs) this.mhStacks = 0; return this.mhStacks; }
  get isP3(): boolean { return P3_HEROES.has(this.character); }
  p3Gain(now: number, n = 1): void { if (this.stopped || !this.isP3) return; this.stacks += n; this.gains++; this.lastGain = now; if (this.stacks >= this.p3Need) { this.stacks = 0; this.triggers++; this.p3Pending++; } }
  takeP3(): boolean { if (this.p3Pending <= 0 || this.stopped) return false; this.p3Pending--; return true; }
  startP3(now: number, ms: number, speedMul = 1, guardMul = 1): void { if (this.stopped) return; this.p3Until = now + ms; this.p3SpeedMul = speedMul; this.p3GuardMul = guardMul; }
  p3Active(now: number): boolean { return !this.stopped && now < this.p3Until; }
  /** 这名敌兵被击杀时算不算攒量（GameScene 在 deactivate 之前问）：甘宁 = 被钩过的；其余按各自规则。 */
  p3KillCounts(enemy: Enemy, now: number): boolean {
    if (this.stopped || !this.isP3) return false;
    const c = this.character as string;
    if (c === 'ganning') return enemy.hookedUntil > now;
    if (c === 'zhurong') return enemy.p3BurnUntil > now; // 祝融「火神后裔」：着火的敌兵
    if (c === 'sunquan' || c === 'menghuo') return true; // 孙权「制衡」、孟获「南蛮王」：任意击杀
    return false;
  }
  /** 孙尚香最近一次移动的时间（移动中掷刀更快）。 */
  private lastMoveAt = -Infinity;
  constructor(character: CharacterId = 'zhaoyun', now = 0) { this.reset(character, now); }
  reset(character: CharacterId, now: number): void {
    this.character = character; this.stacks = 0; this.lastGain = -Infinity; this.charmKillAt = -Infinity; this.lastDamage = now; this.sharpUntil = -Infinity; this.sharpMs = HZ_SHARP.sharpMs; this.hurtDropAt = -Infinity; this.surroundAcc = 0; this.stars.clear(); this.bazhen = []; this.stageKills = 0; this.sharpEliteKills = 0;
    this.generation++; this.stopped = false; this.gains = 0; this.triggers = 0; this.burns.clear(); this.charms.clear(); this.crowdStar = { marks: 0, last: -Infinity }; this.guardUntil = -Infinity; this.wsUntil = this.wsStart = -Infinity; this.hubenPending = 0; this.dongfengPending = 0; this.breakoutPending = 0; this.hubaoPending = 0; this.chargeInvulnUntil = this.chargeGuardUntil = -Infinity; this.p3Pending = 0; this.p3Until = -Infinity; this.p3SpeedMul = this.p3GuardMul = 1; this.p3StanceName = ''; this.p3Armor = 1; this.mhBufuOn = false; this.mhStacks = 0; this.mhLastHit = -Infinity;
  }
  get characterId(): CharacterId { return this.character; }
  stop(): void { this.stopped = true; this.stacks = 0; this.generation++; this.burns.clear(); this.charms.clear(); this.stars.clear(); this.crowdStar = { marks: 0, last: -Infinity }; this.bazhen = []; this.chargeInvulnUntil = this.chargeGuardUntil = -Infinity; }
  private get maxStacks(): number { return this.character === 'huangzhong' ? HZ_SHARP.need : this.character === 'zhuge' ? ZG_TIANHUO.starNeed : CHARACTER_PASSIVES[this.character].maxStacks; }
  onDamage(now: number): void {
    if (this.stopped) return;
    this.lastDamage = now;
    // 黄忠：受伤掉 1 层蓄势（每 0.5 秒最多掉 1 层）；神射中受伤不掉层、不退出
    if (this.character === 'huangzhong' && !this.isSharpshooter(now) && this.stacks > 0 && now - this.hurtDropAt + 1e-6 >= HZ_SHARP.hurtDropGapMs) { this.hurtDropAt = now; this.stacks--; }
    if ((this.character as string) === 'menghuo' && this.mhBufuOn && now - this.mhLastHit + 1e-6 >= MENGHUO.bufu.gapMs) { this.mhStacks = Math.min(MENGHUO.bufu.max, this.mhBufuStacks(now) + 1); this.mhLastHit = now; }
    // 典韦·恶来：每次受伤积 1 层（gainGapMs 内最多 1 层；古之恶来中照攒，结束后下一轮更快）
    if ((this.character as string) === 'dianwei' && now - this.lastGain + 1e-6 >= DIANWEI.gainGapMs) this.p3Gain(now);
    // 魏延·镇守汉中：每次受伤积 1 层拒敌（每 0.5 秒最多 1 层）
    if (this.character === 'weiyan' && this.stacks < this.maxStacks && now - this.lastGain + 1e-6 >= R.guardStepMs) { this.lastGain = now; this.stacks++; this.gains++; }
  }
  /** 魏延·拒敌：每帧报告身边 WY_SURROUND.radius 内的敌人数；每 perEnemies 名每秒积 stacksPerSec 层（与受伤积层并存）。 */
  onSurrounded(now: number, dtSec: number, count: number): void {
    if (this.stopped || this.character !== 'weiyan') return;
    const rate = Math.floor(count / WY_SURROUND.perEnemies) * WY_SURROUND.stacksPerSec;
    if (rate <= 0 || this.stacks >= this.maxStacks) { this.surroundAcc = 0; return; }
    this.surroundAcc += rate * dtSec;
    while (this.surroundAcc >= 1 && this.stacks < this.maxStacks) { this.surroundAcc -= 1; this.stacks++; this.gains++; }
  }
  /** 魏延「谁敢杀我」期间受到伤害的倍率。 */
  damageTakenMultiplier(now: number): number { if (this.stopped) return 1; return (now < this.guardUntil ? R.whoDaresGuardMul : 1) * (now < this.chargeGuardUntil && now >= this.chargeInvulnUntil ? R.chargeGuardMul : 1) * (now < this.p3Until ? this.p3GuardMul : 1) * (this.isP3 ? this.p3Armor : 1); }
  /** P3 限时状态的移速倍数（甘宁百骑劫营）。 */
  speedMultiplier(now: number): number { return this.p3Active(now) ? this.p3SpeedMul : 1; }
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
  /** 貂蝉离间：倒戈的敌人受伤 +20%，被魅惑满层的首领受伤 +25%；诸葛亮八阵图：阵内敌人受伤 ×1.15。 */
  vulnerability(enemy: Enemy, now: number): number {
    let v = this.character === 'zhangliao' && enemy.routUntil > now ? 1 + ZHANGLIAO.routVuln : 1; // 张辽：溃逃的敌兵受伤加成
    if (this.character === 'mengde' && enemy.junlingUntil > now) v *= 1 + this.mdMarkVuln; // 曹操：军令标记
    if (this.bazhen.length) { this.bazhen = this.bazhen.filter(z => z.until > now); if (this.bazhen.some(z => Math.hypot(enemy.x - z.x, enemy.y - z.y) <= z.r + enemy.radius)) v *= ZG_TIANHUO.bazhen.vuln; }
    if (!this.charms.size) return v;
    const c = this.charmOf(enemy); if (!c) return v;
    return v * (c.turnedUntil > now ? R.turnVulnerability : c.vulnUntil > now ? R.charmVulnerability : 1);
  }
  /** 诸葛亮观星：天火落到目标身上。已满 starNeed 层 → 本发爆发（返回 true，清层）；否则积 1 层。最多记 starTargets 个目标，starDecayMs 没再打中就散。 */
  starLand(enemy: Enemy, now: number): boolean {
    if (this.stopped || this.character !== 'zhuge' || !enemy.active) return false;
    for (const [uid, s] of this.stars) if (now - s.last > ZG_TIANHUO.starDecayMs) this.stars.delete(uid);
    let s = this.stars.get(enemy.uid); if (s && s.spawnId !== enemy.spawnId) { this.stars.delete(enemy.uid); s = undefined; }
    if (s && s.marks >= ZG_TIANHUO.starNeed) { this.stars.delete(enemy.uid); this.triggers++; return true; }
    if (!s) {
      if (this.stars.size >= ZG_TIANHUO.starTargets) { let old = -1, t = Infinity; for (const [uid, x] of this.stars) if (x.last < t) { t = x.last; old = uid; } this.stars.delete(old); }
      s = { spawnId: enemy.spawnId, marks: 0, last: now }; this.stars.set(enemy.uid, s);
    }
    s.marks++; s.last = now; this.gains++; return false;
  }
  /** 观星·怪堆：场上没有首领 / 精锐时天火落地（打中谁都算，目标先死了也算）。已满 starNeed 层 → 本发算无遗策（返回 true，清层）；否则积 1 层。starDecayMs 没再落地就散。 */
  starLandCrowd(now: number): boolean {
    if (this.stopped || this.character !== 'zhuge') return false;
    const c = this.crowdStar; if (now - c.last > ZG_TIANHUO.starDecayMs) c.marks = 0;
    if (c.marks >= ZG_TIANHUO.starNeed) { c.marks = 0; c.last = now; this.triggers++; return true; }
    c.marks++; c.last = now; this.gains++; return false;
  }
  /** 观星·怪堆当前层数。 */
  crowdStarMarks(now: number): number { return now - this.crowdStar.last <= ZG_TIANHUO.starDecayMs ? this.crowdStar.marks : 0; }
  /** 某个目标当前的星象层数（测试 / HUD）。 */
  starMarks(enemy: Enemy, now: number): number { const s = this.stars.get(enemy.uid); return s && s.spawnId === enemy.spawnId && now - s.last <= ZG_TIANHUO.starDecayMs ? s.marks : 0; }
  private starTop(now: number): number { let m = this.crowdStarMarks(now); for (const s of this.stars.values()) if (now - s.last <= ZG_TIANHUO.starDecayMs) m = Math.max(m, s.marks); return m; }
  /** 诸葛亮八阵图：登记易伤区域（减速 / 首领出招变慢在武器里结算）。 */
  addBazhen(x: number, y: number, r: number, until: number): void { if (!this.stopped) this.bazhen.push({ x, y, r, until }); }
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
  /**
   * 闭月分支（团扇几率魅惑，WeaponBranches dc_biyue）：直接倒戈 ms（不叠离间层数、精锐不减半），和离间同一套倒戈驱动（行走 / 出手动作、倒戈标记）。
   * 原来分支只把敌兵眩晕原地、每 0.5 秒对周围结算伤害，兵本人没有任何动作；进阶「被魅惑的精锐会攻击首领」也因伤害排除首领而没生效。
   */
  charmTurn(enemy: Enemy, now: number, ms: number, opts: { huntBoss?: boolean; strike?: (target: Enemy) => void } = {}): boolean {
    if (this.stopped || !enemy.active || enemy.isSupplySlot || enemy.kind === 'boss' || enemy.controlImmune) return false;
    let c = this.charmOf(enemy);
    if (!c) { if (this.charms.size >= 200) return false; c = { enemy, spawnId: enemy.spawnId, marks: 0, lastMark: now, turnedUntil: 0, vulnUntil: 0 }; this.charms.set(enemy.uid, c); }
    if (c.turnedUntil > now) return false;
    c.turnedUntil = now + ms; c.marks = 0; c.huntBoss = !!opts.huntBoss; c.strike = opts.strike;
    return true;
  }
  private turn(c: Charm, now: number, ms: number, gainStack = true): boolean {
    c.turnedUntil = now + ms; c.marks = 0; c.huntBoss = false; c.strike = undefined;
    if (gainStack && this.character === 'diaochan' && this.stacks < this.maxStacks) { this.stacks++; this.gains++; }
    return true;
  }
  /**
   * 倒戈中的敌人：不追主将，转身冲向最近的同伴，碰到后每 0.5 秒用自己的接触伤害打它。
   * 由 GameScene 的敌人行动循环调用；返回 true 表示本帧已接管该敌人的行动（行走 / 攻击帧仍由 GameScene 照常更新）。
   * 2026-11-20 用户「貂蝉离间后，离间的兵没有动作」：原来只改坐标，不给移动意图、出手不播攻击帧——现在移动写 intentDx/Dy（朝向跟着目标走），贴身出手 startAttack 朝向目标。
   */
  driveTurned(enemy: Enemy, dt: number, now: number, nearby: (x: number, y: number, r: number) => Enemy[], hit: (target: Enemy, amount: number) => void): boolean {
    const c = this.charms.size ? this.charmOf(enemy) : undefined; if (!c || c.turnedUntil <= now) return false;
    let best: Enemy | null = null, bd: number = R.turnSeek;
    // 进阶：被魅惑的精锐先找首领（找得远一些）
    if (c.huntBoss) for (const o of nearby(enemy.x, enemy.y, R.turnSeek * 2.5)) { if (o.kind !== 'boss' || !o.active) continue; const d = Math.hypot(o.x - enemy.x, o.y - enemy.y); if (d < R.turnSeek * 2.5 && (!best || d < bd)) { bd = d; best = o; } }
    if (!best) for (const o of nearby(enemy.x, enemy.y, R.turnSeek)) {
      if (o === enemy || !o.active || o.isSupplySlot || o.def.behavior === 'wall') continue;
      const d = Math.hypot(o.x - enemy.x, o.y - enemy.y); if (d < bd) { bd = d; best = o; }
    }
    enemy.moveVx = enemy.moveVy = 0;
    if (!best) { enemy.intentDx = enemy.intentDy = 0; return true; }
    const reach = enemy.radius + best.radius + 4, dx = best.x - enemy.x, dy = best.y - enemy.y;
    if (bd > reach) { const s = Math.min(bd - reach, enemy.def.speed * dt), mx = dx / bd * s, my = dy / bd * s; enemy.sprite.x += mx; enemy.sprite.y += my; enemy.intentDx = mx; enemy.intentDy = my; }
    else {
      enemy.intentDx = dx / bd * .01; enemy.intentDy = dy / bd * .01; // 贴身：朝向同伴站定
      if (enemy.contactCd <= 0) { enemy.contactCd = R.turnHitMs / 1000; enemy.startAttack(now, Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'); if (c.strike) { c.strike(best); hit(best, 0); } else hit(best, enemy.def.damage); }
    }
    return true;
  }
  /** 测试 / 表现用：当前魅惑与倒戈状态。 */
  charmViews(): CharmView[] { return [...this.charms.values()]; }
  isSharpshooter(now: number): boolean { return !this.stopped && this.character === 'huangzhong' && now < this.sharpUntil; }
  /** 黄忠：一支重箭命中（每支箭只算一次），积 1 层蓄势；满层进入神射 sharpMs。神射中不积层。 */
  onSharpHit(now: number): void {
    if (this.stopped || this.character !== 'huangzhong' || this.isSharpshooter(now)) return;
    this.stacks++; this.gains++;
    if (this.stacks >= HZ_SHARP.need) { this.stacks = 0; this.sharpUntil = now + this.sharpMs; this.triggers++; }
  }
  /** 敌人被击杀（GameScene.killEnemy 调用）：计本关击杀；黄忠神射中击杀精锐 / 首领另计。 */
  onKill(kind: string, now: number): void {
    if (this.stopped) return;
    this.stageKills++;
    if ((kind === 'elite' || kind === 'boss') && this.isSharpshooter(now)) this.sharpEliteKills++;
    // 吕布「无双」：击杀积战意；满了人中吕布；人中吕布中（分支「人中吕布」）击杀延长，最多延到开始后 frenzyMs + extendCap
    if (this.character === 'lvbu') {
      if (this.isWushuang(now)) { if (this.lvbuExtendMs > 0) this.wsUntil = Math.min(this.wsUntil + this.lvbuExtendMs, this.wsStart + LVBU.frenzyMs + LVBU.renzhong.extendCapMs); }
      else { this.stacks++; this.gains++; if (this.stacks >= LVBU.need) this.grantWushuang(now); }
    }
  }
  get kills(): number { return this.stageKills; }
  get sharpEliteKillCount(): number { return this.sharpEliteKills; }
  /** 黄忠「静心」：设定神射持续时间（毫秒）。 */
  setSharpMs(ms: number): void { this.sharpMs = Math.max(1000, ms); }
  get sharpDurationMs(): number { return this.sharpMs; }
  /** 神射剩余毫秒（不在神射为 0）。 */
  sharpLeft(now: number): number { return this.isSharpshooter(now) ? this.sharpUntil - now : 0; }
  /** 黄忠「宝刀未老」/ 测试：已在神射中则延长 extendMs，否则立刻进入神射（持续 sharpMs 与 extendMs 取大）。 */
  grantSharp(now: number, extendMs: number): void {
    if (this.stopped || this.character !== 'huangzhong') return;
    if (this.isSharpshooter(now)) this.sharpUntil += extendMs; else { this.stacks = 0; this.sharpUntil = now + Math.max(this.sharpMs, extendMs); this.triggers++; }
  }
  critBonus(now: number): number { return this.isSharpshooter(now) ? R.critBonus : 0; }
  /** 智力的范围倍率（GameScene 开局 / 加点后设置，RunGrowth.areaMultiplier）。 */
  areaMul = 1;
  /** 守城登城（systems/DefenseBattle）：站在城头带里武器范围加成；平时 1。 */
  rampartMul = 1;
  rangeMultiplier(weapon: WeaponId): number {
    return (!this.stopped && this.character === 'guanyu' && weapon === 'guandao' ? 1 + this.stacks * R.guandaoRangePerStack : 1) * this.areaMul * this.rampartMul;
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
    }
    if (c.empowered) { this.stacks = 0; this.triggers++; }
    return c;
  }
  recordHit(cast: PassiveCast, enemy: Enemy, now: number, explosionDamage = 0): void {
    if (this.stopped || cast.owner !== this.character || cast.generation !== this.generation || cast.hits.has(enemy.spawnId)) return;
    cast.hits.add(enemy.spawnId);
    const qualifying = this.character === 'guanyu' && cast.weapon === 'guandao' || this.character === 'liubei' && cast.weapon === 'shuanggu_swords';
    // 刘备双股剑一剑最多砍两人：砍中 2 人即积仁德；其余扇形 / 爆发类为 3 人
    if (qualifying && !cast.empowered && !cast.awarded && cast.hits.size >= (cast.weapon === 'shuanggu_swords' ? 2 : R.coneThreshold)) {
      cast.awarded = true; this.stacks = Math.min(this.maxStacks, this.stacks + 1); this.gains++;
    }
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
    // P2：分支 / 武艺会改满层数（周瑜雅量、太史慈北海突围、曹操虎豹骑），被动条和脚下刻度都按实际满层显示
    const need = this.character === 'zhouyu' ? this.zyNeed : this.character === 'taishici' ? this.tscNeed : this.character === 'mengde' ? this.mdNeed : this.isP3 ? this.p3Need : this.maxStacks;
    return { character: this.character, stacks: this.character === 'zhuge' ? this.starTop(now) : this.character === 'lvbu' && this.isWushuang(now) ? need : this.stacks, maxStacks: need,
      ready: !this.stopped && (this.character === 'lvbu' ? this.isWushuang(now) : this.isP3 && this.p3Active(now) && (this.character as string) !== 'sunquan' ? true : this.character === 'huangzhong' ? this.isSharpshooter(now) : (this.character === 'zhuge' ? this.starTop(now) : this.stacks) >= need),
      // 黄忠：神射中为剩余时间比例，否则为蓄势比例（PassiveHud 进度条）
      calmProgress: this.stopped || this.character !== 'huangzhong' ? 0 : this.isSharpshooter(now) ? this.sharpLeft(now) / this.sharpMs : this.stacks / HZ_SHARP.need,
      critBonus: this.critBonus(now), guandaoRangeMul: this.rangeMultiplier('guandao'), burns: this.burns.size, charms: this.charms.size, turned: [...this.charms.values()].filter(c => c.turnedUntil > now).length, gains: this.gains, triggers: this.triggers, stopped: this.stopped };
  }
  label(now: number): string {
    const name = CHARACTER_PASSIVES[this.character].name;
    if (this.character === 'zhuge') return `${name} · 星象 ${this.starTop(now)}/${ZG_TIANHUO.starNeed}${this.starTop(now) >= ZG_TIANHUO.starNeed ? ' · 下一发算无遗策' : ''}`;
    if (this.character === 'mengde') return `${name} ${this.stacks}/${this.mdNeed}`;
    if ((this.character as string) === 'sunquan') return `${name} · ${this.p3StanceName || '守势'} ${this.stacks}/${this.p3Need}`;
    if (this.isP3) return this.p3Active(now) ? `${name} · ${P3_ACTIVE_NAME[this.character] ?? '发动'} ${((this.p3Until - now) / 1000).toFixed(1)}秒` : `${name} ${this.stacks}/${this.p3Need}`;
    if (this.character === 'taishici') return `${name} ${this.stacks}/${this.tscNeed}`;
    if (this.character === 'zhouyu') return `${name} ${this.stacks}/${this.zyNeed}`;
    if (this.character === 'zhangliao') return `${name} ${this.stacks}/${ZHANGLIAO.need}`;
    if (this.character === 'lvbu') return this.isWushuang(now) ? `${name} · 人中吕布 ${(this.wushuangLeft(now) / 1000).toFixed(1)}秒：每击两次 · 移速 +40% · 攻速 +25%` : `${name} · 战意 ${this.stacks}/${LVBU.need}`;
    if (this.character === 'huangzhong') return this.isSharpshooter(now) ? `${name} · 神射 ${(this.sharpLeft(now) / 1000).toFixed(1)}秒：暴击+10% / 重箭爆裂` : `${name} · 蓄势 ${this.stacks}/${HZ_SHARP.need}`;
    return `${name} · ${this.character === 'zhaoyun' ? '龙胆' : this.character === 'guanyu' ? '武势' : this.character === 'zhangfei' ? '怒气' : this.character === 'huangyueying' ? '机括' : this.character === 'pangtong' ? '计策' : this.character === 'liubei' ? '仁德' : this.character === 'weiyan' ? '拒敌' : this.character === 'machao' ? '铁骑' : this.character === 'sunshangxiang' ? '疾步' : this.character === 'diaochan' ? '舞势' : '星象'} ${this.stacks}/${this.maxStacks}${this.snapshot(now).ready ? ' · 下次强化' : ''}${this.character === 'diaochan' && this.snapshot(now).turned ? ` · 离间${this.snapshot(now).turned}` : ''}${this.character === 'weiyan' && this.damageTakenMultiplier(now) < 1 ? ' · 谁敢杀我' : ''}`;
  }
}
