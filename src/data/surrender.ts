import type { FollowerTemplate } from './recruits';
import type { CharacterId } from './characters';

/**
 * 首领招降（设计会话 surrender-spec.md，用户 2026-11-18 拍板「可以开工了」）：
 * 打败的首领可以劝降，按史实分档——可降 / 难降 / 宁死不降 / 必降（可降的特例）/ 剧情首领（不弹窗）/ 第一章（新手章，不弹窗）。
 * 键：章节 arc + '-' + 第几关 + ':' + 首领 id（与各战斗场景的 surrenderKey() 对应）。数值都是初值，交平衡会话。
 */
export type SurrenderTier = 'can' | 'hard' | 'never' | 'sure' | 'story' | 'silent' | 'meng' | 'retreat';
/** 同阵营降将在队（现身说法）用的阵营。 */
export type SurrenderCamp = 'dongzhuo' | 'zhangxiu' | 'yuan' | 'jingzhou' | 'yizhou' | 'wu' | 'nanzhong' | 'lubu' | 'wei';
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
}

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
/** 支线终局再战：第 N 次再战劝降 +15% × N（场景 parleyFlags 只给当前那一档）。 */
const RETRY: SurrenderBonus[] = [1, 2, 3, 4, 5].map(n => ({ kind: 'flag', id: 'sideRetry' + n, add: .15 * n, label: '再战第 ' + n + ' 回' }));
const D = (key: string, name: string, title: string, tier: SurrenderTier, o: Partial<SurrenderDef> = {}): SurrenderDef => ({ key, id: key.split(':')[1], name, title, tier, ...o });

