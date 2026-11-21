// 军阵一期（共享笔记 formation-design.md；用户 11-20「全按推荐」）：站位生成器、入阵人数、阵势加成、呼应 / 擅阵、X 变阵与冷却、出击打法、
// 增益图标、行营「布阵」页、按主线进度开放（?dev=1 全开；&mech=real 第一章后还没开）。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-formations.mjs   截图在 assets/review/formations/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/formations'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 460) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
async function open(q, world) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(w => { if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1'); localStorage.removeItem('im_formation_loadout'); localStorage.setItem('im_last_hero', 'zhaoyun'); if (w) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); } }, world ?? null);
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off' + q, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').elapsed > .5, null, { timeout: 120000 });
  await p.evaluate(() => { window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part)); window.__find = (root, name) => { const list = root.list ?? root.getChildren?.() ?? []; for (const o of list) { if (o.name === name) return o; if (o.list) { const r = window.__find(o, name); if (r) return r; } } return null; }; });
  return p;
}
const ev = (p, fn, a) => p.evaluate(([f, a]) => { const s = window.__game.scene.getScene('GameScene'); window.__S = s; for (let i = 0; i < 8 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result' && s.mode !== 'story' && s.mode !== 'rest') s.setMode?.('none'); } } return eval('(' + f + ')')(s, a); }, [String(fn), a]);
/** 清场：停刷兵、清掉在场小兵（主将无敌）。 */
const calm = p => ev(p, s => { s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) { e.active = false; e.sprite?.setVisible(false); } return true; });
const use = (p, id, other = 'circle') => ev(p, (s, [id, other]) => { const r = s.formationRt; r.loadout = [id, other === id ? 'wedge' : other]; r.idx = 0; r.current = id; r.settleUntil = 0; r.cdUntil = 0; r.apply(); s.legion.order === 'sortie' && s.legion.cycleOrder(); return r.current; }, [id, other]);

// ① 开局：?dev=1 全开，赵云擅长蛇 → 主阵默认长蛇
const p = await open('');
await calm(p);
const st0 = await ev(p, s => { const r = s.formationRt; for (const [k, n] of [['swordsman', 6], ['spearman', 4], ['archer', 4], ['crossbowman', 2], ['medic', 2]]) s.legion.recruit(k, n, true, true); s.player.growth.attributes.command = 0;
  return { known: r?.known, load: r?.loadout, cur: r?.current, units: s.legion.units.filter(u => u.active).length, cmd: s.player.growth.pts('command') }; });
ck('?dev=1：学会方圆 / 锋矢 / 鹤翼 / 雁行 / 长蛇（八阵只给诸葛亮）；赵云擅长蛇 → 主阵默认长蛇', ['circle', 'wedge', 'crane', 'geese', 'snake'].every(x => st0.known?.includes(x)) && !st0.known.includes('bazhen') && st0.load?.[0] === 'snake' && st0.cur === 'snake', st0);

// ② 站位生成器：每个阵的形状
const shape = id => ev(p, (s, id) => { const r = s.formationRt; r.loadout = [id, 'circle']; r.idx = 0; r.current = id; r.settleUntil = 0; r.apply(); const f = s.legion.formation;
  const us = s.legion.units.filter(u => u.active), inF = us.filter(u => f.inForm.has(u.id)), back = us.filter(u => !f.inForm.has(u.id));
  const off = u => f.offsetOf(u) ?? { x: 0, y: 0 }, isB = u => u.def.ranged || u.kind === 'medic';
  return { id, cap: f.cap, inN: inF.length, total: us.length, melee: inF.filter(u => !isB(u)).map(off), ranged: inF.filter(u => u.def.ranged).map(off), medic: inF.filter(u => u.kind === 'medic').map(off), back: back.map(off), fol: [0, 1, 2].map(i => f.followerSlot(i, 3)) }; }, id);
const R = o => Math.hypot(o.x, o.y), A = o => Math.atan2(o.x, o.y);
const circ = await shape('circle'); const mr = circ.melee.map(R), rr = circ.ranged.map(R);
ck('方圆：近战一圈（半径相同）、远程在内圈；入阵 = 8 + 2 × 统御，其余在后军', Math.max(...mr) - Math.min(...mr) < 1 && Math.max(...rr) < Math.min(...mr) && circ.inN === Math.min(circ.cap, circ.total) && circ.back.every(o => o.y < -40), { cap: circ.cap, inN: circ.inN, total: circ.total, mr: mr.slice(0, 3), rr: rr.slice(0, 3), back: circ.back.length });
const wedge = await shape('wedge');
ck('锋矢：近战楔形在前（都在主将前方）、远程在身后两列', wedge.melee.every(o => o.y > 30) && wedge.ranged.every(o => o.y < 0) && Math.max(...wedge.melee.map(o => o.y)) > Math.min(...wedge.melee.map(o => o.y)) + 20, { melee: wedge.melee.slice(0, 4), ranged: wedge.ranged.slice(0, 2) });
const crane = await shape('crane');
ck('鹤翼：近战分左右两翼（|x| ≥ 50）、越往外越靠前', crane.melee.some(o => o.x < -50) && crane.melee.some(o => o.x > 50) && crane.melee.every(o => Math.abs(o.x) >= 50), crane.melee.slice(0, 6));
const geese = await shape('geese');
ck('雁行：远程一字横开在主将两侧（同一排、左右都有），近战与军医在后排', geese.ranged.every(o => Math.abs(o.y - geese.ranged[0].y) < 40 && Math.abs(o.x) >= 40) && geese.ranged.some(o => o.x < 0) && geese.ranged.some(o => o.x > 0) && geese.melee.every(o => o.y < 0) && geese.medic.every(o => o.y < 0), { ranged: geese.ranged.slice(0, 4), melee: geese.melee.slice(0, 2) });
const bz = await shape('bazhen'); const bzAll = [...bz.melee, ...bz.ranged, ...bz.medic], angs = new Set(bzAll.map(o => Math.round(((A(o) * 180 / Math.PI) + 360) % 360 / 45) % 8));
ck('八阵：八队站八门方位（8 个方向、离主将 ≥ 110）', angs.size === 8 && bzAll.every(o => R(o) >= 110), { dirs: angs.size, minR: Math.min(...bzAll.map(R)) });
ck('随从阵位跟着阵走（鹤翼在翼根、八阵在身边）', !!crane.fol[0] && !!bz.fol[0], { crane: crane.fol, bz: bz.fol });

// ③ 实际站位：方圆，清场 2.5 秒后士兵都到阵位附近
await use(p, 'circle');
for (let i = 0; i < 8; i++) { await calm(p); await p.waitForTimeout(500); }
const near = await ev(p, s => { const f = s.legion.formation, us = s.legion.units.filter(u => u.active && f.inForm.has(u.id)); const d = us.map(u => { const q = f.position(u); return Math.hypot(q.x - u.x, q.y - u.y); }).sort((a, b) => a - b); return { median: d[Math.floor(d.length / 2)], mean: d.reduce((a, b) => a + b, 0) / d.length, max: d[d.length - 1] }; });
ck('方圆：士兵跑到阵位（中位偏差 < 30 像素）', near.median < 30, near);
await p.screenshot({ path: `${OUT}/battle-circle.png` });

// ④ 阵势加成
const bonus = await ev(p, s => { const r = s.formationRt, L = s.legion, f = L.formation, us = L.units.filter(u => u.active), inU = us.find(u => f.inForm.has(u.id) && !u.def.ranged), outU = us.find(u => !f.inForm.has(u.id)), rg = us.find(u => f.inForm.has(u.id) && u.def.ranged);
  const P = s.player, front = { x: P.x + Math.cos(f.facing) * 120, y: P.y + Math.sin(f.facing) * 120 }, behind = { x: P.x - Math.cos(f.facing) * 120, y: P.y - Math.sin(f.facing) * 120 };
  const o = {}; r.update(0, s.combatNow);
  o.circle = { taken: L.fm.taken(inU), outTaken: outU ? L.fm.taken(outU) : null, dmg: L.fm.dmg(inU, front), hero: P.formationTakenMul };
  L.cycleOrder(); r.update(0, s.combatNow); o.circleSortie = { taken: L.fm.taken(inU), hero: P.formationTakenMul }; L.cycleOrder();
  const set = id => { r.current = id; r.loadout = [id, 'circle']; r.settleUntil = 0; r.powerAt = -1e9; r.apply(); r.update(0, s.combatNow); };
  const side = { x: P.x + Math.cos(f.facing + 1.4) * 120, y: P.y + Math.sin(f.facing + 1.4) * 120 }; // 侧前 80°
  set('wedge'); o.wedge = { front: L.fm.dmg(inU, front), side80: L.fm.dmg(inU, side), behind: L.fm.dmg(inU, behind), taken: L.fm.taken(inU), heroMove: P.formationSpeedMul };
  set('geese'); o.geese = { ranged: L.fm.dmg(rg, front), range: L.fm.range(rg), melee: L.fm.dmg(inU, front), heroRange: P.passive.formationRangeMul };
  set('snake'); o.snake = { speed: inU.formSpeed, mul: r.pow().mul, favored: r.pow().favored };
  // 呼应：学一招骑突战法 → 主修含骑突 → 锋矢主效果 ×1.5
  P.growth.build.learn('stored_edge'); set('wedge'); o.echo = { front: L.fm.dmg(inU, front), majors: P.growth.build.majors(), echo: r.pow().echo };
  // 方圆单独封顶 0.25：主修兵阵（呼应 ×1.5 → 0.3）也只减 25%
  P.growth.build.tactics = {}; P.growth.build.learn('rally'); set('circle'); o.circleCap = { taken: L.fm.taken(inU), fol: r.followerHooks.taken(), echo: r.pow().echo, majors: P.growth.build.majors() };
  P.growth.build.tactics = {}; set('circle');
  return o; });
ck('方圆：入阵士兵受伤 ×0.8、伤害 ×0.9；后军不吃；主将受伤 ×0.92', Math.abs(bonus.circle.taken - .8) < 1e-6 && Math.abs(bonus.circle.dmg - .9) < 1e-6 && (bonus.circle.outTaken ?? 1) === 1 && Math.abs(bonus.circle.hero - .92) < 1e-6, bonus.circle);
ck('出击时散阵：士兵阵势停掉，主将加成保留', bonus.circleSortie.taken === 1 && Math.abs(bonus.circleSortie.hero - .92) < 1e-6, bonus.circleSortie);
ck('锋矢（11-21 调）：前方半边（侧前 80° 也算）×1.15、身后 ×1；受伤 ×1.05；主将移速 ×1.06', Math.abs(bonus.wedge.front - 1.15) < 1e-6 && Math.abs(bonus.wedge.side80 - 1.15) < 1e-6 && bonus.wedge.behind === 1 && Math.abs(bonus.wedge.taken - 1.05) < 1e-6 && Math.abs(bonus.wedge.heroMove - 1.06) < 1e-6, bonus.wedge);
ck('雁行：远程伤害 ×1.2、射程 ×1.2，近战 ×0.85；主将范围 ×1.05', Math.abs(bonus.geese.ranged - 1.2) < 1e-6 && Math.abs(bonus.geese.range - 1.2) < 1e-6 && Math.abs(bonus.geese.melee - .85) < 1e-6 && Math.abs(bonus.geese.heroRange - 1.05) < 1e-6, bonus.geese);
ck('长蛇：入阵士兵移速 ×1.25；赵云擅长蛇 ×1.25', Math.abs(bonus.snake.speed - 1.25) < 1e-6 && bonus.snake.favored && Math.abs(bonus.snake.mul - 1.25) < 1e-6, bonus.snake);
ck('呼应：主修骑突 → 锋矢正前方 ×(1 + 0.15 × 1.5)', bonus.echo.echo && Math.abs(bonus.echo.front - 1.225) < 1e-6, bonus.echo);
ck('方圆减伤单独封顶 0.25：主修兵阵呼应也只到 ×0.75（部曲与随从）', bonus.circleCap.echo && Math.abs(bonus.circleCap.taken - .75) < 1e-6 && Math.abs(bonus.circleCap.fol - .75) < 1e-6, bonus.circleCap);

// ⑤ X 变阵：冷却、成阵、横幅、增益图标
await use(p, 'circle', 'crane');
await ev(p, s => { s.formationRt.cdUntil = 0; return 1; }); await p.keyboard.press('KeyX'); await p.waitForTimeout(120);
const sw = await p.evaluate(async () => { const s = window.__S, r = s.formationRt, out = {}; out.cur = r.current; out.settling = s.combatNow < r.settleUntil; out.cdLeft = Math.round((r.cdUntil - s.combatNow) / 1000);
  out.again = r.switch(s.combatNow); out.prog = r.progress(s.combatNow)?.text ?? null;
  const hud = []; const walk = l => { for (const o of l) { if (o.getData?.('id') === 'formation' || o.name === 'buff-formation') hud.push(o.name); if (o.list) walk(o.list); } }; walk(s.children.list);
  out.info = r.info()?.name; out.stats = r.stats.switches; return out; });
ck('按 X：方圆 → 鹤翼，成阵 1 秒、冷却 15 秒；冷却中再按无效', sw.cur === 'crane' && sw.settling && sw.cdLeft === 15 && sw.again === false && sw.info === '阵 · 鹤翼阵', sw);

// ⑥ 出击打法：敌人围上来，锋矢冲锋穿透、方圆推开、雁行齐射；长蛇绕击、八阵困阵（护阵）
const spawnRing = (s, r = 160, n = 12) => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; s.spawnEnemy('infantry', s.player.x + Math.cos(a) * r, s.player.y + Math.sin(a) * r, 1, true); } };
const sortie = async (id, prep) => { await use(p, id); await calm(p); await p.waitForTimeout(1500);
  return ev(p, (s, [id, prep, ring]) => { eval('(' + ring + ')')(s, id === 'wedge' ? 190 : 150); if (prep === 'front') { const f = s.legion.formation; for (let k = 0; k < 8; k++) s.spawnEnemy('infantry', s.player.x + Math.cos(f.facing) * (150 + k * 22) + (k % 2 ? 18 : -18), s.player.y + Math.sin(f.facing) * (150 + k * 22), 1, true); }
    for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.hp = 99999; return true; }, [id, prep, String(spawnRing)]).then(() => p.waitForTimeout(300)).then(() => ev(p, s => { const r = s.formationRt; window.__b4 = { ...r.stats }; s.legion.cycleOrder(); return true; })); };
