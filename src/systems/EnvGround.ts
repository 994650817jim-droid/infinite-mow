import Phaser from 'phaser';

/**
 * 地面与道路 v2（场地环境互动第一批 ④，env-interaction-proposal.md 3.1）：ChatGPT 出的 v2 厚涂像素地面 / 路面，
 * tools/prepare-ground.mjs、prepare-road.mjs 处理成无缝平铺。各章 Scenery 原来用程序调色的旧地面与程序画的灰色石板路，
 * 有 v2 图时改从这里取；缺图时各 Scenery 退回原来的程序版本。
 * 尺寸：原图 1254 美术像素 ≈ 人物 v2 的像素密度（1080p 下 1:1 = 0.5 逻辑像素），所以画进 627 的画布、平铺倍率保持 1。
 */
export const ENV_GROUND_FILES: Readonly<Record<string, string>> = {
  ground_v2_guanzhong: 'assets/env-v2/ground_guanzhong.png', // 关中黄土碎石：第二章汜水关 / 洛阳
  ground_v2_changan: 'assets/env-v2/ground_changan.png', // 长安夯土：第三章
  ground_v2_hebei: 'assets/env-v2/ground_hebei.png', // 河北平原：第四章官渡
  ground_v2_jiang: 'assets/env-v2/ground_jiang.png', // 江岸湿地：第五章赤壁 / 长坂
  road_v2_dirt: 'assets/env-v2/road_dirt.png', // 夯土车辙路（竖条）
  road_v2_stone: 'assets/env-v2/road_stone.png', // 石板官道（竖条）
  road_v2_plank: 'assets/env-v2/road_plank.png', // 军营木板道（竖条）
};

export function loadEnvGround(load: Phaser.Loader.LoaderPlugin): void { for (const [k, f] of Object.entries(ENV_GROUND_FILES)) load.image(k, f); }

/** 把 v2 地面画进指定键的画布纹理（627 见方，可选叠色 / 压暗）。缺图返回 false。 */
export function paintV2Ground(scene: Phaser.Scene, key: string, source: string, overlay?: string): boolean {
  if (!scene.textures.exists(source)) return false;
  if (scene.textures.exists(key)) return true;
  const S = 627, tex = scene.textures.createCanvas(key, S, S)!, g = tex.context;
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(scene.textures.get(source).getSourceImage() as HTMLImageElement, 0, 0, S, S);
  if (overlay) { g.fillStyle = overlay; g.fillRect(0, 0, S, S); }
  tex.refresh(); tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return true;
}

/**
 * 把 v2 路面（竖条）按路宽缩放画进画布纹理：vertical 为竖向平铺（宽 = 路宽）；否则转 90° 成横向（高 = 路宽）。缺图返回 false。
 */
export function paintV2Road(scene: Phaser.Scene, key: string, source: string, width: number, vertical = true, overlay?: string): boolean {
  if (!scene.textures.exists(source)) return false;
  if (scene.textures.exists(key)) return true;
  const img = scene.textures.get(source).getSourceImage() as HTMLImageElement, k = width / img.width, len = Math.round(img.height * k);
  const tex = scene.textures.createCanvas(key, vertical ? width : len, vertical ? len : width)!, g = tex.context;
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  if (vertical) g.drawImage(img, 0, 0, width, len);
  else { g.translate(len, 0); g.rotate(Math.PI / 2); g.drawImage(img, 0, 0, width, len); g.setTransform(1, 0, 0, 1, 0, 0); }
  if (overlay) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = overlay; g.fillRect(0, 0, tex.width, tex.height); g.globalCompositeOperation = 'source-over'; }
  tex.refresh(); tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return true;
}
