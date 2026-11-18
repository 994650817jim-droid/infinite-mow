import Phaser from 'phaser';
import {EnemyCamps} from '../systems/EnemyCamps';
import {GameScene} from './GameScene';
import {GuanduBoss} from '../systems/GuanduBoss';
import {guanduBattle, GUANDU_STAGES, GUANDU_PLAYABLE, GUANDU_ATLAS_FILES, type GuanduStage} from '../data/guanduChapter';
import {isChapterTestRun} from '../systems/ChapterProgress';
import {abandonExpedition, arcStageUnlocked, beginArcExpedition, settleArcExpedition, permanentEffects, takeExpeditionReserve} from '../world/WorldStore';
import {packCampaign, type CampaignTransfer} from '../systems/Campaign';
import {applyCitySpecialties} from '../systems/CityBonuses';
import {cityIncomeLine} from '../world/WorldStore';
import {guanduScenery} from '../systems/GuanduScenery';
import {SishuiObstacles} from '../systems/SishuiObstacles';
import {GrainDepots} from '../systems/GrainDepots';
import {ensureYuanTextures} from '../systems/YuanPalette';
import {guanduYuanSourceKeys} from '../data/guanduChapter';
import type {Enemy} from '../entities/Enemy';
import type {RunEndReason} from '../types';
import type {RunConfig} from '../data/characters';
import { loadBossSheet } from '../systems/ArtStyle';

/** 第四章已开放的最后一关（P1 为 4-1）；打完它即返回天下地图。 */
const LAST_PLAYABLE = Math.min(3, GUANDU_PLAYABLE) as GuanduStage;

/**
 * 第四章 · 官渡之战 战斗场景。结构与第三章 ThirdGameScene 相同（出征 / 结算 / 休整 / 跨关继承 / 敌营），
 * 独立成类以保证第三章行为不受影响；进度写入 WorldStore 的 guandu 篇章。
 */
