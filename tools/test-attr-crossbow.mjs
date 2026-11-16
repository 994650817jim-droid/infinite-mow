// 每级 +1 属性点（三选一不再有通脉修习）、加点按钮与属性面板新样式、黄忠连弩每级多 1 支分射、1-2 弓手比例。
// 需要开发服务器 5173。用法：node tools/test-attr-crossbow.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/attr-crossbow';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const mod = n => `performance.getEntriesByType('resource').map(e => e.name).find(x => x.includes('${n}'))`;
for (const layout of ['mobile', 'desktop']) {
  const p = await b.newPage(layout === 'mobile' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=${layout}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS);
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active) e.hp = 0; }, G);
  await p.waitForTimeout(300);
  if (layout === 'mobile') {
    const lv = await p.evaluate(async ([G0, M]) => {
      const s = eval(G0), pl = s.player, g = pl.growth, before = g.unallocated, l0 = pl.level;
      const gained = pl.gainXp(pl.xpNext - pl.xp + .01); const one = g.unallocated - before, l1 = pl.level;
      const two = pl.gainXp(400); const many = g.unallocated - before - one;
      const u = await import(eval(M)); let card = false;
      for (let i = 0; i < 300; i++) if (u.buildUpgradeOptions(pl, pl.weapons, g).some(o => o.id === 'attribute_points_2' || o.kind === 'attribute')) { card = true; break; }
      return { gained, one, two, many, card, total: g.unallocated, l0, l1, l2: pl.level };
    }, [G, mod('/src/data/upgrades.ts')]);
    // 2026-11-15 规则：每升 2 级（到达偶数等级）得 1 点；连升多级按途经的偶数级给点
    const even = (a, b) => Math.floor(b / 2) - Math.floor(a / 2);
    ck('局内升级（战功）不再给属性点（2026-11-16 起属性点来自武将等级，每级 1 点，见 test-hero-level）', lv.gained === 1 && lv.one === 0 && lv.many === 0, lv);
    ck('三选一不再出现「通脉修习」', !lv.card);
    // 关掉升级面板，看战场加点按钮
    await p.evaluate(G0 => { const s = eval(G0); s.pendingLevels = 0; s.upgradeOptions = []; s.setMode('none'); s.player.growth.unallocated = 3; }, G);
    await p.waitForTimeout(250);
    const btn = await p.evaluate(G0 => { const s = eval(G0), b = s.children.getByName('attribute-plus'); return { type: b?.type, visible: b?.visible, badge: s.pointsBadge?.text, icon: b?.list?.some(o => o.type === 'Image' && o.texture.key === 'growth_icon_points') }; }, G);
    ck('战场加点按钮：圆形徽章 + 通脉图标 + 点数 3', btn.type === 'Container' && btn.visible && btn.badge === '3' && btn.icon, btn);
    await p.screenshot({ path: `${out}/mobile-points-button.png` });
    await p.evaluate(G0 => eval(G0).children.getByName('attribute-plus').emit('pointerdown', {}, 0, 0, { stopPropagation() {} }), G);
    await p.waitForTimeout(250);
    const panel = await p.evaluate(G0 => { const s = eval(G0); const sum = s.attributeSummaryText.getBounds(), firstRow = s.attributeRows[0].button.getBounds(); return { mode: s.mode, points: s.attributePointsText.text, summaryBottom: Math.round(sum.bottom), firstRowTop: Math.round(firstRow.top - 4) }; }, G);
    ck('点按钮打开属性面板，显示“可分配属性点 3”', panel.mode === 'attributes' && panel.points === '可分配属性点 3', panel);
    ck('“实际属性”两行不再被属性行压住', panel.summaryBottom <= panel.firstRowTop, panel);
    await p.evaluate(G0 => { const s = eval(G0); s.attributePanel.getByName('attribute-add-might').emit('pointerdown'); s.attributePanel.getByName('attribute-add-might').emit('pointerdown'); }, G);
    const after = await p.evaluate(G0 => { const s = eval(G0); return { might: s.player.growth.attributes.might, left: s.player.growth.unallocated, value: s.attributeRows[0].value.text, points: s.attributePointsText.text }; }, G);
    ck('加两点武力：2/8，剩 1 点', after.might === 2 && after.left === 1 && after.value === '2/8' && after.points === '可分配属性点 1', after);
    await p.screenshot({ path: `${out}/mobile-attribute-panel.png` });
    await p.evaluate(G0 => { const s = eval(G0); s.attributePanel.getByName('attribute-add-quickness').emit('pointerdown'); }, G);
    ck('点数用完后提示“武将每升 1 级获得 1 点”', /武将每升 1 级获得 1 点/.test(await p.evaluate(G0 => eval(G0).attributePointsText.text, G)));
    await p.evaluate(G0 => eval(G0).attributePanel.getByName('attributes-close').emit('pointerdown'), G);
    // 黄忠连弩：各级每轮箭数
    const bow = await p.evaluate(async ([G0, R]) => {
      const s = eval(G0), r = await import(eval(R)), pl = s.player; const out = {};
      for (const e of s.enemies) if (e.active) e.hp = 0;
      const foes = []; for (let i = 0; i < 6; i++) { const e = s.spawnEnemy('infantry', pl.x + 120 + i * 30, pl.y + (i % 2 ? 40 : -40), 1); e.hp = e.maxHp = 1e6; foes.push(e); }
      await new Promise(res => setTimeout(res, 50));
      const fired = []; const orig = s.fireBolt.bind(s); s.fireBolt = (...a) => { fired.push({ tx: Math.round(a[3]), ty: Math.round(a[4]), dmg: +a[5].toFixed(1) }); };
      for (const lv of [1, 2, 3, 5]) { fired.length = 0; const w = { id: 'crossbow', level: lv, cooldownLeft: 0 }; r.WEAPON_BEHAVIORS.crossbow(s, w, .016, s.combatNow); out[lv] = { n: fired.length, targets: new Set(fired.map(f => f.tx + ',' + f.ty)).size, dmg: fired.map(f => f.dmg) }; }
      s.fireBolt = orig; out.extra = [1, 2, 3, 4, 5].map(l => r.crossbowExtraArrows(l));
      out.keys = Object.keys(r).filter(k => /UPDATE|update|crossbow/i.test(k));
      return out;
    }, [G, mod('/src/weapons/registry.ts')]);
    ck('连弩额外箭数：Lv1–5 = 0,1,2,3,4', bow.extra.join() === '0,1,2,3,4', bow.extra);
    const ok = bow[5]?.n >= 5 && bow[5].targets >= 5 && bow[1]?.n >= 1 && bow[2]?.n === bow[1].n + 1;
    ck('连弩实射：Lv1 1 支、Lv2 多 1 支、Lv5 5 支分射 5 个目标（额外箭 70%）', ok, bow);
    // 1-2 敌兵比例
    const mix = await p.evaluate(async C => { const c = await import(eval(C)); const ch = c.getBattleChapter('huangjin', 2); const n = { early: {}, late: {} }; for (let i = 0; i < 4000; i++) { const a = ch.pickEnemy(30), b2 = ch.pickEnemy(200); n.early[a] = (n.early[a] ?? 0) + 1; n.late[b2] = (n.late[b2] ?? 0) + 1; } const pct = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v / 40)])); return { name: ch.name, early: pct(n.early), late: pct(n.late) }; }, mod('/src/data/chapters.ts'));
    ck('1-2 弓手约 15%（前 3 分钟）/ 14%（之后）', Math.abs((mix.early.archer ?? 0) - 15) <= 3 && Math.abs((mix.late.archer ?? 0) - 14) <= 3, mix);
  }
  if (layout === 'desktop') {
    await p.evaluate(G0 => { const s = eval(G0); s.pendingLevels = 0; s.upgradeOptions = []; s.setMode('none'); s.player.growth.unallocated = 2; }, G); await p.waitForTimeout(200);
    await p.evaluate(G0 => eval(G0).children.getByName('attribute-plus').emit('pointerdown', {}, 0, 0, { stopPropagation() {} }), G); await p.waitForTimeout(200);
    const panel = await p.evaluate(G0 => { const s = eval(G0); const sum = s.attributeSummaryText.getBounds(), firstRow = s.attributeRows[0].button.getBounds(); return { mode: s.mode, summaryBottom: Math.round(sum.bottom), firstRowTop: Math.round(firstRow.top - 4) }; }, G);
    ck('电脑：属性面板打开且不重叠', panel.mode === 'attributes' && panel.summaryBottom <= panel.firstRowTop, panel);
    await p.screenshot({ path: `${out}/desktop-attribute-panel.png` });
  }
  await p.close();
}
ck('无 pageerror', errors.length === 0, errors.slice(0, 3));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
