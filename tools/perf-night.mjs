// 夜间性能测量（电脑布局 1280×720，无头 Chrome 软件渲染——绝对帧率偏低，只看改前改后的相对变化）：
// 后期大场面压力：149 个敌人围圈（含精英）、4 把满级武器、20 名部曲、全战法 + 全流派 4 势、持续点燃 / 眩晕 / 破甲、锦囊连放。
// 输出：帧率（平均 / 1% 低）、帧时间 P95、JS 堆、显示对象数、补间数；PROFILE=1 时再用 CDP 采样 CPU，按函数汇总自耗时前 N。
// 用法：BASE=http://127.0.0.1:5260/ SECONDS=15 PROFILE=1 OFF=statusFx,buildVfx,jinnang,artFx,dmg node tools/perf-night.mjs
//   OFF=关掉的系统（A/B 对比）：statusFx 敌人状态标记 / buildVfx 战法图集特效 / jinnang 锦囊特效 / artFx 手绘技艺特效 / dmg 伤害飘字 / hud HUD 刷新 / shadows
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const E = process.env, BASE = E.BASE ?? 'http://127.0.0.1:5260/', SECONDS = Math.max(6, +(E.SECONDS ?? 15)), OFF = (E.OFF ?? '').split(',').filter(Boolean), TOP = +(E.TOP ?? 18), LABEL = E.LABEL ?? 'run';
const SCENE = E.SCENE ?? 'GameScene', CHAPTER = E.CHAPTER ?? '', N = +(E.ENEMIES ?? 140), ALLIES = +(E.ALLIES ?? 20);
mkdirSync('assets/review/perf', { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(k => { window.__KEY = k; if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } }, SCENE);
  const START = { YilingGameScene: { yilingStage: 3, run: { thirdStage: 3 }, drop: 'yilingTransfer' }, BeifaGameScene: { beifaStage: 3, run: { thirdStage: 3 }, drop: 'beifaTransfer' }, HanzhongGameScene: { hanzhongStage: 3, run: { thirdStage: 3 }, drop: 'hanzhongTransfer' }, ThirdGameScene: { thirdStage: 3, run: { thirdStage: 3 }, drop: 'thirdTransfer' } };
  if (SCENE === 'GameScene') await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop&story=off`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  else {
    await p.goto(`${BASE}?dev=1&layout=desktop&story=off`, { timeout: 180000, waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__game?.scene.getScenes(true).length, null, { timeout: 120000, polling: 500 }); await p.waitForTimeout(2500);
    await p.evaluate(([k, st, city]) => { const g = window.__game; if (st) { for (const [a, v] of Object.entries(st)) if (a !== 'run' && a !== 'drop') g.registry.set(a, v); g.registry.set('runConfig', { character: 'zhaoyun', ...(st.run ?? {}) }); if (st.drop) g.registry.remove(st.drop); } else { g.registry.set('siegeCity', city); g.registry.remove('siegeMode'); g.registry.set('runConfig', { character: 'zhaoyun' }); }
      for (const s of g.scene.getScenes(true)) s.scene.stop(); if (g.registry.get('battleReady') || st) g.scene.start(k); else { g.registry.set('pendingWarlord', k); g.registry.set('loadBattle', true); g.scene.start('BattleLoadScene' in g.scene.keys ? 'BattleLoadScene' : k); } }, [SCENE, START[SCENE] ?? null, E.CITY ?? 'luoyang']);
  }
  await p.waitForFunction(() => { const s = window.__game?.scene.getScene(window.__KEY ?? 'GameScene'); return s?.player && s.__DEV_ACTIONS && window.__IM; }, null, { timeout: 180000, polling: 500 }); await p.waitForTimeout(1500);
  const setup = await p.evaluate(async ([N, ALLIES, OFF]) => {
    const s = window.__game.scene.getScene(window.__KEY ?? 'GameScene'), IM = window.__IM; s.__DEV_ACTIONS.closePopup?.(); IM.god(); IM.clearWeapons(); IM.killAllEnemies(); s.spawnTimer = s.eliteTimer = 1e9;
    for (const id of ['spear_orbit', 'crossbow', 'guandao', 'flame_banner']) { try { IM.giveWeapon(id); s.player.weapons.at(-1).level = 4; } catch { /* 部分场景没有该武器 */ } }
    const b = s.player.growth.build; b.tactics = { ember: 3, spread: 2, hotwind: 2, napalm: 2, snare: 2, traction: 2, confinement: 2, gust: 2, eagle: 2, sunder: 2, reap: 2, concentration: 2, windstep: 2, flank: 2, swift: 2, stored_edge: 2, chain: 2, pursuit: 2, momentum: 2, heavy_break: 2, coordination: 2, rally: 2, breakout: 2, watch: 2 };
    b.bonus = { fire: 4, stratagem: 4, archery: 4, cavalry: 4, warrior: 4, formation: 4 }; s.player.stats.cooldownMul = .45;
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, r = 70 + (i % 7) * 48, kind = i % 12 === 0 ? 'elite' : i % 3 === 0 ? 'archer' : 'infantry'; const e = s.spawnEnemy(kind, s.player.x + Math.cos(a) * r, s.player.y + Math.sin(a) * r, 3, true); if (e) { e.speed = 0; e.hp = e.maxHp = 1e9; } }
    for (let i = 0; i < ALLIES; i++) IM.spawnAlly(['swordsman', 'archer', 'spearman'][i % 3]);
    const noop = () => {}, off = {};
    if (OFF.includes('statusFx') && s.statusFx) { s.statusFx.update = noop; off.statusFx = 1; }
    if (OFF.includes('buildVfx')) { const V = await import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes('systems/BuildVfx.ts')) ?? '/src/systems/BuildVfx.ts'); const v = V.buildVfx(s); v.emit = noop; off.buildVfx = 1; }
    if (OFF.includes('jinnang') && s.jinnangFx) { s.jinnangFx.cast = noop; s.jinnangFx.update = noop; off.jinnang = 1; }
    if (OFF.includes('artFx') && s.artEffects) { s.artEffects.show = noop; off.artFx = 1; }
    if (OFF.includes('hud') && s.updateHud) { s.updateHud = noop; off.hud = 1; }
    window.__pump = () => { if (s.mode !== 'none') { s.__DEV_ACTIONS.closePopup?.(); if (s.mode !== 'none') s.setMode('none'); } const bc = s.buildCombat, now = s.combatNow, es = s.enemies.filter(e => e.active && !e.isSupplySlot); for (let k = 0; k < 8; k++) { const e = es[(Math.random() * es.length) | 0]; if (!e) break; const m = k % 3; if (m === 0) bc.igniteDerived?.(e, 5, now, 3000); else if (m === 1) bc.stun?.(e, 1200, now); else bc.vulnerable?.(e, .12, now); } if (s.player.hp < s.player.maxHp * .5) s.player.hp = s.player.maxHp; for (const id of ['fire', 'drum']) { try { s.jinnangFx?.cast(id, s.player.x, s.player.y, now); } catch { /* 没有则忽略 */ } } };
    return { off, enemies: s.enemies.filter(e => e.active).length, allies: s.allies.length };
  }, [N, ALLIES, OFF]);
  const cdp = await ctx.newCDPSession(p);
  if (E.PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
  await cdp.send('HeapProfiler.collectGarbage'); const heap0 = (await cdp.send('Runtime.getHeapUsage')).usedSize;
  await p.waitForTimeout(1500);
  const sample = await p.evaluate(seconds => new Promise(resolve => {
    const s = window.__game.scene.getScene(window.__KEY ?? 'GameScene'), start = performance.now(); let last = start, nextPump = start; const frames = [], stamps = [], upd = [], rnd = [], g = window.__game; let tU = 0, tR = 0, cu = 0, cr = 0;
    g.events.on('prestep', () => { tU = performance.now(); }); g.events.on('poststep', () => { cu = performance.now() - tU; });
    g.events.on('prerender', () => { tR = performance.now(); }); g.events.on('postrender', () => { cr = performance.now() - tR; });
    const tick = now => { frames.push(now - last); stamps.push(now - start); upd.push(cu); rnd.push(cr); last = now; if (now >= nextPump) { window.__pump(); nextPump = now + 700; }
      if (now - start < seconds * 1000) return requestAnimationFrame(tick);
      const sorted = frames.slice().sort((a, b) => a - b), slow = sorted.slice(-Math.ceil(frames.length * .01)), total = now - start;
      resolve({ seconds: +(total / 1000).toFixed(1), fps: +(frames.length * 1000 / total).toFixed(1), low1: +(1000 / (slow.reduce((a, b) => a + b, 0) / slow.length)).toFixed(1), p95ms: +sorted[Math.floor(sorted.length * .95)].toFixed(1),
        updAvg: +(upd.reduce((a, c) => a + c, 0) / upd.length).toFixed(2), rndAvg: +(rnd.reduce((a, c) => a + c, 0) / rnd.length).toFixed(2), updMax: +Math.max(...upd.slice(60)).toFixed(1), rndMax: +Math.max(...rnd.slice(60)).toFixed(1), updOver16: upd.filter(d => d > 16).length, rndOver16: rnd.filter(d => d > 16).length, worst: frames.map((d, i) => [d, stamps[i], upd[i], rnd[i]]).filter(([d, t]) => t > 2000).sort((a, b) => b[0] - a[0]).slice(0, 6).map(([d, t, u, r]) => `${d.toFixed(0)}ms@${(t / 1000).toFixed(1)}s(upd${u.toFixed(0)}/rnd${r.toFixed(0)})`), over33: frames.filter(d => d > 33).length, over50: frames.filter(d => d > 50).length, frameCount: frames.length, mode: s.mode, over: s.over, elapsed: +s.elapsed.toFixed(1), kills: s.kills ?? null, display: s.children.list.length, tweens: s.tweens.getTweens().length, enemies: s.enemies.filter(e => e.active).length, allies: s.allies.length }); };
    requestAnimationFrame(tick);
  }), SECONDS);
  if (E.SHOT) await p.screenshot({ path: `assets/review/perf/${E.SHOT}.png` });
  await cdp.send('HeapProfiler.collectGarbage'); const heap1 = (await cdp.send('Runtime.getHeapUsage')).usedSize;
  const out = { label: LABEL, off: OFF, setup, sample, heapMB: { before: +(heap0 / 1048576).toFixed(1), after: +(heap1 / 1048576).toFixed(1) }, errors: errs.slice(0, 3) };
  if (E.PROFILE) {
    const { profile } = await cdp.send('Profiler.stop'), self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n])), dt = profile.timeDeltas; let total = 0;
    profile.samples.forEach((id, i) => { const n = byId.get(id), key = `${n.callFrame.functionName || '(anon)'} ${(n.callFrame.url || '').split('/').slice(-2).join('/')}:${n.callFrame.lineNumber + 1}`; self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0)); total += dt[i] ?? 0; });
    out.top = [...self.entries()].sort((a, c) => c[1] - a[1]).slice(0, TOP).map(([k, v]) => `${(v / total * 100).toFixed(1)}%  ${k}`);
    // 包含时间（INCL=1）：把每个样本的整条调用栈上出现过的函数各记一次，看哪些系统整体最贵
    if (E.INCL) { const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id); const inc = new Map();
      profile.samples.forEach((id, i) => { const seen = new Set(); let cur = id; while (cur) { const c = byId.get(cur)?.callFrame; if (c?.url) { const k = `${c.functionName || '(anon)'}@${c.url.split('/').pop()}:${c.lineNumber + 1}`; if (!seen.has(k)) { seen.add(k); inc.set(k, (inc.get(k) ?? 0) + (dt[i] ?? 0)); } } cur = parent.get(cur); } });
      out.incl = [...inc.entries()].sort((a, c) => c[1] - a[1]).slice(0, +E.INCL).map(([k, v]) => `${(v / total * 100).toFixed(1)}%  ${k}`); }
    // 指定函数的调用者链（E.WHO=逗号分隔函数名）：看这些热点是被谁调用的
    if (E.WHO) { const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id); const want = E.WHO.split(','), chains = new Map(); const fn = id => byId.get(id)?.callFrame; const nm = id => { const c = fn(id); return `${c?.functionName || '(anon)'}@${(c?.url || '').split('/').pop()}:${(c?.lineNumber ?? 0) + 1}`; };
      profile.samples.forEach((id, i) => { const n = byId.get(id); if (!want.includes(n.callFrame.functionName)) return; const chain = []; let cur = id; for (let k = 0; k < 7 && cur; k++) { chain.push(nm(cur)); cur = parent.get(cur); } const key = chain.join(' <- '); chains.set(key, (chains.get(key) ?? 0) + (dt[i] ?? 0)); });
      out.who = [...chains.entries()].sort((a, c) => c[1] - a[1]).slice(0, 14).map(([k, v]) => `${(v / total * 100).toFixed(1)}%  ${k}`); }
    // 按文件汇总
    const byFile = new Map(); for (const [k, v] of self) { const f = k.replace(/^.* /, '').replace(/:\d+$/, ''); byFile.set(f, (byFile.get(f) ?? 0) + v); }
    out.topFiles = [...byFile.entries()].sort((a, c) => c[1] - a[1]).slice(0, 12).map(([k, v]) => `${(v / total * 100).toFixed(1)}%  ${k}`);
  }
  console.log(JSON.stringify(out, null, 1)); writeFileSync(`assets/review/perf/${LABEL}.json`, JSON.stringify(out, null, 1));
} finally { await b.close(); }
