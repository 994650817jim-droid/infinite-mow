export const EMBER={id:'ember',name:'火种',chance:[.2,.3,.4],ratio:.1,period:500,duration:3000,cap:160} as const;
export const CINDERS={id:'intellect.NR1',name:'余烬',dot:.2,extraMs:1000,detail:'灼烧伤害 +20%，持续时间 +1秒'} as const;
export const burnBonus=(owned:boolean)=>({mul:owned?1+CINDERS.dot:1,extraMs:owned?CINDERS.extraMs:0});
export const ignites=(level:number,roll:()=>number)=>level>=1 && level<=3 && roll()<EMBER.chance[level-1];
interface Burn {until:number;next:number;damage:number;spread:boolean}
/** Refresh duration and retain the stronger hit. Refreshes never restart the periodic clock. */
export function renewBurn(previous:Burn|undefined,damage:number,now:number,duration:number,secondary:boolean):Burn{
  return {until:Math.max(previous?.until??0,now+duration),next:previous?.next??now+EMBER.period,
    damage:Math.max(previous?.damage??0,damage),spread:previous?previous.spread&&secondary:secondary};
}
