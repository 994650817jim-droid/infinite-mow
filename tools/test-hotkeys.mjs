// 战斗快捷键（电脑布局）：逐个按键检查操作生效、面板选择与关闭、移动键不带人、输入框不误触、手柄合成键不触发新键、改键存档、键位提示与设置页。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-hotkeys.mjs   截图：assets/review/hotkeys/{hud-hints,hotkey-settings,levelup-hints,camp-hints}.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/hotkeys';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const ck = (name, ok, info) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' · ' + JSON.stringify(info)}`); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.removeItem('im_hotkeys_v1'); } });
const p = await ctx.newPage(), errors = [];
p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.hotkeys && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.mouse.click(640, 360); // 让画布拿到焦点
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); if (s.mode !== 'none') s.setMode('none'); }, G);
await p.waitForTimeout(300);
const st = () => p.evaluate(G0 => { const s = eval(G0); return { mode: s.mode, order: s.legion.order, bag: !!s.children.getByName('item-bag'), build: !!s.children.getByName('build-panel'), last: s.hotkeys.last, x: Math.round(s.player.x), y: Math.round(s.player.y) }; }, G);
const key = async (k, ms = 150) => { await p.keyboard.press(k); await p.waitForTimeout(ms); return st(); };

// 0. 键位表本身没有冲突
const H = await p.evaluate(async () => { const m = await import('/src/data/hotkeys.ts'); return { conflicts: m.hotkeyConflicts(), n: m.HOTKEY_ORDER.length }; });
ck('默认键位没有冲突（14 个动作，含 2026-11-18 加的「返回主菜单」M）', H.conflicts.length === 0 && H.n === 14, H);

// 1. 战斗中
await p.evaluate(G0 => { const s = eval(G0); window.__potion = 0; const u = s.usePotion.bind(s); s.usePotion = () => { window.__potion++; u(); }; }, G);
let s0 = await st();
let s1 = await key('KeyE'), s2 = await key('KeyE');
ck('E：护阵 / 出击 切换（原有键不变）', s0.order === 'guard' && s1.order === 'sortie' && s2.order === 'guard', [s0.order, s1.order, s2.order]);
s1 = await key('KeyF'); s2 = await key('KeyF');
ck('F：出击（已在出击时再按不变）', s1.order === 'sortie' && s2.order === 'sortie', [s1.order, s2.order]);
await key('KeyE');
await key('KeyQ'); ck('Q：服药（原有键不变）', await p.evaluate(() => window.__potion) === 1, await p.evaluate(() => window.__potion));
let s3, s4; s1 = await key('Escape'); s2 = await key('Escape'); s3 = await key('KeyP'); s4 = await key('KeyP');
ck('Esc / P：暂停与继续（原有键不变）', s1.mode === 'pause' && s2.mode === 'none' && s3.mode === 'pause' && s4.mode === 'none', [s1.mode, s2.mode, s3.mode, s4.mode]);
s1 = await key('KeyB', 300); s2 = await key('KeyB', 300); s3 = await key('Tab', 300); s4 = await key('Tab', 300);
ck('B / Tab：开关行囊（开时暂停，关时回到战斗）', s1.bag && s1.mode === 'pause' && !s2.bag && s2.mode === 'none' && s3.bag && !s4.bag && s4.mode === 'none', [s1, s2, s3, s4].map(x => [x.bag, x.mode]));
// 面板开着时移动键不带人
s1 = await key('KeyB', 300); await p.keyboard.down('KeyD'); await p.waitForTimeout(500); await p.keyboard.up('KeyD'); s2 = await st(); await key('KeyB', 300);
ck('行囊开着时按住 D，人不动', s1.bag && s2.x === s1.x && s2.y === s1.y, [s1.x, s2.x]);
await p.evaluate(G0 => { eval(G0).player.growth.unallocated = 0; }, G);
s1 = await key('KeyC');
await p.evaluate(G0 => { const s = eval(G0); s.player.growth.unallocated = 2; }, G);
s2 = await key('KeyC', 250); s3 = await key('KeyC', 250);
ck('C：有属性点时开关属性加点；没有点时不响应', s1.mode === 'none' && s2.mode === 'attributes' && s3.mode === 'none', [s1.mode, s2.mode, s3.mode]);
s1 = await key('KeyV', 300); s2 = await key('KeyV', 300); s3 = await key('KeyV', 300); s4 = await key('Escape', 300);
ck('V：开关战法构筑（关掉直接回到战斗；Esc 也能关）', s1.build && s1.mode === 'pause' && !s2.build && s2.mode === 'none' && s3.build && !s4.build && s4.mode === 'none', [s1, s2, s3, s4].map(x => [x.build, x.mode]));

