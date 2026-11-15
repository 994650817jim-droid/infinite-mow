/**
 * 天下地图城池、势力与时代（WORLD_MAP_PLAN.md · W1）。
 * 坐标为 strategy-map.webp（1536×1024）上原画聚落的位置，名称按大致方位分配，并非精确历史地理。
 */
export type CityTier = 'large' | 'medium' | 'small';
export type FactionId = 'player' | 'han' | 'dongzhuo' | 'yuanshao' | 'caocao' | 'yuanshu' | 'gongsun' | 'taoqian' | 'liubiao' | 'sun' | 'mateng' | 'liuzhang' | 'zhanglu' | 'yellow';
export interface CityDef {id: string; name: string; tier: CityTier; x: number; y: number; region: string;}
export interface FactionDef {name: string; color: number; css: string;}
export interface EraDef {id: 1 | 2 | 3; year: number; name: string; summary: string; owners: Record<string, FactionId>;}

export const MAP_W = 1536, MAP_H = 1024;
export const TIER_NAME: Record<CityTier, string> = {large: '大城', medium: '中城', small: '小城'};

export const CITIES: readonly CityDef[] = [
  // 大城（州治）
  {id: 'ye', name: '邺城', tier: 'large', x: 720, y: 262, region: '冀州'},
  {id: 'luoyang', name: '洛阳', tier: 'large', x: 660, y: 412, region: '司隶'},
  {id: 'changan', name: '长安', tier: 'large', x: 305, y: 413, region: '关中'},
  {id: 'xiangyang', name: '襄阳', tier: 'large', x: 455, y: 662, region: '荆州'},
  {id: 'shouchun', name: '寿春', tier: 'large', x: 1022, y: 638, region: '扬州'},
  {id: 'xiapi', name: '下邳', tier: 'large', x: 1232, y: 552, region: '徐州'},
  // 中城（郡治）
  {id: 'jinyang', name: '晋阳', tier: 'medium', x: 420, y: 166, region: '并州'},
  {id: 'nanpi', name: '南皮', tier: 'medium', x: 885, y: 133, region: '冀州'},
  {id: 'ji', name: '蓟城', tier: 'medium', x: 1186, y: 33, region: '幽州'},
  {id: 'chenliu', name: '陈留', tier: 'medium', x: 942, y: 396, region: '兖州'},
  {id: 'xuchang', name: '许昌', tier: 'medium', x: 806, y: 486, region: '豫州'},
  {id: 'linzi', name: '临淄', tier: 'medium', x: 1162, y: 343, region: '青州'},
  {id: 'beihai', name: '北海', tier: 'medium', x: 1335, y: 443, region: '青州'},
  {id: 'wancheng', name: '宛城', tier: 'medium', x: 605, y: 573, region: '南阳'},
  {id: 'runan', name: '汝南', tier: 'medium', x: 896, y: 573, region: '豫州'},
  {id: 'jiangxia', name: '江夏', tier: 'medium', x: 970, y: 808, region: '荆州'},
  {id: 'lujiang', name: '庐江', tier: 'medium', x: 1265, y: 708, region: '扬州'},
  {id: 'wujun', name: '吴郡', tier: 'medium', x: 1415, y: 653, region: '扬州'},
  // 小城（县、关隘）
  {id: 'shangdang', name: '上党', tier: 'small', x: 527, y: 95, region: '并州'},
  {id: 'pingyuan', name: '平原', tier: 'small', x: 1098, y: 78, region: '青州'},
  {id: 'tianshui', name: '天水', tier: 'small', x: 205, y: 288, region: '凉州'},
  {id: 'hanzhong', name: '汉中', tier: 'small', x: 135, y: 488, region: '益州'},
  {id: 'hangu', name: '函谷关', tier: 'small', x: 520, y: 260, region: '司隶'},
  {id: 'hongnong', name: '弘农', tier: 'small', x: 470, y: 363, region: '司隶'},
  {id: 'sishui', name: '汜水关', tier: 'small', x: 795, y: 333, region: '司隶'},
  {id: 'baima', name: '白马', tier: 'small', x: 975, y: 243, region: '兖州'},
  {id: 'guandu', name: '官渡', tier: 'small', x: 946, y: 496, region: '兖州'},
  {id: 'wuchao', name: '乌巢', tier: 'small', x: 1050, y: 445, region: '兖州'},
  {id: 'xinye', name: '新野', tier: 'small', x: 408, y: 530, region: '南阳'},
  {id: 'donglai', name: '东莱', tier: 'small', x: 1320, y: 233, region: '青州'},
];

