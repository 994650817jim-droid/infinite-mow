import Phaser from 'phaser';
import { DEPTH, FONT, GAME_WIDTH } from '../config';
import { MAP_ICONS, MAP_ICONS_FILES } from './PaintedMap';
import type { PhaseKind, PhasePlan } from '../data/stagePhases';

/**
 * 顶部「战况」线（wave-progression-redesign.md §2.1a，2026-11-19 用户批准）：不显示「第 x/5 波」，
 * 一条起点 → 首领的细线，线上排着各段的小图标（先锋 / 精锐 / 事件 / 副将 / 首领，古舆图图标），小旗沿线走。
 * 走过的图标点亮、下一个轻轻呼吸；线下一行小字写「下一段 · 名字 · 剩余秒数」。首领登场后整条淡出（让位给首领血条）。
 * 每帧只挪小旗与进度线（Graphics 重画一条线，成本很低）；图标只在换段时改状态。
 */
const ICON: Record<PhaseKind, string> = { vanguard: 'enemy', elite: 'elite', event: 'supply', lieutenant: 'banner', surge: 'enemy', boss: 'seal' };
const GLYPH: Record<PhaseKind, string> = { vanguard: '先', elite: '精', event: '伏', lieutenant: '将', surge: '军', boss: '帅' };
const KIND_NAME: Record<PhaseKind, string> = { vanguard: '先锋', elite: '精锐', event: '事件', lieutenant: '副将', surge: '大军', boss: '首领' };

/** 顶部细带：高度、线的位置（地图像素，屏幕坐标）。场景按 BattleTrack.HEIGHT 把计时器 / 关名往下挪。 */
const STRIP_H = 31, LINE_Y = 10;
export class BattleTrack {
  static readonly HEIGHT = STRIP_H;
  readonly root: Phaser.GameObjects.Container;
  private readonly line: Phaser.GameObjects.Graphics;
  private readonly icons: Array<{ img?: Phaser.GameObjects.Image; seal: Phaser.GameObjects.Container; x: number; kind: PhaseKind }> = [];
  private readonly flag: Phaser.GameObjects.Container;
  private readonly caption: Phaser.GameObjects.Text;
  private readonly w: number;
  private cur = -1; private gone = false;
  /** 测试用。 */
  readonly stats = { phase: -1, progress: 0, iconsLit: 0 };

  constructor(private readonly scene: Phaser.Scene, private readonly plan: PhasePlan) {
    // 2026-11-19 用户「顶部「战况」线放在屏幕最上面」：贴着屏幕上沿的一条细带（上边不留圆角），计时器 / 关名由场景往下挪（GameScene.applyPhases）
    const desktop = GAME_WIDTH >= 900, L = LINE_Y; this.w = desktop ? 300 : 240;
    this.root = scene.add.container(GAME_WIDTH / 2, 0).setScrollFactor(0).setDepth(DEPTH.hud + 2).setName('battle-track');
    // 2026-11-19 用户「不要黑框」：去掉线后面的半透明黑底圆角框；只留一道细墨线（下面垫一道柔和暗影，压在亮地面上也看得清）
    const back = scene.add.graphics();
    back.lineStyle(5, 0x000000, .28).lineBetween(-this.w / 2 - 1, L + 1, this.w / 2 + 1, L + 1);
    back.lineStyle(2, 0x5a4630, .95).lineBetween(-this.w / 2, L, this.w / 2, L);
    this.line = scene.add.graphics();
    this.root.add([back, this.line]);
    const bossAt = Math.max(1, plan.bossAt);
    for (const p of plan.phases) {
      const x = -this.w / 2 + this.w * Math.min(1, p.start / bossAt);
      const seal = scene.add.container(x, L).setName('track-' + p.kind);
      const g = scene.add.graphics(); const r = p.kind === 'boss' ? 8 : 7;
      g.fillStyle(p.kind === 'boss' ? 0x8a1a10 : 0x2a1f14, 1).fillCircle(0, 0, r).lineStyle(1.5, p.kind === 'boss' ? 0xf0c070 : 0xc9a86a, 1).strokeCircle(0, 0, r);
      const t = scene.add.text(0, 0, GLYPH[p.kind], { fontFamily: FONT, fontSize: p.kind === 'boss' ? '12px' : '10px', color: p.kind === 'boss' ? '#ffe2a8' : '#e8d3a6', resolution: 2 }).setOrigin(.5);
      seal.add([g, t]); this.root.add(seal);
      this.icons.push({ seal, x, kind: p.kind });
    }
    // 进度标：线上一枚朱红菱形（贴着屏幕上沿，旗杆会伸出屏幕外，所以不用小旗）
    this.flag = scene.add.container(-this.w / 2, L).setName('track-flag');
    const fg = scene.add.graphics();
    fg.fillStyle(0xc0301c, 1).fillPoints([{ x: 0, y: -6 }, { x: 5, y: 0 }, { x: 0, y: 6 }, { x: -5, y: 0 }], true).lineStyle(1.2, 0xf3d48a, 1).strokePoints([{ x: 0, y: -6 }, { x: 5, y: 0 }, { x: 0, y: 6 }, { x: -5, y: 0 }], true);
    this.flag.add(fg); this.root.add(this.flag);
    this.caption = scene.add.text(0, L + 13, '', { fontFamily: FONT, fontSize: desktop ? '11px' : '10px', color: '#f0e2bc', resolution: 2, stroke: '#140e08', strokeThickness: 3 }).setOrigin(.5, .5).setShadow(0, 1, '#000000', 3, true, true).setName('track-caption'); // 没有底框：描边 + 柔影保证可读
    this.root.add(this.caption);
    this.loadIcons();
  }

