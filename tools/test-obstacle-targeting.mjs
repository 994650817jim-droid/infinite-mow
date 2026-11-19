// 自动索敌打障碍物（用户 11-19「还有攻击逻辑也要加上打障碍物」；Enemy.breakable + GameScene.updateObstacleLocks / obstacleTarget）：
//  ① 身边没敌人 → 主将去打可破坏物件（粮垛）；② 身边有敌人 → 不理物件、先打敌人；③ 有敌人但物件挡在前进方向上 → 打挡路的；④ 2-3 关卡目标营寨仍然优先。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-obstacle-targeting.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/obstacles'; mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
async function open(cfg) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0&story=off');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
  await p.evaluate(c => { const s0 = window.__game.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.set('runConfig', { character: 'zhaoyun', ...c }); s0.scene.start('GameScene'); }, cfg);
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.elapsed > 1 && s.elapsed < 8; }, null, { timeout: 120000 });
  await p.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene'); window.__S = s; s.player.damageImmune = true; s.updateSpawner = () => {}; if (s.traits) s.traits.pick = () => null;
    window.__clear = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } } };
    window.__wipe = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); };
    window.__run = async ms => { const t = performance.now(); while (performance.now() - t < ms) { window.__clear(); await new Promise(r => setTimeout(r, 100)); } };
  });
  return p;
}
// 1-1：粮垛
{
  const p = await open({ chapter: 'huangjin', stage: 1 });
  const r = await p.evaluate(async () => {
    const s = window.__S, P = s.player, out = {};
    const depot = (dx, dy) => { const e = s.supplies.spawnDepot(P.x + dx, P.y + dy, 400, 16, 100); return e; };
    // ① 没敌人：打粮垛
    window.__wipe(); const c1 = depot(110, 0); const h1 = c1.hp; await window.__run(2500);
    out.alone = { breakable: c1.breakable, before: h1, after: c1.active ? Math.round(c1.hp) : 0 };
    // ② 有敌人（打不死）：不理粮垛，打敌人
    window.__wipe(); const c2 = depot(110, 60); const foe = s.spawnEnemy('infantry', P.x - 85, P.y, 1, true); foe.hp = foe.maxHp = 1e6; foe.def = { ...foe.def, speed: 0, damage: 0 };
    const h2 = c2.hp; await window.__run(2500); out.foes = { crateBefore: h2, crateAfter: c2.active ? Math.round(c2.hp) : 0, foeHit: foe.hp < 1e6, foeD: Math.round(Math.hypot(foe.x - P.x, foe.y - P.y)), foeActive: foe.active };
    // ③ 有敌人，但粮垛挡在前进方向上：打挡路的
    window.__wipe(); const f3 = s.spawnEnemy('infantry', P.x - 140, P.y, 1, true); f3.hp = f3.maxHp = 1e6; f3.def = { ...f3.def, speed: 0, damage: 0 };
    const c3 = depot(0, -100); const h3 = c3.hp; const t = performance.now();
    while (performance.now() - t < 2500) { window.__clear(); window.__IM.setMove(0, -1); P.sprite.setPosition(P.x, Math.max(P.y, c3.y + 70)); await new Promise(r => setTimeout(r, 100)); }
    window.__IM.setMove(0, 0); out.block = { before: h3, after: c3.active ? Math.round(c3.hp) : 0 };
    window.__wipe(); depot(100, 20); return out;
  });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/hero-breaks-depot.png` });
  ck('① 身边没敌人：主将自动去打可破坏物件（粮垛）', r.alone.breakable && r.alone.after < r.alone.before, r.alone);
  ck('② 身边有敌人：先打敌人，不理旁边的粮垛', r.foes.foeHit && r.foes.crateAfter === r.foes.crateBefore, r.foes);
  ck('③ 有敌人但粮垛挡在前进方向上：打挡路的粮垛', r.block.after < r.block.before, r.block);
  await p.close();
}
// 2-3：关卡目标营寨仍然优先（身边有敌人、有粮垛也一样）
{
  const p = await open({ chapter: 'hulao', westStage: 3 });
  await p.waitForFunction(() => window.__S.objective?.standing?.length > 0, null, { timeout: 30000 });
  const r = await p.evaluate(async () => {
    const s = window.__S, P = s.player; window.__wipe();
    const camp = s.objective.standing[0]; P.sprite.setPosition(camp.x + 60, camp.y + 90);
    const foe = s.spawnEnemy('infantry', P.x - 130, P.y + 40, 1, true); if (foe) { foe.hp = foe.maxHp = 1e6; foe.def = { ...foe.def, speed: 0, damage: 0 }; }
    const h0 = camp.hp; await window.__run(2500);
    return { before: Math.round(h0), after: camp.active ? Math.round(camp.hp) : 0, lock: camp.lockTarget };
  });
  ck('④ 2-3 关卡目标营寨仍然排第一（身边有敌人也先打营寨）', r.after < r.before, r);
  await p.close();
}
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
