// 攻城限时探针（平衡与数值，2026-11-18）：三档城各打一整场（城外 → [瓮城] → 城内要点 → 府衙），记录每段用时、总用时、是否在限时内、是否进了「敌援抵达」。
// 主将真实走位（readMove），不瞬移；主将免伤（只看用时，不看会不会死）；g.step 固定步长推进。
// 城外：有吊桥先砍绳索；有冲车就护送（先打冲车 230 像素内的敌兵），冲车毁了回营地重领；小城没有冲车，站门前砍木门。
// 瓮城：站内门前砍。城内：走向最近的未占要点站住。府衙：贴着守将打。
// 用法：BASE=http://127.0.0.1:5195/ node tools/probe-siege-time.mjs [--tier small|medium|large] [--hero guanyu] [--level 20] [--secs 900]
import { chromium } from 'playwright';
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tier = arg('tier', 'large'), hero = arg('hero', 'guanyu'), level = Number(arg('level', 20)), maxSec = Number(arg('secs', 900)), trace = args.includes('--trace'), shot = arg('shot', '');
const save = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu', 'chibi'], ownedCities: ['xuchang', 'runan', 'guandu', 'chenliu', 'luoyang', 'wancheng'], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 5, intelSeq: 1 };
const PRIMARY = { zhaoyun: 'agility', guanyu: 'strength', zhangfei: 'strength', machao: 'agility', huangzhong: 'agility', zhuge: 'intellect', pangtong: 'intellect', liubei: 'command', weiyan: 'strength', huangyueying: 'intellect', sunshangxiang: 'agility', diaochan: 'intellect' };
const pts = Math.max(0, level - 1), main = PRIMARY[hero] ?? 'strength', attrs = { strength: 0, agility: 0, intellect: 0, command: 0 };
attrs[main] = Math.min(10, pts); let left = pts - attrs[main];
for (const a of ['strength', 'agility', 'command', 'intellect']) { if (a === main) continue; const n = Math.min(10, left); attrs[a] = n; left -= n; }
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errors = [];
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(([sv, h, lv, at]) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', h);
    localStorage.setItem('im_heroes_v1', JSON.stringify({ version: 1, migrated: true, attrSet: 3, heroes: { [h]: { level: lv, xp: 0, attributes: at } } }));
    sessionStorage.setItem('seeded', '1');
  }, [save, hero, level, attrs]);
  await p.goto(base + '?layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  const city = await p.evaluate(async ([h, tier]) => {
    const c = await import('/src/world/WorldCities.ts'), w = await import('/src/world/WorldStore.ts'), s = w.loadWorld();
    const id = (c.CITIES.find(x => x.tier === tier && c.cityAttackable(x.id, s.ownedCities)) ?? c.CITIES.find(x => x.tier === tier && !s.ownedCities.includes(x.id)))?.id;
    const g = window.__game; g.registry.set('siegeCity', id); g.registry.remove('siegeMode'); g.registry.set('runConfig', { character: h });
    for (const sc of g.scene.getScenes(true)) sc.scene.stop();
    if (g.registry.get('battleReady')) g.scene.start('SiegeGameScene'); else { g.registry.set('pendingWarlord', 'SiegeGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); }
    return id;
  }, [hero, tier]);
  await p.waitForFunction(() => window.__game.scene.isActive('SiegeGameScene') && window.__game.scene.getScene('SiegeGameScene').player, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const g = window.__game, s = g.scene.getScene('SiegeGameScene'), m = s.siegeMid; s.__DEV_ACTIONS?.closePopup?.();
    s.player.damageImmune = true; g.loop.sleep(); window.__T = performance.now(); window.__S = s; window.__M = m;
    let move = [0, 0]; s.readMove = () => new Phaser.Math.Vector2(move[0], move[1]);
    window.__setMove = (x, y) => { move = [x, y]; };
    window.__phaseAt = {}; window.__timerAt = {};
    window.__step = n => {
      for (let i = 0; i < n; i++) {
        if (s.mode !== 'none' && !s.over) {
          if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0);
          else if (s.mode === 'recruit') { if (s.chooseRecruit) s.chooseRecruit(0); if (s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); }
          else if (s.mode === 'story') { for (const o of s.children.list) { const btn = o.list?.find(q => /-(next|confirm)$/.test(q.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } }
          else if (s.mode !== 'paused') s.__DEV_ACTIONS?.closePopup?.();
        }
        window.__T += 1000 / 60; g.step(window.__T, 1000 / 60);
      }
    };
  });
  const tick = () => p.evaluate(() => {
    const s = window.__S, m = window.__M, pl = s.player, M0 = window.__M;
    const go = (x, y, stop = 14) => { const dx = x - pl.x, dy = y - pl.y, d = Math.hypot(dx, dy); window.__setMove(d > stop ? dx / d : 0, d > stop ? dy / d : 0); };
    const ph = m.phase; if (window.__phaseAt[ph] === undefined) window.__phaseAt[ph] = s.elapsed;
    const tp = s.siegeTimer?.phase; if (tp && window.__timerAt[tp] === undefined) window.__timerAt[tp] = s.elapsed;
    if (s.over) { window.__setMove(0, 0); }
    else if (s.awaitingChest || s.bossChests?.length) { s.collectBossChests?.(); const c = s.bossChests?.[0]; if (c?.x !== undefined) go(c.x, c.y); }
    else if (ph === 'outside') {
      const r = m.ramInfo, rope = m.ropes?.find(q => q.e.active && q.e.spawnId === q.life);
      if (rope) go(rope.x, rope.y + 90);
      else if (!r) go(0, -480, 30); // 小城：站木门前砍
      else if (r.state === 'wreck') go(0, 250);
      else { const near = s.enemies.filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss' && Math.hypot(e.x - r.x, e.y - r.y) < 230).sort((a, c) => Math.hypot(a.x - r.x, a.y - r.y) - Math.hypot(c.x - r.x, c.y - r.y)); const t = near[0]; if (t) go(t.x + (pl.x < t.x ? -30 : 30), t.y); else go(r.x + 50, r.y - 60); }
    }
    else if (ph === 'barbican') { const ig = m.innerGate?.e; if (ig?.active) go(ig.x, ig.y + 70, 20); else window.__setMove(0, 0); }
    else if (ph === 'street') {
      const pt = [...(m.points ?? [])].filter(q => q.state !== 'secured').sort((a, c) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(c.x - pl.x, c.y - pl.y))[0];
      if (pt) {
        // 没有寻路：被房子挡住 2 秒没挪动，就把主将放到要点上，按直线距离 ÷ 移速补记走路时间（walkPenalty）
        const far = Math.hypot(pt.x - pl.x, pt.y - pl.y) > 40, W = window.__walk ??= { x: pl.x, y: pl.y, still: 0, penalty: 0, jumps: 0 };
        if (far && Math.hypot(pl.x - W.x, pl.y - W.y) < 8) W.still++; else W.still = 0; W.x = pl.x; W.y = pl.y;
        if (W.still >= 6) { W.penalty += Math.hypot(pt.x - pl.x, pt.y - pl.y) * 1.4 / Math.max(60, pl.speed ?? 200); W.jumps++; W.still = 0; pl.sprite.setPosition(pt.x, pt.y); }
        go(pt.x, pt.y, 30);
      } else window.__setMove(0, 0);
    }
    else if (ph === 'hall') { if (s.boss?.active) go(s.boss.x - 70, s.boss.y + 20, 20); else { const e = s.enemies.find(q => q.active && !q.isSupplySlot); if (e) go(e.x, e.y, 40); else window.__setMove(0, 0); } }
    window.__step(20);
    /* 2026-11-20：记我方友军（义军小队 + 部曲）同屏人数峰值与平均，按段分 */ { const W = window.__allyStat ??= {}, ph = m.phase, a = (s.allyPush?.alive ?? 0), l = (s.allies ?? []).filter(u => u.active).length, o = W[ph] ??= { push: 0, legion: 0, n: 0, pushMax: 0, total: 0 }; o.push += a; o.legion += l; o.n++; o.pushMax = Math.max(o.pushMax, a); o.total = Math.max(o.total, a + l); }
    return { over: s.over, victory: s.victory, phase: m.phase, elapsed: s.elapsed, px: Math.round(pl.x), py: Math.round(pl.y), mv: window.__moveNow, pts: m.pointsInfo?.map(q => q.state[0] + Math.round(q.progress * 100) + '/' + Math.round(q.hold)).join(' '), ptsXY: (m.points ?? []).map(q => Math.round(q.x) + ',' + Math.round(q.y)).join(' '), en: s.enemies.filter(e => e.active && !e.isSupplySlot).length };
  });
  let st; const t0 = Date.now();
  let streetAt = null, shotDone = false;
  for (let k = 0; k < maxSec * 3; k++) { st = await tick(); if (shot && !shotDone) { if (st.phase === 'street' && streetAt === null) streetAt = st.elapsed; if (streetAt !== null && st.elapsed - streetAt >= 15) { shotDone = true; await p.screenshot({ path: shot }); } } if (trace && k % 30 === 0) console.log('T', Math.round(st.elapsed), st.phase, st.px + ',' + st.py, 'pts', st.pts, 'en', st.en, k === 0 || k % 300 === 0 ? 'xy ' + st.ptsXY : ''); if (st.over) break; }
  const out = await p.evaluate(() => { const s = window.__S, m = window.__M; return { limit: s.siegeTimer?.limit, timer: s.siegeTimer, phaseAt: window.__phaseAt, timerAt: window.__timerAt, ramStats: { ramsLost: m.stats.ramsLost, ramHits: m.stats.ramHits }, points: m.pointsInfo, heroLv: s.heroLv, kills: s.kills, endReason: s.endReason ?? null, walk: window.__walk ? { jumps: window.__walk.jumps, penalty: Math.round(window.__walk.penalty) } : null, allies: Object.fromEntries(Object.entries(window.__allyStat ?? {}).map(([k, o]) => [k, { push: +(o.push / o.n).toFixed(1), legion: +(o.legion / o.n).toFixed(1), pushMax: o.pushMax, totalMax: o.total }])) }; });
  const P = out.phaseAt, order = ['outside', 'barbican', 'street', 'hall', 'done'], segs = {};
  for (let i = 0; i < order.length - 1; i++) { if (P[order[i]] === undefined) continue; const next = order.slice(i + 1).map(k => P[k]).find(v => v !== undefined) ?? st.elapsed; segs[order[i]] = Math.round(next - P[order[i]]); }
  console.log(JSON.stringify({ city, tier, hero, level, over: st.over, victory: st.victory, total: Math.round(st.elapsed), limit: out.limit, withinLimit: st.victory && st.elapsed + (out.walk?.penalty ?? 0) <= out.limit, walk: out.walk, segs, timerAt: out.timerAt, ramsLost: out.ramStats.ramsLost, allies: out.allies, heroLv: out.heroLv, kills: out.kills, endReason: out.endReason, wall: Math.round((Date.now() - t0) / 1000), errors: errors.slice(0, 3) }));
} finally { await b.close(); }
