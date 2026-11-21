import Phaser from 'phaser';
import { DEPTH } from '../config';
import { FORMATION, FORMATION_IDS, type FormationId } from '../data/formations';
import { formationSigilOn } from './BattleSettings';
import { playSheet } from './SkillFxSheets';
import type { Legion } from './Legion';
import type { Player } from '../entities/Player';

/** 阵纹 / 阵旗图标的贴图（即梦手绘，tools/prepare-formation-art.py）。 */
export const SIGIL_KEY = 'formation_sigils';
export const formationIconKey = (id: FormationId): string => 'formation_icon_' + id;
/** 按需加载（开打时 GameScene 建 FormationFx 时调；行营布阵页、增益条、舆图都用）。 */
/** 正在载入的键（同一张图载入完成前又被要一次时不重复排队，免得「Texture key already in use」）。 */
const pending = new Set<string>();
export function loadFormationArt(scene: Phaser.Scene, done?: () => void): void {
  const L = scene.load, miss: string[] = [];
  const want = (k: string, add: () => void) => { if (scene.textures.exists(k)) return; miss.push(k); if (pending.has(k)) return; pending.add(k); add(); L.once(`filecomplete-${k === SIGIL_KEY ? 'spritesheet' : 'image'}-${k}`, () => pending.delete(k)); };
  want(SIGIL_KEY, () => L.spritesheet(SIGIL_KEY, 'assets/formation/sigils.webp', { frameWidth: 512, frameHeight: 512 }));
  for (const id of FORMATION_IDS) { const k = formationIconKey(id); want(k, () => L.image(k, `assets/formation/icon_${id}.webp`)); }
  if (miss.length) { L.once(Phaser.Loader.Events.COMPLETE, () => { for (const k of miss) if (scene.textures.exists(k)) pending.delete(k); }); scene.events.once('shutdown', () => { for (const k of miss) pending.delete(k); }); } // 场景中途关掉（载入作废）也放掉，下次重新排
  if (!miss.length) { done?.(); return; }
  if (done) L.once(Phaser.Loader.Events.COMPLETE, done);
  if (!L.isLoading()) L.start();
}
/** 阵纹的显示（初值，交 UI / 平衡）：成阵时的透明度、变阵铺开时长。设置里「阵纹」关掉就不画。 */
export const SIGIL = { alpha: .3, settleAlpha: .16, fadeMs: 260, unfoldMs: 650, minSize: 220, maxSize: 560, snakeSize: 250 } as const;

/**
 * 战场上的军阵表现（formation-design.md §6）：
 * - 地面阵纹：当前阵的手绘阵纹铺在部曲脚下（低透明度，随主将朝向转），只在护阵、成阵后显示；出击时淡出。
 * - 变阵演出：主将脚下竖起金盾旗（复用兵阵觉醒 fx_awaken_formation 序列帧，缩小），新阵纹从中心铺开。
 */
export class FormationFx {
  private img?: Phaser.GameObjects.Image; private alpha = 0; private shown: FormationId | null = null; private unfoldAt = -1e9; private lastSwitch = 0;
  constructor(private readonly scene: Phaser.Scene, private readonly legion: Legion, private readonly player: Player,
    private readonly state: () => { id: FormationId | null; formed: boolean; settling: boolean; switches: number }) { loadFormationArt(scene); }
  update(dt: number, now: number): void {
    const s = this.state(), on = !!s.id && formationSigilOn();
    if (s.switches !== this.lastSwitch) { this.lastSwitch = s.switches; this.unfoldAt = now; if (s.id) this.flag(); }
    const target = !on ? 0 : s.formed ? SIGIL.alpha : s.settling ? SIGIL.settleAlpha : 0;
    const k = Math.min(1, dt * 1000 / SIGIL.fadeMs); this.alpha += (target - this.alpha) * k;
    if (!this.scene.textures.exists(SIGIL_KEY) || (this.alpha < .01 && !this.img?.visible)) { this.img?.setVisible(false); return; }
    if (!this.img) this.img = this.scene.add.image(0, 0, SIGIL_KEY, 0).setDepth(DEPTH.deco + 1).setName('formation-sigil');
    const id = s.id ?? this.shown; if (!id) { this.img.setVisible(false); return; }
    this.shown = id;
    const f = this.legion.formation, c = id === 'snake' && !f.anchor ? { x: this.player.x, y: this.player.y } : f.world(f.center);
    const base = id === 'snake' ? SIGIL.snakeSize : id === 'bazhen' ? (FORMATION.bazhen.ring + 40) * 2.3 : Phaser.Math.Clamp(f.extent * 2.25, SIGIL.minSize, SIGIL.maxSize);
    const t = Math.min(1, (now - this.unfoldAt) / SIGIL.unfoldMs), grow = .45 + .55 * (1 - Math.pow(1 - t, 3)), flash = t < 1 ? (1 - t) * .25 : 0;
    this.img.setFrame(FORMATION_IDS.indexOf(id)).setPosition(c.x, c.y).setRotation(f.facing + Math.PI / 2).setDisplaySize(base * grow, base * grow)
      .setAlpha(Math.min(1, this.alpha + (on ? flash : 0))).setVisible(this.alpha > .01);
  }
  /** 变阵：主将脚下竖起金盾旗（兵阵觉醒的手绘序列帧，缩小、快放）。 */
  private flag(): void {
    const p = this.player;
    playSheet(this.scene, 'fx_awaken_formation', p.x, p.y + 10, { size: 140, ms: 760, depth: DEPTH.fx, originY: .78, alpha: .9, name: 'formation-flag',
      onUpdate: img => img.setPosition(p.x, p.y + 10) });
  }
  destroy(): void { this.img?.destroy(); this.img = undefined; }
}
