import Phaser from 'phaser';
import { actorDepth } from '../config';
import { STAR_FX, type StarFxDef, type StarFxId } from '../data/starFx';
import { STAR_BY_ID, STAR_NEAR_RADIUS } from '../data/starMap';
import type { Player } from '../entities/Player';
import { StarBuffHud, type StarBuffEntry } from '../ui/StarBuffHud';

/**
 * 星图 · 战斗内反馈（第四期）。只在开关 starMapOn() 打开时由 GameScene.updateHud 创建和刷新。两部分：
 * - hud：增益栏下面的「星图」图标排（ui/StarBuffHud）；
 * - fx：手绘特效的挂点（StarFx）。表在 data/starFx.ts STAR_FX，**现在 8 项都还没有图（ready = false），所以什么都不加载、不显示，也不画程序图形**；
 *   美术把序列帧放进 public/assets/star-map/fx/ 并把表里对应项填好、ready 改 true 后自动生效。
 * 触发信号来自 RunGrowth.pulse()（破阵 / 连珠 / 游刃 / 火烧连营），状态来自 RunGrowth.starActive()。
 */
const KIND_NAME = { notable: '要星', keystone: '主星' } as const;
const ONCE_BY_STAR = new Map<string, StarFxId>((Object.keys(STAR_FX) as StarFxId[]).filter(id => STAR_FX[id].mode === 'once').map(id => [STAR_FX[id].star, id]));
const LOOPS = (Object.keys(STAR_FX) as StarFxId[]).filter(id => STAR_FX[id].mode === 'loop');
const MAX_ONCE = 12;

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
  /** 在 (x, y) 播一遍。 */
  once(id: StarFxId, x: number, y: number): boolean {
    if (this.playing >= MAX_ONCE || !this.has(id)) return false;
    const d: StarFxDef = STAR_FX[id], img = this.scene.add.image(x, y, d.key, 0).setOrigin(d.anchor.x, d.anchor.y).setScale(d.scale).setDepth(actorDepth(y) + .6).setName('star-fx-' + id);
    this.playing++;
    this.scene.tweens.addCounter({ from: 0, to: d.frames - .01, duration: d.frames / d.fps * 1000, onUpdate: t => { if (img.active) img.setFrame(Math.floor(t.getValue() ?? 0)); }, onComplete: () => { this.playing--; img.destroy(); } });
    return true;
  }
  /** 循环类：on(id) 成立就跟着主将播，不成立就收掉。 */
  update(player: Player, now: number, on: (id: StarFxId) => boolean): void {
    for (const id of LOOPS) {
      const d: StarFxDef = STAR_FX[id]; let img = this.loops.get(id);
      if (!on(id) || !this.has(id)) { if (img) { img.destroy(); this.loops.delete(id); } continue; }
      if (!img || !img.scene) { img = this.scene.add.image(player.x, player.y, d.key, 0).setOrigin(d.anchor.x, d.anchor.y).setName('star-fx-' + id); this.loops.set(id, img); }
      img.setPosition(player.x, player.y).setFrame(Math.floor(now / 1000 * d.fps) % d.frames).setDepth(actorDepth(player.y) + (d.attach === 'hero' ? .6 : -.5));
      if (d.attach === 'ring') img.setDisplaySize(STAR_NEAR_RADIUS * 2 * d.scale, STAR_NEAR_RADIUS * 2 * d.scale); else img.setScale(d.scale);
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
    const g = player.growth;
    if (now - this.nearAt >= 200 || now < this.nearAt) {
      this.nearAt = now; const r2 = STAR_NEAR_RADIUS * STAR_NEAR_RADIUS; this.near = false;
      if (g.stars.includes('command.NR2') || g.stars.includes('bridge3.h')) for (const u of units) if (u.active && (u.x - player.x) ** 2 + (u.y - player.y) ** 2 <= r2) { this.near = true; break; }
    }
    const entries: StarBuffEntry[] = [];
    for (const id of g.stars) { const n = STAR_BY_ID.get(id); if (n && (n.kind === 'notable' || n.kind === 'keystone')) entries.push({ id, name: n.name, desc: n.desc, kind: KIND_NAME[n.kind], active: g.starActive(id, now, this.near) }); }
    // 增益栏没东西时整栏隐藏：图标排顶到它的位置；有东西时接在最后一行下面
    this.hud.update(entries, now, visible, below.root.y + (below.root.visible ? 24 + below.rowsShown * 42 + 4 : 0));
    for (const p of g.takePulses()) {
      this.hud.flash(p.id);
      const once = ONCE_BY_STAR.get(p.id); if (once) { const d: StarFxDef = STAR_FX[once]; this.fx.once(once, p.x ?? player.x + (d.attach === 'side' ? 26 : 0), p.y ?? player.y - (d.attach === 'side' ? 18 : 0)); }
    }
    this.fx.update(player, now, id => { const d: StarFxDef = STAR_FX[id]; const a = g.starActive(d.star, now, this.near), b = d.alsoStar ? g.starActive(d.alsoStar, now, this.near) : null; return a === true || b === true || (a === null && b === null && g.stars.includes(d.star) && (d.star.endsWith('.K'))); });
  }
}
