/**
 * 攻城 · 城内段布局（攻城城内段方案 siege-city-proposal.md，用户 2026-11-18「全按建议」）：
 * 破门之后不再是一条直街两个据点，而是像一座城——主街通向府衙，横街把城分成几个街区，街区里民居、商铺、粮仓、兵营、市集，城墙内侧有马道、角楼，街口有拒马。
 *  - 小城（县城）：丁字街，城门进来的主街直通县衙，半路一条往西的横街；要点 3，占 2 处开县衙；
 *  - 中城（郡城）：十字街，北端府衙；要点 4，占 3 处开府衙；
 *  - 大城（州治）：主街 + 两条横街；城墙内侧马道、两座角楼；要点 6，占 4 处开内城。
 * 坐标：城内段在城外段北面（外城墙线 y -580 以北），北端内城墙 y -1640 接府衙（府衙场地 y -2320 ~ -1640）；x 以主街为 0。
 * 主街（竖向，宽 220）由攻城场景整条铺好，这里的 streets 只列横街。
 * 房子是实心的：碰撞框盖住整栋房的画面（主将 / 随行固定画在物件之上，框只盖墙脚的话会「走上屋顶」）；街道、巷子、院子能走。
 * 要点建筑门朝南，要点圈画在门前的街上。排内房子相连（缝 < 60，人过不去），排与排之间的巷子宽 ≥ 140（窄于此主将会贴着两边屋檐走，像踩在房上）。数值（要点数量、开门门槛）交平衡会话。
 */
type SiegeTier = 'small' | 'medium' | 'large';

export type CityBuildingKind = 'house' | 'house2' | 'shop' | 'granary' | 'barracks' | 'well' | 'market' | 'goods' | 'armory' | 'yard' | 'ramp' | 'tower' | 'barricade' | 'cheval' | 'logs' | 'stones';
export interface CityBuilding { kind: CityBuildingKind; x: number; y: number; size: number; flip?: boolean; /** 默认实心；false = 纯布景（滚木 / 礌石堆） */ solid?: boolean }
export type CityPointKind = 'granary' | 'armory' | 'barracks' | 'tower' | 'market';
export interface CityPoint { kind: CityPointKind; name: string; x: number; y: number; radius: number; /** 要点建筑（脚底中心、显示边长） */ b: { x: number; y: number; size: number; flip?: boolean } }
export interface CityStreet { x: number; y: number; w: number; h: number; road: 'stone' | 'dirt' }
export interface CityLayout {
  arena: { left: number; right: number; top: number; bottom: number };
  start: { x: number; y: number };
  /** 通往府衙的内城门：半宽、门线。 */ gateHalf: number; innerGateY: number;
  /** 横街（主街由场景铺）。 */ streets: CityStreet[];
  buildings: CityBuilding[];
  points: CityPoint[];
  /** 占够几处要点府衙开门。 */ need: number;
  barrels: Array<{ x: number; y: number }>;
  /** 敌兵从这些街口 / 巷口刷出（前方与两侧；身后是我军来路，不刷）。 */ spawns: Array<{ x: number; y: number }>;
  /** 屋顶伏兵跳下的位置（街边房檐下）。 */ roofs: Array<{ x: number; y: number }>;
}

const H = (x: number, y: number, kind: CityBuildingKind = 'house', size = 210, flip = false): CityBuilding => ({ kind, x, y, size, flip });
const P = (kind: CityPointKind, name: string, bx: number, by: number, size = 250, radius = 100, dy = 90): CityPoint => ({ kind, name, x: bx, y: by + dy, radius, b: { x: bx, y: by, size } });

