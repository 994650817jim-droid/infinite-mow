import type Phaser from 'phaser';
import {GAUNTLET_RECRUIT} from '../data/gauntletRecruit';
export type CompanyRow=[number,number,number,number,number,number,number,number,number];
export interface CompanyStatus {coins:number;men:number;cap:number;order:'guard'|'sortie';deaths:number;receipt:number;cost:number}
const kinds=[...new Set(GAUNTLET_RECRUIT.tiers.flatMap(t=>t.kinds))];
const cell:Record<string,number>={swordsman:136,spearman:136,archer:136,guardian:136,rider:176,halberdier:152};
export function preloadCompany(scene:Phaser.Scene):void{
  for(const kind of kinds)if(!scene.textures.exists('coop_ally_'+kind))
    scene.load.spritesheet('coop_ally_'+kind,'assets/processed-v2/troops/'+kind+'_walk.png',{frameWidth:cell[kind],frameHeight:cell[kind]});
}
interface Pose {body:Phaser.GameObjects.Image;startX:number;startY:number;x:number;y:number;t:number;dir:number;walk:number;moving:boolean;strike:number}
export class CoopRetinueView {
  private poses=new Map<number,Pose>();
  sync(scene:Phaser.Scene,rows:CompanyRow[],now:number):void{
    const alive=new Set<number>();
    for(const [id,owner,kind,x,y,,,dir,strike] of rows){
      alive.add(id);let p=this.poses.get(id);
      if(!p){
        const body=scene.add.image(x,y,'coop_ally_'+kinds[kind],0).setOrigin(.5,.85).setDisplaySize(49,49);
        if(owner===1)body.setTint(0xc3dfef);
        p={body,startX:x,startY:y,x,y,t:now,dir,walk:0,moving:false,strike};this.poses.set(id,p);
      }
      const jump=Math.hypot(x-p.x,y-p.y)>90||now-p.t>550;
      p.moving=!jump&&(p.x!==x||p.y!==y);p.startX=jump?x:p.body.x;p.startY=jump?y:p.body.y;
      p.x=x;p.y=y;p.t=now;p.dir=dir;
      if(p.strike!==strike){p.strike=strike;p.body.setAlpha(.77);}
    }
    for(const [id,p] of this.poses)if(!alive.has(id)){p.body.destroy();this.poses.delete(id);}
  }
  draw(now:number,delta:number):void{
    for(const p of this.poses.values()){
      const t=Math.min(1,Math.max(0,(now-p.t)/100));
      const x=p.startX+(p.x-p.startX)*t,y=p.startY+(p.y-p.startY)*t;
      if(p.moving)p.walk+=Math.min(delta,100)*.009;
      p.body.setPosition(x,y).setDepth(y/10-.1).setFrame(p.dir*4+(p.moving?Math.floor(p.walk)%4:0));
      if(t>=1)p.body.setAlpha(1);
    }
  }
  clear():void{for(const p of this.poses.values())p.body.destroy();this.poses.clear();}
}
