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
const ICON: Record<PhaseKind, string> = { vanguard: 'enemy', elite: 'elite', event: 'supply', lieutenant: 'banner', boss: 'seal' };
const GLYPH: Record<PhaseKind, string> = { vanguard: '先', elite: '精', event: '伏', lieutenant: '将', boss: '帅' };
const KIND_NAME: Record<PhaseKind, string> = { vanguard: '先锋', elite: '精锐', event: '事件', lieutenant: '副将', boss: '首领' };

export class BattleTrack {
  readonly root: Phaser.GameObjects.Container;
  private readonly line: Phaser.GameObjects.Graphics;
  private readonly icons: Array<{ img?: Phaser.GameObjects.Image; seal: Phaser.GameObjects.Container; x: number; kind: PhaseKind }> = [];
  private readonly flag: Phaser.GameObjects.Container;
  private readonly caption: Phaser.GameObjects.Text;
  private readonly w: number;
  private cur = -1; private gone = false;
  /** 测试用。 */
  readonly stats = { phase: -1, progress: 0, iconsLit: 0 };

  constructor(private readonly scene: Phaser.Scene, private readonly plan: PhasePlan, y = 83) {
    const desktop = GAME_WIDTH >= 900; this.w = desktop ? 300 : 240;
    this.root = scene.add.container(GAME_WIDTH / 2, y).setScrollFactor(0).setDepth(DEPTH.hud + 2).setName('battle-track');
    const back = scene.add.graphics();
    back.fillStyle(0x16100a, .42).fillRoundedRect(-this.w / 2 - 16, -11, this.w + 32, 22, 10);
    back.lineStyle(1, 0xc9a86a, .35).strokeRoundedRect(-this.w / 2 - 16, -11, this.w + 32, 22, 10);
    back.lineStyle(2, 0x6b5638, .9).lineBetween(-this.w / 2, 0, this.w / 2, 0);
    this.line = scene.add.graphics();
    this.root.add([back, this.line]);
    const bossAt = Math.max(1, plan.bossAt);
    for (const p of plan.phases) {
      const x = -this.w / 2 + this.w * Math.min(1, p.start / bossAt);
      const seal = scene.add.container(x, 0).setName('track-' + p.kind);
      const g = scene.add.graphics(); const r = p.kind === 'boss' ? 10 : 8;
      g.fillStyle(p.kind === 'boss' ? 0x8a1a10 : 0x2a1f14, 1).fillCircle(0, 0, r).lineStyle(1.5, p.kind === 'boss' ? 0xf0c070 : 0xc9a86a, 1).strokeCircle(0, 0, r);
      const t = scene.add.text(0, 0, GLYPH[p.kind], { fontFamily: FONT, fontSize: p.kind === 'boss' ? '12px' : '10px', color: p.kind === 'boss' ? '#ffe2a8' : '#e8d3a6', resolution: 2 }).setOrigin(.5);
      seal.add([g, t]); this.root.add(seal);
      this.icons.push({ seal, x, kind: p.kind });
    }
    this.flag = scene.add.container(-this.w / 2, -2).setName('track-flag');
    const fg = scene.add.graphics();
    fg.lineStyle(1.5, 0x3a2412, 1).lineBetween(0, 2, 0, -16);
    fg.fillStyle(0xc0301c, 1).fillTriangle(0, -16, 11, -12.5, 0, -9).lineStyle(1, 0x5a120a, 1).strokeTriangle(0, -16, 11, -12.5, 0, -9);
    this.flag.add(fg); this.root.add(this.flag);
    this.caption = scene.add.text(0, 13, '', { fontFamily: FONT, fontSize: desktop ? '11px' : '10px', color: '#e7d6ae', resolution: 2, stroke: '#140e08', strokeThickness: 3 }).setOrigin(.5, 0).setName('track-caption');
    this.root.add(this.caption);
    this.loadIcons();
  }

  /** 古舆图图标（和战场舆图同一张图集）：载入后盖在印章上；没载入前先用印章字。 */
  private loadIcons(): void {
    const s = this.scene, put = () => {
      if (!this.root.active || !s.textures.exists(MAP_ICONS)) return;
      for (const ic of this.icons) {
        if (ic.img || !s.textures.get(MAP_ICONS).has(ICON[ic.kind])) continue;
        const sz = ic.kind === 'boss' ? 24 : 19;
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
    this.line.clear().lineStyle(2.5, 0xe8b860, .95).lineBetween(-this.w / 2, 0, x, 0);
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
