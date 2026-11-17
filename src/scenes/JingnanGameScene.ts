import Phaser from 'phaser';
import type { GameScene } from './GameScene';
import { thirdGameSceneClass, type ArcSceneConfig } from './ThirdGameScene';
import type { Enemy } from '../entities/Enemy';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, IS_DESKTOP } from '../config';
import { JINGNAN_BOSSES, JINGNAN_SHEETS, JINGNAN_STAGES, JINGNAN_TROOP_SHEETS, jingnanTexture, type JingnanBossId } from '../data/jingnanChapter';
import { ART_V2_FILES, isV2Texture, loadBossSheet, regridV2 } from '../systems/ArtStyle';
import { joinByPersuasion } from '../systems/RosterStore';
import { gainProvisions } from '../world/WorldStore';
import { isChapterTestRun } from '../systems/ChapterProgress';
import { storyScroll } from '../ui/StoryScroll';
import { addItems } from '../systems/ItemStore';
import { rollItem } from '../data/items';
import type { ChestLoot } from '../systems/BossChest';
import { getCharacter } from '../data/characters';

/** 劝降（初值，交平衡会话）：残血线、劝降 / 斩杀各自的奖励。 */
export const PERSUADE = { hpLine: .15, persuadeProvisions: 60, executeProvisions: 25 } as const;


/**
 * 第六章 · 平定荆南的战斗场景（在 thirdGameSceneClass 的配置版之上）：
 *  - 劝降：可劝降的首领（赵范 / 刘度 / 黄忠）血量打到 15% 时战斗暂停，弹「劝降 / 斩杀」。
 *      劝降：首领归降离场（不掉宝箱），入招贤馆（黄忠以可玩武将身份加入），降城府库军粮 +60；
 *      斩杀：照常倒地掉首领宝箱，另加一件紫色兵装、军粮 +25。
 *  - 长沙（6-3）：先战黄忠（可劝降），黄忠了结后韩玄出阵（只能斩杀），韩玄倒地捡完宝箱 → 章末剧情卷轴 → 结算。
 */
