import Phaser from 'phaser';
import { safeWorldPoint } from '../ui/SafeLabel';
import { GameScene } from './GameScene';
import { thirdGameSceneClass, type ArcSceneConfig } from './ThirdGameScene';
import { ARC_FORTS, sideFort, type ArcFort } from '../data/arcForts';
import { SIDE_ROUTES, SIDE_SCENE_KEY, SIDE_STAGE_KEY, sideBattle, sideRoute, sideTexture, type SideBaseId, type SideBoss, type SideRouteDef, type SideRouteId } from '../data/sideRoutes';
import { thirdBattle, thirdPalette, type ThirdStage } from '../data/thirdChapter';
import { chibiBattle } from '../data/chibiChapter';
import { hanzhongBattle, HANZHONG_TROOP_SHEETS } from '../data/hanzhongChapter';
import { yilingBattle, YILING_TROOP_SHEETS } from '../data/yilingChapter';
import { guanduBattle, guanduYuanSourceKeys } from '../data/guanduChapter';
import { jingnanBattle, JINGNAN_TROOP_SHEETS } from '../data/jingnanChapter';
import { nanzhengBattle, NZ_TROOPS, nzArt } from '../data/nanzhengChapter';
import { ensureYuanTextures } from '../systems/YuanPalette';
import { BOSS_MOVES, type BossMovesetDef, type MoveDef } from '../data/bossMoves';
import type { ChapterDef } from '../data/chapters';
import { getChapter } from '../data/chapters';
import { lubuChallengeChapter } from '../data/dongzhuo';
import type { Enemy } from '../entities/Enemy';
import { DEPTH, FONT } from '../config';
import { castBark } from '../systems/Story';
import { storyMode } from '../systems/BattleSettings';
import { markSurrender, surrenderLive } from '../systems/SurrenderStore';
import { gainProvisions } from '../world/WorldStore';
import { SURRENDER } from '../data/surrender';
/** 白门楼陈宫（初值，交平衡）：生命 = 吕布 ×hpMul、伤害 ×dmgMul、移速 ×speedMul；献计：首次 plotFirstMs 后、每 plotEveryMs 一次，吕布伤害 +plotDmg 持续 plotMs。 */
export const CHENGONG = { hpMul: .35, dmgMul: .6, speedMul: .6, plotFirstMs: 8000, plotEveryMs: 16000, plotDmg: .15, plotMs: 6000 } as const;
import { BossMoveset } from '../systems/BossMoveset';
import { dualOff, type DualPlan } from '../systems/DualBoss';
import { loadBossSheet } from '../systems/ArtStyle';
import { ensureFactionTextures } from '../systems/FactionPalette';
import { siegeSourceKeys } from '../data/siege';
import { isChapterTestRun } from '../systems/ChapterProgress';
import { applyCitySpecialties } from '../systems/CityBonuses';
import { permanentEffects } from '../world/WorldStore';
import { settleSideStage, sideStageOpen, type SideSettle } from '../world/SideRouteStore';
import type { RunEndReason } from '../types';
import type { RunConfig } from '../data/characters';

/**
 * 其他势力支线的战斗场景（other-factions-design.md P1）：
 *  - 攻城 / 野战 / 终局关套第三章式三关框架（ThirdGameScene + 支线 cfg：开放、结算换成 SideRouteStore）；兵种与数值借对应时期的章节，首领换成本关。
 *  - 终局双首领（南郡周瑜 + 太史慈、许都曹操 + 夏侯惇）走 DualBoss，配合技用两人借来的招式（一人冲阵 / 横扫、一人箭雨 / 扇射）。
 *  - 下邳终局「白门楼」交给三英战吕布的吕布战（SideLubuGameScene）：吕布有完整招式与大招。
 * 首领能否劝降见 data/surrender.ts（surrender-rules.md）；打过的关不能再打，劝降一次性（data/replayRules.ts）。
 */

