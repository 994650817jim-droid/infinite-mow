// 正式模式战斗缴获的兵装要入行囊（2026-11-21 总制作人报：正式模式打下许昌「缴获兵装 6 件 · 测试战斗不入行囊」全丢了）。
// ① node 断言（不开浏览器）：GameScene 兵装入行囊三处（战后缴获 / 行营购买 / 行囊界面）都走 lootBlocked()，lootBlocked 只看 debugRun() 与 encounterPreview，不再看 runConfig.encounter；
//    列出带 encounter:'qunxiong' 的场景（受影响范围）。
// ② 浏览器（正式模式，不开 dev）：天下地图「告急 → 亲征 · 守城 → 出征守城」进守城（SiegeGameScene，runConfig 带 encounter），放一件缴获进 runLoot、打赢——
//    结算写「已收入行囊」、行囊多了这件；③ 无报错。用法：BASE=http://127.0.0.1:5187/ node tools/test-loot-formal.mjs [--node-only]
import { readFileSync, readdirSync } from 'node:fs';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
// ① node 断言
const gs = readFileSync('src/scenes/GameScene.ts', 'utf8');
const lb = gs.match(/protected lootBlocked\(\): boolean \{([^}]*)\}/);
ck('lootBlocked 只看 debugRun() 与 encounterPreview', !!lb && /this\.debugRun\(\)/.test(lb[1]) && /this\.encounterPreview/.test(lb[1]) && !/encounter\b(?!Preview)/.test(lb[1].replace(/encounterPreview/g, '')), lb?.[1]);
const sites = [/depositRunLoot\(/, /onBuyItem=/, /new ItemBagUI\(this,/];
for (const re of sites) { const i = gs.search(re); const win = gs.slice(Math.max(0, i - 400), i + 200); ck('兵装入行囊判断走 lootBlocked（' + re.source + '）', i >= 0 && /lootBlocked\(\)/.test(win) && !/runConfig\.encounter/.test(win.slice(win.lastIndexOf('lootBlocked') - 200)), null); }
const affected = readdirSync('src/scenes').filter(f => /\.ts$/.test(f) && /encounter:\s*'qunxiong'/.test(readFileSync('src/scenes/' + f, 'utf8')));
console.log('受影响（runConfig 带 encounter:qunxiong）：' + affected.join('、'));
if (process.argv.includes('--node-only')) { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
// ② 浏览器（正式模式）
const { chromium } = await import('playwright');
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const save = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 300, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: ['guandu', 'chenliu'], eraSeen: 1, capturedEver: ['guandu', 'chenliu'], chapterSeen: 3, tutorialDone: true, alerts: [{ city: 'chenliu', attacker: 'caocao', cause: 'retaliate' }] };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Texture key already in use|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160)); });
await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_opening_seen', '1'); sessionStorage.setItem('seeded', '1'); } }, save);
await p.goto(base + '?layout=desktop', { timeout: 180000 }); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('WorldMapScene'); });
await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'), null, { timeout: 60000 }); await p.waitForTimeout(1500);
await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'), mk = s.cityMarkers.find(x => x.city.id === 'chenliu'); mk.hit.emit('pointerup', { getDistance: () => 0 }); });
await p.waitForTimeout(300); await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').action.image.emit('pointerup')); await p.waitForTimeout(500);
await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').children.getByName('siege-modal')?.getByName?.('siege-go')?.emit('pointerup'));
await p.waitForFunction(() => { const s = window.__game.scene.getScene('SiegeGameScene'); return s?.player && window.__game.scene.isActive('SiegeGameScene') && s.elapsed < 5; }, null, { timeout: 120000 }); await p.waitForTimeout(1500); /* 守城重做后开打前可能停在布防面板（elapsed 还是 0），同 test-defense 的等法 */
const pre = await p.evaluate(async () => { const s = window.__game.scene.getScene('SiegeGameScene'), I = await import('/src/systems/ItemStore.ts'), D = await import('/src/data/items.ts');
  const item = D.rollItem('blue'); s.itemDrops.runLoot.push(item); window.__lootId = item.uid ?? item.id ?? JSON.stringify(item).slice(0, 60);
  return { encounter: s.runConfig.encounter ?? null, preview: s.encounterPreview, debugRun: s.debugRun(), blocked: s.lootBlocked(), bag: I.loadItems().bag.length }; });
ck('正式模式守城：runConfig 带 encounter、但不是预览 / 测试战斗（lootBlocked = false）', pre.encounter === 'qunxiong' && !pre.preview && !pre.debugRun && !pre.blocked, pre);
await p.evaluate(() => { const s = window.__game.scene.getScene('SiegeGameScene'); s.bossKilled = true; s.finish(true, 'boss'); }); await p.waitForTimeout(1500);
const post = await p.evaluate(async () => { const s = window.__game.scene.getScene('SiegeGameScene'), I = await import('/src/systems/ItemStore.ts'); const line = s.resultTexts.body.text.split('\n').find(l => /缴获兵装/.test(l)) ?? null; return { line, bag: I.loadItems().bag.length }; });
ck('结算写「已收入行囊」（不再「测试战斗不入行囊」）', /已收入行囊/.test(post.line ?? '') && !/测试战斗/.test(post.line ?? ''), post);
ck('行囊多了这件缴获', post.bag === pre.bag + 1, { before: pre.bag, after: post.bag });
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
