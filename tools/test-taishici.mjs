// P2 太史慈（other-factions-design.md §4）：东莱双戟近身交叉斩，每第 4 击射短戟钉住敌兵、留减速圈；
// 被动「信义」身边部曲挨打攒 15 点「单骑突围」（冲向最密敌群、沿途部曲得护盾）；分支「神亭酣战」（2 支戟、钉住 3 秒后爆裂）/「北海突围」（10 点、护盾更厚、留阵地）。
// 电脑布局；关掉随机暴击。用法：BASE=http://127.0.0.1:5743/ node tools/test-taishici.mjs   SHOT=1 另存截图到 .tmp-tsc/
import { chromium } from 'playwright'; import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5743/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 460) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 30000 });
await p.waitForTimeout(1500);
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'taishici', weapon: undefined }); s.scene.restart(); }, G);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'taishici' && s.__DEV_ACTIONS; }, null, { timeout: 20000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; s.player.stats.critChance = -1; setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit') s.__DEV_ACTIONS.closePopup?.(); }, 40); }, G);
const H = `const s = ${G}, pl = s.player, w = pl.weapons[0], wait = ms => new Promise(r => setTimeout(r, ms)), waitG = async ms => { const t0 = s.combatNow, r0 = Date.now(); while (s.combatNow - t0 < ms && Date.now() - r0 < ms * 6) await wait(20); };
  const { taishiciDebug } = await import('/src/weapons/taishiciWeapon.ts'); const D = () => taishiciDebug(pl);
  const clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); pl.passive.reset('taishici', s.combatNow); };
  const mk = (kind, x, y, hp = 99999) => { const e = s.spawnEnemy(kind, x, y, 1); e.hp = e.maxHp = hp; e.stunUntil = 1e12; e.controlImmune = false; return e; };
  const fire = async () => { const a0 = D().strikes; w.cooldownLeft = 0; const r0 = Date.now(); while (D().strikes === a0 && Date.now() - r0 < 3000) await wait(8); w.cooldownLeft = 1e9; await waitG(60); };
  const toStrike = async n => { while (D().strikes % 4 !== n) { const e = mk('infantry', pl.x + 60, pl.y); await fire(); e.deactivate(); } };`;

const r0 = await p.evaluate(`(async () => { ${H}
  return { weapon: w.id, tex: ['fx_tsc_slash','fx_tsc_ji','fx_tsc_pin','fx_tsc_dash','fx_tsc_route','fx_tsc_burst','fx_cast_taishici','taishici_walk_sheet','taishici_actions','taishici_portrait','icon_donglai','branch_icon_tsc_shenting','branch_icon_tsc_beihai','growth_icon_shenshe','growth_icon_qichi'].filter(k => !s.textures.exists(k)) };
})()`);
ck('太史慈开局本命武器是东莱双戟（donglai_ji）', r0.weapon === 'donglai_ji', r0);
ck('太史慈的手绘特效 / 行走 / 动作 / 头像 / 图标全部载入', r0.tex.length === 0, r0);

// 1) 近身交叉斩：身前挨打、身后不挨打；第 4 击射戟，钉住远处的敌兵、留减速圈
const r1 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120); await toStrike(0);
  const front = mk('infantry', pl.x + 60, pl.y), back = mk('infantry', pl.x - 95, pl.y + 4);
  for (let i = 0; i < 3; i++) await fire();
  const melee = [front.maxHp - front.hp, back.maxHp - back.hp]; front.deactivate(); back.deactivate();
  const far = mk('infantry', pl.x + 300, pl.y); far.stunUntil = 0; const t0 = D().throws; await fire(); await waitG(500);
  const pinned = far.stunUntil > s.combatNow, farHit = far.maxHp - far.hp, zones = D().zones;
  const inZone = mk('infantry', pl.x + 300, pl.y + 20); inZone.stunUntil = 0; await waitG(150);
  return { melee, throws: D().throws - t0, pinned, farHit, zones, slow: inZone.martialSlowUntil > s.combatNow ? +inZone.martialSlow.toFixed(2) : 1 };
})()`);
ck('东莱双戟：身前一扇挨打，身后的不挨打', r1.melee[0] > 0 && r1.melee[1] === 0, r1);
ck('第 4 击射戟：钉住 300 像素外的敌兵（定身）', r1.throws === 1 && r1.pinned && r1.farHit > 0, r1);
ck('射戟落点留下减速圈，圈里的敌兵减速 40%', r1.zones >= 1 && r1.slow === .6, r1);

// 2) 信义：身边部曲挨打攒 1 点；满 15 点单骑突围——冲向敌群、沿途敌兵受伤、沿途部曲得护盾
const r2 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  s.legion.recruit('swordsman', 1, true); await waitG(200); const u = s.allies.find(a => a.active);
  if (!u) return { noAlly: true };
  u.sprite?.setPosition?.(pl.x + 40, pl.y); u.px = pl.x + 40; u.py = pl.y; u.hurtUntil = 0;
  const st0 = pl.passive.snapshot(s.combatNow).stacks; s.legion.hurt(u, 5, s.combatNow, undefined, 0, true); const st1 = pl.passive.snapshot(s.combatNow).stacks;
  const pack = []; for (let i = 0; i < 6; i++) pack.push(mk('infantry', pl.x + 150 + (i % 3) * 25, pl.y - 20 + Math.floor(i / 3) * 40));
  let shieldGot = 0; const host = s.weaponHost, orig = host.shieldAllies; host.shieldAllies = (...a) => { shieldGot++; return orig(...a); };
  const x0 = pl.x, d0 = D().dashes, cast0 = s.heroCastFx?.stats.passive ?? 0;
  for (let i = 0; i < 14; i++) pl.passive.onAllyHurt(s.combatNow);
  await waitG(500); host.shieldAllies = orig;
  const hp0 = u.hp; u.hurtUntil = 0; const shieldBefore = u.shield; s.legion.hurt(u, 12, s.combatNow, undefined, 0, true);
  return { st0, st1, dashes: D().dashes - d0, moved: Math.round(pl.x - x0), packHit: pack.filter(e => e.hp < e.maxHp).length, shieldGot, shieldBefore: Math.round(shieldBefore), hpLoss: hp0 - u.hp, cast: (s.heroCastFx?.stats.passive ?? 0) - cast0 };
})()`);
ck('信义：身边部曲挨一次打攒 1 点', !r2.noAlly && r2.st1 - r2.st0 === 1, r2);
ck('信义满 15 点：单骑突围冲向敌群（位移 150 像素以上）、放起手特效', r2.dashes === 1 && r2.moved > 150 && r2.cast >= 1, r2);
ck('单骑突围：沿途敌兵受伤', r2.packHit >= 3, r2);
ck('单骑突围：给部曲护盾，护盾先挡伤害', r2.shieldGot === 1 && r2.shieldBefore > 0 && r2.hpLoss === 0, r2);

