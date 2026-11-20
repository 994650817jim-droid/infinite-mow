/**
 * 道具（兵装）数据：品质、槽位、词条、32 种基础道具、15 件橙色名器、掉率与保底。
 * 局外持久：战斗中掉落 → 结算带回行囊 → 每位武将各穿一套（4 槽：甲胄、头盔、战靴、信物），战斗中也可换装。
 * 2026-11-16 改版（用户批准 gear-revamp-proposal.md）：去掉兵刃槽；坐骑改为马厩收藏（data/mounts.ts HORSES），不再随机掉落。
 * 只放数据与纯函数；存取见 systems/ItemStore.ts，战场掉落见 systems/ItemDrops.ts。
 */

import { TIGER_SEAL_PRIMARY, charmAllowed, charmDef, charmsFor, type CharmDef } from './charms';
export type ItemQuality = 'white' | 'green' | 'blue' | 'purple' | 'orange';
/** 'relic' = 「Boss遗物」槽（2026-11-17 用户批准：首领遗珍统一放这里，只能装 1 件）。普通掉落 / 商人只出 GEAR_SLOTS 四槽。 */
export type ItemSlot = 'armor' | 'helm' | 'boots' | 'token' | 'relic';
export type AffixId = 'damage' | 'attackSpeed' | 'crit' | 'hp' | 'move' | 'reduce' | 'pickup' | 'xp' | 'ally' | 'regen' | 'elite';
export type SpecialId = 'fury' | 'windrider' | 'bloodthirst' | 'slayer' | 'scholar' | 'rally' | 'ironwall' | 'swift'
  // 首领遗珍专属机制（2026-11-16，boss-drops-proposal.md 首批 10 件；战斗实现见 systems/BossRelics.ts）
  | 'fushui' | 'jiujie' | 'zhanjiang' | 'xiangguo' | 'jiying' | 'bainiao' | 'weixi' | 'jiuhu' | 'hubao' | 'louchuan';

export const QUALITY_ORDER: readonly ItemQuality[] = ['white', 'green', 'blue', 'purple', 'orange'];

/** 品质：颜色（数字给 Graphics，css 给文字）、词条数、数值倍率、分解所得钱。边框画法见 ui/ItemQuality.ts。 */
export const QUALITIES: Record<ItemQuality, { name: string; label: string; color: number; css: string; dark: number; affixes: number; minor: boolean; mult: number; salvage: number }> = {
  white: { name: '普通', label: '白', color: 0xd8d2c4, css: '#d8d2c4', dark: 0x2a2722, affixes: 1, minor: false, mult: 1, salvage: 2 },
  green: { name: '优秀', label: '绿', color: 0x5fbf6a, css: '#6fd07a', dark: 0x16301a, affixes: 2, minor: false, mult: 1.3, salvage: 5 },
  blue: { name: '精良', label: '蓝', color: 0x4a90e2, css: '#6aa8f0', dark: 0x132a45, affixes: 2, minor: true, mult: 1.7, salvage: 12 },
  purple: { name: '传奇', label: '紫', color: 0xa35fd6, css: '#c08af0', dark: 0x2c1640, affixes: 3, minor: true, mult: 2.2, salvage: 30 },
  orange: { name: '史诗', label: '橙', color: 0xe8892e, css: '#f2a24e', dark: 0x3d220c, affixes: 3, minor: true, mult: 2.8, salvage: 80 },
};

/** 兵刃槽去掉后，「武器伤害」「对精锐」并入信物，攻速在战靴、暴击在头盔（数值交平衡会话复核）。 */
export const SLOTS: Record<ItemSlot, { name: string; affixes: readonly AffixId[] }> = {
  armor: { name: '甲胄', affixes: ['hp', 'reduce', 'regen'] },
  helm: { name: '头盔', affixes: ['hp', 'reduce', 'crit', 'xp'] },
  boots: { name: '战靴', affixes: ['move', 'attackSpeed', 'pickup'] },
  token: { name: '信物', affixes: ['ally', 'xp', 'regen', 'elite', 'damage'] },
  relic: { name: '首领遗珍', affixes: [] },
};
export const SLOT_ORDER: readonly ItemSlot[] = ['armor', 'helm', 'boots', 'token', 'relic'];
/** 普通兵装四槽（掉落、商人货架用）。 */
export const GEAR_SLOTS: readonly ItemSlot[] = ['armor', 'helm', 'boots', 'token'];

