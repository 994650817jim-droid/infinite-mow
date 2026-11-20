import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { gamepad } from '../platform/gamepad';
import { isChapterTestRun } from './ChapterProgress';
import { setTutorialSeen, tutorialSeen } from '../world/WorldStore';
import { TutorialOverlay, type ScreenRect } from '../ui/TutorialOverlay';
import { GAME_HEIGHT as GAME_H, GAME_WIDTH as GAME_W } from '../config';

/**
 * 引导步骤（课）。按关分课（chapter1-redesign.md v2 §二，用户 11-20 批准）：
 * - 1-1：移动 → 自动攻击 → 拾取经验 → 首领 → 宝箱 → 行营出征；插入：三选一、战场回血（血 < 60%）、黄巾营寨（事件段）
 * - 1-2：舆图 M（0:20）→ 部曲出击 E；插入：战斗支援、护法符柱（张宝出阵）
 * - 1-3：插入：天雷预警（张角出阵）
 * 每课只出一次（看过记一笔）；「跳过引导」= 第一章剩下的课全跳过；第一章的课都看完记 tutorialDone。
 */
export type TutorialStep = 'move' | 'attack' | 'gem' | 'levelup' | 'heal' | 'tents' | 'boss' | 'chest' | 'depart'
  | 'atlas' | 'recruit' | 'sortie' | 'wards' | 'thunder' | 'done';
type Lesson = Exclude<TutorialStep, 'done'>;
/** 各关主线课（顺序推进）。 */
const MAIN: Record<number, Lesson[]> = { 1: ['move', 'attack', 'gem', 'boss', 'chest', 'depart'], 2: ['atlas', 'sortie'], 3: [] };
/** 各关插入课（条件一满足就插进来，只出一次）。 */
const EVENTS: Record<number, Lesson[]> = { 1: ['levelup', 'heal', 'tents'], 2: ['recruit', 'wards'], 3: ['thunder'] };
/** 开局前 30 秒刷兵放缓（刷怪间隔 ×intervalMul、每次刷兵数 ÷burstDiv），新手不至于一上来就死。只在 1-1。初值，交平衡会话。 */
export const TUTORIAL_EASY = { seconds: 30, intervalMul: 2.2, burstDiv: 2 } as const;
/** 每一步至少停留（毫秒），免得条件早已满足而一闪而过。 */
const MIN_SHOW = 1800;
/** 提示型步骤（只说一句、不等操作）几毫秒后自动淡出；要操作的步骤一直显示到做完。 */
const INFO_MS = 4000;
/** 看过的课（存档内；「重看新手引导」清空）。 */
export const TUTORIAL_LESSONS_KEY = 'im_tut_lessons';
function lessonsSeen(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(TUTORIAL_LESSONS_KEY) ?? '[]') as string[]); } catch { return new Set(); } }
function markLessons(ids: readonly string[]): void { if (!ids.length) return; try { const s = lessonsSeen(); ids.forEach(i => s.add(i)); localStorage.setItem(TUTORIAL_LESSONS_KEY, JSON.stringify([...s])); } catch { /* ignore */ } }
/** 清掉看过的课（设置「重看新手引导」）。 */
export function resetTutorialLessons(): void { try { localStorage.removeItem(TUTORIAL_LESSONS_KEY); } catch { /* ignore */ } }
const lessonKey = (stage: number, l: Lesson): string => `1-${stage}:${l}`;

/** GameScene 里引导要读的状态（只读，不改场景）。 */
interface Host {
  player: Player; mode: string; kills: number; elapsed: number; over: boolean; waveIndex: number;
  boss: Enemy | null; bossKilled: boolean; bossChests: { done: boolean; ready: boolean; x: number; y: number }[];
  legion: { order: string; count: number }; legionUI: { order?: Phaser.GameObjects.Text; rows?: { root: Phaser.GameObjects.Container }[] };
  chapter: { id: string; stage?: number };
}
interface StepDef { show: () => void; ready?: () => boolean; done: () => boolean; minMs?: number }

/**
 * 新手引导（情境式，不做单独教学关）：第一章三关边打边教，按关分课（见上）。每帧只读场景状态推进；
 * 升级 / 支援弹窗本身已暂停（在弹窗上指箭头），其余都边打边看。
 */
