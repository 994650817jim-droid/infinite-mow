export type TroopKind = 'swordsman' | 'spearman' | 'archer' | 'crossbowman' | 'guardian' | 'rider' | 'halberdier' | 'medic';
export type Formation = 'wedge' | 'scales' | 'geese' | 'circle';
export type Order = 'guard' | 'sortie';
export interface TroopDef { name: string; mark: string; hp: number; damage: number; armor: number; range: number; cooldown: number; speed: number; cost: number; art: string; tint: number; ranged?: boolean; perk: string; actionVisual?: { texture: string }; walkVisual?: { texture: string; scale: number; groundY: number }; }
export const TROOPS: Record<TroopKind, TroopDef> = {
  swordsman: { name: '刀盾兵', mark: '刀', hp: 85, damage: 15, armor: 2, range: 75, cooldown: .95, speed: 150, cost: 10, art: 'shu_swordsman', tint: 0xffffff, perk: 'Lv3 连斩两敌' },
  spearman: { name: '长枪兵', mark: '枪', hp: 70, damage: 18, armor: 1, range: 125, cooldown: 1.1, speed: 150, cost: 12, art: 'shu_spearman', tint: 0xffffff, perk: 'Lv3 对骑兵伤害翻倍' },
  archer: { name: '弓箭兵', mark: '弓', hp: 50, damage: 7.8, armor: 0, range: 260, cooldown: 1.15, speed: 145, cost: 12, art: 'shu_archer', tint: 0xffffff, ranged: true, perk: 'Lv3 双目标齐射' },
  crossbowman: { name: '连弩兵', mark: '弩', hp: 46, damage: 5.2, armor: 0, range: 220, cooldown: .5, speed: 145, cost: 16, art: 'shu_archer', tint: 0xffffff, ranged: true, perk: 'Lv3 每次两矢', walkVisual: { texture: 'legion_crossbowman_walk', scale: 0.72, groundY: .875 }, actionVisual: { texture: 'legion_crossbowman_action' } },
  guardian: { name: '重盾兵', mark: '盾', hp: 180, damage: 9, armor: 6, range: 65, cooldown: 1.3, speed: 115, cost: 18, art: 'xiliang_shield', tint: 0xffffff, perk: 'Lv3 护甲额外+5', walkVisual: { texture: 'legion_guardian_walk', scale: 0.728429721, groundY: .875 } },
  rider: { name: '轻骑兵', mark: '骑', hp: 95, damage: 16.9, armor: 2, range: 90, cooldown: 1.5, speed: 215, cost: 22, art: 'xiliang_cavalry', tint: 0xffffff, perk: 'Lv3 冲击三敌', walkVisual: { texture: 'legion_rider_walk', scale: 0.936170213, groundY: .875 } },
  halberdier: { name: '精锐戟兵', mark: '戟', hp: 105, damage: 15.6, armor: 3, range: 100, cooldown: 1.35, speed: 140, cost: 24, art: 'xiliang_elite', tint: 0xffffff, actionVisual: {texture:'legion_halberdier_action'}, perk: 'Lv3 扩大范围+25%', walkVisual: { texture: 'legion_halberdier_walk', scale: 0.779661017, groundY: .875 } },
  medic: { name: '军医', mark: '医', hp: 55, damage: 8, armor: 0, range: 150, cooldown: 2, speed: 145, cost: 20, art: 'zhuge', tint: 0xffffff, perk: 'Lv3 同时治疗三人', walkVisual: { texture: 'legion_medic_walk', scale: 0.72, groundY: .875 }, actionVisual: { texture: 'legion_medic_action' } },
};
export const TROOP_KINDS = Object.keys(TROOPS) as TroopKind[];
export const ORDERS: Record<Order, string> = { guard: '护阵', sortie: '出击' };
/**
 * 战斗左上的部曲状态行（11-21 用户试玩「1-1 看不到自己军粮」）：资源和状态数字尽量显示，没开放的操作按钮才藏——
 * 随军粮从 1-1 起就写（打怪、拆营帐会掉）；部曲开放（squad，1-2）后才加「兵力 / 阵亡」。
 */
export function legionStatusText(food: number, count: number, dead: number, squad: boolean): string {
  return squad ? `钱币 ${food} · 兵力 ${count}${dead ? ` · 阵亡 ${dead}` : ''}` : `钱币 ${food}`; // 战斗 HUD 直接写「钱币 N」（2026-11-21 军粮改钱币）
}
export const LEGION = { startingFood: 0, waveFood: 0, trainCost: [0, 40, 80], squadSize: 12, nearStep: .1, farStep: .5 } as const;

