// 第 7–12 章逐关检查（2026-11-20 统筹夜间任务；共享笔记 ch7-12-review.md，方法同 chapter2-review）。
// MODE=stages（默认）：18 关各跑一遍——剧情开（im_story full）、主将无敌 + 秒杀（devOneHit）、4 倍速自动走位一直打到结算：
//   记段落 / 首领登场时间 / 副将（名字、专属图）/ 首领图 / 敌兵外观（阵营）/ 成长倍率 / 关卡目标 / 场景地面 / 战斗曲 / 剧情卷轴与台词卡 / 结果 / 帧率 / 页面报错 / 卡住；
//   开局与首领登场各截一张，同时查 HUD 文字有没有互相压住（屏幕层 Text 两两相交）。
// MODE=heroes：17 位可玩武将各进一关后期关（7-1…12-3 轮流），本命专职进阶形态（Lv7 + 本派 4 势），不秒杀、2 倍速真打 30 秒：
//   页面报错、专职触发数、代码画的 Graphics、帧率、击杀数，各截一张。
// 输出 assets/review/ch7-12/（不入库）+ report-<mode>.json。用法：BASE=http://127.0.0.1:5743/ [MODE=stages|heroes] [ONLY=7-1,8-2] [HEROES=zhaoyun] node tools/review-ch7-12.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const E = process.env, BASE = E.BASE ?? 'http://127.0.0.1:5743/', MODE = E.MODE ?? 'stages', OUT = 'assets/review/ch7-12'; mkdirSync(OUT, { recursive: true });
const ARCS = { 7: ['ShuGameScene', 'shuStage'], 8: ['HanzhongGameScene', 'hanzhongStage'], 9: ['XiangfanGameScene', 'xiangfanStage'], 10: ['YilingGameScene', 'yilingStage'], 11: ['NanzhengGameScene', 'nanzhengStage'], 12: ['BeifaGameScene', 'beifaStage'] };
const ALL = Object.keys(ARCS).flatMap(c => [1, 2, 3].map(s => `${c}-${s}`));
const only = E.ONLY ? E.ONLY.split(',') : ALL;
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const report = [];

async function open(tag, hero, story) {
  const [ch, st] = tag.split('-').map(Number), [key, reg] = ARCS[ch];
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push('console ' + m.text().slice(0, 200)); });
  await p.addInitScript(([h, story]) => { if (sessionStorage.getItem('seeded')) return; localStorage.clear(); localStorage.setItem('im_last_hero', h); localStorage.setItem('im_story', story ? 'full' : 'off'); localStorage.setItem('im_home_seen', '1');
    localStorage.setItem('im_heroes_v1', JSON.stringify({ version: 1, migrated: true, attrSet: 3, heroes: { [h]: { level: 40, xp: 0, attributes: { strength: 20, agility: 18, intellect: 10, command: 10 } } } })); sessionStorage.setItem('seeded', '1'); }, [hero, story]);
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop' + (story ? '&story=1' : '')); // autostart 默认不播剧情，?story=1 强制播
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
  await p.evaluate(([key, reg, st, h]) => { const g = window.__game, s0 = g.scene.getScene('GameScene'); for (const k of ['campaignTransfer', 'thirdTransfer']) s0.registry.remove(k);
    s0.registry.set(reg, st); s0.registry.set('runConfig', { character: h, thirdStage: st }); for (const sc of g.scene.getScenes(true)) sc.scene.stop(); g.scene.start(key); }, [key, reg, st, hero]);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed < 6; }, key, { timeout: 120000 });
  await p.evaluate(k => { window.__S = window.__game.scene.getScene(k); }, key);
  return { p, errors, key };
}