/** 词条：白色品质的基础值；percent 表示按百分比显示。gearCap 为全身兵装（含坐骑）叠加的上限。 */
export const AFFIXES: Record<AffixId, { name: string; base: number; percent: boolean; gearCap: number }> = {
  damage: { name: '武器伤害', base: .03, percent: true, gearCap: .4 },
  attackSpeed: { name: '攻击速度', base: .02, percent: true, gearCap: .25 },
  crit: { name: '暴击率', base: .01, percent: true, gearCap: .12 },
  hp: { name: '生命上限', base: .04, percent: true, gearCap: .6 },
  move: { name: '移动速度', base: .015, percent: true, gearCap: .15 },
  reduce: { name: '受到伤害', base: .02, percent: true, gearCap: .25 },
  pickup: { name: '拾取范围', base: .06, percent: true, gearCap: .6 },
  xp: { name: '经验获取', base: .03, percent: true, gearCap: .4 },
  ally: { name: '友军伤害', base: .03, percent: true, gearCap: .4 },
  regen: { name: '每秒回血', base: .3, percent: false, gearCap: 3 },
  elite: { name: '首领精锐伤害' /* 2026-11-19：原「对精锐 / 首领伤害」太长，商人卡片里把数值折成两行 */, base: .04, percent: true, gearCap: .4 },
};
export const AFFIX_IDS = Object.keys(AFFIXES) as AffixId[];

export const SPECIALS: Record<SpecialId, { name: string; desc: string }> = {
  fury: { name: '背水', desc: '生命低于 35% 时，伤害 +25%' },
  windrider: { name: '踏风', desc: '生命低于 35% 时，移速 +20%' },
  bloodthirst: { name: '饮血', desc: '击杀回复 1% 最大生命（每 0.5 秒一次）' },
  slayer: { name: '斩将', desc: '对首领伤害额外 +25%' },
  scholar: { name: '博闻', desc: '经验获取额外 +15%' },
  rally: { name: '振旅', desc: '友军伤害额外 +15%' },
  ironwall: { name: '金汤', desc: '受到伤害额外 −10%' },
  swift: { name: '迅雷', desc: '攻速额外 +10%' },
  fushui: { name: '人公符水', desc: '每拾取 40 颗军功宝石，召出 1 名黄巾力士助战 20 秒（最多 3 名）' },
  jiujie: { name: '天公落雷', desc: '每 15 秒落雷劈周围生命最多的 3 名敌人；本局每击杀 50 人落雷伤害 +10%（最多 +100%）' },
  zhanjiang: { name: '斩将', desc: '对每个精锐 / 首领的第一击必定暴击，且这一击伤害再翻倍' },
  xiangguo: { name: '相国征敛', desc: '本局每击杀 120 人，下一次升级可连选两张卡，并免费换一批 1 次' },
  jiying: { name: '辕门戟影', desc: '本命武器每第 8 次命中，甩出一道贯穿直线的戟影（150% 伤害，穿透所有敌人）' },
  bainiao: { name: '百鸟朝凤', desc: '连续命中同一目标 5 次后，扇形刺出 6 道枪芒（每道 60% 伤害，冷却 4 秒）' },
  weixi: { name: '伪帝玺', desc: '出征开局直接获得 1 张随机战法（Lv1，计流派件数）；代价：受到伤害 +15%' },
  jiuhu: { name: '乌巢豪饮', desc: '拾取酒罐 / 酒葫芦后 8 秒内伤害 +40%，但走路踉跄（方向随机偏转）' },
  hubao: { name: '虎豹骑', desc: '落马后 60 秒可重新上马（每战一次）；骑马践踏伤害 ×2' },
  louchuan: { name: '楼船火攻', desc: '每 12 秒放出一列火船，横扫主将附近的航道' },
};

