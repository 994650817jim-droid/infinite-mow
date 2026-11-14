import Phaser from 'phaser';

/**
 * 逐帧测量精灵表中人物的不透明像素高度（alpha>24），用于在不同素材之间统一人物比例：
 * 同一兵种的攻击表、或个别画小的行走帧，按行走表的中位高度校正缩放，避免出手时“一大一小”。
 * 每张表只在首次使用时测一次（一次 getImageData），结果缓存。
 */
const frameHeights = new Map<string, Map<string, number>>();
const medians = new Map<string, number>();

function measure(scene: Phaser.Scene, key: string): Map<string, number> | undefined {
  const cached = frameHeights.get(key);
  if (cached) return cached;
  if (!scene.textures.exists(key)) return undefined;
  const texture = scene.textures.get(key);
  const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = source.width, h = source.height;
  if (!w || !h) return undefined;
  const result = new Map<string, number>();
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;
    for (const name of texture.getFrameNames()) {
      const f = texture.get(name);
      let top = -1, bottom = -1;
      for (let y = f.cutY; y < f.cutY + f.cutHeight && top < 0; y++) for (let x = f.cutX; x < f.cutX + f.cutWidth; x++) if (data[(y * w + x) * 4 + 3] > 24) { top = y; break; }
      for (let y = f.cutY + f.cutHeight - 1; y >= f.cutY && bottom < 0; y--) for (let x = f.cutX; x < f.cutX + f.cutWidth; x++) if (data[(y * w + x) * 4 + 3] > 24) { bottom = y; break; }
      if (top >= 0 && bottom >= top) result.set(name, bottom - top + 1);
    }
  } catch {
    // 跨域或画布不可读：不做校正。
  }
  frameHeights.set(key, result);
  return result;
}

/** 单帧人物高度（像素，未缩放）；无法测量时返回 undefined。 */
export function figureHeight(scene: Phaser.Scene, key: string, frame: string | number): number | undefined {
  return measure(scene, key)?.get(String(frame));
}

/** 整张表的人物中位高度，作为该表的“标准身高”。 */
export function sheetFigureHeight(scene: Phaser.Scene, key: string): number | undefined {
  if (medians.has(key)) return medians.get(key);
  const heights = [...(measure(scene, key)?.values() ?? [])].sort((a, b) => a - b);
  const value = heights.length ? heights[Math.floor(heights.length / 2)] : undefined;
  if (value !== undefined) medians.set(key, value);
  return value;
}

/**
 * 相对行走表标准身高的校正倍数：偏差小于 8% 视为同一比例不处理；限制在 0.8~1.5，
 * 防止举枪、俯身等姿势本来就矮的帧被过度放大。
 */
export function figureCorrection(scene: Phaser.Scene, referenceKey: string, key: string, frame: string | number): number {
  const ref = sheetFigureHeight(scene, referenceKey), sheet = sheetFigureHeight(scene, key), own = figureHeight(scene, key, frame);
  if (!ref || !sheet || !own) return 1;
  // 不同表之间按整表中位身高统一（攻击表里下蹲、前刺等姿势的相对高低得以保留）。
  let ratio = Math.abs(ref / sheet - 1) < .08 ? 1 : ref / sheet;
  // 同一表内：只校正明显画小/画大的个别帧（偏差 >18%），保留正常的步伐起伏。
  const inSheet = sheet / own;
  if (Math.abs(inSheet - 1) >= .18) ratio *= inSheet;
  return Phaser.Math.Clamp(ratio, .8, 1.5);
}
