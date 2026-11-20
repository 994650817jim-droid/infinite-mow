// 刷兵帐篷不拆就一直出兵（用户 11-19「关于生成兵的帐篷应该会多刷新兵直到被摧毁」；data/spawnTents、systems/SpawnTents）：
// 4-1 白马：敌营（EnemyCamps）一直出兵、本营存活不超上限（满了暂停，杀了再补）、受损出得更急、首领出场后减半、
// 屏外边缘有提示、舆图登记；拆营后停兵、起火、给粮。2-3 洛阳：破营目标照旧计数（不受影响），营寨援兵也按新规则。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-spawn-tents.mjs   截图 assets/review/spawn-tents/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/spawn-tents'; mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
async function open(key, reg, cfg) {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on('pageerror', e => errors.push(key + ' ' + e.message.slice(0, 160)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0&story=off');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
  await p.evaluate(([key, reg, cfg]) => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.remove('thirdTransfer'); if (reg) s0.registry.set(reg[0], reg[1]); s0.registry.set('runConfig', { character: 'zhaoyun', ...cfg }); for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'GameScene') s.scene.stop(); s0.scene.start(key); }, [key, reg, cfg]);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed < 8; }, key, { timeout: 120000 });
  return p;
}
const quiet = `const s = window.__game.scene.getScene(KEY), P = s.player, wait = ms => new Promise(r => setTimeout(r, ms));
  const clear = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') s.chooseRecruit?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); } } };
  clear(); s.updateSpawner = () => {}; if (s.traits) s.traits.pick = () => null; P.damageImmune = true; P.weapons.forEach(w => { w.cooldownLeft = 1e9; }); if (s.legion) s.legion.units?.forEach?.(u => u.deactivate?.());`;

