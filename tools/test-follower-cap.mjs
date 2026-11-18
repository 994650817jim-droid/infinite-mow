// 随行等级上限随章节提升 + 主公不能在随行系统里升级（用户 2026-11-17）。电脑布局；需要开发服务器。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-follower-cap.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/recruit';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
// 第一章已通关、虎牢关未通关：已开放 2 章 → 随行上限 10
const world = { version: 7, yellowStages: 3, dongzhuoStages: 0, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: false }, merits: 0, provisions: 100000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin'], ownedCities: [], eraSeen: 1, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 2 };
const rec = (id, kind = 'hero', name = id) => ({ id, kind, hero: kind === 'hero' ? id : undefined, name, template: 'spear', quality: kind === 'hero' ? 'orange' : 'green', rank: 1, picks: [] });
// 老存档：r_1 已 30 级（超上限），关羽随行 25 级；主公赵云 30 级（主公不受随行上限）
const roster = { version: 1, lord: 'zhaoyun', lordFinal: true, owned: [rec('zhaoyun'), rec('guanyu'), rec('r_1', 'common', '武璋')], followers: ['guanyu', 'r_1'], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 1, hall: 3 };
const zero = { strength: 0, agility: 0, intellect: 0, command: 0 };
const heroes = { version: 1, migrated: true, heroes: { zhaoyun: { level: 30, xp: 0, attributes: zero }, guanyu: { level: 25, xp: 0, attributes: zero }, r_1: { level: 30, xp: 0, attributes: zero } } };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
await p.addInitScript(([w, r, h]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_heroes_v1', JSON.stringify(h)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_chapter1_cleared', 'true'); sessionStorage.setItem('seeded', '1'); } }, [world, roster, heroes]);
await p.goto(base + '?layout=desktop');
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 }); await p.waitForTimeout(600);
// 同一模块实例：RosterStore 自己 import 的 HeroProgress（常开 dev server 热更新后测试 import 的可能是另一份）——这里都经 RosterStore / 存档读写
const M = fn => p.evaluate(async src => { const R = await import('/src/systems/RosterStore.ts'), H = await import('/src/systems/HeroProgress.ts'); return (0, eval)(src)(R, H); }, fn.toString());

const a = await M((R, H) => {
  const o = { ch: H.chaptersOpen(), cap: R.followerLevelCap() };
  const s = R.loadRoster(); // 读档：超上限的随行压到上限，主公不压
  o.r1 = H.heroLevel('r_1'); o.gy = H.heroLevel('guanyu'); o.lord = H.heroLevel('zhaoyun');
  o.r1f = R.followerLevel(s.owned.find(x => x.id === 'r_1'), s);
  // 主公不能在随行系统里升级（将阶）；随行可以
  o.lordRank = R.rankUp('zhaoyun', 'weapon'); o.r1Rank = R.rankUp('r_1', 'weapon');
  return o;
});
ck('随行上限 = 5 + 5 ×（已开放章节 − 1）：开放 2 章时为 10', a.ch === 2 && a.cap === 10, a);
ck('读档：超上限的随行压到上限（武璋 30 → 10、关羽 25 → 10），主公不压（赵云仍 30）', a.r1 === 10 && a.gy === 10 && a.lord === 30 && a.r1f === 10, a);
ck('主公不能在随行系统里升将阶（提示「主公等级随征战提升」），随行可以', !a.lordRank.ok && /主公等级随征战提升/.test(a.lordRank.message) && a.r1Rank.ok, a);

