import {ARC_FACTIONS,SCENE_LOOKS} from '../data/sceneLooks';
import {ensureFactionTextures} from '../systems/FactionPalette';
import {siegeSourceKeys} from '../data/siege';
import {thirdPalette} from '../data/thirdChapter';
import {architecturalSurface} from '../systems/SceneSurfaces';
import {FACTION_PROPS} from '../systems/PropsV2';
import {chibiRiverCamp} from '../systems/ChibiRiverCamp';
import {ThirdSpearWarnings,THIRD_SPEAR,type SpearWindup} from '../systems/ThirdSpearWarnings';
import {EnemyCamps} from '../systems/EnemyCamps';
import type {CampPoint} from '../systems/EnemyCamps';
import {HubaoBattle} from '../systems/HubaoBattle';
import {FireShips} from '../systems/FireShips';
import {applyCitySpecialties} from '../systems/CityBonuses';
import {rewardGrain,cityIncomeLine,beginArcExpedition,settleArcExpedition,arcStageUnlocked,arcStagePlayable,type WarlordArc} from '../world/WorldStore';
import Phaser from 'phaser';import{GameScene}from'./GameScene';import{ThirdBoss}from'../systems/ThirdBoss';import{thirdBattle,THIRD_STAGES,type ThirdStage}from'../data/thirdChapter';import{isChapterTestRun}from'../systems/ChapterProgress';import{abandonExpedition,permanentEffects,takeExpeditionReserve}from'../world/WorldStore';import{packCampaign,type CampaignTransfer}from'../systems/Campaign';import{thirdScenery,type SceneryStage}from'../systems/ThirdScenery';import{SishuiObstacles}from'../systems/SishuiObstacles';import{SishuiPass}from'../systems/SishuiPass';import{ARC_FORTS,ARC_FORT_WALL_Y,type ArcFort}from'../data/arcForts';import type{Enemy}from'../entities/Enemy';import type{RunEndReason}from'../types';import type{RunConfig}from'../data/characters';import type{ChapterDef}from'../data/chapters';
import { loadBossSheet } from '../systems/ArtStyle';
import { BOSS_OLD } from '../systems/BossKit';
import type { ArcController, ArcHost } from '../systems/ArcBossV2';
import { YuanshuBoss } from '../systems/YuanshuBoss';
import { CaorenBoss } from '../systems/CaorenBoss';
import { BossMoveset } from '../systems/BossMoveset';
import { BOSS_MOVES } from '../data/bossMoves';
import { changanPlan } from '../data/dualBossPlans';
import { dualOff } from '../systems/DualBoss';
import { STORY_CHAPTERS } from '../data/story';
import { QijinTracker } from '../systems/ChibiStoryHooks';
import { setStoryFlag } from '../systems/Story';
import { DianweiGuard, DIANWEI } from '../systems/DianweiGuard';
import { addMerit } from '../systems/MasteryStore';
import { loadV2TroopSheets } from '../systems/ArtStyle';
import type { SideRouteId } from '../data/sideRoutes';

/** 第三章式三关篇章的配置（第三章群雄割据、第五章赤壁之战共用同一套战场与首领招式框架）。 */
export interface ArcSceneConfig{
 key:string;arc:WarlordArc|SideRouteId;
 /** 其他势力支线（data/sideRoutes.ts）：开放判定、出征 / 结算换成支线的（不走篇章进度）；额外载入的兵种图。 */
 gate?:(stage:number)=>boolean;begin?:(stage:number)=>string;settle?:(receipt:string,stage:number,r:{victory:boolean;debug:boolean})=>{provisions:number;line:string};troopSheets?:readonly string[];
 /** registry 键：当前关、关间继承。 */
 stageKey:string;transferKey:string;
 stages:readonly{id:string;name:string;boss:string;behavior?:ThirdStage;scenery?:SceneryStage;skills?:[string,string,string];signature?:string;
  /** 绝技套用哪一位的招式（第八章曹操借曹纯的虎豹围猎）；默认同 id。 */ signatureId?:'caochun'|'caimao'|'caoren'}[];
 texture:(id:string)=>string;sheet:(id:string)=>string;
 battle:(stage:ThirdStage)=>ChapterDef;
 /** 军营休整界面的键前缀。 */
 campPrefix:string;
 /** 有「东风火船」的关（赤壁鏖兵）。 */
 fireShips?:number[];
 /** 自定义战场布置（第七章山道 / 攻城）：返回 null 时用第三章框架的默认战场。 */
 scenery?:(scene:Phaser.Scene,stage:number)=>{key:string;boxes:Array<{left:number;right:number;top:number;bottom:number}>;camps:CampPoint[]}|null;
}
export const THIRD_CONFIG:ArcSceneConfig={key:'ThirdGameScene',arc:'qunxiong',stageKey:'thirdStage',transferKey:'thirdTransfer',stages:THIRD_STAGES,texture:id=>'third_'+id,sheet:id=>'assets/phase23/'+id+'.png',battle:s=>thirdBattle(s),campPrefix:'qunxiong-'};

