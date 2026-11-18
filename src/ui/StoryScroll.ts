import Phaser from 'phaser';
import { DEPTH, FONT, HEADING_FONT } from '../config';
import { inkPlate } from './HomeCommand';

/**
 * 剧情卷轴（漆金卷轴同款，见 ChapterVictoryNotice）：逐句对白，点一下翻下一句，最后一页显示奖励和确认按钮。
 * 不用 tween（关卡结束时战斗计时器已暂停）。容器名 name，下一句命中区 name+'-next'，确认按钮 confirmName。
 * illustration：剧情专属插画（2026-11-17 献马剧情起）。贴图已加载时横幅加高、整张卷轴同步加长（台词区高度不变，不会被挡），
 * 插画按横幅比例取画面中间偏上的一段；缺图时退回 background 通用横幅和原尺寸。
 */
export interface StoryLine { who?: string; text: string }
export interface StoryScrollOptions {
  name: string; confirmName: string; kicker: string; title: string;
  lines: StoryLine[]; reward: string; confirm: string; background?: string; illustration?: string; onDone: () => void;
}

const GOLD = 0xc9a35e, GOLD_HI = 0xf3d48a, LACQUER = 0x1b120b;

export function storyScroll(scene: Phaser.Scene, W: number, H: number, desk: boolean, o: StoryScrollOptions): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay + 11).setName(o.name);
  const text = (x: number, y: number, value: string, size: number, color: string, heading = false) => scene.add.text(x, y, value, {
    fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2,
  }).setScrollFactor(0);
  const art = !!o.illustration && scene.textures.exists(o.illustration), extra = art ? (desk ? 90 : 90) : 0;
  const pw = desk ? 640 : Math.min(500, W - 32), ph = (desk ? 420 : 560) + extra, x0 = (W - pw) / 2, y0 = Math.round((H - ph) / 2), cx = W / 2;
  const bannerH = (desk ? 120 : 160) + extra;

  root.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x0c0805, .84).setScrollFactor(0).setInteractive());
  const base = scene.add.graphics().setScrollFactor(0);
  base.fillStyle(0x000000, .45).fillRoundedRect(x0 + 4, y0 + 6, pw, ph, 10).fillStyle(LACQUER, .98).fillRoundedRect(x0, y0, pw, ph, 10);
  root.add(base);
  const banner = art ? o.illustration! : o.background;
  if (banner && scene.textures.exists(banner)) {
    const img = scene.add.image(cx, y0 + 6 + bannerH / 2, banner).setScrollFactor(0).setName(art ? o.name + '-illustration' : o.name + '-banner');
    const bw = pw - 12, s = Math.max(bw / img.width, bannerH / img.height), cw = bw / s, ch = bannerH / s;
    const cy0 = (img.height - ch) * (art ? .42 : .45);
    // setCrop 不会把裁出的部分挪到中心：按裁剪窗口反推位置，让可见部分正好从横幅顶（y0 + 6）开始、不越过上沿金边
    img.setCrop((img.width - cw) / 2, cy0, cw, ch).setScale(s).setAlpha(art ? 1 : .85).setY(y0 + 6 + img.height * s / 2 - cy0 * s);
    root.add(img);
  }
  // 横幅下沿渐隐到漆底；插画只压暗下面一小段（标题文字在那里），尽量不挡画面
  const fade = scene.add.graphics().setScrollFactor(0), f0 = art ? .62 : .3;
  for (let i = 0; i < 16; i++) fade.fillStyle(LACQUER, Math.pow((i + 1) / 16, 1.4)).fillRect(x0 + 6, y0 + 6 + bannerH * f0 + bannerH * (1 - f0) * i / 16, pw - 12, bannerH * (1 - f0) / 16 + 1);
  const trim = scene.add.graphics().setScrollFactor(0);
  trim.lineStyle(2, GOLD, .95).strokeRoundedRect(x0 + 4, y0 + 4, pw - 8, ph - 8, 8).lineStyle(1, GOLD, .45).strokeRoundedRect(x0 + 11, y0 + 11, pw - 22, ph - 22, 5);
  root.add([fade, trim]);
  root.add(text(cx, y0 + bannerH - (desk ? 30 : 38), o.kicker, desk ? 15 : 17, '#f2ddae').setOrigin(.5));
  root.add(text(cx, y0 + bannerH + (desk ? 6 : 12), o.title, desk ? 30 : 34, '#f6dc9a', true).setOrigin(.5).setStroke('#2a170b', 6));

  // 对白区：说话人（描金）+ 台词（自动换行）+ 页码
  const ty = y0 + bannerH + (desk ? 46 : 58), tw = pw - (desk ? 96 : 56);
  const who = text(x0 + (desk ? 48 : 28), ty, '', desk ? 18 : 20, '#f0b48a', true);
  const say = text(x0 + (desk ? 48 : 28), ty + (desk ? 30 : 34), '', desk ? 18 : 20, '#eadcbd').setWordWrapWidth(tw, true).setLineSpacing(desk ? 8 : 10);
  const page = text(x0 + pw - (desk ? 40 : 24), y0 + ph - (desk ? 92 : 108), '', desk ? 13 : 14, '#8d7d60').setOrigin(1, .5);
  const reward = text(cx, y0 + ph - (desk ? 92 : 108), o.reward, desk ? 15 : 16, '#f6dc9a').setOrigin(.5).setVisible(false).setName(o.name + '-reward');
  root.add([who, say, page, reward]);

  // 按钮：前几页是「继续」，最后一页是确认
  const bw = desk ? 260 : 300, bh = desk ? 48 : 58, by = y0 + ph - (desk ? 46 : 54);
  const btn = scene.add.graphics().setScrollFactor(0);
  const label = text(cx, by, '', desk ? 20 : 22, '#ffe9bd', true).setOrigin(.5).setStroke('#2a170b', 3);
  // 电脑版（2026-11-17 UI 审查）：按钮换水墨笔触主按钮，同章节告捷 / 结算
  const inkArt = desk && scene.textures.exists('btn_ink_primary_normal');
  let plate: Phaser.GameObjects.NineSlice | null = null;
  if (inkArt) label.setColor('#f8e6bf').setStroke('#2a0c06', 3).setLetterSpacing(3);
  const paint = (hi: boolean) => {
    if (inkArt) { plate = inkPlate(scene, plate, cx, by, bw, bh, true, hi ? 'hover' : 'normal'); plate?.setScrollFactor(0); label.setColor(hi ? '#fff3d4' : '#f8e6bf'); return; }
    btn.clear().fillStyle(0x000000, .4).fillRoundedRect(cx - bw / 2 + 2, by - bh / 2 + 4, bw, bh, 8)
      .fillStyle(hi ? 0x8a5f2a : 0x6e4a22, 1).fillRoundedRect(cx - bw / 2, by - bh / 2, bw, bh, 8)
      .lineStyle(1.5, hi ? GOLD_HI : GOLD, 1).strokeRoundedRect(cx - bw / 2 + 4, by - bh / 2 + 4, bw - 8, bh - 8, 5);
  };
  paint(false);
  const hit = scene.add.rectangle(cx, by, bw, bh, 0, 0).setScrollFactor(0).setInteractive({ useHandCursor: true }).setName(o.name + '-next');
  root.add(plate ? [plate, label, hit] : [btn, label, hit]);

  let i = 0;
  const show = () => {
    const l = o.lines[i], last = i === o.lines.length - 1;
    who.setText(l.who ? l.who + '：' : '').setColor(l.who ? '#f0b48a' : '#b9a57a');
    say.setText(l.text).setY(ty + (l.who ? (desk ? 30 : 34) : 0)).setColor(l.who ? '#eadcbd' : '#cdb88c');
    page.setText(`${i + 1} / ${o.lines.length}`).setVisible(!last);
    reward.setVisible(last); label.setText(last ? o.confirm : '继续 ▸');
    hit.setName(last ? o.confirmName : o.name + '-next');
  };
  hit.on('pointerover', () => paint(true)).on('pointerout', () => paint(false)).on('pointerup', () => {
    if (i < o.lines.length - 1) { i++; show(); return; }
    root.destroy(); o.onDone();
  });
  show();
  return root;
}
