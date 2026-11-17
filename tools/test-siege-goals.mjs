// 攻城目标：小城拔帅旗、中城三段推进（攻城战重做样板）、大城破门毁楼败大将，最后占领府衙；限时；守城不变。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5187/ node tools/test-siege-goals.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/new-content';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d) : '')); };
const save = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu', 'chibi'], ownedCities: ['xuchang', 'runan', 'guandu', 'chenliu', 'luoyang', 'wancheng'], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 5, intelSeq: 1 };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('SiegeGameScene')";
const open = async (layout, tier, mode) => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(layout + ' console ' + m.text()); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  const city = await p.evaluate(async ([tier, mode]) => {
    const c = await import('/src/world/WorldCities.ts'), w = await import('/src/world/WorldStore.ts'), s = w.loadWorld();
    let id;
    if (mode === 'defense') { id = 'chenliu'; const raw = JSON.parse(localStorage.getItem('im_world_v1')); raw.alerts = [{ city: id, attacker: 'yuanshao', cause: 'era' }]; localStorage.setItem('im_world_v1', JSON.stringify(raw)); localStorage.removeItem('im_world_backup_v1'); }
    else id = c.CITIES.find(x => x.tier === tier && c.cityAttackable(x.id, s.ownedCities))?.id;
    const g = window.__game; g.registry.set('siegeCity', id); if (mode === 'defense') g.registry.set('siegeMode', 'defense'); else g.registry.remove('siegeMode'); g.registry.set('runConfig', { character: 'zhaoyun' });
    for (const sc of g.scene.getScenes(true)) sc.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('SiegeGameScene'); else { g.registry.set('pendingWarlord', 'SiegeGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); }
    return id;
  }, [tier, mode]);
  await p.waitForFunction(() => window.__game.scene.isActive('SiegeGameScene') && window.__game.scene.getScene('SiegeGameScene').player, null, { timeout: 90000 });
  await p.waitForTimeout(1200);
  await p.evaluate(G0 => { const s = eval(G0); s.spawnTimer = s.eliteTimer = 1e9; s.player.damageImmune = true; for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate(); for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; /* 等级合并后的保底三选一（5f89729）：跳时间时会弹出，自动点掉 */ setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); }, 50); }, G);
  return { p, city };
};
const goals = p => p.evaluate(G0 => ({ ...eval(G0).siegeGoals, text: eval(G0).children.getByName('siege-goal')?.text, boss: !!eval(G0).boss?.active, over: eval(G0).over, victory: eval(G0).victory }), G);
const capture = p => p.evaluate(async G0 => { const s = eval(G0); for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate(); s.spawnTimer = 1e9; s.player.damageImmune = false; s.player.hp = s.player.maxHp; s.player.sprite.setPosition(s.capturePoint.x, s.capturePoint.y); for (let i = 0; i < 80 && !s.over; i++) await new Promise(r => setTimeout(r, 150)); return { over: s.over, victory: s.victory, progress: s.siegeGoals.progress, sub: s.resultTexts?.subtitle.text }; }, G);
const owned = (p, id) => p.evaluate(async id => (await import('/src/world/WorldStore.ts')).loadWorld().ownedCities.includes(id), id);

