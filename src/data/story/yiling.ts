/**
 * 第十章 · 夷陵之战 剧本（2026-11-20，补齐 7–12 章）。章头（东征孙吴）在 YilingChapterScene，章末（退守白帝 · 白帝托付）在 YilingGameScene；
 * 这里补三关军情、首领台词、营中闲话。本作走向：关羽杀出麦城（第九章），东征是为夺回荆州、雪麦城之辱；白帝城刘备不死，
 * 把国事托付丞相（第十一、十二章由丞相统兵）。孙桓宁死不降；朱然可劝（孙夫人在侧时更易）。
 * 玩法引子（mechanic-rollout.md）：武艺第十章起可精熟到 Lv5。孙尚香在吴蜀交兵时的台词都要求她在队。
 */
import type { StoryChapter } from './types';

export const YILING_STORY: StoryChapter = {
  chapter: 'yiling',
  stages: {
    1: {
      brief: { id: 'yiling-1.brief', type: 'stageBrief', kicker: '10-1 · 军情', title: '猇亭', lines: [
        { text: '大军顺江东下，连破巫县、秭归，兵锋直抵猇亭。' },
        { who: 'huangquan', text: '吴人悍战，水军顺流，进易退难。臣请为先驱，主公宜为后镇。' },
        { who: 'sunshangxiang', text: '……那是我的家乡。可荆州的账，也该算了。', ifFollower: 'sunshangxiang', ifNotLord: ['sunshangxiang'] },
        { who: 'liubei', text: '不必多言。砍倒吴军军旗，直取猇亭！' },
        { tip: true, text: '新：武艺第十章起可精熟到 Lv5（每层全伤害 +4%）。' },
        { tip: true, text: '我军推进中：砍倒吴军军旗可压住敌阵；孙桓守夷道，副将谢旌领兵来援。' },
      ] },
      bossIntro: { id: 'yiling-1.bossIntro', type: 'bossIntro', lines: [{ who: 'sunhuan', text: '孙叔武在此！夷道城一步不退！' }] },
      bossPhase: { id: 'yiling-1.bossPhase', type: 'bossPhase', lines: [{ who: 'sunhuan', text: '谢旌！领兵来援！' }] },
      bossFall: { id: 'yiling-1.bossFall', type: 'bossFall', lines: [{ who: 'sunhuan', text: '孙家儿郎……战死……也不退……' }] },
    },
    2: {
      brief: { id: 'yiling-2.brief', type: 'stageBrief', kicker: '10-2 · 军情', title: '连营', lines: [
        { text: '吴军依山结寨，营帐相连，坚壁不出。两军相持数月。' },
        { who: 'sunshangxiang', text: '朱义封与二兄同窗共读——他的营寨最是难拆。', ifFollower: 'sunshangxiang', ifNotLord: ['sunshangxiang'] },
        { who: '{lord}', text: '拆其营寨，逼他出营！' },
        { tip: true, text: '拆掉吴军营帐：营帐尽破，朱然才出营决战；潘璋、韩当会从两侧夹击。' },
      ] },
      bossIntro: { id: 'yiling-2.bossIntro', type: 'bossIntro', lines: [{ who: 'zhuran', text: '营寨都被拆了？……好，朱义封亲自来会！' }] },
      bossPhase: { id: 'yiling-2.bossPhase', type: 'bossPhase', lines: [{ who: 'zhuran', text: '潘璋、韩当！左右夹击！' }] },
      bossFall: { id: 'yiling-2.bossFall', type: 'bossFall', lines: [{ who: 'zhuran', text: '这一阵……然认了。' }] },
    },
    3: {
      brief: { id: 'yiling-3.brief', type: 'stageBrief', kicker: '10-3 · 军情', title: '火烧连营', lines: [
        { text: '时值盛暑，我军移营林中避暑，连营七百里。' },
        { who: 'zhuge', text: '连营七百里，依林傍水——此兵家大忌！', ifFollower: 'zhuge' },
        { who: 'huangquan', text: '营寨依林，一旦起火，首尾不能相救！', ifNotFollower: 'zhuge' },
        { who: 'liubei', text: '陆逊黄口孺子，坚守不出，何惧之有！' },
        { tip: true, text: '陆逊放火：看风向箭头，火往箭头方向烧，往上风口退；营帐着火会一烧一片。' },
      ] },
      bossIntro: { id: 'yiling-3.bossIntro', type: 'bossIntro', lines: [{ who: 'luxun', text: '时机已至——东南风起，放火！' }] },
      bossPhase: { id: 'yiling-3.bossPhase', type: 'bossPhase', lines: [{ who: 'luxun', text: '各持茅草一把，四面同时举火！' }] },
      bossFall: { id: 'yiling-3.bossFall', type: 'bossFall', lines: [{ who: 'luxun', text: '……收兵。这一把火，已足够了。' }] },
    },
  },
  camp: [
    { id: 'yiling.camp1', type: 'campTalk', lines: [
      { who: 'sunshangxiang', text: '二兄派人捎信来，问我还回不回江东。', ifFollower: 'sunshangxiang', ifNotLord: ['sunshangxiang'] },
      { who: '{lord}', text: '你想回么？', ifFollower: 'sunshangxiang', ifNotLord: ['sunshangxiang'] },
      { who: 'sunshangxiang', text: '……我的弓，在这边。', ifFollower: 'sunshangxiang', ifNotLord: ['sunshangxiang'] },
    ] },
    { id: 'yiling.camp2', type: 'campTalk', lines: [
      { who: 'guanyu', text: '麦城之辱，某夜夜梦见。此番东征，不破东吴，誓不回川。', ifFollower: 'guanyu', ifNotLord: ['guanyu'] },
      { who: 'zhangfei', text: '二哥，有俺在，你只管往前杀！', ifFollowers: ['guanyu', 'zhangfei'] },
    ] },
    { id: 'yiling.camp3', type: 'campTalk', lines: [
      { who: 'zhaoyun', text: '国贼是曹丕，非孙权也……这话，云还是要说。', ifFollower: 'zhaoyun', ifNotLord: ['zhaoyun'] },
      { who: '{lord}', text: '子龙，此战之后，再图北伐。', ifFollower: 'zhaoyun', ifNotLord: ['zhaoyun'] },
    ] },
  ],
  bonds: [],
};
