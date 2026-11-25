// 2-3 火烧洛阳重做（共享笔记 luoyang-2-3-design.md）：完整流程 + 城头阶段打不到。电脑布局，需要开发服务器。
//  ① 开局：董卓、吕布都在城头（perch），打不到、自动选靶不选、受击不掉血；吕布在城头踱步（位置在变、播行走帧）；军令「摧毁营寨 0/5」、五座营寨都有地图位置；没有波次横幅
//  ② 拆营寨：军令进度实时更新；五座全毁 → 吕布跃下（leaping → wall），落点在城下
//  ③ 吕布打到 1/3 锁血逃走 → 董卓下城可打 → 20% 吕布斩董卓过场 → 董卓倒地 → 告捷
//  ④ 城墙：一道长墙（不围人，城下一侧全开），2.5D 墙图分整张 + 城垛层；墙线无空档可绕，墙端外侧也进不了城北
//  截图 assets/review/luoyang/{1-perch,2-camps,3-leap,4-lubu,5-dongzhuo,6-finale}.png；GIF 由 tools/gif-luoyang-leap.mjs 另录
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-luoyang-flow.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/luoyang';
mkdirSync(OUT, { recursive: true });
let fail = 0; const errs = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(BASE + '?dev=1&layout=desktop&story=off');
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
await p.evaluate(() => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'hulao', westStage: 3 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.scene.isActive(); }, null, { timeout: 120000 });
const ev = (fn, a) => p.evaluate(([f, a]) => { const s = window.__game.scene.getScene('GameScene'); for (let i = 0; i < 8 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result' && s.mode !== 'story') s.setMode?.('none'); } } return eval('(' + f + ')')(s, a); }, [String(fn), a]);
const wait = ms => p.waitForTimeout(ms);
const snap = () => ev(s => s.dzLubu ? { ...s.dzLubu.snapshot(), metrics: { ...s.dzLubu.metrics } } : null);
await ev(s => { s.player.damageImmune = true; window.__ph = []; s.events.on('boss-phase', e => window.__ph.push(e.phase)); });
for (let i = 0; i < 60 && !(await snap()); i++) await wait(200);
await wait(1500);

// ① 城头对峙
let st = await snap();
// 踱步：3.6 秒里采样位置与帧名（走 → 停 → 回头，会经过停顿，所以看整段的范围与帧变化）
const xs = [], frames = new Set();
for (let i = 0; i < 24; i++) { const r = await ev(s => { const l = s.dzLubu.lubu; return l ? { x: l.x, f: String(l.sprite.frame.name) } : null; }); if (r) { xs.push(r.x); frames.add(r.f); } await wait(150); }
const lx0 = Math.min(...xs), lx1 = Math.max(...xs);
const anim = { frames: [...frames].slice(0, 8), nFrames: frames.size };
ck('① 开局：董卓、吕布都在城头（perch）', st?.phase === 'perch' && st.lubu?.active && st.lubu.inv && st.dzInv, st);
ck('① 吕布在城头踱步（位置在变、行走帧在换）', lx1 - lx0 > 40 && anim.nFrames >= 3, { lx0, lx1, anim });
const hp = await ev(s => { const d = s.dzLubu.dongzhuo, l = s.dzLubu.lubu, h0 = [d.hp, l.hp]; s.hitEnemy(d, 1e5, s.combatNow, 'melee', false, false); s.hitEnemy(l, 1e5, s.combatNow, 'melee', false, false); return { before: h0, after: [d.hp, l.hp] }; });
ck('① 城头的董卓、吕布打不到', hp.before[0] === hp.after[0] && hp.before[1] === hp.after[1], hp);
const tgt = await ev(s => { const d = s.dzLubu.dongzhuo, l = s.dzLubu.lubu, pt = s.priorityWeaponTarget(5000, false), n1 = s.nearestEnemy(d.x, d.y, 80), n2 = s.nearestEnemy(l.x, l.y, 80); return { pt: pt === d || pt === l, n1: n1 === d, n2: n2 === l }; });
ck('① 自动选靶不选城头的董卓、吕布', !tgt.pt && !tgt.n1 && !tgt.n2, tgt);
const ord = await ev(s => { const o = s.battleOrders?.get('stage'); const camps = s.objective?.points ?? []; return { label: o?.label, prog: o?.progress, camps: camps.length, waves: s.chapter.waves.length, bossAtStart: s.chapter.bossAtStart }; });
ck('① 军令「摧毁营寨 0/5」、五座营寨有地图位置、不分波', ord.label === '摧毁营寨' && ord.prog?.cur === 0 && ord.prog?.max === 5 && ord.camps === 5 && ord.waves === 1 && ord.bossAtStart, ord);
// 用户 11-19「营寨可以隔着远点，然后营寨应该做些场景有围栏围着之类的然后小怪比较多守着」（systems/LuoyangCamps）
{ const cm = await ev(s => { const L = s.luoyangCamps, pts = s.objective.points, wy = s.dzLubu.gate.y; let dmin = 1e9; for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) dmin = Math.min(dmin, Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y));
    return { n: L?.camps.length, dmin: Math.round(dmin), south: pts.every(q => q.y > wy + 200), art: s.children.list.filter(o => o.name === 'luoyang-camp').length, boxes: L?.camps.reduce((n, c) => n + c.boxes.length, 0), rep: L?.report() }; });
  ck('⑤ 五座营寨隔得远（两两 ≥ 1000）、都在城墙以南', cm.n === 5 && cm.dmin >= 1000 && cm.south, cm);
  ck('⑤ 每座营寨有营栅（碰撞框）+ 营门柱 / 望楼 / 军旗 / 粮草等布景', cm.boxes === 25 && cm.art >= 5 * 12, { boxes: cm.boxes, art: cm.art });
  ck('⑤ 开局每座营寨都有守军（≥ 8 + 精锐）在营里待命、没惊动', cm.rep.every(c => c.garrison >= 9 && c.idle >= 9 && !c.alerted), cm.rep);
  // 走近第一座营寨（营门外）：全营出营门迎战；之后营门出援兵
  const al = await ev(async s => { const c = s.luoyangCamps.camps[0]; s.player.sprite.setPosition(c.x, c.y + 330); await new Promise(r => setTimeout(r, 1800)); c.next = 0; await new Promise(r => setTimeout(r, 600));
    const g = s.enemies.filter(e => e.active && !e.isSupplySlot && Math.hypot(e.x - c.x, e.y - c.y) < 700).length; return { rep: s.luoyangCamps.report()[0], stats: { ...s.luoyangCamps.stats }, near: g }; });
  await p.screenshot({ path: `${OUT}/9-camp-garrison.png` });
  ck('⑤ 主将走近 → 全营惊动、守军出营门；营门出援兵', al.rep.alerted && al.rep.idle === 0 && al.stats.sallied > 0 && al.rep.reinforce > 0, al);
  await ev(s => { s.player.sprite.setPosition(0, 0); }); }
const wall = await ev(s => { const names = s.children.list.map(o => o.name ?? ''); const c = n => names.filter(x => x === n).length; const z = s.dzLubu, d = z.dongzhuo, l = z.lubu, segs = s.children.list.filter(o => o.name === 'luoyang-wall' || o.name === 'luoyang-gate').map(o => ({ x: o.x - o.displayWidth / 2, width: o.displayWidth })).sort((a, b) => a.x - b.x); let gap = 0; for (let i = 1; i < segs.length; i++) gap = Math.max(gap, segs[i].x - (segs[i - 1].x + segs[i - 1].width)); const back = s.children.list.find(o => o.name === 'luoyang-wall'), front = s.children.list.find(o => o.name === 'luoyang-wall-front'); return { side: c('luoyang-side'), north: c('luoyang-north'), oldCorner: c('luoyang-corner'), oldBack: c('luoyang-wall-back'), seg: c('luoyang-wall'), segFront: c('luoyang-wall-front'), gate: c('luoyang-gate') + c('luoyang-gate-front'), tower: c('luoyang-tower') + c('luoyang-tower-front'), seal: names.filter(x => x.startsWith('luoyang-seal')).length, river: c('luoyang-seal-river'), gap: Math.round(gap), span: segs.length ? [Math.round(segs[0].x - z.gate.x), Math.round(segs[segs.length - 1].x + segs[segs.length - 1].width - z.gate.x)] : null, layer: { back: back?.depth, dz: d.sprite.depth, lb: l?.sprite.depth, front: front?.depth } }; });
ck('④ 城墙：一道长墙（2.5D 墙段整张 + 城垛层、城门楼、两端角楼），不围人：没有侧墙 / 洛水 / 旧后墙垛 / 北墙；墙段之间无缝', wall.seg >= 10 && wall.seg === wall.segFront && wall.gate === 2 && wall.tower === 4 && wall.seal === 0 && wall.river === 0 && wall.span && wall.span[0] < -4000 && wall.span[1] > 4000 && !wall.side && !wall.north && !wall.oldCorner && !wall.oldBack && wall.gap <= 0, wall);
ck('④ 城头的董卓 / 吕布夹在城墙整张与城垛层之间（站在走道上、城垛挡腿）', wall.layer.back < wall.layer.dz && wall.layer.dz < wall.layer.front && wall.layer.back < wall.layer.lb && wall.layer.lb < wall.layer.front, wall.layer);
// 场地内（两端侧墙之间，含转角）逐列往北硬走；参考点用开局时的 x（不能用会变的 player.x）
const seal = await ev(s => { const x0 = s.dzLubu.dongzhuo.x + 210, wy = s.dzLubu.dongzhuo.y + 200, walk = []; for (let x = -5200; x <= 5200; x += 40) { s.player.sprite.setPosition(x0 + x, wy + 40); for (let k = 0; k < 30; k++) { s.player.sprite.y -= 12; s.dzLubu.obstacles.resolve(s.player, [], []); s.dzLubu.keepSouth(); } if (s.player.y < wy - 80) walk.push(Math.round(x)); } s.player.sprite.setPosition(x0, wy + 300); return { through: walk }; });
ck('④ 城墙线挡死（沿墙逐列往北硬走，连墙端外侧也过不去）', seal.through.length === 0, seal);
// 随机补给 / 物件不刷在场地外（原来木箱会进洛水、城墙后面）：主将在场地里绕一圈让补给生成，再查
for (const [dx, dy] of [[-700, 100], [700, 100], [-700, 900], [700, 900], [0, 500]]) { await ev((s, a) => { const g = s.dzLubu.gate; s.player.sprite.setPosition(g.x + a[0], g.y + a[1]); }, [dx, dy]); await wait(500); }
const crates = await ev(s => { const z = s.dzLubu, tg = new Set((s.objective?.targets ?? []).map(t => t.e)); const out = s.enemies.filter(e => e.active && e.isSupplySlot && !tg.has(e) && !z.inArena(e.x, e.y, 0)).map(e => [Math.round(e.x), Math.round(e.y)]); return { n: s.enemies.filter(e => e.active && e.isSupplySlot).length, out }; });
ck('④ 随机补给 / 物件都在场地内', crates.out.length === 0, crates);
await ev(s => { s.player.sprite.setPosition(s.dzLubu.dongzhuo.x + 150, s.dzLubu.dongzhuo.y + 330); }); await wait(700);
await p.screenshot({ path: `${OUT}/1-perch.png` });
// 用户「董卓吕布出来之前不要显示血条」：城头对峙时底部没有首领血条、董卓没有名牌
{ const hb = await ev(s => ({ bar: s.hudTexts.boss.visible, plates: s.children.list.filter(o => o.name === 'boss-name-plate' && o.visible).length, phase: s.dzLubu.phase }));
  ck('① 城头对峙：不显示首领血条、名牌（董卓吕布还没下来）', !hb.bar && hb.plates === 0 && hb.phase === 'perch', hb); }
// 用户「武将攻击逻辑会一直不打营寨」：主将站在营寨旁（附近没别的敌兵），自动攻击会打营寨
{ const c0 = await ev(s => { for (const e of s.enemies) if (e.active && !e.isSupplySlot && !e.invulnerable && e.kind !== 'boss') { e.hp = 0; s.killEnemy(e); } const c = s.objective.standing[0]; s.player.sprite.setPosition(c.x + 70, c.y + 60); s.player.hp = s.player.maxHp; window.__camp = c; return { hp: Math.round(c.hp), lock: c.lockTarget, top: s.priorityWeaponTarget(200, false) === c }; });
  await wait(3500);
  const c1 = await ev(s => ({ hp: Math.round(window.__camp.hp), active: window.__camp.active }));
  ck('② 自动攻击打营寨（营寨是关卡锁定目标，排在最前）', c0.lock && c0.top && (c1.hp < c0.hp || !c1.active), { c0, c1 }); }
// 用户「从后方会有我方小兵去一路打过去会去摧毁营寨」：义军小队从后方出发、走到营寨、把营寨打掉血
{ const sq = await ev(s => { const z = s.allyPush; if (!z) return null; const camps = s.objective.standing, c = camps[camps.length - 1]; s.player.sprite.setPosition(c.x + 40, c.y + 260); const q = z.spawn(); window.__pc = q?.target; window.__pc0 = q?.target?.hp; return q ? { n: q.members.length, from: [Math.round(q.from.x), Math.round(q.from.y)], to: [Math.round(q.target.x), Math.round(q.target.y)], hp0: Math.round(q.target.hp) } : null; });
  await wait(1200); await p.screenshot({ path: `${OUT}/7-push-march.png` });
  let pr = null; for (let i = 0; i < 80; i++) { pr = await ev(s => ({ ...s.allyPush.stats, squadHit: s.allyPush.campHitAt.has(window.__pc), hp: Math.round(window.__pc.hp), active: window.__pc.active, alive: s.allyPush.alive })); if (pr.squadHit && (pr.hp < sq.hp0 || !pr.active)) break; await wait(500); }
  await p.screenshot({ path: `${OUT}/8-push-camp.png` });
  // 舆图：攻势途中展开——碧色行军箭头、义军碧点、营寨血条（挨打的闪）、树林、城墙
  await ev(s => { s.allyPush.spawn(); s.battleMap?.toggleBig(); }); await wait(1300);
  await p.screenshot({ path: `${OUT}/9-map-offensive.png` });
  const md = await ev(s => ({ ...s.battleMap.stats.detail, state: s.battleMap.stats.state, hit: [...s.allyPush.campHitAt.keys()].length }));
  await ev(s => s.battleMap.toggleBig()); await wait(700);
  ck('② 舆图细节：营寨（血条）、友军行军线 / 小队、树林、城墙都画在图上', md.state === 'open' && md.camps >= 1 && md.pushes >= 1 && md.trees > 0, md);
  ck('② 友军攻势：义军小队从后方出发、走到营寨、营寨掉血', !!sq && sq.from[1] > sq.to[1] && pr.squadHit && pr.campHits > 0 && pr.campDamage > 0 && (pr.hp < sq.hp0 || !pr.active), { sq, pr }); }
await ev(s => { s.allyPush?.clear(); }); // 后面的流程（刷兵 60 秒、逐座拆营寨）不要友军插手
// 用户「还是有很多小兵穿过城墙，城墙那一侧不需要生成小兵」：照常刷兵 60 秒（主将站城下、满血），全程抽查没有敌兵在城墙线以北
{ const north = [], spawnedNorth = []; let peak = 0;
  await ev(s => { window.__spN = []; const orig = s.spawnEnemy.bind(s); s.spawnEnemy = (k, x, y, ...r) => { const e = orig(k, x, y, ...r); if (e && k !== 'boss' && e !== s.dzLubu?.lubu && e.def.behavior !== 'wall' && e.y < s.dzLubu.wallLine) window.__spN.push([k, Math.round(e.x), Math.round(e.y)]); return e; }; });
  for (let t = 0; t < 60; t++) {
    const r = await ev(s => { s.player.hp = s.player.maxHp; const z = s.dzLubu, line = z.wallLine, list = s.enemies.filter(e => e.active && !e.isSupplySlot && e !== z.dongzhuo && e !== z.lubu && e.def.behavior !== 'wall'); return { n: list.length, north: list.filter(e => e.y < line - 2).map(e => [e.kind, Math.round(e.x), Math.round(e.y - line)]) }; });
    peak = Math.max(peak, r.n); if (r.north.length) north.push({ t, ...r }); await wait(1000);
  }
  const sp = await ev(s => ({ sp: window.__spN, pushed: s.dzLubu.metrics.pushedSouth, phase: s.dzLubu.phase }));
  ck('① 刷兵 60 秒：没有敌兵在城墙线以北、也没有刷在城北', north.length === 0 && sp.sp.length === 0 && peak > 5, { peak, north: north.slice(0, 3), spawnedNorth: sp.sp.slice(0, 3), pushed: sp.pushed, phase: sp.phase }); }

// ② 拆营寨
const o0 = await ev(s => s.battleOrders?.get('stage')?.progress?.cur ?? 0); // 刷兵 60 秒时主将的自动攻击可能已拆掉营寨：按拆之前的数加一比
await ev(s => { const t = s.objective.targets.find(t => t.e.active); t.e.hp = 0; s.killEnemy(t.e); }); await wait(600);
const o1 = await ev(s => s.battleOrders?.get('stage')?.progress);
ck('② 拆一座：军令进度 +1（x/5）', o1?.cur === o0 + 1 && o1?.max === 5, { before: o0, ...o1 });
await ev(s => { s.player.sprite.setPosition(s.player.x + 200, s.player.y + 300); }); await wait(500);
await p.screenshot({ path: `${OUT}/2-camps.png` });
await ev(s => { for (const t of [...s.objective.targets]) if (t.e.active) { t.e.hp = 0; s.killEnemy(t.e); } });
let leapSeen = false; for (let i = 0; i < 20; i++) { const ph = (await snap())?.phase; if (ph === 'leaping') { leapSeen = true; await p.screenshot({ path: `${OUT}/3-leap.png` }); break; } await wait(80); }
for (let i = 0; i < 30 && (await snap())?.phase !== 'wall'; i++) await wait(150);
st = await snap();
const land = await ev(s => ({ ly: Math.round(s.dzLubu.lubu?.y ?? 0), wallY: Math.round(s.dzLubu.dongzhuo.y + 200) }));
ck('② 五座全毁 → 吕布跃下城头（落在城下，可以打了）', leapSeen && st?.phase === 'wall' && st.metrics.leaps === 1 && !st.lubu.inv && land.ly > land.wallY + 40, { leapSeen, st, land });
await wait(600); await p.screenshot({ path: `${OUT}/4-lubu.png` });
const lo = await ev(s => { const o = s.battleOrders?.get('boss-lubu'); return o ? { label: o.label, state: o.state } : null; });
ck('② 吕布落地后军令出现「打退吕布」', lo?.label === '打退吕布' && lo.state === 'active', lo);
// 用户「吕布不会动」：主将站远处，吕布得自己追过来（群体移动会把免控的敌人定住，所以 DongzhuoLubu 自己推他走）
const far = await ev(s => { const l = s.dzLubu.lubu; s.player.sprite.setPosition(l.x + 420, l.y + 260); s.player.invulnerableUntil = s.combatNow + 9e4; return { d: Math.round(Math.hypot(s.player.x - l.x, s.player.y - l.y)) }; });
await wait(1500);
const near = await ev(s => { const l = s.dzLubu.lubu; return { d: Math.round(Math.hypot(s.player.x - l.x, s.player.y - l.y)), frame: l.sprite.frame?.name }; });
ck('② 吕布在城下会追人（不站桩）', near.d < far.d - 40, { far, near });
// 用户「吕布下来应该是吕布血条」
const bar1 = await ev(s => ({ name: s.hudTexts.boss.visible ? s.hudTexts.boss.text : null, hp: s.hudTexts.bossHp.text, plate: s.children.list.filter(o => o.name === 'boss-name-plate' && o.visible).map(o => o.list?.find(c => c.type === 'Text')?.text) }));
await ev(s => { s.player.sprite.setPosition(s.dzLubu.lubu.x + 120, s.dzLubu.lubu.y + 60); }); await wait(500);
await p.screenshot({ path: `${OUT}/4-lubu-bar.png` });
ck('② 吕布跃下后首领血条 / 名牌是吕布', bar1.name === '吕布' && bar1.plate.some(t => String(t).includes('吕布')) && !bar1.plate.some(t => String(t).includes('董卓')), bar1);

// ③ 吕布 → 董卓 → 胜利
for (let i = 0; i < 8; i++) await ev(s => { const l = s.dzLubu.lubu; if (l?.active && !l.invulnerable) s.hitEnemy(l, 500, s.combatNow, 'melee', false, false); });
await wait(400); st = await snap();
ck('③ 吕布打到 1/3 锁血逃走（不死）', st?.phase === 'fleeing' && st.lubu.active && st.lubu.hp >= Math.floor(st.lubu.max / 3) - 1, st);
for (let i = 0; i < 40 && (await snap())?.phase !== 'down'; i++) await wait(200);
st = await snap();
const d1 = st.dzHp; await ev(s => s.hitEnemy(s.dzLubu.dongzhuo, 200, s.combatNow, 'melee', false, false)); const st2 = await snap();
ck('③ 吕布离场 → 董卓下城、可以打了', st.phase === 'down' && !st.dzInv && st2.dzHp < d1, { st, after: st2.dzHp });
await wait(300); const bar2 = await ev(s => s.hudTexts.boss.visible ? s.hudTexts.boss.text : null);
ck('③ 董卓下城后血条换回董卓', bar2 === '董卓', bar2);
await wait(400); await p.screenshot({ path: `${OUT}/5-dongzhuo.png` });
await ev(s => { const d = s.dzLubu.dongzhuo; d.hp = Math.floor(d.maxHp * .21); s.hitEnemy(d, d.maxHp * .02, s.combatNow, 'melee', false, false); });
await wait(500); st = await snap();
ck('③ 董卓 20%：吕布杀回（过场 / 简短演出）', st?.phase === 'finale' || st?.phase === 'done', st);
await p.screenshot({ path: `${OUT}/6-finale.png` });
for (let i = 0; i < 120 && (await snap())?.phase !== 'done'; i++) await wait(200);
const fin = await ev(s => ({ killed: s.bossKilled, chests: s.bossChests.length, ph: window.__ph }));
ck('③ 董卓倒地、掉宝箱、boss-phase 2 / 3', fin.killed && fin.chests >= 1 && fin.ph.includes(2) && fin.ph.includes(3), fin);
for (let i = 0; i < 40; i++) { const done = await ev(s => { if (s.awaitingChest) s.collectBossChests?.(); return s.over || s.mode === 'rest'; }); if (done) break; await wait(250); }
const end = await ev(s => ({ over: s.over, victory: s.victory, mode: s.mode }));
ck('③ 捡完宝箱 → 告捷', end.victory || end.mode === 'rest', end);
ck('无页面报错', !errs.length, errs.slice(0, 3));
console.log(fail ? `FAILED ${fail}` : 'ALL PASS');
await b.close();
process.exit(fail ? 1 : 0);
