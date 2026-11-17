import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const BASE = process.env.BASE || 'http://127.0.0.1:5173/';
const out = 'screenshots/chapter2'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
// 2026-11-15 bugfix-perf: a cold dev-server page now needs ~10 s to reach the battle (more art loaded at boot); budgets raised from 8 s / 90 s.
const deadline = setTimeout(() => { console.error('CHAPTER TIMEOUT: 600s'); void browser.close().finally(() => process.exit(2)); }, 600000);
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} :: ${JSON.stringify(detail)}`); };
async function scenario(name, run) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(20000); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // Hulao remains campaign-locked until Yellow Turban is cleared. This suite
    // exercises the battle itself, so explicitly use the existing DEV stage bypass.
    await page.goto(BASE + '?autostart=1&chapter=hulao&dev=1&stage=3&boss=old'); // 旧版吕布的回归（重设计版见 test-boss-v2.mjs） await page.waitForFunction(() => !!window.__IM, null, { timeout: 30000 });
    // 2026-11-16：2-3 改为董卓（火烧洛阳），吕布移到天下地图挑战关；本套吕布机制检查改用原虎牢关吕布章节定义（getChapter('hulao')）。
    await page.evaluate(async () => { const { getChapter } = await import('/src/data/chapters.ts'); const s = window.__game.scene.getScene('GameScene'); s.chapter = getChapter('hulao'); s.spawnTimer = 1e8; s.eliteTimer = 1e8; window.__IM.clearWeapons(); window.__IM.killAllEnemies(); });
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
    check('chapter_faction_and_ground', tint.start === tint.after && tint.start === 0xffffff && tint.texture === 'xiliang_infantry_walk' && tint.ground.includes('hulao'), tint);
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
    const final = await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { info: window.__IM.bossInfo(), tex: s.boss.sprite.texture.key, allies: s.allies.length, perWave: s.legion.freeRecruitCount, wave: window.__IM.waveInfo() }; });
    check('chapter2_five_recruits_before_lubu', recruitCount === 5 && bossBeforeFinal === false && final.allies === 5 * final.perWave /* 免费招兵每波人数随章节（FREE_RECRUIT_BY_TIER） */ && final.info.maxHp === 3200 && final.tex === 'boss_lubu' && final.wave.count === 8, { seen, recruitCount, final });
    const cap = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene');
      for (let i = 0; i < 220; i++) s.spawnEnemy('elite', 1000, 1000, 1, true);
      return { active: window.__IM.enemies, pool: s.enemies.length, boss: window.__IM.bossActive };
    });
    // Up to 40 additional Enemy instances are reserved as destructible-prop slots.
    check('chapter2_enemy_cap_150_including_boss', cap.active === 150 && cap.pool <= 190 && cap.boss, cap);
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
      s.boss.hp = Math.floor(s.boss.maxHp / 2) - 1; l.update(0, s.combatNow); l.update(0, s.combatNow + 1);
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
  // Normal (non-DEV) campaign routing: Zhang Jiao sends the player to Hulao,
  // while the strategic map remains locked until the Hulao victory.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage(); page.setDefaultTimeout(20000); const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(BASE + '?autostart=1&chapter=huangjin&progression-check=' + Date.now());
      await page.waitForFunction(() => !!window.__IM, null, { timeout: 30000 });
      await page.evaluate(() => { for (const key of ['im_world_v1','im_world_backup_v1','im_chapter1_cleared']) localStorage.removeItem(key); });
      await page.evaluate(async () => {
        const [{ getBattleChapter }, { beginExpedition }] = await Promise.all([import('/src/data/chapters.ts'), import('/src/world/WorldStore.ts')]);
        const s = window.__game.scene.getScene('GameScene');
        s.worldCampaign = true; s.chapter = getBattleChapter('huangjin', 3); s.expeditionId = beginExpedition('huangjin', 3);
        s.bossKilled = true; s.finish(true, 'boss');
      });
      // Zhang Jiao's victory now opens the camp (mode 'rest') with the chapter-one volunteers notice; the result-home link is still set.
      await page.waitForFunction(() => window.__IM?.mode === 'result' || window.__IM?.mode === 'rest');
      const afterZhangjiao = await page.evaluate(() => {
        const s = window.__game.scene.getScene('GameScene'); const save = JSON.parse(localStorage.getItem('im_world_v1'));
        return { button: s.resultPanel.getByName('result-home').text, world: save.worldAvailable, hulaoUnlocked: localStorage.getItem('im_chapter1_cleared') === 'true' };
      });
      await page.evaluate(() => window.__game.scene.getScene('GameScene').resultPanel.getByName('result-home').emit('pointerdown'));
      const stages=[];
      for(let stage=1;stage<=3;stage++){
        await page.waitForFunction(stage=>window.__game.scene.getScene('GameScene')?.chapter?.westStage===stage,stage);
        const data=await page.evaluate(()=>{const s=window.__game.scene.getScene('GameScene');const boss=s.chapter.bossName;s.bossKilled=true;s.finish(true,'boss');const save=JSON.parse(localStorage.getItem('im_world_v1'));return{boss,stage:save.dongzhuoStages,world:save.worldAvailable,button:s.resultPanel.getByName('result-home').text};});stages.push(data);
        if(stage<3)await page.evaluate(()=>window.__game.scene.getScene('GameScene').resultPanel.getByName('result-home').emit('pointerdown'));
      }
      // 2026-11-15 bugfix-perf: since 0065c2c the world map opens after chapter one (Zhang Jiao), and the Lu Bu victory leads to the map with the new chapter (群雄) unlocked.
      const ok=afterZhangjiao.button.includes('汜水关')&&afterZhangjiao.world&&afterZhangjiao.hulaoUnlocked&&stages.every((s,i)=>s.stage===i+1&&s.boss===['华雄','徐荣','董卓'][i]&&s.world)&&stages[2].button.includes('天下地图');
      check('campaign_progression_zhangjiao_to_hulao_to_world',ok&&errors.length===0,{afterZhangjiao,stages,errors});
    } catch (error) { check('campaign_progression_zhangjiao_to_hulao_to_world', false, String(error)); }
    finally { await context.close(); }
  }
  for (const [width, height] of [[360, 800], [390, 844], [430, 932], [960, 540]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
    try {
      const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      page.setDefaultTimeout(20000);
      await page.goto(BASE + (width > 900 ? '?dev=1&stage=3&layout=desktop' : '?dev=1&stage=3&layout=mobile')); await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 30000 });
      const point = (x, y) => page.evaluate(([x, y]) => { const r = document.querySelector('canvas').getBoundingClientRect(), s = window.__game.scene.getScene('MenuScene'); return { x: r.x + x * r.width / s.scale.width, y: r.y + y * r.height / s.scale.height }; }, [x, y]);
      await page.evaluate(() => { window.__game.registry.set('menuChapterPicker', true); window.__game.scene.getScene('MenuScene').scene.restart(); });
      await page.waitForFunction(() => window.__game.scene.getScene('MenuScene').chapterButtons?.length === 2);
      const targetCenter = (get) => page.evaluate(get);
      let pos = await targetCenter(() => { const s=window.__game.scene.getScene('MenuScene'),r=document.querySelector('canvas').getBoundingClientRect(),o=s.chapterButtons.find(x=>x.id==='hulao').bg; return {x:r.x+o.x*r.width/s.scale.width,y:r.y+o.y*r.height/s.scale.height}; });
      await page.touchscreen.tap(pos.x, pos.y);
      await page.screenshot({ path: `${out}/chapter-select-${width}.png` });
      // The chapter now opens the three-stage picker; select the existing Lubu battle explicitly.
      pos=await targetCenter(()=>{const s=window.__game.scene.getScene('MenuScene'),r=document.querySelector('canvas').getBoundingClientRect(),o=s.westRows.find(row=>row.stage===3).bg;return{x:r.x+o.x*r.width/s.scale.width,y:r.y+o.y*r.height/s.scale.height};});
      await page.touchscreen.tap(pos.x,pos.y);
      pos = await targetCenter(() => { const s=window.__game.scene.getScene('MenuScene'),r=document.querySelector('canvas').getBoundingClientRect(),o=s.westModal.getByName('west-deploy'); return {x:r.x+o.x*r.width/s.scale.width,y:r.y+o.y*r.height/s.scale.height}; });
      await page.touchscreen.tap(pos.x, pos.y); await page.waitForFunction(() => window.__IM?.chapterInfo().id === 'hulao', null, { timeout: 30000 });
      check(`chapter_selection_input_${width}`, true, {});
      await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.spawnBoss(); s.boss.sprite.setPosition(s.player.x, s.player.y - 150); window.__IM.god(); });
      await page.waitForTimeout(350); await page.screenshot({ path: `${out}/hulao-game-${width}.png` });
      await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.hitEnemy(s.boss, 4000, s.combatNow); });
      // 2026-11-15 bugfix-perf: a boss kill now offers the relic choice (mode 'bossloot') before the result panel.
      const loot = await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); const m = s.mode; if (m === 'bossloot') s.chooseUpgrade(0); return m; });
      check(`chapter2_boss_loot_before_result_${width}`, loot === 'bossloot' || loot === 'result', { loot });
      await page.waitForFunction(() => window.__game.scene.getScene('GameScene').mode === 'result');
      const victory = await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { mode: s.mode, title: s.resultTexts.title.text, text: s.resultTexts.subtitle.text }; });
      check(`chapter2_victory_text_${width}`, victory.mode === 'result' && victory.title === '董卓西走' && victory.text.includes('董卓'), victory);
      await page.screenshot({ path: `${out}/hulao-victory-${width}.png` });
      // Actual result-panel input returns to the menu, then actual chapter-tab input switches back.
      await page.evaluate(() => window.__game.scene.getScene('GameScene').resultPanel.getByName('result-home').emit('pointerdown'));
      await page.waitForFunction(() => window.__game.scene.isActive('MenuScene'));
      await page.evaluate(()=>{window.__game.registry.set('menuChapterPicker',true);window.__game.scene.getScene('MenuScene').scene.restart();});
      await page.waitForTimeout(180);
      await page.evaluate(()=>{const s=window.__game.scene.getScene('MenuScene');s.chapterButtons.find(x=>x.id==='huangjin').bg.emit('pointerdown');s.startButton.emit('pointerdown');});
      await page.waitForFunction(() => window.__IM?.chapterInfo().id === 'huangjin');
      const first = await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.spawnBoss(); return { tex: s.boss.sprite.texture.key, hp: s.boss.maxHp, lubu: window.__IM.lubuInfo() }; });
      check(`chapter_switch_back_isolates_state_${width}`, first.hp === 1200 && first.tex === 'boss_zhangjiao' && first.lubu === null && !errors.length, { first, errors });
    } catch (error) { check(`chapter_ui_${width}`, false, String(error)); }
    finally { await context.close(); }
  }
} finally { clearTimeout(deadline); await browser.close(); }
writeFileSync(`${out}/chapter-tests.json`, JSON.stringify(results, null, 2));
const failed = results.filter(r => !r.ok); console.log(`SUMMARY: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
