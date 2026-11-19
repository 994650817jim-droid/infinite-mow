/**
 * 3-2 宛城夜袭 · 典韦守营（友军，systems/DianweiGuard.ts）的数值（初值，待平衡会话复核）。
 * 11-19 用户「典韦可以动和有自己技能」：守后营寨门一圈（zone），圈内有敌人就走过去打、圈里清了回门口；
 * 技能：双戟旋风（身边 ≥3 敌，击退）、掷戟（圈内远处的敌人）、恶来死战（血 < 30% 一次：减伤 + 加攻速，红气）。
 * 只打敌人，不伤主将；预警按友军色。
 */
export const DIANWEI_GUARD = {
  hp: 1500,
  /** 普通双戟：每 swingMs 打身边 swingRadius 一圈，每个敌人 swingDamage */
  swingMs: 1200, swingDamage: 30, swingRadius: 80,
  /** 约这么多比例的敌兵（按出生编号）改打典韦 */
  lureShare: .4,
  /** 贴身敌兵的接触伤害倍率与间隔（秒） */
  contactMul: .6, contactCd: .9,
  /** 营门（守点）：主将出生点正后方 */
  offsetY: 220,
  /** 救下典韦的军功 */
  meritSaved: 80,
  /** 身体半径：别的单位进不来（防穿模） */
  body: 26,
  /** 占位图显示高度 = 主将 × heightMul */
  heightMul: 1.35,
  /** 挥戟攻击帧时长（4 帧） */
  attackMs: 380,
  /** 专属双戟图显示倍率（同首领 v2：格 288 × 0.5） */
  artScale: .5,
  /** 守区半径（以营门为圆心，绝不走出）、走速、贴到多近停下出手、回门口的容差、走路一帧走多远（像素） */
  zone: 220, speed: 95, engage: 54, homeSlack: 12, stride: 17,
  /** 双戟旋风：身边 radius 内 ≥ minEnemies 个敌人、冷却到了才放；起手 windupMs（友军色预警圈），伤害 = swingDamage × damageMul，击退 knockback 像素 */
  whirl: { everyMs: 8000, minEnemies: 3, radius: 125, windupMs: 450, spinMs: 520, damageMul: 2.2, knockback: 70, fx: 280 },
  /** 掷戟：圈内离典韦 minDist–maxDist 的敌人；起手 windupMs（友军色直线预警），戟飞 speed 像素 / 秒，命中伤害 = swingDamage × damageMul */
  throw: { everyMs: 6000, minDist: 120, maxDist: 320, windupMs: 300, speed: 560, damageMul: 2.6, fx: 64 },
  /** 恶来死战：血量低于 at 时一次；持续 ms，受伤 ×takenMul，普通挥戟间隔 ×swingMul，红气 fx 大小 */
  rage: { at: .3, ms: 8000, takenMul: .5, swingMul: .55, fx: 170 },
  /** 台词（data/story/qunxiong.ts barks）：开场几毫秒后、曹操开场、血量门槛、主将走近（距离 / 开场多久后才算）*/
  barks: { startMs: 1800, caoMs: 6000, hp50: .5, hp20: .2, helpDist: 210, helpAfterMs: 9000 },
  /** 友军预警染色（WarnFx tint） */
  warnTint: 0x8fe3c6,
} as const;

/** 典韦台词节点 id（qunxiong.ts barks，StoryDirector.line 触发；剧情设置关掉时不播）。 */
export const DIANWEI_BARKS = {
  start: 'qunxiong-2.dw_start', cao: 'qunxiong-2.dw_cao', hp50: 'qunxiong-2.dw_hp50', hp20: 'qunxiong-2.dw_hp20', help: 'qunxiong-2.dw_help',
  whirl: 'qunxiong-2.dw_whirl', throw: 'qunxiong-2.dw_throw', rage: 'qunxiong-2.dw_rage', saved: 'qunxiong-2.dw_saved', fall: 'qunxiong-2.dw_fall',
} as const;
