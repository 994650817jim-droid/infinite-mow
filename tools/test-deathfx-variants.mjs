// 死亡特效 B 之上的三项变化（2026-11-18）：兵器脱手、按兵种变化（骑兵放马 / 盾兵落地扬尘 / 弓兵掉弓 / 黄巾头巾）、重击击飞。电脑布局 1280×720 + 手机降级。
// 兵器 / 头巾小图用测试里现画的替身图集（只验逻辑，不进游戏）。需要开发服务器（默认 5260）。用法：node tools/test-deathfx-variants.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5260/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const open = async (q, vp = { width: 1280, height: 720 }) => {
  const ctx = await b.newContext({ viewport: vp }), p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
  await p.addInitScript(() => {
    window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
    if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); }
  });
  await p.goto(base + q, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.player.xpNext = 1e9; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); } });
  // 替身小图集（3×2，每格 256；只在测试页面里有）：用来验证逻辑，真图到位后游戏自己加载
  await p.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene'); if (s.textures.exists('fx_death_props')) return;
    const c = document.createElement('canvas'); c.width = 768; c.height = 512; const g = c.getContext('2d'); const col = ['#aaa', '#8a6', '#a86', '#964', '#654', '#fc3'];
    col.forEach((k, i) => { g.fillStyle = k; g.fillRect((i % 3) * 256 + 80, Math.floor(i / 3) * 256 + 100, 96, 56); });
    const t = s.textures.addCanvas('fx_death_props', c); for (let i = 0; i < 6; i++) t.add(i, 0, (i % 3) * 256, Math.floor(i / 3) * 256, 256, 256);
  });
  return p;
};
const GAME = '?dev=1&autostart=1&stage=1&layout=desktop&deathprops=1'; // 兵器脱手默认关（2026-11-18），这里打开测它的逻辑

let p = await open(GAME);
// 马匹行走图按需载入：场上出现骑兵时触发（这里直接出一个骑兵再杀掉），等它载完
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), e = s.spawnEnemy('cavalry', s.player.x + 300, s.player.y, 1, true); e.hp = 0; e.deactivate(); });
await p.waitForFunction(() => window.__game.scene.getScene('GameScene').deathFx.hasHorse, null, { timeout: 30000 }).catch(() => {});
const has = await p.evaluate(() => { const fx = window.__game.scene.getScene('GameScene').deathFx; return { props: fx.hasProps, horse: fx.hasHorse, tex: window.__game.textures.exists('horse_v2_generic_walk') }; });
ck('前提：替身图集在、马匹行走图已加载（骑兵放马要用）', has.props && has.horse, has);

// —— 1) 每个兵种的变化（第一章：黄巾头巾）——
const r1 = await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx, out = {};
  const kill = kind => { for (const e of fx.pool) fx.release(e); for (const x of fx.props) { x.active = false; x.img.setVisible(false); } for (const h of fx.horses) { h.active = false; h.img.setVisible(false); }
    s.debugCrit = false; const e = s.spawnEnemy(kind, s.player.x + 140, s.player.y, 1, true); e.speed = 0; e.hp = 0; e.lastHitHeavy = false; e.lastHitFromAlly = false; s.killEnemy(e);
    return { kinds: fx.props.filter(x => x.active).map(x => x.kind).sort(), horses: fx.horseCount, crop: !!fx.pool.find(x => x.active)?.crop, chapter: s.chapter.id }; };
  for (const k of ['infantry', 'archer', 'shield', 'cavalry', 'elite']) out[k] = kill(k);
  return out;
});
ck('步兵：刀 + 黄巾头巾；弓兵：弓 + 头巾；盾兵：藤牌或重盾 + 头巾；骑兵：放出一匹马、人只留上半身、没有手持兵器；校尉：刀、没有头巾',
  JSON.stringify(r1.infantry.kinds) === '["blade","turban"]' && JSON.stringify(r1.archer.kinds) === '["bow","turban"]' && r1.shield.kinds.length === 2 && r1.shield.kinds.includes('turban') && r1.shield.kinds.some(k => k === 'rattan' || k === 'tower')
  && r1.cavalry.horses === 1 && r1.cavalry.crop && !r1.cavalry.kinds.includes('blade') && JSON.stringify(r1.elite.kinds) === '["blade"]' && r1.infantry.chapter === 'huangjin', r1);

