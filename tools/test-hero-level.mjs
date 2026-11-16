// 武将等级跨战斗继承（2026-11-16，hero-level-proposal.md 做法 A）：经验表、章节上限与暂存、起始等级、老档迁移、
// 永久属性点、开局读入、同章连打保留本局额外点、结算折算比例、HUD「Lv · 战功」。电脑布局 1280×720。
// 需要开发服务器 5173。用法：node tools/test-hero-level.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/hero-level';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
await p.addInitScript(() => {
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
  if (!sessionStorage.getItem('seeded')) {
    localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun');
    // 赵云已有旧记录（属性点改版前）：Lv6，武力已加 2 点 → 改版后换算为 4 点（Lv6 共 5 点，还剩 1 点）
    localStorage.setItem('im_heroes_v1', JSON.stringify({ version: 1, migrated: true, heroes: { zhaoyun: { level: 6, xp: 0, attributes: { might: 2, quickness: 0, critical: 0, constitution: 0, agility: 0 } } } }));
    sessionStorage.setItem('seeded', '1');
  }
});
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; });
await p.waitForTimeout(500);

// 1) 开局读入武将等级与永久属性
const start = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), g = s.player.growth; s.updateHud?.();
  return { might: g.attributes.might, free: g.heroFree, un: g.unallocated, lv: s.heroLv, battle: s.player.level, hud: s.hudTexts.level.text, full: s.player.hp === s.player.maxHp }; });
ck('属性点改版换算：旧记录武力 2 → 4；Lv6 共 5 点、剩 1 点；新开一场生命回满', start.might === 4 && start.free === 1 && start.un === 1 && start.lv === 6 && start.battle === 1 && start.full, start);
ck('HUD 显示「赵云 Lv.6 · 战功 1」', start.hud === '赵云 Lv.6 · 战功 1', start.hud);
await p.screenshot({ path: `${out}/desktop-hud.png`, clip: { x: 0, y: 0, width: 640, height: 200 } });

// 2) 局内升级 = 战功，不再给属性点；加点用的是永久点（测试战斗不写回）
const alloc = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), g = s.player.growth, hp = await window.__mod('/src/systems/HeroProgress.ts'), out = {};
  s.player.gainXp(500); out.battleLv = s.player.level; out.un = g.unallocated; out.runXp = s.player.runXp;
  s.attributeReturn = 'none'; s.renderAttributePanel(); s.setMode('attributes'); await new Promise(r => setTimeout(r, 150));
  const btn = s.attributePanel.list.flatMap(o => [o, ...(o.list ?? [])]).find(o => o.name === 'attribute-add-constitution');
  out.btn = !!btn; if (btn) btn.emit('pointerdown'); await new Promise(r => setTimeout(r, 100));
  out.after = [g.attributes.constitution, g.unallocated, g.heroFree]; out.saved = hp.heroAttrs('zhaoyun').constitution;
  s.setMode('none'); return out;
});
ck('局内升级（战功）不再给属性点，本场经验累计在 runXp', alloc.battleLv > 5 && alloc.un === 1 && alloc.runXp >= 500, alloc);
ck('加点消耗永久点；测试战斗（?dev=1）不写回存档', alloc.btn && JSON.stringify(alloc.after) === '[1,0,0]' && alloc.saved === 0, alloc);

// 2b) 每点效果与「统御」；首通经验不乘 70%
const fx = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), g = s.player.growth, saved = { ...g.attributes }, out = {};
  for (const k in g.attributes) g.attributes[k] = 0; const ally0 = g.allyDamageMultiplier(), hp0 = g.bonusMaxHp(), crit0 = g.criticalBonus();
  g.attributes.command = 2; g.attributes.constitution = 2; g.attributes.critical = 3; out.ally = Math.round(g.allyDamageMultiplier() / ally0 * 1000) / 1000; out.hp = g.bonusMaxHp() - hp0; out.crit = Math.round((g.criticalBonus() - crit0) * 1000) / 1000;
  out.rows = s.attributeRows.length; Object.assign(g.attributes, saved);
  const runXp = s.player.runXp; s.player.runXp = 100; s.heroXpBonus = 120; out.lord = s.lordHeroXp(); s.player.runXp = runXp; s.heroXpBonus = 0; return out; });
