/**
 * 第十一章 · 南征 剧本（2026-11-20，补齐 7–12 章）。三关开场（五月渡泸 / 藤甲兵 / 七擒孟获）与章末（七擒七纵）仍由
 * NanzhengGameScene 的卷轴播（data/nanzhengChapter.ts，测试依赖）；这里补三关首领登场 / 二阶段 / 倒下台词与营中闲话。
 * 忙牙长可劝（丞相在侧更易），兀突骨宁死不降（火烧藤甲），孟获七擒七纵（被击倒是「擒住」，倒下台词写不服，第三擒后章末心服）。
 */
import type { StoryChapter } from './types';

export const NANZHENG_STORY: StoryChapter = {
  chapter: 'nanzheng',
  stages: {
    1: {
      bossIntro: { id: 'nanzheng-1.bossIntro', type: 'bossIntro', lines: [{ who: 'mangyachang', text: '忙牙长在此！过泸水者，一个不留！' }] },
      bossPhase: { id: 'nanzheng-1.bossPhase', type: 'bossPhase', lines: [{ who: 'mangyachang', text: '象兵！踏平汉人的营寨！' }] },
      bossFall: { id: 'nanzheng-1.bossFall', type: 'bossFall', lines: [{ who: 'mangyachang', text: '大王……忙牙长……尽力了……' }] },
    },
    2: {
      bossIntro: { id: 'nanzheng-2.bossIntro', type: 'bossIntro', lines: [{ who: 'wutugu', text: '藤甲刀枪不入——汉人，来砍啊！' }] },
      bossPhase: { id: 'nanzheng-2.bossPhase', type: 'bossPhase', lines: [{ who: 'wutugu', text: '乌戈蛮阵，压上去！' }] },
      bossFall: { id: 'nanzheng-2.bossFall', type: 'bossFall', lines: [{ who: 'wutugu', text: '火……为何偏偏是火……' }] },
    },
    3: {
      bossIntro: { id: 'nanzheng-3.bossIntro', type: 'bossIntro', lines: [{ who: 'menghuo', text: '孟获在此！这回定叫你诸葛亮有来无回！' }] },
      bossPhase: { id: 'nanzheng-3.bossPhase', type: 'bossPhase', lines: [{ who: 'zhurong', text: '大王莫慌，祝融来也！' }] },
      bossFall: { id: 'nanzheng-3.bossFall', type: 'bossFall', lines: [{ who: 'menghuo', text: '孟获……又被擒了……' }] },
    },
  },
  camp: [
    { id: 'nanzheng.camp1', type: 'campTalk', lines: [
      { who: 'masu', text: '丞相擒而复纵，诸将多有不解。', ifFollower: 'zhuge', ifNotLord: ['zhuge'] },
      { who: 'zhuge', text: '杀一孟获，南中还有千百个孟获。服其心，方是长久之计。', ifFollower: 'zhuge', ifNotLord: ['zhuge'] },
    ] },
    { id: 'nanzheng.camp2', type: 'campTalk', lines: [
      { who: 'huangyueying', text: '盘蛇谷的地雷火车，是我按夫君的图样连夜赶出来的。', ifFollowers: ['huangyueying', 'zhuge'], ifNotLord: ['huangyueying'] },
      { who: 'zhuge', text: '月英之巧，胜亮十倍。', ifFollowers: ['huangyueying', 'zhuge'], ifNotLord: ['zhuge'] },
    ] },
    { id: 'nanzheng.camp3', type: 'campTalk', lines: [
      { who: 'weiyan', text: '南人一放再放，某的刀都快生锈了。', ifFollower: 'weiyan', ifNotLord: ['weiyan'] },
      { who: '{lord}', text: '留着刀，北伐有的是仗打。', ifFollower: 'weiyan', ifNotLord: ['weiyan'] },
    ] },
  ],
  bonds: [],
};