// —— 2a) 专属「惊跳 + 飞奔」图（2026-11-18 用户：「马兵被消灭的时候马走的特效还是没做好」）：4 帧扬蹄 → 加速起跑 → 8 帧飞奔按距离换帧（右向翻转）→ 淡出 ——
await p.evaluate(async () => { const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx; fx.warmHorse(); for (let i = 0; i < 150 && !fx.gallopReady; i++) await new Promise(r => setTimeout(r, 100)); });
const runGallop = async diag => p.evaluate(async diag => {
  const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx, out = {}; for (const h of fx.horses) { h.active = false; h.img.setVisible(false); h.shadow.setVisible(false); }
  out.ready = fx.gallopReady; const cv = s.spawnEnemy('cavalry', s.player.x + 200, s.player.y, 1, true); cv.speed = 0; cv.hp = 0; cv.lastHitHeavy = false; cv.lastHitFromAlly = false; const liveW = Math.abs(cv.displayWidth ?? cv.sprite?.displayWidth ?? 0); s.killEnemy(cv);
  const body = fx.pool.find(x => x.active), h = fx.horses.find(x => x.active), x0 = h.x, T0 = h.start, D = (await window.__mod('/src/systems/DeathFx.ts')).DEATH_FX; if (diag) h.vy = diag;
  out.dir = h.dir; out.gallop = h.gallop; out.texture = h.img.texture.key; out.tinted = h.img.isTinted; out.opp = h.dir === -body.dir; out.flip = h.img.flipX === (h.dir > 0); out.sizeRatio = h.img.displayWidth / (Math.abs(body.img.displayWidth) || 1);
  // 扬蹄 4 帧，x 不动
  const rear = []; let rearX = 0; for (let t = 0; t < D.horseRearMs; t += 10) { fx.update(T0 + t); const n = h.img.frame.name; if (rear[rear.length - 1] !== n) rear.push(n); rearX = Math.max(rearX, Math.abs(h.img.x - x0)); } out.rear = rear; out.rearX = rearX;
  // 飞奔：每 10ms 采样
  const frames = [], xs = [], changes = [], tilt = []; let last = null;
  for (let t = D.horseRearMs + 10; t <= 1800; t += 10) { fx.update(T0 + t); const n = h.img.frame.name; xs.push(h.img.x - x0); tilt.push(h.img.rotation); if (n !== last) { frames.push(n); changes.push(t); last = n; } }
  out.seq = frames.slice(0, 20); out.sameDir = xs.every((v, i) => i === 0 || (h.dir > 0 ? v >= xs[i - 1] - 1e-6 : v <= xs[i - 1] + 1e-6)); out.dist = Math.abs(xs[xs.length - 1]);
  const idx = frames.map(n => +n.split('_')[1]); out.order = frames.every(n => n.startsWith('gallop_')) && idx.every((v, i) => i === 0 || v === (idx[i - 1] + 1) % 8) ; out.distinct = new Set(frames).size;
  const late = changes.map((v, i) => [v, i]).filter(([v]) => v >= 900).map(([v]) => v), gaps = late.slice(1).map((v, i) => v - late[i]); out.gapMin = Math.min(...gaps); out.gapMax = Math.max(...gaps);
  const early = changes.filter(v => v < D.horseRearMs + 250), eg = early.slice(1).map((v, i) => v - early[i]); out.earlyGap = eg.length ? Math.min(...eg) : 999;   // 起跑时腿比全速慢
  out.tilt = tilt[tilt.length - 1]; out.shadow = { dx: Math.abs(h.shadow.x - h.img.x), dy: h.shadow.y - (h.y + 1 + h.vy * (1800 - D.horseRearMs) / 1000) };
  fx.update(T0 + D.horseGallopMs - 250); out.fading = h.img.alpha < 1 && h.img.alpha > 0 && h.shadow.alpha < .5 && h.shadow.alpha > 0; fx.update(T0 + D.horseGallopMs + 10); out.gone = !h.active && !h.img.visible && !h.shadow.visible;
  return out; }, diag);
