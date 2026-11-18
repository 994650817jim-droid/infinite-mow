// 中途退出不算：进 1-1 → 本场里升级 / 得军粮 / 得兵装（都已写进存档）→ 暂停里「返回选将」中途退出 → 重载后等级与资源回到进关前；
// 模拟刷新页面同样回滚；告捷（进行营）后的所得则保留。不带 ?dev=1（走正式存档）。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-quit-rollback.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const ready = () => p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  /** 存档里的武将等级、军粮、行囊件数、快照是否在。 */
  const save = () => p.evaluate(async () => { const H = await import('/src/systems/HeroProgress.ts'), W = await import('/src/world/WorldStore.ts'), I = await import('/src/systems/ItemStore.ts'); return { lv: H.heroInfo('zhaoyun').level, xp: H.heroInfo('zhaoyun').xp, prov: W.loadWorld().provisions, bag: I.loadItems().bag.length, snap: localStorage.getItem('im_battle_snapshot') !== null }; });
  /** 本场里往存档写东西（模拟升级、得军粮、得兵装都已即时写入）。 */
  const gain = () => p.evaluate(async () => { const H = await import('/src/systems/HeroProgress.ts'), W = await import('/src/world/WorldStore.ts'), I = await import('/src/systems/ItemStore.ts'), D = await import('/src/data/items.ts');
    const i = H.heroInfo('zhaoyun'); H.setHeroProgress('zhaoyun', i.level + 4, 0); W.addProvisions(77); const it = D.rollItem('blue'); if (it) I.addItems([it]); });
  const start11 = async () => {
    await p.evaluate(() => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 1 }); const cur = g.scene.getScene('GameScene'); if (cur && g.scene.isActive('GameScene')) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); } });
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await p.waitForTimeout(600);
  };
  await p.goto(BASE + '?layout=desktop'); await p.evaluate(() => localStorage.clear()); await p.reload(); await ready();
  await p.evaluate(async () => { const W = await import('/src/world/WorldStore.ts'); W.setTutorialSeen(true); W.addProvisions(30); });
  const base = await save();
  // ① 暂停 →「返回选将」中途退出
  await start11();
  ck('进关时记下快照', (await save()).snap, await save());
  await gain();
  const mid = await save();
  ck('本场里升级 / 得军粮 / 得兵装已写进存档', mid.lv === base.lv + 4 && mid.prov === base.prov + 77, { base, mid });
  await p.evaluate(S0 => { const s = eval(S0); s.player.damageImmune = true; s.togglePause(); }, S);
  await p.waitForTimeout(300);
  const confirm = await p.evaluate(S0 => { const s = eval(S0), e = s.pausePanel.getByName('pause-exit'); e.emit('pointerdown'); return e.text; }, S);
  ck('「返回选将」二次确认文案：退出后本场获得的等级与资源不保留', confirm.includes('退出后本场获得的等级与资源不保留'), confirm);
  const nav = p.waitForEvent('load', { timeout: 30000 }).catch(() => null);
  await p.evaluate(S0 => { const s = eval(S0); s.pausePanel.getByName('pause-exit').emit('pointerdown'); }, S);
  await nav; await ready();
  const after1 = await save();
  ck('中途退出 → 重载后等级、军粮、行囊回到进关前，快照清掉', after1.lv === base.lv && after1.xp === base.xp && after1.prov === base.prov && after1.bag === base.bag && !after1.snap, { base, after1 });
  // ② 打到一半刷新页面
  await start11(); await gain();
  ck('刷新前：本场所得已写进存档', (await save()).prov === base.prov + 77, await save());
  await p.reload(); await ready();
  const after2 = await save();
  ck('刷新页面（视同中途退出）→ 启动时回滚到进关前', after2.lv === base.lv && after2.prov === base.prov && after2.bag === base.bag && !after2.snap, { base, after2 });
  // ③ 告捷进行营：本场所得保留
  await start11(); await gain();
  await p.evaluate(S0 => { const s = eval(S0); s.setMode('rest'); }, S);
  await p.waitForTimeout(300);
  ck('告捷进行营 → 快照丢掉（本场所得生效）', !(await save()).snap, await save());
  await p.reload(); await ready();
  const after3 = await save();
  ck('告捷后刷新：等级与资源保留', after3.lv === base.lv + 4 && after3.prov === base.prov + 77, { base, after3 });
  // ④ 战败：沿用现行规则（结算后快照丢掉，不回滚）
  const before4 = await save();
  await start11();
  await p.evaluate(S0 => { const s = eval(S0); s.finish(false, 'death'); }, S);
  await p.waitForTimeout(400);
  ck('战败结算 → 快照丢掉（沿用现行规则，不回滚）', !(await save()).snap, { before4, now: await save() });
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
