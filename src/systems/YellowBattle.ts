import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Legion } from './Legion';
import { ENEMY_DEFS, type EnemyDef } from '../data/enemies';
import type { YellowStage } from '../data/chapters';

interface Host { scene:Phaser.Scene; player:Player; army:Legion; enemies:Enemy[]; move:(enemy:Enemy,nx:number,ny:number,dt:number)=>void; spawn:(def:EnemyDef,x:number,y:number)=>Enemy|null; }
interface Hazard { owner:Enemy; life:number; x:number;y:number; radius:number; angle:number; arc:number; inner:number; from:number; at:number; end:number; damage:number; fired:boolean; kind:string; }
/** Combat-clock hazards: pause-safe, bounded, and invalidated when a pooled caster dies/recycles. */
export class YellowBattle {
 private readonly gfx:Phaser.GameObjects.Graphics;
 private readonly hazards:Hazard[]=[];
 private readonly visuals:Phaser.GameObjects.Image[]=[];
 private readonly walls:Array<{enemy:Enemy;life:number;until:number}>=[];
 private readonly rallies:Array<{enemy:Enemy;life:number;until:number;speed:number}>=[];
 private bossCd=2000; private summonCd=8000; private cycle=0;
 private dash:{owner:Enemy;life:number;x:number;y:number;vx:number;vy:number;start:number;end:number;hit:boolean}|null=null;
 private now=0;
 readonly metrics={casts:0,impacts:0,summons:0,walls:0};
 constructor(private h:Host,readonly stage:YellowStage){
  this.gfx=h.scene.add.graphics().setDepth(40);
  for(let i=0;i<20;i++)this.visuals.push(h.scene.add.image(0,0,'yellow_shaman_ground_sigil_warning',0).setVisible(false).setDepth(39));
 }
 variant(base:EnemyDef,elapsed=0):EnemyDef {
  if(this.stage===1||elapsed<60)return base;
  if(base.kind==='archer')return {...base,walkVisual:{texture:'yellow_archer_walk',scale:.68,groundY:91/96},attackVisual:'yellow_archer_attack'};
  if(base.kind==='shield')return {...base,walkVisual:{texture:'yellow_shield_walk',scale:.78,groundY:91/96},attackVisual:'yellow_shield_attack'};
  if(base.kind!=='infantry')return base;
  const r=Math.random();
  const behavior=this.stage>=3&&r<.08?'thunder':this.stage>=3&&r<.16?'halberd':this.stage>=2&&r<.3?'shaman':r<.7?'spear':undefined;
  if(!behavior)return base;
  const sheet=behavior==='spear'?'spear':behavior==='halberd'?'spear':'shaman';
  return {...base,behavior,hp:behavior==='halberd'?base.hp*2:behavior==='thunder'?base.hp*1.8:base.hp,speed:behavior==='shaman'||behavior==='thunder'?52:base.speed,
   tint:behavior==='thunder'?0xbca6e8:behavior==='halberd'?0xc7a268:0xffffff,
   walkVisual:{texture:`yellow_${sheet}_walk`,scale:behavior==='halberd'||behavior==='thunder'?.91:.72,groundY:91/96},attackVisual:`yellow_${sheet}_${sheet==='shaman'?'cast':'attack'}`};
 }
 private warn(e:Enemy,x:number,y:number,radius:number,delay:number,damage:number,kind:string,angle=0,arc=Math.PI*2,inner=0):void {
  if(this.hazards.length>=20)return;
  this.hazards.push({owner:e,life:e.spawnId,x,y,radius,angle,arc,inner,from:this.now,at:this.now+delay,end:this.now+delay+220,damage,fired:false,kind});this.metrics.casts++;
  if(e.kind!=='boss')e.poseUntil=Math.max(e.poseUntil,this.now+delay+180);
  e.startAttack(this.now,Math.abs(Math.cos(angle))>.7?(Math.cos(angle)<0?'left':'right'):(Math.sin(angle)<0?'up':'down'));
 }
 handleEnemy(e:Enemy,dt:number,now:number,target:{x:number;y:number}):boolean {
  const b=e.def.behavior;if(!b&&e.kind!=='shield')return false;this.now=now;
  if(b==='wall')return true;
  if(e.poseUntil>now||e.attackUntil>now){e.moveVx=e.moveVy=0;return true;}
  const dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy)||1,angle=Math.atan2(dy,dx);
  const ranged=b==='shaman'||b==='thunder',range=ranged?240:b==='spear'?92:b==='halberd'?105:62;
  const travel=d>range*.9?1:ranged&&d<145?-1:0;
  this.h.move(e,dx/d*travel,dy/d*travel,dt);
  if(e.shootCd<=0&&d<range+30){e.shootCd=b==='thunder'?4.4:ranged?3.6:2.1;
   if(b==='thunder'){for(let i=-1;i<=1;i++)this.warn(e,target.x+i*65,target.y,42,900+(i+1)*170,e.def.damage+3,'thunder');return true;}
   this.warn(e,ranged?target.x:e.x,ranged?target.y:e.y,ranged?55:range,ranged?850:450,e.def.damage,ranged?'sigil':'stab',angle,ranged?Math.PI*2:b==='halberd'?Math.PI:Math.PI*.5);
  }
  return true;
 }
 moveBoss(boss:Enemy,dt:number,now:number):void {
  if(this.stage===3)return;
  this.now=now;const p=this.h.player,d=Math.hypot(p.x-boss.x,p.y-boss.y)||1,angle=Math.atan2(p.y-boss.y,p.x-boss.x);
  if(!this.dash&&boss.attackUntil<=now&&d>(this.stage===1?110:230)){boss.sprite.x+=Math.cos(angle)*boss.def.speed*dt;boss.sprite.y+=Math.sin(angle)*boss.def.speed*dt;}
  this.bossCd-=dt*1000;this.summonCd-=dt*1000;const enraged=boss.hp<=boss.maxHp*.5;
  if(this.bossCd<=0&&!this.dash){this.bossCd=enraged?2200:3300;const n=this.cycle++%3;
   if(this.stage===1){
    if(n===1){const length=Math.min(d+80,320),delay=850;this.warn(boss,boss.x,boss.y,length,delay,0,'charge',angle,.22);this.dash={owner:boss,life:boss.spawnId,x:boss.x,y:boss.y,vx:Math.cos(angle)*570,vy:Math.sin(angle)*570,start:now+delay,end:now+delay+length/570*1000,hit:false};}
    else this.warn(boss,boss.x,boss.y,145,enraged?550:750,16,'sweep',angle,Math.PI*.8);
   }else if(n===0){for(let i=-1;i<=1;i++)this.warn(boss,p.x+i*78,p.y,55,1000,17,'rift');}
   else if(n===1){this.warn(boss,boss.x,boss.y,230,1050,18,'ring',0,Math.PI*2,115);}
   else {for(let i=-2;i<=2;i++)if(i!==0){const w=this.h.spawn({...ENEMY_DEFS.shield,behavior:'wall',texture:'enemy_shield',walkVisual:undefined,hp:65,speed:0,damage:0,xp:0,radius:22},p.x+i*52,p.y-95);if(w){w.walkSheet='';w.attackSheet='';w.sprite.setTexture('zhangbao_earth_wall_spawn',5).setDisplaySize(64,64);this.walls.push({enemy:w,life:w.spawnId,until:now+6500});this.metrics.walls++;}}}
  }
  if(this.summonCd<=0){this.summonCd=enraged?8500:12000;const count=Math.min(3,Math.max(0,8-this.h.enemies.filter(e=>e.active&&e.def.behavior==='shaman').length));this.warn(boss,boss.x,boss.y,95,650,0,'ritual');
   for(let i=0;i<count;i++){const def=this.variant(ENEMY_DEFS.infantry,60),a=i*Math.PI*2/3;const unit=this.h.spawn(this.stage===2&&enraged?{...def,behavior:'shaman',walkVisual:{texture:'yellow_shaman_walk',scale:.72,groundY:91/96},attackVisual:'yellow_shaman_cast'}:def,boss.x+Math.cos(a)*85,boss.y+Math.sin(a)*85);if(unit){if(this.stage===1){unit.shootCd=.3;const speed=unit.def.speed;unit.def={...unit.def,speed:speed*1.18};this.rallies.push({enemy:unit,life:unit.spawnId,until:now+4000,speed});}this.metrics.summons++;}}
  }
 }
 update(dt:number,now:number):void {
  this.now=now;
  for(let i=this.rallies.length-1;i>=0;i--){const r=this.rallies[i];if(now>=r.until||!r.enemy.active||r.enemy.spawnId!==r.life){if(r.enemy.spawnId===r.life)r.enemy.def={...r.enemy.def,speed:r.speed};this.rallies.splice(i,1);}}
  if(this.dash){const d=this.dash;if(!d.owner.active||d.owner.spawnId!==d.life||d.owner.stunUntil>now||now>d.end)this.dash=null;else if(now>=d.start){d.owner.sprite.x+=d.vx*dt;d.owner.sprite.y+=d.vy*dt;const p=this.h.player;if(!d.hit&&Phaser.Geom.Intersects.LineToCircle(new Phaser.Geom.Line(d.owner.x-d.vx*dt,d.owner.y-d.vy*dt,d.owner.x,d.owner.y),new Phaser.Geom.Circle(p.x,p.y,40+p.radius))){p.takeDamage(18,now);d.hit=true;}this.h.army.hurtArea(d.owner.x,d.owner.y,36,18,now);}}
  for(let i=this.walls.length-1;i>=0;i--){const w=this.walls[i];if(!w.enemy.active||w.enemy.spawnId!==w.life||now>=w.until){if(w.enemy.spawnId===w.life)w.enemy.deactivate();this.walls.splice(i,1);continue;}const p=this.h.player,dx=p.x-w.enemy.x,dy=p.y-w.enemy.y,d=Math.hypot(dx,dy)||1,min=p.radius+w.enemy.radius;if(d<min){p.sprite.x=w.enemy.x+dx/d*min;p.sprite.y=w.enemy.y+dy/d*min;}}
  this.gfx.clear();for(const image of this.visuals)image.setVisible(false);
  let index=0;
  for(let i=this.hazards.length-1;i>=0;i--){const z=this.hazards[i];if(!z.owner.active||z.owner.spawnId!==z.life||now>=z.end){this.hazards.splice(i,1);continue;}
   if(now>=z.at&&!z.fired){z.fired=true;this.metrics.impacts++;const p=this.h.player,dx=p.x-z.x,dy=p.y-z.y,d=Math.hypot(dx,dy),inside=d<=z.radius+p.radius&&d>=z.inner-p.radius&&(z.arc>=Math.PI*2||Math.cos(Math.atan2(dy,dx)-z.angle)>=Math.cos(z.arc/2));if(inside&&z.damage)p.takeDamage(z.damage,now);if(z.damage)for(const u of this.h.army.units){if(!u.active)continue;const dx=u.x-z.x,dy=u.y-z.y,d=Math.hypot(dx,dy);if(d<=z.radius+u.radius&&d>=z.inner-u.radius&&(z.arc>=Math.PI*2||Math.cos(Math.atan2(dy,dx)-z.angle)>=Math.cos(z.arc/2)))this.h.army.hurt(u,z.damage,now);}z.owner.startAttack(now-180,z.owner.direction);}
   const key=z.kind==='sweep'?'zhangliang_slash':z.kind==='charge'?'zhangliang_charge_warning':z.kind==='ring'?'zhangbao_earth_shockwave':z.kind==='ritual'?'zhangbao_ritual_circle':z.kind==='rift'?'zhangbao_earth_rift_warning_and_burst':z.kind==='stab'?'yellow_shield_short_stab':'yellow_shaman_ground_sigil_warning';
   const image=this.visuals[index++];if(image)image.setTexture(key,z.fired?Math.min(7,4+Math.floor((now-z.at)/55)):Math.min(3,Math.floor((now-z.from)/Math.max(1,z.at-z.from)*4))).setPosition(z.x,z.y).setDisplaySize(z.radius*2,z.radius*2).setAlpha(z.fired?.8:.38).setRotation(z.arc<Math.PI*2?z.angle:0).setVisible(true);if(image&&z.kind==='charge')image.setPosition(z.x+Math.cos(z.angle)*z.radius/2,z.y+Math.sin(z.angle)*z.radius/2).setDisplaySize(z.radius,72);
   this.gfx.lineStyle(z.fired?3:2,z.fired?0xffe0a0:0xf5a34a,.9);
   if(z.kind==='charge'){const nx=Math.cos(z.angle),ny=Math.sin(z.angle);for(const side of [-1,1])this.gfx.lineBetween(z.x-ny*side*36,z.y+nx*side*36,z.x+nx*z.radius-ny*side*36,z.y+ny*z.radius+nx*side*36);}
   else if(z.arc<Math.PI*2){this.gfx.beginPath().moveTo(z.x,z.y).arc(z.x,z.y,z.radius,z.angle-z.arc/2,z.angle+z.arc/2).closePath().strokePath();}
   else {this.gfx.strokeCircle(z.x,z.y,z.radius);if(z.inner)this.gfx.strokeCircle(z.x,z.y,z.inner);}
  }
 }
 clear():void {for(const r of this.rallies)if(r.enemy.spawnId===r.life)r.enemy.def={...r.enemy.def,speed:r.speed};this.rallies.length=0;this.hazards.length=0;this.dash=null;this.gfx.clear();for(const v of this.visuals)v.setVisible(false);for(const w of this.walls)if(w.enemy.spawnId===w.life)w.enemy.deactivate();this.walls.length=0;}
}
