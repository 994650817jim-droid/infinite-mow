import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { BALANCE, DEPTH, FONT, HEADING_FONT, actorDepth } from '../config';
import { getBattleChapter, getChapter, type ChapterDef } from '../data/chapters';
import type { EnemyDef } from '../data/enemies';
import { GAUNTLET, GAUNTLET_MOVES, GAUNTLET_POOL, GAUNTLET_TROOPS, type GauntletArc, type GauntletProps, endlessBoss, gauntletReward, pickBosses, readGauntletBest, unlockedPool, waveScale, writeGauntletBest, type GauntletBoss } from '../data/gauntlet';
import { ARC_CHAPTER, guardDef, troopChapter, troopTextures, waveTroopSet, type TroopKind } from '../data/gauntletTroops';
import { BOSS_MOVES, type BossMovesetDef } from '../data/bossMoves';
import { supplyOption } from '../data/upgrades';
import { arcPalette, thirdBattle } from '../data/thirdChapter';
import { GUANDU_ATLAS_FILES, GUANDU_STAGES, guanduBattle, guanduYuanSourceKeys } from '../data/guanduChapter';
import { chibiBattle } from '../data/chibiChapter';
import { JINGNAN_SHEETS, jingnanBattle, jingnanTexture } from '../data/jingnanChapter';
import { HANZHONG_SHEETS, hanzhongBattle, hanzhongTexture } from '../data/hanzhongChapter';
import { YILING_SHEETS, yilingBattle, yilingTexture } from '../data/yilingChapter';
import { BEIFA_SHEETS, beifaBattle, beifaTexture } from '../data/beifaChapter';
import { SHU_TROOPS, shuArt } from '../data/shuChapter';
import { XF_TROOPS, xfArt } from '../data/xiangfanChapter';
import { NZ_TROOPS, nzArt } from '../data/nanzhengChapter';
import { siegeSourceKeys } from '../data/siege';
import { ensureFactionTextures, type PaletteId } from '../systems/FactionPalette';
import { ensureYuanTextures } from '../systems/YuanPalette';
import { MECH_FLAGS } from '../data/mechanicUnlocks';
import { BuildState } from '../data/builds';
import { WEAPON_OVER } from '../data/weaponBranches';
import { RunGrowth, attributeCap, type AttributeId } from '../systems/RunGrowth';
import { emptyGear } from '../systems/ItemEffects';
import { SHU_CONFIG } from './ShuGameScene';
import { XIANGFAN_CONFIG } from './XiangfanGameScene';
import { NANZHENG_CONFIG } from './NanzhengGameScene';
import { BossMoveset } from '../systems/BossMoveset';
import { YuanshuBoss } from '../systems/YuanshuBoss';
import { DongzhuoBoss } from '../systems/DongzhuoBoss';
import { SimayiBoss } from '../systems/SimayiBoss';
import { Strikes } from '../systems/BeifaSystems';
import { ensureHeroSkillFx, playSheet } from '../systems/SkillFxSheets';
import { warnFx } from '../ui/WarnFx';
import { HILL_ART } from '../data/hanzhongChapter';
import { SMY } from '../data/beifaChapter';
import { ensureTroopArt } from '../systems/TroopArt';
import { CaorenBoss } from '../systems/CaorenBoss';
import { GuanduBoss } from '../systems/GuanduBoss';
import type { ArcHost } from '../systems/ArcBossV2';
import { ART_V2_FILES, isV2Texture, loadBossSheet, loadV2TroopSheets } from '../systems/ArtStyle';
import { isChapterTestRun } from '../systems/ChapterProgress';
import { stageCleared } from '../systems/HeroProgress';
import { addScrolls } from '../systems/MasteryStore';
import { addProvisions } from '../world/WorldStore';
import { FollowerSquad, type Follower } from '../systems/FollowerSquad';
import { GauntletTrack } from '../ui/GauntletTrack';
import { FOLLOWER_ATTACK_SFX } from '../systems/HeroSfx';
import type { Recruit } from '../systems/RosterStore';
import type { Enemy } from '../entities/Enemy';
import { CHARACTERS, type RunConfig } from '../data/characters';
import type { RunEndReason, UpgradeOption } from '../types';
import type { FollowerTemplate } from '../data/recruits';

/** 名将的首领图与战役数值：图键、要载的图、首领数值、这一章的首领风格（bossStyle）、画法（arc = 4×8 首领图 / walk = 四方向行走表）。 */
interface BossArt { tex: string; sheet?: string; def: EnemyDef; style: ChapterDef['bossStyle']; layout: 'arc' | 'walk' }
/** 名将出招控制器（专属 / 招式框架）：场景每帧推、受伤倍率、倒地。 */
interface GCtrl { readonly state?: string; update(dt: number, now: number): void; clear(): void; defeat?(): void; updateDeath?(delta: number): void; incoming?(ally: boolean): number; hit?(now: number): void; readonly label?: string }

/** 副将用什么兵器模板（随行系统的四种出手：枪扫 / 刀扇 / 弓射 / 谋火）。 */
const TEMPLATE: Record<string, FollowerTemplate> = { xiahouyuan: 'blade', luxun: 'strategist', simayi: 'strategist', wutugu: 'blade', dongzhuo: 'blade', wenchou: 'spear', huaxiong: 'blade', xurong: 'blade', yanliang: 'blade', yanghuai: 'blade', zhangren: 'bow', pangde: 'blade', sunhuan: 'blade', mangyachang: 'blade', zhurong: 'bow', zhanghe: 'spear', zhangliang: 'blade', zhangbao: 'strategist', lijue: 'blade', guosi: 'blade', zhangxiu: 'spear', caochun: 'blade', caimao: 'bow', zhaofan: 'bow', liudu: 'blade', huangzhong: 'bow', zhangjiao: 'strategist', lubu: 'spear', yuanshu: 'blade', chunyuqiong: 'blade', caoren: 'blade', hanxuan: 'blade', liuzhang: 'strategist', caocao: 'blade', lvmeng: 'blade', zhuran: 'spear', menghuo: 'blade', haozhao: 'bow' };

/**
 * 按适配表改招（本模式每位最多 3 招）：drop 去掉的招（招名，两个阶段都拿掉；某阶段删空了保留原样）、add 加的招、p2Boost 二阶段移速 / 招式伤害加成。
 */
function adaptMoves(d: BossMovesetDef, b: GauntletBoss): BossMovesetDef {
  const drop = b.drop ?? [], f = (m: BossMovesetDef['p1']['moves']) => { const k = m.filter(x => !drop.includes(x.name)); return k.length ? k : m; };
  const p1 = { ...d.p1, moves: [...f(d.p1.moves), ...(b.add?.p1 ?? [])] }, p2 = { ...d.p2, moves: [...f(d.p2.moves), ...(b.add?.p2 ?? [])] };
  const boost = b.p2Boost; if (boost) { p2.speedMul *= boost.speed; p2.moves = p2.moves.map(m => ({ ...m, dmg: m.dmg * boost.dmg })); }
  return { ...d, p1, p2 };
}

/**
 * 随身布置用的现成图（适配表 gauntlet-roster.md）：粮垛 / 辎重车 = 官渡焚粮目标同一张道具图集（yellow_props）；城门 / 箭楼 = 攻城 v2 城墙图集（带毁坏帧）；
 * 火油罐 = 第四批新图；营帐 / 营垒 = 环境道具图集 env_props（本模式没有环境互动系统，营帐自己摆）。
 */
const PROP_ART: Record<GauntletProps['art'] | 'fort', { key: string; frame: number; broken?: number; size: number; radius: number }> = {
  tent: { key: 'env_props', frame: 8, broken: 12, size: 150, radius: 52 }, fort: { key: 'env_props', frame: 11, broken: 15, size: 150, radius: 52 }, // 营帐 / 营垒：环境道具图集（8+势力 立着、12+势力 塌了；营垒用魏军 3）
  granary: { key: 'yellow_props', frame: 1, size: 120, radius: 40 }, cart: { key: 'yellow_props', frame: 24, size: 100, radius: 34 }, // 同官渡焚粮目标（BattlefieldSupplies.spawnDepot 用 yellow_props：1 乌巢粮仓、24 袁军辎重）
  gate: { key: 'siege_mid_walls', frame: 1, broken: 2, size: 170, radius: 60 }, tower: { key: 'siege_mid_walls', frame: 3, broken: 4, size: 170, radius: 46 },
  jar: { key: 'gauntlet_oil_jar', frame: 0, broken: 1, size: 90, radius: 26 },
};
/** 董卓那阵的吕布护卫（弱化：步战、一招方天横扫；1/3 血退场，见 GauntletEscort）。 */
const LUBU_ESCORT: BossMovesetDef = { id: 'lubu', name: '吕布', phaseAt: .2,
  p1: { name: '飞将护驾', caption: '方天横扫', gapMs: 2600, speedMul: 1, moves: [{ kind: 'sweep', name: '方天横扫', windupMs: 650, cd: 3400, dmg: 1, r: 135, arc: Math.PI * .9 }] },
  p2: { name: '飞将护驾', caption: '方天横扫', gapMs: 2600, speedMul: 1, moves: [{ kind: 'sweep', name: '方天横扫', windupMs: 650, cd: 3400, dmg: 1, r: 135, arc: Math.PI * .9 }] } };

/** 名将登场的水墨横幅（GameScene.announceBoss：0.25 秒淡入、2.3 秒起淡出 0.4 秒）多长：这段时间顶部只留它。 */
const GAUNTLET_INK_MS = 2700;
/** 名将登场至少空出几个敌人位（名将 1 + 亲兵 4 + 随身布置最多 4 + 护卫 1，再留几个给他号令来的兵）。 */
const GAUNTLET_BOSS_ROOM = 14;
/** 进度条斩将盖的朱印贴图键（结局麒麟阁同一张 seal_red_2）。 */
const SEAL_KEY = 'ending_seal_red';

/** 每位名将的首领图与战役数值（从各章的数据 / 场景配置取，和战役里同一张图、同一份数值）。 */
function bossArt(b: GauntletBoss): BossArt {
  const arc = (c: ChapterDef, tex: string, sheet: string | undefined): BossArt => ({ tex, sheet, def: { ...c.enemies.boss, texture: tex }, style: c.bossStyle, layout: 'arc' });
  switch (b.arc) {
    case 'huangjin': { const c = getBattleChapter('huangjin', b.stage), d = c.enemies.boss; return { tex: d.walkVisual?.texture ?? d.texture, def: d, style: c.bossStyle, layout: 'walk' }; }
    case 'hulao': {
      if (b.id === 'lubu') { const c = getChapter('hulao'); return { tex: c.enemies.boss.texture, def: c.enemies.boss, style: 'lubu', layout: 'walk' }; }
      if (b.id === 'dongzhuo') { const c = getBattleChapter('hulao', 1, 3); return { tex: 'dongzhuo_walk', def: c.enemies.boss, style: 'siege', layout: 'walk' }; }
      // 华雄 / 徐荣按关取（华雄四方向行走表；徐荣 4×8 首领图）
      const c = getBattleChapter('hulao', 1, b.stage), d = c.enemies.boss; return { tex: d.walkVisual?.texture ?? d.texture, def: d, style: c.bossStyle, layout: b.id === 'xurong' ? 'arc' : 'walk' };
    }
    case 'qunxiong': return arc(thirdBattle(b.stage), 'third_' + b.id, 'assets/phase23/' + (b.id === 'guosi' ? 'lijue' : b.id) + '.png');
    case 'guandu': { const atlas = GUANDU_STAGES[b.stage - 1].atlas, c = guanduBattle(b.stage); return { ...arc(c, atlas, GUANDU_ATLAS_FILES[atlas]), def: { ...c.enemies.boss, texture: atlas } }; }
    case 'chibi': return arc(chibiBattle(b.stage), 'chibi_' + b.id, 'assets/chibi/' + b.id + '.png');
    case 'jingnan': { const t = jingnanTexture(b.id); return arc(jingnanBattle(b.stage), t, JINGNAN_SHEETS[t]); }
    case 'shu': return arc(SHU_CONFIG.battle(b.stage), SHU_CONFIG.texture(b.id), SHU_CONFIG.sheet(b.id));
    case 'hanzhong': { const t = hanzhongTexture(b.id); return arc(hanzhongBattle(b.stage), t, HANZHONG_SHEETS[t]); }
    case 'xiangfan': return arc(XIANGFAN_CONFIG.battle(b.stage), XIANGFAN_CONFIG.texture(b.id), XIANGFAN_CONFIG.sheet(b.id));
    case 'yiling': { const t = yilingTexture(b.id); return arc(yilingBattle(b.stage as 1 | 2 | 3), t, YILING_SHEETS[t]); }
    case 'nanzheng': return b.id === 'zhurong' ? arc(NANZHENG_CONFIG.battle(3), 'nz_zhurong', GUANDU_ATLAS_FILES.guandu_chunyuqiong) /* 祝融 v2 专属图（v1 回退借淳于琼，同南征场景） */ : arc(NANZHENG_CONFIG.battle(b.stage), NANZHENG_CONFIG.texture(b.id), NANZHENG_CONFIG.sheet(b.id));
    case 'beifa': { const t = beifaTexture(b.id); return arc(beifaBattle(b.stage as 1 | 2 | 3), t, BEIFA_SHEETS[t]); }
  }
}

