import {BuildState} from '../data/builds';
import { BALANCE } from '../config';
import type { CharacterId } from '../data/characters';
import type { Player } from '../entities/Player';

export type AttributeId = 'might' | 'quickness' | 'critical' | 'constitution' | 'agility';
export type ZhaoMasteryId = 'dragon_gallop' | 'cloud_pierce';
export const MARTIALS = {
  dragon_gallop: {character:'zhaoyun',name:'龙胆连刺',desc:'每级连刺效率 +8%'},
  cloud_pierce: {character:'zhaoyun',name:'游龙穿云',desc:'每级枪长 +10%、穿透 +1'},
  dragon_charge: {character:'guanyu',name:'青龙蓄势',desc:'四次基础挥砍后重斩 140%/165%/190%；三级击退'},
  dragging_blade: {character:'guanyu',name:'拖刀斩',desc:'移动约5/4/3个身位蓄刀气；三级回旋'},
  steady_aim: {character:'huangzhong',name:'百步穿杨',desc:'静止最多5秒，每秒暴击 +3/4/5%；移动衰减'},
  pearl_volley: {character:'huangzhong',name:'连珠齐射',desc:'每 5/4/3 次基础射击追加70%伤害箭'},
  wildfire: {character:'zhuge',name:'烽火燎原',desc:'爆发留火 1/1.8/2.5秒，每0.5秒20%伤害'},
  eight_trigrams: {character:'zhuge',name:'八阵困军',desc:'每三次施法聚敌、减速后引爆；间隔10秒'},
} as const;
export type MasteryId = keyof typeof MARTIALS;
export type PotionId = 'rejuvenation' | 'berserk';
export type TrinketId = 'tiger_tally' | 'heart_mirror' | 'wind_boots';

export const ATTRIBUTE_MAX = 5;
export const TRINKET_SLOTS = 2;
export const ATTRIBUTE_INFO: Record<AttributeId, { name: string; effect: string }> = {
  might: { name: '武力', effect: '本命武器伤害 +5% / 点' },
  quickness: { name: '迅捷', effect: '攻击速度 +4% / 点' },
  critical: { name: '会心', effect: '暴击率 +2% / 点' },
  constitution: { name: '体魄', effect: '基础生命上限 +10% / 点' },
  agility: { name: '身法', effect: '移动速度 +3% / 点' },
};

/** Per-battle growth. It is intentionally not part of the permanent save model. */
export class RunGrowth {
  readonly build=new BuildState();
  revivalUsed=false;
  awakenRescueUsed=false;
  readonly attributes: Record<AttributeId, number> = { might: 0, quickness: 0, critical: 0, constitution: 0, agility: 0 };
  readonly masteries: Record<MasteryId, number> = { dragon_gallop: 0, cloud_pierce: 0, dragon_charge:0, dragging_blade:0, steady_aim:0, pearl_volley:0, wildfire:0, eight_trigrams:0 };
  readonly trinkets: TrinketId[] = [];
  unallocated = 0;
  /** W3 大城特产（洛阳）：本命武器伤害加成，开局由 applyCitySpecialties 设置。 */
  permanentDamage = 0;
  berserkUntil = 0;
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
  owns(id: MasteryId): boolean { const c = MARTIALS[id].character as string; return c === this.character || this.character === 'zhangfei' && c === 'zhaoyun' || this.character === 'huangyueying' && c === 'huangzhong' || this.character === 'pangtong' && c === 'zhuge' || this.character === 'liubei' && c === 'guanyu' || this.character === 'weiyan' && c === 'guanyu' || this.character === 'machao' && c === 'zhaoyun'; }
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
    const might = 1 + 0.05 * this.attributes.might;
    return Math.min(2, might * (now < this.berserkUntil ? 1.25 : 1) * (1 + this.permanentDamage));
  }

  attackSpeedMultiplier(now: number): number {
    const quickness = 1 + 0.04 * this.attributes.quickness;
    return Math.min(1.8, quickness * (now < this.berserkUntil ? 1.2 : 1));
  }

  movementMultiplier(): number {
    return Math.min(1.45, (1 + [0,.03,.05,.07][this.build.level('swift')]) * (1 + 0.03 * this.attributes.agility) * (this.trinkets.includes('wind_boots') ? 1.1 : 1));
  }

  criticalBonus(): number { return Math.min(0.1, 0.02 * this.attributes.critical); }
  bonusMaxHp(): number { return Math.round(BALANCE.player.maxHp * 0.1 * this.attributes.constitution); }
  incomingDamageMultiplier(): number { return (this.trinkets.includes('heart_mirror') ? 0.85 : 1)*(this.build.tags().bulwark>=2?.95:1); }
  allyDamageMultiplier(): number { return (this.trinkets.includes('tiger_tally') ? 1.2 : 1)*(this.build.tags().command>=2?1.05:1); }
  spearLengthMultiplier(): number { return 1 + 0.1 * this.masteries.cloud_pierce; }
  spearTargetBonus(): number { return this.masteries.cloud_pierce; }
}
