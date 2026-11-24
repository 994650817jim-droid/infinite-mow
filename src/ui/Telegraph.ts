import type Phaser from 'phaser';
import { HINT_MOCK, impactDust } from './HintStyle';
import { WARN_FX_ON, warnFx, type ShapeKind } from './WarnFx';

/** 特效型警示（默认）：按形状和招式类型用像素序列帧；返回 true 表示已画（缺图时 false，调用方退回方案 C 的「不画」）。 */
function fxShape(g: Phaser.GameObjects.Graphics, kind: ShapeKind, x: number, y: number, size: number, angle: number, progress: number, impact: boolean, width = 0): boolean {
  const scene = g.scene; if (!scene || !WARN_FX_ON || HINT_MOCK !== 'c') return false;
  const now = (scene as unknown as { combatNow?: number }).combatNow ?? scene.time.now, fx = warnFx(scene);
  const id = kind + ':' + Math.round(x) + ',' + Math.round(y) + ',' + Math.round(size) + ',' + Math.round(angle * 100);
  if (impact) return fx.shapeImpact(id, kind, x, y, size, angle, now, width);
  if (kind === 'charge') return fx.lane(id, kind, x, y, angle, size, width, progress, now);
  if (kind === 'sweep') return fx.sector(id, x, y, size, angle, progress, now);
  return fx.circle(id, kind, x, y, size, progress, now);
}

/**
 * 统一的地面预警圈（首领范围技、落雷、箭雨等）：
 * 柔和的淡色光晕 + 细虚线外沿（缓慢旋转）+ 由中心向外扩张的进度盘（扩满即落下），不画粗实线外框和十字准星。
 * progress：0~1 预警进度；impact=true 时为命中瞬间的一次亮闪。
 */
export function warnCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, progress = 0, color = 0xd2573a, accent = 0xf2c27a, impact = false, now = 0, fx?: ShapeKind): void {
  if (!TELEGRAPH_CLASSIC) { groundCracks(g, x, y, r, progress, 0, Math.PI * 2, 0, impact, fx); return; }
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
  if (!TELEGRAPH_CLASSIC) { laneCracks(g, x, y, angle, length, width, progress, impact); return; }
  const c = Math.cos(angle), s = Math.sin(angle), w = width / 2;
  const quad = (len: number, alpha: number, col: number) => { g.fillStyle(col, alpha).beginPath().moveTo(x - s * w, y + c * w).lineTo(x + c * len - s * w, y + s * len + c * w).lineTo(x + c * len + s * w, y + s * len - c * w).lineTo(x + s * w, y - c * w).closePath().fillPath(); };
  if (impact) { quad(length, .3, color); return; }
  quad(length, .08, color);
  const p = Math.max(0, Math.min(1, progress)); if (p > 0) quad(length * p, .14, color);
  g.lineStyle(1.4, accent, .5).beginPath().moveTo(x - s * w, y + c * w).lineTo(x + c * length - s * w, y + s * length + c * w).moveTo(x + s * w, y - c * w).lineTo(x + c * length + s * w, y + s * length - c * w).strokePath();
}

/**
 * 预警样式开关：默认用「低调提示」（用户 2026-11-16：「关于这种范围提示我不想要」）——
 * 不画填色扇形 / 圆圈 / 描边区域，只在落点留几道淡淡的地裂纹与尘点（随蓄力加深），出招者身上短暂闪光。
 * 地址栏 ?telegraph=1 恢复旧的几何范围提示。
 */
export const TELEGRAPH_CLASSIC: boolean = (() => { try { return new URLSearchParams(window.location.search).get('telegraph') === '1'; } catch { return false; } })();

const CRACK = 0x2a1d12, DUST = 0xd9c39c;
/** 稳定的伪随机（同一落点每帧画同样的裂纹，不闪烁）。 */
const jit = (seed: number, i: number): number => { const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };

/**
 * 落点地裂纹：在扇形 / 圆（arc = 2π）/ 环（inner > 0）范围内，从内向外几道折线裂纹 + 少量尘点。
 * progress 0~1 随蓄力加深；impact 为落下瞬间：尘点更亮、裂纹到头。只用线段与小方块，不做多边形填充。
 */
