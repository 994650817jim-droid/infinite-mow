import Phaser from 'phaser';
import {playMenuMusic} from '../systems/Music';
import {GUANDU_STAGES, GUANDU_PLAYABLE, GUANDU_ATLAS_FILES, type GuanduStage} from '../data/guanduChapter';
import {arcUnlocked, arcStageUnlocked, arcStages, alertLossWarning} from '../world/WorldStore';
import {isChapterTestRun} from '../systems/ChapterProgress';
import {CHARACTERS, type CharacterId} from '../data/characters';
import {worldText, W, H} from '../world/WorldUI';
import {TITLE_FONT} from '../config';

type StageCard = {bg: Phaser.GameObjects.Rectangle; strip: Phaser.GameObjects.Rectangle; status: Phaser.GameObjects.Text; art: Phaser.GameObjects.Image};

/** 第四章 · 官渡之战 选关（布局与第三章选关一致）。未实装的关显示“战报筹备中”，不可出征。 */
export class GuanduChapterScene extends Phaser.Scene {
  private selected: GuanduStage = 1; private hero: CharacterId = 'zhaoyun'; private cards: StageCard[] = []; private heroButtons: Phaser.GameObjects.Rectangle[] = [];
  private deployText!: Phaser.GameObjects.Text; private deployBg!: Phaser.GameObjects.Rectangle;
  constructor() { super('GuanduChapterScene'); }
  preload() { for (const [key, url] of Object.entries(GUANDU_ATLAS_FILES)) if (!this.textures.exists(key)) this.load.spritesheet(key, url, {frameWidth: 128, frameHeight: 128}); }
  private text(x: number, y: number, s: string, size = 16, color = '#ded2b9') { return worldText(this, x, y, s, size, color); }
  private action(x: number, y: number, w: number, h: number, label: string, fn: () => void, primary = false) {
    const bg = this.add.rectangle(x, y, w, h, primary ? 0x744530 : 0x241e1a, .96).setStrokeStyle(1, primary ? 0xc39b61 : 0x70604b).setInteractive({useHandCursor: true});
    const t = this.text(x, y, label, primary ? 22 : 17, primary ? '#ffdf9d' : '#d1c2a7').setOrigin(.5);
    bg.on('pointerover', () => bg.setFillStyle(primary ? 0x8b5438 : 0x3a2c23)).on('pointerout', () => bg.setFillStyle(primary ? 0x744530 : 0x241e1a)).on('pointerdown', () => bg.setAlpha(.7)).on('pointerup', () => { bg.setAlpha(1); fn(); });
    return {bg, t};
  }
  /** 已实装且已解锁（试炼模式下只要已实装）。 */
  private open(stage: number) { return stage <= GUANDU_PLAYABLE && (arcStageUnlocked('guandu', stage) || isChapterTestRun()); }
  create() {
    playMenuMusic(this);
    if (!this.registry.get('battleReady')) { this.registry.set('pendingWarlord', 'GuanduChapterScene'); this.registry.set('loadBattle', true); this.scene.start('BootScene'); return; }
    this.cards = []; this.heroButtons = [];
    const desk = W > 600;
    this.selected = Math.min(GUANDU_PLAYABLE, arcStages('guandu') + 1) as GuanduStage;
    { const pick = Number(this.registry.get('worldStagePick')); this.registry.remove('worldStagePick'); if ([1, 2, 3].includes(pick) && pick <= GUANDU_PLAYABLE && this.open(pick)) this.selected = pick as GuanduStage; }
    try { const saved = localStorage.getItem('im_last_hero'); if (CHARACTERS.some(c => c.id === saved)) this.hero = saved as CharacterId; } catch { /* storage unavailable */ }
    this.cameras.main.setBackgroundColor('#1a1813');
    const g = this.add.graphics(); g.fillStyle(0x2b2619, .6);
    for (let i = 0; i < 8; i++) g.fillTriangle(i * W / 6 - 140, H * .62, i * W / 6 + 80, H * .26 + (i % 3) * 40, i * W / 6 + 290, H * .62);
    g.lineStyle(1, 0x8a7049, .09); for (let y = 110; y < H; y += 40) g.lineBetween(0, y, W, y - 90);
    g.lineStyle(1, 0xa98250, .45).lineBetween(28, desk ? 113 : 144, W - 28, desk ? 113 : 144);
    this.text(30, desk ? 19 : 24, '征 战  ·  第 四 章', 12, '#b69a6b');
    this.text(28, desk ? 40 : 49, '官渡之战', desk ? 35 : 39, '#e8cf98').setFontFamily(TITLE_FONT);
    this.text(30, desk ? 86 : 106, '袁曹相持，胜负系于粮道。', desk ? 14 : 17, '#b9ae99');
    this.action(W - 83, desk ? 48 : 52, 110, 40, '返回地图', () => this.scene.start('WorldMapScene')).bg.setName('guandu-return');
    if (isChapterTestRun()) this.text(W - 30, desk ? 91 : 116, '试炼模式 · 已实装关可选', 11, '#b09573').setOrigin(1, 0);
    const cardY = desk ? 135 : 166, cw = desk ? (W - 84) / 3 : W - 56, ch = desk ? 248 : 170;
    GUANDU_STAGES.forEach((d, i) => {
      const x = desk ? 28 + i * (cw + 14) : 28, y = desk ? cardY : cardY + i * (ch + 14), open = this.open(d.stage), built = d.stage <= GUANDU_PLAYABLE;
      const bg = this.add.rectangle(x + cw / 2, y + ch / 2, cw, ch, 0x29231d, .94).setStrokeStyle(1, 0x6a5740).setName('guandu-stage-' + d.stage).setInteractive({useHandCursor: open});
      const strip = this.add.rectangle(x + 2, y + ch / 2, 3, ch - 4, 0xc8a468).setOrigin(0, .5);
      this.add.rectangle(x + cw / 2, y + ch - 22, cw - 2, 42, 0x120f0d, .48);
      this.text(x + 17, y + 14, '0' + d.stage + '  /  ' + d.tag, 12, '#b2956d');
      const art = this.add.image(desk ? x + cw - 76 : x + cw - 73, desk ? y + 105 : y + 76, d.atlas, 0).setDisplaySize(desk ? 142 : 126, desk ? 142 : 126).setAlpha(open ? 1 : .3);
      this.text(x + 17, desk ? y + 145 : y + 47, d.name, desk ? 26 : 27, open ? '#f0dfbb' : '#9c9281');
      this.text(x + 18, desk ? y + 182 : y + 88, !built ? '战报筹备中 · 敬请期待' : open ? d.boss + ' · ' + d.feature : '战报未至 · 待前关告捷', desk ? 13 : 15, '#baad94');
      const status = this.text(x + cw - 16, y + ch - 22, '', 13).setOrigin(1, .5);
      this.text(x + 17, y + ch - 22, '4-' + d.stage, 13, '#9a8666').setOrigin(0, .5);
      bg.on('pointerover', () => { if (open) bg.setFillStyle(0x3a2e23); }).on('pointerout', () => this.refresh()).on('pointerdown', () => { if (open) { this.selected = d.stage; this.refresh(); } });
      this.cards.push({bg, strip, status, art});
    });
    const hy = desk ? 431 : 787;
    this.text(30, desk ? 397 : 735, '出战武将', 13, '#b6a07b'); this.text(W - 30, desk ? 397 : 735, '点击更换 · 不影响征程进度', 11, '#8f8473').setOrigin(1, 0);
    CHARACTERS.forEach((c, i) => { const w = (W - 50 - 5 * CHARACTERS.length) / CHARACTERS.length, x = 28 + i * (w + 5), a = this.action(x + w / 2, hy, w, desk ? 42 : 55, c.name, () => { this.hero = c.id; this.refresh(); }); a.bg.setName('guandu-hero-' + c.id); this.heroButtons.push(a.bg); });
    g.lineStyle(1, 0x8b704a, .45).lineBetween(28, desk ? 466 : 838, W - 28, desk ? 466 : 838);
    const a = this.action(desk ? W - 178 : W / 2, desk ? 503 : 885, desk ? 300 : W - 56, desk ? 50 : 62, '', () => this.depart(), true);
    this.deployBg = a.bg.setName('guandu-deploy'); this.deployText = a.t;
    { const warn = isChapterTestRun() ? '' : alertLossWarning(); if (warn) this.text(desk ? W - 178 : W / 2, desk ? 459 : 826, warn, desk ? 11 : 12, '#ff8a70').setOrigin(.5).setName('chapter-alert-warning'); }
    if (desk) this.text(30, 488, '焚其粮草 · 断其根本', 15, '#b8a17d');
    this.text(desk ? 30 : W / 2, desk ? 512 : 934, '关间可休整 · 成长与部队随军继承', 11, '#8f8473').setOrigin(desk ? 0 : .5, 0);
    this.refresh();
  }
  private depart() {
    if (!this.open(this.selected)) return;
    if (!isChapterTestRun()) try { localStorage.setItem('im_last_hero', this.hero); } catch { /* storage unavailable */ }
    this.registry.remove('campaignTransfer'); this.registry.remove('guanduTransfer');
    this.registry.set('guanduStage', this.selected); this.registry.set('runConfig', {character: this.hero});
    this.scene.start('GuanduGameScene');
  }
  private refresh() {
    const cleared = arcStages('guandu');
    this.cards.forEach((c, i) => {
      const stage = i + 1, open = this.open(stage), chosen = this.selected === stage, built = stage <= GUANDU_PLAYABLE;
      c.bg.setFillStyle(chosen ? 0x413020 : 0x29231d).setStrokeStyle(chosen ? 2 : 1, chosen ? 0xd7b778 : 0x65543f); c.strip.setVisible(chosen);
      c.status.setText(cleared >= stage ? '✓ 已告捷' : !built ? '筹备中' : !open ? !arcUnlocked('guandu') ? '锁定 · 平定群雄割据' : '锁定 · 完成前关' : chosen ? '◆ 当前出征' : '可出征').setColor(chosen ? '#f0ce8f' : '#a99c86');
    });
    this.heroButtons.forEach((h, i) => h.setFillStyle(CHARACTERS[i].id === this.hero ? 0x51402b : 0x241e1a).setStrokeStyle(1, CHARACTERS[i].id === this.hero ? 0xd7b778 : 0x70604b));
    this.deployText.setText('出征  ·  ' + GUANDU_STAGES[this.selected - 1].name);
  }
}
