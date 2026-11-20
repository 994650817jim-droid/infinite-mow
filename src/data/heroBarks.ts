import type { CharacterId } from './characters';

/**
 * 武将台词（2026-11-17 用户：「各种武将被动触发之后会说台词，设计一下」；没有配音，做成头顶气泡里的文字）。
 * - trigger：被动大招触发（满层强化那一下；黄忠是进入「神射」）时说，第一次必说，之后 BARK.chance 几率，同一武将两句至少隔 BARK.gapMs。
 * - bossAppear / bossDown：首领登场 / 倒下时说（必说，不受间隔限制）；vsBoss 按首领名给专属台词，优先于通用句。
 * - 马超、孙尚香主将身份时，被动满层已有用户定稿的大字战吼（ui/PassiveShout），trigger 不再弹气泡；当随从时照常说。
 * - everyTrigger：每次触发都说（不受几率、间隔限制），魏延「谁敢杀我！」沿用原来每次都喊；color：大字颜色（缺省金色）。
 * 表现与马超 / 孙尚香被动满层战吼同一套大字（ui/PassiveShout.warCryText）；随从说话字号 ×0.7。
 * 每句不超过 12 个字。改台词只改这里。
 */
export const BARK = {
  /** 第一次触发必说，之后每次触发的说话几率。 */
  firstChance: 1, chance: .5,
  /** 同一武将两句台词的最短间隔（毫秒）。 */
  gapMs: 12000,
  /** 气泡停留（毫秒），之前弹出 popMs、之后淡出 fadeMs。 */
  holdMs: 1600, popMs: 140, fadeMs: 240,
} as const;

export interface HeroBarkLines {
  trigger: readonly string[];
  bossAppear: readonly string[];
  bossDown: readonly string[];
  everyTrigger?: boolean; color?: string;
  /** 首领名 → 登场时的专属台词。 */
  vsBoss?: Readonly<Record<string, string>>;
}

