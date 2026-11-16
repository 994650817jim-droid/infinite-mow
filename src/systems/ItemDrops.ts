import Phaser from 'phaser';
import { actorDepth, FONT } from '../config';
import { CHESTS_PER_STAGE, DROP_CHANCE, QUALITIES, itemName, itemSlot, rollItem, rollQuality, type ItemInstance, type ItemQuality } from '../data/items';
import type { Player } from '../entities/Player';
import { ensureItemTextures, itemIconKey } from '../ui/ItemQuality';

interface GroundItem { item: ItemInstance; root: Phaser.GameObjects.Container; x: number; y: number }
interface Chest { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Ellipse; x: number; y: number }
interface KilledEnemy { kind: string; x: number; y: number }

/**
 * 战场道具掉落：普通敌 0.4%、精锐 6%（至少绿）、首领必掉（至少蓝，终章首领 2 件，直接收入）、
 * 每关两个宝箱（打开得 1–2 件，至少绿）。地上的道具带品质光柱，走近自动拾取，收进本局缴获 runLoot；
 * 结算时由 GameScene.finish 交给 ItemStore.depositRunLoot。
 */
export class ItemDrops {
  readonly runLoot: ItemInstance[] = [];
  readonly ground: GroundItem[] = [];
  readonly chests: Chest[] = [];
  private chestIndex = 0;
  private lastElapsed = 0;
  rng: () => number = Math.random;

  constructor(private readonly scene: Phaser.Scene, private readonly player: Player, private readonly tier: number, private readonly elapsed: () => number, private readonly finalBoss: () => boolean, private readonly onPickup?: (item: ItemInstance) => void) {
    ensureItemTextures(scene);
  }

  onKill(enemy: KilledEnemy): void {
    if (enemy.kind === 'boss') {
      const n = this.finalBoss() ? 2 : 1;
      for (let i = 0; i < n; i++) this.collect(rollItem(rollQuality('boss', this.tier, this.rng), this.rng));
      return;
    }
    const elite = enemy.kind === 'elite';
    if (this.rng() >= DROP_CHANCE[elite ? 'elite' : 'normal']) return;
    this.drop(rollItem(rollQuality(elite ? 'elite' : 'normal', this.tier, this.rng), this.rng), enemy.x, enemy.y);
  }

  /** 在地上放一件道具（品质光柱 + 图标，轻微浮动）。 */
  drop(item: ItemInstance, x: number, y: number): GroundItem {
    const q = QUALITIES[item.quality], s = this.scene;
    const root = s.add.container(x, y).setDepth(actorDepth(y) + .2).setName('item-drop');
    const beamH = item.quality === 'white' ? 28 : item.quality === 'green' ? 40 : 58 + (item.quality === 'orange' ? 26 : 0);
    const glow = s.add.ellipse(0, 4, 40, 14, q.color, .45);
    const beam = s.add.rectangle(0, -beamH / 2 + 4, 6, beamH, q.color, .55);
    const frame = s.add.graphics(); frame.fillStyle(0x1b120b, .9).fillRoundedRect(-14, -26, 28, 28, 5); frame.lineStyle(2, q.color, 1).strokeRoundedRect(-14, -26, 28, 28, 5);
    const icon = s.add.image(0, -12, itemIconKey(itemSlot(item))).setDisplaySize(22, 22);
    root.add([glow, beam, frame, icon]);
    s.tweens.add({ targets: [frame, icon], y: '-=4', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const g = { item, root, x, y }; this.ground.push(g); return g;
  }

  spawnChest(x: number, y: number): Chest {
    const s = this.scene, glow = s.add.ellipse(x, y + 10, 70, 22, 0xf3d48a, .3).setDepth(actorDepth(y) - .1).setBlendMode(Phaser.BlendModes.ADD).setName('item-chest-glow');
    const img = s.add.image(x, y, 'item_chest').setDisplaySize(48, 39).setDepth(actorDepth(y)).setName('item-chest');
    s.tweens.add({ targets: glow, alpha: .12, duration: 650, yoyo: true, repeat: -1 });
    const c = { img, glow, x, y }; this.chests.push(c); return c;
  }

  openChest(c: Chest): void {
    const i = this.chests.indexOf(c); if (i < 0) return; this.chests.splice(i, 1);
    c.img.destroy(); c.glow.destroy();
    const n = this.rng() < .4 ? 2 : 1;
    for (let k = 0; k < n; k++) this.drop(rollItem(rollQuality('chest', this.tier, this.rng), this.rng), c.x + (k ? 26 : -10), c.y + 18);
  }

  private collect(item: ItemInstance): void {
    this.runLoot.push(item); this.onPickup?.(item);
    const q = QUALITIES[item.quality], s = this.scene;
    const t = s.add.text(this.player.x, this.player.y - 60, `获得 · ${q.label} · ${itemName(item)}`, { fontFamily: FONT, fontSize: item.quality === 'orange' || item.quality === 'purple' ? '17px' : '15px', color: q.css, fontStyle: 'bold', stroke: '#140d07', strokeThickness: 4, resolution: 2 })
      .setOrigin(.5).setDepth(actorDepth(this.player.y) + 50).setName('item-pickup-text');
    s.tweens.add({ targets: t, y: t.y - 28, alpha: 0, delay: 700, duration: 600, onComplete: () => t.destroy() });
  }

  update(): void {
    const e = this.elapsed();
    if (e < this.lastElapsed - 1) this.chestIndex = 0; // 战线推进：新关重新计时
    this.lastElapsed = e;
    if (this.chestIndex < CHESTS_PER_STAGE.length && e >= CHESTS_PER_STAGE[this.chestIndex]) {
      this.chestIndex++;
      const a = this.rng() * Math.PI * 2, d = 200 + this.rng() * 80;
      this.spawnChest(this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d * .7);
    }
    if (!this.player.alive) return;
    const px = this.player.x, py = this.player.y, reach = Math.max(36, this.player.stats.pickupRadius * (1 + this.player.growth.gear.pickup) * .6);
    for (let i = this.ground.length - 1; i >= 0; i--) {
      const g = this.ground[i];
      if (Math.hypot(g.x - px, g.y - py) > reach) continue;
      this.ground.splice(i, 1); g.root.destroy(); this.collect(g.item);
    }
    for (const c of [...this.chests]) if (Math.hypot(c.x - px, c.y - py) < 40) this.openChest(c);
  }

  /** 胜利结算：地上没捡的一并收入。 */
  collectAll(): void { for (const g of this.ground.splice(0)) { g.root.destroy(); this.runLoot.push(g.item); } }

  /** 本局缴获按品质计数（结算面板用），如「紫 1 · 蓝 2」。 */
  summary(items: ItemInstance[] = this.runLoot): string {
    const order: ItemQuality[] = ['orange', 'purple', 'blue', 'green', 'white'];
    return order.map(q => [q, items.filter(i => i.quality === q).length] as const).filter(([, n]) => n > 0).map(([q, n]) => `${QUALITIES[q].label} ${n}`).join(' · ');
  }

  clear(): void {
    for (const g of this.ground.splice(0)) g.root.destroy();
    for (const c of this.chests.splice(0)) { c.img.destroy(); c.glow.destroy(); }
  }
}
