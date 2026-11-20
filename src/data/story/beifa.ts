/**
 * 第十二章 · 北伐 剧本（2026-11-20，补齐 7–12 章）。章头（出师表）在 BeifaChapterScene，章末（五丈原 · 将星复明 → 结局）在 BeifaGameScene；
 * 这里补三关军情、首领台词、营中闲话。街亭：马谡请守、王平劝当道扎营（本作玩家去守，守住水源）；陈仓：魏延子午谷之计、
 * 姜维献策；五丈原：巾帼之辱、丞相夙兴夜寐。张郃、郝昭宁死不降；司马懿是剧情首领（退兵）。
 * 入队：姜维是剧情人物（不可玩），魏延 6-3 起一定在营；刘备白帝之后留镇永安，本章不出场。
 */
import type { StoryChapter } from './types';

export const BEIFA_STORY: StoryChapter = {
  chapter: 'beifa',
  stages: {
    1: {
      brief: { id: 'beifa-1.brief', type: 'stageBrief', kicker: '12-1 · 军情', title: '街亭', lines: [
        { who: 'zhuge', text: '街亭虽小，干系重大。若街亭有失，我军皆休。谁可守之？' },
        { who: 'masu', text: '某自幼熟读兵书，岂一街亭不能守！' },
        { who: 'wangping', text: '当道扎营，守住汲水之路——切不可上山！' },
        { who: '{lord}', text: '我随参军同去。水源在，街亭在。' },
        { tip: true, text: '守住水源：张郃会派兵断汲道，汲水点被占时先夺回来。' },
      ] },
      bossIntro: { id: 'beifa-1.bossIntro', type: 'bossIntro', lines: [{ who: 'zhanghe', text: '张郃在此！断其汲道，蜀军自乱！' }] },
      bossPhase: { id: 'beifa-1.bossPhase', type: 'bossPhase', lines: [{ who: 'zhanghe', text: '围住水源！一个也别放过！' }] },
      bossFall: { id: 'beifa-1.bossFall', type: 'bossFall', lines: [{ who: 'zhanghe', text: '郃……死于此地，也不后退……' }] },
    },
    2: {
      brief: { id: 'beifa-2.brief', type: 'stageBrief', kicker: '12-2 · 军情', title: '陈仓', lines: [
        { text: '再出散关，围陈仓。守将郝昭只千余人，筑城坚守。' },
        { who: 'weiyan', text: '何必在此耽搁！给某五千精兵，出子午谷，十日可到长安！', ifNotLord: ['weiyan'] },
        { who: '{lord}', text: '给某五千精兵，出子午谷，十日可到长安！', ifLord: ['weiyan'] },
        { who: 'zhuge', text: '此悬危之计，亮不取。先下陈仓，稳扎稳打。' },
        { who: 'jiangwei', text: '郝昭守城有法。先拆他城头箭楼，再以冲车撞门。' },
        { tip: true, text: '先破城门、拆城头箭楼，箭雨停了再进城战郝昭。' },
      ] },
      bossIntro: { id: 'beifa-2.bossIntro', type: 'bossIntro', lines: [{ who: 'haozhao', text: '郝伯道在此！陈仓城下，叫你寸步难进！' }] },
      bossPhase: { id: 'beifa-2.bossPhase', type: 'bossPhase', lines: [{ who: 'haozhao', text: '火箭！烧了他的云梯冲车！' }] },
      bossFall: { id: 'beifa-2.bossFall', type: 'bossFall', lines: [{ who: 'haozhao', text: '陈仓……守到了最后一人……' }] },
    },
    3: {
      brief: { id: 'beifa-3.brief', type: 'stageBrief', kicker: '12-3 · 军情', title: '五丈原', lines: [
        { text: '屯田渭滨，与司马懿隔渭对垒百余日。' },
        { who: 'zhuge', text: '司马懿坚壁不出。亮遣人送去巾帼妇人之服——看他出是不出。' },
        { who: 'jiangwei', text: '丞相夙兴夜寐，罚二十以上皆亲览……还望保重。' },
        { who: '{lord}', text: '最后一战。破司马懿，北伐功成！' },
        { tip: true, text: '司马懿三阶段：坚守不出 → 出营决战 → 天象异变。' },
      ] },
      bossIntro: { id: 'beifa-3.bossIntro', type: 'bossIntro', lines: [{ who: 'simayi', text: '诸葛孔明食少事烦，岂能久乎？——出营，决战！' }] },
      bossPhase: { id: 'beifa-3.bossPhase', type: 'bossPhase', lines: [{ who: 'simayi', text: '天象有变……将星摇动？全军压上！' }] },
      bossFall: { id: 'beifa-3.bossFall', type: 'bossFall', lines: [{ who: 'simayi', text: '撤！……此人用兵，吾不能及。' }] },
    },
  },
  camp: [
    { id: 'beifa.camp1', type: 'campTalk', lines: [
      { who: 'jiangwei', text: '丞相，维愿将平生所学，尽付北伐。', ifFollower: 'zhuge', ifNotLord: ['zhuge'] },
      { who: 'zhuge', text: '伯约，吾之兵法，后继有人矣。', ifFollower: 'zhuge', ifNotLord: ['zhuge'] },
    ] },
    { id: 'beifa.camp2', type: 'campTalk', lines: [
      { who: 'weiyan', text: '子午谷之计不用……丞相太谨慎了。', ifFollower: 'weiyan', ifNotLord: ['weiyan'] },
      { who: '{lord}', text: '谨慎，才走得到长安。', ifFollower: 'weiyan', ifNotLord: ['weiyan'] },
    ] },
    { id: 'beifa.camp3', type: 'campTalk', lines: [
      { who: 'zhaoyun', text: '箕谷疑兵那一路，云把辎重一件没丢。', ifFollower: 'zhaoyun', ifNotLord: ['zhaoyun'] },
      { who: '{lord}', text: '子龙老当益壮。', ifFollower: 'zhaoyun', ifNotLord: ['zhaoyun'] },
    ] },
  ],
  bonds: [],
};
