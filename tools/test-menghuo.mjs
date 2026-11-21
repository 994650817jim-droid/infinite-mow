// P3 孟获（p3-heroes-plan.md）：南蛮大刀——前方大扇面重劈 + 沿劈的方向裂地一线；被动「南蛮王」任意击杀攒，满 20 层「驱兽冲阵」4 头猛兽一线冲过；
// 分支「七擒不服」（受伤攒不服层、伤害递增）/「南中象阵」（6 头象兵、撞晕、16 层）；武艺「藤甲」受伤减免；南中支线银坑洞打下来投。
// 用法：BASE=http://127.0.0.1:5743/ node tools/test-menghuo.mjs   SHOT=1 另存截图到 assets/review/p3/
import { chromium } from 'playwright'; import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5743/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 460) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Texture key already in use/.test(m.text())) errors.push(m.text()); }); /* 部曲头像等重复载入的警告（别的系统）不算 */
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'menghuo', weapon: undefined }); s.scene.restart(); }, G);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'menghuo' && s.__DEV_ACTIONS; }, null, { timeout: 30000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; s.player.stats.critChance = -1; setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit' || s.mode === 'branch') s.__DEV_ACTIONS.closePopup?.(); }, 40); }, G);
const H = `const s = ${G}, pl = s.player, w = pl.weapons[0], wait = ms => new Promise(r => setTimeout(r, ms)), waitG = async ms => { const t0 = s.combatNow, r0 = Date.now(); while (s.combatNow - t0 < ms && Date.now() - r0 < ms * 6) await wait(20); };
  const M = await import('/src/weapons/menghuoWeapon.ts'); const D = () => M.menghuoDebug(pl);
  const clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); pl.passive.reset('menghuo', s.combatNow); };
  const mk = (kind, x, y, hp = 99999) => { const e = s.spawnEnemy(kind, x, y, 1); e.hp = e.maxHp = hp; e.stunUntil = 1e12; e.controlImmune = false; e.speed = 0; e.def = { ...e.def, speed: 0 }; return e; };
  const cleave = async (ms = 160) => { const a0 = D().cleaves; w.cooldownLeft = 0; const r0 = Date.now(); while (D().cleaves === a0 && Date.now() - r0 < 3000) await wait(8); w.cooldownLeft = 1e9; await waitG(ms); };
  const killN = n => { for (let i = 0; i < n; i++) { const e = mk('infantry', pl.x + 700, pl.y + 500, 5); e.hp = 0; s.killEnemy(e); } };`;

const r0 = await p.evaluate(`(async () => { ${H}
  return { weapon: w.id, tex: ['menghuo_walk_sheet','menghuo_actions','menghuo_portrait','ink_hero_menghuo','mh_beast_sheet','mh_elephant_sheet','weiyan_crack','fx_md_slash','fx_cast_menghuo','icon_nanman','branch_icon_mh_bufu','branch_icon_mh_xiangzhen','growth_icon_might','growth_icon_constitution'].filter(k => !s.textures.exists(k)) };
})()`);
ck('孟获开局本命武器是南蛮大刀（nanman_dao）', r0.weapon === 'nanman_dao', r0);
ck('孟获的行走 / 动作（首领图拼成）/ 头像 / 水墨立轴、猛兽 / 象兵、裂地 / 刀光 / 起手特效、图标全部载入', r0.tex.length === 0, r0);

// 1) 重劈：身前一扇挨打、身后不挨；裂地沿劈的方向打到刀够不着的地方
const r1 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  const front = mk('infantry', pl.x + 80, pl.y), back = mk('infantry', pl.x - 120, pl.y + 4), far = mk('infantry', pl.x + 185, pl.y + 6);
  await cleave(500); return { front: front.maxHp - front.hp, back: back.maxHp - back.hp, far: far.maxHp - far.hp, cracks: D().cracks, img: true };
})()`);
ck('南蛮大刀：身前一扇挨打，身后的不挨打', r1.front > 0 && r1.back === 0, r1);
ck('裂地一线：沿劈的方向打到刀够不着的敌兵', r1.far > 0 && r1.cracks >= 1, r1);

// 2) 南蛮王：任意击杀攒，满 20 层驱兽冲阵（4 头猛兽，沿途敌兵挨撞、被撞开）
const r2 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  const pack = []; for (let i = 0; i < 6; i++) pack.push(mk('infantry', pl.x + 170 + (i % 3) * 34, pl.y - 30 + Math.floor(i / 3) * 50));
  const c0 = D().charges, cast0 = s.heroCastFx?.stats.passive ?? 0; killN(19); const st19 = pl.passive.snapshot(s.combatNow).stacks; killN(1);
  await waitG(80); const beasts = D().beasts, img = !!s.children.list.find(o => o.name === 'mh-beast'); await waitG(900);
  return { st19, charges: D().charges - c0, beasts, img, packHit: pack.filter(e => e.hp < e.maxHp).length, cast: (s.heroCastFx?.stats.passive ?? 0) - cast0 };
})()`);
ck('南蛮王：击杀攒层；满 20 层驱兽冲阵 4 头猛兽、放起手特效', r2.st19 === 19 && r2.charges === 1 && r2.beasts === 4 && r2.img && r2.cast >= 1, r2);
ck('驱兽冲阵：一线冲过，沿途敌兵挨撞', r2.packHit >= 4, r2);

