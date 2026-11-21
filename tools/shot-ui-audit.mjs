// 全界面体检（2026-11-21 总制作人：「让 ui 检查哪里还可以优化，哪里有问题」）：电脑布局逐屏截图，正式存档 + dev 入口摆状态。
// 用法：BASE=http://127.0.0.1:5180/ TAG=r9 node tools/shot-ui-audit.mjs [battle rest result city siege sizes]
// 输出 assets/review/ui-audit/<TAG>/a-<屏>-<宽>.png；每组开新页，出错只跳过该屏。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'r9', OUT = `assets/review/ui-audit/${TAG}`;
mkdirSync(OUT, { recursive: true });
const ONLY = process.argv.slice(2), want = k => !ONLY.length || ONLY.includes(k);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = [], shots = [];
let p;
const fresh = async (q, readyScene, w = 1280, h = 720) => {
  if (p) await p.close().catch(() => {});
  p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); for (const k of ['im_opening_seen', 'im_tutorial_done', 'im_city_intro_v3', 'im_mount_guide_v1', 'im_home_seen']) localStorage.setItem(k, '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(BASE + q, { timeout: 180000 });
  await p.waitForFunction(k => window.__game?.scene.isActive(k), readyScene, { timeout: 180000 }); await p.waitForTimeout(1500);
};
const hideDev = () => p.evaluate(() => { document.querySelectorAll('[id^="dev-"]').forEach(e => { e.style.display = 'none'; }); });
const shot = async name => { await hideDev(); await p.waitForTimeout(250); const v = p.viewportSize(); await p.screenshot({ path: `${OUT}/a-${name}-${v.width}.png` }); shots.push(name); };
const step = async (label, fn) => { try { await fn(); } catch (e) { console.log('SKIP', label, String(e).slice(0, 180)); } };
const G = "window.__game.scene.getScene('GameScene')";
const ev = (fn, arg) => p.evaluate(([S0, f, a]) => eval('(' + f + ')')(eval(S0), a), [G, String(fn), arg]);
const battle = async (stage = 1, w, h) => {
  await fresh(`?dev=1&autostart=1&stage=${stage}&layout=desktop&story=off`, 'GameScene', w, h);
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && s.elapsed > 2.5; }, null, { timeout: 120000 });
  await ev(s => { s.player.damageImmune = true; for (let i = 0; i < 4 && s.mode !== 'none'; i++) s.__DEV_ACTIONS.closePopup?.(); });
};
const act = k => ev((s, k) => s.__DEV_ACTIONS[k]?.(), k);
const calm = () => ev(s => { if (s.mode === 'branch') s.chooseBranch?.(0); for (let i = 0; i < 4 && s.mode !== 'none'; i++) s.__DEV_ACTIONS.closePopup?.(); if (s.mode === 'pause') s.togglePause(); if (s.mode !== 'none') s.setMode('none'); });
const seedWorld = () => p.evaluate(() => { localStorage.setItem('im_world_v1', JSON.stringify({ version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 1, worldAvailable: true, cleared: { huangjin: true, hulao: true }, provisions: 1860, buildings: { hall: 2, barracks: 2, farm: 2, academy: 1, talent: 1, stable: 1, granary: 1, pavilion: 1 }, cities: {}, ownedCities: ['xuchang'], capturedEver: ['xuchang'], chapterSeen: 99, tutorialSeen: true, mechSeen: ['siege', 'intel', 'defense', 'side'] })); localStorage.setItem('im_chapter1_cleared', 'true'); localStorage.setItem('im_roster_v1', JSON.stringify({ version: 1, lord: 'zhaoyun', lordFinal: true, owned: ['guanyu'], followers: [] })); });
const goScene = async (key, data) => { await p.evaluate(([k, d]) => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(k, d); }, [key, data ?? {}]); await p.waitForFunction(k => window.__game.scene.isActive(k), key, { timeout: 60000 }); await p.waitForTimeout(2500); };
const dropModals = key => p.evaluate(k => { const s = window.__game.scene.getScene(k); for (const o of [...s.children.list]) if (o.type === 'Container' && (o.depth ?? 0) >= 50) o.destroy(); }, key);

