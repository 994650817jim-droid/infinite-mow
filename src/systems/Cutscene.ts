import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, actorDepth } from '../config';
import { SKILL_FX } from './SkillFxSheets';
import { HORSE_V2, RIDE } from './HeroMount';
import { ART_V2_FILES, regridV2 } from './ArtStyle';
import { RIDE_SEAT } from './BossMount';
import type { ActorSpec, CutStep, CutsceneScript, Dir, Ease, Pos, Pose } from '../data/cutscenes/types';

/**
 * 过场动画播放器（用户 2026-11-17 同意「引擎内用现有美术做剧情动画」）：按脚本（src/data/cutscenes/）逐步演出。
 *  - 播放时战斗暂停（调用方切到 story 模式：计时器 / 补间冻结）、HUD 藏起、上下黑边；过场自己的时钟走真实时间，慢动作 / 顿帧只作用于过场时钟。
 *  - 镜头归过场管（GameScene.updateCamera 在过场中不跟主将）。
 *  - 可跳过（Esc / 右下「跳过」）：直接到结束状态（linger 里的演员摆成最终姿势），然后同样回调 onDone，调用方结算。
 *  - 剧情设置「完整 / 只看章头章末 / 关闭」：level = key 的过场在「只看章头章末」也播，关闭时不播（cutsceneAllowed）。
 * 特效只用手绘序列帧（SKILL_FX）；没有图就不画替代图形。
 */

/** 剧情设置：与故事系统（BattleSettings.storyMode，claude/story-batch1）读同一个键 im_story，值 full / chapter（只看章头章末）/ off，默认 full。?story= 可临时覆盖。 */
export const STORY_MODE_KEY = 'im_story';
export type StoryMode = 'full' | 'chapter' | 'off';
export function storyMode(): StoryMode {
  try { const q = new URLSearchParams(location.search).get('story'); if (q === 'full' || q === 'chapter' || q === 'off') return q; const v = localStorage.getItem(STORY_MODE_KEY); if (v === 'chapter' || v === 'off') return v; } catch { /* 无存储 */ }
  return 'full';
}
export function cutsceneAllowed(script: CutsceneScript): boolean { const m = storyMode(); return m === 'full' || (m === 'chapter' && script.level === 'key'); }

export interface CutHost {
  scene: Phaser.Scene;
  /** 锚点：名字 → 世界坐标对象（精灵本身也行，取它的 x / y）。 */
  anchors: Record<string, { x: number; y: number } | undefined>;
  /** 主将与随行武将 id（条件 hero 用）。 */
  heroes: () => string[];
  sfx: (k: string) => void;
  music?: (duck: number) => void;
}

type Img = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
interface Actor {
  id: string; x: number; y: number; dir: Dir; pose: Pose; poseAt: number; fps: number;
  spec?: ActorSpec; main?: Img; horse?: Img; fall?: Img; fallKey?: string; bound?: Img; scaleH?: number;
}
interface Task { update(cdt: number, rdt: number): boolean; end?(): void }

const DIRS: Dir[] = ['down', 'left', 'right', 'up'];
/** 骑者跨坐（与战斗里首领骑马同一组值，见 BossMount.RIDE_SEAT）。 */
const HORSE_KEY: Record<string, string> = { chitu: 'horse_v2_chitu_walk', wuzhui: 'horse_v2_wuzhui_walk', jueying: 'horse_v2_jueying_walk', dawan: 'horse_v2_dawan_walk', generic: 'horse_v2_generic_walk' };
const ease = (e: Ease | undefined, k: number): number => e === 'linear' ? k : e === 'quad' ? k * k : e === 'out' ? 1 - (1 - k) * (1 - k) : .5 - Math.cos(Math.PI * k) / 2;