const g1 = await runGallop(0), g2 = await runGallop(90);
ck('马（专属惊跳 + 飞奔图）：先 4 帧扬蹄（原地不动）→ 起跑后只用飞奔帧、按顺序 0…7 循环、8 个帧都出现；方向与人倒下相反、朝右时翻转；起跑时换帧比全速慢，全速后每 60–100ms 一帧；淡出时阴影同淡、播完全隐藏',
  g1.ready && g1.gallop && g1.texture === 'horse_v2_enemy_brown_gallop' && !g1.tinted && g1.opp && g1.flip && JSON.stringify(g1.rear) === '["rear_0","rear_1","rear_2","rear_3"]' && g1.rearX < .01 && g1.sameDir && g1.dist > 250 && g1.order && g1.distinct === 8
  && g1.gapMin >= 60 && g1.gapMax <= 100 && g1.earlyGap > g1.gapMin && g1.shadow.dx < .01 && Math.abs(g1.shadow.dy) < .01 && g1.fading && g1.gone, g1);
ck('马：大小按倒下的骑兵图算（马宽 ≈ 骑兵图宽 × 0.8，之后骑兵缩放马跟着缩）；斜着跑时按速度方向微倾（上下速度不改左右帧）', g1.sizeRatio > .74 && g1.sizeRatio < .86 && Math.abs(g2.tilt) > .02 && Math.abs(g2.tilt) < .2 && Math.sign(g2.tilt) === g2.dir && g2.order && g2.gone, { g1: g1.sizeRatio, g2: g2.tilt, order: g2.order, seq: g2.seq, gone: g2.gone });
// 后面「通用 / 棕色行走图」的老动画测试：把飞奔图拿掉，走行走图路径
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.textures.remove('horse_v2_enemy_brown_gallop'); });

