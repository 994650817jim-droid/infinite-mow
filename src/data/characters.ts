import type { ChapterId } from './chapters';
import type { WeaponId } from '../types';

export type CharacterId = 'zhaoyun' | 'guanyu' | 'huangzhong' | 'zhuge' | 'zhangfei' | 'machao' | 'weiyan' | 'liubei' | 'pangtong' | 'huangyueying' | 'sunshangxiang' | 'diaochan';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  desc: string;
  /** 临时占位：用赵云贴图 + 不同色调，正式立绘由 ChatGPT 生成后替换。 */
  tint?: number;
  /** 正式行走表未到位时，战斗内的占位色调。 */
  battleTint?: number;
  hpMul: number;
  speedMul: number;
  damageMul: number;
  portrait: string;
  /** 武将专属初始武器（开局固定，不再选择）。 */
  startWeapon: WeaponId;
  /** 选将卡上的势力印（缺省为蜀）。 */
  faction?: '蜀' | '吴' | '魏' | '群';
}

export interface RunConfig {
  encounter?: 'sishui' | 'xingyang' | 'qunxiong';
  thirdStage?:1|2|3;
  stage?: 1 | 2 | 3;
  westStage?: 1 | 2 | 3;
  chapter?: ChapterId;
  character: CharacterId;
  /** 兼容旧调试入口；正常开局由武将 startWeapon 决定。 */
  weapon?: WeaponId;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'zhaoyun',
    name: '赵云',
    desc: '均衡 · 移速与输出稳定',
    // 2026-11-15 平衡（用户批准）：生命 1 → 1.1、伤害 1 → 1.05（测量中承伤最高、DPS 中下）
    hpMul: 1.1,
    speedMul: 1,
    damageMul: 1.05,
    portrait: 'hero_zhaoyun',
    startWeapon: 'spear_orbit',
  },
  {
    id: 'guanyu',
    name: '关羽',
    desc: '重甲 · 生命高，移速略慢',
    battleTint: 0x9be0a8,
    hpMul: 1.25,
    speedMul: 0.92,
    // 2026-11-15 平衡（用户批准）：伤害 1.15 → 1.08（约 −6%，三关首领战输出领先）
    damageMul: 1.08,
    portrait: 'guanyu_portrait',
    startWeapon: 'guandao',
  },
  {
    id: 'huangzhong',
    name: '黄忠',
    desc: '老将 · 移速快，连弩弹射',
    battleTint: 0xffcf7a,
    hpMul: 0.9,
    speedMul: 1.06,
    damageMul: 0.95,
    portrait: 'huangzhong_portrait',
    startWeapon: 'crossbow',
  },
  {
    id: 'zhuge',
    name: '诸葛亮',
    desc: '军师 · 火焰范围爆发，生命较低',
    // 2026-11-15 平衡（用户批准）：生命 0.86 → 0.95（测量中阵亡次数最多）
    hpMul: 0.95,
    speedMul: 1.04,
    damageMul: 1.0,
    portrait: 'portrait_zhuge',
    startWeapon: 'flame_banner',
  },
  {
    id: 'zhangfei',
    name: '张飞',
    desc: '猛将 · 伤害高，怒吼震慑敌阵',
    hpMul: 1.1,
    speedMul: 0.96,
    damageMul: 1.2,
    portrait: 'zhangfei_portrait',
    startWeapon: 'spear_orbit',
  },
  {
    id: 'machao',
    name: '马超',
    desc: '突骑 · 移速快，满势冲锋破阵',
    hpMul: 1,
    speedMul: 1.1,
    damageMul: 1.1,
    portrait: 'machao_portrait',
    startWeapon: 'spear_orbit',
  },
  {
    id: 'weiyan',
    name: '魏延',
    desc: '悍将 · 劈地裂波，越挨打越勇',
    hpMul: 1.15,
    speedMul: 0.97,
    damageMul: 1.05,
    portrait: 'weiyan_portrait',
    startWeapon: 'zhenbei_blade',
  },
  {
    id: 'liubei',
    name: '刘备',
    desc: '仁君 · 部曲坚韧，仁德聚义',
    hpMul: 1.05,
    speedMul: 1,
    damageMul: 1,
    portrait: 'liubei_portrait',
    startWeapon: 'guandao',
  },
  {
    id: 'pangtong',
    name: '庞统',
    desc: '军师 · 布雷设伏，连环引爆',
    hpMul: 0.95,
    speedMul: 1,
    damageMul: 1.05,
    portrait: 'pangtong_portrait',
    startWeapon: 'lianhuan_mines',
  },
  {
    id: 'huangyueying',
    name: '黄月英',
    desc: '巧匠 · 机关连弩，远程压制',
    hpMul: 0.88,
    speedMul: 1.04,
    damageMul: 1,
    portrait: 'huangyueying_portrait',
    startWeapon: 'crossbow',
  },
  {
    id: 'sunshangxiang',
    name: '孙尚香',
    desc: '弓腰姬 · 移速快，边走边射，环身连射',
    hpMul: 0.9,
    speedMul: 1.08,
    damageMul: 1,
    portrait: 'sunshangxiang_portrait',
    startWeapon: 'crossbow',
    faction: '吴',
  },
  {
    id: 'diaochan',
    name: '貂蝉',
    desc: '舞姬 · 生命低，花扇范围，倾城易伤',
    hpMul: 0.85,
    speedMul: 1.06,
    damageMul: 0.98,
    portrait: 'diaochan_portrait',
    startWeapon: 'flame_banner',
    faction: '群',
  },
];

