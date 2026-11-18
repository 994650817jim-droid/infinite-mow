import Phaser from 'phaser';
import {captureLine, factionGeneral, tryCapture} from '../systems/RosterStore';
import {EnemyCamps} from '../systems/EnemyCamps';
import {GameScene} from './GameScene';
import {GuanduBoss} from '../systems/GuanduBoss';
import {GUANDU_ATLAS_FILES} from '../data/guanduChapter';
import {SIEGE, SIEGE_GOALS as SG, FIRST_CAPTURE_BONUS, siegeBattle, defenseBattle, siegeLargeKit, siegeSourceKeys} from '../data/siege';
import {actorDepth, DEPTH, GAME_WIDTH} from '../config';
import {warText} from '../ui/WarStyle';
import {isChapterTestRun} from '../systems/ChapterProgress';
import {beginSiege, beginDefense, loadWorld, permanentEffects, settleSiege, settleDefense, takeExpeditionReserve, abandonExpedition} from '../world/WorldStore';
import {cityAttackable, cityAttacker, cityById, cityOwner, eraIndexFor, FACTIONS, TIER_NAME, type CityDef, type FactionId} from '../world/WorldCities';
import {ensureFactionTextures, factionKey} from '../systems/FactionPalette';
import {enemyArrowTexture} from '../systems/ArrowPalette';
import {applyCitySpecialties} from '../systems/CityBonuses';
import {cityIncomeLine} from '../world/WorldStore';
import {siegeScenery, SIEGE_GATE} from '../systems/SiegeScenery';
import {SishuiObstacles} from '../systems/SishuiObstacles';
import {worldText} from '../world/WorldUI';
import type {Enemy} from '../entities/Enemy';
import type {RunEndReason} from '../types';
import type {RunConfig} from '../data/characters';
import { loadBossSheet } from '../systems/ArtStyle';
import {SiegeMidCity} from '../systems/SiegeMidCity';
import {MID_SIEGE, SIEGE_GARRISON as GAR, SIEGE_PROFILES} from '../data/siegeMedium';
import {loadMidSiegeArt} from '../systems/SiegeMidArt';
import type {EnemyKind} from '../types';

/**
 * 攻城战（WORLD_MAP_PLAN.md · W2）：按城市档位的短战。胜利（击败守将 / 大将）即占领该城。
 * 大城须先破城门，大将才会出城（借用第四章首领技能，W5 前为过渡造型）。无关间休整。
 * W4 守城战（registry siegeMode='defense'）：敌势力来犯告急中的我方城池，无城门，击败敌将即守住。
 */