// 2. 输入框里打字不触发
s1 = await st(); await p.evaluate(() => { const i = document.createElement('input'); i.id = 'hk-input'; document.body.appendChild(i); i.focus(); });
await p.keyboard.press('KeyE'); await p.keyboard.press('KeyQ'); await p.keyboard.press('Escape'); await p.waitForTimeout(150); s2 = await st();
await p.evaluate(() => document.getElementById('hk-input')?.remove()); await p.mouse.click(640, 360);
ck('文字输入框有焦点时 E / Q / Esc 都不触发', s2.order === s1.order && s2.mode === 'none' && await p.evaluate(() => window.__potion) === 1, [s1.order, s2.order, s2.mode]);

// 3. 键位提示（HUD）
await p.evaluate(G0 => { const s = eval(G0); s.player.growth.unallocated = 2; s.setMode('none'); }, G); await p.waitForTimeout(400);
const hud = await p.evaluate(G0 => eval(G0).children.list.filter(x => x.name === 'hotkey-hint' && x.visible).map(x => [x.getData('target'), x.text]), G);
await p.screenshot({ path: `${out}/hud-hints.png` });
ck('HUD 圆钮标了键位：行囊 B、设置 Esc、加点 C', ['hud-bag:B', 'hud-pause:Esc', 'attribute-plus:C'].every(k => hud.some(([t, v]) => `${t}:${v}` === k)), hud);
await p.evaluate(G0 => { eval(G0).player.growth.unallocated = 0; }, G);

// 4. 三选一：R 刷新、2 选第二张
await p.evaluate(G0 => { const s = eval(G0); s.legion.food = 9999; s.pendingLevels = 1; s.openUpgrade(); window.__rr = 0; const r = s.rerollUpgrades.bind(s); s.rerollUpgrades = () => { window.__rr++; r(); }; }, G);
await p.waitForTimeout(600);
const lv = await p.evaluate(G0 => { const s = eval(G0); return { mode: s.mode, ids: s.upgradeOptions.map(o => o.id), hints: s.children.list.filter(x => x.name === 'hotkey-hint' && x.visible).map(x => [x.getData('target'), x.text]) }; }, G);
await p.screenshot({ path: `${out}/levelup-hints.png` });
await key('KeyR', 300); const rr = await p.evaluate(() => window.__rr);
const pick = await p.evaluate(G0 => eval(G0).upgradeOptions[1]?.id, G);
s1 = await key('Digit2', 400);
ck('三选一：卡上标 1/2/3、刷新标 R；R 刷新、2 选第二张后回到战斗', lv.mode === 'levelup' && ['1', '2', '3'].every(k => lv.hints.some(([t, v]) => /^upgrade-card-/.test(t) && v === k)) && lv.hints.some(([t, v]) => t === 'upgrade-reroll' && v === 'R') && rr === 1 && s1.mode === 'none' && s1.last.action === 'pick2' && s1.last.handled, { lv, rr, s1, pick });

// 5. 战地招募：1 点第一张卡，Esc 关闭
await p.evaluate(G0 => { const s = eval(G0); s.legion.food = 9999; s.waveIndex = Math.max(1, s.waveIndex); s.recruitedWaves.clear(); s.resting = false; s.openRecruit(); }, G); await p.waitForTimeout(500);
const rc = await p.evaluate(G0 => { const s = eval(G0); return { mode: s.mode, food: s.legion.food, n: s.legion.units.length }; }, G);
s1 = await key('Digit1', 300); const rc2 = await p.evaluate(G0 => { const s = eval(G0); return { food: s.legion.food, n: s.legion.units.length }; }, G);
// 免费招募选完会自己关；再开一次检查 Esc 关闭
if (s1.mode !== 'recruit') { await p.evaluate(G0 => { const s = eval(G0); s.renderRecruit(); s.setMode('recruit'); }, G); await p.waitForTimeout(400); }
const rc3 = (await st()).mode; s2 = await key('Escape', 300);
ck('战地招募：1 选第一张卡（花军粮 / 多了兵或药），Esc 关闭回到战斗', rc.mode === 'recruit' && s1.last.action === 'pick1' && s1.last.handled && (rc2.food < rc.food || rc2.n > rc.n) && rc3 === 'recruit' && s2.mode === 'none' && s2.last.action === 'back' && s2.last.handled, { rc, rc2, s1: s1.last, rc3, s2: s2.last, m2: s2.mode });

