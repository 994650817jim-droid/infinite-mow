import Phaser from 'phaser';
import { actorDepth } from '../config';
import { MID_SIEGE_FILES } from './SiegeMidArt';

/**
 * 场景审查 P3 的关卡布景（全部复用现成手绘图，不画替代图形；实心部分进场景碰撞框，画面和碰撞一致、刷兵避开）：
 *  - 1-2 下曲阳：北面张宝法坛营（法坛图 zhang_bao_altar + 黄巾营具：营帐、黄旗、木栅），开局就在（原来一片空地，法坛首领出阵才出现）。
 *  - 2-3 洛阳：两翼烧毁的洛阳民居、残墙（攻城街巷 / 城墙图集，压暗成焦黑）+ 房上地火（手绘地火序列帧）。
 */
type Box = { left: number; right: number; top: number; bottom: number };
type Pt = { x: number; y: number };

/** 攻城图集（城墙 / 街巷）现载；载完回调。 */
function withSheet(scene: Phaser.Scene, i: number, fn: () => void): void {
  const K = MID_SIEGE_FILES[i]; if (scene.textures.exists(K.key)) { fn(); return; }
  scene.load.spritesheet(K.key, K.file, { frameWidth: K.cell, frameHeight: K.cell });
  scene.load.once('filecomplete-spritesheet-' + K.key, () => { if (scene.sys.isActive()) fn(); });
  if (!scene.load.isLoading()) scene.load.start();
}
const img = (s: Phaser.Scene, x: number, y: number, key: string, frame: number | string, w: number, h = w, name = 'dressing') =>
  s.add.image(x, y, key, frame).setOrigin(.5, 1).setDisplaySize(w, h).setDepth(actorDepth(y)).setName(name);

/** 1-2 下曲阳 · 张宝法坛营：法坛居中（实心）、两侧木栅（实心，中间留营门）、营帐黄旗。p = 开局主将位置。 */
export function xiaquyangAltarCamp(scene: Phaser.Scene, p: Pt, boxes: Box[]): void {
  const y = p.y - 760, x = p.x;
  if (scene.textures.exists('zhang_bao_altar')) { img(scene, x, y + 40, 'zhang_bao_altar', 0 as unknown as string, 340, 276, 'xiaquyang-altar'); boxes.push({ left: x - 120, right: x + 120, top: y - 30, bottom: y + 30 }); }
  if (!scene.textures.exists('yellow_props')) return;
  // 木栅：法坛前一排，中间留 240 宽营门
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++) { const sx = x + side * (200 + k * 118); img(scene, sx, y + 150, 'yellow_props', 12, 128, 128, 'xiaquyang-fence'); }
  for (const side of [-1, 1]) boxes.push({ left: side < 0 ? x - 200 - 3 * 118 - 64 : x + 200 - 64, right: side < 0 ? x - 200 + 64 : x + 200 + 3 * 118 + 64, top: y + 120, bottom: y + 150 });
  // 营帐、黄旗（布景，不挡：在木栅后面）
  for (const [dx, dy, f, s] of [[-430, -60, 0, 170], [430, -50, 1, 170], [-250, -120, 2, 150], [260, -130, 3, 150], [-120, 60, 4, 110], [130, 60, 5, 110], [-560, 80, 6, 110], [560, 90, 7, 110]] as const)
    img(scene, x + dx, y + dy, 'yellow_props', f, s, s, 'xiaquyang-camp');
}

/** 2-3 洛阳 · 火城：两翼烧毁的民居 / 残墙（实心）+ 房上地火。 */
export function luoyangRuins(scene: Phaser.Scene, p: Pt, boxes: Box[]): void {
  const spots: Array<[number, number, 'house' | 'ruin', number]> = [
    [-820, -180, 'house', 0], [-980, 220, 'ruin', 6], [-760, 520, 'house', 1], [-560, 760, 'ruin', 6],
    [820, -160, 'house', 2], [990, 240, 'ruin', 6], [760, 540, 'house', 0], [560, 780, 'ruin', 6],
  ];
  for (const [dx, dy, kind] of spots) { const x = p.x + dx, y = p.y + dy; boxes.push({ left: x - 95, right: x + 95, top: y - 50, bottom: y - 4 }); void kind; }
  /** 房上地火：深度跟着所在那座房（baseY），画在房前。 */
  const fire = (x: number, y: number, size: number, baseY: number) => {
    if (!scene.textures.exists('ground_fire')) return;
    const sp = scene.add.sprite(x, y, 'ground_fire', 0).setOrigin(.5, .85).setDisplaySize(size, size).setDepth(actorDepth(baseY) + .02).setName('luoyang-fire');
    const st = { t: Math.random() * 7 };
    scene.tweens.add({ targets: st, t: st.t + 8, duration: 1100, repeat: -1, onUpdate: () => { if (sp.active) sp.setFrame(Math.floor(st.t) % 8); } });
  };
  withSheet(scene, 3, () => withSheet(scene, 0, () => {
    for (const [dx, dy, kind, f] of spots) {
      const x = p.x + dx, y = p.y + dy;
      if (kind === 'house') { img(scene, x, y, MID_SIEGE_FILES[3].key, f, 250, 250, 'luoyang-ruin').setTint(0x4c3c36); fire(x - 40, y - 110, 130, y); fire(x + 50, y - 80, 104, y); }
      else { img(scene, x, y, MID_SIEGE_FILES[0].key, f, 240, 240, 'luoyang-ruin').setTint(0x6a5a50); fire(x + 20, y - 30, 96, y); }
    }
  }));
}
