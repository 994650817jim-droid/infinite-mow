import Phaser from 'phaser';
import { artStyle } from './ArtStyle';

/**
 * 首领倒地帧（人物画风 v2；用户 2026-11-17 要求首领死亡时有倒地动画）。
 * 给本身没有倒地帧的首领（张角 / 张梁 / 张宝 / 董卓 / 吕布）补的 4 帧：
 *   assets/bosses-v2/<id>_death.png，1152×288，1 行 4 帧，每格 288、脚底在 256（同 v2 招式图集），全部朝右（朝左时镜像）。
 *   帧 0 受击后仰 → 1 倒地 → 2 躺倒 → 3 静止。
 * id 用章节的 bossStyle 名。接入（BossChest.playBossFall）：preloadBossDeath 在首领出场时预载；
 * bossDeathKey 有值就依次播 0→3 帧，没有（未载入 / 载入失败 / ?art=v1）就沿用受伤帧倒下。
 */
export const BOSS_DEATH_IDS = ['zhangjiao', 'zhangliang', 'zhangbao', 'dongzhuo', 'lubu'] as const;
export type BossDeathId = typeof BOSS_DEATH_IDS[number];
export const BOSS_DEATH = { cell: 288, foot: 256, frames: 4 } as const;
const key = (id: string): string => `boss_death_${id}`;
const failed = new Set<string>();
const known = (id: string): id is BossDeathId => (BOSS_DEATH_IDS as readonly string[]).includes(id);

/** 按需载入某首领的倒地帧（v1 画风或未知 id 不做事）。 */
export function preloadBossDeath(scene: Phaser.Scene, id: string): void {
  if (artStyle() !== 'v2' || !known(id) || failed.has(id)) return;
  const k = key(id); if (scene.textures.exists(k)) return;
  scene.load.spritesheet(k, `assets/bosses-v2/${id}_death.png`, { frameWidth: BOSS_DEATH.cell, frameHeight: BOSS_DEATH.cell });
  scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (f: Phaser.Loader.File) => { if (f.key === k) failed.add(id); });
  if (!scene.load.isLoading()) scene.load.start();
}

/** 倒地帧纹理键（已就绪时）；否则 null（调用方退回受伤帧倒下）。 */
export function bossDeathKey(scene: Phaser.Scene, id: string | undefined): string | null {
  if (!id || artStyle() !== 'v2' || !known(id)) return null;
  const k = key(id);
  return scene.textures.exists(k) && scene.textures.get(k).frameTotal > BOSS_DEATH.frames ? k : null;
}