ck('每点效果减半：体魄 2 点 = 生命 +10%、会心 3 点 = 暴击 +3%；新增统御 2 点 = 部曲伤害 ×1.06；面板 6 行', fx.ally === 1.06 && fx.hp === 10 && fx.crit === .03 && fx.rows === 6, fx);
ck('结算经验 = 本场经验 × 70% + 首次通关经验（不打折）', Math.round(fx.lord) === 190, fx.lord);

// 3) 同章连打：保留本局额外点（城池加成），永久点按存档
const carry = await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), g = s.player.growth;
  g.attributes.agility = 1; g.unallocated = 2; g.heroFree = 0; s.player.hp = Math.round(s.player.maxHp / 2);
  s.applyHeroLevel(true);
  const a = { might: g.attributes.might, agility: g.attributes.agility, constitution: g.attributes.constitution, un: g.unallocated, free: g.heroFree, half: Math.round(s.player.hp / s.player.maxHp * 100) };
  s.applyHeroLevel(false); a.fresh = { agility: g.attributes.agility, un: g.unallocated, full: s.player.hp === s.player.maxHp }; return a;
});
ck('同章连打：本局额外加的身法 1 点、额外 2 点保留，生命按比例', carry.might === 4 && carry.agility === 1 && carry.un === 3 && carry.free === 1 && carry.half >= 49 && carry.half <= 51, carry);
ck('新开一场：只剩永久属性，额外点清零，生命回满', carry.fresh.agility === 0 && carry.fresh.un === 1 && carry.fresh.full, carry.fresh);

