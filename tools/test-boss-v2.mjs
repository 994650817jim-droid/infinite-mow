// 首领重设计样板（张角 / 吕布 / 袁术 / 曹仁）回归：招式能放、能躲 / 能打断、二阶段转场、?boss=old 回到旧版。电脑布局。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-boss-v2.mjs [zhangjiao lubu yuanshu caoren]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { openBoss } from './boss-v2-open.mjs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/boss-v2';
mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2), want = b => !only.length || only.includes(b);
const rows = []; const ck = (name, ok, info) => { rows.push({ name, ok: !!ok }); console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const wait = (p, ms) => p.waitForTimeout(ms);
async function page(boss, extra = '') {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const { scene } = await openBoss(p, BASE, boss, extra);
  const ev = (fn, arg) => p.evaluate(([g, f, a]) => { const s = window.__game.scene.getScene(g); return new Function('s', 'a', 'return (' + f + ')(s,a)')(s, a); }, [scene, fn.toString(), arg]);
  return { p, errs, ev };
}
try {
  if (want('zhangjiao')) {
    const { p, errs, ev } = await page('zhangjiao');
    ck('张角：重设计控制器接管', await ev(s => !!s.zhangjiao && s.bossDebug()?.moves.length === 4));
    await ev(s => { s.player.damageImmune = false; s.player.hp = s.player.maxHp = 9999; s.player.invulnUntil = 0; s.boss.sprite.setPosition(s.player.x + 220, s.player.y); s.zhangjiao.debug.force(0, s.combatNow); });
    await wait(p, 900); await p.screenshot({ path: OUT + '/zhangjiao-rain-warn.png' });
    await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s.zhangjiao.snapshot().phase === 'release' && s.bullets.some(x => x.active); }, null, { timeout: 8000 }).catch(() => {});
    const rain = await ev(s => ({ m: s.zhangjiao.metrics.rain, orbs: s.bullets.filter(x => x.active).length }));
    ck('张角·太平符雨：起手 + 弹道提示后放出符弹', rain.m >= 1 && rain.orbs >= 7, rain);
    await wait(p, 900);
    const hp0 = await ev(s => { s.player.hp = 9999; s.player.invulnUntil = 0; s.zhangjiao.debug.force(1, s.combatNow); return s.player.hp; });
    await wait(p, 600); await p.screenshot({ path: OUT + '/zhangjiao-thunder-warn.png' }); await wait(p, 1000);
    const th = await ev(s => ({ hp: s.player.hp, m: s.zhangjiao.metrics.thunder }));
    ck('张角·天雷：站着不动会被雷劈中', th.m === 1 && th.hp < hp0, th);
    await wait(p, 900);
    await ev(s => s.zhangjiao.debug.force(2, s.combatNow)); await wait(p, 1000);
    const pil = await ev(s => s.zhangjiao.snapshot());
    await p.screenshot({ path: OUT + '/zhangjiao-heaven-pillars.png' });
    ck('张角·黄天当立：立起 4 根符柱、开始吟唱', pil.pillars === 4 && pil.phase === 'release', pil);
    const st = await ev(s => { for (const q of s.zhangjiao.pillars) s.killEnemy(q.e); return 0; }); void st;
    await wait(p, 300);
    const stun = await ev(s => ({ snap: s.zhangjiao.snapshot(), mul: s.zhangjiao.takenMul }));
    ck('张角·黄天当立：4 根全碎 → 坠地眩晕、受伤 ×1.5', stun.snap.stunned && stun.mul === 1.5 && stun.snap.metrics.heavenBroken === 1, stun);
    await wait(p, 3400);
    const hp1 = await ev(s => { s.player.hp = 9999; s.player.invulnUntil = 0; s.zhangjiao.debug.force(2, s.combatNow); return s.player.hp; });
    await wait(p, 6000 + 700 + 900); await p.screenshot({ path: OUT + '/zhangjiao-heaven-ult.png' }); await wait(p, 900);
    const ult = await ev(s => ({ hp: s.player.hp, m: s.zhangjiao.metrics.heavenUlt }));
    ck('张角·黄天当立：没打断 → 九霄天雷，安全区外受伤', ult.m === 1 && ult.hp < hp1, { ult, hp1 });
    await wait(p, 1500);
    await ev(s => s.zhangjiao.debug.phase2(s.combatNow)); await wait(p, 200);
    const sh = await ev(s => ({ inv: s.boss.invulnerable, p2: s.zhangjiao.phase2, filter: !!s.children.getByName('boss-phase-filter') }));
    await p.screenshot({ path: OUT + '/zhangjiao-phase2-shift.png' });
    await wait(p, 1600);
    const sh2 = await ev(s => ({ inv: s.boss.invulnerable }));
    ck('张角·二阶段转场：无敌 1.5 秒 + 色调滤镜，之后解除', sh.inv && sh.p2 && sh.filter && !sh2.inv, { sh, sh2 });
    const g0 = await ev(s => { const g = s.zhangjiao.metrics.grid; s.zhangjiao.debug.force(3, s.combatNow); return g; }); await wait(p, 1000); await p.screenshot({ path: OUT + '/zhangjiao-grid.png' });
    const gridDone = await p.waitForFunction(g => { const z = window.__game.scene.getScene('GameScene').zhangjiao; return z.metrics.grid === g + 1 && !z.snapshot().grid; }, g0, { timeout: 15000 }).then(() => true, () => false);
    ck('张角·雷阵：三波亮格落雷放完', gridDone);
    ck('张角：无页面报错', !errs.length, errs);
    await p.close();
    const old = await page('zhangjiao', '&boss=old');
    ck('张角 ?boss=old：回到旧版', await old.ev(s => !s.zhangjiao));
    await old.p.close();
  }
  if (want('lubu')) {
    const { p, errs, ev } = await page('lubu');
    ck('吕布：重设计控制器接管', await ev(s => !!s.lubu?.kit && s.bossDebug()?.moves.length === 5));
    const hp0 = await ev(s => { s.player.damageImmune = false; s.player.hp = s.player.maxHp = 9999; s.player.invulnUntil = 0; s.boss.sprite.setPosition(s.player.x + 120, s.player.y); s.lubu.debug.force(0, s.combatNow); return s.player.hp; });
    await wait(p, 300); await p.screenshot({ path: OUT + '/lubu-combo-thrust.png' }); await wait(p, 2200);
    const c = await ev(s => ({ hp: s.player.hp, m: s.lubu.v2Metrics.combo, st: s.lubu.state }));
    ck('吕布·方天三连：三段放完，站着不动会挨打', c.m === 1 && c.hp < hp0, c);
    await wait(p, 900);
    const z0 = await ev(s => { s.boss.sprite.setPosition(s.player.x + 300, s.player.y); s.lubu.debug.force(1, s.combatNow); return { x: s.boss.x, y: s.boss.y }; });
    await wait(p, 500); await p.screenshot({ path: OUT + '/lubu-zigzag-warn.png' }); await wait(p, 1800);
    const z = await ev(s => ({ m: s.lubu.v2Metrics.zig, x: s.boss.x, y: s.boss.y, st: s.lubu.state }));
    ck('吕布·赤兔突袭：Z 字两折冲完', z.m === 1 && Math.hypot(z.x - z0.x, z.y - z0.y) > 150, { z0, z });
    await wait(p, 900);
    const hp2 = await ev(s => { s.player.hp = 9999; s.player.invulnUntil = 0; s.boss.sprite.setPosition(s.player.x + 320, s.player.y); s.lubu.debug.force(2, s.combatNow); return s.player.hp; });
    await wait(p, 1200); await p.screenshot({ path: OUT + '/lubu-aim.png' }); await wait(p, 800);
    const sh = await ev(s => ({ hp: s.player.hp, m: s.lubu.v2Metrics.shot }));
    ck('吕布·辕门射戟：站着不动被一箭贯穿', sh.m === 1 && sh.hp < hp2, sh);
    await wait(p, 900);
    // 躲射戟：锁定前 0.1 秒侧移
    const hp3 = await ev(s => { s.player.hp = 9999; s.player.invulnUntil = 0; s.boss.sprite.setPosition(s.player.x + 320, s.player.y); s.lubu.debug.force(2, s.combatNow); return s.lubu.v2Metrics.hits; });
    await p.waitForFunction(() => { const s = window.__game.scene.getScene('LubuGameScene'); return s.lubu.state === 'aim' && s.lubu.until - s.combatNow < 200; }, null, { timeout: 10000 }); await ev(s => { s.player.sprite.y += 90; }); await wait(p, 800);
    ck('吕布·辕门射戟：锁定后侧移可以躲开', await ev((s, h) => s.lubu.v2Metrics.hits === h && s.lubu.v2Metrics.shot === 2, hp3), {});
    await wait(p, 900);
    await ev(s => s.lubu.debug.phase2(s.combatNow)); await wait(p, 200);
    const ph = await ev(s => ({ p2: s.lubu.phase2, inv: s.boss.invulnerable, filter: !!s.children.getByName('boss-phase-filter') }));
    await p.screenshot({ path: OUT + '/lubu-phase2-shift.png' }); await wait(p, 1600);
    ck('吕布·二阶段「人中吕布」：转场无敌 + 滤镜，之后解除', ph.p2 && ph.inv && ph.filter && !(await ev(s => s.boss.invulnerable)), ph);
    const hp4 = await ev(s => { s.player.hp = 9999; s.player.invulnUntil = 0; s.boss.sprite.setPosition(s.player.x + 100, s.player.y); s.lubu.debug.force(4, s.combatNow); return s.player.hp; });
    await wait(p, 1300); await p.screenshot({ path: OUT + '/lubu-spin.png' }); await wait(p, 1500);
    const sp = await ev(s => ({ hp: s.player.hp, m: s.lubu.v2Metrics.spin }));
    ck('吕布·无双乱舞：贴身站着会被卷到', sp.m === 1 && sp.hp < hp4, sp);
    await wait(p, 1200);
    await ev(s => s.lubu.debug.force(3, s.combatNow)); await wait(p, 300);
    ck('吕布·魔神降世仍可释放', await ev(s => s.lubu.state.startsWith('ult')));
    ck('吕布：无页面报错', !errs.length, errs);
    await p.close();
  }
  if (want('yuanshu')) {
    const { p, errs, ev } = await page('yuanshu');
    ck('袁术：重设计控制器接管', await ev(s => s.bossDebug()?.moves[0] === '玉玺号令'));
    await ev(s => { s.player.damageImmune = false; s.player.hp = s.player.maxHp = 9999; s.player.invulnUntil = 0; s.bossDebug().force(0, s.combatNow); });
    await p.waitForFunction(() => window.__game.scene.getScene('ThirdGameScene').controller.snapshot().flags === 3, null, { timeout: 8000 }).catch(() => {});
    const f = await ev(s => s.controller.snapshot());
    await p.screenshot({ path: OUT + '/yuanshu-flags.png' });
    ck('袁术·玉玺号令：立起 3 面伪诏旗', f.flags === 3, f);
    await wait(p, 1800);
    ck('袁术·玉玺号令：旗在就召兵', await ev(s => s.controller.metrics.flagSummons >= 6));
    await ev(s => { for (const fl of s.controller.flags) s.killEnemy(fl.e); }); await wait(p, 200);
    ck('袁术·玉玺号令：打掉旗子就没了', await ev(s => s.controller.snapshot().flags === 0));
    await wait(p, 1500);
    const hp0 = await ev(s => { for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); s.player.mountGuard = undefined; s.player.hp = s.player.maxHp = 9999; s.player.invulnUntil = 0; s.bossDebug().force(1, s.combatNow); return s.player.hp; });
    // 金币引信期间一直清掉无敌 / 坐骑护体（别处的小伤会给主将短暂无敌，金币炸开时正好吃不到，测试偶发失败）
    for (let i = 0; i < 12; i++) { await ev(s => { s.player.invulnUntil = 0; s.player.mountGuard = undefined; for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); }); await p.waitForTimeout(100); } await p.screenshot({ path: OUT + '/yuanshu-coins.png' }); await p.waitForFunction(() => { const c = window.__game.scene.getScene('ThirdGameScene').controller.snapshot(); return c.metrics.coins >= 1 && c.coins === 0; }, null, { timeout: 8000 }).catch(() => {}); await wait(p, 100);
    const co = await ev(s => ({ hp: s.player.hp, snap: s.controller.snapshot() }));
    ck('袁术·金钱开路：金币闪完炸开，站着不动会被炸', co.snap.coins === 0 && co.hp < hp0 && co.snap.metrics.coinHits >= 1, co);
    await wait(p, 900);
    await ev(s => { for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); s.bossDebug().force(2, s.combatNow); }); await p.waitForFunction(() => window.__game.scene.getScene('ThirdGameScene').controller.snapshot().guards >= 3, null, { timeout: 8000 }).catch(() => {}); await wait(p, 100);
    const g = await ev(s => ({ snap: s.controller.snapshot(), mul: s.controller.incoming(false) }));
    await p.screenshot({ path: OUT + '/yuanshu-guards.png' });
    ck('袁术·亲军护驾：亲军在身边时受伤 -60%', g.snap.guards >= 3 && g.snap.guarded && Math.abs(g.mul - .4) < 1e-6, g);
    await wait(p, 1200);
    const d0 = await ev(s => { s.bossDebug().phase2(s.combatNow); return Math.hypot(s.boss.x - s.player.x, s.boss.y - s.player.y); });
    await wait(p, 200); await p.screenshot({ path: OUT + '/yuanshu-honey-shift.png' }); await wait(p, 3000);
    const fl = await ev(s => ({ snap: s.controller.snapshot(), d: Math.hypot(s.boss.x - s.player.x, s.boss.y - s.player.y) }));
    await p.screenshot({ path: OUT + '/yuanshu-honey-flee.png' });
    ck('袁术·二阶段「蜜水」：逃跑、拉开距离、沿途丢金币', fl.snap.phase2 && fl.snap.fleeing && fl.d > d0 && fl.snap.metrics.honeyCoins > 0, { d0, fl });
    const hpb = await ev(s => { s.__letDie = true; s.boss.hp = Math.floor(s.boss.maxHp * .2); s.controller.fleeUntil = s.combatNow + 50; return s.boss.hp; }); await p.waitForFunction(() => window.__game.scene.getScene('ThirdGameScene').controller.snapshot().metrics.escaped === 1, null, { timeout: 8000 }).catch(() => {});
    const es = await ev(s => ({ hp: s.boss.hp, snap: s.controller.snapshot() }));
    ck('袁术·二阶段：逃掉 → 回血 + 重召亲军', es.hp > hpb && es.snap.metrics.escaped === 1 && !es.snap.fleeing, { hpb, es });
    ck('袁术：无页面报错', !errs.length, errs);
    await p.close();
  }
  if (want('caoren')) {
    const { p, errs, ev } = await page('caoren');
    ck('曹仁：重设计控制器接管', await ev(s => s.bossDebug()?.moves[0] === '铁壁'));
    const g = await ev(s => { s.controller.next = s.combatNow + 1e9; return s.controller.snapshot(); });
    ck('曹仁·八门金锁：1 个生门 + 3 个死门', g.gates.filter(x => x === 'live').length === 1 && g.gates.filter(x => x === 'dead').length === 3, g);
    await wait(p, 300); await p.screenshot({ path: OUT + '/caoren-gates.png' });
    // 主将放进死门
    const hp0 = await ev(s => { const c = s.controller; s.player.damageImmune = false; s.player.hp = s.player.maxHp = 9999; s.player.invulnUntil = 0; s.boss.sprite.setPosition(c.cx, c.cy); const i = c.gates.indexOf('dead'), a = -Math.PI + (i + .5) * Math.PI / 4 + Math.PI / 8; s.player.sprite.setPosition(c.cx + Math.cos(a) * 200, c.cy + Math.sin(a) * 160); c.rotateAt = s.combatNow + 9000; return s.player.hp; });
    await wait(p, 2200);
    const dd = await ev(s => ({ hp: s.player.hp, gate: s.controller.playerGate }));
    ck('曹仁·八门金锁：站死门持续掉血', dd.gate === 'dead' && dd.hp < hp0, dd);
    const live = await ev(s => { const c = s.controller, i = c.gates.indexOf('live'), a = -Math.PI + (i + .5) * Math.PI / 4 + Math.PI / 8; s.player.sprite.setPosition(c.cx + Math.cos(a) * 200, c.cy + Math.sin(a) * 160); return { gate: c.playerGate, mul: c.incoming(false) }; });
    ck('曹仁·八门金锁：站生门伤害 +20%', live.gate === 'live' && Math.abs(live.mul - 1.2) < 1e-6, live);
    await ev(s => { const c = s.controller; s.player.sprite.setPosition(c.cx + 420, c.cy); s.boss.sprite.setPosition(s.player.x - 150, s.player.y); c.debug.force(0, s.combatNow); });
    await p.waitForFunction(() => { const c = window.__game.scene.getScene('ChibiGameScene').controller; return c.beat.move === 'wall' && c.beat.phase === 'release'; }, null, { timeout: 8000 }).catch(() => {}); await p.screenshot({ path: OUT + '/caoren-wall.png' });
    const front = await ev(s => s.controller.incoming(false));
    const back = await ev(s => { s.player.sprite.setPosition(s.boss.x - 150, s.boss.y); return s.controller.incoming(false); });
    ck('曹仁·铁壁：正面几乎免伤，绕到背后正常', Math.abs(front - .1) < 1e-6 && back >= 1, { front, back });
    await wait(p, 4500);
    const n0 = await ev(s => { for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); s.controller.debug.force(1, s.combatNow); return 0; });
    await wait(p, 900);
    ck('曹仁·坚守：4 名盾兵排成墙', await ev(s => s.enemies.filter(e => e.active && e.kind === 'shield').length >= 4), n0);
    await ev(s => s.controller.debug.phase2(s.combatNow)); await wait(p, 200);
    await p.screenshot({ path: OUT + '/caoren-phase2-shift.png' }); await wait(p, 1700);
    const p2 = await ev(s => ({ snap: s.controller.snapshot(), inv: s.boss.invulnerable }));
    ck('曹仁·二阶段「破阵」：死门变 4 个、转场后解除无敌', p2.snap.phase2 && p2.snap.gates.filter(x => x === 'dead').length === 4 && !p2.inv, p2);
    await p.screenshot({ path: OUT + '/caoren-phase2-gates.png' });
    ck('曹仁：无页面报错', !errs.length, errs);
    await p.close();
    const old = await page('caoren', '&boss=old');
    ck('曹仁 ?boss=old：回到旧版', await old.ev(s => !s.bossDebug()));
    await old.p.close();
  }
} finally { await b.close(); }
const bad = rows.filter(r => !r.ok).length;
console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`);
if (bad) process.exit(1);
