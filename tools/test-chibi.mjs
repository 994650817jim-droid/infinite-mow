// 第五章 · 赤壁之战：解锁条件、天下地图入口、选关、三关战斗（首领贴图 / 名字 / 招式组）、结算推进、旧存档兼容。
// 需要开发服务器 5173。用法：node tools/test-chibi.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/chibi';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const save = (g) => ({ version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: g, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 100, provisions: 200, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu'] });
const b = await chromium.launch({ channel: 'chrome', headless: true });
for (const [layout, vp] of [['desktop', { width: 1280, height: 720 }], ['mobile', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp }); p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  await p.addInitScript(sv => { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_town_intro2', '1'); sessionStorage.setItem('s', '1'); } }, save(2));
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 30000 }); await p.waitForTimeout(300);
  const ws = (fn) => p.evaluate(async src => { const u = performance.getEntriesByType('resource').map(e => e.name).find(n => /\/src\/world\/WorldStore\.ts/.test(n)); const m = await import(u); return (0, eval)('(' + src + ')')(m); }, fn.toString());
  const locked = await ws(m => ({ open: m.arcUnlocked('chibi'), s1: m.arcStageUnlocked('chibi', 1) }));
  ck(`${layout}：官渡未全胜时赤壁之战锁定`, !locked.open && !locked.s1, locked);
  await p.evaluate(sv => localStorage.setItem('im_world_v1', JSON.stringify(sv)), save(3));
  const open = await ws(m => ({ open: m.arcUnlocked('chibi'), s1: m.arcStageUnlocked('chibi', 1), s2: m.arcStageUnlocked('chibi', 2), stages: m.loadWorld().chibiStages }));
  ck(`${layout}：官渡三关告捷后解锁 5-1（5-2 仍锁定），旧存档 chibiStages 为 0`, open.open && open.s1 && !open.s2 && open.stages === 0, open);
  // 天下地图节点
  await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(400);
  const node = await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); const walk = l => l.flatMap(o => [o, ...(o.list ? walk(o.list) : [])]); return walk(s.children.list).filter(o => o.type === 'Text' && /赤壁/.test(o.text)).map(o => o.text); });
  ck(`${layout}：天下地图出现「赤壁之战」战役节点（不再是开发中）`, node.some(t => /赤壁之战/.test(t)) && !node.some(t => /开发中/.test(t)), node);
  // 选关
  await p.evaluate(() => { window.__game.scene.getScene('WorldMapScene').scene.start('ChibiChapterScene'); });
  await p.waitForFunction(() => window.__game.scene.isActive('ChibiChapterScene') || window.__game.scene.isActive('BootScene'), null, { timeout: 15000 });
  await p.waitForFunction(() => window.__game.scene.isActive('ChibiChapterScene'), null, { timeout: 60000 }); await p.waitForTimeout(500);
  const sel = await p.evaluate(() => { const s = window.__game.scene.getScene('ChibiChapterScene'); return { texts: s.children.list.filter(o => o.type === 'Text').map(o => o.text).join(' | '), arts: s.children.list.filter(o => o.type === 'Image' && /^chibi_/.test(o.texture.key)).map(o => o.texture.key) }; });
  ck(`${layout}：选关显示第五章三关（长坂突围 / 赤壁鏖兵 / 江陵夺城、曹纯 / 蔡瑁 / 曹仁），首领立绘已加载`, /赤壁之战/.test(sel.texts) && /长坂突围/.test(sel.texts) && /赤壁鏖兵/.test(sel.texts) && /江陵夺城/.test(sel.texts) && /曹纯/.test(sel.texts) && sel.arts.length === 3 && /锁定 · 完成前关/.test(sel.texts), sel);
  await p.screenshot({ path: `${out}/${layout}-select.png` });
  // 出征 5-1
  await p.evaluate(() => window.__game.scene.getScene('ChibiChapterScene').children.getByName('chibi-deploy').emit('pointerup'));
  await p.waitForFunction(() => window.__game.scene.isActive('ChibiGameScene'), null, { timeout: 20000 }); await p.waitForTimeout(1500);
  const G = "window.__game.scene.getScene('ChibiGameScene')";
  const st = await p.evaluate(G0 => { const s = eval(G0); return { name: s.chapter.name, wave: s.chapter.waves[0].name, boss: s.chapter.bossName, style: s.chapter.bossStyle, receipt: !!s.thirdReceipt, active: loadActive() }; function loadActive() { try { return JSON.parse(localStorage.getItem('im_world_v1')).active?.arc; } catch { return null; } } }, G);
  ck(`${layout}：5-1 长坂突围开战，首领曹纯，出征记录 arc=chibi`, st.name === '5-1 长坂突围' && st.wave === '当阳道上' && st.boss === '曹纯' && st.style === 'caochun' && st.receipt && st.active === 'chibi', st);
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.spawnBoss(); }, G); await p.waitForTimeout(400);
  const boss = await p.evaluate(G0 => { const s = eval(G0); return { tex: s.boss?.sprite.texture.key, name: s.controller?.name, behavior: s.controller?.stage, label: s.controller?.label }; }, G);
  ck(`${layout}：首领用 chibi_caochun 图集、名字曹纯、铁骑招式组（虎豹冲锋 / 号令虎骑 / 马刀横扫）`, boss.tex === 'chibi_caochun' && boss.name === '曹纯' && boss.behavior === 1 && /虎豹冲锋|号令虎骑|马刀横扫/.test(boss.label ?? ''), boss);
  await p.screenshot({ path: `${out}/${layout}-battle.png` });
  ck(`${layout}：5-1 没有东风火船`, !(await p.evaluate(G0 => !!eval(G0).fireShips, G)));
  // 绝技：半血进入强化后立刻放出「虎豹围猎」（四条冲锋道 + 四骑冲入）
  const sig = await p.evaluate(async G0 => { const s = eval(G0), b = s.boss, c = s.controller; s.player.damageImmune = false; s.player.hp = s.player.maxHp = 99999; b.hp = Math.floor(b.maxHp * .45); const cav0 = s.enemies.filter(e => e.active && e.kind === 'cavalry').length; const until = performance.now() + 7000; let label = ''; while (performance.now() < until && c.metrics.signature < 1) { for (let k = 0; k < 40 && s.mode === 'levelup'; k++) s.chooseUpgrade(0); /* 2026-11-17 升级三选一会暂停 */ await new Promise(r => setTimeout(r, 100)); } const t2 = performance.now() + 2600; while (performance.now() < t2) { for (let k = 0; k < 40 && s.mode === 'levelup'; k++) s.chooseUpgrade(0); /* 2026-11-17 升级三选一会暂停 */ await new Promise(r => setTimeout(r, 100)); if (/绝技/.test(c.label)) label = c.label; } return { sig: c.metrics.signature, rage: c.metrics.rage, label, cav: s.enemies.filter(e => e.active && e.kind === 'cavalry').length - cav0 }; }, G);
  ck(`${layout}：曹纯半血后放出绝技「虎豹围猎」（提示含绝技名、召出冲锋骑兵）`, sig.sig >= 1 && sig.rage === 1 && /虎豹围猎/.test(sig.label) && sig.cav >= 2, sig);
  // 5-2 赤壁鏖兵：东风火船烧伤航道内敌军
  await p.evaluate(G0 => { const w = JSON.parse(localStorage.getItem('im_world_v1')); w.chibiStages = 1; localStorage.setItem('im_world_v1', JSON.stringify(w)); const s = eval(G0); s.registry.set('chibiStage', 2); s.scene.restart(); }, G);
  await p.waitForFunction(G0 => eval(G0)?.chapter?.name === '5-2 赤壁鏖兵' && eval(G0).fireShips, G, { timeout: 20000 }); await p.waitForTimeout(800);
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; s.fireShips.force(s.combatNow); }, G);
  await p.waitForTimeout(600); await p.screenshot({ path: `${out}/${layout}-fireships-warn.png` });
  await p.evaluate(G0 => { const s = eval(G0), L = s.fireShips.lane, v = s.cameras.main.worldView; for (let i = 0; i < 6; i++) { const e = s.spawnEnemy('infantry', v.x + 40 + i * (v.width - 80) / 5, L.y, 1); if (e) { e.hp = 99999; e.speed = 0; } } }, G);
  await p.waitForTimeout(2600); await p.screenshot({ path: `${out}/${layout}-fireships.png` });
  const fs1 = await p.evaluate(G0 => { const s = eval(G0); return { ...s.fireShips.metrics, boss: s.chapter.bossName, label: s.chapter.name }; }, G);
  ck(`${layout}：5-2 赤壁鏖兵（蔡瑁）东风火船发动并烧到航道内敌军`, fs1.boss === '蔡瑁' && fs1.waves >= 1 && fs1.burned >= 3, fs1);
  const sig2 = await p.evaluate(async G0 => { const s = eval(G0); s.player.hp = s.player.maxHp = 99999; s.spawnBoss(); const c = s.controller, b = s.boss; b.hp = Math.floor(b.maxHp * .45); const until = performance.now() + 8000; let label = ''; while (performance.now() < until && !/楼船箭雨/.test(label)) { for (let k = 0; k < 40 && s.mode === 'levelup'; k++) s.chooseUpgrade(0); /* 2026-11-17 升级三选一会暂停 */ await new Promise(r => setTimeout(r, 100)); label = c.label; } return { sig: c.metrics.signature, label, name: c.name }; }, G);
  ck(`${layout}：蔡瑁半血后放出绝技「楼船箭雨」`, sig2.name === '蔡瑁' && sig2.sig >= 1 && /楼船箭雨/.test(sig2.label), sig2);
  // 结算：先离开战斗（避免运行中的战斗写回出征记录），再直接走存档接口，三关推进
  await p.evaluate(G0 => { eval(G0).scene.start('MenuScene'); }, G); await p.waitForTimeout(500);
  const prog = await ws(m => { const r = []; for (const stage of [1, 2, 3]) { const id = m.beginArcExpedition('chibi', stage, []); const res = id ? m.settleArcExpedition('chibi', id, { victory: true, bossKilled: true, kills: 300, elapsed: 300, debug: false }) : null; r.push(!!res && res.provisions > 0 || (id ? res?.message : 'no-id')); } return { r, stages: m.loadWorld().chibiStages }; });
  ck(`${layout}：三关依次告捷，chibiStages = 3，奖励入库`, prog.r.every(x => x === true) && prog.stages === 3, prog);
  await p.close();
}
ck('无 pageerror', errors.length === 0, errors.slice(0, 4));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
