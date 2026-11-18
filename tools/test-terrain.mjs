// 战场地形层（src/systems/Terrain.ts、data/terrain.ts）：树挡路、河水减速、桥上不减速。
// ① 第一章广宗外围（GameScene stage 1）：树林在、主将撞树被挡住且贴着滑过去、敌兵追主将时不穿树、走到树后树冠变半透明；
// ② 第十一章泸水（NanzhengGameScene stage 1）：一条河两座桥；主将在水里移速 ×0.6、桥上 ×1；敌兵在水里也慢；刷兵 / 掉落不落水里；
// ③ 第十章火烧连营（YilingGameScene stage 3）：林中起火点着树、烧完成焦桩不再挡路；
// ④ 其余接上地形的关（入蜀 7-1、樊城 9-1、蛮洞 11-3）能进、有树 / 河。
// 每类截图存 assets/review/terrain/（电脑布局 1280×720）。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5197/ node tools/test-terrain.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/terrain';
mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 460) : '')); };
const save = { version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 3, jingnanStages: 3, shuStages: 3, hanzhongStages: 3, xiangfanStages: 3, yilingStages: 3, nanzhengStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: ['xuchang'], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 11, intelSeq: 1 };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });

const setup = async (p, scene) => {
  await p.waitForTimeout(1200);
  await p.evaluate(sc => {
    const g = window.__game, s = g.scene.getScene(sc); window.__S = s; s.__DEV_ACTIONS?.closePopup?.();
    s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
    if (s.chapter?.waves) for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves?.add(i); s.pendingRecruit = false;
    g.loop.sleep(); window.__T = performance.now(); window.__mv = [0, 0]; s.readMove = () => new Phaser.Math.Vector2(window.__mv[0], window.__mv[1]);
    window.__step = n => { for (let i = 0; i < n; i++) { if (s.mode !== 'none' && s.mode !== 'rest' && s.mode !== 'result' && !s.over) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode === 'levelup') s.chooseUpgrade?.(0); if (s.mode !== 'none') s.setMode('none'); } window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); } };
    window.__clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); };
    window.__T0 = () => s.terrain;
  }, scene);
  await p.evaluate(() => window.__step(6));
};
async function openArc(scene, key, stage) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(`${scene} ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::|ERR_/.test(m.text())) errors.push(`${scene} ${m.text()}`); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?dev=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(([scene, key, st]) => { const g = window.__game; g.registry.set(key, st); for (const k of ['xfNoStory', 'nzNoStory', 'shuNoStory', 'yilingNoStory']) g.registry.set(k, 'all'); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: st }); for (const sc of g.scene.getScenes(true)) sc.scene.stop(); if (g.registry.get('battleReady')) g.scene.start(scene); else { g.registry.set('pendingWarlord', scene); g.registry.set('loadBattle', true); g.scene.start('BootScene'); } }, [scene, key, stage]);
  await p.waitForFunction(s => window.__game.scene.isActive(s) && window.__game.scene.getScene(s).player, scene, { timeout: 90000 });
  await setup(p, scene);
  return p;
}
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` });
const step = (p, n) => p.evaluate(n => window.__step(n), n);

