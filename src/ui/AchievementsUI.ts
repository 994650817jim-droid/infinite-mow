/** 主页「成就」面板：按分组列出全部成就，已解锁的显示日期；手机分页。 */
import Phaser from 'phaser';
import {FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, IS_DESKTOP, TITLE_FONT } from '../config';
import { homeCommand, warPanelTexture } from './HomeCommand';
import { ACHIEVEMENTS, unlockedMap } from '../systems/Achievements';

export class AchievementsUI {
  readonly root: Phaser.GameObjects.Container;
  private page = 0;
  private body?: Phaser.GameObjects.Container;
  constructor(private scene: Phaser.Scene) {
    const W = GAME_WIDTH, H = GAME_HEIGHT, D = IS_DESKTOP;
    this.root = scene.add.container(0, 0).setDepth(530).setName('achievements-panel');
    this.root.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x130d09, .97).setInteractive());
    const done = Object.keys(unlockedMap()).filter(id => ACHIEVEMENTS.some(a => a.id === id)).length;
    this.root.add(scene.add.text(W / 2, D ? 40 : 80, '成 就', { fontFamily: D ? TITLE_FONT : HEADING_FONT, fontSize: '28px', color: '#efd399', resolution: 2 }).setOrigin(.5).setLetterSpacing(8));
    this.root.add(scene.add.text(W / 2, D ? 72 : 116, `已达成 ${done} / ${ACHIEVEMENTS.length}`, { fontFamily: FONT, fontSize: '14px', color: '#c9bf99', resolution: 2 }).setOrigin(.5).setName('achievements-count'));
    const pageCount = Math.ceil(ACHIEVEMENTS.length / this.perPage); // 只有一页时「返回」居中（2026-11-17 UI 审查：原来偏左，右边留着不显示的「下一页」位）
    const back = homeCommand(scene, D && pageCount > 1 ? W / 2 - 100 : W / 2, D ? H - 34 : H - 70, 160, 42, '返回');
    back.hit.setName('achievements-close').setData('padDefault', true).on('pointerdown', () => this.root.destroy());
    this.root.add([back.g, back.hit, back.caption]);
    const pages = Math.ceil(ACHIEVEMENTS.length / this.perPage);
    if (pages > 1) {
      const next = homeCommand(scene, D ? W / 2 + 100 : W / 2, D ? H - 34 : H - 124, 160, 42, '下一页');
      next.hit.setName('achievements-next').on('pointerdown', () => { this.page = (this.page + 1) % pages; this.render(); });
      this.root.add([next.g, next.hit, next.caption]);
      this.pageCaption = next.caption; this.pages = pages;
    }
    this.render();
    // 成就图标（public/assets/achievements/<id>.webp）按需加载，加载完成后重绘
    const missing = ACHIEVEMENTS.filter(a => !scene.textures.exists('ach_' + a.id));
    if (missing.length) { for (const a of missing) scene.load.image('ach_' + a.id, `assets/achievements/${a.id}.webp`); scene.load.once('complete', () => { if (this.root.active) this.render(); }); scene.load.start(); }
  }
  private get perPage(): number { return IS_DESKTOP ? 24 : 12; }
  private pageCaption?: Phaser.GameObjects.Text;
  private pages = 1;
  private render(): void {
    this.body?.destroy();
    // 翻页按钮带页码，玩家知道一共几页、现在在第几页
    this.pageCaption?.setText(`下一页 · ${this.page + 1}/${this.pages}`).setLetterSpacing(1);
    const s = this.scene, W = GAME_WIDTH, D = IS_DESKTOP, got = unlockedMap();
    this.body = s.add.container(0, 0); this.root.add(this.body);
    const list = ACHIEVEMENTS.slice(this.page * this.perPage, this.page * this.perPage + this.perPage);
    const cols = D ? 2 : 1, cw = D ? (W - 60) / 2 : W - 32, ch = D ? 29 : 54, top = D ? 88 : 146;
    list.forEach((a, i) => {
      const col = i % cols, row = Math.floor(i / cols), x = (D ? 20 : 16) + col * (cw + 20), y = top + row * (ch + (D ? 2 : 6)), on = !!got[a.id];
      this.body!.add(s.add.image(x + cw / 2, y + ch / 2, warPanelTexture(s, cw, ch, on)).setDisplaySize(cw + 16, ch + 16).setAlpha(on ? 1 : .55));
      if (s.textures.exists('ach_' + a.id)) { const icon = s.add.image(x + 18, y + ch / 2, 'ach_' + a.id).setDisplaySize(ch - 2, ch - 2); if (!on) icon.setTint(0x6a6560).setAlpha(.55); this.body!.add(icon); }
      else this.body!.add(s.add.text(x + 12, y + ch / 2, on ? '◆' : '◇', { fontFamily: FONT, fontSize: '14px', color: on ? '#f0c76a' : '#6f6658', resolution: 2 }).setOrigin(0, .5));
      const name = s.add.text(x + (D ? 38 : 50), D ? y + ch / 2 : y + 16, `${a.name}`, { fontFamily: HEADING_FONT, fontSize: '15px', color: on ? '#f4d99f' : '#9a9080', resolution: 2 }).setOrigin(0, .5).setName('ach-' + a.id);
      const desc = s.add.text(D ? x + 134 : x + 50, D ? y + ch / 2 : y + 38, a.desc, { fontFamily: FONT, fontSize: '12px', color: on ? '#d8cdb4' : '#857b6c', resolution: 2 }).setOrigin(0, .5);
      this.body!.add([name, desc]);
      if (on) this.body!.add(s.add.text(x + cw - 10, y + ch / 2, new Date(got[a.id]).toLocaleDateString('zh-CN'), { fontFamily: FONT, fontSize: '11px', color: '#a99d88', resolution: 2 }).setOrigin(1, .5));
      else this.body!.add(s.add.text(x + cw - 10, y + ch / 2, a.group, { fontFamily: FONT, fontSize: '11px', color: '#6f6658', resolution: 2 }).setOrigin(1, .5));
    });
  }
}
