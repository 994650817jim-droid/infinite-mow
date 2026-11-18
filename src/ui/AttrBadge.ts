import Phaser from 'phaser';
import { ATTRIBUTE_INFO, primaryAttribute, type AttributeId } from '../data/attributes';
import { FONT, TITLE_FONT, RENDER_SCALE } from '../config';

/**
 * 武将主属性印（用户 2026-11-17：「我想标记角色是属于什么主属性」）：一枚小篆刻印，一个字 + 各自印泥色——
 * 力（朱红）/ 敏（青绿）/ 智（靛蓝）/ 统（赭金），与武将卷轴上的「蜀」「突进」印同一种白文斑驳印风。
 * 鼠标停在印上显示「主属性：智力 —— …」（效果文字取 data/attributes.ts 的 ATTRIBUTE_INFO）。
 * 各处只加一行调用（选将卷轴 / 主页卷轴走 HeroWarCard，图鉴、招贤馆、属性加点、战斗 HUD），不改各界面自己的排版。
 */
export const ATTR_SEAL: Record<AttributeId, { ch: string; fill: string; css: string }> = {
  strength: { ch: '力', fill: '#a8281c', css: '#ff9a84' },
  agility: { ch: '敏', fill: '#2e6b3c', css: '#9be0a8' },
  intellect: { ch: '智', fill: '#264f82', css: '#9cc4ff' },
  command: { ch: '统', fill: '#a3761c', css: '#ffd27a' },
};
/** 悬停说明文字。 */
export function attrBadgeTip(id: AttributeId): string { return `主属性：${ATTRIBUTE_INFO[id].name} —— ${ATTRIBUTE_INFO[id].effect}；主属性每点再 +1% 全伤害`; }

function sealKey(s: Phaser.Scene, id: AttributeId, size: number): string {
  const key = `attr-seal-${id}-${size}-${RENDER_SCALE}`; if (s.textures.exists(key)) return key;
  const S = RENDER_SCALE, c = document.createElement('canvas'); c.width = Math.ceil(size * S); c.height = Math.ceil(size * S);
  const ctx = c.getContext('2d')!; ctx.scale(S, S);
  let seed = id.charCodeAt(0) * 31 + size; const r = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const { ch, fill } = ATTR_SEAL[id], w = size, h = size;
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(1, 2); ctx.lineTo(w - 2, 1); ctx.lineTo(w - 1, h - 2); ctx.lineTo(2, h - 1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#f3e2c4'; ctx.lineWidth = Math.max(1, size * .05); ctx.strokeRect(3.5, 3.5, w - 7, h - 7);
  ctx.fillStyle = '#f6e6c8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.round(size * .62)}px ${TITLE_FONT}`; ctx.fillText(ch, w / 2, h / 2 + 1);
  // 印泥斑驳
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < size * 1.4; i++) { ctx.fillStyle = `rgba(0,0,0,${.3 + r() * .5})`; ctx.beginPath(); ctx.arc(r() * w, r() * h, .4 + r() * 1.1, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
  s.textures.addCanvas(key, c); return key;
}

let tip: Phaser.GameObjects.Container | null = null;
function showTip(img: Phaser.GameObjects.Image, id: AttributeId) {
  hideTip(); const s = img.scene, b = img.getBounds(), text = attrBadgeTip(id);
  const t = s.add.text(0, 0, text, { fontFamily: FONT, fontSize: '13px', color: '#f3e6c6', wordWrap: { width: 300, useAdvancedWrap: true } }).setOrigin(0, 0);
  const pad = 8, w = t.width + pad * 2, h = t.height + pad * 2, cam = s.cameras.main;
  let x = b.right + 6, y = b.y - 2; if (x + w > cam.width - 4) x = b.x - w - 6; if (y + h > cam.height - 4) y = cam.height - h - 4; x = Math.max(4, x);
  const g = s.add.graphics(); g.fillStyle(0x1b130c, .94).fillRoundedRect(0, 0, w, h, 5).lineStyle(1.5, Phaser.Display.Color.HexStringToColor(ATTR_SEAL[id].fill).color, 1).strokeRoundedRect(0, 0, w, h, 5);
  t.setPosition(pad, pad);
  tip = s.add.container(x, y, [g, t]).setScrollFactor(0).setDepth(100000).setName('attr-badge-tip');
}
function hideTip() { tip?.destroy(); tip = null; }

/**
 * 在 (x, y) 放一枚主属性印（hero 没有主属性时返回 null）。默认可悬停看说明；scrollFactor 跟随调用处（HUD 传 0）。
 * 返回的印可再 setAttrBadge 换武将。名字 'attr-badge'（测试用）。
 */
export function attrBadge(scene: Phaser.Scene, x: number, y: number, hero: string, size = 26, o: { tip?: boolean; scrollFactor?: number; depth?: number; origin?: [number, number] } = {}): Phaser.GameObjects.Image | null {
  const id = primaryAttribute(hero); if (!id) return null;
  const img = scene.add.image(x, y, sealKey(scene, id, size)).setDisplaySize(size, size).setOrigin(...(o.origin ?? [.5, .5])).setRotation(-.04).setName('attr-badge').setData('attr', id);
  if (o.scrollFactor !== undefined) img.setScrollFactor(o.scrollFactor);
  if (o.depth !== undefined) img.setDepth(o.depth);
  if (o.tip !== false) {
    img.setInteractive({ useHandCursor: false });
    img.on('pointerover', () => showTip(img, img.getData('attr') as AttributeId));
    img.on('pointerout', hideTip); img.on('destroy', hideTip);
  }
  return img;
}
/** 换武将（卷轴切换选中武将时）：没有主属性就隐藏。 */
export function setAttrBadge(img: Phaser.GameObjects.Image | null | undefined, hero: string): void {
  if (!img) return; const id = primaryAttribute(hero); img.setVisible(!!id).setData('hasAttr', !!id); if (!id) return;
  const w = img.displayWidth, h = img.displayHeight, size = Math.round(Math.max(w, h));
  img.setTexture(sealKey(img.scene, id, size)).setDisplaySize(w, h).setData('attr', id);
}