export function jingnanGameSceneClass(Base: typeof GameScene, cfg: ArcSceneConfig) {
  const Third = thirdGameSceneClass(Base, cfg);
  return class JingnanGameScene extends Third {
    /** 长沙：当前出阵的是黄忠还是韩玄。 */
    private changshaPhase: 'huangzhong' | 'hanxuan' = 'huangzhong';
    private parleyState: 'none' | 'pending' | 'done' = 'none';
    private parleyPanel?: Phaser.GameObjects.Container;
    private persuaded: string[] = []; private executed: string[] = [];
    readonly jnMetrics = { parley: 0, persuaded: 0, executed: 0 };

    preload(): void {
      super.preload(); const k = jingnanTexture('huangzhong'); if (!this.textures.exists(k)) loadBossSheet(this.load, k, JINGNAN_SHEETS[k]);
      // 山越弓手 / 藤牌兵 v2 图集：整张载入后按 宽/4 切帧（v1 没有，敌兵沿用换色）
      for (const key of [...JINGNAN_TROOP_SHEETS.archer, ...JINGNAN_TROOP_SHEETS.shield]) if (isV2Texture(key) && !this.textures.exists(key)) { this.load.once(`filecomplete-image-${key}`, () => regridV2(this, key)); this.load.image(key, ART_V2_FILES[key]); }
    }
    create(): void { this.changshaPhase = 'huangzhong'; this.parleyState = 'none'; this.parleyPanel = undefined; this.persuaded = []; this.executed = []; super.create(); }

    /** 当前出阵首领：长沙先黄忠后韩玄。 */
    private get bossId(): JingnanBossId { const st = this.arcStage; return st === 3 && this.changshaPhase === 'huangzhong' ? 'huangzhong' : JINGNAN_STAGES[st - 1].id; }
    protected stageInfo() {
      const d = super.stageInfo(); if (this.arcStage !== 3 || this.changshaPhase !== 'huangzhong') return d;
      const b = JINGNAN_BOSSES.huangzhong; return { ...d, id: 'huangzhong', boss: b.name, behavior: b.behavior, skills: b.skills };
    }
    protected spawnBoss(): void {
      const self = this as unknown as GameScene & { chapter: GameScene['chapter'] };
      if (this.arcStage === 3) {
        const b = JINGNAN_BOSSES[this.bossId], boss = self.chapter.enemies.boss;
        self.chapter = { ...self.chapter, bossName: b.name, bossStyle: b.id, enemies: { ...self.chapter.enemies, boss: { ...boss, texture: jingnanTexture(b.id), hp: b.id === 'huangzhong' ? 2400 : 3000 } } };
      }
      super.spawnBoss();
    }

    // ———— 劝降 ————
    private get persuadable(): boolean { return !!JINGNAN_BOSSES[this.bossId].persuade; }
    update(time: number, delta: number): void {
      super.update(time, delta);
      const s = this as unknown as GameScene & { boss: Enemy | null; mode: string; over: boolean };
      if (this.parleyState === 'none' && this.persuadable && s.boss?.active && !s.over && s.mode === 'none' && s.boss.hp <= s.boss.maxHp * PERSUADE.hpLine) this.openParley();
    }
    /** 残血线以下还没表态前不让首领死：把致命一击按在残血线上并弹选择。 */
    protected killEnemy(enemy: Enemy): void {
      const s = this as unknown as { boss: Enemy | null };
      if (enemy === s.boss && this.persuadable && this.parleyState !== 'done') { enemy.hp = Math.max(1, Math.floor(enemy.maxHp * PERSUADE.hpLine)); if (this.parleyState === 'none') this.openParley(); return; }
      super.killEnemy(enemy);
    }
    private openParley(): void {
      const s = this as unknown as GameScene & { boss: Enemy | null; setMode(m: string): void };
      const boss = s.boss; if (!boss) return;
      this.parleyState = 'pending'; this.jnMetrics.parley++; boss.invulnerable = true;
      s.setMode('parley');
      const b = JINGNAN_BOSSES[this.bossId], W = GAME_WIDTH, H = GAME_HEIGHT, pw = IS_DESKTOP ? 560 : W - 40, ph = 250, x0 = (W - pw) / 2, y0 = H * .26;
      const root = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay + 12).setName('jingnan-parley');
      const g = this.add.graphics().setScrollFactor(0);
      g.fillStyle(0x0c0805, .55).fillRect(0, 0, W, H).fillStyle(0x000000, .45).fillRoundedRect(x0 + 4, y0 + 6, pw, ph, 10).fillStyle(0x1b120b, .97).fillRoundedRect(x0, y0, pw, ph, 10)
        .lineStyle(2, 0xc9a35e, .95).strokeRoundedRect(x0 + 4, y0 + 4, pw - 8, ph - 8, 8);
      root.add(g);
      const t = (x: number, y: number, v: string, size: number, color: string, heading = false) => this.add.text(x, y, v, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2, align: 'center' }).setOrigin(.5).setScrollFactor(0);
      root.add([t(W / 2, y0 + 34, `${b.title} · ${b.name} 败势已成`, 24, '#f6dc9a', true), t(W / 2, y0 + 78, '是劝其归降，还是阵前斩杀？', 16, '#eadcbd'),
        t(W / 2, y0 + 112, `劝降：${b.persuade?.hero ? '以武将身份加入麾下' : '入招贤馆'} · 军粮 +${PERSUADE.persuadeProvisions}　|　斩杀：首领宝箱 + 紫色兵装 · 军粮 +${PERSUADE.executeProvisions}`, 13, '#b9a57a')]);
      const btn = (cx: number, label: string, name: string, fn: () => void, primary: boolean) => {
        const w = 200, h = 54, bg = this.add.graphics().setScrollFactor(0);
        const paint = (hi: boolean) => bg.clear().fillStyle(primary ? (hi ? 0x8a5f2a : 0x6e4a22) : (hi ? 0x5a2a20 : 0x40201a), 1).fillRoundedRect(cx - w / 2, y0 + 176 - h / 2, w, h, 8).lineStyle(1.5, 0xc9a35e, 1).strokeRoundedRect(cx - w / 2 + 4, y0 + 176 - h / 2 + 4, w - 8, h - 8, 5);
        paint(false);
        const hit = this.add.rectangle(cx, y0 + 176, w, h, 0, 0).setScrollFactor(0).setInteractive({ useHandCursor: true }).setName(name);
        hit.on('pointerover', () => paint(true)).on('pointerout', () => paint(false)).on('pointerup', fn);
        root.add([bg, t(cx, y0 + 176, label, 22, '#ffe9bd', true), hit]);
      };
      btn(W / 2 - 115, '劝 降', 'jingnan-persuade', () => this.choose('persuade'), true);
      btn(W / 2 + 115, '斩 杀', 'jingnan-execute', () => this.choose('execute'), false);
      this.parleyPanel = root;
    }
    /** 测试 / 调试也可直接调用。 */
    choose(choice: 'persuade' | 'execute'): void {
      const s = this as unknown as GameScene & { boss: Enemy | null; setMode(m: string): void; bossKilled: boolean; killEnemy(e: Enemy): void; finish(v: boolean, r?: string): void; showWaveBanner(t: string, d?: boolean, c?: string): void; combatNow: number };
      if (this.parleyState !== 'pending') return;
      this.parleyState = 'done'; this.parleyPanel?.destroy(); this.parleyPanel = undefined;
      const boss = s.boss, b = JINGNAN_BOSSES[this.bossId], test = isChapterTestRun();
      s.setMode('none');
      if (!boss) return;
      if (choice === 'execute') { this.jnMetrics.executed++; this.executed.push(b.name); boss.invulnerable = false; boss.hp = 0; s.killEnemy(boss); return; }
      // 劝降：首领归降离场（不倒地、不掉宝箱）
      this.jnMetrics.persuaded++; this.persuaded.push(b.name);
      const res = test ? { ok: true, message: `${b.name}归降（试炼不入册）` } : joinByPersuasion(b.name, b.persuade?.hero);
      if (!test) gainProvisions(PERSUADE.persuadeProvisions);
      s.showWaveBanner(`${b.name}归降`, false, res.message);
      boss.invulnerable = true; this.tweens.add({ targets: boss.sprite, alpha: 0, duration: 600, onComplete: () => boss.deactivate() });
      this.afterBoss(true);
    }
    /** 首领了结后：长沙黄忠 → 韩玄出阵；否则（劝降）直接告捷。斩杀的走 BossChest 的 done（spawnBossChest 包装）。 */
    private afterBoss(persuaded: boolean): void {
      const s = this as unknown as GameScene & { boss: Enemy | null; bossKilled: boolean; bossSpawned: boolean; finish(v: boolean, r?: string): void; showWaveBanner(t: string, d?: boolean, c?: string): void };
      if (this.arcStage === 3 && this.changshaPhase === 'huangzhong') {
        this.changshaPhase = 'hanxuan'; this.parleyState = 'none';
        this.time.delayedCall(persuaded ? 900 : 200, () => { s.boss = null; s.bossKilled = false; s.bossSpawned = false; s.showWaveBanner('韩玄出阵', true, persuaded ? '黄忠已降 · 长沙太守亲自督战' : '老将已殁 · 长沙太守亲自督战'); this.spawnBoss(); });
        return;
      }
      if (persuaded) { s.bossKilled = true; s.boss = null; this.time.delayedCall(900, () => this.endChapterThen(() => s.finish(true, 'boss'))); }
    }
    /** 斩杀走宝箱：宝箱捡完后长沙黄忠 → 韩玄；韩玄 → 章末剧情 → 结算。 */
    protected spawnBossChest(x: number, y: number, done: () => void): void {
      const wasHuangzhong = this.arcStage === 3 && this.changshaPhase === 'huangzhong';
      super.spawnBossChest(x, y, wasHuangzhong ? () => this.afterBoss(false) : () => this.endChapterThen(done));
    }
    /** 斩杀奖励：宝箱里另加一件紫色兵装（直接入行囊）、军粮。 */
    protected grantBossChest(): ChestLoot[] {
      const out = super.grantBossChest(); if (isChapterTestRun()) return out;
      const item = rollItem('purple'); addItems([item]); gainProvisions(PERSUADE.executeProvisions);
      out.push({ name: `紫色兵装一件 · 军粮 +${PERSUADE.executeProvisions}`, desc: '斩将所得 · 已入行囊', tag: '斩杀' });
      return out;
    }
    /** 6-3 告捷前的章末剧情卷轴（其余关直接继续）。 */
    private endChapterThen(next: () => void): void {
      if (this.arcStage !== 3) { next(); return; }
      const s = this as unknown as GameScene & { setMode(m: string): void; runConfig: { character: string } };
      s.setMode('parley');
      const lord = getCharacter(s.runConfig.character as never).name, hz = this.persuaded.includes('黄忠');
      storyScroll(this, GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP, { name: 'story-jingnan-end', confirmName: 'story-jingnan-end-confirm', kicker: '第六章 · 平定荆南 · 告捷', title: '荆南四郡尽归',
        lines: [
          { text: '长沙城破，韩玄伏诛。桂阳、零陵、武陵、长沙四郡相继归附，荆州以南尽入版图。' },
          ...(hz ? [{ who: '黄忠', text: '忠年近六旬，今日方遇明主。愿以残年，为将军前驱！' }] : [{ text: '老将黄忠战殁城下，军中无不惋惜。' }]),
          { who: '魏延', text: '韩玄残暴寡恩，长沙百姓苦之久矣。某愿投将军帐下！' },
          { who: lord, text: '兵精粮足，可图大事。传令诸将，整军西望。' },
          { text: '西川刘璋暗弱，张鲁窥其北。益州天府之国，正在眼前……（第七章 · 入蜀）' },
        ], reward: `本章劝降 ${this.persuaded.length} 人 · 斩杀 ${this.executed.length} 人`, confirm: '收兵 · 告捷', background: 'rest_camp', onDone: () => { s.setMode('none'); next(); } });
    }
    snapshotJingnan() { return { stage: this.arcStage, phase: this.changshaPhase, parley: this.parleyState, bossId: this.bossId, persuaded: [...this.persuaded], executed: [...this.executed], metrics: { ...this.jnMetrics } }; }
  };
}
