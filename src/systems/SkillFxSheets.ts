import Phaser from 'phaser';

/**
 * 技艺 / 战法手绘特效序列帧（用户 2026-11-16：「不要再做像素特效了」，改用像诸葛亮 flame_burst 那样的手绘透明序列帧）。
 * 图由 ChatGPT 出（洋红底），tools/prepare-fx.mjs 去底成透明横排序列帧；需求与规格见 public/assets/skill-fx/ASSET_REQUEST.md。
 */
export const SKILL_FX: Readonly<Record<string, { file: string; cell: number; frames: number }>> = {
  fx_drag_wave: { file: 'assets/skill-fx/drag_wave.png', cell: 256, frames: 6 },
  fx_drag_sparks: { file: 'assets/skill-fx/drag_sparks.png', cell: 128, frames: 6 },
  fx_drag_scar: { file: 'assets/skill-fx/drag_scar.png', cell: 128, frames: 6 },
  fx_drag_gleam: { file: 'assets/skill-fx/drag_gleam.png', cell: 256, frames: 6 },
  fx_flank_streak: { file: 'assets/skill-fx/flank_streak.png', cell: 256, frames: 6 },
  fx_strike_glint: { file: 'assets/skill-fx/strike_glint.png', cell: 128, frames: 6 },
  fx_windstep_burst: { file: 'assets/skill-fx/windstep_burst.png', cell: 192, frames: 6 },
};

export function loadSkillFx(load: Phaser.Loader.LoaderPlugin): void {
  for (const [key, d] of Object.entries(SKILL_FX)) load.spritesheet(key, d.file, { frameWidth: d.cell, frameHeight: d.cell });
}

export interface SheetOpts {
  /** 显示边长（世界像素）。 */ size: number;
  /** 整段时长（毫秒）。 */ ms: number;
  depth: number;
  rotation?: number; flipX?: boolean; flipY?: boolean; alpha?: number; add?: boolean;
  originX?: number; originY?: number; tint?: number; name?: string;
  /** 每帧回调（移动、旋转等），t 为 0–1。 */ onUpdate?: (img: Phaser.GameObjects.Image, t: number) => void;
}

/** 播放一段序列帧，播完销毁；缺图返回 null（不画任何替代图形）。 */
export function playSheet(scene: Phaser.Scene, key: string, x: number, y: number, o: SheetOpts): Phaser.GameObjects.Image | null {
  const d = SKILL_FX[key]; if (!d || !scene.textures.exists(key)) return null;
  const img = scene.add.image(x, y, key, 0).setDisplaySize(o.size, o.size).setDepth(o.depth).setRotation(o.rotation ?? 0).setFlip(!!o.flipX, !!o.flipY)
    .setAlpha(o.alpha ?? 1).setOrigin(o.originX ?? .5, o.originY ?? .5).setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
  if (o.tint !== undefined) img.setTint(o.tint);
  if (o.name) img.setName(o.name);
  scene.tweens.addCounter({ from: 0, to: 1, duration: o.ms, onUpdate: tw => { const t = tw.getValue() ?? 0; img.setFrame(Math.min(d.frames - 1, Math.floor(t * d.frames))); o.onUpdate?.(img, t); }, onComplete: () => img.destroy() });
  return img;
}
