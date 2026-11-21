/** 第一章 · 黄巾之乱 剧本（story-plan.md 第三节）。 */
import type { StoryChapter } from './types';

const BROTHERS = ['liubei', 'guanyu', 'zhangfei'] as const;

export const HUANGJIN_STORY: StoryChapter = {
  chapter: 'huangjin',
  open: {
    id: 'huangjin.open', type: 'chapterOpen', kicker: '第一章 · 黄巾之乱', title: '桃园结义', illustration: 'story_taoyuan',
    baseLords: BROTHERS, titleVariants: { other: '涿郡投军' }, // 三兄弟之外的主将：桃园结义是刘关张的事，主将是来投的
    lines: [
      { text: '中平元年，张角以「苍天已死，黄天当立」聚众三十六方，烽火遍于八州。' },
      { text: '幽州涿郡贴出榜文，招募义勇，共讨黄巾。' },
      { who: 'liubei', text: '大丈夫不与国家出力，何故长叹？——我等结为兄弟，同心协力，救困扶危。' },
      { who: 'guanyu', text: '不求同年同月同日生，但愿同年同月同日死！' },
      // 张世平（2026-11-18 夜补台词）：中山贩马大商，赠马匹金铁资助刘备起兵
      { text: '中山大商张世平、苏双贩马过涿郡，赠良马五十匹、金银五百两、镔铁一千斤。' },
      { who: 'zhangshiping', text: '久闻刘公是汉室宗亲。这些马、这些铁，就当张某押在义军身上了。' },
      { text: '桃园三结义。招得乡勇五百，往投幽州太守刘焉。' },
    ],
    variants: {
      other: [
        { text: '中平元年，张角以「苍天已死，黄天当立」聚众三十六方，烽火遍于八州。' },
        { text: '幽州涿郡贴出榜文，招募义勇，共讨黄巾。' },
        { who: '{lord}', text: '天下大乱，正是男儿立身之时。愿随义军，共破黄巾。' },
        { who: 'liubei', text: '将军壮志，正合我意。同往！' },
        // 张世平（2026-11-18 夜补台词）：中山贩马大商，赠马匹金铁资助刘备起兵
        { text: '中山大商张世平、苏双贩马过涿郡，赠良马五十匹、金银五百两、镔铁一千斤。' },
        { who: 'zhangshiping', text: '久闻刘公是汉室宗亲。这些马、这些铁，就当张某押在义军身上了。' },
        { text: '{lord}投入刘备麾下，与关张兄弟同营。' },
      ],
    },
  },
  stages: {
    1: {
      brief: { id: 'huangjin-1.brief', type: 'stageBrief', kicker: '1-1 · 军情', title: '广宗外围', lines: [
        { who: 'luzhi', text: '玄德来得正好。广宗城外黄巾营帐连绵，先替我扫清外围。' },
        { who: 'liubei', text: '学生领命！' },
        { who: '{lord}', text: '某愿为前驱，替玄德公扫清营帐。', ifNotLord: BROTHERS },
        { tip: true, text: '打碎营帐与军旗可削弱黄巾士气。' },
      ] },
      bossIntro: { id: 'huangjin-1.bossIntro', type: 'bossIntro', lines: [{ who: 'zhangliang', text: '人公将军在此！苍天已死，黄天当立！' }] },
      bossFall: { id: 'huangjin-1.bossFall', type: 'bossFall', lines: [{ who: 'zhangliang', text: '黄天……何不佑我……' }] },
    },
    2: {
      brief: { id: 'huangjin-2.brief', type: 'stageBrief', kicker: '1-2 · 军情', title: '下曲阳', lines: [
        { who: 'zhangfei', text: '卢师父被那宦官诬陷，囚车都过去了！俺去劫——' },
        { who: 'guanyu', text: '三弟！先破张宝，再向朝廷讨个公道。' },
        { who: 'jianyong', text: '张宝据守地公营，撒豆成兵、呼风唤雨——多半是妖术障眼。' },
        { tip: true, text: '先打掉护法符柱，张宝才会受伤。' },
      ] },
      bossIntro: { id: 'huangjin-2.bossIntro', type: 'bossIntro', lines: [{ who: 'zhangbao', text: '地公将军施法，看你如何近我！' }] },
      bossFall: { id: 'huangjin-2.bossFall', type: 'bossFall', lines: [{ who: 'zhangbao', text: '法坛……破了……' }] },
    },
    3: {
      brief: { id: 'huangjin-3.brief', type: 'stageBrief', kicker: '1-3 · 军情', title: '广宗决战', lines: [
        { who: 'huangfusong', text: '张角病笃，城中军心已乱。诸君随我合围广宗！' },
        { who: 'guanyu', text: '大哥放心，某愿为前锋。' },
        { tip: true, text: '张角的天雷会提前落下预警圈，看准再闪。' },
      ] },
      bossIntro: { id: 'huangjin-3.bossIntro', type: 'bossIntro', lines: [{ who: 'zhangjiao', text: '天公将军代天行道——苍天已死！' }] },
      bossFall: { id: 'huangjin-3.bossFall', type: 'bossFall', lines: [{ who: 'zhangjiao', text: '大贤良师……也会死么……' }, { who: 'huangfusong', text: '张角已死，黄巾可平！' }] },
    },
  },
  close: {
    id: 'huangjin.close', type: 'chapterClose', kicker: '第一章 · 黄巾之乱 · 终', title: '黄巾平定', illustration: 'story_huangjin_close', lines: [
      { text: '张角病死，张梁、张宝相继授首。黄巾主力溃散。' },
      { who: 'liubei', text: '贼虽破，朝廷论功只赏了个安喜县尉……罢了，先安顿乡勇。' },
      { who: 'zhangfei', text: '哥哥立了这许多功，就给个县尉？俺老张不服！' },
    ],
  },
  camp: [
    { id: 'huangjin.camp1', type: 'campTalk', lines: [{ who: 'zhangfei', text: '二哥，你那大刀八十二斤，夜里睡觉压不压得着？' }, { who: 'guanyu', text: '……翼德，去巡营。' }] },
    { id: 'huangjin.camp2', type: 'campTalk', lines: [{ who: 'jianyong', text: '营里米缸见底了，主公。' }, { who: 'liubei', text: '多打几场，自有黄巾辎重。' }] },
    { id: 'huangjin.camp3', type: 'campTalk', lines: [{ who: 'zhaoyun', text: '常山赵子龙，久闻诸位义名，今日得见。', ifFollower: 'zhaoyun' }, { who: 'liubei', text: '子龙来得正好！', ifFollower: 'zhaoyun' }] },
  ],
  bonds: [
    { id: 'bond.taoyuan', name: '桃园', members: BROTHERS, damageMul: 1.05, lines: [{ who: 'zhangfei', text: '大哥、二哥，今日咱兄弟一起杀！' }, { tip: true, text: '羁绊「桃园」：刘备、关羽、张飞本关伤害 +5%' }] },
  ],
};