// 新招募的随行：定在「上限 − 2」级（无名之辈与可玩名将都一样）
const n = await M((R, H) => {
  const o = {}; R.setRosterRandom(() => .99); R.manualRefresh(); // 全是无名之辈
  const s0 = R.loadRoster(); o.offer = s0.offers[0]?.kind; o.rec = R.recruit(0); const s1 = R.loadRoster(), nr = s1.owned[s1.owned.length - 1];
  o.newId = nr.id; o.newLv = H.heroLevel(nr.id); o.cap = R.followerLevelCap();
  // 可玩名将应募（保底：连刷直到出现可玩名将）
  let k = 0; while (k < 12 && !R.loadRoster().offers.some(x => x.kind === 'hero')) { R.manualRefresh(); k++; }
  const s2 = R.loadRoster(), hi = s2.offers.findIndex(x => x.kind === 'hero'), hero = s2.offers[hi]?.hero; o.hero = hero; o.heroRec = R.recruit(hi); o.heroLv = H.heroLevel(hero);
  R.setRosterRandom(); return o;
});
ck('新招的无名之辈定在「上限 − 2」级（8 级，不再一来就 20 级）', n.rec.ok && n.newLv === n.cap - 2 && n.newLv === 8, n);
ck('新招的可玩名将同样定在「上限 − 2」级', n.heroRec.ok && n.heroLv === n.cap - 2, n);

// 经验：随行升到上限为止（多余经验不会在读档时补升）；开新章后上限提高，可以继续升
const x = await M((R, H) => {
  const o = {}, cap = R.followerLevelCap();
  H.creditHeroXp('r_1', 1e6, cap); H.resetHeroCache(); o.afterXp = H.heroLevel('r_1');
  // 解锁下一章：虎牢关通关 → 已开放 3 章，上限 15
  const raw = JSON.parse(localStorage.getItem('im_world_v1')); raw.cleared.hulao = true; raw.dongzhuoStages = 3; localStorage.setItem('im_world_v1', JSON.stringify(raw));
  o.ch = H.chaptersOpen(); o.cap2 = R.followerLevelCap();
  H.creditHeroXp('r_1', 1e6, o.cap2); H.resetHeroCache(); o.afterXp2 = H.heroLevel('r_1');
  o.lordXp = H.creditHeroXp('zhaoyun', 10).capped !== undefined; return o;
});
ck('随行经验到上限为止：大量经验后武璋停在 10 级，读档也不会被补升', x.afterXp === 10, x);
ck('解锁下一章后上限提高到 15，随行可以继续升到 15', x.ch === 3 && x.cap2 === 15 && x.afterXp2 === 15, x);

// 招贤馆界面：主公那一行显示「主公等级随征战提升」、升阶按钮不可点；随行显示「Lv n / 上限 m（解锁下一章提升）」
await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('TalentHallScene', { tab: 'roster' }); });
await p.waitForFunction(() => window.__game.scene.isActive('TalentHallScene'), null, { timeout: 60000 }); await p.waitForTimeout(700);
const ui = await p.evaluate(() => {
  const s = window.__game.scene.getScene('TalentHallScene'), c = s.children.list.find(x => x.type === 'Container');
  const names = c.list.filter(x => x.name === 'talent-roster-name').map(x => x.text), texts = c.list.filter(x => x.type === 'Text').map(x => x.text);
  const lordW = c.getByName('talent-rank-weapon-zhaoyun'), lordP = c.getByName('talent-rank-passive-zhaoyun'), r1W = c.getByName('talent-rank-weapon-r_1');
  return { names, hint: texts.some(t => t.includes('主公等级随征战提升')), lordBtn: [!!lordW?.input?.enabled, !!lordP?.input?.enabled], r1Btn: !!r1W?.input?.enabled };
});
await p.screenshot({ path: `${out}/follower-cap-desktop.png` });
ck('招贤馆：主公一行显示「主公等级随征战提升」，两个升阶按钮不可点', ui.hint && ui.lordBtn.every(x => !x), ui);
ck('招贤馆：随行显示「Lv n / 上限 15（解锁下一章提升）」，可升阶', ui.names.some(t => /武璋 Lv 15 \/ 上限 15（解锁下一章提升）/.test(t)) && ui.r1Btn, ui);
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 6));
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
