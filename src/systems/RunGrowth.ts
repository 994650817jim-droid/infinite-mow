import { SCHOOL_TIER } from '../data/schools';
import { heroXpToNext } from '../data/heroLevels';
import {BuildState,type TacticId} from '../data/builds';
import type { CharmLegends, CharmStatDelta } from './CharmEffects';
import { BALANCE } from '../config';
import type { CharacterId } from '../data/characters';
import type { Player } from '../entities/Player';
import { emptyGear, type GearStats } from './ItemEffects';

import { attributePointsAt } from '../data/attributes';
import { ATTRIBUTE_EFFECT, SPELL_WEAPONS, ATTRIBUTE_IDS, ATTRIBUTE_INFO, ATTRIBUTE_MAX, attributeCap, ATTRIBUTE_POINT_EVERY, PRIMARY_BONUS, PRIMARY_MUL, PRIMARY_TIERS, PRIMARY_PERK, primaryAttribute, type AttributeId } from '../data/attributes';
import { LB_COMMAND } from '../data/heroMechanics';
export { ATTRIBUTE_IDS, ATTRIBUTE_INFO, ATTRIBUTE_MAX, ATTRIBUTE_POINT_EVERY, attributeCap, type AttributeId };
export type ZhaoMasteryId = 'dragon_gallop' | 'cloud_pierce';
/**
 * 关羽「拖刀斩」（2026-11-16 用户：「拖刀斩不要这么容易触发」「还可以再久一点才触发」）：触发所需移动距离 200/160/130 → 560/480/400（约 14/12/10 个身位），
 * 单次刀气加强 0.5/0.65/0.75 → 1.1/1.5/1.8、三级回旋 0.4 → 1.0，触发少了但每次更有分量（总收益约为原来 78%）。
 * 武器逻辑、增益图标进度（BuffHud）、技艺说明都读这里。
 */
export const DRAG_TRAVEL: readonly number[] = [560, 480, 400], DRAG_WAVE_MUL: readonly number[] = [1.1, 1.5, 1.8], DRAG_SPIN_MUL = 1;
/** 拖刀斩触发距离折合身位（约 40 像素一个身位），说明文字用。 */
export const dragBodyLengths = (lv: number): string => String(Math.round(DRAG_TRAVEL[lv - 1] / 40 * 2) / 2);
export const MARTIALS = {
  dragon_gallop: {character:'zhaoyun',name:'龙胆连刺',desc:'每级枪刺攻速 +8%'},
  cloud_pierce: {character:'zhaoyun',name:'游龙穿云',desc:'每级枪长 +10%、穿透 +1'},
  dragon_charge: {character:'guanyu',name:'青龙蓄势',desc:'每挥刀4次，下一刀 140/165/190% 伤害；3级附带击退'},
  dragging_blade: {character:'guanyu',name:'拖刀斩',desc:'移动约14/12/10个身位后，下一刀追加刀气；3级再加回旋刀气'},
  // 2026-11-16：黄忠改用宝雕弓，连弩武学归黄月英
  steady_aim: {character:'huangyueying',name:'百步穿杨',desc:'站着不动每秒暴击率 +3/4/5%（最多5秒）；移动会慢慢失去'},
  pearl_volley: {character:'huangyueying',name:'连珠齐射',desc:'每射击 5/4/3 次多射一支 70% 伤害的箭'},
  wildfire: {character:'zhuge',name:'借东风',desc:'每第 4 发天火（没有首领 / 精锐时每第 3 发）放出东风火龙，朝怪最密处扫过，伤害 60%/75%/90%，并把敌人顺风吹开'},
  eight_trigrams: {character:'zhuge',name:'八阵图',desc:'观星爆发处布阵 2/2.5/3 秒：减速 40%、受伤 +15%，每 0.5 秒伤害阵内敌人（天火 15%/20%/25%，首领精锐打折）；3 级时阵内首领出招变慢'},
  kaishan: {character:'weiyan',name:'开山',desc:'每劈 4 刀一次重劈：裂波加宽 50%，伤害 150%/170%/190%'},
  gujun: {character:'weiyan',name:'孤军深入',desc:'身边每名敌人伤害 +1.5%/2%/2.5%（最多 15 名）'},
  fulei: {character:'pangtong',name:'伏雷',desc:'每级火雷上限 +2、存在时间 +2 秒'},
  lianying: {character:'pangtong',name:'连营',desc:'每级连锁距离 +15%；3 级时连锁引爆伤害 +20%'},
  huishen: {character:'sunshangxiang',name:'回身飞刀',desc:'移动中掷出的飞刀每级多穿透 1 人'},
  baibi: {character:'sunshangxiang',name:'百婢',desc:'每级侍婢上限 +1、存在时间 +2 秒'},
  nichang: {character:'diaochan',name:'霓裳',desc:'每级飞扇距离 +15%；3 级时多掷 1 柄'},
  meirenji: {character:'diaochan',name:'美人计',desc:'每级倒戈时间 +0.5 秒；3 级时 2 层魅惑即可离间'},
  // 2026-11-16 方案 C「老当益壮」（用户选定）：「百步」去掉（和黄月英「百步穿杨」撞名），换成「静心」
  jingxin: {character:'huangzhong',name:'静心',desc:'神射持续 7/8/9 秒，神射重箭伤害 +20%/22%/25%；3 级时神射第一箭化为扇形三连重箭'},
  // 2026-11-16 用户：「不靠残血触发」→ 改为越战越勇
  laoji: {character:'huangzhong',name:'老骥伏枥',desc:'本关每击杀 10 名敌人射速 +2.5%（上限 15%/20%/25%）；3 级时神射中射杀精锐回血、神射延长'},
  wanrendi: {character:'zhangfei',name:'万人敌',desc:'每级声浪推进距离 +12%'},
  dahe: {character:'zhangfei',name:'大喝',desc:'每级断桥区多 0.5 秒、震慑多 0.2 秒'},
  jinma: {character:'machao',name:'锦马',desc:'每级落地范围 +15%；3 级时落地后再震一次'},
  tieqi: {character:'machao',name:'铁骑',desc:'每级冲锋距离 +20%、伤害 +10%'},
  taoyuan: {character:'liubei',name:'桃园',desc:'每级交叉斩溅射范围 +10；3 级时三剑分击三人'},
  xiemin: {character:'liubei',name:'携民',desc:'每级仁德回复量 +25%'},
} as const;
export type MasteryId = keyof typeof MARTIALS;
export type PotionId = 'rejuvenation' | 'berserk';

