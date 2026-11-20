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
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? (part.startsWith('/src/') ? part : '/src/' + part.replace(/^\//, ''))); // 资源计时缓冲满（默认 250 条）时找不到已加载模块，回退路径别拼成 /src/src/
  if (!sessionStorage.getItem('seeded')) {
    localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun');
    // 赵云已有旧记录（2026-11-17 属性改版前的六项）：Lv6，武力已加 2 点 → 改版后全部退回，Lv6 共 5 点未分配
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
  return { might: g.attributes.strength, free: g.heroFree, un: g.unallocated, lv: s.heroLv, battle: s.player.level, hud: s.hudTexts.level.text, full: s.player.hp === s.player.maxHp }; });
ck('属性改版：旧记录的点数全部退回（不换算），Lv6 共 5 点待分配；开局等级即武将等级 Lv6（2026-11-17 取消局内等级）；新开一场生命回满', start.might === 0 && start.free === 5 && start.un === 5 && start.lv === 6 && start.battle === 6 && start.full, start);
ck('HUD 显示「赵云 Lv.6」+ 建议等级（2026-11-20 软上限：「· 建议 x」，越级时字和经验条换暗金），不再有局内「战功」', /^赵云 Lv\.6 · 建议 \d+$/.test(start.hud), start.hud);
await p.screenshot({ path: `${out}/desktop-hud.png`, clip: { x: 0, y: 0, width: 640, height: 200 } });

// 2) 局内升级 = 战功，不再给属性点；加点用的是永久点（测试战斗不写回）
const alloc = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), g = s.player.growth, hp = await window.__mod('/src/systems/HeroProgress.ts'), out = {};
  s.player.gainXp(500); out.battleLv = s.player.level; out.un = g.unallocated; out.runXp = s.player.runXp;
  s.attributeReturn = 'none'; s.renderAttributePanel(); s.setMode('attributes'); await new Promise(r => setTimeout(r, 150));
  const btn = s.attributePanel.list.flatMap(o => [o, ...(o.list ?? [])]).find(o => o.name === 'attribute-add-strength');
  out.btn = !!btn; if (btn) btn.emit('pointerdown'); await new Promise(r => setTimeout(r, 100));
  out.after = [g.attributes.strength, g.unallocated, g.heroFree]; out.saved = hp.heroAttrs('zhaoyun').strength;
  s.setMode('none'); return out;
});
ck('Player.gainXp 只升级不加点（加点由 GameScene.onHeroLevelUp 给，见 test-level-merge），本场经验累计在 runXp', alloc.battleLv > 5 && alloc.un === 5 && alloc.runXp >= 500, alloc);
ck('加点消耗永久点；测试战斗（?dev=1）不写回存档', alloc.btn && JSON.stringify(alloc.after) === '[1,4,4]' && alloc.saved === 0, alloc);

// 2b) 每点效果与「统御」；首通经验不乘 70%
const fx = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), g = s.player.growth, saved = { ...g.attributes }, out = {};
  for (const k in g.attributes) g.attributes[k] = 0; const ally0 = g.allyDamageMultiplier(), hp0 = g.bonusMaxHp(), crit0 = g.criticalBonus();
  const dm0 = g.damageMultiplier(0), sk0 = g.skillDamageMultiplier();
  g.attributes.command = 2; g.attributes.strength = 2; g.attributes.agility = 4; g.attributes.intellect = 2; out.ally = Math.round(g.allyDamageMultiplier() / ally0 * 1000) / 1000; out.hp = g.bonusMaxHp() - hp0; out.crit = Math.round((g.criticalBonus() - crit0) * 1000) / 1000;
  // 赵云主属性 = 敏捷：敏捷 4 点 → 全伤害 +4%；力量 2 → 伤害 +3%；智力 2 → 法术 +5%、范围 +1.6%（2026-11-17 智力改为法术）
  out.primary = Math.round(g.primaryBonus() * 1000) / 1000; out.dm = Math.round(g.damageMultiplier(0) / dm0 * 10000) / 10000; out.skill = Math.round(g.skillDamageMultiplier() / sk0 * 10000) / 10000; out.area = Math.round(g.areaMultiplier() * 1000) / 1000; out.allyHp = Math.round(g.allyHpMultiplier() * 1000) / 1000;
  out.label = s.attributePanel.list.filter(o => o.type === 'Text').map(o => o.text).find(t => /主属性/.test(t));
  out.rows = s.attributeRows.length; out.spell = [g.spellWeaponMultiplier('flame_banner'), g.spellWeaponMultiplier('crossbow'), g.spellWeaponMultiplier('spear_orbit'), g.spellWeaponMultiplier('guandao')].map(v => Math.round(v * 1000) / 1000); Object.assign(g.attributes, saved);
  const runXp = s.player.runXp; s.player.runXp = 100; s.heroXpBonus = 120; out.lord = s.lordHeroXp(); s.player.runXp = runXp; s.heroXpBonus = 0; return out; });
