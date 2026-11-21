import { storyArtFile } from '../data/story/art';
import { portraitOf } from '../data/story/speakers';
import Phaser from 'phaser';
import { getCharacter, type CharacterId } from '../data/characters';
import { HERO_JOIN } from '../data/heroUnlocks';
import { heroAffinity, SCHOOLS } from '../data/schools';
import { weaponName } from '../data/upgrades';
import { FONT, HEADING_FONT, TITLE_FONT, GAME_WIDTH as W, GAME_HEIGHT as H, IS_DESKTOP as D } from '../config';
import { joinedByFallback, markRevealSeen, pendingReveals, realProgress, refreshUnlocks } from '../systems/HeroUnlocks';

/**
 * 「新武将 · 来投」揭幕（hero-unlock-design.md 第三节）：黑底，水墨立轴从墨晕里显出 → 朱印「来投」盖下 →
 * 称号 / 名字 / 来投那一刻的两三句 / 本命兵器与亲和派 →「收入麾下」。账号第一次解锁时弹（之后的存档再走到同一节点只静默入麾下）。
 * 立轴 assets/ink-scroll/<id>.webp、朱印 assets/camp/seal.webp，没载就先载（2 秒不到就先不带图出）。
 */
const GOLD = '#efd399', IVORY = '#e8d8b2', STROKE = '#120904';

/** 按进度补查来投（本档免费入麾下）并把没看过的揭幕依次弹出。各场景进来 / 告捷时调。 */
export function checkHeroJoins(scene: Phaser.Scene, done?: () => void): void {
  // 2026-11-20 用户：解锁只代表可选为主将；要当随从去招贤馆「名将」页招募（不再免费入麾下）
  try { refreshUnlocks(realProgress()); } catch { /* 存档不可读：不挡流程 */ }
  showPendingJoins(scene, done);
}
/** 依次弹出还没看过的揭幕。 */
export function showPendingJoins(scene: Phaser.Scene, done?: () => void): void {
  const queue = pendingReveals();
  const next = (): void => { const id = queue.shift(); if (!id || !scene.sys.isActive()) { done?.(); return; } showHeroJoin(scene, id, () => { markRevealSeen(id); next(); }); };
  next();
}

export function showHeroJoin(scene: Phaser.Scene, id: CharacterId, onClose: () => void): void {
  if (scene.children.getByName('hero-join-reveal')) { onClose(); return; }
  const art = portraitOf(id) ?? 'ink_hero_' + id, need: Array<[string, string]> = []; // 统一入口（data/story/speakers.ts）
  if (!scene.textures.exists(art)) need.push([art, storyArtFile(art) ?? `assets/ink-scroll/${id}.webp`]);
  if (!scene.textures.exists('barkui_seal')) need.push(['barkui_seal', 'assets/camp/seal.webp']);
  let built = false; const go = (): void => { if (built) return; built = true; build(scene, id, onClose); };
  if (!need.length) { go(); return; }
  for (const [k, f] of need) scene.load.image(k, f);
  scene.load.once(Phaser.Loader.Events.COMPLETE, go); scene.load.start(); window.setTimeout(go, 2000);
}

