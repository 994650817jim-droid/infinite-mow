import Phaser from 'phaser';

/**
 * 战马图集（程序绘制的过渡美术，正式图到位前使用；需求见 public/assets/mounts/ASSET_REQUEST.md）。
 * mount_horse：马身（浅灰白底，按坐骑乘色换毛色）；mount_tack：马鞍、缰绳、马镫（不染色）。
 * 两张图同一版式：4 行（down / left / right / up）× 4 帧奔跑，每格 96×96，马蹄落在 y≈88。
 * 有正式图（同名纹理已加载）时不覆盖。
 */
export const HORSE_FRAME = 96, HORSE_FOOT = 88;
const DIRS = ['down', 'left', 'right', 'up'] as const;

export function ensureHorseTextures(scene: Phaser.Scene): void {
  if (['mount_horse', 'mount_front', 'mount_tack'].every(k => scene.textures.exists(k))) return;
  for (const layer of ['mount_horse', 'mount_front', 'mount_tack'] as const) {
    if (scene.textures.exists(layer)) continue;
    const tex = scene.textures.createCanvas(layer, HORSE_FRAME * 4, HORSE_FRAME * 4); if (!tex) continue;
    const ctx = tex.getContext();
    DIRS.forEach((dir, row) => { for (let f = 0; f < 4; f++) { ctx.save(); ctx.translate(f * HORSE_FRAME, row * HORSE_FRAME); draw(ctx, dir, f, layer === 'mount_tack' ? 'tack' : layer === 'mount_front' ? 'front' : 'body'); ctx.restore(); tex.add(`${dir}_${f}`, 0, f * HORSE_FRAME, row * HORSE_FRAME, HORSE_FRAME, HORSE_FRAME); } });
    tex.refresh();
  }
}

const BODY = '#ece7de', SHADE = '#c8c0b2', DARK = '#8e877c', MANE = '#6a625a', HOOF = '#3b342e';
function leg(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, color = SHADE): void {
  const ex = x + Math.sin(angle) * len, ey = y + Math.cos(angle) * len;
  ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.fillStyle = HOOF; ctx.fillRect(ex - 3.5, ey - 1, 7, 4);
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, rot = 0): void { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); }

