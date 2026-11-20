// 界面文字体检（2026-11-19 用户「关于文本可以优化修改」）：逐个打开主要界面，遍历所有显示中的文字，检查
//  - undefined / NaN / null / [object / TODO / FIXME 等漏网文字；
//  - 混进来的英文单词（白名单：Lv / HP / DEV / FPS / 快捷键名 / 手柄键名等）；
//  - 中文旁边的半角标点（, : ; ! ? ( )），引号用「」而不是 "" ；
//  - 出屏（文字框超出 960×540）。
// 截图（TAG=before|after）：主页、军中设置、天下地图 + 城池小卡、战斗暂停、战法构筑、结算、行营休整。
// 用法：BASE=http://127.0.0.1:5180/ TAG=after node tools/test-ui-text.mjs   → assets/review/ui-text/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'after', out = 'assets/review/ui-text';
mkdirSync(out, { recursive: true });
let fail = 0; const errors = [], issues = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || d === undefined ? '' : ' · ' + JSON.stringify(d).slice(0, 1600))); };
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 1, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 600, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: ['xuchang'], eraSeen: 2, capturedEver: ['xuchang'], chapterSeen: 3, tutorialDone: true };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
await p.addInitScript(w => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_chapter1_cleared', 'true'); sessionStorage.setItem('seeded', '1'); } }, world);

// 白名单：允许出现的拉丁字母串
const ALLOW = /^(MB|Lv|HP|MP|DEV|FPS|Esc|Tab|Shift|Space|Ctrl|Alt|Enter|WASD|LB|RB|LT|RT|[A-Z]|F\d+|x|vs|BGM|Q|E|C|G|M|B|R|V|X|Y|A|ms|px|PC|UI|ok)$/;
const scan = name => p.evaluate(([name, allowSrc]) => {
  const allow = new RegExp(allowSrc), found = [], g = window.__game;
  const walk = (list, sc) => { for (const o of list) { if (!o || o.visible === false || o.alpha === 0) continue;
    if (o.type === 'Text' && typeof o.text === 'string' && o.text.trim()) {
      const t = o.text, bad = [];
      if (/undefined|NaN|\bnull\b|\[object|TODO|FIXME|lorem|\$\{/i.test(t)) bad.push('漏网');
      for (const w of t.match(/[A-Za-z]{2,}/g) ?? []) if (!allow.test(w)) bad.push('英文:' + w);
      if (/[一-鿿][,;!?]|[,;!?][一-鿿]|[一-鿿]:(?!\d)|[一-鿿]\((?![A-Za-z0-9])|"[一-鿿]/.test(t)) bad.push('半角标点');
      let bd; try { bd = o.getBounds(); } catch { bd = null; }
      if (bd && o.scrollFactorX === 0 && bd.width > 4 && (bd.right > 962 || bd.bottom > 542 || bd.x < -2 || bd.y < -2) && bd.x > -500 && bd.y > -500) bad.push('出屏');
      if (bad.length) found.push({ scene: sc, name: o.name || '', text: t.replace(/\n/g, '⏎').slice(0, 70), bad: [...new Set(bad)] });
    }
    if (o.list) walk(o.list, sc); } };
  for (const sc of g.scene.getScenes(true)) walk(sc.children.list, sc.scene.key);
  return found.map(f => ({ screen: name, ...f }));
}, [name, ALLOW.source]).then(r => { issues.push(...r); return r.length; });
const wait = ms => p.waitForTimeout(ms);
const shot = n => p.screenshot({ path: `${out}/${tag}-${n}.png` });

await p.goto(base + '?layout=desktop&story=off');
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 }); await wait(2500);
// 1. 主页
await scan('主页'); await shot('home');
// 2. 军中设置（各页签）
await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName('home-settings')?.emit('pointerdown')); await wait(600);
for (const tab of ['sound', 'view', 'display', 'battle', 'story']) { await p.evaluate(t => { const m = window.__game.scene.getScene('MenuScene'), f = (l, n) => { for (const o of l) { if (o.name === n) return o; if (o.list) { const r = f(o.list, n); if (r) return r; } } return null; }; f(m.children.list, 'settings-tab-' + t)?.emit('pointerdown'); }, tab); await wait(250); await scan('军中设置·' + tab); if (tab === 'battle') await shot('settings'); }
// 3. 天下地图 + 城池小卡
await p.evaluate(() => window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene')); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await wait(2500);
await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); for (const n of ['era-intro', 'chapter-intro', 'world-guide']) s.children.getByName(n)?.destroy?.(); });
await scan('天下地图');
await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'), m = s.cityMarkers.find(x => s.status.get(x.city.id)?.kind === 'far') ?? s.cityMarkers[0]; s.selected = { kind: 'city', city: m.city }; s.refresh(); }); await wait(300);
await scan('天下地图·城池小卡'); await shot('worldmap');
// 4. 营寨
await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').scene.start('CityScene')); await p.waitForFunction(() => window.__game.scene.isActive('CityScene')); await wait(2500);
await scan('营寨');
// 5. 招贤馆
await p.evaluate(() => window.__game.scene.getScene('CityScene').scene.start('TalentHallScene')); await wait(2500); await scan('招贤馆');
// 6. 战斗
await p.goto(base + '?dev=1&autostart=1&stage=3&layout=desktop&story=off');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await wait(2500);
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); });
await wait(1500); await scan('战斗 HUD');
await p.evaluate(() => window.__game.scene.getScene('GameScene').togglePause()); await wait(500); await scan('战斗·暂停'); await shot('pause');
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.openBuildPanel(); }); await wait(600); await scan('战法构筑'); await shot('build');
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.children.getByName('build-overview')?.getData?.('ui')?.close?.(); s.closeBuildPanel?.(); if (s.mode === 'pause') s.togglePause(); }); await wait(400);
await p.evaluate(() => window.__game.scene.getScene('GameScene').openBattleBag()); await wait(800); await scan('行囊');
await p.evaluate(() => window.__game.scene.getScene('GameScene').children.getByName('item-bag')?.getData('ui')?.close()); await wait(300);
await p.evaluate(async () => { const s = window.__game.scene.getScene('GameScene'), C = await import('/src/ui/HeroCodexUI.ts'); C.openHeroCodex(s, 'zhaoyun'); }); await wait(500);
for (const t of ['overview', 'attrs', 'weapon', 'xinde', 'schools']) { await p.evaluate(t => { const r = window.__game.scene.getScene('GameScene').children.getByName('hero-codex'), f = (l, n) => { for (const o of l) { if (o.name === n) return o; if (o.list) { const x = f(o.list, n); if (x) return x; } } return null; }; f(r.list, 'codex-tab-' + t)?.emit('pointerdown'); }, t); await wait(250); await scan('武将谱·' + t); }
await p.evaluate(() => window.__game.scene.getScene('GameScene').children.getByName('hero-codex')?.getData('ui')?.close()); await wait(300);
// 7. 结算
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.finish(true, 'boss'); }); await wait(4500);
await p.evaluate(() => window.__game.scene.getScene('GameScene').resultAnimSkip?.()); await wait(800);
await scan('结算'); await shot('result');
// 8. 行营休整（四个页签）
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), ui = s.campUI; s.resultPanel?.setVisible(false); ui.open('ui-text-' + Date.now(), '测试'); ui.setVisible(true); }); await wait(600);
for (const t of [0, 2, 3, 4]) { await p.evaluate(t => { const ui = window.__game.scene.getScene('GameScene').campUI, f = (l, n) => { for (const o of l) { if (o.name === n) return o; if (o.list) { const x = f(o.list, n); if (x) return x; } } return null; }; f(ui.root.list, 'camp-tab-' + t)?.emit('pointerdown'); }, t); await wait(400); await scan('行营休整·' + t); if (t === 2) await shot('camp'); }

await b.close();
// 汇总
const byKind = {}; for (const i of issues) for (const k of i.bad) (byKind[k.split(':')[0]] ??= []).push(i);
for (const [k, list] of Object.entries(byKind)) { console.log(`\n—— ${k}（${list.length}）`); for (const i of list.slice(0, 40)) console.log(`  [${i.screen}] ${i.name || '-'} ｜ ${i.text} ｜ ${i.bad.join(',')}`); }
ck('界面文字无 undefined / NaN / null / 占位符', !(byKind['漏网']?.length), byKind['漏网']);
ck('界面文字无英文残留（白名单外）', !(byKind['英文']?.length), byKind['英文']?.map(i => i.text));
ck('中文旁不用半角标点', !(byKind['半角标点']?.length), byKind['半角标点']?.map(i => i.text));
ck('文字不出屏（960×540）', !(byKind['出屏']?.length), byKind['出屏']?.map(i => `[${i.screen}] ${i.text}`));
ck('无页面报错', errors.length === 0, errors.slice(0, 4));
process.exit(fail ? 1 : 0);