const stat = () => ev(p, s => { const r = s.formationRt, b4 = window.__b4, d = {}; for (const k of Object.keys(r.stats)) d[k] = r.stats[k] - (b4[k] ?? 0); if (s.legion.order === 'sortie') s.legion.cycleOrder(); return d; });
await sortie('wedge', 'front'); await p.waitForTimeout(900); const sWedge = await stat();
ck('锋矢出击：全队直线冲锋，沿途撞到敌人', sWedge.charges === 1 && sWedge.chargeHits >= 2, sWedge);
await sortie('circle'); await p.waitForTimeout(200); const sCircle = await stat();
ck('方圆出击：外圈推开一圈敌人', sCircle.pushed >= 4, sCircle);
await sortie('geese'); await p.waitForTimeout(1400); const sGeese = await stat();
ck('雁行出击：朝最密处齐射三轮', sGeese.volleys >= 2, sGeese);
await sortie('crane'); await p.waitForTimeout(200); const sCrane = await stat();
ck('鹤翼出击：两翼向最密处包抄', sCrane.flank >= 4, sCrane);
await use(p, 'snake'); await calm(p); await p.waitForTimeout(1200);
for (let i = 0; i < 6; i++) { await ev(p, (s, ring) => { s.player.damageImmune = true; s.player.sprite.setPosition(s.player.x + 40, s.player.y); eval('(' + ring + ')')(s, 70, 6); return true; }, String(spawnRing)); await p.waitForTimeout(400); }
const sSnake = await ev(p, s => s.formationRt.stats.graze);
ck('长蛇（护阵）：蛇身路过的敌人被顺手打', sSnake >= 3, sSnake);
await use(p, 'bazhen'); await calm(p); await ev(p, (s, ring) => { eval('(' + ring + ')')(s, 150, 10); for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.hp = 99999; s.formationRt.trapAt = 0; return true; }, String(spawnRing)); await p.waitForTimeout(900);
const sBz = await ev(p, s => ({ trapped: s.formationRt.stats.trapped, slowed: s.enemies.filter(e => e.active && e.martialSlowUntil > s.combatNow && e.martialSlow < 1).length }));
ck('八阵（护阵）：阵内敌人减速、困住一个', sBz.trapped >= 1 && sBz.slowed >= 3, sBz);
await use(p, 'crane', 'circle'); for (let i = 0; i < 9; i++) { await calm(p); await p.waitForTimeout(500); }
await p.screenshot({ path: `${OUT}/battle-crane.png` });

