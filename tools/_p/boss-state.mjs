import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
await p.evaluate(() => { const s0 = window.__game.scene.getScene('GameScene'); s0.registry.set('beifaStage', 1); s0.registry.set('runConfig', { character: 'zhaoyun' }); s0.scene.start('BeifaGameScene'); });
await p.waitForFunction(() => window.__game.scene.isActive('BeifaGameScene') && window.__game.scene.getScene('BeifaGameScene').player, null, { timeout: 120000 });
for (let i = 0; i < 60; i++) { const r = await p.evaluate(() => { const s = window.__game.scene.getScene('BeifaGameScene'); s.player.damageImmune = true; s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode('none'); if (!s.bossSpawned) s.devSetTime?.(999); return !!s.boss?.active; }); if (r) break; await p.waitForTimeout(300); }
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const s = window.__game.scene.getScene('BeifaGameScene'), bo = s.boss, out = [];
  for (let i = 0; i < 4; i++) { const h0 = bo.hp; const ret = s.hitEnemy(bo, 100, s.combatNow, 'melee', false, false); out.push({ h0: Math.round(h0), h1: Math.round(bo.hp), ret, inv: bo.invulnerable, active: bo.active, over: s.over, mode: s.mode, moveset: !!s.moveset, kitShift: s.moveset?.kit?.inShift, xiliang: !!s.xiliang, dual: !!s.dual }); }
  return { out, maxHp: bo.maxHp, combatNow: Math.round(s.combatNow), paused: s.physics?.world?.isPaused, timeScale: s.devTimeScale };
});
console.log(JSON.stringify(r, null, 1)); await b.close();
