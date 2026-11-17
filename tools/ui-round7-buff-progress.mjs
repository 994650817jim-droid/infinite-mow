// 增益图标触发进度（电脑布局）：魏延开山 2/4 → 满格发亮，外加拖刀斩 / 百步穿杨 / 连珠 / 八阵 / 追袭 / 迂回袭 / 沉锋 / 以战养战 / 追魂铃。
// 用法：BASE=http://127.0.0.1:5180/ node tools/ui-round7-buff-progress.mjs <tag>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const tag = process.argv[2] ?? 'after', base = process.env.BASE ?? 'http://127.0.0.1:5180/', out = 'assets/review/ui-round7';
mkdirSync(out, { recursive: true });
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true }); const errors = []; let fail = 0;
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load|Texture key already in use: troop_portrait/.test(m.text()) /* 换将重启场景时兵种立绘重复加载的旧告警（TroopPortraits，非本轮） */) errors.push(m.text()); });
await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=desktop`);
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'weiyan', weapon: 'zhenbei_blade' }); s.scene.restart(); }, G);
await p.waitForTimeout(400);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'weiyan' && s.__DEV_ACTIONS; }, null, { timeout: 30000 });
// 关掉出怪、给一套带计数的技艺，计数器停在中间值（没有敌人就不会再变）
const setup = async (slash, extra) => p.evaluate(([G0, slash, extra]) => {
  const s = eval(G0), g = s.player.growth; s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9;
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0;
  g.masteries.kaishan = 3; g.masteries.dragging_blade = 2; g.masteries.steady_aim = 1; g.masteries.pearl_volley = 2; g.masteries.eight_trigrams = 1;
  for (const [id, n] of [['pursuit', 2], ['flank', 1], ['stored_edge', 1], ['warfeed', 1]]) while (g.build.level(id) < n) g.build.learn(id);
  if (!g.build.treasures.includes('soul_bell')) g.build.treasures.push('soul_bell');
  g.slashCount = slash; g.travel = extra ? 160 : 80; g.shotCount = extra ? 3 : 1; g.flagCount = extra ? 2 : 1;
  s.buildCombat.hits = extra ? 4 : 2; s.buildCombat.distances.flank = extra ? 200 : 90; s.buildCombat.idle = extra ? 2000 : 800; s.warfeedCount = extra ? 11 : 4;
}, [G, slash, extra]);
const hover = async id => p.evaluate(([G0, id]) => { const s = eval(G0), slot = s.buffHud.slots.find(sl => sl.entry?.id === id); slot?.hit.emit('pointerover'); return !!slot; }, [G, id]);
const read = id => p.evaluate(([G0, id]) => { const s = eval(G0), slot = s.buffHud.slots.find(sl => sl.entry?.id === id); return slot ? { prog: slot.entry.progress, tip: s.buffHud.tip.visible ? s.buffHud.tipText.text : null, badge: slot.badge.text } : null; }, [G, id]);

await setup(2, false); await p.waitForTimeout(250);
await hover('mastery_kaishan'); await p.waitForTimeout(120);
const a = await read('mastery_kaishan');
ck('开山 2/4：进度 2、未满、等级数字仍是 3', a && a.prog?.cur === 2 && a.prog?.max === 4 && !a.prog?.ready && a.badge === '3', a?.prog);
ck('悬停提示里有「当前 2/4」', !!a?.tip && a.tip.includes('当前 2/4'), a?.tip);
await p.screenshot({ path: `${out}/${tag}-desktop-kaishan-2of4.png` });
await p.screenshot({ path: `${out}/${tag}-desktop-kaishan-2of4-zoom.png`, clip: { x: 0, y: 220, width: 560, height: 420 } });

await setup(4, true); await p.waitForTimeout(250);
await hover('mastery_kaishan'); await p.waitForTimeout(120);
const c = await read('mastery_kaishan');
ck('开山 4/4：满格发亮，提示「下一刀重劈」', c && c.prog?.ready && c.prog?.cur === 4 && c.tip?.includes('下一刀重劈'), c?.prog);
const all = await p.evaluate(G0 => eval(G0).buffHud.slots.filter(sl => sl.root.visible).map(sl => ({ id: sl.entry.id, p: sl.entry.progress ? sl.entry.progress.cur.toFixed?.(0) + '/' + sl.entry.progress.max + (sl.entry.progress.ready ? '!' : '') : null })), G);
console.log(JSON.stringify(all));
const want = ['mastery_kaishan', 'mastery_dragging_blade', 'mastery_steady_aim', 'mastery_pearl_volley', 'mastery_eight_trigrams', 'tactic_pursuit', 'tactic_flank', 'tactic_stored_edge', 'tactic_warfeed', 'treasure_soul_bell'];
const shown = all.filter(x => want.includes(x.id));
ck('所有带计数的技艺都有进度', shown.length > 0 && shown.every(x => x.p !== null), shown.filter(x => x.p === null).map(x => x.id));
await p.screenshot({ path: `${out}/${tag}-desktop-ready.png` });
await p.screenshot({ path: `${out}/${tag}-desktop-ready-zoom.png`, clip: { x: 0, y: 220, width: 560, height: 420 } });
// 性能：进度变化时文字对象数量不增长（不每帧新建 Text）
const n0 = await p.evaluate(G0 => eval(G0).children.list.length, G);
await p.evaluate(G0 => { const s = eval(G0); for (let i = 0; i < 30; i++) { s.player.growth.slashCount = i % 5; } }, G); await p.waitForTimeout(500);
const n1 = await p.evaluate(G0 => eval(G0).children.list.length, G);
ck('进度刷新不新建显示对象', n1 <= n0 + 2, { n0, n1 });
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 3));
process.exit(fail ? 1 : 0);
