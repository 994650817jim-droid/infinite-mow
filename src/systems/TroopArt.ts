import Phaser from 'phaser';

/**
 * 章节专属兵种的正式美术（ChatGPT 生成，tools/reslice-magenta-sheet.mjs 抠图切格；原图在 public/assets/xiliang/originals/）。
 * 版式同西凉兵：4 行（下 / 左 / 右 / 上）× 4 列，每格 96×96。战斗开始时按需加载；加载完成前敌兵沿用换色占位造型。
 */
export const TROOP_ART: Record<string, string> = {
  dongzhuo_walk: 'assets/xiliang/dongzhuo-walk.png',
  dongzhuo_attack: 'assets/xiliang/dongzhuo-attack.png',
  feixiong_walk: 'assets/xiliang/feixiong-walk.png',
  feixiong_attack: 'assets/xiliang/feixiong-attack.png',
  hubao_walk: 'assets/xiliang/hubao-walk.png',
};
const DIRS = ['down', 'left', 'right', 'up'] as const;
/** 首领图每格 128（华雄同版式），兵种每格 96。 */
const CELL: Record<string, number> = {dongzhuo_walk: 128, dongzhuo_attack: 128};
const cellOf = (key: string): number => CELL[key] ?? 96;

function nameFrames(scene: Phaser.Scene, key: string): void {
  const t = scene.textures.get(key);
  const n = cellOf(key);
  DIRS.forEach((dir, row) => { for (let col = 0; col < 4; col++) if (!t.has(`${dir}_${col}`)) t.add(`${dir}_${col}`, 0, col * n, row * n, n, n); });
}
/** 确保这些图已加载（已有则直接命名帧）；返回是否全部就绪。 */
export function ensureTroopArt(scene: Phaser.Scene, keys: readonly string[]): boolean {
  const missing = keys.filter(k => !scene.textures.exists(k) && TROOP_ART[k]);
  for (const k of keys) if (scene.textures.exists(k)) nameFrames(scene, k);
  if (!missing.length) return true;
  for (const k of missing) scene.load.spritesheet(k, TROOP_ART[k], {frameWidth: cellOf(k), frameHeight: cellOf(k)});
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => { for (const k of missing) if (scene.textures.exists(k)) nameFrames(scene, k); });
  if (!scene.load.isLoading()) scene.load.start();
  return false;
}
export function troopArtReady(scene: Phaser.Scene, key: string): boolean { return scene.textures.exists(key) && scene.textures.get(key).has('down_0'); }