// —— 2) 兵器抛物线、落地停约 0.5 秒再淡出；头巾飘起淡出；盾牌落地扬尘；马反方向跑出去淡出 ——
const r2 = await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx, out = {}; for (const x of fx.props) { x.active = false; x.img.setVisible(false); }
  const e = s.spawnEnemy('infantry', s.player.x + 140, s.player.y, 1, true); e.speed = 0; e.hp = 5; s.hitEnemy(e, 9999, s.combatNow, 'melee');
  const blade = fx.props.find(x => x.active && x.kind === 'blade'), turban = fx.props.find(x => x.active && x.kind === 'turban'), t0 = blade.start, y0 = blade.y, x0 = blade.x;
  fx.update(t0 + 150); out.midY = blade.img.y; out.arcUp = blade.img.y < (y0 + blade.gy) / 2 - 12; /* 比「起点到地面的直线中点」高出弧度 */ out.rot = Math.abs(blade.img.rotation) > 0.5; out.dirOk = Math.sign(blade.img.x - x0) === blade.dir;
  fx.update(t0 + 300 + 100); out.landed = Math.abs(blade.img.y - blade.gy) < 1; out.alphaRest = blade.img.alpha; fx.update(t0 + 300 + 480); out.alphaStill = blade.img.alpha;
  fx.update(t0 + 300 + 500 + 110); out.alphaFading = blade.img.alpha; fx.update(t0 + 300 + 500 + 230); out.gone = !blade.active;
  const tb0 = turban.start; fx.update(tb0 + 400); out.turbanUp = turban.img.y < turban.y - 10; out.turbanA = turban.img.alpha; fx.update(tb0 + 960); out.turbanGone = !turban.active;
  // 盾牌
  for (const x of fx.props) { x.active = false; x.img.setVisible(false); } s.debugCrit = false;
  const sh = s.spawnEnemy('shield', s.player.x + 140, s.player.y, 1, true); sh.speed = 0; sh.hp = 0; s.killEnemy(sh);
  const shield = fx.props.find(x => x.active && (x.kind === 'rattan' || x.kind === 'tower')); fx.update(shield.start + 100); out.dustEarly = !!shield.dust?.visible; fx.update(shield.start + 200 + 120); out.dustLate = !!shield.dust?.visible; out.shieldFlat = Math.abs(Math.abs(shield.img.rotation) - 1.45) < .05;
  fx.update(shield.start + 200 + 500 + 230); out.shieldGone = !shield.active && !shield.dust?.visible;
  // 马
  for (const h of fx.horses) { h.active = false; h.img.setVisible(false); }
  const cv = s.spawnEnemy('cavalry', s.player.x + 140, s.player.y, 1, true); cv.speed = 0; cv.hp = 0; s.killEnemy(cv);
  const body = fx.pool.find(x => x.active), horse = fx.horses.find(x => x.active), hx = horse.x; fx.update(horse.start + 1000);
  out.horseKey = fx.horseKey; out.horseTex = horse.img.texture.key; out.tinted = horse.img.isTinted; out.horseOpp = Math.sign(horse.img.x - hx) === -body.dir && horse.dir === -body.dir; out.horseFar = Math.abs(horse.img.x - hx) > 120; out.horseFrame = horse.img.frame.name;
  fx.update(horse.start + 1700 - 250); out.horseFading = horse.img.alpha > 0 && horse.img.alpha < 1; fx.update(horse.start + 1710); out.horseGone = !horse.active;
  return out;
});
ck('兵器：抛物线甩出（有弧度、旋转、朝倒下方向），落地后停约 0.5 秒再淡出（0.22 秒），之后回到池里', r2.arcUp && r2.rot && r2.dirOk && r2.landed && r2.alphaRest === 1 && r2.alphaStill === 1 && r2.alphaFading < 1 && r2.alphaFading > 0 && r2.gone, r2);
ck('头巾：飘起 40px 左右、中途开始淡出、0.95 秒后消失', r2.turbanUp && r2.turbanA < 1 && r2.turbanGone, r2);
ck('盾牌：先倒地（平躺 1.45 弧度）再扬起一圈小尘土，之后淡出', !r2.dustEarly && r2.dustLate && r2.shieldFlat && r2.shieldGone, r2);
ck('骑兵：用专属暗橄榄褐战马图（不乘色），沿「人倒下方向的反方向」跑出去（跑了 120px 以上、换跑步帧）、1.7 秒内淡出消失', r2.horseKey === 'horse_v2_enemy_brown_walk' && r2.horseTex === 'horse_v2_enemy_brown_walk' && !r2.tinted && r2.horseOpp && r2.horseFar && /^(left|right)_\d$/.test(r2.horseFrame) && r2.horseFading && r2.horseGone, r2);

