/**
 * 军功信物（经验宝石）的手绘图与掉落 / 吸取手感（2026-11-18 用户：「关于军功掉落那个效果要改一下优化一下」）。
 * 图：assets/gems/（ChatGPT 手绘，原图在 originals/）
 *  - gem_tok_small：青铜古钱 4 帧（每帧 64×64，高光从左上扫到右下）——价值 < 10
 *  - gem_tok_large：金令牌 + 朱印 + 红缨 4 帧（每帧 96×96）——价值 ≥ 10
 *  - gem_fx（每帧 128×128，叠加混合）：0–3 拾取闪光、4 小号光晕、5 大号光晕
 * 缺图时退回 TextureFactory 的程序光团 gem_small / gem_large（只作兜底，不闪光、不画光晕）。
 * 时间单位毫秒，尺寸为世界像素。
 */
export const GEM_FX = {
  /** 同屏上限（对象池大小） */
  cap: 200,
  /** 显示尺寸（整帧；图里物件约占帧的 80%，所以铜钱约 14px、令牌约 20px） */
  smallSize: 17, largeSize: 26, largeValue: 10,
  /** 掉落：从敌人身上弹出（离地 lift 起跳），抛物线落到 spread 半径内某点，弧高 arc；随后轻弹 bounce 像素 */
  dropMs: 220, bounceMs: 100, lift: 18, spread: 28, arc: 26, bounce: 5,
  /** 落地后：上下浮动幅度 / 周期，光晕呼吸周期与透明度 */
  bobPx: 2, bobMs: 1300, glowMs: 1800, glowAlpha: [.28, .55] as const,
  /** 光晕显示尺寸（小 / 大号） */
  glowSmall: 40, glowLarge: 58,
  /** 高光扫过：每 shineEvery 毫秒扫一次，一次 shineMs */
  shineEvery: 2400, shineMs: 420,
  /** 吸取：初速、加速度、最高速（像素 / 秒），到达距离；残影落后的距离与透明度 */
  flyStart: 140, flyAccel: 2200, flyMax: 980, arriveDist: 22, ghostLag: .035, ghostAlpha: .38,
  /** 拾取闪光：显示尺寸、时长、同时最多几个（超出就复用最早的） */
  sparkSize: 44, sparkMs: 260, sparkCap: 12,
  /** 降级：手机布局一律降级；同屏宝石超过 liteAbove 个时新掉的也降级（不画光晕、残影，不闪光） */
  liteAbove: 120,
} as const;
