// 天下地图整理（2026-11-17 用户：「这里太乱了，ui要修改优化一下，和看到的地图太小了」）。
// 正式存档（打完第一章、讨董进行中）进天下地图，截 1280×720 / 1920×1080 / 1620×900；TAG=after 时检查新版式。
// 用法：BASE=http://127.0.0.1:5180/ TAG=after node tools/ui-round19-worldmap.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'after', out = 'assets/review/ui-round19', after = tag === 'after';
mkdirSync(out, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const M = "window.__game.scene.getScene('WorldMapScene')";
for (const [w, h] of [[1280, 720], [1920, 1080], [1620, 900]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(() => {
    window.__find = (root, name) => { const walk = o => { if (!o) return null; if (o.name === name) return o; for (const c of o.list ?? []) { const r = walk(c); if (r) return r; } return null; }; return walk(root); };
    if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); }
  });
  await p.goto(base + '?layout=desktop', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene') || window.__game?.scene.isActive('CityScene'), null, { timeout: 120000 });
  // 正式存档：第一章平定、讨董打到 2-2
  await p.evaluate(() => { const raw = localStorage.getItem('im_world_v1'); const s = raw ? JSON.parse(raw) : {}; Object.assign(s, { worldAvailable: true, yellowStages: 3, dongzhuoStages: 1, cleared: { ...(s.cleared ?? {}), huangjin: true }, chapterSeen: 99 }); localStorage.setItem('im_world_v1', JSON.stringify(s)); localStorage.setItem('im_chapter1_cleared', 'true'); });
  await p.evaluate(() => { const g = window.__game; g.scene.getScenes(true).forEach(sc => g.scene.stop(sc.sys.settings.key)); g.scene.start('WorldMapScene'); });
  await p.waitForFunction(M0 => { const s = eval(M0); return s?.sys.isActive() && s.layer; }, M, { timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${tag}-worldmap-${w}x${h}.png` });
  if (after) {
    const info = await p.evaluate(M0 => { const s = eval(M0), cam = s.cameras.main, H = cam.height / cam.zoom, W = cam.width / cam.zoom;
      const txt = s.children.list.filter(o => o.type === 'Text' && o.visible);
      const realm = window.__find(s.layer, 'world-realm-labels');
      return { W, H, area: s.area, viewBottom: s.viewBottom, frac: (s.viewBottom - s.area.y) / H, zoom: s.zoom, minZoom: s.minZoom,
        tabs: s.children.list.filter(o => /^chapter-chip-(title|status)-/.test(o.name ?? '') && o.visible).length, dots: s.children.list.filter(o => /^chapter-chip-[a-z]+$/.test(o.name ?? '')).length, timeline: !!s.children.getByName('chapter-timeline-slim'),
        fogLabels: s.layer.list.filter(o => /^fog-label-/.test(o.name ?? '')).length, legendBtn: s.children.getByName('world-factions')?.text, card: !!s.children.getByName('world-card'),
        overlaps: (() => { const bs = txt.filter(t => t.text && t.alpha > .3).map(t => ({ t: t.text.slice(0, 10), b: t.getBounds() })); let n = 0; const pairs = []; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].b, c = bs[j].b; const ix = Math.min(a.right, c.right) - Math.max(a.x, c.x), iy = Math.min(a.bottom, c.bottom) - Math.max(a.y, c.y); if (ix > 4 && iy > 4) { n++; pairs.push(bs[i].t + '×' + bs[j].t); } } return { n, pairs: pairs.slice(0, 6) }; })() }; }, M);
    ck(`${w}：地图占屏幕高度 ≥ 75%`, info.frac >= .75, { frac: info.frac, area: info.area, vb: info.viewBottom });
    ck(`${w}：默认放大（不是最小缩放）`, info.zoom > info.minZoom * 1.3, { zoom: info.zoom, min: info.minZoom });
    ck(`${w}：十二章页签行去掉（章名不再铺一排），换成细时间线（一章一个点）`, info.tabs === 0 && info.timeline && info.dots >= 12, { tabs: info.tabs, dots: info.dots });
    ck(`${w}：地图上不再有半透明大章名（纸雾上的「第X章 · 天下未定」）`, info.fogLabels === 0, info.fogLabels);
    ck(`${w}：势力图例收进「势力」按钮；右下角小卡`, /势力/.test(info.legendBtn ?? '') && info.card, info);
    ck(`${w}：屏幕层文字互不重叠`, info.overlaps.n === 0, info.overlaps);
    const act = await p.evaluate(M0 => { const s = eval(M0), g = n => s.children.getByName(n);
      g('chapter-chip-huangjin').emit('pointerup'); const t1 = s.detailTitle.text, st = g('chapter-chip-status-huangjin').text;
      // 2026-11-18：势力图例改左上角竖排，默认展开；点「势力」收起、再点展开
      const strip0 = s.children.getByName('world-faction-strip')?.visible; g('world-factions').emit('pointerup'); const stripOff = s.children.getByName('world-faction-strip')?.visible; g('world-factions').emit('pointerup'); const strip = strip0 && !stripOff && s.children.getByName('world-faction-strip')?.visible;
      g('world-era').emit('pointerup'); const legend = !!g('world-legend'), stripAfter = s.children.getByName('world-faction-strip')?.visible; g('world-era').emit('pointerup');
      g('world-card').emit('pointerover'); const tip = g('world-tip')?.list?.[1]?.text ?? ''; g('world-card').emit('pointerout');
      g('chapter-chip-hulao').emit('pointerover'); const chipTip = g('world-tip')?.list?.[1]?.text ?? ''; g('chapter-chip-hulao').emit('pointerout');
      g('chapter-chip-hulao').emit('pointerup');
      return { t1, st, strip, legend, stripAfter, tip, chipTip, action: s.action.text.text, actionOn: !!s.action.image.input?.enabled }; }, M);
    ck(`${w}：点时间线的章点选中该章；势力 / 年号面板互斥展开；小卡与章点悬停显示全文`, /黄巾/.test(act.t1) && /已平定/.test(act.st) && act.strip && act.legend && !act.stripAfter && /随军粮/.test(act.tip) && /讨伐董卓/.test(act.chipTip) && act.actionOn, act);
  }
  await p.close();
}
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 4));
process.exit(fail ? 1 : 0);
