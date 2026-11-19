// Steam 商店页截图（2026-11-18）：电脑版 1920×1080，正常游戏画面（关掉 DEV 面板 / 布局切换钮，HUD 保持原样）。
// 用法：BASE=http://127.0.0.1:5180/ node tools/marketing-shots.mjs   （ONLY=opening,mow,… 只拍部分）  输出 marketing/steam/screenshots/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'marketing/steam/screenshots';
mkdirSync(OUT, { recursive: true });
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean), want = k => !ONLY.length || ONLY.includes(k);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
/** 新页面：1920×1080；dev=1 只为测试钩子，截图前把 DEV 面板与布局钮藏掉。 */
const page = async (query, seed) => {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_town_intro3', '1'); if (sv) localStorage.setItem('im_world_v1', JSON.stringify(sv)); sessionStorage.setItem('seeded', '1'); } window.__IM_PARLEY_LIVE = true; }, seed ?? null);
  await p.goto(BASE + query, { timeout: 180000 });
  return p;
};
const clean = p => p.evaluate(() => { for (const id of ['dev-panel', 'dev-layout-toggle', 'dev-test-save']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; } for (const sc of window.__game?.scene.getScenes(true) ?? []) { sc.devText?.setVisible(false); const walk = l => { for (const o of l) { if (o.type === 'Text' && /^FPS /.test(o.text ?? '')) o.setVisible(false); if (o.list) walk(o.list); } }; walk(sc.children.list); } });
const shot = async (p, name) => { await clean(p); await p.waitForTimeout(150); await p.screenshot({ path: `${OUT}/${name}.png` }); console.log('SHOT', name); };
const S = scene => `window.__game.scene.getScene('${scene}')`;
const evIn = (p, scene) => (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S(scene), String(fn), arg]);
/** 开某战斗场景，收掉剧情卷轴，可选让首领出场。 */
const openBattle = async (p, scene, reg, run, boss = true) => {
  await p.evaluate(([key, reg, run]) => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer', 'guanduTransfer', 'hanzhongTransfer']) g.registry.remove(k); for (const [k, v] of Object.entries(reg)) g.registry.set(k, v); g.registry.set('runConfig', { character: 'zhaoyun', ...run }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); }, [scene, reg, run]);
  await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S(scene), { timeout: 120000 }); await p.waitForTimeout(1000);
  const ev = evIn(p, scene);
  await ev(s => { s.player.damageImmune = true; });
  if (boss) {
    for (let i = 0; i < 150 && !(await ev(s => !!s.boss?.active)); i++) { await ev(s => { if (s.mode === 'story') { for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); s.setMode('none'); } if (!s.boss?.active && !s.bossSpawned) { const w = s.chapter?.waves; s.devSetTime?.(w?.length ? w[w.length - 1].start + 1 : 999); } }); await p.waitForTimeout(200); }
    if (!(await ev(s => !!s.boss?.active))) await ev(s => { for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); if (s.mode === 'story') s.setMode('none'); s.spawnBoss(); });
  } else await ev(s => { for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); if (s.mode === 'story') s.setMode('none'); });
  return ev;
};

// ① 开场水墨：标识盖印那一刻、书法字幕段
if (want('opening')) {
  const p = await page('?layout=desktop&opening=1&gate=0');
  await p.waitForFunction(() => window.__game?.scene.isActive('OpeningScene'), null, { timeout: 120000 });
  const O = S('OpeningScene');
  await p.waitForFunction(O0 => eval(O0).clock > .3, O, { timeout: 20000 });
  await p.evaluate(O0 => eval(O0).seekTo(9.4), O); await p.waitForTimeout(1500); await shot(p, '01-opening-calligraphy');
  await p.evaluate(O0 => eval(O0).seekTo(14.6), O); await p.waitForTimeout(2600); await shot(p, '02-opening-title');
  await p.close();
}

// ② 大规模割草：满屏敌军 + 武将特效 + 随从部曲
if (want('mow')) {
  const p = await page('?dev=1&autostart=1&stage=2&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  const ev = evIn(p, 'GameScene');
  await ev(s => { const A = s.__DEV_ACTIONS; A.closePopup?.(); A.presetStrong?.(); A.god?.(); for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); if (s.mode === 'story') s.setMode('none'); const w = s.chapter?.waves; if (w?.length > 2) s.devSetTime?.(w[w.length - 2].start + 5); });
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(500); await ev(s => { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'paused') s.setMode('none'); }); }
  // 满屏敌军：围着主将再刷一圈本章兵种
  await ev(s => { const kinds = [...new Set(s.enemies.filter(e => e.active && e.kind !== 'boss').map(e => e.kind))]; for (let i = 0; i < 95; i++) { const a = Math.random() * Math.PI * 2, d = 140 + Math.random() * 420; s.spawnEnemy(kinds[i % kinds.length], s.player.x + Math.cos(a) * d * 1.4, s.player.y + Math.sin(a) * d, undefined, true); } });
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(500); await ev(s => { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'paused') s.setMode('none'); }); }
  const n = await ev(s => s.enemies.filter(e => e.active).length);
  console.log('enemies', n);
  await shot(p, '03-mow-horde');
  await p.close();
}

