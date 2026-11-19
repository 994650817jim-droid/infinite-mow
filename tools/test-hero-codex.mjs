// 武将谱第一批（2026-11-16，hero-management-proposal.md 方案 B）：武学残卷（存档、老档补发、来源）、本命淬炼、洗点、
// 战法心得（解锁、预选、出卡权重与开局保底）、开局读入、武将谱界面（电脑 1280×720）。
// 需要开发服务器 5173。用法：node tools/test-hero-codex.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/hero-codex';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
await p.addInitScript(() => {
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/' + part.replace(/^\//, ''))); // 2026-11-19：传入的路径已带 /src/，原来拼成 /src/src/
  window.__find = (root, name) => { for (const o of root.list ?? root.getChildren?.() ?? []) { if (o.name === name) return o; if (o.list) { const r = window.__find(o, name); if (r) return r; } } return null; };
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); }
});
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; });
await p.waitForTimeout(400);

// 1) 存档与老档补发、淬炼、洗点、心得
const store = await p.evaluate(async () => {
  const ms = await window.__mod('/src/systems/MasteryStore.ts'), hp = await window.__mod('/src/systems/HeroProgress.ts'), ws = await window.__mod('/src/world/WorldStore.ts'), slots = await window.__mod('/src/systems/SaveSlots.ts'), out = {};
  out.slot = slots.PROGRESS_KEYS.includes('im_mastery_v1');
  localStorage.removeItem('im_mastery_v1'); localStorage.setItem('im_chapter1_cleared', 'true'); ms.resetMasteryCache(); hp.resetHeroCache();
  out.migrated = ms.scrolls(); out.starters = ms.STARTER_TACTICS.length;
  ms.resetMasteryCache(); out.again = ms.scrolls();
  const w = ws.loadWorld(); w.provisions = 1000; localStorage.setItem('im_world_v1', JSON.stringify(w)); ws.saveWorld?.();
  const g0 = ms.grain(); const t1 = ms.temperUp('zhaoyun'); const t2 = ms.temperUp('zhaoyun'); const t3 = ms.temperUp('zhaoyun');
  out.temper = { g0, g1: ms.grain(), lv: ms.temperLevel('zhaoyun'), ok: [t1.ok, t2.ok, t3.ok], bonus: ms.temperBonus('zhaoyun') };
  // 洗点：先加点，再免费洗、第二次收费
  hp.creditHeroXp('zhaoyun', 2000); hp.allocateHeroAttr('zhaoyun', 'strength'); hp.allocateHeroAttr('zhaoyun', 'strength');
  const before = hp.heroAttrs('zhaoyun').strength, free = ms.respecCost('zhaoyun'), r1 = ms.respec('zhaoyun'); hp.allocateHeroAttr('zhaoyun', 'agility');
  const cost = ms.respecCost('zhaoyun'); out.respec = { before, after: hp.heroAttrs('zhaoyun').strength, free, r1: r1.ok, cost, level: hp.heroLevel('zhaoyun') };
  // 心得
  const locked = Object.keys((await window.__mod('/src/data/builds.ts')).TACTICS).find(t => !ms.tacticUnlocked(t));
  const sc0 = ms.scrolls(); const lockedPick = ms.toggleXinde('zhaoyun', locked).ok; const u = ms.unlockTactic(locked).ok;
  out.xinde = { lockedPick, unlock: u, spent: sc0 - ms.scrolls(), a: ms.toggleXinde('zhaoyun', locked).ok, b: ms.toggleXinde('zhaoyun', ms.STARTER_TACTICS[0]).ok, c: ms.toggleXinde('zhaoyun', ms.STARTER_TACTICS[1]).ok, list: ms.getXinde('zhaoyun') };
  return out;
});
ck('残卷存档 im_mastery_v1；老档按已通关章节补发（第一章通关 = 15 张），只补一次；起始每个流派解锁 1 个战法', store.slot && store.migrated === 15 && store.again === 15 && store.starters === 6, store); // 2026-11-19 流派重做：六派
ck('本命淬炼：花军粮 200 → 400，每级本命伤害 +4%；军粮不够时失败', store.temper.lv === 2 && store.temper.g0 - store.temper.g1 === 600 && JSON.stringify(store.temper.ok) === '[true,true,false]' && Math.abs(store.temper.bonus - .08) < 1e-9, store.temper);
ck('洗点：已加的点全部退回、等级不变；本章第一次免费，第二次花 100 × 等级', store.respec.before === 2 && store.respec.after === 0 && store.respec.free === 0 && store.respec.r1 && store.respec.cost === 100 * store.respec.level, store.respec);
ck('战法心得：未解锁的不能选；花 6 残卷解锁后可选；最多 2 个', !store.xinde.lockedPick && store.xinde.unlock && store.xinde.spent === 6 && store.xinde.a && store.xinde.b && !store.xinde.c && store.xinde.list.length === 2, store.xinde);

