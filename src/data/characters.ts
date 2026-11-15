import type { ChapterId } from './chapters';
import type { WeaponId } from '../types';

export type CharacterId = 'zhaoyun' | 'guanyu' | 'huangzhong' | 'zhuge' | 'zhangfei' | 'machao' | 'weiyan' | 'liubei';

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
    hpMul: 1,
    speedMul: 1,
    damageMul: 1,
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
    damageMul: 1.15,
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
    hpMul: 0.86,
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
    desc: '悍将 · 生命高，血战越战越勇',
    hpMul: 1.2,
    speedMul: 0.97,
    damageMul: 1.12,
    portrait: 'weiyan_portrait',
    startWeapon: 'guandao',
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
];

/** 有主页大幅立绘（epic-home）与水墨立轴（ink-scroll）的武将；其余用 portrait。 */
export const HOME_ART_HEROES: readonly string[] = ['zhaoyun', 'guanyu', 'huangzhong', 'zhuge', 'zhangfei', 'machao', 'weiyan', 'liubei'];

export const STARTING_WEAPONS: Array<{ id: WeaponId; name: string; icon: string; desc: string }> = [
  { id: 'spear_orbit', name: '枪影旋舞', icon: 'icon_1', desc: '环绕枪刃，近身持续伤害' },
  { id: 'crossbow', name: '连弩齐射', icon: 'icon_2', desc: '自动射击，命中后弹射' },
  { id: 'flame_banner', name: '烈焰战旗', icon: 'icon_3', desc: '前方范围爆发灼烧' },
];

export const DEFAULT_RUN_CONFIG: RunConfig = { character: 'zhaoyun', weapon: 'spear_orbit' };

export function getCharacter(id: CharacterId): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
