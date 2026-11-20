// 无名之辈 / 史事名将的招式与被动（用户 2026-11-17「需要设计大众脸的自己的技能被动攻击，就是属于大众脸的强度」）。电脑布局；需要开发服务器。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-commoner-skills.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/recruit';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const rec = (id, kind, template, name, quality = 'green') => ({ id, kind, hero: kind === 'hero' ? id : undefined, name, template, quality, rank: 1, picks: [] });
// 随行上限 / 招贤馆等级读营寨（fa1c773）：营寨 town 只从 version ≥ 8 的存档读入，主营 1 级时其他建筑被压回 1 级 → 种 version 8 + 主营 3、招贤馆 3
const world = { version: 8, town: { levels: { hall: 3, barracks: 1, farm: 1, talent: 3 } }, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 4 };
const zero = { strength: 0, agility: 0, intellect: 0, command: 0 };
const heroes = { version: 1, migrated: true, heroes: Object.fromEntries(['zhaoyun', 'guanyu', 'r_1', 'r_2', 'r_3', 'r_4'].map(k => [k, { level: 10, xp: 0, attributes: zero }])) };
const roster = (fs, owned) => ({ version: 1, lord: 'zhaoyun', lordFinal: true, owned: [rec('zhaoyun', 'hero', 'spear', 'zhaoyun', 'orange'), ...owned], followers: fs, offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 4, hall: 3 });
const commons = [rec('r_1', 'common', 'blade', '刀卫'), rec('r_2', 'common', 'spear', '枪手'), rec('r_3', 'common', 'bow', '弓手'), rec('r_4', 'common', 'strategist', '谋士')];
const RA = roster(['r_1', 'r_2', 'r_3'], [...commons, rec('guanyu', 'hero', 'blade', 'guanyu', 'orange')]);
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
await p.addInitScript(([w, r, h]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_heroes_v1', JSON.stringify(h)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, [world, RA, heroes]);
await p.goto(base + '?layout=desktop&dev=1&autostart=1&stage=1&followers=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.followers?.members.length === 3 && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const G = "window.__game.scene.getScene('GameScene')";

// —— 1. 刀 / 枪 / 弓：直接让随行出第 3 下，数命中与每下伤害 ——
const a = await p.evaluate(async G0 => {
  const s = eval(G0), pl = s.player, sq = s.followers, o = {}, [bl, sp, bw] = sq.members;
  pl.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; pl.weapons = []; s.legion.clear?.();
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; for (const m of sq.members) m.maxHp = m.hp = 1e9;
  await new Promise(r => setTimeout(r, 200));
  const foes = pts => { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; const list = pts.map(([x, y]) => s.spawnEnemy('infantry', x, y, 500)); for (const [i, e] of list.entries()) e.sprite.setPosition(pts[i][0], pts[i][1]); s.grid.clear(); for (const e of s.enemies) if (e.active) s.grid.insert(e); return list; };
  const strike = (f, e, dmg = 10, every = true) => { f.attacks = every ? 2 : 0; const h0 = sq.stats.hits, d0 = sq.stats.damage; sq.attack(f, e, s.combatNow, dmg); const hits = sq.stats.hits - h0; return { hits, per: hits ? +((sq.stats.damage - d0) / hits).toFixed(3) : 0 }; };
  sq.rand = () => .99;
  // 刀「横斩」：身边一圈 4 个（普通扇形劈只打前方）
  { const r = 50, es = foes([[bl.x + r, bl.y], [bl.x - r, bl.y], [bl.x, bl.y + r], [bl.x, bl.y - r]]); o.bladeNormal = strike(bl, es[0], 10, false); foes([[bl.x + r, bl.y], [bl.x - r, bl.y], [bl.x, bl.y + r], [bl.x, bl.y - r]]); const t = s.enemies.find(e => e.active && !e.isSupplySlot); o.bladeSkill = strike(bl, t); o.sweep = sq.skillStats.sweep;
    bl.recruit.picks = ['weapon', 'weapon', 'weapon', 'weapon', 'weapon']; foes([[bl.x + r, bl.y]]); o.bladeUp = strike(bl, s.enemies.find(e => e.active && !e.isSupplySlot)); bl.recruit.picks = []; }
  // 枪「突刺」：一条直线上 3 个（穿 2）
  { const es = foes([[sp.x + 60, sp.y], [sp.x + 100, sp.y], [sp.x + 140, sp.y]]); o.spearSkill = strike(sp, es[0]); o.thrust = sq.skillStats.thrust;
    sp.recruit.picks = ['weapon', 'weapon', 'weapon', 'weapon', 'weapon']; const e3 = foes([[sp.x + 60, sp.y], [sp.x + 100, sp.y], [sp.x + 140, sp.y]]); o.spearUp = strike(sp, e3[0]); sp.recruit.picks = []; }
  // 弓「连射」：两个目标各一箭
  { const es = foes([[bw.x + 120, bw.y], [bw.x + 150, bw.y + 40]]); bw.stillAt = s.combatNow; o.bowSkill = strike(bw, es[0]); o.volley = sq.skillStats.volley;
    bw.recruit.picks = ['weapon', 'weapon', 'weapon', 'weapon', 'weapon']; const e2 = foes([[bw.x + 120, bw.y], [bw.x + 150, bw.y + 40]]); bw.stillAt = s.combatNow; o.bowUp = strike(bw, e2[0]); bw.recruit.picks = []; }
  // 弓「瞄准」：站定后暴击（随机数 0 → 必暴）；走动中不暴
  { const es = foes([[bw.x + 120, bw.y]]); sq.rand = () => 0; bw.stillAt = s.combatNow - 2000; o.aim = strike(bw, es[0], 10, false); bw.stillAt = s.combatNow; o.moving = strike(bw, es[0], 10, false); o.crit = sq.skillStats.crit; sq.rand = () => .99; }
  // 刀「格挡」：随机数 0 → 挡下；.99 → 照常掉血
  { bl.hp = 1000; bl.maxHp = 1000; sq.rand = () => 0; sq.hurt(bl, 100, s.combatNow); o.blockHp = bl.hp; sq.rand = () => .99; sq.hurt(bl, 100, s.combatNow); o.hitHp = bl.hp; o.block = sq.skillStats.block; bl.maxHp = bl.hp = 1e9; }
  // 枪「列阵」：身边有部曲士兵时伤害提高
  { s.legion.recruit('swordsman', 2, true); await new Promise(r => setTimeout(r, 3600)); const u = s.legion.units.find(x => x.active); const es = foes([[sp.x + 50, sp.y]]); u.setPosition(sp.x - 30, sp.y); s.legion.rebuildGrid?.(); o.formation = strike(sp, es[0], 10, false); o.formationN = sq.skillStats.formation; }
  return o;
}, G);
ck('刀「横斩」：每第 3 刀改为身边一圈横扫，打到身后的敌人（普通劈砍只打前方）', a.sweep === 1 && a.bladeSkill.hits >= 4 && a.bladeNormal.hits < a.bladeSkill.hits && Math.abs(a.bladeSkill.per - 13) < .01, a);
ck('枪「突刺」：每第 3 下直刺，穿透 2 个（伤害 ×1.5）', a.thrust === 1 && a.spearSkill.hits === 2 && Math.abs(a.spearSkill.per - 15) < .01, a);
ck('弓「连射」：每第 3 下两箭各打一个目标（每箭 ×0.8）', a.volley >= 1 && a.bowSkill.hits === 2 && Math.abs(a.bowSkill.per - 8) < .01, a);
ck('弓「瞄准」：站定后暴击 ×1.6，走动中不暴击', Math.abs(a.aim.per - 16) < .01 && Math.abs(a.moving.per - 10) < .01, a);
ck('刀「格挡」：挡下时不掉血，挡不住照常掉血', a.blockHp === 1000 && a.hitHp < 1000 && a.block === 1, a);
ck('枪「列阵」：身边有部曲士兵时伤害 +8%', a.formationN >= 1 && Math.abs(a.formation.per - 10.8) < .01, a);
ck('升兵器线 5 次：横斩 ×1.3 → ×1.7、突刺 ×1.5 → ×2.0 且穿 3、连射每箭 ×0.8 → ×1.1', Math.abs(a.bladeUp.per - 17) < .01 && Math.abs(a.spearUp.per - 20) < .01 && a.spearUp.hits === 3 && Math.abs(a.bowUp.per - 11) < .01, a);

// —— 2. 谋「包扎」「鼓舞」 + 与名将比强度 ——
const RB = roster(['r_4', 'r_1', 'guanyu'], [...commons, rec('guanyu', 'hero', 'blade', 'guanyu', 'orange')]);
await p.evaluate(([G0, r]) => { localStorage.setItem('im_roster_v1', JSON.stringify(r)); const s = eval(G0); window.__prevPlayer = s.player; s.scene.restart(); }, [G, RB]);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.player !== window.__prevPlayer && s.followers?.members.length === 3 && s.__DEV_ACTIONS; }, null, { timeout: 60000 });
await p.waitForTimeout(1200);
const c = await p.evaluate(async G0 => {
  const s = eval(G0), pl = s.player, sq = s.followers, o = {}, [st, bl, gy] = sq.members;
  pl.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; pl.weapons = [];
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; await new Promise(r => setTimeout(r, 200));
  o.names = sq.members.map(m => m.recruit.name);
  // 鼓舞：刀卫在谋士身边 → 攻速 +6%；关羽（名将）不吃
  bl.place(st.x + 40, st.y); const rm = sq.rallyMap(); o.rally = rm.get(bl) ?? 0; o.rallyHero = rm.get(gy) ?? 0; o.rallySelf = rm.get(st) ?? 0;
  st.recruit.picks = ['passive', 'passive']; o.rallyUp = sq.rallyMap().get(bl) ?? 0; st.recruit.picks = [];
  // 包扎：刀卫半血，谋士第 3 次施术给身边回 4% 最大生命
  bl.maxHp = 1000; bl.hp = 500; bl.place(st.x + 40, st.y); const e = s.spawnEnemy('infantry', st.x + 120, st.y, 500); s.grid.clear(); for (const x of s.enemies) if (x.active) s.grid.insert(x);
  st.attacks = 2; sq.attack(st, e, s.combatNow, 10); o.healHp = bl.hp; o.heal = sq.skillStats.heal;
  // 强度：同一场 6 秒混战各打一遍「不放招式」与「放招式」，招式只带来有限的加成（大众脸的强度）
  //（刀卫普通劈砍本就能一刀劈多个，基础伤害与名将本命武器的对比属于平衡会话，不在这里断言）
  const fight = async noSkill => {
    for (const x of s.enemies) if (x.active && !x.isSupplySlot) x.hp = 0; for (const m of sq.members) { m.maxHp = m.hp = 1e9; m.dealt = 0; m.attacks = 0; m.place(pl.x + (m === st ? -47 : m === bl ? 47 : 0), pl.y + (m === gy ? -64 : -30)); }
    if (noSkill) sq.commonerSkill = () => false; else delete sq.commonerSkill;
    await new Promise(r => setTimeout(r, 100));
    const t0 = s.combatNow; let wave = 0;
    while (s.combatNow - t0 < 6000) { if (s.enemies.filter(x => x.active && !x.isSupplySlot).length < 14) { wave++; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + wave; s.spawnEnemy('infantry', pl.x + Math.cos(a) * 100, pl.y + Math.sin(a) * 100, 300); } } await new Promise(r => setTimeout(r, 60)); }
    delete sq.commonerSkill; return sq.members.map(m => Math.round(m.dealt));
  };
  o.plain = await fight(true); const s0 = { ...sq.skillStats }; o.dealt = await fight(false);
  o.skills = Object.fromEntries(Object.entries(sq.skillStats).map(([k, v]) => [k, v - (s0[k] ?? 0)]));
  return o;
}, G);
await p.screenshot({ path: `${out}/commoner-skills-desktop.png` });
ck('谋「鼓舞」：身边的无名之辈攻速 +6%（谋士自己、名将不吃），升被动 2 次 → +8%', Math.abs(c.rally - .06) < 1e-9 && c.rallyHero === 0 && c.rallySelf === 0 && Math.abs(c.rallyUp - .08) < 1e-9, c);
ck('谋「包扎」：第 3 次施术给身边随行回 4% 最大生命', c.heal === 1 && c.healHp === 540, c);
ck('强度：招式让刀卫 6 秒伤害提高，但不超过 +50%（大众脸的强度）；名将不受招式影响', c.dealt[1] > c.plain[1] && c.dealt[1] <= c.plain[1] * 1.5 && Math.abs(c.dealt[2] - c.plain[2]) <= c.plain[2] * .35, c);
ck('实战中招式会自己放出来（横斩 / 包扎都 ≥ 1）', c.skills.sweep >= 1 && c.skills.heal >= 1, c.skills);

