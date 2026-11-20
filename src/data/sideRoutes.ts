import type { ChapterDef } from './chapters';
import type { BossMovesetDef } from './bossMoves';
import type { Specialty } from '../world/WorldCities';

/**
 * 其他势力支线 P1（设计稿 共享笔记 other-factions-design.md，用户 2026-11-19「批准开工」）：
 * 主线打到某章后，天下地图上该势力亮起「讨伐令」，按关推进；终局打完该势力的城池并入我方领地，并给一项势力特产。
 * 各关首领能不能劝降见 data/surrender.ts（'<支线>-<关>:<首领>' 键，surrender-rules.md）；打过的关不能再打，劝降一次性，错过就错过（data/replayRules.ts）。
 * 第一批可玩武将（吕布、张辽、周瑜、太史慈、曹操）P2 才做：P1 劝降成功先进降将栏，并记下「已劝降」，P2 的解锁条件读它（systems/HeroUnlocks persuaded）。
 * 战斗复用对应时期的章节战场（第三章式三关框架 / 三英战吕布挑战关）；还没有专属形象的首领先借现有首领图（ART_V2_FILES 的 side_* 键）。
 * 数值都是初值，交平衡会话。
 */
export type SideRouteId = 'xiapi' | 'nanjun' | 'caowei' | 'gongsun' | 'hebei' | 'jiangxia' | 'zhanglu' | 'xiliang' | 'dongwu' | 'nanzhong';
export type SideStageKind = 'siege' | 'field' | 'final';
/** 借兵种 / 数值 / 外观的基础章节。 */
export type SideBaseId = 'qunxiong' | 'guandu' | 'chibi' | 'jingnan' | 'hanzhong' | 'yiling' | 'nanzheng' | 'huangjin';
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
  /** 地图讨伐令上的名字（默认 faction；南郡写「南郡」免得和东吴混）。 */ flag?: string;
  /** 天下地图上的讨伐令位置（归一化坐标）。 */ x: number; y: number;
  /** 开放：主线某篇章通关几关（WorldStore.arcStages）。 */ open: { arc: 'qunxiong' | 'guandu' | 'chibi' | 'jingnan' | 'shu' | 'hanzhong' | 'xiangfan' | 'yiling' | 'nanzheng'; stages: number; hint: string };
  /** 借哪一章的兵种与数值。 */ base: SideBaseId;
  /** 敌兵外观借哪一章（江东借第十章吴军；数值仍按 base）。 */ look?: SideBaseId;
  stages: readonly SideStage[];
  /** 终局通关后并入的城池（攻城关已并入的不重复）。 */ annex: readonly string[];
  specialty: Specialty;
  /** 势力之主（终局首领）。 */ lord: string;
  /** 场景营具势力（sceneLooks ARC_FACTIONS）：1 西凉 · 3 曹军 · 4 东吴。 */ props: number;
}

const B = (id: string, name: string, title: string, v2: string, v1: string, moves: string, playable = false): SideBoss => ({ id, name, title, v2: 'assets/bosses-v2/' + v2 + '.png', v1: 'assets/' + v1 + '.png', moves, playable });

