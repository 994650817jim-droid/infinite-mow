import Phaser from 'phaser';
import { DEPTH, FONT, GAME_HEIGHT as H, GAME_WIDTH as W, IS_DESKTOP as D } from '../config';
import { LEGION, ORDERS, TROOPS, TROOP_KINDS, type TroopKind } from '../data/legion';
import type { Legion } from '../systems/Legion';
const ROLES: Record<TroopKind, string> = {
  swordsman: '近战护卫 · 稳守前线', spearman: '长枪突刺 · 克制骑兵', archer: '远程弓箭 · 持续支援',
  crossbowman: '连弩快射 · 高频压制', guardian: '重甲大盾 · 承受伤害', rider: '高速骑兵 · 主动冲击',
  halberdier: '战戟横扫 · 范围攻击', medic: '治疗友军 · 补充续航',
};
export class LegionUI {
  readonly hud: Phaser.GameObjects.Container;
  readonly panel: Phaser.GameObjects.Container;
  private readonly summary: Phaser.GameObjects.Text;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly order: Phaser.GameObjects.Text;
  private readonly orderPlate: Phaser.GameObjects.Graphics;
  private readonly orderHint: Phaser.GameObjects.Text;
  private orderState = '';
  private readonly orderX = W - (D ? 148 : 164);
  private readonly orderY = H - 156;
  private readonly close: Phaser.GameObjects.Text;
  private readonly prev: Phaser.GameObjects.Text;
  private readonly next: Phaser.GameObjects.Text;
  private readonly pageText: Phaser.GameObjects.Text;
  private page = 0;
  private mode: 'wave' | 'rest' = 'wave';
  private options: TroopKind[] = [];
  private army: Legion | null = null;
  private readonly rows: Array<{ kind: TroopKind; root: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Rectangle; plate: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.Image; title: Phaser.GameObjects.Text; detail: Phaser.GameObjects.Text; buy: Phaser.GameObjects.Text; train: Phaser.GameObjects.Text }> = [];
  constructor(scene: Phaser.Scene, order: () => void, buy: (kind: TroopKind, train: boolean) => void, close: () => void) {
    const text = (x: number, y: number, s: string, size = 16) => scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color: '#eee2c1', resolution: 2, stroke: '#101910', strokeThickness: 1, shadow: { offsetX: 0, offsetY: 2, color: '#080d09', blur: 3, fill: true } }).setScrollFactor(0);
    const button = (s: string, fn: () => void) => text(0, 0, s, 15).setPadding(10, 10).setBackgroundColor('rgba(57,83,62,0.96)').setInteractive({ useHandCursor: true }).on('pointerover', function(this: Phaser.GameObjects.Text) { this.setTint(0xffe4a1); }).on('pointerout', function(this: Phaser.GameObjects.Text) { this.clearTint(); }).on('pointerdown', fn);
    this.hud = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + 3);
    this.status = text(16, 182, '', 13).setStroke('#171a13', 2);
    this.orderPlate = scene.add.graphics().setScrollFactor(0);
    this.order = text(this.orderX, this.orderY, '', D ? 17 : 19).setPadding(43, 7, 0, 0)
      .setFixedSize(D ? 132 : 148, D ? 48 : 60).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.orderPlate.setAlpha(.7); order(); })
      .on('pointerup', () => this.orderPlate.setAlpha(1))
      .on('pointerover', () => this.orderPlate.setAlpha(1))
      .on('pointerout', () => this.orderPlate.setAlpha(.9));
    this.orderHint = text(this.orderX + 43, this.orderY + (D ? 29 : 35), '', D ? 10 : 12).setColor('#acbeb0');
    const key = text(this.orderX + (D ? 109 : 123), this.orderY + 10, D ? 'E' : '⇄', 11).setColor('#d9d2b8');
    this.hud.add([this.status, this.orderPlate, this.order, this.orderHint, key]);
    this.panel = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay + 1).setVisible(false);
    this.panel.add(scene.add.rectangle(0, 0, W, H, 0x121b17, 0).setOrigin(0).setScrollFactor(0).setInteractive());
    this.heading = text(W / 2, D ? 54 : 75, '', D ? 26 : 28).setOrigin(.5, 0);
    this.summary = text(W / 2, D ? 96 : 122, '', 14).setOrigin(.5, 0);
    this.panel.add([this.heading, this.summary]);
    for (const kind of TROOP_KINDS) {
      const root = scene.add.container(0, 0).setScrollFactor(0);
      const bg = scene.add.rectangle(0, 0, 200, 200, 0x24362e, 0).setStrokeStyle(0).setOrigin(0).setScrollFactor(0);
      const plate = scene.add.graphics().setScrollFactor(0);
      const def = TROOPS[kind], sheet = def.walkVisual?.texture ?? `${def.art}_walk_sheet`;
      const icon = scene.add.image(0, 0, sheet, 'down_0').setDisplaySize(70, 70).setScrollFactor(0);
      const title = text(12, 12, '', 19), detail = text(12, 42, '', 13).setColor('#b9cdbb');
      const recruit = button('', () => buy(kind, false)), train = button('', () => buy(kind, true));
      root.add([bg, plate, icon, title, detail, recruit, train]); this.panel.add(root);
      this.rows.push({ kind, root, bg, plate, icon, title, detail, buy: recruit, train });
    }
    this.prev = button('上一页', () => { this.page = 0; this.repaint(); }).setPosition(W / 2 - 145, H - 225);
    this.next = button('下一页', () => { this.page = 1; this.repaint(); }).setPosition(W / 2 + 45, H - 225);
    this.pageText = text(W / 2, H - 207, '', 14).setOrigin(.5);
    this.close = button('', close).setPosition(W / 2, H - (D ? 54 : 103)).setOrigin(.5, 0).setFontSize(18);
    this.panel.add([this.prev, this.next, this.pageText, this.close]);
  }
  render(army: Legion, mode: 'wave' | 'rest', options: TroopKind[] = []): void { if (this.mode !== mode) this.page = 0; this.army = army; this.mode = mode; this.options = options; this.repaint(); }
  private repaint(): void {
    const army = this.army; if (!army) return;
    const wave = this.mode === 'wave';
    this.heading.setY(wave ? D ? 54 : 75 : D ? 22 : 62);
    this.summary.setY(wave ? D ? 96 : 122 : D ? 61 : 112);
    this.heading.setText(wave ? '战地招募'  : '黄巾已破 · 战后休整');
    this.summary.setText(wave ? `选择 1 名士兵加入部队 · 本次免费` : `军粮 ${army.food}　存活 ${army.count}　阵亡 ${army.dead}\n购买与训练完成后，率军出征虎牢关`).setAlign('center');
    this.close.setText(wave ? '跳过本次 · 继续战斗' : '率军出征 · 虎牢关');
    const visible = wave ? this.options : D ? TROOP_KINDS : TROOP_KINDS.slice(this.page * 4, this.page * 4 + 4);
    for (const row of this.rows) {
      const index = visible.indexOf(row.kind); row.root.setVisible(index >= 0); if (index < 0) continue;
      const level = army.levels[row.kind], count = army.units.filter(u => u.active && u.kind === row.kind).length;
      const width = wave ? D ? 232 : W - 72 : D ? (W - 70) / 4 : (W - 54) / 2;
      const height = wave ? D ? 252 : 154 : D ? 166 : 245;
      const x = wave ? D ? (W - (width * 3 + 32)) / 2 + index * (width + 16) : 36 : D ? 20 + index % 4 * (width + 10) : 18 + index % 2 * (width + 18);
      const y = wave ? D ? 153 : 192 + index * 174 : (D ? 108 : 180) + Math.floor(index / (D ? 4 : 2)) * (height + 18);
      row.root.setPosition(x, y); row.bg.setSize(width, height);
      row.plate.clear().fillStyle(0x11251f, .94).fillRoundedRect(0, 0, width, height, 12)
        .lineStyle(1, 0x9caa86, .65).strokeRoundedRect(0, 0, width, height, 12)
        .fillStyle(0xd9bc77, .9).fillRoundedRect(16, 0, width - 32, 3, 1);
      if (wave) row.plate.fillStyle(0x385947, .45).fillCircle(D ? width / 2 : 57, D ? 100 : 76, D ? 44 : 40);
      row.title.setText(`${TROOPS[row.kind].name} · Lv${level}`).setPosition(wave ? D ? width / 2 : 118 : 12, 18).setOrigin(wave && D ? .5 : 0, 0).setFontSize(wave ? 19 : 18);
      const iconSize = wave ? D ? 94 : 96 : D ? 56 : 70;
      const frame = row.icon.frame;
      row.icon.setScale(iconSize / Math.max(frame.width, frame.height)).setPosition(wave ? D ? width / 2 : 55 : D ? 44 : 52, wave ? D ? 98 : 76 : D ? 60 : 80);
      row.detail.setText(wave ? `${ROLES[row.kind]}\n已编入 ${count} 人` : D ? `${count}人 · ${TROOPS[row.kind].cost}粮/人` : `已编入 ${count}人\n${TROOPS[row.kind].perk}`)
        .setPosition(wave ? D ? width / 2 : 118 : D ? 85 : 98, wave ? D ? 153 : 53 : D ? 47 : 59)
        .setOrigin(wave && D ? .5 : 0, 0).setAlign(wave && D ? 'center' : 'left').setLineSpacing(5)
        .setWordWrapWidth(wave ? D ? width - 24 : width - 128 : width - (D ? 92 : 110));
      row.buy.setText(wave ? '＋ 招募入队' : `招募 +1　${TROOPS[row.kind].cost}粮`).setPosition(wave && !D ? 118 : 14, wave ? D ? 207 : 105 : D ? 84 : 140).setFixedSize(wave && !D ? width - 136 : width - 28, 0).setAlign('center');
      row.train.setVisible(!wave).setText(level === 3 ? '训练已满级' : `训练至Lv${level + 1}　${LEGION.trainCost[level]}粮`).setPosition(10, D ? 124 : 193).setFixedSize(width - 20, 0).setAlign('center');
      const canBuy = wave || army.food >= TROOPS[row.kind].cost, canTrain = !wave && level < 3 && army.food >= LEGION.trainCost[level];
      row.buy.setAlpha(canBuy ? 1 : .35); if (canBuy) row.buy.setInteractive({ useHandCursor: true }); else row.buy.disableInteractive();
      row.train.setAlpha(canTrain ? 1 : .35); if (canTrain) row.train.setInteractive({ useHandCursor: true }); else row.train.disableInteractive();
    }
    this.prev.setVisible(!wave && !D).setAlpha(this.page === 0 ? .4 : 1); this.next.setVisible(!wave && !D).setAlpha(this.page === 1 ? .4 : 1); this.pageText.setVisible(!wave && !D).setText(`${this.page + 1} / 2`);
  }
  update(army: Legion, visible: boolean): void { this.hud.setVisible(visible); if (!visible) return; this.status.setText(`军粮 ${army.food} · 兵力 ${army.count}${army.dead ? ` · 阵亡 ${army.dead}` : ''}${army.count > LEGION.visualBudget ? '\n余部编组参战' : ''}`); this.paintOrder(army); }
  private paintOrder(army: Legion): void {
    if (this.orderState === army.order) return;
    this.orderState = army.order;
    const guard = army.order === 'guard', x = this.orderX, y = this.orderY, width = D ? 132 : 148, height = D ? 48 : 60;
    const color = guard ? 0x83c8b3 : 0xe9b777, g = this.orderPlate;
    this.order.setText(ORDERS[army.order]).setColor(guard ? '#ddf3e9' : '#ffdfb4');
    this.orderHint.setText(guard ? '跟随护卫' : '主动迎敌');
    g.clear().fillStyle(0x101e19, .84).fillRoundedRect(x, y, width, height, 10)
      .lineStyle(1, color, .75).strokeRoundedRect(x, y, width, height, 10)
      .fillStyle(color, .15).fillCircle(x + 23, y + height / 2, 15)
      .lineStyle(2, color, 1);
    const cy = y + height / 2;
    if (guard) {
      g.beginPath().moveTo(x + 23, cy - 10).lineTo(x + 32, cy - 6).lineTo(x + 30, cy + 4)
        .lineTo(x + 23, cy + 11).lineTo(x + 16, cy + 4).lineTo(x + 14, cy - 6).closePath().strokePath();
      g.lineBetween(x + 23, cy - 5, x + 23, cy + 5);
    } else {
      g.lineBetween(x + 16, cy + 7, x + 30, cy - 7).lineBetween(x + 21, cy - 7, x + 30, cy - 7)
        .lineBetween(x + 30, cy - 7, x + 30, cy + 2).lineBetween(x + 14, cy + 1, x + 21, cy + 8);
    }
  }

}
