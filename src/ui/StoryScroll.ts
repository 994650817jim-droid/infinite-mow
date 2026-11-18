import Phaser from 'phaser';
import { DEPTH, FONT, HEADING_FONT } from '../config';
import { inkPlate } from './HomeCommand';

/**
 * 剧情卷轴（漆金卷轴同款，见 ChapterVictoryNotice）：逐句对白，点一下翻下一句，最后一页显示奖励和确认按钮。
 * 不用 tween（关卡结束时战斗计时器已暂停）。容器名 name，下一句命中区 name+'-next'，确认按钮 confirmName。
 * illustration：剧情专属插画（2026-11-17 献马剧情起）。贴图已加载时横幅加高、整张卷轴同步加长（台词区高度不变，不会被挡），
 * 插画按横幅比例取画面中间偏上的一段；缺图时退回 background 通用横幅和原尺寸。
 * 剧情系统（2026-11-17，systems/Story.ts）新增：每句可带说话人水墨立绘 portrait（贴图键，取上半身）或名字章 seal（还没有立绘的人物），
 * 对白左侧留一栏显示；tip 句以「提示」样式显示；skip 给出时右下角有「跳过」，Esc 也能跳过（跳过直接结束、回调 skip）。
 */
export interface StoryLine { who?: string; text: string; portrait?: string; seal?: string; tip?: boolean }
export interface StoryScrollOptions {
  name: string; confirmName: string; kicker: string; title: string;
  lines: StoryLine[]; reward: string; confirm: string; background?: string; illustration?: string; onDone: () => void;
  /** 给出时显示「跳过」按钮并响应 Esc：直接关掉卷轴，调用 skip（不再调 onDone）。 */
  skip?: () => void;
  /** 抉择（剧情 choice 节点，第三章起）：最后一页不显示确认按钮，改成这几个选项；点了关掉卷轴并回调 onChoice(序号)。按钮名 name+'-choice-序号'。 */
  choices?: readonly string[]; onChoice?: (index: number) => void;
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
  const cast = o.lines.some(l => l.portrait || l.seal), col = cast ? (desk ? 150 : 104) : 0;
  const ty = y0 + bannerH + (desk ? 46 : 58), tw = pw - (desk ? 96 : 56) - col, tx = x0 + (desk ? 48 : 28) + col;
  const who = text(tx, ty, '', desk ? 18 : 20, '#f0b48a', true);
  const say = text(tx, ty + (desk ? 30 : 34), '', desk ? 18 : 20, '#eadcbd').setWordWrapWidth(tw, true).setLineSpacing(desk ? 8 : 10);
  // 说话人：水墨立绘（取上半身，贴在对白区左下）或朱红名字章
  const faceH = desk ? 168 : 150, faceX = x0 + (desk ? 22 : 14) + col / 2, faceY = y0 + ph - (desk ? 78 : 96);
  const face = scene.add.image(faceX, faceY, '__WHITE').setOrigin(.5, 1).setScrollFactor(0).setVisible(false).setName(o.name + '-portrait');
  const sealBox = scene.add.graphics().setScrollFactor(0).setVisible(false);
  const sealText = text(faceX, faceY - faceH * .45, '', desk ? 22 : 20, '#fff1dc', true).setOrigin(.5).setVisible(false).setName(o.name + '-seal');
  const showFace = (l: StoryLine): void => {
    face.setVisible(false); sealBox.setVisible(false); sealText.setVisible(false);
    if (l.portrait && scene.textures.exists(l.portrait)) {
      const tex = scene.textures.get(l.portrait).getSourceImage() as { width: number; height: number }, cropH = tex.height * .56, k = faceH / cropH;
      face.setTexture(l.portrait).setCrop(0, 0, tex.width, cropH).setScale(k).setOrigin(.5, cropH / tex.height).setVisible(true);
    } else if (l.seal) {
      const name = l.seal.length > 2 ? l.seal.slice(0, 2) : l.seal, sw = desk ? 74 : 64;
      sealBox.clear().fillStyle(0x9a2a1a, .95).fillRoundedRect(faceX - sw / 2, faceY - faceH * .45 - sw / 2, sw, sw, 6).lineStyle(2, 0xf3d48a, .8).strokeRoundedRect(faceX - sw / 2 + 4, faceY - faceH * .45 - sw / 2 + 4, sw - 8, sw - 8, 4).setVisible(true);
      sealText.setText(name.length === 2 ? name[0] + '\n' + name[1] : name).setFontSize(name.length === 2 ? (desk ? 22 : 20) : (desk ? 34 : 30)).setLineSpacing(-2).setAlign('center').setVisible(true);
    }
  };
  if (cast) root.add([face, sealBox, sealText]); else { face.destroy(); sealBox.destroy(); sealText.destroy(); }
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
    const named = !!l.who || !!l.tip;
    who.setText(l.tip ? '提示' : l.who ? l.who + '：' : '').setColor(l.tip ? '#9fd59a' : l.who ? '#f0b48a' : '#b9a57a');
    say.setText(l.text).setY(ty + (named ? (desk ? 30 : 34) : 0)).setColor(l.tip ? '#cfe8c4' : l.who ? '#eadcbd' : '#cdb88c');
    if (cast) showFace(l);
    page.setText(`${i + 1} / ${o.lines.length}`).setVisible(!last);
    reward.setVisible(last); label.setText(last ? o.confirm : '继续 ▸');
    hit.setName(last ? o.confirmName : o.name + '-next');
    // 抉择：最后一页把确认按钮换成选项
    const pick = last && !!o.choices?.length;
    for (const x of [btn, label, hit, plate]) x?.setVisible(!pick);
    if (pick) hit.disableInteractive(); else hit.setInteractive({ useHandCursor: true });
    for (const c of choiceBtns) c.setVisible(pick);
  };
  // 抉择按钮（两个并排；三个以上时缩窄）
  const choiceBtns: Phaser.GameObjects.Container[] = [];
  (o.choices ?? []).forEach((c, k, all) => {
    const cw = Math.min(desk ? 220 : 200, (pw - 80) / all.length - 16), cxk = cx + (k - (all.length - 1) / 2) * (cw + 24);
    const g = scene.add.graphics().setScrollFactor(0), t = text(0, 0, c, desk ? 19 : 20, '#ffe9bd', true).setOrigin(.5).setStroke('#2a170b', 3);
    const draw = (hi: boolean): void => { g.clear().fillStyle(0x000000, .4).fillRoundedRect(-cw / 2 + 2, -bh / 2 + 4, cw, bh, 8).fillStyle(hi ? 0x8a3a22 : 0x6a2a18, 1).fillRoundedRect(-cw / 2, -bh / 2, cw, bh, 8).lineStyle(1.5, hi ? GOLD_HI : GOLD, 1).strokeRoundedRect(-cw / 2 + 4, -bh / 2 + 4, cw - 8, bh - 8, 5); };
    draw(false);
    const hz = scene.add.rectangle(0, 0, cw, bh, 0, 0).setScrollFactor(0).setInteractive({ useHandCursor: true }).setName(o.name + '-choice-' + k);
    hz.on('pointerover', () => draw(true)).on('pointerout', () => draw(false)).on('pointerup', () => { root.destroy(); o.onChoice?.(k); });
    const box = scene.add.container(cxk, by, [g, t, hz]).setScrollFactor(0).setVisible(false).setName(o.name + '-choice-box-' + k);
    choiceBtns.push(box); root.add(box);
  });
  if (o.skip) {
    const skipText = text(x0 + pw - (desk ? 30 : 20), by, '跳过 ▸▸', desk ? 15 : 16, '#c9b48a', true).setOrigin(1, .5).setInteractive({ useHandCursor: true }).setName(o.name + '-skip');
    const esc = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    const doSkip = (): void => { if (!root.active) return; esc?.off('down', doSkip); scene.data?.set('storyEscAt', performance.now()); root.destroy(); o.skip!(); };
    skipText.on('pointerup', doSkip); esc?.on('down', doSkip);
    root.once('destroy', () => esc?.off('down', doSkip));
    root.add(skipText);
  }
  hit.on('pointerover', () => paint(true)).on('pointerout', () => paint(false)).on('pointerup', () => {
    if (i < o.lines.length - 1) { i++; show(); return; }
    root.destroy(); o.onDone();
  });
  show();
  return root;
}
