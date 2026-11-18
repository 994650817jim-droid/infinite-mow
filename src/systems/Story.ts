/**
 * 剧情系统（2026-11-17 用户：「我想往游戏添加剧情，你设计剧情」；设计见统筹 story-plan.md，剧本在 src/data/story/）。
 *
 * - 节点：章头 chapterOpen / 关前军情 stageBrief / 首领登场 bossIntro / 首领倒下 bossFall / 章末 chapterClose / 营中闲话 campTalk / 羁绊 bond，
 *   另有 bark（由其他系统按 id 触发，如 2-3 董卓 + 吕布首领战）。
 * - 已看过：每存档一次（im_story_seen_v1，在存档位里；中途退出回滚时不回滚，关前军情重打不再播）。跳过也记为已看。
 * - 旗标：storyFlags（im_story_v1，在存档位里，中途退出时随战斗快照一起回滚）。
 * - 设置「剧情：完整 / 只看章头章末 / 关闭」（BattleSettings.storyMode）。测试跑（?dev=1）与自动开局（?autostart）默认不播，?story=1 强制播。
 * - 主公改写：who '{lord}' = 主公本人说；文本里的 {lord} 换成主公名；baseLords 之外的主公改用 variants.other（或按主公 id 给整段）。
 * - 随从感知：ifFollower（主公或随行里有）/ ifRecruited（名册里有）/ ifFlag / ifLord。
 * - 立绘：12 名可玩武将用水墨立轴（assets/ink-scroll/<id>.webp，取上半身）；其他人物先显示名字章（清单见 data/story MISSING_PORTRAITS）。
 * - 首领登场 / 倒下、bark：大字台词。武将台词系统 HeroBark（平衡会话在改成马超 / 魏延同款战吼大字）合进来后，
 *   场景上有 heroBark.sayLine 就走它；没有时用这里的同款大字（storyBark）——只是过渡，不另起一套样式。
 */
import Phaser from 'phaser';
import { DEPTH, FONT, HEADING_FONT, GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP } from '../config';
import { CHARACTERS, HOME_ART_HEROES, type CharacterId } from '../data/characters';
import { STORY_CAST, STORY_CHAPTERS, type StoryChapter, type StoryLine, type StoryNode, type StoryBond, type StoryStage } from '../data/story';
import { storyArtFile } from '../data/story/art';
import { BOSS_PHASE, type BossPhaseEvent } from './BossPhase';
import { storyScroll, type StoryLine as ScrollLine } from '../ui/StoryScroll';
import { storyMode } from './BattleSettings';
import { isChapterTestRun } from './ChapterProgress';

// ———— 存档：已看过 / 旗标 ————
const SEEN_KEY = 'im_story_seen_v1', FLAG_KEY = 'im_story_v1';
type Flags = Record<string, boolean | number | string>;
function readJson<T>(k: string, fallback: T): T { try { const v = JSON.parse(localStorage.getItem(k) ?? 'null'); return v ?? fallback; } catch { return fallback; } }
function writeJson(k: string, v: unknown): void { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 存储不可用 */ } }
export function storySeen(id: string): boolean { return readJson<string[]>(SEEN_KEY, []).includes(id); }
export function markStorySeen(id: string): void { const s = readJson<string[]>(SEEN_KEY, []); if (!s.includes(id)) { s.push(id); writeJson(SEEN_KEY, s); } }
export function storyFlags(): Flags { const v = readJson<{ flags?: Flags }>(FLAG_KEY, {}); return v.flags && typeof v.flags === 'object' ? v.flags : {}; }
export function storyFlag(name: string): boolean | number | string | undefined { return storyFlags()[name]; }
export function setStoryFlag(name: string, value: boolean | number | string = true): void { const f = storyFlags(); f[name] = value; writeJson(FLAG_KEY, { version: 1, flags: f }); }

// ———— 开关 ————
type Gate = 'chapter' | 'stage' | 'boss' | 'camp';
/** 该不该播：设置 + 测试跑门槛（与新手引导同规则：?dev=1 / ?autostart 默认不播，?story=1 强制）。 */
export function storyWanted(kind: Gate): boolean {
  let force = false, auto = false;
  try { const q = new URLSearchParams(window.location.search); force = q.get('story') === '1'; auto = q.has('autostart'); } catch { /* ignore */ }
  if (!force && (isChapterTestRun() || auto)) return false;
  const m = storyMode(); if (m === 'off') return false;
  return m === 'full' || kind === 'chapter';
}

