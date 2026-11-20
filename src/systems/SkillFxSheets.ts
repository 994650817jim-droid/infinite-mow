import Phaser from 'phaser';

/**
 * 技艺 / 战法手绘特效序列帧（用户 2026-11-16：「不要再做像素特效了」，改用像诸葛亮 flame_burst 那样的手绘透明序列帧）。
 * 图由 ChatGPT 出（洋红底），tools/prepare-fx.mjs 去底成透明横排序列帧；需求与规格见 public/assets/skill-fx/ASSET_REQUEST.md。
 */
export const SKILL_FX: Readonly<Record<string, { file: string; cell: number; frames: number; /** 非正方形格的高（默认 = cell）。 */ cellH?: number }>> = {
  fx_drag_wave: { file: 'assets/skill-fx/drag_wave.png', cell: 256, frames: 6 },
  fx_drag_sparks: { file: 'assets/skill-fx/drag_sparks.png', cell: 128, frames: 6 },
  fx_drag_scar: { file: 'assets/skill-fx/drag_scar.png', cell: 128, frames: 6 },
  fx_drag_gleam: { file: 'assets/skill-fx/drag_gleam.png', cell: 256, frames: 6 },
  fx_flank_streak: { file: 'assets/skill-fx/flank_streak.png', cell: 256, frames: 6 },
  fx_strike_glint: { file: 'assets/skill-fx/strike_glint.png', cell: 128, frames: 6 },
  fx_windstep_burst: { file: 'assets/skill-fx/windstep_burst.png', cell: 192, frames: 6 },
  // 场地环境互动（火油桶爆炸 / 地火循环 / 倒塌扬尘）
  fx_explosion: { file: 'assets/skill-fx/explosion.png', cell: 256, frames: 6 },
  // 小怪第一批特效（2026-11-19 Gemini 出图，洋红底 → tools/prepare-fx.mjs，横排）：符水道徒治疗光 8 帧（淡黄符水光环，普通混合）/ 毒箭蛮的毒雾 6 帧（可循环；整团偏实，叠在人物身上请降透明度）
  fx_heal_fushui: { file: 'assets/skill-fx/heal_fushui.png', cell: 256, frames: 8 },
  fx_poison_mist: { file: 'assets/skill-fx/poison_mist.png', cell: 256, frames: 6 },
  fx_ground_fire: { file: 'assets/skill-fx/ground_fire.png', cell: 192, frames: 6 },
  fx_collapse_dust: { file: 'assets/skill-fx/collapse_dust.png', cell: 256, frames: 6 },
  // 敌军死亡特效专属尘土（即梦 Seedream 5.5，tools/prepare-death-dust.mjs 处理：抠洋红 + 去溢色 + 清水印 + 重新居中）；缺图时 DeathFx 退回 fx_collapse_dust
  fx_death_dust: { file: 'assets/fx/death_dust.png', cell: 256, frames: 6 },
  // 敌军死亡特效的兵器 / 头巾小图（即梦 Seedream 5.5，tools/prepare-death-props.mjs 处理；3 列 × 2 行，帧 0–5：刀 枪 弓 / 藤牌 重盾 头巾）。手机不用；缺图时兵器 / 头巾自动不显示
  fx_death_props: { file: 'assets/fx/death_props.png', cell: 256, frames: 6 },
  // 祝融夫人飞刀（ChatGPT 手绘序列帧，tools/prepare-black-fx.mjs 去黑底）：4×4，帧 0–7 旋转飞刀 + 火焰拖尾、帧 8–13 命中火花；KnifeFx 按帧号直接取，frames 只对 playSheet 有意义（这里不用）
  // 战法流派第 3 期（ChatGPT 洋红底，tools/prepare-school-art.py 处理）：六派觉醒各 6 帧、疾风风带（横长格 512×192）
  fx_awaken_fire: { file: 'assets/schools/awaken_fire.png', cell: 256, frames: 6 },
  fx_awaken_stratagem: { file: 'assets/schools/awaken_stratagem.png', cell: 256, frames: 6 },
  fx_awaken_archery: { file: 'assets/schools/awaken_archery.png', cell: 256, frames: 6 },
  fx_awaken_cavalry: { file: 'assets/schools/awaken_cavalry.png', cell: 256, frames: 6 },
  fx_awaken_warrior: { file: 'assets/schools/awaken_warrior.png', cell: 256, frames: 6 },
  fx_awaken_formation: { file: 'assets/schools/awaken_formation.png', cell: 256, frames: 6 },
  fx_gust_band: { file: 'assets/schools/gust_band.png', cell: 512, cellH: 192, frames: 6 },
  // 3-2 典韦技能手绘特效（ChatGPT，友军薄荷青白色；tools/prepare-fx-strips.mjs 去黑底、每条 6 帧 × 256）：双戟旋风 / 恶来死战红气（循环）/ 掷戟（旋转飞行 + 螺旋残影）/ 命中火花
  fx_dianwei_whirl: { file: 'assets/dianwei-fx/whirl.png', cell: 256, frames: 6 },
  fx_dianwei_rage: { file: 'assets/dianwei-fx/rage.png', cell: 256, frames: 6 },
  fx_dianwei_throw: { file: 'assets/dianwei-fx/throw.png', cell: 256, frames: 6 },
  fx_dianwei_hit: { file: 'assets/dianwei-fx/hit.png', cell: 256, frames: 6 },
  // 敌人身上的状态标记（ChatGPT，StatusFx 用）：1536×1024，6 列 × 4 行，行 0 灼烧 / 行 1 迟滞 / 行 2 眩晕 / 行 3 破甲，每行 6 帧循环
  fx_status: { file: 'assets/school-fx/status.png', cell: 256, frames: 6 },
  // 锦囊激活特效（ChatGPT，JinnangFx 用）：1536×1024，6 列 × 4 行，每行 6 帧
  fx_jn1: { file: 'assets/jinnang-fx/jn1.png', cell: 256, frames: 6 },
  fx_jn2: { file: 'assets/jinnang-fx/jn2.png', cell: 256, frames: 6 },
  fx_jn3: { file: 'assets/jinnang-fx/jn3.png', cell: 256, frames: 6 },
  // 董卓主效果（ChatGPT 黑底 6×4，FULL 去底整张；DongzhuoBoss 用）：行 0 纵火点燃 / 行 1 号令铁骑 / 行 2 飞熊军护驾 / 行 3 迁都焚城
  fx_dz: { file: 'assets/dongzhuo-fx/dz.png', cell: 256, frames: 6 },
  fx_zhurong_knife: { file: 'assets/zhurong-fx/knife_fx.png', cell: 256, frames: 8 },
  // 武将出招起手特效（2026-11-19 ChatGPT 黑底 6×4 三张，tools/build-hero-cast-fx.mjs 去底切条；systems/HeroCastFx.ts 用）：每人 6 帧
  ...Object.fromEntries(['guanyu', 'zhangfei', 'zhaoyun', 'huangzhong', 'machao', 'weiyan', 'liubei', 'zhuge', 'pangtong', 'huangyueying', 'sunshangxiang', 'diaochan', 'lvbu', 'zhangliao', 'zhouyu']
    .map(h => ['fx_cast_' + h, { file: `assets/hero-fx/cast/cast_${h}.png`, cell: 256, frames: 6 }])),
  // 吕布方天画戟（ChatGPT 黑底 6×4，tools/build-lvbu-fx.mjs 切条；weapons/lvbuWeapon.ts 用）：戟刺朝右、横扫环、旋转飞戟（循环）
  fx_lvbu_thrust: { file: 'assets/hero-fx/lvbu/thrust.png', cell: 256, frames: 6 },
  fx_lvbu_sweep: { file: 'assets/hero-fx/lvbu/sweep.png', cell: 256, frames: 6 },
  fx_lvbu_halberd: { file: 'assets/hero-fx/lvbu/halberd.png', cell: 256, frames: 6 },
  // 张辽破阵双戟（ChatGPT 黑底 6×4，tools/build-zhangliao-fx.mjs 切条；weapons/zhangliaoWeapon.ts 用）：双戟扇形斩（朝右）、虎贲虚影骑兵（朝右跑，循环）、溃逃标记（循环）
  fx_zl_slash: { file: 'assets/hero-fx/zhangliao/slash.png', cell: 256, frames: 6 },
  fx_zl_rider: { file: 'assets/hero-fx/zhangliao/rider.png', cell: 256, frames: 6 },
  fx_zl_rout: { file: 'assets/hero-fx/zhangliao/rout.png', cell: 256, frames: 6 },
  // 周瑜火船令（ChatGPT 黑底 6×4 两张，tools/build-hero-fx-rows.mjs 切条；weapons/zhouyuWeapon.ts 用）：火船（朝右，循环）、爆燃、火场（循环）、火索（循环）、琴音环（循环）、东风
  fx_zy_ship: { file: 'assets/hero-fx/zhouyu/ship.png', cell: 256, frames: 6 },
  fx_zy_blast: { file: 'assets/hero-fx/zhouyu/blast.png', cell: 256, frames: 6 },
  fx_zy_field: { file: 'assets/hero-fx/zhouyu/field.png', cell: 256, frames: 6 },
  fx_zy_rope: { file: 'assets/hero-fx/zhouyu/rope.png', cell: 256, frames: 6 },
  fx_zy_qin: { file: 'assets/hero-fx/zhouyu/qin.png', cell: 256, frames: 6 },
  fx_zy_wind: { file: 'assets/hero-fx/zhouyu/wind.png', cell: 256, frames: 6 },
};

