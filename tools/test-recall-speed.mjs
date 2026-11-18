// 出击 → 护阵的收回速度（用户 2026-11-17「按护阵，随从一下子就回来了，回来太快了」）：随行武将与部曲士兵都按行走速度 × RECALL.speedMul 跑回阵位。
// 电脑布局；需要开发服务器。用法：BASE=http://127.0.0.1:5173/ node tools/test-recall-speed.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/recruit';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const rec = (id, kind = 'hero', template = 'spear', name = id, quality = 'orange') => ({ id, kind, hero: kind === 'hero' ? id : undefined, name, template, quality, rank: 1, picks: [] });
const world = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 4 };
const roster = { version: 1, lord: 'zhaoyun', lordFinal: true, owned: [rec('zhaoyun'), rec('guanyu'), rec('r_1', 'common', 'spear', '武璋', 'green'), rec('r_2', 'common', 'bow', '萧朗', 'white')], followers: ['guanyu', 'r_1', 'r_2'], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 2, hall: 3 };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
await p.addInitScript(([w, r]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, [world, roster]);
await p.goto(base + '?layout=desktop&dev=1&autostart=1&stage=1&followers=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.followers?.members.length === 3 && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await p.waitForTimeout(2000);
const G = "window.__game.scene.getScene('GameScene')";

const r = await p.evaluate(async G0 => {
  const s = eval(G0), pl = s.player, sq = s.followers, lg = s.legion, o = {};
  pl.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; pl.weapons = [];
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; for (const m of sq.members) m.maxHp = m.hp = 1e9;
  const tick = () => new Promise(res => setTimeout(res, 30));
  const wait = async ms => { const c0 = s.combatNow; while (s.combatNow - c0 < ms) await tick(); };
  // 部曲：4 名刀盾兵（免费）等入场完
  if (lg.order !== 'guard') lg.cycleOrder();
  lg.recruit('swordsman', 4, true); await wait(3500);
  const troops = () => lg.units.filter(u => u.active);
  for (const u of troops()) u.maxHp = u.hp = 1e9;
  o.troops = troops().length;
  // 出击：精锐按在主将右侧 330 处（血厚），随行与士兵都追出去
  s.spawnEnemy('elite', pl.x + 330, pl.y, 400); const pin = () => { for (const e of s.enemies) if (e.active && e.kind === 'elite') e.sprite?.setPosition?.(pl.x + 330, pl.y); };
  lg.cycleOrder(); o.order = lg.order;
  { const c = s.combatNow; while (s.combatNow - c < 2500) { pin(); await tick(); } }
  o.outF = sq.members.map(m => Math.round(Math.hypot(m.x - pl.x, m.y - pl.y)));
  o.outT = troops().map(u => Math.round(Math.hypot(u.x - pl.x, u.y - pl.y)));
  // 切回护阵：逐帧记录收回途中走过的路程与（战斗）时间
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0;
  const fs = sq.members.map(m => ({ m, x: m.x, y: m.y, path: 0, time: 0, left: 0, n: 0, prevWalk: m.walk, stepping: 0 })), ts = troops().map(u => ({ u, x: u.x, y: u.y, path: 0, time: 0 }));
  const r0 = sq.stats.recalls; lg.cycleOrder(); o.back = lg.order;
  let last = s.combatNow, firstHalf = null; const c1 = s.combatNow;
  while (s.combatNow - c1 < 4000) {
    await tick(); const now = s.combatNow, dt = (now - last) / 1000; last = now; if (dt <= 0) continue;
    for (const f of fs) { const d = Math.hypot(f.m.x - f.x, f.m.y - f.y); if (f.m.recalling) { f.path += d; f.time += dt; f.n++; if (f.m.dir === 'left') f.left++; if (f.m.walk > f.prevWalk) f.stepping++; } f.prevWalk = f.m.walk; f.x = f.m.x; f.y = f.m.y; }
    for (const t of ts) { const d = Math.hypot(t.u.x - t.x, t.u.y - t.y); if (t.u.ai.recall) { t.path += d; t.time += dt; } t.x = t.u.x; t.y = t.u.y; }
    if (firstHalf === null && now - c1 >= 500) firstHalf = sq.members.map(m => Math.round(Math.hypot(m.x - pl.x, m.y - pl.y)));
  }
  o.recalls = sq.stats.recalls - r0; o.halfSec = firstHalf;
  o.f = fs.map(f => ({ name: f.m.recruit.name, walk: Math.round(f.m.walkSpeed), avg: f.time > .2 ? Math.round(f.path / f.time) : null, t: +f.time.toFixed(2), left: f.n ? +(f.left / f.n).toFixed(2) : null, stepping: f.n ? +(f.stepping / f.n).toFixed(2) : null }));
  o.t = ts.map(t => ({ walk: t.u.def.speed, avg: t.time > .3 ? Math.round(t.path / t.time) : null, t: +t.time.toFixed(2), recall: t.u.ai.recall }));
  o.backF = sq.members.map(m => Math.round(Math.hypot(m.x - pl.x, m.y - pl.y)));
  o.backT = troops().map(u => Math.round(Math.hypot(u.x - pl.x, u.y - pl.y)));
  o.recallingLeft = sq.members.filter(m => m.recalling).length;
  // 兜底：随行卡住（每帧按在 500 外）4 秒后直接归位
  const m0 = sq.members[0], tp0 = sq.stats.recallTeleports; m0.chasing = true; m0.place(pl.x + 500, pl.y);
  { const c = s.combatNow; while (s.combatNow - c < 4600 && sq.stats.recallTeleports === tp0) { if (m0.recalling) m0.place(pl.x + 500, pl.y); await tick(); } o.stuckMs = Math.round(s.combatNow - c); }
  o.stuckTp = sq.stats.recallTeleports - tp0; await wait(200); o.stuckDist = Math.round(Math.hypot(m0.x - pl.x, m0.y - pl.y));
  return o;
}, G);
await p.screenshot({ path: `${out}/recall-speed-desktop.png` });
ck('出击：随行与士兵都追出去（都 > 150 像素；弓手停在射程上）', r.order === 'sortie' && r.troops >= 4 && r.outF.every(d => d > 150) && r.outT.some(d => d > 150), r);
ck('切回护阵：随行进入收回状态，0.5 秒时还在半路（不再一下子被拉回来）', r.back === 'guard' && r.recalls >= 3 && r.halfSec.every(d => d > 80), r);
ck('随行收回的平均速度 ≤ 1.3 × 行走速度（且不慢于 0.9 ×）', r.f.every(f => f.avg !== null && f.avg <= f.walk * 1.3 && f.avg >= f.walk * .9), r.f);
ck('士兵收回的平均速度 ≤ 1.3 × 行走速度', r.t.filter(t => t.avg !== null).length >= 2 && r.t.every(t => t.avg === null || t.avg <= t.walk * 1.3), r.t);
ck('随行收回时转身朝阵位跑、播行走帧（大多面朝左；七成以上的帧行走帧在前进）', r.f.every(f => f.left >= .6 && f.stepping >= .7), r.f);
ck('4 秒内随行与士兵都回到主将身边（随行 ≤ 80、士兵 ≤ 200）', r.backF.every(d => d <= 80) && r.backT.every(d => d <= 200) && r.recallingLeft === 0, r);
ck('兜底：随行卡住时收回 4 秒后直接归位', r.stuckTp === 1 && r.stuckMs >= 3900 && r.stuckDist <= 80, { stuckTp: r.stuckTp, stuckMs: r.stuckMs, stuckDist: r.stuckDist });
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 6));
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
