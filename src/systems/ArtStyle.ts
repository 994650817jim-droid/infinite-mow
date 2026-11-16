import Phaser from 'phaser';
import { RENDER_SCALE } from '../config';

/**
 * 人物画风开关（共享笔记 art-style-v2-spec.md）。
 * v1：现有 Q 版高清绘画图集；v2：「营火写实像素」——写实比例、真像素、深色描边、厚涂。
 * 选择顺序：URL ?art=v1|v2 → localStorage im_art_style → 默认（试作阶段为 v1）。
 * v2 只替换 ART_V2_FILES 里列出的图集，其余单位自动沿用 v1。
 */
export type ArtStyle = 'v1' | 'v2';
export const DEFAULT_ART_STYLE: ArtStyle = 'v1';
const STORE_KEY = 'im_art_style';

/** v2 图集：纹理键 → 文件（行走 4×4、动作 4×7，原生格 176 / 232，人物约 152 美术像素高，160 色）。 */
export const ART_V2_FILES: Readonly<Record<string, string>> = {
  hero_walk_sheet: 'assets/processed-v2/zhaoyun_walk_sheet.png',
  zhaoyun_actions: 'assets/hero-actions-v2/zhaoyun.png',
  guanyu_walk_sheet: 'assets/processed-v2/guanyu_walk_sheet.png',
  guanyu_actions: 'assets/hero-actions-v2/guanyu.png',
  zhangfei_walk_sheet: 'assets/processed-v2/zhangfei_walk_sheet.png',
  zhangfei_actions: 'assets/hero-actions-v2/zhangfei.png',
  machao_walk_sheet: 'assets/processed-v2/machao_walk_sheet.png',
  machao_actions: 'assets/hero-actions-v2/machao.png',
  huangzhong_walk_sheet: 'assets/processed-v2/huangzhong_walk_sheet.png',
  huangzhong_actions: 'assets/hero-actions-v2/huangzhong.png',
  zhuge_walk_sheet: 'assets/processed-v2/zhuge_walk_sheet.png',
  zhuge_actions: 'assets/hero-actions-v2/zhuge.png',
  weiyan_walk_sheet: 'assets/processed-v2/weiyan_walk_sheet.png',
  weiyan_actions: 'assets/hero-actions-v2/weiyan.png',
  liubei_walk_sheet: 'assets/processed-v2/liubei_walk_sheet.png',
  liubei_actions: 'assets/hero-actions-v2/liubei.png',
  pangtong_walk_sheet: 'assets/processed-v2/pangtong_walk_sheet.png',
  pangtong_actions: 'assets/hero-actions-v2/pangtong.png',
  huangyueying_walk_sheet: 'assets/processed-v2/huangyueying_walk_sheet.png',
  huangyueying_actions: 'assets/hero-actions-v2/huangyueying.png',
  diaochan_walk_sheet: 'assets/processed-v2/diaochan_walk_sheet.png',
  diaochan_actions: 'assets/hero-actions-v2/diaochan.png',
  // 第 2 批：我方兵种（4×4，见 V2_TROOP_KEYS / applyV2TroopFrames）
  shu_swordsman_walk_sheet: 'assets/processed-v2/troops/swordsman_walk.png',
  shu_swordsman_attack_sheet: 'assets/processed-v2/troops/swordsman_attack.png',
  shu_spearman_walk_sheet: 'assets/processed-v2/troops/spearman_walk.png',
  shu_spearman_attack_sheet: 'assets/processed-v2/troops/spearman_attack.png',
  shu_archer_walk_sheet: 'assets/processed-v2/troops/archer_walk.png',
  shu_archer_attack_sheet: 'assets/processed-v2/troops/archer_attack.png',
  legion_crossbowman_walk: 'assets/processed-v2/troops/crossbowman_walk.png',
  legion_crossbowman_action: 'assets/processed-v2/troops/crossbowman_attack.png',
  legion_guardian_walk: 'assets/processed-v2/troops/guardian_walk.png',
  legion_rider_walk: 'assets/processed-v2/troops/rider_walk.png',
  legion_halberdier_walk: 'assets/processed-v2/troops/halberdier_walk.png',
  legion_halberdier_action: 'assets/processed-v2/troops/halberdier_attack.png',
  legion_medic_walk: 'assets/processed-v2/troops/medic_walk.png',
  legion_medic_action: 'assets/processed-v2/troops/medic_attack.png',
  // 第 3 批（一）：黄巾章小兵 + 通用弓兵
  'yellow_swordsman-walk-v4': 'assets/processed-v2/enemies/yellow_swordsman_walk.png',
  'yellow_swordsman-attack-v4': 'assets/processed-v2/enemies/yellow_swordsman_attack.png',
  'yellow_shield-walk-v4': 'assets/processed-v2/enemies/yellow_shield_walk.png',
  'yellow_shield-attack-v4': 'assets/processed-v2/enemies/yellow_shield_attack.png',
  'yellow_spear-walk-v5': 'assets/processed-v2/enemies/yellow_spear_walk.png',
  'yellow_spear-attack-v5': 'assets/processed-v2/enemies/yellow_spear_attack.png',
  yellow_shaman_walk: 'assets/processed-v2/enemies/yellow_shaman_walk.png',
  yellow_shaman_cast: 'assets/processed-v2/enemies/yellow_shaman_attack.png',
  enemy_archer_walk_sheet: 'assets/processed-v2/enemies/enemy_archer_walk.png',
  enemy_archer_attack_sheet: 'assets/processed-v2/enemies/enemy_archer_attack.png',
  // 第 3 批（二）：通用敌军（黄巾装束，各章通用）+ 西凉军（第 2 章，只有行走图）
  enemy_infantry_walk_sheet: 'assets/processed-v2/enemies/enemy_infantry_walk.png',
  enemy_shield_walk_sheet: 'assets/processed-v2/enemies/enemy_shield_walk.png',
  enemy_officer_walk_sheet: 'assets/processed-v2/enemies/enemy_officer_walk.png',
  enemy_cavalry_run_sheet: 'assets/processed-v2/enemies/enemy_cavalry_walk.png',
  enemy_cavalry_charge_sheet: 'assets/processed-v2/enemies/enemy_cavalry_charge.png',
  xiliang_infantry_walk: 'assets/processed-v2/enemies/xiliang_infantry_walk.png',
  xiliang_shield_walk: 'assets/processed-v2/enemies/xiliang_shield_walk.png',
  xiliang_archer_walk: 'assets/processed-v2/enemies/xiliang_archer_walk.png',
  xiliang_cavalry_walk: 'assets/processed-v2/enemies/xiliang_cavalry_walk.png',
  xiliang_elite_walk: 'assets/processed-v2/enemies/xiliang_elite_walk.png',
};
/** v2 主将行走整格的显示高度（逻辑像素）：原生格 176 → 88，即 1080p 全屏（渲染 2 倍）下 1 美术像素 = 1 屏幕像素。
 * 人物约 76 逻辑像素高（用户要求比 v1 大一些）。 */
