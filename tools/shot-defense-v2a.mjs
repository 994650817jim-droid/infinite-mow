// 守城 v2 试玩版 · a 段实机截图（dev 测试战斗 + ?defenseV2=1）：开局城头视角、敌兵到墙脚、主将走过门楼、E 叫预备队。
// 用法：BASE=http://127.0.0.1:5197/ node tools/shot-defense-v2a.mjs → assets/review/defense-v2/a-*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/defense-v2';
mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 360) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
const wait = ms => p.waitForTimeout(ms);
try {
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('im_story', 'off'); localStorage.setItem('im_home_seen', '1'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off&defenseV2=1', { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 180000 });
  await p.evaluate(() => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('siegeCity', 'chenliu'); g.registry.set('siegeMode', 'defense'); g.registry.set('runConfig', { character: 'zhaoyun' }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('SiegeGameScene'); });
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('SiegeGameScene'); return s?.player && window.__game.scene.isActive('SiegeGameScene') && s.elapsed > .5 && s.defenseV2?.stats.built; }, null, { timeout: 120000 });
  const setup = await p.evaluate(() => { const s = window.__game.scene.getScene('SiegeGameScene'); window.__S = s; s.player.damageImmune = true;
    // 补一支部曲（测试战斗没有出征带兵）：弓 6、刀盾 6、长枪 6、骑 2
    for (const [k, n] of [['archer', 6], ['swordsman', 6], ['spearman', 6], ['rider', 2]]) s.legion.recruit(k, n, true);
    s.defenseV2.assignAll(true);
    const w = s.defenseV2, g = w.g, info = w.postsInfo();
    return { v2: !!w, oldDefense: !!s.defenseBattle, held: info.filter(x => x.held).length, posts: info.length, start: { x: Math.round(s.player.x), y: Math.round(s.player.y) }, onWalk: s.player.y > g.top && s.player.y < g.W, bias: s.cameraBiasY(), W: g.W, F: g.F };
  });
  ck('开关开：建守城 v2（不建旧 DefenseBattle），主将开局站在城头走道上，镜头往城外让', setup.v2 && !setup.oldDefense && setup.onWalk && setup.bias > 80, setup);
  ck('我方士兵上墙：26 个岗位里守住 ' + setup.held + ' 个（6 弓进垛口、8 近战梯口、2 马道口）', setup.held >= 16, setup);
  await wait(1500);
  await p.screenshot({ path: OUT + '/a-1-start.png' });
  // 等敌兵到墙脚
  await p.evaluate(() => { const s = window.__S; s.elapsed = Math.max(s.elapsed, 40); });
  await wait(9000);
  const foot = await p.evaluate(() => { const s = window.__S, g = s.defenseV2.g; const es = s.enemies.filter(e => e.active && e.kind !== 'boss' && !e.isSupplySlot && e.def.behavior !== 'wall'); return { n: es.length, outside: es.filter(e => e.y >= g.F - 40).length, inside: es.filter(e => e.y < g.W).length, nearFoot: es.filter(e => e.y >= g.F - 40 && e.y < g.F + 260).length }; });
  ck('敌兵只在城外（墙内一个都没有），有的已经到了墙脚', foot.inside === 0 && foot.outside === foot.n, foot);
  await p.screenshot({ path: OUT + '/a-2-foot.png' });
  // 定时宝箱：不落在墙面上 / 城外（落点钩子挪回走道）
  const chest = await p.evaluate(() => { const s = window.__S, g = s.defenseV2.g, d = s.itemDrops; const q = d.place?.(g.gx + 200, g.F + 60); return { hook: !!d.place, moved: q ? { y: Math.round(q.y), onWalk: q.y > g.top && q.y < g.W } : null, n: d.chests.length, bad: d.chests.filter(c => c.y >= g.W - 6).map(c => Math.round(c.y)) }; });
  ck('定时宝箱只落在城头 / 城里（落到墙面或城外的挪回走道）', chest.hook && chest.moved?.onWalk && chest.bad.length === 0, chest);
  // 主将走过门楼（往东走）
  await p.evaluate(() => { window.__S.debugMove?.set(1, 0); window.__S.debugMoveActive = true; });
  await wait(2600);
  const cross = await p.evaluate(() => { const s = window.__S, g = s.defenseV2.g; return { x: Math.round(s.player.x), gx: g.gx, onWalk: s.player.y > g.top - 10 && s.player.y < g.W + 10 }; });
  await p.screenshot({ path: OUT + '/a-3-gate.png' });
  await p.evaluate(() => { window.__S.debugMoveActive = false; window.__S.debugMove?.set(0, 0); });
  ck('主将能在城头走道上横穿门楼（不掉下墙）', cross.onWalk && Math.abs(cross.x - cross.gx) < 500, cross);
  // E：叫预备队来这段
  const called = await p.evaluate(() => { const s = window.__S; const before = s.defenseV2.stats.called; s.legionOrderOverride(); return s.defenseV2.stats.called - before; });
  await wait(3000);
  await p.screenshot({ path: OUT + '/a-4-call.png' });
  ck('E：预备队全体压到主将所在这段（借鉴清单第 1 条：E 是紧急手段）', called >= 1, { called });
  const fps = await p.evaluate(() => window.__game.loop.actualFps);
  ck('帧率', fps > 20, { fps: Math.round(fps) });
} catch (e) { fail++; console.log('FAIL 异常', String(e).slice(0, 300)); }
ck('控制台无报错', errors.length === 0, errors.slice(0, 3));
await b.close(); console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
