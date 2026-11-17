// 场地环境互动第一批（src/systems/EnvInteractions.ts，env-interaction-proposal.md）：
// ① 火油桶：命中即点燃、引信后爆炸（范围伤害、首领减半、主将受伤）、连锁、地火（上限）；
// ② 敌军军旗：光环内敌人移速 / 伤害 ×1.1，砍倒后半径内敌人动摇减速；
// ③ 可破坏营帐：打塌掉宝石 / 回血、伏兵概率、塌营帐残骸。
// 电脑布局 1280×720，逐帧 game.step。连续帧存 assets/review/env/<项>/。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5197/ node tools/test-env.mjs [barrel,banner,tent]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', only = (process.argv[2] ?? 'barrel,banner,tent').split(',');
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true });
const open = async () => {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(G0 => {
    const g = window.__game, s = eval(G0); s.__DEV_ACTIONS.closePopup?.();
    s.player.damageImmune = false; s.player.invulnUntil = 0; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
    s.player.weapons.forEach(w => w.cooldownLeft = 1e9);
    g.loop.sleep(); window.__T = performance.now(); s.readMove = () => new Phaser.Math.Vector2(0, 0);
    window.__step = n => { for (let i = 0; i < n; i++) { window.__T += 1000 / 60; for (const w of s.player.weapons) w.cooldownLeft = 1e9; g.step(window.__T, 1000 / 60); } };
    window.__clip = () => { const c = g.canvas.getBoundingClientRect(), cam = s.cameras.main, k = c.width / g.scale.gameSize.width * cam.zoom, wv = cam.worldView; return { x: c.left + (s.player.x - wv.x) * k, y: c.top + (s.player.y - wv.y) * k, k }; };
    window.__dummy = (dx, dy, kind = 'infantry') => { const e = s.spawnEnemy(kind, s.player.x + dx, s.player.y + dy, 1, true); if (e) { e.hp = e.maxHp = 1e5; e.def = { ...e.def, speed: 0 }; } return e; };
  }, G);
  await p.evaluate(() => window.__step(5));
  // 测试只看自己放的物件：关掉自然生成，清掉已生成的（先记下本关原配置）
  await p.evaluate(G0 => { const s = eval(G0); if (s.env) { window.__cfg0 = { ...s.env.cfg }; s.env.cfg.barrels = s.env.cfg.banners = s.env.cfg.tents = false; for (const x of s.supplies.envProps()) x.enemy.deactivate(); s.env.banners = []; } }, G);
  return p;
};
const shotSeq = async (p, dir, name, n, every = 2, w = 420, h = 280, dx = 60) => { mkdirSync(`assets/review/env/${dir}`, { recursive: true }); for (let i = 0; i < n; i++) { await p.evaluate(e => window.__step(e), every); const r = await p.evaluate(() => window.__clip()); await p.screenshot({ path: `assets/review/env/${dir}/${name}-${String(i).padStart(2, '0')}.png`, clip: { x: r.x + (dx - w / 2) * r.k, y: r.y - h * r.k * .6, width: w * r.k, height: h * r.k } }); } };

if (only.includes('barrel')) {
  const p = await open();
  const r0 = await p.evaluate(G0 => { const s = eval(G0); return { env: !!s.env, cfg: window.__cfg0, art: s.textures.exists('env_props') && s.textures.exists('fx_explosion') }; }, G);
  ck('第一章开启火油桶 / 军旗 / 营帐，v2 道具与爆炸序列帧已加载', r0.env && r0.cfg.barrels && r0.cfg.banners && r0.cfg.tents && r0.art, r0);
  // 三个桶：一个在主将前方 140，另两个与之相距 70（连锁），木桩敌人围在桶边；主将在爆炸圈外
  const r1 = await p.evaluate(G0 => {
    const s = eval(G0), env = s.env, a = env.spawnForTest('barrel', 150, 0), b1 = env.spawnForTest('barrel', 215, 10), c = env.spawnForTest('barrel', 280, -10);
    window.__foes = [window.__dummy(150, 50), window.__dummy(210, -45), window.__dummy(290, 45)];
    window.__hp0 = window.__foes.map(e => e.hp);
    return { spawned: [a, b1, c].filter(Boolean).length, lit: 0 };
  }, G);
  await p.evaluate(() => window.__step(2));
  // 命中第一个桶（任何伤害即点燃）
  await p.evaluate(G0 => { const s = eval(G0); const barrel = s.supplies.envProps().find(x => x.env === 'barrel'); s.hitEnemy(barrel.enemy, 5, s.combatNow, 'melee'); }, G);
  const lit = await p.evaluate(G0 => ({ lit: eval(G0).children.list.filter(o => o.name === 'env-barrel-lit').length, barrels: eval(G0).supplies.envCount('barrel') }), G);
  ck('火油桶：命中即点燃（换成着火帧），引信未到不炸', lit.lit === 1 && r1.spawned === 3, { ...r1, ...lit });
  await shotSeq(p, 'barrel', 'chain', 36, 3);
  const r2 = await p.evaluate(G0 => { const s = eval(G0), e = s.env; return { stats: { ...e.stats }, fires: e.activeFires, dmg: window.__foes.map((f, i) => Math.round(window.__hp0[i] - f.hp)), left: s.supplies.envCount('barrel'), explosions: s.children.list.filter(o => o.name === 'env-explosion').length }; }, G);
  ck('火油桶：爆炸伤到周围敌人，连锁引爆另两个桶，留下地火', r2.stats.explosions === 3 && r2.stats.chains >= 2 && r2.dmg.every(d => d >= 60) && r2.left === 0 && r2.fires >= 1, r2);
  // 主将在爆炸圈内受伤、首领伤害减半由数据保证；地火上限
  const r3 = await p.evaluate(async G0 => {
    const s = eval(G0), pl = s.player, hp = pl.hp; pl.invulnUntil = 0; pl.damageImmune = false;
    s.env.spawnForTest('barrel', 40, 0); const b = s.supplies.envProps().find(x => x.env === 'barrel'); s.hitEnemy(b.enemy, 5, s.combatNow, 'melee');
    window.__step(90); const hurt = hp - pl.hp;
    for (let i = 0; i < 20; i++) { s.env.spawnForTest('barrel', -600 - i * 160, 300); }
    for (const x of s.supplies.envProps()) if (x.env === 'barrel') s.hitEnemy(x.enemy, 5, s.combatNow, 'melee');
    window.__step(100);
    return { hurt: Math.round(hurt), maxHp: Math.round(pl.maxHp), fires: s.env.activeFires };
  }, G);
  ck('火油桶：站在爆炸圈内的主将会受伤（约 12% 最大生命）；地火同时不超过 12 块', r3.hurt >= r3.maxHp * .1 && r3.fires <= 12, r3);
  await p.close();
}

