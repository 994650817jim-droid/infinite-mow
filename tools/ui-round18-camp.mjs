// 行营休整 / 军需商人按钮（2026-11-17 用户：「这个行囊按钮改一下」）：行囊换水墨笔触 + 行囊图标，回营寨 / 页签同换；商人页底部说明不再被切。
// 用法：BASE=http://127.0.0.1:5180/ TAG=after node tools/ui-round18-camp.mjs   （TAG=before 只截图）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'after', out = 'assets/review/ui-round18', after = tag === 'after';
mkdirSync(out, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(() => { window.__find = (root, name) => { const walk = o => { if (!o) return null; if (o.name === name) return o; for (const c of o.list ?? []) { const r = walk(c); if (r) return r; } return null; }; return walk(root); }; });
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 }); await p.waitForTimeout(800);
  // 打赢 1-1 进行营（walkthrough 同法：直接结算胜利）
  await p.evaluate(G0 => { const s = eval(G0); s.bossKilled = true; s.finish(true, 'boss'); }, G);
  await p.waitForFunction(G0 => { const s = eval(G0); return s.mode === 'rest' && s.campUI?.root.visible && !s.children.getByName('rest-intro'); }, G, { timeout: 60000 });
  await p.waitForTimeout(600); await p.evaluate(G0 => { const s = eval(G0); s.children.getByName('rest-summary')?.emit('pointerdown'); s.campUI.onReturnHome ??= () => {}; s.campUI.open(s.campUI['visit'] || 'huangjin-1', '下曲阳破阵'); }, G);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/${tag}-camp-recruit-${w}x${h}.png` });
  await p.evaluate(G0 => eval(G0).campUI.root.list.find(o => o.name === 'camp-tab-2').emit('pointerdown'), G); await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${tag}-camp-merchant-${w}x${h}.png` });
  if (after) {
    const info = await p.evaluate(G0 => { const s = eval(G0), r = s.campUI.root, cam = s.cameras.main; const bag = r.list.find(o => o.name === 'camp-bag'), home = r.list.find(o => o.name === 'camp-home');
      const det = s.campUI['detail'], db = det.getBounds(); const ns = r.list.filter(o => o.type === 'NineSlice').length;
      return { bagType: bag?.type, bagBg: bag?.style?.backgroundColor ?? null, icon: r.list.some(o => o.texture?.key === 'bag_tab_icon_all' && o.visible), home: home?.text, homeBg: home?.style?.backgroundColor, inkPlates: ns, det: { x: db.x, right: db.right, W: cam.width / cam.zoom, text: det.text, lines: det.getWrappedText().length, shown: r.getIndex(det) >= 0 && det.visible } }; }, G);
    ck(`${w}：行囊是水墨笔触按钮 + 行囊图标（不再是红色方块）`, info.bagType === 'Rectangle' && info.icon && info.inkPlates >= 5, info);
    ck(`${w}：回营寨也换水墨底（无方块底色）`, info.home === '回营寨' && /rgba\(0, ?0, ?0, ?0\)/.test(info.homeBg ?? ''), info.homeBg);
    ck(`${w}：军需商人页说明完整显示（左右都在画面内、末尾「收入行囊。」可见）`, info.det.shown && info.det.x >= 0 && info.det.right <= info.det.W && /收入行囊。$/.test(info.det.text), info.det);
    // 点「行囊」能打开
    await p.evaluate(G0 => eval(G0).campUI.root.list.find(o => o.name === 'camp-bag').emit('pointerdown'), G); await p.waitForTimeout(400);
    ck(`${w}：点行囊打开背包`, await p.evaluate(G0 => !!eval(G0).children.getByName('item-bag'), G));
    await p.evaluate(G0 => eval(G0).children.getByName('item-bag')?.destroy(), G);
    // 回营寨：第一次点变成确认（朱墨主按钮），文字变长后底板跟着变宽
    const arm = await p.evaluate(G0 => { const s = eval(G0), r = s.campUI.root, home = r.list.find(o => o.name === 'camp-home'); const before = s.campUI['homePlate']?.displayWidth ?? 0; home.emit('pointerdown'); return { text: home.text, before, after: s.campUI['homePlate']?.displayWidth ?? 0, key: s.campUI['homePlate']?.texture.key }; }, G);
    ck(`${w}：回营寨点一次变确认，墨迹底变宽并换朱墨`, /确认回营寨/.test(arm.text) && arm.after > arm.before && /primary/.test(arm.key ?? ''), arm);
    await p.screenshot({ path: `${out}/${tag}-camp-home-armed-${w}x${h}.png` });
  }
  await p.close();
}
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 4));
process.exit(fail ? 1 : 0);
