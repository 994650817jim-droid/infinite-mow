import Phaser from 'phaser';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, IS_DESKTOP, TITLE_FONT } from '../config';
import { CHAPTER_REGIONS, CHAPTER_TIMELINE, chapterStagesDone, chapterState, currentChapter, type ChapterState, type TimelineChapterId } from '../world/ChapterTimeline';
import { MAP_W } from '../world/WorldCities';
import { loadWorld } from '../world/WorldStore';
import { isChapterTestRun } from '../systems/ChapterProgress';
import { bagArt, loadBagArt } from './ItemQuality';
import { homeCommand } from './HomeCommand';
import { uiSfx } from '../systems/Sfx';

/**
 * 章节选择（2026-11-17 用户：「点击匡扶汉室，可以进入章节选择，但是之前没打过就只能选择打到哪个章节」）。
 * 十二章卷宗一字排开（电脑 6×2）：每张卡是天下地图上该章所在地域的一角（现有厚涂地图），朱印章序 + 章名 + 三关进度。
 * 已打到的章节可点（点卡 = 打下一关；点下面的关点 = 指定关）；没打到的只露章序与锁，地图暗下去。
 * 进度按存档（与天下地图同一套 chapterState）；测试模式（?dev=1）全部开放。不画像素、不用程序特效。
 */
export interface ChapterSelectOptions {
  /** 选中一章；stage 为玩家点的关（不点则由调用方决定打哪关）。 */
  onPick: (id: TimelineChapterId, stage?: number) => void;
  onClose?: () => void;
}

const MAP_KEY = 'strategy_art', MAP_URL = 'assets/world/strategy-map.webp';

export class ChapterSelect {
  readonly root: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Container;
  private loading = false;
  private readonly keys: Array<[string, () => void]> = [];

  constructor(private readonly scene: Phaser.Scene, private readonly o: ChapterSelectOptions) {
    this.root = scene.add.container(0, 0).setDepth(DEPTH.overlay + 30).setScrollFactor(0).setName('chapter-select');
    this.ensureArt();
    this.render();
    const kb = scene.input.keyboard;
    const enter = (): void => { const cur = this.current(); if (cur) this.pick(cur); }, esc = (): void => this.close();
    this.keys.push(['keydown-ENTER', enter], ['keydown-ESC', esc]);
    for (const [k, fn] of this.keys) kb?.on(k, fn);
    this.root.once('destroy', () => { for (const [k, fn] of this.keys) kb?.off(k, fn); });
  }

  close(): void { if (!this.root.active) return; this.root.destroy(); this.o.onClose?.(); }

  private ensureArt(): void {
    const sc = this.scene, bagReady = loadBagArt(sc, () => undefined), mapReady = sc.textures.exists(MAP_KEY);
    if (bagReady && mapReady) return;
    if (!mapReady) sc.load.image(MAP_KEY, MAP_URL);
    this.loading = true;
    sc.load.once(Phaser.Loader.Events.COMPLETE, () => { this.loading = false; if (this.root.active) this.render(); });
    sc.load.start();
  }

  private state(id: TimelineChapterId): ChapterState { return isChapterTestRun() && chapterState(id, loadWorld()) === 'locked' ? 'open' : chapterState(id, loadWorld()); }
  /** 当前最该打的一章（Enter 直接进）。 */
  private current(): TimelineChapterId | null { const c = currentChapter(loadWorld()); return this.state(c.id) === 'locked' ? null : c.id; }
  private pick(id: TimelineChapterId, stage?: number): void {
    if (this.state(id) === 'locked') return;
    try { const s = uiSfx(); s.unlock(); s.play('uiClick'); } catch { /* 音效不可用 */ }
    this.root.destroy(); this.o.onPick(id, stage);
  }

  private add<T extends Phaser.GameObjects.GameObject & { setScrollFactor: (x: number) => unknown }>(o: T): T { o.setScrollFactor(0); this.body.add(o); return o; }
  private text(x: number, y: number, v: string, size: number, color: string, font = FONT): Phaser.GameObjects.Text {
    return this.add(this.scene.add.text(x, y, v, { fontFamily: font, fontSize: size + 'px', color, resolution: 2 }));
  }

