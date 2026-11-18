import type { GameScene } from './GameScene';
import { thirdGameSceneClass, type ArcSceneConfig } from './ThirdGameScene';
import type { Enemy } from '../entities/Enemy';
import { GAME_HEIGHT, GAME_WIDTH, IS_DESKTOP } from '../config';
import { DINGJUN_HUANGZHONG_MUL, HANZHONG_STAGES, HANZHONG_TROOP_SHEETS, HILL_ART } from '../data/hanzhongChapter';
import { artStyle, loadV2TroopSheets } from '../systems/ArtStyle';
import { HanzhongHills } from '../systems/HanzhongHills';
import { followersFor } from '../systems/RosterStore';
import { storyScroll } from '../ui/StoryScroll';
import { getCharacter } from '../data/characters';
import { BossMoveset } from '../systems/BossMoveset';
import { BOSS_MOVES } from '../data/bossMoves';
import { dingjunPlan, zhangheDualDef } from '../data/dualBossPlans';
import { dualOff } from '../systems/DualBoss';

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
    preload(): void {
      super.preload();
      loadV2TroopSheets(this, [...HANZHONG_TROOP_SHEETS.qingzhou, ...HANZHONG_TROOP_SHEETS.crossbow]);
      // 山头地块：v2 手绘图（v1 沿用程序画的土丘）
      if (artStyle() === 'v2') for (const h of HILL_ART) if (!this.textures.exists(h.key)) this.load.image(h.key, h.url);
    }
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
      // 等首领出场的墨迹名牌过去再出本关横幅，免得两条叠在一起
      const later = (t: string, c: string) => this.time.delayedCall(2600, () => { if (s.boss?.active) s.showWaveBanner(t, true, c); });
      if (this.arcStage === 2) later('夏侯渊、张郃来争定军山', this.huangzhongInTeam ? '黄忠：老夫今日便斩夏侯渊！（夏侯渊受到伤害提高）' : '居高临下，以逸待劳');
      if (this.arcStage === 3) later('曹操亲至', '虎豹骑冲阵 · 半血后断后');
    }
    /** 8-2 定军山：夏侯渊（骑马疾行）+ 张郃（步战枪阵）双首领（dual-boss-spec 4.2）。 */
    protected dualSetup(first: BossMoveset): boolean {
      const s = this as unknown as { boss: Enemy | null; combatNow: number };
      if (this.arcStage !== 2 || !s.boss || dualOff()) return false;
      const b = s.boss, tex = cfg.texture('zhanghe');
      this.startDual(dingjunPlan({ huangzhong: this.huangzhongInTeam, onHill: () => !!this.hills?.playerOnHill, xiahouyuan: BOSS_MOVES.xiahouyuan }),
        { id: 'xiahouyuan', name: '夏侯渊', enemy: b, ctrl: first, mount: first.mount ?? null, key: 'hanzhong-2:xiahouyuan' },
        { id: 'zhanghe', name: '张郃', at: { x: b.x + 220, y: b.y - 20 }, def: { texture: tex }, key: null,
          make: e => ({ ctrl: new BossMoveset(this.arcHost(e), tex, s.combatNow, zhangheDualDef(BOSS_MOVES.zhanghe), 'arc'), mount: null }) });
      return true;
    }
    /** 黄忠在队：夏侯渊受伤 ×1.5（双首领关按首领 id 认人）。 */
    protected hitEnemy(enemy: Enemy, raw: number, now: number, source: 'melee' | 'arrow' | 'fire' = 'melee', ally = false, weaponHit = true): boolean {
      const s = this as unknown as { boss: Enemy | null; dual: { entryOf(e: Enemy): { id: string } | undefined } | null };
      const xhy = s.dual ? s.dual.entryOf(enemy)?.id === 'xiahouyuan' : enemy === s.boss;
      if (this.arcStage === 2 && xhy && this.huangzhongInTeam) raw *= DINGJUN_HUANGZHONG_MUL;
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
