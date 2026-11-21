import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, HEADING_FONT, FONT } from '../config';
import { LQ, lqDiamond } from './LacquerKit';
import { factionOf, titleOf } from './StoryBarkCardStyles';
import { STORY_CAST } from '../data/story/types';
import { playIn } from '../systems/Sfx';

/**
 * 首领血条（2026-11-20 用户「还有ui boss血条优化一下」；风格同左上主将状态框 HeroStatusFrame：漆底金边、铜框朱红）。
 * 2026-11-20 用户「不要拿框住」：不要漆底面板 / 外框，血条、头像圆、名字、称号印直接浮在战场上（文字描边 + 投影、血条细铜边 + 底下一道淡影保证可读）。
 * 位置：屏幕下方居中——顶部已经有战况进度线、计时、关名与首领招式字幕，吕布等的出场墨幅也在上半屏，下方中间是空的。
 * 单首领：左边圆形首领头像（水墨立绘 assets/ink-cast/<id>.webp 取头肩，金圈；没有立绘时画阵营印字）、名字（大字）+ 朱砂称号印（「天公将军」）、右上百分比；
 *   血条：铜框朱红，受击米白残血拖尾（场景的 BossStagger.trailRatio，顿帧时也按真实时间走），半血处一道金色阶段刻度（越过时闪一下），低于 25% 外框朱红脉动；
 *   血条下一道细金色「破势」条（破势值涨满时整条亮起、写「破势」）；护盾为血条底部一道青线；状态说明（场景的 bossEnergy 文字）在框下右侧。
 * 双首领：两块紧凑框并排（DualBoss.drawHud 调 drawDualPanel / dualPortrait）。
 * 动画：首领登场 / 换人时框从中间向两边展开；授首时血条从中间裂开、两半向外滑开并淡出。
 * 场景每帧调用 update（不受 HUD 10 Hz 节流）。名字 / 百分比 / 状态用场景的 hudTexts.boss / bossHp / bossEnergy（测试与各关子类沿用）。
 */
export const BOSS_HUD = {
  w: 480, h: 56, bottom: 30, r: 26, barX: 66, barR: 16, hpY: 27, hpH: 13, stY: 45, stH: 4,
  openMs: 420, dieMs: 800, phaseFlashMs: 650, breakMs: 1100, low: .25, phaseAt: .5,
  /** 双首领：每块的宽、两块间距、头像半径。 */
  dual: { r: 19, barX: 46, hpH: 10 },
} as const;

export interface BossView {
  /** 首领 id（头像 / 称号用，如 zhangjiao）；name 为显示名。 */
  id: string; name: string; ratio: number; trail: number;
  /** 破势值 0–1；breaks = 已破势次数（变多时亮一下）。不给则不画破势条。 */
  stagger?: number; breaks?: number;
  /** 护盾 0–1。 */
  shield?: number;
}

interface Rect { x: number; y: number; w: number; h: number }

export class BossHud {
  readonly g: Phaser.GameObjects.Graphics;
  private readonly seal: Phaser.GameObjects.Text;
  private readonly breakT: Phaser.GameObjects.Text;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly dualImgs: Phaser.GameObjects.Image[] = [];
  private key = ''; private openAt = -1e9; private dieAt = -1e9; private last: (BossView & { title: string }) | null = null;
  private lastRatio = 1; private phaseAt = -1e9; private breakAt = -1e9; private lastBreaks = 0;
  private visible = true; private mode: 'single' | 'dual' | 'none' = 'none'; private dualNames: string[] = [];
  /** 测试用。 */
  readonly stats = { phaseFlashes: 0, breakFlashes: 0, opens: 0, deaths: 0 };

  constructor(private readonly scene: Phaser.Scene, private readonly depth: number, private readonly texts: { name: Phaser.GameObjects.Text; pct: Phaser.GameObjects.Text; status: Phaser.GameObjects.Text }) {
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(depth).setName('boss-hud');
    this.seal = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', color: '#fff1d0', fontStyle: 'bold', resolution: 2 }).setOrigin(.5).setScrollFactor(0).setDepth(depth + .3).setName('boss-hud-title').setVisible(false);
    this.breakT = scene.add.text(0, 0, '破势', { fontFamily: HEADING_FONT, fontSize: '13px', color: '#fff2c4', resolution: 2 }).setStroke('#5a1a08', 3).setOrigin(.5).setScrollFactor(0).setDepth(depth + .4).setName('boss-hud-break').setVisible(false);
    this.portrait = scene.add.image(0, 0, '__DEFAULT').setScrollFactor(0).setDepth(depth + .2).setName('boss-hud-portrait').setVisible(false);
    texts.name.setDepth(depth + .3); texts.pct.setDepth(depth + .3); texts.status.setDepth(depth + .3);
  }

