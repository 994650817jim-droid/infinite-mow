// 其他事件轻量特效：名将来投 / 赌命 / 悬赏信物 各画一次。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5260/ node tools/test-treasure-fx.mjs     截图 assets/review/school-fx/event-1.png
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5260/', OUT = 'assets/review/school-fx'; mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const bc = readFileSync('src/systems/BuildCombat.ts', 'utf8');
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }), p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
const r = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); }
  const px = s.player.x, py = s.player.y, v = s.buildVfxPool;
  const o={}, cnt=(fn)=>{const b=v.emitted;fn();return v.emitted-b;}; o.join=cnt(()=>s.generalJoins('测试',4,8000)); o.gamble=cnt(()=>s.takeGamble('allin')); o.charm=cnt(()=>s.grantCharm()); return o; });
ck('来投 / 赌命 / 悬赏信物各画一次', r.join>=1&&r.gamble>=1&&r.charm>=1, r);
await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/event-1.png`, clip: { x: 420, y: 190, width: 460, height: 280 } });
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); await b.close(); process.exit(rows.every(Boolean) ? 0 : 1);
