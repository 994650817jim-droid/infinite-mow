// 敌我区分（src/systems/IffOverlay.ts）。用户选定：方案 a 阵营色默认开启；方案 c 描边在「军中设置 · 敌我描边」开启。
// 电脑布局 1280×720：?iff=0 原样 / 默认 / 默认 + 设置开描边 三张混战截图，设置面板截图；检查空闲预生成、
// 随行武将不换色、150 敌同屏叠加层耗时。截图存 assets/review/iff/。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5197/ node tools/test-iff.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/iff';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });

// 1. 设置面板：有「敌我描边」一行，默认关，点一下变开并写入存档
{
  const p = await ctx.newPage(); p.on('pageerror', e => errors.push('menu ' + e.message));
  await p.goto(base + '?layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.waitForTimeout(800);
  const r = await p.evaluate(async () => {
    const s = window.__game.scene.getScene('MenuScene'); s.openHomeSettings();
    await new Promise(r => setTimeout(r, 200));
    const panel = s.children.getByName('home-settings-panel'), find = n => panel.list.find(o => o.name === n);
    const row = find('settings-iff-outline'), before = row?.text, inc = panel.list.find(o => o.name === 'settings-iff-outline-inc'); /* 2026-11-18 设置改版 */
    inc?.emit('pointerdown'); await new Promise(r => setTimeout(r, 100));
    // 面板不超出画面：所有子对象在 0..H 内
    const H = s.scale.gameSize.height, ys = panel.list.filter(o => o.visible && o.getBounds).map(o => o.getBounds()).map(bb => [bb.top, bb.bottom]).flat();
    return { before, after: row?.text, stored: localStorage.getItem('im_iff_outline'), quit: !!find('settings-quit'), minY: Math.min(...ys), maxY: Math.max(...ys), H };
  });
  await p.screenshot({ path: `${out}/settings-desktop.png` });
  ck('设置面板「敌我描边」默认关，点一下变开并存档；面板不出画面', /关$/.test(r.before) && /仅敌人$/.test(r.after) && r.stored === 'enemy' && r.minY >= 0 && r.maxY <= r.H /* 2026-11-17：描边改三档（关 / 仅敌人 / 敌我都描），电脑版行只显示值 */, r);
  // 空闲预生成：回到菜单后浏览器空闲，换色 / 轮廓贴图陆续生成
  await p.waitForTimeout(4000);
  const warm = await p.evaluate(() => { const k = window.__game.textures.getTextureKeys(); return { recolor: k.filter(x => x.startsWith('iffA_')).length, outline: k.filter(x => x.startsWith('iffO_')).length }; });
  ck('启动后空闲时预生成换色贴图（进战斗前已就绪）', warm.recolor >= 8, warm);
  await p.evaluate(() => localStorage.setItem('im_iff_outline', '0'));
  await p.close();
}

const CASES = [
  { name: 'off', q: '&iff=0', outline: '0' },
  { name: 'default', q: '', outline: '0' },
  { name: 'default-outline', q: '', outline: '1' },
];
for (const c of CASES) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(c.name + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(c.name + ' ' + m.text()); });
  await p.addInitScript(v => { try { localStorage.setItem('im_iff_outline', v); } catch { /* ignore */ } }, c.outline);
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=desktop${c.q}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  // 固定的混战：左侧 8 名部曲，右前方一群黄巾（含 2 名精锐），两军交错
  const r = await p.evaluate(() => {
    const g = window.__game, s = g.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.();
    g.loop.sleep(); let T = performance.now(); const step = n => { for (let i = 0; i < n; i++) { T += 1000 / 60; g.step(T, 1000 / 60); } };
    s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
    const px = s.player.x, py = s.player.y; s.legion.clear?.();
    ['swordsman', 'spearman', 'archer', 'crossbowman', 'guardian', 'rider', 'halberdier', 'medic'].forEach((k, i) => { s.legion.recruit(k, 1, true); s.allies.at(-1)?.setPosition(px - 40 + (i % 4) * 34, py + 40 + Math.floor(i / 4) * 44); });
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) { const e = s.spawnEnemy(i === 5 || i === 17 ? 'elite' : i % 4 === 0 ? 'shield' : 'infantry', px + 30 + rnd() * 230, py - 120 + rnd() * 240, 1, true); if (e) e.hp = e.maxHp = 1e6; }
    step(75);
    s.scene.pause();
    return { iff: s.iff ? { ...s.iff.mode } : null, stats: s.iff ? { ...s.iff.stats } : null, overlays: s.children.list.filter(o => o.name === 'iff-overlay').length };
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/iff-${c.name}.png` });
  if (c.name === 'off') ck('?iff=0：不创建叠加层（原画）', !r.iff && r.overlays === 0, r);
  else if (c.name === 'default') ck('默认（不加参数、描边关）：阵营色生效，无描边、无徽记', r.iff?.tint && !r.iff.outline && !r.iff.marks && r.stats.recolored >= 30 && r.overlays === 0, r);
  else ck('设置开「敌我描边」：阵营色 + 描边', r.iff?.tint && r.iff.outline && r.stats.recolored >= 30 && r.stats.outlines >= 30, r);
  if (c.name !== 'off') {
    const perf = await p.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene'), px = s.player.x, py = s.player.y;
      for (let i = 0; i < 124; i++) { const e = s.spawnEnemy(i % 9 === 0 ? 'archer' : 'infantry', px - 500 + (i % 16) * 62, py - 300 + Math.floor(i / 16) * 70, 1, true); if (e) e.hp = e.maxHp = 1e6; }
      s.iff.update(); const n = 120, t0 = performance.now(); for (let i = 0; i < n; i++) s.iff.update(); return { msPerFrame: +((performance.now() - t0) / n).toFixed(3), enemies: s.enemies.filter(e => e.active).length };
    });
    ck(`${c.name}：150 敌同屏叠加层每帧 < 1.5ms`, perf.msPerFrame < 1.5 && perf.enemies >= 140, perf);
  }
  // 随行武将保持原画（武将标志色不换）
  if (c.name === 'default') {
    const keep = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); const units = [...s.iffUnits()]; const f = units.filter(u => u.keepColors); return { followers: f.length, recolored: f.filter(u => u.sprite.texture.key.startsWith('iffA_')).length }; });
    ck('随行武将不换色', keep.recolored === 0, keep);
  }
  await p.close();
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
