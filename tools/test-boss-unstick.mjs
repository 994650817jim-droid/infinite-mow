// 张角卡住不动（2026-11-20 用户「刚刚测试张角卡住不动」）：1-3 由 1-2 首领追击推进而来，下曲阳法坛营木栅留在场上；张角在木栅北侧、主将在南侧。
// 根因（已修）：1-2 张宝的招式组推进后没收，首领分派把张角交给它，张角自己的移动 / 出招不跑。现在张角会走，但
// ① 关掉首领绕障 / 卡住保护：张角直线朝主将走、顶在木栅北侧过不来——记 snapshot()（招式 / 阶段）；
// ② 打开：张角自己绕过木栅（绕障 detours > 0）绕到木栅南侧、到主将中距离（≤ 360）；③ 首领没穿进木栅碰撞框；④ 无报错。
// 用法：BASE=http://127.0.0.1:5187/ node tools/test-boss-unstick.mjs [截图目录]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = process.argv[2] ?? 'assets/review/boss-unstick'; mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
await p.addInitScript(() => { try { localStorage.setItem('im_story', 'off'); } catch { /* */ } });
await p.goto(base + '?dev=1&layout=desktop', { timeout: 180000 }); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
await p.evaluate(() => { const g = window.__game, s0 = g.scene.getScene('MenuScene'); s0.registry.set('runConfig', { chapter: 'huangjin', stage: 2, character: 'zhaoyun', weapon: 'spear' }); for (const s of g.scene.getScenes(true)) s.scene.stop(); s0.scene.start('GameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && window.__game.scene.isActive('GameScene') && s.elapsed > 1; }, null, { timeout: 120000 });
const S = "window.__game.scene.getScene('GameScene')";
const calm = "if (s.mode !== 'none' && !s.over) { s.pendingRecruit = false; s.pendingLevels = 0; s.setMode('none'); }";
// 1-2 首领出阵 → 追击推进到 1-3（同一场景，木栅留着）→ 到首领时刻刷出张角
const st = await p.evaluate(([S0, calm]) => { const s = eval(S0); eval(calm); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; s.devTimeScale = 2;
  s.spawnBoss(); s.advanceFrontline(); for (const e of s.enemies) if (e.active && !e.isSupplySlot && e !== s.boss) e.deactivate();
  return { stage: s.chapter.stage, name: s.chapter.name, fence: s.sishuiObstacles.footprints.filter(f => f.bottom - f.top < 60 && f.right - f.left > 300).length }; }, [S, calm]);
ck('1-2 推进到 1-3（同一场景，下曲阳木栅还在）', st.stage === 3 && st.fence === 2, st);
await p.evaluate(([S0, calm]) => { const s = eval(S0); eval(calm); s.elapsed = s.chapter.waves.at(-1).start + .5; }, [S, calm]);
await p.waitForFunction(S0 => { const s = eval(S0); if (s.mode !== 'none' && !s.over) { s.pendingRecruit = false; s.pendingLevels = 0; s.setMode('none'); } return !!s.zhangjiao && s.boss?.active; }, S, { timeout: 30000 }).catch(() => {});
/** 张角放木栅左段正北，主将站木栅南侧正对着。 */
const place = (guard) => p.evaluate(([S0, calm, guard]) => { const s = eval(S0); eval(calm); const L = s.sishuiObstacles.footprints.find(f => f.bottom - f.top < 60 && f.right - f.left > 300 && f.right < 0), cx = (L.left + L.right) / 2;
  if (!window.__wrap) { window.__wrap = true; const orig = s.bossDetour.bind(s); s.bossDetour = (e, dt) => { if (!window.__guardOff) orig(e, dt); }; }
  window.__guardOff = !guard; for (const e of s.enemies) if (e.active && !e.isSupplySlot && e !== s.boss) e.deactivate(); s.spawnTimer = s.eliteTimer = 1e9;
  s.player.weapons.forEach(w => { w.cooldownLeft = 1e9; w.cd = 1e9; }); s.player.sprite.setPosition(cx, L.bottom + 260);
  const bo = s.boss; bo.hp = bo.maxHp = 1e7; bo.sprite.setPosition(cx, L.top - 220); s.bossStuck?.clear(); window.__L = L; return { boss: s.chapter.bossName, cx }; }, [S, calm, guard]);
const watch = async (ms) => { const t0 = Date.now(); let inFence = 0, last = null, minD = 1e9; while (Date.now() - t0 < ms) {
  last = await p.evaluate(([S0, calm]) => { const s = eval(S0); eval(calm); const bo = s.boss, P = s.player, L = window.__L; return { d: Math.round(Math.hypot(bo.x - P.x, bo.y - P.y)), x: Math.round(bo.x), y: Math.round(bo.y), north: bo.y < L.top, inFence: bo.x > L.left + 6 && bo.x < L.right - 6 && bo.y > L.top + 6 && bo.y < L.bottom - 6, snap: s.zhangjiao?.snapshot?.(), guard: { ...s.bossGuard } }; }, [S, calm]);
  if (last.inFence) inFence++; minD = Math.min(minD, last.d); await p.waitForTimeout(300); } return { last, inFence, minD }; };

const who = await place(false);
const off = await watch(10000);
const snapOff = off.last.snap ? { move: off.last.snap.move, phase: off.last.snap.phase, phase2: off.last.snap.phase2, energy: Math.round(off.last.snap.energy ?? 0), pillars: off.last.snap.pillars, stun: off.last.snap.stun ?? off.last.snap.stunned } : null;
ck(`对照：关掉首领保护时${who.boss}顶在木栅北侧过不来（复现）`, off.last.north, { d: off.last.d, minD: off.minD, at: [off.last.x, off.last.y], snapshot: snapOff });
await p.screenshot({ path: `${out}/before-stuck.png` });
await place(true);
const on = await watch(14000);
ck(`打开首领绕障 / 卡住保护：${who.boss}绕过木栅绕到木栅南侧、到主将中距离（≤360，张角是法师保持中距离、途中还出招）`, on.minD <= 360 && !on.last.north && on.last.guard.detours > 0, { d: on.last.d, minD: on.minD, at: [on.last.x, on.last.y], guard: on.last.guard });
ck('首领没穿进木栅碰撞框', on.inFence === 0 && off.inFence === 0, { on: on.inFence, off: off.inFence });
await p.screenshot({ path: `${out}/after-detour.png` });
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
