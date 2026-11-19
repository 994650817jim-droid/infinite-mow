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
// P2 战场机缘：精锐段 20 秒后出粮车（地上圈 + 道具 + 军令箭头），站满 3 秒弹「战场机缘 · 本关有效」三选一；选了只改本关（征程构筑存档扣掉）；事件段再来一次
{
  const p = await open({ key: 'GameScene', run: { chapter: 'hulao', westStage: 2 } });
  await jump(p, 66); await p.waitForTimeout(500);
  const c = await p.evaluate(() => { const s = window.__S, f = s.fortunes, L = f.live[0]; return { spawned: f.stats.spawned, at: L && { x: Math.round(L.x - s.player.x), y: Math.round(L.y - s.player.y) }, label: L?.label.text, props: L?.props.length, order: !!s.battleOrders?.list?.get('fortune-cart') }; });
  ck('P2 粮车：精锐段 20 秒后出现（地上圈 + 粮车道具 + 提示），军令表挂「机缘 · 敌军粮车」', c.spawned[0] === 'cart' && /敌军粮车/.test(c.label ?? '') && c.props >= 1 && c.order, c);
  await p.evaluate(() => { const s = window.__S, L = s.fortunes.live[0]; s.player.sprite.setPosition(L.x + 60, L.y + 60); });
  await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/fortune-cart.png` });
  await p.evaluate(() => { const s = window.__S, L = s.fortunes.live[0]; s.player.sprite.setPosition(L.x, L.y); });
  await p.waitForFunction(() => window.__S.mode === 'bossloot' || window.__S.mode === 'levelup', null, { timeout: 15000 }).catch(() => {});
  for (let i = 0; i < 6 && await p.evaluate(() => window.__S.mode === 'levelup'); i++) { await p.evaluate(() => window.__S.chooseUpgrade(0)); await p.waitForTimeout(300); }
  await p.waitForFunction(() => window.__S.mode === 'bossloot', null, { timeout: 8000 }).catch(() => {});
  const panel = await p.evaluate(() => { const s = window.__S; return { mode: s.mode, done: s.fortunes.stats.done, title: s.levelPanel.getByName('upgrade-title')?.text, cards: s.upgradeOptions.map(o => o.name + '｜' + o.categoryLabel) }; });
  ck('P2 站满 3 秒夺下粮车 → 「战场机缘 · 夺下粮车」三选一，三张都是本关有效增益', panel.mode === 'bossloot' && panel.done.includes('cart') && /战场机缘/.test(panel.title ?? '') && panel.cards.length === 3 && panel.cards.every(x => /本关有效/.test(x)), panel);
  await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}/fortune-cards.png` });
  const pick = await p.evaluate(async () => { const s = window.__S, before = { ...s.player.stats }; const o = s.upgradeOptions[0]; s.chooseUpgrade(0); const ce = await import('/src/systems/CharmEffects.ts'); const packed = ce.statsWithoutCharms(s.player); const keys = Object.keys(before).filter(k => before[k] !== s.player.stats[k]); return { name: o.name, mode: s.mode, changed: keys, packedSame: keys.every(k => Math.abs(packed[k] - before[k]) < 1e-6), taken: s.fortuneTaken }; });
  ck('P2 选了增益：属性当场变化，征程构筑存档时扣掉（不带到下一关），回到战斗', pick.mode === 'none' && pick.changed.length > 0 && pick.packedSame && Object.values(pick.taken)[0] === 1, pick);
  const f0 = await p.evaluate(async () => { const s = window.__S, up = await import('/src/data/upgrades.ts'), ce = await import('/src/systems/CharmEffects.ts'); const hp0 = s.player.maxHp, packed0 = ce.statsWithoutCharms(s.player).maxHpBonus; up.foundationOptions()[0].apply(s.player); return { up: s.player.maxHp - hp0, packedDelta: ce.statsWithoutCharms(s.player).maxHpBonus - packed0, label: up.foundationOptions()[0].categoryLabel }; });
  ck('P0 固本培元改为本关有效：当场生命上限 +12，征程构筑存档不带走（不再无限叠加）', f0.up === 12 && f0.packedDelta === 0 && /本关/.test(f0.label), f0);
  await jump(p, 109); await p.waitForTimeout(500);
  const ev = await p.evaluate(() => { const s = window.__S, f = s.fortunes, L = f.live.find(x => !x.done); return { spawned: f.stats.spawned, kind: L?.kind, label: L?.label.text }; });
  ck('P2 事件段 8 秒后再来一次机缘（义军被围 / 降将来投 / 烽燧之一）', ev.spawned.length === 2 && ['rescue', 'defector', 'beacon'].includes(ev.kind), ev);
  await p.evaluate(() => { const s = window.__S, L = s.fortunes.live.find(x => !x.done); s.player.sprite.setPosition(L.x, L.y); if (L.kind === 'rescue') for (const g of L.guards) { g.e.hp = 0; s.killEnemy(g.e); } });
  for (let i = 0; i < 40 && await p.evaluate(() => window.__S.mode !== 'bossloot'); i++) { await p.evaluate(() => { const s = window.__S; if (s.mode === 'levelup') s.chooseUpgrade(0); const L = s.fortunes.live.find(x => !x.done); if (L) s.player.sprite.setPosition(L.x, L.y); }); await p.waitForTimeout(300); }
  const e2 = await p.evaluate(() => { const s = window.__S; return { mode: s.mode, done: s.fortunes.stats.done, title: s.levelPanel.getByName('upgrade-title')?.text }; });
  ck('P2 完成第二次机缘 → 再弹一次机缘三选一', e2.mode === 'bossloot' && e2.done.length === 2, e2);
  await p.close();
}
// P4 新卡池：五段主线关的升级三选一里，战法位按章节概率换成新卡（战场机缘 / 锦囊 / 兵源 / 军资 / 心法）；锦囊 R 键使用
{
  const p = await open({ key: 'GameScene', run: { chapter: 'hulao', westStage: 2 } });
  await p.evaluate(() => window.__calm());
  const d = await p.evaluate(() => { const s = window.__S, src = s.newCardSource(); const kinds = new Set(); for (let i = 0; i < 40; i++) for (const o of src.draw(3)) kinds.add(o.categoryLabel); return { chance: src.replaceChance, kinds: [...kinds] }; });
  ck('P4 新卡池：第二章战法位 20% 换新卡；抽得出战场机缘 / 锦囊 / 兵源 / 军资（心法要先学过该派战法）', d.chance === .2 && ['战场机缘 · 本关有效', '锦囊 · 一次性', '兵源 · 本关', '军资 · 立即'].every(k => d.kinds.includes(k)), d);
  // 截图：把概率临时调到 1，弹一次升级三选一（三张里两张战法位都换成新卡）
  await p.evaluate(() => { const s = window.__S, ns = s.newCardSource.bind(s); s.newCardSource = () => ({ ...ns(), replaceChance: 1 }); s.pendingLevels += 1; s.militaryPending += 1; s.openUpgrade(); });
  await p.waitForTimeout(1200);
  const cards = await p.evaluate(() => window.__S.upgradeOptions.map(o => o.name + '｜' + o.categoryLabel));
  ck('P4 升级三选一出现新卡（战法位两张都换成新卡，类不重复）', cards.length === 3 && cards.filter(c => /战场机缘|锦囊|兵源|军资|心法/.test(c)).length >= 2 && new Set(cards.map(c => c.split('｜')[1])).size === 3, cards);
  await p.screenshot({ path: `${OUT}/new-cards.png` });
  await p.evaluate(() => { const s = window.__S; s.newCardSource = Object.getPrototypeOf(s).newCardSource.bind(s); s.chooseUpgrade(0); window.__calm(); });
  await p.evaluate(() => { const s = window.__S; s.jinnang = 'drum'; s.paintJinnang(); });
  await p.waitForTimeout(300);
  const j0 = await p.evaluate(() => { const s = window.__S; return { shown: !!s.jinnangButton?.visible, caption: s.jinnangButton?.getByName('jinnang-caption')?.text, berserk: s.player.growth.berserkUntil > s.combatNow }; });
  await p.keyboard.press('r'); await p.waitForTimeout(300);
  const j1 = await p.evaluate(() => { const s = window.__S; return { held: s.jinnang, shown: !!s.jinnangButton?.visible, berserk: s.player.growth.berserkUntil > s.combatNow, banner: window.__banners.slice(-1)[0] }; });
  ck('P4 锦囊：右侧锦囊钮「锦囊 · 擂鼓」，R 键使用 → 10 秒狂战，钮收起', j0.shown && /擂鼓/.test(j0.caption ?? '') && !j0.berserk && j1.held === null && !j1.shown && j1.berserk && /锦囊 · 擂鼓/.test(j1.banner ?? ''), { j0, j1 });
  await p.close();
}
await b.close();
ck('无页面报错', errors.length === 0, errors.slice(0, 4));
console.log(fail ? `FAILED ${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