/** 过场需要的图（骑乘图、名马、特效）提前载入；载完回调（已有就马上回调）。 */
export function preloadCutscene(scene: Phaser.Scene, script: CutsceneScript, done: () => void): void {
  const L = scene.load, T = scene.textures; let n = 0;
  const rides = script.steps.filter((x): x is Extract<CutStep, { t: 'actor' }> => x.t === 'actor').map(x => x.spec).filter((x): x is Extract<ActorSpec, { kind: 'ride' }> => x.kind === 'ride');
  const regrid = (): void => { for (const r of rides) { const hk = HORSE_KEY[r.horse]; if (T.exists(hk) && !T.get(hk).has('down_0')) regridV2(scene, hk); } };
  for (const r of rides) {
    const rk = 'ride_v2_boss_' + r.rider, hk = HORSE_KEY[r.horse];
    if (!T.exists(rk)) { L.spritesheet(rk, `assets/ride-v2/boss_${r.rider}_ride.png`, { frameWidth: RIDE.cell, frameHeight: RIDE.cell }); n++; }
    if (!T.exists(hk) && ART_V2_FILES[hk]) { L.image(hk, ART_V2_FILES[hk]); n++; }
  }
  for (const x of script.steps) if (x.t === 'fx' && SKILL_FX[x.key] && !T.exists(x.key)) { const d = SKILL_FX[x.key]; L.spritesheet(x.key, d.file, { frameWidth: d.cell, frameHeight: d.cell }); n++; }
  if (!n) { regrid(); done(); return; }
  L.once(Phaser.Loader.Events.COMPLETE, () => { regrid(); done(); });
  if (!L.isLoading()) L.start();
}

export class Cutscene {
  active = true; skipped = false;
  /** 测试用：执行过的步骤（序号）、说过的台词。 */
  readonly log: { steps: number[]; lines: string[] } = { steps: [], lines: [] };
  private ct = 0; private realNow = 0; private idx = 0; private blocker: Task | null = null; private tasks: Task[] = [];
  private actors = new Map<string, Actor>(); private hitstopUntil = 0; private slowUntil = 0; private slowScale = 1;
  private hidden: Phaser.GameObjects.GameObject[] = []; private overlays: Phaser.GameObjects.GameObject[] = [];
  private bars: [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle]; private barK = 0; private barTo = 0; private barMs = 400;
  private veil: Phaser.GameObjects.Rectangle; private flashR: Phaser.GameObjects.Rectangle; private subtitle: Phaser.GameObjects.Text; private skipBtn: Phaser.GameObjects.Text;
  private subUntil = 0; private flashAt = -1; private flashMs = 0; private flashA = 0;
  private readonly cam: Phaser.Cameras.Scene2D.Camera;
  /** 相机本来的缩放（高清渲染 RENDER_SCALE，原点在左上角，见 main.ts）；脚本里的 zoom 都相对它（1 = 平时）。 */
  private readonly base: number;
  private get z(): number { return this.cam.zoom / this.base; }
  /** 镜头中心（世界坐标）与相对缩放。 */
  private center(): { x: number; y: number } { const z = this.z; return { x: this.cam.scrollX + GAME_WIDTH / (2 * z), y: this.cam.scrollY + GAME_HEIGHT / (2 * z) }; }
  private setView(x: number, y: number, z: number): void { this.cam.setZoom(this.base * z); this.cam.setScroll(x - GAME_WIDTH / (2 * z), y - GAME_HEIGHT / (2 * z)); }
  private readonly onEsc = (): void => this.skip();
  constructor(private h: CutHost, readonly script: CutsceneScript, private onDone: (skipped: boolean) => void) {
    const s = h.scene; this.cam = s.cameras.main; this.base = this.cam.zoom || 1;
    // HUD 藏起（屏幕坐标的东西），结束后原样恢复
    for (const o of s.children.list) { const g = o as unknown as { scrollFactorX?: number; visible?: boolean; setVisible?: (v: boolean) => void }; if (g.scrollFactorX === 0 && g.visible && g.setVisible) { g.setVisible(false); this.hidden.push(o); } }
    const D = DEPTH.hud + 60, W = GAME_WIDTH, H = GAME_HEIGHT;
    const bar = (): Phaser.GameObjects.Rectangle => s.add.rectangle(W / 2, 0, W * 3, H * .13, 0x000000, 1).setScrollFactor(0).setDepth(D).setName('cutscene-bar');
    this.bars = [bar(), bar()];
    this.veil = s.add.rectangle(W / 2, H / 2, W * 3, H * 3, 0x000000, 0).setScrollFactor(0).setDepth(D - 1).setName('cutscene-veil');
    this.flashR = s.add.rectangle(W / 2, H / 2, W * 3, H * 3, 0xffffff, 0).setScrollFactor(0).setDepth(D - 2).setBlendMode(Phaser.BlendModes.ADD).setName('cutscene-flash');
    this.subtitle = s.add.text(W / 2, H - H * .065, '', { fontFamily: HEADING_FONT, fontSize: '22px', color: '#f4e6c4', stroke: '#000000', strokeThickness: 4, resolution: 2 }).setOrigin(.5).setScrollFactor(0).setDepth(D + 1).setName('cutscene-subtitle');
    this.skipBtn = s.add.text(W - 18, H - H * .065, '跳过 ›', { fontFamily: HEADING_FONT, fontSize: '18px', color: '#cdbb92', stroke: '#000000', strokeThickness: 3, resolution: 2 }).setOrigin(1, .5).setScrollFactor(0).setDepth(D + 1).setName('cutscene-skip').setInteractive({ useHandCursor: true });
    this.skipBtn.on('pointerdown', () => this.skip());
    this.overlays.push(...this.bars, this.veil, this.flashR, this.subtitle, this.skipBtn);
    s.input.keyboard?.on('keydown-ESC', this.onEsc);
    s.events.on('postupdate', this.tick, this);
    s.events.once('shutdown', () => this.dispose());
    this.layout();
  }

