// Steam 宣传片素材录制（2026-11-18）：每段一个 1920×1080 录屏（Playwright recordVideo），记下动作开始的秒数；战斗 BGM 另用 tools/render-battle-bgm.mjs 离线渲染。
// 剪辑见 tools/marketing-trailer-edit.mjs。用法：BASE=http://127.0.0.1:5180/ RAW=<目录> node tools/marketing-trailer-record.mjs   （ONLY=opening,mow,… 只录部分）
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', RAW = process.env.RAW ?? 'marketing/steam/trailer/raw';
mkdirSync(RAW, { recursive: true });
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean), want = k => !ONLY.length || ONLY.includes(k);
const metaFile = join(RAW, 'segments.json'), meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : {};
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const seedScript = sv => {
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_town_intro3', '1'); localStorage.setItem('im_sfx_vol', '0'); if (sv) localStorage.setItem('im_world_v1', JSON.stringify(sv)); sessionStorage.setItem('seeded', '1'); }
  window.__IM_PARLEY_LIVE = true;
  // 截 WebAudio：凡是接到 destination 的节点，同时接一份到 MediaStream（录 BGM 用）
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dst, ...a) { const r = orig.call(this, dst, ...a); try { if (dst instanceof AudioDestinationNode) { const ctx = this.context; if (!ctx.__tap) { ctx.__tap = ctx.createMediaStreamDestination(); window.__tapCtx = ctx; } orig.call(this, ctx.__tap); } } catch { /* ignore */ } return r; };
};
const hideDev = p => p.evaluate(() => { const st = document.createElement('style'); st.textContent = '#dev-panel,#dev-layout-toggle,#dev-test-save{display:none!important}'; document.head.appendChild(st); setInterval(() => { for (const sc of window.__game?.scene.getScenes(true) ?? []) { sc.devText?.setVisible(false); const walk = l => { for (const o of l) { if (o.type === 'Text' && /^FPS /.test(o.text ?? '')) o.setVisible(false); if (o.list) walk(o.list); } }; walk(sc.children.list); } }, 100); });
/** 录一段：新 context 带录像；setup 摆好场景（不计入），mark() 记下正片起点，act() 演出；结束后存成 <name>.webm。 */
const record = async (name, query, seed, setup, act, secs) => {
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: RAW + '/tmp', size: { width: 1920, height: 1080 } } });
  const t0 = Date.now(), p = await ctx.newPage(); p.on('pageerror', e => errors.push(name + ' ' + e.message));
  await p.addInitScript(seedScript, seed ?? null);
  await p.goto(BASE + query, { timeout: 180000 });
  await hideDev(p);
  const env = await setup(p);
  const start = (Date.now() - t0) / 1000;
  await act(p, env);
  await p.waitForTimeout(400);
  const vid = p.video(); await ctx.close();
  const f = await vid.path(); renameSync(f, join(RAW, name + '.webm'));
  meta[name] = { start: +start.toFixed(2), dur: secs };
  writeFileSync(metaFile, JSON.stringify(meta, null, 1));
  console.log('REC', name, meta[name]);
};
const S = scene => `window.__game.scene.getScene('${scene}')`;
const evIn = (p, scene) => (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S(scene), String(fn), arg]);
const openBattle = async (p, scene, reg, run) => {
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
  await p.evaluate(([key, reg, run]) => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer', 'guanduTransfer', 'hanzhongTransfer']) g.registry.remove(k); for (const [k, v] of Object.entries(reg)) g.registry.set(k, v); g.registry.set('runConfig', { character: 'zhaoyun', ...run }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); }, [scene, reg, run]);
  await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S(scene), { timeout: 120000 }); await p.waitForTimeout(1000);
  const ev = evIn(p, scene);
  await ev(s => { s.player.damageImmune = true; });
  for (let i = 0; i < 150 && !(await ev(s => !!s.boss?.active)); i++) { await ev(s => { if (s.mode === 'story') { for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); s.setMode('none'); } if (!s.boss?.active && !s.bossSpawned) { const w = s.chapter?.waves; s.devSetTime?.(w?.length ? w[w.length - 1].start + 1 : 999); } }); await p.waitForTimeout(200); }
  return ev;
};
const keep = (ev) => ev(s => { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'paused' && s.mode !== 'parley') s.setMode('none'); });
/** 主将绕圈跑动（键盘）：画面有动感。 */
const circle = async (p, secs, ev) => { const keys = ['KeyD', 'KeyS', 'KeyA', 'KeyW']; const end = Date.now() + secs * 1000; let i = 0; while (Date.now() < end) { const k = keys[i++ % 4]; await p.keyboard.down(k); await p.waitForTimeout(650); await p.keyboard.up(k); if (ev) await keep(ev); } };

