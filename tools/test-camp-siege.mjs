// 营寨攻坚（用户 11-20「和营寨太容易被摧毁了，需要设计一下」；data/campSiege、systems/CampSiege，设计见共享笔记 camp-siege-design.md）：
// 4-1 白马敌营：耐久按章节精锐血量、拼命砍也至少 ~15 秒（每秒上限）、火攻加成 / 远打打折 / 部曲减半；走近出守军、半血起火 + 伏兵、20% 守将出营、拆掉倒塌 + 宝石。
// 2-3 洛阳：五座破营目标营寨也加厚了，拆完照样完成目标。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-camp-siege.mjs   截图 assets/review/camp-siege/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/camp-siege'; mkdirSync(OUT, { recursive: true });
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
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.campSiege && s.elapsed < 8; }, key, { timeout: 120000 });
  return p;
}

// —— 4-1 白马：敌营 ——
{
  const p = await open('GuanduGameScene', ['guanduStage', 1], {});
  const r = await p.evaluate(async () => {
    const s = window.__game.scene.getScene('GuanduGameScene'), P = s.player, CS = s.campSiege, EC = s.enemyCamps, wait = ms => new Promise(r => setTimeout(r, ms));
    const clear = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') s.chooseRecruit?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); } } };
    clear(); s.updateSpawner = () => {}; if (s.traits) s.traits.pick = () => null; P.damageImmune = true; P.weapons.forEach(w => { w.cooldownLeft = 1e9; }); if (s.fortunes) s.fortunes.schedule.forEach(e => { e.fired = true; });
    if (s.sishuiPass) s.sishuiPass.tents.forEach(t => { t.at = 1e15; });
    const R = (await import('/src/data/campSiege.ts')).CAMP_SIEGE;
    const [c0, c1] = EC.camps, e0 = c0.enemy, e1 = c1.enemy, eliteHp = s.chapter.enemies.elite.hp * s.chapter.hpScale(s.elapsed) * (s.chapter.growth?.hp ?? 1);
    const hp = { max: e0.maxHp, want: Math.round(Math.max(R.tier.camp.minHp, eliteHp * R.tier.camp.eliteMul)), old: 180 };
    // 伤害倍率：另一座营，打小数（不碰上限）
    P.sprite.setPosition(c1.point.x, c1.point.y + 120); await wait(300); clear();
    const h = () => e1.hp, hit = (d, src, ally) => { const b = h(); s.hitEnemy(e1, d, s.combatNow, src, ally, !ally); return Math.round((b - h()) * 10) / 10; };
    const near = hit(10, 'melee', false), fire = hit(10, 'fire', false), ally = hit(10, 'melee', true);
    P.sprite.setPosition(c1.point.x, c1.point.y + 420); await wait(200); const far = hit(10, 'arrow', false);
    // 拼命砍营 0：每 60ms 砍 1e6，看多久拆掉；途中看守军 / 半血伏兵 / 守将
    P.sprite.setPosition(c0.point.x, c0.point.y + 150); await wait(400); clear();
    const t0 = s.combatNow, en0 = s.enemies.filter(e => e.active && !e.isSupplySlot).length; let hp3 = null, burnAt = null, capAt = null, burnShot = false;
    for (let i = 0; i < 1500 && e0.active && e0.spawnId === c0.life; i++) {
      clear(); P.sprite.setPosition(c0.point.x, c0.point.y + 150);
      for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.def = { ...e.def, speed: 0, damage: 0 };
      s.hitEnemy(e0, 1e6, s.combatNow, 'melee', false, true);
      const t = s.combatNow - t0, k = e0.hp / e0.maxHp;
      if (hp3 === null && t >= 3000) hp3 = Math.round((1 - k) * 100);
      if (burnAt === null && CS.stats.burns) burnAt = Math.round(t / 100) / 10;
      if (capAt === null && CS.stats.captains) capAt = Math.round(t / 100) / 10;
      if (CS.stats.burns && !burnShot && k < .42) { burnShot = true; window.__shotNow = true; await wait(900); window.__shotNow = false; }
      await wait(60);
    }
    const secs = Math.round((s.combatNow - t0) / 100) / 10;
    await wait(500);
    return { hp, near, fire, ally, far, secs, hp3, burnAt, capAt, stats: { ...CS.stats }, destroyed: c0.destroyed, gems: s.gems?.filter?.(g => g.active).length ?? null, collapseFx: true };
  });
  ck('耐久按章节：营寨 = 本章精锐 ×9（至少 900），原来固定 180', Math.abs(r.hp.max - r.hp.want) <= r.hp.want * .02 && r.hp.max >= 900, r.hp);
  ck('伤害：火攻 ×1.5、远打（> 200）×0.6、部曲 ×0.5、贴近普攻 ×1', r.near === 10 && r.fire === 15 && r.ally === 5 && r.far === 6, { near: r.near, fire: r.fire, ally: r.ally, far: r.far });
  ck('拼命砍（每 0.06 秒 100 万伤害）也要打约 15 秒才拆掉；3 秒时最多掉 ~30%', r.destroyed && r.secs >= 13 && r.secs <= 20 && r.hp3 <= 32, { secs: r.secs, hp3: r.hp3 });
  ck('走近出守军、半血起火 + 伏兵 + 号角、20% 守将出营、拆掉倒塌', r.stats.guards >= 3 && r.stats.burns >= 1 && r.stats.ambush >= 3 && r.stats.captains >= 1 && r.stats.collapses >= 1 && r.burnAt < r.capAt, r.stats);
  await p.close();
}
// —— 截图：4-1 敌营半血起火、伏兵出营 ——
{
  const p = await open('GuanduGameScene', ['guanduStage', 1], {});
  await p.evaluate(async () => {
    const s = window.__game.scene.getScene('GuanduGameScene'), P = s.player, CS = s.campSiege, c = s.enemyCamps.camps[0], e = c.enemy, wait = ms => new Promise(r => setTimeout(r, ms));
    const clear = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); } };
    s.updateSpawner = () => {}; P.damageImmune = true; P.weapons.forEach(w => { w.cooldownLeft = 1e9; }); if (s.fortunes) s.fortunes.schedule.forEach(x => { x.fired = true; }); if (s.sishuiPass) s.sishuiPass.tents.forEach(t => { t.at = 1e15; });
    for (const x of s.enemies) if (x.active && !x.isSupplySlot) x.deactivate();
    P.sprite.setPosition(c.point.x + 40, c.point.y + 110); await wait(400);
    for (let i = 0; i < 400 && !CS.stats.burns; i++) { clear(); P.sprite.setPosition(c.point.x + 40, c.point.y + 110); s.hitEnemy(e, 1e6, s.combatNow, 'fire', false, true); for (const x of s.enemies) if (x.active && !x.isSupplySlot) x.def = { ...x.def, speed: 0, damage: 0 }; await wait(60); }
    for (const x of s.enemies) if (x.active && !x.isSupplySlot) x.def = { ...x.def, speed: 0, damage: 0 };
    await wait(700);
  });
  await p.screenshot({ path: `${OUT}/camp-burning.png` });
  await p.close();
}
// —— 2-3 洛阳：破营目标营寨加厚，拆完照样完成目标 ——
{
  const p = await open('GameScene', null, { chapter: 'hulao', westStage: 3 });
  const r = await p.evaluate(async () => {
    const s = window.__game.scene.getScene('GameScene'), wait = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 40 && !s.luoyangCamps; i++) await wait(250);
    const o = s.objective, CS = s.campSiege; if (!o) return { none: true };
    const tents = [...o.standing], hp = tents.map(t => Math.round(t.maxHp)), camps = tents.every(t => CS.isCamp(t)), guards0 = CS.stats.guards;
    const clear = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); } };
    for (const t of tents) { clear(); t.hp = 0; s.killEnemy(t); await wait(150); }
    for (let i = 0; i < 20 && !o.done; i++) { clear(); await wait(200); }
    return { hp, camps, guardsSpawned: CS.stats.guards - guards0, done: !!o.done, left: o.standing.length };
  });
  ck('2-3 五座营寨都套营寨攻坚（耐久 ≥ 900，自带守军不另刷），拆完照样完成破营目标', r.camps && r.hp.length === 5 && r.hp.every(h => h >= 900) && r.guardsSpawned === 0 && r.done && r.left === 0, r);
  await p.close();
}
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
