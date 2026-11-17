import type {Player} from '../entities/Player';import type {Legion} from './Legion';import {TACTICS,tacticDescription,type TacticId} from '../data/builds';import type {UpgradeOption} from '../types';
/** 旧的行营战法货架（2026-11-17 军需商人改为只卖兵装后已无界面使用；宝物并入信物库后只剩战法）。 */
export interface CampOffer{id:TacticId;kind:'tactic';level:number;price:number;sold:boolean;}
export function campOption(offer:CampOffer,player:Player):UpgradeOption|null{
 const b=player.growth.build,id=offer.id;if(!b.canLearn(id)||b.level(id)!==offer.level)return null;
 return{id:'camp_'+id,name:TACTICS[id].name+' · Lv.'+offer.level+'→'+(offer.level+1),desc:tacticDescription(id,offer.level+1),kind:'tactic',icon:'build_icon_'+id,apply:()=>{b.learn(id);}};
}
/** Inventory is generated once per actual camp visit, not every tab open. */
export class CampMarket{
 readonly offers:CampOffer[]=[];
 constructor(player:Player){const b=player.growth.build,pool:CampOffer[]=[];for(const id of Object.keys(TACTICS)as TacticId[])if(b.canLearn(id))pool.push({id,kind:'tactic',level:b.level(id),price:45+b.level(id)*15,sold:false});while(pool.length&&this.offers.length<4)this.offers.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);}
 buy(index:number,player:Player,army:Legion):boolean{const o=this.offers[index];if(!o||o.sold||army.food<o.price)return false;const option=campOption(o,player);if(!option)return false;option.apply(player,player.weapons,player.growth);army.food-=o.price;o.sold=true;return true;}
}
