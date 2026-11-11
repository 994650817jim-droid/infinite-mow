import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, initLayout } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';

initLayout();

async function startGame(): Promise<void> {
  const BattleScene = import.meta.env.DEV ? (await import('./dev/DevGameScene')).DevGameScene : GameScene;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#14100c',
    pixelArt: true,
    roundPixels: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      activePointers: 3,
    },
    scene: [BootScene, MenuScene, BattleScene],
  });

  if (import.meta.env.DEV) (window as unknown as { __game?: Phaser.Game }).__game = game;

}

void startGame();
