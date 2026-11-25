import type Phaser from 'phaser';
import type { MythicWarning } from '../data/mythicGauntlet';

export const MYTHIC_RELEASE_CELL = 160;
const laneSprites = new WeakMap<Phaser.GameObjects.Image, Phaser.GameObjects.Image[]>();

export function clearMythicSignature(sprite: Phaser.GameObjects.Image): void {
  sprite.setVisible(false);
  for (const extra of laneSprites.get(sprite) ?? []) extra.setVisible(false);
}

export function mythicLaneSprite(sprite: Phaser.GameObjects.Image, key: string, index: number): Phaser.GameObjects.Image {
  let image = sprite;
  if (index > 0) {
    let extras = laneSprites.get(sprite);
    if (!extras) {
      extras = [];
      laneSprites.set(sprite, extras);
      const pool = extras;
      sprite.once('destroy', () => {
        for (const item of pool) if (item.active) item.destroy();
        laneSprites.delete(sprite);
      });
    }
    image = extras[index - 1] ?? sprite.scene.add.image(0, 0, key);
    extras[index - 1] = image;
  }
  return image;
}

/** One shared effect motif per general, fitted to each resolved strike's actual geometry. */
export function paintMythicRelease(
  sprite: Phaser.GameObjects.Image, key: string, w: MythicWarning, age: number,
): void {
  if (age < 0 || age >= .32) return;
  const phase = age < .075 ? 0 : age < .21 ? 1 : 2;
  const frame = phase + (w.kind === 'line' ? 3 : 0);
  const alpha = age < .23 ? 1 : 1 - (age - .23) / .09;
  const { x, y, radius, angle } = w;

  function stamp(
    index: number, heading: number, reach: number, width: number, height: number, rotation: number,
  ): void {
    const image = mythicLaneSprite(sprite, key, index);
    image.setTexture(key, frame).setVisible(true).setOrigin(.5)
      .setPosition(x + Math.cos(heading) * reach, y + Math.sin(heading) * reach)
      .setDisplaySize(width, height).setRotation(rotation).setAlpha(alpha).setDepth(75);
  }

  if (w.kind === 'line') {
    const width = radius * .83;
    const height = Math.min(width * .66, (w.halfWidth ?? 25) * 2);
    const reach = radius * (.45 + .12 * age / .32);
    const count = w.lanes ?? 1;
    for (let i = 0; i < count; i++) {
      const heading = angle + (i - (count - 1) / 2) * (w.spread ?? 0);
      stamp(i, heading, reach, width, height, heading);
    }
  } else if (w.kind === 'ring') {
    const inner = w.innerRadius ?? 0;
    const band = radius - inner;
    const size = band * .88;
    for (let i = 0; i < 4; i++) {
      const heading = angle + i * Math.PI / 2;
      stamp(i, heading, inner + band * .5, size, size, 0);
    }
  } else if (w.kind === 'sweep') {
    const size = radius * .77;
    const heading = angle + (age / .32 - .5) * .60;
    stamp(0, heading, radius * .55, size, size, heading);
  } else {
    const size = Math.min(160, radius * 1.78);
    stamp(0, 0, 0, size, size, 0);
  }
}
