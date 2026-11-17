// 关卡目标：每关 3 波；1-1 / 1-2 普通推波（3 波后首领登场）、2-2 护送伤兵车 → 徐荣；超时判失败；HUD 目标行。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-objectives.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/new-content';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d) : '')); };
const save = { version: 8, yellowStages: 3, dongzhuoStages: 2, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: false }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 1, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 2 };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const open = async (layout, cfg) => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(layout + ' console ' + m.text()); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(cfg => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', ...cfg }); for (const s of g.scene.getScenes(true)) s.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('GameScene'); else { g.registry.set('loadBattle', true); g.scene.start('BootScene'); } }, cfg);
  await p.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.getScene('GameScene').player, null, { timeout: 90000 });
  await p.waitForTimeout(1200);
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; }, G);
  return p;
};
const info = p => p.evaluate(G0 => { const s = eval(G0); return { name: s.chapter.name, waves: s.chapter.waves.length, obj: s.objective?.o.kind ?? null, text: s.children.getByName('objective-text')?.text, boss: !!s.boss, bossName: s.chapter.bossName, state: s.objective?.state }; }, G);

// 1-1 新手关：用户 2026-11-16「1-1 就 3 波，不需要设计歼敌」→ 普通推波，打完 3 波张梁登场（只在电脑布局验收）
{
  const p = await open('desktop', { chapter: 'huangjin', stage: 1 });
  const a = await info(p);
  const vis = await p.evaluate(G0 => !!eval(G0).children.getByName('objective-text')?.visible, G);
  ck('[desktop] 1-1：3 波（外围哨兵 / 刀盾阻路 / 张梁迎战）、无歼敌目标、无目标行', a.waves === 3 && a.obj === null && !vis, { a, vis });
  const mix = await p.evaluate(G0 => { const s = eval(G0), c = s.chapter, tally = t => { const n = {}; for (let i = 0; i < 2000; i++) { const k = c.pickEnemy(t); n[k] = (n[k] ?? 0) + 1; } return n; }; return { w1: tally(20), w2: tally(90), w3: tally(150), names: c.waves.map(w => w.name) }; }, G);
  ck('[desktop] 1-1 波次构成：第 1 波全刀兵；第 2 波约 15% 刀盾兵；第 3 波加入约 10% 弓手', Object.keys(mix.w1).join() === 'infantry' && mix.w2.shield > 200 && mix.w2.shield < 420 && !mix.w2.archer && mix.w3.archer > 120 && mix.w3.archer < 300 && mix.names.join() === '外围哨兵,刀盾阻路,张梁迎战', mix);
  const sh = await p.evaluate(G0 => { const s = eval(G0), e = s.spawnEnemy('shield', s.player.x + 300, s.player.y, 1, true); return { sheet: e.walkSheet, shield: e.shieldMax }; }, G);
  ck('[desktop] 1-1 刀盾兵用黄巾刀盾兵造型、带盾', /yellow_shield/.test(sh.sheet) && sh.shield > 0, sh);
  const r = await p.evaluate(async G0 => { const s = eval(G0); for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; const t = s.chapter.waves[s.chapter.waves.length - 1].start; s.elapsed = Math.max(0, t - 2); await new Promise(r => setTimeout(r, 300)); const early = !!s.boss; s.elapsed = t + .5; await new Promise(r => setTimeout(r, 700)); return { early, boss: !!s.boss, name: s.chapter.bossName }; }, G);
  ck('[desktop] 1-1：最后一波开始张梁登场，之前不出', !r.early && r.boss && r.name === '张梁', r);
  await p.screenshot({ path: `${out}/desktop-1-1-waves.png` });
  await p.close();
}
// 1-2 下曲阳：用户反馈「1-2 就正常推波数进，不需要黄巾祭坛」→ 普通推波，打完 3 波张宝登场（只在电脑布局验收）
{
  const p = await open('desktop', { chapter: 'huangjin', stage: 2 });
  const a = await info(p);
  const props = await p.evaluate(G0 => { const s = eval(G0); return { altars: s.children.list.filter(o => o.type === 'Text' && /黄巾祭坛/.test(o.text)).length, textVisible: !!s.children.getByName('objective-text')?.visible }; }, G);
  ck('[desktop] 1-2：3 波、无关卡目标、场上没有黄巾祭坛', a.waves === 3 && a.obj === null && props.altars === 0 && !props.textVisible, { a, props });
  const r = await p.evaluate(async G0 => { const s = eval(G0); for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; const t = s.chapter.waves[s.chapter.waves.length - 1].start; s.elapsed = Math.max(0, t - 2); await new Promise(r => setTimeout(r, 300)); const early = !!s.boss; s.elapsed = t + .5; await new Promise(r => setTimeout(r, 700)); return { early, boss: !!s.boss, name: s.chapter.bossName, t }; }, G);
  ck('[desktop] 1-2：打完波次（最后一波开始）张宝登场，之前不出', !r.early && r.boss && r.name === '张宝', r);
  await p.screenshot({ path: `${out}/desktop-1-2-waves.png` });
  await p.close();
}
// 2-2 荥阳（2026-11-17 用户：伤病车玩法不要了）：普通 3 波 → 按时出首领徐荣 → 倒地掉宝箱 → 捡起 → 胜利
for (const layout of ['mobile', 'desktop']) {
  const p = await open(layout, { chapter: 'hulao', westStage: 2 });
  const a = await info(p);
  const ui = await p.evaluate(G0 => { const s = eval(G0); return { obj: !!s.objective, hud: s.children.getByName('objective-text')?.visible ?? false, cart: !!s.children.getByName('stage-escort-cart') }; }, G);
  ck(`[${layout}] 2-2：3 波、没有关卡目标（无伤兵车、无护送提示）`, a.waves === 3 && !a.obj && !ui.obj && !ui.hud && !ui.cart, { a, ui });
  await p.screenshot({ path: `${out}/${layout}-xingyang-no-escort.png` });
  if (layout === 'desktop') {
    const r = await p.evaluate(async G0 => { const s = eval(G0); for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; s.elapsed = 250; await new Promise(r => setTimeout(r, 900)); return { over: s.over, boss: !!s.boss, name: s.chapter.bossName }; }, G);
    ck('2-2：不会因时间耗尽失败，按时出首领徐荣', !r.over && r.boss && r.name === '徐荣', r);
    const w = await p.evaluate(async G0 => { const s = eval(G0); s.player.damageImmune = true; s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); for (let i = 0; i < 40 && !s.over && s.mode !== 'rest'; i++) { await new Promise(r => setTimeout(r, 150)); s.collectBossChests?.(); } return { over: s.over, victory: s.victory, mode: s.mode }; }, G);
    ck('2-2：击败徐荣、捡起宝箱后通关', (w.over && w.victory) || w.mode === 'rest', w);
  }
  await p.close();
}
{
  const p = await open('mobile', { chapter: 'hulao', westStage: 1 });
  const a = await info(p);
  const r = await p.evaluate(async G0 => { const s = eval(G0); for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; s.elapsed = 91; await new Promise(r => setTimeout(r, 600)); return { boss: !!s.boss, text: s.children.getByName('objective-text')?.visible ?? false }; }, G);
  ck('2-1 汜水关：3 波、无目标行，90 秒华雄出阵', a.waves === 3 && a.obj === null && r.boss && !r.text, { a, r });
  await p.close();
}
await b.close();
const real = errors.filter(e => !/favicon|ERR_|net::/.test(e));
ck('无页面报错 / 控制台错误', real.length === 0, real.slice(0, 5));
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
