import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { thirdGameSceneClass, type ArcSceneConfig } from './ThirdGameScene';
import { SHU_STAGES, SHU_TROOPS, shuArt, shuBattle, shuBossSheet, shuBossTexture, SHU_OPENING, luofengOpening, luofengEnding, SHU_ENDING, type ShuStage } from '../data/shuChapter';
import { MountainPass } from '../systems/MountainPass';
import { SiegeMidCity } from '../systems/SiegeMidCity';
import { loadMidSiegeArt } from '../systems/SiegeMidArt';
import { MID_SIEGE } from '../data/siegeMedium';
import { SIEGE_GOALS } from '../data/siege';
import { paintV2Ground } from '../systems/EnvGround';
import { storyScroll } from '../ui/StoryScroll';
import { GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP } from '../config';
import { getCharacter } from '../data/characters';
import { grantCity } from '../world/WorldStore';
import type { Enemy } from '../entities/Enemy';
import type { EnemyKind, RunEndReason } from '../types';

/**
 * 第七章 · 入蜀（数据 data/shuChapter.ts）。三关沿用第三章篇章框架（关间军营休整、首领招式组、倒地 → 宝箱），
 * 7-1 葭萌关、7-2 落凤坡：山道伏击（systems/MountainPass.ts）；7-2 另有剧情危机（庞统随军）；
 * 7-3 成都：攻城中城样板（SiegeMidCity）做成大城简化版，守将刘璋由篇章首领控制器驱动，攻下后成都归我方、接城池建设。
 * 剧情卷轴：章首（7-1 开场）、落凤坡开场与结局、章末（7-3 胜利）。
 */
function shuScenery(scene: Phaser.Scene, stage: number) {
  // 山道：青灰碎石地（有第七章地面图用它，否则用长安夯土压暗过渡）；成都：关中黄土
  const key = 'shu_ground_' + stage, src = scene.textures.exists('shu_ground') ? 'shu_ground' : stage === 3 ? 'ground_v2_guanzhong' : 'ground_v2_changan';
  if (!paintV2Ground(scene, key, src, stage === 3 ? undefined : 'rgba(30,44,30,.28)')) return null;
  return { key, boxes: [], camps: [] };
}
export const SHU_CONFIG: ArcSceneConfig = {
  key: 'ShuGameScene', arc: 'shu', stageKey: 'shuStage', transferKey: 'shuTransfer', stages: SHU_STAGES,
  texture: id => shuBossTexture(id), sheet: id => shuBossSheet(id), battle: s => shuBattle(s as ShuStage), campPrefix: 'shu-', scenery: shuScenery,
};

