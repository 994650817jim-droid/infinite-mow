import Phaser from 'phaser';

/**
 * 第四章河北袁军配色：把西凉兵动作表复制一份，只把高饱和红色（军服、盔缨、旗）换成袁军土黄。
 * 原贴图不改（第二、三章照常使用）；“readable_” 处理版存在时同步生成 readable_yuan_*。
 * 新贴图键：yuan_<原键>；帧名与切分与原表一致。
 */
export const YUAN_HUE = 42; // 土黄（度）
export function yuanKey(key: string) { return 'yuan_' + key; }

function recolor(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), v = max, delta = max - min, s = max ? delta / max : 0;
    if (s < .2 || v < .14 || max !== r) continue;
    let hue = 60 * (((g - b) / delta) % 6); if (hue < 0) hue += 360;
    if (hue > 18 && hue < 330) continue; // 只动红色系（肤色、铜金等偏橙黄的不动）
    if (s < .32 && hue > 10 && hue < 330) continue; // v2 图的暗红 / 绛红饱和度低（.2~.32）：只收正红到洋红一段，棕色皮革不动
    // 红 → 土黄：保持明度，略降饱和
    const s2 = s * .82, c = v * s2, x = c * (1 - Math.abs((YUAN_HUE / 60) % 2 - 1)), m = v - c;
    const [r1, g1, b1] = YUAN_HUE < 60 ? [c, x, 0] : [x, c, 0];
    d[i] = Math.round((r1 + m) * 255); d[i + 1] = Math.round((g1 + m) * 255); d[i + 2] = Math.round((b1 + m) * 255);
  }
  ctx.putImageData(img, 0, 0);
}
function copyRecolored(scene: Phaser.Scene, src: string, dst: string) {
  if (scene.textures.exists(dst) || !scene.textures.exists(src)) return;
  const t = scene.textures.get(src), source = t.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const c = document.createElement('canvas'); c.width = source.width; c.height = source.height;
  const ctx = c.getContext('2d', {willReadFrequently: true})!; ctx.drawImage(source, 0, 0); recolor(ctx, c.width, c.height);
  const nt = scene.textures.addCanvas(dst, c); if (!nt) return;
  for (const name of t.getFrameNames()) { const f = t.get(name); nt.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
  // 西凉动作表在 BootScene 中统一为 NEAREST（像素清晰）
  nt.setFilter(Phaser.Textures.FilterMode.NEAREST);
}
/** 生成袁军配色贴图（含 readable_ 版），返回新建的键（供战斗结束后释放）。 */
export function ensureYuanTextures(scene: Phaser.Scene, keys: readonly string[]): string[] {
  const made: string[] = [];
  for (const key of keys) {
    copyRecolored(scene, key, yuanKey(key)); made.push(yuanKey(key));
    if (scene.textures.exists('readable_' + key)) { copyRecolored(scene, 'readable_' + key, 'readable_' + yuanKey(key)); made.push('readable_' + yuanKey(key)); }
  }
  return made;
}
