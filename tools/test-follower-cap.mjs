// 随行等级上限随章节提升 + 主公不能在随行系统里升级（用户 2026-11-17）。电脑布局；需要开发服务器。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-follower-cap.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/recruit';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
// 第一章已通关、虎牢关未通关：已开放 2 章 → 随行上限 10
// 随行上限 / 招贤馆等级读营寨（fa1c773）：营寨 town 只从 version ≥ 8 的存档读入，主营 1 级时其他建筑被压回 1 级 → 种 version 8 + 主营 3、招贤馆 3
const world = { version: 8, town: { levels: { hall: 3, barracks: 1, farm: 1, talent: 3 } }, yellowStages: 3, dongzhuoStages: 0, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: false }, merits: 0, provisions: 100000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin'], ownedCities: [], eraSeen: 1, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 2 };
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
// 模块实例：常开的 dev server 热更新过后，测试 import 的 HeroProgress 和 RosterStore / 游戏用的不是同一份，各自有读档缓存（主工作区 5173 上曾因此读到旧缓存 → startLevel 10）。
// 所以 H 固定 import 一份独立的（?inst=cap，新开服务器也一样，结果稳定），每次读等级前 H.lv() 先清缓存再读存档；看界面前重载页面。
const M = fn => p.evaluate(async src => { const R = await import('/src/systems/RosterStore.ts'), H0 = await import('/src/systems/HeroProgress.ts?inst=cap'); const H = { ...H0, lv: id => { H0.resetHeroCache(); return H0.heroLevel(id); } }; H0.resetHeroCache(); return (0, eval)(src)(R, H); }, fn.toString());

const a = await M((R, H) => {
  const o = { ch: H.chaptersOpen(), cap: R.followerLevelCap() };
  const s = R.loadRoster(); // 读档：超上限的随行压到上限，主公不压
  o.r1 = H.lv('r_1'); o.gy = H.lv('guanyu'); o.lord = H.lv('zhaoyun');
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
  o.newId = nr.id; o.newLv = H.lv(nr.id); o.newName = nr.name; o.cap = R.followerLevelCap();
  // 可玩名将应募（保底：连刷直到出现可玩名将）
  let k = 0; while (k < 12 && !R.loadRoster().offers.some(x => x.kind === 'hero')) { R.manualRefresh(); k++; }
  const s2 = R.loadRoster(), hi = s2.offers.findIndex(x => x.kind === 'hero'), hero = s2.offers[hi]?.hero; o.hero = hero; o.heroRec = R.recruit(hi); o.heroLv = H.lv(hero);
  R.setRosterRandom(); return o;
});
ck('新招的无名之辈定在「上限 − 2」级（8 级，不再一来就 20 级）', n.rec.ok && n.newLv === n.cap - 2 && n.newLv === 8, n);
ck('新招的可玩名将同样定在「上限 − 2」级', n.heroRec.ok && n.heroLv === n.cap - 2, n);

// 经验：随行升到上限为止（多余经验不会在读档时补升）；开新章后上限提高，可以继续升
const x = await M((R, H) => {
  const o = {}, cap = R.followerLevelCap();
  H.resetHeroCache(); H.creditHeroXp('r_1', 1e6, cap); o.afterXp = H.lv('r_1');
  // 解锁下一章：虎牢关通关 → 已开放 3 章，上限 15
  const raw = JSON.parse(localStorage.getItem('im_world_v1')); raw.cleared.hulao = true; raw.dongzhuoStages = 3; localStorage.setItem('im_world_v1', JSON.stringify(raw));
  o.ch = H.chaptersOpen(); o.cap2 = R.followerLevelCap();
  H.resetHeroCache(); H.creditHeroXp('r_1', 1e6, o.cap2); o.afterXp2 = H.lv('r_1');
  o.lordXp = H.creditHeroXp('zhaoyun', 10).capped !== undefined; return o;
});
ck('随行经验到上限为止：大量经验后武璋停在 10 级，读档也不会被补升', x.afterXp === 10, x);
ck('解锁下一章后上限提高到 15，随行可以继续升到 15', x.ch === 3 && x.cap2 === 15 && x.afterXp2 === 15, x);

