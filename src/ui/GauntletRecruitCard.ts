import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TROOPS, type TroopKind } from '../data/legion';
import { fieldButton, fieldLabel, fieldPanel, fieldStyle as S } from './FieldCard';

const portraitKey=(kind:TroopKind)=>'recruit_bust_'+kind;
export function preloadRecruitPortraits(scene:Phaser.Scene, kinds:Iterable<TroopKind>) {
  for(const kind of new Set(kinds)) if(!scene.textures.exists(portraitKey(kind)))
    scene.load.image(portraitKey(kind),'assets/troop-portraits-v2/'+kind+'_portrait.webp');
}

interface Offer { kinds:readonly TroopKind[]; level:number; count:number; price:number; funds:number; army:number }
export function drawRecruitCard(scene: Phaser.Scene, root: Phaser.GameObjects.Container, offer:Offer, enter:boolean, buy:()=>void) {
  const mobile=GAME_WIDTH<600, many=offer.kinds.length>2;
  const w=many?386:mobile?366:338, h=many?114:mobile?98:88;
  const x=(GAME_WIDTH-w)/2, y=GAME_HEIGHT-(mobile?270:132)-h/2;
  const canBuy=offer.funds>=offer.price;
  root.removeAll(true);
  scene.tweens.killTweensOf(root);
  root.setPosition(x,y).setVisible(true).setAlpha(1);
  root.add(fieldPanel(scene,w,h));
  root.add(fieldLabel(scene,32,14,'招募援军',18,S.ivory,true));
  root.add(fieldLabel(scene,117,15,offer.level+' 阶',13,S.metal));
  root.add(fieldLabel(scene,w-S.inset,15,'兵力 '+offer.army,13,S.muted).setOrigin(1,.5));
  const availableW=w-118;
  offer.kinds.forEach((kind,i)=>{
    const cols=many?3:2, cellW=(availableW-S.inset)/cols;
    const left=S.inset+i%cols*cellW, top=32+Math.floor(i/cols)*28;
    const img=scene.add.image(left,top,portraitKey(kind)).setOrigin(0);
    const scale=(mobile && !many ? 34 : 27)/Math.max(img.width,img.height);
    img.setScale(scale);
    root.add([img,fieldLabel(scene,left+(mobile && !many ? 35 : 28),top+(mobile && !many ? 17 : 14),TROOPS[kind].name,many?13:mobile?16:14,S.ivory)]);
  });
  const status=fieldLabel(scene,S.inset,h-12,'随机一类 · '+offer.count+' 人入伍',mobile?15:13,S.muted);
  root.add(status);
  const actionX=w-61, actionY=49;
  fieldButton(scene,root,actionX,actionY,100,42,'招募  '+offer.price+' 钱',canBuy,()=>{
    if(canBuy) buy();
    else {
      status.setText('钱币不足 · 还差 '+(offer.price-offer.funds)+' 钱').setColor(S.error);
      scene.tweens.killTweensOf(status);
      scene.tweens.add({targets:status,alpha:{from:.5,to:1},duration:S.feedbackMs});
    }
  },mobile?64:42).setName('gauntlet-recruit-buy');
  root.add(fieldLabel(scene,actionX,mobile?84:77,'持有 '+offer.funds+' 钱',13,canBuy?S.muted:S.error).setOrigin(.5));
  if(enter) scene.tweens.add({targets:root,y:{from:y+4,to:y},alpha:{from:.25,to:1},duration:S.enterMs,ease:'Sine.Out'});
}
