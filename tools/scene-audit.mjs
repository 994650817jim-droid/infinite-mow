// 全场景合理性审查（设计会话 2026-11-18，统筹派「需要检查所有场景是否合理」）。只读：不改游戏代码、不改存档以外的东西。
// 每个战斗场景：
//  1. 开局截图（1280×720 电脑布局，主公赵云 + 3 名随行）。
//  2. 障碍图：以主将出生点为中心，主将逐格瞬移、手动跑一帧，看有没有被推开（被推开 = 障碍；不管是哪个系统挡的都测得出来），
//     再顺便读地形减速（河）。拉远镜头截全景，红格 = 挡人，蓝格 = 减速（水）。数据存 JSON。
//  3. 战斗中截图：不秒杀、正常刷怪跑一段（画面密度、遮挡）；首领登场后再拍一张（首领有没有被小兵压住）。
//  4. 全程每 0.6 秒抽查：随行 / 敌兵 / 首领有没有站在障碍「深处」（该格和四邻都是障碍）——穿模；刷怪点落在障碍 / 水里的个数。
//  5. 攻城：每进一段（城外 / 瓮城 / 街巷 / 府衙）重新测一次障碍图并截图。
// 用法：BASE=http://127.0.0.1:5173/ node tools/scene-audit.mjs [--only 1-1,4-2,siege-small] [--fight 30]
// 输出：assets/review/scene-audit/<场景>-{start,map,fight,boss,…}.png + scene-audit.json
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', fightSecs = Number(arg('fight', 30));
const OUT = 'assets/review/scene-audit'; mkdirSync(OUT, { recursive: true });
const CH = {
  1: { name: '黄巾', key: 'GameScene', cfg: s => ({ chapter: 'huangjin', stage: s }) },
  2: { name: '讨董', key: 'GameScene', cfg: s => ({ chapter: 'hulao', westStage: s }) },
  3: { name: '群雄', key: 'ThirdGameScene', reg: 'thirdStage' }, 4: { name: '官渡', key: 'GuanduGameScene', reg: 'guanduStage' },
  5: { name: '赤壁', key: 'ChibiGameScene', reg: 'chibiStage' }, 6: { name: '荆南', key: 'JingnanGameScene', reg: 'jingnanStage' },
  7: { name: '入蜀', key: 'ShuGameScene', reg: 'shuStage' }, 8: { name: '汉中', key: 'HanzhongGameScene', reg: 'hanzhongStage' },
  9: { name: '襄樊', key: 'XiangfanGameScene', reg: 'xiangfanStage' }, 10: { name: '夷陵', key: 'YilingGameScene', reg: 'yilingStage' },
  11: { name: '南征', key: 'NanzhengGameScene', reg: 'nanzhengStage' }, 12: { name: '北伐', key: 'BeifaGameScene', reg: 'beifaStage' },
};
const SIEGE = { 'siege-small': 'shangdang', 'siege-medium': 'chenliu', 'siege-large': 'luoyang' };
// 2026-11-19 全面检查（统筹「整体检查每个章节场景和逻辑合不合理和攻城战，有没有什么贴图错误」）：加守城、军情、三英战吕布
const EXTRA = {
  'defense-small': { key: 'SiegeGameScene', reg: { siegeCity: 'shangdang', siegeMode: 'defense' } },
  'defense-medium': { key: 'SiegeGameScene', reg: { siegeCity: 'chenliu', siegeMode: 'defense' } },
  'defense-large': { key: 'SiegeGameScene', reg: { siegeCity: 'luoyang', siegeMode: 'defense' } },
  'intel-bounty': { key: 'IntelGameScene', intel: 'bounty' }, 'intel-bandit': { key: 'IntelGameScene', intel: 'bandit' }, 'intel-escort': { key: 'IntelGameScene', intel: 'escort' },
  'challenge-lubu': { key: 'LubuGameScene' },
};
const all = [...Object.keys(CH).flatMap(n => [1, 2, 3].map(s => `${n}-${s}`)), ...Object.keys(SIEGE), ...Object.keys(EXTRA)];
const only = arg('only', ''), list = only ? only.split(',') : all;

