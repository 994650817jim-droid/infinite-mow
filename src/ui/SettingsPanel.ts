import Phaser from 'phaser';
import { FONT, HEADING_FONT } from '../config';
import { lqHitBox, lqPanel, lqSkin, LQ } from './LacquerKit';

/**
 * 「军中设置」的设置区（2026-11-18 用户「这里设计ui也要优化」）：主页设置与战斗暂停设置共用。
 * - 分页签：声音 / 画面 / 战斗 / 剧情（桌面版另有「显示」）；一块漆底面板，行与行之间只用一道淡描金细线分隔（不再每行一个双层边框）。
 * - 控件：音量用滑条；开 / 关用漆金拨钮；多档选项用分段选择；只有分辨率这类长列表用 ‹ 值 ›。
 * - 每项都留一个名为 settings-<key> 的取值文字（current label，供读屏 / 测试），以及 settings-<key>-dec / -inc 两个步进钩子
 *   （键盘 / 手柄左右键与旧测试用）；行本身挂 padAdjust。改了立即写入存档并即时生效（各项的 set 由调用方给）。
 */
export interface SettingOption { v: string; label: string }
export interface SettingSpec {
  key: string; name: string; tab: string;
  kind: 'slider' | 'toggle' | 'choice' | 'stepper';
  /** choice / toggle：可选值（toggle 固定两项：开在前）；stepper：只用于显示，步进用 step。 */
  options?: SettingOption[];
  get: () => string;
  set: (v: string) => void;
  /** stepper：自定义步进（dir ±1）。 */
  step?: (dir: number) => void;
  /** 行下小注（如「刷新后生效」）。 */
  note?: () => string;
  /** slider：0–100，步进 5。 */
}
export interface SettingsPanelOpts {
  scene: Phaser.Scene; root: Phaser.GameObjects.Container;
  x: number; y: number; w: number; h: number;
  tabs: Array<{ id: string; label: string }>;
  settings: SettingSpec[];
  /** 页签记在本机（下次打开停在同一页）。 */
  memoryKey?: string;
  /** 战斗场景：所有对象 setScrollFactor(0)。 */
  fixed?: boolean;
  /** 不画外框（调用方已有面板）。 */
  bare?: boolean;
}
type SF = Phaser.GameObjects.GameObject & { setScrollFactor?: (n: number) => unknown };

