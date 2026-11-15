import Phaser from 'phaser';
import {EnemyCamps} from '../systems/EnemyCamps';
import {GameScene} from './GameScene';
import {GuanduBoss} from '../systems/GuanduBoss';
import {GUANDU_ATLAS_FILES} from '../data/guanduChapter';
import {SIEGE, FIRST_CAPTURE_BONUS, siegeBattle, defenseBattle, siegeLargeKit, siegeSourceKeys} from '../data/siege';
import {isChapterTestRun} from '../systems/ChapterProgress';
import {beginSiege, beginDefense, loadWorld, permanentEffects, settleSiege, settleDefense, takeExpeditionReserve, abandonExpedition} from '../world/WorldStore';
import {cityAttackable, cityAttacker, cityById, cityOwner, eraIndexFor, FACTIONS, TIER_NAME, type CityDef, type FactionId} from '../world/WorldCities';
import {ensureFactionTextures} from '../systems/FactionPalette';
import {applyCitySpecialties} from '../systems/CityBonuses';
import {cityIncomeLine} from '../world/WorldStore';
import {siegeScenery, SIEGE_GATE} from '../systems/SiegeScenery';
import {SishuiObstacles} from '../systems/SishuiObstacles';
import {worldText} from '../world/WorldUI';
import type {Enemy} from '../entities/Enemy';
import type {RunEndReason} from '../types';
import type {RunConfig} from '../data/characters';

/**
 * 攻城战（WORLD_MAP_PLAN.md · W2）：按城市档位的短战。胜利（击败守将 / 大将）即占领该城。
 * 大城须先破城门，大将才会出城（借用第四章首领技能，W5 前为过渡造型）。无关间休整。
 * W4 守城战（registry siegeMode='defense'）：敌势力来犯告急中的我方城池，无城门，击败敌将即守住。
 */
