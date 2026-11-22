// 第四章 P2：焚粮（军心减伤、援军减少、奖励）、4-1→休整→4-2 跨关继承、文丑三技能、劫粮回血与辎重耗尽回退、4-2 胜利结算。
// 需要开发服务器 5173。用法：node tools/test-guandu-p2.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/guandu-p2';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const save = { version: 6, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 100, provisions: 200, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu'] };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GuanduGameScene')";
for (const layout of ['mobile', 'desktop']) {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'));
  await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('GuanduChapterScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('GuanduChapterScene')); await p.waitForTimeout(200);
  await p.evaluate(() => window.__game.scene.getScene('GuanduChapterScene').children.getByName('guandu-deploy').emit('pointerup'));
  await p.waitForFunction(() => window.__game.scene.isActive('GuanduGameScene') && window.__game.scene.getScene('GuanduGameScene').depots, null, { timeout: 15000 }); await p.waitForTimeout(400);
  // —— 4-1 焚粮 ——
  const d0 = await p.evaluate(G0 => { const s = eval(G0); s.spawnTimer = s.eliteTimer = 1e9; const d = s.depots; return { total: d.total, intact: d.intact, mul: +d.moraleMultiplier.toFixed(2), frames: d.depots.map(x => x.point.frame) }; }, G);
  ck(layout + ' 4-1 两处袁军粮垛，军心×2（受伤 ×0.76）', d0.total === 2 && d0.intact === 2 && d0.mul === .76 && d0.frames.every(f => f === 16), d0);
  const burn = await p.evaluate(G0 => { const s = eval(G0), d = s.depots, food = s.legion.food, e = d.depots[0].enemy; s.player.sprite.setPosition(e.x + 60, e.y + 30); s.hitEnemy(e, 1e4, s.combatNow, 'melee'); return { food: s.legion.food - food, burned: d.burned, intact: d.intact, mul: +d.moraleMultiplier.toFixed(2), label: d.depots[0].label.text, fire: d.depots[0].fire.length }; }, G);
  ck(layout + ' 焚一处粮垛：+12 钱币，军心×1（×0.88），起火', burn.food === 12 && burn.burned === 1 && burn.intact === 1 && burn.mul === .88 && burn.label.startsWith('粮草已焚') && burn.fire === 3, burn);
  await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${layout}-41-burn.png` });
  const boss1 = await p.evaluate(G0 => {
    const s = eval(G0); s.spawnBoss(); const c = s.controller, b = s.boss; let now = s.combatNow;
    b.sprite.setPosition(s.player.x + 160, s.player.y);
    const inc = +c.incoming(false).toFixed(2); c.index = 2; c.forceSkill(now); const siegeZones = c.zones.length;
    return { inc, siegeZones, label: c.label };
  }, G);
  ck(layout + ' 首领受伤乘军心倍率（×0.88）', boss1.inc === .88, boss1);
  ck(layout + ' 焚粮后号令攻城少一路（3→2）', boss1.siegeZones === 2, boss1);
  ck(layout + ' 首领技能条显示军心层数', boss1.label.includes('军心×1'), boss1.label);
  // 4-1 胜利 → 休整 → 进入 4-2（继承成长）
  await p.evaluate(G0 => { const s = eval(G0); s.player.weapons[0].level = 3; s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); }, G);
  for (let i = 0; i < 60; i++) { await p.waitForTimeout(150); const m = await p.evaluate(G0 => { const s = eval(G0); for (let k = 0; k < 40 && (s.mode === 'levelup' || s.mode === 'bossloot'); k++) s.chooseUpgrade(0); s.collectBossChests?.(); /* 2026-11-17：升级三选一、首领宝箱 */ return s.mode; }, G); if (m === 'rest') break; }
  const rest = await p.evaluate(async G0 => { const s = eval(G0), w = await import('/src/world/WorldStore.ts'); return { mode: s.mode, guandu: w.loadWorld().guanduStages, open2: w.arcStageUnlocked('guandu', 2) }; }, G);
  ck(layout + ' 4-1 告捷进入军帐休整，4-2 开放', rest.mode === 'rest' && rest.guandu === 1 && rest.open2, rest);
  await p.evaluate(G0 => { const s = eval(G0); window.__old = s.player; s.continueCampaign(); }, G);
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GuanduGameScene'); return s?.player && s.player !== window.__old && s.depots; }, null, { timeout: 15000 }); await p.waitForTimeout(400);
  const s2 = await p.evaluate(async G0 => { const s = eval(G0), w = await import('/src/world/WorldStore.ts'), a = w.loadWorld().active; return { stage: s.guanduStage, name: s.chapter.name, weapon: s.player.weapons[0].level, wagons: s.depots.total, frames: s.depots.depots.map(x => x.point.frame), mul: +s.depots.moraleMultiplier.toFixed(2), active: a && { arc: a.arc, stage: a.stage, state: a.state } }; }, G);
  ck(layout + ' 进入 4-2 延津诱敌，继承本命武器等级', s2.stage === 2 && s2.name === '4-2 延津诱敌' && s2.weapon >= 3 /* 击杀首领的升级三选一可能再升武器 */ && s2.active?.arc === 'guandu' && s2.active.stage === 2, s2);
  ck(layout + ' 4-2 四辆辎重车，军心×4（×0.52）', s2.wagons === 4 && s2.frames.every(f => f === 24) && s2.mul === .52, s2);
  // —— 文丑三技能 + 劫粮 ——
  const w = await p.evaluate(G0 => {
    const s = eval(G0); s.spawnTimer = s.eliteTimer = 1e9; s.spawnBoss(); const c = s.controller, b = s.boss, d = s.depots; let now = s.combatNow;
    const step = ms => { for (let t = 0; t < ms; t += 16) { now += 16; c.update(.016, now); } };
    b.sprite.setPosition(s.player.x + 150, s.player.y);
    c.index = 0; c.forceSkill(now); step(2600); c.index = 1; c.forceSkill(now); step(2400);
    // 劫粮：首领放在一辆辎重车旁，半血以便观察回血
    const wagon = d.depots.find(x => x.state === 'intact'); b.sprite.setPosition(wagon.point.x + 220, wagon.point.y); b.hp = b.maxHp * .6; const hpBefore = b.hp, food = s.legion.food;
    c.index = 2; c.forceSkill(now); const lootLabel = c.label; step(3200);
    const after = { hp: b.hp, intact: d.intact, food: s.legion.food - food, looted: d.depots.filter(x => x.state === 'looted').length, label: d.depots.find(x => x.state === 'looted')?.label.text };
    // 其余辎重全部焚毁后，劫粮改为号令骑兵
    for (const x of d.depots) if (x.state === 'intact') s.hitEnemy(x.enemy, 1e4, s.combatNow, 'melee');
    const before = s.enemies.filter(e => e.active && e.kind === 'cavalry').length; c.index = 2; c.forceSkill(now); const fallbackZones = c.zones.length; step(2400);
    return { m: { ...c.metrics }, hpBefore: Math.round(hpBefore), hpAfter: Math.round(after.hp), maxHp: b.maxHp, after, lootLabel, fallbackZones, cavalry: s.enemies.filter(e => e.active && e.kind === 'cavalry').length - before, mul: +d.moraleMultiplier.toFixed(2), burned: d.burned };
  }, G);
  ck(layout + ' 文丑回马枪、骑射、劫粮都释放', w.m.feint >= 1 && w.m.volley >= 1 && w.m.loot >= 2, w.m);
  ck(layout + ' 技能造成实际伤害', w.m.damage > 0, w.m.damage);
  ck(layout + ' 劫粮成功：抢走一辆、回血 8%、玩家无奖励', w.m.looted === 1 && w.after.looted === 1 && w.after.intact === 3 && w.hpAfter - w.hpBefore === Math.round(w.maxHp * .08) && w.after.food === 0 && w.after.label === '辎重被劫', w);
  ck(layout + ' 辎重焚尽后劫粮改为号令骑兵，军心归零', w.fallbackZones === 3 && w.cavalry >= 3 && w.mul === 1 && w.burned === 3, w);
  await p.evaluate(G0 => { const s = eval(G0); s.controller.index = 1; s.controller.forceSkill(s.combatNow); }, G);
  await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${layout}-42-wenchou.png` });
  // 4-2 胜利 → 结算 → 返回地图
  await p.evaluate(G0 => { const s = eval(G0); s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); }, G);
  for (let i = 0; i < 60; i++) { await p.waitForTimeout(150); const o = await p.evaluate(G0 => { const s = eval(G0); for (let k = 0; k < 40 && (s.mode === 'levelup' || s.mode === 'bossloot'); k++) s.chooseUpgrade(0); s.collectBossChests?.(); /* 2026-11-17：升级三选一、首领宝箱 */ return s.mode === 'rest'; }, G); if (o) break; }
  await p.waitForTimeout(300);
  const end = await p.evaluate(async G0 => { const s = eval(G0), w = await import('/src/world/WorldStore.ts'), v = w.loadWorld(); return { victory: s.victory, mode: s.mode, sub: s.resultTexts.subtitle.text, home: s.resultPanel.getByName('result-home')?.text, guandu: v.guanduStages, state: v.active?.state }; }, G);
  // P3 起 4-2 胜利进入军帐休整，下一关 4-3（4-3 流程见 test-guandu-p3）
  ck(layout + ' 4-2 胜利：guanduStages=2，进入军帐休整', end.victory && end.mode === 'rest' && end.guandu === 2 && end.state === 'settled' && end.sub.includes('进入军营休整'), end);
  await p.close();
}
ck('无 pageerror', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
