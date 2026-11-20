import type { FollowerTemplate } from './recruits';
import type { CharacterId } from './characters';

/**
 * 首领招降（设计会话 surrender-spec.md，用户 2026-11-18 拍板「可以开工了」）：
 * 打败的首领可以劝降，按史实分档——可降 / 难降 / 宁死不降 / 必降（可降的特例）/ 剧情首领（不弹窗）/ 第一章（新手章，不弹窗）。
 * 键：章节 arc + '-' + 第几关 + ':' + 首领 id（与各战斗场景的 surrenderKey() 对应）。数值都是初值，交平衡会话。
 */
export type SurrenderTier = 'can' | 'hard' | 'never' | 'sure' | 'story' | 'silent' | 'meng' | 'retreat';
/** 同阵营降将在队（现身说法）用的阵营。 */
export type SurrenderCamp = 'dongzhuo' | 'zhangxiu' | 'yuan' | 'jingzhou' | 'yizhou' | 'wu' | 'nanzhong' | 'lubu' | 'wei' | 'gongsun' | 'hebei' | 'zhanglu' | 'xiliang';
/** 关系 / 旗标加成：某武将在队（主将或随行）、主公是谁、本存档已劝降过谁、本关的旗标。 */
export interface SurrenderBonus { kind: 'hero' | 'lord' | 'surrendered' | 'flag'; id: string; add: number; label: string }
export interface SurrenderDef {
  key: string; id: string; name: string; title: string; tier: SurrenderTier;
  template?: FollowerTemplate; camp?: SurrenderCamp;
  /** 以可玩武将身份加入（黄忠）。 */ hero?: CharacterId;
  bonuses?: SurrenderBonus[];
  /** 归降 / 拒绝台词（不含「名字：」前缀）。 */ yes?: string; no?: string;
  /** 主公是某人时换的拒绝台词（吕布对刘备）。 */ noIfLord?: { id: string; text: string };
  /** 某武将在队时换的拒绝台词（庞德对马超）。 */ noIfHero?: { id: string; text: string };
  /** 某武将在队时，拒绝前先由他说一句（夏侯渊：黄忠先开口）。 */ preIfHero?: { id: string; who: string; text: string };
  /** 本存档已劝降某人时换的归降台词（文丑：颜良已降）。 */ yesIfSurrendered?: { id: string; text: string };
  /** 这个条件生效时不弹窗（华雄：温酒斩华雄优先）。 */ skipIf?: 'wenjiu';
  /** 招降结果写剧情旗标（第五、六章起）：劝降成功写 yes、斩杀写 no（如 caimao = joined / slain、spared_huangzhong = true / false）。 */ flag?: { key: string; yes: string | boolean; no: string | boolean };
  /** 主公是某人时换的归降台词（蔡瑁对刘备：檀溪之事）。 */ yesIfLord?: { id: string; text: string };
  /** 某武将在队时，归降前先由他说一句、首领再换一句答（蔡瑁：魏延问襄阳放箭）。 */ yesPreIfHero?: { id: string; who: string; text: string; yes: string };
  /** 败退型（retreat）：打到底不倒地、说这句后淡出退走（没有时用剧本 bossFall）。 */ retreat?: string;
  /** 史实 / 演义依据（surrender-rules.md）；宁死不降的人在面板上照写。 */ reason?: string;
  /** 劝降前要先满足的条件（没满足时「劝降」置灰）。 */ need?: SurrenderNeed;
}
/** 前置条件：某武将在队 / 某人已归附（同伴本场已降也算）/ 本关旗标。 */
export interface SurrenderNeed { kind: 'hero' | 'surrendered' | 'flag'; id?: string; label: string }

export const SURRENDER_TIERS: Record<SurrenderTier, { seal: string; color: string; base: number }> = {
  can: { seal: '可降', color: '#7fd0b0', base: .55 },
  sure: { seal: '可降', color: '#7fd0b0', base: 1 },
  hard: { seal: '难降', color: '#f0c860', base: .15 },
  never: { seal: '宁死不降', color: '#e0503a', base: 0 },
  story: { seal: '', color: '#c9b38a', base: 0 },
  silent: { seal: '', color: '#c9b38a', base: 0 },
  meng: { seal: '', color: '#c9b38a', base: 0 },
  /** 败退型（dual-boss-spec「顺带发现」）：以后还要登场的首领——不弹窗，打到底淡出退走，照掉宝箱、照算击败首领。 */
  retreat: { seal: '', color: '#c9b38a', base: 0 },
};

/** 成功率与流程常数（初值）。 */
export const SURRENDER = {
  hpLine: .15, pressLine: .05, pressTimeoutMs: 20000,
  liubei: .10, renownPer: .02, renownMax: .10, sameCamp: .10, press: .15, cap: .90,
  failHeal: .25, failDamageMul: 1.2,
  persuadeProvisions: 60, executeProvisions: 25, mengProvisions: 120,
  /** 首领降将：留 4 季、名将价 500 × 0.6、橙色；降将栏 8 格。 */
  bossCaptiveSeasons: 4, captiveSlots: 8,
} as const;

/** 双首领关同伴加减（dual-boss-spec §3，初值）。 */
export const PARTNER_ODDS = { persuaded: .2, executed: -.1 } as const;
const D = (key: string, name: string, title: string, tier: SurrenderTier, o: Partial<SurrenderDef> = {}): SurrenderDef => ({ key, id: key.split(':')[1], name, title, tier, ...o });

