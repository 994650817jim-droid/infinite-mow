// 测试模式（开发构建 + ?dev=1）的测试存档隔离：必须在任何模块读写存档之前装好；正式构建里是空模块
import './dev/TestSave';
// 桌面版（Steam）平台层必须最先执行：替换 localStorage 为存档文件
import { TalentHallScene } from './scenes/TalentHallScene';
import './platform/desktop';
// 中途退出不算：上次没打完就关了 / 刷新 / 崩溃 → 先把存档回滚到那场进关前（必须在任何模块缓存存档之前）
import './systems/BattleSnapshotBoot';
import {NanzhengChapterScene} from './scenes/NanzhengChapterScene';import {nanzhengGameSceneClass} from './scenes/NanzhengGameScene';import {YILING_STAGES,YILING_SHEETS,yilingBattle,yilingTexture} from './data/yilingChapter';import {YilingChapterScene} from './scenes/YilingChapterScene';import {yilingGameSceneClass} from './scenes/YilingGameScene';import {BEIFA_STAGES,BEIFA_SHEETS,beifaBattle,beifaTexture} from './data/beifaChapter';import {BeifaChapterScene} from './scenes/BeifaChapterScene';import {beifaGameSceneClass} from './scenes/BeifaGameScene';import {EndingScene} from './scenes/EndingScene';import {XiangfanChapterScene} from './scenes/XiangfanChapterScene';import {xiangfanGameSceneClass} from './scenes/XiangfanGameScene';import {ShuChapterScene} from './scenes/ShuChapterScene';import {shuGameSceneClass} from './scenes/ShuGameScene';import {ThirdChapterScene} from './scenes/ThirdChapterScene';import {ChibiChapterScene} from './scenes/ChibiChapterScene';import {CHIBI_STAGES,chibiBattle} from './data/chibiChapter';import {JINGNAN_STAGES,JINGNAN_SHEETS,jingnanBattle,jingnanTexture} from './data/jingnanChapter';import {JingnanChapterScene} from './scenes/JingnanChapterScene';import {jingnanGameSceneClass} from './scenes/JingnanGameScene';import {HANZHONG_STAGES,HANZHONG_SHEETS,hanzhongBattle,hanzhongTexture} from './data/hanzhongChapter';import {HanzhongChapterScene} from './scenes/HanzhongChapterScene';import {hanzhongGameSceneClass} from './scenes/HanzhongGameScene';import {thirdGameSceneClass} from './scenes/ThirdGameScene';import {GuanduChapterScene} from './scenes/GuanduChapterScene';import {guanduGameSceneClass} from './scenes/GuanduGameScene';import {siegeGameSceneClass} from './scenes/SiegeGameScene';import {intelGameSceneClass} from './scenes/IntelGameScene';import {lubuGameSceneClass} from './scenes/LubuGameScene';
import {loadGameFonts} from './ui/GameFonts';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, IS_DESKTOP, RENDER_SCALE, initLayout, switchLayout } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { CityRecruitScene } from './scenes/CityRecruitScene';
import { TownScene } from './scenes/TownScene';
import { CityScene } from './scenes/CityScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { MenuScene } from './scenes/MenuScene';
import { OpeningScene } from './scenes/OpeningScene';
import { installGamepad } from './ui/PadNavigator';
import { installCjkWrap } from './ui/CjkWrap';
import { installAchievements } from './systems/Achievements';
import { installLowResTextures } from './systems/LowResTextures';
import { attachLeanBoot, installLeanBoot } from './systems/LeanBoot';

initLayout();
// 手机省内存：大图缩一半、canvas 贴图不留 ImageData 副本（电脑不启用，见 systems/LowResTextures.ts）
installLowResTextures();
installLeanBoot();
installCjkWrap();

