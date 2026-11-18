import { BALANCE, DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, IS_DESKTOP, switchLayout } from '../config';
import { applyCharms, charmState, wornTokens } from '../systems/CharmEffects';
import { rollCharm, type ItemInstance } from '../data/items';
/** 调试给的信物（不写存档，每场战斗各自一份）。 */
const devCharmMap = new WeakMap<object, ItemInstance[]>();
const devCharmsOf = (p: object): ItemInstance[] => { let l = devCharmMap.get(p); if (!l) devCharmMap.set(p, l = []); return l; };
import type { EnemyDef } from '../data/enemies';
import type { CharmSchool as RelicSchool } from '../data/charms';
import { Enemy } from '../entities/Enemy';
import { Ally, type AllyKind } from '../entities/Ally';
import Phaser from 'phaser';
import { createDevPanel, type DevSection } from './DevPanel';
import { CHARACTERS, getCharacter, type CharacterId } from '../data/characters';
import { YELLOW_STAGES, DONGZHUO_STAGES } from '../data/chapters';
import { THIRD_STAGES } from '../data/thirdChapter';
import { GUANDU_STAGES } from '../data/guanduChapter';
import { CHIBI_STAGES } from '../data/chibiChapter';
import { JINGNAN_STAGES } from '../data/jingnanChapter';
import { HANZHONG_STAGES } from '../data/hanzhongChapter';
import { YILING_STAGES } from '../data/yilingChapter';
import { BEIFA_STAGES } from '../data/beifaChapter';
import { SHU_STAGES } from '../data/shuChapter';
import { XIANGFAN_STAGES } from '../data/xiangfanChapter';
import { NANZHENG_STAGES } from '../data/nanzhengChapter';
import { CITIES } from '../world/WorldCities';
import { BOUNTY_GENERALS, type IntelKind } from '../world/WorldIntel';
import { lordHero, setLord, type Recruit } from '../systems/RosterStore';
import { FollowerSquad } from '../systems/FollowerSquad';
import { HERO_TEMPLATE, TEMPLATES, TEMPLATE_ORDER } from '../data/recruits';
import { HEROES_KEY, heroLevel, resetHeroCache, type HeroKey } from '../systems/HeroProgress';
import { MAJOR_FACTIONS } from '../world/WorldCities';
import { testSaveApi } from './TestSave';
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
    // ---- 选将 / 选关（2026-11-16 用户：「dev测试模式也需要适应」）----
    const hero = (): CharacterId => scene.runConfig.character as CharacterId;
    const clearTransfers = (): void => { for (const k of ['campaignTransfer', 'thirdTransfer', 'guanduTransfer', 'chibiTransfer', 'jingnanTransfer', 'shuTransfer', 'hanzhongTransfer', 'xiangfanTransfer', 'yilingTransfer', 'nanzhengTransfer', 'beifaTransfer', 'siegeMode']) scene.registry.remove(k); };
    /** 任意关卡直接出战（测试模式下各章节本来就不检查解锁）。 */
    const go = (key: string, config: Record<string, unknown> = {}, registry: Record<string, unknown> = {}): void => {
      clearTransfers();
      for (const [k, v] of Object.entries(registry)) scene.registry.set(k, v);
      scene.registry.set('runConfig', { character: hero(), ...config });
      scene.scene.start(key);
    };
    const firstBounty = Object.entries(BOUNTY_GENERALS)[0] as [string, readonly string[]] | undefined;
    const intel = (kind: IntelKind): void => {
      const id = 'dev-intel-' + kind, city = kind === 'escort' ? 'xiangyang' : 'luoyang';
      const event = { id, kind, city, faction: kind === 'bounty' ? firstBounty?.[0] ?? 'han' : kind === 'bandit' ? 'yellow' : 'han', general: kind === 'bounty' ? firstBounty?.[1][0] ?? '敌将' : undefined, expires: 9999 };
      go('IntelGameScene', {}, { intelEvent: id, intelPreview: event });
    };
    const siegeCities = [CITIES.find(c => c.tier === 'large'), CITIES.find(c => c.tier === 'medium'), CITIES.find(c => c.tier === 'small')].filter((c): c is (typeof CITIES)[number] => !!c);
    let lordToo = false;
    const pickHero = (id: CharacterId): void => {
      if (lordToo) setLord(id);
      scene.registry.set('runConfig', { ...scene.runConfig, character: id, weapon: getCharacter(id).startWeapon });
      scene.scene.restart();
    };
    // ---- 随行（2026-11-16 用户：「我想dev也加入可以选择随从，我想试一试随从系统」）----
    // 候选：12 名可玩武将 + 人才库样例（各势力名将 4 人、四种兵种的招募兵各 1 人）；测试模式不受主公 / 人才库 / 随行上限限制
    const pool: Recruit[] = [
      ...CHARACTERS.map(c => ({ id: c.id, kind: 'hero' as const, hero: c.id, name: c.name, template: HERO_TEMPLATE[c.id], quality: 'orange' as const, rank: 1, picks: [] })),
      ...MAJOR_FACTIONS.map(fa => [fa, BOUNTY_GENERALS[fa]?.[0]] as const).filter((x): x is readonly [typeof x[0], string] => !!x[1]).slice(0, 4)
        .map(([fa, name], i) => ({ id: 'r_' + (9001 + i), kind: 'named' as const, name, faction: fa, template: TEMPLATE_ORDER[i % 4], quality: 'purple' as const, rank: 1, picks: [] })),
      ...TEMPLATE_ORDER.map((t, i) => ({ id: 'r_' + (9011 + i), kind: 'common' as const, name: '招募·' + TEMPLATES[t].name, template: t, quality: 'blue' as const, rank: 1, picks: [] })),
    ];
    const squad = (): FollowerSquad | null => (scene as unknown as { followers: FollowerSquad | null }).followers;
    const current = (): Recruit[] => (squad()?.members ?? []).map(m => m.recruit);
    /** 当场重建随行（加入 / 替换 / 清空都走这里），不用重开本关。 */
    const setSquad = (list: Recruit[]): void => {
      const host = scene as unknown as { followers: FollowerSquad | null };
      host.followers?.clear(); host.followers = null;
      const lead = scene.player.growth.character, picked = list.filter(r => r.hero !== lead).slice(0, 3);
      // 选择记在本浏览器会话里（不是存档），选将 / 选关 / 重开后自动带上
      try { sessionStorage.setItem('im_dev_followers', JSON.stringify(list.map(r => r.id))); } catch { /* ignore */ }
      if (picked.length) host.followers = new FollowerSquad(scene, scene.player, picked, (x, y, r) => scene.grid.query(x, y, r), (e, d, fire) => scene.hitEnemy(e, d, scene.combatNow, fire ? 'fire' : 'melee', true, false), () => scene.player.growth.damageMultiplier(scene.combatNow));
      if (host.followers) (scene as unknown as { wireFollowerObstacles(sq: FollowerSquad): void }).wireFollowerObstacles(host.followers);
      mark();
    };
    const toggleFollower = (r: Recruit): void => { const now = current(); setSquad(now.some(x => x.id === r.id) ? now.filter(x => x.id !== r.id) : [...now, r].slice(-3)); };
    /** 随行等级：写测试存档里的武将等级（只影响测试存档），重建后生效。招来的武将按等级成长；名将的强度来自加点。 */
    const followerLevel = (level: number): void => {
      try {
        const raw = JSON.parse(localStorage.getItem(HEROES_KEY) ?? 'null') ?? { version: 1, heroes: {}, migrated: true, firstClears: [], attrScale: 2 };
        raw.heroes ??= {};
        for (const r of current()) { const k = r.hero ?? r.id; raw.heroes[k] = { ...(raw.heroes[k] ?? { attributes: {} }), level, xp: 0 }; }
        localStorage.setItem(HEROES_KEY, JSON.stringify(raw)); resetHeroCache();
      } catch (e) { console.error('[DEV] 随行等级', e); }
      setSquad(current());
    };
    // 上一次在测试面板里选的随行：新开的一局自动带上（场景刚建好，延后一帧再放人）
    try { const ids = JSON.parse(sessionStorage.getItem('im_dev_followers') ?? 'null') as string[] | null; if (ids?.length) { const list = ids.map(id => pool.find(r => r.id === id)).filter((r): r is Recruit => !!r); scene.time.delayedCall(0, () => { if (scene.player?.alive) setSquad(list); }); } } catch { /* ignore */ }
    const actions: Record<string, () => void> = {
      ...Object.fromEntries(pool.map(r => ['follow_' + r.id, () => toggleFollower(r)])),
      followClear: () => setSquad([]),
      followThree: () => setSquad(pool.filter(r => r.hero && r.hero !== scene.player.growth.character).slice(0, 3)),
      followLv1: () => followerLevel(1), followLv10: () => followerLevel(10), followLv20: () => followerLevel(20), followLv30: () => followerLevel(30),
      testSaveClear: () => { if (window.confirm('清空测试存档？\n测试存档变成全新空档（音量、布局等设置保留），正式存档不受影响。')) testSaveApi()?.clear(); },
      testSaveReal: () => { if (window.confirm('丢掉测试存档里的改动，重新从正式存档复制？\n正式存档不受影响。')) testSaveApi()?.resetToReal(); },
      lordToggle: () => { lordToo = !lordToo; },
      lordNow: () => { setLord(hero()); },
      ...Object.fromEntries(CHARACTERS.map(c => ['hero_' + c.id, () => pickHero(c.id)])),
      ...Object.fromEntries(YELLOW_STAGES.map(st => ['stage_1_' + st.stage, () => go('GameScene', { chapter: 'huangjin', stage: st.stage })])),
      ...Object.fromEntries(DONGZHUO_STAGES.map(st => ['stage_2_' + st.stage, () => go('GameScene', { chapter: 'hulao', westStage: st.stage })])),
      ...Object.fromEntries(THIRD_STAGES.map(st => ['stage_3_' + st.stage, () => go('ThirdGameScene', { thirdStage: st.stage }, { thirdStage: st.stage })])),
      ...Object.fromEntries(GUANDU_STAGES.map(st => ['stage_4_' + st.stage, () => go('GuanduGameScene', {}, { guanduStage: st.stage })])),
      ...Object.fromEntries(CHIBI_STAGES.map(st => ['stage_5_' + st.stage, () => go('ChibiGameScene', { thirdStage: st.stage }, { chibiStage: st.stage })])),
      ...Object.fromEntries(JINGNAN_STAGES.map(st => ['stage_6_' + st.stage, () => go('JingnanGameScene', { thirdStage: st.stage }, { jingnanStage: st.stage })])),
      ...Object.fromEntries(SHU_STAGES.map(st => ['stage_7_' + st.stage, () => go('ShuGameScene', { thirdStage: st.stage }, { shuStage: st.stage })])),
      ...Object.fromEntries(NANZHENG_STAGES.map(st => ['stage_11_' + st.stage, () => go('NanzhengGameScene', { thirdStage: st.stage }, { nanzhengStage: st.stage })])),
      ...Object.fromEntries(XIANGFAN_STAGES.map(st => ['stage_9_' + st.stage, () => go('XiangfanGameScene', { thirdStage: st.stage }, { xiangfanStage: st.stage })])),
      ...Object.fromEntries(HANZHONG_STAGES.map(st => ['stage_8_' + st.stage, () => go('HanzhongGameScene', { thirdStage: st.stage }, { hanzhongStage: st.stage })])),
      ...Object.fromEntries(YILING_STAGES.map(st => ['stage_10_' + st.stage, () => go('YilingGameScene', { thirdStage: st.stage }, { yilingStage: st.stage })])),
      ...Object.fromEntries(BEIFA_STAGES.map(st => ['stage_12_' + st.stage, () => go('BeifaGameScene', { thirdStage: st.stage }, { beifaStage: st.stage })])),
      ...Object.fromEntries(siegeCities.map(c => ['siege_' + c.id, () => go('SiegeGameScene', {}, { siegeCity: c.id })])),
      intelBounty: () => intel('bounty'), intelBandit: () => intel('bandit'), intelEscort: () => intel('escort'),
      lubuChallenge: () => go('LubuGameScene'),
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
      // 首领宝箱：直接打开（不用走过去）
      bossChest: () => { scene.collectBossChests(); mark(); },
      winNow: () => { actions.killBoss(); scene.collectBossChests(); },
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
    const save = testSaveApi(), stageItem = (key: string, code: string, name: string, boss: string) => ({ key, label: code + ' ' + name, hint: '首领：' + boss });
    const sections: DevSection[] = [
      { title: '测试存档', open: true, note: () => { const n = save?.changed().length ?? 0; return save ? (n ? '已改 ' + n + ' 项 · 正式存档不动' : '与正式存档相同') : '未启用'; }, items: [
        { key: 'testSaveClear', label: '清空测试存档', hint: '测试存档变成全新空档；正式存档（三个存档位）不受影响' },
        { key: 'testSaveReal', label: '回到正式存档副本', hint: '丢掉测试改动，重新从当前正式存档复制' },
      ] },
      { title: '选将（任意武将直接出战）', open: true, note: () => '主公 ' + (getCharacter((lordHero() ?? hero()) as CharacterId).name), items: [
        ...CHARACTERS.map(c => ({ key: 'hero_' + c.id, label: c.name, active: () => hero() === c.id, hint: '用' + c.name + '重开本关（测试模式不受主公锁定）' })),
        { key: 'lordToggle', label: '同时设为主公', active: () => lordToo, hint: '开启后，点武将出战时顺便把他设为本测试存档的主公' },
        { key: 'lordNow', label: '当前武将设为主公', hint: '只写测试存档' },
      ] },
      { title: '随行（0–3 人，当场生效）', open: true, note: () => { const m = squad()?.members ?? []; return m.length ? m.map(x => x.recruit.name.replace(/（.*）/, '') + ' Lv' + heroLevel((x.recruit.hero ?? x.recruit.id) as HeroKey)).join(' · ') : '无随行'; }, items: [
        ...pool.map(r => ({ key: 'follow_' + r.id, label: r.kind === 'hero' ? r.name : r.name + (r.kind === 'named' ? '·' + TEMPLATES[r.template].name : ''), active: () => current().some(x => x.id === r.id), hint: r.kind === 'hero' ? '可玩武将' : r.kind === 'named' ? '人才库名将（紫）' : '人才库招募兵（蓝）' })),
        { key: 'followThree', label: '一键带 3 名武将' }, { key: 'followClear', label: '清空随行' },
        { key: 'followLv1', label: '随行Lv1' }, { key: 'followLv10', label: 'Lv10' }, { key: 'followLv20', label: 'Lv20' }, { key: 'followLv30', label: 'Lv30' },
      ] },
      { title: '选关（用当前武将直接进）', open: true, items: [
        ...YELLOW_STAGES.map(st => stageItem('stage_1_' + st.stage, '1-' + st.stage, st.name, st.boss)),
        ...DONGZHUO_STAGES.map(st => stageItem('stage_2_' + st.stage, '2-' + st.stage, st.name, st.boss)),
        ...THIRD_STAGES.map(st => stageItem('stage_3_' + st.stage, '3-' + st.stage, st.name, st.boss)),
        ...GUANDU_STAGES.map(st => stageItem('stage_4_' + st.stage, '4-' + st.stage, st.name, st.boss)),
        ...CHIBI_STAGES.map(st => stageItem('stage_5_' + st.stage, '5-' + st.stage, st.name, st.boss)),
        ...SHU_STAGES.map(st => stageItem('stage_7_' + st.stage, '7-' + st.stage, st.name, st.boss)),
        ...siegeCities.map(c => ({ key: 'siege_' + c.id, label: '攻城·' + c.name, hint: c.region + ' · ' + ({ large: '大城', medium: '中城', small: '小城' } as Record<string, string>)[c.tier] })),
        { key: 'intelBounty', label: '军情·悬赏' }, { key: 'intelBandit', label: '军情·流寇' }, { key: 'intelEscort', label: '军情·商队' },
        { key: 'lubuChallenge', label: '吕布挑战' },
      ] },
      { title: '跳转（离开当前测试局）', items: [
        { key: 'worldMap', label: '天下地图' }, { key: 'homeCity', label: '义军营寨' }, { key: 'selectStart', label: '回主页' }, { key: 'reset', label: '重开本关' },
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
        `FPS ${Math.round(scene.game.loop.actualFps)} · ${scene.chapter.name}${save ? ' · 测试存档' : ''}`,
        `${getCharacter(p.growth.character).name} Lv${p.level} · 武器Lv${w?.level ?? 0} · HP ${Math.ceil(p.hp)}/${p.maxHp}`,
        `${scene.elapsed.toFixed(1)}s · 第${waveNo}/${waves.length}波 · Boss ${chapterBossTime(scene.chapter)}s · ${scene.devTimeScale}×`,
        `敌 ${scene.activeEnemyCount()} · 蜀军 ${scene.legion.count} · 军粮 ${scene.legion.food}`,
        `构筑 ${tagText}`,
        `${p.damageImmune ? '无敌 ' : ''}${scene.devOneHit ? '秒杀 ' : ''}${scene.debugModified ? '已修改(不计正式进度)' : '未修改'}`,
      ].join('\n');
    };
    this.disposePanel?.();
    this.disposePanel = createDevPanel({ sections, actions, info, tag: save ? '测试存档' : undefined });
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
      '《三国：乱世千军》手机测试报告',
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
      /** 2026-11-17 本局遗物并入信物库：按旧遗物 id 给一件橙色信物（只本局生效，不写存档；酒壶已删除返回 false）。 */
      giveRelic(id: string): boolean {
        const map: Record<string, string> = { whetstone: 'charm_whetstone', drum: 'charm_drum', ring: 'charm_ring', quiver: 'charm_quiver', oil: 'charm_oil', torch: 'charm_oil', armor: 'charm_guard', human_seal: 'charm_human_seal', heaven_ember: 'charm_heaven_ember', army_jade: 'charm_army_jade' };
        const devCharms = devCharmsOf(scene.player), base = map[id] ?? (id.startsWith('charm_') ? id : ''); if (!base || devCharms.some(c => c.base === base)) return false;
        const c = rollCharm('orange', Math.random, base); if (!c) return false; devCharms.push(c);
        applyCharms(scene.player, [...wornTokens(scene.runConfig.character), ...devCharms]); return true;
      },
      relicsInfo(): { relics: string[]; stats: Record<string, number>; schools: Record<string, number> } {
        const p = scene.player, devCharms = devCharmsOf(p), st = charmState([...wornTokens(scene.runConfig.character), ...devCharms]);
        return {
          relics: devCharms.map(c => c.base),
          stats: {
            damageMul: p.stats.damageMul, meleeMul: p.stats.meleeMul, arrowMul: p.stats.arrowMul, fireMul: p.stats.fireMul,
            fireAreaMul: p.stats.fireAreaMul, damageTakenMul: p.stats.damageTakenMul,
            cooldownMul: p.stats.cooldownMul, critChance: p.stats.critChance, maxHpBonus: p.stats.maxHpBonus,
            armor: p.stats.armor, regen: p.stats.regen,
          },
          schools: { ...st.schools },
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
