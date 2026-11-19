import { IS_DESKTOP_APP, desktop } from '../platform/desktop';
import { hotkeySettingsLink } from '../ui/HotkeySettingsUI';
import { confirmLord, defaultHero, ensureLegacyLord, heroOwned, lordFinal, lordHero, lordRules, setLord } from '../systems/RosterStore';
import {tutorialReplayLink} from '../ui/TutorialOverlay';
import { showLordNotice } from '../ui/LordNotice';
import {playMenuMusic,menuMusic} from '../systems/Music';
import {artStyle,setArtStyle} from '../systems/ArtStyle';
import { iffOutlineEnabled, setIffOutline, warmIffTextures } from '../systems/IffOverlay';
import { DEATHFX_LABEL, deathFxSetting, setDeathFx, type DeathFxSetting, OUTLINE_LABEL, cycle, outlineMode, setOutlineMode, shakeLevel, setShakeLevel, SHAKE_LABEL, type ShakeLevel, WIDTH_LABEL, outlineWidth, setOutlineWidth, DAMAGE_LABEL, damageNumbers, setDamageNumbers, SCALE_LABEL, renderScaleSetting, setRenderScaleSetting, type DamageNumbers, type RenderScaleSetting, STORY_LABEL, storyMode, setStoryMode, OPENING_LABEL, openingMode, setOpeningMode, type OpeningMode } from '../systems/BattleSettings';
import {uiSfx} from '../systems/Sfx';
import {GameCodex} from '../ui/GameCodex';
import {HeroWarCard} from '../ui/HeroWarCard';
import {CampaignChronicle} from '../ui/CampaignChronicle';
import {attachHomeVideo} from '../ui/HomeVideo';
import {homeCommand,warPanelTexture,inkSkin} from '../ui/HomeCommand';
import {SaveSlotsUI} from '../ui/SaveSlotsUI';
import {AchievementsUI} from '../ui/AchievementsUI';
import {homePlaque} from '../ui/HomePlaque';
import {checkWorld,ACHIEVEMENTS,unlockedMap} from '../systems/Achievements';
import {HomeHeroPicker} from '../ui/HomeHeroPicker';
import {dongzhuoStageUnlocked,nextDongzhuoStage,yellowStageUnlocked,loadWorld,worldUnlocked,alertLossWarning} from '../world/WorldStore';
import Phaser from 'phaser';
import {CUTSCENE_PREVIEW} from '../data/cutscenes';
import { WAR, ensureWarTextures, warFrame } from '../ui/WarStyle';
import { CHAPTERS, YELLOW_STAGES,DONGZHUO_STAGES, getChapter, type YellowStage, type ChapterId } from '../data/chapters';
import { CHARACTERS, HOME_ART_HEROES, type RunConfig } from '../data/characters';
import { CHARACTER_PASSIVES } from '../data/passives';
import { WEAPON_META,weaponName } from '../data/upgrades';
import { chapterOneCleared, chapterUnlocked, isChapterTestRun } from '../systems/ChapterProgress';
import { FONT, TITLE_FONT, HEADING_FONT, GAME_HEIGHT as H, GAME_WIDTH as W, IS_DESKTOP as D, switchLayout } from '../config';
import { lqDivider, lqHitBox, lqPanel, lqSkin } from '../ui/LacquerKit';
import { buildSettingsPanel, type SettingSpec } from '../ui/SettingsPanel';
import { BARKS_LABEL, heroBarks, setHeroBarks, type HeroBarks, SCHOOL_HINT_LABEL, schoolHint, setSchoolHint, type SchoolHint } from '../systems/BattleSettings';
import { CHAPTER_SCENES, openChapterSelect } from '../ui/ChapterSelect';
import { requestDirectDepart } from '../systems/DirectDepart';
import type { TimelineChapterId } from '../world/ChapterTimeline';

const ROLES = ['游龙先锋 · 灵动突刺', '重甲武圣 · 横扫千军', '百步神射 · 远程压制', '卧龙军师 · 火阵爆发'];
const PASSIVE_HINTS = [
  '命中积攒龙胆，满七层强化下一次龙枪。',
  '横斩命中怪群蓄势，强化斩击范围与伤害。',
  '重箭命中积蓄势，满五层进入神射。',
  '无首领时天火每发都积星象，第四发算无遗策。',
];
interface ChapterCard { id: ChapterId; bg: Phaser.GameObjects.Rectangle; name: Phaser.GameObjects.Text; tag: Phaser.GameObjects.Text; hint: Phaser.GameObjects.Text; decor: Phaser.GameObjects.Graphics; }
interface HeroCard { bg: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Image; badge: Phaser.GameObjects.Text; decor: Phaser.GameObjects.Graphics; }

