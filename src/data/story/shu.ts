/**
 * 第七章 · 入蜀 剧本（2026-11-20，统筹「按 1–6 章的规格补齐 7–12 章」；剧情审计 story-stage-audit.md 回报项）。
 * 章头（7-1「刘璋迎刘备入川」）、落凤坡开场 / 结局（7-2）、章末（7-3「刘璋出降」，含马超来投）仍由 ShuGameScene 的卷轴播
 * （数据在 data/shuChapter.ts，测试依赖那几张卷轴）；这里补 7-3 军情、三关首领登场 / 二阶段 / 倒下台词、营中闲话。
 * 入队规则：庞统第七章开篇随军（落凤坡若陨落则写旗标 luofeng=fell，此后他的台词都带 !luofeng=fell）；诸葛亮 7-3 才入川；
 * 马超 7-3 打完才来投（7-3 只由斥候报信）；黄忠若 6-3 负伤遁去要到第八章前才回来（本章他的台词都要求在队）。
 * 张任宁死不降：倒下台词不写降。
 */
import type { StoryChapter } from './types';

export const SHU_STORY: StoryChapter = {
  chapter: 'shu',
  stages: {
    1: {
      bossIntro: { id: 'shu-1.bossIntro', type: 'bossIntro', lines: [{ who: 'yanghuai', text: '刘玄德！你名为拒张鲁，实为图益州——白水关不放一人过去！' }] },
      bossPhase: { id: 'shu-1.bossPhase', type: 'bossPhase', lines: [{ who: 'yanghuai', text: '高沛！伏兵齐出，把滚石放下来！' }] },
      bossFall: { id: 'shu-1.bossFall', type: 'bossFall', lines: [{ who: 'yanghuai', text: '葭萌……失守了……' }] },
    },
    2: {
      bossIntro: { id: 'shu-2.bossIntro', type: 'bossIntro', lines: [{ who: 'zhangren', text: '益州张任在此！落凤坡，便是尔等葬身之地！' }] },
      bossPhase: { id: 'shu-2.bossPhase', type: 'bossPhase', lines: [{ who: 'zhangren', text: '坐骑没了又如何？弓手护住两翼——今日一步不退！' }] },
      bossFall: { id: 'shu-2.bossFall', type: 'bossFall', lines: [{ who: 'zhangren', text: '张任……为益州，尽力了……' }] },
    },
    3: {
      brief: { id: 'shu-3.brief', type: 'stageBrief', kicker: '7-3 · 军情', title: '兵临成都', lines: [
        { text: '雒城既破，诸葛亮、张飞、赵云溯江入川，与大军会师成都城下。' },
        { who: 'zhuge', text: '成都城坚，城中尚有精兵三万、粮支一年。破门之后，巷战须步步为营。' },
        { who: 'pangtong', text: '刘季玉暗弱，城中人心早散了。主公只需一鼓作气。', ifFlag: '!luofeng=fell', ifNotLord: ['pangtong'] },
        { who: 'zhuge', text: '士元的仇，就在这城里。', ifFlag: 'luofeng=fell' },
        { who: 'scout', text: '报！西凉马超弃张鲁来投，已屯兵城北！城中闻之，无不震恐！' },
        { who: '{lord}', text: '天助我也！传令：冲车上前，先破城门！' },
        { tip: true, text: '冲车撞开城门 → 巷战 → 州府。副将刘循压阵时先清他身边的亲军，刘璋才会出州府。' },
      ] },
      bossIntro: { id: 'shu-3.bossIntro', type: 'bossIntro', lines: [{ who: 'liuzhang', text: '我父子在蜀二十余年……今日，还要叫百姓再流血么？' }] },
      bossPhase: { id: 'shu-3.bossPhase', type: 'bossPhase', lines: [{ who: 'liuxun', text: '父亲莫慌！孩儿死守州府！' }] },
      bossFall: { id: 'shu-3.bossFall', type: 'bossFall', lines: [{ who: 'liuzhang', text: '罢了……开城，出降吧。' }] },
    },
  },
  camp: [
    { id: 'shu.camp1', type: 'campTalk', lines: [
      { who: 'zhuge', text: '卧龙、凤雏同在一营。士元，落凤坡那一箭，可把亮吓得不轻。', ifFollowers: ['zhuge', 'pangtong'], ifFlag: '!luofeng=fell' },
      { who: 'pangtong', text: '孔明，那一箭射的是的卢。我这条命，硬得很。', ifFollowers: ['zhuge', 'pangtong'], ifFlag: '!luofeng=fell' },
    ] },
    { id: 'shu.camp2', type: 'campTalk', lines: [
      { who: 'zhangfei', text: '马儿！葭萌关下那一夜没打完，改日再比！', ifFollowers: ['zhangfei', 'machao'] },
      { who: 'machao', text: '随时奉陪，燕人张翼德。', ifFollowers: ['zhangfei', 'machao'] },
    ] },
    { id: 'shu.camp3', type: 'campTalk', lines: [
      { who: 'huangzhong', text: '蜀道难，难于上青天。老夫这腿脚，倒还走得动。', ifFollower: 'huangzhong' },
      { who: '{lord}', text: '老将军走得比后生还快。', ifFollower: 'huangzhong', ifNotLord: ['huangzhong'] },
    ] },
  ],
  bonds: [],
};
