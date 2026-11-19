// 城墙专项检查（设计会话 2026-11-18，统筹派「检查一下城墙有没有奇怪的」）。只读，不改游戏。
// 每个有墙的场景：扫出所有「墙类」图（名字含 wall / gate / cliff / palisade / tower，或贴图是城墙 / 瓮城 / 山崖图集），
// 自动挑拍摄点：全景、门（特写）、每条横墙的两端与中段接缝（特写）、崖壁上下端；再按碰撞框外边界拍「挡人的地方有没有画」；
// 遮挡：墙前 / 墙后各放一个敌兵、主将贴墙站，拍特写；开门后再拍一次门。攻城依次切瓮城 / 巷战 / 府衙重复。
// 用法：BASE=http://127.0.0.1:5173/ OUT=<目录> node tools/wall-audit.mjs [--only 2-1,siege-large]
// 输出：<OUT>/<场景>-<点>.jpg + <OUT>/wall-audit.json（每处墙图的位置 / 尺寸 / 图帧、碰撞框外边界）
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = process.env.OUT ?? 'assets/review/wall-audit';
mkdirSync(OUT, { recursive: true });
const CASES = {
  '2-1': { key: 'GameScene', run: { chapter: 'hulao', westStage: 1 } }, '2-3': { key: 'GameScene', run: { chapter: 'hulao', westStage: 3 } },
  '1-3': { key: 'GameScene', run: { chapter: 'huangjin', stage: 3 } },
  '3-1': { key: 'ThirdGameScene', reg: ['thirdStage', 1] }, '5-3': { key: 'ChibiGameScene', reg: ['chibiStage', 3] },
  '6-1': { key: 'JingnanGameScene', reg: ['jingnanStage', 1] }, '6-3': { key: 'JingnanGameScene', reg: ['jingnanStage', 3] },
  '8-1': { key: 'HanzhongGameScene', reg: ['hanzhongStage', 1] }, '10-1': { key: 'YilingGameScene', reg: ['yilingStage', 1] },
  '4-1': { key: 'GuanduGameScene', reg: ['guanduStage', 1] }, '4-2': { key: 'GuanduGameScene', reg: ['guanduStage', 2] },
  '9-1': { key: 'XiangfanGameScene', reg: ['xiangfanStage', 1] }, '12-2': { key: 'BeifaGameScene', reg: ['beifaStage', 2] },
  'lubu': { key: 'LubuGameScene', run: { chapter: 'hulao', westStage: 3 } },
  'siege-small': { key: 'SiegeGameScene', siege: 'shangdang' }, 'siege-medium': { key: 'SiegeGameScene', siege: 'chenliu' }, 'siege-large': { key: 'SiegeGameScene', siege: 'luoyang' },
};
const list = arg('only', '') ? arg('only', '').split(',') : Object.keys(CASES);
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'lubu'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 12, tutorialDone: true };
const heroRec = id => ({ id, kind: 'hero', hero: id, name: id, template: 'spear', quality: 'orange', rank: 1, picks: [] });
const roster = { version: 1, lord: 'zhaoyun', lordFinal: true, owned: [heroRec('zhaoyun'), heroRec('zhangfei'), heroRec('guanyu')], followers: ['zhangfei', 'guanyu'], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 2, hall: 3 };
const report = {};
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });

