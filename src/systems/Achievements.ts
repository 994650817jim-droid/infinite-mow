/**
 * 成就（STEAM_PLAN.md · S3 的游戏内部分）：定义、本地记录（全局，不随存档位切换，与 Steam 成就一致）、解锁提示。
 * 桌面版若提供 imDesktop.achievement(id)（接入 steamworks.js 后），解锁时同步给 Steam。
 * 触发点：战斗结束（onBattleEnd）、追兵首领被击败、城镇 / 天下状态检查（checkWorld，进主城、天下地图、主页时调用）。
 */
import Phaser from 'phaser';
import { GAME_WIDTH, FONT, HEADING_FONT } from '../config';
import type { WorldSave } from '../world/WorldStore';
import { TOWN_BUILDINGS } from '../town/TownData';

export type AchievementGroup = '战斗' | '天下' | '城镇' | '军务';
export interface AchievementDef { id: string; name: string; desc: string; group: AchievementGroup }
const A = (id: string, name: string, desc: string, group: AchievementGroup): AchievementDef => ({ id, name, desc, group });
export const ACHIEVEMENTS: AchievementDef[] = [
  A('first_win', '初战告捷', '赢得第一场战斗', '战斗'),
  A('zhangjiao', '苍天已死', '在广宗决战击败张角', '战斗'),
  A('lubu', '虎牢扬威', '在虎牢关击败吕布', '战斗'),
  A('qunxiong', '群雄逐鹿', '平定群雄割据（第三章）', '战斗'),
  A('guandu', '官渡定北', '赢下官渡之战（第四章）', '战斗'),
  A('kills_1000', '千人斩', '单场击杀 1000 名敌人', '战斗'),
  A('kills_10000', '万人敌', '累计击杀 10000 名敌人', '战斗'),
  A('level_20', '武艺精熟', '单场达到 20 级', '战斗'),
  A('all_heroes', '四将皆用', '赵云、关羽、黄忠、诸葛亮各赢一场', '战斗'),
  A('chaser', '穷追不舍', '击败一名追兵首领', '战斗'),
  A('first_siege', '首破城池', '攻下第一座城池', '天下'),
  A('cities_5', '据地五城', '同时占有 5 座城池', '天下'),
  A('luoyang', '天子旧都', '占领洛阳', '天下'),
  A('defense', '固若金汤', '守住一座告急的城池', '天下'),
  A('focus', '因地制宜', '在一座城池建起第一座建筑', '天下'),
  A('town_build', '安营扎寨', '在营寨建起第一座新建筑', '城镇'),
  A('town_all', '百业兴旺', '营寨建筑全部建成（麒麟阁除外）', '城镇'),
  A('town_lv3', '雕梁画栋', '任一建筑升到 3 级', '城镇'),
  A('money_500', '富甲一方', '同时持有 1000 军粮', '城镇'),
  A('caravan', '格物致知', '在讲武堂研究第一项科技', '城镇'),
  A('events_10', '运筹帷幄', '在讲武堂研究 10 项科技', '城镇'),
  A('year_190', '春秋几度', '营寨结算满 24 次', '城镇'),
  A('potions_10', '妙手回春', '累计使用 10 次药囊', '军务'),
  A('reserve_20', '兵强马壮', '后备兵达到 20 人', '军务'),
];
const KEY = 'im_achievements';
interface Store { unlocked: Record<string, number>; counters: Record<string, number>; heroes: string[] }
function load(): Store {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (v && typeof v === 'object') return { unlocked: v.unlocked ?? {}, counters: v.counters ?? {}, heroes: Array.isArray(v.heroes) ? v.heroes : [] }; } catch { /* 损坏视为空 */ }
  return { unlocked: {}, counters: {}, heroes: [] };
}
function save(s: Store): void { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 存储不可用 */ } }

let game: Phaser.Game | null = null;
/** main.ts 创建游戏后调用（用于弹出解锁提示）。 */
export function installAchievements(g: Phaser.Game): void { game = g; }

export function unlockedMap(): Record<string, number> { return load().unlocked; }
export function isUnlocked(id: string): boolean { return !!load().unlocked[id]; }
export function counter(name: string): number { return load().counters[name] ?? 0; }

/** 解锁（已解锁则忽略）；返回是否新解锁。 */
export function unlock(id: string): boolean {
  const def = ACHIEVEMENTS.find(a => a.id === id); if (!def) return false;
  const s = load(); if (s.unlocked[id]) return false;
  s.unlocked[id] = Date.now(); save(s);
  try { (window as unknown as { imDesktop?: { achievement?: (id: string) => void } }).imDesktop?.achievement?.(id); } catch { /* Steam 不可用 */ }
  toast(def);
  return true;
}
/** 累加计数器，并按阈值解锁。 */
export function addCounter(name: string, n: number): number {
  const s = load(); s.counters[name] = (s.counters[name] ?? 0) + n; save(s);
  const v = s.counters[name];
  if (name === 'kills' && v >= 10000) unlock('kills_10000');
  if (name === 'events' && v >= 10) unlock('events_10');
  if (name === 'potions' && v >= 10) unlock('potions_10');
  return v;
}

