import {BuildState} from '../data/builds';
import { BALANCE } from '../config';
import type { CharacterId } from '../data/characters';
import type { Player } from '../entities/Player';
import { emptyGear, type GearStats } from './ItemEffects';

export type AttributeId = 'might' | 'quickness' | 'critical' | 'constitution' | 'agility' | 'command';
export type ZhaoMasteryId = 'dragon_gallop' | 'cloud_pierce';
export const MARTIALS = {
  dragon_gallop: {character:'zhaoyun',name:'龙胆连刺',desc:'每级连刺效率 +8%'},
  cloud_pierce: {character:'zhaoyun',name:'游龙穿云',desc:'每级枪长 +10%、穿透 +1'},
  dragon_charge: {character:'guanyu',name:'青龙蓄势',desc:'四次基础挥砍后重斩 140%/165%/190%；三级击退'},
  dragging_blade: {character:'guanyu',name:'拖刀斩',desc:'移动约5/4/3个身位蓄刀气；三级回旋'},
  // 2026-11-16：黄忠改用宝雕弓，连弩武学归黄月英
  steady_aim: {character:'huangyueying',name:'百步穿杨',desc:'静止最多5秒，每秒暴击 +3/4/5%；移动衰减'},
  pearl_volley: {character:'huangyueying',name:'连珠齐射',desc:'每 5/4/3 次基础射击追加70%伤害箭'},
  wildfire: {character:'zhuge',name:'烽火燎原',desc:'爆发留火 1/1.8/2.5秒，每0.5秒20%伤害'},
  eight_trigrams: {character:'zhuge',name:'八阵困军',desc:'每三次施法聚敌、减速后引爆；间隔10秒'},
  kaishan: {character:'weiyan',name:'开山',desc:'每劈 4 刀一次重劈：裂波加宽 50%，伤害 150%/170%/190%'},
  gujun: {character:'weiyan',name:'孤军深入',desc:'身边每名敌人伤害 +1.5%/2%/2.5%（最多 15 名）'},
  fulei: {character:'pangtong',name:'伏雷',desc:'每级火雷上限 +2、存在时间 +2 秒'},
  lianying: {character:'pangtong',name:'连营',desc:'每级连锁距离 +15%；3 级时连锁引爆伤害 +20%'},
  huishen: {character:'sunshangxiang',name:'回身飞刀',desc:'移动中掷出的飞刀每级多穿透 1 人'},
  baibi: {character:'sunshangxiang',name:'百婢',desc:'每级侍婢上限 +1、存在时间 +2 秒'},
  nichang: {character:'diaochan',name:'霓裳',desc:'每级飞扇距离 +15%；3 级时多掷 1 柄'},
  meirenji: {character:'diaochan',name:'美人计',desc:'每级倒戈时间 +0.5 秒；3 级时 2 层魅惑即可离间'},
  // 2026-11-16 方案 C「老当益壮」（用户选定）：「百步」去掉（和黄月英「百步穿杨」撞名），换成「静心」
  jingxin: {character:'huangzhong',name:'静心',desc:'进入神射只需不受伤 4.5/4/3.5 秒，神射重箭伤害 +12%/18%/25%；3 级时神射第一箭化为扇形三连重箭'},
  // 2026-11-16 用户：「不靠残血触发」→ 改为越战越勇
  laoji: {character:'huangzhong',name:'老骥伏枥',desc:'本关每击杀 10 名敌人射速 +2.5%（上限 15%/20%/25%）；3 级时神射中射杀精锐回血、神射更稳'},
  wanrendi: {character:'zhangfei',name:'万人敌',desc:'每级声浪推进距离 +12%'},
  dahe: {character:'zhangfei',name:'大喝',desc:'每级断桥区多 0.5 秒、震慑多 0.2 秒'},
  jinma: {character:'machao',name:'锦马',desc:'每级落地范围 +15%；3 级时落地后再震一次'},
  tieqi: {character:'machao',name:'铁骑',desc:'每级冲锋距离 +20%、伤害 +10%'},
  taoyuan: {character:'liubei',name:'桃园',desc:'每级交叉斩溅射范围 +10；3 级时三剑分击三人'},
  xiemin: {character:'liubei',name:'携民',desc:'每级仁德回复量 +25%'},
} as const;
export type MasteryId = keyof typeof MARTIALS;
export type PotionId = 'rejuvenation' | 'berserk';
export type TrinketId = 'tiger_tally' | 'heart_mirror' | 'wind_boots';