// 页面里用的工具：推进弹窗 / 剧情、走位、HUD 文字重叠、阵营采样
const HELPERS = () => {
  const s = window.__S;
  window.__R = { story: new Set(), tex: new Set(), modes: {}, ltSeen: null, bossAt: null, bossKilledAt: null, fps: [] };
  window.__step = (a) => {
    const R = window.__R, pl = s.player;
    R.modes[s.mode] = (R.modes[s.mode] ?? 0) + 1;
    for (const o of s.children.list) if (/^story-/.test(o.name ?? '') && o.name !== 'story-bark-card') R.story.add(o.name);
    if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0);
    else if (s.mode === 'branch') s.chooseBranch?.(0);
    else if (s.mode === 'recruit') { s.chooseRecruit?.(0); if (s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); }
    else if (s.mode === 'parley' || s.mode === 'story') {
      if (s.parleyState === 'pending' && s.choose) s.choose('execute');
      else { const hits = s.input._list.filter(o => o.active && o.visible !== false && o.input?.enabled); const top = hits[hits.length - 1]; if (top) { top.emit('pointerdown', { x: top.x, y: top.y }); top.emit('pointerup', { x: top.x, y: top.y }); } }
    } else if (s.mode !== 'none' && s.mode !== 'result') { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); }
    if (s.awaitingChest) s.collectBossChests?.();
    if (s.bossSpawned && R.bossAt === null) R.bossAt = Math.round(s.elapsed);
    if (s.bossKilled && R.bossKilledAt === null) R.bossKilledAt = Math.round(s.elapsed);
    const lt = s.phaseRunner?.lt?.e; if (lt && !R.ltSeen) R.ltSeen = { at: Math.round(s.elapsed), name: s.phaseRunner.stats?.lieutenant, tex: lt.def.walkVisual?.texture ?? lt.def.texture, art: !!s.phaseRunner.ltArt?.() };
    for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss' && e.def.behavior !== 'supply') R.tex.add(e.kind + ':' + (e.def.walkVisual?.texture ?? e.def.texture));
    if (s.mode === 'none') R.fps.push(s.game.loop.actualFps);
    let tgt = s.boss?.active ? s.boss : null, best = 1e9; if (!tgt) for (const e of s.enemies) if (e.active && !e.isSupplySlot) { const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d < best) { best = d; tgt = e; } }
    if (tgt) { const tx = tgt.x + Math.cos(a) * 90, ty = tgt.y + Math.sin(a) * 90, dx = tx - pl.x, dy = ty - pl.y, d = Math.hypot(dx, dy) || 1; window.__IM.setMove(dx / d, dy / d); } else window.__IM.setMove(Math.cos(a) * .5, Math.sin(a) * .5);
  };
  // 屏幕层文字两两重叠（只算可见、有字、透明度 > .1；同一容器里的阴影 / 描边副本不算）
  window.__overlaps = () => {
    const texts = [], walk = (o, par, sf0) => { const vis = o.visible !== false && (o.alpha ?? 1) > .1; if (!vis) return; const sf = sf0 || o.scrollFactorX === 0;
      if (o.type === 'Text' && sf && o.text?.trim().length > 2 && !/^(Esc|Tab|[A-Z]?d*)$/.test(o.text.trim())) { /* 快捷键角标（E / Q / Esc）本来就压在按钮角上 */ const bd = o.getBounds(); if (bd.width > 2 && bd.height > 2) texts.push({ t: o.text.replace(/\s+/g, ' ').slice(0, 24), n: o.name || '', par, bd }); }
      for (const c of o.list ?? []) walk(c, o, sf); };
    for (const o of s.children.list) walk(o, null, false);
    const out = [];
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) { const A = texts[i], B = texts[j]; if (A.par && A.par === B.par && A.t === B.t) continue;
      const w = Math.min(A.bd.right, B.bd.right) - Math.max(A.bd.left, B.bd.left), h = Math.min(A.bd.bottom, B.bd.bottom) - Math.max(A.bd.top, B.bd.top);
      if (w <= 0 || h <= 0) continue; const area = w * h, small = Math.min(A.bd.width * A.bd.height, B.bd.width * B.bd.height);
      if (area / small > .25) out.push(`「${A.t}」×「${B.t}」`); }
    return [...new Set(out)].slice(0, 8);
  };
  window.__info = () => ({ name: s.chapter?.name, label: s.chapter?.label, boss: s.chapter?.bossName, phases: s.phasePlan?.phases.map(x => x.kind + '@' + x.start + ':' + x.name).join(' / ') ?? null, lt: s.phasePlan?.lieutenant ?? '',
    waves: s.chapter?.waves?.map(w => w.start + ':' + w.name).join(' / '), objective: s.chapter?.objective?.label ?? s.objectiveText?.text ?? null, bossAtStart: !!s.chapter?.bossAtStart,
    growth: s.chapter?.growth, pace: s.chapter?.pace, ground: s.chapter?.ground ?? null, theme: s.music?.battleTheme ?? s.music?.theme ?? null, hpBase: s.chapter?.enemies?.infantry?.hp, bossHp: s.chapter?.enemies?.boss?.hp });
};

