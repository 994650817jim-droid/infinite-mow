// 2-3 火烧洛阳（董卓：纵火、铁骑、飞熊军护驾、半血迁都）与天下地图挑战关「虎牢关 · 三英战吕布」（首胜赤兔）。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5187/ node tools/test-dongzhuo.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/new-content';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d) : '')); };
const mk = (o = {}) => ({ version: 8, yellowStages: 3, dongzhuoStages: 2, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: false }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 1, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 2, intelSeq: 1, ...o });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')", L = "window.__game.scene.getScene('LubuGameScene')", M = "window.__game.scene.getScene('WorldMapScene')";
const page = async (layout, save) => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(layout + ' console ' + m.text()); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  return p;
};
const start = async (p, key, cfg) => {
  await p.evaluate(([key, cfg]) => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', ...cfg }); for (const s of g.scene.getScenes(true)) s.scene.stop(); if (g.registry.get('battleReady')) g.scene.start(key); else { g.registry.set('pendingWarlord', key === 'GameScene' ? undefined : key); g.registry.set('loadBattle', true); g.scene.start('BootScene'); } }, [key, cfg]);
  await p.waitForFunction(key => window.__game.scene.isActive(key) && window.__game.scene.getScene(key).player, key, { timeout: 90000 }); await p.waitForTimeout(1200);
};
const quiet = (p, S) => p.evaluate(S0 => { const s = eval(S0); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate(); for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; }, S);

// —— 2-3 火烧洛阳 · 董卓 ——
for (const layout of ['mobile', 'desktop']) {
  const p = await page(layout, mk());
  await start(p, 'GameScene', { chapter: 'hulao', westStage: 3 }); await quiet(p, G);
  const a = await p.evaluate(G0 => { const s = eval(G0); return { name: s.chapter.name, boss: s.chapter.bossName, style: s.chapter.bossStyle, waves: s.chapter.waves.map(w => w.name) }; }, G);
  ck(`[${layout}] 2-3 改为「火烧洛阳」：首领董卓、3 波`, a.name === '2-3 火烧洛阳' && a.boss === '董卓' && a.style === 'dongzhuo' && a.waves.length === 3, a);
  const sp = await p.evaluate(async G0 => { const s = eval(G0); s.player.damageImmune = false; s.player.invulnUntil = 0; s.spawnBoss(); await new Promise(r => setTimeout(r, 600)); const dz = s.xiliang.dongzhuo; return { ctrl: !!dz, guards: s.enemies.filter(e => e.active && e.def.variant === 'feixiong').length, sheet: s.boss.walkSheet, atk: s.boss.attackSheet }; }, G);
  ck(`[${layout}] 董卓出场：飞熊军三人护驾`, sp.ctrl && sp.guards >= 3, sp);
  ck(`[${layout}] 董卓换上正式图（行走 + 纵火号令动作）`, sp.sheet === 'dongzhuo_walk' && sp.atk === 'dongzhuo_attack', sp);
  const fire = await p.evaluate(async G0 => { const s = eval(G0), dz = s.xiliang.dongzhuo; dz.nextFire = s.combatNow; await new Promise(r => setTimeout(r, 400)); const n = dz.state.fires; const hp0 = s.player.hp; s.player.invulnUntil = 0; await new Promise(r => setTimeout(r, 2200)); return { n, hp0, hp1: s.player.hp }; }, G);
  ck(`[${layout}] 纵火：主将周围 3 处火（预警后燃烧，站在火里掉血）`, fire.n === 3 && fire.hp1 < fire.hp0, fire);
  await p.screenshot({ path: `${out}/${layout}-dongzhuo-fire.png` });
  const rt = await p.evaluate(async G0 => { const s = eval(G0), b = s.boss; const n0 = s.enemies.filter(e => e.active).length; b.hp = Math.floor(b.maxHp * .49); await new Promise(r => setTimeout(r, 400)); const st = s.xiliang.dongzhuo.state; return { st, more: s.enemies.filter(e => e.active).length - n0 }; }, G);
  ck(`[${layout}] 半血迁都：短暂无敌后撤、召一波西凉兵`, rt.st.retreated && rt.st.invulnerable && rt.more >= 8, rt);
  if (layout === 'desktop') {
    const v = await p.evaluate(async G0 => { const s = eval(G0); await new Promise(r => setTimeout(r, 2800)); s.boss.invulnerable = false; s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); for (let i = 0; i < 30 && !s.over; i++) { await new Promise(r => setTimeout(r, 150)); s.collectBossChests?.(); } return { over: s.over, victory: s.victory, sub: s.resultTexts.subtitle.text }; }, G);
    ck('击败董卓：讨伐董卓告捷', v.victory && /董卓败退/.test(v.sub), v);
    const owned = await p.evaluate(() => (JSON.parse(localStorage.getItem('im_items_v2') ?? '{}').stable ?? { owned: [] }).owned);
    ck('击败董卓不送赤兔（赤兔只在三英战吕布首胜获得）', !owned.includes('chitu'), owned);
  }
  await p.close();
}
// —— 天下地图挑战关：锁定 / 开放 / 首胜赤兔 / 再胜无赤兔 ——
{
  const p = await page('mobile', mk({ dongzhuoStages: 1 }));
  const lock = await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).lubuChallengeOpen());
  ck('荥阳未告捷：挑战关未开放', lock === false, lock);
  await p.close();
}
for (const layout of ['mobile', 'desktop']) {
  const p = await page(layout, mk());
  await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(600);
  const node = await p.evaluate(M0 => { const s = eval(M0), m = s.markers.find(x => x.node.id === 'lubu'); s.selected = { kind: 'node', node: m.node }; s.centerOn(m.node); s.refresh(); return { title: s.detailTitle.text, body: s.detail.text, action: s.action.text.text, state: s.nodeState(m.node) }; }, M);
  ck(`[${layout}] 天下地图「三英战吕布」节点：可挑战、写明首胜得赤兔`, node.state === 'open' && /三英战吕布/.test(node.title) && /赤兔/.test(node.body) && node.action === '挑战吕布', node);
  await p.screenshot({ path: `${out}/${layout}-lubu-node.png` });
  if (layout === 'desktop') {
    await p.evaluate(M0 => eval(M0).action.image.emit('pointerup'), M);
    await p.waitForFunction(() => window.__game.scene.isActive('LubuGameScene') && window.__game.scene.getScene('LubuGameScene').player, null, { timeout: 90000 }); await p.waitForTimeout(1200);
    await quiet(p, L);
    const c = await p.evaluate(L0 => { const s = eval(L0); return { name: s.chapter.name, style: s.chapter.bossStyle, waves: s.chapter.waves.length }; }, L);
    ck('挑战关：虎牢关 · 三英战吕布、吕布招式、3 波', c.name === '虎牢关 · 三英战吕布' && c.style === 'lubu' && c.waves === 3, c);
    const win = async () => p.evaluate(async L0 => { const s = eval(L0); s.spawnTimer = s.eliteTimer = 1e9; s.spawnBoss(); s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); for (let i = 0; i < 30 && !s.over; i++) { await new Promise(r => setTimeout(r, 150)); s.collectBossChests?.(); } const st = JSON.parse(localStorage.getItem('im_items_v2') ?? '{}').stable ?? { owned: [] }; return { victory: s.victory, body: s.resultTexts.body.text, chitu: st.owned.filter(h => h === 'chitu').length, clears: JSON.parse(localStorage.getItem('im_world_v1')).lubuClears }; }, L);
    const w1 = await win();
    ck('首次击败吕布：赤兔入马厩、胜场 1', w1.victory && w1.chitu === 1 && w1.clears === 1 && /赤兔/.test(w1.body), w1);
    await p.screenshot({ path: `${out}/${layout}-lubu-result.png` });
    await p.evaluate(L0 => eval(L0).resultPanel.getByName('result-restart').emit('pointerdown'), L);
    await p.waitForTimeout(2500); await p.waitForFunction(() => window.__game.scene.getScene('LubuGameScene')?.player && !window.__game.scene.getScene('LubuGameScene').over, null, { timeout: 90000 }); await p.waitForTimeout(800);
    const w2 = await win();
    ck('再胜吕布：不再给赤兔、胜场 2', w2.victory && w2.chitu === 1 && w2.clears === 2, w2);
    const ach = await p.evaluate(() => JSON.parse(localStorage.getItem('im_achievements') ?? '{}'));
    ck('成就「虎牢扬威」由击败吕布获得', JSON.stringify(ach).includes('lubu'), ach);
  }
  await p.close();
}
await b.close();
const real = errors.filter(e => !/favicon|ERR_|net::/.test(e));
ck('无页面报错 / 控制台错误', real.length === 0, real.slice(0, 5));
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
