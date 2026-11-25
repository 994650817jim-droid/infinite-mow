import { BATTLE_SNAPSHOT_KEY, rollbackBattle } from './BattleSnapshot';
import { recoverSlotTransfer } from './SaveSlots';
import { battleOwnerActive, registerBattlePage } from './BattlePageOwner';
import { withGauntletLock } from './GauntletSaveLock';

export async function recoverBeforeBoot(): Promise<void> {
  try { localStorage.getItem(BATTLE_SNAPSHOT_KEY); } catch { return; } // ephemeral session
  await registerBattlePage();
  const snapshot = await withGauntletLock(() => {
    recoverSlotTransfer();
    return localStorage.getItem(BATTLE_SNAPSHOT_KEY);
  });
  if (!snapshot) return;
  let owner: unknown;
  try { owner = JSON.parse(snapshot)?.owner; } catch { return; }
  if (await battleOwnerActive(owner)) return;
  // A different battle can start or settle during the ownership check.
  await withGauntletLock(() => {
    recoverSlotTransfer();
    if (localStorage.getItem(BATTLE_SNAPSHOT_KEY) === snapshot) rollbackBattle();
  });
}
