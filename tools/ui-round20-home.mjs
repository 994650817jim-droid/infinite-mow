// 主页右上入口精简（2026-11-17 用户：「右上角天下地图和营寨可以不需要」）：电脑版右上只留「成就」；
// 天下已开的存档在「择章」页右上有「营寨」入口，营寨里「天下地图 · 出征」到地图，地图有「返回营寨」。
// 用法：BASE=http://127.0.0.1:5180/ TAG=after node tools/ui-round20-home.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'after', out = 'assets/review/ui-round20', after = tag === 'after';
mkdirSync(out, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const world = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 1, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 200, buildings: { barracks: 1, farm: 1 }, cities: {}, reserve: {}, receipts: [], chapterSeen: 99 };
for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(W0 => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', W0); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(world));
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive(), null, { timeout: 120000 }); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${tag}-home-${w}x${h}.png` });
  const home = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); return { world: !!m.children.getByName('home-world'), city: !!m.children.getByName('home-city'), ach: !!m.children.getByName('home-achievements'), smallCity: m.children.list.some(o => o.type === 'Text' && o.visible && /^营寨/.test(o.text)) }; });
  if (after) ck(`${w}：主页右上只留「成就」（无天下地图 / 营寨）`, !home.world && !home.city && home.ach && !home.smallCity, home);
  await p.evaluate(() => window.__game.scene.getScene('MenuScene').openChapters()); await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/${tag}-chapters-${w}x${h}.png` });
  if (after) {
    const has = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); const f = r => { for (const o of r.list ?? []) { if (o.name === 'chapter-select-city') return o; const x = f(o); if (x) return x; } return null; }; const o = f(m.children); o?.emit('pointerdown'); return !!o; });
    await p.waitForTimeout(1500);
    const city = await p.evaluate(() => window.__game.scene.getScene('CityScene')?.sys.isActive());
    ck(`${w}：择章页「营寨」→ 营寨`, has && city, { has, city });
    await p.evaluate(() => window.__game.scene.getScene('CityScene').children.getByName('city-map')?.emit('pointerdown')); await p.waitForTimeout(1800);
    const map = await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); return { on: s?.sys.isActive(), back: s?.children.list.some(o => o.type === 'Text' && o.text === '返回营寨') }; });
    ck(`${w}：营寨「天下地图 · 出征」→ 天下地图，地图上有「返回营寨」`, map.on && map.back, map);
  }
  await p.close();
}
// 新存档（天下未开）：择章页不显示「营寨」
{ const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive(), null, { timeout: 120000 }); await p.waitForTimeout(1000);
  if (after) { const r = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); m.openChapters(); const f = r => { for (const o of r.list ?? []) { if (o.name === 'chapter-select-city') return true; if (f(o)) return true; } return false; }; return f(m.children); });
    ck('新存档（天下未开）择章页不显示「营寨」', !r, r); }
  await p.close(); }
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 4));
process.exit(fail ? 1 : 0);
