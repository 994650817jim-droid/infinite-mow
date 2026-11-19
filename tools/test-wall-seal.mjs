// 关墙封死测试（用户 2026-11-18「城墙要过不去，不是绕一下就过去」）：汜水关、第 3~12 章关隘 / 城池、官渡袁军大营、攻城（中城）。
// 逐项检查（电脑布局，需要开发服务器）：
//  1. 墙线扫描：沿关墙中线逐点（步长 10）放一个主将大小的圆，没有碰撞框挡着的空档只能在关门（或辕门）范围内；门关着时一个都不许有。
//  2. 绕路搜索：从开局点出发做可达性搜索（半径 16 的圆、碰撞框都算实心），门关着时到不了墙以北；拆掉关门框后能到（证明搜索本身没问题）。
//  3. 实际推走：沿墙线逐列让主将 / 敌兵 / 部曲从墙南向北一格一格走，用场景自己的 resolve 挡人，没有一个越过墙线（关门除外）。
//  4. 城墙画面连续：同一条线上的城墙段一段接一段，从门两侧一直接到两端崖壁 / 场地边，中间没有空档。
// 用法：BASE=http://127.0.0.1:5211/ node tools/test-wall-seal.mjs   （ONLY=hulao-1,guandu-1 只跑这几关）
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const save = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'] };
const CASES = [
  { key: 'hulao-1', name: '2-1 汜水关', scene: 'GameScene', reg: {}, run: { chapter: 'hulao', westStage: 1 }, tag: 'sishui', kind: 'pass' },
  { key: 'qunxiong-1', name: '3-1 长安（城池）', scene: 'ThirdGameScene', reg: { thirdStage: 1 }, run: { thirdStage: 1 }, tag: 'fort', kind: 'pass' },
  { key: 'chibi-3', name: '5-3 江陵', scene: 'ChibiGameScene', reg: { chibiStage: 3 }, run: { thirdStage: 3 }, tag: 'fort', kind: 'pass' },
  { key: 'jingnan-1', name: '6-1 桂阳（城池）', scene: 'JingnanGameScene', reg: { jingnanStage: 1 }, run: { thirdStage: 1 }, tag: 'fort', kind: 'pass' },
  { key: 'jingnan-3', name: '6-3 长沙', scene: 'JingnanGameScene', reg: { jingnanStage: 3 }, run: { thirdStage: 3 }, tag: 'fort', kind: 'pass' },
  { key: 'hanzhong-1', name: '8-1 阳平关', scene: 'HanzhongGameScene', reg: { hanzhongStage: 1 }, run: { thirdStage: 1 }, tag: 'fort', kind: 'pass' },
  { key: 'yiling-1', name: '10-1 猇亭（吴军营寨）', scene: 'YilingGameScene', reg: { yilingStage: 1 }, run: { thirdStage: 1 }, tag: 'fort', kind: 'camp' },
  { key: 'guandu-1', name: '4-1 白马（袁军大营）', scene: 'GuanduGameScene', reg: { guanduStage: 1 }, run: {}, tag: 'yuan', kind: 'camp' },
  { key: 'guandu-2', name: '4-2 延津（袁军大营）', scene: 'GuanduGameScene', reg: { guanduStage: 2 }, run: {}, tag: 'yuan', kind: 'camp' },
  // 2-3 洛阳：董卓上城那一段才有城墙（DongzhuoLubu 自己一份碰撞框），整道墙没有可开的门
  { key: 'luoyang', name: '2-3 洛阳（董卓城墙）', scene: 'GameScene', reg: {}, run: { chapter: 'hulao', westStage: 3 }, tag: 'luoyang', kind: 'pass', dz: true },
  { key: 'siege-medium', name: '攻城 · 中城', scene: 'SiegeGameScene', siege: true, tag: 'siege', kind: 'siege' },
];
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);

