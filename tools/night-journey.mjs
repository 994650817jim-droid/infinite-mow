// 夜间整体回归（2026-11-20 统筹）：正式模式从新存档按玩家路线往后推：开场 → 主页「开始征程」→ 1-1 … 第一章 → 天下地图 / 营寨 / 城池 / 招贤馆 → 第二章 → 攻城 → 第三章 …
// 不开 dev（不算测试局，进度照常存档）；为了跑得快：战斗 4 倍速、主将每拍回满血（不设 damageImmune，否则算调试局不存档）、跳到首领时刻、首领重击（劝降弹窗先选劝降）。
// 记录：每关进出、模式卡住（软锁）、控制台报错、军粮、玩法开放（mechOpen）、存档读档（中途刷新页面）、帧率。
// 用法：BASE=http://127.0.0.1:5187/ node tools/night-journey.mjs [最多关数=12] [out.json]
// 环境变量：SEED=jingnan（存档种到该篇章已平定，从下一章接着推）；SKIP_EXTRAS=intel,siege,defense,side（不打途中的军情 / 攻城 / 守城 / 讨伐令）
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', MAX = Number(process.argv[2] ?? 12), OUT = process.argv[3] ?? 'night-journey.json';
const shots = 'assets/review/night'; mkdirSync(shots, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], log = [], issues = [];
p.on('pageerror', e => { errors.push({ at: log.length ? log[log.length - 1].tag : 'start', msg: e.message.slice(0, 200) }); console.log('ERR-LIVE', errors.at(-1).at, errors.at(-1).msg); });
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) { errors.push({ at: log.length ? log[log.length - 1].tag : 'start', msg: 'console ' + m.text().slice(0, 200) }); console.log('ERR-LIVE', errors.at(-1).at, errors.at(-1).msg); } });
const note = (tag, data) => { log.push({ tag, ...data }); console.log(tag, JSON.stringify(data).slice(0, 300)); };
const issue = (where, what, sev = '中') => { issues.push({ where, what, sev }); console.log('ISSUE', where, what); };
const shot = async name => { try { await p.screenshot({ path: `${shots}/${name}.png` }); } catch { /* */ } };

await p.addInitScript(() => { if (!sessionStorage.getItem('fresh')) { localStorage.clear(); sessionStorage.setItem('fresh', '1'); } });
await p.goto(base + '?layout=desktop');
await p.waitForFunction(() => window.__game && (window.__game.scene.isActive('MenuScene') || window.__game.scene.isActive('OpeningScene')), null, { timeout: 180000 });
// 开场动画：点「跳过」
for (let i = 0; i < 30; i++) { const st = await p.evaluate(() => { const g = window.__game; if (g.scene.isActive('MenuScene')) return 'menu'; const o = g.scene.getScene('OpeningScene'); const all = []; const walk = l => { for (const x of l) { all.push(x); if (x.list) walk(x.list); } }; if (o) walk(o.children.list); const sk = all.find(x => x.name === 'opening-skip'); sk?.emit('pointerdown'); sk?.emit('pointerup'); return sk ? 'skip' : 'wait'; }); if (st === 'menu') break; await p.waitForTimeout(1000); }
await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 60000 }); await p.waitForTimeout(800);
note('menu', {});
// SEED=jingnan 等：存档直接种到该篇章已平定（前面各章都打过），从天下地图接着往后推（省掉前面几十分钟）
const ARCS = ['huangjin', 'hulao', 'qunxiong', 'guandu', 'chibi', 'jingnan', 'shu', 'hanzhong', 'xiangfan', 'yiling', 'nanzheng', 'beifa'];
if (process.env.SEED) {
  const upto = ARCS.indexOf(process.env.SEED);
  await p.evaluate(async upto => { const W = await import('/src/world/WorldStore.ts'); W.saveWorld(); const s = JSON.parse(localStorage.getItem('im_world_v1'));
    const F = { huangjin: 'yellowStages', hulao: 'dongzhuoStages', qunxiong: 'warlordStages', guandu: 'guanduStages', chibi: 'chibiStages', jingnan: 'jingnanStages', shu: 'shuStages', hanzhong: 'hanzhongStages', xiangfan: 'xiangfanStages', yiling: 'yilingStages', nanzheng: 'nanzhengStages', beifa: 'beifaStages' };
    const A = Object.keys(F); for (let i = 0; i <= upto; i++) s[F[A[i]]] = 3;
    Object.assign(s, { worldAvailable: true, chapterSeen: upto + 1, tutorialDone: true, provisions: 3000 }); s.cleared = { ...s.cleared, huangjin: true, hulao: upto >= 1 };
    s.nodes = [...new Set([...(s.nodes ?? []), 'home', ...A.slice(0, upto + 2)])];
    localStorage.setItem('im_world_v1', JSON.stringify(s)); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); }, upto);
  await p.reload(); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 }); await p.waitForTimeout(800);
  note('seeded', { upto: process.env.SEED });
}

