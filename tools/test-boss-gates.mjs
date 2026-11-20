// 「先拆营寨首领才可受伤 / 才出场」的关（统筹 11-20：平衡模拟 12-3 司马懿 17 将 7 将打输、首领剩 98–99% 血）：
// 12-3 五丈原营垒、10-2 夷陵连营、12-2 陈仓城门——营垒放下来了、在舆图 / 屏外有提示、主将走到营垒边上自动攻击（各种武器）能拆掉、
// 拆光后司马懿出营；坚守时打司马懿有说明。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-boss-gates.mjs [hero]   截图 assets/review/boss-gates/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/boss-gates'; mkdirSync(OUT, { recursive: true });
const HEROES = (process.argv[2] ?? 'zhaoyun,zhangfei,huangzhong').split(',');
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 600) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
async function open(key, reg, st, hero) {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  await p.addInitScript(h => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', h); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } }, hero);
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0&story=off');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
  await p.evaluate(([key, reg, st, hero]) => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.remove('thirdTransfer'); s0.registry.set(reg, st); s0.registry.set('runConfig', { character: hero, thirdStage: st }); for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'GameScene') s.scene.stop(); s0.scene.start(key); }, [key, reg, st, hero]);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed > 1 && s.elapsed < 10; }, key, { timeout: 120000 });
  await p.evaluate(k => { const s = window.__game.scene.getScene(k); window.__S = s; s.player.damageImmune = true;
    window.__calm = () => { for (let i = 0; i < 16 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'branch') s.chooseBranch?.(0); else if (s.mode === 'recruit') { s.chooseRecruit?.(0); s.__DEV_ACTIONS?.closePopup?.(); } else if (s.mode === 'parley') s.parley?.choose?.('execute'); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } } }; }, key);
  return p;
}
const calm = async (p, n = 4) => { for (let i = 0; i < n; i++) { await p.waitForTimeout(300); await p.evaluate(() => window.__calm()); } };

// —— 12-3 五丈原：每个武将走到营垒边上，只靠自动攻击，看多久拆光 ——
for (const hero of HEROES) {
  const p = await open('BeifaGameScene', 'beifaStage', 3, hero); await calm(p, 4);
  await p.evaluate(t => { window.__S.elapsed = t; window.__S.lastPickAt = -1e9; }, 9999); // 跳到首领
  for (let i = 0; i < 30; i++) { await calm(p, 2); if (await p.evaluate(() => !!window.__S.simayi?.forts.length)) break; }
  const r = await p.evaluate(async () => {
    const s = window.__S, smy = s.simayi, P = s.player, wait = ms => new Promise(r => setTimeout(r, ms));
    if (!smy) return { none: true };
    const forts = smy.forts.map(f => ({ x: Math.round(f.x), y: Math.round(f.y), hp: Math.round(f.maxHp), lock: !!f.lockTarget })), marks = (await import('/src/systems/SpawnTents.ts')).tentMarks(s).length;
    const b0 = smy.h.boss.hp / smy.h.boss.maxHp, t0 = s.combatNow; s.devTimeScale = 3; let order = 0;
    // 主将依次走到每座营垒南边 60 处站着（不手动打，只靠自动攻击；伏兵照常来）
    for (let i = 0; i < 900 && smy.phase === 'hold'; i++) {
      window.__calm(); const f = smy.forts.find(o => o.active); if (!f) break; P.sprite.setPosition(f.x, f.y + 70);
      await wait(100);
    }
    const secs = Math.round((s.combatNow - t0) / 100) / 10; s.devTimeScale = 1;
    return { forts, marks, phase: smy.phase, secs, fortsDown: smy.metrics.fortsDown, boss: Math.round(b0 * 100), ambush: smy.metrics.ambush, lvl: P.level, weapon: P.weapons[0]?.id };
  });
  await p.screenshot({ path: `${OUT}/12-3-${hero}.png` });
  console.log('INFO 12-3', hero, JSON.stringify(r));
  ck(`12-3 ${hero}：营垒放下了、可打（锁定）、在舆图登记；站营垒边自动攻击 ${r.secs} 秒拆光 → 司马懿出营`, r.forts?.length >= 3 && r.forts.every(f => f.lock) && r.marks >= r.forts.length && r.phase !== 'hold' && r.secs < 120, r);
  await p.close();
}
// —— 12-3 坚守时打司马懿：有说明 ——
{
  const p = await open('BeifaGameScene', 'beifaStage', 3, 'zhaoyun'); await calm(p, 4);
  await p.evaluate(t => { window.__S.elapsed = t; }, 9999);
  for (let i = 0; i < 30; i++) { await calm(p, 2); if (await p.evaluate(() => !!window.__S.simayi?.forts.length)) break; }
  const r = await p.evaluate(async () => { const s = window.__S, smy = s.simayi, wait = ms => new Promise(r => setTimeout(r, ms)); smy.remindAt = 0; /* 跳过登场后 6 秒的等待 */ const b = smy.h.boss, before = b.hp; s.hitEnemy(b, 100, s.combatNow, 'melee', false, true); await wait(300);
    const t = []; const walk = o => { if (o.type === 'Text' && o.visible && o.text) t.push(o.text); for (const c of o.list ?? []) walk(c); }; for (const o of s.children.list) walk(o);
    return { took: Math.round(before - b.hp), hint: t.filter(x => /营垒/.test(x)).slice(0, 4), label: smy.label }; });
  await p.screenshot({ path: `${OUT}/12-3-hold-hint.png` });
  ck('12-3 坚守时打司马懿：伤害 ×0.1，并提示「先拆营垒」', r.took > 0 && r.took <= 30 && r.hint.some(t => /先拆营垒/.test(t)), r);
  await p.close();
}
// —— 10-2 夷陵连营：营帐可打、登记、拆光朱然出营 ——
{
  const p = await open('YilingGameScene', 'yilingStage', 2, 'zhaoyun'); await calm(p, 6);
  const r = await p.evaluate(async () => {
    const s = window.__S, P = s.player, wait = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 30 && !s.campsPlaced; i++) await wait(200);
    const camps = s.camps.map(c => ({ hp: Math.round(c.maxHp), lock: !!c.lockTarget })), marks = (await import('/src/systems/SpawnTents.ts')).tentMarks(s).length, t0 = s.combatNow; s.devTimeScale = 3;
    for (let i = 0; i < 1500 && s.camps.some(c => c.active); i++) { window.__calm(); const c = s.camps.find(o => o.active); P.sprite.setPosition(c.x, c.y + 70); await wait(100); }
    s.devTimeScale = 1; await wait(1500);
    return { camps, marks, secs: Math.round((s.combatNow - t0) / 100) / 10, left: s.camps.filter(c => c.active).length, boss: !!s.boss?.active || s.bossSpawned };
  });
  console.log('INFO 10-2', JSON.stringify(r));
  ck(`10-2 连营：营帐可打（锁定）、舆图登记；站营边自动攻击 ${r.secs} 秒拆光 → 朱然出营`, r.camps.length >= 4 && r.camps.every(c => c.lock) && r.marks >= r.camps.length && r.left === 0 && r.boss, r);
  await p.close();
}
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${fail} failed`);
await b.close();
