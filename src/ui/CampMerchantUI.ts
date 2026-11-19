/**
 * 营寨旅商面板（2026-11-18 用户「营寨增加个旅商就是军需商人」）：与行营「军需商人」同一个商人、同一套货色规则，
 * 卡片排法照行营（电脑左侧立绘 + 4 张竖排兵装卡；手机 2×2），漆金按钮。库存与扣粮见 town/CampMerchant.ts。
 * 悬停 / 长按卡片看属性与身上同栏位的对比（ItemTooltip，比的是上次出征的武将）。
 */
import Phaser from 'phaser';
import { FONT, HEADING_FONT } from '../config';
import { QUALITIES, SLOTS, SPECIALS, formatAffix, itemName, itemSlot } from '../data/items';
import { loadout } from '../systems/ItemStore';
import { uiSfx } from '../systems/Sfx';
import type { CharacterId } from '../data/characters';
import { buyCampItem, campMerchantStock, campPrice } from '../town/CampMerchant';
import { loadWorld } from '../world/WorldStore';
import { itemTile, ensureItemTextures } from './ItemQuality';
import { ItemTooltip } from './ItemTooltip';
import { LQ, lqCommand, lqPanel } from './LacquerKit';

const ART = { key: 'camp_merchant_art', url: 'assets/camp/merchant.webp' };
const ICONS = { key: 'item_icons', url: 'assets/items/item-icons.webp', json: 'assets/items/item-icons.json' };

/** 先补齐要用的图（军需商人立绘、道具图集；进营寨时随战斗图集释放了），再打开。 */
export function openCampMerchant(scene: Phaser.Scene, depth: number, onClose: () => void): void {
  const L = scene.load; let queued = false;
  if (!scene.textures.exists(ART.key)) { L.image(ART.key, ART.url); queued = true; }
  if (!scene.textures.exists(ICONS.key)) { L.atlas(ICONS.key, ICONS.url, ICONS.json); queued = true; }
  if (!queued) { new CampMerchantUI(scene, depth, onClose); return; }
  L.once(Phaser.Loader.Events.COMPLETE, () => { if (scene.sys.isActive()) new CampMerchantUI(scene, depth, onClose); }); L.start();
}