export function guanduGameSceneClass(Base: typeof GameScene) {
  return class GuanduGameScene extends Base {
    protected achievementArc() { return 'guandu'; }
    protected padTargets() { return [...(this.enemyCamps?.padTargets() ?? []), ...(this.depots?.padTargets() ?? [])]; }
    protected padClearTargets() { this.enemyCamps?.cancel(); this.depots?.cancel(); }
    private enemyCamps?: EnemyCamps;
    /** 焚粮目标（粮垛 / 辎重车）。 */
    private depots?: GrainDepots;
    private guanduStage: GuanduStage = 1; private controller?: GuanduBoss; private receipt = ''; private test = false;
    /** 马厩赠马键（见 data/mounts.ts HORSES.reward）。 */
    protected stableRewardKey(): string | null { return 'guandu-' + this.guanduStage; }
    constructor() { super('GuanduGameScene'); }
    preload() { for (const [key, url] of Object.entries(GUANDU_ATLAS_FILES)) if (!this.textures.exists(key)) loadBossSheet(this.load, key, url); }
    create() {
      this.guanduStage = (this.registry.get('guanduStage') ?? 1) as GuanduStage; this.test = isChapterTestRun();
      // 袁军配色贴图须在任何敌兵生成前就绪
      const yuanKeys = ensureYuanTextures(this, guanduYuanSourceKeys());
      if (!GUANDU_STAGES[this.guanduStage - 1] || !this.test && (this.guanduStage > LAST_PLAYABLE || !arcStageUnlocked('guandu', this.guanduStage))) { this.scene.start('WorldMapScene'); return; }
      const saved = this.registry.get('runConfig') as RunConfig | undefined, transfer = this.registry.get('guanduTransfer') as CampaignTransfer | undefined;
      this.registry.remove('guanduTransfer'); this.registry.remove('campaignTransfer');
      if (transfer && transfer.character === saved?.character) this.registry.set('campaignTransfer', transfer);
      // encounter 'qunxiong' 表示“群雄篇章式战斗”（由 customChapter 提供关卡），GameScene 据此走自定义章节路径。
      this.registry.set('runConfig', {...saved, character: saved?.character ?? 'zhaoyun', chapter: 'hulao', westStage: 3, encounter: 'qunxiong'});
      super.create();
      this.controller = undefined; this.chapter = guanduBattle(this.guanduStage); this.runConfig = {...this.runConfig, encounter: 'qunxiong'};
      this.receipt = this.test ? '' : beginArcExpedition('guandu', this.guanduStage, this.allies.filter(u => u.active && u.reserveSoldier).map(u => u.kind));
      const effect = permanentEffects(); this.legion.healingMultiplier = effect.healMultiplier; applyCitySpecialties(this.player, effect, !transfer, {legion: this.legion, supplies: this.supplies});
      if (!transfer) {
        for (let i = 0; i < effect.reinforcements; i++) this.legion.recruit(i === 0 ? 'swordsman' : 'spearman', 1, true);
        if (!this.test) for (const kind of takeExpeditionReserve(effect.reserveSlots)) { this.legion.recruit(kind, 1, true); this.allies[this.allies.length - 1].reserveSoldier = true; }
      }
      this.battlefieldDetails.useStructuredLayout(); if (this.supplies) this.supplies.randomGeneration = false;
      const art = guanduScenery(this, this.guanduStage, (frame, x, y, size) => this.spawnSceneProp(frame, x, y, size));
      this.ground.setTexture(art.key).setTileScale(1);
      this.sishuiObstacles = new SishuiObstacles(); this.sishuiObstacles.footprints.splice(0, this.sishuiObstacles.footprints.length, ...art.boxes);
      this.enemyCamps = new EnemyCamps({scene: this, player: this.player, create: (x, y, hp) => this.supplies?.spawnCamp(x, y, hp) ?? null, spawn: (kind, x, y) => this.spawnEnemy(kind, x, y, 1), support: () => this.legion.grid.query(this.player.x, this.player.y, 260), reward: n => { this.legion.food += n; }}, art.camps, this.combatNow);
      this.legion.campTarget = u => this.enemyCamps?.assist(u) ?? null;
      this.depots = new GrainDepots({scene: this, player: this.player, create: (x, y, hp, frame, size) => this.supplies?.spawnDepot(x, y, hp, frame, size) ?? null, reward: n => { this.legion.food += n; }}, art.depots);
      const keys = (this.registry.get('battleTextureKeys') ?? []) as string[];
      this.registry.set('battleTextureKeys', [...new Set([...keys, ...Object.keys(GUANDU_ATLAS_FILES), art.key, art.roadKey, ...yuanKeys])]);
      this.hudTexts.chapter.setText(this.chapter.name);
      this.setupStory('guandu', this.guanduStage); // 剧情第四章（基类按 encounter 没建）：关前过场 / 幕间 / 军情
      this.events.once('shutdown', () => { this.depots?.clear(); this.depots = undefined; this.enemyCamps?.clear(); this.enemyCamps = undefined; this.controller?.clear(); this.controller = undefined; });
    }
    protected abandonRun() { if (!this.over) abandonExpedition(this.receipt, this.allies.filter(u => u.active && u.reserveSoldier).map(u => u.kind)); }
    /** 点选敌营或粮草设为优先目标（两者互斥）。 */
    protected handleBattlePointer(pointer: Phaser.Input.Pointer) {
      if (this.mode !== 'none' || this.over) return false;
      if (this.depots?.pointer(pointer)) { this.enemyCamps?.cancel(); return true; }
      return this.enemyCamps?.pointer(pointer) ?? false;
    }
    // 2026-11-16 修：原来营寨 / 粮仓不在射程时返回 null，首领 / 精锐优先被整个吃掉（黄忠宝雕弓在 3-3、5-3 对首领 0 伤害），改为退回基类的首领 > 精锐
    protected priorityWeaponTarget(range: number, bodyRadius = true) { return this.enemyCamps?.target(range, bodyRadius) ?? this.depots?.target(range, bodyRadius) ?? super.priorityWeaponTarget(range, bodyRadius); }
    protected tryCustomBossSkill() { if (!this.controller || !this.boss?.active) return false; this.controller.forceSkill(this.combatNow); return true; }
    protected customChapter() { return guanduBattle(this.guanduStage); }
    protected spawnBoss() {
      super.spawnBoss();
      if (this.boss) this.controller = new GuanduBoss({scene: this, boss: this.boss, player: this.player, army: this.legion, spawn: (kind, x, y) => this.spawnEnemy(kind, x, y, 1, true),
        morale: () => ({multiplier: this.depots?.moraleMultiplier ?? 1, burned: this.depots?.burned ?? 0, intact: this.depots?.intact ?? 0}),
        depots: this.depots}, this.guanduStage, this.combatNow);
    }
    protected customBossStep(enemy: Enemy, dt: number, now: number) { if (enemy !== this.boss || !this.controller) return false; this.controller.update(dt, now); return true; }
    protected hitEnemy(enemy: Enemy, raw: number, now: number, source: 'melee' | 'arrow' | 'fire' = 'melee', ally = false, weaponHit = true) { if (enemy === this.boss && this.controller) { raw *= this.controller.incoming(ally); this.controller.hit(now); } return super.hitEnemy(enemy, raw, now, source, ally, weaponHit); }
    /** 官渡首领控制器自己播倒地帧。 */
    protected bossHasDeathArt() { return !!this.controller; }
    protected killEnemy(enemy: Enemy) { if (this.depots?.onDestroyed(enemy, this.combatNow) && this.boss?.active && this.guanduStage === 3) this.controller?.shaken(this.combatNow); this.enemyCamps?.onDestroyed(enemy, this.combatNow); if (enemy === this.boss) this.controller?.defeat(); super.killEnemy(enemy); }
    update(time: number, delta: number) {
      const before = this.combatNow; super.update(time, delta);
      if (this.combatNow > before && !this.over && this.mode === 'none') { if (!this.awaitingChest) this.enemyCamps?.update(this.combatNow); this.depots?.update(this.combatNow); }
      this.controller?.updateDeath(delta);
      if (this.boss?.active && this.controller) this.hudTexts.bossEnergy.setText(this.controller.label + (this.legion.count > 12 ? ' · 军势护阵' : ''));
    }
    protected renderRecruit() { if (this.resting) { this.campUI?.open('guandu-' + this.guanduStage, GUANDU_STAGES[this.guanduStage]?.name ?? '返回天下地图'); return; } super.renderRecruit(); }
    protected continueCampaign() {
      if (!this.resting || this.mode !== 'rest' || this.guanduStage >= LAST_PLAYABLE) return;
      const next = (this.guanduStage + 1) as GuanduStage; if (!this.test && !arcStageUnlocked('guandu', next)) return;
      const transfer = packCampaign(this.runConfig.character, this.player, this.legion); transfer.chapter = 'hulao';
      this.registry.set('guanduTransfer', transfer); this.registry.set('guanduStage', next); this.resting = false; this.scene.restart();
    }
    protected finish(victory: boolean, reason: RunEndReason = 'death') {
      if (this.over) return; super.finish(victory, reason);
      const lastLeg = this.guanduStage >= LAST_PLAYABLE;
      const reward = settleArcExpedition('guandu', this.receipt, {victory, bossKilled: this.bossKilled, kills: this.kills, elapsed: this.elapsed, debug: this.test || this.debugModified || this.debugJumped || this.player.damageImmune, returned: !victory || lastLeg ? this.allies.filter(u => u.active && u.reserveSoldier).map(u => u.kind) : []});
      this.controller?.clear();
      this.resultTexts.subtitle.setText(victory ? this.chapter.victoryText : '率部退守，整军再战');
      this.resultTexts.body.setText(this.resultTexts.body.text + '\n永久奖励 · 军粮 +' + reward.provisions + cityIncomeLine(reward));
      const home = this.resultPanel.getByName('result-home') as Phaser.GameObjects.Text;
      home?.setText(victory ? '返回天下地图' : '返回主菜单').removeAllListeners('pointerdown').on('pointerdown', () => { this.registry.remove('campaignTransfer'); this.registry.remove('guanduTransfer'); this.scene.start(victory ? 'WorldMapScene' : 'MenuScene'); });
      const restart = this.resultPanel.getByName('result-restart') as Phaser.GameObjects.Image;
      restart?.removeAllListeners('pointerdown').on('pointerdown', () => { this.registry.remove('guanduTransfer'); this.registry.remove('campaignTransfer'); this.scene.restart(); });
      if (victory && !lastLeg) { this.pendingLevels = 0; this.pendingRecruit = false; this.freeRecruit = false; this.resting = true; this.player.hp = this.player.maxHp; this.legion.recover(); this.renderRecruit(); this.setMode('rest'); }
    }
  };
}
