// 天下地图 W4：时局变化（时代推进面板、城池易主、势力覆灭）、告急（时代更替 / 攻城反扑）、守城战、
// 出征别处则告急城池失守、地图/主页/选关的失守警示。需要开发服务器 5173。用法：node tools/test-worldmap-w4.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/worldmap-w4';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
// warlordStages 3 → 时代二（公元198）；eraSeen 1 → 打开地图触发时局变化
const mk = (o = {}) => ({ version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 100, provisions: 200, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu'], ownedCities: ['xuchang', 'runan', 'guandu'], eraSeen: 1, capturedEver: ['xuchang', 'runan', 'guandu'], alerts: [], lastLost: [], ...o });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const M = "window.__game.scene.getScene('WorldMapScene')", G = "window.__game.scene.getScene('SiegeGameScene')";
const page = async (save, layout = 'mobile') => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
  return p;
};
const toMap = async p => { await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'WorldMapScene') s.scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(400); };
const store = (p, fn) => p.evaluate(async src => { const w = await import('/src/world/WorldStore.ts'); const c = await import('/src/world/WorldCities.ts'); return (0, eval)(src)(w, c); }, fn.toString());
const pick = (p, id) => p.evaluate(([M0, id]) => { const s = eval(M0); s.cityMarkers.find(m => m.city.id === id).hit.emit('pointerup', { getDistance: () => 0 }); return { detail: s.detail.text, action: s.action.text.text }; }, [M, id]);
const winSiege = async p => { await p.evaluate(G0 => { const s = eval(G0); s.spawnTimer = s.eliteTimer = 1e9; s.spawnBoss(); s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); }, G); for (let i = 0; i < 60; i++) { await p.waitForTimeout(150); if (await p.evaluate(G0 => { const s = eval(G0); for (let k = 0; k < 40 && (s.mode === 'levelup' || s.mode === 'bossloot'); k++) s.chooseUpgrade(0); s.collectBossChests?.(); /* 2026-11-17：升级三选一、首领宝箱 */ return s.over; }, G)) break; } await p.waitForTimeout(300); };

