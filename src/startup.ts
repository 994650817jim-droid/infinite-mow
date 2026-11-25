// Install the storage adapters in their original order. Import scenes only after recovery finishes.
import './dev/TestSave';
import './platform/desktop';
import { recoverBeforeBoot } from './systems/BattleSnapshotBoot';

async function recoverSave() {
  try { localStorage.getItem('im_battle_snapshot'); } catch { return; }
  (await import('./systems/SaveSlots')).installSlotView();
  await recoverBeforeBoot();
  // Direct battle entry can bypass the menu that normally retries interrupted receipts.
  let pending=false;
  try {
    for(let i=0;i<localStorage.length && !pending;i++){
      const key=localStorage.key(i);
      pending=key==='im_gauntlet_claim_v1' || !!key?.startsWith('im_gauntlet_pending:') || !!key?.startsWith('im_gauntlet_score_pending:');
    }
  } catch { return; }
  if(pending)await import('./systems/GauntletSettlement').then(m=>m.recoverGauntletSettlement());
}

void recoverSave().then(
  () => import('./main'),
  error => {
    document.body.textContent = '存档恢复失败。请检查存储权限和剩余空间，再重新载入。';
    console.error('存档恢复失败',error);
  },
);
