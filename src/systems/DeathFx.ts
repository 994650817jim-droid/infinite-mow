import Phaser from 'phaser';
import { IS_DESKTOP } from '../config';
import { SKILL_FX } from './SkillFxSheets';
import { ART_V2_FILES, isV2Texture, regridV2 } from './ArtStyle';
import { deathFxOn } from './BattleSettings';
import type { Enemy } from '../entities/Enemy';

/**
 * 敌军死亡特效（2026-11-18 用户选定 B「脚下尘土」，样片见分支 claude/death-fx-proto）。默认对所有普通敌人生效；
 * 设置里「死亡特效：开 / 关」（im_death_fx，主页设置与战斗内设置共用，缺省开）；?deathfx=a|b|c|off 只用于调试 / 对比。
 * 规则：不画任何代码图形；全部是对敌人自己的手绘贴图（身体、阴影）做补间，加上已有的手绘尘土序列帧。
 * 性能：一个对象池（电脑最多 CAP_DESKTOP 个、手机 CAP_LITE 个）+ 一个统一的 update 循环，不为每个敌人建 tween / 计时器。
 *  B：闪白 60ms → 往后退一小步、向「受击来源 → 敌人」的方向倾倒约 70° → 0.3 秒内淡出并略微下沉；脚下阴影同步淡出；
 *     脚下一小团尘土（专属手绘黄土地扬尘 fx_death_dust 6 帧，缺图退回 fx_collapse_dust；约敌人宽度 0.8 倍）。首领、补给、墙体、我方单位（部曲 / 召唤物 / 名将）不走这套。
 *  在 B 的基础上再叠三项（2026-11-18 用户同意）：
 *   1 兵器脱手：倒下时手里的兵器（刀 / 枪 / 弓 / 盾）沿小抛物线甩到旁边，落地停约 0.5 秒后淡出；同屏最多 PROP_CAP 件，满了回收最老的。
 *   2 按兵种：骑兵人坠马、马受惊沿反方向跑出去并淡出（用现成马匹行走图，人只留上半身）；盾兵盾牌先落地、扬起一圈小尘土；
 *     弓兵弓掉在地上（同 1）；黄巾兵（第一章）头巾被风吹走、飘起后淡出；其余照常走 B。
 *   3 重击击飞：暴击 / 马超冲锋 / 张飞大喝击杀时位移加大，敌人被击飞 40–70px 再落地，落地处扬尘；判定不到的按普通击杀。
 *   兵器 / 头巾小图在 fx_death_props（3×2：刀 枪 弓 / 藤牌 重盾 头巾），贴图没到位时这些变化自动不显示，不画任何替代图形。
 *   手机降级：关掉兵器、头巾、马、击飞，只保留 B；池更小、尘土隔一个出、同屏尘土封顶、尘土略小。
 *  A（无尘土）/ C（压扁薄片 + 精英墨晕）只保留给调试对比。
 */
export type DeathFxMode = 'a' | 'b' | 'c';
export const DEATH_FX = {
  capDesktop: 160, capLite: 80, flashMs: 60, fallMs: 180, fadeMs: 300, tiltRad: 1.22, backStep: 9, sink: 6,
  propCap: 40, horseCap: 14, flightMs: 300, restMs: 500, propFadeMs: 220, turbanMs: 950, horseMs: 1700, horseSpeed: 270, heavyFlightMs: 260, heavyMin: 40, heavyMax: 70, heavyArc: 30,
  dustMs: 460, dustScale: .8, dustScaleLite: .65, dustCapDesktop: 120, dustCapLite: 28, warmDesktop: 100, warmLite: 30, warmPerFrame: 4, squashMs: 150, haloMs: 420,
} as const;
/** 兵器 / 头巾小图集（3 列 × 2 行，每格 256）：0 刀 1 枪 2 弓 3 藤牌 4 重盾 5 头巾。 */
export const PROPS = 'fx_death_props';
export type DeathProp = 'blade' | 'spear' | 'bow' | 'rattan' | 'tower';
const PROP_FRAME: Record<DeathProp | 'turban', number> = { blade: 0, spear: 1, bow: 2, rattan: 3, tower: 4, turban: 5 };
/** 每次击杀的变化（GameScene.deathOptsOf 按兵种 / 章节 / 受击类型算出）。 */
export interface DeathOpts { heavy?: boolean; turban?: boolean; weapon?: DeathProp; horse?: boolean }
const HORSE = 'horse_v2_generic_walk';
const DUST = 'fx_collapse_dust'; // 墨晕（C 调试）和尘土缺图时的兜底
/** 专属黄土地扬尘（死亡特效 B）；缺图退回 fx_collapse_dust。originY = 贴图里的地面线（占格高比例），scale = 显示尺寸倍率（专属图内容占格宽约 3/4）。 */
const DUST_SHEETS: Record<string, { originY: number; scale: number; alpha: number }> = { fx_death_dust: { originY: .8, scale: .95, alpha: .7 }, fx_collapse_dust: { originY: .62, scale: 1, alpha: .8 } };


