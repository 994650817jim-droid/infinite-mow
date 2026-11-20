// 查 2-1 汜水关「敌将旁边一大块白色剪影」（2026-11-20 用户截图）：骑马赵云在 2-1 打骑兵 / 精英，逐帧截图 + 列出场上所有闪白（tintFill）的图。
// 用法：BASE=http://127.0.0.1:5743/ [TAG=before] node tools/probe-white-silhouette.mjs → assets/review/white-silhouette/<TAG>-*.png
import { chromium } from 'playwright'; import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5743/', TAG = process.env.TAG ?? 'before', OUT = 'assets/review/white-silhouette'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_chapter1_cleared', 'true'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${BASE}?dev=1&autostart=1&chapter=hulao&stage=1&layout=desktop&story=off`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS; }, null, { timeout: 180000, polling: 500 });
await p.waitForTimeout(1500);
const info = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { key: s.scene.key, chapter: s.chapter?.id, kinds: Object.keys(s.chapter?.enemies ?? {}) }; });
console.log('scene', JSON.stringify(info));
const whites = `(() => { const s = window.__game.scene.getScene('GameScene'), pl = s.player; return s.children.list.filter(o => o.visible && o.alpha > .05 && o.isTinted && o.tintFill).map(o => ({ name: o.name, key: o.texture?.key, frame: String(o.frame?.name), x: Math.round(o.x - pl.x), y: Math.round(o.y - pl.y), w: Math.round(o.displayWidth), h: Math.round(o.displayHeight), a: +o.alpha.toFixed(2), depth: +o.depth.toFixed(2) })); })()`;
const r = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), pl = s.player; s.__DEV_ACTIONS.closePopup?.(); pl.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9;
  for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate();
  pl.weapons[0].cooldownLeft = 1e9;
  const out = [];
  for (const kind of ['cavalry', 'elite']) { const e = s.spawnEnemy(kind, pl.x + 150, pl.y - 90, 1, true); if (!e) { out.push({ kind, none: true }); continue; } e.hp = e.maxHp = 50; e.stunUntil = s.combatNow + 1e6; out.push({ kind, key: e.sprite.texture.key, w: Math.round(e.sprite.displayWidth), h: Math.round(e.sprite.displayHeight), mounted: !!e.mountSprite || !!e.horse }); }
  window.__targets = s.enemies.filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss');
  return out;
});
console.log('spawned', JSON.stringify(r));
await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${TAG}-0-alive.png`, clip: { x: 440, y: 160, width: 520, height: 360 } });
// 重击打死（暴击 = 击飞那一档），逐帧截图 + 列白图
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.debugCrit = true; for (const e of window.__targets) s.hitEnemy(e, 99999, s.combatNow, 'melee'); s.debugCrit = null; });
for (const ms of [30, 90, 200, 400, 800]) {
  await p.waitForTimeout(ms === 30 ? 30 : ms - [30, 90, 200, 400, 800][[30, 90, 200, 400, 800].indexOf(ms) - 1]);
  const w = await p.evaluate(whites);
  console.log(`+${ms}ms 白图`, JSON.stringify(w));
  await p.screenshot({ path: `${OUT}/${TAG}-${ms}ms.png`, clip: { x: 440, y: 160, width: 520, height: 360 } });
}
console.log('errors', JSON.stringify(errs));
await b.close();
