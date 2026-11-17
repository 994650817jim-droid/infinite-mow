// 关羽拖刀行走 / 拖刀上撩（src/data/dragArt.ts + Player.dragWalkSheet / playStrip + DraggingBladeFx）：
// 没学拖刀斩照常走；学了但缺图时退回普通行走；有图时移动换拖刀行走、停下 / 出手恢复；火星对准拖刀图刀尖；
// 半月刀气那一下播拖刀上撩。正式图未到时用“临时复制的普通行走图 / 技能行”模拟图已加载。电脑布局 1280×720。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5197/ node tools/test-drag-walk.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/drag-walk';
mkdirSync(`${out}/frames`, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
await p.waitForTimeout(1500);
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'guanyu', weapon: 'guandao' }); s.scene.restart(); }, G);
await p.waitForTimeout(400);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'guanyu' && s.__DEV_ACTIONS; }, null, { timeout: 60000 });
await p.evaluate(G0 => {
  const g = window.__game, s = eval(G0); s.__DEV_ACTIONS.closePopup?.();
  s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  g.loop.sleep(); window.__T = performance.now(); window.__v = new Phaser.Math.Vector2(0, 0); s.readMove = () => window.__v.clone().normalize();
  window.__step = (n, hold) => { const out = []; for (let i = 0; i < n; i++) { window.__T += 1000 / 60; if (hold) for (const w of s.player.weapons) w.cooldownLeft = 99; g.step(window.__T, 1000 / 60); for (const e of s.enemies) if (e.active && !e.isSupplySlot && !e.__keep) e.hp = 0; const sp = s.player.sprite; out.push({ tex: sp.texture.key, frame: String(sp.frame.name), drag: s.player.dragWalking, act: s.player.currentAction }); } return out; };
}, G);
const step = (n, hold = true) => p.evaluate(([a, h]) => window.__step(a, h), [n, hold]);
const texs = rows => [...new Set(rows.map(r => r.tex))];

