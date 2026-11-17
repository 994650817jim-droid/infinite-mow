import {buildVfx} from './BuildVfx';
import {SHOW_RANGE_RINGS} from '../ui/RangeRings';
import Phaser from 'phaser';import type {Enemy} from '../entities/Enemy';import type {Ally} from '../entities/Ally';import type {Player} from '../entities/Player';import {activeAwakenings} from '../data/awakenings';import {type BuffProgress,countProgress,distanceProgress,timerProgress} from '../ui/BuffProgress';
interface Hit{enemy:Enemy;spawn:number;damage:number;fire:boolean;}
/** Only original weapon hits enter this dispatcher; derived damage is queued and non-recursive. */
export class AwakeningCombat{
 private cds=new Map<string,number>();private pending:Hit[]=[];private distance=0;private hits=0;private known=new Set<string>();private clock=0;
 private fields:Array<{x:number;y:number;end:number;next:number;damage:number}>=[];private guards=new Map<Ally,{life:number;until:number}>();private gfx:Phaser.GameObjects.Graphics;private flashes:Array<{x:number;y:number;r:number;until:number;fire:boolean}>=[];private rescued=false;
 constructor(private scene:Phaser.Scene,private player:Player,private units:Ally[],private nearby:(x:number,y:number,r:number)=>Enemy[],private deal:(e:Enemy,n:number,fire:boolean)=>void,private controlled:(e:Enemy,n:number)=>boolean,private burning:(e:Enemy,n:number)=>boolean,private ignite:(e:Enemy,n:number,now:number)=>void,private notice:(text:string)=>void,private order:()=>string,private focus:(e:Enemy,n:number)=>void){this.gfx=scene.add.graphics().setDepth(19);}
 private active(id:string){return activeAwakenings(this.player.growth.build.tags()).some(a=>a.id===id);}
 private ready(id:string,now:number,cd:number){if(!this.active(id)||now<(this.cds.get(id)??0))return false;this.cds.set(id,now+cd);return true;}
 movement(d:number){this.distance=Math.min(250,this.distance+Math.max(0,d));}
 private targets(x:number,y:number,r:number){return this.nearby(x,y,r).filter(e=>e.active&&!e.isSupplySlot&&Math.hypot(e.x-x,e.y-y)<=r);}
 private burst(x:number,y:number,r:number,n:number,damage:number,now:number,fire=false){for(const e of this.targets(x,y,r).slice(0,n))if(this.pending.length<64)this.pending.push({enemy:e,spawn:e.spawnId,damage,fire});if(this.flashes.length<16)this.flashes.push({x,y,r,until:now+260,fire});}
 onHit(e:Enemy,damage:number,crit:boolean,now:number,charged:boolean){this.hits++;const controlled=this.controlled(e,now);let budget=3;
 const run=(id:string,cd:number,fn:()=>void)=>{if(budget>0&&this.ready(id,now,cd)){budget--;buildVfx(this.scene).emit(id,e.x,e.y-6,now,id==='fire_gate'?210:100,Math.atan2(e.y-this.player.y,e.x-this.player.x),360,true);fn();}};
 if(controlled)run('fire_gate',6000,()=>{if(this.fields.length<2)this.fields.push({x:e.x,y:e.y,end:now+1500,next:now+500,damage:damage*.2});});
 if(crit&&this.hits%4===0)run('peerless',2000,()=>this.burst(e.x,e.y,110,3,damage*.4,now));
 if(charged&&this.distance>=180)run('roaming_break',4000,()=>{this.distance=0;this.burst(e.x,e.y,100,5,damage*.5,now);});
 if(this.hits%6===0)run('pure_combo',2000,()=>this.burst(e.x,e.y,110,4,damage*.35,now));
 if(crit)run('pure_critical',3000,()=>this.burst(e.x,e.y,85,4,damage*.4,now));
 if(this.distance>=200)run('pure_skirmish',3000,()=>{this.distance=0;this.burst(e.x,e.y,95,4,damage*.4,now);});
 if(charged)run('pure_charge',3000,()=>{const dx=e.x-this.player.x,dy=e.y-this.player.y,len=Math.hypot(dx,dy)||1;for(const t of this.targets(e.x,e.y,180).filter(t=>{const x=t.x-e.x,y=t.y-e.y;return (x*dx+y*dy)/len>=0&&Math.abs(x*dy-y*dx)/len<=20+t.radius;}).slice(0,5))if(this.pending.length<64)this.pending.push({enemy:t,spawn:t.spawnId,damage:damage*.5,fire:false});if(this.flashes.length<16)this.flashes.push({x:e.x,y:e.y,r:70,until:now+260,fire:false});});
 if(controlled)run('pure_control',2000,()=>this.burst(e.x,e.y,85,4,damage*.3,now));
 }
 onKill(e:Enemy,now:number){if(this.burning(e,now)&&this.ready('pure_flame',now,1000)){for(const t of this.targets(e.x,e.y,100).filter(t=>t!==e).slice(0,4)){this.ignite(t,Math.max(2,e.maxHp*.02),now);buildVfx(this.scene).emit('pure_flame',(e.x+t.x)/2,(e.y+t.y)/2,now,75,Math.atan2(t.y-e.y,t.x-e.x),360,true);};if(this.flashes.length<16)this.flashes.push({x:e.x,y:e.y,r:100,until:now+260,fire:true});}}
 /** 增益图标的触发进度（只读，供 BuffHud 显示；id 为觉醒 id）。 */
 progress(id:string,now:number):BuffProgress|null{const cd=this.cds.get(id)??0;
 switch(id){
 case 'peerless':return countProgress(this.hits%4,4,'下一击暴击即追击');
 case 'pure_combo':return countProgress(this.hits%6,6,'下一击追击扩散');
 case 'roaming_break':return distanceProgress(this.distance,180,'蓄满势后下一击冲阵');
 case 'pure_skirmish':return distanceProgress(this.distance,200,'下一击破阵');
 case 'pure_command':return timerProgress(cd,6000,now,'即将发令');
 }
 const cycle=({fire_gate:6000,pure_critical:3000,pure_charge:3000,pure_control:2000,iron_army:8000,pure_flame:1000} as Record<string,number>)[id];
 return cycle&&now<cd?timerProgress(cd,cycle,now,'','冷却'):null;
 }
 allyIncoming(u:Ally,now:number){const g=this.guards.get(u);return g&&g.life===u.lifeId&&now<g.until?.75:1;}
 onAllyHurt(u:Ally,now:number){if(!this.ready('iron_army',now,8000))return;for(const t of this.units.filter(t=>t.active&&Math.hypot(t.x-u.x,t.y-u.y)<=140).slice(0,3))this.guards.set(t,{life:t.lifeId,until:now+2000});buildVfx(this.scene).emit('iron_army',u.x,u.y-8,now,90,0,500,true);this.push(u.x,u.y,now);}
 private push(x:number,y:number,now:number){for(const e of this.targets(x,y,80).filter(e=>e.kind!=='boss'&&!e.controlImmune&&e.def.behavior!=='wall').slice(0,3)){const dx=e.x-x,dy=e.y-y,d=Math.hypot(dx,dy)||1;e.sprite.x+=dx/d*24;e.sprite.y+=dy/d*24;}if(this.flashes.length<16)this.flashes.push({x,y,r:80,until:now+260,fire:false});}
 update(now:number){this.clock=now;const active=activeAwakenings(this.player.growth.build.tags());const fresh=active.filter(a=>!this.known.has(a.id));for(const a of active)this.known.add(a.id);if(fresh.length)this.notice('战法觉醒 · '+fresh.map(a=>a.name).join(' / '));
 const queued=this.pending;this.pending=[];for(const h of queued)if(h.enemy.active&&h.enemy.spawnId===h.spawn)this.deal(h.enemy,h.damage,h.fire);
 for(let i=this.fields.length-1;i>=0;i--){const f=this.fields[i];if(now>=f.next&&f.next<=f.end){f.next=now+500;this.burst(f.x,f.y,85,5,f.damage,now,true);}if(now>=f.end)this.fields.splice(i,1);}
 if(this.ready('pure_command',now,6000)){buildVfx(this.scene).emit(this.order()==='guard'?'iron_army':'pure_command',this.player.x,this.player.y-12,now,80,0,500,true);const friends=this.units.filter(u=>u.active&&Math.hypot(u.x-this.player.x,u.y-this.player.y)<=220);if(this.order()==='guard'){for(const u of friends.filter(u=>u.hp<u.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp).slice(0,2)){u.hp=Math.min(u.maxHp,u.hp+u.maxHp*.05);this.guards.set(u,{life:u.lifeId,until:now+2000});}this.push(this.player.x,this.player.y,now);}else{const e=this.targets(this.player.x,this.player.y,220)[0];if(e)this.focus(e,now);}}
 if(this.player.growth.awakenRescueUsed&&!this.rescued){this.rescued=true;buildVfx(this.scene).emit('pure_bulwark',this.player.x,this.player.y-8,now,100,0,600,true);this.push(this.player.x,this.player.y,now);}
 this.gfx.clear();for(const f of this.fields)buildVfx(this.scene).emit('fire_gate',f.x,f.y,now,210,0,250);
 for(let i=this.flashes.length-1;i>=0;i--){const f=this.flashes[i],t=(f.until-now)/260;if(t<=0){this.flashes.splice(i,1);continue;}// Trigger-specific atlas sprites replace the former generic flash circles.
}
 for(const[u,g]of this.guards)if(!u.active||u.lifeId!==g.life||now>=g.until)this.guards.delete(u);else if(SHOW_RANGE_RINGS)this.gfx.lineStyle(2,0xc3c9aa,.7).strokeCircle(u.x,u.y-8,17);else this.gfx.fillStyle(0xd8e0c0,.14).fillEllipse(u.x,u.y+12,34,11); // 护卫：默认脚下淡光
 }
 clear(){this.cds.clear();this.pending=[];this.fields=[];this.guards.clear();this.flashes=[];this.distance=this.hits=this.clock=0;this.known.clear();this.rescued=false;this.gfx.clear();}
}
