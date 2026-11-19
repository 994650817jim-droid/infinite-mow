// 全面检查探针：哪个系统刷出了用某张贴图的敌兵（记录 spawnEnemy 调用栈）。用法：node who-sheet.mjs <Scene> <reg> <stage> <sheetSubstr>
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', [key, reg, st, sub] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
await p.evaluate(([key, reg, st]) => { const s0 = window.__game.scene.getScene('GameScene'); s0.registry.set(reg, Number(st)); s0.registry.set('runConfig', { character: 'zhaoyun', thirdStage: Number(st) }); s0.scene.start(key); }, [key, reg, st]);
await p.waitForFunction(k => window.__game.scene.isActive(k) && window.__game.scene.getScene(k).player, key, { timeout: 120000 });
const r = await p.evaluate(async ([k, sub]) => { const s = window.__game.scene.getScene(k), hits = []; const orig = s.spawnEnemy;
  s.spawnEnemy = function (kind, x, y, ...rest) { const e = orig.call(this, kind, x, y, ...rest); const key = e?.sprite?.texture?.key ?? ''; if (e && key.includes(sub) && hits.length < 5) hits.push({ kind, key, def: e.def?.texture, walk: e.def?.walkVisual?.texture ?? null, stack: new Error().stack.split('\n').slice(2, 7).map(l => l.replace(/https?:\/\/[^/]+\//, '').trim()).join(' <- ') }); return e; };
  s.player.damageImmune = true; s.devOneHit = true; s.devTimeScale = 3; const t = performance.now(); let a = 0;
  while (performance.now() - t < 60000 && !s.over && hits.length < 5) { for (let i = 0; i < 6 && s.mode !== 'none'; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'parley' && s.parley?.choose) s.parley.choose('execute'); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode('none'); } } window.__IM?.setMove(Math.cos(a += .07), Math.sin(a)); await new Promise(r => setTimeout(r, 150)); }
  return hits; }, [key, sub]);
console.log(JSON.stringify(r, null, 1)); await b.close();
