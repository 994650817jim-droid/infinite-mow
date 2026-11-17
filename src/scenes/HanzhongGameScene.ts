import type { GameScene } from './GameScene';
import { thirdGameSceneClass, type ArcSceneConfig } from './ThirdGameScene';
import type { Enemy } from '../entities/Enemy';
import { GAME_HEIGHT, GAME_WIDTH, IS_DESKTOP } from '../config';
import { DINGJUN_HUANGZHONG_MUL, HANZHONG_STAGES } from '../data/hanzhongChapter';
import { HanzhongHills } from '../systems/HanzhongHills';
import { followersFor } from '../systems/RosterStore';
import { storyScroll } from '../ui/StoryScroll';
import { getCharacter } from '../data/characters';

/**
 * 第八章 · 汉中之战的战斗场景（在 thirdGameSceneClass 的配置版之上）：
 *  - 夺高地（HanzhongHills）：每关 1~2 个山头，开战就摆好。
 *  - 定军山（8-2）：黄忠在队（主将或随行）时，夏侯渊受到的伤害 ×1.5，出场台词换成「老夫今日便斩夏侯渊」。
 *  - 汉水（8-3）：曹操两阶段——前半虎豹骑冲阵（铁骑招式组）；半血「鸡肋」转场后放绝技「虎豹骑冲阵」（借曹纯的虎豹围猎）。
 *    曹操倒地捡完宝箱 → 章末剧情卷轴 → 结算。
 */
export function hanzhongGameSceneClass(Base: typeof GameScene, cfg: ArcSceneConfig) {
  const Third = thirdGameSceneClass(Base, cfg);
  return class HanzhongGameScene extends Third {
    hills?: HanzhongHills;
    private jileiShown = false;
    create(): void {
      this.jileiShown = false; super.create();
      const s = this as unknown as GameScene & { player: GameScene['player']; legion: GameScene['legion']; enemies: Enemy[]; combatNow: number; spawnEnemy(k: string, x: number, y: number, h?: number, f?: boolean): Enemy | null; showWaveBanner(t: string, d?: boolean, c?: string): void; sfx: { play(k: string): void } };
      if (!s.player) return; // create 里提前跳回地图时
      this.hills = new HanzhongHills({ scene: this, player: s.player, legion: s.legion, enemies: () => s.enemies, spawn: (k, x, y) => s.spawnEnemy(k, x, y, 1, true), banner: (t, c) => s.showWaveBanner(t, false, c), sfx: k => s.sfx.play(k) }, HANZHONG_STAGES[this.arcStage - 1].hills, s.combatNow);
      this.events.once('shutdown', () => { this.hills?.clear(); this.hills = undefined; });
    }
    update(time: number, delta: number): void {
      const s = this as unknown as { combatNow: number; over: boolean; mode: string; boss: Enemy | null; showWaveBanner(t: string, d?: boolean, c?: string): void };
      const before = s.combatNow; super.update(time, delta);
      if (s.combatNow > before && !s.over && s.mode === 'none') this.hills?.update((s.combatNow - before) / 1000, s.combatNow);
      // 汉水：曹操半血「鸡肋」
      if (this.arcStage === 3 && !this.jileiShown && s.boss?.active && s.boss.hp <= s.boss.maxHp * .5) { this.jileiShown = true; s.showWaveBanner('鸡肋', true, '曹操：食之无味，弃之可惜……虎豹骑断后！'); }
    }
    /** 黄忠在队：主将是黄忠，或随行里有黄忠。 */
    get huangzhongInTeam(): boolean { const rc = (this as unknown as { runConfig: { character: string } }).runConfig; return rc.character === 'huangzhong' || followersFor(rc.character as never).some(r => r.hero === 'huangzhong'); }
    protected spawnBoss(): void {
      const s = this as unknown as { boss: Enemy | null; showWaveBanner(t: string, d?: boolean, c?: string): void };
      const had = s.boss?.active; super.spawnBoss();
      if (!s.boss || had) return;
      if (this.arcStage === 2) s.showWaveBanner('夏侯渊来争定军山', true, this.huangzhongInTeam ? '黄忠：老夫今日便斩夏侯渊！（夏侯渊受到伤害提高）' : '居高临下，以逸待劳');
      if (this.arcStage === 3) s.showWaveBanner('曹操亲至', true, '虎豹骑冲阵 · 半血后断后');
    }
    protected hitEnemy(enemy: Enemy, raw: number, now: number, source: 'melee' | 'arrow' | 'fire' = 'melee', ally = false, weaponHit = true): boolean {
      const s = this as unknown as { boss: Enemy | null };
      if (this.arcStage === 2 && enemy === s.boss && this.huangzhongInTeam) raw *= DINGJUN_HUANGZHONG_MUL;
      return super.hitEnemy(enemy, raw, now, source, ally, weaponHit);
    }
    /** 曹操宝箱捡完 → 章末剧情 → 结算。 */
    protected spawnBossChest(x: number, y: number, done: () => void): void { super.spawnBossChest(x, y, this.arcStage === 3 ? () => this.endChapter(done) : done); }
    private endChapter(next: () => void): void {
      const s = this as unknown as GameScene & { setMode(m: string): void; runConfig: { character: string } };
      s.setMode('parley');
      const lord = getCharacter(s.runConfig.character as never).name, hz = this.huangzhongInTeam;
      storyScroll(this, GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP, { name: 'story-hanzhong-end', confirmName: 'story-hanzhong-end-confirm', kicker: '第八章 · 汉中之战 · 告捷', title: '汉中王',
        lines: [
          { text: '曹操以「鸡肋」为令，引兵北还。汉中之地，尽归我军。' },
          ...(hz ? [{ who: '黄忠', text: '定军山一刀，斩得夏侯妙才。老夫这把年纪，也算不负此生！' }] : [{ text: '定军山一役，夏侯渊战殁，曹军自此气夺。' }]),
          { who: '法正', text: '汉中者，益州之咽喉。今既得之，进可窥关中，退可守巴蜀。' },
          { who: lord, text: '传令诸将：据险而守，养兵蓄锐。' },
          { text: '东边荆州，关羽镇守襄阳、樊城。曹魏与东吴，都在看着……（第九章 · 襄樊之战）' },
        ], reward: '汉中尽归 · 天下三分', confirm: '收兵 · 告捷', background: 'rest_camp', onDone: () => { s.setMode('none'); next(); } });
    }
    snapshotHanzhong() { return { stage: this.arcStage, hills: this.hills?.snapshot(), huangzhong: this.huangzhongInTeam, jilei: this.jileiShown }; }
  };
}