/** 2026-11-16 属性点改版（平衡会话提议、用户批准）：每级 1 点、单项上限 8、每点效果减半，新增「统御」。 */
export const ATTRIBUTE_MAX = 8;
/** 每升几级发放 1 个属性点（Lv.2、4、6…）。升级三选一仍每级一次。 */
export const ATTRIBUTE_POINT_EVERY = 1;
/** 从 from 级升到 to 级途中到达的「加点等级」数。 */
export function attributePointsBetween(from: number, to: number): number { return Math.max(0, Math.floor(to / ATTRIBUTE_POINT_EVERY) - Math.floor(from / ATTRIBUTE_POINT_EVERY)); }
/** 当前等级再升几级可获得下一个属性点（1 或 2）。 */
export function levelsToNextAttributePoint(level: number): number { return ATTRIBUTE_POINT_EVERY - (level % ATTRIBUTE_POINT_EVERY); }
/** 局内「战功」与武将等级共用的经验表：从 level 升到 level+1 所需经验。 */
export function xpToNext(level: number): number { return level <= 1 ? 16 : level <= 4 ? [16, 36, 52][level - 2] : 68 + (level - 4) * 20; }
export const TRINKET_SLOTS = 2;
/** 每点效果（数值归平衡会话）。 */
export const ATTRIBUTE_STEP: Record<AttributeId, number> = { might: .025, quickness: .02, critical: .01, constitution: .05, agility: .015, command: .03 };
export const ATTRIBUTE_INFO: Record<AttributeId, { name: string; effect: string }> = {
  might: { name: '武力', effect: '本命武器伤害 +2.5% / 点' },
  quickness: { name: '迅捷', effect: '攻击速度 +2% / 点' },
  critical: { name: '会心', effect: '暴击率 +1% / 点' },
  constitution: { name: '体魄', effect: '基础生命上限 +5% / 点' },
  agility: { name: '身法', effect: '移动速度 +1.5% / 点' },
  command: { name: '统御', effect: '部曲伤害 +3% / 点' },
};
/** 属性图标：统御暂借「虎符」图标（没有专属图）。 */
export function attributeIcon(id: AttributeId): string { return id === 'command' ? 'growth_icon_tiger_tally' : 'growth_icon_' + id; }

/** Per-battle growth. It is intentionally not part of the permanent save model. */
export class RunGrowth {
  readonly build=new BuildState();
  revivalUsed=false;
  awakenRescueUsed=false;
  readonly attributes: Record<AttributeId, number> = { might: 0, quickness: 0, critical: 0, constitution: 0, agility: 0, command: 0 };
  readonly masteries: Record<MasteryId, number> = { dragon_gallop: 0, cloud_pierce: 0, dragon_charge:0, dragging_blade:0, steady_aim:0, pearl_volley:0, wildfire:0, eight_trigrams:0, kaishan:0, gujun:0, fulei:0, lianying:0, huishen:0, baibi:0, nichang:0, meirenji:0, jingxin:0, laoji:0, wanrendi:0, dahe:0, jinma:0, tieqi:0, taoyuan:0, xiemin:0 };
  readonly trinkets: TrinketId[] = [];
  unallocated = 0;
  /** unallocated 里属于武将永久属性点的部分（加点时写回 HeroProgress）；其余是本局额外点（如城池加成）。 */
  heroFree = 0;
  /** 兵装加成（局外道具，开局按武将读入，见 ItemEffects.gearFor）。 */
  gear: GearStats = emptyGear();
  /** 生命低于 35%（由 Player.update 每帧更新），供名器「背水 / 踏风」判断。 */
  lowHp = false;
  private xpCarry = 0;
  /** 名器「饮血」下次可触发的时刻。 */
  killHealAt = 0;
  /** W3 大城特产（洛阳）：本命武器伤害加成，开局由 applyCitySpecialties 设置。 */
  permanentDamage = 0;
  berserkUntil = 0;
  /** 遗珍「乌巢酒葫」豪饮结束时刻（战斗时钟）。 */
  wineUntil = 0;
  stationarySeconds = 0;
  travel = 0;
  slashCount = 0;
  shotCount = 0;
  flagCount = 0;
  formationReadyAt = 0;
  recordMovement(distance: number, dt: number): void {
    if(this.masteries.dragging_blade) this.travel=Math.min(200,this.travel+Math.max(0,distance));
    this.stationarySeconds=distance>.5?Math.max(0,this.stationarySeconds-dt*2):Math.min(5,this.stationarySeconds+dt);
  }
  aimCriticalBonus(): number { return this.masteries.steady_aim ? this.stationarySeconds*(.02+.01*this.masteries.steady_aim) : 0; }
  masteryLabel(): string { return (Object.keys(MARTIALS) as MasteryId[]).filter(id=>this.owns(id)).map(id=>`${MARTIALS[id].name} Lv.${this.masteries[id]}`).join(' · '); }

  constructor(readonly character: CharacterId) {}

