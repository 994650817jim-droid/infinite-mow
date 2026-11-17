import Phaser from 'phaser';
import { factionTargetOfKey } from './FactionPalette';
import { YUAN_HUE } from './YuanPalette';

/**
 * 敌方箭矢按阵营配色（用户 2026-11-17「第二章弓箭手射出的箭颜色要改成对应的」）。
 * 原敌军箭矢（enemy_arrow.png）是黄巾的金杆黄羽，各章都在用。这里按「射箭的人穿的是哪一方的衣服」给箭换色：
 *  - 势力换色兵（f_<势力>_…，攻城 / 情报战）→ 该势力色（与 FactionPalette 同一套目标色）
 *  - 袁军换色兵（yuan_…，第四章）→ 土黄
 *  - 西凉兵 / 飞熊军（xiliang_… / feixiong…，第二、三、五章及董卓）→ 西凉暗红
 *  - 其他（黄巾）→ 原图
 * 只把箭上的黄色系像素换成目标色，银色箭头不动；生成一次后缓存。我方的箭不经过这里。
 */
type Target = { hue: number; sat: number } | 'gray';
const XILIANG: Target = { hue: 4, sat: .8 };
const YUAN: Target = { hue: YUAN_HUE, sat: .82 };

function targetOf(shooterKey: string): Target | null {
  // 去掉渲染层加的前缀：敌我区分描边版（iffA_enemy_…）、可读性处理版（readable_…），可能叠加
  let k = shooterKey; for (let i = 0; i < 3; i++) k = k.replace(/^(?:readable_|iff[A-Za-z0-9]*_(?:enemy|ally)_)/, '');
  const f = factionTargetOfKey(k); if (f) return f;
  if (k.startsWith('yuan_')) return YUAN;
  if (/^(xiliang_|feixiong|f_dongzhuo_)/.test(k)) return XILIANG;
  return null;
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, seg = Math.floor(h / 60) % 6;
  const [r, g, b] = seg === 0 ? [c, x, 0] : seg === 1 ? [x, c, 0] : seg === 2 ? [0, c, x] : seg === 3 ? [0, x, c] : seg === 4 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
function makeArrow(scene: Phaser.Scene, dst: string, t: Target): void {
  const src = scene.textures.get('arrow').getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min, s = max ? delta / max : 0;
    if (s < .3 || max < .2 || delta === 0) continue; // 银白箭头、深色描边不动
    let hue = max === r ? 60 * (((g - b) / delta) % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4); if (hue < 0) hue += 360;
    if (hue < 22 || hue > 72) continue; // 只换黄 / 金色系（箭羽、箭杆）
    const [nr, ng, nb] = t === 'gray' ? hsvToRgb(0, 0, max * .9) : hsvToRgb(t.hue, Math.min(1, s * t.sat), max * (t.hue < 15 || t.hue > 300 ? .82 : 1));
    d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
  }
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(dst, c);
}
/** ?arrows=old：回到原来各章都用黄巾箭（对比 / 回退用）。 */
const OLD: boolean = (() => { try { return new URLSearchParams(globalThis.location?.search ?? '').get('arrows') === 'old'; } catch { return false; } })();
/** 射箭者贴图键 → 箭矢贴图键（不需要换色时就是原 'arrow'）。 */
export function enemyArrowTexture(scene: Phaser.Scene, shooterKey: string): string {
  const t = OLD ? null : targetOf(shooterKey); if (!t || !scene.textures.exists('arrow')) return 'arrow';
  const dst = t === 'gray' ? 'arrow_gray' : `arrow_h${Math.round(t.hue)}_s${Math.round(t.sat * 100)}`;
  if (!scene.textures.exists(dst)) makeArrow(scene, dst, t);
  return dst;
}
