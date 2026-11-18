// 「返回主菜单」三处（用户 2026-11-18「返回主菜单按钮，三处都加」）：
// ① 战斗暂停菜单：撤退旁「返回主菜单」，点一次待确认（「返回主菜单？本关进度不保留」），再点才执行；回滚规则与撤退同一条路（BattleSnapshot），最后进主页（不是天下地图、不播开场）
// ② 天下地图、③ 义军营寨：「主菜单」小按钮，直接回主页；快捷键 M（可在设置里改）
// 电脑布局走正式存档（不带 ?dev=1，与 test-quit-rollback 一致）；另跑一遍 iPhone 仿真确认不报错、回主页后纹理不堆积。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-main-menu.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const active = p => p.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key));
try {
  // ---------------- 电脑布局：暂停菜单「返回主菜单」 ----------------
  {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    const ready = () => p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
    const save = () => p.evaluate(async () => { const H = await import('/src/systems/HeroProgress.ts'), W = await import('/src/world/WorldStore.ts'), I = await import('/src/systems/ItemStore.ts'); return { lv: H.heroInfo('zhaoyun').level, xp: H.heroInfo('zhaoyun').xp, prov: W.loadWorld().provisions, bag: I.loadItems().bag.length, snap: !!localStorage.getItem('im_battle_snapshot') }; });
    const gain = () => p.evaluate(async () => { const H = await import('/src/systems/HeroProgress.ts'), W = await import('/src/world/WorldStore.ts'), I = await import('/src/systems/ItemStore.ts'), D = await import('/src/data/items.ts');
      const i = H.heroInfo('zhaoyun'); H.setHeroProgress('zhaoyun', i.level + 3, 0); W.addProvisions(55); const it = D.rollItem('blue'); if (it) I.addItems([it]); });
    const start11 = async () => {
      await p.evaluate(() => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 1 }); const cur = g.scene.getScene('GameScene'); if (cur && g.scene.isActive('GameScene')) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); } });
      await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await p.waitForTimeout(600);
      await p.evaluate(S0 => { const s = eval(S0); s.player.damageImmune = true; for (let i = 0; i < 20 && s.mode !== 'none'; i++) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode === 'story' || s.mode === 'levelup') s.setMode('none'); } }, S);
    };
    await p.goto(BASE + '?layout=desktop'); await p.evaluate(() => localStorage.clear()); await p.reload(); await ready();
    await p.evaluate(async () => { const W = await import('/src/world/WorldStore.ts'); W.setTutorialSeen(true); W.addProvisions(30); });
    const H = await p.evaluate(async () => { const m = await import('/src/data/hotkeys.ts'); return { code: m.hotkeyCode('menu'), label: m.hotkeyLabel('menu'), conflicts: m.hotkeyConflicts().length }; });
    ck('快捷键表有「返回主菜单」（默认 M），无冲突', H.code === 'KeyM' && H.conflicts === 0, H);
    const base = await save();
    await start11(); await gain();
    // 开暂停：直接调 togglePause（新存档 1-1 首次的 Esc 可能被新手引导的「Esc 跳过」吃掉）
    await p.evaluate(S0 => { const s = eval(S0); if (s.mode !== 'pause') s.togglePause(); }, S); await p.waitForTimeout(500);
    const btn = await p.evaluate(S0 => { const s = eval(S0), m = s.pausePanel.getByName('pause-menu'), e = s.pausePanel.getByName('pause-exit'); return { mode: s.mode, has: !!m, vis: !!m?.visible, text: m?.text, ex: e && Math.round(e.x), ey: e && Math.round(e.y), mx: m && Math.round(m.x), my: m && Math.round(m.y), hint: !!s.children.list.concat(s.pausePanel.list).find(o => o.type === 'Text' && o.text === 'M' && o.visible) }; }, S);
    await p.screenshot({ path: 'assets/review/main-menu/pause-desktop.png' }).catch(() => {});
    ck('暂停菜单：撤退旁有「返回主菜单」，标快捷键 M', btn.mode === 'pause' && btn.has && btn.vis && btn.text === '返回主菜单' && btn.mx === btn.ex && btn.my > btn.ey && btn.hint, btn);
    await p.evaluate(S0 => eval(S0).pausePanel.getByName('pause-menu').emit('pointerdown'), S); await p.waitForTimeout(200);
    const c1 = await p.evaluate(S0 => { const s = eval(S0); return { text: s.pausePanel.getByName('pause-menu').text, mode: s.mode }; }, S);
    await p.screenshot({ path: 'assets/review/main-menu/pause-confirm.png' }).catch(() => {});
    ck('点一次：进待确认（「返回主菜单？本关进度不保留」），还在暂停', c1.text === '返回主菜单？本关进度不保留' && c1.mode === 'pause' && (await active(p)).includes('GameScene'), c1);
    await p.evaluate(S0 => { const s = eval(S0); s.togglePause(); }, S); await p.waitForTimeout(250); await p.evaluate(S0 => { const s = eval(S0); s.togglePause(); }, S); await p.waitForTimeout(250);
    ck('关掉再打开暂停菜单：待确认复位', await p.evaluate(S0 => eval(S0).pausePanel.getByName('pause-menu').text, S) === '返回主菜单');
    // 快捷键 M：按一次待确认，再按一次执行 → 回滚、重载、进主页
    await p.keyboard.press('KeyM'); await p.waitForTimeout(200);
    ck('暂停中按 M：进待确认', await p.evaluate(S0 => eval(S0).pausePanel.getByName('pause-menu').text, S) === '返回主菜单？本关进度不保留');
    const nav = p.waitForEvent('load', { timeout: 30000 }).catch(() => null);
    await p.keyboard.press('KeyM'); await nav; await ready(); await p.waitForTimeout(500);
    const after = await save(), sc = await active(p);
    ck('再按 M：本关所得回滚（等级 / 军粮 / 行囊回到进关前，快照清掉）', after.lv === base.lv && after.xp === base.xp && after.prov === base.prov && after.bag === base.bag && !after.snap, { base, after });
    ck('回到的是主页（不是天下地图、不播开场）', sc.includes('MenuScene') && !sc.includes('WorldMapScene') && !sc.includes('OpeningScene'), sc);
    // 撤退仍走原来的路（回滚后进主页 / 天下地图规则不变）
    await start11(); await gain();
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    const ex = await p.evaluate(S0 => { const s = eval(S0), e = s.pausePanel.getByName('pause-exit'); e.emit('pointerdown'); return e.text; }, S);
    const nav2 = p.waitForEvent('load', { timeout: 30000 }).catch(() => null);
    await p.evaluate(S0 => eval(S0).pausePanel.getByName('pause-exit').emit('pointerdown'), S); await nav2; await ready();
    const after2 = await save();
    ck('「撤退」不受影响：二次确认 → 同样回滚', ex.includes('不保留') && after2.lv === base.lv && after2.prov === base.prov && !after2.snap, { ex, after2 });
    ck('电脑布局无页面报错', !errs.length, errs.slice(0, 3));
    await p.close();
  }
  // ---------------- 电脑布局：天下地图 / 义军营寨「主菜单」 ----------------
  {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto(BASE + '?dev=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
    for (const [scene, shot] of [['WorldMapScene', 'map'], ['CityScene', 'city']]) {
      await p.evaluate(k => window.__game.scene.getScene('MenuScene').scene.start(k), scene);
      await p.waitForFunction(k => window.__game.scene.isActive(k), scene, { timeout: 60000 }); await p.waitForTimeout(1200);
      const info = await p.evaluate(k => { const s = window.__game.scene.getScene(k), m = s.children.getByName('main-menu'), key = s.children.getByName('main-menu-key'); return { has: !!m, vis: !!m?.visible, text: m?.text, key: key?.text, x: m && Math.round(m.x), y: m && Math.round(m.y), inside: m ? m.x > 0 && m.x < 960 && m.y > 0 && m.y < 540 : false }; }, scene);
      await p.screenshot({ path: `assets/review/main-menu/${shot}-desktop.png` }).catch(() => {});
      ck(`${scene}：有「主菜单」小按钮（标 M），在画面内`, info.has && info.vis && info.text === '主菜单' && info.key === 'M' && info.inside, info);
      await p.evaluate(k => window.__game.scene.getScene(k).children.getByName('main-menu').emit('pointerdown'), scene);
      await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 30000 }).catch(() => {});
      ck(`${scene}：点「主菜单」直接回主页（不确认）`, (await active(p)).includes('MenuScene') && !(await active(p)).includes(scene), await active(p));
    }
    await p.evaluate(() => window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'));
    await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'), null, { timeout: 60000 }); await p.waitForTimeout(800);
    await p.keyboard.press('KeyM'); await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 30000 }).catch(() => {});
    ck('天下地图按 M 回主页', (await active(p)).includes('MenuScene'), await active(p));
    ck('地图 / 营寨无页面报错', !errs.length, errs.slice(0, 3));
    await p.close();
  }
  // ---------------- 手机（iPhone 仿真）：三处都能用，不报错，回主页后纹理不堆积 ----------------
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(() => { try { localStorage.setItem('im_opening_seen', '1'); } catch {} });
    await p.goto(BASE + '?dev=1&layout=mobile'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 }); await p.waitForTimeout(800);
    const mb = () => p.evaluate(() => { const tm = window.__game.textures; let m = 0; for (const k of tm.getTextureKeys()) for (const s of tm.get(k).source) { const lr = s.image?.__loReal; m += (lr ? lr[0] * lr[1] : s.width * s.height) * 4 / 1048576; } return Math.round(m); });
    const home0 = await mb();
    for (const scene of ['WorldMapScene', 'CityScene']) {
      await p.evaluate(k => window.__game.scene.getScene('MenuScene').scene.start(k), scene);
      await p.waitForFunction(k => window.__game.scene.isActive(k), scene, { timeout: 60000 }); await p.waitForTimeout(1500);
      const has = await p.evaluate(k => { const m = window.__game.scene.getScene(k).children.getByName('main-menu'); return !!m?.visible && m.x > 0 && m.x < 540; }, scene);
      await p.screenshot({ path: `assets/review/main-menu/${scene === 'WorldMapScene' ? 'map' : 'city'}-mobile.png` }).catch(() => {});
      await p.evaluate(k => window.__game.scene.getScene(k).children.getByName('main-menu')?.emit('pointerdown'), scene);
      await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 30000 }).catch(() => {});
      ck(`手机 ${scene}：有「主菜单」，点了回主页`, has && (await active(p)).includes('MenuScene'), { has, scenes: await active(p) });
    }
    await p.waitForTimeout(600);
    const home1 = await mb();
    // 进 1-1（手机会先载入战斗图集）→ 暂停 →「返回主菜单」两次
    await p.evaluate(() => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 1 }); g.scene.getScene('MenuScene').scene.start('GameScene'); });
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 180000 }); await p.waitForTimeout(800);
    const pm = await p.evaluate(S0 => { const s = eval(S0); s.player.damageImmune = true; s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode('none'); s.togglePause(); const m = s.pausePanel.getByName('pause-menu'), e = s.pausePanel.getByName('pause-exit'); return { has: !!m?.visible, mx: Math.round(m.x), ex: Math.round(e.x), my: Math.round(m.y), ey: Math.round(e.y) }; }, S);
    await p.screenshot({ path: 'assets/review/main-menu/pause-mobile.png' }).catch(() => {});
    ck('手机暂停菜单：撤退与返回主菜单并排', pm.has && pm.my === pm.ey && pm.mx > pm.ex, pm);
    await p.evaluate(S0 => { const m = eval(S0).pausePanel.getByName('pause-menu'); m.emit('pointerdown'); m.emit('pointerdown'); }, S);
    await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 }).catch(() => {}); await p.waitForTimeout(2500);
    const home2 = await mb();
    ck(`手机回到主页后纹理不堆积（首页 ${home0} / 地图营寨后 ${home1} / 战斗后 ${home2} MB）`, (await active(p)).includes('MenuScene') && home1 <= home0 + 20 && home2 <= home0 + 30, { home0, home1, home2 });
    ck('手机无页面报错', !errs.length, errs.slice(0, 3));
    await ctx.close();
  }
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