/** Preparation only. Chapter persistence lives in ChapterProgress, combat stays in GameScene. */
export class MenuScene extends Phaser.Scene {
  /** 手机长屏：首页按960设计的内容整体下移一半多出的高度，保持居中；背景与贴底元素仍按真实高度。 */
  private get padY(): number { return D ? 0 : Math.max(0, Math.round((H - 960) / 2)); }
  private selectedWestStage:YellowStage=1;private westModal?:Phaser.GameObjects.Container;private westRows:Array<{bg:Phaser.GameObjects.Rectangle;status:Phaser.GameObjects.Text;stage:YellowStage;decor:Phaser.GameObjects.Graphics;icon:Phaser.GameObjects.Image}>=[];
  private westDeploy?:Phaser.GameObjects.Rectangle;private westDeployLabel?:Phaser.GameObjects.Text;
  private selectedStage:YellowStage=1;
  private stageTabs:Phaser.GameObjects.Text[]=[];
  private compactHome=false;
  private heroModal?:Phaser.GameObjects.Container;
  private homeCard?:HeroWarCard;
  private heroPicker?:HomeHeroPicker;private heroEntryPaint?:(state?:string)=>void;
  private homeBackground?:Phaser.GameObjects.Image;
  private homePortrait?:Phaser.GameObjects.Image;
  private started = false;
  private selectedChar = 0;
  private selectedChapter: ChapterId = 'huangjin';
  private chapterButtons: ChapterCard[] = [];
  private charCards: HeroCard[] = [];
  private weapon!: Phaser.GameObjects.Text;
  private passive!: Phaser.GameObjects.Text;
  private heroName!: Phaser.GameObjects.Text;
  private passiveName!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Rectangle;
  private startLabel!: Phaser.GameObjects.Text;
  constructor() { super('MenuScene'); }
  create(): void {playMenuMusic(this);
    ensureWarTextures(this);
    this.cameras.main.fadeIn(180,0,0,0);
    // 2026-11-15 用户要求：开局每次从本章第 1 关打起（原为“下一个未通关”）。
    // 2026-11-18 修「退出后再进入，之前学习的武将技能和武器强化都没有了」：征程构筑（2026-11-17 用户批准）只在未通关的主线关读入，
    // 已通关的关算「重打旧关」、用空构筑；从主页再进总是 1-1 / 2-1（已通关）→ 构筑「丢了」。现在主页出征接着本章下一个未通关的关（征程存档点，
    // 与选关面板 pickChapter 一致）；本章全通了才从第 1 关起。想重打前面的关仍可在选关 / 战役回顾中选（重打用空构筑）。
    {const w=loadWorld();this.selectedStage=(w.yellowStages>=1&&w.yellowStages<3?w.yellowStages+1:1) as YellowStage;this.selectedWestStage=(w.dongzhuoStages>=1&&w.dongzhuoStages<3?w.dongzhuoStages+1:1) as YellowStage;}
    this.stageTabs=[];
    this.westRows=[];this.westModal=undefined;this.westDeploy=undefined;this.westDeployLabel=undefined;
    this.started = false; this.chapterButtons = []; this.charCards = [];
    const params = new URLSearchParams(window.location.search), saved = this.registry.get('runConfig') as RunConfig | undefined;
    // 过场动画预览（?dev=1&cutscene=<id>[&hero=<武将>]）：直接开那一关，GameScene 推到过场处自动播
    { const cs = params.get('cutscene'), pv = cs && params.has('dev') ? CUTSCENE_PREVIEW[cs] : undefined;
      if (cs && pv) { this.registry.remove('campaignTransfer'); this.registry.set('cutscenePreview', cs); this.registry.set('runConfig', { chapter: pv.chapter, westStage: pv.westStage, character: params.get('hero') ?? 'zhaoyun' } as RunConfig); this.time.delayedCall(60, () => this.scene.start('GameScene')); } }
    if(isChapterTestRun()&&['1','2','3'].includes(params.get('stage')??''))this.selectedStage=Number(params.get('stage')) as YellowStage;
    const fromWorld=this.registry.has('selectedWorldChapter');
    // 天下地图点选的关卡（黄巾 / 讨董）；乱世难度只对从地图出征有效
    const worldStage=Number(this.registry.get('selectedWorldStage'));if(!fromWorld)this.registry.remove('hardChapter');
    const expanded=fromWorld||this.registry.get('menuChapterPicker')===true||((params.has('autostart')||params.has('perf'))&&params.has('chapter'));
    this.registry.remove('menuChapterPicker');this.compactHome=!expanded;this.homeCard=undefined;this.heroPicker=undefined;this.heroEntryPaint=undefined;this.heroModal=undefined;this.homePortrait=undefined;this.homeBackground=undefined;
    const requested = getChapter(this.registry.get('selectedWorldChapter') ?? params.get('chapter') ?? (chapterOneCleared()?'hulao':saved?.chapter)).id;
    const west=Number(this.registry.get('selectedWorldStage')??params.get('westStage')??(isChapterTestRun()&&requested==='hulao'?params.get('stage'):undefined)??this.selectedWestStage);
    this.registry.remove('selectedWorldStage');if([1,2,3].includes(west)&&(dongzhuoStageUnlocked(west)||isChapterTestRun()))this.selectedWestStage=west as YellowStage;
    this.registry.remove('selectedWorldChapter');
    this.selectedChapter = chapterUnlocked(requested)||isChapterTestRun() ? requested : 'huangjin';
    if(fromWorld&&this.selectedChapter==='huangjin'&&[1,2,3].includes(worldStage)&&(yellowStageUnlocked(worldStage)||isChapterTestRun()))this.selectedStage=worldStage as YellowStage;
    // 主公（用户规则 2026-11-16）：主公规则之前的老存档，按最近出战的武将自动定主公（留一次改选机会）
    ensureLegacyLord();
    let lastHero=saved?.character;try{lastHero=localStorage.getItem('im_last_hero') as RunConfig['character']||lastHero;}catch{}
    this.selectedChar = params.has('autostart') || params.has('perf') ? 0 : Math.max(0, CHARACTERS.findIndex(c => c.id === defaultHero(lastHero)));
    if(this.compactHome){if(!(isChapterTestRun()&&params.has('chapter')))this.selectedChapter=chapterOneCleared()||loadWorld().legacyHulaoAccess?'hulao':'huangjin';this.createLanding(params);return;}
    this.cameras.main.resetFX(); this.cameras.main.setBackgroundColor('#101813');
    const text = (x: number, y: number, value: string, size: number, color = '#ede4cc') => this.add.text(x, y, value, { fontFamily: size>=18?HEADING_FONT:FONT, fontSize: `${size}px`, color, resolution: 2 });
    if (this.textures.exists('ground_hulao')) this.add.tileSprite(0, 0, W, H, 'ground_hulao').setOrigin(0).setAlpha(.16); // 手机精简启动时战斗图集还没载入
    this.add.rectangle(0, 0, W, H, 0x0b1612, .82).setOrigin(0);
    if (this.textures.exists('vignette')) this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(.65);
    const frame = this.add.graphics();
    frame.lineStyle(1, 0x977e4e, .3).strokeRect(12, 12, W - 24, H - 24);
    for (const x of [12, W - 12]) for (const y of [12, H - 12]) {
      const sx = x < W / 2 ? 1 : -1, sy = y < H / 2 ? 1 : -1;
      frame.lineStyle(2, 0xc9ad70, .8).lineBetween(x, y, x + sx * 28, y).lineBetween(x, y, x, y + sy * 28);
    }
    text(28,D?22:48,'乱世千军',D?36:42,'#efd493').setFontFamily(TITLE_FONT).setLetterSpacing(3);
    text(D ? 196 : 30, D ? 32 : 99, '三国割草 · 将星出征', D ? 13 : 14, '#8eaa9c');
    // 2026-11-17 用户「右上角天下地图和营寨可以不需要」：电脑版右上只留「成就」；营寨改从「择章」页右上角进入（营寨里有「天下地图 · 出征」）
    if(!D)text(W-130,D?29:59,worldUnlocked()||isChapterTestRun()?'营寨':'营寨未开放',12,'#d9c58d').setOrigin(1,0).setPadding(8,6).setInteractive({useHandCursor:true}).on('pointerdown',()=>{if(worldUnlocked()||isChapterTestRun())this.scene.start('CityScene');});
    const layout = text(W - 28, D ? 29 : 59, D ? '手机布局' : '电脑布局', 12, '#acb5a0').setOrigin(1, 0).setPadding(6, 6).setInteractive({ useHandCursor: true }).setVisible(!IS_DESKTOP_APP);
    layout.on('pointerdown', () => switchLayout(D ? 'mobile' : 'desktop')).on('pointerover', () => layout.setColor('#f1d69a')).on('pointerout', () => layout.setColor('#acb5a0'));
    const section = (y: number, n: string, title: string, tip: string) => {
      text(28, y, n, 12, '#63a99a'); text(55, y - 2, title, 15, '#d5c397');
      text(W - 28, y, tip, 11, '#829488').setOrigin(1, 0);
    };
    section(D ? 78 : 143, '壹', '选择战役', chapterOneCleared() ? '战役进度已保存' : '首战 · 黄巾之乱');
    CHAPTERS.forEach((chapter, i) => {
      const width = (W - 68) / 2, x = 28 + width / 2 + i * (width + 12), y = D ? 139 : 216, height = D ? 82 : 108;
      this.add.image(x,y,'ui_war_panel').setDisplaySize(width,height);
      const bg = this.add.rectangle(x, y, width, height, 0x182b23).setInteractive({ useHandCursor: true });
      const decor = this.add.graphics();
      text(x - width / 2 + 16, y - height / 2 + 12, i === 0 ? '第一章' : '第二章', 11, '#87a392');
      const tag = text(x + width / 2 - 12, y - height / 2 + 9, '', 11).setOrigin(1, 0).setPadding(5,3).setBackgroundColor('#12291f');
      const name = text(x - width / 2 + 16, y - (D ? 2 : 7), chapter.name, D ? 21 : 20, '#ead5a7').setOrigin(0, .5);
      const hint = text(x - width / 2 + 16, y + (D ? 23 : 27), '', D ? 12 : 13, '#a6b8ab').setOrigin(0, .5);
      bg.on('pointerdown', () => { if (!chapterUnlocked(chapter.id)&&!isChapterTestRun()) return; this.selectedChapter = chapter.id; this.renderSelection();if(chapter.id==='hulao')this.westModal?.setVisible(true); });
      bg.on('pointerover', () => { if (chapterUnlocked(chapter.id) && this.selectedChapter !== chapter.id) bg.setFillStyle(0x263c30).setStrokeStyle(1, 0xa6b996); });
      bg.on('pointerout', () => this.renderSelection());
      this.chapterButtons.push({ id: chapter.id, bg, name, tag, hint, decor });
      if(i===0)for(const stage of YELLOW_STAGES){const tab=text(x-width/2+16+(stage.stage-1)*(width-24)/3,y+(D?16:29),`1-${stage.stage}`,D?12:14).setPadding(5,4).setInteractive({useHandCursor:true});tab.on('pointerdown',()=>{if(!yellowStageUnlocked(stage.stage)&&!isChapterTestRun())return;this.selectedStage=stage.stage;this.selectedChapter='huangjin';this.renderSelection();});this.stageTabs.push(tab);}

    });
    section(D ? 195 : 287, '贰', '选择武将', '诸将各有所长');
    const nH = CHARACTERS.length, mCols = nH > 4 ? 3 : 2, cardW = D ? (W - 56 - 12 * (nH - 1)) / nH : (W - 56 - 12 * (mCols - 1)) / mCols, cardH = D ? 162 : 164;
    CHARACTERS.forEach((c, i) => {
      const x = 28 + cardW / 2 + (D ? i : i % mCols) * (cardW + 12), y = D ? 291 : 389 + Math.floor(i / mCols) * 178;
      this.add.image(x,y,'ui_war_panel').setDisplaySize(cardW,cardH);
      const bg = this.add.rectangle(x, y, cardW, cardH, 0x15251e).setInteractive({ useHandCursor: true });
      const decor = this.add.graphics();
      const icon = this.add.image(x, y - 25, c.portrait);
      const max = D ? 95 : 98; icon.setScale(Math.min(max / icon.width, max / icon.height)); if (c.tint) icon.setTint(c.tint);
      text(x, y + 39, c.name, D ? 22 : 23, '#f0e5c6').setOrigin(.5);
      text(x, y + 64, ROLES[i], D ? 11 : 14, '#9cb7a7').setOrigin(.5);
      const badge = text(x + cardW / 2 - 10, y - cardH / 2 + 9, '出战', 11, '#f3d89a').setOrigin(1, 0).setPadding(5,3).setBackgroundColor('#16352a');
      if (!heroOwned(c.id)) icon.setAlpha(.35);
      bg.on('pointerdown', () => { if (!heroOwned(c.id)) return; this.selectedChar = i; this.renderSelection(); });
      bg.on('pointerover', () => { if (this.selectedChar !== i) bg.setFillStyle(0x253b2e).setStrokeStyle(1, 0xa7b995); });
      bg.on('pointerout', () => this.renderSelection());
      this.charCards.push({ bg, icon, badge, decor });
    });
    const top = D ? 384 : 666, detailsHeight = D ? 76 : 126;
    this.add.rectangle(W / 2, top + detailsHeight / 2, W - 56, detailsHeight, 0x142a23).setStrokeStyle(1, 0x3d6151);
    this.add.rectangle(29, top + detailsHeight / 2, 3, detailsHeight, 0x6cae99);
    this.heroName = text(44, top + 10, '', D ? 20 : 21, '#efd496');
    this.weapon = text(44, top + 41, '', D ? 13 : 16, '#c8d6c9');
    this.passiveName = text(D ? W * .45 : 44, top + (D ? 12 : 69), '', 13, '#79bdab');
    this.passive = text(D ? W * .45 : 44, top + (D ? 39 : 94), '', D ? 12 : 15, '#aabdac').setWordWrapWidth(D ? W * .5 : W - 88);
    const startY = D ? 490 : 842, startW = D ? 360 : W - 112, startH = D ? 48 : 64;
    this.startButton = this.add.rectangle(W / 2, startY, startW, startH, 0xc7aa65).setStrokeStyle(1, 0xf3dca2).setInteractive({ useHandCursor: true });
    this.startLabel = text(W / 2, startY, '', D ? 22 : 24, '#16251c').setFontStyle('bold').setOrigin(.5);
    const ornament = this.add.graphics().lineStyle(1, 0xe5ca8c, .55);
    ornament.lineBetween(W / 2 - startW / 2 - 30, startY, W / 2 - startW / 2 - 10, startY).lineBetween(W / 2 + startW / 2 + 10, startY, W / 2 + startW / 2 + 30, startY);
    this.startButton.on('pointerdown', () => this.startGame()).on('pointerover', () => { if (!this.started && chapterUnlocked(this.selectedChapter)) this.startButton.setFillStyle(0xe0c17b); }).on('pointerout', () => this.renderSelection());
    text(W / 2, D ? 522 : 890, isChapterTestRun() ? '测试模式 · 调试战斗不记录章节通关' : '开局直接战斗 · 第一波结束后招募援兵', D ? 10 : 12, '#7e9283').setOrigin(.5);
    const keyboard = this.input.keyboard;
    const bind = (key: string, action: () => void) => { keyboard?.on(key, action); this.events.once('shutdown', () => keyboard?.off(key, action)); };
    bind('keydown-ENTER', () => this.startGame()); bind('keydown-L', () => switchLayout(D ? 'mobile' : 'desktop'));
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((key, i) => bind(`keydown-${key}`, () => { this.selectedChar = i; this.renderSelection(); }));
    // 返回首页：原先是贴着画面底边的小字（电脑版被裁掉，进来就出不去），改为明显按钮 + Esc。
    const home=homeCommand(this,D?112:W/2,D?490:932,D?150:200,D?44:42,'返回首页');home.hit.setName('review-home').on('pointerdown',()=>this.scene.restart());
    bind('keydown-ESC',()=>this.scene.restart());
    this.createWestPicker();this.renderSelection();
    if (params.has('autostart') || params.has('perf')) this.time.delayedCall(80, () => this.startGame());
  }
  private createLanding(params:URLSearchParams):void {
    this.cameras.main.setBackgroundColor('#201710');
    const text=(x:number,y:number,value:string,size:number,color='#e8d8b2')=>this.add.text(x,y,value,{fontFamily:size>=18?HEADING_FONT:FONT,fontSize:`${size}px`,color,resolution:2}).setOrigin(.5);
    const epicBackground='epic_bg_'+(this.selectedChapter==='hulao'?'dongzhuo':'huangjin')+'_'+(D?'desktop':'mobile');
    const bg=this.add.image(W/2,H/2,this.textures.exists(epicBackground)?epicBackground:'rest_camp');bg.setScale(Math.max(W/bg.width,H/bg.height));this.homeBackground=bg;bg.setDepth(-2);this.ensureHomeArt();if(this.selectedChapter==='huangjin')attachHomeVideo(this,W,H);
    const shade=this.add.graphics();shade.fillStyle(0x100b08,.14).fillRect(0,0,W,H);for(let y=0;y<H;y+=8){const a=y<H*.24?.36*(1-y/(H*.24)):y>H*.55?.82*(y-H*.55)/(H*.45):0;if(a>0)shade.fillStyle(0x100b08,a).fillRect(0,y,W,8);}
    if(D){const titleShade=this.add.graphics();for(let i=0;i<40;i++){const k=i/40;titleShade.fillStyle(0x0f0a06,.02+k*.012).fillEllipse(230,92,430*(1-k*.8),150*(1-k*.8));}}
    // 2026-11-17 用户定水墨标题字（「这个可以」）：assets/ui/title_wordmark.webp（tools/logo-wordmark.mjs HALO=1 排出，带米色晕光，深底上也看得清）；缺图时退回文字标题
    if(this.textures.exists('title_wordmark')){const tw=D?240:140,tm=this.add.image(D?230:W/2,D?64:108+this.padY,'title_wordmark').setName('home-title-wordmark');tm.setScale(tw/tm.width);this.textures.get('title_wordmark').setFilter(Phaser.Textures.FilterMode.LINEAR);}
    else{text(D?230:W/2,D?22:84+this.padY,'三  国',D?26:20,'#e6c88c').setFontFamily(TITLE_FONT).setLetterSpacing(10).setShadow(0,2,'#130a05',2,true,true);
    text(D?230:W/2,D?58:112+this.padY,'乱世千军',D?52:36,'#efd399').setFontFamily(TITLE_FONT).setLetterSpacing(4).setShadow(0,3,'#130a05',2,true,true);}
    const west=this.selectedChapter==='hulao',save=loadWorld(),info=west?DONGZHUO_STAGES[this.selectedWestStage-1]:YELLOW_STAGES[this.selectedStage-1];
    // 2026-11-17 用户「不需要太多字」：电脑版去掉标题下题词、右侧章名 / 关名 / 简介（点「匡扶汉室」进章节选择看进度）
    if(!D)text(W/2,148+this.padY,west?'汉末烽烟 · 诸侯并起，挥师讨董':'苍天已乱 · 黄巾四起，义军初兴',16,'#d0bea1').setShadow(0,1,'#0b0604',4,true,true);
    const cx=D?W*.73:W/2;
    if(!D){const readingShade=this.add.graphics();for(let i=0;i<48;i++){const t=i/48;readingShade.fillStyle(0x0f0c09,.018+t*.01).fillEllipse(cx,D?160:758+this.padY,(D?440:W-12)*(1-t*.85),(D?230:176)*(1-t*.85));}if(D){readingShade.lineStyle(1,0xc9a66a,.45).lineBetween(cx-110,178,cx-12,178).lineBetween(cx+12,178,cx+110,178).fillStyle(0xd8b676,.8).fillRect(cx-4,174,8,8);}
    text(cx,D?104:26+this.padY,west?'第二章 · 讨伐董卓':'第一章 · 黄巾之乱',15,'#e4c38d');
    text(cx,D?142:63+this.padY,isChapterTestRun()?`${west?'2':'1'}-${west?this.selectedWestStage:this.selectedStage}  ${info.name}`:info.name,D?31:33,'#f4dfb5').setShadow(0,2,'#0b0604',4,true,true);
    }
    if(!D)text(cx,D?210:758+this.padY,save.cleared.hulao?'天下已开。重整兵马，再赴征途。':west?'群雄会盟，关隘烽烟。挥师西进，问鼎中原。':'黄巾四起，烽火蔓延。整备义军，踏上征途。',14,'#e2d4bd').setShadow(0,1,'#0b0604',4,true,true).setWordWrapWidth(D?310:W-96).setAlign('center');
    this.homeCard=new HeroWarCard(this,D?80:104,D?127:180+this.padY,D?300:332,D?321:410);this.homeCard.setSelected(true);if(D)this.homeCard.setCompact(true);this.homeCard.root.setName('current-hero-card');
    // 点击武将卷轴直接打开“更换武将”（原为折叠卡片，卷轴折叠态显示破碎，已取消）。
    // 点击卷轴：收起/展开（状态保留到返回首页）；更换武将只走下方按钮
    const startFolded=this.registry.get('heroCardFolded')===true;if(startFolded)this.homeCard.setFolded(true);
    this.homePortrait=this.homeCard.art;this.heroName=this.homeCard.name;this.weapon=this.homeCard.weapon;
    this.passiveName=text(-1000,-1000,'',13).setVisible(false);this.passive=text(-1000,-1000,'',13).setVisible(false);
    const navY=D?484:631+this.padY;
    const heroEntry=homeCommand(this,D?230:W/2,navY,D?220:220,D?46:64,'更换武将');const pick=heroEntry.hit.setName('choose-hero');this.heroEntryPaint=heroEntry.paint;
    // 主公已定：入口改成「主公 · xx」并锁住；老存档还有一次改选机会时显示「改选主公」
    const paintLord=()=>{const l=lordRules()?lordHero():null;if(!l)return;const n=CHARACTERS.find(c=>c.id===l)?.name??'';if(lordFinal()){heroEntry.caption.setText('主公 · '+n);pick.disableInteractive();pick.setData('locked',true);}else heroEntry.caption.setText('改选主公');};paintLord();
    // 卷轴收起时，“更换武将”跟着卷轴上移（与卷轴底保持原间距）；展开时回到原位
    const card=this.homeCard,entryY=(folded:boolean)=>navY-(card.height-card.heightWhen(folded));
    if(startFolded)heroEntry.setY(entryY(true));
    card.hit.on('pointerup',()=>{const next=!card.isFolded;this.registry.set('heroCardFolded',next);card.setFolded(next,true);const sfx=uiSfx();sfx.unlock();sfx.play('uiClick');
      const from=heroEntry.y,to=entryY(next);this.tweens.addCounter({from:0,to:1,duration:380,ease:'Cubic.easeInOut',onUpdate:tw=>heroEntry.setY(from+(to-from)*(tw.getValue()??0))});});
    // 底部一行：存档 · 图鉴 · 战役回顾 · 设置（· 退出游戏，仅桌面版）
    const navItems=IS_DESKTOP_APP?5:4,navX=(k:number)=>D?cx+(k-(navItems-1)/2)*(navItems>4?100:116):W*(.14+k*.24),navRowY=D?476:924+this.padY;
    this.homeSaveButton(navX(0),navRowY);
    if(IS_DESKTOP_APP)this.homeQuitButton(navX(4),navRowY);
    // 战役回顾：乱世编年（已平定的关显示史录，未打到的锁住）；“前往选关”沿用原入口。
    text(navX(2),navRowY,'战役回顾',D?18:20,'#e5ccb0').setLetterSpacing(D?2:0).setPadding(16,16).setInteractive({useHandCursor:true}).setName('home-review').on('pointerdown',()=>{if(this.children.getByName('campaign-chronicle'))return;new CampaignChronicle(this,arc=>{if(arc==='qunxiong'){requestDirectDepart(this);this.scene.start('ThirdChapterScene');return;}if(arc==='chibi'){requestDirectDepart(this);this.scene.start('ChibiChapterScene');return;}if(arc==='guandu'){requestDirectDepart(this);this.scene.start('GuanduChapterScene');return;}this.registry.set('menuChapterPicker',true);this.scene.restart();},(arc,stage)=>this.replayStage(arc,stage));});
    text(navX(3),navRowY,'设置',D?18:20,'#e5ccb0').setLetterSpacing(4).setPadding(18,16).setInteractive({useHandCursor:true}).setName('home-settings').on('pointerdown',()=>this.openHomeSettings());
    text(navX(1),navRowY,'图鉴',D?18:20,'#e5ccb0').setLetterSpacing(4).setOrigin(.5,.5).setPadding(12,16).setInteractive({useHandCursor:true}).setName('home-codex').on('pointerdown',()=>{if(this.children.getByName('game-codex'))return;this.ensureHomeArt(true);new GameCodex(this,index=>{if(!heroOwned(CHARACTERS[index].id))return;this.selectedChar=index;this.registry.set('heroConfirmed',true);try{localStorage.setItem('im_last_hero',CHARACTERS[index].id);}catch{}this.renderSelection();});});
    // 成就入口（右上角；天下已开时排在主城 / 天下地图左侧）
    try{checkWorld(save);}catch{/* 存档不可用 */}
    {const got=Object.keys(unlockedMap()).filter(id=>ACHIEVEMENTS.some(a=>a.id===id)).length,py=D?34:54;let rx=W-24;
     if(worldUnlocked()&&!D){rx-=homePlaque(this,rx,py,{label:'营寨',name:'home-city',glyph:'营',onClick:()=>this.scene.start('CityScene')},D)+8;rx-=homePlaque(this,rx,py,{label:'天下地图',name:'home-world',glyph:'图',onClick:()=>this.scene.start('WorldMapScene')},D)+8;}
     homePlaque(this,rx,py,{label:'成就',name:'home-achievements',icon:'ach_first_win',progress:[got,ACHIEVEMENTS.length],onClick:()=>{if(!this.children.getByName('achievements-panel'))new AchievementsUI(this);}},D);
     // 2026-11-16 用户：「界面的行囊可以不要」——主页不再放行囊匾；行囊仍可在战斗 HUD、暂停菜单、行营休整（换装换马）里打开。
    }
    if(!D&&west&&!save.dongzhuoStages){const reveal=text(W/2,D?157:228+this.padY,'新篇揭晓 · 讨伐董卓',15,'#f0c389').setAlpha(0);this.tweens.add({targets:reveal,alpha:1,duration:700});}
    const closeHeroes=()=>{this.heroModal?.setVisible(false);this.heroEntryPaint?.();};
    this.heroPicker=new HomeHeroPicker(this,index=>{if(lordRules()&&!setLord(CHARACTERS[index].id).ok)return;paintLord();this.selectedChar=index;this.registry.set('heroConfirmed',true);try{localStorage.setItem('im_last_hero',CHARACTERS[index].id);}catch{}closeHeroes();this.renderSelection();},closeHeroes);
    this.heroModal=this.heroPicker.root;const modal=this.heroModal;
    const openHeroes=()=>{this.ensureHomeArt(true);this.heroPicker?.open(this.selectedChar);this.heroEntryPaint?.('selected');};pick.on('pointerdown',openHeroes);
    {const l=lordRules()?lordHero():null;if(l&&!lordFinal()&&!this.registry.get('lordNoticeShown')){this.registry.set('lordNoticeShown',true);showLordNotice(this,l,()=>{confirmLord();paintLord();},()=>openHeroes());}}
    const startY=D?414:857+this.padY,startW=D?292:W-156,startH=D?56:64;
    const primary=homeCommand(this,D?W*.73:W/2,startY,startW,startH,'匡扶汉室',true);this.startButton=primary.hit.setName('start-campaign').setData('padDefault',true);this.startLabel=primary.caption;
    // W4：有城池告急时提示“出征将失守”
    const lossWarn=isChapterTestRun()?'':alertLossWarning();if(lossWarn)text(D?W*.73:W/2,startY-startH/2-(D?14:16),lossWarn,D?12:13,'#ff8a70').setStroke('#1a0e08',3).setName('home-alert-warning');
    this.startButton.on('pointerdown',()=>{let chosen=!!this.registry.get('heroConfirmed');try{chosen=chosen||!!localStorage.getItem('im_last_hero');}catch{}if(!chosen&&!params.has('autostart')&&!params.has('perf')){openHeroes();return;}if(this.children.getByName('chapter-select'))return;this.campaignEntry();});
    for(let k=0;k<navItems-1;k++)text((navX(k)+navX(k+1))/2,navRowY,'·',D?18:20,'#a68a57');
    if(isChapterTestRun())text(W/2,D?529:955+this.padY,'测试战斗不记录正式进度',10,'#8c806f');
    if(isChapterTestRun())text(W-34,24,'测试选关 ›',14,'#dcc399').setOrigin(1,.5).setPadding(12,10).setInteractive({useHandCursor:true}).setName('dev-stage-picker').on('pointerdown',()=>this.openTestStages());
    const keys=this.input.keyboard,enter=()=>{if(modal.visible)modal.getByName('hero-confirm')?.emit('pointerdown');else this.startButton.emit('pointerdown');},escape=()=>closeHeroes();
    keys?.on('keydown-ENTER',enter);keys?.on('keydown-ESC',escape);this.events.once('shutdown',()=>{keys?.off('keydown-ENTER',enter);keys?.off('keydown-ESC',escape);});
    this.renderSelection();if(params.has('autostart')||params.has('perf'))this.time.delayedCall(80,()=>this.startGame());
  }
  /** 章节选择（2026-11-17）：已打到的章可进，没打到的锁住；第一、二章由主页直接出征，第三章起进各章选关场景。 */
  /**
   * 「匡扶汉室」（2026-11-17 用户：「点匡扶汉室是进入大地图，然后玩家自行选择」）：天下已开 → 直接进天下地图，在地图上选章（未到的章节锁住）；
   * 天下未开（第一章还没打完）→ 直接出征第一章下一关。择章页（openChapters）已不从主页进入，代码暂留。
   */
  private campaignEntry():void{
    if(this.started||this.heroModal?.visible)return;
    if(worldUnlocked()){this.started=true;this.registry.remove('campaignTransfer');this.cameras.main.fadeOut(150,0,0,0);this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,()=>this.scene.start('WorldMapScene'));return;}
    this.startGame();
  }
  openChapters():void{
    if(this.started||this.heroModal?.visible)return;
    openChapterSelect(this,{onPick:(id,stage)=>this.pickChapter(id,stage)});
  }
  private pickChapter(id:TimelineChapterId,stage?:number):void{
    const s=loadWorld();
    if(id==='huangjin'||id==='hulao'){
      const done=id==='huangjin'?s.yellowStages:s.dongzhuoStages,st=(stage??(done>=3?1:done+1)) as YellowStage;
      this.selectedChapter=id;if(id==='huangjin')this.selectedStage=st;else this.selectedWestStage=st;
      this.startGame();return;
    }
    const key=CHAPTER_SCENES[id];if(!key)return;
    this.registry.remove('campaignTransfer');if(stage)this.registry.set('worldStagePick',stage);requestDirectDepart(this);
    this.cameras.main.fadeOut(150,0,0,0);this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,()=>this.scene.start(key));
  }
  /** DEV-only direct entry; campaign unlocks and persistent progress stay untouched. */
  private openTestStages():void {
    if(!isChapterTestRun()||this.children.getByName('dev-stages'))return;
    const modal=this.add.container(0,0).setDepth(600).setName('dev-stages');
    const label=(x:number,y:number,value:string,size=18)=>this.add.text(x,y,value,{fontFamily:FONT,fontSize:size+'px',color:'#ead5b0',resolution:2}).setOrigin(.5);
    modal.add(this.add.rectangle(W/2,H/2,W,H,0x160f0b,.97).setInteractive());
    modal.add(label(W/2,D?52:94,'测试选关',28));
    modal.add(label(W/2,D?88:137,'直接进入 · 不写入正式通关与奖励',13));
    for(const [column,chapter,stages]of [[0,'huangjin',YELLOW_STAGES],[1,'hulao',DONGZHUO_STAGES]] as const){
      const x=D?W*(column? .73:.27):W/2,top=D?150:198+column*310;
      modal.add(label(x,top,column?'第二章 · 讨伐董卓':'第一章 · 黄巾之乱',19));
      for(const [i,info]of stages.entries()){
        const y=top+55+i*(D?70:74),button=homeCommand(this,x,y,D?360:W-72,D?54:60,`${column+1}-${info.stage}  ${info.name} · ${info.boss}`,false);
        modal.add([button.g,button.hit,button.caption]);
        button.hit.setName(`test-stage-${column+1}-${info.stage}`).on('pointerdown',()=>{
          this.selectedChapter=chapter;
          if(chapter==='huangjin')this.selectedStage=info.stage;else this.selectedWestStage=info.stage;
          modal.destroy();this.startGame();
        });
      }
    }
    const back=label(W/2,D?H-40:H-70,'返回首页',20).setPadding(32,14).setInteractive({useHandCursor:true}).setName('dev-stages-close').on('pointerdown',()=>modal.destroy());modal.add(back);
  }
  private ensureHomeArt(all=false):void{
    if(this.load.isLoading()){this.load.once('complete',()=>{if(this.sys.isActive())this.ensureHomeArt(all);});return;}
    const background='epic_bg_'+(this.selectedChapter==='hulao'?'dongzhuo':'huangjin')+'_'+(D?'desktop':'mobile');const files:Array<[string,string]>=[];
    if(!this.textures.exists(background))files.push([background,'assets/epic-home/'+(this.selectedChapter==='hulao'?'dongzhuo':'huangjin')+'-'+(D?'desktop':'mobile')+'.webp']);
    for(const c of all?CHARACTERS:[CHARACTERS[this.selectedChar]]){if(!HOME_ART_HEROES.includes(c.id))continue;if(!this.textures.exists('epic_hero_'+c.id))files.push(['epic_hero_'+c.id,'assets/epic-home/'+c.id+'.webp']);if(!this.textures.exists('ink_hero_'+c.id))files.push(['ink_hero_'+c.id,'assets/ink-scroll/'+c.id+'.webp']);}
    if(!files.length)return;
    for(const [key,url]of files)this.load.image(key,url);
    this.load.once('complete',()=>{if(!this.sys.isActive())return;for(const [key]of files)if(this.textures.exists(key))this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);if(this.homeBackground&&this.homeBackground.scene&&this.textures.exists(background)){this.homeBackground.setTexture(background);this.homeBackground.setScale(Math.max(W/this.homeBackground.width,H/this.homeBackground.height));}this.renderSelection();});this.load.start();
  }
  /** 主页「存档」：3 个存档位。 */
  private homeSaveButton(x:number,y:number):void{
    this.add.text(x,y,'存档',{fontFamily:FONT,fontSize:(D?18:20)+'px',color:'#e5ccb0',resolution:2}).setOrigin(.5).setLetterSpacing(4).setPadding(18,16).setInteractive({useHandCursor:true}).setName('home-saves')
      .on('pointerdown',()=>{if(!this.children.getByName('save-slots-panel'))new SaveSlotsUI(this);});
  }
  /** 主页「退出游戏」（桌面版）：弹出确认。 */
  private homeQuitButton(x:number,y:number):void{
    this.add.text(x,y,'退出',{fontFamily:FONT,fontSize:'18px',color:'#e7b68e',resolution:2}).setOrigin(.5).setLetterSpacing(4).setPadding(18,16).setInteractive({useHandCursor:true}).setName('home-quit')
      .on('pointerdown',()=>this.confirmQuit());
  }
  private confirmQuit():void{
    if(this.children.getByName('quit-confirm')||!desktop)return;
    const app=desktop,modal=this.add.container(0,0).setDepth(560).setName('quit-confirm');
    modal.add(this.add.rectangle(W/2,H/2,W,H,0x0b0806,.82).setInteractive());
    modal.add(this.add.image(W/2,H/2,warPanelTexture(this,420,200,true)).setDisplaySize(436,216));
    modal.add(this.add.text(W/2,H/2-50,'退出游戏？',{fontFamily:HEADING_FONT,fontSize:'26px',color:'#efd399',resolution:2}).setOrigin(.5).setLetterSpacing(4));
    modal.add(this.add.text(W/2,H/2-14,'进度已自动保存',{fontFamily:FONT,fontSize:'13px',color:'#a99d88',resolution:2}).setOrigin(.5));
    const cancel=homeCommand(this,W/2-95,H/2+48,150,46,'取消');cancel.hit.setName('quit-cancel').setData('padDefault',true).on('pointerdown',()=>modal.destroy());
    const ok=homeCommand(this,W/2+95,H/2+48,150,46,'退出游戏',true);ok.hit.setName('quit-ok').on('pointerdown',()=>app.quit());
    modal.add([cancel.g,cancel.hit,cancel.caption,ok.g,ok.hit,ok.caption]);
  }
  /**
   * 军中设置（电脑版，2026-11-18 用户「这里设计ui也要优化」）：一块漆底描金面板，页签 声音 / 画面 / 战斗 / 剧情（桌面版另有「显示」），
   * 音量滑条、开关拨钮、分段选择；重看开场 / 重看新手引导 / 快捷键 / 返回 收在底部一排漆金按钮（不用水墨笔刷）。设置区见 ui/SettingsPanel。
   */
  private openSettingsV2():void{
    const modal=this.add.container(0,0).setDepth(500).setName('home-settings-panel');
    const app=desktop,desk=IS_DESKTOP_APP&&!!app,pw=640,ph=448,x0=W/2-pw/2,y0=H/2-ph/2;
    modal.add(this.add.rectangle(W/2,H/2,W,H,0x0c0805,.9).setInteractive());
    {const g=this.add.graphics();lqPanel(g,x0,y0,pw,ph);modal.add(g);}
    const t=this.add.text(W/2,y0+30,'军中设置',{fontFamily:TITLE_FONT,fontSize:'28px',color:'#efd399',resolution:2}).setOrigin(.5).setStroke('#120904',4);modal.add(t);
    {const div=this.add.graphics();lqDivider(div,W/2,y0+56,150);modal.add(div);}
    const ch=(list:readonly string[],labels:Record<string,string>)=>list.map(v=>({v,label:labels[v]}));
    const music=menuMusic(),sfx=uiSfx(),art0=artStyle(),scale0=renderScaleSetting();
    const specs:SettingSpec[]=[
      {key:'music',name:'音乐',tab:'sound',kind:'slider',get:()=>String(music.getVolume()),set:v=>music.setVolume(Number(v))},
      {key:'sfx',name:'音效',tab:'sound',kind:'slider',get:()=>String(sfx.getVolume()),set:v=>{sfx.setVolume(Number(v));sfx.unlock();sfx.play('uiClick');}},
      {key:'art-style',name:'人物画风',tab:'view',kind:'choice',options:[{v:'v2',label:'新版'},{v:'v1',label:'旧版'}],get:()=>artStyle(),set:v=>setArtStyle(v as 'v1'|'v2'),note:()=>artStyle()===art0?'':desk?'重启游戏后生效':'刷新页面后生效'},
      {key:'render-scale',name:'画面清晰度',tab:'view',kind:'choice',options:ch(['','1','2','3'],SCALE_LABEL),get:()=>renderScaleSetting(),set:v=>setRenderScaleSetting(v as RenderScaleSetting),note:()=>renderScaleSetting()===scale0?'':'刷新后生效'},
      {key:'iff-outline',name:'敌我描边',tab:'view',kind:'choice',options:ch(['off','enemy','all'],OUTLINE_LABEL),get:()=>outlineMode(),set:v=>{setOutlineMode(v as 'off');if(v!=='off')warmIffTextures(this.game);}},
      {key:'outline-width',name:'描边粗细',tab:'view',kind:'choice',options:ch(['thin','thick'],WIDTH_LABEL),get:()=>outlineWidth(),set:v=>setOutlineWidth(v as 'thin')},
      {key:'shake',name:'震屏',tab:'view',kind:'choice',options:ch(['strong','weak','off'],SHAKE_LABEL),get:()=>shakeLevel(),set:v=>setShakeLevel(v as ShakeLevel)},
      {key:'death-fx',name:'死亡特效',tab:'view',kind:'toggle',options:ch(['on','off'],DEATHFX_LABEL),get:()=>deathFxSetting(),set:v=>setDeathFx(v as DeathFxSetting)},
      {key:'damage',name:'伤害数字',tab:'battle',kind:'choice',options:ch(['all','crit','off'],DAMAGE_LABEL),get:()=>damageNumbers(),set:v=>setDamageNumbers(v as DamageNumbers)},
      {key:'school-hint',name:'合击觉醒提示',tab:'battle',kind:'choice',options:ch(['brief','full','off'],SCHOOL_HINT_LABEL),get:()=>schoolHint(),set:v=>setSchoolHint(v as SchoolHint)},
      {key:'hero-barks',name:'武将台词',tab:'battle',kind:'toggle',options:ch(['on','off'],BARKS_LABEL),get:()=>heroBarks(),set:v=>setHeroBarks(v as HeroBarks)},
      {key:'story',name:'剧情',tab:'story',kind:'choice',options:ch(['full','chapter','off'],STORY_LABEL),get:()=>storyMode(),set:v=>setStoryMode(v as 'full')},
      {key:'opening',name:'开场动画',tab:'story',kind:'choice',options:ch(['every','first','off'],OPENING_LABEL),get:()=>openingMode(),set:v=>setOpeningMode(v as OpeningMode)},
    ];
    const tabs=[{id:'sound',label:'声音'},{id:'view',label:'画面'},{id:'battle',label:'战斗'},{id:'story',label:'剧情'}];
    if(desk&&app){
      // 桌面版：显示模式、窗口分辨率、垂直同步
      const disp=()=>app.display?.get();tabs.push({id:'display',label:'显示'});
      specs.push({key:'fullscreen',name:'显示模式',tab:'display',kind:'choice',options:[{v:'full',label:'全屏'},{v:'win',label:'窗口'}],get:()=>app.isFullscreen()?'full':'win',set:v=>{if((v==='full')!==app.isFullscreen()){app.toggleFullscreen();this.time.delayedCall(260,()=>panel.refresh());}}});
      specs.push({key:'resolution',name:'窗口分辨率',tab:'display',kind:'stepper',get:()=>{const d=disp();return d?`${d.width}×${d.height}`:'—';},set:()=>{},step:dir=>{const d=disp();if(!d||!app.display)return;const list=d.resolutions;let i=list.findIndex(([w,h])=>w===d.width&&h===d.height);i=Math.max(0,Math.min(list.length-1,(i<0?0:i)+dir));app.display.set({width:list[i][0],height:list[i][1]});},note:()=>app.isFullscreen()?'全屏时按屏幕分辨率显示；窗口模式下生效':''});
      specs.push({key:'vsync',name:'垂直同步',tab:'display',kind:'toggle',options:[{v:'on',label:'开'},{v:'off',label:'关'}],get:()=>disp()?.vsync?'on':'off',set:v=>{const d=disp();if(d&&app.display&&(v==='on')!==d.vsync)app.display.set({vsync:v==='on'});},note:()=>{const d=disp();return d&&d.vsync!==d.vsyncActive?'重启游戏后生效':'';}});
    }
    const panel=buildSettingsPanel({scene:this,root:modal,x:x0+20,y:y0+66,w:pw-40,h:ph-66-66,tabs,settings:specs,memoryKey:'im_settings_tab',bare:true});
    // 底部一排：重看开场 / 重看新手引导 / 快捷键（次要漆金钮）· 退出游戏（桌面版）· 返回（漆金主钮）
    const fy=y0+ph-34,btn=(t:Phaser.GameObjects.Text,x:number,w:number,tone:'gold'|'quiet')=>{t.setOrigin(.5).setPosition(x,fy).setFontFamily(HEADING_FONT).setFontSize(14);const sk=lqSkin(this,t,t,()=>({w,h:34}),{tone});lqHitBox(t,w,34);modal.add([sk.gfx,t]);return t;};
    const line=this.add.graphics();line.lineStyle(1,0xc9a35e,.35).lineBetween(x0+24,fy-26,x0+pw-24,fy-26);modal.add(line);
    const replay=this.add.text(0,0,'重看开场',{fontFamily:HEADING_FONT,fontSize:'14px',color:'#e8d3a6',resolution:2}).setInteractive({useHandCursor:true}).setName('settings-opening-replay');
    replay.on('pointerdown',()=>{modal.destroy();this.scene.start('OpeningScene',{next:'MenuScene'});});
    let bx=x0+24;const place=(t:Phaser.GameObjects.Text,w:number,tone:'gold'|'quiet')=>{btn(t,bx+w/2,w,tone);bx+=w+10;};
    place(replay,92,'quiet');place(tutorialReplayLink(this,0,0),160,'quiet');place(hotkeySettingsLink(this,0,0,600),96,'quiet');
    if(desk&&app){const quit=this.add.text(0,0,'退出游戏',{fontFamily:HEADING_FONT,fontSize:'14px',color:'#e8d3a6',resolution:2}).setInteractive({useHandCursor:true}).setName('settings-quit');
      quit.on('pointerdown',()=>{if(quit.getData('confirm'))app.quit();else quit.setData('confirm',true).setText('再点退出');});place(quit,90,'quiet');}
    const close=this.add.text(0,0,'返回',{fontFamily:HEADING_FONT,fontSize:'16px',color:'#e8d3a6',resolution:2}).setInteractive({useHandCursor:true}).setName('settings-close').setData('padDefault',true).on('pointerdown',()=>modal.destroy());
    btn(close,x0+pw-24-50,100,'gold');
  }
  private openHomeSettings():void {
    if(D){this.openSettingsV2();return;} // 电脑版：新军中设置（2026-11-18）；手机仍用下面的旧版
    const modal=this.add.container(0,0).setDepth(500).setName('home-settings-panel');
    const label=(x:number,y:number,value:string,size=20)=>this.add.text(x,y,value,{fontFamily:FONT,fontSize:size+'px',color:'#e8d0aa',resolution:2}).setOrigin(.5);
    const app=desktop,desk=IS_DESKTOP_APP&&!!app;
    // 桌面版行距收紧，放下显示设置（分辨率 / 全屏 / 垂直同步）
    // 2026-11-17 用户批准 UI 审查 E：网页电脑版改成和战斗内「军中设置」同一套行样式（名称在左、‹ 值 › 在右）与同一组选项
    const web=D&&!desk;
    const rowY=(i:number)=>desk?H/2-166+i*36:web?106+i*36:H/2-70+i*54; // 网页电脑版 11 行（行距 36 放进 540 高；第 10 行「死亡特效」2026-11-18）（第 9 行「开场动画」2026-11-18），行距收紧放进 540 高
    // 漆底描金面板（与图鉴、结算卷同系）；每行左右是漆金小方钮，返回为漆金按钮
    modal.add(this.add.rectangle(W/2,H/2,W,H,0x0c0805,.9).setInteractive());
    {const pw=desk?560:web?520:Math.min(W-40,460),top=desk?H/2-250:web?14:H/2-190,bottom=desk?rowY(11)+40:web?rowY(11)+36:H/2+340,g=this.add.graphics();lqPanel(g,W/2-pw/2,top,pw,bottom-top);modal.add(g);
     const t=label(W/2,desk?H/2-218:web?top+34:H/2-130,'军中设置',28).setFontFamily(desk?TITLE_FONT:HEADING_FONT).setColor(desk?'#efd399':'#f6dc9a').setStroke(desk?'#120904':'#2a170b',4);modal.add(t);
     const div=this.add.graphics();lqDivider(div,W/2,t.y+30,desk?160:130);modal.add(div);
     modal.add(tutorialReplayLink(this,W/2+pw/2-22,top+24));} // 新手引导：重看（逻辑在 ui/TutorialOverlay.ts）
    /** 一行“名称  数值”，左右 －/＋（或 ‹ ›）调节；手柄焦点在行上时左右键也能调。 */
    const row=(i:number,name:string,get:()=>string,step:(dir:number)=>void,arrows:[string,string]=['－','＋'])=>{
      if(web){ // 同战斗内军中设置：漆底行、左名右值、‹ › 小钮
        const y=rowY(i),pw=440,x0=W/2-pw/2,plate=this.add.graphics();lqPanel(plate,x0,y-18,pw,36,{shadow:false,glow:false});
        const nm=this.add.text(x0+18,y,name,{fontFamily:HEADING_FONT,fontSize:'16px',color:'#e8d8b2',resolution:2}).setOrigin(0,.5);
        const vx=x0+pw-110,value=this.add.text(vx,y,get(),{fontFamily:HEADING_FONT,fontSize:'16px',color:'#efd399',resolution:2}).setOrigin(.5).setName('settings-row-'+i);modal.add([plate,nm,value]);
        for(const dir of [-1,1]){const b=label(vx+dir*72,y,dir<0?'‹':'›',18).setInteractive({useHandCursor:true}).setName(`settings-row-${i}-${dir<0?'dec':'inc'}`);
          b.setData('padAdjust',(d:number)=>{step(d);value.setText(get());}).on('pointerdown',()=>{step(dir);value.setText(get());});
          const sk=lqSkin(this,b,b,()=>({w:30,h:28}),{tone:'quiet'});lqHitBox(b,30,28);modal.add([sk.gfx,b]);}
        return value;
      }
      const y=rowY(i),value=label(W/2,y,name+'  '+get(),desk?18:20).setName('settings-row-'+i);
      const plate=this.add.graphics();plate.fillStyle(0x3a2616,.45).fillRoundedRect(W/2-(desk?140:112),y-(desk?17:24),desk?280:224,desk?34:48,6).lineStyle(1,0xc9a35e,.35).strokeRoundedRect(W/2-(desk?140:112),y-(desk?17:24),desk?280:224,desk?34:48,6);modal.add([plate,value]);
      for(const dir of [-1,1]){const b=label(W/2+dir*(desk?172:146),y,dir<0?arrows[0]:arrows[1],desk?22:26).setInteractive({useHandCursor:true}).setName(`settings-row-${i}-${dir<0?'dec':'inc'}`);
        b.setData('padAdjust',(d:number)=>{step(d);value.setText(name+'  '+get());}).on('pointerdown',()=>{step(dir);value.setText(name+'  '+get());});
        const bw=desk?44:52,bh=desk?34:48,sk=lqSkin(this,b,b,()=>({w:bw,h:bh}));lqHitBox(b,bw,bh);modal.add([sk.gfx,b]);}
      return value;
    };
    ['音乐','音效'].forEach((name,i)=>{const key=i?'im_sfx_vol':'im_bgm_vol';let volume= i?90:40;try{volume=Number(localStorage.getItem(key)??volume);}catch{}
      row(i,name,()=>volume+'%',dir=>{volume=Math.max(0,Math.min(100,volume+dir*10));try{localStorage.setItem(key,String(volume));}catch{}if(!i)menuMusic().setVolume(volume);});});
    if(desk&&app){
      // 桌面版：显示模式、窗口分辨率、垂直同步、退出游戏
      const disp=()=>app.display?.get();
      const full=row(2,'显示模式',()=>app.isFullscreen()?'全屏':'窗口',()=>{app.toggleFullscreen();this.time.delayedCall(250,()=>{full.setText('显示模式  '+(app.isFullscreen()?'全屏':'窗口'));resText();});},['‹','›']).setName('settings-fullscreen');
      const resName=()=>{const d=disp();return d?`${d.width}×${d.height}`:'—';};
      const res=row(3,'窗口分辨率',resName,dir=>{const d=disp();if(!d||!app.display)return;const list=d.resolutions;let i=list.findIndex(([w,h])=>w===d.width&&h===d.height);i=Math.max(0,Math.min(list.length-1,(i<0?0:i)+dir));app.display.set({width:list[i][0],height:list[i][1]});},['‹','›']).setName('settings-resolution');
      const resNote=label(W/2,rowY(3)+22,'',11).setColor('#9d8f78');modal.add(resNote);
      const resText=()=>{res.setText('窗口分辨率  '+resName());resNote.setText(app.isFullscreen()?'全屏时按屏幕分辨率显示；窗口模式下生效':'');};resText();
      const vs=row(4,'垂直同步',()=>{const d=disp();return d?(d.vsync?'开':'关'):'—';},()=>{const d=disp();if(d&&app.display)app.display.set({vsync:!d.vsync});vsNote();},['‹','›']).setName('settings-vsync');
      const vsyncNote=label(W/2,rowY(4)+22,'',11).setColor('#9d8f78');modal.add(vsyncNote);
      const vsNote=()=>{const d=disp();vsyncNote.setText(d&&d.vsync!==d.vsyncActive?'重启游戏后生效':'');};vsNote();void vs;
      const quit=label(W/2,rowY(10)+6,'退出游戏',18).setColor('#e7b68e').setInteractive({useHandCursor:true}).setName('settings-quit');
      quit.on('pointerdown',()=>{if(quit.getData('confirm'))app.quit();else quit.setData('confirm',true).setText('确认退出？再点一次');});
      const qs=lqSkin(this,quit,quit,()=>({w:220,h:38}),{tone:'quiet'});lqHitBox(quit,220,38);
      modal.add([qs.gfx,quit]);
    }
    // 人物画风（新版 v2 营火写实像素 / 旧版 v1 Q 版）：图集在启动时加载，切换后刷新 / 重启生效
    {const at=desk?5:2,note=label(W/2,rowY(at)+(desk?22:30),'',11).setColor('#9d8f78');modal.add(note);const start=artStyle();let cur=start;
     row(at,'人物画风',()=>cur==='v2'?'新版':'旧版',()=>{cur=cur==='v2'?'v1':'v2';setArtStyle(cur);note.setText(cur===start?'':desk?'重启游戏后生效':'刷新页面后生效');},['‹','›']).setName('settings-art-style');}
    // 敌我描边（用户选定的方案 c，默认关）：部曲青色、敌军暗红的细描边，混战时更好分辨；下一场战斗生效
    {const at=desk?6:3;const list=['off','enemy','all'] as const;row(at,'敌我描边',()=>OUTLINE_LABEL[outlineMode()],dir=>{const v=cycle(list,outlineMode(),dir);setOutlineMode(v);if(v!=='off')warmIffTextures(this.game);},['‹','›']).setName('settings-iff-outline');void iffOutlineEnabled;void setIffOutline;}
    // 震屏（打击感 2026-11-17）：强 / 弱 / 关，立即生效（战斗中所有震屏都按此缩放）
    {const at=desk?7:4,order:ShakeLevel[]=['strong','weak','off'];let cur=shakeLevel();row(at,'震屏',()=>SHAKE_LABEL[cur],dir=>{cur=order[(order.indexOf(cur)+(dir>0?1:2))%3];setShakeLevel(cur);},['‹','›']).setName('settings-shake');}
    if(web){
      {const list=['thin','thick'] as const;row(5,'描边粗细',()=>WIDTH_LABEL[outlineWidth()],dir=>setOutlineWidth(cycle(list,outlineWidth(),dir)),['‹','›']).setName('settings-outline-width');}
      {const list:DamageNumbers[]=['all','crit','off'];row(6,'伤害数字',()=>DAMAGE_LABEL[damageNumbers()],dir=>setDamageNumbers(cycle(list,damageNumbers(),dir)),['‹','›']).setName('settings-damage');}
      {const list:RenderScaleSetting[]=['','1','2','3'],start=renderScaleSetting(),note=label(W/2+120,rowY(7)+26,'',11).setColor('#9d8f78');modal.add(note);
       row(7,'画面清晰度',()=>SCALE_LABEL[renderScaleSetting()],dir=>{setRenderScaleSetting(cycle(list,renderScaleSetting(),dir));note.setText(renderScaleSetting()===start?'':'刷新后生效');},['‹','›']).setName('settings-render-scale');}
    }
    // 剧情（2026-11-17 剧情系统）：完整 / 只看章头章末 / 关闭
    {const at=desk||web?8:5,list=['full','chapter','off'] as const;row(at,'剧情',()=>STORY_LABEL[storyMode()],dir=>setStoryMode(cycle(list,storyMode(),dir)),['‹','›']).setName('settings-story');}
    // 开场动画（2026-11-18）：每次 / 首次（缺省）/ 关闭；面板左上「重看开场 ›」
    if(web){const list:OpeningMode[]=['every','first','off'];row(9,'开场动画',()=>OPENING_LABEL[openingMode()],dir=>setOpeningMode(cycle(list,openingMode(),dir)),['‹','›']).setName('settings-opening');
     const t=this.add.text(W/2-246,40,'重看开场 ›',{fontFamily:FONT,fontSize:'13px',color:'#e8c98a',resolution:2}).setOrigin(0,.5).setInteractive({useHandCursor:true}).setName('settings-opening-replay');
     t.on('pointerover',()=>t.setColor('#fff3d4')).on('pointerout',()=>t.setColor('#e8c98a')).on('pointerdown',()=>{modal.destroy();this.scene.start('OpeningScene',{next:'MenuScene'});});modal.add(t);}
    // 死亡特效（2026-11-18）：开 / 关，与战斗内设置共用 im_death_fx，缺省开
    {const at=desk?9:web?10:6,list:DeathFxSetting[]=['on','off'];row(at,'死亡特效',()=>DEATHFX_LABEL[deathFxSetting()],dir=>setDeathFx(cycle(list,deathFxSetting(),dir)),['‹','›']).setName('settings-death-fx');}
    if(D||desk)modal.add(hotkeySettingsLink(this,W/2-(desk?560:520)/2+24,desk?rowY(11)+6:rowY(11)+2,600).setOrigin(0,.5)); // 快捷键页（与战斗内设置共用，ui/HotkeySettingsUI；放在左下，不碰右上的「重看新手引导」）
    const close=label(W/2,desk?rowY(11)+6:web?rowY(11)+2:H/2+310,'返回',20).setFontFamily(HEADING_FONT).setInteractive({useHandCursor:true}).setName('settings-close').setData('padDefault',true).on('pointerdown',()=>modal.destroy());
    const cs=(web?inkSkin(this,close,()=>({w:200,h:42}),{primary:true}):null)??lqSkin(this,close,close,()=>({w:200,h:desk?44:52}),{tone:'cinnabar'});lqHitBox(close,200,desk?44:52);
    modal.add([cs.gfx,close]);
  }
  private corners(g: Phaser.GameObjects.Graphics, bg: Phaser.GameObjects.Rectangle, selected: boolean): void {
    g.clear();
    const r = bg.getBounds();
    warFrame(g,r.x,r.y,r.width,r.height,selected ? WAR.gold : 0x496452,false);

  }
  private renderSelection(): void {
    this.chapterButtons.forEach(c => {
      const unlocked = chapterUnlocked(c.id)||isChapterTestRun(), selected = unlocked && c.id === this.selectedChapter, chapter = getChapter(c.id);
      c.bg.setFillStyle(!unlocked ? 0x161c19 : selected ? 0x2b4030 : 0x182a22,.22).setStrokeStyle(selected ? 2 : 1, selected ? 0xc6aa6c : unlocked ? 0x45604d : 0x363d34);
      if (unlocked) c.bg.setInteractive({ useHandCursor: true }); else c.bg.disableInteractive();
      c.name.setColor(!unlocked ? '#747e71' : selected ? '#f4d99f' : '#c8d4bf');
      c.tag.setText(!unlocked ? '未解锁' : (c.id === 'huangjin' && chapterOneCleared()||c.id==='hulao'&&loadWorld().cleared.hulao) ? '已通关' : selected ? '已选择' : '可出征').setColor(!unlocked ? '#8f8c7b' : '#d4bb7e');
      c.hint.setVisible(c.id!=='huangjin');
      if(!unlocked)c.name.setText('未揭晓战役');
      if(c.id==='huangjin')c.name.setText(`1-${this.selectedStage} ${YELLOW_STAGES[this.selectedStage-1].name}`).setFontSize(D?20:18);
      c.hint.setText(!unlocked ? '击败张角后解锁' : c.id==='hulao'?`2-${this.selectedWestStage} ${DONGZHUO_STAGES[this.selectedWestStage-1].name} · ${DONGZHUO_STAGES[this.selectedWestStage-1].boss}  选关 ›`:`${chapter.waves.length} 波敌军   /   首领 · ${chapter.bossName}`).setColor(!unlocked ? '#818778' : '#a4b8a4');
      this.corners(c.decor, c.bg, selected);
    });
    this.stageTabs.forEach((t,i)=>{const unlocked=yellowStageUnlocked(i+1)||isChapterTestRun();t.setText(`1-${i+1}${unlocked?'':' 锁'}`).setColor(!unlocked?'#758075':this.selectedStage===i+1?'#ffe0a0':'#a9bfac').setBackgroundColor(this.selectedStage===i+1?'#354a36':'#12271f');});
    this.charCards.forEach((c, i) => {
      const selected = i === this.selectedChar;
      c.bg.setFillStyle(selected ? 0x2c4232 : 0x15271f,.22).setStrokeStyle(selected ? 2 : 1, selected ? 0xd2b474 : 0x3e5648);
      const epic='epic_hero_'+CHARACTERS[i].id;if(this.textures.exists(epic)){c.icon.setTexture(epic);c.icon.setScale(Math.min(130/c.icon.width,142/c.icon.height));}
      c.badge.setVisible(selected); c.icon.setAlpha(selected ? 1 : .83); this.corners(c.decor, c.bg, selected);
    });
    for(const row of this.westRows){
      const open=dongzhuoStageUnlocked(row.stage)||isChapterTestRun(),done=loadWorld().dongzhuoStages>=row.stage,chosen=this.selectedChapter==='hulao'&&row.stage===this.selectedWestStage;
      row.bg.setFillStyle(chosen?0x493323:open?0x2d211a:0x211b17,1).setStrokeStyle(chosen?2:1,chosen?0xdbb478:open?0x8e6e47:0x494038);
      row.status.setText(!open?'未解锁':done?chosen?'已通关 · 当前':'已通关':chosen?'当前选择':'可出征').setColor(!open?'#8a8072':done?'#c8b685':'#edc889');row.icon.setAlpha(1).setVisible(open);
      const r=row.bg.getBounds(),g=row.decor;g.clear().lineStyle(1,chosen?0xd6b47a:0x776047,chosen?.8:.5).strokeRect(r.x+5,r.y+5,r.width-10,r.height-10);
      g.fillStyle(chosen?0xc39a5b:0x786147,1);for(const x of [r.x+10,r.right-10])for(const y of [r.y+10,r.bottom-10])g.fillRect(x-2,y-2,4,4);
      g.lineStyle(1,0xc09a66,.2).lineBetween(r.x+14,r.bottom-12,r.right-14,r.bottom-12);
    }
    if(this.heroModal?.visible)this.heroPicker?.refreshArt();
    const westReady=dongzhuoStageUnlocked(this.selectedWestStage)||isChapterTestRun();this.westDeploy?.setAlpha(westReady?1:.4);if(westReady)this.westDeploy?.setInteractive({useHandCursor:true});else this.westDeploy?.disableInteractive();this.westDeployLabel?.setAlpha(westReady?1:.4);
    const c = CHARACTERS[this.selectedChar], ready = !!c && (chapterUnlocked(this.selectedChapter)||isChapterTestRun()) && (this.selectedChapter!=='hulao'||dongzhuoStageUnlocked(this.selectedWestStage)||isChapterTestRun()) && !this.started;
    if(this.compactHome&&this.homeCard){this.homeCard.setHero(this.selectedChar);if(!this.textures.exists('epic_hero_'+c.id))this.ensureHomeArt();}
    else if (c) {
      this.heroName.setText(this.compactHome?c.name+' · '+ROLES[this.selectedChar].split(' · ')[0]:`${c.name}  ·  ${ROLES[this.selectedChar].split(' · ')[0]}`);
      if(this.homePortrait){const key='epic_hero_'+c.id,image=this.homePortrait,target=this.textures.exists(key)?key:c.portrait;const apply=()=>{if(!image.scene)return;image.setTexture(target,'__BASE');image.setScale(Math.min((D?320:350)/image.width,(D?270:355)/image.height));};if(image.texture.key!==target&&image.getData('nextArt')!==target){image.setData('nextArt',target);this.tweens.killTweensOf(image);this.tweens.add({targets:image,alpha:0,duration:75,onComplete:()=>{apply();this.tweens.add({targets:image,alpha:1,duration:160});}});}image.setOrigin(.5,1).setPosition(D?W*.25:W/2,D?403:565+this.padY);if(image.texture.key===target)apply();if(!this.textures.exists(key))this.ensureHomeArt();}
      this.weapon.setText(`专属兵器  ${weaponName(c.startWeapon,c.id)}`);
      this.passiveName.setText(`天赋被动  ${CHARACTER_PASSIVES[c.id].name}`);
      this.passive.setText(PASSIVE_HINTS[this.selectedChar]);
    }
    this.startButton.setFillStyle(ready ? 0xc7aa65 : 0x465047,this.compactHome?.001:1).setStrokeStyle(this.compactHome?0:1,0xf3dca2).setAlpha(ready ? 1 : .6);
    if (ready) this.startButton.setInteractive({ useHandCursor: true }); else this.startButton.disableInteractive();
    this.startLabel.setText(ready&&this.compactHome?'匡扶汉室':ready ? `出征 · ${this.selectedChapter==='huangjin'?YELLOW_STAGES[this.selectedStage-1].name:DONGZHUO_STAGES[this.selectedWestStage-1].name}` : this.started ? '正在出征…' : '请选择可用章节与武将');
  }
  private createWestPicker():void{
    const modal=this.add.container(0,0).setDepth(400).setVisible(false).setName('dongzhuo-picker');this.westModal=modal;
    const text=(x:number,y:number,value:string,size:number,color='#e5d3a8')=>this.add.text(x,y,value,{fontFamily:size>=18?HEADING_FONT:FONT,fontSize:size+'px',color,resolution:2}).setOrigin(.5);
    modal.add(this.add.rectangle(0,0,W,H,0x191310,1).setOrigin(0).setInteractive());
    const art=this.add.graphics();modal.add(art);
    art.lineStyle(1,0x80603a,.12);for(let y=12;y<H;y+=12)art.lineBetween(18,y,W-18,y);
    art.lineStyle(1,0x8d6d44,.5).strokeRect(16,18,W-32,H-36);
    const headY=D?57:95;
    art.fillStyle(0x54241d,1).fillRect(W/2-140,headY-37,280,64).fillTriangle(W/2-140,headY+27,W/2+140,headY+27,W/2,headY+44);
    art.lineStyle(1,0xb18d54,.8).lineBetween(W/2-140,headY-37,W/2+140,headY-37);
    modal.add(text(W/2,headY-14,'第 二 章',12,'#c3a26c'));
    modal.add(text(W/2,headY+16,'讨伐董卓',D?35:38,'#f2d49a').setFontFamily(TITLE_FONT).setLetterSpacing(3));
    modal.add(text(W/2,D?121:168,'汜水破敌  /  荥阳破围  /  虎牢决战',D?13:15,'#bda88a'));
    const features=['铁甲统帅 · 横扫与裂地重斩','两翼伏击 · 骑兵突袭与箭雨','无双猛将 · 冲锋与魔神降临'];
    DONGZHUO_STAGES.forEach((info,i)=>{
      const known=dongzhuoStageUnlocked(info.stage)||isChapterTestRun();
      const x=D?W/2+(i-1)*286:W/2,y=D?291:283+i*190,cw=D?266:W-76,ch=D?282:174;
      const bg=this.add.rectangle(x,y,cw,ch,0x2b2019,1).setInteractive({useHandCursor:true}).setName('west-stage-'+info.stage);
      const decor=this.add.graphics();
      const icon=this.add.image(D?x:x-cw/2+68,D?y-42:y+3,i===0?'huaxiong_portrait':i===1?'xurong':'boss_lubu',0).setName('west-boss-'+info.stage);
      if(i===0)icon.setDisplaySize(D?96:104,D?96:104);else icon.setDisplaySize(D?112:124,D?112:124);
      const tx=D?x:x-cw/2+143;
      const number=text(D?x-cw/2+30:x-cw/2+28,y-ch/2+25,'0'+info.stage,14,'#caa875');
      const title=text(tx,D?y+29:y-34,known?info.name:'未揭晓战役',D?26:29,'#f3dfb8').setOrigin(D?.5:0,.5);
      const boss=text(tx,D?y+61:y+3,known?'首领 · '+info.boss:'完成前一战役后揭晓',17,'#d4ad75').setOrigin(D?.5:0,.5);
      const feature=text(tx,D?y+91:y+39,known?features[i]:'逐关破敌 · 推进当前征程',D?12:13,'#bda88f').setOrigin(D?.5:0,.5);
      const status=text(x+cw/2-17,y-ch/2+25,'',12).setOrigin(1,.5);
      bg.on('pointerdown',()=>{if(!dongzhuoStageUnlocked(info.stage)&&!isChapterTestRun())return;this.selectedChapter='hulao';this.selectedWestStage=info.stage;this.renderSelection();});
      bg.on('pointerover',()=>{if(dongzhuoStageUnlocked(info.stage)||isChapterTestRun())bg.setAlpha(.85);}).on('pointerout',()=>bg.setAlpha(1));
      modal.add([bg,decor,icon,number,title,boss,feature,status]);this.westRows.push({bg,status,stage:info.stage,decor,icon});
    });
    const footer=D?H-51:H-92;
    art.fillStyle(0x191310,1).fillRect(24,footer-43,W-48,86).lineStyle(1,0x8d6d44,.65).lineBetween(32,footer-45,W-32,footer-45);
    const button=(x:number,width:number,label:string,primary:boolean,action:()=>void,name:string)=>{
      const bg=this.add.rectangle(x,footer,width,D?48:62,primary?0x96623a:0x33251d,1).setStrokeStyle(1,primary?0xd8b373:0x8b6c48).setInteractive({useHandCursor:true}).setName(name);
      const caption=text(x,footer,label,D?17:20,primary?'#fff0ce':'#d2bda0');
      bg.on('pointerdown',()=>bg.setAlpha(.7)).on('pointerout',()=>bg.setAlpha(1)).on('pointerup',()=>{bg.setAlpha(1);action();});modal.add([bg,caption]);return{bg,caption};
    };
    button(D?W/2-163:W*.24,D?170:W*.32,'返回',false,()=>modal.setVisible(false),'west-back');
    const deploy=button(D?W/2+91:W*.66,D?300:W*.46,'出征当前关卡',true,()=>{modal.setVisible(false);this.startGame();},'west-deploy');
    this.westDeploy=deploy.bg;this.westDeployLabel=deploy.caption;
    modal.add(text(W/2,D?H-13:H-35,loadWorld().legacyHulaoAccess?'旧版虎牢关访问权限已保留':'逐关破敌 · 通关进度自动保存',11,'#917c61'));
  }

  /** 战役回顾“再战/出征”：以当前武将直接出征指定关（只允许已解锁的关；通关进度只增不减）。 */
  private replayStage(arc:'huangjin'|'dongzhuo'|'qunxiong'|'guandu'|'chibi'|'jingnan'|'shu'|'hanzhong'|'xiangfan'|'yiling'|'nanzheng'|'beifa',stage:number):void{
    if((arc!=='huangjin'&&arc!=='dongzhuo')||![1,2,3].includes(stage))return;
    if(arc==='huangjin'){if(!yellowStageUnlocked(stage)&&!isChapterTestRun())return;this.selectedChapter='huangjin';this.selectedStage=stage as YellowStage;}
    else{if(!dongzhuoStageUnlocked(stage)&&!isChapterTestRun())return;this.selectedChapter='hulao';this.selectedWestStage=stage as YellowStage;}
    this.startGame();
  }
  private startGame(): void {
    if (this.heroModal?.visible||this.westModal?.visible||this.children.getByName('home-settings-panel')||this.children.getByName('game-codex')) return;
    if(this.selectedChapter==='hulao'&&!dongzhuoStageUnlocked(this.selectedWestStage)&&!isChapterTestRun())return;
    if (this.started || (!chapterUnlocked(this.selectedChapter)&&!isChapterTestRun()) || !CHARACTERS[this.selectedChar]) return;
    if (!heroOwned(CHARACTERS[this.selectedChar].id)) this.selectedChar = Math.max(0, CHARACTERS.findIndex(c => c.id === defaultHero(null)));
    this.started = true; this.renderSelection();
    if(!isChapterTestRun())this.registry.set('worldCampaign',true);
    const c = CHARACTERS[this.selectedChar];
    try{localStorage.setItem('im_last_hero',c.id);}catch{}
    this.registry.remove('campaignTransfer');
    this.registry.set('runConfig', { chapter: this.selectedChapter, stage: this.selectedChapter==='huangjin'?this.selectedStage:undefined,westStage:this.selectedChapter==='hulao'?this.selectedWestStage:undefined, character: c.id, weapon: c.startWeapon } satisfies RunConfig);
    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('GameScene'));
  }
}