export function siegeGameSceneClass(Base: typeof GameScene) {
  return class SiegeGameScene extends Base {
    protected achievementArc() { return this.defense ? 'defense' : 'siege'; }
    private city!: CityDef; private owner: FactionId = 'han'; private defense = false; private receipt = ''; private test = false;
    private enemyCamps?: EnemyCamps; private controller?: GuanduBoss;
    private gate: Enemy | null = null; private gateLife = 0; private gateLabel?: Phaser.GameObjects.Text; private gateWarned = false;
    constructor() { super('SiegeGameScene'); }
    preload() { for (const [key, url] of Object.entries(GUANDU_ATLAS_FILES)) if (!this.textures.exists(key)) this.load.spritesheet(key, url, {frameWidth: 128, frameHeight: 128}); }
    get gateAlive() { return !!this.gate && this.gate.active && this.gate.spawnId === this.gateLife; }
    create() {
      this.test = isChapterTestRun();
      const city = cityById(String(this.registry.get('siegeCity') ?? '')), s = loadWorld();
      const era = eraIndexFor({hulaoCleared: s.cleared.hulao, warlordStages: s.warlordStages, guanduStages: s.guanduStages});
      this.defense = this.registry.get('siegeMode') === 'defense';
      const alert = city && s.alerts.find(a => a.city === city.id);
      if (!city || (!this.test && (this.defense ? !alert || !s.ownedCities.includes(city.id) : !cityAttackable(city.id, s.ownedCities)))) { this.scene.start('WorldMapScene'); return; }
      // 守城：守军配色换成来犯势力
      this.city = city; this.owner = this.defense ? alert?.attacker ?? cityAttacker(city.id, era, s.ownedCities.filter(c => c !== city.id)) ?? 'caocao' : cityOwner(city.id, era, s.ownedCities);
      // 守军配色须在敌兵生成前就绪
      const paletteKeys = ensureFactionTextures(this, this.owner, siegeSourceKeys());
      const saved = this.registry.get('runConfig') as RunConfig | undefined;
      this.registry.remove('campaignTransfer');
      this.registry.set('runConfig', {...saved, character: saved?.character ?? 'zhaoyun', chapter: 'hulao', westStage: 3, encounter: 'qunxiong'});
      this.gate = null; this.gateLabel = undefined; this.gateWarned = false; this.controller = undefined;
      super.create();
      this.chapter = this.battleDef(); this.runConfig = {...this.runConfig, encounter: 'qunxiong'};
      this.receipt = this.test ? '' : this.defense ? beginDefense(city.id) : beginSiege(city.id, true);
      const effect = permanentEffects(); this.legion.healingMultiplier = effect.healMultiplier; applyCitySpecialties(this.player, effect, true);
      for (let i = 0; i < effect.reinforcements; i++) this.legion.recruit(i === 0 ? 'swordsman' : 'spearman', 1, true);
      if (!this.test) for (const kind of takeExpeditionReserve(effect.reserveSlots)) { this.legion.recruit(kind, 1, true); this.allies[this.allies.length - 1].reserveSoldier = true; }
      this.battlefieldDetails.useStructuredLayout(); if (this.supplies) this.supplies.randomGeneration = false;
      const art = siegeScenery(this, city, (frame, x, y, size) => this.spawnSceneProp(frame, x, y, size));
      this.ground.setTexture(art.key).setTileScale(1);
      this.sishuiObstacles = new SishuiObstacles(); this.sishuiObstacles.footprints.splice(0, this.sishuiObstacles.footprints.length, ...art.boxes);
      this.enemyCamps = new EnemyCamps({scene: this, player: this.player, create: (x, y, hp) => this.supplies?.spawnCamp(x, y, hp) ?? null, spawn: (kind, x, y) => this.spawnEnemy(kind, x, y, 1), support: () => this.legion.grid.query(this.player.x, this.player.y, 260), reward: n => { this.legion.food += n; }}, art.camps, this.combatNow);
      this.legion.campTarget = u => this.enemyCamps?.assist(u) ?? null;
      if (city.tier === 'large' && !this.defense) {
        this.gate = this.supplies?.spawnGate(SIEGE_GATE.x, SIEGE_GATE.y, SIEGE[city.tier].gateHp, SIEGE_GATE.size) ?? null; this.gateLife = this.gate?.spawnId ?? 0;
        this.gateLabel = worldText(this, SIEGE_GATE.x, SIEGE_GATE.y - SIEGE_GATE.size - 8, '', 15, '#ffe1a0').setOrigin(.5).setDepth(36).setStroke('#1a120b', 3);
      }
      const keys = (this.registry.get('battleTextureKeys') ?? []) as string[];
      this.registry.set('battleTextureKeys', [...new Set([...keys, ...Object.keys(GUANDU_ATLAS_FILES), art.key, art.roadKey, ...paletteKeys])]);
      this.hudTexts.chapter.setText(`${this.chapter.name} · ${TIER_NAME[city.tier]}`);
      this.events.once('shutdown', () => { this.enemyCamps?.clear(); this.enemyCamps = undefined; this.controller?.clear(); this.controller = undefined; this.gateLabel?.destroy(); this.gateLabel = undefined; this.gate = null; });
    }
    private battleDef() { return this.defense ? defenseBattle(this.city, this.owner) : siegeBattle(this.city, this.owner); }
    protected customChapter() { return this.city ? this.battleDef() : null; }
    protected abandonRun() { if (!this.over) abandonExpedition(this.receipt, this.allies.filter(u => u.active && u.reserveSoldier).map(u => u.kind)); }
    protected handleBattlePointer(pointer: Phaser.Input.Pointer) { return this.mode === 'none' && !this.over ? (this.enemyCamps?.pointer(pointer) ?? false) : false; }
    /** 城门未破时，城门是武器的优先目标（在刺程内时）。 */
    protected priorityWeaponTarget(range: number, bodyRadius = true) {
      const camp = this.enemyCamps?.target(range, bodyRadius); if (camp) return camp;
      if (this.gateAlive && this.bossTimeReached && Math.hypot(this.gate!.x - this.player.x, this.gate!.y - this.player.y) <= range + (bodyRadius ? this.gate!.radius : 0)) return this.gate;
      return null;
    }
    private get bossTimeReached() { return this.elapsed >= this.chapter.waves[this.chapter.waves.length - 1].start; }
    protected tryCustomBossSkill() { if (!this.controller || !this.boss?.active) return false; this.controller.forceSkill(this.combatNow); return true; }
    protected spawnBoss() {
      // 大城：城门未破，大将不出城
      if (this.city?.tier === 'large' && this.gateAlive) { if (!this.gateWarned) { this.gateWarned = true; this.showWaveBanner('城门紧闭 · 先破城门！', true); } return; }
      super.spawnBoss();
      if (this.boss && this.city.tier === 'large') { const kit = siegeLargeKit(this.city); this.controller = new GuanduBoss({scene: this, boss: this.boss, player: this.player, army: this.legion, spawn: (kind, x, y) => this.spawnEnemy(kind, x, y, 1, true)}, kit.stage, this.combatNow, {atlas: kit.atlas, name: this.chapter.bossName}); }
    }
    /** 中小城守将：近身追击，无特殊技能；大城大将走技能控制器。 */
    protected customBossStep(enemy: Enemy, dt: number, now: number) {
      if (enemy !== this.boss) return false;
      if (this.controller) { this.controller.update(dt, now); return true; }
      const dx = this.player.x - enemy.x, dy = this.player.y - enemy.y, d = Math.hypot(dx, dy) || 1;
      this.advanceEnemy(enemy, d > 48 ? dx / d : 0, d > 48 ? dy / d : 0, dt); return true;
    }
    protected hitEnemy(enemy: Enemy, raw: number, now: number, source: 'melee' | 'arrow' | 'fire' = 'melee', ally = false, weaponHit = true) { if (enemy === this.boss && this.controller) { raw *= this.controller.incoming(ally); this.controller.hit(now); } return super.hitEnemy(enemy, raw, now, source, ally, weaponHit); }
    protected killEnemy(enemy: Enemy) {
      if (enemy === this.gate && enemy.spawnId === this.gateLife) { this.gateLabel?.setText('城门已破！'); this.showWaveBanner('城门已破 · 大将出城！', true); this.time.delayedCall(2200, () => this.gateLabel?.setVisible(false)); }
      this.enemyCamps?.onDestroyed(enemy, this.combatNow); if (enemy === this.boss) this.controller?.defeat(); super.killEnemy(enemy);
    }
    update(time: number, delta: number) {
      const before = this.combatNow; super.update(time, delta);
      if (this.combatNow > before && !this.over && this.mode === 'none') this.enemyCamps?.update(this.combatNow);
      this.controller?.updateDeath(delta);
      if (this.gateLabel && this.gateAlive) {
        const left = this.chapter.waves[this.chapter.waves.length - 1].start + 60 - this.elapsed;
        this.gateLabel.setText(`城门 ${Math.ceil(this.gate!.hp)}/${this.gate!.maxHp}` + (this.bossTimeReached ? ` · ${Math.max(0, Math.ceil(left))}秒内破门` : ''));
      }
      if (this.boss?.active && this.controller) this.hudTexts.bossEnergy.setText(this.controller.label);
    }
    /** 攻城没有关间招募休整：战中招兵照常。 */
    protected finish(victory: boolean, reason: RunEndReason = 'death') {
      if (this.over) return; super.finish(victory, reason);
      const T = SIEGE[this.city.tier];
      if (this.defense) { this.finishDefense(victory, T.reward); return; }
      const reward = settleSiege(this.receipt, {victory, bossKilled: this.bossKilled, debug: this.test || this.debugModified || this.debugJumped || this.player.damageImmune, elapsed: this.elapsed, reward: T.reward, firstBonus: FIRST_CAPTURE_BONUS, returned: this.allies.filter(u => u.active && u.reserveSoldier).map(u => u.kind)});
      this.controller?.clear();
      this.resultTexts.subtitle.setText(victory ? `${this.city.name}归入义军版图${reward.first ? ' · 首次攻占' : ''}` : (reason === 'timeout' && this.gateAlive ? '城门未破 · 攻城失利' : '攻城失利 · 整军再战'));
      this.resultTexts.body.setText(this.resultTexts.body.text + '\n永久奖励 · 军功 +' + reward.merits + ' / 粮草 +' + reward.provisions + cityIncomeLine(reward) + (reward.alert ? `\n${FACTIONS[reward.alert.attacker].name}不甘失地，${this.city.name}告急！` : ''));
      this.mapButtons(victory);
    }
    private finishDefense(victory: boolean, base: {merits: number; provisions: number}) {
      const reward = settleDefense(this.receipt, {victory, bossKilled: this.bossKilled, debug: this.test || this.debugModified || this.debugJumped || this.player.damageImmune, elapsed: this.elapsed, reward: base, returned: this.allies.filter(u => u.active && u.reserveSoldier).map(u => u.kind)});
      this.controller?.clear();
      this.resultTexts.subtitle.setText(victory ? `${this.city.name}守住了 · 告急解除` : `守城失利 · ${this.city.name}仍在告急`);
      this.resultTexts.body.setText(this.resultTexts.body.text + '\n永久奖励 · 军功 +' + reward.merits + ' / 粮草 +' + reward.provisions + cityIncomeLine(reward) + (victory ? '' : '\n城池尚在；若改去别处出征，此城将失守'));
      this.mapButtons(victory);
    }
    private mapButtons(victory: boolean) {
      const home = this.resultPanel.getByName('result-home') as Phaser.GameObjects.Text;
      home?.setText('返回天下地图').removeAllListeners('pointerdown').on('pointerdown', () => { this.registry.set('mapFocusCity', this.city.id); this.scene.start('WorldMapScene'); });
      const restart = this.resultPanel.getByName('result-restart') as Phaser.GameObjects.Image;
      restart?.removeAllListeners('pointerdown').on('pointerdown', () => { if (victory) { this.registry.set('mapFocusCity', this.city.id); this.scene.start('WorldMapScene'); } else this.scene.restart(); });
    }
  };
}
