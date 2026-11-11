import Phaser from 'phaser';
import { DEPTH, FONT } from '../config';
import { CHARACTER_PASSIVES } from '../data/passives';
import type { CharacterPassives } from '../systems/CharacterPassives';

/** Small, non-interactive HUD; scene ownership handles shutdown without timers. */
export class PassiveHud {
  readonly root: Phaser.GameObjects.Container;
  readonly title: Phaser.GameObjects.Text;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly emblem: Phaser.GameObjects.Text;
  private readonly counter: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.root = scene.add.container(16, 122).setScale(.75).setScrollFactor(0).setDepth(DEPTH.hud + 1);
    this.graphics = scene.add.graphics();
    const text = (x: number, y: number, size: number, color: string) => scene.add.text(x, y, '', {
      fontFamily: FONT, fontSize: `${size}px`, color, resolution: 2,
    });
    this.emblem = text(24, 24, 22, '#e7c474').setOrigin(.5);
    this.title = text(47, 8, 19, '#f7eedc').setFontStyle('bold');
    this.counter = text(248, 11, 14, '#e7c474').setOrigin(1, 0);
    this.hint = text(12, 49, 13, '#c4b59e');
    this.root.add([this.graphics, this.emblem, this.title, this.counter, this.hint]);
  }

  update(passive: CharacterPassives, now: number, visible: boolean): void {
    this.root.setVisible(visible);
    if (!visible) return;
    const s = passive.snapshot(now);
    const colors = { zhaoyun: 0x70cbdc, guanyu: 0x88c88b, huangzhong: 0xe8c16a, zhuge: 0xe49a6d };
    const tint = s.ready ? 0xf5d780 : colors[s.character];
    const g = this.graphics.clear();
    g.fillStyle(tint, 1).fillRect(0, 10, 3, 22);
    this.emblem.setText({ zhaoyun: '龙', guanyu: '势', huangzhong: '弓', zhuge: '策' }[s.character]);
    this.emblem.setColor(`#${tint.toString(16).padStart(6, '0')}`);
    this.title.setText(CHARACTER_PASSIVES[s.character].name);
    this.counter.setText(s.ready ? (s.character === 'huangzhong' ? '神射中' : '已就绪') : s.maxStacks ? `${s.stacks} / ${s.maxStacks}` : `${(s.calmProgress * 3).toFixed(1)}秒`);
    this.counter.setColor(s.ready ? '#f5d780' : '#c4b59e');
    if (s.character === 'huangzhong') {
      g.fillStyle(0x423b2c).fillRoundedRect(47, 35, 201, 6, 2);
      if (s.calmProgress > 0) g.fillStyle(tint).fillRoundedRect(47, 35, 201 * s.calmProgress, 6, 2);
    } else {
      const gap = 4, width = (201 - gap * (s.maxStacks - 1)) / s.maxStacks;
      for (let i = 0; i < s.maxStacks; i++) {
        g.fillStyle(i < s.stacks ? tint : 0x423b2c).fillRoundedRect(47 + i * (width + gap), 35, width, 6, 2);
      }
    }
    const hints = {
      zhaoyun: s.ready ? '下次龙枪 +1枪 · 穿透距离 +25%' : '命中蓄龙胆 · 每0.15秒最多1层',
      guanyu: s.ready ? '下次斩击 伤害+25% · 范围+18%' : `斩中3敌蓄势 · 当前范围 +${s.stacks * 6}%`,
      huangzhong: s.ready ? '暴击率 +10% · 连弩 +1箭' : '3秒不受伤进入神射 · 受伤重置',
      zhuge: s.ready ? '下次战旗 范围+25% · 附加灼烧' : `爆炸命中3敌积谋${s.burns ? ` · 灼烧中 ${s.burns}` : ''}`,
    };
    this.hint.setText(hints[s.character]).setColor(s.ready ? '#efdcaa' : '#c4b59e');
  }
}