  /** 古舆图图标（和战场舆图同一张图集）：载入后盖在印章上；没载入前先用印章字。 */
  private loadIcons(): void {
    const s = this.scene, put = () => {
      if (!this.root.active || !s.textures.exists(MAP_ICONS)) return;
      for (const ic of this.icons) {
        if (ic.img || !s.textures.get(MAP_ICONS).has(ICON[ic.kind])) continue;
        const sz = ic.kind === 'boss' ? 20 : 16;
        ic.img = s.add.image(0, 0, MAP_ICONS, ICON[ic.kind]).setDisplaySize(sz, sz);
        ic.seal.removeAll(true); ic.seal.add(ic.img);
        if (ic.kind === 'boss') ic.seal.add(s.add.text(0, 1, '帅', { fontFamily: FONT, fontSize: '11px', color: '#9a1a10', resolution: 2 }).setOrigin(.5));
      }
      if (this.cur >= 0) this.paintStates();
    };
    if (s.textures.exists(MAP_ICONS)) { put(); return; }
    s.load.atlas(MAP_ICONS, MAP_ICONS_FILES.png, MAP_ICONS_FILES.json); s.load.once(Phaser.Loader.Events.COMPLETE, put); if (!s.load.isLoading()) s.load.start();
  }

  private paintStates(): void {
    let lit = 0;
    this.icons.forEach((ic, i) => {
      const passed = i <= this.cur; if (passed) lit++;
      ic.seal.setAlpha(passed ? 1 : i === this.cur + 1 ? .85 : .45);
      if (i !== this.cur + 1) { this.scene.tweens.killTweensOf(ic.seal); ic.seal.setScale(1); }
    });
    const next = this.icons[this.cur + 1];
    if (next) this.scene.tweens.add({ targets: next.seal, scale: 1.18, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.stats.iconsLit = lit;
  }

  /** 每帧：elapsed = 关内秒数；phase = 当前段序号；bossOn = 首领已登场。 */
  update(elapsed: number, phase: number, bossOn: boolean, bossName: string): void {
    if (this.gone) return;
    if (phase !== this.cur) { this.cur = phase; this.stats.phase = phase; this.paintStates(); }
    const k = Math.max(0, Math.min(1, elapsed / Math.max(1, this.plan.bossAt))); this.stats.progress = k;
    const x = -this.w / 2 + this.w * k; this.flag.x = x;
    this.line.clear().lineStyle(2.5, 0xe8b860, .95).lineBetween(-this.w / 2, LINE_Y, x, LINE_Y);
    const nx = this.plan.phases[phase + 1];
    if (bossOn || !nx) {
      this.caption.setText(bossOn ? '首领 · ' + bossName : '');
      if (bossOn) { this.gone = true; this.scene.tweens.add({ targets: this.root, alpha: 0, duration: 900, delay: 1600, onComplete: () => this.root.setVisible(false) }); }
      return;
    }
    const left = Math.max(0, Math.ceil(nx.start - elapsed));
    this.caption.setText('下一段 · ' + (nx.kind === 'boss' ? '首领 ' + bossName : nx.name) + ' · ' + left + ' 秒');
  }
  /** 跟随 HUD 显隐（暂停 / 三选一等全屏面板时藏起来）；首领登场淡出后不再显示。 */
  show(v: boolean): void { if (!this.gone) this.root.setVisible(v); }
  /** 段落横幅的小字（「精锐」「副将」…）。 */
  static kindName(kind: PhaseKind): string { return KIND_NAME[kind]; }
  destroy(): void { this.root.destroy(); }
}