ck('四项属性：力量 2 = 生命 +6%；敏捷 4 = 暴击 +2.5%（赵云主属性敏捷，每点 ×1.25）；统御 2 = 部曲伤害 ×1.06、部曲生命 ×1.06；面板 4 行', fx.ally === 1.06 && fx.allyHp === 1.06 && fx.hp === 6 && Math.abs(fx.crit - .025) < 1e-9 && fx.rows === 4, fx);
ck('主属性（赵云 = 敏捷）：敏捷 4 点 → 全伤害 +4%；伤害 ×1.03×1.04；智力 2 → 法术伤害 ×1.05×1.04、范围 ×1.016；面板标「主属性」', fx.primary === .04 && fx.dm === 1.0712 && fx.skill === 1.092 && fx.area === 1.016 && /^主属性：敏捷 · 每点效果 ×/.test(fx.label ?? '') /* 2026-11-18 主属性行改为「主属性：敏捷 · 每点效果 ×倍率」 */, fx);
ck('智力 2：法术武器（火旗 / 连弩）的武器命中 ×1.05，物理武器（枪 / 刀）不乘', JSON.stringify(fx.spell) === '[1.05,1.05,1,1]', fx.spell);
ck('结算经验 = 本场经验（已乘倍率）+ 首次通关经验（不打折）', Math.round(fx.lord) === 220, fx.lord);

// 3) 同章连打：保留本局额外点（城池加成），永久点按存档
const carry = await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), g = s.player.growth;
  g.attributes.agility = 1; g.unallocated = 2; g.heroFree = 0; s.player.hp = Math.round(s.player.maxHp / 2);
  s.applyHeroLevel(true);
  const a = { might: g.attributes.strength, agility: g.attributes.agility, un: g.unallocated, free: g.heroFree, half: Math.round(s.player.hp / s.player.maxHp * 100) };
  s.applyHeroLevel(false); a.fresh = { agility: g.attributes.agility, un: g.unallocated, full: s.player.hp === s.player.maxHp }; return a;
});
ck('同章连打：本局额外加的敏捷 1 点、额外 2 点保留，生命按比例', carry.might === 1 && carry.agility === 1 && carry.un === 7 && carry.free === 5 && carry.half >= 49 && carry.half <= 51, carry);
ck('新开一场：只剩永久属性，额外点清零，生命回满', carry.fresh.agility === 0 && carry.fresh.un === 5 && carry.fresh.full, carry.fresh);

