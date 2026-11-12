import Phaser from 'phaser';
import { DEPTH } from '../config';
/** Bounded cosmetic sprite pool, driven by the caller's frozen combat clock. */
export class ArtEffects {
  private readonly slots: Array<{image:Phaser.GameObjects.Image;until:number;start:number;size:number}> = [];
  constructor(private readonly scene:Phaser.Scene) {}
  show(frame:number,x:number,y:number,size:number,now:number,duration=180,angle=0):void {
    if(!this.scene.textures.exists('art_fx')||!this.scene.cameras.main.worldView.contains(x,y))return;
    let slot=this.slots.find(s=>s.until<=now);
    if(!slot&&this.slots.length<16){slot={image:this.scene.add.image(0,0,'art_fx','0').setDepth(DEPTH.fx),until:0,start:0,size:0};this.slots.push(slot);}
    if(!slot)return;
    slot.start=now;slot.until=now+duration;slot.size=size;
    slot.image.setTexture('art_fx',String(frame)).setPosition(x,y).setRotation(angle).setDisplaySize(size,size).setAlpha(.72).setVisible(true);
  }
  update(now:number):void {for(const s of this.slots){if(now>=s.until){s.image.setVisible(false);continue;}const t=(now-s.start)/(s.until-s.start);s.image.setAlpha(.72*(1-t)).setDisplaySize(s.size*(.85+t*.15),s.size*(.85+t*.15));}}
  clear():void{for(const s of this.slots){s.until=0;s.image.setVisible(false);}}
}
