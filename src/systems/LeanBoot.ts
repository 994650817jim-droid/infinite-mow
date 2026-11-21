import Phaser from 'phaser';
import { LOW_RES } from './LowResTextures';

/**
 * 手机省内存（2026-11-18 用户「手机还是打不开游戏」，iOS 页面内存超限崩溃）。电脑版 LOW_RES 为 false，这里什么都不做。
 *  1. 精简启动（BootScene.lean）：首次只载入主页 / 界面资源；战斗场景要启动而战斗图集还没载入时，先转到 BootScene 载入
 *     （pendingWarlord 通路，带着原来的场景数据再启动那个战斗场景）。
 *  2. 离开战斗回到主页 / 地图 / 武将堂等界面：卸载战斗图集（与 CityScene 进主城时的做法一致），精简启动载入的图保留。
 *  3. 主页 / 地图 / 营寨等界面自己载入的图（选将立绘、地图、建筑…）记在该界面名下，界面关闭时卸掉，下次进来各界面按需重新载入。
 * 卸载在对应场景关闭（shutdown）之后的下一帧进行：场景对象已销毁、场景自己的收尾（有的会直接 destroy 自己建的 canvas 贴图）也已做完；
 * 界面图按贴图对象记账，只卸「还是当初那张」的（新界面若重建了同名贴图不会被误删）。
 */
const BATTLE_SCENES = new Set([
  'GameScene', 'LubuGameScene', 'ThirdGameScene', 'GuanduGameScene', 'ChibiGameScene', 'JingnanGameScene', 'ShuGameScene', 'HanzhongGameScene',
  'XiangfanGameScene', 'YilingGameScene', 'NanzhengGameScene', 'BeifaGameScene', 'SiegeGameScene', 'IntelGameScene',
]);
/** 回到这些界面时卸载战斗图集。 */
const SHELL_SCENES = new Set(['MenuScene', 'WorldMapScene', 'OpeningScene', 'TalentHallScene', 'TownScene', 'CityRecruitScene']);
/** 这些界面自己载入的图，界面关闭时卸掉。 */
const OWNER_SCENES = new Set([...SHELL_SCENES, 'CityScene']);

/**
 * 精简启动开关（2026-11-20 首屏加载优化）：开机只载入主页 / 选将 / 通用界面素材，战斗素材进关时才载入（BootScene 第二遍）。
 * 手机一直是这样；现在电脑也一样（原来开机把全游戏素材一次载完，公网上 100 多 MB、几百个请求）。
 * 测试入口 ?autostart=1（直接进战斗）和 ?lean=0 保持旧的「全载」；?lean=1 可强制开。卸载战斗图集 / 界面图的省内存逻辑仍只在手机（LOW_RES）上做——电脑内存够，同一章连打也不用重载。
 */
export const LEAN_BOOT: boolean = ((): boolean => {
  if (LOW_RES) return true; if (typeof location === 'undefined') return false;
  const q = new URLSearchParams(location.search); if (q.get('lean') === '1') return true; if (q.get('lean') === '0' || q.has('autostart')) return false; return true;
})();

let owner: string | null = null;
const owned = new Map<string, Map<string, Phaser.Textures.Texture>>();
const hooked = new Set<string>();

function removeTexture(game: Phaser.Game, key: string): boolean {
  if (!game.textures.exists(key)) return false;
  // 源图立刻放掉（不等垃圾回收）：缩小图转成的 ImageBitmap 要 close()，<img> 去掉 src
  for (const s of game.textures.get(key).source) {
    const img = s.image as unknown;
    try { if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) img.close(); else if (img instanceof HTMLImageElement) { img.removeAttribute('src'); } } catch { /* 忽略 */ }
  }
  try { game.textures.remove(key); }
  catch { delete (game.textures as unknown as { list: Record<string, unknown> }).list[key]; } // 已被别处直接 destroy 过的贴图：只从表里摘掉
  return true;
}
const keepSet = (game: Phaser.Game): Set<string> => new Set((game.registry.get('shellTextureKeys') as string[] | undefined) ?? []);

/** 卸载战斗图集（精简启动载入的键保留）。返回卸掉的张数。 */
export function releaseBattleTextures(game: Phaser.Game): number {
  const reg = game.registry, keys = reg.get('battleTextureKeys') as string[] | undefined; if (!keys) return 0;
  // 已启动的新界面若用了其中几张（如主页的章节卡用到首领小像），这几张留着
  const keep = keepSet(game), used = inUse(game); let n = 0;
  for (const key of keys) if (!keep.has(key) && !used.has(key) && removeTexture(game, key)) n++;
  reg.remove('battleTextureKeys'); reg.set('battleReady', false);
  return n;
}
/** 所有在运行的场景里，还有对象在用的纹理键（含容器里的子对象）。卸载前跳过这些。 */
function inUse(game: Phaser.Game): Set<string> {
  const used = new Set<string>();
  const walk = (list: Phaser.GameObjects.GameObject[]): void => { for (const o of list) { const k = (o as unknown as { texture?: { key?: string } }).texture?.key; if (k) used.add(k); const c = (o as unknown as { list?: Phaser.GameObjects.GameObject[] }).list; if (c) walk(c); } };
  for (const sc of game.scene.getScenes(false)) if (sc.sys.isActive() || sc.sys.isPaused() || sc.sys.isSleeping()) walk(sc.children.list);
  return used;
}
function releaseOwned(game: Phaser.Game, scene: string): number {
  const set = owned.get(scene); owned.delete(scene); if (!set) return 0;
  const used = inUse(game), keep = keepSet(game), battle = new Set((game.registry.get('battleTextureKeys') as string[] | undefined) ?? []), list = (game.textures as unknown as { list: Record<string, Phaser.Textures.Texture> }).list; let n = 0;
  for (const [key, tex] of set) if (list[key] === tex && tex.manager && !used.has(key) && !keep.has(key) && !battle.has(key) && !key.startsWith('__') && removeTexture(game, key)) n++;
  return n;
}
/** 等当前这一帧的场景切换（各场景 shutdown 收尾）都做完再执行。 */
const afterStep = (game: Phaser.Game, fn: () => void): void => { game.events.once(Phaser.Core.Events.POST_STEP, fn); };

