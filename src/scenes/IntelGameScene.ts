import Phaser from 'phaser';
import {captureLine, tryCapture} from '../systems/RosterStore';
import {EnemyCamps} from '../systems/EnemyCamps';
import {GameScene} from './GameScene';
import {GuanduBoss} from '../systems/GuanduBoss';
import {GUANDU_ATLAS_FILES} from '../data/guanduChapter';
import {siegeSourceKeys} from '../data/siege';
import {ESCORT, bountyKit, intelBattle, BOUNTY_ATLAS_FILES} from '../data/intelBattles';
import {isChapterTestRun} from '../systems/ChapterProgress';
import {beginIntel, intelEvents, permanentEffects, settleIntel, takeExpeditionReserve, abandonExpedition, cityIncomeLine} from '../world/WorldStore';
import {INTEL_INFO, type IntelEvent} from '../world/WorldIntel';
import {cityById, type CityDef} from '../world/WorldCities';
import {ensureFactionTextures} from '../systems/FactionPalette';
import {applyCitySpecialties} from '../systems/CityBonuses';
import {siegeScenery} from '../systems/SiegeScenery';
import {SishuiObstacles} from '../systems/SishuiObstacles';
import {worldText} from '../world/WorldUI';
import {actorDepth, DEPTH, GAME_HEIGHT, GAME_WIDTH} from '../config';
import {QUALITIES, capLootQuality, itemName, rollItem} from '../data/items';
import {addItems} from '../systems/ItemStore';
import type {Enemy} from '../entities/Enemy';
import type {RunEndReason} from '../types';
import type {RunConfig} from '../data/characters';
import { loadBossSheet } from '../systems/ArtStyle';

/**
 * 天下地图 · 军情事件战斗（WorldIntel.ts）：registry 'intelEvent' 为事件 id（测试可传 'intelPreview' 事件对象）。
 * 流寇袭扰 / 名将悬赏：击败寇首 / 名将即告成（名将走第四章首领招式）。
 * 商队护送：商车沿官道北上，玩家在车旁（220px 内）它才前进；车旁 72px 内每个敌兵持续劫掠车辆，车毁即败；抵达即胜。
 * 商车为程序绘制的过渡造型（无独立美术）。
 */
