import type Phaser from 'phaser';
import { HEADING_FONT, TITLE_FONT } from '../config';
import type { MythicTier } from '../data/mythicGauntlet';

export interface MythicNameplateStyle {
  tier: MythicTier;
  portraitKey: string;
}

const WIDTH = 356;
const PALETTES = {
  ghost: { title: '#afd0b6', name: '#e5f4de' },
  divine: { title: '#e0bf83', name: '#fff0ca' },
} as const;

export function preloadMythicNameplates(scene: Phaser.Scene): void {
  for (const tier of ['ghost', 'divine']) {
    const key = 'mythic-nameplate-' + tier;
    if (!scene.textures.exists(key)) scene.load.image(key, 'assets/mythic-gauntlet/nameplate-' + tier + '.webp');
  }
}

export function addMythicBossNameplate(
  scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number,
  title: string, name: string, { tier, portraitKey }: MythicNameplateStyle,
): Phaser.GameObjects.Text {
  const colors = PALETTES[tier];
  const key = 'mythic-nameplate-' + tier;
  const plate = scene.textures.exists(key)
    ? scene.add.image(x, y, key).setScale(.5)
    : scene.add.rectangle(x, y, WIDTH, 58, 0x1b1a14, .94);
  plate.setName(key);
  // Socket center is shared by the two trimmed art variants.
  const portrait = scene.add.image(x - 129, y + 1, portraitKey)
    .setDisplaySize(41, 41).setName('mythic-nameplate-portrait');
  const caption = scene.add.text(x - 66, y - 12, title, {
    fontFamily: HEADING_FONT, fontSize: '13px', color: colors.title, resolution: 2,
  }).setOrigin(0, .5).setLetterSpacing(2);
  const label = scene.add.text(x - 66, y + 9, name, {
    fontFamily: TITLE_FONT, fontSize: '30px', color: colors.name, resolution: 2,
  }).setOrigin(0, .5).setLetterSpacing(3).setShadow(0, 2, '#080b08', 3, true, true);
  root.add([plate, portrait, caption, label]);
  return label;
}