export function buildSettingsPanel(o: SettingsPanelOpts): { setTab: (id: string) => void; tab: () => string; refresh: () => void } {
  const { scene: s, root } = o;
  const add = <T extends SF>(obj: T): T => { if (o.fixed) obj.setScrollFactor?.(0); root.add(obj); return obj; };
  const text = (x: number, y: number, v: string, size: number, color: string = LQ.cream, heading = false) => add(s.add.text(x, y, v, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2 }));
  if (!o.bare) { const g = add(s.add.graphics()); lqPanel(g, o.x, o.y, o.w, o.h, { shadow: false, glow: false }); }
  let cur = o.tabs[0].id;
  try { const v = o.memoryKey ? localStorage.getItem(o.memoryKey) : null; if (v && o.tabs.some(t => t.id === v)) cur = v; } catch { /* 存储不可用 */ }
  // —— 页签条 ——
  const tabY = o.y + 22, tabG = add(s.add.graphics()), tw = Math.min(110, (o.w - 32) / o.tabs.length), tx0 = o.x + 16;
  const tabTexts = o.tabs.map((t, i) => {
    const x = tx0 + i * tw + tw / 2, label = text(x, tabY, t.label, 15, LQ.cream, true).setOrigin(.5).setName('settings-tab-' + t.id).setInteractive({ useHandCursor: true });
    lqHitBox(label, tw - 6, 30); label.on('pointerdown', () => setTab(t.id)); label.setData('padAdjust', (d: number) => { const j = (o.tabs.findIndex(q => q.id === cur) + d + o.tabs.length) % o.tabs.length; setTab(o.tabs[j].id); });
    return label;
  });
  const paintTabs = () => {
    tabG.clear(); tabG.lineStyle(1, LQ.gold, .45).lineBetween(o.x + 12, tabY + 18, o.x + o.w - 12, tabY + 18);
    o.tabs.forEach((t, i) => {
      const x = tx0 + i * tw, on = t.id === cur;
      if (on) { tabG.fillStyle(LQ.lacquerHi, .95).fillRoundedRect(x + 3, tabY - 15, tw - 6, 33, { tl: 5, tr: 5, bl: 0, br: 0 }).lineStyle(1, LQ.goldHi, .9).strokeRoundedRect(x + 3, tabY - 15, tw - 6, 33, { tl: 5, tr: 5, bl: 0, br: 0 }); tabG.fillStyle(LQ.goldHi, 1).fillRect(x + tw / 2 - 12, tabY + 15, 24, 2); }
      tabTexts[i].setColor(on ? '#f6dc9a' : '#a8977a');
    });
  };
  // —— 各页的行 ——
  const rowsTop = tabY + 40, rowH = 44, ctrlR = o.x + o.w - 22, groups = new Map<string, Phaser.GameObjects.GameObject[]>();
  const refreshers: Array<() => void> = [];
  const byTab = new Map<string, SettingSpec[]>(); for (const sp of o.settings) { if (!byTab.has(sp.tab)) byTab.set(sp.tab, []); byTab.get(sp.tab)!.push(sp); }
  for (const t of o.tabs) {
    const list = byTab.get(t.id) ?? [], items: Phaser.GameObjects.GameObject[] = []; groups.set(t.id, items);
    const reg = <T extends SF>(obj: T): T => { add(obj); items.push(obj); return obj; };
    const rt = (x: number, y: number, v: string, size: number, color: string = LQ.cream, heading = false) => reg(s.add.text(x, y, v, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2 }));
    const lines = reg(s.add.graphics());
    list.forEach((sp, i) => {
      const y = rowsTop + i * rowH + rowH / 2;
      if (i > 0) lines.lineStyle(1, LQ.gold, .18).lineBetween(o.x + 18, y - rowH / 2, o.x + o.w - 18, y - rowH / 2);
      rt(o.x + 22, y, sp.name, 16, '#e8d8b2', true).setOrigin(0, .5).setName('settings-name-' + sp.key);
      const value = rt(0, 0, sp.get(), 1).setVisible(false).setName('settings-' + sp.key); // 当前取值（读屏 / 测试）
      const note = sp.note ? rt(o.x + 22, y + 15, '', 10, '#9d8f78').setOrigin(0, .5).setName('settings-note-' + sp.key) : null;
      const g = reg(s.add.graphics());
      let paint = (): void => { /* 各控件覆盖 */ };
      const apply = (v: string) => { sp.set(v); value.setText(labelOf(sp, sp.get())); paint(); note?.setText(sp.note?.() ?? ''); };
      const stepBy = (dir: number) => {
        if (sp.kind === 'slider') { const n = Phaser.Math.Clamp(Number(sp.get()) + dir * 10, 0, 100); apply(String(n)); }
        else if (sp.kind === 'stepper') { sp.step?.(dir); value.setText(sp.get()); paint(); note?.setText(sp.note?.() ?? ''); }
        else { const opts = sp.options ?? [], j = opts.findIndex(q => q.v === sp.get()); apply(opts[((j < 0 ? 0 : j) + dir + opts.length) % opts.length].v); }
      };
      // 步进钩子（键盘 / 手柄 / 测试）：不画，只收事件
      for (const dir of [-1, 1]) { const z = reg(s.add.zone(ctrlR - 40, y, 1, 1).setName(`settings-${sp.key}-${dir < 0 ? 'dec' : 'inc'}`)); z.on('pointerdown', () => stepBy(dir)); }
      const row = reg(s.add.zone(o.x + o.w / 2, y, o.w - 24, rowH).setName('settings-row-' + sp.key)); row.setData('padAdjust', (d: number) => stepBy(d));
      if (sp.kind === 'slider') {
        const tw2 = 210, x0 = ctrlR - 52 - tw2, pct = rt(ctrlR, y, '', 14, '#efd399', true).setOrigin(1, .5);
        paint = () => { const v = Number(sp.get()) / 100; g.clear(); g.fillStyle(0x0e0905, .9).fillRoundedRect(x0, y - 4, tw2, 8, 4).lineStyle(1, LQ.gold, .5).strokeRoundedRect(x0, y - 4, tw2, 8, 4); g.fillStyle(LQ.gold, .95).fillRoundedRect(x0, y - 4, Math.max(8, tw2 * v), 8, 4); g.fillStyle(LQ.lacquer, 1).fillCircle(x0 + tw2 * v, y, 9).lineStyle(2, LQ.goldHi, 1).strokeCircle(x0 + tw2 * v, y, 9); pct.setText(Math.round(v * 100) + '%'); };
        const hit = reg(s.add.zone(x0 + tw2 / 2, y, tw2 + 20, 28).setName('settings-slider-' + sp.key).setInteractive({ useHandCursor: true, draggable: false }));
        // 用命中区的本地坐标（战斗镜头有缩放时 pointer.x 与对象坐标对不上）
        const at = (lx: number) => apply(String(Math.round(Phaser.Math.Clamp((lx - 10) / tw2, 0, 1) * 20) * 5));
        hit.on('pointerdown', (_p: Phaser.Input.Pointer, lx: number) => at(lx)).on('pointermove', (p: Phaser.Input.Pointer, lx: number) => { if (p.isDown) at(lx); });
      } else if (sp.kind === 'toggle') {
        const pw = 66, ph = 26, cx = ctrlR - pw / 2, lab = rt(cx, y, '', 13, '#1b120b', true).setOrigin(.5);
        paint = () => { const on = sp.get() === (sp.options?.[0]?.v ?? 'on'); g.clear(); g.fillStyle(on ? 0x8e6a2e : 0x0e0905, .95).fillRoundedRect(cx - pw / 2, y - ph / 2, pw, ph, ph / 2).lineStyle(1, on ? LQ.goldHi : LQ.gold, on ? .95 : .55).strokeRoundedRect(cx - pw / 2, y - ph / 2, pw, ph, ph / 2);
          const kx = on ? cx + pw / 2 - ph / 2 : cx - pw / 2 + ph / 2; g.fillStyle(on ? LQ.goldHi : 0x5a4a35, 1).fillCircle(kx, y, ph / 2 - 3); lab.setText(on ? '开' : '关').setColor(on ? '#fff3d4' : '#a8977a').setX(on ? cx - 8 : cx + 8); };
        const hit = reg(s.add.zone(cx, y, pw + 8, ph + 8).setName('settings-toggle-' + sp.key).setInteractive({ useHandCursor: true })); hit.on('pointerdown', () => stepBy(1));
      } else if (sp.kind === 'choice') {
        const opts = sp.options ?? [], labels = opts.map(q => rt(0, y, q.label, 13, LQ.cream, true).setOrigin(.5)), widths = labels.map(t => Math.max(44, t.width + 22)), total = widths.reduce((a, b) => a + b, 0);
        let x = ctrlR - total; const segs = opts.map((q, j) => { const sx = x, w = widths[j]; x += w; labels[j].setX(sx + w / 2); const z = reg(s.add.zone(sx + w / 2, y, w, 28).setName(`settings-${sp.key}-opt-${q.v || 'auto'}`).setInteractive({ useHandCursor: true })); z.on('pointerdown', () => apply(q.v)); return { sx, w, v: q.v }; });
        paint = () => { const v = sp.get(); g.clear(); g.fillStyle(0x0e0905, .9).fillRoundedRect(ctrlR - total, y - 14, total, 28, 6).lineStyle(1, LQ.gold, .55).strokeRoundedRect(ctrlR - total, y - 14, total, 28, 6);
          segs.forEach((sg, j) => { const on = sg.v === v; if (on) g.fillStyle(0x8e6a2e, 1).fillRoundedRect(sg.sx + 2, y - 12, sg.w - 4, 24, 5).lineStyle(1, LQ.goldHi, .9).strokeRoundedRect(sg.sx + 2, y - 12, sg.w - 4, 24, 5); else if (j > 0) g.lineStyle(1, LQ.gold, .25).lineBetween(sg.sx, y - 9, sg.sx, y + 9); labels[j].setColor(on ? '#fff3d4' : '#a8977a'); }); };
      } else {
        const val = rt(ctrlR - 70, y, '', 15, '#efd399', true).setOrigin(.5);
        for (const dir of [-1, 1]) { const b = rt(ctrlR - 70 + dir * 60, y, dir < 0 ? '‹' : '›', 18, '#e8d3a6', true).setOrigin(.5).setInteractive({ useHandCursor: true }).setName(`settings-${sp.key}-btn-${dir < 0 ? 'dec' : 'inc'}`); b.on('pointerdown', () => stepBy(dir)); const sk = lqSkin(s, b, b, () => ({ w: 28, h: 26 }), { tone: 'quiet' }); lqHitBox(b, 28, 26); if (o.fixed) sk.gfx.setScrollFactor(0); root.add(sk.gfx); items.push(sk.gfx); root.bringToTop(b); }
        paint = () => { val.setText(sp.get()); };
      }
      value.setText(labelOf(sp, sp.get())); paint(); note?.setText(sp.note?.() ?? '');
      refreshers.push(() => { value.setText(labelOf(sp, sp.get())); paint(); note?.setText(sp.note?.() ?? ''); });
    });
  }
  const setTab = (id: string) => {
    cur = id; try { if (o.memoryKey) localStorage.setItem(o.memoryKey, id); } catch { /* 存储不可用 */ }
    for (const [k, items] of groups) for (const it of items) { const v = k === id; (it as unknown as Phaser.GameObjects.Components.Visible).setVisible?.(v); const inp = (it as unknown as { input?: { enabled: boolean } }).input; if (inp) inp.enabled = v; }
    paintTabs();
  };
  setTab(cur);
  return { setTab, tab: () => cur, refresh: () => refreshers.forEach(f => f()) };
}
function labelOf(sp: SettingSpec, v: string): string { if (sp.kind === 'slider') return v + '%'; return sp.options?.find(q => q.v === v)?.label ?? v; }