export interface BaseItemDef { id: string; slot: ItemSlot; name: string; primary: AffixId }
/** 4 槽 × 8 种 = 32 种基础道具；第一条词条固定为 primary，其余随机。旧兵刃 / 坐骑道具见 LEGACY_*（只用于旧档迁移）。 */
export const BASE_ITEMS: readonly BaseItemDef[] = [
  // 甲胄
  { id: 'leather_armor', slot: 'armor', name: '皮甲', primary: 'hp' },
  { id: 'lamellar', slot: 'armor', name: '札甲', primary: 'reduce' },
  { id: 'fish_scale', slot: 'armor', name: '鱼鳞甲', primary: 'reduce' },
  { id: 'chain_armor', slot: 'armor', name: '锁子甲', primary: 'hp' },
  { id: 'rhino_armor', slot: 'armor', name: '犀皮甲', primary: 'reduce' },
  { id: 'cloth_armor', slot: 'armor', name: '絮衣', primary: 'regen' },
  { id: 'bright_plate', slot: 'armor', name: '明光铠', primary: 'hp' },
  { id: 'bamboo_armor', slot: 'armor', name: '竹札甲', primary: 'regen' },
  // 头盔
  { id: 'head_wrap', slot: 'helm', name: '武弁', primary: 'xp' },
  { id: 'iron_helm', slot: 'helm', name: '铁胄', primary: 'reduce' },
  { id: 'plume_helm', slot: 'helm', name: '鹖冠', primary: 'crit' },
  { id: 'leather_cap', slot: 'helm', name: '皮弁', primary: 'hp' },
  { id: 'bronze_helm', slot: 'helm', name: '青铜盔', primary: 'reduce' },
  { id: 'scholar_cap', slot: 'helm', name: '进贤冠', primary: 'xp' },
  { id: 'horn_helm', slot: 'helm', name: '兜鍪', primary: 'hp' },
  { id: 'red_band', slot: 'helm', name: '绛帻', primary: 'crit' },
  // 战靴
  { id: 'straw_sandal', slot: 'boots', name: '草履', primary: 'move' },
  { id: 'leather_boot', slot: 'boots', name: '皮靴', primary: 'move' },
  { id: 'cloud_boot', slot: 'boots', name: '云头履', primary: 'attackSpeed' },
  { id: 'iron_greave', slot: 'boots', name: '铁护胫', primary: 'move' },
  { id: 'hunter_boot', slot: 'boots', name: '猎靴', primary: 'pickup' },
  { id: 'felt_boot', slot: 'boots', name: '毡靴', primary: 'pickup' },
  { id: 'march_boot', slot: 'boots', name: '行縢', primary: 'move' },
  { id: 'tiger_boot', slot: 'boots', name: '虎头靴', primary: 'attackSpeed' },
  // 信物
  { id: 'jade_pendant', slot: 'token', name: '玉佩', primary: 'regen' },
  { id: 'tiger_seal', slot: 'token', name: '虎钮印', primary: 'ally' },
  { id: 'bamboo_slip', slot: 'token', name: '兵书竹简', primary: 'xp' },
  { id: 'war_flag', slot: 'token', name: '牙旗', primary: 'ally' },
  { id: 'bronze_mirror', slot: 'token', name: '铜镜', primary: 'elite' },
  { id: 'incense', slot: 'token', name: '香囊', primary: 'regen' },
  { id: 'arrow_token', slot: 'token', name: '令箭', primary: 'elite' },
  { id: 'gold_seal', slot: 'token', name: '金印', primary: 'xp' },
];

