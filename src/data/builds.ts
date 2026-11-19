import { SCHOOLS, SCHOOL_IDS, tierOf, type SchoolId } from './schools';
/**
 * 战法（2026-11-19 流派重做，设计稿 tactic-schools-redesign.md）：标签 = 六大流派（data/schools.ts）。
 * - 每派 4 个战法；卸力、以战养战改成「基础成长」（general：不占 6 个战法格、不算任何流派）；反震只留在信物「玄铁镜」里（hidden：不再出卡）。
 * - 「势」按本派战法等级之和算（升级也涨势）+ 亲和 / 随行 / 信物 / 名马（BuildState.bonus、treasures、extraTags）。
 */
export type BuildTag = SchoolId;
export const TAG_NAMES: Record<BuildTag, string> = Object.fromEntries(SCHOOL_IDS.map(s => [s, SCHOOLS[s].name])) as Record<BuildTag, string>;
interface TacticDef { name: string; tag: BuildTag | null; desc: string; general?: true; hidden?: true }
export const TACTICS = {
 // —— 火攻（打出灼烧）——
 ember: { name: '火种', tag: 'fire', desc: '命中有20/30/40%概率点燃敌人3秒' },
 spread: { name: '蔓延', tag: 'fire', desc: '燃烧的敌人死亡时，点燃附近1/2/3名敌人' },
 hotwind: { name: '焚风', tag: 'fire', desc: '攻击燃烧中的敌人时伤害 +15/22/30%' },
 napalm: { name: '火油罐', tag: 'fire', desc: '每9/8/7秒往敌人最密处扔火油罐，地上烧3秒' },
 // —— 奇谋（打出迟滞 / 风 / 眩晕）——
 snare: { name: '绊阵', tag: 'stratagem', desc: '命中时普通敌人减速18/26/34%' },
 traction: { name: '牵机', tag: 'stratagem', desc: '命中时把周围2/3/4名敌人拉向命中点' },
 confinement: { name: '困军', tag: 'stratagem', desc: '被减速的敌人死亡时，把减速传给附近敌人' },
 gust: { name: '疾风', tag: 'stratagem', desc: '每10/9/8秒朝前吹一阵风，把一条线上的敌人推开' },
 // —— 弓弩（打出破甲）——
 eagle: { name: '鹰眼', tag: 'archery', desc: '暴击率 +5/8/12%' },
 sunder: { name: '断金', tag: 'archery', desc: '暴击给目标打上破甲3秒：受伤 +8/12/15%' },
 reap: { name: '夺魄', tag: 'archery', desc: '暴击精锐或首领时，伤害再 +10/15/20%' },
 concentration: { name: '凝神', tag: 'archery', desc: '站定1秒（或每2.5秒）下一击贯穿1/2/3名敌人' },
 // —— 骑突（打出冲势 / 震退）——
 windstep: { name: '踏风步', tag: 'cavalry', desc: '主动移动约3个身位后，下一击伤害 +10/15/20%' },
 flank: { name: '迂回袭', tag: 'cavalry', desc: '主动移动5/4/3.5个身位后，下一击波及附近3名敌人' },
 swift: { name: '疾行印', tag: 'cavalry', desc: '移速 +3/5/7%；移动中暴击率再 +3/5/7%' },
 stored_edge: { name: '蓄势冲锋', tag: 'cavalry', desc: '跑满约6个身位攒满冲势，下一击 +30/45/60% 并震退目标' },
 // —— 猛将（打出连击层 / 震荡）——
 chain: { name: '连环', tag: 'warrior', desc: '连续打同一个敌人，每次伤害 +2/3/4%，最多5层' },
 pursuit: { name: '追袭', tag: 'warrior', desc: '每命中6/5/4次，追击旁边1名敌人' },
 momentum: { name: '乘胜', tag: 'warrior', desc: '击杀后3秒内伤害 +4/6/8%，最多叠5层' },
 heavy_break: { name: '破阵重击', tag: 'warrior', desc: '每命中8/7/6次一次重击，震伤并震退附近2/3/4名敌人' },
 // —— 兵阵（部曲 / 随行）——
 coordination: { name: '协击', tag: 'formation', desc: '命中后附近2/3/4名士兵集火该敌人' },
 rally: { name: '整军', tag: 'formation', desc: '每6/5/4秒治疗附近血最少的2/3/4名士兵' },
 breakout: { name: '破围令', tag: 'formation', desc: '士兵被3名以上敌人围住时，推开敌人' },
 watch: { name: '守望', tag: 'formation', desc: '士兵受伤时，给周围血最少的士兵减伤' },
 // —— 基础成长（不占战法格、不算流派）/ 不再出卡 ——
 deflect: { name: '卸力', tag: null, general: true, desc: '下一次受到的伤害 -25/35/45%，冷却8/7/6秒' },
 warfeed: { name: '以战养战', tag: null, general: true, desc: '每击杀12/10/8名敌人，回复生命上限2/2.5/3%' },
 rebound: { name: '反震', tag: null, hidden: true, desc: '受伤时反击身边敌人（只由信物「玄铁镜」提供）' },
} as const satisfies Record<string, TacticDef>;
export type TacticId = keyof typeof TACTICS;
const TDEF = TACTICS as Readonly<Record<TacticId, TacticDef>>;
export function tacticSchool(id: TacticId): BuildTag | null { return TDEF[id]?.tag ?? null; }
export function tacticGeneral(id: TacticId): boolean { return !!TDEF[id]?.general; }
export function tacticHidden(id: TacticId): boolean { return !!TDEF[id]?.hidden; }
export const TREASURES = {
 iron_mirror: { name: '玄铁镜', tag: 'warrior', desc: '「反震」伤害再 +25%；没学反震时，受伤反击身边3名敌人（20%伤害）并减伤15%（冷却8秒）' },
 army_seal: { name: '守军印', tag: 'formation', desc: '守望额外保护1人、减伤提高10个百分点；单独触发为附近2人提供25%减伤。与回军鼓仅取较强效果，冷却5秒' },
 general_tally: { name: '点将符', tag: 'formation', desc: '命中后指挥附近2名士兵集火该目标2秒；已学协击时多指挥1人、集火延长1秒，与协击共用冷却' },
 return_drum: { name: '回军鼓', tag: 'formation', desc: '每6秒治疗附近2名最低生命士兵5%最大生命；已学整军时沿用更强治疗。受治疗者获得2.5秒20%减伤，不叠加' },
 control_disk: { name: '镇军盘', tag: 'stratagem', desc: '命中处生成约4个身位宽的阵法，持续1.8秒：阵内最多6名普通敌人减速25%、被慢慢吸向阵心；冷却6秒，对首领无效' },
 stored_jade: { name: '沉锋玉', tag: 'cavalry', desc: '攒满冲势后的命中释放弱冲击，0.25秒后再冲击一次；每次15%伤害，最多3人，冷却4秒' },
 soul_bell: { name: '追魂铃', tag: 'warrior', desc: '武器每命中8次，追击另一名敌人，造成40%伤害' },
 slayer_tally: { name: '斩将虎符', tag: 'archery', desc: '暴击精锐或首领时，追加25%伤害（每0.5秒最多一次）' },
 horse_order: { name: '走马令', tag: 'cavalry', desc: '主动移动约4个身位后，下次命中对周围敌人追加25%伤害' },
 wildfire_lamp: { name: '燎原灯', tag: 'fire', desc: '命中必定附加弱灼烧；燃烧的敌人死亡时点燃附近2人，传出去的火不会再传' },
 breaker_jade: { name: '破军佩', tag: 'warrior', desc: '武器每命中10次，震伤目标附近3名敌人，造成35%伤害' },
 revival_jade: { name: '回生玉佩', tag: 'cavalry', desc: '每关首次致命伤害保留1生命，并获得1秒无敌' },
 blood_jade: { name: '饮血佩', tag: 'warrior', desc: '武器命中时回复所造成伤害5%的生命（每秒最多回复生命上限的3%）' },
} as const satisfies Record<string, { name: string; tag: BuildTag; desc: string }>;
export type TreasureId = keyof typeof TREASURES;
/** 构筑存档：只存战法（宝物由穿着的信物注入）。2026-11-19 流派重做：开发期不兼容旧档，读档时丢掉已删除的旧 id。 */
export interface BuildSnapshot { tactics: Partial<Record<TacticId, number>>; treasures?: TreasureId[]; /** 军需商人「流派心法」研读过的派（每派一次，各 +1 势，本次征程有效）。 */ manuals?: BuildTag[]; }
/** 一派势的来源（构筑总览分项显示）。 */
export interface ShiSources { tactics: number; treasures: number; extra: number; bonus: number; manual: number }
export class BuildState {
 tactics: Partial<Record<TacticId, number>> = {};
 /** 本局生效的宝物 = 穿着的机制类信物（CharmEffects 注入）。 */
 treasures: TreasureId[] = [];
 /** 宝物强度（信物品质：蓝 0.8 / 紫 0.9 / 橙 1.0），没写为 1。 */
 treasurePower: Partial<Record<TreasureId, number>> = {};
 /** 额外计入的流派（护心镜计兵阵、虎钮印计兵阵…，CharmEffects 注入）。 */
 extraTags: BuildTag[] = [];
 /** 开局给的势：武将亲和、随行、名马（GameScene 开局写入，见 data/schools.ts SHI_SOURCES）。 */
 bonus: Partial<Record<BuildTag, number>> = {};
 /** 势的来源说明（构筑总览用）：如 {formation: ['随行 枪兵', '亲和 刘备']}。 */
 bonusNotes: Partial<Record<BuildTag, string[]>> = {};
 /** 研读过的「流派心法」（军需商人卖，每派一次 +1 势，随征程构筑存档）。 */
 manuals: BuildTag[] = [];
 /** 这一派还能不能研读心法。 */
 manualsRead(): readonly BuildTag[] { return this.manuals; }
 canManual(s: BuildTag): boolean { return SCHOOL_IDS.includes(s) && !this.manuals.includes(s); }
 power(id: TreasureId): number { return this.treasurePower[id] ?? 1; }
 /**
  * 2026-11-19 构筑上限随章节开放（wave-progression-redesign.md §4.4）：战法第五章起可精研到 Lv4、第九章起 Lv5。
  * 精研只加势（势 = 本派战法等级之和，冲 2 / 4 / 6 档与觉醒），战法本身效果停在 Lv3：level() 给效果用（最多 3），rank() 是实际等级。
  * rankCap 由战斗场景按章节设（营寨读征程构筑时沿用最近一次的值）。
  */
 static rankCap = 3;
 static rankCapFor(chapter: number): number { return chapter >= 9 ? 5 : chapter >= 5 ? 4 : 3; }
 rank(id: TacticId): number { return this.tactics[id] ?? 0; }
 level(id: TacticId): number { return Math.min(3, this.rank(id)); }
 /** 占战法格的种数（基础成长不占）。 */
 slots(): number { return (Object.keys(this.tactics) as TacticId[]).filter(id => TDEF[id] && !TDEF[id].general && this.rank(id) > 0).length; }
 canLearn(id: TacticId): boolean { const d = TDEF[id]; if (!d || d.hidden) return false; const cap = d.general ? 3 : BuildState.rankCap; return this.rank(id) < cap && (this.rank(id) > 0 || !!d.general || this.slots() < 6); }
 learn(id: TacticId): boolean { if (!this.canLearn(id)) return false; this.tactics[id] = this.rank(id) + 1; return true; }
 /** 各派的势。 */
 tags(): Record<BuildTag, number> {
  const out = Object.fromEntries(SCHOOL_IDS.map(s => [s, 0])) as Record<BuildTag, number>;
  for (const s of SCHOOL_IDS) { const src = this.sources(s); out[s] = src.tactics + src.treasures + src.extra + src.bonus + src.manual; }
  return out;
 }
 sources(s: BuildTag): ShiSources {
  let tactics = 0; for (const id of Object.keys(this.tactics) as TacticId[]) if (TDEF[id]?.tag === s) tactics += this.rank(id); // 精研 Lv4 / 5 也算势
  const treasures = [...new Set(this.treasures)].filter(id => TREASURES[id]?.tag === s).length;
  return { tactics, treasures, extra: this.extraTags.filter(t => t === s).length, bonus: this.bonus[s] ?? 0, manual: this.manuals.includes(s) ? 1 : 0 };
 }
 /** 某派当前档位（0 / 2 / 4 / 6）。 */
 tier(s: BuildTag): 0 | 2 | 4 | 6 { return tierOf(this.tags()[s]); }
 snapshot(): BuildSnapshot { return { tactics: { ...this.tactics }, ...(this.manuals.length ? { manuals: [...this.manuals] } : {}) }; }
 restore(data?: BuildSnapshot): void { this.tactics = {}; for (const [id, lv] of Object.entries(data?.tactics ?? {})) if (id in TACTICS && typeof lv === 'number') this.tactics[id as TacticId] = Math.max(0, Math.min(5, lv));
  this.manuals = [...new Set((Array.isArray(data?.manuals) ? data.manuals : []).filter(s => SCHOOL_IDS.includes(s)))]; }
 label(): string {
  const t = this.tags();
  return `战法 ${this.slots()}/6\n` + (Object.keys(this.tactics) as TacticId[]).map(id => TACTICS[id].name + ' Lv' + this.level(id)).join(' · ') + '\n'
   + SCHOOL_IDS.filter(s => t[s] > 0).map(s => `${SCHOOLS[s].name} 势${t[s]}`).join('  ');
 }
}
/** Player-facing descriptions show only the level being offered. */
export function tacticDescription(id: TacticId, level: number): string {
 if (level >= 4) return '精研 Lv.' + level + '：本派势 +1（冲流派档位 / 觉醒）\n战法效果已满（同 Lv.3）';
 const n = Math.max(1, Math.min(3, level)), i = n - 1;
 const descriptions: Record<TacticId, string> = {
 // 卡面：先写效果、后写条件，最多两行（2026-11-17 文案审校）
 deflect: '下一次受到的伤害 -' + [25, 35, 45][i] + '%。\n冷却' + [8, 7, 6][i] + '秒，首领的攻击也能卸。',
 rebound: '受伤时反击身边' + [3, 4, 5][i] + '名敌人，伤害为所受伤害的' + [35, 50, 65][i] + '%。',
 watch: '士兵受伤时，给周围血最少的' + [1, 2, 3][i] + '名士兵减伤' + [15, 20, 25][i] + '%，持续' + [1.5, 1.8, 2.1][i] + '秒。\n冷却5秒。',
 coordination: '命中后，附近' + [2, 3, 4][i] + '名士兵集火该敌人' + [2, 2.5, 3][i] + '秒。\n冷却' + [4, 3.5, 3][i] + '秒。',
 rally: '每' + [6, 5, 4][i] + '秒治疗附近血最少的' + [2, 3, 4][i] + '名士兵，\n各回复生命上限的' + [6, 9, 12][i] + '%。',
 breakout: '士兵被3名以上敌人围住时，推开最多' + [3, 4, 5][i] + '名敌人约' + ['0.8', '1', '1.4'][i] + '个身位。\n冷却' + [8, 7, 6][i] + '秒，对首领无效。',
 snare: '命中时普通敌人减速' + [18, 26, 34][i] + '%，持续' + [1, 1.3, 1.6][i] + '秒。\n精锐效果减半，对首领无效。',
 traction: '命中时把周围' + [2, 3, 4][i] + '名敌人拉向命中点（0.7秒），并减速12%。\n冷却' + [4, 3.5, 3][i] + '秒，对首领无效。',
 confinement: '被减速的敌人死亡时，把' + [15, 22, 30][i] + '%减速传给附近' + [2, 3, 4][i] + '名敌人，持续' + [.7, 1, 1.3][i] + '秒。\n传过去的减速不会再传。',
 gust: '每' + [10, 9, 8][i] + '秒朝前方吹一阵风，把一条线上的普通敌人推开约' + [2, 2.5, 3][i] + '个身位。\n对首领无效。',
 stored_edge: '跑满约6个身位攒满冲势，下一击伤害 +' + [30, 45, 60][i] + '%并震退目标。\n打出后重新攒。',
 heavy_break: '每命中' + [8, 7, 6][i] + '次一次重击：震伤附近' + [2, 3, 4][i] + '名敌人' + [30, 40, 50][i] + '%伤害，\n并把他们震退。',
 concentration: '站定1秒（或每2.5秒），下一击沿攻击方向贯穿' + n + '名敌人，\n造成' + [25, 35, 45][i] + '%伤害。',
 pursuit: `每命中${[6, 5, 4][i]}次，追击旁边1名敌人，造成${[25, 35, 45][i]}%伤害。`,
 chain: `连续打同一个敌人，每次伤害 +${[2, 3, 4][i]}%（最多5层）。\n1.5秒没打中就重新计算。`,
 momentum: `击杀后3秒内伤害 +${[4, 6, 8][i]}%，最多叠5层。\n继续击杀会刷新时间。`,
 eagle: `暴击率 +${[5, 8, 12][i]}%。\n暴击率最高65%。`,
 sunder: `暴击给敌人打上「破甲」3秒：\n受到的伤害 +${[8, 12, 15][i]}%。`,
 reap: `暴击精锐或首领时，伤害再 +${[10, 15, 20][i]}%。`,
 windstep: `主动移动约3个身位后，下一击伤害 +${[10, 15, 20][i]}%。\n触发后需要重新移动。`,
 flank: `主动移动约${['5', '4', '3.5'][i]}个身位后，下一击波及附近3名敌人，\n额外造成${[35, 45, 55][i]}%伤害。`,
 swift: `移速 +${[3, 5, 7][i]}%。\n移动中暴击率再 +${[3, 5, 7][i]}%。`,
 ember: `命中有${[20, 30, 40][i]}%概率点燃敌人3秒。\n每半秒灼烧一次，每次为该次伤害的10%。`,
 spread: `燃烧的敌人死亡时，点燃附近${n}名敌人。\n传过去的火较弱，不会再传。`,
 hotwind: `攻击燃烧中的敌人时伤害 +${[15, 22, 30][i]}%。`,
 napalm: `每${[9, 8, 7][i]}秒往身边敌人最密处扔一个火油罐，\n地上烧3秒、点燃踩进火里的敌人。`,
 warfeed: `每击杀${[12, 10, 8][i]}名敌人（含部下击杀），\n回复生命上限的${[2, 2.5, 3][i]}%。`,
 };
 return descriptions[id];
}
