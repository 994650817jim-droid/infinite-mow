import type { TerrainConfig } from './terrain';

/**
 * 各关战斗地图按剧情定场地（用户 2026-11-18「根据剧情玩法，战斗地图也要符合，看情况可以设定限制地图，不一定需要无限大，适当场景互动」；
 * 设计见共享笔记 stage-maps-design.md）。键 = 篇章.第几关（GameScene.hardKey() + '.' + hardStage()），坐标以开局点为原点。
 * 没配的关保持原来的无限大场地。数值是初值，交平衡会话。
 *
 * 边：每边用一种天然边——
 *  cliff 山崖（地形层山崖，挡人）/ forest 密林（地形层树林）/ river 大河（地形层河，河对岸是边）/
 *  palisade 营栅（势力营具营栅一排，营门处留口立辕门）/ wall 城墙或关墙（攻城城墙图集）/ houses 街坊民房（攻城街巷图集，一排房背对场内）/
 *  fire 火墙（手绘地火序列帧一圈；配 firering 互动时随时间往里收）。
 * 关口（gates）：场外刷的兵改从这里进场（离主将最远的那个）；营门、桥头、山口。
 */
/** existing：本关原有的关墙 / 城墙 / 河（ARC_FORTS、SishuiPass、地形层已画好、已挡人），这边只管守边、不另画。 */
export type EdgeKind = 'cliff' | 'forest' | 'river' | 'palisade' | 'wall' | 'houses' | 'fire' | 'existing';
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
  /** 边带厚度（默认 ARENA.edgeBand）：边外要看见远景（如 4-1 白马城墙）时加宽。 */
  band?: number;
  /** 边外远景：一道城墙（攻城城墙图集，带城门、两端墩台），y = 墙脚。 */
  backdropWallY?: number;
  /** 河边（river）上的桥 / 浮桥：沿边的坐标。 */
  riverBridges?: number[];
  /** 街坊边（houses）：几成房子着火（0~1）。 */
  housesBurning?: number;
  /** 林、崖的树种 / 种子。 */
  forest?: 'broad' | 'pine' | 'bamboo' | 'jungle' | 'willow' | 'cypress' | 'poplar' | 'dead';
  /** 本关场景互动（见 systems/StageArena）。 */
  interactions?: Array<
    | { kind: 'bridge'; x: number; y: number; hp: number; killRadius: number }
    | { kind: 'campfire'; tents: Pt[]; lit: number[]; spreadMs: number; spreadRange: number; radius: number; damage: number; tickMs: number }
    | { kind: 'logs'; fromY: number; toY: number; everyMs: number; firstMs: number; warnMs: number; count: number; width: number; speed: number; damage: number; enemyDamage: number;
        /** 滚的方向：y 关上往南滚（滚木，默认）；x 从两侧山坡横着滚过谷地（滚石） */ axis?: 'y' | 'x' }
    /** 火墙收圈（火烧连营）：四面的火墙从 startMs 起、durationMs 内往里收到 shrinkTo 倍；贴着火墙站会被烧（敌我都烧）。 */
    | { kind: 'firering'; shrinkTo: number; startMs: number; durationMs: number; tickMs: number; burn: number; damage: number; playerDamage: number }
    /** 火油车（盘蛇谷）：任何一击点燃，引信后在谷里烧出一道横贯的火带（火攻：藤甲 3 倍并引燃）。 */
    | { kind: 'firecarts'; carts: Pt[]; fuseMs: number; band: number; burnMs: number; tickMs: number; damage: number; playerDamage: number }
    /** 灌木伏兵（荥阳）：主将走近一丛灌木，伏兵杀出（每丛一次）。 */
    | { kind: 'bushes'; spots: Pt[]; range: number; count: number; warnMs: number }
    /** 房檐伏兵（长安街坊）：定时从主将附近两侧房檐跳下几人。 */
    | { kind: 'roofs'; everyMs: number; firstMs: number; count: number; warnMs: number }
  >;
}