  render(): void {
    this.body?.destroy();
    this.body = this.scene.add.container(0, 0).setScrollFactor(0); this.root.add(this.body);
    const sc = this.scene, W = GAME_WIDTH, H = GAME_HEIGHT, D = IS_DESKTOP;
    // 底：压暗 + 漆木大底（行囊同一张 panel_bg；缺图时暗底）
    this.add(sc.add.rectangle(0, 0, W, H, 0x0b0805, .9).setOrigin(0).setInteractive()).on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => e?.stopPropagation?.());
    const panel = bagArt(sc, 'panel_bg'); if (panel) this.add(sc.add.image(W / 2, H / 2, panel).setDisplaySize(W, H));
    // 标题：只有「章节」两个字 + 当前进度的章序
    this.text(W / 2, D ? 40 : 62, '择 章', D ? 34 : 38, '#efd399', TITLE_FONT).setOrigin(.5).setLetterSpacing(14).setShadow(0, 3, '#130a05', 2, true, true);
    const back = homeCommand(sc, D ? W - 128 : W - 92, D ? 40 : 62, D ? 132 : 140, D ? 40 : 48, '返回');
    // homeCommand 直接加到场景：收进本面板（跟着面板的层级与销毁）
    for (const o of [back.g, back.caption, back.hit]) { (o as unknown as { setScrollFactor: (n: number) => void }).setScrollFactor(0); this.body.add(o); }
    back.hit.setName('chapter-select-back').on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => { e?.stopPropagation?.(); this.close(); });

    const cols = D ? 6 : 3, gap = D ? 12 : 10, cw = D ? 138 : (W - 40 - (cols - 1) * gap) / cols, ch = D ? 196 : 188;
    const rows = Math.ceil(CHAPTER_TIMELINE.length / cols), x0 = (W - (cols * cw + (cols - 1) * gap)) / 2, y0 = D ? 78 : 112;
    const save = loadWorld(), cur = this.current();
    CHAPTER_TIMELINE.forEach((c, i) => {
      const x = x0 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + (D ? 14 : 12)), st = this.state(c.id), locked = st === 'locked';
      this.card(x, y, cw, ch, c.id, c.numeral, c.title, st, locked ? 0 : chapterStagesDone(c.id, save), c.id === cur);
    });
    void rows;
    if (this.loading && !sc.textures.exists(MAP_KEY)) this.text(W / 2, H - 22, '地图加载中…', 12, '#8f8070').setOrigin(.5);
  }

  /** 一张章节卡：漆金卡底 + 地图一角 + 朱印章序 + 章名 + 三关点。 */
  private card(x: number, y: number, w: number, h: number, id: TimelineChapterId, numeral: string, title: string, st: ChapterState, done: number, current: boolean): void {
    const sc = this.scene, locked = st === 'locked', cleared = st === 'cleared', D = IS_DESKTOP;
    const lift = sc.add.container(x, y).setScrollFactor(0); this.body.add(lift);
    const put = <T extends Phaser.GameObjects.GameObject & { setScrollFactor: (x: number) => unknown }>(o: T): T => { o.setScrollFactor(0); lift.add(o); return o; };
    // 当前章：外圈金光
    const glow = put(sc.add.graphics());
    if (current) for (let k = 0; k < 8; k++) glow.lineStyle(2, 0xf3d48a, .22 - k * .025).strokeRoundedRect(-3 - k, -3 - k, w + 6 + k * 2, h + 6 + k * 2, 8 + k);
    const card = bagArt(sc, 'tooltip_card');
    if (card) put(sc.add.nineslice(0, 0, card, undefined, w * 2, h * 2, 40, 40, 40, 40).setOrigin(0).setScale(.5)).setAlpha(locked ? .75 : 1);
    else put(sc.add.graphics()).fillStyle(0x1b110a, .97).fillRoundedRect(0, 0, w, h, 6).lineStyle(2, 0xc08a3e, 1).strokeRoundedRect(1, 1, w - 2, h - 2, 6);
    // 地图一角（该章地域）
    const mx = 9, my = 9, mw = w - 18, mh = Math.round(h * .58);
    if (sc.textures.exists(MAP_KEY)) {
      const tex = sc.textures.get(MAP_KEY).getSourceImage() as HTMLImageElement, k = tex.width / MAP_W, r = CHAPTER_REGIONS[id][0];
      const spanX = 330 * k, spanY = spanX * mh / mw, cx = Phaser.Math.Clamp(r.x * k - spanX / 2, 0, tex.width - spanX), cy = Phaser.Math.Clamp(r.y * k - spanY / 2, 0, tex.height - spanY), s = mw / spanX;
      const img = put(sc.add.image(mx - cx * s, my - cy * s, MAP_KEY).setOrigin(0).setScale(s).setCrop(cx, cy, spanX, spanY));
      if (locked) img.setTint(0x4a4038).setAlpha(.55); else if (!current && !cleared) img.setAlpha(.92);
    } else put(sc.add.rectangle(mx, my, mw, mh, locked ? 0x221a14 : 0x3a2c1c).setOrigin(0));
    const vg = put(sc.add.graphics());
    for (let k = 0; k < 6; k++) vg.lineStyle(3, 0x120b06, .12 + k * .03).strokeRect(mx + k * 2, my + k * 2, mw - k * 4, mh - k * 4);
    vg.lineStyle(1, locked ? 0x5a4c38 : 0xb08a4e, 1).strokeRect(mx - .5, my - .5, mw + 1, mh + 1);
    // 朱印章序（左上）
    const sealW = numeral.length > 1 ? 34 : 26, seal = put(sc.add.graphics());
    seal.fillStyle(locked ? 0x5a4a3c : 0x9a2a1c, 1).fillRoundedRect(mx + 6, my + 6, sealW, 26, 3).lineStyle(1, locked ? 0x8a7a66 : 0xe0a868, .9).strokeRoundedRect(mx + 8, my + 8, sealW - 4, 22, 2);
    put(sc.add.text(mx + 6 + sealW / 2, my + 19, numeral, { fontFamily: TITLE_FONT, fontSize: (numeral.length > 1 ? 14 : 17) + 'px', color: locked ? '#c9bba6' : '#ffe6b0', resolution: 2 }).setOrigin(.5));
    if (locked) {
      // 未解锁：只有章序 + 锁
      const lk = bagArt(sc, 'lock_tag');
      if (lk) put(sc.add.image(w / 2, my + mh / 2 + 4, lk).setDisplaySize(40, 40).setAlpha(.9));
      else put(sc.add.text(w / 2, my + mh / 2, '锁', { fontFamily: TITLE_FONT, fontSize: '26px', color: '#8a7a66', resolution: 2 }).setOrigin(.5));
      put(sc.add.text(w / 2, my + mh + (h - my - mh) / 2, '未 解 锁', { fontFamily: FONT, fontSize: '12px', color: '#7d6e5a', resolution: 2 }).setOrigin(.5));
    } else {
      put(sc.add.text(w / 2, my + mh + 20, title, { fontFamily: TITLE_FONT, fontSize: (title.length > 4 ? 17 : 20) + 'px', color: current ? '#ffe0a0' : '#f0dcb0', resolution: 2 }).setOrigin(.5).setShadow(0, 2, '#0b0604', 3, true, true));
      // 三关点：实心 = 已打下，点一下打那一关（未开放的关不可点）
      const py = my + mh + 46;
      for (let k = 0; k < 3; k++) {
        const px = w / 2 + (k - 1) * 26, ok = k < done, open = isChapterTestRun() || k <= done;
        const dot = put(sc.add.graphics());
        dot.fillStyle(ok ? 0xe0b860 : open ? 0x3a2a1a : 0x1e160e, 1).fillPoints([{ x: px, y: py - 7 }, { x: px + 7, y: py }, { x: px, y: py + 7 }, { x: px - 7, y: py }], true)
          .lineStyle(1, open ? 0xd8b06a : 0x5a4c38, 1).strokePoints([{ x: px, y: py - 7 }, { x: px + 7, y: py }, { x: px, y: py + 7 }, { x: px - 7, y: py }], true, true);
        if (open) {
          const hit = put(sc.add.circle(px, py, 11, 0, .001)).setName(`chapter-stage-${id}-${k + 1}`).setInteractive({ useHandCursor: true });
          hit.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => { e?.stopPropagation?.(); this.pick(id, k + 1); });
        }
      }
      if (cleared) put(sc.add.text(w - mx - 6, my + 8, '✓', { fontFamily: FONT, fontSize: '16px', color: '#ffe0a0', resolution: 2 }).setOrigin(1, 0).setShadow(0, 1, '#000', 3, true, true));
    }
    // 命中区（整张卡）；锁住的仍可悬停但点了无反应
    const hit = put(sc.add.rectangle(0, 0, w, h, 0, .001).setOrigin(0)).setName('chapter-card-' + id).setData('locked', locked);
    lift.sendToBack(glow);
    if (!locked) {
      hit.setInteractive({ useHandCursor: true });
      if (current) hit.setData('padDefault', true); // 手柄：打开时焦点在当前章，Ⓐ 直接进
      lift.bringToTop(hit); for (const o of lift.list) if ((o as Phaser.GameObjects.GameObject).name?.startsWith('chapter-stage-')) lift.bringToTop(o as Phaser.GameObjects.GameObject);
      hit.on('pointerover', () => lift.setY(y - 4)).on('pointerout', () => lift.setY(y))
        .on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => { e?.stopPropagation?.(); this.pick(id); });
    }
    void D;
  }
}

export function openChapterSelect(scene: Phaser.Scene, o: ChapterSelectOptions): ChapterSelect { return new ChapterSelect(scene, o); }

/** 第三章起各章的选关场景（与天下地图 CAMPAIGNS 一致）；第一、二章由主页直接出征。 */
export const CHAPTER_SCENES: Partial<Record<TimelineChapterId, string>> = {
  qunxiong: 'ThirdChapterScene', guandu: 'GuanduChapterScene', chibi: 'ChibiChapterScene', jingnan: 'JingnanChapterScene', shu: 'ShuChapterScene',
  hanzhong: 'HanzhongChapterScene', xiangfan: 'XiangfanChapterScene', yiling: 'YilingChapterScene', nanzheng: 'NanzhengChapterScene', beifa: 'BeifaChapterScene',
};
