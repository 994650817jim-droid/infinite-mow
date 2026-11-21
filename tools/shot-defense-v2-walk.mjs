// 守城 v2 · 用户试玩预览后的走查（r10）：主将用 WASD 沿整条走道从最左走到最右、上下马道、进出门楼平台，各拍一张；
// 断言：脚不越过城垛内沿、走不进角楼 / 门楼楼阁 / 女墙、马道缺口能过、镜头不露黑（地面盖满镜头、镜头在场地 + 边带以内，含窄窗口）；
// 城防弓手站满前排、不算兵力；士兵自己推梯 / 放滚木 / 泼油（姿态 + 头顶进度条）；低打高 / 居高临下倍率；喘息补城防弓手。
// 用法：BASE=http://127.0.0.1:5197/ node tools/shot-defense-v2-walk.mjs → assets/review/defense-v2/w-*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/defense-v2';
mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
const wait = ms => p.waitForTimeout(ms);
const ev = (f, a) => p.evaluate(f, a);
const hold = async (key, ms) => { await p.keyboard.down(key); await wait(ms); await p.keyboard.up(key); await wait(120); };
const shot = async name => { await p.screenshot({ path: `${OUT}/${name}.png` }); };
/** 主将位置 + 镜头 / 地面覆盖 */
const look = () => ev(() => {
  const s = window.__S, g = s.defenseV2.g, c = s.cameras.main, wv = c.worldView, vw = wv.width, vh = wv.height, gr = s.ground, B = g.bounds, P = 220; /* 相机实际看到的世界（worldView） */
  return { x: Math.round(s.player.x), y: Math.round(s.player.y), r: s.player.radius, W: g.W, top: g.top, innerTop: g.innerTop, X0: g.X0, X1: g.X1, WX0: Math.round(g.WX0), WX1: Math.round(g.WX1), gx: g.gx,
    ground: gr.x <= wv.x + 1 && gr.x + gr.width >= wv.x + vw - 1 && gr.y <= wv.y + 1 && gr.y + gr.height >= wv.y + vh - 1,
    cam: wv.x >= B.left - P - 1 && wv.x + vw <= B.right + P + 1 && wv.y >= B.top - P - 1 && wv.y + vh <= B.bottom + P + 1, view: [Math.round(wv.x), Math.round(wv.x + vw)], gw: gr.width };
});
const put = (x, y) => ev(([x, y]) => { const s = window.__S; s.player.sprite.setPosition(x, y); }, [x, y]);
try {
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('im_story', 'off'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_defense_v2_guide_v1', JSON.stringify(['start', 'ladder', 'ram', 'sortie', 'rest', 'gate'])); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off&defenseV2=1', { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 180000 });
  await ev(() => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('siegeCity', 'chenliu'); g.registry.set('siegeMode', 'defense'); g.registry.set('runConfig', { character: 'zhaoyun' }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('SiegeGameScene'); });
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('SiegeGameScene'); return s?.player && window.__game.scene.isActive('SiegeGameScene') && s.elapsed > .5 && s.defenseV2?.stats.built; }, null, { timeout: 120000 });
  const unblock = () => ev(() => { const s = window.__S; if (!s) return ''; for (let i = 0; i < 6 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit') { const all = []; const w = l => { for (const o of l) { all.push(o); if (o.list) w(o.list); } }; w(s.children.list); const o = all.find(x => x.name === 'recruit-close' && x.input?.enabled); if (o) { o.emit('pointerdown', { x: o.x, y: o.y }); o.emit('pointerup', { x: o.x, y: o.y }); } else s.setMode('none'); } else if (s.mode === 'branch') s.chooseBranch?.(1); else if (['story', 'attributes', 'bossloot'].includes(s.mode)) s.setMode('none'); else break; } return s.mode; });
  const setup = await ev(() => { const s = window.__game.scene.getScene('SiegeGameScene'); window.__S = s; s.player.damageImmune = true;
    for (const [k, n] of [['archer', 6], ['swordsman', 6], ['spearman', 6], ['rider', 2]]) s.legion.recruit(k, n, true);
    s.defenseV2.assignAll(true);
    const w = s.defenseV2, g = w.g, gar = s.legion.units.filter(u => u.active && u.garrison && u.def.ranged), gateMen = s.legion.units.filter(u => u.active && u.garrison && !u.def.ranged).filter(u => w.postFor(u)?.kind === 'gate').length, front = gar.filter(u => { const q = w.postFor(u); return q?.kind === 'crenel' && Math.abs(g.W - q.y - 70) < 1; });
    return { garrison: gar.length, gateMen, reserveMelee: w.postsInfo && s.legion.units.filter(u => u.active && !u.garrison && !u.def.ranged && u.kind !== 'rider' && w.postFor(u)?.kind === 'reserve').length, front: front.length, count: s.legion.count, all: s.legion.units.filter(u => u.active).length, crenelHeld: w.postsInfo().filter(x => x.kind === 'crenel' && x.held).length };
  });
  ck('城防：中城每段 4 个城防弓手站满四段垛口前排 + 门楼守军 2 个站门楼平台；不算兵力（兵力 20 = 带来的部曲）；玩家的近战还留 2 个在预备队（E 叫得到）', setup.garrison === 16 && setup.front === 16 && setup.gateMen === 2 && setup.reserveMelee === 2 && setup.count === 20 && setup.all === 38, setup);
  await wait(1200); await unblock(); await shot('w-1-start');

  // ———— 走道南沿：往下（城外）走，脚停在城垛内沿后面
  await hold('KeyS', 900); const south = await look();
  ck('u4 往城外走：主将脚停在城垛内沿以北（W − 50 − 半径），不站到外侧城垛上', south.y <= south.W - 50 - south.r + 2 && south.y >= south.W - 50 - south.r - 12, south);
  await shot('w-2-south-edge');

  // ———— 最左端：一直往左走，停在走道端头（不进角楼）；镜头不露黑
  await hold('KeyA', 3600); const left = await look();
  ck('u1 最左端：走到走道端头停下（不走进角楼图里），地面盖满镜头、镜头在场地 + 边带以内', left.x >= left.WX0 + left.r - 2 && left.x <= left.WX0 + 40 && left.ground && left.cam, left);
  await shot('w-3-left-end');
  await hold('KeyW', 1500); const leftN = await look();
  ck('u1 最左端往北：走不进角楼背后的山崖（停在女墙带以南）', leftN.y >= leftN.top + 40 && leftN.x >= leftN.WX0 + leftN.r - 2, leftN);
  await p.setViewportSize({ width: 900, height: 900 }); await wait(700); const leftNarrow = await look(); await shot('w-4-left-end-narrow');
  ck('窄窗口（900×900）最左端：地面盖满镜头、镜头在场地 + 边带以内', leftNarrow.ground && leftNarrow.cam, leftNarrow);
  await p.setViewportSize({ width: 1280, height: 720 }); await wait(500);

  // ———— 西马道：从走道走缺口下到城里，再走回来；缺口以外的女墙过不去
  const g0 = await look(), rampL = g0.gx - 402;
  await put(rampL + 160, g0.top + 40 + 40); await hold('KeyW', 900); const wall = await look();
  ck('u2 缺口以外的内侧女墙过不去（停在女墙带以南）', wall.y >= wall.top + 40 + wall.r - 2, wall);
  await put(rampL, g0.top + 120); await hold('KeyW', 520); await shot('w-5-ramp-down-mid'); const mid = await look();
  await hold('KeyW', 900); const city = await look(); await shot('w-6-ramp-city');
  ck('u2 西马道：从缺口走下城（只能沿马道方向，x 在缺口里）、到了城里', city.y < city.innerTop - 4 && Math.abs(mid.x - rampL) <= 45 - mid.r + 2, { mid, city });
  await hold('KeyS', 1400); const back = await look();
  ck('u2 西马道：从城里走回走道', back.y > back.top + 40, back);

  // ———— 门楼平台：走上去、站油锅（前沿，脚在城垛内沿后面）、往后走到楼阁台基前停下
  await put(g0.gx - 300, g0.W - 120); await hold('KeyD', 1500); const gw = await look(); await shot('w-7-gate-walk');
  ck('门楼平台：从走道走上门楼平台（横穿，不掉下墙）', Math.abs(gw.x - gw.gx) < 150 && gw.y > gw.top && gw.y < gw.W, gw);
  await put(g0.gx, g0.W - 100); await hold('KeyS', 800); const gf = await look(); await shot('w-8-gate-front');
  ck('u4 门楼前沿（油锅位）：主将脚停在城垛内沿后面，不站在门楼城垛上', gf.y <= gf.W - 50 - gf.r + 2, gf);
  await hold('KeyW', 1800); const gr = await look(); await shot('w-9-gate-rear');
  const pavBot = gr.W + 220 - (809 - 260) * .75 + 4;
  ck('门楼平台后沿：走到楼阁台基前停下（不走进楼阁图里）', gr.y >= pavBot + gr.r - 3 && gr.y < pavBot + gr.r + 20, { ...gr, pavBot });

  // ———— 最右端 + 东马道
  await put(g0.WX1 - 220, g0.W - 120); await hold('KeyD', 2200); const right = await look(); await shot('w-10-right-end');
  ck('u3 最右端：走到走道端头停下（不进角楼），地面盖满镜头（不露黑）、镜头在场地 + 边带以内', right.x <= right.WX1 - right.r + 2 && right.x >= right.WX1 - 60 && right.ground && right.cam, right);
  await p.setViewportSize({ width: 900, height: 900 }); await wait(700); const rightNarrow = await look(); await shot('w-11-right-end-narrow');
  ck('窄窗口（900×900）最右端：地面盖满镜头、镜头在场地 + 边带以内', rightNarrow.ground && rightNarrow.cam, rightNarrow);
  await p.setViewportSize({ width: 1600, height: 700 }); await wait(700); const rightWide = await look();
  ck('宽窗口（1600×700）最右端：地面盖满镜头', rightWide.ground && rightWide.cam, rightWide);
  await p.setViewportSize({ width: 1280, height: 720 }); await wait(500);
  const rampR = g0.gx + 402; await put(rampR, g0.top + 120); await hold('KeyW', 520); await shot('w-12-ramp-right'); await hold('KeyW', 900); const cityR = await look();
  ck('u2 东马道：从缺口走下城', cityR.y < cityR.innerTop - 4, cityR);

  // ———— 倍率（低打高 / 居高临下）
  const mul = await ev(() => { const s = window.__S, g = s.defenseV2.g, u = s.legion.units.find(q => q.active && !q.garrison && q.kind === 'archer' && s.defenseV2.postFor(q)?.kind === 'crenel'), gu = s.legion.units.find(q => q.active && q.garrison && q.def.ranged);
    s.player.sprite.setPosition(g.gx - 300, g.W - 120);
    return { troopIn: s.legion.hurtMul(u, { x: u.x, y: g.W + 60, normal: true }), heroIn: s.playerBulletMul({ vy: -120, img: { x: s.player.x, y: s.player.y } }), down: s.legion.hitMul(u, { y: g.W + 80 }), flat: s.legion.hitMul(u, { y: g.W - 120 }), garDown: +s.legion.hitMul(gu, { y: g.W + 80 }).toFixed(3), range: s.defenseV2.rangeMul(u) }; });
  ck('低打高：城外的箭打城头士兵 ×0.4、主将 ×0.6；城头往下打 ×1.2（打城头上的不加）；垛口弓手射程 ×1.6', mul.troopIn === .4 && mul.heroIn === .6 && mul.down === 1.2 && mul.flat === 1 && mul.garDown === .3 && mul.range === 1.6, mul); /* 城防弓手出手 ×0.25（民壮） */

  // ———— 士兵用守城道具（每项自己造条件，正常速度）：主将在城里（不在任何一段）
  await ev(() => { const s = window.__S; s.devTimeScale = 1; s.elapsed = 10; });
  for (let i = 0; i < 4; i++) { await unblock(); await wait(200); }
  // 推梯：一架梯子立着、墙脚有人排队上梯、城头清场 → 梯口驻守兵推（姿态 + 头顶进度条）
  const push = await ev(async () => {
    const s = window.__S, A = s.defenseAssault, g = s.defenseV2.g, sleep = ms => new Promise(r => setTimeout(r, ms));
    for (const e of [...s.enemies]) if (e.active && !e.isSupplySlot && e.y < g.F - 24 && e.y > g.top - 10) { e.hp = 0; s.killEnemy(e); } // 城头清场（有登城敌兵时士兵先打、不推）
    let l = A.ladders.find(q => q.state === 'up') ?? A.ladders.find(q => q.state !== 'drive') ?? A.ladders[0] ?? null;
    if (!l) { A.segBlocked = A.segBlocked.map(() => -1); A.spawnLadder(); l = A.ladders[A.ladders.length - 1] ?? null; }
    if (l && l.state !== 'up') { l.cart.sprite.setPosition(l.x, g.F + 34); l.state = 'warn'; l.until = s.combatNow; }
    if (!l) return { err: 'no ladder' };
    s.player.sprite.setPosition(l.x, g.innerTop - 50); const before = A.stats.troopPushed; A.troopLogs[l.seg] = 9; /* 这段先不让士兵放滚木（滚木会先把梯子砸倒，测不到推梯） */
    const grab = (x, n) => { const pool = s.enemies.filter(e => e.active && !e.isSupplySlot && e.hp > 0 && e.y > g.F + 10 && e.kind !== 'boss' && e.kind !== 'cavalry' && e.kind !== 'archer' && !A.ghost(e)).slice(0, n); pool.forEach((e, i) => e.sprite.setPosition(x + (i - n / 2) * 16, g.F + 30 + (i % 2) * 14)); for (let i = pool.length; i < n; i++) s.spawnEnemy('infantry', x + (i - n / 2) * 16, g.F + 30 + (i % 2) * 14, undefined, true); return pool.length; }; const moved = grab(l.x, 4); /* 少于滚木门槛（6），免得滚木先把梯子砸倒 */
    const t0 = Date.now(); while (Date.now() - t0 < 15000 && !A.troopPush.has(l)) await sleep(100);
    const tp = A.troopPush.get(l); window.__push = { l, before }; const trace = []; if (tp) { const u = tp.u; for (let i = 0; i < 10; i++) { trace.push([A.troopPush.has(l) ? 1 : 0, u.active ? 1 : 0, Math.round(u.hp), l.state, l.climbers.size, A.segFoes(l.seg), A.ladders.includes(l) ? 1 : 0, Math.round(s.combatNow - (A.troopPush.get(l)?.start ?? 0))]); await sleep(120); } }
    return tp ? { seg: l.seg, climbers: l.climbers.size, pose: tp.u.pose?.kind, kind: tp.u.kind, before, trace } : { err: 'no push', moved, state: l.state, climbers: l.climbers.size, segFoes: A.segFoes(l.seg), guards: s.defenseV2.holders('guard', l.seg).length };
  });
  await wait(900); await shot('w-13-troop-push');
  { const box = await ev(() => { const s = window.__S, u = window.__push && [...s.defenseAssault.troopPush.values()].find(t => t.u)?.u; if (!u) return null; const v = s.cameras.main.worldView, r = s.game.canvas.getBoundingClientRect(); return { x: r.left + (u.x - v.x) / v.width * r.width, y: r.top + (u.y - v.y) / v.height * r.height }; });
    if (box) await p.screenshot({ path: OUT + '/w-13b-troop-push-zoom.png', clip: { x: Math.max(0, box.x - 110), y: Math.max(0, box.y - 120), width: 220, height: 170 } }); }
  const pushBar = await ev(() => window.__S.children.getByName('defv2-troop-bar')?.commandBuffer?.length ?? -1);
  const pushed = await ev(() => new Promise(res => { const A = window.__S.defenseAssault, t0 = Date.now(), f = () => { if (A.stats.troopPushed > window.__push.before || Date.now() - t0 > 8000) res(A.stats.troopPushed - window.__push.before); else setTimeout(f, 150); }; f(); }));
  await ev(() => { const A = window.__S.defenseAssault; A.troopLogs = A.troopLogs.map(() => 0); });
  ck('梯口驻守兵自己推梯（主将不在这段、梯上有人、城头没登城的敌兵）：推梯姿态 + 头顶进度条，读条完梯子倒', !push.err && push.pose === 'push' && pushBar > 0 && pushed >= 1, /* 别的段也可能同时有人推 */ { push, pushBar, pushed });
  // 滚木：这段墙脚敌兵 ≥ 6 → 滚木架旁的兵喊「放滚木！」、举手，然后放
  const log = await ev(async () => {
    const s = window.__S, A = s.defenseAssault, g = s.defenseV2.g, sleep = ms => new Promise(r => setTimeout(r, ms));
    const sg = g.segs.find(q => A.logs[q.i] > 0 && A.troopLogs[q.i] < 1 && !A.troopAct.some(a => a.seg === q.i) && !A.ladders.some(l => l.seg === q.i)); if (!sg) return { err: 'no seg' };
    A.segBlocked = A.segBlocked.map(() => -1); const free0 = A.ladders.length; A.spawnLadder(); const l = A.ladders.find(q => q.seg === sg.i) ?? A.ladders[free0]; if (!l) return { err: 'no ladder' };
    l.cart.sprite.setPosition(l.x, g.F + 34); l.state = 'warn'; l.until = s.combatNow; const x = l.x; s.player.sprite.setPosition(x, g.innerTop - 50);
    { const t1 = Date.now(); while (Date.now() - t1 < 4000 && l.state !== 'up') await sleep(60); } // 等梯子立起来（梯上有人才砸）
    const before = A.stats.troopLogs, charges = A.logs[sg.i]; window.__log = { before, seg: sg.i, charges };
    const grab = (x, n) => { const pool = s.enemies.filter(e => e.active && !e.isSupplySlot && e.hp > 0 && e.y > g.F + 10 && e.kind !== 'boss' && e.kind !== 'cavalry' && e.kind !== 'archer' && !A.ghost(e)).slice(0, n); pool.forEach((e, i) => e.sprite.setPosition(x + (i - n / 2) * 16, g.F + 30 + (i % 2) * 14)); for (let i = pool.length; i < n; i++) s.spawnEnemy('infantry', x + (i - n / 2) * 16, g.F + 30 + (i % 2) * 14, undefined, true); return pool.length; }; grab(x, 8);
    const t0 = Date.now(); while (Date.now() - t0 < 6000 && !A.troopAct.some(a => a.kind === 'log' && a.seg === sg.i) && A.stats.troopLogs === before) await sleep(60);
    const a = A.troopAct.find(q => q.kind === 'log' && q.seg === sg.i);
    return { seg: sg.i, acting: !!a, pose: a?.u.pose?.kind, bark: s.children.list.some(o => o.name === 'defv2-troop-bark'), before };
  });
  await wait(250); await shot('w-14-troop-log');
  const logDone = await ev(() => new Promise(res => { const A = window.__S.defenseAssault, t0 = Date.now(), f = () => { if (A.stats.troopLogs > window.__log.before || Date.now() - t0 > 4000) res({ n: A.stats.troopLogs - window.__log.before, left: A.logs[window.__log.seg], was: window.__log.charges }); else setTimeout(f, 150); }; f(); }));
  ck('墙脚敌兵 ≥ 6：滚木架旁的兵喊「放滚木！」、举手，然后放滚木（用同一份次数）', !log.err && log.acting && log.pose === 'log' && log.bark && logDone.n === 1 && logDone.left === logDone.was - 1, { log, logDone });
  // 泼油：冲车到门前 → 门楼守军喊「泼油！」、举锅，然后泼；这一波只泼 1 次（其余留给主将）
  const oil = await ev(async () => {
    const s = window.__S, A = s.defenseAssault, g = s.defenseV2.g, sleep = ms => new Promise(r => setTimeout(r, ms));
    A.troopOil = 0; A.oil.cd = 0; A.oil.charges = 3; const before = A.stats.troopOil; window.__oil = { before };
    if (!A.rams.some(r => r.atGate && r.e.active)) { A.spawnRam(); const r = A.rams[A.rams.length - 1]; if (r) { r.y = g.F + 48; r.atGate = true; r.e.sprite.setPosition(r.x, r.y); r.label.setPosition(r.x, r.y - 158); } }
    s.player.sprite.setPosition(g.gx - 150, g.innerTop - 50);
    const t0 = Date.now(); while (Date.now() - t0 < 6000 && A.stats.troopOil === before && !A.troopAct.some(a => a.kind === 'oil')) await sleep(60);
    const a = A.troopAct.find(q => q.kind === 'oil'); return { acting: !!a, pose: a?.u.pose?.kind, gateHolders: s.defenseV2.holders('gate').length, before };
  });
  await wait(300); await shot('w-15-troop-oil');
  await wait(5500); // 冷却过了也不再泼（这一波的份用完了）
  const oilDone = await ev(() => { const A = window.__S.defenseAssault; return { n: A.stats.troopOil - window.__oil.before, charges: A.oil.charges }; });
  ck('冲车到门前：门楼守军喊「泼油！」、举锅，然后泼；这一波只泼 1 次（其余 2 次留给主将）', oil.gateHolders >= 1 && oil.acting && oil.pose === 'oil' && oilDone.n === 1 && oilDone.charges === 2, { oil, oilDone });

  // ———— 喘息补城防弓手：打死 6 个城防弓手 → 进喘息补回 3 个（不算战损、不算兵力）
  await ev(() => { const s = window.__S, L = s.legion, dead0 = L.dead, count0 = L.count, gar = L.units.filter(u => u.active && u.garrison && u.def.ranged).slice(0, 6);
    for (const u of gar) L.hurt(u, 1e6, s.combatNow, undefined, 0, true);
    const alive1 = L.units.filter(u => u.active && u.garrison && u.def.ranged).length, el = s.elapsed, k = Math.floor(el / 85);
    s.elapsed = el < k * 85 + 65 ? k * 85 + 66 : (k + 1) * 85 + 66; /* 下一个喘息 */ window.__re0 = { alive1, dead0, count0 }; });
  for (let i = 0; i < 8; i++) { await unblock(); await wait(250); }
  const re = await ev(() => { const s = window.__S, L = s.legion, { alive1, dead0, count0 } = window.__re0;
    return { alive1, alive2: L.units.filter(u => u.active && u.garrison && u.def.ranged).length, added: s.v2GarrisonAdded, deadDelta: L.dead - dead0, count0, count1: L.count, phase: s.defenseAssault.phase }; });
  ck('喘息补城防弓手：阵亡 6 → 补回 3（向上取整 ×0.5），不算部曲战损、不算兵力', re.alive1 === 10 && re.added === 3 && re.alive2 === 13 && re.deadDelta === 0 && re.count1 === re.count0, re);

  ck('控制台无报错', errors.length === 0, errors.slice(0, 5));
} catch (e) { fail++; console.log('FAIL 异常 · ' + e.message.split('\n')[0]); }
await b.close();
console.log(fail ? `失败 ${fail} 项` : '全部通过');
process.exit(fail ? 1 : 0);