// —— 1. 存档逻辑（直接调用接口） ——
{
  const p = await page(mk({ eraSeen: 0 }));
  const r = await store(p, (w, c) => {
    const out = {};
    out.silent = w.advanceEra(); out.seen = w.loadWorld().eraSeen;
    // 回到时代一已看过，再推进
    const raw = JSON.parse(localStorage.getItem('im_world_v1')); raw.eraSeen = 1; localStorage.setItem('im_world_v1', JSON.stringify(raw)); localStorage.removeItem('im_world_backup_v1');
    w.setWorldRandom(() => .99);
    const a = w.advanceEra(); out.adv = a && { from: a.from, to: a.to, luoyang: a.changes.find(x => x.city === 'luoyang'), fallen: a.fallen, alerts: a.alerts, owned: a.changes.some(x => ['xuchang', 'runan', 'guandu'].includes(x.city)) };
    out.again = w.advanceEra(); out.alertsSaved = w.cityAlerts();
    // 守城：告急城可开，非告急城不可开
    const target = out.alertsSaved[0]?.city, other = ['xuchang', 'runan', 'guandu'].find(x => x !== target && !out.alertsSaved.some(a => a.city === x));
    out.badDefense = other ? w.beginDefense(other) : 'none';
    const id = w.beginDefense(target); const before = w.loadWorld();
    const d = w.settleDefense(id, { victory: true, bossKilled: true, debug: false, elapsed: 100, reward: { merits: 60, provisions: 120 } }); const after = w.loadWorld();
    out.defense = { held: d.held, grain: d.provisions, gain: after.provisions - before.provisions, alertGone: !after.alerts.some(a => a.city === target), owned: after.ownedCities.includes(target) };
    // 反扑：随机 0 → 必定告急；0.99 → 不告急
    w.setWorldRandom(() => 0); const s1 = w.beginSiege('wancheng', true); const r1 = w.settleSiege(s1, { victory: true, bossKilled: true, debug: false, elapsed: 120, reward: { merits: 60, provisions: 120 }, firstBonus: .5 });
    out.retaliation = r1.alert; out.attackerExpected = c.cityAttacker('wancheng', 2, w.loadWorld().ownedCities);
    // 告急时出征别处 → 失守
    const s2 = w.beginSiege('chenliu', true); const lost = w.loadWorld();
    out.lost = { owned: lost.ownedCities.includes('wancheng'), alerts: lost.alerts.length, lastLost: lost.lastLost };
    w.abandonExpedition(s2, []);
    out.notice = w.takeLostNotice(); out.notice2 = w.takeLostNotice();
    w.setWorldRandom(() => .99); const s3 = w.beginSiege('chenliu', true); const r3 = w.settleSiege(s3, { victory: true, bossKilled: true, debug: false, elapsed: 120, reward: { merits: 30, provisions: 60 }, firstBonus: .5 });
    out.noRetaliation = r3.alert;
    w.setWorldRandom();
    return out;
  });
  ck('eraSeen=0：静默记为当前时代（二），无时局面板', r.silent === null && r.seen === 2, { silent: r.silent, seen: r.seen });
  ck('时代一→二：洛阳 董卓→曹操、董卓/袁术覆灭、我方城池不在易主列表', r.adv?.from === 1 && r.adv?.to === 2 && r.adv.luoyang?.from === 'dongzhuo' && r.adv.luoyang?.to === 'caocao' && r.adv.fallen.includes('dongzhuo') && r.adv.fallen.includes('yuanshu') && !r.adv.owned, r.adv);
  ck('时代更替告急 1–3 城（random .99 → 3 城或全部边城），来犯者为大势力', r.adv?.alerts.length >= 1 && r.adv.alerts.length <= 3 && r.adv.alerts.every(a => a.cause === 'era' && !['han', 'yellow', 'player'].includes(a.attacker)), r.adv?.alerts);
  ck('同一时代再开地图不再触发', r.again === null);
  ck('非告急城池不能守城', r.badDefense === '' || r.badDefense === 'none', r.badDefense);
  ck('守城胜利：告急解除、城池仍在、发军粮（军功已并入军粮，2026-11-17）', r.defense.held && r.defense.alertGone && r.defense.owned && r.defense.grain > 0 && r.defense.gain === r.defense.grain, r.defense);
  ck('攻城反扑：random 0 → 宛城告急，来犯者=相邻最强大势力', r.retaliation?.city === 'wancheng' && r.retaliation.cause === 'retaliation' && r.retaliation.attacker === r.attackerExpected, { got: r.retaliation, expected: r.attackerExpected });
  ck('告急时出征别处：宛城失守、告急清空、记录失守', !r.lost.owned && r.lost.alerts === 0 && r.lost.lastLost.includes('wancheng'), r.lost);
  ck('失守提示只读一次', r.notice.includes('wancheng') && r.notice2.length === 0, { n1: r.notice, n2: r.notice2 });
  ck('random .99 → 不反扑', !r.noRetaliation, r.noRetaliation);
  await p.close();
}

