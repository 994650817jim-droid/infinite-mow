import Phaser from 'phaser';

/**
 * 过渡素材（不是独立美术）：孙尚香、貂蝉的正式行走图 / 动作图 / 立绘尚未绘制，
 * 开机时用黄月英的图集换色生成同尺寸画布纹理——只把绿色衣饰换成该武将的主色，肤色、发色、金属件不变。
 * 生成的纹理键与正式素材一致（<id>_walk_sheet / <id>_actions / <id>_portrait），
 * 正式图放进 public/assets 并在 BootScene 加载后，这里检测到键已存在就自动跳过。
 * 素材需求见 public/assets/hero-actions/NEW_HEROES_ASSET_REQUEST.md。
 */
export interface PlaceholderHero { id: string; source: string; hue: number; satMul: number; lightMul: number; }
export const PLACEHOLDER_HEROES: PlaceholderHero[] = [
  { id: 'sunshangxiang', source: 'huangyueying', hue: 354, satMul: 1.9, lightMul: 1.12 }, // 吴 · 赤红
  { id: 'diaochan', source: 'huangyueying', hue: 300, satMul: 1.6, lightMul: 1.15 }, // 群 · 粉紫
];
export const PLACEHOLDER_WALK_KEYS = PLACEHOLDER_HEROES.map(h => h.id + '_walk_sheet');
export const PLACEHOLDER_ACTION_KEYS = PLACEHOLDER_HEROES.map(h => h.id + '_actions');

/** 把绿色系（色相约 58°–180°，含行走图里偏橄榄的绿）像素换到目标色相，按倍率提饱和度与明度。金色（约 40°–55°）不动。 */
function recolor(data: Uint8ClampedArray, hue: number, satMul: number, lightMul: number): void {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d < .04 || max !== g) continue; // 只处理以绿为主的有色像素
    const l0 = (max + min) / 2, s = d / (1 - Math.abs(2 * l0 - 1) || 1), l = Math.min(.9, l0 * lightMul);
    let h = 60 * (((b - r) / d) + 2);
    if (h < 0) h += 360;
    if (h < 58 || h > 180 || s < .08) continue;
    const s2 = Math.min(1, s * satMul), c = (1 - Math.abs(2 * l - 1)) * s2, x = c * (1 - Math.abs(((hue / 60) % 2) - 1)), m = l - c / 2;
    const k = Math.floor(hue / 60) % 6;
    const [rr, gg, bb] = k === 0 ? [c, x, 0] : k === 1 ? [x, c, 0] : k === 2 ? [0, c, x] : k === 3 ? [0, x, c] : k === 4 ? [x, 0, c] : [c, 0, x];
    data[i] = Math.round((rr + m) * 255); data[i + 1] = Math.round((gg + m) * 255); data[i + 2] = Math.round((bb + m) * 255);
  }
}

function recolored(scene: Phaser.Scene, from: string, to: string, hero: PlaceholderHero, frames?: (t: Phaser.Textures.CanvasTexture, w: number, h: number) => void): boolean {
  if (scene.textures.exists(to) || !scene.textures.exists(from)) return false;
  const src = scene.textures.get(from).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const t = scene.textures.createCanvas(to, src.width, src.height);
  if (!t) return false;
  t.context.drawImage(src, 0, 0);
  const img = t.context.getImageData(0, 0, src.width, src.height);
  recolor(img.data, hero.hue, hero.satMul, hero.lightMul);
  t.context.putImageData(img, 0, 0);
  t.refresh();
  frames?.(t, src.width, src.height);
  return true;
}

/** 在 registerWalkSheet / createReadableTextures / applyHdHeroSheets 之前调用。返回生成的纹理键（测试用）。 */
export function createPlaceholderHeroArt(scene: Phaser.Scene): string[] {
  const made: string[] = [];
  const dirs = ['down', 'left', 'right', 'up'];
  for (const hero of PLACEHOLDER_HEROES) {
    const walk = hero.id + '_walk_sheet', act = hero.id + '_actions', portrait = hero.id + '_portrait';
    if (recolored(scene, hero.source + '_walk_sheet', walk, hero, (t, w) => {
      const cell = w / 4; dirs.forEach((d, row) => { for (let col = 0; col < 4; col++) t.add(`${d}_${col}`, 0, col * cell, row * cell, cell, cell); });
    })) made.push(walk);
    if (recolored(scene, hero.source + '_actions', act, hero, (t, w) => {
      const cell = w / 4; for (let i = 0; i < 28; i++) t.add(String(i), 0, (i % 4) * cell, Math.floor(i / 4) * cell, cell, cell);
    })) made.push(act);
    if (recolored(scene, hero.source + '_portrait', portrait, hero)) made.push(portrait);
  }
  return made;
}
