import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { BALANCE, HEADING_FONT } from '../config';
import { getBattleChapter, getChapter, type ChapterDef } from '../data/chapters';
import type { EnemyDef } from '../data/enemies';
import { GAUNTLET, endlessBoss, gauntletReward, pickBosses, readGauntletBest, unlockedPool, waveScale, writeGauntletBest, type GauntletBoss } from '../data/gauntlet';
import { BOSS_MOVES } from '../data/bossMoves';
import { supplyOption } from '../data/upgrades';
import { thirdBattle } from '../data/thirdChapter';
import { GUANDU_ATLAS_FILES, GUANDU_STAGES, guanduBattle } from '../data/guanduChapter';
import { chibiBattle } from '../data/chibiChapter';
import { JINGNAN_SHEETS, jingnanBattle, jingnanTexture } from '../data/jingnanChapter';
import { HANZHONG_SHEETS, hanzhongBattle, hanzhongTexture } from '../data/hanzhongChapter';
import { YILING_SHEETS, yilingBattle, yilingTexture } from '../data/yilingChapter';
import { BEIFA_SHEETS, beifaBattle, beifaTexture } from '../data/beifaChapter';
import { SHU_CONFIG } from './ShuGameScene';
import { XIANGFAN_CONFIG } from './XiangfanGameScene';
import { NANZHENG_CONFIG } from './NanzhengGameScene';
import { BossMoveset } from '../systems/BossMoveset';
import { YuanshuBoss } from '../systems/YuanshuBoss';
import { CaorenBoss } from '../systems/CaorenBoss';
import { GuanduBoss } from '../systems/GuanduBoss';
import type { ArcHost } from '../systems/ArcBossV2';
import { loadBossSheet } from '../systems/ArtStyle';
import { isChapterTestRun } from '../systems/ChapterProgress';
import { stageCleared } from '../systems/HeroProgress';
import { addScrolls } from '../systems/MasteryStore';
import { addProvisions } from '../world/WorldStore';
import { FollowerSquad, type Follower } from '../systems/FollowerSquad';
import { FOLLOWER_ATTACK_SFX } from '../systems/HeroSfx';
import type { Recruit } from '../systems/RosterStore';
import type { Enemy } from '../entities/Enemy';
import type { RunConfig } from '../data/characters';
import type { RunEndReason, UpgradeOption } from '../types';
import type { FollowerTemplate } from '../data/recruits';

/** 名将的首领图与战役数值：图键、要载的图、首领数值、这一章的首领风格（bossStyle）、画法（arc = 4×8 首领图 / walk = 四方向行走表）。 */
interface BossArt { tex: string; sheet?: string; def: EnemyDef; style: ChapterDef['bossStyle']; layout: 'arc' | 'walk' }
/** 名将出招控制器（专属 / 招式框架）：场景每帧推、受伤倍率、倒地。 */
interface GCtrl { update(dt: number, now: number): void; clear(): void; defeat?(): void; updateDeath?(delta: number): void; incoming?(ally: boolean): number; hit?(now: number): void; readonly label?: string }

/** 副将用什么兵器模板（随行系统的四种出手：枪扫 / 刀扇 / 弓射 / 谋火）。 */
const TEMPLATE: Record<string, FollowerTemplate> = { zhangjiao: 'strategist', lubu: 'spear', yuanshu: 'blade', chunyuqiong: 'blade', caoren: 'blade', hanxuan: 'blade', liuzhang: 'strategist', caocao: 'blade', lvmeng: 'blade', zhuran: 'spear', menghuo: 'blade', haozhao: 'bow' };

