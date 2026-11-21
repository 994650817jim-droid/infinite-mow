// 我方士兵不在玩家视野内凭空换位置（2026-11-21 用户「为什么我感觉我自己的兵有时候在瞬移」）。
// ① node 断言：Legion 入列超时 / 卡住归队、LegionTactics 收回兜底、FollowerSquad 落后与收回兜底都不再直接 setPosition / place，统一走 AllyRejoin
//    （屏外直接换、屏内淡出 → 换位 → 尘土淡入）；随从落后超过 snap 改为跑回去。
// ② 浏览器（dev，1-1，天下已开的存档）：屏内一名部曲卡住 2 秒以上 → 淡出淡入归队（faded ≥ 1）；一名随从被甩到 300 外 → 快跑追回（追位速度封顶，不是一下回去）；屏外的直接换（offscreen）；
//    全程 visibleInstant = 0、无报错。GIF=1 时把淡出淡入过程逐帧截到 <截图目录>/frames。
// 用法：BASE=http://127.0.0.1:5187/ [GIF=1] node tools/test-ally-blink.mjs [截图目录] [--node-only]
import { readFileSync, mkdirSync } from 'node:fs';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const L = readFileSync('src/systems/Legion.ts', 'utf8'), T = readFileSync('src/systems/LegionTactics.ts', 'utf8'), F = readFileSync('src/systems/FollowerSquad.ts', 'utf8'), R = readFileSync('src/systems/AllyRejoin.ts', 'utf8'), G = readFileSync('src/scenes/GameScene.ts', 'utf8');
ck('Legion 入列超时不再直接 setPosition 到阵位（先冲刺，再 place → relocate）', !/if \(a\.left <= 0\) u\.setPosition/.test(L) && /sprintMul/.test(L) && /this\.place\(u, q\.x, q\.y\)/.test(L));
ck('Legion 卡住归队走 place（relocate），不直接 setPosition', /this\.stuck\.delete\(u\)/.test(L) && !/freeAt!\(p\.x, p\.y\); u\.setPosition/.test(L));
ck('LegionTactics 收回兜底走 relocate', /if \(this\.relocate\) this\.relocate\(u, home\.x, home\.y\)/.test(T) && /this\.tactics\.relocate=/.test(L));
ck('FollowerSquad 落后超过 snap 改为跑回去（不再 teleport）', !/if \(d > FOLLOW\.snap\) this\.teleport/.test(F) && /d > FOLLOW\.snap\) \{ f\.recalling = true/.test(F));
ck('FollowerSquad 兜底换位走 rejoin', /if \(this\.rejoin\) \{ this\.rejoin\(f, x, y\)/.test(F));
ck('AllyRejoin：只有两端都在镜头外才直接换，否则淡出淡入；visibleInstant 不加', /!this\.visible\(from\.x, from\.y\) && !this\.visible\(to\.x, to\.y\)/.test(R) && /alpha: 0/.test(R) && !/visibleInstant\+\+/.test(R));
ck('GameScene 把部曲 / 随从的兜底接到 AllyRejoin', /this\.legion\.relocate=/.test(G) && /this\.followers\.rejoin = /.test(G));
if (process.argv.includes('--node-only')) { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }

const { chromium } = await import('playwright');
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = process.argv.slice(2).find(a => !a.startsWith('--')) ?? 'assets/review/ally-blink'; mkdirSync(out + '/frames', { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
// 天下已开的存档：名将随从要 worldUnlocked（开局刘关张赵自动编进随从，RosterStore starters）
await p.addInitScript(() => { try { localStorage.setItem('im_story', 'off'); if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('im_world_v1', JSON.stringify({ version: 7, yellowStages: 3, dongzhuoStages: 0, worldAvailable: true, cleared: { huangjin: true }, merits: 0, provisions: 300, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], chapterSeen: 2, tutorialDone: true })); localStorage.setItem('im_last_hero', 'zhaoyun'); } } catch { /* */ } });
await p.goto(base + '?dev=1&layout=desktop&followers=1', { timeout: 180000 }); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
await p.evaluate(() => { const g = window.__game, s0 = g.scene.getScene('MenuScene'); s0.registry.set('runConfig', { chapter: 'huangjin', stage: 1, character: 'zhaoyun', weapon: 'spear' }); for (const s of g.scene.getScenes(true)) s.scene.stop(); s0.scene.start('GameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && window.__game.scene.isActive('GameScene') && s.elapsed > 1; }, null, { timeout: 120000 });
const S = "window.__game.scene.getScene('GameScene')";
const calm = "if (s.mode !== 'none' && !s.over) { s.pendingRecruit = false; s.pendingLevels = 0; s.setMode('none'); }";
await p.evaluate(([S0, calm]) => { const s = eval(S0); eval(calm); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  for (let k = 0; k < 6 && s.allies.filter(a => a.active).length < 4; k++) window.__IM?.spawnAlly?.(['swordsman', 'spearman', 'archer'][k % 3]); }, [S, calm]);
await p.waitForTimeout(1500);
let gifN = 0; const frame = async () => { if (process.env.GIF) await p.screenshot({ path: `${out}/frames/f${String(gifN++).padStart(3, '0')}.png`, clip: { x: 240, y: 110, width: 800, height: 500 } }); };
// ② a 屏内卡住的部曲：钉在屏内一个固定点（每拍拉回，模拟被墙卡住、2 秒没靠近阵位）→ 卡住保护应淡出淡入归队
const st0 = await p.evaluate(S0 => ({ ...eval(S0).allyRejoin.stats }), S);
await p.evaluate(S0 => { const s = eval(S0), u = s.allies.find(a => a.active); window.__U = u; window.__pin = { x: s.player.x + 330, y: s.player.y + 150 }; window.__pinOn = true; const tick = () => { if (!window.__pinOn) return; if (u.view?.sprite?.alpha > .99) u.setPosition(window.__pin.x, window.__pin.y); requestAnimationFrame(tick); }; tick(); }, S);
for (let i = 0; i < 26; i++) { await frame(); await p.waitForTimeout(process.env.GIF ? 60 : 150); const st = await p.evaluate(S0 => eval(S0).allyRejoin.stats.faded, S); if (st > st0.faded) break; }
await p.evaluate(() => { window.__pinOn = false; });
for (let i = 0; i < 10; i++) { await frame(); await p.waitForTimeout(60); }
const st1 = await p.evaluate(S0 => { const s = eval(S0), u = window.__U; return { ...s.allyRejoin.stats, alpha: u.view?.sprite?.alpha, d: Math.round(Math.hypot(u.x - s.player.x, u.y - s.player.y)) }; }, S);
ck('屏内卡住的部曲：淡出 → 换位 → 淡入归队（faded +1），没有屏内瞬移', st1.faded >= st0.faded + 1 && st1.visibleInstant === 0 && st1.alpha > .9, { st0, st1 });
await p.screenshot({ path: `${out}/after-rejoin.png` });
// ② b 随从被甩到 300 外：跑回去（几帧内不会一下子出现在阵位）
const fo = await p.evaluate(S0 => { const s = eval(S0), f = s.followers?.members?.[0]; if (!f) return null; f.place(s.player.x - 300, s.player.y + 40); return { x: f.x, y: f.y }; }, S);
if (fo) {
  await p.waitForTimeout(120);
  const f1 = await p.evaluate(S0 => { const s = eval(S0), f = s.followers.members[0]; return { x: Math.round(f.x), y: Math.round(f.y), recalling: !!f.recalling, d: Math.round(Math.hypot(f.x - s.player.x, f.y - s.player.y)) }; }, S);
  ck('随从被甩到 300 外：快跑追回（速度封顶 行走 × 2.4），120ms 后还在半路——不是「嗖」一下回到阵位（原来指数追位 120ms 就回到 75 内）', f1.d > 150, { from: fo, f1 });
  await p.waitForTimeout(2500);
  const f2 = await p.evaluate(S0 => { const s = eval(S0), f = s.followers.members[0]; return { d: Math.round(Math.hypot(f.x - s.player.x, f.y - s.player.y)), recalling: !!f.recalling }; }, S);
  ck('随从跑回主将身边', f2.d < 160, f2);
} else ck('有名将随从可测', false, null);
// ② c 屏外的直接换：把一名部曲拉到镜头外很远处并钉住 → 兜底直接换（offscreen），不算屏内
const st2 = await p.evaluate(S0 => ({ ...eval(S0).allyRejoin.stats }), S);
await p.evaluate(S0 => { const s = eval(S0), u = s.allies.filter(a => a.active)[1] ?? window.__U; window.__V = u; window.__pin2 = { x: s.player.x + 2600, y: s.player.y }; window.__pinOn2 = true; const tick = () => { if (!window.__pinOn2) return; u.setPosition(window.__pin2.x, window.__pin2.y); requestAnimationFrame(tick); }; tick(); setTimeout(() => { window.__pinOn2 = false; }, 2600); }, S);
await p.waitForTimeout(4200);
const st3 = await p.evaluate(S0 => ({ ...eval(S0).allyRejoin.stats }), S);
ck('全程屏内瞬移次数 = 0（visibleInstant）', st3.visibleInstant === 0, { st2, st3 });
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
