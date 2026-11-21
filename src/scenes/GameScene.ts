import { EnemyFormations } from '../systems/EnemyFormations';
import { SIGIL_LABEL, formationSigil, setFormationSigil, type FormationSigil } from '../systems/BattleSettings';
import { FORMATION_IDS } from '../data/formations';
import { FormationFx } from '../systems/FormationFx';
import { FormationRuntime } from '../systems/FormationRuntime';
import { playMenuMusic, stopMenuMusic } from '../systems/Music';
import { startCityAmbient } from '../systems/ContentSfx';
import { SCHOOLS, SCHOOL_TIER, SHI_SOURCES, FOLLOWER_SCHOOL, heroAffinity, type SchoolId } from '../data/schools';
import { playSheet } from '../systems/SkillFxSheets';
import { ZHANGLIAO } from '../data/zhangliao';
import { FOOT_HUD } from '../data/passiveGauge';
import { TAISHICI } from '../data/taishici';
import { MENGDE } from '../data/mengde';
import { zhurongSpread } from '../weapons/zhurongWeapon';
import { HeroCastFx } from '../systems/HeroCastFx';
import { MOUNT_VISUAL, isHorseCavalry } from '../data/mounts';
import { buildSettingsPanel, type SettingSpec } from '../ui/SettingsPanel';
import {FollowerSquad,type Follower} from '../systems/FollowerSquad';
import {showBarkCard} from '../ui/StoryBarkCard';
import { DEFEAT, DEFEAT_TIPS, defeatLines } from '../data/defeatFlow';
import { battlePoint, retreatTarget, type RetreatTarget } from '../world/DefeatRetreat';
import { patchCampaignDefeat } from '../systems/Campaign';
import { loseProvisionsPct } from '../world/WorldStore';
import type {DefectorInfo} from '../data/fortunes';
import type {Recruit} from '../systems/RosterStore';
import {CharacterPassives} from '../systems/CharacterPassives';
import {FOLLOW} from '../data/recruits';
import type {PlayerStats} from '../types';
import {followersFor,followerLevelCap,heroOwned,lordHero} from '../systems/RosterStore';
import {Parley} from '../systems/Parley';
import {freeSpawn} from '../systems/SpawnClear';
import {luoyangRuins,xiaquyangAltarCamp} from '../systems/ChapterDressing';
import {DUAL, DualBoss, retreatFade, type DualCtrl, type DualPlan} from '../systems/DualBoss';
import {BattleOrders} from '../systems/BattleOrders';
import {OrdersPanel} from '../ui/OrdersPanel';
import {BattleMap} from '../ui/BattleMap';
import type {BossMount as BossMountT} from '../systems/BossMount';
import {SURRENDER,surrenderDef} from '../data/surrender';
import {honoredIds,markSurrender,surrenderedIds,surrenderLive} from '../systems/SurrenderStore';
import { StoryDirector, campTalkStrip, setStoryFlag, storyBark, castBark, type StoryCtx } from '../systems/Story';
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
import {buildVfx,comboFx} from '../systems/BuildVfx';
import {COMBOS} from '../data/schoolCombos';
import {SchoolSynergy} from '../systems/SchoolSynergy';
import {SchoolBanner} from '../ui/SchoolBanner';
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
import { drawBuildOverview } from '../ui/BuildOverview';
import { meritFromKills } from '../data/merit';
import { DeathFx, deathFxMode, type DeathOpts } from '../systems/DeathFx';
import { DEATHFX_LABEL, deathFxSetting, setDeathFx, type DeathFxSetting } from '../systems/BattleSettings';
import { CHARM_LEGEND, CHARM_SCHOOL_NAMES, CHARM_SET_DESC, charmDef, type CharmSchool } from '../data/charms';
import {SishuiObstacles} from '../systems/SishuiObstacles';
import {SishuiPass,type PassHost} from '../systems/SishuiPass';
import {Cutscene,cutsceneAllowed,type CutHost} from '../systems/Cutscene';
import type {CutsceneScript} from '../data/cutscenes/types';
import {DongzhuoLubu} from '../systems/DongzhuoLubu';
import {AllyPush} from '../systems/AllyPush';
import {LUOYANG} from '../data/dongzhuo';
import {HuaxiongBoss} from '../systems/HuaxiongBoss';
import {getXingyangEncounter,XINGYANG_AMBUSH} from '../data/xingyang';
import {XurongBoss} from '../systems/XurongBoss';
import {getSishuiEncounter} from '../data/sishui';
import {BattlefieldSupplies,MAX_PROP_SLOTS,POUCH_MAX,potionTexture} from '../systems/BattlefieldSupplies';
import {YellowBattle} from '../systems/YellowBattle';
import {XiliangBattle} from '../systems/XiliangBattle';
import {dongzhuoStageUnlocked,yellowStageUnlocked,unlockedTroopKinds} from '../world/WorldStore';
import {REPLAY_CLEARED} from '../data/replayRules';
import {abandonExpedition,beginExpedition,settleExpedition,permanentEffects,worldUnlocked,worldChapterCleared,takeExpeditionReserve} from '../world/WorldStore';
import Phaser from 'phaser';
import { PAD, PAD_LABEL, gamepad, keyHint } from '../platform/gamepad';
import { bossProfile, BOSS_PROFILES } from '../data/bossMusic';
import { titleOf } from '../ui/StoryBarkCardStyles';
import { onBattleEnd, unlock as unlockAchievement, addCounter, checkWorld } from '../systems/Achievements';
import { loadWorld as loadWorldState } from '../world/WorldStore';
import { ArtEffects } from '../systems/ArtEffects';
import { BattlefieldDetails } from '../systems/BattlefieldDetails';
import { WAR, warText, ensureWarTextures } from '../ui/WarStyle';
import { LQ, lqButton, lqDivider, lqHitBox, lqImageButton, lqPanel, lqSkin, type LqState } from '../ui/LacquerKit';
import { chapterUnlocked, isChapterTestRun, recordChapterVictory } from '../systems/ChapterProgress';
import { BALANCE, BATTLE_ZOOM_DESKTOP, COLORS, DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, IS_DESKTOP, RENDER_SCALE, TITLE_FONT, actorDepth, screenPoint } from '../config';
import {upgradeCardTexture,inkUpgradeCardTexture,inkPlate,homeCommand,inkSkin} from '../ui/HomeCommand';
import { RESULT_GOLD, RESULT_IVORY, RESULT_STROKE, buildRewardView, parseHeroLine, playResultAnims, wan, type ResultAnim } from '../ui/ResultRewards';
import { loadBagArt } from '../ui/ItemQuality';
import { bagBundle, type BagBundle } from '../ui/BagBundleButton';
import { HeroStatusFrame } from '../ui/HeroStatusFrame';
import { BossHud } from '../ui/BossHud';
import type { EnemyDef } from '../data/enemies';
import { WEAPON_META, weaponName, buildUpgradeOptions, canOfferRejuvenation } from '../data/upgrades';
import { waveIndexAt } from '../data/waves';
import { getChapter, getBattleChapter, chapterBossTime, type ChapterDef } from '../data/chapters';
import { BattleFeedback } from '../systems/BattleFeedback';
import { LubuBoss } from '../systems/LubuBoss';
import { ZhangjiaoBoss } from '../systems/ZhangjiaoBoss';
import { MountRideHint } from '../systems/MountGuide';
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
import { RunGrowth, ATTRIBUTE_INFO, attributeCap, attributeIcon, type AttributeId } from '../systems/RunGrowth';
import { BossPace } from '../systems/BossPace';
import { addMerit, addScrolls, getXinde, SCROLL, temperBonus } from '../systems/MasteryStore';
import { primaryAttribute, PRIMARY_PERK, PRIMARY_PERK_INFO, PRIMARY_TIERS, PRIMARY_MUL, SPELL_WEAPONS } from '../data/attributes';
import { chaptersOpen, stageCleared, takeAttrNotice } from '../systems/HeroProgress';
import { allocateHeroAttr, claimFirstClear, creditHeroXp, enlistHero, heroFreePoints, heroInfo, heroLevel, levelCap, setHeroProgress, suggestedLevel, type HeroKey } from '../systems/HeroProgress';
import { HERO_XP_RATE, OVERFLOW_XP_PER_GRAIN, PICK_GUARANTEE, PICK_PACE, XP_SHIFT, chapterXpMul } from '../data/heroLevels';
import { attributePointsBetween } from '../systems/RunGrowth';
import { vigorHp } from '../data/attributes';
import { CHAPTER_INDEX, PHASES, PHASE_BARKS, buildPhasePlan, phasedPace, type PhaseKind, type PhasePlan } from '../data/stagePhases';
import { StagePhaseRunner } from '../systems/StagePhases';
import { BattleFortunes } from '../systems/BattleFortunes';
import { BattleHeal } from '../systems/BattleHeal';
import { BATTLE_HEAL } from '../data/battleHeal';
import { TentEdgeHints, registerTents, tentMarks, type TentCtx } from '../systems/SpawnTents';
import type { CampTier } from '../data/campSiege';
import { GATE_SPAWN, isRangedSpawn } from '../data/gateSpawn';
import { CampSiege } from '../systems/CampSiege';
import { FORTUNE, FORTUNE_EVENT, rollFortuneBuffs, type FortuneEventKind } from '../data/fortunes';
import { applyStageBuff, clearStageBuffs } from '../systems/StageBuffs';
import { BOUNTIES, GAMBLES, JINNANG, NEW_CARDS, chestCharmCard, drawNewCards, type BountyId, type GambleId, type JinnangId } from '../systems/LevelCards';
import { rollCharm } from '../data/items';
import { SCHOOL_IDS } from '../data/schools';
import type { NewCardSource } from '../data/upgrades';
import { BattleTrack } from '../ui/BattleTrack';
import { addProvisions, gainProvisions } from '../world/WorldStore';
import { medicChapter } from '../data/campMedic';
import { worldMedicChapter } from '../town/CampMedic';
import { applyCarriedHp, patchCampaignHp, patchCampaignBuild, loadCampaignBuild, packCampaign, restoreCampaign, saveCampaignBuild, type CampaignTransfer } from '../systems/Campaign';
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
import {addItems,claimRunLoot,depositRunLoot,grantHorse,heroHorse,ownedHorses,tokenSlots} from '../systems/ItemStore';
import { ItemTooltip } from '../ui/ItemTooltip';
import { primarySummary } from '../ui/PrimaryAttrInfo';
import {STARTER_HORSE} from '../data/mounts';
import {storyScroll} from '../ui/StoryScroll';
import {MERCHANT_HORSE_REWARD,markMerchantStorySeen,merchantHorseLines,merchantStorySeen} from '../data/storyMerchantHorse';
import {horseForReward,horseQuality} from '../data/mounts';
import {HeroMount} from '../systems/HeroMount';
import { DraggingBladeFx } from '../systems/DraggingBladeFx';
import { FlankFx } from '../systems/FlankFx';
import { WindstepFx } from '../systems/WindstepFx';
import { EnvInteractions } from '../systems/EnvInteractions';
import { envConfigFor, type Faction } from '../data/envInteractions';
import { Terrain } from '../systems/Terrain';
import { attrBadge } from '../ui/AttrBadge';
import { AttributePanelView } from '../ui/AttributePanelView';
import { dmgFontKey } from '../ui/DamageFont';
import { baseEquiv, baseStat, statMultiplier, statSource } from '../data/heroStats';
import { ATTRIBUTE_IDS } from '../data/attributes';
import { PROP_LOOT, rollPropItem, rollPropQuality, type PropLootKind } from '../data/propLoot';
import { terrainConfigFor } from '../data/terrain';
import { stageMapFor } from '../data/stageMaps';
import { StageArena } from '../systems/StageArena';
import { Tutorial } from '../systems/Tutorial';
import { IffOverlay, readIffMode, warmIffTextures, type IffUnit } from '../systems/IffOverlay';
import {ORDERS_PANEL_LABEL, ordersPanelSetting, setOrdersPanelSetting, type OrdersPanelSetting, SCHOOL_HINT_LABEL, schoolHint, setSchoolHint, type SchoolHint, BARKS_LABEL, heroBarks, setHeroBarks, type HeroBarks, STORY_LABEL, setStoryMode, storyMode, type StoryMode, OPENING_LABEL, openingMode, setOpeningMode, type OpeningMode } from '../systems/BattleSettings';
import { HeroBark, type BarkSpeaker } from '../ui/HeroBark';
import { ZhaoyunPassiveFx } from '../systems/ZhaoyunPassiveFx';
import { PassiveGauge } from '../systems/PassiveGauge';
import { BattleHotkeys, HotkeyHints } from '../systems/BattleHotkeys';
import { hotkeyLabel } from '../data/hotkeys';
import { hotkeySettingsLink } from '../ui/HotkeySettingsUI';
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
import {capLootQuality,itemName,lootBand,QUALITIES,relicDef,rollItem,rollQuality,SPECIALS} from '../data/items';
import {BossChest,playBossFall,type ChestLoot} from '../systems/BossChest';
import {preloadBossDeath} from '../systems/BossDeathArt';
import {ItemBagUI} from '../ui/ItemBagUI';
import { enemyArrowTexture } from '../systems/ArrowPalette';
import { EnemyTraits } from '../systems/EnemyTraits';
import { LuoyangCamps } from '../systems/LuoyangCamps';
import { EnemyFlowField, type FlowBox } from '../systems/EnemyFlowField';
import { HitFeel, BossStagger } from '../systems/HitFeel';
/** 武将序列帧的透明度与时长（缺省 1 / 450 毫秒）。2026-11-17 用户：「张飞攻击特效有点太夸张」「魏延也是」→ 张飞声浪 / 断桥怒吼、魏延劈地 / 裂波 / 谁敢杀我 调淡、调短。 */
const HERO_FX_TONE: Record<string, { alpha: number; ms: number }> = {
  roarWave: { alpha: .62, ms: 340 }, roar: { alpha: .7, ms: 380 },
  weiyanSlash: { alpha: .72, ms: 340 }, crack: { alpha: .7, ms: 360 }, whoDares: { alpha: .68, ms: 400 },
};
import { HIT_FEEL, BOSS_FEEL, WEAPON_HIT_TYPE } from '../data/hitFeel';
import { GEM_FX } from '../data/gemFx';
import { heroAttributeExtra } from '../data/heroMechanics';
import { BuildState } from '../data/builds';
import { WEAPON_OVER, branchById, branchesFor, branchStatus, fitBranch, BRANCH_FIT, type WeaponBranch } from '../data/weaponBranches';
import { openBranchPanel } from '../ui/BranchPickPanel';
import { WeaponBranches } from '../systems/WeaponBranches';
import { layoutRich, SCOPE_BADGE, cardScope } from '../ui/CardRichText';
import { checkHeroJoins } from '../ui/HeroJoinReveal';
import {StatusFx} from '../systems/StatusFx';
import {JinnangFx} from '../systems/JinnangFx';
import { MECHANICS, mechOpen, mechRefresh, mechShown, takeMechEvent, takeMechIntros, type MechId } from '../data/mechanicUnlocks';

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
  text: Phaser.GameObjects.BitmapText;
  /** 暴击时数字左侧的小「暴」字 */
  tag?: Phaser.GameObjects.Text;
  life: number;
  vx: number;
  vy: number;
  active: boolean;
}
type DmgKind = 'hit' | 'crit' | 'spell' | 'boss' | 'heal' | 'ally';
/** 打障碍物：主将身边这么远内没有敌人时，去打这么远内最近的可破坏物件（挡路的不论有没有敌人都打）。 */
const OBSTACLE_REACH = 300;
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
  /** 说明正文（数字高亮，ui/CardRichText）；desc 只留纯文本给测试读、不显示。 */ rich: Phaser.GameObjects.Container;
  /** 有效范围徽记：本关有效 / 本次征程 / 一次性 / 永久。 */ scope: Phaser.GameObjects.Text;
  w: number; h: number; baseY: number; medal: { x: number; y: number; r: number };
  accent: number; rare: boolean; hover: boolean; lift: number;
}
/** 三选一卡片类别色。 */
const UPGRADE_ACCENT: Record<string, number> = { weapon: 0xc9973a, martial: 0x2f9e7e, tactic: 0x2f8a8a, treasure: 0xd08f2a, attribute: 0x3f78a8, potion: 0xb04a32, trinket: 0x8a5cb8, foundation: 0x7a8a46, relic: 0xc9a030, rare: 0xb04a3a, passive: 0x4a8a6a };

interface ChasingBoss {enemy:Enemy;life:number;stage:number;name:string;battle:YellowBattle|null;huaxiong:HuaxiongBoss|null;xurong:XurongBoss|null;label:Phaser.GameObjects.Text;}