// 招贤馆界面：主公那一行显示「主公等级随征战提升」；随行显示「Lv n / 上限 m（解锁下一章提升）」；升阶按钮已挪到讲武堂「随从操练」
// 重载：游戏那份模块的读档缓存是测试改存档之前的（存档在 localStorage 里，seeded 标记让初始化脚本不再覆盖）
await p.reload(); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 }); await p.waitForTimeout(600);
await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('TalentHallScene', { tab: 'roster' }); });
await p.waitForFunction(() => window.__game.scene.isActive('TalentHallScene'), null, { timeout: 60000 }); await p.waitForTimeout(700);
const ui = await p.evaluate(() => {
  const s = window.__game.scene.getScene('TalentHallScene'), c = s.children.list.find(x => x.type === 'Container');
  const names = c.list.filter(x => x.name === 'talent-roster-name').map(x => x.text), texts = c.list.filter(x => x.type === 'Text').map(x => x.text);
  return { names, hint: texts.some(t => t.includes('主公等级随征战提升')), rankBtns: c.list.filter(x => /^talent-rank-/.test(x.name)).length, toDrill: texts.some(t => t.includes('讲武堂「随从操练」')) };
});
await p.screenshot({ path: `${out}/follower-cap-desktop.png` });
ck('招贤馆：主公一行显示「主公等级随征战提升」；升阶按钮已移走，提示去讲武堂「随从操练」', ui.hint && ui.rankBtns === 0 && ui.toDrill, ui);
ck('招贤馆：随行显示「Lv n / 上限 15（解锁下一章提升）」；新招的随行仍是 8 级（上限升了也不自动补升）', ui.names.some(t => /武璋 Lv 15 \/ 上限 15（解锁下一章提升）/.test(t)) && ui.names.some(t => t.startsWith(n.newName + ' Lv 8 / 上限 15')), ui);

// 讲武堂「随从操练」：主公的两个按钮不可点；随行按钮上写花费，可升阶；升阶后将阶 +1、军粮扣对
await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('CityScene'); });
await p.waitForFunction(() => window.__game.scene.isActive('CityScene'), null, { timeout: 60000 }); await p.waitForTimeout(1200);
const findRow = async id => p.evaluate(async id => { const s = window.__game.scene.getScene('CityScene'); s.techTab = 'drill'; for (let pg = 0; pg < 6; pg++) { s.drillPage = pg; s.openTech(); const m = s.children.getByName('town-tech'); if (m?.getByName('drill-weapon-' + id)) return pg; } return -1; }, id);
const dr = {}; dr.lordPage = await findRow('zhaoyun');
Object.assign(dr, await p.evaluate(() => { const m = window.__game.scene.getScene('CityScene').children.getByName('town-tech'), w = m.getByName('drill-weapon-zhaoyun'), pv = m.getByName('drill-passive-zhaoyun'); return { lordBtn: [!!w?.input?.enabled, !!pv?.input?.enabled], lordHint: !!m.getByName('drill-lord-zhaoyun')?.text.includes('主公等级随征战提升') }; }));
dr.r1Page = await findRow('r_1');
Object.assign(dr, await p.evaluate(async () => {
  const s = window.__game.scene.getScene('CityScene'), m = s.children.getByName('town-tech'), w = m.getByName('drill-weapon-r_1'), cap = m.list.find(x => x.type === 'Text' && x.x === w.x && x.y === w.y);
  const W = await import('/src/world/WorldStore.ts'), o = { r1Btn: !!w?.input?.enabled, label: m.list.filter(x => x.type === 'Text' && Math.abs(x.y - w.y) < 2 && Math.abs(x.x - w.x) < 2).map(x => x.text), name: m.getByName('drill-name-r_1')?.text, preview: m.getByName('drill-preview-weapon-r_1')?.text, p0: W.loadWorld().provisions };
  w.emit('pointerdown'); await new Promise(r => setTimeout(r, 200)); o.p1 = W.loadWorld().provisions;
  const m2 = s.children.getByName('town-tech'); o.name2 = m2.getByName('drill-name-r_1')?.text; o.msg = m2.getByName('town-tech-message')?.text; return o;
}));
await p.screenshot({ path: `${out}/drill-hall-desktop.png` });
ck('讲武堂「随从操练」：主公两个升阶按钮不可点，写着「主公等级随征战提升」', dr.lordPage >= 0 && dr.lordBtn.every(x => !x) && dr.lordHint, dr);
ck('讲武堂「随从操练」：随行按钮上写花费「升·兵器 300粮」，旁边写升级前后（伤害 +6% → +12%），可升阶', dr.r1Btn && dr.label.some(t => t === '升·兵器 300粮') && /伤害 ?\+6%.*→.*伤害 ?\+12%/.test(dr.preview ?? '') && /武璋 Lv 15 \/ 上限 15/.test(dr.name ?? ''), dr);
ck('讲武堂「随从操练」：点升·兵器扣 300 军粮，将阶 2 → 3', dr.p0 - dr.p1 === 300 && /将阶 3\//.test(dr.name2 ?? '') && /升到将阶 3/.test(dr.msg ?? ''), dr);
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 6));
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