/** 每位名将的首领图与战役数值（从各章的数据 / 场景配置取，和战役里同一张图、同一份数值）。 */
function bossArt(b: GauntletBoss): BossArt {
  const arc = (c: ChapterDef, tex: string, sheet: string | undefined): BossArt => ({ tex, sheet, def: { ...c.enemies.boss, texture: tex }, style: c.bossStyle, layout: 'arc' });
  switch (b.arc) {
    case 'huangjin': { const c = getBattleChapter('huangjin', 3), d = c.enemies.boss; return { tex: d.walkVisual?.texture ?? d.texture, def: d, style: c.bossStyle, layout: 'walk' }; }
    case 'hulao': { const c = getChapter('hulao'); return { tex: c.enemies.boss.texture, def: c.enemies.boss, style: 'lubu', layout: 'walk' }; }
    case 'qunxiong': return arc(thirdBattle(3), 'third_' + b.id, 'assets/phase23/' + b.id + '.png');
    case 'guandu': { const atlas = GUANDU_STAGES[2].atlas, c = guanduBattle(3); return { ...arc(c, atlas, GUANDU_ATLAS_FILES[atlas]), def: { ...c.enemies.boss, texture: atlas } }; }
    case 'chibi': return arc(chibiBattle(3), 'chibi_' + b.id, 'assets/chibi/' + b.id + '.png');
    case 'jingnan': { const t = jingnanTexture(b.id); return arc(jingnanBattle(b.stage), t, JINGNAN_SHEETS[t]); }
    case 'shu': return arc(SHU_CONFIG.battle(b.stage), SHU_CONFIG.texture(b.id), SHU_CONFIG.sheet(b.id));
    case 'hanzhong': { const t = hanzhongTexture(b.id); return arc(hanzhongBattle(b.stage), t, HANZHONG_SHEETS[t]); }
    case 'xiangfan': return arc(XIANGFAN_CONFIG.battle(b.stage), XIANGFAN_CONFIG.texture(b.id), XIANGFAN_CONFIG.sheet(b.id));
    case 'yiling': { const t = yilingTexture(b.id); return arc(yilingBattle(b.stage as 1 | 2 | 3), t, YILING_SHEETS[t]); }
    case 'nanzheng': return arc(NANZHENG_CONFIG.battle(b.stage), NANZHENG_CONFIG.texture(b.id), NANZHENG_CONFIG.sheet(b.id));
    case 'beifa': { const t = beifaTexture(b.id); return arc(beifaBattle(b.stage as 1 | 2 | 3), t, BEIFA_SHEETS[t]); }
  }
}

/**
 * 名将连战第一版（data/gauntlet.ts；共享笔记 gauntlet-v1.md）：开阔场地（第二章西凉兵做杂兵底子），无行营 / 无剧情 / 无整军（不带部曲、不带随从），
 * 十阵：割草 GAUNTLET.mowSec 秒 → 名将带亲兵登场（杂兵刷新量减半）→ 斩将后清场、战利品三选一 → 下一阵；第十阵守关名将，通关后可继续无尽。
 * 战役成长照常带入（武将等级、星图、兵装、信物）；局内升级三选一照常；不掉战役兵装（lootBlocked + 不建掉落）；不记战役进度（encounter）。
 */
