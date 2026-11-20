// 敌人身上的状态标记（StatusFx）：灼烧 / 迟滞 / 眩晕 / 破甲 各自出现、结束后消失、同屏有上限。需要开发服务器（默认 5260）。截图 assets/review/school-fx/status-*.png
// 用法：BASE=http://127.0.0.1:5260/ node tools/test-status-fx.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5260/', OUT = 'assets/review/school-fx'; mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }), p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
const r = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); }
  const out = { ready: s.statusFx?.ready }; if (!s.statusFx?.ready) return out;
  const px = s.player.x, py = s.player.y, now = () => s.combatNow, mk = (dx, dy) => { const e = s.spawnEnemy('infantry', px + dx, py + dy, 1, true); e.speed = 0; e.hp = e.maxHp = 9e5; return e; };
  const eb = mk(90, -60), es = mk(190, -60), et = mk(90, 40), ea = mk(190, 40);
  s.buildCombat.igniteDerived(eb, 5, now(), 4000); es.martialSlow = .5; es.martialSlowUntil = now() + 4000; et.stunUntil = now() + 4000; s.buildCombat.vulnerable(ea, .12, now(), 4000);
  await new Promise(r => setTimeout(r, 400)); out.active4 = s.statusFx.active;
  window.__sfx = { eb, es, et, ea }; return out;
});
ck('状态标记图已载入（fx_status）', r.ready, r);
if (r.ready) {
  ck('灼烧 / 迟滞 / 眩晕 / 破甲 四个敌人各画 1 个标记', r.active4 === 4, r);
  await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/status-4.png`, clip: { x: 430, y: 200, width: 460, height: 260 } });
  const r2 = await p.evaluate(async () => { const s = window.__game.scene.getScene('GameScene'), E = window.__sfx; const now = s.combatNow; E.eb.deactivate(); E.es.martialSlowUntil = 0; E.et.stunUntil = 0; await new Promise(r => setTimeout(r, 300)); const left = s.statusFx.active;
    // 压力：60 个敌人同时全状态 → 不超过上限
    const px = s.player.x, py = s.player.y; for (let i = 0; i < 60; i++) { const e = s.spawnEnemy('infantry', px - 200 + (i % 10) * 40, py - 140 + Math.floor(i / 10) * 30, 1, true); if (!e) continue; e.speed = 0; e.hp = e.maxHp = 9e5; e.stunUntil = now + 4000; e.martialSlow = .5; e.martialSlowUntil = now + 4000; s.buildCombat.igniteDerived(e, 5, now, 4000); }
    await new Promise(r => setTimeout(r, 400)); return { left, peak: s.statusFx.active, cap: 28 }; });
  ck('灼烧敌人死亡 / 迟滞 / 眩晕结束后标记消失（只剩破甲 1 个）', r2.left === 1, r2);
  ck('同屏标记有上限（60 个敌人全状态 ≤ 28）', r2.peak <= 28 && r2.peak > 0, r2);
}
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); await b.close(); process.exit(rows.every(Boolean) ? 0 : 1);