/** 义军营寨（玩家起点，不可被攻占）。与 WorldNodes 中 home 节点同位置。 */
export const HOME = {id: 'home', x: 799, y: 573} as const;

export const FACTIONS: Record<FactionId, FactionDef> = {
  player: {name: '义军', color: 0x3f9a5a, css: '#5cc07a'},
  han: {name: '地方豪强', color: 0x8a8f7a, css: '#b4b8a6'},
  yellow: {name: '黄巾余党', color: 0xc9b23a, css: '#e3cf5c'},
  dongzhuo: {name: '董卓', color: 0x8c2a2a, css: '#d06060'},
  yuanshao: {name: '袁绍', color: 0xd4a017, css: '#f0c040'},
  caocao: {name: '曹操', color: 0x2f4f7f, css: '#7fa4dc'},
  yuanshu: {name: '袁术', color: 0x7a4a9a, css: '#b98ad8'},
  gongsun: {name: '公孙瓒', color: 0xc8c8be, css: '#e6e6dc'},
  taoqian: {name: '陶谦', color: 0x4a8a6a, css: '#7cc49c'},
  liubiao: {name: '刘表', color: 0x2a8a8a, css: '#62c4c4'},
  sun: {name: '孙氏', color: 0xc8502a, css: '#f08a5c'},
  mateng: {name: '马腾', color: 0xa07a3a, css: '#d2a866'},
  liuzhang: {name: '刘焉 / 刘璋', color: 0x6a7a3a, css: '#a6b866'},
  zhanglu: {name: '张鲁', color: 0x5a6a8a, css: '#9aaad0'},
};

/** 三个时代的城池归属（按史实概括，玩家已占城池另行覆盖）。 */
export const ERAS: readonly EraDef[] = [
  {id: 1, year: 191, name: '诸侯并起', summary: '董卓挟天子西入长安，关东诸侯各据州郡。',
    owners: {ye: 'yuanshao', nanpi: 'yuanshao', jinyang: 'han', shangdang: 'han', ji: 'gongsun', pingyuan: 'gongsun',
      luoyang: 'dongzhuo', changan: 'dongzhuo', hangu: 'dongzhuo', hongnong: 'dongzhuo', sishui: 'dongzhuo', tianshui: 'mateng', hanzhong: 'liuzhang',
      chenliu: 'caocao', baima: 'caocao', guandu: 'han', wuchao: 'han', xuchang: 'han', runan: 'yuanshu', wancheng: 'yuanshu',
      linzi: 'yellow', beihai: 'han', donglai: 'yellow', xiapi: 'taoqian', shouchun: 'han',
      xiangyang: 'liubiao', xinye: 'liubiao', jiangxia: 'liubiao', lujiang: 'han', wujun: 'han'}},
  {id: 2, year: 198, name: '群雄割据', summary: '曹操迎天子都许，袁绍雄踞河北；李傕、张绣、袁术相继败亡。',
    owners: {ye: 'yuanshao', nanpi: 'yuanshao', jinyang: 'yuanshao', shangdang: 'yuanshao', ji: 'gongsun', pingyuan: 'yuanshao',
      luoyang: 'caocao', changan: 'caocao', hangu: 'caocao', hongnong: 'caocao', sishui: 'caocao', tianshui: 'mateng', hanzhong: 'zhanglu',
      chenliu: 'caocao', baima: 'caocao', guandu: 'caocao', wuchao: 'yuanshao', xuchang: 'caocao', runan: 'han', wancheng: 'caocao',
      linzi: 'yuanshao', beihai: 'yuanshao', donglai: 'yuanshao', xiapi: 'caocao', shouchun: 'caocao',
      xiangyang: 'liubiao', xinye: 'liubiao', jiangxia: 'liubiao', lujiang: 'sun', wujun: 'sun'}},
  {id: 3, year: 201, name: '官渡之后', summary: '袁绍官渡大败，曹操威震北方；孙权继立江东，刘表坐拥荆州。',
    owners: {ye: 'yuanshao', nanpi: 'yuanshao', jinyang: 'yuanshao', shangdang: 'yuanshao', ji: 'yuanshao', pingyuan: 'yuanshao',
      luoyang: 'caocao', changan: 'caocao', hangu: 'caocao', hongnong: 'caocao', sishui: 'caocao', tianshui: 'mateng', hanzhong: 'zhanglu',
      chenliu: 'caocao', baima: 'caocao', guandu: 'caocao', wuchao: 'caocao', xuchang: 'caocao', runan: 'caocao', wancheng: 'caocao',
      linzi: 'yuanshao', beihai: 'yuanshao', donglai: 'yuanshao', xiapi: 'caocao', shouchun: 'caocao',
      xiangyang: 'liubiao', xinye: 'liubiao', jiangxia: 'liubiao', lujiang: 'sun', wujun: 'sun'}},
];