interface Entry {
  img: Phaser.GameObjects.Image; shadow?: Phaser.GameObjects.Image; dust?: Phaser.GameObjects.Image; halo?: Phaser.GameObjects.Image;
  active: boolean; start: number; x: number; y: number; dir: number; sx: number; sy: number; size: number; elite: boolean; dustOn: boolean; dustWanted: boolean; shadowA: number; heavy: boolean; dist: number; landX: number; landY: number; crop: boolean; shX: number; shY: number;
}
/** 兵器 / 头巾 / 盾牌落地尘土：一个小对象池条目。 */
interface Prop { img: Phaser.GameObjects.Image; dust?: Phaser.GameObjects.Image; active: boolean; kind: DeathProp | 'turban'; start: number; x: number; y: number; gy: number; dir: number; size: number; jit: number; dustOn: boolean }
interface Horse { img: Phaser.GameObjects.Image; active: boolean; start: number; x: number; y: number; dir: number; vy: number; size: number; face: 'left' | 'right' }

/** 当前模式：?deathfx=a|b|c 调试覆盖，缺省 B；?deathfx=off 调试关闭（返回 null）。 */
export function deathFxMode(): DeathFxMode | null {
  try { const v = new URLSearchParams(location.search).get('deathfx'); if (v === 'off') return null; return v === 'a' || v === 'c' ? v : 'b'; } catch { return 'b'; }
}

export class DeathFx {
  private readonly props: Prop[] = []; private readonly horses: Horse[] = []; private propCursor = 0; private horseCursor = 0;
  private readonly pool: Entry[] = []; private live = 0; private liveDust = 0; private cursor = 0; private skip = 0;
  private readonly lite = !IS_DESKTOP;
  /** 本场累计播放数。 */
  played = 0;
  /** 本场累计创建过的池条目数（对象池复用检查用）。 */
  created = 0;
  constructor(private scene: Phaser.Scene, readonly mode: DeathFxMode) {}

  get liveCount(): number { return this.live; }
  get poolSize(): number { return this.pool.length; }
  get dustCount(): number { return this.liveDust; }
  get propCount(): number { let n = 0; for (const p of this.props) if (p.active) n++; return n; }
  get horseCount(): number { let n = 0; for (const h of this.horses) if (h.active) n++; return n; }
  /** 兵器 / 头巾小图在不在（不在就不显示这些变化）。 */
  get hasProps(): boolean { return !this.lite && this.scene.textures.exists(PROPS); }
  get hasHorse(): boolean { return !this.lite && this.scene.textures.exists(HORSE) && this.scene.textures.get(HORSE).has('left_0'); }

  /** 池预热：战斗开始后每帧建几个条目（含阴影 / 尘土），避免第一次大清屏时一帧里创建几百个对象。 */
  private prewarm(): void {
    // 兵器 / 头巾池（小图在、非手机才建）：每帧 2 个，直到 propCap；马池等第一匹马用到时再建（最多 horseCap）
    if (this.hasProps && this.props.length < DEATH_FX.propCap) for (let i = 0; i < 2 && this.props.length < DEATH_FX.propCap; i++) this.props.push({ img: this.scene.add.image(0, 0, PROPS, 0).setVisible(false).setName('death-fx-prop'), active: false, kind: 'blade', start: 0, x: 0, y: 0, gy: 0, dir: 1, size: 40, jit: 0, dustOn: false });
    const target = this.lite ? DEATH_FX.warmLite : DEATH_FX.warmDesktop;
    for (let i = 0; i < DEATH_FX.warmPerFrame && this.pool.length < target; i++) {
      const e: Entry = { img: this.scene.add.image(0, 0, 'gem_small').setVisible(false).setName('death-fx'), shadow: this.scene.add.image(0, 0, 'shadow').setVisible(false).setName('death-fx-shadow'),
        active: false, start: 0, x: 0, y: 0, dir: 1, sx: 1, sy: 1, size: 40, elite: false, dustOn: false, dustWanted: false, shadowA: .5, heavy: false, dist: 0, landX: 0, landY: 0, crop: false, shX: 0, shY: 0 };
      const dk = this.dustKey; if (this.mode === 'b' && dk) e.dust = this.scene.add.image(0, 0, dk, 0).setVisible(false).setName('death-fx-dust');
      this.pool.push(e); this.created++;
    }
  }

