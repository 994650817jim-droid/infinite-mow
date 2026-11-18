// ① 战场支援援兵入场（src/systems/Legion.ts ARRIVAL、GameScene.recruitEntryPoint）：选了支援后兵不出现在主将脚下，而是从画面外（主将面朝那边）出现，
//    小队形跑向主将身边、到了才入列；途中照常在部曲格子里（能挨打）；3 秒没到直接归位；
// ② 武将主属性印（src/ui/AttrBadge.ts）：战斗 HUD、属性加点的主属性行、选将卷轴（HeroWarCard）、武将图鉴；悬停显示「主属性：… —— …」。
// 电脑布局 1280×720，截图存 assets/review/arrival-attr/。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5197/ node tools/test-arrival-attr.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/arrival-attr';
mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 460) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });

// ---------- ① 援兵入场 ----------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push('battle ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::|ERR_/.test(m.text())) errors.push('battle ' + m.text()); });
  await p.goto(base + '?dev=1&autostart=1&stage=2&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const g = window.__game, s = g.scene.getScene('GameScene'); window.__S = s; s.__DEV_ACTIONS.closePopup?.();
    s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
    g.loop.sleep(); window.__T = performance.now(); window.__mv = [0, 0]; s.readMove = () => new Phaser.Math.Vector2(window.__mv[0], window.__mv[1]);
    window.__step = n => { for (let i = 0; i < n; i++) { window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); } };
  });
  await p.evaluate(() => window.__step(10));
  // 主将面朝右；开出战场支援、选第一张兵卡
  const r0 = await p.evaluate(() => {
    const s = window.__S, L = s.legion, before = L.units.filter(u => u.active).length;
    window.__mv = [1, 0]; window.__step(4); window.__mv = [0, 0]; window.__step(2);
    s.freeRecruit = true; s.recruitedWaves.delete(s.waveIndex); s.recruitOptions = [{ kind: 'swordsman', upgrade: false }, { kind: 'spearman', upgrade: false }, { kind: 'archer', upgrade: false }]; s.setMode('recruit');
    s.chooseRecruit(0); if (s.mode !== 'none') s.setMode('none');
    const v = s.cameras.main.worldView, fresh = L.units.filter(u => u.active && L.isArriving(u));
    window.__fresh = fresh;
    return { before, after: L.units.filter(u => u.active).length, arriving: L.arrivingCount, dir: s.player.direction, offscreen: fresh.every(u => u.x < v.x || u.x > v.right || u.y < v.y || u.y > v.bottom), rightSide: fresh.every(u => u.x > v.right), pos: fresh.map(u => [Math.round(u.x - s.player.x), Math.round(u.y - s.player.y)]), inGrid: fresh.every(u => L.grid.query(u.x, u.y, 40).includes(u)) };
  });
  ck('选了支援后援兵不在主将脚下，而是在画面外（主将面朝的右边）出现、处于入场状态', r0.after > r0.before && r0.arriving >= 1 && r0.offscreen && r0.rightSide, r0);
  ck('援兵跑来途中照常在部曲格子里（能被敌人打到）', r0.inGrid, { inGrid: r0.inGrid });
  // 跑来过程：每隔一会儿量一次离主将的距离
  const track = [];
  for (let i = 0; i < 8; i++) { await p.evaluate(() => window.__step(15)); const d = await p.evaluate(() => { const s = window.__S; return { d: Math.round(Math.max(...window.__fresh.map(u => Math.hypot(u.x - s.player.x, u.y - s.player.y)))), n: s.legion.arrivingCount }; }); track.push(d); if (i === 1) await p.screenshot({ path: `${OUT}/1-arriving.png` }); }
  await p.evaluate(() => window.__step(60));
  const r1 = await p.evaluate(() => { const s = window.__S; return { left: s.legion.arrivingCount, dist: window.__fresh.map(u => Math.round(Math.hypot(u.x - s.player.x, u.y - s.player.y))) }; });
  await p.screenshot({ path: `${OUT}/2-joined.png` });
  ck('援兵小队形跑向主将、越跑越近，到了入列（≤3 秒内全部入列）', track[0].d > track[track.length - 1].d && r1.left === 0 && r1.dist.every(d => d < 220), { track, r1 });
  // 跑速比平时快一点
  const sp = await p.evaluate(async () => (await import('/src/systems/Legion.ts')).ARRIVAL);
  ck('跑来速度比平时快一点（×1.25），3 秒为限', sp.speedMul > 1 && sp.maxSeconds === 3, sp);
  // 3 秒兜底：从很远的地方来，到点直接归位
  const r2 = await p.evaluate(() => {
    const s = window.__S, L = s.legion; L.arriveFrom = { x: s.player.x + 3000, y: s.player.y }; L.recruit('archer', 1, true);
    const u = L.units.filter(u => u.active && L.isArriving(u))[0]; const x0 = Math.round(u.x - s.player.x);
    window.__step(3 * 60 + 10);
    return { x0, arriving: L.isArriving(u), d: Math.round(Math.hypot(u.x - s.player.x, u.y - s.player.y)) };
  });
  ck('3 秒还没跑到就直接归位到主将身边（不会卡在外面）', r2.x0 > 2000 && !r2.arriving && r2.d < 220, r2);
  // 军营 / 开局招兵照旧（不走入场）
  const r3 = await p.evaluate(() => { const s = window.__S, L = s.legion; L.recruit('spearman', 1, true); return { arriving: L.arrivingCount }; });
  ck('不经战场支援的招兵（军营 / 开局）照旧直接归位', r3.arriving === 0, r3);
  // ② HUD 主属性印 + 悬停
  const hud = await p.evaluate(() => { const s = window.__S, bd = s.children.getByName('hud-attr-badge'); if (!bd) return null; bd.emit('pointerover'); const tip = s.children.getByName('attr-badge-tip'); const text = tip ? tip.list.find(o => o.type === 'Text')?.text : ''; return { attr: bd.getData('attr'), x: Math.round(bd.x), y: Math.round(bd.y), sf: bd.scrollFactorX, text }; });
  await p.evaluate(() => window.__step(1)); // 游戏循环已停，手动渲一帧，截图才有悬停框
  await p.screenshot({ path: `${OUT}/3-hud-badge-tip.png` });
  await p.evaluate(() => window.__S.children.getByName('hud-attr-badge')?.emit('pointerout'));
  ck('战斗 HUD 主将名旁有主属性印（赵云 = 敏），悬停显示「主属性：敏捷 —— …」', !!hud && hud.attr === "agility" && hud.sf === 0 && /^主属性：敏捷 —— /.test(hud.text), hud);
  // 属性加点面板：主属性那一行有印
  const ap = await p.evaluate(() => { const s = window.__S; s.openAttributePanel?.() ?? s.showAttributePanel?.(); const panel = s.attributePanel; if (!panel) return { panel: false }; panel.setVisible?.(true); const b = panel.list.filter(o => o.name === 'attr-badge'); return { panel: true, n: b.length, attr: b[0]?.getData('attr') }; });
  ck('属性加点：主属性那一行有主属性印', ap.panel && ap.n === 1 && ap.attr === 'agility', ap);
  await p.close();
}