// —— 3. 数值说明随将阶提高（讲武堂「随行操练」的升级前后） ——
const d = await p.evaluate(async () => {
  const R = await import('/src/systems/RosterStore.ts'), C = await import('/src/data/commonerSkills.ts'), o = {};
  for (const t of ['blade', 'spear', 'bow', 'strategist']) o[t] = { a0: C.activeValue(t, 0), a3: C.activeValue(t, 3), p0: C.passiveValue(t, 0), p3: C.passiveValue(t, 3) };
  const r = R.loadRoster().owned.find(x => x.id === 'r_1'); o.pvW = R.rankPreview(r, 'weapon'); o.pvP = R.rankPreview(r, 'passive'); return o;
});
const num = s => (s.match(/[\d.]+/g) ?? []).map(Number);
ck('升阶后招式 / 被动数值都变大（四种模板）', ['blade', 'spear', 'bow', 'strategist'].every(t => num(d[t].a3)[0] > num(d[t].a0)[0] && num(d[t].p3)[0] > num(d[t].p0)[0]), d);
ck('升级前后说明：「伤害 +0% · 横扫 ×1.30」→「伤害 +6% · 横扫 ×1.38」，花费 200', d.pvW.before === '伤害 +0% · 横扫 ×1.30' && d.pvW.after === '伤害 +6% · 横扫 ×1.38' && d.pvW.cost === 200 && /格挡 10%/.test(d.pvP.before) && /格挡 11.5%/.test(d.pvP.after), d);
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 6));
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
