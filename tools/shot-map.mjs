// 舆图截图（前后对比）：2-3 洛阳（攻势途中）、攻城（陈留）、普通关（2-2 荥阳）各展开一次舆图截图。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5241/ TAG=before node tools/shot-map.mjs   → assets/review/map-art/<关>-<TAG>.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'after', OUT = 'assets/review/map-art'; mkdirSync(OUT, { recursive: true });
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 500, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {} };
const STAGES = [
  { id: '2-3', key: 'GameScene', run: { chapter: 'hulao', westStage: 3 }, push: true },
  { id: 'siege', key: 'SiegeGameScene', siege: 'chenliu' },
  { id: '2-2', key: 'GameScene', run: { chapter: 'hulao', westStage: 2 } },
];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errors = [];
for (const st of STAGES) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(st.id + ' ' + e.message.slice(0, 200)));
  await p.addInitScript(w => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } }, world);
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
  await p.evaluate(st => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer');
    if (st.siege) { s0.registry.set('siegeCity', st.siege); s0.registry.remove('siegeMode'); }
    s0.registry.set('runConfig', { character: 'zhaoyun', ...(st.run ?? {}) }); for (const sc of g.scene.getScenes(true)) if (sc.scene.key !== 'GameScene') sc.scene.stop(); s0.scene.start(st.key); }, st);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.battleMap; }, st.key, { timeout: 120000 });
  await p.evaluate(k => { const s = window.__game.scene.getScene(k); window.__S = s; s.player.damageImmune = true; document.querySelectorAll('[data-dev-panel],.dev-panel').forEach(x => x.style.display = 'none');
    window.__calm = () => { for (let i = 0; i < 12 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); else break; } } }; }, st.key);
  for (let i = 0; i < 30; i++) { await p.evaluate(() => window.__calm()); await p.waitForTimeout(200); }
  if (st.push) await p.evaluate(() => { const s = window.__S; s.allyPush?.spawn(); s.allyPush?.spawn(); });
  await p.waitForTimeout(st.push ? 4000 : 1500);
  await p.evaluate(() => { window.__calm(); window.__S.battleMap.toggleBig(); });
  await p.waitForTimeout(1300);
  await p.screenshot({ path: `${OUT}/${st.id}-${TAG}.png` });
  console.log('shot', `${OUT}/${st.id}-${TAG}.png`, await p.evaluate(() => ({ ...window.__S.battleMap.stats, detail: undefined })));
  await p.close();
}
console.log('errors', errors);
await b.close();
