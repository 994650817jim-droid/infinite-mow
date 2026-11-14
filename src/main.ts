import {ThirdChapterScene} from './scenes/ThirdChapterScene';import {thirdGameSceneClass} from './scenes/ThirdGameScene';
import {loadGameFonts} from './ui/GameFonts';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, IS_DESKTOP, RENDER_SCALE, initLayout, switchLayout } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { CityRecruitScene } from './scenes/CityRecruitScene';
import { CityScene } from './scenes/CityScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { MenuScene } from './scenes/MenuScene';

initLayout();

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
    scene: [BootScene, CityScene, CityRecruitScene, WorldMapScene, MenuScene, BattleScene, ThirdChapterScene, ThirdBattleScene],
  });

  if (import.meta.env.DEV) (window as unknown as { __game?: Phaser.Game }).__game = game;
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
