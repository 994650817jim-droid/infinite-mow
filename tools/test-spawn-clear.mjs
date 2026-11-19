// 刷兵不刷进墙里（全面检查 #7：1-3 有 17% 刷怪点落在侧墙 / 城墙里，3-1、2-1、7-2 也有）：每关正常刷兵一段时间，
// 记下每个刷出来的敌兵位置，断言离所有场景碰撞框（sishuiObstacles：关墙、侧墙、营栅、山崖…）至少主将身体半径那么远。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-spawn-clear.mjs [1-3,3-1,2-1,7-2]
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const CH = { 1: { key: 'GameScene', cfg: st => ({ chapter: 'huangjin', stage: st }) }, 2: { key: 'GameScene', cfg: st => ({ chapter: 'hulao', westStage: st }) }, 3: { key: 'ThirdGameScene', reg: 'thirdStage' }, 7: { key: 'ShuGameScene', reg: 'shuStage' } };
const STAGES = (process.argv[2] ?? '1-3,3-1,2-1,7-2').split(',');
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
for (const id of STAGES) {
  const [chn, stn] = id.split('-').map(Number), C = CH[chn];
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(id + ' ' + e.message.slice(0, 160)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0&story=off');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
  await p.evaluate(([C, st]) => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); let cfg = {}; if (C.reg) { s0.registry.set(C.reg, st); cfg = { thirdStage: st }; } else cfg = C.cfgv; s0.registry.set('runConfig', { character: 'zhaoyun', ...cfg }); for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'GameScene') s.scene.stop(); s0.scene.start(C.key); }, [{ key: C.key, reg: C.reg, cfgv: C.cfg?.(stn) }, stn]);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed < 6; }, C.key, { timeout: 120000 });
  const r = await p.evaluate(async k => {
    const s = window.__game.scene.getScene(k), P = s.player; P.damageImmune = true; const sp = [];
    const orig = s.spawnEnemy; s.spawnEnemy = function (...a) { const e = orig.apply(this, a); if (e?.active && !e.isSupplySlot && e.kind !== 'boss') sp.push([e.x, e.y]); return e; };
    const clear = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); } } };
    s.devTimeScale = 3; const t = performance.now(); let a = 0;
    while (performance.now() - t < 20000 && !s.over) { clear(); a += .08; window.__IM.setMove(Math.cos(a), Math.sin(a * .6)); await new Promise(r => setTimeout(r, 120)); }
    window.__IM.setMove(0, 0); s.devTimeScale = 1;
    const boxes = s.sishuiObstacles?.footprints ?? [], R = P.radius;
    const bad = sp.filter(([x, y]) => boxes.some(b => x > b.left - R && x < b.right + R && y > b.top - R && y < b.bottom + R));
    return { n: sp.length, boxes: boxes.length, bad: bad.length, ex: bad.slice(0, 4).map(q => q.map(Math.round)) };
  }, C.key);
  ck(`${id}：刷出来的敌兵都离碰撞框 ≥ 主将半径（不从墙里冒出来）`, r.n > 20 && r.bad === 0, r);
  await p.close();
}
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