export const V2_WALK_DISPLAY = 88;
/** v2 行走格的脚底行（描边所在最低行，原生像素）与格高。 */
export const V2_WALK_FOOT = 168, V2_WALK_CELL = 176;
/** 行走帧纵向锚点：让脚底落在精灵中心下方 31 逻辑像素，与 v1 一致（阴影、选中光圈、碰撞位置都不用动）。 */
export const V2_WALK_ORIGIN_Y = (V2_WALK_FOOT + 1) / V2_WALK_CELL - 31 / V2_WALK_DISPLAY;
/** 「主将」标记离精灵中心的高度：v2 人物更高，标记跟着上移。 */
export const V2_MARKER_LIFT = 52;
/** v2 图集的采样：渲染倍率 ≥2 时像素 1:1 对屏幕，用最近邻保持清晰；低于 2 倍要缩小显示，用线性避免丢像素。 */
export function v2Filter(renderScale: number): Phaser.Textures.FilterMode {
  return renderScale >= 2 ? Phaser.Textures.FilterMode.NEAREST : Phaser.Textures.FilterMode.LINEAR;
}

let cached: ArtStyle | undefined;
export function artStyle(): ArtStyle {
  if (cached) return cached;
  let v: string | null = null;
  try { v = new URLSearchParams(window.location.search).get('art'); } catch { /* ignore */ }
  if (v === 'v1' || v === 'v2') { try { localStorage.setItem(STORE_KEY, v); } catch { /* ignore */ } }
  else try { v = localStorage.getItem(STORE_KEY); } catch { v = null; }
  cached = v === 'v1' || v === 'v2' ? v : DEFAULT_ART_STYLE;
  return cached;
}
/** 设置界面切换用；重新进入战斗（BootScene 重新加载图集）后生效。 */
export function setArtStyle(style: ArtStyle): void {
  cached = style;
  try { localStorage.setItem(STORE_KEY, style); } catch { /* ignore */ }
}

/** 该纹理（或其 readable_ 派生）当前是否使用 v2 图集。 */
export function isV2Texture(key: string): boolean {
  return artStyle() === 'v2' && Object.prototype.hasOwnProperty.call(ART_V2_FILES, key.replace(/^readable_/, ''));
}