/** 当前时代：通关讨董卓 → 一；通关群雄割据 → 二；通关官渡 → 三。 */
export function eraIndexFor(progress: {hulaoCleared: boolean; warlordStages: number; guanduStages: number}): 1 | 2 | 3 {
  if (progress.guanduStages >= 3) return 3;
  if (progress.warlordStages >= 3) return 2;
  return 1;
}
export function eraDef(id: 1 | 2 | 3): EraDef { return ERAS[id - 1]; }

/** 城池实际归属：玩家已占优先，其余按时代表。 */
export function cityOwner(cityId: string, era: 1 | 2 | 3, owned: readonly string[]): FactionId {
  if (owned.includes(cityId)) return 'player';
  return eraDef(era).owners[cityId] ?? 'han';
}

/** 相邻关系：按原画道路距离连线（距离阈值 + 每城至少连最近两城），营寨连其最近的三城。 */
const LINK_RANGE = 235;
function buildLinks(): Map<string, Set<string>> {
  const nodes = [...CITIES.map(c => ({id: c.id, x: c.x, y: c.y})), {id: HOME.id, x: HOME.x, y: HOME.y}];
  const links = new Map(nodes.map(n => [n.id, new Set<string>()]));
  const link = (a: string, b: string) => { links.get(a)!.add(b); links.get(b)!.add(a); };
  for (const a of nodes) {
    const near = nodes.filter(b => b !== a).map(b => ({b, d: Math.hypot(a.x - b.x, a.y - b.y)})).sort((p, q) => p.d - q.d);
    if (a.id === HOME.id) { near.slice(0, 3).forEach(n => link(a.id, n.b.id)); continue; }
    near.filter(n => n.b.id !== HOME.id && n.d <= LINK_RANGE).forEach(n => link(a.id, n.b.id));
    near.filter(n => n.b.id !== HOME.id).slice(0, 2).forEach(n => link(a.id, n.b.id));
  }
  return links;
}
export const CITY_LINKS: ReadonlyMap<string, ReadonlySet<string>> = buildLinks();
export function cityById(id: string): CityDef | undefined { return CITIES.find(c => c.id === id); }
/** 可攻打：非玩家城池，且与营寨或玩家城池相邻。 */
export function cityAttackable(cityId: string, owned: readonly string[]): boolean {
  if (owned.includes(cityId)) return false;
  for (const n of CITY_LINKS.get(cityId) ?? []) if (n === HOME.id || owned.includes(n)) return true;
  return false;
}