export function siegeGameSceneClass(Base: typeof GameScene) {
  return class SiegeGameScene extends Base {
    protected achievementArc() { return this.defense ? 'defense' : 'siege'; }
    protected padTargets() { return this.enemyCamps?.padTargets() ?? []; }
    protected padClearTargets() { this.enemyCamps?.cancel(); }
    private city!: CityDef; private owner: FactionId = 'han'; private defense = false; private receipt = ''; private test = false;
    private enemyCamps?: EnemyCamps; private controller?: GuanduBoss;
    private gate: Enemy | null = null; private gateLife = 0; private gateLabel?: Phaser.GameObjects.Text; private gateWarned = false;
    /** 攻城目标：帅旗 / 箭楼（可摧毁）→ 占领府衙。 */
    private flag: {e: Enemy; life: number; art: Phaser.GameObjects.Container} | null = null;
    private towers: Array<{e: Enemy; life: number; shotAt: number; label: Phaser.GameObjects.Text}> = [];
    /** 中城样板（攻城战重做）：三段推进控制器；小城 / 大城 / 守城为 undefined，沿用原玩法。 */
    private mid?: SiegeMidCity;
    private capturing = false; private captured = false; private captureProgress = 0; private captureG?: Phaser.GameObjects.Graphics; private captureLabel?: Phaser.GameObjects.Text; private goalText?: Phaser.GameObjects.Text;
    /** 守军池（攻城有限守军，data/siegeMedium SIEGE_GARRISON）：spent 已出、cut 拆营扣掉；守城为 null。 */
    private garrison: {total: number; spent: number; cut: number} | null = null;
    /** 池空后仍必刷的兵（目标 / 剧情）：不给经验、不掉落、不记战功。 */
    private unpaid = new Set<number>(); private noLoot = false; private scripted = false; private garrisonText?: Phaser.GameObjects.Text;
    constructor() { super('SiegeGameScene'); }
    preload() { for (const [key, url] of Object.entries(GUANDU_ATLAS_FILES)) if (!this.textures.exists(key)) loadBossSheet(this.load, key, url); loadMidSiegeArt(this); }
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
      this.unpaid = new Set(); this.noLoot = false; this.garrisonText = undefined;
      this.garrison = this.defense ? null : {total: Math.round(GAR.total[city.tier] * (1 + GAR.eraStep * (era - 1))), spent: 0, cut: 0};
      super.create();
      this.chapter = this.battleDef(); this.runConfig = {...this.runConfig, encounter: 'qunxiong'};
      this.receipt = this.test ? '' : this.defense ? beginDefense(city.id) : beginSiege(city.id, true);
      const effect = permanentEffects(); this.legion.healingMultiplier = effect.healMultiplier; applyCitySpecialties(this.player, effect, true, {legion: this.legion, supplies: this.supplies});
      for (let i = 0; i < effect.reinforcements; i++) this.legion.recruit(i === 0 ? 'swordsman' : 'spearman', 1, true);
      if (!this.test) for (const kind of takeExpeditionReserve(effect.reserveSlots)) { this.legion.recruit(kind, 1, true); this.allies[this.allies.length - 1].reserveSoldier = true; }
      this.battlefieldDetails.useStructuredLayout(); if (this.supplies) this.supplies.randomGeneration = false;
      // 攻城战重做：小 / 中 / 大城都走分段推进（SiegeMidCity 按档位配置）；守城不变
      const midCity = !this.defense;
      const art = siegeScenery(this, city, (frame, x, y, size) => this.spawnSceneProp(frame, x, y, size), {liveTowers: !this.defense, mid: midCity});
      this.ground.setTexture(art.key).setTileScale(1);
      this.sishuiObstacles = new SishuiObstacles(); this.sishuiObstacles.footprints.splice(0, this.sishuiObstacles.footprints.length, ...art.boxes);
      this.enemyCamps = new EnemyCamps({scene: this, player: this.player, create: (x, y, hp) => this.supplies?.spawnCamp(x, y, hp) ?? null, spawn: (kind, x, y) => this.spawnEnemy(kind, x, y, 1), support: () => this.legion.grid.query(this.player.x, this.player.y, 260), reward: n => { this.legion.food += n; }, ...(this.garrison ? {maxBatches: GAR.campBatches, onCut: (n: number) => { const g = this.garrison!; g.cut += Math.min(n, this.garrisonLeft); }} : {})}, art.camps, this.combatNow);
      this.legion.campTarget = u => this.enemyCamps?.assist(u) ?? null;
      if (city.tier === 'large' && !this.defense && !midCity) {
        this.gate = this.supplies?.spawnGate(SIEGE_GATE.x, SIEGE_GATE.y, SIEGE[city.tier].gateHp, SIEGE_GATE.size) ?? null; this.gateLife = this.gate?.spawnId ?? 0;
        this.gateLabel = worldText(this, SIEGE_GATE.x, SIEGE_GATE.y - SIEGE_GATE.size - 8, '', 15, '#ffe1a0').setOrigin(.5).setDepth(36).setStroke('#1a120b', 3);
      }
      const keys = (this.registry.get('battleTextureKeys') ?? []) as string[];
      this.registry.set('battleTextureKeys', [...new Set([...keys, ...Object.keys(GUANDU_ATLAS_FILES), art.key, art.roadKey, ...paletteKeys])]);
      this.hudTexts.chapter.setText(`${this.chapter.name} · ${TIER_NAME[city.tier]}`);
      this.flag = null; this.towers = []; this.capturing = false; this.captured = false; this.captureProgress = 0; this.captureG = undefined; this.captureLabel = undefined; this.goalText = undefined;
      this.mid?.clear(); this.mid = undefined;
      if (midCity) this.setupMid();
      if (!this.defense) this.setupGoals();
      this.events.once('shutdown', () => { this.mid?.clear(); this.mid = undefined; this.enemyCamps?.clear(); this.enemyCamps = undefined; this.controller?.clear(); this.controller = undefined; this.gateLabel?.destroy(); this.gateLabel = undefined; this.gate = null; });
    }
    /** 攻城目标布置：小城帅旗，中大城两座可摧毁箭楼（会放箭）。 */
    private setupGoals() {
      const t = this.city.tier, hp = (n: number) => Math.round(n * this.chapter.hpScale(this.elapsed));
      if (t === 'small' && !this.mid) {
        const e = this.supplies?.spawnCamp(0, -330, hp(SG.flagHp)) ?? null;
        if (e) {
          e.sprite.setAlpha(0); const g = this.add.graphics(); g.lineStyle(4, 0x3a2716).lineBetween(0, 0, 0, -96); g.fillStyle(0x8c2a2a).fillRect(0, -96, 46, 32).fillStyle(0xe8c76a).fillRect(4, -92, 38, 3); g.fillStyle(0x000000, .25).fillEllipse(0, 2, 44, 12);
          const art = this.add.container(0, -330, [g, worldText(this, 24, -82, '帅', 18, '#ffe1a0').setOrigin(.5)]).setDepth(actorDepth(-330)).setName('siege-flag'); this.flag = {e, life: e.spawnId, art};
        }
      } else if (!this.mid) for (const x of [-250, 250]) {
        const e = this.supplies?.spawnCamp(x, -265, hp(SG.towerHp)) ?? null; if (!e) continue;
        e.sprite.setTexture('sishui_props_refined', 1).setOrigin(.5, 1).setDisplaySize(126, 126).setAlpha(1);
        this.towers.push({e, life: e.spawnId, shotAt: this.combatNow + 1500 + (x > 0 ? 600 : 0), label: worldText(this, x, -265 - 140, '箭楼', 15, '#ffd28a').setOrigin(.5).setStroke('#1a120b', 4).setDepth(36)});
      }
      this.goalText = this.add.text(GAME_WIDTH / 2, 78, '', warText(14, '#ffd98a')).setOrigin(.5, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1).setStroke('#1a120b', 4).setName('siege-goal').setAlign('center').setWordWrapWidth(GAME_WIDTH * .5);
      this.garrisonText = this.add.text(GAME_WIDTH / 2, 100, '', warText(13, '#e8c99a')).setOrigin(.5, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1).setStroke('#1a120b', 4).setName('siege-garrison');
      if (!this.mid) this.time.delayedCall(900, () => { if (!this.over) this.showWaveBanner(t === 'small' ? '拔掉帅旗' : '摧毁箭楼', false, t === 'large' ? '破城门、毁箭楼、败大将，再占领府衙' : '然后占领府衙'); });
    }
    /** 府衙位置（小城在帅旗处，中大城在城门之后）。 */
    get capturePoint() { return {x: SG.capture.x, y: this.city.tier === 'small' ? SG.capture.smallY : SG.capture.y}; }
    private get goalsCleared() { return !this.flag && !this.towers.length && (this.city.tier !== 'large' || this.bossKilled); }
    private startCapture() {
      if (this.capturing) return; this.capturing = true;
      this.captureG = this.add.graphics().setDepth(2).setName('siege-capture');
      const cp = this.capturePoint; this.captureLabel = worldText(this, cp.x, cp.y - SG.capture.radius - 26, '府衙', 16, '#ffe1a0').setOrigin(.5).setStroke('#1a120b', 4).setDepth(36);
      this.showWaveBanner('城防已破 · 占领府衙', true, '站进府衙圈内，进度满即破城');
    }
    private updateGoals(dt: number) {
      this.paintGarrison();
      if (this.mid) { this.mid.update(dt); this.goalText?.setText('目标 · ' + this.mid.goalLine()); return; }
      const now = this.combatNow, p = this.player;
      // 箭楼放箭
      for (const t of this.towers) {
        if (!t.e.active || t.e.spawnId !== t.life) continue;
        if (now >= t.shotAt && Math.hypot(p.x - t.e.x, p.y - (t.e.y - 70)) <= SG.towerRange) { t.shotAt = now + SG.towerShotMs; this.fireBolt(this.bullets, t.e.x, t.e.y - 80, p.x, p.y, SG.towerDamage, 0, false, SG.towerArrowSpeed, enemyArrowTexture(this, factionKey(this.owner, 'xiliang_archer_walk'))); /* 箭塔箭矢用守城势力色 */ }
      }
      if (!this.capturing && this.goalsCleared && (this.city.tier !== 'large' || !this.boss?.active)) this.startCapture();
      if (this.capturing && this.captureG) {
        const c = {...SG.capture, ...this.capturePoint}, inside = Math.hypot(p.x - c.x, p.y - c.y) <= c.radius;
        let foes = 0; for (const e of this.enemies) if (e.active && !e.isSupplySlot && Math.hypot(e.x - c.x, e.y - c.y) <= c.radius) foes++;
        if (inside) this.captureProgress = Math.min(1, this.captureProgress + dt / c.seconds * (foes ? c.contestedMul : 1));
        const g = this.captureG.clear(); g.fillStyle(0xe8c76a, inside ? .18 : .1).fillEllipse(c.x, c.y, c.radius * 2, c.radius * 1.3).lineStyle(3, foes && inside ? 0xd65a3f : 0xe8c76a, .9).strokeEllipse(c.x, c.y, c.radius * 2, c.radius * 1.3);
        if (this.captureProgress > 0) { g.lineStyle(6, 0x8fe0b4, 1); g.beginPath(); g.arc(c.x, c.y, c.radius * .55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.captureProgress); g.strokePath(); }
        this.captureLabel?.setText(`府衙 · 占领 ${Math.round(this.captureProgress * 100)}%${foes && inside ? ' · 有敌兵' : ''}`);
        if (this.captureProgress >= 1) { this.captured = true; this.bossKilled = true; this.finish(true, 'boss'); return; }
      }
      this.goalText?.setText(this.goalLine());
    }
    private goalLine(): string {
      if (this.capturing) return `目标 · 占领府衙 ${Math.round(this.captureProgress * 100)}%`;
      const parts: string[] = [];
      if (this.flag) parts.push('拔帅旗');
      if (this.towers.length) parts.push(`毁箭楼 ${2 - this.towers.length}/2`);
      if (this.city.tier === 'large') { if (this.gateAlive) parts.push('破城门'); if (!this.bossKilled) parts.push('败大将'); }
      return '目标 · ' + (parts.join(' · ') || '占领府衙');
    }
    /** 攻城：限时内未破城判失败；守城沿用原规则。 */
    protected checkEnd() {
      if (this.defense || this.over) { super.checkEnd(); return; }
      if (!this.player.alive) this.finish(false);
      else if (this.elapsed >= (this.mid ? this.mid.prof.limitSeconds : SG.limit[this.city.tier])) this.finish(false, 'timeout');
    }
    /** 测试用状态。 */
    get siegeGoals() { return {flag: !!this.flag, towers: this.mid ? this.mid.towersAlive : this.towers.length, capturing: this.capturing, progress: this.captureProgress, captured: this.captured, mid: this.mid ? {tier: this.mid.tier, bridge: this.mid.bridgeDown, ropes: this.mid.ropesLeft, inner: this.mid.innerGateHp, phase: this.mid.phase, gate: Math.round(this.mid.gateHp), ram: this.mid.ramInfo, points: this.mid.pointsInfo, boss: this.mid.bossInfo, stats: {...this.mid.stats}, zones: this.mid.volleyZones} : null}; }
    /** 守军还剩多少（总数 − 已出 − 拆营扣掉）。 */
    get garrisonLeft() { const g = this.garrison; return g ? Math.max(0, g.total - g.spent - g.cut) : Infinity; }
    /** 当前段放出的份额上限（累计到当前段）。 */
    private get garrisonCap() {
      const g = this.garrison; if (!g) return Infinity; const P = SIEGE_PROFILES[this.city.tier].phases, sum = P.reduce((n, p) => n + GAR.share[p], 0);
      const at = this.mid ? Math.max(0, P.indexOf(this.mid.phase as typeof P[number])) : P.length - 1, reached = this.mid?.phase === 'done' ? P.length - 1 : at;
      return Math.round(g.total * P.slice(0, reached + 1).reduce((n, p) => n + GAR.share[p], 0) / sum);
    }
    /** 测试用：守军池状态。 */
    get garrisonInfo() { const g = this.garrison; return g ? {...g, left: this.garrisonLeft, cap: this.garrisonCap, unpaid: this.unpaid.size} : null; }
    private paintGarrison() {
      if (!this.garrison || !this.garrisonText) return; const lim = this.mid ? this.mid.prof.limitSeconds : SG.limit[this.city.tier], left = Math.max(0, Math.ceil(lim - this.elapsed));
      this.garrisonText.setText(`守军 ${this.garrisonLeft}/${this.garrison.total}${this.garrisonLeft ? '' : ' · 援兵已尽'}　·　限时 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`).setColor(left <= 30 ? '#ff8a70' : '#e8c99a');
    }
    /** 攻城守军有限：首领以外的兵从守军池出；池空（或本段份额用完）后普通刷兵停止，必刷的兵照出但不给经验 / 掉落。 */
    protected spawnEnemy(kind: EnemyKind, x: number, y: number, hpScale?: number, force = false, override?: Parameters<GameScene['spawnEnemy']>[5]): Enemy | null {
      const g = this.garrison; if (!g || kind === 'boss') return super.spawnEnemy(kind, x, y, hpScale, force, override);
      const paid = this.garrisonLeft > 0 && g.spent + g.cut < this.garrisonCap;
      // 池空后：只有剧情 / 目标必刷的兵（中城段落脚本、首领召唤）照出；普通刷兵（含强制精英）不再出
      if (!paid && !(force && this.scripted)) return null;
      const e = super.spawnEnemy(kind, x, y, hpScale, force, override); if (!e) return e;
      if (paid) { g.spent++; this.unpaid.delete(e.spawnId); } else this.unpaid.add(e.spawnId);
      return e;
    }
    private scriptedSpawn<T>(f: () => T): T { this.scripted = true; try { return f(); } finally { this.scripted = false; } }
    protected spawnGem(x: number, y: number, value: number) { if (!this.noLoot) super.spawnGem(x, y, value); }
    /** 测试用：中城控制器。 */
    get siegeMid() { return this.mid ?? null; }
    /** 中城：按段从固定方向刷兵（城门 / 两翼 / 巷口 / 回廊）。 */
    protected spawnAroundPlayer(kind: EnemyKind, force = false): Enemy | null {
      if (!this.mid) return super.spawnAroundPlayer(kind, force);
      const pt = this.mid.spawnPoint(kind); return pt ? this.spawnEnemy(kind, pt.x, pt.y, undefined, force) : null;
    }
    /** 中城：一半敌兵在冲车附近时转去打冲车。 */
    protected customEnemyStep(enemy: Enemy, dt: number, now: number, target: {x: number; y: number}) {
      if (this.mid?.steer(enemy, dt)) return true;
      return super.customEnemyStep(enemy, dt, now, target);
    }
    private setupMid() {
      const O = MID_SIEGE.outside; this.player.sprite.setPosition(O.start.x, O.start.y);
      this.cameras.main.scrollX = O.start.x - this.cameras.main.width / 2; this.cameras.main.scrollY = O.start.y - this.cameras.main.height / 2;
      this.allies.forEach((a, i) => { if (a.active) a.setPosition(O.start.x + ((i % 5) - 2) * 34, O.start.y + 50 + Math.floor(i / 5) * 30); });
      const kinds: Array<'swordsman' | 'spearman'> = ['swordsman', 'spearman'];
      this.mid = new SiegeMidCity({
        scene: this, player: this.player, allies: () => this.allies, enemies: () => this.enemies, now: () => this.combatNow,
        footprints: this.sishuiObstacles!.footprints as unknown as Array<{left: number; right: number; top: number; bottom: number}>,
        spawnEnemy: (kind, x, y, force) => this.scriptedSpawn(() => this.spawnEnemy(kind, x, y, 1, force)),
        advance: (e, nx, ny, dt) => this.advanceEnemy(e, nx, ny, dt),
        spawnTarget: (x, y, hp, size, tex, frame) => { const e = this.supplies?.spawnGate(x, y, hp, size) ?? null; e?.sprite.setTexture(tex, frame).setOrigin(.5, 1).setDisplaySize(size, size).setAlpha(1); return e; },
        opts: {tier: this.city.tier, bossName: this.siegeBossLabel(), externalBoss: this.city.tier === 'large'},
        spawnTower: (x, y) => { const e = this.supplies?.spawnCamp(x, y, Math.round(SG.towerHp * this.chapter.hpScale(this.elapsed))) ?? null; e?.sprite.setTexture('sishui_props_refined', 1).setOrigin(.5, 1).setDisplaySize(140, 140).setAlpha(1); return e; },
        spawnBarrel: (x, y) => { this.env?.spawnForTest('barrel', x - this.player.x, y - this.player.y); },
        hurtTroops: (x, y, r, d) => this.legion.hurtArea(x, y, r, d, this.combatNow),
        recruit: n => { for (let i = 0; i < n; i++) this.legion.recruit(kinds[i % 2], 1, true); },
        banner: (t, danger, cap) => this.showWaveBanner(t, !!danger, cap), sfx: k => this.sfx.play(k),
        spawnBoss: () => this.spawnBoss(), boss: () => this.boss,
        campsAlive: () => { const c = this.enemyCamps?.camps ?? []; return [c.filter(x => !x.destroyed).length, c.length]; },
        // 攻城器械等级：讲武堂科技预留（存档字段 siegeEngineLevel，暂无升级入口，默认 0；测试可用 registry siegeEngineLevel 覆盖）
        engineLevel: Number(this.registry.get('siegeEngineLevel') ?? (loadWorld() as {siegeEngineLevel?: number}).siegeEngineLevel ?? 0),
      });
    }
    /** 守将称呼：小城县尉、中城守将、大城为势力名将（RosterStore 的势力武将名单里抽一位）。 */
    private siegeBossLabel(): string | undefined {
      if (this.city.tier === 'small') return '县尉';
      if (this.city.tier !== 'large') return undefined;
      const g = factionGeneral(this.owner); if (g) this.chapter.bossName = `${FACTIONS[this.owner].name}大将 · ${g}`;
      return g ?? '大将';
    }
    private battleDef() { return this.defense ? defenseBattle(this.city, this.owner) : siegeBattle(this.city, this.owner); }
    protected customChapter() { return this.city ? this.battleDef() : null; }
    protected abandonRun() { if (!this.over) abandonExpedition(this.receipt, this.allies.filter(u => u.active && u.reserveSoldier).map(u => u.kind)); }
    protected handleBattlePointer(pointer: Phaser.Input.Pointer) { return this.mode === 'none' && !this.over ? (this.enemyCamps?.pointer(pointer) ?? false) : false; }
    /** 城门未破时，城门是武器的优先目标（在刺程内时）。 */
    protected priorityWeaponTarget(range: number, bodyRadius = true) {
      const camp = this.enemyCamps?.target(range, bodyRadius); if (camp) return camp;
      const t = this.mid?.priorityTarget(range); if (t) return t;
      if (this.gateAlive && this.bossTimeReached && Math.hypot(this.gate!.x - this.player.x, this.gate!.y - this.player.y) <= range + (bodyRadius ? this.gate!.radius : 0)) return this.gate;
      // 2026-11-16 修：原来营寨 / 城门不在射程时返回 null，首领 / 精锐优先被整个吃掉（黄忠宝雕弓对首领 0 伤害），改为退回基类的首领 > 精锐
      return super.priorityWeaponTarget(range, bodyRadius);
    }
    private get bossTimeReached() { return this.elapsed >= this.chapter.waves[this.chapter.waves.length - 1].start; }
    protected tryCustomBossSkill() { if (!this.controller || !this.boss?.active) return false; this.controller.forceSkill(this.combatNow); return true; }
    protected spawnBoss() {
      // 攻城：中小城不出守将（目标是拔旗 / 毁箭楼后占领府衙）；大城须城门已破
      if (this.mid) {
        if (this.mid.phase !== 'hall' || this.boss?.active) return;
        super.spawnBoss(); const b = this.boss as Enemy | null; if (!b) return;
        b.hp = b.maxHp = Math.round(b.maxHp * this.mid.prof.bossHpMul);
        // 大城：势力名将两阶段（第四章首领招式组：半血进二阶段，专属技能按城轮换）
        if (this.city.tier === 'large') { const kit = siegeLargeKit(this.city); this.controller = new GuanduBoss({scene: this, boss: b, player: this.player, army: this.legion, spawn: (kind, x, y) => this.scriptedSpawn(() => this.spawnEnemy(kind, x, y, 1, true))}, kit.stage, this.combatNow, {atlas: kit.atlas, name: this.chapter.bossName}); }
        return;
      }
      if (!this.defense && this.city?.tier !== 'large') return;
      // 大城：城门未破，大将不出城
      if (this.city?.tier === 'large' && this.gateAlive) { if (!this.gateWarned) { this.gateWarned = true; this.showWaveBanner('城门紧闭 · 先破城门！', true); } return; }
      super.spawnBoss();
      if (this.boss && this.city.tier === 'large') { const kit = siegeLargeKit(this.city); this.controller = new GuanduBoss({scene: this, boss: this.boss, player: this.player, army: this.legion, spawn: (kind, x, y) => this.scriptedSpawn(() => this.spawnEnemy(kind, x, y, 1, true))}, kit.stage, this.combatNow, {atlas: kit.atlas, name: this.chapter.bossName}); }
    }
    /** 中小城守将：近身追击，无特殊技能；大城大将走技能控制器。 */
    protected customBossStep(enemy: Enemy, dt: number, now: number) {
      if (enemy !== this.boss) return false;
      if (this.mid?.stepBoss(enemy, dt, now)) return true;
      if (this.controller) { this.controller.update(dt, now); return true; }
      const dx = this.player.x - enemy.x, dy = this.player.y - enemy.y, d = Math.hypot(dx, dy) || 1, nx = d > 48 ? dx / d : 0, ny = d > 48 ? dy / d : 0;
      // crowdSteering 下 advanceEnemy 用 moveVx/moveVy，而 EnemyMovement 对首领一律置 0（首领通常由控制器驱动）——中小城守将没有控制器，须自己给速度，否则原地不动
      enemy.moveVx = nx * enemy.def.speed; enemy.moveVy = ny * enemy.def.speed;
      this.advanceEnemy(enemy, nx, ny, dt); return true;
    }
    protected hitEnemy(enemy: Enemy, raw: number, now: number, source: 'melee' | 'arrow' | 'fire' = 'melee', ally = false, weaponHit = true) { if (enemy === this.boss && this.controller) { raw *= this.controller.incoming(ally); this.controller.hit(now); } if (enemy === this.boss && this.mid) raw *= this.mid.bossDamageMul(); return super.hitEnemy(enemy, raw, now, source, ally, weaponHit); }
    protected bossHasDeathArt() { return !!this.controller; }
    protected killEnemy(enemy: Enemy) {
      this.mid?.onKilled(enemy);
      if (this.flag && enemy === this.flag.e && enemy.spawnId === this.flag.life) { this.flag.art.destroy(); this.flag = null; this.showWaveBanner('帅旗已拔', true, '占领府衙！'); }
      const tower = this.towers.find(t => t.e === enemy && t.e.spawnId === t.life); if (tower) { tower.label.destroy(); this.towers.splice(this.towers.indexOf(tower), 1); this.showWaveBanner(this.towers.length ? '箭楼已毁 · 还剩 ' + this.towers.length + ' 座' : '箭楼尽毁', true); }
      if (enemy === this.gate && enemy.spawnId === this.gateLife) { this.gateLabel?.setText('城门已破！'); this.showWaveBanner('城门已破 · 大将出城！', true); this.time.delayedCall(2200, () => this.gateLabel?.setVisible(false)); }
      this.enemyCamps?.onDestroyed(enemy, this.combatNow); if (enemy === this.boss) this.controller?.defeat();
      if (enemy.kind !== 'boss' && this.unpaid.delete(enemy.spawnId) && enemy.active && !enemy.isSupplySlot) {
        const drops = this.itemDrops, elite = enemy.kind === 'elite'; this.noLoot = true; this.itemDrops = null;
        try { super.killEnemy(enemy); } finally { this.noLoot = false; this.itemDrops = drops; } if (elite) this.runMerit.elite = Math.max(0, this.runMerit.elite - 1); return;
      }
      super.killEnemy(enemy);
    }
    update(time: number, delta: number) {
      const before = this.combatNow; super.update(time, delta);
      if (this.combatNow > before && !this.over && this.mode === 'none') { if (!this.awaitingChest) this.enemyCamps?.update(this.combatNow); if (!this.defense) this.updateGoals((this.combatNow - before) / 1000); }
      this.controller?.updateDeath(delta);
      if (this.gateLabel && this.gateAlive) {
        const left = this.chapter.waves[this.chapter.waves.length - 1].start + 60 - this.elapsed;
        this.gateLabel.setText(`城门 ${Math.ceil(this.gate!.hp)}/${this.gate!.maxHp}` + (this.bossTimeReached ? ` · ${Math.max(0, Math.ceil(left))}秒内破门` : ''));
      }
      if (this.boss?.active && this.controller) this.hudTexts.bossEnergy.setText(this.controller.label);
    }
    /** 攻城没有关间招募休整：战中招兵照常。 */
    /** 攻城：大将倒下后不立即结算，进入占领府衙阶段。 */
    protected finish(victory: boolean, reason: RunEndReason = 'death') {
      if (this.over) return;
      if (this.mid && victory && !this.captured) { if (this.mid.phase !== 'done') { this.setMode('none'); this.mid.plantFinalFlag(() => { this.captured = true; this.bossKilled = true; this.finish(true, 'boss'); }); } return; }
      if (!this.defense && victory && !this.captured) { this.setMode('none'); this.startCapture(); return; }
      super.finish(victory, reason);
      const T = SIEGE[this.city.tier];
      if (this.defense) { this.finishDefense(victory, T.reward); return; }
      const reward = settleSiege(this.receipt, {victory, bossKilled: this.bossKilled, debug: this.test || this.debugModified || this.debugJumped || this.player.damageImmune, elapsed: this.elapsed, reward: T.reward, firstBonus: FIRST_CAPTURE_BONUS, returned: this.allies.filter(u => u.active && u.reserveSoldier).map(u => u.kind)});
      this.controller?.clear();
      this.resultTexts.subtitle.setText(victory ? `${this.city.name}归入义军版图${reward.first ? ' · 首次攻占' : ''}` : (reason === 'timeout' && this.gateAlive ? '城门未破 · 攻城失利' : '攻城失利 · 整军再战'));
      const caught = victory && this.bossKilled && !this.capturesBlocked() ? tryCapture('siege', factionGeneral(this.owner) ?? '', this.owner) : null;
      this.resultTexts.body.setText(this.resultTexts.body.text + '\n永久奖励 · 军粮 +' + reward.provisions + cityIncomeLine(reward) + captureLine(caught) + (reward.alert ? `\n${FACTIONS[reward.alert.attacker].name}不甘失地，${this.city.name}告急！` : ''));
      this.mapButtons(victory);
    }
    private finishDefense(victory: boolean, base: {merits: number; provisions: number}) {
      const reward = settleDefense(this.receipt, {victory, bossKilled: this.bossKilled, debug: this.test || this.debugModified || this.debugJumped || this.player.damageImmune, elapsed: this.elapsed, reward: base, returned: this.allies.filter(u => u.active && u.reserveSoldier).map(u => u.kind)});
      this.controller?.clear();
      this.resultTexts.subtitle.setText(victory ? `${this.city.name}守住了 · 告急解除` : `守城失利 · ${this.city.name}仍在告急`);
      this.resultTexts.body.setText(this.resultTexts.body.text + '\n永久奖励 · 军粮 +' + reward.provisions + cityIncomeLine(reward) + captureLine(victory && this.bossKilled && !this.capturesBlocked() ? tryCapture('defense', factionGeneral(this.owner) ?? '', this.owner) : null) + (victory ? '' : '\n城池尚在；若改去别处出征，此城将失守'));
      this.mapButtons(victory);
    }
    /** 测试 / 调试战斗不触发招降（?roster=1 时测试照常）。 */
    private capturesBlocked() { return (this.test && new URLSearchParams(location.search).get('roster') !== '1') || this.debugModified || this.debugJumped || this.player.damageImmune;
    }
    /** 城池建设跳转（留给主城会话接）：registry cityBuildTarget = 城 id；场景 CityBuildScene 存在则进入，否则回天下地图聚焦此城。 */
    private openCityBuild() {
      this.registry.set('cityBuildTarget', this.city.id); this.registry.set('mapFocusCity', this.city.id);
      this.scene.start(this.scene.manager.keys['CityBuildScene'] ? 'CityBuildScene' : 'WorldMapScene');
    }
    private mapButtons(victory: boolean) {
      const home = this.resultPanel.getByName('result-home') as Phaser.GameObjects.Text;
      home?.setText('返回天下地图').removeAllListeners('pointerdown').on('pointerdown', () => { this.registry.set('mapFocusCity', this.city.id); this.scene.start('WorldMapScene'); });
      // 中城占领后接城池建设（主城会话在做城池界面）：有 CityBuildScene 就直接进，没有先回天下地图并记下要建设的城
      if (victory && this.mid) home?.setText('建设城池').removeAllListeners('pointerdown').on('pointerdown', () => this.openCityBuild());
      const restart = this.resultPanel.getByName('result-restart') as Phaser.GameObjects.Image;
      restart?.removeAllListeners('pointerdown').on('pointerdown', () => { if (victory) { this.registry.set('mapFocusCity', this.city.id); this.scene.start('WorldMapScene'); } else this.scene.restart(); });
    }
  };
}