// —— 2b) 马的奔跑动画（2026-11-18 用户：「马跑走是平移」）：先受惊（原地扬头小跳）→ 加速起跑 → 腿按距离换帧 → 上下起伏 + 自己的阴影 → 淡出 ——
const horseRun = async key => p.evaluate(async key => {
  const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx, out = { key }; for (const h of fx.horses) { h.active = false; h.img.setVisible(false); h.shadow.setVisible(false); }
  const cv = s.spawnEnemy('cavalry', s.player.x + 200, s.player.y, 1, true); cv.speed = 0; cv.hp = 0; cv.lastHitHeavy = false; cv.lastHitFromAlly = false; s.killEnemy(cv);
  const body = fx.pool.find(x => x.active), h = fx.horses.find(x => x.active), x0 = h.x, y0 = h.y, T0 = h.start; out.texture = h.img.texture.key; out.tinted = h.img.isTinted; out.shadowVisible = h.shadow.visible;
  // 受惊：0–240ms 原地（x 不动）、第 0 帧、扬头旋转 ≥ 0.2 弧度
  fx.update(T0 + 100); out.startle = { x: h.img.x - x0, frame: h.img.frame.name, rot: Math.abs(h.img.rotation), hop: h.img.y - y0 };
  // 加速：每 10ms 采样，记录位置、帧名、朝向；全速（≥ 700ms）后统计换帧间隔
  const xs = [], frames = [], bobs = [], shadowYs = []; let last = null, changes = [];
  for (let t = 250; t <= 1500; t += 10) { fx.update(T0 + t); xs.push(h.img.x - x0); const fr = h.img.frame.name; frames.push(fr); if (t >= 700) { bobs.push(h.img.y - h.shadow.y); shadowYs.push(h.shadow.y - (h.y + 1 + h.vy * Math.max(0, t - 240) / 1000)); if (fr !== last) { changes.push(t); last = fr; } } }
  out.mono = xs.every((v, i) => i === 0 || (h.dir > 0 ? v >= xs[i - 1] - 1e-6 : v <= xs[i - 1] + 1e-6)); out.dist = Math.abs(xs[xs.length - 1]); out.distinct = new Set(frames).size;
  const gaps = changes.slice(1).map((v, i) => v - changes[i]); out.gapMin = Math.min(...gaps); out.gapMax = Math.max(...gaps); out.bobRange = Math.max(...bobs) - Math.min(...bobs); out.shadowRange = Math.max(...shadowYs) - Math.min(...shadowYs);
  out.dirOk = Math.sign(xs[xs.length - 1]) === h.dir && h.dir === -body.dir; out.faceOk = frames.every(n => n.startsWith(h.dir < 0 ? 'left_' : 'right_'));
  // 慢速段（起跑时）换帧比全速慢：250–400ms 内最多换 1–2 次，全速后每 ~80ms 一次
  const early = frames.slice(0, 15), earlyChanges = early.filter((v, i) => i && v !== early[i - 1]).length; out.earlyChanges = earlyChanges;
  fx.update(T0 + 1700 - 250); out.fading = h.img.alpha < 1 && h.shadow.alpha < .5 && h.shadow.alpha > 0; fx.update(T0 + 1710); out.gone = !h.active && !h.img.visible && !h.shadow.visible;
  return out; }, key);
const rb = await horseRun('brown');
ck('马的奔跑（专属棕马）：先受惊原地扬头（x 不动、第 0 帧、旋转 ≥ 0.2）；之后只往一个方向加速跑、朝向与移动方向一致、腿换满 4 个帧；全速后每 70–95ms 换一帧；上下起伏 ≥ 2px、阴影贴地不起伏；淡出时阴影同淡、播完全隐藏',
  rb.texture === 'horse_v2_enemy_brown_walk' && !rb.tinted && rb.shadowVisible && Math.abs(rb.startle.x) < .01 && rb.startle.frame.endsWith('_0') && rb.startle.rot >= .2 && rb.mono && rb.dirOk && rb.faceOk && rb.distinct === 4 && rb.gapMin >= 70 && rb.gapMax <= 95 && rb.bobRange >= 2 && rb.shadowRange < .01 && rb.earlyChanges <= 3 && rb.fading && rb.gone, rb);
// 通用马兜底：把专属图拿掉、临时载入通用白马图，同一套动画
const rg = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), m = await window.__mod('/src/systems/ArtStyle.ts'), key = 'horse_v2_generic_walk';
  if (!s.textures.exists(key)) await new Promise(r => { s.load.image(key, m.ART_V2_FILES[key]); s.load.once('filecomplete-image-' + key, () => { m.regridV2(s, key); r(); }); s.load.start(); });
  s.textures.remove('horse_v2_enemy_brown_walk'); return { key: s.deathFx.horseKey, has: s.textures.get(key).has('left_3') };
});
const rg2 = await horseRun('generic');
ck('马的奔跑（通用白马兜底，乘色）：专属图缺失时同一套动画照常（换满 4 帧、朝向与方向一致、起伏 + 阴影）', rg.key === 'horse_v2_generic_walk' && rg.has && rg2.texture === 'horse_v2_generic_walk' && rg2.tinted && rg2.mono && rg2.dirOk && rg2.faceOk && rg2.distinct === 4 && rg2.gapMin >= 70 && rg2.gapMax <= 95 && rg2.bobRange >= 2 && rg2.shadowRange < .01 && rg2.gone, { ...rg, ...rg2 });

