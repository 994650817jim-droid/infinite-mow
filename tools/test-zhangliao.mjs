// P2 张辽（other-factions-design.md §4）：破阵双戟扇形连斩、每击叠「震慑」、3 层「溃逃」（逃跑、受伤 +25%，免控 / 首领不逃）；
// 被动「止啼」击杀溃兵攒 12 点召「八百虎贲」环冲；分支「八百破十万」（更多骑、眩晕）/「威震逍遥津」（溃逃传给身边）；武艺「威名」2 层就溃逃。
// 电脑布局；关掉随机暴击。用法：BASE=http://127.0.0.1:5743/ node tools/test-zhangliao.mjs   SHOT=1 另存截图到 .tmp-zl/
import { chromium } from 'playwright'; import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5743/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 460) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 30000 });
await p.waitForTimeout(1500);
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'zhangliao', weapon: undefined }); s.scene.restart(); }, G);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'zhangliao' && s.__DEV_ACTIONS; }, null, { timeout: 20000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; s.player.stats.critChance = -1; setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit') s.__DEV_ACTIONS.closePopup?.(); }, 40); }, G);
const H = `const s = ${G}, pl = s.player, w = pl.weapons[0], wait = ms => new Promise(r => setTimeout(r, ms)), waitG = async ms => { const t0 = s.combatNow, r0 = Date.now(); while (s.combatNow - t0 < ms && Date.now() - r0 < ms * 6) await wait(20); };
  const { zhangliaoDebug } = await import('/src/weapons/zhangliaoWeapon.ts');
  const clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); pl.passive.reset('zhangliao', s.combatNow); };
  const mk = (kind, x, y, hp = 99999) => { const e = s.spawnEnemy(kind, x, y, 1); e.hp = e.maxHp = hp; e.controlImmune = false; return e; };
  const pin = e => { e.stunUntil = 1e12; return e; };
  const fire = async () => { const a0 = zhangliaoDebug(pl).acts; w.cooldownLeft = 0; const r0 = Date.now(); while (zhangliaoDebug(pl).acts === a0 && Date.now() - r0 < 3000) await wait(8); w.cooldownLeft = 1e9; await waitG(60); };`;

// 0) 基础
const r0 = await p.evaluate(`(async () => { ${H}
  return { weapon: w.id, tex: ['fx_zl_slash','fx_zl_rider','fx_zl_rout','fx_cast_zhangliao','zhangliao_walk_sheet','zhangliao_actions','zhangliao_portrait','icon_pozhen','branch_icon_zl_shiwan','branch_icon_zl_xiaoyao','growth_icon_xiandeng','growth_icon_weiming'].filter(k => !s.textures.exists(k)) };
})()`);
ck('张辽开局本命武器是破阵双戟（pozhen_shuangji）', r0.weapon === 'pozhen_shuangji', r0);
ck('张辽的手绘特效 / 行走 / 动作 / 头像 / 图标全部载入', r0.tex.length === 0, r0);

// 1) 扇形连斩：身前的兵挨打、身后的不挨打；每击叠震慑，3 层溃逃
const r1 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  const front = pin(mk('infantry', pl.x + 55, pl.y)), back = pin(mk('infantry', pl.x - 90, pl.y + 4)); const st = [];
  for (let i = 0; i < 3; i++) { await fire(); st.push([front.zhenshe, front.routUntil > s.combatNow]); }
  return { st, front: front.maxHp - front.hp, back: back.maxHp - back.hp, vuln: +pl.passive.vulnerability(front, s.combatNow).toFixed(3) };
})()`);
ck('破阵双戟：身前一扇挨打，身后的不挨打', r1.front > 0 && r1.back === 0, r1);
ck('震慑：第 1、2 击叠层，第 3 击溃逃', r1.st[0][0] === 1 && !r1.st[0][1] && r1.st[1][0] === 2 && !r1.st[1][1] && r1.st[2][1], r1);
ck('溃逃的敌兵受伤 +25%', r1.vuln === 1.25, r1);

// 2) 溃逃：背向主将逃跑；免控的敌人只叠层不逃
const r2 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  const e = mk('infantry', pl.x + 70, pl.y); e.routUntil = s.combatNow + 2000; const d0 = Math.hypot(e.x - pl.x, e.y - pl.y); await waitG(600); const d1 = Math.hypot(e.x - pl.x, e.y - pl.y);
  clear(); const im = pin(mk('infantry', pl.x + 70, pl.y)); im.controlImmune = true; for (let i = 0; i < 4; i++) await fire();
  return { d0: Math.round(d0), d1: Math.round(d1), immuneRout: im.routUntil > s.combatNow, immuneHit: im.maxHp - im.hp };
})()`);
ck('溃逃：敌兵背向主将逃开（0.6 秒拉远 30 像素以上）', r2.d1 - r2.d0 > 30, r2);
ck('免控的敌人挨打但不溃逃', !r2.immuneRout && r2.immuneHit > 0, r2);

