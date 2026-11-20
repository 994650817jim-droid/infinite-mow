// 兵器专职进阶形态专属手绘特效（BranchFinalFx）：把 final() 设为真，出手时画出爆发、常驻光环可见；两个分支各测一遍并截图。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5260/ HERO=zhaoyun BRANCHES=zy_longdan,zy_bainiao node tools/test-branch-final-fx.mjs     截图 assets/review/branch-fx/<分支>.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const E = process.env, BASE = E.BASE ?? 'http://127.0.0.1:5260/', HERO = E.HERO ?? 'zhaoyun', BRANCHES = (E.BRANCHES ?? 'zy_longdan,zy_bainiao').split(','), OUT = 'assets/review/branch-fx'; mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const errs = [];
try {
  for (const br of BRANCHES) {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(h => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', h); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } }, HERO);
    await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop&story=off`, { timeout: 180000, waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS; }, null, { timeout: 180000, polling: 500 }); await p.waitForTimeout(1000);
    const r = await p.evaluate(async br0 => {
      const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9;
      const w = s.player.weapons[0]; w.level = 5; w.branch = br0; w.over = 2; s.player.stats.cooldownMul = .4;
      let rt = s.branchRt; for (let i = 0; i < 30 && !rt; i++) { await new Promise(r => setTimeout(r, 100)); rt = s.branchRt; } if (!rt) return { err: 'no branchRt' }; rt.final = () => true;
      const seen = new Set(), poll = setInterval(() => s.children.list.forEach(o => { if (o.name === 'branch-final-fx') seen.add(o); }), 30);
      for (let k = 0; k < 6; k++) { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const e = s.spawnEnemy('infantry', s.player.x + Math.cos(a) * 120, s.player.y + Math.sin(a) * 120, 3, true); if (e) { e.speed = 0; e.hp = e.maxHp = 9e5; } } await new Promise(r => setTimeout(r, 900)); }
      clearInterval(poll); const aura = s.children.list.find(o => o.name === 'branch-final-aura');
      return { bursts: seen.size, stats: { ...rt.finalFx.stats }, aura: !!aura?.visible, tex: s.textures.exists('fx_bf_zhaoyun') };
    }, br);
    ck(`${br}：进阶出手爆发 + 常驻光环`, r.bursts >= 1 && r.aura, r);
    await p.waitForTimeout(150); await p.screenshot({ path: `${OUT}/${br}.png`, clip: { x: 390, y: 180, width: 500, height: 330 } });
    await p.context().close();
  }
  ck('无页面报错', errs.length === 0, errs.slice(0, 3));
  console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); process.exitCode = rows.every(Boolean) ? 0 : 1;
} finally { await b.close(); }
