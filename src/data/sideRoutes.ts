import type { ChapterDef } from './chapters';
import type { BossMovesetDef } from './bossMoves';
import type { Specialty } from '../world/WorldCities';

/**
 * 其他势力支线 P1（设计稿 共享笔记 other-factions-design.md，用户 2026-11-19「批准开工」）：
 * 主线打到某章后，天下地图上该势力亮起「讨伐令」，按关推进；终局打完该势力的城池并入我方领地，并给一项势力特产。
 * 各关首领都能劝降（data/surrender.ts 里的 '<支线>-<关>:<首领>' 键）；终局没劝降成功可在地图上「再战」，每次再战劝降把握 +15%（最多 90%）。
 * 第一批可玩武将（吕布、张辽、周瑜、太史慈、曹操）P2 才做：P1 劝降成功先进降将栏，并记下「已劝降」，P2 的解锁条件读它（systems/HeroUnlocks persuaded）。
 * 战斗复用对应时期的章节战场（第三章式三关框架 / 三英战吕布挑战关）；还没有专属形象的首领先借现有首领图（ART_V2_FILES 的 side_* 键）。
 * 数值都是初值，交平衡会话。
 */
export type SideRouteId = 'xiapi' | 'nanjun' | 'caowei';
export type SideStageKind = 'siege' | 'field' | 'final';
export interface SideBoss {
  id: string; name: string; title: string;
  /** 借用的首领 v2 图（assets/bosses-v2 下）与 v1 回退图。 */ v2: string; v1: string;
  /** 招式借谁的（BOSS_MOVES 的键）；改名后登记为 '<支线>.<id>'。 */ moves: string;
  /** 将来做成可玩武将（P2）。 */ playable?: boolean;
}
export interface SideStage {
  name: string; kind: SideStageKind; story: string;
  boss: SideBoss;
  /** 终局双首领的第二位。 */ partner?: SideBoss;
  /** 刷怪 / 首领招式组（第三章框架的关序号）与地貌。 */ behavior: 1 | 2 | 3; scenery: 1 | 2 | 3 | 4;
  /** 波次名（三波）。 */ waves: [string, string, string];
  /** 打下这一关就并入的城池（攻城关）。 */ city?: string;
  /** 交给另一个战斗场景（下邳终局白门楼走三英战吕布的吕布战）。 */ scene?: 'lubu';
}
export interface SideRouteDef {
  id: SideRouteId; name: string; faction: string; region: string;
  /** 天下地图上的讨伐令位置（归一化坐标）。 */ x: number; y: number;
  /** 开放：主线某篇章通关几关（WorldStore.arcStages）。 */ open: { arc: 'qunxiong' | 'chibi' | 'hanzhong'; stages: number; hint: string };
  /** 借哪一章的兵种与数值。 */ base: 'qunxiong' | 'chibi' | 'hanzhong';
  /** 敌兵外观借哪一章（江东借第十章吴军）。 */ look?: 'yiling';
  stages: readonly SideStage[];
  /** 终局通关后并入的城池（攻城关已并入的不重复）。 */ annex: readonly string[];
  specialty: Specialty;
  /** 打完后归附的「势力之主」（再战只为劝降他）。 */ lord: string;
  /** 场景营具势力（sceneLooks ARC_FACTIONS）：1 西凉 · 3 曹军 · 4 东吴。 */ props: number;
}

const B = (id: string, name: string, title: string, v2: string, v1: string, moves: string, playable = false): SideBoss => ({ id, name, title, v2: 'assets/bosses-v2/' + v2 + '.png', v1: 'assets/' + v1 + '.png', moves, playable });

