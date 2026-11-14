import {ThirdSpearWarnings,THIRD_SPEAR,type SpearWindup} from '../systems/ThirdSpearWarnings';
import {EnemyCamps} from '../systems/EnemyCamps';
import Phaser from 'phaser';import{GameScene}from'./GameScene';import{ThirdBoss}from'../systems/ThirdBoss';import{thirdBattle,THIRD_STAGES,type ThirdStage}from'../data/thirdChapter';import{isChapterTestRun}from'../systems/ChapterProgress';import{beginThirdExpedition,settleThirdExpedition,thirdStageUnlocked,permanentEffects,takeExpeditionReserve}from'../world/WorldStore';import{packCampaign,type CampaignTransfer}from'../systems/Campaign';import{thirdScenery}from'../systems/ThirdScenery';import{SishuiObstacles}from'../systems/SishuiObstacles';import type{Enemy}from'../entities/Enemy';import type{RunEndReason}from'../types';import type{RunConfig}from'../data/characters';
export function thirdGameSceneClass(Base:typeof GameScene){return class ThirdGameScene extends Base{
 private enemyCamps?:EnemyCamps;
 private thirdStage:ThirdStage=1;private controller?:ThirdBoss;private thirdReceipt='';private thirdTest=false;private spear=new WeakMap<Enemy,SpearWindup>();private spearWarnings?:ThirdSpearWarnings;
 constructor(){super('ThirdGameScene');}
 preload(){for(const d of THIRD_STAGES)if(!this.textures.exists('third_'+d.id))this.load.spritesheet('third_'+d.id,'assets/phase23/'+d.id+'.png',{frameWidth:128,frameHeight:128});}
 create(){
  this.thirdStage=(this.registry.get('thirdStage')??1)as ThirdStage;this.thirdTest=isChapterTestRun();if(!THIRD_STAGES[this.thirdStage-1]||!this.thirdTest&&!thirdStageUnlocked(this.thirdStage)){this.scene.start('WorldMapScene');return;}
  const saved=this.registry.get('runConfig')as RunConfig|undefined,transfer=this.registry.get('thirdTransfer')as CampaignTransfer|undefined;this.registry.remove('thirdTransfer');this.registry.remove('campaignTransfer');if(transfer&&transfer.character===saved?.character)this.registry.set('campaignTransfer',transfer);
  this.registry.set('runConfig',{...saved,character:saved?.character??'zhaoyun',chapter:'hulao',westStage:3,encounter:'qunxiong'});super.create();
  this.controller=undefined;this.spear=new WeakMap();this.chapter=thirdBattle(this.thirdStage);this.runConfig={...this.runConfig,thirdStage:this.thirdStage,encounter:'qunxiong'};
  this.thirdReceipt=this.thirdTest?'':beginThirdExpedition(this.thirdStage,this.allies.filter(u=>u.active&&u.reserveSoldier).map(u=>u.kind));const effect=permanentEffects();this.legion.healingMultiplier=effect.healMultiplier;if(!transfer){for(let i=0;i<effect.reinforcements;i++)this.legion.recruit(i===0?'swordsman':'spearman',1,true);if(!this.thirdTest)for(const kind of takeExpeditionReserve()){this.legion.recruit(kind,1,true);this.allies[this.allies.length-1].reserveSoldier=true;}}
  this.spearWarnings=new ThirdSpearWarnings(this);
  this.battlefieldDetails.useStructuredLayout();if(this.supplies)this.supplies.randomGeneration=false;
  const art=thirdScenery(this,this.thirdStage,(frame,x,y,size)=>this.spawnSceneProp(frame,x,y,size));this.ground.setTexture(art.key).setTileScale(1);this.sishuiObstacles=new SishuiObstacles();this.sishuiObstacles.footprints.splice(0,this.sishuiObstacles.footprints.length,...art.boxes);
  this.enemyCamps=new EnemyCamps({scene:this,player:this.player,create:(x,y,hp)=>this.supplies?.spawnCamp(x,y,hp)??null,spawn:(kind,x,y)=>this.spawnEnemy(kind,x,y,1),support:()=>this.legion.grid.query(this.player.x,this.player.y,260),reward:n=>{this.legion.food+=n;}},art.camps,this.combatNow);
  this.legion.campTarget=u=>this.enemyCamps?.assist(u)??null;
  const keys=(this.registry.get('battleTextureKeys')??[])as string[];this.registry.set('battleTextureKeys',[...new Set([...keys,...THIRD_STAGES.map(d=>'third_'+d.id),art.key,'third_road_'+this.thirdStage])]);
  this.hudTexts.chapter.setText(this.chapter.name);this.events.once('shutdown',()=>{this.spearWarnings?.clear();this.spearWarnings=undefined;this.enemyCamps?.clear();this.enemyCamps=undefined;this.controller?.clear();this.controller=undefined;});
 }
 protected handleBattlePointer(pointer:Phaser.Input.Pointer){return this.mode==='none'&&!this.over?(this.enemyCamps?.pointer(pointer)??false):false;}
 protected priorityWeaponTarget(range:number,bodyRadius=true){return this.enemyCamps?.target(range,bodyRadius)??null;}
 protected tryCustomBossSkill(){if(!this.controller||!this.boss?.active)return false;this.controller.forceSkill(this.combatNow);return true;}
 protected customChapter(){return thirdBattle(this.thirdStage);}
 protected spawnBoss(){super.spawnBoss();if(this.boss)this.controller=new ThirdBoss({scene:this,boss:this.boss,player:this.player,army:this.legion,spawn:(kind,x,y)=>this.spawnEnemy(kind,x,y,1,true)},this.thirdStage,this.combatNow);}
 protected customBossStep(enemy:Enemy,dt:number,now:number){if(enemy!==this.boss||!this.controller)return false;this.controller.update(dt,now);return true;}

 protected customEnemyStep(enemy:Enemy,dt:number,now:number,target:{x:number;y:number}){
  if(this.thirdStage!==2||enemy.kind!=='infantry')return false;
  let pending=this.spear.get(enemy);if(pending&&pending.spawn!==enemy.spawnId){this.spear.delete(enemy);pending=undefined;}
  if(pending){
   enemy.moveVx=enemy.moveVy=enemy.intentDx=enemy.intentDy=0;
   if(now<pending.due)return true;
   this.spear.delete(enemy);
   // Stale/interrupted thrusts must not strike after a long stun or large displacement.
   if(now-pending.due>120||Math.hypot(enemy.x-pending.x,enemy.y-pending.y)>40)return true;
   const p=pending,c=Math.cos(p.angle),s=Math.sin(p.angle),inside=(x:number,y:number,r:number)=>{const dx=x-p.x,dy=y-p.y,along=dx*c+dy*s,side=-dx*s+dy*c;return along>=-r&&along<=THIRD_SPEAR.length+r&&Math.abs(side)<THIRD_SPEAR.width/2+r;};
   enemy.startAttack(now,Math.abs(c)>Math.abs(s)?c<0?'left':'right':s<0?'up':'down');
   if(inside(this.player.x,this.player.y,this.player.radius))this.player.takeDamage(enemy.def.damage,now);
   for(const u of this.legion.grid.query(p.x,p.y,THIRD_SPEAR.length+30))if(u.active&&inside(u.x,u.y,u.radius))this.legion.hurt(u,enemy.def.damage,now);
   return true;
  }
  if(enemy.attackUntil>now)return true;
  const dx=target.x-enemy.x,dy=target.y-enemy.y,d=Math.hypot(dx,dy)||1;
  if(d>100)this.advanceEnemy(enemy,dx/d,dy/d,dt);else if(d<58)this.advanceEnemy(enemy,-dx/d*.5,-dy/d*.5,dt);
  if(d<130&&enemy.shootCd<=0){const angle=Math.atan2(dy,dx);enemy.holdAttackPose(now,angle,THIRD_SPEAR.windupMs);enemy.shootCd=THIRD_SPEAR.cooldown;enemy.contactCd=THIRD_SPEAR.cooldown;this.spear.set(enemy,{spawn:enemy.spawnId,due:now+THIRD_SPEAR.windupMs,x:enemy.x,y:enemy.y,angle});}
  return true;
 }
 protected hitEnemy(enemy:Enemy,raw:number,now:number,source:'melee'|'arrow'|'fire'='melee',ally=false,weaponHit=true){if(enemy===this.boss&&this.controller){raw*=this.controller.incoming(ally);this.controller.hit(now);}return super.hitEnemy(enemy,raw,now,source,ally,weaponHit);}
 protected killEnemy(enemy:Enemy){this.enemyCamps?.onDestroyed(enemy,this.combatNow);if(enemy===this.boss)this.controller?.defeat();super.killEnemy(enemy);}
 update(time:number,delta:number){const before=this.combatNow;super.update(time,delta);if(this.combatNow>before&&!this.over&&this.mode==='none')this.enemyCamps?.update(this.combatNow);this.spearWarnings?.draw(this.enemies,this.spear,this.combatNow,this.player,!this.over);this.controller?.updateDeath(delta);if(this.boss?.active&&this.controller)this.hudTexts.bossEnergy.setText(this.controller.label+(this.legion.count>12?' · 军势护阵':''));}
 protected renderRecruit(){if(this.resting){this.campUI?.open('qunxiong-'+this.thirdStage,THIRD_STAGES[this.thirdStage]?.name??'返回天下地图');return;}super.renderRecruit();}
 protected continueCampaign(){if(!this.resting||this.mode!=='rest'||this.thirdStage>=3)return;const next=(this.thirdStage+1)as ThirdStage;if(!this.thirdTest&&!thirdStageUnlocked(next))return;const transfer=packCampaign(this.runConfig.character,this.player,this.legion);transfer.chapter='hulao';this.registry.set('thirdTransfer',transfer);this.registry.set('thirdStage',next);this.registry.set('runConfig',{...this.runConfig,thirdStage:next});this.resting=false;this.scene.restart();}
 protected finish(victory:boolean,reason:RunEndReason='death'){
  if(this.over)return;super.finish(victory,reason);const reward=settleThirdExpedition(this.thirdReceipt,{victory,bossKilled:this.bossKilled,kills:this.kills,elapsed:this.elapsed,debug:this.thirdTest||this.debugModified||this.debugJumped||this.player.damageImmune,returned:!victory||this.thirdStage===3?this.allies.filter(u=>u.active&&u.reserveSoldier).map(u=>u.kind):[]});
  this.controller?.clear();this.resultTexts.subtitle.setText(victory?this.chapter.victoryText:'率部退守，整军再战');this.resultTexts.body.setText(this.resultTexts.body.text+'\n永久奖励 · 军功 +'+reward.merits+' / 粮草 +'+reward.provisions);
  const home=this.resultPanel.getByName('result-home')as Phaser.GameObjects.Text;home?.setText(victory?'返回天下地图':'返回主菜单').removeAllListeners('pointerdown').on('pointerdown',()=>{this.registry.remove('campaignTransfer');this.registry.remove('thirdTransfer');this.scene.start(victory?'WorldMapScene':'MenuScene');});
  const restart=this.resultPanel.getByName('result-restart')as Phaser.GameObjects.Image;restart?.removeAllListeners('pointerdown').on('pointerdown',()=>{this.registry.remove('thirdTransfer');this.registry.remove('campaignTransfer');this.scene.restart();});
  if(victory&&this.thirdStage<3){this.pendingLevels=0;this.pendingRecruit=false;this.freeRecruit=false;this.resting=true;this.player.hp=this.player.maxHp;this.legion.recover();this.renderRecruit();this.setMode('rest');}
 }
};}

