import type Phaser from 'phaser';
import { DEPTH } from '../config';
import { mythicArtKey, mythicHit, mythicSequence, type MythicWarning, mythicBoss } from '../data/mythicGauntlet';
import type { ArcHost } from './ArcBossV2';
import { mythicFacing, clearMythicSignature, clearMythicWarning, drawMythicWarning, paintMythicSignature, poseMythic } from './MythicArt';

export class MythicBossController {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly signature: Phaser.GameObjects.Image;
  private readonly definition: NonNullable<ReturnType<typeof mythicBoss>>;
  private queue: MythicWarning[] = [];
  private casts = 0;
  private phase2 = false;
  private next: number;
  private flashUntil = 0;
  private corpse?: Phaser.GameObjects.Image;
  private fallMs = 0;
  private announcedAt = -1;
  state = 'approach';
  get label(): string { return this.queue[0]?.name ?? (this.state==='recover'?'收势 · 反击机会':this.definition.title); }

  constructor(private host: ArcHost, id: string, now: number) {
    const definition = mythicBoss(id);
    if (!definition) throw new Error('Unknown mythic boss: '+id);
    this.definition = definition;
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
    while(this.queue[0]?.resolved&&now>=this.queue[0].endsAt+.32) this.queue.shift();
    if (!this.queue.length&&now>=this.next&&distance<260) {
      this.queue=mythicSequence(this.definition,boss,player,this.casts++,this.phase2,now);
      const phasePower=this.phase2?1.1:1;
      for (const warning of this.queue) warning.power*=phasePower;
      this.next=this.queue.at(-1)!.endsAt+(this.phase2?1.55:2);
    }
    const warning=this.queue[0];
    const active=warning&&now>=warning.startsAt?warning:null;
    let moving=false;
    if(!warning&&now>=this.next-.8&&distance>116) {
      // Enemy uids use negative route keys to share Legion's obstacle grid without sharing a soldier's waypoint.
      const waypoint=army.navigation.steer(-boss.uid,boss.x,boss.y,player.x,player.y,boss.radius,ms);
      const vx=waypoint.x-boss.x, vy=waypoint.y-boss.y, toWaypoint=Math.hypot(vx,vy);
      const step=Math.min(distance-116,boss.def.speed*dt,toWaypoint);
      if(step>0) {
        boss.sprite.x+=vx/toWaypoint*step;
        boss.sprite.y+=vy/toWaypoint*step;
        dir=mythicFacing(Math.atan2(vy,vx));
        moving=true;
      }
    }
    this.state=active?(active.resolved?'attack':'warn'):moving?'approach':'recover';
    if(active) {
      if(this.announcedAt!==active.startsAt){
        this.announcedAt=active.startsAt;
        this.host.banner(active.name);
        this.host.sfx('chargeWarn');
      }
      if(!active.resolved&&now>=active.endsAt){
        active.resolved=true;
        const power=boss.def.damage*active.power;
        if(player.alive&&mythicHit(active,player)) player.takeDamage(power,ms);
        for(const unit of army.grid.query(active.x,active.y,active.radius+80)){
          if(unit.active&&mythicHit(active,unit)) army.hurtByBoss(unit,power*.6,ms);
        }
        this.host.sfx('hitHeavy');
      }
      drawMythicWarning(this.graphics,active,id,now);
    }
    poseMythic(boss.sprite,id,now,dir,moving,active);
    if(ms<this.flashUntil) boss.sprite.setTint(0xffb6a0);
    else boss.sprite.clearTint();
    paintMythicSignature(this.signature,id,active,now,boss);
  }

  defeat(): void {
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
  clear(): void { this.host.army.navigation.forget(-this.host.boss.uid); this.queue=[]; this.graphics.destroy(); this.signature.destroy(); this.corpse?.destroy(); }
}
