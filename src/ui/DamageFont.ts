import Phaser from 'phaser';

/**
 * 伤害数字位图字体（2026-11-20 夜间性能优化）：原来每个数字是 Phaser.Text，每次 setText / setStyle 都重画 canvas 并整张重新上传纹理
 * （满屏混战时 hitEnemy → spawnDamageText 占整帧约 10%，还制造大量 GC）。改成每种样式一张预渲染的数字字形图集（0-9 和「+」，描边 + 投影已画进字形，
 * 只在首次使用时生成一次），数字用 BitmapText 显示：setText 只拼四边形，不碰 canvas / 纹理上传。
 */
export interface DmgGlyphStyle { size: number; color: string; stroke: string; sw: number }
const CHARS = '0123456789+';
const SCALE = 2; // 字形按 2 倍分辨率画，显示时缩回（和战斗镜头的高清缩放一致，边缘不糊）

/** 取（必要时生成）某个样式的位图字体，返回字体 key。 */
export function dmgFontKey(scene: Phaser.Scene, name: string, family: string, st: DmgGlyphStyle): string {
  const key = `dmgfont_${name}`; if (scene.cache.bitmapFont.has(key)) return key;
  const pad = Math.ceil(st.sw * SCALE) + 3, px = st.size * SCALE, c0 = document.createElement('canvas').getContext('2d')!;
  c0.font = `bold ${px}px ${family}`;
  const widths = [...CHARS].map(ch => Math.ceil(c0.measureText(ch).width)), cellH = Math.ceil(px * 1.25) + pad * 2;
  const cells = widths.map(w => w + pad * 2), total = cells.reduce((a, b) => a + b, 0);
  const cv = document.createElement('canvas'); cv.width = total; cv.height = cellH; const g = cv.getContext('2d')!;
  g.font = `bold ${px}px ${family}`; g.textBaseline = 'middle'; g.textAlign = 'center'; g.lineJoin = 'round';
  const chars: Record<number, unknown> = {}; let x = 0;
  [...CHARS].forEach((ch, i) => {
    const cx = x + cells[i] / 2, cy = cellH / 2;
    g.shadowColor = '#000000'; g.shadowBlur = 2 * SCALE; g.shadowOffsetX = SCALE; g.shadowOffsetY = 2 * SCALE;
    g.lineWidth = st.sw * SCALE; g.strokeStyle = st.stroke; g.strokeText(ch, cx, cy);
    g.shadowColor = 'transparent'; g.fillStyle = st.color; g.fillText(ch, cx, cy);
    chars[ch.charCodeAt(0)] = { x, y: 0, width: cells[i], height: cellH, u0: x / total, v0: 0, u1: (x + cells[i]) / total, v1: 1, centerX: cells[i] / 2, centerY: cellH / 2, xOffset: 0, yOffset: 0, xAdvance: widths[i] + Math.ceil(st.sw * SCALE / 2), data: {}, kerning: {} };
    x += cells[i];
  });
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, cv);
  scene.cache.bitmapFont.add(key, { data: { font: key, size: px, lineHeight: cellH, retroFont: false, chars }, texture: key, frame: null });
  return key;
}
