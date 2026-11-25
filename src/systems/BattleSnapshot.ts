import { battleOwnerActive, battlePageOwner, registerBattlePage } from './BattlePageOwner';
import { withGauntletLock } from './GauntletSaveLock';
import { PROGRESS_KEYS, activeSlot, recoverSlotTransfer } from './SaveSlots';
import { pageRetired, writerKey } from './SlotLocalView';

export const BATTLE_SNAPSHOT_KEY = 'im_battle_snapshot';
export const BOOT_TO_KEY = 'im_boot_to';
export class CampaignOccupied extends Error {
  constructor(){super('该存档已有战役进行中');}
}
interface Snapshot {owner?:string;slot:number;at:number;label:string;keys:Record<string,string|null>}
function read():Snapshot|null {
  const raw=localStorage.getItem(BATTLE_SNAPSHOT_KEY);
  if(!raw)return null;
  const data=JSON.parse(raw) as Snapshot;
  if(!data.keys || typeof data.keys!=='object' || !Number.isInteger(data.slot))throw new Error('战役快照无法恢复');
  return data;
}
function writer(slot:number){return localStorage.getItem(writerKey(slot));}
function wakeSettlement(){
  void import('./GauntletSettlement').then(m=>m.recoverGauntletSettlement())
    .catch(error=>console.warn('连战战报待入账',error));
}
function restore(s:Snapshot) {
  // A partially restored image stays in storage until all its writes succeed.
  // Legacy clients could switch slots with an abandoned snapshot. As before, never
  // copy that other slot's rollback image into the newly active wallet.
  if(s.slot===activeSlot())for(const key of PROGRESS_KEYS){
    if(key==='im_story_seen_v1' || !Object.hasOwn(s.keys,key))continue;
    const value=s.keys[key];
    if(value==null)localStorage.removeItem(key);else localStorage.setItem(key,value);
  }
  localStorage.removeItem(BATTLE_SNAPSHOT_KEY);
}
function ownsSnapshot(snapshot:Snapshot|null):boolean {
  const owner=writer(activeSlot())??snapshot?.owner;
  return !pageRetired() && (!owner || owner===battlePageOwner) && (!snapshot?.owner || snapshot.owner===battlePageOwner);
}
export function beginBattle(label:string):void {
  const slot=activeSlot(),existing=read();
  if(!ownsSnapshot(existing))throw new CampaignOccupied();
  const keys:Record<string,string|null>={};
  for(const key of PROGRESS_KEYS)keys[key]=localStorage.getItem(key);
  localStorage.setItem(writerKey(slot),battlePageOwner);
  localStorage.setItem(BATTLE_SNAPSHOT_KEY,JSON.stringify({owner:battlePageOwner,slot,at:Date.now(),label,keys} satisfies Snapshot));
}

// Never wait for a page's lifetime lock while holding the short wallet transaction.
// A dead owner is recovered only if both the owner and the snapshot are unchanged.
async function checkpoint(label?:string,stillNeeded=()=>true):Promise<void>{
  await registerBattlePage();
  const slot=activeSlot();
  for(;;){
    const probe=await withGauntletLock(()=>{
      if(!stillNeeded())return null;
      if(pageRetired() || activeSlot()!==slot)throw new Error('存档页面已变更，请重新载入');
      recoverSlotTransfer();
      const saved=read(),holder=writer(slot),other=holder??saved?.owner;
      if(!holder&&!saved || other===battlePageOwner){
        if(label && !saved)beginBattle(label);
        return null;
      }
      return {holder,raw:localStorage.getItem(BATTLE_SNAPSHOT_KEY),owner:other};
    });
    if(!probe)return;
    if(await battleOwnerActive(probe.owner)){
      if(label)throw new CampaignOccupied();
      return;
    }
    await withGauntletLock(()=>{
      if(!stillNeeded() || pageRetired() || slot!==activeSlot())return;
      if(writer(slot)!==probe.holder || localStorage.getItem(BATTLE_SNAPSHOT_KEY)!==probe.raw)return;
      const abandoned=read();
      if(abandoned)restore(abandoned);
      localStorage.removeItem(writerKey(slot));
      wakeSettlement();
    });
  }
}
export const openBattleCheckpoint=(label:string,stillNeeded=()=>true)=>checkpoint(label,stillNeeded);
export const recoverAbandonedCampaign=()=>checkpoint();

export function commitBattle(keepWriter=false):void {
  if(!ownsSnapshot(read()))return;
  localStorage.removeItem(BATTLE_SNAPSHOT_KEY);
  if(!keepWriter)localStorage.removeItem(writerKey(activeSlot()));
  wakeSettlement();
}
export function rollbackBattle():boolean {
  const saved=read();
  if(!ownsSnapshot(saved))return false;
  if(saved)restore(saved);
  localStorage.removeItem(writerKey(activeSlot()));
  wakeSettlement();
  return !!saved && saved.slot===activeSlot();
}
export function releaseCampWriter(continuing=false):void {
  if(pageRetired() || writer(activeSlot())!==battlePageOwner)return;
  // Deliberate in-game scene changes previously retained their story/reward writes.
  // The retreat action already restored its snapshot; browser crashes recover at boot.
  commitBattle(continuing);
}
export function campaignUsesSave(slot:number):boolean {
  if(slot!==activeSlot())return false;
  const snapshot=read();
  return !!snapshot && snapshot.slot===slot && snapshot.label!=='GauntletGameScene';
}
export function battleInProgress():string|null {return read()?.label??null;}
