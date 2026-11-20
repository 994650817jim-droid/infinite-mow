// 合击触发特效：15 个合击各触发一次都有画面（两派样式并排），每个合击 2 秒内重复触发不再叠加；截图 assets/review/school-fx/combo-*.png。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5260/ node tools/test-combo-fx.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5260/', OUT = 'assets/review/school-fx'; mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }), p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
const ids = ['fire_wind', 'fire_arrow', 'fire_ox', 'fire_burst', 'fire_hoof', 'ambush_bolt', 'chaos_strike'];
const r = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); }
  const m = await import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes('data/schoolCombos')) ?? '/src/data/schoolCombos.ts'); const all = m.COMBOS.map(c => c.id), v = s.buildVfxPool, out = { n: all.length, drawn: [], dup: null };
  for (const id of all) { const before = v.emitted; s.buildCombat.noteCombo(id); out.drawn.push(v.emitted - before); s.combatNowOffset = 0; await new Promise(r => setTimeout(r, 60)); }
  const b2 = v.emitted; s.buildCombat.noteCombo(all[0]); out.dup = v.emitted - b2; return out; });
ck('15 个合击各触发都有画面（每次 2 张：两派各一）', r.n === 15 && r.drawn.every(d => d >= 2), r);
ck('同一个合击 2 秒内重复触发不再叠加', r.dup === 0, r);
await p.screenshot({ path: `${OUT}/combo-all.png`, clip: { x: 340, y: 160, width: 600, height: 400 } });
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); await b.close(); process.exit(rows.every(Boolean) ? 0 : 1);
