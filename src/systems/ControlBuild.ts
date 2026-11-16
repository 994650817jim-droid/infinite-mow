import {buildVfx} from './BuildVfx';
import { softField } from './SoftField';
import {HINT_MOCK} from '../ui/HintStyle';
import type Phaser from 'phaser';
import type {Enemy} from '../entities/Enemy';
import type {BuildState} from '../data/builds';
interface Mark{enemy:Enemy;spawn:number;until:number;slow:number;spread:boolean;pull?:{x:number;y:number;until:number;speed:number};}
interface Field{x:number;y:number;r:number;until:number;next:number;gfx:Phaser.GameObjects.Graphics;}
/** Bounded status dispatcher, sharing the game's normal movement/collision pass. */
export class ControlBuild {
 private marks=new Map<number,Mark>();private fields:Field[]=[];private pullAt=0;private diskAt=0;private spreadAt=0;
 constructor(private scene:Phaser.Scene,private state:BuildState,private nearby:(x:number,y:number,r:number)=>Enemy[]){}
 private valid(e:Enemy){return e.active&&!e.isSupplySlot&&e.kind!=='boss'&&!e.controlImmune&&e.def.behavior!=='wall';}
 private mark(e:Enemy,slow:number,until:number,spread=false):Mark|undefined{
  if(!this.valid(e))return;if(this.state.tags().control>=2)slow=Math.min(.6,slow+.05);let m=this.marks.get(e.uid);if(m?.spawn!==e.spawnId){if(this.marks.size>=160)return;m={enemy:e,spawn:e.spawnId,until,slow,spread};this.marks.set(e.uid,m);}else{m.until=Math.max(m.until,until);m.slow=Math.max(m.slow,slow);m.spread=m.spread&&spread;}return m;
 }
 isControlled(e:Enemy,now:number):boolean{const m=this.marks.get(e.uid);return !!m&&m.spawn===e.spawnId&&m.until>now&&this.valid(e);}
 onHit(e:Enemy,now:number):void{
  const n=this.state.level('snare'),p=this.state.level('traction');if((n||p)&&this.valid(e))buildVfx(this.scene).emit('control',e.x,e.y,now,48);
  if(n)this.mark(e,[.18,.26,.34][n-1],now+[1000,1300,1600][n-1]);
  if(p&&now>=this.pullAt){this.pullAt=now+[4000,3500,3000][p-1];for(const t of this.nearby(e.x,e.y,100).filter(t=>this.valid(t)&&Math.hypot(t.x-e.x,t.y-e.y)<=100).slice(0,[2,3,4][p-1])){const m=this.mark(t,.12,now+900);if(m)m.pull={x:e.x,y:e.y,until:now+700,speed:[18,24,30][p-1]};}}
  if(this.state.treasures.includes('control_disk')&&now>=this.diskAt){this.diskAt=now+6000;if(this.fields.length>=2)this.fields.shift()!.gfx.destroy();const gfx=this.scene.add.graphics().setDepth(19);/* 镇场盘：柔和光晕替代硬描边圆与刻度 */if(!HINT_MOCK){const aura=softField(this.scene,e.x,e.y,85,0x9cbea8,.4);gfx.once('destroy',()=>aura.destroy());}this.fields.push({x:e.x,y:e.y,r:85,until:now+1800,next:now,gfx});buildVfx(this.scene).emit('pure_control',e.x,e.y,now,170,0,500);}
 }
 onKill(e:Enemy,now:number):void{
  const m=this.marks.get(e.uid);this.marks.delete(e.uid);const n=this.state.level('confinement');if(!n||!m||m.spawn!==e.spawnId||m.until<=now||m.spread||now<this.spreadAt)return;
  this.spreadAt=now+600;for(const t of this.nearby(e.x,e.y,95).filter(t=>t!==e&&this.valid(t)&&Math.hypot(t.x-e.x,t.y-e.y)<=95).slice(0,[2,3,4][n-1]))this.mark(t,[.15,.22,.30][n-1],now+[700,1000,1300][n-1],true);
 }
 motion(e:Enemy,now:number,dt:number):number{
  const m=this.marks.get(e.uid);if(!m||m.spawn!==e.spawnId||m.until<=now||!this.valid(e))return 1;
  const elite=e.kind==='elite'?.5:1;
  if(m.pull&&now<m.pull.until){const dx=m.pull.x-e.x,dy=m.pull.y-e.y,d=Math.hypot(dx,dy);if(d>8){const step=Math.min(d-8,m.pull.speed*elite*dt);e.sprite.x+=dx/d*step;e.sprite.y+=dy/d*step;}}
  return 1-m.slow*elite;
 }
 update(now:number):void{
  for(const[id,m]of this.marks)if(!m.enemy.active||m.spawn!==m.enemy.spawnId||m.until<=now)this.marks.delete(id);
  for(let i=this.fields.length-1;i>=0;i--){const f=this.fields[i];if(now>=f.until){f.gfx.destroy();this.fields.splice(i,1);continue;}if(now>=f.next){f.next=now+100;for(const e of this.nearby(f.x,f.y,f.r).filter(e=>this.valid(e)&&Math.hypot(e.x-f.x,e.y-f.y)<=f.r).slice(0,6)){const m=this.mark(e,.25,now+250);if(m)m.pull={x:f.x,y:f.y,until:now+200,speed:16};}}}
 }
 clear():void{this.marks.clear();for(const f of this.fields)f.gfx.destroy();this.fields=[];this.pullAt=this.diskAt=this.spreadAt=0;}
}