export const SIEGE_CITY: Record<SiegeTier, CityLayout> = {
  // 县城（和城外段同宽，两侧城墙接着城外段的侧墙）：主街直通县衙，半路往西一条横街（丁字）。粮仓在横街北、市集在城门内西侧（摊棚 + 货担）、兵营在主街东。房子成排相连，排与排之间留巷子
  small: {
    arena: { left: -640, right: 640, top: -1640, bottom: -620 },
    start: { x: 0, y: -880 }, gateHalf: 190, innerGateY: -1640,
    streets: [{ x: -640, y: -1335, w: 530, h: 170, road: 'dirt' }],
    buildings: [
      H(-250, -900, 'house', 230), H(-225, -1350, 'house2', 220),
      H(255, -860), H(500, -860, 'house', 230, true),
      H(250, -1190, 'shop'),
      H(255, -1500, 'house', 210, true), H(500, -1500, 'house2', 230),
      { kind: 'goods', x: -560, y: -690, size: 140 }, { kind: 'well', x: -250, y: -1080, size: 100 }, { kind: 'barricade', x: 60, y: -1460, size: 110 }, { kind: 'barricade', x: -330, y: -1185, size: 110 },
    ],
    points: [
      P('granary', '粮仓', -480, -1345),
      P('barracks', '兵营', 510, -1180, 280),
      P('market', '市集', -490, -900, 240),
    ],
    need: 2,
    barrels: [{ x: -60, y: -980 }, { x: 70, y: -1200 }, { x: -330, y: -1250 }],
    spawns: [{ x: 0, y: -1560 }, { x: -600, y: -1250 }, { x: 600, y: -1060 }, { x: 400, y: -1420 }],
    roofs: [{ x: -80, y: -960 }, { x: 80, y: -960 }, { x: -80, y: -1420 }, { x: 80, y: -1300 }, { x: 80, y: -1560 }],
  },
  // 郡城：十字街（南北主街直通府衙，东西横街 y -1130）。南街区：粮仓、市集（摊棚 + 货担，要点圈在城墙内的顺城街上）；
  // 北街区前排临横街：武库（库房 + 兵器院）、兵营，后排民居
  medium: {
    arena: { left: -900, right: 900, top: -1640, bottom: -620 },
    start: { x: 0, y: -880 }, gateHalf: 200, innerGateY: -1640,
    streets: [{ x: -900, y: -1225, w: 1800, h: 190, road: 'stone' }],
    buildings: [
      H(-260, -880), H(-740, -880, 'house', 230), H(260, -880, 'house2', 220), H(740, -880, 'house', 230, true), { kind: 'goods', x: 800, y: -700, size: 170 },
      H(-260, -1240, 'shop'), { kind: 'yard', x: -820, y: -1240, size: 160 }, H(260, -1240), H(820, -1240, 'house', 170, true),
      H(-260, -1460, 'house2', 220), H(-590, -1460), H(-800, -1460, 'house', 180), H(260, -1460, 'house', 210, true), H(590, -1460, 'house2', 220), H(800, -1460, 'house', 180, true),
      { kind: 'well', x: -820, y: -720, size: 100 }, { kind: 'cheval', x: -330, y: -1180, size: 120 }, { kind: 'cheval', x: 330, y: -1080, size: 120 },
    ],
    points: [
      P('granary', '粮仓', -470, -880),
      P('market', '市集', 470, -880, 240),
      P('armory', '武库', -610, -1240),
      P('barracks', '兵营', 610, -1240),
    ],
    need: 3,
    barrels: [{ x: -70, y: -800 }, { x: 80, y: -1130 }, { x: -420, y: -1120 }, { x: 300, y: -750 }],
    spawns: [{ x: 0, y: -1560 }, { x: -820, y: -1130 }, { x: 820, y: -1130 }, { x: -425, y: -1520 }, { x: 425, y: -1520 }],
    roofs: [{ x: -80, y: -950 }, { x: 80, y: -950 }, { x: -80, y: -1300 }, { x: 80, y: -1300 }, { x: -80, y: -1520 }, { x: 80, y: -1520 }],
  },
  // 州治：主街 + 两条横街（y -930 石板 / -1310 土路）。城墙两角角楼，楼旁马道上城；中街区临第一横街：粮仓、兵营；北街区临第二横街：武库（库房 + 兵器院）、市集（摊棚 + 货担围出一片集市）
  large: {
    arena: { left: -1100, right: 1100, top: -1640, bottom: -620 },
    start: { x: 0, y: -880 }, gateHalf: 210, innerGateY: -1640,
    streets: [{ x: -1100, y: -1005, w: 2200, h: 150, road: 'stone' }, { x: -1100, y: -1385, w: 2200, h: 150, road: 'dirt' }],
    buildings: [
      // 城墙内侧：马道（高的一头靠着角楼）、滚木礌石堆
      { kind: 'ramp', x: -930, y: -645, size: 230, flip: true }, { kind: 'ramp', x: 930, y: -645, size: 230 },
      { kind: 'logs', x: -420, y: -660, size: 100, solid: false }, { kind: 'stones', x: 420, y: -660, size: 100, solid: false },
      // 南街区（城墙 ~ 第一横街）
      H(-250, -700, 'house', 200), H(250, -700, 'house', 200, true),
      // 中街区（两条横街之间）
      H(-260, -1015, 'shop'), H(-860, -1015, 'house2', 220), H(260, -1015), H(860, -1015, 'house2', 220),
      // 北街区（第二横街 ~ 内城）
      H(-260, -1395), { kind: 'yard', x: -570, y: -1395, size: 160 }, H(-975, -1395, 'house2', 220), H(260, -1395, 'house2', 220), { kind: 'goods', x: 520, y: -1390, size: 170 }, H(975, -1395),
      { kind: 'well', x: 180, y: -1300, size: 100 }, { kind: 'barricade', x: -330, y: -905, size: 110 }, { kind: 'cheval', x: 330, y: -1285, size: 120 },
    ],
    points: [
      P('granary', '粮仓', -610, -1015),
      P('barracks', '兵营', 610, -1015),
      P('armory', '武库', -760, -1395),
      P('market', '市集', 760, -1395, 240),
      // 角楼就是城墙转角的那座楼（马道靠着它），要点圈在马道北头的横街上
      { kind: 'tower', name: '西角楼', x: -930, y: -890, radius: 95, b: { x: -1100, y: -660, size: 240 } },
      { kind: 'tower', name: '东角楼', x: 930, y: -890, radius: 95, b: { x: 1100, y: -660, size: 240, flip: true } },
    ],
    need: 4,
    barrels: [{ x: -70, y: -800 }, { x: 80, y: -1150 }, { x: -420, y: -930 }, { x: 420, y: -1310 }],
    spawns: [{ x: 0, y: -1560 }, { x: -1020, y: -930 }, { x: 1020, y: -930 }, { x: -1020, y: -1310 }, { x: 1020, y: -1310 }, { x: -430, y: -1460 }, { x: 430, y: -1460 }],
    roofs: [{ x: -80, y: -760 }, { x: 80, y: -760 }, { x: -80, y: -1080 }, { x: 80, y: -1080 }, { x: -80, y: -1460 }, { x: 80, y: -1460 }],
  },
};

