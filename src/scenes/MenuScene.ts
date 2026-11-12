import {yellowStageUnlocked,loadWorld,worldUnlocked} from '../world/WorldStore';
import Phaser from 'phaser';
import { WAR, ensureWarTextures, warFrame } from '../ui/WarStyle';
import { CHAPTERS, YELLOW_STAGES, getChapter, type YellowStage, type ChapterId } from '../data/chapters';
import { CHARACTERS, type RunConfig } from '../data/characters';
import { CHARACTER_PASSIVES } from '../data/passives';
import { WEAPON_META } from '../data/upgrades';
import { chapterOneCleared, chapterUnlocked, isChapterTestRun } from '../systems/ChapterProgress';
import { FONT, TITLE_FONT, HEADING_FONT, GAME_HEIGHT as H, GAME_WIDTH as W, IS_DESKTOP as D, switchLayout } from '../config';

const ROLES = ['游龙先锋 · 灵动突刺', '重甲武圣 · 横扫千军', '百步神射 · 远程压制', '卧龙军师 · 火阵爆发'];
const PASSIVE_HINTS = [
  '命中积攒龙胆，满七层强化下一次龙枪。',
  '横斩命中怪群蓄势，强化斩击范围与伤害。',
  '连续三秒不受伤，提升暴击并追加弩箭。',
  '战旗命中怪群积谋，强化爆炸并附加灼烧。',
];
interface ChapterCard { id: ChapterId; bg: Phaser.GameObjects.Rectangle; name: Phaser.GameObjects.Text; tag: Phaser.GameObjects.Text; hint: Phaser.GameObjects.Text; decor: Phaser.GameObjects.Graphics; }
interface HeroCard { bg: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Image; badge: Phaser.GameObjects.Text; decor: Phaser.GameObjects.Graphics; }

