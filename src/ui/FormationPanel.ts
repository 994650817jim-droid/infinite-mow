import Phaser from 'phaser';
import { FONT, HEADING_FONT } from '../config';
import { LegionFormation } from '../systems/LegionFormation';
import { SIGIL_KEY } from '../systems/FormationFx';
import { FORMATIONS, FORMATION, FORMATION_IDS, HERO_FORMATION, formationLoadout, formationPower, formationSlots, formationsKnown, setFormationLoadout, type FormationId } from '../data/formations';
import { SCHOOLS, type SchoolId } from '../data/schools';
import type { Ally } from '../entities/Ally';
import type { Player } from '../entities/Player';

/**
 * 行营「布阵」页（formation-design.md §4.2；11-21 制作人验收退回重做：对齐、去重复、选中态明显、未学会的阵上锁）。
 * 上：主阵 / 备阵两行阵签（六个阵都列出：选中 = 漆牌金边；擅阵 = 朱印「擅」；没学会 = 灰 + 锁，点了只看说明与学法）。
 * 下：左右两张等高的卡——左「说明」（阵名、呼应、阵势 / 代价 / 主将 / 出击 / 适用），右「站位」（手绘阵纹淡底 + 用当前部曲排出的站位，上写入阵人数、下写图例）。
 * 页面唯一的水墨按钮仍是「率军出征」；卡只用淡底细金线，不加大框。
 */
export interface FormationPanelHost {
  scene: Phaser.Scene; root: Phaser.GameObjects.Container; player: Player; units: readonly Ally[];
  hero: string; followerHeroes: readonly string[]; /** 随行人数（含无名之辈；示意图画几个 ◆）。 */ followers: number; majors: readonly SchoolId[]; command: number;
  /** 布阵改了（GameScene 让战斗里的军阵重读）。 */ changed?: () => void;
}
const CN_ROLE: Record<FormationId, string> = { circle: '守', wedge: '突', crane: '包抄', geese: '射', snake: '机动', bazhen: '困' };
/** 没学会时写怎么学（mechanicUnlocks：formation / f_snake / f_crane / f_geese；八阵看诸葛亮）。 */
const HOW_TO_LEARN: Record<FormationId, string> = { circle: '第四章通关后徐庶授', wedge: '第四章通关后徐庶授', snake: '5-1 长坂之后赵云授', crane: '5-2 赤壁之后周瑜授', geese: '第六章通关后黄忠授', bazhen: '诸葛亮专属：诸葛亮为主将，或随行（半效）' };
let focus: FormationId | null = null;

