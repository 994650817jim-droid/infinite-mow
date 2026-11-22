import Phaser from 'phaser';
import { DEPTH, FONT, GAME_WIDTH } from '../config';

/**
 * 名将连战顶部「十阵」进度条（总制作人 11-21，用户「要做个可以动的进度条」）。
 * 画法沿用战役顶部的战况线（ui/BattleTrack）：贴着屏幕上沿的一道细墨线 + 走过的一段描金；线上 10 个节点 = 十阵：
 *  - 没到的阵：暗的空节点，写「？」（不提前剧透是谁）；第十阵（守关）大一号、朱红底；
 *  - 这一阵的名将登场：节点换成他的小头像（首领图裁出来的圆头像），轻轻跳一下；
 *  - 斩将：头像上盖一枚缩小的朱印（结局用的 seal_red_2），盖印时一压；
 * 进度标：主将的圆头像（状态框同一张 hud_medal2_<主将>），挂在线下、头顶一枚朱红菱形指着线（同战况线的菱形）；
 * 割草时按时间从上一个节点匀速走向下一个节点（走到头正好名将登场），名将在场时停在节点下、呼吸式放大；斩将后下一阵继续走。
 * 线下一行小字：第 N/10 阵 · 距名将登场 mm:ss / 名将名字；无尽时每十阵一轮，写「无尽 · 第 N 阵」。
 * 每帧只挪进度标、重画描金那段线（Graphics，成本很低）；节点只在登场 / 斩将 / 换轮时改。
 */
const LINE_Y = 16, NODE_R = 9, GATE_R = 12, HEAD = 22, GATE_HEAD = 28, MEDAL = 18;
export type TrackNodeState = 'dark' | 'up' | 'killed';
interface TrackNode { root: Phaser.GameObjects.Container; x: number; gate: boolean; state: TrackNodeState; head?: Phaser.GameObjects.Image; seal?: Phaser.GameObjects.Image }