  /** 每帧（postupdate，真实时间）。 */
  private tick(): void {
    if (!this.active) return;
    const rdt = Math.min(50, this.h.scene.game.loop.delta); this.realNow += rdt;
    const scale = this.realNow < this.hitstopUntil ? 0 : this.realNow < this.slowUntil ? this.slowScale : 1, cdt = rdt * scale;
    this.ct += cdt;
    this.tasks = this.tasks.filter(t => !t.update(cdt, rdt));
    for (let guard = 0; guard < 64; guard++) {
      if (this.blocker) { if (this.tasks.includes(this.blocker)) break; this.blocker = null; }
      if (this.idx >= this.script.steps.length) break;
      const i = this.idx++, step = this.script.steps[i];
      if (step.if && !this.cond(step)) continue;
      this.log.steps.push(i);
      const task = this.run(step);
      if (task) { this.tasks.push(task); if (step.wait !== false) this.blocker = task; }
    }
    for (const a of this.actors.values()) this.draw(a);
    // 黑边 / 闪光 / 字幕（真实时间）
    this.barK = this.barTo > this.barK ? Math.min(this.barTo, this.barK + rdt / this.barMs) : Math.max(this.barTo, this.barK - rdt / this.barMs);
    if (this.flashAt >= 0) { const k = (this.realNow - this.flashAt) / this.flashMs; this.flashR.setAlpha(k >= 1 ? 0 : this.flashA * (1 - k)); if (k >= 1) this.flashAt = -1; }
    if (this.subUntil && this.ct >= this.subUntil) { this.subtitle.setText(''); this.subUntil = 0; }
    this.layout();
    if (this.idx >= this.script.steps.length && !this.blocker && !this.tasks.length && this.barK <= 0) this.finish(false);
  }
  /** 屏幕坐标的覆盖层在镜头推近时要反向补偿（相机原点在左上角，scrollFactor 0 的物件随 zoom 以左上角缩放）。 */
  private layout(): void {
    const z = this.z, W = GAME_WIDTH, H = GAME_HEIGHT, cx = W / 2, cy = H / 2, at = (o: Phaser.GameObjects.Components.Transform, sx: number, sy: number): void => { o.setPosition(sx / z, sy / z); o.setScale(1 / z); };
    const bh = H * .13, k = this.barK;
    at(this.bars[0], cx, -bh / 2 + bh * k); at(this.bars[1], cx, H + bh / 2 - bh * k);
    at(this.veil, cx, cy); at(this.flashR, cx, cy);
    at(this.subtitle, cx, H - bh * .5 * k - (1 - k) * 40); at(this.skipBtn, W - 18, H - bh * .5);
    this.skipBtn.setAlpha(Math.max(.35, k));
  }
  private cond(step: CutStep): boolean { const c = step.if!; if (c.hero && !this.h.heroes().includes(c.hero)) return false; return true; }
  private anchor(name: string): { x: number; y: number } | null {
    const v = this.cam.worldView, a = this.actors.get(name);
    if (name === '@left') return { x: v.left, y: v.centerY }; if (name === '@right') return { x: v.right, y: v.centerY };
    if (name === '@top') return { x: v.centerX, y: v.top }; if (name === '@bottom') return { x: v.centerX, y: v.bottom }; if (name === '@center') return { x: v.centerX, y: v.centerY };
    if (a) return { x: a.x, y: a.y };
    const o = this.h.anchors[name]; return o ? { x: o.x, y: o.y } : null;
  }
  private pos(p: Pos): { x: number; y: number } {
    const b = p.a ? this.anchor(p.a) ?? this.anchor('player') ?? { x: 0, y: 0 } : { x: 0, y: 0 };
    const y = p.ay ? (this.anchor(p.ay)?.y ?? b.y) : b.y;
    return { x: b.x + (p.x ?? 0), y: y + (p.y ?? 0) };
  }
  /** 计时任务：ms 为过场时钟毫秒（real = 真实时间）。 */
  private timed(ms: number, fn: (k: number) => void, real = false, end?: () => void): Task { let t = 0; fn(0); return { update: (c, r) => { t += real ? r : c; const k = Math.min(1, ms ? t / ms : 1); fn(k); if (k >= 1) { end?.(); return true; } return false; }, end }; }