for (const id of list) {
  const C = CASES[id], p = await b.newPage({ viewport: { width: 1280, height: 720 } }), errors = [], shots = [];
  p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
  const R = report[id] = { shots, errors, phases: {} };
  try {
    await p.addInitScript(([r, w]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } }, [roster, world]);
    await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&followers=1&story=off');
    await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
    await p.evaluate(C => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.remove('thirdTransfer');
      let cfg = C.run ?? {}; if (C.siege) { s0.registry.set('siegeCity', C.siege); s0.registry.remove('siegeMode'); } if (C.reg) { s0.registry.set(C.reg[0], C.reg[1]); if (C.reg[0] !== 'guanduStage') cfg = { thirdStage: C.reg[1] }; }
      s0.registry.set('runConfig', { character: 'zhaoyun', ...cfg }); for (const sc of g.scene.getScenes(true)) if (sc.scene.key !== 'GameScene') sc.scene.stop(); s0.scene.start(C.key); }, C);
    await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed < 8; }, C.key, { timeout: 120000 });
    await p.evaluate(k => { const s = window.__game.scene.getScene(k); window.__S = s; s.player.damageImmune = true; document.querySelectorAll('[data-dev-panel],.dev-panel').forEach(x => x.style.display = 'none');
      window.__calm = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') { s.chooseRecruit?.(0); s.__DEV_ACTIONS?.closePopup?.(); } else if (s.mode === 'parley') s.parley?.choose?.('execute'); else { const hits = s.input._list.filter(o => o.active && o.visible !== false && o.input?.enabled); const top = hits[hits.length - 1]; if (s.mode === 'story' && top) { top.emit('pointerdown', { x: top.x, y: top.y }); top.emit('pointerup', { x: top.x, y: top.y }); } else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } } }
        s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'tower' && !e.__keep && e.kind !== 'boss') e.hp = 0; };
      window.__ucam = s.updateCamera; window.__z0 = s.cameras.main.zoom; }, C.key);
    for (let i = 0; i < 12; i++) { await p.evaluate(() => window.__calm()); await p.waitForTimeout(250); }

    const scan = () => p.evaluate(() => {
      const s = window.__S, out = [], RX = /wall|gate|cliff|palisade|tower|barbican|chencang|luoyang|rampart|fort/i, KX = /walls|barbican|shu_pass|siege|hall|fort|palisade/i;
      const walk = list => { for (const o of list) { if (o.list) walk(o.list); if (o.type !== 'Image' && o.type !== 'Sprite') continue; if (!o.visible || o.alpha < .05) continue;
        const key = o.texture?.key ?? '', nm = o.name ?? ''; if (!RX.test(nm) && !KX.test(key)) continue; if (/^(item|ui|icon|hud)/i.test(key)) continue;
        const bd = o.getBounds(); out.push({ n: nm, k: key, f: String(o.frame?.name ?? ''), x: Math.round(o.x), y: Math.round(o.y), l: Math.round(bd.left), r: Math.round(bd.right), t: Math.round(bd.top), b: Math.round(bd.bottom), d: +(o.depth ?? 0).toFixed(2), fx: !!o.flipX }); } };
      walk(s.children.list);
      const fp = s.sishuiObstacles?.footprints ?? [], ext = fp.length ? { l: Math.min(...fp.map(f => f.left)), r: Math.max(...fp.map(f => f.right)), t: Math.min(...fp.map(f => f.top)), b: Math.max(...fp.map(f => f.bottom)), n: fp.length } : null;
      return { art: out, ext, player: [Math.round(s.player.x), Math.round(s.player.y)], phase: s.siegeMid?.phase ?? null };
    });
    const look = async (name, x, y, zoom = 1) => {
      if (zoom >= 1) {
        // 特写：镜头照常跟主将（地面贴图才铺得满），主将挪到拍摄点；点在障碍里时会被推到最近的空地，画面中心随之偏一点
        await p.evaluate(([x, y]) => { const s = window.__S; s.updateCamera = window.__ucam; s.cameras.main.setZoom(window.__z0); s.player.sprite.setPosition(x, y); window.__calm(); }, [x, y]);
        await p.waitForTimeout(900);
      } else {
        // 全景：停掉跟随、拉远对准（外圈露黑底，不是问题）
        await p.evaluate(([x, y, z]) => { const s = window.__S, cam = s.cameras.main; window.__calm(); s.updateCamera = () => {}; cam.setZoom(window.__z0 * z); }, [x, y, zoom]);
        for (let k = 0; k < 3; k++) { await p.waitForTimeout(90); await p.evaluate(([x, y]) => { const cam = window.__S.cameras.main, v = cam.worldView; cam.scrollX += x - (v.x + v.width / 2); cam.scrollY += y - (v.y + v.height / 2); }, [x, y]); }
      }
      await p.waitForTimeout(150); const f = `${OUT}/${id}-${name}.jpg`;
      // 特写 = 不缩放，只截画面中心 1280/zoom × 720/zoom 那一块（游戏内缩放会让地面贴图对不上）
      const cw = Math.round(1280 / Math.max(1, zoom)), ch = Math.round(720 / Math.max(1, zoom));
      await p.screenshot({ path: f, type: 'jpeg', quality: 80, ...(zoom > 1 ? { clip: { x: (1280 - cw) / 2, y: (720 - ch) / 2, width: cw, height: ch } } : {}) }); shots.push(f);
    };
    const reset = () => p.evaluate(() => { const s = window.__S; s.cameras.main.setZoom(window.__z0); s.updateCamera = window.__ucam; });

    const shootPhase = async tag => {
      const sc = await scan(); R.phases[tag] = sc; const art = sc.art; if (!art.length && !sc.ext) { R.phases[tag].note = '没扫到墙图'; return; }
      const all = art.length ? { l: Math.min(...art.map(a => a.l)), r: Math.max(...art.map(a => a.r)), t: Math.min(...art.map(a => a.t)), b: Math.max(...art.map(a => a.b)) } : sc.ext;
      const cx = (all.l + all.r) / 2, cy = (all.t + all.b) / 2, z = Math.min(1280 / (all.r - all.l + 300), 720 / (all.b - all.t + 300), 1);
      await look(tag + '-overview', cx, cy, Math.max(.22, z));
      // 门
      const gate = art.find(a => /gate/i.test(a.n)) ?? art.filter(a => /walls/.test(a.k) && ['1', '2', '7'].includes(a.f)).sort((a, b) => Math.abs(a.x - sc.player[0]) - Math.abs(b.x - sc.player[0]))[0];
      if (gate) await look(tag + '-gate', gate.x, gate.y - 90, 1.6);
      // 横墙：按 y 聚类（同一条线 ±12），取最长的两条；拍左端 / 右端 / 中段接缝
      const segs = art.filter(a => !/cliff|tower|gate/i.test(a.n) && !/shu_pass/.test(a.k));
      const rows = []; for (const a of segs.sort((m, n) => m.y - n.y)) { const r = rows.find(r => Math.abs(r.y - a.y) <= 12); if (r) r.items.push(a); else rows.push({ y: a.y, items: [a] }); }
      rows.sort((m, n) => n.items.length - m.items.length);
      R.phases[tag].rows = rows.slice(0, 6).map(r => { const it = r.items.sort((m, n) => m.x - n.x); const gaps = []; for (let i = 1; i < it.length; i++) gaps.push(it[i].l - it[i - 1].r); return { y: r.y, n: it.length, x0: it[0].l, x1: it[it.length - 1].r, minGap: Math.min(...gaps), maxGap: Math.max(...gaps), keys: [...new Set(it.map(a => a.k + '#' + a.f))].slice(0, 4) }; });
      for (const [ri, r] of rows.slice(0, 2).entries()) { if (r.items.length < 2) continue; const it = r.items; const L = it[0], Rr = it[it.length - 1], M = it[Math.floor(it.length / 4)], M2 = it[Math.floor(it.length / 4) + 1] ?? M;
        await look(`${tag}-row${ri}-left-end`, L.l + 60, r.y - 80, 1.4); await look(`${tag}-row${ri}-right-end`, Rr.r - 60, r.y - 80, 1.4); await look(`${tag}-row${ri}-seam`, (M.r + M2.l) / 2, r.y - 70, 2); }
      // 竖墙 / 崖壁：取最左 / 最右一列的上下端
      const cl = art.filter(a => /cliff/i.test(a.n) || /shu_pass/.test(a.k) || (/barbican/.test(a.k) && a.f === '4'));
      if (cl.length) { const left = cl.filter(a => a.x < cx), right = cl.filter(a => a.x >= cx);
        for (const [sn, side] of [['L', left], ['R', right]]) { if (!side.length) continue; const top = side.reduce((m, a) => a.t < m.t ? a : m), bot = side.reduce((m, a) => a.b > m.b ? a : m);
          await look(`${tag}-cliff${sn}-top`, top.x, top.t + 120, 1); await look(`${tag}-cliff${sn}-bottom`, bot.x, bot.b - 120, 1); } }
      // 碰撞外边界：南 / 北边界中点、东西边界中点——挡人的地方有没有画
      if (sc.ext) { const e = sc.ext; await look(tag + '-bound-south', sc.player[0], e.b - 60, 1); await look(tag + '-bound-north', sc.player[0], e.t + 60, 1);
        // 崖壁外侧：碰撞到哪、画到哪
        if (cl.length) { const lx = Math.min(...cl.map(a => a.l)); await look(tag + '-beyond-left', lx - 100, sc.player[1], 1); } }
      // 遮挡：门旁墙段前后各放一个敌兵，主将贴墙站
      const ref = (rows[0]?.items ?? [])[Math.max(0, Math.floor((rows[0]?.items.length ?? 1) / 2) - 1)];
      if (ref) {
        await p.evaluate(([x, y]) => { const s = window.__S; const mk = (yy, k) => { const e = s.spawnEnemy(k, x, yy, 1); if (e) { e.__keep = true; e.def = { ...e.def, speed: 0 }; e.moveVx = e.moveVy = 0; e.hp = 9999; } return e; };
          window.__occ = [mk(y - 70, 'infantry'), mk(y + 30, 'shield')]; s.player.sprite.setPosition(x + 70, y + 26); }, [ref.x, ref.y]);
        await p.evaluate(() => { const s = window.__S; s.updateCamera = window.__ucam; s.cameras.main.setZoom(window.__z0); }); await p.waitForTimeout(900); { const f = `${OUT}/${id}-${tag}-occlusion.jpg`; await p.screenshot({ path: f, type: 'jpeg', quality: 80, clip: { x: 284, y: 160, width: 711, height: 400 } }); shots.push(f); }
        await p.evaluate(() => { for (const e of window.__occ ?? []) { if (e) { e.__keep = false; e.hp = 0; } } });
      }
    };

    await shootPhase('outside');
    // 开门 / 破门后的门
    const opened = await p.evaluate(() => { const s = window.__S, P = s.sishuiPass; try { if (P?.onBoss) { const e = s.spawnEnemy('infantry', s.player.x, s.player.y - 300, 1); if (e) e.__keep = true; P.onBoss(e ?? { x: 0, y: 0, sprite: { setPosition() {} } }); return 'onBoss'; } } catch (e) { return 'err ' + e.message; } return null; });
    R.opened = opened;
    if (opened && !String(opened).startsWith('err')) { await p.waitForTimeout(2500); const sc = await scan(); const g = sc.art.find(a => /gate/i.test(a.n)); if (g) await look('outside-gate-open', g.x, g.y - 90, 1.6); }
    await reset();
    if (C.siege) for (const to of ['barbican', 'street', 'hall']) {
      const ph = await p.evaluate(async to => { const M = window.__S.siegeMid; if (!M) return null; try { M.transition(to); } catch (e) { return 'err'; } const t = performance.now(); while (performance.now() - t < 4200) { window.__calm(); await new Promise(r => setTimeout(r, 150)); } return M.phase; }, to);
      if (ph === to) { await shootPhase(to); await reset(); }
    }
  } catch (e) { R.error = e.message.split('\n')[0].slice(0, 200); }
  console.log(id, R.error ? '出错 ' + R.error : `截图 ${shots.length} · 段 ${Object.keys(R.phases).join('/')} · 开门 ${R.opened ?? '—'}${errors.length ? ' · 页面错误 ' + errors[0] : ''}`);
  writeFileSync(`${OUT}/wall-audit.json`, JSON.stringify(report, null, 1));
  await p.close();
}
await b.close();