export interface LegendDef { id: string; slot: ItemSlot; name: string; affixes: readonly AffixId[]; special: SpecialId; lore: string }
/** 15 件橙色名器：词条固定（数值仍按橙色倍率），外加一条专属特效。只在橙色品质掉落。三把名剑 / 名刀改为信物「佩剑」；名驹赤兔、的卢、绝影移入马厩。 */
export const LEGENDS: readonly LegendDef[] = [
  { id: 'qinggang', slot: 'token', name: '青釭剑', affixes: ['damage', 'crit', 'elite'], special: 'slayer', lore: '削铁如泥，曹操佩剑' },
  { id: 'yitian', slot: 'token', name: '倚天剑', affixes: ['damage', 'attackSpeed', 'crit'], special: 'fury', lore: '与青釭并称双剑' },
  { id: 'gudingdao', slot: 'token', name: '古锭刀', affixes: ['damage', 'elite', 'attackSpeed'], special: 'swift', lore: '江东猛将所用' },
  { id: 'beast_armor', slot: 'armor', name: '兽面吞头铠', affixes: ['hp', 'reduce', 'regen'], special: 'ironwall', lore: '护心兽首，刀枪难入' },
  { id: 'silver_armor', slot: 'armor', name: '亮银甲', affixes: ['hp', 'reduce', 'crit'], special: 'bloodthirst', lore: '白袍银甲，七进七出' },
  { id: 'rattan_armor', slot: 'armor', name: '藤甲', affixes: ['reduce', 'regen', 'move'], special: 'windrider', lore: '浸油晒干，轻而坚' },
  { id: 'purple_crown', slot: 'helm', name: '紫金冠', affixes: ['crit', 'hp', 'damage'], special: 'fury', lore: '束发三叉，威风凛凛' },
  { id: 'phoenix_helm', slot: 'helm', name: '凤翅盔', affixes: ['hp', 'reduce', 'xp'], special: 'ironwall', lore: '双翅高耸' },
  { id: 'kerchief', slot: 'helm', name: '纶巾', affixes: ['xp', 'crit', 'regen'], special: 'scholar', lore: '羽扇纶巾，谈笑间' },
  { id: 'cloud_boots', slot: 'boots', name: '踏云靴', affixes: ['move', 'attackSpeed', 'pickup'], special: 'windrider', lore: '行如流云' },
  { id: 'tiger_boots', slot: 'boots', name: '虎皮战靴', affixes: ['move', 'attackSpeed', 'damage'], special: 'swift', lore: '踏阵如虎' },
  { id: 'fleet_boots', slot: 'boots', name: '神行履', affixes: ['move', 'pickup', 'xp'], special: 'scholar', lore: '日行三百里' },
  { id: 'taiping', slot: 'token', name: '太平要术残卷', affixes: ['xp', 'regen', 'elite'], special: 'scholar', lore: '南华老仙所授' },
  { id: 'imperial_seal', slot: 'token', name: '传国玉玺', affixes: ['ally', 'xp', 'hp'], special: 'rally', lore: '受命于天，既寿永昌' },
  { id: 'bagua_mirror', slot: 'token', name: '八卦镜', affixes: ['reduce', 'regen', 'elite'], special: 'bloodthirst', lore: '奇门遁甲，八阵之枢' },
];

export interface ItemAffix { id: AffixId; value: number; minor?: boolean }
/** 一件道具实例（存档里的样子）。 */
export interface ItemInstance { uid: string; base: string; quality: ItemQuality; affixes: ItemAffix[]; special?: SpecialId }

const BASE_BY_ID = new Map(BASE_ITEMS.map(b => [b.id, b]));
/**
 * 首领遗珍（2026-11-16 用户批准 boss-drops-proposal.md 首批 10 件）：首领专属，固定词条 + 专属机制，永不分解。
 * stage = 首领所在关的关卡键（同马厩赠马；吕布挑战关为 lubu）。第一章紫色，第二章起橙色。数值为初值，交平衡会话测。
 */