// —— 4-1 白马：敌营 ——
{
  const p = await open('GuanduGameScene', ['guanduStage', 1], {});
  const r = await p.evaluate(async q => { const KEY = 'GuanduGameScene'; eval(q.replace('KEY', 'KEY'));
    const s = window.__game.scene.getScene(KEY), P = s.player, wait = ms => new Promise(r => setTimeout(r, ms)), EC = s.enemyCamps, R = (await import('/src/data/spawnTents.ts'));
    const clear = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') s.chooseRecruit?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); } } };
    if (s.sishuiPass) s.sishuiPass.tents.forEach(t => { t.at = 1e15; }); // 只测敌营（关前营帐另用同一套规则）
    const c = EC.camps[0], ch = s.tentCtx().chapter(), cap = R.SPAWN_TENT.live(ch);
    // 主将站到营前 300（在激活范围内），敌兵不动、不伤人
    P.sprite.setPosition(c.point.x, c.point.y + 300); s.devTimeScale = 4;
    const freeze = () => { for (const m of c.members) { m.enemy.def = { ...m.enemy.def, speed: 0, damage: 0 }; } };
    let maxLive = 0, gaps = [], last = EC.stats.squads, t0 = performance.now();
    while (performance.now() - t0 < 16000) { clear(); freeze(); P.sprite.setPosition(c.point.x, c.point.y + 300); maxLive = Math.max(maxLive, c.members.length); if (EC.stats.squads !== last) { last = EC.stats.squads; gaps.push(Math.round(c.next - s.combatNow)); } await wait(100); }
    const full = { squads: EC.stats.squads, live: c.members.length, maxLive, cap, paused: EC.stats.paused > 0, gap: gaps[0], label: c.label.text };
    // 杀光本营兵：会再补
    for (const m of c.members) m.enemy.deactivate(); const sq0 = EC.stats.squads; t0 = performance.now();
    while (performance.now() - t0 < 6000 && EC.stats.squads === sq0) { clear(); P.sprite.setPosition(c.point.x, c.point.y + 300); await wait(100); }
    const refill = EC.stats.squads > sq0;
    // 受损更急、首领出场后减半：看下一队间隔
    const nextGap = async () => { for (const m of c.members) m.enemy.deactivate(); const sq = EC.stats.squads, t = performance.now(); while (performance.now() - t < 9000 && EC.stats.squads === sq) { clear(); P.sprite.setPosition(c.point.x, c.point.y + 300); await wait(50); } return Math.round(c.next - s.combatNow); };
    c.enemy.hp = c.enemy.maxHp * .4; const hurt = await nextGap();
    c.enemy.hp = c.enemy.maxHp; const prevBoss = s.bossSpawned; s.bossSpawned = true; const boss = await nextGap(); s.bossSpawned = prevBoss;
    // 屏外提示：往下退 820（还在激活范围、但营在屏幕外）
    P.sprite.setPosition(c.point.x, c.point.y + 820); s.devTimeScale = 1; await wait(500);
    const hints = s.tentHints?.stats.shown ?? 0, marks = (await import('/src/systems/SpawnTents.ts')).tentMarks(s).length;
    P.sprite.setPosition(c.point.x, c.point.y + 300); await wait(400);
    return { ch, full, refill, base: R.SPAWN_TENT.intervalMs(ch), hurt, boss, hints, marks };
  }, quiet);
  await p.screenshot({ path: `${OUT}/camp-spawning.png` });
  ck('敌营不拆就一直出兵：本营存活到上限暂停（不超），杀光了会再补', r.full.squads >= 2 && r.full.maxLive <= r.full.cap && r.full.maxLive >= r.full.cap - 1 && r.full.paused && r.refill, r);
  ck('间隔按章节：受损（< 50%）×0.6，首领出场后 ×2', Math.abs(r.hurt - r.base * .6) < 300 && Math.abs(r.boss - r.base * 2) < 400, { base: r.base, hurt: r.hurt, boss: r.boss });
  ck('舆图登记了刷兵帐篷，营在屏外时边缘有小提示', r.marks >= 2 && r.hints >= 1, { marks: r.marks, hints: r.hints });
  const d = await p.evaluate(async () => {
    const s = window.__game.scene.getScene('GuanduGameScene'), EC = s.enemyCamps, c = EC.camps[0], wait = ms => new Promise(r => setTimeout(r, ms));
    const food0 = s.legion.food; c.enemy.hp = 0; s.killEnemy(c.enemy); /* 营寨攻坚有每秒掉血上限（CampSiege），这里直接拆 */ await wait(300);
    const fire = s.children.list.some(o => o.name === 'tent-burn'); const sq = EC.stats.squads; s.devTimeScale = 4; await wait(6000); s.devTimeScale = 1;
    return { destroyed: c.destroyed, grain: s.legion.food - food0, fire, more: EC.stats.squads - sq, label: c.label.text, alive: EC.camps.filter(x => !x.destroyed).length };
  });
  await p.screenshot({ path: `${OUT}/camp-destroyed.png` });
  ck('拆营：停兵、起火、+8 粮', d.destroyed && d.grain >= 8 && d.fire && d.more === 0, d);
  await p.close();
}

// —— 2-3 洛阳：破营目标照旧计数 ——
{
  const p = await open('GameScene', null, { chapter: 'hulao', westStage: 3 });
  const r = await p.evaluate(async () => {
    const s = window.__game.scene.getScene('GameScene'), wait = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 40 && !s.luoyangCamps; i++) await wait(250);
    const o = s.objective, L = s.luoyangCamps; if (!o || !L) return { none: true };
    const before = { standing: o.standing.length, max: o.snapshot?.().max ?? o.max };
    const clear = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); } };
    const t = o.standing[0]; clear(); t.hp = 0; s.killEnemy(t); for (let i = 0; i < 20 && !L.stats.burned; i++) { clear(); await wait(200); }
    return { before, after: o.standing.length, cur: o.snapshot?.().cur ?? o.cur, burned: L.stats.burned, done: !!o.done, mode: s.mode, camps: L.camps.map(c => c.destroyed), sameTent: L.camps.some(c => c.tent === t) };
  });
  ck('2-3 破营目标不受影响：5 座营寨，打掉 1 座计 1、营寨起火停兵', r.before?.standing === 5 && r.after === 4 && r.burned === 1 && !r.done, r);
  await p.close();
}
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
