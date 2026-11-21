// 全界面体检第一批修后截图 + 检查（2026-11-21）：大框去掉（图鉴 / 设置 / 暂停 / 属性 / 专职 / 构筑 / 武将谱 / 马厩）、
// 每屏最多一个水墨按钮（图鉴、存档、军营卡）、武将谱名册不出面板、行囊键位标在包袱上。
// 用法：BASE=http://127.0.0.1:5180/ node tools/shot-ui-audit-fix1.mjs → assets/review/ui-audit/fix1/*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/ui-audit/fix1'; mkdirSync(OUT, { recursive: true });
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' · ' + JSON.stringify(d).slice(0, 400))); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const errs = []; let p;
const fresh = async (q, scene) => { if (p) await p.close(); p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.clear(); for (const k of ['im_opening_seen', 'im_tutorial_done', 'im_city_intro_v3', 'im_mount_guide_v1', 'im_home_seen']) localStorage.setItem(k, '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('s', '1'); } });
  await p.goto(BASE + q, { timeout: 180000 }); await p.waitForFunction(k => window.__game?.scene.isActive(k), scene, { timeout: 180000 }); await p.waitForTimeout(1500); };
const shot = async n => { await p.evaluate(() => document.querySelectorAll('[id^="dev-"]').forEach(e => { e.style.display = 'none'; })); await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/${n}.png` }); };
// 一屏里可见的水墨按钮数（inkSkin / homeCommand 主钮都用 ink_brush* 贴图）
const inkCount = key => p.evaluate(k => { const s = window.__game.scene.getScene(k); let n = 0; const walk = l => { for (const o of l) { if (!o.visible) continue; if (o.list) walk(o.list); else if (o.type === 'Image' && /ink|brush/.test(o.texture?.key ?? '') && o.displayWidth > 80) n++; } }; walk(s.children.list); return n; }, key);
const G = "window.__game.scene.getScene('GameScene')";
const ev = (fn, a) => p.evaluate(([S0, f, x]) => eval('(' + f + ')')(eval(S0), x), [G, String(fn), a]);

// 主页：图鉴 / 设置 / 存档
await fresh('?layout=desktop', 'MenuScene');
await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName('home-codex').emit('pointerdown')); await p.waitForTimeout(1500); await shot('home-codex');
const codex = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'), c = m.children.getByName('game-codex'); const items = []; const walk = l => { for (const o of l) { if (o.list) walk(o.list); else if (/^codex-item-/.test(o.name ?? '')) items.push(Math.round(o.getBounds().bottom)); } }; walk(c.list); const close = c.list.find(o => o.name === 'codex-close'); return { maxBottom: Math.max(...items), closeTop: Math.round(close.getBounds().top - 4) }; });
ck('图鉴：武将格不压「返回」、不出屏；无水墨按钮', codex.maxBottom < codex.closeTop && (await inkCount('MenuScene')) <= 1, codex);
await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName('game-codex').destroy());
await p.evaluate(() => window.__game.scene.getScene('MenuScene').openHomeSettings()); await p.waitForTimeout(700); await shot('home-settings');
await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName('home-settings-panel').destroy());
await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); m.children.list.find(o => o.type === 'Text' && o.text === '存档')?.emit('pointerdown'); }); await p.waitForTimeout(900); await shot('home-saves');
ck('存档：最多一个水墨按钮', (await inkCount('MenuScene')) <= 1, await inkCount('MenuScene'));
// 战斗：暂停 / 构筑 / 属性 / 专职 / 行囊键位
await fresh('?dev=1&autostart=1&stage=1&layout=desktop&story=off', 'GameScene');
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && s.elapsed > 2.5; }, null, { timeout: 120000 });
await ev(s => { s.player.damageImmune = true; for (let i = 0; i < 4 && s.mode !== 'none'; i++) s.__DEV_ACTIONS.closePopup?.(); });
await p.waitForTimeout(1500); await shot('battle-hud');
const hint = await ev(s => { const t = s.children.list.find(o => o.name === 'hotkey-hint' && o.visible && o.getData('target') === 'bag-bundle-icon'), i = s.children.getByName('bag-bundle-icon'); if (!t || !i) return null; const a = t.getBounds(), c = i.getBounds(); return { dx: Math.round(a.centerX - c.centerX), dy: Math.round(a.centerY - c.centerY) }; });
ck('行囊键位「B」贴在包袱图上', !!hint && Math.abs(hint.dx) < 40 && Math.abs(hint.dy) < 40, hint);
await ev(s => s.togglePause()); await p.waitForTimeout(600); await shot('battle-pause');
await ev(s => s.pausePanel.list.find(o => o.name === 'pause-build')?.emit('pointerdown') ?? s.children.getByName('pause-build')?.emit('pointerdown')); await p.waitForTimeout(800); await shot('battle-build');
await ev(s => { s.children.getByName('build-panel')?.destroy(); if (s.mode === 'pause') s.togglePause(); s.player.growth.unallocated = 3; s.attributeReturn = 'none'; s.renderAttributePanel(); s.setMode('attributes'); }); await p.waitForTimeout(600); await shot('battle-attributes');
await ev(s => s.setMode('none')); await ev(s => s.__DEV_ACTIONS.weaponNative5()); await p.waitForTimeout(800);
await ev(s => { if (s.mode !== 'branch' && s.needBranch?.()) s.openBranch(); }); await p.waitForTimeout(800); await shot('battle-branch');
// 营寨：军营卡 / 武将谱 / 马厩
await fresh('?layout=desktop', 'MenuScene');
await p.evaluate(() => { localStorage.setItem('im_world_v1', JSON.stringify({ version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 1, worldAvailable: true, cleared: { huangjin: true, hulao: true }, provisions: 1860, buildings: { hall: 2, barracks: 2, farm: 2, academy: 1, talent: 1, stable: 1 }, cities: {}, ownedCities: ['xuchang'], capturedEver: ['xuchang'], chapterSeen: 99, tutorialSeen: true })); localStorage.setItem('im_chapter1_cleared', 'true'); localStorage.setItem('im_roster_v1', JSON.stringify({ version: 1, lord: 'zhaoyun', lordFinal: true, owned: ['guanyu'], followers: [] })); const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('CityScene'); });
await p.waitForFunction(() => window.__game.scene.isActive('CityScene'), null, { timeout: 60000 }); await p.waitForTimeout(2500);
const C = () => p.evaluate(() => { const s = window.__game.scene.getScene('CityScene'); for (const o of [...s.children.list]) if (o.type === 'Container' && (o.depth ?? 0) >= 50) o.destroy(); });
await C(); await p.evaluate(() => window.__game.scene.getScene('CityScene').openCard('barracks')); await p.waitForTimeout(800); await shot('city-barracks');
ck('军营卡：最多一个水墨按钮', (await inkCount('CityScene')) <= 2 /* 底栏「天下地图 · 出征」被遮在后面 */, await inkCount('CityScene'));
await C(); await p.evaluate(() => window.__game.scene.getScene('CityScene').openCodex()); await p.waitForTimeout(1500); await shot('city-hero-list');
const list = await p.evaluate(() => { const s = window.__game.scene.getScene('CityScene'); const out = []; const walk = l => { for (const o of l) { if (o.list) walk(o.list); else if (/^codex-(hero|locked)-/.test(o.name ?? '') && o.visible) out.push(Math.round(o.getBounds().bottom)); } }; walk(s.children.list); return { n: out.length, max: Math.max(...out) }; });
ck('武将谱：名册（含未归附）都在面板内', list.n > 10 && list.max <= 512, list);
await C(); await p.evaluate(() => { const s = window.__game.scene.getScene('CityScene'); s.openStable(s.add.text(0, 0, '')); }); await p.waitForTimeout(1200); await shot('city-stable');
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
await b.close(); process.exit(fail ? 1 : 0);