// 2) 局内：开局读入淬炼与心得；心得卡开局保底、权重 ×2；残卷来源
const run = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), ms = await window.__mod('/src/systems/MasteryStore.ts'), up = await window.__mod('/src/data/upgrades.ts'), g = s.player.growth, out = {};
  s.applyHeroLevel(false); out.start = { temper: g.temperDamage, xinde: [...g.xinde], first: g.xindeFirst };
  const dm0 = (g.temperDamage = 0, g.damageMultiplier(0)); g.temperDamage = ms.temperBonus('zhaoyun'); out.dmRatio = Math.round(g.damageMultiplier(0) / dm0 * 100) / 100;
  const opts = up.buildUpgradeOptions(s.player, s.player.weapons, g); out.firstHasXinde = opts.some(o => o.kind === 'tactic' && g.xinde.includes(o.id.replace('tactic_', ''))); out.firstAfter = g.xindeFirst;
  let hits = 0, base = 0; const N = 400;
  for (let i = 0; i < N; i++) { const o = up.buildUpgradeOptions(s.player, s.player.weapons, g); if (o.some(x => x.id === 'tactic_' + g.xinde[1])) hits++; }
  const saved = [...g.xinde]; g.xinde = [];
  for (let i = 0; i < N; i++) { const o = up.buildUpgradeOptions(s.player, s.player.weapons, g); if (o.some(x => x.id === 'tactic_' + saved[1])) base++; }
  g.xinde = saved; out.weight = { hits, base };
  const d = s.itemDrops; d.scrolls = 0; d.rng = () => .01; d.onKill({ kind: 'boss', x: s.player.x, y: s.player.y }); out.bossScrolls = d.scrolls;
  d.scrolls = 0; d.onKill({ kind: 'elite', x: s.player.x, y: s.player.y }); out.eliteScrolls = d.scrolls; d.rng = Math.random;
  return out;
});
ck('开局读入：本命淬炼加成、心得 2 个、开局保底标记；淬炼 2 级 = 本命伤害 ×1.08', Math.abs(run.start.temper - .08) < 1e-9 && run.start.xinde.length === 2 && run.start.first && run.dmRatio === 1.08, run);
ck('开局第一次升级必出一张心得卡，出过后保底标记清掉', run.firstHasXinde && run.firstAfter === false, run);
ck('心得战法在三选一里出现得更多（权重 ×2）', run.weight.hits > run.weight.base, run.weight);
ck('残卷来源：首领 3 张；精锐有概率 1 张（rng 取小值时必得）', run.bossScrolls >= 3 && run.eliteScrolls === 1, run);