const st3 = (n: number): ThirdStage => Math.max(1, Math.min(3, n)) as ThirdStage;
/** 支线第 stage 关的战斗：借基础章节（兵种 / 节奏 / 成长）+ 外观章节（江东借第十章吴军），首领与文案换成本关。 */
/** 各基础章节的第 n 关（兵种 / 节奏 / 成长）；第三章按招式组取关。 */
const BASES: Record<SideBaseId, (n: ThirdStage, beh: ThirdStage) => ChapterDef> = {
  qunxiong: (_n, beh) => thirdBattle(beh), guandu: n => guanduBattle(n), chibi: n => chibiBattle(n), jingnan: n => jingnanBattle(n),
  hanzhong: n => hanzhongBattle(n), yiling: n => yilingBattle(n), nanzheng: n => nanzhengBattle(n), huangjin: () => getChapter('huangjin'),
};
/** 各基础章节要额外载入的兵种 v2 图（场景自己载的那几张）。 */
const BASE_SHEETS: Partial<Record<SideBaseId, readonly string[]>> = {
  hanzhong: [...HANZHONG_TROOP_SHEETS.qingzhou, ...HANZHONG_TROOP_SHEETS.crossbow], yiling: [...YILING_TROOP_SHEETS.jiefan, ...YILING_TROOP_SHEETS.crossbow],
  jingnan: [...JINGNAN_TROOP_SHEETS.archer, ...JINGNAN_TROOP_SHEETS.shield],
};
export function sideChapter(r: SideRouteDef, stage: number): ChapterDef {
  const d = r.stages[stage - 1], beh = st3(d.behavior), n = st3(stage);
  return sideBattle(r, stage, BASES[r.base](n, beh), r.look ? BASES[r.look](beh, beh) : undefined);
}
function sideLine(r: SideSettle, route: SideRouteDef): string {
  let s = r.message ? '\n' + r.message : '';
  if (r.annexed.length) s += '\n并入领地 · ' + r.annexed.join('、');
  if (r.done) s += `\n势力特产「${route.specialty.title}」生效 · ${route.specialty.text}`;
  return s;
}
function sideConfig(r: SideRouteDef): ArcSceneConfig {
  const stages = r.stages.filter(s => !s.scene);
  return {
    key: SIDE_SCENE_KEY(r.id), arc: r.id, stageKey: SIDE_STAGE_KEY(r.id), transferKey: 'side_' + r.id + 'Transfer',
    stages: stages.map(s => ({ id: s.boss.id, name: s.name, boss: s.boss.name, behavior: st3(s.behavior), scenery: s.scenery })),
    texture: sideTexture, sheet: id => { const b = stages.flatMap(s => [s.boss, s.partner]).find(x => x?.id === id); return b?.v1 ?? 'assets/phase23/lijue.png'; },
    battle: s => sideChapter(r, s), campPrefix: r.id + '-',
    gate: s => sideStageOpen(r.id, s), begin: () => '',
    settle: (_receipt, stage, res) => { const out = settleSideStage(r.id, stage, res); return { provisions: out.provisions, line: sideLine(out, r) }; },
    troopSheets: [...(BASE_SHEETS[r.base] ?? []), ...(r.look ? BASE_SHEETS[r.look] ?? [] : [])],
  };
}