async function runStage(tag) {
  const { p, errors, key } = await open(tag, 'zhaoyun', true);
  await p.evaluate(HELPERS);
  const t0 = Date.now();
  // 开局：让剧情卷轴 / 军情放完，截开局图
  for (let i = 0; i < 40; i++) { await p.evaluate(() => { const s = window.__S; s.player.damageImmune = true; window.__step(0); }); await p.waitForTimeout(150); }
  const info = await p.evaluate(() => window.__info());
  await p.waitForTimeout(600);
  const ovStart = await p.evaluate(() => window.__overlaps());
  await p.screenshot({ path: `${OUT}/${tag}-start.png` });
  // 7-3 成都是中城攻城（破门 → 街巷 → 州府，守将州府段才出）：自动走位不会拆城门，直接转到州府段看守将
  if (tag === '7-3') for (const ph of ['street', 'hall']) { await p.evaluate(ph => window.__S.shuMid?.transition(ph), ph); await p.waitForTimeout(2000); } // 中城三段：城外 → 街巷 → 州府，逐段转
  // 主将无敌 + 秒杀，4 倍速打到结算
  await p.evaluate(() => { const s = window.__S, f = s.finish.bind(s); s.finish = (v, reason) => { window.__R.end = reason; return f(v, reason); }; });
  const r = await p.evaluate(async () => {
    const s = window.__S, R = window.__R; s.devOneHit = true; s.devTimeScale = 4; let a = 0, lastE = s.elapsed, lastK = s.kills, lastChange = performance.now(), shotBoss = false; const t0 = performance.now();
    while (performance.now() - t0 < 240000 && !s.over) {
      window.__step(a += .15);
      if (s.elapsed !== lastE || s.kills !== lastK) { if (s.kills !== lastK || Math.abs(s.elapsed - lastE) > .5) lastChange = performance.now(); lastE = s.elapsed; lastK = s.kills; }
      if (performance.now() - lastChange > 45000) { R.stuck = true; break; }
      if (!shotBoss && s.boss?.active && !s.boss.invulnerable && s.elapsed > 3) { shotBoss = true; s.devOneHit = false; s.devTimeScale = 1; return { pause: true }; } // 首领一出来就停秒杀（不然一下就倒，截不到图）
      await new Promise(r => setTimeout(r, 150));
    }
    return { pause: false };
  });
  let ovBoss = null, bossTex = null;
  if (r.pause) {
    await p.evaluate(() => { const s = window.__S; s.devOneHit = false; const B = s.boss; if (B) s.player.sprite.setPosition(B.x - 170, B.y + 90); });
    for (let i = 0; i < 24; i++) { await p.evaluate(() => { const s = window.__S; window.__step(0); if (s.mode === 'none' && s.boss?.active) { const B = s.boss; s.player.sprite.setPosition(B.x - 170, B.y + 90); } }); await p.waitForTimeout(150); } // 登场大卡（暂停）点过去再截，首领血条才在
    await p.waitForTimeout(600);
    ovBoss = await p.evaluate(() => window.__overlaps()); bossTex = await p.evaluate(() => { const B = window.__S.boss; return B ? (B.def.walkVisual?.texture ?? B.def.texture) : null; });
    await p.screenshot({ path: `${OUT}/${tag}-boss.png` });
    await p.evaluate(async () => { const s = window.__S, R = window.__R; s.devOneHit = true; s.devTimeScale = 4; let a = 0; const t0 = performance.now(); let lastE = s.elapsed, lastK = s.kills, lastChange = performance.now();
      while (performance.now() - t0 < 200000 && !s.over) { window.__step(a += .15); if (s.elapsed !== lastE || s.kills !== lastK) { if (s.kills !== lastK || Math.abs(s.elapsed - lastE) > .5) lastChange = performance.now(); lastE = s.elapsed; lastK = s.kills; } if (performance.now() - lastChange > 45000) { R.stuck = true; break; } await new Promise(r => setTimeout(r, 150)); } });
  }
  // 结算后再推几下（章末卷轴）
  for (let i = 0; i < 20; i++) { await p.evaluate(() => window.__step(0)); await p.waitForTimeout(150); }
  const res = await p.evaluate(() => { const s = window.__S, R = window.__R, f = R.fps.slice(5).sort((x, y) => x - y);
    return { end: R.end ?? null, ltName: s.phaseRunner?.stats?.lieutenant ?? null, objectiveNow: s.objectiveText?.text ?? null, over: s.over, victory: s.victory, elapsed: Math.round(s.elapsed), kills: s.kills, bossAt: R.bossAt, bossKilledAt: R.bossKilledAt, lt: R.ltSeen, stuck: !!R.stuck, mode: s.mode,
      story: [...R.story], barks: (s.data.get('__storyBarkCardLog') ?? []).map(x => typeof x === 'string' ? x : (x.who ?? '') + ':' + (x.text ?? '')).slice(0, 30), tex: [...R.tex].slice(0, 16),
      fpsAvg: f.length ? Math.round(f.reduce((x, y) => x + y, 0) / f.length) : 0, fpsP5: f.length ? Math.round(f[Math.floor(f.length * .05)]) : 0, chests: s.bossChests?.length ?? null }; });
  const row = { tag, key, ...info, ...res, bossTex, ovStart, ovBoss, wall: Math.round((Date.now() - t0) / 1000), errors: [...new Set(errors)].slice(0, 6) };
  report.push(row);
  console.log(`${tag} ${row.name}（${row.boss}）：${row.over ? (row.victory ? '通关' : '失败') : row.stuck ? '卡住(' + row.mode + ')' : '超时(' + row.mode + ')'} · 段落 ${row.phases ?? row.waves} ${row.over && !row.victory ? '（' + row.end + '）' : ''} · 副将 ${row.ltName ?? row.lt?.name ?? '—'}${row.lt?.tex ? '/' + row.lt.tex : ''} · 首领 ${row.bossAt ?? '—'}s 登场 ${row.bossKilledAt ?? '—'}s 倒下（${row.bossTex}）· 用时 ${row.elapsed}s · FPS ${row.fpsAvg}/${row.fpsP5}`);
  console.log(`   剧情 ${row.story.join(',') || '—'} · 台词卡 ${row.barks.length} · 兵 ${row.tex.join(' ')}`);
  if (row.ovStart?.length || row.ovBoss?.length) console.log(`   文字重叠 开局 ${row.ovStart.join(' ')} · 首领 ${(row.ovBoss ?? []).join(' ')}`);
  if (row.errors.length) console.log(`   报错 ${row.errors.join(' | ')}`);
  await p.close();
}