// —— 3) 重击击飞：暴击 / 马超冲锋 / 张飞大喝 → 击飞 40–70px，落地处扬尘；普通击杀不击飞 ——
const r3 = await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx, out = {}, one = (setup) => {
    for (const e of fx.pool) fx.release(e); s.debugCrit = false; s.player.weapons[0].id = 'spear_orbit'; s.player.passive.chargeInvulnUntil = 0; setup?.();
    const e = s.spawnEnemy('infantry', s.player.x + 160, s.player.y, 1, true); e.speed = 0; e.hp = 5; const x0 = e.sprite.x, y0 = e.sprite.y; s.hitEnemy(e, 9999, s.combatNow, 'melee'); const en = fx.pool.find(x => x.active); return { en, x0, y0, dir: en.dir }; };
  const norm = one(); out.normal = norm.en.heavy;
  const crit = one(() => { s.debugCrit = true; }); out.crit = crit.en.heavy;
  const t0 = crit.en.start; fx.update(t0 + 60 + 130); out.midLift = crit.en.y - crit.en.img.y;          // 飞到一半：抬高
  fx.update(t0 + 60 + 260); out.dist = (crit.en.img.x - crit.en.x) * crit.dir; out.landY = Math.abs(crit.en.img.y - crit.en.y) < 2; out.shadowMoved = Math.abs(crit.en.shadow.x - crit.en.shX) > 30;
  fx.update(t0 + 60 + 270); out.dustOn = !!crit.en.dust?.visible; out.dustAtLand = Math.abs((crit.en.dust?.x ?? 0) - crit.en.img.x) < 3;
  const roar = one(() => { s.player.weapons[0].id = 'dangyang_roar'; }); out.roar = roar.en.heavy;
  const charge = one(() => { s.player.passive.chargeInvulnUntil = s.combatNow + 5000; s.player.passive.stopped = false; }); out.charge = charge.en.heavy;
  const ally = one(); s.player.weapons[0].id = 'spear_orbit'; { const e = s.spawnEnemy('infantry', s.player.x + 160, s.player.y, 1, true); e.hp = 5; s.debugCrit = true; s.hitEnemy(e, 9999, s.combatNow, 'melee', true); out.allyHeavy = fx.pool.filter(x => x.active).some(x => x.heavy && x.start === s.combatNow && x !== ally.en); }
  return out;
});
ck('重击判定：暴击 / 张飞大喝 / 马超冲锋中击杀 → 击飞；普通击杀、部曲的暴击不击飞', !r3.normal && r3.crit && r3.roar && r3.charge && !r3.allyHeavy, r3);
ck('击飞：飞到一半抬高 25px 以上，落地位移 40–70px（加后退一步 9px）朝倒下方向，落地回到地面线，阴影跟着移走，落地处扬尘', r3.midLift > 25 && r3.dist >= 40 + 9 - 1 && r3.dist <= 70 + 9 + 1 && r3.landY && r3.shadowMoved && r3.dustOn && r3.dustAtLand, r3);

