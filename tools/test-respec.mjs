// 重整构筑（用户 2026-11-19：「技能3选一……选了之后就不可以改，只有返回休整才可以花费军粮改回初始」）。电脑布局；需要开发服务器。
// 1 战斗中三选一选了就生效、不能撤回；2 行营「将帅帐」重整：扣随军粮、构筑退回初始（商人买的战法保留）；
// 3 当场重选：选够同样次数后强化次数与重整前一样；4 存档点（packCampaign / restoreCampaign）带上待补选与商人记账，关页面不多不少；5 每章次数上限。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-respec.mjs [截图目录]
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', shots = process.argv[2];
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 600) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
await p.addInitScript(() => {
  window.__find = (root, name) => { const list = root.list ?? []; for (const o of list) { if (o.name === name) return o; if (o.list) { const r = window.__find(o, name); if (r) return r; } } return null; };
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\/?(src\/)?/, '')));
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); }
});
await p.goto(base + '?autostart=1&stage=1&layout=desktop&dev=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.campUI && window.__game.scene.getScene('GameScene').player, null, { timeout: 90000 });
await p.waitForTimeout(1500);

// 战斗中打开构筑总览：没有重整按钮，只写「战斗中不可更改，返回行营休整时可重整」
const battlePanel = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode('none');
  s.setMode('pause'); s.openBuildPanel(); await new Promise(r => setTimeout(r, 300)); // 战斗内构筑面板从暂停页打开
  const all = []; const walk = c => { for (const o of c.list ?? []) { if (o.name) all.push(o); if (o.list) walk(o); } }; walk(s.children);
  const hint = all.find(o => o.name === 'build-panel-respec-hint')?.text, btn = all.some(o => o.name === 'build-panel-respec');
  s.setMode('none'); return { hint, btn };
});
ck('战斗中打开构筑总览：不能重整，只提示「战斗中不可更改，返回行营休整时可重整」', battlePanel.hint?.replace(/\s/g, '') === '战斗中不可更改，返回行营休整时可重整' && !battlePanel.btn, battlePanel);

// 1 战斗中三选一：选了就生效，再点同一张 / 别的卡都不会改（没有撤回）
const lock = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), R = await window.__mod('systems/Respec.ts');
  s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode('none');
  const c0 = R.countRespecPicks(s.player).picks; s.pendingLevels = 1; s.openUpgrade();
  const opt = s.upgradeOptions.find(o => o.kind === 'weapon' || o.kind === 'martial' || o.kind === 'tactic'), k = s.upgradeOptions.indexOf(opt);
  s.chooseUpgrade(k); const c1 = R.countRespecPicks(s.player).picks, after = JSON.stringify(s.player.growth.build.snapshot()) + JSON.stringify(s.player.growth.masteries) + s.player.weapons[0].level;
  for (let i = 0; i < 3; i++) s.chooseUpgrade(i); // 面板已关 / 选项已消费：都应无效
  const still = JSON.stringify(s.player.growth.build.snapshot()) + JSON.stringify(s.player.growth.masteries) + s.player.weapons[0].level;
  return { c0, c1, kind: opt?.kind, unchanged: after === still, mode: s.mode, pending: s.pendingLevels, hasUndo: typeof s.undoUpgrade === 'function' };
});
ck('战斗中三选一：选了立即生效（强化次数 +1），之后再点卡不会改、也没有撤回', lock.c1 === lock.c0 + 1 && lock.unchanged && lock.pending === 0 && !lock.hasUndo, lock);

// 准备一份构筑：本命 Lv3、武艺 1 级、战法若干（其中 1 级是军需商人买的）
const setup = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), R = await window.__mod('systems/Respec.ts'), M = await window.__mod('systems/CampMarket.ts'), g = s.player.growth;
  s.player.weapons[0].level = 3; const mid = Object.keys(g.masteries).find(id => g.canLearn(id)); if (mid) g.learn(mid);
  const ids = Object.keys((await window.__mod('data/builds.ts')).TACTICS).filter(id => g.build.canLearn(id)).slice(0, 3);
  g.build.learn(ids[0]); g.build.learn(ids[0]); g.build.learn(ids[1]);
  const bought = { id: ids[2], kind: 'tactic', level: 0, price: 150, sold: false }; M.campOption(bought, s.player).apply(s.player, s.player.weapons, g); // 商人买 1 级
  return { count: R.countRespecPicks(s.player), boughtId: ids[2], bought: { ...g.build.bought } };
});

