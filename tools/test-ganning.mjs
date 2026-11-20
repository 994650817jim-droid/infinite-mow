// P3 甘宁（p3-heroes-plan.md）：锦帆铁索钩——钩线上的敌兵挨打并被拉到身边、随后横扫；每第 3 钩铁索烧红沿索留火；
// 被动「锦帆」被钩过的敌兵被击杀攒 1 点，满 12 点「百骑劫营」6 秒（移速 +30%、每钩都烧红）；
// 分支「夜袭点火」（每钩都烧红、着火的敌兵拉来爆燃）/「百骑劫魏营」（顺索扑过去、无敌、落地横扫）；武艺「铁索」钩长 +10%；美术全由首领 v2 图拼成、特效借现成手绘图。
// 电脑布局；关掉随机暴击。用法：BASE=http://127.0.0.1:5743/ node tools/test-ganning.mjs   SHOT=1 另存截图到 assets/review/p3/
import { chromium } from 'playwright'; import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5743/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 460) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'ganning', weapon: undefined }); s.scene.restart(); }, G);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'ganning' && s.__DEV_ACTIONS; }, null, { timeout: 30000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; s.player.stats.critChance = -1; setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit' || s.mode === 'branch') s.__DEV_ACTIONS.closePopup?.(); }, 40); }, G);
const H = `const s = ${G}, pl = s.player, w = pl.weapons[0], wait = ms => new Promise(r => setTimeout(r, ms)), waitG = async ms => { const t0 = s.combatNow, r0 = Date.now(); while (s.combatNow - t0 < ms && Date.now() - r0 < ms * 6) await wait(20); };
  const { ganningDebug } = await import('/src/weapons/ganningWeapon.ts'); const D = () => ganningDebug(pl);
  const clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); pl.passive.reset('ganning', s.combatNow); };
  const mk = (kind, x, y, hp = 99999) => { const e = s.spawnEnemy(kind, x, y, 1); e.hp = e.maxHp = hp; e.stunUntil = 1e12; e.controlImmune = false; e.speed = 0; e.def = { ...e.def, speed: 0 }; return e; };
  const hook = async (ms = 520) => { const a0 = D().hooks; w.cooldownLeft = 0; const r0 = Date.now(); while (D().hooks === a0 && Date.now() - r0 < 3000) await wait(8); w.cooldownLeft = 1e9; await waitG(ms); };`;

const r0 = await p.evaluate(`(async () => { ${H}
  return { weapon: w.id, label: pl.passive.label?.(s.combatNow), tex: ['ganning_walk_sheet','ganning_actions','ganning_portrait','pangtong_chain','pangtong_chain_hot','fx_zy_field','fx_lvbu_sweep','fx_flank_streak','fx_cast_ganning','icon_lianhuan','growth_icon_wind_boots','growth_icon_lianying'].filter(k => !s.textures.exists(k)), walkFrame: s.textures.get('ganning_walk_sheet').frameTotal, actFrame: s.textures.get('ganning_actions').frameTotal };
})()`);
ck('甘宁开局本命武器是锦帆铁索钩（jinfan_gou）', r0.weapon === 'jinfan_gou', r0);
ck('甘宁的行走 / 动作（首领图拼成）/ 头像、借用的铁索 / 火 / 横扫 / 起手特效、图标全部载入', r0.tex.length === 0 && r0.walkFrame >= 16, r0);

// 1) 钩线上的敌兵挨打并被拉到身边，随后横扫；钩线外的不挨打；首领不拉
const r1 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  const a = mk('infantry', pl.x + 230, pl.y + 4), off = mk('infantry', pl.x + 200, pl.y + 150); const d0 = Math.round(a.x - pl.x);
  await hook(); return { d0, d1: Math.round(Math.hypot(a.x - pl.x, a.y - pl.y)), hit: a.maxHp - a.hp, off: off.maxHp - off.hp, pulled: D().pulled, sweeps: D().sweeps, hooked: a.hookedUntil > s.combatNow };
})()`);
ck('铁索钩：钩线上的敌兵挨打、被拉到身边（230 → 约 50）', r1.hit > 0 && r1.d1 < 90 && r1.pulled >= 1 && r1.hooked, r1);
ck('铁索钩：拉来后原地横扫；钩线外的敌兵不挨打', r1.sweeps >= 1 && r1.off === 0, r1);

// 2) 每第 3 钩铁索烧红、沿索留火（伤害、着火标记）
const r2 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  const hot0 = D().hot; for (let i = 0; i < 3; i++) { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); mk('infantry', pl.x + 230, pl.y); await hook(300); } /* 每钩前清场：拉过来的兵留在身边，下一钩会钩它（索就短了） */
  const fires = D().fires; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); const v = mk('infantry', pl.x + 180, pl.y + 2); const hp0 = v.hp; await waitG(1100);
  return { hot: D().hot - hot0, fires, burnt: hp0 - v.hp, burning: v.p3BurnUntil > s.combatNow, img: !!s.children.list.find(o => o.name === 'gn-fire') };
})()`);
ck('每第 3 钩铁索烧红，沿索留火（手绘火场）', r2.hot === 1 && r2.fires >= 2 && r2.img, r2);
ck('沿索的火：站在火里的敌兵挨烧、带着火标记', r2.burnt > 0 && r2.burning, r2);

