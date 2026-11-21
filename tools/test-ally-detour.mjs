// 我方绕栅栏（2026-11-21 用户试玩「关于我自己的兵也会被围栏卡住」）：1-2 下曲阳法坛营木栅（左右两段，中间 240 宽营门）。
// 主将站木栅南侧，部曲（Legion）和名将随从（FollowerSquad）摆在木栅北侧：
// ① 关掉我方绕障（旧行为：只有局部绕角）：部曲贴在木栅后过不来（复现）；
// ② 打开：护阵状态下部曲 N 秒内绕到主将身边（或卡住 2 秒后在主将旁可走点淡入归队）；随从回到主将身边；
// ③ 全程没有我方单位站进木栅碰撞框；④ 出击状态也能绕回；⑤ 我方任意两人不重叠（间距 ≥ 半径之和 − 6）；⑥ 无报错。
// 用法：BASE=http://127.0.0.1:5187/ node tools/test-ally-detour.mjs [截图目录]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = process.argv[2] ?? 'assets/review/ally-detour'; mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
await p.addInitScript(() => { try { localStorage.setItem('im_story', 'off'); } catch { /* */ } });
await p.goto(base + '?dev=1&layout=desktop&followers=1', { timeout: 180000 }); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
await p.evaluate(() => { const g = window.__game, s0 = g.scene.getScene('MenuScene'); s0.registry.set('runConfig', { chapter: 'huangjin', stage: 2, character: 'zhaoyun', weapon: 'spear' }); for (const s of g.scene.getScenes(true)) s.scene.stop(); s0.scene.start('GameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && window.__game.scene.isActive('GameScene') && s.elapsed > 1; }, null, { timeout: 120000 });
const S = "window.__game.scene.getScene('GameScene')";
const calm = "if (s.mode !== 'none' && !s.over) { s.pendingRecruit = false; s.pendingLevels = 0; s.setMode('none'); }";
const fence = await p.evaluate(S0 => { const s = eval(S0); return s.sishuiObstacles.footprints.filter(f => f.bottom - f.top < 60 && f.right - f.left > 300).map(f => ({ ...f })); }, S);
const L = fence.find(f => f.right < 0);
ck('找到下曲阳法坛营木栅（左段 + 营门）', !!L, fence);
/** 清场；主将站木栅南侧；部曲（6 名）与随从摆到木栅北侧。useNav=false 关掉我方绕障。 */
const setup = (useNav, order) => p.evaluate(([S0, calm, L, useNav, order]) => { const s = eval(S0); eval(calm);
  s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; s.devTimeScale = 2; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  const cx = (L.left + L.right) / 2; s.player.sprite.setPosition(cx, L.bottom + 170);
  window.__nav ??= { route: s.legion.flowRoute, free: s.legion.freeAt, fnav: s.followers?.nav ?? s.allyNav };
  s.legion.flowRoute = useNav ? window.__nav.route : null; s.legion.freeAt = useNav ? window.__nav.free : null; if (s.followers) s.followers.nav = useNav ? window.__nav.fnav : null;
  // 部曲凑够 6 名（dev 接口 __IM.spawnAlly，DevGameScene）；最多补 6 次，免得接口失效时死循环
  for (let k = 0, kinds = ['swordsman', 'spearman', 'archer']; k < 6 && s.allies.filter(a => a.active).length < 6; k++) window.__IM?.spawnAlly?.(kinds[k % 3]);
  if (s.legion.order !== order) s.legion.cycleOrder();
  s.allies.filter(a => a.active).forEach((a, i) => { const x = cx - 100 + (i % 3) * 70, y = L.top - 120 - Math.floor(i / 3) * 60; a.setPosition(x, y); if (a.ai) { a.ai.x = x; a.ai.y = y; a.ai.nextThink = 0; } s.legion.navigation.forget(a.id); });
  (s.followers?.members ?? []).forEach((f, i) => f.place(cx + 60 - i * 60, L.top - 150));
  return { allies: s.allies.filter(a => a.active).length, followers: s.followers?.members?.length ?? 0, order: s.legion.order }; }, [S, calm, L, useNav, order]);
const measure = () => p.evaluate(([S0, calm, L]) => { const s = eval(S0), P = s.player; eval(calm);
  const inF = (x, y) => x > L.left + 4 && x < L.right - 4 && y > L.top + 4 && y < L.bottom - 4;
  const al = s.allies.filter(a => a.active).map(a => ({ d: Math.round(Math.hypot(a.x - P.x, a.y - P.y)), north: a.y < L.top, inF: inF(a.x, a.y) }));
  const fo = (s.followers?.members ?? []).filter(f => !f.downed).map(f => ({ d: Math.round(Math.hypot(f.x - P.x, f.y - P.y)), north: f.y < L.top, inF: inF(f.x, f.y) }));
  return { al, fo, nav: { ...s.legion.navStats }, flow: { live: s.enemyFlow.active, solid: s.enemyFlow.stats.solid } }; }, [S, calm, L]);
const watch = async (ms) => { let inF = 0, last = null; const t0 = Date.now(); while (Date.now() - t0 < ms) { last = await measure(); inF += [...last.al, ...last.fo].filter(x => x.inF).length; await p.waitForTimeout(250); } return { last, inF }; };

// ① 旧行为（我方绕障关）：部曲顶在木栅后
const s0 = await setup(false, 'guard');
const off = await watch(7000);
ck('对照：关掉我方绕障时部曲贴在木栅后过不来（复现用户反馈）', off.last.al.filter(x => x.north).length >= Math.ceil(off.last.al.length / 2), { setup: s0, al: off.last.al.map(x => x.d) });
await p.screenshot({ path: `${out}/before-stuck.png` });
// ② 护阵：绕回主将身边
const s1 = await setup(true, 'guard');
const on = await watch(9000);
ck('护阵：部曲绕过木栅回到主将身边（全部在南侧、200 以内）', on.last.al.length >= 1 && on.last.al.every(x => !x.north && x.d < 200), { setup: s1, al: on.last.al.map(x => x.d), nav: on.last.nav });
ck('随从回到主将身边（南侧、200 以内）', on.last.fo.every(x => !x.north && x.d < 200), { fo: on.last.fo });
await p.screenshot({ path: `${out}/after-guard.png` });
// ②b 我方互相避让（用户「我方自己的兵会重叠一起」）：站定后任意两名我方单位（部曲 / 随从 / 主将）的间距 ≥ 半径之和 − 6（软碰撞允许一点点挤）
await p.waitForTimeout(1500);
const gap = await p.evaluate(S0 => { const s = eval(S0), b = [{ n: '主将', x: s.player.x, y: s.player.y, r: s.player.radius }, ...s.allies.filter(a => a.active).map(a => ({ n: 'u' + a.id, x: a.x, y: a.y, r: a.radius })), ...(s.followers?.members ?? []).filter(f => !f.downed).map(f => ({ n: f.recruit.name, x: f.x, y: f.y, r: 14 }))];
  let worst = { g: 1e9 }; for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) { const g = Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y) - b[i].r - b[j].r; if (g < worst.g) worst = { g: Math.round(g), a: b[i].n, b: b[j].n }; } return { n: b.length, worst, sep: { ...s.allySep.stats } }; }, S);
ck('我方互不重叠：任意两人间距 ≥ 半径之和 − 6', gap.worst.g >= -6, gap);
// ③ 出击：同样能绕回（没有敌人时出击也回主将附近）
await setup(true, 'sortie');
const so = await watch(9000);
ck('出击：部曲同样绕过木栅（全部在南侧）', so.last.al.every(x => !x.north), { al: so.last.al.map(x => x.d), nav: so.last.nav });
ck('全程没有我方单位站进木栅碰撞框', on.inF + so.inF === 0, { on: on.inF, sortie: so.inF, off: off.inF });
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