async function runHero(hero, tag, idx) {
  const { p, errors } = await open(tag, hero, false);
  await p.evaluate(HELPERS);
  for (let i = 0; i < 10; i++) { await p.evaluate(() => { window.__S.player.damageImmune = true; window.__step(0); }); await p.waitForTimeout(150); }
  const setup = await p.evaluate(async (idx) => { const s = window.__S, pl = s.player, w = pl.weapons[0], B = await import('/src/data/weaponBranches.ts'); const brs = B.branchesFor(w.id); const br = brs[idx % brs.length];
    w.level = 5; w.branch = br.id; w.over = 2; const tags = { fire: 0, stratagem: 0, archery: 0, cavalry: 0, warrior: 0, formation: 0 }; tags[br.school] = 5; pl.growth.build.tags = () => tags; s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none');
    return { weapon: w.id, branch: br.id, school: br.school }; }, idx);
  const r = await p.evaluate(async () => { const s = window.__S, R = window.__R; s.devTimeScale = 2; let a = 0; const t0 = performance.now(), k0 = s.kills, e0 = s.elapsed, gfx = new Set(); let maxObj = 0;
    while (performance.now() - t0 < 15000 && !s.over) { window.__step(a += .15);
      for (const o of s.children.list) if (o.type === 'Graphics' && o.visible && o.alpha > .05 && o.scrollFactorX !== 0) gfx.add(o.name || '(无名)');
      maxObj = Math.max(maxObj, s.children.list.length); await new Promise(r => setTimeout(r, 150)); }
    const f = R.fps.slice(5).sort((x, y) => x - y), st = s.branchRt?.stats ?? null;
    return { secs: Math.round(s.elapsed - e0), kills: s.kills - k0, final: !!(s.branchRt?.final?.()), stats: st && { fires: st.fires, procs: st.procs, hits: st.hits }, gfx: [...gfx].slice(0, 10), maxObj, fpsAvg: f.length ? Math.round(f.reduce((x, y) => x + y, 0) / f.length) : 0, fpsP5: f.length ? Math.round(f[Math.floor(f.length * .05)]) : 0, stage: s.chapter?.name }; });
  await p.screenshot({ path: `${OUT}/hero-${hero}-${tag}.png` });
  const row = { hero, tag, ...setup, ...r, errors: [...new Set(errors)].slice(0, 6) };
  report.push(row);
  console.log(`${hero} @ ${tag} ${row.stage} · ${row.branch}${row.final ? '（进阶）' : ''} · ${row.secs}s 击杀 ${row.kills} · 专职 ${JSON.stringify(row.stats)} · Graphics ${row.gfx.join(',') || '—'} · 对象峰值 ${row.maxObj} · FPS ${row.fpsAvg}/${row.fpsP5}${row.errors.length ? ' · 报错 ' + row.errors.join(' | ') : ''}`);
  await p.close();
}