export function shuGameSceneClass(Base: typeof GameScene) {
  const Arc = thirdGameSceneClass(Base, SHU_CONFIG);
  return class ShuGameScene extends Arc {
    private pass?: MountainPass; private mid?: SiegeMidCity; private shuStage: ShuStage = 1; private pangtongFell = false; private storyDone = false;
    preload() {
      super.preload();
      for (const t of Object.values(SHU_TROOPS)) if (shuArt(t.walk) && !this.textures.exists(t.walk)) this.load.spritesheet(t.walk, t.file, { frameWidth: 176, frameHeight: 176 });
      if (shuArt('shu_pass') && !this.textures.exists('shu_pass')) this.load.spritesheet('shu_pass', 'assets/shu/pass.png', { frameWidth: 384, frameHeight: 384 });
      if (shuArt('shu_ground') && !this.textures.exists('shu_ground')) this.load.image('shu_ground', 'assets/shu/ground.png');
      loadMidSiegeArt(this);
    }
    create() {
      this.pass = undefined; this.mid = undefined; this.pangtongFell = false; this.storyDone = false;
      super.create();
      if (!this.player || this.scene.key !== 'ShuGameScene' || !this.chapter) return;
      this.shuStage = (Number(this.registry.get('shuStage')) || 1) as ShuStage;
      for (const t of Object.values(SHU_TROOPS)) if (this.textures.exists(t.walk)) registerV2Frames(this, t.walk);
      const hero = getCharacter(this.runConfig.character), isPangtong = hero.id === 'pangtong';
      const footprints = this.sishuiObstacles!.footprints as unknown as Array<{ left: number; right: number; top: number; bottom: number }>;
      if (this.shuStage < 3) {
        this.pass = new MountainPass({
          scene: this, player: this.player, allies: () => this.allies, enemies: () => this.enemies, now: () => this.combatNow, footprints,
          spawnEnemy: (kind, x, y, force) => this.spawnEnemy(kind, x, y, 1, force),
          hitEnemy: (e, d) => { this.hitEnemy(e, d, this.combatNow, 'melee', true, false); },
          hurtTroops: (x, y, r, d) => this.legion.hurtArea(x, y, r, d, this.combatNow),
          banner: (t, danger, c) => this.showWaveBanner(t, !!danger, c), sfx: k => this.sfx.play(k),
          crisis: this.shuStage === 2 ? { playerIsPangtong: isPangtong, onFall: () => { this.pangtongFell = true; } } : undefined,
        }, this.shuStage as 1 | 2);
      } else {
        this.player.sprite.setPosition(MID_SIEGE.outside.start.x, MID_SIEGE.outside.start.y);
        const kinds: Array<'swordsman' | 'spearman'> = ['swordsman', 'spearman'];
        this.mid = new SiegeMidCity({
          scene: this, player: this.player, allies: () => this.allies, enemies: () => this.enemies, now: () => this.combatNow, footprints,
          spawnEnemy: (kind, x, y, force) => this.spawnEnemy(kind, x, y, 1, force), advance: (e, nx, ny, dt) => this.advanceEnemy(e, nx, ny, dt),
          spawnTower: (x, y) => { const e = this.supplies?.spawnCamp(x, y, Math.round(SIEGE_GOALS.towerHp * 1.3)) ?? null; e?.sprite.setTexture('sishui_props_refined', 1).setOrigin(.5, 1).setDisplaySize(140, 140).setAlpha(1); return e; },
          spawnBarrel: (x, y) => { this.env?.spawnForTest('barrel', x - this.player.x, y - this.player.y); },
          hurtTroops: (x, y, r, d) => this.legion.hurtArea(x, y, r, d, this.combatNow),
          recruit: n => { for (let i = 0; i < n; i++) this.legion.recruit(kinds[i % 2], 1, true); }, gainFood: n => { this.legion.food += n; },
          banner: (t, danger, c) => this.showWaveBanner(t, !!danger, c), sfx: k => this.sfx.play(k),
          spawnBoss: () => this.spawnBoss(), boss: () => this.boss, campsAlive: () => [0, 0],
          engineLevel: Number(this.registry.get('siegeEngineLevel') ?? 0),
          opts: { externalBoss: true, gateHp: 1900, hallName: '州府', cityName: '成都' },
        });
      }
      // 剧情卷轴：章首 / 落凤坡开场（测试可用 registry shuNoStory 跳过）
      if (!this.registry.get('shuNoStory')) {
        if (this.shuStage === 1) this.story('shu-opening', '第七章 · 入蜀', '刘璋迎刘备入川', SHU_OPENING, '整军入蜀');
        if (this.shuStage === 2) this.story('shu-luofeng', '第七章 · 入蜀 · 落凤坡', '凤雏之危', luofengOpening(isPangtong, hero.name), '护住凤雏');
      }
      this.events.once('shutdown', () => { this.pass?.clear(); this.pass = undefined; this.mid?.clear(); this.mid = undefined; });
    }
    /** 战中剧情卷轴：冻结战斗，看完继续。 */
    private story(name: string, kicker: string, title: string, lines: { who?: string; text: string }[], confirm: string, after?: () => void) {
      // 结算后战斗计时器已暂停（delayedCall 不会触发）：直接弹；开场时等一帧再弹
      const show = () => {
        const wasMode = this.mode; if (!this.over) this.setMode('story');
        storyScroll(this, GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP, { name, confirmName: name + '-confirm', kicker, title, lines, reward: '', confirm, background: 'rest_camp',
          onDone: () => { this.children.getByName(name)?.destroy(); if (!this.over && this.mode === 'story') this.setMode(wasMode === 'story' ? 'none' : wasMode); this.storyDone = true; after?.(); } });
      };
      if (this.over) show(); else this.time.delayedCall(60, show);
    }
    /** 刷兵：山道只从前后来；成都按攻城分段。 */
    protected spawnAroundPlayer(kind: EnemyKind, force = false): Enemy | null {
      if (this.pass) { const p = this.pass.spawnPoint(); return this.spawnEnemy(kind, p.x, p.y, undefined, force); }
      if (this.mid) { const p = this.mid.spawnPoint(kind); return p ? this.spawnEnemy(kind, p.x, p.y, undefined, force) : null; }
      return super.spawnAroundPlayer(kind, force);
    }
    protected customEnemyStep(enemy: Enemy, dt: number, now: number, target: { x: number; y: number }) {
      if (this.mid?.steer(enemy, dt)) return true;
      return super.customEnemyStep(enemy, dt, now, target);
    }
    /** 成都：守将只在州府段出场。 */
    protected spawnBoss() { if (this.mid && this.mid.phase !== 'hall') return; super.spawnBoss(); }
    protected hitEnemy(enemy: Enemy, raw: number, now: number, source: 'melee' | 'arrow' | 'fire' = 'melee', ally = false, weaponHit = true) {
      if (enemy === this.boss && this.mid) raw *= this.mid.bossDamageMul(); if (this.mid) raw *= this.mid.outgoingMul(); // 城内武库已占：我军伤害 +8%
      return super.hitEnemy(enemy, raw, now, source, ally, weaponHit);
    }
    protected killEnemy(enemy: Enemy) { this.mid?.onKilled(enemy); super.killEnemy(enemy); }
    update(time: number, delta: number) {
      const before = this.combatNow; super.update(time, delta);
      if (this.combatNow > before && !this.over && this.mode === 'none') { const dt = (this.combatNow - before) / 1000; this.pass?.update(dt); this.mid?.update(dt); }
    }
    protected finish(victory: boolean, reason: RunEndReason = 'death') {
      if (this.over) return;
      // 成都：击败刘璋、捡完宝箱后先在州府插旗，再结算
      if (this.mid && victory && this.mid.phase !== 'done') { this.setMode('none'); this.mid.plantFinalFlag(() => this.finish(true, reason)); return; }
      super.finish(victory, reason);
      if (!victory || this.registry.get('shuNoStory') === 'all') return;
      const hero = getCharacter(this.runConfig.character);
      if (this.shuStage === 2) this.story('shu-luofeng-end', '第七章 · 入蜀 · 落凤坡', this.pangtongFell ? '凤雏陨落' : '凤雏得救', luofengEnding(!this.pangtongFell, hero.id === 'pangtong', hero.name), '继续进军');
      if (this.shuStage === 3) {
        const fresh = grantCity('chengdu');
        this.resultTexts.body.setText(this.resultTexts.body.text + (fresh ? '\n成都归入义军版图 · 可建设城池' : ''));
        const home = this.resultPanel.getByName('result-home') as Phaser.GameObjects.Text;
        // 攻下成都接城池建设：有 CityBuildScene 场景就进，没有先回天下地图聚焦成都（同攻城中城）
        home?.setText('建设城池').removeAllListeners('pointerdown').on('pointerdown', () => { this.registry.set('cityBuildTarget', 'chengdu'); this.registry.set('mapFocusCity', 'chengdu'); this.scene.start(this.scene.manager.keys['CityBuildScene'] ? 'CityBuildScene' : 'WorldMapScene'); });
        this.story('shu-ending', '第七章 · 入蜀 · 终', '刘璋出降 · 益州归附', SHU_ENDING, '展开天下地图');
      }
    }
    /** 测试用状态。 */
    get shuState() { return { stage: this.shuStage, pass: this.pass ? { ...this.pass.stats, halfW: this.pass.halfW, pangtong: this.pass.pangtong } : null, mid: this.mid ? { phase: this.mid.phase, gate: Math.round(this.mid.gateHp) } : null, pangtongFell: this.pangtongFell, storyDone: this.storyDone, boss: this.boss?.active ? this.boss.sprite.texture.key : null }; }
    get shuPass() { return this.pass ?? null; }
    get shuMid() { return this.mid ?? null; }
  };
}

/** 第七章新兵种图（v2 4×4、176 格、行 = 下 / 左 / 右 / 上）：登记 down_0… 帧名，和其他 v2 小兵一致。 */
function registerV2Frames(scene: Phaser.Scene, key: string) {
  const tex = scene.textures.get(key); if (tex.has('down_0')) return;
  ['down', 'left', 'right', 'up'].forEach((dir, row) => { for (let col = 0; col < 4; col++) tex.add(`${dir}_${col}`, 0, col * 176, row * 176, 176, 176); });
}
