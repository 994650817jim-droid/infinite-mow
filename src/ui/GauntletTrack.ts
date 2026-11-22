import Phaser from 'phaser';
import { DEPTH, FONT, GAME_WIDTH } from '../config';

/**
 * 名将连战顶部「十阵」进度条（总制作人 11-21，用户「要做个可以动的进度条」；11-21 验收第二轮：下移、放大、标骑在线上）。
 * 画法沿用战役顶部的战况线（ui/BattleTrack）：一道细墨线 + 走过的一段描金（不画底板）；线上 10 个节点 = 十阵：
 *  - 没到的阵：暗的空节点，写「？」（不提前剧透是谁）；第十阵（守关）大一号、朱红底；
 *  - 这一阵的名将登场：节点换成他的圆头像（首领图裁出来的），比别的节点大一号、描金粗边、轻轻起伏；
 *  - 斩将：头像缩回、盖一枚缩小的朱印（结局用的 seal_red_2），盖印时一压；
 * 进度标：主将的圆头像（状态框同一张 hud_medal2_<主将>），骑在线上走；割草时按时间从上一个节点走到下一个节点前（走到头正好名将登场），
 * 名将在场时停在节点前、呼吸式放大（不盖住节点上的头像）；斩将后下一阵继续走。
 * 线下一行小字：第 N/10 阵 · 距名将登场 mm:ss / 名将名字；无尽时每十阵一轮，写「无尽 · 第 N 阵」。
 * 计时器排在小字下面（场景按 HEIGHT 摆），三行上下排开不重叠。
 */
const LINE_Y = 30, NODE_R = 12, GATE_R = 15, HEAD = 26, GATE_HEAD = 32, HEAD_UP = 30, GATE_HEAD_UP = 36, MEDAL = 24, CAPTION_Y = LINE_Y + 31;
export type TrackNodeState = 'dark' | 'up' | 'killed';
interface TrackNode { root: Phaser.GameObjects.Container; x: number; gate: boolean; state: TrackNodeState; head?: Phaser.GameObjects.Image; seal?: Phaser.GameObjects.Image; ring?: Phaser.GameObjects.Graphics }

export class GauntletTrack {
  /** 顶部细带的高度（进度条 + 小字）：场景把计时器摆在它下面。 */
  static readonly HEIGHT = CAPTION_Y + 12;
  readonly root: Phaser.GameObjects.Container;
  private readonly gold: Phaser.GameObjects.Graphics;
  private readonly nodes: TrackNode[] = [];
  private readonly marker: Phaser.GameObjects.Container;
  private medal: Phaser.GameObjects.Image | null = null;
  private readonly caption: Phaser.GameObjects.Text;
  private readonly w: number;
  private cycle = -1; private breathing = false;
  /** 测试用：进度（0～1，节点 j 在 j/阵数）、标的横坐标、各节点横坐标与状态。 */
  readonly stats = { pos: 0, markerX: 0, nodeX: [] as number[], states: [] as TrackNodeState[], cycle: 0, caption: '' };