export class Tutorial {
  step: TutorialStep;
  /** 已出现过的步骤（按出现顺序，测试 / 调试用）。 */
  readonly seen: TutorialStep[] = [];
  private shown = false; private shownAt = 0;
  private moved = 0; private lastMoveAt = -1e9; private lastPos = { x: 0, y: 0 }; private xp0 = 0; private kills0 = 0;
  private interrupt: Lesson | null = null; private fired = new Set<Lesson>();
  private finished = false; private skipped = false;
  private overlay: TutorialOverlay;
  private readonly steps: Record<Lesson, StepDef>;
  private readonly stage: number; private readonly main: Lesson[]; private readonly events: Lesson[];

  /** 这一关的课还有没看过的（?tutorial=1 强制全出）。 */
  private static pending(stage: number, force: boolean): Lesson[] {
    const all = [...(MAIN[stage] ?? []), ...(EVENTS[stage] ?? [])]; if (force) return all;
    const s = lessonsSeen(); return all.filter(l => !s.has(lessonKey(stage, l)));
  }
  /** 该不该开引导：第一章、这一关还有没看过的课、第一章引导没跳过 / 没看完；测试跑（?dev=1）与自动开局（?autostart）默认不开，?tutorial=1 强制开。 */
  static wanted(chapter: { id: string; stage?: number }): boolean {
    let force = false, auto = false;
    try { const q = new URLSearchParams(window.location.search); force = q.get('tutorial') === '1'; auto = q.has('autostart'); } catch { /* ignore */ }
    const stage = chapter.stage ?? 1;
    if (chapter.id !== 'huangjin' || !MAIN[stage]) return false;
    if (force) return true;
    return !isChapterTestRun() && !auto && !tutorialSeen() && Tutorial.pending(stage, false).length > 0;
  }
  /** GameScene 剧情读完后调用：该开就开。 */
  static maybeStart(scene: Phaser.Scene): Tutorial | undefined {
    const h = scene as unknown as Host;
    return h.chapter && h.player && Tutorial.wanted(h.chapter) ? new Tutorial(scene) : undefined;
  }

