// 第五章 · 虎豹骑：虎豹突阵（四骑、更重）、5-1 曹纯护驾与号令补员、5-2/5-3 偶尔出现、第二章西凉战法不受影响。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-hubao.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/new-content';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d) : '')); };
const save = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 2, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu', 'chibi'], ownedCities: [], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 5 };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('ChibiGameScene')";
const open = async (layout, stage) => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(layout + ' console ' + m.text()); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 60000 });
  await p.evaluate(st => { const g = window.__game; g.registry.set('chibiStage', st); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: st }); for (const s of g.scene.getScenes(true)) s.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('ChibiGameScene'); else { g.registry.set('pendingWarlord', 'ChibiGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); } }, stage);
  await p.waitForFunction(() => window.__game.scene.isActive('ChibiGameScene') && window.__game.scene.getScene('ChibiGameScene').xiliang, null, { timeout: 60000 });
  await p.waitForTimeout(1200);
  await p.evaluate(G0 => { const s = eval(G0); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate(); }, G);
  return p;
};
const skip = (p, t) => p.evaluate(async ([G0, t]) => { const s = eval(G0); for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; s.elapsed = t; await new Promise(r => setTimeout(r, 500)); return { mode: s.mode, raids: s.xiliang.activeRaids }; }, [G, t]);

for (const layout of ['mobile', 'desktop']) {
  const p = await open(layout, 1);
  const d = await p.evaluate(G0 => { const s = eval(G0), h = s.xiliang, def = h.hubaoDef(), cav = s.chapter.enemies.cavalry; return { name: s.chapter.name, isHubao: h.constructor.name, def: { hp: def.hp, dmg: def.damage, variant: def.variant, tint: def.tint, tex: def.walkVisual?.texture }, cav: { hp: cav.hp, dmg: cav.damage }, raid: h.raid }; }, G);
  ck(`[${layout}] 5-1 长坂突围启用虎豹骑：生命 = 骑兵 ×1.4、伤害 +2、用正式奔跑图（hubao_walk）`, d.name.includes('长坂') && d.def.variant === 'hubao' && d.def.hp === Math.round(d.cav.hp * 1.4) && d.def.dmg === d.cav.dmg + 2 && d.def.tex === 'hubao_walk' && d.def.tint === undefined, d);
  ck(`[${layout}] 虎豹突阵比西凉铁骑略重：四骑、撞人 20、预警 1 秒`, d.raid.riders === 4 && d.raid.damage === 20 && d.raid.warnMs === 1000, d.raid);
  // 突阵：四骑就位、亮道、冲过撞人
  const r0 = await p.evaluate(G0 => { const s = eval(G0); s.player.invulnUntil = 0; const id = s.xiliang.startRaid(s.combatNow); const riders = s.enemies.filter(e => e.active && e.def.variant === 'hubao'); riders.forEach(e => { e.invulnerable = true; }); return { id, n: riders.length, lane: !!s.children.getByName('hubao-raid-lane'), hp: s.player.hp }; }, G);
  ck(`[${layout}] 虎豹突阵：四骑并排就位并亮出冲锋道`, r0.id > 0 && r0.n === 4 && r0.lane, r0);
  await p.waitForTimeout(450); await p.screenshot({ path: `${out}/${layout}-hubao-raid.png` });
  let hit = null; for (let i = 0; i < 60; i++) { await p.waitForTimeout(100); hit = await p.evaluate(G0 => { const s = eval(G0); return { hp: s.player.hp, raids: s.xiliang.activeRaids }; }, G); if (hit.raids === 0) break; }
  await p.evaluate(G0 => { for (const e of eval(G0).enemies) e.invulnerable = false; }, G);
  ck(`[${layout}] 冲锋贯穿：站在道上的主将受伤，冲过后归入普通骑兵`, hit.hp < r0.hp && hit.raids === 0, { hit, before: r0.hp });
  // 排期：35 秒起自动突阵
  const sch = await skip(p, 40);
  ck(`[${layout}] 5-1 开打 35 秒后自动突阵`, sch.raids >= 1, sch);
  // 首领出场 → 四骑护驾；主将远离时守在曹纯身边
  const g = await p.evaluate(async G0 => { const s = eval(G0); for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate(); s.xiliang.raids.forEach(r => r.g.destroy()); s.xiliang.raids.length = 0; s.spawnBoss(); const b = s.boss; s.player.sprite.setPosition(b.x + 600, b.y + 600); await new Promise(r => setTimeout(r, 1500)); const guards = s.enemies.filter(e => e.active && e.def.variant === 'hubao'); return { boss: s.chapter.bossName, n: s.xiliang.guardCount, near: guards.every(e => Math.hypot(e.x - s.boss.x, e.y - s.boss.y) < 200) }; }, G);
  ck(`[${layout}] 曹纯出场：四骑虎豹骑护驾，主将不在时守在首领身边`, g.boss === '曹纯' && g.n === 4 && g.near, g);
  if (layout === 'mobile') { await p.evaluate(G0 => { const s = eval(G0); s.player.sprite.setPosition(s.boss.x, s.boss.y + 260); }, G); await p.waitForTimeout(400); }
  await p.screenshot({ path: `${out}/${layout}-hubao-guard.png` });
  // 主将靠近：护卫出击（离开首领身边）
  const atk = await p.evaluate(async G0 => { const s = eval(G0), b = s.boss; s.player.sprite.setPosition(b.x + 150, b.y); await new Promise(r => setTimeout(r, 1200)); const guards = s.enemies.filter(e => e.active && e.def.variant === 'hubao'); return { charging: guards.some(e => e.chargeState !== 'none'), toward: guards.some(e => Math.hypot(e.x - s.player.x, e.y - s.player.y) < 140) }; }, G);
  ck(`[${layout}] 主将靠近：护卫出击`, atk.charging || atk.toward, atk);
  // 护卫折损到 2 骑以下：25 秒后号令补 2 骑
  const reg = await p.evaluate(async G0 => { const s = eval(G0), h = s.xiliang; for (const e of s.enemies.filter(e => e.active && e.def.variant === 'hubao').slice(0, 3)) e.deactivate(); await new Promise(r => setTimeout(r, 200)); const before = h.guardCount; h.regroupAt = s.combatNow; await new Promise(r => setTimeout(r, 400)); return { before, after: h.guardCount }; }, G);
  ck(`[${layout}] 护卫少于 2 骑：曹纯号令补 2 骑`, reg.before < 2 && reg.after === reg.before + 2, reg);
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.player.sprite.setPosition(s.boss.x + 30, s.boss.y + 210); }, G); await p.waitForTimeout(2600);
  await p.screenshot({ path: `${out}/${layout}-hubao-closeup.png` }); await p.evaluate(G0 => { eval(G0).player.damageImmune = false; }, G);
  await p.close();
}
// 5-2：偶尔突阵（60 秒起每 30 秒），无护驾
{
  const p = await open('mobile', 2);
  const r = await skip(p, 30);
  const r2 = await skip(p, 65);
  const g = await p.evaluate(async G0 => { const s = eval(G0); s.spawnBoss(); await new Promise(r => setTimeout(r, 400)); return { guards: s.xiliang.guardCount, boss: s.chapter.bossName }; }, G);
  ck('5-2 赤壁鏖兵：60 秒前不突阵、60 秒后突阵、首领无护驾', r.raids === 0 && r2.raids >= 1 && g.guards === 0, { r, r2, g });
  await p.close();
}
await b.close();
const real = errors.filter(e => !/favicon|ERR_|net::/.test(e));
ck('无页面报错 / 控制台错误', real.length === 0, real.slice(0, 5));
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
