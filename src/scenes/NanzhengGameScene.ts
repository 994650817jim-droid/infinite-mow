import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { thirdGameSceneClass, type ArcSceneConfig } from './ThirdGameScene';
import { NANZHENG_STAGES, NZ_TROOPS, nzArt, nanzhengBattle, nzBossSheet, nzBossTexture, NZ_OPENING, NZ_TENGJIA_OPENING, NZ_MENGHUO_OPENING, MENGHUO_CAPTURE_LINES, nzEnding, type NanzhengStage } from '../data/nanzhengChapter';
import { Nanman } from '../systems/Nanman';
import { paintV2Ground } from '../systems/EnvGround';
import { playSheet } from '../systems/SkillFxSheets';
import { storyScroll } from '../ui/StoryScroll';
import { GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP, DEPTH } from '../config';
import { getCharacter } from '../data/characters';
import type { Enemy } from '../entities/Enemy';
import type { RunEndReason } from '../types';
import { SURRENDER, surrenderDef } from '../data/surrender';
import { bossInRoster, joinByPersuasion } from '../systems/RosterStore';
import { markSurrender, surrenderLive } from '../systems/SurrenderStore';
import { gainProvisions } from '../world/WorldStore';
import { BossMoveset } from '../systems/BossMoveset';
import { BOSS_MOVES } from '../data/bossMoves';
import { nanzhongPlan } from '../data/dualBossPlans';
import { dualOff } from '../systems/DualBoss';
import { loadBossSheet } from '../systems/ArtStyle';
import { GUANDU_ATLAS_FILES } from '../data/guanduChapter';

/**
 * 第十一章 · 南征（数据 data/nanzhengChapter.ts）。三关沿用第三章篇章框架（关间军营、首领招式组、倒地 → 宝箱）。
 * 「克制兵种」在 systems/Nanman.ts：藤甲（物理 20%、火攻 3 倍 + 引燃）、象兵冲撞（预警箭道）、毒泉（掉血减速）、火盆（拿到即火攻）。
 * 11-3 七擒孟获：孟获前两次被击倒都会逃走（隐身、无敌），过一会儿换个方向再杀回来；第三次才真正倒地 → 宝箱 → 章末「心服」卷轴。
 * 2026-11-19 双首领第二批：11-3 孟获 + 祝融夫人同场（data/dualBossPlans.ts nanzhongPlan；?dual=0 回单首领）。七擒照旧：孟获逃走时 DualBoss.setAway，
 * 祝融断后补一轮飞刀；孟获第三擒真倒时祝融随夫归降；心服 / 宝箱按最后一人走。
 */
function nzScenery(scene: Phaser.Scene, stage: number) {
  const key = 'nz_ground_' + stage;
  // 南中：江岸地面压暗染湿绿（瘴气、丛林）；v2 南中地面到之前的过渡
  if (!paintV2Ground(scene, key, stage === 2 ? 'ground_v2_guanzhong' : 'ground_v2_jiang', stage === 1 ? 'rgba(34,58,26,.34)' : stage === 2 ? 'rgba(60,44,20,.3)' : 'rgba(30,48,24,.3)')) return null;
  return { key, boxes: [], camps: [] };
}
export const NANZHENG_CONFIG: ArcSceneConfig = {
  key: 'NanzhengGameScene', arc: 'nanzheng', stageKey: 'nanzhengStage', transferKey: 'nanzhengTransfer', stages: NANZHENG_STAGES,
  texture: id => nzBossTexture(id), sheet: id => nzBossSheet(id), battle: s => nanzhengBattle(s as NanzhengStage), campPrefix: 'nanzheng-', scenery: nzScenery,
};
/** 七擒孟获（简化为三擒）：逃走后多久杀回来（毫秒）、杀回来时的血量比例。开发期初值。 */
export const MENGHUO = { captures: 3, returnMs: 7000, returnHp: [1, .9, .85] } as const;

