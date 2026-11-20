// 新手引导冒烟（11-20 按关分课，chapter1-redesign.md v2）：1-1 ① 移动 → ② 自动攻击 → ③ 拾取经验 → ④ 升级三选一（插入）→ ⑤ 战场回血（插入）→ ⑥ 黄巾营寨（插入）
// → ⑦ 首领 / 捡宝箱 → ⑧ 行营出征 → 1-2 舆图课；看过的课不再出现；设置「重看新手引导」后重新出现、「跳过引导」可跳过。
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
  const start11 = async (stage = 1) => {
    await p.evaluate(stage => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage }); const cur = g.scene.getScene('GameScene'); if (cur && g.scene.isActive('GameScene')) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); } }, stage);
    await p.waitForFunction(([S0, st]) => { const s = eval(S0); return s?.player && s.scene.isActive() && (s.chapter?.stage ?? 1) === st; }, [S, stage], { timeout: 90000 }); await p.waitForTimeout(800);
  };
  await p.goto(BASE + '?layout=desktop');
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await start11();
  // 剧情（2026-11-17）：首次进 1-1 先播章头「桃园结义」与关前军情，读完后才开新手引导
  await p.waitForFunction(S0 => { const s = eval(S0); return s.children.list.some(o => o.name?.startsWith('story-huangjin')) || !!s.tutorial; }, S, { timeout: 15000 }).catch(() => {}); // 剧情卷轴偶尔晚于 800 毫秒才建
  const storyFirst = await ev(s => ({ scroll: !!s.children.list.find(o => o.name?.startsWith('story-huangjin')), tut: !!s.tutorial }));
  const readStory = async () => { for (let i = 0; i < 16; i++) { const more = await ev(s => { const c = s.children.list.find(o => o.name?.startsWith('story-') && o.type === 'Container'); const hit = c?.list.find(o => o.name?.endsWith('-next') || o.name === 'story-confirm'); hit?.emit('pointerup'); return !!c; }); if (!more) { await p.waitForTimeout(400); if (!await ev(s => !!s.children.list.find(o => o.name?.startsWith('story-') && o.type === 'Container'))) break; } await p.waitForTimeout(120); } };
  await readStory();
  await p.waitForTimeout(600);
  ck('首次进 1-1：先播剧情（章头 / 军情），引导等剧情读完才出现', storyFirst.scroll && !storyFirst.tut, storyFirst);
  let t = await tut();
  await shot('1-move');
  ck('① 首次进 1-1：引导出现，第一步「移动」+ WASD 按键图标', t?.step === 'move' && t.line === '移动' && await ev(s => s.children.list.some(o => o.name === 'tutorial-overlay' && o.list.filter(c => c.name === 'tutorial-key').length === 4)), t);
  // 面板打开（暂停）时收起，关上恢复（1-1 行囊未开放，改用暂停面板）
  await ev(s => s.togglePause()); await p.waitForTimeout(400);
  const vb = await ev(s => ({ vis: s.tutorial.overlay.visible, mode: s.mode }));
  ck('打开暂停面板时引导墨迹条与箭头收起', vb.mode === 'pause' && !vb.vis, vb);
  await ev(s => { if (s.mode === 'pause') s.togglePause(); }); await p.waitForTimeout(400);
  const vc = await ev(s => ({ vis: s.tutorial.overlay.visible, mode: s.mode }));
  ck('关上面板后引导恢复', vc.mode === 'none' && vc.vis, vc);
  ck('引导层压在面板之下', await ev(s => s.tutorial.overlay.root.depth < 1500), null);
  ck('引导在时旧的「WASD / 方向键移动」提示隐藏', await ev(s => s.hintText && !s.hintText.visible), null);
  ck('开局 30 秒刷兵放缓（只在 1-1）', await ev(s => s.tutorial.easy(5).interval > 1 && s.tutorial.easy(31).interval === 1), null);
  t = await until(v => v.step === 'attack' && v.shown, 8000, s => { s.player.damageImmune = true; s.player.sprite.x += 6; });
  await shot('2-attack');
  ck('② 移动 2 秒后 →「武将自动攻击」', t?.step === 'attack' && t.line.includes('自动攻击'), t);
  t = await until(v => v.step === 'gem' && v.shown, 10000, s => { s.player.damageImmune = true; const e = s.enemies.find(e => e.active && !e.isSupplySlot && e.kind !== 'boss'); if (e) s.hitEnemy(e, 9999, s.combatNow, 'melee', false, false); else s.spawnEnemy('infantry', s.player.x + 60, s.player.y, 1, true); });
  await shot('3-gem');
  ck('③ 杀敌后 →「拾取经验」', t?.step === 'gem' && t.line.includes('经验'), t);
  t = await until(v => v.step === 'boss' || v.interrupt === 'levelup', 10000, s => { const g = s.gems.find(g => g.active); if (g) { s.player.sprite.x = g.img.x; s.player.sprite.y = g.img.y; } else { const e = s.spawnEnemy('infantry', s.player.x + 40, s.player.y, 1, true); if (e) s.hitEnemy(e, 9999, s.combatNow, 'melee', false, false); } });
  ck('③ 捡到军功 → 下一步（主线等首领）', t && (t.step === 'boss' || t.interrupt === 'levelup'), t);
  const choose = s => (s.mode === 'levelup' ? s.chooseUpgrade(0) : 0);
  await ev(s => { if (s.mode === 'none') { const need = Math.max(1, (s.player.xpNext ?? 10) - s.player.xp); const g = s.player.gainXp(need, 99); if (g > 0) s.onHeroLevelUp(g); } });
  t = await until(v => v.interrupt === 'levelup', 5000);
  await p.waitForTimeout(400); await shot('4-levelup');
  ck('④ 首次升级三选一：插入「升级：三选一」+ 指向卡片', t?.interrupt === 'levelup' && t.line.includes('三选一') && await ev(s => s.children.list.some(o => o.name === 'tutorial-overlay' && o.list.some(c => c.name === 'tutorial-arrow' && c.visible))), t);
  for (let i = 0; i < 20 && (await ev(s => s.mode)) === 'levelup'; i++) { await ev(choose); await p.waitForTimeout(200); }
  t = await until(v => !v.interrupt, 4000);
  ck('④ 选完回到主线', !t.interrupt && t.seen.includes('levelup'), t);
  // ⑤ 战场回血（插入）：血 < 60%
  await ev(s => { s.player.hp = Math.round(s.player.maxHp * .4); });
  t = await until(v => v.interrupt === 'heal', 5000, s => { s.player.damageImmune = true; });
  await shot('5-heal');
  ck('⑤ 血 < 60% → 插入「生命不足：捡干粮、站到泉眼上回血」', t?.interrupt === 'heal' && t.line.includes('回血'), t);
  t = await until(v => !v.interrupt, 7000, s => { s.player.hp = s.player.maxHp; });
  // ⑥ 黄巾营寨（事件段，插入）
  await ev(s => { s.elapsed = 101; s.lastPickAt = -1e9; });
  t = await until(v => v.interrupt === 'tents', 6000, choose);
  await p.waitForTimeout(300); await shot('6-tents');
  ck('⑥ 事件段「黄巾营寨」→ 插入「打碎营帐和黄天军旗」', t?.interrupt === 'tents' && t.line.includes('营帐'), t);
  ck('1-1 不教部曲：部曲 1-2 才开放，战斗支援不弹', await ev(s => { s.openRecruit(); return s.mode !== 'recruit'; }), null);
  t = await until(v => !v.interrupt, 7000, choose);
  // ⑦ 首领
  await ev(s => { s.devTimeScale = 3; s.devSetTime?.(999); });
  t = await until(v => v.step === 'boss' && v.shown, 30000, s => { (s.mode === 'levelup' ? s.chooseUpgrade(0) : 0); s.player.damageImmune = true; });
  await p.waitForTimeout(2500); await shot('7-boss');
  ck('⑦ 首领出阵 →「首领出阵，击败他」', t?.shown && t.line.includes('首领'), t);
  for (let i = 0; i < 12; i++) { await ev(s => { if (s.mode === 'levelup') s.chooseUpgrade(0); }); await p.waitForTimeout(250); }
  const fade = await ev(s => ({ vis: s.tutorial.overlay.visible, step: s.tutorial.step, mode: s.mode, boss: !!s.boss?.active }));
  ck('⑦「首领出阵」提示 4 秒后自动淡出', fade.step === 'boss' && !fade.vis && fade.boss, fade);
  t = await until(v => v.step === 'chest' && v.shown, 30000, s => { (s.mode === 'levelup' ? s.chooseUpgrade(0) : 0); if (s.boss?.active) { s.boss.hp -= s.boss.maxHp * .05; if (s.boss.hp <= 0) s.hitEnemy(s.boss, 10, s.combatNow, 'melee', false, false); } });
  await p.waitForTimeout(400); await shot('7-chest');
  ck('⑦ 首领倒地 →「走过去捡宝箱」+ 指向宝箱', t?.step === 'chest' && t.line.includes('宝箱') && await ev(s => s.children.list.some(o => o.name === 'tutorial-overlay' && o.list.some(c => c.name === 'tutorial-arrow' && c.visible))), t);
  t = await until(v => v.step === 'depart' && v.shown, 30000, s => { (s.mode === 'levelup' ? s.chooseUpgrade(0) : 0); const c = s.bossChests.find(c => !c.done && c.ready); if (c) { const dx = c.x - s.player.x, dy = c.y - s.player.y, d = Math.hypot(dx, dy) || 1; s.player.sprite.x += dx / d * Math.min(d, 20); s.player.sprite.y += dy / d * Math.min(d, 20); } });
  await shot('8-depart');
  ck('⑧ 告捷进行营 →「率军出征」（营中建筑、行囊挪到第二章）', t?.step === 'depart' && t.line.includes('出征') && !t.seen.includes('camp') && !t.seen.includes('bag'), t);
  await ev(s => { const d = (() => { let hit = null; const walk = l => { for (const o of l) { if (o.name === 'camp-depart') hit = o; if (o.list) walk(o.list); } }; walk(s.children.list); return hit; })(); d?.emit('pointerdown'); d?.emit('pointerup'); });
  await p.waitForTimeout(2500);
  const after11 = await p.evaluate(async () => ({ flag: (await import('/src/world/WorldStore.ts')).tutorialSeen(), lessons: JSON.parse(localStorage.getItem('im_tut_lessons') ?? '[]') }));
  ck('出征 → 1-1 的课记下（第一章还没教完，总标记未记）', after11.flag === false && ['1-1:move', '1-1:boss', '1-1:depart', '1-1:heal', '1-1:tents'].every(k => after11.lessons.includes(k)), after11);
  // 1-2：舆图 M（0:20）——另开一页，存档 = 1-1 已平定、1-1 的课已看过
  {
    const q = await b.newPage({ viewport: { width: 1280, height: 720 } }); q.on('pageerror', e => errs.push(String(e)));
    const lessons = after11.lessons;
    await q.goto(BASE + '?layout=desktop');
    await q.evaluate(l => { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify({ version: 10, yellowStages: 1, cleared: { huangjin: false, hulao: false }, worldAvailable: false, buildings: { barracks: 1, farm: 1, clinic: 1 }, nodes: ['huangjin'] })); localStorage.setItem('im_tut_lessons', JSON.stringify(l)); }, lessons);
    await q.reload(); await q.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
    await q.evaluate(() => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 2 }); for (const sc of g.scene.getScenes(true)) sc.scene.stop(); g.scene.start('GameScene'); });
    const G = () => "window.__game.scene.getScene('GameScene')";
    await q.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.chapter?.stage === 2; }, G(), { timeout: 90000 });
    for (let k = 0; k < 40 && !(await q.evaluate(S0 => !!eval(S0).tutorial, G())); k++) { await q.evaluate(S0 => { const s = eval(S0), c = s.children.list.find(o => o.name?.startsWith('story-') && o.type === 'Container'); const hit = c?.list.find(o => o.name?.endsWith('-next') || o.name === 'story-confirm'); hit?.emit('pointerup'); }, G()); await q.waitForTimeout(250); }
    await q.evaluate(S0 => { eval(S0).elapsed = 21; }, G());
    let u = null; for (let k = 0; k < 40; k++) { u = await q.evaluate(S0 => { const s = eval(S0); if (s.mode === 'levelup') s.chooseUpgrade(0); return s.tutorial ? s.tutorial.snapshot() : null; }, G()); if (u?.step === 'atlas' && u.shown) break; await q.waitForTimeout(200); }
    await q.screenshot({ path: OUT + '/9-atlas-1-2.png' });
    ck('1-2：新课「展开舆图」+ M 键（1-1 的课不再出）', u?.stage === 2 && u.step === 'atlas' && u.line.includes('舆图') && !u.seen.includes('move'), u);
    await q.close();
  }
  // 再进 1-1：不再出现
  await start11();
  ck('再进 1-1：课都看过，不再出现引导', (await tut()) === null, await tut());
  // 设置里「重看新手引导」
  await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('MenuScene'); });
  await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 60000 }); await p.waitForTimeout(800);
  await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); m.children.getByName('home-settings')?.emit('pointerdown'); });
  await p.waitForTimeout(600);
  const link = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); let hit = null; const walk = l => { for (const o of l) { if (o.name === 'settings-tutorial-replay') hit = o; if (o.list) walk(o.list); } }; walk(m.children.list); if (!hit) return null; const before = hit.text; hit.emit('pointerdown'); return { before, after: hit.text }; });
  await shot('9-settings-replay');
  const flag2 = await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).tutorialSeen()), les2 = await p.evaluate(() => localStorage.getItem('im_tut_lessons'));
  ck('设置「重看新手引导」→ 标记与看过的课都清掉', link && flag2 === false && les2 === null, { link, flag2, les2 });
  await start11();
  t = await tut();
  ck('重看：再进 1-1 引导重新出现', t?.step === 'move', t);
  await ev(s => { let hit = null; const walk = l => { for (const o of l) { if (o.name === 'tutorial-skip') hit = o; if (o.list) walk(o.list); } }; walk(s.children.list); hit?.emit('pointerdown'); });
  await p.waitForTimeout(400);
  t = await tut();
  const flag3 = await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).tutorialSeen());
  ck('「跳过引导」→ 收起、记标记、刷兵恢复正常', t?.finished && t.skipped && flag3 === true && await ev(s => s.tutorial.easy(5).interval === 1), { t, flag3 });
  await p.waitForTimeout(300);
  ck('引导关掉后旧操作提示照常显示（开局 8 秒内）', await ev(s => s.elapsed < 8 ? s.hintText.visible : true), await ev(s => ({ el: s.elapsed, vis: s.hintText.visible })));
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
