import Phaser from 'phaser';
import { DEPTH } from '../config';

/**
 * 首领「主题特效组」（2026-11-19 用户：「强化 boss 攻击技能特效，主要是那些看起来比较简单普通的 boss」）：
 * 通用控制器 BossMoveset 的 25 个首领原先共用 8 张通用手绘图（WarnFx），落下还被收敛成半透明小图；这里按首领气质给每组一张手绘透明图，
 * 在招式结算那一刻补上「主效果 + 命中」。预警（WarnFx）原样保留 → 可读性不变；缺图时退回原来的 shapeImpact。
 * 图集（ChatGPT 出，黑底，tools/prepare-black-fx.mjs 去底）：1024×1024、4×4、每格 256；行 0 斩击（0–3）、行 1 长条（4–7）、行 2 落点爆（8–11）、行 3 现身烟（12–15）。
 * 图里：斩击朝右、弧心约在格宽 0.39 处；长条贯穿整格、纵向居中；落点爆 / 现身烟以格中心为圆心。
 */
export type BossTheme = 'blood' | 'yellow' | 'dust' | 'quake' | 'wall' | 'lance' | 'ink' | 'wei';
export const BOSS_THEME_FILES: Readonly<Record<BossTheme, string>> = {
  blood: 'assets/boss-fx/themes/blood.png', yellow: 'assets/boss-fx/themes/yellow.png', dust: 'assets/boss-fx/themes/dust.png', quake: 'assets/boss-fx/themes/quake.png',
  wall: 'assets/boss-fx/themes/wall.png', lance: 'assets/boss-fx/themes/lance.png', ink: 'assets/boss-fx/themes/ink.png', wei: 'assets/boss-fx/themes/wei.png',
};
/** 已出图的主题（图到一组登记一组，避免请求不存在的文件）。 */
export const BOSS_THEME_READY: readonly BossTheme[] = ['blood', 'yellow', 'dust', 'quake', 'wall', 'lance'];
/** 首领 → 主题。 */
export const BOSS_THEME_OF: Readonly<Record<string, BossTheme>> = {
  zhangliang: 'yellow', zhangbao: 'yellow',
  lijue: 'blood', huaxiong: 'blood', guosi: 'blood',
  zhangxiu: 'lance', zhanghe: 'lance', zhuran: 'lance', zhangren: 'lance', huangzhong: 'lance', caimao: 'lance',
  liudu: 'wall', hanxuan: 'wall', yanghuai: 'wall', haozhao: 'wall', zhaofan: 'wall', liuzhang: 'wall',
  lvmeng: 'ink', caocao: 'wei', caoren: 'wei',
  yanliang: 'dust', wenchou: 'dust', caochun: 'dust', xiahouyuan: 'dust', sunhuan: 'dust', pangde: 'dust',
  mangyachang: 'quake', wutugu: 'quake', menghuo: 'quake',
};
export const BOSS_THEME_FX = {
  /** 每段播放时长（毫秒）；各形状在贴图里的内容占比（用来把图里的内容对到真实判定范围）。 */
  ms: 440, fade: 160, alpha: .92, sliceCx: .39, sliceSpan: .78, ringFrac: .9, puffFrac: .74, laneFrac: .35, cap: 40,
} as const;
const texKey = (t: BossTheme): string => 'bossfxtheme_' + t;

export function themeOf(bossId: string): BossTheme | null { return BOSS_THEME_OF[bossId] ?? null; }
export function hasBossTheme(scene: Phaser.Scene, t: BossTheme | null): t is BossTheme { return !!t && scene.textures.exists(texKey(t)); }
/** 确保这一组主题图在加载（已加载 / 没图的跳过）。 */
export function ensureBossTheme(scene: Phaser.Scene, t: BossTheme | null): void {
  if (!t || !BOSS_THEME_READY.includes(t) || scene.textures.exists(texKey(t))) return;
  scene.load.spritesheet(texKey(t), BOSS_THEME_FILES[t], { frameWidth: 256, frameHeight: 256 });
  if (!scene.load.isLoading()) scene.load.start();
}

export type ThemeShape =
  | { kind: 'sector'; x: number; y: number; r: number; angle: number }
  | { kind: 'lane'; x: number; y: number; angle: number; len: number; width: number }
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'puff'; x: number; y: number; size: number };
const ROW: Record<ThemeShape['kind'], number> = { sector: 0, lane: 1, circle: 2, puff: 3 };

let live = 0;
/** 在真实判定范围上播一段主题特效（4 帧），播完淡出销毁；没图返回 false（调用方退回原来的画法）。 */
export function playThemeFx(scene: Phaser.Scene, t: BossTheme | null, s: ThemeShape, o: { ms?: number; alpha?: number; flip?: boolean } = {}): boolean {
  if (!hasBossTheme(scene, t) || live >= BOSS_THEME_FX.cap) return false;
  const K = BOSS_THEME_FX, first = ROW[s.kind] * 4, key = texKey(t);
  const img = scene.add.image(s.x, s.y, key, first).setAlpha(o.alpha ?? K.alpha).setName('boss-theme-fx');
  if (s.kind === 'sector') { const w = s.r / K.sliceSpan; img.setOrigin(K.sliceCx, .5).setRotation(s.angle).setDisplaySize(w, w).setDepth(DEPTH.fx); }
  else if (s.kind === 'lane') { img.setOrigin(0, .5).setRotation(s.angle).setDisplaySize(s.len, Math.max(s.width * 1.3, 40) / K.laneFrac).setDepth(DEPTH.fx); }
  else if (s.kind === 'circle') { const d = s.r * 2 / K.ringFrac; img.setOrigin(.5, .5).setDisplaySize(d, d).setDepth(DEPTH.ground + 6); }
  else { img.setOrigin(.5, .62).setDisplaySize(s.size / K.puffFrac, s.size / K.puffFrac).setDepth(DEPTH.fx); }
  if (o.flip) img.setFlipY(true);
  live++;
  scene.tweens.addCounter({ from: 0, to: 3.99, duration: o.ms ?? K.ms, onUpdate: tw => img.setFrame(first + Math.floor(tw.getValue() ?? 0)),
    onComplete: () => scene.tweens.add({ targets: img, alpha: 0, duration: K.fade, onComplete: () => { live--; img.destroy(); } }) });
  return true;
}
/** 命中震屏（沿用 HitFeel；重击才中等，不叠加过多）。场景没有 hitFeel（章节场景以外）时什么都不做。 */
export function themeShake(scene: Phaser.Scene, heavy: boolean): void {
  const hf = (scene as unknown as { hitFeel?: { shake(k: 'small' | 'medium' | 'big'): void } }).hitFeel;
  hf?.shake(heavy ? 'medium' : 'small');
}