if (want('battle')) {
  await step('hud', async () => { await battle(4); await ev(s => { s.player.growth.unallocated = 2; s.player.hp = s.player.maxHp * .6; }); await p.waitForTimeout(3000); await shot('b-hud'); });
  await step('levelup', async () => { await ev(s => { s.player.xp = s.player.xpNext; }); await p.waitForTimeout(1300); await shot('b-levelup'); await calm(); });
  await step('support', async () => { await ev(s => s.openRecruit?.()); await p.waitForTimeout(900); await shot('b-support'); await calm(); });
  await step('pause', async () => { await ev(s => s.togglePause()); await p.waitForTimeout(600); await shot('b-pause'); await calm(); });
  await step('build', async () => { await ev(s => s.openBuildPanel?.()); await p.waitForTimeout(800); await shot('b-build'); await ev(s => s.children.getByName('build-panel')?.destroy()); await calm(); });
  await step('bag', async () => { await ev(s => s.openBattleBag()); await p.waitForTimeout(1500); await shot('b-bag'); await ev(s => s.children.getByName('item-bag')?.destroy()); await calm(); });
  await step('attr', async () => { await ev(s => { s.attributeReturn = 'none'; s.renderAttributePanel(); s.setMode('attributes'); }); await p.waitForTimeout(600); await shot('b-attributes'); await calm(); });
  await step('map', async () => { await p.mouse.click(640, 400); await p.keyboard.press('KeyM'); await p.waitForTimeout(1500); await shot('b-map'); await p.keyboard.press('KeyM'); await p.waitForTimeout(1200); });
  await step('branch', async () => { await act('weaponNative5'); await p.waitForTimeout(600); const ok = await ev(s => s.mode === 'branch' || (s.needBranch?.() && (s.openBranch(), true))); await p.waitForTimeout(800); if (ok) await shot('b-branch'); await calm(); });
  await step('boss', async () => { await act('boss'); await p.waitForTimeout(4000); await calm(); await p.waitForTimeout(400); await shot('b-boss'); });
  await step('lose', async () => { await act('loseNow'); await p.waitForTimeout(3500); await shot('b-defeat'); });
}
if (want('rest')) await step('rest', async () => {
  await battle(1); await act('winNow'); await p.waitForTimeout(3500); await shot('r-report');
  await ev(s => s.children.getByName('rest-summary')?.emit('pointerdown')); await p.waitForTimeout(800);
  const tabs = await ev(s => s.campUI?.root.list.filter(o => /^camp-tab-\d+$/.test(o.name ?? '') && o.visible).map(o => o.name) ?? []);
  for (const t of tabs) { await ev((s, n) => s.campUI.root.getByName(n).emit('pointerdown'), t); await p.waitForTimeout(700); await shot('r-' + t); }
});
if (want('result')) await step('win', async () => { await battle(3); await act('winNow'); await p.waitForTimeout(4500); await shot('x-result-win'); });
if (want('city')) {
  await step('city', async () => { await fresh('?layout=desktop', 'MenuScene'); await seedWorld(); await goScene('CityScene'); await dropModals('CityScene'); await p.waitForTimeout(400); await shot('c-camp'); });
  for (const id of ['hall', 'barracks', 'academy']) await step('card-' + id, async () => { await p.evaluate(i => window.__game.scene.getScene('CityScene').openCard(i), id); await p.waitForTimeout(700); await shot('c-card-' + id); await dropModals('CityScene'); });
  await step('codex', async () => { await p.evaluate(() => window.__game.scene.getScene('CityScene').openCodex()); await p.waitForTimeout(1300); await shot('c-hero-list'); await dropModals('CityScene'); });
  await step('recruit', async () => { await goScene('CityRecruitScene'); await shot('c-recruit'); });
  await step('talent', async () => { await goScene('TalentHallScene'); await shot('c-talent'); });
  await step('town', async () => { await goScene('TownScene', { city: 'xuchang' }); await shot('c-town'); });
  await step('world', async () => { await goScene('WorldMapScene'); await shot('w-map'); });
}
if (want('siege')) await step('siege', async () => { await battle(1); const k = await ev(s => Object.keys(s.__DEV_ACTIONS).find(x => x.startsWith('siege_'))); await act(k); await p.waitForFunction(() => window.__game.scene.getScene('SiegeGameScene')?.player, null, { timeout: 90000 }); await p.waitForTimeout(4500); await p.evaluate(() => { const s = window.__game.scene.getScene('SiegeGameScene'); s.player.damageImmune = true; }); await shot('s-siege'); });
if (want('sizes')) for (const [w, h] of [[1600, 900], [1920, 1080]]) await step('size' + w, async () => { await battle(4, w, h); await p.waitForTimeout(2500); await shot('z-hud'); await ev(s => s.togglePause()); await p.waitForTimeout(600); await shot('z-pause'); });
console.log('SHOTS', shots.length, shots.join(' '));
console.log('ERRORS', errs.length, JSON.stringify(errs.slice(0, 6)));
await b.close();
