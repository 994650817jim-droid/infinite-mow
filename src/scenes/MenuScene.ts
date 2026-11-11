import Phaser from 'phaser';
import { CHAPTERS, getChapter, type ChapterId } from '../data/chapters';
import { CHARACTERS, type RunConfig } from '../data/characters';
import { CHARACTER_PASSIVES } from '../data/passives';
import { WEAPON_META } from '../data/upgrades';
import { chapterOneCleared, chapterUnlocked, isChapterTestRun } from '../systems/ChapterProgress';
import { FONT, GAME_HEIGHT as H, GAME_WIDTH as W, IS_DESKTOP as D, switchLayout } from '../config';

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
    this.started = false; this.chapterButtons = []; this.charCards = [];
    const params = new URLSearchParams(window.location.search), saved = this.registry.get('runConfig') as RunConfig | undefined;
    const requested = getChapter(params.get('chapter') ?? saved?.chapter).id;
    this.selectedChapter = chapterUnlocked(requested) ? requested : 'huangjin';
    this.selectedChar = params.has('autostart') || params.has('perf') ? 0 : Math.max(0, CHARACTERS.findIndex(c => c.id === saved?.character));
    this.cameras.main.resetFX(); this.cameras.main.setBackgroundColor('#101813');
    const text = (x: number, y: number, value: string, size: number, color = '#ede4cc') => this.add.text(x, y, value, { fontFamily: FONT, fontSize: `${size}px`, color, resolution: 2 });
    this.add.tileSprite(0, 0, W, H, 'ground_hulao').setOrigin(0).setAlpha(.16);
    this.add.rectangle(0, 0, W, H, 0x0b1612, .82).setOrigin(0);
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(.65);
    const frame = this.add.graphics();
    frame.lineStyle(1, 0x977e4e, .3).strokeRect(12, 12, W - 24, H - 24);
    for (const x of [12, W - 12]) for (const y of [12, H - 12]) {
      const sx = x < W / 2 ? 1 : -1, sy = y < H / 2 ? 1 : -1;
      frame.lineStyle(2, 0xc9ad70, .8).lineBetween(x, y, x + sx * 28, y).lineBetween(x, y, x, y + sy * 28);
    }
    text(28, D ? 22 : 48, '乱世千军', D ? 32 : 38, '#efd493').setFontStyle('bold');
    text(D ? 196 : 30, D ? 32 : 99, '三国割草 · 将星出征', D ? 13 : 14, '#8eaa9c');
    const layout = text(W - 28, D ? 29 : 59, D ? '手机布局' : '电脑布局', 12, '#acb5a0').setOrigin(1, 0).setPadding(6, 6).setInteractive({ useHandCursor: true });
    layout.on('pointerdown', () => switchLayout(D ? 'mobile' : 'desktop')).on('pointerover', () => layout.setColor('#f1d69a')).on('pointerout', () => layout.setColor('#acb5a0'));
    const section = (y: number, n: string, title: string, tip: string) => {
      text(28, y, n, 12, '#63a99a'); text(55, y - 2, title, 15, '#d5c397');
      text(W - 28, y, tip, 11, '#829488').setOrigin(1, 0);
    };
    section(D ? 78 : 143, '壹', '选择战役', chapterOneCleared() ? '战役进度已保存' : '首战 · 黄巾之乱');
    CHAPTERS.forEach((chapter, i) => {
      const width = (W - 68) / 2, x = 28 + width / 2 + i * (width + 12), y = D ? 139 : 216, height = D ? 82 : 108;
      const bg = this.add.rectangle(x, y, width, height, 0x182b23).setInteractive({ useHandCursor: true });
      const decor = this.add.graphics();
      text(x - width / 2 + 16, y - height / 2 + 12, i === 0 ? '第一章' : '第二章', 11, '#87a392');
      const tag = text(x + width / 2 - 14, y - height / 2 + 12, '', 11).setOrigin(1, 0);
      const name = text(x - width / 2 + 16, y - (D ? 2 : 7), chapter.name, D ? 21 : 20, '#ead5a7').setOrigin(0, .5);
      const hint = text(x - width / 2 + 16, y + (D ? 23 : 27), '', D ? 12 : 13, '#a6b8ab').setOrigin(0, .5);
      bg.on('pointerdown', () => { if (!chapterUnlocked(chapter.id)) return; this.selectedChapter = chapter.id; this.renderSelection(); });
      bg.on('pointerover', () => { if (chapterUnlocked(chapter.id) && this.selectedChapter !== chapter.id) bg.setFillStyle(0x263c30).setStrokeStyle(1, 0xa6b996); });
      bg.on('pointerout', () => this.renderSelection());
      this.chapterButtons.push({ id: chapter.id, bg, name, tag, hint, decor });
    });
    section(D ? 195 : 287, '贰', '选择武将', '四将各有所长');
    const cardW = D ? (W - 92) / 4 : (W - 68) / 2, cardH = D ? 162 : 164;
    CHARACTERS.forEach((c, i) => {
      const x = 28 + cardW / 2 + (D ? i : i % 2) * (cardW + 12), y = D ? 291 : 389 + Math.floor(i / 2) * 178;
      const bg = this.add.rectangle(x, y, cardW, cardH, 0x15251e).setInteractive({ useHandCursor: true });
      const decor = this.add.graphics();
      const icon = this.add.image(x, y - 25, c.portrait);
      const max = D ? 95 : 98; icon.setScale(Math.min(max / icon.width, max / icon.height)); if (c.tint) icon.setTint(c.tint);
      text(x, y + 39, c.name, D ? 22 : 23, '#f0e5c6').setOrigin(.5);
      text(x, y + 64, ROLES[i], D ? 11 : 14, '#9cb7a7').setOrigin(.5);
      const badge = text(x + cardW / 2 - 10, y - cardH / 2 + 9, '出战', 11, '#f3d89a').setOrigin(1, 0);
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
  private corners(g: Phaser.GameObjects.Graphics, bg: Phaser.GameObjects.Rectangle, selected: boolean): void {
    g.clear(); if (!selected) return;
    const r = bg.getBounds(), n = 10;
    g.lineStyle(2, 0xf0d395, 1);
    for (const x of [r.left, r.right]) for (const y of [r.top, r.bottom]) {
      g.lineBetween(x, y, x + (x === r.left ? n : -n), y).lineBetween(x, y, x, y + (y === r.top ? n : -n));
    }
  }
  private renderSelection(): void {
    this.chapterButtons.forEach(c => {
      const unlocked = chapterUnlocked(c.id), selected = unlocked && c.id === this.selectedChapter, chapter = getChapter(c.id);
      c.bg.setFillStyle(!unlocked ? 0x161c19 : selected ? 0x2b4030 : 0x182a22).setStrokeStyle(selected ? 2 : 1, selected ? 0xc6aa6c : unlocked ? 0x45604d : 0x363d34);
      if (unlocked) c.bg.setInteractive({ useHandCursor: true }); else c.bg.disableInteractive();
      c.name.setColor(!unlocked ? '#747e71' : selected ? '#f4d99f' : '#c8d4bf');
      c.tag.setText(!unlocked ? '未解锁' : c.id === 'huangjin' && chapterOneCleared() ? '已通关' : selected ? '已选择' : '可出征').setColor(!unlocked ? '#8f8c7b' : '#d4bb7e');
      c.hint.setText(!unlocked ? '通关第一章后解锁' : `${chapter.waves.length} 波敌军   /   首领 · ${chapter.bossName}`).setColor(!unlocked ? '#818778' : '#a4b8a4');
      this.corners(c.decor, c.bg, selected);
    });
    this.charCards.forEach((c, i) => {
      const selected = i === this.selectedChar;
      c.bg.setFillStyle(selected ? 0x2c4232 : 0x15271f).setStrokeStyle(selected ? 2 : 1, selected ? 0xd2b474 : 0x3e5648);
      c.badge.setVisible(selected); c.icon.setAlpha(selected ? 1 : .83); this.corners(c.decor, c.bg, selected);
    });
    const c = CHARACTERS[this.selectedChar], ready = !!c && chapterUnlocked(this.selectedChapter) && !this.started;
    if (c) {
      this.heroName.setText(`${c.name}  ·  ${ROLES[this.selectedChar].split(' · ')[0]}`);
      this.weapon.setText(`专属兵器  ${WEAPON_META[c.startWeapon].name}`);
      this.passiveName.setText(`天赋被动  ${CHARACTER_PASSIVES[c.id].name}`);
      this.passive.setText(PASSIVE_HINTS[this.selectedChar]);
    }
    this.startButton.setFillStyle(ready ? 0xc7aa65 : 0x465047).setAlpha(ready ? 1 : .6);
    if (ready) this.startButton.setInteractive({ useHandCursor: true }); else this.startButton.disableInteractive();
    this.startLabel.setText(ready ? `出征 · ${getChapter(this.selectedChapter).name}` : this.started ? '正在出征…' : '请选择可用章节与武将');
  }
  private startGame(): void {
    if (this.started || !chapterUnlocked(this.selectedChapter) || !CHARACTERS[this.selectedChar]) return;
    this.started = true; this.renderSelection();
    const c = CHARACTERS[this.selectedChar];
    this.registry.remove('campaignTransfer');
    this.registry.set('runConfig', { chapter: this.selectedChapter, character: c.id, weapon: c.startWeapon } satisfies RunConfig);
    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('GameScene'));
  }
}