  constructor(private readonly scene: Phaser.Scene, private readonly waves: number, private readonly heroMedal: string, private readonly sealKey: string) {
    const desktop = GAME_WIDTH >= 900; this.w = desktop ? 400 : 300; // 右端守关节点离舆图卷轴留 15px 以上
    this.root = scene.add.container(GAME_WIDTH / 2, 0).setScrollFactor(0).setDepth(DEPTH.hud + 2).setName('gauntlet-track');
    // 墨线（下垫一道柔和暗影，压在亮地面上也看得清）：同战况线，不画底板
    const back = scene.add.graphics();
    back.lineStyle(7, 0x000000, .3).lineBetween(-this.w / 2 - 1, LINE_Y + 1, this.w / 2 + 1, LINE_Y + 1);
    back.lineStyle(3, 0x5a4630, .95).lineBetween(-this.w / 2, LINE_Y, this.w / 2, LINE_Y);
    back.fillStyle(0x5a4630, .95).fillCircle(-this.w / 2, LINE_Y, 4); // 起点
    this.gold = scene.add.graphics();
    this.root.add([back, this.gold]);
    for (let j = 1; j <= waves; j++) {
      const x = -this.w / 2 + this.w * j / waves, root = scene.add.container(x, LINE_Y).setName('gauntlet-node-' + j);
      this.root.add(root); this.nodes.push({ root, x, gate: j === waves, state: 'dark' });
    }
    // 进度标：主将圆头像骑在线上（描金细圈）；头像图还没好时先用朱红菱形（同战况线）
    this.marker = scene.add.container(-this.w / 2, LINE_Y).setName('gauntlet-marker');
    const d = scene.add.graphics().setName('gauntlet-marker-diamond'), pts = [{ x: 0, y: -8 }, { x: 6, y: 0 }, { x: 0, y: 8 }, { x: -6, y: 0 }];
    d.fillStyle(0xc0301c, 1).fillPoints(pts, true).lineStyle(1.4, 0xf3d48a, 1).strokePoints(pts, true);
    this.marker.add(d); this.root.add(this.marker);
    this.caption = scene.add.text(0, CAPTION_Y, '', { fontFamily: FONT, fontSize: desktop ? '13px' : '11px', color: '#f0e2bc', resolution: 2, stroke: '#140e08', strokeThickness: 3 })
      .setOrigin(.5, .5).setShadow(0, 1, '#000000', 3, true, true).setName('gauntlet-track-caption');
    this.root.add(this.caption);
    this.stats.nodeX = this.nodes.map(n => n.x);
  }

