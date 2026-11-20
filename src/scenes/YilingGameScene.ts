import type Phaser from 'phaser';
import type { GameScene } from './GameScene';
import { thirdGameSceneClass, type ArcSceneConfig } from './ThirdGameScene';
import type { Enemy } from '../entities/Enemy';
import { GAME_HEIGHT, GAME_WIDTH, IS_DESKTOP } from '../config';
import { CAMPS, FIRE, SHU_CAMP, YILING_TROOP_SHEETS } from '../data/yilingChapter';
import { loadV2TroopSheets } from '../systems/ArtStyle';
import type { EnvInteractions } from '../systems/EnvInteractions';
import { YilingFire } from '../systems/YilingFire';
import { storyScroll } from '../ui/StoryScroll';
import { getCharacter } from '../data/characters';
import { playSheet } from '../systems/SkillFxSheets';
import { DEPTH } from '../config';
/** 现身扬尘（手绘序列帧）。 */
const playSheetSafe = (scene: Phaser.Scene, x: number, y: number): void => { playSheet(scene, 'fx_collapse_dust', x, y + 4, { size: 170, ms: 520, depth: DEPTH.fx, originY: .8, name: 'luxun-reappear' }); };
import { ensureMoves } from '../systems/BossKit';
import { bossDeathKey } from '../systems/BossDeathArt';

/** 陆逊招式图集（画风会话出，4×4 每格 288、脚底 256、朝右）：帧 0~3 起手、4~7 出手、8~11 收招、12~13 转场。 */
const LUXUN_MOVES = 'yiling_luxun_moves';

type Host = GameScene & {
  player: GameScene['player']; legion: GameScene['legion']; enemies: Enemy[]; allies: GameScene['allies']; combatNow: number; over: boolean; mode: string; boss: Enemy | null; bossSpawned: boolean; env: EnvInteractions | null;
  supplies: { breakEnv(e: Enemy): void } | null;
  hitEnemy(e: Enemy, raw: number, now: number, src?: 'melee' | 'arrow' | 'fire', ally?: boolean, weaponHit?: boolean): boolean;
  showWaveBanner(t: string, d?: boolean, c?: string): void; sfx: { play(k: string): void }; setMode(m: string): void; runConfig: { character: string };
};

/**
 * 第十章 · 夷陵之战的战斗场景（在 thirdGameSceneClass 的配置版之上）：
 *  - 猇亭（10-1）：我军推进，吴军军旗满地（环境互动的军旗），砍旗压住敌势。
 *  - 连营（10-2）：开战摆好 CAMPS.count 顶吴军营帐（可破坏物）；营帐尽破 → 朱然提前出营。
 *  - 火烧连营（10-3）：开战摆好我军连营（成排营帐）；陆逊放火（YilingFire），出阵后放得更勤，半血更勤。
 *    陆逊倒地捡完宝箱 → 章末剧情卷轴 → 结算。
 */
