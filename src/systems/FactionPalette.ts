import Phaser from 'phaser';
import type {FactionId} from '../world/WorldCities';

/**
 * 攻城战守军配色：把西凉兵动作表复制一份，只把高饱和红色（军服、盔缨、旗）换成该势力的颜色。
 * 原贴图不改；readable_ 处理版同步生成。董卓沿用原红色；地方豪强、公孙瓒去饱和为灰白。
 * 新键：f_<势力>_<原键>，帧名与切分不变。（第四章的 YuanPalette 为同一做法的早期专用版。）
 */
type Target = {hue: number; sat: number} | 'gray' | null;
const TARGET: Record<FactionId, Target> = {
  player: null, dongzhuo: null,
  yuanshao: {hue: 42, sat: .82}, yellow: {hue: 52, sat: .9}, caocao: {hue: 218, sat: .7}, yuanshu: {hue: 282, sat: .6},
  liubiao: {hue: 178, sat: .65}, sun: {hue: 22, sat: .95}, mateng: {hue: 32, sat: .55}, liuzhang: {hue: 78, sat: .55},
  zhanglu: {hue: 228, sat: .35}, taoqian: {hue: 140, sat: .5}, han: 'gray', gongsun: 'gray',
};
export function factionKey(faction: FactionId, key: string): string { return TARGET[faction] ? `f_${faction}_${key}` : key; }

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, seg = Math.floor(h / 60) % 6;
  const [r, g, b] = seg === 0 ? [c, x, 0] : seg === 1 ? [x, c, 0] : seg === 2 ? [0, c, x] : seg === 3 ? [0, x, c] : seg === 4 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
function recolor(ctx: CanvasRenderingContext2D, w: number, h: number, target: Exclude<Target, null>) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min, s = max ? delta / max : 0;
    if (s < .32 || max < .14 || max !== r) continue;
    let hue = 60 * (((g - b) / delta) % 6); if (hue < 0) hue += 360;
    if (hue > 18 && hue < 330) continue; // 只动红色系
    const [nr, ng, nb] = target === 'gray' ? hsvToRgb(0, 0, Math.min(1, max * .95)) : hsvToRgb(target.hue, Math.min(1, s * target.sat), max);
    d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
  }
  ctx.putImageData(img, 0, 0);
}
function copyRecolored(scene: Phaser.Scene, src: string, dst: string, target: Exclude<Target, null>) {
  if (scene.textures.exists(dst) || !scene.textures.exists(src)) return;
  const t = scene.textures.get(src), source = t.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const c = document.createElement('canvas'); c.width = source.width; c.height = source.height;
  const ctx = c.getContext('2d', {willReadFrequently: true})!; ctx.drawImage(source, 0, 0); recolor(ctx, c.width, c.height, target);
  const nt = scene.textures.addCanvas(dst, c); if (!nt) return;
  for (const name of t.getFrameNames()) { const f = t.get(name); nt.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
  nt.setFilter(Phaser.Textures.FilterMode.NEAREST);
}
/** 生成某势力的守军贴图（含 readable_ 版），返回新建的键。董卓等无需换色时返回空。 */
export function ensureFactionTextures(scene: Phaser.Scene, faction: FactionId, keys: readonly string[]): string[] {
  const target = TARGET[faction]; if (!target) return [];
  const made: string[] = [];
  for (const key of keys) {
    const dst = factionKey(faction, key); copyRecolored(scene, key, dst, target); made.push(dst);
    if (scene.textures.exists('readable_' + key)) { copyRecolored(scene, 'readable_' + key, 'readable_' + dst, target); made.push('readable_' + dst); }
  }
  return made;
}
