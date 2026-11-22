import Phaser from 'phaser';
import { FONT, HEADING_FONT, TITLE_FONT } from '../config';
import { QUALITIES, itemName, relicDef, type ItemInstance } from '../data/items';
import { bagArt, itemTile } from './ItemQuality';

/**
 * 结算奖励展示（2026-11-17 用户：「关于打败boss后结算ui也要优化一下」，电脑版）：
 * 武将经验条（填满 → 「升级！」→ 再填到当前进度）、奖励印章格（战功 / 军粮 / 屯田 / 残卷 / 兵装，数字滚动）、首领遗珍卡翻面、一行小字战况。
 * 数据全部从原结算文字逐行解析（逻辑与测试仍读原文字），这里只负责表现。
 * 战斗结束后场景计时器与 tween 都已暂停，动画用浏览器 rAF 驱动，2 秒内放完，可随时跳到结尾。
 */
export const RESULT_GOLD = '#efd399', RESULT_IVORY = '#e8d8b2', RESULT_STROKE = '#120904';
const GOLD = 0xc9a35e, GOLD_HI = 0xf3d48a;

export interface ResultAnim { start: number; dur: number; step: (p: number) => void }
export interface RewardViewOptions {
  lines: string[];
  width: number;
  /** 首领遗珍（本局缴获里的那件）。 */
  relic?: ItemInstance | null;
  /** 武将当前经验进度（0–1），用于经验条终点；缺省按「经验 +N」估算不出时停在满格。 */
  xpFraction?: number | null;
  /** 显示哪些奖励格（缺省全部）。 */
  only?: RegExp;
}
export interface RewardView { root: Phaser.GameObjects.Container; anims: ResultAnim[]; height: number; levelUp: boolean }

