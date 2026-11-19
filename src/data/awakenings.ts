import type {BuildTag} from './builds';
/**
 * 觉醒（2026-11-19 流派重做）：旧的 12 个觉醒（单系 4 件 / 双系 2+2）已删除。
 * 新觉醒 = 某派到 6 势（data/schools.ts SCHOOLS[x].tiers[6]），每关最多触发 1～2 次、触发后有冷却——第 2 期接（AwakeningCombat）。
 * 第 1 期：这里先返回空表，构筑总览 / 增益栏不再显示旧觉醒。
 */
export interface AwakeningDef { id: string; name: string; tags: readonly BuildTag[]; icon: string; desc: string }
export const AWAKENINGS: readonly AwakeningDef[] = [];
export function activeAwakenings(_tags: Record<BuildTag, number>): AwakeningDef[] { return []; }
export function awakeningProgress(_tags: Record<BuildTag, number>): string { return ''; }
