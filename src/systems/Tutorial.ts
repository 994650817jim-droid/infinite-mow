import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { gamepad } from '../platform/gamepad';
import { isChapterTestRun } from './ChapterProgress';
import { setTutorialSeen, tutorialSeen } from '../world/WorldStore';
import { TutorialOverlay, type ScreenRect } from '../ui/TutorialOverlay';
import { GAME_HEIGHT as GAME_H, GAME_WIDTH as GAME_W } from '../config';

/** 引导步骤：主线顺序推进；levelup / recruit 是事件插入（首次弹窗时，只出一次）。 */
export type TutorialStep = 'move' | 'attack' | 'gem' | 'levelup' | 'recruit' | 'sortie' | 'boss' | 'chest' | 'camp' | 'bag' | 'depart' | 'done';
const MAIN: TutorialStep[] = ['move', 'attack', 'gem', 'sortie', 'boss', 'chest', 'camp', 'bag', 'depart', 'done'];
/** 开局前 30 秒刷兵放缓（刷怪间隔 ×intervalMul、每次刷兵数 ÷burstDiv），新手不至于一上来就死。初值，交平衡会话。 */
export const TUTORIAL_EASY = { seconds: 30, intervalMul: 2.2, burstDiv: 2 } as const;
/** 每一步至少停留（毫秒），免得条件早已满足而一闪而过。 */
const MIN_SHOW = 1800;
/** 提示型步骤（只说一句、不等操作：自动攻击、首领出阵、营中建筑、行囊）几毫秒后自动淡出；要操作的步骤一直显示到做完。 */
const INFO_MS = 4000;

/** GameScene 里引导要读的状态（只读，不改场景）。 */
interface Host {
  player: Player; mode: string; kills: number; elapsed: number; over: boolean;
  boss: Enemy | null; bossKilled: boolean; bossChests: { done: boolean; ready: boolean; x: number; y: number }[];
  legion: { order: string; count: number }; legionUI: { order?: Phaser.GameObjects.Text; rows?: { root: Phaser.GameObjects.Container }[] };
  chapter: { id: string; stage?: number };
}
interface StepDef { show: () => void; ready?: () => boolean; done: () => boolean; minMs?: number }

/**
 * 新手引导（情境式，不做单独教学关）：第一次进 1-1（黄巾 · 广宗外围）边打边教；看完 / 跳过后在当前存档记标记，不再出现，
 * 设置「重看新手引导」可清掉标记。① 移动 → ② 自动攻击 → ③ 拾取经验 → ④ 首次升级三选一（插入）→ ⑤ 首次战斗支援（插入）
 * → ⑥ 出击号令 → ⑦ 首领出阵 / 倒地后捡宝箱 → ⑧ 告捷进行营：营中建筑、行囊、率军出征。
 * 每帧只读场景状态推进（GameScene 里只有构造一行、刷兵一行）；升级 / 支援弹窗本身已暂停，其余步骤边玩边看。
 */
export class Tutorial {
  step: TutorialStep = 'move';
  /** 已出现过的步骤（按出现顺序，测试 / 调试用）。 */
  readonly seen: TutorialStep[] = [];
  private shown = false; private shownAt = 0;
  private moved = 0; private lastMoveAt = -1e9; private lastPos = { x: 0, y: 0 }; private xp0 = 0; private kills0 = 0;
  private levelupDone = false; private recruitDone = false; private interrupt: 'levelup' | 'recruit' | null = null;
  private finished = false; private skipped = false;
  private overlay: TutorialOverlay;
  private readonly steps: Record<Exclude<TutorialStep, 'done'>, StepDef>;

  /** 该不该开引导：1-1 且当前存档没看过；测试跑（?dev=1）与自动开局（?autostart）默认不开，?tutorial=1 强制开。 */
  static wanted(chapter: { id: string; stage?: number }): boolean {
    let force = false, auto = false;
    try { const q = new URLSearchParams(window.location.search); force = q.get('tutorial') === '1'; auto = q.has('autostart'); } catch { /* ignore */ }
    if (chapter.id !== 'huangjin' || (chapter.stage ?? 1) !== 1) return false;
    return force || (!isChapterTestRun() && !auto && !tutorialSeen());
  }
  /** GameScene.create 末尾调用：该开就开。 */
  static maybeStart(scene: Phaser.Scene): Tutorial | undefined {
    const h = scene as unknown as Host;
    return h.chapter && h.player && Tutorial.wanted(h.chapter) ? new Tutorial(scene) : undefined;
  }

