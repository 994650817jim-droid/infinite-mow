// 守城重做（共享笔记 defense-redesign.md，用户 11-20「Approve defaults」）：守城战本身（systems/DefenseBattle）。
// 查：我方在城内（南）、城墙城门在北、府衙最南；按章节档（第四章 = 中档：4 波 + 冲车 / 云梯）；敌兵从墙外来、近战砍门、冲车撞门、云梯爬城；
// 城头弓手放箭；滚木 / 热油；喘息时不刷兵、布防花随军粮、Space 跳过；城门破了不算输、府衙被破才输；末波守满即胜；守城简报；迎击走短野战。
// 截图 assets/review/defense-battle/。用法：BASE=http://127.0.0.1:5241/ node tools/test-defense-battle.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/defense-battle'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 480) : '')); };
// 第三章打完（主线 9 关）→ 第四章 = 中档；陈留（中城）是我方城池、曹操来犯
const world = { version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 300, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: ['chenliu'], capturedEver: ['chenliu'], eraSeen: 2, chapterSeen: 4, tutorialDone: true, alerts: [{ city: 'chenliu', attacker: 'caocao', cause: 'era', countdown: 0 }] };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
async function open(mode = 'defense', q = '') {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(w => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'full'); localStorage.setItem('im_home_seen', '1'); sessionStorage.setItem('seeded', '1'); } }, world);
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop' + q);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
  await p.evaluate(m => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('siegeCity', 'chenliu'); g.registry.set('siegeMode', m); g.registry.set('runConfig', { character: 'zhaoyun' }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('SiegeGameScene'); }, mode);
  await p.waitForFunction(st => { const s = window.__game.scene.getScene('SiegeGameScene'); return s?.player && window.__game.scene.isActive('SiegeGameScene') && (st || s.elapsed > .5); }, q.includes('story=1'), { timeout: 120000 }); // 剧情开着时简报卷轴会停住关内时间
  await p.evaluate(() => { const s = window.__game.scene.getScene('SiegeGameScene'); window.__S = s; window.__D = s.defenseBattle; s.player.damageImmune = true;
    window.__calm = () => { for (let i = 0; i < 16 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'branch') s.chooseBranch?.(0); else if (s.mode === 'recruit') { s.chooseRecruit?.(0); s.__DEV_ACTIONS?.closePopup?.(); } else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } } }; window.__calm(); });
  return p;
}
const snap = p => p.evaluate(() => window.__D?.snapshot() ?? null);
const calm = async (p, ms = 400) => { for (let i = 0; i < Math.ceil(ms / 200); i++) { await p.evaluate(() => window.__calm()); await p.waitForTimeout(200); } };