/** 战斗结束（测试战斗不计）。 */
export function onBattleEnd(r: { victory: boolean; debug: boolean; kills: number; level: number; hero: string; chapter: string; stage?: number; westStage?: number; arc?: string; bossKilled: boolean }): void {
  if (r.debug) return;
  addCounter('kills', Math.max(0, Math.floor(r.kills)));
  if (r.kills >= 1000) unlock('kills_1000');
  if (r.level >= 20) unlock('level_20');
  if (!r.victory) return;
  unlock('first_win');
  if (r.chapter === 'huangjin' && (r.stage ?? 3) === 3 && r.bossKilled && !r.arc) unlock('zhangjiao');
  // 2-3 改为董卓后，「虎牢扬威」改由天下地图挑战关击败吕布获得
  if (r.chapter === 'hulao' && r.bossKilled && r.arc === 'lubu') unlock('lubu');
  if (r.arc === 'defense') unlock('defense');
  const s = load(); if (!s.heroes.includes(r.hero)) { s.heroes.push(r.hero); save(s); }
  if (['zhaoyun', 'guanyu', 'huangzhong', 'zhuge'].every(h => load().heroes.includes(h))) unlock('all_heroes');
}

/** 按当前天下 / 城镇状态检查（进主城、天下地图、主页、结算后调用）。 */
export function checkWorld(w: WorldSave): void {
  if (w.warlordStages >= 3) unlock('qunxiong');
  if (w.guanduStages >= 3) unlock('guandu');
  if (w.capturedEver.length > 0) unlock('first_siege');
  if (w.ownedCities.length >= 5) unlock('cities_5');
  if (w.ownedCities.includes('luoyang')) unlock('luoyang');
  if (Object.values(w.cities ?? {}).some(l => l.tuntian > 0 || l.muster > 0 || l.office > 1)) unlock('focus');
  const lv = w.town.levels as Record<string, number>;
  if (Object.entries(lv).some(([id, l]) => l > 0 && !['hall', 'barracks', 'farm', 'clinic'].includes(id))) unlock('town_build');
  if (Object.keys(TOWN_BUILDINGS).filter(id => id !== 'pavilion').every(id => (lv[id] ?? 0) > 0)) unlock('town_all');
  if (Object.entries(lv).some(([id, l]) => id !== 'hall' && l >= 3)) unlock('town_lv3');
  if (w.provisions >= 1000) unlock('money_500');
  if (w.town.tech.length > 0) unlock('caravan');
  if (w.town.tech.length >= 10) unlock('events_10');
  if (w.town.year >= 190) unlock('year_190');
  if (Object.values(w.reserve).reduce((n, v) => n + (v || 0), 0) >= 20) unlock('reserve_20');
}

/** 解锁提示（顶部居中、计时下方；当前最上层场景，约 2.6 秒）。 */
function toast(def: AchievementDef): void {
  const scene = game?.scene.getScenes(true).at(-1); if (!scene) return;
  // 同时解锁多个时往下排，不重叠
  const stack = scene.children.list.filter(o => o.name === 'achievement-toast').length;
  const W = GAME_WIDTH, /* HUD 在 UI 镜头上，按设计宽度排（主镜头可拉远） */ w = 260, x = W / 2, y = 132 + stack * 66; // 2026-11-21 总制作人：原在右上，盖住行营「下一关 / 行囊」、战斗里的设置 / 舆图——挪到顶部居中、计时与关名下面
  const root = scene.add.container(x, y - 20).setScrollFactor(0).setDepth(1e6).setAlpha(0).setName('achievement-toast');
  root.add(scene.add.rectangle(0, 0, w, 60, 0x1a120b, .94).setStrokeStyle(1.5, 0xd9b46a));
  // 有成就图标时用图标，否则用“功”字印
  if (scene.textures.exists('ach_' + def.id)) root.add(scene.add.image(-w / 2 + 30, 0, 'ach_' + def.id).setDisplaySize(44, 44));
  else { root.add(scene.add.circle(-w / 2 + 30, 0, 18, 0x9a2a1e).setStrokeStyle(1.5, 0xe8c98a)); root.add(scene.add.text(-w / 2 + 30, 0, '功', { fontFamily: HEADING_FONT, fontSize: '18px', color: '#fbe9c9', resolution: 2 }).setOrigin(.5)); }
  root.add(scene.add.text(-w / 2 + 58, -12, '成就解锁 · ' + def.name, { fontFamily: HEADING_FONT, fontSize: '16px', color: '#f4d99f', resolution: 2 }).setOrigin(0, .5));
  root.add(scene.add.text(-w / 2 + 58, 12, def.desc, { fontFamily: FONT, fontSize: '12px', color: '#cfc3a6', resolution: 2 }).setOrigin(0, .5));
  for (const o of root.list) (o as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0);
  const start = performance.now();
  const tick = (): void => { const t = performance.now() - start; root.setAlpha(t < 250 ? t / 250 : t > 2600 ? Math.max(0, 1 - (t - 2600) / 400) : 1).setY(y - 20 + Math.min(1, t / 250) * 20); if (t > 3050 || !root.active) { scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick); root.destroy(); } };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
  scene.events.once('shutdown', () => { scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick); });
}