  constructor(private scene: Phaser.Scene) {
    const o = this.overlay = new TutorialOverlay(scene, () => this.finish(true));
    const h = this.h, pad = () => gamepad.device === 'pad', key = (k: string, p: string) => (pad() ? p : k);
    this.steps = {
      move: { show: () => { o.show(pad() ? '左摇杆移动' : '移动', pad() ? [] : ['W', 'A', 'S', 'D']); o.point(null); this.moved = 0; this.lastPos = { x: h.player.x, y: h.player.y }; }, done: () => this.moved >= 2 },
      attack: { show: () => { o.show('武将自动攻击，靠近敌人即可', [], 'battle', INFO_MS); o.point(null); this.kills0 = h.kills; }, done: () => h.kills - this.kills0 >= 3 },
      gem: { show: () => { o.show('拾取经验，攒满升级'); o.point(null); this.xp0 = this.xpTotal(); }, done: () => this.xpTotal() > this.xp0 },
      levelup: { show: () => { o.show('升级：三选一强化', [], 'popup'); this.pointCards(); }, done: () => h.mode !== 'levelup', minMs: 0 },
      recruit: { show: () => { o.show('战斗支援：选一队兵随行', [], 'popup'); this.pointObj(h.legionUI.rows?.[0]?.root ?? null); }, done: () => h.mode !== 'recruit', minMs: 0 },
      sortie: { ready: () => h.legion.count > 0, show: () => { o.show('部曲出击 / 护阵', [key('E', 'Ⓨ')]); this.pointObj(h.legionUI.order ?? null); }, done: () => h.legion.order === 'sortie' },
      boss: { ready: () => !!h.boss?.active, show: () => { o.show('首领出阵，击败他', [], 'battle', INFO_MS); o.point(null); }, done: () => h.bossKilled && h.bossChests.length > 0 },
      chest: { ready: () => h.bossChests.some(c => c.ready && !c.done), show: () => o.show('走过去捡宝箱'), done: () => h.bossChests.length > 0 && h.bossChests.every(c => c.done), minMs: 0 },
      camp: { ready: () => h.mode === 'rest' && !this.find('rest-intro'), show: () => { o.show('营中建筑：招兵、商人、将帅', [], 'camp', INFO_MS); this.pointName('camp-tab-0'); }, done: () => this.shownFor(4500) },
      bag: { ready: () => h.mode === 'rest', show: () => { o.show('行囊里换兵装', [], 'camp', INFO_MS); this.pointName('camp-bag'); }, done: () => this.shownFor(4000) || !!this.find('item-bag') },
      depart: { ready: () => h.mode === 'rest', show: () => { o.show('整军完毕，率军出征', [], 'camp'); this.pointName('camp-depart'); }, done: () => h.mode !== 'rest' || this.scene.sys.isActive() === false, minMs: 0 },
    };
    scene.events.on('postupdate', this.tick, this);
    scene.events.once('shutdown', () => { if (!this.finished && this.step === 'depart') this.finish(false); this.dispose(); });
  }
  private get h(): Host { return this.scene as unknown as Host; }
  get active(): boolean { return !this.finished; }
  private xpTotal(): number { const p = this.h.player; return p.level * 100000 + p.xp; }
  private shownFor(ms: number): boolean { return this.shown && performance.now() - this.shownAt >= ms; }

  /** 刷兵放缓倍率（GameScene.updateSpawner 一行调用）。 */
  easy(elapsed: number): { interval: number; burstDiv: number } { return this.finished || elapsed >= TUTORIAL_EASY.seconds ? { interval: 1, burstDiv: 1 } : { interval: TUTORIAL_EASY.intervalMul, burstDiv: TUTORIAL_EASY.burstDiv }; }

  private present(step: Exclude<TutorialStep, 'done'>): void { this.shown = true; this.shownAt = performance.now(); this.seen.push(step); this.steps[step].show(); }
  private advance(): void {
    const i = MAIN.indexOf(this.step); this.step = MAIN[i + 1] ?? 'done'; this.shown = false; this.overlay.hide();
    if (this.step === 'done') this.finish(false);
  }

