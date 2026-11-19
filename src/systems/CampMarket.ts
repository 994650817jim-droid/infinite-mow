import type {Player} from '../entities/Player';import type {Legion} from './Legion';import {TACTICS,tacticDescription,tacticSchool,type TacticId} from '../data/builds';import {SCHOOL_IDS,SCHOOLS,MERCHANT_SCHOOL,TIER_STEPS,type SchoolId} from '../data/schools';import type {UpgradeOption} from '../types';import {MERCHANT_TACTIC} from '../data/items';
/** 军需商人的战法卷轴（2026-11-18 用户「军需商人也可能会卖功法」）：level = 买时已学等级（0 = 新学）。 */
export interface TacticOffer{id:TacticId;kind:'tactic';level:number;price:number;sold:boolean;}
/** 「流派心法」（2026-11-19 流派重做第 4 期）：研读后本次征程该派 +1 势（每派一次）。 */
export interface ManualOffer{id:'manual';kind:'manual';school:SchoolId;level:0;price:number;sold:boolean;}
export type CampOffer=TacticOffer|ManualOffer;
/** 心法卡 / 选项的说明（研读前的势 → 研读后，跨档写出解锁什么）。 */
export function manualText(school:SchoolId,shi?:number):{title:string;effect:string;full:string}{
 const d=SCHOOLS[school],n=shi??-99,step=TIER_STEPS.find(t=>n<t&&n+1>=t);
 const effect='本次征程'+d.name+'势 +1'+(step?'，解锁【'+d.tiers[step].name+'】。':'。');
 return{title:d.name+'心法',effect,full:effect+'\n'+(shi===undefined?'':'现在 '+d.name+' 势 '+shi+' → '+(shi+1)+'；')+'每派只能研读一次，换章重新开始。\n'+d.name+'：'+d.fantasy+'。'};
}
export function campOption(offer:CampOffer,player:Player):UpgradeOption|null{
 const b=player.growth.build;
 if(offer.kind==='manual'){const sc=offer.school;if(!b.canManual(sc))return null;const m=manualText(sc,b.tags()[sc]);
  return{id:'camp_manual_'+sc,name:m.title,desc:m.full,kind:'tactic',icon:'build_icon_school_'+sc,apply:()=>{if(b.canManual(sc))b.manuals.push(sc);}};}
 const id=offer.id;if(!b.canLearn(id)||b.level(id)!==offer.level)return null;
 return{id:'camp_'+id,name:TACTICS[id].name+' · Lv.'+offer.level+'→'+(offer.level+1),desc:tacticDescription(id,offer.level+1),kind:'tactic',icon:'build_icon_'+id,apply:()=>{b.learn(id);}};
}
interface TacticBook{canLearn(id:TacticId):boolean;level(id:TacticId):number;/** 研读过的心法（没有 = 都没研读）。 */manualsRead?():readonly SchoolId[];}
/** 势（按已学战法等级 + 心法；营寨里读出的征程构筑没有亲和等加成）。 */
function bookShi(build:TacticBook):Record<SchoolId,number>{
 const shi=Object.fromEntries(SCHOOL_IDS.map(sc=>[sc,0]))as Record<SchoolId,number>;for(const t of Object.keys(TACTICS)as TacticId[]){const sc=tacticSchool(t);if(sc)shi[sc]+=build.level(t);}
 for(const sc of build.manualsRead?.()??[])shi[sc]++;return shi;
}
/**
 * 每次进营判定一次：按 MERCHANT_TACTIC.chance 捎来 1 卷战法。规则同升级三选一：最多 6 种、每种到 3 级；
 * 已学未满 3 级的作为「精进」出现，已满的不出；战法格已满 6 种时只从已学的里出。一卷也出不了就不摆。
 * 第 4 期：势最高那派到 MERCHANT_SCHOOL.manualMinShi 势、还没研读过时，有 manualChance 的机会换成那派的「流派心法」。
 */
export function rollMerchantTactic(build:TacticBook,rng:()=>number=Math.random,chance:number=MERCHANT_TACTIC.chance):CampOffer|null{
 if(!(rng()<chance))return null;
 const shi=bookShi(build),order=[...SCHOOL_IDS].sort((a,b)=>shi[b]-shi[a]),best=order[0],read=build.manualsRead?.()??[];
 if(shi[best]>=MERCHANT_SCHOOL.manualMinShi&&!read.includes(best)&&rng()<MERCHANT_SCHOOL.manualChance)return{id:'manual',kind:'manual',school:best,level:0,price:MERCHANT_SCHOOL.manualPrice,sold:false};
 const pool=(Object.keys(TACTICS)as TacticId[]).filter(id=>build.canLearn(id));if(!pool.length)return null;
 // 流派重做：优先出势最高的两派（权重 ×MERCHANT_SCHOOL.topWeight）
 const top=new Set(order.filter(sc=>shi[sc]>0).slice(0,2));
 const weights=pool.map(t=>{const sc=tacticSchool(t);return sc&&top.has(sc)?MERCHANT_SCHOOL.topWeight:1;}),total=weights.reduce((a,b)=>a+b,0);
 let r=rng()*total,k=0;while(k<pool.length-1&&(r-=weights[k])>0)k++;
 const id=pool[k],level=build.level(id);
 return{id,kind:'tactic',level,price:MERCHANT_TACTIC.price[Math.max(0,Math.min(MERCHANT_TACTIC.price.length-1,level))],sold:false};
}
/** 买下：扣随军粮，立即学会 / 升一级 / 研读心法（本局构筑，当场生效）。粮不够、已售、或等级已变（中途升级学了同一种）返回 false。 */
export function buyMerchantTactic(offer:CampOffer,player:Player,army:Legion):boolean{
 if(offer.sold||army.food<offer.price)return false;const option=campOption(offer,player);if(!option)return false;
 option.apply(player,player.weapons,player.growth);army.food-=offer.price;offer.sold=true;return true;
}