const RAW_DEFS: readonly SurrenderDef[] = [
  // 第一章：新手章，三人宁死不降、不弹窗（倒下播剧本 bossFall）
  D('huangjin-1:zhangliang', '张梁', '人公将军', 'silent'), D('huangjin-2:zhangbao', '张宝', '地公将军', 'silent'), D('huangjin-3:zhangjiao', '张角', '大贤良师', 'silent'),
  // 第二章
  D('hulao-1:huaxiong', '华雄', '西凉骁将', 'never', { template: 'blade', camp: 'dongzhuo', skipIf: 'wenjiu', yes: '……某服了。董卓不仁，某不再替他卖命。', no: '关东鼠辈，也配劝我？' }),
  D('hulao-2:xurong', '徐荣', '玄菟猛将', 'hard', { template: 'blade', camp: 'dongzhuo', yes: '太师已不可辅……荣愿随将军。', no: '荣受太师厚恩，休得多言！' }),
  D('hulao-3:dongzhuo', '董卓', '太师', 'story'),
  D('lubu-1:lubu', '吕布', '飞将', 'hard', { template: 'spear', camp: 'lubu', bonuses: [{ kind: 'hero', id: 'diaochan', add: .2, label: '貂蝉在侧' }, { kind: 'lord', id: 'liubei', add: -.2, label: '大耳儿最叵信' }],
    yes: '明公得布，天下不足定也！', no: '要我吕奉先跪下？做梦！', noIfLord: { id: 'liubei', text: '大耳儿最叵信，你也配劝我？' } }),
  // 第三章
  D('qunxiong-1:lijue', '李傕', '西凉余部', 'hard', { template: 'spear', camp: 'dongzhuo', yes: '好汉不吃眼前亏——降了，降了！', no: '我李傕纵横西凉，岂向你低头！' }),
  D('qunxiong-2:zhangxiu', '张绣', '北地枪王', 'can', { template: 'spear', camp: 'zhangxiu', yes: '文和先生说过，识时务者为俊杰……绣愿降。', no: '宛城之仇未了，休想！' }),
  D('qunxiong-3:yuanshu', '袁术', '仲家伪帝', 'never', { no: '朕乃天子！岂向你等匹夫低头！' }),
  // 第四章
  // 双首领方案 A（dual-boss-spec，用户 2026-11-18）：4-1 白马颜良负伤败走（不弹窗）；4-2 延津颜良文丑同台，两人互为「已降 +20%」
  D('guandu-1:yanliang', '颜良', '河北上将', 'retreat'),
  D('guandu-2:yanliang', '颜良', '河北上将', 'never', { template: 'blade', camp: 'yuan', bonuses: [{ kind: 'surrendered', id: 'wenchou', add: .2, label: '文丑已降' }],
    yes: '袁公不能用人……良愿降。', yesIfSurrendered: { id: 'wenchou', text: '文丑兄弟都降了……良也降了罢。' }, no: '河北上将，只有战死，没有投降！' }),
  D('guandu-2:wenchou', '文丑', '河北上将', 'never', { template: 'spear', camp: 'yuan', bonuses: [{ kind: 'surrendered', id: 'yanliang', add: .2, label: '颜良已降' }],
    yes: '……文丑认栽。', yesIfSurrendered: { id: 'yanliang', text: '颜良兄弟都降了……罢，罢！' }, no: '要我降？先问我手中这杆枪！' }),
  D('guandu-3:chunyuqiong', '淳于琼', '乌巢守将', 'hard', { template: 'blade', camp: 'yuan', bonuses: [{ kind: 'flag', id: 'depotsAllBurned', add: .15, label: '粮仓尽焚' }],
    yes: '粮都烧了……琼还守什么。', no: '琼与袁公同为西园校尉，岂能背他！' }),
  // 第五章
  D('chibi-1:caochun', '曹纯', '虎豹骑统领', 'never', { no: '曹氏子弟，只有战死的，没有降的！' }),
  D('chibi-2:caimao', '蔡瑁', '荆州水军都督', 'can', { template: 'bow', camp: 'jingzhou', yes: '荆州降过一回，再降一回又何妨。', no: '丞相待我不薄，我岂能……休想！', flag: { key: 'caimao', yes: 'joined', no: 'slain' },
    yesPreIfHero: { id: 'weiyan', who: '魏延', text: '襄阳城上放箭拦皇叔的，可是你？', yes: '……当日各为其主。今日，愿为将军执鞭。' }, yesIfLord: { id: 'liubei', text: '皇叔……当年檀溪之事，瑁实有罪。' } }),
  D('chibi-3:caoren', '曹仁', '征南将军', 'retreat', { retreat: '……弃城，退守襄阳。' }), // 败退型：9-1 还要登场
  // 第六章（赵范、刘度、黄忠必降）
  D('jingnan-1:zhaofan', '赵范', '桂阳太守', 'sure', { template: 'bow', camp: 'jingzhou', yes: '某本无心抗拒，愿献桂阳印绶，从将军调遣。', flag: { key: 'zhaofan', yes: 'joined', no: 'slain' } }),
  D('jingnan-2:liudu', '刘度', '零陵太守', 'sure', { template: 'strategist', camp: 'jingzhou', yes: '零陵小郡，岂敢逆天兵？愿举城归降。', flag: { key: 'liudu', yes: 'joined', no: 'slain' } }),
  D('jingnan-3:huangzhong', '黄忠', '长沙老将', 'sure', { camp: 'jingzhou', hero: 'huangzhong', yes: '韩玄无道，忠岂为昏主殉身？愿随将军，以报知遇。', flag: { key: 'spared_huangzhong', yes: true, no: false } }),
  D('jingnan-3:hanxuan', '韩玄', '长沙太守', 'story'),
  // 第七章
  D('shu-1:yanghuai', '杨怀', '白水关守将', 'hard', { template: 'bow', camp: 'yizhou', bonuses: [{ kind: 'hero', id: 'pangtong', add: .15, label: '凤雏在侧' }], yes: '刘季玉暗弱……怀愿开关。', no: '白水关在，杨怀在！' }),
  D('shu-2:zhangren', '张任', '益州名将', 'never', { no: '老臣终不复事二主！' }),
  D('shu-3:liuzhang', '刘璋', '益州牧', 'story'),
  // 第八章
  D('hanzhong-1:zhanghe', '张郃', '魏国名将', 'retreat', { retreat: '阳平关守不住了——退守定军山！' }), // 败退型：8-2、12-1 还要登场
  D('hanzhong-2:xiahouyuan', '夏侯渊', '征西将军', 'never', { no: '夏侯妙才，宁死阵前！', preIfHero: { id: 'huangzhong', who: '黄忠', text: '夏侯渊，老夫的刀，可还快？' } }),
  D('hanzhong-3:caocao', '曹操', '魏王', 'story'),
  // 第九章（庞德：本关胜利后于禁自动进降将栏）
  D('xiangfan-1:caoren', '曹仁', '征南将军', 'never', { no: '曹子孝生为魏臣，死为魏鬼！' }),
  D('xiangfan-2:pangde', '庞德', '立义将军', 'never', { no: '吾宁为国家鬼，不为贼将！', noIfHero: { id: 'machao', text: '孟起……各为其主，休要多言！' } }),
  D('xiangfan-3:lvmeng', '吕蒙', '东吴大都督', 'story'),
  // 第十章
  D('yiling-1:sunhuan', '孙桓', '孙氏宗亲', 'never', { no: '孙家儿郎，岂有降将！' }),
  D('yiling-2:zhuran', '朱然', '东吴重臣', 'hard', { template: 'blade', camp: 'wu', bonuses: [{ kind: 'hero', id: 'sunshangxiang', add: .15, label: '孙夫人在侧' }], yes: '然输得心服口服。', no: '然与吴侯同窗共读，岂能负他！' }),
  D('yiling-3:luxun', '陆逊', '东吴大都督', 'story'),
  // 第十一章（孟获七擒：不弹窗，章末心服，直接入麾下）
  D('nanzheng-1:mangyachang', '忙牙长', '南蛮大将', 'can', { template: 'blade', camp: 'nanzhong', bonuses: [{ kind: 'hero', id: 'zhuge', add: .15, label: '丞相攻心' }], yes: '丞相不杀，忙牙长服了！', no: '南人只服大王！' }),
  D('nanzheng-2:wutugu', '兀突骨', '乌戈国主', 'never', { template: 'blade', camp: 'nanzhong', bonuses: [{ kind: 'hero', id: 'zhuge', add: .15, label: '丞相攻心' }], yes: '火……藤甲怕火……乌戈国降了！', no: '藤甲刀枪不入，降什么！' }),
  D('nanzheng-3:menghuo', '孟获', '南蛮王', 'meng', { template: 'blade', camp: 'nanzhong', yes: '公，天威也！南人不复反矣。' }),
  // 第十二章
  D('beifa-1:zhanghe', '张郃', '魏国名将', 'never', { no: '郃受魏国厚恩，今日唯有一死！' }),
  D('beifa-2:haozhao', '郝昭', '陈仓守将', 'never', { no: '我受国恩多而门户重，但有必死耳！' }),
  D('beifa-3:simayi', '司马懿', '魏大都督', 'story'),
  // 其他势力支线（data/sideRoutes.ts，other-factions-design.md）：键 '<支线>-<关>:<首领>'；劝降一次性（打过的关不能再打）
  // 吕布 · 下邳（第三章后）
  D('xiapi-1:caoxing', '曹性', '吕布部将', 'can', { template: 'bow', camp: 'lubu', yes: '小沛守不住了……曹性愿降。', no: '温侯待我不薄，休想！' }),
  D('xiapi-2:gaoshun', '高顺', '陷阵营', 'never', { template: 'blade', camp: 'lubu', bonuses: [{ kind: 'surrendered', id: 'lubu', add: .3, label: '温侯已降' }],
    yes: '温侯都降了……陷阵营，听将军调遣。', yesIfSurrendered: { id: 'lubu', text: '温侯既已归顺，高顺岂敢独违。' }, no: '陷阵营只有战死的，没有降的！' }),
  D('xiapi-3:zhangliao', '张辽', '吕布骁将', 'can', { template: 'spear', camp: 'lubu', yes: '辽素闻将军仁义……愿效犬马之劳。', no: '大丈夫死则死耳，何惧之有！' }),
  D('xiapi-4:chengong', '陈宫', '公台', 'never', { no: '今日有死而已！请出就戮，以明军法。' }),
  D('xiapi-4:lubu', '吕布', '飞将', 'hard', { template: 'spear', camp: 'lubu', bonuses: [{ kind: 'hero', id: 'diaochan', add: .2, label: '貂蝉在侧' }, { kind: 'lord', id: 'liubei', add: -.2, label: '大耳儿最叵信' }],
    yes: '明公得布，天下不足定也！', no: '白门楼上，吕奉先宁死不跪！', noIfLord: { id: 'liubei', text: '大耳儿最叵信，你也配劝我？' } }),
  // 江东 · 南郡（第五章后）
  D('nanjun-1:chengpu', '程普', '江东老将', 'can', { template: 'blade', camp: 'wu', yes: '与公瑾共事，如饮醇醪……罢了，普愿降。', no: '老夫随孙破虏起兵，岂能降你！' }),
  D('nanjun-2:zhouyu', '周瑜', '江东都督', 'hard', { template: 'strategist', camp: 'wu', bonuses: [{ kind: 'hero', id: 'sunshangxiang', add: .2, label: '孙夫人在侧' }, { kind: 'hero', id: 'zhuge', add: -.1, label: '既生瑜，何生亮' }],
    yes: '……曲有误，周郎顾。今日这一曲，瑜输了。', no: '大丈夫处世，遇知己之主，岂能背之！', noIfHero: { id: 'zhuge', text: '既生瑜，何生亮！' } }),
  D('nanjun-2:taishici', '太史慈', '东莱信义之将', 'can', { template: 'bow', camp: 'wu', bonuses: [{ kind: 'surrendered', id: 'zhouyu', add: .2, label: '公瑾已降' }],
    yes: '大丈夫当带七尺之剑，以升天子之阶——慈愿随将军！', no: '慈许孙将军以死，不可失信！' }),
  // 中原 · 曹魏（第八章后）
  D('caowei-1:lidian', '李典', '曹营儒将', 'can', { template: 'blade', camp: 'wei', yes: '陈留已失……典愿降。', no: '典受曹公厚恩，岂肯降你！' }),
  D('caowei-2:xuchu', '许褚', '虎痴', 'hard', { template: 'blade', camp: 'wei', yes: '俺服了！你比俺还能打！', no: '俺只护着曹公，谁也别想劝俺！' }),
  D('caowei-3:yuejin', '乐进', '先登之将', 'can', { template: 'spear', camp: 'wei', yes: '许昌守不住了……进，降。', no: '先登之将，不知退字！' }),
  D('caowei-4:caocao', '曹操', '魏王', 'sure', { template: 'strategist', camp: 'wei', yes: '中原尽失，大势已去……天下英雄，唯使君与操耳。操，愿归附。', yesIfLord: { id: 'liubei', text: '玄德……煮酒论英雄，今日方知是你。操，归附。' } }),
  // 公孙瓒 · 幽州（第三章后）
  D('gongsun-1:tiankai', '田楷', '青州刺史', 'can', { template: 'bow', camp: 'gongsun', yes: '平原守不住了……楷愿降。', no: '公孙将军待我恩重，休想！' }),
  D('gongsun-2:yangang', '严纲', '白马义从统领', 'never', { template: 'spear', camp: 'gongsun', yes: '白马义从……听将军调遣。', no: '白马义从，只有战死的！' }),
  D('gongsun-3:gongsunzan', '公孙瓒', '白马将军', 'never', { template: 'spear', camp: 'gongsun', bonuses: [{ kind: 'hero', id: 'zhaoyun', add: .25, label: '子龙在侧' }],
    yes: '……子龙，你选的主公，果然不错。瓒，降了。', no: '易京楼在，公孙瓒在！', noIfHero: { id: 'zhaoyun', text: '子龙……你也来劝我？我公孙瓒岂是降人！' } }),
  D('gongsun-3:tianyu', '田豫', '幽州从事', 'can', { template: 'bow', camp: 'gongsun', bonuses: [{ kind: 'surrendered', id: 'gongsunzan', add: .2, label: '伯珪已降' }], yes: '豫早知易京难守……愿随将军。', no: '豫既事公孙，不改其志！' }),
  // 袁绍 · 河北（第四章后）
  D('hebei-1:gaolan', '高览', '河北名将', 'can', { template: 'blade', camp: 'hebei', yes: '袁公不能用人……览愿降。', no: '河北男儿，岂肯投降！' }),
  D('hebei-2:quyi', '麴义', '先登营', 'hard', { template: 'bow', camp: 'hebei', yes: '先登营服了你……愿听调遣。', no: '先登死士，宁死不退！' }),
  D('hebei-3:jushou', '沮授', '河北谋主', 'never', { template: 'strategist', camp: 'hebei', yes: '袁氏气数已尽……授愿为将军献策。', no: '授生为袁氏之臣，死为袁氏之鬼！' }),
  D('hebei-4:yuanshao', '袁绍', '四世三公', 'never', { template: 'strategist', camp: 'hebei', no: '我袁本初四世三公，岂向你低头！' }),
  D('hebei-4:shenpei', '审配', '河北忠臣', 'never', { no: '吾主在北，岂可南面而降！' }),
  // 荆州 · 江夏（第四章后）
  D('jiangxia-1:ganning', '甘宁', '锦帆贼', 'can', { template: 'bow', camp: 'jingzhou', yes: '黄祖不识人，宁早想另投明主——愿随将军！', no: '锦帆甘兴霸，岂是你劝得动的！' }),
  D('jiangxia-2:huangzu', '黄祖', '江夏太守', 'never', { template: 'bow', camp: 'jingzhou', bonuses: [], yes: '江夏……保不住了。祖，降。', no: '江夏是我的！谁也别想拿走！' }),
  D('jiangxia-2:wenpin', '文聘', '荆州大将', 'hard', { template: 'blade', camp: 'jingzhou', bonuses: [{ kind: 'surrendered', id: 'huangzu', add: .2, label: '黄祖已降' }], yes: '聘守不住江夏，愧对刘荆州……愿降。', no: '聘受刘荆州厚恩，宁死不降！' }),
  // 张鲁 · 汉中（第七章后）：张鲁史上封库归降 → 必降
  D('zhanglu-1:yangren', '杨任', '张鲁部将', 'never', { template: 'bow', camp: 'zhanglu', yes: '道坛已破……任愿降。', no: '师君待我不薄，休想！' }),
  D('zhanglu-2:zhanglu', '张鲁', '五斗米师君', 'sure', { template: 'strategist', camp: 'zhanglu', yes: '宝货仓库，国家之有……鲁封库以待，愿归附。' }),
  D('zhanglu-2:yanpu', '阎圃', '汉中功曹', 'can', { template: 'strategist', camp: 'zhanglu', bonuses: [{ kind: 'surrendered', id: 'zhanglu', add: .2, label: '师君已降' }], yes: '圃早劝师君归顺……愿随将军。', no: '圃事师君，不事二主！' }),
  // 西凉 · 马韩（第九章后）：马岱，马超在队必成（+100，仍受 90% 上限）
  D('xiliang-1:liangxing', '梁兴', '关西军阀', 'can', { template: 'spear', camp: 'xiliang', yes: '天水丢了……兴愿降。', no: '关西男儿，不跪外人！' }),
  D('xiliang-2:yanxing', '阎行', '西凉猛将', 'hard', { template: 'spear', camp: 'xiliang', yes: '……行服了。韩公那边，行也不回了。', no: '阎彦明只认韩公！' }),
  D('xiliang-3:hansui', '韩遂', '九曲黄河', 'hard', { template: 'blade', camp: 'xiliang', bonuses: [{ kind: 'surrendered', id: 'yanxing', add: .1, label: '阎行已降' }], yes: '九曲黄河，到头了……遂，降。', no: '老夫纵横西凉三十年，岂肯低头！' }),
  D('xiliang-3:madai', '马岱', '西凉骁将', 'can', { template: 'spear', camp: 'xiliang', bonuses: [{ kind: 'hero', id: 'machao', add: 1, label: '孟起在侧' }], yes: '兄长在此，岱还打什么——愿随兄长！', no: '岱身在西凉，不能弃韩公而去！' }),
  // 东吴 · 江东（第十章后）：孙权归附（江东城全下）
  D('dongwu-1:jiangqin', '蒋钦', '江东水将', 'can', { template: 'spear', camp: 'wu', yes: '庐江丢了……钦愿降。', no: '吴侯待我恩重，休想！' }),
  D('dongwu-2:huanggai', '黄盖', '江东老将', 'hard', { template: 'blade', camp: 'wu', yes: '老夫三世事孙氏……今日，罢了，降了。', no: '老夫苦肉都受过，还怕你这一刀？' }),
  D('dongwu-3:sunquan', '孙权', '吴侯', 'sure', { template: 'strategist', camp: 'wu', yes: '江东诸城尽失……父兄基业，权守不住了。愿归附。' }),
  D('dongwu-3:zhoutai', '周泰', '江东猛将', 'hard', { template: 'blade', camp: 'wu', bonuses: [{ kind: 'surrendered', id: 'sunquan', add: .3, label: '吴侯已降' }], yesIfSurrendered: { id: 'sunquan', text: '主公既降，泰这条命，便随主公。' }, yes: '泰……服了。', no: '泰身被十二创，也要护着主公！' }),
  // 南中 · 银坑（第十一章后）：七擒之后南中心服 → 洞主必降
  D('nanzhong-1:mengyou', '孟优', '孟获之弟', 'can', { template: 'blade', camp: 'nanzhong', bonuses: [{ kind: 'surrendered', id: 'menghuo', add: .2, label: '兄长已降' }], yes: '兄长都服了，优还打什么——降了！', no: '南人只服兄长！' }),
  D('nanzhong-2:dailai', '带来洞主', '祝融之弟', 'sure', { template: 'blade', camp: 'nanzhong', yes: '姐夫都服了……带来也服了！' }),
  D('nanzhong-2:duosi', '朵思大王', '秃龙洞主', 'sure', { template: 'blade', camp: 'nanzhong', yes: '毒泉都挡不住你们……朵思服了！' }),
  D('caowei-4:xiahoudun', '夏侯惇', '独眼将军', 'hard', { template: 'blade', camp: 'wei', bonuses: [{ kind: 'surrendered', id: 'caocao', add: .3, label: '孟德已降' }],
    yes: '孟德都降了……惇随他便是。', yesIfSurrendered: { id: 'caocao', text: '孟德既已归附，惇岂敢独违。' }, no: '父精母血，不可弃也——惇宁死不降！' }),
];
/**
 * 谁能劝降、谁不能（共享笔记 surrender-rules.md，2026-11-19 用户「有些武将角色可以抓降伏，有的不行，要合理」）：
 * 每人一句史实 / 演义依据（宁死不降的人在劝降面板上照写，玩家不用白点）；need = 劝降前要先满足的条件（没满足时「劝降」置灰、写条件）。
 */