  /** 本场用的尘土图：专属图在就用专属图，否则兜底。 */
  get dustKey(): string | null { return this.scene.textures.exists('fx_death_dust') ? 'fx_death_dust' : this.scene.textures.exists(DUST) ? DUST : null; }

  private acquire(): Entry {
    for (let n = 0; n < this.pool.length; n++) { const e = this.pool[(this.cursor + n) % this.pool.length]; if (!e.active) { this.cursor = (this.cursor + n + 1) % this.pool.length; return e; } }
    if (this.pool.length < (this.lite ? DEATH_FX.capLite : DEATH_FX.capDesktop)) {
      const e: Entry = { img: this.scene.add.image(0, 0, 'gem_small').setVisible(false).setName('death-fx'),
        active: false, start: 0, x: 0, y: 0, dir: 1, sx: 1, sy: 1, size: 40, elite: false, dustOn: false, dustWanted: false, shadowA: .5, heavy: false, dist: 0, landX: 0, landY: 0, crop: false, shX: 0, shY: 0 };
      this.pool.push(e); this.created++; return e;
    }
    const old = this.pool[this.cursor]; this.cursor = (this.cursor + 1) % this.pool.length; this.release(old); return old; // 满了：回收最老的
  }

  private release(e: Entry): void {
    if (e.active) this.live--;
    if (e.dustWanted) this.liveDust--; // 尘土名额在播放时预留、释放时归还
    if (e.crop) { e.img.setCrop(); e.crop = false; }
    e.active = false; e.dustOn = false; e.dustWanted = false; e.img.setVisible(false); e.shadow?.setVisible(false); e.dust?.setVisible(false); e.halo?.setVisible(false);
  }