// —— 4) 对象池上限：兵器 / 头巾同屏 ≤ 40，马 ≤ 14，满了回收最老的 ——
const r4 = await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx, out = {}; for (const e of fx.pool) fx.release(e); for (const x of fx.props) { x.active = false; x.img.setVisible(false); } for (const h of fx.horses) { h.active = false; h.img.setVisible(false); }
  s.debugCrit = false; const wave = (kind, n) => { for (let i = 0; i < n; i++) { const e = s.spawnEnemy(kind, s.player.x + 60 + (i % 15) * 40, s.player.y - 160 + Math.floor(i / 15) * 30, 1, true); if (e) { e.speed = 0; e.hp = 0; s.killEnemy(e); } } };
  wave('infantry', 60); out.props = { live: fx.propCount, pool: fx.props.length };       // 60 个步兵 = 120 次生成，只能有 40 件
  wave('cavalry', 30); out.horses = { live: fx.horseCount, pool: fx.horses.length };
  return out;
});
ck('对象池上限：兵器 + 头巾同屏最多 40 件（超出回收最老的），马最多 14 匹', r4.props.live === 40 && r4.props.pool === 40 && r4.horses.live <= 14 && r4.horses.pool === 14, r4);

// —— 5) 开关 / 缺图 ——
const r5 = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx, bs = await window.__mod('/src/systems/BattleSettings.ts'), out = {}; for (const e of fx.pool) fx.release(e); for (const x of fx.props) { x.active = false; x.img.setVisible(false); } for (const h of fx.horses) { h.active = false; h.img.setVisible(false); }
  const kill = kind => { const e = s.spawnEnemy(kind, s.player.x + 140, s.player.y, 1, true); e.speed = 0; e.hp = 0; e.lastHitHeavy = true; s.killEnemy(e); };
  bs.setDeathFx('off'); kill('infantry'); kill('cavalry'); out.off = { props: fx.propCount, horses: fx.horseCount, bodies: fx.liveCount };
  bs.setDeathFx('on'); for (const e of fx.pool) fx.release(e); s.textures.remove('fx_death_props'); kill('infantry'); out.noArt = { props: fx.propCount, bodies: fx.liveCount, heavy: fx.pool.find(x => x.active)?.heavy, hasProps: fx.hasProps };
  return out;
});
ck('设置「死亡特效：关」：兵器 / 头巾 / 马 / 击飞全部不出现；兵器小图缺失时只是不显示兵器 / 头巾，身体照常（含击飞）', r5.off.props === 0 && r5.off.horses === 0 && r5.off.bodies === 0 && r5.noArt.props === 0 && r5.noArt.bodies === 1 && r5.noArt.heavy === true && !r5.noArt.hasProps, r5);

// —— 6) 非第一章：没有黄巾头巾 ——
const r6 = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); const real = s.chapter; s.chapter = { ...real, id: 'hulao' }; const e = s.spawnEnemy('infantry', s.player.x, s.player.y, 1, true); const o = s.deathOptsOf(e); s.chapter = real; e.hp = 0; e.deactivate(); return o; });
ck('不是第一章：没有头巾，步兵仍掉刀', r6.turban === false && r6.weapon === 'blade', r6);
await p.context().close();

// —— 7) 手机降级：关掉兵器、头巾、马、击飞，只保留 B ——
p = await open('?dev=1&autostart=1&stage=1&layout=mobile', { width: 390, height: 844 });
const r7 = await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), fx = s.deathFx; s.debugCrit = true; const out = { lite: fx.lite, hasProps: fx.hasProps, hasHorse: fx.hasHorse };
  for (const kind of ['infantry', 'shield', 'cavalry']) { const e = s.spawnEnemy(kind, s.player.x + 100, s.player.y, 1, true); e.speed = 0; e.hp = 0; e.lastHitHeavy = true; s.killEnemy(e); }
  out.played = fx.played; out.props = fx.propCount; out.horses = fx.horseCount; out.heavy = fx.pool.some(x => x.active && x.heavy); out.crop = fx.pool.some(x => x.active && x.crop); return out;
});
ck('手机降级：身体特效 B 照播，兵器 / 头巾 / 马 / 击飞都关', r7.lite && !r7.hasProps && !r7.hasHorse && r7.played === 3 && r7.props === 0 && r7.horses === 0 && !r7.heavy && !r7.crop, r7);
await p.context().close();

ck('控制台无报错', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
