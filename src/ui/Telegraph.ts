import type Phaser from 'phaser';

/**
 * 统一的地面预警圈（首领范围技、落雷、箭雨等）：
 * 柔和的淡色光晕 + 细虚线外沿（缓慢旋转）+ 由中心向外扩张的进度盘（扩满即落下），不画粗实线外框和十字准星。
 * progress：0~1 预警进度；impact=true 时为命中瞬间的一次亮闪。
 */
export function warnCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, progress = 0, color = 0xd2573a, accent = 0xf2c27a, impact = false, now = 0): void {
  if (impact) {
    g.fillStyle(accent, .22).fillCircle(x, y, r);
    g.fillStyle(color, .28).fillCircle(x, y, r * .8);
    g.lineStyle(2, accent, .7).strokeCircle(x, y, r);
    return;
  }
  // 光晕：外淡内更淡，边缘略浓，像落在地面上的光
  g.fillStyle(color, .05).fillCircle(x, y, r);
  g.fillStyle(color, .04).fillCircle(x, y, r * .72);
  // 进度盘
  const p = Math.max(0, Math.min(1, progress));
  if (p > 0) g.fillStyle(color, .1 + p * .08).fillCircle(x, y, r * p);
  // 虚线外沿：12 段短弧，缓慢旋转
  const seg = 12, spin = now / 900, gap = .45;
  g.lineStyle(1.6, accent, .45 + p * .35);
  for (let i = 0; i < seg; i++) {
    const a0 = spin + i * Math.PI * 2 / seg, a1 = a0 + Math.PI * 2 / seg * (1 - gap);
    g.beginPath(); g.arc(x, y, r, a0, a1); g.strokePath();
  }
}

/** 长条形预警（冲锋道、枪阵）：淡填充 + 细边 + 沿方向推进的进度条。 */
export function warnLane(g: Phaser.GameObjects.Graphics, x: number, y: number, angle: number, length: number, width: number, progress = 0, color = 0xd2573a, accent = 0xf2c27a, impact = false): void {
  const c = Math.cos(angle), s = Math.sin(angle), w = width / 2;
  const quad = (len: number, alpha: number, col: number) => { g.fillStyle(col, alpha).beginPath().moveTo(x - s * w, y + c * w).lineTo(x + c * len - s * w, y + s * len + c * w).lineTo(x + c * len + s * w, y + s * len - c * w).lineTo(x + s * w, y - c * w).closePath().fillPath(); };
  if (impact) { quad(length, .3, color); return; }
  quad(length, .08, color);
  const p = Math.max(0, Math.min(1, progress)); if (p > 0) quad(length * p, .14, color);
  g.lineStyle(1.4, accent, .5).beginPath().moveTo(x - s * w, y + c * w).lineTo(x + c * length - s * w, y + s * length + c * w).moveTo(x + s * w, y - c * w).lineTo(x + c * length + s * w, y + s * length - c * w).strokePath();
}
