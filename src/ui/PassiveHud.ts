import Phaser from 'phaser';
import { DEPTH, FONT, IS_DESKTOP } from '../config';
import { CHARACTER_PASSIVES } from '../data/passives';
import type { CharacterPassives } from '../systems/CharacterPassives';

/** 被动技能完整说明（悬停 / 点按弹出）。数值见 data/passives.ts 的 PASSIVE_RULES。 */
export const PASSIVE_DETAILS: Record<'zhaoyun' | 'guanyu' | 'huangzhong' | 'zhuge' | 'zhangfei', string> = {
  zhangfei: '蛇矛每命中敌人积累 1 层怒气（每 0.35 秒最多 1 层）。\n满 5 层后，下一次出枪附带「燕人咆哮」：周围敌人受到 140% 伤害并被震慑 1.2 秒（首领只受伤害），随后清空。',
  zhaoyun: '本命龙枪每命中敌人积累 1 层龙胆（每 0.15 秒最多 1 层）。\n满 7 层后，下一次出枪多 1 枪、枪长 +25%，随后清空重新积累。',
  guanyu: '一次斩击命中至少 3 名敌人积 1 层武势，每层斩击范围 +6%。\n满 3 层后，下一次斩击伤害 +25%、范围 +18%，随后清空。',
  huangzhong: '连续 3 秒不受伤进入「神射」：暴击率 +10%，连弩每轮多射 1 箭。\n受到伤害立即退出，重新计时。',
  zhuge: '战旗爆炸命中至少 3 名敌人积 1 层谋略。\n满 3 层后，下一次战旗范围 +25%，并让命中的敌人灼烧 2 秒（每秒造成爆炸伤害的 10%），随后清空。',
};
/** 被动技能 HUD；悬停（电脑）或点按（手机）弹出完整说明，点按不会触发移动摇杆。 */
export class PassiveHud {
  readonly root: Phaser.GameObjects.Container;
  readonly title: Phaser.GameObjects.Text;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly emblem: Phaser.GameObjects.Text;
  private readonly counter: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly tip: Phaser.GameObjects.Container;
  private readonly tipBg: Phaser.GameObjects.Graphics;
  private readonly tipTitle: Phaser.GameObjects.Text;
  private readonly tipText: Phaser.GameObjects.Text;
  private tipUntil = 0; private hovering = false; private character: keyof typeof PASSIVE_DETAILS = 'zhaoyun'; private ready = false;

  constructor(scene: Phaser.Scene) {
    this.root = scene.add.container(22, 136).setScale(.68).setScrollFactor(0).setDepth(DEPTH.hud + 1);
    this.graphics = scene.add.graphics();
    const text = (x: number, y: number, size: number, color: string) => scene.add.text(x, y, '', {
      fontFamily: FONT, fontSize: `${size}px`, color, resolution: 2, stroke: '#111d16', strokeThickness: 2,
    });
    this.emblem = text(24, 24, 22, '#e7c474').setOrigin(.5);
    this.title = text(47, 8, 19, '#f7eedc').setFontStyle('bold');
    this.counter = text(248, 11, 14, '#e7c474').setOrigin(1, 0);
    this.hint = text(12, 49, 13, '#c4b59e');
    this.hint.setVisible(false);
    this.root.add([this.graphics, this.emblem, this.title, this.counter, this.hint]);
    // 命中框须自身 scrollFactor=0（输入检测按对象自身的 scrollFactor 换算，镜头跟随后才不会错位）
    const hit = scene.add.rectangle(130, 26, 270, 56, 0, .001).setScrollFactor(0).setInteractive({ useHandCursor: true }).setName('passive-hud-hit');
    // 触屏点按也会触发 pointerover 且没有 pointerout：触屏只按点按计时，不算悬停
    hit.on('pointerover', (ptr: Phaser.Input.Pointer) => { if (ptr.wasTouch) return; this.hovering = true; })
      .on('pointerout', () => { this.hovering = false; if (IS_DESKTOP) this.tipUntil = 0; })
      .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation?.(); this.tipUntil = scene.time.now + 3000; });
    this.root.add(hit);
    const label = (x: number, y: number, size: number, color: string) => scene.add.text(x, y, '', { fontFamily: FONT, fontSize: `${size}px`, color, resolution: 2 });
    this.tip = scene.add.container(22, 176).setScrollFactor(0).setDepth(DEPTH.hud + 6).setVisible(false).setName('passive-tip');
    this.tipBg = scene.add.graphics(); this.tipTitle = label(10, 8, 15, '#f5d780'); this.tipText = label(10, 34, 13, '#d4c7ad').setWordWrapWidth(258, true).setLineSpacing(3);
    this.tip.add([this.tipBg, this.tipTitle, this.tipText]);
  }
  get tipVisible(): boolean { return this.tip.visible; }
  private renderTip(now: number, visible: boolean): void {
    const show = visible && (this.hovering || now < this.tipUntil);
    this.tip.setVisible(show); if (!show) return;
    this.tipTitle.setText(`${CHARACTER_PASSIVES[this.character].name} · 被动${this.ready ? ' · 已就绪' : ''}`);
    this.tipText.setText(PASSIVE_DETAILS[this.character] + '\n当前：' + this.hint.text);
    const h = this.tipText.height + 46;
    this.tipBg.clear().fillStyle(0x17140d, .94).fillRect(0, 0, 278, h).lineStyle(1, 0xb09056, .7).strokeRect(0, 0, 278, h);
  }

  get description(): string { return this.hint.text; }

  update(passive: CharacterPassives, now: number, visible: boolean): void {
    this.root.setVisible(visible);
    if (!visible) { this.renderTip(now, false); return; }
    const s = passive.snapshot(now);
    this.character = s.character; this.ready = s.ready;
    const colors = { zhaoyun: 0x70cbdc, guanyu: 0x88c88b, huangzhong: 0xe8c16a, zhuge: 0xe49a6d, zhangfei: 0xd8645a };
    const tint = s.ready ? 0xf5d780 : colors[s.character];
    const g = this.graphics.clear();
    g.fillStyle(tint, 1).fillRect(0, 10, 3, 22);
    this.emblem.setText({ zhaoyun: '龙', guanyu: '势', huangzhong: '弓', zhuge: '策', zhangfei: '怒' }[s.character]);
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
      zhangfei: s.ready ? '下次出枪 燕人咆哮 · 震慑周围' : '命中积怒气 · 每0.35秒最多1层',
      zhuge: s.ready ? '下次战旗 范围+25% · 附加灼烧' : `爆炸命中3敌积谋${s.burns ? ` · 灼烧中 ${s.burns}` : ''}`,
    };
    this.hint.setText(hints[s.character]).setColor(s.ready ? '#efdcaa' : '#c4b59e');
    // 点按计时用场景真实时钟（战斗暂停时也能自然消失）
    this.renderTip(this.root.scene.time.now, true);
  }
}
