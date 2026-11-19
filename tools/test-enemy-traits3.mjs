// 各章新兵种第三批（第 7～10、12 章，data/enemyRoster + systems/EnemyTraits）：开一局，把 15 种逐个刷在主将身边查机制。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-enemy-traits3.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0&story=off');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
await p.evaluate(() => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.set('chibiStage', 2); s0.registry.set('runConfig', { character: 'zhaoyun', thirdStage: 2 }); for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'GameScene') s.scene.stop(); s0.scene.start('ChibiGameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('ChibiGameScene'); return window.__game.scene.isActive('ChibiGameScene') && s?.player && s.traits && s.elapsed > 1; }, null, { timeout: 120000 });
const r = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('ChibiGameScene'), T = s.traits, P = s.player, M = T.metrics, wait = ms => new Promise(r => setTimeout(r, ms));
  const R = (await import('/src/data/enemyRoster.ts')).ROSTER_MIX; R.maxTraitShare = 1; for (const k of Object.keys(R.roleCaps)) R.roleCaps[k] = 99;
  const clear = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); } } };
  s.updateSpawner = () => {}; T.pick = () => null;
  const wipe = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); };
  wipe(); P.damageImmune = false; window.__hurt = 0; const tk = P.takeDamage.bind(P); P.takeDamage = (d, n) => { const h = P.hp, ok = tk(d, n); window.__hurt += h - P.hp; P.hp = P.maxHp; P.alive = true; return ok; };
  const run = async (ms, fn) => { const t = performance.now(); while (performance.now() - t < ms) { P.invulnUntil = 0; clear(); fn?.(); await wait(100); } };
  const at = (id, dx, dy, inv = true) => { const e = T.spawnSpecial(id, dx === undefined ? undefined : { x: P.x + dx, y: P.y + dy }); if (e && inv) e.invulnerable = true; return e; };
  const hurt = async (ms, fn) => { const h0 = window.__hurt; await run(ms, fn); return Math.round(window.__hurt - h0); };
  const out = {};
  { const n0 = M.snared; at('liehu', 280, 0); let slow = 1; await run(5000, () => { slow = Math.min(slow, P.snareSpeedMul); }); out.liehu = { nets: M.nets, snared: M.snared - n0, slow }; wipe(); await run(3200); out.liehu.after = P.snareSpeedMul; }
  { const n0 = T.count('dongzhou'); const e = at('dongzhou', 260, 0); await run(800); const front = T.damageTakenMul(e); out.dongzhou = { group: T.count('dongzhou') - n0, front }; wipe(); }
  { const r0 = M.reveals, v0 = M.volleyZones; const e = at('funu', undefined, undefined, false); const hid = e.sprite.alpha; P.sprite.setPosition(e.x + 360, e.y); const h = await hurt(4500, () => { if (e.active && !T.st.get(e)?.hidden) e.invulnerable = true; }); out.funu = { hid, revealed: M.reveals - r0, zones: M.volleyZones - v0, hurt: h }; wipe(); }
  { const j = at('jijiu', 340, 0); const ally = s.spawnEnemy('infantry', j.x + 60, j.y, 1, true); ally.invulnerable = true; await run(2500, () => ally.sprite.setPosition(j.x + 60, j.y)); out.jijiu = { pulses: M.auraPulses, speed: T.speedMul(ally), damage: T.damageMul(ally), far: T.speedMul(at('liehu', -500, 0)) }; wipe(); }
  { P.sprite.setPosition(0, 900); /* 5-2 北边界是江（−500）：主将挪到南边，北面 760 处还在场内 */ const e = at('shanqi'); out.shanqi = { dy: e && Math.round(e.y - P.y) }; wipe(); P.sprite.setPosition(0, 0); }
  { const t0 = M.throws; at('pili', 520, 0); const h = await hurt(9000); out.pili = { throws: M.throws - t0, hurt: h }; wipe(); }
  { const n0 = T.count('kuibing'); at('kuibing', 400, 0); out.kuibing = { group: T.count('kuibing') - n0 }; wipe(); }
  { const r0 = M.reveals; const e = at('baiyi', undefined, undefined, false); const d0 = { alpha: e.sprite.alpha, inv: e.invulnerable, disguised: !!T.st.get(e)?.disguised }; P.sprite.setPosition(e.x + 150, e.y); await run(500); out.baiyi = { d0, revealed: M.reveals - r0, inv: e.invulnerable }; wipe(); }
  { const r0 = M.rolls; const e = at('leimu', 200, 0); const h = await hurt(4500, () => P.sprite.setPosition(e.x - 200, e.y)); out.leimu = { rolls: M.rolls - r0, hurt: h }; wipe(); }
  { const f0 = M.firepots, b0 = M.bursts; const e = at('huogong', 300, 0); await run(4500); e.invulnerable = false; s.hitEnemy(e, 1e7, s.combatNow, 'melee', false, false); await run(200); out.huogong = { firepots: M.firepots - f0, bursts: M.bursts - b0 }; wipe(); }
  { const r0 = M.reveals, b0 = M.bursts3; const e = at('linfu', undefined, undefined, false); P.sprite.setPosition(e.x + 330, e.y); await run(4500, () => { if (e.active && !T.st.get(e)?.hidden) e.invulnerable = true; }); out.linfu = { revealed: M.reveals - r0, bursts: M.bursts3 - b0 }; wipe(); }
  { const w0 = M.sweeps; const e = at('zhuran', 100, 0); const h = await hurt(3500, () => P.sprite.setPosition(e.x - 90, e.y)); out.zhuran = { sweeps: M.sweeps - w0, hurt: h }; wipe(); }
  { const boss = s.spawnEnemy('elite', P.x + 500, P.y, 1, true); boss.invulnerable = true; T.h.boss = () => boss; const e = at('huwei', 520, 60); await run(300); const near = T.damageTakenMul(e); boss.sprite.setPosition(P.x - 900, P.y); await run(100); const far = T.damageTakenMul(e); out.huwei = { near, far }; T.h.boss = () => null; wipe(); }
  { const l0 = M.leaps; const e = at('qiangbing', 250, 0); e.controlImmune = true; const h = await hurt(5000); out.qiangbing = { leaps: M.leaps - l0, hurt: h }; wipe(); }
  { const a0 = M.fireArrows, f0 = M.fires; at('huojian', 320, 0); await run(4500); out.huojian = { arrows: M.fireArrows - a0, fires: M.fires - f0 }; wipe(); }
  return out;
});
ck('巴蜀猎户：投网，中了主将减速 40%，3 秒后恢复', r.liehu.nets >= 1 && r.liehu.snared >= 1 && Math.abs(r.liehu.slow - .6) < .01 && r.liehu.after === 1, r.liehu);
ck('东州兵：一队 3～5 人盾墙，正面减伤', r.dongzhou.group >= 3 && r.dongzhou.front < .5, r.dongzhou);
ck('伏弩手：藏着 → 现身后在主将脚下标圈落箭', r.funu.hid < .3 && r.funu.revealed === 1 && r.funu.zones >= 1 && r.funu.hurt > 0, r.funu);
ck('五斗米祭酒：半径内友军移速 / 伤害 ×1.25，圈外不加', r.jijiu.pulses >= 1 && r.jijiu.speed === 1.25 && r.jijiu.damage === 1.25 && r.jijiu.far === 1, r.jijiu);
ck('魏军山地轻骑：从北面高处刷出', r.shanqi.dy < -600, r.shanqi);
ck('霹雳车：远处抛巨石，落点大圈砸到主将', r.pili.throws >= 1 && r.pili.hurt > 0, r.pili);
ck('七军溃兵：成群 5～7', r.kuibing.group >= 5, r.kuibing);
ck('白衣商旅兵：伪装（看得见、刀枪不入）→ 走近露刀', r.baiyi.d0.alpha === 1 && r.baiyi.d0.inv && r.baiyi.d0.disguised && r.baiyi.revealed === 1 && !r.baiyi.inv, r.baiyi);
ck('樊城擂木兵：直线预警后滚木碾过', r.leimu.rolls >= 1 && r.leimu.hurt > 0, r.leimu);
ck('吴军火攻兵：火罐落地留火，倒下爆燃', r.huogong.firepots >= 1 && r.huogong.bursts >= 1, r.huogong);
ck('林中伏弓：藏着 → 现身三连射', r.linfu.revealed === 1 && r.linfu.bursts >= 1, r.linfu);
ck('朱然亲军：扇形横扫', r.zhuran.sweeps >= 1 && r.zhuran.hurt > 0, r.zhuran);
ck('魏国虎卫：首领身边受伤减半，离开首领不减', r.huwei.near === .5 && r.huwei.far === 1, r.huwei);
ck('西凉羌兵：扑跳', r.qiangbing.leaps >= 1 && r.qiangbing.hurt > 0, r.qiangbing);
ck('火箭手：火箭落处留火', r.huojian.arrows >= 1 && r.huojian.fires >= 1, r.huojian);
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
