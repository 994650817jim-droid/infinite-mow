import Phaser from 'phaser';
import {actorDepth} from '../config';
import type {CityDef} from '../world/WorldCities';
import type {CampPoint} from './EnemyCamps';
import {SIEGE} from '../data/siege';

/**
 * 攻城战场：复用现有地面与汜水关物件。北方城池用关中黄土地面，南方（原画长江以南）用绿地面。
 * 小城：一座守军营。中城：城门（装饰、不可破）与两座箭楼、两座营。大城：箭楼与两座营，城门由场景生成为可破坏物件。
 */
export const SIEGE_GATE = {x: 0, y: -280, size: 300} as const;
/** opts.liveTowers：攻城时两座箭楼改由战斗场景生成为可摧毁目标，这里不放装饰箭楼与碰撞框。 */
export function siegeScenery(scene: Phaser.Scene, city: CityDef, spawnProp?: (frame: number, x: number, y: number, size: number) => void, opts: {liveTowers?: boolean} = {}) {
  const south = city.y > 600, key = 'siege_ground_' + (south ? 's' : 'n');
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, 512, 512)!; const g = tex.context; g.imageSmoothingEnabled = false;
    g.drawImage(scene.textures.get(south ? 'ground_ai2' : 'ground_hulao').getSourceImage() as HTMLImageElement, 0, 0, 512, 512);
    if (!south) { g.globalCompositeOperation = 'color'; g.fillStyle = 'rgba(160,132,84,.22)'; g.fillRect(0, 0, 512, 512); g.globalCompositeOperation = 'source-over'; }
    tex.refresh(); tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  const roadKey = 'siege_road', roadWidth = 160;
  if (!scene.textures.exists(roadKey)) {
    const road = scene.textures.createCanvas(roadKey, roadWidth, 512)!; const ctx = road.context; ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#76654b'; ctx.fillRect(0, 0, roadWidth, 512);
    for (let y = 0; y < 512; y += 16) for (let x = -12; x < roadWidth; x += 24) { ctx.fillStyle = (x + y) % 3 ? '#837154' : '#6a5b42'; ctx.fillRect(x + (y % 32 ? 6 : 0), y + 1, 20, 13); }
    const image = ctx.getImageData(0, 0, road.width, road.height);
    for (let y = 0; y < road.height; y++) for (let x = 0; x < road.width; x++) { const edge = Math.min(x, road.width - 1 - x); if (edge < 10) image.data[(y * road.width + x) * 4 + 3] *= Math.max(0, Math.min(1, (edge + ((x * 13 + y * 7) % 7) - 3) / 10)); }
    ctx.putImageData(image, 0, 0); road.refresh().setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  scene.add.tileSprite(0, 0, roadWidth, 8192, roadKey).setDepth(1);
  const place = (frame: number, x: number, y: number, size: number) => { if (frame >= 3 && spawnProp) { spawnProp(frame, x, y, size); return; } scene.add.image(x, y, 'sishui_props_refined', frame).setOrigin(.5, 1).setDisplaySize(size, size).setDepth(actorDepth(y)); };
  const all: CampPoint[] = [{x: -340, y: 220, kind: 'shield', name: '城外守军营'}, {x: 360, y: -420, kind: 'archer', name: '城头弓营'}];
  const camps = all.slice(0, SIEGE[city.tier].camps);
  for (const c of camps) { place(4, c.x + 113, c.y - 8, 92); place(3, c.x - 110, c.y + 42, 90); place(6, c.x - 98, c.y - 74, 86); }
  const boxes: Array<{left: number; right: number; top: number; bottom: number}> = [];
  if (city.tier !== 'small' && !opts.liveTowers) {
    for (const x of [-250, 250]) place(1, x, -265, 126);
    boxes.push(...[-250, 250].map(x => ({left: x - 34, right: x + 34, top: -300, bottom: -265})));
  }
  if (city.tier === 'medium') { place(0, SIEGE_GATE.x, SIEGE_GATE.y, SIEGE_GATE.size); boxes.push({left: -125, right: 125, top: -340, bottom: -285}); }
  return {key, roadKey, boxes, camps};
}
