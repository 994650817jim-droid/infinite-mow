// 攻城「府衙」阶段截图（府衙大堂 / 台阶 / 回廊 / 内城门）：每档城各拍一张。
// 用法：BASE=http://127.0.0.1:5212/ TAG=new TIERS=medium,large node tools/shot-siege-hall.mjs   → assets/review/siege-hall/<TAG>-<档>-<处>.png
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'shot', OUT = 'assets/review/siege-hall';
mkdirSync(OUT, { recursive: true });
const src = readFileSync('tools/shot-siege-scene.mjs', 'utf8'), m = src.match(/const save = (\{.*\});/);
const save = eval('(' + m[1] + ')');
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errors = [];
for (const tier of (process.env.TIERS ?? 'medium,large').split(',')) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(tier + ' ' + e.message));
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=desktop', { waitUntil: 'commit', timeout: 120000 }); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
  await p.evaluate(async tier => {
    const c = await import('/src/world/WorldCities.ts'), w = await import('/src/world/WorldStore.ts'), s = w.loadWorld();
    const id = c.CITIES.find(x => x.tier === tier && c.cityAttackable(x.id, s.ownedCities))?.id, g = window.__game;
    g.registry.set('siegeCity', id); g.registry.remove('siegeMode'); g.registry.set('runConfig', { character: 'zhaoyun' });
    for (const sc of g.scene.getScenes(true)) sc.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('SiegeGameScene'); else { g.registry.set('pendingWarlord', 'SiegeGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); }
  }, tier);
  await p.waitForFunction(() => window.__game.scene.isActive('SiegeGameScene') && window.__game.scene.getScene('SiegeGameScene').player, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const g = window.__game, s = g.scene.getScene('SiegeGameScene'); s.__DEV_ACTIONS?.closePopup?.(); s.player.damageImmune = true; for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; g.loop.sleep(); window.__T = performance.now();
    window.__go = (x, y, n = 40) => { s.player.sprite.setPosition(x, y); for (let i = 0; i < n; i++) { if (s.mode !== 'none' && !s.over) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'paused') s.setMode('none'); } window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); } }; });
  const ok = await p.evaluate(() => { const S = window.__S ?? window.__game.scene.getScene('SiegeGameScene'); const M = S.siegeMid; if (!M) return false; M.phase = 'hall'; M.enterHall(); return M.phase; });
  console.log(tier, 'phase', ok);
  const arenaTop = await p.evaluate(async () => { const m = await import('/src/data/siegeMedium.ts'); return m.MID_SIEGE.hall.arena.top; });
  for (const [name, dy] of [['hall-up', -170]]) {
    await p.evaluate(([t, dy]) => { window.__go(0, t + dy + 150, 420); }, [arenaTop, dy]);
    await p.screenshot({ path: `${OUT}/${TAG}-${tier}-${name}.png` });
  }
  await p.close();
}
console.log(errors.length ? 'errors: ' + errors.slice(0, 4).join(' | ') : 'ok');
await b.close();
