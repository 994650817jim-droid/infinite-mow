import { meleeReach } from '../data/bossReach';
/** 破军横扫半径（贴身近战：原 145 × BOSS_MELEE_REACH_MUL，预警、命中、刀光同一个值）。 */
const SWEEP_R = meleeReach(145);
import Phaser from 'phaser';
import type {Enemy} from '../entities/Enemy';
import type {Player} from '../entities/Player';
import type {Legion} from './Legion';
import {TELEGRAPH_CLASSIC,groundCracks,laneCracks,windupFlash} from '../ui/Telegraph';
import {HINT_MOCK} from '../ui/HintStyle';import {warnFx} from '../ui/WarnFx';
type State='approach'|'sweepWarn'|'sweep'|'chargeWarn'|'charge'|'recover'|'enrage'|'slamWarn'|'slam'|'dead';
interface Host {scene:Phaser.Scene;boss:Enemy;player:Player;army:Legion;hurtTroops:(x:number,y:number,r:number,d:number,now:number,a?:number,arc?:number)=>void;sfx:()=>void;}
/** Combat-clock melee boss, no independent combat timers. */
export class HuaxiongBoss {
  state:State='approach';phase2=false;
  private until=0;private started=0;private nextSweep=1800;private nextCharge=5000;
  private nextSlam=8000;private waveVictims=new Set<string>();private angle=0;private x=0;private y=0;private travelled=0;private applied=false;private hurtUntil=0;private deathAge=0;
  private readonly gfx:Phaser.GameObjects.Graphics;private readonly slash:Phaser.GameObjects.Image;private corpse?:Phaser.GameObjects.Image;
  private readonly chargeVictims=new Set<string>();
  readonly metrics={sweeps:0,charges:0,enrages:0,impacts:0,slams:0};
  constructor(private h:Host,now:number){this.nextSlam+=now;this.nextSweep+=now;this.nextCharge+=now;this.gfx=h.scene.add.graphics().setDepth(39);this.slash=h.scene.add.image(0,0,'huaxiong_sweep',0).setDepth(40).setVisible(false);}
  get label():string{return {approach:'华雄追击',sweepWarn:'横扫蓄力 · 离开扇形',sweep:'破军横扫',chargeWarn:'冲锋锁定 · 侧向躲避',charge:'铁甲冲锋',recover:'收势 · 反击机会',enrage:'半血狂暴',dead:'华雄败退',slamWarn:'裂地重斩 · 离开金线',slam:'裂地冲击'}[this.state];}
  hit(now:number):void{this.hurtUntil=now+100;}
  private enter(state:State,now:number,duration:number):void{this.state=state;this.started=now;this.until=now+duration;this.applied=false;}
  private aim():void{const b=this.h.boss,p=this.h.player;this.angle=Math.atan2(p.y-b.y,p.x-b.x);this.x=b.x;this.y=b.y;}
  private pose(key:string,frame:number):void{this.h.boss.sprite.setTexture(key,frame).setOrigin(.5,114/128).setDisplaySize(140,140).setFlipX(false);}
  private impact(now:number,r:number,damage:number,arc=Math.PI*2):void{
    const b=this.h.boss,p=this.h.player,d=Math.hypot(p.x-b.x,p.y-b.y);
    if(d<=r+p.radius&&(arc===Math.PI*2||Math.cos(Math.atan2(p.y-b.y,p.x-b.x)-this.angle)>=Math.cos(arc/2)))p.takeDamage(damage,now);
    this.h.hurtTroops(b.x,b.y,r,damage,now,this.angle,arc);this.metrics.impacts++;
  }
  private lockedDir():number{return Math.abs(Math.cos(this.angle))>Math.abs(Math.sin(this.angle))?Math.cos(this.angle)<0?1:2:Math.sin(this.angle)<0?3:0;}
  private now=0;private slamArt=false;
  private fxOn():boolean{return !TELEGRAPH_CLASSIC&&HINT_MOCK==='c';}
  private strip(from:number,to:number,width:number,color:number,alpha:number):void {const c=Math.cos(this.angle),n=Math.sin(this.angle),w=width/2;
    // 低调预警（默认）：不画填色长条与描边，改为沿刀路的地裂纹（预警时随蓄力加深，落下 / 冲击波时到头）
    if(!TELEGRAPH_CLASSIC&&!this.state.endsWith('Warn')&&this.slamArt)return;// 斩下后（含二阶段冲击波）由裂地命中图表现，不再逐帧画
    if(!TELEGRAPH_CLASSIC){const warn=this.state.endsWith('Warn'),p=warn?Math.min(1,Math.max(0,(this.now-this.started)/Math.max(1,this.until-this.started))):1;laneCracks(this.gfx,this.x+c*from,this.y+n*from,this.angle,to-from,width,p,!warn);return;}this.gfx.fillStyle(color,alpha).lineStyle(2,0xf3c778,.9).beginPath().moveTo(this.x+c*from-n*w,this.y+n*from+c*w).lineTo(this.x+c*to-n*w,this.y+n*to+c*w).lineTo(this.x+c*to+n*w,this.y+n*to-c*w).lineTo(this.x+c*from+n*w,this.y+n*from-c*w).closePath().fillPath().strokePath();}
  private lineHit(from:number,to:number,width:number,damage:number,now:number,seen:Set<string>):void {const c=Math.cos(this.angle),n=Math.sin(this.angle);const inside=(x:number,y:number,r:number)=>{const dx=x-this.x,dy=y-this.y,a=dx*c+dy*n;return a>=from-r&&a<=to+r&&Math.abs(-dx*n+dy*c)<=width/2+r;};const p=this.h.player;if(!seen.has('p')&&inside(p.x,p.y,p.radius)){seen.add('p');p.takeDamage(damage,now);}for(const a of this.h.army.units){const k=a.id+':'+a.lifeId;if(a.active&&!seen.has(k)&&inside(a.x,a.y,a.radius)){seen.add(k);this.h.army.hurtByBoss(a,damage,now);}}}
  update(dt:number,now:number):void{
    const b=this.h.boss,p=this.h.player;if(!b.active||this.state==='dead')return;this.now=now;this.gfx.clear();this.slash.setVisible(false);
    if(!this.phase2&&b.hp<=b.maxHp*.5){this.phase2=true;this.metrics.enrages++;this.enter('enrage',now,600);}
    const dx=p.x-b.x,dy=p.y-b.y,d=Math.hypot(dx,dy)||1;
    const dir=Math.abs(dx)>Math.abs(dy)?dx<0?1:2:dy<0?3:0;
    if(this.state==='approach'){
      if(now>=this.nextSlam){this.aim();this.enter('slamWarn',now,650);}
      else if(now>=this.nextCharge&&d>125){this.aim();this.enter('chargeWarn',now,800);}
      else if(now>=this.nextSweep&&d<175){this.aim();this.enter('sweepWarn',now,this.phase2?550:750);}
      else{if(d>85){b.sprite.x+=dx/d*b.def.speed*(this.phase2?1.15:1)*dt;b.sprite.y+=dy/d*b.def.speed*(this.phase2?1.15:1)*dt;}this.pose('huaxiong_walk',dir*4+(d>85?Math.floor(now/110)%4:0));if(now<this.hurtUntil)this.pose('huaxiong_actions',4);}
    }
    if(this.state==='slamWarn'){
      this.pose('huaxiong_attack',this.lockedDir()*4+(now-this.started>=450?1:0));
      // 特效型警示（默认）：刀路上碎石跳动、地缝透光；缺图时照旧
      if(!(this.fxOn()&&warnFx(this.h.scene).warn('hx-slam','rift',this.x,this.y,220,(now-this.started)/Math.max(1,this.until-this.started),now,this.angle)))this.strip(0,220,44,0xe9bd70,.22);if(!TELEGRAPH_CLASSIC)windupFlash(b,now);
      if(now>=this.until){this.enter('slam',now,this.phase2?1000:400);this.metrics.slams++;this.slamArt=this.fxOn()&&warnFx(this.h.scene).impact('rift',this.x,this.y,220,this.angle);this.waveVictims.clear();this.h.sfx();this.lineHit(0,220,44,18,now,new Set());this.applied=true;}
    }else if(this.state==='slam'){
      this.pose('huaxiong_attack',this.lockedDir()*4+2);const age=now-this.started;
      this.strip(0,220,44,0x4f3024,.65);
      if(age<360&&!this.slamArt)for(let i=0;i<8;i++){const t=24+i*25,spread=(i%2?1:-1)*(6+age*.035),px=this.x+Math.cos(this.angle)*t-Math.sin(this.angle)*spread,py=this.y+Math.sin(this.angle)*t+Math.cos(this.angle)*spread;this.gfx.fillStyle(0xb59a74,(1-age/360)*.45).fillCircle(px,py,5+age*.014).fillStyle(0x765b40,1-age/360).fillRect(px-2,py-2-Math.sin(age/360*Math.PI)*12,4,4);}
      if(!this.slamArt)for(let i=1;i<=7;i++){const t=i*29;this.gfx.lineStyle(2,0xd1aa76,.8).lineBetween(this.x+Math.cos(this.angle)*t,this.y+Math.sin(this.angle)*t,this.x+Math.cos(this.angle)*t-Math.sin(this.angle)*(i%2?11:-11),this.y+Math.sin(this.angle)*t+Math.cos(this.angle)*(i%2?11:-11));}
      if(!this.applied){this.applied=true;this.lineHit(0,220,44,18,now,new Set());}
      if(this.phase2&&age>=200){const front=Math.min(180,(age-200)*.36),back=Math.max(0,front-Math.max(12,dt*360));this.strip(back,front+12,70,0xc59a67,.7);this.lineHit(back,front+12,70,12,now,this.waveVictims);}
      if(now>=this.until){this.nextSlam=now+8000;this.enter('recover',now,450);}
    }else if(this.state==='sweepWarn'){

      this.pose('huaxiong_attack',dir*4+Math.min(1,Math.floor((now-this.started)/300)));
      if(TELEGRAPH_CLASSIC)this.gfx.lineStyle(2,0xf4c47a,.9).fillStyle(0xa64729,.18).slice(this.x,this.y,SWEEP_R,this.angle-Math.PI/3,this.angle+Math.PI/3).fillPath().strokePath();
      else{groundCracks(this.gfx,this.x,this.y,SWEEP_R,(now-this.started)/Math.max(1,this.until-this.started),this.angle,Math.PI*2/3);windupFlash(b,now);}
      if(now>=this.until){this.enter('sweep',now,300);this.metrics.sweeps++;this.h.sfx();}
    }else if(this.state==='sweep'){
      this.pose('huaxiong_attack',dir*4+2);this.slash.setPosition(this.x,this.y).setRotation(this.angle).setDisplaySize(SWEEP_R*2,SWEEP_R*2).setFrame(Math.min(7,Math.floor((now-this.started)/38))).setVisible(true);
      if(!this.applied){this.applied=true;this.impact(now,SWEEP_R,this.phase2?20:16,Math.PI*2/3);}
      if(now>=this.until){this.nextSweep=now+(this.phase2?1600:2200);this.enter('recover',now,500);}
    }else if(this.state==='chargeWarn'){
      this.pose('huaxiong_attack',dir*4+1);const nx=Math.cos(this.angle),ny=Math.sin(this.angle);
      if(TELEGRAPH_CLASSIC){this.gfx.lineStyle(2,0xf4c47a,.95);for(const side of [-1,1])this.gfx.lineBetween(this.x-ny*side*30,this.y+nx*side*30,this.x+nx*340-ny*side*30,this.y+ny*340+nx*side*30);}
      else{laneCracks(this.gfx,this.x,this.y,this.angle,340,60,(now-this.started)/Math.max(1,this.until-this.started));windupFlash(b,now);}
      if(now>=this.until){this.travelled=0;this.chargeVictims.clear();this.enter('charge',now,900);this.metrics.charges++;}
    }else if(this.state==='charge'){
      const step=Math.min(340-this.travelled,(this.phase2?460:390)*dt),ox=b.x,oy=b.y;b.sprite.x+=Math.cos(this.angle)*step;b.sprite.y+=Math.sin(this.angle)*step;this.travelled+=step;
      const horizontal=Math.abs(Math.cos(this.angle))>.6;if(horizontal){this.pose('huaxiong_actions',1+Math.floor(now/90)%2);b.sprite.setFlipX(Math.cos(this.angle)<0);}else this.pose('huaxiong_walk',dir*4+Math.floor(now/75)%4);
      const line=new Phaser.Geom.Line(ox,oy,b.x,b.y);if(!this.applied&&Phaser.Geom.Intersects.LineToCircle(line,new Phaser.Geom.Circle(p.x,p.y,p.radius+30))){p.takeDamage(18,now);this.applied=true;}
      for(const u of this.h.army.units){const key=u.id+':'+u.lifeId;if(u.active&&!this.chargeVictims.has(key)&&Phaser.Geom.Intersects.LineToCircle(line,new Phaser.Geom.Circle(u.x,u.y,u.radius+30))){this.chargeVictims.add(key);this.h.army.hurtByBoss(u,18,now);}}
      this.gfx.lineStyle(2,0xb3814e,.35).lineBetween(b.x-Math.cos(this.angle)*60,b.y-Math.sin(this.angle)*60,b.x,b.y);
      if(this.travelled>=340||now>=this.until){b.sprite.setFlipX(false);this.nextCharge=now+6500;this.enter('recover',now,650);}
    }else if(this.state==='recover'){b.sprite.setFlipX(false);this.pose('huaxiong_attack',dir*4+3);if(now>=this.until)this.enter('approach',now,0);}
    else if(this.state==='enrage'){this.pose('huaxiong_actions',6+Math.floor((now-this.started)/150)%2);if(TELEGRAPH_CLASSIC)this.gfx.lineStyle(2,0xb66035,.65).strokeCircle(b.x,b.y,45+8*Math.sin(now/100));else windupFlash(b,now);if(now>=this.until)this.enter('approach',now,0);}
  }
  defeat():void{this.state='dead';this.gfx.clear();this.slash.setVisible(false);this.corpse=this.h.scene.add.image(this.h.boss.x,this.h.boss.y,'huaxiong_actions',8).setDisplaySize(140,140).setOrigin(.5,114/128).setDepth(38);}
  updateDeath(delta:number):void{if(this.corpse){this.deathAge+=delta;this.corpse.setFrame(8+Math.min(3,Math.floor(this.deathAge/180)));}}
  clear():void{this.gfx.clear();this.slash.setVisible(false);}
}

