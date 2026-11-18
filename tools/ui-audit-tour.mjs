// UI 一致性审查（2026-11-17 用户：「我也想优化优化ui看看哪里有不协调的」）：把玩家能看到的界面都截一遍。
// 正式存档（中期：第二章打完、群雄打到 3-2、有城池）；每组开新页，单个界面出错不影响后面。
// 用法：BASE=http://127.0.0.1:5180/ TAG=before node tools/ui-audit-tour.mjs [组名…]   截图在 assets/review/ui-audit/<TAG>/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5180/', tag = process.env.TAG ?? 'before', out = `assets/review/ui-audit/${tag}`;
mkdirSync(out, { recursive: true });
const only = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true });
const log = []; const errors = [];
const WORLD = { version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 1, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, provisions: 860, buildings: { hall: 2, barracks: 2, farm: 2, academy: 1, talent: 1, stable: 1, granary: 1, pavilion: 1 }, cities: {}, ownedCities: ['xuchang'], capturedEver: ['xuchang'], chapterSeen: 99, tutorialSeen: true };
const ROSTER = { version: 1, lord: 'zhaoyun', lordFinal: true, owned: ['guanyu'], followers: [] };
const seed = (fresh) => (S => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_home_seen', '1');
  if (S) { localStorage.setItem('im_world_v1', S.w); localStorage.setItem('im_chapter1_cleared', 'true'); localStorage.setItem('im_roster_v1', S.r); localStorage.setItem('im_last_hero', 'zhaoyun'); } });
async function page(w = 1280, h = 720, fresh = false, q = '') {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(seed(fresh), fresh ? null : { w: JSON.stringify(WORLD), r: JSON.stringify(ROSTER) });
  await p.addInitScript(() => { window.__find = (root, name) => { const walk = o => { if (!o) return null; if (o.name === name) return o; for (const c of o.list ?? []) { const r = walk(c); if (r) return r; } return null; }; return walk(root); }; });
  await p.goto(base + '?layout=desktop' + q); await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive() || window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 }); await p.waitForTimeout(1500);
  return p;
}
const shot = async (p, name) => { const v = p.viewportSize(); await p.screenshot({ path: `${out}/${name}-${v.width}x${v.height}.png` }); log.push(name); };
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log('SKIP', name, String(e.message ?? e).slice(0, 200)); } };
const want = g => !only.length || only.includes(g);
const G = "window.__game.scene.getScene('GameScene')";
const battle = async (p, cfg) => { await p.evaluate(c => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', ...c }); g.registry.set('worldCampaign', true); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); }, cfg);
  await p.waitForFunction(G0 => { const s = eval(G0); return s?.player && s.scene.isActive(); }, G, { timeout: 90000 }); await p.waitForTimeout(1500); await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; }, G); };