export interface RelicDef { id: string; slot: ItemSlot; name: string; quality: 'purple' | 'orange'; affixes: readonly AffixId[]; special: SpecialId; boss: string; stage: string; lore: string }
export const BOSS_RELICS: readonly RelicDef[] = [
  { id: 'relic_fushui', slot: 'relic', name: '人公符水', quality: 'purple', affixes: ['ally', 'xp'], special: 'fushui', boss: '张梁', stage: 'huangjin-1', lore: '符水治病，聚众千万' },
  { id: 'relic_jiujie', slot: 'relic', name: '九节杖', quality: 'purple', affixes: ['damage', 'elite'], special: 'jiujie', boss: '张角', stage: 'huangjin-3', lore: '天公将军手持九节杖' },
  { id: 'relic_chize', slot: 'relic', name: '斩将赤帻', quality: 'orange', affixes: ['crit', 'hp'], special: 'zhanjiang', boss: '华雄', stage: 'hulao-1', lore: '汜水关前连斩数将' },
  { id: 'relic_xiangguo', slot: 'relic', name: '相国印', quality: 'orange', affixes: ['xp', 'ally'], special: 'xiangguo', boss: '董卓', stage: 'hulao-3', lore: '挟天子，擅朝政' },
  { id: 'relic_jiying', slot: 'relic', name: '辕门戟影', quality: 'orange', affixes: ['damage', 'crit'], special: 'jiying', boss: '吕布', stage: 'lubu', lore: '辕门射戟，一箭解围' },
  { id: 'relic_bainiao', slot: 'relic', name: '百鸟朝凤缨', quality: 'orange', affixes: ['crit', 'reduce'], special: 'bainiao', boss: '张绣', stage: 'third-2', lore: '北地枪王，百鸟朝凤' },
  { id: 'relic_weixi', slot: 'relic', name: '传国玉玺（伪）', quality: 'orange', affixes: ['elite', 'xp'], special: 'weixi', boss: '袁术', stage: 'third-3', lore: '仲家伪帝私刻之玺' },
  { id: 'relic_jiuhu', slot: 'relic', name: '乌巢酒葫', quality: 'orange', affixes: ['regen', 'hp'], special: 'jiuhu', boss: '淳于琼', stage: 'guandu-3', lore: '乌巢醉卧，粮尽兵溃' },
  { id: 'relic_hubao', slot: 'relic', name: '虎豹铁面', quality: 'orange', affixes: ['reduce', 'move'], special: 'hubao', boss: '曹纯', stage: 'chibi-1', lore: '虎豹骑统领之铁面' },
  { id: 'relic_louchuan', slot: 'relic', name: '楼船令旗', quality: 'orange', affixes: ['ally', 'damage'], special: 'louchuan', boss: '蔡瑁', stage: 'chibi-2', lore: '荆州水军都督令旗' },
];
const RELIC_BY_ID = new Map(BOSS_RELICS.map(r => [r.id, r]));
export function relicDef(base: string): RelicDef | undefined { return RELIC_BY_ID.get(base); }
export function isRelic(item: { base: string }): boolean { return RELIC_BY_ID.has(item.base); }
export function relicsForStage(stage: string | null | undefined): RelicDef[] { return stage ? BOSS_RELICS.filter(r => r.stage === stage) : []; }

const LEGEND_BY_ID = new Map(LEGENDS.map(l => [l.id, l]));
export function itemDef(base: string): { slot: ItemSlot; name: string; legend?: LegendDef; relic?: RelicDef; charm?: CharmDef } | undefined {
  const r = RELIC_BY_ID.get(base); if (r) return { slot: r.slot, name: r.name, relic: r };
  const c = charmDef(base); if (c) return { slot: 'token', name: c.name, charm: c };
  const l = LEGEND_BY_ID.get(base); if (l) return { slot: l.slot, name: l.name, legend: l };
  const b = BASE_BY_ID.get(base); return b && { slot: b.slot, name: b.name };
}
export function itemSlot(item: ItemInstance): ItemSlot { return itemDef(item.base)?.slot ?? 'token'; }

/** 旧档（im_items_v1）里已经下架的道具 id：普通兵刃按双倍分解价折钱；坐骑转入马厩（见 ItemStore.migrateV1）。 */
export const LEGACY_WEAPON_BASES: readonly string[] = ['sword_tassel', 'blade_ring', 'spear_tassel', 'bow_tip', 'whet_charm', 'bronze_guard', 'iron_pommel', 'jade_hilt'];
export const LEGACY_MOUNT_BASES: readonly string[] = ['nag', 'grey_horse', 'yellow_horse', 'black_horse', 'white_horse', 'red_horse', 'west_horse', 'mule', 'chitu', 'dilu', 'jueying'];
export function itemName(item: ItemInstance): string { return itemDef(item.base)?.name ?? '无名之物'; }

// —— 掉落 ——
/**
 * 掉落品质按章节（2026-11-19 用户：「前期不应该掉落这么好的装备，随着章节推动才会增加掉落品级」）：
 * 章节 1–12 分五段（LOOT_BAND_OF_CHAPTER）：0 = 一、二章；1 = 三、四章；2 = 五～七章；3 = 八～十章；4 = 十一、十二章。
 * 每段一张品质表（WEIGHTS，按来源）+ 品质封顶（LOOT_CAP：一、二章最多蓝，三、四章最多紫，五章起才有橙）。
 * 首领 / 章末首领用自己那一行（相当于比小兵高一档，仍不过封顶）；保底（PITY）只在本段封顶允许的品质上攒、上触发。
 * 乱世难度：段 +1（lootBand(章, true)）。攻城 / 军情 / 城中旅商按已开放的章节数（HeroProgress.chaptersOpen）。
 * finalBoss = 章末首领（掉 2 件）。函数参数 tier 指的就是这里的「段」。
 */