  get hasAttributeRoom(): boolean { return Object.values(this.attributes).reduce((n,level)=>n+ATTRIBUTE_MAX-level,0)>this.unallocated; }
  get weaponMasteryLevel(): number { return this.masteries.dragon_gallop; }
  get spearPierceLevel(): number { return this.masteries.cloud_pierce; }
  /** 张飞同用长枪，与赵云共用两项枪术专精。 */
  owns(id: MasteryId): boolean { const c = MARTIALS[id].character as string; return c === this.character; } // 2026-11-16 起每位武将只用自己的专属武学
  canLearn(id: MasteryId): boolean { return this.owns(id) && this.masteries[id] < 3; }

  addAttributePoints(amount = 2): void { this.unallocated = Math.min(Object.values(this.attributes).reduce((n,level)=>n+ATTRIBUTE_MAX-level,0),this.unallocated+Math.max(0, Math.floor(amount))); }

  allocate(player: Player, id: AttributeId): boolean {
    if (this.unallocated <= 0 || this.attributes[id] >= ATTRIBUTE_MAX) return false;
    const oldMax = player.maxHp;
    this.attributes[id] += 1;
    this.unallocated -= 1;
    if (id === 'constitution') player.heal(player.maxHp - oldMax);
    return true;
  }

  learn(id: MasteryId): boolean {
    if (!this.canLearn(id)) return false;
    this.masteries[id] += 1;
    return true;
  }

  usePotion(id: PotionId, player: Player, now: number): void {
    if (id === 'rejuvenation') player.heal(Math.round(player.maxHp * 0.3));
    else this.berserkUntil = Math.max(this.berserkUntil, now) + 10000;
  }

  equipTrinket(id: TrinketId, replace?: TrinketId): boolean {
    if (replace) {
      const index = this.trinkets.indexOf(replace);
      if (index < 0 || this.trinkets.includes(id)) return false;
      this.trinkets[index] = id;
      return true;
    }
    if (this.trinkets.includes(id) || this.trinkets.length + this.build.treasures.length >= TRINKET_SLOTS) return false;
    this.trinkets.push(id);
    return true;
  }

  damageMultiplier(now: number): number {
    const might = 1 + ATTRIBUTE_STEP.might * this.attributes.might;
    const fury = this.lowHp && this.gear.specials.includes('fury') ? 1.25 : 1;
    const wine = now < this.wineUntil && this.gear.specials.includes('jiuhu') ? 1.4 : 1; // 遗珍「乌巢酒葫」（BossRelics.RELIC.jiuhuDamage）
    return Math.min(2, might * (now < this.berserkUntil ? 1.25 : 1) * (1 + this.permanentDamage) * (1 + this.gear.damage)) * fury * wine;
  }

  attackSpeedMultiplier(now: number): number {
    const quickness = 1 + ATTRIBUTE_STEP.quickness * this.attributes.quickness;
    return Math.min(1.8, quickness * (now < this.berserkUntil ? 1.2 : 1) * (1 + this.gear.attackSpeed));
  }

  movementMultiplier(): number {
    const windrider = this.lowHp && this.gear.specials.includes('windrider') ? 1.2 : 1;
    return Math.min(1.45, (1 + [0,.03,.05,.07][this.build.level('swift')]) * (1 + ATTRIBUTE_STEP.agility * this.attributes.agility) * (this.trinkets.includes('wind_boots') ? 1.1 : 1) * (1 + this.gear.move)) * windrider;
  }

  criticalBonus(): number { return Math.min(0.1, ATTRIBUTE_STEP.critical * this.attributes.critical) + this.gear.crit; }
  bonusMaxHp(): number { return Math.round(BALANCE.player.maxHp * (ATTRIBUTE_STEP.constitution * this.attributes.constitution + this.gear.hp)); }
  incomingDamageMultiplier(): number { return (this.gear.specials.includes('weixi') ? 1.15 : 1)*(this.trinkets.includes('heart_mirror') ? 0.85 : 1)*(this.build.tags().bulwark>=2?.95:1)*Math.max(.6, 1 - this.gear.reduce); }
  allyDamageMultiplier(): number { return (this.trinkets.includes('tiger_tally') ? 1.2 : 1)*(this.build.tags().command>=2?1.05:1)*(1 + this.gear.ally)*(1 + ATTRIBUTE_STEP.command * this.attributes.command); }
  /** 兵装「对精锐 / 首领伤害」与名器「斩将」：只作用于武将本人的命中。 */
  gearHitMultiplier(kind: string): number { return kind === 'boss' ? 1 + this.gear.elite + this.gear.boss : kind === 'elite' ? 1 + this.gear.elite : 1; }
  /** 兵装「经验获取」：小数部分累计，不丢失。 */
  scaleXp(value: number): number { const v = value * (1 + this.gear.xp) + this.xpCarry, n = Math.floor(v); this.xpCarry = v - n; return n; }
  spearLengthMultiplier(): number { return 1 + 0.1 * this.masteries.cloud_pierce; }
  spearTargetBonus(): number { return this.masteries.cloud_pierce; }
}
