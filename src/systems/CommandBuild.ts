import {buildVfx} from './BuildVfx';
import {SHOW_RANGE_RINGS} from '../ui/RangeRings';
import {HINT_MOCK} from '../ui/HintStyle';
import {type BuffProgress,timerProgress} from '../ui/BuffProgress';
import Phaser from 'phaser';
import type {Ally} from '../entities/Ally';import type {Enemy} from '../entities/Enemy';import type {Player} from '../entities/Player';import type {BuildState} from '../data/builds';
/** Orders augment the existing Legion AI; no separate soldiers, projectiles or timers. */
export class CommandBuild {
 private focus=new Map<Ally,{life:number;enemy:Enemy;spawn:number;until:number}>();
 private guards=new Map<Ally,{life:number;until:number}>();private markAt=0;private healAt=0;private breakAt=0;private thinkAt=0;private clock=0;
 private pulses:Array<{x:number;y:number;until:number;heal:boolean}>=[];private gfx:Phaser.GameObjects.Graphics;
 constructor(scene:Phaser.Scene,private state:BuildState,private units:Ally[],private player:Player,private healFx:(u:Ally,now:number)=>void){this.gfx=scene.add.graphics().setDepth(42);}
 setState(state:BuildState):void{this.clear();this.state=state;}
 private has(id:'general_tally'|'return_drum'){return this.state.treasures.includes(id);}
 onHit(e:Enemy,now:number):void{const n=this.state.level('coordination'),t=this.has('general_tally');if((!n&&!t)||!e.active||e.isSupplySlot||now<this.markAt)return;
 const selected=this.units.filter(u=>u.active&&u.kind!=='medic'&&Math.hypot(u.x-this.player.x,u.y-this.player.y)<=220&&Math.hypot(u.x-e.x,u.y-e.y)<=260).sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y)).slice(0,(n?[2,3,4][n-1]:2)+(t?1:0));if(!selected.length)return;
 buildVfx(this.player.scene).emit('command',e.x,e.y-24,now,42,0,500);this.markAt=now+(n?[4000,3500,3000][n-1]:4000);const pt=this.state.power('general_tally');for(const u of selected){this.focus.set(u,{life:u.lifeId,enemy:e,spawn:e.spawnId,until:now+(n?[2000,2500,3000][n-1]+(t?1000*pt:0):2000*pt)});u.ai.nextThink=0;}}
 /** 增益图标的触发进度（只读，供 BuffHud 显示）。 */
 progress(id:string,now:number):BuffProgress|null{
 if(id==='tactic_rally'||id==='treasure_return_drum'){const h=this.state.level('rally');return timerProgress(this.healAt,h?[6000,5000,4000][h-1]:6000/this.state.power('return_drum'),now,'即将治疗');}
 if(id==='tactic_coordination'||id==='treasure_general_tally'){const n=this.state.level('coordination');return now<this.markAt?timerProgress(this.markAt,n?[4000,3500,3000][n-1]:4000,now,'','冷却'):{cur:1,max:1,seg:0,ready:true,text:'下一击指挥集火'};}
 return null;
 }
 target(u:Ally):Enemy|null{const m=this.focus.get(u);return m&&u.active&&u.lifeId===m.life&&this.clock<m.until&&m.enemy.active&&m.enemy.spawnId===m.spawn&&!m.enemy.invulnerable?m.enemy:null;}
 incoming(u:Ally,now:number):number{const g=this.guards.get(u);return g&&u.lifeId===g.life&&now<g.until?.8:1;}
 update(now:number,nearby:(x:number,y:number,r:number)=>Enemy[]):void{
 this.clock=now;for(const[u,m]of this.focus)if(!u.active||u.lifeId!==m.life||!m.enemy.active||m.spawn!==m.enemy.spawnId||now>=m.until)this.focus.delete(u);
 for(const[u,g]of this.guards)if(!u.active||u.lifeId!==g.life||now>=g.until)this.guards.delete(u);
 const heal=this.state.level('rally'),drum=this.has('return_drum');if((heal||drum)&&now>=this.healAt){this.healAt=now+(heal?[6000,5000,4000][heal-1]:6000/this.state.power('return_drum'));const wounded=this.units.filter(u=>u.active&&u.hp<u.maxHp&&Math.hypot(u.x-this.player.x,u.y-this.player.y)<=220).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp).slice(0,heal?[2,3,4][heal-1]:2);for(const u of wounded){u.hp=Math.min(u.maxHp,u.hp+u.maxHp*(heal?[.06,.09,.12][heal-1]:.05));if(drum)this.guards.set(u,{life:u.lifeId,until:now+2500});this.healFx(u,now);this.pulse(u.x,u.y,now,true);}}
 const n=this.state.level('breakout');if(n&&now>=this.thinkAt&&now>=this.breakAt){this.thinkAt=now+150;for(const u of this.units){if(!u.active||Math.hypot(u.x-this.player.x,u.y-this.player.y)>260)continue;const crowd=nearby(u.x,u.y,65).filter(e=>e.active&&!e.isSupplySlot&&Math.hypot(e.x-u.x,e.y-u.y)<=65);if(crowd.length<3)continue;const movable=crowd.filter(e=>e.kind!=='boss'&&!e.controlImmune&&e.def.behavior!=='wall').slice(0,[3,4,5][n-1]);if(!movable.length)continue;this.breakAt=now+[8000,7000,6000][n-1];for(const e of movable){let dx=e.x-u.x,dy=e.y-u.y,d=Math.hypot(dx,dy);if(d<.01){dx=1;dy=0;d=1;}const step=[30,42,54][n-1]*(e.kind==='elite'?.5:1);e.sprite.x+=dx/d*step;e.sprite.y+=dy/d*step;}this.pulse(u.x,u.y,now,false);break;}}
 this.gfx.clear();for(const[u,m]of this.focus){if(HINT_MOCK)continue;/* 只保留关键提示（默认）：集火不画连线和目标点 */const e=m.enemy;this.gfx.lineStyle(1,0xdbbd78,.5).lineBetween(u.x,u.y-12,e.x,e.y-12);if(SHOW_RANGE_RINGS)this.gfx.lineStyle(2,0xe0c283,.9).strokeCircle(e.x,e.y-12,13);else this.gfx.fillStyle(0xf2d38a,.5).fillCircle(e.x,e.y-28,3.5);} // 集火目标：默认只在头顶点一颗金点
 for(const[u]of this.guards)this.gfx.lineStyle(2,0x92c1b2,.8).beginPath().arc(u.x,u.y-12,18,-Math.PI*.9,-Math.PI*.1).strokePath();
 for(let i=this.pulses.length-1;i>=0;i--){const p=this.pulses[i],t=(p.until-now)/450;if(t<=0){this.pulses.splice(i,1);continue;}if(!HINT_MOCK)this.gfx.lineStyle(2,p.heal?0x9bc6a1:0xd0b47b,t*.7).strokeCircle(p.x,p.y,10+(1-t)*45);}
 }
 private pulse(x:number,y:number,now:number,heal:boolean){if(this.pulses.length<16)this.pulses.push({x,y,until:now+450,heal});}
 clear():void{this.focus.clear();this.guards.clear();this.pulses=[];this.markAt=this.healAt=this.breakAt=this.thinkAt=this.clock=0;this.gfx.clear();}
}
