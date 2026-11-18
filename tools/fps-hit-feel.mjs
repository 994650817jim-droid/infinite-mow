// 打击感改动前后的帧率对比（电脑布局 1280×720，无头 Chrome）：
//  ① 1-1（GameScene）：赵云 + 4 把满级武器，四周 120 名敌人（血量很高、持续挨打）；
//  ② 10-3 火烧连营（YilingGameScene 第 3 关）：同样配置，特效最重的关之一。
// 每个场景先热身 2 秒，再采样 SECONDS 秒（默认 15）：平均帧率、1% 低帧、命中次数、GameScene.update 平均耗时（毫秒，脚本开销，比帧率更不受机器负载影响）。
// 用法：BASE=http://127.0.0.1:5173/ NAME=before node tools/fps-hit-feel.mjs → assets/review/hit-feel/fps-<NAME>.json
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', NAME = process.env.NAME ?? 'run', SECONDS = Number(process.env.SECONDS ?? 15);
mkdirSync('assets/review/hit-feel', { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const out = {};
for (const sc of [{ id: '1-1', key: 'GameScene' }, { id: '10-3', key: 'YilingGameScene' }]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }), p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  if (sc.key === 'GameScene') await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop');
  else {
    await p.goto(BASE + '?dev=1&layout=desktop');
    await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene') || window.__game?.scene.getScenes(true).length, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await p.evaluate(() => { const g = window.__game; g.registry.set('yilingStage', 3); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: 3 }); g.registry.remove('yilingTransfer'); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('YilingGameScene'); });
  }
  await p.waitForFunction(k => { const s = window.__game?.scene.getScene(k); return s?.player && s.sys.isActive() && window.__IM; }, sc.key, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(k => {
    const s = window.__game.scene.getScene(k), pl = s.player; window.__IM.god?.(); s.__DEV_ACTIONS?.closePopup?.();
    s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
    for (let i = 0; i < 120; i++) { const a = i * Math.PI * 2 / 120, r = 90 + (i % 4) * 40, e = s.spawnEnemy(i % 10 ? 'infantry' : 'elite', pl.x + Math.cos(a) * r, pl.y + Math.sin(a) * r, 1); if (e) { e.hp = e.maxHp = 1e9; } }
    for (const id of ['spear_orbit', 'crossbow', 'guandao', 'flame_banner']) { try { window.__IM.giveWeapon(id); pl.weapons.at(-1).level = 5; } catch { /* 部分章节没有该武器 */ } }
    pl.stats.critChance = .3;
    window.__hits = 0; const orig = s.hitEnemy.bind(s); s.hitEnemy = (...a) => { window.__hits++; return orig(...a); }; window.__upd = { n: 0, ms: 0 }; const up = s.sys.sceneUpdate; s.sys.sceneUpdate = (t, d) => { const t0 = performance.now(); up.call(s, t, d); window.__upd.n++; window.__upd.ms += performance.now() - t0; };
  }, sc.key);
  await p.waitForTimeout(2000);
  const sample = await p.evaluate(sec => new Promise(res => {
    window.__upd.n = 0; window.__upd.ms = 0; const start = performance.now(), h0 = window.__hits; let last = start; const frames = [];
    const tick = now => { frames.push(now - last); last = now; if (now - start < sec * 1000) return requestAnimationFrame(tick);
      const slow = frames.slice().sort((a, c) => c - a).slice(0, Math.max(1, Math.ceil(frames.length * .01)));
      res({ fps: +(frames.length * 1000 / (now - start)).toFixed(1), low1: +(1000 / (slow.reduce((a, c) => a + c, 0) / slow.length)).toFixed(1), hitsPerSec: Math.round((window.__hits - h0) / sec), updateMs: +(window.__upd.ms / Math.max(1, window.__upd.n)).toFixed(2) }); };
    requestAnimationFrame(tick);
  }), SECONDS);
  sample.enemies = await p.evaluate(k => window.__game.scene.getScene(k).enemies.filter(e => e.active).length, sc.key);
  sample.errors = errors.slice(0, 3);
  out[sc.id] = sample; console.log(sc.id, JSON.stringify(sample));
  await ctx.close();
}
await b.close();
writeFileSync(`assets/review/hit-feel/fps-${NAME}.json`, JSON.stringify(out, null, 2));
