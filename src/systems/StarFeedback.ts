import Phaser from 'phaser';
import { DEPTH, actorDepth } from '../config';
import { STAR_FX, STAR_FX_FOOT, type StarFxDef, type StarFxId } from '../data/starFx';
import { STAR_BY_ID, STAR_NEAR_RADIUS } from '../data/starMap';
import type { Player } from '../entities/Player';
import { StarBuffHud, type StarBuffEntry } from '../ui/StarBuffHud';

/**
 * 星图 · 战斗内反馈（第四期）。只在开关 starMapOn() 打开时由 GameScene.updateHud 创建和刷新。两部分：
 * - hud：增益栏下面的「星图」图标排（ui/StarBuffHud）；
 * - fx：手绘特效的挂点（StarFx）。表在 data/starFx.ts STAR_FX（8 项，都是美术的手绘序列帧，没有程序画的图形）；
 *   只在对应的星点亮后才加载贴图，开关关着时这个类根本不会被创建，一张都不加载。
 * 触发信号来自 RunGrowth.pulse()（破阵 / 连珠 / 游刃 / 火烧连营），状态来自 RunGrowth.starActive()。
 */
const KIND_NAME = { notable: '要星', keystone: '主星' } as const;
const IDS = Object.keys(STAR_FX) as StarFxId[];
const ONCE_BY_STAR = new Map<string, StarFxId>(IDS.filter(id => STAR_FX[id].mode === 'once').map(id => [STAR_FX[id].star, id]));
const LOOPS = IDS.filter(id => STAR_FX[id].mode === 'loop'), ONCES = IDS.filter(id => STAR_FX[id].mode === 'once');
const MAX_ONCE = 12, BREATHE_MS = 3000;
/** 贴地层：在所有单位（actorDepth ≥ DEPTH.enemy + 0.1）之下。 */
const GROUND = DEPTH.enemy + .05;
const depthOf = (d: StarFxDef, bodyY: number): number => (d.layer === 'ground' ? GROUND : actorDepth(bodyY) + (d.layer === 'over' ? .6 : -.03));

/** 手绘特效挂点：只播 data/starFx.ts 里 ready 且贴图已载入的项，其余静默跳过。 */
export class StarFx {
  private readonly loops = new Map<StarFxId, Phaser.GameObjects.Image>();
  private readonly requested = new Set<string>();
  private playing = 0;
  constructor(private readonly scene: Phaser.Scene) {}
  /** 这一项现在能不能播（表里 ready、贴图已在）；ready 但还没载入的顺手排进加载队列。 */
  has(id: StarFxId): boolean {
    const d: StarFxDef = STAR_FX[id]; if (!d.ready) return false;
    if (this.scene.textures.exists(d.key)) return true;
    if (!this.requested.has(d.key)) { this.requested.add(d.key); this.scene.load.spritesheet(d.key, d.url, { frameWidth: d.frameW, frameHeight: d.frameH }); this.scene.load.start(); }
    return false;
  }
  /** 在 (x, y) 播一遍；flip = 水平翻转。 */
  once(id: StarFxId, x: number, y: number, flip = false): boolean {
    if (this.playing >= MAX_ONCE || !this.has(id)) return false;
    const d: StarFxDef = STAR_FX[id], img = this.scene.add.image(x, y, d.key, 0).setOrigin(d.anchor.x, d.anchor.y).setScale(d.scale).setAlpha(d.alpha).setFlipX(flip).setDepth(depthOf(d, y)).setName('star-fx-' + id);
    this.playing++;
    this.scene.tweens.addCounter({ from: 0, to: d.frames - .01, duration: d.frames / d.fps * 1000, onUpdate: t => { if (img.active) img.setFrame(Math.floor(t.getValue() ?? 0)); }, onComplete: () => { this.playing--; img.destroy(); } });
    return true;
  }
  /** 循环 / 常驻类：on(id) 成立就跟着主将显示，不成立就收掉。lit(star) 用来提前把一次性特效的贴图载好（第一下触发就能播）。 */
  update(player: Player, now: number, on: (id: StarFxId) => boolean, lit: (star: string) => boolean): void {
    for (const id of ONCES) if (lit(STAR_FX[id].star)) this.has(id);
    for (const id of LOOPS) {
      const d: StarFxDef = STAR_FX[id]; let img = this.loops.get(id);
      if (!on(id) || !this.has(id)) { if (img) { img.destroy(); this.loops.delete(id); } continue; }
      if (!img || !img.scene) { img = this.scene.add.image(player.x, player.y, d.key, 0).setOrigin(d.anchor.x, d.anchor.y).setScale(d.scale).setName('star-fx-' + id); this.loops.set(id, img); }
      img.setPosition(player.x + (d.offset?.x ?? 0), player.y + STAR_FX_FOOT + (d.offset?.y ?? 0)).setDepth(depthOf(d, player.y))
        .setAlpha(d.alpha + (d.breathe ? d.breathe * Math.sin(now / BREATHE_MS * Math.PI * 2) : 0));
      if (d.frames > 1) img.setFrame(Math.floor(now / 1000 * d.fps) % d.frames);
    }
  }
  clear(): void { for (const img of this.loops.values()) img.destroy(); this.loops.clear(); }
}