// 3) 锦帆：被钩过的敌兵被击杀攒 1 点；满 12 点百骑劫营（移速 ×1.3、每钩都烧红、放起手特效）
const r3 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  const plain = mk('infantry', pl.x + 300, pl.y + 200, 5); plain.hp = 0; s.killEnemy(plain); const st0 = pl.passive.snapshot(s.combatNow).stacks;
  const e1 = mk('infantry', pl.x + 220, pl.y, 30), life1 = e1.spawnId; await hook(); const st1 = pl.passive.snapshot(s.combatNow).stacks, killed = !e1.active || e1.spawnId !== life1; /* 敌兵对象池化：死后可能被下一个兵复用 */
  const sp0 = pl.speed, cast0 = s.heroCastFx?.stats.passive ?? 0;
  for (let i = 0; i < 11; i++) { const e = mk('infantry', pl.x + 400, pl.y + 300, 5); e.hookedUntil = s.combatNow + 3000; e.hp = 0; s.killEnemy(e); }
  w.cooldownLeft = 0; await waitG(120); w.cooldownLeft = 1e9;
  const raid = pl.passive.p3Active(s.combatNow), sp1 = pl.speed, hot0 = D().hot;
  mk('infantry', pl.x + 220, pl.y); await hook(300);
  return { st0, st1, killed, raid, speedK: +(sp1 / sp0).toFixed(2), raids: D().raids, hotNext: D().hot - hot0, cast: (s.heroCastFx?.stats.passive ?? 0) - cast0, label: pl.passive.label(s.combatNow) };
})()`);
ck('锦帆：没被钩过的击杀不攒；被钩过的敌兵被击杀攒 1 点', r3.st0 === 0 && r3.st1 === 1 && r3.killed, r3);
ck('锦帆满 12 点：百骑劫营（移速 ×1.3、放起手特效）', r3.raid && r3.raids === 1 && r3.speedK === 1.3 && r3.cast >= 1, r3);
ck('百骑劫营中：每一钩铁索都烧红', r3.hotNext === 1, r3);

// 4) 分支「夜袭点火」：每钩都烧红；着火的敌兵被拉来时爆燃
const r4 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; w.branch = 'gn_yexi'; w.over = 0; await waitG(80);
  const hot0 = D().hot, b0 = D().bursts; const a = mk('infantry', pl.x + 220, pl.y); await hook(300);
  const hot1 = D().hot - hot0; const c = mk('infantry', pl.x + 220, pl.y + 4); c.p3BurnUntil = s.combatNow + 5000; await hook(400);
  w.branch = undefined; return { hot1, bursts: D().bursts - b0, img: true };
})()`);
ck('夜袭点火：每一钩都烧红；着火的敌兵被拉到身边时爆燃', r4.hot1 === 1 && r4.bursts >= 1, r4);

// 5) 分支「百骑劫魏营」：不拉敌兵，甘宁顺索扑过去（扑时无敌），落地横扫
const r5 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; w.branch = 'gn_jieying'; w.over = 0; await waitG(80);
  const x0 = pl.x, a = mk('infantry', pl.x + 240, pl.y); const ax0 = a.x, d0 = D().dashes; w.cooldownLeft = 0; await waitG(60); const inv = pl.invulnUntil > s.combatNow; w.cooldownLeft = 1e9; await waitG(500);
  w.branch = undefined; return { moved: Math.round(pl.x - x0), enemyMoved: Math.round(a.x - ax0), dashes: D().dashes - d0, inv, hit: a.maxHp - a.hp };
})()`);
ck('百骑劫魏营：甘宁顺索扑过去（敌兵不被拉），扑时无敌、落地横扫', r5.dashes === 1 && r5.moved > 120 && Math.abs(r5.enemyMoved) < 20 && r5.inv && r5.hit > 0, r5);

// 6) 武艺「铁索」：钩长 +10% / 级
const r6 = await p.evaluate(`(async () => { ${H}
  const { ganningReach } = await import('/src/weapons/ganningWeapon.ts'); return { l0: ganningReach(1), l2: ganningReach(1, 2) };
})()`);
ck('铁索：每级钩长 +10%', r6.l2 === Math.round(r6.l0 * 1.2), r6);

// 7) 来投：劝降甘宁（江夏支线江夏外围）
const r7 = await p.evaluate(async () => { const U = await import('/src/systems/HeroUnlocks.ts'); const base = { ch1: true, arc: () => 3, arcOpen: () => true, lubu: 0, flag: () => undefined };
  return { no: U.UNLOCK_RULES?.ganning?.({ ...base, persuaded: () => false }) ?? null, yes: U.UNLOCK_RULES?.ganning?.({ ...base, persuaded: id => id === 'ganning' }) ?? null, keys: Object.keys(U).slice(0, 20) }; });
ck('来投：劝降甘宁后解锁，没劝降不解锁', r7.no === false && r7.yes === true, r7);

if (process.env.SHOT) {
  mkdirSync('assets/review/p3', { recursive: true });
  await p.evaluate(`(async () => { ${H} clear(); for (let i = 0; i < 10; i++) { const e = mk('infantry', pl.x + 160 + (i % 5) * 34, pl.y - 40 + Math.floor(i / 5) * 60); e.stunUntil = 0; } w.cooldownLeft = 0; await waitG(150); w.cooldownLeft = 0; await waitG(150); w.cooldownLeft = 0; await waitG(90); })()`);
  await p.screenshot({ path: 'assets/review/p3/ganning-hook.png' });
}
ck('无报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} pass / ${fail} fail`); await b.close(); process.exit(fail ? 1 : 0);
