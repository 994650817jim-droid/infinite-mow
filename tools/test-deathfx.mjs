// 敌军死亡特效（2026-11-18，B 脚下尘土定稿）：默认开启、设置关闭、首领 / 我方不受影响、倾倒方向、阴影淡出、对象池复用、手机降级、设置界面。
// 电脑布局 1280×720 + 一次手机布局。需要开发服务器（默认 5260）。用法：node tools/test-deathfx.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5260/', out = 'assets/review/deathfx';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const open = async (q, vp = { width: 1280, height: 720 }) => {
  const ctx = await b.newContext({ viewport: vp }), p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
  await p.addInitScript(() => {
    window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
    window.__find = (root, name) => { const walk = o => { if (!o) return null; if (o.name === name) return o; for (const c of o.list ?? []) { const r = walk(c); if (r) return r; } return null; }; return walk(root); };
    if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); }
  });
  await p.goto(base + q, { timeout: 180000, waitUntil: 'domcontentloaded' });
  return p;
};
const ready = async p => {
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.player.xpNext = 1e9; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); } });
};
const GAME = '?dev=1&autostart=1&stage=1&layout=desktop';

// —— 1) 默认开启（不带 ?deathfx）——
let p = await open(GAME); await ready(p);
const r1 = await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx, e = s.spawnEnemy('infantry', s.player.x + 120, s.player.y, 1, true);
  const before = fx?.played ?? -1; e.hp = 0; s.killEnemy(e);
  return { has: !!fx, mode: fx?.mode, dflt: !new URLSearchParams(location.search).has('deathfx'), played: (fx?.played ?? 0) - before, live: fx?.liveCount, active: e.active, setting: localStorage.getItem('im_death_fx') };
});
ck('默认开启（不带 ?deathfx）：B 方案，击杀一个普通敌人播一次', r1.has && r1.mode === 'b' && r1.dflt && r1.played === 1 && r1.live === 1 && !r1.active && r1.setting === null, r1);

// —— 2) 设置关闭 / 重新打开 ——
const r2 = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), bs = await window.__mod('/src/systems/BattleSettings.ts'), fx = s.deathFx, kill = () => { const e = s.spawnEnemy('infantry', s.player.x + 100, s.player.y + 20, 1, true); e.hp = 0; s.killEnemy(e); };
  bs.setDeathFx('off'); const a = fx.played; kill(); const off = fx.played - a; const ls = localStorage.getItem('im_death_fx');
  bs.setDeathFx('on'); const b2 = fx.played; kill(); return { off, on: fx.played - b2, ls, kills: s.kills };
});
ck('设置「死亡特效：关」：不再播（击杀照常计数）；打开后立刻恢复', r2.off === 0 && r2.on === 1 && r2.ls === 'off' && r2.kills > 0, r2);

// —— 3) 首领 / 我方 / 补给 不受影响 ——
const r3 = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx, out = {};
  s.spawnBoss(); const boss = s.boss; out.boss = !!boss?.active; const a = fx.played; if (boss) { boss.hp = 0; s.killEnemy(boss); } out.bossPlayed = fx.played - a;
  window.__IM.spawnAlly('swordsman'); const ally = s.allies.find(x => x.active); const b2 = fx.played; if (ally) { s.legion.hurt(ally, 99999, s.combatNow); } out.allyPlayed = fx.played - b2; out.allyDead = ally ? !ally.active : null;
  return out;
});
ck('首领不走这套；我方士兵 / 召唤物（不经 killEnemy）不受影响', r3.boss && r3.bossPlayed === 0 && r3.allyPlayed === 0 && r3.allyDead !== false, r3);

