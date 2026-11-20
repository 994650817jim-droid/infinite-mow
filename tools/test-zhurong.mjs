// P3 祝融（p3-heroes-plan.md）：火焰飞枪——朝射程内最远的敌兵掷火枪（穿透一线、沿途留火），每第 3 掷带一扇 5 把飞刀；
// 被动「火神后裔」着火的敌兵被击杀攒，满 12 层「烈焰飞刀阵」（8 把绕身后射出）；分支「火神祝融」（火更大更久、死时蔓延）/「飞刀连环」（每第 2 掷、7 把、穿透）；
// 武艺「飞刀」多 1 把；南中支线秃龙洞打下来投。用法：BASE=http://127.0.0.1:5743/ node tools/test-zhurong.mjs   SHOT=1 另存截图到 assets/review/p3/
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
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'zhurong', weapon: undefined }); s.scene.restart(); }, G);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'zhurong' && s.__DEV_ACTIONS; }, null, { timeout: 30000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; s.player.stats.critChance = -1; setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit' || s.mode === 'branch') s.__DEV_ACTIONS.closePopup?.(); }, 40); }, G);
const H = `const s = ${G}, pl = s.player, w = pl.weapons[0], wait = ms => new Promise(r => setTimeout(r, ms)), waitG = async ms => { const t0 = s.combatNow, r0 = Date.now(); while (s.combatNow - t0 < ms && Date.now() - r0 < ms * 6) await wait(20); };
  const M = await import('/src/weapons/zhurongWeapon.ts'); const D = () => M.zhurongDebug(pl);
  const clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); pl.passive.reset('zhurong', s.combatNow); };
  const mk = (kind, x, y, hp = 99999) => { const e = s.spawnEnemy(kind, x, y, 1); e.hp = e.maxHp = hp; e.stunUntil = 1e12; e.controlImmune = false; e.speed = 0; e.def = { ...e.def, speed: 0 }; return e; };
  const toss = async (ms = 600) => { const a0 = D().throws; w.cooldownLeft = 0; const r0 = Date.now(); while (D().throws === a0 && Date.now() - r0 < 3000) await wait(8); w.cooldownLeft = 1e9; await waitG(ms); };
  const killBurning = n => { for (let i = 0; i < n; i++) { const e = mk('infantry', pl.x + 700, pl.y + 500, 5); e.p3BurnUntil = s.combatNow + 3000; e.hp = 0; s.killEnemy(e); } };`;

const r0 = await p.evaluate(`(async () => { ${H}
  return { weapon: w.id, tex: ['zhurong_walk_sheet','zhurong_actions','zhurong_portrait','ink_hero_zhurong','fx_zhurong_knife','fx_zy_field','fx_cast_zhurong','icon_sunknives','growth_icon_wildfire','growth_icon_pearl_volley'].filter(k => !s.textures.exists(k)), die: !!pl.actionSet?.die, skill: !!pl.actionSet?.skill };
})()`);
ck('祝融开局本命武器是火焰飞枪（huoyan_feiqiang）', r0.weapon === 'huoyan_feiqiang', r0);
ck('祝融的行走 / 动作（首领图拼成，只登记待机 / 出招 / 招牌技）/ 头像 / 水墨立轴、燃火飞刀 / 火场特效、图标全部载入', r0.tex.length === 0 && r0.skill && !r0.die, r0);

// 1) 火枪：朝最远的敌兵掷，穿透一线（近的、远的都挨），沿途留火、挨烧的带着火标记
const r1 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  const near = mk('infantry', pl.x + 110, pl.y), farE = mk('infantry', pl.x + 330, pl.y + 4), off = mk('infantry', pl.x + 200, pl.y + 140);
  await toss(); return { near: near.maxHp - near.hp, far: farE.maxHp - farE.hp, off: off.maxHp - off.hp, spears: D().spears, fires: D().fires, burning: near.p3BurnUntil > s.combatNow };
})()`);
ck('火焰飞枪：朝最远的掷，穿透一线（近 / 远都挨），线外不挨', r1.near > 0 && r1.far > 0 && r1.off === 0 && r1.spears === 1, r1);
ck('沿途留火线，挨着的带着火标记', r1.fires >= 3 && r1.burning, r1);

// 2) 每第 3 掷带一扇 5 把飞刀
const r2 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120); mk('infantry', pl.x + 300, pl.y);
  while (D().throws % 3 !== 0) await toss(120); /* 武器的出手计数跨用例：先对齐到第 3 掷之后 */ const k0 = D().knives, f0 = D().fans; await toss(200); await toss(200); const k2 = D().knives - k0; await toss(200); return { k2, k3: D().knives - k0, fans: D().fans - f0 };
})()`);
ck('每第 3 掷带一扇 5 把飞刀', r2.k2 === 0 && r2.k3 === 5 && r2.fans === 1, r2);

