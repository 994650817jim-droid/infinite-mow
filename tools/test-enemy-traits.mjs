// 各章新兵种第一批（data/enemyRoster + systems/EnemyTraits）：1-3 开一局——按关卡配置自然刷出新兵种；再把第一批 9 种（+ 猛兽）刷在主将身边逐个查机制。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-enemy-traits.mjs   截图 assets/review/enemy-traits/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const heroRec = id => ({ id, kind: 'hero', hero: id, name: id, template: 'spear', quality: 'orange', rank: 1, picks: [] });
const roster = { version: 1, lord: 'zhaoyun', lordFinal: true, owned: [heroRec('zhaoyun')], followers: [], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 2, hall: 3 };
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 12, tutorialDone: true };
const heroes = { version: 1, migrated: true, attrSet: 3, heroes: { zhaoyun: { level: 20, xp: 0, attributes: { strength: 10, agility: 9, intellect: 0, command: 0 } } } };
const OUT = 'assets/review/enemy-traits'; mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
await p.addInitScript(([r, w, h]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_heroes_v1', JSON.stringify(h)); sessionStorage.setItem('seeded', '1'); } }, [roster, world, heroes]);
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
await p.evaluate(() => { const s0 = window.__game.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 3 }); s0.scene.start('GameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.elapsed < 6 && s.traits; }, null, { timeout: 120000 });
await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); window.__S = s;
  window.__clearUi = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') s.chooseRecruit?.(0); else break; } };
  for (let i = 0; i < 30; i++) { window.__clearUi(); await new Promise(r => setTimeout(r, 100)); }
});

// 1) 自然刷怪：1-3 配了符水道徒（40 秒起）+ 黄巾力士（70 秒起）
const nat = await p.evaluate(async () => {
  const s = window.__S; s.player.damageImmune = true; if (s.devSetTime) s.devSetTime(75); else s.elapsed = 75;
  const seen = {}, t = performance.now(); s.devTimeScale = 3;
  while (performance.now() - t < 20000) { window.__clearUi(); for (const e of s.enemies) if (e.active && e.def.roster) seen[e.def.roster] = Math.max(seen[e.def.roster] ?? 0, s.traits.count(e.def.roster)); await new Promise(r => setTimeout(r, 150)); }
  s.devTimeScale = 1;
  return { key: s.hardKey() + '.' + s.hardStage(), seen, spawned: s.traits.metrics.spawned };
});
ck('1-3 按关卡配置自然刷出新兵种（符水道徒 / 黄巾力士），各自不超上限', nat.key === 'huangjin.3' && (nat.seen.fushui > 0 || nat.seen.lishi > 0) && !(nat.seen.fushui > 4) && !(nat.seen.lishi > 4), nat);

