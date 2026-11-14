import {ThirdChapterScene} from './scenes/ThirdChapterScene';import {thirdGameSceneClass} from './scenes/ThirdGameScene';
import {loadGameFonts} from './ui/GameFonts';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, initLayout } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { CityRecruitScene } from './scenes/CityRecruitScene';
import { CityScene } from './scenes/CityScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { MenuScene } from './scenes/MenuScene';

initLayout();

async function startGame(): Promise<void> {
  await loadGameFonts();
  const BattleScene = import.meta.env.DEV ? (await import('./dev/DevGameScene')).DevGameScene : GameScene;
  const ThirdBattleScene=thirdGameSceneClass(BattleScene);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
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

}

void startGame();
