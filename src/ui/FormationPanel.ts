import Phaser from 'phaser';
import { FONT, HEADING_FONT } from '../config';
import { LegionFormation } from '../systems/LegionFormation';
import { FORMATIONS, FORMATION, HERO_FORMATION, formationLoadout, formationPower, formationSlots, formationsKnown, setFormationLoadout, type FormationId } from '../data/formations';
import { SCHOOLS, type SchoolId } from '../data/schools';
import type { Ally } from '../entities/Ally';
import type { Player } from '../entities/Player';

/**
 * 行营「布阵」页（formation-design.md §4.2；用户 11-20「全按推荐」，统筹：一屏一个水墨按钮、不要大框）。
 * 左：主阵 / 备阵两行字签（点一下就布上，同阵对调），下面是选中阵的说明；右：站位示意（用你现在的部曲按这个阵排，★ 主将、◆ 随从、灰点 = 入阵人数之外的后军）。
 * 没有自己的按钮：页面唯一的水墨按钮仍是「率军出征」。
 */
export interface FormationPanelHost {
  scene: Phaser.Scene; root: Phaser.GameObjects.Container; player: Player; units: readonly Ally[];
  hero: string; followerHeroes: readonly string[]; /** 随行人数（含无名之辈；示意图画几个 ◆）。 */ followers: number; majors: readonly SchoolId[]; command: number;
  /** 布阵改了（GameScene 让战斗里的军阵重读）。 */ changed?: () => void;
}
const CN_ROLE: Record<FormationId, string> = { circle: '守', wedge: '突', crane: '包抄', geese: '射', snake: '机动', bazhen: '困' };
let focus: FormationId | null = null;