const pick = (lines: string[], re: RegExp): RegExpMatchArray | null => { for (const l of lines) { const m = l.match(re); if (m) return m; } return null; };
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
export const wan = (n: number): string => n >= 1e4 ? (n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + '万' : String(Math.round(n));

/** 从结算文字里取出「武将等级」行：名字、起止等级、本场经验。 */
export function parseHeroLine(lines: string[]): { name: string; from: number; to: number; xp: number; capped: boolean } | null {
  const m = pick(lines, /^武将等级\s+(.+?) (?:Lv\.(\d+) → )?Lv\.(\d+) · 经验 \+(\d+)(.*)$/);
  if (!m) return null;
  const to = Number(m[3]);
  return { name: m[1], from: m[2] ? Number(m[2]) : to, to, xp: Number(m[4]), capped: /上限/.test(m[5] ?? '') };
}

export function buildRewardView(scene: Phaser.Scene, o: RewardViewOptions): RewardView {
  const root = scene.add.container(0, 0).setName('result-rewards');
  const anims: ResultAnim[] = [];
  const L = o.lines, W = o.width;
  const txt = (x: number, y: number, s: string, size: number, color: string, font = FONT) => scene.add.text(x, y, s, { fontFamily: font, fontSize: size + 'px', color, resolution: 2 })
    .setOrigin(.5).setStroke(RESULT_STROKE, size >= 18 ? 4 : 3).setShadow(0, 2, '#000000', 3, true, true);
  let y = 0, levelUp = false;

  // ① 武将经验条
  const hero = parseHeroLine(L);
  if (hero && (!o.only || o.only.test('武将等级'))) {
    levelUp = hero.to > hero.from;
    const bw = Math.min(380, W - 120), bh = 10, bx = -bw / 2, by = y + 30;
    const name = txt(bx, y + 9, hero.name, 18, RESULT_GOLD, HEADING_FONT).setOrigin(0, .5);
    const lv = txt(bx + name.width + 12, y + 10, levelUp ? `Lv.${hero.from}` : `Lv.${hero.to}`, 15, RESULT_IVORY, HEADING_FONT).setOrigin(0, .5);
    const gain = txt(-bx, y + 10, '经验 +0', 13, RESULT_IVORY).setOrigin(1, .5);
    const g = scene.add.graphics().setName('result-xp-bar');
    const fill = (f: number) => {
      g.clear();
      g.fillStyle(0x000000, .55).fillRoundedRect(bx - 2, by - bh / 2 - 2, bw + 4, bh + 4, 7);
      g.fillStyle(0x2a1d12, 1).fillRoundedRect(bx, by - bh / 2, bw, bh, 6);
      const fw = Math.max(0, Math.min(1, f)) * bw;
      if (fw > 2) { g.fillStyle(0xc9902f, 1).fillRoundedRect(bx, by - bh / 2, fw, bh, 6); g.fillStyle(0xffe6a8, .45).fillRoundedRect(bx + 2, by - bh / 2 + 2, Math.max(0, fw - 4), bh * .38, 3); }
      g.lineStyle(1, GOLD, .8).strokeRoundedRect(bx - 1, by - bh / 2 - 1, bw + 2, bh + 2, 6);
    };
    const end = hero.capped ? 1 : Math.max(.04, Math.min(1, o.xpFraction ?? 1));
    const start = levelUp ? .35 : Math.max(0, end - .35);
    fill(start);
    const pop = txt(0, y + 9, '升级！', 20, '#ffd27a', TITLE_FONT).setName('result-levelup').setAlpha(0);
    // 「升级！」放在等级字（升级后变长为「Lv.a → Lv.b」）右侧
    const lvFinal = lv.text; lv.setText(levelUp ? `Lv.${hero.from} → Lv.${hero.to}` : lvFinal); const lvW = lv.width; lv.setText(lvFinal);
    pop.setX(lv.x + lvW + 40);
    root.add([g, name, lv, gain, pop]);
    anims.push({ start: 150, dur: 1000, step: p => gain.setText('经验 +' + Math.round(hero.xp * easeOut(p))) });
    if (levelUp) {
      anims.push({ start: 250, dur: 450, step: p => fill(start + (1 - start) * easeOut(p)) });
      anims.push({ start: 700, dur: 320, step: p => { pop.setAlpha(Math.min(1, p * 2)).setScale(p < .6 ? .6 + p : 1.2 - (p - .6) * .5); if (p > .2) lv.setText(`Lv.${hero.from} → Lv.${hero.to}`).setColor(RESULT_GOLD); } });
      anims.push({ start: 760, dur: 420, step: p => fill(end * easeOut(p)) });
    } else anims.push({ start: 250, dur: 800, step: p => fill(start + (end - start) * easeOut(p)) });
    y += 54;
  }

  // ② 奖励印章格 + 首领遗珍卡
  const num = (re: RegExp) => { const m = pick(L, re); return m ? Number(m[1]) : 0; };
  const relics = o.relic ? 1 : 0;
  const tiles: Array<{ key: string; glyph: string; label: string; n: number; prefix?: string; suffix?: string }> = [
    { key: '本场战功', glyph: '功', label: '战功', n: num(/^本场战功\s+\+(\d+)/), prefix: '+' },
    { key: '永久奖励', glyph: '钱', label: '钱币', n: num(/^(?:永久奖励|挑战|军情)\s*(?:·\s*)?(?:钱币|军粮) \+(\d+)/) + num(/^经验已满\s+折(?:钱币|军粮) \+(\d+)/), prefix: '+' }, // 2026-11-21 军粮改钱币：结算行写「钱币 +N」
    { key: '营寨', glyph: '田', label: '屯田', n: num(/^营寨 · 农田 \+(\d+)/), prefix: '+' },
    { key: '武学残卷', glyph: '卷', label: '武学残卷', n: num(/^武学残卷\s+\+(\d+)/), prefix: '+' },
    { key: '缴获兵装', glyph: '甲', label: '兵装', n: Math.max(0, num(/^缴获兵装\s+(\d+) 件/) - relics), suffix: ' 件' },
  ].filter(t => t.n > 0 && (!o.only || o.only.test(t.key)));
  const RW = o.relic ? 150 : 0, gap = 8, n = tiles.length;
  const TW = n ? Math.max(70, Math.min(96, (W - 40 - RW - (RW ? 16 : 0) - (n - 1) * gap) / n)) : 0;
  const total = n * TW + Math.max(0, n - 1) * gap + (RW ? (n ? 16 : 0) + RW : 0);
  if (tiles.length || RW) {
    const ty = y + 32;
    let x = -total / 2;
    const ring = bagArt(scene, 'medal_frame');
    tiles.forEach((t, i) => {
      const c = scene.add.container(x + TW / 2, ty).setName('result-tile-' + t.label).setAlpha(0);
      const disc = scene.add.graphics();
      disc.fillStyle(0x000000, .45).fillCircle(0, 3, 26).fillStyle(0x2b1a10, 1).fillCircle(0, 0, 24).fillStyle(0x5a2a17, .55).fillCircle(0, -3, 18);
      if (!ring) disc.lineStyle(3, GOLD, 1).strokeCircle(0, 0, 25).lineStyle(1, GOLD_HI, .6).strokeCircle(0, 0, 20);
      c.add(disc);
      if (ring) c.add(scene.add.image(0, 0, ring).setDisplaySize(58, 58));
      c.add(txt(0, -1, t.glyph, 23, '#f6dfa6', TITLE_FONT));
      const num = txt(0, 42, (t.prefix ?? '') + '0' + (t.suffix ?? ''), 18, RESULT_GOLD, HEADING_FONT).setName('result-num');
      c.add([num, txt(0, 62, t.label, 12, RESULT_IVORY).setAlpha(.82)]);
      root.add(c);
      const s0 = 380 + i * 120;
      anims.push({ start: s0, dur: 220, step: p => c.setAlpha(p).setY(ty + 8 * (1 - easeOut(p))) });
      anims.push({ start: s0 + 80, dur: 700, step: p => num.setText((t.prefix ?? '') + Math.round(t.n * easeOut(p)) + (t.suffix ?? '')) });
      x += TW + gap;
    });
    if (o.relic) {
      x += n ? 16 - gap : 0;
      const it = o.relic, q = QUALITIES[it.quality], def = relicDef(it.base);
      const card = scene.add.container(x + RW / 2, ty + 14).setName('result-relic').setScale(0, 1);
      const bg = scene.add.graphics();
      bg.fillStyle(0x000000, .5).fillRoundedRect(-RW / 2 + 3, -50, RW, 106, 8).fillStyle(0x1d130c, 1).fillRoundedRect(-RW / 2, -53, RW, 106, 8)
        .fillStyle(q.color, .14).fillRoundedRect(-RW / 2 + 3, -50, RW - 6, 42, 6)
        .lineStyle(2, q.color, 1).strokeRoundedRect(-RW / 2, -53, RW, 106, 8).lineStyle(1, GOLD, .5).strokeRoundedRect(-RW / 2 + 5, -48, RW - 10, 96, 5);
      card.add(bg);
      card.add(itemTile(scene, 0, -20, 52, it));
      card.add(txt(0, 18, itemName(it), 16, q.css, HEADING_FONT));
      card.add(txt(0, 38, (def ? def.boss + ' · ' : '') + '首领遗珍', 11, RESULT_IVORY).setAlpha(.8));
      root.add(card);
      anims.push({ start: 900, dur: 380, step: p => card.setScale(Math.sin(p * Math.PI / 2), 1).setAlpha(Math.min(1, p * 1.6)) });
    }
    y += 106;
  }
  return { root, anims, height: y, levelUp };
}

/**
 * 播放一组动画（rAF 驱动，不受场景暂停影响）；返回「跳到结尾」。全部放完后回调 onDone。
 * alive：动画对象是否还在（场景 restart 后同一个 Scene 仍 isActive，但旧对象已销毁，不能再写）。
 */
export function playResultAnims(scene: Phaser.Scene, anims: ResultAnim[], onDone: () => void, alive: () => boolean = () => true): () => void {
  const endAt = anims.reduce((m, a) => Math.max(m, a.start + a.dur), 0);
  let done = false, raf = 0;
  const t0 = performance.now();
  const ok = () => !!scene.sys?.isActive() && alive();
  const apply = (t: number) => { for (const a of anims) { const p = Math.max(0, Math.min(1, (t - a.start) / a.dur)); if (t >= a.start) a.step(p); } };
  const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); window.clearTimeout(guard); if (ok()) { apply(Infinity); onDone(); } };
  const tick = () => { if (done || !ok()) return; const t = performance.now() - t0; if (t >= endAt) { finish(); return; } apply(t); raf = requestAnimationFrame(tick); };
  // 页面在后台时 rAF 停摆：到时间直接放完
  const guard = window.setTimeout(finish, endAt + 250);
  apply(0); raf = requestAnimationFrame(tick);
  return finish;
}