// ---------- ② 选将卷轴、武将图鉴 ----------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push('menu ' + e.message));
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  const pk = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); m.ensureHomeArt?.(true); m.heroPicker.open(1); return true; });
  await p.waitForTimeout(2500);
  const pk2 = await p.evaluate(() => {
    const m = window.__game.scene.getScene('MenuScene'), seen = [];
    const walk = o => { if (o.name === 'attr-badge' && o.visible) seen.push(o.getData('attr')); if (o.list) o.list.forEach(walk); };
    m.children.list.forEach(walk); return { pk: true, badges: seen.length, kinds: [...new Set(seen)] };
  });
  await p.screenshot({ path: `${OUT}/4-picker.png` });
  ck('选将卷轴：每个武将卷轴上都有主属性印（力 / 敏 / 智 / 统都出现）', pk && pk2.badges >= 4 && pk2.kinds.length >= 3, pk2);
  await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); m.heroPicker.close?.(); });
  const cx = await p.evaluate(async () => { const m = window.__game.scene.getScene('MenuScene'), mod = await import('/src/ui/HeroCodexUI.ts'); const ui = mod.openHeroCodex(m, 'zhuge'); const seen = []; const walk = o => { if (o.name?.startsWith?.('attr-badge')) seen.push(o.getData('attr')); if (o.list) o.list.forEach(walk); }; walk(ui.root); window.__codex = ui; return seen; });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/5-codex.png` });
  ck('武将图鉴：诸葛亮名字旁是「智」印', cx.length >= 1 && cx.every(a => a === 'intellect'), cx);
  await p.close();
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
