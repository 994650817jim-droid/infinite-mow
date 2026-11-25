import { GAUNTLET, gauntletReward } from '../data/gauntlet';
import { creditGauntletGrain } from '../world/WorldStore';
import { creditGauntletScrolls } from './MasteryStore';
import { activeSlot } from './SaveSlots';
import { withGauntletLock } from './GauntletSaveLock';
import { updateModeBest, type Best, type ModeKey } from './GauntletHistory';

export const CLAIM_KEY = 'im_gauntlet_claim_v1';
const LEDGER = 'im_gauntlet_paid_v2';
export const PENDING_PREFIX = 'im_gauntlet_pending:';
type Payment = { provisions:number; scrolls:number };
interface Intent { id:string; kills:number; cleared:boolean; mode?:ModeKey; score?:Best }
interface Claim extends Intent { first:boolean; paid?:Payment }
type Receipt = Payment & {first:boolean; record?:boolean; best?:Best};
function validate(intent: Intent) {
  if (!intent || !intent.id?.startsWith('gauntlet:') || !Number.isSafeInteger(intent.kills) || intent.kills<0)
    throw new Error('名将战报凭据异常');
}
const prefix = (slot:number) => PENDING_PREFIX+slot+':';
function pendingKeys(slot:number) {
  const keys:string[] = [];
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k?.startsWith(prefix(slot))) keys.push(k);}
  return keys;
}
export function hasPendingSettlement(): boolean {
  return !!localStorage.getItem(CLAIM_KEY) || pendingKeys(activeSlot()).length>0;
}
function archive(claim:Claim, ledger:Record<string,Receipt>) {
  validate(claim);
  if(!ledger[claim.id]) {
    let paid=claim.paid;
    if(!paid) {
      const reward=gauntletReward(claim.kills,claim.first);
      const provisions=creditGauntletGrain(claim.id,reward.provisions);
      const scrolls=creditGauntletScrolls(claim.id,reward.scrolls);
      if(claim.first)localStorage.setItem(GAUNTLET.firstClearKey,'1');
      paid={provisions,scrolls};
      localStorage.setItem(CLAIM_KEY,JSON.stringify({...claim,paid}));
    }
    const score=claim.mode && claim.score ? updateModeBest(claim.mode,claim.score,false) : {};
    ledger[claim.id]={...paid,first:claim.first,...score};
    localStorage.setItem(LEDGER,JSON.stringify(ledger));
  }
  localStorage.removeItem(CLAIM_KEY);
}
function drain(slot:number, requested?:string) {
  if(slot!==activeSlot())throw new Error('等待战报所属存档位重新打开');
  const ledger:Record<string,Receipt>=JSON.parse(localStorage.getItem(LEDGER)??'{}');
  const journal=localStorage.getItem(CLAIM_KEY);
  if(journal)archive(JSON.parse(journal),ledger);
  for(const key of pendingKeys(slot)) {
    const raw=localStorage.getItem(key);
    if(!raw)continue;
    const intent:Intent=JSON.parse(raw);
    validate(intent);
    if(key!==prefix(slot)+intent.id)throw new Error('战报编号不符');
    if(!ledger[intent.id]) {
      const claim={...intent,first:intent.cleared && localStorage.getItem(GAUNTLET.firstClearKey)!=='1'};
      localStorage.setItem(CLAIM_KEY,JSON.stringify(claim));
      archive(claim,ledger);
    }
    localStorage.removeItem(key);
  }
  return requested ? ledger[requested] : undefined;
}
export async function recoverGauntletSettlement() {
  const slot=activeSlot();
  if(hasPendingSettlement())await withGauntletLock(()=>drain(slot));
}
export async function settleGauntlet(id:string,kills:number,cleared:boolean,mode?:ModeKey,score?:Best,slot=activeSlot()):Promise<Receipt> {
  const intent={id,kills,cleared,mode,score};
  validate(intent);
  // Unique per run: closing this tab while another tab holds the lock cannot discard its request.
  localStorage.setItem(prefix(slot)+id,JSON.stringify(intent));
  const paid=await withGauntletLock(()=>drain(slot,id));
  if(!paid)throw new Error('未找到本局战报凭据');
  return paid;
}