export const SURRENDER_RULES: Readonly<Record<string, { reason: string; need?: SurrenderNeed }>> = {
  'huangjin-1:zhangliang': { reason: '太平道首领，以教众为命，不会向官军低头' },
  'huangjin-2:zhangbao': { reason: '太平道首领，以教众为命，不会向官军低头' },
  'huangjin-3:zhangjiao': { reason: '大贤良师，黄天当立，宁死不改其道' },
  'hulao-1:huaxiong': { reason: '董卓骁将，演义温酒斩于关羽刀下（史为孙坚所斩），至死未降' },
  'hulao-2:xurong': { reason: '董卓死后曾归顺朝廷，立场摇摆，可以劝动' },
  'hulao-3:dongzhuo': { reason: '权奸国贼，废立天子，天下共讨之，无降可言' },
  'lubu-1:lubu': { reason: '白门楼上自请归降、愿为曹公平天下；只是刘备一句「丁原董卓」断了生路' },
  'qunxiong-1:lijue': { reason: '反复无常的西凉余部，形势不利便肯低头' },
  'qunxiong-2:zhangxiu': { reason: '史上两度降曹（贾诩之谋），识时务' },
  'qunxiong-3:yuanshu': { reason: '僭号称帝的仲家天子，至死不肯屈尊' },
  'guandu-1:yanliang': { reason: '白马负伤败走，此战不论降否' },
  'guandu-2:yanliang': { reason: '河北上将，白马之战为关羽所斩，至死未降' },
  'guandu-2:wenchou': { reason: '河北上将，延津之战阵亡，至死未降' },
  'guandu-3:chunyuqiong': { reason: '乌巢被擒，曹操本欲赦之；粮仓尽焚、大势已去时方肯低头', need: { kind: 'flag', id: 'depotsAllBurned', label: '先焚尽乌巢粮仓' } },
  'chibi-1:caochun': { reason: '曹氏宗亲、虎豹骑统领，曹家子弟无降者' },
  'chibi-2:caimao': { reason: '荆州降过一回，见风使舵' },
  'chibi-3:caoren': { reason: '弃城败走，此战不论降否（第九章还要再战）' },
  'jingnan-1:zhaofan': { reason: '演义里赵云兵临桂阳，赵范开城投降' },
  'jingnan-2:liudu': { reason: '演义里零陵太守刘度举城而降' },
  'jingnan-3:huangzhong': { reason: '韩玄无道，黄忠义释关羽后弃暗投明；被击杀则负伤遁去，第八章前来投' },
  'jingnan-3:hanxuan': { reason: '为魏延所杀，剧情首领' },
  'shu-1:yanghuai': { reason: '刘璋部将，守关不坚，凤雏在侧时更易动摇' },
  'shu-2:zhangren': { reason: '「老臣终不复事二主」，落凤坡后被擒不降而死' },
  'shu-3:liuzhang': { reason: '开城出降，剧情处理' },
  'hanzhong-1:zhanghe': { reason: '退守定军山，此战不论降否' },
  'hanzhong-2:xiahouyuan': { reason: '曹氏宗亲，定军山为黄忠所斩' },
  'hanzhong-3:caocao': { reason: '退兵剧情首领（支线「中原 · 曹魏」可归附）' },
  'xiangfan-1:caoren': { reason: '曹氏宗亲，死守樊城' },
  'xiangfan-2:pangde': { reason: '抬榇决战，「吾宁为国家鬼，不为贼将」，被擒不降而死' },
  'xiangfan-3:lvmeng': { reason: '剧情首领' },
  'yiling-1:sunhuan': { reason: '孙氏宗亲，夷道死守' },
  'yiling-2:zhuran': { reason: '东吴重臣，孙夫人在侧时尚可一劝' },
  'yiling-3:luxun': { reason: '剧情首领' },
  'nanzheng-1:mangyachang': { reason: '南蛮大将，丞相攻心为上' },
  'nanzheng-2:wutugu': { reason: '火烧藤甲，与三万藤甲兵同葬盘蛇谷' },
  'nanzheng-3:menghuo': { reason: '七擒七纵，第七次方心服——章末直接入麾下' },
  'beifa-1:zhanghe': { reason: '魏国名将，木门道中伏而死' },
  'beifa-2:haozhao': { reason: '「我受国恩多而门户重，但有必死耳」' },
  'beifa-3:simayi': { reason: '剧情首领' },
  // 支线
  'xiapi-1:caoxing': { reason: '吕布部将，城破时肯降' },
  'xiapi-2:gaoshun': { reason: '陷阵营主将，白门楼上一言不发，引颈受戮' },
  'xiapi-3:zhangliao': { reason: '史上下邳城破后降曹，后成名将' },
  'xiapi-4:chengong': { reason: '白门楼拒降就义：「请出就戮，以明军法」，曹操垂泪送之' },
  'xiapi-4:lubu': { reason: '白门楼上自请归降、愿为明公平天下' },
  'nanjun-1:chengpu': { reason: '江东老将，与周瑜不睦，可以一劝' },
  'nanjun-2:zhouyu': { reason: '蒋干说之不动；老将程普素敬公瑾（「若饮醇醪」），程普先降并现身说法，周瑜才肯坐下来谈', need: { kind: 'surrendered', id: 'chengpu', label: '程普已降（江陵外围劝降程普）' } },
  'nanjun-2:taishici': { reason: '神亭酣战后降孙策，信义之将，服人不服势' },
  'caowei-1:lidian': { reason: '曹营儒将，城破可降' },
  'caowei-2:xuchu': { reason: '只护曹公一人；曹公归附，他才肯随', need: { kind: 'surrendered', id: 'caocao', label: '曹操已归附' } },
  'caowei-3:yuejin': { reason: '先登之将，城破可降' },
  'caowei-4:caocao': { reason: '可玩武将，以「归附」处理：中原尽失、大势已去，一代枭雄审时度势' },
  'caowei-4:xiahoudun': { reason: '「父精母血」拔矢啖睛，只随孟德', need: { kind: 'surrendered', id: 'caocao', label: '曹操已归附' } },
  'gongsun-1:tiankai': { reason: '公孙瓒所置青州刺史，平原难守可降' },
  'gongsun-2:yangang': { reason: '白马义从统领，界桥之战阵亡' },
  'gongsun-3:gongsunzan': { reason: '易京楼破，自焚而死，至死不降' },
  'gongsun-3:tianyu': { reason: '先事刘备、后归曹魏，不拘一主' },
  'hebei-1:gaolan': { reason: '官渡时与张郃一同降曹' },
  'hebei-2:quyi': { reason: '恃功骄纵、与袁绍不睦，可以一劝' },
  'hebei-3:jushou': { reason: '被擒后「授不降也」，谋归袁氏而被杀' },
  'hebei-4:yuanshao': { reason: '四世三公，官渡败后呕血而死，至死不向人低头——城全下也不归附' },
  'hebei-4:shenpei': { reason: '邺城破，「吾主在北」面北受刑' },
  'jiangxia-1:ganning': { reason: '黄祖不能用，史上弃黄祖投吴，锦帆贼本无定主' },
  'jiangxia-2:huangzu': { reason: '为孙权所破，被擒斩首' },
  'jiangxia-2:wenpin': { reason: '刘琮降后归曹，素有忠名，难劝' },
  'zhanglu-1:yangren': { reason: '阳平关死战，阵亡' },
  'zhanglu-2:zhanglu': { reason: '史上封库归降：「宝货仓库，国家之有」' },
  'zhanglu-2:yanpu': { reason: '劝张鲁归顺的功曹' },
  'xiliang-1:liangxing': { reason: '关西军阀，见势不妙就降' },
  'xiliang-2:yanxing': { reason: '史上弃韩遂投曹，立场摇摆' },
  'xiliang-3:hansui': { reason: '九曲黄河，屡降屡叛，难劝' },
  'xiliang-3:madai': { reason: '马超之弟，兄在则随兄' },
  'dongwu-1:jiangqin': { reason: '江东水将，可劝' },
  'dongwu-2:huanggai': { reason: '三世老臣，苦肉计诈降过——这回是真是假难说' },
  'dongwu-3:sunquan': { reason: '史上曾向曹丕称臣为吴王；江东城全下时审时度势「归附」' },
  'dongwu-3:zhoutai': { reason: '身被十二创护孙权，只随主公', need: { kind: 'surrendered', id: 'sunquan', label: '孙权已归附' } },
  'nanzhong-1:mengyou': { reason: '孟获之弟，兄长心服则随' },
  'nanzhong-2:dailai': { reason: '七擒之后南中心服' },
  'nanzhong-2:duosi': { reason: '七擒之后南中心服' },
};
/** 招降表（RAW_DEFS + 每人的依据 / 前置条件）。 */
export const SURRENDER_DEFS: readonly SurrenderDef[] = RAW_DEFS.map(d => ({ ...d, ...SURRENDER_RULES[d.key] }));
/** 不在招降表、但同样宁死不降的人（招贤馆 / 悬赏名单里剔除）：典韦（宛城战死护主）、陈宫（白门楼拒降就义）。 */
export const NEVER_EXTRA: readonly string[] = ['典韦', '陈宫'];
const NEVER_NAMES = new Set([...RAW_DEFS.filter(d => d.tier === 'never' || d.tier === 'story' || d.tier === 'silent').map(d => d.name), ...NEVER_EXTRA]);
/** 这个名字能不能出现在招贤馆 / 悬赏俘获名单里（宁死不降、剧情首领不行）。 */
export function recruitableName(name: string): boolean { return !NEVER_NAMES.has(name); }
/** 前置条件满足没（同伴本场已降也算「已归附」）。 */
export function needMet(d: SurrenderDef, c: Pick<OddsCtx, 'team' | 'surrendered' | 'flags' | 'partner'>): boolean {
  const n = d.need; if (!n) return true;
  if (n.kind === 'hero') return c.team.includes(n.id ?? '');
  if (n.kind === 'surrendered') return c.surrendered.includes(n.id ?? '') || (c.partner?.id === n.id && !!c.partner?.persuaded);
  return !!c.flags[n.id ?? ''];
}
/** 剧情附送：9-2 胜利后于禁乞降（不掷骰，进降将栏）。 */
export const YUJIN = { id: 'yujin', name: '于禁', template: 'blade' as FollowerTemplate, camp: 'yuan' as SurrenderCamp, yes: '禁……禁愿降。', banner: '于禁七军尽没 · 于禁乞降' };