// 高清渲染：画布放大 RENDER_SCALE 倍，每个相机以左上角为原点同倍缩放，
// 所有场景继续使用 540×960 / 960×540 的设计坐标；文字内部画布同倍率绘制以免发糊。
if (RENDER_SCALE !== 1) {
  const cameraAdd = Phaser.Cameras.Scene2D.CameraManager.prototype.add;
  Phaser.Cameras.Scene2D.CameraManager.prototype.add = function (this: Phaser.Cameras.Scene2D.CameraManager, ...args: Parameters<typeof cameraAdd>) {
    return cameraAdd.apply(this, args).setOrigin(0, 0).setZoom(RENDER_SCALE);
  } as typeof cameraAdd;
  // Phaser 按“中心缩放”计算 worldView/midPoint/centerOn；原点改为左上角后需按左上角重算，
  // 否则可见区域偏移半屏：屏幕上方与左侧的小怪被当作屏外不更新走路帧（平移）、友军显示分配与特效裁剪也会出错。
  const Camera = Phaser.Cameras.Scene2D.Camera.prototype;
  const preRender = Camera.preRender;
  Camera.preRender = function (this: Phaser.Cameras.Scene2D.Camera) {
    preRender.call(this);
    if (this.originX === 0 && this.originY === 0 && (this.zoomX !== 1 || this.zoomY !== 1)) {
      const w = this.width / this.zoomX, h = this.height / this.zoomY;
      this.worldView.setTo(this.scrollX, this.scrollY, w, h);
      this.midPoint.set(this.scrollX + w / 2, this.scrollY + h / 2);
    }
  } as typeof preRender;
  const centerOn = Camera.centerOn;
  Camera.centerOn = function (this: Phaser.Cameras.Scene2D.Camera, x: number, y: number) {
    if (this.originX !== 0 || this.originY !== 0 || (this.zoomX === 1 && this.zoomY === 1)) return centerOn.call(this, x, y);
    this.scrollX = x - this.width / this.zoomX / 2; this.scrollY = y - this.height / this.zoomY / 2;
    this.midPoint.set(x, y);
    return this;
  } as typeof centerOn;
  const setStyle = Phaser.GameObjects.TextStyle.prototype.setStyle;
  Phaser.GameObjects.TextStyle.prototype.setStyle = function (this: Phaser.GameObjects.TextStyle, ...args: Parameters<typeof setStyle>) {
    const out = setStyle.apply(this, args);
    if (!this.resolution || this.resolution < RENDER_SCALE) this.resolution = RENDER_SCALE;
    return out;
  } as typeof setStyle;
}