/** 双首领通用配合技：一人冲阵 / 横扫，另一人箭雨 / 扇射 / 贯射；没有就各放各的第一招。 */
export function pairPlan(group: string, a: SideBoss, b: SideBoss, lines: DualPlan['lines'], rid = ''): DualPlan {
  const A = BOSS_MOVES[rid + '.' + a.id] ?? BOSS_MOVES[a.moves], Bm = BOSS_MOVES[rid + '.' + b.id] ?? BOSS_MOVES[b.moves];
  const pick = (d: BossMovesetDef | undefined, kinds: MoveDef['kind'][]): MoveDef | undefined => d && (kinds.map(k => [...d.p1.moves, ...d.p2.moves].find(m => m.kind === k)).find(Boolean) ?? d.p1.moves[0]);
  const ma = pick(A, ['charge', 'sweep', 'thrust']), mb = pick(Bm, ['volley', 'fan', 'thrust', 'sweep']);
  return {
    group, lines,
    combos: [{ id: 'side-pair', name: group + ' · 合击', caption: '一人冲阵 · 一人压阵 · 先躲冲锋再出圈',
      lines: [[a.id, lines[a.id]?.intro ? '随我来！' : '上！'], [b.id, '得令！']],
      place: (x, _y, p) => { const t = Math.atan2(p.y - x.enemy.y, p.x - x.enemy.x), c = Math.cos(t), s = Math.sin(t); return [{ x: p.x - c * 280, y: p.y - s * 280 }, { x: p.x + s * 240, y: p.y - c * 240 }]; },
      fire: (x, y, p, now, warnMul) => {
        if (ma) (x.ctrl as unknown as BossMoveset).combo(ma, now, { aim: { x: p.x, y: p.y }, warnMul });
        if (mb) (y.ctrl as unknown as BossMoveset).combo(mb, now, { aim: { x: p.x, y: p.y }, warnMul });
      } }],
  };
}
const PAIR_LINES: Record<string, DualPlan['lines']> = {
  dongwu: { sunquan: { intro: '江东子弟，随孤出城！', rage: '幼平——！诸军死战！', shaken: '……幼平也降了么。' }, zhoutai: { intro: '周泰在此，谁敢近主公！', rage: '主公！泰与你们拼了！', shaken: '主公都降了……' } },
  nanzhong: { dailai: { intro: '秃龙洞的象兵，出洞！', rage: '朵思大王——！象兵，给我踩！', shaken: '朵思也服了？' }, duosi: { intro: '朵思大王在此，毒泉等着你们！', rage: '洞主！朵思与你们拼了！', shaken: '洞主都服了……' } },
  zhanglu: { zhanglu: { intro: '五斗米道，诸祭酒随我出城！', rage: '阎圃——！鬼卒们，给我挡住！', shaken: '……阎圃也降了。' }, yanpu: { intro: '师君莫急，圃来断后！', rage: '师君！圃与你们拼了！', shaken: '师君都降了……' } },
  xiliang: { hansui: { intro: '九曲黄河韩文约在此！', rage: '伯瞻——！羌兵，给我杀！', shaken: '伯瞻也降了么……' }, madai: { intro: '马岱在此，谁敢一战！', rage: '韩公！岱与你们拼了！', shaken: '韩公都降了……' } },
  gongsun: { gongsunzan: { intro: '白马义从，随我出楼！', rage: '国让——！白马义从，死战！', shaken: '……国让也降了么。' }, tianyu: { intro: '主公且看豫的伏弩！', rage: '主公！豫与你们拼了！', shaken: '主公都降了……豫也降了罢。' } },
  hebei: { yuanshao: { intro: '四世三公，岂容尔等放肆！', rage: '正南——！河北儿郎，给我杀！', shaken: '正南……' }, shenpei: { intro: '审配在此，誓守冀州！', rage: '主公！配今日与你们同死！', shaken: '主公都降了……' } },
  jiangxia: { huangzu: { intro: '江夏是我黄祖的地盘！', rage: '仲业——！放箭！放箭！', shaken: '仲业也降了？' }, wenpin: { intro: '文聘在此，休犯江夏！', rage: '太守！聘与你们拼了！', shaken: '太守都降了……罢了。' } },
  nanjun: { zhouyu: { intro: '曹军已破，荆州岂容他人染指！', rage: '子义——！诸军死战！', shaken: '……子义降了？' }, taishici: { intro: '东莱太史慈在此！', rage: '都督！慈与你们拼了！', shaken: '都督都降了……罢了。' } },
  caowei: { caocao: { intro: '宁我负人，毋人负我——诸将随我出城！', rage: '元让！虎豹骑，给我踏平他们！', shaken: '元让……也降了么。' }, xiahoudun: { intro: '夏侯元让在此，谁敢犯我主！', rage: '孟德——！惇今日与你们同归于尽！', shaken: '孟德……' } },
};

