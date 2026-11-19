import type { TerrainConfig } from './terrain';

/**
 * 各关战斗地图按剧情定场地（用户 2026-11-18「根据剧情玩法，战斗地图也要符合，看情况可以设定限制地图，不一定需要无限大，适当场景互动」；
 * 设计见共享笔记 stage-maps-design.md）。键 = 篇章.第几关（GameScene.hardKey() + '.' + hardStage()），坐标以开局点为原点。
 * 没配的关保持原来的无限大场地。数值是初值，交平衡会话。
 *
 * 边：每边用一种天然边——
 *  cliff 山崖（地形层山崖，挡人）/ forest 密林（地形层树林）/ river 大河（地形层河，河对岸是边）/
 *  palisade 营栅（势力营具营栅一排，营门处留口立辕门）/ wall 城墙或关墙（攻城城墙图集）。
 * 关口（gates）：场外刷的兵改从这里进场（离主将最远的那个）；营门、桥头、山口。
 */
/** existing：本关原有的关墙 / 城墙 / 河（ARC_FORTS、SishuiPass、地形层已画好、已挡人），这边只管守边、不另画。 */
export type EdgeKind = 'cliff' | 'forest' | 'river' | 'palisade' | 'wall' | 'existing';
export type StageMapKind = 'arena' | 'corridor' | 'ford';
export interface Pt { x: number; y: number }
export interface StageMapDef {
  kind: StageMapKind;
  /** 场内（主将 / 随行 / 敌兵能到的范围）。 */
  bounds: { left: number; right: number; top: number; bottom: number };
  edges: { n: EdgeKind; s: EdgeKind; w: EdgeKind; e: EdgeKind };
  /** 每条边上留的口（沿边的坐标，宽 = gateWidth）：营门 / 山口 / 桥头。 */
  openings?: Partial<Record<'n' | 's' | 'w' | 'e', number[]>>;
  /** 刷兵关口（场内一点）。 */
  gates: Pt[];
  /** 营栅 / 城墙用哪一套图（势力营具编号，见 sceneLooks FACTION_PROPS）。 */
  faction?: number;
  /** 林、崖的树种 / 种子。 */
  forest?: 'broad' | 'pine' | 'bamboo' | 'jungle' | 'willow' | 'cypress' | 'poplar' | 'dead';
  /** 本关场景互动（见 systems/StageArena）。 */
  interactions?: Array<
    | { kind: 'bridge'; x: number; y: number; hp: number; killRadius: number }
    | { kind: 'campfire'; tents: Pt[]; lit: number[]; spreadMs: number; spreadRange: number; radius: number; damage: number; tickMs: number }
    | { kind: 'logs'; fromY: number; toY: number; everyMs: number; firstMs: number; warnMs: number; count: number; width: number; speed: number; damage: number; enemyDamage: number }
  >;
}

/** 边带厚度：场外看得见的那条天然边（镜头最多停到这里）。 */
export const ARENA = { edgeBand: 300, gateWidth: 260, minSpawnDist: 520, gateJitter: 90 } as const;

