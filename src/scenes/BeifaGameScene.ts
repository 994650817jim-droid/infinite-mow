import { SishuiObstacles } from '../systems/SishuiObstacles';
import type { GameScene } from './GameScene';
import { thirdGameSceneClass, type ArcSceneConfig } from './ThirdGameScene';
import type { Enemy } from '../entities/Enemy';
import type { EnemyKind } from '../types';
import { GAME_HEIGHT, GAME_WIDTH, IS_DESKTOP } from '../config';
import { BEIFA_TROOP_SHEETS, SMY } from '../data/beifaChapter';
import { loadV2TroopSheets } from '../systems/ArtStyle';
import type { EnvInteractions } from '../systems/EnvInteractions';
import { BeifaWater, ChencangSiege, Strikes } from '../systems/BeifaSystems';
import { SimayiBoss } from '../systems/SimayiBoss';
import type { ArcHost } from '../systems/ArcBossV2';
import { storyScroll } from '../ui/StoryScroll';
import { getCharacter } from '../data/characters';

type Host = GameScene & {
  player: GameScene['player']; legion: GameScene['legion']; enemies: Enemy[]; combatNow: number; over: boolean; mode: string; boss: Enemy | null; bossSpawned: boolean; env: EnvInteractions | null;
  supplies: { spawnGate(x: number, y: number, hp: number, size: number): Enemy | null; spawnCamp(x: number, y: number, hp: number): Enemy | null } | null;
  chapter: { enemies: Record<string, unknown> }; controller?: unknown;
  spawnEnemy(k: string, x: number, y: number, h?: number, f?: boolean, def?: unknown): Enemy | null;
  showWaveBanner(t: string, d?: boolean, c?: string): void; sfx: { play(k: string): void }; setMode(m: string): void; runConfig: { character: string };
};

/**
 * 第十二章 · 北伐（最终章）的战斗场景（在 thirdGameSceneClass 的配置版之上）：
 *  - 街亭（12-1）：守住水源（BeifaWater）。
 *  - 陈仓（12-2）：攻城样板的城门 + 城头箭楼（ChencangSiege）；城门未破，郝昭不出城。
 *  - 五丈原（12-3）：司马懿三阶段（SimayiBoss）。司马懿倒地捡完宝箱 → 章末剧情 → 结局（EndingScene）。
 */
