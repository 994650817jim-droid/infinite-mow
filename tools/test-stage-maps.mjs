// 有边场地（按剧情定场地）第一批检查：边界 / 镜头 / 刷兵关口 / 守边 / 本关互动 / 打得完。截图 assets/review/stage-maps/。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-stage-maps.mjs [5-1,3-2,4-3,8-1]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const heroRec = id => ({ id, kind: 'hero', hero: id, name: id, template: 'spear', quality: 'orange', rank: 1, picks: [] });
const roster = { version: 1, lord: 'zhaoyun', lordFinal: true, owned: [heroRec('zhaoyun'), heroRec('zhangfei'), { id: 'r_1', kind: 'common', name: '王勇', template: 'bow', quality: 'green', rank: 1, picks: [] }, { id: 'r_2', kind: 'named', name: '李平', template: 'blade', quality: 'purple', rank: 1, picks: [] }], followers: ['zhangfei', 'r_1', 'r_2'], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 2, hall: 3 };
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 12, tutorialDone: true };
const heroes = { version: 1, migrated: true, attrSet: 3, heroes: { zhaoyun: { level: 20, xp: 0, attributes: { strength: 10, agility: 9, intellect: 0, command: 0 } } } };

const STAGES = (process.argv[2] ?? '5-1,3-2,4-3,8-1').split(',');
const CH = { 3: { key: 'ThirdGameScene', reg: 'thirdStage' }, 4: { key: 'GuanduGameScene', reg: 'guanduStage' }, 5: { key: 'ChibiGameScene', reg: 'chibiStage' }, 8: { key: 'HanzhongGameScene', reg: 'hanzhongStage' } };
const OUT = 'assets/review/stage-maps'; mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 600) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
for (const id of STAGES) {
  const [chn, stn] = id.split('-').map(Number), C = CH[chn];
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on('pageerror', e => errors.push(id + ' ' + e.message.slice(0, 160)));
  await p.addInitScript(([r, w, h]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_heroes_v1', JSON.stringify(h)); sessionStorage.setItem('seeded', '1'); } }, [roster, world, heroes]);
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&followers=1');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
  await p.evaluate(([C, st]) => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.remove('thirdTransfer'); s0.registry.set(C.reg, st); s0.registry.set('runConfig', { character: 'zhaoyun', ...(C.reg === 'guanduStage' ? {} : { thirdStage: st }) }); s0.scene.start(C.key); }, [C, stn]);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed < 6; }, C.key, { timeout: 120000 });
  await p.evaluate(async k => {
    const s = window.__game.scene.getScene(k); window.__S = s; s.player.damageImmune = true;
    window.__clearUi = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') { s.chooseRecruit?.(0); if (s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); } else if (s.mode === 'parley' && s.parley?.choose) s.parley.choose('execute'); else if (s.mode === 'story' || s.mode === 'parley') { const hits = s.input._list.filter(o => o.active && o.visible !== false && o.input?.enabled); const top = hits[hits.length - 1]; if (top) { top.emit('pointerdown', { x: top.x, y: top.y }); top.emit('pointerup', { x: top.x, y: top.y }); } else break; } else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); else break; } } };
    window.__spawns = []; const orig = s.spawnEnemy; s.spawnEnemy = function (kind, x, y, ...r) { const e = orig.call(this, kind, x, y, ...r); if (e?.active && !e.isSupplySlot) window.__spawns.push([Math.round(e.x), Math.round(e.y), kind, Math.round(Math.hypot(e.x - s.player.x, e.y - s.player.y))]); return e; };
    for (let i = 0; i < 40; i++) { window.__clearUi(); await new Promise(r => setTimeout(r, 100)); }
  }, C.key);
  await p.waitForTimeout(1200);
  const a0 = await p.evaluate(() => { const s = window.__S, cam = s.cameras.main; return { info: s.stageBounds, cam: cam.useBounds ? [Math.round(cam._bounds.x), Math.round(cam._bounds.y), Math.round(cam._bounds.width), Math.round(cam._bounds.height)] : null }; });
  await p.screenshot({ path: `${OUT}/${id}-start.png` });
  ck(`${id}：有边场地（${a0.info?.kind}）· 镜头停在边界 + 边带内`, !!a0.info && !!a0.cam && a0.cam[0] === a0.info.bounds.left - a0.info.edgeBand, a0);
  // 正常刷兵跑 25 秒（主将绕场走，碰边）
  const run = await p.evaluate(async () => {
    const s = window.__S, b = s.stageBounds.bounds, t = performance.now(); let a = 0, out = 0, maxOut = 0;
    s.devTimeScale = 3;
    while (performance.now() - t < 25000) { window.__clearUi(); a += .07; window.__IM.setMove(Math.cos(a), Math.sin(a * .7)); await new Promise(r => setTimeout(r, 120));
      for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') { const d = Math.max(b.left - e.x, e.x - b.right, b.top - e.y, e.y - b.bottom); if (d > 30) { out++; maxOut = Math.max(maxOut, Math.round(d)); } }
      const pl = s.player; const dp = Math.max(b.left - pl.x, pl.x - b.right, b.top - pl.y, pl.y - b.bottom); if (dp > 30) { out++; maxOut = Math.max(maxOut, Math.round(dp)); } }
    window.__IM.setMove(0, 0); s.devTimeScale = 1;
    const sp = window.__spawns, outside = sp.filter(([x, y]) => x < b.left - 5 || x > b.right + 5 || y < b.top - 5 || y > b.bottom + 5), near = sp.filter(q => q[2] !== 'boss' && q[3] < 380);
    return { spawns: sp.length, outside: outside.slice(0, 5), outsideN: outside.length, near: near.length, nearEx: near.slice(0, 4), out, maxOut, relocated: s.arena.stats.relocated, clamped: s.arena.stats.clamped };
  });
  await p.screenshot({ path: `${OUT}/${id}-fight.png` });
  ck(`${id}：刷兵全在场内、不刷在主将脸上；主将 / 敌兵不出场`, run.spawns > 10 && run.outsideN === 0 && run.near <= Math.ceil(run.spawns * .05) && run.out === 0, run);
  // 本关互动
  if (id === '5-1') {
    const r = await p.evaluate(async () => { const s = window.__S, A = s.arena, br = A.bridge; if (!br) return { none: true }; s.player.sprite.setPosition(br.x, br.y + 120); await new Promise(r => setTimeout(r, 300)); s.hitEnemy(br.e, 1e7, s.combatNow, 'melee', false, false); await new Promise(r => setTimeout(r, 450)); window.__bridgeShot = true; window.__spawns = []; s.player.sprite.setPosition(0, 600); await new Promise(r => setTimeout(r, 6000)); return { down: A.stats.bridgeDown, deck: A.stats.bridgeDeck, gates: A.info.gates, north: window.__spawns.filter(q => q[1] < -300).length, after: window.__spawns.length }; });
    await p.screenshot({ path: `${OUT}/${id}-bridge.png` });
    ck('5-1 断桥：砍断长坂桥 → 桥面落水、北面关口关掉、之后北面不再来兵', r.down && r.deck && !r.gates.some(g => g.y < -400) && r.north === 0, r);
  }
  if (id === '3-2') {
    const r = await p.evaluate(async () => { const s = window.__S, A = s.arena, l0 = A.stats.tentsLit; for (const t of A.tents) if (t.state === 'burning') t.litAt -= 8800; await new Promise(r => setTimeout(r, 1500)); return { l0, lit: A.stats.tentsLit, ticks: A.stats.fireTicks, tents: A.tents.length }; });
    await p.evaluate(() => { const s = window.__S, t = s.arena.tents.find(q => q.state === 'burning'); if (t) s.player.sprite.setPosition(t.x + 160, t.y + 40); }); await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/${id}-fire.png` });
    ck('3-2 营帐起火：开局两座在烧、火圈伤人；烧一阵蔓延到附近营帐', r.tents === 8 && r.lit >= 3 && r.ticks > 0, r);
  }
  if (id === '8-1') {
    const r = await p.evaluate(async () => { const s = window.__S, A = s.arena; A.logAt = s.combatNow; await new Promise(r => setTimeout(r, 3500)); return { ...A.stats }; });
    await p.screenshot({ path: `${OUT}/${id}-logs.png` });
    ck('8-1 滚木：关上推下滚木（先铺预警箭道）', r.logs >= 1, r);
  }
  // 打完：首领出场 → 秒掉 → 宝箱 → 胜利
  const end = await p.evaluate(async () => {
    const s = window.__S; s.devOneHit = true; s.devTimeScale = 4; const t = performance.now();
    if (!s.boss?.active) { const w = s.chapter?.waves; if (s.devSetTime) s.devSetTime(w?.length ? w[w.length - 1].start + 1 : 999); }
    while (performance.now() - t < 60000 && !s.over) { window.__clearUi(); if (s.boss?.active) s.hitEnemy(s.boss, 1e8, s.combatNow, 'melee', false, false); s.collectBossChests?.(); const c = s.bossChests?.[0]; if (c && c.x !== undefined) s.player.sprite.setPosition(c.x, c.y); if (s.objective && !s.objective.done) { /* 关卡目标：留给关卡自己 */ } await new Promise(r => setTimeout(r, 200)); }
    return { over: s.over, victory: s.victory, el: Math.round(s.elapsed) };
  });
  ck(`${id}：关卡打得完（首领出场 → 击败 → 胜利）`, end.over && end.victory, end);
  await p.close();
}
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
