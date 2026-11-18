import Phaser from 'phaser';
import { DEPTH, FONT, HEADING_FONT, TITLE_FONT } from '../config';
import { inkPlate } from './HomeCommand';

/**
 * 章节告捷弹窗（漆金卷轴）：深色漆底 + 双层描金线 + 四角菱饰（同 HomePlaque 一系），
 * 顶部军营图横幅渐隐入漆底，朱砂「捷」印、描金大标题、路线指引（节点 + 连线箭头），漆金按钮带悬停 / 按下态。
 * 只负责表现：容器命名 name，按钮命中区命名 confirmName（测试与旧逻辑沿用），点击回调由场景决定。
 * 不用 tween：关卡结束时战斗计时器已暂停，状态切换均为即时重绘。
 * 电脑版（2026-11-17 结算 UI 统一）：大标题用书法标题字 + 金色，正文象牙白，确认按钮换水墨笔触主按钮（同主页 / 结算）。
 */
export interface VictoryNoticeOptions {
  name: string; confirmName: string;
  kicker: string; title: string; lines: string[]; route: string[];
  confirm: string; background?: string; onConfirm: () => void;
}

const GOLD = 0xc9a35e, GOLD_HI = 0xf3d48a, LACQUER = 0x1b120b, LACQUER_HI = 0x3a2616, CINNABAR = 0x9a2a1c;

function diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  g.fillTriangle(x - r, y, x, y - r, x + r, y).fillTriangle(x - r, y, x, y + r, x + r, y);
}