// 小城：拔帅旗 → 占领府衙
{
  const { p, city } = await open('mobile', 'small');
  const g0 = await goals(p);
  const nb = await p.evaluate(async G0 => { const s = eval(G0); s.elapsed = s.chapter.waves[s.chapter.waves.length - 1].start + 5; await new Promise(r => setTimeout(r, 500)); return !!s.boss; }, G);
  ck(`小城（${city}）：帅旗在场、目标行「拔帅旗」、到时间也不出守将`, g0.flag && g0.towers === 0 && /拔帅旗/.test(g0.text) && !nb, { g0, nb });
  await p.evaluate(G0 => { const s = eval(G0); s.hitEnemy(s.flag.e, 1e6, s.combatNow, 'melee', false, false); }, G); await p.waitForTimeout(500);
  const g1 = await goals(p);
  ck('小城：拔掉帅旗 → 进入占领府衙', !g1.flag && g1.capturing && /占领府衙/.test(g1.text), g1);
  const c = await capture(p);
  ck('小城：站进府衙圈、进度满 → 破城占领', c.over && c.victory && await owned(p, city), c);
  await p.close();
}
// 中城（攻城战重做样板，SiegeMidCity）：城外箭楼 2 座 + 箭雨 + 冲车撞门 → 巷战 2 据点 → 府衙守将 → 插旗占领（细项见 test-siege-medium.mjs）
for (const layout of ['mobile', 'desktop']) {
  const { p, city } = await open(layout, 'medium');
  const g0 = await goals(p);
  ck(`[${layout}] 中城（${city}）：三段推进的城外段，两座箭楼、目标行「城外 · 冲车撞门」`, g0.towers === 2 && g0.mid?.phase === 'outside' && /城外/.test(g0.text), g0);
  const shot = await p.evaluate(async G0 => { const s = eval(G0); await new Promise(r => setTimeout(r, 3600)); return s.siegeGoals.mid.stats; }, G);
  ck(`[${layout}] 城头箭雨（有落点预警）`, shot.volleys >= 1 && shot.zones >= 1, shot);
  await p.screenshot({ path: `${out}/${layout}-siege-mid-outside.png` });
  if (layout === 'desktop') {
    const r = await p.evaluate(async G0 => {
      const s = eval(G0), m = s.siegeMid, wait = async ms => { for (let t = 0; t < ms; t += 150) await new Promise(r => setTimeout(r, 150)); };
      m.hitGate(1e6); await wait(2600); const street = m.phase;
      for (const pt of m.points) pt.state = 'secured'; await wait(2600); const hall = m.phase;
      for (let i = 0; i < 20 && !s.boss?.active; i++) await wait(150);
      const boss = !!s.boss?.active; s.player.damageImmune = false; s.player.hp = s.player.maxHp; s.player.invulnUntil = s.combatNow + 60000; /* 结算不按调试局算 */ s.hitEnemy(s.boss, 1e8, s.combatNow, 'melee', false, false);
      for (let i = 0; i < 60 && !s.over; i++) { await wait(150); s.collectBossChests?.(); }
      return { street, hall, boss, over: s.over, victory: s.victory };
    }, G);
    ck('中城：破门 → 巷战 → 府衙 → 击败守将插旗 → 破城', r.street === 'street' && r.hall === 'hall' && r.boss && r.over && r.victory && await owned(p, city), r);
  } else {
    const t = await p.evaluate(async G0 => { const s = eval(G0); s.elapsed = 481; await new Promise(r => setTimeout(r, 500)); return { over: s.over, victory: s.victory }; }, G);
    ck('中城：限时 480 秒未破城 → 失败', t.over && t.victory === false, t);
  }
  await p.close();
}
// 大城：城门 + 箭楼 + 大将 → 占领府衙（击败大将不直接结算）
{
  const { p, city } = await open('desktop', 'large');
  const g0 = await goals(p);
  ck(`大城（${city}）：箭楼 2、城门在、目标行含破城门 / 败大将`, g0.towers === 2 && /破城门/.test(g0.text) && /败大将/.test(g0.text), g0);
  const r = await p.evaluate(async G0 => { const s = eval(G0); for (const t of [...s.towers]) s.hitEnemy(t.e, 1e6, s.combatNow, 'melee', false, false); s.hitEnemy(s.gate, 1e7, s.combatNow, 'melee', false, false); s.elapsed = s.chapter.waves[s.chapter.waves.length - 1].start + 1; await new Promise(r => setTimeout(r, 500)); s.spawnBoss(); const boss = !!s.boss?.active; s.hitEnemy(s.boss, 1e8, s.combatNow, 'melee', false, false); for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 150)); s.collectBossChests?.(); if (s.siegeGoals.capturing) break; } return { boss, over: s.over, goals: s.siegeGoals, mode: s.mode }; }, G);
  ck('大城：破门毁楼、击败大将 → 不立即结算，进入占领府衙', r.boss && !r.over && r.goals.capturing && r.mode === 'none', r);
  const c = await capture(p);
  ck('大城：占领府衙 → 破城', c.over && c.victory && await owned(p, city), c);
  await p.close();
}
// 守城：不出帅旗 / 箭楼，仍以击败敌将守住
{
  const { p } = await open('mobile', 'medium', 'defense');
  const g = await goals(p);
  ck('守城：无帅旗、无箭楼目标', !g.flag && g.towers === 0 && !g.capturing && !g.text, g);
  await p.close();
}
await b.close();
const real = errors.filter(e => !/favicon|ERR_|net::/.test(e));
ck('无页面报错 / 控制台错误', real.length === 0, real.slice(0, 5));
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
