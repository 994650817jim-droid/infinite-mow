/**
 * 主页「存档」面板：3 个存档位（当前 / 读取 / 新建 / 删除）。进度自动保存到当前存档位。
 * 手柄：方向键选按钮，Ⓐ 确认，Ⓑ 返回（见 ui/PadNavigator.ts）。
 */
import Phaser from 'phaser';
import { FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, IS_DESKTOP } from '../config';
import { homeCommand, warPanelTexture } from './HomeCommand';
import { deleteSlot, listSlots, reloadGame, switchSlot, type SlotSummary } from '../systems/SaveSlots';

const NUM = ['一', '二', '三'];

function when(t?: number): string {
  if (!t) return '';
  const d = new Date(t), p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export class SaveSlotsUI {
  readonly root: Phaser.GameObjects.Container;
  private rows: Phaser.GameObjects.GameObject[] = [];

  constructor(private scene: Phaser.Scene, private onClose?: () => void) {
    const W = GAME_WIDTH, H = GAME_HEIGHT, D = IS_DESKTOP;
    this.root = scene.add.container(0, 0).setDepth(520).setName('save-slots-panel');
    this.root.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x130d09, .97).setInteractive());
    const label = (x: number, y: number, s: string, size: number, color = '#e8d0aa', font = FONT) => scene.add.text(x, y, s, { fontFamily: font, fontSize: size + 'px', color, resolution: 2 }).setOrigin(.5);
    this.root.add(label(W / 2, D ? 44 : 90, '存 档', 28, '#efd399', HEADING_FONT).setLetterSpacing(8));
    this.root.add(label(W / 2, D ? 78 : 130, '进度自动保存到当前存档位 · 切换存档会重新载入', 13, '#a89c8c'));
    const back = homeCommand(scene, W / 2, D ? H - 40 : H - 90, D ? 180 : 200, D ? 46 : 56, '返回');
    back.hit.setName('save-slots-close').setData('padDefault', true).on('pointerdown', () => this.close());
    this.root.add([back.g, back.hit, back.caption]);
    this.render();
  }

  close(): void { this.root.destroy(); this.onClose?.(); }

  private render(): void {
    for (const o of this.rows) o.destroy();
    this.rows = [];
    const D = IS_DESKTOP, W = GAME_WIDTH;
    const cw = D ? 700 : W - 40, ch = D ? 108 : 170, top = D ? 104 : 170, gap = D ? 14 : 18;
    listSlots().forEach((s, i) => this.renderSlot(s, W / 2, top + i * (ch + gap) + ch / 2, cw, ch));
  }

  private renderSlot(s: SlotSummary, x: number, y: number, w: number, h: number): void {
    const scene = this.scene, D = IS_DESKTOP;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.root.add(o); this.rows.push(o); return o; };
    add(scene.add.image(x, y, warPanelTexture(scene, w, h, s.active)).setDisplaySize(w + 16, h + 16).setName(`save-slot-${s.index}`));
    const left = x - w / 2 + 24, text = (tx: number, ty: number, str: string, size: number, color: string, font = FONT) =>
      add(scene.add.text(tx, ty, str, { fontFamily: font, fontSize: size + 'px', color, resolution: 2 }).setOrigin(0, .5));
    const titleY = D ? y - 30 : y - h / 2 + 28;
    text(left, titleY, `存档${NUM[s.index]}`, 20, s.active ? '#f4d99f' : '#d8c4a0', HEADING_FONT);
    if (s.active) add(scene.add.text(left + 92, titleY, '当前', { fontFamily: FONT, fontSize: '12px', color: '#1b120a', backgroundColor: '#d9b46a', padding: { x: 7, y: 2 }, resolution: 2 }).setOrigin(0, .5));
    if (s.empty) {
      text(left, titleY + 34, '空存档位 · 新的征途', 15, '#8f8676');
    } else {
      text(left, titleY + 30, [s.hero, s.progress].filter(Boolean).join(' · '), 16, '#eadfc8');
      text(left, titleY + 56, [s.detail, s.savedAt ? '保存于 ' + when(s.savedAt) : ''].filter(Boolean).join('    '), 12, '#a99d88');
    }
    // 右侧按钮（手机布局放在卡片底部一行）
    const bw = D ? 136 : 140, bh = D ? 40 : 44, by = D ? y : y + h / 2 - 32, bx = D ? x + w / 2 - 24 - bw / 2 : x + w / 2 - 20 - bw / 2;
    const button = (cx: number, caption: string, primary: boolean, enabled: boolean, name: string, fn?: () => void) => {
      const b = homeCommand(scene, cx, by, bw, bh, caption, primary, enabled, 16);
      for (const o of [b.g, b.hit, b.caption]) add(o);
      b.hit.setName(name);
      if (enabled && fn) b.hit.on('pointerdown', fn);
      return b;
    };
    // 当前档位只有标题旁的「当前」小签，不再另放一个灰色「当前存档」按钮（2026-11-21 全界面体检：信息重复）
    if (s.active) { /* 无按钮 */ }
    // 2026-11-21 全界面体检：空档位有两三个时「新建征途」水墨按钮会叠出好几个；一律漆金（每屏最多一个水墨）
    else button(bx, s.empty ? '新建征途' : '读取', false, true, `save-slot-${s.index}-load`, () => this.load(s.index));
    if (!s.empty) {
      const del = button(s.active ? bx : bx - bw - 14, '删除', false, true, `save-slot-${s.index}-delete`);
      del.hit.on('pointerdown', () => {
        if (!del.hit.getData('confirm')) { del.hit.setData('confirm', true); del.caption.setText('确认删除？').setColor('#ff9f86'); return; }
        deleteSlot(s.index);
        if (s.active) { this.loading('已删除，重新载入…'); return; }
        this.render();
      });
    }
  }

  private load(i: number): void { switchSlot(i); this.loading('载入存档…'); }

  private loading(msg: string): void {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    this.root.add(this.scene.add.rectangle(W / 2, H / 2, W, H, 0x0b0907, .9).setInteractive());
    this.root.add(this.scene.add.text(W / 2, H / 2, msg, { fontFamily: FONT, fontSize: '20px', color: '#e8d0aa', resolution: 2 }).setOrigin(.5));
    this.scene.time.delayedCall(250, () => reloadGame());
  }
}