// ① 主页系列（1280 + 1920）
if (want('home')) for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  const p = await page(w, h);
  await step('home', () => shot(p, '01-home'));
  const M = "window.__game.scene.getScene('MenuScene')";
  const close = () => p.evaluate(M0 => { const m = eval(M0); for (const n of ['game-codex', 'achievements-panel', 'home-settings-panel', 'save-slots-panel', 'campaign-chronicle', 'chronicle']) m.children.getByName(n)?.destroy(); m.heroModal?.setVisible(false); }, M);
  await step('picker', async () => { await p.evaluate(M0 => eval(M0).heroPicker.open(0), M); await p.waitForTimeout(1200); await shot(p, '02-lord-picker'); await close(); });
  await step('codex', async () => { await p.evaluate(M0 => eval(M0).children.getByName('home-codex').emit('pointerdown'), M); await p.waitForTimeout(1500); await shot(p, '03-codex'); await close(); });
  await step('ach', async () => { await p.evaluate(M0 => { const m = eval(M0); const o = window.__find(m.children, 'home-achievements'); o?.emit('pointerdown'); o?.emit('pointerup'); }, M); await p.waitForTimeout(1000); await shot(p, '04-achievements'); await close(); });
  await step('settings', async () => { await p.evaluate(M0 => eval(M0).openHomeSettings(), M); await p.waitForTimeout(700); await shot(p, '05-home-settings'); await close(); });
  await step('review', async () => { await p.evaluate(M0 => eval(M0).children.getByName('home-review').emit('pointerdown'), M); await p.waitForTimeout(1200); await shot(p, '06-chronicle'); });
  await p.close();
  if (w === 1280) { const q = await page(1280, 720); await step('saves', async () => { await q.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); const t = m.children.list.find(o => o.type === 'Text' && o.text === '存档'); t?.emit('pointerdown'); }); await q.waitForTimeout(900); await shot(q, '07-save-slots'); }); await q.close(); }
}
// ② 天下地图
if (want('map')) for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  const p = await page(w, h);
  await step('map', async () => { await p.evaluate(() => window.__game.scene.getScene('MenuScene').startButton.emit('pointerdown')); await p.waitForFunction(() => window.__game.scene.getScene('WorldMapScene')?.sys.isActive(), null, { timeout: 30000 }); await p.waitForTimeout(2000); await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').children.getByName('chapter-unlock-close')?.emit('pointerup')); await shot(p, '10-worldmap'); });
  if (w === 1280) {
    const W = "window.__game.scene.getScene('WorldMapScene')";
    await step('map-city', async () => { await p.evaluate(W0 => { const s = eval(W0), m = s.cityMarkers.find(c => c.city.id === 'xuchang'); s.selected = { kind: 'city', city: m.city }; s.refresh(); s.centerOnCity(m.city); }, W); await p.waitForTimeout(500); await shot(p, '11-worldmap-city'); });
    await step('map-siege', async () => { await p.evaluate(W0 => { const s = eval(W0), m = s.cityMarkers.find(c => c.city.id === 'runan') ?? s.cityMarkers.find(c => !s.owned.includes(c.city.id)); s.openSiege(m.city, false); }, W); await p.waitForTimeout(700); await shot(p, '12-siege-modal'); });
    await step('map-legend', async () => { await p.evaluate(W0 => { const s = eval(W0); s.siegeModal?.destroy(); s.children.getByName('world-era').emit('pointerup'); }, W); await p.waitForTimeout(400); await shot(p, '13-worldmap-legend'); });
  }
  await p.close();
}
// ③ 营寨与建筑
if (want('camp')) {
  const p = await page(1280, 720);
  const C = "window.__game.scene.getScene('CityScene')";
  await step('camp', async () => { await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('CityScene'); }); await p.waitForFunction(C0 => eval(C0)?.sys.isActive(), C, { timeout: 30000 }); await p.waitForTimeout(2500); await p.evaluate(C0 => { const s = eval(C0); s.children.getByName('town-intro-close')?.emit('pointerdown'); }, C); await p.waitForTimeout(400); await shot(p, '20-camp'); });
  for (const id of ['hall', 'barracks', 'farm', 'academy', 'talent', 'stable', 'granary', 'pavilion']) await step('card-' + id, async () => { await p.evaluate(([C0, i]) => { const s = eval(C0); s.children.list.filter(o => /^town-card$|town-card-root/.test(o.name ?? '')).forEach(o => o.destroy()); s.openCard(i); }, [C, id]); await p.waitForTimeout(600); await shot(p, '21-card-' + id); await p.evaluate(C0 => { const s = eval(C0); for (const o of [...s.children.list]) if (o.type === 'Container' && o.depth >= 50) o.destroy(); }, C); });
  await step('tech', async () => { await p.evaluate(C0 => eval(C0).openTech(), C); await p.waitForTimeout(700); await shot(p, '22-tech'); await p.evaluate(C0 => { const s = eval(C0); for (const o of [...s.children.list]) if (o.type === 'Container' && o.depth >= 50) o.destroy(); }, C); });
  await step('merit', async () => { await p.evaluate(C0 => eval(C0).openMeritExchange(), C); await p.waitForTimeout(700); await shot(p, '23-merit-exchange'); await p.evaluate(C0 => { const s = eval(C0); for (const o of [...s.children.list]) if (o.type === 'Container' && o.depth >= 50) o.destroy(); }, C); });
  await step('stable', async () => { await p.evaluate(C0 => { const s = eval(C0); s.openStable(s.add.text(0, 0, '')); }, C); await p.waitForTimeout(900); await shot(p, '24-stable'); await p.evaluate(C0 => { const s = eval(C0); for (const o of [...s.children.list]) if (o.type === 'Container' && o.depth >= 50) o.destroy(); }, C); });
  await step('herocodex', async () => { await p.evaluate(C0 => eval(C0).openCodex(), C); await p.waitForTimeout(1200); await shot(p, '25-hero-list'); });
  await step('recruit-scene', async () => { await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('CityRecruitScene'); }); await p.waitForTimeout(2500); await shot(p, '26-barracks-recruit'); });
  await step('talent', async () => { await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('TalentHallScene'); }); await p.waitForTimeout(2500); await shot(p, '27-talent-hall'); });
  await step('town', async () => { await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('TownScene', { city: 'xuchang' }); }); await p.waitForTimeout(2500); await shot(p, '28-city-xuchang'); });
  await p.close();
}
// ④ 战斗（2-1 汜水关，正式）
if (want('battle')) for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  const p = await page(w, h);
  await step('hud', async () => { await battle(p, { chapter: 'hulao', westStage: 1 }); await p.evaluate(G0 => { const s = eval(G0); for (let i = 0; i < 2; i++) s.supplies.pouch.push({ amount: 30, texture: 'healing_potion', name: '回血药' }); s.player.growth.unallocated = 2; s.player.hp = s.player.maxHp * .6; }, G); await p.waitForTimeout(2500); await shot(p, '30-battle-hud'); });
  await step('levelup', async () => { await p.evaluate(G0 => { const s = eval(G0); s.pendingLevels = 1; s.openUpgrade(); }, G); await p.waitForTimeout(900); await shot(p, '31-levelup'); await p.evaluate(G0 => eval(G0).chooseUpgrade(0), G); await p.waitForTimeout(300); });
  if (w === 1280) {
    await step('recruit', async () => { await p.evaluate(G0 => { const s = eval(G0); s.openRecruit(); }, G); await p.waitForTimeout(900); await shot(p, '32-battle-support'); await p.evaluate(G0 => { const s = eval(G0); s.setMode('none'); }, G); });
    await step('settings', async () => { await p.evaluate(G0 => eval(G0).togglePause(), G); await p.waitForTimeout(500); await shot(p, '33-battle-settings'); });
    await step('build', async () => { await p.evaluate(G0 => eval(G0).openBuildPanel(), G); await p.waitForTimeout(700); await shot(p, '34-build-panel'); await p.evaluate(G0 => { const s = eval(G0); s.children.getByName('build-panel')?.destroy(); if (s.mode === 'pause') s.togglePause(); }, G); });
    await step('bag', async () => { await p.evaluate(G0 => eval(G0).openBattleBag(), G); await p.waitForTimeout(1500); await shot(p, '35-battle-bag'); await p.evaluate(G0 => { const s = eval(G0); s.children.getByName('item-bag')?.destroy(); s.setMode('none'); }, G); });
    await step('attr', async () => { await p.evaluate(G0 => { const s = eval(G0); s.attributeReturn = 'none'; s.renderAttributePanel(); s.setMode('attributes'); }, G); await p.waitForTimeout(600); await shot(p, '36-attributes'); await p.evaluate(G0 => eval(G0).setMode('none'), G); });
    await step('boss', async () => { await p.evaluate(G0 => { const s = eval(G0); s.spawnBoss(); }, G); await p.waitForTimeout(2500); await shot(p, '37-boss-hud'); await p.evaluate(G0 => { const s = eval(G0); s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee'); }, G); await p.waitForTimeout(3500); await shot(p, '38-boss-chest'); await p.evaluate(G0 => eval(G0).collectBossChests(), G); await p.waitForTimeout(1200); await shot(p, '39-relic-pick'); });
    await step('rest', async () => { for (let i = 0; i < 10; i++) { const m = await p.evaluate(G0 => { const s = eval(G0); if (s.mode === 'bossloot' || s.mode === 'levelup') s.chooseUpgrade(0); return s.mode; }, G); if (m === 'rest' || m === 'result') break; await p.waitForTimeout(500); }
      await p.waitForFunction(G0 => eval(G0).children.getByName('rest-summary'), G, { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1800); await shot(p, '40-rest-battle-report');
      await p.evaluate(G0 => eval(G0).children.getByName('rest-summary')?.emit('pointerdown'), G); await p.waitForTimeout(500); await shot(p, '41-march-rest');
      await p.evaluate(G0 => eval(G0).campUI.root.list.find(o => o.name === 'camp-tab-2')?.emit('pointerdown'), G); await p.waitForTimeout(500); await shot(p, '42-merchant');
      await p.evaluate(G0 => eval(G0).campUI.root.list.find(o => o.name === 'camp-tab-3')?.emit('pointerdown'), G); await p.waitForTimeout(500); await shot(p, '43-commander-tent'); });
  }
  await p.close();
}
// ⑤ 结算 / 告捷 / 败走 / 剧情 / 攻城
if (want('end')) {
  const p = await page(1280, 720);
  await step('result', async () => { await battle(p, { chapter: 'hulao', westStage: 3 }); await p.evaluate(G0 => { const s = eval(G0); s.kills = 980; s.bossKilled = true; s.finish(true, 'boss'); }, G); await p.waitForTimeout(2500); await shot(p, '50-result-victory'); });
  await step('defeat', async () => { await battle(p, { chapter: 'hulao', westStage: 2 }); await p.evaluate(G0 => { const s = eval(G0); s.kills = 210; s.finish(false, 'death'); }, G); await p.waitForTimeout(2500); await shot(p, '51-result-defeat'); });
  await step('notice', async () => { await battle(p, { chapter: 'huangjin', stage: 3 }); await p.evaluate(G0 => { const s = eval(G0); s.bossKilled = true; s.finish(true, 'boss'); }, G); await p.waitForTimeout(5000); await p.evaluate(G0 => eval(G0).children.getByName('rest-summary')?.emit('pointerdown'), G); await p.waitForTimeout(600); await shot(p, '52-chapter-cleared'); });
  await step('story', async () => { await p.evaluate(G0 => { const s = eval(G0); s.children.getByName('chapter1-volunteers')?.destroy(); s.showMerchantHorseStory(() => {}); }, G); await p.waitForTimeout(1500); await shot(p, '53-story-scroll'); });
  await step('siege', async () => { await p.evaluate(() => { const g = window.__game; g.registry.set('siegeCity', 'runan'); g.registry.remove('siegeMode'); g.registry.set('runConfig', { character: 'zhaoyun' }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('SiegeGameScene'); }); await p.waitForFunction(() => window.__game.scene.getScene('SiegeGameScene')?.player, null, { timeout: 60000 }); await p.waitForTimeout(3000); await shot(p, '54-siege-hud'); });
  await p.close();
}
// ⑥ 新档引导（1-1）
if (want('tutorial')) {
  const p = await page(1280, 720, true, '&autostart=1&tutorial=1');
  await step('tutorial', async () => { await p.waitForFunction(G0 => eval(G0)?.player, G, { timeout: 60000 }); await p.waitForTimeout(3000); await shot(p, '60-tutorial'); });
  await p.close();
  const q = await page(1280, 720, true);
  await step('newsave-home', async () => { await shot(q, '61-newsave-home'); await q.evaluate(() => window.__game.scene.getScene('MenuScene').startButton.emit('pointerdown')); await q.waitForTimeout(1200); await shot(q, '62-newsave-lord-pick'); });
  await q.close();
}
await b.close();
console.log('SHOTS', log.length, log.join(' '));
console.log('ERRORS', errors.length, JSON.stringify(errors.slice(0, 8)));
