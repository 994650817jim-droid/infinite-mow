/**
 * 天下地图 · 军情事件（纯数据 / 纯函数，不读写存档）。
 * 讨董之后（诸侯分立）每过一季，地图上刷出 1–2 个事件点，最多同时 3 个：
 *   名将悬赏 bounty —— 敌方势力部将率游骑出没，击败必得紫色兵装（25% 橙色），持续两季；
 *   流寇袭扰 bandit —— 我方城池附近流寇作乱，两波短战；本季内不平定，该城本季产出减半；
 *   商队护送 escort —— 商队自营寨前往某城，护车撑到抵达（约 90 秒）得军粮；车毁则商队被劫、事件消失。
 * 季度序号 seasonIndex = 年 × 4 + 季；事件在 expires 这一季之内有效。
 */
import {CITIES, CITY_LINKS, HOME, MAJOR_FACTIONS, cityById, cityOwner, type CityTier, type FactionId} from './WorldCities';
import type {ItemQuality} from '../data/items';

export type IntelKind = 'bounty' | 'bandit' | 'escort';
export interface IntelEvent {id: string; kind: IntelKind; city: string; faction: FactionId; general?: string; expires: number;}
export interface IntelReward {merits: number; provisions: number; money: number; item?: {quality: ItemQuality; orangeChance: number}}

export const INTEL_INFO: Record<IntelKind, {name: string; glyph: string; color: number; css: string; seasons: number; brief: string}> = {
  bounty: {name: '名将悬赏', glyph: '赏', color: 0xb8442c, css: '#ff9a72', seasons: 2, brief: '敌将率游骑出没，击败必得紫色以上兵装'},
  bandit: {name: '流寇袭扰', glyph: '寇', color: 0xc9a032, css: '#f2cf6a', seasons: 1, brief: '流寇侵扰我方城池；本季不平定，该城本季产出减半'},
  escort: {name: '商队护送', glyph: '商', color: 0x3f8f6a, css: '#8fe0b4', seasons: 1, brief: '护送商车抵达城池得军粮；车毁则商队被劫'},
};

/** 悬赏名将：按势力（史事人物；与可玩武将、章节首领不重复）。 */
export const BOUNTY_GENERALS: Partial<Record<FactionId, readonly string[]>> = {
  dongzhuo: ['郭汜', '樊稠', '牛辅', '胡轸'],
  yuanshao: ['张郃', '高览', '鞠义', '蒋奇'],
  caocao: ['许褚', '典韦', '夏侯惇', '乐进'],
  yuanshu: ['纪灵', '桥蕤', '雷薄', '陈兰'],
  gongsun: ['严纲', '田楷', '单经'],
  taoqian: ['曹豹', '臧霸', '笮融'],
  liubiao: ['黄祖', '文聘', '王威'],
  sun: ['程普', '黄盖', '太史慈', '韩当'],
  mateng: ['庞德', '阎行', '马岱'],
  liuzhang: ['张任', '严颜', '冷苞'],
  zhanglu: ['杨任', '杨昂', '张卫'],
};

export const seasonIndex = (t: {year: number; season: number}): number => t.year * 4 + t.season;

/** 奖励：流寇与商队按城池档位；悬赏固定，另给兵装。 */
export function intelReward(e: IntelEvent): IntelReward {
  const tier: CityTier = cityById(e.city)?.tier ?? 'small', k = tier === 'large' ? 2 : tier === 'medium' ? 1.5 : 1;
  if (e.kind === 'bounty') return {merits: 60, provisions: 80, money: 0, item: {quality: 'purple', orangeChance: .25}};
  if (e.kind === 'bandit') return {merits: Math.round(20 * k), provisions: Math.round(40 * k), money: 0};
  return {merits: 15, provisions: 0, money: Math.round(80 * k)};
}

/** 事件标题，如「悬赏 · 许褚」「流寇 · 许昌」「商队 · 往汝南」。 */
export function intelTitle(e: IntelEvent): string {
  const c = cityById(e.city)?.name ?? '';
  return e.kind === 'bounty' ? `悬赏 · ${e.general ?? '敌将'}` : e.kind === 'bandit' ? `流寇 · ${c}` : `商队 · 往${c}`;
}

/** 地图详情 / 出征面板的说明。 */
export function intelBrief(e: IntelEvent, faction: string): string {
  const c = cityById(e.city)?.name ?? '';
  if (e.kind === 'bounty') return `${faction}部将${e.general}率游骑出没于${c}一带。清剿三波亲兵，击败${e.general}。`;
  if (e.kind === 'bandit') return `流寇袭扰${c}城郊：清剿两波流寇，击败寇首。本季不平定，${c}本季产出减半。`;
  return `商队自义军营寨启程，载货前往${c}。守在商车附近它才前进，敌兵贴近会劫掠车辆；护送到达即成功。`;
}