// 3) 止啼：击杀溃兵攒 1 点；满 12 点召八百虎贲，虎贲环冲撞到身边的兵
const r3 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  const e = pin(mk('infantry', pl.x + 70, pl.y, 5)); e.routUntil = s.combatNow + 5000; await fire(); const after = pl.passive.snapshot(s.combatNow).stacks;
  clear(); const s0 = zhangliaoDebug(pl).summons, cast0 = s.heroCastFx?.stats.passive ?? 0;
  for (let i = 0; i < 12; i++) pl.passive.onRoutKill(s.combatNow);
  const victim = pin(mk('infantry', pl.x + 150, pl.y));
  await waitG(80); const live = zhangliaoDebug(pl).hubenLive, riders = s.children.list.filter(o => o.name === 'zl-rider').length;
  await waitG(1900); const s1 = zhangliaoDebug(pl).summons;
  return { after, summons: s1 - s0, live, riders, victim: victim.maxHp - victim.hp, gone: !zhangliaoDebug(pl).hubenLive, cast: (s.heroCastFx?.stats.passive ?? 0) - cast0 };
})()`);
ck('止啼：击杀溃逃中的敌兵攒 1 点', r3.after === 1, r3);
ck('止啼满 12 点：召八百虎贲（8 骑虚影）、放起手特效', r3.summons === 1 && r3.live && r3.riders === 8 && r3.cast >= 1, r3);
ck('八百虎贲：环冲两圈撞到身边的兵，冲完收起', r3.victim > 0 && r3.gone, r3);

// 4) 分支
const r4 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; w.branch = 'zl_xiaoyao'; w.over = 0; await wait(120);
  const t = pin(mk('infantry', pl.x + 70, pl.y)), nb = pin(mk('infantry', pl.x + 150, pl.y)); for (let i = 0; i < 3; i++) await fire();
  const spread = nb.routUntil > s.combatNow, nbHit = nb.maxHp - nb.hp;
  clear(); w.branch = 'zl_shiwan'; await wait(60);
  for (let i = 0; i < 12; i++) pl.passive.onRoutKill(s.combatNow);
  const v = pin(mk('infantry', pl.x + 150, pl.y)); v.stunUntil = 0; await waitG(80);
  const riders = s.children.list.filter(o => o.name === 'zl-rider').length; let stunned = false; const t0 = s.combatNow; while (s.combatNow - t0 < 900) { await wait(10); if (v.stunUntil > s.combatNow) stunned = true; }
  await waitG(2200); w.branch = undefined;
  return { spread, nbHit, riders, stunned };
})()`);
ck('威震逍遥津：溃逃传给身边 90 像素内的敌兵（斩不到的也逃）', r4.spread && r4.nbHit === 0, r4);
ck('八百破十万：虎贲 12 骑，撞上的敌兵眩晕', r4.riders === 12 && r4.stunned, r4);

// 5) 武艺「威名」：2 层就溃逃
const r5 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; pl.growth.masteries.weiming = 1; await wait(120);
  const e = pin(mk('infantry', pl.x + 70, pl.y)); await fire(); const one = e.routUntil > s.combatNow; await fire(); const two = e.routUntil > s.combatNow;
  pl.growth.masteries.weiming = 0; return { one, two };
})()`);
ck('威名：震慑 2 层就溃逃', !r5.one && r5.two, r5);

if (process.env.SHOT) {
  mkdirSync('.tmp-zl', { recursive: true });
  await p.evaluate(`(async () => { ${H} clear(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; mk('infantry', pl.x + Math.cos(a) * (80 + (i % 3) * 40), pl.y + Math.sin(a) * (80 + (i % 3) * 40)); } for (let i = 0; i < 12; i++) pl.passive.onRoutKill(s.combatNow); w.cooldownLeft = 0; })()`);
  await p.waitForTimeout(700); await p.screenshot({ path: '.tmp-zl/zhangliao_huben.png' });
  await p.waitForTimeout(1600); await p.screenshot({ path: '.tmp-zl/zhangliao_rout.png' });
}
ck('无报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} pass / ${fail} fail`); await b.close(); process.exit(fail ? 1 : 0);