/** 页面内的检查（一次 evaluate 跑完）：返回各项结果。 */
const INPAGE = `(s, c) => {
  const R = 16, obs = c.dz ? s.dzLubu.obstacles : s.sishuiObstacles, boxes = obs.footprints;
  // 2-3 洛阳：要封的是「城里」（城墙宽 ±900、往北一圈围起来）；绕着城外走到北面不算穿墙
  const lim = c.dz ? 900 : 1e9, inCity = x => Math.abs(x - (c.siege ? 0 : s.children.getByName(c.tag + '-gate').x)) < lim - 40;
  const hit = (x, y, r = R) => boxes.some(b => x > b.left - r && x < b.right + r && y > b.top - r && y < b.bottom + r);
  const gate = c.siege ? null : s.children.getByName(c.tag + '-gate');
  const wy = c.siege ? -580 : gate.y - 2, px = c.siege ? 0 : gate.x;
  const out = { wy, boxes: boxes.length };
  // ---- 2. 绕路搜索（格子 20，范围以开局点为中心 ±3600 × [wy-3400, start+3000]）
  const gateHalf = c.siege ? 86 : 135;
  // 营寨辕门一直可通行：搜索时临时把辕门堵上，看墙其余部分能不能绕
  const tmpGate = c.kind === 'camp' ? { left: px - gateHalf, right: px + gateHalf, top: wy - 70, bottom: wy - 10 } : null; if (tmpGate) boxes.push(tmpGate);
  const sx = s.player.x, sy = s.player.y, step = 20, x0 = px - 3600, x1 = px + 3600, y0 = wy - 3400, y1 = sy + 3000, W = Math.ceil((x1 - x0) / step), H = Math.ceil((y1 - y0) / step);
  const seen = new Uint8Array(W * H), q = [], idx = (x, y) => y * W + x;
  const sxi = Math.floor((sx - x0) / step), syi = Math.floor((sy - y0) / step); q.push(sxi, syi); seen[idx(sxi, syi)] = 1;
  let reachedNorth = false, cells = 0;
  for (let h = 0; h < q.length; h += 2) {
    const cx = q[h], cy = q[h + 1]; cells++;
    if (y0 + cy * step < wy - 160 && inCity(x0 + cx * step) && (!c.dz || y0 + cy * step > wy - 1900)) reachedNorth = true; // 洛阳：城的北墙在 wy-2000，北墙外不算城里
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[idx(nx, ny)]) continue; if (hit(x0 + nx * step, y0 + ny * step)) continue; seen[idx(nx, ny)] = 1; q.push(nx, ny); }
  }
  out.search = { reachedNorth, cells };
  if (tmpGate) boxes.splice(boxes.indexOf(tmpGate), 1);
  const reach = (x, y) => { const i = Math.floor((x - x0) / step), j = Math.floor((y - y0) / step); return i >= 0 && j >= 0 && i < W && j < H && !!seen[idx(i, j)]; };
  // ---- 1. 墙线扫描
  const free = [];
  for (let x = px - 3600; x <= px + 3600; x += 10) if (!hit(x, wy - 40)) free.push(x);
  const outside = free.filter(x => inCity(x) && reach(x, wy + 60) && Math.abs(x - px) > gateHalf + R + 6); // 只算从开局点走得到的墙段（崖壁外侧没人到得了）
  out.scan = { reachFree: free.filter(x => inCity(x) && reach(x, wy + 60)).length, freeCount: free.length, outside: outside.length, firstOutside: outside.slice(0, 5), closedFree: c.kind === 'camp' ? null : free.length };

  // ---- 3. 实际推走：沿墙线逐列从南向北走（主将、敌兵、部曲各一个）
  const walkers = []; const pl = s.player;
  const ally = s.allies.find(a => a.active), foe = s.spawnEnemy('infantry', px, wy + 200, 40);
  const cols = []; for (let x = px - 1500; x <= px + 1500; x += 50) if (inCity(x) && reach(x, wy + 120)) cols.push(x); out.cols = cols.length;
  const slip = { player: [], ally: [], enemy: [] };
  const run = (who, put, get, list, rad) => { for (const cx of cols) {
    put(cx, wy + 120);
    for (let i = 0; i < 70; i++) { put(get().x, get().y - 6); obs.resolve(pl, who === 'ally' ? [ally] : [], who === 'enemy' ? [foe] : []); }
    const y = get().y; if (y < wy - 80 && Math.abs(cx - px) > gateHalf + rad + 8) list.push([cx, Math.round(y)]); } };
  const keep = { x: pl.x, y: pl.y, ax: ally?.x, ay: ally?.y };
  const dmg = pl.damageImmune; pl.damageImmune = true;
  run('player', (x, y) => pl.sprite.setPosition(x, y), () => ({ x: pl.x, y: pl.y }), slip.player, pl.radius);
  if (ally) run('ally', (x, y) => ally.sprite.setPosition(x, y), () => ({ x: ally.x, y: ally.y }), slip.ally, ally.radius);
  if (foe) run('enemy', (x, y) => foe.sprite.setPosition(x, y), () => ({ x: foe.x, y: foe.y }), slip.enemy, foe.radius);
  pl.sprite.setPosition(keep.x, keep.y); if (ally) ally.sprite.setPosition(keep.ax, keep.ay); if (foe) foe.deactivate?.(); pl.damageImmune = dmg;
  out.slip = { player: slip.player.length, ally: slip.ally.length, enemy: slip.enemy.length, hasAlly: !!ally, hasFoe: !!foe, sample: [...slip.player, ...slip.ally, ...slip.enemy].slice(0, 4) };
  // ---- 拆掉关门框后能到墙以北（证明搜索本身有效）：只对有关门框的关
  const gf = s.sishuiPass?.gateFoot, gi = gf ? boxes.indexOf(gf) : -1;
  if (gi >= 0) {
    boxes.splice(gi, 1); seen.fill(0); q.length = 0; q.push(sxi, syi); seen[idx(sxi, syi)] = 1; let open = false;
    for (let h = 0; h < q.length; h += 2) { const cx = q[h], cy = q[h + 1]; if (y0 + cy * step < wy - 160) { open = true; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[idx(nx, ny)]) continue; if (hit(x0 + nx * step, y0 + ny * step)) continue; seen[idx(nx, ny)] = 1; q.push(nx, ny); } }
    boxes.splice(gi, 0, gf); out.openReaches = open;
  }
  // ---- 4. 城墙画面连续
  const imgs = c.siege ? s.children.list.filter(o => o.texture?.key === 'siege_mid_walls' && o.frame?.name === 0 && Math.abs(o.y - (wy + 24)) < 8) : s.children.list.filter(o => o.name === c.tag + '-wall');
  const iv = imgs.map(o => [o.x - o.displayWidth / 2, o.x + o.displayWidth / 2]).sort((a, b) => a[0] - b[0]);
  let gaps = [], edge = iv.length ? iv[0][1] : 0; for (let i = 1; i < iv.length; i++) { if (iv[i][0] > edge + 1) gaps.push([Math.round(edge), Math.round(iv[i][0])]); edge = Math.max(edge, iv[i][1]); }
  // 门洞一段（中间）允许空：只看门两侧各自是否连到端点
  const gl = px - gateHalf, gr = px + gateHalf;
  const side = (lo, hi) => { const a = iv.filter(v => v[1] > lo && v[0] < hi); if (!a.length) return { ok: false }; let r = Math.max(lo, a[0][0]); const first = a[0][0]; let cont = true; for (let i = 1; i < a.length; i++) { if (a[i][0] > Math.max(...a.slice(0, i).map(v => v[1])) + 1) cont = false; } return { ok: cont, from: Math.round(first), to: Math.round(Math.max(...a.map(v => v[1]))) }; };
  out.art = { count: imgs.length, gaps: gaps.filter(g => !(g[0] >= gl - 40 && g[1] <= gr + 40)), left: side(-1e9, gl + 20), right: side(gr - 20, 1e9), px, span: iv.length ? [Math.round(iv[0][0]), Math.round(iv[iv.length - 1][1])] : null };
  return out;
}`;

