// 冲车耐久探针（平衡与数值，2026-11-18）：大城城外段，主将砍绳索落吊桥后护送冲车撞门，记录冲车受伤来源与被毁次数。
// 用 g.step 固定步长推进（与 test-siege-large-flow 同法，结果可复现）；主将免伤，只看冲车。
// --mode stand：主将贴着冲车站着不动（同 test-siege-large-flow，相当于挂机护送）；--mode escort：主将真实走位，先打冲车 230 像素内离冲车最近的敌兵，没有就站冲车门侧。
// 用法：BASE=http://127.0.0.1:5195/ node tools/probe-siege-ram.mjs [--hero zhaoyun] [--level 25] [--mode escort] [--secs 300] [--set ram.hp=700,ram.contactDamageMul=1]
import { chromium } from 'playwright';
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', hero = arg('hero', 'zhaoyun'), level = Number(arg('level', 1)), mode = arg('mode', 'escort'), maxSec = Number(arg('secs', 300)), sets = arg('set', '');
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
  const city = await p.evaluate(async ([h, sets]) => {
    const c = await import('/src/world/WorldCities.ts'), w = await import('/src/world/WorldStore.ts'), s = w.loadWorld(), M = (await import('/src/data/siegeMedium.ts')).MID_SIEGE;
    for (const kv of sets ? sets.split(',') : []) { const [k, v] = kv.split('='), path = k.split('.'); let o = M; for (const q of path.slice(0, -1)) o = o[q]; o[path.at(-1)] = Number(v); }
    const id = c.CITIES.find(x => x.tier === 'large' && c.cityAttackable(x.id, s.ownedCities))?.id;
    const g = window.__game; g.registry.set('siegeCity', id); g.registry.remove('siegeMode'); g.registry.set('runConfig', { character: h });
    for (const sc of g.scene.getScenes(true)) sc.scene.stop();
    if (g.registry.get('battleReady')) g.scene.start('SiegeGameScene'); else { g.registry.set('pendingWarlord', 'SiegeGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); }
    return id;
  }, [hero, sets]);
  await p.waitForFunction(() => window.__game.scene.isActive('SiegeGameScene') && window.__game.scene.getScene('SiegeGameScene').player, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const g = window.__game, s = g.scene.getScene('SiegeGameScene'), m = s.siegeMid; s.__DEV_ACTIONS?.closePopup?.();
    s.player.damageImmune = true; g.loop.sleep(); window.__T = performance.now(); window.__S = s; window.__M = m;
    const R = window.__R = { dmg: { arrow: 0, melee: 0, burn: 0 }, hits: { arrow: 0, melee: 0, burn: 0 }, blocked: 0, attackerDmg: [], nearRam: 0, nearN: 0, ramSecs: 0, moveSecs: 0, campSecs: 0, timeline: [] };
    const orig = m.damageRam.bind(m);
    m.damageRam = (d, src = 'melee') => {
      const r = m.ram, before = r?.hp ?? 0; orig(d, src); const lost = before - (m.ram === r ? Math.max(0, r.hp) : 0);
      if (lost > 0) { R.dmg[src] += lost; R.hits[src]++; if (src === 'melee') R.attackerDmg.push(d); } else if (src !== 'burn') R.blocked++;
    };
    let move = [0, 0]; s.readMove = () => new Phaser.Math.Vector2(move[0], move[1]);
    window.__setMove = (x, y) => { move = [x, y]; };
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
  const tick = mode => p.evaluate(mode => {
    const s = window.__S, m = window.__M, pl = s.player, R = window.__R, r = m.ramInfo;
    const go = (x, y) => { const dx = x - pl.x, dy = y - pl.y, d = Math.hypot(dx, dy); window.__setMove(d > 14 ? dx / d : 0, d > 14 ? dy / d : 0); };
    let phase = 'ropes';
    if (!m.bridgeDown) { const rp = m.ropes?.find(q => q.e.active && q.e.spawnId === q.life); if (rp) go(rp.x, rp.y + 90); }
    else if (!r || r.state === 'wreck') { phase = 'camp'; go(0, 250); }
    else {
      phase = r.state;
      const near = s.enemies.filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss' && Math.hypot(e.x - r.x, e.y - r.y) < 230);
      R.nearRam += near.length; R.nearN++;
      if (mode === 'stand') { pl.sprite.setPosition(r.x + 60, r.y + 40); window.__setMove(0, 0); }
      else { near.sort((a, c) => Math.hypot(a.x - r.x, a.y - r.y) - Math.hypot(c.x - r.x, c.y - r.y)); const t = near[0]; if (t) go(t.x + (pl.x < t.x ? -30 : 30), t.y); else go(r.x + 50, r.y - 60); }
    }
    window.__step(20);
    if (phase === 'ram') R.ramSecs += 1 / 3; else if (phase === 'move') R.moveSecs += 1 / 3; else if (phase === 'camp') R.campSecs += 1 / 3;
    if (window.__lastLost !== m.stats.ramsLost) { window.__lastLost = m.stats.ramsLost; R.timeline.push({ t: +s.elapsed.toFixed(1), lost: m.stats.ramsLost, gate: Math.round(m.gateHp) }); }
    const ri = m.ramInfo;
    return { done: m.phase !== 'outside', phase, elapsed: s.elapsed, bridge: m.bridgeDown, ramHp: ri ? Math.round(ri.hp) : null, gate: Math.round(m.gateHp) };
  }, mode);
  let st, bridgeAt = null; const t0 = Date.now();
  for (let k = 0; k < maxSec * 3; k++) { st = await tick(mode); if (st.bridge && bridgeAt === null) bridgeAt = st.elapsed; if (st.done) break; }
  const out = await p.evaluate(() => {
    const m = window.__M, R = window.__R, a = R.attackerDmg;
    return { stats: { ramHits: m.stats.ramHits, ramsLost: m.stats.ramsLost, ramsTaken: m.stats.ramsTaken, fireArrows: m.stats.fireArrows, putOut: m.stats.putOut }, ramCfg: { ...m.ramCfg },
      dmg: Object.fromEntries(Object.entries(R.dmg).map(([k, v]) => [k, Math.round(v)])), hits: R.hits, blocked: R.blocked,
      attackerDmgAvg: a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : 0, nearRamAvg: +(R.nearRam / Math.max(1, R.nearN)).toFixed(1),
      moveSecs: Math.round(R.moveSecs), ramSecs: Math.round(R.ramSecs), campSecs: Math.round(R.campSecs), timeline: R.timeline, heroLv: window.__S.heroLv, kills: window.__S.kills };
  });
  console.log(JSON.stringify({ city, hero, level, mode, sets, done: st.done, elapsed: +st.elapsed.toFixed(0), bridgeAt: bridgeAt && +bridgeAt.toFixed(0), gate: st.gate, ...out, wall: Math.round((Date.now() - t0) / 1000), errors: errors.slice(0, 3) }));
} finally { await b.close(); }
