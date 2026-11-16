import Phaser from 'phaser';
import {GameScene} from './GameScene';
import {getChapter} from '../data/chapters';
import {LUBU_CHALLENGE, lubuChallengeChapter} from '../data/dongzhuo';
import {isChapterTestRun} from '../systems/ChapterProgress';
import {beginLubuChallenge, cityIncomeLine, lubuChallengeOpen, permanentEffects, settleLubuChallenge, takeExpeditionReserve, abandonExpedition} from '../world/WorldStore';
import {applyCitySpecialties} from '../systems/CityBonuses';
import {LEGENDS, QUALITIES, affixValue, newItemUid, type ItemInstance} from '../data/items';
import {addItems} from '../systems/ItemStore';
import type {RunEndReason} from '../types';
import type {RunConfig} from '../data/characters';

/** 赤兔（橙色名器）：首次击败吕布的奖励。 */
export function chituItem(rng: () => number = Math.random): ItemInstance | null {
  const l = LEGENDS.find(x => x.id === LUBU_CHALLENGE.firstItem); if (!l) return null;
  return {uid: newItemUid(), base: l.id, quality: 'orange', affixes: l.affixes.map(id => ({id, value: affixValue(id, 'orange', rng)})), special: l.special};
}

/**
 * 天下地图挑战关「虎牢关 · 三英战吕布」：原第二章虎牢关的吕布战（3 波），可反复挑战；首次击败吕布得赤兔。
 * 不推进讨董进度；结算走 WorldStore.settleLubuChallenge。
 */
export function lubuGameSceneClass(Base: typeof GameScene) {
  return class LubuGameScene extends Base {
    protected achievementArc() { return 'lubu'; }
    private receipt = ''; private test = false;
    constructor() { super('LubuGameScene'); }
    create() {
      this.test = isChapterTestRun();
      if (!this.test && !lubuChallengeOpen()) { this.scene.start('WorldMapScene'); return; }
      const saved = this.registry.get('runConfig') as RunConfig | undefined;
      this.registry.remove('campaignTransfer'); this.registry.remove('worldCampaign');
      this.registry.set('runConfig', {...saved, character: saved?.character ?? 'zhaoyun', chapter: 'hulao', westStage: 3});
      super.create();
      this.chapter = lubuChallengeChapter(getChapter('hulao'));
      this.receipt = this.test ? '' : beginLubuChallenge();
      const effect = permanentEffects(); this.legion.healingMultiplier = effect.healMultiplier; applyCitySpecialties(this.player, effect, true);
      for (let i = 0; i < effect.reinforcements; i++) this.legion.recruit(i === 0 ? 'swordsman' : 'spearman', 1, true);
      if (!this.test) for (const kind of takeExpeditionReserve(effect.reserveSlots)) { this.legion.recruit(kind, 1, true); this.allies[this.allies.length - 1].reserveSoldier = true; }
      this.hudTexts.chapter.setText(this.chapter.name);
    }
    protected customChapter() { return lubuChallengeChapter(getChapter('hulao')); }
    protected abandonRun() { if (!this.over) abandonExpedition(this.receipt, this.allies.filter(u => u.active && u.reserveSoldier).map(u => u.kind)); }
    protected finish(victory: boolean, reason: RunEndReason = 'death') {
      if (this.over) return; super.finish(victory, reason);
      const debug = this.test || this.debugModified || this.debugJumped || this.player.damageImmune;
      const r = settleLubuChallenge(this.receipt, {victory, bossKilled: this.bossKilled, debug, elapsed: this.elapsed, returned: this.allies.filter(u => u.active && u.reserveSoldier).map(u => u.kind)});
      let loot = '';
      if (r.first && !debug) { const it = chituItem(); if (it) { addItems([it]); loot = ` · 名马「赤兔」（${QUALITIES.orange.label}）入行囊`; } }
      this.resultTexts.subtitle.setText(victory ? (r.first ? '三英战吕布 · 首胜得赤兔' : this.chapter.victoryText) : '吕布难当 · 整军再战');
      this.resultTexts.body.setText(this.resultTexts.body.text + '\n挑战 · 军粮 +' + r.provisions + loot + cityIncomeLine(r) + (debug ? '\n' + r.message : ''));
      const home = this.resultPanel.getByName('result-home') as Phaser.GameObjects.Text;
      home?.setText('返回天下地图').removeAllListeners('pointerdown').on('pointerdown', () => { this.registry.set('mapFocusNode', 'lubu'); this.scene.start('WorldMapScene'); });
      const restart = this.resultPanel.getByName('result-restart') as Phaser.GameObjects.Image;
      restart?.removeAllListeners('pointerdown').on('pointerdown', () => this.scene.restart());
    }
  };
}