// —— 2. 地图：时局变化面板、告急标记、守城战 ——
{
  const p = await page(mk());
  await toMap(p);
  const modal = await p.evaluate(M0 => { const s = eval(M0), m = s.children.getByName('era-modal'); return m && m.list.filter(o => o.type === 'Text').map(o => o.text).join('\n'); }, M);
  ck('打开地图：时局变化面板（公元198年 · 群雄割据、易主、覆灭、告急）', !!modal && modal.includes('时局变化 · 公元198年') && modal.includes('群雄割据') && modal.includes('城池易主') && modal.includes('势力覆灭') && modal.includes('边城告急'), modal);
  await p.screenshot({ path: `${out}/mobile-era-change.png` });
  await p.evaluate(M0 => eval(M0).children.getByName('era-modal').getByName('era-ok').emit('pointerup'), M);
  ck('「知道了」关闭面板', await p.evaluate(M0 => !eval(M0).children.getByName('era-modal'), M));
  const alerts = await store(p, w => w.cityAlerts());
  const target = alerts[0].city;
  const marks = await p.evaluate(([M0, ids]) => { const s = eval(M0); return ids.map(id => !!s.cityMarkers.find(m => m.city.id === id).root.getByName('alert-' + id)); }, [M, alerts.map(a => a.city)]);
  ck('告急城池有红环与「告急」标记', marks.length > 0 && marks.every(Boolean), { alerts, marks });
  const card = await pick(p, target);
  ck('告急城池信息卡：“告急：X来犯”，按钮「守城 · 选择武将」', card.detail.includes('来犯') && card.action === '守城 · 选择武将', card);
  await p.screenshot({ path: `${out}/mobile-alert-card.png` });
  // 可攻城池：攻城面板带失守警示
  const warn = await p.evaluate(M0 => { const s = eval(M0); const c = s.cityMarkers.find(m => m.city.id === 'chenliu') ?? s.cityMarkers.find(m => s.owned.length && !s.owned.includes(m.city.id)); c.hit.emit('pointerup', { getDistance: () => 0 }); const detail = s.detail.text; s.action.image.emit('pointerup'); const modal = s.children.getByName('siege-modal'); const w = modal?.getByName('siege-warning')?.text; return { detail, w, open: !!modal }; }, M);
  ck('攻城面板与信息卡均有“出征别处将失守”警示', warn.open && warn.w?.includes('将失守') && warn.detail.includes('将失守'), warn);
  await p.screenshot({ path: `${out}/mobile-siege-warning.png` });
  await p.evaluate(M0 => eval(M0).children.getByName('siege-modal').getByName('siege-cancel').emit('pointerup'), M);
  // 战役节点信息也有警示
  const node = await p.evaluate(M0 => { const s = eval(M0); const m = s.markers.find(x => x.node.campaign || x.node.chapter); m.root.list[0].emit('pointerup', { getDistance: () => 0 }); return s.detail.text; }, M);
  ck('战役节点信息卡有失守警示', node.includes('将失守'), node);
  // 守城面板 → 出征守城
  await pick(p, target);
  const dm = await p.evaluate(M0 => { const s = eval(M0); s.action.image.emit('pointerup'); const m = s.children.getByName('siege-modal'); return { texts: m.list.filter(o => o.type === 'Text').map(o => o.text).join('|'), warn: !!m.getByName('siege-warning') }; }, M);
  ck('守城面板：标题「守卫」、来犯势力、奖励减半、无失守警示', dm.texts.includes('守卫') && dm.texts.includes('来犯') && dm.texts.includes('守城奖励') && dm.texts.includes('出征守城') && !dm.warn, dm);
  await p.screenshot({ path: `${out}/mobile-defense-modal.png` });
  await p.evaluate(M0 => eval(M0).children.getByName('siege-modal').getByName('siege-go').emit('pointerup'), M);
  await p.waitForFunction(() => window.__game.scene.getScene('SiegeGameScene')?.player && window.__game.scene.isActive('SiegeGameScene'), null, { timeout: 20000 }); await p.waitForTimeout(500);
  const bat = await p.evaluate(G0 => { const s = eval(G0); return { name: s.chapter.name, boss: s.chapter.bossName, defense: s.defense, gate: !!s.gate, active: window.__game.scene.getScene('SiegeGameScene').registry.get('siegeMode') }; }, G);
  ck('守城战：章节名「守城 · 城名」、敌将为来犯势力、无城门', bat.name.startsWith('守城 · ') && bat.defense && !bat.gate && bat.active === 'defense', bat);
  const w0 = await store(p, w => w.loadWorld());
  ck('守城出征不触发失守', w0.ownedCities.length === 3 && w0.alerts.some(a => a.city === target), { owned: w0.ownedCities, alerts: w0.alerts });
  await p.screenshot({ path: `${out}/mobile-defense-battle.png` });
  await winSiege(p);
  const res = await p.evaluate(G0 => ({ sub: eval(G0).resultTexts.subtitle.text, body: eval(G0).resultTexts.body.text }), G);
  const w1 = await store(p, w => w.loadWorld());
  ck('守城胜利：结算“守住了 · 告急解除”，告急移除', res.sub.includes('守住了') && !w1.alerts.some(a => a.city === target) && w1.ownedCities.includes(target), { res: res.sub, alerts: w1.alerts });
  await p.screenshot({ path: `${out}/mobile-defense-result.png` });
  await p.evaluate(G0 => eval(G0).resultPanel.getByName('result-home').emit('pointerdown'), G);
  await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(300);
  ck('返回地图：不再弹时局面板，该城无告急标记', await p.evaluate(([M0, id]) => { const s = eval(M0); return !s.children.getByName('era-modal') && !s.cityMarkers.find(m => m.city.id === id).root.getByName('alert-' + id); }, [M, target]));
  ck('攻城模式标记已清除（下次攻城为普通攻城）', await p.evaluate(M0 => { const s = eval(M0); s.cityMarkers.find(m => m.city.id === 'chenliu').hit.emit('pointerup', { getDistance: () => 0 }); s.action.image.emit('pointerup'); s.children.getByName('siege-modal').getByName('siege-go').emit('pointerup'); return s.registry.get('siegeMode') === undefined; }, M));
  await p.close();
}