  private run(st: CutStep): Task | null {
    const s = this.h.scene;
    switch (st.t) {
      case 'letterbox': this.barTo = st.on ? 1 : 0; this.barMs = st.ms ?? 400; if (!st.on) this.subtitle.setText(''); return this.timed(st.ms ?? 400, () => {}, true);
      case 'fade': { const a0 = this.veil.alpha; this.veil.setFillStyle(st.color ?? 0, 1); return this.timed(st.ms, k => this.veil.setAlpha(a0 + (st.to - a0) * k), true); }
      case 'wait': return this.timed(st.ms, () => {});
      case 'cam': {
        const c0 = this.center(), z0 = this.z, to = st.to ? this.pos(st.to) : c0, z1 = st.zoom ?? z0;
        return this.timed(st.ms, k => { const e = ease(st.ease, k); this.setView(c0.x + (to.x - c0.x) * e, c0.y + (to.y - c0.y) * e, z0 + (z1 - z0) * e); });
      }
      case 'shake': this.cam.shake(st.ms, st.k); return this.timed(st.ms, () => {}, true);
      case 'slow': this.slowScale = st.scale; this.slowUntil = this.realNow + st.ms; return this.timed(st.ms, () => {}, true);
      case 'hitstop': this.hitstopUntil = this.realNow + st.ms; return this.timed(st.ms, () => {}, true);
      case 'flash': this.flashR.setFillStyle(st.color, 1); this.flashAt = this.realNow; this.flashMs = st.ms; this.flashA = st.alpha ?? .6; return this.timed(st.ms, () => {}, true);
      case 'actor': { const p = this.pos(st.at), a: Actor = { id: st.id, x: p.x, y: p.y, dir: st.face ?? 'down', pose: 'idle', poseAt: this.ct, fps: 10, spec: st.spec }; this.make(a); this.actors.set(st.id, a); return null; }
      case 'bind': {
        const o = this.h.anchors[st.anchor] as Img | undefined; if (!o || !('setFrame' in o)) return null;
        const a: Actor = { id: st.id, x: o.x, y: o.y, dir: 'down', pose: 'idle', poseAt: this.ct, fps: 10, bound: o, fallKey: st.fall, scaleH: Math.abs(o.displayHeight) };
        this.actors.set(st.id, a); return null;
      }
      case 'pose': {
        const a = this.actors.get(st.id); if (!a) return null; if (st.face) a.dir = st.face; a.pose = st.pose; a.poseAt = this.ct; a.fps = st.fps ?? 10;
        if (st.pose === 'attack' || st.pose === 'fall') return this.timed(4 / a.fps * 1000, () => {});
        return null;
      }
      case 'face': { const a = this.actors.get(st.id); if (a) a.dir = st.dir; return null; }
      case 'move': {
        const a = this.actors.get(st.id); if (!a) return null; if (st.face) a.dir = st.face;
        const from = { x: a.x, y: a.y }, to = this.pos(st.to); if (st.pose) { a.pose = st.pose; a.poseAt = this.ct; }
        if (!st.face && Math.abs(to.x - from.x) > 4) a.dir = to.x < from.x ? 'left' : 'right';
        let nextDust = 0;
        return this.timed(st.ms, k => { const e = ease(st.ease, k); a.x = from.x + (to.x - from.x) * e; a.y = from.y + (to.y - from.y) * e; if (st.dust && this.ct >= nextDust && k < .98) { nextDust = this.ct + 150; this.tasks.push(this.fx('fx_collapse_dust', a.x - (a.dir === 'left' ? -40 : 40), a.y + 4, 120, 520, { originY: .8, alpha: .7 })); } },
          false, () => { if (st.pose === 'ride' || st.pose === 'walk') { a.pose = 'idle'; a.poseAt = this.ct; } });
      }
      case 'remove': { const a = this.actors.get(st.id); if (a) { this.destroyActor(a); this.actors.delete(st.id); } return null; }
      case 'fx': { const p = this.pos(st.at); return this.fx(st.key, p.x, p.y, st.size, st.ms, { rot: st.rot, flipX: st.flipX, add: st.add, tint: st.tint, originY: st.originY }); }
      case 'say': return this.say(st.who, st.name, st.text, st.style, st.ms ?? 1600, st.color ?? '#ffe08a');
      case 'sfx': { const n = st.times ?? 1, every = st.every ?? 250; let i = 0, at = 0; this.h.sfx(st.key); i++; if (n <= 1) return null; return { update: (_c, r) => { at += r; while (i < n && at >= i * every) { this.h.sfx(st.key); i++; } return i >= n; } }; }
      case 'music': this.h.music?.(st.duck); return null;
    }
    void s; return null;
  }

