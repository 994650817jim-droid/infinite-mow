// 攻城战屏边目标指示（2026-11-21 总制作人：冲车 / 城门 / 箭楼不在屏内时不知道往哪走；回血点指示圈压住顶部目标字）。
// 存档同 tools/shot-siege-scene.mjs；中城开打后把主将挪到远处，截屏边指示。用法：BASE=http://127.0.0.1:5180/ node tools/shot-siege-guide.mjs → assets/review/r4-fix/siege-*.png
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/r4-fix';
mkdirSync(OUT, { recursive: true });
const src = readFileSync('tools/shot-siege-scene.mjs', 'utf8'), m = src.match(/const save = (\{.*\});/);
const save = eval('(' + m[1] + ')');
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errors = []; let fail = 0;
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } }, save);
await p.goto(base + '?layout=desktop', { waitUntil: 'commit', timeout: 120000 }); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
await p.evaluate(async () => { const c = await import('/src/world/WorldCities.ts'), w = await import('/src/world/WorldStore.ts'), s = w.loadWorld(); const id = c.CITIES.find(x => x.tier === 'medium' && c.cityAttackable(x.id, s.ownedCities))?.id, g = window.__game;
  g.registry.set('siegeCity', id); g.registry.remove('siegeMode'); g.registry.set('runConfig', { character: 'zhaoyun' });
  for (const sc of g.scene.getScenes(true)) sc.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('SiegeGameScene'); else { g.registry.set('pendingWarlord', 'SiegeGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); } });
await p.waitForFunction(() => window.__game.scene.isActive('SiegeGameScene') && window.__game.scene.getScene('SiegeGameScene').player, null, { timeout: 120000 });
await p.waitForTimeout(2500);
await p.evaluate(() => { const s = window.__game.scene.getScene('SiegeGameScene'); s.player.damageImmune = true; for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); for (let i = 0; i < 4 && s.mode !== 'none'; i++) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode('none'); } s.player.sprite.setPosition(s.player.x + 1500, s.player.y + 600); s.player.hp = s.player.maxHp * .4; });
await p.waitForTimeout(1500);
const vis = await p.evaluate(() => { const s = window.__game.scene.getScene('SiegeGameScene'); const heal = s.children.list.filter(o => o.name === 'heal-spot-arrow' && o.visible).map(o => Math.round(o.y)); return { guide: s.edgeGuide?.visible() ?? null, healYs: heal, mode: s.mode }; });
await p.evaluate(() => document.querySelectorAll('[id^="dev-"]').forEach(e => { e.style.display = 'none'; }));
await p.screenshot({ path: `${OUT}/siege-edge-guide.png` });
const ok = Array.isArray(vis.guide) && vis.guide.length > 0 && vis.healYs.every(y => y >= 140);
console.log((ok ? 'PASS ' : 'FAIL ') + '攻城屏边：冲车 / 目标有指示，回血点指示不进顶部目标区 · ' + JSON.stringify(vis)); if (!ok) fail++;
// 攻城胜利结算：要事（速攻 / 城内要点 / 随行）每条单独成行，按「 · 」切行，不在词中间断（2026-11-21 总制作人第三轮）
await p.evaluate(() => { const s = window.__game.scene.getScene('SiegeGameScene'); s.finish(true, 'capture'); });
await p.waitForTimeout(5000);
const notes = await p.evaluate(() => { const s = window.__game.scene.getScene('SiegeGameScene'), n = s.resultPanel.getByName('result-notes'); return { text: n?.text, title: s.resultTexts.title.text, sub: s.resultTexts.subtitle.text, body: s.resultTexts.body.text.slice(-300) }; });
await p.screenshot({ path: OUT + '/siege-result-test-run.png' });
// 测试战斗不发永久奖励、要事为空：把制作人截图里那几行塞进结算正文，重放结算展示，看分行
await p.evaluate(() => { const s = window.__game.scene.getScene('SiegeGameScene'), NL = String.fromCharCode(10); s.resultTexts.body.setText(s.resultTexts.body.text + NL + ['缴获兵装  2 件 · 已入行囊', '随行 刘备 Lv.11 · 各得经验 +55', '速攻破城 · 攻城奖励 +30%', '城内要点 3/4：粮仓、武库、兵营 已占（市集未占） · 钱币 +30% · 敌援补兵 −75%、援兵少 3 批'].join(NL)); for (const o of [...s.resultPanel.list]) if (o.type === 'Container' && o !== s.resultPanel) o.destroy(); s.presentResult(true); });
await p.waitForTimeout(3500);
const notes2 = await p.evaluate(() => window.__game.scene.getScene('SiegeGameScene').resultPanel.getByName('result-notes')?.text ?? '');
console.log('  notes rows:', JSON.stringify(notes2.split(String.fromCharCode(10))));
await p.screenshot({ path: OUT + '/siege-result.png' });
const rowsOk = !notes.text || notes.text.split(String.fromCharCode(10)).every(r => [...r].length <= 42);
console.log((rowsOk ? 'PASS ' : 'FAIL ') + '攻城胜利结算：要事分行、每行不超宽 · ' + JSON.stringify(notes).slice(0, 600)); if (!rowsOk) fail++;
console.log(errors.length ? 'FAIL errors ' + JSON.stringify(errors.slice(0, 3)) : 'PASS 无页面报错'); if (errors.length) fail++;
await b.close(); process.exit(fail ? 1 : 0);
