import { cityById } from './WorldCities';
import { STAGE_POINTS, type TimelineChapterId } from './ChapterTimeline';

/**
 * 天下地图 V1 的关卡点落位（2026-11-19 用户「这里我感觉有点怪」：关卡点和城池脱节、标题与城名重复）。
 * STAGE_POINTS 是 v2 征途图拉开间距后的坐标（史事发生地），V1 有城池图标，同名的关要落在城上。
 * - city：关卡发生在这座城 → 关卡点就在城上（场景再把印抬到城郭正上方），关卡名不再写城名，只写「2-1」这样的编号；
 * - point：没有城的战场（广宗、赤壁、定军山…）沿用 STAGE_POINTS；个别挪到正确地理位置（荥阳在汜水关以东）。
 * 坐标与城池都是 strategy-map 像素（1536×1024）。对位表见共享笔记 world-map-v1-align.md。
 */
type Anchor = { city: string } | { x: number; y: number };
const ANCHORS: Partial<Record<TimelineChapterId, ReadonlyArray<Anchor | null>>> = {
  hulao: [{ city: 'sishui' }, { x: 842, y: 352 }, { city: 'luoyang' }],          // 汜水关 · 荥阳（汜水关以东、陈留以西的战场）· 火烧洛阳
  qunxiong: [{ city: 'changan' }, { city: 'wancheng' }, { city: 'shouchun' }],    // 长安突围 · 宛城夜袭 · 寿春讨逆
  guandu: [{ city: 'baima' }, null, { city: 'wuchao' }],                          // 白马解围 · （延津渡口，沿用）· 乌巢焚粮
  shu: [null, null, { city: 'chengdu' }],                                          // 葭萌关 · 落凤坡 ·（成都）
};

export interface StageAnchor { x: number; y: number; /** 落在这座城上（城名，用于去重标题）；战场为空。 */ city?: string; cityId?: string }

/** 第 i 关（0 起）在 V1 地图上的落点。 */
export function stageAnchor(id: TimelineChapterId, i: number): StageAnchor | null {
  const pt = STAGE_POINTS[id]?.[i]; if (!pt) return null;
  const a = ANCHORS[id]?.[i];
  if (a && 'city' in a) { const c = cityById(a.city); if (c) return { x: c.x, y: c.y, city: c.name, cityId: c.id }; }
  if (a && 'x' in a) return { x: a.x, y: a.y };
  return { x: pt.x, y: pt.y };
}
