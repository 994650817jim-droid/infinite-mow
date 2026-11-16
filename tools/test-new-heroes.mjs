// 新女将：孙尚香（吴 · 弓腰姬：移动积疾步 → 环身 8 向连射）、貂蝉（群雄 · 闭月倾城：爆发命中积舞势 → 倾城易伤 + 减速）。
// 每将：手机 390×844 与电脑 1280×720 两种布局进第 1 关；检查行走 / 动作图、立绘、本命武器、被动触发效果；
// 选将界面能翻到并选中新将；全程无 pageerror / console error。截图存 assets/review/new-heroes/。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5191/ node tools/test-new-heroes.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/new-heroes';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const HEROES = { sunshangxiang: { name: '孙尚香', weapon: 'crossbow', index: 10 }, diaochan: { name: '貂蝉', weapon: 'flame_banner', index: 11 } };
const LAYOUTS = { mobile: { width: 390, height: 844 }, desktop: { width: 1280, height: 720 } };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const watch = (p, tag) => { p.on('pageerror', e => errors.push(tag + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(tag + ' ' + m.text()); }); };

for (const [layout, viewport] of Object.entries(LAYOUTS)) for (const [hero, h] of Object.entries(HEROES)) {
  const tag = `${h.name}(${layout === 'mobile' ? '手机' : '电脑'})`;
  const p = await b.newPage({ viewport }); watch(p, tag);
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=${layout}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 30000 });
  await p.waitForTimeout(1500); // 等首局后台素材（兵种立绘等）加载完再重启，避免重启打断加载
  await p.evaluate(([G0, id, w]) => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: w }); s.scene.restart(); }, [G, hero, h.weapon]);
  await p.waitForTimeout(400);
  await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === id && s.__DEV_ACTIONS; }, hero, { timeout: 20000 });
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; }, G);
  await p.waitForTimeout(300);
  const st = await p.evaluate(([G0, id]) => { const s = eval(G0), pl = s.player; return { sheet: pl.sprite.texture.key, walk: pl.walkSheet, weapon: pl.weapons[0].id, passive: pl.passive.snapshot(s.combatNow).character, portrait: s.textures.exists(id + '_portrait'), actions: pl.hasActions, frameH: Math.round(pl.sprite.displayHeight), hpMax: pl.maxHp }; }, [G, hero]);
  ck(`${tag}：行走 / 动作图（正式高清）、立绘、本命武器、专属被动`, st.walk === hero + '_walk_sheet' && st.weapon === h.weapon && st.passive === hero && st.portrait && st.actions && st.frameH > 30, st);

  if (hero === 'sunshangxiang') {
    // 敌人放远一些，先按住 D 键走 4 秒积疾步，再观察环身连射
    await p.evaluate(G0 => { const s = eval(G0), pl = s.player; window.__shots = []; const orig = s.fireBolt.bind(s); s.fireBolt = (...a) => { if (a[0] === s.bolts) window.__shots.push(Math.round(s.combatNow)); return orig(...a); }; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, e = s.spawnEnemy('infantry', pl.x + 260 + Math.cos(a) * 60, pl.y + Math.sin(a) * 60, 1); if (e) { e.hp = e.maxHp = 99999; e.speed = 0; } } }, G);
    await p.mouse.click(viewport.width / 2, 40).catch(() => {});
    await p.keyboard.down('KeyD'); await p.waitForTimeout(1800); await p.keyboard.up('KeyD');
    await p.keyboard.down('KeyA'); await p.waitForTimeout(1800); await p.keyboard.up('KeyA');
    const r = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player, sn0 = pl.passive.snapshot(s.combatNow);
      const t0 = performance.now(); let sn = sn0;
      while (performance.now() - t0 < 8000) { await new Promise(r => setTimeout(r, 30)); sn = pl.passive.snapshot(s.combatNow); if (sn.triggers > 0) break; }
      await new Promise(r => setTimeout(r, 100));
      const per = {}; for (const t of window.__shots) per[t] = (per[t] ?? 0) + 1;
      return { stacksAfterWalk: sn0.stacks, gains: sn.gains, triggers: sn.triggers, maxBolts: Math.max(0, ...Object.values(per)) };
    }, G);
    ck(`${tag}：移动积满 6 层疾步，下一射触发环身连射（同一帧射出 ≥9 箭：普射 1 + 环射 8）`, r.stacksAfterWalk + r.triggers * 6 >= 6 && r.triggers >= 1 && r.maxBolts >= 9, r);
    await p.waitForTimeout(120);
  } else {
    const r = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player, foes = [];
      for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, e = s.spawnEnemy('infantry', pl.x + Math.cos(a) * 70, pl.y + Math.sin(a) * 70, 1); if (e) { e.hp = e.maxHp = 99999; foes.push(e); } }
      const t0 = performance.now(); let sn = pl.passive.snapshot(s.combatNow), seen = null;
      while (performance.now() - t0 < 25000) {
        await new Promise(r => setTimeout(r, 30)); sn = pl.passive.snapshot(s.combatNow);
        if (sn.charms > 0 && !seen) { const e = foes.find(f => f.active && pl.passive.vulnerability(f, s.combatNow) > 1); if (e) seen = { vul: pl.passive.vulnerability(e, s.combatNow), slow: e.martialSlow, slowLeft: Math.round(e.martialSlowUntil - s.combatNow), charms: sn.charms }; }
        if (seen) break;
      }
      return { triggers: sn.triggers, gains: sn.gains, seen };
    }, G);
    ck(`${tag}：舞势积满后倾城——命中敌人易伤 ×1.25、减速至 60%`, r.triggers >= 1 && r.seen && Math.abs(r.seen.vul - 1.25) < 1e-6 && r.seen.slow <= .6 + 1e-6 && r.seen.slowLeft > 0, r);
    await p.waitForTimeout(150);
  }
  await p.screenshot({ path: `${out}/${hero}-battle-${layout}.png` });
  await p.close();
}

