import Phaser from 'phaser';
import type{Enemy}from'../entities/Enemy';
import{TELEGRAPH_CLASSIC,laneCracks,windupFlash}from'../ui/Telegraph';
export interface SpearWindup{spawn:number;due:number;x:number;y:number;angle:number;}
export const THIRD_SPEAR={windupMs:450,cooldown:1.6,length:120,width:36,maxWarnings:10}as const;
/** One reusable graphic, locked ground cues, no per-enemy timers or display objects. */
export class ThirdSpearWarnings{
 private gfx:Phaser.GameObjects.Graphics;private nearest:Enemy[]=[];
 constructor(scene:Phaser.Scene){this.gfx=scene.add.graphics().setDepth(22);}
 draw(enemies:readonly Enemy[],pending:WeakMap<Enemy,SpearWindup>,now:number,player:{x:number;y:number},visible:boolean){
  this.gfx.clear();this.nearest.length=0;
  for(const e of enemies){const p=pending.get(e);if(!p)continue;if(!e.active||e.spawnId!==p.spawn||e.stunUntil>now){pending.delete(e);continue;}if(!visible||now>=p.due||Math.hypot(e.x-player.x,e.y-player.y)>600)continue;
   if(this.nearest.length<THIRD_SPEAR.maxWarnings)this.nearest.push(e);else{let far=0;for(let i=1;i<this.nearest.length;i++)if((this.nearest[i].x-player.x)**2+(this.nearest[i].y-player.y)**2>(this.nearest[far].x-player.x)**2+(this.nearest[far].y-player.y)**2)far=i;if((e.x-player.x)**2+(e.y-player.y)**2<(this.nearest[far].x-player.x)**2+(this.nearest[far].y-player.y)**2)this.nearest[far]=e;}
  }
  for(const e of this.nearest){const p=pending.get(e)!;const c=Math.cos(p.angle),s=Math.sin(p.angle),w=THIRD_SPEAR.width/2,l=THIRD_SPEAR.length,progress=Math.max(0,Math.min(1,1-(p.due-now)/THIRD_SPEAR.windupMs)),g=this.gfx;
   // 低调预警（默认）：枪尖前方一道淡地裂纹 + 持枪兵身上闪光，不画填色长条与箭头（?telegraph=1 恢复）
   if(!TELEGRAPH_CLASSIC){laneCracks(g,p.x,p.y,p.angle,l,THIRD_SPEAR.width,progress);windupFlash(e,now);continue;}
   g.lineStyle(1,0xe6b877,.9).fillStyle(0xad603a,.10+progress*.10).beginPath().moveTo(p.x-s*w,p.y+c*w).lineTo(p.x+c*l-s*w,p.y+s*l+c*w).lineTo(p.x+c*l+s*w,p.y+s*l-c*w).lineTo(p.x+s*w,p.y-c*w).closePath().fillPath().strokePath();
   const tx=p.x+c*l,ty=p.y+s*l;g.lineStyle(2,0xf1d6a1,.85).lineBetween(tx-c*13-s*7,ty-s*13+c*7,tx,ty).lineBetween(tx,ty,tx-c*13+s*7,ty-s*13-c*7);
  }
 }
 clear(){this.gfx.destroy();}
}
