// 第二章 · 西凉军战法：铁骑突阵、飞熊军、骑兵加强。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-xiliang.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/new-content';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d) : '')); };
const save = { version: 8, yellowStages: 3, dongzhuoStages: 2, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: false }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 1, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 2 };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const open = async (layout, westStage) => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(layout + ' console ' + m.text()); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 60000 });
  await p.evaluate(ws => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'hulao', westStage: ws }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(g.registry.get('battleReady') ? 'GameScene' : 'BootScene'); if (!g.registry.get('battleReady')) g.registry.set('loadBattle', true); }, westStage);
  await p.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.getScene('GameScene').xiliang, null, { timeout: 60000 });
  await p.waitForTimeout(1200);
  // 关掉随机刷怪，避免干扰
  await p.evaluate(G0 => { const s = eval(G0); s.spawnTimer = s.eliteTimer = 1e9; s.player.damageImmune = false; }, G);
  return p;
};
const quiet = (p) => p.evaluate(G0 => { const s = eval(G0); s.spawnTimer = 1e9; s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.deactivate(); }, G);

for (const layout of ['mobile', 'desktop']) {
  // —— 2-2 荥阳：骑兵加强、铁骑突阵、飞熊军 ——
  const p = await open(layout, 2);
  const info = await p.evaluate(G0 => { const s = eval(G0); return { name: s.chapter.name, cav: s.chapter.enemies.cavalry, x: !!s.xiliang }; }, G);
  ck(`[${layout}] 2-2 荥阳启用西凉战法；骑兵 生命 42 / 速度 92 / 伤害 9`, info.x && info.name.includes('荥阳') && info.cav.hp === 42 && info.cav.speed === 92 && info.cav.damage === 9, info);
  // 铁骑突阵：预警期间不动，之后沿道冲锋
  const r0 = await p.evaluate(G0 => { const s = eval(G0); s.player.invulnUntil = 0; const id = s.xiliang.startRaid(s.combatNow); const riders = s.enemies.filter(e => e.active && e.kind === 'cavalry'); return { id, n: riders.length, pos: riders.map(e => [Math.round(e.x), Math.round(e.y)]), lane: !!s.children.getByName('xiliang-raid-lane'), hp: s.player.hp }; }, G);
  ck(`[${layout}] 突阵：三骑并排就位并亮出冲锋道`, r0.id > 0 && r0.n >= 3 && r0.lane, r0);
  await p.waitForTimeout(500);
  const r1 = await p.evaluate(G0 => { const s = eval(G0); return s.enemies.filter(e => e.active && e.kind === 'cavalry').map(e => [Math.round(e.x), Math.round(e.y)]); }, G);
  await p.screenshot({ path: `${out}/${layout}-xiliang-raid-warn.png` });
  ck(`[${layout}] 预警期间骑兵原地待发（被其他兵挤动不超过 12 像素）`, r1.slice(0, 3).every((q, i) => Math.hypot(q[0] - r0.pos[i][0], q[1] - r0.pos[i][1]) <= 12), { r0: r0.pos, r1 });
  // 预警结束后冲锋：车道穿过主将附近，主将被撞（站着不动）
  let hit = null;
  for (let i = 0; i < 60; i++) { await p.waitForTimeout(100); hit = await p.evaluate(G0 => { const s = eval(G0); return { hp: s.player.hp, raids: s.xiliang.activeRaids, moved: s.enemies.filter(e => e.active && e.kind === 'cavalry').map(e => [Math.round(e.x), Math.round(e.y)]) }; }, G); if (hit.raids === 0) break; }
  ck(`[${layout}] 冲锋贯穿：骑兵离开起点，站在道上的主将受伤`, hit.moved.some(m => !r0.pos.some(q => q[0] === m[0] && q[1] === m[1])) && hit.hp < r0.hp, { hit, before: r0.hp });
  if (layout === 'desktop') await p.screenshot({ path: `${out}/${layout}-xiliang-raid-charge.png` });
  ck(`[${layout}] 冲过后归入普通骑兵（突阵结束）`, hit.raids === 0, hit);
  // 飞熊军：重甲（弓弩减半）、近身盾击
  const f = await p.evaluate(G0 => { const s = eval(G0), x = s.xiliang, d = x.feixiongDef(), e = s.spawnEnemy('shield', s.player.x + 300, s.player.y, undefined, true, d); return { ok: !!e, hp: e?.hp, def: { hp: d.hp, variant: d.variant, tint: d.tint, tex: d.walkVisual?.texture, atk: d.attackVisual }, arrow: x.incoming(e, 'arrow'), melee: x.incoming(e, 'melee') }; }, G);
  ck(`[${layout}] 飞熊军：生命 140、正式行走 / 盾击图、弓弩伤害 ×0.5、近战 ×1`, f.ok && f.def.variant === 'feixiong' && f.def.hp === 140 && f.arrow === .5 && f.melee === 1 && f.def.tex === 'feixiong_walk' && f.def.atk === 'feixiong_attack', f);
  const fa = await p.evaluate(G0 => { const s = eval(G0), e = s.enemies.find(x => x.active && x.def.variant === 'feixiong'); const h0 = e.hp; s.hitEnemy(e, 20, s.combatNow, 'arrow', false, false); const h1 = e.hp; s.hitEnemy(e, 20, s.combatNow, 'melee', false, false); return { h0, h1, h2: e.hp }; }, G);
  ck(`[${layout}] 实际受击：箭伤约为刀伤一半`, fa.h0 - fa.h1 > 0 && (fa.h1 - fa.h2) > (fa.h0 - fa.h1) * 1.5, fa);
  const bash = await p.evaluate(async G0 => { const s = eval(G0), e = s.enemies.find(x => x.active && x.def.variant === 'feixiong'); e.sprite.setPosition(s.player.x + 60, s.player.y); s.player.invulnUntil = 0; const hp0 = s.player.hp, x0 = s.player.x; await new Promise(r => setTimeout(r, 1200)); return { hp0, hp1: s.player.hp, dx: s.player.x - x0 }; }, G);
  ck(`[${layout}] 飞熊军贴身：蓄力后举盾猛撞，主将受伤并被撞退`, bash.hp1 < bash.hp0 && bash.dx < -20, bash);
  if (layout === 'mobile') {
    await p.evaluate(G0 => { const s = eval(G0), d = s.xiliang.feixiongDef(); for (let i = 0; i < 3; i++) s.spawnEnemy('shield', s.player.x - 120 + i * 70, s.player.y - 150, undefined, true, d); }, G);
    await p.waitForTimeout(700); await p.screenshot({ path: `${out}/${layout}-feixiong.png` });
  }
  // 排期：50 秒后自动突阵，40 秒后自动补飞熊军
  const sched = await p.evaluate(async G0 => { const s = eval(G0); for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.deactivate(); const before = s.enemies.filter(e => e.active && e.def.variant === 'feixiong').length; for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; s.elapsed = 55; await new Promise(r => setTimeout(r, 400)); return { mode: s.mode, raids: s.xiliang.activeRaids, fx: s.enemies.filter(e => e.active && e.def.variant === 'feixiong').length, before }; }, G);
  ck(`[${layout}] 本关 50 秒后自动发起突阵、40 秒后补飞熊军`, sched.raids >= 1 && sched.fx >= 1, sched);
  await p.close();
}
// —— 2-1 汜水关：只有突阵、无飞熊军；攻城战不启用 ——
{
  const p = await open('mobile', 1);
  const r = await p.evaluate(async G0 => { const s = eval(G0); for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; s.elapsed = 60; await new Promise(r => setTimeout(r, 500)); return { mode: s.mode, raids: s.xiliang.activeRaids, fx: s.enemies.filter(e => e.active && e.def.variant === 'feixiong').length, cav: s.chapter.enemies.cavalry.hp }; }, G);
  ck('2-1 汜水关：有突阵、不出飞熊军、骑兵同样加强', r.raids >= 1 && r.fx === 0 && r.cav === 42, r);
  const siege = await p.evaluate(async () => { const m = await import('/src/data/siege.ts'), c = await import('/src/world/WorldCities.ts'); return m.siegeBattle(c.cityById('xuchang'), 'caocao').enemies.cavalry.hp; });
  ck('攻城战骑兵沿用原值（不受第二章加强影响）', siege === 34, siege);
  await p.close();
}
await b.close();
const real = errors.filter(e => !/favicon|ERR_|net::/.test(e));
ck('无页面报错 / 控制台错误', real.length === 0, real.slice(0, 5));
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