export function drawFormationPanel(h: FormationPanelHost, x0: number, y0: number, w: number, hgt: number): void {
  const s = h.scene, known = formationsKnown(h.hero, h.followerHeroes), load = formationLoadout(h.hero, known);
  const T = (x: number, y: number, t: string, size: number, color = '#dfd4bd', head = false) => { const o = s.add.text(x, y, t, { fontFamily: head ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2, stroke: '#140e08', strokeThickness: 2 }).setScrollFactor(0); h.root.add(o); return o; };
  if (!known.length) { T(x0, y0, '尚未学会阵法', 16, '#a8956c'); return; }
  if (!focus || !known.includes(focus)) focus = load[0] ?? known[0];
  const leftW = Math.min(440, w * .5);
  // 主阵 / 备阵：字签行（不加框；选中的金色 + 一笔下划线）
  const lines = s.add.graphics().setScrollFactor(0); h.root.add(lines);
  ([0, 1] as const).forEach(slot => {
    const y = y0 + slot * 46;
    T(x0, y + 4, slot ? '备阵' : '主阵', 17, '#e9cf96', true).setName('formation-slot-' + slot);
    let x = x0 + 58;
    for (const id of known) {
      const on = load[slot] === id, d = FORMATIONS[id], fav = HERO_FORMATION[h.hero] === id, ik = 'formation_icon_' + id;
      if (s.textures.exists(ik)) { h.root.add(s.add.image(x + 12, y + 16, ik).setDisplaySize(26, 26).setScrollFactor(0).setAlpha(on ? 1 : .55)); x += 28; }
      const t = T(x, y + 5, d.name + (fav ? '·擅' : ''), 15, on ? '#f6dc9c' : '#a99a7c').setName(`formation-pick-${slot}-${id}`).setPadding(2, 3, 2, 3).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => { t.setColor('#fff0cd'); }).on('pointerout', () => t.setColor(on ? '#f6dc9c' : '#a99a7c'))
        .on('pointerdown', () => { setFormationLoadout(h.hero, slot, id, known); focus = id; h.changed?.(); });
      if (on) lines.lineStyle(2, 0xd9b46a, .9).lineBetween(x + 2, y + 28, x + t.width - 2, y + 28);
      x += t.width + 14;
      if (x > x0 + leftW + 60) break;
    }
  });
  if (load.length < 2) T(x0 + 58, y0 + 92, '只学会一个阵时没有备阵', 12, '#8e7f62');
  // 说明
  const id = focus, d = FORMATIONS[id], p = formationPower(id, h.hero, h.majors), yy = y0 + 112;
  lines.lineStyle(1, 0x6f5a3a, .7).lineBetween(x0, yy - 8, x0 + leftW, yy - 8);
  const fik = 'formation_icon_' + id, ix = s.textures.exists(fik) ? 62 : 0;
  if (ix) h.root.add(s.add.image(x0 + 26, yy + 14, fik).setDisplaySize(56, 56).setScrollFactor(0).setName('formation-focus-icon'));
  T(x0 + ix, yy, d.name, 22, '#f3e3bf', true).setName('formation-focus-name');
  T(x0 + ix + 96, yy + 6, CN_ROLE[id] + ' · 呼应「' + SCHOOLS[d.echo].name + '」' + (p.echo ? '（主修，×1.5）' : ''), 13, p.echo ? '#cfe3b0' : '#a8956c');
  const rows: Array<[string, string, string]> = [['阵势', d.main, '#e8dcc0'], ['代价', d.cost, '#d8a890'], ['主将', d.hero, '#e8dcc0'], ['出击', d.sortie.replace(/^出击：/, ''), '#e8dcc0'], ['适用', d.fit, '#cfe3b0']];
  if (p.favored) rows.push(['擅阵', '主将擅长此阵，阵势 ×1.25', '#f6dc9c']);
  if (p.half) rows.push(['半效', '靠诸葛亮随行布八阵，阵势减半', '#d8a890']);
  let ry = yy + 36;
  for (const [k, v, c] of rows) { T(x0, ry, k, 13, '#b9a47a', true); const t = T(x0 + 42, ry, v, 13, c); t.setWordWrapWidth(leftW - 46, true); ry += Math.max(22, t.height + 6); }
  T(x0, ry + 4, '护阵（E）时阵势生效；出击时散阵，按上面的打法冲杀。战斗中按 X 在主阵、备阵之间变阵（冷却 ' + FORMATION.switchMs / 1000 + ' 秒，主修兵阵 ' + FORMATION.switchMsFormation / 1000 + ' 秒）。', 12, '#8e7f62').setWordWrapWidth(leftW, true);
  // 站位示意（用现在的部曲按这个阵排；UI 示意，不是战场特效）
  const cx = x0 + leftW + (w - leftW) / 2, cy = y0 + 34 + (hgt - 34) * .5, g = s.add.graphics().setScrollFactor(0).setName('formation-diagram'); h.root.add(g);
  const fake = { x: 0, y: 0 } as Player, lf = new LegionFormation(fake);
  let units = h.units.filter(u => u.active);
  const sample = !units.length;
  if (sample) units = (['swordsman', 'swordsman', 'spearman', 'spearman', 'guardian', 'swordsman', 'archer', 'archer', 'crossbowman', 'medic'] as const).map((k, i) => ({ id: -1 - i, kind: k, active: true, def: { ranged: k === 'archer' || k === 'crossbowman' } } as unknown as Ally));
  const cap = formationSlots(h.command); lf.setShape(id, cap); lf.rebuild([...units], {});
  const pts = units.map(u => ({ u, p: lf.position(u), on: lf.inForm.has(u.id) }));
  const ext = Math.max(80, ...pts.map(q => Math.hypot(q.p.x, q.p.y))), k = Math.min(1.1, (Math.min(w - leftW, hgt - 40) * .46) / ext);
  if (id === 'bazhen') { g.lineStyle(1, 0xc8a46a, .35).strokeCircle(cx, cy, FORMATION.bazhen.r * k); }
  for (const { u, p, on } of pts) {
    const x = cx + p.x * k, y = cy + p.y * k, ranged = (u.def as { ranged?: boolean }).ranged, medic = u.kind === 'medic';
    const col = !on ? 0x5e5446 : ranged ? 0x9ec4d8 : medic ? 0x9bc6a1 : 0xd0a060;
    g.fillStyle(col, on ? .95 : .6);
    if (ranged) g.fillTriangle(x, y - 6, x - 5, y + 4, x + 5, y + 4); else if (medic) g.fillCircle(x, y, 4.5); else g.fillRect(x - 4.5, y - 4.5, 9, 9);
  }
  const nF = Math.min(3, h.followers);
  for (let i = 0; i < nF; i++) { const q = lf.followerSlot(i, nF); if (!q) continue; const x = cx + q.x * k, y = cy + q.y * k; g.fillStyle(0x7fd0c0, .95).fillPoints([{ x, y: y - 7 }, { x: x + 6, y }, { x, y: y + 7 }, { x: x - 6, y }] as Phaser.Types.Math.Vector2Like[], true); }
  // 主将：金色五角星；朝向箭头朝上
  const star: Phaser.Types.Math.Vector2Like[] = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.5 : 10, a = -Math.PI / 2 + i * Math.PI / 5; star.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
  g.fillStyle(0xf3d48a, 1).fillPoints(star, true);
  g.lineStyle(1.5, 0xd9b46a, .6).lineBetween(cx, cy - 18, cx, cy - 34).lineBetween(cx, cy - 34, cx - 5, cy - 28).lineBetween(cx, cy - 34, cx + 5, cy - 28);
  const inN = pts.filter(q => q.on).length;
  T(cx, y0, (sample ? '示意（尚无部曲）· ' : '') + `入阵 ${inN} / ${units.length} 人（8 + 2 × 统御 ${Math.floor(h.command)} = ${cap}）`, 12, '#b9a47a').setOrigin(.5, 0).setName('formation-cap');
  T(cx, y0 + 18, '★ 主将（朝上为前）· ◆ 随从 · ■ 近战 · ▲ 远程 · ● 军医 · 灰 = 后军', 11, '#8e7f62').setOrigin(.5, 0);
}
