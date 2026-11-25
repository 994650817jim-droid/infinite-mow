import {lockHalberdCharge} from '../data/ghostLubu';
import type { Enemy } from '../entities/Enemy';
import type Phaser from 'phaser';
import { DEPTH } from '../config';
import { mythicArtKey, mythicHit, mythicTransit, starEyeOpen, hitStarEye, mythicSequence, type MythicWarning, mythicBoss } from '../data/mythicGauntlet';
import type { ArcHost } from './ArcBossV2';
import { BossWalk } from './BossWalk';
import { mythicFacing, clearMythicSignature, clearMythicWarning, drawMythicWarning, paintMythicSignature, poseMythic } from './MythicArt';

export class MythicBossController {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly signature: Phaser.GameObjects.Image;
  private readonly definition: NonNullable<ReturnType<typeof mythicBoss>>;
  private readonly groundWalk: BossWalk;
  private queue: MythicWarning[] = [];
  private eye?: {actor: Enemy; life:number};
  private clearEye() {
    const eye=this.eye;
    if(eye?.actor.active && eye.actor.spawnId===eye.life) eye.actor.deactivate();
    this.eye=undefined;
  }
  strikeEye(e:Enemy,nowMs:number):boolean {
    if(e!==this.eye?.actor || e.spawnId!==this.eye.life)return false;
    const f=this.queue[0]?.constellation;
    if(f && hitStarEye(f,nowMs/1000)) {
      e.hp=f.hp;
      if(f.broken){this.clearEye();this.host.banner('阵眼已破','合阵中断 · 趁势反击');}
    }
    return true;
  }
  private casts = 0;
  private phase2 = false;
  private next: number;
  private flashUntil = 0;
  private corpse?: Phaser.GameObjects.Image;
  private fallMs = 0;
  private announcedAt = -1;
  state = 'approach';
  get label(): string { return this.queue[0]?.name ?? (this.state==='recover'?'收势 · 反击机会':this.definition.title); }

  constructor(private host: ArcHost, id: string, now: number, private inArena=(x:number,y:number,r:number)=>true) {
    const definition = mythicBoss(id);
    if (!definition) throw new Error('Unknown mythic boss: '+id);
    this.definition = definition;
    if(id==='ghost_lubu')host.army.halberdBounds=this.inArena;
    if(id==='divine_caocao')host.army.weiBounds=this.inArena;
    this.groundWalk = new BossWalk(host);
    this.next = now/1000+2;
    this.graphics = host.scene.add.graphics().setDepth(DEPTH.ground+3);
    this.signature = host.scene.add.image(0,0,mythicArtKey(id)).setDepth(DEPTH.fx).setVisible(false);
    host.boss.controlImmune = true;
    host.boss.collidesWithPropsWhileImmune = true;
  }

  incoming(ally: boolean): number {
    return ally ? 1/Math.sqrt(Math.max(1,this.host.army.count/12)) : 1;
  }
  hit(now: number): void { this.flashUntil=now+95; }