export const STAGE_MAPS: Record<string, StageMapDef> = {
  // 5-1 长坂突围：虎豹骑追袭——南北追击通道；北边长坂河，长坂桥是北面唯一来路（可砍断）；东西山崖；南边山口是追兵来路
  'chibi.1': {
    kind: 'corridor', bounds: { left: -1150, right: 1150, top: -560, bottom: 2300 },
    edges: { n: 'river', s: 'cliff', w: 'cliff', e: 'cliff' }, openings: { s: [0] },
    gates: [{ x: 0, y: -520 }, { x: 0, y: 2240 }, { x: -1080, y: 1500 }, { x: 1080, y: 1500 }],
    forest: 'pine',
    interactions: [{ kind: 'bridge', x: 0, y: -610, hp: 900, killRadius: 260 }],
  },
  // 3-2 宛城夜袭：张绣夜袭曹营——封闭的曹营，营栅四面四门（南门是曹营正门；张绣兵从北、东、西三门进）；营帐着火、火在营帐间蔓延
  'qunxiong.2': {
    kind: 'arena', bounds: { left: -1500, right: 1500, top: -1200, bottom: 1200 },
    edges: { n: 'palisade', s: 'palisade', w: 'palisade', e: 'palisade' }, openings: { n: [0], s: [0], w: [0], e: [0] },
    gates: [{ x: 0, y: -1150 }, { x: -1450, y: 0 }, { x: 1450, y: 0 }], faction: 3,
    interactions: [{ kind: 'campfire', tents: [{ x: -900, y: -650 }, { x: -520, y: -760 }, { x: 560, y: -720 }, { x: 960, y: -560 }, { x: -980, y: 520 }, { x: -560, y: 760 }, { x: 600, y: 740 }, { x: 1000, y: 520 }],
      lit: [0, 3], spreadMs: 9000, spreadRange: 520, radius: 95, damage: 9, tickMs: 500 }],
  },
  // 4-3 乌巢焚粮：夜袭袁军粮营——封闭粮营，袁军营栅，四处营门（援军从门进）；粮仓 / 火油桶（现有）
  'guandu.3': {
    kind: 'arena', bounds: { left: -1600, right: 1600, top: -1300, bottom: 1300 },
    edges: { n: 'palisade', s: 'palisade', w: 'palisade', e: 'palisade' }, openings: { n: [0], s: [0], w: [0], e: [0] },
    gates: [{ x: 0, y: -1250 }, { x: 0, y: 1250 }, { x: -1550, y: 0 }, { x: 1550, y: 0 }], faction: 2,
  },
  // 8-1 阳平关：关前谷地——北端是本关原有的阳平关关墙（ARC_FORTS pass：关门 = 张郃出关的来路，关上守军推滚木），东西山崖，南端我军营栅
  'hanzhong.1': {
    kind: 'corridor', bounds: { left: -1300, right: 1300, top: -500, bottom: 1500 },
    edges: { n: 'existing', s: 'palisade', w: 'cliff', e: 'cliff' }, openings: { s: [0] },
    gates: [{ x: 0, y: -460 }, { x: -1240, y: 200 }, { x: 1240, y: 200 }], faction: 5, forest: 'cypress',
    interactions: [{ kind: 'logs', fromY: -520, toY: 1500, everyMs: 9000, firstMs: 8000, warnMs: 1300, count: 2, width: 110, speed: 560, damage: 20, enemyDamage: 240 }],
  },
};

export function stageMapFor(arc: string, stage: number): StageMapDef | null { return STAGE_MAPS[arc + '.' + stage] ?? null; }

/**
 * 有边场地的地形层部分：山崖 / 密林 / 大河画在边界外的边带里（地形层负责画和挡人）。营栅 / 城墙由 StageArena 自己摆。
 * 合进原来的地形配置（原有的河 / 树林 / 自动树都保留）。
 */
export function arenaTerrain(def: StageMapDef): TerrainConfig {
  const b = def.bounds, T = ARENA.edgeBand, G = ARENA.gateWidth, out: TerrainConfig = { cliffs: [], woods: [], rivers: [] };
  /** 一条边按开口切成几段 [a0, a1]（沿边坐标）。 */
  const pieces = (from: number, to: number, holes: number[] = []) => {
    const cut = [...holes].sort((x, y) => x - y), res: Array<[number, number]> = []; let a = from;
    for (const h of cut) { if (h - G / 2 > a) res.push([a, h - G / 2]); a = h + G / 2; }
    if (to > a) res.push([a, to]); return res;
  };
  const side = (dir: 'n' | 's' | 'w' | 'e') => {
    const k = def.edges[dir], horiz = dir === 'n' || dir === 's', holes = def.openings?.[dir];
    const from = horiz ? b.left - T : b.top - T, to = horiz ? b.right + T : b.bottom + T;
    const line = dir === 'n' ? b.top - T / 2 : dir === 's' ? b.bottom + T / 2 : dir === 'w' ? b.left - T / 2 : b.right + T / 2;
    for (const [a0, a1] of pieces(from, to, holes)) {
      const mid = (a0 + a1) / 2, len = a1 - a0;
      if (k === 'cliff') out.cliffs!.push(horiz ? { x: mid, y: line, w: len, h: T } : { x: line, y: mid, w: T, h: len });
      if (k === 'forest') out.woods!.push(horiz ? { x: mid, y: line, rx: len / 2, ry: T / 2, count: Math.round(len / 70), seed: Math.round(mid) & 255, kind: def.forest ?? 'pine' } : { x: line, y: mid, rx: T / 2, ry: len / 2, count: Math.round(len / 70), seed: Math.round(mid) & 255, kind: def.forest ?? 'pine' });
    }
    if (k === 'river') { // 河在边外，整条（桥另在 interactions 里）
      const y = dir === 'n' ? b.top - 150 : dir === 's' ? b.bottom + 150 : 0, x = dir === 'w' ? b.left - 150 : dir === 'e' ? b.right + 150 : 0;
      out.rivers!.push(horiz ? { points: [{ x: from, y }, { x: to, y }], width: 220, bridges: [] } : { points: [{ x, y: from }, { x, y: to }], width: 220, bridges: [] });
    }
  };
  (['n', 's', 'w', 'e'] as const).forEach(side);
  return out;
}