export function beifaGameSceneClass(Base: typeof GameScene, cfg: ArcSceneConfig) {
  const Third = thirdGameSceneClass(Base, cfg);
  return class BeifaGameScene extends Third {
    water?: BeifaWater; siege?: ChencangSiege; strikes?: Strikes; simayi?: SimayiBoss;
    private gateWarned = false; private siegeReady = false;
    preload(): void { super.preload(); loadV2TroopSheets(this, [...BEIFA_TROOP_SHEETS.wuzu, ...BEIFA_TROOP_SHEETS.liannu]); }
    create(): void {
      this.water = this.siege = this.strikes = this.simayi = undefined; this.gateWarned = false; this.siegeReady = false;
      super.create();
      const s = this as unknown as Host; if (!s.player) return;
      this.strikes = new Strikes({ scene: this, player: s.player, army: s.legion, now: () => s.combatNow });
      if (this.arcStage === 1) this.water = new BeifaWater({ scene: this, player: s.player, spawn: (k, x, y) => s.spawnEnemy(k, x, y, 1, true), banner: (t, c) => s.showWaveBanner(t, false, c), sfx: k => s.sfx.play(k) }, s.combatNow);
      if (this.arcStage === 3) s.showWaveBanner('五丈原', false, '司马懿坚守不出 · 拆他的营垒逼他出营');
      this.events.once('shutdown', () => { this.water?.clear(); this.siege?.clear(); this.strikes?.clear(); this.water = this.siege = this.strikes = this.simayi = undefined; });
    }
    /** 陈仓的城门 / 箭楼要等补给物件（supplies）建好：第一帧 update 里摆。 */
    private setupSiege(): void {
      const s = this as unknown as Host; if (this.siegeReady || this.arcStage !== 2 || !s.supplies || !this.strikes) return; this.siegeReady = true;
      const sup = s.supplies;
      // 陈仓城墙要进场景碰撞（这关 arcForts 登记是 clear：城门 / 城墙由 ChencangSiege 自己摆，城门可攻破）
      const so = this as unknown as { sishuiObstacles: SishuiObstacles | null }; if (!so.sishuiObstacles) so.sishuiObstacles = new SishuiObstacles([]);
      this.siege = new ChencangSiege({ scene: this, player: s.player, strikes: this.strikes, footprints: so.sishuiObstacles.footprints,
        spawnGate: (x, y, hp) => { const g = sup.spawnGate(x, y, hp, 260); if (g) (this as unknown as GameScene).markGate(g); return g; }, // 陈仓城门：所有武器都打、舆图 / 屏外提示
        spawnTower: (x, y, hp) => { const e = sup.spawnCamp(x, y, hp); e?.sprite.setTexture('sishui_props_refined', 1).setOrigin(.5, 1).setDisplaySize(140, 140).setAlpha(1); return e; },
        banner: (t, c) => s.showWaveBanner(t, false, c), sfx: k => s.sfx.play(k),
        timeLeft: () => { const h = this as unknown as { elapsed: number; chapter: { waves: { start: number }[] } }, bt = h.chapter.waves[h.chapter.waves.length - 1].start; return h.elapsed >= bt ? Math.max(0, bt + 60 - h.elapsed) : null; } }, s.combatNow);
    }
    /** 陈仓：城门没破之前城墙北面算墙内（只刷远程；GameScene.behindClosedWall、data/gateSpawn）。 */
    protected behindClosedWall(x: number, y: number): { line: number } | null { return this.arcStage === 2 && this.siege?.gateAlive && y < this.siege.wallY - 10 ? { line: this.siege.wallY } : super.behindClosedWall(x, y); }
    /** 城墙专项检查 W6：陈仓城墙封死后，城门没破之前城里的兵出不来——刷兵点落在城墙北面就镜像到南面。 */
    protected spawnAroundPlayer(kind: EnemyKind, force = false): Enemy | null {
      const s = this as unknown as { player: { x: number; y: number }; spawnEnemy(k: EnemyKind, x: number, y: number, h?: number, f?: boolean): Enemy | null };
      if (this.arcStage === 2 && this.siege?.gateAlive) {
        const p = s.player, a = Math.random() * Math.PI * 2, d = this.spawnRingDistance(), wy = this.siege.wallY + 60; // 刷在屏幕外更远处（GameScene.spawnRingDistance）
        let y = p.y + Math.sin(a) * d; if (y < wy) y = wy + (wy - y);
        return s.spawnEnemy(kind, p.x + Math.cos(a) * d, y, undefined, force);
      }
      return super.spawnAroundPlayer(kind, force);
    }
    update(time: number, delta: number): void {
      const s = this as unknown as Host;
      const before = s.combatNow; super.update(time, delta);
      if (!s.player || s.over) return;
      this.setupSiege();
      if (s.mode !== 'none' || s.combatNow <= before) return;
      const dt = (s.combatNow - before) / 1000;
      this.water?.update(dt, s.combatNow);
      if (this.siege) { this.siege.update(s.combatNow); this.strikes?.update(); }
      // 陈仓：城门一破，郝昭立刻出城
      if (this.siege && !this.siege.gateAlive && !s.bossSpawned && !s.boss?.active) { s.showWaveBanner('城门已破', true, '郝昭出城迎战！'); this.spawnBoss(); }
    }
    /**
     * 12-3 司马懿坚守：营垒在时他只受 10% 伤害——自动瞄准先打射程内最近的营垒，不全打在司马懿身上
     * （2026-11-18 平衡：诸葛亮天火、黄忠重箭都是「首领优先」，诸葛亮 4 局一座营垒都没拆掉，司马懿一直不出营）。
     */
    protected priorityWeaponTarget(range: number, bodyRadius = true): Enemy | null {
      const smy = this.simayi;
      if (smy && smy.phase === 'hold' && smy.fortsAlive > 0) {
        const p = (this as unknown as Host).player; let best: Enemy | null = null, bd = Infinity;
        for (const f of smy.forts) { if (!f.active) continue; const d = Math.hypot(f.x - p.x, f.y - p.y) - (bodyRadius ? f.radius : 0); if (d <= range && d < bd) { bd = d; best = f; } }
        if (best) return best;
      }
      return super.priorityWeaponTarget(range, bodyRadius);
    }
    protected spawnBoss(): void {
      const s = this as unknown as Host;
      // 陈仓：城门未破，郝昭不出城（到点也只提示）
      if (this.arcStage === 2 && this.siege?.gateAlive) { if (!this.gateWarned) { this.gateWarned = true; s.showWaveBanner('城门紧闭', true, '先破陈仓城门 · 郝昭才会出城（60 秒内未破城门即退兵）'); /* 2026-11-20 第 7–12 章检查：基类在首领时刻 + 60 秒首领未出判超时，原横幅没说限时 */ } return; }
      const had = s.boss?.active; super.spawnBoss();
      if (!s.boss || had) return;
      if (this.arcStage === 3 && this.strikes) {
        const host: ArcHost = { scene: this, boss: s.boss, player: s.player, army: s.legion, spawn: (k, x, y, def) => s.spawnEnemy(k, x, y, 1, true, def), def: k => s.chapter.enemies[k] as never, banner: (t, c) => s.showWaveBanner(t, true, c), sfx: k => s.sfx.play(k) };
        this.simayi = new SimayiBoss(host, cfg.texture('simayi'), s.combatNow, { strikes: this.strikes, placeFort: (x, y, i) => { const f = s.env?.placeTent(x, y, `fixed-beifa-fort-${i}`, SMY.fortHp, 3) ?? null; if (f) (this as unknown as GameScene).markGate(f, 'tent'); return f; } }); // 营垒：所有武器都打、舆图 / 屏外提示、营寨攻坚小营帐档（11-20 平衡模拟 7/17 将拆不完）
        const self = this as unknown as { controller?: { clear(): void } };
        self.controller?.clear(); self.controller = this.simayi; // 换掉 ThirdGameScene 默认挂的 ThirdBoss
      }
    }
    /** 司马懿宝箱捡完 → 章末剧情 → 结算 → 结局。 */
    protected spawnBossChest(x: number, y: number, done: () => void): void { super.spawnBossChest(x, y, this.arcStage === 3 ? () => this.endChapter(done) : done); }
    private endChapter(next: () => void): void {
      const s = this as unknown as Host;
      const lord = getCharacter(s.runConfig.character as never).name;
      (this as unknown as GameScene).endScroll(close => storyScroll(this, GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP, { name: 'story-beifa-end', confirmName: 'story-beifa-end-confirm', kicker: '第十二章 · 北伐 · 终', title: '五丈原',
        lines: [
          { text: '将星坠而复明。司马懿望见我军阵势不乱，叹曰：「吾能料生，不能料死。」遂引兵退去。' },
          { who: '司马懿', text: '此人用兵，吾不及也。传令：收兵，坚守关中。' },
          { who: lord, text: '北伐至此，关中门户已开。传令三军——' },
          { text: '乱世百年，至此将终。天下大势，就看这些年攻下的城池了……' },
        ], reward: '北伐功成 · 进入结局', confirm: '观天下大势', background: 'rest_camp',
        onDone: () => {
          close(); next();
          // 结算后场景时钟会暂停（setMode 冻结 Timer），用真实时间切到结局
          const lord = s.runConfig.character; window.setTimeout(() => { if (this.sys.isActive()) this.scene.start('EndingScene', { lord }); }, 1500);
        } }));
    }
    snapshotBeifa() { return { stage: this.arcStage, water: this.water?.snapshot() ?? null, siege: this.siege?.snapshot() ?? null, simayi: this.simayi?.snapshot() ?? null, strikes: this.strikes?.pending ?? 0 }; }
  };
}