// —— 4) 倾倒方向：真实受击来源 → 敌人 ——
const r4 = await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx, out = {}, pool = () => fx.pool;
  const kill = (dx, fromAlly, ax) => {
    for (const e of fx.pool) fx.release(e);
    const e = s.spawnEnemy('infantry', s.player.x + dx, s.player.y, 1, true); e.speed = 0; e.hp = e.maxHp = 5;
    let ally = null; if (fromAlly) { window.__IM.spawnAlly('swordsman'); ally = s.allies.find(a => a.active); ally.setPosition(e.x + ax, e.y); }
    s.hitEnemy(e, 9999, s.combatNow, 'melee', !!fromAlly); const ent = fx.pool.find(x => x.active); return ent ? ent.dir : null;
  };
  out.heroLeft = kill(150, false);       // 敌人在主将右边，被主将打 → 向右倒
  out.heroRight = kill(-150, false);     // 敌人在主将左边 → 向左倒
  out.allyRight = kill(150, true, 60);   // 我方部曲在敌人右边打 → 向左倒
  out.allyLeft = kill(150, true, -60);   // 我方部曲在敌人左边打 → 向右倒
  return out;
});
ck('倾倒方向 = 受击来源 → 敌人：主将在左则向右倒、在右则向左倒；部曲打的按部曲位置算', r4.heroLeft === 1 && r4.heroRight === -1 && r4.allyRight === -1 && r4.allyLeft === 1, r4);

// —— 5) 阴影和身体一起淡出；倾倒 70° ——
const r5 = await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx; for (const e of fx.pool) fx.release(e);
  const e = s.spawnEnemy('infantry', s.player.x + 150, s.player.y, 1, true); e.speed = 0; e.hp = 0; s.killEnemy(e);
  const ent = fx.pool.find(x => x.active), t0 = ent.start, out = { shadow0: !!ent.shadow?.visible, a0: ent.shadow?.alpha };
  fx.update(t0 + 60 + 90); out.mid = { body: ent.img.alpha, shadow: ent.shadow.alpha, rot: ent.img.rotation };
  fx.update(t0 + 60 + 180); out.fallen = ent.img.rotation; fx.update(t0 + 60 + 300 + 5); fx.update(t0 + 60 + 470);
  out.end = { active: ent.active, body: ent.img.visible, shadow: ent.shadow.visible, dust: ent.dust?.visible ?? false };
  return out;
});
ck('阴影随身体一起淡出（同一比例），倾倒到 70°（1.22 弧度），播完全部隐藏', r5.shadow0 && Math.abs(r5.mid.shadow / r5.a0 - r5.mid.body) < .02 && r5.mid.body > 0 && r5.mid.body < 1 && Math.abs(r5.fallen - 1.22) < .02 && !r5.end.active && !r5.end.body && !r5.end.shadow && !r5.end.dust, r5);

// —— 6) 对象池复用 + 同屏 150 个、超过上限回收最老的；尘土封顶 ——
const r6 = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx, out = {}; for (const e of fx.pool) fx.release(e);
  const wave = n => { const list = []; for (let i = 0; i < n; i++) { const e = s.spawnEnemy('infantry', s.player.x + 60 + (i % 15) * 40, s.player.y - 160 + Math.floor(i / 15) * 30, 1, true); if (e) { e.speed = 0; e.hp = 1; list.push(e); } } return list; };
  const killAll = l => { for (const e of l) { e.hp = 0; s.killEnemy(e); } };
  const l1 = wave(150); killAll(l1); out.first = { live: fx.liveCount, pool: fx.poolSize, created: fx.created };
  fx.update(s.combatNow + 60 + 5); const t = s.combatNow; for (const e of fx.pool) if (e.active) fx.update(e.start + 70); out.dust = fx.dustCount;
  for (const e of fx.pool) fx.release(e);                            // 播完
  out.dustAfter = fx.dustCount; const created0 = fx.created, l2 = wave(150); killAll(l2); out.second = { pool: fx.poolSize, createdNew: fx.created - created0 };  // 第二批全部复用
  killAll(wave(150));                                                  // 上一批还没播完：再清 150 个 → 总共 300 个同时，超过 160 上限
  out.over = { pool: fx.poolSize, live: fx.liveCount, played: fx.played };
  return out;
});
ck('对象池：150 个同帧清屏只建 150 个条目，第二批全部复用（新建 0）；超过 160 上限回收最老的、不增长', r6.first.live === 150 && r6.first.pool === 150 && r6.second.createdNew === 0 && r6.over.pool === 160 && r6.over.live === 160, r6);
ck('尘土同屏封顶（电脑 120），播完归还名额', r6.dust > 0 && r6.dust <= 120 && r6.dustAfter === 0, { dust: r6.dust, after: r6.dustAfter });