/** 当前纹理估算（宽×高×4，缩小过的按真实像素），MB。 */
export function textureMB(game: Phaser.Game): number {
  let mb = 0;
  for (const key of game.textures.getTextureKeys()) for (const s of game.textures.get(key).source) { const lr = (s.image as unknown as { __loReal?: [number, number] }).__loReal; mb += (lr ? lr[0] * lr[1] : s.width * s.height) * 4 / 1048576; }
  return mb;
}
/** 手机上超过这个纹理量就在控制台警告；在主页 / 地图等界面时顺手卸掉残留的战斗图集。 */
const WARN_MB = 260;

/** 在 Phaser.Game 创建之后调用：开始记录各界面载入的纹理；每 15 秒在控制台打印纹理内存。 */
export function attachLeanBoot(game: Phaser.Game): void {
  if (!LOW_RES) return;
  setInterval(() => {
    const mb = textureMB(game), scenes = game.scene.getScenes(true).map(s => s.scene.key);
    if (mb > WARN_MB) {
      console.warn(`[LeanBoot] 纹理内存 ${mb.toFixed(0)} MB 超过 ${WARN_MB} MB（${scenes.join(',')}）`);
      if (game.registry.get('battleReady') && !scenes.some(k => BATTLE_SCENES.has(k)) && game.registry.get('shellTextureKeys')) console.info(`[LeanBoot] 不在战斗中：卸载战斗图集 ${releaseBattleTextures(game)} 张`);
    } else console.info(`[LeanBoot] 纹理内存 ${mb.toFixed(0)} MB（${scenes.join(',')}）`);
  }, 15000);
  game.textures.on(Phaser.Textures.Events.ADD, (key: string, tex: Phaser.Textures.Texture) => { if (owner) { let set = owned.get(owner); if (!set) owned.set(owner, set = new Map()); set.set(key, tex); } });
}

export function installLeanBoot(): void {
  if (!LEAN_BOOT) return;
  const mgr = Phaser.Scenes.SceneManager.prototype as unknown as { start(key: string, data?: object): unknown };
  const start = mgr.start;
  mgr.start = function (this: Phaser.Scenes.SceneManager, key: string, data?: object) {
    const game = (this as unknown as { game: Phaser.Game }).game, reg = game.registry;
    if (BATTLE_SCENES.has(key) && !reg.get('battleReady')) {
      reg.set('pendingWarlord', key); reg.set('pendingBattleData', data); reg.set('loadBattle', true);
      return start.call(this, 'BootScene');
    }
    // 回到主页 / 地图等：战斗场景关闭后卸载战斗图集
    if (LOW_RES && SHELL_SCENES.has(key) && reg.get('battleReady') && reg.get('shellTextureKeys')) {
      const release = (): void => { if (!reg.get('battleReady')) return; const n = releaseBattleTextures(game); console.info(`[LeanBoot] 回到 ${key}：卸载战斗图集 ${n} 张`); };
      const live = game.scene.getScenes(true).filter(s => BATTLE_SCENES.has(s.scene.key));
      if (live.length) live[live.length - 1].events.once(Phaser.Scenes.Events.SHUTDOWN, () => afterStep(game, release)); else afterStep(game, release);
    }
    // 界面自己载入的图：记在该界面名下，界面关闭时卸掉
    owner = LOW_RES && OWNER_SCENES.has(key) ? key : null;
    if (owner && !hooked.has(key)) {
      hooked.add(key);
      const sc = this.getScene(key) as Phaser.Scene | null;
      sc?.events.on(Phaser.Scenes.Events.SHUTDOWN, () => { if (owner === key) owner = null; const set = owned.get(key); owned.delete(key); afterStep(game, () => {
        // 原地重开（restart）：同一界面又起来了，它会接着用这些图，不卸，记回它名下
        if (game.scene.isActive(key)) { if (set) { let cur = owned.get(key); if (!cur) owned.set(key, cur = new Map()); for (const [k, t] of set) cur.set(k, t); } return; }
        if (set) owned.set('~' + key, set); const n = releaseOwned(game, '~' + key); if (n) console.info(`[LeanBoot] 离开 ${key}：卸载 ${n} 张界面图`); }); });
    }
    return start.call(this, key, data);
  };
}