// ⑥b 二期表现：地面阵纹（低透明、只在护阵成阵时）、出击淡出、设置可关；变阵竖旗；小地图阵纹；增益条阵旗图标
await p.waitForFunction(() => window.__game.scene.getScene('GameScene').textures.exists('formation_sigils'), null, { timeout: 30000 });
const fx1 = await ev(p, s => { const f = window.__find(s.children, 'formation-sigil') ?? s.children.getByName('formation-sigil'); const mf = null;
  return { vis: !!f?.visible, alpha: f?.alpha ?? 0, frame: f?.frame?.name, cur: s.formationRt.current, w: f?.displayWidth ?? 0, mini: !!mf?.visible, icon: s.player.formationInfo?.()?.icon }; });
ck('地面阵纹：鹤翼阵纹铺在部曲脚下（透明度 ≈ 0.3）；增益条用阵旗图标', fx1.vis && Math.abs(fx1.alpha - .3) < .06 && String(fx1.frame) === '2' && fx1.w >= 200 && fx1.icon === 'formation_icon_crane', fx1);
await ev(p, s => { s.battleMap?.toggleBig(); return 1; }); await p.waitForTimeout(1600);
const mapFm = await ev(p, s => { const o = window.__find(s.children, 'painted-map-formation') ?? window.__find(s.children, 'battle-map-formation'); return { vis: !!o?.visible, frame: o?.frame?.name, mode: s.mode }; });
await p.screenshot({ path: `${OUT}/map-formation.png` });
ck('舆图（M）：主将金菱下垫当前阵纹小图，部曲画淡青点', mapFm.vis && String(mapFm.frame) === '2', mapFm);
await ev(p, s => { s.battleMap?.toggleBig(); return 1; }); await p.waitForTimeout(1200);
await ev(p, s => { s.legion.cycleOrder(); return 1; }); await p.waitForTimeout(900);
const fx2 = await ev(p, s => { const f = s.children.getByName('formation-sigil'); const a = f?.visible ? f.alpha : 0; s.legion.cycleOrder(); return a; });
ck('出击时阵纹淡出', fx2 < .05, fx2);
await ev(p, s => { localStorage.setItem('im_formation_sigil', 'off'); return 1; });
const fx3 = await p.evaluate(async () => { const B = await window.__mod('systems/BattleSettings.ts'); B.setFormationSigil('off'); await new Promise(r => setTimeout(r, 900)); const s = window.__S, f = s.children.getByName('formation-sigil'); const off = f?.visible ? f.alpha : 0; B.setFormationSigil('on'); return off; });
ck('设置「阵纹 · 关」：不画阵纹', fx3 < .05, fx3);
await ev(p, s => { const r = s.formationRt; r.loadout = ['crane', 'circle']; r.idx = 0; r.cdUntil = 0; return r.switch(s.combatNow); });
await p.waitForTimeout(250);
const fx4 = await ev(p, s => ({ flag: s.children.list.filter(o => o.name === 'formation-flag').length, cur: s.formationRt.current }));
ck('按 X 变阵：主将脚下竖起金盾旗（手绘序列帧）', fx4.flag >= 1 && fx4.cur === 'circle', fx4);
for (let i = 0; i < 5; i++) { await calm(p); await p.waitForTimeout(500); }
await p.screenshot({ path: `${OUT}/battle-circle-sigil.png` });