const BOX: Partial<Record<CityBuildingKind, [number, number]>> = {
  house: [.45, .68], house2: [.45, .86], shop: [.45, .74], granary: [.43, .8], barracks: [.45, .72], armory: [.44, .8], market: [.45, .62], yard: [.45, .5],
  tower: [.3, .88], ramp: [.44, .78], well: [.3, .5], barricade: [.42, .42], cheval: [.42, .42],
};
/** 建筑碰撞框：盖住整栋房的画面（两层楼更高）；角楼、马道、水井、拒马、兵器院按画面收窄；货担、滚木礌石堆是地上的布景，不挡。 */
export function cityBuildingBox(kind: CityBuildingKind, x: number, y: number, size: number): { left: number; right: number; top: number; bottom: number } | null {
  if (kind === 'logs' || kind === 'stones' || kind === 'goods') return null;
  // [半宽, 高]（显示边长的比例）：高 ≈ 画面里屋脊 / 楼顶到墙脚，留一点给主将脚底（主将固定画在物件之上，框比画面矮就会站到屋顶上）
  const [hw, h] = BOX[kind] ?? [.45, .68];
  return { left: x - size * hw, right: x + size * hw, top: y - size * h, bottom: y - 6 };
}

/** 图集格：街巷图集（siege_mid_street）0 民房 1 两层民房 2 店铺 3 粮仓 4 兵营 5 路障 6 屋脊 7 水井；瓮城套件 3 角楼 4 侧墙段 5 滚木 6 礌石；
 *  城内图集（siege_mid_city，美术会话 11-18 出图）0 市集摊棚 1 市集货担 2 武库库房 3 武库兵器院 4 马道斜坡 5 城内角楼 6 我方占领旗 7 拒马路障组。 */
