import Phaser from 'phaser';
import { DEPTH, FONT, IS_DESKTOP } from '../config';
import { CHARACTER_PASSIVES } from '../data/passives';
import type { CharacterPassives } from '../systems/CharacterPassives';

/** 被动技能完整说明（悬停 / 点按弹出）。数值见 data/passives.ts 的 PASSIVE_RULES。 */
export const PASSIVE_DETAILS: Record<'zhaoyun' | 'guanyu' | 'huangzhong' | 'zhuge' | 'zhangfei' | 'huangyueying' | 'pangtong' | 'liubei' | 'weiyan' | 'machao' | 'sunshangxiang' | 'diaochan', string> = {
  sunshangxiang: '侍婢执刀：移动中每 0.8 秒积 1 层疾步（停下不会掉层）。\n满 6 层后，下一次掷刀时召来 2 名执刀侍婢护身 6 秒（最多 3 名）：绕身巡护，70 像素内的敌人每 0.5 秒挨一刀（掷刀伤害的 50%–70%，随武器等级提高），随后清空。',
  diaochan: '离间：飞扇每命中一次加 1 层魅惑，满 3 层的敌人倒戈 3 秒（精锐 1.5 秒）——转身去撞最近的同伴，自己受伤 +20%；首领不倒戈，改为 3 秒受伤 +25%。\n每离间 1 名敌人积 1 层舞势，满 5 层后下一次化为「闭月」：舞带环身旋舞 2 秒，半径 160 内每 0.4 秒 50% 伤害并令圈内敌人倒戈。',
  machao: '西凉铁骑：湛金枪每命中敌人积 1 层铁骑（每 0.3 秒最多 1 层）。\n满 6 层后，下一枪化为「锦马冲锋」：向前突进 180 像素，沿途敌人受到 160% 伤害并被撞开，随后清空。',
  weiyan: '镇守汉中：每次受到伤害积 1 层拒敌（每 0.5 秒最多 1 层）。\n满 5 层后，下一刀化为「谁敢杀我」：怒吼并朝 6 个方向劈出裂波（各 80% 伤害），自身 3 秒内受到伤害 -30%，随后清空。',
  liubei: '双剑一次砍中 2 名敌人积 1 层仁德。\n满 4 层后，下一次出剑伤害 +15%，自身回复 8% 最大生命、身边部曲回复 35% 生命，并在 4 秒内攻速 +30%，随后清空。',
  pangtong: '连环计：一次连锁引爆至少 3 枚火雷积 1 层计策。\n满 3 层后，下一次布雷化为「火烧连环」：身边布下以锁链相连的 6 枚火雷，敌人踏入圈内或 2 秒后齐爆并留火 2 秒，随后清空（凤雏连环令满级时，圈内先整片起火 3 秒再齐爆）。\n落凤坡伏兵：生命低于 30% 时脚下自动布 4 枚火雷并以铁索连成方阵（每 30 秒最多一次）。',
  huangyueying: '连弩每命中敌人上紧 1 层机括（每 0.25 秒最多 1 层）。\n满 8 层后，下一次射击额外扇形齐射 6 支机关弩箭（60% 伤害、弹射 +1），随后清空。',
  zhangfei: '声浪每命中敌人积 1 层怒气（每 0.35 秒最多 1 层）。\n满 5 层后，下一次大喝化为「据水断桥」：周围敌人受到 140% 伤害并被震慑 1.2 秒（首领只受伤害），原地留下 3 秒敌人进不来的断桥区，随后清空。',
  zhaoyun: '本命龙枪每命中敌人积累 1 层龙胆（每 0.15 秒最多 1 层）。\n满 7 层后，下一次出枪多 1 枪、枪长 +25%，随后清空重新积累。',
  guanyu: '一次斩击命中至少 3 名敌人积 1 层武势，每层斩击范围 +6%。\n满 3 层后，下一次斩击伤害 +25%、范围 +18%，随后清空。',
  huangzhong: '重箭每命中一次积 1 层蓄势，满 5 层进入「神射」6 秒（技艺「静心」可延长到 9 秒）：暴击率 +10%，重箭命中处再爆裂一圈（半径 60、50% 伤害）。\n受到伤害掉 1 层蓄势（神射中受伤不打断）。',
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
    const colors = { zhaoyun: 0x70cbdc, guanyu: 0x88c88b, huangzhong: 0xe8c16a, zhuge: 0xe49a6d, zhangfei: 0xd8645a, huangyueying: 0x7fc4a8, pangtong: 0xd9824a, liubei: 0xe0c37a, weiyan: 0xc8885a, machao: 0x9fc6e8, sunshangxiang: 0xe88a7a, diaochan: 0xd9a0e8 };
    const tint = s.ready ? 0xf5d780 : colors[s.character];
    const g = this.graphics.clear();
    g.fillStyle(tint, 1).fillRect(0, 10, 3, 22);
    this.emblem.setText({ zhaoyun: '龙', guanyu: '势', huangzhong: '弓', zhuge: '策', zhangfei: '怒', huangyueying: '巧', pangtong: '凤', liubei: '仁', weiyan: '战', machao: '骑', sunshangxiang: '姬', diaochan: '月' }[s.character]);
    this.emblem.setColor(`#${tint.toString(16).padStart(6, '0')}`);
    this.title.setText(CHARACTER_PASSIVES[s.character].name);
    this.counter.setText(s.ready ? (s.character === 'huangzhong' ? '神射中' : '已就绪') : s.maxStacks ? `${s.stacks} / ${s.maxStacks}` : `${(s.calmProgress * 5).toFixed(1)}秒`);
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
      huangzhong: s.ready ? '暴击率 +10% · 重箭爆裂' : '重箭命中积蓄势 · 满5层进入神射',
      machao: s.ready ? '下一枪 锦马冲锋' : '命中积铁骑 · 每0.3秒最多1层',
      weiyan: s.ready ? '下一刀 谁敢杀我 · 六向裂波' : '受到伤害积拒敌 · 每0.5秒1层',
      liubei: s.ready ? '下次出剑 回复8% · 攻速+30%' : '双剑砍中2敌积仁德',
      pangtong: s.ready ? '下次布雷 火烧连环' : '一次连锁引爆3雷积计策',
      huangyueying: s.ready ? '下次射击 扇形齐射6箭' : '命中上机括 · 每0.25秒最多1层',
      sunshangxiang: s.ready ? '下次掷刀 召侍婢护身' : '移动积疾步 · 每0.8秒1层',
      diaochan: s.ready ? '下次出手 闭月：圈内敌人倒戈' : `离间敌人积舞势${s.turned ? ` · 倒戈中 ${s.turned}` : ''}`,
      zhangfei: s.ready ? '下次大喝 据水断桥' : '声浪命中积怒气 · 每0.35秒1层',
      zhuge: s.ready ? '下次战旗 范围+25% · 附加灼烧' : `爆炸命中3敌积谋${s.burns ? ` · 灼烧中 ${s.burns}` : ''}`,
    };
    this.hint.setText(hints[s.character]).setColor(s.ready ? '#efdcaa' : '#c4b59e');
    // 点按计时用场景真实时钟（战斗暂停时也能自然消失）
    this.renderTip(this.root.scene.time.now, true);
  }
}
