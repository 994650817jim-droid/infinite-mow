import Phaser from 'phaser';
import { stageLieutenant, type PhasePlan, type StagePhase } from '../data/stagePhases';
import { GameScene } from './GameScene';
import { thirdGameSceneClass, type ArcSceneConfig } from './ThirdGameScene';
import { XIANGFAN_STAGES, XF_TROOPS, xfArt, xiangfanBattle, xfBossSheet, xfBossTexture, XF_OPENING, XF_FLOOD_OPENING, xfEnding, type XiangfanStage } from '../data/xiangfanChapter';
import { Flood, FLOOD } from '../systems/Flood';
import { Breakout, BREAKOUT } from '../systems/Breakout';
import { paintV2Ground } from '../systems/EnvGround';
import { storyScroll } from '../ui/StoryScroll';
import { GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP, DEPTH, actorDepth } from '../config';
import { getCharacter } from '../data/characters';
import { warText } from '../ui/WarStyle';
import type { Enemy } from '../entities/Enemy';
import type { EnemyKind, RunEndReason } from '../types';
import { YUJIN } from '../data/surrender';
import { shuArt } from '../data/shuChapter';
import { MID_SIEGE_FILES } from '../systems/SiegeMidArt';
import { sealCityWall } from '../systems/ChapterDressing';
import { bossInRoster, captureBoss } from '../systems/RosterStore';
import { markSurrender, surrenderLive } from '../systems/SurrenderStore';

/**
 * 第九章 · 襄樊之战（数据 data/xiangfanChapter.ts）。三关沿用第三章篇章框架（关间军营、首领招式组、倒地 → 宝箱）。
 * 9-1 樊城：围城（城墙在北，樊城精兵）；9-2 水淹七军：洪水（systems/Flood.ts），庞德半血抬棺狂暴；9-3 麦城突围：限时冲出口（systems/Breakout.ts），吕蒙拦截。
 * 剧情卷轴：章首（9-1）、水淹七军开场、章末（9-3 突围成功，主将是关羽时改写）。
 */
function xfScenery(scene: Phaser.Scene, stage: number) {
  const key = 'xf_ground_' + stage, src = stage === 2 ? 'ground_v2_jiang' : 'ground_v2_guanzhong';
  if (!paintV2Ground(scene, key, src, stage === 3 ? 'rgba(40,30,22,.32)' : stage === 2 ? 'rgba(30,40,40,.18)' : undefined)) return null;
  return { key, boxes: [], camps: [] };
}
export const XIANGFAN_CONFIG: ArcSceneConfig = {
  key: 'XiangfanGameScene', arc: 'xiangfan', stageKey: 'xiangfanStage', transferKey: 'xiangfanTransfer', stages: XIANGFAN_STAGES,
  texture: id => xfBossTexture(id), sheet: id => xfBossSheet(id), battle: s => xiangfanBattle(s as XiangfanStage), campPrefix: 'xiangfan-', scenery: xfScenery,
};
/** 庞德抬棺狂暴（半血）：移速 / 伤害倍率。开发期初值。 */
const PANGDE_RAGE = { at: .5, speed: 1.45, damage: 1.35 } as const;

