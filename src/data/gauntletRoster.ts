import roster from '../coop/roster.json';
import { ROSTER } from './enemyRoster';
import { canAdd, type MixCounts } from '../systems/RosterMix';

/** 幸存者专用特色兵轮换，不修改战役配兵和第一阵。 */
const WAVES: readonly (readonly string[])[] = roster.waves;
export const GAUNTLET_ROSTER_IDS = [...new Set(WAVES.flat())];
export function gauntletRosterIds(wave:number):readonly string[] {
  const w=Math.max(1,Math.floor(wave));
  return WAVES[w<=10?w-1:7+(w-11)%3];
}
/** 替换普通刷兵名额，不额外加刷；初入每阵12秒给玩家留出辨认空间。 */
export function pickGauntletRoster(wave:number,seconds:number,counts:MixCounts,rnd:()=>number=Math.random):string|null {
  if(seconds<12)return null;
  const ids=gauntletRosterIds(wave).filter(id=>!!ROSTER[id]&&canAdd(id,counts));
  if(!ids.length)return null;
  const roll=rnd();if(roll>=.12)return null;
  return ids[Math.min(ids.length-1,Math.floor(roll/.12*ids.length))];
}