/** 2026-11-17 属性改版：力量 / 敏捷 / 智力 + 统御，单项最多 10、每级 1 点，武将主属性（数值见 data/attributes.ts）。 */
/** 从 from 级升到 to 级途中到达的「加点等级」数。 */
export function attributePointsBetween(from: number, to: number): number { return Math.max(0, attributePointsAt(to) - attributePointsAt(from)); }
/** 当前等级再升几级可获得下一个属性点（1 或 2）。 */
export function levelsToNextAttributePoint(level: number): number { const p = attributePointsAt(level); let n = 1; while (attributePointsAt(level + n) <= p && n < 8) n++; return n; }
/** 武将经验表（2026-11-17 取消局内等级，只留武将等级；见 data/heroLevels.ts）：从 level 升到 level+1 所需经验。 */
export function xpToNext(level: number): number { return heroXpToNext(level); }
/** 属性图标（智力暂借「属性点」图标、统御暂借「虎符」图标，没有专属图）。 */
export function attributeIcon(id: AttributeId): string { return ATTRIBUTE_INFO[id].icon; }

/** Per-battle growth. It is intentionally not part of the permanent save model. */
export class RunGrowth {
  readonly build=new BuildState();
  revivalUsed=false;
  awakenRescueUsed=false;
  readonly attributes: Record<AttributeId, number> = { strength: 0, agility: 0, intellect: 0, command: 0 };
  readonly masteries: Record<MasteryId, number> = { dragon_gallop: 0, cloud_pierce: 0, dragon_charge:0, dragging_blade:0, steady_aim:0, pearl_volley:0, wildfire:0, eight_trigrams:0, kaishan:0, gujun:0, fulei:0, lianying:0, huishen:0, baibi:0, nichang:0, meirenji:0, jingxin:0, laoji:0, wanrendi:0, dahe:0, jinma:0, tieqi:0, taoyuan:0, xiemin:0 };
  /** 信物库新信物（CharmEffects）：本局加到 player.stats 上的量、铁壁套装生命、传奇信物档位、回生玉佩无敌时长。 */
  charmDelta?: CharmStatDelta;
  charmHp = 0;
  charmLegend: CharmLegends = {};
  revivalMs = 1000;
  unallocated = 0;
  /** unallocated 里属于武将永久属性点的部分（加点时写回 HeroProgress）；其余是本局额外点（如城池加成）。 */
  heroFree = 0;
  /** 兵装加成（局外道具，开局按武将读入，见 ItemEffects.gearFor）。 */
  gear: GearStats = emptyGear();
  /** 生命低于 35%（由 Player.update 每帧更新），供名器「背水 / 踏风」判断。 */
  lowHp = false;
  /** 赌命「背嵬」（本关）：生命低于一半时伤害 ×(1 + stageDesperate)。 */
  stageDesperate = 0;
  private xpCarry = 0;
  /** 名器「饮血」下次可触发的时刻。 */
  killHealAt = 0;
  /** W3 大城特产（洛阳）：本命武器伤害加成，开局由 applyCitySpecialties 设置。 */
  permanentDamage = 0;
  berserkUntil = 0;
  /** 武将谱：本命淬炼给的本命伤害加成（开局读入）。 */
  temperDamage = 0;
  /** 武将谱：战法心得（局内出现概率 ×2），xindeFirst = 开局第一次升级保证出一张。 */
  xinde: TacticId[] = []; xindeFirst = false;
  /** 遗珍「乌巢酒葫」豪饮结束时刻（战斗时钟）。 */
  wineUntil = 0;
  stationarySeconds = 0;
  travel = 0;
  slashCount = 0;
  shotCount = 0;
  flagCount = 0;
  formationReadyAt = 0;
  recordMovement(distance: number, dt: number): void {
    if(this.masteries.dragging_blade) this.travel=Math.min(DRAG_TRAVEL[0],this.travel+Math.max(0,distance));
    this.stationarySeconds=distance>.5?Math.max(0,this.stationarySeconds-dt*2):Math.min(5,this.stationarySeconds+dt);
  }
  aimCriticalBonus(): number { return this.masteries.steady_aim ? this.stationarySeconds*(.02+.01*this.masteries.steady_aim) : 0; }
  masteryLabel(): string { return (Object.keys(MARTIALS) as MasteryId[]).filter(id=>this.owns(id)).map(id=>`${MARTIALS[id].name} Lv.${this.masteries[id]}`).join(' · '); }