async function startGame(): Promise<void> {
  await loadGameFonts();
  const BattleScene = import.meta.env.DEV ? (await import('./dev/DevGameScene')).DevGameScene : GameScene;
  const ThirdBattleScene=thirdGameSceneClass(BattleScene);
  const GuanduBattleScene=guanduGameSceneClass(BattleScene);
  const ChibiBattleScene=thirdGameSceneClass(BattleScene,{key:'ChibiGameScene',arc:'chibi',stageKey:'chibiStage',transferKey:'chibiTransfer',stages:CHIBI_STAGES,texture:id=>'chibi_'+id,sheet:id=>'assets/chibi/'+id+'.png',battle:s=>chibiBattle(s),campPrefix:'chibi-',fireShips:[2]});
  const JingnanBattleScene=jingnanGameSceneClass(BattleScene,{key:'JingnanGameScene',arc:'jingnan',stageKey:'jingnanStage',transferKey:'jingnanTransfer',stages:JINGNAN_STAGES,texture:jingnanTexture,sheet:id=>JINGNAN_SHEETS[jingnanTexture(id)],battle:s=>jingnanBattle(s),campPrefix:'jingnan-'});
  const ShuBattleScene=shuGameSceneClass(BattleScene);
  const XiangfanBattleScene=xiangfanGameSceneClass(BattleScene);
  const NanzhengBattleScene=nanzhengGameSceneClass(BattleScene);
  const HanzhongBattleScene=hanzhongGameSceneClass(BattleScene,{key:'HanzhongGameScene',arc:'hanzhong',stageKey:'hanzhongStage',transferKey:'hanzhongTransfer',stages:HANZHONG_STAGES,texture:hanzhongTexture,sheet:id=>HANZHONG_SHEETS[hanzhongTexture(id)],battle:s=>hanzhongBattle(s),campPrefix:'hanzhong-'});
  const YilingBattleScene=yilingGameSceneClass(BattleScene,{key:'YilingGameScene',arc:'yiling',stageKey:'yilingStage',transferKey:'yilingTransfer',stages:YILING_STAGES,texture:yilingTexture,sheet:id=>YILING_SHEETS[yilingTexture(id)],battle:s=>yilingBattle(s),campPrefix:'yiling-'});
  const BeifaBattleScene=beifaGameSceneClass(BattleScene,{key:'BeifaGameScene',arc:'beifa',stageKey:'beifaStage',transferKey:'beifaTransfer',stages:BEIFA_STAGES,texture:beifaTexture,sheet:id=>BEIFA_SHEETS[beifaTexture(id)],battle:s=>beifaBattle(s),campPrefix:'beifa-'});
  const SiegeBattleScene=siegeGameSceneClass(BattleScene);
  const IntelBattleScene=intelGameSceneClass(BattleScene);
  const LubuBattleScene=lubuGameSceneClass(BattleScene);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH * RENDER_SCALE,
    height: GAME_HEIGHT * RENDER_SCALE,
    backgroundColor: '#14100c',
    // Smooth high-resolution UI text; BootScene keeps character atlases pixel-sharp.
    pixelArt: false,
    antialias: true,
    roundPixels: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      activePointers: 3,
    },
    scene: [BootScene, OpeningScene, CityScene, CityRecruitScene, TownScene, TalentHallScene, WorldMapScene, MenuScene, BattleScene, ThirdChapterScene, ThirdBattleScene, GuanduChapterScene, GuanduBattleScene, ChibiChapterScene, ChibiBattleScene, JingnanChapterScene, JingnanBattleScene, ShuChapterScene, ShuBattleScene, HanzhongChapterScene, HanzhongBattleScene, XiangfanChapterScene, XiangfanBattleScene, YilingChapterScene, YilingBattleScene, NanzhengChapterScene, NanzhengBattleScene, BeifaChapterScene, BeifaBattleScene, EndingScene, SiegeBattleScene, IntelBattleScene, LubuBattleScene],
  });

  // 手柄：每帧轮询 + 界面焦点导航（STEAM_PLAN.md · S2）
  const pad = installGamepad(game);
  installAchievements(game);
  attachLeanBoot(game);
  // 开发构建，或桌面版自动测试（IM_TEST=1 启动）时暴露游戏实例供测试脚本使用；正式发行的玩家环境不暴露
  if (import.meta.env.DEV || window.imDesktop?.testMode) { (window as unknown as { __game?: Phaser.Game }).__game = game; (window as unknown as { __pad?: unknown }).__pad = pad; }
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === '1') mountDevLayoutToggle();

}

void startGame();

/** DEV 版右上角：手机 / 电脑布局一键切换（写入布局偏好并刷新，保留 dev=1）。正式构建不包含。 */
function mountDevLayoutToggle(): void {
  document.getElementById('dev-layout-toggle')?.remove();
  const box = document.createElement('div');
  box.id = 'dev-layout-toggle';
  box.style.cssText = 'position:fixed;top:2px;right:2px;z-index:1000000;display:flex;border:1px solid #c9a45c;border-radius:5px;overflow:hidden;font:10px/1 system-ui,sans-serif;opacity:.9;background:rgba(20,14,10,.88);box-shadow:0 2px 8px rgba(0,0,0,.4)';
  for (const [mode, label] of [['mobile', '手机布局'], ['desktop', '电脑布局']] as const) {
    const on = (mode === 'desktop') === IS_DESKTOP;
    const b = document.createElement('button');
    b.textContent = label; b.title = on ? '当前布局' : '切换到' + label;
    b.style.cssText = 'border:0;padding:3px 7px;cursor:' + (on ? 'default' : 'pointer') + ';background:' + (on ? '#7a5a2a' : 'transparent') + ';color:' + (on ? '#fff3d0' : '#d8c7a6') + ';font:inherit';
    b.onclick = (e) => { e.stopPropagation(); if (!on) switchLayout(mode); };
    box.appendChild(b);
  }
  box.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.body.appendChild(box);
}