// ---------- ① 第一章：树林 ----------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push('ch1 ' + e.message));
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
  await setup(p, 'GameScene');
  const info = await p.evaluate(() => window.__S.terrain?.info ?? null);
  ck('第一章广宗外围：建了地形层（树林）', !!info && info.trees >= 30 && info.rivers === 0, info);
  // 主将正对一棵树往北走（略偏 10 像素）：一路不进树干、最后绕过去
  const r = await p.evaluate(() => {
    const s = window.__S, T = s.terrain, t = T.trees.find(t => !t.burnt && Math.abs(t.x) > 300) ?? T.trees[0], pl = s.player;
    pl.sprite.setPosition(t.x + 10, t.y + 110); window.__mv = [0, -1]; let minD = 1e9;
    for (let i = 0; i < 150; i++) { window.__step(1); minD = Math.min(minD, Math.hypot(pl.x - t.x, pl.y - t.y)); }
    window.__mv = [0, 0]; return { tree: [Math.round(t.x), Math.round(t.y)], minD: Math.round(minD), need: 22 + pl.radius, end: [Math.round(pl.x), Math.round(pl.y)], passed: pl.y < t.y - 40 };
  });
  ck('树挡主将：一路不穿进树干，贴着滑过去（没卡死）', r.minD >= r.need - 2 && r.passed, r);
  // 正对树干（不偏）往北走：被挡住、不会穿过去
  const r2 = await p.evaluate(() => {
    const s = window.__S, T = s.terrain, t = T.trees.find(t => !t.burnt && Math.abs(t.x) > 300) ?? T.trees[0], pl = s.player;
    pl.sprite.setPosition(t.x, t.y + 90); window.__mv = [0, -1]; let minD = 1e9;
    for (let i = 0; i < 60; i++) { window.__step(1); minD = Math.min(minD, Math.hypot(pl.x - t.x, pl.y - t.y)); }
    window.__mv = [0, 0]; return { minD: Math.round(minD), need: 22 + pl.radius };
  });
  ck('树挡主将：正对树干顶着走也穿不过去', r2.minD >= r2.need - 2, r2);
  // 敌兵隔着树追主将：不穿树
  const r3 = await p.evaluate(() => {
    const s = window.__S, T = s.terrain, t = T.trees.find(t => !t.burnt && Math.abs(t.x) > 300) ?? T.trees[0], pl = s.player; window.__clear();
    pl.sprite.setPosition(t.x, t.y + 160); const e = s.spawnEnemy('infantry', t.x + 4, t.y - 140, 1, true); e.hp = e.maxHp = 1e5; let minD = 1e9;
    for (let i = 0; i < 180; i++) { window.__step(1); if (e.active) minD = Math.min(minD, Math.hypot(e.x - t.x, e.y - t.y)); }
    return { minD: Math.round(minD), need: 22 + e.radius, ey: Math.round(e.y), ty: Math.round(t.y), around: e.y > t.y };
  });
  ck('树挡敌兵：隔着树追主将时绕过树干，不穿树', r3.minD >= r3.need - 3 && r3.around, r3);
  // 树冠遮挡
  const r4 = await p.evaluate(() => { const s = window.__S, T = s.terrain, t = T.trees.find(t => t.img && !t.burnt && Math.abs(t.x) > 300), pl = s.player; window.__clear(); pl.sprite.setPosition(t.x, t.y - 50); window.__step(3); const a = t.img.alpha; pl.sprite.setPosition(t.x, t.y + 120); window.__step(3); return { behind: a, front: t.img.alpha }; });
  await p.evaluate(() => { const s = window.__S, t = s.terrain.trees.find(t => t.img && Math.abs(t.x) > 300); s.player.sprite.setPosition(t.x + 40, t.y - 40); window.__step(4); });
  await shot(p, '1-woods');
  ck('走到树后面树冠变半透明，走出来恢复', r4.behind < .6 && r4.front === 1, r4);
  await p.close();
}

// ---------- ② 第十一章泸水：河与桥 ----------
{
  const p = await openArc('NanzhengGameScene', 'nanzhengStage', 1);
  const info = await p.evaluate(() => window.__S.terrain?.info ?? null);
  ck('泸水：一条河、两座桥、两岸有林', !!info && info.rivers === 1 && info.bridges === 2 && info.trees >= 15, info);
  // 主将：水里 vs 岸上 vs 桥上，各走 60 帧（往东 / 沿桥向）
  const sp = await p.evaluate(() => {
    const s = window.__S, T = s.terrain, pl = s.player, R = T.rivers[0], seg = R.segs[1];
    const run = (x, y, mx, my) => { pl.sprite.setPosition(x, y); window.__mv = [mx, my]; window.__step(2); const x0 = pl.x, y0 = pl.y, mul = pl.terrainSpeedMul; window.__step(60); window.__mv = [0, 0]; return { d: Math.hypot(pl.x - x0, pl.y - y0), mul }; };
    // 水里：沿河中线走（避开桥）
    let wx = seg.ax + seg.ux * seg.len * .5, wy = seg.ay + seg.uy * seg.len * .5;
    for (let k = 0; k < 20 && T.onBridge(wx, wy, 80); k++) { wx += seg.ux * 60; wy += seg.uy * 60; }
    const water = run(wx, wy, seg.ux, seg.uy);
    const land = run(wx, wy - 260, seg.ux, seg.uy);
    const bg = T.bridge(0); const bridge = run(bg.x - bg.ux * bg.halfLen * .8, bg.y - bg.uy * bg.halfLen * .8, bg.ux, bg.uy);
    window.__wpt = [wx, wy];
    return { water: Math.round(water.d), wMul: water.mul, land: Math.round(land.d), lMul: land.mul, bridge: Math.round(bridge.d), bMul: bridge.mul, ratio: +(water.d / land.d).toFixed(2), bRatio: +(bridge.d / land.d).toFixed(2) };
  });
  ck('河水减速：主将在水里移速 ×0.6（减 40%）', sp.wMul === .6 && sp.ratio > .5 && sp.ratio < .7, sp);
  ck('桥上不减速：沿桥过河与岸上一样快', sp.bMul === 1 && sp.bRatio > .93, sp);
  await p.evaluate(() => { const s = window.__S, bg = s.terrain.bridge(0); s.player.sprite.setPosition(bg.x, bg.y + 20); window.__step(4); });
  await shot(p, '2-river-bridge');
  // 敌兵：水里比岸上慢
  const en = await p.evaluate(() => {
    const s = window.__S, T = s.terrain, pl = s.player, [wx, wy] = window.__wpt, seg = T.rivers[0].segs[1]; window.__clear();
    const run = (x, y) => { window.__clear(); pl.sprite.setPosition(x + seg.ux * 900, y + seg.uy * 900); const e = s.spawnEnemy('infantry', x, y, 1, true); e.hp = e.maxHp = 1e5; e.sprite.setPosition(x, y); const x0 = e.x, y0 = e.y; window.__step(40); return Math.hypot(e.x - x0, e.y - y0); };
    const w = run(wx, wy), l = run(wx, wy - 300); return { water: Math.round(w), land: Math.round(l), ratio: +(w / l).toFixed(2) };
  });
  ck('河水减速：敌兵在水里也慢（约 ×0.6）', en.ratio > .45 && en.ratio < .75, en);
  // 刷兵 / 掉落不落水里
  const sf = await p.evaluate(() => {
    const s = window.__S, T = s.terrain, [wx, wy] = window.__wpt; window.__clear();
    const e = s.spawnEnemy('infantry', wx, wy, 1, true); const eIn = T.inWater(e.x, e.y);
    s.spawnGem(wx + 30, wy, 1); const g = s.gems.filter(g => g.active).sort((a, b) => Math.hypot(a.x - wx, a.y - wy) - Math.hypot(b.x - wx, b.y - wy))[0];
    return { enemyInWater: eIn, gemInWater: g ? T.inWater(g.x, g.y) : null, moved: T.stats.moved };
  });
  ck('刷兵 / 掉落落在水里时挪到岸上', sf.enemyInWater === false && sf.gemInWater === false && sf.moved >= 2, sf);
  // 部曲在水里也慢（Ally.moveTo 走地形倍率）
  const al = await p.evaluate(async () => { const url = performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes('/src/entities/Ally.ts')) ?? '/src/entities/Ally.ts'; const A = (await import(url)).Ally; /* 用游戏实际加载的那份模块（常开 dev server 热更新后裸路径是另一份实例） */ const [wx, wy] = window.__wpt; return { hook: typeof A?.terrainMul === 'function', water: A?.terrainMul?.(wx, wy), land: A?.terrainMul?.(wx, wy - 300) }; });
  ck('部曲在水里也减速（地形倍率接到部曲移动）', al.hook && al.water === .6 && al.land === 1, al);
  await p.close();
}

