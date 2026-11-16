import Phaser from 'phaser';
import { softField } from './SoftField';
import { SHOW_OWN_RANGE_FX } from '../ui/HintStyle';
import type { WeaponHost } from '../weapons/registry';

interface FireFx {decal:Phaser.GameObjects.Image;glow:Phaser.GameObjects.Image;flames:Phaser.GameObjects.Particles.ParticleEmitter;sparks:Phaser.GameObjects.Particles.ParticleEmitter;smoke:Phaser.GameObjects.Particles.ParticleEmitter;}
interface Field {x:number;y:number;r:number;damage:number;end:number;next:number;level:number;formation:boolean;gfx:Phaser.GameObjects.Graphics;fire?:FireFx;aura?:Phaser.GameObjects.Image;}
/** 烽火燎原残火用的程序贴图：焦土、暖光、火舌、火星（按需生成一次）。 */
function ensureFireTextures(scene:Phaser.Scene):void{
  const make=(key:string,w:number,h:number,draw:(g:CanvasRenderingContext2D)=>void)=>{if(scene.textures.exists(key))return;const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d')!);scene.textures.addCanvas(key,c);};
  make('wf_scorch',256,256,g=>{const r=g.createRadialGradient(128,128,8,128,128,128);r.addColorStop(0,'rgba(24,10,4,.85)');r.addColorStop(.55,'rgba(40,16,6,.55)');r.addColorStop(.8,'rgba(60,24,8,.22)');r.addColorStop(1,'rgba(60,24,8,0)');g.fillStyle=r;g.fillRect(0,0,256,256);
    // 焦痕斑驳
    for(let i=0;i<70;i++){const a=Math.random()*Math.PI*2,d=Math.random()*100,x=128+Math.cos(a)*d,y=128+Math.sin(a)*d,s=4+Math.random()*14;g.fillStyle=`rgba(12,6,3,${.15+Math.random()*.25})`;g.beginPath();g.ellipse(x,y,s,s*.6,Math.random()*3,0,Math.PI*2);g.fill();}
    for(let i=0;i<26;i++){const a=Math.random()*Math.PI*2,d=Math.random()*80,x=128+Math.cos(a)*d,y=128+Math.sin(a)*d;const e=g.createRadialGradient(x,y,0,x,y,5);e.addColorStop(0,'rgba(255,150,60,.9)');e.addColorStop(1,'rgba(255,90,20,0)');g.fillStyle=e;g.fillRect(x-5,y-5,10,10);}});
  make('wf_glow',128,128,g=>{const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,170,70,.75)');r.addColorStop(.45,'rgba(240,100,30,.35)');r.addColorStop(1,'rgba(200,50,10,0)');g.fillStyle=r;g.fillRect(0,0,128,128);});
  make('wf_flame',28,80,g=>{
    // 火舌：细长、顶端弯曲的尖，底部宽；外焰橙红、内焰黄白
    const path=(k:number)=>{g.beginPath();g.moveTo(16,2);g.bezierCurveTo(20*k+6,20,26,40,24,58);g.bezierCurveTo(23,72,18,78,14,78);g.bezierCurveTo(9,78,4,72,4,60);g.bezierCurveTo(3,44,10,30,12,18);g.bezierCurveTo(13,12,15,7,16,2);g.closePath();};
    g.filter='blur(1.6px)';const o=g.createLinearGradient(0,0,0,80);o.addColorStop(0,'rgba(255,80,20,0)');o.addColorStop(.25,'rgba(255,90,25,.75)');o.addColorStop(.7,'rgba(255,140,40,.95)');o.addColorStop(1,'rgba(255,170,60,.9)');g.fillStyle=o;path(1);g.fill();
    g.filter='blur(2.2px)';const i=g.createLinearGradient(0,30,0,80);i.addColorStop(0,'rgba(255,230,140,0)');i.addColorStop(.55,'rgba(255,236,170,.85)');i.addColorStop(1,'rgba(255,250,225,1)');g.fillStyle=i;g.beginPath();g.ellipse(14,62,6,16,0,0,Math.PI*2);g.fill();});
  make('wf_smoke',64,64,g=>{const r=g.createRadialGradient(32,32,2,32,32,32);r.addColorStop(0,'rgba(40,32,28,.55)');r.addColorStop(.6,'rgba(30,24,20,.25)');r.addColorStop(1,'rgba(30,24,20,0)');g.fillStyle=r;g.fillRect(0,0,64,64);});
  make('wf_spark',8,8,g=>{const r=g.createRadialGradient(4,4,0,4,4,4);r.addColorStop(0,'rgba(255,245,200,1)');r.addColorStop(.5,'rgba(255,170,60,.8)');r.addColorStop(1,'rgba(255,100,20,0)');g.fillStyle=r;g.fillRect(0,0,8,8);});
}
/** Bounded, combat-clock fields. No timers survive a restart; burn cooldowns use spawn IDs. */
export class MartialFields {
  private fields:Field[]=[];
  private burns=new Map<number,number>();
  constructor(private host:WeaponHost) {}
  add(x:number,y:number,r:number,damage:number,duration:number,level:number,formation=false):void {
    if(this.fields.length>=6){const old=this.fields.shift()!;old.gfx.destroy();old.aura?.destroy();if(old.fire)this.fadeFire(old.fire);}
    const gfx=this.host.add.graphics().setDepth(19);
    let fire:FireFx|undefined,aura:Phaser.GameObjects.Image|undefined;
    // 八阵：柔和青绿光晕（原为硬描边圆 + 8 道刻度，用户反馈难看）
    if(formation){if(SHOW_OWN_RANGE_FX)aura=softField((this.host.add as unknown as {scene:Phaser.Scene}).scene,x,y,r,0x7fc4a4,.45);} // 只保留关键提示（默认）：八阵不画光晕
    else fire=this.spawnFire(x,y,r,level);
    this.fields.push({x,y,r,damage,end:this.host.combatNow+duration,next:this.host.combatNow+500,level,formation,gfx,fire,aura});
  }
  /** 烽火燎原残火：焦土 + 暖光（明暗跳动）+ 区域内持续窜起的火舌与火星；等级越高火越旺。 */
  private spawnFire(x:number,y:number,r:number,level:number):FireFx{
    const add=this.host.add;ensureFireTextures((add as unknown as {scene:Phaser.Scene}).scene);
    const decal=add.image(x,y+r*.08,'wf_scorch').setDisplaySize(r*2.3,r*1.7).setDepth(18.5).setAlpha(0);
    const glow=add.image(x,y,'wf_glow').setDisplaySize(r*2.6,r*2.0).setDepth(19).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    const ell=new Phaser.Geom.Ellipse(0,0,r*1.7,r*1.25),zone={type:'random' as const,source:{getRandomPoint:(p:Phaser.Types.Math.Vector2Like)=>Phaser.Geom.Ellipse.Random(ell,p as Phaser.Geom.Point)}};
    // 火舌：小而密、细长上窜；外圈稀、中心旺（两个区域叠加）
    const flames=add.particles(x,y,'wf_flame',{emitZone:zone,lifespan:{min:320,max:620},speedY:{min:-95,max:-45},speedX:{min:-8,max:8},accelerationY:-60,
      scaleX:{start:.42+level*.06,end:.08},scaleY:{start:.6+level*.08,end:.22},alpha:{start:.85,end:0},rotate:{min:-10,max:10},color:[0xffe9a0,0xff9a30,0xe0481a,0x5a1408],colorEase:'quad.in',
      blendMode:Phaser.BlendModes.ADD,frequency:Math.max(10,26-level*4-r/20),quantity:2,maxAliveParticles:110}).setDepth(19.6);
    const smoke=add.particles(x,y-r*.2,'wf_smoke',{emitZone:zone,lifespan:{min:900,max:1500},speedY:{min:-45,max:-25},speedX:{min:-12,max:12},
      scale:{start:.6,end:1.6},alpha:{start:.32,end:0},frequency:120-level*20,quantity:1}).setDepth(19.8);
    const sparks=add.particles(x,y,'wf_spark',{emitZone:zone,lifespan:{min:600,max:1100},speedY:{min:-120,max:-50},speedX:{min:-35,max:35},gravityY:-20,
      scale:{start:.8,end:0},alpha:{start:1,end:0},blendMode:Phaser.BlendModes.ADD,frequency:60-level*12,quantity:1}).setDepth(19.7);
    return {decal,glow,flames,sparks,smoke};
  }
  /** 残火收尾：停止喷火，焦土与暖光渐隐后销毁（不影响伤害结算）。 */
  private fadeFire(f:FireFx):void{
    f.flames.stop();f.sparks.stop();f.smoke.stop();
    const scene=(this.host.add as unknown as {scene:Phaser.Scene}).scene;
    scene.tweens.add({targets:[f.decal,f.glow],alpha:0,duration:420,onComplete:()=>{f.decal.destroy();f.glow.destroy();}});
    scene.time.delayedCall(1600,()=>{f.flames.destroy();f.sparks.destroy();f.smoke.destroy();});
  }
  update(dt:number):void {
    const h=this.host,now=h.combatNow;
    for(const [id,until] of this.burns)if(until<=now)this.burns.delete(id);
    for(let i=this.fields.length-1;i>=0;i--){const f=this.fields[i];
      if(f.fire){const t=now/1000,left=f.end-now,fadeIn=Math.min(1,(now-(f.end-[1000,1800,2500][f.level-1]))/180);f.fire.decal.setAlpha(fadeIn);f.fire.glow.setAlpha((.55+.18*Math.sin(t*11+f.x)+.1*Math.sin(t*23))*fadeIn*Math.min(1,left/300+.35));}
      const candidates=h.grid.query(f.x,f.y,f.r+40).filter(e=>e.active&&!e.isSupplySlot&&Math.hypot(e.x-f.x,e.y-f.y)<=f.r+e.radius);
      if(f.formation&&now<f.end)for(const e of candidates){if(e.kind==='boss'||e.controlImmune)continue;const elite=e.kind==='elite'?.4:1;e.martialSlow=Math.min(now>=e.martialSlowUntil?1:e.martialSlow,1-[.35,.45,.5][f.level-1]*elite);e.martialSlowUntil=now+100;
        if(f.level>=2){const d=Math.hypot(f.x-e.x,f.y-e.y)||1;const step=Math.min(d,18*elite*dt);e.sprite.x+=(f.x-e.x)/d*step;e.sprite.y+=(f.y-e.y)/d*step;}}
      if(!f.formation&&now>=f.next&&now<=f.end&&f.next<=f.end){f.next=now+500;for(const e of candidates)if((this.burns.get(e.spawnId)??0)<=now){this.burns.set(e.spawnId,now+500);h.hitEnemy(e,f.damage*.2,now,'fire');}}
      if(now>=f.end){f.gfx.destroy();f.aura?.destroy();if(f.fire)this.fadeFire(f.fire);this.fields.splice(i,1);if(f.formation){h.spawnFlameFx(f.x,f.y,f.r);for(const e of candidates)h.hitEnemy(e,f.damage*.8,now,'fire');if(f.level===3){h.spawnFlameFx(f.x,f.y,f.r*1.2);for(const e of h.grid.query(f.x,f.y,f.r*1.2+40))if(e.active&&!e.isSupplySlot&&Math.hypot(e.x-f.x,e.y-f.y)<=f.r*1.2+e.radius)h.hitEnemy(e,f.damage*.45,now,'fire');}}}
    }
  }
}
