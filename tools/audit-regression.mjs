import { chromium } from 'playwright';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.AUDIT_BASE ?? 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const deadline = setTimeout(() => { console.error('AUDIT TIMEOUT: 120s'); void browser.close().finally(() => process.exit(2)); }, 120000);
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} :: ${JSON.stringify(detail)}`); };
async function scenario(name, test, query = '') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}?autostart=1${query}`);
    await page.waitForFunction(() => !!window.__IM);
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene');
      window.__IM.god(); window.__IM.killAllEnemies(); window.__IM.clearWeapons();
      s.spawnTimer = 1e6; s.eliteTimer = 1e6; s.player.stats.critChance = 0;
    });
    await test(page);
    check(`${name}_no_pageerrors`, errors.length === 0, errors);
  } catch (e) { check(name, false, String(e)); }
  finally { await context.close(); }
}
try {
  await scenario('choices', async page => {
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene');
      s.waveIndex = 0; s.elapsed = 59.99; s.player.xp = s.player.xpNext - 1;
      s.spawnGem(s.player.x, s.player.y, 1); s.update(s.combatNow, 20); s.update(s.combatNow, 20);
      const before = { mode: s.mode, pending: s.pendingRecruit };
      s.chooseUpgrade(0); const next = s.mode; const stats = JSON.stringify(s.player.stats);
      s.chooseUpgrade(0); const duplicateSafe = JSON.stringify(s.player.stats) === stats;
      s.chooseRecruit(0);
      return { before, next, duplicateSafe, levels: s.pendingLevels, mode: s.mode, pending: s.pendingRecruit, allies: s.allies.length };
    });
    check('wave_levelup_recruit_queue', r.before.mode === 'levelup' && r.before.pending && r.next === 'recruit' && r.mode === 'none' && r.levels === 0 && !r.pending && r.allies === 1, r);
    check('old_upgrade_card_consumed_once', r.duplicateSafe, r);
    await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.pendingRecruit = true; window.__IM.setMove(1, 0); window.__IM.restart(); });
    await page.waitForTimeout(180);
    const clean = await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { pending: s.pendingRecruit, move: s.debugMoveActive, mode: s.mode }; });
    check('restart_clears_pending_and_move', !clean.pending && !clean.move && clean.mode === 'none', clean);
  });
  await scenario('spear', async page => {
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene'); s.setMode('pause');
      const hole = s.spawnEnemy('elite', 500, 0, 1); const target = s.spawnEnemy('elite', 70, 0, 1); hole.deactivate();
      s.player.weapons = [{ id: 'spear_orbit', level: 1, cooldownLeft: 0 }];
      s.rebuildGrid(); s.updateWeapons(0, s.combatNow); const hp = target.hp;
      s.updateWeapons(.08, s.combatNow + 80); const first = hp - target.hp;
      s.updateWeapons(.08, s.combatNow + 160);
      return { first, total: hp - target.hp, inactiveFirst: !hole.active };
    });
    check('spear_skips_inactive_pool_slot', r.inactiveFirst && r.first === 22, r);
    check('spear_damage_once_per_shot', r.total === 22, r);
  });
  await scenario('pause', async page => {
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene'); const e = s.spawnEnemy('elite', 50, 0, 1); e.hp = 1000;
      s.rebuildGrid(); s.player.weapons = [{ id: 'flame_banner', level: 1, cooldownLeft: 0 }];
      s.updateWeapons(0, s.combatNow); s.setMode('pause');
      s.player.invulnUntil = s.combatNow + 500;
    });
    const t0 = await page.evaluate(() => window.__game.scene.getScene('GameScene').combatNow);
    await page.waitForTimeout(650);
    const frozen = await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { hp: s.enemies.find(e => e.active&&!e.isSupplySlot&&e.kind==='elite').hp, clock: s.combatNow, invulnerable: s.combatNow < s.player.invulnUntil }; });
    check('paused_flame_and_deadlines_frozen', frozen.hp === 1000 && frozen.clock === t0 && frozen.invulnerable, frozen);
    await page.evaluate(() => window.__game.scene.getScene('GameScene').togglePause());
    await page.waitForTimeout(500);
    const resumed = await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return s.enemies.find(e => e.active&&!e.isSupplySlot&&e.kind==='elite').hp; });
    check('paused_flame_resumes_once', resumed === 978, { hp: resumed });
  });
  await scenario('pool_identity', async page => {
    const r = await page.evaluate(async () => {
      const s = window.__game.scene.getScene('GameScene'); const { Ally } = await import('/src/entities/Ally.ts'); const {LegionProjectiles}=await import('/src/systems/LegionProjectiles.ts');
      const a = new Ally(s, 0, 0, 'archer'); const e = s.spawnEnemy('elite', 60, 0, 1); const oldId = e.spawnId;
      let hits = 0; const arrows=new LegionProjectiles(s);arrows.fire(a,e,1,s.combatNow+180); e.deactivate(); const next = s.spawnEnemy('infantry', 1000, 1000, 1);
      s.rebuildGrid();arrows.update(.25,s.combatNow+250,s.grid,()=>hits++);arrows.clear();
      return { hits, oldId, newId: next.spawnId, reused: next === e };
    });
    check('ally_arrow_rejects_reused_target', r.reused && r.oldId !== r.newId && r.hits === 0, r);
    const archer = await page.evaluate(async () => {
      const s = window.__game.scene.getScene('GameScene'); window.__IM.killAllEnemies();
      const e = s.spawnEnemy('archer', 200, 0, 1); e.shootCd = 0; s.updateEnemies(.016, s.combatNow);
      e.deactivate(); s.spawnEnemy('infantry', 1200, 1200, 1); await new Promise(r => setTimeout(r, 260));
      return s.bullets.filter(b => b.active).length;
    });
    check('enemy_archer_cancels_reused_shooter', archer === 0, { bullets: archer });
  });
  await scenario('upgrades', async page => {
    const r = await page.evaluate(async () => {
      const s = window.__game.scene.getScene('GameScene'); const { buildUpgradeOptions } = await import('/src/data/upgrades.ts');
      s.player.weapons = ['spear_orbit', 'crossbow', 'guandao', 'flame_banner'].map(id => ({ id, level: 5, cooldownLeft: 0 }));
      let bad = 0; for (let i = 0; i < 80; i++) bad += buildUpgradeOptions(s.player, s.player.weapons).filter(o => o.kind === 'weapon' || o.id === 'rare_all').length;
      s.player.weapons[0].level = 4; let card;
      for (let i = 0; i < 100 && !card; i++) card = buildUpgradeOptions(s.player, s.player.weapons).find(o => o.id === 'signature_weapon_spear_orbit');
      const desc = card?.desc; card?.apply(s.player, s.player.weapons); card?.apply(s.player, s.player.weapons);
      return { bad, level: s.player.weapons[0].level, desc };
    });
    check('max_level_options_excluded', r.bad === 0 && r.level === 5, r);
    check('upgrade_card_real_numbers', r.desc?.includes('30') && r.desc?.includes('34') && !r.desc.includes('+18%'), r);
  });
  await scenario('boss', async page => {
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene'); s.setMode('pause'); s.spawnBoss();
      s.boss.hp = 1210; s.bossUltPhase = 'charge'; s.bossUltAt = s.combatNow + 10000;
      s.hitEnemy(s.boss, 20, s.combatNow); const shield = s.bossShield; const hp = s.boss.hp;
      s.hitEnemy(s.boss, 25, s.combatNow); const after = { hp: s.boss.hp, shield: s.bossShield };
      s.bossUltPhase = 'none'; s.bossPhase2 = true; s.bossSummonCd = 0; s.bossOrbCd = 100; s.bossFanCd = 100;
      for (let i = 0; i < 7; i++) { const e = s.spawnEnemy('infantry', 300 + i * 30, 100, 1); s.bossSummons.push({ enemy: e, spawnId: e.spawnId }); }
      s.updateBossAbilities(.016); const cap = s.bossSummons.length;
      for (const { enemy } of s.bossSummons) enemy.deactivate();
      for (let i = 0; i < 8; i++) s.spawnEnemy('shield', 1000 + i * 30, 1000, 1);
      s.bossSummonCd = 0; s.updateBossAbilities(.016);
      return { shield, hp, after, cap, summons: s.bossSummons.map(x => ({ kind: x.enemy.kind, matches: x.enemy.spawnId === x.spawnId })), shieldAgain: s.bossShield };
    });
    check('boss_half_hp_shield_during_ultimate', r.shield === 300 && r.hp === 1190 && r.after.hp === 1190 && r.after.shield === 275, r);
    check('boss_shield_not_reapplied', r.shieldAgain === 275, r);
    check('boss_summon_hard_cap', r.cap === 8, r);
    check('boss_summon_identity', r.summons.length === 4 && r.summons.every(x => x.kind === 'infantry' && x.matches), r);
  }, '&dev=1&stage=3');
  await scenario('recruit', async page => {
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene'); s.waveIndex = 1;
      s.openRecruit(); s.chooseRecruit(s.recruitOptions.findIndex(o => o.kind === 'swordsman'));
      const levels = [s.allies[0].level];
      for(let i=0;i<2;i++){s.legion.train('swordsman',true);levels.push(s.allies[0].level);}
      s.openRecruit(); const noInvalid = s.recruitOptions.every(o => !o.upgrade || s.allies.some(a => a.kind === o.kind && a.level < 3));
      s.chooseRecruit(s.recruitOptions.findIndex(o => !o.upgrade));
      s.openRecruit(); s.chooseRecruit(s.recruitOptions.findIndex(o => !o.upgrade));
      return { levels, allies: s.allies.length, noInvalid, pending: s.pendingRecruit, mode: s.mode };
    });
    check('normal_recruit_reaches_level3', r.levels.join(',') === '1,2,3' && r.allies === 1 && r.noInvalid && r.mode === 'none', r);
  });
  await scenario('visual', async page => {
    const idle = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene'); s.setMode('pause');
      const e = s.spawnEnemy('archer', 200, 0, 1); e.startAttack(s.combatNow, 'down');
      e.updateAttackVisual(s.combatNow + 200); e.updateAttackVisual(s.combatNow + 400); e.updateWalk(.016, 0, 0);
      return { texture: e.sprite.texture.key, frame: e.sprite.frame.name };
    });
    check('archer_restores_idle_texture', idle.texture.endsWith('enemy_archer_walk_sheet') && idle.frame === 'down_0', idle);
    const fx = await page.evaluate(() => new Promise(resolve => {
      const s = window.__game.scene.getScene('GameScene'); s.setMode('none'); s.spawnGuandaoSlash(0, 1, 105, 120);
      let max = 0; const start = performance.now();
      const tick = () => { for (const o of s.children.list) if (o.visible&&o.active&&o.texture?.key === 'guandao_slash_sheet') max = Math.max(max, o.displayWidth); if (performance.now() - start < 220) requestAnimationFrame(tick); else resolve(max); }; tick();
    }));
    check('guandao_visual_size_bounded', fx >= 105 && fx <= 112, { maxWidth: fx });
  });
  await scenario('audio', async page => {
    const r = await page.evaluate(async () => {
      const { Music } = await import('/src/systems/Music.ts'); const { Sfx } = await import('/src/systems/Sfx.ts');
      const m = new Music(), s = new Sfx(); m.setVolume(0); s.setVolume(0); const m2 = new Music(), s2 = new Sfx();
      const volumes = [m2.getVolume(), s2.getVolume()]; for (const x of [m, s, m2, s2]) x.dispose(); return volumes;
    });
    check('zero_volume_persisted', r.every(v => v === 0), r);
  });
  await scenario('desktop', async page => {
    const r = await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.togglePause(); s.togglePause(); return s.joystick.enabled; });
    check('desktop_hidden_joystick_stays_disabled', !r, { enabled: r });
  }, '&layout=desktop');
  const lifecycle = await browser.newContext();
  try {
    const page = await lifecycle.newPage();
    await page.addInitScript(() => {
      const set = window.setInterval.bind(window), clear = window.clearInterval.bind(window);
      window.__auditIntervals = new Set();
      window.setInterval = (f, delay, ...args) => { const id = set(f, delay, ...args); window.__auditIntervals.add(id); return id; };
      window.clearInterval = id => { window.__auditIntervals.delete(id); clear(id); };
      const add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document);
      window.__auditVisibility = new Set();
      document.addEventListener = (type, callback, ...args) => { if (type === 'visibilitychange') window.__auditVisibility.add(callback); return add(type, callback, ...args); };
      document.removeEventListener = (type, callback, ...args) => { if (type === 'visibilitychange') window.__auditVisibility.delete(callback); return remove(type, callback, ...args); };
    });
    await page.goto(BASE + '?autostart=1&dev=1&perf=1');
    await page.waitForFunction(() => !!window.__IM);
    const counts = () => page.evaluate(() => ({ intervals: window.__auditIntervals.size, listeners: window.__auditVisibility.size, pointers: window.__game.input.pointers.length }));
    const initial = await counts();
    for (let i = 0; i < 10; i++) { await page.evaluate(() => window.__IM.restart()); await page.waitForTimeout(100); }
    const after = await counts();
    check('restart_dev_intervals_stable', after.intervals === initial.intervals, { initial, after });
    check('restart_visibility_listeners_stable', after.listeners === initial.listeners, { initial, after });
    check('restart_pointer_count_stable', after.pointers === initial.pointers, { initial, after });
  } finally { await lifecycle.close(); }
  const assets = readdirSync('dist/assets').filter(f => f.endsWith('.js')).map(f => readFileSync(join('dist/assets', f), 'utf8')).join('\n');
  const markers = ['DEV 测试面板', '__DEV_INFO', 'installDebug(', 'setupDevPanel(', 'enemy150', 'dev-panel'];
  const retained = markers.filter(m => assets.includes(m));
  check('production_excludes_dev_implementation', retained.length === 0, { retained });
} finally { clearTimeout(deadline); await browser.close(); }
const failed = results.filter(r => !r.ok);
console.log(`SUMMARY: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