// ① 布局与档位
{
  const p = await open(); await calm(p, 1500);
  const a = await p.evaluate(() => { const s = window.__S, d = window.__D, w = s.sishuiPass; return { name: s.chapter.name, waves: s.chapter.waves.map(x => x.start), wallLine: w?.wallLine, playerY: Math.round(s.player.y), keepY: d?.keepPos.y, gateOpen: w?.gateOpen, foot: w?.footprints.length, snap: d?.snapshot() }; });
  await p.screenshot({ path: OUT + '/defense-start.png' });
  ck('守城：城墙城门在北、主将在城内、府衙最南；第四章 = 中档 4 波（0/85/170/255，末波主将），城门关着、3 名城头弓手（中城）', a.snap && a.snap.waves === 4 && a.waves.join() === '0,85,170,255' && a.wallLine < a.playerY && a.keepY > a.playerY && a.gateOpen === false && a.snap.archers === 3 && a.foot > 2, a);
  await p.waitForTimeout(3000); await calm(p);
  const sp = await p.evaluate(() => { const s = window.__S, wl = s.sishuiPass.wallLine, en = s.enemies.filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss'); return { n: en.length, outside: en.filter(e => e.y < wl).length, shots: window.__D.snapshot().stats.archerShots }; });
  ck('敌兵从墙外（北面敌营）来；城头弓手在放箭', sp.n > 0 && sp.outside === sp.n && sp.shots > 0, sp);
  // 近战贴门砍门
  const g0 = (await snap(p)).gate;
  await p.evaluate(() => { const s = window.__S, d = window.__D; for (let i = 0; i < 4; i++) { const e = s.spawnEnemy('infantry', d.gatePos.x + (i - 2) * 30, d.gatePos.y - 60, 1, true); if (e) e.def = { ...e.def, hp: 9999 }; } });
  await p.waitForTimeout(2500); await calm(p);
  const g1 = (await snap(p)).gate;
  ck('城外近战贴着城门砍：城门耐久下降', g1 < g0, { g0, g1 });
  // 冲车 / 云梯
  await p.evaluate(() => { const d = window.__D; d.spawnRam(); d.spawnLadder(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => { const d = window.__D, g = d.engines.find(x => x.kind === 'ram'); if (g) { g.y = d.gatePos.y - 75; } });
  await p.waitForTimeout(6500); await calm(p); // 云梯：预警 2 秒 + 每 3.2 秒爬上一个
  const en = await snap(p);
  const climb = await p.evaluate(() => { const s = window.__S, wl = s.sishuiPass.wallLine; return s.enemies.filter(e => e.active && !e.isSupplySlot && e.y > wl).length; });
  await p.evaluate(() => { const s = window.__S, d = window.__D, g = d.engines.find(x => x.kind === 'ladder'); if (g) s.player.sprite.setPosition(g.x, s.sishuiPass.wallLine + 160); });
  await p.waitForTimeout(500); await p.screenshot({ path: OUT + '/defense-engines.png' });
  ck('冲车撞门、云梯立起后有人爬上城头（中档起才有）', en.stats.rams >= 1 && en.stats.ladders >= 1 && en.engines.includes('ram') && en.engines.includes('ladder') && en.stats.climbers >= 1 && climb >= 1, { stats: en.stats, engines: en.engines, climb });
  // 城防设施
  await p.evaluate(() => { const s = window.__S, f = window.__D.facilities; s.player.sprite.setPosition(f.logs.x, f.logs.y); }); await p.waitForTimeout(600);
  await p.evaluate(() => { const s = window.__S, f = window.__D.facilities; s.player.sprite.setPosition(f.oil.x, f.oil.y); }); await p.waitForTimeout(600);
  const fac = await snap(p);
  ck('站上城头滚木 / 热油位：自动放，次数各 −1', fac.stats.logs === 1 && fac.stats.oil === 1 && fac.charges.logs === 1 && fac.charges.oil === 1, { stats: fac.stats, charges: fac.charges });
  // 喘息 · 布防
  await p.evaluate(() => { const s = window.__S; s.elapsed = 71; s.legion.food = 200; }); await p.waitForTimeout(700); await calm(p);
  const r0 = await p.evaluate(() => { const s = window.__S, d = window.__D, ui = s.children.getByName('defense-prep'); return { phase: d.phase, resting: d.resting, ui: !!ui, gate: d.gate.hp }; });
  await p.screenshot({ path: OUT + '/defense-rest.png' });
  await p.evaluate(() => { const s = window.__S, ui = s.children.getByName('defense-prep'); ui.getByName('defense-prep-repair').emit('pointerup'); });
  const r1 = await p.evaluate(() => ({ gate: window.__D.gate.hp, food: window.__S.legion.food }));
  const n0 = await p.evaluate(() => window.__S.enemies.filter(e => e.active && !e.isSupplySlot).length); await p.waitForTimeout(1500); const n1 = await p.evaluate(() => window.__S.enemies.filter(e => e.active && !e.isSupplySlot).length);
  ck('喘息：出布防面板、不刷兵；「修城门」花 30 随军粮 +25%', r0.phase === 'rest' && r0.resting && r0.ui && r1.gate - r0.gate > 200 && r1.food < 200 && n1 <= n0, { r0, r1, n0, n1 });
  await p.keyboard.press('Space'); await p.waitForTimeout(500);
  ck('Space 跳过喘息 → 第 2 波攻城', await p.evaluate(() => window.__D.phase === 'attack' && window.__D.wave === 1 && !window.__S.children.getByName('defense-prep')), await snap(p));
  // 城门破：不算输，门洞可过
  await p.evaluate(() => { window.__D.gate.hp = 0; }); await p.waitForTimeout(500);
  const br = await p.evaluate(() => ({ open: window.__S.sishuiPass.gateOpen, over: window.__S.over }));
  ck('城门被破：门洞打开，不算输', br.open && !br.over, br);
  // 府衙被破才输
  await p.evaluate(() => { window.__D.keep.hp = 0; }); await p.waitForTimeout(600);
  const ls = await p.evaluate(() => ({ over: window.__S.over, mode: window.__S.mode, sub: window.__S.resultTexts?.subtitle.text }));
  ck('府衙被破：守城失利', ls.over && /失利/.test(ls.sub ?? ''), ls);
  await p.close();
}
// ② 末波守满即胜
{
  const p = await open(); await calm(p, 800);
  await p.evaluate(() => { window.__S.elapsed = 256; }); await p.waitForFunction(() => window.__S.boss?.active, null, { timeout: 10000 }).catch(() => {}); await calm(p, 600);
  const bs = await p.evaluate(() => ({ boss: !!window.__S.boss?.active, y: Math.round(window.__S.boss?.y ?? 0), wall: window.__S.sishuiPass.wallLine, phase: window.__D.phase }));
  await p.screenshot({ path: OUT + '/defense-boss.png' });
  ck('末波：攻城主将从墙外（北面）出阵', bs.boss && bs.y < bs.wall && bs.phase === 'final', bs);
  await p.evaluate(() => { window.__S.elapsed = 255 + 91; }); await p.waitForTimeout(800);
  const w = await p.evaluate(() => ({ over: window.__S.over, sub: window.__S.resultTexts?.subtitle.text, killed: window.__S.bossKilled }));
  ck('末波守满（攻城主将没打死也算）：守住了', w.over && w.killed && /守住/.test(w.sub ?? ''), w);
  await p.close();
}
// ③ 守城简报（?story=1）
{
  const p = await open('defense', '&story=1');
  await p.waitForFunction(() => !!window.__game.scene.getScene('SiegeGameScene').children.getByName('story-defense-brief'), null, { timeout: 15000 }).catch(() => {});
  const t = await p.evaluate(() => { const c = window.__game.scene.getScene('SiegeGameScene').children.getByName('story-defense-brief'); const out = []; const walk = o => { if (o.type === 'Text') out.push(o.text); (o.list ?? []).forEach(walk); }; if (c) walk(c); return out.join('|'); });
  await p.screenshot({ path: OUT + '/defense-brief.png' });
  ck('守城简报：「陈留告急」军情卷轴，斥候报来犯（曹操）', /陈留告急/.test(t) && /守城 · 军情/.test(t), t.slice(0, 200));
  await p.close();
}
// ④ 迎击：短野战，没有城墙守城那套
{
  const p = await open('intercept'); await calm(p, 600);
  const i = await p.evaluate(() => ({ name: window.__S.chapter.name, defend: !!window.__S.defenseBattle, waves: window.__S.chapter.waves.length }));
  ck('迎击：「迎击 · 陈留」三波短野战，不建城墙城门', /迎击 · 陈留/.test(i.name) && !i.defend && i.waves === 3, i);
  await p.close();
}
// ⑤ 小城平衡（11-20 夜间回归「小城无人防守约 50 秒破门」）：登城范围加成；无人防守时第 1 波（85 秒）城门还在
{
  const w2 = JSON.parse(JSON.stringify(world)); w2.ownedCities = ['shangdang']; w2.capturedEver = ['shangdang']; w2.alerts = [{ city: 'shangdang', attacker: 'caocao', cause: 'era', countdown: 0 }]; w2.warlordStages = 0;
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  await p.addInitScript(w => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, w2);
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
  await p.evaluate(() => { const g = window.__game; g.registry.set('siegeCity', 'shangdang'); g.registry.set('siegeMode', 'defense'); g.registry.set('runConfig', { character: 'zhaoyun' }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('SiegeGameScene'); });
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('SiegeGameScene'); return s?.player && s.elapsed > .5; }, null, { timeout: 120000 });
  const rp = await p.evaluate(async () => { const s = window.__game.scene.getScene('SiegeGameScene'), d = s.defenseBattle, wait = ms => new Promise(r => setTimeout(r, ms)); s.player.sprite.setPosition(d.gatePos.x + 200, d.gatePos.y + 60); await wait(400); const on = s.player.passive.rampartMul; s.player.sprite.setPosition(d.keepPos.x, d.keepPos.y + 150); await wait(400); return { on, off: s.player.passive.rampartMul }; });
  ck('登城：站上城头武器范围 ×1.2，下城恢复', rp.on === 1.2 && rp.off === 1, rp);
  await p.evaluate(() => { const s = window.__game.scene.getScene('SiegeGameScene'); window.__S = s; s.player.damageImmune = true; s.devTimeScale = 3; });
  let r = null; for (let i = 0; i < 80; i++) { await p.waitForTimeout(500); r = await p.evaluate(() => { const s = window.__S; if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade(0); else if (s.mode === 'branch') s.chooseBranch(0); else if (s.mode !== 'none' && !s.over) s.setMode('none'); const k = s.defenseBattle.keepPos; if (!s.over) s.player.sprite.setPosition(k.x + 300, k.y + 150); const d = s.defenseBattle.snapshot(); return { el: Math.round(s.elapsed), gate: d.gate, gateMax: d.gateMax, open: d.gateOpen, keep: d.keep, over: s.over }; }); if (r.el >= 86 || r.over) break; }
  ck('小城（上党）无人防守：第 1 波打完（85 秒）城门还在、府衙没挨打（原来约 50 秒就破门）', r && r.el >= 85 && !r.open && !r.over && r.keep === 1600, r);
  await p.close();
}
ck('无报错', !errors.length, errors.slice(0, 5));
await b.close();
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