// 4) 存档层：经验表、上限与暂存、起始等级、迁移、折算比例
const store = await p.evaluate(async () => {
  const hp = await window.__mod('/src/systems/HeroProgress.ts'), rg = await window.__mod('/src/systems/RunGrowth.ts'), slots = await window.__mod('/src/systems/SaveSlots.ts'), out = {};
  out.table = [1, 2, 3, 4, 5, 10].map(rg.xpToNext); out.slot = slots.PROGRESS_KEYS.includes('im_heroes_v1');
  localStorage.removeItem('im_heroes_v1'); localStorage.removeItem('im_chapter1_cleared'); localStorage.removeItem('im_achievements'); hp.resetHeroCache();
  out.open1 = [hp.chaptersOpen(), hp.levelCap(), hp.startLevel(), hp.heroLevel('guanyu'), hp.heroLevel('r_3')];
  const r1 = hp.creditHeroXp('guanyu', 16); out.lv2 = [r1.from, r1.to];
  const r2 = hp.creditHeroXp('guanyu', 99999); out.capped = [r2.to, r2.capped, r2.cap];
  out.points = [hp.heroFreePoints('guanyu'), hp.allocateHeroAttr('guanyu', 'strength'), hp.heroFreePoints('guanyu'), hp.heroAttrs('guanyu').strength];
  localStorage.setItem('im_chapter1_cleared', 'true'); hp.resetHeroCache();
  out.open2 = [hp.chaptersOpen(), hp.levelCap(), hp.startLevel(), hp.heroLevel('guanyu'), hp.heroLevel('huangzhong')];
  for (let i = 0; i < 9; i++) hp.allocateHeroAttr('guanyu', 'strength'); out.maxOne = [hp.heroAttrs('guanyu').strength, hp.allocateHeroAttr('guanyu', 'strength')];
  // 属性改版老档：六项记录读到时全部退回、只提示一次
  localStorage.setItem('im_heroes_v1', JSON.stringify({ version: 1, migrated: true, heroes: { zhangfei: { level: 9, xp: 0, attributes: { might: 3, quickness: 2, critical: 0, constitution: 1, agility: 0, command: 1 } } } })); hp.resetHeroCache();
  out.refund = { attrs: hp.heroAttrs('zhangfei'), free: hp.heroFreePoints('zhangfei'), notice: [hp.takeAttrNotice(), hp.takeAttrNotice()] };
  // 老档迁移：打赢过仗的武将补到上限的一半
  localStorage.removeItem('im_heroes_v1'); localStorage.setItem('im_achievements', JSON.stringify({ unlocked: {}, counters: {}, heroes: ['machao'] })); hp.resetHeroCache();
  out.migr = [hp.heroLevel('machao'), hp.heroLevel('zhangfei'), JSON.parse(localStorage.getItem('im_heroes_v1')).migrated];
  out.fc = [hp.claimFirstClear('huangjin-1'), hp.claimFirstClear('huangjin-1'), hp.claimFirstClear('hulao-2'), hp.claimFirstClear('third-1'), hp.claimFirstClear('guandu-3'), hp.claimFirstClear('chibi-3'), hp.claimFirstClear('lubu'), hp.claimFirstClear(null)];
  hp.resetHeroCache(); out.fcKept = [hp.claimFirstClear('huangjin-1'), hp.claimFirstClear('huangjin-2')];
  const s = window.__game.scene.getScene('GameScene'); out.rate = s.heroXpRate(); out.key = s.stableRewardKey();
  // 各章场景的首通 / 赠马关卡键：第 3–5 章由 ThirdGameScene（群雄、赤壁）与 GuanduGameScene 覆盖；攻城、军情、三英战吕布没有键（不发首通经验）
  const hl = await window.__mod('/src/data/heroLevels.ts'), sp = await window.__mod('/src/data/stagePhases.ts');
  const sm = window.__game.scene, keyOf = n => { const sc = sm.getScene(n); if (!sc) return 'missing'; const probe = Object.assign(Object.create(sc), { runConfig: { encounter: 'qunxiong' }, chapter: { id: 'hulao', westStage: 3 } }); const mul = hl.chapterXpMul(sp.CHAPTER_INDEX[sc.hardKey.call(probe)] ?? 1); return [sc.stableRewardKey.call(probe), +(sc.heroXpRate.call(probe) / mul).toFixed(3)]; };
  out.chapterMul = [1, 2, 5, 12].map(hl.chapterXpMul); out.points = [...out.points, ...[10, 25, 26, 38, 42, 54].map(hp.pointsAt)];
  const at = await window.__mod('/src/data/attributes.ts'); out.vigor = [1, 10, 26, 54].map(at.vigorHp); out.caps = [1, 2, 5, 12].map(i => [10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54][i - 1] === hp.LEVEL_CAPS[i - 1]);
  out.keys = Object.fromEntries(['ThirdGameScene', 'GuanduGameScene', 'ChibiGameScene', 'SiegeGameScene', 'IntelGameScene', 'LubuGameScene'].map(n => [n, keyOf(n)]));
  return out;
});
ck('武将经验表（2026-11-19 wave-progression-redesign §3.3：16 / 20 / 28 / 36 / 120 / … / Lv10 550，上限 B）', JSON.stringify(store.table) === '[16,20,28,36,120,550]' && store.slot, store);
ck('只开第一章：上限 10，新武将从 Lv1 起步（含招募的 r_）', JSON.stringify(store.open1) === '[1,10,1,1,1]', store.open1);
ck('结算记经验：Lv1 + 16 → Lv2；软上限（2026-11-20）：越过建议等级 Lv10 后每级 ×1.45，99999 经验也只到 Lv15–25，不再封顶（capped = false）', JSON.stringify(store.lv2) === '[1,2]' && store.capped[0] > 10 && store.capped[0] <= 25 && store.capped[1] === false && store.capped[2] === 10, store);
ck('属性点：Lv25 前每级 1 点、Lv25–38 每 2 级、之后每 3 级 1 点（Lv10 = 9、Lv25 = 24、Lv26 = 24、Lv38 = 30、Lv42 = 31、Lv54 = 35），加点写入存档', store.points[0] === store.capped[0] - 1 && store.points[1] === true && store.points[2] === store.points[0] - 1 && JSON.stringify(store.points.slice(3)) === '[1,9,24,24,30,31,35]', store.points);
ck('2026-11-19 等级重做（上限 B）：10 / 14 / … / 54；宝石经验章节倍率 ×1 / 1.5 / 3 / 6.5；体魄生命 Lv1 0、Lv10 +72、Lv26 +312、Lv54 +480', store.caps.every(Boolean) && JSON.stringify(store.chapterMul) === '[1,1.5,3,6.5]' && JSON.stringify(store.vigor) === '[0,72,312,480]', { caps: store.caps, mul: store.chapterMul, vigor: store.vigor });
ck('开第二章：上限 14，暂存经验补升；新武将从 Lv10（上限 − 4，落后一章）起步', store.open2[0] === 2 && store.open2[1] === 14 && store.open2[2] === 10 && store.open2[3] > 10 && store.open2[4] === 10, store.open2);
ck('单项属性最多 10 点', JSON.stringify(store.maxOne) === '[10,false]', store.maxOne);
ck('属性改版老档：六项点数全部退回（Lv9 → 8 点待分配），提示只给一次', JSON.stringify(store.refund.attrs) === '{"strength":0,"agility":0,"intellect":0,"command":0}' && store.refund.free === 8 && JSON.stringify(store.refund.notice) === '[true,false]', store.refund);
ck('老档迁移：打赢过仗的武将补到当前上限的一半（≥ 起始等级 Lv10），只迁移一次', store.migr[0] === 10 && store.migr[1] === 10 && store.migr[2] === true, store.migr);
ck('主线首次打宝石经验 × 1.4（2026-11-20 XP_SHIFT：过关经验挪进关内）', Math.abs(store.rate - 1.4) < 1e-9, store.rate);
ck('第 3–5 章场景有首通键（third-1 / guandu-1 / chibi-1，× 1.0 × 1.4）；攻城、军情、三英战吕布没有键、× 0.5 × 1.4', JSON.stringify(store.keys) === JSON.stringify({ ThirdGameScene: ['third-1', 1.4], GuanduGameScene: ['guandu-1', 1.4], ChibiGameScene: ['chibi-1', 1.4], SiegeGameScene: [null, .7], IntelGameScene: [null, .7], LubuGameScene: [null, .7] }), store.keys);
ck('首次通关经验（2026-11-20 大半挪进关内，×0.35）：一章 42、二章 88、三章 133、四章 179、五章 224；每关只给一次，存档保留；挑战关不给', JSON.stringify(store.fc) === '[42,0,88,133,179,224,0,0]' && JSON.stringify(store.fcKept) === '[0,42]' && store.key === 'huangjin-1', { fc: store.fc, fcKept: store.fcKept, key: store.key });

ck('控制台无报错', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