const BY_KEY = new Map(SURRENDER_DEFS.map(d => [d.key, d]));
export function surrenderDef(key: string | null | undefined): SurrenderDef | null { return key ? BY_KEY.get(key) ?? null : null; }
/** 首领 id → 阵营（同阵营降将在队用；含于禁）。 */
export function campOf(id: string): SurrenderCamp | undefined { return id === YUJIN.id ? YUJIN.camp : SURRENDER_DEFS.find(d => d.id === id && d.camp)?.camp; }
/** 弹窗的档（剧情 / 第一章 / 孟获不弹窗）。 */
export const parleyTier = (d: SurrenderDef | null): boolean => !!d && (d.tier === 'can' || d.tier === 'hard' || d.tier === 'never' || d.tier === 'sure');

export interface OddsCtx {
  lord: string;
  /** 主将与随行武将（可玩武将 id）。 */ team: readonly string[];
  /** 本存档劝降成功过的首领 id（仁名、关系加成）。 */ surrendered: readonly string[];
  /** 随行里的首领降将 id（同阵营现身说法）。 */ followerBosses: readonly string[];
  /** 本关旗标（粮仓尽焚等）。 */ flags: Readonly<Record<string, boolean>>;
  /** 选过「再压一压」。 */ pressed: boolean;
  /** 双首领关：同伴的结果（已降 +20%，已被斩 −10%）。 */ partner?: { id: string; persuaded: boolean; executed: boolean };
  /** 本存档以礼厚葬过的宁死不降之将（也算仁名）。 */ honored?: readonly string[];
}
export interface Odds { pct: number; sure: boolean; parts: Array<{ label: string; add: number }>; /** 前置条件没满足：写条件（劝降置灰）。 */ blocked?: string }
/**
 * 成功率 = 档位基础 + 主公刘备仁德 + 仁名（每降 1 名首领 +2%，最多 +10%）+ 同阵营降将在队（+10%，只算一次）+ 关系 / 旗标 + 再压一压（+15%）；
 * 上限 90%；必降 100%（不掷骰）；宁死不降 0。
 */
