import Phaser from 'phaser';
import { actorDepth } from '../config';
import { FIRE_FRAME_MS, FIREPIT_ART } from '../data/fireProps';

/**
 * 只看不打的燃烧火盆 / 篝火（营寨布景、江北曹营这种主将够不着的地方）：手绘序列帧循环（火盆 brazier_burning / 篝火 camp_firepit），
 * 每个场景一个计时器统一换帧，镜头外的不换（省得一直刷）。没图返回 null，不画替代图形。可打的火盆走 BattlefieldSupplies。
 */
const decor = new WeakMap<Phaser.Scene, Set<Phaser.GameObjects.Image>>();
function ticker(scene: Phaser.Scene): Set<Phaser.GameObjects.Image> {
  let set = decor.get(scene); if (set) return set;
  set = new Set(); decor.set(scene, set); const own = set; let acc = 0;
  const tick = (_t: number, dt: number) => {
    acc += dt; if (acc < FIRE_FRAME_MS) return; acc = 0;
    const v = scene.cameras.main.worldView, pad = 120, f = Math.floor(scene.time.now / FIRE_FRAME_MS) % 8;
    for (const im of own) { if (!im.active) { own.delete(im); continue; } if (im.x > v.left - pad && im.x < v.right + pad && im.y > v.top - pad && im.y < v.bottom + pad + im.displayHeight) im.setFrame(f); }
  };
  scene.events.on('update', tick);
  scene.events.once('shutdown', () => { scene.events.off('update', tick); decor.delete(scene); });
  return set;
}
export function burningDecor(scene: Phaser.Scene, x: number, y: number, size: number, kind: 'brazier' | 'pit' = 'brazier', name = 'fire-decor'): Phaser.GameObjects.Image | null {
  const key = kind === 'pit' ? FIREPIT_ART.key : 'brazier_burning'; if (!scene.textures.exists(key)) return null;
  const im = scene.add.image(x, y, key, Math.floor(Math.random() * 8)).setOrigin(.5, .92).setDisplaySize(size, size).setDepth(actorDepth(y)).setName(name);
  ticker(scene).add(im); return im;
}