/** 当前活动的场景键（战斗 / 界面）。 */
const active = () => p.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).filter(k => k !== 'BootScene'));
const isBattle = k => /GameScene$/.test(k);
const mech = () => p.evaluate(async () => { try { const M = await import('/src/data/mechanicUnlocks.ts'); const ids = Object.keys(M.MECHANICS ?? M.MECH_RULES ?? {}); return Object.fromEntries(ids.map(id => [id, M.mechOpen(id)])); } catch (e) { return { err: String(e).slice(0, 80) }; } });
const grain = () => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('im_world_v1') ?? 'null')?.provisions ?? null; } catch { return null; } });
const rev = () => p.evaluate(() => { try { const w = JSON.parse(localStorage.getItem('im_world_v1') ?? 'null'), k = JSON.parse(localStorage.getItem('im_world_backup_v1') ?? 'null'); return { rev: w?.revision, act: w?.active ? w.active.chapter + '-' + w.active.stage + ':' + w.active.state + ':' + String(w.active.id).slice(0, 4) : null, y: w?.yellowStages, d: w?.dongzhuoStages, bak: k?.revision }; } catch (e) { return { err: String(e) }; } });

/** 打一场：返回 { result: 'win' | 'rest' | 'lose' | 'stuck', ... }。 */
async function fight(key, tag) {
  const t0 = Date.now(); let lastSig = '', lastProg = Date.now(), fpsMin = 999, seen = new Set();
  await p.evaluate(k => { const s = window.__game.scene.getScene(k); s.devTimeScale = 3; window.__bossHits = 0; window.__midAt = 0; }, key);
  for (;;) {
    const st = await p.evaluate(k => {
      const g = window.__game, s = g.scene.getScene(k); if (!s || !s.sys.isActive()) return { gone: true, scenes: g.scene.getScenes(true).map(x => x.scene.key) };
      const pl = s.player; if (pl?.alive) pl.hp = pl.maxHp;
      const m = s.mode; let did = '';
      { const all = []; const walk = l => { for (const x of l) { all.push(x); if (x.list) walk(x.list); } }; walk(s.children.list); const sc = all.find(x => /^story-.*(confirm|next)$|-opening-next$/.test(x.name ?? '') && x.active && x.visible !== false && x.input?.enabled); if (sc && m !== 'none') { sc.emit('pointerdown', { x: sc.x, y: sc.y }); sc.emit('pointerup', { x: sc.x, y: sc.y }); did = 'scroll:' + sc.name; } }
      if (did) { /* 已点卷轴 */ }
      else if (m === 'levelup' || m === 'bossloot') { s.chooseUpgrade?.(0); did = 'pick'; }
      else if (m === 'branch') { s.chooseBranch?.(0); did = 'branch'; }
      else if (m === 'recruit') { if (s.chooseRecruit) s.chooseRecruit(0); if (s.mode === 'recruit') { const all = []; const walk = l => { for (const x of l) { all.push(x); if (x.list) walk(x.list); } }; walk(s.children.list); const sk = all.find(x => /recruit-(skip|close)|skip/.test(x.name ?? '') && x.input?.enabled); sk?.emit('pointerdown'); sk?.emit('pointerup'); } did = 'recruit'; }
      else if (m === 'parley') { s.choose((window.__parleyN = (window.__parleyN | 0) + 1) % 2 ? 'persuade' : 'execute'); /* 刷新页面后 window 变量没了：不能用 undefined++（NaN 永远劝降，劝降条件未满足时按钮无效 → 卡死） */ did = 'parley'; } // 双首领的劝降窗挂在 dual 条目上：走场景的 choose（找当前开着的那个）
      else if (m === 'story' || m === 'fortune') { const hits = s.input._list.filter(o => o.active && o.visible !== false && o.input?.enabled); const top = hits.filter(o => /next|confirm|continue|skip/.test(o.name ?? '') && !/battle-map/.test(o.name ?? '')).at(-1) ?? hits.filter(o => !/battle-map/.test(o.name ?? '')).at(-1); if (top) { top.emit('pointerdown', { x: top.x, y: top.y }); top.emit('pointerup', { x: top.x, y: top.y }); } did = m; }
      else if (m === 'none' && !s.over) {
        if (s.awaitingChest) s.collectBossChests?.();
        const bt = s.chapter?.waves?.length ? s.chapter.waves[s.chapter.waves.length - 1].start : 999;
        const B = s.breakout; if (B && pl?.alive) { const sp = pl.sprite ?? pl; const ty = sp.y - 90, tx = sp.x * .8; if (!(B.bossCalled && !B.gateOpen && B.distance < 400)) sp.setPosition?.(tx, ty); }
        else if (!s.bossSpawned && s.elapsed < bt - 2 && s.elapsed > 4) s.elapsed = bt - 1;
        // 场上能打的首领都打：主首领、2-3 城下吕布（打退后董卓才下城）、双首领、上一关的追兵
        const bos = [s.boss, s.dzLubu?.lubu, ...(s.dual?.alive?.map(x => x.enemy) ?? []), ...(s.chasingBosses ?? []).filter(t => t.enemy.spawnId === t.life).map(t => t.enemy)].filter((e, i, l) => e?.active && !e.invulnerable && l.indexOf(e) === i);
        if (bos.length && window.__bossHits++ % 3 === 0) for (const bo of bos) s.hitEnemy(bo, Math.max(50, bo.maxHp * .2), s.combatNow, 'melee', false, false);
        // 城门（12-2 陈仓等 markGate 登记的）：玩家要去破的目标
        for (const g of s.gateSet ?? []) if (g.active && g.hp > 0 && window.__bossHits % 4 === 0) s.hitEnemy(g, Math.max(50, g.maxHp * .2), s.combatNow, 'melee', false, false);
        // 2-3 洛阳：营寨全毁吕布才跃下城头——营帐也打（玩家要去拆的目标）
        for (const c of s.luoyangCamps?.camps ?? []) if (c.tent?.active && !c.destroyed && window.__bossHits % 5 === 0) s.hitEnemy(c.tent, Math.max(50, c.tent.maxHp * .25), s.combatNow, 'melee', false, false);
        // 攻城：分段推进太慢，城门 / 冲车等直接推进（攻城有自己的 finish 规则）
        const MM = s.siegeMid ?? s.mid; /* 7-3 成都等篇章里的中城攻城挂在 mid 上 */ if (MM?.phase && !(MM.transitioningNow ?? MM.transitioning) && s.elapsed > 20 && (window.__midAt ?? 0) < s.elapsed - 8) { window.__midAt = s.elapsed; const M = MM; if (M.phase !== 'hall' && M.phase !== 'done') { try { M.transition(M.nextPhase(M.phase)); } catch { /* */ } } }
        did = 'fight';
      }
      const fps = Math.round(g.loop.actualFps);
      return { spawned: !!s.bossSpawned, killed: !!s.bossKilled, awaiting: !!s.awaitingChest, chests: s.bossChests?.length ?? 0, chasing: (s.chasingBosses ?? []).map(t => t.name + ':' + (t.enemy.active ? 'on' : 'off') + ':' + (t.enemy.spawnId === t.life)), vis: s.children.list.filter(o => /story|scroll|notice|popup/.test(o.name ?? '') && o.visible).map(o => o.name), chestReady: s.bossChests?.filter(c => c.ready && !c.done).length ?? 0, bossInv: !!s.boss?.invulnerable, mode: s.mode, over: s.over, victory: s.victory, elapsed: Math.round(s.elapsed), boss: !!s.boss?.active, bossHp: s.boss ? Math.round(s.boss.hp / s.boss.maxHp * 100) : null, enemies: s.enemies.filter(e => e.active).length, fps, did, name: s.chapter?.name, phase: (s.siegeMid ?? s.mid)?.phase ?? null };
    }, key);
    if (st.gone) return { result: 'left', scenes: st.scenes, ms: Date.now() - t0 };
    if (st.enemies > 60) fpsMin = Math.min(fpsMin, st.fps);
    seen.add(st.mode);
    const sig = [st.mode, st.elapsed, st.bossHp, st.over, st.phase].join('|'); if (sig !== lastSig) { lastSig = sig; lastProg = Date.now(); }
    if (st.over || st.mode === 'rest') { await p.waitForTimeout(1500); await shot(tag + '-end'); return { result: st.mode === 'rest' ? 'rest' : st.victory ? 'win' : 'lose', name: st.name, elapsed: st.elapsed, fpsMin, modes: [...seen], ms: Date.now() - t0 }; }
    if (Date.now() - lastProg > 90000) { await shot(tag + '-stuck'); return { result: 'stuck', st, modes: [...seen], ms: Date.now() - t0 }; }
    if (Date.now() - t0 > 600000) { await shot(tag + '-timeout'); return { result: 'timeout', st, ms: Date.now() - t0 }; }
    await p.waitForTimeout(250);
  }
}
/** 等某个场景活动。 */
const waitScene = (pred, ms = 120000) => p.waitForFunction(pred, null, { timeout: ms }).then(() => true).catch(() => false);

