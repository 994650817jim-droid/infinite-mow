// P3 典韦（p3-heroes-plan.md + 设计会话意见）：双铁戟——朝最近两个敌兵掷短戟（穿透），每第 4 击原地旋风；
// 被动「恶来」受伤攒（0.4 秒最多 1 层），满 10 层「古之恶来」6 秒（受伤 ×0.6、自动旋风）；
// 分支「宛城死战」（半血以下旋风变大、吸血）/「护主」（兵阵：定时给身边部曲护盾、身边部曲攻速）；武艺「铁戟」多掷；曹操归附时来投（3-2 没救下换「宛城伤愈」台词）。
// 用法：BASE=http://127.0.0.1:5743/ node tools/test-dianwei.mjs   SHOT=1 另存截图到 assets/review/p3/
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
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'dianwei', weapon: undefined }); s.scene.restart(); }, G);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'dianwei' && s.__DEV_ACTIONS; }, null, { timeout: 30000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; s.player.stats.critChance = -1; setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit' || s.mode === 'branch') s.__DEV_ACTIONS.closePopup?.(); }, 40); }, G);
const H = `const s = ${G}, pl = s.player, w = pl.weapons[0], wait = ms => new Promise(r => setTimeout(r, ms)), waitG = async ms => { const t0 = s.combatNow, r0 = Date.now(); while (s.combatNow - t0 < ms && Date.now() - r0 < ms * 6) await wait(20); };
  const { dianweiDebug } = await import('/src/weapons/dianweiWeapon.ts'); const D = () => dianweiDebug(pl);
  const clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); pl.passive.reset('dianwei', s.combatNow); };
  const mk = (kind, x, y, hp = 99999) => { const e = s.spawnEnemy(kind, x, y, 1); e.hp = e.maxHp = hp; e.stunUntil = 1e12; e.controlImmune = false; e.speed = 0; e.def = { ...e.def, speed: 0 }; return e; };
  const atk = async (ms = 520) => { const a0 = D().attacks; w.cooldownLeft = 0; const r0 = Date.now(); while (D().attacks === a0 && Date.now() - r0 < 3000) await wait(8); w.cooldownLeft = 1e9; await waitG(ms); };`;

const r0 = await p.evaluate(`(async () => { ${H}
  return { weapon: w.id, tex: ['dianwei_walk_sheet','dianwei_actions','dianwei_portrait','dianwei_halberd','fx_dianwei_throw','fx_dianwei_whirl','fx_dianwei_hit','fx_dianwei_rage','fx_cast_dianwei','ink_hero_dianwei','icon_zhenbei','growth_icon_pearl_volley','growth_icon_berserk'].filter(k => !s.textures.exists(k)), hurt: !!pl.actionSet?.hurt, die: !!pl.actionSet?.die, skill: !!pl.actionSet?.skill };
})()`);
ck('典韦开局本命武器是双铁戟（shuang_tieji）', r0.weapon === 'shuang_tieji', r0);
ck('典韦的行走 / 动作（随军图拼成，只登记待机 / 出招 / 招牌技）/ 头像 / 水墨立轴、随军典韦特效、图标全部载入', r0.tex.length === 0 && r0.skill && !r0.hurt && !r0.die, r0);

// 1) 掷戟：最近两个敌兵各挨一支（穿透：后面一排也挨）；每第 4 击原地旋风
const r1 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  const a = mk('infantry', pl.x + 120, pl.y), b2 = mk('infantry', pl.x - 130, pl.y + 6), behind = mk('infantry', pl.x + 220, pl.y + 4);
  const t0 = D().throws; await atk(); const throws = D().throws - t0;
  const res = { throws, a: a.maxHp - a.hp, b: b2.maxHp - b2.hp, behind: behind.maxHp - behind.hp };
  const w0 = D().whirls; for (let i = 0; i < 3; i++) await atk(300); res.whirls = D().whirls - w0; res.whirlImg = true;
  return res;
})()`);
ck('双铁戟：朝最近两个敌兵各掷一支（两边都挨）、短戟穿透打到后面的', r1.throws === 2 && r1.a > 0 && r1.b > 0 && r1.behind > 0, r1);
ck('每第 4 击原地旋风', r1.whirls === 1, r1);

// 2) 恶来：受伤攒（0.4 秒内只算 1 层）；满 10 层古之恶来：受伤 ×0.6、自动旋风
const r2 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  pl.passive.onDamage(s.combatNow); pl.passive.onDamage(s.combatNow + 100); const st1 = pl.passive.snapshot(s.combatNow + 100).stacks;
  const r0w = D().rages, cast0 = s.heroCastFx?.stats.passive ?? 0; let t = s.combatNow + 1000; for (let i = 0; i < 9; i++) { pl.passive.onDamage(t); t += 500; }
  mk('infantry', pl.x + 60, pl.y); await waitG(1200);
  return { st1, rages: D().rages - r0w, active: pl.passive.p3Active(s.combatNow), guard: +pl.passive.damageTakenMultiplier(s.combatNow).toFixed(2), whirls: D().whirls, cast: (s.heroCastFx?.stats.passive ?? 0) - cast0, label: pl.passive.label(s.combatNow) };
})()`);
ck('恶来：受伤攒 1 层，0.4 秒内再受伤不算', r2.st1 === 1, r2);
ck('恶来满 10 层：古之恶来（受伤 ×0.6、自动旋风、放起手特效）', r2.rages === 1 && r2.active && r2.guard === .6 && r2.whirls >= 1 && r2.cast >= 1, r2);

