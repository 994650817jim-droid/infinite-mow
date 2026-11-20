// P3 孙权（p3-heroes-plan.md）：古锭刀 · 令箭——近身扇形刀斩，每第 4 斩令江东弓手朝最密处齐射（延后落下）；
// 被动「制衡」任意击杀攒，满 15 层切下一阵势（守：受伤 −15% / 攻：每第 3 斩齐射、伤害 +25% / 疾：移速 +15%）；
// 分支「坐断东南」（阵势效果加倍、切阵护盾）/「江东弓弩」（齐射更大、每第 3 斩、落点减速）；武艺「紫髯」刀斩距离；孙权归附来投。
// 用法：BASE=http://127.0.0.1:5743/ node tools/test-sunquan.mjs   SHOT=1 另存截图到 assets/review/p3/
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
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'sunquan', weapon: undefined }); s.scene.restart(); }, G);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'sunquan' && s.__DEV_ACTIONS; }, null, { timeout: 30000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; s.player.stats.critChance = -1; setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit' || s.mode === 'branch') s.__DEV_ACTIONS.closePopup?.(); }, 40); }, G);
const H = `const s = ${G}, pl = s.player, w = pl.weapons[0], wait = ms => new Promise(r => setTimeout(r, ms)), waitG = async ms => { const t0 = s.combatNow, r0 = Date.now(); while (s.combatNow - t0 < ms && Date.now() - r0 < ms * 6) await wait(20); };
  const M = await import('/src/weapons/sunquanWeapon.ts'); const D = () => M.sunquanDebug(pl);
  const clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); pl.passive.reset('sunquan', s.combatNow); M.sunquanSetStance(pl, 0); };
  const mk = (kind, x, y, hp = 99999) => { const e = s.spawnEnemy(kind, x, y, 1); e.hp = e.maxHp = hp; e.stunUntil = 1e12; e.controlImmune = false; e.speed = 0; e.def = { ...e.def, speed: 0 }; return e; };
  const slash = async (ms = 120) => { const a0 = D().slashes; w.cooldownLeft = 0; const r0 = Date.now(); while (D().slashes === a0 && Date.now() - r0 < 3000) await wait(8); w.cooldownLeft = 1e9; await waitG(ms); };
  const killN = n => { for (let i = 0; i < n; i++) { const e = mk('infantry', pl.x + 600, pl.y + 400, 5); e.hp = 0; s.killEnemy(e); } };`;

const r0 = await p.evaluate(`(async () => { ${H}
  return { weapon: w.id, label: pl.passive.label(s.combatNow), tex: ['sunquan_walk_sheet','sunquan_actions','sunquan_portrait','ink_hero_sunquan','fx_md_slash','fx_awaken_archery','fx_awaken_formation','fx_awaken_cavalry','fx_cast_sunquan','icon_yitian','growth_icon_steady_aim','growth_icon_critical'].filter(k => !s.textures.exists(k)) };
})()`);
ck('孙权开局本命武器是古锭刀 · 令箭（guding_dao），被动条写当前阵势', r0.weapon === 'guding_dao' && /守势/.test(r0.label), r0);
ck('孙权的行走 / 动作（首领图拼成）/ 头像 / 水墨立轴、借用的刀光 / 齐射 / 阵势特效、图标全部载入', r0.tex.length === 0, r0);

// 1) 刀斩：身前一扇挨打、身后不挨；每第 4 斩齐射（延后落到最密处）
const r1 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  const front = mk('infantry', pl.x + 70, pl.y), back = mk('infantry', pl.x - 110, pl.y + 4);
  const pack = []; for (let i = 0; i < 5; i++) pack.push(mk('infantry', pl.x + 260 + (i % 3) * 26, pl.y - 120 + Math.floor(i / 3) * 30));
  const v0 = D().volleys; for (let i = 0; i < 3; i++) await slash(); const v3 = D().volleys - v0; await slash(40); const v4 = D().volleys - v0;
  const packBefore = pack.filter(e => e.hp < e.maxHp).length; await waitG(700);
  return { front: front.maxHp - front.hp, back: back.maxHp - back.hp, v3, v4, packBefore, packAfter: pack.filter(e => e.hp < e.maxHp).length, landed: D().landed };
})()`);
ck('古锭刀：身前一扇挨打，身后的不挨打', r1.front > 0 && r1.back === 0, r1);
ck('每第 4 斩令箭齐射：延后落到最密处，那一堆挨射', r1.v3 === 0 && r1.v4 === 1 && r1.packBefore === 0 && r1.packAfter >= 4 && r1.landed >= 1, r1);

// 2) 制衡：击杀攒，满 15 层切阵势；守势受伤 ×0.85 → 攻势（每第 3 斩就齐射）→ 疾势（移速 ×1.15）
const r2 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await waitG(80);
  const guard0 = +pl.passive.damageTakenMultiplier(s.combatNow).toFixed(2), sp0 = pl.speed;
  killN(15); await waitG(80); const st1 = D().stance;
  mk('infantry', pl.x + 70, pl.y); for (let i = 0; i < 6; i++) mk('infantry', pl.x + 260 + i * 10, pl.y - 100);
  const v0 = D().volleys; for (let i = 0; i < 3; i++) await slash(); const atkVolley = D().volleys - v0;
  killN(15); await waitG(80); const st2 = D().stance, speedK = +(pl.speed / sp0).toFixed(2);
  return { guard0, st1, atkVolley, st2, speedK, switches: D().switches, label: pl.passive.label(s.combatNow) };
})()`);
ck('制衡：开局守势（受伤 ×0.85）；击杀满 15 层切到攻势', r2.guard0 === .85 && r2.st1 === '攻势', r2);
ck('攻势：每第 3 斩就齐射；再满 15 层切到疾势（移速 ×1.15）', r2.atkVolley === 1 && r2.st2 === '疾势' && r2.speedK === 1.15 && /疾势/.test(r2.label), r2);