// 6. 行营休整：1–4 页签、B 行囊、Enter 率军出征；手柄合成的 Enter 不出征
await p.evaluate(G0 => { const s = eval(G0); window.__depart = 0; s.continueCampaign = () => { window.__depart++; }; s.resting = true; s.renderRecruit(); s.setMode('rest'); }, G);
await p.waitForTimeout(2600); await p.keyboard.press('Shift'); await p.waitForTimeout(1200); // 任意键先跳过入营水墨过场（原有行为）
const tabs = []; for (const k of ['Digit2', 'Digit3', 'Digit1']) { const r = await key(k, 250); tabs.push([r.last.action, r.last.handled]); }
const camp = await p.evaluate(G0 => eval(G0).children.list.filter(x => x.name === 'hotkey-hint' && x.visible).map(x => [x.getData('target'), x.text]), G);
await p.screenshot({ path: `${out}/camp-hints.png` });
s1 = await key('KeyB', 400); s2 = await key('KeyB', 400);
await p.evaluate(async () => { const g = await import('/src/platform/gamepad.ts'); g.synthKey('Enter', 13); }); await p.waitForTimeout(200);
const synth = await p.evaluate(() => window.__depart);
s3 = await key('Enter', 300); const dep = await p.evaluate(() => window.__depart);
ck('行营休整：数字键切页签（标了 1–4），B 开关行囊，Enter 率军出征（标 Enter）', tabs.every(([a, h]) => h) && camp.some(([t, v]) => t === 'camp-depart' && v === 'Enter') && camp.filter(([t]) => /^camp-tab-/.test(t)).length >= 3 && s1.bag && !s2.bag && dep === 1, { tabs, camp, bag: [s1.bag, s2.bag], dep });
ck('手柄 ☰ 合成的 Enter 不会触发「率军出征」（保持手柄原行为）', synth === 0, synth);
await p.evaluate(G0 => { const s = eval(G0); s.resting = false; s.setMode('none'); }, G); await p.waitForTimeout(200);

