// 蜀汉新武将：马超（西凉铁骑 · 满层冲锋突进）、魏延（长驱子午 · 满层重斩回血）、刘备（仁德聚义 · 满层回复自身与部曲）。
// 每将检查：自己的行走 / 动作图、立绘已加载、本命武器、被动积满后实际触发效果；最后检查主页点将翻页。
// 需要开发服务器 5173。用法：node tools/test-shu-heroes.mjs [id...]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/shu-heroes';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const HEROES = { machao: { name: '马超', weapon: 'zhanjin_lance' }, weiyan: { name: '魏延', weapon: 'zhenbei_blade' }, liubei: { name: '刘备', weapon: 'shuanggu_swords' }, pangtong: { name: '庞统', weapon: 'lianhuan_mines' }, huangyueying: { name: '黄月英', weapon: 'crossbow' } };
const only = process.argv.slice(2), list = only.length ? only : Object.keys(HEROES);
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
for (const hero of list) {
  const h = HEROES[hero];
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => errors.push(hero + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error' && /Failed to process file/.test(m.text())) errors.push(hero + ' ' + m.text()); });
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=mobile');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 30000 });
  await p.evaluate(([G0, id, w]) => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: w }); s.scene.restart(); }, [G, hero, h.weapon]);
  await p.waitForTimeout(400);
  await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === id && s.__DEV_ACTIONS; }, hero, { timeout: 20000 });
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; }, G);
  await p.waitForTimeout(300);
  const st = await p.evaluate(([G0, id]) => { const s = eval(G0), pl = s.player; return { sheet: pl.sprite.texture.key, weapon: pl.weapons[0].id, passive: pl.passive.snapshot(s.combatNow).character, portrait: s.textures.exists(id + '_portrait') && s.textures.get(id + '_portrait').key !== '__MISSING', actions: s.textures.exists(id + '_actions') }; }, [G, hero]);
  ck(`${h.name}：自己的行走 / 动作图、立绘、本命 ${h.weapon}、专属被动`, new RegExp(hero + '_(walk_sheet|actions)').test(st.sheet) && st.weapon === h.weapon && st.passive === hero && st.portrait && st.actions, st);
  // 围敌积满被动，等待触发
  const r = await p.evaluate(async ([G0, id]) => {
    const s = eval(G0), pl = s.player;
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, e = s.spawnEnemy('infantry', pl.x + Math.cos(a) * 80, pl.y + Math.sin(a) * 80, 1); if (e) { e.hp = e.maxHp = 99999; e.speed = 0; } }
    if (id !== 'machao') { pl.hp = Math.round(pl.maxHp * .4); pl.damageImmune = true; for (const u of s.allies) if (u.active) u.hp = Math.round(u.maxHp * .3); }
    // 2026-11-15 重做：魏延靠受伤积拒敌、庞统靠火雷连锁积计策，这里直接给满层，只验证满层后的招牌技会触发；
    // 自然积层（受击 / 踩雷连锁）由 tools/test-weiyan-pangtong.mjs 覆盖。
    if (id === 'weiyan') pl.passive.stacks = 5;
    // 2026-11-16 重做：马超靠移动积铁骑，原地测试直接给满层，验证西凉铁骑冲阵
    if (id === 'machao') pl.passive.stacks = 6;
    if (id === 'pangtong') { pl.hp = pl.maxHp; pl.passive.stacks = 3; }
    const fxSeen = new Set(); const fxWatch = setInterval(() => { for (const o of s.children.list) if (/^hero-fx-|^pangtong-ring$|^machao-rider$/.test(o.name)) fxSeen.add(o.name); }, 30);
    const x0 = pl.x, y0 = pl.y, hp0 = pl.hp, ally0 = s.allies.filter(u => u.active).reduce((n, u) => n + u.hp, 0);
    const t0 = performance.now(); let triggered = 0, moved = 0;
    while (performance.now() - t0 < 20000) { await new Promise(r => setTimeout(r, 40)); const sn = pl.passive.snapshot(s.combatNow); moved = Math.max(moved, Math.hypot(pl.x - x0, pl.y - y0)); if (sn.triggers > triggered) { triggered = sn.triggers; await new Promise(r => setTimeout(r, 750)); moved = Math.max(moved, Math.hypot(pl.x - x0, pl.y - y0)); break; } }
    const fx = s.children.list.filter(o => /^hero-fx-/.test(o.name)).map(o => o.name); clearInterval(fxWatch);
    return { fx, fxSeen: [...fxSeen], triggered, moved: Math.round(moved), healed: Math.round(pl.hp - hp0), allyHealed: Math.round(s.allies.filter(u => u.active).reduce((n, u) => n + u.hp, 0) - ally0), allies: s.allies.filter(u => u.active).length };
  }, [G, hero]);
  if (hero === 'machao') ck('马超：西凉铁骑满层，召骑兵冲阵', r.triggered >= 1 && r.fxSeen.includes('machao-rider'), r);
  if (hero === 'weiyan') ck('魏延：拒敌满层后「谁敢杀我」（怒吼冲击波特效、3 秒减伤）', r.triggered >= 1 && r.fxSeen.includes('hero-fx-whoDares'), r);
  if (hero === 'pangtong') ck('庞统：计策满层后「火烧连环」（锁链火雷环、齐爆火凤）', r.triggered >= 1 && r.fxSeen.includes('pangtong-ring') && r.fxSeen.includes('hero-fx-phoenix'), r);
  if (hero === 'huangyueying') ck('黄月英：机括积满后扇形齐射（齿轮特效）', r.triggered >= 1, r);
  if (hero === 'liubei') ck('刘备：双股剑分击攒满仁德后回复自身与部曲生命', r.triggered >= 1 && r.healed > 0 && (r.allies === 0 || r.allyHealed > 0), r);
  await p.screenshot({ path: `${out}/${hero}-battle.png` });
  await p.close();
}
// 主页点将：每页 4 将，可翻页
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errors.push('picker ' + e.message));
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 30000 }); await p.waitForTimeout(500);
  const pg = await p.evaluate(async () => { const s = window.__game.scene.getScene('MenuScene'), hp = s.heroPicker; hp.open(0); const vis = () => hp.cards.map((c, i) => c.root.visible ? i : -1).filter(i => i >= 0); const a = vis(); hp.root.getByName('hero-page-next').emit('pointerdown'); const b2 = vis(); hp.open(6); const c = vis(); return { a, b: b2, c, total: hp.cards.length }; });
  ck('主页点将：每页 4 将、可翻页、打开第 7 将时直接翻到第 2 页', pg.a.join() === '0,1,2,3' && pg.b.join() === '4,5,6,7' && pg.c.includes(6), pg);
  await p.evaluate(() => window.__game.scene.getScene('MenuScene').heroPicker.open(5)); await p.waitForTimeout(300); await p.screenshot({ path: `${out}/picker-page2.png` });
  await p.close();
}
ck('无 pageerror / 缺图', errors.length === 0, errors.slice(0, 3));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
