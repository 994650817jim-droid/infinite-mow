import Phaser from 'phaser';
import {HEADING_FONT} from '../config';
/** Original bronze command plaque; no font-dependent icon glyphs. */
export function homeCommand(scene:Phaser.Scene,x:number,y:number,width:number,height:number,label:string,primary=false){
 const g=scene.add.graphics();const hit=scene.add.rectangle(x,y,width,height,0,0.001).setInteractive({useHandCursor:true});
 const caption=scene.add.text(x+11,y,label,{fontFamily:HEADING_FONT,fontSize:(primary?23:17)+'px',fontStyle:'bold',color:primary?'#f2dfb3':'#dfcba5',resolution:2,stroke:'#21150e',strokeThickness:1}).setOrigin(.5);
 const paint=(state='normal')=>{
  const hover=state==='hover',pressed=state==='pressed',off=pressed?1:0,l=x-width/2,t=y-height/2+off,r=l+width,b=t+height,cy=y+off;
  const edge=hover?0xd7b77b:0x9e7c48,ink=primary?0x40251c:0x26231b;
  g.clear();
  // Recessed bottom edge, iron backing and weathered bronze rim.
  g.fillStyle(0x100d09,.65).fillRect(l+7,b-2,width-14,5);
  const shape=(inset:number)=>g.beginPath().moveTo(l+10+inset,t+inset).lineTo(r-10-inset,t+inset).lineTo(r-inset,t+10+inset).lineTo(r-inset,b-10-inset).lineTo(r-10-inset,b-inset).lineTo(l+10+inset,b-inset).lineTo(l+inset,b-10-inset).lineTo(l+inset,t+10+inset).closePath();
  g.fillStyle(pressed?0x292018:hover?0x4b3526:ink,.94).lineStyle(2,edge,1);shape(0).fillPath().strokePath();
  g.lineStyle(1,0xc4a36b,.55);shape(4).strokePath();
  g.lineStyle(1,0x0c0c09,.85);shape(7).strokePath();
  // Small angular leiwen corner ornaments, deliberately restrained.
  for(const side of[-1,1]){
   const xx=side<0?l+11:r-11;
   g.lineStyle(1,edge,.85).beginPath().moveTo(xx,cy-11).lineTo(xx+side*8,cy-11).lineTo(xx+side*8,cy-4).lineTo(xx+side*3,cy-4).lineTo(xx+side*3,cy-7).strokePath();
   g.beginPath().moveTo(xx,cy+11).lineTo(xx+side*8,cy+11).lineTo(xx+side*8,cy+4).lineTo(xx+side*3,cy+4).lineTo(xx+side*3,cy+7).strokePath();
  }
  const ix=l+35;
  g.fillStyle(primary?0x642e22:0x343d32,.95).fillRect(ix-11,cy-13,22,26).lineStyle(1,0xa88a55,.8).strokeRect(ix-11,cy-13,22,26);
  if(primary){
   // Crossed halberds on a cinnabar command seal.
   g.lineStyle(1,0xe2c68a,1).lineBetween(ix-6,cy+8,ix+6,cy-8).lineBetween(ix+6,cy+8,ix-6,cy-8);
   g.fillStyle(0xe2c68a).fillTriangle(ix+3,cy-9,ix+8,cy-11,ix+7,cy-5).fillTriangle(ix-3,cy-9,ix-8,cy-11,ix-7,cy-5);
  }else{
   // Split tiger tally, a military token rather than a generic page icon.
   g.fillStyle(0xc5a56a).beginPath().moveTo(ix-8,cy-5).lineTo(ix-5,cy-8).lineTo(ix-2,cy-5).lineTo(ix+5,cy-5).lineTo(ix+8,cy).lineTo(ix+7,cy+6).lineTo(ix+3,cy+6).lineTo(ix+3,cy+2).lineTo(ix-3,cy+2).lineTo(ix-3,cy+7).lineTo(ix-7,cy+7).closePath().fillPath();
   g.lineStyle(1,0x32291a).lineBetween(ix,cy-4,ix,cy+2);
  }
  g.lineStyle(1,0xb49359,.4).lineBetween(ix+18,cy-11,ix+18,cy+11);
  caption.setY(y+off).setColor(hover?'#fff0cc':primary?'#f2dfb3':'#dfcba5');
 };
 paint();hit.on('pointerover',()=>paint('hover')).on('pointerout',()=>paint()).on('pointerdown',()=>paint('pressed')).on('pointerup',()=>paint('hover'));
 return{g,hit,caption,paint};
}