export const LOOT_BAND_OF_CHAPTER: readonly number[] = [0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4]; // 下标 = 章节（0 不用）
export const LOOT_CAP: readonly ItemQuality[] = ['blue', 'purple', 'orange', 'orange', 'orange'];
/** 章节 → 段（乱世 +1，封到最高段）。 */
export function lootBand(chapter: number, hard = false): number { const c = Math.max(1, Math.min(12, Math.round(chapter) || 1)); return Math.min(MAX_TIER, LOOT_BAND_OF_CHAPTER[c] + (hard ? 1 : 0)); }
/** 品质封到本段上限。 */
export function capLootQuality(q: ItemQuality, tier: number): ItemQuality { const cap = LOOT_CAP[Math.max(0, Math.min(MAX_TIER, Math.floor(tier)))]; return QUALITY_ORDER.indexOf(q) > QUALITY_ORDER.indexOf(cap) ? cap : q; }
/** 词条数值随章节：每章 +2.5%（十二章 ×1.275）。 */
export function affixChapterMul(chapter = 1): number { return 1 + .025 * (Math.max(1, Math.min(12, chapter)) - 1); }
export type DropSource = 'normal' | 'elite' | 'boss' | 'finalBoss' | 'chest' | 'merchant';
export const DROP_CHANCE: Record<'normal' | 'elite', number> = { normal: .004, elite: .06 };
export const MAX_TIER = 4;
/** 品质权重（%）：白 绿 蓝 紫 橙；每段一行（段 0 一、二章 … 段 4 十一、十二章）。宝箱与精锐同表；首领 / 章末首领高一档。都不超过 LOOT_CAP。 */
const WEIGHTS: Record<Exclude<DropSource, 'merchant'>, readonly (readonly number[])[]> = {
  normal: [[70, 28, 2, 0, 0], [35, 50, 14, 1, 0], [10, 40, 40, 9, 1], [0, 25, 45, 25, 5], [0, 10, 40, 38, 12]],
  elite: [[30, 60, 10, 0, 0], [5, 55, 35, 5, 0], [0, 30, 50, 17, 3], [0, 10, 45, 37, 8], [0, 0, 35, 48, 17]],
  chest: [[30, 60, 10, 0, 0], [5, 55, 35, 5, 0], [0, 30, 50, 17, 3], [0, 10, 45, 37, 8], [0, 0, 35, 48, 17]],
  boss: [[0, 55, 45, 0, 0], [0, 15, 65, 20, 0], [0, 0, 55, 40, 5], [0, 0, 30, 58, 12], [0, 0, 10, 65, 25]],
  finalBoss: [[0, 30, 70, 0, 0], [0, 0, 60, 40, 0], [0, 0, 35, 55, 10], [0, 0, 15, 65, 20], [0, 0, 0, 65, 35]],
};
/** 行营 / 城中军需商人：约比小兵掉落高半档；不出橙（商人没有橙装价格）。 */
const MERCHANT_WEIGHTS: readonly (readonly number[])[] = [[0, 75, 25, 0, 0], [0, 40, 55, 5, 0], [0, 10, 60, 30, 0], [0, 0, 45, 55, 0], [0, 0, 25, 75, 0]];
export const CHESTS_PER_STAGE: readonly number[] = [45, 110]; // 每关开打后第 45 / 110 秒各刷一个宝箱
/** 保底（按掉落件数计，跨局累计、分存档位，计数存在 ItemStore 的 pity）：连续 15 件没出紫 → 下一件必紫；连续 40 件没出橙 → 下一件必橙。 */
export const PITY = { purple: 15, orange: 40 } as const;
export interface PityState { sincePurple: number; sinceOrange: number }

