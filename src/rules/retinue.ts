/** Values used by both single-player Legion and the authoritative network arena. */
export const RETINUE_STARS = {hp:.15,bossTaken:.15,nearDamage:.12,radius:220} as const;
export const retinueStarHp=(owned:boolean)=>owned?1+RETINUE_STARS.hp:1;
export const retinueBossTaken=(owned:boolean)=>owned?1-RETINUE_STARS.bossTaken:1;
export const allyHp=(base:number,level:number,mul=1)=>Math.round(base*(1+.3*(level-1))*mul);
export const allyAttack=(base:number,level:number)=>base*(1+.25*(level-1));
export function nearOrderBonus(owned:boolean,dx:number,dy:number,bucket:number):number {
  return owned && dx*dx+dy*dy<=RETINUE_STARS.radius**2?(1+bucket+RETINUE_STARS.nearDamage)/(1+bucket):1;
}
