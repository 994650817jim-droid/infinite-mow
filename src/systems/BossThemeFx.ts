import Phaser from 'phaser';
import { DEPTH } from '../config';
import { bossCastSfx, bossHitSfx, sceneSfx } from './ContentSfx';
import { borrowBossImpact, drawBossImpact, releaseBossImpact, type ImpactShape } from './BossImpactMarks';

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
export const BOSS_THEME_READY: readonly BossTheme[] = ['blood', 'yellow', 'dust', 'quake', 'wall', 'lance', 'ink', 'wei'];
/** 首领 → 主题。 */
export const BOSS_THEME_OF: Readonly<Record<string, BossTheme>> = {
  zhangliang: 'yellow', zhangbao: 'yellow',
  lijue: 'blood', huaxiong: 'blood', guosi: 'blood',
  zhangxiu: 'lance', zhanghe: 'lance', zhuran: 'lance', zhangren: 'lance', huangzhong: 'lance', caimao: 'lance',
  liudu: 'wall', hanxuan: 'wall', yanghuai: 'wall', haozhao: 'wall', zhaofan: 'wall', liuzhang: 'wall',
  lvmeng: 'ink', caocao: 'wei', caoren: 'wei',
  yanliang: 'dust', wenchou: 'dust', caochun: 'dust', xiahouyuan: 'dust', sunhuan: 'dust', pangde: 'dust',
  mangyachang: 'quake', wutugu: 'quake', menghuo: 'quake',
  zhurong: 'blood', // 祝融夫人：火神之后，红橙刀气配飞刀（2026-11-19 双首领第二批）
};
export const BOSS_THEME_FX = {
  /** 每段播放时长（毫秒）；各形状在贴图里的内容占比（用来把图里的内容对到真实判定范围）。 */
  ms: 440, fade: 120, alpha: 1, sliceCx: .39, sliceSpan: .78, ringFrac: .9, puffFrac: .74, laneFrac: .35, cap: 40,
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
  | { kind: 'sector'; x: number; y: number; r: number; angle: number; arc?: number }
  | { kind: 'lane'; x: number; y: number; angle: number; len: number; width: number }
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'puff'; x: number; y: number; size: number };
const ROW: Record<ThemeShape['kind'], number> = { sector: 0, lane: 1, circle: 2, puff: 3 };

const IMPACT_TINT: Readonly<Record<BossTheme, number>> = {
  blood:0xee7051, yellow:0xefbd68, dust:0xf0b47b, quake:0xe8a577,
  wall:0xcfb581, lance:0xafdbf1, ink:0xb7a0e7, wei:0xf3c383,
};
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
  const shape: ImpactShape | undefined = s.kind === 'puff' ? undefined :
    s.kind === 'sector' ? { ...s, arc:s.arc ?? Math.PI*2/3 } : s;
  const accent = shape && borrowBossImpact(scene);
  const duration = o.ms ?? K.ms;
  const paint = (age: number) => {
    if (!accent || !shape) return;
    accent.clear();
    drawBossImpact(accent, shape, IMPACT_TINT[t], 0xffefd2, age / Math.min(330,duration));
  };
  paint(0);
  live++; sceneSfx(scene, bossHitSfx(t));
  img.once('destroy', () => {
    live--;
    if (accent?.scene) releaseBossImpact(accent);
  });
  scene.tweens.addCounter({ from: 0, to: 3.99, duration, onUpdate: tw => {
    const value = tw.getValue() ?? 0;
    img.setFrame(first + Math.floor(value));
    paint(value/3.99*duration);
  }, onComplete: () => scene.tweens.add({ targets: img, alpha: 0, duration: K.fade, onComplete: () => img.destroy() }) });
  return true;
}
/** 命中震屏（沿用 HitFeel；重击才中等，不叠加过多）。场景没有 hitFeel（章节场景以外）时什么都不做。 */
export function themeShake(scene: Phaser.Scene, heavy: boolean): void {
  const hf = (scene as unknown as { hitFeel?: { shake(k: 'small' | 'medium' | 'big'): void } }).hitFeel;
  hf?.shake(heavy ? 'medium' : 'small');
}

// ———— 出招起手（cast）特效：2026-11-19 用户「还要增加适合的攻击技能释放特效」 ————
/**
 * 每个主题再配一张 4×4 手绘透明图（assets/boss-fx/cast/<主题>.png，每格 256）：行 0 蓄力光（包在首领身上，循环）、行 1 脚下法阵（大招起手，压扁成地面椭圆）、
 * 行 2 兵器闪光（出手瞬间的星芒）、行 3 狂暴爆发（换阶段）。只放在首领身上 / 脚下，不盖住地面预警（预警在判定范围里，这些只在首领自己周围一圈）。缺图什么都不画。
 */
