// 成就（S3 游戏内部分）：战斗结束解锁、计数器、天下 / 城镇状态检查、解锁提示、主页成就面板、不随存档位切换、真实战斗结算触发。
// 需要开发服务器 5173。用法：node tools/test-achievements.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PADJS, padApi } from './pad-harness.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/achievements';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errors.push(e.message));
await p.addInitScript(PADJS);
await p.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_town_intro2', '1'); sessionStorage.setItem('s', '1'); } });
await p.goto(base + '?layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive(), null, { timeout: 30000 }); await p.waitForTimeout(500);
const url = await p.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).find(n => /\/src\/systems\/Achievements\.ts/.test(n)));
const wsUrl = await p.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).find(n => /\/src\/world\/WorldStore\.ts/.test(n)));
const run = (fn, arg) => p.evaluate(async ([u, w, src, a]) => { const ac = await import(u), ws = await import(w); return (0, eval)('(' + src + ')')(ac, ws, a); }, [url, wsUrl, fn.toString(), arg]);

const r1 = await run(ac => {
  const base = { victory: true, debug: false, kills: 300, level: 8, hero: 'zhaoyun', chapter: 'huangjin', stage: 1, bossKilled: true };
  const pre = new Set(Object.keys(ac.unlockedMap())); /* 2026-11-17：读档时的状态检查可能已解锁若干项，按增量算 */
  ac.onBattleEnd({ ...base, debug: true, kills: 5000 }); const dbg = Object.keys(ac.unlockedMap()).filter(k => !pre.has(k)).length;
  ac.onBattleEnd(base); const a = Object.fromEntries(Object.entries(ac.unlockedMap()).filter(([k]) => !pre.has(k)));
  ac.onBattleEnd({ ...base, stage: 3, kills: 1200, level: 21, hero: 'guanyu' });
  ac.onBattleEnd({ ...base, chapter: 'hulao', westStage: 3, arc: 'lubu', hero: 'huangzhong' }); /* 2026-11-17：吕布改为独立战役（arc lubu），第二章终关是董卓 */
  const before4 = ac.isUnlocked('all_heroes');
  ac.onBattleEnd({ ...base, hero: 'zhuge', arc: 'defense' });
  return { dbg, firstOnly: Object.keys(a), u: Object.keys(ac.unlockedMap()), kills: ac.counter('kills'), before4 };
});
ck('测试 / 调试战斗不计成就与击杀', r1.dbg === 0, r1.dbg);
ck('首胜解锁「初战告捷」；1-3 胜利「苍天已死」、单场 1200 杀「千人斩」、21 级「武艺精熟」、2-3「虎牢扬威」、守城「固若金汤」', r1.firstOnly.join() === 'first_win' && ['zhangjiao', 'kills_1000', 'level_20', 'lubu', 'defense'].every(id => r1.u.includes(id)), r1.u);
ck('四位武将各赢一场后才解锁「四将皆用」；累计击杀计数', !r1.before4 && r1.u.includes('all_heroes') && r1.kills === 2100, { before4: r1.before4, kills: r1.kills });
const toast = await p.evaluate(() => window.__game.scene.getScenes(true).at(-1).children.getByName('achievement-toast')?.list.filter(o => o.type === 'Text').map(o => o.text));
await p.screenshot({ path: `${out}/toast.png` });
ck('解锁时右上角弹出提示（成就解锁 · 名称 + 说明）', !!toast && toast.some(t => /^成就解锁 · /.test(t)), toast);