// 3) 分支「宛城死战」：半血以下旋风变大、吸血
const r3 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; w.branch = 'dw_sizhan'; w.over = 0; await waitG(80);
  const far = mk('infantry', pl.x + 122, pl.y); pl.hp = pl.maxHp; for (let i = 0; i < 4; i++) await atk(250); const fullHit = far.maxHp - far.hp;
  clear(); w.branch = 'dw_sizhan'; const far2 = mk('infantry', pl.x + 122, pl.y); pl.hp = Math.floor(pl.maxHp * .4); const l0 = D().leeched; for (let i = 0; i < 4; i++) await atk(250);
  w.branch = undefined; pl.hp = pl.maxHp; return { fullHit, lowHit: far2.maxHp - far2.hp, leeched: D().leeched - l0 };
})()`);
ck('宛城死战：满血时 122 外的打不到旋风，半血以下旋风变大打得到、并吸血', r3.lowHit > r3.fullHit && r3.leeched > 0, r3);

// 4) 分支「护主」：定时给身边部曲护盾、身边部曲攻速
const r4 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await waitG(60);
  const host = s.weaponHost; let shielded = 0, hasted = 0; const os = host.shieldAllies, oh = host.hasteAllies; host.shieldAllies = (...a) => { shielded++; return os(...a); }; host.hasteAllies = (...a) => { hasted++; return oh(...a); };
  const p0 = D().pulses; w.branch = 'dw_huzhu'; w.over = 0; await waitG(300);
  host.shieldAllies = os; host.hasteAllies = oh; w.branch = undefined; return { pulses: D().pulses - p0, shielded, hasted };
})()`);
ck('护主：定时护主（身边部曲护盾）、身边部曲攻速', r4.pulses >= 1 && r4.shielded >= 1 && r4.hasted > 0, r4);

// 5) 武艺「铁戟」：多掷
const r5 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; pl.growth.masteries.tieji = 1; await wait(80); mk('infantry', pl.x + 120, pl.y); mk('infantry', pl.x - 120, pl.y); mk('infantry', pl.x, pl.y + 120);
  pl.passive.reset('dianwei', s.combatNow); const t0 = D().throws, a0 = D().attacks; await atk(200); pl.growth.masteries.tieji = 0; return { throws: D().throws - t0, attacks: D().attacks - a0 };
})()`);
ck('铁戟 1 级：一次掷 3 支', r5.throws === 3, r5);

// 6) 来投：曹操归附时随曹公来投；3-2 没救下 → 宛城伤愈台词
const r6 = await p.evaluate(async () => { const U = await import('/src/systems/HeroUnlocks.ts'); const base = { ch1: true, arc: () => 3, arcOpen: () => true, lubu: 0 };
  return { no: U.UNLOCK_RULES.dianwei({ ...base, flag: () => undefined, persuaded: () => false }), yes: U.UNLOCK_RULES.dianwei({ ...base, flag: () => undefined, persuaded: id => id === 'caocao' }),
    savedFb: U.joinedByFallback('dianwei', { ...base, flag: k => k === 'dianwei' ? 'saved' : undefined }), fellFb: U.joinedByFallback('dianwei', { ...base, flag: k => k === 'dianwei' ? 'fell' : undefined }) }; });
ck('来投：曹操归附才来；3-2 救下用「恩情」台词、没救下用「宛城伤愈」台词', r6.no === false && r6.yes === true && r6.savedFb === false && r6.fellFb === true, r6);

if (process.env.SHOT) {
  mkdirSync('assets/review/p3', { recursive: true });
  await p.evaluate(`(async () => { ${H} clear(); for (let i = 0; i < 10; i++) { const e = mk('infantry', pl.x + 70 + (i % 5) * 40, pl.y - 60 + Math.floor(i / 5) * 110); e.stunUntil = 0; } pl.passive.reset('dianwei', s.combatNow); for (let i = 0; i < 3; i++) await atk(260); w.cooldownLeft = 0; await waitG(70); })()`);
  await p.screenshot({ path: 'assets/review/p3/dianwei-whirl.png' });
}
ck('无报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} pass / ${fail} fail`); await b.close(); process.exit(fail ? 1 : 0);
