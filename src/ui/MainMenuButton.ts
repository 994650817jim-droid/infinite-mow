import Phaser from 'phaser';
import { DEPTH, HEADING_FONT, IS_DESKTOP } from '../config';
import { eventCode, hotkeyCodes, hotkeyLabel, typingTarget } from '../data/hotkeys';
import { lqHitBox, lqSkin } from './LacquerKit';

/**
 * 天下地图 / 义军营寨的「主菜单」小按钮（用户 2026-11-18「返回主菜单按钮，三处都加」）：漆底描金小牌，直接回主页，不用确认。
 * 旁边标快捷键（默认 M，可在设置「快捷键」里改）。回主页时手机上的界面图 / 战斗图集由 LeanBoot 在场景关闭后卸载。
 */
export function addMainMenuButton(scene: Phaser.Scene, x: number, y: number, depth = DEPTH.hud + 20): Phaser.GameObjects.Text {
  const w = IS_DESKTOP ? 92 : 104, h = IS_DESKTOP ? 32 : 40;
  const t = scene.add.text(x, y, '主菜单', { fontFamily: HEADING_FONT, fontSize: IS_DESKTOP ? '15px' : '17px', color: '#ffe9bd', resolution: 2 })
    .setOrigin(.5).setScrollFactor(0).setDepth(depth + 1).setName('main-menu').setInteractive({ useHandCursor: true });
  const go = (): void => { if (scene.sys.isActive()) scene.scene.start('MenuScene'); };
  t.on('pointerdown', go);
  lqHitBox(t, w, h);
  const skin = lqSkin(scene, t, t, () => ({ w, h }), { tone: 'quiet' }); skin.gfx.setScrollFactor(0).setDepth(depth);
  // 快捷键提示：按钮右上角米色小字（电脑布局）
  if (IS_DESKTOP) scene.add.text(x + w / 2 - 8, y - h / 2 + 3, hotkeyLabel('menu') /* 往里收，不再压在描边上被截半个（2026-11-21 全界面体检） */, { fontFamily: HEADING_FONT, fontSize: '11px', color: '#efe0b4', resolution: 2 })
    .setOrigin(1, 0).setScrollFactor(0).setDepth(depth + 2).setStroke('#120904', 3).setName('main-menu-key');
  const onKey = (e: KeyboardEvent): void => { if (e.repeat || typingTarget(e)) return; if (hotkeyCodes('menu').includes(eventCode(e))) go(); };
  scene.input.keyboard?.on('keydown', onKey);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.keyboard?.off('keydown', onKey));
  return t;
}