  /**
   * 敌人被击杀的一瞬间调用。fromX / fromY = 受击来源（弹道 / 近战攻击者，拿不到时用主将）位置，用来定倒向：来源 → 敌人。
   * 返回是否真的播了（关闭 / 首领 / 池满回收等情况返回 false 的只有前两种）。
   */
  play(enemy: Enemy, fromX: number, fromY: number, now: number, opts: DeathOpts = {}): boolean {
    if (enemy.kind === 'boss' || !deathFxOn()) return false;
    const sp = enemy.sprite, e = this.acquire(), dx = sp.x - fromX;
    e.active = true; this.live++; this.played++;
    e.heavy = !!opts.heavy && !this.lite && this.mode === 'b'; e.dist = DEATH_FX.heavyMin + ((enemy.spawnId * 37) % (DEATH_FX.heavyMax - DEATH_FX.heavyMin + 1)); e.crop = false;
    e.start = now; e.x = sp.x; e.y = sp.y; e.dir = dx === 0 ? (sp.flipX ? -1 : 1) : Math.sign(dx);
    e.sx = sp.scaleX; e.sy = sp.scaleY; e.size = Math.max(28, Math.abs(sp.displayWidth)); e.elite = enemy.kind === 'elite'; e.dustOn = false; e.dustWanted = this.mode === 'b' && this.wantDust(); if (e.dustWanted) this.liveDust++;
    e.img.setTexture(sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setScale(e.sx, e.sy).setFlipX(sp.flipX).setPosition(e.x, e.y).setRotation(0)
      .setAlpha(1).setDepth(sp.depth).setVisible(true).setTintFill(0xffffff);
    // 脚下阴影：和身体一起淡出（敌人自己的阴影在 deactivate 时已隐藏，这里用同一张手绘阴影图接着画）
    const sh = enemy.shadow;
    e.shadow ??= this.scene.add.image(0, 0, 'shadow').setName('death-fx-shadow');
    e.shadowA = sh.alpha || .5;
    e.shadow.setTexture(sh.texture.key, sh.frame.name).setDisplaySize(Math.abs(sh.displayWidth), Math.abs(sh.displayHeight)).setPosition(sh.x, sh.y).setOrigin(sh.originX, sh.originY)
      .setAlpha(e.shadowA).setDepth(sh.depth).setVisible(true);
    e.dust?.setVisible(false); e.halo?.setVisible(false);
    e.shX = sh.x; e.shY = sh.y;
    // 骑兵：人坠马——只留上半身（骑手）倒下，马交给下面的「受惊跑开」
    e.img.setCrop();
    if (opts.horse && this.hasHorse && this.mode === 'b') { const fr = sp.frame; e.img.setCrop(0, 0, fr.width, Math.round(fr.height * .7)); e.crop = true; this.spawnHorse(sp, e.dir, now); }
    if (this.hasProps && this.mode === 'b') {
      if (opts.weapon) this.spawnProp(opts.weapon, sp, e.dir, now);
      if (opts.turban) this.spawnProp('turban', sp, e.dir, now);
    }
    if (this.mode === 'c' && e.elite && this.scene.textures.exists(DUST)) {
      const s = e.size * 1.9; e.halo ??= this.scene.add.image(0, 0, DUST, 2).setName('death-fx-halo'); e.halo.setDisplaySize(s, s).setPosition(e.x, e.y - 2).setOrigin(.5, .62).setAlpha(.0).setTint(0x2a2118).setRotation(Math.random() * 6.28).setDepth(sp.depth - .2).setVisible(true);
    }
    return true;
  }

  private horseLoading = false;
  /** 场上出现骑兵时调用：把通用战马行走图按需异步载入（HeroMount 也是这样按需载入）；手机 / 已载入 / 不是 v2 画风时什么都不做。 */
  warmHorse(): void {
    if (this.lite || this.horseLoading || this.mode !== 'b' || !deathFxOn() || this.scene.textures.exists(HORSE) || !isV2Texture(HORSE)) return;
    this.horseLoading = true; const s = this.scene;
    s.load.image(HORSE, ART_V2_FILES[HORSE]); s.load.once('filecomplete-image-' + HORSE, () => { regridV2(s, HORSE); });
    if (!s.load.isLoading()) s.load.start();
  }

  private spawnProp(kind: DeathProp | 'turban', sp: Phaser.GameObjects.Image, dir: number, now: number): void {
    let p = this.props.find(x => !x.active);
    if (!p) {
      if (this.props.length < DEATH_FX.propCap) { p = { img: this.scene.add.image(0, 0, PROPS, 0).setVisible(false).setName('death-fx-prop'), active: false, kind, start: 0, x: 0, y: 0, gy: 0, dir: 1, size: 40, jit: 0, dustOn: false }; this.props.push(p); }
      else { p = this.props[this.propCursor]; this.propCursor = (this.propCursor + 1) % this.props.length; p.img.setVisible(false); p.dust?.setVisible(false); }   // 满了：回收最老的
    }
    const h = Math.abs(sp.displayHeight), jit = Math.random() * 2 - 1;
    p.active = true; p.kind = kind; p.start = now; p.dir = dir; p.jit = jit; p.dustOn = false;
    p.size = Math.max(20, Math.min(46, Math.abs(sp.displayWidth) * (kind === 'turban' ? .5 : kind === 'tower' || kind === 'rattan' ? .66 : .75))); // 图里物品约占格宽 0.75–0.8：按敌人身高换算成真实比例
    p.x = sp.x + dir * 2; p.y = sp.y - h * (kind === 'turban' ? .82 : .45); p.gy = sp.y + 3 + jit * 4;
    p.img.setFrame(PROP_FRAME[kind]).setDisplaySize(p.size, p.size).setPosition(p.x, p.y).setRotation(0).setAlpha(1).setDepth(sp.depth + .2).setVisible(true).setOrigin(.5, .5);
    p.dust?.setVisible(false);
  }

  private spawnHorse(sp: Phaser.GameObjects.Image, dir: number, now: number): void {
    let h = this.horses.find(x => !x.active);
    if (!h) {
      if (this.horses.length < DEATH_FX.horseCap) { h = { img: this.scene.add.image(0, 0, HORSE, 'left_0').setVisible(false).setName('death-fx-horse'), active: false, start: 0, x: 0, y: 0, dir: 1, vy: 0, size: 60, face: 'left' }; this.horses.push(h); }
      else { h = this.horses[this.horseCursor]; this.horseCursor = (this.horseCursor + 1) % this.horses.length; }
    }
    h.active = true; h.start = now; h.dir = -dir; h.vy = (Math.random() * 2 - 1) * 70; h.face = h.dir < 0 ? 'left' : 'right'; h.x = sp.x; h.y = sp.y + 4; h.size = Math.abs(sp.displayWidth);
    h.img.setTexture(HORSE, h.face + '_0').setDisplaySize(h.size, h.size).setOrigin(.5, .93).setPosition(h.x, h.y).setTint(0xc88d5e).setAlpha(1).setDepth(sp.depth - .05).setVisible(true);
  }

  /** 这一个要不要带尘土：手机隔一个出、同屏尘土封顶。 */
  private wantDust(): boolean {
    const cap = this.lite ? DEATH_FX.dustCapLite : DEATH_FX.dustCapDesktop;
    if (this.liveDust >= cap) return false;
    if (this.lite) { this.skip++; return this.skip % 2 === 0; }
    return true;
  }

  /** 兵器 / 头巾 / 盾牌落地尘土 / 受惊的马：每帧推进（和身体的动画分开，身体播完它们还在）。 */
  private updateProps(now: number): void {
    const D = DEATH_FX;
    for (const p of this.props) {
      if (!p.active) continue;
      const t = now - p.start;
      if (p.kind === 'turban') {
        const u = Phaser.Math.Clamp(t / D.turbanMs, 0, 1);
        p.img.setPosition(p.x + p.dir * (16 + p.jit * 8) * u + Math.sin(u * 7) * 4, p.y - 40 * u).setRotation(Math.sin(u * 8) * .4 + p.dir * .3 * u).setAlpha(u < .35 ? 1 : 1 - (u - .35) / .65);
        if (t >= D.turbanMs) { p.active = false; p.img.setVisible(false); }
        continue;
      }
      const shield = p.kind === 'rattan' || p.kind === 'tower', flight = shield ? 200 : D.flightMs;
      const u = Phaser.Math.Clamp(t / flight, 0, 1), ue = 1 - (1 - u) * (1 - u), reach = shield ? 12 + p.jit * 3 : 28 + p.jit * 10, arc = shield ? 6 : 20;
      const x = p.x + p.dir * reach * ue, y = p.y + (p.gy - p.y) * u - arc * Math.sin(Math.PI * u);
      const fadeAt = flight + D.restMs, a = t < fadeAt ? 1 : 1 - Phaser.Math.Clamp((t - fadeAt) / D.propFadeMs, 0, 1);
      p.img.setPosition(x, y).setRotation(p.dir * (shield ? 1.45 : 2.4 + p.jit * .6) * ue).setAlpha(a);
      // 盾牌先倒地，落地那一下扬起一圈小尘土
      const dk = this.dustKey;
      if (shield && dk && t >= flight) {
        if (!p.dustOn) { p.dustOn = true; p.dust ??= this.scene.add.image(0, 0, dk, 0).setName('death-fx-prop-dust'); const sh = DUST_SHEETS[dk], s = p.size * 1.1 * sh.scale; p.dust.setDisplaySize(s, s).setPosition(x, p.gy + 1).setOrigin(.5, sh.originY).setDepth(p.img.depth - .1).setVisible(true); }
        const d = Phaser.Math.Clamp((t - flight) / 380, 0, 1), sh = DUST_SHEETS[dk]; p.dust!.setFrame(Math.min((SKILL_FX[dk]?.frames ?? 6) - 1, Math.floor(d * (SKILL_FX[dk]?.frames ?? 6)))).setAlpha(sh.alpha * (1 - d * d)); if (d >= 1) p.dust!.setVisible(false);
      }
      if (t >= fadeAt + D.propFadeMs) { p.active = false; p.img.setVisible(false); p.dust?.setVisible(false); }
    }
    for (const h of this.horses) {
      if (!h.active) continue;
      const t = now - h.start;
      h.img.setFrame(h.face + '_' + (Math.floor(t / 90) % 4)).setPosition(h.x + h.dir * D.horseSpeed * (t / 1000), h.y + h.vy * (t / 1000) + Math.sin(t / 45) * 1.5).setAlpha(t < D.horseMs - 500 ? 1 : 1 - Phaser.Math.Clamp((t - (D.horseMs - 500)) / 500, 0, 1));
      if (t >= D.horseMs) { h.active = false; h.img.setVisible(false).clearTint(); }
    }
  }

  update(now: number): void {
    if (deathFxOn()) this.prewarm();
    this.updateProps(now);
    if (!this.live) return;
    const D = DEATH_FX, dk = this.dustKey, frames = SKILL_FX[dk ?? DUST]?.frames ?? 6, sheet = DUST_SHEETS[dk ?? DUST];
    for (const e of this.pool) {
      if (!e.active) continue;
      const t = now - e.start;
      if (this.mode === 'c') {
        // 闪白 → 压成薄片、淡出
        if (t >= D.flashMs) e.img.clearTint();
        const k = Phaser.Math.Clamp((t - D.flashMs * .5) / D.squashMs, 0, 1), q = 1 - (1 - k) * (1 - k);
        e.img.setScale(e.sx * (1 + .35 * q), e.sy * (1 - .88 * q));
        const a = 1 - Phaser.Math.Clamp((t - D.flashMs) / (D.squashMs * 1.5), 0, 1); e.img.setAlpha(a); e.shadow?.setAlpha(e.shadowA * a);
        if (e.elite && e.halo) { const h = Phaser.Math.Clamp(t / D.haloMs, 0, 1); e.halo.setAlpha(h < .25 ? h / .25 * .28 : (1 - h) / .75 * .28); }
        if (t >= D.haloMs || (!e.elite && t >= D.flashMs + D.squashMs * 1.5)) this.release(e);
        continue;
      }
      // A / B：闪白 60ms → 后退 + 向受击反方向倾倒 70° → 0.3 秒淡出并略微下沉；阴影同步淡出
      if (t >= D.flashMs) e.img.clearTint();
      let f = Phaser.Math.Clamp((t - D.flashMs) / D.fallMs, 0, 1), ease = 1 - (1 - f) * (1 - f);
      let fade = Phaser.Math.Clamp((t - D.flashMs) / D.fadeMs, 0, 1), landT = D.flashMs;   // landT = 尘土开始的时刻
      if (e.heavy) {
        // 重击击飞：飞 heavyFlightMs（抛物线，位移 40–70px，带翻转），落地停 80ms，再淡出；尘土在落地处
        const u = Phaser.Math.Clamp((t - D.flashMs) / D.heavyFlightMs, 0, 1), ue = 1 - (1 - u) * (1 - u);
        landT = D.flashMs + D.heavyFlightMs; fade = Phaser.Math.Clamp((t - landT - 80) / D.fadeMs, 0, 1);   // 落地停 80ms 再淡出（先算 fade，下沉量才对）
        const x = e.x + e.dir * (D.backStep + e.dist * ue), y = e.y - 4 * D.heavyArc * u * (1 - u) + D.sink * fade;
        e.landX = x; e.landY = e.y;
        e.img.setRotation(e.dir * (D.tiltRad + .6) * ue).setPosition(x, y).setAlpha(1 - fade);
        e.shadow?.setPosition(e.shX + (x - e.x), e.shY).setAlpha(e.shadowA * (1 - fade));
      } else {
        e.img.setRotation(e.dir * D.tiltRad * ease).setPosition(e.x + e.dir * D.backStep * ease, e.y + D.sink * fade).setAlpha(1 - fade);
        e.shadow?.setAlpha(e.shadowA * (1 - fade));
      }
      if (this.mode === 'b' && dk) {
        if (!e.dustOn && e.dustWanted && t >= landT) {
          e.dustOn = true; const s = e.size * (this.lite ? D.dustScaleLite : D.dustScale) * sheet.scale; e.dust ??= this.scene.add.image(0, 0, dk, 0).setName('death-fx-dust');
          e.dust.setDisplaySize(s, s).setPosition(e.heavy ? e.landX : e.x + e.dir * D.backStep * .6, e.heavy ? e.landY + 2 : e.y + 2).setOrigin(.5, sheet.originY).setAlpha(sheet.alpha).setDepth(e.img.depth + .1).setVisible(true);
        }
        if (e.dustOn && e.dust) { const d = Phaser.Math.Clamp((t - landT) / D.dustMs, 0, 1); e.dust.setFrame(Math.min(frames - 1, Math.floor(d * frames))).setAlpha(sheet.alpha * (1 - d * d)); }
      }
      const dustEnd = e.dustOn ? landT + D.dustMs : 0, bodyEnd = e.heavy ? landT + 80 + D.fadeMs : D.flashMs + D.fadeMs;
      if (t >= bodyEnd && t >= dustEnd) this.release(e);
    }
  }
}