export const INITIAL_TROOPS:readonly TroopKind[]=['swordsman','spearman','archer'];
/**
 * 战地免费招兵每波人数，按章节档位 0–4（第一到第五章；攻城与第三章同档）。2026-11-16 平衡（用户批准）：原来每波 1 人、每关 3 波，场上平均不到 1 个兵。
 * 两个招兵入口的定位（总制作人第一章试玩 11-21 问「战斗支援只给 2 个、行营一次十几个」）：
 * - 战斗支援 = 补员：免费补一小队（本表的人数，每关 chapter.recruitWaves 那几波各一次），战斗中顶上缺口；
 * - 行营招兵 = 主要兵源：随军粮按人招，不限次数，在编越多越贵（每名在编 +20%，Legion.recruitCost）。
 * 两处说明文字都按这个口径写（行营招兵页、部曲玩法引子）。
 */
export const FREE_RECRUIT_BY_TIER: readonly number[] = [2, 3, 3, 4, 4];

/** Living soldiers, including starting reinforcements and reserves. */
/** Compatibility helper; barracks upgrades no longer restrict army size. */
export function armyCapacity(_level: number): number { return Infinity; }

/**
 * 首领对部曲（2026-11-16 用户要求：首领能快速清理小兵，不至于被小兵围死）。只影响打士兵，打主将不变。
 * contactMul：首领横扫伤害倍率——每秒打到身边 sweepReach 像素内的所有士兵（长枪 / 弓兵不贴身也躲不开）；skillMul：首领招式（范围 / 冲锋 / 箭雨等）打士兵的倍率。
 */
export const BOSS_VS_TROOPS = { contactMul: 3, skillMul: 2, sweepReach: 60 } as const;
/**
 * 首领打我方士兵 / 随从再收一层（2026-11-17 用户：「我感觉boss杀我方小兵太快了」；主管理定初值）：只影响首领打兵，打主将、普通敌人打兵都不变。
 * mul：在上面的 contactMul / skillMul 之后再乘（横扫 3 × 0.4 = 1.2，招式 2 × 0.4 = 0.8）；
 * killCapPerCast：同一招（同一帧结算）最多打死几个兵，其余留 1 血；immuneMs：挨首领一下后多久内不再吃首领伤害（防持续伤害连跳）。
 */
export const BOSS_VS_ALLY = { mul: .4, killCapPerCast: 3, immuneMs: 500 } as const;
/** 首领冲锋撞兵（BossMoveset 的 charge 招）：每兵每次冲锋一下，扣约 hpFrac 最大生命（满血的普通兵扛得住一冲），推开 knock 像素。初值，交平衡会话。 */
export const BOSS_CHARGE = { hpFrac: .5, knock: 26 } as const;
/**
 * 护阵收回（2026-11-17 用户：「我按了出击武将出去去打，但是我按护阵，随从一下子就回来了，回来太快了，移速太快了」）：
 * 出击 → 护阵后，部曲士兵（Legion）与随行武将（FollowerSquad）都按自己的行走速度 × speedMul 转身跑回阵位（播行走帧、面朝阵位），
 * 正在出手的先打完再走；回到阵位 doneDist 以内恢复原来的紧贴跟随。
 * 兜底：收回超过 fallbackMs 仍离阵位超过 farPx（约 1.5 屏）或 stuckMs 内没再靠近 progressPx，直接归位。
 * enterDist：随行停止追击时离阵位超过这个距离才进入收回状态（贴身跟随时的小偏差不算）。初值，交平衡会话。
 */
export const RECALL = { speedMul: 1.2, enterDist: 60, doneDist: 18, fallbackMs: 4000, farPx: 1400, stuckMs: 1200, progressPx: 12 } as const;
/**
 * 招兵价随在场兵数浮动（用户要求：兵越多越贵、越少越便宜）：每人 = 基础价 ×（a + b·n + c·n²）。
 * 0 人半价；10 人约 2.4 倍、20 人约 4.1 倍、33 人约 9.8 倍（原为 1 + 0.2n）。
 */
export const RECRUIT_PRICE = { a: .5, b: .15, c: .004 } as const;