/** 本模式要用到哪几章哪一关的兵：十阵兵种表 + 名将池各位自己那一章（亲兵用他那一章的兵；曹仁后段那套也算）。 */
function troopSources(): Array<{ arc: GauntletArc; stage: number }> {
  const out = new Map<string, { arc: GauntletArc; stage: number }>(), add = (arc: GauntletArc, stage: number) => out.set(arc + stage, { arc, stage });
  for (const t of GAUNTLET_TROOPS) { add(t.arc, t.stage); if (t.look) add(t.look.arc, t.look.stage); }
  for (const b of GAUNTLET_POOL) { add(b.arc, b.stage); if (b.late) add(b.late.arc, b.late.stage); }
  return [...out.values()];
}
let troopKeyCache: string[] | null = null;
/** 这些兵的图键（行走 / 攻击；换色键 f_ / yuan_ 在 create 里现生成）。 */
function troopArtKeys(): string[] { return troopKeyCache ??= [...new Set(troopSources().flatMap(s => troopTextures(troopChapter(s.arc, s.stage))))]; }
/** 各章自己按 176 格载的兵种行走表（蜀 / 襄樊 / 南中，同各章场景）。 */
function gridTroops(): Array<{ walk: string; file: string }> {
  return [...Object.values(SHU_TROOPS).filter(t => shuArt(t.walk)), ...Object.values(XF_TROOPS).filter(t => xfArt(t.walk)), ...Object.values(NZ_TROOPS).filter(t => nzArt(t.walk))];
}
/** 176 格行走表切成四方向帧（同蜀 / 襄樊 / 南中场景的 registerV2Frames）。 */
function gridFrames(scene: Phaser.Scene, key: string): void {
  const tex = scene.textures.get(key); if (tex.has('down_0')) return;
  ['down', 'left', 'right', 'up'].forEach((dir, row) => { for (let col = 0; col < 4; col++) tex.add(`${dir}_${col}`, 0, col * 176, row * 176, 176, 176); });
}

/**
 * 名将连战（data/gauntlet.ts；共享笔记 gauntlet-v1.md、gauntlet-build.md）：开阔场地，无行营 / 无剧情 / 无整军（不带部曲、不带随从），
 * 十阵：割草 GAUNTLET.mowSec 秒 → 名将带亲兵登场（杂兵刷新量减半）→ 斩将后清场、战利品三选一 → 下一阵；第十阵守关名将，通关后可继续无尽。
 * 杂兵按阵从第一章的兵换到第十二章的兵（data/gauntletTroops.ts）；从 0 开局（11-21）：主将 1 级白板、不带任何战役成长，卡池全开，局内经验不写回；
 * 不掉战役兵装（lootBlocked + 不建掉落）；不记战役进度（encounter）。
 */