// ———— 台词解析 ————
export interface StoryCtx { lord: CharacterId; team: () => readonly CharacterId[]; recruited: (id: CharacterId) => boolean }
const heroName = (id: string): string | undefined => CHARACTERS.find(c => c.id === id)?.name;
/** 说话人显示名 / 立绘贴图键 / 名字章。 */
export function speaker(who: string | undefined, ctx: StoryCtx): { name?: string; portrait?: string; seal?: string } {
  if (!who) return {};
  const id = who === '{lord}' ? ctx.lord : who, hero = heroName(id);
  if (hero) return { name: hero, portrait: HOME_ART_HEROES.includes(id) ? 'ink_hero_' + id : undefined, seal: hero };
  const c = STORY_CAST[id]; return c ? { name: c.name, portrait: c.portrait, seal: c.name } : { name: id, seal: id };
}
/** 旗标条件：'name' 为真 / 'name=value' 等于 / '!…' 取反。 */
export function flagMatches(cond: string): boolean {
  if (cond.startsWith('!')) return !flagMatches(cond.slice(1));
  const [name, value] = cond.split('='), v = storyFlag(name);
  return value === undefined ? !!v : String(v) === value;
}
/** 按主公与条件取出要说的句子（{lord} 已替换）。 */
export function resolveLines(node: StoryNode, ctx: StoryCtx): StoryLine[] {
  const v = node.variants?.[ctx.lord] ?? (node.baseLords && !node.baseLords.includes(ctx.lord) ? node.variants?.other : undefined);
  const team = ctx.team(), lordName = heroName(ctx.lord) ?? '将军';
  return (v ?? node.lines).filter(l => (!l.ifFollower || team.includes(l.ifFollower)) && (!l.ifNotFollower || !team.includes(l.ifNotFollower)) && (!l.ifRecruited || ctx.recruited(l.ifRecruited))
      && (!l.ifFlag || flagMatches(l.ifFlag)) && (!l.ifLord || l.ifLord.includes(ctx.lord)) && (!l.ifNotLord || !l.ifNotLord.includes(ctx.lord)))
    .map(l => ({ ...l, text: l.text.split('{lord}').join(lordName) }));
}
function toScroll(lines: StoryLine[], ctx: StoryCtx): ScrollLine[] { return lines.map(l => { const s = speaker(l.who, ctx); return { who: s.name, text: l.text, portrait: s.portrait, seal: s.seal, tip: l.tip }; }); }
/** 卷轴里要用到的立绘与插画先载入（主页才载入水墨立轴，战斗里按需补载；剧情人物立绘与插画见 data/story/art.ts，没登记的不载）。 */
function loadPortraits(scene: Phaser.Scene, lines: ScrollLine[], done: () => void, illustration?: string): void {
  const keys = [...lines.map(l => l.portrait), illustration];
  const need = [...new Set(keys.filter((k): k is string => !!k && !scene.textures.exists(k) && !!storyArtFile(k)))];
  if (!need.length) { done(); return; }
  for (const k of need) scene.load.image(k, storyArtFile(k)!);
  let fired = false; const fin = (): void => { if (!fired) { fired = true; done(); } };
  scene.load.once(Phaser.Loader.Events.COMPLETE, fin); scene.load.once('loaderror', () => { /* 缺图时卷轴退回名字章 */ });
  window.setTimeout(fin, 4000); // 加载异常也不卡住流程（卷轴期间战斗计时器已暂停，用真实时钟）
  scene.load.start();
}

