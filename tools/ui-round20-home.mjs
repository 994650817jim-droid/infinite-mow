// 主页（2026-11-17 用户：「右上角天下地图和营寨可以不需要」「点匡扶汉室是进入大地图，然后玩家自行选择」）：
// 电脑版右上只留「成就」；天下已开时「匡扶汉室」直接进天下地图，地图「返回营寨」进营寨；新档仍是 主页 → 选主公 → 1-1。
// 用法：BASE=http://127.0.0.1:5180/ TAG=after node tools/ui-round20-home.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'after', out = 'assets/review/ui-round20', after = tag === 'after';
mkdirSync(out, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const world = { version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 1, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, provisions: 200, buildings: { barracks: 1, farm: 1 }, cities: {}, chapterSeen: 99 };
const roster = { version: 1, lord: 'zhaoyun', lordFinal: true, owned: [], followers: [] };
const page = async (w, h, seed) => {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(S => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_home_seen', '1');
    if (S) { localStorage.setItem('im_world_v1', S.world); localStorage.setItem('im_chapter1_cleared', 'true'); localStorage.setItem('im_roster_v1', S.roster); localStorage.setItem('im_last_hero', 'zhaoyun'); } }, seed);
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive() && window.__game.scene.getScene('MenuScene').startButton, null, { timeout: 120000 }); await p.waitForTimeout(1500);
  return p;
};
for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  const p = await page(w, h, { world: JSON.stringify(world), roster: JSON.stringify(roster) });
  await p.screenshot({ path: `${out}/${tag}-home-${w}x${h}.png` });
  const home = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); return { world: !!m.children.getByName('home-world'), city: !!m.children.getByName('home-city'), ach: !!m.children.getByName('home-achievements'), smallCity: m.children.list.some(o => o.type === 'Text' && o.visible && /^营寨/.test(o.text)) }; });
  if (after) ck(`${w}：主页右上只留「成就」（无天下地图 / 营寨）`, !home.world && !home.city && home.ach && !home.smallCity, home);
  await p.evaluate(() => window.__game.scene.getScene('MenuScene').startButton.emit('pointerdown'));
  await p.waitForFunction(() => window.__game.scene.getScene('WorldMapScene')?.sys.isActive(), null, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${tag}-start-${w}x${h}.png` });
  if (after) {
    const map = await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); return { on: !!s?.sys.isActive(), chapterSelect: !!window.__game.scene.getScene('MenuScene').children.getByName('chapter-select'), chips: s?.chips?.map(c => c.state) ?? [], back: s?.children.list.some(o => o.type === 'Text' && o.text === '返回营寨') }; });
    ck(`${w}：「匡扶汉室」→ 天下地图（不再打开择章页）；未到的章节锁住`, map.on && !map.chapterSelect && map.chips.filter(s => s !== 'locked').length === 3 && map.back, map);
    await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); const t = s.children.list.find(o => o.type === 'Text' && o.text === '返回营寨'); const img = s.children.list.find(o => o.type === 'Image' && o.input && Math.abs(o.x - t.x) < 2 && Math.abs(o.y - t.y) < 2); img?.emit('pointerdown'); img?.emit('pointerup'); });
    await p.waitForFunction(() => window.__game.scene.getScene('CityScene')?.sys.isActive(), null, { timeout: 20000 }).catch(() => {});
    ck(`${w}：天下地图「返回营寨」→ 营寨`, await p.evaluate(() => !!window.__game.scene.getScene('CityScene')?.sys.isActive()));
  }
  await p.close();
}
// 新档：主页 →（没选主公）选主公；选过主公、天下未开 →「匡扶汉室」直接 1-1
{ const p = await page(1280, 720, null);
  await p.evaluate(() => window.__game.scene.getScene('MenuScene').startButton.emit('pointerdown')); await p.waitForTimeout(800);
  const picker = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); return { picker: !!m.heroModal?.visible, scenes: window.__game.scene.getScenes(true).map(s => s.scene.key) }; });
  await p.screenshot({ path: `${out}/${tag}-newsave-picker-1280x720.png` });
  if (after) ck('新档（没有主公）点「匡扶汉室」先选主公，不进地图', picker.picker && !picker.scenes.includes('WorldMapScene'), picker);
  await p.evaluate(() => { localStorage.setItem('im_last_hero', 'zhaoyun'); const m = window.__game.scene.getScene('MenuScene'); m.heroModal?.setVisible(false); m.registry.set('heroConfirmed', true); m.startButton.emit('pointerdown'); });
  await p.waitForFunction(() => window.__game.scene.isActive('GameScene'), null, { timeout: 30000 }).catch(() => {});
  if (after) { const g = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { on: window.__game.scene.isActive('GameScene'), ch: s?.chapter?.id, st: s?.chapter?.stage }; });
    ck('选过主公、天下未开：「匡扶汉室」直接出征 1-1', g.on && g.ch === 'huangjin' && g.st === 1, g); }
  await p.close(); }
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 4));
process.exit(fail ? 1 : 0);