export const SIDE_ROUTES: readonly SideRouteDef[] = [
  { id: 'xiapi', name: '吕布 · 下邳', faction: '吕布', region: '徐州', x: .785, y: .585, props: 1,
    open: { arc: 'qunxiong', stages: 3, hint: '第三章「群雄割据」平定后开放' }, base: 'qunxiong',
    stages: [
      { name: '小沛', kind: 'siege', city: undefined, behavior: 1, scenery: 1, waves: ['小沛城外', '并州狼骑', '曹性守城'], story: '吕布夺了徐州，屯兵小沛。先拔小沛，断其羽翼。',
        boss: B('caoxing', '曹性', '吕布部将', 'shu_yanghuai', 'phase23/lijue', 'yanghuai') },
      { name: '辕门射戟', kind: 'field', behavior: 2, scenery: 2, waves: ['辕门前营', '陷阵营压阵', '高顺出阵'], story: '吕布辕门射戟，营前列阵。陷阵营攻无不克，先破高顺。',
        boss: B('gaoshun', '高顺', '陷阵营', 'side_gaoshun', 'guandu/yanliang', 'zhuran') },
      { name: '下邳', kind: 'siege', city: 'xiapi', behavior: 3, scenery: 4, waves: ['下邳外郭', '泗水决堤', '张辽守城'], story: '围下邳，决泗水。张辽据城而守，城破在即。',
        boss: B('zhangliao', '张辽', '吕布骁将', 'side_zhangliao', 'phase23/zhangxiu', 'zhanghe', true) },
      { name: '白门楼', kind: 'final', scene: 'lubu', behavior: 1, scenery: 1, waves: ['白门楼下', '吕布亲军', '吕布出阵'], story: '下邳城破，吕布退守白门楼。飞将末路，劝降还是斩杀？',
        boss: B('lubu', '吕布', '飞将', 'third_lijue', 'phase23/lijue', 'lijue', true) },
    ],
    annex: ['xiapi'], specialty: { title: '并州狼骑', text: '本命武器伤害 +3%', damage: .03 }, lord: 'lubu' },
  { id: 'nanjun', name: '江东 · 南郡', faction: '江东', region: '荆州 · 江陵', x: .565, y: .735, props: 4,
    open: { arc: 'chibi', stages: 3, hint: '第五章「赤壁之战」平定后开放' }, base: 'chibi', look: 'yiling',
    stages: [
      { name: '江陵外围', kind: 'field', behavior: 2, scenery: 2, waves: ['江岸吴营', '水军跳帮', '程普出阵'], story: '赤壁之后，周瑜移兵来争南郡。江陵城外，吴军水军登岸。',
        boss: B('chengpu', '程普', '江东老将', 'yiling_sunhuan', 'chibi/caimao', 'sunhuan') },
      { name: '南郡', kind: 'final', behavior: 3, scenery: 3, waves: ['南郡城下', '江东精兵', '周瑜亲至'], story: '周瑜亲督诸军，太史慈为先锋。南郡一战，定荆州归属。',
        boss: B('zhouyu', '周瑜', '江东都督', 'yiling_luxun', 'chibi/caimao', 'lvmeng', true),
        partner: B('taishici', '太史慈', '东莱信义之将', 'yiling_zhuran', 'chibi/caochun', 'zhuran', true) },
    ],
    annex: [], specialty: { title: '江东水军', text: '战后粮草收益 +10%', provisions: .1 }, lord: 'zhouyu' },
  { id: 'caowei', name: '中原 · 曹魏', faction: '曹魏', region: '兖州 · 豫州', x: .585, y: .43, props: 3,
    open: { arc: 'hanzhong', stages: 3, hint: '第八章「汉中之战」平定后开放' }, base: 'hanzhong',
    stages: [
      { name: '陈留', kind: 'siege', city: 'chenliu', behavior: 1, scenery: 1, waves: ['陈留城外', '青州兵列阵', '李典守城'], story: '曹操起兵之地。先下陈留，动摇中原。',
        boss: B('lidian', '李典', '曹营儒将', 'third_zhangxiu', 'phase23/zhangxiu', 'zhangxiu') },
      { name: '宛城旧地', kind: 'field', behavior: 2, scenery: 2, waves: ['宛城旧营', '虎卫军', '许褚出阵'], story: '宛城旧地，虎卫军拦路。许褚赤膊来战。',
        boss: B('xuchu', '许褚', '虎痴', 'guandu_wenchou', 'guandu/wenchou', 'zhuran') },
      { name: '许昌', kind: 'siege', city: 'xuchang', behavior: 3, scenery: 4, waves: ['许昌外城', '虎豹骑巡城', '乐进守城'], story: '天子所在，许都门户。乐进先登，誓守许昌。',
        boss: B('yuejin', '乐进', '先登之将', 'third_lijue', 'phase23/lijue', 'lijue') },
      { name: '许都决战', kind: 'final', behavior: 1, scenery: 4, waves: ['许都城下', '虎豹骑出城', '曹操亲至'], story: '中原诸城尽下，曹操与夏侯惇出城决战。',
        boss: B('caocao', '曹操', '魏王', 'hanzhong_caocao', 'chibi/caoren', 'caocao', true),
        partner: B('xiahoudun', '夏侯惇', '独眼将军', 'hanzhong_xiahouyuan', 'guandu/wenchou', 'xiahouyuan') },
    ],
    annex: ['luoyang', 'baima', 'guandu', 'wuchao', 'runan', 'wancheng'], specialty: { title: '中原兵员', text: '出征可多带 1 名后备兵', reserveSlots: 1 }, lord: 'caocao' },
];