export function nanzhengGameSceneClass(Base: typeof GameScene) {
  const Arc = thirdGameSceneClass(Base, NANZHENG_CONFIG);
  return class NanzhengGameScene extends Arc {
    private nanman?: Nanman; private nzStage: NanzhengStage = 1;
    private captured = 0; private mhHidden = false; private mhReturnAt = 0;
    /** 孟获本人（双首领时 this.boss 会换成离主将最近的那个，七擒按这个认人）。 */
    private mhEnemy: Enemy | null = null;
    private isMenghuo(e: Enemy): boolean { return this.nzStage === 3 && (this.dual ? this.dual.entryOf(e)?.id === 'menghuo' : e === this.boss); }
    preload() {
      super.preload();
      if (!this.textures.exists('nz_zhurong')) loadBossSheet(this.load, 'nz_zhurong', GUANDU_ATLAS_FILES.guandu_chunyuqiong); // 11-3 祝融夫人（v2 专属图；v1 借淳于琼）
      for (const t of Object.values(NZ_TROOPS)) if (nzArt(t.walk) && !this.textures.exists(t.walk)) this.load.spritesheet(t.walk, t.file, { frameWidth: 176, frameHeight: 176 });
    }
    create() {
      this.nanman = undefined; this.captured = 0; this.mhHidden = false; this.mhReturnAt = 0; this.mhEnemy = null;
      super.create();
      if (!this.player || this.scene.key !== 'NanzhengGameScene' || !this.chapter) return;
      this.nzStage = (Number(this.registry.get('nanzhengStage')) || 1) as NanzhengStage;
      for (const t of Object.values(NZ_TROOPS)) if (this.textures.exists(t.walk)) registerV2Frames(this, t.walk);
      this.nanman = new Nanman({
        scene: this, player: this.player, allies: () => this.allies, enemies: () => this.enemies, now: () => this.combatNow,
        hitEnemy: (e, d) => { this.hitEnemy(e, d, this.combatNow, 'fire', true, false); }, hurtTroops: (x, y, r, d) => this.legion.hurtArea(x, y, r, d, this.combatNow),
        banner: (t, danger, c) => this.showWaveBanner(t, !!danger, c), sfx: k => this.sfx.play(k), boss: () => this.boss,
        block: b => this.blockBoxes(b, true),
      }, this.nzStage);
      if (!this.registry.get('nzNoStory')) {
        if (this.nzStage === 1) this.story('nz-opening', '第十一章 · 南征', '五月渡泸', NZ_OPENING, '渡泸水');
        if (this.nzStage === 2) this.story('nz-tengjia', '第十一章 · 南征 · 藤甲兵', '遇火必燃', NZ_TENGJIA_OPENING, '备火攻');
        if (this.nzStage === 3) this.story('nz-menghuo', '第十一章 · 南征 · 七擒孟获', '攻心为上', NZ_MENGHUO_OPENING, '擒孟获');
      }
      this.events.once('shutdown', () => { this.nanman?.clear(); this.nanman = undefined; this.player && (this.player.envSpeedMul = 1); });
    }
    private story(name: string, kicker: string, title: string, lines: { who?: string; text: string }[], confirm: string) {
      const show = () => {
        const wasMode = this.mode; if (!this.over) this.setMode('story');
        storyScroll(this, GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP, { name, confirmName: name + '-confirm', kicker, title, lines, reward: '', confirm, background: 'rest_camp',
          onDone: () => { this.children.getByName(name)?.destroy(); if (!this.over && this.mode === 'story') this.setMode(wasMode === 'story' ? 'none' : wasMode); } });
      };
      if (this.over) show(); else this.time.delayedCall(60, show);
    }
    /** 藤甲：主将的攻击在「火攻」期间都算火攻；藤甲兵非火攻只吃 20%、火攻 3 倍并引燃。 */
    protected hitEnemy(enemy: Enemy, raw: number, now: number, source: 'melee' | 'arrow' | 'fire' = 'melee', ally = false, weaponHit = true): boolean {
      const n = this.nanman;
      if (n && !n.inBurn && enemy.active && !enemy.invulnerable) {
        if (!ally && n.fireActive && source !== 'fire') source = 'fire';
        raw *= n.damageMul(enemy, source === 'fire');
      }
      return super.hitEnemy(enemy, raw, now, source, ally, weaponHit);
    }
    /** 藤甲兵（本章盾兵位）不带盾牌护层：藤甲减伤 / 怕火由 Nanman 结算，不走通用的「先打盾、本体只吃一成」。 */
    protected spawnEnemy(kind: Enemy['kind'], x: number, y: number, hpScale?: number, force = false, override?: Enemy['def']): Enemy | null {
      const e = super.spawnEnemy(kind, x, y, hpScale ?? this.chapter.hpScale(this.elapsed), force, override);
      if (e && kind === 'shield' && this.scene.key === 'NanzhengGameScene') { e.shieldHp = 0; e.shieldMax = 0; }
      return e;
    }
    /** 象兵蓄势 / 冲撞时由 Nanman 接管移动。 */
    protected advanceEnemy(enemy: Enemy, nx: number, ny: number, dt: number) { if (this.nanman?.busy(enemy)) return; super.advanceEnemy(enemy, nx, ny, dt); }
    /** 孟获逃走期间不出招。 */
    protected customBossStep(enemy: Enemy, dt: number, now: number) { if (this.mhHidden && enemy === (this.mhEnemy ?? this.boss)) return true; return super.customBossStep(enemy, dt, now); }
    /** 11-3 孟获 + 祝融夫人双首领（dual-boss 第二批）。 */
    protected dualSetup(first: BossMoveset): boolean {
      const b = this.boss; if (this.nzStage !== 3 || !b || dualOff()) return false;
      this.startDual(nanzhongPlan(), { id: 'menghuo', name: '孟获', enemy: b, ctrl: first, mount: first.mount ?? null, key: 'nanzheng-3:menghuo' },
        { id: 'zhurong', name: '祝融', at: { x: b.x + 220, y: b.y - 20 }, def: { texture: 'nz_zhurong' }, key: null,
          make: e => ({ ctrl: new BossMoveset(this.arcHost(e), 'nz_zhurong', this.combatNow, BOSS_MOVES.zhurong, 'arc'), mount: null }) });
      return true;
    }
    /** 七擒孟获：前两次击倒 → 逃走；第三次才真正倒地。 */
    protected killEnemy(enemy: Enemy) {
      const mh = this.isMenghuo(enemy);
      if (mh && !this.mhHidden && this.captured < MENGHUO.captures - 1) { this.captureMenghuo(enemy); return; }
      if (mh && this.mhHidden) return;
      if (mh) this.captured = MENGHUO.captures;
      super.killEnemy(enemy);
    }
    private captureMenghuo(b: Enemy) {
      this.captured++; this.mhHidden = true; this.mhReturnAt = this.combatNow + MENGHUO.returnMs; this.mhEnemy = b;
      b.hp = 1; b.invulnerable = true;
      // 双首领：孟获离场；祝融喊一句断后、马上补一轮飞刀
      const d = this.dual;
      if (d) {
        d.setAway(b, true, '逃回蛮洞');
        const z = d.entries.find(x => x.id === 'zhurong');
        if (z && !z.done && z.enemy.active) { d.h.bark(z.enemy, z.name, this.captured === 1 ? '大王快走，妾身断后！' : '大王！又被擒了？……走！这里交给妾身！'); z.ctrl.signature(this.combatNow, 1); }
      }
      this.showWaveBanner(MENGHUO_CAPTURE_LINES[this.captured - 1], false, `孟获逃回蛮洞 · 还要再擒 ${MENGHUO.captures - this.captured} 次`);
      this.cameras.main.shake(200, .005); this.sfx.play('bossSummon');
      playSheet(this, 'fx_collapse_dust', b.x, b.y, { size: 180, depth: DEPTH.fx, ms: 520, alpha: .8 });
      const ang = Math.atan2(b.y - this.player.y, b.x - this.player.x);
      this.tweens.add({ targets: b.sprite, alpha: 0, x: b.x + Math.cos(ang) * 260, y: b.y + Math.sin(ang) * 260, duration: 700, onComplete: () => { if (this.mhHidden) { b.sprite.setPosition(this.player.x + 2200, this.player.y); b.sprite.setVisible(false); b.shadow.setVisible(false); } } });
    }
    private returnMenghuo() {
      const b = this.mhEnemy ?? this.boss; this.mhHidden = false; if (!b?.active) return;
      this.dual?.setAway(b, false);
      const a = Math.random() * Math.PI * 2, x = this.player.x + Math.cos(a) * 520, y = this.player.y + Math.sin(a) * 380;
      this.tweens.killTweensOf(b.sprite);
      b.sprite.setPosition(x, y).setVisible(true).setAlpha(1); b.shadow.setVisible(true);
      b.hp = Math.round(b.maxHp * MENGHUO.returnHp[this.captured]); b.invulnerable = false;
      playSheet(this, 'fx_collapse_dust', x, y, { size: 200, depth: DEPTH.fx, ms: 520, alpha: .8 });
      this.showWaveBanner('孟获又杀回来了！', true, `第 ${this.captured + 1} 擒`);
      this.sfx.play('bossSummon');
    }
    update(time: number, delta: number) {
      const before = this.combatNow; super.update(time, delta);
      if (this.combatNow > before && !this.over && this.mode === 'none') {
        this.nanman?.update((this.combatNow - before) / 1000);
        if (this.mhHidden && this.combatNow >= this.mhReturnAt) this.returnMenghuo();
      }
    }
    /**
     * 首领招降（surrender-spec §5.1）：七擒之后孟获心服，必定归降——直接入麾下（免费、不进降将栏，橙、模板刀），
     * 本关不掉首领宝箱，改为「心服」奖励军粮 +120。本存档孟获已在麾下后再打 11-3：照常打倒、掉宝箱。
     */
    protected spawnBossChest(x: number, y: number, done: () => void): void {
      if (this.nzStage === 3 && surrenderLive() && !bossInRoster('menghuo', '孟获')) {
        const r = joinByPersuasion('孟获', undefined, { boss: 'menghuo', template: 'blade', quality: 'orange' });
        if (markSurrender('surrendered', 'menghuo')) gainProvisions(SURRENDER.mengProvisions);
        this.showWaveBanner('孟获心服', false, `孟获：${surrenderDef('nanzheng-3:menghuo')?.yes ?? ''} · ${r.ok ? '已入麾下' : r.message} · 钱币 +${SURRENDER.mengProvisions}`);
        this.sfx.play('gong'); this.time.delayedCall(900, done); return;
      }
      super.spawnBossChest(x, y, done);
    }
    protected finish(victory: boolean, reason: RunEndReason = 'death') {
      if (this.over) return;
      super.finish(victory, reason);
      if (!victory || this.registry.get('nzNoStory') === 'all') return;
      if (this.nzStage === 3) { const h = getCharacter(this.runConfig.character); this.story('nz-ending', '第十一章 · 南征 · 终', '七擒七纵', nzEnding(h.name, h.id === 'zhuge'), '展开天下地图'); }
    }
    get nzState() {
      const n = this.nanman;
      return { stage: this.nzStage, fire: n ? Math.max(0, Math.round((n.fireUntil - this.combatNow) / 100) / 10) : 0, stats: n ? { ...n.stats } : null, pools: n?.pools.length ?? 0, captured: this.captured, hidden: this.mhHidden, boss: this.boss?.active ? this.boss.sprite.texture.key : null };
    }
    get nzNanman() { return this.nanman ?? null; }
  };
}
function registerV2Frames(scene: Phaser.Scene, key: string) {
  const tex = scene.textures.get(key); if (tex.has('down_0')) return;
  ['down', 'left', 'right', 'up'].forEach((dir, row) => { for (let col = 0; col < 4; col++) tex.add(`${dir}_${col}`, 0, col * 176, row * 176, 176, 176); });
}