/** 把加载队列里有 v2 版本的图集换成 v2 文件（在 preload 末尾调用；键名不变，其余代码无感）。 */
export function applyArtStyleUrls(load: Phaser.Loader.LoaderPlugin): string[] {
  if (artStyle() !== 'v2') return [];
  const swapped: string[] = [];
  const files = (load as unknown as { list: Phaser.Structs.Set<Phaser.Loader.File> }).list;
  for (const file of files.getArray()) {
    const url = ART_V2_FILES[file.key];
    if (url && (file.type === 'spritesheet' || file.type === 'image')) { file.url = url; swapped.push(file.key); }
  }
  return swapped;
}

/**
 * v2 兵种图集（我方兵种 / 小兵）：统一 4×4，行 = 下 / 左 / 右 / 上；行走表列 = 步伐 0~3，攻击表列 = 蓄力 / 出手 / 最远 / 收回。
 * 格边长 = 图宽 / 4，脚底在格底往上 8 像素（与 tools/prepare-artv2.mjs 的 FOOT = CELL-8 一致）。
 */
export const V2_TROOP_KEYS: readonly string[] = [
  'shu_swordsman_walk_sheet', 'shu_swordsman_attack_sheet', 'shu_spearman_walk_sheet', 'shu_spearman_attack_sheet',
  'shu_archer_walk_sheet', 'shu_archer_attack_sheet', 'legion_crossbowman_walk', 'legion_crossbowman_action',
  'legion_guardian_walk', 'legion_rider_walk', 'legion_halberdier_walk', 'legion_halberdier_action',
  'legion_medic_walk', 'legion_medic_action',
  // 第 3 批：敌军小兵（黄巾章 + 通用弓兵），Enemy.applyFrame 里按 v2 规则定缩放与脚底
  'yellow_swordsman-walk-v4', 'yellow_swordsman-attack-v4', 'yellow_shield-walk-v4', 'yellow_shield-attack-v4',
  'yellow_spear-walk-v5', 'yellow_spear-attack-v5', 'yellow_shaman_walk', 'yellow_shaman_cast',
  'enemy_archer_walk_sheet', 'enemy_archer_attack_sheet',
  'enemy_infantry_walk_sheet', 'enemy_shield_walk_sheet', 'enemy_officer_walk_sheet', 'enemy_cavalry_run_sheet', 'enemy_cavalry_charge_sheet',
  'xiliang_infantry_walk', 'xiliang_shield_walk', 'xiliang_archer_walk', 'xiliang_cavalry_walk', 'xiliang_elite_walk',
];
/** v2 兵种显示倍率：原生像素 → 逻辑像素 0.5，即 1080p 全屏（渲染 2 倍）下像素 1:1。 */
export const V2_TROOP_SCALE = .5;
/** v2 兵种帧的脚底位置（占帧高的比例），用作纵向锚点。 */
export function v2TroopGround(frameHeight: number): number { return (frameHeight - 7) / frameHeight; }

/**
 * 按 v2 规格给兵种图集重切帧：down_0…up_3（行走 / 动作），并给旧攻击表的命名 atk_<方向>_0 / _1
 * 指到第 2、3 列（出手、最远），旧代码按 atk_ 取帧时也能用 v2 四帧攻击表。须在 registerWalkSheet / 各处旧切帧之后调用。
 */
export function applyV2TroopFrames(scene: Phaser.Scene): string[] {
  const done: string[] = [];
  if (artStyle() !== 'v2') return done;
  const dirs = ['down', 'left', 'right', 'up'];
  for (const key of V2_TROOP_KEYS) {
    if (!isV2Texture(key) || !scene.textures.exists(key)) continue;
    const t = scene.textures.get(key), w = (t.getSourceImage() as { width?: number }).width ?? 0, cell = w / 4;
    if (!cell) continue;
    for (const name of t.getFrameNames()) t.remove(name);
    dirs.forEach((dir, row) => {
      for (let col = 0; col < 4; col++) t.add(`${dir}_${col}`, 0, col * cell, row * cell, cell, cell);
      for (let i = 0; i < 2; i++) t.add(`atk_${dir}_${i}`, 0, (i + 1) * cell, row * cell, cell, cell);
      // 骑兵冲锋表旧命名 chg_<方向>_0（预警）/ _1（冲锋）→ 第 1、3 列
      t.add(`chg_${dir}_0`, 0, 0, row * cell, cell, cell); t.add(`chg_${dir}_1`, 0, 2 * cell, row * cell, cell, cell);
    });
    t.setFilter(v2Filter(RENDER_SCALE));
    done.push(key);
  }
  return done;
}