// 3) 分支「坐断东南」：守势减伤加倍（×0.7），切阵势时部曲护盾
const r3 = await p.evaluate(`(async () => { ${H}
  clear(); w.branch = 'sq_zuoduan'; w.over = 0; await waitG(80); const guard = +pl.passive.damageTakenMultiplier(s.combatNow).toFixed(2);
  const host = s.weaponHost; let shielded = 0; const os = host.shieldAllies; host.shieldAllies = (...a) => { shielded++; return os(...a); };
  killN(15); await waitG(80); host.shieldAllies = os; w.branch = undefined; return { guard, shielded, stance: D().stance };
})()`);
ck('坐断东南：守势受伤 ×0.7（效果加倍）；切阵势时身边部曲护盾', r3.guard === .7 && r3.shielded >= 1 && r3.stance === '攻势', r3);

// 4) 分支「江东弓弩」：每第 3 斩齐射、落点留减速
const r4 = await p.evaluate(`(async () => { ${H}
  clear(); w.branch = 'sq_gongnu'; w.over = 0; await waitG(80);
  mk('infantry', pl.x + 70, pl.y); const v = mk('infantry', pl.x + 110, pl.y + 40); v.stunUntil = 0; /* 和身前那个挨着：最密处就是这两个 */
  const v0 = D().volleys; for (let i = 0; i < 3; i++) await slash(); const n = D().volleys - v0; await waitG(600);
  const slowed = v.martialSlow < 1 && v.martialSlowUntil > s.combatNow; w.branch = undefined; return { n, slows: D().slows, slowed };
})()`);
ck('江东弓弩：每第 3 斩就齐射，落点留减速区', r4.n === 1 && r4.slows >= 1 && r4.slowed, r4);

// 5) 武艺「紫髯」：刀斩距离每级 +10%
const r5 = await p.evaluate(`(async () => { ${H} return { l0: M.sunquanReach(1), l2: M.sunquanReach(1, 2) }; })()`);
ck('紫髯：每级刀斩距离 +10%', r5.l2 === Math.round(r5.l0 * 1.2), r5);

// 6) 来投：孙权归附（东吴支线吴郡）
const r6 = await p.evaluate(async () => { const U = await import('/src/systems/HeroUnlocks.ts'); const base = { ch1: true, arc: () => 3, arcOpen: () => true, lubu: 0, flag: () => undefined };
  return { no: U.UNLOCK_RULES.sunquan({ ...base, persuaded: id => id === 'zhoutai' }), yes: U.UNLOCK_RULES.sunquan({ ...base, persuaded: id => id === 'sunquan' }) }; });
ck('来投：孙权归附才来（周泰降了不算）', r6.no === false && r6.yes === true, r6);

if (process.env.SHOT) {
  mkdirSync('assets/review/p3', { recursive: true });
  await p.evaluate(`(async () => { ${H} clear(); for (let i = 0; i < 12; i++) { const e = mk('infantry', pl.x + 80 + (i % 4) * 50, pl.y - 70 + Math.floor(i / 4) * 60); e.stunUntil = 0; } for (let i = 0; i < 3; i++) await slash(200); w.cooldownLeft = 0; await waitG(Number(window.__shotWait ?? 520)); })()`);
  await p.screenshot({ path: 'assets/review/p3/sunquan-volley.png' });
}
ck('无报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} pass / ${fail} fail`); await b.close(); process.exit(fail ? 1 : 0);