const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(BASE + '?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  for (const c of CASES.filter(c => !ONLY.length || ONLY.includes(c.key))) {
    const S = `window.__game.scene.getScene('${c.scene}')`;
    const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
    if (c.siege) {
      await p.evaluate(async () => {
        const cc = await import('/src/world/WorldCities.ts'), w = await import('/src/world/WorldStore.ts'), s = w.loadWorld();
        const id = cc.CITIES.find(x => x.tier === 'medium' && cc.cityAttackable(x.id, s.ownedCities))?.id;
        const g = window.__game; g.registry.set('siegeCity', id); g.registry.remove('siegeMode'); g.registry.set('runConfig', { character: 'zhaoyun' });
        for (const sc of g.scene.getScenes(true)) sc.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('SiegeGameScene'); else { g.registry.set('pendingWarlord', 'SiegeGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); }
      });
    } else {
      await p.evaluate(([key, reg, run]) => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer', 'guanduTransfer']) g.registry.remove(k); for (const [k, v] of Object.entries(reg)) g.registry.set(k, v); g.registry.set('runConfig', { character: 'zhaoyun', ...run }); const cur = g.scene.getScene(key); if (cur && g.scene.isActive(key)) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); } }, [c.scene, c.reg, c.run]);
    }
    await p.waitForTimeout(500);
    await p.waitForFunction(([S0, siege]) => { const s = eval(S0); return s?.player && s.scene.isActive() && (s.sishuiObstacles || siege) && (s.sishuiPass || siege); }, [S, !!c.siege || !!c.dz], { timeout: 90000 });
    for (let t = 0; t < 1800; t += 200) { await ev(() => 0); await p.waitForTimeout(200); }
    if (c.dz) for (let i = 0; i < 150; i++) { // 董卓上城：跳过剧情、推到首领出场
      const ok = await ev(s => { if (s.mode === 'story' || s.mode === 'parley') { for (const o of s.children.list) { const btn = o.list?.find(q => /-(next|confirm)$/.test(q.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } } if (!s.dzLubu && !s.bossSpawned) { const w = s.chapter?.waves; s.devSetTime?.(w?.length ? w[w.length - 1].start + 1 : 999); } return !!s.dzLubu && !!s.children.getByName('luoyang-gate') && s.mode === 'none'; });
      if (ok) break; await p.waitForTimeout(250);
    }
    await ev(s => { s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; });
    const r = await ev(eval(INPAGE), c);
    const camp = c.kind === 'camp';
    ck(`${c.name}：墙线扫描${camp ? '（只留辕门）' : '（门关着没有任何空档）'}`, camp ? r.scan.outside === 0 : r.scan.reachFree === 0, r.scan);
    ck(`${c.name}：从开局点出发绕不到墙以北${camp ? '' : '（拆掉关门框后能到）'}`, camp ? r.scan.outside === 0 : !r.search.reachedNorth && (r.openReaches === undefined || r.openReaches === true), { search: r.search, openReaches: r.openReaches });
    ck(`${c.name}：主将 / 敌兵 / 部曲沿墙线逐列硬走，一个都没越过`, r.slip.player === 0 && r.slip.ally === 0 && r.slip.enemy === 0 && r.slip.hasFoe, r.slip);
    ck(`${c.name}：城墙画面连续（门两侧各一整条、中间无空档）`, r.art.count > 0 && r.art.gaps.length === 0 && r.art.left.ok && r.art.right.ok && r.art.span && r.art.span[0] <= r.art.px - (c.dz ? 760 : 1200) + (c.siege ? 700 : 0) && r.art.span[1] >= r.art.px + (c.dz ? 760 : 1200) - (c.siege ? 700 : 0), r.art);
  }
  ck('无 pageerror', errs.length === 0, errs);
} finally { await b.close(); }
const bad = rows.filter(x => !x).length;
console.log(`SUMMARY: ${rows.length - bad}/${rows.length} passed`);
process.exit(bad ? 1 : 0);
