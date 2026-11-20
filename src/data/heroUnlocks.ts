import type { CharacterId } from './characters';

/**
 * 可玩武将解锁（2026-11-19 用户「现在设计一下现在这些角色怎么解锁」，设计稿 共享笔记 hero-unlock-design.md，用户已批准）：
 * 开局只有桃园三兄弟 + 赵云；其余 8 位随主线「来投」。条件在 systems/HeroUnlocks.ts（按存档进度判定，不看卷轴是否播放）。
 * 用户定：诸葛亮第一章之后就来投（早年「卧龙」书信，第五章三顾茅庐改为「正式出山拜为军师」，只是剧情）；
 *        貂蝉「打完吕布来」——第三章章末白门楼，或天下地图挑战「三英战吕布」先赢了就先来。
 * 文案：锁定剪影下只写通用提示 LOCKED_HINT（用户 11-19：「不用告诉哪一章来投，只告诉，需要去劝降招募」——不写章节 / 关卡 / 事件）；
 * 揭幕卡用 kicker / epithet / lines（每行一句，约 20 字以内）。
 */
export const STARTER_HEROES: readonly CharacterId[] = ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'];

/** 锁定剪影下的通用提示（不透露在哪一章来投）。 */
export const LOCKED_HINT = '尚未归附 · 需劝降招募';
export const LOCKED_TITLE = '尚未归附', LOCKED_HOW = '需劝降招募', LOCKED_TAG = '未归附';
export interface HeroJoinInfo {
  /** 揭幕卡顶部小字（什么时候、在哪）。 */ kicker: string;
  /** 称号（名字前的小字）。 */ epithet: string;
  /** 来投那一刻的两三句（揭幕卡正文）。 */ lines: readonly string[];
  /** 保底来投时换的正文（黄忠：长沙负伤遁去后伤愈来投）。 */ fallbackLines?: readonly string[];
}
export const HERO_JOIN: Readonly<Partial<Record<CharacterId, HeroJoinInfo>>> = {
  zhuge: { kicker: '第一章 · 黄巾平定', epithet: '卧龙',
    lines: ['广宗告捷，营中收到一封南阳隆中的书信。', '寥寥数语，竟把黄巾余部的去向一一料中。', '落款「卧龙」——愿以客卿之身，随军参谋。', '随信另附锦囊三枚：「危急时拆看。」'] },
  diaochan: { kicker: '吕布败亡', epithet: '闭月',
    lines: ['吕布已败，貂蝉素衣出城，拜于皇叔马前。', '「妾身一介女流，愿以双扇，随军效力。」'] },
  huangyueying: { kicker: '第五章 · 赤壁之后', epithet: '巧思',
    lines: ['赤壁鏖兵方罢，一辆木车送到营前。', '车上连弩、木牛，皆出黄氏月英之手。', '「夫君在江东借风，妾身便来造弩。」'] },
  sunshangxiang: { kicker: '第五章 · 孙刘联姻', epithet: '弓腰姬',
    lines: ['江陵既下，孙权进妹固好。', '夫人才捷刚猛，侍婢百余人皆亲执刀。', '「皇叔，往后战阵之事，妾身也要去！」'] },
  weiyan: { kicker: '第六章 · 长沙', epithet: '镇北',
    lines: ['长沙城门大开，魏延提韩玄首级来献。', '「某魏文长，愿为将军前驱！」'] },
  huangzhong: { kicker: '第六章 · 长沙', epithet: '老当益壮',
    lines: ['长沙城下，老将黄忠拜伏于地。', '「忠年近六旬，今日方遇明主。」'],
    fallbackLines: ['长沙一战负伤遁去的老将黄忠，伤愈来投。', '「定军山下，还须老夫这张弓。」'] },
  pangtong: { kicker: '第七章 · 入蜀', epithet: '凤雏',
    lines: ['凤雏庞统，随军西进入蜀。', '「卧龙、凤雏，两人得一可安天下——主公两人俱得。」'] },
  lvbu: { kicker: '下邳 · 白门楼', epithet: '飞将',
    lines: ['白门楼下，吕布卸甲解缚。', '「明公所患不过于布，今已服矣——天下不足忧！」', '方天画戟，从此为公所用。'] },
  mengde: { kicker: '许都', epithet: '魏王',
    lines: ['中原尽失，曹操卸下魏王冠冕，独自出城。', '「天下英雄，唯使君与操耳。」', '「操，愿归附——这天下，便看你我如何收拾。」'] },
  ganning: { kicker: '荆州 · 江夏', epithet: '锦帆',
    lines: ['江夏水寨，铃声渐近，锦帆贼甘宁弃了黄祖。', '「宁在江夏数年，黄祖以凡人畜之。」', '「明公若不弃，宁愿以百骑，为公劫营！」'] },
  taishici: { kicker: '江陵 · 南郡', epithet: '信义',
    lines: ['南郡城下，太史慈插戟于地，拱手而立。', '「大丈夫当带七尺之剑，以升天子之阶。」', '「慈愿随明公，再战三百合！」'] },
  zhouyu: { kicker: '江陵 · 南郡', epithet: '美周郎',
    lines: ['南郡城下，周瑜解下佩剑，抚琴一曲。', '「公瑾不才，愿以火攻之策，助明公定天下。」', '程普在侧，拱手而笑。'] },
  zhangliao: { kicker: '下邳 · 白门楼', epithet: '止啼',
    lines: ['白门楼下，张辽按剑不跪，坦然待死。', '「辽素闻将军仁义……愿效犬马之劳。」', '双戟收鞘，从此为公破阵。'] },
  machao: { kicker: '第七章 · 成都', epithet: '锦马超',
    lines: ['马超自汉中来投，屯兵成都城北。', '城中震怖，刘璋遂开城出降。'] },
};
