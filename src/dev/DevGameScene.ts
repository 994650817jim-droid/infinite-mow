import { BALANCE, DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, IS_DESKTOP } from '../config';
import type { EnemyDef } from '../data/enemies';
import type { RelicSchool } from '../data/relics';
import { Enemy } from '../entities/Enemy';
import { Ally, type AllyKind } from '../entities/Ally';
import { createDevPanel } from './DevPanel';
import { GUANDAO_TABLE, SPEAR_PIERCE, WEAPON_DEFS } from '../weapons/registry';
import type { RunStats, WeaponState } from '../types';
import { GameScene } from '../scenes/GameScene';

/** Only imported by main.ts in a Vite DEV build. Never shipped in production. */
export class DevGameScene extends GameScene {
  private disposePanel: (() => void) | undefined;
  private disposeVisibility: (() => void) | undefined;

  protected override installDevelopment(): void {
    this.installDebug();
    this.devText = this.add.text(16, GAME_HEIGHT - 74, '', { fontFamily: FONT, fontSize: '11px', color: '#8a8078' })
      .setScrollFactor(0).setDepth(DEPTH.hud + 2);
    this.setupPerfMode();
    if (new URLSearchParams(window.location.search).get('dev') === '1') this.setupDevPanel();
  }

  protected override disposeDevelopment(): void {
    this.disposePanel?.();
    this.disposePanel = undefined;
    this.disposeVisibility?.();
    this.disposeVisibility = undefined;
    delete (window as unknown as { __IM?: unknown }).__IM;
    delete (window as unknown as { __DEV_INFO?: unknown }).__DEV_INFO;
  }

  protected override onRunFinished(stats: RunStats): void {
    const api = (window as unknown as { __IM?: { lastResult?: RunStats } }).__IM;
    if (api) api.lastResult = stats;
  }

  private devSetTime(t: number): void {
    this.elapsed = t;
    this.debugJumped = true;
    this.debugModified = true;
  }

  private devLevelUp(): void {
    this.player.level += 1;
    this.debugModified = true;
  }

