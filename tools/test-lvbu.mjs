// P2 吕布（other-factions-design.md §4）：方天画戟 刺 / 刺 / 横扫 循环；被动「无双」25 杀进狂暴 8 秒（连打两次、攻速 / 移速 ×1.4、免击飞）；
// 分支「人中吕布」（转两圈旋戟、击杀延长狂暴）/「辕门射戟」（每 5 次出手掷戟、定身）；手绘特效与图标已载入。
// 电脑布局；关掉随机暴击。用法：BASE=http://127.0.0.1:5743/ node tools/test-lvbu.mjs   SHOT=1 另存截图到 .tmp-lvbu/
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
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'lvbu', weapon: undefined }); s.scene.restart(); }, G);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'lvbu' && s.__DEV_ACTIONS; }, null, { timeout: 20000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; s.player.stats.critChance = -1; setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit') s.__DEV_ACTIONS.closePopup?.(); }, 40); }, G);
const H = `const s = ${G}, pl = s.player, w = pl.weapons[0], wait = ms => new Promise(r => setTimeout(r, ms)), waitG = async ms => { const t0 = s.combatNow, r0 = Date.now(); while (s.combatNow - t0 < ms && Date.now() - r0 < ms * 6) await wait(20); };
  const { lvbuDebug } = await import('/src/weapons/lvbuWeapon.ts');
  const clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); pl.passive.reset('lvbu', s.combatNow); };
  const mk = (kind, x, y, hp = 99999) => { const e = s.spawnEnemy(kind, x, y, 1); e.hp = e.maxHp = hp; e.stunUntil = 1e12; e.controlImmune = false; return e; };
  const fire = async () => { const a0 = lvbuDebug(pl).acts; w.cooldownLeft = 0; const r0 = Date.now(); while (lvbuDebug(pl).acts === a0 && Date.now() - r0 < 3000) await wait(10); w.cooldownLeft = 1e9; await waitG(260); };
  const syncStep = async () => { while (lvbuDebug(pl).step !== 0) await fire(); };`;

// 0) 基础：武器、图与图标
const r0 = await p.evaluate(`(async () => { ${H}
  const T = s.textures; return { weapon: w.id, n: pl.weapons.length, tex: ['fx_lvbu_thrust','fx_lvbu_sweep','fx_lvbu_halberd','fx_cast_lvbu','lvbu_walk_sheet','lvbu_actions','lvbu_portrait','icon_fangtian','icon_wushuang','branch_icon_lb_renzhong','branch_icon_lb_yuanmen','growth_icon_chitu','growth_icon_huaji'].filter(k => !T.exists(k)) };
})()`);
ck('吕布开局本命武器是方天画戟（fangtian_ji）', r0.weapon === 'fangtian_ji', r0);
ck('吕布的手绘特效 / 行走 / 动作 / 头像 / 图标全部载入', r0.tex.length === 0, r0);

// 1) 循环：刺、刺、横扫——正前方的兵是目标（最近），侧面 100 像素的兵只在第三下（横扫）挨打
const r1 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120); await syncStep(); clear();
  const front = mk('infantry', pl.x + 80, pl.y), back = mk('infantry', pl.x, pl.y + 100); const hp = [];
  for (let i = 0; i < 3; i++) { await fire(); hp.push([front.maxHp - front.hp, back.maxHp - back.hp]); }
  return { hp, sweepFx: !!s.children.list.find(o => o.name === 'lvbu-sweep') || hp[2][1] > 0 };
})()`);
ck('方天画戟：前两下长突只打前方一线（侧面的兵不挨打）', r1.hp[0][0] > 0 && r1.hp[1][0] > r1.hp[0][0] && r1.hp[1][1] === 0, r1);
ck('方天画戟：第三下横扫 360°，侧面的兵也挨打', r1.hp[2][1] > 0 && r1.hp[2][0] > r1.hp[1][0], r1);

// 2) 无双：25 杀进狂暴；每次出手打两次；移速 ×1.4；免击飞；起手特效
const r2 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120); await syncStep(); clear();
  const v0 = pl.speed, cast0 = s.heroCastFx?.stats.passive ?? 0;
  for (let i = 0; i < 24; i++) pl.passive.onKill('infantry', s.combatNow);
  const before = pl.passive.isWushuang(s.combatNow);
  pl.passive.onKill('infantry', s.combatNow); const on = pl.passive.isWushuang(s.combatNow), left = pl.passive.wushuangLeft(s.combatNow);
  await waitG(120); const v1 = pl.speed, cast1 = s.heroCastFx?.stats.passive ?? 0;
  const x0 = pl.x, y0 = pl.y; pl.knockUp(s.combatNow, 300, 160, 0); await waitG(350); const moved = Math.hypot(pl.x - x0, pl.y - y0);
  const drops = async t => { /* 只数方天画戟自己的命中（调用栈来自 lvbuWeapon）：测试里自动选的升级会带额外追击 / 灼烧，不算 */
    let n = 0; const orig = s.hitEnemy; s.hitEnemy = function (e, ...rest) { if (e === t && (new Error().stack ?? '').includes('lvbuWeapon')) n++; return orig.call(this, e, ...rest); };
    const a0 = lvbuDebug(pl).acts; w.cooldownLeft = 0; const t0 = s.combatNow; while (s.combatNow - t0 < 450) { await wait(5); if (lvbuDebug(pl).acts !== a0) w.cooldownLeft = 1e9; } w.cooldownLeft = 1e9; s.hitEnemy = orig; return n; };
  const t = mk('infantry', pl.x + 140, pl.y); const dbl = await drops(t);
  pl.passive.reset('lvbu', s.combatNow); await syncStep(); clear(); const t2 = mk('infantry', pl.x + 140, pl.y); const single = await drops(t2);
  return { before, on, left: Math.round(left), speedRatio: +(v1 / v0).toFixed(3), moved: Math.round(moved), dbl, single, cast: cast1 - cast0 };
})()`);
ck('无双：第 25 杀才进狂暴，持续 8 秒', !r2.before && r2.on && r2.left > 7800 && r2.left <= 8000, r2);
ck('无双：狂暴时移速 ×1.4', Math.abs(r2.speedRatio - 1.4) < .02, r2);
ck('无双：狂暴时不会被击飞', r2.moved < 20, r2);
ck('无双：狂暴时每次出手连打两次（同一下出手命中 2 次，平时 1 次）', r2.single === 1 && r2.dbl === 2, r2);
ck('无双：进狂暴那一刻放手绘起手特效（fx_cast_lvbu）', r2.cast >= 1, r2);