export function surrenderOdds(d: SurrenderDef, c: OddsCtx): Odds {
  if (!needMet(d, c)) return { pct: 0, sure: false, parts: [], blocked: d.need!.label };
  if (d.tier === 'sure') return { pct: 100, sure: true, parts: [{ label: '必成', add: 100 }] };
  if (d.tier !== 'can' && d.tier !== 'hard') return { pct: 0, sure: false, parts: [] };
  const S = SURRENDER, parts: Odds['parts'] = [{ label: '基础', add: SURRENDER_TIERS[d.tier].base }];
  if (c.lord === 'liubei') parts.push({ label: '刘备仁德', add: S.liubei });
  const renown = Math.min(S.renownMax, S.renownPer * [...c.surrendered, ...(c.honored ?? [])].filter(id => id !== d.id).length); if (renown > 0) parts.push({ label: '仁名', add: renown });
  if (d.camp && c.followerBosses.some(id => id !== d.id && campOf(id) === d.camp)) parts.push({ label: '同阵营降将现身说法', add: S.sameCamp });
  for (const b of d.bonuses ?? []) {
    const hit = b.kind === 'hero' ? c.team.includes(b.id) : b.kind === 'lord' ? c.lord === b.id : b.kind === 'surrendered' ? c.surrendered.includes(b.id) : !!c.flags[b.id];
    if (hit) parts.push({ label: b.label, add: b.add });
  }
  // 双首领关：同伴已降 +20%（颜良文丑表里已写「某某已降」的不重复加）、同伴被斩 −10%
  if (c.partner?.persuaded && !parts.some(p => p.add > 0 && d.bonuses?.some(b => b.kind === 'surrendered' && b.id === c.partner!.id && b.label === p.label))) parts.push({ label: '同伴已降', add: PARTNER_ODDS.persuaded });
  if (c.partner?.executed) parts.push({ label: '同伴被斩', add: PARTNER_ODDS.executed });
  if (c.pressed) parts.push({ label: '再压一压', add: S.press });
  const sum = parts.reduce((n, p) => n + p.add, 0);
  return { pct: Math.round(Math.max(0, Math.min(S.cap, sum)) * 100), sure: false, parts: parts.map(p => ({ label: p.label, add: Math.round(p.add * 100) })) };
}
/** 归降 / 拒绝台词（按条件换句）。 */
export function surrenderLine(d: SurrenderDef, ok: boolean, c: { lord: string; team: readonly string[]; surrendered: readonly string[] }): string {
  if (ok) { if (d.yesPreIfHero && c.team.includes(d.yesPreIfHero.id)) return d.yesPreIfHero.yes; if (d.yesIfLord && c.lord === d.yesIfLord.id) return d.yesIfLord.text; return d.yesIfSurrendered && c.surrendered.includes(d.yesIfSurrendered.id) ? d.yesIfSurrendered.text : d.yes ?? '……愿降。'; }
  if (d.noIfLord && c.lord === d.noIfLord.id) return d.noIfLord.text;
  if (d.noIfHero && c.team.includes(d.noIfHero.id)) return d.noIfHero.text;
  return d.no ?? '休想！';
}