export function yilingGameSceneClass(Base: typeof GameScene, cfg: ArcSceneConfig) {
  const Third = thirdGameSceneClass(Base, cfg);
  return class YilingGameScene extends Third {
    fire?: YilingFire;
    private camps: Enemy[] = [];
    private campsPlaced = false;
    private campsDown = 0;
    private rageShown = false;
    /** 陆逊二阶段「八阵图迷踪」：下次隐身的时刻、隐身结束时刻、次数。 */
    private mazeAt = 0; private mazeUntil = 0; mazes = 0;
    preload(): void { super.preload(); loadV2TroopSheets(this, [...YILING_TROOP_SHEETS.jiefan, ...YILING_TROOP_SHEETS.crossbow]); ensureMoves(this, LUXUN_MOVES); }
    create(): void {
      this.camps = []; this.campsPlaced = false; this.campsDown = 0; this.rageShown = false; this.fire = undefined;
      super.create();
      const s = this as unknown as Host;
      if (!s.player) return;
      if (this.arcStage === 3) {
        this.fire = new YilingFire({ scene: this, player: s.player, enemies: () => s.enemies, allies: () => s.allies, hitEnemy: (e, d) => { s.hitEnemy(e, d, s.combatNow, 'fire', false, false); }, hurtAlly: (a, d) => s.legion.hurt(a, d, s.combatNow), burnTrees: (x0, y0, size, now) => (s as unknown as { terrain?: { burnTreesIn: (a: number, b: number, c: number, d: number) => { x: number; y: number }[] } | null }).terrain?.burnTreesIn(x0, y0, size, now) ?? [],
          tents: () => s.env?.tents() ?? [], breakTent: e => s.supplies?.breakEnv(e), banner: (t, c) => s.showWaveBanner(t, false, c), sfx: k => s.sfx.play(k) }, s.combatNow);
        this.events.once('shutdown', () => { this.fire?.clear(); this.fire = undefined; });
      }
      if (this.arcStage === 2) s.showWaveBanner('拆营破寨', false, `拆掉 ${CAMPS.count} 顶吴军营帐 · 营帐尽破，朱然出营`);
      if (this.arcStage === 3) s.showWaveBanner('连营七百里', false, '陆逊会放火 · 看风向箭头，往上风口退');
    }
    /** 营帐要等环境互动（env）建好后才能摆：第一帧 update 里摆。 */
    private placeCamps(): void {
      const s = this as unknown as Host; if (this.campsPlaced || !s.env) return; this.campsPlaced = true;
      const p = s.player;
      if (this.arcStage === 2) {
        for (let i = 0; i < CAMPS.count; i++) {
          const a = i / CAMPS.count * Math.PI * 2 + .3, r = CAMPS.ringMin + (i % 2) * (CAMPS.ringMax - CAMPS.ringMin);
          const t = s.env.placeTent(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .75, `fixed-yiling-camp-${i}`, CAMPS.hp, 3);
          if (t) this.camps.push(t);
        }
      } else if (this.arcStage === 3) {
        // 我军连营：主将前方（北面）成排营帐，火烧过来会一片片塌
        const { rows, perRow, gapX, gapY } = SHU_CAMP;
        for (let r = 0; r < rows; r++) for (let c = 0; c < perRow; c++) {
          const x = p.x + (c - (perRow - 1) / 2) * gapX + (r % 2) * gapX / 2, y = p.y - 260 - r * gapY;
          const t = s.env.placeTent(x, y, `fixed-yiling-shu-${r}-${c}`, 120, 1); if (t) this.camps.push(t);
        }
      }
    }
    update(time: number, delta: number): void {
      const s = this as unknown as Host;
      super.update(time, delta);
      if (!s.player || s.over) return;
      this.placeCamps();
      if (this.arcStage === 2 && this.campsPlaced && this.campsDown < this.camps.length) {
        const down = this.camps.filter(t => !t.active).length;
        if (down > this.campsDown) {
          this.campsDown = down;
          if (down >= this.camps.length) { s.showWaveBanner('连营尽破', true, '朱然出营决战！'); if (!s.bossSpawned && !s.boss?.active) this.spawnBoss(); }
          else s.showWaveBanner(`拆营 ${down}/${this.camps.length}`, false);
        }
      }
      if (this.fire && s.mode === 'none') {
        this.fire.everySec = !s.boss?.active ? FIRE.everySec : s.boss.hp <= s.boss.maxHp * .5 ? FIRE.rageEverySec : FIRE.bossEverySec;
        if (s.boss?.active && !this.rageShown && s.boss.hp <= s.boss.maxHp * .5) { this.rageShown = true; this.fire.double = true; this.mazeAt = s.combatNow + 4000; s.showWaveBanner('火烧连营', true, '陆逊：火势已成！（两道火线 · 八阵图迷踪）'); this.fire.schedule(s.combatNow); }
        if (this.rageShown && s.boss?.active) this.updateMaze(s);
        this.fire.update(s.combatNow);
      }
      this.luxunPose(s.combatNow);
    }
    /**
     * 陆逊用招式图集盖在通用首领控制器（ThirdBoss）的姿势上：起手 / 出手 / 收招 / 半血转场各按进度换帧；
     * 放火预警时（风起）挥扇纵火。没有招式图（v1 / 载入失败）就保持控制器原姿势。
     */
    private luxunPose(now: number): void {
      const s = this as unknown as Host, b = s.boss, c = (this as unknown as { controller?: { state: string; until: number; warnFrom: number } }).controller;
      if (this.arcStage !== 3 || !b?.active || !c || !this.textures.exists(LUXUN_MOVES)) return;
      const prog = (from: number, to: number) => Math.max(0, Math.min(.999, (now - from) / Math.max(1, to - from)));
      let f = -1;
      if (c.state === 'warn') f = Math.floor(prog(c.warnFrom, c.until) * 4);
      else if (c.state === 'attack') f = 4 + Math.floor(prog(c.until - 1000, c.until) * 4);
      else if (c.state === 'recover') f = 8 + Math.floor(prog(c.until - 650, c.until) * 4);
      else if (c.state === 'rage') f = 12 + Math.floor(now / 180) % 2;
      else if (this.fire && this.fire.snapshot().pending > 0) f = 4 + Math.floor(now / 200) % 2; // 风起纵火：挥扇
      if (f < 0) return;
      b.sprite.setTexture(LUXUN_MOVES, f).setDisplaySize(144, 144).setOrigin(.5, 256 / 288).setFlipX(s.player.x < b.x);
    }
    /** 陆逊倒地：有专属倒地帧时交给通用倒地（playBossFall 播 yiling_luxun_death），不再用控制器的尸体帧。 */
    protected killEnemy(enemy: Enemy): void {
      const s = this as unknown as Host, self = this as unknown as { controller?: { clear(): void } };
      if (this.arcStage === 3 && enemy === s.boss && bossDeathKey(this, 'luxun')) { self.controller?.clear(); self.controller = undefined; }
      (super.killEnemy as (e: Enemy) => void).call(this, enemy);
    }
    /**
     * 陆逊二阶段「八阵图迷踪」：每 11 秒隐入阵中（淡出、刀枪不入 1.2 秒），在主将侧后方另一处现身（伏兵预警处），配合两道火线逼人走位。
     * 不换控制器（陆逊的招式图叠加与放火依赖通用首领控制器的时序），只在场景里加这一手。
     */
    private updateMaze(s: Host): void {
      const b = s.boss!, now = s.combatNow;
      if (this.mazeUntil && now >= this.mazeUntil) {
        this.mazeUntil = 0; b.invulnerable = false; b.sprite.setAlpha(1);
        const a = Math.random() * Math.PI * 2; b.sprite.x = s.player.x + Math.cos(a) * 300; b.sprite.y = s.player.y + Math.sin(a) * 220;
        playSheetSafe(this, b.x, b.y);
        s.showWaveBanner('陆逊现身', false, '八阵图中另一处');
      } else if (this.mazeUntil) b.sprite.setAlpha(.12);
      if (!this.mazeUntil && now >= this.mazeAt) {
        this.mazeAt = now + 11000; this.mazeUntil = now + 1200; this.mazes++; b.invulnerable = true; b.sprite.setAlpha(.12);
        s.showWaveBanner('八阵图迷踪', true, '陆逊隐入阵中 · 小心侧后'); s.sfx.play('chargeWarn');
      }
    }
    protected spawnBoss(): void {
      const s = this as unknown as Host;
      const had = s.boss?.active; super.spawnBoss();
      if (!s.boss || had) return;
      const later = (t: string, c: string) => this.time.delayedCall(2600, () => { if (s.boss?.active) s.showWaveBanner(t, true, c); });
      if (this.arcStage === 2) later('朱然出营', this.campsDown >= this.camps.length ? '营寨尽失，朱然亲自来战' : '营帐未尽，吴军仍有营寨可依');
      if (this.arcStage === 3) later('陆逊亲至', '火攻更勤 · 半血后火烧连营');
    }
    /** 陆逊宝箱捡完 → 章末剧情 → 结算。 */
    protected spawnBossChest(x: number, y: number, done: () => void): void { super.spawnBossChest(x, y, this.arcStage === 3 ? () => this.endChapter(done) : done); }
    private endChapter(next: () => void): void {
      const s = this as unknown as Host;
      s.setMode('parley');
      const lord = getCharacter(s.runConfig.character as never).name;
      storyScroll(this, GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP, { name: 'story-yiling-end', confirmName: 'story-yiling-end-confirm', kicker: '第十章 · 夷陵之战 · 终', title: '退守白帝',
        lines: [
          { text: '火光连营七百里。陆逊虽退，我军元气大伤，只得收拾残兵，退守白帝城。' },
          { who: '陆逊', text: '先主用兵，非不善也。只是连营依林，正犯火攻之忌。' },
          { who: lord, text: '此仇未报，又折了这许多将士……传令：收兵白帝，与民休息。' },
          { who: '诸葛亮', text: '主公，蜀中尚存，大事可图。待国力恢复，北伐中原，仍有可为。' },
          { text: '白帝城中，先主一病数月。一夜召丞相入内。' },
          { who: '刘备', text: '君才十倍曹丕，必能安国，终定大事。朕年老多病，国事，今后尽托丞相。' },
          { who: '诸葛亮', text: '（泣拜）臣敢不竭股肱之力，效忠贞之节，继之以死！' },
          { text: '先主留镇永安，休养将士；军国大事，自此尽决于丞相。' },
          { text: '南中诸郡乘乱生变，孟获起兵……（第十一章 · 南征）' },
        ], reward: '火海突围 · 退守白帝', confirm: '收兵 · 退守白帝', background: 'rest_camp', onDone: () => { s.setMode('none'); next(); } });
    }
    snapshotYiling() { return { mazes: this.mazes, double: !!this.fire?.double, stage: this.arcStage, camps: this.camps.length, campsDown: this.camps.filter(t => !t.active).length, fire: this.fire?.snapshot() ?? null, rage: this.rageShown }; }
  };
}
