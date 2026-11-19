import Phaser from 'phaser';
import { artStyle } from './ArtStyle';

/**
 * 障碍物 / 道具 v2 化（env-interaction-proposal.md 3.2）：ChatGPT 出的 v2 厚涂道具，tools/prepare-props.mjs 按旧图集同布局、
 * 同帧序、同包围盒放置，所以碰撞框、显示尺寸、接地阴影、导航都沿用旧数据。
 * 做法：v2 图以 <旧键>_v2 载入，Boot 时把旧图改名为 <旧键>_old、v2 图顶替旧键；缺图（载入失败）时什么都不做，继续用旧图。
 * 关隘营寨道具（旧 sishui_props）按势力各一套，场景开局由 architecturalSurface 按势力选源图。
 * 对比旧图：网址加 ?props=old（或画风 v1）。
 */
export const PROPS_V2: ReadonlyArray<{ key: string; file: string; frame?: number }> = [
  { key: 'yellow_props', file: 'assets/props-v2/camp-props.png', frame: 128 }, // 黄巾营地道具 6×6
  { key: 'heal_props', file: 'assets/props-v2/heal_props.png', frame: 128 }, // 回血道具 4 个
  { key: 'art_props', file: 'assets/props-v2/battlefield-props.png' }, // 第二章地面装饰 4×2（Boot 里按图宽切帧）
  { key: 'brazier_burning', file: 'assets/props-v2/brazier_burning.png', frame: 444 }, // 火盆燃烧 8 帧（手绘火焰）
  { key: 'brazier_breaking', file: 'assets/props-v2/brazier_breaking.png', frame: 444 }, // 火盆碎裂 8 帧
  { key: 'prop_break_fx', file: 'assets/props-v2/prop-break-fx.png', frame: 96 }, // 碎裂序列帧 6×4（木 / 深木铁 / 陶石 / 布草）
  { key: 'prop_debris', file: 'assets/props-v2/prop-debris.png', frame: 96 }, // 残骸 4 个
];
/** 关隘营寨道具（4×2、256 格），势力：1 董卓西凉 2 袁绍河北 3 曹军 4 东吴 5 蜀（益州）6 南蛮；0 黄巾不用这套 */
export const FACTION_PROPS: Readonly<Record<number, { key: string; file: string }>> = {
  1: { key: 'props_v2_xiliang', file: 'assets/props-v2/fort-xiliang.png' },
  2: { key: 'props_v2_yuan', file: 'assets/props-v2/fort-yuan.png' },
  3: { key: 'props_v2_cao', file: 'assets/props-v2/fort-cao.png' },
  // 场景审查 P3（美术会话出图，版式同上）：吴紫（猇亭、连营、麦城）、蜀翠绿金（刘璋益州军）、蛮族棕（南征）
  4: { key: 'props_v2_wu', file: 'assets/props-v2/fort-wu.png' },
  5: { key: 'props_v2_shu', file: 'assets/props-v2/fort-shu.png' },
  6: { key: 'props_v2_man', file: 'assets/props-v2/fort-man.png' },
};

let enabled: boolean | undefined;
export function propsV2Enabled(): boolean {
  if (enabled !== undefined) return enabled;
  let q: string | null = null;
  try { q = new URLSearchParams(window.location.search).get('props'); } catch { /* ignore */ }
  enabled = q !== 'old' && artStyle() === 'v2';
  return enabled;
}

export function loadPropsV2(load: Phaser.Loader.LoaderPlugin): void {
  if (!propsV2Enabled()) return;
  for (const p of PROPS_V2) {
    if (p.frame) load.spritesheet(p.key + '_v2', p.file, { frameWidth: p.frame, frameHeight: p.frame });
    else load.image(p.key + '_v2', p.file);
  }
  for (const f of Object.values(FACTION_PROPS)) load.spritesheet(f.key, f.file, { frameWidth: 256, frameHeight: 256 });
}

/** Boot create 一开始调用（在按图宽切帧之前）：有 v2 图就顶替旧键。返回顶替了哪些键。 */
export function applyPropsV2(textures: Phaser.Textures.TextureManager): string[] {
  const done: string[] = [];
  if (!propsV2Enabled()) return done;
  for (const p of PROPS_V2) {
    const v2 = p.key + '_v2';
    if (!textures.exists(v2) || !textures.exists(p.key)) continue;
    textures.renameTexture(p.key, p.key + '_old');
    textures.renameTexture(v2, p.key);
    done.push(p.key);
  }
  // 地火（火盆碎裂后、粮仓起火、董卓纵火都用 ground_fire，循环取 8 帧）：换成手绘地火 fx_ground_fire（6 帧）排成 8 帧循环
  if (textures.exists('fx_ground_fire') && textures.exists('ground_fire')) {
    const src = textures.get('fx_ground_fire').getSourceImage() as HTMLImageElement, C = 192, order = [0, 1, 2, 3, 4, 5, 3, 1];
    const tex = textures.createCanvas('ground_fire_v2', C * 8, C);
    if (tex) {
      order.forEach((f, i) => { tex.context.drawImage(src, f * C, 0, C, C, i * C, 0, C, C); tex.add(i, 0, i * C, 0, C, C); });
      tex.refresh();
      textures.renameTexture('ground_fire', 'ground_fire_old');
      textures.renameTexture('ground_fire_v2', 'ground_fire');
      done.push('ground_fire');
    }
  }
  return done;
}

/** 关隘营寨道具源图：该势力有 v2 图用 v2，否则旧图 sishui_props。 */
export function factionPropsSource(scene: Phaser.Scene, faction: number): string {
  const f = FACTION_PROPS[faction];
  return propsV2Enabled() && f && scene.textures.exists(f.key) ? f.key : 'sishui_props';
}
