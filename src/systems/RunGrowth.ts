import {retinueStarHp,retinueBossTaken,nearOrderBonus} from '../rules/retinue';
import {ironHpBonus,ironIncoming,backwaterActive,backwaterDamage,vanguardDamage,vanguardSpeed} from '../data/coopStars';
import { statEffective, statSource } from '../data/heroStats';
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
import { STAR_EFFECT, STAR_KEYSTONE, STAR_NEAR_RADIUS, STAR_PYRE, STAR_TUNING, type StarKeystoneId, canLight, heroGate, orderStars, perkLit, starMapOn, starPoints, starsAt, type StarEffectId } from '../data/starMap';
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
  meirenji: {character:'diaochan',name:'美人计',desc:'每级倒戈时间 +0.5 秒' /* 2026-11-21 体检：原写「3 级时 2 层魅惑即可离间」，11-16 起所有人都是 2 层（R.charmNeed），这一条已不生效；3 级换什么另议（hero-balance.patch） */},
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
  // P2 吕布（data/lvbu.ts）
  chitu: {character:'lvbu',name:'赤兔',desc:'无双狂暴时每 3.5/3/2.5 秒朝前冲刺，穿过沿途敌兵造成 60%/80%/100% 伤害'},
  huaji: {character:'lvbu',name:'画戟',desc:'每级横扫范围 +15%'},
  xiandeng: {character:'zhangliao',name:'先登',desc:'每 5/4.5/4 秒先突进到敌前，再连斩 2/2/3 击'},
  weicai: {character:'mengde',name:'唯才是举',desc:'军令易伤每级再 +8%'},
  wangmei: {character:'mengde',name:'望梅止渴',desc:'奸雄回血每级再 +2%'},
  // P3 甘宁（weapons/ganningWeapon.ts）
  lingxiang: {character:'ganning',name:'铃响',desc:'持续移动 0.8 秒后，下一钩与横扫伤害每级 +15%'},
  tiesuo: {character:'ganning',name:'铁索',desc:'每级钩长 +10%'},
  // P3 典韦（weapons/dianweiWeapon.ts）
  tieji: {character:'dianwei',name:'铁戟',desc:'每次多掷短戟（1 / 1 / 2 支）'},
  huwei: {character:'dianwei',name:'护卫',desc:'每级旋风半径 +12%'},
  // P3 孙权（weapons/sunquanWeapon.ts）
  biyan: {character:'sunquan',name:'碧眼',desc:'每级齐射伤害 +15%'},
  ziran: {character:'sunquan',name:'紫髯',desc:'每级刀斩距离 +10%'},
  // P3 孟获（weapons/menghuoWeapon.ts）
  manli: {character:'menghuo',name:'蛮力',desc:'每级重劈距离 +10%'},
  tengjia: {character:'menghuo',name:'藤甲',desc:'每级受伤 −4%'},
  // P3 祝融（weapons/zhurongWeapon.ts）
  huoshen: {character:'zhurong',name:'火神',desc:'每级火伤 +15%'},
  feidao: {character:'zhurong',name:'飞刀',desc:'每级扇形飞刀多 1 把'},
  shenshe: {character:'taishici',name:'神射',desc:'射戟射程每级 +15%'},
  qichi: {character:'taishici',name:'七尺之剑',desc:'双戟伤害每级 +8%'},
  yaliang: {character:'zhouyu',name:'雅量',desc:'英发每级少攒 15%'},
  lianchuan: {character:'zhouyu',name:'连环',desc:'每级火船 +1 艘'},
  weiming: {character:'zhangliao',name:'威名',desc:'震慑 2 层就溃逃；Lv2 / Lv3 溃逃再久 0.5 / 1 秒'},
} as const;
export type MasteryId = keyof typeof MARTIALS;
export type PotionId = 'rejuvenation' | 'berserk';

