import Phaser from 'phaser';
import{warnCircle,TELEGRAPH_CLASSIC,laneCracks}from'../ui/Telegraph';
import{HINT_MOCK}from'../ui/HintStyle';import{warnFx,type WarnFx}from'../ui/WarnFx';
import type {Enemy} from '../entities/Enemy';
import { castFlourish, warmCast } from './BossThemeFx';
/** 突骑的帧（2026-11-19 全面检查：西凉骑兵图换成 ArtStyle v2 具名帧后，原来的数字帧 0 / 4 / 8 取不到，画出整张图集）。i = null 站定，否则冲锋两帧交替；旧图（数字帧，每行 4 帧）照旧。 */
const riderFrame=(img:Phaser.GameObjects.Image,left:boolean,i:number|null):string|number=>img.texture.has('left_stand')?(i===null?(left?'left_stand':'right_stand'):`chg_${left?'left':'right'}_${i%2}`):(left?4:8)+(i??0)%4;
import type {Player} from '../entities/Player';
import type {Legion} from './Legion';
interface Host {scene:Phaser.Scene;boss:Enemy;player:Player;army:Legion;spawn:(kind:'infantry'|'cavalry',x:number,y:number)=>Enemy|null;sfx:()=>void;}
interface Lane{x:number;y:number;angle:number;at:number;end:number;seen:Set<string>;image:Phaser.GameObjects.Image;}
interface Rain{x:number;y:number;at:number;done:boolean;}
export class XurongBoss{
 state='approach';phase2=false;private next=0;private until=0;private order=0;private hurtAt=0;private deadAge=0;private corpse?:Phaser.GameObjects.Image;
 private lanes:Lane[]=[];private rain:Rain[]=[];
 /** 号令节奏：前 0.3 秒抬手（起手），之后挥令（下令）——骑袭预警、箭影、伏兵都从下令这一刻才出现；伤害时间点不变。 */
 private cmdAt=0;private signaled=true;private pendingAmbush=false;private static readonly SIGNAL=300;private g:Phaser.GameObjects.Graphics;
 readonly metrics={raids:0,rains:0,ambushes:0,enrages:0};
 constructor(private h:Host,now:number){ warmCast(h.scene, 'xurong');this.next=now+1800;this.g=h.scene.add.graphics().setDepth(40);}
 get label():string{return this.state==='dead'?'徐荣败退':this.state==='command'?'两翼伏兵 · 注意路线':this.phase2?'伏击合围 · 骑袭与箭雨':'荥阳统军 · 预警后躲避';}
 hit(now:number):void{this.hurtAt=now+120;}
 /** 徐荣专属特效（伏兵起 / 乱箭斜落 / 疾影尘线）；缺图或旧样式时为 null，走原来的画法。 */
 private fx():WarnFx|null{const f=warnFx(this.h.scene);return !TELEGRAPH_CLASSIC&&HINT_MOCK==='c'&&f.hasXurong()?f:null;}
 private raid(now:number):void{const p=this.h.player;for(const side of [-1,1])this.lanes.push({x:p.x+side*260,y:p.y-65,angle:Math.atan2(80,-side*520),at:now+900,end:now+2400,seen:new Set(),image:this.h.scene.add.image(0,0,'xiliang_cavalry_walk').setOrigin(.5,.875).setDisplaySize(80,80).setDepth(40).setVisible(false)});this.metrics.raids++;}
 private arrows(now:number):void{const p=this.h.player;for(let i=0;i<3;i++)this.rain.push({x:p.x+(i-1)*105,y:p.y+(i%2?90:-15),at:now+1100+i*120,done:false});this.metrics.rains++;}
 private ambush():void{const p=this.h.player,f=this.fx();for(const side of [-1,1])for(let i=0;i<3;i++){const x=p.x+side*(230+i*22),y=p.y+80+i*34;f?.ambush(x,y+6,i===0?120:100);/* 伏兵从草丛里起身：旗影先竖起，人随后 0.3 秒淡入 */const e=this.h.spawn(i===0?'cavalry':'infantry',x,y);if(e&&f){e.sprite.setAlpha(0);this.h.scene.tweens.add({targets:e.sprite,alpha:1,delay:90,duration:300});}}this.metrics.ambushes++;}
 private area(x:number,y:number,r:number,d:number,now:number):void{const p=this.h.player;if(Math.hypot(p.x-x,p.y-y)<=r+p.radius)p.takeDamage(d,now);this.h.army.hurtArea(x,y,r,d,now);}
 update(dt:number,now:number):void{const {boss:b,player:p}=this.h;if(!b.active||this.state==='dead')return;this.g.clear();if(!this.phase2&&b.hp<b.maxHp*.5){this.phase2=true;this.metrics.enrages++;this.next=Math.min(this.next,now+500);}
 const dx=p.x-b.x,dy=p.y-b.y,d=Math.hypot(dx,dy)||1,dir=Math.abs(dx)>Math.abs(dy)?dx<0?1:2:dy<0?3:0;
 if(now>=this.next&&this.state==='approach'){this.state='command';this.until=now+850;this.order++;castFlourish(this.h.scene,'xurong',b,850,this.phase2);/* 起手：尘土蓄力光，二阶段再加脚下法阵 */this.cmdAt=now;this.signaled=false;if(this.phase2){this.raid(now);this.arrows(now);if(this.order%2===0)this.pendingAmbush=true;}else if(this.order%3===1)this.raid(now);else if(this.order%3===2)this.arrows(now);else this.pendingAmbush=true;this.next=now+(this.phase2?3900:5200);this.h.sfx();}
 // 下令：伏兵从草里起身、两翼伏骑旗影一闪
 if(!this.signaled&&now>=this.cmdAt+XurongBoss.SIGNAL){this.signaled=true;if(this.pendingAmbush){this.pendingAmbush=false;this.ambush();}const f=this.fx();if(f)for(const l of this.lanes)if(l.at>now)f.ambush(l.x,l.y,130);}
 if(this.state==='command'&&now>=this.until)this.state='approach';if(this.state==='approach'&&d>165){b.sprite.x+=dx/d*b.def.speed*dt;b.sprite.y+=dy/d*b.def.speed*dt;}
 const cmdAge=now-this.cmdAt,frame=now<this.hurtAt?24:this.state==='command'?(cmdAge<150?20:cmdAge<XurongBoss.SIGNAL?21:22+Math.floor(cmdAge/150)%2):d<85?16+Math.floor(now/150)%4:dir*4+(d>165?Math.floor(now/120)%4:0);
 b.sprite.setTexture('xurong',frame).setOrigin(.5,114/128).setDisplaySize(140,140).setFlipX(false);
 const hold=!this.signaled;// 下令前不显示预警
 for(const l of this.lanes){const c=Math.cos(l.angle),n=Math.sin(l.angle);if(now<l.at&&hold)continue;if(now<l.at){/* 骑兵先在起点淡入、朝冲锋方向站定 */l.image.setVisible(true).setPosition(l.x,l.y).setFrame(riderFrame(l.image,c<0,null)).setAlpha(Math.min(1,(now-this.cmdAt-XurongBoss.SIGNAL)/250));if(TELEGRAPH_CLASSIC){this.g.lineStyle(2,0xf3bd67,.95);for(const s of [-1,1])this.g.lineBetween(l.x-n*s*24,l.y+c*s*24,l.x+c*520-n*s*24,l.y+n*520+c*s*24);}else laneCracks(this.g,l.x,l.y,l.angle,520,48,1-(l.at-now)/900);}else if(now<=l.end){const t=Math.min(520,(now-l.at)*.4),old=Math.max(0,t-Math.max(10,dt*400)),x=l.x+c*t,y=l.y+n*t;l.image.setVisible(true).setAlpha(1).setPosition(x,y).setFrame(riderFrame(l.image,c<0,Math.floor(now/90)));/* 疾影尘线（缺图时退回原来的尘圈 + 尘线） */if(!this.fx()?.streak('xr-s'+Math.round(l.x)+','+Math.round(l.y),x,y,l.angle,now,l.image))this.g.fillStyle(0x9f5939,.5).fillCircle(x,y,22).lineStyle(5,0xe2b077,.85).lineBetween(x-c*40,y-n*40,x,y);const hit=(px:number,py:number,r:number)=>{const vx=px-l.x,vy=py-l.y,a=vx*c+vy*n;return a>=old-r&&a<=t+r&&Math.abs(-vx*n+vy*c)<=24+r;};if(!l.seen.has('p')&&hit(p.x,p.y,p.radius)){l.seen.add('p');p.takeDamage(16,now);}for(const u of this.h.army.units){const key=u.id+':'+u.lifeId;if(u.active&&!l.seen.has(key)&&hit(u.x,u.y,u.radius)){l.seen.add(key);this.h.army.hurtByBoss(u,16,now);}}}}
 for(const l of this.lanes)if(now>=l.end)l.image.destroy();this.lanes=this.lanes.filter(l=>now<l.end);
 const vf=this.fx();
 for(const r of this.rain){if(now<r.at&&hold)continue;if(now<r.at){warnCircle(this.g,r.x,r.y,58,1-(r.at-now)/900,0xb6412d,0xf1bd72,false,now,'arrows');/* 乱箭从左上斜落，最后 0.45 秒飞到落点 */if(vf&&r.at-now<450)vf.volley('xr-v'+Math.round(r.x)+','+Math.round(r.y),r.x,r.y,58,1-(r.at-now)/450,now);}else{if(!r.done){r.done=true;this.area(r.x,r.y,58,14,now);if(vf)vf.shapeImpact('xr-hit'+Math.round(r.x)+','+Math.round(r.y)+','+Math.round(r.at),'arrows',r.x,r.y,58,0,now);}if(now<r.at+350&&!vf){this.g.lineStyle(2,0xd6c1a0,.9);for(let i=0;i<9;i++){const a=i*2.4,rr=(i%3)*16;const x=r.x+Math.cos(a)*rr,y=r.y+Math.sin(a)*rr;this.g.lineBetween(x-7,y-25,x,y);}}}}
 this.rain=this.rain.filter(r=>now<r.at+350);
 }
 defeat():void{this.state='dead';this.clear();this.corpse=this.h.scene.add.image(this.h.boss.x,this.h.boss.y,'xurong',25).setOrigin(.5,114/128).setDisplaySize(140,140).setDepth(38);}
 updateDeath(delta:number):void{if(this.corpse){this.deadAge+=delta;this.corpse.setFrame(25+Math.min(2,Math.floor(this.deadAge/180)));}}
 clear():void{for(const l of this.lanes)l.image.destroy();this.lanes=[];this.rain=[];this.g.clear();}
}
