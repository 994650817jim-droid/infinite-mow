import { stopMenuMusic } from '../systems/Music';
import {FollowerSquad,type Follower} from '../systems/FollowerSquad';
import {CharacterPassives} from '../systems/CharacterPassives';
import {FOLLOW} from '../data/recruits';
import type {PlayerStats} from '../types';
import {followersFor,followerLevelCap,heroOwned} from '../systems/RosterStore';
import { StoryDirector, campTalkStrip, setStoryFlag, type StoryCtx } from '../systems/Story';
import { warnCircle, TELEGRAPH_CLASSIC, groundCracks, windupFlash } from '../ui/Telegraph';
import { HINT_MOCK, SHOW_OWN_RANGE_FX, groundScar, keyOutline } from '../ui/HintStyle';
import { warnFx } from '../ui/WarnFx';
import {applyCitySpecialties} from '../systems/CityBonuses';
import {cityIncomeLine} from '../world/WorldStore';
import {CampRestUI} from '../ui/CampRestUI';
import {chapterVictoryNotice} from '../ui/ChapterVictoryNotice';
import {HARD_MODE,HARD_TITLES} from '../data/hardMode';
import {recordHardClear,rewardGrain} from "../world/WorldStore";
import {chapterState,openChapterCount,type TimelineChapterId} from '../world/ChapterTimeline';
import {buildVfx} from '../systems/BuildVfx';
import {AwakeningCombat} from '../systems/AwakeningCombat';
import {BulwarkBuild} from '../systems/BulwarkBuild';
import {ControlBuild} from '../systems/ControlBuild';
import { SHOW_RANGE_RINGS } from '../ui/RangeRings';
import {terrainSurface,architecturalSurface} from '../systems/SceneSurfaces';
import {upgradeIcon} from '../ui/GrowthIcons';
import {BuffHud} from '../ui/BuffHud';
import { type BuffProgress, countProgress, timerProgress } from '../ui/BuffProgress';
import {BuildCombat} from '../systems/BuildCombat';
import {TACTICS,TREASURES,TAG_NAMES,type TacticId} from '../data/builds';
import { applyCharms, wornTokens, type CharmState } from '../systems/CharmEffects';
import { meritFromKills } from '../data/merit';
import { CHARM_LEGEND, CHARM_SCHOOL_NAMES, CHARM_SET_DESC, charmDef, type CharmSchool } from '../data/charms';
import {SishuiObstacles} from '../systems/SishuiObstacles';
import {SishuiPass,type PassHost} from '../systems/SishuiPass';
import {Cutscene,cutsceneAllowed,type CutHost} from '../systems/Cutscene';
import type {CutsceneScript} from '../data/cutscenes/types';
import {DongzhuoLubu} from '../systems/DongzhuoLubu';
import {HuaxiongBoss} from '../systems/HuaxiongBoss';
import {getXingyangEncounter,XINGYANG_AMBUSH} from '../data/xingyang';
import {XurongBoss} from '../systems/XurongBoss';
import {getSishuiEncounter} from '../data/sishui';
import {BattlefieldSupplies,MAX_PROP_SLOTS,POUCH_MAX,potionTexture} from '../systems/BattlefieldSupplies';
import {YellowBattle} from '../systems/YellowBattle';
import {XiliangBattle} from '../systems/XiliangBattle';
import {dongzhuoStageUnlocked,yellowStageUnlocked,unlockedTroopKinds} from '../world/WorldStore';
import {abandonExpedition,beginExpedition,settleExpedition,permanentEffects,worldUnlocked,worldChapterCleared,takeExpeditionReserve} from '../world/WorldStore';
import Phaser from 'phaser';
import { PAD, PAD_LABEL, gamepad, keyHint } from '../platform/gamepad';
import { bossProfile } from '../data/bossMusic';
import { onBattleEnd, unlock as unlockAchievement, addCounter, checkWorld } from '../systems/Achievements';
import { loadWorld as loadWorldState } from '../world/WorldStore';
import { ArtEffects } from '../systems/ArtEffects';
import { BattlefieldDetails } from '../systems/BattlefieldDetails';
import { WAR, warText, ensureWarTextures } from '../ui/WarStyle';
import { LQ, lqButton, lqDivider, lqHitBox, lqImageButton, lqPanel, lqSkin, type LqState } from '../ui/LacquerKit';
import { chapterUnlocked, isChapterTestRun, recordChapterVictory } from '../systems/ChapterProgress';
import { BALANCE, COLORS, DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, IS_DESKTOP, TITLE_FONT, actorDepth, screenPoint } from '../config';
import {upgradeCardTexture,inkUpgradeCardTexture,inkPlate,homeCommand,inkSkin} from '../ui/HomeCommand';
import { RESULT_GOLD, RESULT_IVORY, RESULT_STROKE, buildRewardView, parseHeroLine, playResultAnims, wan, type ResultAnim } from '../ui/ResultRewards';
import { loadBagArt } from '../ui/ItemQuality';
import type { EnemyDef } from '../data/enemies';
import { WEAPON_META, weaponName, buildUpgradeOptions, canOfferRejuvenation } from '../data/upgrades';
import { waveIndexAt } from '../data/waves';
import { getChapter, getBattleChapter, chapterBossTime, type ChapterDef } from '../data/chapters';
import { BattleFeedback } from '../systems/BattleFeedback';
import { LubuBoss } from '../systems/LubuBoss';
import { ZhangjiaoBoss } from '../systems/ZhangjiaoBoss';
import { BOSS_OLD, type BossDebug } from '../systems/BossKit';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Joystick } from '../ui/Joystick';
import { PassiveHud } from '../ui/PassiveHud';
import { PassiveShout } from '../ui/PassiveShout';
import { EnemyMovement } from '../systems/EnemyMovement';
import { Legion } from '../systems/Legion';
import { LegionUI } from '../ui/LegionUI';
import { Reinforcements } from '../systems/Reinforcements';
import { MartialFields } from '../systems/MartialFields';
import { RunGrowth, ATTRIBUTE_INFO, ATTRIBUTE_MAX, attributeIcon, type AttributeId } from '../systems/RunGrowth';
import { addMerit, addScrolls, getXinde, SCROLL, temperBonus } from '../systems/MasteryStore';
import { primaryAttribute, PRIMARY_PERK, PRIMARY_PERK_INFO, PRIMARY_TIERS, PRIMARY_MUL, SPELL_WEAPONS } from '../data/attributes';
import { stageCleared, takeAttrNotice } from '../systems/HeroProgress';
import { allocateHeroAttr, claimFirstClear, creditHeroXp, enlistHero, heroFreePoints, heroInfo, heroLevel, levelCap, setHeroProgress, type HeroKey } from '../systems/HeroProgress';
import { HERO_XP_RATE, OVERFLOW_XP_PER_GRAIN, PICK_GUARANTEE, PICK_PACE } from '../data/heroLevels';
import { addProvisions } from '../world/WorldStore';
import { medicChapter } from '../data/campMedic';
import { applyCarriedHp, patchCampaignHp, loadCampaignBuild, packCampaign, restoreCampaign, saveCampaignBuild, type CampaignTransfer } from '../systems/Campaign';
import { TROOP_KINDS, INITIAL_TROOPS, LEGION, FREE_RECRUIT_BY_TIER, type TroopKind } from '../data/legion';
import { DEFAULT_RUN_CONFIG, getCharacter, type RunConfig , HERO_TINT, HERO_FX, type CharacterId } from '../data/characters';
import { Music } from '../systems/Music';
import { battleThemeFor } from '../systems/EpicBgm';
import { Sfx } from '../systems/Sfx';
import { FOLLOWER_ATTACK_SFX, TROOP_ATTACK_SFX } from '../systems/HeroSfx';
import { SpatialGrid } from '../systems/SpatialGrid';
import { Ally, type AllyKind } from '../entities/Ally';
import { WEAPON_BEHAVIORS, WEAPON_DEFS, type WeaponHost, type WeaponBolt as Bolt, type SpearShot } from '../weapons/registry';
import type { RunEndReason, RunStats, UpgradeOption, WeaponState } from '../types';
import {ItemDrops} from '../systems/ItemDrops';
import {BossRelics, RELIC} from '../systems/BossRelics';
import {FireShips} from '../systems/FireShips';
import {gearFor} from '../systems/ItemEffects';
import {addItems,claimRunLoot,depositRunLoot,grantHorse,heroHorse,ownedHorses} from '../systems/ItemStore';
import {STARTER_HORSE} from '../data/mounts';
import {storyScroll} from '../ui/StoryScroll';
import {MERCHANT_HORSE_REWARD,markMerchantStorySeen,merchantHorseLines,merchantStorySeen} from '../data/storyMerchantHorse';
import {horseForReward} from '../data/mounts';
import {HeroMount} from '../systems/HeroMount';
import { DraggingBladeFx } from '../systems/DraggingBladeFx';
import { FlankFx } from '../systems/FlankFx';
import { WindstepFx } from '../systems/WindstepFx';
import { EnvInteractions } from '../systems/EnvInteractions';
import { envConfigFor } from '../data/envInteractions';
import { Terrain } from '../systems/Terrain';
import { attrBadge } from '../ui/AttrBadge';
import { PROP_LOOT, rollPropItem, type PropLootKind } from '../data/propLoot';
import { terrainConfigFor } from '../data/terrain';
import { Tutorial } from '../systems/Tutorial';
import { IffOverlay, readIffMode, warmIffTextures, type IffUnit } from '../systems/IffOverlay';
import {BARKS_LABEL, heroBarks, setHeroBarks, type HeroBarks, STORY_LABEL, setStoryMode, storyMode, type StoryMode, OPENING_LABEL, openingMode, setOpeningMode, type OpeningMode } from '../systems/BattleSettings';
import { HeroBark, type BarkSpeaker } from '../ui/HeroBark';
import { ZhaoyunPassiveFx } from '../systems/ZhaoyunPassiveFx';
import { BossPresence } from '../systems/BossPresence';
import { DAMAGE_LABEL, OUTLINE_LABEL, SCALE_LABEL, SHAKE_LABEL, WIDTH_LABEL, cycle, damageNumbers, outlineMode, outlineWidth, renderScaleSetting, setDamageNumbers, setOutlineMode, setOutlineWidth, setRenderScaleSetting, setShakeLevel, shakeLevel, shakeScale, type DamageNumbers, type OutlineMode, type OutlineWidth, type RenderScaleSetting, type ShakeLevel } from '../systems/BattleSettings';
import { tutorialReplayLink } from '../ui/TutorialOverlay';
import { beginBattle, commitBattle, rollbackBattle } from '../systems/BattleSnapshot';
import { reloadGame } from '../systems/SaveSlots';
import { BOOT_TO_KEY } from '../systems/BattleSnapshot';
import { BossMoveset } from '../systems/BossMoveset';
import { BossMount } from '../systems/BossMount';
import { watchBossPhase } from '../systems/BossPhase';
import { BOSS_MOUNTS, BOSS_MOVES } from '../data/bossMoves';
import type {ItemInstance} from '../data/items';
import {armShield,absorbShield,ShieldBars} from '../systems/ShieldGuard';
import {StageObjectives} from '../systems/StageObjectives';
import {itemName,relicDef,SPECIALS} from '../data/items';
import {BossChest,playBossFall,type ChestLoot} from '../systems/BossChest';
import {preloadBossDeath} from '../systems/BossDeathArt';
import {ItemBagUI} from '../ui/ItemBagUI';
import { enemyArrowTexture } from '../systems/ArrowPalette';
import { HitFeel, BossStagger } from '../systems/HitFeel';
/** 武将序列帧的透明度与时长（缺省 1 / 450 毫秒）。2026-11-17 用户：「张飞攻击特效有点太夸张」「魏延也是」→ 张飞声浪 / 断桥怒吼、魏延劈地 / 裂波 / 谁敢杀我 调淡、调短。 */
const HERO_FX_TONE: Record<string, { alpha: number; ms: number }> = {
  roarWave: { alpha: .62, ms: 340 }, roar: { alpha: .7, ms: 380 },
  weiyanSlash: { alpha: .72, ms: 340 }, crack: { alpha: .7, ms: 360 }, whoDares: { alpha: .68, ms: 400 },
};
import { HIT_FEEL, BOSS_FEEL, WEAPON_HIT_TYPE } from '../data/hitFeel';
import { GEM_FX } from '../data/gemFx';

interface Gem {
  img: Phaser.GameObjects.Image;
  value: number;
  vx: number;
  vy: number;
  active: boolean;
  /** 落地缓冲（毫秒）：先落地，再从磁吸范围吸附。 */
  restMs: number;
  /** 军功信物手感（2026-11-18，data/gemFx.ts）：掉落 → 落地浮动 → 吸取。phase 开始时刻 at；掉落起点 sx/sy、落点 lx/ly；吸取速度 speed */
  phase: 'drop' | 'rest' | 'fly'; at: number; sx: number; sy: number; lx: number; ly: number; speed: number;
  /** 降级（不画光晕 / 残影、不闪光）；随机相位让一地信物不同步浮动 */
  lite: boolean; seed: number; large: boolean;
  /** 手绘光晕与吸取残影（同槽复用） */
  glow?: Phaser.GameObjects.Image; ghost?: Phaser.GameObjects.Image;
}

interface DmgFx {
  crit: boolean;
  /** 伤害数字样式（2026-11-17 用户：「造成伤害字体也改优化一下」）：普通 / 暴击 / 技艺法术 / 首领 / 治疗 / 部曲随行 */
  kind: DmgKind;
  text: Phaser.GameObjects.Text;
  /** 暴击时数字左侧的小「暴」字 */
  tag?: Phaser.GameObjects.Text;
  life: number;
  vx: number;
  vy: number;
  active: boolean;
}
type DmgKind = 'hit' | 'crit' | 'spell' | 'boss' | 'heal' | 'ally';
/** 数字字体：粗黑体（小字号也清楚，不用书法体），深色描边 + 细投影。 */
const DMG_FONT = '"Bahnschrift","Arial Black","Segoe UI Black","Helvetica Neue",Arial,sans-serif';
const DMG_STYLE: Record<DmgKind, { size: number; color: string; stroke: string; sw: number }> = {
  hit: { size: 15, color: '#f6e6bf', stroke: '#2a1608', sw: 3 },
  crit: { size: 30, color: '#ffcf45', stroke: '#8c1c0a', sw: 5 }, // 2026-11-18 用户：不要「暴」字，字再大一些
  spell: { size: 15, color: '#86e8f2', stroke: '#0c2f3c', sw: 3 },
  boss: { size: 18, color: '#ffe9c4', stroke: '#3a1206', sw: 4 },
  heal: { size: 15, color: '#8ff08a', stroke: '#123a10', sw: 3 },
  ally: { size: 12, color: '#e6dcc4', stroke: '#2a1a0c', sw: 3 },
};
const DMG_LIFE = .62;

interface CardView {
  bg: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  desc: Phaser.GameObjects.Text;
  tag: Phaser.GameObjects.Text;
  /** 卡片容器：入场滑入与悬停上浮作用在整张卡上。 */
  root: Phaser.GameObjects.Container;
  rule: Phaser.GameObjects.Graphics;
  hint: Phaser.GameObjects.Text;
  w: number; h: number; baseY: number; medal: { x: number; y: number; r: number };
  accent: number; rare: boolean; hover: boolean; lift: number;
}
/** 三选一卡片类别色。 */
const UPGRADE_ACCENT: Record<string, number> = { weapon: 0xc9973a, martial: 0x2f9e7e, tactic: 0x2f8a8a, treasure: 0xd08f2a, attribute: 0x3f78a8, potion: 0xb04a32, trinket: 0x8a5cb8, foundation: 0x7a8a46, relic: 0xc9a030, rare: 0xb04a3a, passive: 0x4a8a6a };

interface ChasingBoss {enemy:Enemy;life:number;stage:number;name:string;battle:YellowBattle|null;huaxiong:HuaxiongBoss|null;xurong:XurongBoss|null;label:Phaser.GameObjects.Text;}

/** story：战中剧情卷轴（第七章落凤坡等），只冻结战斗、不显示其他面板。 */
type Mode = 'none' | 'levelup' | 'pause' | 'attributes' | 'result' | 'recruit' | 'aid' | 'rest' | 'bossloot' | 'parley' | 'story';

export class GameScene extends Phaser.Scene {
  protected player!: Player;
  protected joystick!: Joystick;
  protected potionCaption?: Phaser.GameObjects.Text;
  protected pauseKeysText?: Phaser.GameObjects.Text;
  private expeditionId="";
  private worldCampaign=false;
  /** 乱世难度（天下地图对已平定章节发起）：敌军生命 / 伤害放大，见 data/hardMode.ts。 */
  protected hardMode=false;
  private huaxiong:HuaxiongBoss|null=null;private xurong:XurongBoss|null=null;
  protected sishuiObstacles:SishuiObstacles|null=null;
  /** 正在播的过场动画（systems/Cutscene.ts）。 */
  cutscene:Cutscene|null=null;
  /** 最近一段过场（测试读日志用）。 */
  lastCutscene:Cutscene|null=null;
  /** 过场结束的时刻（真实时间 ms）：过场中与结束后 1 秒内压住武将台词（HeroBark），免得镜头刚回来就冒「来将通名！」。 */
  private cutsceneEndedAt=-Infinity;
  /** 排队中的首领台词（剧情台词之后主将接一句）；过场开播时取消。 */
  private bossBarkTimer?:Phaser.Time.TimerEvent;
  barksMuted():boolean{return !!this.cutscene?.active||performance.now()-this.cutsceneEndedAt<1000;}
  /** 播过场：战斗暂停（story 模式）、HUD 藏起；剧情设置关掉时不播，返回 false（调用方走原来的演出）。播完或跳过都回调 done。 */
  playCutscene(script:CutsceneScript,anchors:CutHost['anchors'],done:(skipped:boolean)=>void):boolean{
    if(!cutsceneAllowed(script)||this.over)return false;
    const was=this.mode;this.setMode('story');this.bossBarkTimer?.remove();this.bossBarkTimer=undefined;this.heroBark?.clear(); /* 开播前已冒出的武将台词也收掉（补间暂停时会一直挂着） */
    this.cutscene=new Cutscene({scene:this,anchors:{player:this.player.sprite,...anchors},heroes:()=>[this.runConfig.character,...(this.followers?.members??[]).map(m=>m.recruit.hero??'')].filter(Boolean),sfx:k=>this.sfx.play(k),music:d=>this.music.setDuck(d)},script,skipped=>{
      this.lastCutscene=this.cutscene;this.cutscene=null;this.cutsceneEndedAt=performance.now();if(!this.over&&this.mode==='story')this.setMode(was==='story'?'none':was);done(skipped);this.hudAcc=1;this.updateHud(); /* 结束状态（如首领倒下）立刻反映到刚恢复的 HUD，免得首领血条闪一下 */});
    return true;
  }
  /** 场上某武将的精灵（主将或随行），不在场返回 undefined。 */
  heroSprite(id:string):{x:number;y:number}|undefined{if(this.runConfig.character===id)return this.player.sprite;return this.followers?.members.find(m=>m.recruit.hero===id&&m.sprite.active)?.sprite;}
  /** 关墙 / 箭楼 / 营帐 / 关门的宿主（2-1 汜水关；第 3~12 章关隘、城池复用，见 data/arcForts.ts）。 */
  protected passHost():PassHost{const sup=this.supplies;return{scene:this,player:this.player,legion:this.legion,now:()=>this.combatNow,elapsed:()=>this.elapsed,wave:()=>this.waveIndex,
    spawn:(k,x,y)=>this.spawnEnemy(k,x,y,1,true),spawnTower:(x,y,hp)=>sup?.spawnCamp(x,y,hp)??null,placeTent:(x,y,id,hp,f)=>this.env?.placeTent(x,y,id,hp,f??1)??null,envReady:()=>!!this.env,
    banner:(t,d,c)=>this.showWaveBanner(t,d,c),sfx:k=>this.sfx.play(k),merit:(e,b)=>{this.runMerit.elite+=e;this.runMerit.boss+=b;},
    guanyu:()=>this.runConfig.character==='guanyu'||followersFor(this.runConfig.character).some(r=>r.hero==='guanyu')};}
  /** 2-1 汜水关：关墙、箭楼、西凉营帐、关门（systems/SishuiPass.ts）。 */
  sishuiPass:SishuiPass|null=null;
  /** 2-3 洛阳：董卓与吕布同场（systems/DongzhuoLubu.ts）。 */
  dzLubu:DongzhuoLubu|null=null;
  protected runConfig: RunConfig = DEFAULT_RUN_CONFIG;
  protected chapter: ChapterDef = getChapter();
  protected lubu: LubuBoss | null = null;
  /** 张角重设计样板（?boss=old 回到旧版）。 */
  protected zhangjiao: ZhangjiaoBoss | null = null;
  /** 首领招式框架（第一章张梁 / 张宝等，配置见 data/bossMoves.ts）。 */
  moveset: BossMoveset | null = null;
  /** 已有专属控制器的骑马首领（吕布、华雄）的坐骑：半血随 boss-phase 坠马。 */
  bossMount: BossMount | null = null;
  protected yellow:YellowBattle|null=null;
  /** 第二章主线（汜水关 / 荥阳 / 虎牢关）西凉军战法：铁骑突阵、飞熊军。攻守城与军情战斗（encounter）不启用。 */
  protected xiliang:XiliangBattle|null=null;
  /** 骑马（行囊坐骑槽有马时）。 */
  protected mount:HeroMount|null=null;
  /** 关羽拖刀斩表现（拿到修习后首次用到时创建，场景重启时清空）。 */
  protected dragFx?: DraggingBladeFx;
  /** 战法迂回袭表现（拥有该战法后首次用到时创建，场景重启时清空）。 */
  protected flankFx?: FlankFx;
  /** 战法踏风步表现（同上，拥有后首次用到时创建）。 */
  protected windFx?: WindstepFx;
  /** 游击战法移动风痕下次可出现的时间（combatNow）。 */
  private skirmishPuffAt = 0;
  /** 场地环境互动（火油桶 / 军旗 / 营帐）；首次更新时按场景与章节创建，场景重启时清空。 */
  env: EnvInteractions | null = null;
  /** 新手引导（第一次进 1-1 时情境式教学，见 systems/Tutorial.ts）。 */
  tutorial?: Tutorial;
  private envInit = false;
  /** 战场地形层（树 / 树林、河、桥；data/terrain.ts 按篇章与关配置） */
  /** 本关障碍物已掉的兵装件数（每关上限 PROP_LOOT.perStageItems）与掉落随机源（测试可换） */
  propItems = 0; propRng: () => number = Math.random;
  protected terrain: Terrain | null = null; private terrainInit = false; private terrainNav: Array<{left:number;right:number;top:number;bottom:number}> = [];
  windstepFx(): WindstepFx { if (!this.windFx) { this.windFx = new WindstepFx(this, this.player, this.sfx); this.events.once('shutdown', () => { this.windFx?.destroy(); this.windFx = undefined; }); } return this.windFx; }
  flankBladeFx(): FlankFx { if (!this.flankFx) { this.flankFx = new FlankFx(this, this.player, this.sfx); this.events.once('shutdown', () => { this.flankFx?.destroy(); this.flankFx = undefined; }); } return this.flankFx; }
  /** 敌我区分叠加层（默认阵营色；设置开启描边；?iff=0 关闭）。 */
  iff: IffOverlay | null = null;
  /** 首领存在感：放大、脚下火环、光晕、头顶名牌、登场暗场与镜头、屏外箭头（systems/BossPresence.ts）。 */
  presence: BossPresence | null = null;
  /** 敌我区分叠加层要处理的单位：敌军、部曲（仅已在屏上的）、随行武将。 */
  protected *iffUnits(): Generator<IffUnit> {
    // 第一章全是黄巾军：通用敌兵图（弓手 / 盾兵 / 骑兵 / 将校）也按黄巾染黄，不按图集名染红
    const yellow = this.chapter.id === 'huangjin';
    for (const e of this.enemies) if (e.active && !e.isSupplySlot && e.def.behavior !== 'wall') yield { sprite: e.sprite, foot: e.shadow, side: 'enemy', rank: e.kind === 'boss' ? 'boss' : e.kind === 'elite' ? 'elite' : 'normal', visible: e.sprite.visible, yellow };
    for (const a of this.allies) if (a.active && a.view) yield { sprite: a.view.sprite, foot: a.view.shadow, side: 'ally', rank: 'normal', visible: a.view.sprite.visible };
    for (const m of this.followers?.members ?? []) yield { sprite: m.sprite, foot: m.shadow, side: 'ally', rank: 'elite', visible: m.sprite.visible, keepColors: true };
    // 黄巾力士（首领遗珍召出的符兵）：我方描边、保持金白原画（2026-11-18）
    for (const l of this.relics?.lishiUnits() ?? []) yield { sprite: l.sprite, foot: l.foot, side: 'ally', rank: 'normal', visible: l.visible, keepColors: true };
  }
  dragBladeFx(): DraggingBladeFx { if (!this.dragFx) { this.dragFx = new DraggingBladeFx(this, this.player, this.sfx); this.events.once('shutdown', () => { this.dragFx?.destroy(); this.dragFx = undefined; }); } return this.dragFx; }
  /** 随行武将（招贤馆，RECRUIT_PLAN.md §4）。 */
  followers:FollowerSquad|null=null;
  /** 盾牌兵两段血：盾条与碎盾效果（data/shields.ts）。 */
  private shieldBars:ShieldBars|null=null;
  /** 关卡目标（歼敌 / 摧毁 / 护送 / 坚守，data/objectives.ts）：完成后首领出阵。 */
  protected objective:StageObjectives|null=null;private objectiveText?:Phaser.GameObjects.Text;
  protected supplies:BattlefieldSupplies|null=null;
  /** 道具掉落与本局缴获（局外兵装，结算带回行囊）。 */
  protected itemDrops:ItemDrops|null=null;
  /** 征程构筑：本关是否为重打 / 非主线（不读不存）；本关是否从存档恢复了构筑。 */
  protected campaignReplay=false;protected campaignLoaded=false;
  /** 战功（存档货币，data/merit.ts）：本场击杀的精英 / 首领数。 */
  protected runMerit={elite:0,boss:0};
  /** 首领遗珍的战斗机制（按穿戴的 specials）；楼船令旗复用火船。 */
  protected relics:BossRelics|null=null;protected relicShips:FireShips|null=null;
  /** 相国印：本次升级还能再选几张、免费换一批几次。 */
  private relicExtraPicks=0;private relicFreeRerolls=0;
  private yellowAltar:Phaser.GameObjects.Image|null=null;
  private finaleFadeMs=0;
  protected sfx!: Sfx;
  protected music = new Music();
  protected muteText: Phaser.GameObjects.Text | null = null;
  protected devText: Phaser.GameObjects.Text | null = null;
  protected devAcc = 0;
  protected debugChains: number[][] = [];
  protected perf?: {
    panel: Phaser.GameObjects.Container;
    bg: Phaser.GameObjects.Rectangle;
    text: Phaser.GameObjects.Text;
    copyBg: Phaser.GameObjects.Rectangle;
    copyText: Phaser.GameObjects.Text;
    toggle: Phaser.GameObjects.Text;
    collapsed: boolean;
    summary: Phaser.GameObjects.Text;
    frameMs: number[];
    samples: Array<{ fps: number; enemies: number }>;
    startAt: number;
    acc: number;
    playMs: number;
    pausedMs: number;
    backgroundMs: number;
    hiddenAt: number;
    maxEnemies: number;
    maxProjectiles: number;
  };
  protected debugJumped = false;
  protected feedback!: BattleFeedback;
  /** 打击感：顿帧 / 慢动作 / 震屏（统一时间倍率）与首领破势、白色残血条（2026-11-17） */
  hitFeel!: HitFeel;
  bossStagger = new BossStagger();
  private lastHudReal = 0;
  /** 治疗数字累加（见 create 里包的 player.heal） */
  private healAcc = 0; private healShowAt = 0;
  /** 测试用：强制本次命中暴击 / 不暴击（null = 正常掷骰） */
  debugCrit: boolean | null = null;
  private readonly separationScratch: Enemy[] = [];
  private readonly enemyMovement = new EnemyMovement();
  protected crowdSteering = true;
  private readonly allyScratch: Enemy[] = [];
  private hudAcc = 1;
  private lastHudMode = '';
  private artEffects!: ArtEffects;
  protected battlefieldDetails!: BattlefieldDetails;
  protected ground!: Phaser.GameObjects.TileSprite;
  protected hudGfx!: Phaser.GameObjects.Graphics;
  /** 右上角暂停 / 音效 / 音乐的漆金底板状态（悬停 / 按下），随 HUD 每帧重绘。 */
  private hudChipState: Record<'pause' | 'mute' | 'music' | 'bag', LqState> = { pause: 'idle', mute: 'idle', music: 'idle', bag: 'idle' };
  private readonly hudChipRect = new Phaser.Geom.Rectangle();
  protected hudTexts!: Record<string, Phaser.GameObjects.Text>;
  protected passiveHud!: PassiveHud; protected passiveShout!: PassiveShout; protected heroBark!: HeroBark;
  /** 赵云被动「七进七出」：脚下龙鳞层数 + 满层白龙枪芒 / 绕身一闪 / 突进残影。 */
  zhaoyunFx!: ZhaoyunPassiveFx;
  private buffHud!:BuffHud;
  /** 用药：药囊里最早的一份，按原规则回血；不能用时轻微提示。 */
  protected usePotion():void{
    if(this.mode!=='none'||this.over||!this.supplies)return;
    const item=this.supplies.usePotion();
    if(!item){if(this.supplies.pouch.length)this.showWaveBanner(this.supplies.healing?'正在疗伤…':'生命已满',false);return;}
    addCounter('potions',1);this.sfx.play('pickup');this.artEffects.show(5,this.player.x,this.player.y-12,40,this.combatNow,320);
  }
  /** 战法「以战养战」：每击杀 12/10/8 名敌人（含部下击杀）回复最大生命 2/2.5/3%。 */
  private warfeedCount=0;
  /** 增益图标的触发进度（BuffHud 读，见 ui/BuffProgress）：战法 / 宝物 / 觉醒 / 遗物里的「每 N 次 / 每 N 秒 / 攒满」计数。 */
  private buffProgress(id:string,now:number):BuffProgress|null{
    if(id.startsWith('awakening_'))return this.awakeningCombat?.progress(id.slice(10),now)??null;
    if(id==='tactic_warfeed'){const l=this.player.growth.build.level('warfeed');if(!l)return null;const n=[12,10,8][Math.min(3,l)-1];return countProgress(this.warfeedCount,n,'再击杀 1 名回血','名');}
    if(id==='relic_heaven_ember')return timerProgress(this.relicFireAt,CHARM_LEGEND.charm_heaven_ember.cd[this.player.growth.charmLegend.heaven_ember??1],now,'下一击留残火','冷却');
    return this.buildCombat?.progress(id,now)??this.legion?.command.progress(id,now)??null;
  }
  private warfeedKill():void{
    const level=this.player.growth.build.level('warfeed');if(!level||!this.player.alive)return;
    const i=Math.min(3,level)-1;if(++this.warfeedCount<[12,10,8][i])return;
    this.warfeedCount=0;if(this.player.hp>=this.player.maxHp)return;
    this.player.heal(this.player.maxHp*[.02,.025,.03][i]);
    this.artEffects.show(5,this.player.x,this.player.y-10,48,this.combatNow,320);
  }
  /** 饮血佩：本命命中回复伤害 5%，每秒（战斗时间）最多回复最大生命 3%。 */
  private bloodWindow=-1;private bloodHealed=0;
  /**
   * 站立蓄势提示（百步穿杨）。2026-11-16 试玩反馈「技能范围提示太丑」：不再画 5 段蓄势环，
   * 只在满势时脚下泛起一圈很淡的金光（叠加混合、缓慢明暗）。旧画法见 git 历史，需要时可直接恢复。
   */
  private drawAimIndicator():void{
    if(SHOW_RANGE_RINGS){this.drawAimRing();return;}
    const g=this.aimIndicator,sec=this.player.growth.stationarySeconds,full=this.player.growth.masteries.steady_aim>0&&sec>=4.99&&this.player.alive;
    g.clear().setVisible(full);if(!full)return;
    const x=this.player.x,y=this.player.y+19,pulse=.14+.08*Math.sin(this.combatNow/260);
    g.setBlendMode(Phaser.BlendModes.ADD).fillStyle(0xffd66b,pulse).fillEllipse(x,y,70,24).fillStyle(0xfff2c0,pulse*.9).fillEllipse(x,y,38,13);
  }
  /** 旧的 5 段站立蓄势环（?rings=1 对比用）。 */
  private drawAimRing():void{
    const g=this.aimIndicator,sec=this.player.growth.stationarySeconds,on=this.player.growth.masteries.steady_aim>0&&sec>.05&&this.player.alive;
    g.clear().setVisible(on);if(!on)return;
    const x=this.player.x,y=this.player.y+19,rx=30,ry=11,full=sec>=4.99,arc=(a0:number,a1:number)=>{g.beginPath();for(let a=a0;a<=a1+.001;a+=Math.PI/36){const px=x+Math.cos(a)*rx,py=y+Math.sin(a)*ry;if(a===a0)g.moveTo(px,py);else g.lineTo(px,py);}g.strokePath();};
    const seg=Math.PI*2/5,gap=.12;
    for(let i=0;i<5;i++){const a0=-Math.PI/2+i*seg+gap/2,fill=Phaser.Math.Clamp(sec-i,0,1);g.lineStyle(3,0x18251e,.45);arc(a0,a0+seg-gap);if(fill>0){g.lineStyle(full?3.5:2.5,full?0xffe08a:0xe0c070,full?1:.55+.4*fill);arc(a0,a0+(seg-gap)*fill);}}
    if(full){const pulse=.35+.3*Math.sin(this.combatNow/160);g.lineStyle(5,0xffd66b,pulse);g.strokeEllipse(x,y,rx*2+10,ry*2+6);}
  }
  private bloodJadeHeal(damage:number,time:number):void{
    if(this.bloodWindow<0||time<this.bloodWindow||time-this.bloodWindow>=1000){this.bloodWindow=time;this.bloodHealed=0;}
    const amount=Math.min(damage*.05*this.player.growth.build.power('blood_jade'),this.player.maxHp*.03-this.bloodHealed);
    if(amount<=0||this.player.hp>=this.player.maxHp)return;
    this.bloodHealed+=amount;this.player.heal(amount);
  }
  protected blades: Phaser.GameObjects.Image[] = [];
  protected grid = new SpatialGrid<Enemy>(48);

  protected enemies: Enemy[] = [];
  protected bolts: Bolt[] = [];
  protected bullets: Bolt[] = [];
  protected gems: Gem[] = [];
  protected dmgFx: DmgFx[] = [];
  private navigationAt=0;

  /** 游戏内毫秒时钟：暂停、升级和招募期间冻结。 */
  combatNow = 0;
  protected elapsed = 0;
  protected kills = 0;
  protected damageDealt = 0;
  protected playerDamageDealt = 0;
  protected allyDamageDealt = 0;
  protected spawnTimer = 0.5;
  protected eliteTimer: number = BALANCE.eliteFirst;
  protected boss: Enemy | null = null;
  protected bossSpawned = false;
  protected bossCastCd = 3;
  protected bossSummonCd = 6;
  protected bossEnergy = 0;
  protected bossOrbCd = 1.8;
  protected bossFanCd = 6;
  protected bossUltPhase: 'none' | 'charge' | 'warn' | 'strike' | 'recover' = 'none';
  protected bossUltAt = 0;
  protected bossUltPoints: Array<{ x: number; y: number }> = [];
  protected bossUltRound = 0;
  protected bossUltHits = 0;
  protected bossPhase2 = false;
  protected bossShield = 0;
  protected bossShieldGfx: Phaser.GameObjects.Graphics | null = null;
  protected bossSummons: Array<{ enemy: Enemy; spawnId: number }> = [];
  protected bossUltGfx!: Phaser.GameObjects.Graphics;
  protected bossKilled = false;
  protected orbitAngle = 0;

  protected mode: Mode = 'none';
  /** 剧情（关前章头 / 军情 / 羁绊、首领登场 / 倒下、章末；2026-11-17 systems/Story.ts） */
  storyDir!: StoryDirector;
  protected over = false;
  protected victory = false;
  protected pendingLevels = 0;
  protected upgradeOptions: UpgradeOption[] = [];

  protected levelPanel!: Phaser.GameObjects.Container;
  protected cardViews: CardView[] = [];
  protected relicIcons: Phaser.GameObjects.Image[] = [];
  protected allies: Ally[] = [];
  protected legion!: Legion;
  protected legionUI!: LegionUI;
  protected reinforcements!: Reinforcements;
  protected freeRecruit = false;
  protected resting = false;
  /** 本关已播放过“入营”水墨过场（每关一次；场景重开即重置）。 */
  private restIntroPlayed = false;
  private restIntroSkip?: () => void;
  protected campUI?:CampRestUI;
  protected readonly recruitedWaves = new Set<number>();
  private readonly legionBulletScratch: Ally[] = [];
  protected spearShots: SpearShot[] = [];
  protected weaponHost!: WeaponHost;
  private martialFields!: MartialFields;
  private buildCombat!:BuildCombat;
  private controlBuild?:ControlBuild;
  private bulwarkBuild?:BulwarkBuild;
  private awakeningCombat?:AwakeningCombat;
  private relicWaveGfx!:Phaser.GameObjects.Graphics;private relicWaves:Array<{x:number;y:number;at:number}>=[];
  private firstBossAt=-1;private settledFrontlineKills=0;private frontlineNextSettlement=1;
  private frontlineVictories=new Map<number,{elapsed:number}>();private frontlineStarts=new Map<number,number>();
  private chasingBosses:ChasingBoss[]=[];private deadBossControllers:Array<HuaxiongBoss|XurongBoss>=[];
  private get trailingBoss():ChasingBoss|null{return this.chasingBosses[0]??null;}
  /** 首领倒地后掉的宝箱（捡起遗物才进下一阶段）。 */
  protected bossChests:BossChest[]=[];
  /** 刚倒下的首领朝向（用了倒地 4 帧时 ±1）：宝箱往前偏开尸体。 */
  private bossFallDir=0;
  private lootContinue:(()=>void)|null=null;private relicHits=0;private relicFireAt=0;private relicHealAt=0;
  /** 穿着的信物库新信物（开局 / 换装后由 applyCharms 算出）。 */
  protected charmInfo:CharmState|null=null;
  private attributeReturn:'pause'|'none'='pause';private rerolls=0;private rerollButton?:Phaser.GameObjects.Text;private pointsButton?:Phaser.GameObjects.Container;private pointsBadge?:Phaser.GameObjects.Text;
  /** 用药按钮（药囊）：拾取的药收起，手动使用。 */
  private potionButton?:Phaser.GameObjects.Container;private potionBadge?:Phaser.GameObjects.Text;private potionIcon?:Phaser.GameObjects.Image;private potionGlow?:Phaser.GameObjects.Arc;
  /** 黄忠「百步穿杨」站立蓄势：脚下五段金色椭圆环（原为头顶 ◆◇ 文字，与“主将”标签重叠）。 */
  private aimIndicator!: Phaser.GameObjects.Graphics;
  protected recruitOptions: Array<{ kind: AllyKind; upgrade: boolean }> = [];
  private readonly pendingGrowthNotices: string[] = [];
  protected recruitViews: Array<{ bg: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; desc: Phaser.GameObjects.Text; icon: Phaser.GameObjects.Image; tag: Phaser.GameObjects.Text }> = [];
  protected recruitPanel!: Phaser.GameObjects.Container;
  protected pendingRecruit = false;
  protected recruitCountText: Phaser.GameObjects.Text | null = null;
  protected relicExpanded = false;
  protected waveIndex = -1;
  protected waveBannerShown = false;
  protected bossWarned = false;
  protected chargeGfx!: Phaser.GameObjects.Graphics;
  protected resultPanel!: Phaser.GameObjects.Container;
  private layoutResultButtons?: () => void;
  protected resultTexts!: Record<string, Phaser.GameObjects.Text>;
  /** 结算动画是否放完（测试读）；resultAnimSkip 跳到结尾。resultTop / resultH 为电脑版结算卷位置。 */
  resultAnimDone = true;
  private resultAnimSkip: (() => void) | null = null;
  private resultTop = 0; private resultH = 0;
  protected pausePanel!: Phaser.GameObjects.Container;
  protected attributePanel!: Phaser.GameObjects.Container;
  protected attributePauseText!: Phaser.GameObjects.Text;
  protected attributePointsText!: Phaser.GameObjects.Text;
  protected attributeWeaponText!: Phaser.GameObjects.Text;
  protected attributeSummaryText!: Phaser.GameObjects.Text;
  protected attributeRows: Array<{ value: Phaser.GameObjects.Text; button: Phaser.GameObjects.Image; plus: Phaser.GameObjects.Text; pips: Phaser.GameObjects.Graphics; pipX: number; pipY: number; perkG?: Phaser.GameObjects.Graphics; perkX?: number; perkY?: number; ink?: { plate: Phaser.GameObjects.NineSlice | null; hover: boolean } }> = [];

  protected cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  protected wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  protected hintText: Phaser.GameObjects.Text | null = null;
  protected debugModified = false;
  protected devTimeScale = 1;
  protected debugMove = new Phaser.Math.Vector2();
  protected debugMoveActive = false;

  constructor(key='GameScene') {
    super(key);
  }

  /** 本场开打时是否已有驽马（第一章通关剧情「中山商旅 · 献马」只给还没有马的存档播；老存档已有驽马不补弹）。 */
  protected hadStarterHorse = true;
  /** 游戏实际在用的马厩读写（测试走这里：常开的 dev server 热更新后，测试自己 import 的 ItemStore 可能是另一个模块实例，内存缓存不同步）。 */
  readonly stable = { ownedHorses, grantHorse };
  create(): void {
    // 中途退出不算：进关先记下存档，告捷 / 战败才丢掉（systems/BattleSnapshot.ts）
    beginBattle(this.scene.key);
    stopMenuMusic();
    this.hadStarterHorse = ownedHorses().some(h => h.id === STARTER_HORSE);
    this.resetState();
    ensureWarTextures(this);
    this.hudAcc = 1; this.lastHudMode = '';
    this.feedback = new BattleFeedback(this);
    this.hitFeel = new HitFeel(this); this.bossStagger = new BossStagger();
    this.events.once('shutdown', () => { this.anims.globalTimeScale = 1; });
    this.sfx = new Sfx();
    const registryConfig = this.registry.get('runConfig') as RunConfig | undefined;
    const requested = getBattleChapter(registryConfig?.chapter, registryConfig?.stage,registryConfig?.westStage);
    this.chapter = (chapterUnlocked(requested.id) && (!requested.stage || yellowStageUnlocked(requested.stage)) && (!requested.westStage||dongzhuoStageUnlocked(requested.westStage))) || isChapterTestRun() ? requested : getBattleChapter('huangjin',1);
    const encounter=new URLSearchParams(location.search).get('encounter')||registryConfig?.encounter;const preview=encounter==='sishui'||encounter==='xingyang'||encounter==='qunxiong'&&!!this.customChapter();
    if(preview)this.chapter=encounter==='xingyang'?getXingyangEncounter():getSishuiEncounter();
    this.chapter=this.customChapter()??this.chapter;
    this.runConfig = { ...DEFAULT_RUN_CONFIG, ...registryConfig, chapter: this.chapter.id, stage:this.chapter.stage,westStage:this.chapter.westStage };
    if(preview)this.runConfig.encounter=encounter as 'sishui'|'xingyang'|'qunxiong';
    this.music.setBattleTheme(battleThemeFor(this.scene.key,this.chapter.id)); // BGM v2：各章战斗曲
    this.frontlineNextSettlement=this.battleStage();this.frontlineStarts.set(this.battleStage(),this.combatNow);
    const scenery=this.chapter.bossStyle==='huaxiong'?'sishui':this.chapter.bossStyle==='xurong'?'xingyang':null;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.chargeGfx = this.add.graphics().setDepth(DEPTH.fx);
    this.relicWaveGfx=this.add.graphics().setDepth(DEPTH.fx);
    this.bossUltGfx = this.add.graphics().setDepth(DEPTH.fx + 1);
    this.bossShieldGfx = this.add.graphics().setDepth(DEPTH.fx + 2);
    this.cameras.main.setRoundPixels(true);

    // 第二章（汜水关 / 洛阳）：地面 v2 关中黄土碎石（环境互动第一批 ④），缺图退回原来的红褐地面
    const terrainKey = scenery==='xingyang'?'xingyang_ground':this.chapter.stage ? this.chapter.ground : this.textures.exists('ground_v2_guanzhong') ? 'ground_v2_guanzhong' : 'ground_overhaul_hulao';
    const groundKey = this.textures.exists(terrainKey) ? terrainKey : this.textures.exists('ground_ai') ? 'ground_ai' : 'ground';
    architecturalSurface(this,envConfigFor(this.scene.key,this.chapter.id)?.faction??1);
    const surface=terrainSurface(this,groundKey,groundKey.startsWith('ground_overhaul')||groundKey.startsWith('yellow_ground')?1:.5);
    this.ground = this.add
      .tileSprite(0, 0, GAME_WIDTH + 512, GAME_HEIGHT + 512, surface.key)
      .setOrigin(0, 0)
      .setScrollFactor(1)
      .setDepth(DEPTH.ground);
    this.ground.setTileScale(surface.scale);
    // 2-1 汜水关：旧的「关门 + 两座箭楼 + 营帐」摆在场地中间、不能互动，改由 SishuiPass 画关墙（见下方 create 末段）
    // 2-2 荥阳：原来场地中间不能互动的营帐 / 杂物去掉，改为四角伏兵营帐（XINGYANG_AMBUSH，见下方 create 末段）
    this.battlefieldDetails = new BattlefieldDetails(this, this.chapter.id, this.chapter.id==='huangjin'?this.chapter.stage:undefined,groundKey);
    this.artEffects = new ArtEffects(this);

    this.player = new Player(this, 0, 0);

    // 治疗数字：主将实际回复的量累加，每 0.4 秒合成一个绿色「+n」（药、酒、吸血、信物回血都算）

    { const pl = this.player, raw = pl.heal.bind(pl); this.healAcc = 0; pl.heal = (n: number) => { const h0 = pl.hp; raw(n); this.healAcc += Math.max(0, pl.hp - h0); }; }
    this.dragFx = undefined; this.flankFx = undefined; this.windFx = undefined; this.skirmishPuffAt = 0; this.env = null; this.envInit = false; this.terrain?.clear(); this.terrain = null; this.terrainInit = false; this.terrainNav = []; Ally.terrainMul = null; this.player && (this.player.terrainSpeedMul = 1);
    this.applyRunConfig(this.runConfig);
    this.worldCampaign=!preview&&!isChapterTestRun()&&this.registry.get('worldCampaign')===true;
    this.hardMode=!preview&&this.registry.get('hardChapter')===this.hardKey()&&(chapterState(this.hardKey() as TimelineChapterId,loadWorldState())==='cleared'||isChapterTestRun());
    if(this.hardMode){const tag=this.add.text(GAME_WIDTH/2,GAME_HEIGHT*.3,'乱世难度 · 敌军更强',{fontFamily:FONT,fontSize:'26px',color:'#ffb08a',stroke:'#1b0805',strokeThickness:5,resolution:2}).setOrigin(.5).setScrollFactor(0).setDepth(DEPTH.overlay).setName('hard-mode-tag');this.tweens.add({targets:tag,alpha:0,delay:2400,duration:700,onComplete:()=>tag.destroy()});}
    this.expeditionId=this.worldCampaign?beginExpedition(this.chapter.id,this.chapter.stage??this.chapter.westStage):'';
    this.weaponHost = this.createWeaponHost();
    this.martialFields = new MartialFields(this.weaponHost);
    this.aimIndicator=this.add.graphics().setDepth(DEPTH.enemy-.6).setName('aim-indicator');
    // 新存档开局无兵，第一波后招募；已开放主城的出征另应用军营与后备。
    this.allies = [];
    this.legion = new Legion(this, this.allies, this.player);
    this.legion.attackSound = kind => { const k = TROOP_ATTACK_SFX[kind]; if (k) this.sfx.play(k); };
    // 战地免费招兵每波人数随章节增加（档位与掉落一致：一章 0 … 五章 4）
    this.legion.freeRecruitCount = FREE_RECRUIT_BY_TIER[Math.max(0, Math.min(FREE_RECRUIT_BY_TIER.length - 1, this.itemTier()))];
    this.yellow=this.chapter.stage?new YellowBattle({scene:this,player:this.player,army:this.legion,enemies:this.enemies,move:(e,nx,ny,dt)=>this.advanceEnemy(e,nx,ny,dt),spawn:(def,x,y)=>this.spawnEnemy(def.kind,x,y,1,true,def)},this.chapter.stage):null;
    this.xiliang=this.chapter.id==='hulao'&&!this.runConfig.encounter&&!this.customChapter()?new XiliangBattle({scene:this,player:this.player,army:this.legion,enemies:this.enemies,spawn:(kind,x,y,def)=>this.spawnEnemy(kind,x,y,undefined,true,def),stage:()=>(this.chapter.westStage??3) as 1|2|3,elapsed:()=>this.elapsed,def:k=>this.chapter.enemies[k],banner:(t,c)=>this.showWaveBanner(t,true,c),sfx:k=>this.sfx.play(k),boss:()=>this.boss,bossStyle:()=>this.chapter.bossStyle,holdBoss:()=>!!this.dzLubu?.holdsDongzhuo,move:(e,nx,ny,dt)=>this.advanceEnemy(e,nx,ny,dt),obstacles:()=>this.sishuiObstacles?.footprints??[]}):null;
    this.supplies=new BattlefieldSupplies(this,this.player,this.enemies,()=>this.combatNow,kind=>{this.sfx.play('pickup');this.artEffects.show(5,this.player.x,this.player.y-12,35,this.combatNow,280);if(kind==='wine')this.relics?.onWine(this.combatNow);});
    this.propItems = 0; this.supplies.onPropLoot = (kind, x, y) => this.propLoot(kind, x, y);
    // 兵装：开局读入该武将穿戴的道具加成（生命上限增加的部分补满）
    {const oldMax=this.player.maxHp;this.player.growth.gear=gearFor(this.runConfig.character);this.player.heal(this.player.maxHp-oldMax);}
    this.followers=null;this.followerPassives=[];{const allow=worldUnlocked()&&(!isChapterTestRun()||new URLSearchParams(location.search).get('followers')==='1');const list=allow?followersFor(this.runConfig.character):[];if(list.length)this.followers=new FollowerSquad(this,this.player,list,(x,y,r)=>this.grid.query(x,y,r),(e,d,fire)=>this.hitEnemy(e,d,this.combatNow,fire?'fire':'melee',true,false),()=>this.player.growth.damageMultiplier(this.combatNow));if(this.followers){this.followers.onHitFx=(e,k,fx,fy)=>this.followerTemplateHitFx(e,k,fx,fy);this.followers.attackSound=t=>this.sfx.play(FOLLOWER_ATTACK_SFX[t]);}}
    { const mode = readIffMode(); this.iff = mode ? new IffOverlay(this, mode, () => this.iffUnits()) : null; }
    this.presence = new BossPresence({ scene: this, enemies: () => this.enemies, boss: () => this.cutscene?.active ? null : this.boss, /* 过场时收起名牌 / 辉光 / 火环 */ bossName: () => this.chapter.bossName, player: () => this.player,
      extras: e => e === this.boss ? [this.bossMount?.horseImage, this.bossMount?.frontImage] : [], outline: e => this.iff?.overlayOf(e.sprite) });
    // 震屏设置（强 / 弱 / 关，im_shake，见 systems/BattleSettings）：包一层主相机 shake，现有调用全部按设置缩放
    { const cam = this.cameras.main, orig = cam.shake.bind(cam);
      cam.shake = ((duration?: number, intensity?: number | Phaser.Math.Vector2, force?: boolean, callback?: Phaser.Types.Cameras.Scene2D.CameraShakeCallback, context?: unknown) => {
        const k = shakeScale(); if (k <= 0) return cam;
        return orig(duration, typeof intensity === 'number' ? intensity * k : intensity, force, callback, context);
      }) as typeof cam.shake; }
    this.shieldBars=new ShieldBars(this);this.events.once('shutdown',()=>{this.shieldBars?.clear();this.shieldBars=null;this.objective?.clear();this.objective=null;this.objectiveText=undefined;});
    this.setupObjective();
    // 坐骑：马厩里给该武将分配的马（第一章通关后马厩开放；换马只在休整时，下一关出征生效）
    {const horse=heroHorse(this.runConfig.character);this.mount=horse?new HeroMount({scene:this,player:this.player,enemies:this.enemies,hit:(e,d,now)=>this.hitEnemy(e,d,now,'melee',false,false),notice:t=>this.showGrowthNotice(t)},{base:horse.id,name:horse.name},this.runConfig.character,this.player.growth.gear.specials.includes('hubao')?{trampleMul:RELIC.hubaoTrample,remountMs:RELIC.hubaoRemountMs}:{}):null;this.player.mountGuard=this.mount?(n,now)=>this.mount?.guard(n,now)??n:undefined;this.events.once('shutdown',()=>{this.mount?.clear();this.mount=null;});}
    this.itemDrops=new ItemDrops(this,this.player,this.itemTier(),()=>this.elapsed,()=>this.isFinalBoss(),()=>this.sfx.play('pickup'),()=>this.bossRelicKey());this.itemDrops.deferBossRelic=true; // 首领遗珍由首领宝箱发（BossChest）
    this.relics=new BossRelics({scene:this,player:this.player,enemies:()=>this.enemies,hit:(e,d,now)=>{this.hitEnemy(e,d,now,'melee',false,false);},notice:t=>this.showGrowthNotice(t)},this.player.growth.gear.specials,this.combatNow);
    this.syncRelicShips();
    this.events.once('shutdown',()=>{this.relics?.clear();this.relics=null;this.relicShips?.clear();this.relicShips=null;});
    // 酒罐 / 药篓不生成在房屋、城墙等障碍里（第三/四章、攻城在 create 之后才设置障碍，故调用时读取）
    this.supplies.healBlocked=(x,y,r)=>!!this.sishuiObstacles?.footprints.some(b=>x>b.left-r&&x<b.right+r&&y>b.top-r&&y<b.bottom+r);
    if(scenery==='sishui'){
      // 汜水关：关墙横在北面、关门居中、门两侧箭楼；西凉营帐在关前两翼（敌军出兵方向）；营寨杂物摆在营帐边，不挡战场中间
      const sup=this.supplies;
      this.sishuiPass=new SishuiPass(this.passHost());
      this.sishuiObstacles=new SishuiObstacles(this.sishuiPass.footprints);
      sup.spawnSishui(3,-690,-180,116);sup.spawnSishui(5,-640,-150,105);sup.spawnSishui(7,690,-180,100);sup.spawnSishui(4,640,-150,104);sup.spawnSishui(6,0,-330,110);
    }else if(scenery==='xingyang'){
      // 2-2 荥阳 · 徐荣伏营：四角伏兵营帐，「道路伏击」波起扬尘示警后伏兵冲出；烧掉营帐断其伏兵
      const A=XINGYANG_AMBUSH;this.sishuiPass=new SishuiPass(this.passHost(),{wall:false,towers:false,wenjiu:false,tentSpots:A.tents,tentRider:'infantry',tentCount:A.count,tentWarnMs:A.warnMs,tentFromWave:A.fromWave,tentName:'伏兵营帐',campName:'徐荣伏营',tag:'xurong'});
      this.supplies.spawnSishui(3,-330,180,116);this.supplies.spawnSishui(5,-310,350,105);this.supplies.spawnSishui(7,230,-50,100);this.supplies.spawnSishui(4,290,210,104);this.supplies.spawnSishui(6,300,370,110);}
    // 过场动画预览（MenuScene 收到 ?dev=1&cutscene=<id>）：清场、首领出阵，推到过场处自动播
    {const pv=this.registry.get('cutscenePreview') as string|undefined;if(pv){this.registry.remove('cutscenePreview');this.player.damageImmune=true;const t0=performance.now();
      const poll=():void=>{if(!this.scene.isActive()){this.events.off('postupdate',poll);return;}this.spawnTimer=this.eliteTimer=1e9;for(const e of this.enemies)if(e.active&&e.kind!=='boss'&&!e.isSupplySlot&&e!==this.dzLubu?.lubu)e.deactivate();
        if(this.mode==='levelup'||this.mode==='recruit'){(this as unknown as {__DEV_ACTIONS?:{closePopup?:()=>void}}).__DEV_ACTIONS?.closePopup?.();return;}
        if(!this.boss?.active){if(performance.now()-t0>800)this.spawnBoss();return;}
        const ready=this.textures.exists('ride_v2_boss_lubu')&&this.textures.exists('boss_death_dongzhuo');
        const dzArt=!!(this.xiliang as unknown as {dongzhuo?:unknown}|null)?.dongzhuo&&(this.boss.sprite.texture.key.includes('dongzhuo')||performance.now()-t0>8000); // 董卓换上正式图再开演
        if(pv==='lubu_kills_dongzhuo'&&this.dzLubu&&dzArt&&(ready||performance.now()-t0>6000)&&performance.now()-t0>2000){this.events.off('postupdate',poll);this.dzLubu.devFinale();}};
      this.events.on('postupdate',poll);}}
    const transfer = this.registry.get('campaignTransfer') as CampaignTransfer | undefined;
    this.registry.remove('campaignTransfer');
    // 征程构筑：同章连打用内存里的 transfer；否则主线未通关的关读存档里的征程构筑（重打旧关 / 攻城 / 军情 / 挑战为空构筑）
    this.campaignReplay = !this.stableRewardKey() || stageCleared(this.stableRewardKey());
    const chained = transfer && this.chapter.id === transfer.chapter && this.runConfig.character === transfer.character ? transfer : undefined;
    const carriedState = chained ?? (this.campaignReplay ? undefined : loadCampaignBuild(this.runConfig.character));
    if (carriedState) {
      restoreCampaign(carriedState, this.player, this.legion);
      const ownId=getCharacter(this.runConfig.character).startWeapon;
      const ownLevel=this.player.weapons.find(weapon=>weapon.id===ownId)?.level??1;
      this.player.weapons=[{id:ownId,level:ownLevel,cooldownLeft:0}];
      // restoreCampaign 换了新的 RunGrowth：兵装加成、遗珍效果要重新读入（以前同章连打会丢）
      this.player.growth.gear=gearFor(this.runConfig.character);this.relics?.setSpecials(this.player.growth.gear.specials,this.combatNow);this.syncRelicShips();
    }
    // 信物库（2026-11-17）：穿着的信物开局生效（属性、套装、机制类注入构筑宝物）
    this.charmInfo=applyCharms(this.player,wornTokens(this.runConfig.character));
    this.campaignLoaded = !!carriedState && !chained;
    this.applyHeroLevel(!!carriedState);
    this.syncHeroLevel();
    if(carriedState)applyCarriedHp(carriedState,this.player,this.followers); // 2026-11-18 用户：前一关受的伤带到下一关（主将按比例、名将随从同样；部曲在 Legion 存档里本来就带血量）
    if(!(transfer && this.chapter.id === transfer.chapter && this.runConfig.character === transfer.character))this.grantWeixiTreasures();
    if(this.worldCampaign&&worldUnlocked()){const effects=permanentEffects();this.legion.healingMultiplier=effects.healMultiplier;applyCitySpecialties(this.player,effects,!transfer,{legion:this.legion,supplies:this.supplies});if(!transfer){for(let i=0;i<effects.reinforcements;i++)this.legion.recruit(i===0?'swordsman':'spearman',1,true);}if(!transfer&&!isChapterTestRun())for(const kind of takeExpeditionReserve(effects.reserveSlots)){this.legion.recruit(kind,1,true);this.allies[this.allies.length-1].reserveSoldier=true;}}
    this.buildCombat=new BuildCombat(this.player.growth.build,(x,y,r)=>this.grid.query(x,y,r),(e,n,fire)=>this.hitEnemy(e,n,this.combatNow,fire?'fire':'melee',false,false),(e,fire)=>{this.artEffects.show(fire?5:3,e.x,e.y-8,32,this.combatNow,160);buildVfx(this).emit(fire?'flame':'combo',e.x,e.y-8,this.combatNow,fire?42:38);});
    this.bulwarkBuild=new BulwarkBuild(this,this.player.growth.build,this.player,this.allies,(x,y,r)=>this.grid.query(x,y,r),(e,n)=>this.hitEnemy(e,n,this.combatNow,'melee',false,false));
    this.player.damageGuard=(n,now)=>this.bulwarkBuild?.guard(n,now)??n;this.legion.defense=this.bulwarkBuild;
    this.events.once('shutdown',()=>{this.bulwarkBuild?.clear();this.bulwarkBuild=undefined;this.player.damageGuard=undefined;});
    this.controlBuild=new ControlBuild(this,this.player.growth.build,(x,y,r)=>this.grid.query(x,y,r));
    this.events.once('shutdown',()=>{this.controlBuild?.clear();this.controlBuild=undefined;});
    this.awakeningCombat=new AwakeningCombat(this,this.player,this.allies,(x,y,r)=>this.grid.query(x,y,r),(e,n,fire)=>this.hitEnemy(e,n,this.combatNow,fire?'fire':'melee',false,false),(e,n)=>this.controlBuild?.isControlled(e,n)??false,(e,n)=>this.buildCombat.naturalBurn(e,n),(e,n,now)=>this.buildCombat.igniteDerived(e,n,now),text=>this.showGrowthNotice(text),()=>this.legion.order,(e,n)=>this.legion.command.onHit(e,n));
    this.legion.awakeningDefense={incoming:(u,n)=>this.awakeningCombat?.allyIncoming(u,n)??1,onAllyHurt:(u,n)=>this.awakeningCombat?.onAllyHurt(u,n)};
    this.events.once('shutdown',()=>{this.awakeningCombat?.clear();this.awakeningCombat=undefined;});
    this.buildCombat.setOrigin(()=>({x:this.player.x,y:this.player.y}));
    this.buildCombat.onFlank=targets=>this.flankBladeFx().strike(targets);
    this.buildCombat.onWindstep=e=>this.windstepFx().burst(e.x,e.y);
    const cam = this.cameras.main;
    cam.setRoundPixels(false);
    cam.setScroll(this.player.x - GAME_WIDTH / 2, this.player.y - GAME_HEIGHT / 2);

    for (let i = 0; i < 2; i += 1) {
      this.blades.push(this.add.image(0, 0, 'blade').setDepth(DEPTH.blade).setScale(1.2).setVisible(false));
    }

    this.add
      .image(0, 0, 'vignette')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(900);

    this.buildHud();
    this.buildOverlays();
    if(preview&&encounter==='sishui'&&!this.customChapter())this.add.image(48,180,'huaxiong_portrait').setDisplaySize(42,42).setScrollFactor(0).setDepth(901);
    this.legionUI = new LegionUI(this, () => { if (this.mode === 'none' && !this.over) this.legion.cycleOrder(); }, (kind, train) => this.buyTroops(kind, train), () => {
      if (this.mode === 'rest') this.continueCampaign();
      else if (this.mode === 'recruit') { this.recruitedWaves.add(this.waveIndex); this.freeRecruit = false; this.resumePendingChoices(); }
    }, () => this.takeRecruitPotion(), () => canOfferRejuvenation(this.player));
    this.campUI=new CampRestUI(this,this.player,this.legion,()=>this.continueCampaign());
    // 行营休整在本关结算之后：买下的兵装直接收入行囊（2026-11-18 用户报「休整买的装备背包没显示」——原先推进已结算的 runLoot，背包看不到、下一关重建时还会丢）。测试 / 调试战斗同结算规则不入行囊。
    this.campUI.onBuyItem=item=>{const debug=isChapterTestRun()||this.debugModified||this.debugJumped||!!this.player.damageImmune||!!this.runConfig.encounter;if(this.over&&!debug)addItems([item]);else this.itemDrops?.runLoot.push(item);};
    // 军医（2026-11-18）：按章定价；治疗后把存档里的征程构筑血量也改掉（存档点是打赢那一刻存的，治疗在之后；重打旧关不存档也不改）
    this.campUI.chapterNo=medicChapter(this.scene.key,this.chapter.id);
    this.campUI.onHealed=()=>{if(this.campaignReplay)return;const fh:Record<string,number>={};for(const m of this.followers?.members??[])fh[m.recruit.id]=m.downed?0:m.hp/Math.max(1,m.maxHp);patchCampaignHp(this.runConfig.character,this.player.hp/Math.max(1,this.player.maxHp),fh);};
    this.campUI.onOpenBag=()=>this.openBattleBag(true);
    // 从营寨 / 天下地图出征的战役：关与关之间的休整可直接回营寨（本场奖励已在胜利时入库）
    if(this.worldCampaign&&worldUnlocked())this.campUI.onReturnHome=()=>{this.resting=false;this.registry.remove('campaignTransfer');this.scene.start('CityScene');};
    this.reinforcements = new Reinforcements(this, this.runConfig.character, this.player, id => {
      if (this.mode !== 'aid' || !this.reinforcements.start(id, this.combatNow, this.enemies)) return;
      this.resumePendingChoices();
    });
    this.joystick = new Joystick(this);
    if (IS_DESKTOP) this.joystick.setHidden(true);
    this.bindInput();
    // 手柄 / 键鼠切换时刷新按键提示
    const offHints = gamepad.onDeviceChange(() => this.refreshInputHints());
    this.events.once('shutdown', offHints);
    this.events.once(Phaser.Scenes.Events.UPDATE, () => this.refreshInputHints());
    if (import.meta.env.DEV) this.installDevelopment();

    this.hintText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 32, IS_DESKTOP ? 'WASD / 方向键移动 · 自动攻击' : '自动攻击 · 拖动摇杆移动', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#8a8078',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);
    // 剧情：关前章头 → 过场 / 幕间 → 军情 → 羁绊（都看完 / 跳过后再开新手引导，避免两者叠在一起）
    this.setupStory(this.runConfig.encounter ? '' : this.chapter.id, this.chapter.id === 'hulao' ? (this.chapter.westStage ?? 3) : (this.chapter.stage ?? 1), () => { if (this.sys.settings.status < Phaser.Scenes.SHUTDOWN && !this.over) this.tutorial = Tutorial.maybeStart(this); });
    // 首领阶段切换统一事件（boss-phase）：所有控制器的 phase2 都从这里发
    watchBossPhase(this, () => { const c = (this as unknown as { controller?: { phase2?: boolean } }).controller; return this.boss ? { boss: this.boss, phase2: !!(this.moveset?.phase2 || this.lubu?.phase2 || this.huaxiong?.phase2 || this.xurong?.phase2 || this.zhangjiao?.phase2 || c?.phase2), name: this.chapter.bossName, mounted: !!(this.bossMount?.mounted || this.moveset?.mounted) } : null; });
  }

  /**
   * 建本关剧情导演并开关前剧情（章头 → 过场 / 幕间 → 军情 → 羁绊）；套用羁绊加成（伤害、移速）。
   * 篇章场景（第三章起，runConfig 是 encounter）在自己的 create 末尾按篇章 id 再调一次。
   */
  protected setupStory(chapterId: string, stage: number, done: () => void = () => {}): void {
    this.storyDir = new StoryDirector({ scene: this, chapterId, stage, ctx: this.storyCtx(),
      pause: () => { if (this.mode === 'none' && !this.over) this.setMode('story'); }, resume: () => { if (this.mode === 'story' && !this.over) this.setMode('none'); },
      reward: r => { if (r.merit) addMerit(r.merit); if (r.grain) addProvisions(r.grain); }, banner: (t, c) => { this.showWaveBanner(t, true, c); this.sfx.play('gong'); } });
    { const lord = this.runConfig.character, k = this.storyDir.bondDamageMul(lord), v = this.storyDir.bondSpeedMul(lord); if (k !== 1) this.player.stats.damageMul *= k; if (v !== 1) this.player.stats.moveMul *= v; this.player.stats.critChance += this.storyDir.bondCritBonus(lord); // 羁绊（「桃园」伤害、「借将」移速、「古城」暴击）
      for (const m of this.followers?.members ?? []) if (m.recruit.hero) m.weaponDamageMul *= this.storyDir.bondDamageMul(m.recruit.hero); }
    this.storyDir.beginStage(done);
  }
  /** 本场首领倒下时剧情是否说了台词（主将台词据此往后挪） */
  private storyBossFell = false;
  /** 主将对首领登场 / 倒下说一句（HeroBark）。剧情先让首领说了时，主将那句晚 2.3 秒（HeroBark 场上只留一句，同时说会互相顶掉）。 */
  protected lordBossBark(kind: 'bossAppear' | 'bossDown', storySpoke: boolean): void {
    const say = (): void => { if (this.sys.settings.status < Phaser.Scenes.SHUTDOWN && !this.barksMuted()) this.heroBark?.bossEvent(kind, this.barkSpeakers()[0], this.chapter.bossName, this.combatNow); };
    if (storySpoke) { this.bossBarkTimer?.remove(); this.bossBarkTimer = this.time.delayedCall(2300, say); } else say();
  }
  /** 剧情上下文：主公、在队（主公 + 随行武将）、已招募。 */
  storyCtx(): StoryCtx { return { lord: this.runConfig.character, team: () => [this.runConfig.character, ...(this.followers?.members ?? []).map(m => m.recruit.hero).filter((h): h is CharacterId => !!h)], recruited: id => heroOwned(id) }; }
  /** 把开局选择（武将/初始武器）应用到本局。 */
  protected applyRunConfig(config: RunConfig): void {
    const character = getCharacter(config.character);
    this.player.growth = new RunGrowth(character.id);
    this.player.passive.reset(character.id, this.combatNow);
    this.player.stats.maxHpBonus += Math.round(BALANCE.player.maxHp * (character.hpMul - 1));
    this.player.stats.moveMul *= character.speedMul;
    this.player.stats.damageMul *= character.damageMul;
    this.player.hp = this.player.maxHp;
    const sheetKey = `${config.character}_walk_sheet`;
    const hasOwnSheet = this.textures.exists(sheetKey);
    this.player.setWalkSheet(hasOwnSheet ? sheetKey : 'hero_walk_sheet');
    this.player.setActionSet(config.character);
    if (!hasOwnSheet && character.battleTint) this.player.sprite.setTint(character.battleTint);
    this.player.weapons = [{ id: character.startWeapon, level: 1, cooldownLeft: 0 }];
  }

  protected resetState(): void {
    this.relicWaves=[];this.runMerit={elite:0,boss:0};this.picksGiven=0;this.militaryPending=0; // 场景实例会被重复使用：每场重置
    this.firstBossAt=-1;this.settledFrontlineKills=0;this.frontlineNextSettlement=1;this.frontlineVictories.clear();this.frontlineStarts.clear();this.chasingBosses=[];this.deadBossControllers=[];for(const c of this.bossChests)c.clear();this.bossChests=[];this.lootContinue=null;this.relicHits=0;this.relicFireAt=0;this.relicHealAt=0;
    this.rerolls=0;this.warfeedCount=0;this.pointsButton=undefined;this.pointsBadge=undefined;this.potionButton=undefined;this.potionBadge=undefined;this.potionIcon=undefined;this.potionGlow=undefined;this.rerollButton=undefined;
    this.crowdSteering = true; this.freeRecruit = false; this.resting = false; this.restIntroPlayed = false; this.restIntroSkip = undefined; this.recruitedWaves.clear();
    this.pendingGrowthNotices.length = 0;
    this.separationScratch.length = 0;
    this.allyScratch.length = 0;
    this.allies = [];
    for (const shot of this.spearShots) shot.img.destroy();
    this.spearShots = [];
    this.waveIndex = -1;
    this.waveBannerShown = false;
    this.bossWarned = false;
    this.recruitOptions = [];
    this.enemies = [];
    this.bolts = [];
    this.bullets = [];
    this.gems = [];
    this.dmgFx = [];
    this.blades = [];
    this.elapsed = 0;
    this.combatNow = 0;
    this.time.paused = false;
    this.time.timeScale = 1;
    this.tweens.resumeAll();
    this.tweens.timeScale = 1;
    this.pendingRecruit = false;
    this.debugMoveActive = false;
    this.debugMove.set(0, 0);
    this.debugChains = [];
    this.debugJumped = false;
    this.debugModified = false;
    this.devTimeScale = 1;
    this.hitFeel?.reset();
    this.devAcc = 0;
    this.perf = undefined;
    this.grid.clear();
    this.kills = 0;
    this.damageDealt = 0;
    this.playerDamageDealt = 0;
    this.allyDamageDealt = 0;
    this.spawnTimer = 0.5;
    this.eliteTimer = BALANCE.eliteFirst;
    this.boss = null;
    this.sishuiObstacles=null;this.sishuiPass?.clear();this.sishuiPass=null;this.dzLubu?.clear();this.dzLubu=null;this.huaxiong=null;this.xurong=null;this.lubu = null;this.moveset?.clear();this.moveset=null;this.bossMount?.destroy();this.bossMount=null; this.zhangjiao?.clear(); this.zhangjiao = null; this.yellow=null; this.xiliang=null; this.supplies=null; this.yellowAltar=null;this.finaleFadeMs=0;
    this.bossSpawned = false;
    this.bossCastCd = 3;
    this.bossSummonCd = 6;
    this.bossEnergy = 0;
    this.bossOrbCd = 1.8;
    this.bossFanCd = 6;
    this.bossUltPhase = 'none';
    this.bossUltAt = 0;
    this.bossUltPoints = [];
    this.bossUltRound = 0;
    this.bossUltHits = 0;
    this.bossPhase2 = false;
    this.bossShield = 0;
    this.bossShieldGfx?.clear();
    this.bossSummons = [];
    this.bossUltGfx?.clear();
    this.bossKilled = false;
    this.orbitAngle = 0;
    this.mode = 'none';
    this.over = false;
    this.victory = false;
    this.pendingLevels = 0; this.lastPickAt = -1e9; this.forcePickNow = false; this.pickBatch = 0; this.pickBatchDone = 0;
    this.upgradeOptions = [];
    this.cardViews = [];
    this.relicExpanded = false;
    this.gems = [];
    this.dmgFx = [];
  }

  // ---------------- input ----------------

  protected bindInput(): void {
    // activePointers 已在 main.ts 配置；场景重开不再分配全局指针。
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.sfx.unlock();
      if(this.handleBattlePointer(pointer))return;
      this.joystick.handleDown(pointer);
    });
    // BGM 在首次真实手势后启动；离开场景时停止并清理监听
    const startMusic = (): void => this.music.start();
    window.addEventListener('pointerdown', startMusic, { once: true });
    window.addEventListener('keydown', startMusic, { once: true });
    this.events.once('shutdown', () => {
      window.removeEventListener('pointerdown', startMusic);
      window.removeEventListener('keydown', startMusic);
      this.music.dispose();
      this.sfx.dispose();
      this.disposeDevelopment();
      this.followers?.clear();this.followers=null;this.legion.stop(); this.reinforcements.clear();this.yellow?.clear();this.xiliang?.clear();this.clearChasingBosses();this.supplies?.clear();this.itemDrops?.clear();
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.joystick.handleMove(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.joystick.handleUp(pointer));
    this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.joystick.handleUp(pointer));

    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    // A scene restart reuses its KeyboardPlugin; dispose only the bindings owned here.
    for (const key of ['P', 'ESC', 'ONE', 'TWO', 'THREE', 'R', 'Q', 'E']) keyboard.removeAllListeners(`keydown-${key}`);
    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    keyboard.on('keydown-P', () => this.togglePause());
    keyboard.on('keydown-Q', () => this.usePotion());
    keyboard.on('keydown-ESC', () => this.togglePause());
    keyboard.on('keydown-ONE', () => this.chooseUpgrade(0));
    keyboard.on('keydown-TWO', () => this.chooseUpgrade(1));
    keyboard.on('keydown-THREE', () => this.chooseUpgrade(2));
    keyboard.on('keydown-R', () => {
      if (this.mode === 'result'&&this.victory) this.scene.restart();
    });
    let lastE = -1;

    keyboard.on('keydown-E', (event: KeyboardEvent) => { if (event.repeat || event.timeStamp === lastE) return; lastE = event.timeStamp; if (this.mode === 'none' && !this.over) this.legion.cycleOrder(); });
  }

  // ---------------- update ----------------

  update(time: number, delta: number): void {
    let dt = Math.min(delta / 1000, 0.05);
    // 统一时间倍率：开发倍速 × 打击感（顿帧 / 慢动作，只在战斗进行中生效；升级、暂停、结算不受影响）
    const feel = this.mode === 'none' && !this.over ? this.hitFeel.scale() : 1, timeScale = this.devTimeScale * feel;
    if (timeScale !== 1) dt *= timeScale;
    this.time.timeScale = timeScale;
    this.tweens.timeScale = timeScale;
    this.anims.globalTimeScale = timeScale;
    this.updateCamera(dt);
    this.music.setIntensity(this.boss?.active||this.chasingBosses.some(t=>t.enemy.active&&t.enemy.spawnId===t.life)?1:0);
    if (!this.boss || !this.boss.active) this.music.setDuck(1);
    const nextWave = waveIndexAt(this.elapsed, this.chapter.waves);
    if (!this.over && nextWave !== this.waveIndex) {
      this.waveIndex = nextWave;
      this.hudTexts.wave.setText(`第 ${nextWave + 1}/${this.chapter.waves.length} 波 · ${this.chapter.waves[nextWave].name}`);
      if (this.waveBannerShown || nextWave > 0) this.showWaveBanner(`第 ${nextWave + 1}/${this.chapter.waves.length} 波 · ${this.chapter.waves[nextWave].name}`);
      this.waveBannerShown = true;
      // Finish a wave before recruiting; the opening wave starts immediately.
      if (nextWave > 0 && this.chapter.recruitWaves.includes(nextWave)) this.scheduleRecruit();
      if (nextWave > 0) { const ws = this.paceOn() ? PICK_PACE.waves : PICK_GUARANTEE.waves; this.ensurePicks(ws[Math.min(nextWave, ws.length) - 1]); }
    }
    if (!this.over && !this.objective && this.elapsed >= chapterBossTime(this.chapter) - 10 && !this.bossWarned) {
      this.bossWarned = true;
      this.showWaveBanner(`${this.chapter.bossName}即将登场！`, true);
    }
    if (this.perf) {
      if (this.mode === 'none' && !document.hidden) {
        this.perf.frameMs.push(delta);
        if (this.perf.frameMs.length > 600) this.perf.frameMs.shift();
        this.perf.playMs += delta;
      } else if (this.mode === 'levelup' || this.mode === 'pause') {
        this.perf.pausedMs += delta;
      }
    }
    this.syncGround();
    this.battlefieldDetails.update(this.cameras.main.scrollX, this.cameras.main.scrollY);
    this.hudAcc += dt;
    this.updateHud();
    // 被动满层台词每帧检测（HUD 0.1 秒一刷，孙尚香这类攒满后马上触发的会漏掉）
    this.passiveShout.update(this.player.passive, this.combatNow, this.player.x, this.player.y, this.mode === 'none' && !this.over, this.player.sprite);
    this.zhaoyunFx.update(this.player.passive, this.combatNow, this.player.x, this.player.y, !this.over && this.player.sprite.visible);
    this.heroBark?.update(this.barkSpeakers(), this.combatNow, this.mode === 'none' && !this.over && !this.barksMuted()); // 武将台词气泡（被动大招触发时）；过场中与刚结束 1 秒内不喊
    this.artEffects.update(this.combatNow);
    this.updateRelicWaves();
    this.feedback.update(this.combatNow, this.mode === 'result' ? delta : 0);
    this.updatePerf(dt);
    this.devAcc += dt;
    if (this.devText && this.devAcc > 0.3) {
      this.devAcc = 0;
      const projectiles = this.bolts.filter((b) => b.active).length + this.bullets.filter((b) => b.active).length;
      const gems = this.gems.filter((g) => g.active).length;
      this.devText.setText(
        `FPS ${Math.round(this.game.loop.actualFps)} | 敌 ${this.activeEnemyCount()} | 弹 ${projectiles} | 宝石 ${gems} | 内存 ${
          (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
            ? Math.round(((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1048576) * 10) / 10
            : '-'
        }MB`,
      );
    }

    if(this.finaleFadeMs>0){this.finaleFadeMs=Math.max(0,this.finaleFadeMs-delta);const a=this.finaleFadeMs/800;this.bossUltGfx.setAlpha(a);this.bossShieldGfx?.setAlpha(a);if(!this.finaleFadeMs){this.bossUltGfx.clear().setAlpha(1);this.bossShieldGfx?.clear().setAlpha(1);}}
    this.huaxiong?.updateDeath(delta);this.xurong?.updateDeath(delta);for(const controller of this.deadBossControllers)controller.updateDeath(delta);
    this.animateUpgradeCards();
    if (this.mode !== 'none' || this.over) return;
    if (this.pendingLevels > 0 && this.pickGapOk()) this.openUpgrade();

    if(this.battleStage()<3&&!this.runConfig.encounter&&this.boss?.active&&this.firstBossAt>=0&&this.combatNow>=this.firstBossAt+90000)this.advanceFrontline();
    this.elapsed += dt;
    this.combatNow += dt * 1000;
    this.hitFeel.endFrame(); this.bossStagger.decay(dt);
    if (this.combatNow >= this.healShowAt) { this.healShowAt = this.combatNow + 400; if (this.healAcc >= 1) { this.spawnDamageText(this.player.x, this.player.y - 56, Math.round(this.healAcc), false, true, 'heal'); this.healAcc = 0; } }
    time = this.combatNow;
    const move = this.readMove();
    this.relics?.sway(move, this.combatNow);
    const moveX=this.player.x,moveY=this.player.y;
    const driven=Math.hypot(move.x,move.y)>.1;
    this.player.move(dt, driven?move.x:0, driven?move.y:0);

    this.player.update(time, dt);this.mount?.update(dt,this.combatNow);

    if(!this.over){for(const c of this.bossChests)c.update(this.combatNow);this.itemDrops?.update();this.relics?.update(this.combatNow);this.relicShips?.update(this.combatNow);}
    this.supplies?.update(dt,time,this.battlefieldDetails.props,(enemy,damage)=>this.hitEnemy(enemy,damage,time,'fire',false,false),this.allies,(ally,damage,now)=>this.legion.hurt(ally,damage,now));
    if(!this.envInit&&this.supplies){this.envInit=true;const cfg=envConfigFor(this.scene.key,this.chapter.id,(this as unknown as {guanduStage?:number}).guanduStage);if(cfg){const sup=this.supplies;this.env=new EnvInteractions({scene:this,player:this.player,supplies:sup,enemies:()=>this.enemies,allies:()=>this.allies,hitEnemy:(e,d)=>{this.hitEnemy(e,d,this.combatNow,'fire',false,false);},hurtAlly:(a,d)=>{this.legion.hurt(a,d,this.combatNow);},spawnEnemy:(x,y)=>this.spawnEnemy('infantry',x,y,undefined,true),spawnGem:(x,y,v)=>this.spawnGem(x,y,v),spawnChest:(x,y)=>{this.itemDrops?.spawnChest(x,y);},now:()=>this.combatNow,sfx:k=>this.sfx.play(k)},cfg);this.events.once('shutdown',()=>{this.env?.destroy();this.env=null;});}}
    this.env?.update(dt);
    if(this.mode==='none'&&!this.over)this.sishuiPass?.update();
    if(!this.terrainInit&&this.player){this.terrainInit=true;const tc=terrainConfigFor(this.hardKey(),this.hardStage());if(tc){this.terrain=new Terrain(this,tc);const t=this.terrain;Ally.terrainMul=(x,y)=>t.speedMul(x,y);this.terrainNav=t.navBoxes();this.events.once('shutdown',()=>{t.clear();if(this.terrain===t){this.terrain=null;Ally.terrainMul=null;}});}}
    if(this.terrain){this.terrain.update(this.combatNow,dt);this.player.terrainSpeedMul=this.terrain.speedMul(this.player.x,this.player.y);}
    this.updateEnemies(dt, time);
    this.yellow?.update(dt,time);this.xiliang?.update(dt,this.combatNow);this.shieldBars?.draw(this.enemies);if(this.objective){this.objective.update(dt);this.objectiveText?.setText(this.objective.text);}
    for(const t of this.chasingBosses){if(t.enemy.active&&t.enemy.spawnId===t.life){t.battle?.update(dt,time);t.label.setPosition(t.enemy.x,t.enemy.y-100).setText(t.name+" · 追兵 "+Math.ceil(Math.max(0,t.enemy.hp)/t.enemy.maxHp*100)+"%");}}
    this.rebuildGrid();
    if(time>=this.navigationAt){this.navigationAt=time+250;const boxes=[...(this.sishuiObstacles?.footprints??[]),...(this.terrain?(this.terrain.stats.burnt?(this.terrainNav=this.terrain.navBoxes()):this.terrainNav):[])];this.supplies?.appendNavigationBoxes(boxes);this.legion.navigation.setBoxes(boxes);}
    this.legion.update(dt, time, this.enemies, this.grid, (enemy, amount) => this.hitEnemy(enemy, amount, this.combatNow, 'melee', true));
    this.followers?.update(dt, this.combatNow);
    if (this.over) return;
    this.rebuildGrid();
    this.separateEnemies();
    this.separateAlliesFromEnemies(dt);
    this.supplies?.resolveBodies(this.allies,(a,d,n)=>this.legion.hurt(a,d,n),(e,d,n)=>this.hitEnemy(e,d,n,'melee',false,false));
    this.sishuiObstacles?.resolve(this.player,this.allies,this.enemies);
    if(this.terrain){this.terrain.resolve(this.player,this.allies,this.enemies);this.terrain.updateCanopy(this.player);}
    this.player.growth.recordMovement(Math.hypot(move.x,move.y)>.1&&time>=this.player.knockedUntil?Math.hypot(this.player.x-moveX,this.player.y-moveY):0,dt);
    if(this.player.growth.masteries.dragging_blade||this.dragFx)this.dragBladeFx().update(dt,Math.hypot(move.x,move.y)>.1&&time>=this.player.knockedUntil?Math.hypot(this.player.x-moveX,this.player.y-moveY):0);
    this.awakeningCombat?.movement(Math.hypot(move.x,move.y)>.1&&time>=this.player.knockedUntil?Math.hypot(this.player.x-moveX,this.player.y-moveY):0);
    this.buildCombat.movement(Math.hypot(move.x,move.y)>.1&&time>=this.player.knockedUntil?Math.hypot(this.player.x-moveX,this.player.y-moveY):0);
    this.drawAimIndicator();
    this.updateEnemyWalkAnimations(dt);
    this.rebuildGrid();
    this.applyContactDamage();
    if (this.over) return;
    this.martialFields.update(dt);
    this.buildCombat.update(this.combatNow);
    {const fc=this.buildCombat.flankCharge();if(fc.level||this.flankFx)this.flankBladeFx().update(dt,fc.level,fc.ratio);}
    {const wc=this.buildCombat.windstepCharge();if(wc.level||this.windFx)this.windstepFx().update(dt,wc.level,wc.ratio);}
    this.controlBuild?.update(this.combatNow);
    this.bulwarkBuild?.update(this.combatNow);
    this.awakeningCombat?.update(this.combatNow);
    const vfx=buildVfx(this);vfx.update(this.combatNow);
    if(this.buildCombat.charged()&&this.player.growth.build.tags().charge>0)vfx.emit('charge',this.player.x+14,this.player.y-14,this.combatNow,34);
    // 游击类战法（疾行印等）的移动风痕：用户反馈「疾行」特效一直挂在身后太显眼 → 改为脚边一小团、每 1.5 秒最多一次
    if(Math.hypot(move.x,move.y)>.1&&this.player.growth.build.tags().skirmish>0&&this.combatNow>=this.skirmishPuffAt){this.skirmishPuffAt=this.combatNow+1500;vfx.emit('skirmish',this.player.x-move.x*16,this.player.y+16-move.y*10,this.combatNow,26,Math.atan2(move.y,move.x),260);}
    this.updateWeapons(dt, time);
    this.reinforcements.update(time, this.enemies, (enemy, amount, fire) => this.hitEnemy(enemy, amount, time, fire ? 'fire' : 'melee', true, false));
    if (this.over) return;
    this.updateSpawner(dt, time);
    this.updateBolts(dt, time);
    this.updateBullets(dt);
    this.updateGems(dt);
    if (this.mode === 'none' && !this.over) this.player.passive.update(time, (enemy, amount) => this.hitEnemy(enemy, amount, time, 'fire', false, false));
    this.updateDmgFx(dt);
    this.checkEnd();
    // Hero reinforcement events are temporarily disabled; the system remains
    // available for a later pass but does not interrupt the current campaign.
  }

  /** World-aligned overscan patch: ground and props share camera translation, rounding and shake.
   * tilePosition is in source-texture pixels, so divide world offsets by tileScale.
   */
  protected syncGround(): void {
    const camera = this.cameras.main;
    const x = Math.floor(camera.scrollX / 256) * 256;
    const y = Math.floor(camera.scrollY / 256) * 256;
    this.ground.setPosition(x, y);
    this.ground.setTilePosition(x / this.ground.tileScaleX, y / this.ground.tileScaleY);
  }

  protected updateCamera(dt: number): void {
    if (this.cutscene?.active) return; // 过场动画时镜头归过场管
    const cam = this.cameras.main;
    // 首领登场时镜头朝首领探出去一下（BossPresence.look，平时为 0）
    const look = this.presence?.look;
    const targetX = this.player.x - GAME_WIDTH / 2 + (look?.x ?? 0);
    const targetY = this.player.y - GAME_HEIGHT / 2 + (look?.y ?? 0);
    const k = 1 - Math.exp(-11 * dt);
    cam.scrollX += (targetX - cam.scrollX) * k;
    cam.scrollY += (targetY - cam.scrollY) * k;
    // 相机与地面共用同一个（小数）scroll：不做取整，避免 1px 级跳动
  }

  protected readMove(): Phaser.Math.Vector2 {
    if (this.debugMoveActive) return this.debugMove.clone().normalize();
    if (this.joystick.active && this.joystick.vector.lengthSq() > 0.001) {
      return this.joystick.vector.clone();
    }
    // 手柄左摇杆 / 十字键（模拟量，推得浅走得慢）
    if (gamepad.move.x || gamepad.move.y) return new Phaser.Math.Vector2(gamepad.move.x, gamepad.move.y);
    const out = new Phaser.Math.Vector2(0, 0);
    if (this.cursors) {
      if (this.cursors.left.isDown) out.x -= 1;
      if (this.cursors.right.isDown) out.x += 1;
      if (this.cursors.up.isDown) out.y -= 1;
      if (this.cursors.down.isDown) out.y += 1;
    }
    if (this.wasd) {
      if (this.wasd.A?.isDown) out.x -= 1;
      if (this.wasd.D?.isDown) out.x += 1;
      if (this.wasd.W?.isDown) out.y -= 1;
      if (this.wasd.S?.isDown) out.y += 1;
    }
    return out.lengthSq() > 0 ? out.normalize() : out;
  }

  // ---------------- 敌人 ----------------

  protected rebuildGrid(): void {
    this.grid.clear();
    for (const enemy of this.enemies) {
      if (enemy.active) this.grid.insert(enemy);
    }
  }

  protected activeEnemyCount(): number {
    let count = 0;
    for (const enemy of this.enemies) if (enemy.active&&!enemy.isSupplySlot) count += 1;
    return count;
  }

  protected spawnEnemy(
    kind: EnemyDef['kind'],
    x: number,
    y: number,
    hpScale = this.chapter.hpScale(this.elapsed),
    force = false,
    override?:EnemyDef,
  ): Enemy | null {
    if (this.terrain) { const f = this.terrain.free(x, y, kind === 'boss' ? 34 : 20); x = f.x; y = f.y; } // 不刷在水里 / 树干里
    const poolLimit = BALANCE.enemyCap;
    const bossReserve = this.bossSpawned ? 0 : 1;
    const activeLimit = kind === 'boss' ? BALANCE.enemyCap : BALANCE.enemyCap - bossReserve;
    if (this.activeEnemyCount() >= activeLimit) return null;
    let enemy = this.enemies.find((e) => !e.active&&!e.isSupplySlot);
    if (!enemy) {
      if (this.enemies.length >= poolLimit+MAX_PROP_SLOTS) return null;
      enemy = new Enemy(this);
      this.enemies.push(enemy);
    }
    const base=override??this.chapter.enemies[kind];
    const variant=!override&&this.yellow&&kind!=='boss'?this.yellow.variant(base,this.elapsed):base;
    // 小怪按章节 / 关序成长（stageTuning.growth；首领不受影响）
    const growth=kind!=='boss'?this.chapter.growth:undefined;
    const def=growth?{...variant,damage:variant.damage*growth.damage}:variant;
    if(growth)hpScale*=growth.hp;
    else if(kind==='boss'&&this.chapter.growth?.bossHp)hpScale*=this.chapter.growth.bossHp;
    enemy.spawn(x,y,this.hardMode?{...def,damage:def.damage*HARD_MODE.damage}:def,this.hardMode?hpScale*(kind==='boss'?HARD_MODE.bossHp:HARD_MODE.enemyHp):hpScale,this.combatNow);armShield(enemy);
    return enemy;
  }

  /** 关卡目标：按当前关的 chapter.objective 建立（战线推进到下一关时重建）；HUD 在章节名下方显示一行。 */
  protected setupObjective(): void {
    this.objective?.clear(); this.objective = null;
    const o = this.chapter.objective; if (!o) { this.objectiveText?.setVisible(false); return; }
    this.objective = new StageObjectives({scene: this, player: this.player, enemies: this.enemies, spawn: (k, x, y) => this.spawnEnemy(k, x, y, undefined, true), spawnCamp: (x, y, hp) => this.supplies?.spawnCamp(x, y, Math.round(hp * this.chapter.hpScale(this.elapsed))) ?? null, kills: () => this.kills, elapsed: () => this.elapsed, banner: (t, c) => this.showWaveBanner(t, false, c)}, o);
    if (!this.objectiveText?.active) this.objectiveText = this.add.text(GAME_WIDTH / 2, 78, '', warText(14, '#ffd98a')).setOrigin(.5, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1).setStroke('#1a120b', 4).setName('objective-text');
    this.objectiveText.setVisible(true).setText(this.objective.text);
  }

  /** 盾碎：碎片效果，换成同章步兵造型（飞熊军等专属造型保留原样）。 */
  protected breakShield(enemy: Enemy): void {
    this.shieldBars?.shatter(enemy.x, enemy.y); this.sfx.play('hitHeavy');
    if (enemy.def.variant) { enemy.dropShield(null); return; }
    const base = this.chapter.enemies.infantry, look = this.yellow ? this.yellow.variant(base, this.elapsed) : base;
    enemy.dropShield(enemy.def.walkVisual && !look.walkVisual ? null : look);
  }

  protected spawnAroundPlayer(kind: EnemyDef['kind'], force = false): Enemy | null {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.max(GAME_WIDTH, GAME_HEIGHT) * 0.5 + Math.random() * 100;
    const x = this.player.x + Math.cos(angle) * distance;
    const y = this.player.y + Math.sin(angle) * distance;
    return this.spawnEnemy(kind, x, y, undefined, force);
  }

  protected updateSpawner(dt: number, time: number): void {
    // 末位首领倒地后等主将捡宝箱：不再刷兵
    if (this.awaitingChest) return;
    this.spawnTimer -= dt;
    const cap = BALANCE.enemyCap;
    if (this.spawnTimer <= 0 && this.activeEnemyCount() < cap) {
      // 刷怪时间轴按关卡节奏加速（stageTuning.pace）：原来第 N 波的刷怪强度在新的第 N 波出现
      const paced = this.elapsed * (this.chapter.pace ?? 1);
      const easy = this.tutorial?.easy(this.elapsed); // 新手引导：开局 30 秒刷兵放缓
      this.spawnTimer = this.chapter.spawnInterval(paced) * (easy?.interval ?? 1) * (this.sishuiPass?.spawnMul ?? 1); // 汜水关西凉营帐全塌后变稀
      const rawBurst = this.chapter.spawnBurst(paced), burst = easy && easy.burstDiv > 1 ? Math.max(1, Math.ceil(rawBurst / easy.burstDiv)) : rawBurst;
      for (let i = 0; i < burst; i += 1) {
        if (this.activeEnemyCount() >= cap) break;
        if (!this.spawnAroundPlayer(this.chapter.pickEnemy(paced))) break;
      }
    }

    const pace = this.chapter.pace ?? 1;
    if ((!this.chapter.stage||this.chapter.stage===3) && this.elapsed * pace >= BALANCE.eliteFirst) {
      this.eliteTimer -= dt * pace;
      if (this.eliteTimer <= 0) {
        this.eliteTimer = BALANCE.eliteInterval;
        this.spawnAroundPlayer('elite', true);
      }
    }

    if (!this.bossSpawned && (this.objective ? this.objective.done : this.elapsed >= chapterBossTime(this.chapter)) && this.mode === 'none') {
      this.spawnBoss();
    }
    void time;
  }

  protected spawnSceneProp(frame:number,x:number,y:number,size:number):void{if(Number.isInteger(frame)&&frame>=3&&frame<=7)this.supplies?.spawnSishui(frame as 3|4|5|6|7,x,y,size);}
  protected tryCustomBossSkill():boolean{if(this.zhangjiao&&this.boss?.active){this.zhangjiao.debug.force(2,this.combatNow);return true;}return false;}
  /** 测试模式「首领 → 指定招式 / 二阶段」：重设计的首领返回招式表。 */
  bossDebug():BossDebug|null{return this.zhangjiao?.debug??this.lubu?.debug??null;}
  protected customChapter():ChapterDef|null{return null;}
  protected customEnemyStep(_enemy:Enemy,_dt:number,_now:number,_target:{x:number;y:number}):boolean{return false;}
  protected customBossStep(_enemy:Enemy,_dt:number,_now:number):boolean{return false;}
  /** 会说台词的武将：主将 + 是可玩武将的随从。 */
  protected barkSpeakers(): BarkSpeaker[] {
    const out: BarkSpeaker[] = [{ id: this.runConfig.character, passive: this.player.passive, sprite: this.player.sprite, lord: true }];
    for (const f of this.followers?.members ?? []) if (f.recruit.hero && !f.downed) out.push({ id: f.recruit.hero, passive: f.passive, sprite: f.sprite, lord: false });
    return out;
  }
  protected spawnBoss(): void {
    if(this.boss?.active)return;this.yellowAltar?.destroy();this.yellowAltar=null;
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    { const ws = this.paceOn() ? PICK_PACE.waves : PICK_GUARANTEE.waves; this.ensurePicks(ws[ws.length - 1]); } // 保底：第 3 波后直接是首领、波次不再推进，首领登场时补到最后一档
    const angle = -Math.PI / 2;
    const x = this.player.x + Math.cos(angle) * 430;
    const y = this.player.y + Math.sin(angle) * 430;
    const boss = this.spawnEnemy('boss', x, y, 1, true);
    if (!boss) {
      this.bossSpawned = false;
      return;
    }
    this.boss = boss;
    preloadBossDeath(this, this.chapter.bossStyle); // 倒地帧（张角 / 张梁 / 张宝 / 董卓 / 吕布）提前载好
    this.firstBossAt=this.combatNow;
    if(this.chapter.stage&&this.chapter.stage>=2){this.yellowAltar=this.add.image(x,y+10,this.chapter.stage===2?'zhang_bao_altar':'zhang_jiao_altar').setDepth(DEPTH.ground+2).setDisplaySize(245,200).setAlpha(.75);}

    if(this.chapter.bossStyle==='xurong')this.xurong=new XurongBoss({scene:this,boss,player:this.player,army:this.legion,spawn:(kind,x,y)=>this.spawnEnemy(kind,x,y,1),sfx:()=>this.sfx.play('allySlash')},this.combatNow);
    // 2-3 洛阳：董卓上城、弱化吕布在城下（吕布 1/3 血逃走 → 董卓下城 → 20% 吕布杀回斩董卓）
    if(this.chapter.bossStyle==='dongzhuo'&&!BOSS_OLD)this.dzLubu=new DongzhuoLubu({scene:this,player:this.player,legion:this.legion,now:()=>this.combatNow,
      spawnLubu:(def,x,y)=>this.spawnEnemy('elite',x,y,1,true,def),lubuBase:()=>({...this.chapter.enemies.elite,hp:3200,damage:16,speed:48}),
      banner:(t,d,c)=>this.showWaveBanner(t,d,c),sfx:k=>this.sfx.play(k),killBoss:()=>{const b=this.boss;if(b?.active){b.invulnerable=false;b.hp=0;this.killEnemy(b);}},
      enemies:()=>this.enemies,allies:()=>this.allies,hitFeel:()=>this.hitFeel,
      cutscene:(script,anchors,done)=>this.playCutscene(script,anchors,done),heroSprite:id=>this.heroSprite(id),
      line:(id,t)=>(this as unknown as {storyDir?:{line(id:string,t:{x:number;y:number}):boolean}}).storyDir?.line(id,t)??false},boss); // 剧情台词：故事系统（claude/story-batch1）合并后生效
    if(this.chapter.bossStyle==='huaxiong')this.sishuiPass?.onBoss(boss); // 汜水关：关门洞开，华雄带亲卫杀出
    if(this.chapter.bossStyle==='huaxiong'){this.huaxiong=new HuaxiongBoss({scene:this,boss,player:this.player,army:this.legion,hurtTroops:(x,y,r,d,n,a,arc)=>this.legion.hurtArea(x,y,r,d,n,a,arc),sfx:()=>this.sfx.play('allySlash')},this.combatNow);}
    // 首领招式框架（第一章张梁 / 张宝）与已有控制器首领的坐骑（吕布赤兔、华雄）
    {const mv=BOSS_MOVES[this.chapter.bossStyle];if(mv&&!BOSS_OLD&&(this.chapter.bossStyle==='zhangliang'||this.chapter.bossStyle==='zhangbao'))this.moveset=new BossMoveset({scene:this,boss,player:this.player,army:this.legion,spawn:(kind,x,y,def)=>this.spawnEnemy(kind,x,y,1,true,def),def:k=>this.chapter.enemies[k],banner:(t,c)=>this.showWaveBanner(t,true,c),sfx:k=>this.sfx.play(k)},boss.sprite.texture.key,this.combatNow,mv,'walk');
     const md=BOSS_MOUNTS[this.chapter.bossStyle];if(md&&!BOSS_OLD)this.bossMount=new BossMount(this,boss,md,()=>{const c=(this.lubu??this.huaxiong) as unknown as {state?:string}|null,st=c?.state??'';return !!c&&(st==='warn'||st==='attack'||st==='windup'||st==='charge'||(!!this.lubu&&(/Windup$/.test(st)||['combo','zig','sweep','dash','aim','shot','spin','hop','recover'].includes(st))));});}
    if (this.chapter.bossStyle === 'zhangjiao' && !BOSS_OLD) {
      this.zhangjiao = new ZhangjiaoBoss({ scene: this, boss, player: this.player, army: this.legion,
        fireBolt: (x, y, tx, ty, d, sp) => this.fireBolt(this.bullets, x, y, tx, ty, d, 0, false, sp, this.textures.exists('bossfx_zj_talisman') ? 'bossfx_zj_talisman' : 'orb'),
        spawn: (kind, x, y, def) => this.spawnEnemy(kind, x, y, 1, true, def), infantryDef: () => this.chapter.enemies.infantry,
        banner: (t, c) => this.showWaveBanner(t, true, c), sfx: (k) => this.sfx.play(k) }, this.combatNow);
    }
    if (this.chapter.bossStyle === 'lubu') {
      this.lubu = new LubuBoss({ scene: this, boss, player: this.player,
        hurtTroops: (x, y, radius, damage, now, angle, arc) => this.legion.hurtArea(x, y, radius, damage, now, angle, arc),
        playSfx: (kind) => this.sfx.play(kind),
        onPhase2: () => { this.bossPhase2 = true; if (BOSS_OLD) this.showWaveBanner('吕布震怒！注意预警后反击', true); },
        banner: (t, c) => this.showWaveBanner(t, true, c),
      });
    }
    this.sfx.boss();
    this.cameras.main.flash(320, 120, 40, 30, false);
    // 首领出场：专属锣鼓出场段 + 主题曲（data/bossMusic.ts），并显示名号标题（不暂停战斗）
    const profile = bossProfile(this.chapter.bossName);
    this.music.setBoss(profile);
    this.announceBoss(profile.title, this.chapter.bossName);
    this.presence?.entrance(boss);
    this.lordBossBark('bossAppear', !!this.storyDir?.bossIntro(boss.sprite)); // 剧情：首领登场大字台词；主将（HeroBark）接一句
  }

  /** 首领名号标题：画面上部一道短墨痕，墨上名号小字 + 名字，约 2.6 秒淡出；不拦截点击、不暂停。
   *  2026-11-16 试玩反馈「boss 出来那个预警 UI 太大了」：墨痕从横贯全屏缩成约 6 成宽、高度减半，字号降约 4 成，
   *  放在顶部 HUD 与主将之间的空地，不压 HUD、不挡主将。 */
  protected announceBoss(title: string, name: string): void {
    this.children.getByName('boss-announce')?.destroy();
    const W = GAME_WIDTH, D = IS_DESKTOP, y = GAME_HEIGHT * (D ? .25 : .2), bw = D ? 500 : Math.min(W * .78, 400), bh = D ? 70 : 72;
    const root = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay - 8).setName('boss-announce').setVisible(this.mode === 'none');
    const ink = this.textures.exists('btn_ink_secondary_normal') ? this.add.image(W / 2, y, 'btn_ink_secondary_normal').setDisplaySize(bw, bh).setTint(0x2a2420).setAlpha(.92) : this.add.rectangle(W / 2, y, bw, bh * .7, 0x120d0a, .8);
    const t1 = this.add.text(W / 2, y - 14, title, { fontFamily: HEADING_FONT, fontSize: '12px', color: '#d9b26a', resolution: 2 }).setOrigin(.5).setLetterSpacing(5);
    const t2 = this.add.text(W / 2, y + 7, name, { fontFamily: TITLE_FONT, fontSize: '28px', color: '#e2412b', resolution: 2 }).setOrigin(.5).setLetterSpacing(8).setShadow(0, 2, '#000', 4, true, true);
    root.add([ink, t1, t2]);
    for (const o of root.list) (o as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0);
    root.setAlpha(0);
    // 用真实时钟驱动（与战斗计时器解耦，暂停 / 升级弹窗期间也能正常淡出）
    const start = performance.now();
    const tick = (): void => {
      const t = performance.now() - start, a = t < 250 ? t / 250 : t > 2300 ? Math.max(0, 1 - (t - 2300) / 400) : 1;
      root.setAlpha(a).setVisible(this.mode === 'none');
      t2.setScale(1.12 - .12 * Math.min(1, t / 300));
      if (t >= 2700 || !root.active) { this.events.off(Phaser.Scenes.Events.POST_UPDATE, tick); root.destroy(); }
    };
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
    this.events.once('shutdown', () => this.events.off(Phaser.Scenes.Events.POST_UPDATE, tick));
  }

  protected updateEnemies(dt: number, time: number): void {
    const player = this.player;
    this.rebuildGrid();
    this.enemyMovement.prepare(this.enemies, this.grid, this.legion.grid, player.x, player.y, dt, this.combatNow);
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.updateVisual(time);
      if(enemy.isSupplySlot)continue;
      enemy.frameStartX = enemy.x;
      enemy.frameStartY = enemy.y;
      if (!enemy.controlImmune && enemy.stunUntil > time) { enemy.moveVx = enemy.moveVy = enemy.intentDx = enemy.intentDy = 0; continue; }
      // 貂蝉「离间」：倒戈中的敌人不追主将，转身冲撞最近的同伴（逻辑在 CharacterPassives.driveTurned）
      if (player.passive.driveTurned(enemy, dt, this.combatNow, (x, y, r) => this.grid.query(x, y, r), (t, n) => this.hitEnemy(t, n, this.combatNow, 'melee', true, false)) || this.followerPassives.some(fp => fp.driveTurned(enemy, dt, this.combatNow, (x, y, r) => this.grid.query(x, y, r), (t, n) => this.hitEnemy(t, n, this.combatNow, 'melee', true, false)))) { enemy.contactCd = Math.max(0, enemy.contactCd - dt); continue; }
      enemy.contactCd = Math.max(0, enemy.contactCd - dt);
      enemy.shootCd -= dt;
      enemy.dashCd -= dt;
      enemy.orbitCd = Math.max(0, enemy.orbitCd - dt);

      const target = enemy.targetAlly?.active && enemy.targetAlly.lifeId === enemy.targetLife && enemy.kind !== 'boss' && enemy.kind !== 'cavalry' ? enemy.targetAlly : player;
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      if(this.customEnemyStep(enemy,dt,this.combatNow,target)){}
      else if (this.xiliang?.handleEnemy(enemy,dt,this.combatNow)) {}
      else if (this.yellow?.handleEnemy(enemy,dt,this.combatNow,target)) {
        // Stage-specific spear, earth caster, shield and temporary elite behaviors.
      } else if (enemy.kind === 'archer') {
        if (dist > 230) {
          this.advanceEnemy(enemy, nx, ny, dt);
        } else if (dist < 150) {
          this.advanceEnemy(enemy, -nx * .8, -ny * .8, dt);
        } else if (this.crowdSteering) {
          this.advanceEnemy(enemy, 0, 0, dt);
        }
        if (enemy.shootCd <= 0 && dist < 460 && enemy.attackUntil <= this.combatNow) {
          enemy.shootCd = 2.4;
          const ax = Math.abs(nx);
          const ay = Math.abs(ny);
          const dir = ax > ay ? (nx < 0 ? 'left' : 'right') : ny < 0 ? 'up' : 'down';
          enemy.startAttack(this.combatNow, dir);
          this.feedback.attack(enemy, Math.atan2(ny, nx), this.combatNow, 360);
          const spawnId = enemy.spawnId;
          this.time.delayedCall(180, () => {
            // 只在放箭帧生成箭矢
            if (!enemy.active || enemy.spawnId !== spawnId || this.over) return;
            const p = enemy.targetAlly?.active && enemy.targetAlly.lifeId === enemy.targetLife ? enemy.targetAlly : this.player;
            this.sfx.play('enemyArrow');
            // 箭矢颜色跟射箭的人穿的阵营色走（第二章西凉暗红、袁军土黄、各势力色；黄巾原样），只换颜色
            this.fireBolt(this.bullets, enemy.x, enemy.y, p.x, p.y, enemy.def.damage*(this.env?.damageMul(enemy)??1), 0, false, 210, enemyArrowTexture(this, enemy.sprite.texture.key));
          });
        }
      } else if (enemy.kind === 'cavalry') {
        const now = this.combatNow;
        if (enemy.chargeState === 'warn') {
          // 预警：原地锁定 + 红色调（不画地面线条）
        } else if (enemy.chargeState === 'charge') {
          const wm = this.terrain?.speedMul(enemy.x, enemy.y) ?? 1; // 河里冲锋也减速
          enemy.sprite.x += enemy.chargeVx * dt * wm;
          enemy.sprite.y += enemy.chargeVy * dt * wm;
          const hitDist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
          if (!enemy.chargeHit && hitDist < player.radius + enemy.radius + 8) {
            enemy.chargeHit = true;
          this.feedback.attack(enemy, Math.atan2(enemy.chargeVy, enemy.chargeVx), now);
            if (player.takeDamage(18, now)) this.cameras.main.flash(120, 180, 40, 40, false);
            // 中等击退
            this.player.sprite.x += nx * 36;
            this.player.sprite.y += ny * 36;
            enemy.chargeState = 'recover';
            enemy.chargeAt = now + 350;
          }
        } else if (enemy.chargeState === 'recover') {
          enemy.sprite.x += nx * enemy.def.speed * 0.35 * dt;
          enemy.sprite.y += ny * enemy.def.speed * 0.35 * dt;
          if (now >= enemy.chargeAt) {
            enemy.chargeState = 'none';
            enemy.dashCd = 6;
          }
        } else {
          this.advanceEnemy(enemy, nx, ny, dt);
          if (enemy.dashCd <= 0 && dist >= 60 && dist <= 120) {
            enemy.dashCd = 6;
            const ax = Math.abs(nx);
            const ay = Math.abs(ny);
            const dir = ax > ay ? (nx < 0 ? 'left' : 'right') : ny < 0 ? 'up' : 'down';
            enemy.startCharge(now, dir);
            this.feedback.attack(enemy, Math.atan2(ny, nx), now, 450);
            this.sfx.play('chargeWarn');
            // B 方案：x3 速度、0.6s 冲锋；预警错峰 0-200ms，避免整群同步
            enemy.chargeVx = nx * enemy.def.speed * 3;
            enemy.chargeVy = ny * enemy.def.speed * 3;
            enemy.chargeAt = now + 450 + Math.random() * 200;
          }
        }
      } else if (enemy.kind === 'boss') {
        const chasing=this.chasingBosses.find(t=>t.enemy===enemy&&t.life===enemy.spawnId);
        if(this.customBossStep(enemy,dt,this.combatNow)){}
        else if(chasing){if(chasing.huaxiong)chasing.huaxiong.update(dt,this.combatNow);else if(chasing.xurong)chasing.xurong.update(dt,this.combatNow);else chasing.battle?.moveBoss(enemy,dt,this.combatNow);}
        else if (this.moveset && enemy === this.boss) this.moveset.update(dt,this.combatNow);
        else if (this.yellow && this.chapter.stage!==3) this.yellow.moveBoss(enemy,dt,this.combatNow);
        else if(this.huaxiong)this.huaxiong.update(dt,this.combatNow);
        else if(this.xurong)this.xurong.update(dt,this.combatNow);
        else if (this.lubu) this.lubu.update(dt, this.combatNow);
        else if (this.zhangjiao) { this.zhangjiao.update(dt, this.combatNow); this.bossEnergy = this.zhangjiao.energy; }
        else {
          enemy.sprite.x += nx * enemy.def.speed * dt;
          enemy.sprite.y += ny * enemy.def.speed * dt;
          this.updateBossAbilities(dt);
        }
      } else {
        this.advanceEnemy(enemy, nx, ny, dt);
      }

      enemy.updateChargeVisual(this.combatNow);
      enemy.updateAttackVisual(this.combatNow);
      enemy.intentDx = enemy.x - enemy.frameStartX;
      enemy.intentDy = enemy.y - enemy.frameStartY;
    }
  }

  protected advanceEnemy(enemy: Enemy, nx: number, ny: number, dt: number): void {
    // 出手（拉弓放箭、挥砍）期间原地站定，避免攻击帧边播边平移；首领与骑兵冲锋有各自的位移逻辑。
    if (enemy.kind !== 'boss' && enemy.kind !== 'cavalry' && enemy.attackUntil > this.combatNow) { enemy.moveVx = enemy.moveVy = 0; return; }
    const controlSpeed=this.controlBuild?.motion(enemy,this.combatNow,dt)??1;
    const martialSpeed=controlSpeed*(enemy.kind!=='boss'&&this.combatNow<enemy.martialSlowUntil?enemy.martialSlow:1)*(this.env?.speedMul(enemy)??1)*(this.terrain?.speedMul(enemy.x,enemy.y)??1);
    enemy.sprite.x += (this.crowdSteering ? enemy.moveVx : nx * enemy.def.speed) * dt * martialSpeed;
    enemy.sprite.y += (this.crowdSteering ? enemy.moveVy : ny * enemy.def.speed) * dt * martialSpeed;
  }

  /** 分离与网格都稳定后，再统一结算接触伤害。 */
  /** 特殊位移保留硬分离，普通敌军由柔性分离处理。 */
  protected separateAlliesFromEnemies(dt=1/60): void {
    for (const ally of this.allies) {
      if (!ally.active) continue;
      const near = this.grid.query(ally.x, ally.y, ally.radius + 26, this.allyScratch);
      for (const enemy of near) {
        if (!enemy.active || enemy.isSupplySlot || enemy.controlImmune) continue;
        const soft=this.crowdSteering&&enemy.kind!=='boss'&&!(enemy.kind==='cavalry'&&enemy.chargeState!=='none');
        let dx = enemy.x - ally.x;
        let dy = enemy.y - ally.y;
        let dist = Math.hypot(dx, dy);
        if(dist<.001){const angle=(enemy.uid*73+ally.id*151)*Math.PI/180;dx=Math.cos(angle);dy=Math.sin(angle);dist=1;}
        const min = (ally.radius + enemy.radius)*(soft?.85:1);
        if (dist > 0.001 && dist < min - 1.5) {
          const overlap = min - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          const limit=soft?Math.min(2,120*dt):6;
          const enemyPush = Math.min(limit, overlap * 0.7);
          const allyPush = Math.min(soft?limit*.4:6, overlap * 0.3);
          enemy.sprite.x += nx * enemyPush;
          enemy.sprite.y += ny * enemyPush;
          ally.push(-nx * allyPush, -ny * allyPush);
        }
      }
    }
  }

  /** 步态必须基于碰撞/分离后的真实位移：被挤住时回待机帧。 */
  protected updateEnemyWalkAnimations(dt: number): void {
    const view = this.cameras.main.worldView;
    const margin = 80;
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.shadow.setPosition(enemy.x,enemy.isSupplySlot?enemy.y+2:enemy.y + enemy.radius * .72);
      if (enemy.kind !== 'boss') enemy.sprite.setDepth(actorDepth(enemy.isSupplySlot?enemy.y:enemy.y + enemy.radius * .72));
      // 华雄 / 徐荣由专属控制器出帧；前线推进后成为追兵首领时也不再套通用走路帧（xurong 图集没有 down_0 等帧，会持续报 no frame）
      if(((this.huaxiong||this.xurong)&&enemy===this.boss)||(enemy.kind==='boss'&&this.chasingBosses.some(t=>t.enemy===enemy&&t.life===enemy.spawnId&&(t.huaxiong||t.xurong)))){enemy.shadow.setPosition(enemy.x,enemy.y+1).setDisplaySize(74,20);continue;}
      if (!enemy.walkSheet) continue;
      const onScreen =
        enemy.x > view.x - margin &&
        enemy.x < view.right + margin &&
        enemy.y > view.y - margin &&
        enemy.y < view.bottom + margin;
      if (onScreen) enemy.updateWalk(dt, enemy.x - enemy.frameStartX, enemy.y - enemy.frameStartY);
    }
  }

  protected applyContactDamage(): void {
    const player = this.player;
    for (const enemy of this.enemies) {
      if (!enemy.active || (enemy.def.behavior==='wall'||enemy.isSupplySlot) || enemy.contactCd > 0) continue;
      if (enemy === this.boss && this.lubu && this.lubu.state !== 'approach') continue;
      if (player.passive.isTurned(enemy, this.combatNow) || this.followerPassives.some(fp => fp.isTurned(enemy, this.combatNow))) continue; // 倒戈中的敌人不撞主将（含随行貂蝉魅惑的）
      const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      if (dist < player.radius + enemy.radius + 2) {
        enemy.contactCd = 1.0;
        this.feedback.attack(enemy, Math.atan2(player.y - enemy.y, player.x - enemy.x), this.combatNow);
        if (player.takeDamage(enemy.def.damage*(this.env?.damageMul(enemy)??1), this.combatNow)) {
          this.cameras.main.flash(90, 180, 40, 40, false);
        }
      }
    }
    if (!this.player.alive) this.finish(false, 'death');
  }

  protected separateEnemies(): void {
    if (this.crowdSteering) return;
    for (const enemy of this.enemies) {
      if (enemy.active) this.separate(enemy);
    }
  }

  protected separate(enemy: Enemy): void {
    if (enemy.controlImmune||enemy.isSupplySlot) return;
    const neighbors = this.grid.query(enemy.x, enemy.y, enemy.radius + 26, this.separationScratch);
    for (const other of neighbors) {
      if (other === enemy || !other.active || other.isSupplySlot || other.controlImmune) continue;
      const dx = enemy.x - other.x;
      const dy = enemy.y - other.y;
      const dist = Math.hypot(dx, dy);
      const min = enemy.radius + other.radius;
      // 允许 1.5px 轻微重叠，降低分离强度，避免怪物越靠近玩家越被推回去
      if (dist > 0.001 && dist < min - 1.5) {
        const push = ((min - dist) / dist) * 0.35;
        enemy.sprite.x += dx * push;
        enemy.sprite.y += dy * push;
      }
    }
  }

  /** 张角施法前的轻量提示：弹幕=金色圆环，召唤=红橙四方火花。 */
  protected bossCastFx(kind: 'volley' | 'summon'): void {
    if (!this.boss || !this.boss.active) return;
    this.sfx.play(kind === 'volley' ? 'bossVolley' : 'bossSummon');
    const b = this.boss;
    if (kind === 'volley') {
      const ring = this.add.circle(b.x, b.y + 18, 14).setStrokeStyle(3, 0xffd166, 0.95).setDepth(DEPTH.fx).setVisible(!HINT_MOCK);
      this.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
      const glow = this.add.circle(b.x, b.y - 26, 9, 0xffe9a8, 0.95).setDepth(DEPTH.fx);
      this.tweens.add({ targets: glow, scale: 2.2, alpha: 0, duration: 300, onComplete: () => glow.destroy() });
      return;
    }
    // 召唤预警：四个红橙火花从脚下向外扩散，形状与弹幕明显不同
    for (let i = 0; i < 4; i += 1) {
      const a = (Math.PI * 2 * i) / 4 + Math.PI / 4;
      const spark = this.add
        .circle(b.x + Math.cos(a) * 14, b.y + 18 + Math.sin(a) * 14, 4, 0xff5222, 0.95)
        .setDepth(DEPTH.fx);
      this.tweens.add({
        targets: spark,
        x: b.x + Math.cos(a) * 42,
        y: b.y + 18 + Math.sin(a) * 42,
        scale: 1.4,
        alpha: 0,
        duration: 350,
        onComplete: () => spark.destroy(),
      });
    }
  }

  protected updateBossAbilities(dt: number): void {
    if (!this.boss) { this.bossShieldGfx?.clear(); return; }
    const now = this.combatNow;
    this.drawBossShield();
    this.ensureBossPhase2();
    if (this.bossUltPhase !== 'none') {
      this.updateBossUltimate(now);
      return;
    }
    this.bossEnergy = Math.min(100, this.bossEnergy + dt * (this.bossPhase2 ? 6 : 5));
    this.bossOrbCd -= dt;
    this.bossFanCd -= dt;
    this.bossSummonCd -= dt;
    if (this.bossOrbCd <= 0) {
      this.bossOrbCd = this.bossPhase2 ? 1.15 : 1.5;
      this.fireBolt(this.bullets, this.boss.x, this.boss.y, this.player.x, this.player.y, 9, 0, false, 250, 'orb');
    }
    if (this.bossFanCd <= 0) {
      this.bossFanCd = this.bossPhase2 ? 4 : 5;
      const base = Math.atan2(this.player.y - this.boss.y, this.player.x - this.boss.x);
      for (let i = -1; i <= 1; i += 1) {
        const a = base + i * 0.22;
        this.fireBolt(this.bullets, this.boss.x, this.boss.y, this.boss.x + Math.cos(a) * 10, this.boss.y + Math.sin(a) * 10, 7, 0, false, 220, 'orb');
      }
    }
    if (this.bossSummonCd <= 0) {
      this.bossSummonCd = this.bossPhase2 ? 8 : 10;
      this.bossSummons = this.bossSummons.filter(({ enemy, spawnId }) => enemy.active && enemy.spawnId === spawnId);
      if (this.bossSummons.length < 8) {
        this.bossCastFx('summon');
        const count = Math.min(this.bossPhase2 ? 4 : 3, 8 - this.bossSummons.length);
        for (let i = 0; i < count; i += 1) {
          const a = (Math.PI * 2 * i) / count;
          const spawned = this.spawnEnemy('infantry', this.boss.x + Math.cos(a) * 66, this.boss.y + Math.sin(a) * 66);
          if (spawned) this.bossSummons.push({ enemy: spawned, spawnId: spawned.spawnId });
        }
      }
    }
    if (this.bossEnergy >= 100) this.startBossUltimate(now);
  }

  protected ensureBossPhase2(): void {
    if (this.chapter.bossStyle !== 'zhangjiao') return;
    if (this.zhangjiao) return; // 重设计版自己按血量进二阶段（每次挨打都会走到这里，不能在这里强制）
    if (!this.boss?.active) return;
    if (!this.bossPhase2 && this.boss.hp / this.boss.maxHp <= 0.5) {
      this.bossPhase2 = true;
      this.bossShield = 300; // 50% 血量触发一次 300 护盾
      this.boss.sprite.setTint(0xff8866);
      this.cameras.main.flash(200, 90, 200, 255, false);
      this.sfx.play('bossSummon');
    }
  }

  /** 50% 血量 300 护盾：Boss 周围青蓝护盾环，跟随移动并脉动。 */
  protected drawBossShield(): void {
    const gfx = this.bossShieldGfx;
    if (!gfx) return;
    gfx.clear();
    if (!this.boss || this.bossShield <= 0) return;
    const pulse = Math.sin(this.combatNow * 0.006) * 2;
    const r = this.boss.radius + 10 + pulse;
    gfx.lineStyle(3, 0x66d9ff, 0.85);
    gfx.strokeCircle(this.boss.x, this.boss.y, r);
    gfx.lineStyle(1.5, 0xbbeeff, 0.5);
    gfx.strokeCircle(this.boss.x, this.boss.y, r + 4);
  }

  protected startBossUltimate(now: number): void {
    if (!this.boss) return;
    this.bossUltPhase = 'charge';
    this.bossUltAt = now + 800;
    this.bossUltRound = 0;
    this.bossUltHits = 0;
    this.music.setDuck(0.85);
    this.boss.sprite.setTint(0xcc88ff);
    this.sfx.play('bossVolley');
  }

  protected lockBossUltPoints(): void {
    const px = this.player.x;
    const py = this.player.y;
    this.bossUltPoints = [
      { x: px, y: py },
      { x: px + 90, y: py + 40 },
      { x: px - 80, y: py - 50 },
    ];
  }

  protected beginBossUltRound(now: number): void {
    this.bossUltRound += 1;
    this.bossUltPhase = 'warn';
    this.lockBossUltPoints();
    this.bossUltAt = now + 800;
    this.music.setDuck(0.7);
  }

  protected updateBossUltimate(now: number): void {
    const gfx = this.bossUltGfx;
    if (!this.boss || !this.boss.active) {
      this.bossUltPhase = 'none';
      gfx.clear();
      return;
    }
    if (this.bossUltPhase === 'charge') {
      gfx.clear();
      // 蓄雷：紫色雷环聚集
      const t = 1 - Math.max(0, this.bossUltAt - now) / 800;
      // 低调预警（默认）：蓄雷不画同心圆，改为首领身上闪光（?telegraph=1 恢复）
      if (TELEGRAPH_CLASSIC) {
      gfx.lineStyle(3, 0xcc88ff, 0.5 + t * 0.4);
      gfx.strokeCircle(this.boss.x, this.boss.y, 20 + t * 46);
      gfx.lineStyle(2, 0xfff2a8, 0.7);
      gfx.strokeCircle(this.boss.x, this.boss.y, 12 + t * 26);
      } else windupFlash(this.boss, now);
      if (now >= this.bossUltAt) this.beginBossUltRound(now);
      return;
    }
    if (this.bossUltPhase === 'warn') {
      gfx.clear();
      const pulse = 1 + Math.sin(now / 70) * 0.06;
      for (const pt of this.bossUltPoints) {
        // 特效型警示（默认）：落点上空乌云聚拢、地上符光渐亮；缺图时退回细虚线
        if (!TELEGRAPH_CLASSIC && HINT_MOCK === 'c' && warnFx(this).warn('zj' + Math.round(pt.x) + ',' + Math.round(pt.y), 'lightning', pt.x, pt.y, 72, 1 - Math.max(0, this.bossUltAt - now) / 800, now)) continue;
        if (HINT_MOCK === 'c' && !TELEGRAPH_CLASSIC) keyOutline(gfx, pt.x, pt.y, 72, 1 - Math.max(0, this.bossUltAt - now) / 800, now); else
        warnCircle(gfx, pt.x, pt.y, 72 * pulse, 1 - Math.max(0, this.bossUltAt - now) / 800, 0x7a3cff, 0xd9c2ff, false, now);
      }
      if (now >= this.bossUltAt) {
        this.bossUltPhase = 'strike';
        this.bossUltAt = now + 300;
        this.music.setDuck(0.5);
        gfx.clear();
        let hit = false;
        for (const pt of this.bossUltPoints) {
          // 多道雷电（有雷劈序列帧时用图，不再画线）
          const boltArt = !TELEGRAPH_CLASSIC && HINT_MOCK === 'c' && warnFx(this).impact('lightning', pt.x, pt.y, 72);
          if (!boltArt) for (let k = -1; k <= 1; k += 1) {
            const ox = pt.x + k * 16;
            gfx.lineStyle(k === 0 ? 6 : 3, 0xfff2a8, 1);
            gfx.beginPath();
            gfx.moveTo(ox, pt.y - 180);
            gfx.lineTo(ox + 8, pt.y - 120);
            gfx.lineTo(ox - 6, pt.y - 70);
            gfx.lineTo(ox, pt.y);
            gfx.strokePath();
          }
          if (TELEGRAPH_CLASSIC) { gfx.lineStyle(4, 0xcc88ff, 0.9); gfx.strokeCircle(pt.x, pt.y, 72); } else groundCracks(gfx, pt.x, pt.y, 72, 1, 0, Math.PI * 2, 0, true);
          this.legion.hurtArea(pt.x, pt.y, 72, 16, now);
          // 冲击波（旧样式）；新样式只在落点扬尘裂纹
          if (TELEGRAPH_CLASSIC) { const ring = this.add.circle(pt.x, pt.y, 20).setStrokeStyle(4, 0xd8b8ff, 0.95).setDepth(DEPTH.fx + 2);
          this.tweens.add({ targets: ring, scale: 4.2, alpha: 0, duration: 420, onComplete: () => ring.destroy() }); }
          if (Math.hypot(this.player.x - pt.x, this.player.y - pt.y) < 72) hit = true;
        }
        if (hit && this.bossUltHits < 2) {
          this.bossUltHits += 1;
          this.player.takeDamage(16, now);
          this.cameras.main.shake(160, 0.006);
          this.cameras.main.flash(120, 220, 220, 120, false);
        }
        this.sfx.play('bossSummon');
      }
      return;
    }
    if (this.bossUltPhase === 'strike') {
      if (now >= this.bossUltAt) {
        if (this.bossUltRound < 3) {
          this.beginBossUltRound(now);
        } else {
          this.bossUltPhase = 'recover';
          this.bossUltAt = now + 1500;
          this.music.setDuck(0.75);
          this.bossEnergy = 0;
          this.boss.sprite.clearTint();
          gfx.clear();
        }
      }
      return;
    }
    if (this.bossUltPhase === 'recover') {
      if (now >= this.bossUltAt) {
        this.bossUltPhase = 'none';
        this.music.setDuck(1);
      }
    }
  }

  // ---------------- 武器 ----------------

  /** 暂停菜单主动离开：本场作废，仍存活的后备兵归还主城。 */
  protected abandonRun():void{if(this.worldCampaign&&!this.over)abandonExpedition(this.expeditionId,this.allies.filter(a=>a.active&&a.reserveSoldier).map(a=>a.kind));}
  protected handleBattlePointer(_pointer:Phaser.Input.Pointer):boolean{return false;}
  /** 武器优先目标（统一索敌，2026-11-16）：射程内首领 > 精锐，各取最近；都没有时返回 null，由武器自己找群怪 / 最近。关卡场景可覆盖（先打敌营）。 */
  protected priorityWeaponTarget(range:number,bodyRadius=true):Enemy|null{
    const px=this.player.x,py=this.player.y;let boss:Enemy|null=null,elite:Enemy|null=null,bd=Infinity,ed=Infinity;
    for(const e of this.grid.query(px,py,range+60)){if(!e.active||e.isSupplySlot)continue;const d=Math.hypot(e.x-px,e.y-py)-(bodyRadius?e.radius:0);if(d>range)continue;
      if(e.kind==='boss'&&d<bd){bd=d;boss=e;}else if(e.kind==='elite'&&d<ed){ed=d;elite=e;}}
    return boss??elite;
  }
  protected createWeaponHost(): WeaponHost {
    const scene = this;
    return {
      get player() { return scene.player; }, get enemies() { return scene.enemies; },
      get grid() { return scene.grid; }, get add() { return scene.add; }, get time() { return scene.time; },
      get combatNow() { return scene.combatNow; }, get cameras() { return scene.cameras; },
      get sfx() { return scene.sfx; }, get over() { return scene.over; },
      get spearShots() { return scene.spearShots; }, get bolts() { return scene.bolts; },
      hitEnemy: (...args) => scene.hitEnemy(...args),
      nearestEnemy: (...args) => scene.nearestEnemy(...args),
      priorityTarget: (range,bodyRadius)=>scene.priorityWeaponTarget(range,bodyRadius),
      fireBolt: (...args) => scene.fireBolt(...args),
      spawnGuandaoSlash: (...args) => scene.spawnGuandaoSlash(...args),
      spawnFlagSwingFx: (...args) => scene.spawnFlagSwingFx(...args),
      spawnFlameGatherFx: (...args) => scene.spawnFlameGatherFx(...args),
      spawnFlameFx: (...args) => scene.spawnFlameFx(...args),
      heroFx: (id: string, x: number, y: number, size: number, rotation = 0) => scene.playHeroFx(id, x, y, size, rotation),
      zhaoyunBurst: (angle: number, len: number) => scene.zhaoyunFx?.burst(scene.player.x, scene.player.y, angle, len, scene.combatNow, scene.player.sprite),
      draggingBladeWave: (angle, size, kind, hits) => scene.dragBladeFx().release(angle, size, kind, hits),
      rallyAllies: (fraction: number) => { for (const u of scene.allies) if (u.active) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * fraction); },
      martialField: (...args) => scene.martialFields.add(...args),
    };
  }

  /** 随行命中的受击特效 / 命中火花（主将原版的 refined_impact 与 art_fx；伤害按友军结算时原本会跳过）。每帧限额 FOLLOW.hitFxPerFrame。 */
  private followerHitBudget = { at: -1, n: 0 };
  /** 无名随行（枪 / 刀 / 弓 / 谋）命中火花：按兵器出现成手绘命中图（刺 / 斩 / 箭 / 法术），与名将随行共用每帧限额。 */
  followerTemplateHitFx(enemy: Enemy, kind: 'spear' | 'blade' | 'bow' | 'strategist', fromX: number, fromY: number): void {
    const time = this.combatNow; if (this.followerHitBudget.at !== time) { this.followerHitBudget.at = time; this.followerHitBudget.n = 0; }
    if (this.followerHitBudget.n >= FOLLOW.hitFxPerFrame) return; this.followerHitBudget.n++;
    const src = kind === 'bow' ? 'arrow' : kind === 'strategist' ? 'fire' : 'melee', type = kind === 'spear' ? 'pierce' : kind === 'blade' ? 'slash' : kind === 'bow' ? 'arrow' : 'spell';
    this.feedback.hit(enemy.x, enemy.y, Math.atan2(enemy.y - fromY, enemy.x - fromX), time, src, { type });
  }
  followerHitFx(enemy: Enemy, fromX: number, fromY: number, time: number, source: 'melee' | 'arrow' | 'fire'): void {
    if (this.followerHitBudget.at !== time) { this.followerHitBudget.at = time; this.followerHitBudget.n = 0; }
    if (this.followerHitBudget.n >= FOLLOW.hitFxPerFrame) return; this.followerHitBudget.n++;
    if (source === 'arrow') this.artEffects.show(3, enemy.x, enemy.y - 8, 32, time, 120);
    this.feedback.hit(enemy.x, enemy.y, Math.atan2(enemy.y - fromY, enemy.x - fromX), time, source);
  }
  /** 随行带的天赋被动（敌人倒戈 / 易伤由场景统一驱动）；每场重建。 */
  followerPassives: CharacterPassives[] = [];
  /** 随行招牌 / 被动特效（hero_fx）每帧限额 FOLLOW.heroFxPerFrame。 */
  private followerHeroFx = { at: -1, n: 0 };
  followerFxBudget(): boolean { if (this.followerHeroFx.at !== this.combatNow) { this.followerHeroFx.at = this.combatNow; this.followerHeroFx.n = 0; } return this.followerHeroFx.n++ < FOLLOW.heroFxPerFrame; }
  /** 随行出手当帧新建的特效放进这个半透明图层，和主将的攻击区分开（FOLLOW.fxAlpha）。 */
  private followerFxLayer?: Phaser.GameObjects.Layer;
  /**
   * 可玩名将随行用本命武器（用户 2026-11-16「随行武将要用他们自己的攻击」）：复用 WEAPON_BEHAVIORS，以随行为发射源。
   * 替身主将：位置 / 朝向 / 生死 / 血量都指向随行；被动用停掉的 CharacterPassives（不蓄层、不出招牌技），成长用全新 RunGrowth（无技艺、无拾取）；
   * 伤害按随行自己的等级、属性、兵装与随行倍率结算，命中记为友军且不算武器命中（不触发主将被动、遗物、构筑、暴击与吸血）。
   */
  createFollowerWeapon(f: Follower, squad: FollowerSquad): ((dt: number, now: number) => void) | null {
    const followerSfx = this.sfx.scaled(.45); // 随行名将用本命武器：同音色、约一半响度，节流与主将分开
    const hero = f.recruit.hero; if (!hero) return null;
    const id = getCharacter(hero).startWeapon, behave = WEAPON_BEHAVIORS[id]; if (!behave) return null;
    // 随行带自己的天赋被动（统筹按用户授权决定，2026-11-17）：被动给的数值加成按 FOLLOW.passiveScale 折算（待平衡会话复核）
    const scene = this, passive = new CharacterPassives(hero, this.combatNow), h = FOLLOW.passiveScale;
    { const cast = passive.beginCast.bind(passive), range = passive.rangeMultiplier.bind(passive);
      passive.beginCast = w => { const c = cast(w); c.damageMul = 1 + (c.damageMul - 1) * h; if (c.empowered && c.radiusMul !== passive.rangeMultiplier(w)) c.radiusMul = (1 + (c.radiusMul - 1) * h) * passive.areaMul; /* 招牌技改写的范围才折算（叠层范围已在 rangeMultiplier 里折过） */ c.spearLengthMul = 1 + (c.spearLengthMul - 1) * h; c.heal *= h; c.rally *= h; return c; };
      passive.rangeMultiplier = w => { const a = passive.areaMul; passive.areaMul = 1; const v = range(w); passive.areaMul = a; return (1 + (v - 1) * h) * a; }; }
    f.passive = passive; this.followerPassives.push(passive);
    const stats: PlayerStats = { damageMul: f.weaponDamageMul, cooldownMul: f.weaponCooldownMul, moveMul: 1, critChance: 0, regen: 0, pickupRadius: 0, armor: 0, maxHpBonus: 0, meleeMul: 1, arrowMul: 1, fireMul: 1, fireAreaMul: FOLLOW.heroAreaMul, damageTakenMul: 1 };
    const puppet = {
      get x() { return f.x; }, get y() { return f.y; }, get sprite() { return f.sprite; }, stats, growth: new RunGrowth(hero), passive,
      get alive() { return !f.resting; }, get hp() { return f.hp; }, get maxHp() { return f.maxHp; }, heal(n: number) { f.hp = Math.min(f.maxHp, f.hp + Math.max(0, n)); },
      get direction() { return f.dir; }, get heading() { const a = squad.facing; return { x: Math.cos(a), y: Math.sin(a) }; },
      nextSkillAction: 0, knockedUntil: 0, relics: [] as string[], weapons: [] as WeaponState[],
      // 名将随行的出手 / 招牌动作：由随行自己播 HERO_ACTIONS 的动作帧（同主将的 faceDirection → 攻击动作）
      faceDirection(dir: 'down' | 'up' | 'left' | 'right') { f.dir = dir; f.faceUntil = scene.combatNow + 220; f.play('attack', dir, scene.combatNow); },
      playAction(kind: string, dir: 'down' | 'up' | 'left' | 'right' = f.dir) { return kind === 'attack' || kind === 'skill' ? f.play(kind, dir, scene.combatNow) : false; },
      knockUp(_now: number, _ms: number, dx: number, dy: number) { f.lx += dx * .25; f.ly += dy * .25; },
    } as unknown as Player;
    const state: WeaponState = { id, level: f.weaponLevel, cooldownLeft: .4 + Math.random() * .4 };
    const shots: SpearShot[] = [], ally = { hero, credit: (n: number) => squad.credit(f, n) };
    const host: WeaponHost = {
      get player() { return puppet; }, get enemies() { return scene.enemies; }, get grid() { return scene.grid; }, get add() { return scene.add; }, get time() { return scene.time; },
      get combatNow() { return scene.combatNow; }, get cameras() { return scene.cameras; }, get sfx() { return followerSfx; }, get over() { return scene.over; },
      get spearShots() { return shots; }, get bolts() { return scene.bolts; },
      hitEnemy: (e, d, now, src) => { const n = d * squad.share, live = e.active && !e.invulnerable; const ok = scene.hitEnemy(e, n, now, src, true, false); if (live) { squad.credit(f, n); scene.followerHitFx(e, f.x, f.y, now, src); passive.onWeaponHit(now); if (!e.active) passive.onKill(e.kind, now); } return ok; },
      // 刘备仁德鼓舞：以随行自己为中心、半径 FOLLOW.rallyRadius（主将版是全军）；部曲与其他随行都算
      rallyAllies: (fraction: number) => { const r = FOLLOW.rallyRadius; for (const u of scene.allies) if (u.active && Math.hypot(u.x - f.x, u.y - f.y) <= r) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * fraction); for (const m of squad.members) if (!m.downed && Math.hypot(m.x - f.x, m.y - f.y) <= r) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * fraction); },
      nearestEnemy: (x, y, r) => scene.nearestEnemy(x, y, r),
      fireBolt: (pool, x, y, tx, ty, damage, bounce, fromPlayer, speed) => { scene.boltAlly = ally; try { scene.fireBolt(pool, x, y, tx, ty, damage * squad.share, bounce, fromPlayer, speed); } finally { scene.boltAlly = undefined; } },
      spawnGuandaoSlash: (angle, alpha, size, duration) => scene.spawnGuandaoSlashAt(f.x, f.y, hero, angle, alpha * FOLLOW.fxAlpha, size, duration, FOLLOW.fxAlpha),
      spawnFlagSwingFx: (dx, dy) => scene.spawnFlagSwingFxAt(f.x, f.y, dx, dy),
      spawnFlameGatherFx: (...args) => scene.spawnFlameGatherFx(...args),
      spawnFlameFx: (...args) => scene.spawnFlameFx(...args),
      heroFx: (fid: string, x: number, y: number, size: number, rotation = 0) => { if (scene.followerFxBudget()) scene.playHeroFx(fid, x, y, size * FOLLOW.heroAreaMul, rotation); },
      // 场地火（诸葛亮烧地、庞统火环）：每名随行自己一套，伤害记到随行名下；数量由 MartialFields 自身上限约束
      martialField: (...args) => fields.add(...args),
    };
    const fields = new MartialFields(host);
    if (!this.followerFxLayer || !this.followerFxLayer.scene) { this.followerFxLayer = this.add.layer().setDepth(DEPTH.fx - 1).setAlpha(FOLLOW.fxAlpha).setName('follower-fx'); this.events.once('shutdown', () => { this.followerFxLayer = undefined; }); }
    const layer = this.followerFxLayer;
    return (dt, now) => {
      if (!this.over) fields.update(dt);
      if (f.resting || this.over) return;
      // 被动的每帧结算（诸葛亮灼烧等），伤害记到随行名下
      if (this.mode === 'none') passive.update(now, (e, amount) => host.hitEnemy(e, amount, now, 'fire'));
      const list = this.children.list, before = list.length;
      behave(host, state, dt, now);
      // 当帧新建的特效挪进半透明图层（共用的箭矢对象池除外）
      for (let i = list.length - 1; i >= before; i--) { const o = list[i]; if ((o as unknown) === layer || this.bolts.some(b => b.img === o)) continue; layer.add(o); }
    };
  }

  protected updateWeapons(dt: number, time: number): void {
    const weapons = this.player.weapons;
    // 旧环绕枪视觉已废弃：七探盘龙枪不再有环绕 blade
    for (const blade of this.blades) blade.setVisible(false);
    for (const weapon of weapons) {
      WEAPON_BEHAVIORS[weapon.id]?.(this.weaponHost, weapon, dt, time);
    }
  }

  /** 主属性专精的命中效果，返回伤害倍率。同一敌人「千钧」推开至少隔 shoveCdMs。 */
  private perkShoveAt = new WeakMap<Enemy, number>();
  protected primaryPerkHit(enemy: Enemy, time: number, weaponHit: boolean, crit: boolean): number {
    const g = this.player.growth, P = PRIMARY_PERK; let mul = 1;
    if (!weaponHit || SPELL_WEAPONS.has(this.player.weapons[0]?.id ?? '')) mul *= g.spellEcho(); // 智力·连珠
    if (!weaponHit) return mul;
    if (crit && g.perk('agility', 3)) g.hasteUntil = time + P.agility.hasteMs; // 敏捷·疾影
    const pushable = enemy.kind !== 'boss' && !enemy.controlImmune && !enemy.isSupplySlot;
    if (g.perk('strength', 2) && ++g.crushCount >= P.strength.crushEvery) { // 力量·破阵
      g.crushCount = 0; mul *= P.strength.crushMul;
      if (pushable) enemy.stunUntil = Math.max(enemy.stunUntil, time + P.strength.crushStunMs);
    }
    if (g.perk('strength', 1) && pushable && time - (this.perkShoveAt.get(enemy) ?? -1e9) >= P.strength.shoveCdMs) { // 力量·千钧
      this.perkShoveAt.set(enemy, time);
      const dx = enemy.x - this.player.x, dy = enemy.y - this.player.y, d = Math.hypot(dx, dy) || 1, k = enemy.kind === 'elite' ? .4 : 1;
      enemy.sprite.x += dx / d * P.strength.shove * k; enemy.sprite.y += dy / d * P.strength.shove * k;
    }
    return mul;
  }

  protected hitEnemy(enemy: Enemy, rawDamage: number, time: number, source: 'melee' | 'arrow' | 'fire' = 'melee', fromAlly = false, weaponHit = true): boolean {
    if (!enemy.active || this.over || enemy.invulnerable) return false;
    if(enemy.isSupplySlot){enemy.hp-=Math.max(1,Math.round(rawDamage));enemy.flash(time);this.sfx.play('hitHeavy');if(enemy.hp<=0)this.killEnemy(enemy);return false;}
    if (enemy === this.boss) this.ensureBossPhase2();
    if (this.xiliang) rawDamage *= this.xiliang.incoming(enemy, source);
    if (enemy === this.boss && this.moveset) { rawDamage *= this.moveset.incoming(fromAlly); this.moveset.hit(time); }
    if (this.dzLubu && enemy === this.dzLubu.lubu) rawDamage = this.dzLubu.clampDamage(enemy, rawDamage); // 2-3 吕布锁在 1/3 血
    if(this.yellow&&enemy.kind==='shield'&&enemy.shieldMax===0&&enemy.def.behavior!=='wall'&&!fromAlly&&source!=='fire'){const angle=enemy.direction==='left'?Math.PI:enemy.direction==='right'?0:enemy.direction==='up'?-Math.PI/2:Math.PI/2;if(Math.cos(Math.atan2(this.player.y-enemy.y,this.player.x-enemy.x)-angle)>.25)rawDamage*=.65;}
    if (source === 'arrow') this.sfx.play('hitArrow');
    else if (source === 'fire') this.sfx.play('hitFire');
    else this.sfx.play('hitLight');
    if (enemy.kind === 'boss' && !fromAlly) this.sfx.play('bossHit'); // 首领专属沉重受击声（节流，不会每下都响）
    const bossHpBefore = enemy.kind === 'boss' ? enemy.hp / enemy.maxHp : 1;
    if (enemy === this.boss && this.lubu) rawDamage *= this.lubu.incomingDamageMultiplier(source, time);
    if (enemy === this.boss && this.zhangjiao) rawDamage *= this.zhangjiao.takenMul;
    { let v = this.player.passive.vulnerability(enemy, time); for (const fp of this.followerPassives) v = Math.max(v, 1 + (fp.vulnerability(enemy, time) - 1) * FOLLOW.passiveScale); rawDamage *= v; } // 貂蝉倾城：易伤（部曲伤害同样吃加成；随行貂蝉的按随行系数折算）
    const firstStrike = !fromAlly && weaponHit && !!this.relics?.firstStrike(enemy);
    const crit = this.debugCrit !== null && !fromAlly ? this.debugCrit : firstStrike || weaponHit && Math.random() < Math.min(0.65, this.player.stats.critChance + this.player.growth.criticalBonus() + (!fromAlly ? this.player.passive.critBonus(time) + this.player.growth.aimCriticalBonus() + this.buildCombat.criticalBonus() : 0));
    if(!fromAlly&&weaponHit)rawDamage=this.buildCombat.damage(enemy,rawDamage,crit,time);
    if(!fromAlly)rawDamage*=this.player.growth.gearHitMultiplier(enemy.kind);
    // 智力：非武器伤害（技艺、灼烧等）按法术系数 × 智力、含主属性；法术武器（火旗 / 火雷 / 连弩 / 团扇）的武器命中再乘法术系数
    if(!fromAlly&&!weaponHit)rawDamage*=this.player.growth.skillDamageMultiplier();else if(!fromAlly)rawDamage*=this.player.growth.spellWeaponMultiplier(this.player.weapons[0]?.id);
    if(!fromAlly)rawDamage*=this.primaryPerkHit(enemy,time,weaponHit,crit); // 主属性专精（千钧 / 破阵 / 疾影 / 连珠）
    let damage = Math.max(1, Math.round(rawDamage * (crit ? BALANCE.critMultiplier : 1) * (firstStrike ? RELIC.zhanjiangMul : 1)));
    enemy.flash(time);
    if(!fromAlly&&source==='arrow')this.artEffects.show(3,enemy.x,enemy.y-8,32,time,120);
    if (!fromAlly) {
      // 打击感：按攻击类型的手绘火花、受击后仰 + 轻推、暴击顿帧 + 暴击音、同帧多目标算技能 / 大招（帧末结算）
      const ang = Math.atan2(enemy.y-this.player.y,enemy.x-this.player.x), boss = enemy.kind === 'boss';
      const type = source === 'arrow' ? 'arrow' : source === 'fire' ? 'spell' : WEAPON_HIT_TYPE[this.player.weapons[0]?.id ?? ''] ?? 'slash';
      this.feedback.hit(enemy.x, enemy.y, ang, time, source, { type, crit, boss });
      enemy.hitRecoil(time, ang, crit ? HIT_FEEL.critKnockbackPx : HIT_FEEL.knockbackPx, HIT_FEEL.recoilMs);
      if (crit) { this.sfx.play('hitCrit'); if (this.hitFeel.critStop()) this.hitFeel.shake('small'); }
      if (weaponHit) this.hitFeel.noteHit();
    }
    if (!fromAlly && weaponHit) this.player.passive.onWeaponHit(time);
    const credit = (n: number): void => { if (fromAlly) this.allyDamageDealt += n; else this.playerDamageDealt += n; };
    // Boss 护盾优先吸收伤害
    if (enemy === this.boss && this.bossShield > 0) {
      const absorbed = Math.min(this.bossShield, damage);
      this.bossShield -= absorbed;
      damage -= absorbed;
      this.damageDealt += absorbed;
      credit(absorbed);
      if (damage <= 0) {
        this.spawnDamageText(enemy.x, enemy.y - enemy.radius, absorbed, crit, !fromAlly||enemy.kind==='boss');
        return true;
      }
    }
    // 盾牌兵：伤害先打盾，盾没破时本体只吃一成；盾碎后丢盾换成步兵造型
    if (enemy.shieldHp > 0) {
      const shown = damage, r = absorbShield(enemy, damage, source);
      if (r.broke) this.breakShield(enemy);
      this.spawnDamageText(enemy.x, enemy.y - enemy.radius, shown, crit, !fromAlly);
      if (r.body <= 0) return true;
      damage = r.body; enemy.hp -= damage; this.damageDealt += damage; credit(damage);
      if (enemy.hp <= 0) this.killEnemy(enemy);
      return true;
    }
    enemy.hp -= damage;
    this.damageDealt += damage;
    credit(damage);
    if (enemy.kind === 'boss') this.bossFeelHit(enemy, damage, crit, bossHpBefore, time);
    this.spawnDamageText(enemy.x, enemy.y - enemy.radius, damage, crit, !fromAlly||enemy.kind==='boss', enemy.kind==='boss' ? 'boss' : fromAlly ? 'ally' : (!weaponHit || source === 'fire') ? 'spell' : 'hit');
    if (!fromAlly && weaponHit && this.player.growth.build.treasures.includes('blood_jade')) this.bloodJadeHeal(damage, time);
    if (!fromAlly && weaponHit) this.relics?.onWeaponHit(enemy, rawDamage, time);
    if(!fromAlly&&weaponHit){const tags=this.player.growth.build.tags();const vfx=buildVfx(this);const a=Math.atan2(enemy.y-this.player.y,enemy.x-this.player.x);if(tags.combo)vfx.emit('combo',enemy.x,enemy.y-8,time,42,a);if(crit&&tags.critical)vfx.emit('critical',enemy.x,enemy.y-8,time,48);if(tags.charge&&this.buildCombat.charged())vfx.emit('pure_charge',enemy.x,enemy.y-8,time,70,a);this.legion.command.onHit(enemy,time);this.controlBuild?.onHit(enemy,time);this.awakeningCombat?.onHit(enemy,rawDamage,crit,time,this.buildCombat.charged());this.buildCombat.onHit(enemy,rawDamage,crit,time);this.relicHits++;
      const lg=this.player.growth.charmLegend,seal=lg.human_seal;if(seal!==undefined&&this.relicHits%CHARM_LEGEND.charm_human_seal.every[seal]===0){if(this.relicWaves.length>=4)this.relicWaves.shift();this.relicWaves.push({x:enemy.x,y:enemy.y,at:time});for(const e of this.grid.query(enemy.x,enemy.y,110).filter(e=>e.active&&!e.isSupplySlot&&Math.hypot(e.x-enemy.x,e.y-enemy.y)<=110).slice(0,CHARM_LEGEND.charm_human_seal.targets[seal]))this.hitEnemy(e,rawDamage*.35,time,'melee',false,false);}
      if(lg.heaven_ember!==undefined&&time>=this.relicFireAt){this.relicFireAt=time+CHARM_LEGEND.charm_heaven_ember.cd[lg.heaven_ember];this.martialFields.add(enemy.x,enemy.y,65,rawDamage,1500,1);this.spawnFlameFx(enemy.x,enemy.y,65);}
    }
    if(enemy===this.boss){this.huaxiong?.hit(time);this.xurong?.hit(time);}else{const old=this.chasingBosses.find(t=>t.enemy===enemy&&t.life===enemy.spawnId);old?.huaxiong?.hit(time);old?.xurong?.hit(time);}
    if (enemy.hp <= 0) this.killEnemy(enemy);
    else if (enemy === this.boss) this.ensureBossPhase2();
    return true;
  }

  /** 首领受击的打击感：白色残血条保持、破势值累积（满了硬直后退 +「破势！」）、半血转阶段顿帧 + 慢动作。 */
  protected bossFeelHit(boss: Enemy, damage: number, crit: boolean, hpBefore: number, time: number): void {
    const st = this.bossStagger, after = boss.hp / boss.maxHp;
    st.track(boss.spawnId, hpBefore); st.hold(performance.now());
    if (hpBefore > .5 && after <= .5 && boss.hp > 0) this.hitFeel.bossPhase();
    if (boss.hp > 0 && st.hit(damage, boss.maxHp, crit)) this.bossBreak(boss, time);
  }
  /** 破势：硬直 BOSS_FEEL.breakMs、朝远离主将方向后退、盔甲抖动、「破势！」字样、短顿帧 + 中震。 */
  protected bossBreak(boss: Enemy, time: number): void {
    const a = Math.atan2(boss.y - this.player.y, boss.x - this.player.x), sp = boss.sprite;
    if (!boss.controlImmune) boss.stunUntil = Math.max(boss.stunUntil, time + BOSS_FEEL.breakMs);
    this.tweens.add({ targets: sp, x: sp.x + Math.cos(a) * BOSS_FEEL.pushPx, y: sp.y + Math.sin(a) * BOSS_FEEL.pushPx, duration: 220, ease: 'Quad.Out' });
    const r0 = sp.rotation; this.tweens.add({ targets: sp, rotation: { from: r0 - .06, to: r0 + .06 }, duration: 55, yoyo: true, repeat: 3, onComplete: () => { if (sp.active) sp.setRotation(r0); } });
    const t = this.add.text(boss.x, boss.y - boss.radius - 46, '破势！', { fontFamily: FONT, fontSize: '30px', color: '#ffe2a0', stroke: '#6a1408', strokeThickness: 6 }).setOrigin(.5).setDepth(DEPTH.dmgText + 1).setScale(1.6).setName('boss-break-text');
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, delay: 650, duration: 380, onComplete: () => t.destroy() });
    this.hitFeel.hitStop(BOSS_FEEL.breakStopMs, true); this.hitFeel.shake('medium'); this.sfx.play('bossBreak');
    this.feedback.hit(boss.x, boss.y, a, time, 'melee', { boss: true, crit: true });
  }

  protected killEnemy(enemy: Enemy): void {
    if (this.dzLubu?.preventKill(enemy)) return; // 2-3 吕布打到底不死：锁血逃走
    if (!enemy.active) return;
    this.objective?.onKill(enemy);
    const kind = enemy.kind;
    // 吕布倒地改由 playBossFall（倒地 4 帧）播，不再叠旧的通用死亡闪影
    if(kind==='boss'){const old=this.chasingBosses.find(t=>t.enemy===enemy&&t.life===enemy.spawnId),h=old?old.huaxiong:this.huaxiong,x=old?old.xurong:this.xurong;h?.defeat();x?.defeat();if(enemy===this.boss){this.sishuiPass?.onBossDown();{const at={x:enemy.x,y:enemy.y,displayHeight:enemy.sprite.displayHeight};this.storyBossFell=!!this.storyDir?.bossFall(at);if(this.sishuiPass?.wenjiu){setStoryFlag('wenjiu_huaxiong');this.time.delayedCall(1600,()=>this.storyDir?.line('hulao-1.wenjiu',this.player.sprite));}}this.moveset?.defeat();this.moveset=null;this.bossMount?.destroy();this.bossMount=null;}if(old){if(h)this.deadBossControllers.push(h);if(x)this.deadBossControllers.push(x);}
      // 倒地：控制器自己有倒地帧的（华雄 / 徐荣 / 子类首领）沿用；其余首领播通用倒地（受伤帧 + 倒下 + 手绘扬尘 + 下沉淡出）
      this.bossFallDir=0;if(!(h||x||this.bossHasDeathArt()))this.bossFallDir=playBossFall(this,enemy,this.zhangjiao?'zhangjiao_moves':this.lubu?'lubu_moves':undefined,old?undefined:this.chapter.bossStyle);}
    enemy.deactivate();
    if(enemy.isSupplySlot){this.sfx.play('propBreak');this.supplies?.onBroken(enemy);return;}
    this.warfeedKill();
    if(enemy.def.behavior==='wall')return;
    this.kills += 1;
    this.player.passive.onKill(kind, this.combatNow);
    this.awakeningCombat?.onKill(enemy,this.combatNow);
    this.buildCombat.onKill(enemy,this.combatNow);
    this.controlBuild?.onKill(enemy,this.combatNow);
    this.legion.onKill(enemy);
    this.itemDrops?.onKill(enemy);
    if(enemy.kind==='boss')this.runMerit.boss++;else if(enemy.kind==='elite')this.runMerit.elite++; // 战功：精英 / 首领
    this.relics?.onKill();
    if(this.player.growth.gear.specials.includes('bloodthirst')&&this.combatNow>=this.player.growth.killHealAt){this.player.growth.killHealAt=this.combatNow+500;this.player.heal(this.player.maxHp*.01);}
    const jade=this.player.growth.charmLegend.army_jade;if(jade!==undefined&&this.combatNow>=this.relicHealAt){const k=CHARM_LEGEND.charm_army_jade.heal[jade];this.relicHealAt=this.combatNow+1000;this.player.heal(k);this.artEffects.show(5,this.player.x,this.player.y-12,35,this.combatNow,260);for(const u of this.allies.filter(u=>u.active&&u.hp<u.maxHp).slice(0,2)){u.hp=Math.min(u.maxHp,u.hp+2*k);this.artEffects.show(5,u.x,u.y-10,30,this.combatNow,260);}}
    this.sfx.play('enemyDie'); this.sfx.play('killThud'); // 击杀加一层闷响（节流）
    if (kind === 'elite') { this.hitFeel.hitStop(HIT_FEEL.eliteKillStopMs); this.hitFeel.shake('small'); }
    if (kind === 'boss') { this.hitFeel.bossDeath(); this.sfx.play('bossHit'); } // 击杀首领：0.5 秒慢动作 + 强震，之后照常倒地 / 宝箱
    if (kind === 'boss') {
      const index=this.chasingBosses.findIndex(t=>t.enemy===enemy&&t.life===enemy.spawnId);
      if(index>=0){
        unlockAchievement('chaser');
        const old=this.chasingBosses[index];old.battle?.clear();old.huaxiong?.clear();old.xurong?.clear();old.label.destroy();this.chasingBosses.splice(index,1);
        this.recordFrontlineVictory(old.stage);
      }else{this.bossKilled=true;this.boss=null;this.recordFrontlineVictory(this.battleStage());this.lordBossBark('bossDown',this.storyBossFell);this.storyBossFell=false;}
      // 倒地后原地掉宝箱，主将捡起遗物才进下一阶段（原来的三选一遗物卡改成宝箱）
      this.spawnBossChest(enemy.x,enemy.y,()=>{if(this.bossKilled&&this.chasingBosses.length===0){if(this.storyDir)this.storyDir.chapterClose(()=>this.finish(true,'boss'));else this.finish(true,'boss');}else{this.resumePendingChoices();if(this.bossKilled)this.showGrowthNotice('当前首领已败 · 仍有'+this.chasingBosses.length+'名追击首领');}});return;
    }
    this.spawnGem(enemy.x, enemy.y, enemy.def.xp);
  }

  protected nearestEnemy(x: number, y: number, range: number, exclude: Enemy | null = null, ignored?: Set<number>): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = range * range;
    for (const enemy of this.enemies) {
      if (!enemy.active || enemy === exclude || (ignored && ignored.has(enemy.spawnId))) continue;
      const dx = enemy.x - x, dy = enemy.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = enemy;
      }
    }
    return best;
  }

  protected fireBolt(
    pool: Bolt[],
    x: number,
    y: number,
    tx: number,
    ty: number,
    damage: number,
    bounce: number,
    fromPlayer: boolean,
    speed: number,
    textureKey?: string,
  ): void {
    let bolt = pool.find((b) => !b.active);
    if (!bolt) {
      if (pool.length >= 90) return;
      bolt = {
        img: this.add.image(x, y, fromPlayer ? 'bolt' : 'arrow').setDepth(DEPTH.projectile),
        vx: 0,
        vy: 0,
        life: 0,
        damage: 0,
        bounce: 0,
        active: false,
        lastHit: null,
        hitIds: new Set(),
      };
      pool.push(bolt);
    }
    const dx = tx - x;
    const dy = ty - y;
    const dist = Math.hypot(dx, dy) || 1;
    bolt.active = true;
    bolt.vx = (dx / dist) * speed;
    bolt.vy = (dy / dist) * speed;
    bolt.damage = damage;
    bolt.bounce = bounce;
    bolt.life = 2.6;
    bolt.lastHit = null;
    bolt.hitIds = new Set();
    bolt.ally = this.boltAlly;
    if (fromPlayer && !bolt.ally) this.sfx.attack();
    bolt.img
      .setTexture(textureKey ?? (fromPlayer ? 'bolt' : 'arrow'))
      .setPosition(x, y)
      .setVisible(true)
      .setRotation(Math.atan2(dy, dx));
    if (fromPlayer) bolt.img.setScale(1);
    else if (textureKey === 'orb') bolt.img.setDisplaySize(22, 22);
    else if (textureKey?.startsWith('bossfx_')) bolt.img.setDisplaySize(46, 46);
    else bolt.img.setDisplaySize(30, 7);
    { const tint = fromPlayer ? HERO_TINT[(bolt.ally?.hero ?? this.runConfig.character) as keyof typeof HERO_TINT] : undefined; if (tint) bolt.img.setTint(tint); else bolt.img.clearTint(); }
    bolt.img.setAlpha(bolt.ally ? FOLLOW.fxAlpha : 1);
    if (bolt.ally) bolt.img.setScale(bolt.img.scaleX * FOLLOW.heroAreaMul, bolt.img.scaleY * FOLLOW.heroAreaMul);
  }
  /** 正在替随行发箭时设置（fireBolt 读取后挂到箭上）。 */
  private boltAlly?: { hero: string; credit: (damage: number) => void };

  protected updateBolts(dt: number, time: number): void {
    for (const bolt of this.bolts) {
      if (!bolt.active) continue;
      bolt.img.x += bolt.vx * dt;
      bolt.img.y += bolt.vy * dt;
      bolt.life -= dt;
      if (bolt.life <= 0) {
        bolt.active = false;
        bolt.img.setVisible(false);
        continue;
      }
      const candidates = this.grid.query(bolt.img.x, bolt.img.y, 28);
      let target: Enemy | null = null;
      for (const enemy of candidates) {
        if (!enemy.active || bolt.hitIds.has(enemy.spawnId)) continue;
        if (Math.hypot(enemy.x - bolt.img.x, enemy.y - bolt.img.y) <= enemy.radius + 12) {
          target = enemy;
          break;
        }
      }
      if (target) {
        if (bolt.ally) { const live = target.active; this.hitEnemy(target, bolt.damage, time, 'arrow', true, false); if (live) { bolt.ally.credit(bolt.damage); this.followerHitFx(target, target.x - bolt.vx, target.y - bolt.vy, time, 'arrow'); } }
        else this.hitEnemy(target, bolt.damage, time, 'arrow');
        bolt.hitIds.add(target.spawnId);
        if (bolt.bounce > 0) {
          const next = this.nearestEnemy(target.x, target.y, 260, null, bolt.hitIds);
          if (next) {
            bolt.bounce -= 1;
            const dx = next.x - target.x;
            const dy = next.y - target.y;
            const d = Math.hypot(dx, dy) || 1;
            bolt.img.setPosition(target.x, target.y);
            bolt.vx = (dx / d) * 560;
            bolt.vy = (dy / d) * 560;
            bolt.life = 1.6;
            continue;
          }
        }
        if (bolt.hitIds.size > 1) this.debugChains.push([...bolt.hitIds]);
        if (this.debugChains.length > 30) this.debugChains.shift();
        bolt.active = false;
        bolt.img.setVisible(false);
      }
    }
  }

  protected updateBullets(dt: number): void {
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;
      bullet.img.x += bullet.vx * dt;
      bullet.img.y += bullet.vy * dt;
      bullet.life -= dt;
      const soldier = this.legion.grid.query(bullet.img.x, bullet.img.y, 26, this.legionBulletScratch).find(u => u.active && Math.hypot(u.x - bullet.img.x, u.y - bullet.img.y) < u.radius + 8);
      if (soldier) { this.legion.hurt(soldier, bullet.damage, this.combatNow, { x: bullet.img.x - bullet.vx * .1, y: bullet.img.y - bullet.vy * .1, normal: bullet.img.texture.key.startsWith('arrow')||bullet.img.texture.key === 'yellow_arrow' }); bullet.active = false; bullet.img.setVisible(false); continue; }
      if (Math.hypot(this.player.x - bullet.img.x, this.player.y - bullet.img.y) < this.player.radius + 8) {
        bullet.active = false;
        bullet.img.setVisible(false);
        const spark = this.add.image(bullet.img.x, bullet.img.y, 'spark').setDepth(DEPTH.fx).setScale(2.2);
        this.tweens.add({ targets: spark, alpha: 0, scale: 0.6, duration: 180, onComplete: () => spark.destroy() });
        if (this.player.takeDamage(bullet.damage, this.combatNow)) this.cameras.main.flash(90, 180, 40, 40, false);
        continue;
      }
      if (bullet.life <= 0) {
        bullet.active = false;
        bullet.img.setVisible(false);
      }
    }
  }

  /**
   * 伤害 / 治疗数字（池化 40 个，同屏多时普通部曲数字先丢、暴击和主将优先）：
   * 同一位置同类的数字合并累加；向上飘出一道小弧线后淡出；暴击先放大再落定（字号更大，不带「暴」字）。
   * kind 缺省按 crit / priority 推：暴击 → crit，主将 → hit，部曲随行 → ally。设置「伤害数字」全部 / 仅暴击 / 关。
   */
  protected spawnDamageText(x: number, y: number, value: number, crit: boolean, priority=true, kind?: DmgKind): void {
    { const dm = damageNumbers(); if (dm === 'off' || (dm === 'crit' && !crit)) return; } // 设置「伤害数字」
    const k: DmgKind = crit ? 'crit' : kind ?? (priority ? 'hit' : 'ally');
    const crowded=this.legion.visibleCount>=60,limit=crowded?18:32;
    const merged=this.dmgFx.find(f=>f.active&&f.kind===k&&f.life>.25&&Math.hypot(f.text.x-x,f.text.y-y)<(crowded?44:26));
    if(merged){const n=Number(merged.text.text.replace('+',''))+value;merged.text.setText(k==='heal'?'+'+n:String(n));if(k==='crit')merged.life=Math.max(merged.life,DMG_LIFE-.08);return;}
    const active=this.dmgFx.filter(f=>f.active);if(!crit&&!priority&&active.length>=limit)return;
    let fx = this.dmgFx.find((f) => !f.active);
    if(!fx&&(crit||priority)&&this.dmgFx.length>=40)fx=this.dmgFx.filter(f=>!f.crit).sort((a,b)=>a.life-b.life)[0];
    if (!fx) {
      if (this.dmgFx.length >= 40) return;
      fx = { crit, kind: k, text: this.add.text(0, 0, '', { fontFamily: DMG_FONT, fontStyle: 'bold', fontSize: '15px' }).setOrigin(0.5).setDepth(DEPTH.dmgText).setShadow(1, 2, '#000000', 2, true, true), life: 0, vx: 0, vy: 0, active: false };
      fx.kind = '' as DmgKind; // 强制下面套用样式
      this.dmgFx.push(fx);
    }
    if (fx.kind !== k) { const st = DMG_STYLE[k]; fx.kind = k; fx.text.setStyle({ fontSize: st.size + 'px', color: st.color, stroke: st.stroke, strokeThickness: st.sw }); }
    fx.crit = crit;
    fx.tag?.setVisible(false); // 2026-11-18 用户：暴击不再显示「暴」字，只靠更大的金色数字区分
    fx.active = true;
    fx.life = DMG_LIFE;
    fx.vx = (Math.random() - .5) * (crit ? 30 : 40);
    fx.vy = crit ? -78 : k === 'heal' ? -48 : -66;
    fx.text.setPosition(x, y).setText(k === 'heal' ? '+' + value : String(value)).setAlpha(1).setVisible(true).setScale(crit ? 1.45 : 1);
  }

  protected updateDmgFx(dt: number): void {
    for (const fx of this.dmgFx) {
      if (!fx.active) continue;
      fx.life -= dt;
      fx.vy += 120 * dt; // 上飘逐渐减速，走一道小弧线
      fx.text.x += fx.vx * dt; fx.text.y += fx.vy * dt;
      const t = Math.max(0, fx.life / DMG_LIFE);
      fx.text.setAlpha(Math.min(1, t * 2.2)); // 前半段不透明，后半段淡出
      if (fx.crit && fx.life > DMG_LIFE - .16) fx.text.setScale(1 + .45 * (fx.life - (DMG_LIFE - .16)) / .16); // 暴击数字先放大再落定（前 0.16 秒）
      if (fx.tag?.visible) fx.tag.setPosition(fx.text.x - fx.text.displayWidth / 2 - 2, fx.text.y).setAlpha(fx.text.alpha);
      if (fx.life <= 0) {
        fx.active = false;
        fx.text.setVisible(false); fx.tag?.setVisible(false);
      }
    }
  }

  /** 军功信物是否用手绘图（缺图时退回程序光团兜底）。 */
  private gemArt(): boolean { return this.textures.exists('gem_tok_small') && this.textures.exists('gem_tok_large'); }
  /**
   * 敌人倒下掉军功信物：从身上弹出，走一道小抛物线落地再轻弹一下（GEM_FX.dropMs + bounceMs，0.3 秒内）。
   * 对象池（GEM_FX.cap 个槽，信物 / 光晕 / 残影同槽复用）；手机布局或同屏过多时降级。
   */
  protected spawnGem(x: number, y: number, value: number): void {
    let lx = x + (Math.random() - .5) * 2 * GEM_FX.spread, ly = y + (Math.random() - .5) * GEM_FX.spread * .7;
    if (this.terrain) { const f = this.terrain.free(lx, ly, 8); lx = f.x; ly = f.y; } // 掉落不落在水里
    let gem = this.gems.find((g) => !g.active);
    if (!gem) {
      if (this.gems.length >= GEM_FX.cap) return;
      gem = { img: this.add.image(x, y, 'gem_small').setDepth(DEPTH.gem).setName('gem'), value: 0, vx: 0, vy: 0, active: false, restMs: 0,
        phase: 'drop', at: 0, sx: 0, sy: 0, lx: 0, ly: 0, speed: 0, lite: false, seed: 0, large: false };
      this.gems.push(gem);
    }
    const art = this.gemArt(), large = value >= GEM_FX.largeValue, live = this.gems.reduce((n, g) => n + (g.active ? 1 : 0), 0);
    Object.assign(gem, { active: true, value, vx: 0, vy: 0, restMs: GEM_FX.dropMs + GEM_FX.bounceMs, phase: 'drop', at: this.combatNow, sx: x, sy: y - GEM_FX.lift, lx, ly, speed: 0,
      lite: !art || !IS_DESKTOP || live > GEM_FX.liteAbove, seed: Math.random() * 10000, large });
    const size = large ? GEM_FX.largeSize : GEM_FX.smallSize;
    if (art) gem.img.setTexture(large ? 'gem_tok_large' : 'gem_tok_small', 0).setDisplaySize(size, size);
    else gem.img.setTexture(large ? 'gem_large' : 'gem_small').setScale(1);
    gem.img.setPosition(gem.sx, gem.sy).setVisible(true).setAlpha(1).setDepth(DEPTH.gem);
    gem.ghost?.setVisible(false);
    if (!gem.lite && this.textures.exists('gem_fx')) {
      gem.glow ??= this.add.image(lx, ly, 'gem_fx', 4).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.gem - .1).setName('gem-glow');
      const gs = large ? GEM_FX.glowLarge : GEM_FX.glowSmall; gem.glow.setFrame(large ? 5 : 4).setDisplaySize(gs, gs).setPosition(lx, ly + 2).setAlpha(0).setVisible(true);
    } else gem.glow?.setVisible(false);
  }

  /** 拾取闪光（手绘 gem_fx 0–3 帧）对象池 */
  private gemSparks: Array<{ img: Phaser.GameObjects.Image; at: number }> = [];
  private gemSpark(x: number, y: number): void {
    if (!this.textures.exists('gem_fx')) return;
    let sp = this.gemSparks.find(s => this.combatNow - s.at >= GEM_FX.sparkMs);
    if (!sp) { if (this.gemSparks.length < GEM_FX.sparkCap) { sp = { img: this.add.image(x, y, 'gem_fx', 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.player + 1).setName('gem-spark'), at: 0 }; this.gemSparks.push(sp); } else sp = this.gemSparks.reduce((o, s) => s.at < o.at ? s : o); }
    sp.at = this.combatNow; sp.img.setPosition(x, y).setFrame(0).setDisplaySize(GEM_FX.sparkSize, GEM_FX.sparkSize).setVisible(true);
  }

  /** “搜集辎重”：此时刻之前全场宝石无视距离飞向主将。 */
  gemMagnetUntil = 0;
  protected updateGems(dt: number): void {
    const radius = this.combatNow < this.gemMagnetUntil ? 1e9 : this.player.stats.pickupRadius * (1 + this.player.growth.gear.pickup), now = this.combatNow, art = this.gemArt();
    for (const sp of this.gemSparks) { const t = (now - sp.at) / GEM_FX.sparkMs; if (t >= 1) { if (sp.img.visible) sp.img.setVisible(false); continue; } sp.img.setFrame(Math.min(3, Math.floor(t * 4))).setPosition(this.player.x, this.player.y - 18); }
    for (const gem of this.gems) {
      if (!gem.active) continue;
      const img = gem.img, px = this.player.x, py = this.player.y - 6;
      if (gem.phase === 'drop') {
        // 抛物线落地 + 轻弹一下
        const t = now - gem.at; gem.restMs = Math.max(0, GEM_FX.dropMs + GEM_FX.bounceMs - t);
        if (t < GEM_FX.dropMs) { const k = t / GEM_FX.dropMs; img.setPosition(gem.sx + (gem.lx - gem.sx) * k, gem.sy + (gem.ly - gem.sy) * k - Math.sin(Math.PI * k) * GEM_FX.arc); }
        else if (t < GEM_FX.dropMs + GEM_FX.bounceMs) { const k = (t - GEM_FX.dropMs) / GEM_FX.bounceMs; img.setPosition(gem.lx, gem.ly - Math.sin(Math.PI * k) * GEM_FX.bounce); }
        else { img.setPosition(gem.lx, gem.ly); gem.phase = 'rest'; gem.at = now; }
        if (gem.glow?.visible) gem.glow.setAlpha(Math.min(1, t / (GEM_FX.dropMs + GEM_FX.bounceMs)) * GEM_FX.glowAlpha[0]);
        continue;
      }
      const dx = px - img.x, dy = py - img.y, dist = Math.hypot(dx, dy) || 1;
      if (gem.phase === 'rest') {
        if (dist < radius) { gem.phase = 'fly'; gem.at = now; gem.speed = GEM_FX.flyStart; gem.glow?.setVisible(false); if (!gem.lite) { gem.ghost ??= this.add.image(img.x, img.y, img.texture.key, 0).setDepth(DEPTH.gem - .05).setName('gem-ghost'); gem.ghost.setTexture(img.texture.key, img.frame.name).setDisplaySize(img.displayWidth, img.displayHeight).setPosition(img.x, img.y).setAlpha(GEM_FX.ghostAlpha).setVisible(true); } }
        else {
          // 落地：上下浮动、光晕呼吸、隔一会儿高光扫过
          const ph = now + gem.seed, bob = Math.sin(ph / GEM_FX.bobMs * Math.PI * 2) * GEM_FX.bobPx;
          img.y = gem.ly - GEM_FX.bobPx + bob;
          if (gem.glow?.visible) { const [a0, a1] = GEM_FX.glowAlpha; gem.glow.setAlpha(a0 + (a1 - a0) * (.5 + .5 * Math.sin(ph / GEM_FX.glowMs * Math.PI * 2))); }
          if (art && !gem.lite) { const st = ph % GEM_FX.shineEvery; img.setFrame(st < GEM_FX.shineMs ? Math.min(3, Math.floor(st / GEM_FX.shineMs * 4)) : 0); }
          continue;
        }
      }
      // 吸取：加速飞向主将，残影落后一点
      if (dist < GEM_FX.arriveDist) {
        gem.active = false; img.setVisible(false); gem.ghost?.setVisible(false); gem.glow?.setVisible(false);
        if (!gem.lite) this.gemSpark(px, py);
        // 拾取军功宝石不再播放音效（用户要求；战场补给拾取仍有音效）
        const gained = this.player.gainXp(this.player.growth.scaleXp(gem.value, this.heroXpRate()), levelCap());
        this.relics?.onGem(this.combatNow);
        if (gained > 0) this.onHeroLevelUp(gained);
        continue;
      }
      gem.speed = Math.min(GEM_FX.flyMax, gem.speed + GEM_FX.flyAccel * dt);
      const step = Math.min(dist, gem.speed * dt); gem.vx = dx / dist * gem.speed; gem.vy = dy / dist * gem.speed;
      if (gem.ghost?.visible) gem.ghost.setPosition(img.x - gem.vx * GEM_FX.ghostLag, img.y - gem.vy * GEM_FX.ghostLag);
      img.x += dx / dist * step; img.y += dy / dist * step;
    }
  }

  spawnGuandaoSlash(angle: number, alphaScale: number, size = 110, duration = 120): void { this.spawnGuandaoSlashAt(this.player.x, this.player.y, this.runConfig.character, angle, alphaScale, size, duration); }
  /** 关刀 / 双股剑 / 镇北刀刀光，画在指定位置（主将或随行）。 */
  spawnGuandaoSlashAt(ox: number, oy: number, character: string, angle: number, alphaScale: number, size = 110, duration = 120, fxScale = 1): void {
    const reachOffset = size * .19;
    this.artEffects.show(1,ox+Math.cos(angle)*reachOffset,oy+Math.sin(angle)*reachOffset,size,this.combatNow,duration,angle);
    // 刘备 / 魏延：普攻用自己的剑气 / 劈地特效，不再借用关羽的青龙刀光
    const own = ({ liubei: 'liubeiSlash', weiyan: 'weiyanSlash' } as Record<string, string>)[character];
    if (own && this.textures.exists('hero_fx_' + HERO_FX[own].sheet)) { if (alphaScale >= .9 * fxScale) this.playHeroFx(own, ox + Math.cos(angle) * reachOffset * 1.6, oy + Math.sin(angle) * reachOffset * 1.6, size * 1.15, own === 'liubeiSlash' ? angle : 0); return; }
    if (!this.textures.exists('guandao_slash_sheet')) return;
    const originX = ox, originY = oy;
    for (let f = 0; f < 3; f += 1) {
      this.time.delayedCall(f * 45, () => {
        if (this.over) return;
        const fx = this.add
          .image(originX + Math.cos(angle) * reachOffset, originY + Math.sin(angle) * reachOffset, 'guandao_slash_sheet', String(f))
          .setDisplaySize(size, size)
          .setRotation(angle)
          .setDepth(41)
          .setAlpha(0.62 * alphaScale);
        { const tint = HERO_TINT[character as keyof typeof HERO_TINT]; if (tint) fx.setTint(tint); }
        this.tweens.add({ targets: fx, alpha: 0, scaleX: fx.scaleX * 1.06, scaleY: fx.scaleY * 1.06, duration, onComplete: () => fx.destroy() });
      });
    }
  }

  /** 新武将招牌技序列帧（黑底、叠加混合）：6 帧约 0.45 秒，末帧淡出。缺图时不显示。 */
  playHeroFx(id: string, x: number, y: number, size: number, rotation = 0): void {
    const def = HERO_FX[id], key = def ? 'hero_fx_' + def.sheet : ''; if (!def || !this.textures.exists(key)) return;
    const tone = HERO_FX_TONE[id];
    const fx = this.add.image(x, y, key, def.row * 6).setDisplaySize(size, size).setRotation(rotation).setBlendMode(Phaser.BlendModes.ADD).setDepth(actorDepth(y) + .6).setAlpha(tone?.alpha ?? 1).setName('hero-fx-' + id);
    this.tweens.addCounter({ from: 0, to: 5.99, duration: tone?.ms ?? 450, onUpdate: t => fx.setFrame(def.row * 6 + Math.floor(t.getValue() ?? 0)), onComplete: () => this.tweens.add({ targets: fx, alpha: 0, duration: 140, onComplete: () => fx.destroy() }) });
  }

  /** 诸葛亮挥旗：正式战旗素材握在旗杆底端，朝目标一侧前挥；缺图时退回程序旗子。 */
  protected spawnFlagSwingFx(dirX: number, dirY: number): void { this.spawnFlagSwingFxAt(this.player.x, this.player.y, dirX, dirY); }
  /** 诸葛亮挥旗，画在指定位置（主将或随行）。 */
  protected spawnFlagSwingFxAt(px: number, py: number, dirX: number, dirY: number): void {
    if (this.textures.exists('zhuge_banner')) {
      const side = dirX < -0.15 ? -1 : 1, k = 86 / 256, ox = 0.302, from = -0.28 * side, to = 0.62 * side;
      const make = (alpha: number) => this.add.image(px + 10 * side, py + 18, 'zhuge_banner').setOrigin(side > 0 ? ox : 1 - ox, 1).setFlipX(side < 0).setScale(k).setDepth(DEPTH.fx - 1).setAlpha(alpha).setRotation(from);
      for (let i = 0; i < 2; i += 1) { const ghost = make(0.22 - i * 0.08); this.tweens.add({ targets: ghost, rotation: to, alpha: 0, duration: 240, delay: 20 + i * 30, ease: 'Sine.Out', onComplete: () => ghost.destroy() }); }
      const flag = make(1).setDepth(DEPTH.fx);
      this.tweens.add({ targets: flag, rotation: to, duration: 230, ease: 'Back.Out', onComplete: () => this.tweens.add({ targets: flag, alpha: 0, rotation: to * 0.8, duration: 160, onComplete: () => flag.destroy() }) });
      return;
    }
    const angle = Math.atan2(dirY, dirX);
    for (let i = 0; i < 3; i += 1) {
      const ghost = this.add.image(px, py + 6, 'war_flag').setOrigin(0.5, 1).setDepth(DEPTH.fx - 1).setAlpha(0.16 - i * 0.035).setScale(0.68).setRotation(angle - 0.32 + i * 0.18);
      this.tweens.add({ targets: ghost, rotation: angle + 0.32, alpha: 0, duration: 230, delay: i * 25, onComplete: () => ghost.destroy() });
    }
    const flag = this.add.image(px, py + 6, 'war_flag').setOrigin(0.5, 1).setDepth(DEPTH.fx).setScale(0.68).setRotation(angle - 0.32);
    this.tweens.add({ targets: flag, rotation: angle + 0.32, duration: 220, ease: 'Sine.InOut', onComplete: () => { this.tweens.add({ targets: flag, alpha: 0, duration: 120, onComplete: () => flag.destroy() }); } });
    this.tweens.add({ targets: flag, scaleX: 0.74, yoyo: true, repeat: 2, duration: 90, ease: 'Sine.InOut' });
  }

  /** 爆炸预警：地面亮起八卦火阵（扁椭圆、半透明），几点火星向中心聚拢；缺图时退回橙色圆圈。 */
  protected spawnFlameGatherFx(x: number, y: number, radius: number): void {
    if (!SHOW_OWN_RANGE_FX) { /* 默认（只保留关键提示）：不铺八卦火阵，只留火星向中心聚拢 */ }
    else if (this.textures.exists('fire_sigil')) {
      const w = radius * 2.1, sigil = this.add.image(x, y, 'fire_sigil').setDisplaySize(w * 0.8, w * 0.8 * 0.5).setDepth(DEPTH.ground + 4).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setName('fire-sigil');
      this.tweens.add({ targets: sigil, alpha: 0.85, displayWidth: w, displayHeight: w * 0.5, duration: 150, ease: 'Quad.Out', onComplete: () => this.tweens.add({ targets: sigil, alpha: 0, duration: 260, delay: 60, onComplete: () => sigil.destroy() }) });
    } else {
      const warn = this.add.circle(x, y, radius * 0.55, 0xff6a2a, 0.16).setStrokeStyle(3, 0xffb347, 0.9).setDepth(DEPTH.fx - 2);
      this.tweens.add({ targets: warn, scale: 1.18, alpha: 0.4, duration: 150, yoyo: true, onComplete: () => warn.destroy() });
    }
    // 火星向中心聚拢：手绘序列帧（hero_small_paint 第 3 行前 4 帧，2026-11-17 替换程序画的 6 个小圆点），压扁贴地
    if (this.textures.exists('hero_small_paint')) {
      const g = this.add.sprite(x, y, 'hero_small_paint', 12).setDisplaySize(radius * 1.5, radius * .9).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fx).setName('flame-gather'), f = { t: 0 };
      this.tweens.add({ targets: f, t: 3.99, duration: 170, onUpdate: () => { if (g.active) g.setFrame(12 + Math.floor(f.t)); }, onComplete: () => g.destroy() });
    }
  }

  /** 爆炸：6 帧火焰爆发序列（八卦亮起→火球→烈焰→贴地火环→余烬→淡烟），按爆炸半径缩放、以地面为中心；缺图时退回放大火球。 */
  protected spawnFlameFx(x: number, y: number, radius: number): void {
    if (HINT_MOCK === 'b') groundScar(this, x, y, radius, 'fire');
    if (this.textures.exists('flame_burst')) {
      const size = radius * 2.5, burst = this.add.image(x, y, 'flame_burst', 0).setOrigin(0.5, 0.82).setDisplaySize(size, size).setDepth(actorDepth(y) + 0.5).setName('flame-burst');
      { const tint = HERO_TINT[this.runConfig.character]; if (tint) burst.setTint(tint); }
      // 诸葛亮等仍用原来的 flame_burst 序列帧（八卦地纹是图本身的一部分，用户 2026-11-16「换回之前那个」）。
      // 庞统火雷：2026-11-17 用户「庞统的攻击特效还是像素，要改」→ 手绘火雷爆炸帧（pangtong_paint 第 1 行，无地纹），不再用战法图集的像素火焰
      if (this.runConfig.character === 'pangtong' && this.textures.exists('pangtong_paint')) {
        burst.destroy(); const fire = this.add.image(x, y, 'pangtong_paint', 0).setOrigin(.5, .74).setDisplaySize(radius * 2.3, radius * 2.3).setDepth(actorDepth(y) + .5).setName('flame-burst');
        this.tweens.addCounter({ from: 0, to: 5.99, duration: 460, onUpdate: t => fire.setFrame(Math.floor(t.getValue() ?? 0)), onComplete: () => fire.destroy() });
        return;
      }
      this.tweens.addCounter({ from: 0, to: 5.99, duration: 420, onUpdate: t => burst.setFrame(Math.floor(t.getValue() ?? 0)), onComplete: () => this.tweens.add({ targets: burst, alpha: 0, duration: 120, onComplete: () => burst.destroy() }) });
      return;
    }
    this.artEffects.show(2,x,y,radius*1.5,this.combatNow,280);
    for (let i = 0; i < 2; i += 1) {
      const flame = this.add.image(x, y, 'flame').setDepth(DEPTH.fx).setAlpha(0.9).setScale(0.45);
      this.tweens.add({ targets: flame, alpha: 0, scale: radius / 34, duration: 320, ease: 'Quad.easeOut', onComplete: () => flame.destroy() });
    }
  }

  // ---------------- 升级 / 结算 ----------------

  protected setMode(mode: Mode): void {
    // 所有战斗 Timer / Tween 一起冻结；绝对期限使用 combatNow。
    this.mode = mode;
    if(mode!=='pause')this.children.getByName('build-panel')?.destroy();if(mode!=='pause')this.children.getByName('item-bag')?.destroy();
    const canPlay = mode === 'none' && !this.over;
    this.time.paused = !canPlay;
    if (canPlay) this.tweens.resumeAll();
    else this.tweens.pauseAll();
    if (canPlay && this.pendingGrowthNotices.length) this.showGrowthNotice(this.pendingGrowthNotices.shift()!);
    this.joystick.setEnabled(canPlay);
    for (const child of this.children.list) if (child.name === 'combat-notice') (child as Phaser.GameObjects.Text).setVisible(canPlay);
    if (!canPlay) this.joystick.reset();
    if (this.levelPanel) this.levelPanel.setVisible(mode === 'levelup'||mode==='bossloot');
    this.rerollButton?.setVisible(mode==='levelup');
    this.pointsButton?.setVisible(mode==='none'&&!this.over&&this.player.growth.unallocated>0);
    if (this.attributePanel) this.attributePanel.setVisible(mode === 'attributes');
    if (this.recruitPanel) this.recruitPanel.setVisible(false);
    this.legionUI?.panel.setVisible(mode === 'recruit');
    this.campUI?.setVisible(mode==='rest');
    // 营中闲话：行军休整画面左下（不挡「率军出征」）
    if(mode==='rest'&&IS_DESKTOP&&!this.children.getByName('camp-talk'))campTalkStrip(this,24,GAME_HEIGHT-35,GAME_WIDTH/2-145-24-16,[this.storyDir?.chapterId||this.chapter.id],this.storyCtx(),DEPTH.overlay+3);
    else if(mode!=='rest')this.children.getByName('camp-talk')?.destroy();
    this.reinforcements?.panel.setVisible(mode === 'aid');
    if (this.pausePanel) {
      this.pausePanel.setVisible(mode === 'pause');
      this.attributePauseText?.setText(`分配属性点 · ${this.player?.growth.unallocated ?? 0}`);
      const exit=this.pausePanel.getByName('pause-exit') as Phaser.GameObjects.Text|null;
      exit?.setData('confirm',false).setText(IS_DESKTOP?'撤退':'返回选将').setColor('#b5c4b2');
    }
    if (this.resultPanel) this.resultPanel.setVisible(mode === 'result');
    if (mode === 'rest') commitBattle(); // 关卡告捷进行营：本场所得生效
    if (mode === 'rest' && !this.restIntroPlayed) { this.restIntroPlayed = true; this.playRestIntro(); }
  }

  protected openUpgrade(): void {
    if (this.over || this.pendingLevels <= 0) return;
    this.sfx.level();
    (this.levelPanel.getByName('upgrade-title') as Phaser.GameObjects.Text)?.setText('选择本次强化');
    { const lv = this.player.level, n = this.player.growth.unallocated, military = this.militaryPending > 0;
      (this.levelPanel.getByName('upgrade-title') as Phaser.GameObjects.Text)?.setText(military ? '军略 · 本关保底强化' : '武将升级 · 选择本次强化');
      (this.levelPanel.getByName('upgrade-points-hint') as Phaser.GameObjects.Text)?.setVisible(true).setText(`${military ? '军略（不给属性点）· ' : ''}武将 Lv.${lv}${n > 0 ? ` · 待分配属性点 ${n}` : ''}`).setName('upgrade-points-hint'); }
    this.rerolls=0;
    if (this.paceOn()) { this.lastPickAt = this.elapsed; this.forcePickNow = false; this.pickBatch = this.pendingLevels; this.pickBatchDone = 0; this.batchHint(); }
    this.upgradeOptions = buildUpgradeOptions(this.player, this.player.weapons, this.player.growth);
    if (this.relics?.takeXiangguo()) { this.relicExtraPicks = 1; this.relicFreeRerolls = 1; (this.levelPanel.getByName('upgrade-points-hint') as Phaser.GameObjects.Text)?.setVisible(true).setText('相国印 · 本次可连选两张，免费换一批 1 次'); }
    this.renderCards();
    this.setMode('levelup');
  }

  private rerollUpgrades():void{
    if(this.mode!=='levelup')return;
    const cost=this.relicFreeRerolls>0?0:10+this.rerolls*10;
    if(this.legion.food<cost)return;
    const old=this.upgradeOptions.map(o=>o.id).sort().join('|');let options=this.upgradeOptions;
    for(let i=0;i<12;i++){options=buildUpgradeOptions(this.player,this.player.weapons);if(options.map(o=>o.id).sort().join('|')!==old)break;}
    if(options.map(o=>o.id).sort().join('|')===old){this.rerollButton?.setText('暂无可换');return;}
    if(this.relicFreeRerolls>0)this.relicFreeRerolls--;else{this.legion.food-=cost;this.rerolls++;}this.upgradeOptions=options;this.renderCards();
  }
  protected renderCards(): void {
    if(this.rerollButton){const cost=this.relicFreeRerolls>0?0:10+this.rerolls*10;this.rerollButton.setText(this.relicFreeRerolls>0?'换一批 · 免费（相国印）':'换一批 · '+cost+'粮').setAlpha(this.legion.food>=cost?1:.5);if(this.legion.food>=cost)this.rerollButton.setInteractive({useHandCursor:true});else this.rerollButton.disableInteractive();}

    for (let i = 0; i < this.cardViews.length; i += 1) {
      const view = this.cardViews[i];
      const option = this.upgradeOptions[i];
      if (!option) {
        view.bg.setVisible(false);
        view.icon.setVisible(false);
        view.name.setVisible(false);
        view.desc.setVisible(false);
        view.tag.setVisible(false);
        continue;
      }
      view.root.setVisible(true);
      view.bg.setVisible(true);
      view.name.setVisible(true);
      view.desc.setVisible(true);
      view.tag.setVisible(true);
      view.accent=UPGRADE_ACCENT[option.kind]??UPGRADE_ACCENT.passive;view.rare=option.kind==='treasure'||option.kind==='rare';view.hover=false;
      this.paintUpgradeCard(view);
      view.name.setText(option.name);
      // 卡片说明统一称“首领”：中英混排时“Boss”会被拆成两行。
      view.desc.setText(option.desc.replace(/Boss/g,'首领')).setFontSize(IS_DESKTOP?16:17);
      while(view.desc.height>(IS_DESKTOP?view.h-246:view.h-104)&&parseInt(String(view.desc.style.fontSize))>13)view.desc.setFontSize(parseInt(String(view.desc.style.fontSize))-1);
      view.name.setFontSize(IS_DESKTOP?21:21);
      while(view.name.height>(IS_DESKTOP?50:30)&&parseInt(String(view.name.style.fontSize))>15)view.name.setFontSize(parseInt(String(view.name.style.fontSize))-1);
      // 名称与说明之间的分隔线（带菱形），随名称高度下移。
      const ruleY=view.name.y+view.name.height+(IS_DESKTOP?10:6),rx0=IS_DESKTOP?-view.w/2+30:104-view.w/2,rx1=IS_DESKTOP?view.w/2-30:view.w/2-18,accentLight=0xe0c58a;
      view.rule.clear().lineStyle(1,accentLight,.4).lineBetween(rx0,ruleY,rx1,ruleY).fillStyle(accentLight,.8).fillRect((rx0+rx1)/2-3,ruleY-3,6,6);
      view.desc.setY(ruleY+(IS_DESKTOP?10:7));
      let tagText = '被动';
      if (option.categoryLabel) tagText = option.categoryLabel;
      else if (option.kind === 'rare') tagText = '稀有';
      else if (option.kind === 'weapon') {
        const owned = option.weaponId ? this.player.weapons.find((w) => w.id === option.weaponId) : undefined;
        tagText = owned ? `武器 Lv.${owned.level} → ${owned.level + 1}` : '新武器';
      }
      view.tag.setText(view.rare&&option.kind==='treasure'?'✦ '+tagText:tagText);
      // 流派说明较长时（电脑布局卡片较窄）整体缩小，不超出卡面。
      view.tag.setScale(1);if(view.tag.width>view.w-20)view.tag.setScale((view.w-20)/view.tag.width);
      const categoryStyle:Record<UpgradeOption['kind'],{bg:string;color:string}>={
        tactic:{bg:'#345650',color:'#c6edce'},treasure:{bg:'#67502c',color:'#ffe2a0'},weapon:{bg:'#584729',color:'#ffe6a4'},martial:{bg:'#285448',color:'#9ce1c8'},
        attribute:{bg:'#354b5b',color:'#b9dcf0'},potion:{bg:'#63402d',color:'#ffd0a0'},
        trinket:{bg:'#4c3d59',color:'#dfc6fa'},foundation:{bg:'#3e5032',color:'#d8e7ae'},
        relic:{bg:'#5c4920',color:'#ffd166'},rare:{bg:'#64352e',color:'#ffd0c0'},passive:{bg:'#293e34',color:'#d8ffe9'},
      };
      const style=categoryStyle[option.kind];
      // 水墨预览：标签统一朱砂底（类别色只在现版用）
      if (GameScene.INK_LEVELUP) view.tag.setBackgroundColor('#8a2a1c').setColor('#fff0d6'); else view.tag.setBackgroundColor(style.bg).setColor(style.color);
      const iconKey = option.kind === 'potion' ? 'icon_rare' : option.kind === 'weapon' ? ({
        spear_orbit:'icon_1',crossbow:'icon_2',flame_banner:'icon_3',guandao:'icon_guandao',zhenbei_blade:'icon_zhenbei',lianhuan_mines:'icon_lianhuan',sun_knives:'icon_sunknives',diaochan_fans:'icon_fans',baodiao_bow:'icon_baodiao',dangyang_roar:'icon_shemao',zhanjin_lance:'icon_zhanjin',shuanggu_swords:'icon_shuanggu',
      } as const)[option.weaponId!] : option.weaponId === 'spear_orbit'
        ? 'icon_1'
        : option.weaponId === 'crossbow'
          ? 'icon_2'
          : option.weaponId === 'flame_banner'
            ? 'icon_3'
            : option.kind === 'rare'
              ? 'icon_rare'
              : option.weaponId === 'guandao' ? 'icon_guandao' : 'icon_passive';
      const rewardIcon=upgradeIcon(option);
      if (rewardIcon && this.textures.exists(rewardIcon)) {
        view.icon.setTexture(rewardIcon).setDisplaySize(52, 52).setVisible(true);
      } else {
        view.icon.setTexture(iconKey).setDisplaySize(52, 52).setVisible(true);
      }
    }
    this.upgradeAnimAt = performance.now();
  }

  /** 卡面贴图按类别色/悬停/稀有切换。 */
  /** 三选一 · 水墨预览（?levelup=ink，2026-11-17 用户「水墨风我看看再决定」；默认不启用）。 */
  private static get INK_LEVELUP(): boolean { try { return IS_DESKTOP && new URLSearchParams(location.search).get('levelup') === 'ink'; } catch { return false; } } // 用时再算：IS_DESKTOP 在 main.ts initLayout() 之后才定
  private paintUpgradeCard(view: CardView): void {
    view.bg.setTexture(GameScene.INK_LEVELUP ? inkUpgradeCardTexture(this, view.w, view.h, view.medal, view.hover, view.rare) : upgradeCardTexture(this, view.w, view.h, view.accent, view.medal, view.hover, view.rare)).setDisplaySize(view.w + 32, view.h + 32);
    (view.bg.getData('fitHit') as (() => void) | undefined)?.();
  }

  /** 三选一动画：卡片依次自下滑入淡入，悬停上浮 6px。升级时计时器与补间暂停，因此逐帧手动推进。 */
  private upgradeAnimAt = 0;
  protected animateUpgradeCards(): void {
    if (!this.levelPanel?.visible) return;
    const now = performance.now();
    this.cardViews.forEach((v, i) => {
      const k = Phaser.Math.Clamp((now - this.upgradeAnimAt - i * 70) / 240, 0, 1), ease = 1 - Math.pow(1 - k, 3);
      v.lift += ((v.hover ? -6 : 0) - v.lift) * .3;
      v.root.setY(v.baseY + (1 - ease) * 36 + v.lift).setAlpha(ease);
    });
  }

  protected chooseUpgrade(index: number): void {
    if(this.mode==='bossloot'){
      const option=this.upgradeOptions[index],done=this.lootContinue;if(!option||!done)return;
      this.lootContinue=null;this.upgradeOptions=[];option.apply(this.player,this.player.weapons,this.player.growth);this.artEffects.show(5,this.player.x,this.player.y-10,80,this.combatNow,450);done();return;
    }
    if (this.mode !== 'levelup' || this.pendingLevels <= 0) return;
    const option = this.upgradeOptions[index];
    if (!option) return;
    let growthNotice = '';
    if (option.kind === 'potion') {
      growthNotice = option.id === 'potion_rejuvenation'
        ? `回春丹 · 恢复 ${Math.round(Math.max(0, Math.min(this.player.maxHp - this.player.hp, Math.round(this.player.maxHp * .3))))} 生命`
        : '狂战丹 · 伤害与攻速提升 10 秒';
    }
    const remaining = this.upgradeOptions.filter((_o, k) => k !== index);
    this.upgradeOptions = []; // 先消费选项，防止重复点击旧卡。
    // 2026-11-17 用户：「奖励的回春丹可以存着」——药囊有空位就收进药囊（Q / 用药钮使用，回复 30% 生命），满了才立即回复
    if (option.id === 'potion_rejuvenation' && this.supplies && this.supplies.pouch.length < POUCH_MAX) {
      this.supplies.pouch.push({ amount: Math.round(this.player.maxHp * .3), texture: this.textures.exists('heal_props') ? 'heal_props' : 'healing_potion', frame: this.textures.exists('heal_props') ? 1 : undefined, name: '回春丹' });
      growthNotice = '回春丹 · 已收入药囊（Q 使用）';
    } else
    option.apply(this.player, this.player.weapons, this.player.growth);
    // 相国印：这次升级还能再选一张（剩下的卡里挑）
    if (this.relicExtraPicks > 0 && remaining.length) { this.relicExtraPicks--; this.upgradeOptions = remaining; this.renderCards(); (this.levelPanel.getByName('upgrade-points-hint') as Phaser.GameObjects.Text)?.setText('相国印 · 再选一张'); if (growthNotice) this.pendingGrowthNotices.push(growthNotice); return; }
    this.relicExtraPicks = 0; this.relicFreeRerolls = 0;
    this.pendingLevels -= 1; if (this.militaryPending > 0) this.militaryPending--;
    if (this.paceOn() && this.pendingLevels > 0 && !this.over) {
      // 连选：不关面板、不再响升级音，换一批继续选
      this.pickBatchDone++; this.pickBatch = Math.max(this.pickBatch, this.pickBatchDone + this.pendingLevels); this.rerolls = 0;
      this.upgradeOptions = buildUpgradeOptions(this.player, this.player.weapons, this.player.growth); this.renderCards(); this.batchHint();
      if (growthNotice) this.pendingGrowthNotices.push(growthNotice);
      return;
    }
    this.pickBatch = 0; this.pickBatchDone = 0;
    this.resumePendingChoices();
    if (growthNotice) {
      if ((this.mode as string) === 'none') this.showGrowthNotice(growthNotice);
      else this.pendingGrowthNotices.push(growthNotice);
    }
  }

  /** 连选提示：标题「连选 N 张 · 第 k 张」（PICK_PACE 合并多次升级 / 保底）。 */
  protected batchHint(): void {
    if (this.pickBatch <= 1) return;
    const lv = this.player.level, n = this.player.growth.unallocated, military = this.militaryPending > 0;
    (this.levelPanel.getByName('upgrade-title') as Phaser.GameObjects.Text)?.setText(`${military ? '军略' : '武将升级'} · 连选 ${this.pickBatch} 张（第 ${this.pickBatchDone + 1} 张）`);
    (this.levelPanel.getByName('upgrade-points-hint') as Phaser.GameObjects.Text)?.setVisible(true).setText(`武将 Lv.${lv}${n > 0 ? ` · 待分配属性点 ${n}` : ''}`);
  }

  protected showGrowthNotice(message: string): void {
    const notice = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * .36, message, {
      fontFamily: FONT, fontSize: IS_DESKTOP ? '18px' : '17px', color: '#f0d28b',
      fontStyle: 'bold', align: 'center', resolution: 2, stroke: '#211b12', strokeThickness: 4,
    }).setOrigin(.5).setScrollFactor(0).setDepth(DEPTH.overlay + 50).setName('combat-notice');
    this.tweens.add({ targets: notice, y: notice.y - 22, alpha: 0, delay: 700, duration: 450, onComplete: () => notice.destroy() });
  }

  protected resumePendingChoices(): void {
    if (this.over) return;
    this.setMode('none');
    // 三选一节奏：间隔不够的升级 / 保底继续攒着（update 里到点再开），先处理招募
    if (this.pendingLevels > 0 && this.pickGapOk()) this.openUpgrade();
    else if (this.pendingRecruit) this.openRecruit();
  }

  protected showSetToast(school: CharmSchool): void {
    const text = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.28, `${CHARM_SCHOOL_NAMES[school]}套装激活！`, {
        fontFamily: FONT,
        fontSize: IS_DESKTOP ? '22px' : '24px',
        color: '#ffd166',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.overlay + 50).setName('combat-notice').setVisible(this.mode === 'none');
    this.tweens.add({ targets: text, y: text.y - 30, alpha: 0, duration: 900, onComplete: () => text.destroy() });
  }

  protected showWaveBanner(text: string, danger = false, captionText?: string): void {
    this.sfx?.play(danger ? 'gong' : 'waveDrum');
    // Keep one notice at a time; no opaque panel over the battlefield.
    for (const notice of this.children.list.filter(o => o.name === 'combat-notice')) {
      this.tweens.killTweensOf(notice); notice.destroy();
    }
    const match = /^第 (\d+)\/(\d+) 波 · (.+)$/.exec(text);
    const label = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT * .21)
      .setScrollFactor(0).setDepth(DEPTH.overlay - 10).setName('combat-notice').setVisible(this.mode === 'none');
    const caption = this.add.text(0, -21, captionText ?? (match ? `第 ${match[1]} / ${match[2]} 波` : '战场警报'), {
      fontFamily: FONT, fontSize: IS_DESKTOP ? '13px' : '14px', color: danger ? '#efb39c' : '#e1cf9d',
      resolution: 2, stroke: '#241d12', strokeThickness: 3,
    }).setOrigin(.5).setScrollFactor(0);
    const title = this.add.text(0, 7, match ? match[3] : text, {
      fontFamily: FONT, fontSize: IS_DESKTOP ? '24px' : '23px', color: danger ? '#f1a18a' : '#f4e4b9',
      fontStyle: 'bold', align: 'center', resolution: 2, stroke: '#241d12', strokeThickness: 4,
      wordWrap: { width: GAME_WIDTH - 64 },
    }).setOrigin(.5).setScrollFactor(0);
    const ornament = this.add.graphics().setScrollFactor(0);
    const span = Math.min(GAME_WIDTH * .25, 108);
    ornament.lineStyle(1, danger ? 0xc87c60 : 0xc6ad72, .8)
      .lineBetween(-span, 31, -9, 31).lineBetween(9, 31, span, 31)
      .fillStyle(danger ? 0xc87c60 : 0xc6ad72, .9).fillRect(-2,29,4,4);
    label.add([caption, title, ornament]);
    this.tweens.add({ targets: label, alpha: 0, y: label.y - 8, delay: 1150, duration: 350, onComplete: () => label.destroy() });
  }

  /**
   * 战斗内「军中设置」（电脑版，2026-11-17 用户「暂停改成设置，然后可以调描边什么的」）：
   * 原暂停面板加宽成两栏——左栏 继续战斗 / 分配属性点 / 行囊 / 战法 / 返回营寨；右栏 音乐 · 音效滑条与各项设置。
   * 改了立即写入并即时生效，与主页「军中设置」共用同一组键（systems/BattleSettings）。
   */
  private layoutSettingsPanel(o: { panelG: Phaser.GameObjects.Graphics; panel: Phaser.GameObjects.Rectangle; pauseTitle: Phaser.GameObjects.Text; pauseHint: Phaser.GameObjects.Text; resume: Phaser.GameObjects.Image; resumeText: Phaser.GameObjects.Text; bgmRow: Phaser.GameObjects.GameObject[]; sfxRow: Phaser.GameObjects.GameObject[]; buildLink: Phaser.GameObjects.Text; bagLink: Phaser.GameObjects.Text; exit: Phaser.GameObjects.Text; keys: Phaser.GameObjects.Text }): void {
    const W = GAME_WIDTH, H = GAME_HEIGHT, pw = 780, ph = 470, top = (H - ph) / 2, cx = W / 2, lx = cx - 200, rx = cx + 165;
    o.panelG.clear(); lqPanel(o.panelG, cx - pw / 2, top, pw, ph); o.panel.setSize(pw, ph).setPosition(cx, H / 2); if (o.panel.input) o.panel.input.hitArea.setTo(0, 0, pw, ph);
    o.pauseTitle.setText('军中设置').setFontFamily(TITLE_FONT).setFontSize(30).setColor('#efd399').setStroke('#120904', 4).setPosition(cx, top + 36);
    o.pauseHint.setText('战斗已暂停').setFontFamily(FONT).setColor('#b9a57a').setPosition(cx, top + 68);
    const div = this.add.graphics().setScrollFactor(0); div.lineStyle(1, 0xc9a96a, .35).lineBetween(cx - 30, top + 92, cx - 30, top + ph - 58); this.pausePanel.add(div);
    // 左栏：动作
    // 2026-11-17 用户「这里不需要属性点，行囊，因为战斗界面有」：左栏只留 继续战斗（大）/ 查看构筑 / 撤退
    o.resume.setPosition(lx, top + 150).setDisplaySize(310, 60); o.resumeText.setPosition(lx, top + 150).setFontFamily(HEADING_FONT).setFontSize(24);
    for (const t of [this.attributePauseText, o.bagLink]) t?.setVisible(false).disableInteractive();
    o.buildLink.setPosition(lx, top + 240);
    o.exit.setPosition(lx, top + 320);
    for (const t of [o.buildLink, o.exit]) t?.setFontFamily(HEADING_FONT);
    o.keys.setText('Esc / P 继续战斗').setPosition(lx, top + ph - 26);
    // 右栏：音乐 / 音效滑条（原控件，挪到右栏）
    const moveRow = (row: Phaser.GameObjects.GameObject[], y: number): void => { const kept = row.filter(x => x.active); for (const x of kept) x.destroy(); void y; };
    moveRow(o.bgmRow, 0); moveRow(o.sfxRow, 0);
    const width = 250;
    this.pausePanel.add(this.createVolumeRow('音乐', top + 122, this.music.getVolume(), v => this.music.setVolume(v), rx, width));
    this.pausePanel.add(this.createVolumeRow('音效', top + 180, this.sfx.getVolume(), v => this.sfx.setVolume(v), rx, width));
    // 右栏：‹ 值 › 行
    const rowY = (i: number) => top + 222 + i * 31; // 第 5 行「武将台词」（平衡会话），第 6 行「剧情」，第 7 行「开场动画」（2026-11-18）
    const row = <T>(i: number, name: string, key: string, list: readonly T[], get: () => T, label: (v: T) => string, apply: (v: T) => void, note?: () => string): void => {
      const y = rowY(i);
      const plate = this.add.graphics().setScrollFactor(0); plate.fillStyle(0x3a2616, .4).fillRoundedRect(rx - width / 2, y - 14, width, 28, 5).lineStyle(1, 0xc9a35e, .3).strokeRoundedRect(rx - width / 2, y - 14, width, 28, 5);
      const nameT = this.add.text(rx - width / 2 + 12, y, name, { fontFamily: FONT, fontSize: '15px', color: '#e8d8b2', resolution: 2 }).setOrigin(0, .5).setScrollFactor(0).setStroke('#120904', 3);
      const val = this.add.text(rx + 62, y, label(get()), { fontFamily: HEADING_FONT, fontSize: '16px', color: '#efd399', resolution: 2 }).setOrigin(.5).setScrollFactor(0).setStroke('#120904', 3).setName('settings-' + key);
      const noteT = note ? this.add.text(rx + width / 2 + 8, y, '', { fontFamily: FONT, fontSize: '11px', color: '#9d8f78', resolution: 2 }).setOrigin(0, .5).setScrollFactor(0) : null;
      const step = (dir: number): void => { const v = cycle(list, get(), dir); apply(v); val.setText(label(get())); noteT?.setText(note?.() ?? ''); };
      const parts: Phaser.GameObjects.GameObject[] = [plate, nameT, val];
      for (const dir of [-1, 1]) {
        const b = this.add.text(rx + 62 + dir * 62, y, dir < 0 ? '‹' : '›', { fontFamily: HEADING_FONT, fontSize: '20px', color: '#e8d3a6', resolution: 2 }).setOrigin(.5).setScrollFactor(0).setName('settings-' + key + (dir < 0 ? '-dec' : '-inc')).setInteractive({ useHandCursor: true });
        b.on('pointerdown', () => step(dir)); b.setData('padAdjust', (d2: number) => step(d2));
        const sk = lqSkin(this, b, b, () => ({ w: 28, h: 26 }), { tone: 'quiet' }); lqHitBox(b, 28, 26); sk.gfx.setScrollFactor(0); parts.push(sk.gfx, b);
      }
      if (noteT) parts.push(noteT);
      this.pausePanel.add(parts);
    };
    row<OutlineMode>(0, '敌我描边', 'outline', ['off', 'enemy', 'all'], outlineMode, v => OUTLINE_LABEL[v], v => {
      setOutlineMode(v); if (this.iff) { this.iff.mode.outline = v !== 'off'; this.iff.mode.enemyOnly = v === 'enemy'; } if (v !== 'off') warmIffTextures(this.game);
    });
    row<OutlineWidth>(1, '描边粗细', 'outline-width', ['thin', 'thick'], outlineWidth, v => WIDTH_LABEL[v], v => { setOutlineWidth(v); if (this.iff) this.iff.mode.thick = v === 'thick'; });
    row<DamageNumbers>(2, '伤害数字', 'damage', ['all', 'crit', 'off'], damageNumbers, v => DAMAGE_LABEL[v], setDamageNumbers);
    row<ShakeLevel>(3, '震屏', 'shake', ['strong', 'weak', 'off'], shakeLevel, v => SHAKE_LABEL[v], v => { setShakeLevel(v); if (v !== 'off') this.cameras.main.shake(140, .004); });
    const scale0 = renderScaleSetting();
    row<RenderScaleSetting>(4, '画面清晰度', 'render-scale', ['', '1', '2', '3'], renderScaleSetting, v => SCALE_LABEL[v], setRenderScaleSetting, () => renderScaleSetting() === scale0 ? '' : '刷新后生效');
    row<HeroBarks>(5, '武将台词', 'hero-barks', ['on', 'off'], heroBarks, v => BARKS_LABEL[v], v => { setHeroBarks(v); if (v === 'off') this.heroBark?.clear(); });
    row<StoryMode>(6, '剧情', 'story', ['full', 'chapter', 'off'], storyMode, v => STORY_LABEL[v], setStoryMode);
    row<OpeningMode>(7, '开场动画', 'opening', ['every', 'first', 'off'], openingMode, v => OPENING_LABEL[v], setOpeningMode);
    const replay = tutorialReplayLink(this, rx + width / 2, top + ph - 14).setScrollFactor(0); this.pausePanel.add(replay);
  }

  protected createVolumeRow(label: string, y: number, initial: number, onChange: (value: number) => void, cx = GAME_WIDTH / 2, width = Math.min(330, GAME_WIDTH - 144)): Phaser.GameObjects.GameObject[] {
    const text = this.add.text(cx-width/2,y-23,label,warText(15,'#c7d6c5'));
    const percent = this.add.text(cx+width/2,y-23,`${Math.round(initial)}%`,warText(15,'#dfc58a')).setOrigin(1,0);
    const track = this.add.rectangle(cx,y+9,width,6,0x07140d).setStrokeStyle(1,0x48634e);
    const fill = this.add.rectangle(cx-width/2,y+9,width*initial/100,4,WAR.jade).setOrigin(0,.5);
    const hit = this.add.rectangle(cx,y+9,width+24,52,0,0).setInteractive({useHandCursor:true}).setName('volume-'+label);
    const knob = this.add.rectangle(cx-width/2+width*initial/100,y+9,14,20,0xdcc489).setStrokeStyle(1,0xf4dfac).setInteractive({useHandCursor:true});
    const apply = (ratio:number):void => {
      const pct=Math.round(Phaser.Math.Clamp(ratio,0,1)*100);
      knob.x=cx-width/2+width*pct/100;fill.width=width*pct/100;percent.setText(`${pct}%`);onChange(pct);
    };
    hit.on('pointerdown',(p:Phaser.Input.Pointer)=>apply((screenPoint(p).x-(cx-width/2))/width));
    hit.on('pointermove',(p:Phaser.Input.Pointer)=>{if(p.isDown)apply((screenPoint(p).x-(cx-width/2))/width);});
    this.input.setDraggable(knob);
    knob.on('drag',(_p:Phaser.Input.Pointer,x:number)=>apply((x-(cx-width/2))/width));
    // 手柄：焦点在滑条上时左右键每次 ±10%
    hit.setData('padAdjust',(dir:number)=>apply((knob.x-(cx-width/2))/width+dir*.1));
    return [text,percent,track,fill,hit,knob];
  }

  protected scheduleRecruit(): void {
    if (this.over) return;
    if (this.mode === 'none') this.openRecruit();
    else this.pendingRecruit = true;
  }

  protected openRecruit(): void {
    if (this.waveIndex <= 0 || this.resting || this.recruitedWaves.has(this.waveIndex)) { this.pendingRecruit = false; return; }
    if (this.mode !== 'none') { this.pendingRecruit = true; return; }
    this.pendingRecruit = false; this.freeRecruit = true;
    const start = Math.max(0, this.waveIndex - 1) * 3;
    // 支援招兵只出现军营已解锁的兵种（营寨未开放的新档军营 1 级，即基础三种）
    const pool=unlockedTroopKinds();
    this.recruitOptions = Array.from({ length: 3 }, (_, i) => ({ kind: pool[(start + i) % pool.length], upgrade: false }));
    this.legion.freeRecruitCount = FREE_RECRUIT_BY_TIER[Math.max(0, Math.min(FREE_RECRUIT_BY_TIER.length - 1, this.itemTier()))] + this.player.growth.freeRecruitBonus(); // 统御·募众
    this.renderRecruit(); this.setMode('recruit');
  }

  protected renderRecruit(): void { if(this.resting){const next=this.chapter.id==='hulao'?((this.chapter.westStage??1)===1?'荥阳之战':'虎牢关决战'):this.chapter.stage===3?'汜水关':this.chapter.stage===1?'下曲阳破阵':'广宗决战';this.campUI?.open(this.chapter.id+'-'+this.battleStage(),next);return;}  this.legionUI?.render(this.legion, this.resting ? 'rest' : 'wave', this.recruitOptions.map(o => o.kind));if(this.resting)this.legionUI.setCampDestination(this.chapter.id==='hulao'?((this.chapter.westStage??1)===1?'荥阳之战':'虎牢关决战'):this.chapter.stage===3?'第二章 · 汜水关':this.chapter.stage===1?'下曲阳破阵':'广宗决战',this.chapter.id==='hulao'?'讨董军营 · 战后休整':'黄巾败退 · 战后休整'); }

  private buyTroops(kind: TroopKind, train: boolean): void {
    if (this.mode === 'rest' && this.resting) {
      if(train||!INITIAL_TROOPS.includes(kind))return;
      const ok = train ? this.legion.train(kind) : this.legion.recruit(kind, 1);
      if (ok) this.sfx.play(train ? 'purchase' : 'recruit');
      if (ok) this.renderRecruit();
      return;
    }
    if (this.mode !== 'recruit' || !this.freeRecruit || train || this.recruitedWaves.has(this.waveIndex) || !this.recruitOptions.some(o => o.kind === kind)) return;
    this.legion.arriveFrom = this.recruitEntryPoint(); // 援兵从场外跑来入列（用户 2026-11-17）
    if (this.legion.recruit(kind, this.legion.freeRecruitCount, true)) { // freeRecruitCount 开招兵时已含统御·募众
      if(this.waveIndex%2===0){const id=this.player.hp<this.player.maxHp?'rejuvenation':'berserk';this.player.growth.usePotion(id,this.player,this.combatNow);this.showGrowthNotice(id==='rejuvenation'?'整军奖励 · 回春丹':'整军奖励 · 狂战丹');}
      this.recruitedWaves.add(this.waveIndex); this.freeRecruit = false; this.recruitOptions = [];
      this.resumePendingChoices();
    }
  }

  /**
   * 战场支援援兵的入场点：画面边缘外一点，先试主将面朝的那一边，再按离主将由近到远试其余三边；
   * 每边沿边线试几个偏移，避开城墙 / 关隘碰撞框、河水与树干（地形层的禁区判定）。都不行就退回主将身后。
   */
  /** 障碍物按类别掉落（data/propLoot.ts）：兵器架只出攻击类兵装、甲胄架只出护具，封顶蓝色、每关上限；粮袋粮车给随军粮；军旗 / 营帐 / 景物不会走到这里。 */
  protected propLoot(kind: PropLootKind, x: number, y: number): void {
    const L = PROP_LOOT, rng = this.propRng, now = this.combatNow;
    if (kind === 'grain') { this.legion.food += L.grain.food; this.showGrowthNotice('缴获粮草 · 随军粮 +' + L.grain.food); return; }
    if (kind !== 'weapons' && kind !== 'armor' && kind !== 'crate' && kind !== 'coins') return;
    const c = L[kind];
    for (let i = 0; i < c.gems; i++) { const a = i / Math.max(1, c.gems) * Math.PI * 2; this.spawnGem(x + Math.cos(a) * 22, y + 8 + Math.sin(a) * 10, 1); }
    if (this.itemDrops && this.propItems < L.perStageItems && rng() < c.itemChance) { const it = rollPropItem(kind, rng); if (it) { this.propItems++; this.itemDrops.drop(it, x, y + 18); } }
    if (kind === 'weapons' && rng() < L.weapons.buffChance) { const g = this.player.growth; g.berserkUntil = Math.max(g.berserkUntil, now) + L.weapons.buffMs; this.showGrowthNotice('取兵器 · 斗志昂扬（短时伤害提升）'); }
    if (kind === 'armor' && rng() < L.armor.buffChance) { this.player.propGuardUntil = Math.max(this.player.propGuardUntil, now) + L.armor.buffMs; this.player.propGuardMul = L.armor.guardMul; this.showGrowthNotice('披甲执盾 · 短时减伤'); }
  }

  protected recruitEntryPoint(): { x: number; y: number } {
    const v = this.cameras.main.worldView, p = this.player, m = 70;
    const edges: Record<'left' | 'right' | 'up' | 'down', { x: number; y: number; along: 'x' | 'y'; d: number }> = {
      left: { x: v.x - m, y: p.y, along: 'y', d: p.x - v.x }, right: { x: v.right + m, y: p.y, along: 'y', d: v.right - p.x },
      up: { x: p.x, y: v.y - m, along: 'x', d: p.y - v.y }, down: { x: p.x, y: v.bottom + m, along: 'x', d: v.bottom - p.y },
    };
    const order = [p.direction, ...(['left', 'right', 'up', 'down'] as const).filter(k => k !== p.direction).sort((a, b) => edges[a].d - edges[b].d)];
    const boxes = this.sishuiObstacles?.footprints ?? [];
    const blocked = (x: number, y: number) => boxes.some(b => x > b.left - 40 && x < b.right + 40 && y > b.top - 40 && y < b.bottom + 40)
      || !!this.terrain && (this.terrain.inWater(x, y, 30) || (() => { const f = this.terrain!.free(x, y, 30); return Math.hypot(f.x - x, f.y - y) > 1; })());
    for (const k of order) { const e = edges[k]; for (const off of [0, 120, -120, 240, -240]) { const x = e.along === 'x' ? e.x + off : e.x, y = e.along === 'y' ? e.y + off : e.y; if (!blocked(x, y)) return { x, y }; } }
    return { x: p.x, y: p.y + 55 };
  }

  protected chooseRecruit(index: number): void { const option = this.recruitOptions[index]; if (option) this.buyTroops(option.kind, false); }

  /** 战地招募第 4 张血药卡：立即回复 30% 最大生命（数值由「平衡与数值」会话给定；满血时卡灰掉、不可选，判定同 canOfferRejuvenation）。用户 2026-11-16 批准加卡。 */
  static readonly RECRUIT_POTION_HEAL = .3;
  /** 战地招募选「血药」：代替本波的免费招兵，立即回血，然后继续战斗。 */
  protected takeRecruitPotion(): void {
    if (this.mode !== 'recruit' || !this.freeRecruit || this.recruitedWaves.has(this.waveIndex) || !canOfferRejuvenation(this.player)) return;
    const amount = Math.round(this.player.maxHp * GameScene.RECRUIT_POTION_HEAL);
    this.player.heal(amount);
    this.sfx.play('recruit');
    this.showGrowthNotice('血药 · 回复生命 ' + amount);
    this.recruitedWaves.add(this.waveIndex); this.freeRecruit = false; this.recruitOptions = [];
    this.resumePendingChoices();
  }

  protected continueCampaign(): void {
    if (!this.resting || this.mode !== 'rest' || this.children.getByName('chapter1-volunteers')) return;
    const west=this.chapter.id==='hulao';
    const stage=west?(this.chapter.westStage??3):(this.chapter.stage??1);
    const chapter=west||stage===3?'hulao':'huangjin';
    const next=(west?stage+1:stage===3?1:stage+1) as 1|2|3;
    if(next>3||(chapter==='hulao'&&!dongzhuoStageUnlocked(next)&&!isChapterTestRun()))return;
    const transfer=packCampaign(this.runConfig.character,this.player,this.legion,this.followers);transfer.chapter=chapter;transfer.stage=chapter==='huangjin'?next:undefined;
    this.registry.set('campaignTransfer',transfer);
    this.registry.set('runConfig',{...this.runConfig,chapter,stage:chapter==='huangjin'?next:undefined,westStage:chapter==='hulao'?next:undefined});
    this.resting = false; this.scene.restart();
  }

  // —— 手柄（STEAM_PLAN.md · S2；导航见 ui/PadNavigator.ts）——
  /** 战斗进行中：摇杆用于移动，不做界面导航。 */
  padCapture(): boolean { return this.mode === 'none' && !this.over; }
  /** ☰ 暂停 / 继续，⧉ 行囊，Ⓧ 用药，Ⓨ 护阵 / 出击；暂停中 Ⓑ 继续战斗。 */
  padButton(button: number): boolean {
    if (this.restIntroSkip && (button === PAD.A || button === PAD.B || button === PAD.START)) { this.restIntroSkip(); return true; }
    if (button === PAD.START && ((this.mode === 'none' && !this.over) || this.mode === 'pause')) { this.togglePause(); return true; }
    if (button === PAD.BACK && this.mode === 'none' && !this.over) { this.openBattleBag(); return true; }
    if (this.mode === 'none' && !this.over) {
      if (button === PAD.X) { this.usePotion(); return true; }
      if (button === PAD.Y) { this.legion.cycleOrder(); return true; }
      // RB：轮流锁定附近的敌营 / 粮草（由近到远）；LB：取消锁定
      if (button === PAD.RB) { const list = this.padTargets().sort((a, b) => a.dist - b.dist); if (!list.length) return false; const i = list.findIndex(t => t.current); this.padClearTargets(); list[(i + 1) % list.length].select(); return true; }
      if (button === PAD.LB) { this.padClearTargets(); return true; }
      return false;
    }
    if (button === PAD.B && this.mode === 'pause' && !this.children.getByName('build-panel') && !this.children.getByName('item-bag')) { this.togglePause(); return true; }
    return false;
  }
  /** 面板打开时只在面板（overlay 层）里导航，不跳到 HUD 按钮。 */
  padFilter(obj: Phaser.GameObjects.GameObject): boolean {
    if (this.mode === 'none') return true;
    let root = obj as Phaser.GameObjects.GameObject & { depth?: number }; while (root.parentContainer) root = root.parentContainer as typeof root;
    return (root.depth ?? 0) >= DEPTH.overlay;
  }
  /** 按当前输入设备刷新按键提示。 */
  protected refreshInputHints(): void {
    const pad = gamepad.device === 'pad';
    this.potionCaption?.setText(pad ? '用药 ' + PAD_LABEL.X : '用药');
    this.pauseKeysText?.setText(pad ? PAD_LABEL.START + ' / ' + PAD_LABEL.B + ' 继续战斗' : IS_DESKTOP ? 'Esc / P 继续战斗' : '战斗已冻结 · 点击「继续战斗」恢复');
    this.hudTexts?.pause?.setText(pad ? PAD_LABEL.START + (IS_DESKTOP ? ' 设置' : ' 暂停') : IS_DESKTOP ? '设置' : '暂停');
    // 有敌营 / 粮草可锁定的战场（子类覆写了 padTargets）多提示 RB
    const lockable = this.padTargets !== GameScene.prototype.padTargets;
    this.hintText?.setText(pad ? (lockable ? '左摇杆移动 · RB 锁定敌营 / 粮草 · 自动攻击' : '左摇杆移动 · 自动攻击') : IS_DESKTOP ? 'WASD / 方向键移动 · 自动攻击' : '自动攻击 · 拖动摇杆移动');
    this.legionUI?.setKeyHint(pad ? PAD_LABEL.Y : IS_DESKTOP ? 'E' : '⇄');
    for (const [i, v] of (this.cardViews ?? []).entries()) v.hint.setText(pad ? PAD_LABEL.A + ' 选择' : IS_DESKTOP ? '按 ' + (i + 1) + ' 选择' : '点击选择');
  }

  /**
   * 打完一关进入行营的水墨过场（约 3 秒，可点击 / 任意键 / 手柄跳过）：
   * 先停在战场看武将胜利动作并压暗四周 → 数道浓墨笔触从左向右扫过盖住战场 → 墨上朱砂大字「某某 · 平定」与“捷”字印 → 墨色淡去露出行营。
   * 关卡结束后战斗计时器已暂停，所以用真实时钟（postupdate）驱动。
   */
  private playRestIntro(): void {
    const W = GAME_WIDTH, H = GAME_HEIGHT, D = IS_DESKTOP;
    const hidden: Phaser.GameObjects.GameObject[] = [];
    const hide = (o?: Phaser.GameObjects.GameObject & { visible?: boolean; setVisible?: (v: boolean) => unknown } | null): void => { if (o && o.visible) { o.setVisible!(false); hidden.push(o); } };
    hide(this.children.getByName('camp-rest') as never); hide(this.legionUI?.panel as never); hide(this.children.getByName('chapter1-volunteers') as never);
    const root = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay + 60).setName('rest-intro');
    const blocker = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.001).setInteractive();
    if (!this.textures.exists('rest_vignette')) { const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d')!, r = g.createRadialGradient(256, 256, 120, 256, 256, 362); r.addColorStop(0, 'rgba(11,7,5,0)'); r.addColorStop(.55, 'rgba(11,7,5,.35)'); r.addColorStop(1, 'rgba(11,7,5,.92)'); g.fillStyle = r; g.fillRect(0, 0, 512, 512); this.textures.addCanvas('rest_vignette', c); }
    const vignette = this.add.image(W / 2, H / 2, 'rest_vignette').setDisplaySize(W, H).setAlpha(0);
    const ink = this.textures.exists('btn_ink_secondary_normal') ? 'btn_ink_secondary_normal' : null;
    const strokes: Phaser.GameObjects.Image[] = [];
    const bands = D ? 4 : 6, bandH = H / bands * 1.75;
    for (let i = 0; i < bands; i++) {
      const y = H * (i + .5) / bands + (i % 2 ? 6 : -6);
      const img = ink ? this.add.image(-W, y, ink).setDisplaySize(W * 1.9, bandH).setFlipY(i % 2 === 1) : this.add.image(-W, y, '__WHITE').setDisplaySize(W * 1.9, bandH).setTint(0x0d0a08);
      img.setAlpha(.98).setTint(0x2a2622); strokes.push(img);
    }
    const fill = this.add.rectangle(W / 2, H / 2, W, H, 0x0d0b09, 0);
    const stageName = String(this.chapter.name ?? '').replace(/^\d+-\d+\s*/, '') || '此役';
    const title = this.add.text(W / 2, H / 2 - (D ? 8 : 20), stageName + ' · 平定', { fontFamily: TITLE_FONT, fontSize: (D ? 54 : 44) + 'px', color: '#c8321f', resolution: 2 }).setOrigin(.5).setLetterSpacing(8).setShadow(0, 2, '#000', 6, true, true).setAlpha(0);
    const sub = this.add.text(W / 2, H / 2 + (D ? 48 : 40), '收兵回营 · 整军再战', { fontFamily: HEADING_FONT, fontSize: '18px', color: '#d9c7a4', resolution: 2 }).setOrigin(.5).setLetterSpacing(6).setAlpha(0);
    const sealX = W / 2 + title.width / 2 + (D ? 44 : 34), sealY = title.y - 6;
    const seal = this.add.container(sealX, sealY).setAlpha(0);
    seal.add(this.add.rectangle(0, 0, 46, 46, 0xb8281c).setStrokeStyle(2, 0xe0573f));
    seal.add(this.add.text(0, 1, '捷', { fontFamily: TITLE_FONT, fontSize: '30px', color: '#f6e4c8', resolution: 2 }).setOrigin(.5));
    seal.setAngle(-6).setScale(1.6);
    const skipHint = this.add.text(W - 20, H - 18, '点击跳过', { fontFamily: FONT, fontSize: '12px', color: '#8e8270', resolution: 2 }).setOrigin(1, 1).setAlpha(.0);
    root.add([vignette, ...strokes, fill, title, sub, seal, skipHint, blocker]);
    const start = performance.now(), T = { hold: 900, sweep: 650, show: 1100, fade: 600 };
    const total = T.hold + T.sweep + T.show + T.fade;
    let revealed = false, done = false;
    const reveal = (): void => { if (revealed) return; revealed = true; for (const o of hidden) (o as unknown as { setVisible(v: boolean): void }).setVisible(true); (this.children.getByName('chapter1-volunteers') as Phaser.GameObjects.Container | null)?.setVisible(true); };
    const ease = (x: number): number => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
    const finish = (): void => {
      if (done) return; done = true; reveal();
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, tick); this.input.keyboard?.off('keydown', finish);
      this.restIntroSkip = undefined; root.destroy();
    };
    const tick = (): void => {
      const t = performance.now() - start;
      vignette.setAlpha(ease(t / T.hold) * (1 - ease((t - T.hold - T.sweep - T.show) / T.fade)));
      strokes.forEach((img, i) => { const p = ease((t - T.hold - i * 90) / T.sweep); img.x = -W + p * (W * 1.5); img.setAlpha(.98 * (1 - ease((t - T.hold - T.sweep - T.show) / T.fade))); });
      fill.setFillStyle(0x0d0b09, .85 * ease((t - T.hold - T.sweep * .6) / 300) * (1 - ease((t - T.hold - T.sweep - T.show) / T.fade)));
      const showP = (t - T.hold - T.sweep) / 350, fadeOut = 1 - ease((t - T.hold - T.sweep - T.show) / (T.fade * .7));
      title.setAlpha(ease(showP) * fadeOut).setScale(1.12 - .12 * ease(showP));
      sub.setAlpha(ease(showP - .4) * fadeOut);
      const sp = ease((t - T.hold - T.sweep - 280) / 220); seal.setAlpha(sp * fadeOut).setScale(1.6 - .6 * sp);
      skipHint.setAlpha(Math.min(.8, t / 400) * fadeOut);
      if (t >= T.hold + T.sweep + T.show) reveal();
      if (t >= total) finish();
    };
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
    blocker.on('pointerdown', finish);
    this.input.keyboard?.once('keydown', finish);
    this.restIntroSkip = finish;
    this.events.once('shutdown', () => { this.events.off(Phaser.Scenes.Events.POST_UPDATE, tick); this.restIntroSkip = undefined; });
    tick();
  }

  protected togglePause(): void {
    if (performance.now() - ((this.data?.get('storyEscAt') as number | undefined) ?? -1e9) < 250) return; // 剧情卷轴刚被 Esc 跳过：同一下 Esc 不再打开暂停
    // 行囊开着时 Esc / ☰ 先关行囊（关掉时会按需恢复战斗）
    const bag = this.children.getByName('item-bag'); if (bag) { (bag.getData('ui') as { close?: () => void } | undefined)?.close?.(); return; }
    if (this.mode === 'none' && !this.over) {
      this.setMode('pause');
    } else if (this.mode === 'pause') {
      this.resumePendingChoices();
    }
  }

  private updateRelicWaves():void{
    if(!this.relicWaveGfx)return;const g=this.relicWaveGfx;g.clear();
    for(let i=this.relicWaves.length-1;i>=0;i--){const r=this.relicWaves[i],p=(this.combatNow-r.at)/240;if(p>=1||this.over){this.relicWaves.splice(i,1);continue;}if(HINT_MOCK)continue;g.lineStyle(2,0xe9ca83,(1-p)*.8).strokeCircle(r.x,r.y,110).lineStyle(1,0xffe5b0,(1-p)*.65).strokeCircle(r.x,r.y,110*(.35+.65*p));}
  }
  /** 末位首领已倒、宝箱还没捡：暂停刷兵 / 敌营出兵。 */
  protected get awaitingChest():boolean{return this.bossKilled&&this.bossChests.some(c=>!c.done);}
  /** 子类首领控制器自己会播倒地帧时返回 true（第三~五章、官渡、攻城、情报）。 */
  protected bossHasDeathArt():boolean{return false;}
  /** 首领宝箱：倒地点掉落，主将碰到打开。 */
  protected spawnBossChest(x:number,y:number,done:()=>void):void{
    if(!this.player.alive){this.finish(false);return;}
    // 落点避开尸体（画风会话量的躺倒身体范围）：倒地 4 帧往朝向前方偏 80，其余往下偏 30
    const ox=this.bossFallDir*80,oy=30;
    // 落点压在城墙 / 障碍里时（首领倒在墙边），沿着往主将的方向挪到第一个空地，免得宝箱捡不到、关卡结不了
    let cx=x+ox,cy=y+oy;{const clear=(px:number,py:number)=>!this.supplies||this.supplies.envClear(px,py,44);if(!clear(cx,cy)){const px=this.player.x,py=this.player.y;for(let k=1;k<=12;k++){const t=k/12,tx=cx+(px-cx)*t,ty=cy+(py-cy)*t;if(clear(tx,ty)){cx=tx;cy=ty;break;}if(k===12){cx=px;cy=py+30;}}}}
    this.bossChests.push(new BossChest({scene:this,player:this.player,grant:()=>this.grantBossChest(),done,sfx:k=>this.sfx.play(k)},cx,cy,this.combatNow));
  }
  /** 宝箱里只有首领遗珍（用户 2026-11-17「首领宝箱只给首领遗珍」；道具系统发放，见 ItemDrops.claimBossRelic）。 */
  protected grantBossChest():ChestLoot[]{
    const out:ChestLoot[]=[];
    this.ensurePicks(this.campaignReplay?PICK_GUARANTEE.side:PICK_GUARANTEE.main,true);
    const item=this.itemDrops?.claimBossRelic();
    if(item){const rd=relicDef(item.base),sp=rd?.special?SPECIALS[rd.special as keyof typeof SPECIALS]:undefined;out.push({name:itemName(item),desc:sp?sp.name+'：'+sp.desc:(rd?.lore??'额外兵装 · 结算后入行囊'),tag:rd?'首领遗珍 · 结算后入行囊':'兵装'});}
    this.artEffects.show(5,this.player.x,this.player.y-10,80,this.combatNow,450);
    return out;
  }
  /** 战功结算：本场击杀精英 / 首领所得战功存进存档，结算画面写「本场战功 +X（精英 a · 首领 b）」。只计一次。返回本场战功。 */
  protected settleMerit():number{
    const {elite,boss}=this.runMerit,n=meritFromKills(elite,boss);this.runMerit={elite:0,boss:0};
    if(n<=0)return 0;
    const total=addMerit(n);
    this.resultTexts?.body?.setText(this.resultTexts.body.text+'\n本场战功  +'+n+'（精英 '+elite+' · 首领 '+boss+'）· 共 '+total+' · 可在讲武堂换武学残卷');
    return n;
  }
  /**
   * 战报小结：第一章各关、第二章前两关打赢后直接进行营休整，结算文字不显示（用户反映「武将等级好像一直不涨」其实是看不到）。
   * 入营水墨过场结束后，把武将等级、首次通关、随行、战功、残卷这几行在画面中间显示约 5 秒。
   */
  /**
   * 电脑版结算展示（2026-11-17 用户「关于打败boss后结算ui也要优化一下」）：
   * 小标题「X-X 告捷」+ 书法大标题，中间武将经验条与奖励图标格（数字滚动、升级弹字、首领遗珍翻牌），下方一两行要事与一行战况。
   * 原结算文字（resultTexts.body）照旧写全、只是电脑版不显示：逻辑与测试都读它。动画 2 秒内放完，点空白处跳过。
   */
  protected presentResult(victory: boolean): void {
    if (!IS_DESKTOP || !this.resultPanel) return;
    this.resultAnimSkip?.();
    (this.resultPanel.getByName('result-rewards') as Phaser.GameObjects.Container | null)?.destroy();
    const lines = this.resultTexts.body.text.split('\n'), top = this.resultTop, H = this.resultH, cx = GAME_WIDTH / 2;
    this.resultTexts.body.setVisible(false);
    const code = /^(\d+-\d+)/.exec(this.chapter.name ?? '')?.[1];
    const kicker = this.resultPanel.getByName('result-kicker') as Phaser.GameObjects.Text | null;
    kicker?.setText(victory ? (code ? code + ' 告捷' : '大 捷') : (code ? code + ' 失利' : '失 利')).setColor(victory ? '#d9b878' : '#c98a7a');
    const title = this.resultTexts.title.setColor(victory ? RESULT_GOLD : '#e0624f'), sub = this.resultTexts.subtitle;
    const relic = victory ? this.itemDrops?.runLoot.find(i => !!relicDef(i.base)) ?? null : null;
    const hero = parseHeroLine(lines); let xpFraction: number | null = null;
    if (hero) { try { const h = heroInfo(this.runConfig.character as HeroKey); xpFraction = h.next > 0 ? h.xp / h.next : 1; } catch { /* 存档不可用 */ } }
    const view = buildRewardView(this, { lines, width: 640, relic, xpFraction });
    // 要事（小字，最多三行）：首通、随行、坐骑、乱世首通、屯田 / 城池细项、测试或败退提示
    const notes: string[] = [];
    for (const l of lines) {
      const t = l.replace(/\s{2,}/g, ' ');
      if (/^(首次通关|随行|获得坐骑|乱世首通|屯田供粮|城池产出|流寇未平|成都归入)/.test(l)) notes.push(t);
      else if (/^营寨 · 农田 \+\d+ · /.test(l)) { const rest = t.replace(/^营寨 · 农田 \+\d+ · /, ''); if (rest !== '口粮 −0') notes.push('营寨 · ' + rest); }
      else if (/^缴获兵装/.test(l) && /测试战斗不入行囊|败退遗失/.test(l)) notes.push('兵装' + (l.match(/· (测试战斗不入行囊|败退遗失 \d+ 件)/)?.[1] ?? ''));
    }
    if (hero?.capped) notes.push('武将已到本章等级上限 Lv.' + hero.to);
    const noteText = this.resultPanel.getByName('result-notes') as Phaser.GameObjects.Text;
    noteText.setText(notes.length > 3 ? [notes.slice(0, 2).join(' · '), notes.slice(2).join(' · ')].join('\n') : notes.join('\n')).setVisible(notes.length > 0);
    const stats = this.resultPanel.getByName('result-stats') as Phaser.GameObjects.Text;
    stats.setText(['击杀 ' + this.kills, '用时 ' + this.formatTime(this.elapsed), '伤害 ' + wan(this.damageDealt), '军团 ' + this.legion.count + ' 存活' + (this.legion.dead ? ' / ' + this.legion.dead + ' 阵亡' : '')].join('　·　')).setVisible(true);
    // 奖励区在分隔线与要事之间居中
    const areaTop = top + 142, areaBottom = (notes.length ? noteText.y - noteText.height - 6 : stats.y - 16);
    view.root.setPosition(cx, areaTop + Math.max(0, (areaBottom - areaTop - view.height) / 2));
    if (!view.height) { view.root.add(this.add.text(0, 0, victory ? '本场没有新的奖励' : '胜败乃兵家常事 · 整军再战', { fontFamily: HEADING_FONT, fontSize: '18px', color: RESULT_IVORY, resolution: 2 }).setOrigin(.5).setStroke(RESULT_STROKE, 3).setAlpha(.8)); view.root.setY((areaTop + areaBottom) / 2); }
    view.root.setScrollFactor(0); for (const c of view.root.list) (c as unknown as { setScrollFactor: (v: number) => void }).setScrollFactor(0);
    this.resultPanel.addAt(view.root, this.resultPanel.getIndex(noteText));
    const ty = title.y, kick = kicker;
    const anims: ResultAnim[] = [
      { start: 0, dur: 320, step: p => { title.setAlpha(p).setScale(1.25 - .25 * (1 - Math.pow(1 - p, 3))).setY(ty); kick?.setAlpha(p); sub.setAlpha(.85 * p); } },
      ...view.anims,
      { start: 1150, dur: 400, step: p => { noteText.setAlpha(p); stats.setAlpha(p); } },
    ];
    if (view.levelUp) this.sfx.level();
    this.resultAnimDone = false;
    this.resultAnimSkip = playResultAnims(this, anims, () => { this.resultAnimDone = true; this.resultAnimSkip = null; }, () => view.root.active);
  }
  protected showRestSummary():void{
    const lines=(this.resultTexts?.body?.text??'').split('\n').filter(l=>/^(武将等级|首次通关|随行|本场战功|武学残卷)/.test(l));
    if(!lines.length)return;
    const show=()=>{if(!this.sys?.isActive())return;if(IS_DESKTOP){this.showRestSummaryDesk(lines);return;}const t=this.add.text(GAME_WIDTH/2,GAME_HEIGHT*.42,'战报\n'+lines.join('\n'),{fontFamily:FONT,fontSize:IS_DESKTOP?'18px':'16px',color:'#f0d28b',fontStyle:'bold',align:'center',lineSpacing:6,resolution:2,stroke:'#211b12',strokeThickness:4,backgroundColor:'#140d07e6',padding:{x:24,y:14},wordWrap:{width:GAME_WIDTH-60}}).setOrigin(.5).setScrollFactor(0).setDepth(DEPTH.overlay+60).setName('rest-summary').setInteractive();t.on('pointerdown',()=>t.destroy());window.setTimeout(()=>{if(t.active)t.destroy();},5200);};
    // 休整时场景计时器暂停，用浏览器计时等入营过场结束
    let tries=0;const wait=()=>{if(this.children.getByName('rest-intro')&&tries++<40)window.setTimeout(wait,250);else show();};window.setTimeout(wait,400);
  }
  /** 电脑版入营「战报」：漆卷小窗（书法「战报」+ 经验条 + 战功 / 残卷格 + 首通 / 随行小字），约 5 秒后自动收起，点一下收起。 */
  private showRestSummaryDesk(lines: string[]): void {
    const cx = GAME_WIDTH / 2, w = 470;
    const view = buildRewardView(this, { lines, width: w, only: /武将等级|本场战功|武学残卷/ });
    const notes = lines.filter(l => /^(首次通关|随行)/.test(l)).map(l => l.replace(/\s{2,}/g, ' '));
    const h = 72 + view.height + (notes.length ? notes.length * 17 + 6 : 0) + 12, top = Math.round(GAME_HEIGHT * .45 - h / 2);
    const card = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay + 60).setName('rest-summary-card');
    const g = this.add.graphics(); lqPanel(g, cx - w / 2, top, w, h); lqDivider(g, cx, top + 58, 130);
    const head = this.add.text(cx, top + 32, '战 报', { fontFamily: TITLE_FONT, fontSize: '28px', color: RESULT_GOLD, resolution: 2 }).setOrigin(.5).setStroke(RESULT_STROKE, 5).setShadow(0, 3, '#000000', 4, true, true);
    view.root.setPosition(cx, top + 72);
    const note = this.add.text(cx, top + 72 + view.height + 2, notes.join('\n'), { fontFamily: FONT, fontSize: '12px', color: RESULT_IVORY, align: 'center', lineSpacing: 5, resolution: 2, wordWrap: { width: w - 60 } }).setOrigin(.5, 0).setStroke(RESULT_STROKE, 3).setAlpha(.85);
    // 测试与旧逻辑读 rest-summary 的文字、点它收起：保留同名文字对象作整张卡的命中区（透明）
    const hit = this.add.text(cx, top + h / 2, '战报\n' + lines.join('\n'), { fontFamily: FONT, fontSize: '12px', fixedWidth: w, fixedHeight: h }).setOrigin(.5).setAlpha(.001).setScrollFactor(0).setDepth(DEPTH.overlay + 61).setName('rest-summary').setInteractive({ useHandCursor: true });
    card.add([g, head, view.root, note]);
    for (const c of card.list) (c as unknown as { setScrollFactor: (v: number) => void }).setScrollFactor(0);
    for (const c of view.root.list) (c as unknown as { setScrollFactor: (v: number) => void }).setScrollFactor(0);
    const skip = playResultAnims(this, [{ start: 0, dur: 260, step: p => card.setAlpha(p) }, ...view.anims], () => {}, () => card.active);
    const close = () => { skip(); if (hit.active) hit.destroy(); if (card.active) card.destroy(); };
    // 1-3 告捷：章节告捷弹窗与战报同时出现会叠在一起——先看战报，收起后再显示告捷弹窗
    const notice = this.children.getByName('chapter1-volunteers') as Phaser.GameObjects.Container | null, held = !!notice?.visible;
    if (held) notice!.setVisible(false);
    hit.on('pointerdown', close).on('destroy', () => { if (card.active) card.destroy(); if (held && notice?.active) notice.setVisible(true); });
    if (view.levelUp) this.sfx.level();
    window.setTimeout(() => { if (hit.active) close(); }, 5600);
  }
  /** 测试 / 调试：直接打开所有等待中的首领宝箱。 */
  collectBossChests():void{for(const c of [...this.bossChests])c.collectNow();}
  private battleStage():number{return this.chapter.stage??this.chapter.westStage??3;}
  private recordFrontlineVictory(stage:number):void{
    this.frontlineVictories.set(stage,{elapsed:Math.max(0,(this.combatNow-(this.frontlineStarts.get(stage)??0))/1000)});
    // Settle only a contiguous defeated prefix. The current stage remains owned by finish().
    while(this.frontlineNextSettlement<this.battleStage()){
      const stage=this.frontlineNextSettlement,result=this.frontlineVictories.get(stage);if(!result)break;
      if(this.worldCampaign){settleExpedition(this.expeditionId,{chapter:this.chapter.id,victory:true,bossKilled:true,reason:'boss',elapsed:result.elapsed,kills:Math.max(0,this.kills-this.settledFrontlineKills),debug:isChapterTestRun()||this.debugModified||this.debugJumped||this.player.damageImmune});this.settledFrontlineKills=this.kills;this.expeditionId=beginExpedition(this.chapter.id,stage+1,this.allies.filter(a=>a.active&&a.reserveSoldier).map(a=>a.kind));}
      this.frontlineVictories.delete(stage);this.frontlineNextSettlement++;
    }
  }
  private clearChasingBosses():void{for(const t of this.chasingBosses){t.battle?.clear();t.huaxiong?.clear();t.xurong?.clear();t.label.destroy();}this.chasingBosses=[];}
  private advanceFrontline():void{
    const boss=this.boss,stage=this.battleStage();if(!boss?.active||stage>=3||this.runConfig.encounter)return;
    const name=this.chapter.bossName,label=this.add.text(boss.x,boss.y-100,name+' · 追兵',{fontFamily:FONT,fontSize:'15px',color:'#f0c58b',stroke:'#21160e',strokeThickness:3,resolution:2}).setOrigin(.5).setDepth(100);
    this.chasingBosses.push({enemy:boss,life:boss.spawnId,stage,name,battle:this.yellow,huaxiong:this.huaxiong,xurong:this.xurong,label});
    const next=(stage+1) as 2|3,west=this.chapter.id==='hulao';
    this.chapter=getBattleChapter(this.chapter.id,west?undefined:next,west?next:undefined);this.runConfig={...this.runConfig,stage:west?undefined:next,westStage:west?next:undefined};
    // 首领追击转下一关：先把本关没补完的保底补上（军略留在队列里），再给下一关重新计数
    this.ensurePicks(this.campaignReplay?PICK_GUARANTEE.side:PICK_GUARANTEE.main,true);this.picksGiven=0;this.lastPickAt=-1e9;this.frontlineStarts.set(next,this.combatNow);this.setupObjective();this.elapsed=0;this.waveIndex=0;this.boss=null;this.bossSpawned=false;this.bossWarned=false;this.bossKilled=false;this.firstBossAt=-1;this.bossShield=0;this.bossPhase2=false;this.bossEnergy=0;this.recruitedWaves.clear();this.spawnTimer=.2;this.huaxiong=null;this.xurong=null;this.zhangjiao?.clear();this.zhangjiao=null;
    this.yellow=west?null:new YellowBattle({scene:this,player:this.player,army:this.legion,enemies:this.enemies,move:(e,nx,ny,dt)=>this.advanceEnemy(e,nx,ny,dt),spawn:(def,x,y)=>this.spawnEnemy(def.kind,x,y,1,true,def)},next);
    // 战线推进与新一关第 1 波合成一条提示（原先“战线推进”下一帧就被第 1 波提示顶掉）
    const waves=this.chapter.waves,first=waves[0];
    this.hudTexts.wave.setText(`第 1/${waves.length} 波 · ${first.name}`);
    this.showWaveBanner(`第 1/${waves.length} 波 · ${first.name}`,true,`战线推进 · ${this.chapter.name} · 第 1/${waves.length} 波`);
    const march=this.add.graphics().setScrollFactor(0).setDepth(DEPTH.overlay-12);this.tweens.addCounter({from:0,to:1,duration:1100,onUpdate:t=>{const p=t.getValue()??0;march.clear().lineStyle(2,0xd5ae6b,Math.sin(p*Math.PI)*.45);for(let i=0;i<5;i++){const x=(p*GAME_WIDTH+i*GAME_WIDTH/5)%GAME_WIDTH;march.lineBetween(x-10,GAME_HEIGHT*.3,x,GAME_HEIGHT*.3+8).lineBetween(x,GAME_HEIGHT*.3+8,x-10,GAME_HEIGHT*.3+16);}},onComplete:()=>march.destroy()});
  }
  protected checkEnd(): void {
    if (this.over) return;
    if (!this.player.alive) {
      this.finish(false);
      return;
    }
    // 第六波 Boss 战不再限时：Boss 出现后只有击杀或玩家死亡结束
    if (!this.bossSpawned && (this.objective ? this.objective.failed || this.elapsed >= this.objective.o.limit : this.elapsed >= chapterBossTime(this.chapter) + 60)) this.finish(false, 'timeout');
  }

  /** 道具掉落的章节档：0 黄巾 / 1 讨董 / 2 群雄·攻守城 / 3 官渡 / 4 赤壁。 */
  protected itemTier(): number {
    const key = this.scene.key, arc = (this.runConfig as { arc?: string }).arc;
    return key === 'ChibiGameScene' || arc === 'chibi' ? 4 : key === 'GuanduGameScene' ? 3 : key === 'ThirdGameScene' || key === 'SiegeGameScene' ? 2 : this.chapter.id === 'hulao' ? 1 : 0;
  }
  /** 马厩赠马用的关卡键（见 data/mounts.ts HORSES.reward）；章节场景覆盖，攻城 / 军情为空。 */
  protected stableRewardKey(): string | null {
    if (this.runConfig.encounter || this.customChapter()) return null;
    return this.chapter.id === 'huangjin' ? 'huangjin-' + (this.chapter.stage ?? 3) : this.chapter.id === 'hulao' ? 'hulao-' + (this.chapter.westStage ?? 3) : null;
  }
  /** 首领遗珍掉落用的关卡键（默认同马厩赠马；吕布挑战关覆盖为 lubu）。 */
  protected bossRelicKey(): string | null { return this.stableRewardKey(); }
  /** 楼船令旗：穿着就开火船（12 秒一列），脱下就停。 */
  protected syncRelicShips(): void {
    const on = this.player.growth.gear.specials.includes('louchuan');
    if (on && !this.relicShips) this.relicShips = new FireShips({scene:this,enemies:()=>this.enemies,player:()=>this.player,boss:()=>this.boss??undefined,burn:(e,dmg,now)=>{this.hitEnemy(e,dmg,now,'fire',true,false);},announce:t=>this.showGrowthNotice('楼船令旗 · '+t)},this.combatNow,{interval:RELIC.louchuanMs,first:RELIC.louchuanFirst});
    else if (!on && this.relicShips) { this.relicShips.clear(); this.relicShips = null; }
  }
  /** 伪帝玺：新开一场时直接送 1 张随机战法（Lv1，计流派件数）。2026-11-17 宝物并入信物库后由「送宝物」改来。 */
  protected grantWeixiTreasures(): void {
    const b = this.player.growth.build; if (!this.player.growth.gear.specials.includes('weixi')) return;
    const pool = (Object.keys(TACTICS) as TacticId[]).filter(id => b.level(id) === 0 && b.canLearn(id));
    if (pool.length) b.learn(pool[Math.floor(Math.random() * pool.length)]);
  }
  /**
   * 武将等级（跨战斗永久，HeroProgress）：开局读入永久属性点。同章连打（transfer）时保留本局额外加的点（如城池加成），
   * 生命按原比例换算；新开一场则回满。局内升级只出三选一（战功），不再给属性点。
   */
  /** 武将等级（开局读入，HUD 显示用）。 */
  protected heroLv = 1;
  protected applyHeroLevel(carried: boolean): void {
    this.heroLv = heroLevel(this.runConfig.character);
    const id = this.runConfig.character, g = this.player.growth, r = enlistHero(id), ratio = this.player.hp / Math.max(1, this.player.maxHp);
    const bonusLeft = Math.max(0, g.unallocated - g.heroFree);
    for (const a of Object.keys(g.attributes) as AttributeId[]) g.attributes[a] = Math.min(ATTRIBUTE_MAX, r.attributes[a] + Math.max(0, (carried ? g.attributes[a] : 0) - r.attributes[a]));
    g.heroFree = heroFreePoints(id);
    const room = (Object.values(g.attributes) as number[]).reduce((n, v) => n + ATTRIBUTE_MAX - v, 0);
    g.unallocated = Math.min(room, g.heroFree + (carried ? bonusLeft : 0));
    // 武将谱：本命淬炼、战法心得（新开一场时开局第一次升级保证出一张心得卡）
    g.temperDamage = temperBonus(id); g.xinde = getXinde(id); if (!carried) g.xindeFirst = g.xinde.length > 0;
    this.player.passive.areaMul = g.areaMultiplier();
    // 属性改版（四项）：老存档的点数已全部退回，提示一次
    if (takeAttrNotice()) this.time.delayedCall(1200, () => this.showGrowthNotice('属性已改版：点数已全部返还，暂停 →「分配属性点」重新分配'));
    this.player.hp = carried ? Math.max(1, Math.min(this.player.maxHp, Math.round(this.player.maxHp * ratio))) : this.player.maxHp;
  }
  /** 经验倍率（2026-11-17 只留武将等级）：主线首次打 1.0；攻城 / 军情 / 挑战 / 重打旧关 0.5。 */
  protected heroXpRate(): number { return ['GameScene', 'ThirdGameScene', 'GuanduGameScene', 'ChibiGameScene'].includes(this.scene.key) && !(this.scene.key === 'GameScene' && this.runConfig.encounter) && !this.campaignReplay ? HERO_XP_RATE.main : HERO_XP_RATE.side; }
  /** 测试 / 调试战斗：不写武将等级、不记经验。 */
  protected debugRun(): boolean { return isChapterTestRun() || this.debugModified || this.debugJumped || !!this.player.damageImmune; }
  /** 本场开打时的武将等级（结算显示 Lv.a → Lv.b）。 */
  protected heroStartLevel = 1;
  /** 本关已给的三选一次数（升级 + 军略），与等待中的军略次数。 */
  protected picksGiven = 0; protected militaryPending = 0;
  /** 三选一节奏（PICK_PACE）：本关上次开面板的关内时刻；forcePickNow = 宝箱 / 转关补发，不等间隔；pickBatch = 本面板一共连选几张。 */
  protected lastPickAt = -1e9; protected forcePickNow = false; protected pickBatch = 0; protected pickBatchDone = 0;
  /** 第二章起套用三选一节奏（第一章新手期照旧）。 */
  protected paceOn(): boolean { return this.chapter?.id !== 'huangjin' && PICK_PACE.fromChapter >= 2; }
  protected pickGapOk(): boolean { return !this.paceOn() || this.forcePickNow || this.elapsed - this.lastPickAt >= PICK_PACE.minGapSec; }
  /** 开局：局内等级 / 经验就是武将等级 / 经验。 */
  protected syncHeroLevel(): void {
    const info = heroInfo(this.runConfig.character);
    this.player.level = info.level; this.player.xp = info.xp; this.player.xpNext = info.next; this.heroLv = info.level; this.heroStartLevel = info.level;
  }
  /** 战斗中武将升级：每级一次三选一并给 1 个属性点（正式战斗立刻写入存档）。 */
  protected onHeroLevelUp(gained: number): void {
    const g = this.player.growth, id = this.runConfig.character;
    this.heroLv = this.player.level; this.picksGiven += gained; this.pendingLevels += gained;
    const room = (Object.values(g.attributes) as number[]).reduce((n, v) => n + ATTRIBUTE_MAX - v, 0) - g.unallocated;
    if (!this.debugRun()) { setHeroProgress(id, this.player.level, this.player.xp); g.heroFree += gained; }
    g.unallocated += Math.max(0, Math.min(gained, room));
    if (this.mode === 'none' && this.pickGapOk()) this.openUpgrade();
  }
  /** 本关保底：三选一次数不够 target 时补「军略」（同一个三选一，不给属性点）。 */
  protected ensurePicks(target: number, force = false): void {
    if (this.over || !this.player?.alive) return;
    const cap = this.campaignReplay ? PICK_GUARANTEE.side : PICK_GUARANTEE.main, need = Math.min(target, cap) - this.picksGiven;
    if (need <= 0) return;
    this.picksGiven += need; this.militaryPending += need; this.pendingLevels += need;
    if (force) this.forcePickNow = true;
    if (this.mode === 'none' && this.pickGapOk()) this.openUpgrade();
  }
  /** 首次通关经验（不乘折算比例），结算时由 claimFirstClear 给出。 */
  protected heroXpBonus = 0;
  /** 主公本场的武将经验 = 本场经验（已乘倍率）+ 首次通关经验（随行各拿一半）。 */
  protected lordHeroXp(): number { return this.player.runXp + this.heroXpBonus; }
  /** 换装后重算兵装加成：生命按原比例换算，不因换装回满血。 */
  protected refreshGear(): void {
    const ratio = this.player.maxHp > 0 ? this.player.hp / this.player.maxHp : 1;
    this.player.growth.gear = gearFor(this.runConfig.character);
    this.relics?.setSpecials(this.player.growth.gear.specials, this.combatNow); this.syncRelicShips();
    this.charmInfo = applyCharms(this.player, wornTokens(this.runConfig.character));
    this.player.hp = Math.max(1, Math.min(this.player.maxHp, Math.round(this.player.maxHp * ratio)));
  }
  /** 战斗中打开行囊：自动暂停，关掉后恢复（从暂停菜单进来则回到暂停菜单）。atRest = 行营休整中，可换马。 */
  protected openBattleBag(atRest = false): void {
    // 行营休整发生在本关结算之后（this.over 已为真）：休整时照样能开行囊（2026-11-17 用户报「休整时行囊点不了」）
    if ((this.over && !atRest) || this.children.getByName('item-bag')) return;
    const fromPlay = this.mode === 'none';
    if (fromPlay) this.togglePause();
    const debug = isChapterTestRun() || this.debugModified || this.debugJumped || !!this.player.damageImmune || !!this.runConfig.encounter;
    new ItemBagUI(this, {
      hero: this.runConfig.character, battle: true, atRest, runLoot: this.over ? [] : this.itemDrops?.runLoot ?? [],
      // 已结算时缴获都收进行囊了，不再单列「本局缴获」
      claimLoot: debug || this.over ? undefined : (item: ItemInstance) => { if (!claimRunLoot(this.runConfig.character, item)) return false; this.itemDrops?.takeLoot(item.uid); return true; },
      onGearChange: () => this.refreshGear(),
      onClose: () => { if (fromPlay && this.mode === 'pause') this.togglePause(); },
    });
  }
  /** 本关首领是否为章节最终首领（必掉 2 件）。 */
  protected isFinalBoss(): boolean { return this.chapter.stage === 3 || (this.chapter.id === 'hulao' && (this.chapter.westStage ?? 3) === 3); }

  protected finish(victory: boolean, reason: RunEndReason = 'death'): void {
    if (this.over) return;
    this.over = true;
    commitBattle(); // 告捷（战报）与战败都按现行规则结算，本场写入生效
    this.player.passive.stop();
    // 动作层：胜利举兵器 / 战败倒地（有素材的武将才播放，播完定格）
    this.player.playAction(victory ? 'win' : 'die', 'down');
    this.legion.stop();
    buildVfx(this).clear();
    this.awakeningCombat?.clear();
    this.bulwarkBuild?.clear();
    this.controlBuild?.clear();
    this.reinforcements.clear();
    this.victory = victory;
    const jingle = this.music.endBattle(victory); // BGM v2：胜利 / 败退短曲接在战斗曲后
    this.lubu?.clear();this.zhangjiao?.clear();this.zhangjiao=null;this.huaxiong?.clear();this.xurong?.clear();this.yellow?.clear();this.xiliang?.clear();this.clearChasingBosses();this.supplies?.clear();if(victory)this.itemDrops?.collectAll();this.itemDrops?.clear();
    if(victory&&this.chapter.stage===3)this.finaleFadeMs=800;
    this.feedback.clearAttacks();
    if (!jingle) { if (victory) this.sfx.win(); else this.sfx.lose(); }
    this.cameras.main.flashEffect.reset();this.cameras.main.shakeEffect.reset();
    this.setMode('result');
    const stats: RunStats = {
      victory,
      reason,
      elapsed: this.elapsed,
      kills: this.kills,
      level: this.player.level,
      damageDealt: this.damageDealt,
      bossKilled: this.bossKilled,
    };
    const title = victory ? this.chapter.victoryTitle : reason === 'timeout' ? '时间耗尽' : '败走';
    const subtitle = victory ? this.chapter.victoryText : reason === 'timeout' ? `${this.chapter.bossName}未破，退守待援` : '乱军之中，力战而退';
    this.resultTexts.title.setText(title).setColor(victory ? '#e8c76a' : '#d24b3f');
    this.resultTexts.subtitle.setText(subtitle);
    const row = (label: string, value: string): string => {
      const pad = label.length >= 4 ? '' : '　'.repeat(4 - label.length);
      return `${label}${pad}  ${value}`;
    };
    this.resultTexts.body.setText(
      [
        row('存活时间', this.formatTime(stats.elapsed)),
        row('击杀敌军', String(stats.kills)),
        row('等级', `Lv.${stats.level}`),
        row('造成伤害', String(Math.round(stats.damageDealt))),
        row('军团战损', `${this.legion.count}存活 / ${this.legion.dead}阵亡`),
        row(this.chapter.bossName, stats.bossKilled ? '已击败' : '未击败'),
        row('结局', victory ? '讨伐成功' : reason === 'timeout' ? '超时' : '阵亡'),
      ].join('\n'),
    );
    // 兵装缴获：胜利或坚持 60 秒带回全部，速败只带回一半；测试 / 调试战斗不入行囊
    {const loot=this.itemDrops?.runLoot??[],debug=isChapterTestRun()||this.debugModified||this.debugJumped||!!this.player.damageImmune||!!this.runConfig.encounter,dep=depositRunLoot(loot,{victory,elapsed:this.elapsed,debug,pity:this.itemDrops?.pity});
     if(loot.length)this.resultTexts.body.setText(this.resultTexts.body.text+'\n缴获兵装  '+loot.length+' 件（'+this.itemDrops!.summary()+'）'+(debug?' · 测试战斗不入行囊':dep.lost?' · 败退遗失 '+dep.lost+' 件':' · 已收入行囊'));}
    if(this.worldCampaign){const reward=settleExpedition(this.expeditionId,{...stats,kills:Math.max(0,stats.kills-this.settledFrontlineKills),chapter:this.chapter.id,returned:this.allies.filter(a=>a.active&&a.reserveSoldier).map(a=>a.kind),debug:isChapterTestRun()||this.debugModified||this.debugJumped||this.player.damageImmune});
      this.resultTexts.body.setFontSize(IS_DESKTOP?14:16).setLineSpacing(IS_DESKTOP?5:8).setText(this.resultTexts.body.text+`\n永久奖励  军粮 +${reward.provisions}`+cityIncomeLine(reward));
      this.resultTexts.subtitle.setText(victory&&this.chapter.id==='huangjin'&&this.chapter.stage===3&&worldUnlocked()?'黄巾平定 · 三国天下开启':victory?this.chapter.victoryText:reward.message);
    }
    // 讨董告捷：回天下地图并聚焦新解锁的「群雄割据」（地图自第一章起已开放，不再重复「天下开启」揭幕）
    if(victory&&!this.runConfig.encounter&&this.chapter.id==='hulao'&&this.chapter.westStage===3&&worldUnlocked())this.registry.set('mapFocusNode','qunxiong');
    if(!this.runConfig.encounter)recordChapterVictory({ stage:this.chapter.stage,chapter: this.chapter.id, victory, reason, bossKilled: this.bossKilled,
      debug: isChapterTestRun() || this.debugModified || this.debugJumped || this.player.damageImmune });
    // 武将等级：本场经验折进武将经验（测试 / 调试战斗不记）
    {const debug=isChapterTestRun()||this.debugModified||this.debugJumped||!!this.player.damageImmune;
     // 主线关首次通关经验（每关一次），并进本场经验一起折算，随行也按一半分到
     const firstClear=!debug&&victory&&this.bossKilled?claimFirstClear(this.stableRewardKey()):0;if(firstClear){this.heroXpBonus=firstClear;this.itemDrops?.gainScrolls(SCROLL.firstClear);this.resultTexts.body.setText(this.resultTexts.body.text+'\n首次通关  经验 +'+firstClear);}
     if(!debug&&this.lordHeroXp()>0){const id=this.runConfig.character,name=getCharacter(id).name;
      // 战斗中升的级已随时写入；这里写入当前经验，再加首次通关经验（可能再升级）
      setHeroProgress(id,this.player.level,this.player.xp);const r=creditHeroXp(id,this.heroXpBonus);
      const grain=addProvisions(r.grain+Math.floor(this.player.overflowXp/OVERFLOW_XP_PER_GRAIN));
      this.resultTexts.body.setText(this.resultTexts.body.text+'\n武将等级  '+name+(r.to>this.heroStartLevel?' Lv.'+this.heroStartLevel+' → Lv.'+r.to:' Lv.'+r.to)+' · 经验 +'+Math.round(this.lordHeroXp())+(r.capped?' · 已到本章上限 Lv.'+r.cap:'')+(grain>0?'\n经验已满  折军粮 +'+grain:''));
      // 随行武将：每人拿主公折算后经验的一半（hero-level-proposal 方案 A，用户批准）
      const half=this.lordHeroXp()/2,lines:string[]=[];for(const f of this.followers?.members??[]){const fr=creditHeroXp((f.recruit.hero??f.recruit.id) as HeroKey,half,followerLevelCap()) /* 随行经验到随行上限为止 */,fn=f.recruit.name.replace(/（.*）/,'');lines.push(fr.to>fr.from?fn+' Lv.'+fr.from+' → Lv.'+fr.to:fn+' Lv.'+fr.to);}
      if(lines.length)this.resultTexts.body.setText(this.resultTexts.body.text+'\n随行  '+lines.join(' · ')+' · 各得经验 +'+Math.floor(half));}}
    // 征程构筑：主线首次打赢这一关（首领已破）时存档，作为下一关的起点；重打旧关 / 测试战斗不存
    if(victory&&this.bossKilled&&!this.campaignReplay&&!(isChapterTestRun()||this.debugModified||this.debugJumped||this.player.damageImmune))saveCampaignBuild(this.runConfig.character,packCampaign(this.runConfig.character,this.player,this.legion,this.followers));
    // 战功：本场击杀精英 / 首领所得，存进存档（不论胜败；测试 / 调试战斗不计），去讲武堂换残卷
    if(!(isChapterTestRun()||this.debugModified||this.debugJumped||this.player.damageImmune))this.settleMerit();
    // 武将谱：本局武学残卷收入（测试 / 调试战斗不收）
    {const n=this.itemDrops?.scrolls??0,debug=isChapterTestRun()||this.debugModified||this.debugJumped||!!this.player.damageImmune;if(n>0&&!debug){const total=addScrolls(n);this.resultTexts.body.setText(this.resultTexts.body.text+'\n武学残卷  +'+n+'（共 '+total+'）');}}
    // 马厩：各章首领首次击杀赠马（第一章通关送驽马由 ItemStore 读档时补发）
    {const key=victory&&this.bossKilled&&!(isChapterTestRun()||this.debugModified||this.debugJumped||this.player.damageImmune)?this.stableRewardKey():null,horse=key&&!(key==='huangjin-3'&&this.merchantStoryDue())?horseForReward(key):undefined; // 第一章首通：驽马改由告捷后的献马剧情送出
     if(horse&&grantHorse(horse.id))this.resultTexts.body.setText(this.resultTexts.body.text+'\n获得坐骑  '+horse.name+' · 已入马厩（休整时可换马）');}
    const nextWest=victory&&this.worldCampaign&&!this.runConfig.encounter&&((this.chapter.id==='huangjin'&&this.chapter.stage===3)?1:(this.chapter.id==='hulao'&&(this.chapter.westStage??3)<3)?(this.chapter.westStage??1)+1:0);
    const canAdvance=!!nextWest&&dongzhuoStageUnlocked(nextWest);
    const openedMap=victory&&this.worldCampaign&&this.chapter.id==='hulao'&&(this.chapter.westStage??3)===3&&worldUnlocked();
    const homeLink=this.resultPanel.getByName('result-home') as Phaser.GameObjects.Text|null;
    this.resultPanel.getByName('result-restart')?.setActive(victory);(this.resultPanel.getByName('result-restart') as Phaser.GameObjects.Image)?.setVisible(victory);(this.resultPanel.getByName('result-restart-text') as Phaser.GameObjects.Text)?.setVisible(victory);
    homeLink?.setText(!victory?'返回主菜单':canAdvance?`下一关 · ${nextWest===1?'汜水关':nextWest===2?'荥阳':'虎牢关'}`:openedMap?(openChapterCount(loadWorldState())>loadWorldState().chapterSeen?'天下地图 · 新篇解锁':'返回天下地图'):this.worldCampaign&&worldUnlocked()?"返回营寨":'返回选关');
    homeLink?.removeAllListeners('pointerdown').on('pointerdown',()=>{
      if(!victory){this.registry.remove('campaignTransfer');this.registry.remove('menuChapterPicker');this.scene.start('MenuScene');return;}
      if(canAdvance){this.registry.remove('campaignTransfer');const {encounter:_preview,...config}=this.runConfig;this.registry.set('runConfig',{...config,chapter:'hulao',stage:undefined,westStage:nextWest});this.scene.restart();return;}
      if(this.worldCampaign&&worldUnlocked())this.scene.start(openedMap||this.registry.get('worldReveal')?'WorldMapScene':'CityScene');
      else {this.registry.set('menuChapterPicker',true);this.scene.start('MenuScene');}
    });
    this.layoutResultButtons?.();
    // 电脑版结算展示：子类 finish 还会追加结算文字，等本轮调用结束再解析
    if (IS_DESKTOP) queueMicrotask(() => { if (this.sys?.isActive() && this.mode === 'result') this.presentResult(victory); });
    this.onRunFinished(stats);
    // 成就：战斗结果与天下 / 城镇状态（测试战斗、调试改动过的战斗不计）
    onBattleEnd({victory,debug:isChapterTestRun()||this.debugModified||this.debugJumped||!!this.player.damageImmune||!!this.runConfig.encounter,kills:this.kills,level:this.player.level,hero:this.runConfig.character,chapter:this.chapter.id,stage:this.chapter.stage,westStage:this.chapter.westStage,arc:this.achievementArc(),bossKilled:this.bossKilled});
    try{checkWorld(loadWorldState());}catch{/* 存档不可用 */}
    // 乱世难度首通（该章第三关击败首领）：一次性军粮与称号
    if(victory&&this.hardMode&&this.bossKilled&&this.hardStage()===3&&!isChapterTestRun()&&!this.debugModified&&!this.debugJumped&&!this.player.damageImmune){const key=this.hardKey() as TimelineChapterId;if(recordHardClear(key,HARD_MODE.reward))this.resultTexts.body.setText(this.resultTexts.body.text+`
乱世首通 · 称号「${HARD_TITLES[key]}」 · 军粮 +${rewardGrain(HARD_MODE.reward.merits,HARD_MODE.reward.provisions)}`);}
    if (victory && !this.runConfig.encounter && (this.chapter.id==='huangjin'||(this.chapter.westStage??3)<3)) {
      this.showRestSummary();
      this.cameras.main.flashEffect.reset(); this.cameras.main.shakeEffect.reset();
      this.pendingRecruit = false; this.pendingLevels = 0; this.freeRecruit = false; this.resting = true;
      this.renderRecruit(); /* 2026-11-18 用户：受的伤跨关继承，休整不再自动回满（主将 / 部曲），改由「军医」花随军粮治疗 */ this.legionUI.setCampDestination(this.chapter.id==='hulao'?((this.chapter.westStage??1)===1?'荥阳之战':'虎牢关决战'):this.chapter.stage===3?'第二章 · 汜水关':this.chapter.stage===1?'下曲阳破阵':'广宗决战',this.chapter.id==='hulao'?'讨董军营 · 战后休整':'黄巾败退 · 战后休整'); this.setMode('rest');
      if(this.chapter.stage===3){
        this.legionUI.panel.setVisible(false);
        // 第一章通关即开启天下地图：告捷后进入地图，按史事时序选章出征（讨董起逐章解锁）。
        // 未记入进度的调试 / 测试战斗（地图未开）仍走旧流程：进军营整顿后直赴汜水关。
        const toMap=this.chapter.id==='huangjin'&&worldUnlocked();
        const notice:Phaser.GameObjects.Container=chapterVictoryNotice(this,GAME_WIDTH,GAME_HEIGHT,IS_DESKTOP,{name:'chapter1-volunteers',confirmName:'volunteers-confirm',
          kicker:'第一章 · 黄巾之乱 告捷',title:toMap?'黄巾平定 · 天下地图开启':'黄巾平定 · 义士来投',
          lines:toMap?['将军威名远扬，四方义士前来投靠。','天下大势初现：于地图上按史事逐章出征。']:['将军威名远扬，四方义士前来投靠。','且回军营整顿兵马，再赴讨董征途。'],
          route:toMap?['黄巾告捷','天下地图','讨伐董卓']:['整顿兵马','补充援兵','汜水讨董'],confirm:toMap?'确认 · 展开天下地图':'确认 · 进入军营',background:'rest_camp',
          onConfirm:()=>{notice.destroy();if(toMap&&this.merchantStoryDue()){this.showMerchantHorseStory(()=>this.showChapter1MapAfterStory());return;}if(toMap){this.resting=false;this.registry.remove('campaignTransfer');this.registry.set('worldReveal',true);this.registry.set('mapFocusNode','hulao');this.scene.start('WorldMapScene');return;}this.legionUI.panel.setVisible(true);}});
        // 入营水墨过场在 setMode('rest') 时已开始，告捷弹窗晚于它创建：过场期间先隐藏，墨迹揭开时再显示（reveal 里处理）。
        if(this.children.getByName('rest-intro'))notice.setVisible(false);
      }
    }
  }

  /** 第一章首次通关剧情是否该播：本场开打时还没有驽马、剧情没看过、不是调试 / 测试战斗。 */
  protected merchantStoryDue(): boolean { return !this.hadStarterHorse && !merchantStorySeen() && !(isChapterTestRun() || this.debugModified || this.debugJumped || this.player.damageImmune); }
  /** 「中山商旅 · 献马」：张世平、苏双献驽马，马厩开放（只送一次；读档补发驽马的兜底仍在 ItemStore）。 */
  showMerchantHorseStory(onDone: () => void): Phaser.GameObjects.Container {
    const c = getCharacter(this.runConfig.character);
    return storyScroll(this, GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP, { name: 'story-merchant-horse', confirmName: 'story-merchant-confirm', kicker: '第一章 · 黄巾之乱 · 战后', title: '中山商旅 · 献马',
      lines: merchantHorseLines(c.name, c.id === 'liubei'), reward: MERCHANT_HORSE_REWARD, confirm: '收下 · 展开天下地图', background: 'rest_camp', illustration: 'story_merchant_horse',
      onDone: () => { markMerchantStorySeen(); grantHorse(STARTER_HORSE); onDone(); } });
  }
  private showChapter1MapAfterStory(): void { this.resting = false; this.registry.remove('campaignTransfer'); this.registry.set('worldReveal', true); this.registry.set('mapFocusNode', 'hulao'); this.scene.start('WorldMapScene'); }
  /** 乱世难度用：本场所属章节（黄巾 / 讨董取 chapter.id，群雄 / 官渡 / 赤壁取战线）。 */
  protected hardKey(): string { return this.achievementArc() ?? this.chapter.id; }
  /** 乱世难度用：本场是该章第几关。 */
  protected hardStage(): number { const k = this.hardKey(), key = k === 'qunxiong' ? 'thirdStage' : k === 'guandu' ? 'guanduStage' : k === 'chibi' ? 'chibiStage' : k === 'jingnan' ? 'jingnanStage' : k === 'shu' ? 'shuStage' : k === 'hanzhong' ? 'hanzhongStage' : k === 'xiangfan' ? 'xiangfanStage' : k === 'yiling' ? 'yilingStage' : k === 'nanzheng' ? 'nanzhengStage' : k === 'beifa' ? 'beifaStage' : ''; return key ? Number(this.registry.get(key) ?? 1) : this.battleStage(); }
  /** 成就用：本场属于哪条战线（攻城 / 守城 / 群雄 / 官渡由子类返回）。 */
  protected achievementArc(): string | undefined { return undefined; }
  /** 手柄锁定目标：子类（有敌营 / 粮草的战场）返回可锁定列表。 */
  protected padTargets(): Array<{dist: number; current: boolean; select: () => void}> { return []; }
  protected padClearTargets(): void {}

  protected formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ---------------- HUD ----------------

  protected buildHud(): void {
    this.hudGfx = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    const style = (size: number, color: string) => warText(size, color);
    this.hudTexts = {
      hp: this.add.text(206, 43, '', style(14, '#f5efe6')).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1),
      level: this.add.text(28, 23, 'Lv.1', style(16, '#e8c76a')).setScrollFactor(0).setDepth(DEPTH.hud + 1),
      wave: this.add.text(28, 88, '', style(15, '#d8c9ae')).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1),
      timer: this.add.text(GAME_WIDTH / 2, 22, '00:00', style(25, '#f5efe6')).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1),
      kills: this.add.text(GAME_WIDTH - 24, 74, '击杀 0', style(14, '#a9bba9')).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1),
      chapter: this.add.text(GAME_WIDTH / 2, 56, this.chapter.name, style(14, '#93b6a2')).setOrigin(.5,0).setScrollFactor(0).setDepth(DEPTH.hud + 1),
      boss: this.add.text(GAME_WIDTH / 2, 66, this.chapter.bossName, style(15, '#e8c76a')).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1).setVisible(false),
      bossHp: this.add.text(GAME_WIDTH / 2, 66, '100%', style(13, '#f5efe6')).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1).setVisible(false),
      bossEnergy: this.add.text(GAME_WIDTH / 2, 100, '', style(11, '#c9a8ff')).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1).setVisible(false),
      mute: this.add
        // 2026-11-15：音效 / 音乐开关常驻右上（原藏在「战况」下拉里）
        .text(GAME_WIDTH - 24, 100, '音效:开', style(13, '#e3d3b0'))
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.hud + 1)
        .setPadding(8, 4, 8, 4)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const muted = this.sfx.toggle();
          this.muteText?.setText(muted ? '音效:关' : '音效:开');
        }),
      music: this.add
        .text(GAME_WIDTH - 24, 132, '音乐:开', style(13, '#e3d3b0'))
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.hud + 1)
        .setPadding(8, 4, 8, 4)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const muted = this.music.toggle();
          this.hudTexts.music.setText(muted ? '音乐:关' : '音乐:开');
        }),
      bag: this.add
        // 2026-11-16：行囊常驻右上（用户反馈「背包需要放出来」），点开即暂停，可换装
        .text(GAME_WIDTH - 24, 166, '行囊', style(15, '#ffe9bd'))
        .setOrigin(1, 0).setFixedSize(66, 30).setAlign('center')
        .setScrollFactor(0)
        .setDepth(DEPTH.hud + 1)
        .setPadding(4, 5, 4, 3)
        .setName('hud-bag')
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { if ((this.mode === 'none' && !this.over) || this.mode === 'pause') this.openBattleBag(); }),
      pause: this.add
        .text(GAME_WIDTH - 24, 20, IS_DESKTOP ? '设置' : '暂停', style(17, '#ead39b')).setFixedSize(76,62).setAlign('center').setStroke('#10180f',2)
        .setOrigin(1, 0)
        .setPadding(8, 18, 8, 18)
        .setScrollFactor(0)
        .setDepth(DEPTH.hud + 1)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.togglePause()),
    };
    attrBadge(this, 196, 31, this.runConfig.character, 20, { scrollFactor: 0, depth: DEPTH.hud + 2 })?.setName('hud-attr-badge'); // 主将主属性印（ui/AttrBadge.ts）
    this.hudTexts.details = this.add.text(GAME_WIDTH - 24, 94, '战况 ▾', style(13, '#dfcfab'))
      .setOrigin(1,0).setFixedSize(96,62).setAlign('center').setPadding(10,12).setScrollFactor(0).setDepth(DEPTH.hud+1)
      .setVisible(false); // 「战况」下拉已取消（用户反馈不需要）；音效 / 音乐开关改为常驻
    this.hudTexts.gear = this.add.text(32, 236, '', {...style(12,'#dfd5bc'),wordWrap:{width:GAME_WIDTH>600?370:GAME_WIDTH-72},lineSpacing:4})
      .setScrollFactor(0).setDepth(DEPTH.hud+1);
    for (const k of ['pause', 'mute', 'music', 'bag'] as const) this.hudTexts[k]
      .on('pointerover', () => { this.hudChipState[k] = 'hover'; }).on('pointerout', () => { this.hudChipState[k] = 'idle'; })
      .on('pointerdown', () => { this.hudChipState[k] = 'down'; }).on('pointerup', () => { this.hudChipState[k] = 'hover'; });
    this.passiveHud = new PassiveHud(this); this.heroBark = new HeroBark(this); this.zhaoyunFx = new ZhaoyunPassiveFx(this); this.passiveShout = new PassiveShout(this, { sfx: () => this.sfx.play('passiveFull'), nearby: (x, y, r) => this.grid.query(x, y, r).filter(e => Math.hypot(e.x - x, e.y - y) <= r) });
    this.buffHud=new BuffHud(this);
    this.muteText = this.hudTexts.mute;
    this.muteText.setText(this.sfx.muted ? '音效:关' : '音效:开');
    this.hudTexts.music.setText(this.music.mutedState ? '音乐:关' : '音乐:开');
    // 2026-11-17 用户「暂停改成设置」：电脑版右上只留「设置」，音效 / 音乐挪进设置面板；行囊顶到原音效位
    if (IS_DESKTOP) { this.hudTexts.mute.setVisible(false).disableInteractive(); this.hudTexts.music.setVisible(false).disableInteractive(); this.hudTexts.bag.setY(100); }
    this.hudTexts.relics = this.add
      .text(28, 308, '', style(12, '#cfc3b0')).setWordWrapWidth(GAME_WIDTH - 56)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 1)
      .setPadding(4, 2, 4, 2)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.relicExpanded = !this.relicExpanded; });
    {
      // 电脑布局右列自上而下：暂停 20–82、音效 100、音乐 132、行囊 166–196、用药 218–301、加点 316–399、护阵 / 出击 412（2026-11-16 修「用药和行囊叠在一起」）
      const bx=GAME_WIDTH-58,by=IS_DESKTOP?GAME_HEIGHT-190:GAME_HEIGHT-240,root=this.add.container(bx,by).setScrollFactor(0).setDepth(DEPTH.hud+4).setName('attribute-plus').setVisible(false);
      const glow=this.add.circle(0,0,33,0xffd27a,0).setStrokeStyle(3,0xffd27a,.55);
      const disc=this.add.circle(0,0,29,0x1b241b,.94).setStrokeStyle(2,0xd8b56a,1);
      const icon=this.add.image(0,-1,this.textures.exists('growth_icon_points')?'growth_icon_points':'icon_passive').setDisplaySize(40,40);
      const bubble=this.add.circle(21,-21,11,0xb8322a,1).setStrokeStyle(1.5,0xffe2a4,1);
      this.pointsBadge=this.add.text(21,-21,'0',{fontFamily:FONT,fontSize:'13px',color:'#fff6e0',resolution:2,fontStyle:'bold'}).setOrigin(.5);
      const caption=this.add.text(0,40,'加点',{fontFamily:FONT,fontSize:'13px',color:'#ffe2a4',resolution:2,stroke:'#17140d',strokeThickness:3}).setOrigin(.5);
      root.add([glow,disc,icon,bubble,this.pointsBadge,caption]);
      root.setInteractive(new Phaser.Geom.Circle(0,0,34),Phaser.Geom.Circle.Contains).on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{event?.stopPropagation?.();if(this.mode==='none'&&!this.over&&this.player.growth.unallocated>0){this.attributeReturn='none';this.renderAttributePanel();this.setMode('attributes');}});
      if(root.input)root.input.cursor='pointer';
      this.tweens.add({targets:glow,scale:1.18,alpha:{from:.9,to:.15},duration:900,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
      this.pointsButton=root;
    }
    {
      // 用药按钮：在加点按钮上方；药囊有药时显示，满血或上一份药未回完时变暗
      const root=this.add.container(GAME_WIDTH-58,IS_DESKTOP?GAME_HEIGHT-288:GAME_HEIGHT-340).setScrollFactor(0).setDepth(DEPTH.hud+4).setName('potion-button').setVisible(false);
      // 2026-11-17 用户「用药的ui图标也改一下」：手绘药罐 + 漆底描金圆框（同 HUD 其他漆金按钮），数字角标朱砂底金边
      const glow=this.add.circle(0,0,33,0xff7a4a,0).setStrokeStyle(3,0xf3d48a,.55);
      const disc=this.add.circle(0,0,29,0x1b120b,.95).setStrokeStyle(2.5,0xc9a35e,1);
      const ring=this.add.circle(0,0,24,0x000000,0).setStrokeStyle(1,0xf3d48a,.45);
      const potionKey=potionTexture(this),icon=this.add.image(0,-1,potionKey).setDisplaySize(potionKey==='healing_potion'?30:42,potionKey==='healing_potion'?36:42);
      const bubble=this.add.circle(21,-21,11,0x9a2a1c,1).setStrokeStyle(1.5,0xf3d48a,1);
      this.potionBadge=this.add.text(21,-21,'0',{fontFamily:FONT,fontSize:'13px',color:'#fff6e0',resolution:2,fontStyle:'bold'}).setOrigin(.5);
      const caption=this.potionCaption=this.add.text(0,40,'用药',{fontFamily:FONT,fontSize:'13px',color:'#ffe2a4',resolution:2,stroke:'#17140d',strokeThickness:3}).setOrigin(.5);
      root.add([glow,disc,ring,icon,bubble,this.potionBadge,caption]);
      root.setInteractive(new Phaser.Geom.Circle(0,0,34),Phaser.Geom.Circle.Contains).on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{event?.stopPropagation?.();this.usePotion();});
      if(root.input)root.input.cursor='pointer';
      this.tweens.add({targets:glow,scale:1.2,alpha:{from:.95,to:.2},duration:600,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
      this.potionButton=root;this.potionIcon=icon;this.potionGlow=glow;
    }
    this.relicIcons = [];
  }

  protected updateHud(): void {
    if (this.hudAcc < .1 && this.lastHudMode === this.mode) return;
    this.hudAcc = 0; this.lastHudMode = this.mode;
    const overlay = this.mode !== 'none';
    if(this.potionButton&&this.supplies){
      const bag=this.supplies.pouch,next=bag[0],can=this.supplies.canUsePotion,low=this.player.hp<this.player.maxHp*.4;
      this.potionButton.setVisible(!overlay&&!this.over&&bag.length>0).setAlpha(can?1:.5);
      this.potionBadge?.setText(String(bag.length));
      {const tk=next?potionTexture(this,next.texture):'';if(next&&this.potionIcon&&(this.potionIcon.texture.key!==tk||(next.frame!==undefined&&this.potionIcon.frame.name!==String(next.frame))))this.potionIcon.setTexture(tk,tk===next.texture?next.frame:undefined).setDisplaySize(tk==='heal_props'?40:tk==='healing_potion'?30:42,tk==='heal_props'?40:tk==='healing_potion'?36:42);}
      this.potionGlow?.setVisible(can&&low);
    }
    this.pointsBadge?.setText(String(Math.min(99,this.player.growth.unallocated)));if(this.pointsButton)this.pointsButton.setVisible(!overlay&&!this.over&&this.player.growth.unallocated>0).setData('points',this.player.growth.unallocated);
    this.legionUI?.update(this.legion, !overlay && !this.over);
    this.passiveHud.update(this.player.passive, this.combatNow, !overlay);
    buildVfx(this).density=this.enemies.filter(e=>e.active&&!e.isSupplySlot).length+this.legion.count;
    this.buffHud.update(this.player,this.combatNow,!overlay&&!this.over&&!this.relicExpanded,(id,now)=>this.buffProgress(id,now));
    this.hudGfx.setVisible(!overlay);
    if (this.hudTexts) for (const t of Object.values(this.hudTexts)) t.setVisible(!overlay);
    if (IS_DESKTOP && this.hudTexts) { this.hudTexts.mute.setVisible(false); this.hudTexts.music.setVisible(false); } // 电脑版：音效 / 音乐在「设置」面板里
    for (const icon of this.relicIcons) icon.setVisible(!overlay && icon.visible);
    if (overlay) { this.hintText?.setVisible(false); return; }
    const g = this.hudGfx;
    const hpRatio = this.player ? Phaser.Math.Clamp(this.player.hp / this.player.maxHp, 0, 1) : 1;
    const xpRatio = this.player ? Phaser.Math.Clamp(this.player.xp / this.player.xpNext, 0, 1) : 0;
    g.clear();
    // Small neutral health backing only; never a screen-wide green curtain.
    g.fillStyle(0x100e09,.35).fillRoundedRect(20,18,194,60,4);
    if(this.relicExpanded) {
      g.fillStyle(0x17150f,.9).fillRoundedRect(20,190,Math.min(410,GAME_WIDTH-40),180,4);
      g.lineStyle(1,WAR.gold,.45).strokeRoundedRect(20,190,Math.min(410,GAME_WIDTH-40),180,4);
    }
    // Stable HUD regions: health, clock, touch controls, then wave/resources.

    g.fillStyle(0x07120d,.95).fillRect(27,42,180,18);
    g.fillStyle(WAR.danger,.95).fillRect(29,44,Math.round(176*hpRatio),14);
    g.lineStyle(1,0xd5b887,.55).strokeRect(27,42,180,18);
    g.fillStyle(0x07120d,.9).fillRect(27,66,180,6);
    g.fillStyle(WAR.jade,.95).fillRect(28,67,Math.round(178*xpRatio),4);
    // 右上角按钮的漆金底板：暂停为金漆，音效 / 音乐为暗漆小牌（原先是无底纹的纯文字，手机上不像按钮）
    if (this.hudTexts) for (const k of ['pause', 'mute', 'music', 'bag'] as const) {
      const t = this.hudTexts[k]; if (!t?.visible) continue;
      const b = t.getBounds(this.hudChipRect), pause = k === 'pause';
      lqButton(g, b.centerX, pause ? b.y + 28 : b.centerY, pause ? Math.max(66, t.width - 6) : b.width, pause ? 36 : k === 'bag' ? 30 : 24, this.hudChipState[k], pause ? 'gold' : k === 'bag' ? 'cinnabar' : 'quiet');
    }

    if (!this.hudTexts) return;
    this.hudTexts.hp.setText(`${Math.ceil(this.player.hp)}/${this.player.maxHp}`);
    this.hudTexts.level.setText(`${getCharacter(this.runConfig.character).name} Lv.${this.player.level}`);
    this.hudTexts.timer.setText(this.formatTime(this.elapsed));
    this.hudTexts.chapter.setText(this.chapter.name);
    this.hudTexts.kills.setText(`击杀 ${this.kills}`);
    if (this.waveIndex >= 0) {
      this.hudTexts.wave.setText(`第 ${this.waveIndex + 1}/${this.chapter.waves.length} 波 · ${this.chapter.waves[this.waveIndex].name}`);
    }
    this.hudTexts.details.setText(this.relicExpanded?'收起战况 ▴':'战况 ▾');
    for(const key of ['gear','relics']) this.hudTexts[key].setVisible(this.relicExpanded);
    this.hudTexts.details.setVisible(false);
    const weapon = this.player.weapons[0];
    const mastery = '\n'+this.player.growth.masteryLabel();
    this.hudTexts.gear.setText(`${weapon ? `${weaponName(weapon.id,this.runConfig.character)} Lv.${weapon.level}` : '本命武器'}${mastery}\n属性点 ${this.player.growth.unallocated}${this.player.growth.unallocated>0?'':` · 武将 Lv.${this.heroLv}`} · ${this.passiveHud.description}`);
    // 信物（2026-11-17 本局遗物并入信物库）：穿着的信物 + 已激活的同流派套装
    const tokens = wornTokens(this.runConfig.character), sets = this.charmInfo ? (Object.keys(this.charmInfo.schools) as CharmSchool[]).filter(sc => this.charmInfo!.schools[sc] >= 2) : [];
    this.hudTexts.relics.setText(tokens.length ? !IS_DESKTOP && !this.relicExpanded ? `信物 ${tokens.length}  · 点按展开` : `信物 ${tokens.map(t => charmDef(t.base)?.name ?? itemName(t)).join(' · ')}${sets.map(sc => `  ${CHARM_SCHOOL_NAMES[sc]}套装 ${CHARM_SET_DESC[sc]}`).join('')}` : '');

    // 本关首领未击败、战线已推进时，追兵首领的血条继续显示（用户反馈血条不应消失）
    const chaser = this.boss?.active ? null : this.chasingBosses.find(t => t.enemy.active && t.enemy.spawnId === t.life) ?? null;
    const boss = this.boss?.active ? this.boss : chaser?.enemy ?? null;
    if (boss && boss.active) {
      const barW = Math.min(440, GAME_WIDTH * 0.9);
      const left = (GAME_WIDTH - barW) / 2;
      const barY = GAME_HEIGHT - 68;
      const ratio = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
      this.hintText?.setVisible(false);
      this.hudTexts.boss.setVisible(true).setPosition(left, barY - 24).setText(chaser ? chaser.name + ' · 追兵' : this.chapter.bossName);
      const hpLabel = !chaser && this.bossShield > 0 ? `${Math.round(ratio * 100)}% 🛡${Math.round(this.bossShield)}` : `${Math.round(ratio * 100)}%`;
      this.hudTexts.bossHp.setVisible(true).setPosition(left + barW, barY - 24).setText(hpLabel);
      const stageBoss=!!chaser||!!this.xurong||!!this.huaxiong||!!this.chapter.stage&&this.chapter.stage<3;
      const energy = this.lubu ? this.lubu.energy : this.bossEnergy;
      this.hudTexts.bossEnergy.setVisible(!chaser).setPosition(left + barW, barY + 31)
        .setText(this.zhangjiao?this.zhangjiao.label:this.xurong?this.xurong.label+' · 推进 '+Math.max(0,Math.ceil(90-(this.combatNow-this.firstBossAt)/1000))+'秒':this.huaxiong?this.huaxiong.label+' · 推进 '+Math.max(0,Math.ceil(90-(this.combatNow-this.firstBossAt)/1000))+'秒':this.lubu ? `${this.lubu.phase2 ? `魔神 ${Math.floor(energy)}%` : '半血解锁大招'} · ${this.lubu.statusLabel}` : stageBoss?`${boss.hp<=boss.maxHp*.5?'半血强化 · ':''}${this.battleStage()<3?'战线推进倒计时 '+Math.max(0,Math.ceil(90-(this.combatNow-this.firstBossAt)/1000))+'秒':'注意地裂与环形预警'}`:`⚡ ${Math.floor(energy)}%`);
      g.fillStyle(0x000000, 0.72);
      g.fillRect(left, barY, barW, 12);
      // 白色残血条：受击的那一截先显示成白色，停一下再慢慢缩到当前血量（按真实时间，不跟顿帧慢动作走）
      { const rn = performance.now(), dtr = Math.min(.25, (rn - (this.lastHudReal || rn)) / 1000); this.lastHudReal = rn; this.bossStagger.track(boss.spawnId, ratio); const tr = this.bossStagger.trailRatio(ratio, rn, dtr);
        if (tr > ratio) { g.fillStyle(0xfff4e0, 0.92); g.fillRect(left + 2 + (barW - 4) * ratio, barY + 2, (barW - 4) * (tr - ratio), 8); } }
      g.fillStyle(COLORS.red, 0.95);
      g.fillRect(left + 2, barY + 2, Math.max(0, (barW - 4) * ratio), 8);
      if (!chaser && this.bossShield > 0) {
        const sr = Math.min(1, this.bossShield / 300);
        g.fillStyle(0x66d9ff, 0.9);
        // 独立细盾条，不与生命段拼接后溢出容器。
        g.fillRect(left + 2, barY + 11, (barW - 4) * sr, 3);
      }
      if(!stageBoss){g.fillStyle(0x1a1020, 0.85);
      g.fillRect(left, barY + 18, barW, 7);
      g.fillStyle(WAR.gold, 0.95);
      g.fillRect(left, barY + 18, Math.max(0, barW * (energy / 100)), 7);}
    } else {
      this.hintText?.setVisible((this.elapsed < 8 || this.relicExpanded) && !this.tutorial?.active); // 新手引导在时不叠旧操作提示
      this.hudTexts.boss.setVisible(false);
      this.hudTexts.bossHp.setVisible(false);
      this.hudTexts.bossEnergy.setVisible(false);
    }
  }

  // ---------------- 覆盖层 ----------------

  protected buildOverlays(): void {
    this.levelPanel = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay).setVisible(false);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0c0906, 0.86).setOrigin(0, 0).setInteractive();
    const d = IS_DESKTOP;
    const title = this.add
      .text(GAME_WIDTH / 2, d ? 52 : 120 + Math.max(0, Math.round((GAME_HEIGHT - 960) / 2)), '将星精进 · 择一强化', { fontFamily: HEADING_FONT, fontSize: d ? '28px' : '30px', color: '#f0d79e', resolution: 2 })
      .setOrigin(0.5).setLetterSpacing(4).setShadow(0, 2, '#0a0603', 4, true, true);
    title.setName('upgrade-title');
    // 2026-11-17 用户「统一书法字体」：电脑版标题与主页「乱世千军」、点将页同字体同金色；正文象牙白、描边统一
    const INK = GameScene.INK_LEVELUP, GOLD = '#efd399', IVORY = '#e8d8b2', STROKE = '#120904';
    if (d) title.setFontFamily(TITLE_FONT).setFontSize(34).setColor(INK ? '#f4e6c4' : GOLD).setLetterSpacing(3).setShadow(0, 3, '#130a05', 2, true, true);
    const titleInk = d && INK ? inkPlate(this, null, GAME_WIDTH / 2, title.y + 2, 470, 46, false, 'normal') : null;
    if (titleInk) dim.setFillStyle(0x16110c, .9);
    this.levelPanel.add(titleInk ? [dim, titleInk.setScrollFactor(0), title] : [dim, title]);
    // 战功提示：局内每升一级一次三选一；属性点来自武将等级（跨战斗）
    this.levelPanel.add(this.add.text(GAME_WIDTH / 2, title.y + (d ? 44 : 66), '', { fontFamily: FONT, fontSize: '15px', color: d ? IVORY : '#cdb98a', resolution: 2 }).setOrigin(0.5).setShadow(0, 1, '#0a0603', 3, true, true).setStroke(STROKE, d ? 3 : 0).setName('upgrade-points-hint'));
    this.rerollButton=this.add.text(GAME_WIDTH-(d?28:32),d?24:42,'',{fontFamily:d?HEADING_FONT:FONT,fontSize:'16px',color:d?'#e8d3a6':'#e8cf91',resolution:2}).setOrigin(1,0).setPadding(16,10).setBackgroundColor(d?'rgba(0,0,0,0)':'rgba(52,38,24,0.92)').setStroke(STROKE,d?4:0).setShadow(0,1,'#0a0603',2,true,true).setName('upgrade-reroll').setInteractive({useHandCursor:true}).on('pointerdown',()=>this.rerollUpgrades());this.levelPanel.add(this.rerollButton);


    if(!this.textures.exists('ui_upgrade_bronze')){
      const art=this.add.graphics();art.fillStyle(0x211c16).fillRect(0,0,300,300).fillStyle(0x30271c).fillRect(5,5,290,80).lineStyle(2,0x9e8050).strokeRect(2,2,296,296).lineStyle(1,0x554631).strokeRect(7,7,286,286);
      for(const x of [11,289])for(const y of [11,289])art.fillStyle(0xc2a16b).fillRect(x-2,y-2,4,4);
      art.generateTexture('ui_upgrade_bronze',300,300);art.destroy();
    }
    const sub=this.add.text(GAME_WIDTH/2,d?88:160+Math.max(0,Math.round((GAME_HEIGHT-960)/2)),'三择其一 · 点击卡片获得强化',warText(14,'#c6b99e')).setOrigin(.5).setName('upgrade-subtitle');
    const subRule=this.add.graphics().lineStyle(1,0xc9a96a,.45).lineBetween(GAME_WIDTH/2-170,sub.y,GAME_WIDTH/2-110,sub.y).lineBetween(GAME_WIDTH/2+110,sub.y,GAME_WIDTH/2+170,sub.y);
    if (d) { sub.setVisible(false); subRule.setVisible(false); } // 电脑版去掉「三择其一 · 点击卡片获得强化」（少字）
    this.levelPanel.add([sub,subRule]);
    // 三选一卡片：每张卡是一个容器（入场滑入、悬停上浮），卡面按类别着色。电脑横排、手机竖排。
    const pad=d?0:Math.max(0,Math.round((GAME_HEIGHT-960)/2));
    for(let i=0;i<3;i++){
      const w=d?272:480,h=d?340:176,x=d?GAME_WIDTH/2+(i-1)*292:GAME_WIDTH/2,y=d?300:292+pad+i*192;
      const medal=d?{x:Math.round(w/2),y:70,r:36}:{x:56,y:Math.round(h/2),r:34};
      const root=this.add.container(x,y);
      const bg=this.add.image(0,0,upgradeCardTexture(this,w,h,UPGRADE_ACCENT.passive,medal)).setDisplaySize(w+32,h+32).setInteractive({useHandCursor:true}).setName('upgrade-card-'+i);
      // 输入区域只覆盖卡面（不含外发光留白）；贴图按渲染倍率绘制，命中矩形用贴图像素坐标。
      const fitHit=()=>{const k=bg.frame.width/(w+32);bg.input!.hitArea.setTo(16*k,16*k,w*k,h*k);};fitHit();bg.setData('fitHit',fitHit);
      const icon=this.add.image(medal.x-w/2,medal.y-h/2,'icon_1').setDisplaySize(52,52).setVisible(false);
      const tag=this.add.text(d?0:104-w/2,d?120-h/2:18-h/2,'',warText(12,'#c9b993')).setResolution(2).setPadding(8,3).setOrigin(d?.5:0,0);
      const name=this.add.text(d?0:104-w/2,d?148-h/2:42-h/2,'',{...warText(d?21:21,'#f6e8c8'),fontFamily:HEADING_FONT,align:d?'center':'left',wordWrap:{width:d?w-36:w-122,useAdvancedWrap:true}}).setOrigin(d?.5:0,0).setShadow(0,1,'#0a0603',3,true,true);
      const desc=this.add.text(d?0:104-w/2,d?204-h/2:88-h/2,'',{...warText(d?16:17,'#dacfba'),align:d?'center':'left',lineSpacing:5,wordWrap:{width:d?w-40:w-122,useAdvancedWrap:true}}).setOrigin(d?.5:0,0);
      const rule=this.add.graphics();
      const hint=this.add.text(d?0:w/2-16,d?h/2-22:h/2-14,d?'按 '+(i+1)+' 选择':'点击选择',warText(11,'#9d8f78')).setOrigin(d?.5:1,1).setAlpha(.85);
      if(d){ // 统一字体：卡名 / 标签 / 提示用标题字，正文用正文字；水墨版换深墨色 + 朱砂标签
        name.setFontFamily(HEADING_FONT).setColor(INK?'#1f1710':GOLD).setStroke(INK?'#efe4c9':STROKE,3);
        desc.setFontFamily(FONT).setColor(INK?'#33281d':IVORY).setStroke(INK?'#efe4c9':STROKE,INK?2:2);
        tag.setFontFamily(HEADING_FONT).setColor(INK?'#fff0d6':'#f6e6c2');if(INK)tag.setBackgroundColor('#8a2a1c');
        hint.setFontFamily(HEADING_FONT).setFontSize(12).setColor(INK?'#5b4630':'#b9a57a').setStroke(INK?'#efe4c9':STROKE,2).setAlpha(1);
      }
      // 子元素也必须固定在屏幕上，否则命中检测按相机滚动偏移（点不中卡片）。
      for(const o of [bg,rule,icon,tag,name,desc,hint])o.setScrollFactor(0);root.add([bg,rule,icon,tag,name,desc,hint]);root.setScrollFactor(0);this.levelPanel.add(root);
      const view:CardView={bg,icon,name,desc,tag,root,rule,hint,w,h,baseY:y,medal,accent:UPGRADE_ACCENT.passive,rare:false,hover:false,lift:0};
      bg.on('pointerdown',()=>bg.setTint(0xe0cfa8)).on('pointerup',()=>{bg.clearTint();this.chooseUpgrade(i);}).on('pointerover',()=>{view.hover=true;this.paintUpgradeCard(view);}).on('pointerout',()=>{bg.clearTint();view.hover=false;this.paintUpgradeCard(view);});
      this.cardViews.push(view);
    }

    this.pausePanel = this.add.container(0,0).setScrollFactor(0).setDepth(DEPTH.overlay).setVisible(false);
    const pauseDim=this.add.rectangle(0,0,GAME_WIDTH,GAME_HEIGHT,0x07120d,.66).setOrigin(0).setInteractive();
    const pw=d?420:GAME_WIDTH-88, ph=d?480:520, top=(GAME_HEIGHT-ph)/2, cx=GAME_WIDTH/2;
    // 漆底描金（与结算卷、告捷弹窗同系）；底下一块透明矩形挡住点击
    const panelG=this.add.graphics();lqPanel(panelG,cx-pw/2,top,pw,ph);
    const panel=this.add.rectangle(cx,GAME_HEIGHT/2,pw,ph,0x000000,.001).setInteractive();
    const pauseTitle=this.add.text(cx,top+34,'战斗暂停',warText(27,'#e8cf91')).setOrigin(.5);
    const pauseHint=this.add.text(cx,top+66,'稍歇片刻 · 战斗进度已暂停',warText(13,'#91ab98')).setOrigin(.5);
    const resumeY=top+108;
    const resume=this.add.image(cx,resumeY,'ui_war_button').setDisplaySize(pw-64,50).setInteractive({useHandCursor:true}).setName('pause-resume').setData('padDefault',true);
    const resumeText=this.add.text(cx,resumeY,'继续战斗',warText(21,'#ffe9bd')).setOrigin(.5).setStroke('#2a170b',3);
    lqImageButton(this,resume,pw-64,50,'cinnabar',resumeText);
    resume.on('pointerdown',()=>this.togglePause());
    this.attributePauseText=this.add.text(cx,top+157,'分配属性点 · 0',warText(15,'#e8cf91')).setOrigin(.5).setPadding(12,5).setInteractive({useHandCursor:true}).setName('pause-attributes');
    this.attributePauseText.on('pointerdown',()=>{this.attributeReturn='pause';this.renderAttributePanel();this.setMode('attributes');});
    const bgmRow=this.createVolumeRow('战场音乐',top+205,this.music.getVolume(),v=>this.music.setVolume(v));
    const sfxRow=this.createVolumeRow('战斗音效',top+277,this.sfx.getVolume(),v=>this.sfx.setVolume(v));
    const buildLink=this.add.text(cx,top+ph-112,'战法与宝物 · 查看构筑',warText(15,'#e6cc90')).setOrigin(.5).setPadding(14,6).setInteractive({useHandCursor:true}).setName('pause-build');
    buildLink.on('pointerdown',()=>this.openBuildPanel());this.pausePanel.add(buildLink);
    // 行囊：战斗中也可换装（坐骑除外，休整时才能换马）
    const bagLink=this.add.text(cx,top+ph-154,'行囊 · 换装',warText(15,'#e6cc90')).setOrigin(.5).setPadding(14,6).setInteractive({useHandCursor:true}).setName('pause-bag');
    bagLink.on('pointerdown',()=>{if(this.mode==='pause')this.openBattleBag();});this.pausePanel.add(bagLink);
    const exit=this.add.text(cx,top+ph-66,'返回选将',warText(16,'#b5c4b2')).setOrigin(.5).setPadding(24,10).setInteractive({useHandCursor:true}).setName('pause-exit');
    exit.on('pointerdown',()=>{
      // 2026-11-17 用户「返回营寨改成撤退，然后回到大地图」：电脑版撤退 → 回滚本场所得 → 天下地图（天下未开时回主页）
      const toMap=d&&worldUnlocked();
      if(exit.getData('confirm')){this.abandonRun();this.registry.remove('campaignTransfer');if(rollbackBattle()){if(toMap)try{sessionStorage.setItem(BOOT_TO_KEY,'WorldMapScene');}catch{/* 存储不可用：重载后回主页 */}reloadGame();return;}this.scene.start(toMap?'WorldMapScene':d?'MenuScene':this.worldCampaign&&worldUnlocked()?'CityScene':'MenuScene');}
      else exit.setData('confirm',true).setText(d?'撤退？退出后本场获得的等级与资源不保留，确定？':'退出后本场获得的等级与资源不保留，确定？').setColor('#e7b68e');
    });
    const keys=this.pauseKeysText=this.add.text(cx,top+ph-22,d?'Esc / P 继续战斗':'战斗已冻结 · 点击「继续战斗」恢复',warText(12,'#7f9987')).setOrigin(.5);
    // 暂停菜单里的文字入口改为漆金小牌：有底板、悬停 / 按下态，命中区与底板一致
    const pauseSkins=([[this.attributePauseText,pw-120,30],[bagLink,pw-120,32],[buildLink,pw-120,32],[exit,pw-120,36]] as const).map(([t,w,h])=>{
      const skin=lqSkin(this,t,t,()=>({w,h}),{tone:'quiet'});lqHitBox(t,w,h);return skin;}),pauseChips=pauseSkins.map(k=>k.gfx);
    this.pausePanel.add([pauseDim,panelG,panel,pauseTitle,pauseHint,...pauseChips,resume,resumeText,...bgmRow,...sfxRow]);
    this.pausePanel.add(this.attributePauseText);this.pausePanel.bringToTop(bagLink);this.pausePanel.bringToTop(buildLink);this.pausePanel.add([exit,keys]);
    if (d) { this.layoutSettingsPanel({ panelG, panel, pauseTitle, pauseHint, resume, resumeText, bgmRow, sfxRow, buildLink, bagLink, exit, keys }); for (const k of pauseSkins) k.repaint(); } // 底板跟着按钮挪到左栏

    this.attributePanel=this.add.container(0,0).setScrollFactor(0).setDepth(DEPTH.overlay+1).setVisible(false);
    const attrDim=this.add.rectangle(0,0,GAME_WIDTH,GAME_HEIGHT,0x07120d,.76).setOrigin(0).setInteractive();
    const attrW=d?600:GAME_WIDTH-32,attrH=d?Math.min(580,GAME_HEIGHT-16):700,attrTop=(GAME_HEIGHT-attrH)/2,attrCx=GAME_WIDTH/2;
    const attrFrameG=this.add.graphics();lqPanel(attrFrameG,attrCx-attrW/2,attrTop,attrW,attrH);
    const attrFrame=this.add.rectangle(attrCx,GAME_HEIGHT/2,attrW,attrH,0x000000,.001).setInteractive();
    const attrTitle=this.add.text(attrCx,attrTop+34,'武将修习 · 属性分配',warText(24,'#e8cf91')).setOrigin(.5);
    if(d)attrTitle.setFontFamily(TITLE_FONT).setColor('#efd399').setStroke('#120904',4); // 2026-11-17 用户批准 UI 审查 G：书法标题、点数改金字、点数条换描金小菱、＋ 与返回换水墨
    this.attributePointsText=this.add.text(attrCx,attrTop+74,'可分配属性点 0',warText(16,'#91ab98')).setOrigin(.5).setPadding(14,4);
    this.attributeWeaponText=this.add.text(attrCx,attrTop+104,'',warText(13,'#d3bd86')).setOrigin(.5);
    this.attributeSummaryText=this.add.text(attrCx,attrTop+133,'',{...warText(d?11:12,'#c7d6c8'),align:'center',lineSpacing:3}).setOrigin(.5).setWordWrapWidth(attrW-46);
    this.attributePanel.add([attrDim,attrFrameG,attrFrame,attrTitle,this.attributePointsText,this.attributeWeaponText,this.attributeSummaryText]);
    const rowH=d?50:66,firstY=attrTop+(d?186:206),rowW=attrW-50;
    this.attributeRows=[];
    const perkTip=this.add.text(0,0,'',{...warText(13,'#ffe3a0'),backgroundColor:'#1b120bee',padding:{x:8,y:5}}).setOrigin(.5,1).setVisible(false).setName('attribute-perk-tip');
    (Object.keys(ATTRIBUTE_INFO) as AttributeId[]).forEach((id,index)=>{
      const y=firstY+index*rowH,left=attrCx-rowW/2;
      const isPrimaryRow=primaryAttribute(this.runConfig.character)===id;
      const row=this.add.graphics();row.fillStyle(LQ.lacquerHi,.5).fillRoundedRect(left,y-(rowH-8)/2,rowW,rowH-8,6).lineStyle(isPrimaryRow?2:1,LQ.gold,isPrimaryRow?.95:.38).strokeRoundedRect(left,y-(rowH-8)/2,rowW,rowH-8,6); // 主属性一行金边
      const attrIconImg=this.add.image(left+30,y,attributeIcon(id)).setDisplaySize(34,34);
      const isPrimary=primaryAttribute(this.runConfig.character)===id;
      const label=this.add.text(left+56,y-11,ATTRIBUTE_INFO[id].name+(isPrimary?' · 主属性 ×'+PRIMARY_MUL:''),{...warText(17,isPrimary?'#ffe3a0':'#f0dfb4')}).setOrigin(0,.5);
      // 主属性专精：三个小菱形（满 4 / 7 / 10 点点亮），悬停看说明
      let perkG:Phaser.GameObjects.Graphics|undefined,perkX=0;
      if(isPrimary){perkX=label.x+label.width+16;perkG=this.add.graphics().setName('attribute-perks');this.attributePanel.add(perkG);
        for(let k=0;k<PRIMARY_TIERS.length;k++){const info=PRIMARY_PERK_INFO[id][k],z=this.add.zone(perkX+k*17,y-11,16,16).setInteractive().setName('attribute-perk-'+(k+1));
          z.on('pointerover',()=>{perkTip.setText('满 '+PRIMARY_TIERS[k]+' 点「'+info.name+'」：'+info.desc).setPosition(z.x,y-24).setVisible(true);});z.on('pointerout',()=>perkTip.setVisible(false));this.attributePanel.add(z);}}
      const effect=this.add.text(left+56,y+12,ATTRIBUTE_INFO[id].effect,warText(12,'#a9b9a3')).setOrigin(0,.5);
      // 等级：10 格，右侧数值
      const pipX=attrCx+rowW/2-(d?226:212),pipY=y,pips=this.add.graphics();
      const value=this.add.text(attrCx+rowW/2-80,y,`0/${ATTRIBUTE_MAX}`,warText(13,'#b6c3ab')).setOrigin(1,.5);
      const button=this.add.image(attrCx+rowW/2-38,y,'ui_war_button').setDisplaySize(50,44).setInteractive({useHandCursor:true}).setName('attribute-add-'+id);
      const plus=this.add.text(button.x,button.y-1,'+',warText(26,'#ffe9bd')).setOrigin(.5).setStroke('#2a170b',3);
      lqImageButton(this,button,50,44,'gold',plus);
      // 2026-11-18 每个界面最多 1 处水墨笔刷：「＋」用漆底描金方钮（上面的 lqImageButton），笔刷只留给底部「返回」
      button.on('pointerdown',()=>{const g=this.player.growth;if(g.allocate(this.player,id)){this.player.passive.areaMul=g.areaMultiplier();if(g.heroFree>0){g.heroFree--;if(!isChapterTestRun())allocateHeroAttr(this.runConfig.character,id);}this.renderAttributePanel();this.updateHud();}});
      this.attributePanel.add([row,attrIconImg,label,effect,pips,value,button,plus]);
      if(isPrimary){const ab=attrBadge(this,left+56+label.width+18,y-11,this.runConfig.character,22);if(ab)this.attributePanel.add(ab);} // 主属性印（ui/AttrBadge.ts）
      this.attributeRows.push({value,button,plus,pips,pipX,pipY,perkG,perkX,perkY:y-11});
    });
    this.attributePanel.add(perkTip);
    const attrCloseY=attrTop+attrH-38;
    const attrClose=this.add.text(attrCx,attrCloseY,'返回暂停菜单',warText(16,'#d8c9ae')).setOrigin(.5).setPadding(18,8).setInteractive({useHandCursor:true});
    attrClose.setName('attributes-close').on('pointerdown',()=>this.setMode(this.attributeReturn));
    attrClose.setStyle({fontFamily:HEADING_FONT,fontSize:'18px'});const attrCloseSkin=(d?inkSkin(this,attrClose,()=>({w:220,h:44}),{primary:true}):null)??lqSkin(this,attrClose,attrClose,()=>({w:220,h:44}),{tone:'cinnabar'});
    this.attributePanel.add([attrCloseSkin.gfx,attrClose]);
    this.renderAttributePanel();

    this.recruitViews = [];
    this.recruitPanel = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay).setVisible(false);
    const recDim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8).setOrigin(0, 0).setInteractive();
    const recTitle = this.add
      .text(GAME_WIDTH / 2, d ? 40 : 120, '蜀军招募 · 三选一', { fontFamily: FONT, fontSize: d ? '22px' : '24px', color: '#e8c76a' })
      .setOrigin(0.5);
    this.recruitCountText = this.add
      .text(GAME_WIDTH / 2, d ? 70 : 158, '', { fontFamily: FONT, fontSize: d ? '13px' : '15px', color: '#d8c9ae' })
      .setOrigin(0.5);
    this.recruitPanel.add([recDim, recTitle, this.recruitCountText]);
    const rYs = d ? [150, 300, 450] : [300, 470, 640];
    for (let i = 0; i < 3; i += 1) {
      const y = rYs[i];
      const bg = this.add.image(GAME_WIDTH / 2, y, 'ui_war_card').setDisplaySize(d ? 460 : 400, d ? 120 : 145).setInteractive({ useHandCursor: true });
      const icon = this.add.image(GAME_WIDTH / 2 - (d ? 160 : 135), y, 'shu_swordsman_walk_sheet', 'down_0').setDisplaySize(54, 54);
      const name = this.add.text(GAME_WIDTH / 2 + (d ? 20 : 10), y - 26, '', { fontFamily: FONT, fontSize: d ? '20px' : '22px', color: '#f5efe6' }).setOrigin(0.5);
      const desc = this.add.text(GAME_WIDTH / 2 + (d ? 20 : 10), y + 18, '', { fontFamily: FONT, fontSize: d ? '13px' : '15px', color: '#d8c9ae' }).setOrigin(0.5);
      const tag = this.add.text(GAME_WIDTH / 2 + (d ? 150 : 120), y - 38, '', { fontFamily: FONT, fontSize: d ? '12px' : '13px' }).setOrigin(0.5).setPadding(6, 2, 6, 2);
      this.recruitPanel.add([bg, icon, name, desc, tag]);
      this.recruitViews.push({ bg, name, desc, icon, tag });
    }

    this.resultPanel = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay).setVisible(false);
    const rDim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0c0805, 0.84).setOrigin(0, 0).setInteractive();
    // 结算卷：漆底双层描金（同告捷弹窗），按钮为漆金按钮，有悬停 / 按下态；按钮仍是原来的命名对象。
    // 电脑版（2026-11-17 用户「打败boss后结算ui也要优化一下」）：书法大标题 + 「X-X 告捷」小标题、奖励图标格与经验条（presentResult）、一行战况、水墨按钮；手机版不变
    const rpw = d ? 640 : GAME_WIDTH - 48, rph = d ? 500 : 700, px0 = (GAME_WIDTH - rpw) / 2, py0 = d ? Math.round((GAME_HEIGHT - rph) / 2) : 120, pcx = GAME_WIDTH / 2;
    this.resultTop = py0; this.resultH = rph;
    rDim.on('pointerdown', () => this.resultAnimSkip?.()); // 点空白处跳过动画
    const resultFrame = this.add.graphics(); lqPanel(resultFrame, px0, py0, rpw, rph);
    const rTitle = this.add
      .text(pcx, py0 + (d ? 74 : 78), '', { fontFamily: d ? TITLE_FONT : HEADING_FONT, fontSize: d ? '44px' : '46px', color: '#e8c76a' })
      .setOrigin(0.5).setStroke(d ? RESULT_STROKE : '#2a170b', 6).setShadow(0, 3, '#000000', 6, true, true);
    if (d) rTitle.setLetterSpacing(6);
    const rKicker = this.add.text(pcx, py0 + 32, '', { fontFamily: HEADING_FONT, fontSize: '14px', color: '#d9b878', resolution: 2 })
      .setOrigin(.5).setLetterSpacing(5).setStroke(RESULT_STROKE, 3).setName('result-kicker').setVisible(d);
    const rSub = this.add
      .text(pcx, py0 + (d ? 112 : 134), '', { fontFamily: FONT, fontSize: d ? '13px' : '16px', color: d ? RESULT_IVORY : '#cdb88c', align: 'center', wordWrap: { width: rpw - 80 } })
      .setOrigin(0.5);
    if (d) rSub.setAlpha(.85).setStroke(RESULT_STROKE, 3);
    const rDiv = this.add.graphics(); lqDivider(rDiv, pcx, py0 + (d ? 130 : 166), d ? 190 : 160);
    const rBody = this.add
      .text(pcx, py0 + (d ? 140 : 196), '', { fontFamily: FONT, fontSize: d ? '16px' : '19px', color: '#eadcbd', align: 'left', lineSpacing: d ? 9 : 16 })
      .setOrigin(0.5, 0);
    const rNotes = this.add.text(pcx, py0 + rph - 98, '', { fontFamily: FONT, fontSize: '12px', color: RESULT_IVORY, align: 'center', lineSpacing: 3, wordWrap: { width: rpw - 90 }, resolution: 2 })
      .setOrigin(.5, 1).setStroke(RESULT_STROKE, 3).setName('result-notes').setVisible(false);
    const rStats = this.add.text(pcx, py0 + rph - 82, '', { fontFamily: FONT, fontSize: '12px', color: '#b9a57a', resolution: 2 })
      .setOrigin(.5).setStroke(RESULT_STROKE, 3).setName('result-stats').setVisible(false);
    const rbw = d ? 210 : 216, rbh = d ? 46 : 60, rby = py0 + rph - (d ? 42 : 66);
    const btn = this.add
      .image(pcx, rby, 'ui_war_button')
      .setDisplaySize(rbw, rbh).setAlpha(.001)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add
      .text(pcx, rby, '再来一局', { fontFamily: HEADING_FONT, fontSize: d ? '20px' : '22px', color: '#ffe9bd' })
      .setOrigin(0.5).setStroke('#2a170b', 3);
    btn.setName('result-restart');btnText.setName('result-restart-text');
    btn.on('pointerdown', () => {if(this.victory)this.scene.restart();});
    const selectChapter = this.add.text(pcx, rby, this.worldCampaign&&worldUnlocked()?this.chapter.stage===3&&this.victory?'三国天下开启':"返回营寨":'返回选关', { fontFamily: HEADING_FONT, fontSize: d ? '19px' : '21px', color: '#ffe9bd' })
      .setOrigin(.5).setStroke('#2a170b', 3).setInteractive({ useHandCursor: true });
    selectChapter.setName('result-home').on('pointerdown', () => this.scene.start(this.worldCampaign&&worldUnlocked()?(this.registry.get('worldReveal')?'WorldMapScene':'CityScene'):'MenuScene'));
    if(this.worldCampaign)btnText.setText('再次出征');
    // 电脑版水墨笔触按钮（同主页 / 军营）：「返回 / 下一关」为主按钮（朱墨），「再次出征」为次按钮；缺图时退回漆金按钮
    const ink = d && this.textures.exists('btn_ink_primary_normal');
    let homeInk: Phaser.GameObjects.NineSlice | null = null;
    // 2026-11-18 每个界面最多 1 处水墨笔刷：「再来一局 / 再次出征」用漆底小牌，笔刷只给「返回 / 下一关」主按钮
    const restartSkin = lqSkin(this, btn, btnText, () => ({ w: rbw, h: rbh }), ink ? { tone: 'quiet' } : {});
    const homeSkin = ink ? null : lqSkin(this, selectChapter, selectChapter, () => ({ w: rbw, h: rbh }), { tone: 'quiet' });
    const paintInk = (which: 'restart' | 'home', state: 'normal' | 'hover' | 'pressed'): void => {
      const dy = state === 'pressed' ? 1 : 0, hi = state === 'hover';
      if (which === 'restart') return;
      { homeInk = inkPlate(this, homeInk, selectChapter.x, rby, rbw, rbh, true, state); selectChapter.setY(rby + dy).setColor(hi ? '#fff3d4' : '#f8e6bf'); }
    };
    if (ink) {
      btnText.setFontSize(17).setStroke('#16100a', 4).setLetterSpacing(3);
      selectChapter.setFontSize(17).setStroke('#2a0c06', 3).setLetterSpacing(2);
      paintInk('home', 'normal');
      selectChapter.on('pointerover', () => paintInk('home', 'hover')).on('pointerout', () => paintInk('home', 'normal'));
    }
    const homeDown = () => { if (ink) paintInk('home', 'pressed'); else homeSkin?.repaint('down'); };
    /** 胜利时「再战 / 返回」并排，败走时只剩返回居中；命中区固定为按钮大小（文字长短不影响）。 */
    this.layoutResultButtons = () => {
      const both = btn.visible;
      btn.setX(both ? pcx - rbw / 2 - (ink ? 14 : 10) : pcx); selectChapter.setPosition(both ? pcx + rbw / 2 + (ink ? 14 : 10) : pcx, rby);
      lqHitBox(selectChapter, rbw, rbh);
      selectChapter.off('pointerdown', homeDown).on('pointerdown', homeDown);
      restartSkin.repaint('idle'); if (ink) paintInk('home', 'normal'); else homeSkin?.repaint('idle');
    };
    this.layoutResultButtons();
    const plates: Phaser.GameObjects.GameObject[] = ink ? [restartSkin.gfx, ...(homeInk ? [homeInk] : [])] : [restartSkin.gfx, homeSkin!.gfx];
    this.resultPanel.add([rDim,resultFrame,rDiv,rKicker,rTitle,rSub,rBody,rNotes,rStats,...plates,btn,btnText,selectChapter]);
    this.resultTexts = { title: rTitle.setResolution(2), subtitle: rSub.setResolution(2), body: rBody.setResolution(2) };

    // 相机跟随会导致容器子元素的输入命中偏移，逐个子元素固定 scrollFactor(0)。
    const fixInput = (container: Phaser.GameObjects.Container): void => {
      for (const child of container.list) {
        (child as unknown as { setScrollFactor: (v: number) => void }).setScrollFactor(0);
      }
    };
    fixInput(this.levelPanel);
    fixInput(this.pausePanel);
    fixInput(this.resultPanel);
    if (IS_DESKTOP) this.time.delayedCall(4000, () => { if (this.sys?.isActive()) loadBagArt(this, () => {}); });
    fixInput(this.recruitPanel);
    fixInput(this.attributePanel);
  }

  private openBuildPanel():void{
    if(this.mode!=='pause'||this.children.getByName('build-panel'))return;
    const root=this.add.container(0,0).setDepth(DEPTH.overlay+4).setScrollFactor(0).setName('build-panel'),b=this.player.growth.build;
    const text=(x:number,y:number,value:string,size=16)=>this.add.text(x,y,value,{fontFamily:FONT,fontSize:size+'px',color:'#ecd9b5',resolution:2,wordWrap:{width:GAME_WIDTH-90}}).setScrollFactor(0);
    root.add(this.add.rectangle(GAME_WIDTH/2,GAME_HEIGHT/2,GAME_WIDTH,GAME_HEIGHT,0x17130e,.98).setScrollFactor(0).setInteractive());
    // 电脑版（2026-11-17 UI 审查）：原来字直接铺在半透明底上、透出后面的军中设置；改为漆底描金面板 + 书法标题 + 水墨返回，打开时先收起军中设置
    const D=IS_DESKTOP;if(D){this.pausePanel.setVisible(false);const fr=this.add.graphics().setScrollFactor(0);lqPanel(fr,20,12,GAME_WIDTH-40,GAME_HEIGHT-24);root.add(fr);}
    const head=text(36,24,'本局构筑 · 战法 '+Object.keys(b.tactics).length+'/6 · 信物宝物 '+b.treasures.length,22);if(D)head.setFontFamily(TITLE_FONT).setColor('#efd399').setStroke('#120904',4).setPosition(44,26);root.add(head);
    let y=66;for(const id of Object.keys(b.tactics) as TacticId[]){root.add(this.add.image(48,y+16,'build_icon_'+id).setDisplaySize(26,26).setScrollFactor(0));root.add(text(70,y,TACTICS[id].name+' Lv.'+b.level(id)+'  ['+TAG_NAMES[TACTICS[id].tag]+']',17));root.add(text(36,y+23,TACTICS[id].desc,13));y+=IS_DESKTOP?45:68;}
    if(!Object.keys(b.tactics).length){root.add(text(36,y,'升级时选择战法，构筑你的战斗风格。'));y+=42;}
    for(const id of b.treasures){root.add(this.add.image(48,y+10,'build_icon_'+id).setDisplaySize(24,24).setScrollFactor(0));root.add(text(70,y,TREASURES[id].name+' · '+TREASURES[id].desc,14));y+=IS_DESKTOP?29:48;}

    root.add(text(36,GAME_HEIGHT-106,Object.entries(b.tags()).map(([id,n])=>TAG_NAMES[id as keyof typeof TAG_NAMES]+' '+n+'件').join('  '),14));
    if(!D)root.add(text(36,GAME_HEIGHT-78,'标签仅记录进度；2件加成 / 4件觉醒将在后续阶段开放。',12));
    const close=()=>{root.destroy();if(this.mode==='pause')this.pausePanel.setVisible(true);};
    if(D){const back=homeCommand(this,GAME_WIDTH/2,GAME_HEIGHT-46,200,42,'返回');for(const o of [back.g,back.caption,back.hit]){(o as unknown as {setScrollFactor:(n:number)=>void}).setScrollFactor(0);root.add(o);}back.hit.setName('build-panel-back').setData('padDefault',true).on('pointerdown',close);}
    else root.add(text(GAME_WIDTH/2-70,GAME_HEIGHT-46,'返回暂停菜单',17).setPadding(12,8).setInteractive({useHandCursor:true}).on('pointerdown',close));
  }
  protected renderAttributePanel(): void {
    if (!this.player || !this.attributePointsText) return;
    const growth=this.player.growth;
    {const close=this.attributePanel.getByName('attributes-close') as Phaser.GameObjects.Text|null;close?.setText(this.attributeReturn==='none'?'继续战斗':'返回暂停菜单');if(close&&!close.getData('hitBox')){lqHitBox(close,220,44);close.setData('hitBox',true);}}
    this.attributePointsText.setText(growth.unallocated>0?`可分配属性点 ${growth.unallocated}`:`属性点已用完 · 武将每升 1 级获得 1 点（当前 Lv.${this.heroLv}）`).setColor(growth.unallocated>0?(IS_DESKTOP?'#efd399':'#1c160c'):'#91ab98').setBackgroundColor(growth.unallocated>0&&!IS_DESKTOP?'#e2bd6a':'#00000000');if(IS_DESKTOP)this.attributePointsText.setFontFamily(HEADING_FONT).setFontSize(growth.unallocated>0?20:15).setStroke('#120904',growth.unallocated>0?4:0);
    this.attributePauseText?.setText(`分配属性点 · ${growth.unallocated}`);
    const weapon=this.player.weapons[0];
    this.attributeWeaponText?.setText((weapon?weaponName(weapon.id,this.runConfig.character):'')+' · '+growth.masteryLabel());
    const character=getCharacter(growth.character),stats=this.player.stats;
    const baseline={...stats,damageMul:character.damageMul,cooldownMul:1,moveMul:character.speedMul,critChance:.05,
      maxHpBonus:Math.round(BALANCE.player.maxHp*(character.hpMul-1)),meleeMul:1,arrowMul:1,fireMul:1};
    const def=weapon?WEAPON_DEFS[weapon.id]:undefined,level=weapon?.level??1,now=this.combatNow;
    const baseDamage=def?.damage(level,baseline)??1;
    const currentDamage=(def?.damage(level,stats)??1)*growth.damageMultiplier(now);
    const damageBonus=Math.round((currentDamage/Math.max(1,baseDamage)-1)*100);
    const masteryRate=weapon?.id==='spear_orbit'?1+.08*growth.weaponMasteryLevel:1;
    const currentCooldown=Math.max(.25,(def?.cooldown(level,stats)??1)/growth.attackSpeedMultiplier(now)/masteryRate);
    const baseCooldown=Math.max(.25,def?.cooldown(level,baseline)??1);
    const attackBonus=Math.round((baseCooldown/currentCooldown-1)*100);
    const crit=Math.min(.65,stats.critChance+growth.criticalBonus()+growth.aimCriticalBonus()+this.player.passive.critBonus(now)+this.buildCombat.criticalBonus());
    const baseHp=BALANCE.player.maxHp*character.hpMul,baseSpeed=BALANCE.player.speed*character.speedMul;
    const hpBonus=Math.round((this.player.maxHp/baseHp-1)*100),moveBonus=Math.round((this.player.speed/baseSpeed-1)*100);
    this.attributeSummaryText?.setText(`实际属性　伤害 +${damageBonus}% · 攻速 +${attackBonus}% · 暴击 ${(crit*100).toFixed(0)}%\n生命 ${Math.round(this.player.hp)}/${Math.round(this.player.maxHp)}（上限 +${hpBonus}%） · 移速 ${Math.round(this.player.speed)}（+${moveBonus}%）`);
    const ids=Object.keys(ATTRIBUTE_INFO) as AttributeId[];
    for(let i=0;i<ids.length;i++){
      const id=ids[i],level=growth.attributes[id],row=this.attributeRows[i];
      if(!row)continue;
      row.value.setText(level>=ATTRIBUTE_MAX?'已满':`${level}/${ATTRIBUTE_MAX}`).setColor(level>=ATTRIBUTE_MAX?'#e2bd6a':'#e5d4ab');
      row.pips.clear();for(let k=0;k<ATTRIBUTE_MAX;k++){const x=row.pipX+k*11;if(IS_DESKTOP){const cx=x+4,cy=row.pipY,pts=[{x:cx,y:cy-5},{x:cx+4,y:cy},{x:cx,y:cy+5},{x:cx-4,y:cy}];row.pips.fillStyle(k<level?0xe2bd6a:0x241a10,1).fillPoints(pts,true).lineStyle(1,k<level?0xfff0c0:0x7a6440,.9).strokePoints(pts,true);continue;}row.pips.fillStyle(k<level?0xe2bd6a:0x2a3328,1).fillRect(x,row.pipY-5,8,10).lineStyle(1,k<level?0xfff0c0:0x5d6a58,.9).strokeRect(x+.5,row.pipY-4.5,7,9);}
      const can=growth.unallocated>0&&level<ATTRIBUTE_MAX;
      if(can){row.button.setAlpha(1).setInteractive({useHandCursor:true});}
      else row.button.setAlpha(.38).disableInteractive();
      row.plus.setAlpha(can?1:.45);
      if(row.perkG){row.perkG.clear();for(let k=0;k<PRIMARY_TIERS.length;k++){const on=level>=PRIMARY_TIERS[k],cx=(row.perkX??0)+k*17,cy=row.perkY??0,pts=[{x:cx,y:cy-6},{x:cx+6,y:cy},{x:cx,y:cy+6},{x:cx-6,y:cy}];row.perkG.fillStyle(on?0xe2bd6a:0x2a3328,1).fillPoints(pts,true).lineStyle(1,on?0xfff0c0:0x5d6a58,.9).strokePoints(pts,true);}}
    }
  }

  // ---------------- 性能测试模式（?perf=1，仅 DEV） ----------------

  protected installDevelopment(): void {}
  protected disposeDevelopment(): void {}
  protected updatePerf(_dt: number): void {}
  protected onRunFinished(_stats: RunStats): void {}
}
