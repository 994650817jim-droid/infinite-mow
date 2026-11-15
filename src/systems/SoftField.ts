import Phaser from 'phaser';
/**
 * 我方技能范围的柔和地面光晕（替代硬描边圆圈 + 刻度线）：中心几乎透明，靠近边缘略亮再柔和消失。
 * 只做提示，不抢画面；颜色由 tint 决定，贴图按需生成一次。
 */
export function softField(scene: Phaser.Scene, x: number, y: number, r: number, color: number, alpha = .5, depth = 19): Phaser.GameObjects.Image {
  const key = 'soft_field_ring';
  if (!scene.textures.exists(key)) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d')!, grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,.10)');
    grad.addColorStop(.62, 'rgba(255,255,255,.16)');
    grad.addColorStop(.86, 'rgba(255,255,255,.42)');
    grad.addColorStop(.94, 'rgba(255,255,255,.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    scene.textures.addCanvas(key, c);
  }
  // 斜俯视：纵向略压扁，贴合地面
  return scene.add.image(x, y, key).setDisplaySize(r * 2.08, r * 1.7).setTint(color).setAlpha(alpha).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
}
