import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, TITLE_FONT } from '../config';
import type { Enemy } from '../entities/Enemy';
import { figureTop } from './SpriteMetrics';
import { outlineKeyOf } from './IffOverlay';
import { BOSS_SCALE, ELITE_SCALE, PRESENCE_ON } from '../data/bossReach';

/**
 * 首领存在感（用户 2026-11-17「boss出来后不要明显，感觉需要把boss做大一点或者明显一点，把小兵区分开来」）。
 *  1. 体型：首领显示 ×1.4、精锐 ×1.15（身体判定半径同倍，见 Enemy.spawn；招式范围与预警不变，判定不变）。
 *     只在渲染那一刻以脚底为原点放大精灵 / 影子 / 坐骑 / 描边，画完立刻还原——各首领控制器、招式、逻辑读到的仍是原尺寸，
 *     所以 BossKit / ThirdBoss / BossMoveset / 专属控制器、骑乘图都不用改，也不会被累乘。
 *  2. 与小兵区分：脚下手绘火环（吕布警示环的环形帧，压扁、低透明度慢慢轮转）、身上金红光晕（显卡辉光滤镜 preFX glow，不生成描边贴图、不受「敌我描边」设置影响）、头顶印章 + 名字。
 *  3. 登场：画面暗一下（约 1 秒）、镜头朝首领方向探出去再回来（约 1.6 秒），配合原有名号墨条与换曲；不暂停、不挡操作。
 *  4. 首领在屏外：屏幕边缘出现指向首领的红金箭头。
 * ?presence=0 关闭本文件的全部效果（对比 / 回退用）。
 */
export { PRESENCE_ON, BOSS_SCALE, ELITE_SCALE } from '../data/bossReach';
/** 体型倍数（判定半径也按这个放大）。 */
export function presenceScale(kind: string): number { return !PRESENCE_ON ? 1 : kind === 'boss' ? BOSS_SCALE : kind === 'elite' ? ELITE_SCALE : 1; }

const RING_KEY = 'warnfx_lubu', RING_FRAMES = [6, 7, 8, 9, 10, 11];
/** 双首领关（DualBoss）：每位首领一份名牌 / 辉光 / 火环 / 屏外箭头；color 区分左右（左金、右朱）。 */
export interface PresenceBoss { e: Enemy; name: string; color?: 'gold' | 'red' }
interface Host {
  scene: Phaser.Scene;
  enemies: () => Iterable<Enemy>;
  boss: () => Enemy | null;
  bossName: () => string;
  /** 多首领（双首领关）：返回列表时取代 boss / bossName。 */
  bosses?: () => PresenceBoss[] | null;
  /** 首领身上叠的额外图（坐骑），随首领一起放大。 */
  extras: (e: Enemy) => Array<Phaser.GameObjects.Image | null | undefined>;
  /** 身后的描边图（开了「敌我描边」时，IffOverlay）：渲染前先对齐到精灵本帧的姿势，再一起放大。 */
  outline: (e: Enemy) => Phaser.GameObjects.Image | null | undefined;
  /** 主将位置（屏外箭头从这里朝首领指）。 */
  player: () => { x: number; y: number };
}
type Saved = { o: Phaser.GameObjects.Image; x: number; y: number; sx: number; sy: number };
/** 每位首领一份：火环、名牌（高度跟随：上升立即跟、下降慢慢收）、辉光（敌兵精灵是对象池复用的：倒下 / 换人时必须摘掉）。 */
interface Slot { e: Enemy | null; ring: Phaser.GameObjects.Image | null; plate: Phaser.GameObjects.Container | null; plateFor: string; plateRise: number; plateBelow: boolean; glow: { sp: Phaser.GameObjects.Sprite; fx: Phaser.FX.Glow } | null }
const ARROW = { red: [0xc8321e, 0xf2c27a], gold: [0xd8a23a, 0xfff0c0] } as const;
const PLATE_LINE = { red: 0xc9a35e, gold: 0xe8c060 } as const;

export class BossPresence {
  private saved: Saved[] = [];
  private slots: Slot[] = [];
  private arrow: Phaser.GameObjects.Graphics;
  private dim: Phaser.GameObjects.Rectangle | null = null;
  /** 镜头偏移（登场时朝首领探出去），GameScene.updateCamera 叠加。 */
  readonly look = { x: 0, y: 0 };
  private entranceAt = -1; private entranceDir = { x: 0, y: 0 }; private dimMul = 1;
  /** 测试用（ring / plate / arrow / glow：任一位首领有；plates / arrows / glows / rings：数量）。 */
  readonly stats = { scaled: 0, ring: false, plate: false, arrow: false, entrance: false, glow: false, plateGap: 0, plateBelow: false, plates: 0, arrows: 0, glows: 0, rings: 0, arrowColors: [] as string[] };
  /** 测试用：关掉身上辉光（同一页面里对比帧率）。 */
  glowOff = false;

