import {BattlefieldSupplies,MAX_PROP_SLOTS} from '../systems/BattlefieldSupplies';
import {YellowBattle} from '../systems/YellowBattle';
import {yellowStageUnlocked} from '../world/WorldStore';
import {beginExpedition,settleExpedition,permanentEffects,worldUnlocked,takeExpeditionReserve} from '../world/WorldStore';
import Phaser from 'phaser';
import { ArtEffects } from '../systems/ArtEffects';
import { BattlefieldDetails } from '../systems/BattlefieldDetails';
import { WAR, warText, ensureWarTextures } from '../ui/WarStyle';
import { chapterUnlocked, isChapterTestRun, recordChapterVictory } from '../systems/ChapterProgress';
import { BALANCE, COLORS, DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, IS_DESKTOP, actorDepth } from '../config';
import type { EnemyDef } from '../data/enemies';
import { SCHOOL_NAMES, type RelicSchool } from '../data/relics';
import { WEAPON_META, buildUpgradeOptions } from '../data/upgrades';
import { waveIndexAt } from '../data/waves';
import { getChapter, getBattleChapter, chapterBossTime, type ChapterDef } from '../data/chapters';
import { BattleFeedback } from '../systems/BattleFeedback';
import { LubuBoss } from '../systems/LubuBoss';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Joystick } from '../ui/Joystick';
import { PassiveHud } from '../ui/PassiveHud';
import { EnemyMovement } from '../systems/EnemyMovement';
import { Legion } from '../systems/Legion';
import { LegionUI } from '../ui/LegionUI';
import { Reinforcements } from '../systems/Reinforcements';
import { packCampaign, restoreCampaign, type CampaignTransfer } from '../systems/Campaign';
import { TROOP_KINDS, INITIAL_TROOPS, LEGION, type TroopKind } from '../data/legion';
import { DEFAULT_RUN_CONFIG, getCharacter, type RunConfig } from '../data/characters';
import { Music } from '../systems/Music';
import { Sfx } from '../systems/Sfx';
import { SpatialGrid } from '../systems/SpatialGrid';
import { Ally, type AllyKind } from '../entities/Ally';
import { WEAPON_BEHAVIORS, WEAPON_DEFS, type WeaponHost, type WeaponBolt as Bolt, type SpearShot } from '../weapons/registry';
import type { RunEndReason, RunStats, UpgradeOption, WeaponState } from '../types';

interface Gem {
  img: Phaser.GameObjects.Image;
  value: number;
  vx: number;
  vy: number;
  active: boolean;
  /** 落地缓冲（毫秒）：先落地，再从磁吸范围吸附。 */
  restMs: number;
}

interface DmgFx {
  crit: boolean;
  text: Phaser.GameObjects.Text;
  life: number;
  vy: number;
  active: boolean;
}

interface CardView {
  bg: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  desc: Phaser.GameObjects.Text;
  tag: Phaser.GameObjects.Text;
}

type Mode = 'none' | 'levelup' | 'pause' | 'result' | 'recruit' | 'aid' | 'rest';

export class GameScene extends Phaser.Scene {
  protected player!: Player;
  protected joystick!: Joystick;
  private expeditionId="";
  private worldCampaign=false;
  protected runConfig: RunConfig = DEFAULT_RUN_CONFIG;
  protected chapter: ChapterDef = getChapter();
  protected lubu: LubuBoss | null = null;
  protected yellow:YellowBattle|null=null;
  protected supplies:BattlefieldSupplies|null=null;
  private yellowAltar:Phaser.GameObjects.Image|null=null;
  private finaleFadeMs=0;
  protected sfx!: Sfx;
  protected music = new Music();
  protected muteText: Phaser.GameObjects.Text | null = null;
  protected devText: Phaser.GameObjects.Text | null = null;
  protected devAcc = 0;
  protected debugChains: number[][] = [];
  protected perf?: {
    panel: Phaser.GameObjects.Container;
    bg: Phaser.GameObjects.Rectangle;
    text: Phaser.GameObjects.Text;
    copyBg: Phaser.GameObjects.Rectangle;
    copyText: Phaser.GameObjects.Text;
    toggle: Phaser.GameObjects.Text;
    collapsed: boolean;
    summary: Phaser.GameObjects.Text;
    frameMs: number[];
    samples: Array<{ fps: number; enemies: number }>;
    startAt: number;
    acc: number;
    playMs: number;
    pausedMs: number;
    backgroundMs: number;
    hiddenAt: number;
    maxEnemies: number;
    maxProjectiles: number;
  };
  protected debugJumped = false;
  protected feedback!: BattleFeedback;
  private readonly separationScratch: Enemy[] = [];
  private readonly enemyMovement = new EnemyMovement();
  protected crowdSteering = true;
  private readonly allyScratch: Enemy[] = [];
  private hudAcc = 1;
  private lastHudMode = '';
  private artEffects!: ArtEffects;
  private battlefieldDetails!: BattlefieldDetails;
  protected ground!: Phaser.GameObjects.TileSprite;
  protected hudGfx!: Phaser.GameObjects.Graphics;
  protected hudTexts!: Record<string, Phaser.GameObjects.Text>;
  protected passiveHud!: PassiveHud;
  protected blades: Phaser.GameObjects.Image[] = [];
  protected grid = new SpatialGrid<Enemy>(48);

  protected enemies: Enemy[] = [];
  protected bolts: Bolt[] = [];
  protected bullets: Bolt[] = [];
  protected gems: Gem[] = [];
  protected dmgFx: DmgFx[] = [];

  /** 游戏内毫秒时钟：暂停、升级和招募期间冻结。 */
  combatNow = 0;
  protected elapsed = 0;
  protected kills = 0;
  protected damageDealt = 0;
  protected playerDamageDealt = 0;
  protected allyDamageDealt = 0;
  protected spawnTimer = 0.5;
  protected eliteTimer: number = BALANCE.eliteFirst;
  protected boss: Enemy | null = null;
  protected bossSpawned = false;
  protected bossCastCd = 3;
  protected bossSummonCd = 6;
  protected bossEnergy = 0;
  protected bossOrbCd = 1.8;
  protected bossFanCd = 6;
  protected bossUltPhase: 'none' | 'charge' | 'warn' | 'strike' | 'recover' = 'none';
  protected bossUltAt = 0;
  protected bossUltPoints: Array<{ x: number; y: number }> = [];
  protected bossUltRound = 0;
  protected bossUltHits = 0;
  protected bossPhase2 = false;
  protected bossShield = 0;
  protected bossShieldGfx: Phaser.GameObjects.Graphics | null = null;
  protected bossSummons: Array<{ enemy: Enemy; spawnId: number }> = [];
  protected bossUltGfx!: Phaser.GameObjects.Graphics;
  protected bossKilled = false;
  protected orbitAngle = 0;

  protected mode: Mode = 'none';
  protected over = false;
  protected victory = false;
  protected pendingLevels = 0;
  protected upgradeOptions: UpgradeOption[] = [];

  protected levelPanel!: Phaser.GameObjects.Container;
  protected cardViews: CardView[] = [];
  protected relicIcons: Phaser.GameObjects.Image[] = [];
  protected allies: Ally[] = [];
  protected legion!: Legion;
  protected legionUI!: LegionUI;
  protected reinforcements!: Reinforcements;
  private freeRecruit = false;
  private resting = false;
  private readonly recruitedWaves = new Set<number>();
  private readonly legionBulletScratch: Ally[] = [];
  protected spearShots: SpearShot[] = [];
  protected weaponHost!: WeaponHost;
  protected recruitOptions: Array<{ kind: AllyKind; upgrade: boolean }> = [];
  protected recruitViews: Array<{ bg: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; desc: Phaser.GameObjects.Text; icon: Phaser.GameObjects.Image; tag: Phaser.GameObjects.Text }> = [];
  protected recruitPanel!: Phaser.GameObjects.Container;
  protected pendingRecruit = false;
  protected recruitCountText: Phaser.GameObjects.Text | null = null;
  protected relicExpanded = false;
  protected waveIndex = -1;
  protected waveBannerShown = false;
  protected bossWarned = false;
  protected chargeGfx!: Phaser.GameObjects.Graphics;
  protected resultPanel!: Phaser.GameObjects.Container;
  protected resultTexts!: Record<string, Phaser.GameObjects.Text>;
  protected pausePanel!: Phaser.GameObjects.Container;

  protected cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  protected wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  protected hintText: Phaser.GameObjects.Text | null = null;
  protected debugModified = false;
  protected devTimeScale = 1;
  protected debugMove = new Phaser.Math.Vector2();
  protected debugMoveActive = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.resetState();
    ensureWarTextures(this);
    this.hudAcc = 1; this.lastHudMode = '';
    this.feedback = new BattleFeedback(this);
    this.sfx = new Sfx();
    const registryConfig = this.registry.get('runConfig') as RunConfig | undefined;
    const requested = getBattleChapter(registryConfig?.chapter, registryConfig?.stage);
    this.chapter = (chapterUnlocked(requested.id) && (!requested.stage || yellowStageUnlocked(requested.stage))) || isChapterTestRun() ? requested : getBattleChapter('huangjin',1);
    this.runConfig = { ...DEFAULT_RUN_CONFIG, ...registryConfig, chapter: this.chapter.id, stage:this.chapter.stage };
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.chargeGfx = this.add.graphics().setDepth(DEPTH.fx);
    this.bossUltGfx = this.add.graphics().setDepth(DEPTH.fx + 1);
    this.bossShieldGfx = this.add.graphics().setDepth(DEPTH.fx + 2);
    this.cameras.main.setRoundPixels(true);

    const terrainKey = this.chapter.stage ? this.chapter.ground : 'ground_overhaul_hulao';
    const groundKey = this.textures.exists(terrainKey) ? terrainKey : this.textures.exists('ground_ai') ? 'ground_ai' : 'ground';
    this.ground = this.add
      .tileSprite(0, 0, GAME_WIDTH + 512, GAME_HEIGHT + 512, groundKey)
      .setOrigin(0, 0)
      .setScrollFactor(1)
      .setDepth(DEPTH.ground);
    if (groundKey !== 'ground') this.ground.setTileScale(groundKey.startsWith('ground_overhaul')||groundKey.startsWith('yellow_ground') ? 1 : .5);
    this.battlefieldDetails = new BattlefieldDetails(this, this.chapter.id, this.chapter.stage);
    this.artEffects = new ArtEffects(this);


    this.player = new Player(this, 0, 0);
    this.applyRunConfig(this.runConfig);
    this.worldCampaign=this.registry.get('worldCampaign')===true;
    this.expeditionId=this.worldCampaign?beginExpedition(this.chapter.id,this.chapter.stage):'';
    this.weaponHost = this.createWeaponHost();
    // 新存档开局无兵，第一波后招募；已开放主城的出征另应用军营与后备。
    this.allies = [];
    this.legion = new Legion(this, this.allies, this.player, worldUnlocked() ? permanentEffects().armyCapacity : 5);
    this.yellow=this.chapter.stage?new YellowBattle({scene:this,player:this.player,army:this.legion,enemies:this.enemies,move:(e,nx,ny,dt)=>this.advanceEnemy(e,nx,ny,dt),spawn:(def,x,y)=>this.spawnEnemy(def.kind,x,y,1,true,def)},this.chapter.stage):null;
    this.supplies=new BattlefieldSupplies(this,this.player,this.enemies,()=>this.combatNow,()=>{this.sfx.play('pickup');this.artEffects.show(5,this.player.x,this.player.y-12,35,this.combatNow,280);});
    const transfer = this.registry.get('campaignTransfer') as CampaignTransfer | undefined;
    this.registry.remove('campaignTransfer');
    if (transfer && this.chapter.id === transfer.chapter && this.runConfig.character === transfer.character) restoreCampaign(transfer, this.player, this.legion);
    if(this.worldCampaign&&worldUnlocked()){const effects=permanentEffects();this.legion.healingMultiplier=effects.healMultiplier;if(!transfer){for(let i=0;i<effects.reinforcements;i++)this.legion.recruit(i===0?'swordsman':'spearman',1,true);}if(!transfer&&!isChapterTestRun())for(const kind of takeExpeditionReserve(this.legion.capacity-this.legion.count)){this.legion.recruit(kind,1,true);this.allies[this.allies.length-1].reserveSoldier=true;}}
    const cam = this.cameras.main;
    cam.setRoundPixels(false);
    cam.setScroll(this.player.x - GAME_WIDTH / 2, this.player.y - GAME_HEIGHT / 2);

    for (let i = 0; i < 2; i += 1) {
      this.blades.push(this.add.image(0, 0, 'blade').setDepth(DEPTH.blade).setScale(1.2).setVisible(false));
    }

    this.add
      .image(0, 0, 'vignette')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(900);