  private tick(): void {
    if (this.finished || !this.scene.sys.isActive()) return;
    // 行囊 / 暂停 / 战报 / 图鉴等面板打开时收起引导（升级、支援两步本身就是在弹窗上教，不收）
    this.overlay.suppress(this.panelOpen());
    this.overlay.animate();
    const h = this.h, p = h.player;
    if (this.step === 'move') { const d = Math.hypot(p.x - this.lastPos.x, p.y - this.lastPos.y), t = performance.now(); this.lastPos = { x: p.x, y: p.y }; if (h.mode === 'none' && d > .3) this.lastMoveAt = t; if (h.mode === 'none' && t - this.lastMoveAt < 250) this.moved += this.scene.game.loop.delta / 1000; }
    // ④ / ⑤ 首次升级三选一、首次战斗支援：随时插入，弹窗关掉后回主线（主线步骤重新显示）
    if (!this.interrupt && !this.levelupDone && h.mode === 'levelup') { this.levelupDone = true; this.interrupt = 'levelup'; this.present('levelup'); return; }
    if (!this.interrupt && !this.recruitDone && h.mode === 'recruit') { this.recruitDone = true; this.interrupt = 'recruit'; this.present('recruit'); return; }
    if (this.interrupt) {
      if (!this.steps[this.interrupt].done()) { return; }
      this.interrupt = null; this.shown = false; this.overlay.hide(); return;
    }
    // 首领提前出阵：没走完的战斗步骤直接跳到首领
    if (MAIN.indexOf(this.step) < MAIN.indexOf('boss') && h.boss?.active) { this.step = 'boss'; this.shown = false; }
    // 告捷进行营：没走完的战场步骤跳到营地
    if (MAIN.indexOf(this.step) < MAIN.indexOf('camp') && h.mode === 'rest') { this.step = 'camp'; this.shown = false; this.overlay.hide(); }
    if (this.step === 'done') return;
    const st = this.steps[this.step];
    if (!this.shown) { if (!st.ready || st.ready()) this.present(this.step); return; }
    if (this.step === 'chest') { const c = h.bossChests.find(c => c.ready && !c.done); if (c) this.overlay.follow(this.worldRect(c.x, c.y, 60, 50)); }
    if (st.done() && this.shownFor(st.minMs ?? MIN_SHOW)) this.advance();
    else if (this.step === 'move' && this.shownFor(20000)) this.advance(); // 挂机不动也别卡住
  }

  /** 有没有全屏 / 叠加面板开着：非战斗模式（升级 / 支援在教的那步除外、行营本身除外）或行囊、建造、宝箱掉落、图鉴等面板。 */
  private panelOpen(): boolean {
    const m = this.h.mode;
    if (m !== 'none' && m !== 'rest' && !(this.interrupt && (m === 'levelup' || m === 'recruit'))) return true;
    return ['item-bag', 'build-panel', 'boss-chest-popup', 'codex', 'campaign-chronicle', 'merchant-panel'].some(n => !!this.find(n));
  }
  private find(name: string): Phaser.GameObjects.GameObject | null {
    let hit: Phaser.GameObjects.GameObject | null = null;
    const walk = (list: Phaser.GameObjects.GameObject[]) => { for (const o of list) { if (hit) return; if (o.name === name && (o as unknown as { visible?: boolean }).visible !== false) hit = o; const sub = (o as unknown as { list?: Phaser.GameObjects.GameObject[] }).list; if (sub) walk(sub); } };
    walk(this.scene.children.list);
    return hit;
  }
  /** 升级三选一：箭头从卡片下方指向中间那张（卡片对象的包围盒含点击区，不准；电脑布局卡片行占屏高 24%~87%）。 */
  private pointCards(): void { this.overlay.point({ x: GAME_W / 2 - 130, y: GAME_H * .243, w: 260, h: GAME_H * .625 }, null, 'below'); }
  private pointName(name: string): void { this.pointObj(this.find(name)); }
  private pointObj(o: Phaser.GameObjects.GameObject | null): void {
    const b = o && (o as unknown as { getBounds?: () => Phaser.Geom.Rectangle }).getBounds?.();
    this.overlay.point(b && b.width > 0 ? { x: b.x, y: b.y, w: b.width, h: b.height } : null, o);
  }
  /** 世界坐标 → 屏幕坐标（宝箱）。 */
  private worldRect(x: number, y: number, w: number, h: number): ScreenRect { const c = this.scene.cameras.main; return { x: x - c.worldView.x - w / 2, y: y - c.worldView.y - h, w, h }; } // 界面坐标即逻辑坐标（画布按 RENDER_SCALE 放大、相机 zoom 同步），不乘 zoom

  /** 看完或跳过：存档记标记，收起界面。 */
  finish(skipped: boolean): void {
    if (this.finished) return;
    this.finished = true; this.skipped = skipped; this.step = 'done';
    setTutorialSeen(true);
    this.overlay.hide();
    if (!skipped && this.scene.sys.isActive()) { this.overlay.show('引导完成 · 祝武运昌隆', [], this.h.mode === 'rest' ? 'camp' : 'battle'); window.setTimeout(() => { if (this.scene.sys.isActive()) this.overlay.hide(); }, 2200); }
  }
  snapshot() { return { arrow: this.overlay.arrowState, step: this.step, seen: [...this.seen], finished: this.finished, skipped: this.skipped, line: this.overlay.line, interrupt: this.interrupt, shown: this.shown }; }
  private dispose(): void { this.scene.events.off('postupdate', this.tick, this); this.overlay.destroy(); }
}