export const BOSS_CAST_READY: readonly BossTheme[] = ['blood', 'yellow', 'dust', 'quake', 'wall', 'lance', 'ink', 'wei'];
/** 有专属手绘的首领（不走 BossMoveset）借用的起手主题：只加一个贴合的起手光，不动它们原有的画面。 */
export const CAST_THEME_EXTRA: Readonly<Record<string, BossTheme>> = { zhangjiao: 'yellow', lubu: 'blood', yuanshu: 'wei', simayi: 'ink', caoren5: 'wall', xurong: 'dust' };
export function castThemeOf(bossId: string): BossTheme | null { return BOSS_THEME_OF[bossId] ?? CAST_THEME_EXTRA[bossId] ?? null; }
const castKey = (t: BossTheme): string => 'bossfxcast_' + t;
export function hasBossCast(scene: Phaser.Scene, t: BossTheme | null): t is BossTheme { return !!t && scene.textures.exists(castKey(t)); }
export function ensureBossCast(scene: Phaser.Scene, t: BossTheme | null): void {
  if (!t || !BOSS_CAST_READY.includes(t) || scene.textures.exists(castKey(t))) return;
  scene.load.spritesheet(castKey(t), 'assets/boss-fx/cast/' + t + '.png', { frameWidth: 256, frameHeight: 256 });
  if (!scene.load.isLoading()) scene.load.start();
}
export type CastKind = 'aura' | 'sigil' | 'glint' | 'burst';
const CAST_ROW: Record<CastKind, number> = { aura: 0, sigil: 1, glint: 2, burst: 3 };
export const BOSS_CAST_FX = { cap: 16, auraOy: .66, auraFrac: .86, sigilSquash: .6, sigilFrac: .9, glintFrac: .5, burstFrac: .94 } as const;
let castLive = 0;
/**
 * 播一段起手特效。size = 贴图里内容的目标直径（世界像素）；aura 跟着首领（follow 返回首领当前位置，返回 null 就停）、按 ms 循环 4 帧；
 * sigil 在 ms 内按进度走 4 帧（出现 → 亮起 → 脉冲 → 渐隐）；glint / burst 播一遍。
 */
export function playCastFx(scene: Phaser.Scene, t: BossTheme | null, kind: CastKind, x: number, y: number, size: number,
  o: { ms?: number; alpha?: number; follow?: () => { x: number; y: number } | null; depth?: number } = {}): boolean {
  if (!hasBossCast(scene, t) || castLive >= BOSS_CAST_FX.cap) return false;
  const K = BOSS_CAST_FX, first = CAST_ROW[kind] * 4, ms = o.ms ?? (kind === 'glint' ? 300 : kind === 'burst' ? 650 : 700);
  const img = scene.add.image(x, y, castKey(t), first).setName('boss-cast-' + kind).setAlpha(0);
  if (kind === 'aura') { const d = size / K.auraFrac; img.setOrigin(.5, K.auraOy).setDisplaySize(d, d).setDepth(o.depth ?? DEPTH.fx); }
  else if (kind === 'sigil') { const d = size / K.sigilFrac; img.setOrigin(.5, .5).setDisplaySize(d, d * K.sigilSquash).setDepth(o.depth ?? DEPTH.ground + 5); }
  else if (kind === 'glint') { const d = size / K.glintFrac; img.setOrigin(.5, .5).setDisplaySize(d, d).setDepth(o.depth ?? DEPTH.fx + 1); }
  else { const d = size / K.burstFrac; img.setOrigin(.5, .62).setDisplaySize(d, d).setDepth(o.depth ?? DEPTH.fx + 1); }
  const peak = o.alpha ?? (kind === 'aura' ? .6 : kind === 'sigil' ? .55 : .9); castLive++;
  if (kind === 'burst') sceneSfx(scene, 'bburst'); else if (kind !== 'glint') sceneSfx(scene, bossCastSfx(t)); // 起手音（蓄力 / 法阵；狂暴爆发另一声）
  const st = { u: 0 };
  scene.tweens.add({ targets: st, u: 1, duration: ms, ease: 'Linear',
    onUpdate: () => {
      const u = st.u, f = kind === 'aura' ? Math.floor(u * ms / 130) % 4 : Math.min(3, Math.floor(u * 4));
      const a = kind === 'glint' || kind === 'burst' ? peak * (1 - Math.max(0, u - .55) / .45) : peak * Math.min(1, u * 6, (1 - u) * 5 + .15);
      img.setFrame(first + f).setAlpha(Math.max(0, Math.min(1, a)));
      const p = o.follow?.(); if (p) img.setPosition(p.x, p.y); else if (o.follow) st.u = 1;
    },
    onComplete: () => { castLive--; img.destroy(); } });
  return true;
}
/**
 * 有专属手绘的首领（张角 / 吕布 / 袁术 / 司马懿 / 曹仁五 / 徐荣）起手时只加一个贴合的蓄力光（大招再加脚下法阵），不动它们原有的画面。
 * bossId 用 CAST_THEME_EXTRA 里的键；第一次调用时才按需载入图（首个招式可能还没图，之后都有）。
 */
export function castFlourish(scene: Phaser.Scene, bossId: string, boss: { x: number; y: number; active: boolean }, ms: number, big = false): void {
  const t = castThemeOf(bossId); if (!t) return;
  if (!hasBossCast(scene, t)) { ensureBossCast(scene, t); return; }
  const follow = (): { x: number; y: number } | null => (boss.active ? { x: boss.x, y: boss.y } : null);
  playCastFx(scene, t, 'aura', boss.x, boss.y, 170, { ms, follow });
  if (big) playCastFx(scene, t, 'sigil', boss.x, boss.y + 4, 150, { ms, follow: () => (boss.active ? { x: boss.x, y: boss.y + 4 } : null) });
}
/** 有专属手绘的首领在构造时预载起手图（第一个招式就有特效）。 */
export function warmCast(scene: Phaser.Scene, bossId: string): void { ensureBossCast(scene, castThemeOf(bossId)); }
