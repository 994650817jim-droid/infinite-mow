import type { EnemyDef } from './enemies';
import type { EnemyKind } from '../types';

/**
 * 城门没破之前，墙内（城里、关后）只刷远程（用户 2026-11-20「还有没打破城门之前 墙内只会刷远程，检查所有关」；盘点见共享笔记 siege-spawn-audit.md）：
 * - 刷兵点落在关闭的城墙后面：近战镜像到墙外（我方一侧）照常刷；远程留在墙内，但挪到墙后能射到的一条带里（不刷进墙体、不远到够不着）。
 * - 墙内远程同时最多 rangedCap 个，再多也镜像到墙外（免得城头箭雨太密）。
 * - 城门破了以后不再限制（城里的近战从城门涌出）。首领不在此列（首领由各关自己的出场逻辑管）。
 */
export const GATE_SPAWN = {
  /** 墙内远程同时存活上限。 */
  rangedCap: 10,
  /** 墙内远程站位带：墙线往里 near–far 像素——站在城头（墙体碰撞在墙线往里 10–70；城墙图约 160 高，脚落在 120–170 时上半身露出垛口，看得到在放箭）。 */
  band: { near: 120, far: 170 },
  /** 镜像到墙外时离墙线至少多远。 */
  outsideMin: 90,
} as const;

/** 算远程的新兵种特性（data/enemyRoster TraitDef.kind）：投石、火罐、火箭、齐射、狙射、连弩、毒箭、标枪、飞网、骑射、滚木炮车等。 */
export const RANGED_TRAITS: ReadonlySet<string> = new Set(['lobber', 'firepot', 'firearrow', 'volley', 'sniper', 'burst', 'stance', 'poison', 'javelin', 'net', 'horsearcher', 'roller']);

/** 这次要刷的是不是远程（底层兵种 archer、远程特性兵、黄巾术士 / 雷法）。 */
export function isRangedSpawn(kind: EnemyKind, def?: Partial<EnemyDef> | null): boolean {
  if (kind === 'archer') return true;
  const t = (def as { trait?: { kind?: string } } | null | undefined)?.trait?.kind;
  if (t && RANGED_TRAITS.has(t)) return true;
  const b = def?.behavior as string | undefined;
  return b === 'shaman' || b === 'thunder';
}
