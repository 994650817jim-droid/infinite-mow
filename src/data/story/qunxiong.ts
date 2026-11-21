/**
 * 第三章 · 群雄割据 剧本（统筹 story-ch03.md，用户 2026-11-17 批准）。
 * 章 id 用篇章 qunxiong（第三章关卡场景 ThirdGameScene 按 cfg.arc 建剧情导演）。
 * 两段过场「辕门射戟」「煮酒论英雄」：过场系统做好之前按字幕当卷轴播（node.cutscene 记过场 id，之后由过场系统接管）。
 * 插画（story_changan_fall / story_xuzhou_bed / story_baimen / story_yuanmen / story_zhujiu）还没有，先退回通用横幅（占位）。
 */
import type { StoryChapter } from './types';

export const QUNXIONG_STORY: StoryChapter = {
  chapter: 'qunxiong',
  open: {
    id: 'qunxiong.open', type: 'chapterOpen', kicker: '第三章 · 群雄割据', title: '长安之乱', illustration: 'story_changan_fall',
    lines: [
      { text: '初平三年，董卓伏诛。其部将李傕、郭汜收拢西凉残兵，欲各自逃散。' },
      { who: 'jiaxu', text: '诸君若弃众独行，一亭长便能缚君。不如率众西向，攻长安，为董公报仇！' },
      { text: '西凉兵十余万围长安，八日城破。司徒王允殉国，吕布引百骑出武关。' },
      { who: 'lubu', text: '城守不住了！{lord}，各自杀出去，后会有期！' },
      { who: '{lord}', text: '传令——护住百姓，向东突围！' },
    ],
    variants: {
      diaochan: [
        { text: '初平三年，董卓伏诛。其部将李傕、郭汜收拢西凉残兵，欲各自逃散。' },
        { who: 'jiaxu', text: '诸君若弃众独行，一亭长便能缚君。不如率众西向，攻长安，为董公报仇！' },
        { text: '西凉兵十余万围长安，八日城破。司徒王允立于青琐门上，不肯独走。' },
        { who: 'wangyun', text: '蝉儿，快走！为父受国恩，当以身殉之。' },
        { who: 'lubu', text: '貂蝉，上马！随我出武关！' },
        { who: '{lord}', text: '奉先，东门的百姓无人护——你走你的，我断后。' },
      ],
    },
  },
  stages: {
    1: {
      brief: { id: 'qunxiong-1.brief', type: 'stageBrief', kicker: '3-1 · 军情', title: '长安突围', lines: [
        { who: 'scout', text: '李傕、郭汜纵兵大掠，西凉铁骑封住了东门大道！' },
        { who: '{lord}', text: '撕开一个口子，让百姓先走。' },
        { tip: true, text: '李傕骑马冲锋前会拉出冲锋道，侧移闪开。打落他的马后他会叫来西凉亲兵——亲兵在，他挨打不痛，先砍亲兵。' },
      ], variants: { machao: [
        { who: 'scout', text: '李傕、郭汜纵兵大掠，西凉铁骑封住了东门大道！' },
        { who: '{lord}', text: '西凉骑兵？我马家的骑法，比他们正。撕开一个口子，让百姓先走！' },
        { tip: true, text: '李傕骑马冲锋前会拉出冲锋道，侧移闪开。打落他的马后他会叫来西凉亲兵——亲兵在，他挨打不痛，先砍亲兵。' },
      ] } },
      bossIntro: { id: 'qunxiong-1.bossIntro', type: 'bossIntro', lines: [{ who: 'lijue', text: '董公之仇，今日拿长安来抵！' }],
        variants: { machao: [{ who: 'lijue', text: '马腾家的小儿？你爹都不敢进长安！' }] } },
      bossPhase: { id: 'qunxiong-1.bossPhase', type: 'bossPhase', lines: [{ who: 'lijue', text: '我的马——亲兵，给我围上来！' }] },
      bossFall: { id: 'qunxiong-1.bossFall', type: 'bossFall', lines: [{ who: 'lijue', text: '郭汜……你为何不来救我……' }] },
      after: [{ id: 'qunxiong-1.xuzhou', type: 'interlude', kicker: '幕间', title: '徐州三让', illustration: 'story_xuzhou_bed', lines: [
        { text: '突围东归。兴平元年，徐州牧陶谦病笃，请刘备入府。' },
        { who: 'taoqian', text: '（以手抚胸）非刘玄德，不能安此州也……' },
        { who: 'liubei', text: '备何德何能，敢受此托——' },
        { who: 'guanyu', text: '陶公三让，大哥若再推辞，反失徐州百姓之心。' },
        { text: '刘备遂领徐州。' },
        { who: '{lord}', text: '吕布也往东去了……但愿他别来徐州。', ifLord: ['diaochan'] },
      ] }],
    },
    2: {
      before: [
        { id: 'qunxiong-2.yuanmen', type: 'interlude', cutscene: 'yuanmen_sheji', kicker: '过场', title: '辕门射戟', illustration: 'story_yuanmen', lines: [
          { text: '建安元年，袁术遣纪灵领兵三万攻小沛。吕布请两家入营赴宴。' },
          { who: 'lubu', text: '我平生不好斗，只好解斗。' },
          { who: 'lubu', text: '辕门离此一百五十步。我一箭射中戟上小枝，两家罢兵；射不中，各回营厮杀。' },
          { who: 'jiling', text: '一百五十步？神仙也射不中。' },
          { who: 'zhangfei', text: '哼，看他射！', ifFollower: 'zhangfei' },
          { text: '弓弦一响——正中画戟小枝。两军哗然。' },
          { who: 'lubu', text: '此天令你两家罢兵也！' },
          { text: '纪灵收兵而去。' },
          { who: 'liubei', text: '温侯神射。' },
        ] },
        { id: 'qunxiong-2.toucao', type: 'interlude', kicker: '幕间', title: '投奔许都', lines: [
          { text: '一箭罢兵。然吕布反复无常，不久又袭取小沛。刘备兵败，往许都投奔曹操。' },
          { who: 'zhangfei', text: '都怪俺贪杯误事，丢了下邳……这回俺一滴酒不沾！', ifFollower: 'zhangfei' },
          { who: 'caocao', text: '玄德来得正好。张绣据宛城，降而复叛——随我去收拾他。' },
        ] },
      ],
      brief: { id: 'qunxiong-2.brief', type: 'stageBrief', kicker: '3-2 · 军情', title: '宛城夜袭', lines: [
        { who: 'scout', text: '张绣夜袭曹营！营中火起，曹公中军危急！' },
        { who: 'dianwei', text: '（营门前）主公快走！有某在此，一个也过不去！' },
        { who: '{lord}', text: '宛城往南不远，便是南阳卧龙岗……今夜却要在这里厮杀。', ifLord: ['zhuge'] },
        { who: '{lord}', text: '张绣与刘荆州结盟。某昔在荆州为将，今日各为其主了。', ifLord: ['huangzhong'] },
        { who: '{lord}', text: '某是义阳人，宛城一带的巷子，闭着眼都认得。', ifLord: ['weiyan'] },
        { tip: true, text: '张绣会隐进夜色，再从你身边现身突刺——他身影一淡就马上走动，别站着。' },
        { tip: true, text: '典韦守着后营寨门，别让敌兵把他围死。' },
      ] },
      bossIntro: { id: 'qunxiong-2.bossIntro', type: 'bossIntro', lines: [{ who: 'zhangxiu', text: '曹贼欺我太甚，今夜便取他首级！' }] },
      bossPhase: { id: 'qunxiong-2.bossPhase', type: 'bossPhase', lines: [{ who: 'zhangxiu', text: '北地枪王，岂止马上功夫！' }] },
      bossFall: { id: 'qunxiong-2.bossFall', type: 'bossFall', lines: [{ who: 'zhangxiu', text: '文和先生……撤兵！' }] },
      after: [{ id: 'qunxiong-2.dianwei', type: 'interlude', kicker: '幕间', title: '古之恶来', lines: [
        { who: 'dianwei', text: '（拄双戟大笑）哈！某这双戟，还没砍够！', ifFlag: 'dianwei=saved' },
        { who: 'caocao', text: '{lord}救我恶来，此恩操记下了。', ifFlag: 'dianwei=saved' },
        // 没救下：不写战死（典韦是第二批可玩武将，曹魏支线曹操归附时伤愈随来，没有永久错过——同黄忠「负伤遁去」）
        { text: '典韦独守营门，身被数十创，力尽倒地。曹军拼死将他抢回，生死未卜。', ifFlag: '!dianwei=saved' },
        { who: 'caocao', text: '吾折长子、爱侄，俱无深痛；恶来若有不测，操何以自处！', ifFlag: '!dianwei=saved' },
      ] }],
    },
    3: {
      brief: { id: 'qunxiong-3.brief', type: 'stageBrief', kicker: '3-3 · 军情', title: '寿春讨逆', lines: [
        { text: '建安二年，袁术在寿春称帝，国号「仲家」。' },
        { who: 'caocao', text: '天子尚在许都，袁公路竟敢僭号——天下共击之！' },
        { who: '{lord}', text: '兄长伯符已修书与袁术绝交。今日这一仗，我替孙家打。', ifLord: ['sunshangxiang'] },
        { tip: true, text: '袁术举起玉玺会立起「伪诏」旗，旗在就不断召兵——先砍旗。亲军围着他时打不痛，先清亲军。他剩三成血会逃跑，25 秒内追上。' },
      ] },
      bossIntro: { id: 'qunxiong-3.bossIntro', type: 'bossIntro', lines: [{ who: 'yuanshu', text: '代汉者，当涂高——朕乃仲家天子，尔等还不跪下！' }] },
      // 二阶段「拿蜜水来！」已由袁术控制器自己播，这里不另写
      bossFall: { id: 'qunxiong-3.bossFall', type: 'bossFall', lines: [{ who: 'yuanshu', text: '朕的玉玺……朕的江山……' }] },
      choice: { id: 'qunxiong-3.jade', type: 'choice', kicker: '抉择', title: '传国玉玺', lines: [
        { text: '乱军中拾得一方玉玺，上刻「受命于天，既寿永昌」。' },
      ], choices: [
        { label: '送还许都', flag: 'jade_seal', value: 'returned', reward: { merit: 150 }, reply: [{ who: 'caocao', text: '{lord}忠义可嘉，当表奏天子。' }] },
        { label: '暂且收下', flag: 'jade_seal', value: 'kept', reward: { grain: 300 }, reply: [{ who: '{lord}', text: '此物……先由我保管。' }] },
      ] },
    },
  },
  close: {
    id: 'qunxiong.close', type: 'chapterClose', kicker: '第三章 · 群雄割据 · 终', title: '白门楼', illustration: 'story_baimen', lines: [
      { text: '寿春城破，袁术北走。次年，曹操、刘备合围下邳，吕布困守白门楼，被缚。' },
      { who: 'lubu', text: '明公所患不过于布，今已服矣。令布将骑、明公将步，天下不足定也！' },
      { who: 'liubei', text: '明公不见丁建阳、董太师之事乎？' },
      { who: 'lubu', text: '大耳儿！最叵信者，便是你！' },
      { who: 'lubu', text: '貂蝉……你也来看我死么？', ifLord: ['diaochan'] },
      { who: '{lord}', text: '奉先，辕门那一箭，我记得。', ifLord: ['diaochan'] },
      { who: 'zhangfei', text: '三姓家奴，早该有今日！', ifFollower: 'zhangfei' },
      { text: '吕布殒命白门楼。' },
      { who: 'diaochan', text: '（低头，许久不语）', ifFollower: 'diaochan', ifNotLord: ['diaochan'] },
    ],
  },
  closeAfter: [
    { id: 'qunxiong.zhujiu', type: 'interlude', cutscene: 'zhujiu_lun_yingxiong', kicker: '过场', title: '煮酒论英雄', illustration: 'story_zhujiu', lines: [
      { text: '刘备寄身许都，闭门种菜，以为韬晦。一日，曹操邀他后园小亭，青梅煮酒。' },
      { who: 'caocao', text: '玄德久历四方，必知当世英雄。请试言之。' },
      { who: 'liubei', text: '淮南袁术，兵粮足备？' },
      { who: 'caocao', text: '冢中枯骨，吾早晚必擒之。' },
      { who: 'liubei', text: '河北袁绍，四世三公？' },
      { who: 'caocao', text: '色厉胆薄，好谋无断。' },
      { who: 'caocao', text: '今天下英雄，惟使君与操耳！' },
      { text: '刘备手中筷子落地。天边一声炸雷。' },
      { who: 'liubei', text: '一震之威，乃至于此。' },
      { who: 'caocao', text: '丈夫亦畏雷乎？' },
      { who: 'liubei', text: '圣人迅雷风烈必变，安得不畏？' },
      { text: '未几，刘备借截击袁术之名，引兵出许都。袁术北走无路，求一碗蜜水不得，呕血而亡。' },
      { who: 'liubei', text: '吾乃笼中鸟、网中鱼。此一行，如鱼入大海、鸟上青霄！' },
    ] },
  ],
  camp: [
    { id: 'qunxiong.camp1', type: 'campTalk', lines: [
      { who: 'zhangfei', text: '二哥，徐州那回……真不怪俺一个人。', ifFollower: 'zhangfei' },
      { who: 'guanyu', text: '嗯。往后军中禁酒。', ifFollower: 'zhangfei' },
      { who: 'zhangfei', text: '禁……禁多久？', ifFollower: 'zhangfei' },
    ] },
    { id: 'qunxiong.camp2', type: 'campTalk', lines: [{ who: 'mizhu', text: '下邳虽失，糜家尚有僮客两千、金银若干，尽献军中。' }, { who: 'liubei', text: '子仲高义，全军记下了。' }] },
    { id: 'qunxiong.camp3', type: 'campTalk', lines: [{ who: 'diaochan', text: '吕布射戟那一箭，倒是真心想罢兵。', ifFollower: 'diaochan' }, { who: 'diaochan', text: '可惜他的真心，从来留不长。', ifFollower: 'diaochan' }] },
    { id: 'qunxiong.camp4', type: 'campTalk', lines: [{ who: 'zhaoyun', text: '公孙将军那边战事吃紧……云还是想跟着玄德公。', ifFollower: 'zhaoyun' }, { who: 'liubei', text: '子龙，来日方长。', ifFollower: 'zhaoyun' }] },
    { id: 'qunxiong.camp5', type: 'campTalk', lines: [
      { who: 'jianyong', text: '听说袁术在寿春称帝了，国号「仲」。' },
      { who: 'zhangfei', text: '他也配？', ifFollower: 'zhangfei' },
      { who: '{lord}', text: '跳梁小丑，不足为虑。', ifNotFollower: 'zhangfei' },
    ] },
    { id: 'qunxiong.camp6', type: 'campTalk', lines: [{ who: 'zhuge', text: '宛城一战，贾文和以一城之兵败曹公。', ifFollower: 'zhuge', ifFlag: 'dianwei' }, { who: 'zhuge', text: '此人之谋，不可小觑。', ifFollower: 'zhuge', ifFlag: 'dianwei' }] },
  ],
  bonds: [
    { id: 'bond.jiejiang', name: '借将', members: ['liubei', 'zhaoyun'], speedMul: 1.06, lines: [
      { who: 'zhaoyun', text: '公孙将军许我暂随玄德公。此战，云为先锋！' }, { tip: true, text: '羁绊「借将」：刘备、赵云同队，本关移速 +6%' },
    ] },
  ],
  // 3-2 宛城夜袭 · 典韦守营（systems/DianweiGuard.ts 按时机调 story.line(id)；数值 / id 见 data/dianweiGuard.ts）。用户 11-19「也要增加剧情台词」
  barks: [
    { id: 'qunxiong-2.dw_start', type: 'bark', external: true, lines: [{ who: 'dianwei', text: '营门在此，某也在此——哪个敢近一步！' }] },
    { id: 'qunxiong-2.dw_cao', type: 'bark', external: true, lines: [{ who: 'caocao', text: '典韦！替孤守住营门！' }] },
    { id: 'qunxiong-2.dw_hp50', type: 'bark', external: true, lines: [{ who: 'dianwei', text: '这点伤，算个甚！' }] },
    { id: 'qunxiong-2.dw_hp20', type: 'bark', external: true, lines: [{ who: 'dianwei', text: '双戟尚在，营门便在！' }] },
    { id: 'qunxiong-2.dw_help', type: 'bark', external: true, lines: [{ who: 'dianwei', text: '好！{lord}来得正好！' }] },
    { id: 'qunxiong-2.dw_whirl', type: 'bark', external: true, lines: [{ who: 'dianwei', text: '都给某滚开！' }] },
    { id: 'qunxiong-2.dw_throw', type: 'bark', external: true, lines: [{ who: 'dianwei', text: '着！' }] },
    { id: 'qunxiong-2.dw_rage', type: 'bark', external: true, lines: [{ who: 'dianwei', text: '恶来在此——今夜死战！' }] },
    { id: 'qunxiong-2.dw_saved', type: 'bark', external: true, lines: [{ who: 'dianwei', text: '营门还在！张绣小儿，便宜你了！' }] },
    { id: 'qunxiong-2.dw_fall', type: 'bark', external: true, lines: [{ who: 'dianwei', text: '主公……快走……' }] },
  ],
};