  private setupDevPanel(): void {
    const scene = this;
    const mark = (): void => { scene.debugModified = true; };
    const ensureBoss = (): void => {
      if (!scene.boss || !scene.boss.active) scene.spawnBoss();
      if (scene.boss) scene.boss.hp = scene.boss.maxHp;
      mark();
    };
    const actions: Record<string, () => void> = {
      chapter1: () => { scene.registry.remove('campaignTransfer'); scene.registry.set('runConfig', { ...scene.runConfig, chapter: 'huangjin' }); scene.scene.restart(); },
      chapter2: () => { scene.registry.remove('campaignTransfer'); scene.registry.set('runConfig', { ...scene.runConfig, chapter: 'hulao' }); scene.scene.restart(); },
      selectStart: () => { scene.scene.start('MenuScene'); },
      'level+1': () => { scene.devLevelUp(); },
      level5: () => { while (scene.player.level < 5) scene.devLevelUp(); },
      level10: () => { while (scene.player.level < 10) scene.devLevelUp(); },
      wave1: () => { scene.devSetTime(scene.chapter.waves[0]?.start + .1); mark(); },
      wave2: () => { scene.devSetTime(scene.chapter.waves[1]?.start + .1); mark(); },
      wave3: () => { scene.devSetTime(scene.chapter.waves[2]?.start + .1); mark(); },
      wave4: () => { scene.devSetTime(scene.chapter.waves[3]?.start + .1); mark(); },
      wave5: () => { scene.devSetTime(scene.chapter.waves[4]?.start + .1); mark(); },
      wave6: () => { scene.devSetTime(scene.chapter.waves[5]?.start + .1); mark(); },
      wave7: () => { if (scene.chapter.waves[6]) scene.devSetTime(scene.chapter.waves[6].start + .1); },
      wave8: () => { if (scene.chapter.waves[7]) scene.devSetTime(scene.chapter.waves[7].start + .1); },
      'time+10': () => { scene.devSetTime(scene.elapsed + 10); mark(); },
      'speed0.5': () => { scene.devTimeScale = 0.5; mark(); },
      speed1: () => { scene.devTimeScale = 1; mark(); },
      speed2: () => { scene.devTimeScale = 2; mark(); },
      speed4: () => { scene.devTimeScale = 4; mark(); },
      boss: () => { ensureBoss(); },
      boss50: () => { if (scene.boss) scene.boss.hp = scene.boss.maxHp * 0.5; mark(); },
      bossEnergy: () => { scene.bossEnergy = 100; if (scene.lubu) scene.lubu.energy = 100; mark(); },
      bossUlt: () => { if (scene.lubu) scene.lubu.tryUltimate(scene.combatNow); if (scene.boss && !scene.lubu) scene.startBossUltimate(scene.combatNow); mark(); },
      weaponSpear1: () => { scene.devGiveWeapon('spear_orbit', 1); },
      weaponSpear5: () => { scene.devGiveWeapon('spear_orbit', 5); },
      weaponBow3: () => { scene.devGiveWeapon('crossbow', 3); },
      weaponFlag3: () => { scene.devGiveWeapon('flame_banner', 3); },
      clearWeapons: () => { scene.player.weapons = []; mark(); },
      allySword: () => { scene.devSpawnAlly('swordsman'); },
      allyArcher: () => { scene.devSpawnAlly('archer'); },
      allySpear: () => { scene.devSpawnAlly('spearman'); },
      allyLevel3: () => { for (const k of ['swordsman', 'spearman', 'archer', 'crossbowman', 'guardian', 'rider', 'halberdier', 'medic'] as AllyKind[]) while (scene.legion.levels[k] < 3) scene.legion.train(k, true); mark(); },
      legionFood: () => { scene.legion.food += 100; mark(); },
      legionEight: () => { for (const k of ['swordsman', 'spearman', 'archer', 'crossbowman', 'guardian', 'rider', 'halberdier', 'medic'] as AllyKind[]) scene.legion.recruit(k, 3, true); mark(); },
      aid: () => { scene.reinforcements.nextAt = scene.elapsed; mark(); },
      clearAllies: () => { scene.devClearAllies(); },
      heal: () => { scene.player.hp = scene.player.maxHp; mark(); },
      god: () => { scene.player.damageImmune = !scene.player.damageImmune; mark(); },
      enemy50: () => { for (let i = 0; i < 50; i += 1) scene.spawnAroundPlayer('infantry'); mark(); },
      enemy150: () => { for (let i = 0; i < 150; i += 1) scene.spawnAroundPlayer('infantry'); mark(); },
      clearEnemies: () => { scene.devClearEnemies(); },
      movementNew: () => { scene.crowdSteering = true; for (const e of scene.enemies) e.moveVx = e.moveVy = 0; mark(); },
      movementOld: () => { scene.crowdSteering = false; for (const e of scene.enemies) e.moveVx = e.moveVy = 0; mark(); },
      presetLow: () => { scene.devPreset('low'); },
      presetNormal: () => { scene.devPreset('normal'); },
      presetStrong: () => { scene.devPreset('strong'); },
      reset: () => { scene.devTimeScale = 1; scene.scene.restart(); },
    };
    this.disposePanel?.();
    this.disposePanel = createDevPanel(actions);
    (window as unknown as { __DEV_INFO?: () => string }).__DEV_INFO = () => {
      const fps = Math.round(scene.game.loop.actualFps);
      const enemies = scene.enemies.filter((e) => e.active).length;
      const allies = scene.allies.length;
      return `FPS ${fps} | 敌 ${enemies} | 蜀军 ${allies} | 等级 ${scene.player.level} | 时间 ${scene.elapsed.toFixed(1)}s | 无敌:${scene.player.damageImmune ? '开' : '关'} | 修改:${scene.debugModified ? '是' : '否'}`;
    };
    (this as unknown as { __DEV_ACTIONS?: Record<string, () => void> }).__DEV_ACTIONS = actions;
  }

  private devGiveWeapon(id: string, level: number): void {
    this.debugModified = true;
    const existing = this.player.weapons.find((w) => w.id === id);
    if (existing) existing.level = level;
    else this.player.weapons.push({ id, level, cooldownLeft: 0 } as WeaponState);
  }

  private devSpawnAlly(kind: AllyKind): void {
    this.debugModified = true;
    this.legion.recruit(kind, 1, true);
  }

  private devClearAllies(): void {
    this.debugModified = true;
    this.legion.clear();
  }

  private devClearEnemies(): void {
    this.debugModified = true;
    for (const e of this.enemies) if (e.active) e.deactivate();
    this.boss = null;
    this.lubu?.clear();
    this.lubu = null;
    this.bossPhase2 = false;
    this.bossShield = 0;
    this.bossShieldGfx?.clear();
    this.bossSpawned = false;
  }