  update(dt: number, ms: number): void {
    const {boss,player,army}=this.host, now=ms/1000, id=this.definition.id;
    clearMythicWarning(this.graphics);
    if (!boss.active||this.state==='dead') return;
    if (!this.phase2&&boss.hp<=boss.maxHp*.5) {
      this.phase2=true;
      this.host.banner(this.definition.title,this.definition.tierName==='ghost'?'怨影追击 · 留意下一击':'天命再临 · 阵法加一式');
    }
    const dx=player.x-boss.x, dy=player.y-boss.y, distance=Math.hypot(dx,dy);
    let dir=mythicFacing(Math.atan2(dy,dx));
    while(this.queue[0]?.resolved&&now>=(this.queue[0].charge ? this.queue[0].halberd!.recoverUntil : this.queue[0].endsAt+.32)) this.queue.shift();
    if (!this.queue.length&&now>=this.next&&distance<260) {
      this.queue=mythicSequence(this.definition,boss,player,this.casts++,this.phase2,now,
        (a,b)=>{
          const r=boss.radius+3;
          if(id==='divine_caocao' && (!this.inArena(a.x,a.y,r)||!this.inArena(b.x,b.y,r)))return false;
          return (id!=='ghost_lubu'||this.inArena(b.x,b.y,r)) && army.navigation.clearSegment(a.x,a.y,b.x,b.y,r);
        });
      const phasePower=this.phase2?1.1:1;
      for (const warning of this.queue) warning.power*=phasePower;
      this.next=this.queue.at(-1)!.endsAt+(this.phase2?1.55:2);
    }
    const warning=this.queue[0];
    if (warning?.charge) {
      const locked=warning.halberd!.locked;
      lockHalberdCharge(warning,player,now,(a,b)=>(id!=='ghost_lubu'||this.inArena(b.x,b.y,boss.radius+3)) && army.navigation.clearSegment(a.x,a.y,b.x,b.y,boss.radius+3));
      if(warning.halberd?.locked){
        this.next=warning.halberd.recoverUntil;
        if(!locked)this.announcedAt=-1;
      }
      if(warning.resolved)boss.contactCd=Math.max(boss.contactCd,.18);
    }
    if(id==='divine_caocao'){
      const current=warning?.wei && now>=warning.startsAt && !warning.resolved ? warning : undefined;
      player.weiWarning=army.weiWarning=current;
    }
    if(id==='ghost_lubu')army.halberdWarning=warning?.charge && !warning.resolved ? warning : undefined;
    const field=warning?.constellation;
    if(field && starEyeOpen(field,now) && !this.eye) {
      const base=this.host.def('infantry');
      const e=this.host.spawn('infantry',field.eye.x,field.eye.y,{...base,hp:2,damage:0,speed:0,xp:0,radius:12,behavior:'wall',attackVisual:undefined});
      if(e){e.controlImmune=true;e.ward=true;e.sprite.setAlpha(0);e.shadow.setVisible(false);this.eye={actor:e,life:e.spawnId};}
    } else if (!field || !starEyeOpen(field,now)) this.clearEye();
    if(warning?.closing && field?.broken){this.queue=[];this.next=now+1.4;clearMythicSignature(this.signature);return;}
    const active=warning&&now>=warning.startsAt?warning:null;
    if (!warning && now >= this.next - .8) {
      this.groundWalk.advance(dt, ms, 116);
      dir = this.groundWalk.row;
    } else this.groundWalk.idle();
    const moving = this.groundWalk.moving;
    this.state=active?(active.resolved?(active.charge?'recover':'attack'):'warn'):moving?'approach':'recover';
    if(active) {
      if (active.transit) {
        const position = mythicTransit(active,now);
        if (position) boss.sprite.setPosition(position.x,position.y);
        dir = mythicFacing(active.face);
      }
      if(this.announcedAt!==active.startsAt){
        this.announcedAt=active.startsAt;
        this.host.banner(active.name);
        this.host.sfx(active.wei?.stance==='bow'?'amb_horn':'chargeWarn');
      }
      if(!active.resolved&&now>=active.endsAt){
        active.resolved=true;
        if(active.charge && active.halberd?.collision){
          active.halberd.broken=true; active.name='残戟已断 · 反击';
          boss.contactCd=Math.max(boss.contactCd,active.halberd.recoverUntil-now);
          this.host.banner(active.name,'赤兔失势');
        }
        const power=boss.def.damage*active.power;
        if(player.alive&&mythicHit(active,player)) player.takeDamage(power,ms);
        for(const unit of army.grid.query(active.x,active.y,active.radius+80)){
          if(unit.active&&mythicHit(active,unit)) army.hurtByBoss(unit,power*.6,ms);
        }
        if (!active.transit?.harmless && active.wei?.stance!=='standDown') this.host.sfx('hitHeavy');
      }
      drawMythicWarning(this.graphics,active,id,now);
    }
    poseMythic(boss.sprite,id,now,dir,moving,active,this.groundWalk.frame);
    if(ms<this.flashUntil) boss.sprite.setTint(0xffb6a0);
    else boss.sprite.clearTint();
    paintMythicSignature(this.signature,id,active?.transit?.harmless?null:active,now,boss);
  }

  defeat(): void {
    this.clearEye();
    if(this.definition.id==='ghost_lubu'){this.host.army.halberdWarning=undefined;this.host.army.halberdBounds=undefined;}
    this.clearWei();
    this.state='dead';
    this.queue=[];
    clearMythicWarning(this.graphics);
    clearMythicSignature(this.signature);
    const {boss,scene}=this.host;
    const animated=this.definition.art==='animated';
    this.corpse=scene.add.image(boss.x,boss.y,mythicArtKey(this.definition.id,animated?'fall':'walk'),animated?12:0)
      .setOrigin(.5,animated?216/232:168/176).setDisplaySize(animated?190:144,animated?190:144).setDepth(boss.sprite.depth);
  }
  updateDeath(delta: number): void {
    if (!this.corpse) return;
    this.fallMs+=delta;
    if(this.definition.art==='animated') this.corpse.setFrame(12+Math.min(3,Math.floor(this.fallMs/170)));
    else this.corpse.setRotation(Math.min(.16,this.fallMs/2200));
    this.corpse.setAlpha(Math.max(0,Math.min(1,(1550-this.fallMs)/650)));
  }
  private clearWei():void {
    if(this.definition.id==='divine_caocao'){
      this.host.player.weiWarning=this.host.army.weiWarning=undefined;
      this.host.army.weiBounds=undefined;
    }
  }
  clear(): void { this.clearWei(); if(this.definition.id==='ghost_lubu'){this.host.army.halberdWarning=undefined;this.host.army.halberdBounds=undefined;} this.clearEye(); this.groundWalk.clear(); this.queue=[]; this.graphics.destroy(); this.signature.destroy(); this.corpse?.destroy(); }
}