// —— 3. 失守：带告急去打别处，回地图看到失守提示；主页与选关警示 ——
{
  const p = await page(mk({ eraSeen: 2, alerts: [{ city: 'runan', attacker: 'caocao', cause: 'era' }] }));
  const home = await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName('home-alert-warning')?.text);
  ck('主页出征按钮上方有失守警示', !!home && home.includes('汝南') && home.includes('将失守'), home);
  await p.screenshot({ path: `${out}/mobile-home-warning.png` });
  await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('ThirdChapterScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('ThirdChapterScene')); await p.waitForTimeout(300);
  const ch = await p.evaluate(() => window.__game.scene.getScene('ThirdChapterScene').children.getByName('chapter-alert-warning')?.text);
  ck('第三章选关有失守警示', !!ch && ch.includes('汝南'), ch);
  await p.screenshot({ path: `${out}/mobile-chapter-warning.png` });
  await p.evaluate(() => { window.__game.scene.getScene('ThirdChapterScene').scene.start('GuanduChapterScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('GuanduChapterScene')); await p.waitForTimeout(300);
  ck('第四章选关有失守警示', !!(await p.evaluate(() => window.__game.scene.getScene('GuanduChapterScene').children.getByName('chapter-alert-warning'))));
  await toMap(p);
  ck('无时代推进时不弹时局面板', await p.evaluate(M0 => !eval(M0).children.getByName('era-modal'), M));
  // 出征攻城（非守城）→ 汝南失守
  await p.evaluate(M0 => { const s = eval(M0); s.cityMarkers.find(m => m.city.id === 'chenliu').hit.emit('pointerup', { getDistance: () => 0 }); s.action.image.emit('pointerup'); s.children.getByName('siege-modal').getByName('siege-go').emit('pointerup'); }, M);
  await p.waitForFunction(() => window.__game.scene.getScene('SiegeGameScene')?.player && window.__game.scene.isActive('SiegeGameScene'), null, { timeout: 20000 }); await p.waitForTimeout(300);
  const w = await store(p, w => w.loadWorld());
  ck('出征攻城后汝南失守', !w.ownedCities.includes('runan') && w.alerts.length === 0, { owned: w.ownedCities });
  await p.evaluate(G0 => { const s = eval(G0); s.elapsed = 10; s.finish(false, 'death'); }, G); await p.waitForTimeout(200);
  await p.evaluate(G0 => eval(G0).resultPanel.getByName('result-home').emit('pointerdown'), G);
  await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(300);
  const lost = await p.evaluate(M0 => { const m = eval(M0).children.getByName('era-modal'); return m?.list.filter(o => o.type === 'Text').map(o => o.text).join('|'); }, M);
  ck('回地图：失守提示“汝南已失守”', !!lost && lost.includes('城池失守') && lost.includes('汝南已失守'), lost);
  await p.screenshot({ path: `${out}/mobile-lost-notice.png` });
  ck('汝南恢复为时代原主（地方豪强）且可再攻打', await p.evaluate(M0 => { const s = eval(M0); s.children.getByName('era-modal')?.getByName('era-ok').emit('pointerup'); s.cityMarkers.find(m => m.city.id === 'runan').hit.emit('pointerup', { getDistance: () => 0 }); return s.detail.text.includes('归属：地方豪强') && s.action.text.text === '攻城 · 选择武将'; }, M));
  await p.close();
}
// —— 4. 电脑：时局面板与守城面板 ——
{
  const p = await page(mk(), 'desktop');
  await toMap(p);
  ck('电脑：时局面板显示', await p.evaluate(M0 => !!eval(M0).children.getByName('era-modal'), M));
  await p.screenshot({ path: `${out}/desktop-era-change.png` });
  await p.evaluate(M0 => eval(M0).children.getByName('era-modal').getByName('era-ok').emit('pointerup'), M);
  const t = (await store(p, w => w.cityAlerts()))[0].city; await pick(p, t);
  await p.evaluate(M0 => eval(M0).action.image.emit('pointerup'), M);
  await p.screenshot({ path: `${out}/desktop-defense-modal.png` });
  ck('电脑：守城面板显示', await p.evaluate(M0 => !!eval(M0).children.getByName('siege-modal'), M));
  await p.close();
}
ck('无 pageerror', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