  constructor(private scene: Phaser.Scene) {
    const o = this.overlay = new TutorialOverlay(scene, () => this.finish(true));
    const h = this.h, pad = () => gamepad.device === 'pad', key = (k: string, p: string) => (pad() ? p : k);
    let force = false; try { force = new URLSearchParams(window.location.search).get('tutorial') === '1'; } catch { /* ignore */ }
    this.stage = h.chapter.stage ?? 1;
    const left = new Set(Tutorial.pending(this.stage, force));
    this.main = (MAIN[this.stage] ?? []).filter(l => left.has(l)); this.events = (EVENTS[this.stage] ?? []).filter(l => left.has(l));
    this.step = this.main[0] ?? 'done';
    const hpLow = () => h.player.hp / Math.max(1, h.player.maxHp) < .6;
    this.steps = {
      move: { show: () => { o.show(pad() ? '左摇杆移动' : '移动', pad() ? [] : ['W', 'A', 'S', 'D']); o.point(null); this.moved = 0; this.lastPos = { x: h.player.x, y: h.player.y }; }, done: () => this.moved >= 2 },
      attack: { show: () => { o.show('武将自动攻击，靠近敌人即可', [], 'battle', INFO_MS); o.point(null); this.kills0 = h.kills; }, done: () => h.kills - this.kills0 >= 3 },
      gem: { show: () => { o.show('拾取经验，攒满升级'); o.point(null); this.xp0 = this.xpTotal(); }, done: () => this.xpTotal() > this.xp0 },
      levelup: { ready: () => h.mode === 'levelup', show: () => { o.show('升级：三选一强化', [], 'popup'); this.pointCards(); }, done: () => h.mode !== 'levelup', minMs: 0 },
      heal: { ready: () => h.mode === 'none' && hpLow(), show: () => { o.show('生命不足：捡干粮、站到泉眼上回血', [], 'battle', INFO_MS); o.point(null); }, done: () => this.shownFor(INFO_MS) },
      tents: { ready: () => h.mode === 'none' && h.waveIndex >= 2, show: () => { o.show('黄巾营寨：打碎营帐和黄天军旗', [], 'battle', INFO_MS); o.point(null); }, done: () => this.shownFor(INFO_MS) },
      boss: { ready: () => !!h.boss?.active, show: () => { o.show('首领出阵，击败他', [], 'battle', INFO_MS); o.point(null); }, done: () => h.bossKilled && h.bossChests.length > 0 },
      chest: { ready: () => h.bossChests.some(c => c.ready && !c.done), show: () => o.show('走过去捡宝箱'), done: () => h.bossChests.length > 0 && h.bossChests.every(c => c.done), minMs: 0 },
      depart: { ready: () => h.mode === 'rest', show: () => { o.show('整军完毕，率军出征', [], 'camp'); this.pointName('camp-depart'); }, done: () => h.mode !== 'rest' || this.scene.sys.isActive() === false, minMs: 0 },
      atlas: { ready: () => h.mode === 'none' && h.elapsed >= 20, show: () => { o.show('展开舆图看全局（战斗暂停）', [key('M', 'Ⓑ')], 'battle'); this.pointName('battle-map-scroll'); }, done: () => h.mode === 'map' || this.shownFor(8000) },
      recruit: { ready: () => h.mode === 'recruit', show: () => { o.show('战斗支援：选一队兵随行', [], 'popup'); this.pointObj(h.legionUI.rows?.[0]?.root ?? null); }, done: () => h.mode !== 'recruit', minMs: 0 },
      sortie: { ready: () => h.mode === 'none' && h.legion.count > 0, show: () => { o.show('部曲出击 / 护阵', [key('E', 'Ⓨ')]); this.pointObj(h.legionUI.order ?? null); }, done: () => h.legion.order === 'sortie' },
      wards: { ready: () => h.mode === 'none' && !!h.boss?.active, show: () => { o.show('先打碎四周的护法符柱，张宝才会受伤', [], 'battle', INFO_MS); o.point(null); }, done: () => this.shownFor(INFO_MS) },
      thunder: { ready: () => h.mode === 'none' && !!h.boss?.active, show: () => { o.show('张角的天雷先落红圈预警，走出圈外', [], 'battle', INFO_MS); o.point(null); }, done: () => this.shownFor(INFO_MS) },
    };
    scene.events.on('postupdate', this.tick, this);
    scene.events.once('shutdown', () => { if (!this.finished && (this.step === 'depart' || this.step === 'done')) this.finishStage(); this.dispose(); });
  }
  private get h(): Host { return this.scene as unknown as Host; }
  get active(): boolean { return !this.finished; }
  private xpTotal(): number { const p = this.h.player; return p.level * 100000 + p.xp; }
  private shownFor(ms: number): boolean { return this.shown && performance.now() - this.shownAt >= ms; }

  /** 刷兵放缓倍率（GameScene.updateSpawner 一行调用）：只在 1-1 开局。 */
  easy(elapsed: number): { interval: number; burstDiv: number } { return this.finished || this.stage !== 1 || elapsed >= TUTORIAL_EASY.seconds ? { interval: 1, burstDiv: 1 } : { interval: TUTORIAL_EASY.intervalMul, burstDiv: TUTORIAL_EASY.burstDiv }; }

  private present(step: Lesson): void { this.shown = true; this.shownAt = performance.now(); this.seen.push(step); markLessons([lessonKey(this.stage, step)]); this.steps[step].show(); }
  private advance(): void {
    const i = this.main.indexOf(this.step as Lesson); this.step = this.main[i + 1] ?? 'done'; this.shown = false; this.overlay.hide();
    this.maybeComplete();
  }
  /** 主线课走完、插入课也都出过 → 这一关的课结束。 */
  private maybeComplete(): void { if (this.step === 'done' && !this.interrupt && this.events.every(e => this.fired.has(e))) this.finishStage(); }

