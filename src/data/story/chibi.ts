/**
 * 第五章 · 赤壁之战 剧本（统筹 story-ch05.md，用户 2026-11-18 确认；8 条决定见剧本末节）。
 * 主线：三顾茅庐 → 长坂（赵云护幼主、张飞据水断桥）→ 借东风 → 火烧赤壁 → 华容道 → 江陵抉择。
 * 写旗标：caimao（5-2 招降，data/surrender.ts 的 flag）、qijin_qichu（5-1 赵云在队击杀虎豹骑 ≥ 77，systems/ChibiStoryHooks.ts）、nanjun（5-3 抉择）。
 * 过场第一批「借东风」「华容道」：过场系统接管前按字幕当卷轴播（cutscene id 已写好）；第二批「据水断桥」「长坂单骑」以后做，现在 5-1 幕间是卷轴。
 * 张飞断桥用正史原句「身是张益德也，可来共决死！」（用户定）。插画键见 data/story/art.ts（美术风格会话出图，到之前退回通用横幅）。
 */
import type { StoryChapter } from './types';

export const CHIBI_STORY: StoryChapter = {
  chapter: 'chibi',
  open: {
    id: 'chibi.open', type: 'chapterOpen', kicker: '第五章 · 赤壁之战', title: '三顾茅庐', illustration: 'story_longzhong',
    lines: [
      { text: '建安十二年，刘备屯兵新野。曹操囚徐庶之母于许都，徐庶不得不辞行北去。' },
      { who: 'xushu', text: '方寸已乱，不能再侍左右了。临行一言：隆中有卧龙，诸葛孔明。此人可就见，不可屈致——将军宜枉驾顾之。' },
      // 2026-11-19 武将解锁：诸葛亮第一章后就以「卧龙」书信来投（可玩），这里是正式出山拜军师
      { text: '黄巾之役后，卧龙以客卿之身随军多年，却始终不受一官半职。要请他正式出山，须亲往隆中。' },
      { text: '刘备三顾草庐。前两回不遇；第三回孔明昼寝，刘备拱立阶下，候了一个时辰。' },
      { who: 'zhangfei', text: '这村夫好大架子！待俺去屋后放一把火，看他起不起！', ifFollower: 'zhangfei' },
      { who: '{lord}', text: '（推了推孔明）皇叔第三回来了，你还装睡？', ifLord: ['huangyueying'] },
      { who: 'zhuge', text: '（醒）大梦谁先觉？平生我自知。' },
      { who: 'liubei', text: '汉室倾颓，奸臣窃命。先生不出，如苍生何！' },
      { who: 'zhuge', text: '曹操拥百万之众，挟天子以令诸侯，不可与争锋；孙权据有江东，已历三世，可与为援而不可图。荆州用武之国，益州天府之土——跨有荆、益，天下可定。' },
    ],
  },
  stages: {
    1: {
      brief: { id: 'chibi-1.brief', type: 'stageBrief', kicker: '5-1 · 军情', title: '长坂突围', lines: [
        { text: '刘表病逝，刘琮举荆州降曹。刘备南走江陵，十余万百姓扶老携幼相随，日行十余里。' },
        { who: '{lord}', text: '某在襄阳城上开门迎皇叔，蔡瑁不让进——那就杀出去，追随皇叔！', ifLord: ['weiyan'] },
        { who: 'scout', text: '曹纯率虎豹骑一日一夜追了三百里，已到长坂！' },
        { who: 'liubei', text: '百姓以我为依，我岂能弃之！——护住百姓，杀出去！' },
        { who: '{lord}', text: '主公先走，小主人和夫人交给云！', ifLord: ['zhaoyun'] },
        { tip: true, text: '曹纯的虎豹骑三骑并排冲锋，看清三条冲锋道再躲；他会盯着你连冲两次，第一下躲开别急着停。赵云在队时击杀虎豹骑 77 骑，可达成「七进七出」。' },
      ] },
      bossIntro: { id: 'chibi-1.bossIntro', type: 'bossIntro', lines: [{ who: 'caochun', text: '虎豹骑听令——一个也不许放过！' }] },
      bossPhase: { id: 'chibi-1.bossPhase', type: 'bossPhase', lines: [{ who: 'caochun', text: '下马！围起来，困死他！' }] },
      // 宁死不降：弹过招降窗后 Parley.dyingLine 播拒绝台词；这句是没弹窗时（剧情关闭等）的兜底
      bossFall: { id: 'chibi-1.bossFall', type: 'bossFall', lines: [{ who: 'caochun', text: '曹氏子弟，只有战死的，没有降的！' }] },
      after: [{ id: 'chibi-1.bridge', type: 'interlude', kicker: '幕间', title: '长坂桥', illustration: 'story_changban', lines: [
        { who: 'zhaoyun', text: '（解甲，怀中阿斗正睡）云虽肝脑涂地，不能报主公之恩。' },
        { who: 'liubei', text: '（接过阿斗，掷之于地）为汝这孺子，几损我一员大将！' },
        { text: '张飞领二十骑据水断桥，曹军追至。' },
        { who: 'zhangfei', text: '身是张益德也，可来共决死！' },
        { text: '声如巨雷，曹军无人敢前。' },
      ] }],
    },
    2: {
      before: [{ id: 'chibi-2.dongfeng', type: 'interlude', cutscene: 'jie_dongfeng', kicker: '过场', title: '借东风', illustration: 'story_dongfeng_4', lines: [
        { who: 'sunquan', text: '（拔剑斫案）诸将吏敢复有言当迎操者，与此案同！' },
        { text: '火攻之计已定，奈何隆冬时节，只有西北风。周瑜忧急成疾，卧病帐中。' },
        { who: 'zhuge', text: '（递上纸条）欲破曹公，宜用火攻；万事俱备，只欠东风。' },
        { text: '孔明筑七星坛于南屏山，祭风三日。坛上旗角，慢慢转向西北。' },
        { who: 'zhouyu', text: '（惊起出帐）此人有夺天地造化之法、鬼神不测之术！' },
        { who: 'huanggai', text: '降将黄盖，特来投降——点火！' },
      ] }],
      brief: { id: 'chibi-2.brief', type: 'stageBrief', kicker: '5-2 · 军情', title: '赤壁鏖兵', lines: [
        { who: '{lord}', text: '二兄仲谋拔剑斫案，说再言降曹者与此案同——今日这一仗，孙家的女儿也上！', ifLord: ['sunshangxiang'] },
        { who: 'zhouyu', text: '东南风已起！黄公覆，点火！' },
        { who: 'huanggai', text: '火船二十只，直冲曹营！' },
        { who: '{lord}', text: '曹操的战船首尾连环，是我劝他连起来的。这把火，烧得正好。', ifLord: ['pangtong'] },
        { tip: true, text: '东风起时，地上先亮橙色航道和风向箭头，2 秒后火船顺风冲过——把敌人引进航道里烧，火船不伤自己人。蔡瑁的楼船箭雨落点大，看到落点就出圈。' },
      ] },
      bossIntro: { id: 'chibi-2.bossIntro', type: 'bossIntro', lines: [{ who: 'caimao', text: '北人不习水战，有我荆州水军在，你们休想过江！' }] },
      bossPhase: { id: 'chibi-2.bossPhase', type: 'bossPhase', lines: [{ who: 'caimao', text: '船都连着……解不开！快砍铁索！' }] },
      // 斩杀时（招降结果写 caimao = slain，见 data/surrender.ts）
      bossFall: { id: 'chibi-2.bossFall', type: 'bossFall', lines: [{ who: 'caimao', text: '丞相……北军……完了……' }] },
      after: [{ id: 'chibi-2.huarong', type: 'interlude', cutscene: 'huarong_dao', kicker: '过场', title: '华容道', illustration: 'story_huarong_3', lines: [
        { text: '曹操败走华容道，道路泥泞，使羸兵负草填之，人马相践。' },
        { who: 'caocao', text: '（勒马大笑）人皆言周瑜、诸葛亮足智多谋，若使此处伏一旅之师，吾等皆束手受缚矣！' },
        { text: '一声炮响，关羽横刀立马，身后五百校刀手。' },
        { who: 'caocao', text: '将军别来无恙！……将军五关斩将之时，还能记否？' },
        { who: 'guanyu', text: '（垂目良久，把马头一勒）……散开！' },
        { text: '关羽义释曹操，回营自缚请罪。军师念其旧义，许他戴罪立功。' },
      ] }],
    },
    3: {
      brief: { id: 'chibi-3.brief', type: 'stageBrief', kicker: '5-3 · 军情', title: '江陵夺城', lines: [
        { text: '曹操北还，留曹仁守江陵。周瑜与之相持经年，身中流矢。' },
        { who: 'zhuge', text: '曹仁善守，摆的是八门金锁阵。' },
        { who: '{lord}', text: '当年元直教过——从生门入，阵自破。' },
        { tip: true, text: '八门金锁：一个生门（绿）、三个死门（红），每 10 秒换一轮，换之前会闪。站死门掉血，站生门打曹仁伤害 +20%。他举盾时绕到背后打。' },
      ], variants: {
        zhuge: [
          { text: '曹操北还，留曹仁守江陵。周瑜与之相持经年，身中流矢。' },
          { who: '{lord}', text: '曹仁善守，摆的是八门金锁阵。' },
          { who: 'liubei', text: '当年元直教过——从生门入，阵自破。' },
          { tip: true, text: '八门金锁：一个生门（绿）、三个死门（红），每 10 秒换一轮，换之前会闪。站死门掉血，站生门打曹仁伤害 +20%。他举盾时绕到背后打。' },
        ],
      } },
      bossIntro: { id: 'chibi-3.bossIntro', type: 'bossIntro', lines: [{ who: 'caoren', text: '此城有我曹子孝，尔等休想踏进一步！' }] },
      // 二阶段台词已在曹仁控制器里（「此阵何人可破！」）；退兵台词在招降表 retreat（败退型）
      choice: { id: 'chibi-3.nanjun', type: 'choice', kicker: '抉择', title: '江陵城下', lines: [
        { text: '曹仁弃城而走。城门大开，周瑜的大军还在三十里外。' },
      ], choices: [
        // 第一个是「跳过 / 剧情关闭」时的默认（史实）分支
        { label: '按兵候周郎', flag: 'nanjun', value: 'ceded', reward: { merit: 150 }, reply: [{ who: 'zhuge', text: '江陵让与周郎；我等南取四郡，荆州自有借处。' }] },
        { label: '趁虚入城', flag: 'nanjun', value: 'seized', reward: { grain: 300 }, reply: [{ who: 'zhaoyun', text: '某奉军师将令，先取城了！' }] },
      ] },
    },
  },
  close: {
    id: 'chibi.close', type: 'chapterClose', kicker: '第五章 · 赤壁之战 · 终', title: '江陵易帜', illustration: 'story_jiangling_ceded',
    illustrationIf: [{ cond: 'nanjun=seized', key: 'story_jiangling_seized' }],
    lines: [
      // nanjun = seized（演义：一气周瑜）
      { text: '周瑜引兵赶到城下，却见城头已插满刘字旗。', ifFlag: 'nanjun=seized' },
      { who: 'zhaoyun', text: '（城头）某奉军师将令，已取城了！', ifFlag: 'nanjun=seized' },
      { who: 'zhouyu', text: '（大叫一声，金疮迸裂，坠于马下）', ifFlag: 'nanjun=seized' },
      { text: '刘备遂据江陵，南望长沙、桂阳、零陵、武陵四郡。', ifFlag: 'nanjun=seized' },
      // nanjun = ceded（史实；没做抉择时也走这里）
      { text: '周瑜入江陵，领南郡太守。刘备表刘琦为荆州刺史，屯兵油江口，改名公安。', ifFlag: '!nanjun=seized' },
      { who: 'lusu', text: '皇叔南取四郡，我主自当相助。只是这荆州……日后还须商议。', ifFlag: '!nanjun=seized' },
      { text: '南望长沙、桂阳、零陵、武陵四郡。', ifFlag: '!nanjun=seized' },
      { who: '{lord}', text: '周公瑾气成这样……回了江东，二兄怕是要找皇叔讨荆州了。', ifLord: ['sunshangxiang'], ifFlag: 'nanjun=seized' },
      { who: '{lord}', text: '周公瑾得了江陵，二兄却要说是借给皇叔的……回了江东，二兄怕是要找皇叔讨荆州了。', ifLord: ['sunshangxiang'], ifFlag: '!nanjun=seized' },
    ],
  },
  camp: [
    { id: 'chibi.camp1', type: 'campTalk', lines: [
      { who: 'zhangfei', text: '一个村夫，大哥三请才来，俺不服！', ifFollowers: ['zhangfei', 'zhuge'] },
      { who: 'zhuge', text: '翼德将军，博望坡那一把火，可还服？', ifFollowers: ['zhangfei', 'zhuge'] },
      { who: 'zhangfei', text: '……服了。', ifFollowers: ['zhangfei', 'zhuge'] },
    ] },
    { id: 'chibi.camp2', type: 'campTalk', lines: [
      { who: 'zhaoyun', text: '阿斗在我怀里，睡得比在营里还沉。', ifFollower: 'zhaoyun', ifFlag: 'cleared_chibi_1' },
      { who: 'liubei', text: '子龙之功，备没齿难忘。', ifFollower: 'zhaoyun', ifFlag: 'cleared_chibi_1' },
    ] },
    { id: 'chibi.camp3', type: 'campTalk', lines: [
      { who: '{lord}', text: '元直先生走了。他说此去终身不为曹操设一谋。', ifNotLord: ['liubei'] },
      { who: 'liubei', text: '元直……', ifNotLord: ['liubei'] },
    ] },
    { id: 'chibi.camp4', type: 'campTalk', lines: [
      { who: 'pangtong', text: '连环计？那是我送曹操的一份大礼。', ifFollower: 'pangtong', ifNotLord: ['pangtong'] },
      { who: '{lord}', text: '好一份大礼——八十万大军，一把火烧了个干净。', ifFollower: 'pangtong', ifNotLord: ['pangtong'] },
    ] },
    { id: 'chibi.camp5', type: 'campTalk', lines: [
      { who: 'huangyueying', text: '借东风那三天，你夜夜不睡，就是在看星象吧？', ifFollowers: ['huangyueying', 'zhuge'] },
      { who: 'zhuge', text: '知我者，夫人也。', ifFollowers: ['huangyueying', 'zhuge'] },
    ] },
    { id: 'chibi.camp6', type: 'campTalk', lines: [
      { who: 'sunshangxiang', text: '周公瑾这人，心气太高，迟早要被自己气坏。', ifFollower: 'sunshangxiang', ifNotLord: ['sunshangxiang'] },
      { who: '{lord}', text: '这话可别让公瑾听见。', ifFollower: 'sunshangxiang', ifNotLord: ['sunshangxiang'] },
    ] },
    { id: 'chibi.camp7', type: 'campTalk', lines: [
      { who: 'guanyu', text: '某放了曹操……军令状在此，任凭军师发落。', ifFollower: 'guanyu', ifFlag: 'cleared_chibi_2', ifNotLord: ['guanyu'] },
      { who: '{lord}', text: '云长重义，军师心里有数。', ifFollower: 'guanyu', ifFlag: 'cleared_chibi_2', ifNotLord: ['guanyu'] },
    ] },
    { id: 'chibi.camp8', type: 'campTalk', lines: [
      { who: '{lord}', text: '蔡德珪降过两回了。', ifFlag: 'caimao=joined' },
      { who: 'zhuge', text: '识时务者为俊杰。只是水军，还得用他。', ifFlag: 'caimao=joined' },
    ] },
  ],
  bonds: [
    { id: 'bond.wolong_fengchu', name: '卧龙凤雏', members: ['zhuge', 'pangtong'], cooldownMul: .95, lines: [
      { who: 'pangtong', text: '卧龙、凤雏，得一可安天下——今日两个都在！' }, { tip: true, text: '羁绊「卧龙凤雏」：诸葛亮、庞统同队，本关两人技能冷却 -5%' },
    ] },
  ],
  barks: [
    // 七进七出（systems/ChibiStoryHooks.ts 达成时调用）
    { id: 'chibi-1.qijin', type: 'bark', external: true, lines: [{ who: 'zhaoyun', text: '常山赵子龙在此！' }] },
  ],
};