export function rollQuality(source: DropSource, tier: number, rng: () => number = Math.random): ItemQuality {
  const t = Math.max(0, Math.min(MAX_TIER, Math.floor(tier))), w = source === 'merchant' ? MERCHANT_WEIGHTS[t] : WEIGHTS[source][t];
  const total = w.reduce((a, b) => a + b, 0); let r = rng() * total;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return capLootQuality(QUALITY_ORDER[i], t); }
  return capLootQuality(QUALITY_ORDER[w.length - 1], t);
}
/** 掉落品质 + 保底：先按权重抽，再看保底计数，最后更新计数（会改 pity）。保底只在本段封顶允许紫 / 橙时才攒、才触发（一、二章不会被保底送出紫橙）。商人货架不走这里。 */
export function rollDropQuality(source: Exclude<DropSource, 'merchant'>, tier: number, pity: PityState, rng: () => number = Math.random): ItemQuality {
  let q = rollQuality(source, tier, rng);
  const at = (x: ItemQuality) => QUALITY_ORDER.indexOf(x), cap = at(LOOT_CAP[Math.max(0, Math.min(MAX_TIER, Math.floor(tier)))]);
  const purpleOk = cap >= at('purple'), orangeOk = cap >= at('orange');
  if (orangeOk && pity.sinceOrange + 1 >= PITY.orange) q = 'orange';
  else if (purpleOk && pity.sincePurple + 1 >= PITY.purple && at(q) < at('purple')) q = 'purple';
  if (purpleOk) pity.sincePurple = at(q) >= at('purple') ? 0 : pity.sincePurple + 1;
  if (orangeOk) pity.sinceOrange = q === 'orange' ? 0 : pity.sinceOrange + 1;
  return q;
}

function pick<T>(list: readonly T[], rng: () => number): T { return list[Math.floor(rng() * list.length) % list.length]; }
const round3 = (v: number) => Math.round(v * 1000) / 1000;
/** 词条数值：基础值 × 品质倍率 × 0.85–1.15 浮动；小词条减半。 */
export function affixValue(id: AffixId, quality: ItemQuality, rng: () => number, minor = false, chapter = 1): number {
  return round3(AFFIXES[id].base * QUALITIES[quality].mult * (.85 + rng() * .3) * (minor ? .5 : 1) * affixChapterMul(chapter));
}

let uidSeq = 0;
export function newItemUid(): string { uidSeq = (uidSeq + 1) % 1e6; return Date.now().toString(36) + '-' + uidSeq.toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36); }

/** 信物里出新信物（原本局遗物 / 宝物）的概率：抽到信物栏时一半出它们。 */
export const CHARM_SHARE = .5;
/**
 * 生成一件信物库新信物（data/charms.ts）：固定效果按品质取值（不存在词条里），外加品质规定条数的随机小词条（白 1 … 橙 3）。
 * id 不填时从这一品质能出的里随机；品质不够时返回 null。
 */
export function rollCharm(quality: ItemQuality, rng: () => number = Math.random, id?: string, chapter = 1): ItemInstance | null {
  const def = id ? charmDef(id) : pick(charmsFor(quality), rng); if (!def || !charmAllowed(def, quality)) return null;
  const ids: AffixId[] = [], pool = SLOTS.token.affixes;
  while (ids.length < QUALITIES[quality].affixes) ids.push(pick(pool.filter(a => !ids.includes(a)), rng));
  return { uid: newItemUid(), base: def.id, quality, affixes: ids.map(a => ({ id: a, value: affixValue(a, quality, rng, true, chapter), minor: true })) };
}
/** 生成一件道具。橙色优先出名器（同槽位随机一件），slot 可指定。信物栏一半出信物库新信物（CHARM_SHARE）。 */
/** chapter：词条数值随章节放大（affixChapterMul；不填 = 第一章）。 */
export function rollItem(quality: ItemQuality, rng: () => number = Math.random, slot?: ItemSlot, chapter = 1): ItemInstance {
  if (quality === 'orange') {
    const pool = LEGENDS.filter(l => !slot || l.slot === slot), l = pick(pool, rng);
    if (l.slot === 'token' && rng() < CHARM_SHARE) { const c = rollCharm(quality, rng, undefined, chapter); if (c) return c; }
    const affixes: ItemAffix[] = l.affixes.map(id => ({ id, value: affixValue(id, quality, rng, false, chapter) }));
    const extra = AFFIX_IDS.filter(id => !l.affixes.includes(id));
    const m = pick(extra, rng); affixes.push({ id: m, value: affixValue(m, quality, rng, true, chapter), minor: true });
    return { uid: newItemUid(), base: l.id, quality, affixes, special: l.special };
  }
  const base = pick(BASE_ITEMS.filter(b => !slot || b.slot === slot), rng);
  if (base.slot === 'token' && rng() < CHARM_SHARE) { const c = rollCharm(quality, rng, undefined, chapter); if (c) return c; }
  return rollBase(base, quality, rng, chapter);
}
/** 按指定的基础道具生成一件（旧档迁移用，如虎符 → 橙色虎钮印）。不是基础道具时返回 null。 */
export function rollBaseItem(id: string, quality: ItemQuality, rng: () => number = Math.random, chapter = 1): ItemInstance | null { const b = BASE_BY_ID.get(id); return b ? rollBase(b, quality, rng, chapter) : null; }
function rollBase(base: BaseItemDef, quality: ItemQuality, rng: () => number, chapter = 1): ItemInstance {
  const q = QUALITIES[quality];
  const ids: AffixId[] = [base.primary];
  const pool = SLOTS[base.slot].affixes.filter(id => id !== base.primary), rest = AFFIX_IDS.filter(id => id !== base.primary);
  while (ids.length < q.affixes) { const from = pool.filter(id => !ids.includes(id)).length ? pool.filter(id => !ids.includes(id)) : rest.filter(id => !ids.includes(id)); ids.push(pick(from, rng)); }
  // 虎钮印并入虎符：主词条友军伤害上限提到 +20%（橙）
  const affixes: ItemAffix[] = ids.map(id => ({ id, value: round3(affixValue(id, quality, rng, false, chapter) * (base.id === 'tiger_seal' && id === base.primary ? TIGER_SEAL_PRIMARY : 1)) }));
  if (q.minor) { const m = pick(rest.filter(id => !ids.includes(id)), rng); affixes.push({ id: m, value: affixValue(m, quality, rng, true, chapter), minor: true }); }
  return { uid: newItemUid(), base: base.id, quality, affixes };
}