// ① 主页「开始征程」
await p.evaluate(() => { window.__parleyN = 0; const m = window.__game.scene.getScene('MenuScene'), all = []; const walk = l => { for (const x of l) { all.push(x); if (x.list) walk(x.list); } }; walk(m.children.list); const b0 = all.find(x => x.name === 'start-campaign'); b0?.emit('pointerdown'); b0?.emit('pointerup'); });
await p.waitForTimeout(3000);
let scenes = await active(); note('after-start', { scenes });
// 可能弹选主公 / 剧情卷轴：点最上面的可交互对象直到进战斗
for (let i = 0; i < 25 && !scenes.some(isBattle) && !scenes.includes('WorldMapScene'); i++) {
  await p.evaluate(() => { const g = window.__game, s = g.scene.getScenes(true).filter(x => x.scene.key !== 'BootScene').pop(); if (!s) return; const hits = s.input._list.filter(o => o.active && o.visible !== false && o.input?.enabled); const top = hits.find(o => /hero-pick-(confirm|zhaoyun)|choose-hero-zhaoyun|confirm|start/.test(o.name ?? '')) ?? hits[hits.length - 1]; top?.emit('pointerdown', { x: top.x, y: top.y }); top?.emit('pointerup', { x: top.x, y: top.y }); });
  await p.waitForTimeout(1500); scenes = await active();
}
note('first-battle', { scenes, mech: await mech() });