export function intelGameSceneClass(Base: typeof GameScene) {
  return class IntelGameScene extends Base {
    /** 军情战带上当前征程构筑（只读，打完不写回；2026-11-20）。 */
    protected inheritsCampaign() { return true; }
    protected achievementArc() { return 'intel'; }
    /** 掉落品质段：按已开放章节（GameScene.lootChapter 默认），悬赏再 +1 段（2026-11-19 掉落随章节）。 */
    protected itemTier() { return Math.min(4, super.itemTier() + (this.event?.kind === 'bounty' ? 1 : 0)); }
    protected padTargets() { return this.enemyCamps?.padTargets() ?? []; }
    protected padClearTargets() { this.enemyCamps?.cancel(); }
    private event!: IntelEvent; private city!: CityDef; private receipt = ''; private test = false;
    private enemyCamps?: EnemyCamps; private controller?: GuanduBoss;
    // 商队护送
    private cart?: Phaser.GameObjects.Container; private cartBar?: Phaser.GameObjects.Graphics; private cartLabel?: Phaser.GameObjects.Text; private escortHint?: Phaser.GameObjects.Text; private cartPointer?: Phaser.GameObjects.Text;
    private cartHp = 0; private cartStartY = 0; private cartArrived = false; private ambushWave = 0; private cartStopped = false;
    constructor() { super('IntelGameScene'); }
    preload() { for (const [key, url] of Object.entries({...GUANDU_ATLAS_FILES, ...BOUNTY_ATLAS_FILES})) if (!this.textures.exists(key)) loadBossSheet(this.load, key, url); }
    private get escort() { return this.event?.kind === 'escort'; }
    /** 商车劫掠进度等，供测试读取。 */
    get escortState() { return this.cart ? {hp: this.cartHp, progress: this.progress, arrived: this.cartArrived, stopped: this.cartStopped, x: this.cart.x, y: this.cart.y} : null; }
    private get progress() { return this.cart ? Math.min(1, (this.cartStartY - this.cart.y) / ESCORT.distance) : 0; }
    create() {
      this.test = isChapterTestRun();
      const id = String(this.registry.get('intelEvent') ?? ''), preview = this.registry.get('intelPreview') as IntelEvent | undefined;
      const e = intelEvents().find(x => x.id === id) ?? (this.test && preview?.id === id ? preview : undefined), city = e && cityById(e.city);
      if (!e || !city) { this.scene.start('WorldMapScene'); return; }
      this.event = e; this.city = city; this.controller = undefined; this.cart = undefined; this.cartArrived = false; this.ambushWave = 0; this.cartStopped = false;
      // 2026-11-19 全面检查 #3：护送的山贼原用汉军灰白（灰白势力不做敌方染色，看着像友军）→ 与流寇同用黄巾配色，带敌方染色
      const faction = e.kind === 'bandit' || e.kind === 'escort' ? 'yellow' : e.faction;
      const paletteKeys = ensureFactionTextures(this, faction, siegeSourceKeys());
      const saved = this.registry.get('runConfig') as RunConfig | undefined;
      this.registry.remove('campaignTransfer');
      this.registry.set('runConfig', {...saved, character: saved?.character ?? 'zhaoyun', chapter: 'hulao', westStage: 3, encounter: 'qunxiong'});
      super.create();
      this.chapter = intelBattle(e, city); this.runConfig = {...this.runConfig, encounter: 'qunxiong'};
      this.receipt = this.test ? '' : beginIntel(e.id);
      const effect = permanentEffects(); this.legion.healingMultiplier = effect.healMultiplier; applyCitySpecialties(this.player, effect, true, {legion: this.legion, supplies: this.supplies});
      for (let i = 0; i < effect.reinforcements; i++) this.legion.recruit(i === 0 ? 'swordsman' : 'spearman', 1, true);
      if (!this.test) for (const kind of takeExpeditionReserve(effect.reserveSlots)) { this.legion.recruit(kind, 1, true); this.allies[this.allies.length - 1].reserveSoldier = true; }
      this.battlefieldDetails.useStructuredLayout(); if (this.supplies) this.supplies.randomGeneration = false;
      const art = siegeScenery(this, {...city, tier: 'small'}, (frame, x, y, size) => this.spawnSceneProp(frame, x, y, size));
      this.ground.setTexture(art.key).setTileScale(1);
      this.sishuiObstacles = new SishuiObstacles(); this.sishuiObstacles.footprints.splice(0, this.sishuiObstacles.footprints.length, ...art.boxes);
      this.enemyCamps = new EnemyCamps({scene: this, player: this.player, create: (x, y, hp) => this.supplies?.spawnCamp(x, y, hp) ?? null, spawn: (kind, x, y) => this.spawnEnemy(kind, x, y, 1), support: () => this.legion.grid.query(this.player.x, this.player.y, 260), reward: n => { this.legion.food += n; }, tent: this.tentCtx()}, this.escort ? [] : art.camps, this.combatNow);
      this.legion.campTarget = u => this.enemyCamps?.assist(u) ?? null;
      const keys = (this.registry.get('battleTextureKeys') ?? []) as string[];
      this.registry.set('battleTextureKeys', [...new Set([...keys, ...Object.keys(GUANDU_ATLAS_FILES), art.key, art.roadKey, ...paletteKeys])]);
      this.hudTexts.chapter.setText(`${this.chapter.name} · 军情`);
      if (this.escort) this.buildCart();
      this.time.delayedCall(900, () => { if (!this.over) this.showWaveBanner(INTEL_INFO[e.kind].name, false, e.kind === 'escort' ? '守在商车旁它才前进 · 别让敌兵围车' : e.kind === 'bandit' ? '击败寇首 · 平定流寇' : `击败${e.general} · 必得名将兵装`); });
      this.events.once('shutdown', () => { this.enemyCamps?.clear(); this.enemyCamps = undefined; this.controller?.clear(); this.controller = undefined; this.cart = undefined; this.cartBar = undefined; this.cartLabel = undefined; this.escortHint = undefined; this.cartPointer = undefined; });
    }
    protected customChapter() { return this.event && this.city ? intelBattle(this.event, this.city) : null; }
    protected abandonRun() { if (!this.over) abandonExpedition(this.receipt, this.allies.filter(u => u.active && u.reserveSoldier).map(u => u.kind)); }
    protected handleBattlePointer(pointer: Phaser.Input.Pointer) { return this.mode === 'none' && !this.over ? (this.enemyCamps?.pointer(pointer) ?? false) : false; }
    // 2026-11-16 修：原来营寨 / 粮仓不在射程时返回 null，首领 / 精锐优先被整个吃掉（黄忠宝雕弓在 3-3、5-3 对首领 0 伤害），改为退回基类的首领 > 精锐
    protected priorityWeaponTarget(range: number, bodyRadius = true) { return this.enemyCamps?.target(range, bodyRadius) ?? super.priorityWeaponTarget(range, bodyRadius); }
    protected tryCustomBossSkill() { if (!this.controller || !this.boss?.active) return false; this.controller.forceSkill(this.combatNow); return true; }
    protected spawnBoss() {
      if (this.escort) return; // 商队护送不出首领
      super.spawnBoss();
      if (this.boss && this.event.kind === 'bounty') { const kit = bountyKit(this.event.general ?? ''); this.controller = new GuanduBoss({scene: this, boss: this.boss, player: this.player, army: this.legion, spawn: (kind, x, y) => this.spawnEnemy(kind, x, y, 1, true)}, kit.stage, this.combatNow, {atlas: kit.atlas, name: this.chapter.bossName}); }
    }
    protected customBossStep(enemy: Enemy, dt: number, now: number) {
      if (enemy !== this.boss) return false;
      if (this.controller) { this.controller.update(dt, now); return true; }
      const dx = this.player.x - enemy.x, dy = this.player.y - enemy.y, d = Math.hypot(dx, dy) || 1;
      this.advanceEnemy(enemy, d > 48 ? dx / d : 0, d > 48 ? dy / d : 0, dt); return true;
    }
    protected hitEnemy(enemy: Enemy, raw: number, now: number, source: 'melee' | 'arrow' | 'fire' = 'melee', ally = false, weaponHit = true) { if (enemy === this.boss && this.controller) { raw *= this.controller.incoming(ally); this.controller.hit(now); } return super.hitEnemy(enemy, raw, now, source, ally, weaponHit); }
    protected bossHasDeathArt() { return !!this.controller; }
    protected killEnemy(enemy: Enemy) { this.enemyCamps?.onDestroyed(enemy, this.combatNow); if (enemy === this.boss) this.controller?.defeat(); super.killEnemy(enemy); }
    protected checkEnd() {
      if (!this.escort) { super.checkEnd(); return; }
      if (this.over) return;
      if (!this.player.alive || this.cartHp <= 0) this.finish(false, 'death');
      else if (this.cartArrived) this.finish(true, 'boss');
      else if (this.elapsed >= ESCORT.timeLimit) this.finish(false, 'timeout');
    }
    // —— 商车（程序绘制的过渡造型）——
    private buildCart() {
      this.cartHp = ESCORT.hp; this.cartStartY = 70; this.bossWarned = true;
      const g = this.add.graphics();
      g.fillStyle(0x000000, .28).fillEllipse(0, 4, 70, 16);
      g.fillStyle(0x3b2616).fillCircle(-20, -2, 11).fillCircle(20, -2, 11); g.fillStyle(0x8a6a44).fillCircle(-20, -2, 5).fillCircle(20, -2, 5);
      g.fillStyle(0x6e4a2a).fillRect(-32, -26, 64, 18).lineStyle(2, 0x2a1a0e).strokeRect(-32, -26, 64, 18);
      g.fillStyle(0xcbb27a).fillRoundedRect(-26, -46, 22, 21, 4).fillStyle(0xb69a5e).fillRoundedRect(-2, -48, 24, 23, 4).fillStyle(0xd9c58e).fillRoundedRect(-14, -60, 22, 16, 4);
      g.lineStyle(2, 0x5c4022).lineBetween(32, -18, 48, -14);
      g.lineStyle(2, 0x3a2716).lineBetween(26, -48, 26, -86); g.fillStyle(0x3f8f6a).fillRect(26, -86, 24, 18);
      const flag = worldText(this, 38, -77, '商', 13, '#f4f0d6').setOrigin(.5);
      this.cart = this.add.container(0, this.cartStartY, [g, flag]).setName('escort-cart');
      this.cartBar = this.add.graphics().setName('escort-cart-bar');
      this.cartLabel = worldText(this, 0, 0, '', 13, '#e9f6dc').setOrigin(.5).setStroke('#10170f', 3).setName('escort-cart-label');
      // 终点：城门（复用汜水关场景道具）与目的地名
      const goal = this.cartStartY - ESCORT.distance;
      if (this.textures.exists('sishui_props_refined')) this.add.image(0, goal + 40, 'sishui_props_refined', 0).setOrigin(.5, 1).setDisplaySize(260, 260).setDepth(actorDepth(goal + 40));
      worldText(this, 0, goal + 60, `${this.city.name} · 商队终点`, 16, '#ffe1a0').setOrigin(.5).setStroke('#1a120b', 4).setDepth(36);
      this.cartPointer = worldText(this, 0, 0, '', 14, '#bff0c8').setOrigin(.5).setScrollFactor(0).setDepth(DEPTH.hud + 1).setStroke('#10170f', 4).setName('escort-pointer').setVisible(false);
      // 提示放在底部中央（顶部中央与商车头顶的血条 / 行程字重叠）
      this.escortHint = worldText(this, GAME_WIDTH / 2, GAME_HEIGHT - (GAME_WIDTH > 600 ? 70 : 150), '', 15, '#ffd98a').setOrigin(.5, 1).setScrollFactor(0).setDepth(DEPTH.hud + 1).setStroke('#1a120b', 4).setName('escort-hint');
      this.drawCart();
    }
    private drawCart() {
      const c = this.cart; if (!c || !this.cartBar || !this.cartLabel) return;
      c.setDepth(actorDepth(c.y + 6));
      const w = 64, ratio = Math.max(0, this.cartHp / ESCORT.hp);
      this.cartBar.clear().setDepth(actorDepth(c.y) + 1).fillStyle(0x140d08, .85).fillRect(c.x - w / 2 - 1, c.y - 104, w + 2, 8).fillStyle(ratio > .5 ? 0x6fcf7a : ratio > .25 ? 0xe2b14a : 0xd65a3f).fillRect(c.x - w / 2, c.y - 103, w * ratio, 6);
      this.cartLabel.setPosition(c.x, c.y - 118).setDepth(actorDepth(c.y) + 1).setText(`商车 ${Math.ceil(this.cartHp)}/${ESCORT.hp} · 行程 ${Math.round(this.progress * 100)}%`);
      // 商车在屏幕外：屏幕边缘箭头指向商车
      const v = this.cameras.main.worldView, sx = (c.x - v.x) / v.width * GAME_WIDTH, sy = (c.y - 40 - v.y) / v.height * GAME_HEIGHT, off = sx < 0 || sx > GAME_WIDTH || sy < 0 || sy > GAME_HEIGHT;
      if (this.cartPointer) { const dx = sx - GAME_WIDTH / 2, dy = sy - GAME_HEIGHT / 2, arrow = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '▶' : '◀') : (dy > 0 ? '▼' : '▲'); this.cartPointer.setVisible(off && !this.cartArrived).setText(arrow === '◀' || arrow === '▲' ? `${arrow} 商车` : `商车 ${arrow}`).setPosition(Phaser.Math.Clamp(sx, 50, GAME_WIDTH - 50), Phaser.Math.Clamp(sy, 170, GAME_HEIGHT - 200)); }
      this.escortHint?.setText(this.cartArrived ? '' : this.cartStopped ? '商车停步 · 回到商车旁护送' : `护送商队 · 距${this.city.name} ${Math.round((1 - this.progress) * 100)}%`).setColor(this.cartStopped ? '#ff9a72' : '#ffd98a');
    }
    private updateCart(dt: number) {
      const c = this.cart; if (!c || this.cartArrived) return;
      const near = Math.hypot(this.player.x - c.x, this.player.y - c.y) <= ESCORT.near; this.cartStopped = !near;
      if (near) c.y -= ESCORT.speed * dt;
      let raiders = 0; for (const e of this.enemies) if (e.active && Math.hypot(e.x - c.x, e.y - c.y) <= ESCORT.raidRadius) raiders++;
      if (raiders) this.cartHp = Math.max(0, this.cartHp - Math.min(raiders, ESCORT.raidCap) * ESCORT.raidDps * dt);
      // 第 2 / 3 波：山贼在商车前方拦路
      const wave = this.chapter.waves.filter(w => this.elapsed >= w.start).length - 1;
      if (wave > this.ambushWave) { this.ambushWave = wave; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * .32; this.spawnEnemy(i % 3 ? 'infantry' : 'shield', c.x + Math.cos(a) * 300, c.y + Math.sin(a) * 300, undefined, true); } }
      if (this.progress >= 1) { this.cartArrived = true; this.showWaveBanner(`商队抵达${this.city.name}`, false); }
      this.drawCart();
    }
    update(time: number, delta: number) {
      const before = this.combatNow; super.update(time, delta);
      const dt = (this.combatNow - before) / 1000;
      if (dt > 0 && !this.over && this.mode === 'none') { if (!this.awaitingChest) this.enemyCamps?.update(this.combatNow); if (this.escort) this.updateCart(dt); }
      this.controller?.updateDeath(delta);
      if (this.boss?.active && this.controller) this.hudTexts.bossEnergy.setText(this.controller.label);
    }
    protected finish(victory: boolean, reason: RunEndReason = 'death') {
      if (this.over) return; super.finish(victory, reason);
      const e = this.event, debug = this.test || this.debugModified || this.debugJumped || this.player.damageImmune;
      const success = victory && (this.escort ? this.cartArrived : this.bossKilled), lost = this.escort && this.cartHp <= 0;
      const r = settleIntel(this.receipt, {success, lost, victory, debug, elapsed: this.elapsed, returned: this.allies.filter(u => u.active && u.reserveSoldier).map(u => u.kind)});
      this.controller?.clear(); this.escortHint?.setText(''); this.cartPointer?.setVisible(false);
      let loot = '';
      if (r.item && !debug) { const q = capLootQuality(Math.random() < r.item.orangeChance ? 'orange' : r.item.quality, this.itemTier()), it = rollItem(q, Math.random, undefined, this.lootChapter()); addItems([it]); loot = ` · 兵装 ${QUALITIES[q].label}「${itemName(it)}」入行囊`; }
      this.resultTexts.subtitle.setText(success ? this.chapter.victoryText : lost ? '商车被劫 · 此事作罢' : `${INTEL_INFO[e.kind].name}未成 · 期限内可再战`);
      this.resultTexts.body.setText(this.resultTexts.body.text + '\n军情 · 军粮 +' + r.provisions + loot + cityIncomeLine(r) + captureLine(success && e.kind === 'bounty' && (!debug || (this.test && !this.debugModified && !this.debugJumped && !this.player.damageImmune && new URLSearchParams(location.search).get('roster') === '1')) ? tryCapture('bounty', e.general ?? '', e.faction) : null) + (debug ? '\n' + r.message : ''));
      const home = this.resultPanel.getByName('result-home') as Phaser.GameObjects.Text;
      home?.setText('返回天下地图').removeAllListeners('pointerdown').on('pointerdown', () => { this.registry.set('mapFocusCity', this.city.id); this.scene.start('WorldMapScene'); });
      const restart = this.resultPanel.getByName('result-restart') as Phaser.GameObjects.Image;
      restart?.removeAllListeners('pointerdown').on('pointerdown', () => { this.registry.set('mapFocusCity', this.city.id); if (!success && !lost && intelEvents().some(x => x.id === e.id)) this.scene.restart(); else this.scene.start('WorldMapScene'); });
    }
  };
}