  /** 手绘序列帧（过场时钟逐帧推进；缺图什么都不画）。 */
  private fx(key: string, x: number, y: number, size: number, ms: number, o: { rot?: number; flipX?: boolean; add?: boolean; tint?: number; originY?: number; alpha?: number } = {}): Task {
    const s = this.h.scene, d = SKILL_FX[key];
    if (!d || !s.textures.exists(key)) return { update: () => true };
    const img = s.add.image(x, y, key, 0).setDisplaySize(size, size).setDepth(DEPTH.fx + 2).setRotation(o.rot ?? 0).setFlipX(!!o.flipX).setOrigin(.5, o.originY ?? .5).setAlpha(o.alpha ?? 1).setName('cutscene-fx')
      .setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    if (o.tint !== undefined) img.setTint(o.tint);
    return this.timed(ms, k => { if (img.active) img.setFrame(Math.min(d.frames - 1, Math.floor(k * d.frames))); }, false, () => img.destroy());
  }
  /** 台词：cry = 头顶大字逐字砸下（同武将战吼样式）+ 底部字幕；sub = 只有底部字幕。 */
  private say(who: string | undefined, name: string | undefined, text: string, style: 'cry' | 'sub', ms: number, color: string): Task {
    const s = this.h.scene; this.log.lines.push(text);
    this.subtitle.setText(name ? `${name}：${text}` : text); this.subUntil = this.ct + ms;
    if (style === 'sub') return this.timed(ms, () => {});
    const chars = [...text], size = 26, gap = size * .98, w = (chars.length - 1) * gap, stagger = 45, pop = 130;
    const holder = s.add.container(0, 0).setDepth(DEPTH.dmgText + 4).setName('cutscene-say');
    const glyphs = chars.map((ch, i) => { const t = s.add.text(-w / 2 + i * gap, 0, ch, { fontFamily: HEADING_FONT, fontSize: `${size}px`, color, stroke: '#2a1206', strokeThickness: 5, resolution: 2 }).setOrigin(.5).setShadow(0, 1, '#000000', 3, true, true).setAlpha(0); holder.add(t); return t; });
    const at = (): { x: number; y: number } => { const a = this.actors.get(who ?? ''), p = a ? { x: a.x, y: a.y } : (who ? this.anchor(who) : null) ?? this.anchor('player') ?? { x: 0, y: 0 }; const hgt = a?.main ? a.main.displayHeight : a?.bound ? Math.abs(a.bound.displayHeight) : 110; return { x: p.x, y: p.y - hgt - 18 }; };
    let t = 0;
    return { update: c => { t += c; const p = at(); holder.setPosition(p.x, p.y - Math.max(0, t - ms + 300) * .12);
      glyphs.forEach((g, i) => { const k = Phaser.Math.Clamp((t - i * stagger) / pop, 0, 1); g.setAlpha(k).setScale(1 + .7 * (1 - k)); });
      if (t > ms - 300) holder.setAlpha(Math.max(0, (ms - t) / 300));
      if (t >= ms) { holder.destroy(); return true; } return false; }, end: () => holder.destroy() };
  }

