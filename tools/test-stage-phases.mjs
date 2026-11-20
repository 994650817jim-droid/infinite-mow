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
const state = p => p.evaluate(() => { const s = window.__S, r = s.phaseRunner, t = s.battleTrack; return { phase: s.waveIndex, kinds: s.phasePlan?.phases.map(x => x.kind), starts: s.chapter.waves.map(w => w.start), pace: s.chapter.pace, bossHpMul: s.chapter.growth?.bossHp, cap: s.pickCap(), picks: s.picksGiven, run: r && { ...r.stats }, track: t && { ...t.stats, visible: t.root.visible, alpha: +t.root.alpha.toFixed(2) }, waveText: s.hudTexts.wave.visible, boss: s.bossSpawned, banners: window.__banners.slice(-6) }; });

async function stageCase(label, start, shot) {
  const p = await open(start);
  const a = await state(p);
  ck(`${label}：五段（先锋 / 精锐 / 事件 / 副将 / 首领），首领 205 秒登场；不显示「第 x 波」，顶部战况线；保底 5 次；首领生命按章节加倍（PHASES.bossHpMul，2-1 ≈ ×2.2）`, a.kinds?.join() === 'vanguard,elite,event,lieutenant,boss' && a.starts.join() === '0,45,100,155,205' && !a.waveText && a.track?.visible && a.cap === 5 && a.bossHpMul > 0, a);
  await jump(p, 46); const e = await state(p);
  ck(`${label}：精锐段——横幅写段落故事名（不带「第 x 波」）+「精锐来袭」，精锐小队压上，战况线点亮 2 个图标，保底补到 1`, e.phase === 1 && e.run.elites >= 2 && /精锐来袭/.test(e.banners.join()) && !/第 \d/.test(e.banners.join()) && e.track.iconsLit === 2 && e.picks >= 1, e);
  await jump(p, 101); const v = await state(p);
  ck(`${label}：事件段——伏兵一圈冲阵，保底 2`, v.phase === 2 && v.run.ambush >= 8 && v.picks >= 2 && /伏兵四起/.test(v.banners.join()), v);
  await jump(p, 156); await p.waitForTimeout(600); const l = await state(p);
  const bossHp = await p.evaluate(async () => { const s = window.__S, m = await import('/src/data/stagePhases.ts'); /* 副将按「参考首领生命」夹（去掉章节加倍、×bossRef，P6 平衡） */ return Math.round(s.chapter.enemies.boss.hp * s.chapter.growth.bossHp / m.PHASES.bossHpMul(s.phasePlan.chapter, s.phasePlan.phases.length) * m.PHASES.lieutenantHp.bossRef); });
  ck(`${label}：副将段——副将（名牌 + 小血条），生命为参考首领 35%–60%（精锐 ×3 夹在其间），保底 3`, l.phase === 3 && !!l.run.lieutenant && l.run.lieutenantHp / bossHp >= .33 && l.run.lieutenantHp / bossHp <= .62 && l.picks >= 3 && /副将出阵/.test(l.banners.join()), { ...l, bossHp });
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
// P2 战场机缘（stage-event-rewards.md）：刷在 600–900 外的可走处；地上「图标 + 名字 + 秒数」、屏外金色箭头、舆图军令小旗；各类事件奖励不同
{
  const p = await open({ key: 'GameScene', run: { chapter: 'hulao', westStage: 2 } });
  await jump(p, 66); await p.waitForTimeout(600);
  const c = await p.evaluate(() => { const s = window.__S, f = s.fortunes, L = f.live[0]; return { spawned: f.stats.spawned, dist: f.stats.dist[0], label: L?.label.text, icon: !!L?.icon, arrow: !!L?.arrow.visible, arrowText: L?.arrow.getByName('fa-text')?.text, order: !!s.battleOrders?.list?.get('fortune-cart'), banner: window.__banners.filter(b => /机缘 · /.test(b)).slice(-1)[0] }; });
  ck('P2 粮车：精锐段 20 秒后刷在远处（≥ 600 步）；横幅「机缘 · 敌军粮车出现」；地上图标 + 名字 + 剩余秒数；屏外金色箭头写距离；舆图军令小旗', c.spawned[0] === 'cart' && c.dist >= 600 && /敌军粮车 · \d+ 秒/.test(c.label ?? '') && c.icon && c.arrow && /粮车 · \d+ 步/.test(c.arrowText ?? '') && c.order && /机缘 · 敌军粮车出现/.test(c.banner ?? ''), c);
  await p.screenshot({ path: `${OUT}/fortune-far.png` });
  await p.evaluate(() => { const s = window.__S, L = s.fortunes.live[0]; s.player.sprite.setPosition(L.x + 50, L.y + 50); });
  await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/fortune-cart.png` });
  const food0 = await p.evaluate(() => ({ food: window.__S.legion.food, pouch: window.__S.supplies?.pouch.length ?? 0 }));
  await p.evaluate(() => { const s = window.__S, L = s.fortunes.live[0]; s.player.sprite.setPosition(L.x, L.y); });
  for (let i = 0; i < 30 && await p.evaluate(() => !window.__S.fortunes.stats.done.includes('cart')); i++) { await p.evaluate(() => { const s = window.__S; if (s.mode === 'levelup') s.chooseUpgrade(0); const L = s.fortunes.live.find(x => !x.done); if (L) s.player.sprite.setPosition(L.x, L.y); }); await p.waitForTimeout(250); }
  const cart = await p.evaluate(f0 => { const s = window.__S; return { done: s.fortunes.stats.done, food: s.legion.food - f0.food, pouch: (s.supplies?.pouch.length ?? 0) - f0.pouch, reward: s.fortunes.stats.rewards[0], arrowGone: !s.fortunes.live.some(L => !L.done && L.arrow.visible) }; }, food0);
  ck('P2 夺下粮车：随军粮 +（40 + 10 × 章）× 距离倍率、药囊 +1 回春丹；标记与箭头收起', cart.done.includes('cart') && cart.food >= 60 && (cart.pouch === 1 || /药囊已满/.test(cart.reward ?? '')) && cart.arrowGone, cart);
  const f0 = await p.evaluate(async () => { const s = window.__S, up = await import('/src/data/upgrades.ts'), ce = await import('/src/systems/CharmEffects.ts'); const hp0 = s.player.maxHp, packed0 = ce.statsWithoutCharms(s.player).maxHpBonus; up.foundationOptions()[0].apply(s.player); return { up: s.player.maxHp - hp0, packedDelta: ce.statsWithoutCharms(s.player).maxHpBonus - packed0, label: up.foundationOptions()[0].scope === 'stage' ? '本关有效' : '' }; });
  ck('P0 固本培元改为本关有效：当场生命上限 +12，征程构筑存档不带走（不再无限叠加）', f0.up === 12 && f0.packedDelta === 0 && /本关/.test(f0.label), f0);
  // 军械库：守军 + 站 4 秒 → 兵装
  await p.evaluate(() => window.__S.fortunes.force('armory')); await p.waitForTimeout(300);
  for (let i = 0; i < 40 && await p.evaluate(() => !window.__S.fortunes.stats.done.includes('armory')); i++) { await p.evaluate(() => { const s = window.__S; if (s.mode !== 'none') { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade(0); else s.setMode('none'); } const L = s.fortunes.live.find(x => !x.done && x.kind === 'armory'); if (L) { s.player.sprite.setPosition(L.x, L.y); for (const g of L.guards) if (g.e.active) { g.e.hp = 0; s.killEnemy(g.e); } } }); await p.waitForTimeout(250); }
  const ar = await p.evaluate(() => ({ done: window.__S.fortunes.stats.done, reward: window.__S.fortunes.stats.rewards.find(r => r.startsWith('armory')) }));
  ck('P2 军械库：击退守军、站满 4 秒 → 兵装一件', ar.done.includes('armory') && /兵装 · /.test(ar.reward ?? ''), ar);
  // 传令兵：靠近就逃，15 秒内追上 → 多一次军略三选一
  await p.evaluate(() => { window.__calm(); window.__S.fortunes.force('courier'); }); await p.waitForTimeout(300);
  const cr0 = await p.evaluate(() => { const s = window.__S, L = s.fortunes.live.find(x => x.kind === 'courier'); const x0 = L.x, y0 = L.y; s.player.sprite.setPosition(L.x + 300, L.y); return { x0, y0, pend: s.pendingLevels }; });
  await p.waitForTimeout(1200);
  const fled = await p.evaluate(c0 => { const L = window.__S.fortunes.live.find(x => x.kind === 'courier'); return { moved: Math.round(Math.hypot(L.x - c0.x0, L.y - c0.y0)), fleeing: L.fleeAt >= 0 }; }, cr0);
  for (let i = 0; i < 30 && await p.evaluate(() => !window.__S.fortunes.stats.done.includes('courier')); i++) { await p.evaluate(() => { const s = window.__S; if (s.mode !== 'none') { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade(0); else s.setMode('none'); } const L = s.fortunes.live.find(x => !x.done && x.kind === 'courier'); if (L) s.player.sprite.setPosition(L.x, L.y); }); await p.waitForTimeout(200); }
  const cr = await p.evaluate(() => ({ done: window.__S.fortunes.stats.done, reward: window.__S.fortunes.stats.rewards.find(r => r.startsWith('courier')) }));
  ck('P2 传令兵：看到你就往远处跑；追上截下 → 多一次军略三选一', fled.fleeing && fled.moved > 40 && cr.done.includes('courier') && /多一次军略三选一/.test(cr.reward ?? ''), { fled, cr });
  // 降将来投：走到身边 → 机缘三选一（本关增益，不带走）
  await p.evaluate(() => { window.__calm(); window.__S.fortunes.force('defector'); }); await p.waitForTimeout(300);
  for (let i = 0; i < 40 && await p.evaluate(() => window.__S.mode !== 'bossloot'); i++) { await p.evaluate(() => { const s = window.__S; if (s.mode === 'levelup') s.chooseUpgrade(0); const L = s.fortunes.live.find(x => !x.done && x.kind === 'defector'); if (L) s.player.sprite.setPosition(L.x, L.y); }); await p.waitForTimeout(250); }
  const panel = await p.evaluate(() => { const s = window.__S; return { mode: s.mode, title: s.levelPanel.getByName('upgrade-title')?.text, cards: s.upgradeOptions.map(o => o.name + '｜' + o.categoryLabel) }; });
  ck('P2 降将来投：受降 → 「战场机缘 · 受降」三选一（本关有效）', panel.mode === 'bossloot' && /战场机缘/.test(panel.title ?? '') && panel.cards.length === 3, panel);
  await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}/fortune-cards.png` });
  const pick = await p.evaluate(async () => { const s = window.__S, ce = await import('/src/systems/CharmEffects.ts'), before = { ...s.player.stats }, packed0 = ce.statsWithoutCharms(s.player); s.chooseUpgrade(0); const packed = ce.statsWithoutCharms(s.player); const keys = Object.keys(before).filter(k => before[k] !== s.player.stats[k]); return { mode: s.mode, changed: keys, packedSame: keys.every(k => Math.abs(packed[k] - packed0[k]) < 1e-6) }; });
  ck('P2 选了增益：属性当场变化，征程构筑存档时扣掉（不带到下一关）', pick.changed.length > 0 && pick.packedSame, pick);
  await p.close();
}
// P4 新卡池：五段主线关的升级三选一里，战法位按章节概率换成新卡（战场机缘 / 锦囊 / 兵源 / 军资 / 心法）；锦囊 R 键使用
{
  const p = await open({ key: 'GameScene', run: { chapter: 'hulao', westStage: 2 } });
  await p.evaluate(() => window.__calm());
  const d = await p.evaluate(() => { const s = window.__S, src = s.newCardSource(); const kinds = new Set(); for (let i = 0; i < 40; i++) for (const o of src.draw(3)) kinds.add(o.categoryLabel); return { chance: src.replaceChance, kinds: [...kinds] }; });
  ck('P4 新卡池：第二章战法位 20% 换新卡；抽得出战场机缘 / 锦囊 / 兵源 / 军资（心法要先学过该派战法）', d.chance === .2 && ['战场机缘', '锦囊', '兵源', '军资'].every(k => d.kinds.includes(k)), d);
  // 截图：把概率临时调到 1，弹一次升级三选一（三张里两张战法位都换成新卡）
  await p.evaluate(() => { const s = window.__S, ns = s.newCardSource.bind(s); s.newCardSource = () => ({ ...ns(), replaceChance: 1 }); s.pendingLevels += 1; s.militaryPending += 1; s.openUpgrade(); });
  await p.waitForTimeout(1200);
  const cards = await p.evaluate(() => window.__S.upgradeOptions.map(o => o.name + '｜' + o.categoryLabel));
  ck('P4 升级三选一出现新卡（战法位两张都换成新卡，类不重复）', cards.length === 3 && cards.filter(c => /战场机缘|锦囊|兵源|军资|心法|赌命|名将来投|悬赏/.test(c)).length >= 2 && new Set(cards.map(c => c.split('｜')[1])).size === 3, cards);
  await p.screenshot({ path: `${OUT}/new-cards.png` });
  await p.evaluate(() => { const s = window.__S; s.newCardSource = Object.getPrototypeOf(s).newCardSource.bind(s); s.chooseUpgrade(0); window.__calm(); });
  const r5 = await p.evaluate(async () => { const B = (await import('/src/data/builds.ts')).BuildState, bd = await import('/src/data/builds.ts'); const capNow = B.rankCap, caps = [2, 5, 9].map(B.rankCapFor); const t = Object.keys(bd.TACTICS).find(id => !bd.TACTICS[id].general && !bd.TACTICS[id].hidden && bd.TACTICS[id].tag); const b = new B(); for (let i = 0; i < 5; i++) b.learn(t); const at3 = b.rank(t); B.rankCap = 4; b.learn(t); b.learn(t); const r = { capNow, caps, at3, rank: b.rank(t), level: b.level(t), shi: b.tags()[bd.TACTICS[t].tag], snap: b.snapshot().tactics[t], desc: bd.tacticDescription(t, 4).split(String.fromCharCode(10))[0] }; B.rankCap = capNow; return r; });
  ck('P5 战法精研：第二章上限 Lv3，第五章 Lv4、第九章 Lv5；精研只加势（效果停在 Lv3），存档保留实际等级', r5.capNow === 3 && r5.caps.join() === '3,4,5' && r5.at3 === 3 && r5.rank === 4 && r5.level === 3 && r5.shi === 4 && r5.snap === 4 && /精研/.test(r5.desc), r5);
  await p.evaluate(() => { const s = window.__S; s.jinnang = 'drum'; s.paintJinnang(); });
  await p.waitForTimeout(300);
  const j0 = await p.evaluate(() => { const s = window.__S; return { shown: !!s.jinnangButton?.visible, caption: s.jinnangButton?.getByName('jinnang-caption')?.text, berserk: s.player.growth.berserkUntil > s.combatNow }; });
  await p.keyboard.press('r'); await p.waitForTimeout(300);
  const j1 = await p.evaluate(() => { const s = window.__S; return { held: s.jinnang, shown: !!s.jinnangButton?.visible, berserk: s.player.growth.berserkUntil > s.combatNow, banner: window.__banners.slice(-1)[0] }; });
  ck('P4 锦囊：右侧锦囊钮「锦囊 · 擂鼓」，R 键使用 → 10 秒狂战，钮收起', j0.shown && /擂鼓/.test(j0.caption ?? '') && !j0.berserk && j1.held === null && !j1.shown && j1.berserk && /锦囊 · 擂鼓/.test(j1.banner ?? ''), { j0, j1 });
  await p.close();
}
// P4b：更多新卡（名将来投 / 赌命 / 悬赏 / 信物 / 锦囊 8 种 / 乘胜追击）、按章权重、永久成长分章（武艺精熟、第 7 格）
{
  const p = await open({ key: 'GameScene', run: { chapter: 'hulao', westStage: 2 } });
  await p.evaluate(() => window.__calm());
  const w = await p.evaluate(async () => { const LC = await import('/src/systems/LevelCards.ts'), s = window.__S; const kinds = ch => { const set = new Set(); const plan = s.phasePlan, old = plan.chapter; plan.chapter = ch; const src = s.newCardSource(); for (let i = 0; i < 60; i++) for (const o of src.draw(3)) set.add(LC.newCardKind(o)); plan.chapter = old; return [...set]; }; return { ch2: kinds(2), ch9: kinds(9) }; });
  ck('P4b 按章权重：第二章不出名将来投 / 悬赏，第九章出得来名将来投 / 赌命 / 悬赏', !w.ch2.includes('general') && !w.ch2.includes('bounty') && ['general', 'gamble', 'bounty'].every(k => w.ch9.includes(k)), w);
  // 锦囊 8 种都能用
  const jn = await p.evaluate(async () => { const s = window.__S, out = {}; for (const id of ['ambush', 'gong', 'feint', 'drum', 'fire', 'empty', 'arrows', 'chain']) { s.jinnang = id; s.paintJinnang(); out[id] = s.useJinnang(); } return { out, invuln: s.player.invulnUntil > s.combatNow, arrows: s.arrows.until > s.combatNow, chain: s.chain.set.size, held: s.jinnang }; });
  ck('P4b 锦囊 8 种（伏兵 / 鸣金 / 疑兵 / 擂鼓 / 火计 / 空城计 / 草船借箭 / 连环计）都能用；空城计无敌、草船借箭计时、连环计连住敌兵', Object.values(jn.out).every(Boolean) && jn.invuln && jn.arrows && jn.held === null, jn);
  await p.evaluate(() => { window.__S.arrows.until = window.__S.combatNow + 50; }); await p.waitForTimeout(400);
  const ar = await p.evaluate(() => ({ banner: window.__banners.slice(-3).join(' / '), until: window.__S.arrows.until }));
  ck('P4b 草船借箭期满：放箭雨', ar.until === 0 && /草船借箭 · 箭雨/.test(ar.banner), ar);
  // 赌命：孤注一掷只在本关
  const gm = await p.evaluate(async () => { const s = window.__S, ce = await import('/src/systems/CharmEffects.ts'); const hp0 = s.player.maxHp, packed0 = JSON.stringify(ce.statsWithoutCharms(s.player)); s.takeGamble('allin'); s.takeGamble('beiwei'); return { hpDrop: hp0 - s.player.maxHp, packedSame: JSON.stringify(ce.statsWithoutCharms(s.player)) === packed0, desperate: s.player.growth.stageDesperate }; });
  ck('P4b 赌命：孤注一掷生命上限 −15%、伤害 +25%（征程构筑不带走）；背嵬生效', gm.hpDrop > 0 && gm.packedSame && gm.desperate > 0, gm);
  // 悬赏破锐：接下后击杀 8 名精锐 → 随军粮 +60
  const bt = await p.evaluate(() => { const s = window.__S, food0 = s.legion.food; s.bounties.elites = { elites: 0 }; for (let i = 0; i < 8; i++) { const e = s.spawnEnemy('elite', s.player.x + 200, s.player.y, 1, true); if (e) { e.hp = 0; s.killEnemy(e); } } return { food: s.legion.food - food0, banner: window.__banners.slice(-2).join(' / ') }; });
  ck('P4b 悬赏 · 破锐：击杀 8 名精锐 → 随军粮 +60（另含精锐自身掉粮）、信物一件', bt.food >= 60 && /破锐 达成/.test(bt.banner), bt);
  // 名将来投
  const gj = await p.evaluate(() => { const s = window.__S; s.generalJoins('孙坚', 7, 45000); const tag = s.children.getByName('general-tag'); return { tag: tag?.text, banner: window.__banners.slice(-1)[0] }; });
  ck('P4b 名将来投：一队义军 + 「来投 · 孙坚」名牌', /孙坚/.test(gj.tag ?? '') && /名将来投 · 孙坚/.test(gj.banner ?? ''), gj);
  // 首领宝箱那次：信物卡；换一批本关免费一次
  const ch = await p.evaluate(() => { const s = window.__S; s.chestPick = true; s.pendingLevels += 1; s.militaryPending += 1; s.openUpgrade(); const has = s.upgradeOptions.some(o => o.id === 'charm_card'); const btn = s.rerollButton?.text; s.chooseUpgrade(0); window.__calm(); return { has, btn }; });
  ck('P4b 首领宝箱那次三选一必有一张信物；换一批本关第一次免费', ch.has && /本关免费一次/.test(ch.btn ?? ''), ch);
  // 永久成长分章：武艺精熟、第 7 个战法格
  const pm = await p.evaluate(async () => { const RG = (await import('/src/systems/RunGrowth.ts')).RunGrowth, bd = await import('/src/data/builds.ts'), B = bd.BuildState; const g = new RG('zhaoyun'), id = 'dragon_gallop'; const caps = [5, 6, 10].map(RG.extraCapFor), slots = [5, 6].map(B.slotCapFor);
    for (let i = 0; i < 5; i++) g.learn(id); const at0 = { m: g.masteries[id], x: g.masteryExtra[id] ?? 0 }; const d0 = g.damageMultiplier(0); RG.extraCap = 1; g.learn(id); const d1 = g.damageMultiplier(0); RG.extraCap = 0;
    const b = new B(), ts = Object.keys(bd.TACTICS).filter(t => !bd.TACTICS[t].general && !bd.TACTICS[t].hidden && bd.TACTICS[t].tag); for (const t of ts.slice(0, 7)) b.learn(t); const six = b.slots(); B.slotCap = 7; b.learn(ts[6]); const seven = b.slots(); B.slotCap = 6;
    return { caps, slots, at0, rank: g.masteryRank(id), dmg: +(d1 / d0).toFixed(3), six, seven }; });
  ck('P4b 永久成长分章：武艺第六章精熟 Lv4、第十章 Lv5（每层全伤害 +4%）；第六章起第 7 个战法格', pm.caps.join() === '0,1,2' && pm.slots.join() === '6,7' && pm.at0.m === 3 && pm.at0.x === 0 && pm.rank === 4 && pm.dmg === 1.04 && pm.six === 6 && pm.seven === 7, pm);
  // 截图：第九章的三选一（新卡里有名将来投 / 赌命 / 悬赏）
  await p.evaluate(() => { const s = window.__S; s.phasePlan.chapter = 9; const ns = s.newCardSource.bind(s); s.newCardSource = () => ({ ...ns(), replaceChance: 1 }); s.pendingLevels += 1; s.militaryPending += 1; s.openUpgrade(); });
  await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}/new-cards-ch9.png` });
  await p.close();
}
// 兵器专职（wave-progression-redesign §4.7）：本命 Lv5 + 分支派 2 势 → 两张专职卡二选一；Lv6 / 7 沿分支加深；第一批 8 个分支在战斗里都会触发
{
  const p = await open({ key: 'GameScene', run: { chapter: 'hulao', westStage: 2 } });
  await p.evaluate(() => window.__calm());
  const ch = await p.evaluate(async () => { const s = window.__S, up = await import('/src/data/upgrades.ts'), bd = await import('/src/data/builds.ts'); const w = s.player.weapons[0]; w.level = 5; w.branch = undefined; w.over = 0;
    const b = s.player.growth.build; const cav = Object.keys(bd.TACTICS).filter(t => bd.TACTICS[t].tag === 'cavalry' && !bd.TACTICS[t].hidden); b.learn(cav[0]); b.learn(cav[0]);
    const opts = up.buildUpgradeOptions(s.player, s.player.weapons, s.player.growth); return { ids: opts.map(o => o.id), labels: opts.map(o => o.categoryLabel) }; });
  ck('专职卡：赵云本命 Lv5、骑突 2 势 → 三选一里两张「兵器专职 · 二选一」（龙胆 · 七进七出 / 百鸟朝凤）', ch.ids.includes('branch_zy_longdan') && ch.ids.includes('branch_zy_bainiao') && ch.labels.filter(l => /兵器专职/.test(l)).length === 2, ch);
  // 截图：专职二选一面板
  await p.evaluate(() => { const s = window.__S; s.pendingLevels += 1; s.militaryPending += 1; s.openUpgrade(); }); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/branch-choice.png` });
  const pick = await p.evaluate(async () => { const s = window.__S, i = s.upgradeOptions.findIndex(o => o.id === 'branch_zy_longdan'); s.chooseUpgrade(i); window.__calm(); const up = await import('/src/data/upgrades.ts'), wb = await import('/src/data/weaponBranches.ts'); wb.WEAPON_OVER.cap = 1; let over; for (let i = 0; i < 30 && !over; i++) over = up.buildUpgradeOptions(s.player, s.player.weapons, s.player.growth).find(o => o.id === 'weapon_over_6'); const d0 = s.player.growth.damageMultiplier(0); over?.apply(s.player, s.player.weapons, s.player.growth); s.tickBranch(); const d1 = s.player.growth.damageMultiplier(0); return { branch: s.player.weapons[0].branch, over6: !!over, overNow: s.player.weapons[0].over, dmg: +(d1 / d0).toFixed(2), level: s.player.weapons[0].level }; });
  ck('选「龙胆 · 七进七出」锁定；第四章起出本命 Lv.6（沿分支加深，伤害 +10%）；HUD 写分支名', pick.branch === 'zy_longdan' && pick.over6 && pick.overNow === 1 && pick.dmg === 1.1, pick);
  await p.close();
}
await b.close();
ck('无页面报错', errors.length === 0, errors.slice(0, 4));
console.log(fail ? `FAILED ${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