let stages = 0; const extrasDone = (process.env.SKIP_EXTRAS ?? '').split(',').filter(Boolean);
for (; stages < MAX; ) {
  scenes = await active();
  const key = scenes.find(isBattle);
  if (!key) {
    // 不在战斗：天下地图 / 主页 / 营寨。记录一次、选下一关出征
    note('outside', { scenes, grain: await grain(), mech: await mech() });
    if (scenes.includes('WorldMapScene')) {
      // 每 10 关在天下地图上刷新一次页面（也是读档测试；headless 长跑约 1 小时会崩，见 night-regression.md）
      if (stages - (globalThis.__lastReload ?? 0) >= 10) { globalThis.__lastReload = stages; const bw = await p.evaluate(() => localStorage.getItem('im_world_v1')); await p.reload(); await waitScene(() => window.__game && window.__game.scene.isActive('MenuScene'), 180000); const aw = await p.evaluate(() => localStorage.getItem('im_world_v1')); note('reload-map', { same: bw === aw, save: await rev() }); if (bw !== aw) issue('读档', '天下地图上刷新页面后存档变了', '中'); continue; }
      await shot(`map-${stages}`);
      // 天下地图：选「下一步」引导的章节 / 城，主按钮出征
      await p.waitForTimeout(2500);
      // 地图上的弹窗（时代推进 / 失守 / 剧情）先点掉
      for (let i = 0; i < 6; i++) { const c = await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); if (!s?.sys.isActive()) return null; const all = []; const walk = l => { for (const x of l) { all.push(x); if (x.list) walk(x.list); } }; walk(s.children.list); const b0 = all.find(x => /notice|story|era|lost|reveal/.test(x.name ?? '') && /confirm|close|ok/.test(x.name ?? '') && x.active && x.input?.enabled); if (!b0) return null; b0.emit('pointerdown', { x: b0.x, y: b0.y }); b0.emit('pointerup', { x: b0.x, y: b0.y }); return b0.name; }); if (!c) break; note('map-popup', { c }); await p.waitForTimeout(1200); }
      // 途中出现的攻城 / 守城 / 军情 / 讨伐令：各打一场（统筹 2026-11-20 夜）。每种开放后第一次见到就去打，打过记在 extrasDone
      const ex = await p.evaluate(async done => { const s = window.__game.scene.getScene('WorldMapScene'); const emitAll = o => { o?.emit('pointerdown', { getDistance: () => 0, x: 0, y: 0 }); o?.emit('pointerup', { getDistance: () => 0, x: 0, y: 0 }); };
        const alert = s.alerts?.[0]?.city, atk = s.cityMarkers.find(m => s.status.get(m.city.id)?.kind === 'attack' && !m.root.getData('fogged'));
        if (!done.includes('defense') && alert) { const mk = s.cityMarkers.find(m => m.city.id === alert); mk.hit.emit('pointerup', { getDistance: () => 0 }); await new Promise(r => setTimeout(r, 300)); s.action.image.emit('pointerup'); await new Promise(r => setTimeout(r, 500)); s.children.getByName('siege-modal')?.getByName?.('siege-go')?.emit('pointerup'); return { kind: 'defense', id: alert }; }
        if (!done.includes('intel') && s.intel?.length) { const event = s.intel[0]; s.selected = { kind: 'intel', event }; s.refresh(); await new Promise(r => setTimeout(r, 300)); s.action.image.emit('pointerup'); await new Promise(r => setTimeout(r, 500)); const md = s.children.getByName('intel-modal'); md?.getByName?.('intel-go')?.emit('pointerup'); return { kind: 'intel', id: event.id + ':' + event.kind, modal: !!md }; }
        if (!done.includes('side')) { const N = await import('/src/world/WorldNodes.ts'); const node = N.WORLD_NODES.find(n => n.side && s.nodeState(n) === 'open'); if (node) { s.selected = { kind: 'node', node }; s.launch(false); return { kind: 'side', id: node.side }; } }
        if (!done.includes('siege') && atk) { atk.hit.emit('pointerup', { getDistance: () => 0 }); await new Promise(r => setTimeout(r, 300)); s.action.image.emit('pointerup'); await new Promise(r => setTimeout(r, 500)); s.children.getByName('siege-modal')?.getByName?.('siege-go')?.emit('pointerup'); return { kind: 'siege', id: atk.city.id + ':' + atk.city.tier }; }
        return null; }, extrasDone);
      if (ex) { extrasDone.push(ex.kind); note('extra', ex); globalThis.__extra = ex.kind; }
      const r = ex ? { extra: ex } : await p.evaluate(async () => { const s = window.__game.scene.getScene('WorldMapScene'); const t = s.guideTarget; if (!t) return { none: true };
        const id = t.id; let how = '';
        if (id.startsWith('stage-')) { const [, ch, n] = id.split('-'); s.selected = { kind: 'stage', chapter: ch, stage: Number(n) }; s.launch(false); how = 'stage'; }
        else if (id.startsWith('node-')) { const N = await import('/src/world/WorldNodes.ts'); const node = N.WORLD_NODES.find(n => n.id === id.slice(5)); s.selected = { kind: 'node', node }; s.launch(false); how = 'node'; }
        else { const mk = s.cityMarkers.find(x => x.city.id === id); mk?.hit.emit('pointerup', { getDistance: () => 0 }); await new Promise(r => setTimeout(r, 400)); s.action?.image?.emit('pointerup'); how = 'city'; }
        return { id, text: t.text, how, action: s.action?.text?.text ?? null }; });
      note('map', r);
      if (r.none) { issue('天下地图', '没有「下一步」引导目标', '中'); await shot('map-noguide'); break; }
      await p.waitForTimeout(1500);
      // 出征弹窗（攻城）/ 选将确认
      await p.evaluate(() => { const g = window.__game, s = g.scene.getScene('WorldMapScene'); if (!s?.sys.isActive()) return; const md = s.children.getByName('siege-modal'); md?.getByName?.('siege-go')?.emit('pointerup'); const all = []; const walk = l => { for (const x of l) { all.push(x); if (x.list) walk(x.list); } }; walk(s.children.list); const go = all.find(x => /-go$|confirm|depart/.test(x.name ?? '') && x.input?.enabled); go?.emit('pointerdown'); go?.emit('pointerup'); });
      let ok = false;
      for (let i = 0; i < 40 && !ok; i++) { ok = await waitScene(() => window.__game.scene.getScenes(true).some(s => /GameScene$/.test(s.scene.key) && s.player), 3000);
        if (!ok) await p.evaluate(() => { const g = window.__game, s = g.scene.getScenes(true).filter(x => !/BootScene|WorldMapScene/.test(x.scene.key)).pop(); if (!s) return; const all = []; const walk = l => { for (const x of l) { all.push(x); if (x.list) walk(x.list); } }; walk(s.children.list); const b0 = all.find(x => /confirm|depart|start|-go$/.test(x.name ?? '') && x.active && x.visible !== false && x.input?.enabled); b0?.emit('pointerdown', { x: b0.x, y: b0.y }); b0?.emit('pointerup', { x: b0.x, y: b0.y }); }); }
      if (!ok) { issue('天下地图', '「下一步」出征后没有进入战斗：' + JSON.stringify(await active()), '高'); await shot('map-stuck'); break; }
      continue;
    }
    if (scenes.includes('MenuScene')) { await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'), all = []; const walk = l => { for (const x of l) { all.push(x); if (x.list) walk(x.list); } }; walk(m.children.list); const b0 = all.find(x => x.name === 'start-campaign'); b0?.emit('pointerdown'); b0?.emit('pointerup'); }); await p.waitForTimeout(3000); continue; }
    // 其他界面（营寨等）：去天下地图
    await p.evaluate(() => { const g = window.__game; const s = g.scene.getScenes(true).filter(x => x.scene.key !== 'BootScene').pop(); s?.scene.start('WorldMapScene'); });
    await waitScene(() => window.__game.scene.isActive('WorldMapScene'), 60000); continue;
  }
  const tag = `s${String(stages).padStart(2, '0')}-${key}${globalThis.__extra ? '-' + globalThis.__extra : ''}`; globalThis.__extra = null;
  const g0 = await grain();
  await p.waitForTimeout(1200); await shot(tag + '-start');
  const r = await fight(key, tag); stages++;
  const g1 = await grain();
  note(tag, { ...r, grain: [g0, g1], save: await rev(), heapMB: await p.evaluate(() => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576)), tex: await p.evaluate(() => window.__game.textures.getTextureKeys().length) });
  if (r.result === 'stuck' || r.result === 'timeout') { issue(tag, `战斗卡住（${r.result}）：` + JSON.stringify(r.st), '高'); await p.evaluate(k => { const s = window.__game.scene.getScene(k); s.finish?.(true, 'boss'); }, key); }
  if (r.result === 'lose') issue(tag, '主将满血仍判负：' + JSON.stringify(r).slice(0, 160), '高');
  // 行营休整：出征下一关
  if (r.result === 'rest' && stages === 3 && !globalThis.__reloaded) { globalThis.__reloaded = true; note('pre-reload', { save: await rev() }); const bw = await p.evaluate(() => localStorage.getItem('im_world_v1')); await p.reload(); await waitScene(() => window.__game && (window.__game.scene.isActive('MenuScene') || window.__game.scene.isActive('WorldMapScene')), 180000); const aw = await p.evaluate(() => localStorage.getItem('im_world_v1')); note('reload', { same: bw === aw, save: await rev(), scenes: await active() }); if (bw !== aw) issue('读档', '刷新页面后天下存档变了（营寨休整中刷新）', '中'); continue; }
  if (r.result === 'rest') { await p.waitForTimeout(6500); await shot(tag + '-camp'); let moved = false;
    for (let i = 0; i < 15 && !moved; i++) {
      const st = await p.evaluate(k => { const g = window.__game, s = g.scene.getScene(k); if (!s?.sys.isActive()) return { left: true };
        const all = []; const walk = l => { for (const x of l) { all.push(x); if (x.list) walk(x.list); } }; walk(s.children.list);
        const btn = all.find(x => /volunteers-confirm|story-.*confirm/.test(x.name ?? '') && x.active && x.input?.enabled);
        if (btn) { btn.emit('pointerdown', { x: btn.x, y: btn.y }); btn.emit('pointerup', { x: btn.x, y: btn.y }); return { clicked: btn.name }; }
        if (s.mode !== 'rest') return { left: true, mode: s.mode };
        s.continueCampaign?.(); return { cont: true, elapsed: s.elapsed }; }, key);
      if (st.clicked) note(tag + '-notice', st);
      await p.waitForTimeout(2500);
      const now = await p.evaluate(k => { const g = window.__game, s = g.scene.getScene(k); return !s?.sys.isActive() || (s.mode !== 'rest' && s.elapsed < 5); }, key);
      if (now) moved = true;
    }
    if (!moved) { issue(tag, '营寨休整后无法继续出征（continueCampaign 无效）', '高'); await shot(tag + '-camp-stuck'); break; }
    continue; }
  // 结算：点主按钮（下一关 / 回天下地图）；章末可能先播剧情
  for (let i = 0; i < 20; i++) {
    const done = await p.evaluate(k => { const g = window.__game, s = g.scene.getScene(k); if (!s?.sys.isActive()) return true; const hits = s.input._list.filter(o => o.active && o.visible !== false && o.input?.enabled); const home = s.resultPanel?.getByName?.('result-home'); const top = (s.mode === 'story' ? hits[hits.length - 1] : null) ?? home ?? hits[hits.length - 1]; top?.emit('pointerdown', { x: top.x, y: top.y }); top?.emit('pointerup', { x: top.x, y: top.y }); return false; }, key);
    if (done) break; await p.waitForTimeout(1500);
  }
  await p.waitForTimeout(2500);
  // 中途读档：第 3 关后刷新页面，看存档接得上
  if (stages === 3) { note('pre-reload', { save: await rev() }); const before = await p.evaluate(() => localStorage.getItem('im_world_v1')); const bj = JSON.parse(before ?? '{}'); await p.reload(); await waitScene(() => window.__game && (window.__game.scene.isActive('MenuScene') || window.__game.scene.isActive('WorldMapScene')), 180000); const after = await p.evaluate(() => localStorage.getItem('im_world_v1')); note('reload', { same: before === after, scenes: await active(), save: await rev() }); if (before !== after) { const aj = JSON.parse(after ?? '{}'); const diff = Object.keys({ ...bj, ...aj }).filter(k => JSON.stringify(bj[k]) !== JSON.stringify(aj[k])).map(k => k + ':' + JSON.stringify(bj[k]).slice(0, 60) + '→' + JSON.stringify(aj[k]).slice(0, 60)); note('reload-diff', { diff }); if (diff.length) issue('读档', '刷新页面后天下存档变了：' + diff.join(' ; ').slice(0, 300), '中'); } }
}
note('end', { stages, scenes: await active(), grain: await grain(), mech: await mech() });
writeFileSync(OUT, JSON.stringify({ log, issues, errors }, null, 1));
console.log('\nSTAGES', stages, 'ISSUES', issues.length, 'ERRORS', errors.length);
for (const e of errors.slice(0, 10)) console.log('ERR', e.at, e.msg);
await b.close();
