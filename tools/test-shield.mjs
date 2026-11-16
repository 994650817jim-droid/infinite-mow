// 盾牌兵两段血：先破盾才伤人、火攻破盾加倍、盾碎换步兵造型、飞熊军保留造型、粮草 / 城墙不带盾。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5187/ node tools/test-shield.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/new-content';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d) : '')); };
const save = { version: 8, yellowStages: 3, dongzhuoStages: 2, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: false }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 1, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 2 };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const open = async (layout, chapter, opts) => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(layout + ' console ' + m.text()); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(([chapter, opts]) => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', chapter, ...opts }); for (const s of g.scene.getScenes(true)) s.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('GameScene'); else { g.registry.set('loadBattle', true); g.scene.start('BootScene'); } }, [chapter, opts]);
  await p.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.getScene('GameScene').player, null, { timeout: 90000 });
  await p.waitForTimeout(1200);
  await p.evaluate(G0 => { const s = eval(G0); s.spawnTimer = s.eliteTimer = 1e9; s.player.damageImmune = true; for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate(); }, G);
  return p;
};

for (const layout of ['mobile', 'desktop']) {
  const p = await open(layout, 'hulao', { westStage: 1 });
  const r = await p.evaluate(G0 => {
    const s = eval(G0), pl = s.player, e = s.spawnEnemy('shield', pl.x + 300, pl.y, 1, true); e.invulnerable = false;
    const o = { max: e.shieldMax, hp0: e.maxHp, sheet0: e.walkSheet };
    s.hitEnemy(e, 10, s.combatNow, 'melee', false, false); o.after1 = { shield: e.shieldHp, hp: e.hp };
    s.hitEnemy(e, 6, s.combatNow, 'fire', false, false); o.afterFire = { shield: e.shieldHp, hp: e.hp };
    s.hitEnemy(e, 999, s.combatNow, 'melee', false, false); o.broke = { shield: e.shieldHp, hp: e.hp, active: e.active, sheet: e.walkSheet };
    if (e.active) { const h = e.hp; s.hitEnemy(e, 5, s.combatNow, 'melee', false, false); o.after = h - e.hp; }
    return o;
  }, G);
  ck(`[${layout}] 刀盾兵出场带盾：盾值 = 生命 ×0.8`, r.max === Math.round(r.hp0 * .8), r);
  ck(`[${layout}] 盾没破：伤害先打盾，本体只吃一成`, r.after1.shield === r.max - 10 && r.hp0 - r.after1.hp === 1, r.after1);
  ck(`[${layout}] 火攻打盾加倍`, r.after1.shield - r.afterFire.shield === 12, r.afterFire);
  ck(`[${layout}] 重击打碎盾：盾值归零、本体只吃一成、换成步兵造型`, r.broke.shield === 0 && r.broke.active && r.broke.hp > 0 && r.broke.sheet !== r.sheet0 && /infantry/.test(r.broke.sheet), r.broke);
  ck(`[${layout}] 盾碎之后照常受伤`, r.after === 5, r);
  // 截图：一排刀盾兵，最左一个已碎盾
  await p.evaluate(G0 => { const s = eval(G0), pl = s.player; for (let i = 0; i < 4; i++) { const e = s.spawnEnemy('shield', pl.x - 120 + i * 80, pl.y - 140, 1, true); if (i === 0) s.hitEnemy(e, e.shieldMax + 1, s.combatNow, 'melee', false, false); if (i === 1) s.hitEnemy(e, Math.round(e.shieldMax / 2), s.combatNow, 'melee', false, false); } }, G);
  await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${layout}-shield-bars.png` });
  await p.close();
}
// 飞熊军：带盾（×0.7）、碎盾后保留飞熊造型；第一章刀盾兵也带盾；粮草不带盾
{
  const p = await open('mobile', 'hulao', { westStage: 2 });
  const f = await p.evaluate(G0 => { const s = eval(G0), pl = s.player, e = s.spawnEnemy('shield', pl.x + 200, pl.y, 1, true, s.xiliang.feixiongDef()); const max = e.shieldMax, sheet = e.walkSheet; s.hitEnemy(e, max + 1, s.combatNow, 'melee', false, false); return { max, hp: e.maxHp, sheet, after: e.walkSheet, shield: e.shieldHp }; }, G);
  ck('飞熊军：盾值 = 生命 ×0.7，碎盾后保留飞熊军造型', f.max === Math.round(f.hp * .7) && f.shield === 0 && f.after === f.sheet, f);
  await p.close();
}
{
  const p = await open('desktop', 'huangjin', { stage: 2 });
  const y = await p.evaluate(G0 => { const s = eval(G0), pl = s.player, e = s.spawnEnemy('shield', pl.x + 200, pl.y, 1, true); const supply = s.enemies.filter(x => x.active && x.isSupplySlot).map(x => x.shieldMax); return { max: e.shieldMax, kind: e.kind, supply }; }, G);
  ck('第一章刀盾兵同样带盾；粮草 / 物件不带盾', y.max > 0 && y.supply.every(m => m === 0), y);
  await p.close();
}
await b.close();
const real = errors.filter(e => !/favicon|ERR_|net::/.test(e));
ck('无页面报错 / 控制台错误', real.length === 0, real.slice(0, 5));
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
