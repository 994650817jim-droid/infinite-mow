/** 主页「成就」面板：按分组列出全部成就，已解锁的显示日期；手机分页。 */
import Phaser from 'phaser';
import { FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, IS_DESKTOP } from '../config';
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
    this.root.add(scene.add.text(W / 2, D ? 40 : 80, '成 就', { fontFamily: HEADING_FONT, fontSize: '28px', color: '#efd399', resolution: 2 }).setOrigin(.5).setLetterSpacing(8));
    this.root.add(scene.add.text(W / 2, D ? 72 : 116, `已达成 ${done} / ${ACHIEVEMENTS.length}`, { fontFamily: FONT, fontSize: '14px', color: '#c9bf99', resolution: 2 }).setOrigin(.5).setName('achievements-count'));
    const back = homeCommand(scene, D ? W / 2 - 100 : W / 2, D ? H - 34 : H - 70, 160, 42, '返回');
    back.hit.setName('achievements-close').setData('padDefault', true).on('pointerdown', () => this.root.destroy());
    this.root.add([back.g, back.hit, back.caption]);
    const pages = Math.ceil(ACHIEVEMENTS.length / this.perPage);
    if (pages > 1) {
      const next = homeCommand(scene, D ? W / 2 + 100 : W / 2, D ? H - 34 : H - 124, 160, 42, '下一页');
      next.hit.setName('achievements-next').on('pointerdown', () => { this.page = (this.page + 1) % pages; this.render(); });
      this.root.add([next.g, next.hit, next.caption]);
    }
    this.render();
  }
  private get perPage(): number { return IS_DESKTOP ? 24 : 12; }
  private render(): void {
    this.body?.destroy();
    const s = this.scene, W = GAME_WIDTH, D = IS_DESKTOP, got = unlockedMap();
    this.body = s.add.container(0, 0); this.root.add(this.body);
    const list = ACHIEVEMENTS.slice(this.page * this.perPage, this.page * this.perPage + this.perPage);
    const cols = D ? 2 : 1, cw = D ? (W - 60) / 2 : W - 32, ch = D ? 29 : 54, top = D ? 88 : 146;
    list.forEach((a, i) => {
      const col = i % cols, row = Math.floor(i / cols), x = (D ? 20 : 16) + col * (cw + 20), y = top + row * (ch + (D ? 2 : 6)), on = !!got[a.id];
      this.body!.add(s.add.image(x + cw / 2, y + ch / 2, warPanelTexture(s, cw, ch, on)).setDisplaySize(cw + 16, ch + 16).setAlpha(on ? 1 : .55));
      this.body!.add(s.add.text(x + 12, y + ch / 2, on ? '◆' : '◇', { fontFamily: FONT, fontSize: '14px', color: on ? '#f0c76a' : '#6f6658', resolution: 2 }).setOrigin(0, .5));
      const name = s.add.text(x + 32, D ? y + ch / 2 : y + 16, `${a.name}`, { fontFamily: HEADING_FONT, fontSize: '15px', color: on ? '#f4d99f' : '#9a9080', resolution: 2 }).setOrigin(0, .5).setName('ach-' + a.id);
      const desc = s.add.text(D ? x + 128 : x + 32, D ? y + ch / 2 : y + 38, a.desc, { fontFamily: FONT, fontSize: '12px', color: on ? '#d8cdb4' : '#857b6c', resolution: 2 }).setOrigin(0, .5);
      this.body!.add([name, desc]);
      if (on) this.body!.add(s.add.text(x + cw - 10, y + ch / 2, new Date(got[a.id]).toLocaleDateString('zh-CN'), { fontFamily: FONT, fontSize: '11px', color: '#a99d88', resolution: 2 }).setOrigin(1, .5));
      else this.body!.add(s.add.text(x + cw - 10, y + ch / 2, a.group, { fontFamily: FONT, fontSize: '11px', color: '#6f6658', resolution: 2 }).setOrigin(1, .5));
    });
  }
}