/** 有主页大幅立绘（epic-home）与水墨立轴（ink-scroll）的武将；其余用 portrait。 */
export const HOME_ART_HEROES: readonly string[] = ['zhaoyun', 'guanyu', 'huangzhong', 'zhuge', 'zhangfei', 'machao', 'weiyan', 'liubei', 'pangtong', 'huangyueying'];

export const STARTING_WEAPONS: Array<{ id: WeaponId; name: string; icon: string; desc: string }> = [
  { id: 'spear_orbit', name: '枪影旋舞', icon: 'icon_1', desc: '环绕枪刃，近身持续伤害' },
  { id: 'crossbow', name: '连弩齐射', icon: 'icon_2', desc: '自动射击，命中后弹射' },
  { id: 'flame_banner', name: '烈焰战旗', icon: 'icon_3', desc: '前方范围爆发灼烧' },
];

export const DEFAULT_RUN_CONFIG: RunConfig = { character: 'zhaoyun', weapon: 'spear_orbit' };

export function getCharacter(id: CharacterId): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

/** 新武将普攻的专属色调（枪芒 / 刀光 / 火爆 / 弩箭），老四将保持原色。 */
export const HERO_TINT: Partial<Record<CharacterId, number>> = { zhangfei: 0xff9c7a, machao: 0xb8dcff, weiyan: 0xff6a55, liubei: 0xffd890, pangtong: 0xff8fd0, huangyueying: 0x8fe8c0, sunshangxiang: 0xff9a8a, diaochan: 0xf0b4ff };
/** 招牌技序列帧（public/assets/hero-fx/fx_<sheet>.png，6 列 × 4 行、256×256，黑底叠加混合）。fx_c：孙尚香环身连射 / 貂蝉倾城 / 魏延谁敢杀我 / 魏延劈地裂波（朝右）。 */
export const HERO_FX: Record<string, { sheet: 'a' | 'b' | 'c'; row: number }> = { ringVolley: { sheet: 'c', row: 0 }, charm: { sheet: 'c', row: 1 }, whoDares: { sheet: 'c', row: 2 }, crack: { sheet: 'c', row: 3 }, roar: { sheet: 'a', row: 0 }, dash: { sheet: 'a', row: 1 }, bloodslash: { sheet: 'a', row: 2 }, rally: { sheet: 'a', row: 3 }, phoenix: { sheet: 'b', row: 0 }, gears: { sheet: 'b', row: 1 }, liubeiSlash: { sheet: 'b', row: 2 }, weiyanSlash: { sheet: 'b', row: 3 } };
