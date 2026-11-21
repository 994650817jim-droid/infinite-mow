// 守城 v2 试玩版 · b 段实机（dev 测试战斗 + ?defenseV2=1）：a 段验收（镜头 / 城门楼新图分层 / 单行横幅）+ 云梯攀爬 + 推梯 / 滚木 / 泼油 / 修门 + 冲车撞门 + 占段夺回 + 推下城。
// 用法：BASE=http://127.0.0.1:5197/ node tools/shot-defense-v2b.mjs → assets/review/defense-v2/b-*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/defense-v2';
mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
const wait = ms => p.waitForTimeout(ms);
const ev = (f, a) => p.evaluate(f, a);
const until = async (f, ms, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(f, a)) return true; await wait(250); } return false; };
const to = (x, y) => ev(([x, y]) => { const s = window.__S; s.player.sprite.setPosition(x, y); }, [x, y]);
try {
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('im_story', 'off'); localStorage.setItem('im_home_seen', '1'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off&defenseV2=1', { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 180000 });
  await ev(() => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('siegeCity', 'chenliu'); g.registry.set('siegeMode', 'defense'); g.registry.set('runConfig', { character: 'zhaoyun' }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('SiegeGameScene'); });
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('SiegeGameScene'); return s?.player && window.__game.scene.isActive('SiegeGameScene') && s.elapsed > .5 && s.defenseV2?.stats.built && s.defenseAssault; }, null, { timeout: 120000 });
  const G = await ev(() => { const s = window.__game.scene.getScene('SiegeGameScene'); window.__S = s; s.player.damageImmune = true;
    for (const [k, n] of [['archer', 6], ['swordsman', 6], ['spearman', 6], ['rider', 2]]) s.legion.recruit(k, n, true);
    s.defenseV2.assignAll(true); const g = s.defenseV2.g; return { gx: g.gx, W: g.W, top: g.top, F: g.F, segs: g.segs.map(q => ({ x0: q.x0, x1: q.x1, lx: q.ladderX })) }; });
  await wait(1400);
  // ———— a 段验收：镜头 / 单行横幅
  const cam = await ev(() => { const s = window.__S, v = s.cameras.main.worldView, g = s.defenseV2.g, H = 540, sy = wy => (wy - v.y) / v.height * H;
    const notes = s.children.list.filter(o => o.name === 'combat-notice'); return { foot: Math.round(sy(g.F)), hero: Math.round(sy(s.player.y)), outsidePx: Math.round((H - sy(g.F)) * 4 / 3), zoom: +(s.cameras.main.zoom / (window.__game.config.zoom || 1)).toFixed(3), notes: notes.map(n => ({ lines: (n.text ?? '').split('\n').length, y: Math.round(n.y), text: (n.text ?? '').slice(0, 30) })) }; });
  ck('镜头（a 段第 2 条）：主将在城头，墙脚以下城外地面 ≥ 240 截图像素，主将不钻到顶部 HUD 下', cam.outsidePx >= 240 && cam.hero >= 100, cam);
  ck('横幅（b 段验收第 3 条）：一次一行、放在计时器下方那一行（不挡墙面上爬的敌兵）', cam.notes.length <= 1 && cam.notes.every(n => n.lines === 1 && n.y < 90), cam.notes);
  await p.screenshot({ path: OUT + '/b-1-start.png' });
  // ———— 城门楼（可通行版 gate_passable_v2）：主将从楼前平台走过，楼阁在人后面、外侧城垛在人前面，不再半透明
  await to(G.gx + 40, G.W - 100); await wait(1300);
  const gate = await ev(() => { const s = window.__S, back = s.children.getByName('defv2-gate'), front = s.children.getByName('defv2-gate-front'), d = s.player.sprite.depth;
    return { back: back ? +back.depth.toFixed(3) : null, front: front ? +front.depth.toFixed(3) : null, hero: +d.toFixed(3), alpha: back?.alpha ?? null, tex: back?.texture.key }; });
  await p.screenshot({ path: OUT + '/b-2-gate.png' });
  await to(G.gx - 900, G.W - 90); await wait(1000);
  ck('城门楼（新图）：主将站在楼前平台上——楼阁在主将身后、外侧城垛在主将身前，不透明', gate.tex === 'defv2_gate_v2' && gate.back < gate.hero && gate.front > gate.hero && gate.alpha === 1, gate);
  // ———— 云梯：开到墙脚 → 立梯 → 攀爬 → 翻上城头
  await ev(() => { const s = window.__S; s.elapsed = Math.max(s.elapsed, 8); const A = s.defenseAssault; /* c 段有波次：别拨到喘息 */ A.spawnLadder(); A.spawnLadder(); for (const l of A.ladders) l.cart.sprite.y = s.defenseV2.g.F + 90; });
  const upOk = await until(() => window.__S.defenseAssault.ladders.some(l => l.state === 'up'), 8000);
  const lad = await ev(() => { const l = window.__S.defenseAssault.ladders.find(q => q.state === 'up'); return l ? { seg: l.seg, x: l.x } : null; });
  ck('云梯车开到墙脚 → 亮圈 → 立梯（梯子靠在外墙面上）', upOk && !!lad, await ev(() => window.__S.defenseAssault.snapshot().ladders));
  if (lad) await to(lad.x + 260, G.W - 110);
  // 墙脚补几个能扛的（精英 3 + 步兵 2）：城外的兵从敌营走到墙脚要十几秒，而且主将 / 垛口弓手会先射死梯上的步兵
  if (lad) await ev(l => { const s = window.__S, g = s.defenseV2.g; s.defInside = true; try { for (const [k, dx] of [['elite', -40], ['elite', 0], ['elite', 40], ['infantry', -70], ['infantry', 70]]) s.spawnEnemy(k, l.x + dx, g.F + 50, 1, true); } finally { s.defInside = false; } }, lad);
  const climbOk = await until(() => window.__S.defenseAssault.snapshot().climbing > 0, 20000);
  await wait(500); await p.screenshot({ path: OUT + '/b-3-climb.png' });
  ck('墙脚的近战兵排队上梯、沿墙面往上爬', climbOk, await ev(() => window.__S.defenseAssault.snapshot().stats));
  const landOk = await until(() => window.__S.defenseAssault.stats.landed > 0, 15000);
  ck('爬到顶翻上垛口、落到走道上（和梯口驻守 / 主将近战）', landOk, await ev(() => { const s = window.__S, g = s.defenseV2.g; return { landed: s.defenseAssault.stats.landed, onWalk: s.enemies.filter(e => e.active && !e.isSupplySlot && e.y < g.W && e.y > g.top).length }; }));
  // ———— F · 推梯
  const L = await ev(() => { const l = window.__S.defenseAssault.ladders.find(q => q.state === 'up'); return l ? { seg: l.seg, x: l.x } : null; });
  if (L) {
    await until(() => window.__S.defenseAssault.ladders.some(l => l.state === 'up' && l.climbers.size > 0), 8000);
    await to(L.x, G.W - 40); await wait(150);
    const prompt = await ev(() => window.__S.defenseAssault.prompt.text);
    const before = await ev(() => ({ ...window.__S.defenseAssault.stats }));
    await ev(() => window.__S.interactOverride()); await wait(220);
    await p.screenshot({ path: OUT + '/b-4-push.png' });
    const after = await ev(seg => { const A = window.__S.defenseAssault; return { stats: { ...A.stats }, state: A.ladders.find(l => l.seg === seg)?.state }; }, L.seg);
    ck('站梯口头顶出「F · 推梯」，按 F 梯子往外倒、梯上的人摔下城', prompt === 'F · 推梯' && after.stats.pushed === before.pushed + 1 && after.state === 'down', { prompt, fell: after.stats.fell - before.fell, state: after.state });
    // ———— F · 滚木（同一段）
    await to(G.segs[L.seg].lx + 84, G.W - 48); await wait(150);
    const lp = await ev(() => window.__S.defenseAssault.prompt.text);
    const cartHp0 = await ev(seg => window.__S.defenseAssault.ladders.find(l => l.seg === seg)?.cart.hp ?? 0, L.seg);
    await ev(() => window.__S.interactOverride()); await wait(700);
    const lg = await ev(seg => { const A = window.__S.defenseAssault; return { logs: A.stats.logs, left: A.logs[seg], cart: A.ladders.find(l => l.seg === seg)?.cart.hp ?? 0 }; }, L.seg);
    ck('站滚木架头顶出「F · 滚木 ×2」，按 F 滚木砸下去（这段的云梯车掉血、次数 −1）', lp === 'F · 滚木 ×2' && lg.logs === 1 && lg.left === 1 && lg.cart < cartHp0, { lp, ...lg, cartHp0: Math.round(cartHp0) });
  } else ck('推梯 / 滚木（没有立着的梯子）', false);
  // ———— 冲车撞门 → F · 泼油
  await ev(() => { const s = window.__S, A = s.defenseAssault; A.spawnRam(); for (const r of A.rams) r.y = s.defenseV2.g.F + 100; }); // 冲车按自己的 y 走（行进时上下颠）
  const ramOk = await until(() => window.__S.defenseAssault.stats.ramHits > 0, 9000);
  const gate0 = await ev(() => window.__S.defenseAssault.snapshot());
  ck('冲车开到门前撞门（第二战线），城门掉耐久', ramOk && gate0.gate < gate0.gateMax, { gate: gate0.gate, max: gate0.gateMax, ramHits: gate0.stats.ramHits });
  await to(G.gx, G.W - 52); await wait(150);
  const op = await ev(() => window.__S.defenseAssault.prompt.text);
  const ramHp0 = await ev(() => window.__S.defenseAssault.rams[0]?.e.hp ?? 0);
  await ev(() => window.__S.interactOverride()); await wait(1800);
  await p.screenshot({ path: OUT + '/b-5-oil.png' });
  const ramHp1 = await ev(() => window.__S.defenseAssault.rams[0]?.e.hp ?? 0);
  ck('站门楼油锅头顶出「F · 泼油 ×3」，按 F 门前烧一片（冲车 ×4 掉血）', /^F · 泼油/.test(op) && (await ev(() => window.__S.defenseAssault.stats.oil)) === 1 && ramHp1 < ramHp0, { op, ramHp0: Math.round(ramHp0), ramHp1: Math.round(ramHp1) });
  // ———— F · 修门（站定读条）
  await ev(() => { const A = window.__S.defenseAssault; A.gate.hp = Math.min(A.gate.hp, A.gate.max * .5); for (const r of A.rams) r.e.hp = 1; A.sortie.usedWave = A.wave; }); // 这一波的出城先算用过（不然门楼内侧 F 优先出城）
  await to(G.gx, G.top + 50); await wait(150);
  const rp = await ev(() => window.__S.defenseAssault.prompt.text), g0 = await ev(() => window.__S.defenseAssault.gate.hp);
  await ev(() => window.__S.interactOverride()); await wait(1200);
  const mid = await ev(() => window.__S.defenseAssault.prompt.text); await wait(2400);
  const g1 = await ev(() => ({ hp: window.__S.defenseAssault.gate.hp, repairs: window.__S.defenseAssault.stats.repairs }));
  ck('站门楼内侧头顶出「F · 修门」，按 F 站定读条（「修门中 x 秒」）→ 城门 +12%', rp === 'F · 修门' && /^修门中/.test(mid) && g1.repairs === 1 && g1.hp > g0, { rp, mid, g0: Math.round(g0), g1: Math.round(g1.hp) });
  // ———— 占段 / 夺回（第 1 段：我方全没了 + 城头敌兵 ≥ 3）
  await to(G.segs[1].x0 + 80, G.W - 90); await wait(300);
  const cap = await ev(() => { const s = window.__S, g = s.defenseV2.g, sg = g.segs[0], out = [];
    s.defenseV2.reinforceAt = 1e12; /* 关掉按威胁自动增援（不然预备队会补进这段，测不到失守） */
    for (const u of s.legion.units) if (u.active && u.x >= sg.x0 - 30 && u.x < sg.x1 && u.y < g.W + 10) s.legion.hurt(u, 1e7, s.combatNow, undefined, 0, true);
    s.defInside = true; try { for (let i = 0; i < 4; i++) { const e = s.spawnEnemy('infantry', sg.ladderX - 90 + i * 60, g.W - 70, 1, true); if (e) out.push(e.spawnId); } } finally { s.defInside = false; }
    window.__capIds = out; return out.length; });
  const capOk = await until(() => window.__S.defenseAssault.segmentsCaptured[0], 4000);
  await wait(300); await p.screenshot({ path: OUT + '/b-6-captured.png' });
  ck('一段我方士兵全没了、城头敌兵 ≥ 3 → 这段变红（失守）', capOk, { spawned: cap, captured: await ev(() => [...window.__S.defenseAssault.segmentsCaptured]) });
  await ev(() => { const s = window.__S, g = s.defenseV2.g, sg = g.segs[0]; for (const e of [...s.enemies]) if (e.active && !e.isSupplySlot && e.y > g.top - 10 && e.y < g.W + 6 && e.x >= sg.x0 && e.x < sg.x1) { e.hp = 0; s.killEnemy(e); } });
  const retOk = await until(() => !window.__S.defenseAssault.segmentsCaptured[0], 3000);
  ck('清掉这段的敌兵 → 夺回（变回原色）', retOk && (await ev(() => window.__S.defenseAssault.stats.retakes)) >= 1);
  // ———— 推下城：普通兵摔死、精英推不下
  const push = await ev(() => { const s = window.__S, g = s.defenseV2.g, x = g.segs[2].ladderX + 160; s.player.sprite.setPosition(x, g.W - 100);
    s.defInside = true; let a, el; try { a = s.spawnEnemy('infantry', x, g.W - 22, 1, true); el = s.spawnEnemy('elite', x + 50, g.W - 22, 1, true); } finally { s.defInside = false; }
    a.sprite.setPosition(x, g.W - 24); if (el) el.sprite.setPosition(x + 50, g.W - 24); // 刷兵会把落点挪离墙身，这里摆回走道南沿
    const A = s.defenseAssault, f0 = A.stats.fell; s.hitEnemy(a, 1, s.combatNow, 'melee', false, true); if (el) s.hitEnemy(el, 1, s.combatNow, 'melee', false, true);
    window.__push = { a, life: a.spawnId }; return { normalFalling: A.ghost(a), eliteFalling: el ? A.ghost(el) : false, fell: A.stats.fell - f0 }; });
  await wait(700);
  const dead = await ev(() => { const q = window.__push; return !q.a.active || q.a.spawnId !== q.life; });
  ck('主将近战打中走道南沿的普通兵 → 摔下城摔死；精英推不下', push.normalFalling && !push.eliteFalling && dead, { ...push, dead });
  // 回血点（泉眼 / 水井）落点：城头走道 / 墙面上一个都没有，都在城里
  const heal = await ev(() => { const s = window.__S, g = s.defenseV2.g, pts = [0, 1, 2, 3, 4, 5].map(i => s.healPlace(g.gx - 800 + i * 320, g.W - 60 + (i % 2) * 260)), spots = (s.battleHeal?.spots ?? []).map(q => ({ x: Math.round(q.x), y: Math.round(q.y), kind: q.kind }));
    return { placed: pts.map(p => Math.round(p.y)), innerTop: g.innerTop, spots, bad: spots.filter(q => q.y >= g.innerTop - 10).length + pts.filter(p => p.y >= g.innerTop - 10).length }; });
  ck('泉眼 / 水井不立在城头走道上（放城里，走马道下城去喝）', heal.bad === 0, heal);
  const perf = await ev(() => ({ fps: Math.round(window.__game.loop.actualFps), enemies: window.__S.enemies.filter(e => e.active && !e.isSupplySlot).length }));
  ck('帧率 > 20、同屏敌兵 ≤ 150', perf.fps > 20 && perf.enemies <= 150, perf);
} catch (e) { fail++; console.log('FAIL 异常', String(e).slice(0, 400)); }
ck('控制台无报错', errors.length === 0, errors.slice(0, 3));
await b.close(); console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