  constructor(readonly character: CharacterId) {}

  /** 属性生效点数：主属性每点按 PRIMARY_MUL 倍计算。 */
  pts(id: AttributeId): number { return this.attributes[id] * (primaryAttribute(this.character) === id ? PRIMARY_MUL : 1); }
  /** 主属性专精档位（0–3）：主属性满 4 / 7 / 10 点各一档。 */
  primaryTier(): number { const p = primaryAttribute(this.character); return p ? PRIMARY_TIERS.filter(n => this.attributes[p] >= n).length : 0; }
  /** 是否已解锁某属性的第 tier 档专精（只看主属性）。 */
  perk(id: AttributeId, tier: number): boolean { return primaryAttribute(this.character) === id && this.primaryTier() >= tier; }
  /** 敏捷「疾影」：暴击后攻速提升的截止时刻；力量「破阵」：武器命中计数。 */
  hasteUntil = -Infinity; crushCount = 0;
  /** 猛将觉醒「横扫千军」：狂斗截止时刻与攻速加成（SchoolSynergy 设）。 */
  frenzyUntil = -Infinity; frenzyHaste = 0;
  /** 本局单项上限（attributeCap(武将等级)，开局 / 升级时由 GameScene 写入）。 */
  attrMax = 10;
  get hasAttributeRoom(): boolean { return Object.values(this.attributes).reduce((n,level)=>n+this.attrMax-level,0)>this.unallocated; }
  get weaponMasteryLevel(): number { return this.masteries.dragon_gallop; }
  get spearPierceLevel(): number { return this.masteries.cloud_pierce; }
  /** 张飞同用长枪，与赵云共用两项枪术专精。 */
  owns(id: MasteryId): boolean { const c = MARTIALS[id].character as string; return c === this.character; } // 2026-11-16 起每位武将只用自己的专属武学
  /**
   * 2026-11-19 永久成长分章开放（wave-progression-redesign.md §4.5）：武艺第六章起可精熟到 Lv4、第十章起 Lv5。
   * 精熟不改武艺本身（各武器按 1–3 级查表），每层另给全伤害 +4%；层数记在 masteryExtra，随征程构筑保存。
   * extraCap 由战斗场景按章节设。
   */
  static extraCap = 0;
  static extraCapFor(chapter: number): number { return chapter >= 10 ? 2 : chapter >= 6 ? 1 : 0; }
  masteryExtra: Partial<Record<MasteryId, number>> = {};
  masteryRank(id: MasteryId): number { return this.masteries[id] + (this.masteryExtra[id] ?? 0); }
  canLearn(id: MasteryId): boolean { return this.owns(id) && (this.masteries[id] < 3 || (this.masteryExtra[id] ?? 0) < RunGrowth.extraCap); }

