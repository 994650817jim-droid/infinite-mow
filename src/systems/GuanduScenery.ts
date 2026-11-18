import Phaser from 'phaser';
import {actorDepth} from '../config';
import {paintV2Ground, paintV2Road} from './EnvGround';
import type {GuanduStage} from '../data/guanduChapter';
import type {CampPoint} from './EnemyCamps';
import type {DepotPoint} from './GrainDepots';

/**
 * 第四章战场：复用现有地面与汜水关物件（城门、箭楼、营帐），程序化调成兖州黄土色；不新生成地面图。
 * 4-1 白马：北面袁军大营（木栅 + 辕门 + 营帐出兵，见 GuanduGameScene），两侧袁军云梯营，两处袁军粮垛。
 * 4-2 延津：无城，十字路口；河北骑营与前营，四辆散落的辎重车（文丑会来劫）。
 * 4-3 乌巢：夜色营地，横向土路营道；乌巢亲军营 / 守粮弓营，三座乌巢粮仓。
 */
export function guanduScenery(scene: Phaser.Scene, stage: GuanduStage, spawnProp?: (frame: number, x: number, y: number, size: number) => void) {
  const key = 'guandu_ground_' + stage;
  // 地面 / 路面 v2（环境互动第一批 ④）：河北平原 + 夯土车辙路（乌巢营地用木板道）；缺图退回下面的程序调色版
  paintV2Ground(scene, key, 'ground_v2_hebei', stage === 3 ? 'rgba(10,16,30,.42)' : undefined);
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, 512, 512)!; const g = tex.context; g.imageSmoothingEnabled = false;
    g.drawImage(scene.textures.get(stage === 1 ? 'ground_hulao' : 'ground_ai2').getSourceImage() as HTMLImageElement, 0, 0, 512, 512);
    // 黄土平原：暖黄叠色 + 轻微去饱和
    g.globalCompositeOperation = 'color'; g.fillStyle = 'rgba(170,138,78,.35)'; g.fillRect(0, 0, 512, 512);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(196,160,92,.14)'; g.fillRect(0, 0, 512, 512);
    if (stage === 3) { g.fillStyle = 'rgba(10,16,30,.42)'; g.fillRect(0, 0, 512, 512); }
    tex.refresh(); tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  const roadKey = 'guandu_road_' + stage, roadWidth = 168;
  // 4-3 原来用军营木板道（竖条木板），横着铺开从上往下看像一道木栅栏、人却能穿过（全场景审查 C）→ 改夜色土路
  paintV2Road(scene, roadKey, 'road_v2_dirt', roadWidth, true, stage === 3 ? 'rgba(10,16,30,.35)' : undefined);
  if (!scene.textures.exists(roadKey)) {
    const road = scene.textures.createCanvas(roadKey, roadWidth, 512)!; const ctx = road.context; ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#7d6a4c'; ctx.fillRect(0, 0, roadWidth, 512);
    for (let y = 0; y < 512; y += 16) for (let x = -12; x < roadWidth; x += 24) { ctx.fillStyle = (x + y) % 3 ? '#8a7756' : '#6f5e43'; ctx.fillRect(x + (y % 32 ? 6 : 0), y + 1, 20, 13); }
    const image = ctx.getImageData(0, 0, road.width, road.height);
    for (let y = 0; y < road.height; y++) for (let x = 0; x < road.width; x++) { const edge = Math.min(x, road.width - 1 - x); if (edge < 10) image.data[(y * road.width + x) * 4 + 3] *= Math.max(0, Math.min(1, (edge + ((x * 13 + y * 7) % 7) - 3) / 10)); }
    ctx.putImageData(image, 0, 0); road.refresh().setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  if (stage !== 3) scene.add.tileSprite(0, 0, roadWidth, 8192, roadKey).setDepth(1);
  if (stage !== 1) scene.add.tileSprite(0, 0, roadWidth, 8192, roadKey).setRotation(Math.PI / 2).setDepth(1);
  const place = (frame: number, x: number, y: number, size: number) => { if (frame >= 3 && spawnProp) { spawnProp(frame, x, y, size); return; } scene.add.image(x, y, 'sishui_props_refined', frame).setOrigin(.5, 1).setDisplaySize(size, size).setDepth(actorDepth(y)); };
  const camps: CampPoint[] = stage === 3 ? [
    {x: -380, y: 300, kind: 'shield', name: '乌巢亲军营'},
    {x: 400, y: -360, kind: 'archer', name: '守粮弓营'},
  ] : stage === 2 ? [
    {x: -360, y: -280, kind: 'cavalry', name: '河北骑营'},
    {x: 380, y: 320, kind: 'infantry', name: '袁军前营'},
  ] : [
    {x: -340, y: 210, kind: 'shield', name: '袁军云梯营'},
    {x: 380, y: -250, kind: 'archer', name: '河北弓营'},
  ];
  // 焚粮目标：4-1 粮垛；4-2 散落辎重车
  const depots: DepotPoint[] = stage === 3 ? [
    {x: -400, y: -150, name: '乌巢粮仓', frame: 1, size: 170}, {x: 390, y: 120, name: '乌巢粮仓', frame: 1, size: 170}, {x: -20, y: -470, name: '乌巢粮仓', frame: 1, size: 170},
  ] : stage === 2 ? [
    {x: -230, y: 60, name: '袁军辎重', frame: 24, size: 110}, {x: 240, y: -130, name: '袁军辎重', frame: 24, size: 110},
    {x: -60, y: 340, name: '袁军辎重', frame: 24, size: 110}, {x: 120, y: -420, name: '袁军辎重', frame: 24, size: 110},
  ] : [
    {x: -440, y: -110, name: '袁军粮垛', frame: 16, size: 120}, {x: 450, y: 170, name: '袁军粮垛', frame: 16, size: 120},
  ];
  for (const c of camps) { place(4, c.x + 113, c.y - 8, 92); place(3, c.x - 110, c.y + 42, 90); place(6, c.x - 98, c.y - 74, 86); place(7, c.x + 108, c.y + 80, 72); }
  if (stage === 3) {
    // 夜色（不另放营火：小火盆在路上显得杂乱，且破坏后的地火会伤人）
    scene.add.rectangle(0, 0, 4000, 4000, 0x0a1428, .14).setDepth(18);
  }
  // 4-1 白马 / 4-2 延津：北面袁军大营（木栅 + 辕门 + 营帐）由 GuanduGameScene 用 SishuiPass 画；原来场中孤零零的白马城门 / 箭楼去掉
  return {key, roadKey, boxes: [] as Array<{left: number; right: number; top: number; bottom: number}>, camps, depots};
}