  constructor(private h: Host) {
    const s = h.scene;
    this.arrow = s.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud - 6).setName('boss-offscreen-arrow');
    s.events.on(Phaser.Scenes.Events.POST_UPDATE, this.update, this);
    s.events.on(Phaser.Scenes.Events.PRE_RENDER, this.grow, this);
    s.events.on(Phaser.Scenes.Events.RENDER, this.restore, this);
    s.events.once('shutdown', () => this.destroy());
  }

  /** 首领登场：画面暗一下、镜头朝首领探出去再回来（真实时钟，约 1.6 秒，不暂停）。dim：暗场强度倍数（双首领第二位减半）。 */
  entrance(boss: Enemy, dim = 1): void {
    if (!PRESENCE_ON) return;
    const s = this.h.scene, p = this.h.player(), dx = boss.x - p.x, dy = boss.y - p.y, d = Math.hypot(dx, dy) || 1;
    // 镜头最多探出半屏的 35%：主将始终留在画面里
    const reach = Math.min(d * .6, Math.min(GAME_WIDTH, GAME_HEIGHT) * .35);
    this.entranceDir = { x: dx / d * reach, y: dy / d * reach }; this.entranceAt = performance.now(); this.stats.entrance = true; this.dimMul = dim;
    this.dim?.destroy();
    this.dim = s.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH + 40, GAME_HEIGHT + 40, 0x050302, 0).setScrollFactor(0).setDepth(DEPTH.overlay - 9).setName('boss-entrance-dim');
  }
  /** 本帧要显示的首领（单首领：boss + bossName）。 */
  private list(): PresenceBoss[] {
    const many = this.h.bosses?.(); if (many) return many;
    const b = this.h.boss(); return b ? [{ e: b, name: this.h.bossName() }] : [];
  }

  private update(): void {
    const s = this.h.scene, list = PRESENCE_ON ? this.list().filter(b => b.e.active) : [];
    // 登场：暗场 0→.3（0.2 秒）保持到 0.7 秒，1.1 秒淡完；镜头 0.5 秒探出、停 0.5 秒、0.6 秒收回
    if (this.entranceAt >= 0) {
      const t = performance.now() - this.entranceAt;
      if (this.dim) { const a = t < 200 ? t / 200 : t < 700 ? 1 : Math.max(0, 1 - (t - 700) / 400); this.dim.setFillStyle(0x050302, .3 * a * this.dimMul); if (t >= 1100) { this.dim.destroy(); this.dim = null; } }
      const e = (x: number): number => x * x * (3 - 2 * x), k = t < 500 ? e(t / 500) : t < 1000 ? 1 : t < 1600 ? 1 - e((t - 1000) / 600) : 0;
      this.look.x = this.entranceDir.x * k; this.look.y = this.entranceDir.y * k;
      if (t >= 1600) { this.entranceAt = -1; this.look.x = this.look.y = 0; }
    }
    // 槽位按首领对齐（换人 / 倒下的槽清掉）
    while (this.slots.length < list.length) this.slots.push({ e: null, ring: null, plate: null, plateFor: '', plateRise: 0, plateBelow: false, glow: null });
    this.slots.forEach((sl, i) => {
      const b = list[i];
      if (!b || sl.e !== b.e) { this.dropGlow(sl); sl.e = b?.e ?? null; sl.plateRise = 0; }
      if (!b) { sl.ring?.setVisible(false); sl.plate?.setVisible(false); }
    });
    this.arrow.clear(); this.stats.arrowColors = [];
    let plates = 0, arrows = 0, glows = 0, rings = 0;
    list.forEach((b, i) => {
      const sl = this.slots[i], boss = b.e, live = boss.sprite.visible;
      // 身上辉光：金红、缓慢呼吸
      if (this.glowOff) this.dropGlow(sl);
      if (!sl.glow && !this.glowOff && s.game.renderer.type === Phaser.WEBGL) {
        const sp = boss.sprite as Phaser.GameObjects.Sprite, pre = (sp as unknown as { preFX?: Phaser.GameObjects.Components.FX }).preFX;
        if (pre) { pre.setPadding(10); sl.glow = { sp, fx: pre.addGlow(b.color === 'gold' ? 0xffd070 : 0xffb347, 2, 0, false, .1, 10) }; }
      }
      if (sl.glow) { sl.glow.fx.outerStrength = 1.6 + .9 * Math.sin(s.time.now / 380 + i * 1.3); glows++; }
      // 脚下火环
      if (live && s.textures.exists(RING_KEY)) {
        const r = sl.ring ?? (sl.ring = s.add.image(0, 0, RING_KEY, RING_FRAMES[0]).setName('boss-presence-ring'));
        const now = s.time.now, w = boss.radius * 3.4, f = RING_FRAMES[(Math.floor(now / 140) + i * 3) % RING_FRAMES.length];
        if (r.frame.name !== String(f)) r.setFrame(f);
        // 精灵锚点就是图里的脚底（行走图按 groundY 定原点；骑乘图锚在马蹄），影子在它下方约 0.7 个半径，不能拿来对位
        r.setVisible(true).setPosition(boss.sprite.x, boss.sprite.y + 4).setDisplaySize(w, w * .42).setDepth(DEPTH.ground + 6).setAlpha(.32 + .1 * Math.sin(now / 420));
        rings++;
      } else sl.ring?.setVisible(false);
      // 头顶名牌（位置在放大之后定，见 grow）
      if (live) {
        const key = b.name + '|' + (b.color ?? '');
        if (!sl.plate || sl.plateFor !== key) { sl.plate?.destroy(); sl.plate = this.makePlate(b.name, b.color); sl.plateFor = key; }
        sl.plate.setVisible(true); plates++;
      } else sl.plate?.setVisible(false);
      // 屏外箭头（双首领：左金右朱）
      const v = s.cameras.main.worldView, m = 30;
      if (boss.x < v.x - m || boss.x > v.right + m || boss.y < v.y - m || boss.y > v.bottom + m) {
        const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2, p = this.h.player(), a = Math.atan2(boss.y - p.y, boss.x - p.x);
        const ex = GAME_WIDTH / 2 - 34, ey = GAME_HEIGHT / 2 - 34, c = Math.cos(a), sn = Math.sin(a), t = Math.min(ex / Math.max(1e-3, Math.abs(c)), ey / Math.max(1e-3, Math.abs(sn)));
        const x = cx + c * t, y = cy + sn * t, pulse = 1 + .08 * Math.sin(s.time.now / 160), col = ARROW[b.color ?? 'red'];
        const pt = (fx: number, fy: number): [number, number] => [x + (c * fx - sn * fy) * pulse, y + (sn * fx + c * fy) * pulse];
        this.arrow.fillStyle(0x1a0c08, .85).fillTriangle(...pt(21, 0), ...pt(-13, -16), ...pt(-13, 16))
          .fillStyle(col[0], 1).fillTriangle(...pt(16, 0), ...pt(-9, -12), ...pt(-9, 12))
          .fillStyle(col[1], 1).fillTriangle(...pt(16, 0), ...pt(2, -4), ...pt(2, 4));
        arrows++; this.stats.arrowColors.push(b.color ?? 'red');
      }
    });
    Object.assign(this.stats, { plates, arrows, glows, rings, glow: glows > 0, ring: rings > 0, plate: plates > 0, arrow: arrows > 0 });
  }

  private makePlate(name: string, color?: 'gold' | 'red'): Phaser.GameObjects.Container {
    // 低调名牌（2026-11-18 用户「标注会挡住 boss，梁字很显眼」）：小号书法字、米色、细描边，
    // 底下一条半透明墨色小底条和一道极淡的金色细线；容器原点在名牌底边中央（往上长），方便贴着头顶放
    const s = this.h.scene;
    const nameT = s.add.text(0, -8.5, name, { fontFamily: TITLE_FONT, fontSize: '13px', color: color === 'gold' ? '#f2d78a' : color === 'red' ? '#f0b8a0' : '#ecdcb4', stroke: '#150e08', strokeThickness: 2, resolution: 2 }).setOrigin(.5).setLetterSpacing(2);
    const w = Math.round(nameT.width) + 16;
    const bar = s.add.rectangle(0, -8.5, w, 17, 0x120c08, .3);
    const line = s.add.rectangle(0, -.5, w, 1, PLATE_LINE[color ?? 'red'], color ? .7 : .3);
    // 深度压在伤害数字下面（不挡数字），也在「主将」标记之下
    return s.add.container(0, 0, [bar, line, nameT]).setDepth(DEPTH.dmgText - 1).setAlpha(.92).setName('boss-name-plate');
  }

  /** 渲染前：首领 / 精锐以脚底为原点放大（连同影子、坐骑、描边），摆好头顶名牌。 */
  private grow(): void {
    this.saved.length = 0; this.stats.scaled = 0;
    if (!PRESENCE_ON) return;
    const list = PRESENCE_ON ? this.list() : [];
    for (const e of this.h.enemies()) {
      if (!e.active || e.isSupplySlot) continue;
      const k = presenceScale(e.kind); if (k === 1 || !e.sprite.visible) continue;
      // 以精灵锚点（脚底）为原点放大：脚站在原地，身体往上长；影子原地放大（它本来就在脚下偏一点的位置）
      const sp = e.sprite, px = sp.x, py = sp.y;
      // 「敌我描边」开着时：描边层在 postupdate 里跟随，招式姿态（BossKit 等）可能在它之后才改精灵，这里按本帧最终姿势对齐再一起放大；
      // 换成了还没生成描边的招式图集就先隐藏（不在这里同步生成——整张图集生成描边会卡几百毫秒）
      const outline = this.h.outline(e);
      if (outline) {
        if (outline.texture.key !== outlineKeyOf(sp.texture.key) || !outline.texture.has(String(sp.frame.name))) outline.setVisible(false);
        else { if (outline.frame.name !== sp.frame.name) outline.setFrame(sp.frame.name); outline.setPosition(sp.x, sp.y).setScale(sp.scaleX, sp.scaleY).setOrigin(sp.originX, sp.originY).setFlip(sp.flipX, sp.flipY).setRotation(sp.rotation); }
      }
      this.saved.push({ o: e.shadow, x: e.shadow.x, y: e.shadow.y, sx: e.shadow.scaleX, sy: e.shadow.scaleY }); e.shadow.setScale(e.shadow.scaleX * k, e.shadow.scaleY * k);
      for (const o of [sp, outline?.visible ? outline : null, ...this.h.extras(e)]) {
        if (!o || !o.active) continue;
        this.saved.push({ o, x: o.x, y: o.y, sx: o.scaleX, sy: o.scaleY });
        o.setPosition(px + (o.x - px) * k, py + (o.y - py) * k).setScale(o.scaleX * k, o.scaleY * k);
      }
      this.stats.scaled++;
      const si = list.findIndex(b => b.e === e), sl = si >= 0 ? this.slots[si] : undefined;
      if (sl?.plate?.visible) this.placePlate(sl, px, py, [sp, ...this.h.extras(e)]);
    }
  }
  /** 名牌贴着身体最高点（骑马首领含马头 / 帽缨）上方留白；首领靠近屏幕顶边（会撞上血条 HUD）时改放脚下。 */
  private placePlate(sl: Slot, px: number, py: number, parts: Array<Phaser.GameObjects.Image | null | undefined>): void {
    let top = py;
    for (const o of parts) {
      if (!o || !o.active || !o.visible || o.alpha < .05) continue;
      const sy = Math.abs(o.scaleY), ft = figureTop(this.h.scene, o.texture.key, o.frame.name);
      const t = ft !== undefined ? o.y - o.originY * o.frame.cutHeight * sy + ft * sy : o.y - o.displayHeight * o.originY * .85;
      if (t < top) top = t;
    }
    const rise = py - top;
    // 上升立即跟上（不遮头），下降慢慢收（不抖）
    sl.plateRise = rise > sl.plateRise ? rise : sl.plateRise + (rise - sl.plateRise) * .15;
    const view = this.h.scene.cameras.main.worldView, gap = 10, plateH = 17;
    let y = py - sl.plateRise - gap;
    // 距屏幕顶边不足（顶部计时 / 章节名 / 武将卡占约 50 设计像素）→ 放到脚下；用迟滞避免在边界来回跳
    const need = view.y + 50 + plateH;
    sl.plateBelow = sl.plateBelow ? y < need + 16 : y < need;
    if (sl.plateBelow) y = py + 16 + plateH;
    sl.plate!.setPosition(Math.round(px), Math.round(y));
    if (sl === this.slots[0]) { this.stats.plateGap = Math.round(top - y); this.stats.plateBelow = sl.plateBelow; } // 名牌底边到身体最高点的距离（放脚下时为负）
  }
  private dropGlow(sl: Slot): void {
    if (!sl.glow) return;
    const pre = (sl.glow.sp as unknown as { preFX?: Phaser.GameObjects.Components.FX }).preFX;
    try { pre?.remove(sl.glow.fx); pre?.setPadding(0); } catch { /* 精灵已销毁 */ }
    sl.glow = null;
  }
  private restore(): void { for (const v of this.saved) if (v.o.active) v.o.setPosition(v.x, v.y).setScale(v.sx, v.sy); this.saved.length = 0; }

  destroy(): void {
    const s = this.h.scene;
    s.events.off(Phaser.Scenes.Events.POST_UPDATE, this.update, this);
    s.events.off(Phaser.Scenes.Events.PRE_RENDER, this.grow, this);
    s.events.off(Phaser.Scenes.Events.RENDER, this.restore, this);
    for (const sl of this.slots) { this.dropGlow(sl); sl.ring?.destroy(); sl.plate?.destroy(); }
    this.slots = []; this.arrow.destroy(); this.dim?.destroy(); this.dim = null;
  }
}
