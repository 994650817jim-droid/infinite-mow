import Phaser from 'phaser';
import { FONT, HEADING_FONT } from '../config';

/** 战场浮卡样板。标题用游戏宋体，数值与按钮用正文体；边线只用于分组。 */
export const fieldStyle = { ink: 0x191714, brown: 0x29231d, brass: 0x98784d,
  ivory: '#f2e6d1', muted: '#c2b49f', metal: '#d8b784', error: '#e0a191',
  inset: 12, gap: 6, enterMs: 150, feedbackMs: 140 } as const;

export function fieldLabel(scene: Phaser.Scene, x: number, y: number, value: string, size: number, color: string, heading = false) {
  return scene.add.text(x, y, value, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2 }).setOrigin(0, .5);
}

export function fieldPanel(scene: Phaser.Scene, w: number, h: number) {
  const g = scene.add.graphics();
  g.fillStyle(fieldStyle.ink,.97).fillRoundedRect(0,0,w,h,3);
  g.fillStyle(fieldStyle.brown,.9).fillRect(0,0,w,27);
  g.lineStyle(1,fieldStyle.brass,.65).lineBetween(0,27,w,27);
  g.fillStyle(0x653d32).fillPoints([{x:12,y:0},{x:25,y:0},{x:25,y:20},{x:18.5,y:16},{x:12,y:20}],true);
  g.lineStyle(1,0xc2a27a,.8).lineBetween(18.5,4,18.5,12);
  return g;
}

export function fieldButton(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number,
  caption: string, available: boolean, press: () => void, touchHeight = h) {
  const plate = scene.add.graphics();
  const label = fieldLabel(scene,x,y,caption,15,available ? fieldStyle.ivory : fieldStyle.muted,true).setOrigin(.5);
  const hit = scene.add.zone(x,y,w,touchHeight).setScrollFactor(0).setInteractive({useHandCursor:available});
  const paint = (state:'idle'|'over'|'down') => {
    plate.clear().fillStyle(available ? ({idle:0x634737,over:0x795942,down:0x503c30})[state] : 0x35312b)
      .fillRoundedRect(x-w/2,y-h/2+3,w,h-6,3);
    plate.lineStyle(1,fieldStyle.brass,available ? .9 : .38).lineBetween(x-w/2+4,y+h/2-4,x+w/2-4,y+h/2-4);
    label.y=y+(state==='down'?1:0);
  };
  paint('idle');
  let armed=false;
  hit.on('pointerover',()=>paint('over')).on('pointerout',()=>{armed=false;paint('idle');})
    .on('pointerdown',()=>{armed=true;paint('down');}).on('pointerup',()=>{paint('idle');if(armed){armed=false;press();}});
  root.add([plate,label,hit]);
  return hit;
}
