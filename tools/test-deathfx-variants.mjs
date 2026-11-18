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
const GAME = '?dev=1&autostart=1&stage=1&layout=desktop';

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
  const body = fx.pool.find(x => x.active), horse = fx.horses.find(x => x.active), hx = horse.x; fx.update(horse.start + 500);
  out.horseOpp = Math.sign(horse.img.x - hx) === -body.dir && horse.dir === -body.dir; out.horseFar = Math.abs(horse.img.x - hx) > 120; out.horseFrame = horse.img.frame.name;
  fx.update(horse.start + 1700 - 250); out.horseFading = horse.img.alpha > 0 && horse.img.alpha < 1; fx.update(horse.start + 1710); out.horseGone = !horse.active;
  return out;
});
ck('兵器：抛物线甩出（有弧度、旋转、朝倒下方向），落地后停约 0.5 秒再淡出（0.22 秒），之后回到池里', r2.arcUp && r2.rot && r2.dirOk && r2.landed && r2.alphaRest === 1 && r2.alphaStill === 1 && r2.alphaFading < 1 && r2.alphaFading > 0 && r2.gone, r2);
ck('头巾：飘起 40px 左右、中途开始淡出、0.95 秒后消失', r2.turbanUp && r2.turbanA < 1 && r2.turbanGone, r2);
ck('盾牌：先倒地（平躺 1.45 弧度）再扬起一圈小尘土，之后淡出', !r2.dustEarly && r2.dustLate && r2.shieldFlat && r2.shieldGone, r2);
ck('骑兵：马沿「人倒下方向的反方向」跑出去（跑了 120px 以上、换跑步帧）、1.7 秒内淡出消失', r2.horseOpp && r2.horseFar && /^(left|right)_\d$/.test(r2.horseFrame) && r2.horseFading && r2.horseGone, r2);

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
