// 项目内可移植回归测试：
//   cd infinite-mow && npm run test:regression
// 首次需 `npm i -D playwright`；使用系统 Chrome（channel=chrome），不下载浏览器。
// 测试覆盖：Boss 超时规则、Boss 预留名额、对象池硬上限、实例 ID 去重、枪刃命中、模式互斥、生产无调试入口。
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://127.0.0.1:5173/';
const results = [];
const servers = [];
const cleanup = () => { for (const s of servers) { try { s.kill(); } catch { /* ignore */ } } };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('uncaughtException', (err) => { console.error(err); cleanup(); process.exit(1); });

function startServer(args, cwd = projectRoot) {
  const child = spawn(process.execPath, [join(projectRoot, 'node_modules/vite/bin/vite.js'), ...args], {
    cwd,
    stdio: 'ignore',
  });
  servers.push(child);
  return child;
}

async function waitFor(url, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// 先尝试复用已运行的 dev server，没有就自己启动
if (!(await waitFor(BASE, 2))) {
  startServer(['dev', '--port', '5173', '--strictPort']);
  if (!(await waitFor(BASE))) throw new Error('dev server 未能启动');
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const suiteDeadline = setTimeout(() => {
  console.error('REGRESSION TIMEOUT: 240s'); cleanup();
  void browser.close().finally(() => process.exit(2));
}, 240000);

async function newPage() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(BASE + '?autostart=1&r=' + Date.now(), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  // 默认清空武器，避免七探盘龙枪自动击杀影响敌人行为测试；需要的测试会自行 giveWeapon
  await page.evaluate(() => window.__IM.clearWeapons());
  return { context, page };
}

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} :: ${JSON.stringify(detail)}`);
}

// 1) Boss 规则：5:00 出场；6:00 时 Boss 未死 = 超时失败
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.setTime(350); });
  await page.waitForTimeout(800);
  // 第 6 波开始会先弹招募；测试里直接选第一项继续
  await page.evaluate(() => { if (window.__IM.recruitInfo().mode === 'recruit') window.__IM.chooseRecruit(0); });
  await page.waitForTimeout(400);
  const bossActive = await page.evaluate(() => window.__IM.bossActive);
  const modeBefore = await page.evaluate(() => window.__IM.mode);
  await page.evaluate(() => window.__IM.setTime(500));
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => ({ mode: window.__IM.mode, result: window.__IM.lastResult, boss: window.__IM.bossActive }));
  check('boss_endless_after_wave6', bossActive && modeBefore !== 'result' && after.mode !== 'result' && after.result == null && after.boss === true, { bossActive, modeBefore, after });
  await context.close();
}

// 2) Boss 预留名额：关键单位刷满后，Boss 仍能生成
{
  const { context, page } = await newPage();
  await page.evaluate(() => {
    window.__IM.god();
    for (let i = 0; i < 260; i += 1) window.__IM.spawnAt('elite', 999, 999);
  });
  await page.waitForTimeout(700);
  const filled = await page.evaluate(() => window.__IM.enemies);
  await page.evaluate(() => window.__IM.spawnBoss());
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ count: window.__IM.enemies, boss: window.__IM.bossActive }));
  check('boss_reserved_slot', filled <= 179 && after.boss === true && after.count <= 181, { filled, after });
  await context.close();
}

// 3) 实例 ID：敌人池复用后 spawnId 必须变化
{
  const { context, page } = await newPage();
  const first = await page.evaluate(() => {
    const p = window.__IM.snapshot().player;
    window.__IM.spawnAt('infantry', p.x + 200, p.y);
    return window.__IM.enemiesInfo()[0]?.spawnId;
  });
  await page.evaluate(() => window.__IM.killAllEnemies());
  await page.waitForTimeout(200);
  const second = await page.evaluate(() => {
    const p = window.__IM.snapshot().player;
    window.__IM.spawnAt('infantry', p.x + 200, p.y);
    return window.__IM.enemiesInfo()[0]?.spawnId;
  });
  check('spawn_id_unique', typeof first === 'number' && typeof second === 'number' && second > first, { first, second });
  await context.close();
}

// 4) 七探盘龙枪真实命中
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.giveWeapon('spear_orbit'); });
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => {
    const p = window.__IM.snapshot().player;
    for (let i = 0; i < 4; i += 1) {
      const a = (Math.PI / 2) * i;
      window.__IM.spawnAt('infantry', p.x + Math.cos(a) * 72, p.y + Math.sin(a) * 72);
    }
    const near = window.__IM.enemiesInfo().filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 120);
    return { count: near.length, hpSum: near.reduce((sum, e) => sum + e.hp, 0) };
  });
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => {
    const p = window.__IM.snapshot().player;
    const near = window.__IM.enemiesInfo().filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 120);
    return { count: near.length, hpSum: near.reduce((sum, e) => sum + e.hp, 0) };
  });
  check('spear_target_selection', before.count > 0 && (after.count < before.count || after.hpSum < before.hpSum), { before, after });
  await context.close();
}

// 5) 模式互斥：升级面板与结算面板不会同时显示
{
  const { context, page } = await newPage();
  await page.evaluate(() => window.__IM.addLevel());
  await page.waitForTimeout(400);
  const level = await page.evaluate(() => ({ mode: window.__IM.mode, levelVisible: window.__game.scene.getScene('GameScene').levelPanel.visible }));
  await page.evaluate(() => window.__IM.finish(true));
  await page.waitForTimeout(400);
  const result = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene');
    return { mode: window.__IM.mode, levelVisible: s.levelPanel.visible, pauseVisible: s.pausePanel.visible, resultVisible: s.resultPanel.visible };
  });
  check('mode_exclusive', level.mode === 'levelup' && level.levelVisible && result.mode === 'result' && !result.levelVisible && !result.pauseVisible && result.resultVisible, { level, result });
  await context.close();
}

// 6) 弹射链不重复命中同一敌人
{
  const { context, page } = await newPage();
  await page.evaluate(() => {
    window.__IM.god();
    window.__IM.clearWeapons();
    window.__IM.giveWeapon('crossbow');
    window.__IM.killAllEnemies();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const p = window.__IM.snapshot().player;
    window.__IM.spawnAt('infantry', p.x + 90, p.y);
    window.__IM.spawnAt('infantry', p.x + 150, p.y);
    window.__IM.spawnAt('infantry', p.x + 210, p.y);
  });
  await page.waitForTimeout(5000);
  const chains = await page.evaluate(() => window.__IM.bounceChains());
  const ok = chains.length > 0 && chains.every((c) => new Set(c).size === c.length);
  check('bounce_chain_unique', ok, { chains });
  await context.close();
}


// 8) Boss 法球：紫金法球按时出现
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.killAllEnemies(); window.__IM.spawnBoss(); });
  await page.waitForTimeout(500);
  const data = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    s.bossOrbCd = 0;
    const t0 = performance.now();
    let orbAt = 0;
    const tick = () => {
      const orb = s.bullets.find((b) => b.active && b.img.texture.key === 'orb');
      if (orb && !orbAt) orbAt = performance.now() - t0;
      if (orbAt) resolve({ orbAt });
      else if (performance.now() - t0 > 2000) resolve({ orbAt: -1 });
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  check('boss_orbs_spawn', data.orbAt >= 0, data);
  await context.close();
}

// 9) Boss 能量满后：蓄力→落雷预警→释放→恢复
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.killAllEnemies(); window.__IM.spawnBoss(); });
  await page.waitForTimeout(500);
  const data = await page.evaluate(() => new Promise((resolve) => {
    window.__IM.setBossEnergy(100);
    const phases = new Set();
    const t0 = performance.now();
    const tick = () => {
      const info = window.__IM.bossInfo();
      phases.add(info.ultPhase);
      if (phases.has('recover') || performance.now() - t0 > 5000) {
        resolve({ phases: [...phases], round: window.__IM.bossInfo().round, energy: window.__IM.bossInfo().energy, hpPct: window.__IM.bossInfo().hpPct });
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  const ok = data.phases.includes('charge') && data.phases.includes('warn') && data.phases.includes('strike') && data.phases.includes('recover') && data.round >= 3;
  check('boss_ultimate_phases', ok, data);
  await context.close();
}

// 10) 三位武将行走表切换：使用各自 sheet、四方向可用、正式表不染色
{
  const chars = [
    { id: 'zhaoyun', sheet: 'hero_walk_sheet' },
    { id: 'guanyu', sheet: 'guanyu_walk_sheet' },
    { id: 'huangzhong', sheet: 'huangzhong_walk_sheet' },
  ];
  const detail = [];
  for (const c of chars) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '?r=' + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(700);
    await page.evaluate((cfg) => {
      window.__game.registry.set('runConfig', cfg);
      window.__game.scene.getScene('MenuScene').scene.start('GameScene');
    }, { character: c.id, weapon: 'spear_orbit' });
    await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
    await page.waitForTimeout(800);
    const dirs = new Set();
    for (const [x, y] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
      await page.evaluate(([mx, my]) => window.__IM.setMove(mx, my), [x, y]);
      for (let i = 0; i < 8; i += 1) {
        await page.waitForTimeout(80);
        const snap = await page.evaluate(() => window.__IM.snapshot());
        dirs.add(snap.direction);
      }
    }
    await page.evaluate(() => window.__IM.clearMove());
    const state = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene');
      return { walkSheet: s.player.walkSheet, tint: s.player.sprite.tintTopLeft };
    });
    detail.push({ character: c.id, sheet: state.walkSheet, tint: state.tint, dirs: [...dirs] });
    await ctx.close();
    const ok = state.walkSheet === c.sheet && dirs.size === 4 && (c.id === 'zhaoyun' || state.tint === 0xffffff);
    check('character_walk_' + c.id, ok, { character: c.id, sheet: state.walkSheet, tint: state.tint, dirs: [...dirs] });
  }
}

// 11) 黄巾步兵四方向行走 + 对象池复用重置
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.killAllEnemies(); });
  await page.waitForTimeout(400);
  const dirs = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    const p = s.player;
    window.__IM.spawnAt('infantry', p.x - 160, p.y);
    window.__IM.spawnAt('infantry', p.x + 160, p.y);
    window.__IM.spawnAt('infantry', p.x, p.y - 160);
    window.__IM.spawnAt('infantry', p.x, p.y + 160);
    const seen = new Set();
    let frames = new Set();
    let n = 0;
    const tick = () => {
      for (const e of s.enemies) {
        if (!e.active || e.kind !== 'infantry' || !e.walkSheet) continue;
        seen.add(e.direction);
        frames.add(e.sprite.frame.name);
      }
      n += 1;
      if (n < 90) requestAnimationFrame(tick);
      else resolve({ dirs: [...seen], frames: [...frames] });
    };
    requestAnimationFrame(tick);
  }));
  const ok = ['down', 'up', 'left', 'right'].every((d) => dirs.dirs.includes(d)) && dirs.frames.length >= 4;
  check('enemy_infantry_walk_dirs', ok, dirs);

  const reset = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.killAllEnemies();
    const p = s.player;
    window.__IM.spawnAt('infantry', p.x + 100, p.y);
    const e = s.enemies.find((x) => x.active && x.kind === 'infantry');
    setTimeout(() => {
      e.direction = 'left';
      e.deactivate();
      window.__IM.spawnAt('infantry', p.x - 100, p.y);
      const e2 = s.enemies.filter((x) => x.active && x.kind === 'infantry').pop();
      resolve({ dir: e2.direction, frame: e2.sprite.frame.name, sheet: e2.walkSheet });
    }, 300);
  }));
  check('enemy_pool_anim_reset', reset.dir === 'down' && reset.frame === 'down_0' && reset.sheet === 'enemy_infantry_walk_sheet', reset);
  await context.close();
}

// 12) 黄巾刀盾兵四方向行走 + 对象池复用重置
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.killAllEnemies(); });
  await page.waitForTimeout(400);
  const dirs = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    const p = s.player;
    window.__IM.spawnAt('shield', p.x - 160, p.y);
    window.__IM.spawnAt('shield', p.x + 160, p.y);
    window.__IM.spawnAt('shield', p.x, p.y - 160);
    window.__IM.spawnAt('shield', p.x, p.y + 160);
    const seen = new Set(); const frames = new Set();
    let n = 0;
    const tick = () => {
      for (const e of s.enemies) {
        if (!e.active || e.kind !== 'shield' || !e.walkSheet) continue;
        seen.add(e.direction); frames.add(e.sprite.frame.name);
      }
      n += 1;
      if (n < 90) requestAnimationFrame(tick);
      else resolve({ dirs: [...seen], frames: [...frames] });
    };
    requestAnimationFrame(tick);
  }));
  check('enemy_shield_walk_dirs', ['down','up','left','right'].every((d) => dirs.dirs.includes(d)) && dirs.frames.length >= 4, dirs);

  const reset = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.killAllEnemies();
    const p = s.player;
    window.__IM.spawnAt('shield', p.x + 100, p.y);
    const e = s.enemies.find((x) => x.active && x.kind === 'shield');
    setTimeout(() => {
      e.direction = 'left';
      e.deactivate();
      window.__IM.spawnAt('shield', p.x - 100, p.y);
      const e2 = s.enemies.filter((x) => x.active && x.kind === 'shield').pop();
      resolve({ dir: e2.direction, frame: e2.sprite.frame.name, sheet: e2.walkSheet });
    }, 300);
  }));
  check('enemy_shield_pool_reset', reset.dir === 'down' && reset.frame === 'down_0' && reset.sheet === 'enemy_shield_walk_sheet', reset);
  await context.close();
}

// 13) 弓兵：拉弓→放箭帧同步，箭只在放箭帧生成
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.killAllEnemies(); });
  await page.waitForTimeout(400);
  const data = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    const p = s.player;
    window.__IM.spawnAt('archer', p.x + 200, p.y);
    const archer = s.enemies.find((e) => e.active && e.kind === 'archer');
    archer.shootCd = 0;
    const t0 = performance.now();
    let atkAt = 0; let boltAt = 0;
    const frames = new Set();
    const tick = () => {
      if (archer.sprite.texture.key === 'enemy_archer_attack_sheet') {
        frames.add(archer.sprite.frame.name);
        if (!atkAt) atkAt = performance.now() - t0;
      }
      if (!boltAt && s.bullets.some((b) => b.active)) boltAt = performance.now() - t0;
      if (boltAt) resolve({ atkAt, boltAt, delay: boltAt - atkAt, frames: [...frames], after: archer.sprite.frame.name });
      else if (performance.now() - t0 > 1500) resolve({ atkAt, boltAt: -1, delay: -1, frames: [...frames], after: archer.sprite.frame.name });
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  const ok = data.atkAt > 0 && data.boltAt > 0 && data.delay >= 120 && data.frames.some((f) => f.endsWith('_0')) && data.frames.some((f) => f.endsWith('_1'));
  check('archer_attack_sync', ok, data);
  await context.close();
}

// 14) 轻骑兵：四方向奔跑 + 冲锋时序/伤害
{
  const { context, page } = await newPage();
  // 注意：不能用 god（会免疫伤害），否则冲锋伤害断言恒为 0
  await page.evaluate(() => { window.__IM.killAllEnemies(); });
  await page.waitForTimeout(400);
  const dirs = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    const p = s.player;
    window.__IM.spawnAt('cavalry', p.x - 170, p.y);
    window.__IM.spawnAt('cavalry', p.x + 170, p.y);
    window.__IM.spawnAt('cavalry', p.x, p.y - 170);
    window.__IM.spawnAt('cavalry', p.x, p.y + 170);
    const seen = new Set(); const frames = new Set(); let n = 0;
    const tick = () => {
      for (const e of s.enemies) {
        if (!e.active || e.kind !== 'cavalry' || !e.walkSheet) continue;
        if (e.chargeState === 'none') { seen.add(e.direction); frames.add(e.sprite.frame.name); }
      }
      n += 1;
      if (n < 90) requestAnimationFrame(tick); else resolve({ dirs: [...seen], frames: [...frames] });
    };
    requestAnimationFrame(tick);
  }));
  check('enemy_cavalry_walk_dirs', ['down','up','left','right'].every((d) => dirs.dirs.includes(d)) && dirs.frames.length >= 4, dirs);

  const charge = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.killAllEnemies();
    const p = s.player;
    p.hp = p.maxHp;
    window.__IM.spawnAt('cavalry', p.x + 120, p.y);
    const c = s.enemies.find((e) => e.active && e.kind === 'cavalry');
    c.dashCd = 0;
    const t0 = performance.now(); const events = {}; const hp0 = s.player.hp;
    const tick = () => {
      const now = performance.now() - t0; const st = c.chargeState;
      if (!events[st] && st !== 'none') events[st] = Math.round(now);
      if (st === 'none' && events.warn && !events.done) events.done = Math.round(now);
      if (events.done || now > 2500) resolve({ events, hit: c.chargeHit, hp0, hp: s.player.hp });
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  const dmg = charge.hp0 - charge.hp;
  const ok = charge.hit && dmg >= 17.5 && charge.events.charge - charge.events.warn >= 400 &&
    charge.events.recover - charge.events.charge >= 180 && charge.events.done - charge.events.recover >= 250;
  check('enemy_cavalry_charge', ok, { ...charge, dmg: +dmg.toFixed(1) });
  await context.close();
}

// 15) 遗物：数值生效、去重、套装、跨流派隔离
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.killAllEnemies(); });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const im = window.__IM;
    const p = window.__game.scene.getScene('GameScene').player;
    p.hp = p.maxHp;
    const base = im.relicsInfo();
    const ok1 = im.giveRelic('drum');
    const dup = im.giveRelic('drum');
    const ok2 = im.giveRelic('whetstone');
    const afterWushuang = im.relicsInfo();
    // 铁壁：铁甲+酒壶
    im.giveRelic('armor'); im.giveRelic('wine');
    const afterTiebi = im.relicsInfo();
    const hp0 = p.maxHp;
    p.invulnUntil = 0;
    const before = p.hp;
    p.takeDamage(20, performance.now());
    const taken = before - p.hp;
    return { base, ok1, dup, ok2, afterWushuang, afterTiebi, hp0, hpAfter: p.maxHp, taken };
  });
  const ok = r.ok1 && !r.dup && r.ok2 &&
    Math.abs(r.afterWushuang.stats.cooldownMul - 0.94) < 0.001 &&
    Math.abs(r.afterWushuang.stats.damageMul - 1.08) < 0.001 &&
    Math.abs(r.afterWushuang.stats.meleeMul - 1.08) < 0.001 &&
    r.afterTiebi.stats.damageTakenMul < 0.93 &&
    r.afterTiebi.stats.maxHpBonus === 10 &&
    r.hp0 === r.hpAfter &&
    r.taken === 18;
  check('relic_effects', ok, r);
  await context.close();
}

// 16) 遗物不重复获得 + 跨流派不误触发
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.killAllEnemies(); });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const im = window.__IM;
    im.giveRelic('ring'); // 神射 1
    im.giveRelic('armor'); // 铁壁 1
    const info = im.relicsInfo();
    const dup = im.giveRelic('ring');
    return { dup, schools: info.schools, stats: info.stats };
  });
  const ok = !r.dup && r.schools.shenshe === 1 && r.schools.tiebi === 1 && Math.abs(r.stats.arrowMul - 1) < 0.001 && Math.abs(r.stats.damageTakenMul - 0.92) < 0.001;
  check('relic_no_dup_school_isolation', ok, r);
  await context.close();
}

// 17) 重开后遗物与套装状态清空
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.giveRelic('drum'); window.__IM.giveRelic('whetstone'); });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__IM.restart());
  await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => window.__IM.relicsInfo());
  check('relic_restart_clears', info.relics.length === 0 && info.stats.meleeMul === 1, info);
  await context.close();
}

// 18) 铁壁两件套按武将基础生命计算（赵云/关羽/黄忠）
{
  const expected = { zhaoyun: 110, guanyu: 138, huangzhong: 99 };
  const detail = [];
  for (const char of ['zhaoyun', 'guanyu', 'huangzhong']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '?r=' + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(700);
    await page.evaluate((c) => { window.__game.registry.set('runConfig', c); window.__game.scene.getScene('MenuScene').scene.start('GameScene'); }, { character: char, weapon: 'spear_orbit' });
    await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const im = window.__IM; const p = window.__game.scene.getScene('GameScene').player;
      p.hp = p.maxHp;
      im.giveRelic('armor'); im.giveRelic('wine');
      return { maxHp: p.maxHp, hp: p.hp };
    });
    detail.push({ char, ...r });
    await ctx.close();
    check('relic_tiebi_' + char, r.maxHp === expected[char], { char, maxHp: r.maxHp, expected: expected[char] });
  }
  void detail;
}

// 19) 黄巾校尉：四方向行走 + 对象池复用重置
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.killAllEnemies(); });
  await page.waitForTimeout(400);
  const dirs = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    const p = s.player;
    window.__IM.spawnAt('elite', p.x - 160, p.y);
    window.__IM.spawnAt('elite', p.x + 160, p.y);
    window.__IM.spawnAt('elite', p.x, p.y - 160);
    window.__IM.spawnAt('elite', p.x, p.y + 160);
    const seen = new Set(); const frames = new Set(); let n = 0;
    const tick = () => {
      for (const e of s.enemies) {
        if (!e.active || e.kind !== 'elite' || !e.walkSheet) continue;
        seen.add(e.direction); frames.add(e.sprite.frame.name);
      }
      n += 1;
      if (n < 90) requestAnimationFrame(tick); else resolve({ dirs: [...seen], frames: [...frames] });
    };
    requestAnimationFrame(tick);
  }));
  check('enemy_officer_walk_dirs', ['down','up','left','right'].every((d) => dirs.dirs.includes(d)) && dirs.frames.length >= 4, dirs);

  const reset = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.killAllEnemies();
    const p = s.player;
    window.__IM.spawnAt('elite', p.x + 100, p.y);
    const e = s.enemies.find((x) => x.active && x.kind === 'elite');
    setTimeout(() => {
      e.direction = 'left';
      e.deactivate();
      window.__IM.spawnAt('elite', p.x - 100, p.y);
      const e2 = s.enemies.filter((x) => x.active && x.kind === 'elite').pop();
      resolve({ dir: e2.direction, frame: e2.sprite.frame.name, sheet: e2.walkSheet });
    }, 300);
  }));
  check('enemy_officer_pool_reset', reset.dir === 'down' && reset.frame === 'down_0' && reset.sheet === 'enemy_officer_walk_sheet', reset);
  await context.close();
}

// 20) 音效：节流/并发丢弃、分类统计、静音
{
  const { context, page } = await newPage();
  // 首次点击解锁 AudioContext
  await page.mouse.click(195, 700);
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const sfx = window.__game.scene.getScene('GameScene').sfx;
    sfx.unlock();
    const before = { ...(sfx.getStats().hitLight ?? { triggered: 0, played: 0, dropped: 0 }) };
    for (let i = 0; i < 20; i += 1) sfx.play('hitLight');
    const afterHits = sfx.getStats();
    sfx.play('bossVolley');
    sfx.play('chargeWarn');
    const afterMix = sfx.getStats();
    sfx.setMuted(true);
    const mutedBefore = { ...afterMix.hitLight };
    sfx.play('hitLight');
    const mutedAfter = sfx.getStats().hitLight;
    sfx.setMuted(false);
    return { before, afterHits: { ...afterHits.hitLight }, afterMix: Object.keys(afterMix), mutedBefore: { ...mutedBefore }, mutedAfter: { ...mutedAfter } };
  });
  const base = r.before;
  const dTrig = r.afterHits.triggered - base.triggered;
  const dPlayed = r.afterHits.played - base.played;
  const dDropped = r.afterHits.dropped - base.dropped;
  const ok = dTrig >= 20 && dPlayed <= 3 && dDropped >= 15 &&
    r.afterMix.includes('bossVolley') && r.afterMix.includes('chargeWarn') &&
    r.mutedAfter.dropped > r.mutedBefore.dropped;
  check('sfx_throttle_mute', ok, r);
  await context.close();
}

// 21) 步态基于分离后的真实位移 + 武将连续重开不闪回
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.clearWeapons(); window.__IM.killAllEnemies(); });
  await page.waitForTimeout(300);
  const walk = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    const p = s.player;
    for (let i = 0; i < 14; i += 1) {
      const a = (Math.PI * 2 * i) / 14;
      window.__IM.spawnAt('infantry', p.x + Math.cos(a) * 40, p.y + Math.sin(a) * 40);
    }
    const prev = new Map();
    const bad = [];
    let movingSamples = 0;
    let n = 0;
    const tick = () => {
      for (const e of s.enemies) {
        if (!e.active || e.kind !== 'infantry') continue;
        const last = prev.get(e.uid);
        if (last) {
          const moved = Math.hypot(e.x - last.x, e.y - last.y);
          if (moved > 0.25) movingSamples += 1;
          if (moved < 0.02 && !e.sprite.frame.name.endsWith('_0')) bad.push({ moved, frame: e.sprite.frame.name });
        }
        prev.set(e.uid, { x: e.x, y: e.y });
      }
      n += 1;
      if (n < 100) requestAnimationFrame(tick);
      else resolve({ bad: bad.slice(0, 5), movingSamples });
    };
    requestAnimationFrame(tick);
  }));
  check('enemy_walk_post_separation', walk.bad.length === 0 && walk.movingSamples > 0, walk);

  // 关羽连续重开 3 次，进场第一帧必须是关羽自己的表
  await page.evaluate(() => window.__game.registry.set('runConfig', { character: 'guanyu', weapon: 'spear_orbit' }));
  const restarts = [];
  for (let i = 0; i < 3; i += 1) {
    await page.evaluate(() => window.__IM.restart());
    await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { tex: s.player.sprite.texture.key, sheet: s.player.walkSheet }; });
    restarts.push(st);
  }
  check('character_restart_no_flash', restarts.every((r) => r.tex === 'guanyu_walk_sheet' && r.sheet === 'guanyu_walk_sheet'), restarts);
  await context.close();
}

// 22) BGM：首次手势启动、循环调度、静音持久化
{
  const { context, page } = await newPage();
  await page.mouse.click(195, 700);
  await page.waitForTimeout(1200);
  const started = await page.evaluate(() => window.__IM.musicInfo());
  const before = started.step;
  await page.waitForTimeout(700);
  const later = await page.evaluate(() => window.__IM.musicInfo());
  const muted = await page.evaluate(() => window.__IM.toggleMusic());
  const mutedInfo = await page.evaluate(() => window.__IM.musicInfo());
  const stored = await page.evaluate(() => localStorage.getItem('im_music'));
  await page.evaluate(() => window.__IM.toggleMusic());
  const ok = started.playing && later.step > before && muted === true && mutedInfo.muted === true && stored === '0';
  check('music_toggle', ok, { started, later, muted, mutedInfo, stored });
  await context.close();
}

// 23) 六波时间边界 + Boss 波 + 音量持久化
{
  const { context, page } = await newPage();
  await page.evaluate(() => window.__IM.god());
  const waves = [];
  for (const t of [59, 60, 120, 240, 299, 300]) {
    await page.evaluate((time) => window.__IM.setTime(time), t);
    await page.waitForTimeout(300);
    waves.push(await page.evaluate(() => window.__IM.waveInfo()));
  }
  const okWaves = waves[0].index === 0 && waves[1].index === 1 && waves[2].index === 2 &&
    waves[3].index === 4 && waves[4].index === 4 && waves[5].index === 5;

  const vol = await page.evaluate(() => {
    window.__IM.setVolumes(30, 60);
    return {
      info: window.__IM.volumeInfo(),
      stored: [localStorage.getItem('im_bgm_vol'), localStorage.getItem('im_sfx_vol')],
    };
  });
  const okVol = vol.info.bgm === 30 && vol.info.sfx === 60 && vol.stored[0] === '30' && vol.stored[1] === '60';
  check('wave_boundaries', okWaves, waves);
  check('volume_persist', okVol, vol);
  await context.close();
}

// 24) 蜀国刀兵：跟随玩家 + 自动横砍
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.killAllEnemies(); window.__IM.spawnAlly('swordsman'); });
  await page.waitForTimeout(300);
  const start = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene');
    return { ally: window.__IM.allyInfo()[0], px: s.player.x, py: s.player.y };
  });
  await page.evaluate(() => window.__IM.setMove(1, 0));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__IM.clearMove());
  const follow = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene');
    return { ally: window.__IM.allyInfo()[0], px: s.player.x, py: s.player.y };
  });
  const dist = Math.hypot(follow.ally.x - follow.px, follow.ally.y - follow.py);
  check('ally_follow', follow.ally.x > start.ally.x + 20 && dist < 130, { start, follow, dist: Math.round(dist) });

  const attack = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    const a = window.__IM.allyInfo()[0];
    window.__IM.spawnAt('infantry', a.x + 55, a.y + 5);
    const hp0 = s.enemies.find((e) => e.active && e.kind === 'infantry')?.hp ?? 0;
    setTimeout(() => {
      const e = s.enemies.find((x) => x.active && x.kind === 'infantry');
      resolve({ hp0, hp1: e ? e.hp : 0, damage: s.damageDealt });
    }, 1800);
  }));
  check('ally_attack', attack.damage > 0 || attack.hp1 < attack.hp0, attack);
  await context.close();
}

// 25) 蜀国弓兵：远程射击造成伤害
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.clearWeapons(); window.__IM.killAllEnemies(); window.__IM.spawnAlly('archer'); });
  await page.waitForTimeout(400);
  const data = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    const p = s.player;
    window.__IM.spawnAt('infantry', p.x + 200, p.y);
    const d0 = s.damageDealt;
    setTimeout(() => resolve({ d0, d1: s.damageDealt, enemies: s.enemies.filter((e) => e.active).length }), 2200);
  }));
  check('ally_archer_attack', data.d1 > data.d0, data);
  await context.close();
}

// 26) 招募：开局无兵，下一波开始弹三选一
{
  const { context, page } = await newPage();
  await page.evaluate(() => window.__IM.god());
  const start = await page.evaluate(() => window.__IM.allyInfo().length);
  await page.evaluate(() => window.__IM.setTime(61));
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => window.__IM.recruitInfo());
  await page.evaluate(() => window.__IM.chooseRecruit(0));
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ allies: window.__IM.allyInfo().length, mode: window.__IM.recruitInfo().mode }));
  check('recruit_no_start_allies', start === 0, { start });
  check('recruit_on_wave_start', info.mode === 'recruit' && info.options.length === 3 && after.allies === 1 && after.mode === 'none', { info, after });
  await context.close();
}

// 27) 蜀国枪兵：直线突刺伤害 + 招募三兵种候选
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.clearWeapons(); window.__IM.killAllEnemies(); window.__IM.spawnAlly('spearman'); });
  await page.waitForTimeout(400);
  const data = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    const p = s.player;
    window.__IM.spawnAt('infantry', p.x + 110, p.y);
    const d0 = s.damageDealt;
    setTimeout(() => resolve({ d0, d1: s.damageDealt }), 2200);
  }));
  check('ally_spearman_attack', data.d1 > data.d0, data);

  const opts = await page.evaluate(() => {
    window.__IM.setTime(61);
    return new Promise((resolve) => setTimeout(() => resolve(window.__IM.recruitInfo()), 500));
  });
  const kinds = new Set(opts.options.map((o) => o.kind));
  check('recruit_three_kinds', opts.mode === 'recruit' && kinds.has('swordsman') && kinds.has('archer') && kinds.has('spearman'), opts);
  await context.close();
}

// 28) 招募卡可鼠标点击 + 小兵与敌人碰撞
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.setTime(61); });
  await page.waitForTimeout(600);
  const pos = await page.evaluate(() => {
    const sc = window.__game.scene.getScene('GameScene');
    const bg = sc.recruitViews[0].bg;
    const b = bg.getBounds();
    const c = document.querySelector('canvas').getBoundingClientRect();
    const scale = c.width / sc.scale.width;
    return { x: c.x + (b.x + b.width / 2) * scale, y: c.y + (b.y + b.height / 2) * scale };
  });
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(400);
  const clicked = await page.evaluate(() => ({ mode: window.__IM.recruitInfo().mode, allies: window.__IM.allyInfo().length }));
  check('recruit_card_click', clicked.mode === 'none' && clicked.allies === 1, clicked);

  const coll = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.killAllEnemies();
    const a = window.__IM.allyInfo()[0];
    window.__IM.spawnAt('infantry', a.x + 5, a.y);
    setTimeout(() => {
      const ally = window.__IM.allyInfo()[0];
      const e = s.enemies.find((x) => x.active && x.kind === 'infantry');
      const dist = e ? Math.hypot(e.x - ally.x, e.y - ally.y) : 99;
      resolve({ dist: +dist.toFixed(1) });
    }, 700);
  }));
  check('ally_enemy_collision', coll.dist >= 20, coll);
  await context.close();
}

// 29) 友军碰撞：不挡玩家、不造成伤害、稳定、骑兵冲锋不卡死
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.clearWeapons(); window.__IM.killAllEnemies(); window.__IM.spawnAlly('swordsman'); });
  await page.waitForTimeout(300);
  const pass = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    const a = window.__IM.allyInfo()[0];
    s.player.sprite.x = a.x - 40;
    s.player.sprite.y = a.y;
    window.__IM.setMove(1, 0);
    setTimeout(() => {
      window.__IM.clearMove();
      resolve({ px: s.player.x, ax: window.__IM.allyInfo()[0].x });
    }, 900);
  }));
  check('ally_does_not_block_player', pass.px > pass.ax, pass);

  const stable = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    const a = window.__IM.allyInfo()[0];
    window.__IM.spawnAt('infantry', a.x + 4, a.y);
    const hp0 = s.player.hp;
    setTimeout(() => {
      const ally = window.__IM.allyInfo()[0];
      const e = s.enemies.find((x) => x.active && x.kind === 'infantry');
      const dist = e ? Math.hypot(e.x - ally.x, e.y - ally.y) : 99;
      resolve({ dist: +dist.toFixed(1), hp0, hp1: s.player.hp, nan: !Number.isFinite(ally.x) || !Number.isFinite(ally.y) });
    }, 1500);
  }));
  check('ally_collision_stability', stable.dist >= 18 && stable.hp1 === stable.hp0 && !stable.nan, stable);

  // 骑兵冲锋碰到友军后仍能结束冲锋
  const charge = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.killAllEnemies();
    const a = window.__IM.allyInfo()[0];
    window.__IM.spawnAt('cavalry', a.x + 100, a.y);
    const c = s.enemies.find((x) => x.active && x.kind === 'cavalry');
    c.dashCd = 0;
    setTimeout(() => resolve({ state: window.__IM.cavalryInfo()[0]?.state ?? 'none' }), 2500);
  }));
  check('cavalry_charge_vs_ally', ['none', 'recover'].includes(charge.state), charge);
  await context.close();
}

// 30) 友军分散站位 + 完整招募流程 + 高密度碰撞
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.killAllEnemies(); });
  for (let i = 0; i < 5; i += 1) await page.evaluate((k) => window.__IM.spawnAlly(k), i % 2 === 0 ? 'swordsman' : 'archer');
  await page.waitForTimeout(600);
  const spread = await page.evaluate(() => {
    const a = window.__IM.allyInfo();
    let min = 999;
    for (let i = 0; i < a.length; i += 1) for (let j = i + 1; j < a.length; j += 1) min = Math.min(min, Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y));
    return { count: a.length, minDist: +min.toFixed(1) };
  });
  check('ally_spread', spread.count === 5 && spread.minDist > 20, spread);

  const stress = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    const p = s.player;
    for (let i = 0; i < 140; i += 1) {
      const a = (Math.PI * 2 * i) / 140;
      window.__IM.spawnAt('infantry', p.x + Math.cos(a) * (60 + (i % 7) * 30), p.y + Math.sin(a) * (60 + (i % 7) * 30));
    }
    let fps = 0; let n = 0;
    const t0 = performance.now();
    const tick = () => { fps += s.game.loop.actualFps; n += 1; if (performance.now() - t0 < 2500) requestAnimationFrame(tick); else resolve({ fps: +(fps / n).toFixed(1), allies: window.__IM.allyInfo().length, bad: window.__IM.allyInfo().some((a) => !Number.isFinite(a.x) || !Number.isFinite(a.y)) }); };
    requestAnimationFrame(tick);
  }));
  check('ally_collision_stress', !stress.bad && stress.allies === 5 && stress.fps > 30, stress);
  await context.close();
}
{
  const { context, page } = await newPage();
  await page.evaluate(() => window.__IM.god());
  const modes = [];
  for (const t of [60, 120, 180, 240, 300]) {
    await page.evaluate((time) => window.__IM.setTime(time), t);
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => window.__IM.recruitInfo());
    modes.push(info.mode);
    if (t === 300) {
      const bossBefore = await page.evaluate(() => window.__IM.bossInfo().active);
      await page.evaluate(() => window.__IM.chooseRecruit(0));
      await page.waitForTimeout(800);
      const bossAfter = await page.evaluate(() => window.__IM.bossInfo().active);
      modes.push('bossBefore:' + bossBefore, 'bossAfter:' + bossAfter);
    } else {
      await page.evaluate(() => window.__IM.chooseRecruit(0));
      await page.waitForTimeout(200);
    }
  }
  const allies = await page.evaluate(() => window.__IM.allyInfo().length);
  await page.evaluate(() => window.__IM.restart());
  await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const reset = await page.evaluate(() => ({ allies: window.__IM.allyInfo().length, mode: window.__IM.recruitInfo().mode }));
  check('recruit_full_flow', modes.slice(0, 5).every((m) => m === 'recruit') && modes.includes('bossBefore:false') && modes.includes('bossAfter:true') && allies === 5, { modes, allies });
  check('recruit_restart_clears', reset.allies === 0 && reset.mode === 'none', reset);
  await context.close();
}

// 31) Boss 新数值：2400 HP + 50% 二阶段 + 300 护盾
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.killAllEnemies(); window.__IM.spawnBoss(); });
  await page.waitForTimeout(500);
  const base = await page.evaluate(() => window.__IM.bossInfo());
  await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.boss.hp = s.boss.maxHp * 0.45; });
  await page.waitForTimeout(600);
  const phase = await page.evaluate(() => window.__IM.bossInfo());
  check('boss_hp_and_phase2', base.maxHp === 2400 && base.phase2 === false && phase.phase2 === true && phase.shield === 300, { base, phase });

  // 护盾只触发一次：已二阶段后继续降血不会再加护盾
  await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.boss.hp = s.boss.maxHp * 0.3; });
  await page.waitForTimeout(400);
  const once = await page.evaluate(() => window.__IM.bossInfo());
  check('boss_shield_once', once.shield === 300, once);

  // 护盾吸收：护盾未破时 Boss 不掉血
  const absorb = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene');
    const hp0 = s.boss.hp;
    const shield0 = window.__IM.bossInfo().shield;
    // Boss 默认在 430px 外，拉到近身才在枪的 220px 索敌内
    s.boss.sprite.x = s.player.x + 100;
    s.boss.sprite.y = s.player.y;
    return new Promise((resolve) => {
      window.__IM.clearWeapons();
      window.__IM.giveWeapon('spear_orbit');
      s.player.weapons[0].level = 1;
      s.player.stats.critChance = 0;
      s.player.weapons[0].cooldownLeft = 0;
      setTimeout(() => {
        const info = window.__IM.bossInfo();
        resolve({ hp0: Math.round(hp0), hp1: Math.round(s.boss.hp), shield0, shield1: info.shield });
      }, 700);
    });
  });
  check('boss_shield_absorb', absorb.hp1 === absorb.hp0 && absorb.shield1 < absorb.shield0, absorb);

  // 重开清空护盾
  await page.evaluate(() => window.__IM.restart());
  await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const restart = await page.evaluate(() => window.__IM.bossInfo());
  check('boss_shield_restart_clears', restart.shield === 0 && restart.phase2 === false, restart);
  await context.close();
}

// 32) 友军攻击表八帧完整（修复选择后闪烁）
{
  const { context, page } = await newPage();
  const data = await page.evaluate(() => {
    const out = {};
    for (const key of ['shu_swordsman_attack_sheet', 'shu_archer_attack_sheet', 'shu_spearman_attack_sheet']) {
      const tex = window.__game.textures.get(key);
      out[key] = tex.getFrameNames().filter((n) => n.startsWith('atk_')).length;
    }
    return out;
  });
  check('ally_attack_frames_complete', Object.values(data).every((n) => n === 8), data);
  await context.close();
}

// 33) DEV 面板：只在 dev=1 出现、状态安全、跳波招募、Boss、modified、重置
{
  const plain = await browser.newPage();
  await plain.goto(BASE + '?autostart=1&r=' + Date.now(), { waitUntil: 'load' });
  await plain.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
  const noPanel = await plain.evaluate(() => !!document.getElementById('dev-panel'));
  await plain.close();
  check('dev_panel_only_in_dev', noPanel === false, { noPanel });

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(BASE + '?autostart=1&dev=1&r=' + Date.now(), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  const panel = await page.evaluate(() => !!document.getElementById('dev-panel'));

  await page.evaluate(() => { window.__IM.devAction('level5'); window.__IM.devAction('boss'); window.__IM.devAction('boss50'); });
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => window.__IM.devInfo());
  check('dev_controls_valid_state', panel && info.level === 5 && info.boss === true && info.modified === true, info);

  await page.evaluate(() => window.__IM.devAction('reset'));
  await page.waitForTimeout(900);
  const reset = await page.evaluate(() => window.__IM.devInfo());
  check('dev_reset_clean', reset.level === 1 && reset.wave === 0 && reset.allies === 0 && reset.boss === false, reset);

  await page.evaluate(() => window.__IM.devAction('wave2'));
  await page.waitForTimeout(500);
  const rec = await page.evaluate(() => window.__IM.recruitInfo());
  await page.evaluate(() => window.__IM.chooseRecruit(0));
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__IM.devInfo());
  check('dev_wave_recruit_flow', rec.mode === 'recruit' && after.allies === 1, { rec, after });

  await page.evaluate(() => window.__IM.devAction('boss'));
  await page.waitForTimeout(500);
  const boss = await page.evaluate(() => window.__IM.bossInfo());
  check('dev_boss_spawn', boss.active === true, boss);

  const modified = await page.evaluate(() => window.__IM.devInfo());
  check('dev_debug_modified', modified.modified === true, modified);
  await context.close();
}

// 34) 武器数据驱动（7C-1）：注册表完整、数值等价、暂停/重开
{
  const { context, page } = await newPage();
  const defs = await page.evaluate(() => window.__IM.weaponDefs());
  check('weapon_registry_complete', defs.length === 4 && defs.every((d) => d.name && d.maxLevel === 5), defs);

  const eq = await page.evaluate(() => {
    window.__IM.clearWeapons();
    window.__IM.giveWeapon('spear_orbit');
    window.__IM.giveWeapon('crossbow');
    window.__IM.giveWeapon('flame_banner');
    const scene = window.__game.scene.getScene('GameScene');
    const info1 = window.__IM.weaponInfo().map((w) => ({ id: w.id, damage: +w.damage.toFixed(3), cooldown: +w.cooldown.toFixed(3) }));
    scene.player.weapons.forEach((w) => { w.level = 5; });
    const info5 = window.__IM.weaponInfo().map((w) => ({ id: w.id, damage: +w.damage.toFixed(3), cooldown: +w.cooldown.toFixed(3) }));
    return { info1, info5 };
  });
  const d1 = Object.fromEntries(eq.info1.map((w) => [w.id, w]));
  const d5 = Object.fromEntries(eq.info5.map((w) => [w.id, w]));
  const ok = Math.abs(d1.spear_orbit.damage - 22) < 0.01
    && Math.abs(d1.spear_orbit.cooldown - 1.1) < 0.01
    && Math.abs(d1.crossbow.cooldown - 1.1) < 0.01
    && Math.abs(d1.flame_banner.damage - 22) < 0.01
    && Math.abs(d5.spear_orbit.damage - 34) < 0.01
    && Math.abs(d5.flame_banner.cooldown - 3.2 / 1.2) < 0.01;
  check('weapon_behavior_equivalence', ok, eq);

  const paused = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.clearWeapons();
    window.__IM.giveWeapon('crossbow');
    s.player.weapons[0].cooldownLeft = 1.1;
    return s.player.weapons[0].cooldownLeft;
  });
  await page.evaluate(() => { window.__game.scene.getScene('GameScene').togglePause(); });
  await page.waitForTimeout(500);
  const pausedCd = await page.evaluate(() => window.__game.scene.getScene('GameScene').player.weapons[0].cooldownLeft);
  await page.evaluate(() => { window.__game.scene.getScene('GameScene').togglePause(); });
  check('weapon_mode_pause', Math.abs(pausedCd - paused) < 0.01, { paused, pausedCd });

  await page.evaluate(() => {
    window.__IM.giveRelic('drum');
    window.__IM.giveRelic('whetstone');
  });
  const relic = await page.evaluate(() => window.__IM.weaponInfo().find((w) => w.id === 'crossbow'));
  check('weapon_relic_compat', relic && relic.damage > 16, relic);

  await page.evaluate(() => window.__IM.restart());
  await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
  await page.waitForTimeout(700);
  const clean = await page.evaluate(() => window.__IM.weaponInfo());
  check('weapon_restart_clean', clean.length === 1 && clean[0].id === 'spear_orbit' && clean[0].level === 1, clean);
  await context.close();
}

// 35) 七探盘龙枪：多目标、单体上限、无目标不耗冷却、暂停、重开
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__IM.god(); window.__IM.clearWeapons(); window.__IM.giveWeapon('spear_orbit'); window.__IM.killAllEnemies(); });
  await page.waitForTimeout(300);
  const noTarget = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    s.player.weapons[0].cooldownLeft = 0;
    setTimeout(() => resolve({ cd: s.player.weapons[0].cooldownLeft, shots: window.__IM.spearInfo().shots }), 600);
  }));
  check('spear_no_target_no_cooldown', noTarget.cd <= 0 && noTarget.shots === 0, noTarget);

  await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene');
    s.player.weapons[0].level = 3;
    const p = s.player;
    for (let i = 0; i < 3; i += 1) window.__IM.spawnAt('infantry', p.x + 80 + i * 30, p.y);
  });
  await page.waitForTimeout(900);
  const multi = await page.evaluate(() => ({ dmg: window.__game.scene.getScene('GameScene').damageDealt, shots: window.__IM.spearInfo() }));
  check('spear_multi_target', multi.dmg > 0 && multi.shots.level === 3, multi);

  // 单体 Lv5：同一目标每轮最多 2 枪
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.killAllEnemies();
    s.player.weapons[0].level = 5;
    s.player.weapons[0].cooldownLeft = 0;
    const p = s.player;
    window.__IM.spawnAt('elite', p.x + 100, p.y);
  });
  const single = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    const before = s.damageDealt;
    setTimeout(() => resolve({ delta: s.damageDealt - before, shots: window.__IM.spearInfo().shots }), 700);
  }));
  check('spear_single_target_cap', single.delta <= 34 * 2 * 2, single);

  // 暂停冻结
  const pausedBefore = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene');
    s.player.weapons[0].cooldownLeft = 0;
    window.__IM.spawnAt('infantry', s.player.x + 90, s.player.y);
    return s.damageDealt;
  });
  await page.evaluate(() => window.__game.scene.getScene('GameScene').togglePause());
  await page.waitForTimeout(500);
  const pausedAfter = await page.evaluate(() => window.__game.scene.getScene('GameScene').damageDealt);
  await page.evaluate(() => window.__game.scene.getScene('GameScene').togglePause());
  check('spear_pause_resume', pausedAfter === pausedBefore, { pausedBefore, pausedAfter });

  await page.evaluate(() => window.__IM.restart());
  await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const clean = await page.evaluate(() => window.__IM.spearInfo());
  check('spear_restart_cleanup', clean.shots === 0 && clean.level === 1, clean);
  await context.close();
}

// 枪穿透辅助：设赵云枪 Lv、清暴击（伤害确定性）、按 cfg 布怪，等一轮后返回伤害增量
async function spearRoundDelta(page, cfg) {
  const d0 = await page.evaluate((c) => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.god();
    window.__IM.killAllEnemies();
    window.__IM.clearWeapons();
    window.__IM.giveWeapon('spear_orbit');
    const w = s.player.weapons[0];
    w.level = c.level;
    w.cooldownLeft = 0;
    s.player.stats.critChance = 0;
    const p = s.player;
    for (const [ox, oy] of (c.enemies || [])) window.__IM.spawnAt('elite', p.x + ox, p.y + oy);
    if (c.boss) { window.__IM.spawnBoss(); if (s.boss) { s.boss.sprite.x = p.x + 100; s.boss.sprite.y = p.y; } }
    return s.damageDealt;
  }, cfg);
  await page.waitForTimeout(650);
  const d1 = await page.evaluate(() => window.__game.scene.getScene('GameScene').damageDealt);
  return d1 - d0;
}

// 41) 七探盘龙枪穿透：一枪穿多个 / 单枪上限 / 单目标一次 / 每轮每敌最多 2 枪 / 等级成长 / 暂停 / 重开 / Boss
{
  const { context, page } = await newPage();

  // 一枪穿 2（Lv1 伤害 22 × 2）
  const pierce = await spearRoundDelta(page, { level: 1, enemies: [[60, 0], [100, 0], [140, 0]] });
  check('spear_line_pierce', Math.abs(pierce - 44) <= 1, { delta: pierce });

  // 单枪命中上限：线上一排 5 只精英，Lv1 cap=2 只打 2 只
  const capHit = await spearRoundDelta(page, { level: 1, enemies: [[50, 0], [80, 0], [110, 0], [140, 0], [170, 0]] });
  check('spear_pierce_hit_limit', Math.abs(capHit - 44) <= 1, { delta: capHit });

  // 单目标每枪只结算一次（Lv1 1 枪 1 敌 = 22）
  const once = await spearRoundDelta(page, { level: 1, enemies: [[90, 0]] });
  check('spear_same_target_once', Math.abs(once - 22) <= 1, { delta: once });

  // 多枪同线：Lv3 三枪对线上 3 精英，每敌最多 2 枪 → 6 次命中 = 162
  const multiCap = await spearRoundDelta(page, { level: 3, enemies: [[60, 0], [100, 0], [140, 0]] });
  check('spear_multi_spear_target_cap', Math.abs(multiCap - 162) <= 2, { delta: multiCap });

  // 等级成长表
  const table = await page.evaluate(() => window.__IM.spearTable());
  const tableOk = table.length === 5
    && table[0].len === 150 && table[4].len === 170
    && table[0].cap === 2 && table[4].cap === 4
    && table[0].width === 22 && table[4].width === 28
    && table.every((r, i) => i === 0 || (r.len > table[i - 1].len && r.cap >= table[i - 1].cap && r.width >= table[i - 1].width));
  check('spear_pierce_level_scaling', tableOk, table);

  // Boss 单体：Lv5 五枪但同一目标每轮最多 2 枪 → 2×34 = 68
  const bossDelta = await spearRoundDelta(page, { level: 5, boss: true });
  check('spear_pierce_boss', Math.abs(bossDelta - 68) <= 2, { delta: bossDelta });
  await context.close();
}

// 42) 枪穿透：暂停冻结 + 重开清理
{
  const { context, page } = await newPage();
  const pausedBefore = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.god();
    window.__IM.clearWeapons();
    window.__IM.giveWeapon('spear_orbit');
    s.player.weapons[0].level = 3;
    s.player.stats.critChance = 0;
    s.player.weapons[0].cooldownLeft = 0;
    const p = s.player;
    for (const ox of [60, 100, 140]) window.__IM.spawnAt('elite', p.x + ox, p.y);
    return s.damageDealt;
  });
  await page.evaluate(() => window.__game.scene.getScene('GameScene').togglePause());
  await page.waitForTimeout(500);
  const pausedAfter = await page.evaluate(() => window.__game.scene.getScene('GameScene').damageDealt);
  await page.evaluate(() => window.__game.scene.getScene('GameScene').togglePause());
  check('spear_pierce_pause', pausedAfter === pausedBefore, { pausedBefore, pausedAfter });

  await page.evaluate(() => window.__IM.restart());
  await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const clean = await page.evaluate(() => window.__IM.spearInfo());
  check('spear_pierce_pool_reuse', clean.shots === 0 && clean.level === 1, clean);
  await context.close();
}

// 36) 四武将专属初始武器 + 诸葛亮行走表 + 关刀扇形
{
  const { context, page } = await newPage();
  const starts = [];
  for (const [char, weapon] of [['zhaoyun', 'spear_orbit'], ['huangzhong', 'crossbow'], ['guanyu', 'guandao'], ['zhuge', 'flame_banner']]) {
    await page.evaluate((c) => { window.__game.registry.set('runConfig', { character: c }); window.__IM.restart(); }, char);
    await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => ({ weapons: window.__IM.weaponInfo(), sheet: window.__game.scene.getScene('GameScene').player.sprite.texture.key }));
    starts.push({ char, weapon: info.weapons[0]?.id, sheet: info.sheet });
    // 战利品/敌人会干扰，清场
    await page.evaluate(() => window.__IM.killAllEnemies());
  }
  check('character_start_weapons', starts.every((s) => s.weapon === s.weapon) && starts.map((s) => s.weapon).join(',') === 'spear_orbit,crossbow,guandao,flame_banner', starts);
  check('zhuge_walk_sheet', starts[3].sheet === 'zhuge_walk_sheet', starts[3]);

  await page.evaluate(() => {
    window.__game.registry.set('runConfig', { character: 'guanyu' });
    window.__IM.restart();
  });
  await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const cone = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.killAllEnemies();
    const p = s.player;
    for (let i = -1; i <= 1; i += 1) {
      window.__IM.spawnAt('infantry', p.x + i * 40, p.y + 90);
    }
    const d0 = s.damageDealt;
    setTimeout(() => resolve({ d0, d1: s.damageDealt }), 1200);
  }));
  check('guandao_cone', cone.d1 - cone.d0 >= 32, cone);
  await context.close();
}

// 37) 关刀等级成长 + 二段刀气
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__game.registry.set('runConfig', { character: 'guanyu' }); window.__IM.restart(); });
  await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const scaling = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.killAllEnemies();
    window.__IM.clearWeapons(); window.__IM.giveWeapon('guandao');
    const info = [];
    for (const lvl of [1, 3, 5]) {
      s.player.weapons[0].level = lvl;
      info.push({ lvl, damage: window.__IM.weaponInfo()[0].damage, cooldown: window.__IM.weaponInfo()[0].cooldown });
    }
    return info;
  });
  check('guandao_level_scaling', Math.abs(scaling[0].damage - 36.8) < 0.01 && Math.abs(scaling[2].damage - 64.4) < 0.01 && Math.abs(scaling[2].cooldown - 1.25) < 0.01, scaling);

  const dbl = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.killAllEnemies();
    s.player.direction = 'down';
    s.player.weapons[0].level = 3;
    s.player.weapons[0].cooldownLeft = 0;
    const p = s.player;
    window.__IM.spawnAt('elite', p.x, p.y + 90);
    const d0 = s.damageDealt;
    setTimeout(() => resolve({ delta: s.damageDealt - d0 }), 900);
  }));
  check('guandao_double_slash', dbl.delta >= 43 * 1.15 * 1.4 - 2, dbl);
  await context.close();
}

// 38) 7E：诸葛亮烈焰战旗流程 + 四武器槽上限
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__game.registry.set('runConfig', { character: 'zhuge' }); window.__IM.restart(); });
  await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const flow = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.killAllEnemies();
    const p = s.player;
    for (let i = 0; i < 3; i += 1) window.__IM.spawnAt('elite', p.x + (i - 1) * 50, p.y + 70);
    s.player.weapons[0].cooldownLeft = 0;
    const d0 = s.damageDealt;
    setTimeout(() => resolve({ d0, d1: s.damageDealt }), 1000);
  }));
  check('zhuge_flame_flow', flow.d1 > flow.d0, flow);

  const cap = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.clearWeapons();
    for (const id of ['spear_orbit', 'crossbow', 'flame_banner', 'guandao']) window.__IM.giveWeapon(id);
    window.__IM.addLevel();
    const opts = window.__IM.upgradeOptions();
    return { count: s.player.weapons.length, weapons: opts.filter((o) => o.kind === 'weapon').map((o) => o.weaponId) };
  });
  const newWeapons = cap.weapons.filter((id) => id && !['spear_orbit', 'crossbow', 'flame_banner', 'guandao'].includes(id));
  check('weapon_four_slot_limit', cap.count === 4 && newWeapons.length === 0, cap);
  await context.close();
}

// 39) 关刀 AOE 自动瞄准怪群最密方向
{
  const { context, page } = await newPage();
  await page.evaluate(() => { window.__game.registry.set('runConfig', { character: 'guanyu' }); window.__IM.restart(); });
  await page.waitForFunction(() => !!window.__IM, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const data = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__game.scene.getScene('GameScene');
    window.__IM.killAllEnemies();
    s.player.direction = 'down';
    s.player.weapons[0].cooldownLeft = 0;
    const p = s.player;
    for (let i = 0; i < 3; i += 1) window.__IM.spawnAt('infantry', p.x - 100, p.y - 30 + i * 30);
    window.__IM.spawnAt('infantry', p.x, p.y + 90);
    const d0 = s.damageDealt;
    setTimeout(() => resolve({ delta: s.damageDealt - d0 }), 500);
  }));
  check('guandao_dense_aim', data.delta >= 100, data);
  await context.close();
}

// 40) 关刀等级范围成长表
{
  const { context, page } = await newPage();
  const table = await page.evaluate(() => window.__IM.guandaoTable());
  const ok = table.length === 5
    && table.every((row, i) => row.radius === [125, 135, 145, 155, 170][i] && row.damage === [32, 38, 43, 49, 56][i])
    && table[4].radius > table[0].radius;
  check('guandao_level_range', ok, table);
  await context.close();
}
// 7) 正式构建不暴露调试入口（自动启动 preview）
{
  startServer(['preview', '--port', '4174', '--strictPort']);
  const up = await waitFor('http://127.0.0.1:4174/');
  if (!up) {
    check('prod_debug_removed', false, { reason: 'preview server not up' });
  } else {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:4174/?autostart=1', { waitUntil: 'load' });
    await page.waitForTimeout(1800);
    const state = await page.evaluate(() => ({ hasIM: typeof window.__IM !== 'undefined', hasGame: typeof window.__game !== 'undefined', canvas: !!document.querySelector('canvas') }));
    check('prod_debug_removed', state.canvas && !state.hasIM && !state.hasGame, state);
    await ctx.close();
  }
}

clearTimeout(suiteDeadline);
await browser.close();
for (const s of servers) s.kill();
const failed = results.filter((r) => !r.ok);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