// 1. 没学拖刀斩：照常走
await p.evaluate(() => window.__v.set(1, 0));
let rows = await step(30);
ck('没学拖刀斩：移动照常用普通行走图', rows.every(r => !r.drag) && texs(rows).every(t => /guanyu_walk_sheet/.test(t)), texs(rows));
// 2. 学了但缺图：退回普通行走图，无报错
await p.evaluate(G0 => { eval(G0).player.growth.masteries.dragging_blade = 1; }, G);
rows = await step(30);
const hasArt = await p.evaluate(G0 => eval(G0).textures.exists('guanyu_drag_walk_sheet'), G);
ck(`学了拖刀斩、拖刀图${hasArt ? '已加载' : '缺失'}：${hasArt ? '移动换拖刀行走' : '退回普通行走'}`, hasArt ? rows.slice(2).every(r => r.drag) : rows.every(r => !r.drag && /guanyu_walk_sheet/.test(r.tex)), { hasArt, texs: texs(rows) });
// 3. 模拟拖刀图已加载（临时复制普通行走图），检查切换逻辑
await p.evaluate(G0 => {
  const s = eval(G0), tm = s.textures; if (tm.exists('guanyu_drag_walk_sheet')) return;
  const srcKey = s.player.sprite.texture.key, src = tm.get(srcKey), img = src.getSourceImage();
  const t = tm.addImage('guanyu_drag_walk_sheet', img); for (const n of src.getFrameNames()) { const f = src.get(n); t.add(n, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
  window.__fakeDrag = true;
}, G);
await p.evaluate(() => window.__v.set(1, 0));
rows = await step(30);
const tip = await p.evaluate(G0 => { const s = eval(G0), t = s.dragFx.tip(); return { dx: Math.round(t.x - s.player.x), dy: Math.round(t.y - s.player.y) }; }, G);
ck('有拖刀图：移动时换拖刀行走，火星位置改到拖刀图的刀尖（右行 DRAG_TIP.right）', rows.slice(2).every(r => r.drag && r.tex === 'guanyu_drag_walk_sheet') && tip.dx === -42 && tip.dy === 27, { texs: texs(rows), tip });
await p.evaluate(() => window.__v.set(-1, 0)); rows = await step(20);
const tipL = await p.evaluate(G0 => { const s = eval(G0), t = s.dragFx.tip(); return { dx: Math.round(t.x - s.player.x), dy: Math.round(t.y - s.player.y), frame: s.player.sprite.frame.name }; }, G);
ck('拖刀行走朝左：用左行帧，刀尖在身后右侧', rows.slice(4).every(r => r.drag && r.frame.startsWith('left_')) && tipL.dx === 38, tipL);
// 4. 停下：恢复普通行走图站立帧
await p.evaluate(() => window.__v.set(0, 0)); rows = await step(10);
ck('停下：恢复普通行走图（站立帧）', rows.slice(1).every(r => !r.drag && /guanyu_walk_sheet/.test(r.tex)), rows.slice(-1));
// 5. 移动中出手：普攻动作覆盖拖刀行走，出完刀继续拖刀
await p.evaluate(G0 => { const s = eval(G0), pl = s.player; for (const [dx, dy] of [[70, 0], [90, 30]]) { const e = s.spawnEnemy('infantry', pl.x + dx, pl.y + dy, 1, true); if (e) { e.hp = e.maxHp = 1e7; e.speed = 0; e.__keep = true; } } for (const w of pl.weapons) w.cooldownLeft = 0; window.__v.set(1, 0); }, G);
rows = await step(40, false);
const atk = rows.filter(r => r.act), after = rows.slice(rows.findLastIndex(r => r.act) + 2);
ck('移动中出手：攻击动作覆盖拖刀行走，收刀后继续拖刀', atk.length > 0 && atk.every(r => !r.drag) && after.length > 0 && after.every(r => r.drag), { atk: atk.length, after: after.length, afterTex: texs(after) });
// 6. 拖刀上撩：模拟上撩图（复制动作表技能行），蓄满后挥出半月刀气那一下播上撩
await p.evaluate(G0 => {
  const s = eval(G0), tm = s.textures; if (tm.exists('guanyu_drag_slash')) return;
  const act = tm.get(s.player.actionSet.texture), f0 = act.get(16), img = act.getSourceImage(), c = document.createElement('canvas'); c.width = f0.cutWidth * 4; c.height = f0.cutHeight;
  const g = c.getContext('2d'); for (let i = 0; i < 4; i++) { const f = act.get(16 + i); g.drawImage(img, f.cutX, f.cutY, f.cutWidth, f.cutHeight, i * f0.cutWidth, 0, f.cutWidth, f.cutHeight); }
  const t = tm.addCanvas('guanyu_drag_slash', c); for (let i = 0; i < 4; i++) t.add(String(i), 0, i * f0.cutWidth, 0, f0.cutWidth, f0.cutHeight);
  for (const e of s.enemies) { e.__keep = false; if (e.active) e.hp = 0; }
  s.player.growth.travel = 0;
}, G);
// 蓄力门槛由平衡会话调整（RunGrowth.DRAG_TRAVEL），这里直接把蓄力值设满，只验证出刀动作
await p.evaluate(() => window.__v.set(1, 0)); await step(10);
await p.evaluate(G0 => { const s = eval(G0); s.player.growth.travel = 1e4; }, G);
await p.evaluate(() => window.__v.set(0, 0)); await step(6);
const clip = async name => { const r = await p.evaluate(G0 => { const s = eval(G0), g = window.__game, c = g.canvas.getBoundingClientRect(), cam = s.cameras.main, k = c.width / g.scale.gameSize.width * cam.zoom, wv = cam.worldView; return { x: c.left + (s.player.x - wv.x) * k, y: c.top + (s.player.y - wv.y) * k, k }; }, G); await p.screenshot({ path: `${out}/${name}.png`, clip: { x: r.x - 190 * r.k, y: r.y - 130 * r.k, width: 380 * r.k, height: 240 * r.k } }); };
await p.evaluate(G0 => { const s = eval(G0), pl = s.player; for (const [dx, dy] of [[70, 0], [100, -25]]) { const e = s.spawnEnemy('infantry', pl.x + dx, pl.y + dy, 1, true); if (e) { e.hp = e.maxHp = 1e7; e.speed = 0; e.__keep = true; } } for (const w of pl.weapons) w.cooldownLeft = 0; }, G);
const seen = [];
for (let i = 0; i < 14; i++) { const r = await step(2, false); seen.push(...r); await clip(`frames/slash-${String(i).padStart(2, '0')}`); }
const strip = seen.filter(r => r.tex === 'guanyu_drag_slash');
ck('蓄满挥出半月刀气那一下：播放拖刀上撩（4 帧，招牌技优先级）', strip.length >= 6 && new Set(strip.map(r => r.frame)).size >= 3 && strip.every(r => r.act === 'skill'), { stripFrames: strip.length, frames: [...new Set(strip.map(r => r.frame))] });
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
