// 天下地图 UI 截图 + 回归：node tools/test-worldmap-ui.mjs <before|after>（需 dev server 5173）。输出 assets/review/worldmap-ui/。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const tag = process.argv[2] ?? 'after', base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/worldmap-ui';
mkdirSync(out, { recursive: true });
const save = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 525, provisions: 1026, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu'], ownedCities: ['xuchang', 'runan', 'guandu'], eraSeen: 2, capturedEver: [], alerts: [{ city: 'guandu', attacker: 'caocao', cause: 'era' }], lastLost: [] };
const b = await chromium.launch({ channel: 'chrome', headless: true }); const errors = []; let fail = 0;
const check = (n, ok, d) => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, d ? JSON.stringify(d) : ''); };
try {
  for (const layout of ['mobile', 'desktop']) {
    const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
    p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.addInitScript(sv => { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); }, save);
    await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 30000 });
    await p.evaluate(() => window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene')); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'));
    await p.waitForTimeout(900);
    // 关掉时局变化提示（若有）
    await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); const ok = s.children.getByName('era-modal')?.getByName?.('era-ok'); if (ok) { ok.emit('pointerup'); } });
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${out}/${tag}-${layout}-default.png` });
    // 选中洛阳
    await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); s.selected = { kind: 'city', city: s.cityMarkers.find(m => m.city.id === 'luoyang').city }; s.refresh(); });
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${out}/${tag}-${layout}-city.png` });
    check(`${layout} action button exists`, await p.evaluate(() => !!window.__game.scene.getScene('WorldMapScene').children.getByName('map-action')));
    // 放大到中原
    await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); s.setZoom(s.zoom * 1.8, s.area.x + s.area.w / 2, s.area.y + s.area.h / 2); });
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${out}/${tag}-${layout}-zoom.png` });
    check(`${layout} zoom changes`, await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); return s.zoom > s.minZoom * 1.3; }));
    // 势力图例与领地面板可开关
    await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').children.getByName('world-era').emit('pointerup'));
    await p.waitForTimeout(150);
    check(`${layout} legend toggles`, await p.evaluate(() => !!window.__game.scene.getScene('WorldMapScene').children.getByName('world-legend')));
    await p.screenshot({ path: `${out}/${tag}-${layout}-legend.png` });
    await p.close();
  }
} finally { await b.close(); }
check('no console/page errors', errors.length === 0, errors.slice(0, 5));
process.exit(fail ? 1 : 0);