/** 剧情卷轴：载入立绘 → 显示 → 读完或跳过都记为已看。 */
export function playStoryScroll(scene: Phaser.Scene, node: StoryNode, lines: StoryLine[], ctx: StoryCtx, confirm: string, done: () => void, extra?: StoryLine[]): void {
  const all = toScroll([...lines, ...(extra ?? [])], ctx); if (!all.length) { done(); return; }
  loadPortraits(scene, all, () => {
    if (scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return; // 场景已关（create 期间 isActive 仍为 false，不能用它判断）
    const finish = (): void => { markStorySeen(node.id); done(); };
    storyScroll(scene, GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP, { name: 'story-' + node.id.replace(/\./g, '-'), confirmName: 'story-confirm', kicker: node.kicker ?? '', title: node.title ?? '',
      lines: all, reward: '', confirm, background: 'rest_camp', illustration: node.illustration, onDone: finish, skip: finish });
  }, node.illustration);
}

// ———— 大字台词（首领登场 / 倒下、bark）————
interface BarkTarget { x: number; y: number; active?: boolean; displayHeight?: number }
interface BarkHost { heroBark?: { sayLine?: (target: BarkTarget, name: string, text: string) => boolean } }
/** 大字台词：跟着说话人走，弹出 → 停 1.8 秒 → 淡出；同时最多 2 句（新的顶掉最旧的）。HeroBark 合入后由它接管。 */
export function storyBark(scene: Phaser.Scene, target: BarkTarget, name: string, text: string): void {
  const host = scene as unknown as BarkHost;
  if (host.heroBark?.sayLine?.(target, name, text)) return;
  const live = scene.children.list.filter(o => o.name === 'story-bark');
  if (live.length >= 2) live[0].destroy();
  const box = scene.add.container(target.x, target.y).setDepth(DEPTH.overlay - 9).setName('story-bark');
  const nameT = scene.add.text(0, -24, name, { fontFamily: HEADING_FONT, fontSize: '14px', color: '#f0c070', stroke: '#1a0c04', strokeThickness: 4, resolution: 2 }).setOrigin(.5);
  const say = scene.add.text(0, 0, text, { fontFamily: HEADING_FONT, fontSize: '22px', color: '#fff1d0', stroke: '#2a0e04', strokeThickness: 6, resolution: 2, wordWrap: { width: 380, useAdvancedWrap: true }, align: 'center' }).setOrigin(.5);
  box.add([nameT, say]).setScale(1.25).setAlpha(0);
  const off = (target.displayHeight ?? 90) * .9 + 28, start = performance.now();
  const tick = (): void => {
    if (!box.active) { scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick); return; }
    const t = performance.now() - start;
    if (target.active !== false) box.setPosition(target.x, target.y - off);
    box.setScale(t < 160 ? 1.25 - .25 * t / 160 : 1).setAlpha(t < 160 ? t / 160 : t > 2100 ? Math.max(0, 1 - (t - 2100) / 400) : 1);
    if (t >= 2500) { scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick); box.destroy(); }
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
  scene.events.once('shutdown', () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick));
}

// ———— 战斗里的导演 ————
export interface StoryHost {
  scene: Phaser.Scene; chapterId: string; stage: number; ctx: StoryCtx;
  /** 暂停 / 恢复战斗（卷轴期间） */
  pause: () => void; resume: () => void;
  /** 抉择奖励（军功 / 军粮）；不给时不发 */
  reward?: (r: { merit?: number; grain?: number }) => void;
  /** 该章共几关（章末挂在最后一关），默认 3 */
  lastStage?: number;
  /** 首领倒下横幅（node.banner；如「斩颜良」） */
  banner?: (title: string, caption?: string) => void;
}
/**
 * 每关一个：GameScene.create 建立（第三章起的篇章场景按自己的篇章 id 重建）。
 * 关前：章头 → before（过场 / 幕间）→ 军情 + 羁绊；首领：登场 / 二阶段（boss-phase 事件）/ 倒下；
 * 关末（首领宝箱捡完、结算前）：after 幕间 → 抉择 → 章末 → 章末后过场。
 */
