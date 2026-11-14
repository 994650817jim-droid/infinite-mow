import type {Player} from '../entities/Player';import type {Legion} from './Legion';import {TACTICS,TREASURES,tacticDescription,type TacticId,type TreasureId} from '../data/builds';import type {UpgradeOption} from '../types';
export interface CampOffer{id:TacticId|TreasureId;kind:'tactic'|'treasure';level:number;price:number;sold:boolean;}
export function campOption(offer:CampOffer,player:Player):UpgradeOption|null{
 const b=player.growth.build;
 if(offer.kind==='tactic'){const id=offer.id as TacticId;if(!b.canLearn(id)||b.level(id)!==offer.level)return null;return{id:'camp_'+id,name:TACTICS[id].name+' · Lv.'+offer.level+'→'+(offer.level+1),desc:tacticDescription(id,offer.level+1),kind:'tactic',icon:'build_icon_'+id,apply:()=>{b.learn(id);}};}
 const id=offer.id as TreasureId;if(b.treasures.includes(id))return null;const old=b.treasures[0],legacy=player.growth.trinkets[0],full=b.treasures.length+player.growth.trinkets.length>=2;
 return{id:'camp_'+id,name:TREASURES[id].name,desc:TREASURES[id].desc+(full?'\n替换：'+(old?TREASURES[old].name:legacy==='tiger_tally'?'虎符':legacy==='heart_mirror'?'护心镜':'疾风靴'):''),kind:'treasure',icon:'build_icon_'+id,apply:()=>{if(b.treasures.includes(id))return;if(b.treasures.length+player.growth.trinkets.length>=2){if(old)b.treasures.splice(b.treasures.indexOf(old),1);else if(legacy)player.growth.trinkets.splice(player.growth.trinkets.indexOf(legacy),1);else return;}b.treasures.push(id);}};
}
/** Inventory is generated once per actual camp visit, not every tab open. */
export class CampMarket{
 readonly offers:CampOffer[]=[];
 constructor(player:Player){const b=player.growth.build,pool:CampOffer[]=[];for(const id of Object.keys(TACTICS)as TacticId[])if(b.canLearn(id))pool.push({id,kind:'tactic',level:b.level(id),price:45+b.level(id)*15,sold:false});for(const id of Object.keys(TREASURES)as TreasureId[])if(!b.treasures.includes(id))pool.push({id,kind:'treasure',level:0,price:90,sold:false});while(pool.length&&this.offers.length<3){const i=Math.floor(Math.random()*pool.length);this.offers.push(pool.splice(i,1)[0]);}}
 buy(index:number,player:Player,army:Legion):boolean{const o=this.offers[index];if(!o||o.sold||army.food<o.price)return false;const option=campOption(o,player);if(!option)return false;option.apply(player,player.weapons,player.growth);army.food-=o.price;o.sold=true;return true;}
}