export function gauntletGameSceneClass(Base: typeof GameScene) {
  return class GauntletGameScene extends Base {
    constructor() { super('GauntletGameScene'); }
    /** 本局：第几阵（1 起）、阶段与进入时刻（关内秒）、十阵名单、当前名将、斩过的名将、是否已通关十阵 / 进了无尽。 */
    gWave = 1; gPhase: 'mow' | 'boss' | 'clear' | 'choice' | 'done' = 'mow'; gAt = 0; gOrder: GauntletBoss[] = []; gCur: GauntletBoss | null = null;
    gKills: GauntletBoss[] = []; gCleared = false; gEndless = false; private gPool: GauntletBoss[] = [];
    private gCtrl: GCtrl | null = null; private gLootShown = false; private gEliteAt = 0; private gFollowers: Array<{ f: Follower; boss: GauntletBoss }> = [];
    /** 从哪进来的（结算「返回」回哪）：主菜单 / 天下地图（开发直进算天下地图）。 */
    gFrom: 'menu' | 'map' = 'map';
    private gPendingReplace: GauntletBoss | null = null; private gTrack: GauntletTrack | null = null; private gStrikes: Strikes | null = null; private gPortrait = new Map<string, string>();
    /** 测试读：帧率采样（三位副将 + 名将 + 割草同屏）。 */
    gStats = { lootPicks: [] as string[], spawned: 0, cleared: 0 };

    preload() {
      (Base.prototype as unknown as { preload?: () => void }).preload?.call(this); // 基类（开发构建的 DevGameScene）有 preload 就先跑
      // 名将池的首领图都先载好（第一 / 二章的张梁、张宝、张角、华雄、徐荣、吕布开机就有）
      for (const b of unlockedPool(() => true, true)) { const a = bossArt(b); if (a.sheet && !this.textures.exists(a.tex)) loadBossSheet(this.load, a.tex, a.sheet); }
      if (!this.textures.exists(HILL_ART[0].key)) this.load.image(HILL_ART[0].key, HILL_ART[0].url); // 高地圈（汉中山头同一张图）
      if (!this.textures.exists('gauntlet_oil_jar')) this.load.spritesheet('gauntlet_oil_jar', 'assets/props/gauntlet_oil_jar.png', { frameWidth: 256, frameHeight: 256 }); // 兀突骨火油罐（美术 11-21：完好 / 碎裂）
      if (!this.textures.exists('siege_mid_walls')) this.load.spritesheet('siege_mid_walls', 'assets/siege-v2/walls.png', { frameWidth: 384, frameHeight: 384 }); // 随身城门 / 箭楼（攻城 v2 城墙图集）
      if (!this.textures.exists(SEAL_KEY)) this.load.image(SEAL_KEY, 'assets/ending/seal_red_2.png'); // 进度条斩将盖的朱印（结局麒麟阁同一枚，缩小用）
      // 每阵杂兵 / 名将亲兵用到的各章兵种图（data/gauntletTroops.ts）：蜀 / 襄樊 / 南中按 176 格载，其余 v2 兵种表走 loadV2TroopSheets（同各章场景）
      const keys = troopArtKeys(), grid = gridTroops(), gridKeys = new Set(grid.map(t => t.walk));
      for (const t of grid) if (keys.includes(t.walk) && !this.textures.exists(t.walk)) this.load.spritesheet(t.walk, t.file, { frameWidth: 176, frameHeight: 176 });
      loadV2TroopSheets(this, keys.filter(k => !gridKeys.has(k) && Object.prototype.hasOwnProperty.call(ART_V2_FILES, k) && isV2Texture(k))); // 只载有文件的原图；换色派生键（f_ / yuan_ / readable_）isV2Texture 也认，但要 create 里现生成，载了会报错并把源图记成缺失
    }
    /** 进来前的全局开关 / 上限（卡池全开时改了，离开场景放回）。 */
    private gSaved: { mech: boolean; rank: number; slot: number; extra: number; over: number } | null = null;
    /**
     * 卡池全开（用户 11-21「3 选 1 什么都有」）：不按主线进度藏玩法（MECH_FLAGS，同开发全开）、战法精研 / 战法格 / 武艺精熟 / 专职精进上限按第十二章给。
     * 这几样是全局静态值（主线五段关进关时按章重设，攻城 / 支线等不重设），离开本模式必须放回。
     */
    private openPool(): void {
      if (!this.gSaved) this.gSaved = { mech: MECH_FLAGS.allMechanics, rank: BuildState.rankCap, slot: BuildState.slotCap, extra: RunGrowth.extraCap, over: WEAPON_OVER.cap };
      MECH_FLAGS.allMechanics = true; BuildState.rankCap = BuildState.rankCapFor(12); BuildState.slotCap = BuildState.slotCapFor(12); RunGrowth.extraCap = RunGrowth.extraCapFor(12); WEAPON_OVER.cap = WEAPON_OVER.capFor(12);
    }
    private closePool(): void {
      const s = this.gSaved; if (!s) return; this.gSaved = null;
      MECH_FLAGS.allMechanics = s.mech; BuildState.rankCap = s.rank; BuildState.slotCap = s.slot; RunGrowth.extraCap = s.extra; WEAPON_OVER.cap = s.over;
    }
    /** 各章换色兵（凉州 / 曹魏 / 荆南 / 益州 / 孙吴……、袁军）现生成，四方向切帧：须在任何敌兵生成前就绪。 */
    private ensureTroopArt(): void {
      const src = troopSources(), pals = new Set<PaletteId>();
      for (const s of src) { const p = arcPalette(s.arc, Math.max(1, Math.min(3, s.stage)) as 1 | 2 | 3); if (p) pals.add(p); }
      for (const p of pals) ensureFactionTextures(this, p, siegeSourceKeys());
      if (src.some(s => s.arc === 'guandu')) ensureYuanTextures(this, guanduYuanSourceKeys());
      for (const t of gridTroops()) if (this.textures.exists(t.walk)) gridFrames(this, t.walk);
    }
    create() {
      const saved = this.registry.get('runConfig') as RunConfig | undefined;
      this.gFrom = this.registry.get('gauntletFrom') === 'menu' ? 'menu' : 'map';
      this.registry.remove('campaignTransfer'); this.registry.remove('worldCampaign'); // 无行营 / 无整军：不带部曲、不读征程构筑
      this.registry.set('runConfig', { ...saved, character: saved?.character ?? 'zhaoyun', chapter: 'hulao', westStage: 3, encounter: 'qunxiong' }); // encounter：不建剧情、不记战役进度、不建西凉专属机制（同篇章场景）
      this.gWave = 1; this.gPhase = 'mow'; this.gAt = 0; this.gKills = []; this.gCleared = false; this.gEndless = false; this.gCtrl = null; this.gLootShown = false; this.gFollowers = []; this.gPendingReplace = null; this.gResult = null; this.gPortrait.clear();
      this.gStats = { lootPicks: [], spawned: 0, cleared: 0 };
      const test = isChapterTestRun();
      const heroName = CHARACTERS.find(c => c.id === (saved?.character ?? 'zhaoyun'))?.name, pool = unlockedPool(k => stageCleared(k), test);
      this.gPool = pool.filter(b => b.name !== heroName).length ? pool.filter(b => b.name !== heroName) : pool; // 本局主将同名的名将不出（主将黄忠 / 孟获 / 祝融……）
      this.gOrder = pickBosses(this.gPool);
      // 从 0 开局 + 卡池全开（基类 create 里按 mechOpen 建系统、读卡池上限，所以先开）；各章兵种换色图先备好
      const F = GAUNTLET.from0; this.gRerollFree = F.freeRerolls; this.gRerollPaid = 0; this.gExcludes = F.excludes; this.gExcluded.clear(); this.gExcluding = false; this.gExcludeBtn = null;
      this.openPool(); this.events.once('shutdown', () => this.closePool());
      this.ensureTroopArt();
      super.create();
      // 不带随从（副将位只给本局收的名将）、不掉战役兵装
      this.followers?.clear(); this.followers = null;
      this.itemDrops = null;
      this.chapter = this.makeChapter(this.gOrder[0]);
      this.bossWarned = true; this.gEliteAt = GAUNTLET.eliteFirst;
      this.hudTexts.chapter.setText(''); // 关名不写（见 updateTrack）
      this.time.delayedCall(500, () => { if (!this.over) this.showWaveBanner('名将连战 · 第 1 阵', false, `敌军 ${waveTroopSet(1).troops.name} · 割草 ${GAUNTLET.mowSec} 秒后名将登场 · 共 ${GAUNTLET.waves} 阵`); });
      this.moveDevBadge();
      this.gTrack?.destroy(); this.gTrack = new GauntletTrack(this, GAUNTLET.waves, 'hud_medal2_' + this.runConfig.character, SEAL_KEY); this.gTrack.setWave(1, true);
      this.gStrikes = new Strikes({ scene: this, player: this.player, army: this.legion, now: () => this.combatNow }); // 地面落点打击（手绘预警圈 → 命中序列帧）：郝昭箭楼、司马懿
      if (this.gPool.some(b => b.id === 'dongzhuo')) ensureTroopArt(this, ['dongzhuo_walk', 'dongzhuo_attack']); // 董卓行走 / 攻击图（同 2-3，按需载入）
      this.events.once('shutdown', () => { this.gCtrl?.clear(); this.gCtrl = null; this.gTrack?.destroy(); this.gTrack = null; this.clearProps(); this.clearEscort(); this.clearHill(); this.clearBand(); this.gStrikes?.clear(); this.gStrikes = null; });
    }
    /** 自定关：不进战役关卡逻辑（剧情、进度、段落、招降都按自定关跳过）。 */
    protected customChapter() { return this.chapter?.name === '名将连战' ? this.chapter : { ...this.makeChapter(this.gOrder[0] ?? unlockedPool(() => true, true)[0]), bossStyle: 'lubu' as const }; } // 开局建场景时用中性的首领风格：华雄 / 徐荣的风格会让基类搭汜水关城墙、荥阳伏兵营
    protected phaseEligible() { return false; }
    protected lootBlocked() { return true; }
    protected victoryLabel() { return this.gEndless ? '无尽止步' : '十阵通关'; }

    // ———— 从 0 开局（用户 11-21「名将挑战是从 0 开始 build 起来」「全新从 0 开始的不继承主剧情的 build」）————
    // 主将 1 级、加点 0；不带星图 / 兵装 / 信物 / 坐骑 / 武将谱（本命淬炼、战法心得）/ 城建 / 部曲；专属兵器与招牌被动照有（武将自带）。
    // 局内升级照给加点和三选一，等级 / 经验不写回武将存档；结算只写钱币、武学残卷和最高连斩（finish）。
    protected campaignGear() { return emptyGear(); }
    protected campaignCharms(): ReturnType<GameScene['campaignCharms']> { return []; }
    protected campaignHorse() { return undefined; }
    protected persistHeroProgress(): boolean { return false; }
    protected lordHeroXp(): number { return 0; }
    protected heroXpRate(): number { return GAUNTLET.from0.xpRate; }
    stageSuggestedLevel(): number { return GAUNTLET.from0.softLevel + 2 * Math.max(0, (this.gWave ?? 1) - GAUNTLET.waves); } // 无尽每阵软上限 +2，等级还能慢慢涨
    protected applyHeroLevel(_carried: boolean): void {
      ensureHeroSkillFx(this, this.runConfig.character);
      const g = this.player.growth; this.heroLv = 1; g.heroLevel = 1; g.attrMax = attributeCap(1);
      for (const a of Object.keys(g.attributes) as AttributeId[]) g.attributes[a] = 0;
      g.heroFree = 0; g.unallocated = 0; g.temperDamage = 0; g.xinde = []; g.xindeFirst = false; // 星图不读（新建的局内成长本来就没有星）
      this.player.passive.areaMul = g.areaMultiplier(); this.player.hp = this.player.maxHp;
    }
    protected syncHeroLevel(): void {
      this.player.level = 1; this.player.xp = 0; this.heroLv = 1; this.heroStartLevel = 1;
      this.player.softLevel = 0; this.refreshSoftLevel(); this.player.xpNext = this.player.needFor(1); this.player.hp = this.player.maxHp;
    }
    /** 新卡按第十二章那档出（新卡替换率 0.4、各类权重都开）；「名将来投」按本阵兵种那一章的时代。 */
    protected newCardChapter(): number { return 12; }
    protected newCardEra(): number { return ARC_CHAPTER[waveTroopSet(this.gWave).troops.arc]; }
    /** 三选一节奏：前期升级快，两次面板最短隔 pickGapSec 秒（中间升的级攒着连选）。 */
    protected pickGapOk(): boolean { return this.forcePickNow || this.elapsed - this.lastPickAt >= GAUNTLET.from0.pickGapSec; }

    // ———— 换一批 / 排除（掌控感）：每局 2 次免费换一批，之后花钱币、逐次涨价；每局 1 次排除（点一张卡，本局不再出现）————
    private gRerollFree = 0; private gRerollPaid = 0; private gExcludes = 0; private gExcluded = new Set<string>(); private gExcluding = false;
    private gExcludeBtn: Phaser.GameObjects.Text | null = null;
    protected rerollCost(): number { return this.gRerollFree > 0 ? 0 : GAUNTLET.from0.rerollBase + GAUNTLET.from0.rerollStep * this.gRerollPaid; }
    protected rerollLabel(cost: number): string { return this.gRerollFree > 0 ? `换一批 · 免费（本局还剩 ${this.gRerollFree} 次）` : `换一批 · ${cost} 钱币`; }
    protected rerollSpent(cost: number): void { if (this.gRerollFree > 0) this.gRerollFree--; else { this.legion.food -= cost; this.gRerollPaid++; } }
    /** 三选一：排除过的卡不出（缺的位置重抽补上）。 */
    protected upgradeChoices(): UpgradeOption[] {
      let out = super.upgradeChoices().filter(o => !this.gExcluded.has(o.id));
      for (let i = 0; i < 12 && out.length < 3; i++) for (const o of super.upgradeChoices()) if (out.length < 3 && !this.gExcluded.has(o.id) && !out.some(x => x.id === o.id)) out.push(o);
      if (!out.length) out = super.upgradeChoices();
      return out;
    }
    protected chooseUpgrade(index: number): void {
      if (!this.gExcluding || this.mode !== 'levelup') { super.chooseUpgrade(index); return; }
      const o = this.upgradeOptions[index]; if (!o) return;
      this.gExcluding = false; this.gExcludes--; this.gExcluded.add(o.id);
      const rep = this.upgradeChoices().find(x => !this.upgradeOptions.some(y => y.id === x.id));
      if (rep) this.upgradeOptions[index] = rep; else this.upgradeOptions.splice(index, 1);
      this.showGrowthNotice(`已排除「${o.name}」· 本局不再出现`); this.renderCards();
    }
    protected renderCards(): void { super.renderCards(); this.paintExclude(); }
    protected setMode(mode: Parameters<GameScene['setMode']>[0]): void { if (mode !== 'levelup') this.gExcluding = false; super.setMode(mode); this.paintExclude(); }
    /** 排除按钮：在「换一批」左边，同一套字样；只在升级三选一时显示。 */
    private paintExclude(): void {
      const panel = this.levelPanel, rr = panel?.getByName('upgrade-reroll') as Phaser.GameObjects.Text | null; if (!panel || !rr) return;
      let b = this.gExcludeBtn;
      if (!b || !b.scene) {
        const st = rr.style;
        b = this.add.text(0, 0, '', { fontFamily: st.fontFamily, fontSize: st.fontSize, color: st.color as string, resolution: 2 }).setOrigin(1, 0).setPadding(16, 10).setStroke(st.stroke as string, st.strokeThickness).setShadow(0, 1, '#0a0603', 2, true, true).setName('gauntlet-exclude')
          .setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (this.mode === 'levelup' && this.gExcludes > 0) { this.gExcluding = !this.gExcluding; this.paintExclude(); } });
        panel.add(b); this.gExcludeBtn = b;
      }
      b.setText(this.gExcluding ? '点一张卡排除 · 再点这里取消' : this.gExcludes > 0 ? `排除一张 · 本局 ${this.gExcludes} 次` : '排除 · 本局已用完').setColor(this.gExcluding ? '#ff9b7a' : rr.style.color as string).setAlpha(this.gExcludes > 0 ? 1 : .5);
      b.setPosition(rr.x - rr.displayWidth - 6, rr.y).setVisible(this.mode === 'levelup' && rr.visible);
    }

    /**
     * 这一阵的关卡定义：杂兵 = 每阵兵种表借的那一章（data/gauntletTroops.ts：兵种 / 外形 / 配比照搬、强度按表折算且逐阵单调），
     * 首领 = 这一阵的名将（他自己的图与招式；生命 / 伤害按表）。刷兵节奏统一用第二章的（按阵往后推、再乘 count）。
     */
    private makeChapter(b: GauntletBoss): ChapterDef {
      const base = getChapter('hulao'), W = waveTroopSet(this.gWave), T = W.troops, src = W.chapter, art = bossArt(b), d = art.def;
      const boss: EnemyDef = { ...d, kind: 'boss', hp: T.bossHp, damage: T.bossDmg };
      const t0 = 45 + (this.gWave - 1) * 30; // 刷兵节奏按阵往后推（间隔越来越短）
      return { ...base, name: '名将连战', label: '名将连战', description: '割草 · 斩将 · 连战', bossName: b.name, bossStyle: art.style, stage: undefined, westStage: undefined,
        waves: [{ name: '名将连战', start: 0 }], recruitWaves: [], enemies: { ...src.enemies, ...W.defs, boss }, objective: undefined, bossAtStart: false, enemyCap: BALANCE.enemyCap,
        hpScale: () => 1, growth: { hp: 1, damage: 1 }, pace: 1,
        spawnInterval: t => base.spawnInterval(t + t0), spawnBurst: t => base.spawnBurst(t + t0), pickEnemy: t => src.pickEnemy(t + 20), // 配比取那一关中段（各关开头只出步卒）
        victoryTitle: '名将连战', victoryText: '十阵连斩' };
    }
    /** 名将的亲兵 / 号令来的兵：用他自己那一章的兵（外形），强度按本阵；那一章的图没备好就用本阵的兵。 */
    private guard(kind: TroopKind): EnemyDef | undefined {
      const b = this.gCur; if (!b) return undefined;
      const g = guardDef(b.arc, b.stage, kind, this.gWave), tex = g.walkVisual?.texture ?? g.texture;
      return this.textures.exists(tex) ? g : undefined;
    }
    /** 这一阵割草开始到现在几秒。 */
    private get waveT(): number { return Math.max(0, this.elapsed - this.gAt); }

    // ———— 刷兵：割草按阵加强；名将在场刷新量减半；清场 / 抉择时不刷 ————
    protected updateSpawner(dt: number): void {
      if (this.gPhase !== 'mow' && this.gPhase !== 'boss') return;
      const sc = waveScale(this.gWave), bossOn = this.gPhase === 'boss' && !!this.boss?.active, cap = BALANCE.enemyCap, t = this.gPhase === 'mow' ? this.waveT : GAUNTLET.mowSec;
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.activeEnemyCount() < cap) {
        this.spawnTimer = this.chapter.spawnInterval(t) / sc.count * (bossOn ? GAUNTLET.bossInterval : 1);
        const burst = Math.max(1, Math.round(this.chapter.spawnBurst(t) * sc.count * (bossOn ? GAUNTLET.bossBurst : 1)));
        for (let i = 0; i < burst; i++) { if (this.activeEnemyCount() >= cap) break; if (!this.spawnAroundPlayer(this.chapter.pickEnemy(t))) break; this.gStats.spawned++; }
      }
      if (this.gPhase === 'mow' && this.waveT >= this.gEliteAt) { this.gEliteAt = this.waveT + GAUNTLET.eliteEvery; this.spawnAroundPlayer('elite', true); }
    }

    // ———— 阶段推进 ————
    update(time: number, delta: number) {
      super.update(time, delta);
      this.gCtrl?.updateDeath?.(delta);
      if (this.over || !this.player?.alive) return;
      this.hudTexts.wave.setText(''); // 阵数看顶部十阵进度条（总制作人 11-21：去掉左上角那行，兵力行保留）
      this.updateTrack();
      if (this.mode !== 'none') return;
      this.gStrikes?.update();
      if (this.gPhase === 'mow' && this.waveT >= GAUNTLET.mowSec) this.startBoss();
      else if (this.gPhase === 'boss' && !this.boss?.active && !this.bossKilled) this.spawnBoss(); // 首领没刷出来（落点被挡）：下一帧再试
      else if (this.gPhase === 'clear') {
        if (!this.gLootShown && this.waveT >= 1.8) { this.gLootShown = true; this.openLoot(); }
        else if (this.gLootShown && this.waveT >= GAUNTLET.clearSec) { if (this.gWave === GAUNTLET.waves && !this.gEndless) this.openClearChoice(); else this.nextWave(); }
      }
    }
    /** 开发构建：左上的 DEV 徽标会盖住进度条左端——本模式下挪到左下（兵力 / 增益栏下面、FPS 行上面），离开场景放回原处。正式版没有这个徽标。 */
    private moveDevBadge(): void {
      if (!import.meta.env.DEV || typeof document === 'undefined') return;
      const el = document.getElementById('dev-panel'); if (!el) return;
      const left = el.style.left, top = el.style.top;
      el.style.left = '6px'; el.style.top = Math.max(2, window.innerHeight - 112) + 'px'; // 左下、FPS 行上面
      this.events.once('shutdown', () => { el.style.left = left; el.style.top = top; });
    }
    /** 进度条线下的小字：第 N/10 阵 · 距名将登场 mm:ss / 名将名字 / 已斩；无尽写「无尽 · 第 N 阵」。 */
    private waveLine(): string {
      const n = this.gEndless || this.gWave > GAUNTLET.waves ? `无尽 · 第 ${this.gWave} 阵` : `第 ${this.gWave}/${GAUNTLET.waves} 阵`;
      if (this.gPhase === 'mow') { const left = Math.max(0, Math.ceil(GAUNTLET.mowSec - this.waveT)); return `${n} · 距名将登场 ${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`; }
      if (this.gPhase === 'boss') return `${n} · ${this.gWave === GAUNTLET.waves && !this.gEndless ? '守关 · ' : ''}${this.gCur?.name ?? ''}`;
      return `${n} · 已斩 ${this.gKills[this.gKills.length - 1]?.name ?? ''}`;
    }
    /** 十阵进度条：割草时标按时间从上一节点匀速走向这一阵的节点（走到头 = 名将登场），名将在场 / 斩将后停在节点。 */
    private updateTrack(): void {
      const t = this.gTrack; if (!t) return;
      const W = GAUNTLET.waves, local = ((this.gWave - 1) % W) + 1;
      const pos = this.gPhase === 'mow' ? (local - 1 + Math.min(1, this.waveT / GAUNTLET.mowSec)) / W : local / W;
      t.update(pos, this.gPhase === 'boss' && !!this.boss?.active, this.waveLine());
      // 显隐自己每帧定（不跟着计时器：计时器在名将登场时被藏，跟着它会一起藏住）；名将登场的水墨横幅期间藏计时与小字，顶部只留横幅
      const hud = this.mode === 'none' && !this.over, ink = this.combatNow < this.gInkUntil;
      t.setVisible(hud); t.setCaptionVisible(!ink); this.hudTexts.timer.setVisible(hud && !ink);
      // 计时器、关名放在进度条下面：基类每换一次关卡定义（本模式每阵都换）会把它们放回原位，这里每帧摆回来
      const ty = GauntletTrack.HEIGHT + 3; if (this.hudTexts.timer.y !== ty) { this.hudTexts.timer.setY(ty); this.hudTexts.chapter.setY(ty + 30); }
      if (this.hudTexts.chapter.text) this.hudTexts.chapter.setText(''); // 计时器下那行关名（基类按关卡定义写「名将连战」）不写：进度条已标明，空出来不压名将登场横幅
    }
    /** 名将小头像（进度条节点）：结算头像那张裁好的全身图取上半截，裁成圆形。 */
    private head(b: GauntletBoss): string {
      const key = 'gauntlet_head_' + b.id; if (this.textures.exists(key)) return key;
      const pk = this.portrait(b); if (!pk.startsWith('gauntlet_face_')) return pk;
      const src = this.textures.get(pk).getSourceImage() as HTMLCanvasElement, w = src.width, h = src.height, side = Math.max(1, Math.min(w, Math.round(h * .5))), S = 64;
      const c = this.textures.createCanvas(key, S, S); if (!c) return pk;
      const g = c.context; g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.closePath(); g.clip();
      g.fillStyle = '#2a1f14'; g.fillRect(0, 0, S, S); g.drawImage(src, Math.round((w - side) / 2), 0, side, side, 0, 0, S, S); g.restore(); c.refresh();
      return key;
    }
    /** 战场横幅整体往下挪一行：顶部多了十阵进度条和它的小字，计时器下移后横幅贴着计时器（11-21 验收：顶部压字）。淡出的上飘按新位置重设。 */
    protected showWaveBanner(text: string, danger = false, captionText?: string): void {
      super.showWaveBanner(text, danger, captionText);
      const list = this.children.list.filter(o => o.name === 'combat-notice'), n = list[list.length - 1] as Phaser.GameObjects.Container | undefined;
      if (!n || n.getData('gShift')) return;
      n.setData('gShift', 1); this.tweens.killTweensOf(n); n.y += 26;
      this.tweens.add({ targets: n, alpha: 0, y: n.y - 8, delay: 1150, duration: 350, onComplete: () => n.destroy() });
    }
    /** 名将登场的水墨横幅到几时（战斗时钟）：之前的横幅延后到这之后再放。 */
    private gInkUntil = 0;
    /** 战场横幅（危险色）：名将登场的水墨横幅还在时延后到它淡出以后，不叠在一起。 */
    private gBanner(title: string, caption = ''): void {
      const wait = this.gInkUntil - this.combatNow;
      if (wait > 0) { this.time.delayedCall(wait, () => { if (!this.over) this.showWaveBanner(title, true, caption); }); return; }
      this.showWaveBanner(title, true, caption);
    }
    /** 这一阵的名将：十阵名单里的；无尽时现抽一位（全池循环）并记进名单。 */
    private waveBoss(): GauntletBoss {
      let b = this.gOrder[this.gWave - 1];
      if (!b) { b = endlessBoss(this.gPool, this.gKills[this.gKills.length - 1] ?? null, Math.random, this.gKills); this.gOrder[this.gWave - 1] = b; }
      return b;
    }
    /** 第 late.fromWave 阵起换一套招（曹仁中段八门金锁、后段樊城死守）：同一位名将，换篇章 / 关 / 控制器。 */
    private variant(b: GauntletBoss): GauntletBoss { const L = b.late; return L && this.gWave >= L.fromWave ? { ...b, arc: L.arc, stage: L.stage, ctrl: L.ctrl } : b; }
    /** 名将登场：先收掉上一位留下的控制器，按这一阵换关卡定义，再出首领（带亲兵）。 */
    startBoss(): void {
      const b = this.variant(this.waveBoss());
      this.clearProps(); this.clearEscort(); this.clearHill(); this.clearBand(); this.gStrikes?.clear();
      this.gCur = b; this.gPhase = 'boss'; this.gAt = this.elapsed;
      this.gCtrl?.clear(); this.gCtrl = null; this.lubu?.clear(); this.lubu = null; this.zhangjiao?.clear(); this.zhangjiao = null; this.huaxiong?.clear(); this.huaxiong = null; this.xurong?.clear(); this.xurong = null; this.moveset?.clear(); this.moveset = null; this.bossMount?.destroy(); this.bossMount = null;
      this.boss = null; this.bossSpawned = false; this.bossKilled = false; this.bossWarned = true; this.bossPhase2 = false; this.bossEnergy = 0;
      this.chapter = this.makeChapter(b);
      this.spawnBoss();
    }
    protected spawnBoss(): void {
      const had = !!this.boss?.active; if (!had) this.makeRoom(GAUNTLET_BOSS_ROOM);
      super.spawnBoss(); const boss = this.boss as Enemy | null, b = this.gCur;
      if (!boss || had || !b) return;
      this.gInkUntil = this.combatNow + GAUNTLET_INK_MS;
      if (GAUNTLET.stallOff) this.bossStallCfg = { quotaSec: 1e9, enrageSec: 1e9 }; // 首领防拖关掉（阵数节奏已经限住每阵长度）
      const art = bossArt(b), now = this.combatNow;
      const host: ArcHost = { scene: this, boss, player: this.player, army: this.legion, spawn: (k, x, y, def) => this.spawnEnemy(k, x, y, 1, true, def), def: k => this.chapter.enemies[k], banner: (t, c) => this.gBanner(t, c), sfx: k => this.sfx.play(k) };
      if (b.ctrl === 'moveset') { this.moveset?.clear(); this.moveset = null; const mv = BOSS_MOVES[b.arc + '.' + b.id] ?? BOSS_MOVES[b.id] ?? GAUNTLET_MOVES[b.id]; if (mv) this.gCtrl = new BossMoveset(host, art.layout === 'walk' ? boss.sprite.texture.key : art.tex, now, adaptMoves(mv, b), art.layout); }
      else if (b.ctrl === 'yuanshu') this.gCtrl = new YuanshuBoss(host, art.tex, now, { endlessHoney: !!b.endlessHoney });
      else if (b.ctrl === 'caoren') this.gCtrl = new CaorenBoss(host, art.tex, now);
      else if (b.ctrl === 'guandu') this.gCtrl = new GuanduBoss({ scene: this, boss, player: this.player, army: this.legion, spawn: (k, x, y) => this.spawnEnemy(k, x, y, 1, true),
        morale: b.props ? () => ({ multiplier: 1, burned: this.gProps.filter(p => p.broken).length, intact: this.propsAlive() }) : undefined }, b.stage, now) as unknown as GCtrl; // 颜良 / 文丑 / 淳于琼按关取招式；军心只给名牌看（减伤由随身布置算）
      else if (b.ctrl === 'dongzhuo') this.gCtrl = this.dongzhuoCtrl(boss, now);
      else if (b.ctrl === 'simayi' && this.gStrikes) { // 五丈原的控制器：随身营垒（环境互动的营帐，同 12-3）45 秒自倒
        this.gCtrl = new SimayiBoss(host, art.tex, now, { strikes: this.gStrikes, placeFort: (x, y, i) => { let f = this.env?.placeTent(x, y, 'gauntlet-fort-' + this.gWave + '-' + i, SMY.fortHp, 3) ?? null; if (!f) { const m = this.propEnemy(x, y, SMY.fortHp, 'fort'); if (m) { f = m.e; this.gFortProps.push({ e: m.e, life: m.e.spawnId, img: m.img, broken: false }); } } if (f) this.markGate(f, 'tent'); return f; } });
        this.gFortsUntil = now + 45000;
      }
      this.gHill = null; this.gHillAt = b.hill ? now + 6000 : Infinity; this.gBandAt = b.fireBand ? now + 5000 : Infinity;
      this.gRises = b.rises?.count ?? 0; this.gPauseUntil = 0;
      this.spawnProps(b, boss, now); this.spawnEscort(b, boss, now);
      // 亲兵：围在名将身边（他自己那一章的兵，强度按本阵）
      let k = 0; for (const [kind, n] of GAUNTLET.guards) for (let i = 0; i < n; i++, k++) { const a = k / 4 * Math.PI * 2; this.spawnEnemy(kind, boss.x + Math.cos(a) * 70, boss.y + Math.sin(a) * 50, 1, true, this.guard(kind)); }
      const last = this.gWave === GAUNTLET.waves && !this.gEndless;
      this.gTrack?.bossUp(this.gWave, this.head(b)); void last;
      // 名将登场只留基类的水墨横幅（称号 + 名字），约 2.7 秒内顶部不放别的横幅、计时与进度条小字先藏（11-21 验收：顶部挤成一团）；「杂兵减半」不再提示
    }
    /**
     * 名将登场要的空位：同屏敌人到了上限（从 0 开局前期杀得慢，杂兵会攒满 150）时，离主将最远的杂兵先撤掉几个，
     * 腾出名将 + 亲兵 + 随身布置 + 护卫的位置（否则名将刷不出来，这一阵卡住）。
     */
    private makeRoom(n: number): void {
      const need = n - (BALANCE.enemyCap - this.activeEnemyCount()); if (need <= 0) return;
      const pl = this.player, far = this.enemies.filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss').sort((a, b) => Math.hypot(b.x - pl.x, b.y - pl.y) - Math.hypot(a.x - pl.x, a.y - pl.y));
      for (const e of far.slice(0, need)) e.deactivate();
    }
    protected customBossStep(enemy: Enemy, dt: number, now: number) {
      if (this.gEscort && enemy === this.gEscort.e) { if (!this.gEscort.leaving) this.gEscort.ctrl.update(dt, now); return true; }
      if (enemy === this.boss && this.gCtrl) {
        if (now >= this.gPauseUntil) this.gCtrl.update(dt, now); // 孟获倒地复起的那一下：停住不出招
        this.updateProps(now); this.updateHill(now); this.updateBand(now); this.updateForts(now);
        return true;
      }
      return super.customBossStep(enemy, dt, now);
    }
    protected hitEnemy(enemy: Enemy, raw: number, now: number, source: 'melee' | 'arrow' | 'fire' = 'melee', ally = false, weaponHit = true) {
      if (!ally && this.hillHasPlayer()) raw *= this.gCur?.hill?.playerDmg ?? 1; // 高地圈：主将站在里面伤害加成
      const E = this.gEscort;
      if (E && enemy === E.e) { // 随行护卫：打到 leaveAt 血线退场（不算斩将）
        if (E.leaving) return super.hitEnemy(enemy, 0, now, source, ally, weaponHit);
        raw *= E.ctrl.incoming(ally); E.ctrl.hit(now);
        const floor = enemy.maxHp * E.def.leaveAt; if (enemy.hp - raw <= floor) { raw = Math.max(0, enemy.hp - floor); this.time.delayedCall(0, () => this.escortLeave()); }
      }
      if (enemy === this.boss && this.gCtrl) {
        raw *= (this.gCtrl.incoming?.(ally) ?? 1) * this.propsMul() * (E && !E.leaving && E.e.active ? E.def.takenMul : 1); this.gCtrl.hit?.(now);
        if (this.gRises > 0 && enemy.hp - raw <= 0) { raw = Math.max(0, enemy.hp - 1); this.time.delayedCall(0, () => this.bossRise()); } // 孟获三擒：倒下原地再起
      }
      return super.hitEnemy(enemy, raw, now, source, ally, weaponHit);
    }
    protected bossHasDeathArt() { return !!this.gCtrl?.updateDeath || super.bossHasDeathArt(); }
    protected killEnemy(enemy: Enemy) {
      if (this.gEscort && enemy === this.gEscort.e && !this.gEscort.leaving) { enemy.hp = Math.max(1, Math.ceil(enemy.maxHp * this.gEscort.def.leaveAt)); this.escortLeave(); return; } // 护卫打到底不死：退场
      if (enemy === this.boss && this.gRises > 0) { enemy.hp = 1; this.bossRise(); return; } // 孟获三擒
      if (enemy === this.boss) this.gCtrl?.defeat?.(); super.killEnemy(enemy);
    }
    /** 斩将：不掉宝箱、不结算（基类首领倒地掉宝箱、捡完结算），改成清场 → 战利品三选一 → 下一阵。 */
    protected spawnBossChest(_x: number, _y: number, _done: () => void): void { this.onBossDown(); }
    private onBossDown(): void {
      const b = this.gCur; if (!b || this.gPhase !== 'boss') return;
      this.gTrack?.bossDown(this.gWave); this.clearProps(true); this.escortLeave();
      this.gKills.push(b); this.gPhase = 'clear'; this.gAt = this.elapsed; this.gLootShown = false;
      if (this.gWave === GAUNTLET.waves && !this.gEndless) this.gCleared = true;
      // 清场：场上的杂兵退散（淡出，不给经验 / 掉落）；地上的经验珠留着捡
      for (const e of this.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') { this.gStats.cleared++; const sp = e.sprite, life = e.spawnId; this.tweens.add({ targets: sp, alpha: 0, duration: 600, onComplete: () => { if (e.active && e.spawnId === life) { e.deactivate(); sp.setAlpha(1); } } }); }
      const heal = Math.round(this.player.maxHp * GAUNTLET.from0.clearHeal); this.player.heal(heal); // 清场休整
      this.showWaveBanner(`斩将 · ${b.name}`, false, this.gCleared ? '十阵连斩！' : `第 ${this.gWave} 阵告捷 · 已斩 ${this.gKills.length} 将 · 休整回复 ${Math.round(GAUNTLET.from0.clearHeal * 100)}% 生命`);
    }

    // ———— 随身布置（适配表规则 a）：登场在名将身边立几件可打掉的物件，立着时名将受伤减；有持续时间 ————
    private gProps: Array<{ e: Enemy; life: number; img: Phaser.GameObjects.Image | null; broken: boolean; art: GauntletProps['art']; volleyAt: number }> = [];
    /** 火油罐碎处的火（名将踩进去藤甲着火）；藤甲着火了没有。 */
    private gFires: Array<{ x: number; y: number; until: number }> = []; private gArmorBurned = false;
    private gPropsDef: GauntletProps | null = null; private gPropsUntil = 0; private gPin: { x: number; y: number } | null = null;
    /** 一件物件：不会动、不会打的不可见敌人（同招式框架的旗 / 柱）+ 盖在上面的现成图。 */
    private propEnemy(x: number, y: number, hp: number, art: keyof typeof PROP_ART): { e: Enemy; img: Phaser.GameObjects.Image | null } | null {
      const A = PROP_ART[art], e = this.spawnEnemy('infantry', x, y, 1, true, { ...this.chapter.enemies.infantry, attackVisual: undefined, behavior: undefined, hp, speed: 0, damage: 0, xp: 1, radius: A.radius, tint: 0xffffff });
      if (!e) return null; e.controlImmune = true; e.sprite.setAlpha(0);
      const img = this.textures.exists(A.key) ? this.add.image(e.x, e.y + 18, A.key, A.frame).setOrigin(.5, .9).setDisplaySize(A.size, A.size).setDepth(actorDepth(e.y)).setName('gauntlet-prop') : null;
      return { e, img };
    }
    private propsAlive(): number { return this.gProps.filter(p => !p.broken).length; }
    private propsMul(): number { return this.gPropsDef && this.propsAlive() > 0 && !this.gArmorBurned ? this.gPropsDef.takenMul : 1; }
    /** 兀突骨藤甲着火：不再减伤，狂怒（招式间隔 ×0.85）。 */
    private burnArmor(): void {
      if (this.gArmorBurned) return; this.gArmorBurned = true;
      const c = this.gCtrl as unknown as { gapMul?: number } | null; if (c && typeof c.gapMul === 'number') c.gapMul *= .85;
      this.showWaveBanner(this.gPropsDef?.armor ?? '藤甲着火', true, (this.gCur?.name ?? '') + '不再刀枪不入 · 狂怒');
    }
    private spawnProps(b: GauntletBoss, boss: Enemy, now: number): void {
      const P = b.props; if (!P) return;
      this.gPropsDef = P; this.gPropsUntil = now + P.lifeSec * 1000;
      const hp = Math.max(40, Math.round(boss.maxHp * P.hpFrac)), ang = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
      for (let i = 0; i < P.count; i++) {
        let x: number, y: number;
        if (P.front) { const off = (i - (P.count - 1) / 2) * 130; x = boss.x + Math.cos(ang) * 120 - Math.sin(ang) * off; y = boss.y + Math.sin(ang) * 120 + Math.cos(ang) * off; } // 立在名将和主将之间（城门）
        else { const a = ang + Math.PI / P.count + i / P.count * Math.PI * 2; x = boss.x + Math.cos(a) * 165; y = boss.y + Math.sin(a) * 125; } // 围一圈
        let e: Enemy | null = null, img: Phaser.GameObjects.Image | null = null;
        if (P.art === 'tent' && this.env) e = this.env.placeTent(x, y, 'gauntlet-tent-' + this.gWave + '-' + i, hp);
        if (!e) {
          const made = this.propEnemy(x, y, hp, P.art); e = made?.e ?? null; img = made?.img ?? null;
        }
        if (!e) continue;
        this.markGate(e); // 自动索敌先打它（同首领关的营垒 / 城门）
        this.gProps.push({ e, life: e.spawnId, img, broken: false, art: P.art, volleyAt: now + 2500 + i * 1500 });
      }
      if (P.pin) this.gPin = { x: boss.x, y: boss.y };
      this.gFires = []; this.gArmorBurned = false;
      this.time.delayedCall(200, () => { if (this.gPropsDef === P && this.propsAlive()) this.gBanner(P.name, `${P.name}立着时${b.name}受伤 −${Math.round((1 - P.takenMul) * 100)}% · 先拆${P.name}${P.pin ? ' · 门在他不出' : ''}`); });
    }
    private updateProps(now: number): void {
      const P = this.gPropsDef; if (!P) return;
      for (const p of this.gProps) {
        if (p.broken || (p.e.active && p.e.spawnId === p.life && p.e.hp > 0)) continue;
        p.broken = true;
        const A = PROP_ART[p.art], img = p.img;
        if (img && A?.broken !== undefined) img.setFrame(A.broken); else if (img) this.tweens.add({ targets: img, alpha: 0, duration: 500, onComplete: () => img.destroy() });
        if (P.shaken) (this.gCtrl as unknown as { shaken?: (n: number) => void } | null)?.shaken?.(now); // 官渡控制器：打断当前招式、僵直（军心动摇）
        if (P.fireSec) { const x = p.e.x, y = p.e.y; this.gFires.push({ x, y, until: now + P.fireSec * 1000 }); for (let k = 0; k < P.fireSec; k++) this.time.delayedCall(k * 1000, () => playSheet(this, 'fx_ground_fire', x, y + 6, { size: 150, ms: 1000, depth: actorDepth(y) + .4, originY: .78, name: 'gauntlet-jar-fire' })); } // 火油罐：碎处起火
        if (!this.propsAlive()) { if (P.armor) this.burnArmor(); else this.showWaveBanner(P.name + '尽毁', false, (this.gCur?.name ?? '') + '不再减伤'); }
      }
      // 箭楼：立着时定时朝主将放一轮箭雨（手绘预警圈，同陈仓箭楼）
      if (P.volley && this.gStrikes) for (const p of this.gProps) if (!p.broken && now >= p.volleyAt) { p.volleyAt = now + P.volley.everySec * 1000; const pl = this.player; for (let k = 0; k < P.volley.count; k++) this.gStrikes.add('arrows', pl.x + (Math.random() - .5) * 200, pl.y + (Math.random() - .5) * 160, P.volley.r, 1300, P.volley.ratio, 0); }
      // 火油罐：名将踩进火里 → 藤甲着火（剩下的罐一并碎）
      this.gFires = this.gFires.filter(f => f.until > now);
      { const bz = this.boss; if (P.armor && !this.gArmorBurned && bz?.active && this.gFires.some(f => Math.hypot(bz.x - f.x, bz.y - f.y) < 80)) { for (const p of this.gProps) if (!p.broken && p.e.active) { p.e.hp = 0; this.killEnemy(p.e); } this.burnArmor(); } }
      if (now >= this.gPropsUntil && this.propsAlive()) for (const p of this.gProps) if (!p.broken && p.e.active) { p.e.hp = 0; this.killEnemy(p.e); } // 到时自己倒
      const b = this.boss; if (this.gPin && b?.active && this.propsAlive()) { b.sprite.x = this.gPin.x; b.sprite.y = this.gPin.y; } // 刘璋闭城：门在他不出
    }
    /** 收掉随身布置：fall = 名将倒下时剩下的跟着倒（淡出），否则直接撤。 */
    private clearProps(fall = false): void {
      for (const p of this.gProps) {
        const img = p.img; if (img) { if (fall) this.tweens.add({ targets: img, alpha: 0, duration: 600, onComplete: () => img.destroy() }); else img.destroy(); }
        if (p.e.active && p.e.spawnId === p.life) p.e.deactivate();
      }
      this.gProps = []; this.gPropsDef = null; this.gPin = null;
      for (const f of this.gFortProps) { f.img?.destroy(); if (f.e.active && f.e.spawnId === f.life) f.e.deactivate(); } this.gFortProps = [];
    }

    // ———— 高地圈（适配表规则 b，夏侯渊 / 曹操的山头）：定时出现一块高地，谁站在里面谁加成，可以抢 ————
    private gHill: { x: number; y: number; r: number; upAt: number; until: number; objs: Phaser.GameObjects.GameObject[]; img: Phaser.GameObjects.Image | null } | null = null;
    private gHillAt = Infinity; private gHillBossIn = false;
    /** 椭圆判定（同第八章山头：纵向压扁 .55）。 */
    private inHill(x: number, y: number): boolean { const h = this.gHill; return !!h && Math.hypot(x - h.x, (y - h.y) / .55) <= h.r; }
    private hillHasPlayer(): boolean { return !!this.gHill && this.combatNow >= this.gHill.upAt && this.inHill(this.player.x, this.player.y); }
    private updateHill(now: number): void {
      const H = this.gCur?.hill; if (!H) return;
      if (!this.gHill && now >= this.gHillAt) {
        const p = this.player, b = this.boss, mx = b ? (p.x + b.x) / 2 : p.x, my = b ? (p.y + b.y) / 2 : p.y, a = Math.random() * Math.PI * 2, x = mx + Math.cos(a) * 120, y = my + Math.sin(a) * 90;
        const img = this.textures.exists(HILL_ART[0].key) ? this.add.image(x, y + 4, HILL_ART[0].key).setDisplaySize(H.radius * 2.4, H.radius * 2.4 * 160 / 256).setDepth(DEPTH.ground + 3).setAlpha(.3).setName('gauntlet-hill') : null;
        const flag = this.textures.exists('zhuge_banner') ? this.add.image(x, y - 6, 'zhuge_banner').setOrigin(.32, 1).setDisplaySize(46, 70).setDepth(actorDepth(y)).setTint(0xc9b48a).setAlpha(.3) : null;
        const label = this.add.text(x, y - H.radius * .55 - 18, '高地', { fontFamily: FONT, fontSize: '14px', color: '#f5e2b0', stroke: '#1a120b', strokeThickness: 3 }).setOrigin(.5).setDepth(DEPTH.fx + 2).setAlpha(.6);
        this.gHill = { x, y, r: H.radius, upAt: now + H.warnSec * 1000, until: now + (H.warnSec + H.lastSec) * 1000, objs: [img, flag, label].filter((o): o is NonNullable<typeof o> => !!o), img };
        this.gHillAt = now + H.everySec * 1000;
        this.gBanner('高地 · 可以抢', `站上高地：主将伤害 +${Math.round((H.playerDmg - 1) * 100)}% · ${this.gCur?.name ?? ''}站上去出招更快`);
      }
      const h = this.gHill; if (!h) return;
      const up = now >= h.upAt, k = up ? 1 : .3 + .7 * Math.max(0, 1 - (h.upAt - now) / (H.warnSec * 1000));
      for (const o of h.objs) (o as unknown as { setAlpha(v: number): void }).setAlpha(k);
      // 名将站进去：出招间隔变短（离开恢复）
      const c = this.gCtrl as unknown as { gapMul?: number } | null, b = this.boss, bossIn = up && !!b?.active && this.inHill(b.x, b.y);
      if (c && typeof c.gapMul === 'number' && bossIn !== this.gHillBossIn) { c.gapMul *= bossIn ? H.bossGap : 1 / H.bossGap; this.gHillBossIn = bossIn; }
      if (now >= h.until) this.clearHill();
    }
    private clearHill(): void {
      const H = this.gCur?.hill, c = this.gCtrl as unknown as { gapMul?: number } | null;
      if (this.gHillBossIn && H && c && typeof c.gapMul === 'number') c.gapMul /= H.bossGap;
      this.gHillBossIn = false; for (const o of this.gHill?.objs ?? []) o.destroy(); this.gHill = null;
    }

    // ———— 火带（适配表规则 b，陆逊的火线 / 风向）：报风向 → 一道火带顺风扫过全场，留缺口；二阶段一次两道 ————
    private gBandCells: Array<{ id: string; x: number; y: number; at: number; band: number }> = [];
    private gBandAt = Infinity; private gBandSeq = 0; private gBandHit = new Set<number>();
    /** 测试读：放过几道火带、点燃几格、烧到主将几次。 */
    gBandStats = { bands: 0, cells: 0, hits: 0 };
    private updateBand(now: number): void {
      const F = this.gCur?.fireBand; if (!F) return;
      if (now >= this.gBandAt) {
        this.gBandAt = now + F.everySec * 1000;
        const dir = Math.floor(Math.random() * 8) * Math.PI / 4; this.startBand(F, now, dir);
        if ((this.gCtrl as unknown as { phase2?: boolean } | null)?.phase2 && F.p2Bands > 1) this.time.delayedCall(1600, () => { if (this.gCur?.fireBand === F && this.gPhase === 'boss') this.startBand(F, this.combatNow, dir + Math.PI / 2); });
      }
      const wf = warnFx(this), pl = this.player;
      for (let i = this.gBandCells.length - 1; i >= 0; i--) {
        const c = this.gBandCells[i];
        if (now < c.at) { wf.circle(c.id, 'fire', c.x, c.y, F.r, Math.max(0, 1 - (c.at - now) / F.warnMs), now); continue; }
        this.gBandCells.splice(i, 1); this.gBandStats.cells++;
        playSheet(this, 'fx_ground_fire', c.x, c.y + 6, { size: F.r * 2.4, ms: 900, depth: actorDepth(c.y) + .4, originY: .78, name: 'gauntlet-fireband' });
        if (pl.alive && !this.gBandHit.has(c.band) && Math.hypot(pl.x - c.x, pl.y - c.y) <= F.r + pl.radius * .5) { this.gBandHit.add(c.band); pl.takeDamage(Math.max(4, pl.maxHp * F.ratio), now); this.gBandStats.hits++; }
      }
    }
    /** 一道火带：dir = 顺风方向；横着 cols 格、顺风 rows 行，从主将上风处扫过去；中间留 gap 格缺口（站进缺口就躲开）。 */
    private startBand(F: NonNullable<GauntletBoss['fireBand']>, now: number, dir: number): void {
      const band = ++this.gBandSeq, pl = this.player, perp = dir + Math.PI / 2, cx0 = pl.x - Math.cos(dir) * (F.rows - 1) / 2 * F.spacing, cy0 = pl.y - Math.sin(dir) * (F.rows - 1) / 2 * F.spacing;
      const g0 = 1 + Math.floor(Math.random() * Math.max(1, F.cols - F.gap - 1));
      for (let j = 0; j < F.rows; j++) for (let k = 0; k < F.cols; k++) {
        if (k >= g0 && k < g0 + F.gap) continue;
        const o = (k - (F.cols - 1) / 2) * F.spacing, x = cx0 + Math.cos(dir) * j * F.spacing + Math.cos(perp) * o, y = cy0 + Math.sin(dir) * j * F.spacing + Math.sin(perp) * o;
        this.gBandCells.push({ id: 'gauntlet-band-' + band + '-' + j + '-' + k, x, y, at: now + F.warnMs + j * F.stepMs, band });
      }
      const from = ((Math.round((dir + Math.PI) / (Math.PI / 4)) % 8) + 8) % 8, NAMES = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];
      this.gBandStats.bands++;
      this.gBanner(NAMES[from] + '风起 · 火烧连营', '火带顺风扫过来 · 站进缺口');
    }
    private clearBand(): void { this.gBandCells = []; this.gBandHit.clear(); this.gBandAt = Infinity; }

    // ———— 司马懿的随身营垒：45 秒自倒 ————
    private gFortsUntil = Infinity; private gFortProps: Array<{ e: Enemy; life: number; img: Phaser.GameObjects.Image | null; broken: boolean }> = [];
    private updateForts(now: number): void {
      for (const f of this.gFortProps) if (!f.broken && !(f.e.active && f.e.spawnId === f.life && f.e.hp > 0)) { f.broken = true; f.img?.setFrame(PROP_ART.fort.broken ?? PROP_ART.fort.frame); }
      if (now < this.gFortsUntil) return; this.gFortsUntil = Infinity;
      for (const f of (this.gCtrl as unknown as { forts?: Enemy[] } | null)?.forts ?? []) if (f.active) { f.hp = 0; this.killEnemy(f); }
    }

    // ———— 随行护卫（适配表规则 c）：董卓由吕布护卫、韩玄带黄忠；护卫在时名将受伤减，护卫打到 leaveAt 血退场 ————
    private gEscort: { e: Enemy; life: number; ctrl: BossMoveset; def: NonNullable<GauntletBoss['escort']>; name: string; leaving: boolean } | null = null;
    private spawnEscort(b: GauntletBoss, boss: Enemy, now: number): void {
      const E = b.escort, eb = E && GAUNTLET_POOL.find(x => x.id === E.id); if (!E || !eb) return;
      const art = bossArt(eb), T = waveTroopSet(this.gWave).troops;
      let def: EnemyDef = { ...art.def, kind: 'boss', hp: Math.round(T.bossHp * E.hpFrac), damage: T.bossDmg * .8 }, tex = art.tex, layout = art.layout, mv: BossMovesetDef | undefined;
      if (eb.id === 'lubu') { const v2 = isV2Texture('boss_lubu'); def = { ...def, texture: 'boss_lubu', walkVisual: { texture: 'boss_lubu', scale: v2 ? .5 : 218 / 256, groundY: v2 ? 256 / 288 : 224 / 256, matched: true }, attackVisual: this.textures.exists('lubu_attack') ? 'lubu_attack' : undefined }; tex = 'boss_lubu'; layout = 'walk'; mv = LUBU_ESCORT; } // 同 2-3 的城下吕布
      else { const m = BOSS_MOVES[eb.arc + '.' + eb.id] ?? BOSS_MOVES[eb.id]; if (m) mv = adaptMoves(m, eb); }
      if (!mv) return;
      const e = this.spawnEnemy('boss', boss.x + 150, boss.y + 30, 1, true, def); if (!e) return;
      const host: ArcHost = { scene: this, boss: e, player: this.player, army: this.legion, spawn: (k, x, y, d) => this.spawnEnemy(k, x, y, 1, true, d), def: k => this.chapter.enemies[k], banner: (t, c) => this.gBanner(t, c), sfx: k => this.sfx.play(k) };
      this.gEscort = { e, life: e.spawnId, ctrl: new BossMoveset(host, layout === 'walk' ? e.sprite.texture.key : tex, now, mv, layout), def: E, name: eb.name, leaving: false };
      this.time.delayedCall(200, () => { if (this.gEscort?.e === e && !this.gEscort.leaving) this.gBanner(eb.name + '护卫', `${eb.name}在时${b.name}受伤 −${Math.round((1 - E.takenMul) * 100)}% · 先打${eb.name}（打到三成血退场）`); });
    }
    /** 护卫退场：喊一声、淡出（不算斩将、不掉东西）。 */
    private escortLeave(): void {
      const E = this.gEscort; if (!E || E.leaving) return;
      E.leaving = true; E.ctrl.clear(); const e = E.e, life = E.life;
      if (e.active && e.spawnId === life) { e.invulnerable = true; this.showWaveBanner(E.name + '退场', false, E.def.line); this.tweens.add({ targets: e.sprite, alpha: 0, duration: 900, onComplete: () => { if (e.active && e.spawnId === life) { e.deactivate(); e.sprite.setAlpha(1); } if (this.gEscort === E) this.gEscort = null; } }); }
      else if (this.gEscort === E) this.gEscort = null;
    }
    private clearEscort(): void { const E = this.gEscort; if (!E) return; E.ctrl.clear(); if (E.e.active && E.e.spawnId === E.life) E.e.deactivate(); this.gEscort = null; }

    // ———— 孟获三擒（规则 c）：倒下原地再起，不隐身、不无敌、不逃走；一次比一次快 ————
    private gRises = 0; private gPauseUntil = 0;
    private bossRise(): void {
      const b = this.gCur, boss = this.boss, R = b?.rises; if (!b || !R || !boss?.active || this.gRises <= 0) return;
      this.gRises--; const n = R.count - this.gRises, now = this.combatNow;
      boss.hp = Math.round(boss.maxHp * R.hp);
      (boss as unknown as { def: EnemyDef }).def = { ...boss.def, speed: boss.def.speed * R.speed };
      const c = this.gCtrl as unknown as { gapMul?: number } | null; if (c && typeof c.gapMul === 'number') c.gapMul *= R.gap;
      this.gPauseUntil = now + 1500;
      this.tweens.add({ targets: boss.sprite, alpha: .35, duration: 180, yoyo: true, repeat: 3 });
      this.showWaveBanner(`${['一', '二', '三', '四'][n - 1] ?? n}擒 · ${b.name}不服`, true, this.gRises > 0 ? `倒地复起 · 更快了 · 还要再擒 ${this.gRises + 1} 次` : '倒地复起 · 再擒一次就服了');
    }
    /** 董卓（2-3 的控制器，不接城头 / 营寨 / 吕布演出）：纵火落点、号令西凉铁骑、飞熊军护驾；半血迁都。 */
    private dongzhuoCtrl(boss: Enemy, now: number): GCtrl {
      const dz = new DongzhuoBoss({ scene: this, player: this.player, army: this.legion,
        move: (e, nx, ny, dt) => { e.moveVx = nx * e.def.speed; e.moveVy = ny * e.def.speed; this.advanceEnemy(e, nx, ny, dt); },
        raid: () => { const p = this.player, a = Math.random() * Math.PI * 2; this.gBanner('号令西凉铁骑', '铁骑从侧翼冲来'); for (let i = 0; i < 3; i++) this.spawnEnemy('cavalry', p.x + Math.cos(a) * 400 + (i - 1) * 60, p.y + Math.sin(a) * 400, 1, true, this.guard('cavalry')); },
        guards: (n, x, y) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; this.spawnEnemy('shield', x + Math.cos(a) * 90, y + Math.sin(a) * 90, 1, true, this.guard('shield')); } },
        spawn: (k, x, y) => { this.spawnEnemy(k, x, y, 1, true); }, banner: (t, c) => this.gBanner(t, c ?? '') }, boss, now);
      return { update: (dt, n) => { dz.step(dt, n); dz.update(n); }, clear: () => dz.clear(), get label() { return dz.label; }, get state() { return (dz as unknown as { fires: unknown[] }).fires.length ? 'attack' : 'approach'; } };
    }

    // ———— 战利品三选一（复用 bossloot 卡面板）————
    /** 这位名将的小像（首领图第一帧拷成一张单图：卡面 / 结算头像用）。 */
    portrait(b: GauntletBoss): string {
      const hit = this.gPortrait.get(b.id); if (hit && this.textures.exists(hit)) return hit;
      const a = bossArt(b), key = 'gauntlet_face_' + b.id; if (!this.textures.exists(a.tex)) return 'growth_icon_pickup';
      // 首领图第一帧（朝下站立）裁到不透明像素的外框：各家首领图格子里人站的位置 / 留白不一样，裁掉留白以后同样大小摆一排才整齐
      if (!this.textures.exists(key)) {
        const src = this.textures.get(a.tex), f = src.get(src.has('down_0') ? 'down_0' : 0), w = Math.max(1, Math.round(f.cutWidth)), h = Math.max(1, Math.round(f.cutHeight));
        const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; const g = tmp.getContext('2d', { willReadFrequently: true }); if (!g) return 'growth_icon_pickup';
        g.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, w, h, 0, 0, w, h);
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        try { const d = g.getImageData(0, 0, w, h).data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } } catch { /* 读不了像素：用整格 */ }
        if (x1 < x0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
        const cw = x1 - x0 + 1, ch = y1 - y0 + 1, c = this.textures.createCanvas(key, cw, ch); if (!c) return 'growth_icon_pickup';
        c.context.drawImage(tmp, x0, y0, cw, ch, 0, 0, cw, ch); c.refresh();
      }
      this.gPortrait.set(b.id, key); return key;
    }
    private openLoot(): void {
      const b = this.gCur; if (!b) return; const food = GAUNTLET.loot.food + GAUNTLET.loot.foodPerWave * this.gWave, full = this.gFollowers.length >= GAUNTLET.followerMax;
      const fb = (b.followAs && GAUNTLET_POOL.find(x => x.id === b.followAs)) || b; // 韩玄那阵收的是黄忠（适配表：劝降改收为副将）
      const opts: UpgradeOption[] = [
        { id: 'gauntlet_follow', name: '收为副将 · ' + fb.name, desc: `${fb.name}本局跟着你打（用他自己的形象，名将招式能用的照用）\n副将最多 ${GAUNTLET.followerMax} 位${full ? ' · 已满，选了再挑替换谁' : ''}`, kind: 'foundation', categoryLabel: '战利品', scope: 'run', icon: this.portrait(fb), apply: () => this.takeFollower(fb) },
        { id: 'gauntlet_spoils', name: '取其辎重', desc: `钱币 +${food}\n立刻回满生命`, kind: 'foundation', categoryLabel: '战利品', scope: 'once', icon: 'growth_icon_pickup', apply: () => { this.coinBurst(this.player.x, this.player.y, food); this.legion.food += food; this.player.heal(this.player.maxHp); } }, // 钱不飘字：铜钱从主将处飞进行囊（coins.md）
        supplyOption(b.chapter),
      ];
      this.showLoot(`斩将 · ${b.name} · 战利品三选一`, '本局有效 · 选一样', opts, () => { if (this.gPendingReplace) { const nb = this.gPendingReplace; this.gPendingReplace = null; this.openReplace(nb); } });
    }
    private showLoot(title: string, hint: string, opts: UpgradeOption[], after: () => void): void {
      this.sfx.level();
      (this.levelPanel.getByName('upgrade-title') as Phaser.GameObjects.Text | null)?.setText(title);
      (this.levelPanel.getByName('upgrade-points-hint') as Phaser.GameObjects.Text | null)?.setVisible(true).setText(hint);
      this.upgradeOptions = opts.map(o => ({ ...o, apply: (p, w, g) => { this.gStats.lootPicks.push(o.id); o.apply(p, w, g); } }));
      this.lootContinue = () => { this.setMode('none'); after(); this.resumePendingChoices(); };
      this.renderCards(); this.setMode('bossloot');
    }
    /** 收为副将：随行系统的本局临时随从（不进人才库、不写存档），名将自己的首领图 + 名字；有降将专属招式的照样会出（data/surrenderMoves）。 */
    takeFollower(b: GauntletBoss): Follower | null {
      if (this.gFollowers.length >= GAUNTLET.followerMax) { this.gPendingReplace = b; return null; }
      if (!this.followers) { this.followers = new FollowerSquad(this, this.player, [], (qx, qy, r) => this.grid.query(qx, qy, r), (e, dmg, fire) => this.hitEnemy(e, dmg, this.combatNow, fire ? 'fire' : 'melee', true, false), () => this.player.growth.damageMultiplier(this.combatNow)); this.followers.onHitFx = (e, k, fx, fy) => this.followerTemplateHitFx(e, k, fx, fy); this.followers.attackSound = t => this.sfx.play(FOLLOWER_ATTACK_SFX[t]); this.wireFollowerObstacles(this.followers); }
      const r: Recruit = { id: 'gauntlet_' + b.id + '_' + Math.round(this.combatNow), kind: 'named', name: b.name, template: TEMPLATE[b.id] ?? 'blade', quality: GAUNTLET.followerQuality, rank: 0, picks: [], boss: b.id };
      const a = bossArt(b), f = this.followers.addTemp(r, this.player.x + 60, this.player.y + 40);
      f.look = { tex: a.tex, layout: a.layout, size: a.layout === 'arc' ? 108 : 88 }; f.label.setText('副将 · ' + b.name);
      this.gFollowers.push({ f, boss: b }); this.showWaveBanner('收为副将 · ' + b.name, false, `副将 ${this.gFollowers.length}/${GAUNTLET.followerMax}`);
      return f;
    }
    /** 副将满了：选替换谁（或不收）。 */
    private openReplace(nb: GauntletBoss): void {
      const opts: UpgradeOption[] = this.gFollowers.slice(0, 3).map(({ f, boss }) => ({ id: 'gauntlet_replace_' + boss.id, name: '换下 ' + boss.name, desc: `${boss.name}离队，${nb.name}入队`, kind: 'foundation' as const, categoryLabel: '副将', scope: 'run' as const, icon: this.portrait(boss),
        apply: () => { this.dropFollower(f); this.takeFollower(nb); } }));
      opts.push({ id: 'gauntlet_keep', name: '不收 ' + nb.name, desc: '副将不变', kind: 'foundation', categoryLabel: '副将', scope: 'once', icon: this.portrait(nb), apply: () => {} });
      this.showLoot(`副将已满 · 收 ${nb.name} 换下谁`, '选一位离队，或者不收', opts, () => {});
    }
    private dropFollower(f: Follower): void {
      const sq = this.followers; if (!sq) return; const i = sq.members.indexOf(f); if (i >= 0) { f.destroy(); sq.members.splice(i, 1); sq.members.forEach((m, k) => { m.slot = k; }); }
      this.gFollowers = this.gFollowers.filter(x => x.f !== f);
    }
    /** 第十阵斩完：通关，选继续无尽还是收兵结算。 */
    private openClearChoice(): void {
      this.gPhase = 'choice'; writeGauntletBest(this.gKills.length, this.gWave, Math.round(this.elapsed * 1000), isChapterTestRun());
      const opts: UpgradeOption[] = [
        { id: 'gauntlet_endless', name: '继续 · 无尽', desc: '名将再来一轮，一阵比一阵强，直到阵亡\n记最高连斩', kind: 'foundation', categoryLabel: '名将连战', scope: 'run', icon: 'growth_icon_might', apply: () => { this.gEndless = true; } },
        { id: 'gauntlet_settle', name: '收兵 · 结算', desc: '十阵通关，按斩将数领奖', kind: 'foundation', categoryLabel: '名将连战', scope: 'once', icon: 'growth_icon_pickup', apply: () => { this.gPhase = 'done'; } },
      ];
      this.showLoot('名将连战 · 十阵通关', '继续无尽，或者收兵结算', opts, () => { if (this.gEndless) this.nextWave(); else this.time.delayedCall(200, () => this.finish(true, 'boss')); });
    }
    nextWave(): void {
      // 斩将后基类记着「首领已倒」（bossKilled）：收尾保护会让主将无敌、场上杂兵溃退（victoryHold）。清场那几秒要这样；进下一阵必须清掉——
      // 第一版漏了，第 2 阵起割草时主将一直无敌、新刷的兵全往外跑（11-21 从 0 开局实打发现）
      this.bossKilled = false; for (const e of this.enemies) e.routUntil = 0; // 清场时记的溃退时刻别带进新一阵（还没淡出完的）
      this.refreshSoftLevel(); // 无尽：软上限跟着阵数抬
      this.gWave++; this.gTrack?.setWave(this.gWave, this.gWave <= GAUNTLET.waves); this.gPhase = 'mow'; this.gAt = this.elapsed; this.gLootShown = false; this.gEliteAt = GAUNTLET.eliteFirst; this.spawnTimer = .5;
      this.chapter = this.makeChapter(this.waveBoss());
      this.showWaveBanner(this.gEndless ? `无尽 · 第 ${this.gWave} 阵` : this.gWave === GAUNTLET.waves ? `第 ${this.gWave} 阵 · 守关之战` : `第 ${this.gWave} 阵`, false, `敌军 ${waveTroopSet(this.gWave).troops.name} · 割草 ${GAUNTLET.mowSec} 秒后名将登场`);
    }

    // ———— 结算：打到第几阵、斩了哪些名将（头像一排）、用时、最高连斩；按斩将数给钱币 / 武学残卷 ————
    protected finish(victory: boolean, reason: RunEndReason = 'death') {
      if (this.over) return;
      super.finish(victory, reason);
      const kills = this.gKills.length, debug = this.debugRun(), test = isChapterTestRun(), before = readGauntletBest(test);
      const record = writeGauntletBest(kills, this.gWave, Math.round(this.elapsed * 1000), test), best = Math.max(before.kills, kills);
      let first = false; try { first = this.gCleared && !debug && localStorage.getItem(GAUNTLET.firstClearKey) !== '1'; if (first) localStorage.setItem(GAUNTLET.firstClearKey, '1'); } catch { first = false; }
      const rw = gauntletReward(kills, first); if (!debug) { if (rw.provisions) addProvisions(rw.provisions); if (rw.scrolls) addScrolls(rw.scrolls); }
      const keep = this.resultTexts.body.text.split('\n').filter(l => /^武将等级|^经验已满|^属性点/.test(l));
      const reached = this.gEndless ? `第 ${this.gWave} 阵（无尽）` : `第 ${this.gWave} 阵 / ${GAUNTLET.waves}`;
      this.resultTexts.subtitle.setText(this.gCleared ? (this.gEndless ? `十阵通关 · 无尽斩将 ${kills}` : '十阵连斩 · 通关') : `止步第 ${this.gWave} 阵 · 斩将 ${kills}`);
      // 正文（逻辑 / 测试读；电脑版结算画面按它画奖励格：「永久奖励 钱币 +N」「武学残卷 +N」「武将等级 …」）
      this.resultTexts.body.setText([
        '打到　　' + reached, '斩将　　' + (kills ? kills + ' 位：' + this.gKills.map(b => b.name).join('、') : '无'), '用时　　' + this.formatTime(this.elapsed),
        '最高连斩　' + best + (record ? '　新纪录！' : ''), `本局等级　Lv.${this.player.level}（从 0 开局 · 局内成长不带出）`, ...(debug ? ['名将连战  测试战斗不入库'] : [`永久奖励  钱币 +${rw.provisions}`, `武学残卷  +${rw.scrolls}`, ...(first ? ['首次通关  名将连战大奖'] : [])]), ...keep,
      ].join('\n'));
      this.gResult = { kills, best, record }; this.presentResult(victory);
      const home = this.resultPanel.getByName('result-home') as Phaser.GameObjects.Text | null;
      // 从哪来回哪去：主菜单进的回主菜单，天下地图进的回天下地图（选中名将连战入口）
      if (this.gFrom === 'menu') home?.setText('返回主菜单').removeAllListeners('pointerdown').on('pointerdown', () => this.scene.start('MenuScene'));
      else home?.setText('返回天下地图').removeAllListeners('pointerdown').on('pointerdown', () => { this.registry.set('mapFocusNode', 'gauntlet'); this.scene.start('WorldMapScene'); });
      const restart = this.resultPanel.getByName('result-restart') as Phaser.GameObjects.Image | null;
      restart?.removeAllListeners('pointerdown').on('pointerdown', () => this.scene.restart());
    }
    /** 结算画面（电脑版）：基类画完奖励格以后，底下一行战况换成本模式的、副标题下面排斩将头像（基类可能晚些再画一遍，所以挂在这里）。 */
    private gResult: { kills: number; best: number; record: boolean } | null = null;
    protected presentResult(victory: boolean): void {
      super.presentResult(victory); const r = this.gResult; if (!r || !this.resultPanel) return; const { kills, best, record } = r;
      for (const o of [...this.resultPanel.list]) if (o.name.startsWith('gauntlet-face')) o.destroy();
      // 电脑版：底下一行战况换成本模式的（第几阵 · 斩将 · 用时 · 最高连斩）；斩将头像排在分隔线下面
      (this.resultPanel.getByName('result-stats') as Phaser.GameObjects.Text | null)?.setText([`第 ${this.gWave} 阵`, `斩将 ${kills} 位`, '用时 ' + this.formatTime(this.elapsed), `最高连斩 ${best}${record ? '（新纪录）' : ''}`].join('　·　'));
      // 斩将一排（11-21 总制作人「头像太小」）：每位一块同尺寸的底牌，人像裁掉留白后等比放进底牌、脚踩同一条底线，名字在牌下；最多 12 位（无尽多了取最后 12 位）
      const row = this.gKills.slice(-12), n = row.length; if (!n) return;
      const PW = 76, PH = 92, gap = n > 10 ? 10 : 16, w = n * PW + (n - 1) * gap, x0 = this.resultTexts.subtitle.x - w / 2 + PW / 2, top = this.resultTop + 146, cy = top + PH / 2;
      row.forEach((b, i) => {
        const x = x0 + i * (PW + gap), plate = this.add.rectangle(x, cy, PW, PH, 0x1a120b, .72).setStrokeStyle(1.5, 0xd9b46a, .8).setScrollFactor(0).setName('gauntlet-face-plate');
        const img = this.add.image(x, top + PH - 6, this.portrait(b)).setOrigin(.5, 1).setScrollFactor(0).setName('gauntlet-face'); img.setScale(Math.min((PW - 10) / img.width, (PH - 12) / img.height));
        const t = this.add.text(x, top + PH + 7, b.name, { fontFamily: HEADING_FONT, fontSize: '15px', color: '#f0dcae', resolution: 2 }).setOrigin(.5, 0).setStroke('#1a120b', 3).setScrollFactor(0).setName('gauntlet-face-name');
        this.resultPanel.add([plate, img, t]);
      });
      // 奖励格挪到头像排下面（基类按分隔线到要事之间居中摆，会和头像排重叠）
      const rw = this.resultPanel.getByName('result-rewards') as Phaser.GameObjects.Container | null, below = top + PH + 36;
      if (rw) { const empty = rw.list.length === 1 && rw.list[0] instanceof Phaser.GameObjects.Text; /* 「本场没有新的奖励」一行字：容器原点在字中间 */ rw.setY(Math.max(rw.y, empty ? below + 14 : below)); }
    }
    /** 测试用：当前名将控制器（招式框架 / 专属）。 */
    get gauntletCtrl() { return this.gCtrl; }
    /** 测试用：十阵进度条。 */
    get gauntletTrack() { return this.gTrack; }
    /** 测试用：当前名将控制器的状态（招式框架 / 专属 / 华雄徐荣原生）。 */
    /** 测试用：随身布置、护卫、三擒剩几次。 */
    get gauntletExtras() { return { hill: this.gHill ? { up: this.combatNow >= this.gHill.upAt, playerIn: this.hillHasPlayer(), x: Math.round(this.gHill.x), y: Math.round(this.gHill.y) } : null, band: { ...this.gBandStats, pending: this.gBandCells.length }, strikes: this.gStrikes ? { ...this.gStrikes.metrics } : null, forts: ((this.gCtrl as unknown as { forts?: Enemy[] } | null)?.forts ?? []).filter(f => f.active).length, armorBurned: this.gArmorBurned, props: this.gProps.map(p => ({ art: p.art, broken: p.broken, active: p.e.active })), propsMul: this.propsMul(), pinned: !!this.gPin, escort: this.gEscort ? { name: this.gEscort.name, hp: Math.round(this.gEscort.e.hp), max: this.gEscort.e.maxHp, leaving: this.gEscort.leaving, active: this.gEscort.e.active } : null, rises: this.gRises }; }
    get gauntletState(): string | null { const c = (this.gCtrl ?? this.huaxiong ?? this.xurong) as { state?: string } | null; return c?.state ?? null; }
    get gauntletFollowers() { return this.gFollowers; }
    /** 测试用：卡池全开改的全局开关 / 上限（离开本模式后应放回）。 */
    get gauntletCaps() { return { mech: MECH_FLAGS.allMechanics, rank: BuildState.rankCap, slot: BuildState.slotCap, extra: RunGrowth.extraCap, over: WEAPON_OVER.cap }; }
    /** 测试用：从 0 开局（等级 / 加点 / 星图 / 兵装 / 信物 / 坐骑 / 武将谱）、卡池上限、换一批 / 排除、本阵兵种。 */
    get gauntletFrom0() {
      const g = this.player.growth, gear = g.gear as unknown as Record<string, unknown>, W = waveTroopSet(this.gWave);
      return { level: this.player.level, xp: Math.round(this.player.xp), soft: this.player.softLevel, attrs: Object.values(g.attributes).reduce((n, v) => n + v, 0), unallocated: g.unallocated, heroFree: g.heroFree, stars: g.stars.length,
        gear: Object.entries(gear).filter(([k, v]) => k !== 'specials' && typeof v === 'number' && v !== 0).length + g.gear.specials.length, charms: this.charmInfo?.treasures.length ?? 0, charmHp: this.charmInfo?.hp ?? 0, mount: !!this.mount, temper: g.temperDamage, xinde: g.xinde.length,
        caps: this.gauntletCaps,
        reroll: { free: this.gRerollFree, paid: this.gRerollPaid, cost: this.rerollCost(), label: this.rerollLabel(this.rerollCost()) }, excludes: this.gExcludes, excluded: [...this.gExcluded], excluding: this.gExcluding,
        troops: { arc: W.troops.arc, name: W.troops.name, inf: this.chapter.enemies.infantry.hp, tex: Object.fromEntries((['infantry', 'shield', 'archer', 'cavalry', 'elite'] as const).map(k => [k, this.chapter.enemies[k].walkVisual?.texture ?? this.chapter.enemies[k].texture])) } };
    }
  };
}