  /** 进到第 wave 阵（1 起）：换轮（无尽每十阵一轮）时所有节点回到暗的。gateRound = 这一轮的末节点算守关（只有前十阵）。 */
  setWave(wave: number, gateRound: boolean): void {
    const c = Math.floor((wave - 1) / this.waves);
    if (c === this.cycle) return;
    this.cycle = c; this.stats.cycle = c;
    this.nodes.forEach((n, i) => { n.gate = gateRound && i === this.waves - 1; this.paintDark(n); });
  }
  /** 这一阵的名将登场：节点换成他的圆头像（比别的节点大一号、描金粗边），跳一下后轻轻起伏。 */
  bossUp(wave: number, headKey: string): void {
    const n = this.nodeOf(wave); if (!n) return;
    this.scene.tweens.killTweensOf(n.root); n.root.removeAll(true); n.seal = undefined; n.state = 'up'; n.root.setScale(1).setY(LINE_Y);
    const size = n.gate ? GATE_HEAD_UP : HEAD_UP;
    n.ring = this.scene.add.graphics().fillStyle(0x140e08, .55).fillCircle(0, 0, size / 2 + 3).lineStyle(2.6, 0xf3c76a, 1).strokeCircle(0, 0, size / 2 + 1);
    n.head = this.scene.add.image(0, 0, headKey).setDisplaySize(size, size);
    n.root.add([n.ring, n.head]);
    const s = this.scene;
    s.tweens.add({ targets: n.root, y: LINE_Y - 7, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
    s.tweens.add({ targets: n.root, scale: { from: 1.4, to: 1 }, duration: 380, ease: 'Back.easeOut', onComplete: () => { if (n.state === 'up') s.tweens.add({ targets: n.root, scale: 1.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); } });
  }
  /** 斩将：头像缩回常规大小、盖一枚缩小的朱印（盖印时从大压到小）。 */
  bossDown(wave: number): void {
    const n = this.nodeOf(wave); if (!n || n.state === 'killed') return;
    n.state = 'killed'; this.scene.tweens.killTweensOf(n.root); n.root.setScale(1).setY(LINE_Y);
    const size = n.gate ? GATE_HEAD : HEAD;
    n.head?.setDisplaySize(size, size).setAlpha(.85);
    n.ring?.clear().fillStyle(0x140e08, .5).fillCircle(0, 0, size / 2 + 2).lineStyle(1.6, 0xc9a86a, .9).strokeCircle(0, 0, size / 2 + 1);
    if (!this.scene.textures.exists(this.sealKey)) return;
    const ss = size * .8;
    n.seal = this.scene.add.image(size * .32, size * .28, this.sealKey).setDisplaySize(ss, ss).setAngle(-12).setName('gauntlet-node-seal');
    n.root.add(n.seal);
    const sx = n.seal.scaleX, sy = n.seal.scaleY;
    this.scene.tweens.add({ targets: n.seal, scaleX: { from: sx * 2.2, to: sx }, scaleY: { from: sy * 2.2, to: sy }, alpha: { from: 0, to: 1 }, duration: 240, ease: 'Quad.easeIn' });
  }
  /**
   * 每帧：pos = 进度（0～1，节点 j 在 j/阵数）；bossOn = 名将在场（标停在节点前呼吸）；caption = 线下小字。
   * 标骑在线上，走到节点前就停（不压节点上的头像）：第 j 段从上一个节点右边走到第 j 个节点左边。
   */
  update(pos: number, bossOn: boolean, caption: string): void {
    const k = Math.max(0, Math.min(1, pos)) * this.waves, j = Math.max(1, Math.ceil(k - 1e-6)), t = Math.max(0, Math.min(1, k - (j - 1)));
    const from = j === 1 ? -this.w / 2 : this.nodes[j - 2].x + this.gapOf(this.nodes[j - 2]), to = this.nodes[j - 1].x - this.gapOf(this.nodes[j - 1]);
    const x = from + (to - from) * t;
    this.marker.x = x; this.stats.pos = k / this.waves; this.stats.markerX = x;
    this.gold.clear().lineStyle(4, 0xe8b860, .98).lineBetween(-this.w / 2, LINE_Y, x, LINE_Y);
    if (!this.medal && this.scene.textures.exists(this.heroMedal)) {
      this.marker.removeAll(true);
      const ring = this.scene.add.graphics().fillStyle(0x140e08, .6).fillCircle(0, 0, MEDAL / 2 + 2).lineStyle(1.8, 0xf3d48a, 1).strokeCircle(0, 0, MEDAL / 2 + 1);
      this.medal = this.scene.add.image(0, 0, this.heroMedal).setDisplaySize(MEDAL, MEDAL).setName('gauntlet-marker-medal');
      this.marker.add([ring, this.medal]);
    }
    if (bossOn !== this.breathing) {
      this.breathing = bossOn; this.scene.tweens.killTweensOf(this.marker); this.marker.setScale(1);
      if (bossOn) this.scene.tweens.add({ targets: this.marker, scale: 1.2, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    if (caption !== this.stats.caption) { this.caption.setText(caption); this.stats.caption = caption; }
    this.stats.states = this.nodes.map(n => n.state);
  }
  setVisible(v: boolean): void { this.root.setVisible(v); }
  /** 名将登场的水墨横幅期间藏起线下小字（顶部只留横幅）。 */
  setCaptionVisible(v: boolean): void { this.caption.setVisible(v); }
  destroy(): void { this.scene.tweens.killTweensOf(this.marker); for (const n of this.nodes) this.scene.tweens.killTweensOf(n.root); this.root.destroy(); }

  /** 标停在节点前留的距离：节点半径（登场的大一号）+ 标半径 + 一点空。 */
  private gapOf(n: TrackNode): number { const r = n.state === 'up' ? (n.gate ? GATE_HEAD_UP : HEAD_UP) / 2 + 3 : n.state === 'killed' ? (n.gate ? GATE_HEAD : HEAD) / 2 + 2 : n.gate ? GATE_R : NODE_R; return r + MEDAL / 2 + 3; }
  private nodeOf(wave: number): TrackNode | undefined { return this.nodes[(wave - 1) % this.waves]; }
  /** 没到的阵：暗的空节点「？」；守关节点大一号、朱红底（同战况线的首领印）。 */
  private paintDark(n: TrackNode): void {
    this.scene.tweens.killTweensOf(n.root); n.root.removeAll(true); n.root.setScale(1).setY(LINE_Y); n.head = undefined; n.seal = undefined; n.ring = undefined; n.state = 'dark';
    const r = n.gate ? GATE_R : NODE_R, g = this.scene.add.graphics();
    g.fillStyle(n.gate ? 0x8a1a10 : 0x2a1f14, .92).fillCircle(0, 0, r).lineStyle(1.8, n.gate ? 0xf0c070 : 0xc9a86a, n.gate ? .95 : .75).strokeCircle(0, 0, r);
    const t = this.scene.add.text(0, 0, '？', { fontFamily: FONT, fontSize: n.gate ? '16px' : '14px', color: n.gate ? '#ffe2a8' : '#d8c49a', resolution: 2 }).setOrigin(.5);
    n.root.add([g, t]);
  }
}