// 3) 界面
const ui = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), C = await window.__mod('/src/ui/HeroCodexUI.ts'), out = {};
  s.togglePause(); await new Promise(r => setTimeout(r, 150)); const ui = C.openHeroCodex(s, 'zhaoyun'); await new Promise(r => setTimeout(r, 150));
  const root = s.children.getByName('hero-codex'), f = n => window.__find(root, n);
  out.res = f('codex-resources')?.text; out.name = f('codex-name')?.text; out.level = f('codex-level')?.text;
  f('codex-tab-attrs').emit('pointerdown'); await new Promise(r => setTimeout(r, 80)); out.free = window.__find(root, 'codex-free')?.text; out.respec = window.__find(root, 'codex-respec')?.text;
  window.__find(root, 'codex-tab-weapon').emit('pointerdown'); await new Promise(r => setTimeout(r, 80)); out.temper = window.__find(root, 'codex-temper')?.text; out.temperBtn = window.__find(root, 'codex-temper-up')?.text;
  window.__find(root, 'codex-tab-xinde').emit('pointerdown'); await new Promise(r => setTimeout(r, 80)); out.xinde = window.__find(root, 'codex-xinde')?.text; out.tactics = root.list.flatMap(o => [o, ...(o.list ?? [])]).filter(o => /^codex-tactic-/.test(o.name ?? '')).length;
  return out;
});
ck('武将谱界面：顶部显示残卷和军粮，总览有名字和等级', /武学残卷 \d+ · 军粮 \d+/.test(ui.res ?? '') && ui.name === '赵云' && /Lv\.\d+/.test(ui.level ?? ''), ui);
ck('属性页有未分配点数和洗点按钮；本命页显示淬炼 2/5 和下一级花费；心得页列出全部战法（≥24）', /未分配属性点/.test(ui.free ?? '') && /洗点/.test(ui.respec ?? '') && /淬炼 2 \/ 5/.test(ui.temper ?? '') && /军粮 700/.test(ui.temperBtn ?? '') && /心得 2 \/ 2/.test(ui.xinde ?? '') && ui.tactics >= 24, ui);
// 2026-11-19 武将谱改版：名字两侧 ‹ › 切换上一位 / 下一位武将（循环），页签保持不变；电脑版只有一个水墨主按钮
const nav = await p.evaluate(async () => {
  const r = window.__game.scene.getScene('GameScene').children.getByName('hero-codex'), f = n => window.__find(r, n), w = () => new Promise(z => setTimeout(z, 80)), o = {};
  f('codex-tab-weapon').emit('pointerdown'); await w(); o.start = f('codex-name')?.text;
  f('codex-next').emit('pointerdown'); await w(); o.next = f('codex-name')?.text; o.tabKept = !!f('codex-temper');
  f('codex-prev').emit('pointerdown'); await w(); f('codex-prev').emit('pointerdown'); await w(); o.wrap = f('codex-name')?.text;
  f('codex-next').emit('pointerdown'); await w();
  const all = []; (function walk(c) { for (const x of c.list ?? []) { all.push(x); walk(x); } })(r);
  o.ink = all.filter(x => x.type === 'NineSlice' && x.visible && x.texture?.key !== 'codex_header').length; /* 节标题牌也是九宫，不算 */ o.portraitTab = (f('codex-tab-overview').emit('pointerdown'), await w(), !!f('codex-portrait'));
  return o;
});
ck('‹ › 切换武将：赵云 → 下一位 → 回到赵云再往前绕到最后一位；页签保持在本命；电脑版至多一个水墨按钮；总览有挂轴立绘', nav.start === '赵云' && nav.next && nav.next !== '赵云' && nav.tabKept && nav.wrap && nav.wrap !== '赵云' && nav.wrap !== nav.next && nav.ink <= 1 && nav.portraitTab, nav);
for (const tab of ['overview', 'attrs', 'weapon', 'xinde', 'schools']) { await p.evaluate(t => { const r = window.__game.scene.getScene('GameScene').children.getByName('hero-codex'); window.__find(r, 'codex-tab-' + t).emit('pointerdown'); }, tab); await p.waitForTimeout(150); await p.screenshot({ path: `${out}/desktop-${tab}.png` }); }

ck('控制台无报错', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