const r2 = await run((ac, ws) => {
  for (let i = 0; i < 10; i++) ac.addCounter('events', 1); for (let i = 0; i < 10; i++) ac.addCounter('potions', 1);
  const w = ws.loadWorld(); w.capturedEver = ['xuchang']; w.ownedCities = ['xuchang', 'luoyang', 'chenliu', 'wancheng', 'runan']; w.warlordStages = 3; w.provisions = 1200; w.town.year = 190; /* 2026-11-17：成就状态改按现行系统（城池建筑 / 军粮 / 科技 / 营寨建筑） */ w.cities = { xuchang: { office: 1, tuntian: 1, muster: 0 } };
  w.town.levels = { hall: 1, barracks: 1, farm: 1, academy: 3, stable: 1, granary: 1, talent: 1 }; w.town.tech = ['potion', 'potion2', 'medicine', 'tuntian', 'levy', 'drill_melee', 'drill_ranged', 'drill_guard', 'elite_cav', 'forge']; w.reserve = { swordsman: 20 };
  ac.checkWorld(w);
  return Object.keys(ac.unlockedMap());
});
ck('计数器：研究 10 项科技「运筹帷幄」、用药 10 次「妙手回春」', ['events_10', 'potions_10'].every(id => r2.includes(id)), r2);
ck('状态检查：首破城池 / 据地五城 / 天子旧都 / 群雄逐鹿 / 因地制宜 / 安营扎寨 / 百业兴旺 / 雕梁画栋 / 富甲一方 / 商路初开 / 春秋几度 / 兵强马壮', ['first_siege', 'cities_5', 'luoyang', 'qunxiong', 'focus', 'town_build', 'town_all', 'town_lv3', 'money_500', 'caravan', 'year_190', 'reserve_20'].every(id => r2.includes(id)), r2.filter(Boolean).length);

// 存档位切换不影响成就
const r3 = await run(async () => { const u = performance.getEntriesByType('resource').map(e => e.name).find(n => /\/src\/systems\/SaveSlots\.ts/.test(n)) ?? '/src/systems/SaveSlots.ts'; const ss = await import(u); return ss.PROGRESS_KEYS.includes('im_achievements'); });
ck('成就是全局的：不属于存档位进度键', r3 === false);

// 主页入口与面板
await p.evaluate(() => window.__game.scene.getScene('MenuScene').scene.restart()); await p.waitForTimeout(800);
const home = await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName('home-achievements-plaque')?.list.filter(o => o.type === 'Text').map(o => o.text).join(' '));
ck('主页右上角「成就 n/24」', /^成就 \d+\/24$/.test(home ?? ''), home);
await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName('home-achievements').emit('pointerdown')); await p.waitForTimeout(300);
const panel = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene').children.getByName('achievements-panel'); return { count: m?.list.find(o => o.name === 'achievements-count')?.text, rows: m?.list.find(o => o.type === 'Container')?.list.filter(o => o.name?.startsWith('ach-')).length }; });
await p.screenshot({ path: `${out}/panel.png` });
ck('成就面板：显示已达成数与全部 24 项（电脑一页）', /^已达成 \d+ \/ 24$/.test(panel.count ?? '') && panel.rows === 24, panel);
const pad = padApi(p); await pad.press('B'); await p.waitForTimeout(200);
ck('手柄 Ⓑ 关闭成就面板', !(await p.evaluate(() => !!window.__game.scene.getScene('MenuScene').children.getByName('achievements-panel'))));

// 真实战斗结算触发（非测试战斗）：首胜已解锁时检查击杀计数增加
const k0 = await run(ac => ac.counter('kills'));
await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); m.children.getByName('start-campaign').emit('pointerdown'); /* 2026-11-17：先开择章页 */ if (window.__game.scene.isActive('MenuScene')) m.pickChapter('huangjin', 1); });
await p.waitForFunction(() => window.__game.scene.getScene('GameScene')?.player && window.__game.scene.isActive('GameScene'), null, { timeout: 30000 });
await p.waitForTimeout(800);
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.kills = 77; s.bossKilled = true; s.finish(true, 'boss'); });
const k1 = await run(ac => ac.counter('kills'));
ck('真实战斗结算触发成就记录（击杀 +77）', k1 - k0 === 77, { k0, k1 });
ck('无 pageerror', errors.length === 0, errors.slice(0, 4));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
