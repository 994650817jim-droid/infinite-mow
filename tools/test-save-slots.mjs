// 多存档位：旧存档迁入存档一、新建 / 读取 / 删除、设置不随存档切换、手柄操作、Deck 截图。
// 需要开发服务器 5173。用法：node tools/test-save-slots.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PADJS, padApi } from './pad-harness.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/save-slots';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const world = { version: 7, yellowStages: 3, dongzhuoStages: 2, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: false }, merits: 120, provisions: 80, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], ownedCities: ['xuchang'] };
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
await p.addInitScript(PADJS);
await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_bgm_vol', '70'); sessionStorage.setItem('seeded', '1'); } }, world);
const home = async () => { await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive() && window.__game.scene.getScene('MenuScene').children.getByName('home-saves'), null, { timeout: 30000 }); await p.waitForTimeout(800); };
const M = "window.__game.scene.getScene('MenuScene')";
const open = () => p.evaluate(M0 => { const m = eval(M0); m.children.getByName('home-saves').emit('pointerdown'); return !!m.children.getByName('save-slots-panel'); }, M);
const click = name => p.evaluate(([M0, n]) => { const panel = eval(M0).children.getByName('save-slots-panel'); const o = panel.getByName(n); if (!o) return false; o.emit('pointerdown'); return true; }, [M, name]);
const texts = () => p.evaluate(M0 => eval(M0).children.getByName('save-slots-panel')?.list.filter(o => o.type === 'Text').map(o => o.text).join(' | '), M);
const store = () => p.evaluate(() => ({ active: JSON.parse(localStorage.getItem('im_save_slots') ?? '{}').active ?? 0, hero: localStorage.getItem('im_last_hero'), world: !!localStorage.getItem('im_world_v1'), slot0: !!localStorage.getItem('im_slot_0'), slot1: !!localStorage.getItem('im_slot_1'), bgm: localStorage.getItem('im_bgm_vol') }));
const reloaded = async () => { await p.waitForNavigation({ timeout: 15000 }).catch(() => {}); await home(); };