  /** 单首领框的矩形（测试 / 防重叠用）。 */
  rect(): Rect { const B = BOSS_HUD; return { x: (GAME_WIDTH - B.w) / 2, y: GAME_HEIGHT - B.bottom - B.h, w: B.w, h: B.h }; }

  setVisible(v: boolean): void {
    this.visible = v;
    if (!v) { this.g.clear(); for (const o of [this.seal, this.breakT, this.portrait, ...this.dualImgs]) o.setVisible(false); }
  }

  /** 首领头像贴图：有水墨立绘用立绘，没有就用首领本人的贴图裁头肩（fallbackMedal）；都没有返回 null（画阵营色圈）。 */
  private medal(id: string): string | null { return this.inkMedal(id) ?? this.fallbackMedal(id); }
  /** 其他界面（劝降面板）借用同一套圆形头像：返回贴图键，立绘还在加载时返回 null。 */
  medalKey(id: string, fallbackTex?: string): string | null { if (fallbackTex) this.setFallback(id, fallbackTex); return this.medal(id); }
  private readonly fallbackTex = new Map<string, string>();
  /** 记下首领本人的贴图（update 传入的 tex），没有水墨立绘时拿来当头像。 */
  setFallback(id: string, tex: string | undefined): void { if (id && tex && this.scene.textures.exists(tex)) this.fallbackTex.set(id, tex); }
  /**
   * 没有水墨立绘的首领（2026-11-20 第 7–12 章检查：第七章起的首领头像圈都是空的）：取首领行走图第一帧，裁上半身中间的正方形（头肩），
   * 同样的圆形裁切、暗底与下缘阴影；之后立绘若载到，medal() 先返回立绘。
   */
  private fallbackMedal(id: string): string | null {
    const tex = this.fallbackTex.get(id), key = 'bosshud_medal_fb_' + id, s = this.scene; if (!tex || !s.textures.exists(tex)) return null;
    if (s.textures.exists(key)) return key;
    const T = s.textures.get(tex), names = T.getFrameNames(), fr = T.get(names.includes('0') ? '0' : names[0] ?? '__BASE'), img = fr.source.image as HTMLImageElement | HTMLCanvasElement;
    const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const ctx = c.getContext('2d')!; ctx.save(); ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.clip();
    const bg = ctx.createRadialGradient(S * .5, S * .42, S * .05, S * .5, S * .5, S * .62); bg.addColorStop(0, '#5a4630'); bg.addColorStop(.55, '#2a1c10'); bg.addColorStop(1, '#0b0705'); ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
    // 行走图一格里人物大约占中间六成、头在上方 15–40%：取格宽 44% 的正方形，从格高 10% 处起
    const side = Math.min(fr.cutWidth * .44, fr.cutHeight * .44), sx = fr.cutX + fr.cutWidth * .5 - side / 2, sy = fr.cutY + fr.cutHeight * .1;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, sx, sy, side, side, 0, 0, S, S);
    const sh = ctx.createLinearGradient(0, S * .7, 0, S); sh.addColorStop(0, 'rgba(10,6,4,0)'); sh.addColorStop(1, 'rgba(10,6,4,.5)'); ctx.fillStyle = sh; ctx.fillRect(0, 0, S, S);
    ctx.restore(); s.textures.addCanvas(key, c); s.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    return key;
  }
  /** 水墨立绘头像（按需加载、裁成圆形头肩）；还没好 / 没有返回 null。 */
  private inkMedal(id: string): string | null {
    const s = this.scene, key = 'bosshud_medal_' + id, src = 'ink_cast_' + id;
    if (s.textures.exists(key)) return key;
    if (!s.textures.exists(src)) {
      // 只载剧情人物表里登记过水墨立绘的（攻城 / 守城的通用首领 id 'siege' 等没有图：原来每场都去请求 ink_cast_siege，控制台报错、头像圈空着；2026-11-20 守城排查）
      if (!/^[a-z]+$/.test(id) || STORY_CAST[id]?.portrait !== src || s.registry.get('bosshud_try_' + id)) return null;
      s.registry.set('bosshud_try_' + id, true);
      s.load.image(src, 'assets/ink-cast/' + id + '.webp'); s.load.start();
      return null;
    }
    const img = s.textures.get(src).getSourceImage() as HTMLImageElement, S = 128, c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d')!; ctx.save(); ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.clip();
    const bg = ctx.createRadialGradient(S * .5, S * .42, S * .05, S * .5, S * .5, S * .62); bg.addColorStop(0, '#5a4630'); bg.addColorStop(.55, '#2a1c10'); bg.addColorStop(1, '#0b0705');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
    // 水墨立绘：头在上方中间；取宽 46% 的正方形、顶上留一点
    const side = Math.min(img.width * .46, img.height * .4), sx = img.width * .5 - side / 2, sy = img.height * .02;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, sx, sy, side, side, 0, 0, S, S);
    const sh = ctx.createLinearGradient(0, S * .7, 0, S); sh.addColorStop(0, 'rgba(10,6,4,0)'); sh.addColorStop(1, 'rgba(10,6,4,.5)'); ctx.fillStyle = sh; ctx.fillRect(0, 0, S, S);
    ctx.restore();
    s.textures.addCanvas(key, c); s.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    return key;
  }

  /** 圆形头像 + 金圈（没有立绘时画阵营印字）。 */
  private drawMedal(img: Phaser.GameObjects.Image, id: string, cx: number, cy: number, r: number, a: number, k = 1): void {
    const g = this.g, key = this.medal(id), rr = r * k;
    g.fillStyle(0x000000, .35 * a).fillCircle(cx + 2, cy + 3, rr + 3);
    g.fillStyle(0x0d0806, a).fillCircle(cx, cy, rr + 1);
    if (key) img.setTexture(key).setPosition(cx, cy).setDisplaySize(rr * 2, rr * 2).setAlpha(a).setVisible(a > .02 && rr > 2);
    else {
      img.setVisible(false); const f = factionOf(id, false);
      g.fillStyle(f.color, .55 * a).fillCircle(cx, cy, rr * .8);
    }
    g.lineStyle(3, LQ.gold, a).strokeCircle(cx, cy, rr + 1.5).lineStyle(1, LQ.goldHi, .8 * a).strokeCircle(cx, cy, rr + 3.5);
  }

  /** 铜框朱红血条（单 / 双首领共用）。 */
  private hpBar(x: number, y: number, w: number, h: number, ratio: number, trail: number, a: number, fill = 0xa82e1c): void {
    const g = this.g;
    g.fillStyle(0x000000, .32 * a).fillRoundedRect(x - 1, y + 2, w + 4, h + 4, 4);
    g.fillStyle(0x2a1a0e, a).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 3).lineStyle(1.2, LQ.gold, .95 * a).strokeRoundedRect(x - 2.5, y - 2.5, w + 5, h + 5, 3);
    g.fillStyle(0x140806, a).fillRect(x, y, w, h);
    if (trail > ratio) g.fillStyle(0xf6ead0, .9 * a).fillRect(x + w * ratio, y, w * (trail - ratio), h).fillStyle(0xffffff, .5 * a).fillRect(x + w * ratio, y, w * (trail - ratio), 2);
    if (ratio > 0) {
      g.fillStyle(fill, a).fillRect(x, y, w * ratio, h);
      g.fillStyle(0xe2643f, .55 * a).fillRect(x, y + 1, w * ratio, Math.max(2, h * .3));
      g.fillStyle(0x5a120a, .55 * a).fillRect(x, y + h - 3, w * ratio, 3);
    }
    g.lineStyle(1, 0x000000, .22 * a); for (const k of [.25, .75]) g.lineBetween(x + w * k, y + 2, x + w * k, y + h - 2);
  }

  /** 重新播放登场展开（测试用）。 */
  replayEnter(): void { this.openAt = performance.now(); this.stats.opens++; }

  /** 每帧：v = 当前首领（null 表示没有）；dualActive 时由 DualBoss 画，这里只收起单首领部件。 */
  update(v: BossView | null, now: number, dualActive = false): void {
    const B = BOSS_HUD, T = this.texts, g = this.g;
    if (dualActive) { this.mode = 'dual'; this.seal.setVisible(false); this.breakT.setVisible(false); this.portrait.setVisible(false); this.key = ''; this.last = null; return; }
    for (const im of this.dualImgs) im.setVisible(false);
    g.clear();
    if (!this.visible) return;
    const key = v ? v.id + ':' + v.name : '';
    if (key !== this.key) {
      if (!v && this.last) { this.dieAt = now; this.stats.deaths++; playIn(this.scene, 'bossbar_shatter'); }
      if (v) { this.openAt = now; this.stats.opens++; playIn(this.scene, 'bossbar_open'); this.lastRatio = v.ratio; this.lastBreaks = v.breaks ?? 0; }
      this.key = key;
    }
    const R = this.rect(), x0 = R.x, y0 = R.y;
    if (!v) {
      this.mode = 'none';
      for (const t of [T.name, T.pct, T.status]) t.setVisible(false);
      this.seal.setVisible(false); this.breakT.setVisible(false);
      const t = (now - this.dieAt) / B.dieMs, L = this.last;
      if (!L || t >= 1) { this.portrait.setVisible(false); this.last = null; return; }
      // 授首：血条从中间裂开，两半向外滑开、淡出；头像跟着淡出
      const a = 1 - t, e = Phaser.Math.Easing.Cubic.Out(t), off = 34 * e, bx = x0 + B.barX, bw = R.w - B.barX - 14, by = y0 + B.hpY, half = bw / 2;
      this.hpBar(bx - off, by + 6 * e, half - 3, B.hpH, 0, 1 - t * .6, a);
      this.hpBar(bx + half + 3 + off, by - 4 * e, half - 3, B.hpH, 0, 1 - t * .6, a);
      this.drawMedal(this.portrait, L.id, x0 + 30, y0 + R.h / 2, B.r, a);
      return;
    }
    this.mode = 'single';
    const title = titleOf(v.id); this.last = { ...v, title };
    const ko = Phaser.Math.Easing.Cubic.Out(Phaser.Math.Clamp((now - this.openAt) / B.openMs, 0, 1)), ta = Phaser.Math.Clamp((ko - .55) / .45, 0, 1);
    // 半血阶段刻度：越过时闪一下；破势：次数变多时亮起
    if (this.lastRatio > B.phaseAt && v.ratio <= B.phaseAt && v.ratio > 0) { this.phaseAt = now; this.stats.phaseFlashes++; }
    this.lastRatio = v.ratio;
    if ((v.breaks ?? 0) > this.lastBreaks) { this.breakAt = now; this.stats.breakFlashes++; }
    this.lastBreaks = v.breaks ?? 0;
    // 框：从中间向两边展开
    this.drawMedal(this.portrait, v.id, x0 + 30, y0 + R.h / 2, B.r, ta, .4 + .6 * ko);
    const bx = x0 + B.barX, bw = R.w - B.barX - 14, by = y0 + B.hpY;
    // 名字 · 称号印 · 百分比
    T.name.setVisible(true).setAlpha(ta).setOrigin(0, 0).setPosition(bx, y0 + 4).setFontFamily(HEADING_FONT).setFontSize(18).setColor(LQ.title).setStroke('#140c06', 4).setShadow(1, 2, '#000000', 3, true, true);
    if (title) {
      if (this.seal.text !== title) this.seal.setText(title);
      const sx = bx + T.name.width + 8, sw = this.seal.width + 10, sh = 17, sy = y0 + 6;
      this.seal.setVisible(ta > .02).setAlpha(ta).setPosition(sx + sw / 2, sy + sh / 2);
      g.fillStyle(0x000000, .3 * ta).fillRoundedRect(sx + 1, sy + 1, sw, sh, 3).fillStyle(LQ.cinnabar, ta).fillRoundedRect(sx, sy, sw, sh, 3).lineStyle(1, LQ.goldHi, .9 * ta).strokeRoundedRect(sx + 1.5, sy + 1.5, sw - 3, sh - 3, 2);
    } else this.seal.setVisible(false);
    T.pct.setVisible(true).setAlpha(ta).setOrigin(1, 0).setPosition(x0 + R.w - 14, y0 + 8).setFontSize(13).setColor('#f5e6c8').setStroke('#140c06', 4).setShadow(1, 2, '#000000', 3, true, true);
    T.status.setVisible(T.status.text !== '' && T.status.visible).setAlpha(ta).setOrigin(1, 0).setPosition(x0 + R.w - 10, y0 + R.h + 3).setColor('#e6cf9a').setStroke('#140c06', 4).setShadow(1, 2, '#000000', 3, true, true);
    if (ko <= 0) return;
    // 血条（登场时从中间向两边展开）
    const low = v.ratio > 0 && v.ratio < B.low, ow = bw * ko, ox = bx + (bw - ow) / 2;
    this.hpBar(ox, by, ow, B.hpH, v.ratio, v.trail, Math.min(1, ko * 1.6));
    if (ta <= 0) return;
    if (v.shield && v.shield > 0) g.fillStyle(0x66d9ff, .95 * ta).fillRect(bx, by + B.hpH - 3, bw * Math.min(1, v.shield), 3);
    // 半血阶段刻度（金色小菱 + 竖线）；越过时放大发光
    const tx = bx + bw * B.phaseAt, pf = (now - this.phaseAt) / B.phaseFlashMs, flashing = pf >= 0 && pf < 1;
    g.lineStyle(1.5, v.ratio > B.phaseAt ? LQ.goldHi : 0x8a6a3a, ta).lineBetween(tx, by - 1, tx, by + B.hpH + 1);
    g.fillStyle(v.ratio > B.phaseAt ? LQ.goldHi : 0x8a6a3a, ta); lqDiamond(g, tx, by - 3, flashing ? 4 + 5 * (1 - pf) : 3.5);
    if (flashing) { const e = 1 - pf; g.fillStyle(0xfff3c8, .55 * e * ta).fillRect(bx, by, bw * Math.max(v.trail, v.ratio), B.hpH); g.lineStyle(2, 0xffe08a, .9 * e * ta).strokeRoundedRect(bx - 4, by - 4, bw + 8, B.hpH + 8, 4); }
    if (low) { const a = .35 + .3 * Math.sin(now / 150); g.lineStyle(2, 0xff5a3a, a * ta).strokeRoundedRect(bx - 4.5, by - 4.5, bw + 9, B.hpH + 9, 4); }
    // 破势条：细金条；涨到八成后发亮；破势时整条亮起、写「破势」
    const bk = (now - this.breakAt) / B.breakMs, breaking = bk >= 0 && bk < 1;
    if (v.stagger !== undefined) {
      const sy = y0 + B.stY, st = Phaser.Math.Clamp(v.stagger, 0, 1);
      g.fillStyle(0x140d06, ta).fillRect(bx, sy, bw, B.stH).lineStyle(1, 0x7a5a2c, .9 * ta).strokeRect(bx - .5, sy - .5, bw + 1, B.stH + 1);
      if (breaking) {
        const e = 1 - bk, blink = .65 + .35 * Math.sin(now / 45);
        g.fillStyle(0xfff0b0, (.5 + .5 * e) * blink * ta).fillRect(bx, sy, bw, B.stH).lineStyle(1.5, 0xffe08a, e * ta).strokeRect(bx - 2, sy - 2, bw + 4, B.stH + 4);
        this.breakT.setVisible(true).setAlpha(Math.min(1, e * 2) * ta).setPosition(bx + bw / 2, sy + 1).setScale(1 + .25 * Math.max(0, 1 - bk * 4));
      } else {
        this.breakT.setVisible(false);
        if (st > 0) { const hot = st >= .8, pulse = hot ? .75 + .25 * Math.sin(now / 90) : 1; g.fillStyle(hot ? 0xf3cf6a : 0xc9a24a, pulse * ta).fillRect(bx, sy, bw * st, B.stH).fillStyle(0xfff0b8, .5 * ta).fillRect(bx, sy, bw * st, 1.2); }
      }
    } else this.breakT.setVisible(false);
  }

  /** 双首领：一块紧凑框（DualBoss.drawHud 调）。i = 第几位（头像图片槽）。 */
  drawDualPanel(i: number, o: { id: string; x: number; y: number; w: number; ratio: number; trail: number; a: number; done: boolean; fill: number; rage: boolean; ring: number }, now: number): { barX: number; barY: number; barW: number } {
    const D = BOSS_HUD.dual, h = 44, g = this.g;
    if (i === 0) { g.clear(); this.dualNames = []; }
    while (this.dualImgs.length <= i) this.dualImgs.push(this.scene.add.image(0, 0, '__DEFAULT').setScrollFactor(0).setDepth(this.depth + .2).setName('boss-hud-dual-portrait-' + this.dualImgs.length).setVisible(false));
    this.mode = 'dual'; this.dualNames[i] = o.id;
    const im = this.dualImgs[i];
    this.drawMedal(im, o.id, o.x + 24, o.y + h / 2, D.r, o.a);
    if (o.done) im.setTint(0x777066); else im.clearTint();
    const bx = o.x + D.barX, bw = o.w - D.barX - 12, by = o.y + 25;
    this.hpBar(bx, by, bw, D.hpH, o.done ? 0 : o.ratio, o.done ? 0 : o.trail, o.a, o.fill);
    if (o.done) g.fillStyle(0x6a6460, .5 * o.a).fillRect(bx, by, bw, D.hpH);
    if (o.rage && !o.done) { const a = .35 + .3 * Math.sin(now / 120); g.lineStyle(2, 0xff5a3a, a * o.a).strokeRoundedRect(bx - 4, by - 4, bw + 8, D.hpH + 8, 4); }
    // 阵营色：头像外再一圈细线区分两人（金 / 朱）
    g.lineStyle(1.5, o.ring, .9 * o.a).strokeCircle(o.x + 24, o.y + h / 2, D.r + 6);
    return { barX: bx, barY: by, barW: bw };
  }
  /** 双首领画完：隐藏多出来的头像槽。 */
  endDual(count: number): void { for (let i = count; i < this.dualImgs.length; i++) this.dualImgs[i].setVisible(false); }
  hideDual(): void { for (const im of this.dualImgs) im.setVisible(false); }

  /** 测试用：当前状态。 */
  debug(): Record<string, unknown> {
    const R = this.rect(), now = performance.now(), L = this.last;
    return {
      visible: this.mode !== 'none' && this.visible, mode: this.mode, name: this.mode === 'single' ? this.texts.name.text : '', title: L?.title ?? '', portrait: this.portrait.visible && this.portrait.texture.key.startsWith('bosshud_medal_'),
      ratio: L?.ratio ?? 0, trail: L?.trail ?? 0, stagger: L?.stagger ?? 0, low: !!L && L.ratio > 0 && L.ratio < BOSS_HUD.low,
      breakFlash: this.breakT.visible, phaseFlashes: this.stats.phaseFlashes, opens: this.stats.opens,
      open: Phaser.Math.Clamp((now - this.openAt) / BOSS_HUD.openMs, 0, 1), dying: now - this.dieAt < BOSS_HUD.dieMs,
      cx: R.x + R.w / 2, top: R.y, rect: R, dualNames: [...this.dualNames], dualPortraits: this.dualImgs.filter(im => im.visible).length,
    };
  }

  /** 测试用：与其他 HUD 部件（名字以 hud- / battle-track / minimap 开头、可见）矩形相交的列表。 */
  overlaps(): string[] {
    const R = this.rect(), out: string[] = [];
    const hit = (b: Phaser.Geom.Rectangle): boolean => b.x < R.x + R.w && b.x + b.width > R.x && b.y < R.y + R.h + 16 && b.y + b.height > R.y;
    for (const o of this.scene.children.list as Phaser.GameObjects.GameObject[]) {
      const n = o.name ?? ''; if (!/^(hud-|battle-track|minimap|world-mini|potion|jinnang|points)/.test(n) || /^hud-boss/.test(n)) continue;
      const any = o as unknown as { visible?: boolean; getBounds?: () => Phaser.Geom.Rectangle };
      if (!any.visible || !any.getBounds) continue;
      const b = any.getBounds(); if (b.width > 0 && hit(b)) out.push(n);
    }
    return out;
  }

  destroy(): void { for (const o of [this.g, this.seal, this.breakT, this.portrait, ...this.dualImgs]) o.destroy(); }
}