export const SURRENDER_DEFS: readonly SurrenderDef[] = [
  // 第一章：新手章，三人宁死不降、不弹窗（倒下播剧本 bossFall）
  D('huangjin-1:zhangliang', '张梁', '人公将军', 'silent'), D('huangjin-2:zhangbao', '张宝', '地公将军', 'silent'), D('huangjin-3:zhangjiao', '张角', '大贤良师', 'silent'),
  // 第二章
  D('hulao-1:huaxiong', '华雄', '西凉骁将', 'hard', { template: 'blade', camp: 'dongzhuo', skipIf: 'wenjiu', yes: '……某服了。董卓不仁，某不再替他卖命。', no: '关东鼠辈，也配劝我？' }),
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
  D('guandu-2:yanliang', '颜良', '河北上将', 'hard', { template: 'blade', camp: 'yuan', bonuses: [{ kind: 'surrendered', id: 'wenchou', add: .2, label: '文丑已降' }],
    yes: '袁公不能用人……良愿降。', yesIfSurrendered: { id: 'wenchou', text: '文丑兄弟都降了……良也降了罢。' }, no: '河北上将，只有战死，没有投降！' }),
  D('guandu-2:wenchou', '文丑', '河北上将', 'hard', { template: 'spear', camp: 'yuan', bonuses: [{ kind: 'surrendered', id: 'yanliang', add: .2, label: '颜良已降' }],
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
  D('nanzheng-2:wutugu', '兀突骨', '乌戈国主', 'hard', { template: 'blade', camp: 'nanzhong', bonuses: [{ kind: 'hero', id: 'zhuge', add: .15, label: '丞相攻心' }], yes: '火……藤甲怕火……乌戈国降了！', no: '藤甲刀枪不入，降什么！' }),
  D('nanzheng-3:menghuo', '孟获', '南蛮王', 'meng', { template: 'blade', camp: 'nanzhong', yes: '公，天威也！南人不复反矣。' }),
  // 第十二章
  D('beifa-1:zhanghe', '张郃', '魏国名将', 'never', { no: '郃受魏国厚恩，今日唯有一死！' }),
  D('beifa-2:haozhao', '郝昭', '陈仓守将', 'never', { no: '我受国恩多而门户重，但有必死耳！' }),
  D('beifa-3:simayi', '司马懿', '魏大都督', 'story'),
  // 其他势力支线（data/sideRoutes.ts，other-factions-design.md）：键 '<支线>-<关>:<首领>'；终局再战每次 +15%（RETRY）
  // 吕布 · 下邳（第三章后）
  D('xiapi-1:caoxing', '曹性', '吕布部将', 'can', { template: 'bow', camp: 'lubu', yes: '小沛守不住了……曹性愿降。', no: '温侯待我不薄，休想！' }),
  D('xiapi-2:gaoshun', '高顺', '陷阵营', 'hard', { template: 'blade', camp: 'lubu', bonuses: [{ kind: 'surrendered', id: 'lubu', add: .3, label: '温侯已降' }],
    yes: '温侯都降了……陷阵营，听将军调遣。', yesIfSurrendered: { id: 'lubu', text: '温侯既已归顺，高顺岂敢独违。' }, no: '陷阵营只有战死的，没有降的！' }),
  D('xiapi-3:zhangliao', '张辽', '吕布骁将', 'can', { template: 'spear', camp: 'lubu', yes: '辽素闻将军仁义……愿效犬马之劳。', no: '大丈夫死则死耳，何惧之有！' }),
  D('xiapi-4:lubu', '吕布', '飞将', 'hard', { template: 'spear', camp: 'lubu', bonuses: [{ kind: 'hero', id: 'diaochan', add: .2, label: '貂蝉在侧' }, { kind: 'lord', id: 'liubei', add: -.2, label: '大耳儿最叵信' }, ...RETRY],
    yes: '明公得布，天下不足定也！', no: '白门楼上，吕奉先宁死不跪！', noIfLord: { id: 'liubei', text: '大耳儿最叵信，你也配劝我？' } }),
  // 江东 · 南郡（第五章后）
  D('nanjun-1:chengpu', '程普', '江东老将', 'can', { template: 'blade', camp: 'wu', yes: '与公瑾共事，如饮醇醪……罢了，普愿降。', no: '老夫随孙破虏起兵，岂能降你！' }),
  D('nanjun-2:zhouyu', '周瑜', '江东都督', 'hard', { template: 'strategist', camp: 'wu', bonuses: [{ kind: 'hero', id: 'sunshangxiang', add: .2, label: '孙夫人在侧' }, { kind: 'hero', id: 'zhuge', add: -.1, label: '既生瑜，何生亮' }, ...RETRY],
    yes: '……曲有误，周郎顾。今日这一曲，瑜输了。', no: '大丈夫处世，遇知己之主，岂能背之！', noIfHero: { id: 'zhuge', text: '既生瑜，何生亮！' } }),
  D('nanjun-2:taishici', '太史慈', '东莱信义之将', 'can', { template: 'bow', camp: 'wu', bonuses: [{ kind: 'surrendered', id: 'zhouyu', add: .2, label: '公瑾已降' }],
    yes: '大丈夫当带七尺之剑，以升天子之阶——慈愿随将军！', no: '慈许孙将军以死，不可失信！' }),
  // 中原 · 曹魏（第八章后）
  D('caowei-1:lidian', '李典', '曹营儒将', 'can', { template: 'blade', camp: 'wei', yes: '陈留已失……典愿降。', no: '典受曹公厚恩，岂肯降你！' }),
  D('caowei-2:xuchu', '许褚', '虎痴', 'hard', { template: 'blade', camp: 'wei', yes: '俺服了！你比俺还能打！', no: '俺只护着曹公，谁也别想劝俺！' }),
  D('caowei-3:yuejin', '乐进', '先登之将', 'can', { template: 'spear', camp: 'wei', yes: '许昌守不住了……进，降。', no: '先登之将，不知退字！' }),
  D('caowei-4:caocao', '曹操', '魏王', 'sure', { template: 'strategist', camp: 'wei', yes: '中原尽失，大势已去……天下英雄，唯使君与操耳。操，愿归附。', yesIfLord: { id: 'liubei', text: '玄德……煮酒论英雄，今日方知是你。操，归附。' } }),
  D('caowei-4:xiahoudun', '夏侯惇', '独眼将军', 'hard', { template: 'blade', camp: 'wei', bonuses: [{ kind: 'surrendered', id: 'caocao', add: .3, label: '孟德已降' }],
    yes: '孟德都降了……惇随他便是。', yesIfSurrendered: { id: 'caocao', text: '孟德既已归附，惇岂敢独违。' }, no: '父精母血，不可弃也——惇宁死不降！' }),
];
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
}
export interface Odds { pct: number; sure: boolean; parts: Array<{ label: string; add: number }> }
/**
 * 成功率 = 档位基础 + 主公刘备仁德 + 仁名（每降 1 名首领 +2%，最多 +10%）+ 同阵营降将在队（+10%，只算一次）+ 关系 / 旗标 + 再压一压（+15%）；
 * 上限 90%；必降 100%（不掷骰）；宁死不降 0。
 */
export function surrenderOdds(d: SurrenderDef, c: OddsCtx): Odds {
  if (d.tier === 'sure') return { pct: 100, sure: true, parts: [{ label: '必成', add: 100 }] };
  if (d.tier !== 'can' && d.tier !== 'hard') return { pct: 0, sure: false, parts: [] };
  const S = SURRENDER, parts: Odds['parts'] = [{ label: '基础', add: SURRENDER_TIERS[d.tier].base }];
  if (c.lord === 'liubei') parts.push({ label: '刘备仁德', add: S.liubei });
  const renown = Math.min(S.renownMax, S.renownPer * c.surrendered.filter(id => id !== d.id).length); if (renown > 0) parts.push({ label: '仁名', add: renown });
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
