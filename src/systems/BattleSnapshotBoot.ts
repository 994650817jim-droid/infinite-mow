import { recoverAbandonedCampaign } from './BattleSnapshot';
export async function recoverBeforeBoot():Promise<void> {
  try { localStorage.getItem('im_battle_snapshot'); } catch { return; }
  await recoverAbandonedCampaign();
}