// 2 行营重整：扣粮、退回初始，商人买的保留
const rest = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI, R = await window.__mod('systems/Respec.ts'), D = await window.__mod('data/respec.ts'), g = s.player.growth;
  s.over = true; s.legion.food = 2000; ui.open('test-respec-' + Date.now(), '测试'); ui.setVisible(true); ui.chapterNo = 2; ui.tab = 3; ui.notice = ''; ui.render();
  await new Promise(r => setTimeout(r, 200));
  const before = R.countRespecPicks(s.player), cost = D.respecCost(before.picks, 2), food0 = s.legion.food;
  const entry = window.__find(ui.root, 'camp-build-respec-label')?.text; // 入口在构筑总览（将帅帐）里
  window.__find(ui.root, 'camp-build-respec').emit('pointerdown'); await new Promise(r => setTimeout(r, 120));
  const dialog = !!s.children.getByName?.('camp-respec-dialog') || !!window.__find(ui.root, 'camp-respec-dialog'), body = window.__find(ui.root, 'camp-respec-body')?.text;
  return { before, cost, food0, dialog, body, entry };
});
if (shots) await p.screenshot({ path: shots + '/respec-confirm.png' });
const reset = await p.evaluate(async boughtId => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI, R = await window.__mod('systems/Respec.ts'), g = s.player.growth;
  window.__find(ui.root, 'camp-respec-confirm').emit('pointerdown'); await new Promise(r => setTimeout(r, 150));
  return { food: s.legion.food, weapon: s.player.weapons[0].level, masteries: Object.values(g.masteries).reduce((a, v) => a + v, 0), tactics: { ...g.build.tactics }, keptBought: g.build.tactics[boughtId] === 1,
    pending: g.respecPending, count: R.countRespecPicks(s.player).picks, draft: !!window.__find(ui.root, 'camp-respec-draft'), left: window.__find(ui.root, 'camp-respec-left')?.text };
}, setup.boughtId);
ck('构筑总览里有「重整构筑 · N 军粮」入口，点开漆底确认框写清退回什么、保留什么、花多少粮', rest.entry === '重整构筑 · ' + rest.cost + ' 军粮' && rest.dialog && /退回初始/.test(rest.body ?? '') && /保留/.test(rest.body ?? '') && new RegExp('随军粮 ' + rest.cost).test(rest.body ?? ''), rest);
ck('重整：扣随军粮 = 标价；本命回 Lv1、武艺清零、战法只剩商人买的那 1 级', rest.food0 - reset.food === rest.cost && reset.weapon === 1 && reset.masteries === 0 && Object.keys(reset.tactics).length === 1 && reset.keptBought, { cost: rest.cost, ...reset });
ck('退回的次数 = 重整前三选一选来的强化次数（' + rest.before.picks + '），当场弹出重选面板', reset.pending === rest.before.picks && reset.count === 0 && reset.draft, { before: rest.before, reset });
if (shots) await p.screenshot({ path: shots + '/respec-draft.png' });

// 4 存档点：重选到一半时打包 / 读回，待补选与商人记账都在
const save = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI, R = await window.__mod('systems/Respec.ts'), C = await window.__mod('systems/Campaign.ts');
  window.__find(ui.root, 'camp-respec-card-0').emit('pointerdown'); await new Promise(r => setTimeout(r, 120));
  const pack = C.packCampaign(s.player.growth.character, s.player, s.legion, s.followers), json = JSON.parse(JSON.stringify(pack));
  const before = R.countRespecPicks(s.player).picks, pend = s.player.growth.respecPending;
  // 读回到一个新的 RunGrowth（restoreCampaign 会换掉 growth）：强化次数与待补选都不变
  const keepGrowth = s.player.growth, keepWeapons = s.player.weapons; C.restoreCampaign(json, s.player, s.legion);
  const after = R.countRespecPicks(s.player).picks, pend2 = s.player.growth.respecPending, bought = { ...s.player.growth.build.bought };
  s.player.growth = keepGrowth; s.player.weapons = keepWeapons; // 回到原来的继续测
  return { before, pend, after, pend2, bought, savedPending: json.player.growth.respecPending };
});
ck('存档点（打包 / 读回）：已选的强化、待补选次数、商人记账都原样带回（关页面不会多出或少掉）', save.after === save.before && save.pend2 === save.pend && save.savedPending === save.pend && Object.keys(save.bought).length === 1, save);

