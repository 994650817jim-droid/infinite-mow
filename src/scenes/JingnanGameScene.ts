import Phaser from 'phaser';
import type { GameScene } from './GameScene';
import { thirdGameSceneClass, type ArcSceneConfig } from './ThirdGameScene';
import type { Enemy } from '../entities/Enemy';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, IS_DESKTOP } from '../config';
import { JINGNAN_BOSSES, JINGNAN_SHEETS, JINGNAN_STAGES, JINGNAN_TROOP_SHEETS, jingnanTexture, type JingnanBossId } from '../data/jingnanChapter';
import { loadBossSheet, loadV2TroopSheets } from '../systems/ArtStyle';
import { storyScroll } from '../ui/StoryScroll';
import { getCharacter } from '../data/characters';



/**
 * 第六章 · 平定荆南的战斗场景（在 thirdGameSceneClass 的配置版之上）：
 *  - 劝降：改用通用首领招降（systems/Parley.ts，2026-11-18 surrender-spec）：赵范 / 刘度 / 黄忠必降。
 *      赵范、刘度劝降后进降将栏（原来直接入麾下）；黄忠以可玩武将身份加入。斩杀奖励的紫装改成本存档首次斩杀才给。
 *  - 长沙（6-3）：先战黄忠（可劝降），黄忠了结后韩玄出阵（只能斩杀），韩玄倒地捡完宝箱 → 章末剧情卷轴 → 结算。
 */
export function jingnanGameSceneClass(Base: typeof GameScene, cfg: ArcSceneConfig) {
  const Third = thirdGameSceneClass(Base, cfg);
  return class JingnanGameScene extends Third {
    /** 长沙：当前出阵的是黄忠还是韩玄。 */
    private changshaPhase: 'huangzhong' | 'hanxuan' = 'huangzhong';
    private persuaded: string[] = []; private executed: string[] = [];
    readonly jnMetrics = { parley: 0, persuaded: 0, executed: 0 };

    preload(): void {
      super.preload(); const k = jingnanTexture('huangzhong'); if (!this.textures.exists(k)) loadBossSheet(this.load, k, JINGNAN_SHEETS[k]);
      // 山越弓手 / 藤牌兵 v2 图集：整张载入后按 宽/4 切帧（v1 没有，敌兵沿用换色）
      loadV2TroopSheets(this, [...JINGNAN_TROOP_SHEETS.archer, ...JINGNAN_TROOP_SHEETS.shield]);
    }
    create(): void { this.changshaPhase = 'huangzhong'; this.persuaded = []; this.executed = []; super.create(); }

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

    // ———— 劝降：改用通用首领招降（systems/Parley.ts；赵范 / 刘度 / 黄忠必降，见 data/surrender.ts） ————
    /** 测试兼容：劝降结果名单。 */
    private noteParley(): void { const p = (this as unknown as GameScene).parley; if (!p) return; const name = p.def.name; if (p.persuadedOk) { if (!this.persuaded.includes(name)) this.persuaded.push(name); this.jnMetrics.persuaded++; } else if (p.state === 'done' || p.state === 'failed' || p.state === 'skip') { if (!this.executed.includes(name)) this.executed.push(name); this.jnMetrics.executed++; } }
    /** 首领了结后：长沙黄忠 → 韩玄出阵；否则（劝降）直接告捷。斩杀的走 BossChest 的 done（spawnBossChest 包装）。 */
    private afterBoss(persuaded: boolean): void {
      const s = this as unknown as GameScene & { boss: Enemy | null; bossKilled: boolean; bossSpawned: boolean; finish(v: boolean, r?: string): void; showWaveBanner(t: string, d?: boolean, c?: string): void };
      if (this.arcStage === 3 && this.changshaPhase === 'huangzhong') {
        this.changshaPhase = 'hanxuan';
        this.time.delayedCall(persuaded ? 900 : 200, () => { s.boss = null; s.bossKilled = false; s.bossSpawned = false; s.showWaveBanner('韩玄出阵', true, persuaded ? '黄忠已降 · 长沙太守亲自督战' : '老将已殁 · 长沙太守亲自督战'); this.spawnBoss(); });
        return;
      }
    }
    /** 斩杀走宝箱：宝箱捡完后长沙黄忠 → 韩玄；韩玄 → 章末剧情 → 结算。 */
    protected spawnBossChest(x: number, y: number, done: () => void): void {
      const wasHuangzhong = this.arcStage === 3 && this.changshaPhase === 'huangzhong', persuaded = !!(this as unknown as GameScene).parley?.persuadedOk;
      this.noteParley();
      super.spawnBossChest(x, y, wasHuangzhong ? () => this.afterBoss(persuaded) : () => this.endChapterThen(done));
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
    snapshotJingnan() { const p = (this as unknown as GameScene).parley; return { stage: this.arcStage, phase: this.changshaPhase, parley: p?.state ?? 'none', bossId: this.bossId, persuaded: [...this.persuaded], executed: [...this.executed], metrics: { ...this.jnMetrics } }; }
  };
}