export function sideRoute(id: string | null | undefined): SideRouteDef | undefined { return SIDE_ROUTES.find(r => r.id === id); }
/** 支线战斗场景键（每条支线一个三关框架场景）、当前关的 registry 键；下邳白门楼走吕布战 SideLubuGameScene。 */
export const SIDE_SCENE_KEY = (id: SideRouteId): string => 'Side' + id[0].toUpperCase() + id.slice(1) + 'GameScene';
export const SIDE_STAGE_KEY = (id: SideRouteId): string => 'side_' + id + 'Stage';
export function sideSceneFor(id: SideRouteId, stage: number): string { return sideRoute(id)?.stages[stage - 1]?.scene === 'lubu' ? 'SideLubuGameScene' : SIDE_SCENE_KEY(id); }
/** 战斗场景里首领图的纹理键（ArtStyle.ART_V2_FILES 登记 side_<id>）。 */
export const sideTexture = (id: string): string => 'side_' + id;
/** 每关奖励（初值）：军粮按开放章节档位；终局多发。 */
export const SIDE_REWARD = {
  provisions: { xiapi: 120, nanjun: 180, caowei: 240 } as Record<SideRouteId, number>,
  finalMul: 2, replayMul: .35,
  /** 再战劝降：每次 +15%，最多 5 次（上限仍是 SURRENDER.cap 90%）。 */ retryAdd: .15, retryMax: 5,
} as const;