// ---------- ③ 第十章火烧连营：树会被烧 ----------
{
  const p = await openArc('YilingGameScene', 'yilingStage', 3);
  const r = await p.evaluate(() => {
    const s = window.__S, T = s.terrain; if (!T) return { terrain: false };
    const t = T.trees.find(t => !t.burnt), n0 = T.navBoxes().length;
    const fire = s.fire; const lit = fire?.igniteAt(t.x, t.y, s.combatNow);
    window.__tree = t; return { terrain: true, trees: T.trees.length, lit, n0 };
  });
  await p.evaluate(() => { const t = window.__tree; window.__S.player.sprite.setPosition(t.x + 150, t.y + 90); });
  await step(p, 30); await shot(p, '3-forest-fire');
  await step(p, 260);
  const r2 = await p.evaluate(() => { const s = window.__S, T = s.terrain, t = window.__tree, pl = s.player; pl.sprite.setPosition(t.x, t.y + 70); window.__mv = [0, -1]; let minD = 1e9; for (let i = 0; i < 50; i++) { window.__step(1); minD = Math.min(minD, Math.hypot(pl.x - t.x, pl.y - t.y)); } window.__mv = [0, 0]; return { burnt: t.burnt, stats: T.stats.burnt, nav: T.navBoxes().length, minD: Math.round(minD) }; });
  ck('火烧连营：起火点着林中的树，烧完成焦桩、不再挡路', r.terrain && r.trees >= 30 && r2.burnt && r2.stats >= 1 && r2.nav < r.n0 && r2.minD < 20, { r, r2 });
  await p.evaluate(() => { const t = window.__tree; window.__S.player.sprite.setPosition(t.x + 150, t.y + 90); window.__step(3); });
  await shot(p, '3-forest-ash');
  await p.close();
}

// ---------- ④ 其他关：能进、有地形 ----------
for (const [scene, key, stage, name, want] of [['ShuGameScene', 'shuStage', 1, '入蜀 7-1 山道松竹林', 'trees'], ['XiangfanGameScene', 'xiangfanStage', 1, '樊城 9-1 城南河与桥', 'river'], ['NanzhengGameScene', 'nanzhengStage', 3, '蛮洞 11-3 密林', 'trees']]) {
  const p = await openArc(scene, key, stage);
  const info = await p.evaluate(() => window.__S.terrain?.info ?? null);
  await p.evaluate(want => { const s = window.__S, T = s.terrain; if (!T) return; if (want === 'river') { const bg = T.bridge(1) ?? T.bridge(0); s.player.sprite.setPosition(bg.x, bg.y - 140); } else { const t = T.trees[Math.floor(T.trees.length / 2)]; s.player.sprite.setPosition(t.x + 80, t.y + 60); } window.__step(6); }, want);
  await shot(p, `4-${scene}-${stage}`);
  ck(`${name}：建了地形层`, !!info && (want === 'river' ? info.rivers >= 1 && info.bridges >= 2 : info.trees >= 20), info);
  await p.close();
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