export function chapterVictoryNotice(scene: Phaser.Scene, W: number, H: number, desk: boolean, o: VictoryNoticeOptions): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay + 10).setName(o.name);
  const text = (x: number, y: number, value: string, size: number, color: string, heading = false) => scene.add.text(x, y, value, {
    fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, align: 'center', resolution: 2,
  }).setOrigin(.5).setScrollFactor(0);

  // 背景压暗 + 吞掉点击
  root.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x0c0805, .84).setScrollFactor(0).setInteractive());

  const pw = desk ? 600 : Math.min(492, W - 40), ph = desk ? 470 : 640;
  const x0 = (W - pw) / 2, y0 = Math.round((H - ph) / 2), cx = W / 2;
  const bannerH = desk ? 150 : 210;

  // 漆底
  const base = scene.add.graphics().setScrollFactor(0);
  base.fillStyle(0x000000, .45).fillRoundedRect(x0 + 4, y0 + 6, pw, ph, 10);
  base.fillStyle(LACQUER, .98).fillRoundedRect(x0, y0, pw, ph, 10);
  root.add(base);

  // 顶部军营横幅（按比例裁切铺满），向下渐隐入漆底
  if (o.background && scene.textures.exists(o.background)) {
    const img = scene.add.image(cx, y0 + 6 + bannerH / 2, o.background).setScrollFactor(0);
    const iw = img.width, ih = img.height, bw = pw - 12, s = Math.max(bw / iw, bannerH / ih);
    const cw = bw / s, ch = bannerH / s;
    img.setCrop((iw - cw) / 2, (ih - ch) * .45, cw, ch).setScale(s).setAlpha(.92);
    root.add(img);
  }
  const fade = scene.add.graphics().setScrollFactor(0);
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const fy = y0 + 6 + bannerH * .35 + (bannerH * .65) * i / steps;
    fade.fillStyle(LACQUER, Math.pow((i + 1) / steps, 1.4)).fillRect(x0 + 6, fy, pw - 12, bannerH * .65 / steps + 1);
  }
  fade.fillStyle(0x000000, .25).fillRect(x0 + 6, y0 + 6, pw - 12, bannerH * .35);
  // 漆面微光：自横幅下沿向下渐弱，避免出现硬边
  for (let i = 0; i < steps; i++) fade.fillStyle(LACQUER_HI, .22 * (1 - i / steps)).fillRect(x0 + 6, y0 + 6 + bannerH + (ph - bannerH) * .4 * i / steps, pw - 12, (ph - bannerH) * .4 / steps + 1);
  root.add(fade);

  // 双层描金线 + 四角菱饰
  const trim = scene.add.graphics().setScrollFactor(0);
  trim.lineStyle(2, GOLD, .95).strokeRoundedRect(x0 + 4, y0 + 4, pw - 8, ph - 8, 8);
  trim.lineStyle(1, GOLD, .45).strokeRoundedRect(x0 + 11, y0 + 11, pw - 22, ph - 22, 5);
  trim.fillStyle(GOLD_HI, 1);
  for (const [px, py] of [[x0 + 4, y0 + 4], [x0 + pw - 4, y0 + 4], [x0 + 4, y0 + ph - 4], [x0 + pw - 4, y0 + ph - 4]]) diamond(trim, px, py, 6);
  trim.fillStyle(GOLD, 1);
  for (const [px, py] of [[x0 + 11, y0 + 11], [x0 + pw - 11, y0 + 11], [x0 + 11, y0 + ph - 11], [x0 + pw - 11, y0 + ph - 11]]) diamond(trim, px, py, 3);
  root.add(trim);

  // 小标题缎带（章节 · 告捷）
  let y = y0 + bannerH - (desk ? 34 : 44);
  const kicker = text(cx, y, o.kicker, desk ? 15 : 18, '#f2ddae');
  const rw = kicker.width + 64, rh = desk ? 28 : 34;
  const ribbon = scene.add.graphics().setScrollFactor(0);
  ribbon.fillStyle(0x5a1d14, .95).fillRect(cx - rw / 2, y - rh / 2, rw, rh)
    .fillTriangle(cx - rw / 2, y - rh / 2, cx - rw / 2 - 12, y - rh / 2, cx - rw / 2, y)
    .fillTriangle(cx - rw / 2, y + rh / 2, cx - rw / 2 - 12, y + rh / 2, cx - rw / 2, y)
    .fillTriangle(cx + rw / 2, y - rh / 2, cx + rw / 2 + 12, y - rh / 2, cx + rw / 2, y)
    .fillTriangle(cx + rw / 2, y + rh / 2, cx + rw / 2 + 12, y + rh / 2, cx + rw / 2, y);
  ribbon.lineStyle(1, GOLD, .8).lineBetween(cx - rw / 2, y - rh / 2 + 3, cx + rw / 2, y - rh / 2 + 3).lineBetween(cx - rw / 2, y + rh / 2 - 3, cx + rw / 2, y + rh / 2 - 3);
  root.add([ribbon, kicker]);

  // 朱砂「捷」印（压在横幅右下角）
  const sealS = desk ? 46 : 58, sx = x0 + pw - (desk ? 56 : 62), sy = y0 + (desk ? 50 : 62);
  const seal = scene.add.graphics().setScrollFactor(0);
  seal.fillStyle(CINNABAR, .92).fillRoundedRect(sx - sealS / 2, sy - sealS / 2, sealS, sealS, 6)
    .lineStyle(2, 0xf0c9a0, .8).strokeRoundedRect(sx - sealS / 2 + 4, sy - sealS / 2 + 4, sealS - 8, sealS - 8, 4);
  root.add([seal, text(sx, sy, '捷', Math.round(sealS * .58), '#fbe7cc', true)]);

  // 描金大标题
  y = y0 + bannerH + (desk ? 18 : 28);
  const title = text(cx, y, o.title, desk ? 38 : 40, desk ? '#efd399' : '#f6dc9a', true)
    .setStroke(desk ? '#120904' : '#2a170b', 6).setShadow(0, 3, '#000000', 6, true, true);
  if (desk) title.setFontFamily(TITLE_FONT).setLetterSpacing(4);
  root.add(title);

  // 分隔：细线 + 中央菱饰
  y += desk ? 36 : 44;
  const div = scene.add.graphics().setScrollFactor(0);
  div.lineStyle(1, GOLD, .7).lineBetween(cx - 150, y, cx - 12, y).lineBetween(cx + 12, y, cx + 150, y);
  div.fillStyle(GOLD_HI, 1); diamond(div, cx, y, 5);
  div.fillStyle(GOLD, .8); diamond(div, cx - 150, y, 2.5); diamond(div, cx + 150, y, 2.5);
  root.add(div);

  // 叙述
  y += desk ? 40 : 50;
  root.add(text(cx, y, o.lines.join('\n'), desk ? 17 : 20, desk ? '#e8d8b2' : '#eadcbd').setLineSpacing(desk ? 10 : 14).setStroke('#120904', desk ? 3 : 0));

  // 路线指引：节点 + 连线箭头，首节点为「当前」，末节点为朱砂目的地
  y += desk ? 74 : 96;
  const n = o.route.length, span = Math.min(pw - (desk ? 140 : 96), desk ? 420 : 380), step = n > 1 ? span / (n - 1) : 0, r = desk ? 13 : 16;
  const routeG = scene.add.graphics().setScrollFactor(0);
  root.add(routeG);
  for (let i = 0; i < n; i++) {
    const nx = cx - span / 2 + i * step, last = i === n - 1, first = i === 0;
    if (i < n - 1) {
      const ax = nx + r + 6, bx = nx + step - r - 6;
      routeG.lineStyle(2, GOLD, .55);
      for (let dx = ax; dx < bx - 8; dx += 9) routeG.lineBetween(dx, y, Math.min(dx + 5, bx - 8), y);
      routeG.fillStyle(GOLD, .9).fillTriangle(bx, y, bx - 8, y - 5, bx - 8, y + 5);
    }
    routeG.fillStyle(last ? CINNABAR : first ? 0x6b4a22 : 0x2a1a0f, 1).fillCircle(nx, y, r);
    routeG.lineStyle(first || last ? 2 : 1.5, first || last ? GOLD_HI : GOLD, 1).strokeCircle(nx, y, r);
    if (first) routeG.lineStyle(1, GOLD_HI, .4).strokeCircle(nx, y, r + 5);
    root.add(text(nx, y, String(i + 1), desk ? 13 : 15, '#fbe7cc', true));
    root.add(text(nx, y + r + (desk ? 15 : 19), o.route[i], desk ? 15 : 18, last ? '#f0b48a' : first ? '#f6dc9a' : '#cdb88c'));
  }

  // 漆金按钮：悬停描金变亮，按下下沉
  const bw = desk ? 260 : 300, bh = desk ? 52 : 62, by = y0 + ph - (desk ? 62 : 74);
  const btn = scene.add.graphics().setScrollFactor(0);
  const label = text(cx, by, o.confirm, desk ? 21 : 24, '#ffe9bd', true).setStroke('#2a170b', 3);
  const inkArt = desk && scene.textures.exists('btn_ink_primary_normal');
  let plate: Phaser.GameObjects.NineSlice | null = null;
  if (inkArt) label.setColor('#f8e6bf').setStroke('#2a0c06', 3).setLetterSpacing(3);
  const paint = (state: 'idle' | 'hover' | 'down') => {
    if (inkArt) { plate = inkPlate(scene, plate, cx, by, bw, bh, true, state === 'down' ? 'pressed' : state === 'hover' ? 'hover' : 'normal'); plate?.setScrollFactor(0); label.setY(by + (state === 'down' ? 1 : 0)).setColor(state === 'hover' ? '#fff3d4' : '#f8e6bf'); return; }
    const d = state === 'down' ? 2 : 0, hi = state !== 'idle';
    btn.clear();
    btn.fillStyle(0x000000, .4).fillRoundedRect(cx - bw / 2 + 2, by - bh / 2 + 4, bw, bh, 8);
    btn.fillStyle(state === 'down' ? 0x5a3c1c : hi ? 0x8a5f2a : 0x6e4a22, 1).fillRoundedRect(cx - bw / 2, by - bh / 2 + d, bw, bh, 8);
    btn.fillStyle(0xffe2a0, state === 'down' ? .06 : hi ? .2 : .12).fillRoundedRect(cx - bw / 2 + 3, by - bh / 2 + d + 3, bw - 6, bh * .42, { tl: 6, tr: 6, bl: 0, br: 0 });
    btn.lineStyle(1.5, hi ? GOLD_HI : GOLD, 1).strokeRoundedRect(cx - bw / 2 + 4, by - bh / 2 + d + 4, bw - 8, bh - 8, 5);
    btn.fillStyle(hi ? GOLD_HI : GOLD, 1); diamond(btn, cx - bw / 2 + 4, by + d, 4); diamond(btn, cx + bw / 2 - 4, by + d, 4);
    label.setY(by + d).setColor(hi ? '#fff3d6' : '#ffe9bd');
  };
  paint('idle');
  const hit = scene.add.rectangle(cx, by, bw, bh, 0xffffff, .001).setScrollFactor(0).setInteractive({ useHandCursor: true }).setName(o.confirmName);
  hit.on('pointerover', () => paint('hover')).on('pointerout', () => paint('idle'))
    .on('pointerup', () => paint('hover'))
    .on('pointerdown', () => { paint('down'); o.onConfirm(); });
  root.add(plate ? [plate, label, hit] : [btn, label, hit]);
  return root;
}