// ⑦ 行营「布阵」页
const camp = await p.evaluate(async () => { const s = window.__S; s.resting = true; s.setMode('rest'); s.campUI.open('test-form-rest', '下一关'); await new Promise(r => setTimeout(r, 5200));
  const ui = s.campUI, f = n => window.__find(ui.root, n), tab = f('camp-tab-5'); tab?.emit('pointerdown'); await new Promise(r => setTimeout(r, 300));
  const pick = f('formation-pick-0-geese'); pick?.emit('pointerdown'); await new Promise(r => setTimeout(r, 300));
  const texts = []; const w = l => { for (const o of l) { if (typeof o.text === 'string') texts.push(o.text); if (o.list) w(o.list); } }; w(ui.root.list);
  const r = s.formationRt; return { tab: !!tab?.visible, cur: ui.tab, picked: !!pick, load: r.loadout, rtCur: r.current, name: f('formation-focus-name')?.text, cap: f('formation-cap')?.text, diagram: !!f('formation-diagram'), fit: texts.find(t => /远程部曲（弓兵、连弩）多时用/.test(t)) ?? null }; });
await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/formation-panel.png` });
ck('行营「布阵」页：点「雁行阵」布为主阵，战斗里的军阵跟着改；有说明（含「适用：远程部曲多时用」）与站位示意、入阵人数', camp.tab && camp.cur === 5 && camp.picked && camp.load[0] === 'geese' && camp.rtCur === 'geese' && camp.name === '雁行阵' && /入阵 \d+ \/ \d+ 人/.test(camp.cap ?? '') && camp.diagram && !!camp.fit, camp);
await p.close();

// ⑧ 按进度：第一章通关（&mech=real）军阵还没开：没有阵、X 无效、没有布阵页签
const ch1done = { version: 10, yellowStages: 3, cleared: { huangjin: true, hulao: false }, worldAvailable: true, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], chapterSeen: 2, tutorialDone: true };
const q = await open('&mech=real', ch1done);
const gate = await q.evaluate(async () => { const s = window.__game.scene.getScene('GameScene'), M = await import('/src/data/mechanicUnlocks.ts'); M.mechRefresh(); const r = s.formationRt;
  const x = r ? r.switch(s.combatNow) : false; s.resting = true; s.setMode('rest'); s.campUI.open('test-form-gate', '下一关'); await new Promise(r2 => setTimeout(r2, 300));
  return { open: M.mechOpen('formation'), need: M.mechNeed('formation'), known: r?.known ?? null, cur: r?.current ?? null, x, info: s.player.formationInfo?.() ?? null, tab: window.__find(s.campUI.root, 'camp-tab-5')?.visible ?? null }; });
ck('第一章通关（按进度）：军阵未开（第四章通关后 = 已平定 12 关）；没有阵、X 无效、没有增益图标、行营没有「布阵」页签', !gate.open && gate.need === 12 && gate.known?.length === 0 && gate.cur === null && gate.x === false && gate.info === null && gate.tab === false, gate);
await q.close();
ck('无报错', !errors.length, errors.slice(0, 4));
await b.close();
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