  private make(a: Actor): void {
    const s = this.h.scene, sp = a.spec!;
    if (sp.kind === 'ride') {
      const hk = HORSE_KEY[sp.horse], rk = 'ride_v2_boss_' + sp.rider;
      if (s.textures.exists(hk) && s.textures.get(hk).has('down_0')) a.horse = s.add.image(a.x, a.y, hk, `${a.dir}_0`).setOrigin(.5, HORSE_V2.foot / HORSE_V2.cell).setScale(HORSE_V2.scale).setName('cutscene-actor');
      if (s.textures.exists(rk)) a.main = s.add.image(a.x, a.y, rk, 0).setOrigin(.5, (RIDE.foot + RIDE.stirrup / RIDE.scale) / RIDE.cell).setScale(RIDE.scale).setName('cutscene-actor');
      else if (s.textures.exists('boss_' + sp.rider)) a.main = s.add.image(a.x, a.y, 'boss_' + sp.rider, `${a.dir}_0`).setOrigin(.5, .89).setScale(.5).setName('cutscene-actor');
    } else if (sp.kind === 'sheet') a.main = s.add.image(a.x, a.y, sp.tex, `${a.dir}_0`).setOrigin(.5, sp.foot).setScale(sp.scale).setName('cutscene-actor');
    else a.main = s.add.image(a.x, a.y, sp.tex, sp.frame).setOrigin(.5, sp.foot).setScale(sp.scale).setName('cutscene-actor');
  }
  private frameOf(a: Actor): number { return Math.floor((this.ct - a.poseAt) / 1000 * a.fps); }
  /** 按姿势 / 朝向摆帧。 */
  private draw(a: Actor): void {
    const f = this.frameOf(a), di = DIRS.indexOf(a.dir), side = a.dir === 'left' || a.dir === 'right';
    if (a.bound) {
      const b = a.bound;
      if (a.pose === 'fall') {
        const s = this.h.scene;
        if (!a.fall && a.fallKey && s.textures.exists(a.fallKey)) { a.fall = s.add.image(b.x, b.y, a.fallKey, 0).setOrigin(.5, 256 / 288).setScale((a.scaleH ?? 200) / 288).setFlipX(a.dir === 'left').setDepth(b.depth).setName('cutscene-fall'); b.setAlpha(0); }
        if (a.fall) a.fall.setFrame(Math.min(3, f));
        else b.setRotation(Math.min(1, f / 3) * (a.dir === 'left' ? 1.35 : -1.35));
        return;
      }
      if (b.texture.has(`${a.dir}_0`)) b.setFrame(`${a.dir}_0`); else b.setFlipX(a.dir === 'left');
      return;
    }
    const sp = a.spec; if (!sp) return;
    const depth = actorDepth(a.y);
    if (sp.kind === 'ride' && a.main && a.main.texture.key.startsWith('ride_v2_boss_')) {
      const row = a.pose === 'attack' ? 4 + di : di, fr = a.pose === 'fall' ? 32 + Math.min(3, f) : a.pose === 'attack' ? row * 4 + Math.min(3, f) : a.pose === 'ride' || a.pose === 'walk' ? row * 4 + Math.floor((this.ct - a.poseAt) / 90) % 4 : row * 4;
      // 跨坐：首领骑乘图第一批是站姿（腿画到脚），整张放上去像「站在马上」。裁到大腿根（seat），髋部压在鞍上，腿藏在马身后；
      // 跟着马步起伏（马蹄落地那帧沉一点）。坠马行不裁。
      const moving = a.pose === 'ride' || a.pose === 'walk', step = moving ? Math.floor((this.ct - a.poseAt) / 80) % 4 : 0, bob = moving ? [0, -3, -1, -4][step] : 0;
      const seat = sp.kind === 'ride' ? sp.seat ?? RIDE_SEAT.seat : RIDE_SEAT.seat, rise = sp.kind === 'ride' ? sp.rise ?? RIDE_SEAT.rise : RIDE_SEAT.rise;
      if (a.pose === 'fall') a.main.setFrame(fr).setCrop().setOrigin(.5, RIDE.foot / RIDE.cell).setPosition(a.x, a.y);
      else a.main.setFrame(fr).setCrop(0, 0, RIDE.cell, seat).setOrigin(.5, seat / RIDE.cell).setPosition(a.x, a.y - rise + bob);
      a.main.setDepth(depth + .01);
    } else if (a.main) {
      const moving = a.pose === 'ride' || a.pose === 'walk', i = moving ? Math.floor((this.ct - a.poseAt) / 110) % 4 : 0;
      if (a.main.texture.has(`${a.dir}_${i}`)) a.main.setFrame(`${a.dir}_${i}`);
      a.main.setPosition(a.x, a.y - (sp.kind === 'ride' ? HORSE_V2.riderRise : 0)).setDepth(depth + .01);
    }
    if (a.horse) { const moving = a.pose === 'ride' || a.pose === 'walk', hdir = side || a.dir === 'up' ? a.dir : 'down'; a.horse.setFrame(`${hdir}_${moving ? Math.floor((this.ct - a.poseAt) / 80) % 4 : 0}`).setPosition(a.x, a.y).setDepth(depth); }
  }
  private destroyActor(a: Actor): void { a.main?.destroy(); a.horse?.destroy(); a.fall?.destroy(); if (a.bound) { a.bound.setAlpha(1).setRotation(0); } }