  private devPreset(kind: 'low' | 'normal' | 'strong'): void {
    this.debugModified = true;
    this.player.weapons = [];
    this.devClearAllies();
    this.player.hp = this.player.maxHp;
    if (kind === 'low') {
      this.devGiveWeapon('spear_orbit', 1);
      this.devSpawnAlly('swordsman');
      return;
    }
    this.devGiveWeapon('spear_orbit', kind === 'strong' ? 5 : 3);
    this.devGiveWeapon('crossbow', kind === 'strong' ? 5 : 2);
    this.devGiveWeapon('flame_banner', kind === 'strong' ? 5 : 2);
    const n = kind === 'strong' ? 5 : 3;
    for (let i = 0; i < n; i += 1) this.devSpawnAlly(i % 3 === 0 ? 'swordsman' : i % 3 === 1 ? 'archer' : 'spearman');
  }

  private setupPerfMode(): void {
    if (!import.meta.env.DEV) return;
    if (!new URLSearchParams(window.location.search).has('perf')) return;
    const panel = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay + 500);
    const bg = this.add.rectangle(0, 92, GAME_WIDTH, 270, 0x000000, 0.82).setOrigin(0, 0);
    const text = this.add.text(16, 100, '', {
      fontFamily: FONT,
      fontSize: '15px',
      color: '#f5efe6',
      lineSpacing: 7,
    });
    const summary = this.add.text(14, 98, 'FPS -- | 敌 -- | 展开报告', {
      fontFamily: FONT,
      fontSize: '13px',
      color: '#f5efe6',
    });
    const copyBg = this.add.rectangle(16, 322, 200, 36, 0x9a7a34, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    const copyText = this.add.text(116, 340, '复制测试报告', { fontFamily: FONT, fontSize: '14px', color: '#14100c' }).setOrigin(0.5);
    copyBg.on('pointerdown', () => this.copyPerfReport());
    const toggle = this.add
      .text(GAME_WIDTH - 16, 100, '收起', { fontFamily: FONT, fontSize: '14px', color: '#a89c8c' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    toggle.on('pointerdown', () => this.togglePerfPanel());
    panel.add([bg, text, copyBg, copyText, toggle, summary]);
    this.perf = {
      panel,
      bg,
      text,
      summary,
      copyBg,
      copyText,
      toggle,
      collapsed: true, // 默认收起，不挡视野；点「展开」查看详情
      frameMs: [],
      samples: [],
      startAt: performance.now(),
      acc: 0,
      playMs: 0,
      pausedMs: 0,
      backgroundMs: 0,
      hiddenAt: 0,
      maxEnemies: 0,
      maxProjectiles: 0,
    };
    const onVisibility = (): void => {
      if (!this.perf) return;
      if (document.hidden) this.perf.hiddenAt = performance.now();
      else if (this.perf.hiddenAt) {
        this.perf.backgroundMs += performance.now() - this.perf.hiddenAt;
        this.perf.hiddenAt = 0;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.disposeVisibility = () => document.removeEventListener('visibilitychange', onVisibility);
    this.applyPerfPanelState(); // 初始为收起
  }

  private togglePerfPanel(): void {
    if (!this.perf) return;
    this.perf.collapsed = !this.perf.collapsed;
    this.applyPerfPanelState();
  }

  private applyPerfPanelState(): void {
    if (!this.perf) return;
    if (this.perf.collapsed) {
      // 收起：只留底部一行，几乎不挡视野
      this.perf.bg.setPosition(0, 92).setDisplaySize(340, 34).setAlpha(0.7);
      this.perf.text.setVisible(false);
      this.perf.copyBg.setVisible(false);
      this.perf.copyText.setVisible(false);
      this.perf.summary.setVisible(true).setPosition(14, 99);
      this.perf.toggle.setText('展开');
      this.perf.toggle.setPosition(316, 99);
    } else {
      this.perf.bg.setPosition(0, 92).setDisplaySize(GAME_WIDTH, 270).setAlpha(0.82);
      this.perf.text.setVisible(true).setPosition(16, 100);
      this.perf.copyBg.setVisible(true);
      this.perf.copyText.setVisible(true);
      this.perf.summary.setVisible(false);
      this.perf.toggle.setText('收起');
      this.perf.toggle.setPosition(GAME_WIDTH - 16, 100);
    }
  }

  private timeStats(): { gameSec: number; playSec: number; pausedSec: number; backgroundSec: number; deviation: number | null } {
    const playSec = (this.perf?.playMs ?? 0) / 1000 + (this.elapsed > 0 ? 0 : 0);
    const validPlay = Math.max(playSec, 0.001);
    const deviation = this.debugJumped ? null : Math.abs(this.elapsed - validPlay) / validPlay;
    return {
      gameSec: this.elapsed,
      playSec,
      pausedSec: (this.perf?.pausedMs ?? 0) / 1000,
      backgroundSec: (this.perf?.backgroundMs ?? 0) / 1000,
      deviation,
    };
  }

  private lowFps(): number {
    if (!this.perf || this.perf.frameMs.length < 20) return 0;
    const sorted = [...this.perf.frameMs].sort((a, b) => a - b);
    const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
    return p99 > 0 ? Math.round(1000 / p99) : 0;
  }

  private bucketStats(): Array<{ label: string; fps: number | null; samples: number; enough: boolean }> {
    const buckets = [0, 50, 100, 150];
    const MIN_SAMPLES = 40; // 40 个半秒样本 = 20 秒
    return buckets.map((min, idx) => {
      const max = idx === buckets.length - 1 ? Infinity : buckets[idx + 1];
      const list = (this.perf?.samples ?? []).filter((x) => x.enemies >= min && x.enemies < max);
      const enough = list.length >= MIN_SAMPLES;
      const fps = enough ? Math.round(list.reduce((sum, x) => sum + x.fps, 0) / list.length) : null;
      return { label: idx === buckets.length - 1 ? `${min}+` : `${min}-${max - 1}`, fps, samples: list.length, enough };
    });
  }

  protected override updatePerf(dt: number): void {
    if (!this.perf) return;
    this.perf.acc += dt;
    if (this.perf.acc < 0.5) return;
    this.perf.acc = 0;
    const fps = this.game.loop.actualFps;
    const enemies = this.activeEnemyCount();
    this.perf.samples.push({ fps, enemies });
    if (this.perf.samples.length > 600) this.perf.samples.shift();
    const projectiles = this.bolts.filter((b) => b.active).length + this.bullets.filter((b) => b.active).length;
    this.perf.maxEnemies = Math.max(this.perf.maxEnemies, enemies);
    this.perf.maxProjectiles = Math.max(this.perf.maxProjectiles, projectiles);
    if (this.perf.collapsed) {
      this.perf.summary.setText(`FPS ${Math.round(fps)} | 敌 ${enemies} | 时间 ${this.formatTime(this.elapsed)} | 展开报告`);
      return;
    }
    const t = this.timeStats();
    const avg = this.perf.samples.reduce((sum, x) => sum + x.fps, 0) / this.perf.samples.length;
    const low = this.lowFps();
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    this.perf.text.setText(
      [
        `FPS 当前 ${Math.round(fps)}  平均 ${Math.round(avg)}(全部样本)  1% Low ${low || '采样中'}(600帧)`,
        `敌 ${enemies} / 峰值 ${this.perf.maxEnemies}   弹 ${projectiles} / 峰值 ${this.perf.maxProjectiles}`,
        `游戏 ${this.formatTime(t.gameSec)}  有效前台 ${this.formatTime(t.playSec)}  暂停 ${this.formatTime(t.pausedSec)}`,
        `后台 ${this.formatTime(t.backgroundSec)}  时间偏差 ${t.deviation === null ? 'N/A(调试)' : (t.deviation * 100).toFixed(1) + '%'}`,
        `内存 ${mem ? Math.round(mem.usedJSHeapSize / 1048576) + 'MB' : 'N/A'}   模式 ${this.mode}   击杀 ${this.kills}   等级 ${this.player.level}`,
      ].join('\n'),
    );
  }

  private copyPerfReport(): void {
    if (!this.perf) return;
    const t = this.timeStats();
    const buckets = this.bucketStats();
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const report = [
      '《无限割草：乱世千军》手机测试报告',
      `UA: ${navigator.userAgent}`,
      `屏幕: ${window.screen.width}x${window.screen.height} DPR=${window.devicePixelRatio}`,
      `运行类型: ${this.debugJumped ? '调试(设过时间)' : '正常'}`,
      `FPS 平均: ${Math.round(this.perf.samples.reduce((sum, x) => sum + x.fps, 0) / Math.max(1, this.perf.samples.length))} (窗口: 全部半秒样本, ${this.perf.samples.length} 个)`,
      `1% Low(帧耗时): ${this.lowFps() || 'N/A'} (窗口: 最近 600 个有效游玩帧)`,
      ...buckets.map((b) => `分档 ${b.label} 敌: ${b.enough ? b.fps + ' FPS' : '样本不足'} (样本 ${b.samples}/40)`),
      `游戏时间: ${this.formatTime(t.gameSec)}  有效前台: ${this.formatTime(t.playSec)}  暂停: ${this.formatTime(t.pausedSec)}  后台: ${this.formatTime(t.backgroundSec)}`,
      `时间偏差: ${t.deviation === null ? 'N/A(调试)' : (t.deviation * 100).toFixed(1) + '%'}`,
      `峰值敌人: ${this.perf.maxEnemies}  峰值投射物: ${this.perf.maxProjectiles}`,
      `内存: ${mem ? Math.round(mem.usedJSHeapSize / 1048576) + 'MB' : 'N/A'}`,
      `结果: ${this.over ? (this.victory ? '胜利' : '失败') : '进行中'}  击杀: ${this.kills}  等级: ${this.player.level}`,
      `时间: ${new Date().toISOString()}`,
    ].join('\n');
    void navigator.clipboard?.writeText(report).then(
      () => this.perf?.text.setText('报告已复制到剪贴板'),
      () => window.prompt('复制以下报告:', report),
    );
  }

  private installDebug(): void {
    const scene = this;
    const api = {
      get fps(): number {
        return Math.round(scene.game.loop.actualFps);
      },
      get enemies(): number {
        return scene.activeEnemyCount();
      },
      get elapsed(): number {
        return scene.elapsed;
      },
      get kills(): number {
        return scene.kills;
      },
      get level(): number {
        return scene.player.level;
      },
      get hp(): number {
        return Math.round(scene.player.hp);
      },
      get mode(): string {
        return scene.mode;
      },
      get bossActive(): boolean {
        return !!scene.boss && scene.boss.active;
      },
      get weapons(): WeaponState[] {
        return scene.player.weapons.map((w) => ({ ...w }));
      },
      lastResult: null as RunStats | null,
      setMove(x: number, y: number): void {
        scene.debugMove.set(x, y);
        scene.debugMoveActive = true;
      },
      clearMove(): void {
        scene.debugMoveActive = false;
        scene.debugMove.set(0, 0);
      },
      setCrowdSteering(enabled: boolean): void {
        scene.crowdSteering = enabled;
        for (const e of scene.enemies) e.moveVx = e.moveVy = 0;
      },
      setTime(t: number): void {
        scene.elapsed = t;
        scene.debugJumped = true;
      },
      spawnBoss(): void {
        scene.spawnBoss();
      },
      addLevel(): void {
        scene.pendingLevels += 1;
        if (scene.mode === 'none') scene.openUpgrade();
      },
      choose(index: number): void {
        scene.chooseUpgrade(index);
      },
      finish(victory: boolean): void {
        scene.finish(victory, victory ? 'boss' : 'death');
      },
      god(): void {
        scene.player.damageImmune = true;
      },
      heal(): void {
        scene.player.hp = scene.player.maxHp;
      },
      spawnEnemies(n: number): void {
        for (let i = 0; i < n; i += 1) scene.spawnAroundPlayer('infantry');
      },
      spawnAt(kind: string, x: number, y: number): void {
        scene.spawnEnemy(kind as EnemyDef['kind'], x, y, undefined, true);
      },
      enemiesInfo(): Array<{ kind: string; hp: number; x: number; y: number; active: boolean; spawnId: number }> {
        return scene.enemies
          .filter((e) => e.active)
          .map((e) => ({ kind: e.kind, hp: Math.round(e.hp), x: Math.round(e.x), y: Math.round(e.y), active: e.active, spawnId: e.spawnId }));
      },
      killAllEnemies(): void {
        for (const e of scene.enemies) if (e.active) e.deactivate();
      },
      giveWeapon(id: string): void {
        if (!scene.player.weapons.some((w) => w.id === id)) {
          scene.player.weapons.push({ id: id as WeaponState['id'], level: 1, cooldownLeft: 0 });
        }
      },
      clearWeapons(): void {
        scene.player.weapons = [];
      },
      bounceChains(): number[][] {
        return scene.debugChains.map((c) => [...c]);
      },
      gemsInfo(): Array<{ x: number; y: number; vx: number; vy: number; restMs: number; active: boolean }> {
        return scene.gems.filter((gem) => gem.active).map((gem) => ({ x: gem.img.x, y: gem.img.y, vx: gem.vx, vy: gem.vy, restMs: gem.restMs, active: gem.active }));
      },
      giveRelic(id: string): boolean {
        return scene.player.addRelic(id);
      },
      relicsInfo(): { relics: string[]; stats: Record<string, number>; schools: Record<string, number> } {
        const p = scene.player;
        return {
          relics: [...p.relics],
          stats: {
            damageMul: p.stats.damageMul, meleeMul: p.stats.meleeMul, arrowMul: p.stats.arrowMul, fireMul: p.stats.fireMul,
            fireAreaMul: p.stats.fireAreaMul, damageTakenMul: p.stats.damageTakenMul,
            cooldownMul: p.stats.cooldownMul, critChance: p.stats.critChance, maxHpBonus: p.stats.maxHpBonus,
            armor: p.stats.armor, regen: p.stats.regen,
          },
          schools: { wushuang: p.schoolCount('wushuang'), shenshe: p.schoolCount('shenshe'), lieyan: p.schoolCount('lieyan'), tiebi: p.schoolCount('tiebi') },
        };
      },
      upgradeOptions(): Array<{ kind: string; id: string; name: string; relicId?: string; school?: string }> {
        return scene.upgradeOptions.map((o) => ({ kind: o.kind, id: o.id, name: o.name, relicId: o.relicId, school: o.school }));
      },
      musicInfo(): { playing: boolean; muted: boolean; step: number; volume: number } {
        return { playing: scene.music.playingState, muted: scene.music.mutedState, step: scene.music.currentStep, volume: scene.music.getVolume() };
      },
      volumeInfo(): { bgm: number; sfx: number } {
        return { bgm: scene.music.getVolume(), sfx: scene.sfx.getVolume() };
      },
      setVolumes(bgm: number, sfx: number): void {
        scene.music.setVolume(bgm);
        scene.sfx.setVolume(sfx);
      },
      recruitInfo(): { mode: string; options: Array<{ kind: string; upgrade: boolean }> } {
        return { mode: scene.mode, options: scene.recruitOptions.map((o) => ({ ...o })) };
      },
      openRecruit(): void { scene.openRecruit(); },
      chooseRecruit(index: number): void { scene.chooseRecruit(index); },
      spawnAlly(kind: 'swordsman' | 'archer' | 'spearman' = 'swordsman'): void {
        scene.legion.recruit(kind, 1, true);
      },
      allyInfo(): Array<{ x: number; y: number; active: boolean }> {
        return scene.allies.map((a) => ({ x: Math.round(a.x), y: Math.round(a.y), active: a.active }));
      },
      spearInfo(): { shots: number; cooldown: number; level: number } {
        const w = scene.player.weapons.find((x) => x.id === 'spear_orbit');
        return { shots: scene.spearShots.length, cooldown: w ? w.cooldownLeft : -1, level: w ? w.level : 0 };
      },
      guandaoTable(): typeof GUANDAO_TABLE { return GUANDAO_TABLE; },
      spearTable(): typeof SPEAR_PIERCE { return SPEAR_PIERCE; },
      weaponDefs(): Array<{ id: string; name: string; maxLevel: number }> {
        return Object.values(WEAPON_DEFS).map((d) => ({ id: d.id, name: d.name, maxLevel: d.maxLevel }));
      },
      weaponInfo(): Array<{ id: string; level: number; cooldown: number; damage: number; name: string }> {
        return scene.player.weapons.map((w) => {
          const def = WEAPON_DEFS[w.id];
          return { id: w.id, level: w.level, cooldown: def ? def.cooldown(w.level, scene.player.stats) : 0, damage: def ? def.damage(w.level, scene.player.stats) : 0, name: def ? def.name : w.id };
        });
      },
      devInfo(): { modified: boolean; level: number; wave: number; time: number; allies: number; boss: boolean; timeScale: number; panel: boolean } {
        return {
          modified: scene.debugModified,
          level: scene.player.level,
          wave: scene.waveIndex,
          time: scene.elapsed,
          allies: scene.allies.length,
          boss: !!scene.boss && scene.boss.active,
          timeScale: scene.devTimeScale,
          panel: !!document.getElementById('dev-panel'),
        };
      },
      devAction(name: string): void {
        const actions = (scene as unknown as { __DEV_ACTIONS?: Record<string, () => void> }).__DEV_ACTIONS;
        actions?.[name]?.();
      },
      bossInfo(): { active: boolean; hpPct: number; maxHp: number; energy: number; ultPhase: string; round: number; phase2: boolean; shield: number } {
        const b = scene.boss;
        return { active: !!b && b.active, hpPct: b ? Math.round((b.hp / b.maxHp) * 100) : 0, maxHp: b ? b.maxHp : 0, energy: Math.round(scene.lubu?.energy ?? scene.bossEnergy), ultPhase: scene.lubu ? scene.lubu.ultimateInfo().phase : scene.bossUltPhase, round: scene.bossUltRound, phase2: scene.bossPhase2, shield: Math.round(scene.bossShield) };
      },
      setBossEnergy(value: number): void { scene.bossEnergy = Math.max(0, Math.min(100, value)); if (scene.lubu) scene.lubu.energy = scene.bossEnergy; },
      damageSplit(): { player: number; ally: number; total: number } {
        return { player: Math.round(scene.playerDamageDealt), ally: Math.round(scene.allyDamageDealt), total: Math.round(scene.damageDealt) };
      },
      waveInfo(): { index: number; name: string; count: number } {
        return { index: scene.waveIndex, name: scene.waveIndex >= 0 ? scene.chapter.waves[scene.waveIndex].name : '', count: scene.chapter.waves.length };
      },
      toggleMusic(): boolean { return scene.music.toggle(); },
      sfxStats(): Record<string, { triggered: number; played: number; dropped: number }> {
        return scene.sfx.getStats();
      },
      setMuted(muted: boolean): void { scene.sfx.setMuted(muted); },
      cavalryInfo(): Array<{ state: string; hit: boolean; x: number; y: number }> {
        return scene.enemies
          .filter((e) => e.active && e.kind === 'cavalry')
          .map((e) => ({ state: e.chargeState, hit: e.chargeHit, x: e.x, y: e.y }));
      },
      setEnemyWalk(enabled: boolean): void {
        Enemy.walkEnabled = enabled;
        for (const enemy of scene.enemies) {
          if (!enemy.active) continue;
          enemy.walkSheet = '';
          enemy.sprite.setTexture(enemy.def.texture);
          enemy.sprite.setScale(enemy.baseScaleY);
        }
      },
      spawnGemAt(x: number, y: number, value = 1): void {
        scene.spawnGem(x, y, value);
      },
      restart(): void {
        scene.scene.restart();
      },
      chapterInfo(): { id: string; name: string; boss: string; waves: readonly { start: number; name: string }[]; recruits: readonly number[] } {
        return { id: scene.chapter.id, name: scene.chapter.name, boss: scene.chapter.bossName, waves: scene.chapter.waves, recruits: scene.chapter.recruitWaves };
      },
      lubuInfo() { return scene.lubu?.snapshot() ?? null; },
      snapshot(): Record<string, unknown> {
        return {
          fps: scene.game.loop.actualFps,
          enemies: scene.activeEnemyCount(),
          elapsed: scene.elapsed,
          kills: scene.kills,
          level: scene.player.level,
          hp: scene.player.hp,
          maxHp: scene.player.maxHp,
          mode: scene.mode,
          runConfig: { ...scene.runConfig },
          direction: scene.player.direction,
          walkSheet: scene.player.walkSheet,
          heroTexture: scene.player.sprite.texture.key,
          heroFrame: scene.player.sprite.frame.name,
          boss: !!scene.boss && scene.boss.active,
          scroll: { x: scene.cameras.main.scrollX, y: scene.cameras.main.scrollY, tileX: scene.ground.tilePositionX, tileY: scene.ground.tilePositionY },
          projectiles: scene.bolts.filter((b) => b.active).length + scene.bullets.filter((b) => b.active).length,
          player: { x: scene.player.x, y: scene.player.y },
          weapons: scene.player.weapons.map((w) => ({ id: w.id, level: w.level })),
        };
      },
    };
    (window as unknown as { __IM?: typeof api }).__IM = api;
  }
}