export function thirdGameSceneClass(Base:typeof GameScene,cfg:ArcSceneConfig=THIRD_CONFIG){return class ThirdGameScene extends Base{
 protected achievementArc(){return cfg.arc;}
 protected padTargets(){return this.enemyCamps?.padTargets()??[];}
 protected padClearTargets(){this.enemyCamps?.cancel();}
 private enemyCamps?:EnemyCamps;private fireShips?:FireShips;
 /** 第五章虎豹骑（突阵 + 5-1 护驾曹纯）。 */
 private hubao?:HubaoBattle;
 /** 3-2 典韦守营（剧情第三章玩法挂钩） */
 private dianwei?:DianweiGuard;
 private thirdStage:ThirdStage=1;private controller?:ThirdBoss|ArcController;private thirdReceipt='';private thirdTest=false;private spear=new WeakMap<Enemy,SpearWindup>();private spearWarnings?:ThirdSpearWarnings;
 /** 本关首领招式组与地貌组（第三章即关序号）。 */
 private get behavior():ThirdStage{return this.stageInfo()?.behavior??this.thirdStage;}
 /** 当前关的首领信息（子类可换：第六章长沙先黄忠后韩玄）。 */
 protected stageInfo():ArcSceneConfig['stages'][number]{return cfg.stages[this.thirdStage-1];}
 /** 当前关序号（1~3）。 */
 protected get arcStage():number{return this.thirdStage;}
 /** 场景配置（子类读取）。 */
 protected get arcConfig():ArcSceneConfig{return cfg;}
 /** 马厩赠马键：群雄为 third-N，其余用篇章名（如 chibi-3）。 */
 protected stableRewardKey():string|null{return (cfg.arc==='qunxiong'?'third':cfg.arc)+'-'+this.thirdStage;}
 /** 首领招降表的键（data/surrender.ts）：章节 arc-关:首领 id（6-3 黄忠 / 韩玄按当前出阵的首领）。 */
 protected surrenderKey():string|null{return cfg.arc+'-'+this.thirdStage+':'+this.stageInfo().id;}
 /** 这一关能不能进（篇章：WorldStore 进度；支线：cfg.gate）。 */
 protected stageGate(stage:number):boolean{return cfg.gate?cfg.gate(stage):arcStagePlayable(cfg.arc as WarlordArc,stage);}
 private get sceneryStage():SceneryStage{return cfg.stages[this.thirdStage-1]?.scenery??this.thirdStage;}
 constructor(){super(cfg.key);}
 preload(){for(const d of cfg.stages)if(!this.textures.exists(cfg.texture(d.id)))loadBossSheet(this.load,cfg.texture(d.id),cfg.sheet(d.id));if(cfg.troopSheets)loadV2TroopSheets(this,cfg.troopSheets);/* 3-1 双首领第二位郭汜（v2 专属图；v1 没有郭汜图，借李傕） */if(cfg.arc==='qunxiong'&&!this.textures.exists('third_guosi'))loadBossSheet(this.load,'third_guosi',cfg.sheet('lijue'));}
 create(){
  this.thirdStage=(this.registry.get(cfg.stageKey)??1)as ThirdStage;this.thirdTest=isChapterTestRun();if(!cfg.stages[this.thirdStage-1]||!this.thirdTest&&!this.stageGate(this.thirdStage)){this.scene.start('WorldMapScene');return;}
  const saved=this.registry.get('runConfig')as RunConfig|undefined,transfer=this.registry.get(cfg.transferKey)as CampaignTransfer|undefined;this.registry.remove(cfg.transferKey);this.registry.remove('campaignTransfer');if(transfer&&transfer.character===saved?.character)this.registry.set('campaignTransfer',transfer);
  this.registry.set('runConfig',{...saved,character:saved?.character??'zhaoyun',chapter:'hulao',westStage:3,encounter:'qunxiong'});super.create();
  this.controller=undefined;this.spear=new WeakMap();this.chapter=cfg.battle(this.thirdStage);this.runConfig={...this.runConfig,thirdStage:this.thirdStage,encounter:'qunxiong'};
  /* 第三章敌军换色贴图（thirdPalette：李傕 / 张绣黑底土黄、袁术紫），须在任何敌兵生成前就绪 */const paletteKeys=cfg.arc==='qunxiong'?ensureFactionTextures(this,thirdPalette(this.thirdStage as 1|2|3),siegeSourceKeys()):[];
  {const fac=ARC_FACTIONS[cfg.arc+'.'+this.thirdStage];if(fac!==undefined&&FACTION_PROPS[fac]&&this.textures.exists(FACTION_PROPS[fac].key))architecturalSurface(this,fac);} /* 场景审查 P3：营具按本关敌方势力（原来一律西凉红黑帐篷）；吴 / 蜀 / 蛮的营具图没到之前照旧 */
  this.hubao=cfg.arc==='chibi'?new HubaoBattle({scene:this,player:this.player,army:this.legion,enemies:this.enemies,spawn:(kind,x,y,def)=>this.spawnEnemy(kind,x,y,undefined,true,def),stage:()=>this.thirdStage,elapsed:()=>this.elapsed,def:k=>this.chapter.enemies[k],banner:(t,c)=>this.showWaveBanner(t,true,c||undefined),sfx:k=>this.sfx.play(k),move:(e,nx,ny,dt)=>this.advanceEnemy(e,nx,ny,dt),boss:()=>this.boss,obstacles:()=>this.sishuiObstacles?.footprints??[]}):undefined;this.xiliang=this.hubao??null;
  this.thirdReceipt=this.thirdTest?'':cfg.begin?cfg.begin(this.thirdStage):beginArcExpedition(cfg.arc as WarlordArc,this.thirdStage,this.allies.filter(u=>u.active&&u.reserveSoldier).map(u=>u.kind));const effect=permanentEffects();this.legion.healingMultiplier=effect.healMultiplier;applyCitySpecialties(this.player,effect,!transfer,{legion:this.legion,supplies:this.supplies});if(!transfer){for(let i=0;i<effect.reinforcements;i++)this.legion.recruit(i===0?'swordsman':'spearman',1,true);if(!this.thirdTest)for(const kind of takeExpeditionReserve(effect.reserveSlots)){this.legion.recruit(kind,1,true);this.allies[this.allies.length-1].reserveSoldier=true;}}
  this.spearWarnings=new ThirdSpearWarnings(this);
  this.battlefieldDetails.useStructuredLayout();if(this.supplies)this.supplies.randomGeneration=false;
  const art=cfg.scenery?.(this,this.thirdStage)??thirdScenery(this,this.sceneryStage,(frame,x,y,size)=>this.spawnSceneProp(frame,x,y,size),cfg.arc,this.fort?.kind,SCENE_LOOKS[cfg.arc+'.'+this.thirdStage],cfg.arc+this.thirdStage);this.ground.setTexture(art.key).setTileScale(1);this.sishuiObstacles=new SishuiObstacles();this.sishuiObstacles.footprints.splice(0,this.sishuiObstacles.footprints.length,...art.boxes);
  /* 关隘 / 城池（data/arcForts.ts）：关墙、关门、箭楼复用 2-1 汜水关；碰撞框共用一个数组，开门时关门那格移除 */
  const fort=this.fort;if(fort&&fort.kind!=='clear'&&!cfg.scenery){this.sishuiPass=new SishuiPass(this.passHost(),{ends:fort.ends??(fort.kind==='pass'?'cliff':fort.kind==='camp'?'woods':'tower'),towers:fort.kind==='pass',tents:false,wenjiu:false,wallY:ARC_FORT_WALL_Y,gateText:fort.gate,tag:'fort',palisade:fort.kind==='camp'?FACTION_PROPS[ARC_FACTIONS[cfg.arc+'.'+this.thirdStage]??3]?.key??FACTION_PROPS[3].key:undefined});this.sishuiPass.footprints.push(...art.boxes);this.sishuiObstacles=new SishuiObstacles(this.sishuiPass.footprints);}
  this.enemyCamps=new EnemyCamps({scene:this,player:this.player,create:(x,y,hp)=>this.supplies?.spawnCamp(x,y,hp)??null,spawn:(kind,x,y)=>this.spawnEnemy(kind,x,y,1),support:()=>this.legion.grid.query(this.player.x,this.player.y,260),reward:n=>{this.legion.food+=n;}},art.camps,this.combatNow);
  this.legion.campTarget=u=>this.enemyCamps?.assist(u)??null;
  if(cfg.arc==='chibi'&&this.thirdStage===2){if(!this.sishuiObstacles)this.sishuiObstacles=new SishuiObstacles([]);chibiRiverCamp(this,this.sishuiObstacles.footprints);} /* 5-2 赤壁：北岸曹军水寨布景、江北连环战船（船身挡人；江面是 Terrain 的河） */
  this.fireShips=cfg.fireShips?.includes(this.thirdStage)?new FireShips({scene:this,enemies:()=>this.enemies,player:()=>this.player,boss:()=>this.boss??undefined,burn:(e,dmg,now)=>{this.hitEnemy(e,dmg,now,'fire',true,false);},announce:t=>this.showWaveBanner(t,false)},this.combatNow):undefined;
  const keys=(this.registry.get('battleTextureKeys')??[])as string[];this.registry.set('battleTextureKeys',[...new Set([...keys,...paletteKeys,...cfg.stages.map(d=>cfg.texture(d.id)),art.key,'third_road_'+this.sceneryStage])]);
  // 剧情（第三章起）：基类按 encounter 没建剧情；有该篇章剧本时按篇章 id 重建并播关前剧情
  if(STORY_CHAPTERS[cfg.arc])this.setupStory(cfg.arc,this.thirdStage);
  /* 5-1「七进七出」：赵云在队击杀虎豹骑 77 骑（systems/ChibiStoryHooks.ts） */
  this.qijin=cfg.arc==='chibi'&&this.thirdStage===1?new QijinTracker({team:()=>[this.runConfig.character,...(this.followers?.members??[]).map(m=>m.recruit.hero??'')],banner:(t,c)=>{this.showWaveBanner(t,false,c);this.sfx.play('gong');},bark:()=>{this.storyDir?.line('chibi-1.qijin',this.player.sprite);}}):undefined;
  this.dianwei=cfg.arc==='qunxiong'&&this.thirdStage===2?new DianweiGuard({scene:this,player:this.player,enemies:()=>this.enemies,allies:()=>this.allies,line:(id,at)=>!!this.storyDir?.line(id,at),hit:(e,d)=>{this.hitEnemy(e,d,this.combatNow,'melee',true,false);},banner:(t,d,c)=>this.showWaveBanner(t,d,c)},this.combatNow):undefined;
  this.hudTexts.chapter.setText(this.chapter.name);this.events.once('shutdown',()=>{this.dianwei?.clear();this.dianwei=undefined;this.spearWarnings?.clear();this.spearWarnings=undefined;this.enemyCamps?.clear();this.enemyCamps=undefined;this.controller?.clear();this.controller=undefined;this.fireShips?.clear();this.fireShips=undefined;});
 }
 /** 5-1「七进七出」计数（只在赤壁第一关建） */
 qijin?:QijinTracker;
 protected abandonRun(){if(!this.over)abandonExpedition(this.thirdReceipt,this.allies.filter(u=>u.active&&u.reserveSoldier).map(u=>u.kind));}
 protected handleBattlePointer(pointer:Phaser.Input.Pointer){return this.mode==='none'&&!this.over?(this.enemyCamps?.pointer(pointer)??false):false;}
 // 2026-11-16 修：原来营寨 / 粮仓不在射程时返回 null，首领 / 精锐优先被整个吃掉（黄忠宝雕弓在 3-3、5-3 对首领 0 伤害），改为退回基类的首领 > 精锐
 protected priorityWeaponTarget(range:number,bodyRadius=true){return this.enemyCamps?.target(range,bodyRadius)??super.priorityWeaponTarget(range,bodyRadius);}
 protected tryCustomBossSkill(){if(!this.controller||!this.boss?.active)return false;this.controller.forceSkill(this.combatNow);return true;}
 protected customChapter(){return cfg.battle(this.thirdStage);}
 bossDebug(){return (this.controller as ArcController|undefined)?.debug??null;}
 /** 本关的关隘 / 城池登记（data/arcForts.ts），没登记 = 原样。 */
 get fort():ArcFort|undefined{return ARC_FORTS[cfg.arc+'.'+this.thirdStage];}
 protected spawnBoss(){const had=this.boss?.active;super.spawnBoss();if(this.boss&&!had)this.sishuiPass?.onBoss(this.boss);if(had&&this.controller)return;/* 首领已在场时重复调用（攻城等场景每帧检查出场）不重建控制器，否则会把专属招式控制器换回通用的 */if(this.boss&&!had)this.hubao?.onBoss(this.combatNow);const d=this.stageInfo();const mv=BOSS_MOVES[cfg.arc+'.'+d.id]??BOSS_MOVES[d.id];if(this.boss&&!had&&!BOSS_OLD&&mv){/* 首领招式框架（data/bossMoves.ts）：按章节.首领 id 或首领 id 查；有专属控制器的首领（袁术、曹仁…）不在表里 */this.controller=new BossMoveset(this.arcHost(this.boss),this.boss.def.texture,this.combatNow,mv,'arc');if(this.dualSetup(this.controller as BossMoveset))this.controller=undefined;return;}if(this.boss&&!BOSS_OLD&&(cfg.arc==='qunxiong'&&d.id==='yuanshu'||cfg.arc==='chibi'&&d.id==='caoren')){const host:ArcHost={scene:this,boss:this.boss,player:this.player,army:this.legion,spawn:(kind,x,y,def)=>this.spawnEnemy(kind,x,y,1,true,def),def:k=>this.chapter.enemies[k],banner:(t,c)=>this.showWaveBanner(t,true,c),sfx:k=>this.sfx.play(k)};this.controller=d.id==='yuanshu'?new YuanshuBoss(host,cfg.texture(d.id),this.combatNow):new CaorenBoss(host,cfg.texture(d.id),this.combatNow);return;}
  if(this.boss)this.controller=new ThirdBoss({scene:this,boss:this.boss,player:this.player,army:this.legion,spawn:(kind,x,y)=>this.spawnEnemy(kind,x,y,1,true)},this.behavior,this.combatNow,cfg===THIRD_CONFIG?undefined:{texture:cfg.texture(d.id),name:d.boss,skills:d.skills,signature:d.signature?{id:(d.signatureId??d.id) as 'caochun'|'caimao'|'caoren',name:d.signature}:undefined});}
 /** 首领招式框架的宿主（双首领关第二位首领也用）。 */
 protected arcHost(boss:Enemy):ArcHost{return {scene:this,boss,player:this.player,army:this.legion,spawn:(kind,x,y,def)=>this.spawnEnemy(kind,x,y,1,true,def),def:k=>this.chapter.enemies[k],banner:(t,c)=>this.showWaveBanner(t,true,c),sfx:k=>this.sfx.play(k)};}
 /** 双首领关：子类在第一位首领的招式控制器建好后接手（返回 true = 控制器交给 DualBoss）。 */
 protected dualSetup(first:BossMoveset):boolean{
  // 3-1 长安 · 李傕（骑西凉马）+ 郭汜（步战）双首领，「李郭内讧」（data/dualBossPlans.ts changanPlan）；8-2 等子类各自覆写
  const b=this.boss;if(cfg.arc!=='qunxiong'||this.thirdStage!==1||!b||dualOff())return false;
  this.startDual(changanPlan(),{id:'lijue',name:'李傕',enemy:b,ctrl:first,mount:first.mount??null,key:'qunxiong-1:lijue'},
   {id:'guosi',name:'郭汜',at:{x:b.x+220,y:b.y-20},def:{texture:'third_guosi'},key:null,make:e=>({ctrl:new BossMoveset(this.arcHost(e),'third_guosi',this.combatNow,BOSS_MOVES.guosi,'arc'),mount:null})});
  return true;
 }
 protected sceneFaction():number|null{return ARC_FACTIONS[cfg.arc+'.'+this.thirdStage]??null;}
 protected customBossStep(enemy:Enemy,dt:number,now:number){if(enemy!==this.boss||!this.controller)return false;this.controller.update(dt,now);return true;}

 protected customEnemyStep(enemy:Enemy,dt:number,now:number,target:{x:number;y:number}){
  // 典韦守营：约四成敌兵改打典韦（步兵照常突刺，只是目标换成典韦；其他兵种走过去贴身砍）
  const dw=this.dianwei;if(dw?.lures(enemy)){const t={x:dw.x,y:dw.y};if(this.behavior===2&&enemy.kind==='infantry')return this.spearStep(enemy,dt,now,t);const dx=t.x-enemy.x,dy=t.y-enemy.y,d=Math.hypot(dx,dy)||1;if(d>enemy.radius+16)this.advanceEnemy(enemy,dx/d,dy/d,dt);else enemy.moveVx=enemy.moveVy=0;return true;}
  if(this.behavior!==2||enemy.kind!=='infantry')return false;
  return this.spearStep(enemy,dt,now,target);
 }
 /** 3-2 步兵突刺（预警后沿直线刺出）。 */
 private spearStep(enemy:Enemy,dt:number,now:number,target:{x:number;y:number}){
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
   if(this.dianwei?.alive&&inside(this.dianwei.x,this.dianwei.y,18))this.dianwei.hurt(enemy.def.damage,now);
   return true;
  }
  if(enemy.attackUntil>now)return true;
  const dx=target.x-enemy.x,dy=target.y-enemy.y,d=Math.hypot(dx,dy)||1;
  if(d>100)this.advanceEnemy(enemy,dx/d,dy/d,dt);else if(d<58)this.advanceEnemy(enemy,-dx/d*.5,-dy/d*.5,dt);
  if(d<130&&enemy.shootCd<=0){const angle=Math.atan2(dy,dx);enemy.holdAttackPose(now,angle,THIRD_SPEAR.windupMs);enemy.shootCd=THIRD_SPEAR.cooldown;enemy.contactCd=THIRD_SPEAR.cooldown;this.spear.set(enemy,{spawn:enemy.spawnId,due:now+THIRD_SPEAR.windupMs,x:enemy.x,y:enemy.y,angle});}
  return true;
 }
 protected hitEnemy(enemy:Enemy,raw:number,now:number,source:'melee'|'arrow'|'fire'='melee',ally=false,weaponHit=true){if(enemy===this.boss&&this.controller){raw*=this.controller.incoming(ally);this.controller.hit(now);}return super.hitEnemy(enemy,raw,now,source,ally,weaponHit);}
 /** 第三 / 五章首领控制器自己播倒地帧（4×8 图集 28~31）。 */
 protected bossHasDeathArt(){return !!this.controller;}
 protected killEnemy(enemy:Enemy){this.qijin?.onKill(enemy);this.enemyCamps?.onDestroyed(enemy,this.combatNow);if(enemy===this.boss){if(this.bossRetreats(enemy))this.controller?.clear();else this.controller?.defeat(); /* 败退型（8-1 张郃、5-3 曹仁）不倒地、淡出退走 */
  // 典韦守营结果（剧情旗标 dianwei，第四章、编年史读）：张绣倒下时典韦还活着 = saved（军功 +80），否则 fell
  if(this.dianwei){const saved=this.dianwei.alive;this.dianwei.finish();setStoryFlag('dianwei',saved?'saved':'fell');if(saved){addMerit(DIANWEI.meritSaved);this.showWaveBanner('典韦得救',false,'恶来无恙 · 军粮 +'+rewardGrain(DIANWEI.meritSaved,0));}}}
  super.killEnemy(enemy);}
 update(time:number,delta:number){const before=this.combatNow;super.update(time,delta);if(this.combatNow>before&&!this.over&&this.mode==='none'){if(!this.awaitingChest)this.enemyCamps?.update(this.combatNow);this.dianwei?.update((this.combatNow-before)/1000,this.combatNow);this.fireShips?.update(this.combatNow);}this.spearWarnings?.draw(this.enemies,this.spear,this.combatNow,this.player,!this.over);this.controller?.updateDeath(delta);if(this.boss?.active&&this.controller)this.hudTexts.bossEnergy.setText(this.controller.label+(this.legion.count>12?' · 军势护阵':''));}
 protected renderRecruit(){if(this.resting){this.campUI?.open(cfg.campPrefix+this.thirdStage,cfg.stages[this.thirdStage]?.name??'返回天下地图');return;}super.renderRecruit();}
 protected continueCampaign(){if(!this.resting||this.mode!=='rest'||this.thirdStage>=cfg.stages.length)return;const next=(this.thirdStage+1)as ThirdStage;if(!this.thirdTest&&!this.stageGate(next))return;const transfer=packCampaign(this.runConfig.character,this.player,this.legion,this.followers);transfer.chapter='hulao';this.registry.set(cfg.transferKey,transfer);this.registry.set(cfg.stageKey,next);this.registry.set('runConfig',{...this.runConfig,thirdStage:next});this.resting=false;this.scene.restart();}
 protected finish(victory:boolean,reason:RunEndReason='death'){
  if(this.over)return;super.finish(victory,reason);const last=cfg.stages.length,debug=this.thirdTest||this.debugModified||this.debugJumped||!!this.player.damageImmune,side=cfg.settle?cfg.settle(this.thirdReceipt,this.thirdStage,{victory,debug}):null,reward=side?{provisions:side.provisions}:settleArcExpedition(cfg.arc as WarlordArc,this.thirdReceipt,{victory,bossKilled:this.bossKilled,kills:this.kills,elapsed:this.elapsed,debug,returned:!victory||this.thirdStage===last?this.allies.filter(u=>u.active&&u.reserveSoldier).map(u=>u.kind):[]});
  this.controller?.clear();this.resultTexts.subtitle.setText(victory?this.chapter.victoryText:'率部退守，整军再战');this.resultTexts.body.setText(this.resultTexts.body.text+'\n永久奖励 · 军粮 +'+reward.provisions+(side?side.line:cityIncomeLine(reward as Parameters<typeof cityIncomeLine>[0])));
  const home=this.resultPanel.getByName('result-home')as Phaser.GameObjects.Text;home?.setText(victory?'返回天下地图':'返回主菜单').removeAllListeners('pointerdown').on('pointerdown',()=>{this.registry.remove('campaignTransfer');this.registry.remove(cfg.transferKey);this.scene.start(victory?'WorldMapScene':'MenuScene');});
  const restart=this.resultPanel.getByName('result-restart')as Phaser.GameObjects.Image;restart?.removeAllListeners('pointerdown').on('pointerdown',()=>{this.registry.remove(cfg.transferKey);this.registry.remove('campaignTransfer');this.scene.restart();});
  if(victory&&this.thirdStage<last){this.pendingLevels=0;this.pendingRecruit=false;this.freeRecruit=false;this.resting=true;/* 受伤跨关继承，休整不自动回满，改由军医治疗 */this.renderRecruit();this.setMode('rest');}
 }
};}
