// 战场回血（用户 11-19「我感觉地图上也需要更多回血手段」；data/battleHeal、systems/BattleHeal）：
// 1-1 开一局，逐个验：干粮 / 酒肉（受伤时吸过来吃、满血不捡、回血量对）、泉眼（站上去回血、水量用完冷却、屏外箭头）、
// 军中伤药（副将必掉 15%、精锐保底）、低血保护（附近放伤药）、首领段前排了泉眼。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-battle-heal.mjs   截图 assets/review/battle-heal/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/battle-heal'; mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0&story=off');
await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.battleHeal && s.textures.exists('scene_v2_waterpoints'); }, null, { timeout: 120000 });
await p.waitForTimeout(1000);
// 安静的场地：不刷兵、清场、主将不掉血（只测回血）
await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), P = s.player;
  s.updateSpawner = () => {}; if (s.traits) s.traits.pick = () => null; P.damageImmune = true; P.stats.regen = 0; P.growth.gear.regen = 0; P.weapons.forEach(w => { w.cooldownLeft = 1e9; });
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  s.battleHeal.schedule = []; // 只测手动放的泉眼
});
const wait = ms => p.waitForTimeout(ms);

// 1 干粮 / 酒肉
const food = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), P = s.player, H = s.battleHeal, wait = ms => new Promise(r => setTimeout(r, ms));
  P.hp = P.maxHp; H.onPropBroken('grain', P.x + 50, P.y, () => 0); await wait(600);
  const keptWhenFull = H.foods.filter(f => f.active).length;
  P.hp = P.maxHp * .5; const h0 = P.hp; await wait(900);
  const ate = Math.round((P.hp - h0) / P.maxHp * 1000) / 10;
  H.onPropBroken('crate', P.x + 60, P.y, () => 0); const h1 = P.hp; await wait(900);
  const ate2 = Math.round((P.hp - h1) / P.maxHp * 1000) / 10;
  const noDrop = (H.onPropBroken('grain', P.x, P.y, () => .99), H.foods.filter(f => f.active).length);
  return { keptWhenFull, ate, ate2, noDrop, eaten: H.stats.foodEaten };
});
ck('干粮 / 酒肉：满血留在地上，受伤时吸过来吃，回 5% / 6%', food.keptWhenFull === 1 && Math.abs(food.ate - 5) < .6 && Math.abs(food.ate2 - 6) < .6 && food.noDrop === 0 && food.eaten === 2, food);

// 2 泉眼：站上去回血、水量用完冷却
const spot = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), P = s.player, H = s.battleHeal, wait = ms => new Promise(r => setTimeout(r, ms));
  P.hp = P.maxHp * .4; const sp = H.forceSpot(0, 0, 'spring'), h0 = P.hp; await wait(1000);
  const mid = Math.round((P.hp - h0) / P.maxHp * 1000) / 10; const using = sp.label.text;
  await wait(3200);
  const total = Math.round((P.hp - h0) / P.maxHp * 1000) / 10, cooling = sp.readyAt > s.elapsed, label = sp.label.text;
  const h1 = P.hp; await wait(800); const during = P.hp - h1;
  return { mid, using, total, cooling, label, during: Math.round(during * 10) / 10, uses: H.stats.spotUses };
});
await p.screenshot({ path: `${OUT}/spot-cooldown.png` });
ck('泉眼：站上去每秒回约 6%，一池共回 15%，用完冷却（冷却中不回）', spot.mid > 4 && spot.mid < 8 && Math.abs(spot.total - 15) < .6 && spot.cooling && spot.during === 0 && /水满/.test(spot.label), spot);