  addAttributePoints(amount = 2): void { this.unallocated = Math.min(Object.values(this.attributes).reduce((n,level)=>n+this.attrMax-level,0),this.unallocated+Math.max(0, Math.floor(amount))); }

  allocate(player: Player, id: AttributeId): boolean {
    if (this.unallocated <= 0 || this.attributes[id] >= this.attrMax) return false;
    const oldMax = player.maxHp;
    this.attributes[id] += 1;
    this.unallocated -= 1;
    if (id === 'strength') player.heal(player.maxHp - oldMax);
    return true;
  }

  learn(id: MasteryId): boolean {
    if (!this.canLearn(id)) return false;
    if (this.masteries[id] < 3) this.masteries[id] += 1; else this.masteryExtra[id] = (this.masteryExtra[id] ?? 0) + 1;
    return true;
  }

  usePotion(id: PotionId, player: Player, now: number): void {
    if (id === 'rejuvenation') player.heal(Math.round(player.maxHp * 0.3));
    else this.berserkUntil = Math.max(this.berserkUntil, now) + 10000;
  }

  damageMultiplier(now: number): number {
    const might = (1 + ATTRIBUTE_EFFECT.strength.damage * this.pts('strength')) * (1 + this.primaryBonus());
    const mastered = 1 + .04 * Object.values(this.masteryExtra).reduce((n: number, v) => n + (v ?? 0), 0); // 武艺精熟
    const fury = mastered * (this.lowHp && this.gear.specials.includes('fury') ? 1.25 : 1) * (this.lowHp && this.stageDesperate ? 1 + this.stageDesperate : 1);
    const wine = now < this.wineUntil && this.gear.specials.includes('jiuhu') ? 1.4 : 1; // 遗珍「乌巢酒葫」（BossRelics.RELIC.jiuhuDamage）
    return Math.min(2, might * (now < this.berserkUntil ? 1.25 : 1) * (1 + this.permanentDamage) * (1 + this.gear.damage) * (1 + this.temperDamage)) * fury * wine;
  }

  attackSpeedMultiplier(now: number): number {
    const quickness = 1 + ATTRIBUTE_EFFECT.agility.attackSpeed * this.pts('agility');
    const haste = this.perk('agility', 3) && now < this.hasteUntil ? 1 + PRIMARY_PERK.agility.haste : 1, focus = this.perk('intellect', 1) ? 1 / (1 - PRIMARY_PERK.intellect.cooldown) : 1;
    return Math.min(1.8, quickness * (now < this.berserkUntil ? 1.2 : 1) * (1 + this.gear.attackSpeed) * haste * focus) * (now < this.frenzyUntil ? 1 + this.frenzyHaste : 1);
  }

  movementMultiplier(): number {
    const windrider = this.lowHp && this.gear.specials.includes('windrider') ? 1.2 : 1;
    return Math.min(1.45, (1 + [0,.03,.05,.07][this.build.level('swift')]) * (1 + ATTRIBUTE_EFFECT.agility.move * this.pts('agility')) * (1 + this.gear.move) * (this.perk('agility', 1) ? 1 + PRIMARY_PERK.agility.move : 1)) * windrider;
  }

