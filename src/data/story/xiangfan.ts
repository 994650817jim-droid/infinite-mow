/**
 * 第九章 · 襄樊之战 剧本（2026-11-20，补齐 7–12 章）。章头（9-1 威震华夏）、水淹七军开场（9-2）、章末（9-3 走出麦城）
 * 仍由 XiangfanGameScene 的卷轴播（data/xiangfanChapter.ts）；这里补 9-3 军情（白衣渡江的急报）、三关首领台词、营中闲话。
 * 本作的走向：关羽杀出麦城、退守西川（不写关羽之死，他是可玩武将）。曹仁、庞德宁死不降。
 * 玩法引子（战法精研第九章起 Lv5）写在 9-1 章头卷轴 XF_OPENING 里。
 */
import type { StoryChapter } from './types';

export const XIANGFAN_STORY: StoryChapter = {
  chapter: 'xiangfan',
  stages: {
    1: {
      bossIntro: { id: 'xiangfan-1.bossIntro', type: 'bossIntro', lines: [{ who: 'caoren', text: '樊城在，曹子孝在！关云长，来攻便是！' }] },
      bossPhase: { id: 'xiangfan-1.bossPhase', type: 'bossPhase', lines: [{ who: 'caoren', text: '精兵出城——逆击！' }] },
      bossFall: { id: 'xiangfan-1.bossFall', type: 'bossFall', lines: [{ who: 'caoren', text: '樊城……子孝守到了最后……' }] },
    },
    2: {
      bossIntro: { id: 'xiangfan-2.bossIntro', type: 'bossIntro', lines: [
        { who: 'pangde', text: '庞令明在此！今日不是你死，便是我亡！', ifNotFollower: 'machao' },
        { who: 'pangde', text: '孟起……你我旧日同袍，今日各为其主！', ifFollower: 'machao' },
      ] },
      bossPhase: { id: 'xiangfan-2.bossPhase', type: 'bossPhase', lines: [{ who: 'pangde', text: '抬棺来！死士随我冲阵！' }] },
      bossFall: { id: 'xiangfan-2.bossFall', type: 'bossFall', lines: [{ who: 'pangde', text: '大水……天不佑魏……' }] },
    },
    3: {
      brief: { id: 'xiangfan-3.brief', type: 'stageBrief', kicker: '9-3 · 军情', title: '麦城突围', lines: [
        { who: 'scout', text: '报——！吕蒙白衣渡江，江陵、公安尽失！糜芳、傅士仁已降东吴！' },
        { who: 'guanyu', text: '……江东鼠辈，竟敢背盟！', ifFollower: 'guanyu' },
        { who: 'wangfu', text: '将军，四面皆是吴兵，只有北门小路可走。' },
        { who: 'guanping', text: '孩儿愿为前驱，杀开一条血路！' },
        { who: '{lord}', text: '诸军听令：随我杀出麦城，回西川！' },
        { tip: true, text: '限时冲出包围：吴兵会越聚越多，别恋战，朝出口杀过去；吕蒙的伏兵四起时先让开包围圈。' },
      ] },
      bossIntro: { id: 'xiangfan-3.bossIntro', type: 'bossIntro', lines: [{ who: 'lvmeng', text: '吕子明在此——白衣渡江，只为今日！截住他们！' }] },
      bossPhase: { id: 'xiangfan-3.bossPhase', type: 'bossPhase', lines: [{ who: 'lvmeng', text: '马忠、潘璋！伏兵四起，堵死北门！' }] },
      bossFall: { id: 'xiangfan-3.bossFall', type: 'bossFall', lines: [{ who: 'lvmeng', text: '拦不住……罢了，荆州已到手。' }] },
    },
  },
  camp: [
    { id: 'xiangfan.camp1', type: 'campTalk', lines: [
      { who: 'guanyu', text: '于禁乞降、庞德不屈。某敬庞德。', ifFollower: 'guanyu', ifNotLord: ['guanyu'] },
      { who: '{lord}', text: '宁死不屈，是条汉子。', ifFollower: 'guanyu', ifNotLord: ['guanyu'] },
    ] },
    { id: 'xiangfan.camp2', type: 'campTalk', lines: [
      { who: 'machao', text: '庞令明……当年随我在西凉，从未退过一步。', ifFollower: 'machao', ifNotLord: ['machao'] },
    ] },
    { id: 'xiangfan.camp3', type: 'campTalk', lines: [
      { who: 'zhuge', text: '荆州之失，亮之过也。当初只该与东吴结好，不该轻视吕蒙。', ifFollower: 'zhuge', ifNotLord: ['zhuge'] },
      { who: '{lord}', text: '军师不必自责。来日方长。', ifFollower: 'zhuge', ifNotLord: ['zhuge'] },
    ] },
  ],
  bonds: [],
};