export function loadSkillFx(load: Phaser.Loader.LoaderPlugin): void {
  for (const [key, d] of Object.entries(SKILL_FX)) load.spritesheet(key, d.file, { frameWidth: d.cell, frameHeight: d.cellH ?? d.cell });
}

export interface SheetOpts {
  /** 显示边长（世界像素）。 */ size: number;
  /** 显示高度（默认按格子宽高比，正方形格 = size）。 */ sizeH?: number;
  /** 整段时长（毫秒）。 */ ms: number;
  depth: number;
  rotation?: number; flipX?: boolean; flipY?: boolean; alpha?: number; add?: boolean;
  originX?: number; originY?: number; tint?: number; name?: string;
  /** 每帧回调（移动、旋转等），t 为 0–1。 */ onUpdate?: (img: Phaser.GameObjects.Image, t: number) => void;
}

/** 播放一段序列帧，播完销毁；缺图返回 null（不画任何替代图形）。 */
export function playSheet(scene: Phaser.Scene, key: string, x: number, y: number, o: SheetOpts): Phaser.GameObjects.Image | null {
  const d = SKILL_FX[key]; if (!d || !scene.textures.exists(key)) return null;
  const img = scene.add.image(x, y, key, 0).setDisplaySize(o.size, o.sizeH ?? o.size * (d.cellH ?? d.cell) / d.cell).setDepth(o.depth).setRotation(o.rotation ?? 0).setFlip(!!o.flipX, !!o.flipY)
    .setAlpha(o.alpha ?? 1).setOrigin(o.originX ?? .5, o.originY ?? .5).setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
  if (o.tint !== undefined) img.setTint(o.tint);
  if (o.name) img.setName(o.name);
  scene.tweens.addCounter({ from: 0, to: 1, duration: o.ms, onUpdate: tw => { const t = tw.getValue() ?? 0; img.setFrame(Math.min(d.frames - 1, Math.floor(t * d.frames))); o.onUpdate?.(img, t); }, onComplete: () => img.destroy() });
  return img;
}
