/**
 * 第四章 · 官渡之战 剧本（统筹 story-ch04.md，用户 2026-11-17 批准）。
 * 主公随关羽「约三事」暂栖曹营，替曹操打白马、延津、乌巢；章末乌巢火起后得刘备消息，接过场「千里走单骑」。
 * 读第三章旗标：jade_seal（章头程昱、闲话）、dianwei（4-1 / 4-3 军情、闲话）。写旗标：yanliang_by_guanyu / wenchou_by_guanyu（关羽在队打赢 4-1 / 4-2）。
 * 两段过场「许攸夜奔」「千里走单骑」：过场系统没好之前按字幕当卷轴播。插画（story_xueshu / story_tushan / story_wuchao / story_xuyou / story_danqi）还没有，先退回通用横幅（占位）。
 * 称呼去重：「云长、{lord}」这类句子在主公是关羽时改用 variants.guanyu。
 */
import type { StoryChapter } from './types';

const DANQI_HEAD = [
  { text: '关羽封金挂印，留书辞曹。' },
  { who: 'caocao', text: '云长，此去保重。' },
  { who: 'guanyu', text: '蒙丞相赐袍，异日更得相会。' },
  { text: '东岭关 · 孔秀　洛阳 · 孟坦 韩福　汜水关 · 卞喜　荥阳 · 王植　黄河渡口 · 秦琪' },
  { text: '过五关，斩六将。' },
] as const;
const DANQI_TAIL = [
  { text: '赵云持枪立于一旁。', ifFollower: 'zhaoyun' as const },
  { text: '兄弟古城重聚。刘备南投荆州刘表，屯兵新野。' },
] as const;
const CLOSE_HEAD = [
  { text: '乌巢火起，袁军粮草尽焚。张郃、高览阵前倒戈，袁军一夜大溃。' },
  { who: 'yuanshao', text: '（弃甲北逃）吾不听田丰之言，以至于此……' },
] as const;

