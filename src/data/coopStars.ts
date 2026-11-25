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
