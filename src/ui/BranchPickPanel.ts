import Phaser from 'phaser';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, IS_DESKTOP } from '../config';
import { BRANCH_FIT, type WeaponBranch } from '../data/weaponBranches';
import { SCHOOLS } from '../data/schools';
import { storyArtFile } from '../data/story/art';
import { lqButton, lqLabelColor, lqPanel, lqSheet, type LqState } from './LacquerKit';

/**
 * 兵器专职面板（2026-11-20 用户「可以按照你建议去开发」）：本命练到 Lv5 时单独弹出（暂停战斗），两条分支并排大卡、中间武将立绘；
 * 写清选定效果、Lv6 / Lv7 加深（第四 / 第八章开放）、进阶形态（Lv7 + 本派 4 势）名与效果；与当前流派契合的那条盖「契合」印（效果 ×BRANCH_FIT.fitMul）。
 * 漆金风格、没有水墨按钮；按 1 / 2 或点卡片 / 按钮选。选定后本次征程锁定（行营「重整构筑」花军粮可重选）。
 */
export interface BranchPanelOpts { hero: string; heroName: string; weaponName: string; branches: readonly WeaponBranch[]; fitId?: string; /** 每条专职下方的主修提示（GameScene.openBranch：占主修 / 不在主修没有契合）。 */ notes?: Readonly<Record<string, string>>; onPick: (b: WeaponBranch, i: number) => void }
export function openBranchPanel(scene: Phaser.Scene, o: BranchPanelOpts): Phaser.GameObjects.Container {
  const W = GAME_WIDTH, H = GAME_HEIGHT, pw = Math.min(W - 40, 860), ph = Math.min(H - 40, 470), x0 = (W - pw) / 2, y0 = (H - ph) / 2;
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay + 14).setName('branch-panel');
  const g = scene.add.graphics(); g.fillStyle(0x0c0805, .7).fillRect(0, 0, W, H); if (IS_DESKTOP) lqSheet(g, x0, y0, pw, ph); else lqPanel(g, x0, y0, pw, ph, { glow: true }); root.add(g);
  root.add(scene.add.rectangle(W / 2, H / 2, W, H, 0, .001).setInteractive()); // 挡住下面的点击
  const t = (x: number, y: number, v: string, size: number, color: string, heading = false, wrap = 0) => scene.add.text(x, y, v, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2, align: 'center', lineSpacing: 3, ...(wrap ? { wordWrap: { width: wrap, useAdvancedWrap: true } } : {}) }).setOrigin(.5, 0);
  root.add(t(W / 2, y0 + 18, '兵器专职 · 二选一', 28, '#f6dc9a', true).setName('branch-title'));
  root.add(t(W / 2, y0 + 56, `${o.heroName} · ${o.weaponName} 已练至 Lv.5　选定即锁定 · 需行营「重整构筑」才能更换（花军粮）`, 13, '#c9b88f'));
  // 中间武将立绘（水墨对白立绘，没载过就现载）
  const pk = 'ink_hero_' + o.hero, px = W / 2, py = y0 + 250;
  const place = () => { if (!root.active || !scene.textures.exists(pk)) return; const img = scene.add.image(px, py, pk).setScrollFactor(0).setAlpha(.95); const k = 230 / img.height; img.setScale(k).setName('branch-portrait'); root.addAt(img, 2); };
  if (scene.textures.exists(pk)) place(); else { const url = storyArtFile(pk); if (url) { scene.load.image(pk, url); scene.load.once(`filecomplete-image-${pk}`, place); scene.load.start(); } }
  // 两张大卡
  const cw = (pw - 200) / 2, ch = ph - 122, cy = y0 + 86; // 卡片下沿让出底部提示一行（原来提示正压在卡片下沿上）
  o.branches.slice(0, 2).forEach((b, i) => {
    const cx0 = i === 0 ? x0 + 22 : x0 + pw - 22 - cw, mid = cx0 + cw / 2, fit = b.id === o.fitId;
    const cg = scene.add.graphics(); cg.fillStyle(0x1d140c, .94).fillRoundedRect(cx0, cy, cw, ch, 8).lineStyle(fit ? 2.5 : 1.5, fit ? 0xf0c060 : 0x8c6f45, .95).strokeRoundedRect(cx0, cy, cw, ch, 8);
    const parts: Phaser.GameObjects.GameObject[] = [cg];
    if (scene.textures.exists(b.icon)) parts.push(scene.add.image(mid, cy + 46, b.icon).setDisplaySize(72, 72).setScrollFactor(0));
    parts.push(t(mid, cy + 88, b.name, 22, '#ffe2a0', true));
    parts.push(t(mid, cy + 118, SCHOOLS[b.school].name + '派', 13, '#b9a57a'));
    if (fit) { // 契合印（朱漆描金小牌）
      const sx = cx0 + cw - 58, sy = cy + 14, sg = scene.add.graphics(); sg.fillStyle(0x9a2a1a, 1).fillRoundedRect(sx, sy, 46, 24, 4).lineStyle(1.2, 0xf0c060, 1).strokeRoundedRect(sx + 1.5, sy + 1.5, 43, 21, 3);
      parts.push(sg, t(sx + 23, sy + 4, '契合', 13, '#ffe9bd', true).setName('branch-fit-' + i), t(mid, cy + 136, `与当前流派契合 · 专职效果 +${Math.round((BRANCH_FIT.fitMul - 1) * 100)}%`, 12, '#f0c060'));
    }
    // 说明四行：放不下（会压到「选定」按钮；2026-11-20 夜间 UI 审查，赵云「七进七出」那条就压住了）就依次缩字号 / 行距重排
    const by = cy + ch - 30, room = by - 20 - 6;
    for (const [ds, ls, gap] of [[14, 12, 8], [13, 12, 5], [13, 11, 4], [12, 11, 3]] as const) {
      let y = fit ? cy + 156 : cy + 142; const made: Phaser.GameObjects.Text[] = [];
      const line = (label: string, body: string, color: string, size: number) => { const tx = t(mid, y, (label ? label + '　' : '') + body.replace(/\n/g, '，'), size, color, false, cw - 22); made.push(tx); y += tx.height + gap; };
      { const nt = o.notes?.[b.id]; if (nt) line('主修', nt, /没有/.test(nt) ? '#d08a6a' : '#a8d08a', ls); } // 主修两派提示（GameScene.openBranch）
      line('', b.desc, '#f1e3c2', ds);
      line('Lv6（第四章开放）', b.lv6, '#c9b88f', ls);
      line('Lv7（第八章开放）', b.lv7, '#c9b88f', ls);
      line(`进阶形态「${b.finalName}」（Lv7 + 本派 4 势）`, b.finalDesc, '#f0c060', ls);
      if (y - gap <= room || ds === 12) { parts.push(...made); break; }
      for (const m of made) m.destroy();
    }
    // 选定按钮（漆底描金，不用水墨）
    const bw = 150, bh = 40, bgfx = scene.add.graphics(), cap = scene.add.text(mid, by, `选定（${i + 1}）`, { fontFamily: HEADING_FONT, fontSize: '18px', color: '#ffe9bd', resolution: 2 }).setOrigin(.5);
    const paint = (st: LqState) => { bgfx.clear(); const dd = lqButton(bgfx, mid, by, bw, bh, st, 'gold'); cap.setY(by + dd).setColor(lqLabelColor(st)); }; paint('idle');
    const hit = scene.add.rectangle(mid, cy + ch / 2, cw, ch, 0, .001).setInteractive({ useHandCursor: true }).setName('branch-card-' + i);
    hit.on('pointerover', () => paint('hover')).on('pointerout', () => paint('idle')).on('pointerdown', () => paint('down')).on('pointerup', () => o.onPick(b, i));
    parts.push(bgfx, cap, hit);
    root.add(parts.map(p => (p as unknown as { setScrollFactor?: (n: number) => unknown }).setScrollFactor ? ((p as unknown as { setScrollFactor: (n: number) => Phaser.GameObjects.GameObject }).setScrollFactor(0)) : p));
  });
  root.add(t(W / 2, y0 + ph - 28, '键盘 1 / 2 选择 · 两条都能选，契合当前流派的那条效果更强', 12, '#8f8068'));
  // 不做淡入：面板开着时战斗暂停，补间也停（淡入会卡在透明）
  return root;
}