/** 借来的招式改成本人的名号：两阶段标题 / 小字、招式名（旧名 → 新名）。曹操用本人招式不改。 */
const SIDE_STYLE: Record<string, { p1: [string, string]; p2: [string, string]; moves: Record<string, string> }> = {
  caoxing: { p1: ['小沛守将', '暗箭伏射 · 城头滚石'], p2: ['困守小沛', '亲兵护体时曹性减伤 · 先打亲兵'], moves: { 白水伏杀: '暗箭伏射', 关隘滚石: '城头滚石' } },
  gaoshun: { p1: ['陷阵营', '陷阵冲锋 · 长枪突刺'], p2: ['攻无不克', '亲兵护体时高顺减伤 · 先打亲兵'], moves: { 连营反扑: '陷阵冲锋', 营寨弓弩: '陷阵弓弩' } },
  zhangliao: { p1: ['吕布骁将', '破阵 · 突阵 · 连环戟'], p2: ['死守下邳', '亲卫护体时张辽减伤 · 先打亲卫'], moves: { 巧变阵: '破阵', 张郃突阵: '张辽突阵', 连环枪击: '连环戟击', 长枪贯阵: '长戟贯阵' } },
  chengpu: { p1: ['江东老将', '老将锐气 · 江岸死守'], p2: ['三世老臣', '连斩 · 步战突进'], moves: { 宗室锐气: '老将锐气', 夷道死守: '江岸死守' } },
  zhouyu: { p1: ['江东都督', '火船奇袭 · 雅量高致'], p2: ['南郡合围', '召兵封路 · 箭雨'], moves: { 白衣渡江: '火船奇袭', 士别三日: '雅量高致', 麦城合围: '南郡合围', 吴军箭雨: '江东箭雨', 白衣再渡: '火船再袭' } },
  taishici: { p1: ['信义之将', '神亭突阵 · 长戟突刺'], p2: ['北海突围', '亲兵护体时太史慈减伤 · 先打亲兵'], moves: { 连营反扑: '神亭突阵', 长枪突刺: '长戟突刺', 长枪横扫: '双戟横扫', 营寨弓弩: '东莱神射' } },
  lidian: { p1: ['曹营儒将', '连环枪阵 · 陈留夜袭'], p2: ['坚守陈留', '一线贯穿长枪'], moves: { 百鸟朝凤枪: '连环枪阵', 宛城夜袭: '陈留夜袭', 白马突阵: '轻骑突阵', 枪出如龙: '一线贯枪' } },
  xuchu: { p1: ['虎痴', '虎卫冲锋 · 赤膊突刺'], p2: ['裸衣力战', '亲兵护体时许褚减伤 · 先打亲兵'], moves: { 连营反扑: '虎卫冲锋', 长枪突刺: '赤膊突刺', 长枪横扫: '大刀横扫', 营寨弓弩: '虎卫弓弩' } },
  yuejin: { p1: ['先登之将', '先登冲锋 · 绕城箭雨'], p2: ['困守许昌', '亲兵护卫时乐进减伤 · 先打亲兵'], moves: { 西凉铁骑: '先登冲锋', 劫掠长安: '绕城箭雨', 困兽连劈: '死战连劈', 西凉残部: '许昌守军' } },
  xiahoudun: { p1: ['独眼将军', '疾行突袭 · 拔矢啖睛'], p2: ['刚烈', '大范围横扫'], moves: { 三日五百: '拔矢啖睛' } },
};
/** 招式组：借现成首领的招式，改名登记（mount 去掉：借来的图没有骑乘姿态）。 */
export function sideMoves(src: Record<string, BossMovesetDef>): Record<string, BossMovesetDef> {
  const out: Record<string, BossMovesetDef> = {};
  for (const r of SIDE_ROUTES) for (const st of r.stages) for (const b of [st.boss, st.partner]) {
    if (!b || st.scene) continue; const m = src[b.moves]; if (!m) continue;
    const sty = SIDE_STYLE[b.id], ph = (p: BossMovesetDef['p1'], t?: [string, string]) => ({ ...p, name: t?.[0] ?? p.name, caption: t?.[1] ?? p.caption, moves: p.moves.map(x => ({ ...x, name: sty?.moves[x.name] ?? x.name })) });
    out[r.id + '.' + b.id] = b.id === 'caocao' ? { ...m, id: b.id, name: b.name } : { ...m, id: b.id, name: b.name, mount: undefined, p1: ph(m.p1, sty?.p1), p2: ph(m.p2, sty?.p2) };
  }
  return out;
}

/** 支线战斗：基础章节数值（base）+ 首领 / 波次 / 文案换成本关。 */
export function sideBattle(r: SideRouteDef, stage: number, base: ChapterDef, look?: ChapterDef): ChapterDef {
  const d = r.stages[stage - 1], hp = { xiapi: [1900, 2100, 2300, 2600], nanjun: [3000, 3400], caowei: [3400, 3600, 3800, 4200] }[r.id][stage - 1] ?? 2400;
  const enemies = look ? Object.fromEntries(Object.entries(base.enemies).map(([k, e]) => {
    const v = (look.enemies as Record<string, typeof e>)[k]; return [k, k === 'boss' || !v ? e : { ...v, hp: e.hp, speed: e.speed, damage: e.damage }];
  })) as ChapterDef['enemies'] : base.enemies;
  return {
    ...base,
    name: `${r.faction} · ${d.name}`, label: `讨伐令 · ${r.name} · ${d.name}`, description: d.story, bossName: d.boss.name,
    bossStyle: d.boss.id as ChapterDef['bossStyle'],
    waves: base.waves.map((w, i) => ({ ...w, name: d.waves[i] ?? w.name })),
    enemies: { ...enemies, boss: { ...base.enemies.boss, texture: sideTexture(d.boss.id), walkVisual: undefined, attackVisual: undefined, hp } },
    victoryTitle: d.boss.name + '败退', victoryText: d.kind === 'final' ? `${r.name} · 讨伐告成` : `${d.name}告捷 · 进入军营休整`,
  };
}
