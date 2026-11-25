import { eventSaveKey } from './SlotLocalView';
import { GAUNTLET, gauntletReward } from '../data/gauntlet';
import { creditGauntletGrain } from '../world/WorldStore';
import { creditGauntletScrolls } from './MasteryStore';
import { BATTLE_SNAPSHOT_KEY, campaignUsesSave } from './BattleSnapshot';
import { activeSlot } from './SaveSlots';
import { withGauntletLock } from './GauntletSaveLock';
import { drainScoreRequests, updateModeBest, type Best, type ModeKey } from './GauntletHistory';

export const CLAIM_KEY = 'im_gauntlet_claim_v1';
const LEDGER = 'im_gauntlet_paid_v2';
export const PENDING_PREFIX = 'im_gauntlet_pending:';
type Payment = { provisions:number; scrolls:number };
interface Intent { id:string; kills:number; cleared:boolean; mode?:ModeKey; score?:Best }
interface Claim extends Intent { first:boolean; paid?:Payment }
type Receipt = Payment & {first:boolean; deferred?:boolean; record?:boolean; best?:Best};
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
export function observeDeferredReward(id:string,slot:number,show:(value:string)=>void) {
  const refresh=()=>{
    if(activeSlot()!==slot)return;
    try {
      const r:Receipt|undefined=JSON.parse(localStorage.getItem(LEDGER)??'{}')[id];
      if(r)show('已入账　钱币 +'+r.provisions+' · 残卷 +'+r.scrolls);
    } catch { /* Keep the durable pending notice when storage is temporarily unavailable. */ }
  };
  function changed(e:StorageEvent) {
    if(eventSaveKey(e.key)===LEDGER)refresh();
    // Retreat reloads the owner page. The open report can finish payment itself.
    if(eventSaveKey(e.key)===BATTLE_SNAPSHOT_KEY && e.newValue===null && activeSlot()===slot)
      void recoverGauntletSettlement().then(refresh).catch(error=>console.warn('连战战报待入账',error));
  }
  window.addEventListener('storage',changed);
  refresh();
  return ()=>window.removeEventListener('storage',changed);
}
function drain(slot:number, requested?:string) {
  if(slot!==activeSlot())throw new Error('等待战报所属存档位重新打开');
  const ledger:Record<string,Receipt>=JSON.parse(localStorage.getItem(LEDGER)??'{}');
  if(campaignUsesSave(slot))return requested ? ledger[requested] ?? {provisions:0,scrolls:0,first:false,deferred:true} : undefined;
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
  await withGauntletLock(()=>{
    if(slot!==activeSlot() || campaignUsesSave(slot))return;
    if(hasPendingSettlement())drain(slot);
    drainScoreRequests(slot);
  });
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