// 3) 分支「神亭酣战」：一次射 2 支，钉住的敌兵 3 秒后爆裂
const r3 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; w.branch = 'tsc_shenting'; w.over = 0; await wait(120); await toStrike(3);
  const far = mk('infantry', pl.x + 260, pl.y), nb = mk('infantry', pl.x + 300, pl.y + 30);
  const n0 = s.children.list.filter(o => o.name === 'tsc-ji').length; w.cooldownLeft = 0; await waitG(60); const jis = s.children.list.filter(o => o.name === 'tsc-ji').length - n0; w.cooldownLeft = 1e9;
  const b0 = D().burstsDone; const hpNb = nb.hp; await waitG(3600);
  w.branch = undefined; return { jis, bursts: D().burstsDone - b0, nbHit: hpNb - nb.hp };
})()`);
ck('神亭酣战：一次射出 2 支短戟', r3.jis === 2, r3);
ck('神亭酣战：钉住的敌兵 3 秒后爆裂，波及身边', r3.bursts >= 1 && r3.nbHit > 0, r3);

// 4) 分支「北海突围」：10 点就突围，路线留阵地
const r4 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; w.branch = 'tsc_beihai'; await waitG(80);
  const need = pl.passive.tscNeed; mk('infantry', pl.x + 200, pl.y); const d0 = D().dashes;
  for (let i = 0; i < 10; i++) pl.passive.onAllyHurt(s.combatNow); await waitG(150);
  const route = !!s.children.list.find(o => o.name === 'tsc-route'); w.branch = undefined;
  return { need, dashes: D().dashes - d0, route };
})()`);
ck('北海突围：信义只需 10 点', r4.need === 10 && r4.dashes === 1, r4);
ck('北海突围：突围路线留下阵地', r4.route, r4);

if (process.env.SHOT) {
  mkdirSync('.tmp-tsc', { recursive: true });
  await p.evaluate(`(async () => { ${H} clear(); w.branch = 'tsc_beihai'; for (let i = 0; i < 12; i++) { const e = mk('infantry', pl.x + 140 + (i % 4) * 35, pl.y - 50 + Math.floor(i / 4) * 50); e.stunUntil = 0; } for (let i = 0; i < 10; i++) pl.passive.onAllyHurt(s.combatNow); })()`);
  await p.waitForTimeout(250); await p.screenshot({ path: '.tmp-tsc/taishici_breakout.png' });
  await p.evaluate(`(async () => { ${H} w.branch = 'tsc_shenting'; await toStrike(3); for (let i = 0; i < 6; i++) mk('infantry', pl.x + 220 + (i % 3) * 30, pl.y - 30 + Math.floor(i / 3) * 60); w.cooldownLeft = 0; })()`);
  await p.waitForTimeout(500); await p.screenshot({ path: '.tmp-tsc/taishici_throw.png' });
}
ck('无报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} pass / ${fail} fail`); await b.close(); process.exit(fail ? 1 : 0);
