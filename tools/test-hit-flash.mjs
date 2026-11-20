// 受击闪白限频（2026-11-20 用户截图 2-1 汜水关「敌将旁边一大块白色剪影」）：连击每 50ms 一下时，旧写法每下都重新涂白，
// 敌人 97% 的帧是一整块白剪影；现在闪 HIT_FLASH.ms 后要隔 HIT_FLASH.gapMs 才能再闪。
// 同一个西凉骑兵连挨 1.5 秒：旧参数（页面里把 gapMs 改 0、ms 改 70）和新参数各量一次白帧比例，并各截一张连击中的图。
// 用法：BASE=http://127.0.0.1:5743/ node tools/test-hit-flash.mjs → assets/review/white-silhouette/flash-{old,new}.png
import { chromium } from 'playwright'; import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5743/', OUT = 'assets/review/white-silhouette'; mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + ' · ' + JSON.stringify(d)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const errs = [];
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_chapter1_cleared', 'true'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${BASE}?dev=1&autostart=1&chapter=hulao&stage=1&layout=desktop&story=off`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS; }, null, { timeout: 180000, polling: 500 });
await p.waitForTimeout(1500);
const run = async (mode) => {
  const r = await p.evaluate(async mode => {
    const s = window.__game.scene.getScene('GameScene'), pl = s.player; s.__DEV_ACTIONS.closePopup?.(); pl.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9;
    const H = (await import('/src/entities/Enemy.ts')).HIT_FLASH, keep = { ...H };
    if (mode === 'old') { H.ms = 70; H.gapMs = 0; }
    for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); pl.weapons[0].cooldownLeft = 1e9;
    const e = s.spawnEnemy('cavalry', pl.x + 150, pl.y - 60, 1, true); e.hp = e.maxHp = 1e6; e.stunUntil = s.combatNow + 1e6;
    let white = 0, n = 0; window.__hit = setInterval(() => s.hitEnemy(e, 5, s.combatNow, 'melee'), 50);
    const t0 = performance.now(); while (performance.now() - t0 < 1500) { await new Promise(r => requestAnimationFrame(r)); n++; if (e.sprite.isTinted && e.sprite.tintFill) white++; }
    window.__restore = () => { clearInterval(window.__hit); Object.assign(H, keep); e.deactivate(); };
    return { whiteFrac: +(white / n).toFixed(2), frames: n };
  }, mode);
  await p.screenshot({ path: `${OUT}/flash-${mode}.png`, clip: { x: 500, y: 180, width: 420, height: 300 } });
  await p.evaluate(() => window.__restore());
  return r;
};
const old = await run('old'), now = await run('new');
ck('旧参数（每下都闪）：连击时敌人大半时间是白剪影', old.whiteFrac >= .5, old);
ck('新参数（闪完隔 160ms）：连击时白帧不到三成、不到旧参数一半，敌人本色看得见', now.whiteFrac <= .35 && now.whiteFrac > 0 && now.whiteFrac <= old.whiteFrac / 2, { old: old.whiteFrac, now: now.whiteFrac });
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
console.log(`\n${pass} pass / ${fail} fail`); process.exitCode = fail ? 1 : 0; await b.close();
