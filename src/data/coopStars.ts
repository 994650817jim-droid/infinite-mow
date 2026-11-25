// Existing solo effects that the cooperative combat model can resolve in full.
export const FIELD_STARS = [
  {id:'strength.NR1',name:'铁骨',detail:'最大生命 +8%，受到伤害 −5%'},
  {id:'strength.NR2',name:'背水',detail:'生命低于 40% 时，攻击伤害 +15%'},
  {id:'bridge0.h',name:'骁锐',detail:'武器伤害 +6%，攻速 +6%'},
] as const;
export const FIELD_STAR_EFFECT = {
  'strength.NR1': {hp:.08,taken:.05},
  'strength.NR2': {below:.4,damage:.15},
  'bridge0.h': {weapon:.06,attackSpeed:.06},
} as const;

/** Rules return unrounded contributions. Each host retains its existing final rounding and stat buckets. */
export const ironHpBonus=(owned:boolean):number=>owned ? FIELD_STAR_EFFECT['strength.NR1'].hp : 0;
export const ironIncoming=(owned:boolean):number=>owned ? 1-FIELD_STAR_EFFECT['strength.NR1'].taken : 1;
export const backwaterActive=(ratio:number):boolean=>ratio<FIELD_STAR_EFFECT['strength.NR2'].below;
export const backwaterDamage=(owned:boolean,ratio:number):number=>owned && backwaterActive(ratio) ? 1+FIELD_STAR_EFFECT['strength.NR2'].damage : 1;
export const vanguardDamage=(owned:boolean,weaponHit:boolean):number=>owned && weaponHit ? 1+FIELD_STAR_EFFECT['bridge0.h'].weapon : 1;
export const vanguardSpeed=(owned:boolean):number=>owned ? 1+FIELD_STAR_EFFECT['bridge0.h'].attackSpeed : 1;

export const MARK_STAR={id:'intellect.NX1',name:'牵印',detail:'本命法术留下两枚印记，命中可向附近另一枚传导10%伤害'} as const;