// —— 6b) 专属尘土素材（即梦出图，tools/prepare-death-dust.mjs 处理）：6 帧、无洋红残留、每帧居中、地面线对齐；缺图时退回 fx_collapse_dust ——
const r6b = await p.evaluate(async base => {
  const img = new Image(); img.src = base + 'assets/fx/death_dust.png'; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, out = { w: img.width, h: img.height, pink: 0, frames: [] };
  for (let f = 0; f < 6; f++) { let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, edge = 0;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const i = (y * W + f * 256 + x) * 4, a = d[i + 3]; if (a > 40 && d[i] > 200 && d[i + 2] > 200 && d[i + 1] < 90) out.pink++; if (a > 10) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); if (x === 0 || x === 255 || y === 0) edge++; } }
    out.frames.push({ cx: (x0 + x1) / 2, bottom: y1, w: x1 - x0 + 1, edge }); }
  const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx; out.key = fx.dustKey; out.has = s.textures.exists('fx_death_dust');
  s.textures.remove('fx_death_dust'); out.fallback = fx.dustKey; return out;
}, base);
ck('专属尘土：1536×256、6 帧，无洋红残留；每帧水平居中（±6px）、底边落在同一条地面线（±4px）、不顶到格子边', r6b.w === 1536 && r6b.h === 256 && r6b.pink === 0 && r6b.frames.every(f => Math.abs(f.cx - 128) <= 6 && Math.abs(f.bottom - r6b.frames[0].bottom) <= 4 && f.edge === 0), r6b);
ck('死亡特效用专属尘土 fx_death_dust；贴图缺失时退回 fx_collapse_dust 兜底', r6b.has && r6b.key === 'fx_death_dust' && r6b.fallback === 'fx_collapse_dust', { key: r6b.key, fallback: r6b.fallback });

// —— 6c) 兵器 / 头巾小图集（即梦出图，tools/prepare-death-props.mjs 处理）：768×512、6 格每格一件物品、居中、无粉色残留、不顶格边 ——
const r6c = await p.evaluate(async base => {
  const img = new Image(); img.src = base + 'assets/fx/death_props.png'; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, out = { w: img.width, h: img.height, pinkEdge: 0, cells: [] };
  for (let f = 0; f < 6; f++) { const ox = (f % 3) * 256, oy = Math.floor(f / 3) * 256; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, n = 0, edge = 0;
    const seen = new Uint8Array(256 * 256); let comps = 0;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const i = ((oy + y) * W + ox + x) * 4, a = d[i + 3]; if (a > 10) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); n++; if (x === 0 || y === 0 || x === 255 || y === 255) edge++; }
      if (a > 200 && d[i] > 190 && d[i + 2] > 110 && d[i + 1] < 80 && d[i + 2] > d[i + 1] + 60) out.pinkEdge++; }
    for (let s0 = 0; s0 < 65536; s0++) { const sx = s0 % 256, sy = (s0 / 256) | 0; if (seen[s0] || d[((oy + sy) * W + ox + sx) * 4 + 3] <= 40) continue; let area = 0; const st = [s0]; seen[s0] = 1; while (st.length) { const k = st.pop(), x = k % 256, y = (k / 256) | 0; area++; for (const nk of [x > 0 ? k - 1 : -1, x < 255 ? k + 1 : -1, y > 0 ? k - 256 : -1, y < 255 ? k + 256 : -1]) if (nk >= 0 && !seen[nk] && d[((oy + ((nk / 256) | 0)) * W + ox + (nk % 256)) * 4 + 3] > 40) { seen[nk] = 1; st.push(nk); } } if (area >= 50) comps++; }
    out.cells.push({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0 + 1, h: y1 - y0 + 1, edge, comps }); }
  const s = window.__game.scene.getScene('GameScene'); out.loaded = s.textures.exists('fx_death_props'); out.frames = s.textures.get('fx_death_props').getFrameNames().filter(n => n !== '__BASE').length;
  return out;
}, base);
ck('兵器 / 头巾图集：768×512、6 格每格恰好一件物品（无水印 / 色带杂块）、居中（±6px）、不顶格边、最长边 ≥ 190px、无粉色残留；游戏里加载成 6 帧', r6c.w === 768 && r6c.h === 512 && r6c.cells.length === 6 && r6c.cells.every(c => c.comps === 1 && c.edge === 0 && Math.abs(c.cx - 128) <= 6 && Math.abs(c.cy - 128) <= 6 && Math.max(c.w, c.h) >= 190) && r6c.pinkEdge === 0 && r6c.loaded && r6c.frames === 6, r6c);

