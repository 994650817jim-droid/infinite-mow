import {buildVfx} from './BuildVfx';
import {SHOW_RANGE_RINGS} from '../ui/RangeRings';
import {HINT_MOCK} from '../ui/HintStyle';
import Phaser from 'phaser';import type {Player} from '../entities/Player';import type {Ally} from '../entities/Ally';import type {Enemy} from '../entities/Enemy';import type {BuildState} from '../data/builds';
/** One-shot guards and bounded retaliation; all deadlines use the combat clock. */
export class BulwarkBuild {
 private readyAt=0;private counterAt=0;private watchAt=0;private pulseUntil=0;private radius=0;
 private guards=new Map<Ally,{life:number;until:number;multiplier:number}>();
 private pending:Array<{enemy:Enemy;spawn:number;damage:number}>=[];private gfx:Phaser.GameObjects.Graphics;
 constructor(private scene:Phaser.Scene,private state:BuildState,private player:Player,private units:Ally[],private nearby:(x:number,y:number,r:number)=>Enemy[],private deal:(e:Enemy,n:number)=>void){this.gfx=scene.add.graphics().setDepth(42);}
 private has(id:'iron_mirror'|'army_seal'){return this.state.treasures.includes(id);}
 guard(damage:number,now:number):number{
  const n=this.state.level('deflect'),r=this.state.level('rebound'),mirror=this.has('iron_mirror');if((!n&&!r&&!mirror)||now<this.readyAt)return damage;
  buildVfx(this.scene).emit('bulwark',this.player.x,this.player.y-8,now,54,0,300);this.readyAt=now+(n?[8000,7000,6000][n-1]:8000);this.pulseUntil=now+300;this.radius=28;
  if((r||mirror)&&now>=this.counterAt){this.counterAt=now+1500;const pm=this.state.power('iron_mirror'),radius=r?[70,85,100][r-1]:70,ratio=r?[.35,.50,.65][r-1]+(mirror?.25*pm:0):.20*pm;this.radius=radius;buildVfx(this.scene).emit('pure_bulwark',this.player.x,this.player.y-8,now,radius*1.2,0,350);
   this.pending=this.nearby(this.player.x,this.player.y,radius).filter(e=>e.active&&!e.isSupplySlot&&Math.hypot(e.x-this.player.x,e.y-this.player.y)<=radius).slice(0,r?[3,4,5][r-1]:3).map(e=>({enemy:e,spawn:e.spawnId,damage:Math.max(1,damage*ratio)}));
  }
  return Math.max(1,Math.round(damage*(1-(n?[.25,.35,.45][n-1]:r?.15:.15*this.state.power('iron_mirror')))));
 }
 incoming(u:Ally,now:number):number{const m=this.guards.get(u);return m&&m.life===u.lifeId&&now<m.until?m.multiplier:1;}
 onAllyHurt(u:Ally,now:number):void{
  const n=this.state.level('watch'),seal=this.has('army_seal');if((!n&&!seal)||now<this.watchAt||Math.hypot(u.x-this.player.x,u.y-this.player.y)>220)return;
  this.watchAt=now+5000;const candidates=this.units.filter(a=>a.active&&Math.hypot(a.x-u.x,a.y-u.y)<=120).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp).slice(0,(n?[1,2,3][n-1]:1)+(seal?1:0));
  for(const a of candidates)this.guards.set(a,{life:a.lifeId,until:now+(n?[1500,1800,2100][n-1]:1500),multiplier:1-((n?[.15,.20,.25][n-1]:.15)+(seal?.1*this.state.power('army_seal'):0))});
 }
 update(now:number):void{
  const hits=this.pending;this.pending=[];for(const h of hits)if(h.enemy.active&&h.enemy.spawnId===h.spawn)this.deal(h.enemy,h.damage);
  // 护阵脉冲：默认只在脚下泛一圈淡金光（不画范围圈）；?rings=1 时恢复旧的范围圈
  this.gfx.clear();if(now<this.pulseUntil&&!HINT_MOCK){const k=(this.pulseUntil-now)/300;if(SHOW_RANGE_RINGS)this.gfx.lineStyle(2,0xd6c398,k*.8).strokeCircle(this.player.x,this.player.y-8,this.radius);else this.gfx.fillStyle(0xf0dca0,k*.16).fillEllipse(this.player.x,this.player.y+14,this.radius*.9,this.radius*.32);}
  for(const[u,m]of this.guards){if(!u.active||u.lifeId!==m.life||now>=m.until){this.guards.delete(u);continue;}this.gfx.lineStyle(2,0xc3c9aa,.8).beginPath().arc(u.x,u.y-10,20,-Math.PI*.9,-Math.PI*.1).strokePath();}
 }
 clear():void{this.readyAt=this.counterAt=this.watchAt=this.pulseUntil=0;this.guards.clear();this.pending=[];this.gfx.clear();}
}
