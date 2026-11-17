import { BALANCE, DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, IS_DESKTOP, switchLayout } from '../config';
import type { EnemyDef } from '../data/enemies';
import type { RelicSchool } from '../data/relics';
import { Enemy } from '../entities/Enemy';
import { Ally, type AllyKind } from '../entities/Ally';
import Phaser from 'phaser';
import { createDevPanel, type DevSection } from './DevPanel';
import { getCharacter } from '../data/characters';
import { TROOPS } from '../data/legion';
import { TACTICS, TAG_NAMES, type TacticId } from '../data/builds';
import { chapterBossTime } from '../data/chapters';
import { waveIndexAt } from '../data/waves';
import { GUANDAO_TABLE, SPEAR_PIERCE, WEAPON_DEFS } from '../weapons/registry';
import type { RunStats, WeaponState } from '../types';
import { GameScene } from '../scenes/GameScene';

/** Only imported by main.ts in a Vite DEV build. Never shipped in production. */
export class DevGameScene extends GameScene {
  private disposePanel: (() => void) | undefined;
  private disposeVisibility: (() => void) | undefined;

  protected override installDevelopment(): void {
    this.installDebug();
    this.devText = this.add.text(16, GAME_HEIGHT - 8, '', { fontFamily: FONT, fontSize: '11px', color: '#8a8078' })
      .setOrigin(0,1).setResolution(2).setStroke('#111710',2).setScrollFactor(0).setDepth(DEPTH.hud + 2);
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

  /** DEV 面板：按当前局动态生成按钮；保留旧动作名供既有测试脚本使用。 */
  private setupDevPanel(): void {
    const scene = this;
    const mark = (): void => { scene.debugModified = true; };
    const ensureBoss = (): void => {
      if (!scene.boss || !scene.boss.active) scene.spawnBoss();
      if (scene.boss) scene.boss.hp = scene.boss.maxHp;
      mark();
    };
    const nativeWeapon = (): string => getCharacter(scene.player.growth.character).startWeapon;
    const kinds: AllyKind[] = ['swordsman', 'spearman', 'archer', 'crossbowman', 'guardian', 'rider', 'halberdier', 'medic'];
    const waves = scene.chapter.waves;
    const actions: Record<string, () => void> = {
      worldMap: () => { scene.registry.remove('campaignTransfer'); scene.scene.start('WorldMapScene'); },
      homeCity: () => { scene.registry.remove('campaignTransfer'); scene.scene.start('CityScene'); },
      chapter1: () => { scene.registry.remove('campaignTransfer'); scene.registry.remove('thirdTransfer'); scene.registry.set('runConfig', { character: scene.runConfig.character, chapter: 'huangjin', stage: 1 }); scene.scene.start('GameScene'); },
      chapter2: () => { scene.registry.remove('campaignTransfer'); scene.registry.remove('thirdTransfer'); scene.registry.set('runConfig', { character: scene.runConfig.character, chapter: 'hulao', westStage: 1 }); scene.scene.start('GameScene'); },
      chapter3: () => { scene.registry.remove('campaignTransfer'); scene.scene.start('ThirdChapterScene'); },
      chapter4: () => { scene.registry.remove('campaignTransfer'); scene.scene.start('GuanduChapterScene'); },
      selectStart: () => { scene.scene.start('MenuScene'); },
      reset: () => { scene.devTimeScale = 1; scene.scene.restart(); },
      layoutMobile: () => { if (IS_DESKTOP) switchLayout('mobile'); },
      layoutDesktop: () => { if (!IS_DESKTOP) switchLayout('desktop'); },
      // 成长：走真实升级流程（出现三选一），不再只改等级数字。
      'level+1': () => { scene.devGrantLevels(1, false); },
      level5: () => { scene.devGrantLevels(Math.max(0, 5 - scene.player.level), true); },
      level10: () => { scene.devGrantLevels(Math.max(0, 10 - scene.player.level), true); },
      autoLevel5: () => { scene.devGrantLevels(5, true); },
      weaponNative1: () => { scene.devGiveWeapon(nativeWeapon(), 1); },
      weaponNative3: () => { scene.devGiveWeapon(nativeWeapon(), 3); },
      weaponNative5: () => { scene.devGiveWeapon(nativeWeapon(), 5); },
      randomTactic: () => { const b = scene.player.growth.build, ids = (Object.keys(TACTICS) as TacticId[]).filter(id => b.canLearn(id)); if (ids.length) { b.learn(ids[Math.floor(Math.random() * ids.length)]); mark(); } },
      attributes4: () => { scene.player.growth.addAttributePoints(4); mark(); },
      // 旧动作名（测试脚本兼容）：非本命武器仅用于混搭测试。
      weaponSpear1: () => { scene.devGiveWeapon('spear_orbit', 1); },
      weaponSpear5: () => { scene.devGiveWeapon('spear_orbit', 5); },
      weaponBow3: () => { scene.devGiveWeapon('crossbow', 3); },
      weaponFlag3: () => { scene.devGiveWeapon('flame_banner', 3); },
      clearWeapons: () => { scene.player.weapons = []; mark(); },
      'time+10': () => { scene.devSetTime(scene.elapsed + 10); mark(); },
      // 跳到 Boss 前：跳过沿途招兵弹窗（视为已招），直接进入 Boss 登场前 3 秒。
      toBoss: () => { for (let i = 0; i <= waves.length; i++) scene.recruitedWaves.add(i); scene.pendingRecruit = false; scene.devSetTime(Math.max(scene.elapsed, chapterBossTime(scene.chapter) - 3)); mark(); },
      closePopup: () => { if (scene.mode === 'recruit') { scene.recruitedWaves.add(scene.waveIndex); scene.freeRecruit = false; scene.pendingRecruit = false; scene.resumePendingChoices(); } else if (scene.mode === 'levelup') scene.chooseUpgrade(0); else if (scene.mode === 'pause') scene.togglePause(); },
      'speed0.5': () => { scene.devTimeScale = 0.5; mark(); },
      speed1: () => { scene.devTimeScale = 1; mark(); },
      speed2: () => { scene.devTimeScale = 2; mark(); },
      speed4: () => { scene.devTimeScale = 4; mark(); },
      boss: () => { ensureBoss(); },
      boss50: () => { if (scene.boss) { scene.boss.hp = scene.boss.maxHp * 0.5; scene.ensureBossPhase2(); } mark(); },
      bossEnergy: () => { scene.bossEnergy = 100; if (scene.lubu) scene.lubu.energy = 100; mark(); },
      bossUlt: () => { if (scene.tryCustomBossSkill()) { mark(); return; } if (scene.lubu) scene.lubu.tryUltimate(scene.combatNow); if (scene.boss && !scene.lubu) scene.startBossUltimate(scene.combatNow); mark(); },
      bossSkill: () => { if (!scene.boss?.active) ensureBoss(); if (scene.yellow) { scene.yellow.forceNextSkill(); mark(); return; } actions.bossUlt(); },
      // 首领重设计：测试模式「首领 → 指定招式 / 二阶段」（bossDebug 接口，UI 打磨会话的按钮调用）
      bossMove0: () => { if (!scene.boss?.active) ensureBoss(); scene.bossDebug()?.force(0, scene.combatNow); mark(); },
      bossMove1: () => { if (!scene.boss?.active) ensureBoss(); scene.bossDebug()?.force(1, scene.combatNow); mark(); },
      bossMove2: () => { if (!scene.boss?.active) ensureBoss(); scene.bossDebug()?.force(2, scene.combatNow); mark(); },
      bossMove3: () => { if (!scene.boss?.active) ensureBoss(); scene.bossDebug()?.force(3, scene.combatNow); mark(); },
      bossMove4: () => { if (!scene.boss?.active) ensureBoss(); scene.bossDebug()?.force(4, scene.combatNow); mark(); },
      bossPhase2: () => { if (!scene.boss?.active) ensureBoss(); scene.bossDebug()?.phase2(scene.combatNow); mark(); },
      killBoss: () => { if (!scene.boss?.active) ensureBoss(); if (scene.boss) scene.killEnemy(scene.boss); mark(); },
      winNow: () => { actions.killBoss(); },
      loseNow: () => { scene.player.damageImmune = false; scene.finish(false, 'death'); },
      allySword: () => { scene.devSpawnAlly('swordsman'); },
      allyArcher: () => { scene.devSpawnAlly('archer'); },
      allySpear: () => { scene.devSpawnAlly('spearman'); },
      allyLevel3: () => { for (const k of kinds) while (scene.legion.levels[k] < 3) scene.legion.train(k, true); mark(); },
      legionFood: () => { scene.legion.food += 100; mark(); },
      legionFood1000: () => { scene.legion.food += 1000; mark(); },
      legionEight: () => { for (const k of kinds) scene.legion.recruit(k, 3, true, true); mark(); },
      clearAllies: () => { scene.devClearAllies(); },
      supply: () => { scene.supplies?.spawnForTest(); mark(); },
      brazier: () => { scene.supplies?.spawnForTest(35); mark(); },
      heal: () => { scene.player.hp = scene.player.maxHp; mark(); },
      god: () => { scene.player.damageImmune = !scene.player.damageImmune; mark(); },
      oneHit: () => { scene.devOneHit = !scene.devOneHit; mark(); },
      enemy50: () => { for (let i = 0; i < 50; i += 1) scene.spawnAroundPlayer('infantry'); mark(); },
      enemy150: () => { for (let i = 0; i < 150; i += 1) scene.spawnAroundPlayer('infantry'); mark(); },
      clearEnemies: () => { scene.devClearEnemies(); },
      movementNew: () => { scene.crowdSteering = true; for (const e of scene.enemies) e.moveVx = e.moveVy = 0; mark(); },
      movementOld: () => { scene.crowdSteering = false; for (const e of scene.enemies) e.moveVx = e.moveVy = 0; mark(); },
      ranges: () => { scene.devRanges = !scene.devRanges; if (!scene.devRanges) scene.devRangeGfx?.clear(); },
      hideHud: () => { scene.devToggleHud(); },
      presetLow: () => { scene.devPreset('low'); },
      presetNormal: () => { scene.devPreset('normal'); },
      presetStrong: () => { scene.devPreset('strong'); },
    };
    waves.forEach((w, i) => { actions['wave' + (i + 1)] = () => { scene.devSetTime(w.start + .1); mark(); }; });
    for (const k of kinds) actions['ally_' + k] = () => { scene.devSpawnAlly(k); };
    const speed = (v: number) => () => scene.devTimeScale === v;
    const sections: DevSection[] = [
      { title: '跳转（离开当前测试局）', items: [
        { key: 'chapter1', label: '从第一章开始' }, { key: 'chapter2', label: '从第二章开始' }, { key: 'chapter3', label: '第三章选关' }, { key: 'chapter4', label: '第四章选关' },
        { key: 'worldMap', label: '天下地图' }, { key: 'homeCity', label: '义军营寨' }, { key: 'selectStart', label: '返回选将' }, { key: 'reset', label: '重开本关' },
        { key: 'layoutMobile', label: '手机布局', active: () => !IS_DESKTOP }, { key: 'layoutDesktop', label: '电脑布局', active: () => IS_DESKTOP },
      ] },
      { title: '时间 / 速度', items: [
        ...waves.map((w, i) => ({ key: 'wave' + (i + 1), label: '第' + (i + 1) + '波', hint: w.name })),
        { key: 'time+10', label: '+10秒' }, { key: 'toBoss', label: '跳到Boss前', hint: '跳过沿途招兵' }, { key: 'closePopup', label: '关闭弹窗', hint: '招兵弹窗跳过 / 三选一选第一项 / 取消暂停' },
        { key: 'speed0.5', label: '0.5×', active: speed(.5) }, { key: 'speed1', label: '1×', active: speed(1) }, { key: 'speed2', label: '2×', active: speed(2) }, { key: 'speed4', label: '4×', active: speed(4) },
      ] },
      { title: '成长（真实三选一）', items: [
        { key: 'level+1', label: '升1级·选卡' }, { key: 'autoLevel5', label: '连升5级·自动选' }, { key: 'level10', label: '到Lv10·自动选' },
        { key: 'weaponNative1', label: '本命武器Lv1' }, { key: 'weaponNative3', label: 'Lv3' }, { key: 'weaponNative5', label: 'Lv5' },
        { key: 'randomTactic', label: '随机战法+1' }, { key: 'attributes4', label: '属性点+4' },
      ] },
      { title: 'Boss', items: [
        { key: 'boss', label: '召唤Boss' }, { key: 'boss50', label: '50%血·二阶段' }, { key: 'bossEnergy', label: '满能量' },
        { key: 'bossSkill', label: '下一个技能' }, { key: 'bossUlt', label: '释放大招' }, { key: 'killBoss', label: '击败Boss' },
      ] },
      { title: '蜀军', items: [
        ...kinds.map(k => ({ key: 'ally_' + k, label: TROOPS[k].name })),
        { key: 'legionEight', label: '各3人' }, { key: 'allyLevel3', label: '全体Lv3' }, { key: 'legionFood', label: '+100粮' }, { key: 'legionFood1000', label: '+1000粮' }, { key: 'clearAllies', label: '清空' },
      ] },
      { title: '主将 / 敌人', items: [
        { key: 'heal', label: '回满血' }, { key: 'god', label: '无敌', active: () => scene.player.damageImmune }, { key: 'oneHit', label: '秒杀', active: () => scene.devOneHit, hint: '主将与蜀军伤害×10000' },
        { key: 'enemy50', label: '+50敌' }, { key: 'enemy150', label: '+150敌' }, { key: 'clearEnemies', label: '清场' },
        { key: 'supply', label: '补给罐' }, { key: 'brazier', label: '火盆' },
        { key: 'movementNew', label: '新版群移', active: () => scene.crowdSteering }, { key: 'movementOld', label: '旧版追踪', active: () => !scene.crowdSteering },
      ] },
      { title: '结算 / 显示 / 预设', items: [
        { key: 'winNow', label: '立即胜利' }, { key: 'loseNow', label: '立即失败' },
        { key: 'ranges', label: '显示射程', active: () => scene.devRanges, hint: '主将武器实际可命中范围、敌人碰撞半径' }, { key: 'hideHud', label: '隐藏界面', active: () => scene.devHudHidden, hint: '截图用' },
        { key: 'presetLow', label: '低构筑' }, { key: 'presetNormal', label: '普通构筑' }, { key: 'presetStrong', label: '强构筑' },
      ] },
    ];
    const info = (): string => {
      const p = scene.player, w = p.weapons.find(x => x.id === nativeWeapon()) ?? p.weapons[0], tags = p.growth.build.tags();
      const tagText = (Object.keys(tags) as Array<keyof typeof tags>).filter(k => tags[k] > 0).map(k => TAG_NAMES[k] + tags[k]).join(' ') || '无';
      const waveNo = Math.max(1, waveIndexAt(scene.elapsed, waves) + 1);
      return [
        `FPS ${Math.round(scene.game.loop.actualFps)} · ${scene.chapter.name}`,
        `${getCharacter(p.growth.character).name} Lv${p.level} · 武器Lv${w?.level ?? 0} · HP ${Math.ceil(p.hp)}/${p.maxHp}`,
        `${scene.elapsed.toFixed(1)}s · 第${waveNo}/${waves.length}波 · Boss ${chapterBossTime(scene.chapter)}s · ${scene.devTimeScale}×`,
        `敌 ${scene.activeEnemyCount()} · 蜀军 ${scene.legion.count} · 军粮 ${scene.legion.food}`,
        `构筑 ${tagText}`,
        `${p.damageImmune ? '无敌 ' : ''}${scene.devOneHit ? '秒杀 ' : ''}${scene.debugModified ? '已修改(不计正式进度)' : '未修改'}`,
      ].join('\n');
    };
    this.disposePanel?.();
    this.disposePanel = createDevPanel({ sections, actions, info });
    (window as unknown as { __DEV_INFO?: () => string }).__DEV_INFO = info;
    (this as unknown as { __DEV_ACTIONS?: Record<string, () => void> }).__DEV_ACTIONS = actions;
  }

  // ---- DEV 辅助 ----
  private devOneHit = false;
  private devRanges = false;
  private devRangeGfx?: Phaser.GameObjects.Graphics;
  private devHudHidden = false;
  private devHiddenObjects: Phaser.GameObjects.GameObject[] = [];

  /** 走真实升级：补足经验触发三选一；auto 时依次自动选第一项。 */
  private devGrantLevels(count: number, auto: boolean): void {
    if (count <= 0 || this.over) return;
    this.debugModified = true;
    for (let i = 0; i < count; i++) {
      const gained = this.player.gainXp(Math.max(0, this.player.xpNext - this.player.xp) + .001);
      this.pendingLevels += gained;
    }
    if (this.mode === 'none') this.openUpgrade();
    if (!auto) return;
    for (let guard = 0; guard < 60 && this.mode === 'levelup'; guard++) this.chooseUpgrade(0);
  }

  protected override hitEnemy(enemy: Enemy, rawDamage: number, time: number, source: 'melee' | 'arrow' | 'fire' = 'melee', fromAlly = false, weaponHit = true): boolean {
    return super.hitEnemy(enemy, this.devOneHit ? rawDamage * 10000 : rawDamage, time, source, fromAlly, weaponHit);
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    if (this.devRanges) this.drawDevRanges();
  }

  /** 射程叠加：主将本命武器实际可命中范围（金）、敌人碰撞半径（红）、近战友军射程（绿，最多 30 人）。 */
  private drawDevRanges(): void {
    const g = this.devRangeGfx ??= this.add.graphics().setDepth(DEPTH.fx + 5);
    g.clear();
    const p = this.player, id = getCharacter(p.growth.character).startWeapon, w = p.weapons.find(x => x.id === id);
    if (w) {
      const lv = Math.max(1, Math.min(5, w.level));
      const reach = id === 'spear_orbit' ? Math.min(220, SPEAR_PIERCE[lv - 1].len * p.growth.spearLengthMultiplier() + SPEAR_PIERCE[lv - 1].width / 2)
        : id === 'guandao' ? GUANDAO_TABLE[lv - 1].radius * p.passive.rangeMultiplier('guandao') : id === 'crossbow' ? 500 : 300;
      g.lineStyle(2, 0xffd36a, .8).strokeCircle(p.x, p.y - (id === 'spear_orbit' ? 6 : 0), reach);
    }
    const view = this.cameras.main.worldView;
    for (const e of this.enemies) if (e.active && view.contains(e.x, e.y)) g.lineStyle(1, e.kind === 'boss' ? 0xff4040 : 0xff8a7a, .7).strokeCircle(e.x, e.y, e.radius);
    let n = 0;
    for (const u of this.allies) if (u.active && !u.def.ranged && n++ < 30) g.lineStyle(1, 0x7fe0a0, .35).strokeCircle(u.x, u.y, u.def.range);
  }

  /** 隐藏/恢复所有固定在屏幕上的界面元素（截图用），DEV 面板本身是网页层不受影响。 */
  private devToggleHud(): void {
    if (this.devHudHidden) { for (const o of this.devHiddenObjects) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(true); this.devHiddenObjects = []; this.devHudHidden = false; return; }
    for (const o of this.children.list) {
      const c = o as unknown as { scrollFactorX?: number; visible?: boolean; depth?: number; setVisible?: (v: boolean) => void };
      if (c.scrollFactorX === 0 && c.visible && (c.depth ?? 0) >= DEPTH.hud - 10 && c.setVisible) { c.setVisible(false); this.devHiddenObjects.push(o); }
    }
    this.devHudHidden = true;
  }

  private devGiveWeapon(id: string, level: number): void {
    this.debugModified = true;
    const existing = this.player.weapons.find((w) => w.id === id);
    if (existing) existing.level = level;
    else this.player.weapons.push({ id, level, cooldownLeft: 0 } as WeaponState);
  }

  private devSpawnAlly(kind: AllyKind): void {
    this.debugModified = true;
    this.legion.recruit(kind, 1, true, true);
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

  /** 预设只用本命武器（与正式规则一致）：低=Lv1+1兵，普通=Lv3+3兵+Lv5，强=Lv5+6兵+Lv10。 */
  private devPreset(kind: 'low' | 'normal' | 'strong'): void {
    this.debugModified = true;
    const own = getCharacter(this.player.growth.character).startWeapon;
    this.player.weapons = [];
    this.devClearAllies();
    this.player.hp = this.player.maxHp;
    this.devGiveWeapon(own, kind === 'low' ? 1 : kind === 'normal' ? 3 : 5);
    const n = kind === 'low' ? 1 : kind === 'normal' ? 3 : 6;
    for (let i = 0; i < n; i += 1) this.devSpawnAlly(i % 3 === 0 ? 'swordsman' : i % 3 === 1 ? 'archer' : 'spearman');
    if (kind !== 'low') this.devGrantLevels(Math.max(0, (kind === 'normal' ? 5 : 10) - this.player.level), true);
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
        scene.legion.recruit(kind, 1, true, true);
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