if (only.includes('banner')) {
  const p = await open();
  const r = await p.evaluate(G0 => {
    const s = eval(G0), env = s.env, flag = window.__flag = env.spawnForTest('banner', 160, 0), near = window.__dummy(160, 80), far = window.__dummy(-500, 0);
    return { flag: !!flag, nearSpeed: env.speedMul(near), nearDmg: env.damageMul(near), farSpeed: env.speedMul(far), hp: flag?.hp };
  }, G);
  ck('军旗：光环内敌人移速 / 伤害 ×1.1，光环外不变', r.flag && Math.abs(r.nearSpeed - 1.1) < 1e-6 && Math.abs(r.nearDmg - 1.1) < 1e-6 && r.farSpeed === 1 && r.hp === 300, r);
  await shotSeq(p, 'banner', 'stand', 4, 4);
  await p.evaluate(G0 => { const s = eval(G0); s.hitEnemy(window.__flag, 400, s.combatNow, 'melee'); }, G);
  await shotSeq(p, 'banner', 'fall', 24, 2);
  const r2 = await p.evaluate(G0 => { const s = eval(G0), env = s.env, foes = s.enemies.filter(e => e.active && !e.isSupplySlot); const near = foes.find(e => Math.abs(e.x - s.player.x - 160) < 5); return { down: env.stats.bannersDown, shaken: env.stats.shaken, slow: near?.martialSlow, until: Math.round((near?.martialSlowUntil ?? 0) - s.combatNow), auraAfter: near ? env.speedMul(near) : null, fallen: s.children.list.filter(o => o.name === 'env-banner-falling').length }; }, G);
  ck('军旗：砍倒后旗倒地（扬尘），附近敌人动摇减速 ×0.85 约 6 秒，光环消失', r2.down === 1 && r2.shaken >= 1 && Math.abs(r2.slow - .85) < 1e-6 && r2.until > 5000 && r2.auraAfter === 1 && r2.fallen === 1, r2);
  await p.close();
}

if (only.includes('tent')) {
  const p = await open();
  const r = await p.evaluate(G0 => {
    const s = eval(G0), env = s.env; let made = 0, ambushTents = 0;
    // 连续打塌 12 顶营帐，统计掉落与伏兵（伏兵概率由位置哈希决定，确定可复现）
    for (let i = 0; i < 12; i++) { const t = env.spawnForTest('tent', 180 + (i % 4) * 10, -40 + i * 7); if (!t) continue; made++; const before = env.stats.ambush; s.hitEnemy(t, 999, s.combatNow, 'melee'); if (env.stats.ambush > before) ambushTents++; }
    window.__step(20);
    return { made, ...env.stats, ambushTents, gems: s.gems.filter(g => g.active).length, downs: s.children.list.filter(o => o.name === 'env-tent-down').length };
  }, G);
  ck('营帐：打塌后变成塌营帐残骸、掉经验宝石；部分掉回血、部分冲出 2～3 个伏兵', r.made === 12 && r.tentsDown === 12 && r.gems >= 30 && r.drops >= 1 && r.ambushTents >= 1 && r.ambushTents <= 9 && r.downs >= 1, r);
  await p.evaluate(G0 => { const s = eval(G0); for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); for (const o of s.children.list.filter(o => o.name === 'env-tent-down')) o.destroy(); for (const g of s.gems) if (g.active) { g.active = false; g.img.setVisible(false); } for (const pt of s.supplies.potions) if (pt.active) { pt.active = false; pt.image.setVisible(false); } }, G);
  await p.evaluate(G0 => { const s = eval(G0); window.__tent = s.env.spawnForTest('tent', 170, 0); }, G);
  await shotSeq(p, 'tent', 'stand', 3, 4);
  await p.evaluate(G0 => { const s = eval(G0); s.hitEnemy(window.__tent, 999, s.combatNow, 'melee'); }, G);
  await shotSeq(p, 'tent', 'collapse', 22, 2);
  await p.close();
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