/** story：战中剧情卷轴（第七章落凤坡等），只冻结战斗、不显示其他面板。 */
type Mode = 'none' | 'map' | 'levelup' | 'pause' | 'attributes' | 'result' | 'recruit' | 'aid' | 'rest' | 'bossloot' | 'parley' | 'story' | 'branch';

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
  // ———— 首领招降（systems/Parley.ts + data/surrender.ts） ————
  parley:Parley|null=null;
  /** 劝降成功走击杀流程时的标记：不倒地、不播死亡慢动作、不掉首领宝箱。 */
  protected persuadeKill=false;
  /** 本关首领在招降表里的键（章节 arc-关:首领 id）；场景覆盖。null = 不招降（攻城、军情、试炼关等）。 */
  protected surrenderKey():string|null{
    if(this.runConfig.encounter||this.customChapter())return null;
    if(this.chapter.id==='huangjin')return `huangjin-${this.chapter.stage??1}:${this.chapter.bossStyle}`;
    if(this.chapter.id==='hulao')return `hulao-${this.chapter.westStage??3}:${this.chapter.bossStyle}`;
    return null;
  }
  /** 本关的招降旗标（如官渡乌巢粮仓尽焚）；场景覆盖。 */
  protected parleyFlags():Record<string,boolean>{return {};}
  protected startParley(boss:Enemy):void{
    this.parley?.clear();this.parley=null;
    this.parley=this.makeParley(()=>this.boss,surrenderDef(this.surrenderKey()));
    void boss;
  }
  /** 建一个招降控制器（单首领：本关首领；双首领：每人一个，partner = 同伴结果加减把握）。 */
  protected makeParley(boss:()=>Enemy|null,def:ReturnType<typeof surrenderDef>,dual?:{partner:()=>{id:string;persuaded:boolean;executed:boolean}|undefined}):Parley|null{
    if(!mechOpen('parley'))return null; // 玩法逐章解锁：劝降 3-1 开放
    return Parley.for({scene:this,boss,mode:()=>this.mode,setMode:m=>this.setMode(m as Mode),over:()=>this.over,now:()=>this.combatNow,
      ctx:()=>({honored:honoredIds(),lord:lordHero()??this.runConfig.character,team:[this.runConfig.character,...(this.followers?.members??[]).map(m=>m.recruit.hero??'').filter(Boolean)],surrendered:surrenderedIds(),followerBosses:(this.followers?.members??[]).map(m=>(m.recruit as {boss?:string}).boss??'').filter(Boolean),flags:this.parleyFlags(),partner:dual?.partner()}),
      wenjiu:()=>!!this.sishuiPass?.wenjiuLive(),banner:(t,d,c)=>this.showWaveBanner(t,d,c),sfx:k=>this.sfx.play(k),
      bark:(t,name,text)=>{if(storyMode()==='off')return false;storyBark(this,t,name,text);return true;},
      kill:b=>this.killEnemy(b),persuaded:b=>{this.persuadeKill=true;b.invulnerable=false;b.hp=0;this.killEnemy(b);},
      opened:dual?p=>{this.parley=p;}:undefined},def);
  }
  // ———— 双首领关（systems/DualBoss.ts，dual-boss-spec） ————
  dual:DualBoss|null=null;
  /**
   * 开双首领：子类在 spawnBoss 建好第一位首领的控制器之后调用。第一位当场入列（招降窗、坐骑按双将规则重建），
   * 第二位 1.2 秒后从 second.at 登场（暗场减半）。keys = 两人在招降表里的键（null = 不弹窗）。
   */
  protected startDual(plan:DualPlan,first:{id:string;name:string;enemy:Enemy;ctrl:DualCtrl;mount?:BossMountT|null;ownKit?:boolean;key:string|null},
    second:{id:string;name:string;at:{x:number;y:number};def:Partial<EnemyDef>;key:string|null;make:(e:Enemy)=>{ctrl:DualCtrl;mount?:BossMountT|null;ownKit?:boolean}}):void{
    this.parley?.clear();this.parley=null;this.bossMount?.destroy();this.bossMount=null;
    const now=this.combatNow,s=this;
    const d=this.dual=new DualBoss({scene:this,player:()=>this.player,banner:(t,danger,c)=>this.showWaveBanner(t,danger,c),sfx:k=>this.sfx.play(k),
      // 双首领台词：说话人有对白立绘 → 侧边立绘卡（2026-11-19 双首领第二批），没有 → 头顶大字
      bark:(t,name,text)=>{if(storyMode()!=='off')castBark(this,t,name,text,d.entries.find(x=>x.name===name)?.id);},
      storyFall:(id,at)=>!!this.storyDir?.bossFall(at,id),
      retire:e=>{if(!e.active)return;e.invulnerable=false;e.hp=0;this.killEnemy(e);},
      setPrimary:(e,p)=>{s.boss=e;if(p!==undefined)s.parley=p;},
      trail:(()=>{const last=new Map<number,number>();return (id:number,ratio:number)=>{const rn=performance.now(),dt=Math.min(.25,(rn-(last.get(id)??rn))/1000);last.set(id,rn);this.bossStagger.track(id,ratio);return this.bossStagger.trailRatio(ratio,rn,dt);};})(),
      live:()=>surrenderLive(),setFlag:(k,v)=>setStoryFlag(k,v),
      hurt:(e,dmg)=>{this.hitEnemy(e,dmg,this.combatNow,'melee',true,false);},
      doubleSurrender:g=>{if(surrenderLive())gainProvisions(DUAL.doubleProvisions);this.showWaveBanner(g+' · 同归麾下',false,'双双归降 · 军粮 +'+DUAL.doubleProvisions);this.sfx.play('gong');},
      spawn:(k,x,y)=>this.spawnEnemy(k,x,y,1,true)},plan,now);
    const mk=(e:Enemy,key:string|null)=>{const ref:{x?:ReturnType<DualBoss['entryOf']>}={};const p=this.makeParley(()=>ref.x&&!ref.x.done&&e.active?e:null,surrenderDef(key),{partner:()=>ref.x?d.partnerOdds(ref.x):undefined});return {p,ref};};
    {const {p,ref}=mk(first.enemy,first.key);ref.x=d.add({id:first.id,name:first.name,enemy:first.enemy,ctrl:first.ctrl,parley:p,mount:first.mount??null,ownKit:first.ownKit},now);}
    if(plan.lines[first.id]?.intro)this.time.delayedCall(200,()=>{if(first.enemy.active&&storyMode()!=='off')castBark(this,first.enemy.sprite,first.name,plan.lines[first.id].intro!,first.id);});
    this.announceBoss(plan.group,first.name+' · '+second.name);
    d.later(now+DUAL.entranceGapMs,()=>{
      const e=this.spawnEnemy('boss',second.at.x,second.at.y,1,true,{...this.chapter.enemies.boss,...second.def} as EnemyDef);if(!e)return;
      const made=second.make(e),{p,ref}=mk(e,second.key);
      ref.x=d.add({id:second.id,name:second.name,enemy:e,ctrl:made.ctrl,parley:p,mount:made.mount??null,ownKit:made.ownKit},this.combatNow);
      this.presence?.entrance(e,.5);this.sfx.boss();
      const line=plan.lines[second.id]?.intro;if(line&&storyMode()!=='off')castBark(this,e.sprite,second.name,line,second.id);
    });
  }
  /** 首领出场点（默认主将正北 430）；城墙封死的关覆盖，别刷到墙那边过不来（城墙专项 W5）。 */
  protected bossSpawnPoint(x:number,y:number):{x:number;y:number}{return {x,y};}
  /** 本关敌方势力（营具 / 军旗）；篇章场景按章节.关覆盖（data/sceneLooks.ts ARC_FACTIONS），null = 照 envConfigFor。 */
  protected sceneFaction():number|null{return null;}
  /** 单首领「败退型」（8-1 张郃、5-3 曹仁、4-1 颜良）：打到底不倒地，淡出退走。子类据此不播控制器倒地帧。 */
  protected bossRetreats(enemy:Enemy):boolean{return enemy===this.boss&&!this.dual&&surrenderDef(this.surrenderKey())?.tier==='retreat';}
  /** 败退型的退兵台词：招降表 retreat 句（8-1 张郃），没有时用剧本 bossFall（5-3 曹仁、4-1 颜良）。 */
  protected retreatLine(at:{x:number;y:number;displayHeight:number}):boolean{const d=surrenderDef(this.surrenderKey());if(d?.retreat){if(storyMode()==='off')return false;storyBark(this,at,d.name,d.retreat);return true;}return !!this.storyDir?.bossFall(at);}
  /** 测试 / 调试：直接做选择（旧接口，第六章测试沿用）。 */
  /** 正开着劝降面板的那一份 Parley：双首领关面板属于各首领自己的 Parley（DualBoss entries），this.parley 可能是另一位或空（2026-11-20 修：手柄 / choose 在双首领关点不动）。 */
  protected openParley():Parley|null{if(this.parley?.state==='open')return this.parley;for(const x of this.dual?.entries??[])if(x.parley?.state==='open')return x.parley;return this.parley;}
  choose(c:'persuade'|'execute'|'press'):void{this.openParley()?.choose(c);}
  /** 斩杀奖励（含劝降失败后斩杀、宁死不降）：军粮 +25；本存档首次斩杀此人额外一件紫色兵装（spec §6，防刷）。 */
  protected parleyExecuteRewards(out:ChestLoot[]):void{
    const p=this.parley;if(!p||p.persuadedOk||!surrenderLive())return;
    gainProvisions(SURRENDER.executeProvisions);const first=markSurrender('executed',p.def.id);
    if(first){const q=capLootQuality('purple',this.itemTier()),item=rollItem(q,Math.random,undefined,this.lootChapter());addItems([item]);out.push({name:`${QUALITIES[q].label}色兵装一件 · 军粮 +${SURRENDER.executeProvisions}`,desc:'首次斩杀此将所得 · 已入行囊',tag:'斩杀'});}
    else out.push({name:`军粮 +${SURRENDER.executeProvisions}`,desc:'斩将所得',tag:'斩杀'});
    // 宁死不降之将不能白打（surrender-rules.md）：本存档首次斩杀后以礼厚葬，军粮 +60、仁名 +1（仁名算进以后的劝降把握）
    if(p.def.tier==='never'&&markSurrender('honored',p.def.id)){gainProvisions(SURRENDER.persuadeProvisions);out.push({name:`厚葬${p.def.name} · 军粮 +${SURRENDER.persuadeProvisions} · 仁名 +1`,desc:p.def.reason??'忠烈之士，以礼厚葬',tag:'厚葬'});}
  }
  /** 正在播的过场动画（systems/Cutscene.ts）。 */
  cutscene:Cutscene|null=null;
  /** 最近一段过场（测试读日志用）。 */
  lastCutscene:Cutscene|null=null;
  /** 过场结束的时刻（真实时间 ms）：过场中与结束后 1 秒内压住武将台词（HeroBark），免得镜头刚回来就冒「来将通名！」。 */
  private cutsceneEndedAt=-Infinity;
  /** 排队中的首领台词（剧情台词之后主将接一句）；过场开播时取消。 */
  private bossBarkTimer?:Phaser.Time.TimerEvent;
  /** 武将出招起手特效（systems/HeroCastFx.ts） */
  heroCastFx?: HeroCastFx;
  /** 首领血条换人时淡入（bossBarKey = 当前显示的是谁）。 */
  /** 首领血条（ui/BossHud.ts，每帧画）。 */
  bossHud?: BossHud;
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
    guanyu:()=>this.runConfig.character==='guanyu'||followersFor(this.runConfig.character).some(r=>r.hero==='guanyu'),tent:this.tentCtx()};}
  /** 2-1 汜水关：关墙、箭楼、西凉营帐、关门（systems/SishuiPass.ts）。 */
  sishuiPass:SishuiPass|null=null;
  /** 2-3 洛阳：董卓与吕布同场（systems/DongzhuoLubu.ts）。 */
  dzLubu:DongzhuoLubu|null=null;
  protected runConfig: RunConfig = DEFAULT_RUN_CONFIG;
  protected chapter: ChapterDef = getChapter();
  protected lubu: LubuBoss | null = null;
  /** 张角重设计样板（?boss=old 回到旧版）。 */
  protected zhangjiao: ZhangjiaoBoss | null = null;
  /** 战斗里第一次骑马的操作提示（测试读）。 */
  mountHint?: MountRideHint;
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
  protected terrain: Terrain | null = null; private terrainInit = false;
  /** 有边场地（data/stageMaps，按剧情定场地）：边界、守边、刷兵关口、场景互动；没配的关为 null（无限大场地）。 */
  protected arena: StageArena | null = null; private arenaInit = false;
  /** 各章新兵种机制（data/enemyRoster，systems/EnemyTraits）。 */
  protected traits: EnemyTraits | null = null;
  /** 2-3 洛阳五座营寨：营栅、守军、援兵（systems/LuoyangCamps）。 */
  luoyangCamps: LuoyangCamps | null = null;
  /** 小地图 / 测试读：本关场地边界（无限大场地为 null）。 */
  get stageBounds() { return this.arena?.info ?? null; } private terrainNav: Array<{left:number;right:number;top:number;bottom:number}> = [];
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
  /** 战场地图 · 军令（battle-map-design.md）：军令表手机也有；军令面板与小地图只在电脑布局建。 */
  battleOrders:BattleOrders|null=null;allyPush:AllyPush|null=null;
  /** 兵阵 4 势「援军」：义军小队（AllyPush 的 escort 模式，独立于 2-3 的友军攻势），reinforceAt = 下一队的时刻。 */
  reinforce:AllyPush|null=null;private reinforceAt=0;
  /** 助战兵（兵阵援军、十面埋伏伏兵、铁骑冲阵骑卒、铁壁军阵）共用一个 AllyPush（escort 模式，不打营寨）。 */
  private reinforcePush():AllyPush{return this.reinforce??=new AllyPush({scene:this,now:()=>this.combatNow,paused:()=>this.mode!=='none'||this.over||!!this.cutscene?.active,player:()=>this.player,camps:()=>[],enemies:()=>this.enemies,hit:(e,d)=>{this.hitEnemy(e,d,this.combatNow,'melee',true,false);},push:(x,y,r)=>this.terrain?.pushCircle(x,y,r)??null},{...LUOYANG.push,firstMs:1e15,everyMs:1e15});}private ordersPanel:OrdersPanel|null=null;/** 军令面板开着（电脑布局）：子场景据此收起自己的目标行，免得和面板重复。 */protected get ordersPanelOn():boolean{return !!this.ordersPanel;}battleMap:BattleMap|null=null;
  protected supplies:BattlefieldSupplies|null=null;
  /** 道具掉落与本局缴获（局外兵装，结算带回行囊）。 */
  protected itemDrops:ItemDrops|null=null;
  /** 战场回血：干粮 / 酒肉、泉眼 / 水井、军中伤药、低血保护（systems/BattleHeal，用户 2026-11-19「地图上也需要更多回血手段」）。 */
  battleHeal:BattleHeal|null=null;
  /** 刷兵帐篷的屏外边缘提示（systems/SpawnTents）。 */
  tentHints:TentEdgeHints|null=null;
  /** 营寨攻坚（systems/CampSiege，用户 11-20「营寨太容易被摧毁了」）。 */
  campSiege:CampSiege|null=null;
  /**
   * 首领关卡的「先拆才能打 / 才出场」物件（12-3 营垒、10-2 连营、12-2 陈仓城门）：
   * 加 lockTarget——所有武器（范围 / 环绕 / 近战）都当敌人打（原来只有单体武器在射程内会打，赵云这类环绕武器站在营垒边 74 秒还拆不完）；
   * 舆图画小帐、屏外边缘提示；tier 给了就加营寨攻坚的每秒掉血上限（保留关卡设计的耐久，不刷守军 / 伏兵 / 守将）。
   */
  markGate(e:Enemy,tier?:CampTier):void{e.lockTarget=true;this.gateSet.add(e);if(tier)this.campSiege?.add(e,tier,{guards:false,phases:false,keepHp:true});this.gateUnreg??=registerTents(this,()=>[...this.gateSet].filter(o=>o.active&&o.hp>0).map(o=>({x:o.x,y:o.y,ratio:o.hp/Math.max(1,o.maxHp),hit:false,awake:true})));}
  private gateSet=new Set<Enemy>();private gateUnreg:(()=>void)|null=null;
  /** 刷兵帐篷统一规则的上下文（data/spawnTents）：章节、首领是否出场、同屏敌兵数、拆营奖励（随军粮 + 干粮）。 */
  tentCtx():TentCtx{return{chapter:()=>this.phasePlan?.chapter??CHAPTER_INDEX[this.hardKey()]??2,bossOn:()=>this.bossSpawned,crowd:()=>this.activeEnemyCount(),sfx:k=>this.sfx.play(k),reward:(x,y,g,food)=>{this.legion.food+=g;if(food)this.battleHeal?.dropFood(x+24,y+18,BATTLE_HEAL.food.grain.ratio,BATTLE_HEAL.food.grain.name);},armor:(e,tier,o)=>this.campSiege?.add(e,tier,o),campMul:e=>this.campSiege?.intervalMul(e)??1};}
  /** 场景可放东西的位置：夹进场地、挪出墙 / 营栅 / 房子，再避开水与树（机缘、回血点共用）。 */
  /**
   * 这一点是不是在关闭的城墙 / 关墙后面（城门还没破）：是就返回墙线（世界 y，墙内 = y 小于墙线）。
   * 基类管 SishuiPass 关墙（2-1 汜水关、1-3 广宗、第三章起城池 / 关隘型营寨关）；陈仓、樊城在子类里补（data/gateSpawn、共享笔记 siege-spawn-audit.md）。
   */
  protected behindClosedWall(x:number,y:number):{line:number}|null{const s=this.sishuiPass;return s&&s.behind(x,y)?{line:s.wallLine}:null;}
  /** 「城门没破前墙内只刷远程」的计数（测试读）。 */
  readonly wallSpawn={inside:0,mirrored:0,capped:0};
  private wallRangedCount(line:number):number{let n=0;for(const e of this.enemies)if(e.active&&!e.isSupplySlot&&e.kind!=='boss'&&e.y<line&&isRangedSpawn(e.kind,e.def))n++;return n;}
  protected fieldPlace(x:number,y:number):{x:number;y:number}{ {const w=this.behindClosedWall(x,y);if(w)y=w.line+Math.max(GATE_SPAWN.outsideMin,w.line-y);} /* 机缘 / 回血点不放进还关着门的城里 */ let p = { x, y }; if (this.arena) p = this.arena.clampPoint(p.x, p.y); const fp = this.sishuiObstacles?.footprints; if (fp?.length) { const f = freeSpawn(fp, p.x, p.y, 48, this.player); p = { x: f.x, y: f.y }; if (this.arena) p = this.arena.clampPoint(p.x, p.y); } if (this.terrain) p = this.terrain.free(p.x, p.y, 48); return p; }
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
  /** 右上手绘包袱（行囊）按钮。 */
  private bagBundle?: BagBundle;
  /** 左上主将状态框（电脑布局；ui/HeroStatusFrame.ts）。 */
  statusFrame?: HeroStatusFrame;
  private hudAttrBadge?: Phaser.GameObjects.Image;
  protected passiveHud!: PassiveHud; protected passiveShout!: PassiveShout; protected heroBark!: HeroBark;
  /** 赵云被动「七进七出」：脚下龙鳞层数 + 满层白龙枪芒 / 绕身一闪 / 突进残影。 */
  zhaoyunFx!: ZhaoyunPassiveFx;
  /** 武将脚下被动刻度（赵云龙鳞也由它转发）。 */
  passiveGauge!: PassiveGauge;
  /** 战斗快捷键与键位提示（systems/BattleHotkeys；键位表 data/hotkeys）。 */
  hotkeys!: BattleHotkeys; protected hotkeyHints!: HotkeyHints;
  private buffHud!:BuffHud;
  /** 合击 / 觉醒小签（测试读 stats）。 */
  schoolBanner?:SchoolBanner;
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
  /** 军阵（systems/FormationRuntime）：当前阵、变阵冷却。 */
  formationRt?:FormationRuntime;
  /** 军阵表现：地面阵纹、变阵竖旗（systems/FormationFx）。 */
  formationFx?:FormationFx;
  /** 敌方军阵（systems/EnemyFormations）。 */
  enemyForms?:EnemyFormations;
  private buffProgress(id:string,now:number):BuffProgress|null{
    if(id==='formation')return this.formationRt?.progress(now)??null;
    if(id.startsWith('awakening_'))return this.synergy?.progress(id,now)??null;
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
  /** 首领走路提速 / 追击（systems/BossPace，测试读 stats）。 */
  bossPace?: BossPace;
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
  private buildCombat!:BuildCombat;private statusFx?:StatusFx;private jinnangFx?:JinnangFx;
  private controlBuild?:ControlBuild;
  private bulwarkBuild?:BulwarkBuild;
  /** 流派合击（部曲 / 伏兵 / 背水一战）+ 六派觉醒（2026-11-19 流派重做第 2 期）。 */
  synergy?:SchoolSynergy;
  private relicWaveGfx!:Phaser.GameObjects.Graphics;private relicWaves:Array<{x:number;y:number;at:number}>=[];
  private firstBossAt=-1;private settledFrontlineKills=0;private frontlineNextSettlement=1;
  private frontlineVictories=new Map<number,{elapsed:number}>();private frontlineStarts=new Map<number,number>();
  /** 敌兵绕障导航（栅栏 / 营栅 / 城墙等挡住的近战兵绕到缺口）。 */
  readonly enemyFlow=new EnemyFlowField();
  /** 导航用碰撞框：关墙 / 营栅 / 城墙（sishuiObstacles，攻城 / 官渡 / 军情 / 北伐等都放这里）、2-3 城头、战场拒马 / 栅栏等物件（supplies crates，1-3 栏杆）。 */
  private readonly flowBoxBuf:FlowBox[]=[];
  private readonly flowBoxes=():readonly FlowBox[]=>{const out=this.flowBoxBuf;out.length=0;for(const b of this.sishuiObstacles?.footprints??[])out.push(b);for(const b of this.dzLubu?.obstacles.footprints??[])out.push(b);this.supplies?.appendNavigationBoxes(out);return out;};
  /** 碰撞框以外的挡路：地形（山崖 / 树 / 河）、2-3 营寨、场地边界。都没有时不逐格查。 */
  private flowExtra():((x:number,y:number,r:number)=>boolean)|null{const t=this.terrain,l=this.luoyangCamps,a=this.arena;if(!t&&!l&&!a)return null;return (x,y,r)=>!!t?.pushCircle(x,y,r)||!!l?.pushOut(x,y,r)||(!!a&&!a.inside(x,y,r));}
  private chasingBosses:ChasingBoss[]=[];/** 剧情卷轴占用计数（StoryDirector pause / resume）。 */protected storyHolds=0;private deadBossControllers:Array<HuaxiongBoss|XurongBoss>=[];
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
  /** 主线关五段（wave-progression-redesign.md）：本关的段落计划 / 段内事件 / 顶部战况线；不套用的战斗为 null。 */
  protected phasePlan: PhasePlan | null = null;
  private phasedFor: ChapterDef | null = null;
  protected phaseRunner: StagePhaseRunner | null = null;
  protected battleTrack: BattleTrack | null = null;
  /** 战场机缘（P2）：关内事件、待弹的机缘三选一、本关已拿的增益次数。 */
  protected fortunes: BattleFortunes | null = null;
  private fortuneQueue: FortuneEventKind[] = [];
  private fortuneTaken: Record<string, number> = {};
  /** 机缘「烽燧」：到这个时刻前刷兵减半。 */
  private beaconCalmUntil = 0;
  /** 锦囊（新卡池，一次性主动技；身上最多 1 个）。 */
  private jinnang: JinnangId | null = null; private jinnangButton?: Phaser.GameObjects.Container;
  /** P4b 新卡的本关状态：乘胜追击、赌命、悬赏、连环计、草船借箭、首领宝箱信物、本关免费换一批。 */
  private momentum = { on: false, kills: 0, stacks: 0 }; private gambles = new Set<GambleId>();
  private bounties: Partial<Record<BountyId, { elites?: number }>> = {}; private chain = { until: 0, set: new Map<Enemy, number>(), sharing: false };
  private arrows = { until: 0, absorbed: 0 }; private chestPick = false; private freeReroll = true;
  /** 兵器专职分支的战斗效果（本命武器选了分支才有）。 */
  private branchRt: WeaponBranches | null = null; private branchFor: unknown = null;
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
  /** 加点面板的说明卡（主属性一行悬停 / 点按）。 */
  protected attributeTip?: ItemTooltip;
  protected attributePauseText!: Phaser.GameObjects.Text;
  protected attributePointsText!: Phaser.GameObjects.Text;
  protected attributeWeaponText!: Phaser.GameObjects.Text;
  protected attributeSummaryText!: Phaser.GameObjects.Text;
  /** 电脑版「武将修习」面板的新视图（ui/AttributePanelView）；手机仍用旧的四条长条。 */
  protected attributeView?: AttributePanelView;
  protected attributeRows: Array<{ value: Phaser.GameObjects.Text; button: Phaser.GameObjects.Image; plus: Phaser.GameObjects.Text; pips: Phaser.GameObjects.Graphics; pipX: number; pipY: number; perks?: { prefix: Phaser.GameObjects.Text; chips: Phaser.GameObjects.Text[] }; ink?: { plate: Phaser.GameObjects.NineSlice | null; hover: boolean } }> = [];

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
    startCityAmbient(this, k => this.sfx?.play(k), ['amb_wind', 'amb_wind', 'amb_flag'], [9000, 16000]); // 战斗环境声：很稀的风 / 旗声（音效审计第二批）
    this.hadStarterHorse = ownedHorses().some(h => h.id === STARTER_HORSE);
    this.resetState();
    ensureWarTextures(this);
    this.hudAcc = 1; this.lastHudMode = '';
    this.feedback = new BattleFeedback(this);
    { const m = deathFxMode(); this.deathFx = m ? new DeathFx(this, m) : null; } // 敌军死亡特效（缺省 B 脚下尘土；设置可关；?deathfx=a|b|c|off 调试）
    this.hitFeel = new HitFeel(this); this.bossStagger = new BossStagger();
    this.events.once('shutdown', () => { this.anims.globalTimeScale = 1; });
    this.sfx = new Sfx();
    const registryConfig = this.registry.get('runConfig') as RunConfig | undefined;
    const requested = getBattleChapter(registryConfig?.chapter, registryConfig?.stage,registryConfig?.westStage);
    this.chapter = (chapterUnlocked(requested.id) && (!requested.stage || yellowStageUnlocked(requested.stage)) && (!requested.westStage||dongzhuoStageUnlocked(requested.westStage))) || isChapterTestRun() ? requested : getBattleChapter('huangjin',1);
    const encounter=new URLSearchParams(location.search).get('encounter')||registryConfig?.encounter;const preview=encounter==='sishui'||encounter==='xingyang'||encounter==='qunxiong'&&!!this.customChapter();this.encounterPreview=!!new URLSearchParams(location.search).get('encounter'); /* 只有网址 ?encounter= 才是预览；篇章场景的 preview 也为真 */
    if(preview)this.chapter=encounter==='xingyang'?getXingyangEncounter():getSishuiEncounter();
    this.chapter=this.customChapter()??this.chapter;
    this.runConfig = { ...DEFAULT_RUN_CONFIG, ...registryConfig, chapter: this.chapter.id, stage:this.chapter.stage,westStage:this.chapter.westStage };
    if(preview)this.runConfig.encounter=encounter as 'sishui'|'xingyang'|'qunxiong';
    this.music.setBattleTheme(battleThemeFor(this.scene.key,this.chapter.id)); // BGM v2：各章战斗曲
    this.frontlineNextSettlement=this.battleStage();this.frontlineStarts.set(this.battleStage(),this.combatNow);
    const scenery=this.chapter.bossStyle==='huaxiong'?'sishui':this.chapter.bossStyle==='xurong'?'xingyang':null;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.setupUiCamera(); // 电脑布局：战场镜头拉远、HUD 分到 UI 镜头
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
    this.dragFx = undefined; this.flankFx = undefined; this.windFx = undefined; this.skirmishPuffAt = 0; this.env = null; this.envInit = false; this.terrain?.clear(); this.arena?.clear(); this.arena = null; this.traits?.clear(); this.traits = null; this.luoyangCamps?.clear(); this.luoyangCamps = null; this.arenaInit = false; this.terrain = null; this.terrainInit = false; this.terrainNav = []; Ally.terrainMul = null; this.player && (this.player.terrainSpeedMul = 1);
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
    this.legion.onDeath = (_u, now) => { if (this.runConfig.character !== 'mengde') return; this.player.passive.onAllyDeath(now); this.player.heal(this.player.maxHp * (MENGDE.healPct + MENGDE.wangmei * this.player.growth.masteries.wangmei)); }; // 曹操「奸雄」
    this.legion.onHurt = (u, now) => { if (Math.hypot(u.x - this.player.x, u.y - this.player.y) <= TAISHICI.allyR) this.player.passive.onAllyHurt(now); }; // 太史慈「信义」
    this.legion.attackSound = kind => { const k = TROOP_ATTACK_SFX[kind]; if (k) this.sfx.play(k); };
    // 战地免费招兵每波人数随章节增加（档位与掉落一致：一章 0 … 五章 4）
    this.legion.freeRecruitCount = FREE_RECRUIT_BY_TIER[Math.max(0, Math.min(FREE_RECRUIT_BY_TIER.length - 1, this.itemTier()))];
    this.yellow=this.chapter.stage?new YellowBattle({scene:this,player:this.player,army:this.legion,enemies:this.enemies,move:(e,nx,ny,dt)=>this.advanceEnemy(e,nx,ny,dt),spawn:(def,x,y)=>this.spawnEnemy(def.kind,x,y,1,true,def)},this.chapter.stage):null;
    this.xiliang=this.chapter.id==='hulao'&&!this.runConfig.encounter&&!this.customChapter()?new XiliangBattle({scene:this,player:this.player,army:this.legion,enemies:this.enemies,spawn:(kind,x,y,def)=>this.spawnEnemy(kind,x,y,undefined,true,def),stage:()=>(this.chapter.westStage??3) as 1|2|3,elapsed:()=>this.elapsed,def:k=>this.chapter.enemies[k],banner:(t,c)=>this.showWaveBanner(t,true,c),sfx:k=>this.sfx.play(k),boss:()=>this.boss,bossStyle:()=>this.chapter.bossStyle,holdBoss:()=>!!this.dzLubu?.holdsDongzhuo,move:(e,nx,ny,dt)=>this.advanceEnemy(e,nx,ny,dt),obstacles:()=>this.sishuiObstacles?.footprints??[]}):null;
    this.supplies=new BattlefieldSupplies(this,this.player,this.enemies,()=>this.combatNow,kind=>{this.sfx.play('pickup');this.artEffects.show(5,this.player.x,this.player.y-12,35,this.combatNow,280);if(kind==='wine')this.relics?.onWine(this.combatNow);});
    this.propItems = 0; this.supplies.onPropLoot = (kind, x, y) => this.propLoot(kind, x, y);
    // 兵装：开局读入该武将穿戴的道具加成（生命上限增加的部分补满）
    {const oldMax=this.player.maxHp;this.player.growth.gear=gearFor(this.runConfig.character);this.player.heal(this.player.maxHp-oldMax);}
    this.followers=null;this.followerPassives=[];{const allow=worldUnlocked()&&(!isChapterTestRun()||new URLSearchParams(location.search).get('followers')==='1');const list=allow?followersFor(this.runConfig.character):[];if(list.length)this.followers=new FollowerSquad(this,this.player,list,(x,y,r)=>this.grid.query(x,y,r),(e,d,fire)=>this.hitEnemy(e,d,this.combatNow,fire?'fire':'melee',true,false),()=>this.player.growth.damageMultiplier(this.combatNow));if(this.followers){this.followers.onHitFx=(e,k,fx,fy)=>this.followerTemplateHitFx(e,k,fx,fy);this.followers.attackSound=t=>this.sfx.play(FOLLOWER_ATTACK_SFX[t]);this.wireFollowerObstacles(this.followers);}}
    this.applySchoolSources(); // 流派重做：开局的势（亲和 / 随行 / 名马）
    { const mode = readIffMode(); this.iff = mode ? new IffOverlay(this, mode, () => this.iffUnits()) : null; }
    this.presence = new BossPresence({ scene: this, enemies: () => this.enemies, boss: () => this.cutscene?.active || this.dzLubu?.hidesBossBar ? null : this.boss, /* 2-3 城头的董卓不出名牌 / 屏外箭头；过场时收起名牌 / 辉光 / 火环 */ bossName: () => this.chapter.bossName, player: () => this.player,
      bosses: () => this.dual ? (this.cutscene?.active ? [] : this.dual.alive.map(x => ({ e: x.enemy, name: x.name, color: x.color }))) : this.dzLubu?.lubuFocus ? (this.cutscene?.active ? [] : [{ e: this.dzLubu.lubuFocus, name: '吕布' }]) : null,
      extras: e => { const x = this.dual?.entryOf(e); if (x) return [x.mount?.horseImage, x.mount?.frontImage]; return e === this.boss ? [this.bossMount?.horseImage, this.bossMount?.frontImage] : []; }, outline: e => this.iff?.overlayOf(e.sprite) });
    // 震屏设置（强 / 弱 / 关，im_shake，见 systems/BattleSettings）：包一层主相机 shake，现有调用全部按设置缩放
    { const cam = this.cameras.main, orig = cam.shake.bind(cam), T = HIT_FEEL.shakeThrottle; let lastShakeAt = -1e9;
      cam.shake = ((duration?: number, intensity?: number | Phaser.Math.Vector2, force?: boolean, callback?: Phaser.Types.Cameras.Scene2D.CameraShakeCallback, context?: unknown) => {
        const k = shakeScale(); if (k <= 0) return cam;
        // 全局节流（用户「屏幕触发震动太多」）：弱震距上次不足 minGapMs 跳过；强震（首领转阶段 / 倒下）照常
        const raw = typeof intensity === 'number' ? intensity : .005, now = this.time.now;
        if (raw < T.strongAt && now - lastShakeAt < T.minGapMs) return cam;
        lastShakeAt = now;
        return orig(duration, typeof intensity === 'number' ? intensity * k * T.globalMul : intensity, force, callback, context);
      }) as typeof cam.shake; }
    this.shieldBars=new ShieldBars(this);this.events.once('shutdown',()=>{this.shieldBars?.clear();this.shieldBars=null;this.objective?.clear();this.objective=null;this.objectiveText=undefined;});
    // 营寨攻坚要在关卡目标之前建好（破营目标的营寨一放下就登记）
    this.campSiege?.clear();this.campSiege=new CampSiege({scene:this,player:()=>this.player,now:()=>this.combatNow,eliteHp:()=>this.chapter.enemies.elite.hp*this.chapter.hpScale(this.elapsed)*(this.chapter.growth?.hp??1), /* 同 spawnEnemy 的小怪成长 */chapter:()=>this.tentCtx().chapter(),spawn:(k,x,y)=>this.spawnEnemy(k,x,y,undefined,true),
      captain:(x,y)=>{const pr=this.phaseRunner,e=this.spawnEnemy('elite',x,y,undefined,true,pr?pr.captainDef():{...this.chapter.enemies.elite,hp:this.chapter.enemies.elite.hp*3});if(e&&!pr?.ltArt())e.setSizeMul(1.3);return e;},
      sfx:k=>this.sfx.play(k),gem:(x,y,v)=>this.spawnGem(x,y,v),shake:()=>this.cameras.main.shake(220,.005)});this.events.once('shutdown',()=>{this.campSiege?.clear();this.campSiege=null;this.gateUnreg?.();this.gateUnreg=null;this.gateSet.clear();});
    this.setupObjective();
    this.setupBattleMap();
    // 坐骑：马厩里给该武将分配的马（第一章通关后马厩开放；换马只在休整时，下一关出征生效）
    {const horse=heroHorse(this.runConfig.character);this.mount=horse?new HeroMount({barDy:()=>this.passiveGauge?.showing?FOOT_HUD.barBelowGauge:FOOT_HUD.bar,scene:this,player:this.player,enemies:this.enemies,hit:(e,d,now)=>this.hitEnemy(e,d,now,'melee',false,false),notice:t=>this.showGrowthNotice(t)},{base:horse.id,name:horse.name},this.runConfig.character,this.player.growth.gear.specials.includes('hubao')?{trampleMul:RELIC.hubaoTrample,remountMs:RELIC.hubaoRemountMs}:{}):null;this.player.mountGuard=this.mount?(n,now)=>this.mount?.guard(n,now)??n:undefined;this.mountHint=MountRideHint.maybeShow(this,!!this.mount);this.events.once('shutdown',()=>{this.mount?.clear();this.mount=null;});}
    this.bossPace=new BossPace(this as unknown as ConstructorParameters<typeof BossPace>[0]); // 首领走路提速 / 追击（BALANCE.bossPace）
    this.itemDrops=new ItemDrops(this,this.player,this.itemTier(),this.lootChapter(),()=>this.elapsed,()=>this.isFinalBoss(),()=>{this.sfx.play('pickup');this.mechEvent('gear');},()=>this.bossRelicKey());this.itemDrops.deferBossRelic=true; // 首领遗珍由首领宝箱发（BossChest）
    this.tentHints?.destroy();this.tentHints=null;this.battleHeal?.clear();this.battleHeal=new BattleHeal({scene:this,player:()=>this.player,enemies:()=>this.enemies,elapsed:()=>this.elapsed,now:()=>this.combatNow,place:(x,y)=>this.fieldPlace(x,y),dropPotion:(x,y,a,n,f)=>this.supplies?.dropPotion(x,y,a,n,f)??false,overlay:()=>this.mode!=='none'||this.over,sfx:k=>this.sfx.play(k),notice:t=>this.showGrowthNotice(t),moveDir:()=>this.moveDir,potionAt:(x,y)=>!!this.supplies?.potions.some(q=>q.active&&Math.hypot(q.image.x-x,q.image.y-y)<12)});if(this.supplies)this.supplies.landing=(x,y)=>this.battleHeal?.landing(x,y)??{x,y,moved:false};this.battleHeal.setPlan(this.phasePlan);this.events.once('shutdown',()=>{this.battleHeal?.clear();this.battleHeal=null;});
    this.relics=new BossRelics({scene:this,player:this.player,enemies:()=>this.enemies,hit:(e,d,now)=>{this.hitEnemy(e,d,now,'melee',false,false);},notice:t=>this.showGrowthNotice(t)},this.player.growth.gear.specials,this.combatNow);
    this.syncRelicShips();
    this.events.once('shutdown',()=>{this.relics?.clear();this.relics=null;this.relicShips?.clear();this.relicShips=null;});
    // 酒罐 / 药篓不生成在房屋、城墙等障碍里（第三/四章、攻城在 create 之后才设置障碍，故调用时读取）
    // 物件 / 酒罐 / 随机补给的落点：避开障碍框；2-3 洛阳另避开城墙、侧墙、洛水和场地外（原来木箱会刷进河里、城墙后面）
    this.supplies.healBlocked=(x,y,r)=>{const hit=(fp:readonly {left:number;right:number;top:number;bottom:number}[]|undefined)=>!!fp?.some(b=>x>b.left-r&&x<b.right+r&&y>b.top-r&&y<b.bottom+r);return hit(this.sishuiObstacles?.footprints)||hit(this.dzLubu?.obstacles.footprints)||!!this.terrain?.treeNear(x,y,r+60)||(!!this.dzLubu&&!this.dzLubu.inArena(x,y,r));};
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
    // 1-3 广宗决战（全场景审查 P2：「广宗城」只有空地）：北面一道广宗城墙（攻城城墙图集，同 2-1 汜水关那套），城门紧闭，张角在城下列阵
    if(this.chapter.id==='huangjin'&&this.chapter.stage===3&&!this.runConfig.encounter&&!this.customChapter()&&!this.sishuiPass){this.sishuiPass=new SishuiPass(this.passHost(),{towers:false,tents:false,wenjiu:false,wallY:-900,tag:'guangzong',ends:'tower'});this.sishuiObstacles=new SishuiObstacles(this.sishuiPass.footprints);}
    // 场景审查 P3：1-2 下曲阳张宝法坛营、2-3 洛阳火城残垣（systems/ChapterDressing.ts，实心部分进场景碰撞框）
    if(!this.runConfig.encounter&&!this.customChapter()&&((this.chapter.id==='huangjin'&&this.chapter.stage===2)||(this.chapter.id==='hulao'&&(this.chapter.westStage??3)===3&&this.chapter.bossStyle==='dongzhuo'))){if(!this.sishuiObstacles)this.sishuiObstacles=new SishuiObstacles([]);const bx=this.sishuiObstacles.footprints;if(this.chapter.id==='huangjin')xiaquyangAltarCamp(this,this.player,bx);else luoyangRuins(this,this.player,bx);}
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
    // 征程构筑：同章连打用内存里的 transfer；否则主线未通关的关读存档里的征程构筑（重打旧关 / 挑战为空构筑）。
    // 2026-11-20 用户「我发现攻城战之前的build没有了」（统筹定）：攻城 / 守城 / 军情 / 支线攻城关读当前主公的征程构筑但只读（inheritsCampaign）——
    // campaignReplay 仍为真，所以打完不写回（存档点只在主线首次通关时更新），不会刷攻城滚雪球
    this.campaignReplay = !this.stableRewardKey() || stageCleared(this.stableRewardKey());
    const chained = transfer && this.chapter.id === transfer.chapter && this.runConfig.character === transfer.character ? transfer : undefined;
    const carriedState = chained ?? (this.campaignReplay && !this.inheritsCampaign() ? undefined : loadCampaignBuild(this.runConfig.character));
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
    this.player.damageGuard=(n,now)=>{const m=this.bulwarkBuild?.guard(n,now)??n;return this.branchRt?this.branchRt.guard(m):m;}; // 兵器专职「燕人怒吼」减伤this.legion.defense=this.bulwarkBuild;
    this.events.once('shutdown',()=>{this.bulwarkBuild?.clear();this.bulwarkBuild=undefined;this.player.damageGuard=undefined;});
    this.controlBuild=new ControlBuild(this,this.player.growth.build,(x,y,r)=>this.grid.query(x,y,r));
    this.events.once('shutdown',()=>{this.controlBuild?.clear();this.controlBuild=undefined;});
    const schoolBanner=new SchoolBanner(this,()=>this.mode==='none'&&!this.over,sch=>this.buffHud?.flashSchools(sch));this.schoolBanner=schoolBanner;
    this.synergy=new SchoolSynergy({scene:this,player:this.player,combat:this.buildCombat,nearby:(x,y,r)=>this.grid.query(x,y,r),deal:(e,n,fire)=>{this.hitEnemy(e,n,this.combatNow,fire?'fire':'melee',false,false);},banner:(k,t,sub,sch)=>{schoolBanner.show(k,t,sub,sch);this.sfx.play(k==='combo'?'toast_combo':'toast_awaken');},
      controlled:(e,n)=>this.controlBuild?.isControlled(e,n)??false,slowArea:(x,y,r,k,ms,n)=>this.controlBuild?.slowArea(x,y,r,k,ms,n)??0,escort:(x,y,n,ms)=>this.reinforcePush().spawnEscortAt(x,y,n,ms)?.members.length??0,
      vfx:(st,x,y,size,a=0,ms=360)=>buildVfx(this).emit(st,x,y,this.combatNow,size,a,ms,true),flame:(x,y,r)=>this.spawnFlameFx(x,y,r),
      wind:(x,y,a,size)=>playSheet(this,'fx_gust_band',x,y,{size,ms:420,depth:DEPTH.fx+.05,rotation:a,name:'awaken-wind'}),shake:()=>this.hitFeel.shake('medium'),
      // 觉醒手绘序列帧（第 3 期）：ground = 画在人物脚下；follow = 跟着主将；move = 播放中平移（单骑突阵）
      sheet:(key,x,y,o)=>{const pl=this.player,ox=x-pl.x,oy=y-pl.y,mv=o.move;playSheet(this,key,x,y,{size:o.size,sizeH:o.sizeH,ms:o.ms,depth:o.ground?19:DEPTH.fx+.05,rotation:o.rotation,flipX:o.flipX,originY:o.originY,add:o.add,name:'awaken-'+key.slice(10),
        onUpdate:o.follow?img=>img.setPosition(pl.x+ox,pl.y+oy):mv?(img,t)=>img.setPosition(x+mv.dx*t,y+mv.dy*t):undefined});}});
    this.legion.awakeningDefense={incoming:(_u,n)=>(this.synergy?.allyIncoming(n)??1)*(this.player.growth.build.tier('formation')>=2?1-SCHOOL_TIER.formation.allyTaken:1),onAllyHurt:()=>{}};
    this.events.once('shutdown',()=>{this.synergy?.clear();this.synergy=undefined;});
    // 军阵（formation-design.md）：开局按主线进度读学会的阵与布阵；?formation=off 关掉（只测别的系统时用）
    this.formationRt=undefined;this.player.formationInfo=()=>this.formationRt?.info()??null;
    if(new URLSearchParams(location.search).get('formation')!=='off'){this.formationRt=new FormationRuntime({player:this.player,legion:this.legion,hero:this.runConfig.character,
      followerHeroes:()=>(this.followers?.members??[]).map(f=>f.recruit.hero).filter((x):x is NonNullable<typeof x>=>!!x).map(String),
      followers:()=>this.followers as unknown as {formation?:import('../systems/FormationRuntime').FormationFollowerHooks|null}|null,
      majors:()=>this.player.growth.build.majors(),command:()=>this.player.growth.pts('command'),
      enemiesNear:(x,y,r)=>this.grid.query(x,y,r),stun:(e,ms,n)=>this.buildCombat.stun(e,ms,n),hit:(e,d)=>this.hitEnemy(e,d,this.combatNow,'melee',true),
      banner:(t,s)=>this.showWaveBanner(t,false,s),sfx:k=>this.sfx.play(k)});
     // 敌方军阵（formation-design.md §5）：第四章起刷盾墙阵，斩阵眼破阵
     this.enemyForms=new EnemyFormations({scene:this,player:this.player,chapter:()=>this.lootChapter(),enabled:()=>this.mode==='none'&&!this.over&&!this.cutscene?.active&&!this.runConfig.encounter,
      spawn:(k,x,y,m)=>this.spawnEnemy(k,x,y,this.chapter.hpScale(this.elapsed)*m,true),stun:(e,ms,n)=>this.buildCombat.stun(e,ms,n),banner:(t,s)=>this.showWaveBanner(t,false,s),sfx:k=>this.sfx.play(k),
      playerFormation:()=>this.formationRt?.formed?this.formationRt.current:null,ringDistance:()=>this.spawnRingDistance(),bark:(who,text)=>showBarkCard(this,{side:'left',name:who,text})});
     this.formationFx=new FormationFx(this,this.legion,this.player,()=>{const r=this.formationRt;return{id:r?.current??null,formed:!!r?.formed,settling:!!r&&this.combatNow<r.settleUntil,switches:r?.stats.switches??0};});
     this.events.once('shutdown',()=>{this.formationRt?.clear();this.formationRt=undefined;this.formationFx?.destroy();this.formationFx=undefined;this.enemyForms?.clear();this.enemyForms=undefined;});}
    this.buildCombat.setOrigin(()=>({x:this.player.x,y:this.player.y}));this.statusFx=new StatusFx(this,this.buildCombat);this.jinnangFx=new JinnangFx(this,()=>({x:this.player.x,y:this.player.y}));   // 敌人身上的灼烧 / 迟滞 / 眩晕 / 破甲标记（手绘序列帧）
    this.buildCombat.onFlank=targets=>this.flankBladeFx().strike(targets);
    this.buildCombat.onWindstep=e=>this.windstepFx().burst(e.x,e.y);
    // 流派重做（data/schools.ts）：奇谋 2 势被控制加深、震荡 / 冲阵 / 燎原的一圈、火油罐火区、疾风
    this.buildCombat.controlled=(e,n)=>this.controlBuild?.isControlled(e,n)??false;
    this.buildCombat.onFx=(st,x,y,sz)=>buildVfx(this).emit(st,x,y,this.combatNow,sz,0,420);
    this.buildCombat.onShock=(x,y,r)=>buildVfx(this).emit('pure_charge',x,y-6,this.combatNow,r*2,0,320,true);
    this.buildCombat.onNapalm=(x,y,r,dmg,lv)=>{this.martialFields.add(x,y,r,dmg,3000,lv);this.spawnFlameFx(x,y,r);};
    // 合击（data/schoolCombos.ts）：第一次触发打横幅；烈马脚下火；冲势打出 / 眩晕交给 SchoolSynergy（声东击西、铁骑冲阵、十面埋伏）
    this.buildCombat.onCombo=id=>{this.synergy?.note(id);const c=COMBOS.find(x=>x.id===id);if(c)comboFx(this,c.a,c.b,id,this.player.x,this.player.y,this.combatNow);};
    this.buildCombat.onFirePatch=(x,y,r,dmg,ms)=>{this.martialFields.add(x,y,r,dmg,ms,1);this.spawnFlameFx(x,y,r*.8);};
    this.buildCombat.onCharge=(e,n)=>this.synergy?.onCharge(e,n);
    this.buildCombat.onStun=(e,n)=>this.synergy?.onStun(e,n);
    if(this.controlBuild)this.controlBuild.onStun=(e,n)=>this.synergy?.onStun(e,n);
    // 疾风：一条手绘风带（第 3 期 fx_gust_band）沿风向铺开
    this.buildCombat.onGust=(x,y,a,len)=>{playSheet(this,'fx_gust_band',x+Math.cos(a)*len*.5,y+Math.sin(a)*len*.5-14,{size:len*1.15,ms:520,depth:DEPTH.fx+.05,rotation:a,name:'gust-band'});};
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
    this.campUI.chapterNo=medicChapter(this.scene.key,this.chapter.id,worldMedicChapter());
    // 重整构筑：退回与每次重选后都把存档点改成当前构筑（含待补选次数），关页面再进不会多出或少掉强化；重打旧关 / 测试战斗不写
    this.campUI.onRespecSave=()=>{if(this.campaignReplay||isChapterTestRun()||this.debugModified||this.debugJumped||this.player.damageImmune)return;saveCampaignBuild(this.runConfig.character,packCampaign(this.runConfig.character,this.player,this.legion,this.followers));};
    this.campUI.onLearnTactic=()=>{if(this.campaignReplay)return;patchCampaignBuild(this.runConfig.character,this.player.growth.build.snapshot(),this.legion.food);};
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
    watchBossPhase(this, () => { if (this.dual) return null; const c = (this as unknown as { controller?: { phase2?: boolean } }).controller; return this.boss ? { boss: this.boss, phase2: !!(this.moveset?.phase2 || this.lubu?.phase2 || this.huaxiong?.phase2 || this.xurong?.phase2 || this.zhangjiao?.phase2 || c?.phase2), name: this.chapter.bossName, mounted: !!(this.bossMount?.mounted || this.moveset?.mounted) } : null; });
  }

  /**
   * 建本关剧情导演并开关前剧情（章头 → 过场 / 幕间 → 军情 → 羁绊）；套用羁绊加成（伤害、移速）。
   * 篇章场景（第三章起，runConfig 是 encounter）在自己的 create 末尾按篇章 id 再调一次。
   */
  protected setupStory(chapterId: string, stage: number, done: () => void = () => {}): void {
    this.storyDir = new StoryDirector({ scene: this, chapterId, stage, ctx: this.storyCtx(),
      // 剧情卷轴播放期间记一个「剧情占用」：卷轴开播时正在三选一（首领宝箱补发的升级）也要记上，选完回到剧情暂停而不是回战斗（2026-11-20 夜间回归：1-3 章末卷轴在场时战斗照打、升级弹在卷轴上）
      pause: () => { this.storyHolds++; if (this.mode === 'none' && !this.over) this.setMode('story'); }, resume: () => { this.storyHolds = Math.max(0, this.storyHolds - 1); if (this.mode === 'story' && !this.over && !this.storyHolds) this.setMode('none'); },
      reward: r => { if (r.merit) addMerit(r.merit); if (r.grain) addProvisions(r.grain); }, banner: (t, c) => { this.showWaveBanner(t, true, c); this.sfx.play('gong'); }, bossId: () => this.storyBossId() });
    { const lord = this.runConfig.character, k = this.storyDir.bondDamageMul(lord), v = this.storyDir.bondSpeedMul(lord); if (k !== 1) this.player.stats.damageMul *= k; if (v !== 1) this.player.stats.moveMul *= v; this.player.stats.critChance += this.storyDir.bondCritBonus(lord); // 羁绊（「桃园」伤害、「借将」移速、「古城」暴击）
      for (const m of this.followers?.members ?? []) if (m.recruit.hero) m.weaponDamageMul *= this.storyDir.bondDamageMul(m.recruit.hero);
      const cd = this.storyDir.bondCooldownMul(lord); if (cd !== 1) this.player.stats.cooldownMul *= cd; // 羁绊「卧龙凤雏」冷却
      for (const m of this.followers?.members ?? []) if (m.recruit.hero) m.weaponCooldownMul *= this.storyDir.bondCooldownMul(m.recruit.hero); }
    this.storyDir.beginStage(done);
  }
  /** 剧情用的当前首领 id（一关先后两位首领时子类覆盖，如 6-3 黄忠 → 韩玄）；默认不区分。 */
  protected storyBossId(): string | undefined { return undefined; }
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
    this.phaseRunner?.clear();this.battleTrack?.destroy();this.phaseRunner=null;this.battleTrack=null;this.phasePlan=null;this.phasedFor=null;this.fortunes?.clear();this.fortunes=null;this.fortuneQueue=[];this.fortuneTaken={};this.beaconCalmUntil=0;this.jinnang=null;this.jinnangButton=undefined;this.resetStageCards();this.branchRt?.clear();this.branchRt=null;this.branchFor=null;
    this.relicWaves=[];this.runMerit={elite:0,boss:0};this.picksGiven=0;this.militaryPending=0; // 场景实例会被重复使用：每场重置
    this.firstBossAt=-1;this.settledFrontlineKills=0;this.frontlineNextSettlement=1;this.frontlineVictories.clear();this.frontlineStarts.clear();this.chasingBosses=[];this.enemyFlow.clear();this.storyHolds=0;this.deadBossControllers=[];for(const c of this.bossChests)c.clear();this.bossChests=[];this.lootContinue=null;this.relicHits=0;this.relicFireAt=0;this.relicHealAt=0;
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
    this.sishuiObstacles=null;this.sishuiPass?.clear();this.sishuiPass=null;this.parley?.clear();this.parley=null;this.persuadeKill=false;this.dual?.clear();this.dual=null;this.dzLubu?.clear();this.dzLubu=null;this.huaxiong=null;this.xurong=null;this.lubu = null;this.moveset?.clear();this.moveset=null;this.bossMount?.destroy();this.bossMount=null; this.zhangjiao?.clear(); this.zhangjiao = null; this.yellow=null; this.xiliang=null; this.supplies=null; this.yellowAltar=null;this.finaleFadeMs=0;
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
      this.followers?.clear();this.followers=null;this.legion.stop(); this.reinforcements.clear();this.yellow?.clear();this.xiliang?.clear();this.clearChasingBosses();this.supplies?.clear();this.itemDrops?.clear();this.battleHeal?.clear();
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
    // 原来的 P / Esc 暂停、Q 服药、1–3 选卡、R 再来一局、E 护阵 都并进了快捷键分派（键位不变，可在设置「快捷键」里改）
    const hotkeyHost = {
      scene: this as Phaser.Scene, mode: () => this.mode as string, over: () => this.over,
      togglePause: () => this.togglePause(), usePotion: () => this.usePotion(), useJinnang: () => this.useJinnang(),
      order: () => this.legion.order, cycleOrder: () => this.legion.cycleOrder(), switchFormation: () => this.formationRt?.switch(this.combatNow) ?? false,
      openBag: () => this.openBattleBag(), canAttributes: () => this.player.growth.unallocated > 0 && mechOpen('attributes'),
      openAttributes: (from: 'none' | 'pause') => { this.attributeReturn = from; this.renderAttributePanel(); this.setMode('attributes'); },
      openBuild: () => this.openBuildPanel(), chooseUpgrade: (i: number) => this.chooseUpgrade(i), chooseBranch: (i: number) => this.chooseBranch(i),
      ...(IS_DESKTOP ? {toggleMap: () => this.battleMap?.toggleBig(), mapOpen: () => !!this.battleMap?.bigOpen, toggleOrders: () => this.ordersPanel?.toggleFold()} : {}),
    };
    this.hotkeys = new BattleHotkeys(hotkeyHost); this.hotkeyHints = new HotkeyHints(hotkeyHost);
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
    this.applyPhases();
    this.tickBranch();
    const nextWave = waveIndexAt(this.elapsed, this.chapter.waves);
    if (!this.over && nextWave !== this.waveIndex) {
      this.waveIndex = nextWave;
      const ph = this.phasePlan?.phases[nextWave];
      this.hudTexts.wave.setText(this.chapter.waves.length === 1 ? this.chapter.waves[0].name : `第 ${nextWave + 1}/${this.chapter.waves.length} 波 · ${this.chapter.waves[nextWave].name}`); // 不分波的关（2-3 洛阳）不写「第 1/1 波」
      // 五段关：横幅只写段落故事名（不写「第 x 波」），小字写段落类别
      if (ph) { if (this.waveBannerShown || nextWave > 0) this.showWaveBanner(ph.name, ph.kind === 'elite' || ph.kind === 'lieutenant' || ph.kind === 'surge', this.phaseCaption(ph.kind)); this.phaseRunner?.enter(nextWave);
        const bark = PHASE_BARKS[this.hardKey() + '-' + this.hardStage()]?.[ph.kind]; if (bark && nextWave > 0 && storyMode() !== 'off') showBarkCard(this, { side: 'left', name: bark.who, text: bark.text, id: bark.id }); } // 段落台词（data/stagePhases.ts PHASE_BARKS）
      else if (this.waveBannerShown || nextWave > 0) this.showWaveBanner(`第 ${nextWave + 1}/${this.chapter.waves.length} 波 · ${this.chapter.waves[nextWave].name}`);
      this.waveBannerShown = true;
      // Finish a wave before recruiting; the opening wave starts immediately.
      if (nextWave > 0 && this.chapter.recruitWaves.includes(nextWave)) this.scheduleRecruit();
      if (nextWave > 0) { const ws = this.pickWaves(); this.ensurePicks(ws[Math.min(nextWave, ws.length) - 1]); }
    }
    this.luoyangLt?.update(); // 2-3 营寨守将李傕：名牌 / 血条跟随、倒下结算
    if (this.phasePlan) {
      this.phaseRunner?.update(); this.battleTrack?.update(this.elapsed, Math.max(0, this.waveIndex), this.bossSpawned, this.chapter.bossName);
      if (this.mode === 'none' && !this.over) this.fortunes?.update(this.bossSpawned);
      if (this.mode === 'none' && !this.over && this.needBranch()) this.openBranch();
      this.tickMechIntros();
      if (this.fortuneQueue.length && this.mode === 'none' && !this.over && this.player?.alive) this.openFortune(this.fortuneQueue.shift()!);
      this.tickStageCards();
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
    this.updateBossHud();
    // 被动满层台词每帧检测（HUD 0.1 秒一刷，孙尚香这类攒满后马上触发的会漏掉）
    this.passiveShout.update(this.player.passive, this.combatNow, this.player.x, this.player.y, this.mode === 'none' && !this.over, this.player.sprite);
    this.statusFrame?.update({ hp: this.player.hp, maxHp: this.player.maxHp, xp: this.player.xp, xpNext: this.player.xpNext, level: this.player.level, over: this.player.level >= this.player.softLevel, now: this.time.now, hpText: this.hudTexts?.hp, badge: this.hudAttrBadge ??= (this.children.getByName('hud-attr-badge') as Phaser.GameObjects.Image | null) ?? undefined });
    this.passiveGauge.update(this.player.passive, this.combatNow, this.player.x, this.player.y + (this.player.riseY > 0 ? FOOT_HUD.mountDy : 0), !this.over && this.player.sprite.visible); // 骑马时刻度让到马蹄下（FOOT_HUD）
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
        }MB${this.traits ? ' | ' + this.traits.summary() : ''}`,
      );
    }

    if(this.finaleFadeMs>0){this.finaleFadeMs=Math.max(0,this.finaleFadeMs-delta);const a=this.finaleFadeMs/800;this.bossUltGfx.setAlpha(a);this.bossShieldGfx?.setAlpha(a);if(!this.finaleFadeMs){this.bossUltGfx.clear().setAlpha(1);this.bossShieldGfx?.clear().setAlpha(1);}}
    this.huaxiong?.updateDeath(delta);this.xurong?.updateDeath(delta);for(const controller of this.deadBossControllers)controller.updateDeath(delta);
    this.animateUpgradeCards();
    this.hotkeyHints?.update(delta / 1000);
    this.tickBattleMap(delta / 1000);
    if (this.mode !== 'none' || this.over) return;
    // 重整构筑（systems/Respec）退回、休整里没选完的强化：开打后补成三选一（一次转进待选，按原有节奏出）
    if (this.player.growth.respecPending > 0) { const n = this.player.growth.respecPending; this.player.growth.respecPending = 0; this.pendingLevels += n; this.showGrowthNotice(`重整构筑 · 补选 ${n} 次强化`); }
    if (this.pendingLevels > 0 && this.pickGapOk()) this.openUpgrade();

    if(this.battleStage()<3&&!this.runConfig.encounter&&this.boss?.active&&this.firstBossAt>=0&&this.combatNow>=this.firstBossAt+90000)this.advanceFrontline();
    this.elapsed += dt;
    this.combatNow += dt * 1000;
    this.hitFeel.endFrame(); this.bossStagger.decay(dt);
    if (this.combatNow >= this.healShowAt) { this.healShowAt = this.combatNow + 400; if (this.healAcc >= 1) { this.spawnDamageText(this.player.x, this.player.y - 56, Math.round(this.healAcc), false, true, 'heal'); this.healAcc = 0; } }
    time = this.combatNow;
    const move = this.readMove();
    { const l = Math.hypot(move.x, move.y); this.moveDir = l > .1 ? { x: move.x / l, y: move.y / l } : null; }
    this.updateObstacleLocks(); // 打障碍物：给挡路的 / 身边没敌人时最近的可破坏物件加锁（武器出手前）
    this.relics?.sway(move, this.combatNow);
    const moveX=this.player.x,moveY=this.player.y;
    const driven=Math.hypot(move.x,move.y)>.1;
    this.player.move(dt, driven?move.x:0, driven?move.y:0);

    this.player.update(time, dt);this.mount?.update(dt,this.combatNow);

    if(!this.over){for(const c of this.bossChests)c.update(this.combatNow);this.itemDrops?.update();this.battleHeal?.update(dt,this.bossSpawned);this.campSiege?.update();(this.tentHints??=new TentEdgeHints(this)).update(this.mode!=='none'||this.over);this.relics?.update(this.combatNow);this.relicShips?.update(this.combatNow);}
    this.deathFx?.update(this.combatNow);
    this.supplies?.update(dt,time,this.battlefieldDetails.props,(enemy,damage)=>this.hitEnemy(enemy,damage,time,'fire',false,false),this.allies,(ally,damage,now)=>this.legion.hurt(ally,damage,now));
    if(!this.envInit&&this.supplies){this.envInit=true;const sf=this.sceneFaction(),cfg0=envConfigFor(this.scene.key,this.chapter.id,(this as unknown as {guanduStage?:number}).guanduStage),cfg=cfg0&&sf!==null&&sf<=3?{...cfg0,faction:sf as Faction}:cfg0;if(cfg){const sup=this.supplies;this.env=new EnvInteractions({scene:this,player:this.player,supplies:sup,enemies:()=>this.enemies,allies:()=>this.allies,hitEnemy:(e,d)=>{this.hitEnemy(e,d,this.combatNow,'fire',false,false);},hurtAlly:(a,d)=>{this.legion.hurt(a,d,this.combatNow);},spawnEnemy:(x,y)=>this.spawnEnemy('infantry',x,y,undefined,true),spawnGem:(x,y,v)=>this.spawnGem(x,y,v),spawnChest:(x,y)=>{this.itemDrops?.spawnChest(x,y);},now:()=>this.combatNow,sfx:k=>this.sfx.play(k)},cfg);this.events.once('shutdown',()=>{this.env?.destroy();this.env=null;});}}
    this.env?.update(dt);
    if(this.mode==='none'&&!this.over)this.sishuiPass?.update();
    this.parley?.update(); // 首领招降：残血弹窗 / 再压一压
    if(this.mode==='none'&&!this.over)this.dual?.update(this.combatNow); // 双首领：招降、配合技、狂怒 / 心乱、退走线
    if(!this.terrainInit&&this.player){this.terrainInit=true;const tc0=terrainConfigFor(this.hardKey(),this.hardStage()),tc=tc0?.auto&&new URLSearchParams(location.search).get('groves')==='0'?{...tc0,auto:undefined}:tc0; /* ?groves=0：关掉自动树林（前后对比截图用） */if(tc){this.terrain=new Terrain(this,tc,tc.auto?this.treeAvoid():undefined);const t=this.terrain;if(tc.auto)this.supplies?.purge((x,y)=>t.treeNear(x,y,50)); /* 自动树林种下后，已经摆在树脚下的补给箱 / 道具收掉 */Ally.terrainMul=(x,y)=>t.speedMul(x,y);this.terrainNav=[...t.navBoxes(),...t.cliffBoxes];if(t.cliffBoxes.length){if(!this.sishuiObstacles)this.sishuiObstacles=new SishuiObstacles([]);this.sishuiObstacles.footprints.push(...t.cliffBoxes);} /* 山崖碰撞并进场景障碍：挡人、刷兵避开、随行也认 */this.events.once('shutdown',()=>{t.clear();if(this.terrain===t){this.terrain=null;Ally.terrainMul=null;}});}}
    if(!this.traits&&this.player)this.traits=new EnemyTraits({scene:this,player:this.player,enemies:()=>this.enemies,stageKey:()=>this.hardKey()+'.'+this.hardStage(),wave:()=>waveIndexAt(this.elapsed,this.chapter.waves)+1,enabled:()=>!this.hardMode&&this.mode==='none'&&(!this.runConfig.encounter||this.achievementArc()!==undefined),/* 第三章起的篇章场景都带 encounter（qunxiong），按自己的篇章键配兵；只排除 ?encounter= 预览 */
      baseDef:k=>{const b=this.chapter.enemies[k];if(!this.yellow)return b;const v=this.yellow.variant(b,this.elapsed);return v.behavior?b:v;},spawn:(k,x,y,def)=>this.spawnEnemy(k,x,y,undefined,false,def),
      fireArrow:(e,tx,ty,d,sp)=>this.fireBolt(this.bullets,e.x,e.y,tx,ty,d*(this.env?.damageMul(e)??1),0,false,sp,enemyArrowTexture(this,e.sprite.texture.key)),hurtTroops:(x,y,r,d)=>this.legion.hurtArea(x,y,r,d,this.combatNow),
      move:(e,nx,ny,dt)=>{e.moveVx=nx*e.def.speed;e.moveVy=ny*e.def.speed;this.advanceEnemy(e,nx,ny,dt);},sfx:k=>this.sfx.play(k),
      ringDistance:()=>this.spawnRingDistance(),inWater:(x,y)=>this.terrain?.inWater(x,y)??false,waterPoint:(px,py)=>{const t=this.terrain;if(!t)return null;for(let i=0;i<40;i++){const a=Math.random()*Math.PI*2,d=420+Math.random()*560,x=px+Math.cos(a)*d,y=py+Math.sin(a)*d;if(t.inWater(x,y))return{x,y};}return null;},
      gainFood:n=>{this.legion.food+=n;},boss:()=>this.boss,farPoint:(x,y)=>{const g=this.arena?.info.gates;if(!g?.length)return null;const p=this.player;return [...g].sort((a,b)=>Math.hypot(b.x-p.x,b.y-p.y)-Math.hypot(a.x-p.x,a.y-p.y))[0]??null;void x;void y;}}); // 机制自己定方向（保持距离 / 绕圈）：不用群体寻路的追击速度
    if(!this.arenaInit&&this.player&&this.terrainInit){this.arenaInit=true;const def=stageMapFor(this.hardKey(),this.hardStage());if(def)this.arena=new StageArena({scene:this,player:this.player,allies:()=>this.allies,enemies:()=>this.enemies,now:()=>this.combatNow,
      spawnTarget:(x,y,hp,size)=>{const e=this.supplies?.spawnGate(x,y,hp,size)??null;e?.sprite.setAlpha(0);return e;},hitEnemy:(e,d,src)=>{this.hitEnemy(e,d,this.combatNow,src??'melee',true,false);},spawnEnemy:(k,x,y)=>this.spawnEnemy(k,x,y,undefined,true),breakBridgeNear:(x,y)=>{const t=this.terrain as unknown as {rivers?:Array<{bridges:Array<{x:number;y:number}>}>;setBridgeBroken?:(i:number,b?:boolean)=>boolean}|null;const all=t?.rivers?.flatMap(r=>r.bridges)??[];let bi=-1,bd=300;all.forEach((b,i)=>{const d=Math.hypot(b.x-x,b.y-y);if(d<bd){bd=d;bi=i;}});return bi>=0&&!!t?.setBridgeBroken?.(bi,true);},
      hurtTroops:(x,y,r,d)=>this.legion.hurtArea(x,y,r,d,this.combatNow),banner:(t,d,c)=>this.showWaveBanner(t,!!d,c),sfx:k=>this.sfx.play(k),purge:pred=>{this.supplies?.purge(pred);}},def);}
    if(this.terrain){this.terrain.update(this.combatNow,dt);this.player.terrainSpeedMul=this.terrain.speedMul(this.player.x,this.player.y);}
    this.updateEnemies(dt, time);
    if(this.arena&&this.mode==='none'&&!this.over)this.arena.update(this.combatNow); // 有边场地：断桥 / 营帐起火 / 滚木（守边在 postupdate，见 StageArena）
    this.yellow?.update(dt,time);this.xiliang?.update(dt,this.combatNow);this.shieldBars?.draw(this.enemies);if(this.objective){this.objective.update(dt);this.objectiveText?.setText(this.objective.text);}
    for(const t of this.chasingBosses){if(t.enemy.active&&t.enemy.spawnId===t.life){t.battle?.update(dt,time);t.label.setPosition(t.enemy.x,t.enemy.y-100).setText(t.name+" · 追兵 "+Math.ceil(Math.max(0,t.enemy.hp)/t.enemy.maxHp*100)+"%");}}
    this.rebuildGrid();
    if(time>=this.navigationAt){this.navigationAt=time+250;const boxes=[...(this.sishuiObstacles?.footprints??[]),...(this.terrain?(this.terrain.stats.burnt?(this.terrainNav=this.terrain.navBoxes()):this.terrainNav):[])];this.supplies?.appendNavigationBoxes(boxes);this.legion.navigation.setBoxes(boxes);}
    this.legion.update(dt, time, this.enemies, this.grid, (enemy, amount) => this.hitEnemy(enemy, amount, this.combatNow, 'melee', true));
    this.followers?.update(dt, this.combatNow);
    this.formationRt?.update(dt, this.combatNow); this.formationFx?.update(dt, this.combatNow); this.enemyForms?.update(dt, this.combatNow);
    if (this.over) return;
    this.rebuildGrid();
    this.separateEnemies();
    this.separateAlliesFromEnemies(dt);
    this.supplies?.resolveBodies(this.allies,(a,d,n)=>this.legion.hurt(a,d,n),(e,d,n)=>this.hitEnemy(e,d,n,'melee',false,false));
    this.sishuiObstacles?.resolve(this.player,this.allies,this.enemies);
    if(this.terrain){this.terrain.resolve(this.player,this.allies,this.enemies);this.terrain.updateCanopy(this.player,this.enemies.filter(e=>e.active&&!e.isSupplySlot&&(e.kind==='boss'||e.kind==='elite')));}
    this.player.growth.recordMovement(Math.hypot(move.x,move.y)>.1&&time>=this.player.knockedUntil?Math.hypot(this.player.x-moveX,this.player.y-moveY):0,dt);
    if(this.player.growth.masteries.dragging_blade||this.dragFx)this.dragBladeFx().update(dt,Math.hypot(move.x,move.y)>.1&&time>=this.player.knockedUntil?Math.hypot(this.player.x-moveX,this.player.y-moveY):0);
    this.buildCombat.movement(Math.hypot(move.x,move.y)>.1&&time>=this.player.knockedUntil?Math.hypot(this.player.x-moveX,this.player.y-moveY):0);
    this.drawAimIndicator();
    this.updateEnemyWalkAnimations(dt);
    this.rebuildGrid();
    this.applyContactDamage();
    if (this.over) return;
    this.martialFields.update(dt);
    this.buildCombat.update(this.combatNow);this.statusFx?.update(this.combatNow,this.enemies);this.jinnangFx?.update(this.combatNow,this.chain);
    // 兵阵 4 势「援军」：每 12 秒从后方冲来 3 名义军助战 10 秒（data/schools.ts SCHOOL_TIER.formation）
    if(this.player.growth.build.tier('formation')>=4&&this.combatNow>=this.reinforceAt){const F=SCHOOL_TIER.formation;this.reinforceAt=this.combatNow+F.everyMs;
      this.reinforcePush().spawnEscort(F.n,F.lifeMs);buildVfx(this).emit('reinforce',this.player.x,this.player.y-8,this.combatNow,150,0,800,true);}
    {const fc=this.buildCombat.flankCharge();if(fc.level||this.flankFx)this.flankBladeFx().update(dt,fc.level,fc.ratio);}
    {const wc=this.buildCombat.windstepCharge();if(wc.level||this.windFx)this.windstepFx().update(dt,wc.level,wc.ratio);}
    this.controlBuild?.update(this.combatNow);
    this.bulwarkBuild?.update(this.combatNow);
    this.synergy?.update(this.combatNow);
    const vfx=buildVfx(this);vfx.update(this.combatNow);
    if(this.buildCombat.charged()&&(this.player.growth.build.level('stored_edge')>0||this.player.growth.build.tier('cavalry')>=4))vfx.emit('charge',this.player.x+14,this.player.y-14,this.combatNow,34);
    // 游击类战法（疾行印等）的移动风痕：用户反馈「疾行」特效一直挂在身后太显眼 → 改为脚边一小团、每 1.5 秒最多一次
    if(Math.hypot(move.x,move.y)>.1&&this.player.growth.build.tags().cavalry>0&&this.combatNow>=this.skirmishPuffAt){this.skirmishPuffAt=this.combatNow+1500;vfx.emit('skirmish',this.player.x-move.x*16,this.player.y+16-move.y*10,this.combatNow,26,Math.atan2(move.y,move.x),260);}
    this.updateWeapons(dt, time);
    // 武将出招起手特效（2026-11-19）：招牌技 / 专属武艺（skill 动作）与被动触发那一刻在身上亮一下
    if (this.heroCastFx?.owner !== this.player) { const fx = new HeroCastFx(this, this.player, this.runConfig.character); this.heroCastFx = fx; this.player.onSkillAction = () => fx.markSkill(); } // 场景重开换了主将对象就重建
    this.heroCastFx.update(this.combatNow);
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
    // 双首领：主将 ×0.7 + 两首领中点 ×0.3（主将留在画面中间 60%）
    const dualCam = this.dual?.cameraTarget(this.player.x, this.player.y);
    // 可见范围半宽 / 半高（世界像素）：电脑布局战场镜头拉远后比设计分辨率大（BATTLE_ZOOM_DESKTOP），按实际可见范围居中
    const hw = cam.width / (2 * cam.zoom), hh = cam.height / (2 * cam.zoom);
    const targetX = (dualCam ? dualCam.x + GAME_WIDTH / 2 - hw : this.player.x - hw) + (look?.x ?? 0);
    // 2-3 洛阳：董卓 / 吕布在城头时，主将走近城墙镜头往上让一点，城头的人才看得见（城墙图约 230 高，不让的话城头在画面外）
    const targetY = (dualCam ? dualCam.y + GAME_HEIGHT / 2 - hh : this.player.y - hh) + (look?.y ?? 0) + (this.dzLubu?.cameraBias(this.player.y) ?? 0);
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
    if (this.arena) { const f = this.arena.spawnAt(x, y); x = f.x; y = f.y; } // 有边场地：场外的刷兵点改到离主将最远的关口
    if (this.terrain) { const f = this.terrain.free(x, y, kind === 'boss' ? 34 : 20); x = f.x; y = f.y; } // 不刷在水里 / 树干里
    if (kind === 'cavalry') this.deathFx?.warmHorse(); // 骑兵死亡放马：马匹行走图按需异步加载（只在场上出现骑兵时）
    // 不刷在关墙 / 营栅 / 场地边界 / 谷壁 / 崖壁里（全场景审查 F）：挪到最近的框边、朝主将那一侧；首领与城头守军按设计摆位，不挪
    if (kind !== 'boss' && override?.behavior !== 'wall' && this.sishuiObstacles?.footprints.length) { const f = freeSpawn(this.sishuiObstacles.footprints, x, y, 20, this.player); x = f.x; y = f.y; }
    if (this.arena && kind !== 'boss') { const c = this.arena.clampPoint(x, y); x = c.x; y = c.y; } // 有边场地：挪出障碍后可能被推到边外（崖口旁），夹回场内
    // 全面检查 #7：夹回场内后又可能落进角上的房子 / 墙里——再挪出、再夹，最多两轮
    if (this.arena && kind !== 'boss' && override?.behavior !== 'wall' && this.sishuiObstacles?.footprints.length) { let ok = false; for (let i = 0; i < 2 && !ok; i++) { const f = freeSpawn(this.sishuiObstacles.footprints, x, y, 20, this.player); if (!f.moved) { ok = true; break; } const c = this.arena.clampPoint(f.x, f.y); x = c.x; y = c.y; }
      // 还在墙里（两排房子的拐角）：改到离主将最远的关口（关口都是空地）
      if (!ok && freeSpawn(this.sishuiObstacles.footprints, x, y, 20, this.player).moved) { const g = [...(this.arena.info.gates ?? [])].sort((u, v) => Math.hypot(v.x - this.player.x, v.y - this.player.y) - Math.hypot(u.x - this.player.x, u.y - this.player.y))[0]; if (g) { x = g.x; y = g.y; } } }
    if (kind !== 'boss' && override?.behavior !== 'wall' && this.dzLubu) { const f = this.dzLubu.southSpawn(x, y); x = f.x; y = f.y; } // 2-3 洛阳：城北（城里）不刷兵
    // 城门没破之前墙内只刷远程（用户 11-20；data/gateSpawn）：近战 / 超上限的远程镜像到墙外，墙内远程挪到墙后能射到的一条带里
    if (kind !== 'boss' && override?.behavior !== 'wall') { const w = this.behindClosedWall(x, y); if (w) {
      if (isRangedSpawn(kind, override ?? this.chapter.enemies[kind]) && this.wallRangedCount(w.line) < GATE_SPAWN.rangedCap) { y = Math.max(w.line - GATE_SPAWN.band.far, Math.min(w.line - GATE_SPAWN.band.near, y)); this.wallSpawn.inside++; }
      else { if (isRangedSpawn(kind, override ?? this.chapter.enemies[kind])) this.wallSpawn.capped++; y = w.line + Math.max(GATE_SPAWN.outsideMin, w.line - y); this.wallSpawn.mirrored++; const fp = this.sishuiObstacles?.footprints; if (fp?.length) { const f = freeSpawn(fp, x, y, 20, this.player); x = f.x; y = f.y; } }
    } }
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
    const base0=override??this.chapter.enemies[kind];
    // 敌方骑兵（马）移速 ×MOUNT_VISUAL.enemyCavalrySpeedMul（11-18「骑马移速慢点」；冲锋速度由 speed 推出，随之变慢）；象兵不变
    const base=isHorseCavalry(base0)?{...base0,speed:base0.speed*MOUNT_VISUAL.enemyCavalrySpeedMul}:base0;
    const variant=!override&&this.yellow&&kind!=='boss'?this.yellow.variant(base,this.elapsed):base;
    // 小怪按章节 / 关序成长（stageTuning.growth；首领不受影响）
    const growth=kind!=='boss'?this.chapter.growth:undefined;
    const def=growth?{...variant,damage:variant.damage*growth.damage}:variant;
    if(growth)hpScale*=growth.hp*(override||!this.phaseRunner?1:this.phaseRunner.waveHpMul());
    else if(kind==='boss'&&this.chapter.growth?.bossHp)hpScale*=this.chapter.growth.bossHp;
    enemy.spawn(x,y,this.hardMode?{...def,damage:def.damage*HARD_MODE.damage}:def,this.hardMode?hpScale*(kind==='boss'?HARD_MODE.bossHp:HARD_MODE.enemyHp):hpScale,this.combatNow);armShield(enemy);
    return enemy;
  }

  /** 关卡目标：按当前关的 chapter.objective 建立（战线推进到下一关时重建）；HUD 在章节名下方显示一行。 */
  protected setupObjective(): void {
    this.objective?.clear(); this.objective = null; this.battleOrders?.resetAuto();
    const o = this.chapter.objective; if (!o) { this.objectiveText?.setVisible(false); return; }
    this.objective = new StageObjectives({scene: this, player: this.player, enemies: this.enemies, spawn: (k, x, y) => this.spawnEnemy(k, x, y, undefined, true), spawnCamp: (x, y, hp) => { const e = this.supplies?.spawnCamp(x, y, Math.round(hp * this.chapter.hpScale(this.elapsed))) ?? null; if (e) this.campSiege?.add(e, 'camp', { guards: !this.luoyangCamps && !this.dzLubu, onAlarm: () => this.luoyangCamps?.alarm(e) }); return e; }, /* 破营目标：营寨攻坚（2-3 营寨自带守军） */ kills: () => this.kills, elapsed: () => this.elapsed, banner: (t, c) => this.showWaveBanner(t, false, c)}, o);
    if (!this.objectiveText?.active) this.objectiveText = this.add.text(GAME_WIDTH / 2, 78, '', warText(14, '#ffd98a')).setOrigin(.5, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1).setStroke('#1a120b', 4).setName('objective-text');
    this.objectiveText.setVisible(!this.ordersPanel).setText(this.objective.text);
  }

  /** 战场地图 · 军令（battle-map-design.md）：军令表（自动读关卡目标 / 首领 / 攻城 / 突围；其他系统用 ordersOf(scene) 推）+ 电脑布局的军令面板、小地图、G 键大地图。 */
  protected setupBattleMap(): void {
    this.ordersPanel?.destroy(); this.battleMap?.destroy(); this.ordersPanel = null; this.battleMap = null;
    const orders = this.battleOrders = new BattleOrders({
      scene: this, elapsed: () => this.elapsed, over: () => ({over: this.over, victory: this.victory}),
      banner: (t, c) => this.showWaveBanner(t, false, c),
      stageObjective: () => { const o = this.objective; if (!o) return null; const p = o.progress; return {kind: o.o.kind, cur: p.cur, max: p.max, label: o.o.label, target: o.o.kind === 'destroy' ? o.o.target : undefined, limit: o.o.limit, done: o.done, failed: o.failed, points: o.points}; },
      bosses: () => [...(this.dual ? this.dual.alive.map(x => ({key: x.id, name: x.name, e: x.enemy})) : this.boss?.active ? [{key: 'main', name: this.chapter.bossName, e: this.boss}] : []), ...this.dzLubuBoss()],
      waves: () => this.objective || !this.chapter.waves?.length ? null : {cur: Math.max(1, this.waveIndex + 1), total: this.chapter.waves.length, name: this.chapter.waves[Math.max(0, this.waveIndex)]?.name ?? '', bossAt: chapterBossTime(this.chapter)},
      bossName: () => this.chapter.bossName, bossSpawned: () => this.bossSpawned, bossKilled: () => this.bossKilled,
      bossOutcome: key => this.dual?.entries.find(x => x.id === key)?.done ?? null,
    });
    if (IS_DESKTOP) {
      if (ordersPanelSetting() === 'on') this.ordersPanel = new OrdersPanel(this, orders);
      this.battleMap = new BattleMap({locked: () => !mechOpen('atlas'), scene: this, player: () => this.player, enemies: () => this.enemies, followers: () => this.followers?.members ?? [],
        // 军阵：部曲淡青点 + 主将脚下当前阵纹小图
        army: () => this.legion.units, eyes: () => this.enemyForms?.eyes() ?? [], formation: () => { const r = this.formationRt; return r?.current ? { frame: FORMATION_IDS.indexOf(r.current), rot: this.legion.formation.facing + Math.PI / 2 } : null; },
        title: () => this.chapter.name ?? this.chapter.label ?? '',
        // 2026-11-19 用户「打开小地图会暂停是我要要求的」：舆图展开时战斗暂停，卷回后恢复
        pause: on => { if (on) { if (this.mode === 'none' && !this.over) this.setMode('map'); } else if (this.mode === 'map') this.setMode('none'); },
        camps: () => { const z = this.allyPush, now = this.combatNow; return [...(this.objective?.standing ?? []).map(e => ({x: e.x, y: e.y, ratio: e.hp / Math.max(1, e.maxHp), hit: !!z && now - (z.campHitAt.get(e) ?? -1e9) < 900})), ...tentMarks(this).filter(m => !m.objective)]; }, // 破营目标 + 各刷兵帐篷（systems/SpawnTents）
        pushes: () => (this.allyPush?.squads ?? []).map(q => ({from: q.from, to: q.target ? {x: q.target.x, y: q.target.y} : null, members: q.members.filter(m => !m.dead)})), bosses: () => [...(this.dual ? this.dual.alive.map(x => x.enemy) : this.boss?.active ? [this.boss] : []), ...this.dzLubuBoss().map(x => x.e)]}, orders);
      if (this.ordersPanel) this.objectiveText?.setVisible(false);
    }
    this.events.once('shutdown', () => { this.ordersPanel?.destroy(); this.battleMap?.destroy(); this.battleOrders?.clear(); this.ordersPanel = null; this.battleMap = null; this.battleOrders = null; });
  }
  /** 军中设置「军令面板」开关（战斗中即时生效）：开 = 建面板并收起章节名下的目标行；关 = 拆掉面板、目标行露出来。 */
  protected applyOrdersPanelSetting(): void {
    if (!IS_DESKTOP || !this.battleOrders) return;
    const on = ordersPanelSetting() === 'on';
    if (on && !this.ordersPanel) this.ordersPanel = new OrdersPanel(this, this.battleOrders);
    if (!on && this.ordersPanel) { this.ordersPanel.destroy(); this.ordersPanel = null; }
    this.objectiveText?.setVisible(!this.ordersPanel && !!this.objective);
  }
  /** 2-3 洛阳：吕布在城下打的那段，当成一名首领进军令（「打退吕布」，逃走即完成）和地图朱印。 */
  /**
   * 开局的势（2026-11-19 流派重做，data/schools.ts SHI_SOURCES）：武将第一亲和派 +1；随行每名按兵种 +1（合计最多 +2）；骑橙色名马骑突 +1。
   * 写进 BuildState.bonus / bonusNotes（构筑总览分项显示来源）。
   */
  private applySchoolSources():void{
    const b=this.player.growth.build,bonus:Partial<Record<SchoolId,number>>={},notes:Partial<Record<SchoolId,string[]>>={};
    const add=(sc:SchoolId,n:number,note:string)=>{bonus[sc]=(bonus[sc]??0)+n;(notes[sc]??=[]).push(note);};
    const ch=this.runConfig.character,aff=heroAffinity(ch);if(aff[0])add(aff[0],SHI_SOURCES.affinityStart,'亲和 · '+getCharacter(ch).name);
    let f=0;for(const m of this.followers?.members??[]){if(f>=SHI_SOURCES.followerCap)break;const sc=FOLLOWER_SCHOOL[m.template];if(sc){add(sc,1,'随行 · '+m.recruit.name.replace(/（.*）/,''));f++;}}
    const horse=heroHorse(ch);if(horse&&horseQuality(horse)==='orange')add('cavalry',SHI_SOURCES.orangeMount,'名马 · '+horse.name);
    b.bonus=bonus;b.bonusNotes=notes;
  }
  /**
   * 自动树林的禁区（用户「树增加多点在不同适合的场景」，不挡打仗的地方）：
   *  - 场景里所有挡人的框（关墙、营栅、山崖、陈仓城、董卓城墙…——各系统的 footprints）旁 110 以内；
   *  - 长的横墙（宽 > 900、薄）北边（城里）一律不种、墙脚 180 以内不种：城池的关只在城外有树；
   *  - 关卡目标、营寨 / 补给、营帐 / 箭楼 / 城门之类的布景图附近（布景按图大小留边）。
   */
  private treeAvoid(): (x: number, y: number) => boolean {
    type B = {left: number; right: number; top: number; bottom: number};
    const sc = this as unknown as Record<string, unknown>, boxes: B[] = [], seen = new Set<unknown>();
    const add = (list: unknown) => { if (!Array.isArray(list) || seen.has(list)) return; seen.add(list); for (const b of list) if (b && typeof (b as B).left === 'number') boxes.push(b as B); };
    for (const k of Object.keys(sc)) { const v = sc[k] as Record<string, unknown> | null; if (!v || typeof v !== 'object' || (v as unknown) === this.terrain) continue; add(v.footprints); const o = v.obstacles as Record<string, unknown> | undefined; if (o && typeof o === 'object') add(o.footprints); }
    const walls = boxes.filter(b => b.right - b.left > 900 && b.bottom - b.top < 500);
    const pts: Array<{x: number; y: number; r: number}> = [...(this.objective?.points ?? []).map(p => ({...p, r: 260})), ...this.enemies.filter(e => e.active && e.isSupplySlot).map(e => ({x: e.x, y: e.y, r: 200}))];
    for (const o of this.children.list) { const im = o as Phaser.GameObjects.Image; if (o.type !== 'Image' || !im.visible || im.scrollFactorX !== 1) continue; const k = im.texture?.key ?? '', n = o.name ?? '';
      if (/terrain|ground|road|water|shadow|fx_/i.test(k + n)) continue;
      if (/prop|camp|tent|fort|wall|barb|siege|gate|tower|altar|banner|palisade|luoyang|sishui|faction/i.test(k + ' ' + n) && im.displayWidth > 50) pts.push({x: im.x, y: im.y - im.displayHeight * .3, r: Math.max(im.displayWidth, im.displayHeight) * .55 + 70}); }
    // 有边场地：边线两侧 220 内不种（营栅 / 城墙那一圈，树不长在栅上）
    // 营地（arena）里不种树：营里是平整过的空地；营帐起火的营帐旁也不种
    const smd = stageMapFor(this.hardKey(), this.hardStage()), sm = smd?.bounds, camp = !!smd && Object.values(smd.edges).every(e => e === 'palisade'), tents = (smd?.interactions ?? []).flatMap(i => i.kind === 'campfire' ? i.tents : []);
    const nearEdge = (x: number, y: number) => !!sm && x > sm.left - 220 && x < sm.right + 220 && y > sm.top - 220 && y < sm.bottom + 220 && (camp || Math.min(x - sm.left, sm.right - x, y - sm.top, sm.bottom - y) < 220) || tents.some(t => Math.hypot(t.x - x, t.y - y) < 230);
    return (x, y) => nearEdge(x, y) || boxes.some(b => x > b.left - 110 && x < b.right + 110 && y > b.top - 110 && y < b.bottom + 150)
      || walls.some(w => x > w.left - 200 && x < w.right + 200 && y < w.bottom + 180)
      || pts.some(p => Math.hypot(p.x - x, p.y - y) < p.r);
  }
  private dzLubuBoss(): Array<{key: string; name: string; e: Enemy; label: string}> {
    const z = this.dzLubu, l = z?.lubu; return z && l?.active && z.phase === 'wall' ? [{key: 'lubu', name: '吕布', e: l, label: '打退吕布'}] : [];
  }
  /** 每帧：军令同步（5 Hz）、面板、地图（8 Hz）；弹窗 / 结算时关大地图、地图停更。 */
  protected tickBattleMap(dt: number): void {
    this.battleOrders?.update(dt); this.ordersPanel?.update(dt);
    if (!this.battleMap) return;
    this.battleMap.stepAnim(dt); // 舆图展开 / 卷回动画用真实帧时间（战斗暂停时也播）
    // 展开舆图本身就是 'map' 模式（战斗暂停）；其余面板 / 弹窗打开时收起舆图
    if (this.mode !== 'none' && this.mode !== 'map' && this.battleMap.bigOpen) this.battleMap.toggleBig();
    if ((this.mode === 'none' || this.mode === 'map') && !this.over) this.battleMap.update(dt);
  }

  /** 盾碎：碎片效果，换成同章步兵造型（飞熊军等专属造型保留原样）。 */
  protected breakShield(enemy: Enemy): void {
    this.shieldBars?.shatter(enemy.x, enemy.y); this.sfx.play('hitHeavy');
    if (enemy.def.variant) { enemy.dropShield(null); return; }
    const base = this.chapter.enemies.infantry, look = this.yellow ? this.yellow.variant(base, this.elapsed) : base;
    enemy.dropShield(enemy.def.walkVisual && !look.walkVisual ? null : look);
  }

  /** 普通刷兵的环形距离：按镜头可见范围算（镜头拉远也在屏幕外），再往外留 BALANCE.spawnRing。 */
  protected spawnRingDistance(): number {
    const v = this.cameras.main.worldView, half = v.width > 0 ? Math.hypot(v.width, v.height) / 2 : Math.hypot(GAME_WIDTH, GAME_HEIGHT) / 2, R = BALANCE.spawnRing;
    return half + R.pad + Math.random() * R.jitter;
  }
  protected spawnAroundPlayer(kind: EnemyDef['kind'], force = false): Enemy | null {
    const angle = Math.random() * Math.PI * 2;
    const distance = this.spawnRingDistance();
    const x = this.player.x + Math.cos(angle) * distance;
    const y = this.player.y + Math.sin(angle) * distance;
    return this.spawnEnemy(kind, x, y, undefined, force);
  }

  protected updateSpawner(dt: number, time: number): void {
    // 末位首领倒地后等主将捡宝箱：不再刷兵
    if (this.awaitingChest) return;
    this.spawnTimer -= dt;
    // 首领在场：杂兵上限减半、刷兵间隔加倍、每次数量减半（BALANCE.bossSpawn）
    const bossOn = !!this.boss?.active, B = BALANCE.bossSpawn;
    const cap = bossOn ? Math.round(BALANCE.enemyCap * B.capMul) : BALANCE.enemyCap;
    if (this.spawnTimer <= 0 && this.activeEnemyCount() < cap) {
      // 刷怪时间轴按关卡节奏加速（stageTuning.pace）：原来第 N 波的刷怪强度在新的第 N 波出现
      const paced = this.elapsed * (this.chapter.pace ?? 1);
      const easy = this.tutorial?.easy(this.elapsed); // 新手引导：开局 30 秒刷兵放缓
      this.spawnTimer = this.chapter.spawnInterval(paced) * (this.phaseRunner?.calm() || this.combatNow < this.beaconCalmUntil ? PHASES.calmIntervalMul : 1) * (this.phaseRunner?.intervalMul() ?? 1) * (easy?.interval ?? 1) * (this.sishuiPass?.spawnMul ?? 1) * (bossOn ? B.intervalMul : 1) * (this.dual?.spawnIntervalMul ?? 1); // 汜水关西凉营帐全塌后变稀；双首领在场再 ×0.7
      const rawBurst = this.chapter.spawnBurst(paced), burst0 = easy && easy.burstDiv > 1 ? Math.max(1, Math.ceil(rawBurst / easy.burstDiv)) : rawBurst, burst = bossOn ? Math.max(1, Math.ceil(burst0 * B.burstMul)) : burst0;
      for (let i = 0; i < burst; i += 1) {
        if (this.activeEnemyCount() >= cap) break;
        // 配兵表（data/enemyRoster STAGE_MIX / ROSTER_MIX）：新兵种按权重混进来、受占比和同类上限管；底层兵种不配就用本章原刷怪表
        const mix = this.traits?.pick();
        if (mix && 'trait' in mix) { if (this.traits!.spawnSpecial(mix.trait)) continue; }
        if (!this.spawnAroundPlayer(mix && 'base' in mix ? mix.base : this.chapter.pickEnemy(paced))) break;
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

    // 首领出阵：开局就登场的关（2-3 洛阳，chapter.bossAtStart）1 秒后；有关卡目标的关等目标完成；否则按时间
    if (!this.bossSpawned && (this.chapter.bossAtStart ? this.elapsed >= 1 : this.objective ? this.objective.done : this.elapsed >= chapterBossTime(this.chapter)) && this.mode === 'none') {
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
    { const ws = this.pickWaves(); this.ensurePicks(ws[ws.length - 1]); } // 保底：第 3 波后直接是首领、波次不再推进，首领登场时补到最后一档
    const angle = -Math.PI / 2;
    const at = this.bossSpawnPoint(this.player.x + Math.cos(angle) * 430, this.player.y + Math.sin(angle) * 430), x = at.x, y = at.y;
    const boss = this.spawnEnemy('boss', x, y, 1, true);
    if (!boss) {
      this.bossSpawned = false;
      return;
    }
    this.boss = boss;
    this.startParley(boss);
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
      ready:()=>!this.objective||this.objective.done, // 2-3：营寨全毁 → 吕布跃下城头
      line:(id,t)=>(this as unknown as {storyDir?:{line(id:string,t:{x:number;y:number}):boolean}}).storyDir?.line(id,t)??false,
      scroll:id=>(this as unknown as {storyDir?:{midScroll(id:string):boolean}}).storyDir?.midScroll(id)??false},boss); // 剧情台词：故事系统（claude/story-batch1）合并后生效
    // 2-3 营寨：营栅围一圈、营里守军待命、营门出援兵（systems/LuoyangCamps；用户 11-19「营寨…有围栏围着…小怪比较多守着」）
    if(this.dzLubu&&this.objective&&!this.objective.done&&!this.luoyangCamps){if(!this.sishuiObstacles)this.sishuiObstacles=new SishuiObstacles([]);
      const lc=this.luoyangCamps=new LuoyangCamps({scene:this,player:this.player,now:()=>this.combatNow,tents:()=>this.objective?.standing??[],obstacles:this.sishuiObstacles.footprints,
        pick:()=>this.traits?.pick()??null,basePick:()=>this.chapter.pickEnemy(120),spawn:(k,x,y)=>this.spawnEnemy(k,x,y,undefined,true),spawnTrait:(id,x,y)=>this.traits?.spawnSpecial(id,{x,y})??null,brazier:(x,y,s)=>this.supplies?.spawnSishui(7,x,y,s)??false,move:(e,nx,ny,dt)=>{e.moveVx=nx*e.def.speed;e.moveVy=ny*e.def.speed;this.advanceEnemy(e,nx,ny,dt);},tent:this.tentCtx()});
      this.supplies?.purge((x,y)=>lc.camps.some(c=>c.boxes.some(b=>x>b.left-40&&x<b.right+40&&y>b.top-40&&y<b.bottom+40))); /* 落在营栅上的布景收掉 */
      this.spawnLuoyangCommander(lc);}
    // 2-3 友军攻势：义军小队从后方一路打向营寨（data/dongzhuo.ts LUOYANG.push）
    if(this.dzLubu&&this.objective&&!this.objective.done&&!this.allyPush)this.allyPush=new AllyPush({scene:this,now:()=>this.combatNow,paused:()=>this.mode!=='none'||this.over||!!this.cutscene?.active,player:()=>this.player,
      camps:()=>this.objective?.standing??[],enemies:()=>this.enemies,hit:(e,d)=>{this.hitEnemy(e,d,this.combatNow,'melee',true,false);},push:(x,y,r)=>{const t=this.terrain?.pushCircle(x,y,r)??null,c=this.luoyangCamps?.pushOut(x+(t?.x??0),y+(t?.y??0),r)??null;return t||c?{x:(t?.x??0)+(c?.x??0),y:(t?.y??0)+(c?.y??0)}:null;} /* 推开量相加（树 + 营栅） */,approach:(c,x,y)=>this.luoyangCamps?.approach(c,x,y)??null},LUOYANG.push);
    // 2-3：城墙 / 洛水封口建好后，撤掉开局先于城墙生成、落在城墙里或场地外的布景与旗子
    {const z=this.dzLubu;if(z)this.supplies?.purge((x,y)=>!z.inArena(x,y,0)||z.obstacles.footprints.some(b=>x>b.left&&x<b.right&&y>b.top&&y<b.bottom));}
    if(this.chapter.bossStyle==='huaxiong')this.sishuiPass?.onBoss(boss); // 汜水关：关门洞开，华雄带亲卫杀出
    else if(this.chapter.id==='huangjin'&&this.chapter.stage===3)this.sishuiPass?.openGate(); // 1-3 广宗：张角出场城门破开（原来一直不开，城里的兵出不来）
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
    this.presence?.entrance(boss);
    // 剧情：首领登场大卡（立绘 + 名号，短暂停顿）；说了就不再弹中间的名号牌，免得名字出两遍（2026-11-20）
    const introSpoke = !!this.storyDir?.bossIntro(boss.sprite);
    // 没有专属名号的首领（第七章起多数）原来一律写攻城用的「城池守将」（7-1 杨怀出场写城池守将、血条却是白水关守将）：先用首领称号表（与血条同源），都没有才用通用名号
    const named = !!BOSS_PROFILES[this.chapter.bossName] || Object.keys(BOSS_PROFILES).some(k => this.chapter.bossName.includes(k));
    if (!introSpoke) this.announceBoss(named ? profile.title : titleOf(this.chapter.bossStyle) || profile.title, this.chapter.bossName);
    this.lordBossBark('bossAppear', introSpoke); // 主将（HeroBark）接一句
  }

  /** 首领名号标题：画面上部一道短墨痕，墨上名号小字 + 名字，约 2.6 秒淡出；不拦截点击、不暂停。
   *  2026-11-16 试玩反馈「boss 出来那个预警 UI 太大了」：墨痕从横贯全屏缩成约 6 成宽、高度减半，字号降约 4 成，
   *  放在顶部 HUD 与主将之间的空地，不压 HUD、不挡主将。 */
  protected announceBoss(title: string, name: string): void {
    this.children.getByName('boss-announce')?.destroy();
    // 同时在播的战场横幅（如 7-1 山道「山上伏兵！」）收掉：两者都在上半屏中间，墨幅会压在横幅字上（2026-11-20 第 7–12 章检查）
    for (const n of this.children.list.filter(o => o.name === 'combat-notice')) { this.tweens.killTweensOf(n); n.destroy(); }
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
    // 绕障导航：栅栏 / 营栅 / 城墙 / 地形挡住的近战兵绕到缺口（systems/EnemyFlowField，每 0.3 秒按主将位置重算一次，全场共用）
    this.enemyFlow.update(this.combatNow, player.x, player.y, this.flowBoxes, this.flowExtra());
    this.enemyMovement.prepare(this.enemies, this.grid, this.legion.grid, player.x, player.y, dt, this.combatNow, this.enemyFlow);
    this.traits?.update(this.combatNow); // 新兵种：落石 / 地火 / 毒箭 / 中毒
    this.luoyangCamps?.update(dt); // 2-3 营寨：警觉 / 援兵
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.updateVisual(time);
      if(enemy.isSupplySlot)continue;
      enemy.frameStartX = enemy.x;
      enemy.frameStartY = enemy.y;
      if (!enemy.controlImmune && enemy.stunUntil > time) { enemy.moveVx = enemy.moveVy = enemy.intentDx = enemy.intentDy = 0; continue; }
      // 张辽「震慑」叠满：溃逃中的敌兵背向主将逃跑、不出手（weapons/zhangliaoWeapon.ts 设 routUntil；首领 / 免控的不会溃逃）
      if (enemy.routUntil > this.combatNow && enemy.kind !== 'boss' && !enemy.controlImmune) { const fx = enemy.x - player.x, fy = enemy.y - player.y, fd = Math.hypot(fx, fy) || 1; enemy.contactCd = Math.max(enemy.contactCd, .2); const v = enemy.def.speed * ZHANGLIAO.routSpeed; enemy.moveVx = fx / fd * v; enemy.moveVy = fy / fd * v; enemy.intentDx = fx / fd; enemy.intentDy = fy / fd; enemy.sprite.x += enemy.moveVx * dt; enemy.sprite.y += enemy.moveVy * dt; continue; } // 人群转向会把速度算成朝主将，溃逃直接按背向位移
      // 貂蝉「离间」：倒戈中的敌人不追主将，转身冲撞最近的同伴（逻辑在 CharacterPassives.driveTurned）
      // 出手：攻击帧（driveTurned 里 startAttack）+ 前冲（feedback.attack）+ 打中同伴的受击反馈（hitEnemy）；之后照常更新攻击 / 行走帧与深度（原来直接 continue，倒戈的兵定格平移、出手没动作）
      const turnedHit = (t: Enemy, n: number): void => { this.feedback.attack(enemy, Math.atan2(t.y - enemy.y, t.x - enemy.x), this.combatNow, 360); if (n > 0) this.hitEnemy(t, n, this.combatNow, 'melee', true, false); }; // n = 0：闭月分支的魅惑用分支自己的伤害（strike），这里只出动作
      if (player.passive.driveTurned(enemy, dt, this.combatNow, (x, y, r) => this.grid.query(x, y, r), turnedHit) || this.followerPassives.some(fp => fp.driveTurned(enemy, dt, this.combatNow, (x, y, r) => this.grid.query(x, y, r), turnedHit))) {
        enemy.contactCd = Math.max(0, enemy.contactCd - dt);
        enemy.updateAttackVisual(this.combatNow);
        if (enemy.kind !== 'boss' && enemy.kind !== 'elite') enemy.sprite.setDepth(actorDepth(enemy.y + enemy.radius * .72));
        if (enemy.walkSheet && !enemy.externalWalk) enemy.updateWalk(dt, enemy.x - enemy.frameStartX, enemy.y - enemy.frameStartY);
        continue;
      }
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

      if(this.luoyangCamps?.step(enemy,dt)){} // 2-3 营寨守军：待命 / 出营门
      else if(this.traits?.step(enemy,dt,this.combatNow,target)){} // 新兵种机制（重装 / 治疗 / 投掷 / 纵火 / 毒箭 / 弓骑）
      else if(this.customEnemyStep(enemy,dt,this.combatNow,target)){}
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
            this.fireBolt(this.bullets, enemy.x, enemy.y, p.x, p.y, enemy.def.damage*(this.env?.damageMul(enemy)??1)*(this.traits?.damageMul(enemy)??1), 0, false, 210, enemyArrowTexture(this, enemy.sprite.texture.key));
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
        if(this.dual?.step(enemy,dt,this.combatNow)){}
        else if(this.customBossStep(enemy,dt,this.combatNow)){}
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
    const martialSpeed=controlSpeed*(enemy.kind!=='boss'&&this.combatNow<enemy.martialSlowUntil?enemy.martialSlow:1)*(this.env?.speedMul(enemy)??1)*(this.traits?.speedMul(enemy)??1)*(this.enemyForms?.speedMul(enemy)??1)*(this.terrain?.speedMul(enemy.x,enemy.y)??1);
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

  /**
   * 首领 / 精英的绘制层（用户 2026-11-18「华雄穿模，可能其他 boss 也是」）：
   * 原来每帧只给杂兵按脚底 y 排深度，首领被跳过，一直停在生成时的 DEPTH.enemy（20），比所有杂兵（20.1~21.9）都低，被兵堆整片盖住。
   * 现在：首领、精英也按脚底 y 排（和主将照常前后遮挡）；但谁的脚站在首领身体范围里（身前约 95 像素以内、横向在身宽内），
   * 就压到首领整体（坐骑层 -0.002 / 马头前景 +0.001 都跟着首领精灵）之下，杂兵永远插不进首领的几层中间、也盖不住首领；精英同理压杂兵，首领压精英。
   */
  private layerHeads(): Array<{ e: Enemy; rank: number; depth: number; hw: number }> {
    const out: Array<{ e: Enemy; rank: number; depth: number; hw: number }> = [];
    for (const e of this.enemies) if (e.active && !e.isSupplySlot && (e.kind === 'boss' || e.kind === 'elite')) out.push({ e, rank: e.kind === 'boss' ? 2 : 1, depth: 0, hw: Math.max(e.kind === 'boss' ? 70 : 44, e.sprite.displayWidth * .5) });
    out.sort((a, b) => b.rank - a.rank);
    for (const h of out) { h.depth = this.underHeads(h.e, actorDepth(h.e.y + h.e.radius * .72), out, h.rank); h.e.sprite.setDepth(h.depth); }
    return out;
  }
  /** 脚底站在更高一级（首领 > 精英 > 杂兵）身体范围里的，深度压到它之下。 */
  private underHeads(e: Enemy, d: number, heads: ReadonlyArray<{ e: Enemy; rank: number; depth: number; hw: number }>, rank: number): number {
    for (const h of heads) {
      if (h.rank <= rank || h.e === e || !h.depth) continue;
      const dy = (e.y + e.radius * .72) - (h.e.y + h.e.radius * .72);
      if (dy > -4 && dy < 95 && Math.abs(e.x - h.e.x) < h.hw + e.radius) d = Math.min(d, h.depth - .004);
    }
    return d;
  }

  /**
   * 随行认的障碍 = 主将认的那几套（场景审查 B，用户 2026-11-18「随从站进城墙里」）：
   * 场景碰撞框（关墙 / 城墙 / 山崖 / 洪水边界 / 突围通道，都在 sishuiObstacles.footprints）+ 董卓城墙（DongzhuoLubu 自己一份）+ 地形树干（圆）。
   * 河水只减速不挡人，主将也能下水，随行照旧。
   */
  protected wireFollowerObstacles(sq: FollowerSquad): void {
    sq.obstacles = () => { const a = this.sishuiObstacles?.footprints ?? [], d = this.dzLubu?.obstacles.footprints; return d?.length ? [...a, ...d] : a; };
    sq.terrainPush = (x, y, r) => this.terrain?.pushCircle(x, y, r) ?? null;
  }

  /** 步态必须基于碰撞/分离后的真实位移：被挤住时回待机帧。 */
  protected updateEnemyWalkAnimations(dt: number): void {
    const view = this.cameras.main.worldView;
    const margin = 80;
    const heads = this.layerHeads();
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.shadow.setPosition(enemy.x,enemy.isSupplySlot?enemy.y+2:enemy.y + enemy.radius * .72);
      if (enemy.kind !== 'boss' && enemy.kind !== 'elite') enemy.sprite.setDepth(this.underHeads(enemy, actorDepth(enemy.isSupplySlot?enemy.y:enemy.y + enemy.radius * .72), heads, 0));
      // 华雄 / 徐荣由专属控制器出帧；前线推进后成为追兵首领时也不再套通用走路帧（xurong 图集没有 down_0 等帧，会持续报 no frame）
      if(((this.huaxiong||this.xurong)&&enemy===this.boss)||(enemy.kind==='boss'&&this.chasingBosses.some(t=>t.enemy===enemy&&t.life===enemy.spawnId&&(t.huaxiong||t.xurong)))){enemy.shadow.setPosition(enemy.x,enemy.y+1).setDisplaySize(74,20);continue;}
      if (!enemy.walkSheet || enemy.externalWalk) continue;
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
        if (player.takeDamage(enemy.def.damage*(this.env?.damageMul(enemy)??1)*(this.traits?.damageMul(enemy)??1), this.combatNow)) {
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
  /** 中途离开战斗（撤退 / 返回主菜单共用，同一条回滚路径）：放弃远征；本关新获得的回滚（BattleSnapshot），回滚了就整页重载到 bootTo（不填则按启动规则进主页）。 */
  protected leaveBattle(target:string,bootTo:string|null):void{this.abandonRun();this.registry.remove('campaignTransfer');if(rollbackBattle()){if(bootTo)try{sessionStorage.setItem(BOOT_TO_KEY,bootTo);}catch{/* 存储不可用：重载后回主页 */}reloadGame();return;}this.scene.start(target);}
  protected abandonRun():void{if(this.worldCampaign&&!this.over)abandonExpedition(this.expeditionId,this.allies.filter(a=>a.active&&a.reserveSoldier).map(a=>a.kind));}
  protected handleBattlePointer(_pointer:Phaser.Input.Pointer):boolean{return false;}
  /** 武器优先目标（统一索敌，2026-11-16）：射程内首领 > 精锐，各取最近；都没有时返回 null，由武器自己找群怪 / 最近。关卡场景可覆盖（先打敌营）。 */
  protected priorityWeaponTarget(range:number,bodyRadius=true):Enemy|null{
    const px=this.player.x,py=this.player.y;let boss:Enemy|null=null,elite:Enemy|null=null,bd=Infinity,ed=Infinity;
    { const lock=this.objective?.lockedTarget(px,py,range); if(lock)return lock; } // 关卡锁定目标（敌营等）排第一：用户「武将攻击逻辑会一直不打营寨」
    { let g:Enemy|null=null,gd=Infinity;for(const e of this.gateSet){if(!e.active||e.hp<=0)continue;const d=Math.hypot(e.x-px,e.y-py)-(bodyRadius?e.radius:0);if(d<=range&&d<gd){gd=d;g=e;}}if(g)return g; } // 首领关卡要先拆的营垒 / 连营 / 城门（markGate）：走到射程内就先打它
    // 首领的护法符柱（1-2 张宝，Enemy.ward）：符柱没碎时首领几乎不受伤，射程内有符柱就先打最近的符柱
    { let ward:Enemy|null=null,wd=Infinity;for(const e of this.grid.query(px,py,range+60)){if(!e.active||!e.ward||e.hp<=0)continue;const d=Math.hypot(e.x-px,e.y-py)-(bodyRadius?e.radius:0);if(d<=range&&d<wd){wd=d;ward=e;}}if(ward)return ward; }
    for(const e of this.grid.query(px,py,range+60)){if(!e.active||e.isSupplySlot||e.invulnerable)continue; /* 刀枪不入的（城头董卓、劝降中）不当首选目标 */const d=Math.hypot(e.x-px,e.y-py)-(bodyRadius?e.radius:0);if(d>range)continue;
      if(e.kind==='boss'&&d<bd){bd=d;boss=e;}else if(e.kind==='elite'&&d<ed){ed=d;elite=e;}}
    return boss??elite;
  }
  /** 主将这一帧的移动方向（单位向量；没在走为 null）：挡路的障碍物判定用。 */
  private moveDir: { x: number; y: number } | null = null;
  /**
   * 自动索敌打障碍物（用户 11-19「攻击逻辑也要加上打障碍物」）：可破坏物件（Enemy.breakable、活着、不是刀枪不入）里离 (x, y) 最近、在 range 内的。
   * blocking：只要挡在主将前进方向上的（沿移动方向 0～80 + 两边半径、横向不超过两边半径）。
   */
  obstacleTarget(x: number, y: number, range: number, blocking: boolean, dir: { x: number; y: number } | null = this.moveDir): Enemy | null {
    if (blocking && !dir) return null;
    let best: Enemy | null = null, bd = Infinity; const pr = this.player.radius;
    for (const e of this.enemies) {
      if (!e.active || !e.isSupplySlot || !e.breakable || e.invulnerable || e.hp <= 0) continue;
      const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
      if (d > range + e.radius || d >= bd) continue;
      if (blocking && dir) { const along = dx * dir.x + dy * dir.y, side = Math.abs(-dx * dir.y + dy * dir.x); if (along < 0 || along > 80 + e.radius + pr || side > e.radius + pr) continue; }
      bd = d; best = e;
    }
    return best;
  }
  /** 本帧给哪些可破坏物件加了 lockTarget（只放自己加的，关卡目标的锁不动）。 */
  private obstacleLocks = new Set<Enemy>();
  /**
   * 每帧（武器出手前）：挡在主将前进方向上的可破坏物件、以及「主将身边 OBSTACLE_REACH 内没有敌人」时最近的可破坏物件，临时加 lockTarget——
   * 各武器的出手 / 选靶条件本来就把「带锁的物件」当敌人（同 2-3 营寨），这样所有武器、随行都会去打；有敌人在身边时只打挡路的。
   */
  private updateObstacleLocks(): void {
    for (const e of this.obstacleLocks) e.lockTarget = false; this.obstacleLocks.clear();
    if (this.over || this.mode !== 'none' || !this.player?.alive) return;
    const p = this.player, R = OBSTACLE_REACH, add = (e: Enemy | null) => { if (e && !e.lockTarget) { e.lockTarget = true; this.obstacleLocks.add(e); } };
    add(this.obstacleTarget(p.x, p.y, R, true));
    for (const e of this.grid.query(p.x, p.y, R + 60)) if (e.active && !e.isSupplySlot && !e.invulnerable && e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) <= R + e.radius) return;
    add(this.obstacleTarget(p.x, p.y, R, false));
  }
  /** HUD 镜头（只在电脑布局建）：渲染 scrollFactor 0 的对象（HUD、面板、横幅、弹窗），保持原大小；主镜头只渲染战场、按 BATTLE_ZOOM_DESKTOP 拉远。 */
  private uiCam: Phaser.Cameras.Scene2D.Camera | null = null;
  /**
   * 镜头拉远（用户「镜头拉远 10–15%」）：主镜头 × BATTLE_ZOOM_DESKTOP；另加一个 UI 镜头（同画布大小、原倍数）。
   * 每帧渲染前把顶层对象分两拨：scrollFactor 0 的（含整层都是 HUD 的 Layer）只给 UI 镜头画，其余只给主镜头画——新建的 HUD 自动归位，各系统不用改。
   * 震屏 / 闪屏 / 淡入淡出都只作用在主镜头（HUD 不跟着抖）。
   */
  private setupUiCamera(): void {
    this.uiCam = null;
    if (!IS_DESKTOP) return;
    const main = this.cameras.main;
    main.setZoom(RENDER_SCALE * BATTLE_ZOOM_DESKTOP);
    const ui = this.cameras.add(0, 0, main.width, main.height, false, 'ui'); // CameraManager.add 已在 main.ts 统一设为左上原点、× RENDER_SCALE
    this.uiCam = ui;
    const route = () => {
      if (!this.uiCam) return;
      const mid = main.id, uid = ui.id, both = mid | uid;
      for (const o of this.children.list as Array<Phaser.GameObjects.GameObject & { scrollFactorX?: number; cameraFilter: number; list?: Array<{ scrollFactorX?: number }> }>) {
        let sf = o.scrollFactorX; if (sf === undefined && o.type === 'Layer') sf = o.list?.[0]?.scrollFactorX;
        const want = (o.cameraFilter & ~both) | (sf === 0 ? mid : uid);
        if (o.cameraFilter !== want) o.cameraFilter = want;
      }
    };
    route();
    this.events.on('prerender', route);
    this.events.once('shutdown', () => { this.events.off('prerender', route); this.uiCam = null; });
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
      setCritOverride: (crit) => { scene.debugCrit = crit; },
      nearestEnemy: (...args) => scene.nearestEnemy(...args),
      knockEnemy: (e, dx, dy, ms) => scene.knockEnemy(e, dx, dy, ms),
      priorityTarget: (range,bodyRadius)=>scene.priorityWeaponTarget(range,bodyRadius),
      obstacleTarget: (x, y, r, blocking) => scene.obstacleTarget(x, y, r, blocking),
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
      shieldAllies: (ax, ay, bx, by, r, frac, until) => { const ux = bx - ax, uy = by - ay, len = Math.hypot(ux, uy) || 1; for (const u of scene.allies) { if (!u.active) continue; const t = Math.max(0, Math.min(1, ((u.x - ax) * ux + (u.y - ay) * uy) / (len * len))); if (Math.hypot(u.x - (ax + ux * t), u.y - (ay + uy * t)) > r) continue; u.shield = Math.max(u.shield, u.maxHp * frac); u.shieldUntil = Math.max(u.shieldUntil, until); } },
      focusAllies: e => { scene.legion.focus = e; scene.legion.focusLife = e.spawnId; },
      healAlliesIn: (x, y, r, frac) => { for (const u of scene.allies) if (u.active && Math.hypot(u.x - x, u.y - y) <= r) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * frac); },
      hasteAllies: (x, y, r, dt, frac) => { for (const u of scene.allies) if (u.active && Math.hypot(u.x - x, u.y - y) <= r) u.cooldown = Math.max(0, u.cooldown - dt * frac); },
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
      knockEnemy: (e, dx, dy, ms) => scene.knockEnemy(e, dx, dy, ms),
      // 随行同主将的索敌规则：关卡锁定目标（敌营等）优先；没敌人时打最近的可破坏物件（随行没有「挡路」判定）
      priorityTarget: (range: number) => scene.objective?.lockedTarget(f.x, f.y, range) ?? null,
      obstacleTarget: (x: number, y: number, r: number, blocking: boolean) => scene.obstacleTarget(x, y, r, blocking, null),
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
    if (weaponHit && !fromAlly && this.branchRt && !enemy.isSupplySlot) this.branchRt.onWeaponHit(enemy, rawDamage); // 兵器专职（仁德 / 三英）
    if (this.chain.until > time && !this.chain.sharing && this.chain.set.get(enemy) === enemy.spawnId) { this.chain.sharing = true; for (const [o, life] of this.chain.set) if (o !== enemy && o.active && o.spawnId === life) this.hitEnemy(o, rawDamage * .3, time, source, fromAlly, false); this.chain.sharing = false; } // 锦囊「连环计」
    enemy.lastHitFromAlly = fromAlly;
    if(enemy.isSupplySlot){if(this.campSiege?.isCamp(enemy)){const d=this.campSiege.incoming(enemy,rawDamage,source,fromAlly,time);enemy.hp-=d;if(d>0)enemy.flash(time);this.sfx.play(d>0?'hitHeavy':'hitLight');if(enemy.hp<=0)this.killEnemy(enemy);return false;} /* 营寨攻坚：耐久 / 每秒上限 / 火攻 / 远打（systems/CampSiege） */enemy.hp-=Math.max(1,Math.round(rawDamage));enemy.flash(time);this.sfx.play('hitHeavy');if(enemy.hp<=0)this.killEnemy(enemy);return false;}
    if (enemy === this.boss) this.ensureBossPhase2();
    if (this.xiliang) rawDamage *= this.xiliang.incoming(enemy, source);
    if (enemy === this.boss && this.moveset) { rawDamage *= this.moveset.incoming(fromAlly); this.moveset.hit(time); }
    if (this.dzLubu && enemy === this.dzLubu.lubu) rawDamage = this.dzLubu.clampDamage(enemy, rawDamage); // 2-3 吕布锁在 1/3 血
    if (enemy.def.trait && this.traits) rawDamage *= this.traits.damageTakenMul(enemy);
    if (this.enemyForms) rawDamage *= this.enemyForms.damageMul(enemy, time); // 敌方军阵：盾墙正面减伤 / 阵破易伤 // 新兵种：盾墙 / 举盾正面减伤
    if(this.yellow&&enemy.kind==='shield'&&enemy.shieldMax===0&&enemy.def.behavior!=='wall'&&!fromAlly&&source!=='fire'){const angle=enemy.direction==='left'?Math.PI:enemy.direction==='right'?0:enemy.direction==='up'?-Math.PI/2:Math.PI/2;if(Math.cos(Math.atan2(this.player.y-enemy.y,this.player.x-enemy.x)-angle)>.25)rawDamage*=.65;}
    if (source === 'arrow') this.sfx.play('hitArrow');
    else if (source === 'fire') this.sfx.play('hitFire');
    else this.sfx.play('hitLight');
    if (enemy.kind === 'boss' && !fromAlly) this.sfx.play('bossHit'); // 首领专属沉重受击声（节流，不会每下都响）
    const bossHpBefore = enemy.kind === 'boss' ? enemy.hp / enemy.maxHp : 1;
    if (this.dual?.owns(enemy)) rawDamage *= this.dual.incoming(enemy, fromAlly, time);
    if (enemy === this.boss && this.lubu) rawDamage *= this.lubu.incomingDamageMultiplier(source, time);
    if (enemy === this.boss && this.zhangjiao) rawDamage *= this.zhangjiao.takenMul;
    { let v = this.player.passive.vulnerability(enemy, time); for (const fp of this.followerPassives) v = Math.max(v, 1 + (fp.vulnerability(enemy, time) - 1) * FOLLOW.passiveScale); rawDamage *= v; } // 貂蝉倾城：易伤（部曲伤害同样吃加成；随行貂蝉的按随行系数折算）
    if (this.synergy) rawDamage *= this.synergy.incoming(enemy, fromAlly, time); // 八门金锁阵里加深 / 背水一战 / 铁壁军阵之后全军冲杀
    const firstStrike = !fromAlly && weaponHit && !!this.relics?.firstStrike(enemy);
    const crit = this.debugCrit !== null && !fromAlly ? this.debugCrit : firstStrike || weaponHit && Math.random() < Math.min(0.65, this.player.stats.critChance + this.player.growth.criticalBonus() + (!fromAlly ? this.player.passive.critBonus(time) + this.player.growth.aimCriticalBonus() + this.buildCombat.criticalBonus(enemy, time) : 0))
      || fromAlly && !!this.synergy?.allyCrit(Math.min(0.65, this.player.stats.critChance + this.player.growth.criticalBonus() + this.buildCombat.criticalBonus(enemy, time))); // 合击「弩阵」：部曲也会暴击
    enemy.lastHitHeavy = !fromAlly && (crit || this.player.passive.isInvulnerable(time) || this.player.weapons[0]?.id === 'dangyang_roar'); // 重击：暴击 / 马超冲锋中 / 张飞大喝（死亡特效击飞）
    if(!fromAlly&&weaponHit)rawDamage=this.buildCombat.damage(enemy,rawDamage,crit,time);
    if(!fromAlly)rawDamage*=this.player.growth.gearHitMultiplier(enemy.kind);
    // 智力：非武器伤害（技艺、灼烧等）按法术系数 × 智力、含主属性；法术武器（火旗 / 火雷 / 连弩 / 团扇）的武器命中再乘法术系数
    if(!fromAlly&&!weaponHit)rawDamage*=this.player.growth.skillDamageMultiplier();else if(!fromAlly)rawDamage*=this.player.growth.spellWeaponMultiplier(this.player.weapons[0]?.id);
    if(!fromAlly)rawDamage*=this.primaryPerkHit(enemy,time,weaponHit,crit); // 主属性专精（千钧 / 破阵 / 疾影 / 连珠）
    let damage = Math.max(1, Math.round(rawDamage * (crit ? BALANCE.critMultiplier * (fromAlly ? 1 : 1 + this.buildCombat.critDamageBonus()) : 1) * (firstStrike ? RELIC.zhanjiangMul : 1)));
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
    if (!fromAlly && weaponHit) this.synergy?.leech(damage, time); // 合击「背水一战」吸血
    if (fromAlly) this.buildCombat.allyHit(enemy, time); // 合击「火牛阵」
    if (!fromAlly && weaponHit) this.relics?.onWeaponHit(enemy, rawDamage, time);
    if(!fromAlly&&weaponHit){const tags=this.player.growth.build.tags();const vfx=buildVfx(this);const a=Math.atan2(enemy.y-this.player.y,enemy.x-this.player.x);if(tags.warrior)vfx.emit('combo',enemy.x,enemy.y-8,time,42,a);if(crit&&tags.archery)vfx.emit('critical',enemy.x,enemy.y-8,time,48);if(tags.cavalry&&this.buildCombat.charged())vfx.emit('pure_charge',enemy.x,enemy.y-8,time,70,a);this.legion.command.onHit(enemy,time);this.controlBuild?.onHit(enemy,time);this.synergy?.onHit(enemy,rawDamage,time);this.buildCombat.onHit(enemy,rawDamage,crit,time);this.relicHits++;
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
    if (hpBefore > .5 && after <= .5 && boss.hp > 0) { this.hitFeel.bossPhase(); this.sfx.play('bossPhase'); } // 音效审计：转阶段原来无声
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

  /** 敌军死亡特效（脚下尘土，2026-11-18）。 */
  protected deathFx: DeathFx | null = null;
  /** 受击来源（死亡倒向用）：我方部曲打的取离敌人最近的我方单位，其余（主将的近战 / 弹道）取主将位置。 */
  /** 死亡特效的兵种变化：骑兵人坠马放马、弓兵 / 步兵 / 盾兵兵器脱手、黄巾兵（第一章）头巾飘走、重击击飞。 */
  protected deathOptsOf(enemy: Enemy): DeathOpts {
    const k = enemy.kind, sheet = enemy.walkSheet || '', o: DeathOpts = { heavy: enemy.lastHitHeavy };
    if (k === 'cavalry') o.horse = true;
    else if (k === 'archer') o.weapon = 'bow';
    else if (k === 'shield') o.weapon = /rattan/.test(sheet) || enemy.spawnId % 2 ? 'rattan' : 'tower';
    else if (k === 'infantry' || k === 'elite') o.weapon = /spear/.test(sheet) ? 'spear' : 'blade';
    o.turban = this.chapter.id === 'huangjin' && k !== 'elite';
    return o;
  }
  protected hitSourceOf(enemy: Enemy): { x: number; y: number } {
    if (enemy.lastHitFromAlly) {
      let best: { x: number; y: number } | null = null, bd = 170 * 170;
      for (const a of this.allies) { if (!a.active) continue; const dx = a.x - enemy.x, dy = a.y - enemy.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = a; } }
      if (best) return best;
    }
    return this.player;
  }
  private killWindowAt = 0; private killWindowN = 0;
  protected killEnemy(enemy: Enemy): void {
    if (this.dzLubu?.preventKill(enemy)) return; // 2-3 吕布打到底不死：锁血逃走
    if (!this.persuadeKill && this.fortunes?.preventKill(enemy)) return; // 机缘降将：试阵中打到底不死，跪地请降
    if (!this.persuadeKill && this.parley?.preventKill(enemy)) return; // 首领招降：没表态前不死
    if (!this.persuadeKill && this.dual?.preventKill(enemy)) return; // 双首领：每人一个招降窗
    if (!enemy.active) return;
    if (this.phasePlan) this.onStageCardKill(enemy);
    this.branchRt?.onKill(enemy);
    this.traits?.onKilled(enemy); // 纵火兵爆燃、驯兽师倒下猛兽狂暴
    // 双首领：先了结的不掉宝箱（只做通用记账），最后一个照常；单首领败退型淡出退走
    const dualRes = this.dual?.owns(enemy) ? this.dual.resolve(enemy, this.persuadeKill, this.combatNow) : null;
    const retreat = dualRes ? dualRes.how === 'retreated' : this.bossRetreats(enemy);
    this.objective?.onKill(enemy);
    const routed = enemy.routUntil > this.combatNow; // 张辽「止啼」：击杀溃逃中的敌兵才攒
    if (this.runConfig.character === 'zhurong') zhurongSpread(this.weaponHost, enemy, this.combatNow); // 祝融「火神祝融」：着火的敌兵倒下时火蔓延
    const p3Kill = this.player.passive.p3KillCounts(enemy, this.combatNow); // P3 第二批：甘宁被钩过的 / 祝融着火的 / 孙权、孟获任意击杀
    const kind = enemy.kind;
    // 吕布倒地改由 playBossFall（倒地 4 帧）播，不再叠旧的通用死亡闪影
    if(kind==='boss'){const old=this.chasingBosses.find(t=>t.enemy===enemy&&t.life===enemy.spawnId),h=old?old.huaxiong:this.huaxiong,x=old?old.xurong:this.xurong;h?.defeat();x?.defeat();if(enemy===this.boss){this.sishuiPass?.onBossDown();{const at={x:enemy.x,y:enemy.y,displayHeight:enemy.sprite.displayHeight};if(retreat&&!dualRes)retreatFade(this,enemy,this.player);this.storyBossFell=dualRes||this.persuadeKill?true:retreat?this.retreatLine(at):(this.parley?.dyingLine(at)??false)||!!this.storyDir?.bossFall(at);if(this.sishuiPass?.wenjiu){setStoryFlag('wenjiu_huaxiong');this.time.delayedCall(1600,()=>this.storyDir?.line('hulao-1.wenjiu',this.player.sprite));}}this.moveset?.defeat();this.moveset=null;this.bossMount?.destroy();this.bossMount=null;}if(old){if(h)this.deadBossControllers.push(h);if(x)this.deadBossControllers.push(x);}
      // 倒地：控制器自己有倒地帧的（华雄 / 徐荣 / 子类首领）沿用；其余首领播通用倒地（受伤帧 + 倒下 + 手绘扬尘 + 下沉淡出）
      this.bossFallDir=0;if(!(h||x||this.bossHasDeathArt()||this.persuadeKill||dualRes||retreat))this.bossFallDir=playBossFall(this,enemy,this.zhangjiao?'zhangjiao_moves':this.lubu?'lubu_moves':undefined,old?undefined:this.chapter.bossStyle);}
    enemy.deactivate();
    if(enemy.isSupplySlot){this.sfx.play('propBreak');this.supplies?.onBroken(enemy);return;}
    this.warfeedKill();
    if(enemy.def.behavior==='wall')return;
    if(this.deathFx){const from=this.hitSourceOf(enemy);this.deathFx.play(enemy,from.x,from.y,this.combatNow,this.deathOptsOf(enemy));}
    this.kills += 1;
    this.player.passive.onKill(kind, this.combatNow);
    if (routed) this.player.passive.onRoutKill(this.combatNow);
    if (p3Kill) this.player.passive.p3Gain(this.combatNow);
    this.buildCombat.onKill(enemy,this.combatNow);
    this.controlBuild?.onKill(enemy,this.combatNow);
    this.legion.onKill(enemy);
    this.itemDrops?.onKill(enemy);
    if(kind==='elite')this.battleHeal?.onEliteDown(enemy.x,enemy.y); // 精锐：概率掉军中伤药（保底）
    if(enemy.kind==='boss')this.runMerit.boss++;else if(enemy.kind==='elite')this.runMerit.elite++; // 战功：精英 / 首领
    this.relics?.onKill();
    if(this.player.growth.gear.specials.includes('bloodthirst')&&this.combatNow>=this.player.growth.killHealAt){this.player.growth.killHealAt=this.combatNow+500;this.player.heal(this.player.maxHp*.01);}
    const jade=this.player.growth.charmLegend.army_jade;if(jade!==undefined&&this.combatNow>=this.relicHealAt){const k=CHARM_LEGEND.charm_army_jade.heal[jade];this.relicHealAt=this.combatNow+1000;this.player.heal(k);this.artEffects.show(5,this.player.x,this.player.y-12,35,this.combatNow,260);for(const u of this.allies.filter(u=>u.active&&u.hp<u.maxHp).slice(0,2)){u.hp=Math.min(u.maxHp,u.hp+2*k);this.artEffects.show(5,u.x,u.y-10,30,this.combatNow,260);}}
    this.sfx.play('enemyDie'); this.sfx.play('killThud'); // 击杀加一层闷响（节流）
    // 割草多杀分层（音效审计：一刀砍倒 8 个和 1 个原来一个声）：0.18 秒内累计 ≥4 杀加 killBurst、≥10 杀加 killSweep（各自节流）
    { const nowMs = performance.now(); if (nowMs - this.killWindowAt > 180) { this.killWindowAt = nowMs; this.killWindowN = 0; } this.killWindowN++;
      if (this.killWindowN === 10) this.sfx.play('killSweep'); else if (this.killWindowN === 4) this.sfx.play('killBurst'); }
    if (kind === 'elite') { this.hitFeel.hitStop(HIT_FEEL.eliteKillStopMs); this.hitFeel.shake('small'); }
    if (kind === 'boss' && !this.persuadeKill && !retreat) { this.hitFeel.bossDeath(); this.sfx.play('bossFall'); } // 击杀首领：0.5 秒慢动作 + 强震，之后照常倒地 / 宝箱
    if (dualRes?.order === 'first') { this.persuadeKill = false; return; } // 双首领先了结的一位：不掉宝箱、不结算
    if (kind === 'boss') {
      const index=this.chasingBosses.findIndex(t=>t.enemy===enemy&&t.life===enemy.spawnId);
      if(index>=0){
        unlockAchievement('chaser');
        const old=this.chasingBosses[index];old.battle?.clear();old.huaxiong?.clear();old.xurong?.clear();old.label.destroy();this.chasingBosses.splice(index,1);
        this.recordFrontlineVictory(old.stage);
      }else{this.bossKilled=true;this.boss=null;this.recordFrontlineVictory(this.battleStage());this.lordBossBark('bossDown',this.storyBossFell);this.storyBossFell=false;}
      // 倒地后原地掉宝箱，主将捡起遗物才进下一阶段（原来的三选一遗物卡改成宝箱）
      this.spawnBossChest(enemy.x,enemy.y,()=>{if(this.bossKilled&&this.chasingBosses.length===0){this.afterPendingPicks(()=>{if(this.storyDir)this.storyDir.chapterClose(()=>this.finish(true,'boss'));else this.finish(true,'boss');});}else{this.resumePendingChoices();if(this.bossKilled)this.showGrowthNotice('当前首领已败 · 仍有'+this.chasingBosses.length+'名追击首领');}});return;
    }
    this.spawnGem(enemy.x, enemy.y, enemy.def.xp * (this.boss?.active && enemy.kind !== 'boss' ? BALANCE.bossSpawn.xpMul : 1)); // 首领在场：杂兵经验 ×2（BALANCE.bossSpawn.xpMul）
  }

  /**
   * 击退（2026-11-18 夜，诸葛亮借东风）：沿 (dx, dy) 分 6 步、ms 内推完。首领 / 不受控 / 城墙 / 补给位不推；
   * 每步先看落点：碰到城墙（behavior wall）、障碍物落脚范围或场地外（supplies.healBlocked：泗水关建筑、洛阳城头场地）就停在原地。
   */
  knockEnemy(e: Enemy, dx: number, dy: number, ms: number): void {
    if (!e.active || e.isSupplySlot || e.kind === 'boss' || e.controlImmune || e.def.behavior === 'wall') return;
    const steps = 6, sx = dx / steps, sy = dy / steps, spawn = e.spawnId, blocked = this.supplies?.healBlocked;
    const step = (): boolean => {
      if (!e.active || e.spawnId !== spawn || this.over) return false;
      const nx = e.x + sx, ny = e.y + sy;
      if (blocked?.(nx, ny, e.radius)) return false;
      for (const w of this.grid.query(nx, ny, e.radius + 80)) if (w !== e && w.active && w.def.behavior === 'wall' && Math.hypot(w.x - nx, w.y - ny) < w.radius + e.radius) return false;
      e.sprite.setPosition(nx, ny); return true;
    };
    if (!step()) return;
    let left = steps - 1; const ev = this.time.addEvent({ delay: Math.max(16, ms / steps), repeat: left - 1, callback: () => { if (!step()) ev.remove(false); if (--left <= 0) ev.remove(false); } });
  }

  protected nearestEnemy(x: number, y: number, range: number, exclude: Enemy | null = null, ignored?: Set<number>): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = range * range;
    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.invulnerable || enemy === exclude || (ignored && ignored.has(enemy.spawnId))) continue;
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
    // 射向营垒 / 连营 / 城门的主将箭：锁定它，途中伏兵不挡（11-20：黄月英连弩站营垒边 270 秒只拆 1 座，箭全被身边伏兵挡掉）
    bolt.aim = null; if (fromPlayer && this.gateSet.size) for (const g of this.gateSet) if (g.active && g.hp > 0 && Math.hypot(g.x - tx, g.y - ty) <= g.radius + 8) { bolt.aim = g; break; }
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
        if (bolt.aim && bolt.aim.active && bolt.aim.hp > 0 && enemy !== bolt.aim) continue; // 射营垒的箭只撞营垒
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
      fx = { crit, kind: k, text: this.add.bitmapText(0, 0, dmgFontKey(this, k, DMG_FONT, DMG_STYLE[k]), '', DMG_STYLE[k].size).setOrigin(0.5).setDepth(DEPTH.dmgText), life: 0, vx: 0, vy: 0, active: false };
      fx.kind = '' as DmgKind; // 强制下面套用样式
      this.dmgFx.push(fx);
    }
    if (fx.kind !== k) { const st = DMG_STYLE[k]; fx.kind = k; fx.text.setFont(dmgFontKey(this, k, DMG_FONT, st), st.size); }
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
        const gained = this.player.gainXp(this.player.growth.scaleXp(gem.value, this.heroXpRate()));
        this.relics?.onGem(this.combatNow);
        if (gained > 0) this.onHeroLevelUp(gained); // 软上限（2026-11-20）：不封顶，越级后每级 ×1.45
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
    // 剧情卷轴还在播（storyHolds）时，三选一 / 招募等收起后回到剧情暂停
    if (mode === 'none' && this.storyHolds > 0 && !this.over) mode = 'story';
    // 所有战斗 Timer / Tween 一起冻结；绝对期限使用 combatNow。
    this.mode = mode;
    if(mode!=='pause')this.children.getByName('build-panel')?.destroy();if(mode!=='pause')this.children.getByName('item-bag')?.destroy();
    const canPlay = mode === 'none' && !this.over;
    this.time.paused = !canPlay;
    if (!this.over) this.music?.setPaused(mode !== 'none'); // 界面 BGM 检查：暂停 / 升级 / 招募 / 舆图 / 行营面板打开时战斗曲压到一半
    if (canPlay) this.tweens.resumeAll();
    else this.tweens.pauseAll();
    if (canPlay && this.pendingGrowthNotices.length) this.showGrowthNotice(this.pendingGrowthNotices.shift()!);
    this.joystick.setEnabled(canPlay);
    for (const child of this.children.list) if (child.name === 'combat-notice') (child as Phaser.GameObjects.Text).setVisible(canPlay);
    if (!canPlay) this.joystick.reset();
    if (this.levelPanel) this.levelPanel.setVisible(mode === 'levelup'||mode==='bossloot');
    this.rerollButton?.setVisible(mode==='levelup');
    this.pointsButton?.setVisible(mode==='none'&&!this.over&&this.player.growth.unallocated>0&&mechOpen('attributes'));
    if (this.attributePanel) this.attributePanel.setVisible(mode === 'attributes');
    if (mode !== 'attributes') this.attributeTip?.hide();
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
      exit?.setData('confirm',false).setText(IS_DESKTOP?'撤退':'返回选将').setColor('#b5c4b2').setScale(1);
      (this.pausePanel.getByName('pause-menu') as Phaser.GameObjects.Text|null)?.setData('confirm',false).setText('返回主菜单').setColor('#b5c4b2').setScale(1);
      if(this.pauseKeysText?.getData('warn')){this.pauseKeysText.setData('warn',false).setColor('#7f9987');this.refreshInputHints();}
    }
    if (this.resultPanel) this.resultPanel.setVisible(mode === 'result');
    // 告捷：按进度补查武将来投（第一章通关诸葛亮、白门楼 / 三英战吕布貂蝉……），揭幕压在结算上面
    if (mode === 'result' && this.victory) window.setTimeout(() => { if (this.scene.isActive() && this.mode === 'result') checkHeroJoins(this); }, 700);
    if (mode === 'rest') commitBattle(); // 关卡告捷进行营：本场所得生效
    if (mode === 'rest' && !this.restIntroPlayed) { this.restIntroPlayed = true; this.playRestIntro(); }
  }

  protected openUpgrade(): void {
    if (this.over || this.pendingLevels <= 0) return;
    if (this.needBranch()) { this.openBranch(); return; } // 同一时刻专职面板与三选一都要出：先专职，选完再接三选一
    this.openUpgradeNow();
  }
  /** 本命练到 Lv5、还没选兵器专职（两条分支都已实现）。 */
  needBranch(): boolean {
    if (!mechOpen('branch')) return false; // 玩法逐章解锁：兵器专职 3-1 开放
    const own = this.player?.weapons.find(w => w.id === getCharacter(this.runConfig.character).startWeapon); if (!own || own.branch) return false;
    const bs = branchesFor(own.id); return own.level >= (WEAPON_DEFS[own.id]?.maxLevel ?? 5) && bs.length === 2 && bs.every(b => b.ready);
  }
  /** 兵器专职面板（ui/BranchPickPanel）：暂停战斗，两条大卡二选一；契合当前流派的那条效果 ×BRANCH_FIT.fitMul。 */
  branchPanel: Phaser.GameObjects.Container | null = null; private branchOpts: WeaponBranch[] = []; branchFitId = '';
  protected openBranch(): void {
    if (this.branchPanel || this.over || !this.needBranch()) return; // 已选专职：本次征程锁定，只有行营「重整构筑」能洗掉
    const ch = this.runConfig.character, hero = getCharacter(ch), own = this.player.weapons.find(w => w.id === hero.startWeapon)!, tags = this.player.growth.build.tags();
    // 主修两派：主修已满时，第三派那条专职照样能选，但不算契合（也不占主修）
    const bd = this.player.growth.build;
    this.branchOpts = [...branchesFor(own.id)]; this.branchFitId = fitBranch(this.branchOpts.filter(x => bd.schoolOpen(x.school)), s => tags[s] ?? 0, heroAffinity(ch))?.id ?? '';
    const majors = bd.majors(), notes = Object.fromEntries(this.branchOpts.map(x => [x.id, majors.includes(x.school) ? '' : bd.schoolOpen(x.school) ? `选定后「${SCHOOLS[x.school].name}」成为主修之一` : `「${SCHOOLS[x.school].name}」不在主修两派：没有契合加成`]));
    this.setMode('branch'); this.sfx.play('gong');
    playSheet(this, 'fx_awaken_' + (branchById(this.branchFitId)?.school ?? 'warrior'), this.player.x, this.player.y - 20, { size: 260, ms: 900, depth: DEPTH.fx, add: true });
    this.branchPanel = openBranchPanel(this, { hero: ch, heroName: hero.name, weaponName: weaponName(own.id, ch), branches: this.branchOpts, fitId: this.branchFitId, notes, onPick: (b) => this.chooseBranch(this.branchOpts.indexOf(b)) });
  }
  /** 选第 i 条专职（按钮 / 1 2 键 / 测试）。 */
  chooseBranch(i: number): boolean {
    const b = this.branchOpts[i]; if (!b || !this.branchPanel) return false;
    const own = this.player.weapons.find(w => w.id === getCharacter(this.runConfig.character).startWeapon); if (!own || own.branch) return false; // 已锁定不能改
    own.branch = b.id; own.attuned = b.id === this.branchFitId; this.player.growth.build.branchSchool = b.school; // 主修：专职那派（有空位时）占一派
    this.branchPanel.destroy(); this.branchPanel = null; this.setMode('none');
    this.sfx.play('gong'); playSheet(this, 'fx_awaken_' + b.school, this.player.x, this.player.y - 20, { size: 300, ms: 1000, depth: DEPTH.fx, add: true });
    this.showWaveBanner('兵器专职 · ' + b.name, false, own.attuned ? `契合流派 · 专职效果 +${Math.round((BRANCH_FIT.fitMul - 1) * 100)}%` : '本次征程锁定');
    if (this.pendingLevels > 0 && this.pickGapOk()) this.openUpgrade();
    return true;
  }
  private openUpgradeNow(): void {
    if (this.over || this.pendingLevels <= 0) return;
    this.sfx.level();
    (this.levelPanel.getByName('upgrade-title') as Phaser.GameObjects.Text)?.setText('选择本次强化');
    { const lv = this.player.level, n = this.player.growth.unallocated, military = this.militaryPending > 0;
      (this.levelPanel.getByName('upgrade-title') as Phaser.GameObjects.Text)?.setText(military ? '军略 · 本关保底强化' : '武将升级 · 选择本次强化');
      (this.levelPanel.getByName('upgrade-points-hint') as Phaser.GameObjects.Text)?.setVisible(true).setText(`${military ? '军略（不给属性点）· ' : ''}武将 Lv.${lv}${n > 0 ? ` · 待分配属性点 ${n}` : ''}`).setName('upgrade-points-hint'); }
    this.rerolls=0;
    if (this.paceOn()) { this.lastPickAt = this.elapsed; this.forcePickNow = false; this.pickBatch = this.pendingLevels; this.pickBatchDone = 0; this.batchHint(); }
    this.upgradeOptions = buildUpgradeOptions(this.player, this.player.weapons, this.player.growth, this.newCardSource());
    if (this.chestPick && this.phasePlan) { this.chestPick = false; const k = this.upgradeOptions.findIndex((o, i) => i > 0 || o.kind === 'foundation'); this.upgradeOptions[k < 0 ? 2 : k] = chestCharmCard(this.phasePlan.chapter, () => this.grantCharm()); }
    if (this.relics?.takeXiangguo()) { this.relicExtraPicks = 1; this.relicFreeRerolls = 1; (this.levelPanel.getByName('upgrade-points-hint') as Phaser.GameObjects.Text)?.setVisible(true).setText('相国印 · 本次可连选两张，免费换一批 1 次'); }
    this.renderCards();
    this.setMode('levelup');
  }

  private rerollUpgrades():void{
    if(this.mode!=='levelup')return;
    const free=this.phasePlan&&this.freeReroll,cost=this.relicFreeRerolls>0||free?0:10+this.rerolls*10;
    if(this.legion.food<cost)return;
    const old=this.upgradeOptions.map(o=>o.id).sort().join('|');let options=this.upgradeOptions;
    for(let i=0;i<12;i++){options=buildUpgradeOptions(this.player,this.player.weapons,this.player.growth,this.newCardSource());if(options.map(o=>o.id).sort().join('|')!==old)break;}
    if(options.map(o=>o.id).sort().join('|')===old){this.rerollButton?.setText('暂无可换');return;}
    if(this.relicFreeRerolls>0)this.relicFreeRerolls--;else if(free)this.freeReroll=false;else{this.legion.food-=cost;this.rerolls++;}this.upgradeOptions=options;this.renderCards();
  }
  protected renderCards(): void {
    if(this.rerollButton){const free=!!this.phasePlan&&this.freeReroll&&this.relicFreeRerolls<=0,cost=this.relicFreeRerolls>0||free?0:10+this.rerolls*10;this.rerollButton.setText(this.relicFreeRerolls>0?'换一批 · 免费（相国印）':free?'换一批 · 本关免费一次':'换一批 · '+cost+'粮').setAlpha(this.legion.food>=cost?1:.5);if(this.legion.food>=cost)this.rerollButton.setInteractive({useHandCursor:true});else this.rerollButton.disableInteractive();}

    for (let i = 0; i < this.cardViews.length; i += 1) {
      const view = this.cardViews[i];
      const option = this.upgradeOptions[i];
      if (!option) {
        view.bg.setVisible(false);
        view.icon.setVisible(false);
        view.name.setVisible(false);
        view.desc.setVisible(false);
        view.tag.setVisible(false);
        view.rich.setVisible(false); view.scope.setVisible(false);
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
      const plain=option.desc.replace(/Boss/g,'首领');view.desc.setText(plain).setVisible(false);
      view.name.setFontSize(IS_DESKTOP?21:21);
      while(view.name.height>(IS_DESKTOP?50:30)&&parseInt(String(view.name.style.fontSize))>15)view.name.setFontSize(parseInt(String(view.name.style.fontSize))-1);
      // 名称与说明之间的分隔线（带菱形），随名称高度下移。
      const ruleY=view.name.y+view.name.height+(IS_DESKTOP?10:6),rx0=IS_DESKTOP?-view.w/2+30:104-view.w/2,rx1=IS_DESKTOP?view.w/2-30:view.w/2-18,accentLight=0xe0c58a;
      view.rule.clear().lineStyle(1,accentLight,.4).lineBetween(rx0,ruleY,rx1,ruleY).fillStyle(accentLight,.8).fillRect((rx0+rx1)/2-3,ruleY-3,6,6);
      view.desc.setY(ruleY+(IS_DESKTOP?10:7));
      // 说明正文：数字高亮、自己换行；放不下就逐级缩字号（最小 13）
      { const INK=GameScene.INK_LEVELUP,maxH=IS_DESKTOP?view.h-246:view.h-104;let size=IS_DESKTOP?16:17;
        const style=(sz:number)=>({maxW:IS_DESKTOP?view.w-40:view.w-122,size:sz,lineSpacing:IS_DESKTOP?3:5,family:FONT,color:INK?'#33281d':IS_DESKTOP?'#e8d8b2':'#dacfba',hi:INK?'#8a2a1c':'#ffd76a',stroke:INK?'#efe4c9':'#120904',strokeW:IS_DESKTOP?2:0,align:(IS_DESKTOP?'center':'left') as 'center'|'left'});
        let hgt=layoutRich(this,view.rich,plain,style(size));while(hgt>maxH&&size>13){size--;hgt=layoutRich(this,view.rich,plain,style(size));}
        view.rich.setPosition(view.desc.x,view.desc.y).setVisible(true).setData('size',size).setData('h',hgt).setData('maxH',maxH); }
      { const sc=SCOPE_BADGE[cardScope(option)];view.scope.setText(sc.text).setBackgroundColor(sc.bg).setColor(sc.color).setVisible(true); }
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
        spear_orbit:'icon_1',crossbow:'icon_2',flame_banner:'icon_3',guandao:'icon_guandao',zhenbei_blade:'icon_zhenbei',lianhuan_mines:'icon_lianhuan',sun_knives:'icon_sunknives',diaochan_fans:'icon_fans',baodiao_bow:'icon_baodiao',dangyang_roar:'icon_shemao',zhanjin_lance:'icon_zhanjin',shuanggu_swords:'icon_shuanggu',fangtian_ji:'icon_fangtian',pozhen_shuangji:'icon_pozhen',huochuan_ling:'icon_huochuan',donglai_ji:'icon_donglai',yitian_jian:'icon_yitian',jinfan_gou:'icon_lianhuan',shuang_tieji:'icon_zhenbei',guding_dao:'icon_yitian',nanman_dao:'icon_guandao',huoyan_feiqiang:'icon_sunknives',
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
    (this.levelPanel.getByName('upgrade-lock-note') as Phaser.GameObjects.Text|null)?.setVisible(this.upgradeOptions.some(o=>{const sc=cardScope(o);return sc==='run'||sc==='forever';}));
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
      this.upgradeOptions = buildUpgradeOptions(this.player, this.player.weapons, this.player.growth, this.newCardSource()); this.renderCards(); this.batchHint();
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
    const label = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT * .21 + (this.battleTrack?.root.visible ? 8 : 0) + (this.objectiveText?.active && this.objectiveText.visible ? 24 : 0)) // 五段关：计时器 / 关名下移后，横幅也略往下；有关卡目标行（2-3「目标 · 营寨」）时再下移一行，不叠
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
    const W = GAME_WIDTH, H = GAME_HEIGHT, pw = 780, ph = 515, top = (H - ph) / 2, cx = W / 2, lx = cx - 200, rx = cx + 165;
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
    o.keys.setText(hotkeyLabel('back') + ' / P 继续战斗').setPosition(lx, top + ph - 26);
    // 右栏：设置区（2026-11-18 用户「这里设计ui也要优化」）：页签 声音 / 画面 / 战斗 / 剧情，音量滑条、开关拨钮、分段选择；与主页设置共用 ui/SettingsPanel
    const moveRow = (row: Phaser.GameObjects.GameObject[]): void => { for (const x of row.filter(x => x.active)) x.destroy(); };
    moveRow(o.bgmRow); moveRow(o.sfxRow); void rx;
    const ch = (list: readonly string[], labels: Record<string, string>) => list.map(v => ({ v, label: labels[v] })), scale0 = renderScaleSetting();
    const specs: SettingSpec[] = [
      { key: 'music', name: '音乐', tab: 'sound', kind: 'slider', get: () => String(this.music.getVolume()), set: v => this.music.setVolume(Number(v)) },
      { key: 'sfx', name: '音效', tab: 'sound', kind: 'slider', get: () => String(this.sfx.getVolume()), set: v => { this.sfx.setVolume(Number(v)); this.sfx.play('uiClick'); } },
      { key: 'render-scale', name: '画面清晰度', tab: 'view', kind: 'choice', options: ch(['', '1', '2', '3'], SCALE_LABEL), get: () => renderScaleSetting(), set: v => setRenderScaleSetting(v as RenderScaleSetting), note: () => renderScaleSetting() === scale0 ? '' : '刷新后生效' },
      { key: 'outline', name: '敌我描边', tab: 'view', kind: 'choice', options: ch(['off', 'enemy', 'all'], OUTLINE_LABEL), get: () => outlineMode(), set: v => { const m = v as OutlineMode; setOutlineMode(m); if (this.iff) { this.iff.mode.outline = m !== 'off'; this.iff.mode.enemyOnly = m === 'enemy'; } if (m !== 'off') warmIffTextures(this.game); } },
      { key: 'outline-width', name: '描边粗细', tab: 'view', kind: 'choice', options: ch(['thin', 'thick'], WIDTH_LABEL), get: () => outlineWidth(), set: v => { setOutlineWidth(v as OutlineWidth); if (this.iff) this.iff.mode.thick = v === 'thick'; } },
      { key: 'shake', name: '震屏', tab: 'view', kind: 'choice', options: ch(['strong', 'weak', 'off'], SHAKE_LABEL), get: () => shakeLevel(), set: v => { setShakeLevel(v as ShakeLevel); if (v !== 'off') this.cameras.main.shake(140, .004); } },
      { key: 'death-fx', name: '死亡特效', tab: 'view', kind: 'toggle', options: ch(['on', 'off'], DEATHFX_LABEL), get: () => deathFxSetting(), set: v => setDeathFx(v as DeathFxSetting) },
      { key: 'damage', name: '伤害数字', tab: 'battle', kind: 'choice', options: ch(['all', 'crit', 'off'], DAMAGE_LABEL), get: () => damageNumbers(), set: v => setDamageNumbers(v as DamageNumbers) },
      { key: 'orders-panel', name: '军令面板', tab: 'battle', kind: 'toggle', options: ch(['on', 'off'], ORDERS_PANEL_LABEL), get: () => ordersPanelSetting(), set: v => { setOrdersPanelSetting(v as OrdersPanelSetting); this.applyOrdersPanelSetting(); } },
      { key: 'formation-sigil', name: '阵纹', tab: 'battle', kind: 'toggle', options: ch(['on', 'off'], SIGIL_LABEL), get: () => formationSigil(), set: v => setFormationSigil(v as FormationSigil) },
      { key: 'school-hint', name: '合击觉醒提示', tab: 'battle', kind: 'choice', options: ch(['brief', 'full', 'off'], SCHOOL_HINT_LABEL), get: () => schoolHint(), set: v => setSchoolHint(v as SchoolHint) },
      { key: 'hero-barks', name: '武将台词', tab: 'battle', kind: 'toggle', options: ch(['on', 'off'], BARKS_LABEL), get: () => heroBarks(), set: v => { setHeroBarks(v as HeroBarks); if (v === 'off') this.heroBark?.clear(); } },
      { key: 'story', name: '剧情', tab: 'story', kind: 'choice', options: ch(['full', 'chapter', 'off'], STORY_LABEL), get: () => storyMode(), set: v => setStoryMode(v as StoryMode) },
      { key: 'opening', name: '开场动画', tab: 'story', kind: 'choice', options: ch(['every', 'first', 'off'], OPENING_LABEL), get: () => openingMode(), set: v => setOpeningMode(v as OpeningMode) },
    ];
    const sx = cx - 14, sw = cx + pw / 2 - 18 - sx;
    buildSettingsPanel({ scene: this, root: this.pausePanel, x: sx, y: top + 84, w: sw, h: ph - 84 - 60, tabs: [{ id: 'sound', label: '声音' }, { id: 'view', label: '画面' }, { id: 'battle', label: '战斗' }, { id: 'story', label: '剧情' }], settings: specs, memoryKey: 'im_settings_tab', fixed: true, bare: true });
    // 右栏底部：重看新手引导 / 快捷键（漆金次要钮）
    const fy = top + ph - 32, line = this.add.graphics().setScrollFactor(0); line.lineStyle(1, 0xc9a35e, .35).lineBetween(sx + 6, fy - 24, sx + sw - 6, fy - 24); this.pausePanel.add(line);
    const footBtn = (t: Phaser.GameObjects.Text, x: number, w: number): void => { t.setOrigin(.5).setPosition(x, fy).setFontFamily(HEADING_FONT).setFontSize(14).setScrollFactor(0); const sk = lqSkin(this, t, t, () => ({ w, h: 32 }), { tone: 'quiet' }); lqHitBox(t, w, 32); sk.gfx.setScrollFactor(0); this.pausePanel.add([sk.gfx, t]); };
    footBtn(tutorialReplayLink(this, 0, 0), sx + 8 + 80, 160);
    footBtn(hotkeySettingsLink(this, 0, 0, DEPTH.overlay + 40), sx + 8 + 160 + 10 + 48, 96);
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
    if (!mechOpen('squad')) { this.pendingRecruit = false; return; } // 玩法逐章解锁：部曲 1-2 开放（data/mechanicUnlocks.ts）
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
    this.battleHeal?.onPropBroken(kind, x, y, rng); // 粮袋 / 木箱：概率掉干粮 / 酒肉（data/battleHeal）
    if (kind === 'grain') { this.legion.food += L.grain.food; this.showGrowthNotice('缴获粮草 · 随军粮 +' + L.grain.food); return; }
    if (kind !== 'weapons' && kind !== 'armor' && kind !== 'crate' && kind !== 'coins') return;
    const c = L[kind];
    for (let i = 0; i < c.gems; i++) { const a = i / Math.max(1, c.gems) * Math.PI * 2; this.spawnGem(x + Math.cos(a) * 22, y + 8 + Math.sin(a) * 10, 1); }
    if (this.itemDrops && this.propItems < L.perStageItems && rng() < c.itemChance) { const it = rollPropItem(kind, rng, rollPropQuality(rng, this.itemTier()), this.lootChapter()); if (it) { this.propItems++; this.itemDrops.drop(it, x, y + 18); } }
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
    if (this.mode === 'parley' && this.openParley()?.pad(button === PAD.A ? 0 : button === PAD.B ? 1 : button === PAD.X ? 2 : -1)) return true;
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
    this.pauseKeysText?.setText(pad ? PAD_LABEL.START + ' / ' + PAD_LABEL.B + ' 继续战斗' : IS_DESKTOP ? hotkeyLabel('back') + ' / P 继续战斗' : '战斗已冻结 · 点击「继续战斗」恢复');
    this.hudTexts?.pause?.setText(pad ? PAD_LABEL.START + (IS_DESKTOP ? ' 设置' : ' 暂停') : IS_DESKTOP ? '设置' : '暂停');
    // 有敌营 / 粮草可锁定的战场（子类覆写了 padTargets）多提示 RB
    const lockable = this.padTargets !== GameScene.prototype.padTargets;
    this.hintText?.setText(pad ? (lockable ? '左摇杆移动 · RB 锁定敌营 / 粮草 · 自动攻击' : '左摇杆移动 · 自动攻击') : IS_DESKTOP ? 'WASD / 方向键移动 · 自动攻击' : '自动攻击 · 拖动摇杆移动');
    this.legionUI?.setKeyHint(pad ? PAD_LABEL.Y : IS_DESKTOP ? hotkeyLabel('order') : '⇄');
    for (const [i, v] of (this.cardViews ?? []).entries()) v.hint.setText(pad ? PAD_LABEL.A + ' 选择' : IS_DESKTOP ? '按 ' + hotkeyLabel((['pick1', 'pick2', 'pick3'] as const)[i] ?? 'pick1') + ' 选择' : '点击选择');
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
    if(this.persuadeKill){this.persuadeKill=false;this.time.delayedCall(this.dual?.entries.every(x=>x.done==='persuaded')?1800:500,done);return;} /* 双降：横幅多亮一会儿再结算 */ // 劝降成功：算击败首领，但不掉首领宝箱（spec §6）
    // 落点避开尸体（画风会话量的躺倒身体范围）：倒地 4 帧往朝向前方偏 80，其余往下偏 30
    const ox=this.bossFallDir*80,oy=30;
    // 落点压在城墙 / 障碍里时（首领倒在墙边），沿着往主将的方向挪到第一个空地，免得宝箱捡不到、关卡结不了
    let cx=x+ox,cy=y+oy;{const clear=(px:number,py:number)=>!this.supplies||this.supplies.envClear(px,py,44);if(!clear(cx,cy)){const px=this.player.x,py=this.player.y;for(let k=1;k<=12;k++){const t=k/12,tx=cx+(px-cx)*t,ty=cy+(py-cy)*t;if(clear(tx,ty)){cx=tx;cy=ty;break;}if(k===12){cx=px;cy=py+30;}}}}
    this.bossChests.push(new BossChest({scene:this,player:this.player,grant:()=>this.grantBossChest(),done,sfx:k=>this.sfx.play(k)},cx,cy,this.combatNow));
  }
  /** 宝箱里只有首领遗珍（用户 2026-11-17「首领宝箱只给首领遗珍」；道具系统发放，见 ItemDrops.claimBossRelic）。 */
  protected grantBossChest():ChestLoot[]{
    if(this.phasePlan)this.chestPick=true; // 首领宝箱那次三选一固定一张信物（wave-progression-redesign §4.5）
    const out:ChestLoot[]=[];
    if(this.dual){const keep=this.parley;for(const x of this.dual.entries)if(x.done==='killed'&&x.parley&&x.parley!==keep){this.parley=x.parley;this.parleyExecuteRewards(out);}this.parley=keep;
      const item=this.itemDrops?.rollBossItem()??rollItem('blue');addItems([item]);out.push({name:itemName(item),desc:'双将宝箱 · 额外兵装 · 已入行囊',tag:'双将'});}
    this.parleyExecuteRewards(out);
    this.ensurePicks(this.campaignReplay?PICK_GUARANTEE.side:this.pickCap(),true);
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
      if (/^(首次通关|随行|获得坐骑|乱世首通|屯田供粮|城池产出|流寇未平|成都归入|速攻破城|撤军收场|城内要点 |城池尚在)/.test(l)) notes.push(t);
      else if (/^营寨 · 农田 \+\d+ · /.test(l)) { const rest = t.replace(/^营寨 · 农田 \+\d+ · /, ''); if (rest !== '口粮 −0') notes.push('营寨 · ' + rest); }
      else if (/^缴获兵装/.test(l) && /测试战斗不入行囊|败退遗失/.test(l)) notes.push('兵装' + (l.match(/· (测试战斗不入行囊|败退遗失 \d+ 件)/)?.[1] ?? ''));
    }
    if (hero?.capped) notes.push('武将已到本章等级上限 Lv.' + hero.to);
    const noteText = this.resultPanel.getByName('result-notes') as Phaser.GameObjects.Text;
    noteText.setText(notes.length > 3 ? [notes.slice(0, 2).join(' · '), notes.slice(2).join(' · ')].join('\n') : notes.join('\n')).setVisible(notes.length > 0);
    const stats = this.resultPanel.getByName('result-stats') as Phaser.GameObjects.Text;
    stats.setText(['击杀 ' + this.kills, '用时 ' + this.formatTime(this.elapsed), '伤害 ' + wan(this.damageDealt), '部曲 ' + this.legion.count + ' 存活' + (this.legion.dead ? ' / ' + this.legion.dead + ' 阵亡' : '')].join('　·　')).setVisible(true);
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
  /**
   * 首领宝箱补发的三选一（grantBossChest → ensurePicks force）先选完再往下走（2026-11-20 夜间回归：三选一原来盖在章末卷轴上）。
   * 战斗模式回到 none 且没有待选时调 go；有待选就立刻开三选一（开不出来——例如没有可选项——就不等）。场景关闭时撤掉监听。
   */
  protected afterPendingPicks(go:()=>void):void{
    const ready=():boolean=>{if(this.over||!this.sys.isActive())return true;if(this.mode!=='none')return false;if(this.pendingLevels>0){this.forcePickNow=true;this.openUpgrade();return this.mode==='none';}return true;};
    if(ready()){if(this.sys.isActive())go();return;}
    const off=():void=>{this.events.off('postupdate',poll);this.events.off('shutdown',off);};
    const poll=():void=>{if(!ready())return;off();if(this.sys.isActive())go();};
    this.events.on('postupdate',poll);this.events.once('shutdown',off);
  }
  /**
   * 篇章章末卷轴（第 6 / 8 / 10 / 12 章等，宝箱后、结算前）：先选完宝箱补发的三选一，再以剧情暂停播卷轴（计入 storyHolds，期间三选一 / 招募收起回到剧情）。
   * 原来各篇借 setMode('parley') 暂停（劝降窗其实没开，手柄 / 测试按劝降处理）。open 里建卷轴，卷轴收起时调 close()，再走下一步。
   */
  endScroll(open:(close:()=>void)=>void):void{
    this.afterPendingPicks(()=>{
      if(this.over){open(()=>{});return;}
      this.storyHolds++;this.setMode('story');let closed=false;
      open(()=>{if(closed)return;closed=true;this.storyHolds=Math.max(0,this.storyHolds-1);if(!this.over)this.setMode('none');});
    });
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
    this.ensurePicks(this.campaignReplay?PICK_GUARANTEE.side:this.pickCap(),true);this.picksGiven=0;this.lastPickAt=-1e9;this.frontlineStarts.set(next,this.combatNow);this.setupObjective();this.elapsed=0;this.waveIndex=0;this.boss=null;this.bossSpawned=false;this.bossWarned=false;this.bossKilled=false;this.firstBossAt=-1;this.bossShield=0;this.bossPhase2=false;this.bossEnergy=0;this.recruitedWaves.clear();this.spawnTimer=.2;this.huaxiong=null;this.xurong=null;this.zhangjiao?.clear();this.zhangjiao=null;
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

  /** 掉落按的章节（1–12）：章节场景按场景；攻城、军情、挑战关等不属于某章的，按已开放的章节数（2026-11-19 掉落品质随章节，data/items.ts lootBand）。 */
  protected lootChapter(): number {
    const key = this.scene.key, arc = (this.runConfig as { arc?: string }).arc;
    const byKey: Record<string, number> = { ThirdGameScene: 3, GuanduGameScene: 4, ChibiGameScene: 5, JingnanGameScene: 6, ShuGameScene: 7, HanzhongGameScene: 8, XiangfanGameScene: 9, YilingGameScene: 10, NanzhengGameScene: 11, BeifaGameScene: 12 };
    if (arc === 'chibi') return 5;
    if (byKey[key]) return byKey[key];
    if (key === 'GameScene' && !this.runConfig.encounter && !this.customChapter()) return this.chapter.id === 'hulao' ? 2 : 1;
    return chaptersOpen();
  }
  /** 道具掉落的品质段（0 一、二章 … 4 十一、十二章；乱世 +1）：品质表与封顶见 data/items.ts。也用于开局免费招兵数。 */
  protected itemTier(): number { return lootBand(this.lootChapter(), this.hardMode); }
  /** 马厩赠马用的关卡键（见 data/mounts.ts HORSES.reward）；章节场景覆盖，攻城 / 军情为空。 */
  /** 只读继承征程构筑（攻城 / 守城 / 军情 / 支线攻城关覆盖为 true）：开打时读存档里的征程构筑，打完不写回。 */
  protected inheritsCampaign(): boolean { return false; }
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
    g.attrMax = attributeCap(this.heroLv); g.heroLevel = this.heroLv;
    for (const a of Object.keys(g.attributes) as AttributeId[]) g.attributes[a] = Math.min(g.attrMax, r.attributes[a] + Math.max(0, (carried ? g.attributes[a] : 0) - r.attributes[a]));
    g.heroFree = heroFreePoints(id);
    const room = (Object.values(g.attributes) as number[]).reduce((n, v) => n + g.attrMax - v, 0);
    g.unallocated = Math.min(room, g.heroFree + (carried ? bonusLeft : 0));
    // 武将谱：本命淬炼、战法心得（新开一场时开局第一次升级保证出一张心得卡）
    g.temperDamage = temperBonus(id); g.xinde = getXinde(id); if (!carried) g.xindeFirst = g.xinde.length > 0;
    this.player.passive.areaMul = g.areaMultiplier();
    // 属性改版（四项）：老存档的点数已全部退回，提示一次
    if (takeAttrNotice()) this.time.delayedCall(1200, () => this.showGrowthNotice('属性已改版（武将自带四维）：点数已全部返还，暂停 →「分配属性点」重新分配'));
    this.player.hp = carried ? Math.max(1, Math.min(this.player.maxHp, Math.round(this.player.maxHp * ratio))) : this.player.maxHp;
  }
  /** 经验倍率（2026-11-17 只留武将等级）：主线首次打 1.0；攻城 / 军情 / 挑战 / 重打旧关 0.5。 */
  protected heroXpRate(): number { const main = (!!this.phasePlan || ['GameScene', 'ThirdGameScene', 'GuanduGameScene', 'ChibiGameScene'].includes(this.scene.key)) && !(this.scene.key === 'GameScene' && this.runConfig.encounter) && !this.campaignReplay; return (main ? HERO_XP_RATE.main : HERO_XP_RATE.side) * chapterXpMul(CHAPTER_INDEX[this.hardKey()] ?? 1) * XP_SHIFT.gem; } // 2026-11-20：一部分过关经验挪进关内（XP_SHIFT） // 2026-11-19：宝石经验按章节放大；第六～十二章主线（五段关）也按主线算
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
    const info = heroInfo(this.runConfig.character), full = this.player.hp >= this.player.maxHp - 1e-6; // 体魄生命随等级：开局满血的话按新上限补满（带伤继承在之后的 applyCarriedHp 处理）
    this.player.level = info.level; this.player.xp = info.xp; this.player.xpNext = info.next; this.heroLv = info.level; this.heroStartLevel = info.level; if (full) this.player.hp = this.player.maxHp;
    this.refreshSoftLevel();
  }
  /** 本关建议等级（软上限起点）：主线按章 / 关（HeroProgress.suggestedLevel），其余（攻城 / 军情 / 支线 / 挑战）按本章建议等级。 */
  stageSuggestedLevel(): number { const ch = CHAPTER_INDEX[this.hardKey()]; return ch ? suggestedLevel(ch, this.hardStage()) : levelCap(); }
  /** 换关 / 开局时重算软上限与本级所需经验（经验条比例跟着变）。 */
  protected refreshSoftLevel(): void { if (!this.player) return; const soft = this.stageSuggestedLevel(); if (soft === this.player.softLevel) return; this.player.softLevel = soft; this.player.xpNext = this.player.needFor(this.player.level); }
  /** 战斗中武将升级：每级一次三选一并给 1 个属性点（正式战斗立刻写入存档）。 */
  protected onHeroLevelUp(gained: number): void {
    const g = this.player.growth, id = this.runConfig.character;
    const fromLv = this.heroLv, pts = attributePointsBetween(fromLv, this.player.level); // 2026-11-19：Lv25 后每 2–3 级才给 1 点（三选一照给）
    this.heroLv = this.player.level; this.picksGiven += gained; this.pendingLevels += gained; g.attrMax = attributeCap(this.player.level); g.heroLevel = this.player.level;
    this.player.heal(vigorHp(this.player.level) - vigorHp(fromLv)); // 体魄：升级多出的生命上限直接补满这一截
    const room = (Object.values(g.attributes) as number[]).reduce((n, v) => n + g.attrMax - v, 0) - g.unallocated;
    if (!this.debugRun()) { setHeroProgress(id, this.player.level, this.player.xp); g.heroFree += pts; }
    g.unallocated += Math.max(0, Math.min(pts, room));
    if (this.mode === 'none' && this.pickGapOk()) this.openUpgrade();
  }
  /** 本关保底：三选一次数不够 target 时补「军略」（同一个三选一，不给属性点）。 */
  /** 主线每关保底次数：五段关 = 段数（3 / 4 / 5），其余照旧。 */
  protected pickCap(): number { return this.phasePlan ? this.phasePlan.phases.length : PICK_GUARANTEE.main; }
  /** 进第 2…n 段时至少补到的次数（五段关 1 / 2 / 3 / 4，首领宝箱补到 pickCap）。 */
  protected pickWaves(): readonly number[] { return this.phasePlan ? PHASES.picks.waves.slice(0, this.phasePlan.phases.length - 1) : this.paceOn() ? PICK_PACE.waves : PICK_GUARANTEE.waves; }
  private phaseCaption(k: PhaseKind): string { return k === 'vanguard' ? '先锋' : k === 'elite' ? '精锐来袭' : k === 'event' ? '伏兵四起' : k === 'lieutenant' ? '副将出阵' : k === 'surge' ? '大军压境' : '首领将至'; }
  /** 主线关才套用五段：攻城 / 守城 / 军情 / 挑战、带关卡目标的关、开场即首领的关不套。 */
  protected phaseEligible(): boolean {
    const c = this.chapter, k = this.scene.key;
    if (/Siege|Intel|Lubu|Dev/.test(k) || c.bossAtStart || c.objective || !c.waves?.length) return false;
    if (this.runConfig.encounter === 'sishui' || this.runConfig.encounter === 'xingyang') return false;
    return CHAPTER_INDEX[this.hardKey()] !== undefined;
  }
  /** 每帧检查：本关的 chapter 换了（开局、子类换关、战线推进）就重排段落。 */
  private applyPhases(): void {
    if (this.chapter === this.phasedFor) return;
    this.phaseRunner?.clear(); this.battleTrack?.destroy(); this.phaseRunner = null; this.battleTrack = null; this.phasePlan = null;
    // 换关（战线推进 / 子类换关）：上一关的机缘事件与本关增益一并撤掉
    this.fortunes?.clear(); this.fortunes = null; this.fortuneQueue = []; this.fortuneTaken = {}; if (this.player) clearStageBuffs(this.player); this.resetStageCards();
    if (this.phaseEligible()) {
      const base = this.chapter, plan = buildPhasePlan(this.hardKey(), this.hardStage(), base.waves, base.bossName), g = base.growth;
      this.chapter = { ...base, waves: plan.waves, pace: phasedPace(base.pace, chapterBossTime(base), plan.bossAt), growth: { hp: g?.hp ?? 1, damage: g?.damage ?? 1, bossHp: (g?.bossHp ?? 1) * PHASES.bossHpMul(plan.chapter, plan.phases.length) } };
      this.phasePlan = plan;
      BuildState.rankCap = BuildState.rankCapFor(plan.chapter); BuildState.slotCap = BuildState.slotCapFor(plan.chapter); RunGrowth.extraCap = RunGrowth.extraCapFor(plan.chapter); WEAPON_OVER.cap = WEAPON_OVER.capFor(plan.chapter); // 永久成长分章：精研 Lv4 / 5、第 7 格、武艺精熟
      const hard = (n: number) => this.hardMode ? n : 1;
      this.phaseRunner = new StagePhaseRunner({
        scene: this, player: () => this.player, elapsed: () => this.elapsed,
        spawn: (kind, x, y, def) => this.spawnEnemy(kind, x, y, def ? 1 : this.chapter.hpScale(this.elapsed), true, def),
        def: kind => this.chapter.enemies[kind],
        // 副将夹血用的「参考首领生命」：去掉五段的章节加倍（bossHpMul），换成固定 bossRef（data/stagePhases.ts lieutenantHp）
        bossHp: () => this.chapter.enemies.boss.hp * (this.chapter.growth?.bossHp ?? 1) / PHASES.bossHpMul(plan.chapter, plan.phases.length) * PHASES.lieutenantHp.bossRef * hard(HARD_MODE.bossHp),
        growthHp: () => (this.chapter.growth?.hp ?? 1) * hard(HARD_MODE.enemyHp),
        banner: (t, d, c) => this.showWaveBanner(t, d, c), sfx: k => this.sfx.play(k),
        onLieutenantDown: (name, x, y) => {
          this.showWaveBanner(name + ' 授首', false, '副将倒下 · 军略 +1'); this.sfx.play('gong');
          for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; this.spawnGem(x + Math.cos(a) * 26, y + Math.sin(a) * 16, 4); }
          if (this.phasePlan) this.ensurePicks(this.phasePlan.phases.length - 1);
          this.battleHeal?.onLieutenantDown(x, y); // 副将必掉一份军中伤药
          this.bountyLieutenant();
        },
      }, plan);
      this.battleTrack = new BattleTrack(this, plan);
      // 战况线贴着屏幕上沿：计时器、关名往下挪一截（不和战况线叠）
      this.hudTexts.timer.setY(BattleTrack.HEIGHT + 3); this.hudTexts.chapter.setY(BattleTrack.HEIGHT + 33);
      this.fortunes = !mechOpen('fortune') || plan.chapter === 1 ? null : new BattleFortunes({ // 玩法逐章解锁：战场机缘 2-1 开放；第一章（v2）一律没有机缘
        scene: this, player: () => this.player, elapsed: () => this.elapsed, chapter: () => plan.chapter,
        // 远处刷点：夹进场地、挪出墙 / 营栅 / 房子，再避开水与树（2026-11-19 用户「不可以太近……不刷进墙里」）
        place: (x, y) => this.fieldPlace(x, y),
        spawn: (kind, x, y) => this.spawnEnemy(kind, x, y, this.chapter.hpScale(this.elapsed), true),
        officerTexture: () => this.chapter.enemies.elite.walkVisual?.texture ?? 'enemy_officer_walk_sheet',
        riderTexture: () => this.chapter.enemies.cavalry.walkVisual?.texture ?? 'enemy_cavalry_walk_sheet',
        banner: (t, d, c) => this.showWaveBanner(t, d, c), sfx: k => this.sfx.play(k),
        reward: (k, mult, x, y) => this.fortuneReward(k, mult, x, y),
        // 降将来投（systems/FortuneDefector.ts）：副将一档的试阵对手、跪降后撤下、本关临时随从、左下角对话卡
        duelist: (x, y) => this.phaseRunner?.spawnLieutenant(x, y) ?? this.spawnEnemy('elite', x, y, this.chapter.hpScale(this.elapsed), true),
        troopTexture: () => this.chapter.enemies.infantry.walkVisual?.texture ?? 'enemy_infantry_walk_sheet',
        now: () => this.combatNow,
        retire: e => { e.invulnerable = false; e.hp = 0; this.persuadeKill = true; this.killEnemy(e); this.persuadeKill = false; },
        joinAlly: (d, x, y) => this.joinDefector(d, x, y),
        card: (name, text) => { if (storyMode() !== 'off') showBarkCard(this, { side: 'left', name, text }); },
        overlay: () => this.mode !== 'none' || this.over,
      }, plan);
      this.hudTexts.wave.setVisible(false);
    } else { this.hudTexts.wave.setVisible(true); this.hudTexts.timer.setY(22); this.hudTexts.chapter.setY(56); }
    this.battleHeal?.setPlan(this.phasePlan);
    this.phasedFor = this.chapter;
  }
  /** 新卡池（五段主线关才有）：战法位按章节概率换新卡（systems/LevelCards）。 */
  private newCardSource(): NewCardSource | undefined {
    const plan = this.phasePlan; if (!plan) return undefined;
    const b = this.player.growth.build;
    return { replaceChance: NEW_CARDS.replaceChance(plan.chapter), draw: n => drawNewCards({
      chapter: plan.chapter, taken: this.fortuneTaken,
      applyBuff: f => { applyStageBuff(this.player, s => f.apply(s, this.player.maxHp)); if (f.now === 'heal15') this.player.heal(Math.round(this.player.maxHp * .15)); this.fortuneTaken[f.id] = (this.fortuneTaken[f.id] ?? 0) + 1; },
      momentum: () => this.momentum.on, startMomentum: () => { this.momentum.on = true; },
      jinnangHeld: () => !!this.jinnang, giveJinnang: id => { this.jinnang = id; this.paintJinnang(); },
      general: (name, n, ms) => this.generalJoins(name, n, ms),
      gambleTaken: id => this.gambles.has(id), gamble: id => this.takeGamble(id),
      bountyOpen: id => this.bountyOpen(id), bounty: id => { this.bounties[id] = id === 'elites' ? { elites: 0 } : {}; this.showWaveBanner(BOUNTIES[id].name, false, '已接下 · ' + BOUNTIES[id].desc.split(String.fromCharCode(10))[0]); },
      escort: (k, ms) => { this.reinforcePush().spawnEscortAt(this.player.x, this.player.y, k, ms); },
      addGrain: g => { this.legion.food += g; }, healFrac: f => this.player.heal(Math.round(this.player.maxHp * f)),
      manualSchools: () => SCHOOL_IDS.filter(s => b.canManual(s) && b.sources(s).tactics > 0), readManual: s => { if (b.canManual(s)) b.manuals.push(s); },
    }, n) };
  }
  /** 锦囊钮（右侧圆钮列，用药钮上方）：身上有锦囊才显示。 */
  private paintJinnang(): void {
    const id = this.jinnang;
    if (!this.jinnangButton) {
      const root = this.add.container(GAME_WIDTH - 58, IS_DESKTOP ? GAME_HEIGHT - 368 : GAME_HEIGHT - 420).setScrollFactor(0).setDepth(DEPTH.hud + 4).setName('jinnang-button').setVisible(false);
      const glow = this.add.circle(0, 0, 33, 0xf0c060, 0).setStrokeStyle(3, 0xf3d48a, .55);
      const disc = this.add.circle(0, 0, 29, 0x1b120b, .95).setStrokeStyle(2.5, 0xc9a35e, 1);
      const icon = this.add.image(0, -1, 'icon_passive').setName('jinnang-icon');
      const caption = this.add.text(0, 40, '锦囊', { fontFamily: FONT, fontSize: '13px', color: '#ffe2a4', resolution: 2, stroke: '#17140d', strokeThickness: 3 }).setOrigin(.5).setName('jinnang-caption');
      const key = this.add.text(24, -26, 'R', { fontFamily: FONT, fontSize: '11px', color: '#f3d48a', resolution: 2, stroke: '#17140d', strokeThickness: 3 }).setOrigin(.5);
      root.add([glow, disc, icon, caption, key]);
      root.setInteractive(new Phaser.Geom.Circle(0, 0, 34), Phaser.Geom.Circle.Contains).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation?.(); this.useJinnang(); });
      if (root.input) root.input.cursor = 'pointer';
      this.tweens.add({ targets: glow, scale: 1.18, alpha: { from: .9, to: .15 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.jinnangButton = root;
    }
    if (id) {
      const icon = this.jinnangButton.getByName('jinnang-icon') as Phaser.GameObjects.Image, key = JINNANG[id].icon;
      if (this.textures.exists(key)) icon.setTexture(key); icon.setDisplaySize(40, 40);
      (this.jinnangButton.getByName('jinnang-caption') as Phaser.GameObjects.Text).setText('锦囊 · ' + JINNANG[id].name);
    }
    this.jinnangButton.setVisible(!!id && this.mode === 'none' && !this.over);
  }
  /** 兵器专职：本命 Lv6 / 7 的伤害加成写进 growth；选了分支就建分支效果（换了主将对象则重建）。 */
  private tickBranch(): void {
    const P = this.player; if (!P?.growth) return; const w = P.weapons[0];
    P.growth.weaponOver = w?.over ?? 0;
    if (!w?.branch) { if (this.branchRt) { this.branchRt.clear(); this.branchRt = null; } return; }
    if (!this.branchRt || this.branchFor !== P) {
      this.branchRt?.clear(); this.branchFor = P;
      this.branchRt = new WeaponBranches({
        hitStop: ms => { this.hitFeel.hitStop(ms); },
        blocked: (x, y, r) => !!this.supplies?.healBlocked?.(x, y, r) || this.grid.query(x, y, r + 80).some(w => w.active && w.def.behavior === 'wall' && Math.hypot(w.x - x, w.y - y) < w.radius + r), // 七进七出锚点不进障碍 / 城墙 / 场地外
        scene: this, player: P, now: () => this.combatNow, weapon: () => this.player.weapons[0], hit: () => this.weaponHit(),
        query: (x, y, r) => this.grid.query(x, y, r), damage: (e, n, fire) => { this.hitEnemy(e, n, this.combatNow, fire ? 'fire' : 'melee', false, false); },
        shi: s => this.player.growth.build.tags()[s] ?? 0, allies: () => this.allies,
        troopBoost: (mul, ms) => { this.legion.drillMultiplier *= mul; this.time.delayedCall(ms, () => { this.legion.drillMultiplier /= mul; }); },
        escort: (x, y, n, ms) => { this.reinforcePush().spawnEscortAt(x, y, n, ms); buildVfx(this).emit('reinforce', x, y - 8, this.combatNow, 150, 0, 800, true); },
        slow: (x, y, r, sl, ms) => { this.controlBuild?.slowArea(x, y, r, sl, ms, this.combatNow); },
        followerHeroes: () => (this.followers?.members ?? []).map(m => m.recruit.hero).filter((h): h is NonNullable<typeof h> => !!h),
        banner: (t, sub) => this.showWaveBanner(t, false, sub), sfx: k => this.sfx.play(k),
        onFinal: b => this.branchFinalShow(b),
      });
    }
    if (this.mode === 'none' && !this.over) this.branchRt.update();
  }
  /** 本命武器一击的基础伤害（锦囊火计 / 草船借箭按它算）。 */
  private weaponHit(): number { const w = this.player.weapons[0], d = w ? WEAPON_DEFS[w.id] : undefined; return (d ? d.damage(w!.level, this.player.stats) : 20) * this.player.growth.damageMultiplier(this.combatNow); }
  private resetStageCards(): void {
    this.momentum = { on: false, kills: 0, stacks: 0 }; this.gambles = new Set(); this.bounties = {}; this.chain = { until: 0, set: new Map(), sharing: false };
    this.arrows = { until: 0, absorbed: 0 }; this.chestPick = false; this.freeReroll = true; if (this.player?.growth) this.player.growth.stageDesperate = 0;
  }
  /** 名将来投：一队义军 + 领头的名将名牌（本关）。 */
  private generalJoins(name: string, n: number, ms: number): void {
    const sq = this.reinforcePush().spawnEscortAt(this.player.x, this.player.y, n, ms); if (!sq) return;
    buildVfx(this).emit('reinforce', this.player.x, this.player.y - 8, this.combatNow, 160, 0, 800, true);
    const tag = this.add.text(this.player.x, this.player.y, '来投 · ' + name, { fontFamily: FONT, fontSize: '13px', color: '#bfe8ff', resolution: 2, stroke: '#0c1a26', strokeThickness: 4 }).setOrigin(.5, 1).setDepth(DEPTH.dmgText - 1).setName('general-tag');
    const until = this.combatNow + ms, follow = () => { const lead = sq.members.find(m => !m.dead); if (!lead || this.combatNow > until || !tag.active) { tag.destroy(); this.events.off('update', follow); return; } tag.setPosition(lead.x, lead.y - 58); };
    this.events.on('update', follow); this.events.once('shutdown', () => { this.events.off('update', follow); });
    this.showWaveBanner('名将来投 · ' + name, false, '率部随你冲阵 ' + Math.round(ms / 1000) + ' 秒');
  }
  private takeGamble(id: GambleId): void {
    this.gambles.add(id); const P = this.player;
    if (id === 'allin') applyStageBuff(P, s => { s.maxHpBonus -= Math.round(P.maxHp * .15); s.damageMul *= 1.25; });
    else if (id === 'beiwei') P.growth.stageDesperate = .2; // 2026-11-19 平衡：.3 → .2（另两张赌命都有代价，这张没有，还和合击「背水一战」叠）
    else applyStageBuff(P, s => { s.damageTakenMul *= 1.15; s.moveMul *= 1.2; s.cooldownMul *= .9; });
    P.hp = Math.min(P.hp, P.maxHp); buildVfx(this).emit(id === 'allin' ? 'heavy' : id === 'beiwei' ? 'bulwark' : 'skirmish', P.x, P.y - 10, this.combatNow, 150, 0, 700, true); this.showWaveBanner('赌命 · ' + GAMBLES[id].name, true, GAMBLES[id].desc.split(String.fromCharCode(10)).join('，'));
  }
  private bountyOpen(id: BountyId): boolean {
    if (this.bounties[id]) return false;
    if (id === 'elites') return true;
    const plan = this.phasePlan, li = plan ? plan.phases.findIndex(p => p.kind === 'lieutenant') : -1;
    return li >= 0 && this.waveIndex < li;
  }
  private grantCharm(): string {
    // 品质按掉落段的首领那一行（2026-11-19 平衡：原来第九章起悬赏必橙，比首领掉落还好；data/items.ts lootBand / LOOT_CAP）
    const ch = this.phasePlan?.chapter ?? this.lootChapter(), q = rollQuality('boss', this.itemTier()), item = rollCharm(q, Math.random, undefined, ch) ?? rollItem(q, Math.random, 'token', ch);
    if (!item) return ''; if (!this.debugRun()) addItems([item]); const name = itemName(item); buildVfx(this).emit('combo', this.player.x, this.player.y - 10, this.combatNow, 130, 0, 700, true); this.showWaveBanner('信物 · ' + name, false, '已入行囊'); return name;
  }
  private onStageCardKill(enemy: Enemy): void {
    const m = this.momentum, M = NEW_CARDS.momentum;
    if (m.on && m.stacks < M.max && ++m.kills % M.per === 0) { m.stacks++; applyStageBuff(this.player, s => { s.damageMul *= 1 + M.step; }); }
    const b = this.bounties.elites;
    if (b && b.elites !== undefined && enemy.kind === 'elite' && ++b.elites >= 8) { b.elites = undefined; this.legion.food += 60; this.grantCharm(); this.showWaveBanner('悬赏 · 破锐 达成', false, '随军粮 +60 · 信物一件'); }
  }
  /** 每帧：草船借箭到期放箭雨；悬赏斩将计时。 */
  private tickStageCards(): void {
    const now = this.combatNow, P = this.player;
    if (this.arrows.until && now >= this.arrows.until) {
      const n = 12, per = this.weaponHit() * 1.5 + this.arrows.absorbed * 2 / n; this.arrows.until = 0;
      const targets = this.grid.query(P.x, P.y, 420).filter(e => e.active && !e.isSupplySlot).slice(0, n);
      for (const e of targets) this.hitEnemy(e, per, now, 'arrow', false, false);
      this.showWaveBanner('草船借箭 · 箭雨', false, '还敌 ' + targets.length + ' 箭');
    }
  }
  /** 悬赏「斩将」：副将出阵后 30 秒内斩之 → 再来一次军略三选一（由 onLieutenantDown 调）。 */
  private bountyLieutenant(): void {
    if (!this.bounties.lieutenant || !this.phaseRunner) return; this.bounties.lieutenant = undefined;
    const at = this.phaseRunner.stats.lieutenantAt; if (at < 0 || this.elapsed - at > 30) { this.showWaveBanner('悬赏 · 斩将 未达成', false, '超过 30 秒'); return; }
    buildVfx(this).emit('peerless', this.player.x, this.player.y - 10, this.combatNow, 150, 0, 800, true); this.pendingLevels += 1; this.militaryPending += 1; this.showWaveBanner('悬赏 · 斩将 达成', false, '再来一次军略三选一');
    if (this.mode === 'none') this.openUpgrade();
  }
  /** 使用锦囊（R 键 / 锦囊钮）。 */
  protected useJinnang(): boolean {
    const id = this.jinnang; if (!id || this.mode !== 'none' || this.over || !this.player?.alive) return false;
    const P = this.player, now = this.combatNow;
    if (id === 'ambush') this.reinforcePush().spawnEscortAt(P.x, P.y, 6, 20000);
    else if (id === 'gong') { this.gemMagnetUntil = now + 2500; P.heal(Math.round(P.maxHp * .2)); }
    else if (id === 'feint') this.controlBuild?.slowArea(P.x, P.y, 260, .6, 5000, now);
    else if (id === 'drum') P.growth.berserkUntil = Math.max(P.growth.berserkUntil, now) + 10000;
    else if (id === 'fire') { const hit = this.weaponHit() * 4; for (const e of this.grid.query(P.x, P.y, 220)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - P.x, e.y - P.y) <= 220) this.hitEnemy(e, hit, now, 'fire', false, false); if (!this.jinnangFx?.has('fx_jn2')) this.artEffects.show(5, P.x, P.y - 10, 220, now, 700); }
    else if (id === 'empty') P.invulnUntil = Math.max(P.invulnUntil, now + 2500);
    else if (id === 'arrows') { this.arrows = { until: now + 6000, absorbed: 0 }; const prev = P.damageGuard; P.damageGuard = (n, t) => { const m = prev ? prev(n, t) : n; if (t < this.arrows.until) { this.arrows.absorbed += m * .5; return m * .5; } return m; }; }
    else { this.chain.set.clear(); const near = this.grid.query(P.x, P.y, 260).filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss').sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y)).slice(0, 8); for (const e of near) this.chain.set.set(e, e.spawnId); this.chain.until = now + 8000; }
    this.jinnangFx?.cast(id, P.x, P.y, now);   // 手绘激活特效（伏兵 / 鸣金 / 疑兵 / 擂鼓 / 火计 / 空城计 / 草船借箭 / 连环计）
    this.jinnang = null; this.jinnangButton?.setVisible(false);
    this.showWaveBanner('锦囊 · ' + JINNANG[id].name, false, JINNANG[id].desc.split('\n')[0]); this.sfx.play('gong');
    return true;
  }
  /** 机缘降将归附：本关临时随从（随行系统；没有随行时现建一支），名牌「降将 · 名字」。不进人才库。 */
  private joinDefector(d: DefectorInfo, x: number, y: number): Follower | null {
    if (!this.followers) { this.followers = new FollowerSquad(this, this.player, [], (qx, qy, r) => this.grid.query(qx, qy, r), (e, dmg, fire) => this.hitEnemy(e, dmg, this.combatNow, fire ? 'fire' : 'melee', true, false), () => this.player.growth.damageMultiplier(this.combatNow)); this.followers.onHitFx = (e, k, fx, fy) => this.followerTemplateHitFx(e, k, fx, fy); this.followers.attackSound = t => this.sfx.play(FOLLOWER_ATTACK_SFX[t]); this.wireFollowerObstacles(this.followers); }
    const r: Recruit = { id: 'fortune_defector_' + this.combatNow, kind: 'named', name: d.name, template: d.template, quality: 'purple', rank: 0, picks: [] };
    const f = this.followers.addTemp(r, x, y); f.label.setText('降将 · ' + d.name); return f;
  }
  /** 进阶形态达成（Lv7 + 本派 4 势）：武器光芒（BranchFinalFx 手绘爆发 + 本派觉醒光）、分支名大字、全屏一震（HitFeel 震屏自带节流）。 */
  protected branchFinalShow(b: WeaponBranch): void {
    const P = this.player;
    this.branchRt?.finalFx.burst(b.id, P.x, P.y, 0);
    playSheet(this, 'fx_awaken_' + b.school, P.x, P.y - 20, { size: 340, ms: 1100, depth: DEPTH.fx, add: true });
    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * .36, b.finalName, { fontFamily: HEADING_FONT, fontSize: '46px', color: '#ffe08a', stroke: '#2a1206', strokeThickness: 7, resolution: 2 }).setOrigin(.5).setScrollFactor(0).setDepth(DEPTH.overlay - 2).setName('branch-final-title').setScale(1.4).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut', onComplete: () => this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 500, onComplete: () => t.destroy() }) });
    this.hitFeel.shake('medium'); this.sfx.play('promote');
  }
  /** 2-3 营寨守将（data/dongzhuo.ts LUOYANG.commander）：借副将的生成与名牌（第二章副将专属形象、按第 3 关换色），编进正南大营守军。 */
  luoyangLt: StagePhaseRunner | null = null;
  private spawnLuoyangCommander(lc: LuoyangCamps): void {
    const C = LUOYANG.commander, camp = lc.camps[C.camp]; if (!camp) return;
    this.luoyangLt?.clear();
    const plan = { chapter: 2, stage: 3, phases: [], waves: [], bossAt: 0 };
    const r = this.luoyangLt = new StagePhaseRunner({
      scene: this, player: () => this.player, elapsed: () => this.elapsed,
      spawn: (kind, x, y, def) => this.spawnEnemy(kind, x, y, 1, true, def), def: kind => this.chapter.enemies[kind],
      bossHp: () => this.chapter.enemies.boss.hp * (this.chapter.growth?.bossHp ?? 1) * PHASES.lieutenantHp.bossRef,
      growthHp: () => this.chapter.growth?.hp ?? 1,
      banner: (t, d, c) => this.showWaveBanner(t, d, c), sfx: k => this.sfx.play(k),
      onLieutenantDown: (name, x, y) => {
        this.showWaveBanner(name + ' 授首', false, '营寨守将倒下 · 军略 +1'); this.sfx.play('gong');
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; this.spawnGem(x + Math.cos(a) * 26, y + Math.sin(a) * 16, 4); }
        this.battleHeal?.onLieutenantDown(x, y);
      },
    }, plan);
    // 专属形象按需加载（runner 构造时发起）：载好再放人，免得先用了通用精锐图；最多等 4 秒
    let done = false; const go = (): void => { if (done || !this.sys.isActive() || this.luoyangLt !== r) return; done = true; lc.enlist(C.camp, r.spawnLieutenantAt(C.name, camp.x + C.dx, camp.y + C.dy, C.label)); };
    // 载入完成事件可能先被别的一批触发：每 250 毫秒看一次图好了没有，最多等 12 秒（营寨在远处，晚几秒放人看不出来）
    let waited = 0; const poll = (): void => { if (done) return; if (r.ltArt() || waited >= 12000) { go(); return; } waited += 250; window.setTimeout(poll, 250); }; // 真实时间（开局三选一会冻住场景计时器）
    if (!this.load.isLoading() && this.load.list.size) this.load.start(); poll();
    this.events.once('shutdown', () => { r.clear(); if (this.luoyangLt === r) this.luoyangLt = null; });
  }
  // ———— 玩法逐章解锁（data/mechanicUnlocks.ts，共享笔记 mechanic-rollout.md） ————
  private mechIntroDone = false;
  /** 刚开放的玩法：开打 3 秒后（剧情简报已收、在战斗中）播剧情引子：人物一两句 + 「新玩法 · X」一行提示。 */
  protected tickMechIntros(): void {
    if (this.mechIntroDone || this.over || this.resting || this.mode !== 'none' || this.elapsed < 3) return;
    this.mechIntroDone = true;
    for (const id of takeMechIntros('battle')) {
      const m = MECHANICS[id];
      for (const l of m.lines) showBarkCard(this, { side: 'left', name: l.who, text: l.text, id: l.id });
      showBarkCard(this, { side: 'left', name: '新玩法 · ' + m.name, text: m.tip });
    }
  }
  /** 事件引子（at 'event'）：第一次发生时播人物一句 + 「新玩法 · X」提示（行囊：1-1 首领掉第一件兵装）。 */
  mechEvent(id: MechId): void {
    if (!takeMechEvent(id)) return;
    const m = MECHANICS[id];
    for (const l of m.lines) showBarkCard(this, { side: 'left', name: l.who, text: l.text, id: l.id });
    showBarkCard(this, { side: 'left', name: '新玩法 · ' + m.name, text: m.tip });
    this.updateHud?.();
  }
  // ———— 战败流程（data/defeatFlow.ts，共享笔记 defeat-flow.md） ————
  /** 这一仗退到哪（最近的我方城池 / 营寨）；战败惩罚的说明行。 */
  defeatRetreat: RetreatTarget | null = null; defeatNotes: string[] = [];
  /** 遭遇战预览（?encounter= 汜水 / 荥阳 / 自定关）：不算正式出征。注意篇章场景的 runConfig 都带 encounter，不能拿它判断。 */
  encounterPreview = false;
  /** 惩罚生效：正式战斗（测试战斗只有 __IM_DEFEAT_LIVE 时）、天下已开放、不是遭遇战预览。 */
  protected defeatLive(): boolean {
    const debug = isChapterTestRun() || this.debugModified || this.debugJumped || !!this.player.damageImmune;
    return (!debug || !!(globalThis as Record<string, unknown>).__IM_DEFEAT_LIVE) && !this.encounterPreview && worldUnlocked();
  }
  /** 战败：惩罚（存档点主将 / 随行负伤、部曲折损，营寨军粮）、撤回目标、慢动作压暗 + 对话卡、结算面板晚出、按钮改「退守 X」。 */
  protected runDefeatFlow(): void {
    const key = this.hardKey(), stage = this.hardStage(), city = this.scene.key === 'SiegeGameScene' ? String(this.registry.get('siegeCity') ?? '') : null;
    // 守城战败：退到最近的「另一座」我方城池或营寨（原来退回刚没守住、仍在告急的那座城本身）
    const defending = !!city && (this.registry.get('siegeMode') === 'defense' || this.registry.get('siegeMode') === 'intercept');
    this.defeatRetreat = worldUnlocked() && !this.encounterPreview ? retreatTarget(battlePoint(key, city), defending ? city : null) : null;
    const notes: string[] = [];
    if (this.defeatLive()) {
      const fids = (this.followers?.members ?? []).map(m => m.recruit.id), camp = patchCampaignDefeat(this.runConfig.character, { hpFrac: DEFEAT.hpFrac, followerFrac: DEFEAT.followerFrac, troopLoss: DEFEAT.troopLoss, followerIds: fids });
      if (camp) { notes.push('主将负伤 · 下次出征生命 ' + Math.round(DEFEAT.hpFrac * 100) + '%（军医可治）'); if (fids.length) notes.push('随行负伤 · 生命 ' + Math.round(DEFEAT.followerFrac * 100) + '%'); if (camp.troops) notes.push('部曲折损 ' + camp.troops + ' 人'); }
      const g = loseProvisionsPct(DEFEAT.grainPct, DEFEAT.grainCap); if (g) notes.push('营寨军粮 −' + g);
    }
    this.defeatNotes = notes;
    if (!worldUnlocked()) { const tip = DEFEAT_TIPS[Math.floor(Math.random() * DEFEAT_TIPS.length)]; this.resultTexts.body.setText(this.resultTexts.body.text + '\n小贴士  ' + tip); } // 第一章：不扣东西，给一条小贴士
    if (notes.length) this.resultTexts.body.setText(this.resultTexts.body.text + '\n战败惩罚  ' + notes.join(' · '));
    // 演出：慢动作 + 压暗 + 左下角电影感对话卡（部将护主突围）；结算面板晚 resultDelayMs 出
    this.devTimeScale = DEFEAT.slowMul; window.setTimeout(() => { if (this.sys?.isActive()) this.devTimeScale = 1; }, DEFEAT.slowMs);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x07040a, 1).setScrollFactor(0).setDepth(DEPTH.overlay - 30).setAlpha(DEFEAT.dim).setName('defeat-dim'); // 结算时场景 tween 停了，压暗直接到位
    if (storyMode() !== 'off') {
      const hero = getCharacter(this.runConfig.character).name, guard = this.followers?.members.find(m => !m.downed)?.recruit.name.replace(/（.*）/, '') ?? '亲兵';
      for (const l of defeatLines(key, stage)) showBarkCard(this, { side: 'left', name: l.who === '@lord' ? hero : l.who || guard, text: l.text });
    }
    this.resultPanel.setVisible(false);
    window.setTimeout(() => { if (!this.sys?.isActive() || this.mode !== 'result') return; this.resultPanel.setVisible(true); this.presentResult(false); }, DEFEAT.resultDelayMs);
    queueMicrotask(() => this.wireDefeatButton());
  }
  /** 结算按钮改成「退守 X」：回天下地图，选中并居中那座城（或营寨），弹败退告示；关卡没平定，照样能再出征。 */
  protected wireDefeatButton(): void {
    const t = this.defeatRetreat, home = this.resultPanel.getByName('result-home') as Phaser.GameObjects.Text | null; if (!t || !home) return;
    home.setText('退守 ' + t.name).removeAllListeners('pointerdown').on('pointerdown', () => {
      for (const k of Object.keys(this.registry.getAll())) if (/Transfer$/.test(k)) this.registry.remove(k);
      this.registry.set('defeatRetreat', { name: t.name, kind: t.kind, stage: this.chapter.name, notes: [...this.defeatNotes] });
      if (t.kind === 'city') this.registry.set('mapFocusCity', t.id); // 营寨：地图那边按 defeatRetreat 居中营寨
      this.scene.start('WorldMapScene');
    });
    this.layoutResultButtons?.();
  }
  /** 战场机缘各类事件的奖励（stage-event-rewards.md）；mult = 距离倍率 1–1.25。返回横幅小字。 */
  private fortuneReward(kind: FortuneEventKind, mult: number, x: number, y: number): string {
    const P = this.player, ch = this.phasePlan?.chapter ?? 2;
    if (kind === 'cart') {
      const g = Math.round(FORTUNE.cartGrain(ch) * mult); this.legion.food += g;
      if (this.supplies && this.supplies.pouch.length < POUCH_MAX) { this.supplies.pouch.push({ amount: Math.round(P.maxHp * .3), texture: this.textures.exists('heal_props') ? 'heal_props' : 'healing_potion', frame: this.textures.exists('heal_props') ? 1 : undefined, name: '回春丹' }); return '随军粮 +' + g + ' · 回春丹已入药囊（Q）'; }
      P.heal(Math.round(P.maxHp * .2)); return '随军粮 +' + g + ' · 药囊已满，回复 20% 生命';
    }
    if (kind === 'armory') {
      const q = capLootQuality(ch <= 4 ? 'blue' : ch <= 8 ? 'purple' : 'orange', this.itemTier()), item = rollItem(q, Math.random, undefined, this.lootChapter());
      if (!this.debugRun()) addItems([item]); return '兵装 · ' + itemName(item) + '（已入行囊）';
    }
    if (kind === 'courier') {
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; this.spawnGem(x + Math.cos(a) * 30, y + Math.sin(a) * 18, Math.round(4 * mult)); }
      this.pendingLevels += 1; this.militaryPending += 1; if (this.mode === 'none') this.openUpgrade(); return '截获军情：多一次军略三选一';
    }
    if (kind === 'rescue') {
      this.reinforcePush().spawnEscortAt(x, y, FORTUNE.rescueEscort, FORTUNE.rescueEscortMs); this.legion.recruit('swordsman', FORTUNE.rescueRecruits, true);
      return '义军随你冲阵 ' + FORTUNE.rescueEscortMs / 1000 + ' 秒 · 部曲补员 ' + FORTUNE.rescueRecruits + ' 人';
    }
    if (kind === 'beacon') { this.beaconCalmUntil = this.combatNow + FORTUNE.beaconCalmMs; P.heal(Math.round(P.maxHp * FORTUNE.beaconHeal)); return '烽火示警：' + FORTUNE.beaconCalmMs / 1000 + ' 秒内刷兵减半 · 回复 ' + Math.round(FORTUNE.beaconHeal * 100) + '% 生命'; }
    this.fortuneQueue.push(kind); return '降将献策：战场机缘三选一';
  }
  /** 战场机缘三选一：三张「本关有效」增益（走 bossloot 面板：选完即回战斗，不占保底次数）。 */
  protected openFortune(kind: FortuneEventKind): void {
    const buffs = rollFortuneBuffs(this.fortuneTaken); if (!buffs.length) return;
    this.sfx.level();
    (this.levelPanel.getByName('upgrade-title') as Phaser.GameObjects.Text)?.setText('战场机缘 · ' + FORTUNE_EVENT[kind].done);
    (this.levelPanel.getByName('upgrade-points-hint') as Phaser.GameObjects.Text)?.setVisible(true).setText('三选一 · 只在本关有效');
    this.upgradeOptions = buffs.map(b => ({ id: b.id, name: b.name, desc: b.desc, kind: 'foundation' as const, icon: b.icon, categoryLabel: '战场机缘', scope: 'stage' as const,
      apply: () => { applyStageBuff(this.player, s => b.apply(s, this.player.maxHp)); if (b.now === 'heal15') this.player.heal(Math.round(this.player.maxHp * .15)); this.fortuneTaken[b.id] = (this.fortuneTaken[b.id] ?? 0) + 1; } }));
    this.lootContinue = () => { this.setMode('none'); this.resumePendingChoices(); };
    this.renderCards(); this.setMode('bossloot');
  }
  protected ensurePicks(target: number, force = false): void {
    if (this.over || !this.player?.alive) return;
    const cap = this.campaignReplay ? PICK_GUARANTEE.side : this.pickCap(), need = Math.min(target, cap) - this.picksGiven;
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
    if (!mechShown('gear')) return; // 玩法逐章解锁：行囊 1-1 开放，首领掉第一件兵装、张飞那句之后才出现
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
    if (victory) this.fortunes?.farewell(); // 机缘降将：本关结束告别一句
    commitBattle(); // 告捷（战报）与战败都按现行规则结算，本场写入生效
    this.player.passive.stop();
    // 动作层：胜利举兵器 / 战败倒地（有素材的武将才播放，播完定格）
    this.player.playAction(victory ? 'win' : 'die', 'down');
    this.legion.stop();
    buildVfx(this).clear();
    this.synergy?.clear();
    this.bulwarkBuild?.clear();
    this.controlBuild?.clear();
    this.reinforcements.clear();
    this.victory = victory;
    const jingle = this.music.endBattle(victory); // BGM v2：胜利 / 败退短曲接在战斗曲后
    this.lubu?.clear();this.zhangjiao?.clear();this.zhangjiao=null;this.huaxiong?.clear();this.xurong?.clear();this.yellow?.clear();this.xiliang?.clear();this.clearChasingBosses();this.supplies?.clear();if(victory)this.itemDrops?.collectAll();this.itemDrops?.clear();
    if(victory&&this.chapter.stage===3)this.finaleFadeMs=800;
    this.feedback.clearAttacks();
    if (!jingle) { if (victory) this.sfx.win(); else this.sfx.lose(); }
    // 界面 BGM 检查：结算 / 战败退守原来短曲（约 4 秒）后就没声了——短曲之后接界面曲「静」（古琴 + 二胡），回营寨 / 地图时同一实例淡入换情绪
    this.music.setPaused(false); this.time.delayedCall(jingle ? 4400 : 300, () => { if (this.over && this.sys.isActive()) playMenuMusic(this, 'rest'); });
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
        row('部曲战损', `${this.legion.count}存活 / ${this.legion.dead}阵亡`),
        row(this.chapter.bossName, stats.bossKilled ? '已击败' : '未击败'),
        row('结局', victory ? '讨伐成功' : reason === 'timeout' ? '超时' : '阵亡'),
      ].join('\n'),
    );
    // 兵装缴获：胜利或坚持 60 秒带回全部，速败只带回一半；测试 / 调试战斗不入行囊
    {const loot=this.itemDrops?.runLoot??[],debug=isChapterTestRun()||this.debugModified||this.debugJumped||!!this.player.damageImmune||!!this.runConfig.encounter,dep=depositRunLoot(loot,{victory,elapsed:victory?this.elapsed:0,debug,pity:this.itemDrops?.pity}); /* 战败（data/defeatFlow.ts）：只带回一半，品质高的留下 */
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
    {const again=victory&&(REPLAY_CLEARED||isChapterTestRun());/* 打过的关不能再打（data/replayRules.ts） */this.resultPanel.getByName('result-restart')?.setActive(again);(this.resultPanel.getByName('result-restart') as Phaser.GameObjects.Image)?.setVisible(again);(this.resultPanel.getByName('result-restart-text') as Phaser.GameObjects.Text)?.setVisible(again);}
    homeLink?.setText(!victory?'返回主菜单':canAdvance?`下一关 · ${nextWest===1?'汜水关':nextWest===2?'荥阳':'虎牢关'}`:openedMap?(openChapterCount(loadWorldState())>loadWorldState().chapterSeen?'天下地图 · 新篇解锁':'返回天下地图'):this.worldCampaign&&worldUnlocked()?"返回营寨":'返回选关');
    homeLink?.removeAllListeners('pointerdown').on('pointerdown',()=>{
      if(!victory){this.registry.remove('campaignTransfer');this.registry.remove('menuChapterPicker');this.scene.start('MenuScene');return;}
      if(canAdvance){this.registry.remove('campaignTransfer');const {encounter:_preview,...config}=this.runConfig;this.registry.set('runConfig',{...config,chapter:'hulao',stage:undefined,westStage:nextWest});this.scene.restart();return;}
      if(this.worldCampaign&&worldUnlocked())this.scene.start(openedMap||this.registry.get('worldReveal')?'WorldMapScene':'CityScene');
      else {this.registry.set('menuChapterPicker',true);this.scene.start('MenuScene');}
    });
    mechRefresh();
    if (!victory) this.runDefeatFlow();
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
        .text(GAME_WIDTH - 24, 100, '音效：开', style(13, '#e3d3b0'))
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.hud + 1)
        .setPadding(8, 4, 8, 4)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const muted = this.sfx.toggle();
          this.muteText?.setText(muted ? '音效：关' : '音效：开');
        }),
      music: this.add
        .text(GAME_WIDTH - 24, 132, '音乐：开', style(13, '#e3d3b0'))
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.hud + 1)
        .setPadding(8, 4, 8, 4)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const muted = this.music.toggle();
          this.hudTexts.music.setText(muted ? '音乐：关' : '音乐：开');
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
        .setInteractive({ useHandCursor: true }).setName('hud-pause')
        .on('pointerdown', () => this.togglePause()),
    };
    attrBadge(this, 196, 31, this.runConfig.character, 20, { scrollFactor: 0, depth: DEPTH.hud + 2 })?.setName('hud-attr-badge'); // 主将主属性印（ui/AttrBadge.ts）
    // 2026-11-19 用户「这里ui做一下」：电脑版左上换成漆金状态框（头像 / 名字 + 等级印 + 主属性印 / 铜框朱红血条 + 残血拖尾 / 细金经验条）；
    // 旧的「赵云 Lv.N」文字留作数据（测试读），不再显示；HP 数字摆进新血条中央
    this.bossHud?.destroy(); this.bossHud = new BossHud(this, DEPTH.hud, { name: this.hudTexts.boss, pct: this.hudTexts.bossHp, status: this.hudTexts.bossEnergy }); this.events.once('shutdown', () => { this.bossHud?.destroy(); this.bossHud = undefined; });
    this.hudAttrBadge = undefined; if (IS_DESKTOP) { this.statusFrame?.destroy(); this.statusFrame = new HeroStatusFrame(this, this.runConfig.character, getCharacter(this.runConfig.character).name, DEPTH.hud); this.events.once('shutdown', () => { this.statusFrame?.destroy(); this.statusFrame = undefined; }); }
    this.hudTexts.details = this.add.text(GAME_WIDTH - 24, 94, '战况 ▾', style(13, '#dfcfab'))
      .setOrigin(1,0).setFixedSize(96,62).setAlign('center').setPadding(10,12).setScrollFactor(0).setDepth(DEPTH.hud+1)
      .setVisible(false); // 「战况」下拉已取消（用户反馈不需要）；音效 / 音乐开关改为常驻
    this.hudTexts.gear = this.add.text(32, 236, '', {...style(12,'#dfd5bc'),wordWrap:{width:GAME_WIDTH>600?370:GAME_WIDTH-72},lineSpacing:4})
      .setScrollFactor(0).setDepth(DEPTH.hud+1);
    for (const k of ['pause', 'mute', 'music', 'bag'] as const) this.hudTexts[k]
      .on('pointerover', () => { this.hudChipState[k] = 'hover'; }).on('pointerout', () => { this.hudChipState[k] = 'idle'; })
      .on('pointerdown', () => { this.hudChipState[k] = 'down'; }).on('pointerup', () => { this.hudChipState[k] = 'hover'; });
    this.passiveHud = new PassiveHud(this); this.heroBark = new HeroBark(this); this.passiveGauge = new PassiveGauge(this); this.zhaoyunFx = this.passiveGauge.zhaoyun; this.passiveShout = new PassiveShout(this, { sfx: () => this.sfx.play('passiveFull'), nearby: (x, y, r) => this.grid.query(x, y, r).filter(e => Math.hypot(e.x - x, e.y - y) <= r) });
    this.buffHud=new BuffHud(this);
    this.muteText = this.hudTexts.mute;
    this.muteText.setText(this.sfx.muted ? '音效：关' : '音效：开');
    this.hudTexts.music.setText(this.music.mutedState ? '音乐：关' : '音乐：开');
    // 2026-11-17 用户「暂停改成设置」：电脑版右上只留「设置」，音效 / 音乐挪进设置面板；行囊顶到原音效位
    if (IS_DESKTOP) { this.hudTexts.mute.setVisible(false).disableInteractive(); this.hudTexts.music.setVisible(false).disableInteractive(); this.hudTexts.bag.setY(100); }
    // 2026-11-19 用户「行囊做成行囊的样子」：右上行囊换成手绘包袱（打结布包 + 小字「行囊」）；hud-bag 文字留作命中区（不显示字、不画漆牌）
    {const t=this.hudTexts.bag,size=IS_DESKTOP?44:48,cx=t.x-33,cy=t.y+(IS_DESKTOP?20:22);
     const apply=()=>{t.setText('').setFixedSize(60,IS_DESKTOP?54:58).setY(cy-size/2-2);};
     this.bagBundle=bagBundle(this,cx,cy,size,{depth:DEPTH.hud+2,onReady:apply});if(this.bagBundle.ready())apply();
     t.on('pointerover',()=>this.bagBundle?.setHover(true)).on('pointerout',()=>this.bagBundle?.setHover(false));}
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
    this.pointsBadge?.setText(String(Math.min(99,this.player.growth.unallocated)));if(this.pointsButton)this.pointsButton.setVisible(!overlay&&!this.over&&this.player.growth.unallocated>0&&mechOpen('attributes')).setData('points',this.player.growth.unallocated);
    this.legionUI?.update(this.legion, !overlay && !this.over);
    this.passiveHud.update(this.player.passive, this.combatNow, !overlay);
    { const st = branchStatus(this.player.weapons[0], s => this.player.growth.build.tags()[s] ?? 0, s => SCHOOLS[s].name); this.passiveHud.updateBranch(st); this.buffHud?.root.setY(st ? 214 : 180); } // 专职行在被动栏下，增益栏往下让
    buildVfx(this).density=this.enemies.filter(e=>e.active&&!e.isSupplySlot).length+this.legion.count;
    this.buffHud.update(this.player,this.combatNow,!overlay&&!this.over&&!this.relicExpanded,(id,now)=>this.buffProgress(id,now));
    this.hudGfx.setVisible(!overlay);
    if (this.hudTexts) for (const t of Object.values(this.hudTexts)) t.setVisible(!overlay && (t !== this.hudTexts.bag || mechShown('gear')));
    if (this.statusFrame) { this.statusFrame.setVisible(!overlay); this.hudTexts?.level.setVisible(false); }
    if (this.phasePlan && this.hudTexts) this.hudTexts.wave.setVisible(false);
    this.jinnangButton?.setVisible(!overlay && !this.over && !!this.jinnang); // 五段关不显示「第 x 波」，看顶部战况线
    this.battleTrack?.show(!overlay);
    if (IS_DESKTOP && this.hudTexts) { this.hudTexts.mute.setVisible(false); this.hudTexts.music.setVisible(false); } // 电脑版：音效 / 音乐在「设置」面板里
    for (const icon of this.relicIcons) icon.setVisible(!overlay && icon.visible);
    if (overlay) { this.hintText?.setVisible(false); return; }
    const g = this.hudGfx;
    const hpRatio = this.player ? Phaser.Math.Clamp(this.player.hp / this.player.maxHp, 0, 1) : 1;
    const xpRatio = this.player ? Phaser.Math.Clamp(this.player.xp / this.player.xpNext, 0, 1) : 0;
    g.clear();
    // Small neutral health backing only; never a screen-wide green curtain.
    if (!this.statusFrame) g.fillStyle(0x100e09,.35).fillRoundedRect(20,18,194,60,4);
    if(this.relicExpanded) {
      g.fillStyle(0x17150f,.9).fillRoundedRect(20,190,Math.min(410,GAME_WIDTH-40),180,4);
      g.lineStyle(1,WAR.gold,.45).strokeRoundedRect(20,190,Math.min(410,GAME_WIDTH-40),180,4);
    }
    // Stable HUD regions: health, clock, touch controls, then wave/resources.

    if (!this.statusFrame) { // 手机布局：原扁平条
    g.fillStyle(0x07120d,.95).fillRect(27,42,180,18);
    g.fillStyle(WAR.danger,.95).fillRect(29,44,Math.round(176*hpRatio),14);
    g.lineStyle(1,0xd5b887,.55).strokeRect(27,42,180,18);
    g.fillStyle(0x07120d,.9).fillRect(27,66,180,6);
    {const over=!!this.player&&this.player.level>=this.player.softLevel;g.fillStyle(over?0xb08a3a:WAR.jade,.95).fillRect(28,67,Math.round(178*xpRatio),4);if(over)g.fillStyle(0xe8c070,.95).fillRect(205,64,2,10);} // 越级：经验条暗金，右端一道金色小刻度（已过建议等级）
    }
    // 右上角按钮的漆金底板：暂停为金漆，音效 / 音乐为暗漆小牌（原先是无底纹的纯文字，手机上不像按钮）
    if (this.hudTexts) for (const k of ['pause', 'mute', 'music', 'bag'] as const) {
      const t = this.hudTexts[k]; if (!t?.visible) { if (k === 'bag') { this.bagBundle?.icon.setVisible(false); this.bagBundle?.caption.setVisible(false); } continue; }
      if (k === 'bag' && this.bagBundle?.ready()) { this.bagBundle.icon.setVisible(t.visible); this.bagBundle.caption.setVisible(t.visible); continue; } // 包袱图标代替漆牌
      const b = t.getBounds(this.hudChipRect), pause = k === 'pause';
      lqButton(g, b.centerX, pause ? b.y + 28 : b.centerY, pause ? Math.max(66, t.width - 6) : b.width, pause ? 36 : k === 'bag' ? 30 : 24, this.hudChipState[k], pause ? 'gold' : k === 'bag' ? 'cinnabar' : 'quiet');
    }

    if (!this.hudTexts) return;
    this.hudTexts.hp.setText(`${Math.ceil(this.player.hp)}/${this.player.maxHp}`);
    {const soft=this.player.softLevel,over=this.player.level>=soft;this.hudTexts.level.setText(`${getCharacter(this.runConfig.character).name} Lv.${this.player.level}`+(Number.isFinite(soft)?` · 建议 ${soft}`:'')).setColor(over?'#d9a84a':'#e8c76a');} // 越级：等级字与经验条都换暗金
    this.hudTexts.timer.setText(this.formatTime(this.elapsed));
    this.hudTexts.chapter.setText(this.chapter.name);
    this.hudTexts.kills.setText(`击杀 ${this.kills}`);
    if (this.waveIndex >= 0) {
      this.hudTexts.wave.setText(this.chapter.waves.length === 1 ? this.chapter.waves[0].name : `第 ${this.waveIndex + 1}/${this.chapter.waves.length} 波 · ${this.chapter.waves[this.waveIndex].name}`); // 不分波（2-3）只写名字
    }
    this.hudTexts.details.setText(this.relicExpanded?'收起战况 ▴':'战况 ▾');
    for(const key of ['gear','relics']) this.hudTexts[key].setVisible(this.relicExpanded);
    this.hudTexts.details.setVisible(false);
    const weapon = this.player.weapons[0];
    const mastery = '\n'+this.player.growth.masteryLabel();
    this.hudTexts.gear.setText(`${weapon ? `${weaponName(weapon.id,this.runConfig.character)} Lv.${weapon.level + (weapon.over ?? 0)}${branchById(weapon.branch) ? ' · ' + branchById(weapon.branch)!.name : ''}` : '本命武器'}${mastery}\n属性点 ${this.player.growth.unallocated}${this.player.growth.unallocated>0?'':` · 武将 Lv.${this.heroLv}`} · ${this.passiveHud.description}`);
    // 信物（2026-11-17 本局遗物并入信物库）：穿着的信物 + 已激活的同流派套装
    const tokens = wornTokens(this.runConfig.character), sets = this.charmInfo ? (Object.keys(this.charmInfo.schools) as CharmSchool[]).filter(sc => this.charmInfo!.schools[sc] >= 2) : [];
    this.hudTexts.relics.setText(tokens.length ? !IS_DESKTOP && !this.relicExpanded ? `信物 ${tokens.length}  · 点按展开` : `信物 ${tokens.map(t => charmDef(t.base)?.name ?? itemName(t)).join(' · ')}${sets.map(sc => `  ${CHARM_SCHOOL_NAMES[sc]}套装 ${CHARM_SET_DESC[sc]}`).join('')}` : '');

  }

  /**
   * 首领血条（每帧；2026-11-20 用户「还有ui boss血条优化一下」→ ui/BossHud.ts 漆金框 + 圆形头像 + 称号印 + 铜框朱红血条 + 半血刻度 + 破势细金条）。
   * 名字 / 百分比 / 状态仍用 hudTexts.boss / bossHp / bossEnergy（各关子类在 update 末尾改 bossEnergy 文字，测试也读）。
   */
  protected updateBossHud(): void {
    const hud = this.bossHud; if (!hud || !this.hudTexts) return;
    const overlay = this.mode !== 'none', rn = performance.now();
    hud.setVisible(!overlay);
    if (overlay) { this.dual?.hideHud(); hud.hideDual(); for (const t of [this.hudTexts.boss, this.hudTexts.bossHp, this.hudTexts.bossEnergy]) t.setVisible(false); return; }
    // 双首领：屏幕下方两块并排（DualBoss.drawHud → BossHud.drawDualPanel）
    if (this.dual?.hudActive) { this.hintText?.setVisible(false); this.hudTexts.boss.setVisible(false); this.hudTexts.bossHp.setVisible(false); this.hudTexts.bossEnergy.setVisible(false); hud.update(null, rn, true); this.dual.drawHud(hud, COLORS.red, WAR.danger); return; }
    this.dual?.hideHud(); hud.hideDual();
    // 本关首领未击败、战线已推进时，追兵首领的血条继续显示（用户反馈血条不应消失）
    const chaser = this.boss?.active ? null : this.chasingBosses.find(t => t.enemy.active && t.enemy.spawnId === t.life) ?? null;
    const dzLb = this.dzLubu?.lubuFocus ?? null; // 2-3：吕布跃下后血条给吕布（逃走前锁在 1/3）
    // 用户「董卓吕布出来之前不要显示血条」：两人站在城头（打不到）时不显示首领血条；吕布跃下起显示吕布、董卓下城后显示董卓（换人时框重新展开）
    const boss = dzLb ?? (this.dzLubu?.hidesBossBar ? null : this.boss?.active ? this.boss : chaser?.enemy ?? null);
    if (boss && boss.active) {
      const ratio = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
      this.hintText?.setVisible(false);
      this.hudTexts.boss.setText(dzLb ? '吕布' : chaser ? chaser.name + ' · 追兵' : this.chapter.bossName);
      this.hudTexts.bossHp.setText(!chaser && !dzLb && this.bossShield > 0 ? `${Math.round(ratio * 100)}% · 盾 ${Math.round(this.bossShield)}` : `${Math.round(ratio * 100)}%`);
      const stageBoss=!!chaser||!!dzLb||!!this.xurong||!!this.huaxiong||!!this.chapter.stage&&this.chapter.stage<3;
      const energy = this.lubu ? this.lubu.energy : this.bossEnergy;
      if (this.hudAcc === 0 || this.hudTexts.bossEnergy.text === '') this.hudTexts.bossEnergy.setVisible(!chaser)
        .setText(dzLb?(this.dzLubu?.phase==='fleeing'?'吕布败走':'打到三分之一，吕布败走'):this.zhangjiao?this.zhangjiao.label:this.xurong?this.xurong.label+' · 推进 '+Math.max(0,Math.ceil(90-(this.combatNow-this.firstBossAt)/1000))+'秒':this.huaxiong?this.huaxiong.label+' · 推进 '+Math.max(0,Math.ceil(90-(this.combatNow-this.firstBossAt)/1000))+'秒':this.lubu ? `${this.lubu.phase2 ? `魔神 ${Math.floor(energy)}%` : '半血解锁大招'} · ${this.lubu.statusLabel}` : stageBoss?`${this.moveset?.wardInfo?this.moveset.wardInfo+' · 先打碎符柱 · ':''}${boss.hp<=boss.maxHp*.5?'半血强化 · ':''}${this.battleStage()<3?'战线推进倒计时 '+Math.max(0,Math.ceil(90-(this.combatNow-this.firstBossAt)/1000))+'秒':'注意地裂与环形预警'}`:`大招蓄力 ${Math.floor(energy)}%`);
      // 白色残血条：受击的那一截先显示成白色，停一下再慢慢缩到当前血量（按真实时间，不跟顿帧慢动作走）
      const dtr = Math.min(.25, (rn - (this.lastHudReal || rn)) / 1000); this.lastHudReal = rn; this.bossStagger.track(boss.spawnId, ratio);
      const trail = this.bossStagger.trailRatio(ratio, rn, dtr);
      const id = dzLb ? 'lubu' : chaser ? ({ 张梁: 'zhangliang', 张宝: 'zhangbao', 华雄: 'huaxiong', 徐荣: 'xurong' } as Record<string, string>)[chaser.name] ?? '' : this.chapter.bossStyle;
      hud.setFallback(id, boss.def.walkVisual?.texture ?? boss.def.texture);
      hud.update({ id, name: this.hudTexts.boss.text, ratio, trail, stagger: this.bossStagger.value / BOSS_FEEL.staggerMax, breaks: this.bossStagger.breaks, shield: !chaser && !dzLb && this.bossShield > 0 ? Math.min(1, this.bossShield / 300) : 0 }, rn);
    } else {
      this.hintText?.setVisible((this.elapsed < 8 || this.relicExpanded) && !this.tutorial?.active); // 新手引导在时不叠旧操作提示
      hud.update(null, rn);
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
    // 2026-11-19 用户「关于技能3选一描述需要检查优化一下」：本次征程的成长选定后不可更改（行营休整可花军粮重整）
    this.levelPanel.add(this.add.text(GAME_WIDTH/2,d?510:292+Math.max(0,Math.round((GAME_HEIGHT-960)/2))+2*192+120,'选定后本次征程不可更改（可在行营休整花费军粮重整）',{fontFamily:FONT,fontSize:'14px',color:d?'#c9b48a':'#bfae8a',resolution:2}).setOrigin(.5).setStroke(STROKE,d?3:0).setScrollFactor(0).setName('upgrade-lock-note'));
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
      const rich=this.add.container(desc.x,desc.y).setName('upgrade-card-desc-'+i);
      // 有效范围徽记：电脑版卡片左上角、手机版右上角（不占说明区）
      const scope=this.add.text(d?16-w/2:w/2-16,d?16-h/2:14-h/2,'',{fontFamily:HEADING_FONT,fontSize:'12px',color:'#ffffff',resolution:2}).setPadding(8,2).setOrigin(d?0:1,0).setName('upgrade-card-scope-'+i);
      const hint=this.add.text(d?0:w/2-16,d?h/2-22:h/2-14,d?'按 '+hotkeyLabel((['pick1','pick2','pick3'] as const)[i]??'pick1')+' 选择':'点击选择',warText(11,'#9d8f78')).setOrigin(d?.5:1,1).setAlpha(.85);
      if(d){ // 统一字体：卡名 / 标签 / 提示用标题字，正文用正文字；水墨版换深墨色 + 朱砂标签
        name.setFontFamily(HEADING_FONT).setColor(INK?'#1f1710':GOLD).setStroke(INK?'#efe4c9':STROKE,3);
        desc.setFontFamily(FONT).setColor(INK?'#33281d':IVORY).setStroke(INK?'#efe4c9':STROKE,INK?2:2);
        tag.setFontFamily(HEADING_FONT).setColor(INK?'#fff0d6':'#f6e6c2');if(INK)tag.setBackgroundColor('#8a2a1c');
        hint.setFontFamily(HEADING_FONT).setFontSize(12).setColor(INK?'#5b4630':'#b9a57a').setStroke(INK?'#efe4c9':STROKE,2).setAlpha(1);
      }
      // 子元素也必须固定在屏幕上，否则命中检测按相机滚动偏移（点不中卡片）。
      for(const o of [bg,rule,icon,tag,name,desc,hint,rich,scope])o.setScrollFactor(0);root.add([bg,rule,icon,tag,name,desc,rich,scope,hint]);root.setScrollFactor(0);this.levelPanel.add(root);
      const view:CardView={bg,icon,name,desc,tag,root,rule,hint,rich,scope,w,h,baseY:y,medal,accent:UPGRADE_ACCENT.passive,rare:false,hover:false,lift:0};
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
      if(exit.getData('confirm'))this.leaveBattle(toMap?'WorldMapScene':d?'MenuScene':this.worldCampaign&&worldUnlocked()?'CityScene':'MenuScene',toMap?'WorldMapScene':null);
      else{exit.setData('confirm',true).setText(d?'撤退？退出后本场获得的等级与资源不保留，确定？':'退出后本场获得的等级与资源不保留，确定？').setColor('#e7b68e');if(!d)armPauseChip(exit,'返回选将？本场获得的等级与资源不保留');}
    });
    // 2026-11-18 用户「返回主菜单按钮，三处都加」：撤退旁加「返回主菜单」，点一次待确认、再点执行；回滚规则与撤退同一条路（leaveBattle），最后进主页
    const toMenu=this.add.text(cx,top+ph-66,'返回主菜单',warText(16,'#b5c4b2')).setOrigin(.5).setPadding(24,10).setInteractive({useHandCursor:true}).setName('pause-menu');
    toMenu.on('pointerdown',()=>{if(toMenu.getData('confirm'))this.leaveBattle('MenuScene','MenuScene');else toMenu.setData('confirm',true).setText('返回主菜单？本关进度不保留').setColor('#e7b68e');if(!d)armPauseChip(toMenu,'返回主菜单？本关进度不保留');});
    // 手机：撤退与返回主菜单并排（各占半宽）；待确认时半宽小牌只写「再点确认」，完整提示写到底下整行（另一块牌复原，底行只说一件事）
    const armPauseChip=(t:Phaser.GameObjects.Text,warn:string):void=>{const o=t===exit?toMenu:exit;o.setData('confirm',false).setText(o===exit?'返回选将':'返回主菜单').setColor('#b5c4b2');t.setText('再点确认');this.pauseKeysText?.setData('warn',true).setText(warn).setColor('#e7b68e');};
    if(!d){const half=(pw-120)/2-6;exit.setX(cx-half/2-6);toMenu.setX(cx+half/2+6);}
    const keys=this.pauseKeysText=this.add.text(cx,top+ph-22,d?'Esc / P 继续战斗':'战斗已冻结 · 点击「继续战斗」恢复',warText(12,'#7f9987')).setOrigin(.5);
    // 暂停菜单里的文字入口改为漆金小牌：有底板、悬停 / 按下态，命中区与底板一致
    const pauseSkins=([[this.attributePauseText,pw-120,30],[bagLink,pw-120,32],[buildLink,pw-120,32],[exit,d?pw-120:(pw-120)/2-6,36],[toMenu,d?pw-120:(pw-120)/2-6,36]] as const).map(([t,w,h])=>{
      const skin=lqSkin(this,t,t,()=>({w,h}),{tone:'quiet'});lqHitBox(t,w,h);return skin;}),pauseChips=pauseSkins.map(k=>k.gfx);
    this.pausePanel.add([pauseDim,panelG,panel,pauseTitle,pauseHint,...pauseChips,resume,resumeText,...bgmRow,...sfxRow]);
    this.pausePanel.add(this.attributePauseText);this.pausePanel.bringToTop(bagLink);this.pausePanel.bringToTop(buildLink);this.pausePanel.add([exit,toMenu,keys]);
    if (d) { this.layoutSettingsPanel({ panelG, panel, pauseTitle, pauseHint, resume, resumeText, bgmRow, sfxRow, buildLink, bagLink, exit, keys }); toMenu.setPosition(exit.x, exit.y + 56).setFontFamily(HEADING_FONT); for (const k of pauseSkins) k.repaint(); } // 底板跟着按钮挪到左栏
    // 手机版暂停菜单没有 ‹ 值 › 行：「死亡特效」做成同风格的点按小牌（点一下开 ↔ 关，和电脑版 / 主页设置共用 im_death_fx）
    if(!d){
      const deathFxLink=this.add.text(cx,top+330,'',warText(15,'#e6cc90')).setOrigin(.5).setPadding(14,6).setInteractive({useHandCursor:true}).setName('settings-death-fx');
      const paintDeathFx=():void=>{deathFxLink.setText('死亡特效：'+DEATHFX_LABEL[deathFxSetting()]);};paintDeathFx();
      deathFxLink.on('pointerdown',()=>{setDeathFx(deathFxSetting()==='on'?'off':'on');paintDeathFx();});
      const dsk=lqSkin(this,deathFxLink,deathFxLink,()=>({w:pw-120,h:32}),{tone:'quiet'});lqHitBox(deathFxLink,pw-120,32);
      this.pausePanel.add([dsk.gfx,deathFxLink]);
    }
    this.attributePanel=this.add.container(0,0).setScrollFactor(0).setDepth(DEPTH.overlay+1).setVisible(false);
    const attrDim=this.add.rectangle(0,0,GAME_WIDTH,GAME_HEIGHT,0x07120d,.76).setOrigin(0).setInteractive();
    const attrW=d?880:GAME_WIDTH-32,attrH=d?Math.min(512,GAME_HEIGHT-16):700,attrTop=(GAME_HEIGHT-attrH)/2,attrCx=GAME_WIDTH/2;
    const attrFrameG=this.add.graphics();lqPanel(attrFrameG,attrCx-attrW/2,attrTop,attrW,attrH);
    const attrFrame=this.add.rectangle(attrCx,GAME_HEIGHT/2,attrW,attrH,0x000000,.001).setInteractive();
    const attrTitle=this.add.text(attrCx,attrTop+34,'武将修习 · 属性分配',warText(24,'#e8cf91')).setOrigin(.5);
    if(d)attrTitle.setFontFamily(TITLE_FONT).setColor('#efd399').setStroke('#120904',4); // 2026-11-17 用户批准 UI 审查 G：书法标题、点数改金字、点数条换描金小菱、＋ 与返回换水墨
    this.attributePointsText=this.add.text(attrCx,attrTop+74,'可分配属性点 0',warText(16,'#91ab98')).setOrigin(.5).setPadding(14,4);
    this.attributeWeaponText=this.add.text(attrCx,attrTop+104,'',warText(13,'#d3bd86')).setOrigin(.5);
    this.attributeSummaryText=this.add.text(attrCx,attrTop+133,'',{...warText(d?11:12,'#c7d6c8'),align:'center',lineSpacing:3}).setOrigin(.5).setWordWrapWidth(attrW-46);
    this.attributePanel.add([attrDim,attrFrameG,attrFrame,attrTitle,this.attributePointsText,this.attributeWeaponText,this.attributeSummaryText]);
    this.attributeView=undefined;if(d)for(const o of [attrTitle,this.attributePointsText,this.attributeWeaponText,this.attributeSummaryText])o.setVisible(false); // 电脑版换新视图，旧文字只留着给手机分支用
    const rowH=d?50:66,firstY=attrTop+(d?186:206),rowW=attrW-50;
    // 2026-11-18 用户「关于每个英雄主属性，在加点那里要说出来有什么特殊加成」：主属性一行加高一截，写三行——
    // ①「主属性：敏捷 · 每点效果 ×1.5」②原来的每点效果 ③专精三档（已解锁点亮，未解锁写「再加 X 点」）；整行悬停 / 点按弹完整说明（ui/PrimaryAttrInfo）
    const primaryExtra=d?22:20;
    this.attributeRows=[];
    this.attributeTip?.destroy();const attrTip=this.attributeTip=new ItemTooltip(this,DEPTH.overlay+40);
    let rowOffset=0;
    if(d)this.attributeView=new AttributePanelView(this,this.attributePanel,attrTip,{x0:attrCx-attrW/2,y0:attrTop,w:attrW,h:attrH,hero:this.runConfig.character,onAdd:id=>this.attributeAdd(id)});
    (d?[]:(Object.keys(ATTRIBUTE_INFO) as AttributeId[])).forEach((id,index)=>{
      const isPrimary=primaryAttribute(this.runConfig.character)===id,H=rowH+(isPrimary?primaryExtra:0);
      const y=firstY+index*rowH+rowOffset+(isPrimary?primaryExtra/2:0),left=attrCx-rowW/2;rowOffset+=isPrimary?primaryExtra:0;
      const rowTop=y-(H-8)/2,lineA=isPrimary?rowTop+(d?15:16):y-11,lineB=isPrimary?lineA+(d?21:23):y+12,cy=isPrimary?(lineA+lineB)/2:y;
      const row=this.add.graphics();row.fillStyle(LQ.lacquerHi,.5).fillRoundedRect(left,rowTop,rowW,H-8,6).lineStyle(isPrimary?2:1,LQ.gold,isPrimary?.95:.38).strokeRoundedRect(left,rowTop,rowW,H-8,6); // 主属性一行金边
      const attrIconImg=this.add.image(left+30,cy,attributeIcon(id)).setDisplaySize(34,34);
      const pipX=attrCx+rowW/2-(d?226:212),pipY=cy,pips=this.add.graphics();
      const sum=isPrimary?primarySummary(this.runConfig.character,0):null;
      const label=this.add.text(left+56,lineA,sum?sum.head:ATTRIBUTE_INFO[id].name,{...warText(sum?(d?15:14):17,isPrimary?'#ffe3a0':'#f0dfb4')}).setOrigin(0,.5).setName(isPrimary?'attribute-primary-head':'attribute-name-'+id);
      if(sum&&label.width>pipX-label.x-10)label.setScale((pipX-label.x-10)/label.width); // 手机窄：缩到点数条前
      const heroExtra=heroAttributeExtra(this.runConfig.character,id); // 刘备统御：本人受伤也减（2026-11-18）
      const effect=this.add.text(left+56,lineB,ATTRIBUTE_INFO[id].effect+(heroExtra?'；'+heroExtra:''),warText(12,heroExtra?'#cfe0a8':'#a9b9a3')).setOrigin(0,.5);
      // 等级：10 格，右侧数值
      const value=this.add.text(attrCx+rowW/2-80,cy,`0/${this.player.growth.attrMax}`,warText(13,'#b6c3ab')).setOrigin(1,.5);
      const button=this.add.image(attrCx+rowW/2-38,cy,'ui_war_button').setDisplaySize(50,44).setInteractive({useHandCursor:true}).setName('attribute-add-'+id);
      const plus=this.add.text(button.x,button.y-1,'+',warText(26,'#ffe9bd')).setOrigin(.5).setStroke('#2a170b',3);
      lqImageButton(this,button,50,44,'gold',plus);
      // 2026-11-18 每个界面最多 1 处水墨笔刷：「＋」用漆底描金方钮（上面的 lqImageButton），笔刷只留给底部「返回」
      button.on('pointerdown',()=>{this.attributeAdd(id);});
      this.attributePanel.add([row,attrIconImg,label,effect,pips,value,button,plus]);
      let perks:{prefix:Phaser.GameObjects.Text;chips:Phaser.GameObjects.Text[]}|undefined;
      if(isPrimary){
        const ab=attrBadge(this,left+48,cy-15,this.runConfig.character,18);if(ab)this.attributePanel.add(ab); // 主属性印（ui/AttrBadge.ts）
        const lineC=lineB+(d?21:24),prefix=this.add.text(left+56,lineC,'专精',warText(12,'#c9b88f')).setOrigin(0,.5);
        const chips=PRIMARY_TIERS.map((_,k)=>this.add.text(0,lineC,'',warText(12,'#a9b9a3')).setOrigin(0,.5).setName('attribute-perk-'+(k+1)).setInteractive({useHandCursor:true}));
        perks={prefix,chips};this.attributePanel.add([prefix,...chips]);
        // 整行（点数条之前）悬停 / 点按：完整说明（ItemTooltip 风格）
        const zone=this.add.zone(left,rowTop,pipX-left-6,H-8).setOrigin(0).setInteractive().setName('attribute-primary-hit');this.attributePanel.addAt(zone,this.attributePanel.getIndex(row)+1);
        const info=()=>primarySummary(this.runConfig.character,this.player?.growth.attributes[id]??0,this.player?.growth.attrMax)?.tip;
        for(const o of [zone,...chips]){attrTip.attachInfo(o,info);o.on('pointerdown',(p:Phaser.Input.Pointer)=>{const it=info();if(!it)return;const q=screenPoint(p);attrTip.showInfo(it,q.x,q.y);});}
      }
      this.attributeRows.push({value,button,plus,pips,pipX,pipY,perks});
    });
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
    const head=text(36,24,'本局构筑',22);if(D)head.setFontFamily(TITLE_FONT).setColor('#efd399').setStroke('#120904',4).setPosition(44,26);root.add(head);
    // 2026-11-18：和行营「将帅帐」共用构筑总览（武将卡 / 战法格 / 流派与觉醒），悬停看说明
    const tip=new ItemTooltip(this,DEPTH.overlay+40);root.once('destroy',()=>tip.destroy());
    drawBuildOverview({scene:this,root,x:D?44:24,y:D?66:70,w:GAME_WIDTH-(D?88:48),h:GAME_HEIGHT-(D?66+82:70+120),desktop:D,prefix:'build-panel',growth:this.player.growth,level:this.player.level,weapon:this.player.weapons[0],tokens:wornTokens(this.runConfig.character),tokenSlots:tokenSlots(),tooltip:tip,training:this.legion.training,respec:{hint:'战斗中不可更改，返回行营休整时可重整'}});
    void b;
    const close=()=>{root.destroy();if(this.mode==='pause')this.pausePanel.setVisible(true);};
    if(D){const back=homeCommand(this,GAME_WIDTH/2,GAME_HEIGHT-46,200,42,'返回');for(const o of [back.g,back.caption,back.hit]){(o as unknown as {setScrollFactor:(n:number)=>void}).setScrollFactor(0);root.add(o);}back.hit.setName('build-panel-back').setData('padDefault',true).on('pointerdown',close);}
    else root.add(text(GAME_WIDTH/2-70,GAME_HEIGHT-46,'返回暂停菜单',17).setPadding(12,8).setInteractive({useHandCursor:true}).on('pointerdown',close));
  }
  /** 加一点属性（手机长条 / 电脑新视图共用）：成功返回 true。 */
  protected attributeAdd(id: AttributeId): boolean {
    const g=this.player.growth;if(!g.allocate(this.player,id))return false;
    this.player.passive.areaMul=g.areaMultiplier();if(g.heroFree>0){g.heroFree--;if(!isChapterTestRun())allocateHeroAttr(this.runConfig.character,id);}
    this.renderAttributePanel();this.updateHud();return true;
  }
  protected renderAttributePanel(): void {
    if (!this.player || !this.attributePointsText) return;
    const growth=this.player.growth;
    {const close=this.attributePanel.getByName('attributes-close') as Phaser.GameObjects.Text|null;close?.setText(this.attributeReturn==='none'?'继续战斗':'返回暂停菜单');if(close&&!close.getData('hitBox')){lqHitBox(close,220,44);close.setData('hitBox',true);}}
    this.attributePointsText.setText(growth.unallocated>0?`可分配属性点 ${growth.unallocated}`:`属性点已用完 · Lv25 前每级 1 点、之后每 2–3 级 1 点（当前 Lv.${this.heroLv}）`).setColor(growth.unallocated>0?(IS_DESKTOP?'#efd399':'#1c160c'):'#91ab98').setBackgroundColor(growth.unallocated>0&&!IS_DESKTOP?'#e2bd6a':'#00000000');if(IS_DESKTOP)this.attributePointsText.setFontFamily(HEADING_FONT).setFontSize(growth.unallocated>0?20:15).setStroke('#120904',growth.unallocated>0?4:0);
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
    if(this.attributeView){
      const ssrc=statSource(this.runConfig.character),statOf=Object.fromEntries(ATTRIBUTE_IDS.map(a=>[a,{base:baseStat(ssrc,a,this.heroLv),baseEquiv:baseEquiv(ssrc,a,this.heroLv),mult:statMultiplier(ssrc,a)}])) as Record<AttributeId,{base:number;baseEquiv:number;mult:number}>;
      this.attributeView.render({stat:statOf,hero:this.runConfig.character,heroName:character.name,level:this.heroLv,free:growth.unallocated,cap:growth.attrMax,points:{...growth.attributes},primary:primaryAttribute(this.runConfig.character),weaponName:weapon?weaponName(weapon.id,this.runConfig.character):'',mastery:growth.masteryLabel(),stats:{damage:damageBonus,attack:attackBonus,crit,hp:Math.round(this.player.hp),maxHp:Math.round(this.player.maxHp),hpBonus,speed:Math.round(this.player.speed),moveBonus}});
      return;
    }
    const ids=Object.keys(ATTRIBUTE_INFO) as AttributeId[];
    for(let i=0;i<ids.length;i++){
      const id=ids[i],level=growth.attributes[id],row=this.attributeRows[i];
      if(!row)continue;
      const cap=growth.attrMax;row.value.setText(level>=cap?'已满':`${level}/${cap}`).setColor(level>=cap?'#e2bd6a':'#e5d4ab');
      row.pips.clear();const step=Math.min(11,110/cap),rh=Math.min(4,step/2-.5);/* 单项上限超过 10（Lv42 起）时格子收窄，总宽仍是 110 */for(let k=0;k<cap;k++){const x=row.pipX+k*step;if(IS_DESKTOP){const cx=x+4,cy=row.pipY,pts=[{x:cx,y:cy-5},{x:cx+rh,y:cy},{x:cx,y:cy+5},{x:cx-rh,y:cy}];row.pips.fillStyle(k<level?0xe2bd6a:0x241a10,1).fillPoints(pts,true).lineStyle(1,k<level?0xfff0c0:0x7a6440,.9).strokePoints(pts,true);continue;}row.pips.fillStyle(k<level?0xe2bd6a:0x2a3328,1).fillRect(x,row.pipY-5,step-3,10).lineStyle(1,k<level?0xfff0c0:0x5d6a58,.9).strokeRect(x+.5,row.pipY-4.5,step-4,9);}
      const can=growth.unallocated>0&&level<cap;
      if(can){row.button.setAlpha(1).setInteractive({useHandCursor:true});}
      else row.button.setAlpha(.38).disableInteractive();
      row.plus.setAlpha(can?1:.45);
      if(row.perks){const sum=primarySummary(this.runConfig.character,level,cap);let x=row.perks.prefix.x+row.perks.prefix.width+10;row.perks.chips.forEach((c,k)=>{const on=!!sum?.tiers[k]?.on;c.setText(sum?.chips[k]??'').setColor(on?'#ffe3a0':'#93a08e').setX(x);x+=c.width+(IS_DESKTOP?14:10);});}
    }
  }

  // ---------------- 性能测试模式（?perf=1，仅 DEV） ----------------

  protected installDevelopment(): void {}
  protected disposeDevelopment(): void {}
  protected updatePerf(_dt: number): void {}
  protected onRunFinished(_stats: RunStats): void {}
}
