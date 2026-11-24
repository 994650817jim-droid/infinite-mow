import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT } from '../config';

export type SceneClass = new (...args: never[]) => Phaser.Scene;
/** 保留原场景键与 registry 传参；代码就绪后替换壳场景，业务场景原样运行。 */
export function lazyScene(key: string, load: () => Promise<SceneClass>): SceneClass {
  return class LazyScene extends Phaser.Scene {
    constructor() { super(key); }
    create(data: object): void {
      let cancelled = false;
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { cancelled = true; });
      this.events.once(Phaser.Scenes.Events.DESTROY, () => { cancelled = true; });
      this.cameras.main.setBackgroundColor('#17130f');
      const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 32, '整军备战…', {
        fontFamily: FONT, fontSize: '22px', color: '#e8d3a6', align: 'center',
      }).setOrigin(.5);
      const back = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 48, '返回主菜单', {
        fontFamily: FONT, fontSize: '16px', color: '#cbb88e', padding: { x: 24, y: 14 },
      }).setOrigin(.5).setInteractive({ useHandCursor: true });
      back.on('pointerup', () => this.scene.start('MenuScene'));
      void load().then(Scene => {
        if (cancelled) return;
        const game = this.game;
        game.events.once(Phaser.Core.Events.POST_RENDER, () => {
          if (cancelled || !this.sys.isActive()) return;
          // POST_RENDER 在 SceneManager 渲染遍历结束后，避免在遍历中移除自己。
          game.scene.remove(key);
          game.scene.add(key, Scene, true, data);
        });
      }).catch(error => {
        if (cancelled) return;
        console.error('[SceneLoad]', key, error);
        title.setText('战场载入失败\n请检查网络后重新进入');
      });
    }
  };
}