await p.goto(base + '?layout=desktop'); await home();
ck('主页底部有「存档」，网页版没有「退出」', await p.evaluate(M0 => { const m = eval(M0); return !!m.children.getByName('home-saves') && !m.children.getByName('home-quit'); }, M));
ck('打开存档面板', await open());
const t0 = await texts();
ck('旧存档自动成为存档一（当前）：显示武将、章节进度、城池钱币', /存档一/.test(t0) && /当前/.test(t0) && /赵云 · 第二章 · 讨伐董卓 2\/3/.test(t0) && /城池 1 · 钱币 \d+/.test(t0) /* 2026-11-17 军功并入军粮 */ && (t0.match(/空存档位/g) ?? []).length === 2, t0);
await p.screenshot({ path: `${out}/deck-slots.png` });
// 新建：切到存档二（空）
await click('save-slot-1-load'); await reloaded();
const s1 = await store();
ck('存档二「新建征途」→ 重新载入为空进度，存档一的进度保存在 im_slot_0，音量设置不变', s1.active === 1 && !s1.world && !s1.hero && s1.slot0 && s1.bgm === '70', s1);
// 2026-11-17：电脑版天下 / 营寨入口在「择章」页右上（主页右上只留成就）
// 2026-11-17：「匡扶汉室」天下已开时进天下地图（营寨从地图「返回营寨」进），新征途时直接出征 1-1
const cityEntry = () => p.evaluate(async () => (await import('/src/world/WorldStore.ts')).worldUnlocked());
const fresh = !(await cityEntry()) && await p.evaluate(M0 => !eval(M0).children.getByName('home-world'), M);
ck('新存档天下未开：「匡扶汉室」直接出征，没有天下地图 / 营寨入口（新征途）', fresh);
// 在存档二玩出一点进度
await p.evaluate(() => { localStorage.setItem('im_last_hero', 'guanyu'); localStorage.setItem('im_world_v1', JSON.stringify({ version: 7, yellowStages: 1, dongzhuoStages: 0, warlordStages: 0, guanduStages: 0, worldAvailable: false, cleared: {}, merits: 5, provisions: 0, buildings: {}, reserve: {}, receipts: [] })); localStorage.setItem('im_slot_touched', String(Date.now())); });
await open();
const t1 = await texts();
ck('面板：存档一可读取，存档二为当前（关羽 · 第一章 1/3）', /赵云 · 第二章 · 讨伐董卓 2\/3/.test(t1) && /关羽 · 第一章 · 黄巾之乱 1\/3/.test(t1) && /保存于 \d{4}-\d\d-\d\d/.test(t1), t1);
await click('save-slot-0-load'); await reloaded();
const s2 = await store();
ck('读取存档一：进度换回赵云 / 天下，存档二存入 im_slot_1', s2.active === 0 && s2.hero === 'zhaoyun' && s2.world && s2.slot1 && !s2.slot0, s2);
ck('读取后天下已开：「匡扶汉室」进天下地图（地图有「返回营寨」）', await cityEntry());
// 删除存档二（非当前）：需确认两次
await open();
await click('save-slot-1-delete');
const half = await store();
await click('save-slot-1-delete');
const s3 = await store(), t3 = await texts();
ck('删除非当前存档：第一次只提示确认，第二次删除', half.slot1 && !s3.slot1 && (t3.match(/空存档位/g) ?? []).length === 2, { half, s3 });
// 手柄：Ⓑ 关闭面板；方向键到「存档」Ⓐ 打开
const pad = padApi(p);
await pad.press('B'); await p.waitForTimeout(200);
ck('手柄 Ⓑ 关闭存档面板', !(await p.evaluate(M0 => !!eval(M0).children.getByName('save-slots-panel'), M)));
// 2026-11-17：主页会先弹「主公」确认（lord-keep / lord-repick）抓住手柄焦点；Ⓐ 确认沿用后再去「存档」
for (let i = 0; i < 3; i++) { await pad.press('DOWN', 60); const lf = await pad.focus(); if (lf?.name === 'lord-keep') { await pad.press('A'); await p.waitForTimeout(400); break; } }
const f = await pad.focusTo(x => x.name === 'home-saves');
await pad.press('A'); await p.waitForTimeout(300);
const pf = await pad.focus();
ck('手柄移到「存档」Ⓐ 打开，默认焦点「返回」', !!f && pf?.name === 'save-slots-close', { f, pf });
await pad.press('UP'); const up = await pad.focus();
ck('手柄可移到存档位按钮', /^save-slot-\d-/.test(up?.name ?? ''), up);
// 布局：可点区域不重叠
const c = await pad.cands();
const overlaps = []; for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) { const a = c[i], d = c[j], ox = Math.min(a.x + a.w, d.x + d.w) - Math.max(a.x, d.x), oy = Math.min(a.y + a.h, d.y + d.h) - Math.max(a.y, d.y); if (ox > 2 && oy > 2) overlaps.push(a.name + '×' + d.name); }
ck('Deck 存档面板可点区域不重叠、不出界', !overlaps.length && c.every(r => r.x >= 0 && r.y >= 0 && r.x + r.w <= 960 && r.y + r.h <= 540), overlaps);
await pad.press('B');
// 删除当前存档：清空进度
await open(); await click('save-slot-0-delete'); await click('save-slot-0-delete'); await reloaded();
const s4 = await store();
ck('删除当前存档：进度清空、仍在存档一、音量设置保留', s4.active === 0 && !s4.world && !s4.hero && s4.bgm === '70', s4);
// 手机布局截图
const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
m.on('pageerror', e => errors.push('mobile ' + e.message));
await m.goto(base + '?layout=mobile');
await m.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.children.getByName('home-saves'), null, { timeout: 30000 }); await m.waitForTimeout(800);
await m.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName('home-saves').emit('pointerdown'));
await m.waitForTimeout(300); await m.screenshot({ path: `${out}/mobile-slots.png` });
await m.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName('save-slots-panel').destroy());
await m.screenshot({ path: `${out}/mobile-home.png` });
ck('无 pageerror / 控制台错误', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
