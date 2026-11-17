/**
 * 军营等级与兵种解锁（用户 2026-11-17 选定「6 级方案」）：
 *   Lv1 刀盾兵 / 长枪兵 / 弓箭兵 → Lv2 连弩兵 → Lv3 重盾兵 → Lv4 军医（县城）→ Lv5 轻骑兵（县城）→ Lv6 精锐戟兵（州府）。
 * 营寨招募（后备兵）和战斗中的支援招兵都只出现已解锁的兵种。开局增援 = 军营等级 − 1，最多 2 人。
 * 价格经「平衡与数值」会话 2026-11-17 复核：一场胜利约 210–310 军粮，Lv2 一关可升，Lv4–6 受县城 / 州府门槛，落在第二、三章。
 */
import type { TroopKind } from './legion';

export const BARRACKS_MAX = 6;
/** 每个兵种需要的军营等级。 */
export const TROOP_UNLOCK: Record<TroopKind, number> = {
  swordsman: 1, spearman: 1, archer: 1, crossbowman: 2, guardian: 3, medic: 4, rider: 5, halberdier: 6,
};
/** 军营升级价（Lv1→2 … Lv5→6，军粮）。平衡会话 2026-11-17 已复核，维持原值。 */
export const BARRACKS_UPGRADE = [120, 240, 400, 600, 900] as const;
/** 升到该等级需要的营寨规模（主帐等级）：Lv4、Lv5 需县城，Lv6 需州府；其余不限。 */
export const BARRACKS_HALL: Record<number, number> = { 4: 2, 5: 2, 6: 3 };
/** 出征开局增援人数上限。 */
export const BARRACKS_REINFORCE_MAX = 2;

export const troopUnlocked = (kind: TroopKind, barracksLevel: number): boolean => barracksLevel >= (TROOP_UNLOCK[kind] ?? 1);
/** 某军营等级新解锁的兵种（Lv1 是基础三种）。 */
export const troopsAtLevel = (level: number): TroopKind[] => (Object.keys(TROOP_UNLOCK) as TroopKind[]).filter(k => TROOP_UNLOCK[k] === level);
export const barracksReinforcements = (level: number): number => Math.max(0, Math.min(BARRACKS_REINFORCE_MAX, level - 1));
