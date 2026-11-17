import Phaser from 'phaser';
import { DEPTH, FONT, HEADING_FONT } from '../config';

/**
 * 剧情卷轴（漆金卷轴同款，见 ChapterVictoryNotice）：逐句对白，点一下翻下一句，最后一页显示奖励和确认按钮。
 * 不用新美术；不用 tween（关卡结束时战斗计时器已暂停）。容器名 name，下一句命中区 name+'-next'，确认按钮 confirmName。
 */
export interface StoryLine { who?: string; text: string }
export interface StoryScrollOptions {
  name: string; confirmName: string; kicker: string; title: string;
  lines: StoryLine[]; reward: string; confirm: string; background?: string; onDone: () => void;
}

const GOLD = 0xc9a35e, GOLD_HI = 0xf3d48a, LACQUER = 0x1b120b;

export function storyScroll(scene: Phaser.Scene, W: number, H: number, desk: boolean, o: StoryScrollOptions): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay + 11).setName(o.name);
  const text = (x: number, y: number, value: string, size: number, color: string, heading = false) => scene.add.text(x, y, value, {
    fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2,
  }).setScrollFactor(0);
  const pw = desk ? 640 : Math.min(500, W - 32), ph = desk ? 420 : 560, x0 = (W - pw) / 2, y0 = Math.round((H - ph) / 2), cx = W / 2;
  const bannerH = desk ? 120 : 160;

  root.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x0c0805, .84).setScrollFactor(0).setInteractive());
  const base = scene.add.graphics().setScrollFactor(0);
  base.fillStyle(0x000000, .45).fillRoundedRect(x0 + 4, y0 + 6, pw, ph, 10).fillStyle(LACQUER, .98).fillRoundedRect(x0, y0, pw, ph, 10);
  root.add(base);
  if (o.background && scene.textures.exists(o.background)) {
    const img = scene.add.image(cx, y0 + 6 + bannerH / 2, o.background).setScrollFactor(0);
    const bw = pw - 12, s = Math.max(bw / img.width, bannerH / img.height), cw = bw / s, ch = bannerH / s;
    img.setCrop((img.width - cw) / 2, (img.height - ch) * .45, cw, ch).setScale(s).setAlpha(.85);
    root.add(img);
  }
  const fade = scene.add.graphics().setScrollFactor(0);
  for (let i = 0; i < 16; i++) fade.fillStyle(LACQUER, Math.pow((i + 1) / 16, 1.4)).fillRect(x0 + 6, y0 + 6 + bannerH * .3 + bannerH * .7 * i / 16, pw - 12, bannerH * .7 / 16 + 1);
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
  const paint = (hi: boolean) => {
    btn.clear().fillStyle(0x000000, .4).fillRoundedRect(cx - bw / 2 + 2, by - bh / 2 + 4, bw, bh, 8)
      .fillStyle(hi ? 0x8a5f2a : 0x6e4a22, 1).fillRoundedRect(cx - bw / 2, by - bh / 2, bw, bh, 8)
      .lineStyle(1.5, hi ? GOLD_HI : GOLD, 1).strokeRoundedRect(cx - bw / 2 + 4, by - bh / 2 + 4, bw - 8, bh - 8, 5);
  };
  paint(false);
  const hit = scene.add.rectangle(cx, by, bw, bh, 0, 0).setScrollFactor(0).setInteractive({ useHandCursor: true }).setName(o.name + '-next');
  root.add([btn, label, hit]);

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
