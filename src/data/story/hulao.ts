/**
 * 第二章 · 讨伐董卓 剧本（story-plan.md 第四节）。
 * 2-3 董卓 + 吕布首领战的流程由新增内容会话做：台词放在 barks 里（external），由他们在对应时机调 StoryDirector.line(id, 说话人精灵) 触发。
 */
import type { StoryChapter } from './types';

export const HULAO_STORY: StoryChapter = {
  chapter: 'hulao',
  open: {
    id: 'hulao.open', type: 'chapterOpen', kicker: '第二章 · 讨伐董卓', title: '酸枣会盟', illustration: 'story_suanzao', lines: [
      { text: '中平六年，董卓入京，废少帝、立献帝，夜宿龙床，滥杀无辜。' },
      { who: 'caocao', text: '卓贼欺天，吾矫诏传檄四方，请天下英雄共诛之！' },
      { text: '十八路诸侯会盟酸枣，推袁绍为盟主。' },
      { who: 'yuanshao', text: '诸公听令——谁敢为先锋，取汜水关？' },
      { who: '{lord}', text: '某愿往。' },
    ],
  },
  stages: {
    1: {
      brief: { id: 'hulao-1.brief', type: 'stageBrief', kicker: '2-1 · 军情', title: '汜水关', lines: [
        { who: 'scout', text: '汜水关守将华雄，连斩鲍忠、祖茂、俞涉、潘凤，诸侯失色。' },
        { who: 'guanyu', text: '酒且斟下，某去便来。', ifFollower: 'guanyu' },
        { tip: true, text: '箭楼会定时放箭雨，打塌就停；营帐会不断派出西凉骑兵。' },
      ] },
      bossIntro: { id: 'hulao-1.bossIntro', type: 'bossIntro', lines: [{ who: 'huaxiong', text: '关东鼠辈，谁敢与我一战！' }] },
      bossFall: { id: 'hulao-1.bossFall', type: 'bossFall', lines: [{ who: 'huaxiong', text: '怎……可能……' }] },
    },
    2: {
      brief: { id: 'hulao-2.brief', type: 'stageBrief', kicker: '2-2 · 军情', title: '荥阳', lines: [
        { who: 'caocao', text: '诸侯畏缩不前，我独追董卓至荥阳——' },
        { who: 'scout', text: '两侧林中有伏兵旗号！是徐荣！' },
        { tip: true, text: '徐荣伏兵会从营帐里冲出；先打掉营帐，伏兵就少。' },
      ] },
      bossIntro: { id: 'hulao-2.bossIntro', type: 'bossIntro', lines: [{ who: 'xurong', text: '曹孟德，你中计了！' }] },
      bossFall: { id: 'hulao-2.bossFall', type: 'bossFall', lines: [{ who: 'xurong', text: '……撤，护住太师车驾！' }] },
    },
    3: {
      brief: { id: 'hulao-3.brief', type: 'stageBrief', kicker: '2-3 · 军情', title: '洛阳', lines: [
        { who: 'scout', text: '董卓劫天子西迁长安，临行纵火焚烧洛阳！' },
        { who: '{lord}', text: '吕布护在城头——先破吕布，再擒国贼。' },
        { tip: true, text: '董卓在城墙上放技能，打不到；先打退吕布，董卓才会下城。' },
      ] },
      // 2-3 首领登场 / 倒下走下面的 barks（由首领战流程触发），这里不自动播
    },
  },
  close: {
    id: 'hulao.close', type: 'chapterClose', kicker: '第二章 · 讨伐董卓 · 终', title: '国贼伏诛', illustration: 'story_hulao_close', lines: [
      { text: '董卓伏诛，长安城中百姓歌舞于道。然洛阳已成焦土。' },
      { who: 'caocao', text: '诸侯各怀异心，盟约已散。天下自此多事矣。' },
      { who: 'liubei', text: '汉室倾颓，备虽力微，此志不改。', ifLord: ['liubei'] },
      { text: '群雄割据，各据一方。' },
    ],
  },
  camp: [
    { id: 'hulao.camp1', type: 'campTalk', lines: [{ who: 'zhangfei', text: '那吕布好生了得，俺三人合战才逼退他。' }, { who: 'guanyu', text: '此人有勇无谋，终非大器。' }] },
    { id: 'hulao.camp2', type: 'campTalk', lines: [{ who: 'diaochan', text: '太师……不，董卓。他的死，我早已料到。', ifFollower: 'diaochan' }] },
  ],
  bonds: [],
  // 2-3 战斗中途卷轴（2026-11-18 夜）：DongzhuoLubu 在董卓吕布登上城头、董卓亲自下城时调 StoryDirector.midScroll
  midScrolls: [
    { id: 'hulao-3.on_wall', type: 'interlude', kicker: '洛阳城头', title: '国贼与飞将', lines: [
      { who: 'dongzhuo', text: '洛阳烧便烧了！天子在老夫手里，天下就在老夫手里。' },
      { who: 'lubu', text: '义父放心。城下这些鼠辈，布一戟一个。' },
      { who: 'dongzhuo', text: '我儿奉先，给为父斩了这些鼠辈！' },
    ] },
    { id: 'hulao-3.dongzhuo_descend', type: 'interlude', kicker: '洛阳城下', title: '董卓下城', lines: [
      { who: 'dongzhuo', text: '奉先也走了？一群废物！——老夫亲自来！' },
      { who: 'zhangfei', text: '老贼自己送下城来了！', ifFollower: 'zhangfei' },
    ] },
  ],
  barks: [
    // 温酒斩华雄（SishuiPass.wenjiu 成立时，Story 在华雄倒下后接这一句）
    { id: 'hulao-1.wenjiu', type: 'bark', lines: [{ who: 'caocao', text: '（举杯）酒尚温，将军已斩华雄而回！' }] },
    // 2-3 董卓 + 吕布（新增内容会话在首领战流程里按时机调用 story.line(id, sprite)）
    { id: 'hulao-3.lubu_enter', type: 'bark', external: true, lines: [{ who: 'lubu', text: '人中吕布，马中赤兔！谁来送死？' }] },
    { id: 'hulao-3.dongzhuo_enter', type: 'bark', external: true, lines: [{ who: 'dongzhuo', text: '我儿奉先，给为父斩了这些鼠辈！' }] },
    { id: 'hulao-3.lubu_retreat', type: 'bark', external: true, lines: [{ who: 'lubu', text: '哼——来日再战！' }] },
    { id: 'hulao-3.dongzhuo_down', type: 'bark', external: true, lines: [{ who: 'dongzhuo', text: '一群废物！老夫亲自来！' }] },
    { id: 'hulao-3.lubu_return', type: 'bark', external: true, lines: [{ who: 'lubu', text: '国贼董卓，今日授首！' }] },
    { id: 'hulao-3.dongzhuo_fall', type: 'bark', external: true, lines: [{ who: 'dongzhuo', text: '奉先……我儿……你……' }] },
    { id: 'hulao-3.lubu_leave', type: 'bark', external: true, lines: [{ who: 'lubu', text: '我姓吕，不姓董！' }] },
    { id: 'hulao-3.zhangfei_jeer', type: 'bark', external: true, lines: [{ who: 'zhangfei', text: '三姓家奴！', ifFollower: 'zhangfei' }] },
  ],
};
