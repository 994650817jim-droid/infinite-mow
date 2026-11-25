import Phaser from 'phaser';
import { CHARACTERS, HOME_ART_HEROES } from '../data/characters';
import { GAUNTLET_NAME, GAUNTLET_TAGLINE, lastGauntletHero, saveGauntletHero } from '../data/gauntlet';
import { HomeHeroPicker } from '../ui/HomeHeroPicker';
import { heroUnlocked } from '../systems/HeroUnlocks';
import { IS_DESKTOP as D } from '../config';

/**
 * 名将连战的选将页（用户 11-22「这个模式可以一开始就玩」）：模式不继承战役，所以不用主菜单 / 天下地图的当前主将——
 * 战役里主将定下来以后「更换武将」会锁住，换不了人。这里复用主页的选将卷轴（HomeHeroPicker，free：不看主将规则），
 * 可选 = 战役里已归附的武将 + 开局就有的那几位（新存档至少能选开局武将）；记住上次选的（GAUNTLET_HERO_KEY）。
 * 从哪进来（registry gauntletFrom：menu / map）「返回」就回哪；「出战」直接开打。
 */
export class GauntletPickScene extends Phaser.Scene {
  private from: 'menu' | 'map' = 'menu';
  private picker: HomeHeroPicker | null = null;
  constructor() { super('GauntletPickScene'); }
  create(): void {
    let extreme=new URLSearchParams(location.search).get('challenge')==='extreme';
    this.registry.set('gauntletExtreme',extreme);
    const route={label:()=>extreme?'极限三十阵　⇄':'标准二十阵　⇄',toggle:()=>{extreme=!extreme;this.registry.set('gauntletExtreme',extreme);}};
    this.from = this.registry.get('gauntletFrom') === 'map' ? 'map' : 'menu';
    this.cameras.main.setBackgroundColor('#17130e');
    this.picker = new HomeHeroPicker(this, index => this.launch(CHARACTERS[index].id), () => this.back(),
      { route, free: true, name: 'gauntlet-hero-picker', title: D ? GAUNTLET_NAME.split('').join(' ') + ' · 选 将' : GAUNTLET_NAME + ' · 选将', okLabel: '出 战', note: GAUNTLET_TAGLINE + ' · 不带战役成长' });
    const saved = lastGauntletHero(), at = CHARACTERS.findIndex(c => c.id === saved && heroUnlocked(c.id));
    this.picker.open(at >= 0 ? at : Math.max(0, CHARACTERS.findIndex(c => heroUnlocked(c.id))), true);
    this.loadArt();
    const keys = this.input.keyboard, enter = () => this.picker?.root.getByName('hero-confirm')?.emit('pointerdown'), esc = () => this.back();
    keys?.on('keydown-ENTER', enter); keys?.on('keydown-ESC', esc); this.events.once('shutdown', () => { keys?.off('keydown-ENTER', enter); keys?.off('keydown-ESC', esc); this.picker = null; });
  }
  /** 卷轴立绘（主页同一套水墨 / 大图）：没载过的现载，载完重画（载入中卷轴上写「载入中…」，不闪像素小人）。 */
  private loadArt(): void {
    let n = 0;
    for (const c of CHARACTERS) {
      if (!HOME_ART_HEROES.includes(c.id)) continue;
      if (!this.textures.exists('epic_hero_' + c.id)) { this.load.image('epic_hero_' + c.id, 'assets/epic-home/' + c.id + '.webp'); n++; }
      if (!this.textures.exists('ink_hero_' + c.id)) { this.load.image('ink_hero_' + c.id, 'assets/ink-scroll/' + c.id + '.webp'); n++; }
    }
    if (!n) return;
    this.load.once('complete', () => { if (this.sys.isActive()) this.picker?.refreshArt(); });
    this.load.start(); this.picker?.refreshArt();
  }
  /** 出战：记住这次选的武将，以他开打（不读战役构筑、不整军）。 */
  launch(hero: string): void {
    saveGauntletHero(hero);
    this.registry.remove('campaignTransfer'); this.registry.set('runConfig', { character: hero }); this.registry.set('gauntletFrom', this.from);
    if (this.registry.get('battleReady')) this.scene.start('GauntletGameScene');
    else { this.registry.set('pendingWarlord', 'GauntletGameScene'); this.registry.set('loadBattle', true); this.scene.start('BootScene'); }
  }
  private back(): void {
    if (this.from === 'map') { this.registry.set('mapFocusNode', 'gauntlet'); this.scene.start('WorldMapScene'); } else this.scene.start('MenuScene');
  }
  /** 测试用：选将卷轴。 */
  get gauntletPicker() { return this.picker; }
}