export function drawFormationPanel(h: FormationPanelHost, x0: number, y0: number, w: number, hgt: number): void {
  const s = h.scene, known = formationsKnown(h.hero, h.followerHeroes), load = formationLoadout(h.hero, known);
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { (o as unknown as { setScrollFactor?: (n: number) => void }).setScrollFactor?.(0); h.root.add(o); return o; };
  const T = (x: number, y: number, t: string, size: number, color = '#dfd4bd', head = false) => add(s.add.text(x, y, t, { fontFamily: head ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2, stroke: '#140e08', strokeThickness: 2 }));
  if (!known.length) { T(x0, y0, '尚未学会阵法', 16, '#a8956c'); return; }
  if (!focus) focus = load[0] ?? known[0];
  const g = add(s.add.graphics());

  // ———— 主阵 / 备阵：阵签行 ————
  const ROW_H = 40, CHIP_H = 32;
  ([0, 1] as const).forEach(slot => {
    const y = y0 + slot * (ROW_H + 6), cyRow = y + ROW_H / 2;
    T(x0, cyRow - 11, slot ? '备阵' : '主阵', 18, '#e9cf96', true).setName('formation-slot-' + slot);
    let x = x0 + 60;
    for (const id of FORMATION_IDS) {
      const learned = known.includes(id), on = learned && load[slot] === id, d = FORMATIONS[id], fav = HERO_FORMATION[h.hero] === id, ik = 'formation_icon_' + id;
      const name = s.add.text(0, 0, d.name, { fontFamily: HEADING_FONT, fontSize: '15px', color: on ? '#fff1cf' : learned ? '#d8c8a4' : '#6f6656', resolution: 2, stroke: '#140e08', strokeThickness: 2 });
      const cw = 8 + 26 + 5 + name.width + (fav ? 20 : 0) + (learned ? 0 : 16) + 10;
      // 选中：漆牌 + 金边（明显的选中态）；没选中只留一点淡底，鼠标移上去亮一点
      g.fillStyle(on ? 0x5a1f14 : 0x1a120b, on ? .95 : .35).fillRoundedRect(x, cyRow - CHIP_H / 2, cw, CHIP_H, 6);
      if (on) { g.lineStyle(2, 0xe8c27a, 1).strokeRoundedRect(x, cyRow - CHIP_H / 2, cw, CHIP_H, 6); g.lineStyle(1, 0xffe2a0, .45).strokeRoundedRect(x + 3, cyRow - CHIP_H / 2 + 3, cw - 6, CHIP_H - 6, 4); }
      if (s.textures.exists(ik)) add(s.add.image(x + 8 + 13, cyRow, ik).setDisplaySize(26, 26).setAlpha(learned ? 1 : .35).setTint(learned ? 0xffffff : 0x8a8a8a));
      add(name).setPosition(x + 8 + 26 + 5, cyRow - name.height / 2);
      let ex = x + 8 + 26 + 5 + name.width + 3;
      if (fav) { g.fillStyle(0xa3261c, 1).fillRoundedRect(ex, cyRow - 8, 16, 16, 3); add(s.add.text(ex + 8, cyRow, '擅', { fontFamily: HEADING_FONT, fontSize: '11px', color: '#fff1cf', resolution: 2 }).setOrigin(.5)); ex += 20; }
      if (!learned) { /* 锁：小锁头（UI 线描） */ g.lineStyle(1.6, 0x8a8070, .95).beginPath().arc(ex + 6, cyRow - 3, 3.6, Math.PI, 0).strokePath(); g.fillStyle(0x8a8070, .95).fillRoundedRect(ex + 1, cyRow - 3, 10, 8, 2); }
      const hit = add(s.add.rectangle(x + cw / 2, cyRow, cw, CHIP_H, 0xffffff, .001).setName(`formation-pick-${slot}-${id}`).setInteractive({ useHandCursor: true }));
      hit.setData('learned', learned).setData('on', on);
      const base = on ? '#fff1cf' : learned ? '#d8c8a4' : '#6f6656';
      hit.on('pointerover', () => name.setColor(learned ? '#fff1cf' : '#9a907e')).on('pointerout', () => name.setColor(base)).on('pointerdown', () => { focus = id; if (learned) setFormationLoadout(h.hero, slot, id, known); h.changed?.(); });
      x += cw + 10;
    }
  });
  if (load.length < 2) T(x0 + w, y0 + ROW_H + 6 + ROW_H / 2 - 8, '只学会一个阵时没有备阵', 12, '#8e7f62').setOrigin(1, 0);

  // ———— 下面两张等高的卡 ————
  const cy0 = y0 + 2 * ROW_H + 18, ch = hgt - (cy0 - y0), gap = 16, lw = Math.round((w - gap) * .5), rx = x0 + lw + gap, rw = w - lw - gap;
  const card = (x: number, cw: number) => { g.fillStyle(0x120c08, .5).fillRoundedRect(x, cy0, cw, ch, 8); g.lineStyle(1, 0xc9a35d, .4).strokeRoundedRect(x, cy0, cw, ch, 8); };
  card(x0, lw); card(rx, rw);

  // 左：说明
  const id = focus, d = FORMATIONS[id], learned = known.includes(id), p = formationPower(id, h.hero, h.majors), pad = 14;
  const fik = 'formation_icon_' + id, hasIcon = s.textures.exists(fik), tx = x0 + pad + (hasIcon ? 56 : 0);
  if (hasIcon) add(s.add.image(x0 + pad + 24, cy0 + pad + 22, fik).setDisplaySize(48, 48).setAlpha(learned ? 1 : .45).setName('formation-focus-icon'));
  T(tx, cy0 + pad + 2, d.name, 21, learned ? '#f3e3bf' : '#a99a7c', true).setName('formation-focus-name');
  T(tx, cy0 + pad + 30, learned ? CN_ROLE[id] + ' · 呼应「' + SCHOOLS[d.echo].name + '」' + (p.echo ? '（主修 · ×1.5）' : '') + (p.favored ? ' · 擅阵 ×1.25' : '') : '未学会 · ' + HOW_TO_LEARN[id], 12, learned ? (p.echo ? '#cfe3b0' : '#b9a47a') : '#d8a890').setName('formation-focus-sub');
  const rows: Array<[string, string, string]> = [['阵势', d.main, '#e8dcc0'], ['代价', d.cost, '#d8a890'], ['主将', d.hero, '#e8dcc0'], ['出击', d.sortie.replace(/^出击：/, ''), '#e8dcc0'], ['适用', d.fit, '#cfe3b0']];
  if (p.half) rows.push(['半效', '靠诸葛亮随行布八阵，阵势减半', '#d8a890']);
  let ry = cy0 + pad + 58;
  for (const [k, v, c] of rows) { T(x0 + pad, ry, k, 13, '#b9a47a', true); const t = T(x0 + pad + 42, ry, v, 13, learned ? c : '#8e8270'); t.setWordWrapWidth(lw - pad * 2 - 42, true); ry += Math.max(21, t.height + 5); }
  T(x0 + pad, cy0 + ch - pad - 14, '护阵（E）生效 · 出击时散阵 · 战斗中 X 变阵（冷却 ' + FORMATION.switchMs / 1000 + ' 秒，主修兵阵 ' + FORMATION.switchMsFormation / 1000 + ' 秒）', 11, '#8e7f62').setName('formation-help');

  // 右：站位（手绘阵纹淡底 + 用现在的部曲按这个阵排；UI 示意，不是战场特效）
  const fake = { x: 0, y: 0 } as Player, lf = new LegionFormation(fake);
  let units = h.units.filter(u => u.active);
  const sample = !units.length;
  if (sample) units = (['swordsman', 'swordsman', 'spearman', 'spearman', 'guardian', 'swordsman', 'archer', 'archer', 'crossbowman', 'medic'] as const).map((k, i) => ({ id: -1 - i, kind: k, active: true, def: { ranged: k === 'archer' || k === 'crossbowman' } } as unknown as Ally));
  const cap = formationSlots(h.command); lf.setShape(id, cap); lf.rebuild([...units], {});
  const pts = units.map(u => ({ u, p: lf.position(u), on: lf.inForm.has(u.id) }));
  const nF = Math.min(3, h.followers), fol = Array.from({ length: nF }, (_, i) => lf.followerSlot(i, nF)).filter((q): q is { x: number; y: number } => !!q);
  const top = cy0 + 30, bottom = cy0 + ch - 26, cx = rx + rw / 2, cy = (top + bottom) / 2, boxH = bottom - top, boxW = rw - 24;
  // 站位图按内容外框居中、尽量撑满（上下留字的位置）
  const all = [...pts.map(q => q.p), ...fol, { x: 0, y: -26 }], minX = Math.min(...all.map(q => q.x)) - 8, maxX = Math.max(...all.map(q => q.x)) + 8, minY = Math.min(...all.map(q => q.y)) - 8, maxY = Math.max(...all.map(q => q.y)) + 8;
  const k = Math.min(1.25, boxW / Math.max(60, maxX - minX), boxH / Math.max(60, maxY - minY)), ox = cx - (minX + maxX) / 2 * k, oy = cy - (minY + maxY) / 2 * k;
  // 阵纹淡底：和战场上一样铺在入阵士兵的中心、按阵的大小（FormationFx），不超出卡片
  if (s.textures.exists(SIGIL_KEY)) { const c = id === 'snake' ? { x: 0, y: 0 } : lf.world(lf.center), sz = Math.min(boxW, boxH + 20, Math.max(150, lf.extent * 2.25 * k)); add(s.add.image(ox + c.x * k, oy + c.y * k, SIGIL_KEY, FORMATION_IDS.indexOf(id)).setDisplaySize(sz, sz).setAlpha(learned ? .16 : .08).setName('formation-diagram-sigil')); }
  const dg = add(s.add.graphics().setName('formation-diagram'));
  if (id === 'bazhen') dg.lineStyle(1, 0xc8a46a, .35).strokeCircle(ox, oy, FORMATION.bazhen.r * k);
  for (const { u, p: q, on } of pts) {
    const x = ox + q.x * k, y = oy + q.y * k, ranged = (u.def as { ranged?: boolean }).ranged, medic = u.kind === 'medic';
    const col = !on ? 0x5e5446 : ranged ? 0x9ec4d8 : medic ? 0x9bc6a1 : 0xd0a060;
    dg.fillStyle(col, on ? .95 : .6).lineStyle(1, 0x140e08, .8);
    if (ranged) dg.fillTriangle(x, y - 6, x - 5.5, y + 4.5, x + 5.5, y + 4.5); else if (medic) dg.fillCircle(x, y, 5).strokeCircle(x, y, 5); else dg.fillRect(x - 5, y - 5, 10, 10).strokeRect(x - 5, y - 5, 10, 10);
  }
  for (const q of fol) { const x = ox + q.x * k, y = oy + q.y * k; dg.fillStyle(0x7fd0c0, .95).fillPoints([{ x, y: y - 7 }, { x: x + 6, y }, { x, y: y + 7 }, { x: x - 6, y }] as Phaser.Types.Math.Vector2Like[], true); }
  // 主将：金色五角星，头上一道朝前的箭
  const star: Phaser.Types.Math.Vector2Like[] = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.8 : 11, a = -Math.PI / 2 + i * Math.PI / 5; star.push({ x: ox + Math.cos(a) * r, y: oy + Math.sin(a) * r }); }
  dg.fillStyle(0xf3d48a, 1).fillPoints(star, true);
  dg.lineStyle(1.6, 0xd9b46a, .7).lineBetween(ox, oy - 15, ox, oy - 27).lineBetween(ox, oy - 27, ox - 4, oy - 22).lineBetween(ox, oy - 27, ox + 4, oy - 22);
  const inN = pts.filter(q => q.on).length;
  T(cx, cy0 + 9, (sample ? '示意（尚无部曲）· ' : '') + `入阵 ${inN} / ${units.length} 人（8 + 2 × 统御 ${Math.floor(h.command)} = ${cap}）`, 12, '#d8c8a4').setOrigin(.5, 0).setName('formation-cap');
  T(cx, cy0 + ch - 20, '★ 主将（箭头朝前）  ◆ 随从  ■ 近战  ▲ 远程  ● 军医  灰 = 后军', 11, '#a8956c').setOrigin(.5, 0).setName('formation-legend');
}