export function sideGameSceneClass(Base: typeof GameScene, r: SideRouteDef) {
  const cfg = sideConfig(r), Arc = thirdGameSceneClass(Base, cfg);
  return class SideRouteGameScene extends Arc {
    preload() {
      super.preload();
      if (r.base === 'nanzheng' || r.look === 'nanzheng') for (const t of Object.values(NZ_TROOPS)) if (nzArt(t.walk) && !this.textures.exists(t.walk)) this.load.spritesheet(t.walk, t.file, { frameWidth: 176, frameHeight: 176 });
      for (const s of r.stages) if (s.partner && !this.textures.exists(sideTexture(s.partner.id))) loadBossSheet(this.load, sideTexture(s.partner.id), s.partner.v1); }
    create() {
      // 借来的第三章兵种是凉州换色贴图（thirdPalette）：第三章场景只在群雄篇里生成，这里先备好
      const beh = st3(r.stages[((this.registry.get(cfg.stageKey) as number | undefined) ?? 1) - 1]?.behavior ?? 1);
      ensureFactionTextures(this, thirdPalette(beh), siegeSourceKeys());
      if (r.base === 'guandu' || r.look === 'guandu') ensureYuanTextures(this, guanduYuanSourceKeys());
      super.create();
    }
    /** 支线关的关隘 / 城池：ARC_FORTS 没列的按关的类型补（data/arcForts.ts sideFort：攻城关 = 城墙 + 城门，其余去掉孤城门）。 */
    get fort(): ArcFort | undefined { const st = this.arcStage; return ARC_FORTS[r.id + '.' + st] ?? sideFort(r.stages[st - 1]?.kind); }
    /** 支线攻城关（kind siege）带上当前征程构筑（只读，打完不写回；2026-11-20）；野战 / 终局照旧空构筑。 */
    protected inheritsCampaign(): boolean { return r.stages[((this.registry.get(cfg.stageKey) as number | undefined) ?? 1) - 1]?.kind === 'siege'; }
    protected dualSetup(first: BossMoveset): boolean {
      const d = r.stages[this.arcStage - 1], b = this.boss, p = d?.partner;
      if (!d || !p || !b || dualOff()) return false;
      const mv = BOSS_MOVES[r.id + '.' + p.id] ?? BOSS_MOVES[p.moves];
      this.startDual(pairPlan(r.faction + '双将', d.boss, p, PAIR_LINES[r.id] ?? {}, r.id),
        { id: d.boss.id, name: d.boss.name, enemy: b, ctrl: first, mount: first.mount ?? null, key: `${r.id}-${this.arcStage}:${d.boss.id}` },
        { id: p.id, name: p.name, at: { x: b.x + 220, y: b.y - 20 }, def: { texture: sideTexture(p.id) }, key: `${r.id}-${this.arcStage}:${p.id}`,
          make: e => ({ ctrl: new BossMoveset(this.arcHost(e), sideTexture(p.id), this.combatNow, mv, 'arc'), mount: null }) });
      return true;
    }
  };
}
export function sideGameScenes(Base: typeof GameScene): Array<typeof GameScene> {
  return SIDE_ROUTES.filter(r => r.stages.some(s => !s.scene)).map(r => sideGameSceneClass(Base, r) as unknown as typeof GameScene);
}