    this.buildHud();
    this.buildOverlays();
    this.legionUI = new LegionUI(this, () => { if (this.mode === 'none' && !this.over) this.legion.cycleOrder(); }, (kind, train) => this.buyTroops(kind, train), () => {
      if (this.mode === 'rest') this.continueCampaign();
      else if (this.mode === 'recruit') { this.recruitedWaves.add(this.waveIndex); this.freeRecruit = false; this.resumePendingChoices(); }
    });
    this.reinforcements = new Reinforcements(this, this.runConfig.character, this.player, id => {
      if (this.mode !== 'aid' || !this.reinforcements.start(id, this.combatNow, this.enemies)) return;
      this.resumePendingChoices();
    });
    this.joystick = new Joystick(this);
    if (IS_DESKTOP) this.joystick.setHidden(true);
    this.bindInput();
    if (import.meta.env.DEV) this.installDevelopment();

    this.hintText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 32, IS_DESKTOP ? 'WASD / 方向键移动 · 自动攻击' : '自动攻击 · 拖动摇杆移动', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#8a8078',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);
  }

  /** 把开局选择（武将/初始武器）应用到本局。 */
  protected applyRunConfig(config: RunConfig): void {
    const character = getCharacter(config.character);
    this.player.passive.reset(character.id, this.combatNow);
    this.player.stats.maxHpBonus += Math.round(BALANCE.player.maxHp * (character.hpMul - 1));
    this.player.stats.moveMul *= character.speedMul;
    this.player.stats.damageMul *= character.damageMul;
    this.player.hp = this.player.maxHp;
    const sheetKey = `${config.character}_walk_sheet`;
    const hasOwnSheet = this.textures.exists(sheetKey);
    this.player.setWalkSheet(hasOwnSheet ? sheetKey : 'hero_walk_sheet');
    if (!hasOwnSheet && character.battleTint) this.player.sprite.setTint(character.battleTint);
    this.player.weapons = [{ id: character.startWeapon, level: 1, cooldownLeft: 0 }];
  }

  protected resetState(): void {
    this.crowdSteering = true; this.freeRecruit = false; this.resting = false; this.recruitedWaves.clear();
    this.separationScratch.length = 0;
    this.allyScratch.length = 0;
    this.allies = [];
    for (const shot of this.spearShots) shot.img.destroy();
    this.spearShots = [];
    this.waveIndex = -1;
    this.waveBannerShown = false;
    this.bossWarned = false;
    this.recruitOptions = [];
    this.enemies = [];
    this.bolts = [];
    this.bullets = [];
    this.gems = [];
    this.dmgFx = [];
    this.blades = [];
    this.elapsed = 0;
    this.combatNow = 0;
    this.time.paused = false;
    this.time.timeScale = 1;
    this.tweens.resumeAll();
    this.tweens.timeScale = 1;
    this.pendingRecruit = false;
    this.debugMoveActive = false;
    this.debugMove.set(0, 0);
    this.debugChains = [];
    this.debugJumped = false;
    this.debugModified = false;
    this.devTimeScale = 1;
    this.devAcc = 0;
    this.perf = undefined;
    this.grid.clear();
    this.kills = 0;
    this.damageDealt = 0;
    this.playerDamageDealt = 0;
    this.allyDamageDealt = 0;
    this.spawnTimer = 0.5;
    this.eliteTimer = BALANCE.eliteFirst;
    this.boss = null;
    this.lubu = null; this.yellow=null; this.supplies=null; this.yellowAltar=null;this.finaleFadeMs=0;
    this.bossSpawned = false;
    this.bossCastCd = 3;
    this.bossSummonCd = 6;
    this.bossEnergy = 0;
    this.bossOrbCd = 1.8;
    this.bossFanCd = 6;
    this.bossUltPhase = 'none';
    this.bossUltAt = 0;
    this.bossUltPoints = [];
    this.bossUltRound = 0;
    this.bossUltHits = 0;
    this.bossPhase2 = false;
    this.bossShield = 0;
    this.bossShieldGfx?.clear();
    this.bossSummons = [];
    this.bossUltGfx?.clear();
    this.bossKilled = false;
    this.orbitAngle = 0;
    this.mode = 'none';
    this.over = false;
    this.victory = false;
    this.pendingLevels = 0;
    this.upgradeOptions = [];
    this.cardViews = [];
    this.relicExpanded = false;
    this.gems = [];
    this.dmgFx = [];
  }

  // ---------------- input ----------------

  protected bindInput(): void {
    // activePointers 已在 main.ts 配置；场景重开不再分配全局指针。
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.sfx.unlock();
      this.joystick.handleDown(pointer);
    });
    // BGM 在首次真实手势后启动；离开场景时停止并清理监听
    const startMusic = (): void => this.music.start();
    window.addEventListener('pointerdown', startMusic, { once: true });
    window.addEventListener('keydown', startMusic, { once: true });
    this.events.once('shutdown', () => {
      window.removeEventListener('pointerdown', startMusic);
      window.removeEventListener('keydown', startMusic);
      this.music.dispose();
      this.sfx.dispose();
      this.disposeDevelopment();
      this.legion.stop(); this.reinforcements.clear();this.yellow?.clear();this.supplies?.clear();
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.joystick.handleMove(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.joystick.handleUp(pointer));
    this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.joystick.handleUp(pointer));

    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    // A scene restart reuses its KeyboardPlugin; dispose only the bindings owned here.
    for (const key of ['P', 'ESC', 'ONE', 'TWO', 'THREE', 'R', 'Q', 'E']) keyboard.removeAllListeners(`keydown-${key}`);
    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    keyboard.on('keydown-P', () => this.togglePause());
    keyboard.on('keydown-ESC', () => this.togglePause());
    keyboard.on('keydown-ONE', () => this.chooseUpgrade(0));
    keyboard.on('keydown-TWO', () => this.chooseUpgrade(1));
    keyboard.on('keydown-THREE', () => this.chooseUpgrade(2));
    keyboard.on('keydown-R', () => {
      if (this.mode === 'result') this.scene.restart();
    });
    let lastE = -1;

    keyboard.on('keydown-E', (event: KeyboardEvent) => { if (event.repeat || event.timeStamp === lastE) return; lastE = event.timeStamp; if (this.mode === 'none' && !this.over) this.legion.cycleOrder(); });
  }

  // ---------------- update ----------------

  update(time: number, delta: number): void {
    let dt = Math.min(delta / 1000, 0.05);
    if (this.devTimeScale !== 1) dt *= this.devTimeScale;
    this.time.timeScale = this.devTimeScale;
    this.tweens.timeScale = this.devTimeScale;
    this.updateCamera(dt);
    this.music.setIntensity(this.boss && this.boss.active ? 1 : 0);
    if (!this.boss || !this.boss.active) this.music.setDuck(1);
    const nextWave = waveIndexAt(this.elapsed, this.chapter.waves);
    if (!this.over && nextWave !== this.waveIndex) {
      this.waveIndex = nextWave;
      this.hudTexts.wave.setText(`第 ${nextWave + 1}/${this.chapter.waves.length} 波 · ${this.chapter.waves[nextWave].name}`);
      if (this.waveBannerShown || nextWave > 0) this.showWaveBanner(`第 ${nextWave + 1}/${this.chapter.waves.length} 波 · ${this.chapter.waves[nextWave].name}`);
      this.waveBannerShown = true;
      // Finish a wave before recruiting; the opening wave starts immediately.
      if (nextWave > 0) this.scheduleRecruit();
    }
    if (!this.over && this.elapsed >= chapterBossTime(this.chapter) - 10 && !this.bossWarned) {
      this.bossWarned = true;
      this.showWaveBanner(`${this.chapter.bossName}即将登场！`, true);
    }
    if (this.perf) {
      if (this.mode === 'none' && !document.hidden) {
        this.perf.frameMs.push(delta);
        if (this.perf.frameMs.length > 600) this.perf.frameMs.shift();
        this.perf.playMs += delta;
      } else if (this.mode === 'levelup' || this.mode === 'pause') {
        this.perf.pausedMs += delta;
      }
    }
    this.syncGround();
    this.battlefieldDetails.update(this.cameras.main.scrollX, this.cameras.main.scrollY);
    this.hudAcc += dt;
    this.updateHud();
    this.artEffects.update(this.combatNow);
    this.feedback.update(this.combatNow, this.mode === 'result' ? delta : 0);
    this.updatePerf(dt);
    this.devAcc += dt;
    if (this.devText && this.devAcc > 0.3) {
      this.devAcc = 0;
      const projectiles = this.bolts.filter((b) => b.active).length + this.bullets.filter((b) => b.active).length;
      const gems = this.gems.filter((g) => g.active).length;
      this.devText.setText(
        `FPS ${Math.round(this.game.loop.actualFps)} | 敌 ${this.activeEnemyCount()} | 弹 ${projectiles} | 宝石 ${gems} | 内存 ${
          (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
            ? Math.round(((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1048576) * 10) / 10
            : '-'
        }MB`,
      );
    }

    if(this.finaleFadeMs>0){this.finaleFadeMs=Math.max(0,this.finaleFadeMs-delta);const a=this.finaleFadeMs/800;this.bossUltGfx.setAlpha(a);this.bossShieldGfx?.setAlpha(a);if(!this.finaleFadeMs){this.bossUltGfx.clear().setAlpha(1);this.bossShieldGfx?.clear().setAlpha(1);}}
    if (this.mode !== 'none' || this.over) return;

    this.elapsed += dt;
    this.combatNow += dt * 1000;
    time = this.combatNow;
    const move = this.readMove();
    this.player.move(dt, move.x, move.y);
    this.player.update(time, dt);

    this.supplies?.update(dt,time,this.battlefieldDetails.props);
    this.updateEnemies(dt, time);
    this.yellow?.update(dt,time);
    this.rebuildGrid();
    this.legion.update(dt, time, this.enemies, this.grid, (enemy, amount) => this.hitEnemy(enemy, amount, this.combatNow, 'melee', true));
    if (this.over) return;
    this.rebuildGrid();
    this.separateEnemies();
    this.separateAlliesFromEnemies();
    this.supplies?.resolveBodies(this.allies);
    this.updateEnemyWalkAnimations(dt);
    this.rebuildGrid();
    this.applyContactDamage();
    if (this.over) return;
    this.updateWeapons(dt, time);
    this.reinforcements.update(time, this.enemies, (enemy, amount, fire) => this.hitEnemy(enemy, amount, time, fire ? 'fire' : 'melee', true, false));
    if (this.over) return;
    this.updateSpawner(dt, time);
    this.updateBolts(dt, time);
    this.updateBullets(dt);
    this.updateGems(dt);
    if (this.mode === 'none' && !this.over) this.player.passive.update(time, (enemy, amount) => this.hitEnemy(enemy, amount, time, 'fire', false, false));
    this.updateDmgFx(dt);
    this.checkEnd();
    if (!this.over && this.mode === 'none' && this.elapsed >= this.reinforcements.nextAt) this.setMode('aid');
  }

  /** World-aligned overscan patch: ground and props share camera translation, rounding and shake.
   * tilePosition is in source-texture pixels, so divide world offsets by tileScale.
   */
  protected syncGround(): void {
    const camera = this.cameras.main;
    const x = Math.floor(camera.scrollX / 256) * 256;
    const y = Math.floor(camera.scrollY / 256) * 256;
    this.ground.setPosition(x, y);
    this.ground.setTilePosition(x / this.ground.tileScaleX, y / this.ground.tileScaleY);
  }

  protected updateCamera(dt: number): void {
    const cam = this.cameras.main;
    const targetX = this.player.x - GAME_WIDTH / 2;
    const targetY = this.player.y - GAME_HEIGHT / 2;
    const k = 1 - Math.exp(-11 * dt);
    cam.scrollX += (targetX - cam.scrollX) * k;
    cam.scrollY += (targetY - cam.scrollY) * k;
    // 相机与地面共用同一个（小数）scroll：不做取整，避免 1px 级跳动
  }

  protected readMove(): Phaser.Math.Vector2 {
    if (this.debugMoveActive) return this.debugMove.clone().normalize();
    if (this.joystick.active && this.joystick.vector.lengthSq() > 0.001) {
      return this.joystick.vector.clone();
    }
    const out = new Phaser.Math.Vector2(0, 0);
    if (this.cursors) {
      if (this.cursors.left.isDown) out.x -= 1;
      if (this.cursors.right.isDown) out.x += 1;
      if (this.cursors.up.isDown) out.y -= 1;
      if (this.cursors.down.isDown) out.y += 1;
    }
    if (this.wasd) {
      if (this.wasd.A?.isDown) out.x -= 1;
      if (this.wasd.D?.isDown) out.x += 1;
      if (this.wasd.W?.isDown) out.y -= 1;
      if (this.wasd.S?.isDown) out.y += 1;
    }
    return out.lengthSq() > 0 ? out.normalize() : out;
  }

  // ---------------- 敌人 ----------------

  protected rebuildGrid(): void {
    this.grid.clear();
    for (const enemy of this.enemies) {
      if (enemy.active) this.grid.insert(enemy);
    }
  }

  protected activeEnemyCount(): number {
    let count = 0;
    for (const enemy of this.enemies) if (enemy.active&&!enemy.isSupplySlot) count += 1;
    return count;
  }

  protected spawnEnemy(
    kind: EnemyDef['kind'],
    x: number,
    y: number,
    hpScale = this.chapter.hpScale(this.elapsed),
    force = false,
    override?:EnemyDef,
  ): Enemy | null {
    const poolLimit = BALANCE.enemyCap;
    const bossReserve = this.bossSpawned ? 0 : 1;
    const activeLimit = kind === 'boss' ? BALANCE.enemyCap : BALANCE.enemyCap - bossReserve;
    if (this.activeEnemyCount() >= activeLimit) return null;
    let enemy = this.enemies.find((e) => !e.active&&!e.isSupplySlot);
    if (!enemy) {
      if (this.enemies.length >= poolLimit+MAX_PROP_SLOTS) return null;
      enemy = new Enemy(this);
      this.enemies.push(enemy);
    }
    const base=override??this.chapter.enemies[kind];
    enemy.spawn(x,y,!override&&this.yellow&&kind!=='boss'?this.yellow.variant(base,this.elapsed):base,hpScale,this.combatNow);
    return enemy;
  }

  protected spawnAroundPlayer(kind: EnemyDef['kind'], force = false): Enemy | null {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.max(GAME_WIDTH, GAME_HEIGHT) * 0.5 + Math.random() * 100;
    const x = this.player.x + Math.cos(angle) * distance;
    const y = this.player.y + Math.sin(angle) * distance;
    return this.spawnEnemy(kind, x, y, undefined, force);
  }

  protected updateSpawner(dt: number, time: number): void {
    this.spawnTimer -= dt;
    const cap = BALANCE.enemyCap;
    if (this.spawnTimer <= 0 && this.activeEnemyCount() < cap) {
      this.spawnTimer = this.chapter.spawnInterval(this.elapsed);
      const burst = this.chapter.spawnBurst(this.elapsed);
      for (let i = 0; i < burst; i += 1) {
        if (this.activeEnemyCount() >= cap) break;
        if (!this.spawnAroundPlayer(this.chapter.pickEnemy(this.elapsed))) break;
      }
    }

    if ((!this.chapter.stage||this.chapter.stage===3) && this.elapsed >= BALANCE.eliteFirst) {
      this.eliteTimer -= dt;
      if (this.eliteTimer <= 0) {
        this.eliteTimer = BALANCE.eliteInterval;
        this.spawnAroundPlayer('elite', true);
      }
    }

    if (!this.bossSpawned && this.elapsed >= chapterBossTime(this.chapter) && this.mode === 'none') {
      this.spawnBoss();
    }
    void time;
  }

  protected spawnBoss(): void {
    if(this.boss?.active)return;this.yellowAltar?.destroy();this.yellowAltar=null;
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    const angle = -Math.PI / 2;
    const x = this.player.x + Math.cos(angle) * 430;
    const y = this.player.y + Math.sin(angle) * 430;
    const boss = this.spawnEnemy('boss', x, y, 1, true);
    if (!boss) {
      this.bossSpawned = false;
      return;
    }
    this.boss = boss;
    if(this.chapter.stage&&this.chapter.stage>=2){this.yellowAltar=this.add.image(x,y+10,this.chapter.stage===2?'zhang_bao_altar':'zhang_jiao_altar').setDepth(DEPTH.ground+2).setDisplaySize(245,200).setAlpha(.75);}

    if (this.chapter.bossStyle === 'lubu') {
      this.lubu = new LubuBoss({ scene: this, boss, player: this.player,
        hurtTroops: (x, y, radius, damage, now, angle, arc) => this.legion.hurtArea(x, y, radius, damage, now, angle, arc),
        playSfx: (kind) => this.sfx.play(kind),
        onPhase2: () => { this.bossPhase2 = true; this.showWaveBanner('吕布震怒！注意预警后反击', true); },
      });
    }
    this.sfx.boss();
    this.cameras.main.flash(320, 120, 40, 30, false);
  }

  protected updateEnemies(dt: number, time: number): void {
    const player = this.player;
    this.rebuildGrid();
    this.enemyMovement.prepare(this.enemies, this.grid, this.legion.grid, player.x, player.y, dt, this.combatNow);
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.updateVisual(time);
      if(enemy.isSupplySlot)continue;
      enemy.frameStartX = enemy.x;
      enemy.frameStartY = enemy.y;
      if (!enemy.controlImmune && enemy.stunUntil > time) { enemy.moveVx = enemy.moveVy = enemy.intentDx = enemy.intentDy = 0; continue; }
      enemy.contactCd = Math.max(0, enemy.contactCd - dt);
      enemy.shootCd -= dt;
      enemy.dashCd -= dt;
      enemy.orbitCd = Math.max(0, enemy.orbitCd - dt);

      const target = enemy.targetAlly?.active && enemy.targetAlly.lifeId === enemy.targetLife && enemy.kind !== 'boss' && enemy.kind !== 'cavalry' ? enemy.targetAlly : player;
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      if (this.yellow?.handleEnemy(enemy,dt,this.combatNow,target)) {
        // Stage-specific spear, earth caster, shield and temporary elite behaviors.
      } else if (enemy.kind === 'archer') {
        if (dist > 230) {
          this.advanceEnemy(enemy, nx, ny, dt);
        } else if (dist < 150) {
          this.advanceEnemy(enemy, -nx * .8, -ny * .8, dt);
        } else if (this.crowdSteering) {
          this.advanceEnemy(enemy, 0, 0, dt);
        }
        if (enemy.shootCd <= 0 && dist < 460 && enemy.attackUntil <= this.combatNow) {
          enemy.shootCd = 2.4;
          const ax = Math.abs(nx);
          const ay = Math.abs(ny);
          const dir = ax > ay ? (nx < 0 ? 'left' : 'right') : ny < 0 ? 'up' : 'down';
          enemy.startAttack(this.combatNow, dir);
          this.feedback.attack(enemy, Math.atan2(ny, nx), this.combatNow, 360);
          const spawnId = enemy.spawnId;
          this.time.delayedCall(180, () => {
            // 只在放箭帧生成箭矢
            if (!enemy.active || enemy.spawnId !== spawnId || this.over) return;
            const p = enemy.targetAlly?.active && enemy.targetAlly.lifeId === enemy.targetLife ? enemy.targetAlly : this.player;
            this.sfx.play('enemyArrow');
            this.fireBolt(this.bullets, enemy.x, enemy.y, p.x, p.y, enemy.def.damage, 0, false, 210,this.chapter.stage?'yellow_arrow':undefined);
          });
        }
      } else if (enemy.kind === 'cavalry') {
        const now = this.combatNow;
        if (enemy.chargeState === 'warn') {
          // 预警：原地锁定 + 红色调（不画地面线条）
        } else if (enemy.chargeState === 'charge') {
          enemy.sprite.x += enemy.chargeVx * dt;
          enemy.sprite.y += enemy.chargeVy * dt;
          const hitDist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
          if (!enemy.chargeHit && hitDist < player.radius + enemy.radius + 8) {
            enemy.chargeHit = true;
          this.feedback.attack(enemy, Math.atan2(enemy.chargeVy, enemy.chargeVx), now);
            if (player.takeDamage(18, now)) this.cameras.main.flash(120, 180, 40, 40, false);
            // 中等击退
            this.player.sprite.x += nx * 36;
            this.player.sprite.y += ny * 36;
            enemy.chargeState = 'recover';
            enemy.chargeAt = now + 350;
          }
        } else if (enemy.chargeState === 'recover') {
          enemy.sprite.x += nx * enemy.def.speed * 0.35 * dt;
          enemy.sprite.y += ny * enemy.def.speed * 0.35 * dt;
          if (now >= enemy.chargeAt) {
            enemy.chargeState = 'none';
            enemy.dashCd = 6;
          }
        } else {
          this.advanceEnemy(enemy, nx, ny, dt);
          if (enemy.dashCd <= 0 && dist >= 60 && dist <= 120) {
            enemy.dashCd = 6;
            const ax = Math.abs(nx);
            const ay = Math.abs(ny);
            const dir = ax > ay ? (nx < 0 ? 'left' : 'right') : ny < 0 ? 'up' : 'down';
            enemy.startCharge(now, dir);
            this.feedback.attack(enemy, Math.atan2(ny, nx), now, 450);
            this.sfx.play('chargeWarn');
            // B 方案：x3 速度、0.6s 冲锋；预警错峰 0-200ms，避免整群同步
            enemy.chargeVx = nx * enemy.def.speed * 3;
            enemy.chargeVy = ny * enemy.def.speed * 3;
            enemy.chargeAt = now + 450 + Math.random() * 200;
          }
        }
      } else if (enemy.kind === 'boss') {
        if (this.yellow && this.chapter.stage!==3) this.yellow.moveBoss(enemy,dt,this.combatNow);
        else if (this.lubu) this.lubu.update(dt, this.combatNow);
        else {
          enemy.sprite.x += nx * enemy.def.speed * dt;
          enemy.sprite.y += ny * enemy.def.speed * dt;
          this.updateBossAbilities(dt);
        }
      } else {
        this.advanceEnemy(enemy, nx, ny, dt);
      }

      enemy.updateChargeVisual(this.combatNow);
      enemy.updateAttackVisual(this.combatNow);
      enemy.intentDx = enemy.x - enemy.frameStartX;
      enemy.intentDy = enemy.y - enemy.frameStartY;
    }
  }

  private advanceEnemy(enemy: Enemy, nx: number, ny: number, dt: number): void {
    enemy.sprite.x += (this.crowdSteering ? enemy.moveVx : nx * enemy.def.speed) * dt;
    enemy.sprite.y += (this.crowdSteering ? enemy.moveVy : ny * enemy.def.speed) * dt;
  }

  /** 分离与网格都稳定后，再统一结算接触伤害。 */
  /** 特殊位移保留硬分离，普通敌军由柔性分离处理。 */
  protected separateAlliesFromEnemies(): void {
    for (const ally of this.allies) {
      if (!ally.active) continue;
      const near = this.grid.query(ally.x, ally.y, ally.radius + 26, this.allyScratch);
      for (const enemy of near) {
        if (!enemy.active || enemy.isSupplySlot || enemy.controlImmune) continue;
        if (this.crowdSteering && enemy.kind !== 'boss' && !(enemy.kind === 'cavalry' && enemy.chargeState !== 'none')) continue;
        const dx = enemy.x - ally.x;
        const dy = enemy.y - ally.y;
        const dist = Math.hypot(dx, dy);
        const min = ally.radius + enemy.radius;
        if (dist > 0.001 && dist < min - 1.5) {
          const overlap = min - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          const enemyPush = Math.min(6, overlap * 0.7);
          const allyPush = Math.min(6, overlap * 0.3);
          enemy.sprite.x += nx * enemyPush;
          enemy.sprite.y += ny * enemyPush;
          ally.push(-nx * allyPush, -ny * allyPush);
        }
      }
    }
  }

  /** 步态必须基于碰撞/分离后的真实位移：被挤住时回待机帧。 */
  protected updateEnemyWalkAnimations(dt: number): void {
    const view = this.cameras.main.worldView;
    const margin = 80;
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.shadow.setPosition(enemy.x,enemy.isSupplySlot?enemy.y:enemy.y + enemy.radius * .72);
      if (enemy.kind !== 'boss') enemy.sprite.setDepth(actorDepth(enemy.isSupplySlot?enemy.y:enemy.y + enemy.radius * .72));
      if (!enemy.walkSheet) continue;
      const onScreen =
        enemy.x > view.x - margin &&
        enemy.x < view.right + margin &&
        enemy.y > view.y - margin &&
        enemy.y < view.bottom + margin;
      if (onScreen) enemy.updateWalk(dt, enemy.x - enemy.frameStartX, enemy.y - enemy.frameStartY);
    }
  }

  protected applyContactDamage(): void {
    const player = this.player;
    for (const enemy of this.enemies) {
      if (!enemy.active || (enemy.def.behavior==='wall'||enemy.isSupplySlot) || enemy.contactCd > 0) continue;
      if (enemy === this.boss && this.lubu && this.lubu.state !== 'approach') continue;
      const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      if (dist < player.radius + enemy.radius + 2) {
        enemy.contactCd = 1.0;
        this.feedback.attack(enemy, Math.atan2(player.y - enemy.y, player.x - enemy.x), this.combatNow);
        if (player.takeDamage(enemy.def.damage, this.combatNow)) {
          this.cameras.main.flash(90, 180, 40, 40, false);
        }
      }
    }
    if (!this.player.alive) this.finish(false, 'death');
  }

  protected separateEnemies(): void {
    if (this.crowdSteering) return;
    for (const enemy of this.enemies) {
      if (enemy.active) this.separate(enemy);
    }
  }

  protected separate(enemy: Enemy): void {
    if (enemy.controlImmune||enemy.isSupplySlot) return;
    const neighbors = this.grid.query(enemy.x, enemy.y, enemy.radius + 26, this.separationScratch);
    for (const other of neighbors) {
      if (other === enemy || !other.active || other.isSupplySlot || other.controlImmune) continue;
      const dx = enemy.x - other.x;
      const dy = enemy.y - other.y;
      const dist = Math.hypot(dx, dy);
      const min = enemy.radius + other.radius;
      // 允许 1.5px 轻微重叠，降低分离强度，避免怪物越靠近玩家越被推回去
      if (dist > 0.001 && dist < min - 1.5) {
        const push = ((min - dist) / dist) * 0.35;
        enemy.sprite.x += dx * push;
        enemy.sprite.y += dy * push;
      }
    }
  }

  /** 张角施法前的轻量提示：弹幕=金色圆环，召唤=红橙四方火花。 */
  protected bossCastFx(kind: 'volley' | 'summon'): void {
    if (!this.boss || !this.boss.active) return;
    this.sfx.play(kind === 'volley' ? 'bossVolley' : 'bossSummon');
    const b = this.boss;
    if (kind === 'volley') {
      const ring = this.add.circle(b.x, b.y + 18, 14).setStrokeStyle(3, 0xffd166, 0.95).setDepth(DEPTH.fx);
      this.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
      const glow = this.add.circle(b.x, b.y - 26, 9, 0xffe9a8, 0.95).setDepth(DEPTH.fx);
      this.tweens.add({ targets: glow, scale: 2.2, alpha: 0, duration: 300, onComplete: () => glow.destroy() });
      return;
    }
    // 召唤预警：四个红橙火花从脚下向外扩散，形状与弹幕明显不同
    for (let i = 0; i < 4; i += 1) {
      const a = (Math.PI * 2 * i) / 4 + Math.PI / 4;
      const spark = this.add
        .circle(b.x + Math.cos(a) * 14, b.y + 18 + Math.sin(a) * 14, 4, 0xff5222, 0.95)
        .setDepth(DEPTH.fx);
      this.tweens.add({
        targets: spark,
        x: b.x + Math.cos(a) * 42,
        y: b.y + 18 + Math.sin(a) * 42,
        scale: 1.4,
        alpha: 0,
        duration: 350,
        onComplete: () => spark.destroy(),
      });
    }
  }

  protected updateBossAbilities(dt: number): void {
    if (!this.boss) { this.bossShieldGfx?.clear(); return; }
    const now = this.combatNow;
    this.drawBossShield();
    this.ensureBossPhase2();
    if (this.bossUltPhase !== 'none') {
      this.updateBossUltimate(now);
      return;
    }
    this.bossEnergy = Math.min(100, this.bossEnergy + dt * (this.bossPhase2 ? 6 : 5));
    this.bossOrbCd -= dt;
    this.bossFanCd -= dt;
    this.bossSummonCd -= dt;
    if (this.bossOrbCd <= 0) {
      this.bossOrbCd = this.bossPhase2 ? 1.15 : 1.5;
      this.fireBolt(this.bullets, this.boss.x, this.boss.y, this.player.x, this.player.y, 9, 0, false, 250, 'orb');
    }
    if (this.bossFanCd <= 0) {
      this.bossFanCd = this.bossPhase2 ? 4 : 5;
      const base = Math.atan2(this.player.y - this.boss.y, this.player.x - this.boss.x);
      for (let i = -1; i <= 1; i += 1) {
        const a = base + i * 0.22;
        this.fireBolt(this.bullets, this.boss.x, this.boss.y, this.boss.x + Math.cos(a) * 10, this.boss.y + Math.sin(a) * 10, 7, 0, false, 220, 'orb');
      }
    }
    if (this.bossSummonCd <= 0) {
      this.bossSummonCd = this.bossPhase2 ? 8 : 10;
      this.bossSummons = this.bossSummons.filter(({ enemy, spawnId }) => enemy.active && enemy.spawnId === spawnId);
      if (this.bossSummons.length < 8) {
        this.bossCastFx('summon');
        const count = Math.min(this.bossPhase2 ? 4 : 3, 8 - this.bossSummons.length);
        for (let i = 0; i < count; i += 1) {
          const a = (Math.PI * 2 * i) / count;
          const spawned = this.spawnEnemy('infantry', this.boss.x + Math.cos(a) * 66, this.boss.y + Math.sin(a) * 66);
          if (spawned) this.bossSummons.push({ enemy: spawned, spawnId: spawned.spawnId });
        }
      }
    }
    if (this.bossEnergy >= 100) this.startBossUltimate(now);
  }

  protected ensureBossPhase2(): void {
    if (this.chapter.bossStyle !== 'zhangjiao') return;
    if (!this.boss?.active) return;
    if (!this.bossPhase2 && this.boss.hp / this.boss.maxHp <= 0.5) {
      this.bossPhase2 = true;
      this.bossShield = 300; // 50% 血量触发一次 300 护盾
      this.boss.sprite.setTint(0xff8866);
      this.cameras.main.flash(200, 90, 200, 255, false);
      this.sfx.play('bossSummon');
    }
  }

  /** 50% 血量 300 护盾：Boss 周围青蓝护盾环，跟随移动并脉动。 */
  protected drawBossShield(): void {
    const gfx = this.bossShieldGfx;
    if (!gfx) return;
    gfx.clear();
    if (!this.boss || this.bossShield <= 0) return;
    const pulse = Math.sin(this.combatNow * 0.006) * 2;
    const r = this.boss.radius + 10 + pulse;
    gfx.lineStyle(3, 0x66d9ff, 0.85);
    gfx.strokeCircle(this.boss.x, this.boss.y, r);
    gfx.lineStyle(1.5, 0xbbeeff, 0.5);
    gfx.strokeCircle(this.boss.x, this.boss.y, r + 4);
  }

  protected startBossUltimate(now: number): void {
    if (!this.boss) return;
    this.bossUltPhase = 'charge';
    this.bossUltAt = now + 800;
    this.bossUltRound = 0;
    this.bossUltHits = 0;
    this.music.setDuck(0.85);
    this.boss.sprite.setTint(0xcc88ff);
    this.sfx.play('bossVolley');
  }

  protected lockBossUltPoints(): void {
    const px = this.player.x;
    const py = this.player.y;
    this.bossUltPoints = [
      { x: px, y: py },
      { x: px + 90, y: py + 40 },
      { x: px - 80, y: py - 50 },
    ];
  }

  protected beginBossUltRound(now: number): void {
    this.bossUltRound += 1;
    this.bossUltPhase = 'warn';
    this.lockBossUltPoints();
    this.bossUltAt = now + 800;
    this.music.setDuck(0.7);
  }

  protected updateBossUltimate(now: number): void {
    const gfx = this.bossUltGfx;
    if (!this.boss || !this.boss.active) {
      this.bossUltPhase = 'none';
      gfx.clear();
      return;
    }
    if (this.bossUltPhase === 'charge') {
      gfx.clear();
      // 蓄雷：紫色雷环聚集
      const t = 1 - Math.max(0, this.bossUltAt - now) / 800;
      gfx.lineStyle(3, 0xcc88ff, 0.5 + t * 0.4);
      gfx.strokeCircle(this.boss.x, this.boss.y, 20 + t * 46);
      gfx.lineStyle(2, 0xfff2a8, 0.7);
      gfx.strokeCircle(this.boss.x, this.boss.y, 12 + t * 26);
      if (now >= this.bossUltAt) this.beginBossUltRound(now);
      return;
    }
    if (this.bossUltPhase === 'warn') {
      gfx.clear();
      const pulse = 1 + Math.sin(now / 70) * 0.06;
      for (const pt of this.bossUltPoints) {
        gfx.lineStyle(3, 0xcc88ff, 0.95);
        gfx.strokeCircle(pt.x, pt.y, 72 * pulse);
        gfx.lineStyle(1.5, 0xfff2a8, 0.8);
        gfx.strokeCircle(pt.x, pt.y, 46 * pulse);
        gfx.fillStyle(0x7a3cff, 0.14);
        gfx.fillCircle(pt.x, pt.y, 72 * pulse);
      }
      if (now >= this.bossUltAt) {
        this.bossUltPhase = 'strike';
        this.bossUltAt = now + 300;
        this.music.setDuck(0.5);
        gfx.clear();
        let hit = false;
        for (const pt of this.bossUltPoints) {
          // 多道雷电
          for (let k = -1; k <= 1; k += 1) {
            const ox = pt.x + k * 16;
            gfx.lineStyle(k === 0 ? 6 : 3, 0xfff2a8, 1);
            gfx.beginPath();
            gfx.moveTo(ox, pt.y - 180);
            gfx.lineTo(ox + 8, pt.y - 120);
            gfx.lineTo(ox - 6, pt.y - 70);
            gfx.lineTo(ox, pt.y);
            gfx.strokePath();
          }
          gfx.lineStyle(4, 0xcc88ff, 0.9);
          gfx.strokeCircle(pt.x, pt.y, 72);
          this.legion.hurtArea(pt.x, pt.y, 72, 16, now);
          // 冲击波
          const ring = this.add.circle(pt.x, pt.y, 20).setStrokeStyle(4, 0xd8b8ff, 0.95).setDepth(DEPTH.fx + 2);
          this.tweens.add({ targets: ring, scale: 4.2, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
          if (Math.hypot(this.player.x - pt.x, this.player.y - pt.y) < 72) hit = true;
        }
        if (hit && this.bossUltHits < 2) {
          this.bossUltHits += 1;
          this.player.takeDamage(16, now);
          this.cameras.main.shake(160, 0.006);
          this.cameras.main.flash(120, 220, 220, 120, false);
        }
        this.sfx.play('bossSummon');
      }
      return;
    }
    if (this.bossUltPhase === 'strike') {
      if (now >= this.bossUltAt) {
        if (this.bossUltRound < 3) {
          this.beginBossUltRound(now);
        } else {
          this.bossUltPhase = 'recover';
          this.bossUltAt = now + 1500;
          this.music.setDuck(0.75);
          this.bossEnergy = 0;
          this.boss.sprite.clearTint();
          gfx.clear();
        }
      }
      return;
    }
    if (this.bossUltPhase === 'recover') {
      if (now >= this.bossUltAt) {
        this.bossUltPhase = 'none';
        this.music.setDuck(1);
      }
    }
  }

  // ---------------- 武器 ----------------

  protected createWeaponHost(): WeaponHost {
    const scene = this;
    return {
      get player() { return scene.player; }, get enemies() { return scene.enemies; },
      get grid() { return scene.grid; }, get add() { return scene.add; }, get time() { return scene.time; },
      get combatNow() { return scene.combatNow; }, get cameras() { return scene.cameras; },
      get sfx() { return scene.sfx; }, get over() { return scene.over; },
      get spearShots() { return scene.spearShots; }, get bolts() { return scene.bolts; },
      hitEnemy: (...args) => scene.hitEnemy(...args),
      nearestEnemy: (...args) => scene.nearestEnemy(...args),
      fireBolt: (...args) => scene.fireBolt(...args),
      spawnGuandaoSlash: (...args) => scene.spawnGuandaoSlash(...args),
      spawnFlagSwingFx: (...args) => scene.spawnFlagSwingFx(...args),
      spawnFlameGatherFx: (...args) => scene.spawnFlameGatherFx(...args),
      spawnFlameFx: (...args) => scene.spawnFlameFx(...args),
    };
  }

  protected updateWeapons(dt: number, time: number): void {
    const weapons = this.player.weapons;
    // 旧环绕枪视觉已废弃：七探盘龙枪不再有环绕 blade
    for (const blade of this.blades) blade.setVisible(false);
    for (const weapon of weapons) {
      WEAPON_BEHAVIORS[weapon.id]?.(this.weaponHost, weapon, dt, time);
    }
  }

  protected hitEnemy(enemy: Enemy, rawDamage: number, time: number, source: 'melee' | 'arrow' | 'fire' = 'melee', fromAlly = false, weaponHit = true): boolean {
    if (!enemy.active || this.over || enemy.invulnerable) return false;
    if(enemy.isSupplySlot){enemy.hp-=Math.max(1,Math.round(rawDamage));enemy.flash(time);this.sfx.play('hitHeavy');if(enemy.hp<=0)this.killEnemy(enemy);return false;}
    if (enemy === this.boss) this.ensureBossPhase2();
    if(this.yellow&&enemy.kind==='shield'&&enemy.def.behavior!=='wall'&&!fromAlly&&source!=='fire'){const angle=enemy.direction==='left'?Math.PI:enemy.direction==='right'?0:enemy.direction==='up'?-Math.PI/2:Math.PI/2;if(Math.cos(Math.atan2(this.player.y-enemy.y,this.player.x-enemy.x)-angle)>.25)rawDamage*=.65;}
    if (source === 'arrow') this.sfx.play('hitArrow');
    else if (source === 'fire') this.sfx.play('hitFire');
    else this.sfx.play('hitLight');
    if (enemy === this.boss && this.lubu) rawDamage *= this.lubu.incomingDamageMultiplier(source, time);
    const crit = weaponHit && Math.random() < Math.min(1, this.player.stats.critChance + (!fromAlly ? this.player.passive.critBonus(time) : 0));
    let damage = Math.max(1, Math.round(rawDamage * (crit ? BALANCE.critMultiplier : 1)));
    enemy.flash(time);
    if(!fromAlly&&source==='arrow')this.artEffects.show(3,enemy.x,enemy.y-8,32,time,120);
    if (!fromAlly) this.feedback.hit(enemy.x, enemy.y, Math.atan2(enemy.y-this.player.y,enemy.x-this.player.x), time, source);
    if (!fromAlly && weaponHit) this.player.passive.onWeaponHit(time);
    const credit = (n: number): void => { if (fromAlly) this.allyDamageDealt += n; else this.playerDamageDealt += n; };
    // Boss 护盾优先吸收伤害
    if (enemy.kind === 'boss' && this.bossShield > 0) {
      const absorbed = Math.min(this.bossShield, damage);
      this.bossShield -= absorbed;
      damage -= absorbed;
      this.damageDealt += absorbed;
      credit(absorbed);
      if (damage <= 0) {
        this.spawnDamageText(enemy.x, enemy.y - enemy.radius, absorbed, crit);
        return true;
      }
    }
    enemy.hp -= damage;
    this.damageDealt += damage;
    credit(damage);
    this.spawnDamageText(enemy.x, enemy.y - enemy.radius, damage, crit);
    if (enemy.hp <= 0) this.killEnemy(enemy);
    else if (enemy === this.boss) this.ensureBossPhase2();
    return true;
  }

  protected killEnemy(enemy: Enemy): void {
    if (!enemy.active) return;
    const kind = enemy.kind;
    if (enemy.def.texture === 'boss_lubu') this.feedback.death(enemy);
    enemy.deactivate();
    if(enemy.isSupplySlot){this.sfx.play('propBreak');this.supplies?.onBroken(enemy);return;}
    if(enemy.def.behavior==='wall')return;
    this.kills += 1;
    this.legion.onKill(enemy);
    this.sfx.play('enemyDie');
    if (kind === 'boss') {
      this.bossKilled = true;
      this.boss = null;
      this.finish(true, 'boss');
      return;
    }
    this.spawnGem(enemy.x, enemy.y, enemy.def.xp);
  }

  protected nearestEnemy(x: number, y: number, range: number, exclude: Enemy | null = null, ignored?: Set<number>): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = range * range;
    for (const enemy of this.enemies) {
      if (!enemy.active || enemy === exclude || (ignored && ignored.has(enemy.spawnId))) continue;
      const dx = enemy.x - x, dy = enemy.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = enemy;
      }
    }
    return best;
  }

  protected fireBolt(
    pool: Bolt[],
    x: number,
    y: number,
    tx: number,
    ty: number,
    damage: number,
    bounce: number,
    fromPlayer: boolean,
    speed: number,
    textureKey?: string,
  ): void {
    let bolt = pool.find((b) => !b.active);
    if (!bolt) {
      if (pool.length >= 90) return;
      bolt = {
        img: this.add.image(x, y, fromPlayer ? 'bolt' : 'arrow').setDepth(DEPTH.projectile),
        vx: 0,
        vy: 0,
        life: 0,
        damage: 0,
        bounce: 0,
        active: false,
        lastHit: null,
        hitIds: new Set(),
      };
      pool.push(bolt);
    }
    const dx = tx - x;
    const dy = ty - y;
    const dist = Math.hypot(dx, dy) || 1;
    bolt.active = true;
    bolt.vx = (dx / dist) * speed;
    bolt.vy = (dy / dist) * speed;
    bolt.damage = damage;
    bolt.bounce = bounce;
    bolt.life = 2.6;
    bolt.lastHit = null;
    bolt.hitIds = new Set();
    if (fromPlayer) this.sfx.attack();
    bolt.img
      .setTexture(textureKey ?? (fromPlayer ? 'bolt' : 'arrow'))
      .setPosition(x, y)
      .setVisible(true)
      .setRotation(Math.atan2(dy, dx));
    if (fromPlayer) bolt.img.setScale(1);
    else if (textureKey === 'orb') bolt.img.setDisplaySize(22, 22);
    else bolt.img.setDisplaySize(30, 7);
  }

  protected updateBolts(dt: number, time: number): void {
    for (const bolt of this.bolts) {
      if (!bolt.active) continue;
      bolt.img.x += bolt.vx * dt;
      bolt.img.y += bolt.vy * dt;
      bolt.life -= dt;
      if (bolt.life <= 0) {
        bolt.active = false;
        bolt.img.setVisible(false);
        continue;
      }
      const candidates = this.grid.query(bolt.img.x, bolt.img.y, 28);
      let target: Enemy | null = null;
      for (const enemy of candidates) {
        if (!enemy.active || bolt.hitIds.has(enemy.spawnId)) continue;
        if (Math.hypot(enemy.x - bolt.img.x, enemy.y - bolt.img.y) <= enemy.radius + 12) {
          target = enemy;
          break;
        }
      }
      if (target) {
        this.hitEnemy(target, bolt.damage, time, 'arrow');
        bolt.hitIds.add(target.spawnId);
        if (bolt.bounce > 0) {
          const next = this.nearestEnemy(target.x, target.y, 260, null, bolt.hitIds);
          if (next) {
            bolt.bounce -= 1;
            const dx = next.x - target.x;
            const dy = next.y - target.y;
            const d = Math.hypot(dx, dy) || 1;
            bolt.img.setPosition(target.x, target.y);
            bolt.vx = (dx / d) * 560;
            bolt.vy = (dy / d) * 560;
            bolt.life = 1.6;
            continue;
          }
        }
        if (bolt.hitIds.size > 1) this.debugChains.push([...bolt.hitIds]);
        if (this.debugChains.length > 30) this.debugChains.shift();
        bolt.active = false;
        bolt.img.setVisible(false);
      }
    }
  }

  protected updateBullets(dt: number): void {
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;
      bullet.img.x += bullet.vx * dt;
      bullet.img.y += bullet.vy * dt;
      bullet.life -= dt;
      const soldier = this.legion.grid.query(bullet.img.x, bullet.img.y, 26, this.legionBulletScratch).find(u => u.active && Math.hypot(u.x - bullet.img.x, u.y - bullet.img.y) < u.radius + 8);
      if (soldier) { this.legion.hurt(soldier, bullet.damage, this.combatNow, { x: bullet.img.x - bullet.vx * .1, y: bullet.img.y - bullet.vy * .1, normal: bullet.img.texture.key === 'arrow'||bullet.img.texture.key === 'yellow_arrow' }); bullet.active = false; bullet.img.setVisible(false); continue; }
      if (Math.hypot(this.player.x - bullet.img.x, this.player.y - bullet.img.y) < this.player.radius + 8) {
        bullet.active = false;
        bullet.img.setVisible(false);
        const spark = this.add.image(bullet.img.x, bullet.img.y, 'spark').setDepth(DEPTH.fx).setScale(2.2);
        this.tweens.add({ targets: spark, alpha: 0, scale: 0.6, duration: 180, onComplete: () => spark.destroy() });
        if (this.player.takeDamage(bullet.damage, this.combatNow)) this.cameras.main.flash(90, 180, 40, 40, false);
        continue;
      }
      if (bullet.life <= 0) {
        bullet.active = false;
        bullet.img.setVisible(false);
      }
    }
  }

  protected spawnDamageText(x: number, y: number, value: number, crit: boolean): void {
    let fx = this.dmgFx.find((f) => !f.active);
    if (!fx) {
      if (this.dmgFx.length >= 40) return;
      fx = {
        crit,
        text: this.add
          .text(0, 0, '', { fontFamily: FONT, fontSize: crit ? '18px' : '14px', color: crit ? '#ffd166' : '#f5efe6' })
          .setOrigin(0.5)
          .setDepth(DEPTH.dmgText),
        life: 0,
        vy: 0,
        active: false,
      };
      this.dmgFx.push(fx);
    }
    if (fx.crit !== crit) {
      fx.crit = crit;
      fx.text.setStyle({ fontSize: crit ? '18px' : '14px', color: crit ? '#ffd166' : '#f5efe6' });
    }
    fx.active = true;
    fx.life = 0.55;
    fx.vy = -52;
    fx.text.setPosition(x, y).setText(String(value)).setAlpha(1).setVisible(true).setScale(crit ? 1.15 : 1);
  }

  protected updateDmgFx(dt: number): void {
    for (const fx of this.dmgFx) {
      if (!fx.active) continue;
      fx.life -= dt;
      fx.text.y += fx.vy * dt;
      fx.text.setAlpha(Math.max(0, fx.life / 0.55));
      if (fx.life <= 0) {
        fx.active = false;
        fx.text.setVisible(false);
      }
    }
  }

  protected spawnGem(x: number, y: number, value: number): void {
    let gem = this.gems.find((g) => !g.active);
    if (!gem) {
      if (this.gems.length >= 200) return;
      gem = {
        img: this.add.image(x, y, 'gem_small').setDepth(DEPTH.gem),
        value: 0,
        vx: 0,
        vy: 0,
        active: false,
        restMs: 0,
      };
      this.gems.push(gem);
    }
    gem.active = true;
    gem.value = value;
    gem.restMs = 280;
    gem.vx = (Math.random() - 0.5) * 40;
    gem.vy = (Math.random() - 0.5) * 40;
    gem.img.setTexture(value >= 10 ? 'gem_large' : 'gem_small').setPosition(x, y).setVisible(true).setAlpha(1).setScale(1);
  }

  protected updateGems(dt: number): void {
    const radius = this.player.stats.pickupRadius;
    for (const gem of this.gems) {
      if (!gem.active) continue;
      const dx = this.player.x - gem.img.x;
      const dy = this.player.y - gem.img.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 22) {
        gem.active = false;
        gem.img.setVisible(false);
        this.sfx.play('pickup');
        const gained = this.player.gainXp(gem.value);
        if (gained > 0) {
          this.pendingLevels += gained;
          if (this.mode === 'none') this.openUpgrade();
        }
        continue;
      }
      gem.restMs = Math.max(0, gem.restMs - dt * 1000);
      if (gem.restMs > 0) {
        gem.img.x += gem.vx * dt;
        gem.img.y += gem.vy * dt;
        gem.vx *= 0.82;
        gem.vy *= 0.82;
        if (Math.abs(gem.vx) + Math.abs(gem.vy) < 6) {
          gem.vx = 0;
          gem.vy = 0;
        }
      } else if (dist < radius) {
        gem.img.x += (dx / dist) * 420 * dt;
        gem.img.y += (dy / dist) * 420 * dt;
      } else if (gem.vx !== 0 || gem.vy !== 0) {
        gem.img.x += gem.vx * dt;
        gem.img.y += gem.vy * dt;
        gem.vx *= 0.86;
        gem.vy *= 0.86;
        if (Math.abs(gem.vx) + Math.abs(gem.vy) < 4) {
          gem.vx = 0;
          gem.vy = 0;
        }
      }
    }
  }

  spawnGuandaoSlash(angle: number, alphaScale: number, size = 110, duration = 120): void {
    const reachOffset = size * .19;
    this.artEffects.show(1,this.player.x+Math.cos(angle)*reachOffset,this.player.y+Math.sin(angle)*reachOffset,size,this.combatNow,duration,angle);
    if (!this.textures.exists('guandao_slash_sheet')) return;
    const originX = this.player.x, originY = this.player.y;
    for (let f = 0; f < 3; f += 1) {
      this.time.delayedCall(f * 45, () => {
        if (this.over) return;
        const fx = this.add
          .image(originX + Math.cos(angle) * reachOffset, originY + Math.sin(angle) * reachOffset, 'guandao_slash_sheet', String(f))
          .setDisplaySize(size, size)
          .setRotation(angle)
          .setDepth(41)
          .setAlpha(0.62 * alphaScale);
        this.tweens.add({ targets: fx, alpha: 0, scaleX: fx.scaleX * 1.06, scaleY: fx.scaleY * 1.06, duration, onComplete: () => fx.destroy() });
      });
    }
  }

  protected spawnFlagSwingFx(dirX: number, dirY: number): void {
    const px = this.player.x;
    const py = this.player.y;
    const angle = Math.atan2(dirY, dirX);
    // 旗子更小（0.68），挥动 ±18°，旗面做轻微颤动
    for (let i = 0; i < 3; i += 1) {
      const ghost = this.add
        .image(px, py + 6, 'war_flag')
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.fx - 1)
        .setAlpha(0.16 - i * 0.035)
        .setScale(0.68)
        .setRotation(angle - 0.32 + i * 0.18);
      this.tweens.add({ targets: ghost, rotation: angle + 0.32, alpha: 0, duration: 230, delay: i * 25, onComplete: () => ghost.destroy() });
    }
    const flag = this.add.image(px, py + 6, 'war_flag').setOrigin(0.5, 1).setDepth(DEPTH.fx).setScale(0.68);
    flag.setRotation(angle - 0.32);
    this.tweens.add({
      targets: flag,
      rotation: angle + 0.32,
      duration: 220,
      ease: 'Sine.InOut',
      onComplete: () => {
        this.tweens.add({ targets: flag, alpha: 0, duration: 120, onComplete: () => flag.destroy() });
      },
    });
    // 旗面飘扬：横向缩放 + 上下轻摆，模拟布料
    this.tweens.add({ targets: flag, scaleX: 0.74, yoyo: true, repeat: 2, duration: 90, ease: 'Sine.InOut' });
  }

  protected spawnFlameGatherFx(x: number, y: number, radius: number): void {
    const warn = this.add.circle(x, y, radius * 0.55, 0xff6a2a, 0.16).setStrokeStyle(3, 0xffb347, 0.9).setDepth(DEPTH.fx - 2);
    this.tweens.add({ targets: warn, scale: 1.18, alpha: 0.4, duration: 150, yoyo: true, onComplete: () => warn.destroy() });
    for (let i = 0; i < 10; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const dist = radius * (0.7 + Math.random() * 0.5);
      const ember = this.add.circle(x + Math.cos(a) * dist, y + Math.sin(a) * dist, 3, 0xffc46a, 0.9).setDepth(DEPTH.fx);
      this.tweens.add({ targets: ember, x, y, alpha: 0, duration: 150, delay: i * 8, onComplete: () => ember.destroy() });
    }
  }

  protected spawnFlameFx(x: number, y: number, radius: number): void {
    this.artEffects.show(2,x,y,radius*1.5,this.combatNow,280);
    for (let i = 0; i < 2; i += 1) {
      const flame = this.add.image(x, y, 'flame').setDepth(DEPTH.fx).setAlpha(0.9).setScale(0.45);
      this.tweens.add({
        targets: flame,
        alpha: 0,
        scale: radius / 34,
        duration: 320,
        ease: 'Quad.easeOut',
        onComplete: () => flame.destroy(),
      });
    }
  }

  // ---------------- 升级 / 结算 ----------------

  protected setMode(mode: Mode): void {
    // 所有战斗 Timer / Tween 一起冻结；绝对期限使用 combatNow。
    this.mode = mode;
    const canPlay = mode === 'none' && !this.over;
    this.time.paused = !canPlay;
    if (canPlay) this.tweens.resumeAll();
    else this.tweens.pauseAll();
    this.joystick.setEnabled(canPlay);
    for (const child of this.children.list) if (child.name === 'combat-notice') (child as Phaser.GameObjects.Text).setVisible(canPlay);
    if (!canPlay) this.joystick.reset();
    if (this.levelPanel) this.levelPanel.setVisible(mode === 'levelup');
    if (this.recruitPanel) this.recruitPanel.setVisible(false);
    this.legionUI?.panel.setVisible(mode === 'recruit' || mode === 'rest');
    this.reinforcements?.panel.setVisible(mode === 'aid');
    if (this.pausePanel) {
      this.pausePanel.setVisible(mode === 'pause');
      const exit=this.pausePanel.getByName('pause-exit') as Phaser.GameObjects.Text|null;
      exit?.setData('confirm',false).setText('返回选将').setColor('#b5c4b2');
    }
    if (this.resultPanel) this.resultPanel.setVisible(mode === 'result');
  }

  protected openUpgrade(): void {
    if (this.over || this.pendingLevels <= 0) return;
    this.sfx.level();
    this.upgradeOptions = buildUpgradeOptions(this.player, this.player.weapons);
    this.renderCards();
    this.setMode('levelup');
  }

  protected renderCards(): void {
    for (let i = 0; i < this.cardViews.length; i += 1) {
      const view = this.cardViews[i];
      const option = this.upgradeOptions[i];
      if (!option) {
        view.bg.setVisible(false);
        view.icon.setVisible(false);
        view.name.setVisible(false);
        view.desc.setVisible(false);
        view.tag.setVisible(false);
        continue;
      }
      view.bg.setVisible(true);
      view.name.setVisible(true);
      view.desc.setVisible(true);
      view.tag.setVisible(true);
      view.name.setText(option.name);
      view.desc.setText(option.desc);
      let tagText = '被动';
      if (option.kind === 'rare') tagText = '稀有';
      else if (option.kind === 'relic') {
        tagText = `${SCHOOL_NAMES[(option.school ?? 'wushuang') as RelicSchool]} 遗物`;
      } else if (option.kind === 'weapon') {
        const owned = option.weaponId ? this.player.weapons.find((w) => w.id === option.weaponId) : undefined;
        tagText = owned ? `武器 Lv.${owned.level} → ${owned.level + 1}` : '新武器';
      }
      view.tag.setText(tagText);
      view.tag.setBackgroundColor(option.id.startsWith('new_') ? '#526047' : option.kind === 'weapon' ? '#51452a' : '#293e34');
      view.tag.setColor(option.kind === 'relic' ? '#ffd166' : option.kind === 'weapon' ? '#ffe9b0' : option.kind === 'rare' ? '#ffd0c0' : '#d8ffe9');
      const iconKey = option.weaponId === 'spear_orbit'
        ? 'icon_1'
        : option.weaponId === 'crossbow'
          ? 'icon_2'
          : option.weaponId === 'flame_banner'
            ? 'icon_3'
            : option.kind === 'rare'
              ? 'icon_rare'
              : option.weaponId === 'guandao' ? 'icon_guandao' : 'icon_passive';
      if (option.kind === 'relic' && option.icon) {
        view.icon.setTexture(option.icon).setDisplaySize(44, 44).setVisible(true);
      } else {
        view.icon.setTexture(iconKey).setDisplaySize(44, 44).setVisible(true);
      }
    }
  }

  protected chooseUpgrade(index: number): void {
    if (this.mode !== 'levelup' || this.pendingLevels <= 0) return;
    const option = this.upgradeOptions[index];
    if (!option) return;
    const beforeSet = option.school ? this.player.schoolCount(option.school as RelicSchool) : 0;
    this.upgradeOptions = []; // 先消费选项，防止重复点击旧卡。
    option.apply(this.player, this.player.weapons);
    if (option.kind === 'relic' && option.school && beforeSet === 1 && this.player.schoolCount(option.school as RelicSchool) === 2) {
      this.showSetToast(option.school as RelicSchool);
    }
    this.pendingLevels -= 1;
    this.resumePendingChoices();
  }

  protected resumePendingChoices(): void {
    if (this.over) return;
    this.setMode('none');
    if (this.pendingLevels > 0) this.openUpgrade();
    else if (this.pendingRecruit) this.openRecruit();
    else if (this.elapsed >= this.reinforcements.nextAt) this.setMode('aid');
  }

  protected showSetToast(school: RelicSchool): void {
    const text = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.28, `${SCHOOL_NAMES[school]}套装激活！`, {
        fontFamily: FONT,
        fontSize: IS_DESKTOP ? '22px' : '24px',
        color: '#ffd166',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.overlay + 50).setName('combat-notice').setVisible(this.mode === 'none');
    this.tweens.add({ targets: text, y: text.y - 30, alpha: 0, duration: 900, onComplete: () => text.destroy() });
  }

  protected showWaveBanner(text: string, danger = false): void {
    // Keep one notice at a time; no opaque panel over the battlefield.
    for (const notice of this.children.list.filter(o => o.name === 'combat-notice')) {
      this.tweens.killTweensOf(notice); notice.destroy();
    }
    const match = /^第 (\d+)\/(\d+) 波 · (.+)$/.exec(text);
    const label = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT * .21)
      .setScrollFactor(0).setDepth(DEPTH.overlay - 10).setName('combat-notice').setVisible(this.mode === 'none');
    const caption = this.add.text(0, -21, match ? `第 ${match[1]} / ${match[2]} 波` : '战场警报', {
      fontFamily: FONT, fontSize: IS_DESKTOP ? '13px' : '14px', color: danger ? '#efb39c' : '#e1cf9d',
      resolution: 2, stroke: '#241d12', strokeThickness: 3,
    }).setOrigin(.5).setScrollFactor(0);
    const title = this.add.text(0, 7, match ? match[3] : text, {
      fontFamily: FONT, fontSize: IS_DESKTOP ? '24px' : '23px', color: danger ? '#f1a18a' : '#f4e4b9',
      fontStyle: 'bold', align: 'center', resolution: 2, stroke: '#241d12', strokeThickness: 4,
      wordWrap: { width: GAME_WIDTH - 64 },
    }).setOrigin(.5).setScrollFactor(0);
    const ornament = this.add.graphics().setScrollFactor(0);
    const span = Math.min(GAME_WIDTH * .25, 108);
    ornament.lineStyle(1, danger ? 0xc87c60 : 0xc6ad72, .8)
      .lineBetween(-span, 31, -9, 31).lineBetween(9, 31, span, 31)
      .fillStyle(danger ? 0xc87c60 : 0xc6ad72, .9).fillRect(-2,29,4,4);
    label.add([caption, title, ornament]);
    this.tweens.add({ targets: label, alpha: 0, y: label.y - 8, delay: 1150, duration: 350, onComplete: () => label.destroy() });
  }

  protected createVolumeRow(label: string, y: number, initial: number, onChange: (value: number) => void): Phaser.GameObjects.GameObject[] {
    const cx = GAME_WIDTH / 2, width = Math.min(330, GAME_WIDTH - 144);
    const text = this.add.text(cx-width/2,y-23,label,warText(15,'#c7d6c5'));
    const percent = this.add.text(cx+width/2,y-23,`${Math.round(initial)}%`,warText(15,'#dfc58a')).setOrigin(1,0);
    const track = this.add.rectangle(cx,y+9,width,6,0x07140d).setStrokeStyle(1,0x48634e);
    const fill = this.add.rectangle(cx-width/2,y+9,width*initial/100,4,WAR.jade).setOrigin(0,.5);
    const hit = this.add.rectangle(cx,y+9,width+24,52,0,0).setInteractive({useHandCursor:true});
    const knob = this.add.rectangle(cx-width/2+width*initial/100,y+9,14,20,0xdcc489).setStrokeStyle(1,0xf4dfac).setInteractive({useHandCursor:true});
    const apply = (ratio:number):void => {
      const pct=Math.round(Phaser.Math.Clamp(ratio,0,1)*100);
      knob.x=cx-width/2+width*pct/100;fill.width=width*pct/100;percent.setText(`${pct}%`);onChange(pct);
    };
    hit.on('pointerdown',(p:Phaser.Input.Pointer)=>apply((p.x-(cx-width/2))/width));
    hit.on('pointermove',(p:Phaser.Input.Pointer)=>{if(p.isDown)apply((p.x-(cx-width/2))/width);});
    this.input.setDraggable(knob);
    knob.on('drag',(_p:Phaser.Input.Pointer,x:number)=>apply((x-(cx-width/2))/width));
    return [text,percent,track,fill,hit,knob];
  }

  protected scheduleRecruit(): void {
    if (this.over) return;
    if (this.mode === 'none') this.openRecruit();
    else this.pendingRecruit = true;
  }

  protected openRecruit(): void {
    if (this.waveIndex <= 0 || this.resting || this.recruitedWaves.has(this.waveIndex)) { this.pendingRecruit = false; return; }
    if (this.mode !== 'none') { this.pendingRecruit = true; return; }
    this.pendingRecruit = false; this.freeRecruit = true;
    const start = Math.max(0, this.waveIndex - 1) * 3;
    const pool=worldUnlocked()?TROOP_KINDS:INITIAL_TROOPS;
    this.recruitOptions = Array.from({ length: 3 }, (_, i) => ({ kind: pool[(start + i) % pool.length], upgrade: false }));
    this.renderRecruit(); this.setMode('recruit');
  }

  protected renderRecruit(): void { this.legionUI?.render(this.legion, this.resting ? 'rest' : 'wave', this.recruitOptions.map(o => o.kind));if(this.resting)this.legionUI.setCampDestination(this.chapter.stage===1?'下曲阳破阵':'广宗决战'); }

  private buyTroops(kind: TroopKind, train: boolean): void {
    if (this.mode === 'rest' && this.resting) {
      if(train||!INITIAL_TROOPS.includes(kind))return;
      const ok = train ? this.legion.train(kind) : this.legion.recruit(kind, 1);
      if (ok) this.renderRecruit();
      return;
    }
    if (this.mode !== 'recruit' || !this.freeRecruit || train || this.recruitedWaves.has(this.waveIndex) || !this.recruitOptions.some(o => o.kind === kind)) return;
    if (this.legion.recruit(kind, 1, true)) {
      this.recruitedWaves.add(this.waveIndex); this.freeRecruit = false; this.recruitOptions = [];
      this.resumePendingChoices();
    }
  }

  protected chooseRecruit(index: number): void { const option = this.recruitOptions[index]; if (option) this.buyTroops(option.kind, false); }

  private continueCampaign(): void {
    if (!this.resting || this.mode !== 'rest') return;
    const stage=this.chapter.stage??1,next=Math.min(3,stage+1) as 1|2|3;
    const transfer=packCampaign(this.runConfig.character,this.player,this.legion);transfer.chapter='huangjin';transfer.stage=next;
    this.registry.set('campaignTransfer',transfer);
    this.registry.set('runConfig',{...this.runConfig,chapter:'huangjin',stage:next});
    this.resting = false; this.scene.restart();
  }

  protected togglePause(): void {
    if (this.mode === 'none' && !this.over) {
      this.setMode('pause');
    } else if (this.mode === 'pause') {
      this.resumePendingChoices();
    }
  }

  protected checkEnd(): void {
    if (this.over) return;
    if (!this.player.alive) {
      this.finish(false);
      return;
    }
    // 第六波 Boss 战不再限时：Boss 出现后只有击杀或玩家死亡结束
    if (!this.bossSpawned && this.elapsed >= chapterBossTime(this.chapter) + 60) this.finish(false, 'timeout');
  }

  protected finish(victory: boolean, reason: RunEndReason = 'death'): void {
    if (this.over) return;
    this.over = true;
    this.player.passive.stop();
    this.legion.stop();
    this.reinforcements.clear();
    this.victory = victory;
    this.music.stop();
    this.lubu?.clear();this.yellow?.clear();this.supplies?.clear();
    if(victory&&this.chapter.stage===3)this.finaleFadeMs=800;
    this.feedback.clearAttacks();
    if (victory) this.sfx.win();
    else this.sfx.lose();
    this.cameras.main.flashEffect.reset();this.cameras.main.shakeEffect.reset();
    this.setMode('result');
    const stats: RunStats = {
      victory,
      reason,
      elapsed: this.elapsed,
      kills: this.kills,
      level: this.player.level,
      damageDealt: this.damageDealt,
      bossKilled: this.bossKilled,
    };
    const title = victory ? this.chapter.victoryTitle : reason === 'timeout' ? '时间耗尽' : '败走';
    const subtitle = victory ? this.chapter.victoryText : reason === 'timeout' ? `${this.chapter.bossName}未破，退守待援` : '乱军之中，力战而退';
    this.resultTexts.title.setText(title).setColor(victory ? '#e8c76a' : '#d24b3f');
    this.resultTexts.subtitle.setText(subtitle);
    const row = (label: string, value: string): string => {
      const pad = label.length >= 4 ? '' : '　'.repeat(4 - label.length);
      return `${label}${pad}  ${value}`;
    };
    this.resultTexts.body.setText(
      [
        row('存活时间', this.formatTime(stats.elapsed)),
        row('击杀敌军', String(stats.kills)),
        row('等级', `Lv.${stats.level}`),
        row('造成伤害', String(Math.round(stats.damageDealt))),
        row('军团战损', `${this.legion.count}存活 / ${this.legion.dead}阵亡`),
        row(this.chapter.bossName, stats.bossKilled ? '已击败' : '未击败'),
        row('结局', victory ? '讨伐成功' : reason === 'timeout' ? '超时' : '阵亡'),
      ].join('\n'),
    );
    if(this.worldCampaign){const reward=settleExpedition(this.expeditionId,{...stats,chapter:this.chapter.id,returned:this.allies.filter(a=>a.active&&a.reserveSoldier).map(a=>a.kind),debug:isChapterTestRun()||this.debugModified||this.debugJumped||this.player.damageImmune});
      this.resultTexts.body.setFontSize(IS_DESKTOP?14:16).setLineSpacing(IS_DESKTOP?5:8).setText(this.resultTexts.body.text+`\n永久奖励  军功 +${reward.merits} · 粮草 +${reward.provisions}`);
      this.resultTexts.subtitle.setText(victory&&this.chapter.id==='huangjin'&&this.chapter.stage===3&&worldUnlocked()?'黄巾平定 · 三国天下开启':victory?this.chapter.victoryText:reward.message);
    }
    if(victory&&this.chapter.stage===3&&worldUnlocked())this.registry.set('worldReveal',true);
    const homeLink=this.resultPanel.getByName('result-home') as Phaser.GameObjects.Text|null;homeLink?.setText(this.worldCampaign&&worldUnlocked()?this.chapter.stage===3&&this.victory?'三国天下开启':'返回主城':'返回选关');
    recordChapterVictory({ stage:this.chapter.stage,chapter: this.chapter.id, victory, reason, bossKilled: this.bossKilled,
      debug: isChapterTestRun() || this.debugModified || this.debugJumped || this.player.damageImmune });
    this.onRunFinished(stats);
    if (victory && this.chapter.id === 'huangjin' && (this.chapter.stage??3)<3) {
      this.cameras.main.flashEffect.reset(); this.cameras.main.shakeEffect.reset();
      this.pendingRecruit = false; this.pendingLevels = 0; this.freeRecruit = false; this.resting = true;
      this.player.hp = this.player.maxHp; this.legion.recover(); this.renderRecruit(); this.legionUI.setCampDestination(this.chapter.stage===1?'下曲阳破阵':'广宗决战'); this.setMode('rest');
    }
  }

  protected formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ---------------- HUD ----------------

  protected buildHud(): void {
    this.hudGfx = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    const style = (size: number, color: string) => warText(size, color);
    this.hudTexts = {
      hp: this.add.text(206, 43, '', style(14, '#f5efe6')).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1),
      level: this.add.text(28, 23, 'Lv.1', style(16, '#e8c76a')).setScrollFactor(0).setDepth(DEPTH.hud + 1),
      wave: this.add.text(28, 88, '', style(15, '#d8c9ae')).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1),
      timer: this.add.text(GAME_WIDTH / 2, 22, '00:00', style(25, '#f5efe6')).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1),
      kills: this.add.text(GAME_WIDTH - 24, 66, '击杀 0', style(14, '#a9bba9')).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1),
      chapter: this.add.text(GAME_WIDTH / 2, 56, this.chapter.name, style(14, '#93b6a2')).setOrigin(.5,0).setScrollFactor(0).setDepth(DEPTH.hud + 1),
      boss: this.add.text(GAME_WIDTH / 2, 66, this.chapter.bossName, style(15, '#e8c76a')).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1).setVisible(false),
      bossHp: this.add.text(GAME_WIDTH / 2, 66, '100%', style(13, '#f5efe6')).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1).setVisible(false),
      bossEnergy: this.add.text(GAME_WIDTH / 2, 100, '', style(11, '#c9a8ff')).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1).setVisible(false),
      mute: this.add
        .text(145, 198, '音效:开', style(13, '#a89c8c'))
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.hud + 1)
        .setPadding(8, 4, 8, 4)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const muted = this.sfx.toggle();
          this.muteText?.setText(muted ? '音效:关' : '音效:开');
        }),
      music: this.add
        .text(28, 198, '音乐:开', style(13, '#a89c8c'))
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.hud + 1)
        .setPadding(8, 4, 8, 4)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const muted = this.music.toggle();
          this.hudTexts.music.setText(muted ? '音乐:关' : '音乐:开');
        }),
      pause: this.add
        .text(GAME_WIDTH - 24, 20, '暂停', style(17, '#ead39b')).setFixedSize(76,62).setAlign('center').setStroke('#10180f',2)
        .setOrigin(1, 0)
        .setPadding(8, 18, 8, 18)
        .setScrollFactor(0)
        .setDepth(DEPTH.hud + 1)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.togglePause()),
    };
    this.hudTexts.details = this.add.text(GAME_WIDTH - 24, 94, '战况 ▾', style(13, '#dfcfab'))
      .setOrigin(1,0).setFixedSize(96,62).setAlign('center').setPadding(10,12).setScrollFactor(0).setDepth(DEPTH.hud+1)
      .setInteractive({useHandCursor:true}).on('pointerdown',()=>{this.relicExpanded=!this.relicExpanded;this.hudAcc=1;});
    this.hudTexts.gear = this.add.text(32, 236, '', {...style(12,'#dfd5bc'),wordWrap:{width:GAME_WIDTH>600?370:GAME_WIDTH-72},lineSpacing:4})
      .setScrollFactor(0).setDepth(DEPTH.hud+1);
    this.passiveHud = new PassiveHud(this);
    this.muteText = this.hudTexts.mute;
    this.hudTexts.music.setText(this.music.mutedState ? '音乐:关' : '音乐:开');
    this.hudTexts.relics = this.add
      .text(28, 308, '', style(12, '#cfc3b0')).setWordWrapWidth(GAME_WIDTH - 56)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 1)
      .setPadding(4, 2, 4, 2)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.relicExpanded = !this.relicExpanded; });
    this.relicIcons = [];
    for (let i = 0; i < 8; i += 1) {
      const icon = this.add
        .image(42 + i * 30, 350, 'item_drum')
        .setDisplaySize(30, 30)
        .setScrollFactor(0)
        .setDepth(DEPTH.hud + 1)
        .setVisible(false);
      this.relicIcons.push(icon);
    }
  }

  protected updateHud(): void {
    if (this.hudAcc < .1 && this.lastHudMode === this.mode) return;
    this.hudAcc = 0; this.lastHudMode = this.mode;
    const overlay = this.mode !== 'none';
    this.legionUI?.update(this.legion, !overlay && !this.over);
    this.passiveHud.update(this.player.passive, this.combatNow, !overlay);
    this.hudGfx.setVisible(!overlay);
    if (this.hudTexts) for (const t of Object.values(this.hudTexts)) t.setVisible(!overlay);
    for (const icon of this.relicIcons) icon.setVisible(!overlay && icon.visible);
    if (overlay) { this.hintText?.setVisible(false); return; }
    const g = this.hudGfx;
    const hpRatio = this.player ? Phaser.Math.Clamp(this.player.hp / this.player.maxHp, 0, 1) : 1;
    const xpRatio = this.player ? Phaser.Math.Clamp(this.player.xp / this.player.xpNext, 0, 1) : 0;
    g.clear();
    // Small neutral health backing only; never a screen-wide green curtain.
    g.fillStyle(0x100e09,.35).fillRoundedRect(20,18,194,60,4);
    if(this.relicExpanded) {
      g.fillStyle(0x17150f,.9).fillRoundedRect(20,190,Math.min(410,GAME_WIDTH-40),180,4);
      g.lineStyle(1,WAR.gold,.45).strokeRoundedRect(20,190,Math.min(410,GAME_WIDTH-40),180,4);
    }
    // Stable HUD regions: health, clock, touch controls, then wave/resources.

    g.fillStyle(0x07120d,.95).fillRect(27,42,180,18);
    g.fillStyle(WAR.danger,.95).fillRect(29,44,Math.round(176*hpRatio),14);
    g.lineStyle(1,0xd5b887,.55).strokeRect(27,42,180,18);
    g.fillStyle(0x07120d,.9).fillRect(27,66,180,6);
    g.fillStyle(WAR.jade,.95).fillRect(28,67,Math.round(178*xpRatio),4);

    if (!this.hudTexts) return;
    this.hudTexts.hp.setText(`${Math.ceil(this.player.hp)}/${this.player.maxHp}`);
    this.hudTexts.level.setText(`${getCharacter(this.runConfig.character).name}  Lv.${this.player.level}`);
    this.hudTexts.timer.setText(this.formatTime(this.elapsed));
    this.hudTexts.kills.setText(`击杀 ${this.kills}`);
    if (this.waveIndex >= 0) {
      this.hudTexts.wave.setText(`第 ${this.waveIndex + 1}/${this.chapter.waves.length} 波 · ${this.chapter.waves[this.waveIndex].name}`);
    }
    this.hudTexts.details.setText(this.relicExpanded?'收起战况 ▴':'战况 ▾');
    for(const key of ['music','mute','gear','relics']) this.hudTexts[key].setVisible(this.relicExpanded);
    this.hudTexts.gear.setText(this.player.weapons.map(w=>`${WEAPON_META[w.id].name} Lv.${w.level}`).join(' · ')+'\n'+this.passiveHud.description);
    const relicList = this.player.relics;
    const schoolParts: string[] = [];
    for (const sc of ['wushuang', 'shenshe', 'lieyan', 'tiebi'] as RelicSchool[]) {
      const count = this.player.schoolCount(sc);
      if (count > 0) schoolParts.push(`${SCHOOL_NAMES[sc]} ${count}/2`);
    }
    this.hudTexts.relics.setText(relicList.length ? !IS_DESKTOP && !this.relicExpanded ? `遗物 ${relicList.length}/8  · 点按展开` : `遗物 ${relicList.length}/8  ${schoolParts.join('  ')}` : '');
    const showIcons = relicList.length > 0 && this.relicExpanded;
    for (let i = 0; i < this.relicIcons.length; i += 1) {
      const icon = this.relicIcons[i];
      const id = relicList[i];
      if (!showIcons || !id) { icon.setVisible(false); continue; }
      icon.setTexture(`item_${id === 'whetstone' ? 'whetstone' : id}`).setVisible(true);
    }

    const boss = this.boss;
    if (boss && boss.active) {
      const barW = Math.min(440, GAME_WIDTH * 0.9);
      const left = (GAME_WIDTH - barW) / 2;
      const barY = GAME_HEIGHT - 68;
      const ratio = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
      this.hintText?.setVisible(false);
      this.hudTexts.boss.setVisible(true).setPosition(left, barY - 24);
      const hpLabel = this.bossShield > 0 ? `${Math.round(ratio * 100)}% 🛡${Math.round(this.bossShield)}` : `${Math.round(ratio * 100)}%`;
      this.hudTexts.bossHp.setVisible(true).setPosition(left + barW, barY - 24).setText(hpLabel);
      const stageBoss=!!this.chapter.stage&&this.chapter.stage<3;
      const energy = this.lubu ? this.lubu.energy : this.bossEnergy;
      this.hudTexts.bossEnergy.setVisible(true).setPosition(left + barW, barY + 31)
        .setText(this.lubu ? `${this.lubu.phase2 ? `魔神 ${Math.floor(energy)}%` : '半血解锁大招'} · ${this.lubu.statusLabel}` : stageBoss?`${boss.hp<=boss.maxHp*.5?'半血强化 · ':''}${this.chapter.stage===1?'留意扇形与冲锋预警':'地裂与环形震荡 · 躲开金线'}`:`⚡ ${Math.floor(energy)}%`);
      g.fillStyle(0x000000, 0.72);
      g.fillRect(left, barY, barW, 12);
      g.fillStyle(COLORS.red, 0.95);
      g.fillRect(left + 2, barY + 2, Math.max(0, (barW - 4) * ratio), 8);
      if (this.bossShield > 0) {
        const sr = Math.min(1, this.bossShield / 300);
        g.fillStyle(0x66d9ff, 0.9);
        // 独立细盾条，不与生命段拼接后溢出容器。
        g.fillRect(left + 2, barY + 11, (barW - 4) * sr, 3);
      }
      if(!stageBoss){g.fillStyle(0x1a1020, 0.85);
      g.fillRect(left, barY + 18, barW, 7);
      g.fillStyle(WAR.gold, 0.95);
      g.fillRect(left, barY + 18, Math.max(0, barW * (energy / 100)), 7);}
    } else {
      this.hintText?.setVisible(this.elapsed < 8 || this.relicExpanded);
      this.hudTexts.boss.setVisible(false);
      this.hudTexts.bossHp.setVisible(false);
      this.hudTexts.bossEnergy.setVisible(false);
    }
  }

  // ---------------- 覆盖层 ----------------

  protected buildOverlays(): void {
    this.levelPanel = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay).setVisible(false);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x09140e, 0.8).setOrigin(0, 0).setInteractive();
    const d = IS_DESKTOP;
    const title = this.add
      .text(GAME_WIDTH / 2, d ? 58 : 205, '将星精进 · 择一强化', { fontFamily: FONT, fontSize: d ? '20px' : '24px', color: '#e8c76a' })
      .setOrigin(0.5);
    this.levelPanel.add([dim, title]);

    const ys = d ? [148, 284, 420] : [310, 454, 598];
    for (let i = 0; i < 3; i += 1) {
      const y = ys[i];
      const bg = this.add
        .image(GAME_WIDTH / 2, y, 'ui_war_card')
        .setDisplaySize(d ? 480 : 452, 126)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => bg.setTint(0xffe4a5)).on('pointerup', () => this.chooseUpgrade(i)).on('pointerover', () => bg.setTint(0xe7d6b3)).on('pointerout', () => bg.clearTint());
      const icon = this.add.image(GAME_WIDTH / 2 - (d ? 201 : 187), y - 25, 'icon_1').setDisplaySize(44, 44).setVisible(false);
      const name = this.add
        .text(GAME_WIDTH / 2 - (d ? 166 : 152), y - 23, '', { ...warText(d ? 18 : 19), wordWrap: {width:d ? 380 : 350} })
        .setOrigin(0,0);
      const desc = this.add
        .text(GAME_WIDTH / 2 - (d ? 220 : 206), y + 7, '', { ...warText(14,'#c8cbb7'), lineSpacing: 3, wordWrap: { width: d ? 440 : 412 } })
        .setOrigin(0,0);
      const tag = this.add
        .text(GAME_WIDTH / 2 - (d ? 166 : 152), y - 51, '', { fontFamily: FONT, fontSize: d ? '12px' : '13px', color: '#f5efe6' })
        .setOrigin(0,0).setResolution(2).setBackgroundColor('#263e2c')
        .setPadding(6, 2, 6, 2);
      this.levelPanel.add([bg, icon, name, desc, tag]);
      this.cardViews.push({ bg, icon, name, desc, tag });
    }

    this.pausePanel = this.add.container(0,0).setScrollFactor(0).setDepth(DEPTH.overlay).setVisible(false);
    const pauseDim=this.add.rectangle(0,0,GAME_WIDTH,GAME_HEIGHT,0x07120d,.66).setOrigin(0).setInteractive();
    const pw=d?420:GAME_WIDTH-88, ph=d?430:460, top=(GAME_HEIGHT-ph)/2, cx=GAME_WIDTH/2;
    const panel=this.add.image(cx,GAME_HEIGHT/2,'ui_war_panel').setDisplaySize(pw,ph).setInteractive();
    const pauseTitle=this.add.text(cx,top+34,'战斗暂停',warText(27,'#e8cf91')).setOrigin(.5);
    const pauseHint=this.add.text(cx,top+66,'稍歇片刻 · 战斗进度已暂停',warText(13,'#91ab98')).setOrigin(.5);
    const resumeY=top+114;
    const resume=this.add.image(cx,resumeY,'ui_war_button').setDisplaySize(pw-64,50).setInteractive({useHandCursor:true}).setName('pause-resume');
    const resumeText=this.add.text(cx,resumeY,'继续战斗',warText(21,'#17281d')).setOrigin(.5);
    resume.on('pointerdown',()=>this.togglePause()).on('pointerover',()=>resume.setTint(0xffe8ad)).on('pointerout',()=>resume.clearTint());
    const bgmRow=this.createVolumeRow('战场音乐',top+191,this.music.getVolume(),v=>this.music.setVolume(v));
    const sfxRow=this.createVolumeRow('战斗音效',top+263,this.sfx.getVolume(),v=>this.sfx.setVolume(v));
    const exit=this.add.text(cx,top+ph-65,'返回选将',warText(16,'#b5c4b2')).setOrigin(.5).setPadding(24,12).setInteractive({useHandCursor:true}).setName('pause-exit');
    exit.on('pointerdown',()=>{
      if(exit.getData('confirm')){this.registry.remove('campaignTransfer');this.scene.start(this.worldCampaign&&worldUnlocked()?'CityScene':'MenuScene');}
      else exit.setData('confirm',true).setText('确认离开？本局进度不保留').setColor('#e7b68e');
    });
    const keys=this.add.text(cx,top+ph-22,d?'Esc / P 继续战斗':'战斗已冻结 · 点击「继续战斗」恢复',warText(12,'#7f9987')).setOrigin(.5);
    this.pausePanel.add([pauseDim,panel,pauseTitle,pauseHint,resume,resumeText,...bgmRow,...sfxRow,exit,keys]);

    this.recruitViews = [];
    this.recruitPanel = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay).setVisible(false);
    const recDim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8).setOrigin(0, 0).setInteractive();
    const recTitle = this.add
      .text(GAME_WIDTH / 2, d ? 40 : 120, '蜀军招募 · 三选一', { fontFamily: FONT, fontSize: d ? '22px' : '24px', color: '#e8c76a' })
      .setOrigin(0.5);
    this.recruitCountText = this.add
      .text(GAME_WIDTH / 2, d ? 70 : 158, '', { fontFamily: FONT, fontSize: d ? '13px' : '15px', color: '#d8c9ae' })
      .setOrigin(0.5);
    this.recruitPanel.add([recDim, recTitle, this.recruitCountText]);
    const rYs = d ? [150, 300, 450] : [300, 470, 640];
    for (let i = 0; i < 3; i += 1) {
      const y = rYs[i];
      const bg = this.add.image(GAME_WIDTH / 2, y, 'ui_war_card').setDisplaySize(d ? 460 : 400, d ? 120 : 145).setInteractive({ useHandCursor: true });
      const icon = this.add.image(GAME_WIDTH / 2 - (d ? 160 : 135), y, 'shu_swordsman_walk_sheet', 'down_0').setDisplaySize(54, 54);
      const name = this.add.text(GAME_WIDTH / 2 + (d ? 20 : 10), y - 26, '', { fontFamily: FONT, fontSize: d ? '20px' : '22px', color: '#f5efe6' }).setOrigin(0.5);
      const desc = this.add.text(GAME_WIDTH / 2 + (d ? 20 : 10), y + 18, '', { fontFamily: FONT, fontSize: d ? '13px' : '15px', color: '#d8c9ae' }).setOrigin(0.5);
      const tag = this.add.text(GAME_WIDTH / 2 + (d ? 150 : 120), y - 38, '', { fontFamily: FONT, fontSize: d ? '12px' : '13px' }).setOrigin(0.5).setPadding(6, 2, 6, 2);
      this.recruitPanel.add([bg, icon, name, desc, tag]);
      this.recruitViews.push({ bg, name, desc, icon, tag });
    }

    this.resultPanel = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay).setVisible(false);
    const rDim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.82).setOrigin(0, 0).setInteractive();
    const rTitle = this.add
      .text(GAME_WIDTH / 2, d ? 74 : 220, '', { fontFamily: FONT, fontSize: d ? '40px' : '46px', color: '#e8c76a' })
      .setOrigin(0.5);
    const rSub = this.add
      .text(GAME_WIDTH / 2, d ? 120 : 292, '', { fontFamily: FONT, fontSize: d ? '13px' : '15px', color: '#a89c8c' })
      .setOrigin(0.5);
    const rBody = this.add
      .text(GAME_WIDTH / 2, d ? 156 : 370, '', { fontFamily: FONT, fontSize: d ? '16px' : '19px', color: '#f5efe6', align: 'left', lineSpacing: d ? 9 : 16 })
      .setOrigin(0.5, 0);
    const btn = this.add
      .image(GAME_WIDTH / 2, d ? 468 : 700, 'ui_war_button')
      .setDisplaySize(d ? 240 : 280, d ? 72 : 84)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add
      .text(GAME_WIDTH / 2, d ? 468 : 700, '再来一局', { fontFamily: FONT, fontSize: d ? '20px' : '22px', color: '#2a1c0c' })
      .setOrigin(0.5);
    btn.on('pointerdown', () => this.scene.restart());
    const selectChapter = this.add.text(GAME_WIDTH / 2, d ? 522 : 802, this.worldCampaign&&worldUnlocked()?this.chapter.stage===3&&this.victory?'三国天下开启':'返回主城':'返回选关', { fontFamily: FONT, fontSize: '16px', color: '#e8c76a' })
      .setOrigin(.5).setPadding(18, 6).setInteractive({ useHandCursor: true });
    selectChapter.setName('result-home').on('pointerdown', () => this.scene.start(this.worldCampaign&&worldUnlocked()?(this.registry.get('worldReveal')?'WorldMapScene':'CityScene'):'MenuScene'));
    if(this.worldCampaign)btnText.setText('再次出征');
    const resultFrame = this.add.image(GAME_WIDTH/2,d ? 255 : 450,'ui_war_panel').setDisplaySize(d ? 600 : GAME_WIDTH-64,d ? 440 : 620);
    this.resultPanel.add([rDim,resultFrame,rTitle,rSub,rBody,btn,btnText,selectChapter]);
    this.resultTexts = { title: rTitle.setResolution(2), subtitle: rSub.setResolution(2), body: rBody.setResolution(2) };

    // 相机跟随会导致容器子元素的输入命中偏移，逐个子元素固定 scrollFactor(0)。
    const fixInput = (container: Phaser.GameObjects.Container): void => {
      for (const child of container.list) {
        (child as unknown as { setScrollFactor: (v: number) => void }).setScrollFactor(0);
      }
    };
    fixInput(this.levelPanel);
    fixInput(this.pausePanel);
    fixInput(this.resultPanel);
    fixInput(this.recruitPanel);
  }

  // ---------------- 性能测试模式（?perf=1，仅 DEV） ----------------

  protected installDevelopment(): void {}
  protected disposeDevelopment(): void {}
  protected updatePerf(_dt: number): void {}
  protected onRunFinished(_stats: RunStats): void {}
}