/** body = 马身；front = 朝镜头时挡在骑者前面的马头马颈（只有 down 方向有内容）；tack = 鞍具。 */
function draw(ctx: CanvasRenderingContext2D, dir: typeof DIRS[number], f: number, layer: 'body' | 'front' | 'tack'): void {
  const tack = layer === 'tack';
  if (layer === 'front' && dir !== 'down') return;
  const ph = f / 4 * Math.PI * 2, bob = Math.sin(ph * 2) * 1.5;
  if (dir === 'left') { ctx.translate(HORSE_FRAME, 0); ctx.scale(-1, 1); dir = 'right'; }
  if (dir === 'right') {
    if (tack) {
      // 马鞍、鞍褥、马镫、缰绳
      ellipse(ctx, 47, 41 + bob, 12, 5, '#8a2a22'); ctx.fillStyle = '#d1a24c'; ctx.fillRect(36, 40 + bob, 22, 2);
      ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(47, 45 + bob); ctx.lineTo(47, 58 + bob); ctx.stroke(); ctx.fillStyle = '#3a2a1e'; ctx.fillRect(44, 58 + bob, 6, 2);
      ctx.beginPath(); ctx.moveTo(58, 40 + bob); ctx.lineTo(79, 27 + bob); ctx.stroke();
      return;
    }
    // 尾
    ctx.strokeStyle = MANE; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(24, 44 + bob); ctx.quadraticCurveTo(12, 50 + Math.sin(ph) * 4, 13, 64 + Math.sin(ph) * 3); ctx.stroke();
    // 远侧腿
    leg(ctx, 32, 56 + bob, 28, Math.sin(ph + Math.PI) * .55, DARK); leg(ctx, 64, 56 + bob, 28, Math.sin(ph) * .55, DARK);
    // 身、颈、头
    ellipse(ctx, 46, 50 + bob, 25, 12, BODY);
    ellipse(ctx, 46, 55 + bob, 22, 6, SHADE);
    ctx.fillStyle = BODY; ctx.beginPath(); ctx.moveTo(60, 44 + bob); ctx.lineTo(74, 22 + bob); ctx.lineTo(82, 26 + bob); ctx.lineTo(70, 52 + bob); ctx.closePath(); ctx.fill();
    ellipse(ctx, 81, 27 + bob, 11, 6, BODY, .5); ellipse(ctx, 88, 31 + bob, 4, 3.5, SHADE);
    ctx.fillStyle = BODY; ctx.beginPath(); ctx.moveTo(74, 18 + bob); ctx.lineTo(77, 12 + bob); ctx.lineTo(79, 19 + bob); ctx.fill();
    ctx.fillStyle = '#1e1a18'; ctx.fillRect(81, 24 + bob, 2, 2);
    // 鬃
    ctx.strokeStyle = MANE; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(73, 19 + bob); ctx.quadraticCurveTo(66, 30 + bob, 59, 43 + bob); ctx.stroke();
    // 近侧腿
    leg(ctx, 28, 57 + bob, 29, Math.sin(ph) * .6); leg(ctx, 62, 57 + bob, 29, Math.sin(ph + Math.PI) * .6);
    return;
  }
  if (dir === 'down') {
    if (tack) { ellipse(ctx, 48, 42 + bob, 13, 5, '#8a2a22'); ctx.fillStyle = '#d1a24c'; ctx.fillRect(36, 44 + bob, 24, 2); ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(38, 46 + bob); ctx.lineTo(37, 58 + bob); ctx.moveTo(58, 46 + bob); ctx.lineTo(59, 58 + bob); ctx.stroke(); return; }
    if (layer === 'front') {
      // 头朝向镜头（叠在骑者前面）
      ellipse(ctx, 48, 50 + bob, 8, 13, BODY); ellipse(ctx, 48, 61 + bob, 6, 4, SHADE);
      ctx.fillStyle = BODY; ctx.beginPath(); ctx.moveTo(41, 39 + bob); ctx.lineTo(42, 32 + bob); ctx.lineTo(45, 38 + bob); ctx.moveTo(55, 39 + bob); ctx.lineTo(54, 32 + bob); ctx.lineTo(51, 38 + bob); ctx.fill();
      ctx.strokeStyle = MANE; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(48, 37 + bob); ctx.lineTo(48, 44 + bob); ctx.stroke();
      ctx.fillStyle = '#1e1a18'; ctx.fillRect(43, 47 + bob, 2, 2); ctx.fillRect(51, 47 + bob, 2, 2);
      return;
    }
    leg(ctx, 39, 58 + bob, 22, 0, DARK); leg(ctx, 57, 58 + bob, 22, 0, DARK);
    ellipse(ctx, 48, 50 + bob, 16, 15, BODY); ellipse(ctx, 48, 58 + bob, 13, 6, SHADE);
    leg(ctx, 42, 62 + bob, 24 - Math.max(0, Math.sin(ph)) * 6, 0); leg(ctx, 54, 62 + bob, 24 - Math.max(0, -Math.sin(ph)) * 6, 0);
    return;
  }
  // up：背向镜头
  if (tack) { ellipse(ctx, 48, 40 + bob, 13, 5, '#8a2a22'); ctx.fillStyle = '#d1a24c'; ctx.fillRect(36, 42 + bob, 24, 2); return; }
  ctx.fillStyle = BODY; ctx.beginPath(); ctx.ellipse(48, 26 + bob, 6, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(43, 20 + bob); ctx.lineTo(44, 13 + bob); ctx.lineTo(46, 19 + bob); ctx.moveTo(53, 20 + bob); ctx.lineTo(52, 13 + bob); ctx.lineTo(50, 19 + bob); ctx.fill();
  leg(ctx, 40, 58 + bob, 22, 0, DARK); leg(ctx, 56, 58 + bob, 22, 0, DARK);
  ellipse(ctx, 48, 50 + bob, 17, 15, BODY); ellipse(ctx, 48, 58 + bob, 14, 6, SHADE);
  leg(ctx, 42, 62 + bob, 24 - Math.max(0, Math.sin(ph)) * 6, 0); leg(ctx, 54, 62 + bob, 24 - Math.max(0, -Math.sin(ph)) * 6, 0);
  ctx.strokeStyle = MANE; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(48, 50 + bob); ctx.quadraticCurveTo(48 + Math.sin(ph) * 4, 62, 48 + Math.sin(ph) * 3, 72); ctx.stroke();
}
