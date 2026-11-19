// 血量跨关继承 + 行营休整「军医」（用户 2026-11-18：「关于前一关收到的伤害血量会继承到下一关，休整加个军医，军医可以花费军粮治疗，可以画个军医治疗立绘」）。电脑布局。
//  ① 1-1 打赢进休整：主将 / 部曲不再自动回满
//  ② 军医页签：显示主将血量、三档治疗；小治扣粮回 25%、大治回满、为全军疗伤（部曲回满）
//  ③ 主将满血：小治 / 大治按钮置灰、显示「将军无恙」；粮不够：按钮置灰、「随军粮不足」、点了不扣粮不回血
//  ④ 率军出征 → 1-2 开局：主将血量 = 出征时的血量（继承）；部曲血量继承
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-camp-medic.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/camp-medic';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
  await p.goto(BASE + '?dev=1&layout=desktop&story=off');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 1 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
  await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await p.waitForTimeout(1200);
  // 带 4 名刀盾兵；主将打到 40% 血、部曲各掉一半血，然后直接赢下本关进休整
  await ev(s => { s.legion.recruit('swordsman', 4, true); s.player.hp = Math.round(s.player.maxHp * .4); for (const u of s.legion.units) if (u.active) u.hp = Math.round(u.maxHp * .5); s.legion.food = 200; s.spawnBoss(); s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); });
  for (let i = 0; i < 120 && !(await ev(s => s.mode === 'rest')); i++) { await ev(s => { if (s.mode === 'levelup') s.chooseUpgrade?.(0); if (s.mode === 'bossloot' || s.mode === 'levelup') s.__DEV_ACTIONS?.closePopup?.(); const c = s.bossChests?.find(c => !c.done && c.ready); if (c) { s.player.sprite.x = c.x; s.player.sprite.y = c.y; } }); await p.waitForTimeout(200); }
  const rest = await ev(s => ({ mode: s.mode, hp: Math.round(s.player.hp), max: s.player.maxHp, units: s.legion.units.filter(u => u.active).map(u => Math.round(u.hp / u.maxHp * 100)) }));
  ck('打赢 1-1 进休整：主将与部曲不再自动回满', rest.mode === 'rest' && rest.hp < rest.max * .5 && rest.units.every(x => x <= 55), rest);
  // 军医页签
  await ev(s => { s.campUI.root.getByName('camp-tab-4').emit('pointerdown'); });
  for (let i = 0; i < 20 && !(await ev(s => s.campUI.root.list.some(o => o.list && o.list.some(x => x.name === 'camp-medic-art')))); i++) await p.waitForTimeout(200); // 立绘按需载入
  const st0 = await ev(s => ({ ...s.campUI.medicState(), tab: s.campUI.tab, tex: s.textures.exists('camp_medic_figure'), names: s.campUI.root.list.flatMap(o => o.list ?? []).map(o => o.name).filter(Boolean).slice(0, 12), art: !!s.campUI.root.list.find(o => o.list && o.list.some(x => x.name === 'camp-medic-art')) }));
  await p.screenshot({ path: `${OUT}/1-medic-tab.png` });
  ck('军医页签：显示主将血量、三档治疗（价格随章节）、手绘军医立绘', Math.abs(st0.hp - rest.hp) <= 2 && st0.maxHp === rest.max && st0.chapter === 1 && st0.price.small > 0 && st0.price.full > st0.price.small && st0.price.army > 0 && st0.art, st0);
  // 小治：扣粮回 25%
  const f0 = await ev(s => s.legion.food);
  const smallOk = await ev(s => { s.campUI.root.list.flatMap(o => o.list ?? []).find(o => o.name === 'camp-medic-small')?.emit('pointerdown'); return s.campUI.medicState(); });
  ck('小治：扣小治价的粮、回复 25% 生命', smallOk.food === f0 - st0.price.small && Math.abs(smallOk.hp - Math.min(rest.max, Math.ceil(rest.hp + rest.max * .25))) <= 1, { f0, st0, smallOk });
  await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/2-healed-fx.png` });
  // 为全军疗伤：部曲回满
  const ar = await ev(s => { const before = s.campUI.medicState(); s.campUI.root.list.flatMap(o => o.list ?? []).find(o => o.name === 'camp-medic-army')?.emit('pointerdown'); return { before, after: s.campUI.medicState(), units: s.legion.units.filter(u => u.active).map(u => u.hp === u.maxHp) }; });
  ck('为全军疗伤：扣粮、部曲伤兵全部回满', ar.before.hurtUnits >= 4 && ar.after.hurtUnits === 0 && ar.after.food === ar.before.food - ar.before.price.army && ar.units.every(Boolean), ar);
  // 粮不够：按钮置灰、点了不生效
  const poor = await ev(s => { s.legion.food = 3; s.campUI['render'](); const st = s.campUI.medicState(); const texts = s.campUI.root.list.flatMap(o => o.list ?? []).filter(o => o.type === 'Text').map(o => o.text); const hp0 = s.player.hp; s.campUI.root.list.flatMap(o => o.list ?? []).find(o => o.name === 'camp-medic-full')?.emit('pointerdown'); const ok = s.campUI.heal('full'); return { st, poorLabel: texts.some(t => t.startsWith('随军粮不足')), ok, food: s.legion.food, hpSame: s.player.hp === hp0 }; });
  await p.screenshot({ path: `${OUT}/3-poor.png` });
  ck('随军粮不够：按钮置灰显示「随军粮不足」，点了不扣粮不回血', !poor.st.can.full && !poor.st.can.small && poor.poorLabel && !poor.ok && poor.food === 3 && poor.hpSame, poor);
  // 大治回满，然后满血：按钮置灰「将军无恙」
  const fullH = await ev(s => { s.legion.food = 300; s.campUI['render'](); const before = s.campUI.medicState(); s.campUI.root.list.flatMap(o => o.list ?? []).find(o => o.name === 'camp-medic-full')?.emit('pointerdown'); const after = s.campUI.medicState(); const texts = s.campUI.root.list.flatMap(o => o.list ?? []).filter(o => o.type === 'Text').map(o => o.text); return { before, after, hale: texts.filter(t => t === '将军无恙').length, again: s.campUI.heal('small'), food2: s.legion.food }; });
  await p.screenshot({ path: `${OUT}/4-hale.png` });
  ck('大治：按缺血折价扣粮、生命回满', fullH.after.hp === fullH.after.maxHp && fullH.after.food === fullH.before.food - fullH.before.price.full, fullH);
  ck('主将满血：小治 / 大治按钮置灰、显示「将军无恙」，点了不扣粮', fullH.after.hale && !fullH.after.can.small && !fullH.after.can.full && fullH.hale === 2 && !fullH.again && fullH.food2 === fullH.after.food, fullH);
  // 继承：先打到 55% 血、一名部曲掉血，出征 → 1-2 开局血量一致
  const carry0 = await ev(s => { s.player.hp = Math.round(s.player.maxHp * .55); const u = s.legion.units.find(u => u.active); u.hp = Math.round(u.maxHp * .3); return { frac: s.player.hp / s.player.maxHp, unit: u.hp / u.maxHp }; });
  await ev(s => { s.campUI.root.list.find(o => o.name === 'camp-depart')?.emit('pointerdown'); });
  await p.waitForTimeout(800);
  await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive() && s.chapter?.stage === 2; }, S, { timeout: 60000 }); await p.waitForTimeout(800);
  const carry1 = await ev(s => ({ stage: s.chapter.stage, frac: s.player.hp / s.player.maxHp, units: s.legion.units.filter(u => u.active).map(u => +(u.hp / u.maxHp).toFixed(2)) }));
  ck('率军出征 → 1-2 开局：主将血量继承（同比例）', carry1.stage === 2 && Math.abs(carry1.frac - carry0.frac) < .02, { carry0, carry1 });
  ck('部曲血量继承（掉血的那名仍是 30%）', carry1.units.some(x => Math.abs(x - carry0.unit) < .03), { carry0, carry1 });
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