// —— 6d) 敌军棕色战马行走图（即梦出图，tools/prepare-enemy-horse.mjs 处理）：1152×1152、4×4 每格恰好一匹马、无粉色残留、同一行脚底线一致（±6px，原位缩放不逐帧居中）、侧视两行朝向相反 ——
const r6d = await p.evaluate(async base => {
  const img = new Image(); img.src = base + 'assets/horses-v2/enemy_brown_walk.png'; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, cell = W / 4, out = { w: img.width, h: img.height, pink: 0, rows: [] };
  for (let r = 0; r < 4; r++) { const row = []; for (let col = 0; col < 4; col++) { let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, edge = 0, hx = 0, hn = 0;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) { const i = ((r * cell + y) * W + col * cell + x) * 4, a = d[i + 3]; if (a > 10) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); if (x === 0 || y === 0 || x === cell - 1 || y === cell - 1) edge++; }
      if (a > 200 && d[i] > 190 && d[i + 2] > 110 && d[i + 1] < 80 && d[i + 2] > d[i + 1] + 60) out.pink++; }
    // 头在哪边：上半部分不透明像素的重心相对外框中心
    for (let y = y0; y < y0 + (y1 - y0) * .45; y++) for (let x = 0; x < cell; x++) { const i = ((r * cell + y) * W + col * cell + x) * 4; if (d[i + 3] > 200) { hx += x; hn++; } }
    row.push({ bottom: y1, w: x1 - x0 + 1, h: y1 - y0 + 1, edge, headLeft: hn ? hx / hn < (x0 + x1) / 2 : null }); } out.rows.push(row); }
  return out;
}, base);
ck('敌军棕色战马图：1152×1152、4×4 十六格每格一匹马、不顶格边、无粉色残留；同一行脚底线一致（±6px）；左行朝左、右行朝右', r6d.w === 1152 && r6d.h === 1152 && r6d.pink === 0 && r6d.rows.every(row => row.every(f => f.edge === 0 && f.h > 200) && Math.max(...row.map(f => f.bottom)) - Math.min(...row.map(f => f.bottom)) <= 6) && r6d.rows[1].every(f => f.headLeft === true) && r6d.rows[2].every(f => f.headLeft === false), r6d);

// —— 7) 设置界面：战斗内设置有「死亡特效」一行，点一下开 ↔ 关 ——
const r7 = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.pendingLevels = 0; s.militaryPending = 0; if (s.mode !== 'none') s.setMode('none'); s.togglePause(); await new Promise(r => setTimeout(r, 400));
  const val = window.__find(s.pausePanel, 'settings-death-fx'), inc = window.__find(s.pausePanel, 'settings-death-fx-inc'), out = { has: !!val && !!inc, label0: val?.text, ys: s.pausePanel.list.filter(o => o.y !== undefined && o.type !== 'Graphics').map(o => o.y) };
  inc?.emit('pointerdown'); out.label1 = val?.text; out.ls1 = localStorage.getItem('im_death_fx');
  inc?.emit('pointerdown'); out.label2 = val?.text; out.ls2 = localStorage.getItem('im_death_fx');
  out.bottom = Math.max(...out.ys.filter(y => y < 2000)); out.H = (await window.__mod('/src/config.ts')).GAME_HEIGHT; return { ...out, ys: undefined };
});
await p.screenshot({ path: `${out}/settings-battle.png` });
ck('战斗内设置有「死亡特效」：默认开，点一下 → 关（存 im_death_fx=off）→ 再点 → 开', r7.has && r7.label0 === '开' && r7.label1 === '关' && r7.ls1 === 'off' && r7.label2 === '开' && r7.ls2 === 'on', r7);
ck('战斗内设置面板放得下（最底一行在画面内）', r7.bottom <= r7.H, r7);
await p.context().close();

