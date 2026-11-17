// 新手引导冒烟：第一次进 1-1 按顺序出 ① 移动 → ② 自动攻击 → ③ 拾取军功 → ④ 升级三选一（插入）→ ⑤ 战斗支援（插入）→ ⑥ 出击
// → ⑦ 首领 / 捡宝箱 → ⑧ 行营（建筑 / 行囊 / 出征）；看完存档记标记、再进 1-1 不再出现；设置「重看新手引导」后重新出现、「跳过引导」可跳过。
// 不带 ?dev=1（走正式的存档标记逻辑）。每步 1280×720 截图到 assets/review/tutorial/。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-tutorial.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/tutorial';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const ev = (fn, arg) => p.evaluate(([S0, f, a]) => eval('(' + f + ')')(eval(S0), a), [S, String(fn), arg]);
  const tut = () => ev(s => s.tutorial ? s.tutorial.snapshot() : null);
  const until = async (pred, ms = 15000, each) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { if (each) await ev(each); v = await tut(); if (pred(v)) return v; await p.waitForTimeout(150); } return v; };
  const shot = n => p.screenshot({ path: `${OUT}/${n}.png` });
  const start11 = async () => {
    await p.evaluate(() => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 1 }); const cur = g.scene.getScene('GameScene'); if (cur && g.scene.isActive('GameScene')) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); } });
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await p.waitForTimeout(800);
  };
  await p.goto(BASE + '?layout=desktop');
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await start11();
  let t = await tut();
  await shot('1-move');
  ck('① 首次进 1-1：引导出现，第一步「移动」+ WASD 按键图标', t?.step === 'move' && t.line === '移动' && await ev(s => s.children.list.some(o => o.name === 'tutorial-overlay' && o.list.filter(c => c.name === 'tutorial-key').length === 4)), t);
  ck('开局 30 秒刷兵放缓', await ev(s => s.tutorial.easy(5).interval > 1 && s.tutorial.easy(31).interval === 1), null);
  // 走 2.5 秒
  t = await until(v => v.step === 'attack' && v.shown, 8000, s => { s.player.damageImmune = true; s.player.sprite.x += 6; });
  await shot('2-attack');
  ck('② 移动 2 秒后 →「武将自动攻击」', t?.step === 'attack' && t.line.includes('自动攻击'), t);
  t = await until(v => v.step === 'gem' && v.shown, 10000, s => { s.player.damageImmune = true; const e = s.enemies.find(e => e.active && !e.isSupplySlot && e.kind !== 'boss'); if (e) s.hitEnemy(e, 9999, s.combatNow, 'melee', false, false); else s.spawnEnemy('infantry', s.player.x + 60, s.player.y, 1, true); });
  await shot('3-gem');
  ck('③ 杀敌后 →「拾取军功」', t?.step === 'gem' && t.line.includes('军功'), t);
  // 捡宝石（走到掉落处）
  t = await until(v => v.step === 'sortie' || v.interrupt === 'levelup', 10000, s => { const g = s.gems.find(g => g.active); if (g) { s.player.sprite.x = g.img.x; s.player.sprite.y = g.img.y; } else { const e = s.spawnEnemy('infantry', s.player.x + 40, s.player.y, 1, true); if (e) s.hitEnemy(e, 9999, s.combatNow, 'melee', false, false); } });
  ck('③ 捡到军功 → 下一步', t && (t.step === 'sortie' || t.interrupt === 'levelup'), t);
  // ④ 升级三选一（插入）
  await ev(s => { if (s.mode === 'none') { const need = Math.max(1, (s.player.xpNext ?? 10) - s.player.xp); const g = s.player.gainXp(need, 99); if (g > 0) s.onHeroLevelUp(g); } });
  t = await until(v => v.interrupt === 'levelup', 5000);
  await p.waitForTimeout(400); await shot('4-levelup');
  ck('④ 首次升级三选一：插入「升级：三选一」+ 指向卡片', t?.interrupt === 'levelup' && t.line.includes('三选一') && await ev(s => s.children.list.some(o => o.name === 'tutorial-overlay' && o.list.some(c => c.name === 'tutorial-arrow' && c.visible))), t);
  for (let i = 0; i < 20 && (await ev(s => s.mode)) === 'levelup'; i++) { await ev(s => (s.mode === 'levelup' ? s.chooseUpgrade(0) : s.mode === 'recruit' ? (s.recruitedWaves.add(s.waveIndex), s.freeRecruit = false, s.pendingRecruit = false, s.resumePendingChoices()) : 0)); await p.waitForTimeout(200); }
  t = await until(v => !v.interrupt && v.shown, 4000);
  ck('④ 选完回到主线', !t.interrupt && t.seen.includes('levelup'), t);
  // ⑤ 战斗支援（插入）
  await ev(s => { s.waveIndex = Math.max(1, s.waveIndex); s.recruitedWaves?.clear?.(); s.openRecruit(); });
  t = await until(v => v.interrupt === 'recruit', 5000);
  await p.waitForTimeout(300); await shot('5-recruit');
  ck('⑤ 首次战斗支援：插入「战斗支援：选一队兵」', t?.interrupt === 'recruit' && t.line.includes('战斗支援'), t);
  await ev(s => { s.buyTroops('swordsman', false); if (s.mode === 'recruit') (s.mode === 'levelup' ? s.chooseUpgrade(0) : s.mode === 'recruit' ? (s.recruitedWaves.add(s.waveIndex), s.freeRecruit = false, s.pendingRecruit = false, s.resumePendingChoices()) : 0); });
  t = await until(v => v.step === 'sortie' && v.shown && !v.interrupt, 6000);
  await p.waitForTimeout(300); await shot('6-sortie');
  ck('⑥ 有了部曲 →「部曲出击 / 护阵」+ E 键', t?.step === 'sortie' && t.line.includes('出击') && await ev(s => s.legion.count > 0), t);
  await ev(s => s.legion.cycleOrder());
  t = await until(v => v.step === 'boss', 6000);
  ck('⑥ 按出击 → 进入首领步骤（等首领出阵）', t?.step === 'boss', t);
  // ⑦ 首领
  await ev(s => { s.devTimeScale = 3; s.devSetTime?.(999); });
  t = await until(v => v.step === 'boss' && v.shown, 30000, s => { (s.mode === 'levelup' ? s.chooseUpgrade(0) : s.mode === 'recruit' ? (s.recruitedWaves.add(s.waveIndex), s.freeRecruit = false, s.pendingRecruit = false, s.resumePendingChoices()) : 0); s.player.damageImmune = true; });
  await p.waitForTimeout(2500); await shot('7-boss');
  ck('⑦ 首领出阵 →「首领出阵，击败他」', t?.shown && t.line.includes('首领'), t);
  t = await until(v => v.step === 'chest' && v.shown, 30000, s => { (s.mode === 'levelup' ? s.chooseUpgrade(0) : s.mode === 'recruit' ? (s.recruitedWaves.add(s.waveIndex), s.freeRecruit = false, s.pendingRecruit = false, s.resumePendingChoices()) : 0); if (s.boss?.active) { s.boss.hp -= s.boss.maxHp * .05; if (s.boss.hp <= 0) s.hitEnemy(s.boss, 10, s.combatNow, 'melee', false, false); } });
  await p.waitForTimeout(400); await shot('7-chest'); console.log('chest-arrow', JSON.stringify((await tut()).arrow), JSON.stringify(await ev(s => s.bossChests.map(c => ({ x: Math.round(c.x), y: Math.round(c.y), r: c.ready, d: c.done, px: Math.round(s.player.x), py: Math.round(s.player.y), wv: [Math.round(s.cameras.main.worldView.x), Math.round(s.cameras.main.worldView.y), s.cameras.main.zoom] })))));
  ck('⑦ 首领倒地 →「走过去捡宝箱」+ 指向宝箱', t?.step === 'chest' && t.line.includes('宝箱') && await ev(s => s.children.list.some(o => o.name === 'tutorial-overlay' && o.list.some(c => c.name === 'tutorial-arrow' && c.visible))), t);
  t = await until(v => v.step === 'camp' && v.shown, 30000, s => { (s.mode === 'levelup' ? s.chooseUpgrade(0) : s.mode === 'recruit' ? (s.recruitedWaves.add(s.waveIndex), s.freeRecruit = false, s.pendingRecruit = false, s.resumePendingChoices()) : 0); const c = s.bossChests.find(c => !c.done && c.ready); if (c) { const dx = c.x - s.player.x, dy = c.y - s.player.y, d = Math.hypot(dx, dy) || 1; s.player.sprite.x += dx / d * Math.min(d, 20); s.player.sprite.y += dy / d * Math.min(d, 20); } });
  await p.waitForTimeout(400); await shot('8-camp');
  ck('⑧ 告捷进行营 →「营中建筑」指向页签', t?.step === 'camp' && t.line.includes('营中建筑'), t);
  t = await until(v => v.step === 'bag' && v.shown, 10000);
  await shot('8-bag');
  ck('⑧ →「行囊里换兵装」', t?.step === 'bag' && t.line.includes('行囊'), t);
  t = await until(v => v.step === 'depart' && v.shown, 10000);
  await shot('8-depart');
  ck('⑧ →「率军出征」', t?.step === 'depart' && t.line.includes('出征'), t);
  await ev(s => { const d = (() => { let hit = null; const walk = l => { for (const o of l) { if (o.name === 'camp-depart') hit = o; if (o.list) walk(o.list); } }; walk(s.children.list); return hit; })(); d?.emit('pointerdown'); d?.emit('pointerup'); });
  await p.waitForTimeout(2500);
  const flag = await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).tutorialSeen());
  ck('出征 → 引导完成，存档记标记', flag === true, { flag, t: await tut() });
  // 再进 1-1：不再出现
  await start11();
  ck('再进 1-1：不再出现引导', (await tut()) === null, await tut());
  // 设置里「重看新手引导」
  await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('MenuScene'); });
  await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 60000 }); await p.waitForTimeout(800);
  await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); m.children.getByName('home-settings')?.emit('pointerdown'); });
  await p.waitForTimeout(600);
  const link = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); let hit = null; const walk = l => { for (const o of l) { if (o.name === 'settings-tutorial-replay') hit = o; if (o.list) walk(o.list); } }; walk(m.children.list); if (!hit) return null; const before = hit.text; hit.emit('pointerdown'); return { before, after: hit.text }; });
  await shot('9-settings-replay');
  const flag2 = await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).tutorialSeen());
  ck('设置「重看新手引导」→ 标记清掉', link && flag2 === false, { link, flag2 });
  await start11();
  t = await tut();
  ck('重看：再进 1-1 引导重新出现', t?.step === 'move', t);
  await ev(s => { let hit = null; const walk = l => { for (const o of l) { if (o.name === 'tutorial-skip') hit = o; if (o.list) walk(o.list); } }; walk(s.children.list); hit?.emit('pointerdown'); });
  await p.waitForTimeout(400);
  t = await tut();
  const flag3 = await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).tutorialSeen());
  ck('「跳过引导」→ 收起、记标记、刷兵恢复正常', t?.finished && t.skipped && flag3 === true && await ev(s => s.tutorial.easy(5).interval === 1), { t, flag3 });
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
