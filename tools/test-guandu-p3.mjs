// 第四章 P3：4-3 乌巢焚粮（三座粮仓、军心×3）、淳于琼三技能、首领在场焚仓“军心动摇”、4-2→休整→4-3 跨关、
// 章节通关（guanduStages=3、返回地图）、选关全部告捷、战役回顾 12/12。需要开发服务器 5173。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/guandu-p3';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const save = { version: 6, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 1, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 100, provisions: 200, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu'] };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GuanduGameScene')";
const win = async (p, until) => { await p.evaluate(G0 => { const s = eval(G0); s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); }, G); for (let i = 0; i < 60; i++) { await p.waitForTimeout(150); const ok = await p.evaluate(([G0, u]) => { const s = eval(G0); for (let k = 0; k < 40 && (s.mode === 'levelup' || s.mode === 'bossloot'); k++) s.chooseUpgrade(0); s.collectBossChests?.(); /* 2026-11-17：升级三选一、首领宝箱 */ return u === 'rest' ? s.mode === 'rest' : s.over; }, [G, until]); if (ok) break; } await p.waitForTimeout(300); };
for (const layout of ['mobile', 'desktop']) {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'huangzhong'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'));
  await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('GuanduChapterScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('GuanduChapterScene')); await p.waitForTimeout(200);
  const sel = await p.evaluate(() => { const s = window.__game.scene.getScene('GuanduChapterScene'); return { selected: s.selected, status: s.cards.map(c => c.status.text) }; });
  ck(layout + ' 选关默认 4-2（4-3 待前关）', sel.selected === 2 && sel.status[0] === '✓ 已告捷' && sel.status[2] === '锁定 · 完成前关', sel);
  await p.evaluate(() => window.__game.scene.getScene('GuanduChapterScene').children.getByName('guandu-deploy').emit('pointerup'));
  await p.waitForFunction(() => window.__game.scene.getScene('GuanduGameScene')?.depots, null, { timeout: 15000 }); await p.waitForTimeout(400);
  // 4-2 胜利 → 休整 → 4-3
  await p.evaluate(G0 => { const s = eval(G0); s.spawnTimer = s.eliteTimer = 1e9; s.player.weapons[0].level = 4; s.spawnBoss(); }, G);
  await win(p, 'rest');
  ck(layout + ' 4-2 告捷进入军帐休整', await p.evaluate(G0 => eval(G0).mode === 'rest', G));
  await p.evaluate(G0 => { const s = eval(G0); window.__old = s.player; s.continueCampaign(); }, G);
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GuanduGameScene'); return s?.player && s.player !== window.__old && s.depots; }, null, { timeout: 15000 }); await p.waitForTimeout(400);
  const s3 = await p.evaluate(G0 => { const s = eval(G0), d = s.depots; return { stage: s.guanduStage, name: s.chapter.name, weapon: s.player.weapons[0].level, hero: s.runConfig.character, granaries: d.total, frames: d.depots.map(x => x.point.frame), hp: d.depots.map(x => x.enemy.maxHp), mul: +d.moraleMultiplier.toFixed(2), camps: s.enemyCamps.camps.map(c => c.point.name) }; }, G);
  ck(layout + ' 进入 4-3 乌巢焚粮（黄忠，继承武器 Lv4）', s3.stage === 3 && s3.name === '4-3 乌巢焚粮' && s3.weapon >= 4 /* 升级三选一可能再升武器 */ && s3.hero === 'huangzhong', s3);
  ck(layout + ' 三座乌巢粮仓（220 血），军心×3（×0.64），两座敌营', s3.granaries === 3 && s3.frames.every(f => f === 1) && s3.hp.every(h => h === 220) && s3.mul === .64 && s3.camps.join() === '乌巢亲军营,守粮弓营', s3);
  await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${layout}-43-night.png` });
  // 淳于琼三技能
  const c = await p.evaluate(G0 => {
    const s = eval(G0); s.spawnTimer = s.eliteTimer = 1e9; s.spawnBoss(); const c = s.controller, b = s.boss; let now = s.combatNow;
    const step = ms => { for (let t = 0; t < ms; t += 16) { now += 16; c.update(.016, now); } };
    b.sprite.setPosition(s.player.x + 150, s.player.y); const before = s.enemies.filter(e => e.active && e.kind === 'shield').length;
    const labels = new Set();
    for (const k of [0, 1, 2]) { c.index = k; c.forceSkill(now); labels.add(c.label.replace(/^预警 · /, '')); step(2600); }
    const guards = s.enemies.filter(e => e.active && e.kind === 'shield').length - before;
    return { m: { ...c.metrics }, guards, labels: [...labels], inc: +c.incoming(false).toFixed(2) };
  }, G);
  ck(layout + ' 淳于琼守粮阵、弓阵齐射、霹雳车投石都释放', c.m.guard === 1 && c.m.arrows === 1 && c.m.catapult === 1, c.m);
  ck(layout + ' 守粮阵召出 4 名刀盾护卫', c.guards >= 4, c.guards);
  ck(layout + ' 弓阵/投石造成实际伤害', c.m.damage > 0, c.m.damage);
  ck(layout + ' 技能名与军心×3', ['守粮阵', '弓阵齐射', '霹雳车投石'].every(n => c.labels.some(l => l.startsWith(n))) && c.labels.every(l => l.includes('军心×3')) && c.inc === .64, c);
  // 首领在场时焚仓 → 军心动摇
  const shake = await p.evaluate(G0 => {
    const s = eval(G0), c = s.controller, d = s.depots; let now = s.combatNow; c.index = 2; c.forceSkill(now); const warn = c.state;
    s.hitEnemy(d.depots[0].enemy, 1e4, s.combatNow, 'melee');
    const after = { state: c.state, label: c.label, shaken: c.metrics.shaken, zones: c.zones.length, mul: +d.moraleMultiplier.toFixed(2), inc: +c.incoming(false).toFixed(2) };
    for (let t = 0; t < 1400; t += 16) { now += 16; c.update(.016, now); } const mid = c.state;
    for (let t = 0; t < 300; t += 16) { now += 16; c.update(.016, now); }
    return { warn, after, mid, end: c.state };
  }, G);
  ck(layout + ' 焚仓打断招式：军心动摇僵直 1.5 秒', shake.warn === 'warn' && shake.after.state === 'recover' && shake.after.shaken === 1 && shake.after.zones === 0 && shake.after.label.startsWith('军心动摇') && shake.mid === 'recover' && shake.end === 'approach', shake);
  ck(layout + ' 焚仓后军心×2（受伤 ×0.76）', shake.after.mul === .76 && shake.after.inc === .76, shake.after);
  await p.evaluate(G0 => { const s = eval(G0); s.controller.index = 2; s.controller.forceSkill(s.combatNow); }, G);
  await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${layout}-43-catapult.png` });
  // 章节通关
  await win(p, 'over');
  const end = await p.evaluate(async G0 => { const s = eval(G0), w = await import('/src/world/WorldStore.ts'), v = w.loadWorld(); return { victory: s.victory, mode: s.mode, sub: s.resultTexts.subtitle.text, home: s.resultPanel.getByName('result-home')?.text, guandu: v.guanduStages, state: v.active?.state }; }, G);
  ck(layout + ' 4-3 胜利：官渡告捷，guanduStages=3，返回地图', end.victory && end.mode !== 'rest' && end.guandu === 3 && end.state === 'settled' && end.sub === '袁军溃败 · 官渡告捷' && end.home === '返回天下地图', end);
  await p.screenshot({ path: `${out}/${layout}-43-result.png` });
  await p.evaluate(G0 => eval(G0).resultPanel.getByName('result-home').emit('pointerdown'), G);
  await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'));
  await p.evaluate(() => { window.__game.scene.getScene('WorldMapScene').scene.start('GuanduChapterScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('GuanduChapterScene')); await p.waitForTimeout(200);
  const allDone = await p.evaluate(() => window.__game.scene.getScene('GuanduChapterScene').cards.map(c => c.status.text));
  ck(layout + ' 选关三关全部已告捷', allDone.every(t => t === '✓ 已告捷'), allDone);
  await p.evaluate(() => { window.__game.scene.getScene('GuanduChapterScene').scene.start('MenuScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('MenuScene')); await p.waitForTimeout(400);
  await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName('home-review').emit('pointerdown')); await p.waitForTimeout(300);
  const chron = await p.evaluate(() => { const c = window.__game.scene.getScene('MenuScene').children.getByName('campaign-chronicle'); const texts = c.getAll().flatMap(o => o.list ?? [o]).filter(o => o.type === 'Text').map(o => o.text); return texts.filter(t => /已平定|官渡之战|赤壁之战/.test(t)); });
  ck(layout + ' 战役回顾：已平定 12/N（总关数随章节增加），官渡 3/3', chron.some(t => /^已平定 12 \/ \d+$/.test(t)) && chron.some(t => /官渡之战\s+3\/3/.test(t)) && chron.some(t => /赤壁之战/.test(t)), chron);
  await p.close();
}
ck('无 pageerror', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