export const CITY_ART: Record<CityBuildingKind, { sheet: 'street' | 'barb' | 'city'; frame: number; fb?: { sheet: 'street' | 'barb'; frame: number } }> = {
  house: { sheet: 'street', frame: 0 }, house2: { sheet: 'street', frame: 1 }, shop: { sheet: 'street', frame: 2 }, granary: { sheet: 'street', frame: 3 }, barracks: { sheet: 'street', frame: 4 },
  well: { sheet: 'street', frame: 7 }, barricade: { sheet: 'street', frame: 5 },
  // 城内图集缺图（没载到）时退回现成的街巷 / 瓮城图：市集 → 店铺、武库 → 兵营（翻转）、马道 → 瓮城侧墙段、角楼 → 瓮城角楼；货担没有替身，不画
  market: { sheet: 'city', frame: 0, fb: { sheet: 'street', frame: 2 } }, goods: { sheet: 'city', frame: 1 },
  armory: { sheet: 'city', frame: 2, fb: { sheet: 'street', frame: 4 } }, yard: { sheet: 'city', frame: 3, fb: { sheet: 'street', frame: 5 } },
  ramp: { sheet: 'city', frame: 4, fb: { sheet: 'barb', frame: 4 } }, tower: { sheet: 'city', frame: 5, fb: { sheet: 'barb', frame: 3 } },
  cheval: { sheet: 'city', frame: 7, fb: { sheet: 'street', frame: 5 } },
  logs: { sheet: 'barb', frame: 5 }, stones: { sheet: 'barb', frame: 6 },
};
/** 要点所在的建筑。 */
export const POINT_BUILDING: Record<CityPointKind, CityBuildingKind> = { granary: 'granary', armory: 'armory', barracks: 'barracks', tower: 'tower', market: 'market' };

/**
 * 要点作用与守点小队（攻城城内段第二步；初值，交平衡会话）：
 *  - squadRange：主将走到离要点多近，守点小队（小队长 + squad 名守兵）才从要点里杀出来；leaderMul：小队长活着时占领读条速度倍率；
 *  - 粮仓 granaryProvisions：结算军粮 +30%，granaryRefill：援军阶段守军补充 −30%（第三步接结算 / 限时）；
 *  - 武库 armoryDamage：我军伤害 ×1.08（且城内不再刷弓手）；兵营 barracksSkip：每占一座，城内刷兵少 25%；
 *  - 角楼 tower：大城没占的角楼往城里放箭雨（两座都在：everyMs[0] / zones[0]；剩一座：[1]）；市集 marketFood：立刻随军粮 +60。
 */
export const CITY_FX = {
  squadRange: 560, squad: 3, leaderMul: .5,
  granaryProvisions: .3, granaryRefill: .3, armoryDamage: 1.08, barracksSkip: .25, marketFood: 60,
  tower: { firstMs: 6000, everyMs: [6500, 10000], zones: [2, 1] },
} as const;
