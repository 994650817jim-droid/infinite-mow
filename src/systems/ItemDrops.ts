import Phaser from 'phaser';
import { actorDepth, FONT } from '../config';
import { QUALITY_ORDER, relicsForStage, rollRelic } from '../data/items';
import { CHESTS_PER_STAGE, DROP_CHANCE, QUALITIES, itemName, rollDropQuality, rollItem, type ItemInstance, type ItemQuality, type PityState } from '../data/items';
import { loadItems, loadPity } from './ItemStore';
import { SCROLL } from './MasteryStore';
import type { Player } from '../entities/Player';
import { ensureItemTextures, itemIcon } from '../ui/ItemQuality';
import { ensureLootBeam, lootBeam } from './LootBeam';

interface GroundItem { item: ItemInstance; root: Phaser.GameObjects.Container; x: number; y: number }
interface Chest { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Ellipse; x: number; y: number }
interface KilledEnemy { kind: string; x: number; y: number }

/**
 * 战场道具掉落：普通敌 0.4%、精锐 6%、首领必掉（章末首领 2 件，直接收入），品质按章节档位表 + 保底（data/items.ts）；
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
  /** 保底计数：开局从存档读入，结算时随 depositRunLoot 写回（测试战斗不写）。 */
  readonly pity: PityState = loadPity();
  /** 武将谱：本局获得的武学残卷（首领 3、精锐 5% 掉 1、宝箱 20% 掉 1；结算时收入，测试战斗不收）。 */
  scrolls = 0;
  /** 首领遗珍改由「首领宝箱」发放时设为 true：击杀首领不再自动发，由宝箱拾取时调用 claimBossRelic()。 */
  deferBossRelic = false;

  constructor(private readonly scene: Phaser.Scene, private readonly player: Player, private readonly tier: number, private readonly elapsed: () => number, private readonly finalBoss: () => boolean, private readonly onPickup?: (item: ItemInstance) => void, private readonly relicStage: () => string | null = () => null) {
    ensureItemTextures(scene);
    ensureLootBeam(scene); // 手绘品质光柱（LootBeam.ts；未载入时 drop() 仍画旧光柱）
  }

  /** 获得残卷：记数并在主将头上飘字。 */
  gainScrolls(n: number): void {
    this.scrolls += n; const s = this.scene;
    const t = s.add.text(this.player.x, this.player.y - 84, `武学残卷 +${n}`, { fontFamily: FONT, fontSize: '15px', color: '#e8d6a4', fontStyle: 'bold', stroke: '#140d07', strokeThickness: 4, resolution: 2 }).setOrigin(.5).setDepth(actorDepth(this.player.y) + 50).setName('scroll-pickup-text');
    s.tweens.add({ targets: t, y: t.y - 26, alpha: 0, delay: 800, duration: 600, onComplete: () => t.destroy() });
  }

  onKill(enemy: KilledEnemy): void {
    if (enemy.kind === 'boss') this.gainScrolls(SCROLL.boss);
    else if (enemy.kind === 'elite' && this.rng() < SCROLL.eliteChance) this.gainScrolls(1);
    if (enemy.kind === 'boss') {
      const n = this.finalBoss() ? 2 : 1;
      for (let i = 0; i < n; i++) this.collect(rollItem(rollDropQuality(n > 1 ? 'finalBoss' : 'boss', this.tier, this.pity, this.rng), this.rng));
      if (!this.deferBossRelic) this.claimBossRelic();
      return;
    }
    const elite = enemy.kind === 'elite';
    if (this.rng() >= DROP_CHANCE[elite ? 'elite' : 'normal']) return;
    this.drop(rollItem(rollDropQuality(elite ? 'elite' : 'normal', this.tier, this.pity, this.rng), this.rng), enemy.x, enemy.y);
  }

  /**
   * 首领遗珍（用户批准的掉落规则）：该关首领的核心遗珍还没拥有（行囊或本局缴获里都没有）→ 必掉；
   * 还有没拿到的可选件 → 15% 掉一件；全部拥有 → 改为多掉一件本章档位、至少紫色的兵装。没有遗珍的关返回 null。
   */
  /**
   * 发放本关首领遗珍（规则同 bossRelicDrop）：收进本局缴获（结算带回行囊），返回发出的道具，没有则 null。
   * 名字 / 说明：itemName(item)、relicDef(item.base)（data/items.ts）。供首领宝箱等调用。
   */
  claimBossRelic(): ItemInstance | null { const r = this.bossRelicDrop(); if (r) this.collect(r); return r; }

  bossRelicDrop(): ItemInstance | null {
    const defs = relicsForStage(this.relicStage()); if (!defs.length) return null;
    let owned: Set<string>; try { owned = new Set([...loadItems().bag, ...this.runLoot].map(i => i.base)); } catch { owned = new Set(this.runLoot.map(i => i.base)); }
    const missing = defs.filter(d => !owned.has(d.id));
    if (missing.length && missing[0] === defs[0]) return rollRelic(defs[0].id, this.rng);
    if (missing.length) return this.rng() < .15 ? rollRelic(missing[0].id, this.rng) : null;
    const q = rollDropQuality('boss', this.tier, this.pity, this.rng);
    return rollItem(QUALITY_ORDER.indexOf(q) < QUALITY_ORDER.indexOf('purple') ? 'purple' : q, this.rng);
  }

  /** 双将宝箱的额外一次兵装（品质按本关首领掉落规则）。 */
  rollBossItem(): ItemInstance { return rollItem(rollDropQuality('boss', this.tier, this.pity, this.rng), this.rng); }

  /** 在地上放一件道具（品质光柱 + 图标，轻微浮动）。 */
  drop(item: ItemInstance, x: number, y: number): GroundItem {
    const q = QUALITIES[item.quality], s = this.scene;
    const root = s.add.container(x, y).setDepth(actorDepth(y) + .2).setName('item-drop');
    const beamH = item.quality === 'white' ? 28 : item.quality === 'green' ? 40 : 58 + (item.quality === 'orange' ? 26 : 0);
    const glow = s.add.ellipse(0, 4, 40, 14, q.color, .45);
    const beam = s.add.rectangle(0, -beamH / 2 + 4, 6, beamH, q.color, .55);
    const frame = s.add.graphics(); frame.fillStyle(0x1b120b, .9).fillRoundedRect(-14, -26, 28, 28, 5); frame.lineStyle(2, q.color, 1).strokeRoundedRect(-14, -26, 28, 28, 5);
    const ic = itemIcon(s, item), icon = s.add.image(0, -12, ic.key, ic.frame).setDisplaySize(ic.art ? 25 : 22, ic.art ? 25 : 22);
    // 品质光柱：手绘序列帧就绪时替换程序画的光圈 + 光柱（LootBeam.ts），否则沿用旧的
    const painted = lootBeam(s, item.quality, q.color);
    if (painted) { glow.destroy(); beam.destroy(); root.add([painted, frame, icon]); } else root.add([glow, beam, frame, icon]);
    s.tweens.add({ targets: [frame, icon], y: '-=4', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const g = { item, root, x, y }; this.ground.push(g); return g;
  }

  spawnChest(x: number, y: number): Chest {
    const s = this.scene, glow = s.add.ellipse(x, y + 10, 70, 22, 0xf3d48a, .3).setDepth(actorDepth(y) - .1).setBlendMode(Phaser.BlendModes.ADD).setName('item-chest-glow');
    const img = s.add.image(x, y, 'item_chest', 0).setDisplaySize(48, 40).setDepth(actorDepth(y)).setName('item-chest');
    s.tweens.add({ targets: glow, alpha: .12, duration: 650, yoyo: true, repeat: -1 });
    const c = { img, glow, x, y }; this.chests.push(c); return c;
  }

  openChest(c: Chest): void {
    const i = this.chests.indexOf(c); if (i < 0) return; this.chests.splice(i, 1);
    // 正式宝箱图（3 帧：关 / 开 / 空）播一下开箱；程序化宝箱直接消失
    c.glow.destroy();
    if (c.img.texture.has('1')) {
      c.img.setFrame(1).setDisplaySize(48, 40);
      this.scene.time.delayedCall(260, () => { if (c.img.active && c.img.texture.has('2')) c.img.setFrame(2).setDisplaySize(48, 40); });
      this.scene.tweens.add({ targets: c.img, alpha: 0, delay: 900, duration: 500, onComplete: () => c.img.destroy() });
    } else c.img.destroy();
    const n = this.rng() < .4 ? 2 : 1;
    if (this.rng() < SCROLL.chestChance) this.gainScrolls(1);
    for (let k = 0; k < n; k++) this.drop(rollItem(rollDropQuality('chest', this.tier, this.pity, this.rng), this.rng), c.x + (k ? 26 : -10), c.y + 18);
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

  /** 战斗中穿上的缴获已收入行囊：从本局缴获里拿掉。 */
  takeLoot(uid: string): void { const i = this.runLoot.findIndex(x => x.uid === uid); if (i >= 0) this.runLoot.splice(i, 1); }

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