const pick = <T>(list: readonly T[], random: () => number): T => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

/** 离玩家领地（营寨 + 我方城池）不超过 2 步的城池，用于悬赏名将出没地。 */
function nearPlayer(owned: readonly string[]): Set<string> {
  const near = new Set<string>(), frontier = [HOME.id, ...owned];
  for (let step = 0; step < 2; step++) {
    const next: string[] = [];
    for (const id of frontier) for (const n of CITY_LINKS.get(id) ?? []) if (n !== HOME.id && !near.has(n)) { near.add(n); next.push(n); }
    frontier.splice(0, frontier.length, ...next);
  }
  return near;
}

/**
 * 新一季刷出的事件：已有 3 个时不刷；先刷 1 个，再 50% 刷第 2 个。
 * 同一城池同时只有一个事件；流寇只出现在未告急的我方城池；商队去我方城池（没有则营寨相邻城池）。
 */
export function rollIntel(ctx: {era: 1 | 2 | 3; owned: readonly string[]; alerts: readonly string[]; existing: readonly IntelEvent[]; season: number; seq: number; random: () => number; noBandit?: boolean; bountyOpen?: (cityId: string) => boolean}): IntelEvent[] {
  const out: IntelEvent[] = [], all = () => [...ctx.existing, ...out], busy = (id: string) => all().some(e => e.city === id);
  let seq = ctx.seq;
  const want = Math.min(3 - ctx.existing.length, 1 + (ctx.random() < .5 ? 1 : 0));
  for (let i = 0; i < want; i++) {
    const banditCities = ctx.owned.filter(id => !ctx.alerts.includes(id) && !busy(id));
    const escortCities = (ctx.owned.length ? ctx.owned : [...(CITY_LINKS.get(HOME.id) ?? [])]).filter(id => !busy(id) && !!cityById(id));
    const near = nearPlayer(ctx.owned);
    const hostile = CITIES.filter(c => !busy(c.id) && !ctx.owned.includes(c.id) && (ctx.bountyOpen?.(c.id) ?? true) && MAJOR_FACTIONS.includes(cityOwner(c.id, ctx.era, ctx.owned)));
    const bountyCities = hostile.filter(c => near.has(c.id)).length ? hostile.filter(c => near.has(c.id)) : hostile;
    const kinds: Array<[IntelKind, number]> = [['bounty', bountyCities.length ? .4 : 0], ['bandit', !ctx.noBandit && banditCities.length && !all().some(e => e.kind === 'bandit') ? .35 : 0], ['escort', escortCities.length && !all().some(e => e.kind === 'escort') ? .25 : 0]];
    const total = kinds.reduce((n, [, w]) => n + w, 0); if (total <= 0) break;
    let r = ctx.random() * total, kind: IntelKind = 'bounty';
    for (const [k, w] of kinds) { if (w <= 0) continue; kind = k; if ((r -= w) < 0) break; }
    const id = 'intel-' + (++seq).toString(36), expires = ctx.season + INTEL_INFO[kind].seasons - 1;
    if (kind === 'bounty') {
      const c = pick(bountyCities, ctx.random), faction = cityOwner(c.id, ctx.era, ctx.owned), roster = BOUNTY_GENERALS[faction] ?? ['敌将'];
      const used = all().map(e => e.general), free = roster.filter(g => !used.includes(g));
      out.push({id, kind, city: c.id, faction, general: pick(free.length ? free : roster, ctx.random), expires});
    } else if (kind === 'bandit') out.push({id, kind, city: pick(banditCities, ctx.random), faction: 'yellow', expires});
    else out.push({id, kind, city: pick(escortCities, ctx.random), faction: 'han', expires});
  }
  return out;
}

/** 存档读入：过滤无效项。 */
export function parseIntel(v: unknown): IntelEvent[] {
  if (!Array.isArray(v)) return [];
  const kinds: IntelKind[] = ['bounty', 'bandit', 'escort'];
  return v.filter((e: Partial<IntelEvent>) => e && typeof e.id === 'string' && e.id.length <= 32 && kinds.includes(e.kind as IntelKind) && typeof e.city === 'string' && !!cityById(e.city) && typeof e.faction === 'string' && typeof e.expires === 'number' && Number.isFinite(e.expires))
    .slice(0, 6).map((e: IntelEvent) => ({id: e.id, kind: e.kind, city: e.city, faction: e.faction, expires: Math.floor(e.expires), ...(typeof e.general === 'string' ? {general: e.general.slice(0, 8)} : {})}));
}
