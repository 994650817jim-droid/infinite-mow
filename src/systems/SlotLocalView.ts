// Only concurrent slots need a separate key space. The original live slot and its
// transfers retain their existing representation. Archived slots are imported once.
const MARK = 'im_parallel_slot:';
const DATA = 'im_parallel_data:';
const TAB = 'im_parallel_view';
const HOLDER = 'im_campaign_writer:';
const SNAPSHOT = 'im_battle_snapshot';
type View = {raw:Storage; scoped:number|null; retired:boolean; protected:Set<string>};
const page = globalThis as typeof globalThis & {__imSlotLocalView?:View};
const state = () => page.__imSlotLocalView;
export const rawSave = () => state()?.raw ?? localStorage;
export const viewedSlot = () => state()?.scoped ?? null;
export const pageRetired = () => !!state()?.retired;
export const writerKey = (slot:number) => HOLDER+slot;
export const isolatedSlot = (slot:number) => rawSave().getItem(MARK+slot)==='1';
const prefix = (slot:number) => DATA+slot+':';
export function eventSaveKey(key:string|null):string|null {
  if(key===null)return null;
  const slot=viewedSlot();
  if(slot===null)return key;
  if(key.startsWith(prefix(slot)))return key.slice(prefix(slot).length);
  return state()?.protected.has(key)?null:key;
}
export function installSlotStorage(keys:readonly string[]):void {
  if(state())return;
  const raw=window.localStorage;
  const selected=sessionStorage.getItem(TAB);
  const scoped=selected!==null && /^[012]$/.test(selected) && raw.getItem(MARK+selected)==='1'?Number(selected):null;
  const v:View={raw,scoped,retired:false,protected:new Set([...keys,SNAPSHOT])};
  const physical=(key:string)=>scoped!==null && v.protected.has(key)?prefix(scoped)+key:key;
  const check=(key:string)=>{
    if(v.retired && (v.protected.has(key)||key.startsWith(HOLDER)||key.startsWith(DATA)))
      throw new DOMException('战役页面已失效，请重新载入','InvalidStateError');
  };
  const storage:Storage={
    get length(){return raw.length;},
    key(index:number){const k=raw.key(index);return k===null?null:eventSaveKey(k)??k;},
    getItem(key:string){return raw.getItem(physical(key));},
    setItem(key:string,value:string){check(key);raw.setItem(physical(key),value);},
    removeItem(key:string){check(key);raw.removeItem(physical(key));},
    clear(){if(v.retired)throw new Error('存档页面已失效');if(scoped===null)raw.clear();else for(const k of v.protected)raw.removeItem(physical(k));},
  };
  Object.defineProperty(window,'localStorage',{configurable:true,get:()=>storage});
  page.__imSlotLocalView=v;
  window.addEventListener('pagehide',()=>{v.retired=true;},{once:true});
}
export function selectSlotView(slot:number|null):void {
  if(slot===null)sessionStorage.removeItem(TAB);
  else sessionStorage.setItem(TAB,String(slot));
}
export function openIsolatedSlot(slot:number,legacy:Record<string,string>,keys:readonly string[]):void {
  if(isolatedSlot(slot))return;
  const raw=rawSave();
  for(const key of keys){
    if(legacy[key]===undefined)raw.removeItem(prefix(slot)+key);
    else raw.setItem(prefix(slot)+key,legacy[key]);
  }
  raw.setItem(MARK+slot,'1'); // Commit after copying every key; interruption is retryable.
}
export function isolatedData(slot:number,keys:readonly string[]):Record<string,string> {
  const out:Record<string,string>={};
  for(const k of keys){const value=rawSave().getItem(prefix(slot)+k);if(value!==null)out[k]=value;}
  return out;
}
export function clearIsolatedSlot(slot:number,keys:readonly string[]):void {
  // Keep the marker, so a page already open on this slot sees the cleared data.
  for(const k of [...keys,SNAPSHOT])rawSave().removeItem(prefix(slot)+k);
}