function build(scene: Phaser.Scene, id: CharacterId, onClose: () => void): void {
  if (!scene.sys.isActive()) { onClose(); return; }
  const info = HERO_JOIN[id], hero = getCharacter(id), name = hero.name;
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(5000).setName('hero-join-reveal');
  const txt = (x: number, y: number, s: string, size: number, color: string, family = FONT): Phaser.GameObjects.Text =>
    scene.add.text(x, y, s, { fontFamily: family, fontSize: size + 'px', color, resolution: 2 }).setScrollFactor(0).setStroke(STROKE, 3);
  const dim = scene.add.rectangle(0, 0, W, H, 0x0c0906, .94).setOrigin(0).setInteractive().setScrollFactor(0);
  root.add(dim);
  root.add(txt(W / 2, D ? 34 : 70, info?.kicker ?? '', D ? 15 : 16, '#c9b48a', HEADING_FONT).setOrigin(.5).setName('hero-join-kicker'));
  root.add(txt(W / 2, D ? 66 : 108, '新武将 · 来投', D ? 32 : 30, GOLD, TITLE_FONT).setOrigin(.5).setLetterSpacing(4).setName('hero-join-title'));
  // 立轴：电脑在左、手机在上
  const art = portraitOf(id) ?? 'ink_hero_' + id, px = D ? W * .31 : W / 2, pBottom = D ? H - 22 : 560, pH = D ? 410 : 400;
  let portrait: Phaser.GameObjects.Image | null = null;
  if (scene.textures.exists(art)) {
    portrait = scene.add.image(px, pBottom, art).setOrigin(.5, 1).setScrollFactor(0).setAlpha(0).setName('hero-join-portrait');
    portrait.setScale(pH / portrait.height); root.add(portrait);
  }
  // 右栏：称号、名字 + 来投朱印、来投那一刻的话、本命与亲和
  const cx = D ? W * .64 : W / 2, align = D ? 0 : .5, x0 = D ? W * .5 : W / 2;
  root.add(txt(x0, D ? 150 : 590, info?.epithet ?? '', D ? 18 : 18, '#c9a35e', HEADING_FONT).setOrigin(align, 0).setName('hero-join-epithet'));
  const nm = txt(x0, D ? 176 : 616, name, D ? 54 : 46, '#f3e0b0', TITLE_FONT).setOrigin(align, 0).setName('hero-join-name'); root.add(nm);
  const sx = D ? x0 + nm.width + 52 : W / 2 + nm.width / 2 + 46, sy = (D ? 176 : 616) + nm.height / 2;
  const seal = scene.textures.exists('barkui_seal') ? scene.add.image(sx, sy, 'barkui_seal').setDisplaySize(64, 64).setScrollFactor(0).setAlpha(0) : null;
  const sealT = txt(sx, sy + 1, '来投', 20, '#8a1a10', HEADING_FONT).setOrigin(.5).setStroke('#f3d9b0', 0).setAlpha(0).setName('hero-join-seal');
  if (seal) root.add(seal); root.add(sealT);
  const lines = (joinedByFallback(id) && info?.fallbackLines) ? info.fallbackLines : info?.lines ?? [];
  const body = txt(x0, D ? 268 : 690, lines.join('\n'), D ? 17 : 17, IVORY).setOrigin(align, 0).setLineSpacing(10).setWordWrapWidth(D ? W * .44 : W - 60).setAlign(D ? 'left' : 'center').setAlpha(0).setName('hero-join-lines');
  root.add(body);
  const aff = heroAffinity(id).map(s => SCHOOLS[s].name).join(' / ');
  const meta = txt(x0, (D ? 268 : 690) + body.height + 22, `本命：${weaponName(hero.startWeapon, id)}${aff ? '　亲和：' + aff : ''}\n已可选为主将 · 要当随从，往招贤馆「名将」页招募`, D ? 14 : 14, '#b9a57a').setOrigin(align, 0).setAlpha(0).setName('hero-join-meta');
  root.add(meta);
  // 确认（点按钮 / 回车 / 空格；入场 0.9 秒内不收，免得误点）。2026-11-20 起归附 = 可选为主将，不再直接入麾下
  const bx = D ? cx - 20 : W / 2, by = D ? H - 64 : H - 120;
  const btn = txt(bx, by, '准其归附', 20, '#f6e6c2', HEADING_FONT).setOrigin(.5).setPadding(26, 10).setBackgroundColor('#5a2418').setStroke(STROKE, 0).setInteractive({ useHandCursor: true }).setAlpha(0).setName('hero-join-ok');
  root.add(btn);
  const t0 = performance.now(); let closed = false;
  const close = (): void => {
    if (closed || performance.now() - t0 < 900) return; closed = true;
    scene.input.keyboard?.off('keydown', onKey);
    scene.tweens.add({ targets: root, alpha: 0, duration: 260, onComplete: () => { root.destroy(); onClose(); } });
  };
  const onKey = (e: KeyboardEvent): void => { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') close(); };
  btn.on('pointerdown', close); scene.input.keyboard?.on('keydown', onKey);
  // 入场：立轴淡入微缩 → 名字后朱印盖下 → 正文、按钮
  root.setAlpha(0); scene.tweens.add({ targets: root, alpha: 1, duration: 260 });
  if (portrait) { const k = portrait.scale; portrait.setScale(k * 1.04); scene.tweens.add({ targets: portrait, alpha: 1, scale: k, duration: 900, ease: 'Cubic.easeOut' }); }
  const stamp = [seal, sealT].filter(Boolean) as Array<Phaser.GameObjects.Image | Phaser.GameObjects.Text>;
  for (const o of stamp) { const s0 = o.scaleX; o.setScale(s0 * 2.2); scene.tweens.add({ targets: o, alpha: 1, scaleX: s0, scaleY: s0, delay: 650, duration: 260, ease: 'Back.easeIn' }); }
  scene.tweens.add({ targets: [body, meta, btn], alpha: 1, delay: 900, duration: 400 });
  scene.cameras.main?.flash?.(180, 60, 30, 10);
}
