import { rollbackBattle } from './BattleSnapshot';
import { recoverSlotTransfer } from './SaveSlots';

/**
 * 启动时：上次有一场没打完就关了页面 / 刷新 / 崩溃（快照还在）→ 先把存档回滚到那场进关前，再让各存档模块读档。
 * main.ts 里紧跟平台层（platform/desktop 换存储）之后 import，保证在任何模块缓存存档之前执行。
 */
// Browsers with all storage disabled can still run an ephemeral game.
let storageReadable = false;
try { localStorage.getItem('im_slot_transfer'); storageReadable = true; } catch { /* ephemeral session */ }
if (storageReadable) {
  try { recoverSlotTransfer(); } catch (error) {
    const message='存档切换恢复失败。请释放存储空间并重新载入，保留存档数据以便重试。';
    if(typeof document!=='undefined') document.body.textContent=message;
    throw error;
  }
}
export const rolledBackOnBoot = rollbackBattle();
