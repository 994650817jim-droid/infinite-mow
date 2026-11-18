// 打击感（2026-11-17）：震屏设置走 systems/BattleSettings（带内存缓存，测试经模块调用 setShakeLevel）。顿帧 / 震屏设置 / 首领破势 / 白色残血条 / 转阶段与击杀慢动作 / 火花池上限。电脑布局 1280×720。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-hit-feel.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
let pass = 0, fail = 0;
const check = (name, ok, info) => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name} · ${JSON.stringify(info)}`); };
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS && window.__game.scene.getScene('GameScene').hitFeel, null, { timeout: 60000 });
await p.waitForTimeout(1200);
await p.evaluate(async () => { (await import('/src/systems/BattleSettings.ts')).setShakeLevel('strong'); });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); s.spawnGem = () => {}; setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); }, 30); }, G);
// 帮手：强制暴击 / 不暴击地打一下
const helpers = `
  const s = ${G}, pl = s.player;
  const mk = (kind = 'infantry', dx = 60) => { const e = s.spawnEnemy(kind, pl.x + dx, pl.y, 1); e.hp = e.maxHp = 1e7; e.stunUntil = 1e12; return e; };
  const hit = (e, dmg, crit) => { s.debugCrit = crit; try { return s.hitEnemy(e, dmg, s.combatNow, 'melee', false, true); } finally { s.debugCrit = null; } };
  const wait = ms => new Promise(r => setTimeout(r, ms));`;

// 1) 暴击顿帧 + 冷却
const r1 = await p.evaluate(`(async () => { ${helpers}
  s.hitFeel.reset(); for (const w of pl.weapons) w.cooldownLeft = 1e9; await wait(400); const e = mk();
  const st0 = s.hitFeel.stats.critStops, tHit = performance.now(); hit(e, 10, true); const scaleNow = s.hitFeel.scale(tHit + 5), stopMs = Math.round(s.hitFeel.stopUntil - tHit); /* 按出手时刻判定（第一次建暴击字可能超过 32 毫秒） */ const st1 = s.hitFeel.stats.critStops;
  await wait(120); hit(e, 10, true); const st2 = s.hitFeel.stats.critStops;
  await wait(700); hit(e, 10, true); const st3 = s.hitFeel.stats.critStops;
  hit(e, 10, false); const st4 = s.hitFeel.stats.critStops;
  e.deactivate(); return { first: st1 - st0, within120ms: st2 - st1, after800ms: st3 - st2, nonCrit: st4 - st3, scaleNow, stopMs }; })()`);
check('暴击触发顿帧（时间倍率降到 ≤0.1）', r1.first === 1 && r1.scaleNow <= .1, r1);
check('顿帧冷却：0.12 秒内第二次暴击不再顿帧，0.8 秒后可再顿', r1.within120ms === 0 && r1.after800ms === 1 && r1.nonCrit === 0, r1);

// 2) 顿帧期间战斗时钟同步放慢（统一时间倍率）
const r2 = await p.evaluate(`(async () => { ${helpers}
  await wait(400); s.hitFeel.reset(); const c0 = s.combatNow, t0 = performance.now(); s.hitFeel.hitStop(400, true); await wait(300);
  const slowed = (s.combatNow - c0) / (performance.now() - t0); await wait(300); const c1 = s.combatNow, t1 = performance.now(); await wait(300);
  return { slowedRatio: +slowed.toFixed(3), normalRatio: +((s.combatNow - c1) / (performance.now() - t1)).toFixed(3), tweenScale: s.tweens.timeScale }; })()`);
check('顿帧期间战斗时钟按倍率放慢，结束后恢复', r2.slowedRatio < .25 && r2.normalRatio > .7, r2);

// 3) 震屏设置：强 / 弱 / 关
const r3 = await p.evaluate(`(async () => { ${helpers}
  const cam = s.cameras.main, out = {}, BS = await import('/src/systems/BattleSettings.ts');
  for (const lv of ['strong', 'weak', 'off']) { BS.setShakeLevel(lv); cam.shakeEffect.reset(); s.hitFeel.shake('big'); out[lv] = cam.shakeEffect.isRunning ? +cam.shakeEffect.intensity.x.toFixed(4) : 0; await wait(350); }
  BS.setShakeLevel('off'); cam.shakeEffect.reset(); cam.shake(200, .01); out.otherShakeOff = cam.shakeEffect.isRunning;
  BS.setShakeLevel('strong'); cam.shakeEffect.reset(); return out; })()`);
check('震屏设置生效：强 > 弱 = 强×0.5，关不震（其它震屏也受控）', r3.strong > 0 && Math.abs(r3.weak - r3.strong / 2) < 1e-4 && r3.off === 0 && r3.otherShakeOff === false, r3);

// 4) 首领：破势、白色残血条、半血转阶段慢动作、击杀慢动作
const r4 = await p.evaluate(`(async () => { ${helpers}
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  s.spawnBoss(); const boss = s.boss; boss.sprite.setPosition(pl.x + 90, pl.y); boss.maxHp = boss.hp = 10000; for (const w of pl.weapons) w.cooldownLeft = 1e9;
  await wait(600); s.hitFeel.reset(); const out = {};
  // 破势：一次打掉 20% 血 → 硬直值 120 ≥ 100
  const stun0 = boss.stunUntil, x0 = boss.x; hit(boss, 2000, false);
  out.breaks = s.bossStagger.breaks; out.gainMul = s.bossStagger.gainMul; out.stunned = boss.controlImmune || boss.stunUntil > s.combatNow;
  out.breakText = s.children.list.some(o => o.name === 'boss-break-text' && o.active);
  await wait(500); out.pushed = Math.round(Math.hypot(boss.x - x0, 0));
  // 白条：打掉 10% 后白条 > 当前血量，1.6 秒后缩回
  await wait(300); const rr = () => boss.hp / boss.maxHp; s.hudAcc = 1; hit(boss, 1000, false); await wait(150); s.hudAcc = 1; s.updateHud();
  out.trailAfterHit = +(s.bossStagger.trailRatio(rr(), performance.now(), 0) - rr()).toFixed(3);
  await wait(1700); s.hudAcc = 1; s.updateHud(); out.trailLater = +(s.bossStagger.trailRatio(rr(), performance.now(), 0) - rr()).toFixed(3);
  // 半血转阶段：70% → 45%
  boss.hp = boss.maxHp * .52; s.hitFeel.reset(); const sl0 = s.hitFeel.stats.slows; hit(boss, boss.maxHp * .05, false);
  out.phaseSlow = s.hitFeel.stats.slows - sl0; await wait(160); out.phaseScale = +s.hitFeel.scale().toFixed(2);
  await wait(500); out.phaseOver = s.hitFeel.scale();
  // 击杀：慢动作 0.5 秒
  { const t0 = performance.now(); while (boss.invulnerable && performance.now() - t0 < 4000) await wait(100); } // 转阶段时首领有短暂无敌（BossKit），等它结束再补刀
  s.hitFeel.reset(); boss.hp = 5; const sl1 = s.hitFeel.stats.slows; hit(boss, 50, false); out.deathSlow = s.hitFeel.stats.slows - sl1; out.deathScale = +s.hitFeel.scale().toFixed(2); out.bossDead = !boss.active;
  await wait(700); out.deathOver = s.hitFeel.scale();
  return out; })()`);
check('首领破势：满值后硬直、后退、「破势！」字样，下一轮累积变慢', r4.breaks === 1 && r4.stunned && r4.breakText && r4.pushed >= 10 && r4.gainMul < 1, r4);
check('白色残血条：受击后白条长于当前血量，约 1.6 秒后缩回', r4.trailAfterHit >= .05 && r4.trailLater < .01, r4);
check('半血转阶段：顿帧 + 慢动作，之后恢复正常速度', r4.phaseSlow === 1 && r4.phaseScale < .5 && r4.phaseOver === 1, r4);
check('击杀首领：0.5 秒慢动作后恢复', r4.deathSlow === 1 && r4.bossDead && r4.deathScale <= .35 && r4.deathOver === 1, r4);

// 5) 火花池上限：同一帧 150 次命中，可见火花不超过 28
const r5 = await p.evaluate(`(async () => { ${helpers}
  await wait(1500); for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  const es = []; for (let i = 0; i < 150; i++) { const a = i * .042; const e = s.spawnEnemy('infantry', pl.x + Math.cos(a) * 120, pl.y + Math.sin(a) * 90, 1); e.hp = e.maxHp = 1e7; es.push(e); }
  for (const e of es) hit(e, 5, true);
  return { live: s.feedback.liveSparks(s.combatNow), dropped: s.feedback.sparkStats.dropped, dmgTexts: s.dmgFx.filter(f => f.active).length }; })()`);
check('火花池上限：150 次暴击命中，同屏火花 ≤28、伤害数字 ≤40', r5.live <= 28 && r5.live > 0 && r5.dmgTexts <= 40, r5);

// 6) 菜单设置里有「震屏」一行，可切换
await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('MenuScene'); });
await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 30000 }); await p.waitForTimeout(800);
const r6 = await p.evaluate(async () => {
  const m = window.__game.scene.getScene('MenuScene'); (await import('/src/systems/BattleSettings.ts')).setShakeLevel('strong'); m.openHomeSettings();
  const row = m.children.getByName('home-settings-panel').list.find(o => o.name === 'settings-shake'); const inc = m.children.getByName('home-settings-panel').list.find(o => o.name?.startsWith('settings-row-') && o.name.endsWith('-inc') && Math.abs(o.y - row.y) < 2);
  const before = row.text; inc.emit('pointerdown'); const after1 = row.text, v1 = localStorage.getItem('im_shake'); inc.emit('pointerdown'); const v2 = localStorage.getItem('im_shake'); inc.emit('pointerdown'); const v3 = localStorage.getItem('im_shake');
  const panel = m.children.getByName('home-settings-panel'), close = panel.list.find(o => o.name === 'settings-close'), quitRowOverlap = Math.abs(close.y - row.y) < 30;
  return { before, after1, v1, v2, v3, overlap: quitRowOverlap };
});
check('设置「震屏 强 / 弱 / 关」一行可切换并保存', r6.before.includes('强') && r6.v1 === 'weak' && r6.v2 === 'off' && r6.v3 === 'strong' && !r6.overlap, r6);
await p.screenshot({ path: 'assets/review/hit-feel/settings-shake.png' });
check('无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`);
await b.close();
process.exit(fail ? 1 : 0);
