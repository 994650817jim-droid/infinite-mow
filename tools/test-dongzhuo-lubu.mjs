// 2-3 洛阳 · 董卓与吕布同场（用户设计）：一起出阵 → 董卓在城墙上打不到、城头放箭 / 纵火 → 弱化吕布打到 1/3 锁血、唤赤兔逃走 →
// 董卓走下城可以打 → 董卓 20% 时吕布杀回一戟斩之 → 董卓倒地掉宝箱、照常结算。阶段切换发 boss-phase。电脑布局，关键时刻截图。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-dongzhuo-lubu.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/dongzhuo-lubu';
mkdirSync(OUT, { recursive: true });
const CHAR = process.env.CHAR ?? 'zhaoyun';
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
  const wait = async ms => { for (let t = 0; t < ms; t += 200) { await ev(() => 0); await p.waitForTimeout(200); } };
  const snap = () => ev(s => s.dzLubu ? s.dzLubu.snapshot() : null);
  await p.goto(BASE + '?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate((CHAR) => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('runConfig', { character: CHAR, chapter: 'hulao', westStage: 3 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); }, CHAR);
  await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await wait(1200);
  await ev(s => { s.player.damageImmune = true; window.__ph = []; s.events.on('boss-phase', e => window.__ph.push(e.phase)); const w = s.chapter.waves; s.devSetTime?.(w[w.length - 1].start + 1); });
  for (let i = 0; i < 60 && !(await snap()); i++) await wait(200);
  // 2-3 重做（luoyang-2-3-design）：吕布先在城头，营寨全毁才跃下——这里直接拆掉五座营寨，等吕布落地后再走原来的检查（完整新流程见 test-luoyang-flow.mjs）
  await ev(s => { for (const t of [...(s.objective?.targets ?? [])]) if (t.e.active) { t.e.hp = 0; s.killEnemy(t.e); } });
  for (let i = 0; i < 40 && (await snap())?.phase !== 'wall'; i++) await wait(200);
  await wait(1800);
  let st = await snap();
  const pos = await ev(s => ({ py: Math.round(s.player.y), name: s.chapter.name, lubuTex: s.dzLubu?.lubu?.sprite.texture.key }));
  await ev(s => { s.player.sprite.setPosition(s.dzLubu.dongzhuo.x, s.dzLubu.dongzhuo.y + 260); }); await wait(500);
  await p.screenshot({ path: `${OUT}/1-together.png` });
  ck('2-3：董卓 · 吕布同时出阵（董卓在城头、吕布在城下）', st?.phase === 'wall' && st.lubu?.active && st.dzY < pos.py - 250 && /lubu/.test(String(pos.lubuTex)), { st, pos });
  const hp0 = st.dzHp, wallY = st.dzY;
  await ev(s => s.hitEnemy(s.dzLubu.dongzhuo, 1e6, s.combatNow, 'melee', false, false));
  st = await snap();
  ck('城头的董卓打不到（刀枪不入）', st.dzInv && st.dzHp === hp0, st);
  await wait(7000);
  st = await snap();
  ck('城头放箭雨、吕布方天横扫', st.metrics.volleys >= 1 && st.metrics.sweeps >= 1, st.metrics);
  ck('弱化吕布：血 ×0.5（基础 1600）、步战', st.lubu.baseHp === 1600, st.lubu);
  // 用户 2026-11-19「董卓和吕布都无敌」：普攻 / 智能选靶不能锁城头刀枪不入的董卓，要打到吕布
  const tgt = await ev(s => { const d = s.dzLubu.dongzhuo, pt = s.priorityWeaponTarget(3000, false), ne = s.nearestEnemy(d.x, d.y, 60); return { prioIsDz: pt === d, nearIsDz: ne === d }; });
  ck('城头董卓不被选作攻击目标、吕布在自动攻击下掉血（' + CHAR + '）', !tgt.prioIsDz && !tgt.nearIsDz && st.lubu.hp < st.lubu.max, { tgt, lubu: st.lubu });
  // 吕布打到 1/3：锁血、唤赤兔逃走
  for (let i = 0; i < 6; i++) await ev(s => { const l = s.dzLubu.lubu; if (l?.active && !l.invulnerable) s.hitEnemy(l, 500, s.combatNow, 'melee', false, false); });
  await p.waitForTimeout(300);
  st = await snap();
  await p.screenshot({ path: `${OUT}/2-lubu-flee.png` });
  ck('吕布打到 1/3 锁血（打不死）、唤赤兔逃走', st.phase === 'fleeing' && st.lubu.active && st.lubu.hp >= Math.floor(st.lubu.max / 3) - 1 && st.lubu.inv, st);
  for (let i = 0; i < 30 && (await snap()).phase !== 'down'; i++) await wait(200);
  await wait(400);
  st = await snap();
  await p.screenshot({ path: `${OUT}/3-dongzhuo-down.png` });
  ck('吕布离场 → 董卓走下城、可以打了', st.phase === 'down' && !st.lubu.active && !st.dzInv && st.dzY > wallY + 120, { wallY, st });
  const h1 = st.dzHp; await ev(s => s.hitEnemy(s.dzLubu.dongzhuo, 200, s.combatNow, 'melee', false, false));
  st = await snap();
  ck('下城后的董卓受伤', st.dzHp < h1, { h1, st });
  // 董卓 20%：吕布杀回斩董卓
  await ev(s => { const d = s.dzLubu.dongzhuo; d.hp = Math.floor(d.maxHp * .21); s.hitEnemy(d, d.maxHp * .02, s.combatNow, 'melee', false, false); });
  await wait(400);
  st = await snap();
  ck('董卓 20%：吕布骑赤兔杀回（慢动作）', st.phase === 'finale', st);
  await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/4-lubu-returns.png` });
  for (let i = 0; i < 120 && (await snap())?.phase !== 'done'; i++) await wait(200);
  const fin = await ev(s => ({ boss: !!s.boss?.active, killed: s.bossKilled, chests: s.bossChests.length, snap: s.dzLubu?.snapshot(), ph: window.__ph }));
  await p.screenshot({ path: `${OUT}/5-dongzhuo-slain.png` });
  ck('吕布一戟斩董卓 → 董卓倒地、掉宝箱', !fin.boss && fin.killed && fin.chests >= 1, fin);
  ck('阶段切换发 boss-phase（下城 = 2、授首 = 3）', fin.ph.includes(2) && fin.ph.includes(3), fin.ph);
  // 捡宝箱 → 结算
  let end = null;
  for (let i = 0; i < 80 && !end; i++) { end = await ev(s => { const c = s.bossChests.find(c => !c.done && c.ready); if (c) { s.player.sprite.x = c.x; s.player.sprite.y = c.y; } return s.over || s.mode === 'rest' ? { over: s.over, victory: s.victory, mode: s.mode } : null; }); await p.waitForTimeout(200); }
  await p.screenshot({ path: `${OUT}/6-result.png` });
  ck('捡完宝箱 → 照常结算告捷', end && (end.victory || end.mode === 'rest'), end);
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