/** 2026-11-17 属性改版：力量 / 敏捷 / 智力 + 统御，单项最多 10、每级 1 点，武将主属性（数值见 data/attributes.ts）。 */
/** 从 from 级升到 to 级途中到达的「加点等级」数。 */
export function attributePointsBetween(from: number, to: number): number { return starMapOn() ? Math.max(0, starsAt(to) - starsAt(from)) : Math.max(0, attributePointsAt(to) - attributePointsAt(from)); } // 星图开着：每升 1 级 1 颗星
/** 当前等级再升几级可获得下一个属性点（1 或 2）。 */
export function levelsToNextAttributePoint(level: number): number { if (starMapOn()) return 1; const p = attributePointsAt(level); let n = 1; while (attributePointsAt(level + n) <= p && n < 8) n++; return n; }
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
  readonly masteries: Record<MasteryId, number> = { dragon_gallop: 0, cloud_pierce: 0, dragon_charge:0, dragging_blade:0, steady_aim:0, pearl_volley:0, wildfire:0, eight_trigrams:0, kaishan:0, gujun:0, fulei:0, lianying:0, huishen:0, baibi:0, nichang:0, meirenji:0, jingxin:0, laoji:0, wanrendi:0, dahe:0, jinma:0, tieqi:0, taoyuan:0, xiemin:0, chitu:0, huaji:0, xiandeng:0, weiming:0, yaliang:0, lianchuan:0, shenshe:0, qichi:0, weicai:0, wangmei:0, lingxiang:0, tiesuo:0, tieji:0, huwei:0, biyan:0, ziran:0, manli:0, tengjia:0, huoshen:0, feidao:0 };
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
  /** 本命 Lv6 / 7（兵器专职加深）：每级全伤害 +10%（由场景按本命武器 over 写入）。 */
  weaponOver = 0;
  /** 重整构筑（data/respec）：退回后还没重选的强化次数（下一关开打时补选）；respecCh / respecN = 本章用过几次。随征程构筑保存。 */
  respecPending = 0; respecCh = 0; respecN = 0;
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
    this.moving=distance>.5;
    this.stationarySeconds=distance>.5?Math.max(0,this.stationarySeconds-dt*2):Math.min(5,this.stationarySeconds+dt);
  }
  aimCriticalBonus(): number { return this.masteries.steady_aim ? this.stationarySeconds*(.02+.01*this.masteries.steady_aim) : 0; }
  masteryLabel(): string { return (Object.keys(MARTIALS) as MasteryId[]).filter(id=>this.owns(id)).map(id=>`${MARTIALS[id].name} Lv.${this.masteries[id]}`).join(' · '); }

  constructor(readonly character: CharacterId) {}

  /** 属性生效点数：本色折算 + 加点，分段折扣后乘擅长 / 熟练倍率（heroStats.statEffective；与主属性无关）。 */
  pts(id: AttributeId): number { return statEffective(statSource(this.character), id, this.attributes[id], this.heroLevel); }
  /** 当前武将等级（本色自动成长要用；GameScene 开局 / 升级时写入）。 */
  heroLevel = 1;
  /** 主属性专精档位（0–3）：主属性满 4 / 7 / 10 点各一档。 */
  primaryTier(): number { const p = primaryAttribute(this.character); if (p && starMapOn()) return [1, 2, 3].filter(t => perkLit(this.stars, p, t)).length; return p ? PRIMARY_TIERS.filter(n => this.attributes[p] >= n).length : 0; }
  /** 是否已解锁某属性的第 tier 档专精（只看主属性）。星图开着：改查对应要星是否点亮（第 1 / 2 / 3 档 = 该区 NC / NL1 / NL2，任何武将都能跨区拿）。 */
  perk(id: AttributeId, tier: number): boolean { return starMapOn() ? perkLit(this.stars, id, tier) : (primaryAttribute(this.character) === id && this.primaryTier() >= tier) || (this.cardStars && perkLit(this.stars, id, tier)); } // 将星卡：主属性靠加点、其余三区的专精靠卡
  /** 敏捷「疾影」：暴击后攻速提升的截止时刻；力量「破阵」：武器命中计数。 */
  hasteUntil = -Infinity; crushCount = 0;
  /**
   * 星图（data/starMap.ts，开关 starMapOn() 默认关）：本局已点亮的星（不含自己的入口）。开着时四维点数 attributes = 小星汇总（setStars 写入），
   * 专精 perk() 查要星；关着时这个字段没人读。
   */
  stars: string[] = [];
  /**
   * 名将连战的将星卡：星做成局内三选一卡（拿一颗点亮一颗，不走连线 / 点数）。开关关着时也让点亮的星生效——只管效果，
   * 四维点数与加点方式照旧（setStars 不改 attributes、lightStar 不可用）。
   */
  cardStars = false;
  /** 星的效果算不算：星图开着，或本局的星来自将星卡。 */
  get starsLive(): boolean { return starMapOn() || this.cardStars; }
  get starGate(): string { return heroGate(this.character); }
  /** 读入一组已点亮的星（按规则整理过）；星图开着时同时把四维点数改成小星汇总。 */
  setStars(ids: Iterable<string>): void { this.stars = orderStars(ids, this.starGate); if (starMapOn()) Object.assign(this.attributes, starPoints(this.stars, this.starGate)); }
  /** 开局 / 换关：从存档读入已点亮的星；carried = 同章连打，保留上一关在本局里点的（测试战斗不写存档）。 */
  syncStars(saved: readonly string[], carried: boolean): void { this.setStars(carried ? [...saved, ...this.stars] : saved); }
  /** 战斗内点亮一颗星（花 1 个 unallocated）；写存档由调用方做（HeroProgress.lightHeroStar）。 */
  lightStar(player: Player, id: string): boolean {
    if (!starMapOn() || this.unallocated <= 0 || !canLight(this.stars, id, this.starGate)) return false;
    const oldMax = player.maxHp;
    this.setStars([...this.stars, id]); this.unallocated -= 1;
    if (player.maxHp > oldMax) player.heal(player.maxHp - oldMax);
    return true;
  }
  /**
   * 第二期：12 颗新要星（数值在 starMap.STAR_EFFECT）。starOn(id) = 开关开着且这颗星点亮；关着时下面每个量都是「没有效果」的那个值（0 或 1）。
   * moving / hpRatio 由 recordMovement / Player.update 每帧写；spellSurgeUntil = 奇谋的截止时刻。
   */
  starOn(id: StarEffectId): boolean { return this.starsLive && this.stars.includes(id); }
  moving = false; hpRatio = 1; spellSurgeUntil = -Infinity;
  /**
   * 第四期：战斗内反馈的信号（data/starFx.ts）。pulse(id) = 这颗星刚触发了一下（开关关着 / 没点亮时什么都不记）；
   * x / y 是触发点（命中点、击杀点），没有就是主将身上。界面（ui/StarBuffHud）和特效挂点（systems/StarFx）每帧 takePulses() 取走。
   */
  private pulses: Array<{ id: string; x?: number; y?: number }> = [];
  pulse(id: string, x?: number, y?: number): void { if (this.starsLive && this.stars.includes(id) && this.pulses.length < 64) this.pulses.push({ id, x, y }); }
  takePulses(): Array<{ id: string; x?: number; y?: number }> { if (!this.pulses.length) return this.pulses; const p = this.pulses; this.pulses = []; return p; }
  /**
   * 状态式 / 限时式的星现在是否「成立」：背水 = 生命低于 40%；追风 = 移动中；号令 / 身先士卒 = 有部曲在主将身边（alliesNear 由战斗场景给）；
   * 疾影 = 暴击后的攻速加成还在；奇谋 = 暴击后的法术加成还在。其余的星（常驻 / 触发式）返回 null。
   */
  starActive(id: string, now: number, alliesNear: boolean): boolean | null {
    if (!this.starsLive || !this.stars.includes(id)) return null;
    switch (id) {
      case 'strength.NR2': return backwaterActive(this.hpRatio);
      case 'agility.NR2': return this.moving;
      case 'command.NR2': case 'bridge3.h': return alliesNear;
      case 'agility.NL2': return now < this.hasteUntil;
      case 'bridge1.h': return now < this.spellSurgeUntil;
      default: return null;
    }
  }
  /** 受伤时掷闪避（Player.takeDamage）：和原来一样只掷一次骰子；闪掉了给游刃 / 一骑当千发一个触发信号。 */
  rollDodge(): boolean { const hit = Math.random() < this.dodgeChance(); if (hit) { this.pulse('agility.NL1'); this.pulse('agility.K'); } return hit; }
  /** 第三期：4 颗主星（数值在 starMap.STAR_KEYSTONE）。keyOn(id) = 开关开着且这颗主星点亮。 */
  keyOn(id: StarKeystoneId): boolean { return this.starsLive && this.stars.includes(id); }
  /** 万人敌（主将全伤害 +15%）× 三军统帅（主将自身伤害 −25%）：乘在全伤害 ×2 封顶之外。 */
  private keystoneDamage(): number { return (this.keyOn('strength.K') ? 1 + STAR_KEYSTONE['strength.K'].damage : 1) * (this.keyOn('command.K') ? 1 + STAR_KEYSTONE['command.K'].selfDamage : 1); }
  /** 一骑当千：最终生命上限倍率（Player.maxHp 整体乘）。 */
  maxHpMultiplier(): number { return this.keyOn('agility.K') ? 1 + STAR_KEYSTONE['agility.K'].maxHp : 1; }
  /** 火烧连营：这一下击杀能不能爆燃——点亮了、且最近 windowMs 内不到 perSecond 次；能的话记一次。 */
  private pyreAt: number[] = [];
  pyreTake(now: number, x?: number, y?: number): boolean {
    if (!this.keyOn('intellect.K')) return false;
    while (this.pyreAt.length && now - this.pyreAt[0] >= STAR_PYRE.windowMs) this.pyreAt.shift();
    if (this.pyreAt.length >= STAR_PYRE.perSecond) return false;
    this.pyreAt.push(now); this.pulse('intellect.K', x, y); return true;
  }
  /** 铁骨 + 身先士卒：主将生命上限（按基础生命的比例，和力量每点 +3% 加在一起）。 */
  private starHp(): number { return ironHpBonus(this.starOn('strength.NR1')) + (this.starOn('bridge3.h') ? STAR_EFFECT['bridge3.h'].hp : 0); }
  /** 连击：暴击伤害加成（和战法的暴击伤害加成相加）。 */
  critDamageBonus(): number { return this.starOn('agility.NR1') ? STAR_EFFECT['agility.NR1'].critDamage : 0; }
  /** 拾取范围倍率：兵装词条 ×（追风 +20%）。 */
  pickupMultiplier(): number { return (1 + this.gear.pickup) * (this.starOn('agility.NR2') ? 1 + STAR_EFFECT['agility.NR2'].pickup : 1); }
  /** 余烬：灼烧 / 地火等持续伤害倍率与多烧的毫秒数（BuildCombat 的灼烧与地火读这里）。 */
  dotBonus(): { mul: number; extraMs: number } { const E = STAR_EFFECT['intellect.NR1']; return this.starOn('intellect.NR1') ? { mul: 1 + E.dot, extraMs: E.extraMs } : { mul: 1, extraMs: 0 }; }
  /** 妙算：锦囊效果倍率（数值或持续时间 ×1.15，见 GameScene.useJinnang）。 */
  jinnangMultiplier(): number { return this.starOn('intellect.NR2') ? 1 + STAR_EFFECT['intellect.NR2'].jinnang : 1; }
  /** 严阵：部曲受首领伤害倍率。 */
  allyBossTakenMultiplier(): number { return retinueBossTaken(this.starOn('command.NR1')); }
  /** 主将身边（dx, dy = 部曲相对主将的位移）。 */
  private near(dx: number, dy: number): boolean { return dx * dx + dy * dy <= STAR_NEAR_RADIUS * STAR_NEAR_RADIUS; }
  /**
   * 号令：主将身边的部曲再 +12%，进同一个加法桶——全军倍率 allyDamageMultiplier() 里已经乘过 (1 + 桶)，
   * 这里返回身边这名部曲要补乘的系数 (1 + 桶 + 12%) ÷ (1 + 桶)。
   */
  allyNearDamageFactor(dx: number, dy: number): number {
    return nearOrderBonus(this.starOn('command.NR2'),dx,dy,this.allyDamageBucket());
  }
  /** 身先士卒：主将身边的部曲受伤倍率。 */
  allyNearTakenFactor(dx: number, dy: number): number { return this.starOn('bridge3.h') && this.near(dx, dy) ? 1 - STAR_EFFECT['bridge3.h'].nearAllyTaken : 1; }
  /**
   * 主将每次命中的星图倍率（GameScene.hitEnemy，在主属性专精之后乘）：骁锐 = 武器命中 +6%；
   * 奇谋 = 暴击后 3 秒内法术伤害（非武器伤害、法术武器的武器命中）+12%，触发它的那一下暴击本身不吃。
   */
  starHit(time: number, weaponHit: boolean, crit: boolean, spellWeapon: boolean): number {
    if (!this.starsLive) return 1;
    let mul = 1;
    mul *= vanguardDamage(this.starOn('bridge0.h'),weaponHit);
    if (this.starOn('bridge1.h')) {
      if ((!weaponHit || spellWeapon) && time < this.spellSurgeUntil) mul *= 1 + STAR_EFFECT['bridge1.h'].spell;
      if (crit) this.spellSurgeUntil = time + STAR_EFFECT['bridge1.h'].ms;
    }
    return mul;
  }
  /** 力量「破阵」重击倍率（星图开着 ×1.6，平衡评审第 30 节；关着是原值 ×2）。 */
  crushMul(at?: { x: number; y: number }): number { this.pulse('strength.NL1', at?.x, at?.y); return this.starsLive ? STAR_TUNING.crushMul : PRIMARY_PERK.strength.crushMul; } // at = 重击的命中点（给反馈用）
  /** 「破阵」这一下能不能定身：星图开着时每秒最多一次（关着每次重击都定）。返回 true 时记下时刻。 */
  private crushStunAt = -Infinity;
  crushStunReady(time: number): boolean {
    if (!this.starsLive) return true;
    if (time - this.crushStunAt < STAR_TUNING.crushStunCdMs) return false;
    this.crushStunAt = time; return true;
  }
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
    const mastered = (1 + .04 * Object.values(this.masteryExtra).reduce((n: number, v) => n + (v ?? 0), 0)) * (1 + .1 * this.weaponOver); // 武艺精熟、本命 Lv6 / 7
    const fury = mastered * (this.lowHp && this.gear.specials.includes('fury') ? 1.25 : 1) * (this.lowHp && this.stageDesperate ? 1 + this.stageDesperate : 1);
    const stand = backwaterDamage(this.starOn('strength.NR2'),this.hpRatio); // 星图·背水
    const wine = now < this.wineUntil && this.gear.specials.includes('jiuhu') ? 1.4 : 1; // 遗珍「乌巢酒葫」（BossRelics.RELIC.jiuhuDamage）
    return Math.min(2, might * (now < this.berserkUntil ? 1.25 : 1) * (1 + this.permanentDamage) * (1 + this.gear.damage) * (1 + this.temperDamage)) * fury * wine * stand * this.keystoneDamage();
  }

  attackSpeedMultiplier(now: number): number {
    const quickness = 1 + ATTRIBUTE_EFFECT.agility.attackSpeed * this.pts('agility');
    const haste = this.perk('agility', 3) && now < this.hasteUntil ? 1 + PRIMARY_PERK.agility.haste : 1, focus = this.perk('intellect', 1) ? 1 / (1 - PRIMARY_PERK.intellect.cooldown) : 1;
    const star = vanguardSpeed(this.starOn('bridge0.h')) * (this.moving && this.starOn('agility.NR2') ? 1 + STAR_EFFECT['agility.NR2'].moveHaste : 1); // 星图·骁锐 / 追风
    return Math.min(1.8, quickness * (now < this.berserkUntil ? 1.2 : 1) * (1 + this.gear.attackSpeed) * haste * focus * star * (this.keyOn('intellect.K') ? 1 / (1 + STAR_KEYSTONE['intellect.K'].cooldown) : 1)) * (now < this.frenzyUntil ? 1 + this.frenzyHaste : 1);
  }

  movementMultiplier(): number {
    const windrider = this.lowHp && this.gear.specials.includes('windrider') ? 1.2 : 1;
    return Math.min(1.45, (1 + [0,.03,.05,.07][this.build.level('swift')]) * (1 + ATTRIBUTE_EFFECT.agility.move * this.pts('agility')) * (1 + this.gear.move) * (this.perk('agility', 1) ? 1 + PRIMARY_PERK.agility.move : 1)) * windrider;
  }

  criticalBonus(): number { return Math.min(0.1, ATTRIBUTE_EFFECT.agility.crit * this.pts('agility')) + this.gear.crit + (this.perk('agility', 2) ? PRIMARY_PERK.agility.crit : 0) + (this.keyOn('agility.K') ? STAR_KEYSTONE['agility.K'].crit : 0); }
  bonusMaxHp(): number { return Math.round(BALANCE.player.maxHp * (ATTRIBUTE_EFFECT.strength.hp * this.pts('strength') + this.gear.hp + this.charmHp + this.starHp())); }
  incomingDamageMultiplier(): number { return (this.gear.specials.includes('weixi') ? 1.15 : 1)*Math.max(.6, 1 - this.gear.reduce)*this.commandSelfGuard()*ironIncoming(this.starOn('strength.NR1')); }
  /** 刘备：统御每点本人受伤 −1%（2026-11-18 平衡审查，data/heroMechanics.ts LB_COMMAND）；其他武将为 1。 */
  commandSelfGuard(): number { return this.character === 'liubei' ? 1 - LB_COMMAND.selfGuardPerPoint * Math.min(LB_COMMAND.maxPoints, this.attributes.command) : 1; }
  allyDamageMultiplier(): number { return (this.build.tier('formation')>=2?1+SCHOOL_TIER.formation.allyDmg:1)*(1 + this.gear.ally)*(1 + ATTRIBUTE_EFFECT.command.allyDamage * this.pts('command')) * (1 + this.allyDamageBucket()); }
  /**
   * 部曲伤害加法桶（平衡评审第 30 节）：励军等「部曲伤害 +x%」的星互相相加，加完再乘统御点数那一项，不互相相乘。
   * 现在桶里只有励军（+15%，和原来 ×1.15 算出来一样）；第二期的号令 / 三军统帅 / 帷幄往这里加。
   */
  allyDamageBucket(): number { return (this.perk('command', 1) ? PRIMARY_PERK.command.allyDamage : 0) + (this.starOn('bridge2.h') ? STAR_EFFECT['bridge2.h'].allyDamagePerInt * this.pts('intellect') : 0) + (this.keyOn('command.K') ? STAR_KEYSTONE['command.K'].allyDamage : 0) + (this.keyOn('strength.K') ? STAR_KEYSTONE['strength.K'].allyDamage : 0); } // 励军 + 帷幄；号令只给主将身边的（allyNearDamageFactor）
  /** 主属性：每点额外全伤害 +1%（最多 10 点）。 */
  primaryBonus(): number { const p = primaryAttribute(this.character); return p ? Math.min(PRIMARY_BONUS.maxPoints, this.attributes[p]) * PRIMARY_BONUS.perPoint : 0; }
  /** 智力：非普攻伤害（技艺、灼烧、遗珍等）倍率，含主属性加成。 */
  /** 智力：法术武器的武器命中 × (1 + 法术系数 × 智力)。主属性加成已在 damageMultiplier 里，这里不再乘。 */
  spellWeaponMultiplier(id: string | undefined): number { return id && SPELL_WEAPONS.has(id) ? 1 + ATTRIBUTE_EFFECT.intellect.skill * this.pts('intellect') : 1; }
  skillDamageMultiplier(): number { return (1 + ATTRIBUTE_EFFECT.intellect.skill * this.pts('intellect')) * (1 + this.primaryBonus()); }
  /** 智力：范围倍率（经 CharacterPassives.rangeMultiplier 作用到武器）。 */
  areaMultiplier(): number { return (1 + ATTRIBUTE_EFFECT.intellect.area * this.pts('intellect')) * (this.perk('intellect', 3) ? 1 + PRIMARY_PERK.intellect.area : 1); }
  /** 敏捷「游刃」：受伤时闪避的几率。 */
  dodgeChance(): number { const d = this.perk('agility', 2) ? PRIMARY_PERK.agility.dodge : 0; return this.starsLive ? Math.min(STAR_TUNING.dodgeCap, d + (this.keyOn('agility.K') ? STAR_KEYSTONE['agility.K'].dodge : 0)) : d; } // 星图开着：闪避合计封顶 20%
  /** 智力「连珠」：法术伤害翻倍的倍率（掷骰）。 */
  spellEcho(at?: { x: number; y: number }): number { const m = this.perk('intellect', 2) && Math.random() < PRIMARY_PERK.intellect.echoChance ? 2 : 1; if (m > 1) this.pulse('intellect.NL1', at?.x, at?.y); return m; } // at = 翻倍那一下的命中点（给反馈用）
  /** 统御「募众」：每次免费招兵多给的人数。 */
  freeRecruitBonus(): number { return (this.perk('command', 2) ? PRIMARY_PERK.command.freeRecruit : 0) + (this.keyOn('command.K') ? STAR_KEYSTONE['command.K'].freeRecruit : 0); }
  /** 统御「同袍」：随从救起所需时间倍率与救起生命比例（null = 用默认）。 */
  followerRevive(): { secMul: number; hp: number } | null { return this.perk('command', 3) ? { secMul: 1 - PRIMARY_PERK.command.reviveFaster, hp: PRIMARY_PERK.command.reviveHp } : null; }
  /** 统御：部曲生命倍率。 */
  allyHpMultiplier(): number { return (1 + ATTRIBUTE_EFFECT.command.allyHp * this.pts('command')) * retinueStarHp(this.starOn('command.NR1')) * (this.keyOn('command.K') ? 1 + STAR_KEYSTONE['command.K'].allyHp : 1); } // 星图·严阵
  /** 兵装「对精锐 / 首领伤害」与名器「斩将」：只作用于武将本人的命中。 */
  gearHitMultiplier(kind: string): number { return (this.perk('strength', 3) && (kind === 'boss' || kind === 'elite') ? 1 + PRIMARY_PERK.strength.eliteMul : 1) * (kind === 'boss' ? 1 + this.gear.elite + this.gear.boss : kind === 'elite' ? 1 + this.gear.elite : 1) * (kind === 'boss' && this.keyOn('strength.K') ? 1 + STAR_KEYSTONE['strength.K'].boss : 1); }
  /** 兵装「经验获取」× 来源倍率（主线 1.0、其余 0.5）：小数部分累计，不丢失。 */
  scaleXp(value: number, rate = 1): number { const v = value * (1 + this.gear.xp) * rate + this.xpCarry, n = Math.floor(v); this.xpCarry = v - n; return n; }
  spearLengthMultiplier(): number { return 1 + 0.1 * this.masteries.cloud_pierce; }
  spearTargetBonus(): number { return this.masteries.cloud_pierce; }
}
