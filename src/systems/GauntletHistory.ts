import { withGauntletLock } from './GauntletSaveLock';
import { activeSlot } from './SaveSlots';

export type ModeKey = `${'solo' | 'coop'}-${'standard' | 'extreme'}${'' | '-endless'}`;
export interface Best { kills: number; wave: number; ms: number }
type Modes = Partial<Record<ModeKey, Best>>;
export const MODES_KEY = 'im_gauntlet_modes_v1';
const blank = (): Best => ({ kills: 0, wave: 0, ms: 0 });
export function modeKey(coop: boolean, size: number, endless: boolean): ModeKey {
  return `${coop?'coop':'solo'}-${size===10?'extreme':'standard'}${endless?'-endless':''}`;
}
// Endless can start at any gate. Keep elapsed time for the entire run, but rank only
// generals actually defeated after entering endless on this route.
export function scoreRun(kills:number,wave:number,ms:number,size:number,milestones:number,endless:boolean): Best {
  const prior=endless ? 10+Math.max(0,milestones-1)*size : 0;
  return {kills:Math.max(0,kills-prior),wave:Math.max(1,wave-prior),ms};
}
export function modeLabel(key: ModeKey): string {
  return (key.startsWith('coop')?'双人':'单人')+(key.includes('extreme')?'极限':'标准')+(key.endsWith('endless')?' · 无尽':'');
}
const suffix = (test: boolean) => test ? '_test' : '';
export function modeHistory(test = false): Modes & { legacy?: Best } {
  let modes: Modes = {}, old: Best | undefined;
  try { modes = JSON.parse(localStorage.getItem(MODES_KEY+suffix(test)) ?? '{}') ?? {}; } catch { /* still display accessible legacy scores */ }
  try { old = JSON.parse(localStorage.getItem('im_gauntlet_best'+suffix(test)) ?? 'null'); } catch { /* old records had no format marker */ }
  return old && Number.isFinite(old.kills) ? {...modes, legacy:{kills:old.kills,wave:old.wave??old.kills,ms:old.ms??0}} : modes;
}
/** Caller holds the shared save lock: read current values from storage, never a tab cache. */
export function updateModeBest(key: ModeKey, candidate: Best, test: boolean) {
  const storageKey = MODES_KEY+suffix(test);
  const modes: Modes = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
  const previous = modes[key] ?? blank();
  if (![candidate.kills,candidate.wave,candidate.ms].every(n=>Number.isSafeInteger(n) && n>=0))
    throw new Error('战绩数值异常');
  if (modes[key] && candidate.kills <= previous.kills) return { best:previous, record:false };
  modes[key] = candidate;
  localStorage.setItem(storageKey,JSON.stringify(modes));
  return { best:candidate, record:candidate.kills>previous.kills };
}
const recordPrefix = (slot:number) => 'im_gauntlet_score_pending:'+slot+':';
type ScoreRequest = { key:ModeKey; value:Best; test:boolean };

/** A host or guest can close their tab while the other writer holds the save lock. */
export function drainScoreRequests(slot:number) {
  const prefix=recordPrefix(slot), keys:string[]=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k?.startsWith(prefix))keys.push(k);
  }
  for(const k of keys) {
    const raw=localStorage.getItem(k);
    if(raw===null)continue;
    const req:ScoreRequest=JSON.parse(raw);
    updateModeBest(req.key,req.value,req.test);
    localStorage.removeItem(k);
  }
}
export async function saveModeBest(key: ModeKey, value: Best, test = false, slot = activeSlot()) {
  const intent=recordPrefix(slot)+[key,test?1:0,value.kills,value.wave,value.ms].join(':');
  localStorage.setItem(intent,JSON.stringify({key,value,test} satisfies ScoreRequest));
  return withGauntletLock(() => {
    if (activeSlot() !== slot) throw new Error('战报所属存档位已切换');
    const result=updateModeBest(key,value,test);
    localStorage.removeItem(intent);
    return result;
  });
}