export function groundCracks(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, progress = 0, angle = 0, arc = Math.PI * 2, inner = 0, impact = false, fx?: ShapeKind): void {
  if (HINT_MOCK === 'c') { fxShape(g, fx ?? (arc < Math.PI * 1.99 ? 'sweep' : 'slam'), x, y, r, angle, progress, impact); return; }
  if (HINT_MOCK === 'a') { if (impact && HINT_MOCK === 'a') impactDust(g, x, y, r * .6); return; }
  const p = impact ? 1 : Math.max(0, Math.min(1, progress)), full = arc >= Math.PI * 1.99;
  const n = full ? 7 : Math.max(3, Math.round(arc * 2.2)), seed = Math.round(x * .37 + y * .61 + r);
  const a0 = .22 + p * .4, reach = .45 + p * .5, pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = full ? (i + jit(seed, i) * .6) / n * Math.PI * 2 : angle - arc / 2 + arc * (i + .2 + jit(seed, i) * .6) / n;
    const r0 = inner + (r - inner) * (.12 + jit(seed, i + 9) * .2), r1 = inner + (r - inner) * reach * (.7 + jit(seed, i + 17) * .3);
    pts.push(x + Math.cos(t) * r0, y + Math.sin(t) * r0 * .82);
    for (let k = 1; k <= 3; k++) {
      const rr = r0 + (r1 - r0) * k / 3, tt = t + (jit(seed, i * 5 + k) - .5) * .35;
      pts.push(x + Math.cos(tt) * rr, y + Math.sin(tt) * rr * .82);
    }
  }
  // 深色裂缝 + 下方 1px 浅色翻土边：深浅地面上都看得清
  for (const [w, col, al, dy] of [[1.8, CRACK, a0, 0], [1, DUST, a0 * .75, 1.5]] as const) {
    g.lineStyle(w, col, al);
    for (let i = 0; i < n; i++) { const o = i * 8; g.beginPath(); g.moveTo(pts[o], pts[o + 1] + dy); for (let k = 1; k <= 3; k++) g.lineTo(pts[o + k * 2], pts[o + k * 2 + 1] + dy); g.strokePath(); }
  }
  g.fillStyle(DUST, (impact ? .6 : .22 + p * .3));
  for (let i = 0; i < n * 2; i++) {
    const t = full ? jit(seed, i + 40) * Math.PI * 2 : angle - arc / 2 + arc * jit(seed, i + 40), rr = inner + (r - inner) * (.2 + .75 * jit(seed, i + 60)) * (impact ? 1 : reach);
    const s = impact ? 3 : 2; g.fillRect(x + Math.cos(t) * rr - s / 2, y + Math.sin(t) * rr * .82 - s / 2, s, s);
  }
}

/** 长条落点（冲锋道、枪阵、火船道）：沿方向一道断续裂纹 + 两侧尘点，随进度向前延伸。 */
export function laneCracks(g: Phaser.GameObjects.Graphics, x: number, y: number, angle: number, length: number, width: number, progress = 0, impact = false): void {
  if (HINT_MOCK === 'c') { fxShape(g, 'charge', x, y, length, angle, progress, impact, width); return; }
  if (HINT_MOCK === 'a') { if (impact && HINT_MOCK === 'a') for (let k = 1; k <= 3; k++) impactDust(g, x + Math.cos(angle) * length * k / 4, y + Math.sin(angle) * length * k / 4, width); return; }
  const p = impact ? 1 : Math.max(0, Math.min(1, progress)), c = Math.cos(angle), s = Math.sin(angle), seed = Math.round(x * .37 + y * .61 + length);
  const len = length * (.35 + .65 * p), steps = Math.max(4, Math.round(len / 38));
  const a0 = .22 + p * .4;
  for (const [w, col, al, dy] of [[1.8, CRACK, a0, 0], [1, DUST, a0 * .75, 1.5]] as const) {
    g.lineStyle(w, col, al); g.beginPath(); g.moveTo(x, y + dy);
    for (let k = 1; k <= steps; k++) { const d = len * k / steps, off = (jit(seed, k) - .5) * width * .35; g.lineTo(x + c * d - s * off, y + s * d + c * off + dy); }
    g.strokePath();
  }
  g.fillStyle(DUST, impact ? .6 : .22 + p * .3);
  for (let k = 0; k < steps * 2; k++) { const d = len * jit(seed, k + 30), off = (jit(seed, k + 50) - .5) * width, z = impact ? 3 : 2; g.fillRect(x + c * d - s * off - z / 2, y + s * d + c * off - z / 2, z, z); }
}

/**
 * 出招前身上闪光：蓄力期间每 240ms 一次约 70ms 的暖橙着色（不是整身刷白）。
 * 借用敌人受击闪白的复原机制（flashUntil 到时 updateVisual 恢复原色），所以不会残留颜色。
 */
export function windupFlash(target: { flash(now: number): void; flashUntil?: number; sprite?: { setTint(c: number): unknown } } | null | undefined, now: number): void {
  if (!target || Math.floor(now / 60) % 4 !== 0) return;
  if (target.sprite && target.flashUntil !== undefined) { target.sprite.setTint(0xffb27a); target.flashUntil = now + 70; }
  else target.flash(now);
}

/** Hollow warning: the safe center stays visually empty in every hint mode. */
export function warnRing(g: Phaser.GameObjects.Graphics, x: number, y: number, outer: number, inner: number, progress: number, impact = false): void {
  const p = Math.max(0, Math.min(1, progress)), color = impact ? 0xf5c78b : 0xcb7852;
  g.lineStyle(2, color, .4 + p * .5).strokeCircle(x, y, outer);
  g.lineStyle(2, 0xc6cba7, .7).strokeCircle(x, y, inner);
  for (let i = 0; i < 20; i++) {
    const a = i * Math.PI / 10, c = Math.cos(a), n = Math.sin(a);
    const start = inner + 5, end = inner + (outer - inner - 4) * (.45 + p * .5);
    g.lineStyle(impact ? 3 : 1, color, impact ? .85 : .3 + p * .4).lineBetween(x + c * start, y + n * start, x + c * end, y + n * end);
    if (impact) g.fillStyle(0xc9a77b, .7).fillRect(x + c * end - 2, y + n * end - 2, 4, 4);
  }
}
