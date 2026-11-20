import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { thirdGameSceneClass, type ArcSceneConfig } from './ThirdGameScene';
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
import { BossMoveset } from '../systems/BossMoveset';
import { dualOff, type DualPlan } from '../systems/DualBoss';
import { loadBossSheet } from '../systems/ArtStyle';
import { ensureFactionTextures } from '../systems/FactionPalette';
import { siegeSourceKeys } from '../data/siege';
import { isChapterTestRun } from '../systems/ChapterProgress';
import { applyCitySpecialties } from '../systems/CityBonuses';
import { permanentEffects } from '../world/WorldStore';
import { settleSideStage, sideRetries, sideStageOpen, type SideSettle } from '../world/SideRouteStore';
import type { RunEndReason } from '../types';
import type { RunConfig } from '../data/characters';

/**
 * 其他势力支线的战斗场景（other-factions-design.md P1）：
 *  - 攻城 / 野战 / 终局关套第三章式三关框架（ThirdGameScene + 支线 cfg：开放、结算换成 SideRouteStore）；兵种与数值借对应时期的章节，首领换成本关。
 *  - 终局双首领（南郡周瑜 + 太史慈、许都曹操 + 夏侯惇）走 DualBoss，配合技用两人借来的招式（一人冲阵 / 横扫、一人箭雨 / 扇射）。
 *  - 下邳终局「白门楼」交给三英战吕布的吕布战（SideLubuGameScene）：吕布有完整招式与大招。
 * 每关首领都可劝降（data/surrender.ts）；终局胜了没劝降势力之主，下次再战劝降 +15%（parleyFlags sideRetry<N>）。
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
    /** 终局再战：第 N 回劝降 +15% × N。 */
    protected parleyFlags(): Record<string, boolean> { const n = this.arcStage === cfg.stages.length ? sideRetries(r.id) : 0; return n > 0 ? { ['sideRetry' + n]: true } : {}; }
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
  return class SideLubuGameScene extends Base {
    private test = false;
    constructor() { super('SideLubuGameScene'); }
    protected achievementArc() { return 'lubu'; }
    protected surrenderKey(): string | null { return `xiapi-${stage}:lubu`; }
    protected parleyFlags(): Record<string, boolean> { const n = sideRetries('xiapi'); return n > 0 ? { ['sideRetry' + n]: true } : {}; }
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
      this.resultTexts.body.setText(this.resultTexts.body.text + '\n讨伐令 · 军粮 +' + out.provisions + sideLine(out, route));
      const home = this.resultPanel.getByName('result-home') as Phaser.GameObjects.Text;
      home?.setText('返回天下地图').removeAllListeners('pointerdown').on('pointerdown', () => { this.registry.set('mapFocusNode', 'side-xiapi'); this.scene.start('WorldMapScene'); });
      const restart = this.resultPanel.getByName('result-restart') as Phaser.GameObjects.Image;
      restart?.removeAllListeners('pointerdown').on('pointerdown', () => this.scene.restart());
    }
  };
}