  /** 跳过：直接到结束状态。 */
  skip(): void { if (!this.active) return; this.skipped = true; this.finish(true); }
  private finish(skipped: boolean): void {
    if (!this.active) return; this.active = false;
    for (const t of this.tasks) t.end?.(); this.tasks = []; this.blocker = null;
    const lingerIds = this.script.linger ?? {}, lingering: Img[] = [];
    for (const a of this.actors.values()) {
      const pose = lingerIds[a.id];
      if (pose) { a.pose = pose; a.poseAt = this.ct - 10000; this.draw(a); const img = a.fall ?? a.main ?? null; if (img) lingering.push(img); if (a.horse) lingering.push(a.horse); }
      else this.destroyActor(a);
    }
    this.h.scene.children.list.filter(o => o.name === 'cutscene-fx' || o.name === 'cutscene-say').forEach(o => o.destroy());
    const p = this.anchor('player'); if (p) this.setView(p.x, p.y, 1); else this.cam.setZoom(this.base);
    this.h.music?.(1);
    this.dispose();
    // 留场的演员（如倒地的董卓）停一会儿再淡出（真实时间，弹窗不影响）
    if (lingering.length) { const s = this.h.scene; let t = 0; const fade = (): void => { t += s.game.loop.delta; const k = Math.max(0, Math.min(1, (t - 1600) / 700)); for (const o of lingering) if (o.active) o.setAlpha(1 - k); if (k >= 1) { s.events.off('postupdate', fade); lingering.forEach(o => o.destroy()); } }; s.events.on('postupdate', fade); s.events.once('shutdown', () => s.events.off('postupdate', fade)); }
    this.onDone(skipped);
  }
  private dispose(): void {
    const s = this.h.scene; s.events.off('postupdate', this.tick, this); s.input.keyboard?.off('keydown-ESC', this.onEsc);
    for (const o of this.overlays) o.destroy(); this.overlays = [];
    for (const o of this.hidden) (o as unknown as { active: boolean; setVisible(v: boolean): void }).active && (o as unknown as { setVisible(v: boolean): void }).setVisible(true); this.hidden = [];
    this.active = false;
  }
  snapshot() { return { id: this.script.id, active: this.active, skipped: this.skipped, step: this.idx, of: this.script.steps.length, ct: Math.round(this.ct), zoom: +this.z.toFixed(2), bars: +this.barK.toFixed(2), actors: [...this.actors.keys()], lines: [...this.log.lines], hidden: this.hidden.length }; }
}