/** W3 城池产出：每完成一次出征结算（胜利或坚持 60 秒以上）时，按已占城池发放。 */
export const CITY_INCOME: Record<CityTier, {merits: number; provisions: number}> = {
  small: {merits: 0, provisions: 10},
  medium: {merits: 5, provisions: 20},
  large: {merits: 10, provisions: 40},
};
/** W3 大城特产：占领期间永久生效的小加成。 */
export interface Specialty {title: string; text: string; damage?: number; maxHp?: number; reserveSlots?: number; attributePoints?: number; provisions?: number; reinforcements?: number;}
export const SPECIALTIES: Readonly<Record<string, Specialty>> = {
  luoyang: {title: '天子旧都', text: '本命武器伤害 +3%', damage: .03},
  changan: {title: '关中要塞', text: '最大生命 +8%', maxHp: .08},
  ye: {title: '河北兵源', text: '出征可多带 1 名后备兵', reserveSlots: 1},
  xiangyang: {title: '荆襄书院', text: '每次出征开局获得 1 点属性点', attributePoints: 1},
  shouchun: {title: '淮南粮仓', text: '战后粮草收益 +10%', provisions: .1},
  xiapi: {title: '徐州精兵', text: '开局增援 +1 名士兵', reinforcements: 1},
};
/** 已占城池的产出合计与生效特产。 */
export function territorySummary(owned: readonly string[]): {merits: number; provisions: number; specialties: Array<{city: CityDef; specialty: Specialty}>; counts: Record<CityTier, number>} {
  let merits = 0, provisions = 0; const specialties: Array<{city: CityDef; specialty: Specialty}> = [], counts = {large: 0, medium: 0, small: 0};
  for (const id of owned) { const c = cityById(id); if (!c) continue; counts[c.tier]++; merits += CITY_INCOME[c.tier].merits; provisions += CITY_INCOME[c.tier].provisions; const sp = SPECIALTIES[id]; if (sp) specialties.push({city: c, specialty: sp}); }
  return {merits, provisions, specialties, counts};
}

/** W4：会主动来犯的势力（地方豪强、黄巾余党不反攻）。 */
export const MAJOR_FACTIONS: readonly FactionId[] = ['dongzhuo', 'yuanshao', 'caocao', 'yuanshu', 'gongsun', 'taoqian', 'liubiao', 'sun', 'mateng', 'liuzhang', 'zhanglu'];
/** 某时代各势力的城池数（不含玩家已占）。 */
export function factionStrength(era: 1 | 2 | 3, owned: readonly string[]): Map<FactionId, number> {
  const m = new Map<FactionId, number>();
  for (const c of CITIES) { const f = cityOwner(c.id, era, owned); if (f !== 'player') m.set(f, (m.get(f) ?? 0) + 1); }
  return m;
}
/** 可能来犯某座玩家城池的势力：相邻城池中最强的大势力；没有则 null。 */
export function cityAttacker(cityId: string, era: 1 | 2 | 3, owned: readonly string[]): FactionId | null {
  const power = factionStrength(era, owned); let best: FactionId | null = null;
  for (const n of CITY_LINKS.get(cityId) ?? []) {
    if (n === HOME.id) continue; const f = cityOwner(n, era, owned);
    if (!MAJOR_FACTIONS.includes(f)) continue;
    if (!best || (power.get(f) ?? 0) > (power.get(best) ?? 0) || ((power.get(f) ?? 0) === (power.get(best) ?? 0) && MAJOR_FACTIONS.indexOf(f) < MAJOR_FACTIONS.indexOf(best))) best = f;
  }
  return best;
}
/** 时代更替：非玩家城池的易主列表与覆灭势力。 */
export function eraChanges(from: 1 | 2 | 3, to: 1 | 2 | 3, owned: readonly string[]): {changes: Array<{city: string; from: FactionId; to: FactionId}>; fallen: FactionId[]} {
  const changes: Array<{city: string; from: FactionId; to: FactionId}> = [];
  for (const c of CITIES) { if (owned.includes(c.id)) continue; const a = cityOwner(c.id, from, []), b = cityOwner(c.id, to, []); if (a !== b) changes.push({city: c.id, from: a, to: b}); }
  const before = factionStrength(from, owned), after = factionStrength(to, owned);
  const fallen = [...before.keys()].filter(f => MAJOR_FACTIONS.includes(f) && !after.has(f));
  return {changes, fallen};
}