// 2) 逐个兵种刷在身边查机制（敌人设无敌，免得被主将秒掉；主将不免伤但血量放大，看掉血）
const r = await p.evaluate(async () => {
  const s = window.__S, T = s.traits, P = s.player, wait = ms => new Promise(r => setTimeout(r, ms));
  for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate();
  s.devSpawnOff = true; const origPick = T.pick.bind(T); T.pick = () => null; const origUpd = s.updateSpawner; s.updateSpawner = () => {};
  P.damageImmune = false; window.__hurt = 0; const tk = P.takeDamage.bind(P); P.takeDamage = (d, n) => { const h = P.hp, ok = tk(d, n); window.__hurt += h - P.hp; P.hp = P.maxHp; P.alive = true; return ok; }; const keep = () => { P.invulnUntil = 0; P.hp = Math.max(P.hp, P.maxHp * .5); window.__clearUi(); };
  const at = (id, dx, dy) => { const e = T.spawnSpecial(id, { x: P.x + dx, y: P.y + dy }); if (e) e.invulnerable = true; return e; };
  const out = { over0: s.over };
  // 黄巾力士：不吃击退、贴近砸地
  const li = at('lishi', 90, 0); const hp0 = window.__hurt, m0 = T.metrics.slams;
  for (let i = 0; i < 30; i++) { keep(); P.sprite.setPosition(li.x - 80, li.y); await wait(100); }
  out.lishi = { immune: li.controlImmune, slams: T.metrics.slams - m0, hurt: Math.round(window.__hurt - hp0), r: li.radius };
  li.invulnerable = false; li.deactivate();
  // 符水道徒：给身边受伤友军回血
  const fu = at('fushui', 300, 0), pal = s.spawnEnemy('infantry', P.x + 330, P.y + 40, 20, true); pal.invulnerable = true; pal.hp = Math.round(pal.maxHp * .4); const h0 = pal.hp;
  for (let i = 0; i < 25; i++) { keep(); pal.sprite.setPosition(fu.x + 40, fu.y + 20); await wait(100); }
  out.fushui = { before: h0, after: pal.hp, heals: T.metrics.heals, gap: Math.round(Math.hypot(fu.x - P.x, fu.y - P.y)) };
  // 关守滚石兵：站远处往脚下抛石（落点预警后砸下）
  const gs = at('gunshi', 380, 0); const hp1 = window.__hurt, t0 = T.metrics.throws;
  for (let i = 0; i < 55; i++) { keep(); await wait(100); }
  out.gunshi = { throws: T.metrics.throws - t0, hurt: Math.round(window.__hurt - hp1), stone: s.textures.exists('shu_pass') };
  // 纵火兵：一路留火、倒下爆燃
  const zh = at('zonghuo', 260, 0); const f0 = T.metrics.fires;
  for (let i = 0; i < 20; i++) { keep(); await wait(100); }
  zh.invulnerable = false; s.hitEnemy(zh, 1e7, s.combatNow, 'melee', false, false); await wait(200);
  out.zonghuo = { fires: T.metrics.fires - f0, bursts: T.metrics.bursts, fireSprites: s.children.list.filter(o => o.name === 'trait-fire').length };
  // 毒箭蛮：吹箭中了叠毒、每秒掉血
  const dj = at('dujian', 300, 0); const p0 = T.metrics.poisonTicks;
  for (let i = 0; i < 70 && T.metrics.poisonTicks - p0 < 2; i++) { keep(); await wait(100); }
  out.dujian = { darts: T.metrics.darts, stacks: T.poisonStacks(), ticks: T.metrics.poisonTicks - p0 };
  for (const e of [gs, fu, pal, dj]) { e.invulnerable = false; e.deactivate(); }
  // 羌胡弓骑：绕圈放箭、不冲锋
  const qh = at('qianghu', 500, 0); const a0 = T.metrics.arrows, ds = [];
  for (let i = 0; i < 50; i++) { keep(); await wait(100); if (i > 25) ds.push(Math.round(Math.hypot(qh.x - P.x, qh.y - P.y))); }
  out.qianghu = { arrows: T.metrics.arrows - a0, charge: qh.chargeState, dMin: Math.min(...ds), dMax: Math.max(...ds) };
  // 流民：成群刷
  const n0 = T.count('liumin'); at('liumin', -400, 0); out.liumin = { group: T.count('liumin') - n0 };
  // 投石手（第 11 章）同投掷机制、驯兽兵带 3 只猛兽，驯兽兵倒下猛兽狂暴
  const xs = at('xunshou', -300, 200); const beasts = T.count('beast'); const sp0 = s.enemies.filter(e => e.active && e.def.roster === 'beast').map(e => e.def.speed);
  xs.invulnerable = false; s.hitEnemy(xs, 1e7, s.combatNow, 'melee', false, false); await wait(100);
  const sp1 = s.enemies.filter(e => e.active && e.def.roster === 'beast').map(e => e.def.speed);
  out.xunshou = { beasts, enraged: T.metrics.enraged, faster: sp1.length > 0 && sp1[0] > sp0[0] };
  at('mantoushi', 360, -160); at('lishi', 140, 120); at('fushui', -260, -140); at('dujian', 320, 160); at('zonghuo', -180, 60);
  out.over = s.over; s.updateSpawner = origUpd; T.pick = origPick;
  return out;
});
await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/roster-batch1.png` });
ck('黄巾力士：不吃击退、贴近砸地伤主将、体型放大', r.lishi.immune && r.lishi.slams >= 1 && r.lishi.hurt > 0 && r.lishi.r > 20, r.lishi);
ck('符水道徒：给身边受伤友军回血、和主将保持距离', r.fushui.after > r.fushui.before && r.fushui.heals > 0 && r.fushui.gap > 200, r.fushui);
ck('关守滚石兵：远处抛石，落点砸到主将', r.gunshi.throws >= 1 && r.gunshi.hurt > 0, r.gunshi);
ck('纵火兵：一路留燃烧地面、倒下爆燃', r.zonghuo.fires >= 2 && r.zonghuo.bursts >= 1, r.zonghuo);
ck('毒箭蛮：吹箭中毒、每秒掉血', r.dujian.darts >= 1 && r.dujian.ticks >= 1, r.dujian);
ck('羌胡弓骑：绕主将转圈放箭、不冲锋', r.qianghu.arrows >= 1 && r.qianghu.charge === 'none' && r.qianghu.dMin > 150 && r.qianghu.dMax < 520, r.qianghu);
ck('流民：一次成群刷 6–8 个', r.liumin.group >= 6 && r.liumin.group <= 8, r.liumin);
ck('驯兽兵：带 3 只猛兽，倒下后猛兽狂暴加速', r.xunshou.beasts === 3 && r.xunshou.enraged === 3 && r.xunshou.faster, r.xunshou);
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
