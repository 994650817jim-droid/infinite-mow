import type Phaser from 'phaser';
import type { WeaponHost } from '../weapons/registry';

interface Field {x:number;y:number;r:number;damage:number;end:number;next:number;level:number;formation:boolean;gfx:Phaser.GameObjects.Graphics;}
/** Bounded, combat-clock fields. No timers survive a restart; burn cooldowns use spawn IDs. */
export class MartialFields {
  private fields:Field[]=[];
  private burns=new Map<number,number>();
  constructor(private host:WeaponHost) {}
  add(x:number,y:number,r:number,damage:number,duration:number,level:number,formation=false):void {
    if(this.fields.length>=6) this.fields.shift()!.gfx.destroy();
    const gfx=this.host.add.graphics().setDepth(19);
    gfx.fillStyle(formation?0x356c62:0xb05b24,.13).fillCircle(x,y,r);
    gfx.lineStyle(2,formation?0xb6c57c:0xe4a64e,.7).strokeCircle(x,y,r);
    if(formation)for(let i=0;i<8;i++){const a=i*Math.PI/4;gfx.lineBetween(x+Math.cos(a)*r*.8,y+Math.sin(a)*r*.8,x+Math.cos(a)*r,y+Math.sin(a)*r);}
    this.fields.push({x,y,r,damage,end:this.host.combatNow+duration,next:this.host.combatNow+500,level,formation,gfx});
  }
  update(dt:number):void {
    const h=this.host,now=h.combatNow;
    for(const [id,until] of this.burns)if(until<=now)this.burns.delete(id);
    for(let i=this.fields.length-1;i>=0;i--){const f=this.fields[i];
      if(!f.formation){f.gfx.clear().fillStyle(0xb05b24,.13).fillCircle(f.x,f.y,f.r).lineStyle(2,0xe4a64e,.6).strokeCircle(f.x,f.y,f.r);for(let n=0;n<9;n++){const a=n*2.4,d=f.r*(.25+(n%3)*.22),x=f.x+Math.cos(a)*d,y=f.y+Math.sin(a)*d;f.gfx.fillStyle(n%2?0xe59538:0xc5682c,.75).fillTriangle(x-3,y+3,x+3,y+3,x,y-6-3*Math.sin(now/180+n));}}
      const candidates=h.grid.query(f.x,f.y,f.r+40).filter(e=>e.active&&!e.isSupplySlot&&Math.hypot(e.x-f.x,e.y-f.y)<=f.r+e.radius);
      if(f.formation&&now<f.end)for(const e of candidates){if(e.kind==='boss'||e.controlImmune)continue;const elite=e.kind==='elite'?.4:1;e.martialSlow=Math.min(now>=e.martialSlowUntil?1:e.martialSlow,1-[.35,.45,.5][f.level-1]*elite);e.martialSlowUntil=now+100;
        if(f.level>=2){const d=Math.hypot(f.x-e.x,f.y-e.y)||1;const step=Math.min(d,18*elite*dt);e.sprite.x+=(f.x-e.x)/d*step;e.sprite.y+=(f.y-e.y)/d*step;}}
      if(!f.formation&&now>=f.next&&now<=f.end&&f.next<=f.end){f.next=now+500;for(const e of candidates)if((this.burns.get(e.spawnId)??0)<=now){this.burns.set(e.spawnId,now+500);h.hitEnemy(e,f.damage*.2,now,'fire');}}
      if(now>=f.end){f.gfx.destroy();this.fields.splice(i,1);if(f.formation){h.spawnFlameFx(f.x,f.y,f.r);for(const e of candidates)h.hitEnemy(e,f.damage*.8,now,'fire');if(f.level===3){h.spawnFlameFx(f.x,f.y,f.r*1.2);for(const e of h.grid.query(f.x,f.y,f.r*1.2+40))if(e.active&&!e.isSupplySlot&&Math.hypot(e.x-f.x,e.y-f.y)<=f.r*1.2+e.radius)h.hitEnemy(e,f.damage*.45,now,'fire');}}}
    }
  }
}