export function gauntletGameSceneClass(Base: typeof GameScene) {
  return class GauntletGameScene extends Base {
    constructor() { super('GauntletGameScene'); }
    /** 本局：第几阵（1 起）、阶段与进入时刻（关内秒）、十阵名单、当前名将、斩过的名将、是否已通关十阵 / 进了无尽。 */
    gWave = 1; gPhase: 'mow' | 'boss' | 'clear' | 'choice' | 'done' = 'mow'; gAt = 0; gOrder: GauntletBoss[] = []; gCur: GauntletBoss | null = null;
    gKills: GauntletBoss[] = []; gCleared = false; gEndless = false; private gPool: GauntletBoss[] = [];
    private gCtrl: GCtrl | null = null; private gLootShown = false; private gEliteAt = 0; private gFollowers: Array<{ f: Follower; boss: GauntletBoss }> = [];
    private gPendingReplace: GauntletBoss | null = null; private gPortrait = new Map<string, string>();
    /** 测试读：帧率采样（三位副将 + 名将 + 割草同屏）。 */
    gStats = { lootPicks: [] as string[], spawned: 0, cleared: 0 };

    preload() {
      (Base.prototype as unknown as { preload?: () => void }).preload?.call(this); // 基类（开发构建的 DevGameScene）有 preload 就先跑
      // 十二位名将的首领图都先载好（第一 / 二章的张角、吕布开机就有）
      for (const b of unlockedPool(() => true, true)) { const a = bossArt(b); if (a.sheet && !this.textures.exists(a.tex)) loadBossSheet(this.load, a.tex, a.sheet); }
    }
    create() {
      const saved = this.registry.get('runConfig') as RunConfig | undefined;
      this.registry.remove('campaignTransfer'); this.registry.remove('worldCampaign'); // 无行营 / 无整军：不带部曲、不读征程构筑
      this.registry.set('runConfig', { ...saved, character: saved?.character ?? 'zhaoyun', chapter: 'hulao', westStage: 3, encounter: 'qunxiong' }); // encounter：不建剧情、不记战役进度、不建西凉专属机制（同篇章场景）
      this.gWave = 1; this.gPhase = 'mow'; this.gAt = 0; this.gKills = []; this.gCleared = false; this.gEndless = false; this.gCtrl = null; this.gLootShown = false; this.gFollowers = []; this.gPendingReplace = null; this.gResult = null; this.gPortrait.clear();
      this.gStats = { lootPicks: [], spawned: 0, cleared: 0 };
      const test = isChapterTestRun();
      this.gPool = unlockedPool(k => stageCleared(k), test);
      this.gOrder = pickBosses(this.gPool);
      super.create();
      // 不带随从（副将位只给本局收的名将）、不掉战役兵装
      this.followers?.clear(); this.followers = null;
      this.itemDrops = null;
      this.chapter = this.makeChapter(this.gOrder[0]);
      this.bossWarned = true; this.gEliteAt = GAUNTLET.eliteFirst;
      this.hudTexts.chapter.setText('名将连战');
      this.time.delayedCall(500, () => { if (!this.over) this.showWaveBanner('名将连战 · 第 1 阵', false, `割草 ${GAUNTLET.mowSec} 秒后名将登场 · 共 ${GAUNTLET.waves} 阵`); });
      this.events.once('shutdown', () => { this.gCtrl?.clear(); this.gCtrl = null; });
    }
    /** 自定关：不进战役关卡逻辑（剧情、进度、段落、招降都按自定关跳过）。 */
    protected customChapter() { return this.chapter?.name === '名将连战' ? this.chapter : this.makeChapter(this.gOrder[0] ?? unlockedPool(() => true, true)[0]); }
    protected phaseEligible() { return false; }
    protected lootBlocked() { return true; }
    protected victoryLabel() { return this.gEndless ? '无尽止步' : '十阵通关'; }

    /** 这一阵的关卡定义：杂兵用第二章西凉兵（按阵乘生命 / 伤害 / 刷兵量），首领 = 这一阵的名将（按阵乘生命 / 伤害）。 */
    private makeChapter(b: GauntletBoss): ChapterDef {
      const base = getChapter('hulao'), sc = waveScale(this.gWave), art = bossArt(b), d = art.def;
      const boss: EnemyDef = { ...d, kind: 'boss', hp: Math.round(d.hp * sc.bossHp), damage: d.damage * sc.bossDmg };
      const t0 = 45 + (this.gWave - 1) * 30; // 刷兵配比按阵往后推（第一阵就有刀盾，后几阵弓骑多）
      return { ...base, name: '名将连战', label: '名将连战', description: '割草 · 斩将 · 连战', bossName: b.name, bossStyle: art.style, stage: undefined, westStage: undefined,
        waves: [{ name: '名将连战', start: 0 }], recruitWaves: [], enemies: { ...base.enemies, boss }, objective: undefined, bossAtStart: false, enemyCap: BALANCE.enemyCap,
        hpScale: () => sc.hp, growth: { hp: 1, damage: sc.dmg }, pace: 1,
        spawnInterval: t => base.spawnInterval(t + t0), spawnBurst: t => base.spawnBurst(t + t0), pickEnemy: t => base.pickEnemy(t + t0),
        victoryTitle: '名将连战', victoryText: '十阵连斩' };
    }
    /** 这一阵割草开始到现在几秒。 */
    private get waveT(): number { return Math.max(0, this.elapsed - this.gAt); }

    // ———— 刷兵：割草按阵加强；名将在场刷新量减半；清场 / 抉择时不刷 ————
    protected updateSpawner(dt: number): void {
      if (this.gPhase !== 'mow' && this.gPhase !== 'boss') return;
      const sc = waveScale(this.gWave), bossOn = this.gPhase === 'boss' && !!this.boss?.active, cap = BALANCE.enemyCap, t = this.gPhase === 'mow' ? this.waveT : GAUNTLET.mowSec;
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.activeEnemyCount() < cap) {
        this.spawnTimer = this.chapter.spawnInterval(t) / sc.count * (bossOn ? GAUNTLET.bossInterval : 1);
        const burst = Math.max(1, Math.round(this.chapter.spawnBurst(t) * sc.count * (bossOn ? GAUNTLET.bossBurst : 1)));
        for (let i = 0; i < burst; i++) { if (this.activeEnemyCount() >= cap) break; if (!this.spawnAroundPlayer(this.chapter.pickEnemy(t))) break; this.gStats.spawned++; }
      }
      if (this.gPhase === 'mow' && this.waveT >= this.gEliteAt) { this.gEliteAt = this.waveT + GAUNTLET.eliteEvery; this.spawnAroundPlayer('elite', true); }
    }

    // ———— 阶段推进 ————
    update(time: number, delta: number) {
      super.update(time, delta);
      this.gCtrl?.updateDeath?.(delta);
      if (this.over || !this.player?.alive) return;
      this.hudTexts.wave.setText(this.waveLine());
      if (this.mode !== 'none') return;
      if (this.gPhase === 'mow' && this.waveT >= GAUNTLET.mowSec) this.startBoss();
      else if (this.gPhase === 'boss' && !this.boss?.active && !this.bossKilled) this.spawnBoss(); // 首领没刷出来（落点被挡）：下一帧再试
      else if (this.gPhase === 'clear') {
        if (!this.gLootShown && this.waveT >= 1.8) { this.gLootShown = true; this.openLoot(); }
        else if (this.gLootShown && this.waveT >= GAUNTLET.clearSec) { if (this.gWave === GAUNTLET.waves && !this.gEndless) this.openClearChoice(); else this.nextWave(); }
      }
    }
    private waveLine(): string {
      const n = this.gEndless ? `无尽 · 第 ${this.gWave} 阵` : `第 ${this.gWave}/${GAUNTLET.waves} 阵`;
      if (this.gPhase === 'mow') return `${n} · 割草 ${Math.max(0, Math.ceil(GAUNTLET.mowSec - this.waveT))} 秒`;
      if (this.gPhase === 'boss') return `${n} · ${this.gCur?.name ?? ''}`;
      return `${n} · 斩将 ${this.gKills.length}`;
    }
    /** 名将登场：先收掉上一位留下的控制器，按这一阵换关卡定义，再出首领（带亲兵）。 */
    startBoss(): void {
      const b = this.gOrder[this.gWave - 1] ?? endlessBoss(this.gPool, this.gKills[this.gKills.length - 1] ?? null);
      this.gCur = b; this.gPhase = 'boss'; this.gAt = this.elapsed;
      this.gCtrl?.clear(); this.gCtrl = null; this.lubu?.clear(); this.lubu = null; this.zhangjiao?.clear(); this.zhangjiao = null; this.moveset?.clear(); this.moveset = null; this.bossMount?.destroy(); this.bossMount = null;
      this.boss = null; this.bossSpawned = false; this.bossKilled = false; this.bossWarned = true; this.bossPhase2 = false; this.bossEnergy = 0;
      this.chapter = this.makeChapter(b);
      this.spawnBoss();
    }
    protected spawnBoss(): void {
      const had = !!this.boss?.active; super.spawnBoss(); const boss = this.boss as Enemy | null, b = this.gCur;
      if (!boss || had || !b) return;
      if (GAUNTLET.stallOff) this.bossStallCfg = { quotaSec: 1e9, enrageSec: 1e9 }; // 首领防拖关掉（阵数节奏已经限住每阵长度）
      const art = bossArt(b), now = this.combatNow;
      const host: ArcHost = { scene: this, boss, player: this.player, army: this.legion, spawn: (k, x, y, def) => this.spawnEnemy(k, x, y, 1, true, def), def: k => this.chapter.enemies[k], banner: (t, c) => this.showWaveBanner(t, true, c), sfx: k => this.sfx.play(k) };
      if (b.ctrl === 'moveset') { const mv = BOSS_MOVES[b.arc + '.' + b.id] ?? BOSS_MOVES[b.id]; if (mv) this.gCtrl = new BossMoveset(host, art.tex, now, mv, 'arc'); }
      else if (b.ctrl === 'yuanshu') this.gCtrl = new YuanshuBoss(host, art.tex, now);
      else if (b.ctrl === 'caoren') this.gCtrl = new CaorenBoss(host, art.tex, now);
      else if (b.ctrl === 'guandu') this.gCtrl = new GuanduBoss({ scene: this, boss, player: this.player, army: this.legion, spawn: (k, x, y) => this.spawnEnemy(k, x, y, 1, true) }, 3, now) as unknown as GCtrl; // 不接 morale：焚粮减伤关掉
      // 亲兵：围在名将身边
      let k = 0; for (const [kind, n] of GAUNTLET.guards) for (let i = 0; i < n; i++, k++) { const a = k / 4 * Math.PI * 2; this.spawnEnemy(kind, boss.x + Math.cos(a) * 70, boss.y + Math.sin(a) * 50, undefined, true); }
      const last = this.gWave === GAUNTLET.waves && !this.gEndless;
      this.showWaveBanner(last ? `守关名将 · ${b.name}` : `第 ${this.gWave} 阵 · ${b.name}`, true, last ? '斩之即通关' : '名将带亲兵杀到 · 杂兵减半');
    }
    protected customBossStep(enemy: Enemy, dt: number, now: number) { if (enemy === this.boss && this.gCtrl) { this.gCtrl.update(dt, now); return true; } return super.customBossStep(enemy, dt, now); }
    protected hitEnemy(enemy: Enemy, raw: number, now: number, source: 'melee' | 'arrow' | 'fire' = 'melee', ally = false, weaponHit = true) {
      if (enemy === this.boss && this.gCtrl) { raw *= this.gCtrl.incoming?.(ally) ?? 1; this.gCtrl.hit?.(now); }
      return super.hitEnemy(enemy, raw, now, source, ally, weaponHit);
    }
    protected bossHasDeathArt() { return !!this.gCtrl || super.bossHasDeathArt(); }
    protected killEnemy(enemy: Enemy) { if (enemy === this.boss) this.gCtrl?.defeat?.(); super.killEnemy(enemy); }
    /** 斩将：不掉宝箱、不结算（基类首领倒地掉宝箱、捡完结算），改成清场 → 战利品三选一 → 下一阵。 */
    protected spawnBossChest(_x: number, _y: number, _done: () => void): void { this.onBossDown(); }
    private onBossDown(): void {
      const b = this.gCur; if (!b || this.gPhase !== 'boss') return;
      this.gKills.push(b); this.gPhase = 'clear'; this.gAt = this.elapsed; this.gLootShown = false;
      if (this.gWave === GAUNTLET.waves && !this.gEndless) this.gCleared = true;
      // 清场：场上的杂兵退散（淡出，不给经验 / 掉落）；地上的经验珠留着捡
      for (const e of this.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') { this.gStats.cleared++; const sp = e.sprite, life = e.spawnId; this.tweens.add({ targets: sp, alpha: 0, duration: 600, onComplete: () => { if (e.active && e.spawnId === life) { e.deactivate(); sp.setAlpha(1); } } }); }
      this.showWaveBanner(`斩将 · ${b.name}`, false, this.gCleared ? '十阵连斩！' : `第 ${this.gWave} 阵告捷 · 已斩 ${this.gKills.length} 将`);
    }

    // ———— 战利品三选一（复用 bossloot 卡面板）————
    /** 这位名将的小像（首领图第一帧拷成一张单图：卡面 / 结算头像用）。 */
    portrait(b: GauntletBoss): string {
      const hit = this.gPortrait.get(b.id); if (hit && this.textures.exists(hit)) return hit;
      const a = bossArt(b), key = 'gauntlet_face_' + b.id; if (!this.textures.exists(a.tex)) return 'growth_icon_pickup';
      // 首领图第一帧（朝下站立）裁到不透明像素的外框：各家首领图格子里人站的位置 / 留白不一样，裁掉留白以后同样大小摆一排才整齐
      if (!this.textures.exists(key)) {
        const src = this.textures.get(a.tex), f = src.get(src.has('down_0') ? 'down_0' : 0), w = Math.max(1, Math.round(f.cutWidth)), h = Math.max(1, Math.round(f.cutHeight));
        const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; const g = tmp.getContext('2d', { willReadFrequently: true }); if (!g) return 'growth_icon_pickup';
        g.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, w, h, 0, 0, w, h);
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        try { const d = g.getImageData(0, 0, w, h).data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } } catch { /* 读不了像素：用整格 */ }
        if (x1 < x0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
        const cw = x1 - x0 + 1, ch = y1 - y0 + 1, c = this.textures.createCanvas(key, cw, ch); if (!c) return 'growth_icon_pickup';
        c.context.drawImage(tmp, x0, y0, cw, ch, 0, 0, cw, ch); c.refresh();
      }
      this.gPortrait.set(b.id, key); return key;
    }
    private openLoot(): void {
      const b = this.gCur; if (!b) return; const food = GAUNTLET.loot.food + GAUNTLET.loot.foodPerWave * this.gWave, full = this.gFollowers.length >= GAUNTLET.followerMax;
      const opts: UpgradeOption[] = [
        { id: 'gauntlet_follow', name: '收为副将 · ' + b.name, desc: `${b.name}本局跟着你打（用他自己的形象，名将招式能用的照用）\n副将最多 ${GAUNTLET.followerMax} 位${full ? ' · 已满，选了再挑替换谁' : ''}`, kind: 'foundation', categoryLabel: '战利品', scope: 'run', icon: this.portrait(b), apply: () => this.takeFollower(b) },
        { id: 'gauntlet_spoils', name: '取其辎重', desc: `钱币 +${food}\n立刻回满生命`, kind: 'foundation', categoryLabel: '战利品', scope: 'once', icon: 'growth_icon_pickup', apply: () => { this.coinBurst(this.player.x, this.player.y, food); this.legion.food += food; this.player.heal(this.player.maxHp); } }, // 钱不飘字：铜钱从主将处飞进行囊（coins.md）
        supplyOption(b.chapter),
      ];
      this.showLoot(`斩将 · ${b.name} · 战利品三选一`, '本局有效 · 选一样', opts, () => { if (this.gPendingReplace) { const nb = this.gPendingReplace; this.gPendingReplace = null; this.openReplace(nb); } });
    }
    private showLoot(title: string, hint: string, opts: UpgradeOption[], after: () => void): void {
      this.sfx.level();
      (this.levelPanel.getByName('upgrade-title') as Phaser.GameObjects.Text | null)?.setText(title);
      (this.levelPanel.getByName('upgrade-points-hint') as Phaser.GameObjects.Text | null)?.setVisible(true).setText(hint);
      this.upgradeOptions = opts.map(o => ({ ...o, apply: (p, w, g) => { this.gStats.lootPicks.push(o.id); o.apply(p, w, g); } }));
      this.lootContinue = () => { this.setMode('none'); after(); this.resumePendingChoices(); };
      this.renderCards(); this.setMode('bossloot');
    }
    /** 收为副将：随行系统的本局临时随从（不进人才库、不写存档），名将自己的首领图 + 名字；有降将专属招式的照样会出（data/surrenderMoves）。 */
    takeFollower(b: GauntletBoss): Follower | null {
      if (this.gFollowers.length >= GAUNTLET.followerMax) { this.gPendingReplace = b; return null; }
      if (!this.followers) { this.followers = new FollowerSquad(this, this.player, [], (qx, qy, r) => this.grid.query(qx, qy, r), (e, dmg, fire) => this.hitEnemy(e, dmg, this.combatNow, fire ? 'fire' : 'melee', true, false), () => this.player.growth.damageMultiplier(this.combatNow)); this.followers.onHitFx = (e, k, fx, fy) => this.followerTemplateHitFx(e, k, fx, fy); this.followers.attackSound = t => this.sfx.play(FOLLOWER_ATTACK_SFX[t]); this.wireFollowerObstacles(this.followers); }
      const r: Recruit = { id: 'gauntlet_' + b.id + '_' + Math.round(this.combatNow), kind: 'named', name: b.name, template: TEMPLATE[b.id] ?? 'blade', quality: GAUNTLET.followerQuality, rank: 0, picks: [], boss: b.id };
      const a = bossArt(b), f = this.followers.addTemp(r, this.player.x + 60, this.player.y + 40);
      f.look = { tex: a.tex, layout: a.layout, size: a.layout === 'arc' ? 108 : 88 }; f.label.setText('副将 · ' + b.name);
      this.gFollowers.push({ f, boss: b }); this.showWaveBanner('收为副将 · ' + b.name, false, `副将 ${this.gFollowers.length}/${GAUNTLET.followerMax}`);
      return f;
    }
    /** 副将满了：选替换谁（或不收）。 */
    private openReplace(nb: GauntletBoss): void {
      const opts: UpgradeOption[] = this.gFollowers.slice(0, 3).map(({ f, boss }) => ({ id: 'gauntlet_replace_' + boss.id, name: '换下 ' + boss.name, desc: `${boss.name}离队，${nb.name}入队`, kind: 'foundation' as const, categoryLabel: '副将', scope: 'run' as const, icon: this.portrait(boss),
        apply: () => { this.dropFollower(f); this.takeFollower(nb); } }));
      opts.push({ id: 'gauntlet_keep', name: '不收 ' + nb.name, desc: '副将不变', kind: 'foundation', categoryLabel: '副将', scope: 'once', icon: this.portrait(nb), apply: () => {} });
      this.showLoot(`副将已满 · 收 ${nb.name} 换下谁`, '选一位离队，或者不收', opts, () => {});
    }
    private dropFollower(f: Follower): void {
      const sq = this.followers; if (!sq) return; const i = sq.members.indexOf(f); if (i >= 0) { f.destroy(); sq.members.splice(i, 1); sq.members.forEach((m, k) => { m.slot = k; }); }
      this.gFollowers = this.gFollowers.filter(x => x.f !== f);
    }
    /** 第十阵斩完：通关，选继续无尽还是收兵结算。 */
    private openClearChoice(): void {
      this.gPhase = 'choice'; writeGauntletBest(this.gKills.length, this.gWave, Math.round(this.elapsed * 1000), isChapterTestRun());
      const opts: UpgradeOption[] = [
        { id: 'gauntlet_endless', name: '继续 · 无尽', desc: '名将再来一轮，一阵比一阵强，直到阵亡\n记最高连斩', kind: 'foundation', categoryLabel: '名将连战', scope: 'run', icon: 'growth_icon_might', apply: () => { this.gEndless = true; } },
        { id: 'gauntlet_settle', name: '收兵 · 结算', desc: '十阵通关，按斩将数领奖', kind: 'foundation', categoryLabel: '名将连战', scope: 'once', icon: 'growth_icon_pickup', apply: () => { this.gPhase = 'done'; } },
      ];
      this.showLoot('名将连战 · 十阵通关', '继续无尽，或者收兵结算', opts, () => { if (this.gEndless) this.nextWave(); else this.time.delayedCall(200, () => this.finish(true, 'boss')); });
    }
    nextWave(): void {
      this.gWave++; this.gPhase = 'mow'; this.gAt = this.elapsed; this.gLootShown = false; this.gEliteAt = GAUNTLET.eliteFirst; this.spawnTimer = .5;
      this.chapter = this.makeChapter(this.gOrder[this.gWave - 1] ?? endlessBoss(this.gPool, this.gKills[this.gKills.length - 1] ?? null));
      this.showWaveBanner(this.gEndless ? `无尽 · 第 ${this.gWave} 阵` : this.gWave === GAUNTLET.waves ? `第 ${this.gWave} 阵 · 守关之战` : `第 ${this.gWave} 阵`, false, `割草 ${GAUNTLET.mowSec} 秒后名将登场`);
    }

    // ———— 结算：打到第几阵、斩了哪些名将（头像一排）、用时、最高连斩；按斩将数给钱币 / 武学残卷 ————
    protected finish(victory: boolean, reason: RunEndReason = 'death') {
      if (this.over) return;
      super.finish(victory, reason);
      const kills = this.gKills.length, debug = this.debugRun(), test = isChapterTestRun(), before = readGauntletBest(test);
      const record = writeGauntletBest(kills, this.gWave, Math.round(this.elapsed * 1000), test), best = Math.max(before.kills, kills);
      let first = false; try { first = this.gCleared && !debug && localStorage.getItem(GAUNTLET.firstClearKey) !== '1'; if (first) localStorage.setItem(GAUNTLET.firstClearKey, '1'); } catch { first = false; }
      const rw = gauntletReward(kills, first); if (!debug) { if (rw.provisions) addProvisions(rw.provisions); if (rw.scrolls) addScrolls(rw.scrolls); }
      const keep = this.resultTexts.body.text.split('\n').filter(l => /^武将等级|^经验已满|^属性点/.test(l));
      const reached = this.gEndless ? `第 ${this.gWave} 阵（无尽）` : `第 ${this.gWave} 阵 / ${GAUNTLET.waves}`;
      this.resultTexts.subtitle.setText(this.gCleared ? (this.gEndless ? `十阵通关 · 无尽斩将 ${kills}` : '十阵连斩 · 通关') : `止步第 ${this.gWave} 阵 · 斩将 ${kills}`);
      // 正文（逻辑 / 测试读；电脑版结算画面按它画奖励格：「永久奖励 钱币 +N」「武学残卷 +N」「武将等级 …」）
      this.resultTexts.body.setText([
        '打到　　' + reached, '斩将　　' + (kills ? kills + ' 位：' + this.gKills.map(b => b.name).join('、') : '无'), '用时　　' + this.formatTime(this.elapsed),
        '最高连斩　' + best + (record ? '　新纪录！' : ''), ...(debug ? ['名将连战  测试战斗不入库'] : [`永久奖励  钱币 +${rw.provisions}`, `武学残卷  +${rw.scrolls}`, ...(first ? ['首次通关  名将连战大奖'] : [])]), ...keep,
      ].join('\n'));
      this.gResult = { kills, best, record }; this.presentResult(victory);
      const home = this.resultPanel.getByName('result-home') as Phaser.GameObjects.Text | null;
      home?.setText('返回天下地图').removeAllListeners('pointerdown').on('pointerdown', () => { this.registry.set('mapFocusNode', 'gauntlet'); this.scene.start('WorldMapScene'); });
      const restart = this.resultPanel.getByName('result-restart') as Phaser.GameObjects.Image | null;
      restart?.removeAllListeners('pointerdown').on('pointerdown', () => this.scene.restart());
    }
    /** 结算画面（电脑版）：基类画完奖励格以后，底下一行战况换成本模式的、副标题下面排斩将头像（基类可能晚些再画一遍，所以挂在这里）。 */
    private gResult: { kills: number; best: number; record: boolean } | null = null;
    protected presentResult(victory: boolean): void {
      super.presentResult(victory); const r = this.gResult; if (!r || !this.resultPanel) return; const { kills, best, record } = r;
      for (const o of [...this.resultPanel.list]) if (o.name.startsWith('gauntlet-face')) o.destroy();
      // 电脑版：底下一行战况换成本模式的（第几阵 · 斩将 · 用时 · 最高连斩）；斩将头像排在分隔线下面
      (this.resultPanel.getByName('result-stats') as Phaser.GameObjects.Text | null)?.setText([`第 ${this.gWave} 阵`, `斩将 ${kills} 位`, '用时 ' + this.formatTime(this.elapsed), `最高连斩 ${best}${record ? '（新纪录）' : ''}`].join('　·　'));
      // 斩将一排（11-21 总制作人「头像太小」）：每位一块同尺寸的底牌，人像裁掉留白后等比放进底牌、脚踩同一条底线，名字在牌下；最多 12 位（无尽多了取最后 12 位）
      const row = this.gKills.slice(-12), n = row.length; if (!n) return;
      const PW = 76, PH = 92, gap = n > 10 ? 10 : 16, w = n * PW + (n - 1) * gap, x0 = this.resultTexts.subtitle.x - w / 2 + PW / 2, top = this.resultTop + 146, cy = top + PH / 2;
      row.forEach((b, i) => {
        const x = x0 + i * (PW + gap), plate = this.add.rectangle(x, cy, PW, PH, 0x1a120b, .72).setStrokeStyle(1.5, 0xd9b46a, .8).setScrollFactor(0).setName('gauntlet-face-plate');
        const img = this.add.image(x, top + PH - 6, this.portrait(b)).setOrigin(.5, 1).setScrollFactor(0).setName('gauntlet-face'); img.setScale(Math.min((PW - 10) / img.width, (PH - 12) / img.height));
        const t = this.add.text(x, top + PH + 7, b.name, { fontFamily: HEADING_FONT, fontSize: '15px', color: '#f0dcae', resolution: 2 }).setOrigin(.5, 0).setStroke('#1a120b', 3).setScrollFactor(0).setName('gauntlet-face-name');
        this.resultPanel.add([plate, img, t]);
      });
      // 奖励格挪到头像排下面（基类按分隔线到要事之间居中摆，会和头像排重叠）
      const rw = this.resultPanel.getByName('result-rewards') as Phaser.GameObjects.Container | null, below = top + PH + 36;
      if (rw) { const empty = rw.list.length === 1 && rw.list[0] instanceof Phaser.GameObjects.Text; /* 「本场没有新的奖励」一行字：容器原点在字中间 */ rw.setY(Math.max(rw.y, empty ? below + 14 : below)); }
    }
    /** 测试用：当前名将控制器（招式框架 / 专属）。 */
    get gauntletCtrl() { return this.gCtrl; }
    get gauntletFollowers() { return this.gFollowers; }
  };
}