export class GauntletTrack {
  /** 顶部细带的高度：场景按它把计时器 / 关名往下挪。 */
  static readonly HEIGHT = LINE_Y + 46;
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
    const desktop = GAME_WIDTH >= 900; this.w = desktop ? 420 : 300;
    this.root = scene.add.container(GAME_WIDTH / 2, 0).setScrollFactor(0).setDepth(DEPTH.hud + 2).setName('gauntlet-track');
    // 细墨线（下垫一道柔和暗影，压在亮地面上也看得清）：同战况线，不画底板
    const back = scene.add.graphics();
    back.lineStyle(5, 0x000000, .28).lineBetween(-this.w / 2 - 1, LINE_Y + 1, this.w / 2 + 1, LINE_Y + 1);
    back.lineStyle(2, 0x5a4630, .95).lineBetween(-this.w / 2, LINE_Y, this.w / 2, LINE_Y);
    back.fillStyle(0x5a4630, .95).fillCircle(-this.w / 2, LINE_Y, 3); // 起点
    this.gold = scene.add.graphics();
    this.root.add([back, this.gold]);
    for (let j = 1; j <= waves; j++) {
      const x = -this.w / 2 + this.w * j / waves, root = scene.add.container(x, LINE_Y).setName('gauntlet-node-' + j);
      this.root.add(root); this.nodes.push({ root, x, gate: j === waves, state: 'dark' });
    }
    // 进度标：朱红菱形（同战况线）指着线 + 下面挂主将圆头像
    this.marker = scene.add.container(-this.w / 2, LINE_Y).setName('gauntlet-marker');
    const d = scene.add.graphics(), pts = [{ x: 0, y: 5 }, { x: 4, y: 10 }, { x: 0, y: 15 }, { x: -4, y: 10 }];
    d.fillStyle(0xc0301c, 1).fillPoints(pts, true).lineStyle(1.2, 0xf3d48a, 1).strokePoints(pts, true);
    this.marker.add(d); this.root.add(this.marker);
    this.caption = scene.add.text(0, LINE_Y + 37, '', { fontFamily: FONT, fontSize: desktop ? '11px' : '10px', color: '#f0e2bc', resolution: 2, stroke: '#140e08', strokeThickness: 3 })
      .setOrigin(.5, .5).setShadow(0, 1, '#000000', 3, true, true).setName('gauntlet-track-caption');
    this.root.add(this.caption);
    this.stats.nodeX = this.nodes.map(n => n.x);
  }

  /** 进到第 wave 阵（1 起）：换轮（无尽每十阵一轮）时所有节点回到暗的。gate = 这一轮的末节点算守关（只有前十阵）。 */
  setWave(wave: number, gateRound: boolean): void {
    const c = Math.floor((wave - 1) / this.waves);
    if (c === this.cycle) return;
    this.cycle = c; this.stats.cycle = c;
    this.nodes.forEach((n, i) => { n.gate = gateRound && i === this.waves - 1; this.paintDark(n); });
  }
  /** 这一阵的名将登场：节点换成他的小头像，轻轻跳一下。 */
  bossUp(wave: number, headKey: string): void {
    const n = this.nodeOf(wave); if (!n) return;
    n.root.removeAll(true); n.seal = undefined; n.state = 'up';
    const size = n.gate ? GATE_HEAD : HEAD;
    const ring = this.scene.add.graphics().lineStyle(1.6, n.gate ? 0xf0c070 : 0xc9a86a, 1).strokeCircle(0, 0, size / 2 + 1);
    n.head = this.scene.add.image(0, 0, headKey).setDisplaySize(size, size);
    n.root.add([n.head, ring]);
    this.scene.tweens.add({ targets: n.root, y: LINE_Y - 6, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: n.root, scale: { from: 1.35, to: 1 }, duration: 380, ease: 'Back.easeOut' });
  }
  /** 斩将：头像上盖一枚缩小的朱印（盖印时从大压到小）。 */
  bossDown(wave: number): void {
    const n = this.nodeOf(wave); if (!n || n.state === 'killed') return;
    n.state = 'killed'; n.head?.setAlpha(.8);
    if (!this.scene.textures.exists(this.sealKey)) return;
    const size = (n.gate ? GATE_HEAD : HEAD) * .78;
    n.seal = this.scene.add.image(size * .32, size * .3, this.sealKey).setDisplaySize(size, size).setAngle(-12).setName('gauntlet-node-seal');
    n.root.add(n.seal);
    const sx = n.seal.scaleX, sy = n.seal.scaleY;
    this.scene.tweens.add({ targets: n.seal, scaleX: { from: sx * 2.2, to: sx }, scaleY: { from: sy * 2.2, to: sy }, alpha: { from: 0, to: 1 }, duration: 240, ease: 'Quad.easeIn' });
  }
  /**
   * 每帧：pos = 进度（0～1，节点 j 在 j/阵数）；bossOn = 名将在场（标停在节点上呼吸）；caption = 线下小字。
   */
  update(pos: number, bossOn: boolean, caption: string): void {
    const k = Math.max(0, Math.min(1, pos)), x = -this.w / 2 + this.w * k;
    this.marker.x = x; this.stats.pos = k; this.stats.markerX = x;
    this.gold.clear().lineStyle(2.5, 0xe8b860, .95).lineBetween(-this.w / 2, LINE_Y, x, LINE_Y);
    if (!this.medal && this.scene.textures.exists(this.heroMedal)) { this.medal = this.scene.add.image(0, 28, this.heroMedal).setDisplaySize(MEDAL, MEDAL); this.marker.add(this.medal); }
    if (bossOn !== this.breathing) {
      this.breathing = bossOn; this.scene.tweens.killTweensOf(this.marker); this.marker.setScale(1);
      if (bossOn) this.scene.tweens.add({ targets: this.marker, scale: 1.18, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    if (caption !== this.stats.caption) { this.caption.setText(caption); this.stats.caption = caption; }
    this.stats.states = this.nodes.map(n => n.state);
  }
  setVisible(v: boolean): void { this.root.setVisible(v); }
  destroy(): void { this.scene.tweens.killTweensOf(this.marker); this.root.destroy(); }

  private nodeOf(wave: number): TrackNode | undefined { return this.nodes[(wave - 1) % this.waves]; }
  /** 没到的阵：暗的空节点「？」；守关节点大一号、朱红底（同战况线的首领印）。 */
  private paintDark(n: TrackNode): void {
    this.scene.tweens.killTweensOf(n.root); n.root.removeAll(true); n.root.setScale(1).setY(LINE_Y); n.head = undefined; n.seal = undefined; n.state = 'dark';
    const r = n.gate ? GATE_R : NODE_R, g = this.scene.add.graphics();
    g.fillStyle(n.gate ? 0x8a1a10 : 0x2a1f14, n.gate ? .9 : .85).fillCircle(0, 0, r).lineStyle(1.5, n.gate ? 0xf0c070 : 0xc9a86a, n.gate ? .95 : .6).strokeCircle(0, 0, r);
    const t = this.scene.add.text(0, 0, '？', { fontFamily: FONT, fontSize: n.gate ? '13px' : '10px', color: n.gate ? '#ffe2a8' : '#a8957a', resolution: 2 }).setOrigin(.5);
    n.root.add([g, t]);
  }
}
