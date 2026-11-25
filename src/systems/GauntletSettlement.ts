import { GAUNTLET, gauntletReward } from '../data/gauntlet';
import { creditGauntletGrain } from '../world/WorldStore';
import { creditGauntletScrolls } from './MasteryStore';

export const CLAIM_KEY='im_gauntlet_claim_v1';
interface Claim {id:string;kills:number;cleared:boolean;first:boolean;paid?:{provisions:number;scrolls:number}}
function current():Claim|null {
  const raw=localStorage.getItem(CLAIM_KEY);
  if(raw===null)return null;
  const claim=JSON.parse(raw) as Claim;
  if(!claim || typeof claim.id!=='string'||!claim.id.startsWith('gauntlet:')||!Number.isSafeInteger(claim.kills)||claim.kills<0)
    throw new Error('名将战报凭据异常');
  return claim;
}
function pay(claim:Claim) {
  if(claim.paid)return claim.paid;
  const reward=gauntletReward(claim.kills,claim.first);
  const provisions=creditGauntletGrain(claim.id,reward.provisions);
  const scrolls=creditGauntletScrolls(claim.id,reward.scrolls);
  if(claim.first)localStorage.setItem(GAUNTLET.firstClearKey,'1');
  claim.paid={provisions,scrolls};
  localStorage.setItem(CLAIM_KEY,JSON.stringify(claim));
  return claim.paid;
}
export function recoverGauntletSettlement():void {
  const claim=current();if(claim&&!claim.paid)pay(claim);
}
export function settleGauntlet(id:string,kills:number,cleared:boolean) {
  const previous=current();
  if(previous?.id===id)return {...pay(previous),first:previous.first};
  if(previous&&!previous.paid)pay(previous);
  const claim:Claim={id,kills,cleared,first:cleared&&localStorage.getItem(GAUNTLET.firstClearKey)!=='1'};
  localStorage.setItem(CLAIM_KEY,JSON.stringify(claim));
  return {...pay(claim),first:claim.first};
}
