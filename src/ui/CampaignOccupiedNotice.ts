import { CampaignOccupied } from '../systems/BattleSnapshot';

export function showCampaignNotice(error:unknown):void{
  document.getElementById('campaign-save-notice')?.remove();
  const dialog=document.createElement('dialog');
  dialog.id='campaign-save-notice';
  dialog.style.cssText='color:#efe5d0;background:#28231e;border:1px solid #917459;max-width:min(22rem,85vw);padding:20px 24px;font:16px/1.55 serif';
  const heading=document.createElement('strong'),body=document.createElement('p'),close=document.createElement('button');
  heading.textContent=error instanceof CampaignOccupied?'该存档已有战役进行中':'暂时无法打开战役存档';
  body.textContent=error instanceof CampaignOccupied?'请回到原窗口继续，或从存档菜单选择其他存档。':'请检查存储空间和浏览器权限，再重新出征。';
  close.textContent='返回主菜单';
  close.style.cssText='padding:8px 18px;color:inherit;background:#473a2d;border:1px solid #917459;font:inherit;cursor:pointer';
  close.onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.append(heading,body,close);document.body.append(dialog);dialog.showModal();
}