// 选将界面：两种布局都能翻到第 3 页并选中新将，确认后主页记住
for (const [layout, viewport] of Object.entries(LAYOUTS)) {
  const p = await b.newPage({ viewport }); watch(p, 'picker-' + layout);
  await p.goto(base + `?layout=${layout}`); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 30000 }); await p.waitForTimeout(600);
  const pg = await p.evaluate(async () => {
    const s = window.__game.scene.getScene('MenuScene'), hp = s.heroPicker; hp.open(10); await new Promise(r => setTimeout(r, 300));
    const vis = hp.cards.map((c, i) => c.root.visible ? i : -1).filter(i => i >= 0);
    const names = vis.map(i => hp.cards[i].name.text);
    const card = hp.root.getByName('pick-diaochan'); card?.emit('pointerdown');
    return { vis, names, candidate: hp.candidate, page: hp.pageText?.text };
  });
  ck(`选将(${layout})：第 3 页显示庞统、黄月英、孙尚香、貂蝉，可点选`, pg.vis.join() === '8,9,10,11' && pg.names.slice(2).join() === '孙尚香,貂蝉' && pg.candidate === 11, pg);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/picker-${layout}.png` });
  const conf = await p.evaluate(async () => { const s = window.__game.scene.getScene('MenuScene'); s.heroPicker.root.getByName('hero-confirm').emit('pointerdown'); await new Promise(r => setTimeout(r, 300)); return { saved: localStorage.getItem('im_last_hero'), sel: s.selectedChar }; });
  ck(`选将(${layout})：确认出战后记住貂蝉`, conf.saved === 'diaochan' && conf.sel === 11, conf);
  await p.waitForTimeout(400); await p.screenshot({ path: `${out}/home-${layout}.png` });
  await p.evaluate(() => localStorage.removeItem('im_last_hero'));
  await p.close();
}
ck('无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