export class CampMerchantUI {
  readonly root: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Container;
  private tip: ItemTooltip;
  private notice = '';
  constructor(private readonly scene: Phaser.Scene, depth: number, private readonly onClose: () => void) {
    scene.children.getByName('camp-merchant')?.destroy();
    this.root = scene.add.container(0, 0).setDepth(depth).setName('camp-merchant');
    this.tip = new ItemTooltip(scene, depth + 40);
    this.root.once(Phaser.GameObjects.Events.DESTROY, () => this.tip.destroy());
    ensureItemTextures(scene);
    this.render();
  }
  private get desktop() { return this.scene.scale.width > 600; }
  private text(x: number, y: number, v: string, size: number, color: string = LQ.cream, heading = false) {
    const t = this.scene.add.text(x, y, v, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2 }); this.body.add(t); return t;
  }
  close(): void { this.root.destroy(); this.onClose(); }
  render(): void {
    const s = this.scene, W = s.scale.width, H = s.scale.height, D = this.desktop;
    this.root.removeAll(true); this.tip.hide();
    this.body = s.add.container(0, 0); this.root.add(this.body);
    this.body.add(s.add.rectangle(W / 2, H / 2, W, H, 0x0b0806, .78).setInteractive());
    const pw = D ? Math.min(820, W - 40) : W - 24, ph = D ? 430 : 700, px = (W - pw) / 2, py = (H - ph) / 2;
    const g = s.add.graphics(); lqPanel(g, px, py, pw, ph, { shadow: true }); this.body.add(g);
    this.text(W / 2, py + 28, '旅商 · 军需商人', D ? 22 : 24, LQ.title, true).setOrigin(.5).setName('camp-merchant-title');
    const w = loadWorld(), stock = campMerchantStock(), food = w.provisions;
    this.text(px + pw - 22, py + 28, '军粮 ' + food, 15, '#f3d48a').setOrigin(1, .5).setName('camp-merchant-food');
    // 立绘（电脑）
    const top = py + 58, h = D ? 270 : 240; let left = px + 20;
    if (D) {
      const aw = 150; this.plate(left, top, aw, h);
      if (s.textures.exists(ART.key)) {
        const img = s.add.image(left + aw / 2, top + h / 2, ART.key).setName('camp-merchant-art'), src = img.texture.getSourceImage() as { width: number; height: number }, bw = aw - 10, bh = h - 10, k = Math.max(bw / src.width, bh / src.height);
        img.setScale(k).setCrop((src.width - bw / k) / 2, (src.height - bh / k) / 2, bw / k, bh / k); this.body.add(img);
      }
      this.body.add(s.add.rectangle(left + 5, top + h - 33, aw - 10, 28, 0x120c07, .62).setOrigin(0));
      this.text(left + aw / 2, top + h - 19, '军需商人', 15, '#f1ddb5', true).setOrigin(.5).setLetterSpacing(3);
      left += aw + 12;
    }
    const n = stock.offers.length, gap = 10, cw = D ? ((px + pw - 20 - left) - gap * (n - 1)) / n : (pw - 40 - gap) / 2;
    let hero = 'zhaoyun'; try { hero = localStorage.getItem('im_last_hero') || hero; } catch { /* 存储不可用 */ }
    stock.offers.forEach((item, i) => {
      const x = D ? left + i * (cw + gap) : px + 20 + (i % 2) * (cw + gap), y = D ? top : top + Math.floor(i / 2) * (h + gap), q = QUALITIES[item.quality], price = campPrice(item), sold = stock.sold[i];
      this.plate(x, y, cw, h);
      const lines = item.affixes.map(a => (a.minor ? '· ' : '') + formatAffix(a)).join('\n') + (item.special ? '\n★ ' + SPECIALS[item.special].name : '');
      this.body.add(itemTile(s, x + cw / 2, y + 40, 52, item).setAlpha(sold ? .45 : 1));
      this.text(x + cw / 2, y + 72, q.name + ' · ' + SLOTS[itemSlot(item)].name, 12, '#bca579').setOrigin(.5, 0);
      this.text(x + cw / 2, y + 88, itemName(item), 15, q.css).setOrigin(.5, 0).setWordWrapWidth(cw - 12, true).setMaxLines(1).setName('camp-merchant-name-' + i);
      this.text(x + 12, y + 112, lines, 12, '#d8ccb0').setLineSpacing(2).setWordWrapWidth(cw - 22, true).setMaxLines(5);
      const hover = s.add.rectangle(x + 4, y + 4, cw - 8, h - 64, 0, .001).setOrigin(0).setInteractive().setName('camp-merchant-card-' + i); this.body.add(hover);
      this.tip.attach(hover, () => item, () => loadout(hero as CharacterId)[itemSlot(item)]);
      const can = !sold && food >= price, bw = Math.min(cw - 20, 170);
      const label = sold ? '已售罄' : food < price ? '军粮不足 · ' + price : '购入 · ' + price + ' 军粮';
      const b = lqCommand(s, x + cw / 2, y + h - 30, bw, 36, label, can, can, 13); b.hit.setName('camp-merchant-buy-' + i);
      b.hit.on('pointerdown', () => { const r = buyCampItem(i); if (r.ok) { uiSfx().play('purchase'); this.notice = '已购入 ' + itemName(item) + ' · 已收入行囊，出征前可在行囊穿戴'; } else this.notice = r.message; this.render(); });
      this.body.add([b.g, b.hit, b.caption]);
    });
    const info = this.notice || '每打完一仗换一批货：甲胄、头盔、战靴、信物各一件，用营寨军粮购买，买下直接收入行囊。' + (D ? '鼠标移到卡片上看属性对比。' : '');
    this.text(W / 2, py + ph - 76, info, 13, this.notice ? '#f3d48a' : '#cdbb94').setOrigin(.5, 0).setWordWrapWidth(pw - 60, true).setAlign('center').setName('camp-merchant-notice');
    const c = lqCommand(s, W / 2, py + ph - 30, 160, 40, '返回', false, true, 15); c.hit.setName('camp-merchant-close').setData('padDefault', true).on('pointerdown', () => this.close());
    this.body.add([c.g, c.hit, c.caption]);
  }
  private plate(x: number, y: number, w: number, h: number) {
    const g = this.scene.add.graphics(); g.fillStyle(0x120c07, .85).fillRoundedRect(x, y, w, h, 6).lineStyle(1.5, LQ.gold, .55).strokeRoundedRect(x, y, w, h, 6); this.body.add(g); return g;
  }
}
