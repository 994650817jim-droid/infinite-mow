import Phaser from 'phaser';
import type{Enemy}from'../entities/Enemy';
import type{EnemyKind}from'../types';
import type{Ally}from'../entities/Ally';
import {ENEMY_CAMP as C}from'../data/enemyCamp';
import {actorDepth,GAME_HEIGHT,IS_DESKTOP}from'../config';
import {worldText}from'../world/WorldUI';
export interface CampPoint{x:number;y:number;kind:EnemyKind;name:string;}
interface Camp{point:CampPoint;enemy:Enemy;life:number;next:number;warnUntil:number;destroyed:boolean;destroyedAt?:number;members:Array<{enemy:Enemy;life:number}>;label:Phaser.GameObjects.Text;spawned:number;labelMarked?:boolean;labelText?:string;}
interface Host{scene:Phaser.Scene;player:{x:number;y:number};create:(x:number,y:number,hp:number)=>Enemy|null;spawn:(kind:EnemyKind,x:number,y:number)=>Enemy|null;reward:(grain:number)=>void;support?:()=>readonly Ally[];}
/** Two finite garrisons, real killable supplies, same combat clock and existing enemy pool. */
export class EnemyCamps{
 readonly camps:Camp[]=[];private focus:Camp|null=null;private assistIds=new Set<number>();private assistAt=0;private marker:Phaser.GameObjects.Graphics;
 private gfx:Phaser.GameObjects.Graphics;
 constructor(private h:Host,points:readonly CampPoint[],now:number){
  this.gfx=h.scene.add.graphics().setDepth(35);this.marker=h.scene.add.graphics().setDepth(37);
  for(const point of points){const enemy=h.create(point.x,point.y,C.hp);if(!enemy)continue;const label=worldText(h.scene,point.x,point.y-155,'敌营',13,'#e4ba85').setOrigin(.5).setDepth(36);this.camps.push({point,enemy,life:enemy.spawnId,next:now+C.firstDelay,warnUntil:0,destroyed:false,members:[],label,spawned:0});}
 }
 /** Validated by spawn life, never persisted or inherited across maps. */
 get selected():Enemy|null{const c=this.focus;if(!c)return null;if(c.destroyed||!c.enemy.active||c.enemy.spawnId!==c.life||Math.hypot(c.point.x-this.h.player.x,c.point.y-this.h.player.y)>600){this.cancel();return null;}return c.enemy;}
 cancel():void{this.focus=null;this.assistIds.clear();this.marker.clear();}
 target(range:number,bodyRadius=true):Enemy|null{const e=this.selected;return e&&Math.hypot(e.x-this.h.player.x,e.y-this.h.player.y)<=range+(bodyRadius?e.radius:0)?e:null;}
 pointer(pointer:Phaser.Input.Pointer):boolean{
  // Interactive HUD controls and the fixed joystick remain independent of world targeting.
  const hud=this.h.scene.input.hitTestPointer(pointer).some(o=>{const a=o as Phaser.GameObjects.Image;return a.scrollFactorX===0;});if(hud)return false;
  if(!IS_DESKTOP&&pointer.x<180&&pointer.y>GAME_HEIGHT-250)return false;
  const p=this.h.scene.cameras.main.getWorldPoint(pointer.x,pointer.y);
  const c=this.camps.find(c=>!c.destroyed&&c.enemy.active&&c.enemy.spawnId===c.life&&c.enemy.sprite.getBounds().contains(p.x,p.y));
  if(!c){this.cancel();return false;}
  this.focus=c;this.assistAt=0;this.updateMarker();return true;
 }
 private eligible(u:Ally,e:Enemy){return u.active&&u.kind!=='medic'&&u.hp/u.maxHp>=.3&&u.ai.mode==='advance'&&u.ai.danger<=2&&Math.hypot(u.x-this.h.player.x,u.y-this.h.player.y)<=260&&Math.hypot(e.x-u.x,e.y-u.y)<=u.def.range;}
 assist(u:Ally):Enemy|null{const e=this.selected;return e&&this.assistIds.has(u.id)&&this.eligible(u,e)?e:null;}
 private updateMarker(){this.marker.clear();const e=this.selected;if(!e)return;const x=e.x,y=e.y,w=87,top=y-166,bottom=y+5;this.marker.lineStyle(2,0xf0c479,.95);for(const sign of[-1,1]){const xx=x+sign*w;this.marker.lineBetween(xx-sign*17,top,xx,top).lineBetween(xx,top,xx,top+18).lineBetween(xx-sign*17,bottom,xx,bottom).lineBetween(xx,bottom,xx,bottom-18);}this.marker.fillStyle(0xf0c479,.95).fillTriangle(x-6,top-8,x+6,top-8,x,top-1);this.marker.fillStyle(0x211a14,.9).fillRect(x-44,y-151,88,6).fillStyle(0xe4b56c).fillRect(x-44,y-151,88*Math.max(0,e.hp/e.maxHp),6);}
 onDestroyed(enemy:Enemy,now:number):boolean{const c=this.camps.find(c=>c.enemy===enemy&&c.life===enemy.spawnId&&!c.destroyed);if(!c)return false;c.destroyed=true;c.destroyedAt=now;if(this.focus===c)this.cancel();c.warnUntil=0;c.next=Infinity;this.h.reward(C.grainReward);c.label.setPosition(enemy.x,enemy.y-62).setFontSize(16).setPadding(5,3).setBackgroundColor('#241c15dc').setText('敌营已毁 · +8粮').setColor('#f4d89b');enemy.sprite.setDepth(actorDepth(enemy.y));this.gfx.clear();return true;}
 update(now:number):void{
  this.gfx.clear();this.updateMarker();const focus=this.selected;
  if(focus&&now>=this.assistAt){this.assistAt=now+250;this.assistIds.clear();for(const u of [...(this.h.support?.()??[])].filter(u=>this.eligible(u,focus)).sort((a,b)=>Math.hypot(a.x-focus.x,a.y-focus.y)-Math.hypot(b.x-focus.x,b.y-focus.y)).slice(0,6))this.assistIds.add(u.id);}
  for(const c of this.camps){const {point:p,enemy:e}=c,d=Math.hypot(this.h.player.x-p.x,this.h.player.y-p.y);c.label.setVisible(d<650);
   if(c.destroyed){const age=now-(c.destroyedAt??-9999);c.label.setVisible(d<650&&age>=0&&age<2600);if(age>=0&&age<480){const t=age/480;for(let i=0;i<6;i++){const a=i*Math.PI/3;this.gfx.fillStyle(i%2?0xa48453:0x6c5840,(1-t)*.65).fillRect(p.x+Math.cos(a)*(12+t*28),p.y-7+Math.sin(a)*t*12-t*(1-t)*18,3,2);}}continue;}
   if(!e.active||e.spawnId!==c.life){c.destroyed=true;c.destroyedAt=now;c.label.setText('敌营已毁');continue;}
   c.members=c.members.filter(m=>m.enemy.active&&m.enemy.spawnId===m.life);
   if(d>C.activationRadius){c.warnUntil=0;c.next=Math.max(c.next,now+C.firstDelay);continue;}
   const warn=c.warnUntil>0,marked=this.focus===c;
   const status=warn?'集结中':c.members.length>=C.livePerCamp?'待命':Number.isFinite(c.next)?'增援'+Math.max(0,Math.ceil((c.next-now)/1000))+'秒':'待命';
   const cam=this.h.scene.cameras.main;let labelY=p.y-(marked?188:160);
   if((labelY-cam.scrollY)*cam.zoom<(IS_DESKTOP?115:205))labelY=p.y+24;
   c.label.setPosition(p.x,labelY);
   // Style setters redraw Phaser text even if unchanged; only refresh on state changes.
   if(c.labelMarked!==marked){c.labelMarked=marked;c.label.setFontSize(marked?16:14).setPadding(marked?4:0,2).setBackgroundColor(marked?'#241c15dc':'#00000000').setColor(marked?'#ffe1a0':'#e4ba85');}
   const text=(marked?'优先拆营 '+Math.ceil(Math.max(0,e.hp))+'/'+e.maxHp:'敌营')+'\n'+status;
   if(c.labelText!==text){c.labelText=text;c.label.setText(text);}
   // Small ground muster chevrons, not a screen-wide danger ring.
   if(warn){this.gfx.lineStyle(2,0xd9a061,.8);for(let k=-1;k<=1;k++){const x=p.x+k*16,y=p.y+28;this.gfx.lineBetween(x-5,y,x,y+7).lineBetween(x,y+7,x+5,y);}}
   if(e.hp<e.maxHp){this.gfx.fillStyle(0x211a14,.8).fillRect(p.x-35,p.y-139,70,4).fillStyle(0xbf754d).fillRect(p.x-35,p.y-139,70*Math.max(0,e.hp/e.maxHp),4);}
   if(c.warnUntil&&now>=c.warnUntil){c.warnUntil=0;c.next=now+C.interval;for(let i=0;i<C.waveSize&&c.members.length<C.livePerCamp;i++){const x=p.x+(i-1)*42,y=p.y+C.spawnRadius;if(Math.hypot(this.h.player.x-x,this.h.player.y-y)<65)continue;const unit=this.h.spawn(p.kind,x,y);if(!unit)break;c.members.push({enemy:unit,life:unit.spawnId});c.spawned++;}continue;}
   if(!c.warnUntil&&now>=c.next&&c.members.length<C.livePerCamp)c.warnUntil=now+C.warning;
  }
 }
 clear(){this.cancel();this.marker.destroy();this.gfx.destroy();for(const c of this.camps)c.label.destroy();this.camps.length=0;}
}
