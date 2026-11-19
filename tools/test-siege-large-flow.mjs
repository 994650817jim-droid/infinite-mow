// 攻城大城正式流程（不走 transition / 直接改门血等捷径）：城外 → 瓮城 → 巷战 → 内城（府衙）→ 破城。
// 主将只「走到」目标旁（每 20 帧把主将放回目标点，相当于玩家站着不动），砍绳索 / 砍内门 / 打首领都靠武器自动出手，冲车自己撞门，据点照常占领、守军照常反扑。
// 每段记录用时；某段超过上限判「卡住」并打印现场（阶段、冲车、门血、绳索、内门、据点、主将位置、是否被碰撞框挡住）。
// 主将免伤（只查流程会不会卡住，不查难度）。首领段：先用武器打 90 秒，仍未倒下再补一刀（记在结果里）。
// 用法：BASE=http://127.0.0.1:5212/ node tools/test-siege-large-flow.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/siege-large-flow';
mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const save = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu', 'chibi'], ownedCities: ['xuchang', 'runan', 'guandu', 'chenliu', 'luoyang', 'wancheng'], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 5, intelSeq: 1 };
const G = "window.__game.scene.getScene('SiegeGameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::|ERR_/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  const city = await p.evaluate(async () => {
    const c = await import('/src/world/WorldCities.ts'), w = await import('/src/world/WorldStore.ts'), s = w.loadWorld();
    const id = c.CITIES.find(x => x.tier === 'large' && c.cityAttackable(x.id, s.ownedCities))?.id;
    const g = window.__game; g.registry.set('siegeCity', id); g.registry.remove('siegeMode'); g.registry.set('runConfig', { character: 'zhaoyun' });
    for (const sc of g.scene.getScenes(true)) sc.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('SiegeGameScene'); else { g.registry.set('pendingWarlord', 'SiegeGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); }
    return id;
  });
  await p.waitForFunction(() => window.__game.scene.isActive('SiegeGameScene') && window.__game.scene.getScene('SiegeGameScene').player, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(G0 => {
    const g = window.__game, s = eval(G0); s.__DEV_ACTIONS?.closePopup?.();
    s.player.damageImmune = true;
    g.loop.sleep(); window.__T = performance.now(); s.readMove = () => new Phaser.Math.Vector2(0, 0);
    window.__S = s; window.__M = s.siegeMid;
    // 升级 / 招募弹窗：选第一项（正式流程里玩家也要选）；剧情一律点下一句
    window.__step = n => { for (let i = 0; i < n; i++) { if (s.mode !== 'none' && !s.over) { if (s.mode === 'levelup') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') { if (s.chooseRecruit) s.chooseRecruit(0); if (s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); } else if (s.mode === 'story') { for (const o of s.children.list) { const btn = o.list?.find(q => /-(next|confirm)$/.test(q.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } } else if (s.mode !== 'paused') s.__DEV_ACTIONS?.closePopup?.(); } window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); } };
    window.__state = () => { const m = window.__M, pl = s.player, boxes = s.sishuiObstacles?.footprints ?? []; return { phase: m.phase, ram: m.ramInfo && { state: m.ramInfo.state, x: Math.round(m.ramInfo.x), y: Math.round(m.ramInfo.y), hp: Math.round(m.ramInfo.hp) }, gate: Math.round(m.gateHp), bridge: m.bridgeDown, ropes: m.ropesLeft, inner: m.innerGateHp, points: (m.points ?? []).map(pt => pt.state), boss: s.boss?.active ? Math.round(s.boss.hp) : null, player: [Math.round(pl.x), Math.round(pl.y)], inBox: boxes.some(b => pl.x > b.left && pl.x < b.right && pl.y > b.top && pl.y < b.bottom), mode: s.mode, over: s.over, victory: s.victory, goal: s.children.getByName('siege-goal')?.text, enemies: s.activeEnemyCount?.() }; };
  }, G);
  const st = () => p.evaluate(() => window.__state());
  const T = { framesPerTick: 20 }; let simSec = 0;
  /** 每 20 帧把主将放到 where()（返回 null = 不动），直到 done() 或超时（秒，游戏时间）。 */
  const run = async (label, where, done, maxSec) => {
    const t0 = simSec;
    for (let k = 0; k < maxSec * 3; k++) {
      const r = await p.evaluate(([w, d]) => { const s = window.__S; const pos = eval('(' + w + ')')(s, window.__M); if (pos) s.player.sprite.setPosition(pos[0], pos[1]); window.__step(20); return eval('(' + d + ')')(s, window.__M); }, [String(where), String(done)]);
      simSec += 20 / 60;
      if (r) return { ok: true, sec: +(simSec - t0).toFixed(1) };
    }
    return { ok: false, sec: +(simSec - t0).toFixed(1), state: await st() };
  };
  const s0 = await st();
  console.log('START', city, JSON.stringify(s0));
  // ① 城外：先砍两根吊桥绳索（站到绳索南岸），再护送冲车撞门
  const ropes = await run('ropes', (s, m) => { const r = m.ropes?.find(r => r.e.active && r.e.spawnId === r.life); return r ? [r.x, r.y + 90] : null; }, (s, m) => m.bridgeDown, 120);
  ck('大城 · 城外：主将站到绳索旁，武器自动砍断两根绳索 → 吊桥落下', ropes.ok, ropes);
  // 冲车被毁：回营地领新车（正式流程里玩家就是这么做的）
  const gate = await run('ram', (s, m) => { const r = m.ramInfo; return !r || r.state === 'wreck' ? [0, 250] : [r.x + 60, r.y + 40]; }, (s, m) => m.phase !== 'outside', 400);
  console.log('RAM', JSON.stringify(await p.evaluate(() => window.__M.stats)));
  await p.screenshot({ path: `${OUT}/1-outside-done.png` });
  ck('大城 · 城外：护送冲车过桥撞破城门 → 转场进瓮城', gate.ok, gate);
  if (!gate.ok) throw new Error('stuck outside');
  const inB = await st(); console.log('BARBICAN', JSON.stringify(inB));
  ck('大城 · 瓮城：转场后主将不在碰撞框里、目标是内门', inB.phase === 'barbican' && !inB.inBox && inB.inner > 0, inB);
  // ② 瓮城：走到内门前，武器自动砍
  const barb = await run('barbican', (s, m) => [3000, -430], (s, m) => m.phase !== 'barbican', 240);
  await p.screenshot({ path: `${OUT}/2-barbican-done.png` });
  ck('大城 · 瓮城：站在内门前，武器自动砍破内门 → 进巷战', barb.ok, barb);
  if (!barb.ok) throw new Error('stuck barbican');
  // ③ 城内：依次站进要点（占领 + 守 20 秒），占够 4 处开内城门
  const street = await run('street', (s, m) => { const pt = m.points.find(q => q.state !== 'secured'); return pt ? [pt.x, pt.y] : null; }, (s, m) => m.phase !== 'street', 300);
  await p.screenshot({ path: `${OUT}/3-street-done.png` });
  ck('大城 · 城内：依次占领并守住要点，占够 4 处 → 内城门开、进府衙', street.ok, street);
  if (!street.ok) throw new Error('stuck street');
  // ④ 府衙：首领出场；先用武器打 90 秒
  const appear = await run('hall-boss', () => null, s => !!s.boss?.active, 60);
  ck('大城 · 府衙：守城名将出场', appear.ok, appear);
  const fight = await run('hall-fight', s => s.boss?.active ? [s.boss.x - 70, s.boss.y + 20] : null, s => !s.boss?.active || s.over, 90);
  let finished = 'weapons';
  if (!fight.ok) { finished = 'finish-blow'; await p.evaluate(() => { const s = window.__S; for (const g of window.__M.guards ?? []) g.e?.active && g.e.deactivate(); s.hitEnemy(s.boss, 1e8, s.combatNow, 'melee', false, false); }); }
  const end = await run('chest-flag', s => { s.collectBossChests?.(); const c = s.bossChests?.[0]; return c && c.x !== undefined ? [c.x, c.y] : null; }, s => s.over, 90);
  const fin = await st();
  await p.screenshot({ path: `${OUT}/4-end.png` });
  ck(`大城 · 府衙：击败名将（${finished === 'weapons' ? '武器打倒' : '打了 90 秒后补刀'}）→ 宝箱 → 插旗 → 破城`, end.ok && fin.victory, { end, fin });
  console.log(`TIMES ropes ${ropes.sec}s · ram ${gate.sec}s · barbican ${barb.sec}s · street ${street.sec}s · boss ${appear.sec}+${fight.sec}s (${finished}) · end ${end.sec}s · total ${simSec.toFixed(0)}s`);
} catch (e) { console.log('ERROR', String(e)); fail++; }
finally { await b.close(); }
ck('无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