if (want('opening')) await record('opening', '?layout=desktop&opening=1&gate=0', null,
  async p => { await p.waitForFunction(() => window.__game?.scene.isActive('OpeningScene') && window.__game.scene.getScene('OpeningScene').clock > .05, null, { timeout: 120000 }); },
  async p => { await p.waitForTimeout(6500); }, 6.5);
if (want('title')) await record('title', '?layout=desktop&opening=1&gate=0', null,
  async p => { await p.waitForFunction(() => window.__game?.scene.isActive('OpeningScene') && window.__game.scene.getScene('OpeningScene').clock > .05, null, { timeout: 120000 }); await p.evaluate(() => window.__game.scene.getScene('OpeningScene').seekTo(12.6)); await p.waitForTimeout(80); },
  async p => { await p.waitForTimeout(7200); }, 7.2);
if (want('mow')) await record('mow', '?dev=1&autostart=1&stage=2&layout=desktop', null,
  async p => {
    await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 }); await p.waitForTimeout(1200);
    const ev = evIn(p, 'GameScene');
    await ev(s => { const A = s.__DEV_ACTIONS; A.closePopup?.(); A.presetStrong?.(); A.god?.(); for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); if (s.mode === 'story') s.setMode('none'); const w = s.chapter?.waves; if (w?.length > 2) s.devSetTime?.(w[w.length - 2].start + 5); });
    for (let i = 0; i < 16; i++) { await p.waitForTimeout(500); await keep(ev); }
    await ev(s => { const kinds = [...new Set(s.enemies.filter(e => e.active && e.kind !== 'boss').map(e => e.kind))]; for (let i = 0; i < 110; i++) { const a = Math.random() * Math.PI * 2, d = 160 + Math.random() * 460; s.spawnEnemy(kinds[i % kinds.length], s.player.x + Math.cos(a) * d * 1.4, s.player.y + Math.sin(a) * d, undefined, true); } });
    return ev;
  }, async (p, ev) => { await circle(p, 7, ev); }, 7);
if (want('dual')) await record('dual', '?dev=1&layout=desktop', null,
  async p => {
    const ev = await openBattle(p, 'GuanduGameScene', { guanduStage: 2 }, {});
    for (let i = 0; i < 60 && !(await ev(s => (s.dual?.entries.length ?? 0) >= 2)); i++) { await ev(s => { if (s.mode === 'story') { for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); s.setMode('none'); } }); await p.waitForTimeout(300); }
    await p.waitForTimeout(2500); await ev(s => { s.__DEV_ACTIONS?.presetStrong?.(); const es = s.dual?.entries?.map(e => e.boss ?? e) ?? [s.boss]; es.forEach((b, i) => { const x = s.player.x + (i ? 160 : -160), y = s.player.y - 50; b.sprite?.setPosition(x, y); b.x = x; b.y = y; }); });
    return ev;
  }, async (p, ev) => { for (let i = 0; i < 9; i++) { await p.waitForTimeout(500); await keep(ev); } }, 4.5);
if (want('lubu')) await record('lubu', '?dev=1&layout=desktop', null,
  async p => { const ev = await openBattle(p, 'LubuGameScene', {}, {}); await p.waitForTimeout(3500); await ev(s => { s.__DEV_ACTIONS?.presetStrong?.(); const x = s.player.x + 160, y = s.player.y - 60; s.boss.sprite.setPosition(x, y); s.boss.x = x; s.boss.y = y; }); return ev; },
  async (p, ev) => { for (let i = 0; i < 6; i++) { await p.waitForTimeout(500); await keep(ev); } await ev(s => { const b = s.boss; b.invulnerable = false; s.hitEnemy(b, Math.max(1, b.hp - b.maxHp * .42), s.combatNow, 'melee', false, false); }); for (let i = 0; i < 8; i++) { await p.waitForTimeout(500); await keep(ev); } }, 7);
if (want('surrender')) await record('surrender', '?dev=1&layout=desktop', null,
  async p => { const ev = await openBattle(p, 'GameScene', {}, { chapter: 'hulao', westStage: 1 }); await p.waitForTimeout(1200); return ev; },
  async (p, ev) => { await p.waitForTimeout(800); await ev(s => { const b = s.boss; b.invulnerable = false; s.hitEnemy(b, Math.max(1, b.hp - b.maxHp * .12), s.combatNow, 'melee', false, false); }); await p.waitForTimeout(3200); }, 4);
