// 首领冲锋撞兵（平衡会话审计 S8：冲过兵阵几乎不伤兵）：1-1 张梁「人公冲阵」冲过一排刀盾兵。
//  ① 满血士兵：每人被判定一次、扣约一半血（40–60%），一个不死，并被推开一点
//  ② 正在近战（刚挨过小兵、受击间隔没过）的士兵照样被撞到——原来的 bug：按冲锋起点时间结算，这些兵全被跳过
//  ③ 残血兵阵：一次冲锋最多打死 3 个，其余留 1 血（不一冲清屏）
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-boss-charge-troops.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
  await p.goto(BASE + '?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 1 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
  await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await p.waitForTimeout(1500);
  await ev(s => { s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); s.spawnBoss(); });
  for (let i = 0; i < 40 && !(await ev(s => !!s.moveset && !!s.boss?.active)); i++) await p.waitForTimeout(150);
  // 一次冲锋：士兵排在首领与主将之间的冲锋道上，起手期间钉住位置；setup(u, i) 设每个兵的初始状态
  const charge = (n, setup) => p.evaluate(async ([S0, n, setup]) => {
    const s = eval(S0), pl = s.player, bo = s.boss, mv = s.moveset, prep = eval('(' + setup + ')');
    const calm = () => { s.spawnTimer = s.eliteTimer = 1e9; if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); };
    const ci = mv.phaseDef.moves.findIndex(m => m.kind === 'charge'); // 张梁一阶段的「人公冲阵」
    for (const u of s.allies) if (u.active) { u.hp = 0; u.active = false; u.release?.(); }
    s.legion.units.length = 0;
    s.legion.recruit('swordsman', n, true);
    const us = s.allies.filter(u => u.active).slice(-n);
    const pin = () => us.forEach((u, i) => { if (u.active) u.setPosition(pl.x + 95 + (i % 6) * 28, pl.y + (i < 6 ? 0 : 14)); });
    bo.sprite.x = pl.x + 320; bo.sprite.y = pl.y; bo.stunUntil = 0;
    for (const e of s.enemies) if (e.active && e !== bo && !e.isSupplySlot) e.deactivate();
    pin(); us.forEach((u, i) => { u.bossImmuneUntil = 0; prep(u, i, s.combatNow); });
    for (let t = 0; t < 40 && s.mode !== 'none'; t++) { calm(); await new Promise(r => setTimeout(r, 50)); }
    const hits0 = mv.metrics.troopHits; mv.debug.force(ci, s.combatNow);
    for (let t = 0; t < 80 && !mv.dash; t++) { calm(); pin(); us.forEach((u, i) => { u.bossImmuneUntil = 0; prep(u, i, s.combatNow); }); /* 起手期间首领近身碰到的不算（会触发 0.5 秒首领免伤，冲锋就跳过它） */ bo.sprite.x = pl.x + 320; bo.sprite.y = pl.y; await new Promise(r => setTimeout(r, 30)); }
    const y0 = us.map(u => u.y), started = !!mv.dash;
    for (let t = 0; t < 80 && mv.dash; t++) { calm(); us.forEach((u, i) => { if (u.active && !mv.dash?.hitTroops.has(u)) u.setPosition(pl.x + 95 + (i % 6) * 28, pl.y + (i < 6 ? 0 : 14)); }); await new Promise(r => setTimeout(r, 15)); } /* 还没被撞的兵钉在冲锋道上（不然 AI 会走开） */
    await new Promise(r => setTimeout(r, 200));
    return { ci, started, hits: mv.metrics.troopHits - hits0, loss: us.map(u => Math.round((1 - Math.max(0, u.active ? u.hp : 0) / u.maxHp) * 100)), dead: us.filter(u => !u.active).length, oneHp: us.filter(u => u.active && u.hp === 1).length, pushed: us.filter((u, i) => u.active && Math.abs(u.y - y0[i]) >= 10).length };
  }, [S, n, String(setup)]);
  // ① 满血
  const a = await charge(6, (u) => { u.hp = u.maxHp; });
  await p.screenshot({ path: 'assets/review/boss-moves/charge-troops.png' });
  ck('满血刀盾兵：冲锋道上每人被撞一次', a.started && a.hits === 6, a);
  ck('一次扣约一半血（冲锋 ~50%；紧挨首领的另吃一下近身碰撞，最多约 70%），一个不死', a.loss.every(x => x >= 40 && x <= 70) && a.dead === 0, a);
  ck('被撞的兵往两侧推开', a.pushed >= 4, a);
  // ② 正在近战（受击间隔没过）——原 bug
  const b2 = await charge(6, (u, i, now) => { if (!u._set) { u.hp = u.maxHp; u._set = 1; } u.hurtUntil = now + 5000; });
  ck('正在近战（刚挨过小兵、受击间隔没过）的兵照样被冲锋撞到', b2.started && b2.hits === 6 && b2.loss.every(x => x >= 40), b2);
  // ③ 残血兵阵：最多打死 3 个
  const c = await charge(12, (u) => { if (!u._set) { u.hp = Math.ceil(u.maxHp * .3); u._set = 1; } });
  ck('残血兵阵：一次冲锋最多打死 3 个，其余被撞的留 1 血', c.started && c.hits >= 4 && c.dead >= 1 && c.dead <= 3 && c.dead + c.oneHp === c.hits, c);
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
