// 全面检查探针：缺帧警告的调用栈。用法：BASE=… node tools/_p/frame-warn-probe.mjs <GameScene|…> <cfgJSON> [regKey regVal]
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', [key, cfg, rk, rv] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.addInitScript(() => { const w = console.warn; window.__fw = []; console.warn = function (...a) { const m = a.join(' '); if (/has no frame/.test(m) && window.__fw.length < 12) window.__fw.push(a.slice(1).join(' ') + '\n' + new Error().stack.split('\n').slice(2, 9).map(l => l.replace(/https?:\/\/[^/]+\//, '').trim()).join('\n')); return w.apply(this, a); }; });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
await p.evaluate(([key, cfg, rk, rv]) => { const s0 = window.__game.scene.getScene('GameScene'); if (rk) s0.registry.set(rk, Number(rv)); s0.registry.remove('campaignTransfer'); s0.registry.set('runConfig', { character: 'zhaoyun', ...JSON.parse(cfg) }); s0.scene.start(key); }, [key, cfg, rk, rv]);
await p.waitForFunction(k => window.__game.scene.isActive(k) && window.__game.scene.getScene(k).player && window.__game.scene.getScene(k).elapsed < 5, key, { timeout: 120000 });
await p.evaluate(async k => { const s = window.__game.scene.getScene(k); s.player.damageImmune = true; s.devOneHit = true; s.devTimeScale = 3; const t = performance.now(); let a = 0;
  while (performance.now() - t < 70000 && !s.over) { for (let i = 0; i < 6 && s.mode !== 'none'; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'parley' && s.parley?.choose) s.parley.choose('execute'); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode('none'); } } if (s.awaitingChest) s.collectBossChests?.(); window.__IM?.setMove(Math.cos(a += .07), Math.sin(a)); await new Promise(r => setTimeout(r, 150)); } }, key);
console.log((await p.evaluate(() => window.__fw)).join('\n----\n') || 'no frame warnings'); await b.close();