const heroRec = id => ({ id, kind: 'hero', hero: id, name: id, template: 'spear', quality: 'orange', rank: 1, picks: [] });
const roster = { version: 1, lord: 'zhaoyun', lordFinal: true, owned: [heroRec('zhaoyun'), heroRec('zhangfei'), { id: 'r_1', kind: 'common', name: '王勇', template: 'bow', quality: 'green', rank: 1, picks: [] }, { id: 'r_2', kind: 'named', name: '李平', template: 'blade', quality: 'purple', rank: 1, picks: [] }], followers: ['zhangfei', 'r_1', 'r_2'], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 2, hall: 3 };
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 12, tutorialDone: true };
const heroes = { version: 1, migrated: true, attrSet: 3, heroes: { zhaoyun: { level: 20, xp: 0, attributes: { strength: 10, agility: 9, intellect: 0, command: 0 } } } };

const jsonPath = `${OUT}/scene-audit.json`, results = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf8')) : {};
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });

for (const id of list) {
  const t0 = Date.now(), errors = [], shots = [];
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
  const warns = []; p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push('console ' + m.text().slice(0, 160)); if (m.type() === 'warning' && /texture|frame|missing|not found/i.test(m.text())) warns.push(m.text().slice(0, 140)); });
  const shot = async name => { const f = `${OUT}/${id}-${name}.png`; await p.screenshot({ path: f }); shots.push(f); };
  let row = { id };
  try {
    await p.addInitScript(([r, w, h]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_heroes_v1', JSON.stringify(h)); sessionStorage.setItem('seeded', '1'); } }, [roster, world, heroes]);
    await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&followers=1');
    await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
    const X = EXTRA[id], siege = SIEGE[id], [chn, stn] = siege || X ? [0, 0] : id.split('-').map(Number), C = CH[chn];
    const key = X ? X.key : siege ? 'SiegeGameScene' : C.key;
    await p.evaluate(async ([C, st, siege, key, X]) => {
      const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.remove('thirdTransfer');
      let cfg = {};
      if (X?.reg) for (const [k, v] of Object.entries(X.reg)) s0.registry.set(k, v);
      if (X?.intel) { const W = await import('/src/world/WorldIntel.ts'), first = Object.entries(W.BOUNTY_GENERALS)[0]; const ev = { id: 'audit-' + X.intel, kind: X.intel, city: X.intel === 'escort' ? 'xiangyang' : 'luoyang', faction: X.intel === 'bounty' ? first[0] : X.intel === 'bandit' ? 'yellow' : 'han', general: X.intel === 'bounty' ? first[1][0] : undefined, expires: 9999 }; s0.registry.set('intelEvent', ev.id); s0.registry.set('intelPreview', ev); }
      if (X) {}
      else if (siege) { s0.registry.set('siegeCity', siege); s0.registry.remove('siegeMode'); }
      else if (C.reg) { s0.registry.set(C.reg, st); cfg = C.reg === 'guanduStage' ? {} : { thirdStage: st }; }
      else cfg = C.cfgv;
      s0.registry.set('runConfig', { character: 'zhaoyun', ...cfg }); s0.scene.start(key);
    }, [C ? { reg: C.reg, cfgv: C.cfg?.(stn) } : {}, stn, siege, key, X ?? null]);
    await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed < 6; }, key, { timeout: 120000 });
    // 剧情卷轴 / 弹窗先点掉，等随行到位
    await p.evaluate(async k => {
      const s = window.__game.scene.getScene(k); window.__S = s; s.player.damageImmune = true;
      document.querySelectorAll('[data-dev-panel],.dev-panel').forEach(x => x.style.display = 'none');
      window.__clear = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) {
        if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0);
        else if (s.mode === 'recruit') { s.chooseRecruit?.(0); if (s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); }
        else if (s.mode === 'parley' && s.parley?.choose) s.parley.choose('execute');
        else if (s.mode === 'story' || s.mode === 'parley') { const hits = s.input._list.filter(o => o.active && o.visible !== false && o.input?.enabled); const top = hits[hits.length - 1]; if (top) { top.emit('pointerdown', { x: top.x, y: top.y }); top.emit('pointerup', { x: top.x, y: top.y }); } else break; }
        else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); else break; } } };
      // 刷怪记录
      window.__spawns = []; const orig = s.spawnEnemy; s.spawnEnemy = function (kind, x, y, ...r) { const e = orig.call(this, kind, x, y, ...r); if (e?.active) window.__spawns.push([Math.round(e.x), Math.round(e.y), kind]); return e; };
      for (let i = 0; i < 40; i++) { window.__clear(); await new Promise(r => setTimeout(r, 100)); }
    }, key);
    await p.waitForTimeout(1500);
    await p.evaluate(() => window.__clear());
    await shot('start');
    const texCheck = tag => p.evaluate(tag => {
      const s = window.__S, all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(s.children.list);
      const vis = all.filter(o => o.visible !== false && (o.alpha ?? 1) > .02 && o.texture);
      const missing = vis.filter(o => o.texture.key === '__MISSING' || (o.texture.key === '__DEFAULT' && o.type !== 'Container' && o.type !== 'Graphics' && o.type !== 'Text' && !o.input)).map(o => [o.type, o.name || '', Math.round(o.x), Math.round(o.y)]);
      const badFrame = vis.filter(o => o.frame && o.frame.name === '__BASE' && o.texture.frameTotal > 2 && /walk|attack|sheet|_s$/.test(o.texture.key)).map(o => o.texture.key);
      const enemyKeys = {}; for (const e of s.enemies) if (e.active && !e.isSupplySlot) { const k = e.sprite?.texture?.key ?? '?'; enemyKeys[k] = (enemyKeys[k] ?? 0) + 1; }
      return { tag, missing: missing.slice(0, 8), missingN: missing.length, badFrame: [...new Set(badFrame)].slice(0, 6), enemyKeys };
    }, tag);
    row.tex = [await texCheck('start')];

    // ———— 障碍图（主将逐格瞬移 + 跑一帧） ————
    const probe = async (tag, rx = 1700, ry = 1500, step = 60) => {
      const m = await p.evaluate(([rx, ry, step]) => {
        const s = window.__S, pl = s.player, sp = pl.sprite, cx = Math.round(pl.x), cy = Math.round(pl.y);
        window.__IM.setMove(0, 0);
        const cols = Math.floor(2 * rx / step) + 1, rows = Math.floor(2 * ry / step) + 1, data = new Array(cols * rows).fill(0);
        let time = s.time.now; const kill = () => { for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate?.(); };
        kill();
        for (let j = 0; j < rows; j++) { for (let i = 0; i < cols; i++) {
          const x = cx - rx + i * step, y = cy - ry + j * step; sp.setPosition(x, y);
          try { s.update(time += 16, 16); } catch (e) { /* 个别系统手动驱动报错时跳过这一格 */ }
          const moved = Math.hypot(pl.x - x, pl.y - y), slow = s.terrain?.speedMul?.(x, y) ?? 1;
          data[j * cols + i] = moved > 4 ? 1 : slow < .95 ? 2 : 0;
        } if (j % 6 === 0) kill(); }
        sp.setPosition(cx, cy); kill();
        return { cx, cy, rx, ry, step, cols, rows, data: data.join('') };
      }, [rx, ry, step]);
      await p.evaluate(m => { window.__mapNow = m; }, m);
      // 拉远叠图截全景
      await p.evaluate(m => {
        const s = window.__S, cam = s.cameras.main, g = s.add.graphics().setDepth(1e6); window.__ov = g; window.__zoom0 = cam.zoom;
        for (let j = 0; j < m.rows; j++) for (let i = 0; i < m.cols; i++) { const v = m.data[j * m.cols + i]; if (v === '0') continue;
          g.fillStyle(v === '1' ? 0xff2020 : 0x2080ff, v === '1' ? .38 : .28).fillRect(m.cx - m.rx + i * m.step - m.step / 2, m.cy - m.ry + j * m.step - m.step / 2, m.step, m.step); }
        g.lineStyle(4, 0xffff00, 1).strokeCircle(m.cx, m.cy, 26);
        // 镜头每帧跟主将（updateCamera），先停掉；拉远后反复校正 scroll 让全景中心对准出生点
        window.__ucam = s.updateCamera; s.updateCamera = () => {};
        const z = Math.min(cam.width / (2 * m.rx + 200), cam.height / (2 * m.ry + 200)); cam.setZoom(z);
      }, m);
      for (let k = 0; k < 4; k++) { await p.waitForTimeout(120); await p.evaluate(m => { const cam = window.__S.cameras.main, v = cam.worldView; cam.scrollX += m.cx - (v.x + v.width / 2); cam.scrollY += m.cy - (v.y + v.height / 2); }, m); }
      await p.waitForTimeout(300); await shot('map' + tag);
      await p.evaluate(() => { const s = window.__S; window.__ov?.destroy(); s.cameras.main.setZoom(window.__zoom0 ?? 1); if (window.__ucam) s.updateCamera = window.__ucam; });
      const blocked = [...m.data].filter(v => v === '1').length, water = [...m.data].filter(v => v === '2').length;
      return { ...m, blocked, water };
    };
    const maps = { first: await probe('') };
    // 攻城：PHASES=1 时依次切到瓮城 / 巷战 / 府衙（SiegeMidCity.transition），每段截图 + 障碍图 + 8 秒战斗截图
    if (siege && process.env.PHASES) for (const to of ['barbican', 'street', 'hall']) {
      const ph = await p.evaluate(async to => { const s = window.__S, M = s.siegeMid; if (!M) return 'nomid'; try { M.transition(to); } catch (e) { return 'err ' + e.message; }
        const t = performance.now(); while (performance.now() - t < 4000) { window.__clear(); await new Promise(r => setTimeout(r, 150)); } return M.phase; }, to);
      row['phase_' + to] = ph; if (ph !== to) continue;
      await shot('phase-' + to); maps[to] = await probe('-' + to);
      await p.evaluate(async () => { let a = 0; const t = performance.now(); while (performance.now() - t < 8000) { window.__clear(); a += .1; window.__IM.setMove(Math.cos(a) * .6, Math.sin(a) * .6); await new Promise(r => setTimeout(r, 150)); } window.__IM.setMove(0, 0); });
      await shot('fight-' + to);
    }

    // ———— 战斗：正常刷怪（不秒杀）→ 截「fight」；再秒杀推进到首领 → 首领在场正常打 4 秒截「boss」→ 秒杀收尾 ————
    const run = await p.evaluate(async ([fightSecs, siege]) => {
      const s = window.__S, pl = s.player, R = { samples: 0, deep: { follower: 0, enemy: 0, boss: 0 }, deepExamples: [], phases: [], bossCrowd: null, bossAt: null, over: false, victory: null, stuck: false, shots: [] };
      const m0 = window.__mapNow;
      const deepAt = (m, x, y) => { if (!m) return false; const i = Math.round((x - (m.cx - m.rx)) / m.step), j = Math.round((y - (m.cy - m.ry)) / m.step);
        const at = (a, b) => a >= 0 && b >= 0 && a < m.cols && b < m.rows && m.data[b * m.cols + a] === '1'; return at(i, j) && at(i + 1, j) && at(i - 1, j) && at(i, j + 1) && at(i, j - 1); };
      let a = 0, lastSample = 0, lastProg = performance.now(), lastK = s.kills, lastE = s.elapsed, phase = s.siegeMid?.phase ?? null;
      const step = async () => {
        window.__clear(); if (s.awaitingChest) s.collectBossChests?.();
        let tgt = s.boss?.active ? s.boss : null, best = 1e9; if (!tgt) for (const e of s.enemies) if (e.active && !e.isSupplySlot) { const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d < best) { best = d; tgt = e; } }
        if (tgt) { a += .15; const tx = tgt.x + Math.cos(a) * 110, ty = tgt.y + Math.sin(a) * 110, dx = tx - pl.x, dy = ty - pl.y, d = Math.hypot(dx, dy) || 1; window.__IM.setMove(dx / d, dy / d); } else window.__IM.setMove(Math.cos(a += .05) * .5, Math.sin(a) * .5);
        const now = performance.now();
        if (now - lastSample > 600 && s.mode === 'none') { lastSample = now; R.samples++; const m = window.__mapNow;
          for (const f of s.followers?.members ?? []) if (f.active !== false && deepAt(m, f.x, f.y)) { R.deep.follower++; if (R.deepExamples.length < 6) R.deepExamples.push(['随行', Math.round(f.x), Math.round(f.y)]); }
          for (const e of s.enemies) if (e.active && !e.isSupplySlot && deepAt(m, e.x, e.y)) { if (e.kind === 'boss') R.deep.boss++; else R.deep.enemy++; if (R.deepExamples.length < 6) R.deepExamples.push([e.kind, Math.round(e.x), Math.round(e.y)]); } }
        if (s.kills !== lastK || Math.abs(s.elapsed - lastE) > .5) { lastProg = now; lastK = s.kills; lastE = s.elapsed; }
        await new Promise(r => setTimeout(r, 120));
      };
      // 1) 正常战斗 fightSecs 游戏秒（2 倍速）
      s.devTimeScale = 2; const e0 = s.elapsed;
      while (s.elapsed - e0 < fightSecs && !s.over && performance.now() - lastProg < 40000) await step();
      R.fightEnemies = s.enemies.filter(e => e.active && !e.isSupplySlot).length;
      return R;
    }, [fightSecs, !!siege]);
    await shot('fight');
    row.tex.push(await texCheck('fight'));
    // 2) 秒杀推进，遇到首领登场 / 攻城换段就停下来
    let more = true, guard = 0;
    while (more && guard++ < 12) {
      const ev = await p.evaluate(async () => {
        const s = window.__S, pl = s.player; s.devOneHit = true; s.devTimeScale = 4; const t = performance.now(); let a = 0, ph = s.siegeMid?.phase ?? null, lastK = s.kills, lastProg = performance.now();
        while (performance.now() - t < 120000) {
          window.__clear(); if (s.awaitingChest) s.collectBossChests?.();
          if (s.over) return { ev: 'over', victory: s.victory };
          const bo = s.boss?.active ? s.boss : s.enemies.find(e => e.active && e.kind === 'boss'); if (bo && !window.__bossSeen) { window.__bossSeen = true; window.__bossRef = bo; return { ev: 'boss' }; }
          const nph = s.siegeMid?.phase ?? null; if (nph !== ph && !s.siegeMid?.transitioning) return { ev: 'phase', phase: nph };
          let tgt = s.boss?.active ? s.boss : null, best = 1e9; if (!tgt) for (const e of s.enemies) if (e.active && !e.isSupplySlot) { const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d < best) { best = d; tgt = e; } }
          // 攻城：没敌人时朝城门 / 下一段走（冲车、城门在北面）
          if (tgt) { a += .15; const tx = tgt.x + Math.cos(a) * 90, ty = tgt.y + Math.sin(a) * 90, dx = tx - pl.x, dy = ty - pl.y, d = Math.hypot(dx, dy) || 1; window.__IM.setMove(dx / d, dy / d); } else window.__IM.setMove(Math.cos(a += .05) * .4, -.6);
          if (s.kills !== lastK) { lastK = s.kills; lastProg = performance.now(); }
          if (performance.now() - lastProg > 45000) return { ev: 'stuck', mode: s.mode, phase: nph };
          await new Promise(r => setTimeout(r, 150));
        }
        return { ev: 'timeout' };
      });
      if (ev.ev === 'boss') {
        await p.evaluate(async () => { const s = window.__S; s.devOneHit = false; s.devTimeScale = 1; const t = performance.now(); while (performance.now() - t < 4000) { window.__clear(); await new Promise(r => setTimeout(r, 150)); } });
        const crowd = await p.evaluate(() => { const s = window.__S, bo = s.boss?.active ? s.boss : window.__bossRef; if (!bo?.active) return null; const cam = s.cameras.main, v = cam.worldView;
          return { near: s.enemies.filter(e => e.active && e !== bo && !e.isSupplySlot && Math.hypot(e.x - bo.x, e.y - bo.y) < 70).length, onScreen: v.contains(bo.x, bo.y), dist: Math.round(Math.hypot(bo.x - s.player.x, bo.y - s.player.y)) }; });
        row.bossCrowd = crowd; await shot('boss'); row.tex.push(await texCheck('boss'));
      } else if (ev.ev === 'phase') {
        await p.waitForTimeout(2500); await p.evaluate(() => window.__clear());
        await shot('phase-' + ev.phase); maps[ev.phase] = await probe('-' + ev.phase);
      } else { row.end = ev; more = false; }
    }
    // 抽样统计（第二轮再跑一次抽样：在全程首个障碍图上判定深入障碍）
    const tail = await p.evaluate(m => {
      const s = window.__S, inBlocked = (x, y) => { const i = Math.round((x - (m.cx - m.rx)) / m.step), j = Math.round((y - (m.cy - m.ry)) / m.step); if (i < 0 || j < 0 || i >= m.cols || j >= m.rows) return 'out'; return m.data[j * m.cols + i]; };
      const sp = window.__spawns, c = { total: sp.length, blocked: 0, water: 0, out: 0, ex: [] };
      for (const [x, y, k] of sp) { const v = inBlocked(x, y); if (v === '1') { c.blocked++; if (c.ex.length < 5) c.ex.push([k, x, y]); } else if (v === '2') c.water++; else if (v === 'out') c.out++; }
      return { spawns: c, stage: s.chapter?.name, label: s.chapter?.label, boss: s.chapter?.bossName, result: s.over ? [s.resultTexts?.title?.text, s.resultTexts?.subtitle?.text, (s.resultTexts?.body?.text ?? '').split('\n').find(l => /结局/.test(l))].join(' | ') : null, hp: Math.round(s.player.hp), elapsed: Math.round(s.elapsed) };
    }, maps.first);
    Object.assign(row, run, tail, { maps: Object.fromEntries(Object.entries(maps).map(([k, v]) => [k, { blocked: v.blocked, water: v.water, cx: v.cx, cy: v.cy, step: v.step, cols: v.cols, rows: v.rows, data: v.data }])) });
  } catch (e) { row.error = e.message.split('\n')[0].slice(0, 220); try { await shot('error'); } catch {} }
  row.errors = [...new Set(errors)].slice(0, 5); row.warns = [...new Set(warns)].slice(0, 8); row.shots = shots; row.wall = Math.round((Date.now() - t0) / 1000);
  results[id] = row; writeFileSync(jsonPath, JSON.stringify(results, null, 1));
  const mp = row.maps?.first;
  console.log(`${id} ${row.stage ?? ''}：${row.error ? '出错 ' + row.error : (row.end?.ev ?? '?')}${row.end?.victory != null ? (row.end.victory ? ' 胜' : ' 负') : ''} · 障碍格 ${mp?.blocked ?? '—'} 水格 ${mp?.water ?? '—'} · 刷怪 ${row.spawns?.total ?? '—'}（墙里 ${row.spawns?.blocked ?? '—'} 水里 ${row.spawns?.water ?? '—'}）· 深入障碍 随行 ${row.deep?.follower ?? '—'} 敌 ${row.deep?.enemy ?? '—'} 首领 ${row.deep?.boss ?? '—'} · 首领周围小兵 ${row.bossCrowd?.near ?? '—'} · ${row.wall}s${row.errors.length ? ' · 页面错误 ' + row.errors[0] : ''}`);
  await p.close();
}
await b.close();