// —— 8) 主页设置（网页电脑版）有同一行，同一个存储键；面板放得下 ——
p = await open('?dev=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive(), null, { timeout: 180000 }); await p.waitForTimeout(800);
const r8 = await p.evaluate(async () => {
  const m = window.__game.scene.getScene('MenuScene'); localStorage.removeItem('im_death_fx'); (await window.__mod('/src/systems/BattleSettings.ts')).resetDeathFxCache(); m.openHomeSettings(); await new Promise(r => setTimeout(r, 300));
  const panel = m.children.getByName('home-settings-panel'), val = window.__find(panel, 'settings-death-fx'), inc = window.__find(panel, 'settings-death-fx-inc') /* 2026-11-18 设置改版 */, out = { has: !!val && !!inc, label0: val?.text };
  inc.emit('pointerdown'); out.label1 = val.text; out.ls1 = localStorage.getItem('im_death_fx'); inc.emit('pointerdown'); out.label2 = val.text; out.ls2 = localStorage.getItem('im_death_fx');
  const ys = []; const walk = o => { if (o.y !== undefined && o.type === 'Text') ys.push(o.y + o.height / 2); for (const c of o.list ?? []) walk(c); }; walk(panel); out.bottom = Math.max(...ys); out.H = (await window.__mod('/src/config.ts')).GAME_HEIGHT; out.close = window.__find(panel, 'settings-close')?.y;
  return out;
});
await p.screenshot({ path: `${out}/settings-home.png` });
ck('主页设置（电脑）有「死亡特效」：默认开，点一下 → 关 → 再点 → 开，和战斗内同一个键', r8.has && r8.label0 === '开' && r8.label1 === '关' && r8.ls1 === 'off' && r8.label2 === '开' && r8.ls2 === 'on', r8);
ck('主页设置面板放得下（返回按钮和最底一行都在画面内）', r8.bottom <= r8.H && r8.close <= r8.H - 8, r8);
await p.context().close();

// —— 9) 手机降级：池更小（80）、尘土封顶 28 且隔一个出 ——
p = await open('?dev=1&autostart=1&stage=1&layout=mobile', { width: 390, height: 844 }); await ready(p);
const r9 = await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx, list = []; for (let i = 0; i < 150; i++) { const e = s.spawnEnemy('infantry', s.player.x + (i % 12) * 26 - 150, s.player.y - 200 + Math.floor(i / 12) * 24, 1, true); if (e) { e.speed = 0; e.hp = 1; list.push(e); } }
  for (const e of list) { e.hp = 0; s.killEnemy(e); }
  for (const e of fx.pool) if (e.active) fx.update(e.start + 70); return { pool: fx.poolSize, dust: fx.dustCount, played: fx.played, lite: fx.lite };
});
ck('手机降级：池上限 80，同屏尘土 ≤ 28', r9.lite && r9.pool === 80 && r9.dust <= 28 && r9.dust > 0, r9);
const r9b = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.pendingLevels = 0; s.militaryPending = 0; if (s.mode !== 'none') s.setMode('none'); s.togglePause(); await new Promise(r => setTimeout(r, 400));
  const find = (o, n) => { if (o.name === n) return o; for (const c of o.list ?? []) { const r = find(c, n); if (r) return r; } return null; }, t = find(s.pausePanel, 'settings-death-fx'), out = { has: !!t, label0: t?.text };
  t?.emit('pointerdown'); out.label1 = t?.text; out.ls1 = localStorage.getItem('im_death_fx'); t?.emit('pointerdown'); out.label2 = t?.text; out.ls2 = localStorage.getItem('im_death_fx');
  const bag = find(s.pausePanel, 'pause-bag'); out.gap = bag ? bag.y - t.y : null; out.h = t?.height; return out;
});
await p.screenshot({ path: `${out}/settings-battle-mobile.png` });
ck('手机版战斗内设置也有「死亡特效」小牌：默认开，点一下 → 关（存 im_death_fx=off）→ 再点 → 开，不压到「行囊」小牌', r9b.has && r9b.label0 === '死亡特效：开' && r9b.label1 === '死亡特效：关' && r9b.ls1 === 'off' && r9b.label2 === '死亡特效：开' && r9b.ls2 === 'on' && r9b.gap >= 32, r9b);
await p.context().close();

ck('控制台无报错', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
