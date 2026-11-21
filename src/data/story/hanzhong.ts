/**
 * 第八章 · 汉中之战 剧本（2026-11-20，补齐 7–12 章）。章头（法正献策）在 HanzhongChapterScene，章末（汉中王）在 HanzhongGameScene；
 * 这里补三关军情、首领台词、营中闲话。黄忠第八章前一定回来：6-3 负伤遁去的（!spared_huangzhong）在 8-1 军情里伤愈来投。
 * 玩法引子（mechanic-rollout.md）：本命兵器第八章起可练到 Lv7。张郃 8-1 是败走型（退守定军山），夏侯渊宁死不降。
 */
import type { StoryChapter } from './types';

export const HANZHONG_STORY: StoryChapter = {
  chapter: 'hanzhong',
  stages: {
    1: {
      brief: { id: 'hanzhong-1.brief', type: 'stageBrief', kicker: '8-1 · 军情', title: '阳平关', lines: [
        { text: '张郃据阳平关，依山立寨，与定军山的夏侯渊互为犄角。' },
        { who: 'huangzhong', text: '长沙一别，老夫箭伤已愈。听闻将军北取汉中——这一战，算老夫一个！', ifFlag: '!spared_huangzhong', ifNotLord: ['huangzhong'] },
        { who: 'fazheng', text: '关前有一处高地。先夺高地，压住张郃的枪阵。' },
        { who: 'huangzhong', text: '老夫这口刀，越磨越快——练到深处，还有一层。', ifNotLord: ['huangzhong'] },
        { tip: true, text: '新：本命兵器第八章起可练到 Lv7，沿所选专职再加深一层（Lv7 且该派 4 势进阶为最终形态）。' },
        { tip: true, text: '站上山头读条占领：伤害、射程提高；张郃会派兵来反夺，守住它。' },
      ] },
      bossIntro: { id: 'hanzhong-1.bossIntro', type: 'bossIntro', lines: [{ who: 'zhanghe', text: '张儁乂在此！阳平关前，寸土不让！' }] },
      bossPhase: { id: 'hanzhong-1.bossPhase', type: 'bossPhase', lines: [{ who: 'zhanghe', text: '枪阵前进！把高地夺回来！' }] },
      bossFall: { id: 'hanzhong-1.bossFall', type: 'bossFall', lines: [{ who: 'zhanghe', text: '……退！去定军山与妙才会合！' }] },
    },
    2: {
      brief: { id: 'hanzhong-2.brief', type: 'stageBrief', kicker: '8-2 · 军情', title: '定军山', lines: [
        { who: 'fazheng', text: '定军山居高临下。夏侯渊性急，必来争山——待其兵疲，一鼓可破。' },
        { who: 'huangzhong', text: '老夫今日，便斩夏侯渊！', ifFollower: 'huangzhong' },
        { who: 'fazheng', text: '黄老将军，待我举红旗，便是出击之时。', ifFollower: 'huangzhong' },
        { who: '{lord}', text: '夏侯渊勇而无谋，今日正好破之。', ifNotFollower: 'huangzhong' },
        { tip: true, text: '两处山头都要占；夏侯渊「疾行突袭」来得快，张郃从侧翼夹击——先认准冲过来的路线。' },
      ] },
      bossIntro: { id: 'hanzhong-2.bossIntro', type: 'bossIntro', lines: [{ who: 'xiahouyuan', text: '夏侯妙才在此！定军山，是我的！' }] },
      bossPhase: { id: 'hanzhong-2.bossPhase', type: 'bossPhase', lines: [{ who: 'xiahouyuan', text: '儁乂！两翼夹击，把山头抢回来！' }] },
      bossFall: { id: 'hanzhong-2.bossFall', type: 'bossFall', lines: [{ who: 'xiahouyuan', text: '一时轻进……妙才……愧对……' }] },
      // 双首领（夏侯渊 + 张郃）：按倒下的首领取台词
      bossFalls: {
        xiahouyuan: { id: 'hanzhong-2.fall.xiahouyuan', type: 'bossFall', lines: [{ who: 'xiahouyuan', text: '一时轻进……妙才……愧对……' }] },
        zhanghe: { id: 'hanzhong-2.fall.zhanghe', type: 'bossFall', lines: [{ who: 'zhanghe', text: '妙才！……定军山，守不住了！' }] },
      },
    },
    3: {
      brief: { id: 'hanzhong-3.brief', type: 'stageBrief', kicker: '8-3 · 军情', title: '汉水', lines: [
        { text: '夏侯渊既死，曹操亲率大军自长安来争汉中，两军隔汉水相持。' },
        { who: 'zhaoyun', text: '曹军运粮过汉水，云愿往劫之。', ifFollower: 'zhaoyun' },
        { who: 'fazheng', text: '曹军粮道不继，进退两难。撑过他的虎豹骑，曹操必退。' },
        { who: 'machao', text: '曹贼！潼关割须之仇，今日在汉水了结！' },
        { tip: true, text: '曹操两阶段：半血后虎豹骑断后冲阵——看到冲锋预警就横移。' },
      ] },
      bossIntro: { id: 'hanzhong-3.bossIntro', type: 'bossIntro', lines: [{ who: 'caocao', text: '织席贩履之辈，也敢与孤争汉中！' }] },
      bossPhase: { id: 'hanzhong-3.bossPhase', type: 'bossPhase', lines: [{ who: 'caocao', text: '虎豹骑上前！孤亲自压阵！' }] },
      bossFall: { id: 'hanzhong-3.bossFall', type: 'bossFall', lines: [{ who: 'caocao', text: '传令……收兵，回长安。' }] },
    },
  },
  camp: [
    { id: 'hanzhong.camp1', type: 'campTalk', lines: [
      { who: 'huangzhong', text: '定军山上那一刀，老夫想了几十年。', ifFollowers: ['huangzhong', 'machao'] },
      { who: 'machao', text: '老将军这一刀，比西凉的风还快。', ifFollowers: ['huangzhong', 'machao'] },
    ] },
    { id: 'hanzhong.camp2', type: 'campTalk', lines: [
      { who: 'zhaoyun', text: '汉水营里，曹军一见空营便退——原来是疑兵之计。', ifFollower: 'zhaoyun', ifNotLord: ['zhaoyun'] },
      { who: 'liubei', text: '子龙一身是胆也。', ifFollower: 'zhaoyun', ifNotLord: ['zhaoyun'] },
    ] },
    { id: 'hanzhong.camp3', type: 'campTalk', lines: [
      { who: 'weiyan', text: '汉中若交某镇守：曹操举天下而来，某为大王拒之；偏将十万之众至，某为大王吞之！', ifFollower: 'weiyan', ifNotLord: ['weiyan'] },
      { who: '{lord}', text: '好气魄。', ifFollower: 'weiyan', ifNotLord: ['weiyan'] },
    ] },
  ],
  bonds: [],
};
