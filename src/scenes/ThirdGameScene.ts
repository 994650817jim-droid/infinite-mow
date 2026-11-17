import {ThirdSpearWarnings,THIRD_SPEAR,type SpearWindup} from '../systems/ThirdSpearWarnings';
import {EnemyCamps} from '../systems/EnemyCamps';
import {HubaoBattle} from '../systems/HubaoBattle';
import {FireShips} from '../systems/FireShips';
import {applyCitySpecialties} from '../systems/CityBonuses';
import {cityIncomeLine,beginArcExpedition,settleArcExpedition,arcStageUnlocked,type WarlordArc} from '../world/WorldStore';
import Phaser from 'phaser';import{GameScene}from'./GameScene';import{ThirdBoss}from'../systems/ThirdBoss';import{thirdBattle,THIRD_STAGES,type ThirdStage}from'../data/thirdChapter';import{isChapterTestRun}from'../systems/ChapterProgress';import{abandonExpedition,permanentEffects,takeExpeditionReserve}from'../world/WorldStore';import{packCampaign,type CampaignTransfer}from'../systems/Campaign';import{thirdScenery,type SceneryStage}from'../systems/ThirdScenery';import{SishuiObstacles}from'../systems/SishuiObstacles';import type{Enemy}from'../entities/Enemy';import type{RunEndReason}from'../types';import type{RunConfig}from'../data/characters';import type{ChapterDef}from'../data/chapters';
import { loadBossSheet } from '../systems/ArtStyle';
import { BOSS_OLD } from '../systems/BossKit';
import type { ArcController, ArcHost } from '../systems/ArcBossV2';
import { YuanshuBoss } from '../systems/YuanshuBoss';
import { CaorenBoss } from '../systems/CaorenBoss';

/** 第三章式三关篇章的配置（第三章群雄割据、第五章赤壁之战共用同一套战场与首领招式框架）。 */
export interface ArcSceneConfig{
 key:string;arc:WarlordArc;
 /** registry 键：当前关、关间继承。 */
 stageKey:string;transferKey:string;
 stages:readonly{id:string;name:string;boss:string;behavior?:ThirdStage;scenery?:SceneryStage;skills?:[string,string,string];signature?:string}[];
 texture:(id:string)=>string;sheet:(id:string)=>string;
 battle:(stage:ThirdStage)=>ChapterDef;
 /** 军营休整界面的键前缀。 */
 campPrefix:string;
 /** 有「东风火船」的关（赤壁鏖兵）。 */
 fireShips?:number[];
}
export const THIRD_CONFIG:ArcSceneConfig={key:'ThirdGameScene',arc:'qunxiong',stageKey:'thirdStage',transferKey:'thirdTransfer',stages:THIRD_STAGES,texture:id=>'third_'+id,sheet:id=>'assets/phase23/'+id+'.png',battle:s=>thirdBattle(s),campPrefix:'qunxiong-'};

