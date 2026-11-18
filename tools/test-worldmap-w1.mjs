// 天下地图 W1：城池数据（30 城三档、连通、相邻）、三个时代归属、存档 v6→v7 迁移、地图渲染（标记、染色、年号、图例、选中相邻）、
// 城市信息卡、战役节点仍可进入章节。需要开发服务器 5173。用法：node tools/test-worldmap-w1.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/worldmap-w1';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const mk = (w, g, v = 7) => ({ version: v, yellowStages: 3, dongzhuoStages: 3, warlordStages: w, guanduStages: g, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 420, provisions: 860, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu'] });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const open = async (save, layout) => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
  await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(500);
  return p;
};
// —— 数据层 ——
{
  const p = await open(mk(0, 0, 6), 'mobile');
  const d = await p.evaluate(async () => {
    const C = await import('/src/world/WorldCities.ts'), w = await import('/src/world/WorldStore.ts'), s = w.loadWorld(), L = C.CITY_LINKS;
    const seen = new Set(['home']), q = ['home']; while (q.length) { const n = q.shift(); for (const m of L.get(n)) if (!seen.has(m)) { seen.add(m); q.push(m); } }
    const tiers = {}; for (const c of C.CITIES) tiers[c.tier] = (tiers[c.tier] ?? 0) + 1;
    const owners = C.ERAS.map(e => C.CITIES.every(c => !!e.owners[c.id] && !!C.FACTIONS[e.owners[c.id]]));
    const diff = C.CITIES.filter(c => C.ERAS[0].owners[c.id] !== C.ERAS[2].owners[c.id]).length;
    return { version: s.version, owned: s.ownedCities, eraSeen: s.eraSeen, merits: s.merits, count: C.CITIES.length, tiers, connected: seen.size === C.CITIES.length + 1, uniqueIds: new Set(C.CITIES.map(c => c.id)).size === C.CITIES.length, owners, diff,
      start: C.CITIES.filter(c => C.cityAttackable(c.id, [])).map(c => c.id).sort(), afterXuchang: C.cityAttackable('luoyang', ['xuchang']) && !C.cityAttackable('xuchang', ['xuchang']),
      eras: [C.eraIndexFor({ hulaoCleared: true, warlordStages: 0, guanduStages: 0 }), C.eraIndexFor({ hulaoCleared: true, warlordStages: 3, guanduStages: 0 }), C.eraIndexFor({ hulaoCleared: true, warlordStages: 3, guanduStages: 3 })],
      inMap: C.CITIES.every(c => c.x > 0 && c.x < C.MAP_W && c.y > 0 && c.y < C.MAP_H) };
  });
  // 2026-11-17：v6→v7 旧档迁移检查删掉（开发期不做旧档兼容；军功已并入军粮）
  ck('31 座城：大 7 / 中 12 / 小 12，id 唯一，坐标在图内（2026-11-17 现数据）', d.count === 31 && d.tiers.large === 7 && d.tiers.medium === 12 && d.tiers.small === 12 && d.uniqueIds && d.inMap, d.tiers);
  ck('道路网络连通（含营寨）', d.connected);
  ck('三个时代每城都有有效归属，且版图有变化', d.owners.every(Boolean) && d.diff >= 8, { owners: d.owners, diff: d.diff });
  ck('起始可攻：营寨相邻的许昌、汝南、官渡', d.start.join() === 'guandu,runan,xuchang', d.start);
  ck('占许昌后洛阳可攻、许昌不可再攻', d.afterXuchang);
  ck('时代：讨董后一、群雄后二、官渡后三', d.eras.join() === '1,2,3', d.eras);
  await p.close();
}
// —— 渲染与交互 ——
const S = "window.__game.scene.getScene('WorldMapScene')";
// 2026-11-17：用户要求 UI 先做电脑布局（手机以后再说），渲染检查只跑 desktop
for (const layout of ['desktop']) for (const [era, save] of [[1, mk(0, 0)], [2, mk(3, 0)], [3, mk(3, 3)]]) {
  const p = await open(save, layout);
  const r = await p.evaluate(S0 => { const s = eval(S0); s.setZoom(s.minZoom, s.area.x + s.area.w / 2, s.area.y + s.area.h / 2); /* 2026-11-18：电脑版默认在州郡档，可见城数按全国档量 */ const tex = s.layer.list.map(o => o.texture?.key).filter(Boolean); return { markers: s.cityMarkers.length, era: s.children.getByName('world-era')?.text, territory: tex.some(k => k.startsWith('world_territory_')), visible: s.cityMarkers.filter(m => m.root.visible).length }; }, S);
  ck(`${layout} 时代${era}：31 个城池标记、年号（领地染色已随地图改版去掉）`, r.markers === 31 && r.era?.includes(['', '公元191年', '公元198年', '公元201年'][era]) && r.visible >= 10, r);
  if (era !== 2) { await p.screenshot({ path: `${out}/${layout}-era${era}.png` }); await p.close(); continue; }
  const sel = await p.evaluate(S0 => { const s = eval(S0); const m = s.cityMarkers.find(m => m.city.id === 'xuchang'); m.hit.emit('pointerup', { getDistance: () => 0 }); return { detail: s.detailTitle.text + ' ' + s.detail.text, action: s.action.text.text, links: s.links.commandBuffer.length > 0, label: m.label.visible }; }, S);
  ck(`${layout} 点许昌：信息卡（中城·豫州·曹操·可攻打·相邻）与相邻道路`, sel.detail.includes('许昌 · 中城 · 豫州') && sel.detail.includes('归属：曹操') && sel.detail.includes('可以攻打') && sel.detail.includes('义军营寨') && sel.action === '亲征 · 攻城' && sel.links && sel.label, sel);
  const far = await p.evaluate(S0 => { const s = eval(S0); s.cityMarkers.find(m => m.city.id === 'ye').hit.emit('pointerup', { getDistance: () => 0 }); return { detail: s.detailTitle.text + ' ' + s.detail.text, action: s.action.text.text }; }, S);
  ck(`${layout} 点邺城：大城·袁绍·尚不相邻`, far.detail.includes('邺城 · 大城') && far.detail.includes('袁绍') && (far.detail.includes('尚不相邻') || far.detail.includes('后开放攻城')) && (far.action === '尚不可攻打' || far.action.endsWith('后开放攻城')), far);
  const legend = await p.evaluate(S0 => { const s = eval(S0); s.children.getByName('world-era').emit('pointerup'); const l = s.children.getByName('world-legend'); const box = l?.list[0]; return { shown: !!l, texts: l?.list.filter(o => o.type === 'Text').map(o => o.text), right: l ? l.x + box.width : 0, zoomLeft: s.scale.width }; }, S);
  ck(`${layout} 年号点开势力图例（曹操 12、袁绍 9、时代概述），不遮缩放按钮`, legend.shown && legend.texts.includes('曹操 12') && legend.texts.includes('袁绍 9') && legend.texts.some(t => t.includes('迎天子')) && legend.right <= (layout === 'mobile' ? 540 : 960) - 79, { texts: legend.texts, right: legend.right });
  await p.screenshot({ path: `${out}/${layout}-era2-legend.png` });
  const small = await p.evaluate(S0 => { const s = eval(S0); s.children.getByName('world-era').emit('pointerup'); s.selected = { kind: 'node', node: s.markers[0].node }; s.refresh(); s.setZoom(s.minZoom, s.area.x + s.area.w / 2, s.area.y + s.area.h / 2); const before = s.cityMarkers.filter(m => m.city.tier === 'small' && m.label.visible).length; s.setZoom(s.minZoom * 2.4, s.area.x + s.area.w / 2, s.area.y + s.area.h / 2); const after = s.cityMarkers.filter(m => m.city.tier === 'small' && m.root.visible && m.label.visible).length; return { before, after }; }, S);
  ck(`${layout} 小城名默认隐藏、放大后显示`, small.before === 0 && small.after > 0, small);
  await p.screenshot({ path: `${out}/${layout}-era2-zoom.png` });
  const node = await p.evaluate(async S0 => { const s = eval(S0), { WORLD_NODES } = await import('/src/world/WorldNodes.ts'); s.selected = { kind: 'node', node: WORLD_NODES.find(n => n.id === 'qunxiong') }; s.refresh(); return s.action.text.text; }, S);
  ck(`${layout} 战役节点仍可出征`, node === '出征' || node === '重温 · 出征', node);
  await p.evaluate(S0 => eval(S0).enterNode(), S); await p.waitForFunction(() => window.__game.scene.isActive('ThirdChapterScene'), null, { timeout: 15000 });
  ck(`${layout} 进入第三章选关`, true);
  await p.close();
}
ck('无 pageerror', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