// 4) 存档层：经验表、上限与暂存、起始等级、迁移、折算比例
const store = await p.evaluate(async () => {
  const hp = await window.__mod('/src/systems/HeroProgress.ts'), rg = await window.__mod('/src/systems/RunGrowth.ts'), slots = await window.__mod('/src/systems/SaveSlots.ts'), out = {};
  out.table = [1, 2, 3, 4, 5, 10].map(rg.xpToNext); out.slot = slots.PROGRESS_KEYS.includes('im_heroes_v1');
  localStorage.removeItem('im_heroes_v1'); localStorage.removeItem('im_chapter1_cleared'); localStorage.removeItem('im_achievements'); hp.resetHeroCache();
  out.open1 = [hp.chaptersOpen(), hp.levelCap(), hp.startLevel(), hp.heroLevel('guanyu'), hp.heroLevel('r_3')];
  const r1 = hp.creditHeroXp('guanyu', 16); out.lv2 = [r1.from, r1.to];
  const r2 = hp.creditHeroXp('guanyu', 99999); out.capped = [r2.to, r2.capped, r2.cap];
  out.points = [hp.heroFreePoints('guanyu'), hp.allocateHeroAttr('guanyu', 'might'), hp.heroFreePoints('guanyu'), hp.heroAttrs('guanyu').might];
  localStorage.setItem('im_chapter1_cleared', 'true'); hp.resetHeroCache();
  out.open2 = [hp.chaptersOpen(), hp.levelCap(), hp.startLevel(), hp.heroLevel('guanyu'), hp.heroLevel('huangzhong')];
  for (let i = 0; i < 7; i++) hp.allocateHeroAttr('guanyu', 'might'); out.maxOne = [hp.heroAttrs('guanyu').might, hp.allocateHeroAttr('guanyu', 'might')];
  // 老档迁移：打赢过仗的武将补到上限的一半
  localStorage.removeItem('im_heroes_v1'); localStorage.setItem('im_achievements', JSON.stringify({ unlocked: {}, counters: {}, heroes: ['machao'] })); hp.resetHeroCache();
  out.migr = [hp.heroLevel('machao'), hp.heroLevel('zhangfei'), JSON.parse(localStorage.getItem('im_heroes_v1')).migrated];
  out.fc = [hp.claimFirstClear('huangjin-1'), hp.claimFirstClear('huangjin-1'), hp.claimFirstClear('hulao-2'), hp.claimFirstClear('third-1'), hp.claimFirstClear('guandu-3'), hp.claimFirstClear('chibi-3'), hp.claimFirstClear('lubu'), hp.claimFirstClear(null)];
  hp.resetHeroCache(); out.fcKept = [hp.claimFirstClear('huangjin-1'), hp.claimFirstClear('huangjin-2')];
  const s = window.__game.scene.getScene('GameScene'); out.rate = s.heroXpRate(); out.key = s.stableRewardKey();
  // 各章场景的首通 / 赠马关卡键：第 3–5 章由 ThirdGameScene（群雄、赤壁）与 GuanduGameScene 覆盖；攻城、军情、三英战吕布没有键（不发首通经验）
  const sm = window.__game.scene, keyOf = n => { const sc = sm.getScene(n); if (!sc) return 'missing'; const probe = Object.assign(Object.create(sc), { runConfig: { encounter: 'qunxiong' }, chapter: { id: 'hulao', westStage: 3 } }); return [sc.stableRewardKey.call(probe), sc.heroXpRate.call(probe)]; };
  out.keys = Object.fromEntries(['ThirdGameScene', 'GuanduGameScene', 'ChibiGameScene', 'SiegeGameScene', 'IntelGameScene', 'LubuGameScene'].map(n => [n, keyOf(n)]));
  return out;
});
ck('经验表与原来一致（16 / 16 / 36 / 52 / 88 / 188）', JSON.stringify(store.table) === '[16,16,36,52,88,188]' && store.slot, store);
ck('只开第一章：上限 10，新武将从 Lv1 起步（含招募的 r_）', JSON.stringify(store.open1) === '[1,10,1,1,1]', store.open1);
ck('结算记经验：Lv1 + 16 → Lv2；超出上限停在 Lv10，经验暂存', JSON.stringify(store.lv2) === '[1,2]' && JSON.stringify(store.capped) === '[10,true,10]', store);
ck('每级 1 个永久属性点（Lv10 = 9 点），加点写入存档', JSON.stringify(store.points) === '[9,true,8,1]', store.points);
ck('开第二章：上限 15，暂存经验补升；新武将从 Lv10（上限 − 5）起步', store.open2[0] === 2 && store.open2[1] === 15 && store.open2[2] === 10 && store.open2[3] > 10 && store.open2[4] === 10, store.open2);
ck('单项属性最多 8 点', JSON.stringify(store.maxOne) === '[8,false]', store.maxOne);
ck('老档迁移：打赢过仗的武将补到当前上限的一半（≥ 起始等级），只迁移一次', store.migr[0] === 10 && store.migr[1] === 10 && store.migr[2] === true, store.migr);
ck('主线关按 70% 折算', store.rate === .7, store.rate);
ck('第 3–5 章场景有首通键（third-1 / guandu-1 / chibi-1，70% 折算）；攻城、军情、三英战吕布没有键、按 35% 折算', JSON.stringify(store.keys) === JSON.stringify({ ThirdGameScene: ['third-1', .7], GuanduGameScene: ['guandu-1', .7], ChibiGameScene: ['chibi-1', .7], SiegeGameScene: [null, .35], IntelGameScene: [null, .35], LubuGameScene: [null, .35] }), store.keys);
ck('首次通关经验：一章 120、二章 250、三章 380、四章 510、五章 640；每关只给一次，存档保留；挑战关不给', JSON.stringify(store.fc) === '[120,0,250,380,510,640,0,0]' && JSON.stringify(store.fcKept) === '[0,120]' && store.key === 'huangjin-1', { fc: store.fc, fcKept: store.fcKept, key: store.key });

ck('控制台无报错', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
