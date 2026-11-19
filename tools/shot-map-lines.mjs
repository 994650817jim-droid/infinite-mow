// 天下地图线条前后对比（2026-11-18 用户「这些线条需要改一下优化一下」）：泗水关 / 荥阳 / 洛阳一带、义军营寨旁；第贰章讨董已开、2-1 已过。
// 用法：BASE=http://127.0.0.1:5180/ TAG=before|after node tools/shot-map-lines.mjs   输出 assets/review/map-lines/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'now', out = 'assets/review/map-lines';
mkdirSync(out, { recursive: true });
const save = { version: 7, yellowStages: 3, dongzhuoStages: 1, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: false }, merits: 0, provisions: 300, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 0, capturedEver: [], chapterSeen: 2, tutorialDone: true };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errors = [];
for (const [name, setup] of [
  ['default', null],
  ['zoom-sishui', s => s.flyTo(780, 330, s.minZoom * 2.6, 0)],
  ['nation', s => s.flyTo(768, 512, s.minZoom, 0)],
]) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
  await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(2500);
  if (setup) await p.evaluate(f => { const s = window.__game.scene.getScene('WorldMapScene'); eval('(' + f + ')')(s); }, String(setup));
  await p.waitForFunction(() => window.__game.scene.getScene('WorldMapScene').tiles?.every(t => !t.loading) ?? true, null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${TAG}-${name}.png` }); console.log('SHOT', TAG, name);
  await p.close();
}
await b.close();
console.log(errors.length ? 'errors: ' + errors.slice(0, 3).join(' | ') : 'ok');
