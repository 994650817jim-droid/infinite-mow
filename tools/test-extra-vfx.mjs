// 战法图集额外样式的触发点：ember（点燃）/ stun_burst（眩晕）/ sunder_hit（破甲）/ pull（牵机）各触发都画一次；其余 4 个（heavy / reinforce / watch / breakout）做源码接线检查。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5260/ node tools/test-extra-vfx.mjs     截图 assets/review/school-fx/extra-*.png
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5260/', OUT = 'assets/review/school-fx'; mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const src = f => readFileSync(f, 'utf8');
ck('源码接线：heavy / reinforce / watch / breakout 的触发点都有 emit', /onFx\?\.\('heavy'/.test(src('src/systems/BuildCombat.ts')) && /emit\('reinforce'/.test(src('src/scenes/GameScene.ts')) && /emit\('watch'/.test(src('src/systems/BulwarkBuild.ts')) && /emit\('breakout'/.test(src('src/systems/CommandBuild.ts')), null);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }), p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
const r = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); }
  const px = s.player.x, py = s.player.y, now = () => s.combatNow, mk = (dx, dy) => { const e = s.spawnEnemy('infantry', px + dx, py + dy, 1, true); e.speed = 0; e.hp = e.maxHp = 9e5; return e; };
  const v = s.buildVfxPool, out = {}, count = (fn) => { const b = v.emitted; fn(); return v.emitted - b; };
  s.player.growth.build.tactics = { traction: 2 };
  const a = mk(110, -50), b2 = mk(190, -50), c = mk(110, 40), d = mk(190, 40), pull = mk(150, 100);
  out.ember = count(() => s.buildCombat.igniteDerived(a, 5, now(), 3000)); await new Promise(r => setTimeout(r, 120));
  out.stun = count(() => s.buildCombat.stun(b2, 1500, now())); await new Promise(r => setTimeout(r, 120));
  out.sunder = count(() => s.buildCombat.vulnerable(c, .12, now())); await new Promise(r => setTimeout(r, 120));
  if (s.controlBuild) s.controlBuild.pullAt = 0; out.pull = count(() => s.controlBuild?.onHit(pull, now()));
  return out; });
ck('点燃 → ember、眩晕 → stun_burst、破甲 → sunder_hit、牵机 → pull 各画一次', r.ember >= 1 && r.stun >= 1 && r.sunder >= 1 && r.pull >= 1, r);
await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/extra-4.png`, clip: { x: 420, y: 190, width: 460, height: 280 } });
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); await b.close(); process.exit(rows.every(Boolean) ? 0 : 1);