  private tick(): void {
    if (this.finished || !this.scene.sys.isActive()) return;
    // 行囊 / 暂停 / 战报 / 图鉴等面板打开时收起引导（三选一、支援两步本身就是在弹窗上教，不收）
    this.overlay.suppress(this.panelOpen());
    this.overlay.animate();
    const h = this.h, p = h.player;
    if (this.step === 'move') { const d = Math.hypot(p.x - this.lastPos.x, p.y - this.lastPos.y), t = performance.now(); this.lastPos = { x: p.x, y: p.y }; if (h.mode === 'none' && d > .3) this.lastMoveAt = t; if (h.mode === 'none' && t - this.lastMoveAt < 250) this.moved += this.scene.game.loop.delta / 1000; }
    // 插入课：条件一满足就插进来（只出一次），做完 / 看完回主线
    if (!this.interrupt) for (const e of this.events) { if (this.fired.has(e) || !this.steps[e].ready?.()) continue; this.fired.add(e); this.interrupt = e; this.overlay.hide(); this.present(e); return; }
    if (this.interrupt) {
      const st = this.steps[this.interrupt]; if (!st.done()) return;
      this.interrupt = null; this.shown = false; this.overlay.hide(); this.maybeComplete(); return;
    }
    // 首领提前出阵：没走完的战斗步骤直接跳到首领；告捷进行营：没走完的战场步骤跳到出征
    const at = (l: Lesson) => this.main.indexOf(l), cur = at(this.step as Lesson);
    if (at('boss') >= 0 && cur >= 0 && cur < at('boss') && h.boss?.active) { this.step = 'boss'; this.shown = false; }
    if (at('depart') >= 0 && cur >= 0 && cur < at('depart') && h.mode === 'rest') { this.step = 'depart'; this.shown = false; this.overlay.hide(); }
    if (this.step === 'done') return;
    const st = this.steps[this.step];
    if (!this.shown) { if (!st.ready || st.ready()) this.present(this.step); return; }
    if (this.step === 'chest') { const c = h.bossChests.find(c => c.ready && !c.done); if (c) this.overlay.follow(this.worldRect(c.x, c.y, 60, 50)); }
    if (st.done() && this.shownFor(st.minMs ?? MIN_SHOW)) this.advance();
    else if (this.step === 'move' && this.shownFor(20000)) this.advance(); // 挂机不动也别卡住
  }

  /** 有没有全屏 / 叠加面板开着：非战斗模式（在教的弹窗除外、行营本身除外）或行囊、建造、宝箱掉落、图鉴等面板。 */
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
  private worldRect(x: number, y: number, w: number, h: number): ScreenRect { const v = this.scene.cameras.main.worldView, k = v.width > 0 ? GAME_W / v.width : 1; return { x: (x - v.x - w / 2) * k, y: (y - v.y - h) * k, w: w * k, h: h * k }; } /* 战场镜头可拉远（BATTLE_ZOOM_DESKTOP）：世界 → 界面按可见范围换算 */

  /** 这一关的课结束：记下全部课；第一章三关都看完记 tutorialDone。 */
  private finishStage(): void {
    if (this.finished) return;
    markLessons([...(MAIN[this.stage] ?? []), ...(EVENTS[this.stage] ?? [])].map(l => lessonKey(this.stage, l)));
    const all = [1, 2, 3].every(s => Tutorial.pending(s, false).length === 0);
    this.close(false, all);
  }
  /** 「跳过引导」：第一章剩下的课全跳过（记 tutorialDone）。 */
  finish(skipped: boolean): void { if (skipped) this.close(true, true); else this.finishStage(); }
  private close(skipped: boolean, chapterDone: boolean): void {
    if (this.finished) return;
    this.finished = true; this.skipped = skipped; this.step = 'done';
    if (chapterDone) setTutorialSeen(true);
    this.overlay.hide();
    if (!skipped && chapterDone && this.scene.sys.isActive()) { this.overlay.show('引导完成 · 祝武运昌隆', [], this.h.mode === 'rest' ? 'camp' : 'battle'); window.setTimeout(() => { if (this.scene.sys.isActive()) this.overlay.hide(); }, 2200); }
  }
  snapshot() { return { arrow: this.overlay.arrowState, step: this.step, seen: [...this.seen], finished: this.finished, skipped: this.skipped, line: this.overlay.line, interrupt: this.interrupt, shown: this.shown, stage: this.stage }; }
  private dispose(): void { this.scene.events.off('postupdate', this.tick, this); this.overlay.destroy(); }
}
