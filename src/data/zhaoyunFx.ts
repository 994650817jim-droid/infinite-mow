/**
 * 赵云被动「七进七出」特效参数（用户 2026-11-18「关于赵子龙被动特效可以做一下」）。
 * 图全是手绘序列帧（ChatGPT 出图黑底；tools/prepare-fx-sheet.mjs ALPHA=1 反解成透明，普通混合——亮地面上也保住银白 / 淡青，不会叠成一片白）：
 *  - zhaoyun_scales 6×3（每格 128）：行 0 龙鳞点亮（帧 0 = 熄灭态、帧 5 = 稳定点亮）、行 1 熄灭化光屑、行 2 满层流光（循环）；
 *  - zhaoyun_thrust 4×2（每格 384，内容是格子中线上的一条横带，朝右）：白龙枪芒 8 帧；
 *  - zhaoyun_aura 6×2（每格 256）：行 0 白龙绕身一闪（光圈中心约在格高 .79），行 1 突进疾风拖尾（朝右，尖端约在格宽 .9）。
 * 尺度克制：用户嫌张飞 / 魏延招牌特效太夸张已调小过，这里都不超过现有招牌特效（战吼气势 120×240、马超冲锋一类）。
 */
export const ZHAOYUN_FX = {
  /** 主将精灵原点到脚底的距离（v2 行走锚点让脚底在原点下方约 31 像素；接地阴影画在 +26）。 */
  footDy: 29,
  /** 层数龙鳞：脚下前半圈（不挡人物、不碰头顶的「主将」标记 / 名牌 / 伤害数字）。 */
  scales: {
    rx: 30, ry: 9, oy: 0,
    /** 7 枚沿前半椭圆排开的角度范围（弧度，0 = 右，π/2 = 正下方）。 */
    from: Math.PI * .08, to: Math.PI * .92,
    size: 15, sizeMobile: 13,
    /** 熄灭态透明度（图里熄灭态本就是暗灰蓝的淡影）。 */
    idleAlpha: .8, litAlpha: 1,
    lightMs: 220, outMs: 320, shimmerFps: 10,
  },
  /** 满层触发：白龙枪芒（长度跟这一枪的实际枪长走）。 */
  thrust: { ms: 380, alpha: .92, lenMul: 1.05, maxLen: 300 },
  /** 白龙绕身一闪。 */
  aura: { ms: 420, size: 100, sizeMobile: 88, originY: .79, alpha: .9 },
  /** 突进残影：人物同帧的淡青剪影 ghosts 个，沿出枪反方向排开 gap 像素、画在人物身后，lifeMs 淡出；腰间一道疾风拖尾（dy = 离脚底的高度）。 */
  ghosts: { count: 3, countMobile: 1, gap: 22, lifeMs: 280, alpha: .32, tint: 0xd6f4ff },
  trail: { ms: 340, width: 120, height: 120, alpha: .8, dy: 30 },
} as const;
