import Phaser from 'phaser';
const DEPTH_WALL_WARN=12;
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Legion } from './Legion';
import { ENEMY_DEFS, type EnemyDef } from '../data/enemies';
import type { YellowStage } from '../data/chapters';
import { TELEGRAPH_CLASSIC, groundCracks, laneCracks, windupFlash } from '../ui/Telegraph';
import { HINT_MOCK } from '../ui/HintStyle';
import { WARN_FX_ON } from '../ui/WarnFx';

interface Host { scene:Phaser.Scene; player:Player; army:Legion; enemies:Enemy[]; move:(enemy:Enemy,nx:number,ny:number,dt:number)=>void; spawn:(def:EnemyDef,x:number,y:number)=>Enemy|null; }
interface Hazard { owner:Enemy; life:number; x:number;y:number; radius:number; angle:number; arc:number; inner:number; from:number; at:number; end:number; damage:number; fired:boolean; kind:string; }
/** Combat-clock hazards: pause-safe, bounded, and invalidated when a pooled caster dies/recycles. */
export class YellowBattle {
 private readonly gfx:Phaser.GameObjects.Graphics;
 private readonly hazards:Hazard[]=[];
 private readonly clips:Phaser.GameObjects.Graphics[]=[];
 private readonly visuals:Phaser.GameObjects.Image[]=[];
 private readonly walls:Array<{enemy:Enemy;life:number;until:number;born:number}>=[];
 private readonly wallPlans:Array<{x:number;y:number;rise:number;owner:Enemy;life:number}>=[];
 private wallGfx?:Phaser.GameObjects.Graphics;
 private readonly rallies:Array<{enemy:Enemy;life:number;until:number;speed:number}>=[];
 private bossCd=2000; private summonCd=8000; private cycle=0;
 private dash:{owner:Enemy;life:number;x:number;y:number;vx:number;vy:number;start:number;end:number;hit:boolean}|null=null;
 private now=0;
 readonly metrics={casts:0,impacts:0,summons:0,walls:0};
 constructor(private h:Host,readonly stage:YellowStage){
  this.gfx=h.scene.add.graphics().setDepth(40);
  for(let i=0;i<20;i++){const clip=h.scene.make.graphics({x:0,y:0});this.clips.push(clip);this.visuals.push(h.scene.add.image(0,0,'yellow_shaman_ground_sigil_warning',0).setVisible(false).setDepth(39).setMask(clip.createGeometryMask()));}
  h.scene.events.once('shutdown',()=>{for(const clip of this.clips)clip.destroy();});
 }
 variant(base:EnemyDef,elapsed=0):EnemyDef {
  // 1-1 也用黄巾刀盾兵造型（第 2 波起出刀盾兵）；弓手等其余兵种仍用原图
  if(this.stage===1&&base.kind!=='infantry'&&base.kind!=='shield')return base;
  // 1-2 introduces shield soldiers in its fourth wave (waves start every 60s).
  // 1-3 exposes the complete Yellow Turban roster from the opening wave.
  // Keep the first-pass archer artwork and its matching attack sheet.
  if(base.kind==='archer')return base;
  if(base.kind==='shield')return {...base,walkVisual:{texture:'yellow_shield-walk-v4',scale:.62,groundY:88/96},attackVisual:'yellow_shield-attack-v4'};
  if(base.kind==='infantry'){
   if(this.stage===3){
    const r=Math.random(),behavior=r<.08?'thunder':r<.16?'halberd':r<.3?'shaman':r<.7?'spear':undefined;
    if(behavior){const sheet=behavior==='spear'||behavior==='halberd'?'spear':'shaman';return {...base,behavior,hp:behavior==='halberd'?base.hp*2:behavior==='thunder'?base.hp*1.8:base.hp,speed:behavior==='shaman'||behavior==='thunder'?52:base.speed,tint:behavior==='thunder'?0xffd86a:behavior==='halberd'?0xc7a268:0xffffff,walkVisual:sheet==='spear'?{texture:'yellow_spear-walk-v5',scale:behavior==='halberd'?.63:.57,groundY:123/128,matched:true}:{texture:`yellow_${sheet}_walk`,scale:behavior==='thunder'?.74:behavior==='shaman'?.72:.66,groundY:91/96},attackVisual:sheet==='spear'?'yellow_spear-attack-v5':`yellow_${sheet}_cast`};}
   }
   return {...base,walkVisual:{texture:'yellow_swordsman-walk-v4',scale:.62,groundY:88/96},attackVisual:'yellow_swordsman-attack-v4'};
  }
  return base;
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
    else{const delay=enraged?550:750;this.warn(boss,boss.x,boss.y,145,delay,16,'sweep',angle,Math.PI*.8);
     // 张梁砍击（特效型警示，默认）：站定抬刀蓄力，刀落下后再走（原来蓄力时还在往前走，看不出要砍）
     if(!TELEGRAPH_CLASSIC&&HINT_MOCK==='c'&&WARN_FX_ON){const dir=Math.abs(Math.cos(angle))>Math.abs(Math.sin(angle))?(Math.cos(angle)<0?'left':'right'):(Math.sin(angle)<0?'up':'down');boss.startAttack(now,dir);boss.attackUntil=now+delay+220;boss.windupCol=1;}}
   }else if(n===0){for(let i=-1;i<=1;i++)this.warn(boss,p.x+i*78,p.y,55,1000,17,'rift');}
   else if(n===1){this.warn(boss,boss.x,boss.y,230,1050,18,'ring',0,Math.PI*2,115);}
   else this.castEarthWall(boss,now);
  }
  if(this.summonCd<=0){this.summonCd=enraged?8500:12000;const count=Math.min(3,Math.max(0,8-this.h.enemies.filter(e=>e.active&&e.def.behavior==='shaman').length));this.warn(boss,boss.x,boss.y,95,650,0,'ritual');
   for(let i=0;i<count;i++){const def=this.variant(ENEMY_DEFS.infantry,60),a=i*Math.PI*2/3;const unit=this.h.spawn(this.stage===2&&enraged?{...def,behavior:'shaman',walkVisual:{texture:'yellow_shaman_walk',scale:.72,groundY:91/96},attackVisual:'yellow_shaman_cast'}:def,boss.x+Math.cos(a)*85,boss.y+Math.sin(a)*85);if(unit){if(this.stage===1){unit.shootCd=.3;const speed=unit.def.speed;unit.def={...unit.def,speed:speed*1.18};this.rallies.push({enemy:unit,life:unit.spawnId,until:now+4000,speed});}this.metrics.summons++;}}
  }
 }
 update(dt:number,now:number):void {
  this.now=now;
  for(let i=this.rallies.length-1;i>=0;i--){const r=this.rallies[i];if(now>=r.until||!r.enemy.active||r.enemy.spawnId!==r.life){if(r.enemy.spawnId===r.life)r.enemy.def={...r.enemy.def,speed:r.speed};this.rallies.splice(i,1);}}
  if(this.dash){const d=this.dash;if(!d.owner.active||d.owner.spawnId!==d.life||d.owner.stunUntil>now||now>d.end)this.dash=null;else if(now>=d.start){d.owner.sprite.x+=d.vx*dt;d.owner.sprite.y+=d.vy*dt;const p=this.h.player;if(!d.hit&&Phaser.Geom.Intersects.LineToCircle(new Phaser.Geom.Line(d.owner.x-d.vx*dt,d.owner.y-d.vy*dt,d.owner.x,d.owner.y),new Phaser.Geom.Circle(p.x,p.y,40+p.radius))){p.takeDamage(18,now);d.hit=true;}this.h.army.hurtArea(d.owner.x,d.owner.y,36,18,now);}}
  this.updateEarthWalls(now);
  this.gfx.clear();for(const image of this.visuals)image.setVisible(false);
  let index=0;
  for(let i=this.hazards.length-1;i>=0;i--){const z=this.hazards[i];if(!z.owner.active||z.owner.spawnId!==z.life||now>=z.end){this.hazards.splice(i,1);continue;}
   if(now>=z.at&&!z.fired){z.fired=true;this.metrics.impacts++;if(z.kind==='sweep'&&!TELEGRAPH_CLASSIC&&HINT_MOCK==='c'&&WARN_FX_ON)this.h.scene.cameras.main.shake(110,.004);/* 张梁砍下：轻微震屏 */const p=this.h.player,dx=p.x-z.x,dy=p.y-z.y,d=Math.hypot(dx,dy),inside=d<=z.radius+p.radius&&d>=z.inner-p.radius&&(z.arc>=Math.PI*2||Math.cos(Math.atan2(dy,dx)-z.angle)>=Math.cos(z.arc/2));if(inside&&z.damage)p.takeDamage(z.damage,now);if(z.damage)for(const u of this.h.army.units){if(!u.active)continue;const dx=u.x-z.x,dy=u.y-z.y,d=Math.hypot(dx,dy);if(d<=z.radius+u.radius&&d>=z.inner-u.radius&&(z.arc>=Math.PI*2||Math.cos(Math.atan2(dy,dx)-z.angle)>=Math.cos(z.arc/2)))(z.owner.kind==='boss'?this.h.army.hurtByBoss(u,z.damage,now):this.h.army.hurt(u,z.damage,now));}z.owner.startAttack(now-180,z.owner.direction);}
   const key=z.kind==='sweep'?'zhangliang_slash':z.kind==='charge'?'zhangliang_charge_warning':z.kind==='ring'?'zhangbao_earth_shockwave':z.kind==='ritual'?'zhangbao_ritual_circle':z.kind==='rift'?'zhangbao_earth_rift_warning_and_burst':z.kind==='stab'?'yellow_shield_short_stab':'yellow_shaman_ground_sigil_warning';
   const image=this.visuals[index],clip=this.clips[index++],progress=Phaser.Math.Clamp((now-z.from)/Math.max(1,z.at-z.from),0,1);
   if(clip){clip.clear().fillStyle(0xffffff,1);this.area(clip,z);}
   if(image)image.setTexture(key,Math.min(7,4+Math.max(0,Math.floor((now-z.at)/55))))/* 命中前 now<z.at 会算出负帧号（图此时隐藏，但每帧报 no frame 警告） */.setPosition(z.x,z.y).setDisplaySize(z.radius*2,z.radius*2).setAlpha(.7).setRotation(z.arc<Math.PI*2?z.angle:0).setVisible(z.fired);
   if(image&&z.kind==='charge')image.setPosition(z.x+Math.cos(z.angle)*z.radius/2,z.y+Math.sin(z.angle)*z.radius/2).setDisplaySize(z.radius,72);
   // 低调预警（默认）：不画填色扇形 / 圆圈与描边，落点地裂纹随蓄力加深、出招者身上闪光；命中图样调淡（?telegraph=1 恢复旧样式）
   if(!TELEGRAPH_CLASSIC){
    // 预警类图样（法阵符圈、冲锋预警、祭坛圈）本身就是“大圆环 + 花纹”，不显示；斩击 / 地刺 / 冲击波等命中图样保留但调淡
    if(image)image.setAlpha(.45).setVisible(z.fired&&!/warning(?!_and_burst)|ritual|sigil/.test(key));
    if(!z.fired)windupFlash(z.owner,now);
    // 张梁砍击：蓄力时刀光虚影沿砍击方向由短到长伸出去（刀光图前 4 帧，半透明）；砍下时刀光全亮
    if(z.kind==='sweep'&&HINT_MOCK==='c'&&WARN_FX_ON&&image){if(z.fired)image.setAlpha(.95);else image.setTexture(key,Math.min(3,Math.floor(progress*4))).setAlpha(.3+.45*progress).setVisible(true);continue;}
    // 特效型警示（默认）：黄巾章本来就画好了预警图（术士符阵、张梁冲锋、张宝地裂，前 4 帧是蓄力），按进度播放；召唤仪式没有伤害，不提示
    if(HINT_MOCK==='c'&&WARN_FX_ON){if(z.kind==='ritual'||!z.damage)continue;if(image&&(z.kind==='sigil'||z.kind==='charge'||z.kind==='rift')){if(!z.fired)image.setTexture(key,Math.min(3,Math.floor(progress*4))).setAlpha(.35+.45*progress).setVisible(true);else if(z.kind==='sigil')image.setAlpha(.8).setVisible(true);continue;}}
    if(z.kind==='charge')laneCracks(this.gfx,z.x,z.y,z.angle,z.radius,72,progress,z.fired);
    else groundCracks(this.gfx,z.x,z.y,z.radius,progress,z.angle,z.arc,z.inner,z.fired);
    continue;
   }
   this.gfx.fillStyle(z.fired?0xe0a064:0x8e241b,z.fired?.12:.12+progress*.16);this.area(this.gfx,z);
   this.gfx.lineStyle(z.fired?2:2,z.fired?0xffd29b:0xe87752,z.fired?.7:.85);
   if(z.kind==='charge'){const nx=Math.cos(z.angle),ny=Math.sin(z.angle);for(const side of [-1,1])this.gfx.lineBetween(z.x-ny*side*36,z.y+nx*side*36,z.x+nx*z.radius-ny*side*36,z.y+ny*z.radius+nx*side*36);}
   else {const a=z.angle-z.arc/2,b=z.angle+z.arc/2;this.gfx.beginPath().arc(z.x,z.y,z.radius,a,b).strokePath();if(z.inner)this.gfx.beginPath().arc(z.x,z.y,z.inner,a,b).strokePath();if(z.arc<Math.PI*2)for(const angle of [a,b])this.gfx.lineBetween(z.x+Math.cos(angle)*z.inner,z.y+Math.sin(angle)*z.inner,z.x+Math.cos(angle)*z.radius,z.y+Math.sin(angle)*z.radius);
   if(!z.fired)this.gfx.lineStyle(3,0xf2ad6e,.8).beginPath().arc(z.x,z.y,z.radius,a,a+z.arc*progress).strokePath();}

  }
 }
 private area(g:Phaser.GameObjects.Graphics,z:Hazard):void{
  if(z.kind==='charge'){const nx=Math.cos(z.angle),ny=Math.sin(z.angle),x=z.x,y=z.y,r=z.radius;g.beginPath().moveTo(x-ny*36,y+nx*36).lineTo(x+nx*r-ny*36,y+ny*r+nx*36).lineTo(x+nx*r+ny*36,y+ny*r-nx*36).lineTo(x+ny*36,y-nx*36).closePath().fillPath();return;}
  const steps=Math.max(8,Math.ceil(z.arc*8));for(let i=0;i<steps;i++){const a=z.angle-z.arc/2+z.arc*i/steps,b=z.angle-z.arc/2+z.arc*(i+1)/steps,ax=z.x+Math.cos(a)*z.radius,ay=z.y+Math.sin(a)*z.radius,bx=z.x+Math.cos(b)*z.radius,by=z.y+Math.sin(b)*z.radius,ix=z.x+Math.cos(a)*z.inner,iy=z.y+Math.sin(a)*z.inner,jx=z.x+Math.cos(b)*z.inner,jy=z.y+Math.sin(b)*z.inner;g.fillTriangle(ax,ay,bx,by,ix,iy);if(z.inner)g.fillTriangle(ix,iy,bx,by,jx,jy);}
 }
 /** 去掉土墙素材里大片浅色半透明尘雾（原图在地面上显示为发白方框），保留墙体与深色碎石。 */
 private wallTexture():string{
  const key='zhangbao_earth_wall_clean',s=this.h.scene;if(s.textures.exists(key))return key;
  const src=s.textures.get('zhangbao_earth_wall_spawn').getSourceImage() as HTMLImageElement,c=document.createElement('canvas');c.width=src.width;c.height=src.height;
  const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(src,0,0);const img=ctx.getImageData(0,0,c.width,c.height),d=img.data;
  for(let i=0;i<d.length;i+=4){const a=d[i+3];if(a<235&&d[i]>170&&d[i+1]>150&&d[i+2]>120)d[i+3]=Math.round(a*.12);}
  ctx.putImageData(img,0,0);const tex=s.textures.addCanvas(key,c)!;for(let f=0;f<8;f++)tex.add(f,0,(f%4)*128,Math.floor(f/4)*128,128,128);return key;
 }
 /** 地裂土墙：在玩家身后（相对张宝）围出一道 150° 弧形墙，0.7 秒地面预警后逐段升起，6.5 秒后下沉消失。 */
 private castEarthWall(boss:Enemy,now:number):void{
  const p=this.h.player,away=Math.atan2(p.y-boss.y,p.x-boss.x),radius=118,count=7;
  for(let i=0;i<count;i++){const a=away+(i-(count-1)/2)*(Math.PI*150/180)/(count-1);this.wallPlans.push({x:p.x+Math.cos(a)*radius,y:p.y+Math.sin(a)*radius,rise:now+700+i*70,owner:boss,life:boss.spawnId});}
  this.metrics.casts++;
 }
 private updateEarthWalls(now:number):void{
  const g=this.wallGfx??=this.h.scene.add.graphics().setDepth(DEPTH_WALL_WARN);g.clear();
  for(let i=this.wallPlans.length-1;i>=0;i--){const plan=this.wallPlans[i];
   if(!plan.owner.active||plan.owner.spawnId!==plan.life){this.wallPlans.splice(i,1);continue;}
   if(now<plan.rise){const k=1-(plan.rise-now)/700;g.fillStyle(0x3a2412,.18+.25*k).fillEllipse(plan.x,plan.y+10,56,18);if(TELEGRAPH_CLASSIC)g.lineStyle(2,0xd99a48,.35+.5*k).strokeEllipse(plan.x,plan.y+10,56*(.6+.4*k),18*(.6+.4*k));
    g.lineStyle(1,0x2a1a0c,.6*k).lineBetween(plan.x-18,plan.y+8,plan.x-4,plan.y+13).lineBetween(plan.x-4,plan.y+13,plan.x+9,plan.y+6).lineBetween(plan.x+9,plan.y+6,plan.x+20,plan.y+12);continue;}
   this.wallPlans.splice(i,1);
   const w=this.h.spawn({...ENEMY_DEFS.shield,behavior:'wall',texture:'enemy_shield',walkVisual:undefined,hp:65,speed:0,damage:0,xp:0,radius:24},plan.x,plan.y);
   if(w){w.walkSheet='';w.attackSheet='';w.sprite.setTexture(this.wallTexture(),0).setDisplaySize(86,86).setOrigin(.5,.78);this.walls.push({enemy:w,life:w.spawnId,until:now+6500,born:now});this.metrics.walls++;
    const p=this.h.player,dx=p.x-w.x,dy=p.y-w.y,d=Math.hypot(dx,dy)||1;if(d<p.radius+w.radius+6){p.takeDamage(8,now);p.sprite.x=w.x+dx/d*(p.radius+w.radius+6);p.sprite.y=w.y+dy/d*(p.radius+w.radius+6);}
    this.h.scene.cameras.main.shake(70,.0025);(this.h.scene as unknown as {sfx?:{play(k:string):void}}).sfx?.play('wallRise');}
  }
  for(let i=this.walls.length-1;i>=0;i--){const w=this.walls[i];
   if(!w.enemy.active||w.enemy.spawnId!==w.life||now>=w.until){if(w.enemy.spawnId===w.life)w.enemy.deactivate();this.walls.splice(i,1);continue;}
   // 升起 0~420ms 播 0→7 帧；最后 500ms 反向下沉并淡出。
   const age=now-w.born,left=w.until-now,frame=left<500?Math.max(2,Math.round(7*left/500)):Math.min(7,Math.floor(age/60));
   w.enemy.sprite.setFrame(frame).setAlpha(left<500?.4+.6*left/500:1);
   const p=this.h.player,dx=p.x-w.enemy.x,dy=p.y-w.enemy.y,d=Math.hypot(dx,dy)||1,min=p.radius+w.enemy.radius;if(d<min){p.sprite.x=w.enemy.x+dx/d*min;p.sprite.y=w.enemy.y+dy/d*min;}}
 }
 /** DEV：让首领下一帧立即施放下一个技能。 */
 forceNextSkill():void{this.bossCd=0;}
 clear():void {for(const r of this.rallies)if(r.enemy.spawnId===r.life)r.enemy.def={...r.enemy.def,speed:r.speed};this.rallies.length=0;this.hazards.length=0;this.dash=null;this.gfx.clear();for(const v of this.visuals)v.setVisible(false);for(const w of this.walls)if(w.enemy.spawnId===w.life)w.enemy.deactivate();this.walls.length=0;this.wallPlans.length=0;this.wallGfx?.clear();}
}
