import { battlePageOwner } from './BattlePageOwner';
import { withGauntletLock } from './GauntletSaveLock';
import { PROGRESS_KEYS, activeSlot } from './SaveSlots';

/**
 * 中途退出不算（用户 2026-11-17：「中途退出游戏，然后重新进入，那中途退出那一场打的资源等级都不算，重新计算」）。
 * 进关时把当前存档位的全部进度键（PROGRESS_KEYS：天下 / 武将等级经验 / 行囊兵装遗珍信物 / 名将收录 / 心得 / 战役进度 / 招兵…）
 * 原样存一份「进行中战斗」快照；关卡告捷（进行营 / 战报）或战败（沿用现行规则）时丢掉快照，本场的写入就此生效。
 * 其余离开方式都算中途退出：暂停里「返回选将」→ 立刻回滚并重载；关页面 / 刷新 / 崩溃 → 下次启动时先回滚（BattleSnapshotBoot）。
 * 战斗中照旧随时写存档（升级、拾取等），回滚时整份换回快照，所以不用逐处改成延迟写入。成就（im_achievements）是全局统计，不在快照里，不回滚。
 */
export const BATTLE_SNAPSHOT_KEY = 'im_battle_snapshot';
interface Snapshot { owner?:string; slot: number; at: number; label: string; keys: Record<string, string | null> }

function read(): Snapshot | null {
  try { const v = JSON.parse(localStorage.getItem(BATTLE_SNAPSHOT_KEY) ?? 'null'); return v && typeof v === 'object' && v.keys && typeof v.keys === 'object' ? v as Snapshot : null; } catch { return null; }
}
/** 进关：记下当前存档（总是覆盖：上一份快照要么已结算丢掉，要么是没进成关的残留，不能拿它当回滚点）。 */
export function beginBattle(label: string): void {
  const keys: Record<string, string | null> = {};
  try { for (const k of PROGRESS_KEYS) keys[k] = localStorage.getItem(k); localStorage.setItem(BATTLE_SNAPSHOT_KEY, JSON.stringify({ owner:battlePageOwner, slot: activeSlot(), at: Date.now(), label, keys } satisfies Snapshot)); } catch { /* 存储不可用：不做回滚保护 */ }
}
/** 告捷 / 战败结算：本场写入生效，丢掉快照。 */
export function openBattleCheckpoint(label:string,stillNeeded=()=>true):Promise<void> {
  return withGauntletLock(()=>{if(stillNeeded())beginBattle(label);});
}
function releaseCheckpoint():void {
  localStorage.removeItem(BATTLE_SNAPSHOT_KEY);
  // Queues live outside the campaign rollback image. A reload can retry this wakeup.
  void import('./GauntletSettlement').then(m=>m.recoverGauntletSettlement())
    .catch(error=>console.warn('连战战报待入账',error));
}
export function commitBattle(): void { try { releaseCheckpoint(); } catch { /* retry at next boot */ } }
export function campaignUsesSave(slot:number):boolean {
  const snapshot=read();
  return !!snapshot && snapshot.slot===slot && snapshot.label!=='GauntletGameScene';
}
export function battleInProgress(): string | null { return read()?.label ?? null; }
/** 中途退出：把存档换回进关时的样子并丢掉快照；返回是否真的回滚了（调用方随后应重载，丢掉各存档模块的内存缓存）。 */
/** 中途撤退回滚后要重载页面：撤退前写入 sessionStorage，启动（BootScene）读到后直接进这个场景（一次性）。 */
export const BOOT_TO_KEY = 'im_boot_to';
export function rollbackBattle(): boolean {
  const s = read(); if (!s) return false;
  try {
    // 剧情「已看过」不回滚（关前军情重打不再播）；剧情旗标 im_story_v1 照常回滚
    if (s.slot === activeSlot()) for (const k of PROGRESS_KEYS) { if (k === 'im_story_seen_v1' || !Object.prototype.hasOwnProperty.call(s.keys, k)) continue; /* 旧快照没有新增的进度键时保留原值 */ const v = s.keys[k]; if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    releaseCheckpoint();
  } catch { return false; }
  return s.slot === activeSlot();
}