// 3) 分支「七擒不服」：受伤攒不服（1 秒最多 1 层），伤害递增
const r3 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; w.branch = 'mh_bufu'; w.over = 0; await waitG(80);
  const a = mk('infantry', pl.x + 80, pl.y); await cleave(); const d0 = a.maxHp - a.hp;
  let t = s.combatNow; for (let i = 0; i < 5; i++) { pl.passive.onDamage(t); pl.passive.onDamage(t + 200); t += 1100; }
  const st = pl.passive.mhBufuStacks(t - 1000); const b2 = mk('infantry', pl.x + 80, pl.y + 3); await cleave(); const d1 = b2.maxHp - b2.hp;
  w.branch = undefined; return { d0, d1, st, ratio: +(d1 / d0).toFixed(2) };
})()`);
ck('七擒不服：受伤攒不服（1 秒内只算 1 层，5 层），伤害约 ×1.3', r3.st === 5 && r3.ratio >= 1.25 && r3.ratio <= 1.35, r3);

// 4) 分支「南中象阵」：16 层就召、6 头象兵、撞中眩晕
const r4 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; w.branch = 'mh_xiangzhen'; w.over = 0; await waitG(80);
  const need = pl.passive.p3Need; const v = mk('infantry', pl.x + 200, pl.y); v.stunUntil = 0; const c0 = D().charges; killN(16); await waitG(60);
  const n = D().beasts, ele = D().elephants; let stunned = false; const t0 = s.combatNow; while (s.combatNow - t0 < 900) { await wait(10); if (v.stunUntil > s.combatNow) stunned = true; }
  w.branch = undefined; return { need, charges: D().charges - c0, n, ele, stunned };
})()`);
ck('南中象阵：16 层就召，6 头象兵，撞中眩晕', r4.need === 16 && r4.charges === 1 && r4.n === 6 && r4.ele && r4.stunned, r4);

// 5) 武艺「藤甲」：每级受伤 −4%
const r5 = await p.evaluate(`(async () => { ${H} clear(); pl.growth.masteries.tengjia = 2; await waitG(60); const k = +pl.passive.damageTakenMultiplier(s.combatNow).toFixed(2); pl.growth.masteries.tengjia = 0; await waitG(40); return { k, k0: +pl.passive.damageTakenMultiplier(s.combatNow).toFixed(2) }; })()`);
ck('藤甲 2 级：受伤 ×0.92', r5.k === .92 && r5.k0 === 1, r5);

// 6) 来投：南中支线银坑洞打下
const r6 = await p.evaluate(async () => { const U = await import('/src/systems/HeroUnlocks.ts'); const base = { ch1: true, arc: () => 3, arcOpen: () => true, lubu: 0, flag: () => undefined, persuaded: () => true };
  return { no: U.UNLOCK_RULES.menghuo({ ...base, side: () => 0 }), yes: U.UNLOCK_RULES.menghuo({ ...base, side: id => id === 'nanzhong' ? 1 : 0 }), real: typeof U.realProgress().side === 'function' }; });
ck('来投：南中支线银坑洞打下才来（读支线进度）', r6.no === false && r6.yes === true && r6.real, r6);

if (process.env.SHOT) {
  mkdirSync('assets/review/p3', { recursive: true });
  await p.evaluate(`(async () => { ${H} clear(); for (let i = 0; i < 12; i++) { const e = mk('infantry', pl.x + 120 + (i % 4) * 46, pl.y - 70 + Math.floor(i / 4) * 60); e.stunUntil = 0; } w.cooldownLeft = 0; await waitG(120); killN(20); await waitG(380); })()`);
  await p.screenshot({ path: 'assets/review/p3/menghuo-beasts.png' });
}
ck('无报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} pass / ${fail} fail`); await b.close(); process.exit(fail ? 1 : 0);