// 3 选完：强化次数与重整前一样
const redo = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI, R = await window.__mod('systems/Respec.ts'); let clicks = 0;
  while (s.player.growth.respecPending > 0 && clicks < 60) { const c = window.__find(ui.root, 'camp-respec-card-0'); if (!c) break; c.emit('pointerdown'); clicks++; await new Promise(r => setTimeout(r, 40)); }
  return { clicks, pending: s.player.growth.respecPending, count: R.countRespecPicks(s.player).picks, draftOpen: !!window.__find(ui.root, 'camp-respec-draft'), entry: window.__find(ui.root, 'camp-build-respec-label')?.text, tactics: window.__find(ui.root, 'camp-build-tactic-count')?.text };
});
ck('当场重选到底：强化次数回到重整前（' + rest.before.picks + '），面板关闭，构筑总览刷新成新构筑', redo.pending === 0 && redo.count === rest.before.picks && !redo.draftOpen && /^重整构筑 · [0-9]+ 军粮$/.test(redo.entry ?? '') && /^战法/.test(redo.tactics ?? ''), redo);

// 「稍后再选」：留到下一关开打时补成三选一
const later = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI;
  ui.respecDo(); await new Promise(r => setTimeout(r, 100)); const pend = s.player.growth.respecPending;
  window.__find(ui.root, 'camp-respec-later').emit('pointerdown'); await new Promise(r => setTimeout(r, 80));
  // 模拟下一关开打：离开休整，战斗中 update 把待补选转进升级
  ui.setVisible(false); s.over = false; s.setMode('none'); s.pendingLevels = 0; const t0 = performance.now(); while (performance.now() - t0 < 1500 && s.player.growth.respecPending > 0) await new Promise(r => setTimeout(r, 30));
  return { pend, after: s.player.growth.respecPending, pendingLevels: s.pendingLevels + (s.mode === 'levelup' ? 0 : 0), mode: s.mode };
});
ck('「稍后再选」：退回的次数留着，开打后转成升级三选一补选', later.pend > 0 && later.after === 0 && (later.pendingLevels >= 1 || later.mode === 'levelup'), later);

// 5 每章最多 2 次：第三次按钮不可点
const cap = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI, R = await window.__mod('systems/Respec.ts');
  s.setMode('none'); s.over = true; s.pendingLevels = 0; s.player.weapons[0].level = 2; s.legion.food = 5000; ui.setVisible(true); ui.tab = 3; ui.render();
  const left = R.respecLeft(s.player, 2), ok = ui.respecDo(); return { left, ok, used: s.player.growth.respecN };
});
ck('每章最多重整 2 次：第三次不能重整', cap.left === 0 && cap.ok === false && cap.used === 2, cap);
// 6 兵器专职（2026-11-20）：重整构筑退掉分支和「契合」；重选卡里不出专职卡（本命重练到 Lv5 时单独弹专职面板）
const br = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), R = await window.__mod('systems/Respec.ts'), own = s.player.weapons[0];
  own.level = 5; own.branch = 'zy_longdan'; own.attuned = true; own.over = 0;
  const cnt = R.countRespecPicks(s.player), count = cnt.branch, weaponRefund = cnt.weapon; R.resetBuild(s.player, 3);
  const after = { level: own.level, branch: own.branch ?? null, attuned: own.attuned ?? null };
  const opts = R.respecOptions(s.player).map(o => o.id), need = s.needBranch(); own.level = 1;
  return { count, weaponRefund, after, opts, need };
});
ck('重整构筑（有专职）：只退专职（1 次）与加深，本命留在 Lv5 待选专职；分支与「契合」清掉；重选卡不出专职卡，下一场开战时重新弹专职面板', br.count === 1 && br.weaponRefund === 0 && br.after.level === 5 && br.after.branch === null && br.after.attuned === null && !br.opts.some(id => id.startsWith('branch_')) && br.need === true, br);
ck('控制台无报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