export function thirdGameSceneClass(Base:typeof GameScene,cfg:ArcSceneConfig=THIRD_CONFIG){return class ThirdGameScene extends Base{
 protected achievementArc(){return cfg.arc;}
 protected padTargets(){return this.enemyCamps?.padTargets()??[];}
 protected padClearTargets(){this.enemyCamps?.cancel();}
 private enemyCamps?:EnemyCamps;private fireShips?:FireShips;
 /** 第五章虎豹骑（突阵 + 5-1 护驾曹纯）。 */
 private hubao?:HubaoBattle;
 private thirdStage:ThirdStage=1;private controller?:ThirdBoss|ArcController;private thirdReceipt='';private thirdTest=false;private spear=new WeakMap<Enemy,SpearWindup>();private spearWarnings?:ThirdSpearWarnings;
 /** 本关首领招式组与地貌组（第三章即关序号）。 */
 private get behavior():ThirdStage{return cfg.stages[this.thirdStage-1]?.behavior??this.thirdStage;}
 /** 马厩赠马键：群雄为 third-N，其余用篇章名（如 chibi-3）。 */
 protected stableRewardKey():string|null{return (cfg.arc==='qunxiong'?'third':cfg.arc)+'-'+this.thirdStage;}
 private get sceneryStage():SceneryStage{return cfg.stages[this.thirdStage-1]?.scenery??this.thirdStage;}
 constructor(){super(cfg.key);}
 preload(){for(const d of cfg.stages)if(!this.textures.exists(cfg.texture(d.id)))loadBossSheet(this.load,cfg.texture(d.id),cfg.sheet(d.id));}
 create(){
  this.thirdStage=(this.registry.get(cfg.stageKey)??1)as ThirdStage;this.thirdTest=isChapterTestRun();if(!cfg.stages[this.thirdStage-1]||!this.thirdTest&&!arcStageUnlocked(cfg.arc,this.thirdStage)){this.scene.start('WorldMapScene');return;}
  const saved=this.registry.get('runConfig')as RunConfig|undefined,transfer=this.registry.get(cfg.transferKey)as CampaignTransfer|undefined;this.registry.remove(cfg.transferKey);this.registry.remove('campaignTransfer');if(transfer&&transfer.character===saved?.character)this.registry.set('campaignTransfer',transfer);
  this.registry.set('runConfig',{...saved,character:saved?.character??'zhaoyun',chapter:'hulao',westStage:3,encounter:'qunxiong'});super.create();
  this.controller=undefined;this.spear=new WeakMap();this.chapter=cfg.battle(this.thirdStage);this.runConfig={...this.runConfig,thirdStage:this.thirdStage,encounter:'qunxiong'};
  this.hubao=cfg.arc==='chibi'?new HubaoBattle({scene:this,player:this.player,army:this.legion,enemies:this.enemies,spawn:(kind,x,y,def)=>this.spawnEnemy(kind,x,y,undefined,true,def),stage:()=>this.thirdStage,elapsed:()=>this.elapsed,def:k=>this.chapter.enemies[k],banner:(t,c)=>this.showWaveBanner(t,true,c||undefined),sfx:k=>this.sfx.play(k),move:(e,nx,ny,dt)=>this.advanceEnemy(e,nx,ny,dt),boss:()=>this.boss,obstacles:()=>this.sishuiObstacles?.footprints??[]}):undefined;this.xiliang=this.hubao??null;
  this.thirdReceipt=this.thirdTest?'':beginArcExpedition(cfg.arc,this.thirdStage,this.allies.filter(u=>u.active&&u.reserveSoldier).map(u=>u.kind));const effect=permanentEffects();this.legion.healingMultiplier=effect.healMultiplier;applyCitySpecialties(this.player,effect,!transfer,{legion:this.legion,supplies:this.supplies});if(!transfer){for(let i=0;i<effect.reinforcements;i++)this.legion.recruit(i===0?'swordsman':'spearman',1,true);if(!this.thirdTest)for(const kind of takeExpeditionReserve(effect.reserveSlots)){this.legion.recruit(kind,1,true);this.allies[this.allies.length-1].reserveSoldier=true;}}
  this.spearWarnings=new ThirdSpearWarnings(this);
  this.battlefieldDetails.useStructuredLayout();if(this.supplies)this.supplies.randomGeneration=false;
  const art=thirdScenery(this,this.sceneryStage,(frame,x,y,size)=>this.spawnSceneProp(frame,x,y,size));this.ground.setTexture(art.key).setTileScale(1);this.sishuiObstacles=new SishuiObstacles();this.sishuiObstacles.footprints.splice(0,this.sishuiObstacles.footprints.length,...art.boxes);
  this.enemyCamps=new EnemyCamps({scene:this,player:this.player,create:(x,y,hp)=>this.supplies?.spawnCamp(x,y,hp)??null,spawn:(kind,x,y)=>this.spawnEnemy(kind,x,y,1),support:()=>this.legion.grid.query(this.player.x,this.player.y,260),reward:n=>{this.legion.food+=n;}},art.camps,this.combatNow);
  this.legion.campTarget=u=>this.enemyCamps?.assist(u)??null;
  this.fireShips=cfg.fireShips?.includes(this.thirdStage)?new FireShips({scene:this,enemies:()=>this.enemies,player:()=>this.player,boss:()=>this.boss??undefined,burn:(e,dmg,now)=>{this.hitEnemy(e,dmg,now,'fire',true,false);},announce:t=>this.showWaveBanner(t,false)},this.combatNow):undefined;
  const keys=(this.registry.get('battleTextureKeys')??[])as string[];this.registry.set('battleTextureKeys',[...new Set([...keys,...cfg.stages.map(d=>cfg.texture(d.id)),art.key,'third_road_'+this.sceneryStage])]);
  this.hudTexts.chapter.setText(this.chapter.name);this.events.once('shutdown',()=>{this.spearWarnings?.clear();this.spearWarnings=undefined;this.enemyCamps?.clear();this.enemyCamps=undefined;this.controller?.clear();this.controller=undefined;this.fireShips?.clear();this.fireShips=undefined;});
 }
 protected abandonRun(){if(!this.over)abandonExpedition(this.thirdReceipt,this.allies.filter(u=>u.active&&u.reserveSoldier).map(u=>u.kind));}
 protected handleBattlePointer(pointer:Phaser.Input.Pointer){return this.mode==='none'&&!this.over?(this.enemyCamps?.pointer(pointer)??false):false;}
 protected priorityWeaponTarget(range:number,bodyRadius=true){return this.enemyCamps?.target(range,bodyRadius)??null;}
 protected tryCustomBossSkill(){if(!this.controller||!this.boss?.active)return false;this.controller.forceSkill(this.combatNow);return true;}
 protected customChapter(){return cfg.battle(this.thirdStage);}
 bossDebug(){return (this.controller as ArcController|undefined)?.debug??null;}
 protected spawnBoss(){const had=this.boss?.active;super.spawnBoss();if(this.boss&&!had)this.hubao?.onBoss(this.combatNow);const d=cfg.stages[this.thirdStage-1];if(this.boss&&!BOSS_OLD&&(cfg.arc==='qunxiong'&&d.id==='yuanshu'||cfg.arc==='chibi'&&d.id==='caoren')){const host:ArcHost={scene:this,boss:this.boss,player:this.player,army:this.legion,spawn:(kind,x,y,def)=>this.spawnEnemy(kind,x,y,1,true,def),def:k=>this.chapter.enemies[k],banner:(t,c)=>this.showWaveBanner(t,true,c),sfx:k=>this.sfx.play(k)};this.controller=d.id==='yuanshu'?new YuanshuBoss(host,cfg.texture(d.id),this.combatNow):new CaorenBoss(host,cfg.texture(d.id),this.combatNow);return;}
  if(this.boss)this.controller=new ThirdBoss({scene:this,boss:this.boss,player:this.player,army:this.legion,spawn:(kind,x,y)=>this.spawnEnemy(kind,x,y,1,true)},this.behavior,this.combatNow,cfg===THIRD_CONFIG?undefined:{texture:cfg.texture(d.id),name:d.boss,skills:d.skills,signature:d.signature?{id:d.id as 'caochun'|'caimao'|'caoren',name:d.signature}:undefined});}
 protected customBossStep(enemy:Enemy,dt:number,now:number){if(enemy!==this.boss||!this.controller)return false;this.controller.update(dt,now);return true;}

 protected customEnemyStep(enemy:Enemy,dt:number,now:number,target:{x:number;y:number}){
  if(this.behavior!==2||enemy.kind!=='infantry')return false;
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
 update(time:number,delta:number){const before=this.combatNow;super.update(time,delta);if(this.combatNow>before&&!this.over&&this.mode==='none'){this.enemyCamps?.update(this.combatNow);this.fireShips?.update(this.combatNow);}this.spearWarnings?.draw(this.enemies,this.spear,this.combatNow,this.player,!this.over);this.controller?.updateDeath(delta);if(this.boss?.active&&this.controller)this.hudTexts.bossEnergy.setText(this.controller.label+(this.legion.count>12?' · 军势护阵':''));}
 protected renderRecruit(){if(this.resting){this.campUI?.open(cfg.campPrefix+this.thirdStage,cfg.stages[this.thirdStage]?.name??'返回天下地图');return;}super.renderRecruit();}
 protected continueCampaign(){if(!this.resting||this.mode!=='rest'||this.thirdStage>=3)return;const next=(this.thirdStage+1)as ThirdStage;if(!this.thirdTest&&!arcStageUnlocked(cfg.arc,next))return;const transfer=packCampaign(this.runConfig.character,this.player,this.legion);transfer.chapter='hulao';this.registry.set(cfg.transferKey,transfer);this.registry.set(cfg.stageKey,next);this.registry.set('runConfig',{...this.runConfig,thirdStage:next});this.resting=false;this.scene.restart();}
 protected finish(victory:boolean,reason:RunEndReason='death'){
  if(this.over)return;super.finish(victory,reason);const reward=settleArcExpedition(cfg.arc,this.thirdReceipt,{victory,bossKilled:this.bossKilled,kills:this.kills,elapsed:this.elapsed,debug:this.thirdTest||this.debugModified||this.debugJumped||this.player.damageImmune,returned:!victory||this.thirdStage===3?this.allies.filter(u=>u.active&&u.reserveSoldier).map(u=>u.kind):[]});
  this.controller?.clear();this.resultTexts.subtitle.setText(victory?this.chapter.victoryText:'率部退守，整军再战');this.resultTexts.body.setText(this.resultTexts.body.text+'\n永久奖励 · 军粮 +'+reward.provisions+cityIncomeLine(reward));
  const home=this.resultPanel.getByName('result-home')as Phaser.GameObjects.Text;home?.setText(victory?'返回天下地图':'返回主菜单').removeAllListeners('pointerdown').on('pointerdown',()=>{this.registry.remove('campaignTransfer');this.registry.remove(cfg.transferKey);this.scene.start(victory?'WorldMapScene':'MenuScene');});
  const restart=this.resultPanel.getByName('result-restart')as Phaser.GameObjects.Image;restart?.removeAllListeners('pointerdown').on('pointerdown',()=>{this.registry.remove(cfg.transferKey);this.registry.remove('campaignTransfer');this.scene.restart();});
  if(victory&&this.thirdStage<3){this.pendingLevels=0;this.pendingRecruit=false;this.freeRecruit=false;this.resting=true;this.player.hp=this.player.maxHp;this.legion.recover();this.renderRecruit();this.setMode('rest');}
 }
};}
