import type {Player} from '../entities/Player';import type {Legion} from './Legion';import {TACTICS,tacticDescription,tacticSchool,type TacticId} from '../data/builds';import {SCHOOL_IDS,MERCHANT_SCHOOL,type SchoolId} from '../data/schools';import type {UpgradeOption} from '../types';import {MERCHANT_TACTIC} from '../data/items';
/** 军需商人的战法卷轴（2026-11-18 用户「军需商人也可能会卖功法」）：level = 买时已学等级（0 = 新学）。 */
export interface CampOffer{id:TacticId;kind:'tactic';level:number;price:number;sold:boolean;}
export function campOption(offer:CampOffer,player:Player):UpgradeOption|null{
 const b=player.growth.build,id=offer.id;if(!b.canLearn(id)||b.level(id)!==offer.level)return null;
 return{id:'camp_'+id,name:TACTICS[id].name+' · Lv.'+offer.level+'→'+(offer.level+1),desc:tacticDescription(id,offer.level+1),kind:'tactic',icon:'build_icon_'+id,apply:()=>{b.learn(id);}};
}
interface TacticBook{canLearn(id:TacticId):boolean;level(id:TacticId):number;}
/**
 * 每次进营判定一次：按 MERCHANT_TACTIC.chance 捎来 1 卷战法。规则同升级三选一：最多 6 种、每种到 3 级；
 * 已学未满 3 级的作为「精进」出现，已满的不出；战法格已满 6 种时只从已学的里出。一卷也出不了就不摆。
 */
export function rollMerchantTactic(build:TacticBook,rng:()=>number=Math.random,chance:number=MERCHANT_TACTIC.chance):CampOffer|null{
 if(!(rng()<chance))return null;
 const pool=(Object.keys(TACTICS)as TacticId[]).filter(id=>build.canLearn(id));if(!pool.length)return null;
 // 流派重做：优先出势最高的两派（权重 ×MERCHANT_SCHOOL.topWeight）；势按已学战法等级算（营寨里读出的征程构筑没有亲和等加成）
 const shi=Object.fromEntries(SCHOOL_IDS.map(sc=>[sc,0]))as Record<SchoolId,number>;for(const t of Object.keys(TACTICS)as TacticId[]){const sc=tacticSchool(t);if(sc)shi[sc]+=build.level(t);}
 const top=new Set([...SCHOOL_IDS].sort((a,b)=>shi[b]-shi[a]).filter(sc=>shi[sc]>0).slice(0,2));
 const weights=pool.map(t=>{const sc=tacticSchool(t);return sc&&top.has(sc)?MERCHANT_SCHOOL.topWeight:1;}),total=weights.reduce((a,b)=>a+b,0);
 let r=rng()*total,k=0;while(k<pool.length-1&&(r-=weights[k])>0)k++;
 const id=pool[k],level=build.level(id);
 return{id,kind:'tactic',level,price:MERCHANT_TACTIC.price[Math.max(0,Math.min(MERCHANT_TACTIC.price.length-1,level))],sold:false};
}
/** 买下：扣随军粮，立即学会 / 升一级（本局构筑，当场生效）。粮不够、已售、或等级已变（中途升级学了同一种）返回 false。 */
export function buyMerchantTactic(offer:CampOffer,player:Player,army:Legion):boolean{
 if(offer.sold||army.food<offer.price)return false;const option=campOption(offer,player);if(!option)return false;
 option.apply(player,player.weapons,player.growth);army.food-=offer.price;offer.sold=true;return true;
}