  criticalBonus(): number { return Math.min(0.1, ATTRIBUTE_EFFECT.agility.crit * this.pts('agility')) + this.gear.crit + (this.perk('agility', 2) ? PRIMARY_PERK.agility.crit : 0); }
  bonusMaxHp(): number { return Math.round(BALANCE.player.maxHp * (ATTRIBUTE_EFFECT.strength.hp * this.pts('strength') + this.gear.hp + this.charmHp)); }
  incomingDamageMultiplier(): number { return (this.gear.specials.includes('weixi') ? 1.15 : 1)*Math.max(.6, 1 - this.gear.reduce)*this.commandSelfGuard(); }
  /** 刘备：统御每点本人受伤 −1%（2026-11-18 平衡审查，data/heroMechanics.ts LB_COMMAND）；其他武将为 1。 */
  commandSelfGuard(): number { return this.character === 'liubei' ? 1 - LB_COMMAND.selfGuardPerPoint * Math.min(LB_COMMAND.maxPoints, this.attributes.command) : 1; }
  allyDamageMultiplier(): number { return (this.build.tier('formation')>=2?1+SCHOOL_TIER.formation.allyDmg:1)*(1 + this.gear.ally)*(1 + ATTRIBUTE_EFFECT.command.allyDamage * this.pts('command')) * (this.perk('command', 1) ? 1 + PRIMARY_PERK.command.allyDamage : 1); }
  /** 主属性：每点额外全伤害 +1%（最多 10 点）。 */
  primaryBonus(): number { const p = primaryAttribute(this.character); return p ? Math.min(PRIMARY_BONUS.maxPoints, this.attributes[p]) * PRIMARY_BONUS.perPoint : 0; }
  /** 智力：非普攻伤害（技艺、灼烧、遗珍等）倍率，含主属性加成。 */
  /** 智力：法术武器的武器命中 × (1 + 法术系数 × 智力)。主属性加成已在 damageMultiplier 里，这里不再乘。 */
  spellWeaponMultiplier(id: string | undefined): number { return id && SPELL_WEAPONS.has(id) ? 1 + ATTRIBUTE_EFFECT.intellect.skill * this.pts('intellect') : 1; }
  skillDamageMultiplier(): number { return (1 + ATTRIBUTE_EFFECT.intellect.skill * this.pts('intellect')) * (1 + this.primaryBonus()); }
  /** 智力：范围倍率（经 CharacterPassives.rangeMultiplier 作用到武器）。 */
  areaMultiplier(): number { return (1 + ATTRIBUTE_EFFECT.intellect.area * this.pts('intellect')) * (this.perk('intellect', 3) ? 1 + PRIMARY_PERK.intellect.area : 1); }
  /** 敏捷「游刃」：受伤时闪避的几率。 */
  dodgeChance(): number { return this.perk('agility', 2) ? PRIMARY_PERK.agility.dodge : 0; }
  /** 智力「连珠」：法术伤害翻倍的倍率（掷骰）。 */
  spellEcho(): number { return this.perk('intellect', 2) && Math.random() < PRIMARY_PERK.intellect.echoChance ? 2 : 1; }
  /** 统御「募众」：每次免费招兵多给的人数。 */
  freeRecruitBonus(): number { return this.perk('command', 2) ? PRIMARY_PERK.command.freeRecruit : 0; }
  /** 统御「同袍」：随从救起所需时间倍率与救起生命比例（null = 用默认）。 */
  followerRevive(): { secMul: number; hp: number } | null { return this.perk('command', 3) ? { secMul: 1 - PRIMARY_PERK.command.reviveFaster, hp: PRIMARY_PERK.command.reviveHp } : null; }
  /** 统御：部曲生命倍率。 */
  allyHpMultiplier(): number { return 1 + ATTRIBUTE_EFFECT.command.allyHp * this.pts('command'); }
  /** 兵装「对精锐 / 首领伤害」与名器「斩将」：只作用于武将本人的命中。 */
  gearHitMultiplier(kind: string): number { return (this.perk('strength', 3) && (kind === 'boss' || kind === 'elite') ? 1 + PRIMARY_PERK.strength.eliteMul : 1) * (kind === 'boss' ? 1 + this.gear.elite + this.gear.boss : kind === 'elite' ? 1 + this.gear.elite : 1); }
  /** 兵装「经验获取」× 来源倍率（主线 1.0、其余 0.5）：小数部分累计，不丢失。 */
  scaleXp(value: number, rate = 1): number { const v = value * (1 + this.gear.xp) * rate + this.xpCarry, n = Math.floor(v); this.xpCarry = v - n; return n; }
  spearLengthMultiplier(): number { return 1 + 0.1 * this.masteries.cloud_pierce; }
  spearTargetBonus(): number { return this.masteries.cloud_pierce; }
}