/** 下邳终局「白门楼」：三英战吕布的吕布战（完整招式与大招），结算走支线；劝降成功记进招降名单（P2 吕布可玩时读）。 */
export function sideLubuGameSceneClass(Base: typeof GameScene) {
  const route = sideRoute('xiapi')!, stage = route.stages.length, d = route.stages[stage - 1];
  const cg = d.partner!;
  return class SideLubuGameScene extends Base {
    private test = false;
    /** 陈宫（后排军师）：招式控制器、名牌 / 血条、献计计时。 */
    chengong: Enemy | null = null; private cgLife = 0; private cgCtrl: BossMoveset | null = null; private cgTag?: Phaser.GameObjects.Text; private cgBar?: Phaser.GameObjects.Graphics; private cgPlotAt = 0; private cgBuffUntil = 0; private cgBaseDmg = 0;
    /** 测试用。 */ readonly cgStats = { plots: 0, fell: false };
    constructor() { super('SideLubuGameScene'); }
    preload() { if (!this.textures.exists(sideTexture(cg.id))) loadBossSheet(this.load, sideTexture(cg.id), cg.v1); }
    /** 吕布出阵 1.5 秒后陈宫在他身后现身。 */
    protected spawnBoss(): void {
      const had = this.boss?.active; super.spawnBoss();
      if (!had && this.boss?.active && !this.chengong) this.time.delayedCall(1500, () => this.spawnChengong());
    }
    private spawnChengong(): void {
      const b = this.boss; if (!b?.active || this.over || this.chengong) return;
      const base = this.chapter.enemies.boss, def = { ...base, texture: sideTexture(cg.id), walkVisual: undefined, attackVisual: undefined, hp: base.hp * CHENGONG.hpMul, damage: base.damage * CHENGONG.dmgMul, speed: base.speed * CHENGONG.speedMul };
      const P = this.player, side = b.x >= P.x ? 1 : -1, e = this.spawnEnemy('boss', b.x + side * 200, b.y + 70, 1, true, def); if (!e) return; // 吕布身侧略后，进得了画面
      this.chengong = e; this.cgLife = e.spawnId; this.cgPlotAt = this.combatNow + CHENGONG.plotFirstMs;
      this.cgCtrl = new BossMoveset({ scene: this, boss: e, player: this.player, army: this.legion, spawn: (k, x, y, df) => this.spawnEnemy(k, x, y, 1, true, df), def: k => this.chapter.enemies[k], banner: (t, c) => this.showWaveBanner(t, true, c), sfx: k => this.sfx.play(k) }, sideTexture(cg.id), this.combatNow, BOSS_MOVES['xiapi.' + cg.id] ?? BOSS_MOVES.chengong, 'arc');
      this.cgTag = this.add.text(e.x, e.y, cg.title + ' · ' + cg.name, { fontFamily: FONT, fontSize: '14px', color: '#ffd98a', resolution: 2, stroke: '#2a0c06', strokeThickness: 4 }).setOrigin(.5, 1).setDepth(DEPTH.dmgText - 1).setName('chengong-tag');
      this.cgBar = this.add.graphics().setDepth(DEPTH.dmgText - 1).setName('chengong-bar');
      if (storyMode() !== 'off') castBark(this, e.sprite, cg.name, '奉先！公台在此，为将军设谋！', 'chengong');
      this.showWaveBanner('陈宫随吕布出阵', true, '后排火攻、号令伏兵、给吕布献计——先除陈宫，吕布势孤');
    }
    protected customBossStep(enemy: Enemy, dt: number, now: number): boolean {
      if (enemy === this.chengong && this.cgCtrl) { this.cgCtrl.update(dt, now); return true; }
      return super.customBossStep(enemy, dt, now);
    }
    protected hitEnemy(enemy: Enemy, raw: number, now: number, source: 'melee' | 'arrow' | 'fire' = 'melee', ally = false, weaponHit = true) {
      if (enemy === this.chengong && this.cgCtrl) { raw *= this.cgCtrl.incoming(ally); this.cgCtrl.hit(now); }
      return super.hitEnemy(enemy, raw, now, source, ally, weaponHit);
    }
    /** 陈宫倒下：不结算本关（吕布才是本关首领）；拒降就义——临终一句、以礼厚葬（军粮 + 仁名，本存档首次）。 */
    protected killEnemy(enemy: Enemy): void {
      if (enemy !== this.chengong) { super.killEnemy(enemy); return; }
      const at = { x: enemy.x, y: enemy.y }; this.cgCtrl?.clear(); this.cgCtrl = null; this.cgTag?.destroy(); this.cgBar?.destroy(); this.chengong = null; this.cgStats.fell = true;
      this.endPlot();
      if (this.deathFx) this.deathFx.play(enemy, this.player.x, this.player.y, this.combatNow, this.deathOptsOf(enemy));
      enemy.deactivate(); this.kills += 1;
      if (storyMode() !== 'off') castBark(this, at, cg.name, '今日有死而已！请出就戮，以明军法。', 'chengong');
      let cap = '吕布势孤';
      if (surrenderLive() && markSurrender('honored', cg.id)) { gainProvisions(SURRENDER.persuadeProvisions); cap = '以礼厚葬 · 钱币 +' + SURRENDER.persuadeProvisions + ' · 仁名 +1'; }
      this.showWaveBanner('陈宫拒降就义', false, cap); this.sfx.play('gong');
    }
    update(time: number, delta: number) {
      super.update(time, delta);
      const e = this.chengong; if (!e) return;
      if (!e.active || e.spawnId !== this.cgLife) { this.cgTag?.destroy(); this.cgBar?.destroy(); this.chengong = null; return; }
      const sp = e.sprite, top = sp.y - sp.displayHeight * sp.originY - 12, w = 70, k = Math.max(0, e.hp / Math.max(1, e.maxHp));
      const q = safeWorldPoint(this, e.x, top, Math.max(w / 2, (this.cgTag?.displayWidth ?? 0) / 2), (this.cgTag?.displayHeight ?? 16) + 10); // 靠屏幕边时往内收
      this.cgTag?.setPosition(q.x, q.y); this.cgBar?.clear().fillStyle(0x140a06, .8).fillRect(q.x - w / 2 - 1, q.y + 2, w + 2, 7).fillStyle(0xd8432a, 1).fillRect(q.x - w / 2, q.y + 3, w * k, 5);
      this.cgCtrl?.updateDeath(delta);
      // 献计：每 plotEveryMs 一次，吕布伤害 +plotDmg，持续 plotMs
      if (this.mode === 'none' && !this.over && this.boss?.active && this.combatNow >= this.cgPlotAt) {
        this.cgPlotAt = this.combatNow + CHENGONG.plotEveryMs; this.cgStats.plots++;
        if (this.cgBuffUntil <= this.combatNow) { this.cgBaseDmg = this.boss.def.damage; this.boss.def = { ...this.boss.def, damage: this.cgBaseDmg * (1 + CHENGONG.plotDmg) }; }
        this.cgBuffUntil = this.combatNow + CHENGONG.plotMs; this.boss.sprite.setTint(0xffb080);
        if (storyMode() !== 'off') castBark(this, e.sprite, cg.name, '奉先，左翼空虚，可从侧击！', 'chengong');
        this.showWaveBanner('陈宫献计', true, '吕布伤害 +' + Math.round(CHENGONG.plotDmg * 100) + '% · ' + CHENGONG.plotMs / 1000 + ' 秒');
      }
      if (this.cgBuffUntil && this.combatNow >= this.cgBuffUntil) this.endPlot();
    }
    private endPlot(): void { if (!this.cgBuffUntil) return; this.cgBuffUntil = 0; if (this.boss?.active && this.cgBaseDmg) { this.boss.def = { ...this.boss.def, damage: this.cgBaseDmg }; this.boss.sprite.clearTint(); } }
    protected achievementArc() { return 'lubu'; }
    protected surrenderKey(): string | null { return `xiapi-${stage}:lubu`; }
    protected customChapter() { return this.sideChapter(); }
    private sideChapter(): ChapterDef {
      const c = lubuChallengeChapter(getChapter('hulao'));
      return { ...c, name: `${route.faction} · ${d.name}`, label: `讨伐令 · ${route.name} · ${d.name}`, description: d.story, waves: c.waves.map((w, i) => ({ ...w, name: d.waves[i] ?? w.name })), victoryTitle: '白门楼', victoryText: `${route.name} · 讨伐告成` };
    }
    create() {
      this.test = isChapterTestRun();
      if (!this.test && !sideStageOpen('xiapi', stage)) { this.scene.start('WorldMapScene'); return; }
      const saved = this.registry.get('runConfig') as RunConfig | undefined;
      this.registry.remove('campaignTransfer'); this.registry.remove('worldCampaign');
      this.registry.set('runConfig', { ...saved, character: saved?.character ?? 'zhaoyun', chapter: 'hulao', westStage: 3 });
      super.create();
      this.chapter = this.sideChapter();
      const effect = permanentEffects(); this.legion.healingMultiplier = effect.healMultiplier; applyCitySpecialties(this.player, effect, true);
      for (let i = 0; i < effect.reinforcements; i++) this.legion.recruit(i === 0 ? 'swordsman' : 'spearman', 1, true);
      this.hudTexts.chapter.setText(this.chapter.name);
    }
    protected bossRelicKey(): string | null { return 'lubu'; }
    protected finish(victory: boolean, reason: RunEndReason = 'death') {
      if (this.over) return; super.finish(victory, reason);
      const debug = this.test || this.debugModified || this.debugJumped || !!this.player.damageImmune;
      const out = settleSideStage('xiapi', stage, { victory, debug });
      this.resultTexts.subtitle.setText(victory ? this.chapter.victoryText : '吕布难当 · 整军再战');
      this.resultTexts.body.setText(this.resultTexts.body.text + '\n讨伐令 · 钱币 +' + out.provisions + sideLine(out, route));
      const home = this.resultPanel.getByName('result-home') as Phaser.GameObjects.Text;
      home?.setText('返回天下地图').removeAllListeners('pointerdown').on('pointerdown', () => { this.registry.set('mapFocusNode', 'side-xiapi'); this.scene.start('WorldMapScene'); });
      const restart = this.resultPanel.getByName('result-restart') as Phaser.GameObjects.Image;
      restart?.removeAllListeners('pointerdown').on('pointerdown', () => this.scene.restart());
    }
  };
}
