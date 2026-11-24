import { lazyScene, type SceneClass } from './LazyScene';
import { SIDE_ROUTES, SIDE_SCENE_KEY } from '../data/sideRoutes';
import type { GameScene } from '../scenes/GameScene';
let basePromise: Promise<typeof GameScene> | undefined;
function base(): Promise<typeof GameScene> {
 return basePromise ??= (import.meta.env.DEV ? import('../dev/DevGameScene').then(m => m.DevGameScene) : import('../scenes/GameScene').then(m => m.GameScene)).catch(error => { basePromise = undefined; throw error; });
}
export function lazyBattleScenes(): SceneClass[] {
 const scenes: SceneClass[] = [lazyScene('GameScene', base)];
 scenes.push(lazyScene('ThirdGameScene', async () => {
  const BattleScene = await base();
  const {thirdGameSceneClass} = await import('../scenes/ThirdGameScene');
  return thirdGameSceneClass(BattleScene);
 }));
 scenes.push(lazyScene('GuanduGameScene', async () => {
  const BattleScene = await base();
  const {guanduGameSceneClass} = await import('../scenes/GuanduGameScene');
  return guanduGameSceneClass(BattleScene);
 }));
 scenes.push(lazyScene('ChibiGameScene', async () => {
  const BattleScene = await base();
  const {CHIBI_STAGES,chibiBattle} = await import('../data/chibiChapter');
  const {thirdGameSceneClass} = await import('../scenes/ThirdGameScene');
  return thirdGameSceneClass(BattleScene,{key:'ChibiGameScene',arc:'chibi',stageKey:'chibiStage',transferKey:'chibiTransfer',stages:CHIBI_STAGES,texture:id=>'chibi_'+id,sheet:id=>'assets/chibi/'+id+'.png',battle:s=>chibiBattle(s),campPrefix:'chibi-',fireShips:[2]});
 }));
 scenes.push(lazyScene('JingnanGameScene', async () => {
  const BattleScene = await base();
  const {JINGNAN_STAGES,JINGNAN_SHEETS,jingnanBattle,jingnanTexture} = await import('../data/jingnanChapter');
  const {jingnanGameSceneClass} = await import('../scenes/JingnanGameScene');
  return jingnanGameSceneClass(BattleScene,{key:'JingnanGameScene',arc:'jingnan',stageKey:'jingnanStage',transferKey:'jingnanTransfer',stages:JINGNAN_STAGES,texture:jingnanTexture,sheet:id=>JINGNAN_SHEETS[jingnanTexture(id)],battle:s=>jingnanBattle(s),campPrefix:'jingnan-'});
 }));
 scenes.push(lazyScene('ShuGameScene', async () => {
  const BattleScene = await base();
  const {shuGameSceneClass} = await import('../scenes/ShuGameScene');
  return shuGameSceneClass(BattleScene);
 }));
 scenes.push(lazyScene('XiangfanGameScene', async () => {
  const BattleScene = await base();
  const {xiangfanGameSceneClass} = await import('../scenes/XiangfanGameScene');
  return xiangfanGameSceneClass(BattleScene);
 }));
 scenes.push(lazyScene('NanzhengGameScene', async () => {
  const BattleScene = await base();
  const {nanzhengGameSceneClass} = await import('../scenes/NanzhengGameScene');
  return nanzhengGameSceneClass(BattleScene);
 }));
 scenes.push(lazyScene('HanzhongGameScene', async () => {
  const BattleScene = await base();
  const {HANZHONG_STAGES,HANZHONG_SHEETS,hanzhongBattle,hanzhongTexture} = await import('../data/hanzhongChapter');
  const {hanzhongGameSceneClass} = await import('../scenes/HanzhongGameScene');
  return hanzhongGameSceneClass(BattleScene,{key:'HanzhongGameScene',arc:'hanzhong',stageKey:'hanzhongStage',transferKey:'hanzhongTransfer',stages:HANZHONG_STAGES,texture:hanzhongTexture,sheet:id=>HANZHONG_SHEETS[hanzhongTexture(id)],battle:s=>hanzhongBattle(s),campPrefix:'hanzhong-'});
 }));
 scenes.push(lazyScene('YilingGameScene', async () => {
  const BattleScene = await base();
  const {YILING_STAGES,YILING_SHEETS,yilingBattle,yilingTexture} = await import('../data/yilingChapter');
  const {yilingGameSceneClass} = await import('../scenes/YilingGameScene');
  return yilingGameSceneClass(BattleScene,{key:'YilingGameScene',arc:'yiling',stageKey:'yilingStage',transferKey:'yilingTransfer',stages:YILING_STAGES,texture:yilingTexture,sheet:id=>YILING_SHEETS[yilingTexture(id)],battle:s=>yilingBattle(s),campPrefix:'yiling-'});
 }));
 scenes.push(lazyScene('BeifaGameScene', async () => {
  const BattleScene = await base();
  const {BEIFA_STAGES,BEIFA_SHEETS,beifaBattle,beifaTexture} = await import('../data/beifaChapter');
  const {beifaGameSceneClass} = await import('../scenes/BeifaGameScene');
  return beifaGameSceneClass(BattleScene,{key:'BeifaGameScene',arc:'beifa',stageKey:'beifaStage',transferKey:'beifaTransfer',stages:BEIFA_STAGES,texture:beifaTexture,sheet:id=>BEIFA_SHEETS[beifaTexture(id)],battle:s=>beifaBattle(s),campPrefix:'beifa-'});
 }));
 scenes.push(lazyScene('SiegeGameScene', async () => {
  const BattleScene = await base();
  const {siegeGameSceneClass} = await import('../scenes/SiegeGameScene');
  return siegeGameSceneClass(BattleScene);
 }));
 scenes.push(lazyScene('IntelGameScene', async () => {
  const BattleScene = await base();
  const {intelGameSceneClass} = await import('../scenes/IntelGameScene');
  return intelGameSceneClass(BattleScene);
 }));
 scenes.push(lazyScene('LubuGameScene', async () => {
  const BattleScene = await base();
  const {lubuGameSceneClass} = await import('../scenes/LubuGameScene');
  return lubuGameSceneClass(BattleScene);
 }));
 scenes.push(lazyScene('GauntletGameScene', async () => {
  const BattleScene = await base();
  const {gauntletGameSceneClass} = await import('../scenes/GauntletGameScene');
  return gauntletGameSceneClass(BattleScene);
 }));
 for (const [index, route] of SIDE_ROUTES.filter(r => r.stages.some(s => !s.scene)).entries()) {
  scenes.push(lazyScene(SIDE_SCENE_KEY(route.id), async () => { const B = await base(); const m = await import('../scenes/SideRouteGameScene'); return m.sideGameScenes(B)[index]; }));
 }
 scenes.push(lazyScene('SideLubuGameScene', async () => { const B = await base(); const m = await import('../scenes/SideRouteGameScene'); return m.sideLubuGameSceneClass(B); }));
 return scenes;
}