export const HERO_BARKS: Record<CharacterId, HeroBarkLines> = {
  sunquan: {
    trigger: ['江东子弟，随孤齐射！', '制衡之道，在于审时度势。', '坐断东南，战未休！'],
    bossAppear: ['来者何人？报上名来。'], bossDown: ['不过如此。'],
    vsBoss: { 曹操: '孟德，濡须口那一战可还记得？', 关羽: '云长，荆州之事，今日了断。', 陆逊: '伯言，你可是孤的大都督。' },
  },
  dianwei: {
    trigger: ['古之恶来在此！', '主公退后，某来挡！', '谁敢近前一步！'],
    bossAppear: ['来，吃某一戟！'], bossDown: ['不过如此。'],
    vsBoss: { 张绣: '张绣！宛城那夜的账，今日一并算了！', 许褚: '仲康，比比谁的力气大！' },
  },
  ganning: {
    trigger: ['锦帆贼甘宁在此！', '百骑劫营，随我来！', '听见铃声了吗？'],
    bossAppear: ['水寨里的铃声，就是你们的丧钟。'], bossDown: ['痛快！'],
    vsBoss: { 黄祖: '黄祖，你不用我，今日便知道厉害！', 凌统: '公绩，旧怨今日了结！' },
  },
  mengde: {
    trigger: ['宁教我负天下人！', '虎豹骑，随我冲阵！', '天下英雄，唯使君与操耳。'],
    bossAppear: ['来者何人？报上名来。'], bossDown: ['吾好梦中杀人。'],
    vsBoss: { 刘备: '玄德，煮酒论英雄可还记得？', 吕布: '奉先，白门楼下再会了。', 袁绍: '本初，官渡之后你还剩几兵？' },
  },
  taishici: {
    trigger: ['大丈夫当带七尺之剑，以升天子之阶！', '东莱太史慈在此！', '随我杀出重围！'],
    bossAppear: ['神亭一战，还未尽兴！'], bossDown: ['信义所在，岂容宵小！'],
    vsBoss: { 孙策: '伯符，再战三百合！', 周瑜: '公瑾，得罪了。' },
  },
  zhouyu: {
    trigger: ['万事俱备，只欠东风！', '火船齐发，烧！', '曲有误，周郎顾。'],
    bossAppear: ['来得正好，且看我火攻之计。'], bossDown: ['樯橹灰飞烟灭。'],
    vsBoss: { 曹操: '孟德，赤壁之火可还记得？', 诸葛亮: '孔明……既生瑜，何生亮！' },
  },
  zhangliao: {
    trigger: ['八百虎贲，随我破阵！', '张文远在此，谁敢一战！', '辽来辽来！'],
    bossAppear: ['敌众我寡，正好破之！'], bossDown: ['敌胆已破。'],
    vsBoss: { 孙权: '孙仲谋，逍遥津可还记得？', 吕布: '温侯，辽……得罪了。' },
  },
  lvbu: {
    trigger: ['人中吕布，马中赤兔！', '天下谁人能挡我！', '无双之名，岂是虚传！'],
    bossAppear: ['来者何人，也配与我一战？'], bossDown: ['不堪一击。'],
    vsBoss: { 张郃: '张儁乂，接我一戟！', 曹操: '曹阿瞒，白门楼之仇今日来报！' },
  },
  zhaoyun: {
    trigger: ['吾乃常山赵子龙也！', '七进七出，谁可挡我！', '子龙一身都是胆！'],
    bossAppear: ['来将通名！', '贼将休走！'], bossDown: ['贼将已授首！'],
    vsBoss: { 张郃: '张郃，再来一战！' },
  },
  guanyu: {
    trigger: ['关某在此，鼠辈休走！', '青龙偃月，斩将夺旗！', '插标卖首之徒！'],
    bossAppear: ['尔等可识得关某？'], bossDown: ['此等匹夫，不足挂齿。'],
    vsBoss: { 华雄: '酒尚温，斩华雄！', 颜良: '颜良匹夫，纳命来！', 文丑: '文丑，与颜良作伴去！' },
  },
  zhangfei: {
    trigger: ['燕人张翼德在此！', '谁敢与我决一死战！', '来来来，再战三百合！'],
    bossAppear: ['哪个来与俺老张厮杀！'], bossDown: ['痛快！再来一个！'],
    vsBoss: { 吕布: '三姓家奴休走！' },
  },
  huangzhong: {
    trigger: ['老夫宝刀未老！', '看箭！', '百步之外，一箭封喉！'],
    bossAppear: ['老将出马，一个顶俩！'], bossDown: ['定军山上，也是这般！'],
    vsBoss: { 夏侯渊: '夏侯渊，定军山见！' },
  },
  zhuge: {
    trigger: ['火攻之计，正在此时。', '万事俱备，东风已至。', '羽扇纶巾，谈笑破敌。'],
    bossAppear: ['亮早已料到此着。'], bossDown: ['此皆在亮算中。'],
    vsBoss: { 司马懿: '仲达，又见面了。' },
  },
  machao: {
    trigger: ['西凉锦马超在此！', '铁骑踏阵！'],
    bossAppear: ['西凉马孟起在此！'], bossDown: ['不堪一击！'],
    vsBoss: { 曹仁: '曹贼，还我父仇！', 许褚: '许褚，再斗三百合！' },
  },
  weiyan: {
    trigger: ['谁敢杀我！'], everyTrigger: true, color: '#ffe0b0',
    bossAppear: ['我魏文长在此！', '子午谷，我自去得！'], bossDown: ['谁还敢来！'],
  },
  liubei: {
    trigger: ['仁德之师，誓扶汉室！', '众将士，随我杀敌！', '兄弟同心，其利断金！'],
    bossAppear: ['逆贼！今日必讨之！'], bossDown: ['汉室有望矣！'],
    vsBoss: { 张角: '黄巾乱国，当诛！', 董卓: '国贼董卓，天下共讨！', 吕布: '三弟、二弟，并力向前！' },
  },
  pangtong: {
    trigger: ['连环已成，火起！', '凤雏之计，岂容小觑？', '一把火，烧个干净！'],
    bossAppear: ['来得好，正中下怀。'], bossDown: ['连环之计，果然好使。'],
    vsBoss: { 蔡瑁: '蔡瑁，连环计送你！' },
  },
  huangyueying: {
    trigger: ['机关已备，齐射！', '弩机连发，看你哪逃！', '木牛流马，也会杀敌！'],
    bossAppear: ['让你见识机关之术。'], bossDown: ['机关算尽，正好收工。'],
  },
  sunshangxiang: {
    trigger: ['看刀！', '谁说女子不如男？'],
    bossAppear: ['江东儿女，岂惧你？'], bossDown: ['哼，不过如此！'],
  },
  diaochan: {
    trigger: ['闭月之姿，君且细看。', '一舞倾城，莫要回头。', '将军，可要小心了。'],
    bossAppear: ['又是一位英雄？'], bossDown: ['可惜了，英雄。'],
    vsBoss: { 董卓: '太师，别来无恙？', 吕布: '奉先，你可还记得我？' },
  },
};
