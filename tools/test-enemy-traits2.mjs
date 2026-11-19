// 各章新兵种第二批（第 3～6 章，data/enemyRoster + systems/EnemyTraits）：在 5-2 赤壁（有江面）开一局，把 12 种逐个刷在主将身边查机制。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-enemy-traits2.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0&story=off');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
await p.evaluate(() => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.set('chibiStage', 2); s0.registry.set('runConfig', { character: 'zhaoyun', thirdStage: 2 }); for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'GameScene') s.scene.stop(); s0.scene.start('ChibiGameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('ChibiGameScene'); return window.__game.scene.isActive('ChibiGameScene') && s?.player && s.traits && s.elapsed > 1; }, null, { timeout: 120000 });
const r = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('ChibiGameScene'), T = s.traits, P = s.player, M = T.metrics, wait = ms => new Promise(r => setTimeout(r, ms));
  const R = (await import('/src/data/enemyRoster.ts')).ROSTER_MIX; R.maxTraitShare = 1; for (const k of Object.keys(R.roleCaps)) R.roleCaps[k] = 99;
  const clear = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); } } };
  s.updateSpawner = () => {}; T.pick = () => null;
  const wipe = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); };
  wipe(); P.damageImmune = false; window.__hurt = 0; const tk = P.takeDamage.bind(P); P.takeDamage = (d, n) => { const h = P.hp, ok = tk(d, n); window.__hurt += h - P.hp; P.hp = P.maxHp; P.alive = true; return ok; };
  const keep = () => { P.invulnUntil = 0; clear(); };
  const run = async (ms, fn) => { const t = performance.now(); while (performance.now() - t < ms) { keep(); fn?.(); await wait(100); } };
  const at = (id, dx, dy, inv = true) => { const e = T.spawnSpecial(id, dx === undefined ? undefined : { x: P.x + dx, y: P.y + dy }); if (e && inv) e.invulnerable = true; return e; };
  const hurt = async (ms, fn) => { const h0 = window.__hurt; await run(ms, fn); return Math.round(window.__hurt - h0); };
  const out = {};
  // 夜袭兵：藏着（半透明、刀枪不入）→ 走近现身、猛冲
  { const e = at('yexi', undefined, undefined, false); const hid = { alpha: e?.sprite.alpha, inv: e?.invulnerable, d: e && Math.round(Math.hypot(e.x - P.x, e.y - P.y)) }; const r0 = M.reveals;
    if (e) P.sprite.setPosition(e.x + 150, e.y); await run(600); out.yexi = { hid, revealed: M.reveals - r0, alpha: e?.sprite.alpha, inv: e?.invulnerable }; wipe(); }
  // 陷阵营：一队 5～7；正面减伤、绕到背后不减
  { const n0 = T.count('xianzhen'); const e = at('xianzhen', 260, 0); await run(800); const st = T.st.get(e); const front = T.damageTakenMul(e); st.face += Math.PI; const back = T.damageTakenMul(e);
    out.xianzhen = { group: T.count('xianzhen') - n0, front, back }; wipe(); }
  // 丹阳兵：掷标枪
  { const j0 = M.javelins; at('danyang', 300, 0); await run(3500); out.danyang = { javelins: M.javelins - j0 }; wipe(); }
  // 大戟士：扇形预警横扫
  { const s0 = M.sweeps; const e = at('daji', 100, 0); const h = await hurt(3500, () => P.sprite.setPosition(e.x - 90, e.y)); out.daji = { sweeps: M.sweeps - s0, hurt: h }; wipe(); }
  // 先登死士：举盾减伤 ↔ 放盾连射
  { const v0 = M.volleys; const e = at('xiandeng', 300, 0); let up = 1; await run(4200, () => { if (T.st.get(e)?.phase === 'up') up = Math.min(up, T.damageTakenMul(e)); }); out.xiandeng = { volleys: M.volleys - v0, upMul: up }; wipe(); }
  // 押粮卒：跑够时间 → 粮到来援兵；截住 → 加军粮
  { const d0 = M.delivered, e = at('yaliang', 300, 0); T.st.get(e).born -= 20000; await run(300); const n = s.enemies.filter(x => x.active && !x.isSupplySlot && x.kind !== 'boss').length;
    const e2 = at('yaliang', -300, 0, false), f0 = s.legion.food; s.hitEnemy(e2, 1e7, s.combatNow, 'melee', false, false); await run(200);
    out.yaliang = { delivered: M.delivered - d0, reinforcements: n, food: s.legion.food - f0 }; wipe(); }
  // 荆州水卒 / 火船：从江面出；火船冲到主将身边爆燃
  { P.sprite.setPosition(0, -200); await run(200); const n0 = T.count('shuizu'), w0 = M.fromWater; const e = at('shuizu'); const w = M.fromWater > w0;
    out.shuizu = { group: T.count('shuizu') - n0, inWater: !!w, at: e && [Math.round(e.x), Math.round(e.y)] }; wipe();
    const b0 = M.shipBooms, fw0 = M.fromWater; const f = at('huochuan', undefined, undefined, false); const fw = M.fromWater > fw0, look = s.children.list.filter(o => o.name === 'trait-fireship').length;
    const h = await hurt(14000, () => { if (f?.active) f.invulnerable = true; if (M.shipBooms > b0) return; }); out.huochuan = { fromWater: !!fw, look, booms: M.shipBooms - b0, hurt: h }; wipe(); }
  // 曹军枪阵兵：直线贯穿
  { const t0 = M.thrusts; const e = at('qiangzhen', 120, 0); const h = await hurt(3000, () => P.sprite.setPosition(e.x - 110, e.y)); out.qiangzhen = { thrusts: M.thrusts - t0, hurt: h }; wipe(); }
  // 山越飞石手：藏着 → 现身抛飞石
  { const r0 = M.reveals, t0 = M.throws; const e = at('feishi', undefined, undefined, false); P.sprite.setPosition(e.x + 330, e.y); await run(4500, () => { if (e.active && !T.st.get(e)?.hidden) e.invulnerable = true; }); out.feishi = { revealed: M.reveals - r0, throws: M.throws - t0 }; wipe(); }
  // 五溪蛮兵：预警落点 → 扑跳 → 落地伤害
  { const l0 = M.leaps; const e = at('wuxi', 250, 0); e.controlImmune = true; /* 测试里不让主将的定身打断起跳计时 */ const h = await hurt(6000); out.wuxi = { leaps: M.leaps - l0, hurt: h }; wipe(); }
  // 长沙强弓：远处蓄力，一箭穿透
  { const s0 = M.snipes; at('changsha', 450, 0); const h = await hurt(4500); out.changsha = { snipes: M.snipes - s0, hurt: h }; wipe(); }
  return out;
});
ck('夜袭兵：藏着（半透明、刀枪不入）→ 主将走近现身', r.yexi.hid.alpha < .3 && r.yexi.hid.inv && r.yexi.revealed === 1 && r.yexi.alpha === 1 && !r.yexi.inv, r.yexi);
ck('陷阵营：一队 5～7 人，正面减伤 60%、绕到背后不减', r.xianzhen.group >= 5 && r.xianzhen.front < .5 && r.xianzhen.back === 1, r.xianzhen);
ck('丹阳兵：保持距离掷标枪', r.danyang.javelins >= 1, r.danyang);
ck('大戟士：扇形预警后横扫，扫到主将', r.daji.sweeps >= 1 && r.daji.hurt > 0, r.daji);
ck('先登死士：举盾时正面减伤、放盾连射', r.xiandeng.volleys >= 3 && r.xiandeng.upMul < .5, r.xiandeng);
ck('押粮卒：没截住 → 粮到来援兵；截住 → 加军粮', r.yaliang.delivered === 1 && r.yaliang.reinforcements >= 3 && r.yaliang.food > 0, r.yaliang);
ck('荆州水卒：成群从江面刷出（江在场地外时上岸）', r.shuizu.group >= 3 && r.shuizu.inWater, r.shuizu);
ck('火船：从江面出，冲到主将身边爆燃（没专属图时用着火的辎重车）', r.huochuan.fromWater && r.huochuan.look >= 1 && r.huochuan.booms >= 1 && r.huochuan.hurt > 0, r.huochuan);
ck('曹军枪阵兵：直线预警后长枪贯穿', r.qiangzhen.thrusts >= 1 && r.qiangzhen.hurt > 0, r.qiangzhen);
ck('山越飞石手：藏着 → 现身后抛飞石', r.feishi.revealed === 1 && r.feishi.throws >= 1, r.feishi);
ck('五溪蛮兵：预警落点、扑跳、落地伤害', r.wuxi.leaps >= 1 && r.wuxi.hurt > 0, r.wuxi);
ck('长沙强弓：蓄力后一箭穿透', r.changsha.snipes >= 1 && r.changsha.hurt > 0, r.changsha);
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
