// 「退出后再进入，之前学习的武将技能和武器强化都没有了」（用户 2026-11-18）：真实存档流程（不带 dev=1，测试战斗不存征程构筑），
// 从主页「匡扶汉室」进关，逐项比对 专属武学等级、战法及等级、本命武器等级、属性点、等级、血量。
// 1 第一关中途撤退；2 打赢后在行营休整关页面（再进）；3 关卡中途关页面；4 关卡中途撤退（回滚到本关开始、保留前几关）。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-build-persist.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' · ' + JSON.stringify(d).slice(0, 700))); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); sessionStorage.setItem('seeded', '1'); } });
const p = await ctx.newPage(), errors = [];
p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use: bag_/.test(m.text())) errors.push(m.text()); });
const G = "window.__game.scene.getScene('GameScene')";
const booted = () => p.waitForFunction(() => window.__game?.scene.getScenes(true).some(s => ['MenuScene', 'GameScene', 'WorldMapScene', 'CityScene'].includes(s.scene.key)), null, { timeout: 120000 });
/** 主页「匡扶汉室」进关（真实入口）。 */
async function fromHome() {
  await p.goto(base + '?layout=desktop'); await booted();
  await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 60000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); m.heroModal?.setVisible(false); m.campaignEntry(); });
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.sys.isActive() && s.player && s.legion; }, null, { timeout: 60000 });
  await p.waitForTimeout(1200);
  await p.evaluate(G0 => { const s = eval(G0); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); if (s.mode !== 'none') s.setMode('none'); }, G);
  return state();
}
const state = () => p.evaluate(G0 => { const s = eval(G0), g = s.player.growth; return { stage: s.chapter.stage, replay: s.campaignReplay, loaded: s.campaignLoaded, tactics: Object.fromEntries(Object.entries(g.build.tactics).filter(([, v]) => v)), masteries: Object.fromEntries(Object.entries(g.masteries).filter(([, v]) => v)), weapon: s.player.weapons[0].level, unalloc: g.unallocated, attrs: { ...g.attributes }, level: s.player.level, hpFrac: +(s.player.hp / s.player.maxHp).toFixed(2) }; }, G);
const learn = (tac, mast, wl, attr) => p.evaluate(([G0, tac, mast, wl, attr]) => { const s = eval(G0), g = s.player.growth; for (const t of tac) g.build.learn(t); for (const m of mast) g.learn(m); s.player.weapons[0].level = wl; if (attr) { g.attributes.strength += attr; } }, [G, tac, mast, wl, attr]);
const win = async hpFrac => { await p.evaluate(([G0, f]) => { const s = eval(G0); s.player.hp = Math.round(s.player.maxHp * f); s.bossKilled = true; s.finish(true, 'boss'); }, [G, hpFrac]); await p.waitForTimeout(1500); return p.evaluate(G0 => eval(G0).mode, G); };
const retreat = async () => { await p.evaluate(G0 => { const s = eval(G0); s.setMode('pause'); const ex = s.pausePanel.getByName('pause-exit'); ex.emit('pointerdown'); ex.emit('pointerdown'); }, G); await p.waitForTimeout(3000); await booted(); };
const same = (a, e) => JSON.stringify(a.tactics) === JSON.stringify(e.tactics) && JSON.stringify(a.masteries) === JSON.stringify(e.masteries) && a.weapon === e.weapon && a.attrs.strength === e.attrs.strength;

// 4. 第一关就中途退出：没有存档点，重进还是 1-1、空构筑
let s = await fromHome();
await learn(['pursuit'], ['dragon_gallop'], 2, 1);
await retreat();
let r = await fromHome();
ck('4 第一关中途撤退：重进仍是 1-1，空构筑（本关所学撤销），无存档点', r.stage === 1 && !r.replay && !r.loaded && !Object.keys(r.tactics).length && !Object.keys(r.masteries).length && r.weapon === 1 && r.attrs.strength === 0, { s, r });

// 打赢 1-1：存档点 = 1-1 结束时的构筑（血量 70%）
await learn(['pursuit', 'pursuit', 'ember'], ['dragon_gallop'], 3, 2);
const w11 = await state(); const m11 = await win(.7);
const save11 = await p.evaluate(() => { const z = JSON.parse(localStorage.getItem('im_campaign_v1') ?? 'null')?.heroes?.zhaoyun?.player; return z && { tactics: z.build.tactics, masteries: z.growth.masteries, weapon: z.weapons[0].level, hpFrac: z.hpFrac }; });
ck('打赢 1-1：进行营休整，征程构筑存档（战法 / 武学 / 武器 / 血量）', m11 === 'rest' && save11?.weapon === 3 && save11?.tactics?.pursuit === 2 && save11?.masteries?.dragon_gallop === 1 && Math.abs(save11.hpFrac - .7) < .02, { m11, save11 });

// 2. 休整时直接关页面 → 主页再进：接着 1-2，全部恢复
r = await fromHome();
ck('2 休整中关页面后从主页再进：进 1-2（不是已通关的 1-1），战法 / 武学 / 武器 / 属性都在', r.stage === 2 && !r.replay && r.loaded && same(r, w11), { w11, r });
ck('2 等级为武将等级（首通经验后 ≥ 1-1 时）、属性点不少于存档时、血量按 70% 继承', r.level >= w11.level && r.unalloc >= w11.unalloc && Math.abs(r.hpFrac - .7) < .02, { w11, r });

// 1. 1-2 中途撤退：回滚到本关开始（保留 1-1 的构筑，撤销 1-2 新学的）
await learn(['ember'], ['dragon_gallop'], 5, 3);
await retreat();
r = await fromHome();
ck('1 1-2 中途撤退后再进：仍是 1-2，回到 1-1 存档点的构筑（1-2 里新学的撤销，之前的保留）', r.stage === 2 && r.loaded && same(r, w11), { w11, r });

// 3. 1-2 中途关页面（关浏览器 / exe）后从主页再进：同上
await learn(['ember'], ['dragon_gallop'], 5, 3);
r = await fromHome();
ck('3 1-2 中途关页面后从主页再进：仍是 1-2，构筑同 1-1 存档点', r.stage === 2 && r.loaded && same(r, w11), { w11, r });

// 打赢 1-2（新学了东西）→ 休整中关页面 → 再进 1-3：带上 1-2 的构筑
await learn(['ember', 'rally'], ['dragon_gallop'], 4, 1);
const w12 = await state(); const m12 = await win(1);
r = await fromHome();
ck('打赢 1-2 后再进：进 1-3，带上 1-2 新学的（追击 2 / 星火 2 / 武学 2 / 武器 4）', m12 === 'rest' && r.stage === 3 && r.loaded && same(r, w12) && r.hpFrac === 1, { w12, r });
// 行营「率军出征」（同章连打，内存里的 transfer）不受影响
await p.evaluate(G0 => { const s = eval(G0); s.player.hp = s.player.maxHp; s.bossKilled = true; }, G);
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 5));
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