// 3) 分支「人中吕布」：横扫转两圈（身后的兵挨两下）；狂暴中击杀延长
const r3 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; w.branch = 'lb_renzhong'; w.over = 0; await wait(120); await syncStep(); clear();
  const front = mk('infantry', pl.x + 80, pl.y), back = mk('infantry', pl.x, pl.y + 100); let hits = 0, last = back.hp;
  w.cooldownLeft = 0; for (let k = 0; k < 3; k++) { const a0 = lvbuDebug(pl).acts; const r0 = Date.now(); while (lvbuDebug(pl).acts === a0 && Date.now() - r0 < 3000) await wait(10); w.cooldownLeft = k < 2 ? 0 : 1e9; }
  const t0 = s.combatNow; while (s.combatNow - t0 < 700) { await wait(10); if (back.hp < last) { hits++; last = back.hp; } }
  pl.passive.grantWushuang(s.combatNow); await waitG(60); const l0 = pl.passive.wushuangLeft(s.combatNow); pl.passive.onKill('infantry', s.combatNow); const l1 = pl.passive.wushuangLeft(s.combatNow);
  w.branch = undefined; pl.passive.reset('lvbu', s.combatNow);
  return { hits, ext: Math.round(l1 - l0) };
})()`);
ck('人中吕布：横扫变旋戟风暴，转两圈（侧面的兵挨两下）', r3.hits === 2, r3);
ck('人中吕布：狂暴中每次击杀延长狂暴 0.4 秒', Math.abs(r3.ext - 400) <= 20, r3);

// 4) 分支「辕门射戟」：每 5 次出手掷戟，远处一线敌兵受伤并定身 1 秒
const r4 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; w.branch = 'lb_yuanmen'; w.over = 0; await wait(120);
  while (lvbuDebug(pl).acts % 5 !== 0) await fire(); clear();
  const near = mk('infantry', pl.x + 130, pl.y); const far = mk('infantry', pl.x + 380, pl.y); far.stunUntil = 0;
  const hist = []; for (let i = 0; i < 5; i++) { await fire(); hist.push(far.maxHp - far.hp); }
  const stunned = far.stunUntil > s.combatNow; w.branch = undefined;
  return { hist, stunned };
})()`);
ck('辕门射戟：前 4 次出手够不着远处的兵，第 5 次掷戟打到 380 像素外', r4.hist.slice(0, 4).every(v => v === 0) && r4.hist[4] > 0, r4);
ck('辕门射戟：被戟穿过的兵定身', r4.stunned, r4);

if (process.env.SHOT) {
  mkdirSync('.tmp-lvbu', { recursive: true });
  await p.evaluate(`(async () => { ${H} clear(); w.branch = 'lb_renzhong'; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; mk('infantry', pl.x + Math.cos(a) * (90 + (i % 3) * 30), pl.y + Math.sin(a) * (90 + (i % 3) * 30), 99999).stunUntil = 0; } pl.passive.grantWushuang(s.combatNow); w.cooldownLeft = 0; })()`);
  await p.waitForTimeout(900); await p.screenshot({ path: '.tmp-lvbu/lvbu_wushuang.png' });
  await p.waitForTimeout(500); await p.screenshot({ path: '.tmp-lvbu/lvbu_wushuang_2.png' });
}
ck('无报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} pass / ${fail} fail`); await b.close(); process.exit(fail ? 1 : 0);
