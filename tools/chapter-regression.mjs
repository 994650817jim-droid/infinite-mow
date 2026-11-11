import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const BASE = 'http://127.0.0.1:5173/';
const out = 'screenshots/chapter2'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const deadline = setTimeout(() => { console.error('CHAPTER TIMEOUT: 90s'); void browser.close().finally(() => process.exit(2)); }, 90000);
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} :: ${JSON.stringify(detail)}`); };
async function scenario(name, run) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(8000); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE + '?autostart=1&chapter=hulao'); await page.waitForFunction(() => !!window.__IM);
    await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.spawnTimer = 1e8; s.eliteTimer = 1e8; window.__IM.clearWeapons(); window.__IM.killAllEnemies(); });
    await run(page); check(name + '_no_pageerror', !errors.length, errors);
  } catch (error) { check(name, false, String(error)); }
  finally { await context.close(); }
}
try {
  await scenario('chapter_data', async page => {
    const data = await page.evaluate(async () => {
      const { CHAPTERS, getChapter, chapterBossTime } = await import('/src/data/chapters.ts');
      const { waveIndexAt } = await import('/src/data/waves.ts');
      return { chapters: CHAPTERS.map(c => ({ id: c.id, waves: c.waves.length, boss: c.bossName, hp: c.enemies.boss.hp, start: chapterBossTime(c), recruits: c.recruitWaves.length, boundaries: c.waves.every((w, i) => waveIndexAt(w.start, c.waves) === i && (i === 0 || waveIndexAt(w.start - .001, c.waves) === i - 1)) })), fallback: getChapter('bad').id, active: window.__IM.chapterInfo().id };
    });
    check('chapter_definitions_and_boundaries', data.chapters[0].waves === 6 && data.chapters[0].hp === 2400 && data.chapters[1].waves === 8 && data.chapters[1].hp === 3200 && data.chapters.every(c => c.boundaries && c.recruits === 5) && data.active === 'hulao' && data.fallback === 'huangjin', data);
    const tint = await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.setMode('pause'); const e = s.spawnEnemy('infantry', 100, 0, 1); const start = e.sprite.tintTopLeft; e.flash(s.combatNow); e.updateVisual(s.combatNow + 100); return { start, after: e.sprite.tintTopLeft, ground: s.ground.displayTexture.key, texture: e.sprite.texture.key }; });
    check('chapter_faction_and_ground', tint.start === tint.after && tint.start === 0xffffff && tint.texture === 'xiliang_infantry_walk' && tint.ground === 'ground_hulao', tint);
  });
  await scenario('eight_wave_flow', async page => {
    await page.evaluate(() => window.__IM.god()); const seen = []; let recruitCount = 0, bossBeforeFinal;
    for (let i = 1; i < 8; i++) {
      await page.evaluate(i => window.__IM.setTime(i * 45 + .1), i);
      await page.waitForFunction(i => window.__IM.waveInfo().index === i, i);
      const state = await page.evaluate(() => ({ mode: window.__IM.mode, boss: window.__IM.bossActive }));
      seen.push({ i, ...state });
      if (state.mode === 'recruit') { recruitCount++; if (i === 7) bossBeforeFinal = state.boss; await page.evaluate(() => window.__IM.chooseRecruit(0)); }
    }
    await page.waitForFunction(() => window.__IM.bossActive);
    const final = await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { info: window.__IM.bossInfo(), tex: s.boss.sprite.texture.key, allies: s.allies.length, wave: window.__IM.waveInfo() }; });
    check('chapter2_five_recruits_before_lubu', recruitCount === 5 && bossBeforeFinal === false && final.allies === 5 && final.info.maxHp === 3200 && final.tex === 'boss_lubu' && final.wave.count === 8, { seen, recruitCount, final });
    const cap = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene');
      for (let i = 0; i < 220; i++) s.spawnEnemy('elite', 1000, 1000, 1, true);
      return { active: window.__IM.enemies, pool: s.enemies.length, boss: window.__IM.bossActive };
    });
    check('chapter2_enemy_cap_150_including_boss', cap.active === 150 && cap.pool <= 150 && cap.boss, cap);
    await page.evaluate(() => window.__IM.setTime(1000)); await page.waitForTimeout(100);
    check('chapter2_boss_endless', await page.evaluate(() => window.__IM.mode !== 'result' && window.__IM.bossActive), {});
    await page.evaluate(() => window.__IM.restart()); await page.waitForTimeout(150);
    const reset = await page.evaluate(() => ({ chapter: window.__IM.chapterInfo().id, boss: window.__IM.bossActive, lubu: window.__IM.lubuInfo(), allies: window.__IM.allyInfo().length, elapsed: window.__IM.elapsed }));
    check('chapter2_restart_clean', reset.chapter === 'hulao' && !reset.boss && reset.lubu === null && reset.allies === 0 && reset.elapsed < 1, reset);
  });
  await scenario('lubu_sweep', async page => {
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene'); s.spawnBoss(); s.setMode('pause'); s.boss.sprite.setPosition(0, 0); s.player.sprite.setPosition(100, 0); s.player.stats.regen = 0; s.player.hp = 100; s.player.invulnUntil = 0;
      const l = s.lubu, t = s.combatNow; l.sweepCd = 0; l.update(0, t); const warning = l.snapshot();
      l.update(.016, t + 649); const before = s.player.hp;
      l.update(.016, t + 650); const after = s.player.hp;
      s.player.invulnUntil = 0; l.update(.016, t + 700); const repeated = s.player.hp;
      l.update(0, t + 830); const recovery = l.state;
      return { warning, before, after, repeated, recovery };
    });
    check('lubu_sweep_warns_before_damage', r.warning.state === 'sweepWindup' && r.before === 100 && r.after === 76, r);
    check('lubu_sweep_single_hit_and_recovery', r.repeated === 76 && r.recovery === 'recover', r);
  });
  await scenario('lubu_dodge', async page => {
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene'); s.spawnBoss(); s.setMode('pause'); s.boss.sprite.setPosition(0, 0); s.player.sprite.setPosition(100, 0); s.player.hp = 100; s.player.invulnUntil = 0;
      const l = s.lubu, t = s.combatNow; l.sweepCd = 0; l.update(0, t); s.player.sprite.setPosition(-100, 0); l.update(.016, t + 650);
      return { hp: s.player.hp, state: l.state };
    });
    check('lubu_sweep_locked_direction_dodge', r.hp === 100 && r.state === 'sweep', r);
  });
  await scenario('lubu_dash', async page => {
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene'); s.spawnBoss(); s.setMode('pause'); s.boss.sprite.setPosition(0, 0); s.player.sprite.setPosition(220, 0); s.player.hp = 100; s.player.invulnUntil = 0;
      const l = s.lubu, t = s.combatNow; l.dashCd = 0; l.update(0, t); const warning = l.state;
      l.update(.016, t + 849); const before = s.player.hp;
      l.update(.016, t + 850); s.player.sprite.setPosition(120, 0);
      for (let i = 1; i <= 12; i++) { s.player.invulnUntil = 0; l.update(.05, t + 850 + i * 50); }
      return { warning, before, hp: s.player.hp, state: l.state, x: s.boss.x, y: s.boss.y, hit: l.snapshot().hitApplied };
    });
    check('lubu_dash_warns_and_sweeps_collision', r.warning === 'dashWindup' && r.before === 100 && r.hp === 82 && r.hit, r);
    check('lubu_dash_fixed_distance_recovery', Math.abs(r.x - 300) < .01 && r.y === 0 && r.state === 'recover', r);
  });
  await scenario('lubu_dash_dodge', async page => {
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene'); s.spawnBoss(); s.setMode('pause'); s.boss.sprite.setPosition(0, 0); s.player.sprite.setPosition(220, 0); s.player.hp = 100; s.player.invulnUntil = 0;
      const l = s.lubu, t = s.combatNow; l.dashCd = 0; l.update(0, t); s.player.sprite.setPosition(220, 180); l.update(.016, t + 850);
      for (let i = 1; i <= 12; i++) l.update(.05, t + 850 + i * 50);
      return { hp: s.player.hp, x: s.boss.x, y: s.boss.y };
    });
    check('lubu_dash_locked_direction_dodge', r.hp === 100 && Math.abs(r.x - 300) < .01 && r.y === 0, r);
  });
  await scenario('lubu_enrage', async page => {
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene'); s.spawnBoss(); s.setMode('pause'); const l = s.lubu;
      let count = 0; const phase = l.host.onPhase2; l.host.onPhase2 = () => { count++; phase(); };
      s.boss.hp = 1599; l.update(0, s.combatNow); l.update(0, s.combatNow + 1);
      return { count, phase2: s.bossPhase2, shield: s.bossShield, bullets: s.bullets.length, ult: s.bossUltPhase };
    });
    check('lubu_enrage_once_without_zhangjiao_spells', r.count === 1 && r.phase2 && !r.shield && !r.bullets && r.ult === 'none', r);
  });
  await scenario('lubu_pause', async page => {
    const frozen = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene'); s.spawnBoss(); s.boss.sprite.setPosition(220, 0); s.player.stats.regen = 0;
      s.lubu.dashCd = 0; s.lubu.update(0, s.combatNow); s.togglePause();
      return { clock: s.combatNow, snapshot: s.lubu.snapshot() };
    });
    await page.waitForTimeout(950);
    const still = await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { clock: s.combatNow, snapshot: s.lubu.snapshot() }; });
    check('lubu_pause_freezes_warning', JSON.stringify(still) === JSON.stringify(frozen), { frozen, still });
    await page.evaluate(() => window.__game.scene.getScene('GameScene').togglePause());
    await page.waitForTimeout(100); const resumed = await page.evaluate(() => window.__IM.lubuInfo().state);
    check('lubu_pause_retains_remaining_warning', resumed === 'dashWindup', { resumed });
    await page.screenshot({ path: `${out}/lubu-dash-warning.png` });
  });
  for (const [width, height] of [[360, 800], [390, 844], [430, 932], [960, 540]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
    try {
      const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      page.setDefaultTimeout(8000);
      await page.goto(BASE + (width > 900 ? '?layout=desktop' : '?layout=mobile')); await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'));
      await page.keyboard.press('Enter');
      const point = (x, y) => page.evaluate(([x, y]) => { const r = document.querySelector('canvas').getBoundingClientRect(), s = window.__game.scene.getScene('MenuScene'); return { x: r.x + x * r.width / s.scale.width, y: r.y + y * r.height / s.scale.height }; }, [x, y]);
      let pos = await point(width > 900 ? 596 : 390, width > 900 ? 64 : 96);
      await page.touchscreen.tap(pos.x, pos.y);
      await page.screenshot({ path: `${out}/chapter-select-${width}.png` });
      await page.keyboard.press('Enter'); await page.waitForFunction(() => window.__IM?.chapterInfo().id === 'hulao');
      check(`chapter_selection_input_${width}`, true, {});
      await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.spawnBoss(); s.boss.sprite.setPosition(s.player.x, s.player.y - 150); window.__IM.god(); });
      await page.waitForTimeout(350); await page.screenshot({ path: `${out}/hulao-game-${width}.png` });
      await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.hitEnemy(s.boss, 4000, s.combatNow); });
      const victory = await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { mode: s.mode, title: s.resultTexts.title.text, text: s.resultTexts.subtitle.text }; });
      check(`chapter2_victory_text_${width}`, victory.mode === 'result' && victory.title === '威震虎牢' && victory.text.includes('吕布'), victory);
      await page.screenshot({ path: `${out}/hulao-victory-${width}.png` });
      // Actual result-panel input returns to the menu, then actual chapter-tab input switches back.
      pos = await point(width > 900 ? 480 : 270, width > 900 ? 522 : 802); await page.touchscreen.tap(pos.x, pos.y);
      await page.waitForFunction(() => window.__game.scene.isActive('MenuScene'));
      await page.keyboard.press('Enter');
      pos = await point(width > 900 ? 364 : 150, width > 900 ? 64 : 96); await page.touchscreen.tap(pos.x, pos.y);
      await page.keyboard.press('Enter'); await page.waitForFunction(() => window.__IM?.chapterInfo().id === 'huangjin');
      const first = await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.spawnBoss(); return { tex: s.boss.sprite.texture.key, hp: s.boss.maxHp, lubu: window.__IM.lubuInfo() }; });
      check(`chapter_switch_back_isolates_state_${width}`, first.hp === 2400 && first.tex === 'boss_zhangjiao' && first.lubu === null && !errors.length, { first, errors });
    } catch (error) { check(`chapter_ui_${width}`, false, String(error)); }
    finally { await context.close(); }
  }
} finally { clearTimeout(deadline); await browser.close(); }
writeFileSync(`${out}/chapter-tests.json`, JSON.stringify(results, null, 2));
const failed = results.filter(r => !r.ok); console.log(`SUMMARY: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