// 7-3 成都限时：守将出场前按中城攻城限时（MID_SIEGE.limitSeconds 520），不再在 5:05 判超时
async function chengduLimit() {
  const { p, errors } = await open('7-3', 'zhaoyun', false); await p.evaluate(HELPERS);
  for (let i = 0; i < 10; i++) { await p.evaluate(() => { window.__S.player.damageImmune = true; window.__step(0); }); await p.waitForTimeout(150); }
  const at = async t => { await p.evaluate(t => { const s = window.__S; s.elapsed = t; s.checkEnd(); }, t); return p.evaluate(() => { const s = window.__S; return { over: s.over, boss: s.bossSpawned, phase: s.shuMid?.phase, banner: s.children.list.filter(o => o.name === 'combat-notice').map(o => o.list?.map(x => x.text).filter(Boolean).join(' ')).join('|') }; }); };
  const r = { t310: await at(310), t470: await at(470), t521: await at(521) };
  const ok = !r.t310.over && /敌援将至/.test(r.t470.banner) && !r.t470.over && r.t521.over;
  console.log(`${ok ? 'PASS' : 'FAIL'} 7-3 成都限时：5:10 未判负、7:50 预警「敌援将至」、8:41 超时 · ${JSON.stringify(r)}${errors.length ? ' 报错 ' + errors.join(' | ') : ''}`); report.push({ tag: '7-3-limit', ok, ...r });
  await p.close();
}

try {
  if (MODE === 'stages' && only.includes('7-3')) await chengduLimit();
  if (MODE === 'heroes') {
    const heroes = E.HEROES ? E.HEROES.split(',') : await (async () => { const { p } = await open('7-1', 'zhaoyun', false); const ids = await p.evaluate(async () => (await import('/src/data/characters.ts')).CHARACTERS.filter(c => c.playable !== false).map(c => c.id)); await p.close(); return ids; })();
    for (const [i, h] of heroes.entries()) { try { await runHero(h, ALL[i % ALL.length], i); } catch (e) { report.push({ hero: h, error: e.message.slice(0, 200) }); console.log(h, '打不开', e.message.split('\n')[0].slice(0, 160)); } }
  } else {
    for (const t of only) { try { await runStage(t); } catch (e) { report.push({ tag: t, error: e.message.slice(0, 200) }); console.log(t, '打不开', e.message.split('\n')[0].slice(0, 160)); } }
  }
} finally { writeFileSync(`${OUT}/report-${MODE}.json`, JSON.stringify(report, null, 1)); await b.close(); }
