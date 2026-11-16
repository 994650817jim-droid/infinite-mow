import Phaser from 'phaser';
import{warnCircle,TELEGRAPH_CLASSIC,laneCracks}from'../ui/Telegraph';
import type {Enemy} from '../entities/Enemy';
import type {Player} from '../entities/Player';
import type {Legion} from './Legion';
interface Host {scene:Phaser.Scene;boss:Enemy;player:Player;army:Legion;spawn:(kind:'infantry'|'cavalry',x:number,y:number)=>Enemy|null;sfx:()=>void;}
interface Lane{x:number;y:number;angle:number;at:number;end:number;seen:Set<string>;image:Phaser.GameObjects.Image;}
interface Rain{x:number;y:number;at:number;done:boolean;}
export class XurongBoss{
 state='approach';phase2=false;private next=0;private until=0;private order=0;private hurtAt=0;private deadAge=0;private corpse?:Phaser.GameObjects.Image;
 private lanes:Lane[]=[];private rain:Rain[]=[];private g:Phaser.GameObjects.Graphics;
 readonly metrics={raids:0,rains:0,ambushes:0,enrages:0};
 constructor(private h:Host,now:number){this.next=now+1800;this.g=h.scene.add.graphics().setDepth(40);}
 get label():string{return this.state==='dead'?'徐荣败退':this.state==='command'?'两翼伏兵 · 注意路线':this.phase2?'伏击合围 · 骑袭与箭雨':'荥阳统军 · 预警后躲避';}
 hit(now:number):void{this.hurtAt=now+120;}
 private raid(now:number):void{const p=this.h.player;for(const side of [-1,1])this.lanes.push({x:p.x+side*260,y:p.y-65,angle:Math.atan2(80,-side*520),at:now+900,end:now+2400,seen:new Set(),image:this.h.scene.add.image(0,0,'xiliang_cavalry_walk',0).setOrigin(.5,.875).setDisplaySize(80,80).setDepth(40).setVisible(false)});this.metrics.raids++;}
 private arrows(now:number):void{const p=this.h.player;for(let i=0;i<3;i++)this.rain.push({x:p.x+(i-1)*105,y:p.y+(i%2?90:-15),at:now+1100+i*120,done:false});this.metrics.rains++;}
 private ambush():void{const p=this.h.player;for(const side of [-1,1])for(let i=0;i<3;i++)this.h.spawn(i===0?'cavalry':'infantry',p.x+side*(230+i*22),p.y+80+i*34);this.metrics.ambushes++;}
 private area(x:number,y:number,r:number,d:number,now:number):void{const p=this.h.player;if(Math.hypot(p.x-x,p.y-y)<=r+p.radius)p.takeDamage(d,now);this.h.army.hurtArea(x,y,r,d,now);}
 update(dt:number,now:number):void{const {boss:b,player:p}=this.h;if(!b.active||this.state==='dead')return;this.g.clear();if(!this.phase2&&b.hp<b.maxHp*.5){this.phase2=true;this.metrics.enrages++;this.next=Math.min(this.next,now+500);}
 const dx=p.x-b.x,dy=p.y-b.y,d=Math.hypot(dx,dy)||1,dir=Math.abs(dx)>Math.abs(dy)?dx<0?1:2:dy<0?3:0;
 if(now>=this.next&&this.state==='approach'){this.state='command';this.until=now+850;this.order++;if(this.phase2){this.raid(now);this.arrows(now);if(this.order%2===0)this.ambush();}else if(this.order%3===1)this.raid(now);else if(this.order%3===2)this.arrows(now);else this.ambush();this.next=now+(this.phase2?3900:5200);this.h.sfx();}
 if(this.state==='command'&&now>=this.until)this.state='approach';if(this.state==='approach'&&d>165){b.sprite.x+=dx/d*b.def.speed*dt;b.sprite.y+=dy/d*b.def.speed*dt;}
 const frame=now<this.hurtAt?24:this.state==='command'?20+Math.floor(now/150)%4:d<85?16+Math.floor(now/150)%4:dir*4+(d>165?Math.floor(now/120)%4:0);
 b.sprite.setTexture('xurong',frame).setOrigin(.5,114/128).setDisplaySize(140,140).setFlipX(false);
 for(const l of this.lanes){const c=Math.cos(l.angle),n=Math.sin(l.angle);if(now<l.at){if(TELEGRAPH_CLASSIC){this.g.lineStyle(2,0xf3bd67,.95);for(const s of [-1,1])this.g.lineBetween(l.x-n*s*24,l.y+c*s*24,l.x+c*520-n*s*24,l.y+n*520+c*s*24);}else laneCracks(this.g,l.x,l.y,l.angle,520,48,1-(l.at-now)/900);}else if(now<=l.end){const t=Math.min(520,(now-l.at)*.4),old=Math.max(0,t-Math.max(10,dt*400)),x=l.x+c*t,y=l.y+n*t;l.image.setVisible(true).setPosition(x,y).setFrame((c<0?4:8)+Math.floor(now/90)%4);this.g.fillStyle(0x9f5939,.5).fillCircle(x,y,22).lineStyle(5,0xe2b077,.85).lineBetween(x-c*40,y-n*40,x,y);const hit=(px:number,py:number,r:number)=>{const vx=px-l.x,vy=py-l.y,a=vx*c+vy*n;return a>=old-r&&a<=t+r&&Math.abs(-vx*n+vy*c)<=24+r;};if(!l.seen.has('p')&&hit(p.x,p.y,p.radius)){l.seen.add('p');p.takeDamage(16,now);}for(const u of this.h.army.units){const key=u.id+':'+u.lifeId;if(u.active&&!l.seen.has(key)&&hit(u.x,u.y,u.radius)){l.seen.add(key);this.h.army.hurtByBoss(u,16,now);}}}}
 for(const l of this.lanes)if(now>=l.end)l.image.destroy();this.lanes=this.lanes.filter(l=>now<l.end);
 for(const r of this.rain){if(now<r.at)warnCircle(this.g,r.x,r.y,58,1-(r.at-now)/900,0xb6412d,0xf1bd72,false,now,'arrows');else{if(!r.done){r.done=true;this.area(r.x,r.y,58,14,now);}if(now<r.at+350){this.g.lineStyle(2,0xd6c1a0,.9);for(let i=0;i<9;i++){const a=i*2.4,rr=(i%3)*16;const x=r.x+Math.cos(a)*rr,y=r.y+Math.sin(a)*rr;this.g.lineBetween(x-7,y-25,x,y);}}}}
 this.rain=this.rain.filter(r=>now<r.at+350);
 }
 defeat():void{this.state='dead';this.clear();this.corpse=this.h.scene.add.image(this.h.boss.x,this.h.boss.y,'xurong',25).setOrigin(.5,114/128).setDisplaySize(140,140).setDepth(38);}
 updateDeath(delta:number):void{if(this.corpse){this.deadAge+=delta;this.corpse.setFrame(25+Math.min(2,Math.floor(this.deadAge/180)));}}
 clear():void{for(const l of this.lanes)l.image.destroy();this.lanes=[];this.rain=[];this.g.clear();}
}