// 7. 设置「快捷键」页：改键、冲突提示 / 互换、存档、恢复默认
await key('Escape', 300);
await p.evaluate(G0 => { const s = eval(G0), l = s.pausePanel.getByName('settings-hotkeys'); l.emit('pointerdown'); }, G); await p.waitForTimeout(300);
const page = await p.evaluate(G0 => { const s = eval(G0), r = s.children.getByName('hotkey-settings'); return { open: !!r, rows: r ? r.list.filter(x => /^hotkey-row-/.test(x.name)).length : 0 }; }, G);
await p.screenshot({ path: `${out}/hotkey-settings.png` });
const rowClick = a => p.evaluate(([G0, a]) => { eval(G0).children.getByName('hotkey-settings').getByName('hotkey-row-' + a).emit('pointerdown'); }, [G, a]);
await rowClick('potion'); await key('KeyG', 200);
const r1 = await p.evaluate(async () => { const m = await import('/src/data/hotkeys.ts'); return { potion: m.hotkeyCode('potion'), saved: localStorage.getItem('im_hotkeys_v1') }; });
await rowClick('potion'); await key('KeyE', 200);
const r2 = await p.evaluate(async G0 => { const m = await import('/src/data/hotkeys.ts'); return { potion: m.hotkeyCode('potion'), order: m.hotkeyCode('order'), msg: eval(G0).children.getByName('hotkey-settings').getByName('hotkey-message').text }; }, G);
await key('KeyE', 200);
const r3 = await p.evaluate(async () => { const m = await import('/src/data/hotkeys.ts'); return { potion: m.hotkeyCode('potion'), order: m.hotkeyCode('order'), conflicts: m.hotkeyConflicts().length }; });
await rowClick('bag'); await key('KeyW', 200);
const r4 = await p.evaluate(async () => (await import('/src/data/hotkeys.ts')).hotkeyCode('bag'));
await key('Escape', 150); // 取消改键
const modeIn = (await st()).mode;
await key('Escape', 300); // 关掉快捷键页（不关暂停）
const after = await p.evaluate(G0 => ({ open: !!eval(G0).children.getByName('hotkey-settings'), mode: eval(G0).mode }), G);
ck('设置页列出全部 14 个可改的键位（另列移动键固定）', page.open && page.rows === 14, page);
ck('改键：服药改成 G，存进 localStorage', r1.potion === 'KeyG' && /KeyG/.test(r1.saved ?? ''), r1);
ck('改键冲突：按 E 提示已被「护阵 / 出击 切换」占用、不改；再按一次 E 互换（服药 E、切换 G），无冲突', r2.potion === 'KeyG' && /已是/.test(r2.msg) && r3.potion === 'KeyE' && r3.order === 'KeyG' && r3.conflicts === 0, { r2, r3 });
ck('移动键不能占用；Esc 先取消改键，再按 Esc 关掉快捷键页、仍停在暂停', r4 === 'KeyB' && modeIn === 'pause' && !after.open && after.mode === 'pause', { r4, modeIn, after });
// 改过的键在战斗里生效
await key('Escape', 300); await p.evaluate(() => { window.__potion = 0; });
s0 = await st(); s1 = await key('KeyG'); const pot = await p.evaluate(() => window.__potion); s2 = await key('KeyE');
ck('改键后战斗里生效：G 切换护阵 / 出击，E 服药', s1.order !== s0.order && pot === 0 && await p.evaluate(() => window.__potion) === 1, { o: [s0.order, s1.order], pot });
// 刷新后仍是改过的键；恢复默认
await p.reload(); await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.hotkeys, null, { timeout: 120000 }); await p.waitForTimeout(1200);
const kept = await p.evaluate(async () => (await import('/src/data/hotkeys.ts')).hotkeyCode('potion'));
await p.evaluate(G0 => { const s = eval(G0); s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'pause') s.setMode('pause'); s.pausePanel.getByName('settings-hotkeys').emit('pointerdown'); }, G); await p.waitForTimeout(300);
await p.evaluate(G0 => eval(G0).children.getByName('hotkey-settings').getByName('hotkey-reset').emit('pointerdown'), G);
const reset = await p.evaluate(async () => { const m = await import('/src/data/hotkeys.ts'); return { potion: m.hotkeyCode('potion'), order: m.hotkeyCode('order'), saved: localStorage.getItem('im_hotkeys_v1') }; });
ck('刷新页面后改过的键还在；「恢复默认」回到 Q / E 并清掉存档', kept === 'KeyE' && reset.potion === 'KeyQ' && reset.order === 'KeyE' && !reset.saved, { kept, reset });
await p.evaluate(G0 => eval(G0).children.getByName('hotkey-settings')?.destroy(), G);

// 8. 主页设置也有「快捷键」入口（同一个页面）
await p.goto(base + '?dev=1&layout=desktop'); // 不带 autostart，停在主页
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 }); await p.waitForTimeout(2500);
const home = await p.evaluate(async () => { const s = window.__game.scene.getScene('MenuScene'); const find = (list, n) => { for (const o of list) { if (o.name === n) return o; if (o.list) { const r = find(o.list, n); if (r) return r; } } return null; }; find(s.children.list, 'home-settings')?.emit('pointerdown'); await new Promise(r => setTimeout(r, 300)); const l = find(s.children.list, 'settings-hotkeys'); l?.emit('pointerdown'); await new Promise(r => setTimeout(r, 300)); return { link: !!l, page: !!s.children.getByName('hotkey-settings') }; });
ck('主页「军中设置」里也有「快捷键 ›」，打开同一个快捷键页', home.link && home.page, home);

const errs = errors.filter(e => !/Texture key already in use: bag_/.test(e));
ck('无页面 / 控制台报错', errs.length === 0, errs.slice(0, 5));
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