/** Preparation only. Chapter persistence lives in ChapterProgress, combat stays in GameScene. */
export class MenuScene extends Phaser.Scene {
  private selectedStage:YellowStage=1;
  private stageTabs:Phaser.GameObjects.Text[]=[];
  private compactHome=false;
  private heroModal?:Phaser.GameObjects.Container;
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
  create(): void {
    ensureWarTextures(this);
    this.cameras.main.fadeIn(180,0,0,0);
    this.selectedStage=Math.min(3,loadWorld().yellowStages+1) as YellowStage;this.stageTabs=[];
    this.started = false; this.chapterButtons = []; this.charCards = [];
    const params = new URLSearchParams(window.location.search), saved = this.registry.get('runConfig') as RunConfig | undefined;
    if(isChapterTestRun()&&['1','2','3'].includes(params.get('stage')??''))this.selectedStage=Number(params.get('stage')) as YellowStage;
    const fromWorld=this.registry.has('selectedWorldChapter');
    const expanded=fromWorld||this.registry.get('menuChapterPicker')===true||((params.has('autostart')||params.has('perf'))&&params.has('chapter'));
    this.registry.remove('menuChapterPicker');this.compactHome=!expanded;this.heroModal=undefined;this.homePortrait=undefined;
    const requested = getChapter(this.registry.get('selectedWorldChapter') ?? params.get('chapter') ?? saved?.chapter).id;
    this.registry.remove('selectedWorldChapter');
    this.selectedChapter = chapterUnlocked(requested)||isChapterTestRun() ? requested : 'huangjin';
    this.selectedChar = params.has('autostart') || params.has('perf') ? 0 : Math.max(0, CHARACTERS.findIndex(c => c.id === saved?.character));
    if(this.compactHome){this.selectedChapter='huangjin';this.createLanding(params);return;}
    this.cameras.main.resetFX(); this.cameras.main.setBackgroundColor('#101813');
    const text = (x: number, y: number, value: string, size: number, color = '#ede4cc') => this.add.text(x, y, value, { fontFamily: size>=18?HEADING_FONT:FONT, fontSize: `${size}px`, color, resolution: 2 });
    this.add.tileSprite(0, 0, W, H, 'ground_hulao').setOrigin(0).setAlpha(.16);
    this.add.rectangle(0, 0, W, H, 0x0b1612, .82).setOrigin(0);
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(.65);
    const frame = this.add.graphics();
    frame.lineStyle(1, 0x977e4e, .3).strokeRect(12, 12, W - 24, H - 24);
    for (const x of [12, W - 12]) for (const y of [12, H - 12]) {
      const sx = x < W / 2 ? 1 : -1, sy = y < H / 2 ? 1 : -1;
      frame.lineStyle(2, 0xc9ad70, .8).lineBetween(x, y, x + sx * 28, y).lineBetween(x, y, x, y + sy * 28);
    }
    text(28,D?22:48,'乱世千军',D?36:42,'#efd493').setFontFamily(TITLE_FONT).setLetterSpacing(3);
    text(D ? 196 : 30, D ? 32 : 99, '三国割草 · 将星出征', D ? 13 : 14, '#8eaa9c');
    text(W-130,D?29:59,worldUnlocked()||isChapterTestRun()?'主城':'主城未开放',12,'#d9c58d').setOrigin(1,0).setPadding(8,6).setInteractive({useHandCursor:true}).on('pointerdown',()=>{if(worldUnlocked()||isChapterTestRun())this.scene.start('CityScene');});
    const layout = text(W - 28, D ? 29 : 59, D ? '手机布局' : '电脑布局', 12, '#acb5a0').setOrigin(1, 0).setPadding(6, 6).setInteractive({ useHandCursor: true });
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
      bg.on('pointerdown', () => { if (!chapterUnlocked(chapter.id)&&!isChapterTestRun()) return; this.selectedChapter = chapter.id; this.renderSelection(); });
      bg.on('pointerover', () => { if (chapterUnlocked(chapter.id) && this.selectedChapter !== chapter.id) bg.setFillStyle(0x263c30).setStrokeStyle(1, 0xa6b996); });
      bg.on('pointerout', () => this.renderSelection());
      this.chapterButtons.push({ id: chapter.id, bg, name, tag, hint, decor });
      if(i===0)for(const stage of YELLOW_STAGES){const tab=text(x-width/2+16+(stage.stage-1)*(width-24)/3,y+(D?16:29),`1-${stage.stage}`,D?12:14).setPadding(5,4).setInteractive({useHandCursor:true});tab.on('pointerdown',()=>{if(!yellowStageUnlocked(stage.stage)&&!isChapterTestRun())return;this.selectedStage=stage.stage;this.selectedChapter='huangjin';this.renderSelection();});this.stageTabs.push(tab);}

    });
    section(D ? 195 : 287, '贰', '选择武将', '四将各有所长');
    const cardW = D ? (W - 92) / 4 : (W - 68) / 2, cardH = D ? 162 : 164;
    CHARACTERS.forEach((c, i) => {
      const x = 28 + cardW / 2 + (D ? i : i % 2) * (cardW + 12), y = D ? 291 : 389 + Math.floor(i / 2) * 178;
      this.add.image(x,y,'ui_war_panel').setDisplaySize(cardW,cardH);
      const bg = this.add.rectangle(x, y, cardW, cardH, 0x15251e).setInteractive({ useHandCursor: true });
      const decor = this.add.graphics();
      const icon = this.add.image(x, y - 25, c.portrait);
      const max = D ? 95 : 98; icon.setScale(Math.min(max / icon.width, max / icon.height)); if (c.tint) icon.setTint(c.tint);
      text(x, y + 39, c.name, D ? 22 : 23, '#f0e5c6').setOrigin(.5);
      text(x, y + 64, ROLES[i], D ? 11 : 14, '#9cb7a7').setOrigin(.5);
      const badge = text(x + cardW / 2 - 10, y - cardH / 2 + 9, '出战', 11, '#f3d89a').setOrigin(1, 0).setPadding(5,3).setBackgroundColor('#16352a');
      bg.on('pointerdown', () => { this.selectedChar = i; this.renderSelection(); });
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
    text(W / 2, D ? 522 : 902, isChapterTestRun() ? '测试模式 · 调试战斗不记录章节通关' : '开局直接战斗 · 第一波结束后招募援兵', D ? 10 : 12, '#7e9283').setOrigin(.5);
    const keyboard = this.input.keyboard;
    const bind = (key: string, action: () => void) => { keyboard?.on(key, action); this.events.once('shutdown', () => keyboard?.off(key, action)); };
    bind('keydown-ENTER', () => this.startGame()); bind('keydown-L', () => switchLayout(D ? 'mobile' : 'desktop'));
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((key, i) => bind(`keydown-${key}`, () => { this.selectedChar = i; this.renderSelection(); }));
    this.renderSelection();
    if (params.has('autostart') || params.has('perf')) this.time.delayedCall(80, () => this.startGame());
  }
  private createLanding(params:URLSearchParams):void {
    this.cameras.main.setBackgroundColor('#0d1712');
    const text=(x:number,y:number,value:string,size:number,color='#e8d8b2')=>this.add.text(x,y,value,{fontFamily:size>=18?HEADING_FONT:FONT,fontSize:`${size}px`,color,resolution:2}).setOrigin(.5);
    this.add.tileSprite(W/2,H/2,W,H,'ground_hulao').setAlpha(.1);
    this.add.rectangle(W/2,H/2,W,H,0x0b1612,.8);
    this.add.image(W/2,H/2,'vignette').setDisplaySize(W,H).setAlpha(.6);
    const frame=this.add.graphics();warFrame(frame,18,18,W-36,H-36,WAR.gold,false);
    text(W/2,D?57:115,'乱世千军',D?50:56,'#edcf8b').setFontFamily(TITLE_FONT).setLetterSpacing(4).setShadow(0,2,'#060c08',0,true,true);
    text(W/2,D?101:166,'三国乱世 · 一将起义，千军相随',D?13:16,'#92aa99');
    const info=YELLOW_STAGES[this.selectedStage-1];
    text(W/2,D?139:231,`${loadWorld().yellowStages?'当前征程':'首战'} · 1-${this.selectedStage} ${info.name}`,D?13:16,'#c8bc95');
    this.homePortrait=this.add.image(W/2,D?228:373,CHARACTERS[this.selectedChar].portrait);
    this.heroName=text(W/2,D?316:513,'',D?31:35,'#f1d99f').setFontFamily(TITLE_FONT);
    this.weapon=text(W/2,D?349:555,'',D?13:17,'#bdcdbf');
    this.passiveName=text(W/2,D?376:588,'',D?13:16,'#87bca4');
    this.passive=text(W/2,D?402:623,'',D?12:15,'#99ae9d').setWordWrapWidth(Math.min(450,W-88)).setAlign('center');
    const pickY=D?440:704,pickW=D?210:W-140;
    this.add.image(W/2,pickY,'ui_war_panel').setDisplaySize(pickW,D?40:58);
    const pick=this.add.rectangle(W/2,pickY,pickW,D?40:58,0x172b23,.2).setStrokeStyle(1,0x8e9c75).setInteractive({useHandCursor:true}).setName('choose-hero');
    text(W/2,pickY,'选择武将',D?17:21,'#dfd1ad');
    this.heroModal=this.add.container(0,0).setDepth(300).setVisible(false).setName('hero-picker');
    const modal=this.heroModal;
    const dim=this.add.rectangle(0,0,W,H,0x030906,.9).setOrigin(0).setInteractive().on('pointerdown',()=>modal.setVisible(false));modal.add(dim);
    modal.add(text(W/2,D?81:173,'选择出战武将',D?25:30,'#efd493').setFontStyle('bold'));
    modal.add(text(W/2,D?115:216,'四将各有所长 · 点选后返回',D?12:15,'#9bb4a2'));
    const cw=D?180:(W-92)/2,ch=D?226:214;
    CHARACTERS.forEach((c,i)=>{
      const x=D?W/2+(i-1.5)*(cw+14):46+cw/2+i%2*(cw+16),y=D?273:354+Math.floor(i/2)*(ch+18);
      const skin=this.add.image(x,y,'ui_war_panel').setDisplaySize(cw,ch);
      const bg=this.add.rectangle(x,y,cw,ch,0x182c22,.2).setInteractive({useHandCursor:true}).setName(`pick-${c.id}`);
      const decor=this.add.graphics(),icon=this.add.image(x,y-32,c.portrait);icon.setScale(Math.min(116/icon.width,116/icon.height));
      const name=text(x,y+49,c.name,26,'#f0dfb4').setFontFamily(TITLE_FONT),role=text(x,y+79,ROLES[i],D?10:12,'#a2baa9');
      const badge=text(x+cw/2-12,y-ch/2+17,'出战',12,'#f2d69a').setOrigin(1,.5);
      bg.on('pointerdown',()=>{this.selectedChar=i;this.renderSelection();modal.setVisible(false);});
      modal.add([skin,bg,decor,icon,name,role,badge]);this.charCards.push({bg,icon,badge,decor});
    });
    const back=text(W/2,D?449:857,'返回',D?17:21,'#d5c39c').setPadding(36,14).setInteractive({useHandCursor:true}).setName('hero-picker-close').on('pointerdown',()=>modal.setVisible(false));modal.add(back);
    pick.on('pointerdown',()=>{modal.setVisible(true);this.renderSelection();});
    const startY=D?493:820,startW=D?360:W-112,startH=D?48:66;
    this.startButton=this.add.rectangle(W/2,startY,startW,startH,0xc7aa65).setStrokeStyle(1,0xf3dca2).setInteractive({useHandCursor:true}).setName('start-campaign');
    this.startLabel=text(W/2,startY,'开始匡扶汉室',D?23:26,'#17251a').setFontStyle('bold');
    this.startButton.on('pointerdown',()=>this.startGame()).on('pointerover',()=>this.startButton.setFillStyle(0xe1c37e)).on('pointerout',()=>this.renderSelection());
    text(W/2,D?528:901,'第一波结束后招募援兵 · 关卡进度自动保存',D?10:13,'#788f7e');
    if(isChapterTestRun())text(W-34,37,'测试选关',13,'#d9bf7e').setOrigin(1,.5).setPadding(12,10).setInteractive({useHandCursor:true}).setName('dev-stage-picker').on('pointerdown',()=>{this.registry.set('menuChapterPicker',true);this.scene.restart();});
    const keys=this.input.keyboard,enter=()=>{if(modal.visible)modal.setVisible(false);else this.startGame();},escape=()=>modal.setVisible(false);
    keys?.on('keydown-ENTER',enter);keys?.on('keydown-ESC',escape);this.events.once('shutdown',()=>{keys?.off('keydown-ENTER',enter);keys?.off('keydown-ESC',escape);});
    this.renderSelection();if(params.has('autostart')||params.has('perf'))this.time.delayedCall(80,()=>this.startGame());
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
      c.tag.setText(!unlocked ? '未解锁' : c.id === 'huangjin' && chapterOneCleared() ? '已通关' : selected ? '已选择' : '可出征').setColor(!unlocked ? '#8f8c7b' : '#d4bb7e');
      c.hint.setVisible(c.id!=='huangjin');
      if(c.id==='huangjin')c.name.setText(`1-${this.selectedStage} ${YELLOW_STAGES[this.selectedStage-1].name}`).setFontSize(D?20:18);
      c.hint.setText(!unlocked ? '通关第一章后解锁' : `${chapter.waves.length} 波敌军   /   首领 · ${chapter.bossName}`).setColor(!unlocked ? '#818778' : '#a4b8a4');
      this.corners(c.decor, c.bg, selected);
    });
    this.stageTabs.forEach((t,i)=>{const unlocked=yellowStageUnlocked(i+1)||isChapterTestRun();t.setText(`1-${i+1}${unlocked?'':' 锁'}`).setColor(!unlocked?'#758075':this.selectedStage===i+1?'#ffe0a0':'#a9bfac').setBackgroundColor(this.selectedStage===i+1?'#354a36':'#12271f');});
    this.charCards.forEach((c, i) => {
      const selected = i === this.selectedChar;
      c.bg.setFillStyle(selected ? 0x2c4232 : 0x15271f,.22).setStrokeStyle(selected ? 2 : 1, selected ? 0xd2b474 : 0x3e5648);
      c.badge.setVisible(selected); c.icon.setAlpha(selected ? 1 : .83); this.corners(c.decor, c.bg, selected);
    });
    const c = CHARACTERS[this.selectedChar], ready = !!c && (chapterUnlocked(this.selectedChapter)||isChapterTestRun()) && !this.started;
    if (c) {
      this.heroName.setText(this.compactHome?c.name:`${c.name}  ·  ${ROLES[this.selectedChar].split(' · ')[0]}`);
      if(this.homePortrait){this.homePortrait.setTexture(c.portrait);this.homePortrait.setScale(Math.min((D?154:200)/this.homePortrait.width,(D?154:200)/this.homePortrait.height));}
      this.weapon.setText(`专属兵器  ${WEAPON_META[c.startWeapon].name}`);
      this.passiveName.setText(`天赋被动  ${CHARACTER_PASSIVES[c.id].name}`);
      this.passive.setText(PASSIVE_HINTS[this.selectedChar]);
    }
    this.startButton.setFillStyle(ready ? 0xc7aa65 : 0x465047).setAlpha(ready ? 1 : .6);
    if (ready) this.startButton.setInteractive({ useHandCursor: true }); else this.startButton.disableInteractive();
    this.startLabel.setText(ready&&this.compactHome?'开始匡扶汉室':ready ? `出征 · ${this.selectedChapter==='huangjin'?YELLOW_STAGES[this.selectedStage-1].name:getChapter(this.selectedChapter).name}` : this.started ? '正在出征…' : '请选择可用章节与武将');
  }
  private startGame(): void {
    if (this.heroModal?.visible) return;
    if (this.started || (!chapterUnlocked(this.selectedChapter)&&!isChapterTestRun()) || !CHARACTERS[this.selectedChar]) return;
    this.started = true; this.renderSelection();
    if(!isChapterTestRun())this.registry.set('worldCampaign',true);
    const c = CHARACTERS[this.selectedChar];
    this.registry.remove('campaignTransfer');
    this.registry.set('runConfig', { chapter: this.selectedChapter, stage: this.selectedChapter==='huangjin'?this.selectedStage:undefined, character: c.id, weapon: c.startWeapon } satisfies RunConfig);
    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('GameScene'));
  }
}