/** 生成一件首领遗珍：固定词条按其品质取值，外加一条随机小词条（重复获得时可挑词条）。 */
export function rollRelic(id: string, rng: () => number = Math.random): ItemInstance | null {
  const r = RELIC_BY_ID.get(id); if (!r) return null;
  const affixes: ItemAffix[] = r.affixes.map(a => ({ id: a, value: affixValue(a, r.quality, rng) }));
  const m = pick(AFFIX_IDS.filter(a => !r.affixes.includes(a)), rng); affixes.push({ id: m, value: affixValue(m, r.quality, rng, true), minor: true });
  return { uid: newItemUid(), base: r.id, quality: r.quality, affixes, special: r.special };
}

export function formatAffix(a: { id: AffixId; value: number }): string {
  const d = AFFIXES[a.id];
  if (!d.percent) return `${d.name} +${a.value.toFixed(1)}`;
  const pct = Math.round(a.value * 1000) / 10;
  return a.id === 'reduce' ? `${d.name} −${pct}%` : `${d.name} +${pct}%`;
}

/**
 * 行囊上限：只算未穿戴的道具（穿着的不占格）。超出时自动分解最低品质的白 / 绿 / 蓝；
 * 紫 / 橙永不自动分解，可超出上限最多 BAG_OVERFLOW 格（计数标红，提示手动分解）。
 */
export const BAG_CAPACITY = 60;
export const BAG_OVERFLOW = 20;
/** 行营军需商人道具货架价格（粮草）。 */
export const MERCHANT_PRICE: Partial<Record<ItemQuality, number>> = { green: 60, blue: 120, purple: 260 };
/**
 * 军需商人偶尔捎来 1 卷战法（2026-11-18 用户「军需商人也可能会卖功法」）：每次进营按 chance 判定一次（同一次休整里不重抽）；
 * price[已学等级]：0 = 新学 Lv.1、1 = 精进到 Lv.2、2 = 精进到 Lv.3（随军粮）。初值交平衡会话复核。逻辑在 systems/CampMarket.ts。
 */
export const MERCHANT_TACTIC = { chance: .35, price: [150, 190, 240] } as const;
/**
 * 行营军需商人（2026-11-17 用户：「军需商人只可以买装备」）：每次进营 4 件兵装，甲胄 / 头盔 / 战靴 / 信物各 1 件。
 * 品质按章节段（同掉落的 lootBand，表在 MERCHANT_WEIGHTS：约比小兵掉落高半档、不出白和橙）；tier = 段。
 */
export function rollMerchantGear(tier: number, rng: () => number = Math.random, chapter = 1): ItemInstance[] {
  return GEAR_SLOTS.map(slot => rollItem(rollQuality('merchant', tier, rng), rng, slot, chapter));
}