// 3) 火神后裔：着火的敌兵被击杀攒（没着火的不算），满 12 层烈焰飞刀阵：8 把绕身、碰到的挨打，随后射出
const r3 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  const plain = mk('infantry', pl.x + 700, pl.y + 500, 5); plain.hp = 0; s.killEnemy(plain); const st0 = pl.passive.snapshot(s.combatNow).stacks;
  const ring = mk('infantry', pl.x + 90, pl.y); const o0 = D().orbits, cast0 = s.heroCastFx?.stats.passive ?? 0; killBurning(12); await waitG(300);
  const orbiting = D().orbiting, img = s.children.list.filter(o => o.name === 'zr-orbit').length; await waitG(1100);
  return { st0, orbits: D().orbits - o0, orbiting, img, ringHit: ring.maxHp - ring.hp, outKnives: D().shots, cast: (s.heroCastFx?.stats.passive ?? 0) - cast0 };
})()`);
ck('火神后裔：没着火的击杀不攒；满 12 层烈焰飞刀阵（8 把绕身、放起手特效）', r3.st0 === 0 && r3.orbits === 1 && r3.orbiting && r3.img === 8 && r3.cast >= 1, r3);
ck('烈焰飞刀阵：绕身时碰到的敌兵挨打', r3.ringHit > 0, r3);

// 4) 分支「火神祝融」：着火的敌兵倒下时火蔓延到身边
const r4 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; w.branch = 'zr_huoshen'; w.over = 0; await waitG(80);
  const a = mk('infantry', pl.x + 300, pl.y, 5), nb = mk('infantry', pl.x + 340, pl.y + 20); a.p3BurnUntil = s.combatNow + 3000; const sp0 = D().spreads; a.hp = 0; s.killEnemy(a); await waitG(60);
  w.branch = undefined; return { spreads: D().spreads - sp0, nbHit: nb.maxHp - nb.hp, nbBurning: nb.p3BurnUntil > s.combatNow };
})()`);
ck('火神祝融：着火的敌兵倒下时火蔓延到身边（邻兵挨烧、着火）', r4.spreads === 1 && r4.nbHit > 0 && r4.nbBurning, r4);

// 5) 分支「飞刀连环」：每第 2 掷 7 把；武艺「飞刀」多 1 把
const r5 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; w.branch = 'zr_feidao'; w.over = 0; pl.growth.masteries.feidao = 1; await waitG(80); mk('infantry', pl.x + 300, pl.y);
  const k0 = D().knives; await toss(200); const k1 = D().knives - k0; await toss(200); const k2 = D().knives - k0; pl.growth.masteries.feidao = 0; w.branch = undefined; return { k1, k2 };
})()`);
ck('飞刀连环：每第 2 掷就带一扇；7 把 + 武艺飞刀 1 级 = 8 把', r5.k1 === 0 && r5.k2 === 8, r5);

// 6) 来投：南中支线秃龙洞打下（第 2 关）
const r6 = await p.evaluate(async () => { const U = await import('/src/systems/HeroUnlocks.ts'); const base = { ch1: true, arc: () => 3, arcOpen: () => true, lubu: 0, flag: () => undefined, persuaded: () => true };
  return { one: U.UNLOCK_RULES.zhurong({ ...base, side: () => 1 }), two: U.UNLOCK_RULES.zhurong({ ...base, side: id => id === 'nanzhong' ? 2 : 0 }) }; });
ck('来投：南中支线秃龙洞打下才来（只打下银坑洞不来）', r6.one === false && r6.two === true, r6);

if (process.env.SHOT) {
  mkdirSync('assets/review/p3', { recursive: true });
  await p.evaluate(`(async () => { ${H} clear(); for (let i = 0; i < 10; i++) { const e = mk('infantry', pl.x + 120 + (i % 5) * 50, pl.y - 40 + Math.floor(i / 5) * 70); e.stunUntil = 0; } await toss(150); await toss(150); w.cooldownLeft = 0; await waitG(160); killBurning(12); await waitG(200); })()`);
  await p.screenshot({ path: 'assets/review/p3/zhurong-knives.png' });
}
ck('无报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} pass / ${fail} fail`); await b.close(); process.exit(fail ? 1 : 0);
