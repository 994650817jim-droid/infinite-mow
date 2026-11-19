// 战场地图 · 军令测试（battle-map-design.md）：电脑布局。需要开发服务器。
//  1. 普通关：军令表有「击退敌军 n/3」+「首领出阵」倒计时，面板显示；小地图、军令面板不压设置 / 行囊 / 用药 / 首领血条。
//  2. API：ordersOf(scene).set / patch / done —— 面板实时更新、完成弹横幅、外部同 id 优先于自动来源；屏外军令箭头出现。
//  3. 首领：首领登场后加「击败 XX」，波次那条完成；击败后首领军令完成。
//  4. G 键开关大地图，Esc 也能关；大地图开着时战斗不暂停。
//  5. 攻城（中城）：「城外 · 破城门」阶段军令 + 攻城限时；切到巷战后据点军令出现、阶段军令换成「巷战 · 占据点」。
//  6. 手机布局：不建小地图 / 面板，军令表照常有。
//  截图：assets/review/battle-map/{normal,boss,siege,big-map}.png
// 用法：BASE=http://127.0.0.1:5199/ node tools/test-battle-map.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/battle-map';
mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 260) : '')); };
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 500, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 12, tutorialDone: true };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });

async function open(layout, start) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(w => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } }, world);
  await p.goto(BASE + `?dev=1&autostart=1&stage=1&layout=${layout}&story=off`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
  if (start) {
    await p.evaluate(st => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer');
      if (st.siege) { s0.registry.set('siegeCity', st.siege); s0.registry.remove('siegeMode'); }
      s0.registry.set('runConfig', { character: 'zhaoyun', ...(st.run ?? {}) }); for (const sc of g.scene.getScenes(true)) if (sc.scene.key !== 'GameScene') sc.scene.stop(); s0.scene.start(st.key); }, start);
    await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed < 8; }, start.key, { timeout: 120000 });
  }
  const key = start?.key ?? 'GameScene';
  await p.evaluate(k => { const s = window.__game.scene.getScene(k); window.__S = s; s.player.damageImmune = true; document.querySelectorAll('[data-dev-panel],.dev-panel').forEach(x => x.style.display = 'none');
    window.__calm = () => { for (let i = 0; i < 12 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') { s.chooseRecruit?.(0); s.__DEV_ACTIONS?.closePopup?.(); } else if (s.mode === 'parley') s.parley?.choose?.('execute'); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } } }; }, key);
  for (let i = 0; i < 10; i++) { await p.evaluate(() => window.__calm()); await p.waitForTimeout(200); }
  return p;
}
const settle = async (p, ms = 700) => { for (let t = 0; t < ms; t += 150) { await p.evaluate(() => window.__calm()); await p.waitForTimeout(150); } };
const orders = p => p.evaluate(() => { const o = window.__S.battleOrders; return o ? o.all().map(x => ({ id: x.id, label: x.label, state: x.state, kind: x.kind, prog: x.progress ? x.progress.cur + '/' + x.progress.max : null })) : null; });
const panel = p => p.evaluate(() => { const s = window.__S, P = s.ordersPanel; return P ? { lines: P.lines, b: P.bounds(), visible: P.container.visible } : null; });

// ———— 1–4：普通关 + 首领（2-2 荥阳）————
{
  const p = await open('desktop', { key: 'GameScene', run: { chapter: 'hulao', westStage: 2 } });
  await settle(p, 1200);
  const o = await orders(p), pn = await panel(p);
  ck('普通关：军令「击退敌军 n/3」', !!o?.find(x => x.id === 'waves' && x.state === 'active' && /\/3$/.test(x.prog ?? '')), o);
  ck('普通关：首领出阵倒计时', (pn?.lines ?? []).some(l => /^首领出阵 \d+:\d\d$/.test(l)), pn?.lines);
  ck('军令面板显示在右侧（舆图卷轴下、右列圆钮左边）', !!pn && pn.visible && pn.b.y >= 72 && pn.b.x + pn.b.w <= 860 && pn.b.x >= 600, pn?.b);
  // 2026-11-19 用户「用药和军令重叠了」：6 条军令 + 用药 / 加点可用 + 右侧台词卡同时出现，右侧 HUD 互不重叠（军令展开 / 收起都查）
  { const hud = async () => p.evaluate(async () => {
      const s = window.__S, names = ['orders-panel', 'potion-button', 'attribute-plus', 'hud-bag', 'hud-pause', 'battle-map-scroll', 'story-bark-card'], out = {};
      for (const c of s.children.list) { const n = c.name; if (!c.visible) continue;
        if (names.includes(n)) { const b = n === 'orders-panel' ? s.ordersPanel.bounds() : c.getBounds(); out[n] = [b.x, b.y, b.x + (b.w ?? b.width), b.y + (b.h ?? b.height)]; }
        if (c.type === 'Container' && c.list?.some(k => k.type === 'Text' && /^(护阵|出击)/.test(k.text ?? ''))) { const b = c.getBounds(); if (b.width < 120) out['legion-order'] = [b.x, b.y, b.right, b.bottom]; } }
      return out; });
    await p.evaluate(async () => { const s = window.__S, { ordersOf } = await import('/src/systems/BattleOrders.ts'), o = ordersOf(s);
      for (let i = 1; i <= 6; i++) o.set('pt' + i, { label: `占据点 ${i} · 城门东侧`, kind: 'point', state: 'active', detail: '站在圈内 6 秒占领', progress: { cur: 0, max: 6 } });
      s.player.growth.unallocated = 3; s.player.hp = s.player.maxHp * .5; for (let i = 0; i < 2; i++) s.supplies?.pouch.push({ amount: 50, texture: 'healing_potion' });
      const { showBarkCard } = await import('/src/ui/StoryBarkCard.ts'); showBarkCard(s, { side: 'right', name: '张角', text: '苍天已死，黄天当立！岁在甲子，天下大吉！' }); });
    await settle(p, 1200);
    const overlaps = r => { const ks = Object.keys(r), bad = []; for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = r[ks[i]], b = r[ks[j]]; if (a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1) bad.push(ks[i] + '×' + ks[j]); } return bad; };
    const r1 = await hud(), pl = (await panel(p))?.lines ?? [];
    await p.screenshot({ path: `${OUT}/hud-crowded.png` });
    await p.evaluate(() => window.__S.ordersPanel.toggleFold()); await settle(p, 300); const r2 = await hud(); await p.evaluate(() => window.__S.ordersPanel.toggleFold()); await settle(p, 300);
    ck('右侧 HUD 不重叠：6 条军令（多的收成「另有 n 条」）+ 用药 + 加点 + 护阵 + 台词卡，展开 / 收起都不压', ['orders-panel', 'potion-button', 'attribute-plus', 'story-bark-card'].every(k => r1[k]) && !overlaps(r1).length && !overlaps(r2).length && pl.some(l => /另有 \d+ 条/.test(l)), { r1, bad1: overlaps(r1), bad2: overlaps(r2), pl });
    await p.evaluate(async () => { const { ordersOf } = await import('/src/systems/BattleOrders.ts'), o = ordersOf(window.__S); for (let i = 1; i <= 6; i++) o.remove('pt' + i); }); await settle(p, 300); }
  // 用户「小地图是可以打开的，平时就是卷轴的样子收缩起来，点击才放大」：平时右上角一卷收起的手卷，不画地图
  const mini = await p.evaluate(() => { const S = window.__S, m = S.children.getByName('battle-map-scroll'), b = m?.getBounds(); return m ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), visible: m.visible, oldMini: !!S.children.getByName('battle-map-mini'), state: S.battleMap.stats.state } : null; });
  ck('舆图平时收成卷轴，在右上角（设置钮左侧、计时器右侧），不压战场', !!mini && mini.visible && mini.x >= 600 && mini.x + mini.w <= 884 && mini.y + mini.h <= 80 && !mini.oldMini && mini.state === 'closed', mini);
  const draws0 = await p.evaluate(() => window.__S.battleMap.stats.draws); await p.waitForTimeout(1000); const draws1 = await p.evaluate(() => window.__S.battleMap.stats.draws);
  ck('卷着时不重画地图', draws1 === draws0, draws1 - draws0);
  await p.screenshot({ path: `${OUT}/scroll-closed.png` });
  // 点卷轴：飞到中央、两轴拉开（中途截一张）→ 展开；8 Hz 重画
  { const c = await p.evaluate(() => { const b = window.__S.children.getByName('battle-map-scroll').getBounds(), cv = document.querySelector('canvas').getBoundingClientRect(), k = cv.width / 960; return { x: cv.x + (b.x + b.width / 2) * k, y: cv.y + (b.y + b.height / 2) * k }; });
    await p.mouse.click(c.x, c.y); await p.waitForTimeout(420);
    const mid = await p.evaluate(() => ({ ...window.__S.battleMap.stats })); await p.screenshot({ path: `${OUT}/scroll-unrolling.png` });
    await p.waitForTimeout(500);
    const op = await p.evaluate(() => { const S = window.__S, l = S.children.getByName('battle-map-scroll-left'), r = S.children.getByName('battle-map-scroll-right'); return { ...S.battleMap.stats, open: S.battleMap.bigOpen, mode: S.mode, gap: Math.round(r.x - l.x), icon: S.children.getByName('battle-map-scroll').visible }; });
    const d0 = op.draws; await p.waitForTimeout(1000); const d1 = await p.evaluate(() => window.__S.battleMap.stats.draws);
    await p.screenshot({ path: `${OUT}/scroll-open.png` });
    const pm = await p.evaluate(() => { const v = window.__S.battleMap.big; const P = v?.painted; return P ? { ...P.stats, base: !!window.__S.children.list.length, title: P.root.getByName('painted-map-deco')?.getByName?.('painted-map-title')?.text ?? (P.root.list.find(o => o.name === 'painted-map-deco')?.list.find(o => o.name === 'painted-map-title')?.text) } : null; });
    ck('手绘舆图（用户「小地图还是有点太简陋」）：底图画进 RenderTexture（一次）、标记有（敌军改红点后，这一刻没有要点 / 友军时图标可为 0）、题签写关名', !!pm && pm.bakes >= 1 && pm.bakes <= 2 && pm.stamps > 10 && pm.icons + pm.dots >= 1 && /荥阳/.test(pm.title ?? ''), pm);
    ck('敌军红点（2026-11-19 用户「敌军过来就以红点显示就好」）：每兵一点，不再画兵群图标 / 淡墨团；最多 150 个', !!pm && pm.dots > 0 && pm.dots <= 150, pm && { dots: pm.dots, icons: pm.icons });
    ck('点卷轴展开：先飞到中央、两轴往两边拉开（中途），展开后地图在纸上、8 Hz 重画、不暂停', mid.state === 'opening' && mid.t > 0 && mid.t < 1 && op.state === 'open' && op.t === 1 && op.gap >= 640 && !op.icon && op.mode === 'none' && d1 - d0 >= 4 && d1 - d0 <= 12, { mid, op, hz: d1 - d0 });
    await p.mouse.click(c.x > 900 ? 480 : 480, 270); await p.waitForTimeout(800);
    const cl = await p.evaluate(() => { const S = window.__S, m = S.children.getByName('battle-map-scroll'); return { state: S.battleMap.stats.state, open: S.battleMap.bigOpen, icon: m.visible, x: Math.round(m.x), y: Math.round(m.y), angle: m.angle }; });
    ck('再点卷轴：卷起、飞回角上', cl.state === 'closed' && !cl.open && cl.icon && cl.x > 700 && cl.y < 60 && cl.angle === 0, cl); }
  // API
  await p.evaluate(() => { const s = window.__S, pl = s.player; s.battleOrders.set('test-armory', { label: '占领武库', kind: 'main', progress: { cur: 1, max: 3 }, order: 0, at: () => ({ x: pl.x + 1400, y: pl.y + 200 }) }); });
  await settle(p, 500);
  let pn2 = await panel(p);
  ck('API set：面板实时显示「占领武库 1/3」', (pn2?.lines ?? []).some(l => l.includes('占领武库 1/3')), pn2?.lines);
  const arrow = await p.evaluate(() => { const t = window.__S.children.getByName('orders-arrow'); const txt = window.__S.children.list.find(o => o.type === 'Text' && /占领武库 · \d+ 步/.test(o.text ?? '')); return { g: !!t, text: txt?.visible ? txt.text : null }; });
  ck('屏外军令箭头：指向「占领武库」并标距离', !!arrow.text, arrow);
  await p.evaluate(() => window.__S.battleOrders.patch('test-armory', { progress: { cur: 2, max: 3 } })); await settle(p, 400); pn2 = await panel(p);
  ck('API patch：进度更新为 2/3', (pn2?.lines ?? []).some(l => l.includes('占领武库 2/3')), pn2?.lines);
  // 横幅画在容器里，直接记录 showWaveBanner 的调用
  await p.evaluate(() => { const s = window.__S, o = s.showWaveBanner.bind(s); window.__banners = []; s.showWaveBanner = (t, d, c) => { window.__banners.push(t + '|' + (c ?? '')); return o(t, d, c); }; window.__S.battleOrders.done('test-armory'); }); await settle(p, 400);
  const fin = await p.evaluate(() => ({ done: window.__S.battleOrders.completed.map(c => c.label), banner: window.__banners.filter(b => b.startsWith('军令完成') && b.includes('占领武库')).length }));
  ck('API done：记入完成 + 弹「军令完成」横幅', fin.done.includes('占领武库') && fin.banner > 0, fin);
  await p.evaluate(() => window.__S.battleOrders.set('waves', { label: '外部覆盖', kind: 'main', order: 1 })); await settle(p, 600);
  const ext = await orders(p);
  ck('外部同 id 优先：自动来源不覆盖', ext?.find(x => x.id === 'waves')?.label === '外部覆盖', ext?.find(x => x.id === 'waves'));
  await p.evaluate(() => window.__S.battleOrders.remove('waves')); await settle(p, 400);
  await p.screenshot({ path: `${OUT}/normal.png` });
  // 大地图
  await p.keyboard.press('KeyM'); await settle(p, 900);
  const big1 = await p.evaluate(() => ({ open: window.__S.battleMap.bigOpen, mode: window.__S.mode }));
  await p.screenshot({ path: `${OUT}/big-map.png` });
  await p.keyboard.press('KeyM'); await settle(p, 800);
  const big2 = await p.evaluate(() => window.__S.battleMap.bigOpen);
  await p.keyboard.press('KeyM'); await settle(p, 900); await p.keyboard.press('Escape'); await settle(p, 800);
  const big3 = await p.evaluate(() => ({ open: window.__S.battleMap.bigOpen, mode: window.__S.mode }));
  ck('M 展开舆图（不暂停）/ 再按 M 卷起 / Esc 也能卷起（用户「小地图换成m快捷键」）', big1.open && big1.mode === 'none' && !big2 && !big3.open && big3.mode === 'none', { big1, big2, big3 });
  // 用户「军令也可以收起来」：G 收起成小签「军令 n/m」、记在 localStorage；收着时有军令完成，小签闪；点匾额展开
  { await p.keyboard.press('KeyG'); await settle(p, 500);
    const f1 = await p.evaluate(() => { const o = window.__S.ordersPanel; return { folded: o.isFolded, lines: o.lines, store: localStorage.getItem('im_orders_folded'), h: o.bounds().h }; });
    await p.screenshot({ path: `${OUT}/orders-folded.png` });
    await p.evaluate(() => window.__S.battleOrders.set('fold-test', { label: '测试军令', kind: 'main', order: 5 })); await settle(p, 400);
    await p.evaluate(() => window.__S.battleOrders.done('fold-test')); await settle(p, 500);
    const f2 = await p.evaluate(() => window.__S.ordersPanel.stats.flashes);
    await p.evaluate(() => window.__S.ordersPanel.container.getByName('orders-panel-head').emit('pointerdown')); await settle(p, 400);
    const f3 = await p.evaluate(() => { const o = window.__S.ordersPanel; return { folded: o.isFolded, store: localStorage.getItem('im_orders_folded'), h: o.bounds().h, n: o.lines.length }; });
    await p.evaluate(() => window.__S.battleOrders.remove('fold-test'));
    ck('军令可收起：G 收成「军令 n/m」小签并记住；收着时完成一条会闪；点匾额展开', f1.folded && /^军令 \d+\/\d+/.test(f1.lines[0] ?? '') && f1.store === '1' && f1.h <= 30 && f2 >= 1 && !f3.folded && f3.store === null && f3.h > 30, { f1, f2, f3 }); }
  // 首领
  await p.evaluate(() => { const s = window.__S; s.spawnBoss(); }); await settle(p, 1500);
  const ob = await orders(p);
  ck('首领登场：加「击败徐荣」，波次那条完成', !!ob?.find(x => x.kind === 'boss' && x.label.includes('徐荣') && x.state === 'active') && !ob?.find(x => x.id === 'waves' && x.state === 'active'), ob);
  const crowd = await p.evaluate(() => { const s = window.__S, P = s.ordersPanel.bounds(), barY = 540 - 68 - 24; return { panelBottom: P.y + P.h, barY }; });
  ck('军令面板不压首领血条', crowd.panelBottom < crowd.barY, crowd);
  await p.screenshot({ path: `${OUT}/boss.png` });
  await p.evaluate(() => { const s = window.__S; s.devOneHit = true; });
  for (let i = 0; i < 40; i++) { await p.evaluate(() => { const s = window.__S, bo = s.boss; window.__calm(); if (s.awaitingChest) s.collectBossChests?.(); if (bo?.active) { s.player.sprite.setPosition(bo.x + 60, bo.y); } }); await p.waitForTimeout(250); if (await p.evaluate(() => !window.__S.boss?.active)) break; }
  await settle(p, 800);
  const od = await orders(p);
  ck('首领击败（或劝降）后首领军令完成', !!od?.find(x => x.kind === 'boss' && x.state === 'done'), od);
  await p.close();
}
// ———— 5：攻城（中城 陈留）————
{
  const p = await open('desktop', { key: 'SiegeGameScene', siege: 'chenliu' });
  await settle(p, 1500);
  const o = await orders(p), pn = await panel(p);
  ck('攻城：阶段军令「城外 · 破城门」+ 限时', !!o?.find(x => x.id === 'siege-phase' && x.label.startsWith('城外') && x.state === 'active') && (pn?.lines ?? []).some(l => /^限时 \d+:\d\d$/.test(l)), { o, lines: pn?.lines });
  await p.screenshot({ path: `${OUT}/siege.png` });
  await p.evaluate(async () => { const M = window.__S.mid; M.transition('street'); const t = performance.now(); while (performance.now() - t < 4200) { window.__calm(); await new Promise(r => setTimeout(r, 150)); } });
  await settle(p, 800);
  const o2 = await orders(p);
  ck('攻城城内段：每处要点一条军令（带进度 / 位置），阶段军令换成「城内 · 夺取要点」并计「占 X/N」', o2?.filter(x => x.id.startsWith('siege-point-')).length === 4 && !!o2?.find(x => x.id === 'siege-phase' && /^(城内|巷战)/.test(x.label) && x.prog === '0/3'), o2);
  await p.screenshot({ path: `${OUT}/siege-street.png` });
  await p.close();
}
// ———— 6：手机布局 ————
{
  const p = await open('mobile', { key: 'GameScene', run: { chapter: 'hulao', westStage: 2 } });
  await settle(p, 800);
  const m = await p.evaluate(() => ({ map: !!window.__S.battleMap, panel: !!window.__S.ordersPanel, orders: !!window.__S.battleOrders, mini: !!window.__S.children.getByName('battle-map-mini') || !!window.__S.children.getByName('battle-map-scroll') }));
  ck('手机布局：不建小地图 / 面板，军令表照常有', !m.map && !m.panel && m.orders && !m.mini, m);
  await p.close();
}
ck('无页面错误', errors.length === 0, errors.slice(0, 4));
console.log(fail ? `FAILED ${fail}` : 'ALL PASS');
await b.close();
process.exit(fail ? 1 : 0);
