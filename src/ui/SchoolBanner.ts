import Phaser from 'phaser';
import { FONT, DEPTH, GAME_HEIGHT, IS_DESKTOP as D } from '../config';
import { LQ } from './LacquerKit';
import { schoolHint } from '../systems/BattleSettings';

export type BannerKind = 'combo' | 'awaken';
interface Item { kind: BannerKind; title: string; sub: string; schools: string[] }

/** 小签的位置与时长（游戏坐标；电脑 960×540）。 */
export const SCHOOL_TOAST = {
  /** 电脑版：左上主将信息块右边、计时器下方那条空带（不压主将、首领血条、军令面板、舆图卷轴、台词卡、用药钮）。 */
  desk: { x: 226, y: 104 }, // 章节名下的目标行（y 78–96）之下
  h: 28, hAwaken: 34, seal: 20, sealAwaken: 26,
  inMs: 160, holdMs: 1100, holdAwakenMs: 1400, outMs: 240,
  /** 同一刻连着触发的合并成一张：收集窗口。 */
  mergeMs: 140,
} as const;
/** 小签左上角位置：布局（电脑 / 手机）在模块加载后才定下来，所以用时再算。 */
function toastPos(): { x: number; y: number } { return D ? SCHOOL_TOAST.desk : { x: 12, y: GAME_HEIGHT * .17 }; }

/**
 * 合击 / 觉醒提示（2026-11-19 用户「关于觉醒合击提示有点碍眼」：原为屏幕上方居中的大横幅 + 排队）。
 * 现在是左上角一张半透明漆底小签：流派徽印 +「合击 · 火借风势」，约 1.5 秒（觉醒约 1.8 秒，略大一号），不排队——
 * 同一刻连着触发的合成一张，新的一张直接顶掉旧的。
 * 提示档位（军中设置 · 战斗「合击觉醒提示」，im_school_hint）：
 *  - 简洁（缺省）：每关每个合击 / 觉醒只在第一次出小签，之后只让左侧增益栏对应流派徽印闪一下；
 *  - 完整：觉醒每次都出小签（合击仍只第一次）；
 *  - 关：只闪徽印。
 */
export class SchoolBanner {
  private readonly shown = new Set<string>();
  private pending: Item[] = []; private flushAt = -1;
  private live?: Phaser.GameObjects.Container;
  /** 测试用：出过的小签（标题）与闪徽印次数。 */
  readonly stats = { toasts: [] as string[], flashes: 0 };
  /**
   * live：现在能不能显示（暂停、三选一、构筑面板开着时先不显示，攒着等）；flash：让增益栏这些流派的徽印闪一下。
   */
  constructor(private readonly scene: Phaser.Scene, private readonly canShow: () => boolean = () => true, private readonly flash: (schools: string[]) => void = () => {}) {
    scene.events.once('shutdown', () => { this.pending.length = 0; });
  }

  show(kind: BannerKind, title: string, sub = '', schools: string[] = []): void {
    const key = kind + ':' + title, first = !this.shown.has(key), mode = schoolHint();
    this.shown.add(key);
    if (schools.length) { this.flash(schools); this.stats.flashes++; }
    if (mode === 'off' || (!first && !(mode === 'full' && kind === 'awaken'))) return;
    this.pending.push({ kind, title, sub, schools });
    if (this.flushAt < 0) { this.flushAt = 1; this.scene.time.delayedCall(SCHOOL_TOAST.mergeMs, () => this.flush()); }
  }

  private flush(): void {
    if (!this.pending.length) { this.flushAt = -1; return; }
    if (!this.canShow()) { this.scene.time.delayedCall(250, () => this.flush()); return; }
    const list = this.pending; this.pending = []; this.flushAt = -1;
    const awaken = list.some(i => i.kind === 'awaken'), lead = list.find(i => i.kind === 'awaken') ?? list[0];
    const title = list.length > 1 ? `${lead.title} 等 ${list.length} 项` : lead.title;
    const sub = list.length > 1 ? '' : lead.sub;
    const seals = [...new Set(list.flatMap(i => i.schools))].slice(0, 3);
    this.toast(awaken, title, sub, seals);
  }

  private toast(awaken: boolean, title: string, sub: string, seals: string[]): void {
    const s = this.scene, T = SCHOOL_TOAST, h = awaken ? T.hAwaken : T.h, ss = awaken ? T.sealAwaken : T.seal;
    this.live?.destroy();
    const P = toastPos(), root = s.add.container(P.x - 10, P.y).setScrollFactor(0).setDepth(DEPTH.hud + 6).setAlpha(0).setName('school-banner');
    root.setData('kind', awaken ? 'awaken' : 'combo');
    const g = s.add.graphics();
    let x = 8;
    const icons: Phaser.GameObjects.Image[] = [];
    for (const id of seals) { const key = 'build_icon_school_' + id; if (!s.textures.exists(key)) continue; const im = s.add.image(x + ss / 2, h / 2, key).setDisplaySize(ss, ss); icons.push(im); x += ss - 4; }
    if (icons.length) x += 8;
    const t = s.add.text(x, h / 2, title, { fontFamily: FONT, fontSize: awaken ? (D ? '16px' : '15px') : (D ? '14px' : '13px'), color: awaken ? '#ffe2a0' : LQ.title, fontStyle: 'bold', stroke: '#1a0f08', strokeThickness: 3, resolution: 2 }).setOrigin(0, .5).setName('school-banner-title');
    x += t.width;
    let st: Phaser.GameObjects.Text | null = null;
    if (sub) { st = s.add.text(x + 8, h / 2 + 1, sub, { fontFamily: FONT, fontSize: '11px', color: '#c8b88f', stroke: '#1a0f08', strokeThickness: 2, resolution: 2 }).setOrigin(0, .5).setName('school-banner-sub'); x += 8 + st.width; }
    const w = x + 12;
    // 半透明漆底 + 细描金边；觉醒左端一道朱砂
    g.fillStyle(LQ.lacquer, .68).fillRoundedRect(0, 0, w, h, 6).lineStyle(1, LQ.gold, .8).strokeRoundedRect(.5, .5, w - 1, h - 1, 6);
    if (awaken) g.fillStyle(LQ.cinnabar, .9).fillRect(2, 5, 3, h - 10);
    root.add([g, ...icons, t, ...(st ? [st] : [])]);
    this.live = root; this.stats.toasts.push(title);
    // 显示中途打开了面板：先藏起来（面板关了再露出来）
    const sync = (): void => { root.setVisible(this.canShow()); }; s.events.on('update', sync);
    root.once('destroy', () => { s.events.off('update', sync); if (this.live === root) this.live = undefined; });
    s.tweens.add({ targets: root, x: P.x, alpha: 1, duration: T.inMs, ease: 'Cubic.easeOut' });
    s.tweens.add({ targets: root, alpha: 0, delay: T.inMs + (awaken ? T.holdAwakenMs : T.holdMs), duration: T.outMs, onComplete: () => root.destroy() });
  }
}