export class StoryDirector {
  readonly chapter: StoryChapter | undefined;
  readonly chapterId: string;
  /** 本关生效的羁绊（关前判定）；加成在 GameScene 里按 bond.members 套用 */
  readonly bonds: StoryBond[];
  /** 测试用：播过的节点 id（按顺序） */
  readonly played: string[] = [];
  constructor(private readonly h: StoryHost) {
    this.chapterId = h.chapterId; this.chapter = STORY_CHAPTERS[h.chapterId];
    const team = h.ctx.team();
    this.bonds = (this.chapter?.bonds ?? []).filter(b => b.members.every(m => team.includes(m)));
    // 首领二阶段大字台词（各首领控制器都发 boss-phase）
    if (this.stageNodes()?.bossPhase) {
      const onPhase = (e: BossPhaseEvent): void => { if (e.phase === 2) this.bossPhase(e.boss.sprite, e.bossId); };
      h.scene.events.on(BOSS_PHASE, onPhase); h.scene.events.once('shutdown', () => h.scene.events.off(BOSS_PHASE, onPhase));
    }
  }
  private stageNodes(): StoryStage | undefined { return this.chapter?.stages[this.h.stage as 1 | 2 | 3]; }
  /** 依次播一串（暂停战斗，全部播完恢复）；都没有就直接 done。 */
  private runQueue(queue: Array<(next: () => void) => void>, done: () => void): void {
    if (!queue.length) { done(); return; }
    this.h.pause();
    const run = (i: number): void => { if (i >= queue.length) { this.h.resume(); done(); return; } queue[i](() => run(i + 1)); };
    run(0);
  }
  /** 一段卷轴（幕间 / 过场 / 章头章末）：没看过且条件下有句子才排进队列。 */
  private queueScroll(queue: Array<(next: () => void) => void>, node: StoryNode | undefined, gate: 'chapter' | 'stage', confirm: string): void {
    if (!node || storySeen(node.id) || !storyWanted(gate)) return;
    const lines = resolveLines(node, this.h.ctx); if (!lines.length) return;
    queue.push(next => this.scroll(node, lines, confirm, next));
  }
  /** 关前：章头（第一关）→ before（过场 / 幕间）→ 关前军情 + 羁绊台词；都每存档一次。 */
  beginStage(done: () => void): void {
    const queue: Array<(next: () => void) => void> = [], ctx = this.h.ctx, sn = this.stageNodes();
    if (this.h.stage === 1) this.queueScroll(queue, this.chapter?.open, 'chapter', '出征 ▸');
    for (const n of sn?.before ?? []) this.queueScroll(queue, n, 'stage', '继续');
    const brief = sn?.brief, bondLines = this.bonds.filter(b => !storySeen(b.id)).flatMap(b => resolveLines({ id: b.id, type: 'bond', lines: b.lines }, ctx));
    if (brief && !storySeen(brief.id) && storyWanted('stage')) queue.push(next => this.scroll(brief, resolveLines(brief, ctx), '开战', () => { for (const b of this.bonds) markStorySeen(b.id); next(); }, bondLines));
    else if (bondLines.length && storyWanted('stage')) queue.push(next => this.scroll({ id: this.bonds[0].id, type: 'bond', kicker: '羁绊', title: this.bonds.map(b => b.name).join(' · '), lines: [] }, [], '开战', () => { for (const b of this.bonds) markStorySeen(b.id); next(); }, bondLines));
    this.runQueue(queue, done);
  }
  private scroll(node: StoryNode, lines: StoryLine[], confirm: string, next: () => void, extra?: StoryLine[]): void {
    this.played.push(node.id); playStoryScroll(this.h.scene, node, lines, this.h.ctx, confirm, next, extra);
  }
  /** 首领登场 / 二阶段 / 倒下：大字台词（每次都说）。 */
  /** 返回是否说了（说了的话 GameScene 把主将的登场 / 倒下台词往后挪，免得一句顶掉另一句）。 */
  bossIntro(target: BarkTarget): boolean { const n = this.stageNodes()?.bossIntro; return n ? this.bark(n, target) : false; }
  /** 双首领关：节点写了 boss 时只对这位首领说（bossId 来自 boss-phase 事件）。 */
  bossPhase(target: BarkTarget, bossId?: string): boolean { const n = this.stageNodes()?.bossPhase; return n && (!n.boss || !bossId || n.boss === bossId) ? this.bark(n, target) : false; }
  /** bossId：双首领关按首领取 bossFalls[id]（没有时不说）。 */
  bossFall(target: BarkTarget, bossId?: string): boolean {
    const sn = this.stageNodes(), n = bossId && sn?.bossFalls ? sn.bossFalls[bossId] : sn?.bossFall; if (!n) return false;
    const spoke = this.bark(n, target);
    // 横幅 + 旗标（如关羽在队「斩颜良」）：旗标是玩法结果，剧情关了也照记；横幅同温酒斩华雄，也照播
    const b = n.banner; if (b && (!b.ifFollower || this.h.ctx.team().includes(b.ifFollower))) { if (b.flag) setStoryFlag(b.flag); this.h.banner?.(b.title, b.caption); }
    return spoke;
  }
  /** 按 id 说一句（bark 节点，其他系统调用；如 'hulao-3.lubu_enter'）。返回是否说了。 */
  line(id: string, target: BarkTarget): boolean {
    const n = this.chapter?.barks?.find(b => b.id === id); return n ? this.bark(n, target) : false;
  }
  private bark(node: StoryNode, target: BarkTarget): boolean {
    if (!storyWanted('boss')) return false;
    const lines = resolveLines(node, this.h.ctx); if (!lines.length) return false;
    this.played.push(node.id);
    const say = (l: StoryLine): void => { const s = speaker(l.who, this.h.ctx); storyBark(this.h.scene, target, s.name ?? '', l.text); };
    lines.forEach((l, i) => { if (i === 0) say(l); else this.h.scene.time.delayedCall(i * 1400, () => say(l)); }); // 第一句立即说（不受计时器暂停影响）
    return true;
  }
  /**
   * 关末（首领宝箱捡完、结算前）：after 幕间 → 抉择 → 章末（最后一关）→ 章末后过场；都每存档一次。
   * 抉择在剧情关闭 / 测试跑时也要定结果：不弹窗，直接按第一个选项（史实分支）写旗标。
   */
  stageEnd(done: () => void): void {
    const queue: Array<(next: () => void) => void> = [], sn = this.stageNodes(), last = this.h.stage === (this.h.lastStage ?? 3);
    if (this.chapter) setStoryFlag(`cleared_${this.chapterId}_${this.h.stage}`); // 「打过某关」条件用（如第四章闲话「打过 4-1」）
    for (const n of sn?.after ?? []) this.queueScroll(queue, n, 'stage', '继续');
    const choice = sn?.choice;
    if (choice?.choices?.length && !storySeen(choice.id)) {
      if (storyWanted('stage')) queue.push(next => this.playChoice(choice, next));
      else this.applyChoice(choice, 0, false);
    }
    if (last) { this.queueScroll(queue, this.chapter?.close, 'chapter', '继续'); for (const n of this.chapter?.closeAfter ?? []) this.queueScroll(queue, n, 'chapter', '继续'); }
    this.runQueue(queue, done);
  }
  /** 第一、二章的旧名（章末），同 stageEnd。 */
  chapterClose(done: () => void): void { this.stageEnd(done); }
  /** 抉择：卷轴最后一页两个按钮；跳过按第一个选项。选完写旗标、给奖励、播回应。 */
  private playChoice(node: StoryNode, next: () => void): void {
    const ctx = this.h.ctx, lines = toScroll(resolveLines(node, ctx), ctx), choices = node.choices ?? [];
    this.played.push(node.id);
    loadPortraits(this.h.scene, lines, () => {
      if (this.h.scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
      const after = (k: number, skipped: boolean): void => {
        const reply = this.applyChoice(node, k, true); if (skipped || !reply.length) { next(); return; }
        playStoryScroll(this.h.scene, { id: node.id + '.reply', type: 'interlude', kicker: node.kicker, title: choices[k].label, lines: [] }, reply, ctx, '继续', next);
      };
      storyScroll(this.h.scene, GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP, { name: 'story-' + node.id.replace(/\./g, '-'), confirmName: 'story-confirm', kicker: node.kicker ?? '', title: node.title ?? '',
        lines, reward: '', confirm: '', background: 'rest_camp', illustration: node.illustration, onDone: () => after(0, false), skip: () => after(0, true),
        choices: choices.map(c => c.label), onChoice: k => after(k, false) });
    }, node.illustration);
  }
  /** 定下抉择结果：写旗标、记已看、给奖励；返回回应台词。 */
  private applyChoice(node: StoryNode, k: number, rewardIt: boolean): StoryLine[] {
    const c = node.choices?.[k]; if (!c) return [];
    setStoryFlag(c.flag, c.value); markStorySeen(node.id);
    if (rewardIt && c.reward) this.h.reward?.(c.reward);
    return resolveLines({ id: node.id + '.reply', type: 'interlude', lines: c.reply }, this.h.ctx);
  }
  /** 本关羁绊给某武将的伤害 / 移速倍率。 */
  bondDamageMul(hero: CharacterId): number { let k = 1; for (const b of this.bonds) if (b.members.includes(hero)) k *= b.damageMul ?? 1; return k; }
  bondSpeedMul(hero: CharacterId): number { let k = 1; for (const b of this.bonds) if (b.members.includes(hero)) k *= b.speedMul ?? 1; return k; }
  bondCritBonus(hero: CharacterId): number { let k = 0; for (const b of this.bonds) if (b.members.includes(hero)) k += b.critBonus ?? 0; return k; }
}

// ———— 营中闲话（营寨 / 行军休整画面底部小对话条）————
/** 取一段没看过、条件满足的闲话（按章顺序）；没有返回 null。 */
export function nextCampTalk(chapters: readonly string[], ctx: StoryCtx): { node: StoryNode; lines: StoryLine[] } | null {
  if (!storyWanted('camp')) return null;
  for (const c of chapters) for (const node of STORY_CHAPTERS[c]?.camp ?? []) {
    if (storySeen(node.id)) continue;
    const lines = resolveLines(node, ctx); if (lines.length >= 2) return { node, lines };
  }
  return null;
}
/** 小对话条：一句一句自动换（2.8 秒），点一下换下一句，✕ 关掉；出现即记为已看。返回容器（没有闲话时 null）。 */
export function campTalkStrip(scene: Phaser.Scene, x: number, y: number, w: number, chapters: readonly string[], ctx: StoryCtx, depth = 40): Phaser.GameObjects.Container | null {
  const talk = nextCampTalk(chapters, ctx); if (!talk) return null;
  markStorySeen(talk.node.id);
  const root = scene.add.container(x, y).setDepth(depth).setScrollFactor(0).setName('camp-talk');
  const bg = scene.add.graphics(); bg.fillStyle(0x140c06, .82).fillRoundedRect(0, -18, w, 36, 8).lineStyle(1, 0xc9a35e, .55).strokeRoundedRect(0, -18, w, 36, 8);
  const who = scene.add.text(12, 0, '', { fontFamily: HEADING_FONT, fontSize: '14px', color: '#f0b48a', resolution: 2 }).setOrigin(0, .5);
  const say = scene.add.text(12, 0, '', { fontFamily: FONT, fontSize: '14px', color: '#eadcbd', resolution: 2 }).setOrigin(0, .5).setName('camp-talk-text');
  const close = scene.add.text(w - 10, 0, '✕', { fontFamily: FONT, fontSize: '14px', color: '#b9a57a', resolution: 2 }).setOrigin(1, .5).setInteractive({ useHandCursor: true }).setName('camp-talk-close');
  const hit = scene.add.rectangle(w / 2 - 14, 0, w - 28, 36, 0, 0).setInteractive({ useHandCursor: true }).setName('camp-talk-next');
  root.add([bg, hit, who, say, close]);
  let i = -1, timer: Phaser.Time.TimerEvent | undefined;
  const show = (): void => {
    i++; if (i >= talk.lines.length) { root.destroy(); return; }
    const l = talk.lines[i], s = speaker(l.who, ctx);
    who.setText(s.name ? s.name + '：' : ''); say.setX(12 + who.width + (s.name ? 4 : 0)).setText(l.text);
    const room = w - 40 - say.x; if (say.width > room) say.setScale(Math.max(.75, room / say.width)); else say.setScale(1);
    timer?.remove(); timer = scene.time.delayedCall(2800, show);
  };
  hit.on('pointerup', show); close.on('pointerup', () => root.destroy());
  root.once('destroy', () => timer?.remove());
  show();
  return root;
}
