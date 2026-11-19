/**
 * 第六章 · 平定荆南 剧本（统筹 story-ch06.md，用户 2026-11-18 确认）。
 * 读第五章旗标 nanjun（章头两种写法，没做抉择按 ceded）。写旗标：zhaofan / liudu / spared_huangzhong（招降结果，data/surrender.ts 的 flag）、
 * weiyan_trust（6-3 章末抉择，只写旗标不给数值；魏延是主公时不问，固定 trusted）。
 * 6-3 先黄忠后韩玄：按当前首领 id 取台词（bossIntros / bossPhases / bossFalls，JingnanGameScene.storyBossId）。
 * 主公是黄忠时第一阶段首领改为韩玄部将杨龄（只换名字与台词，不弹招降窗）。不采用演义「张飞取武陵」（用户定）。
 * 过场第一批「赵云辞樊氏」「魏延献城」按卷轴播（cutscene id 已写好）；原来 JingnanGameScene 的章末卷轴并进本剧本。
 */
import type { StoryChapter } from './types';

const CHANGSHA_TIP = '黄忠的「百步穿杨」会先瞄准再放箭——看到瞄准线就横移；「连珠箭阵」三连发，别贴着走直线。';

export const JINGNAN_STORY: StoryChapter = {
  chapter: 'jingnan',
  open: {
    id: 'jingnan.open', type: 'chapterOpen', kicker: '第六章 · 平定荆南', title: '南取四郡', illustration: 'story_gongan',
    lines: [
      // nanjun = seized（第五章趁虚入城）
      { text: '赵云抢先入了江陵，周瑜金疮迸裂，卧床不起。', ifFlag: 'nanjun=seized' },
      { who: 'lusu', text: '皇叔！江东折了多少兵马，到头来城池却归了皇叔——这荆州，总得给个说法！', ifFlag: 'nanjun=seized' },
      // nanjun = ceded / 没做抉择（史实）
      { text: '赤壁之后，周瑜得江陵。刘备表刘琦为荆州刺史，屯兵公安。', ifFlag: '!nanjun=seized' },
      { who: 'lusu', text: '皇叔，我主借地与皇叔安顿兵马。只是这荆州，终究是江东流血打下来的。', ifFlag: '!nanjun=seized' },
      { who: '{lord}', text: '子敬先生，你回去告诉二兄：荆州的事，等我嫁过去再说。', ifLord: ['sunshangxiang'] },
      { who: 'zhuge', text: '荆州本是刘景升之基业，公子刘琦尚在。公子在一日，荆州便守一日。' },
      { who: 'liubei', text: '江南四郡尚未归心。传令——南征长沙、桂阳、零陵、武陵！' },
    ],
  },
  stages: {
    1: {
      brief: { id: 'jingnan-1.brief', type: 'stageBrief', kicker: '6-1 · 军情', title: '桂阳受降', lines: [
        { text: '桂阳太守赵范据城观望，麾下陈应、鲍隆引兵出战。' },
        { who: 'zhuge', text: '谁可取桂阳？' },
        { who: 'zhaoyun', text: '某愿往！', ifFollower: 'zhaoyun' },
        { who: '{lord}', text: '某愿往！', ifNotFollower: 'zhaoyun' },
        { who: 'zhangfei', text: '子龙让俺去！', ifFollowers: ['zhangfei', 'zhaoyun'] },
        { who: 'zhuge', text: '二位不必争——拈阄定之。', ifFollowers: ['zhangfei', 'zhaoyun'] },
        { who: 'zhaoyun', text: '（拈得）是云的。', ifFollowers: ['zhangfei', 'zhaoyun'] },
        { tip: true, text: '赵范的旗令一举，弓阵齐射落点会先亮——看清落点出圈；他的亲军护驾时，先清掉身边亲兵再打他。' },
      ] },
      bossIntro: { id: 'jingnan-1.bossIntro', type: 'bossIntro', lines: [{ who: 'zhaofan', text: '开城迎降？还是……再试一试？给我放箭！' }] },
      bossPhase: { id: 'jingnan-1.bossPhase', type: 'bossPhase', lines: [{ who: 'zhaofan', text: '亲军上前！……挡住，挡住！' }] },
      bossFall: { id: 'jingnan-1.bossFall', type: 'bossFall', lines: [{ who: 'zhaofan', text: '某已愿降……为何……' }] },
      after: [{ id: 'jingnan-1.fanshi', type: 'interlude', cutscene: 'zhaoyun_fanshi', kicker: '幕间', title: '赵云辞樊氏', illustration: 'story_fanshi_1', lines: [
        { text: '赵范设宴款待，酒至半酣，请出一位妇人。', ifFlag: '!zhaofan=slain' },
        { who: 'zhaofan', text: '此乃家兄寡妻樊氏，国色也。愿以配将军。', ifFlag: '!zhaofan=slain' },
        { who: 'zhaoyun', text: '（正色）相与同姓，卿兄犹我兄也。此事断不可行！', ifFlag: '!zhaofan=slain' },
        { text: '后有人劝赵云纳之。赵云曰：「范迫降耳，心未可测；天下女不少。」', ifFlag: '!zhaofan=slain' },
        { who: 'sunshangxiang', text: '子龙将军真是块木头。……不过，是块好木头。', ifFollower: 'sunshangxiang', ifFlag: '!zhaofan=slain' },
        { text: '桂阳既下，赵云领桂阳太守。', ifFlag: 'zhaofan=slain' },
      ] }],
    },
    2: {
      brief: { id: 'jingnan-2.brief', type: 'stageBrief', kicker: '6-2 · 军情', title: '零陵武陵', lines: [
        { text: '零陵太守刘度据险不降，其子刘贤与上将邢道荣率山越弓手守山道。' },
        { who: 'scout', text: '武陵太守金旋闻风，已遣使来降！' },
        { who: 'zhangfei', text: '零陵还敢挡道？俺的蛇矛正痒！', ifFollower: 'zhangfei' },
        { who: '{lord}', text: '零陵还敢挡道？进兵！', ifNotFollower: 'zhangfei' },
        { who: 'huangyueying', text: '山越的藤牌浸过油，晒干了刀砍不进——用火。', ifFollower: 'huangyueying' },
        { tip: true, text: '山越弓手藏在林间，弓兵多时先清弓兵；藤牌兵正面挡箭，绕到侧面打。' },
      ] },
      bossIntro: { id: 'jingnan-2.bossIntro', type: 'bossIntro', lines: [{ who: 'liudu', text: '零陵虽小，也有铁骑！' }] },
      bossPhase: { id: 'jingnan-2.bossPhase', type: 'bossPhase', lines: [{ who: 'liudu', text: '贤儿！快引兵来救！' }] },
      bossFall: { id: 'jingnan-2.bossFall', type: 'bossFall', lines: [{ who: 'liudu', text: '我儿……零陵……' }] },
      after: [{ id: 'jingnan-2.after', type: 'interlude', kicker: '幕间', title: '零陵既定', lines: [
        { text: '刘度出城请降，刘贤亦缚邢道荣来献。', ifFlag: '!liudu=slain' },
        { who: 'liubei', text: '皆是荆州旧人，各复原职，安抚百姓。', ifFlag: '!liudu=slain' },
        { text: '刘度死于阵中，刘贤闭城三日后降。', ifFlag: 'liudu=slain' },
        { text: '零陵、武陵既定，只剩长沙。' },
      ] }],
    },
    3: {
      brief: { id: 'jingnan-3.brief', type: 'stageBrief', kicker: '6-3 · 军情', title: '长沙会战', lines: [
        { text: '长沙太守韩玄，性急寡恩。麾下老将黄忠，年近六旬，开两石之弓，百发百中。' },
        { who: 'guanyu', text: '一个老卒，某只带五百校刀手去！', ifFollower: 'guanyu' },
        { who: '{lord}', text: '一个老卒，某自去取长沙！', ifNotFollower: 'guanyu' },
        { who: 'zhuge', text: '云长勿轻敌。黄忠，乃当世虎将。', ifFollower: 'guanyu' },
        { who: 'zhuge', text: '勿轻敌。黄忠，乃当世虎将。', ifNotFollower: 'guanyu' },
        { tip: true, text: CHANGSHA_TIP },
      ], variants: {
        // 主公是黄忠：自己守了几十年的长沙，今日择主；第一阶段首领换成韩玄部将杨龄
        huangzhong: [
          { text: '长沙太守韩玄，性急寡恩，疑忌守将。' },
          { who: '{lord}', text: '（独白）某守长沙数十年，今日……也该择主了。' },
          { tip: true, text: '先破韩玄部将杨龄，再战韩玄。' },
        ],
      } },
      bossIntros: {
        huangzhong: { id: 'jingnan-3.intro.huangzhong', type: 'bossIntro', lines: [{ who: 'huangzhong', text: '老将黄汉升在此！谁敢来战！' }],
          variants: { huangzhong: [{ who: 'yangling', text: '长沙杨龄在此！黄汉升，你敢反？' }] } },
        hanxuan: { id: 'jingnan-3.intro.hanxuan', type: 'bossIntro', lines: [
          { who: 'hanxuan', text: '黄忠通敌，罪当处斩！——左右，给我拿下！', ifFlag: 'spared_huangzhong' },
          { who: 'hanxuan', text: '老卒无用！给我顶住！', ifFlag: '!spared_huangzhong' },
        ], variants: { huangzhong: [{ who: 'hanxuan', text: '黄忠！你竟敢反我！——左右，给我拿下！' }] } },
      },
      bossPhases: {
        huangzhong: { id: 'jingnan-3.phase.huangzhong', type: 'bossPhase', lines: [
          { who: 'huangzhong', text: '休道老夫年迈——手中宝刀，未肯饶人！', ifNotFollower: 'guanyu' },
          { who: 'huangzhong', text: '关云长！昨日你不杀我，今日老夫这一箭——（射落盔缨）——还你！', ifFollower: 'guanyu' },
        ], variants: { huangzhong: [] } },
        hanxuan: { id: 'jingnan-3.phase.hanxuan', type: 'bossPhase', lines: [{ who: 'hanxuan', text: '伏兵何在！杀！' }] },
      },
      bossFalls: {
        // 黄忠：只在斩杀时播（劝降走招降台词）；主公是黄忠时是杨龄倒下
        huangzhong: { id: 'jingnan-3.fall.huangzhong', type: 'bossFall', lines: [{ who: 'huangzhong', text: '老夫……死得其所……' }],
          variants: { huangzhong: [{ who: 'yangling', text: '黄……汉升，你竟反了！' }] } },
        hanxuan: { id: 'jingnan-3.fall.hanxuan', type: 'bossFall', lines: [{ who: 'hanxuan', text: '魏延！你——' }] },
      },
      after: [{ id: 'jingnan-3.weiyan', type: 'interlude', cutscene: 'weiyan_xiancheng', kicker: '过场', title: '魏延献城', illustration: 'story_weiyan_2', lines: [
        { text: '长沙城破，韩玄伏诛。桂阳、零陵、武陵、长沙四郡相继归附，荆州以南尽入版图。' },
        { who: 'huangzhong', text: '忠年近六旬，今日方遇明主。愿以残年，为将军前驱！', ifFlag: 'spared_huangzhong' },
        { text: '老将黄忠战殁城下，军中无不惋惜。', ifFlag: '!spared_huangzhong' },
        { who: 'weiyan', text: '韩玄残暴寡恩，长沙百姓苦之久矣。某愿投将军帐下！' },
        { who: 'zhuge', text: '（喝令）推出斩之！此人食其禄而杀其主，是不忠；居其土而献其地，是不义。吾观魏延脑后有反骨，久后必反！' },
      ], variants: {
        huangzhong: [
          { text: '长沙城破，韩玄伏诛。桂阳、零陵、武陵、长沙四郡相继归附，荆州以南尽入版图。' },
          { who: 'weiyan', text: '韩玄残暴寡恩，长沙百姓苦之久矣。某愿投将军帐下！' },
          { who: 'zhuge', text: '（喝令）推出斩之！此人食其禄而杀其主，是不忠；居其土而献其地，是不义。吾观魏延脑后有反骨，久后必反！' },
        ],
        // 主公是魏延：提首级献城，刘备当场作保，不出抉择（weiyan_trust 固定 trusted）
        weiyan: [
          { text: '长沙城破，韩玄伏诛。桂阳、零陵、武陵、长沙四郡相继归附，荆州以南尽入版图。' },
          { who: 'huangzhong', text: '忠年近六旬，今日方遇明主。愿以残年，为将军前驱！', ifFlag: 'spared_huangzhong' },
          { text: '老将黄忠战殁城下，军中无不惋惜。', ifFlag: '!spared_huangzhong' },
          { who: '{lord}', text: '（提韩玄首级）某魏文长，献长沙！' },
          { who: 'zhuge', text: '此人脑后有反骨……' },
          { who: 'liubei', text: '文长以首级来献，有功无罪。军师不必多言。' },
        ],
      } }],
      choice: { id: 'jingnan-3.weiyan_trust', type: 'choice', kicker: '抉择', title: '魏延去留', skipIfLord: ['weiyan'], skipChoice: 0, lines: [
        { text: '刀斧手已押魏延到帐下。' },
      ], choices: [
        // 两个选项魏延都留下（魏延是可玩武将）；只写旗标、不给数值（用户定）。第一个是跳过时的默认（演义结果）
        { label: '降者不杀', flag: 'weiyan_trust', value: 'trusted', reply: [
          { who: 'liubei', text: '若斩降人，人皆自危。望军师恕之。' },
          { who: 'zhuge', text: '……也罢。魏延，汝可尽忠报主，勿生异心。' },
        ] },
        { label: '留用，但须提防', flag: 'weiyan_trust', value: 'watched', reply: [
          { who: '{lord}', text: '魏文长暂且留用，交云长节制。' },
          { who: 'zhuge', text: '亮当时时留意。' },
        ] },
      ] },
    },
  },
  close: {
    id: 'jingnan.close', type: 'chapterClose', kicker: '第六章 · 平定荆南 · 终', title: '荆南四郡尽归', illustration: 'story_weiyan_1',
    lines: [
      { text: '是年，公子刘琦病卒。群下推刘备为荆州牧，治公安。' },
      { who: 'sunshangxiang', text: '二兄派人来说，要把我许给皇叔。……这一仗打完，我是该回江东一趟了。', ifFollower: 'sunshangxiang' },
      { who: '{lord}', text: '兵精粮足，可图大事。传令诸将，整军西望。' },
      { text: '西川刘璋暗弱，张鲁窥其北。益州天府之国，正在眼前……（第七章 · 入蜀）' },
    ],
  },
  camp: [
    { id: 'jingnan.camp1', type: 'campTalk', lines: [
      { who: 'zhaofan', text: '将军真不要樊氏？', ifFollower: 'zhaoyun', ifFlag: 'zhaofan=joined' },
      { who: 'zhaoyun', text: '再提此事，云便回公安。', ifFollower: 'zhaoyun', ifFlag: 'zhaofan=joined' },
    ] },
    { id: 'jingnan.camp2', type: 'campTalk', lines: [
      { who: 'huangzhong', text: '老夫六十有余，还能开两石弓！不服的，来比一比。', ifFollowers: ['huangzhong', 'zhangfei'] },
      { who: 'zhangfei', text: '比就比！', ifFollowers: ['huangzhong', 'zhangfei'] },
    ] },
    { id: 'jingnan.camp3', type: 'campTalk', lines: [
      { who: 'guanyu', text: '（低声）一个老卒，也与某同列？', ifFollowers: ['guanyu', 'huangzhong'] },
      { who: 'guanyu', text: '……罢了，那一箭，他本可射某咽喉。', ifFollowers: ['guanyu', 'huangzhong'] },
    ] },
    { id: 'jingnan.camp4', type: 'campTalk', lines: [
      { who: 'weiyan', text: '军师看某的眼神……像看一头狼。', ifFollower: 'weiyan', ifFlag: 'weiyan_trust=watched', ifNotLord: ['weiyan'] },
      { who: '{lord}', text: '做出功劳来，眼神自然就变了。', ifFollower: 'weiyan', ifFlag: 'weiyan_trust=watched', ifNotLord: ['weiyan'] },
    ] },
    { id: 'jingnan.camp5', type: 'campTalk', lines: [
      { who: 'weiyan', text: '皇叔一句「降者不杀」，某这条命就是皇叔的。', ifFollower: 'weiyan', ifFlag: 'weiyan_trust=trusted', ifNotLord: ['weiyan', 'liubei'] },
      { who: 'liubei', text: '文长言重了。', ifFollower: 'weiyan', ifFlag: 'weiyan_trust=trusted', ifNotLord: ['weiyan', 'liubei'] },
    ] },
    { id: 'jingnan.camp6', type: 'campTalk', lines: [
      { who: 'pangtong', text: '四郡易得，人心难收。主公让四个太守各复原职，这一招比打仗高明。', ifFollower: 'pangtong', ifNotLord: ['pangtong'] },
      { who: '{lord}', text: '士元过奖。', ifFollower: 'pangtong', ifNotLord: ['pangtong'] },
    ] },
    { id: 'jingnan.camp7', type: 'campTalk', lines: [
      { who: 'sunshangxiang', text: '鲁子敬又来了。每回来，都只说两个字：荆州。', ifFollower: 'sunshangxiang', ifNotLord: ['sunshangxiang'] },
      { who: '{lord}', text: '让他等着。', ifFollower: 'sunshangxiang', ifNotLord: ['sunshangxiang'] },
    ] },
  ],
  bonds: [
    { id: 'bond.laodang', name: '老当益壮', members: ['huangzhong', 'zhaoyun'], critBonus: .03, lines: [
      { who: 'huangzhong', text: '子龙，你我谁先斩将？' }, { who: 'zhaoyun', text: '老将军请。' }, { tip: true, text: '羁绊「老当益壮」：黄忠、赵云同队，本关暴击率 +3%' },
    ] },
  ],
};