if (want('siege')) {
  const save = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu', 'chibi'], ownedCities: ['xuchang', 'runan', 'guandu', 'chenliu', 'luoyang', 'wancheng', 'xiangyang'], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 5 };
  await record('siege', '?layout=desktop', save, async p => {
    await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
    await p.evaluate(async () => { const c = await import('/src/world/WorldCities.ts'), w = await import('/src/world/WorldStore.ts'), s = w.loadWorld(); const id = c.CITIES.find(x => x.tier === 'large' && c.cityAttackable(x.id, s.ownedCities))?.id, g = window.__game; g.registry.set('siegeCity', id); g.registry.remove('siegeMode'); g.registry.set('runConfig', { character: 'zhaoyun' }); for (const sc of g.scene.getScenes(true)) sc.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('SiegeGameScene'); else { g.registry.set('pendingWarlord', 'SiegeGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); } });
    await p.waitForFunction(() => window.__game.scene.isActive('SiegeGameScene') && window.__game.scene.getScene('SiegeGameScene').player, null, { timeout: 120000 });
    const ev = evIn(p, 'SiegeGameScene'); await p.waitForTimeout(1500);
    await ev(s => { s.__DEV_ACTIONS?.closePopup?.(); s.player.damageImmune = true; for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves?.add(i); s.pendingRecruit = false; s.siegeMid?.lowerBridge?.(); });
    for (let i = 0; i < 8; i++) { await p.waitForTimeout(400); await ev(s => { if (s.mode !== 'none' && s.mode !== 'paused') { s.__DEV_ACTIONS?.closePopup?.(); s.setMode('none'); } const M = s.siegeMid; if (M?.ram) { M.ram.y = -250; M.ram.x = 0; } s.player.sprite.setPosition(90, -380); }); }
    return ev;
  }, async (p, ev) => { for (let i = 0; i < 12; i++) { await p.waitForTimeout(450); await keep(ev); } }, 5);
}
if (want('map')) {
  const save = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 860, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: ['guandu', 'chenliu'], eraSeen: 1, capturedEver: ['guandu', 'chenliu'], chapterSeen: 3, tutorialDone: true };
  await record('map', '?layout=desktop', save, async p => {
    await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
    await p.evaluate(async () => { const w = await import('/src/world/WorldStore.ts'); w.setWorldRandom?.(() => .99); window.__game.registry.set('mapCaptured', 'chenliu'); window.__game.registry.set('mapFocusCity', 'chenliu'); });
  }, async p => { await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'); }); await p.waitForTimeout(6000); }, 6);
}
if (want('camp')) {
  const save = { version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1260, buildings: { barracks: 3, farm: 3, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: ['xuchang', 'guandu', 'chenliu'], eraSeen: 2, capturedEver: ['xuchang', 'guandu', 'chenliu'], alerts: [], lastLost: [], chapterSeen: 4, intelSeq: 1, mountTutorialDone: true, town: { year: 196, season: 2, levels: { hall: 3, barracks: 3, farm: 3, academy: 2, talent: 2, stable: 2, granary: 2, pavilion: 1 }, focus: {}, report: null, tech: [], drill: 3 } };
  await record('camp', '?layout=desktop', save, async p => {
    await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
    await p.evaluate(() => window.__game.scene.getScenes(true).forEach(s => s.scene.start('CityScene')));
    await p.waitForFunction(() => window.__game.scene.isActive('CityScene'), null, { timeout: 30000 }); await p.waitForTimeout(3000);
    await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); c.scrollTo?.(0, 0, false); });
  }, async p => { await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'), o = { f: 0 }, max = 1024 * c.k - c.vr.h; c.tweens.add({ targets: o, f: .7, duration: 3800, ease: 'Sine.easeInOut', onUpdate: () => c.scrollTo(0, max * o.f, false) }); }); await p.waitForTimeout(4000); }, 4);
}
// 战斗 BGM 不在这里录（页内 MediaRecorder 接不到音乐所在的 AudioContext，录出来是静音）：用 tools/render-battle-bgm.mjs 离线渲染到 RAW/battle-bgm.wav
await b.close();
if (errors.length) console.log('页面报错', errors.slice(0, 5));