// 3 屏外箭头 + 正在回血的画面（另放一处泉眼在主将脚下、一处在屏外）
const arrow = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), P = s.player, H = s.battleHeal, wait = ms => new Promise(r => setTimeout(r, ms));
  for (const sp of [...H.liveSpots]) H.removeSpot(sp);
  const far = H.forceSpot(1500, 0, 'well'); P.hp = P.maxHp * .5; await wait(300);
  const shown = far.arrow.visible, text = far.arrow.getByName('ha-text').text;
  P.hp = P.maxHp * .95; await wait(300); const hiddenWhenHealthy = !far.arrow.visible;
  P.hp = P.maxHp * .45; H.forceSpot(0, 40, 'herb'); H.dropFood(P.x + 130, P.y + 80, .05, '干粮'); H.dropFood(P.x - 140, P.y + 70, .06, '酒肉'); P.hp = P.maxHp * .45; await wait(700);
  const herb = H.liveSpots.find(q => q.kind === 'herb'), foods = H.foods.filter(f => f.active).map(f => f.img.texture.key + ':' + f.img.frame.name); P.hp = P.maxHp * .95; return { shown, text, hiddenWhenHealthy, herb: herb && herb.img.texture.key + ':' + herb.img.frame.name, foods };
});
await p.screenshot({ path: `${OUT}/spot-healing.png` });
ck('泉眼在屏外、主将受伤时屏幕边缘有箭头（满血不出）', arrow.shown && /水井/.test(arrow.text) && arrow.hiddenWhenHealthy, arrow);
ck('新图：药草丛（heal_spot_herb）、干粮 / 酒肉（heal_food 0 / 1）', arrow.herb === 'heal_spot_herb:0' && arrow.foods.includes('heal_food:0') && arrow.foods.includes('heal_food:1'), arrow);

// 4 军中伤药：副将必掉 15%，精锐保底
const med = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), P = s.player, H = s.battleHeal, S = s.supplies, wait = ms => new Promise(r => setTimeout(r, ms));
  for (const sp of [...H.liveSpots]) H.removeSpot(sp); H.foods.forEach(f => { f.active = false; f.img.setVisible(false); });
  S.pouch.length = 0; P.hp = P.maxHp * .9;
  H.onLieutenantDown(P.x, P.y - 10); await wait(500);
  const lt = S.pouch[0] ? { name: S.pouch[0].name, pct: Math.round(S.pouch[0].amount / P.maxHp * 100) } : null;
  const rolls = [0, 1, 2, 3].map(() => H.onEliteDown(P.x + 400, P.y, () => .99));
  return { lt, rolls };
});
ck('军中伤药：副将倒下必掉一份（拾取进药囊，15%），精锐连 3 个没掉第 4 个必掉', med.lt?.name === '军中伤药' && med.lt.pct === 15 && med.rolls.join() === 'false,false,false,true', med);

// 5 低血保护：生命跌破 30% → 附近放一份伤药；药囊满了也能直接服下
const low = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), P = s.player, H = s.battleHeal, S = s.supplies, wait = ms => new Promise(r => setTimeout(r, ms));
  for (const q of S.potions) { q.active = false; q.image.setVisible(false); }
  S.pouch.length = 0; S.pouch.push({ amount: 1, texture: 'x', name: 'a' }, { amount: 1, texture: 'x', name: 'b' }, { amount: 1, texture: 'x', name: 'c' });
  H.lowHpAt = -1e9; H.wasLow = false; P.hp = P.maxHp * .2; await wait(400);
  const pot = S.potions.find(q => q.active && q.name === '军中伤药'), d = pot ? Math.round(Math.hypot(pot.image.x - P.x, pot.image.y - P.y)) : -1;
  if (pot) pot.image.setPosition(P.x, P.y); /* 走到药旁边（直接把药挪到脚下） */ const h0 = P.hp; await wait(3000);
  return { drops: H.stats.lowHpDrops, d, healed: Math.round((P.hp - h0) / P.maxHp * 100) };
});
ck('低血保护：跌破 30% 时 200–260 步内放一份伤药，药囊满了走过去直接服下（12%）', low.drops === 1 && low.d >= 150 && low.d <= 300 && Math.abs(low.healed - 12) <= 1, low);

// 6 首领段前排了一处泉眼（五段关）
const sched = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), H = s.battleHeal; H.setPlan(s.phasePlan); const k = s.phasePlan?.phases.map(q => q.kind) ?? []; return { plan: !!s.phasePlan, kinds: k, want: k.filter(x => x === 'elite' || x === 'event').length + 1, bossAt: s.phasePlan?.bossAt, at: H.schedule.map(e => (e.boss ? 'boss@' : '') + Math.round(e.at)) }; });
ck('分段关：精锐段、事件段各一处（有才排），首领段前 15 秒补一处', !sched.plan || (sched.at.length === sched.want && sched.at[sched.at.length - 1] === 'boss@' + Math.round(sched.bossAt - 15)), sched);
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