export const SIDE_ROUTES: readonly SideRouteDef[] = [
  { id: 'xiapi', name: '吕布 · 下邳', faction: '吕布', region: '徐州', x: .785, y: .585, props: 1,
    open: { arc: 'qunxiong', stages: 3, hint: '第三章「群雄割据」平定后开放' }, base: 'qunxiong',
    stages: [
      { name: '小沛', kind: 'siege', city: undefined, behavior: 1, scenery: 1, waves: ['小沛城外', '并州狼骑', '曹性守城'], story: '吕布夺了徐州，屯兵小沛。先拔小沛，断其羽翼。',
        boss: B('caoxing', '曹性', '吕布部将', 'side_caoxing', 'phase23/lijue', 'yanghuai') },
      { name: '辕门射戟', kind: 'field', behavior: 2, scenery: 2, waves: ['辕门前营', '陷阵营压阵', '高顺出阵'], story: '吕布辕门射戟，营前列阵。陷阵营攻无不克，先破高顺。',
        boss: B('gaoshun', '高顺', '陷阵营', 'side_gaoshun', 'guandu/yanliang', 'zhuran') },
      { name: '下邳', kind: 'siege', city: 'xiapi', behavior: 3, scenery: 4, waves: ['下邳外郭', '泗水决堤', '张辽守城'], story: '围下邳，决泗水。张辽据城而守，城破在即。',
        boss: B('zhangliao', '张辽', '吕布骁将', 'side_zhangliao', 'phase23/zhangxiu', 'zhanghe', true) },
      { name: '白门楼', kind: 'final', scene: 'lubu', behavior: 1, scenery: 1, waves: ['白门楼下', '吕布亲军', '吕布出阵'], story: '下邳城破，吕布退守白门楼。飞将末路，劝降还是斩杀？',
        boss: B('lubu', '吕布', '飞将', 'lubu_walk', 'phase23/lijue', 'lijue', true),
        // 陈宫：后排军师（专属图 side_chengong，美术 5dc8d5f），火攻 / 号令伏兵 / 给吕布献计；拒降就义（surrender-rules）
        partner: B('chengong', '陈宫', '公台', 'side_chengong', 'phase23/yuanshu', 'chengong') },
    ],
    annex: ['xiapi'], specialty: { title: '并州狼骑', text: '本命武器伤害 +3%', damage: .03 }, lord: 'lubu' },
  { id: 'nanjun', name: '江东 · 南郡', faction: '江东', flag: '南郡', region: '荆州 · 江陵', x: .375, y: .745, props: 4,
    open: { arc: 'chibi', stages: 3, hint: '第五章「赤壁之战」平定后开放' }, base: 'chibi', look: 'yiling',
    stages: [
      { name: '江陵外围', kind: 'field', behavior: 2, scenery: 2, waves: ['江岸吴营', '水军跳帮', '程普出阵'], story: '赤壁之后，周瑜移兵来争南郡。江陵城外，吴军水军登岸。',
        boss: B('chengpu', '程普', '江东老将', 'side_chengpu', 'chibi/caimao', 'sunhuan') },
      { name: '南郡', kind: 'final', behavior: 3, scenery: 3, waves: ['南郡城下', '江东精兵', '周瑜亲至'], story: '周瑜亲督诸军，太史慈为先锋。南郡一战，定荆州归属。',
        boss: B('zhouyu', '周瑜', '江东都督', 'side_zhouyu', 'chibi/caimao', 'lvmeng', true),
        partner: B('taishici', '太史慈', '东莱信义之将', 'side_taishici', 'chibi/caochun', 'zhuran', true) },
    ],
    annex: [], specialty: { title: '江东水军', text: '战后粮草收益 +10%', provisions: .1 }, lord: 'zhouyu' },
  { id: 'caowei', name: '中原 · 曹魏', faction: '曹魏', region: '兖州 · 豫州', x: .585, y: .43, props: 3,
    open: { arc: 'hanzhong', stages: 3, hint: '第八章「汉中之战」平定后开放' }, base: 'hanzhong',
    stages: [
      { name: '陈留', kind: 'siege', city: 'chenliu', behavior: 1, scenery: 1, waves: ['陈留城外', '青州兵列阵', '李典守城'], story: '曹操起兵之地。先下陈留，动摇中原。',
        boss: B('lidian', '李典', '曹营儒将', 'side_lidian', 'phase23/zhangxiu', 'zhangxiu') },
      { name: '宛城旧地', kind: 'field', behavior: 2, scenery: 2, waves: ['宛城旧营', '虎卫军', '许褚出阵'], story: '宛城旧地，虎卫军拦路。许褚赤膊来战。',
        boss: B('xuchu', '许褚', '虎痴', 'side_xuchu', 'guandu/wenchou', 'zhuran') },
      { name: '许昌', kind: 'siege', city: 'xuchang', behavior: 3, scenery: 4, waves: ['许昌外城', '虎豹骑巡城', '乐进守城'], story: '天子所在，许都门户。乐进先登，誓守许昌。',
        boss: B('yuejin', '乐进', '先登之将', 'side_yuejin', 'phase23/lijue', 'lijue') },
      { name: '许都决战', kind: 'final', behavior: 1, scenery: 4, waves: ['许都城下', '虎豹骑出城', '曹操亲至'], story: '中原诸城尽下，曹操与夏侯惇出城决战。',
        boss: B('caocao', '曹操', '魏王', 'hanzhong_caocao', 'chibi/caoren', 'caocao', true),
        partner: B('xiahoudun', '夏侯惇', '独眼将军', 'side_xiahoudun', 'guandu/wenchou', 'xiahouyuan') },
    ],
    annex: ['luoyang', 'baima', 'guandu', 'wuchao', 'runan', 'wancheng'], specialty: { title: '中原兵员', text: '出征可多带 1 名后备兵', reserveSlots: 1 }, lord: 'caocao' },
  // —— P1b 第一批（第三、四章后）——
  { id: 'gongsun', name: '公孙瓒 · 幽州', faction: '公孙瓒', region: '幽州 · 青州', x: .745, y: .12, props: 2,
    open: { arc: 'qunxiong', stages: 3, hint: '第三章「群雄割据」平定后开放' }, base: 'qunxiong',
    stages: [
      { name: '平原', kind: 'siege', city: 'pingyuan', behavior: 1, scenery: 1, waves: ['平原城外', '白马斥候', '田楷守城'], story: '公孙瓒遣田楷据平原，与袁绍争青州。先下平原，打开北上之路。',
        boss: B('tiankai', '田楷', '青州刺史', 'side_tiankai', 'phase23/lijue', 'zhaofan') },
      { name: '界桥', kind: 'field', behavior: 2, scenery: 2, waves: ['界桥两岸', '白马义从', '严纲出阵'], story: '界桥两岸，白马义从往来驰射。严纲领骑兵来冲，先破白马阵。',
        boss: B('yangang', '严纲', '白马义从统领', 'side_yangang', 'phase23/lijue', 'lijue') },
      { name: '易京楼', kind: 'final', behavior: 3, scenery: 4, waves: ['易京楼下', '楼橹死守', '公孙瓒亲至'], story: '公孙瓒退守易京，楼橹千重。白马将军与田豫出楼决战。',
        boss: B('gongsunzan', '公孙瓒', '白马将军', 'side_gongsunzan', 'phase23/zhangxiu', 'zhangxiu'),
        partner: B('tianyu', '田豫', '幽州从事', 'side_tianyu', 'phase23/lijue', 'yanghuai') },
    ],
    annex: ['ji'], specialty: { title: '白马义从', text: '开局增援 +1 名士兵', reinforcements: 1 }, lord: 'gongsunzan' },
  { id: 'hebei', name: '袁绍 · 河北', faction: '袁绍', region: '冀州 · 并州 · 青州', x: .505, y: .215, props: 2,
    open: { arc: 'guandu', stages: 3, hint: '第四章「官渡之战」平定后开放' }, base: 'guandu',
    stages: [
      { name: '南皮', kind: 'siege', city: 'nanpi', behavior: 1, scenery: 1, waves: ['南皮城外', '大戟士', '高览守城'], story: '官渡之后，袁氏退守河北。先取南皮，断其东面。',
        boss: B('gaolan', '高览', '河北名将', 'side_gaolan', 'guandu/yanliang', 'zhuran') },
      { name: '仓亭', kind: 'field', behavior: 2, scenery: 2, waves: ['仓亭渡口', '先登死士', '麴义出阵'], story: '仓亭渡口，麴义的先登死士伏弩以待。破其强弩，渡河北进。',
        boss: B('quyi', '麴义', '先登营', 'side_quyi', 'guandu/wenchou', 'zhangxiu') },
      { name: '邺城', kind: 'siege', city: 'ye', behavior: 3, scenery: 4, waves: ['邺城外郭', '漳水围城', '沮授守城'], story: '引漳水围邺城。沮授据城死守，城中粮尽。',
        boss: B('jushou', '沮授', '河北谋主', 'side_jushou', 'phase23/yuanshu', 'liudu') },
      { name: '冀州决战', kind: 'final', behavior: 1, scenery: 4, waves: ['冀州城下', '袁氏亲军', '袁绍亲至'], story: '河北诸城尽下，袁绍与审配出城，作最后一战。',
        boss: B('yuanshao', '袁绍', '四世三公', 'side_yuanshao', 'phase23/yuanshu', 'liuzhang'),
        partner: B('shenpei', '审配', '河北忠臣', 'side_shenpei', 'phase23/lijue', 'hanxuan') },
    ],
    annex: ['jinyang', 'shangdang', 'linzi', 'beihai', 'donglai', 'pingyuan'], specialty: { title: '河北钱粮', text: '战后粮草收益 +15%', provisions: .15 }, lord: 'yuanshao' },
  { id: 'jiangxia', name: '荆州 · 江夏', faction: '江夏', region: '荆州 · 江夏', x: .665, y: .81, props: 3,
    open: { arc: 'guandu', stages: 3, hint: '第四章「官渡之战」平定后开放' }, base: 'guandu', look: 'jingnan',
    stages: [
      { name: '江夏外围', kind: 'field', behavior: 2, scenery: 2, waves: ['江夏水寨', '锦帆贼', '甘宁出阵'], story: '黄祖据江夏，锦帆贼甘宁屈居其下。江边水寨，铃声先至。',
        boss: B('ganning', '甘宁', '锦帆贼', 'side_ganning', 'chibi/caimao', 'sunhuan', true) },
      { name: '江夏', kind: 'final', behavior: 3, scenery: 3, waves: ['江夏城下', '荆州水军', '黄祖亲至'], story: '黄祖与文聘出城迎战。江夏一下，荆州门户洞开。',
        boss: B('huangzu', '黄祖', '江夏太守', 'side_huangzu', 'chibi/caimao', 'caimao'),
        partner: B('wenpin', '文聘', '荆州大将', 'side_wenpin', 'chibi/caochun', 'zhaofan') },
    ],
    annex: ['jiangxia'], specialty: { title: '锦帆水寨', text: '最大生命 +5%', maxHp: .05 }, lord: 'huangzu' },
  // —— P1b 第二批（第七、九章后）——
  { id: 'zhanglu', name: '张鲁 · 汉中', faction: '张鲁', region: '汉中 · 南郑', x: .095, y: .42, props: 5,
    open: { arc: 'shu', stages: 3, hint: '第七章「入蜀」平定后开放' }, base: 'hanzhong', look: 'huangjin',
    stages: [
      { name: '五斗米道坛', kind: 'field', behavior: 2, scenery: 2, waves: ['道坛外围', '五斗米祭酒', '杨任出阵'], story: '张鲁以五斗米道治汉中，鬼卒、祭酒层层设坛。先破道坛，再下南郑。',
        boss: B('yangren', '杨任', '张鲁部将', 'side_yangren', 'phase23/lijue', 'zhangren') },
      { name: '南郑', kind: 'final', behavior: 3, scenery: 4, waves: ['南郑城下', '鬼卒道兵', '张鲁亲至'], story: '南郑城下，张鲁与阎圃出城。师君本无死战之心。',
        boss: B('zhanglu', '张鲁', '五斗米师君', 'side_zhanglu', 'phase23/yuanshu', 'liuzhang'),
        partner: B('yanpu', '阎圃', '汉中功曹', 'side_yanpu', 'phase23/yuanshu', 'liudu') },
    ],
    annex: ['hanzhong'], specialty: { title: '五斗米义舍', text: '每次出征开局获得 1 点属性点', attributePoints: 1 }, lord: 'zhanglu' },
  { id: 'xiliang', name: '西凉 · 马韩', faction: '西凉', region: '凉州 · 陇右', x: .1, y: .24, props: 1,
    open: { arc: 'xiangfan', stages: 3, hint: '第九章「襄樊之战」平定后开放' }, base: 'hanzhong', look: 'qunxiong',
    stages: [
      { name: '天水', kind: 'siege', city: 'tianshui', behavior: 1, scenery: 1, waves: ['天水城外', '羌胡骑兵', '梁兴守城'], story: '韩遂聚关西诸将据守陇右。先拔天水，打通西凉道。',
        boss: B('liangxing', '梁兴', '关西军阀', 'side_liangxing', 'phase23/lijue', 'lijue') },
      { name: '渭水', kind: 'field', behavior: 2, scenery: 2, waves: ['渭水河畔', '西凉铁骑', '阎行出阵'], story: '渭水河畔，西凉铁骑往来冲突。阎行挺矛来战。',
        boss: B('yanxing', '阎行', '西凉猛将', 'side_yanxing', 'phase23/zhangxiu', 'pangde') },
      { name: '金城', kind: 'final', behavior: 1, scenery: 4, waves: ['金城城下', '羌兵助阵', '韩遂亲至'], story: '九曲黄河韩文约退守金城，马岱领兵助阵。西凉一战而定。',
        boss: B('hansui', '韩遂', '九曲黄河', 'side_hansui', 'phase23/lijue', 'guosi'),
        partner: B('madai', '马岱', '西凉骁将', 'side_madai', 'phase23/zhangxiu', 'zhangxiu') },
    ],
    annex: [], specialty: { title: '西凉铁骑', text: '本命武器伤害 +3%', damage: .03 }, lord: 'hansui' },
  // —— P1b 第三批（第十、十一章后）——
  { id: 'dongwu', name: '东吴 · 江东', faction: '东吴', region: '扬州 · 庐江 · 吴郡', x: .9, y: .7, props: 4,
    open: { arc: 'yiling', stages: 3, hint: '第十章「夷陵之战」平定后开放' }, base: 'yiling',
    stages: [
      { name: '庐江', kind: 'siege', city: 'lujiang', behavior: 1, scenery: 1, waves: ['庐江城外', '江东弓手', '蒋钦守城'], story: '夷陵之仇未报，挥师东下。先取庐江，兵临濡须。',
        boss: B('jiangqin', '蒋钦', '江东水将', 'side_jiangqin', 'chibi/caochun', 'zhuran') },
      { name: '濡须口', kind: 'field', behavior: 2, scenery: 2, waves: ['濡须坞前', '吴军水师', '黄盖出阵'], story: '濡须口坞堡坚固，吴军水师往来。老将黄盖亲自督战。',
        boss: B('huanggai', '黄盖', '江东老将', 'side_huanggai', 'chibi/caimao', 'sunhuan') },
      { name: '吴郡', kind: 'final', behavior: 3, scenery: 3, waves: ['吴郡城下', '江东子弟', '孙权亲至'], story: '江东诸城尽下，孙权与周泰出城。坐断东南的碧眼儿，今日当如何？',
        boss: B('sunquan', '孙权', '吴侯', 'side_sunquan', 'chibi/caimao', 'lvmeng', true),
        partner: B('zhoutai', '周泰', '江东猛将', 'side_zhoutai', 'chibi/caochun', 'zhuran') },
    ],
    annex: ['wujun'], specialty: { title: '吴郡富庶', text: '战后粮草收益 +10%', provisions: .1 }, lord: 'sunquan' },
  { id: 'nanzhong', name: '南中 · 银坑', faction: '南中', region: '南中 · 银坑洞', x: .13, y: .9, props: 6,
    open: { arc: 'nanzheng', stages: 3, hint: '第十一章「南征」平定后开放' }, base: 'nanzheng',
    stages: [
      { name: '银坑洞', kind: 'field', behavior: 2, scenery: 2, waves: ['银坑山口', '藤甲兵', '孟优出阵'], story: '孟获虽已心服，银坑洞仍有余部不肯归顺。孟优领藤甲兵据洞而守。',
        boss: B('mengyou', '孟优', '孟获之弟', 'side_mengyou', 'guandu/chunyuqiong', 'mangyachang') },
      { name: '秃龙洞', kind: 'final', behavior: 3, scenery: 3, waves: ['秃龙洞外', '象兵冲阵', '带来洞主亲至'], story: '秃龙洞毒泉密布，带来洞主与朵思大王驱象兵出洞。南中一定，再无后顾之忧。',
        boss: B('dailai', '带来洞主', '祝融之弟', 'side_dailai', 'guandu/chunyuqiong', 'menghuo'),
        partner: B('duosi', '朵思大王', '秃龙洞主', 'side_duosi', 'guandu/chunyuqiong', 'wutugu') },
    ],
    annex: [], specialty: { title: '南中象兵', text: '最大生命 +6%', maxHp: .06 }, lord: 'dailai' },
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
  finalMul: 2,
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
  tiankai: { p1: ['青州刺史', '亲军护驾 · 弓阵齐射'], p2: ['弃城欲逃', '田楷绕城奔逃 · 身后落下绊索'], moves: {} },
  yangang: { p1: ['白马义从', '白马冲阵 · 绕阵骑射'], p2: ['界桥死战', '义从亲兵护卫时严纲减伤 · 先打亲兵'], moves: { 西凉铁骑: '白马冲阵', 劫掠长安: '绕阵骑射', 困兽连劈: '死战连劈', 西凉残部: '白马残部' } },
  gongsunzan: { p1: ['白马将军', '白马枪阵 · 易京夜袭'], p2: ['楼橹死守', '一线贯穿长枪'], moves: { 百鸟朝凤枪: '白马枪阵', 宛城夜袭: '易京夜袭', 白马突阵: '白马突阵', 枪出如龙: '枪出如龙' } },
  tianyu: { p1: ['幽州从事', '伏弩暗射 · 楼头滚石'], p2: ['困守易京', '亲兵护体时田豫减伤 · 先打亲兵'], moves: { 白水伏杀: '伏弩暗射', 关隘滚石: '楼头滚石' } },
  gaolan: { p1: ['河北名将', '大戟冲锋 · 长戟突刺'], p2: ['南皮死守', '亲兵护体时高览减伤 · 先打亲兵'], moves: { 连营反扑: '大戟冲锋', 长枪突刺: '长戟突刺', 长枪横扫: '大戟横扫', 营寨弓弩: '河北强弩' } },
  quyi: { p1: ['先登营', '先登伏弩 · 仓亭夜袭'], p2: ['强弩死战', '一线贯穿长枪'], moves: { 百鸟朝凤枪: '先登枪阵', 宛城夜袭: '仓亭夜袭', 白马突阵: '先登突阵' } },
  jushou: { p1: ['河北谋主', '伏兵四起 · 盾阵推进'], p2: ['据城死守', '盾兵护体时沮授减伤 · 先破盾兵'], moves: { 山越伏林: '伏兵四起', 藤牌推进: '盾阵推进', 山越毒箭: '城头冷箭' } },
  yuanshao: { p1: ['四世三公', '闭城自守 · 城头弓阵'], p2: ['袁氏余威', '盾兵护体时袁绍减伤 · 先破盾兵'], moves: { 州府箭雨: '冀州箭雨', 益州援兵: '河北援兵' } },
  shenpei: { p1: ['河北忠臣', '严令督战 · 城头弓阵'], p2: ['宁死不降', '亲兵护体时审配减伤 · 先打亲兵'], moves: { 严刑督战: '严令督战' } },
  ganning: { p1: ['锦帆贼', '锦帆夜袭 · 铃声为号'], p2: ['百骑劫营', '连斩 · 步战突进'], moves: { 宗室锐气: '锦帆夜袭', 夷道死守: '铃声为号' } },
  huangzu: { p1: ['江夏太守', '楼船箭雨 · 水军旗令'], p2: ['江夏火起', '火箭雨落处起火 · 水军增援'], moves: {} },
  yangren: { p1: ['张鲁部将', '道坛伏弩 · 冲阵'], p2: ['死守道坛', '弓手护体时杨任减伤 · 先打弓手'], moves: { 落凤伏弩: '道坛伏弩', 张任冲阵: '杨任冲阵', 宁死不降: '死守道坛' } },
  zhanglu: { p1: ['五斗米师君', '闭城自守 · 城头弓阵'], p2: ['困守南郑', '鬼卒护体时张鲁减伤 · 先破鬼卒'], moves: { 州府箭雨: '南郑箭雨', 益州援兵: '鬼卒援兵' } },
  yanpu: { p1: ['汉中功曹', '伏兵四起 · 盾阵推进'], p2: ['据城死守', '盾兵护体时阎圃减伤 · 先破盾兵'], moves: { 山越伏林: '伏兵四起', 藤牌推进: '盾阵推进', 山越毒箭: '城头冷箭' } },
  liangxing: { p1: ['关西军阀', '羌骑冲锋 · 劫掠陇右'], p2: ['困守天水', '亲兵护卫时梁兴减伤 · 先打亲兵'], moves: { 西凉铁骑: '羌骑冲锋', 劫掠长安: '劫掠陇右', 西凉残部: '关西残部' } },
  yanxing: { p1: ['西凉猛将', '铁骑冲锋 · 刺马一矛'], p2: ['死战不退', '狂暴连斩 · 步战冲杀'], moves: { 抬榇冲锋: '铁骑冲锋', 额前一箭: '刺马一矛' } },
  hansui: { p1: ['九曲黄河', '厚背砍刀 · 纵兵劫掠'], p2: ['困守金城', '三连劈 · 拖刀突进'], moves: {} },
  madai: { p1: ['西凉骁将', '马家枪阵 · 金城夜袭'], p2: ['枪出如龙', '一线贯穿长枪'], moves: { 百鸟朝凤枪: '马家枪阵', 宛城夜袭: '金城夜袭', 白马突阵: '西凉突阵' } },
  jiangqin: { p1: ['江东水将', '水军突袭 · 长枪突刺'], p2: ['死守庐江', '亲兵护体时蒋钦减伤 · 先打亲兵'], moves: { 连营反扑: '水军突袭', 营寨弓弩: '庐江弓弩' } },
  huanggai: { p1: ['江东老将', '苦肉锐气 · 濡须死守'], p2: ['老当益壮', '连斩 · 步战突进'], moves: { 宗室锐气: '苦肉锐气', 夷道死守: '濡须死守' } },
  sunquan: { p1: ['吴侯', '江东奇袭 · 坐断东南'], p2: ['吴郡合围', '召兵封路 · 箭雨'], moves: { 白衣渡江: '江东奇袭', 士别三日: '坐断东南', 麦城合围: '吴郡合围', 吴军箭雨: '江东箭雨', 白衣再渡: '江东再袭' } },
  zhoutai: { p1: ['江东猛将', '护主冲阵 · 长枪突刺'], p2: ['身被十二创', '亲兵护体时周泰减伤 · 先打亲兵'], moves: { 连营反扑: '护主冲阵', 营寨弓弩: '江东弓弩' } },
  mengyou: { p1: ['孟获之弟', '蛮刀乱劈 · 象兵冲撞'], p2: ['银坑瘴气', '身边瘴气一圈圈外扩'], moves: {} },
  dailai: { p1: ['祝融之弟', '洞主冲阵 · 洞主怒吼'], p2: ['困守秃龙洞', '象兵冲阵 · 洞主震地'], moves: { 蛮王冲阵: '洞主冲阵', 蛮王怒吼: '洞主怒吼', 蛮王震地: '洞主震地', 蛮王横扫: '洞主横扫' } },
  duosi: { p1: ['秃龙洞主', '巨人践踏 · 震地'], p2: ['毒泉狂怒', '朵思狂怒 · 三重震地'], moves: {} },
  wenpin: { p1: ['荆州大将', '亲军护驾 · 弓阵齐射'], p2: ['江夏死守', '文聘绕城奔逃 · 身后落下绊索'], moves: {} },
};
/** 招式组：借现成首领的招式，改名登记（mount 去掉：借来的图没有骑乘姿态）。 */
export function sideMoves(src: Record<string, BossMovesetDef>): Record<string, BossMovesetDef> {
  const out: Record<string, BossMovesetDef> = {};
  for (const r of SIDE_ROUTES) for (const st of r.stages) for (const b of [st.boss, st.partner]) {
    if (!b || (st.scene && b === st.boss)) continue; const m = src[b.moves]; if (!m) continue;
    const sty = SIDE_STYLE[b.id], ph = (p: BossMovesetDef['p1'], t?: [string, string]) => ({ ...p, name: t?.[0] ?? p.name, caption: t?.[1] ?? p.caption, moves: p.moves.map(x => ({ ...x, name: sty?.moves[x.name] ?? x.name })) });
    out[r.id + '.' + b.id] = b.id === 'caocao' ? { ...m, id: b.id, name: b.name } : { ...m, id: b.id, name: b.name, mount: undefined, p1: ph(m.p1, sty?.p1), p2: ph(m.p2, sty?.p2) };
  }
  return out;
}

/** 支线战斗：基础章节数值（base）+ 首领 / 波次 / 文案换成本关。 */
export function sideBattle(r: SideRouteDef, stage: number, base: ChapterDef, look?: ChapterDef): ChapterDef {
  const d = r.stages[stage - 1], hp = ({ xiapi: [1900, 2100, 2300, 2600], nanjun: [3000, 3400], caowei: [3400, 3600, 3800, 4200] } as Partial<Record<SideRouteId, number[]>>)[r.id]?.[stage - 1] ?? Math.round(base.enemies.boss.hp * (d.kind === 'final' ? 1.15 : 1)); // 新支线：按基础章节同关首领生命，终局 ×1.15
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