export function xiangfanGameSceneClass(Base: typeof GameScene) {
  const Arc = thirdGameSceneClass(Base, XIANGFAN_CONFIG);
  return class XiangfanGameScene extends Arc {
    private flood?: Flood; private breakout?: Breakout; private xfStage: XiangfanStage = 1; private rage = false; private coffin?: Phaser.GameObjects.Image;
    private pendingWin = false; private timerText?: Phaser.GameObjects.Text;
    preload() {
      super.preload();
      for (const t of Object.values(XF_TROOPS)) if (xfArt(t.walk) && !this.textures.exists(t.walk)) this.load.spritesheet(t.walk, t.file, { frameWidth: 176, frameHeight: 176 });
      if (xfArt('xf_flood') && !this.textures.exists('xf_flood')) this.load.spritesheet('xf_flood', 'assets/xiangfan/flood.png', { frameWidth: 256, frameHeight: 256 });
      if (xfArt('xf_props') && !this.textures.exists('xf_props')) this.load.spritesheet('xf_props', 'assets/xiangfan/props.png', { frameWidth: 384, frameHeight: 384 });
      // 9-2 场地四周的汉水、9-3 谷壁山崖（全场景审查 C：碰撞框要看得见）——复用地形水面与第七章山道图集
      const st = Number(this.registry.get('xiangfanStage')) || 1;
      if (st === 2 && !this.textures.exists('terrain_water')) this.load.image('terrain_water', 'assets/terrain/water.png');
      if (st === 3 && shuArt('shu_pass') && !this.textures.exists('shu_pass')) this.load.spritesheet('shu_pass', 'assets/shu/pass.png', { frameWidth: 384, frameHeight: 384 });
    }
    create() {
      this.flood = undefined; this.breakout = undefined; this.rage = false; this.coffin = undefined; this.pendingWin = false; this.timerText = undefined;
      super.create();
      if (!this.player || this.scene.key !== 'XiangfanGameScene' || !this.chapter) return;
      this.xfStage = (Number(this.registry.get('xiangfanStage')) || 1) as XiangfanStage;
      for (const t of Object.values(XF_TROOPS)) if (this.textures.exists(t.walk)) registerV2Frames(this, t.walk);
      const footprints = this.sishuiObstacles!.footprints as unknown as Array<{ left: number; right: number; top: number; bottom: number }>;
      if (this.xfStage === 1) this.buildFancheng(footprints);
      if (this.xfStage === 2) this.flood = new Flood({
        scene: this, player: this.player, allies: () => this.allies, enemies: () => this.enemies, now: () => this.combatNow, elapsed: () => this.elapsed, footprints,
        hitEnemy: (e, d) => { this.hitEnemy(e, d, this.combatNow, 'melee', true, false); }, hurtTroops: (x, y, r, d) => this.legion.hurtArea(x, y, r, d, this.combatNow),
        banner: (t, danger, c) => this.showWaveBanner(t, !!danger, c), sfx: k => this.sfx.play(k), boss: () => this.boss,
      });
      if (this.xfStage === 3) {
        this.breakout = new Breakout({ scene: this, player: this.player, now: () => this.combatNow, elapsed: () => this.elapsed, footprints, spawnBoss: () => this.spawnBoss(), bossDown: () => this.bossKilled, banner: (t, danger, c) => this.showWaveBanner(t, !!danger, c) });
        this.timerText = this.add.text(GAME_WIDTH / 2, 78, '', warText(15, '#ffd98a')).setOrigin(.5, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1).setStroke('#1a120b', 4).setName('xf-breakout');
      }
      if (!this.registry.get('xfNoStory')) {
        if (this.xfStage === 1) this.story('xf-opening', '第九章 · 襄樊之战', '威震华夏', XF_OPENING, '围樊城');
        if (this.xfStage === 2) this.story('xf-flood', '第九章 · 襄樊之战 · 水淹七军', '汉水暴涨', XF_FLOOD_OPENING, '决汉水');
      }
      this.events.once('shutdown', () => { this.flood?.clear(); this.flood = undefined; this.breakout?.clear(); this.breakout = undefined; });
    }
    /** 樊城：北面一道城墙（装饰 + 碰撞），城下两座营门。 */
    private buildFancheng(footprints: Array<{ left: number; right: number; top: number; bottom: number }>) {
      const v2 = this.textures.exists('xf_props'), y = -520;
      // 场景审查 P3：樊城是城（原来退回营具图画成木栅）→ 攻城城墙图集（同 2-1 汜水关、陈仓），城门居中；襄樊专属图到了仍用它
      const K = MID_SIEGE_FILES[0], draw = (): void => { if (this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return; for (let x = -1150; x <= 1150; x += 230) this.add.image(x, y + 30, v2 ? 'xf_props' : K.key, v2 ? 6 : Math.abs(x) < 100 ? 1 : 0).setOrigin(.5, .97).setDisplaySize(238, 238).setDepth(actorDepth(y)).setName('fancheng-wall'); };
      if (v2 || this.textures.exists(K.key)) draw(); else { this.load.spritesheet(K.key, K.file, { frameWidth: K.cell, frameHeight: K.cell }); this.load.once('filecomplete-spritesheet-' + K.key, draw); if (!this.load.isLoading()) this.load.start(); }
      footprints.splice(0, footprints.length, { left: -1300, right: 1300, top: y - 40, bottom: y + 12 });
      // 城墙专项检查 W5：城墙两端原来平切口、能绕过去 → 两端角楼、往南转成侧墙，南边界画成汉水，整块场地封闭（城墙没有门：敌军都在城下）
      sealCityWall(this, { cx: 0, wy: y, half: 1300, south: 1500, boxes: footprints, south_: 'river', tag: 'fancheng' });
    }
    private story(name: string, kicker: string, title: string, lines: { who?: string; text: string }[], confirm: string) {
      const show = () => {
        const wasMode = this.mode; if (!this.over) this.setMode('story');
        storyScroll(this, GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP, { name, confirmName: name + '-confirm', kicker, title, lines, reward: '', confirm, background: 'rest_camp',
          onDone: () => { this.children.getByName(name)?.destroy(); if (!this.over && this.mode === 'story') this.setMode(wasMode === 'story' ? 'none' : wasMode); } });
      };
      if (this.over) show(); else this.time.delayedCall(60, show);
    }
    /** 樊城（9-1）城墙封死、没有城门：城墙北面一直算墙内（只刷远程；GameScene.behindClosedWall、data/gateSpawn）。 */
    protected behindClosedWall(x: number, y: number): { line: number } | null { return this.xfStage === 1 && y < -530 ? { line: -520 } : super.behindClosedWall(x, y); }
    /** W5：樊城城墙封死，曹仁出场点不越过城墙线。 */
    protected bossSpawnPoint(x: number, y: number): { x: number; y: number } { return this.xfStage === 1 ? { x: Math.max(-1200, Math.min(1200, x)), y: Math.max(-470, y) } : { x, y }; }
    protected spawnAroundPlayer(kind: EnemyKind, force = false): Enemy | null {
      if (this.breakout) { const p = this.breakout.spawnPoint(kind); return this.spawnEnemy(kind, p.x, p.y, undefined, force); }
      if (this.flood) { const a = FLOOD.arena, s = Math.floor(Math.random() * 4), t = Math.random(); const x = s === 0 ? a.left + 40 : s === 1 ? a.right - 40 : a.left + 40 + t * (a.right - a.left - 80), y = s === 2 ? a.top + 40 : s === 3 ? a.bottom - 40 : a.top + 40 + t * (a.bottom - a.top - 80); return this.spawnEnemy(kind, x, y, undefined, force); }
      if (this.xfStage === 1) { const p = this.player, r = Math.random(); const x = Math.max(-1240, Math.min(1240, p.x + (Math.random() - .5) * 1100)), y = Math.max(-470, r < .55 ? -470 : p.y + (Math.random() < .5 ? -1 : 1) * 420); /* W5：城墙封死后城里出不来，刷兵点不越过城墙线、不出侧墙 */ return this.spawnEnemy(kind, x, Math.min(y, p.y + 500, 1440), undefined, force); }
      return super.spawnAroundPlayer(kind, force);
    }
    /** 洪水里的敌人自身移动变慢。 */
    protected advanceEnemy(enemy: Enemy, nx: number, ny: number, dt: number) { const m = this.flood?.enemyMoveMul(enemy) ?? 1; super.advanceEnemy(enemy, nx * m, ny * m, dt); }
    /**
     * 9-3 麦城突围不套五段（原副将段 185 秒、首领段 245 秒，限时 180 秒——马忠永远出不来，段落横幅与实际不符）：
     * 自己的段落表压进 180 秒：0 突围 / 35 吴军合围 / 70 马忠截杀（副将）/ 125 吕蒙截道（吕蒙按突围进度约 130 秒截道）。
     */
    protected customPhases(plan: PhasePlan): { phases: StagePhase[] } | null {
      if (this.xfStage !== 3) return null;
      const lt = plan.lieutenant || stageLieutenant('xiangfan', 3, '吕蒙') || '马忠';
      return { phases: [{ kind: 'vanguard', start: 0, name: '麦城突围' }, { kind: 'elite', start: 35, name: '吴军合围' }, { kind: 'lieutenant', start: 70, name: lt + '截杀' }, { kind: 'boss', start: 125, name: '吕蒙截道' }] };
    }
    /** 麦城：吕蒙只在接近出口时出场。 */
    protected spawnBoss() { if (this.breakout && !this.breakout.bossCalled) return; super.spawnBoss(); }
    update(time: number, delta: number) {
      const before = this.combatNow; super.update(time, delta);
      if (this.combatNow > before && !this.over && this.mode === 'none') {
        const dt = (this.combatNow - before) / 1000;
        this.flood?.update(dt);
        if (this.breakout) {
          this.breakout.update();
          this.timerText?.setText(`突围 · 剩 ${Math.ceil(this.breakout.timeLeft)} 秒 · 距出口 ${this.breakout.distance} 步${this.breakout.gateOpen ? '' : this.breakout.bossCalled ? ' · 吕蒙截道' : ''}`);
          // 关名（五段关的计时 / 关名下移了）在 y 78 附近：突围行原来固定 y 78 压在「9-3 麦城突围」上（2026-11-20 第 7–12 章检查），改为跟在关名下面
          { const w = this.hudTexts?.wave; if (this.timerText && w?.visible && w.text) { const bd = w.getBounds(); if (Math.abs(bd.centerX - GAME_WIDTH / 2) < 240) this.timerText.setY(Math.max(78, bd.bottom + 2)); } }
          if (this.pendingWin && this.breakout.exited) { this.pendingWin = false; this.finish(true, 'boss'); }
        }
        this.updateRage();
      }
    }
    /** 庞德：半血抬棺死战（狂暴）。 */
    private updateRage() {
      const b = this.boss; if (this.xfStage !== 2 || this.rage || !b?.active || b.hp / b.maxHp > PANGDE_RAGE.at) return;
      this.rage = true; b.def = { ...b.def, speed: b.def.speed * PANGDE_RAGE.speed, damage: b.def.damage * PANGDE_RAGE.damage };
      b.sprite.setTint(0xff9a7a); this.cameras.main.shake(260, .006); this.sfx.play('bossSummon');
      const v2 = this.textures.exists('xf_props'); this.coffin = this.add.image(b.x - 60, b.y + 20, v2 ? 'xf_props' : 'yellow_props', v2 ? 2 : 22).setOrigin(.5, 1).setDisplaySize(130, 130).setDepth(actorDepth(b.y + 20));
      this.blockBoxes([{ left: b.x - 108, right: b.x - 12, top: b.y - 6, bottom: b.y + 16 }], true); // 棺材实心（统筹 11-21 大件布景碰撞检查：原来能站进棺材里）
      this.showWaveBanner('庞德抬棺死战！', true, '狂暴 · 移速与伤害大增');
    }
    protected checkEnd() {
      if (this.breakout && !this.over && this.player.alive && this.breakout.timeLeft <= 0) { this.finish(false, 'timeout'); return; }
      super.checkEnd();
    }
    protected finish(victory: boolean, reason: RunEndReason = 'death') {
      if (this.over) return;
      // 麦城：击败吕蒙后还要冲进出口才算突围
      if (this.breakout && victory && !this.breakout.exited) { this.pendingWin = true; this.setMode('none'); this.showWaveBanner('吕蒙已败', false, '冲进出口，杀出麦城！'); return; }
      // 首领招降（surrender-spec §5.2）：9-2 胜利后于禁乞降，自动进降将栏（不掷骰；已在麾下 / 栏里跳过）
      if (victory && this.xfStage === 2 && surrenderLive() && !bossInRoster(YUJIN.id, YUJIN.name)) { const r = captureBoss({ id: YUJIN.id, name: YUJIN.name, template: YUJIN.template }); if (r) { markSurrender('surrendered', YUJIN.id); this.showWaveBanner(YUJIN.banner, false, `于禁：${YUJIN.yes} · 已入降将栏（四季内六折招降）`); } }
      super.finish(victory, reason);
      if (!victory || this.registry.get('xfNoStory') === 'all') return;
      if (this.xfStage === 3) { const h = getCharacter(this.runConfig.character); this.story('xf-ending', '第九章 · 襄樊之战 · 终', '走出麦城', xfEnding(h.name, h.id === 'guanyu'), '展开天下地图'); }
    }
    get xfState() { return { stage: this.xfStage, flood: this.flood ? { state: this.flood.state, front: this.flood.frontX, ...this.flood.stats } : null, breakout: this.breakout ? { left: Math.round(this.breakout.timeLeft), dist: this.breakout.distance, boss: this.breakout.bossCalled, gate: this.breakout.gateOpen, exited: this.breakout.exited } : null, rage: this.rage, boss: this.boss?.active ? this.boss.sprite.texture.key : null, pendingWin: this.pendingWin }; }
    get xfFlood() { return this.flood ?? null; }
    get xfBreakout() { return this.breakout ?? null; }
  };
}
function registerV2Frames(scene: Phaser.Scene, key: string) {
  const tex = scene.textures.get(key); if (tex.has('down_0')) return;
  ['down', 'left', 'right', 'up'].forEach((dir, row) => { for (let col = 0; col < 4; col++) tex.add(`${dir}_${col}`, 0, col * 176, row * 176, 176, 176); });
}
void BREAKOUT;