export const GUANDU_STORY: StoryChapter = {
  chapter: 'guandu',
  open: {
    id: 'guandu.open', type: 'chapterOpen', kicker: '第四章 · 官渡之战', title: '衣带诏', illustration: 'story_xueshu',
    lines: [
      { text: '建安五年，天子刺指为血书，缝入玉带，密诏国舅董承诛曹。' },
      { text: '事泄。董承等五家尽遭灭门，诏上署名的刘备首当其冲。' },
      { who: 'caocao', text: '夫刘备，人杰也。今不击，必为后患！' },
      { who: 'chengyu', text: '寿春的玉玺至今下落不明，恐怕就在刘备军中。', ifFlag: 'jade_seal=kept' },
      { text: '曹操亲征徐州。刘备兵败，单骑投奔袁绍；关羽与{lord}护着二位夫人，困守下邳。', ifNotLord: ['guanyu'] },
      { text: '曹操亲征徐州。刘备兵败，单骑投奔袁绍；关羽护着二位夫人，困守下邳。', ifLord: ['guanyu'] },
    ],
    variants: {
      liubei: [
        { text: '建安五年，天子刺指为血书，缝入玉带，密诏国舅董承诛曹。' },
        { text: '事泄。董承等五家尽遭灭门，诏上署名的刘备首当其冲。' },
        { who: 'caocao', text: '夫刘备，人杰也。今不击，必为后患！' },
        { who: 'chengyu', text: '寿春的玉玺至今下落不明，恐怕就在刘备军中。', ifFlag: 'jade_seal=kept' },
        { text: '曹操亲征徐州。{lord}兵败，未能脱身，与关羽护着二位夫人，困守下邳。' },
      ],
    },
  },
  stages: {
    1: {
      before: [{ id: 'guandu-1.tushan', type: 'interlude', kicker: '幕间', title: '土山约三事', illustration: 'story_tushan', lines: [
        { who: 'zhangliao', text: '云长、{lord}，困守土山，徒死无益。何不暂归曹公，再打听玄德公下落？' },
        { who: 'guanyu', text: '某有三约：一，降汉不降曹；二，二位嫂嫂按皇叔俸禄供养；三，但知兄长去向，便当辞去。' },
        { who: 'caocao', text: '……吾许之。' },
        { text: '关羽与{lord}遂入曹营。曹操三日一小宴，五日一大宴，赠金赠袍，关羽一概封存。' },
      ], variants: {
        liubei: [
          { who: 'zhangliao', text: '玄德公、云长，困守土山，徒死无益。何不暂归曹公，日后再作打算？' },
          { who: 'guanyu', text: '某有三约：一，降汉不降曹；二，二位嫂嫂按皇叔俸禄供养；三，他日我兄弟要走，丞相不得阻拦。' },
          { who: 'caocao', text: '……吾许之。' },
          { text: '关羽与{lord}遂入曹营。曹操三日一小宴，五日一大宴，赠金赠袍，关羽一概封存。' },
        ],
        guanyu: [
          { who: 'zhangliao', text: '云长，困守土山，徒死无益。何不暂归曹公，再打听玄德公下落？' },
          { who: '{lord}', text: '某有三约：一，降汉不降曹；二，二位嫂嫂按皇叔俸禄供养；三，但知兄长去向，便当辞去。' },
          { who: 'caocao', text: '……吾许之。' },
          { text: '关羽遂入曹营。曹操三日一小宴，五日一大宴，赠金赠袍，关羽一概封存。' },
        ],
      } }],
      brief: { id: 'guandu-1.brief', type: 'stageBrief', kicker: '4-1 · 军情', title: '白马解围', lines: [
        { who: 'scout', text: '袁绍遣大将颜良围白马，东郡太守刘延告急！' },
        { who: 'caocao', text: '云长、{lord}，可愿随我解白马之围？', ifNotLord: ['guanyu'] },
        { who: 'caocao', text: '云长，可愿随我解白马之围？', ifLord: ['guanyu'] },
        { who: 'dianwei', text: '主公放心，中军有某守着。', ifFlag: 'dianwei=saved' },
        { who: 'guanyu', text: '某受曹公厚待，正要立功报效，然后辞去。' },
        { tip: true, text: '颜良突进前，地上会拉出一条直道，侧移闪开；他抡刀回旋时往外跑——二阶段会转两圈，先内圈、后外圈。' },
      ] },
      bossIntro: { id: 'guandu-1.bossIntro', type: 'bossIntro', lines: [{ who: 'yanliang', text: '河北颜良在此，谁敢一战！' }] },
      bossPhase: { id: 'guandu-1.bossPhase', type: 'bossPhase', lines: [{ who: 'yanliang', text: '坠马又如何？河北上将，步战一样斩你！' }] },
      bossFall: { id: 'guandu-1.bossFall', type: 'bossFall', lines: [
        { who: 'yanliang', text: '来将……何时到了我面前……', ifNotFollower: 'guanyu' },
        { who: 'guanyu', text: '颜良，插标卖首耳！', ifFollower: 'guanyu' },
      ], banner: { title: '斩颜良', caption: '万军之中 · 刺颜良于马下', ifFollower: 'guanyu', flag: 'yanliang_by_guanyu' } },
      after: [{ id: 'guandu-1.after', type: 'interlude', kicker: '幕间', title: '云长神人', lines: [
        { who: 'caocao', text: '云长真神人也！' },
        { who: 'guanyu', text: '某何足道哉！吾弟张翼德于百万军中取上将之首，如探囊取物。' },
        { who: 'caocao', text: '（回顾左右）今后遇张翼德，不可轻敌。' },
      ] }],
    },
    2: {
      brief: { id: 'guandu-2.brief', type: 'stageBrief', kicker: '4-2 · 军情', title: '延津诱敌', lines: [
        { who: 'scout', text: '文丑引五六千骑渡河追来，要为颜良报仇！' },
        { who: 'xunyou', text: '丞相把辎重散在道上——此所以饵敌，何去之？' },
        { who: 'caocao', text: '（笑）诸军听令：等袁军下马争抢辎重，再一齐杀出。' },
        { tip: true, text: '文丑会假退一步再回马一枪，别追着他打；他会冲去抢道上的辎重回血——先把辎重烧掉。' },
      ] },
      bossIntro: { id: 'guandu-2.bossIntro', type: 'bossIntro', lines: [{ who: 'wenchou', text: '颜良兄弟的仇，拿你们的头来祭！' }] },
      bossPhase: { id: 'guandu-2.bossPhase', type: 'bossPhase', lines: [{ who: 'wenchou', text: '马没了，枪还在！' }] },
      bossFall: { id: 'guandu-2.bossFall', type: 'bossFall', lines: [
        { who: 'wenchou', text: '颜良兄弟……我来了……', ifNotFollower: 'guanyu' },
        { who: 'guanyu', text: '文丑，可识得关某？', ifFollower: 'guanyu' },
      ], banner: { title: '诛文丑', caption: '延津道上 · 一合斩之', ifFollower: 'guanyu', flag: 'wenchou_by_guanyu' } },
      after: [{ id: 'guandu-2.after', type: 'interlude', kicker: '幕间', title: '官渡相持', lines: [
        { text: '河北名将颜良、文丑相继授首，袁军夺气。两军相持于官渡，转眼数月。' },
        { who: 'yuanshao', text: '（帐中拍案）我有十万之众，岂惧曹阿瞒一隅之兵！' },
      ] }],
    },
    3: {
      before: [{ id: 'guandu-3.xuyou', type: 'interlude', cutscene: 'xuyou_yeben', kicker: '过场', title: '许攸夜奔', illustration: 'story_xuyou', lines: [
        { text: '袁绍谋士许攸献计不被采纳，家人又犯法下狱。' },
        { who: 'xuyou', text: '袁本初不用我计——我自去投孟德！' },
        { who: 'qinbing', text: '丞相，袁营许攸求见！' },
        { text: '曹操闻报，赤足出帐相迎。' },
        { who: 'caocao', text: '子远远来，吾事济矣！' },
        { who: 'xuyou', text: '袁军粮草万余车，尽屯乌巢。守将淳于琼嗜酒无备——烧了它，袁军不战自乱。' },
        { who: 'caocao', text: '传令——今夜奔袭乌巢！' },
      ] }],
      brief: { id: 'guandu-3.brief', type: 'stageBrief', kicker: '4-3 · 军情', title: '乌巢焚粮', lines: [
        { who: 'scout', text: '乌巢粮仓三座，守将淳于琼——听说正在帐中饮酒！' },
        { who: 'caocao', text: '传令：人衔枚，马缚口，打袁军旗号——今夜烧尽乌巢！' },
        { who: 'dianwei', text: '主公亲往乌巢，某护在马前！', ifFlag: 'dianwei=saved' },
        { tip: true, text: '三座粮仓每烧一座，淳于琼就少一层减伤，还会军心动摇、僵住一下。先烧粮仓再打他；霹雳车投石落点有预警圈。' },
      ] },
      bossIntro: { id: 'guandu-3.bossIntro', type: 'bossIntro', lines: [{ who: 'chunyuqiong', text: '谁在营外喧哗？……酒还没喝完！' }] },
      bossPhase: { id: 'guandu-3.bossPhase', type: 'bossPhase', lines: [{ who: 'chunyuqiong', text: '守住粮仓！谁敢退，我斩谁！' }] },
      bossFall: { id: 'guandu-3.bossFall', type: 'bossFall', lines: [{ who: 'chunyuqiong', text: '袁公……琼误了大事……' }] },
    },
  },
  close: {
    id: 'guandu.close', type: 'chapterClose', kicker: '第四章 · 官渡之战 · 终', title: '乌巢火起', illustration: 'story_wuchao', lines: [
      ...CLOSE_HEAD,
      { text: '当夜，河北来信：刘备已离袁营，往汝南去了。' },
      { who: 'guanyu', text: '兄长有了下落！{lord}，收拾行装，护二位嫂嫂启程！' },
    ],
    variants: {
      liubei: [...CLOSE_HEAD, { text: '当夜，乌巢大火映红半边天。曹营上下忙于追击，无人看守。' }, { who: 'guanyu', text: '大哥，就是今夜！' }, { who: '{lord}', text: '好——护着两位夫人，走！' }],
      guanyu: [...CLOSE_HEAD, { text: '当夜，河北来信：刘备已离袁营，往汝南去了。' }, { who: '{lord}', text: '兄长有了下落！收拾行装，护二位嫂嫂启程！' }],
    },
  },
  closeAfter: [{ id: 'guandu.danqi', type: 'interlude', cutscene: 'qianli_danqi', kicker: '过场', title: '千里走单骑', illustration: 'story_danqi',
    lines: [
      ...DANQI_HEAD,
      { who: 'zhangfei', text: '你既降了曹操，还来作甚！' },
      { text: '远处尘头大起，追兵旗号「蔡」。' },
      { who: 'zhangfei', text: '还说不是来拿俺的？' },
      { who: 'zhangfei', text: '俺擂鼓三通，你斩了来将，俺便信你！' },
      { text: '鼓未一通，关羽一刀，蔡阳落马。' },
      { who: 'zhangfei', text: '二哥，俺错怪你了！' },
      ...DANQI_TAIL,
    ],
    variants: {
      zhangfei: [
        ...DANQI_HEAD,
        { text: '蔡阳追兵赶到。' },
        { who: '{lord}', text: '二哥，咱俩一起砍了他！' },
        { text: '关羽、{lord}并马斩蔡阳。' },
        ...DANQI_TAIL,
      ],
      liubei: [
        ...DANQI_HEAD,
        { who: 'zhangfei', text: '大哥！二哥！你们……真从曹营出来了？那曹贼怎么肯放？' },
        { text: '远处尘头大起，追兵旗号「蔡」。' },
        { who: 'zhangfei', text: '还说不是来拿俺的？' },
        { who: 'zhangfei', text: '俺擂鼓三通，你斩了来将，俺便信你！' },
        { text: '鼓未一通，关羽一刀，蔡阳落马。' },
        { who: 'zhangfei', text: '二哥，俺错怪你了！' },
        ...DANQI_TAIL,
      ],
    },
  }],
  camp: [
    { id: 'guandu.camp1', type: 'campTalk', lines: [{ who: 'guanyu', text: '曹公赠金赠袍，某一概封存。', ifFollower: 'guanyu' }, { who: 'guanyu', text: '身在曹营，心在汉。', ifFollower: 'guanyu' }] },
    { id: 'guandu.camp2', type: 'campTalk', lines: [{ who: 'zhangliao', text: '云长若得知玄德下落，真的会走？' }, { who: 'guanyu', text: '文远，某既许了三约，自当守约——也当报了曹公再走。' }] },
    { id: 'guandu.camp3', type: 'campTalk', lines: [{ who: 'xuchu', text: '你们那位关将军，丞相给他什么都不要，怪人！' }, { who: '{lord}', text: '不是怪，是义。' }] },
    { id: 'guandu.camp4', type: 'campTalk', lines: [{ who: '{lord}', text: '（摩挲玉玺）', ifFlag: 'jade_seal=kept' }, { who: '{lord}', text: '程昱那几个人，近来看我的眼神不对……', ifFlag: 'jade_seal=kept' }] },
    { id: 'guandu.camp5', type: 'campTalk', lines: [{ who: 'dianwei', text: '{lord}，宛城那夜的恩情，某记着。', ifFlag: 'dianwei=saved' }, { who: 'dianwei', text: '打完袁绍，咱俩喝一坛！', ifFlag: 'dianwei=saved' }] },
    { id: 'guandu.camp6', type: 'campTalk', lines: [
      { who: '{lord}', text: '江东来信……兄长伯符遇刺身亡，二兄仲谋继位。', ifLord: ['sunshangxiang'], ifFlag: 'cleared_guandu_1' },
      { who: '{lord}', text: '……我不哭，仗还要打。', ifLord: ['sunshangxiang'], ifFlag: 'cleared_guandu_1' },
    ] },
    { id: 'guandu.camp7', type: 'campTalk', lines: [{ who: 'zhaoyun', text: '云在河北打听到，玄德公在袁营并不得志。', ifFollower: 'zhaoyun' }, { who: '{lord}', text: '早晚要去寻他。', ifFollower: 'zhaoyun' }] },
  ],
  bonds: [
    { id: 'bond.gucheng', name: '古城', members: ['guanyu', 'zhangfei'], critBonus: .05, lines: [
      { who: 'zhangfei', text: '二哥，这回俺给你擂鼓，三通鼓内杀个干净！' }, { tip: true, text: '羁绊「古城」：关羽、张飞同队，本关暴击率 +5%' },
    ] },
  ],
};
