// 信物触发特效：斩将虎符（暴击精英）运行时画一次；沉锋玉 / 追魂铃 / 走马令 / 破阵玉做源码接线检查。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5260/ node tools/test-treasure-fx.mjs     截图 assets/review/school-fx/treasure-1.png
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5260/', OUT = 'assets/review/school-fx'; mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const bc = readFileSync('src/systems/BuildCombat.ts', 'utf8');
ck('源码接线：沉锋玉 charge / 追魂铃 sunder_hit / 走马令 skirmish / 破阵玉 heavy / 斩将虎符 peerless', ['charge', 'sunder_hit', 'skirmish', 'heavy', 'peerless'].every(s => bc.includes("onFx?.('" + s + "'")), null);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }), p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
const r = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); }
  const px = s.player.x, py = s.player.y, v = s.buildVfxPool;
  s.player.growth.build.treasures = ['slayer_tally'];
  const e = s.spawnEnemy('elite', px + 140, py - 20, 1, true); e.speed = 0; e.hp = e.maxHp = 9e5;
  const b0 = v.emitted; s.buildCombat.onHit(e, 100, true, s.combatNow); return { n: v.emitted - b0 }; });
ck('斩将虎符：暴击精英 → peerless 画一次', r.n >= 1, r);
await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/treasure-1.png`, clip: { x: 420, y: 190, width: 460, height: 280 } });
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); await b.close(); process.exit(rows.every(Boolean) ? 0 : 1);