// ③ 首领战：双首领（4-2 颜良 + 文丑）
if (want('dual')) {
  const p = await page('?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
  const ev = await openBattle(p, 'GuanduGameScene', { guanduStage: 2 }, {});
  for (let i = 0; i < 60 && !(await ev(s => (s.dual?.entries.length ?? 0) >= 2)); i++) { await ev(s => { if (s.mode === 'story') { for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); s.setMode('none'); } }); await p.waitForTimeout(300); }
  await p.waitForTimeout(2500);
  await ev(s => { s.__DEV_ACTIONS?.presetStrong?.(); const es = s.dual?.entries?.map(e => e.boss ?? e) ?? [s.boss]; es.forEach((b, i) => { const x = s.player.x + (i ? 170 : -170), y = s.player.y - 60; b.sprite?.setPosition(x, y); b.x = x; b.y = y; }); });
  await p.waitForTimeout(1600);
  await shot(p, '04-boss-dual');
  await p.close();
}
// ④ 骑马首领：虎牢关 · 吕布（赤兔），以及二阶段（残血狂暴）
if (want('lubu')) {
  const p = await page('?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
  const ev = await openBattle(p, 'LubuGameScene', {}, {});
  await p.waitForTimeout(3500);
  await ev(s => { s.__DEV_ACTIONS?.presetStrong?.(); const x = s.player.x + 150, y = s.player.y - 70; s.boss.sprite.setPosition(x, y); s.boss.x = x; s.boss.y = y; });
  await p.waitForTimeout(1500);
  await shot(p, '05-boss-mounted');
  await ev(s => { const b = s.boss; b.invulnerable = false; s.hitEnemy(b, Math.max(1, b.hp - b.maxHp * .42), s.combatNow, 'melee', false, false); });
  for (let i = 0; i < 16; i++) { await p.waitForTimeout(400); await ev(s => { if (s.mode === 'parley' || s.mode === 'story') { try { s.__DEV_ACTIONS?.closePopup?.(); } catch { } } }); }
  await ev(s => { const x = s.player.x + 140, y = s.player.y - 80; s.boss.sprite.setPosition(x, y); s.boss.x = x; s.boss.y = y; });
  await p.waitForTimeout(1400);
  await shot(p, '06-boss-phase2');
  await p.close();
}
// ⑤ 招降：华雄残血弹出招降
if (want('surrender')) {
  const p = await page('?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
  const ev = await openBattle(p, 'GameScene', {}, { chapter: 'hulao', westStage: 1 });
  await p.waitForTimeout(1200);
  await ev(s => { const b = s.boss; b.invulnerable = false; s.hitEnemy(b, Math.max(1, b.hp - b.maxHp * .12), s.combatNow, 'melee', false, false); });
  for (let i = 0; i < 30 && !(await ev(s => s.mode === 'parley' && !!s.children.getByName('parley-panel'))); i++) await p.waitForTimeout(150);
  await p.waitForTimeout(1200);
  await shot(p, '07-surrender');
  await p.close();
}
// ⑥ 攻城：大城（冲车、瓮城、城头弓阵）
if (want('siege')) {
  const save = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu', 'chibi'], ownedCities: ['xuchang', 'runan', 'guandu', 'chenliu', 'luoyang', 'wancheng', 'xiangyang'], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 5 };
  const p = await page('?layout=desktop', save);
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
  await p.evaluate(async () => { const c = await import('/src/world/WorldCities.ts'), w = await import('/src/world/WorldStore.ts'), s = w.loadWorld(); const id = c.CITIES.find(x => x.tier === 'large' && c.cityAttackable(x.id, s.ownedCities))?.id, g = window.__game; g.registry.set('siegeCity', id); g.registry.remove('siegeMode'); g.registry.set('runConfig', { character: 'zhaoyun' }); for (const sc of g.scene.getScenes(true)) sc.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('SiegeGameScene'); else { g.registry.set('pendingWarlord', 'SiegeGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); } });
  await p.waitForFunction(() => window.__game.scene.isActive('SiegeGameScene') && window.__game.scene.getScene('SiegeGameScene').player, null, { timeout: 120000 });
  const ev = evIn(p, 'SiegeGameScene');
  await p.waitForTimeout(1500);
  await ev(s => { s.__DEV_ACTIONS?.closePopup?.(); s.player.damageImmune = true; for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves?.add(i); s.pendingRecruit = false; });
  for (let i = 0; i < 16; i++) { await p.waitForTimeout(500); await ev(s => { if (s.mode !== 'none' && s.mode !== 'paused') { s.__DEV_ACTIONS?.closePopup?.(); s.setMode('none'); } s.player.sprite.setPosition(40, -360); }); }
  // 放下吊桥：冲车出营撞门，瓮城在门后
  await ev(s => s.siegeMid?.lowerBridge?.());
  for (let i = 0; i < 14; i++) { await p.waitForTimeout(500); await ev(s => { if (s.mode !== 'none' && s.mode !== 'paused') { s.__DEV_ACTIONS?.closePopup?.(); s.setMode('none'); } const r = s.siegeMid?.ramInfo; const M = s.siegeMid; if (M?.ram) { M.ram.y = -330; M.ram.x = 0; } s.player.sprite.setPosition(90, -430); }); } // 截图：冲车直接推到护城河桥头、主将在城门前
  console.log('ram', JSON.stringify(await ev(s => s.siegeMid?.ramInfo)));
  await shot(p, '08-siege-gate');
  await p.close();
}
// ⑦ 天下地图：迷雾、势力疆域、可攻标记
if (want('map')) {
  const save = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 860, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: ['guandu', 'chenliu'], eraSeen: 1, capturedEver: ['guandu', 'chenliu'], chapterSeen: 3, tutorialDone: true };
  const p = await page('?layout=desktop', save);
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
  await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(2500);
  await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); s.flyTo(820, 470, s.minZoom * 1.45, 0); const m = s.cityMarkers.find(x => x.city.id === 'xuchang'); m.hit.emit('pointerup', { getDistance: () => 0 }); m.hit.emit('pointerover'); });
  await p.waitForTimeout(2500);
  await shot(p, '09-world-map');
  await p.close();
}
// ⑧ 营寨经营
if (want('camp')) {
  const save = { version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1260, buildings: { barracks: 3, farm: 3, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: ['xuchang', 'guandu', 'chenliu'], eraSeen: 2, capturedEver: ['xuchang', 'guandu', 'chenliu'], alerts: [], lastLost: [], chapterSeen: 4, intelSeq: 1, mountTutorialDone: true,
    town: { year: 196, season: 2, levels: { hall: 3, barracks: 3, farm: 3, academy: 2, talent: 2, stable: 2, granary: 2, pavilion: 1 }, focus: {}, report: null, tech: [], drill: 3 } };
  const p = await page('?layout=desktop', save);
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
  await p.evaluate(() => window.__game.scene.getScenes(true).forEach(s => s.scene.start('CityScene')));
  await p.waitForFunction(() => window.__game.scene.isActive('CityScene'), null, { timeout: 30000 }); await p.waitForTimeout(3000);
  await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); for (const n of ['town-intro', 'town-intro-modal']) c.children.getByName(n)?.destroy(); c.scrollTo?.(0, (1024 * c.k - c.vr.h) * .45, false); });
  await p.waitForTimeout(1200);
  await shot(p, '10-camp');
  await p.close();
}
// ⑨ 构筑总览（行营将帅帐）
if (want('build')) {
  const p = await page('?dev=1&autostart=1&stage=2&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.__DEV_ACTIONS.presetStrong?.(); s.resting = true; s.setMode('rest'); s.renderRecruit(); });
  await p.waitForTimeout(5200);
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), f = l => { for (const o of l) { if (o.name === 'camp-tab-3') return o; if (o.list) { const r = f(o.list); if (r) return r; } } }; f(s.campUI.root.list)?.emit('pointerdown'); });
  await p.waitForTimeout(800);
  await shot(p, '11-build-overview');
  await p.close();
}
// ⑩ 剧情卷轴
if (want('story')) {
  const p = await page('?dev=1&autostart=1&stage=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const s = window.__game.scene.getScene('GameScene'), St = await import('/src/systems/Story.ts'), D = await import('/src/data/story/index.ts');
    for (const o of s.children.list.filter(o => o.name?.startsWith?.('story-'))) o.destroy();
    let node = null; for (const c of Object.values(D.STORY_CHAPTERS)) { const all = [c.open, c.close, ...(c.closeAfter ?? []), ...(c.camp ?? []), ...Object.values(c.stages).flatMap(st => [...(st.before ?? []), st.brief, ...(st.after ?? []), st.choice])]; node = all.find(n => n?.id === 'qunxiong.zhujiu') ?? node; }
    const ctx = { lord: 'liubei', team: () => ['liubei', 'zhangfei', 'guanyu'], recruited: () => true };
    const lines = St.resolveLines(node, ctx); St.playStoryScroll(s, node, lines, ctx, '继续', () => {}); return lines.length;
  });
  console.log('story lines', r);
  await p.waitForTimeout(3500);
  await shot(p, '12-story-scroll');
  await p.close();
}
await b.close();
if (errors.length) console.log('页面报错', errors.slice(0, 5));