/** 边带厚度：场外看得见的那条天然边（镜头最多停到这里）。 */
export const ARENA = { edgeBand: 300, gateWidth: 260, minSpawnDist: 520, gateJitter: 90,
  /** 营帐（200px 图，脚底在图下缘）挡人的帐底椭圆：圆心在脚底往上 up，半轴 rx × ry（11-19 防穿模） */
  tentFoot: { up: 30, rx: 78, ry: 34 } } as const;

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
  // —— 第二批 ——
  // 11-2 藤甲兵（盘蛇谷）：南北谷道（两侧是本关原有的山崖），南北两端谷口；谷里四辆火油车——砍一下点燃，火带横贯山谷，藤甲兵遇火三倍伤害并引燃
  'nanzheng.2': {
    kind: 'corridor', bounds: { left: -600, right: 600, top: -1700, bottom: 1700 },
    edges: { n: 'cliff', s: 'cliff', w: 'existing', e: 'existing' }, openings: { n: [0], s: [0] },
    gates: [{ x: 0, y: -1650 }, { x: 0, y: 1650 }], forest: 'jungle',
    interactions: [{ kind: 'firecarts', carts: [{ x: -300, y: -950 }, { x: 320, y: -280 }, { x: -320, y: 420 }, { x: 300, y: 1050 }], fuseMs: 800, band: 150, burnMs: 9000, tickMs: 500, damage: 30, playerDamage: 6 }],
  },
  // 4-1 白马解围：渡口——北边是本关原有的袁军围城营栅（SishuiPass，颜良从辕门杀出），营后远处是白马城墙；南边黄河（浮桥 = 我军渡河来路），东西林带
  'guandu.1': {
    kind: 'ford', bounds: { left: -1200, right: 1200, top: -520, bottom: 1300 }, band: 420, backdropWallY: -780,
    edges: { n: 'existing', s: 'river', w: 'existing', e: 'existing' }, riverBridges: [0], // 东西两侧是围城营栅两端原有的林带 / 封口（SishuiPass）
    gates: [{ x: -1150, y: -200 }, { x: 1150, y: -200 }, { x: -1150, y: 700 }, { x: 1150, y: 700 }], forest: 'poplar',
  },
  // 2-2 荥阳：林中伏击——四面密林，东北、西南两处林道口出兵；林中灌木丛藏伏兵（走近才杀出）；四角伏兵营帐（现有）
  'hulao.2': {
    kind: 'arena', bounds: { left: -1600, right: 1600, top: -1400, bottom: 1400 },
    edges: { n: 'forest', s: 'forest', w: 'forest', e: 'forest' }, openings: { n: [700], s: [-700] },
    gates: [{ x: 700, y: -1350 }, { x: -700, y: 1350 }, { x: -1550, y: -900 }, { x: 1550, y: 900 }], forest: 'broad',
    interactions: [{ kind: 'bushes', spots: [{ x: -1100, y: -900 }, { x: 1050, y: -1000 }, { x: -1150, y: 950 }, { x: 1100, y: 900 }, { x: 0, y: -1050 }, { x: 0, y: 1050 }], range: 300, count: 4, warnMs: 700 }],
  },
  // 3-1 长安突围：城外街坊——北边是本关原有的长安城墙（李傕从城门杀出），东西两排街坊民房（部分着火），南边街口是出城的路；房檐伏兵
  'qunxiong.1': {
    kind: 'corridor', bounds: { left: -900, right: 900, top: -520, bottom: 2400 },
    edges: { n: 'existing', s: 'houses', w: 'houses', e: 'houses' }, openings: { s: [0] }, housesBurning: .3,
    gates: [{ x: 0, y: -470 }, { x: 0, y: 2350 }, { x: -860, y: 900 }, { x: 860, y: 900 }],
    interactions: [{ kind: 'roofs', everyMs: 10000, firstMs: 7000, count: 3, warnMs: 700 }],
  },
  // —— 第三批 ——
  // 10-3 火烧连营：四面是烧起来的连营 / 林火，火墙一分钟后开始往里收（两分钟收到六成），贴着火墙会被烧
  'yiling.3': {
    kind: 'arena', bounds: { left: -1800, right: 1800, top: -1500, bottom: 1500 },
    edges: { n: 'fire', s: 'fire', w: 'fire', e: 'fire' },
    gates: [{ x: 0, y: -1400 }, { x: 0, y: 1400 }, { x: -1700, y: 0 }, { x: 1700, y: 0 }],
    interactions: [{ kind: 'firering', shrinkTo: .6, startMs: 60000, durationMs: 120000, tickMs: 500, burn: 70, damage: 25, playerDamage: 7 }],
  },
  // 8-3 汉水：渡口——北边是本关原有的汉水（新河岸套件，两座桥 = 曹军渡河来路），东西林带，南边我军营栅
  'hanzhong.3': {
    kind: 'ford', bounds: { left: -1500, right: 1500, top: -570, bottom: 1200 },
    edges: { n: 'existing', s: 'palisade', w: 'forest', e: 'forest' }, openings: { s: [0] },
    gates: [{ x: -1040, y: -540 }, { x: 1040, y: -540 }, { x: -1450, y: 300 }, { x: 1450, y: 300 }], faction: 5, forest: 'pine',
  },
  // 11-1 泸水：渡泸——泸水从场地中间横过（本关原有，两座桥），四面丛林，北面林口（蛮兵来路）、南面林口（我军来路）；毒泉、火盆照旧
  'nanzheng.1': {
    kind: 'ford', bounds: { left: -1500, right: 1500, top: -1250, bottom: 1100 },
    edges: { n: 'forest', s: 'forest', w: 'forest', e: 'forest' }, openings: { n: [0], s: [0] },
    gates: [{ x: 0, y: -1200 }, { x: -1450, y: -700 }, { x: 1450, y: -700 }, { x: -1450, y: 600 }], forest: 'jungle',
  },
  // 12-3 五丈原：渡口——南边是本关原有的渭水（新河岸套件），北边魏军营栅（北营门出兵），东西稀疏林带
  'beifa.3': {
    kind: 'ford', bounds: { left: -1600, right: 1600, top: -1300, bottom: 600 },
    edges: { n: 'palisade', s: 'existing', w: 'forest', e: 'forest' }, openings: { n: [0] },
    gates: [{ x: 0, y: -1250 }, { x: -1550, y: -500 }, { x: 1550, y: -500 }], faction: 3, forest: 'dead',
  },
  // 1-2 下曲阳：张宝法坛营——北边法坛营（本关原有）后面是密林，东西密林，南边河滩（我军渡河来路，一座桥）；火油桶、黄巾军旗、营帐照旧
  'huangjin.2': {
    kind: 'arena', bounds: { left: -1500, right: 1500, top: -1150, bottom: 1100 },
    edges: { n: 'forest', s: 'river', w: 'forest', e: 'forest' }, riverBridges: [0],
    gates: [{ x: -1100, y: -1100 }, { x: 1100, y: -1100 }, { x: -1450, y: 200 }, { x: 1450, y: 200 }], forest: 'poplar',
  },
  // 6-2 零陵武陵：山谷——东西山崖（本关原有的山崖 + 补齐，留原有的两处山口），南北山口；山越从两侧山坡推滚石横扫谷地
  'jingnan.2': {
    kind: 'corridor', bounds: { left: -880, right: 880, top: -1300, bottom: 1300 },
    edges: { n: 'cliff', s: 'cliff', w: 'cliff', e: 'cliff' }, openings: { n: [0], s: [0], w: [350], e: [-450] },
    gates: [{ x: 0, y: -1250 }, { x: 0, y: 1250 }, { x: -840, y: 350 }, { x: 840, y: -450 }], forest: 'bamboo',
    interactions: [{ kind: 'logs', axis: 'x', fromY: -880, toY: 880, everyMs: 8000, firstMs: 7000, warnMs: 1200, count: 2, width: 100, speed: 520, damage: 18, enemyDamage: 220 }],
  },
  // —— 第四批（最后一批）——
  // 3-3 寿春讨逆：北边寿春城墙（攻城城墙图集，城门居中）、东西柳林、南边林带；会战场地保持宽
  'qunxiong.3': {
    kind: 'arena', bounds: { left: -1800, right: 1800, top: -900, bottom: 1400 },
    edges: { n: 'wall', s: 'forest', w: 'forest', e: 'forest' }, openings: { n: [0] },
    gates: [{ x: 0, y: -860 }, { x: -1750, y: -300 }, { x: 1750, y: -300 }, { x: -1750, y: 800 }, { x: 1750, y: 800 }], forest: 'willow',
  },
  // 5-2 赤壁鏖兵：江岸——北边是本关原有的大江（新河岸，两座浮桥 = 曹军来路，北岸曹营水寨），东西芦苇柳林，南边孙刘联军营栅
  'chibi.2': {
    kind: 'ford', bounds: { left: -2000, right: 2000, top: -500, bottom: 1100 },
    edges: { n: 'existing', s: 'palisade', w: 'forest', e: 'forest' }, openings: { s: [0] },
    gates: [{ x: -780, y: -470 }, { x: 936, y: -470 }, { x: -1950, y: 300 }, { x: 1950, y: 300 }], faction: 4, forest: 'willow',
  },
  // 5-3 江陵夺城、6-3 长沙会战、10-1 猇亭：本关原有的城池 / 关隘 / 营寨（SishuiPass）已四面封好
  'chibi.3': {
    kind: 'arena', bounds: { left: -1220, right: 1220, top: -520, bottom: 2250 },
    edges: { n: 'existing', s: 'existing', w: 'existing', e: 'existing' },
    gates: [{ x: 0, y: -480 }, { x: -1180, y: -200 }, { x: 1180, y: -200 }, { x: -1180, y: 900 }, { x: 1180, y: 900 }], // 曹仁出城门；两侧林带
  },
  'jingnan.3': {
    kind: 'arena', bounds: { left: -1220, right: 1220, top: -520, bottom: 2250 },
    edges: { n: 'existing', s: 'existing', w: 'existing', e: 'existing' },
    gates: [{ x: 0, y: -480 }, { x: -1180, y: -200 }, { x: 1180, y: -200 }, { x: -1180, y: 900 }, { x: 1180, y: 900 }], // 韩玄出城门；两侧林带
  },
  'yiling.1': {
    kind: 'arena', bounds: { left: -1220, right: 1220, top: -520, bottom: 2250 },
    edges: { n: 'existing', s: 'existing', w: 'existing', e: 'existing' },
    gates: [{ x: 0, y: -480 }, { x: -1180, y: -200 }, { x: 1180, y: -200 }, { x: -1180, y: 900 }, { x: 1180, y: 900 }], // 孙桓出寨门；两侧林带
  },
  // 7-1 葭萌关、7-2 落凤坡：蜀道两侧本来就是山坡（MountainPass），这里把两端收口——葭萌关北端是关墙关门，落凤坡北端山口；南端山口
  'shu.1': {
    kind: 'corridor', bounds: { left: -300, right: 300, top: -4150, bottom: 2150 },
    edges: { n: 'wall', s: 'cliff', w: 'existing', e: 'existing' }, openings: { n: [0], s: [0] },
    gates: [{ x: 0, y: -4100 }, { x: 0, y: 2100 }],
  },
  'shu.2': {
    kind: 'corridor', bounds: { left: -260, right: 260, top: -4150, bottom: 2150 },
    edges: { n: 'cliff', s: 'cliff', w: 'existing', e: 'existing' }, openings: { n: [0], s: [0] },
    gates: [{ x: 0, y: -4100 }, { x: 0, y: 2100 }],
  },
  // 12-1 街亭：当道——南边是本关原有的南山（崖 + 补齐），东西山崖各留一处山口（张郃从北口、两侧山口来断汲道），北边山口
  'beifa.1': {
    kind: 'corridor', bounds: { left: -1300, right: 1300, top: -1300, bottom: 740 },
    edges: { n: 'cliff', s: 'cliff', w: 'cliff', e: 'cliff' }, openings: { n: [0], w: [-400], e: [-400] },
    gates: [{ x: 0, y: -1250 }, { x: -1250, y: -400 }, { x: 1250, y: -400 }], forest: 'cypress',
  },
};

export function stageMapFor(arc: string, stage: number): StageMapDef | null { return STAGE_MAPS[arc + '.' + stage] ?? null; }

/**
 * 有边场地的地形层部分：山崖 / 密林 / 大河画在边界外的边带里（地形层负责画和挡人）。营栅 / 城墙由 StageArena 自己摆。
 * 合进原来的地形配置（原有的河 / 树林 / 自动树都保留）。
 */
export function arenaTerrain(def: StageMapDef): TerrainConfig {
  const b = def.bounds, T = def.band ?? ARENA.edgeBand, G = ARENA.gateWidth, out: TerrainConfig = { cliffs: [], woods: [], rivers: [] };
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
      const bridges = (def.riverBridges ?? []).map(a => ({ at: (a - from) / (to - from), width: 150 }));
      out.rivers!.push(horiz ? { points: [{ x: from, y }, { x: to, y }], width: 220, bridges } : { points: [{ x, y: from }, { x, y: to }], width: 220, bridges });
    }
  };
  (['n', 's', 'w', 'e'] as const).forEach(side);
  return out;
}
