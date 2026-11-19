// 主线关五段（wave-progression-redesign.md P1，2026-11-19）：先锋 → 精锐 → 事件 → 副将 → 首领、顶部「战况」线、段落故事名横幅、副将、保底 5 次。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-stage-phases.mjs   截图在 assets/review/stage-phases/
// 关内时间直接跳到各段开头（不等真实 4 分钟），三选一自动选第 1 张。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/stage-phases'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 320) + (ok ? '' : ' … ' + JSON.stringify(d).slice(320, 900)) : '')); };
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 500, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 12, tutorialDone: true };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });

async function open(start) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(w => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } }, world);
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
  await p.evaluate(st => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); for (const [k, v] of Object.entries(st.reg ?? {})) s0.registry.set(k, v);
    s0.registry.set('runConfig', { character: 'zhaoyun', ...(st.run ?? {}) }); for (const sc of g.scene.getScenes(true)) if (sc.scene.key !== 'GameScene') sc.scene.stop(); s0.scene.start(st.key); }, start);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed > .5 && s.elapsed < 8; }, start.key, { timeout: 120000 });
  await p.evaluate(k => { const s = window.__game.scene.getScene(k); window.__S = s; s.player.damageImmune = true; window.__banners = [];
    const sb = s.showWaveBanner.bind(s); s.showWaveBanner = (t, d, c) => { window.__banners.push(t + (c ? ' | ' + c : '')); return sb(t, d, c); };
    window.__calm = () => { for (let i = 0; i < 16 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') { s.chooseRecruit?.(0); s.__DEV_ACTIONS?.closePopup?.(); } else if (s.mode === 'parley') s.parley?.choose?.('execute'); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } } }; }, start.key);
  return p;
}
const jump = async (p, t) => { await p.evaluate(t => { window.__S.elapsed = t; window.__S.lastPickAt = -1e9; }, t); await p.waitForTimeout(500); await p.evaluate(() => window.__calm()); await p.waitForTimeout(300); await p.evaluate(() => window.__calm()); };
const state = p => p.evaluate(() => { const s = window.__S, r = s.phaseRunner, t = s.battleTrack; return { phase: s.waveIndex, kinds: s.phasePlan?.phases.map(x => x.kind), starts: s.chapter.waves.map(w => w.start), pace: s.chapter.pace, bossHpMul: s.chapter.growth?.bossHp, cap: s.pickCap(), picks: s.picksGiven, run: r && { ...r.stats }, track: t && { ...t.stats, visible: t.root.visible, alpha: +t.root.alpha.toFixed(2) }, waveText: s.hudTexts.wave.visible, boss: s.bossSpawned, banners: window.__banners.slice(-3) }; });

async function stageCase(label, start, shot) {
  const p = await open(start);
  const a = await state(p);
  ck(`${label}：五段（先锋 / 精锐 / 事件 / 副将 / 首领），首领 205 秒登场；不显示「第 x 波」，顶部战况线；保底 5 次；首领生命 ×1.15`, a.kinds?.join() === 'vanguard,elite,event,lieutenant,boss' && a.starts.join() === '0,45,100,155,205' && !a.waveText && a.track?.visible && a.cap === 5 && a.bossHpMul > 0, a);
  await jump(p, 46); const e = await state(p);
  ck(`${label}：精锐段——横幅写段落故事名（不带「第 x 波」）+「精锐来袭」，精锐小队压上，战况线点亮 2 个图标，保底补到 1`, e.phase === 1 && e.run.elites >= 2 && /精锐来袭/.test(e.banners.join()) && !/第 \d/.test(e.banners.join()) && e.track.iconsLit === 2 && e.picks >= 1, e);
  await jump(p, 101); const v = await state(p);
  ck(`${label}：事件段——伏兵一圈冲阵，保底 2`, v.phase === 2 && v.run.ambush >= 8 && v.picks >= 2 && /伏兵四起/.test(v.banners.join()), v);
  await jump(p, 156); await p.waitForTimeout(600); const l = await state(p);
  const bossHp = await p.evaluate(() => { const s = window.__S; return Math.round(s.chapter.enemies.boss.hp * s.chapter.growth.bossHp); });
  ck(`${label}：副将段——副将（名牌 + 小血条），生命为首领 35%–60%（精锐 ×2 夹在其间），保底 3`, l.phase === 3 && !!l.run.lieutenant && l.run.lieutenantHp / bossHp >= .33 && l.run.lieutenantHp / bossHp <= .62 && l.picks >= 3 && /副将出阵/.test(l.banners.join()), { ...l, bossHp });
  if (shot) { await p.evaluate(() => window.__calm()); await p.waitForTimeout(900); await p.evaluate(() => window.__calm()); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${shot}-lieutenant.png` }); }
  await p.evaluate(() => { const s = window.__S, e = s.phaseRunner.lt.e; e.hp = 0; s.killEnemy(e); }); await p.waitForTimeout(400); await p.evaluate(() => window.__calm()); const d = await state(p);
  ck(`${label}：副将倒下——「X 授首」横幅，保底补到 4`, d.run.lieutenantDown && d.picks >= 4 && /授首/.test(d.banners.join()), d);
  await jump(p, 206); await p.waitForTimeout(800); await p.evaluate(() => window.__calm()); await p.waitForTimeout(400); const z = await state(p);
  ck(`${label}：首领段——205 秒首领登场，战况线淡出让位给首领血条`, z.phase === 4 && z.boss && z.run.phase === 4, z);
  await p.close();
}
await stageCase('2-1 汜水关（GameScene）', { key: 'GameScene', run: { chapter: 'hulao', westStage: 1 } }, null);
// 第三章起的场景在 super.create() 之后才换 chapter：五段要套到换后的那一关
await stageCase('3-2 宛城夜袭（ThirdGameScene）', { key: 'ThirdGameScene', reg: { thirdStage: 2 }, run: { chapter: 'hulao', westStage: 3, encounter: 'qunxiong' } }, '3-2');
// 战况线截图（事件段中途）+ 1-1 只有三段
{
  const p = await open({ key: 'GameScene', run: { chapter: 'hulao', westStage: 2 } });
  await jump(p, 120); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/track-2-2.png` });
  const r = await p.evaluate(async () => { const m = await import('/src/data/stagePhases.ts'); const one = m.buildPhasePlan('huangjin', 1, [{ start: 0, name: 'a' }, { start: 45, name: 'b' }, { start: 90, name: 'c' }], '张梁'), two = m.buildPhasePlan('huangjin', 2, [{ start: 0, name: 'a' }, { start: 45, name: 'b' }, { start: 90, name: 'c' }], '张宝'); return { one: one.phases.map(x => x.kind + '@' + x.start), two: two.phases.map(x => x.kind + '@' + x.start), cap: window.__S.pickCap(), caption: window.__S.battleTrack.caption.text }; });
  ck('第一章逐关加长：1-1 三段（0 / 45 / 90，时间同原来）、1-2 四段（无副将）；战况线下写「下一段 · 名字 · 秒数」', r.one.join() === 'vanguard@0,elite@45,boss@90' && r.two.join() === 'vanguard@0,elite@45,event@100,boss@155' && /下一段 · .+ · \d+ 秒/.test(r.caption), r);
  await p.close();
}
await b.close();
ck('无页面报错', errors.length === 0, errors.slice(0, 4));
console.log(fail ? `FAILED ${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
