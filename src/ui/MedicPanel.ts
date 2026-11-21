/**
 * 营寨 / 城池的军医面板（2026-11-19 用户「军医再营寨城市也有」）：与行营休整的军医同一个立绘（MEDIC_FIGURE，站在帐中、不加框）、
 * 同三档治疗（小治 / 大治 / 为全军疗伤）、同一套价格（data/campMedic，章节取天下进度）。付账走钱包（营寨军粮）。
 * 治的是当前武将存档点里的伤（town/CampMedic），下次出征带上。对象名：medic-panel（根）、medic-small / medic-full / medic-army、medic-close、medic-hp。
 */
import Phaser from 'phaser';
import { FONT, HEADING_FONT } from '../config';
import { CAMP_MEDIC, type MedicKind } from '../data/campMedic';
import { CHARACTERS } from '../data/characters';
import { uiSfx } from '../systems/Sfx';
import { outHeal, outMedicState, type MedicWallet } from '../town/CampMedic';
import { drawCampFigure, MEDIC_FIGURE } from './CampFigure';
import { LQ, lqCommand, lqPanel, lqSheet } from './LacquerKit';

export function openMedicPanel(scene: Phaser.Scene, opts: { wallet: MedicWallet; depth?: number; onClose?: () => void }): () => void {
  const W = scene.scale.width, H = scene.scale.height, D = W > 600, depth = opts.depth ?? 600;
  scene.children.getByName('medic-panel')?.destroy();
  const root = scene.add.container(0, 0).setDepth(depth).setName('medic-panel');
  let hero = 'zhaoyun'; try { hero = localStorage.getItem('im_last_hero') || hero; } catch { /* 存储不可用 */ }
  const heroName = CHARACTERS.find(c => c.id === hero)?.name ?? '主将';
  let notice = '', closed = false;
  const close = () => { if (closed) return; closed = true; scene.input.keyboard?.off('keydown-ESC', close); root.destroy(); opts.onClose?.(); };
  const txt = (x: number, y: number, v: string, size: number, color: string, heading = false) => { const t = scene.add.text(x, y, v, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2 }); body.add(t); return t; };
  const body = scene.add.container(0, 0); root.add([scene.add.rectangle(0, 0, W, H, 0x0b0805, .82).setOrigin(0).setInteractive(), body]);
  const draw = () => {
    if (closed) return; body.removeAll(true);
    const pw = D ? Math.min(820, W - 40) : W - 24, ph = D ? 430 : 700, px = (W - pw) / 2, py = (H - ph) / 2, g = scene.add.graphics(); if (D) lqSheet(g, px, py, pw, ph); else lqPanel(g, px, py, pw, ph, { shadow: true }); body.add(g);
    const st = outMedicState(hero), food = opts.wallet.get();
    txt(W / 2, py + 28, '军医', D ? 24 : 26, LQ.title, true).setOrigin(.5);
    txt(px + pw - 22, py + 28, opts.wallet.name + ' ' + food, 15, '#f3d48a').setOrigin(1, .5).setName('medic-purse');
    // 左：军医立绘（同行营，站在帐中不加框）
    const left = D ? px + 230 : px + 20;
    if (D) drawCampFigure(scene, body, MEDIC_FIGURE, { cx: px + 120, bottom: py + ph - 70, height: 300 }, () => draw());
    const x0 = left, w0 = px + pw - 24 - left, y0 = py + 62;
    const plate = (x: number, y: number, w: number, h: number) => { const p = scene.add.graphics(); p.fillStyle(0x120c07, .85).fillRoundedRect(x, y, w, h, 6).lineStyle(1.5, LQ.gold, .5).strokeRoundedRect(x, y, w, h, 6); body.add(p); };
    plate(x0, y0, w0, 84);
    txt(x0 + 16, y0 + 10, '主将 ' + heroName, 17, '#f1ddb5', true);
    txt(x0 + w0 - 16, y0 + 12, st.has ? '生命 ' + Math.round(st.hp * 100) + '%' : '未出征', 16, st.hale ? '#cfe3b0' : '#f0b090').setOrigin(1, 0).setName('medic-hp');
    const bw = w0 - 32; body.add(scene.add.rectangle(x0 + 16, y0 + 40, bw, 8, 0x1a120b, .9).setOrigin(0)); body.add(scene.add.rectangle(x0 + 16, y0 + 40, Math.max(2, bw * st.hp), 8, st.hale ? 0x7f9a52 : 0xa8442c, 1).setOrigin(0));
    txt(x0 + 16, y0 + 56, '部曲伤兵 ' + st.soldiersHurt + ' 人 · 随行带伤 ' + st.followersHurt + ' 人', 13, '#c9b38a');
    const rows: Array<[MedicKind, string, string]> = [['small', CAMP_MEDIC.small.name, CAMP_MEDIC.small.desc], ['full', CAMP_MEDIC.full.name, CAMP_MEDIC.full.desc], ['army', CAMP_MEDIC.army.name, CAMP_MEDIC.army.desc]];
    rows.forEach(([kind, title, desc], i) => {
      const y = y0 + 96 + i * 56, h = 50; plate(x0, y, w0, h);
      txt(x0 + 16, y + 6, title, 16, '#ecd6a8', true); txt(x0 + 16, y + 28, desc, 13, '#bba886');
      const price = st.price[kind], hale = !st.has || (kind === 'army' ? st.armyHale : st.hale), can = !hale && food >= price;
      const label = !st.has ? '无伤可治' : hale ? (kind === 'army' ? '全军无恙' : '将军无恙') : food < price ? opts.wallet.name + '不足 · ' + price : '治疗 · ' + price + ' ' + opts.wallet.name;
      const b = lqCommand(scene, x0 + w0 - 98, y + h / 2, 176, 38, label, can, can, 14); b.hit.setName('medic-' + kind).setData('price', price);
      b.hit.on('pointerdown', () => { if (!outHeal(hero, kind, opts.wallet)) return; uiSfx().play('purchase'); notice = kind === 'army' ? '军医为全军疗伤 · 部曲与随行伤兵皆已痊愈（下次出征生效）' : '军医施治 · 主将生命 ' + Math.round(outMedicState(hero).hp * 100) + '%（下次出征生效）'; draw(); });
      body.add([b.g, b.hit, b.caption]);
    });
    txt(W / 2, py + ph - 76, notice || (st.has ? '治的是存档点里的伤，下次出征带上；价格随章节递增（第 ' + st.chapter + ' 章）。' : '还没有征程——出征打赢一关后，带回的伤可在这里医治（第 ' + st.chapter + ' 章价）。'), 13, notice ? '#f3d48a' : '#cdbb94').setOrigin(.5, 0).setWordWrapWidth(pw - 60, true).setAlign('center').setName('medic-notice');
    const c = lqCommand(scene, W / 2, py + ph - 30, 160, 40, '返回', false, true, 15); c.hit.setName('medic-close').on('pointerdown', close); body.add([c.g, c.hit, c.caption]);
  };
  draw(); scene.input.keyboard?.on('keydown-ESC', close); scene.events.once('shutdown', close);
  return close;
}