export class StarFeedback {
  readonly hud: StarBuffHud; readonly fx: StarFx;
  private nearAt = -1e9; private near = false;
  constructor(scene: Phaser.Scene) { this.hud = new StarBuffHud(scene); this.fx = new StarFx(scene); }
  get alive(): boolean { return this.hud.alive; }
  hide(): void { if (this.hud.alive) this.hud.update([], 0, false, 0); this.fx.clear(); }
  /** below = 增益栏（接在它下面排）；units = 军团部曲（判断「主将身边有没有部曲」，每 0.2 秒看一次）。 */
  update(player: Player, now: number, visible: boolean, below: { root: { y: number; visible: boolean }; rowsShown: number }, units: ReadonlyArray<{ active: boolean; x: number; y: number }>): void {
    const g = player.growth, lit = (star: string): boolean => g.stars.includes(star);
    if (now - this.nearAt >= 200 || now < this.nearAt) {
      this.nearAt = now; const r2 = STAR_NEAR_RADIUS * STAR_NEAR_RADIUS; this.near = false;
      if (lit('command.NR2') || lit('bridge3.h')) for (const u of units) if (u.active && (u.x - player.x) ** 2 + (u.y - player.y) ** 2 <= r2) { this.near = true; break; }
    }
    const entries: StarBuffEntry[] = [];
    for (const id of g.stars) { const n = STAR_BY_ID.get(id); if (n && (n.kind === 'notable' || n.kind === 'keystone')) entries.push({ id, name: n.name, desc: n.desc, kind: KIND_NAME[n.kind], active: g.starActive(id, now, this.near) }); }
    // 增益栏没东西时整栏隐藏：图标排顶到它的位置；有东西时接在最后一行下面
    this.hud.update(entries, now, visible, below.root.y + (below.root.visible ? 24 + below.rowsShown * 42 + 4 : 0));
  }
  /**
   * 每帧调（GameScene.update；上面的 update 跟着 HUD 每 0.1 秒才跑一次）：取走触发信号——图标亮一下、在触发点播一次性特效；
   * 跟随主将的特效逐帧对位；图标的放大回落逐帧推进。
   */
  tick(player: Player, now: number): void {
    const g = player.growth, lit = (star: string): boolean => g.stars.includes(star);
    const faceLeft = !!(player as unknown as { faceLeft?: boolean }).faceLeft;
    for (const p of g.takePulses()) {
      this.hud.flash(p.id);
      const once = ONCE_BY_STAR.get(p.id); if (!once) continue;
      const d: StarFxDef = STAR_FX[once], flip = !!d.flipWithFacing && faceLeft, ox = (d.offset?.x ?? 0) * (flip ? -1 : 1), oy = d.offset?.y ?? 0;
      if (d.at === 'side') this.fx.once(once, player.x + ox, player.y + oy, flip); else this.fx.once(once, (p.x ?? player.x) + ox, (p.y ?? player.y) + oy, flip);
    }
    this.hud.tick(now);
    this.fx.update(player, now, id => { const d: StarFxDef = STAR_FX[id]; return d.when === 'state' ? g.starActive(d.star, now, this.near) === true : lit(d.star) || (!!d.alsoStar && lit(d.alsoStar)); }, lit);
  }
}
