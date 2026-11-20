// P2 周瑜（other-factions-design.md §4）：火船令放 2 艘火船，撞上 / 到尽头爆燃、留火场；被动「英发」火烧敌兵攒 20 点刮「东风」（火场顺风推进、伤害 ×2）；
// 分支「火烧赤壁」（火索、连锁爆燃）/「曲有误」（琴音环减速敌兵、部曲攻速）；武艺「连环」火船 +1、「雅量」英发少攒。
// 电脑布局；关掉随机暴击。用法：BASE=http://127.0.0.1:5743/ node tools/test-zhouyu.mjs   SHOT=1 另存截图到 .tmp-zy/
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
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'zhouyu', weapon: undefined }); s.scene.restart(); }, G);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'zhouyu' && s.__DEV_ACTIONS; }, null, { timeout: 20000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; s.player.stats.critChance = -1; setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit') s.__DEV_ACTIONS.closePopup?.(); }, 40); }, G);
const H = `const s = ${G}, pl = s.player, w = pl.weapons[0], wait = ms => new Promise(r => setTimeout(r, ms)), waitG = async ms => { const t0 = s.combatNow, r0 = Date.now(); while (s.combatNow - t0 < ms && Date.now() - r0 < ms * 6) await wait(20); };
  const { zhouyuDebug } = await import('/src/weapons/zhouyuWeapon.ts'); const D = () => zhouyuDebug(pl);
  const clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); pl.passive.reset('zhouyu', s.combatNow); };
  const mk = (kind, x, y, hp = 99999) => { const e = s.spawnEnemy(kind, x, y, 1); e.hp = e.maxHp = hp; e.stunUntil = 1e12; e.controlImmune = false; return e; };
  const fire = async () => { const a0 = D().launches; w.cooldownLeft = 0; const r0 = Date.now(); while (D().launches === a0 && Date.now() - r0 < 3000) await wait(8); w.cooldownLeft = 1e9; };
  const settle = async () => { const r0 = Date.now(); while ((D().ships || D().fields) && Date.now() - r0 < 8000) await wait(30); };`;

const r0 = await p.evaluate(`(async () => { ${H}
  return { weapon: w.id, tex: ['fx_zy_ship','fx_zy_blast','fx_zy_field','fx_zy_rope','fx_zy_qin','fx_zy_wind','fx_cast_zhouyu','zhouyu_walk_sheet','zhouyu_actions','zhouyu_portrait','icon_huochuan','icon_dongfeng','branch_icon_zy_chibi','branch_icon_zy_quyouwu','growth_icon_yaliang','growth_icon_lianchuan'].filter(k => !s.textures.exists(k)) };
})()`);
ck('周瑜开局本命武器是火船令（huochuan_ling）', r0.weapon === 'huochuan_ling', r0);
ck('周瑜的手绘特效 / 行走 / 动作 / 头像 / 图标全部载入', r0.tex.length === 0, r0);

// 1) 火船：一轮 2 艘，撞上敌兵爆燃、留火场；火场里的敌兵持续挨烧
const r1 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await settle();
  const t = mk('infantry', pl.x + 200, pl.y), b0 = D().blasts; await fire(); const ships = D().ships;
  const r0 = Date.now(); while (D().blasts < b0 + 1 && Date.now() - r0 < 3000) await wait(10); await waitG(30);
  const hit1 = t.maxHp - t.hp, fields = D().fields; await waitG(1600); const hit2 = t.maxHp - t.hp;
  await settle(); return { ships, hit1, hit2, fields };
})()`);
ck('火船令：一轮放出 2 艘火船', r1.ships === 2, r1);
ck('火船撞上敌兵爆燃、留下火场', r1.hit1 > 0 && r1.fields >= 1, r1);
ck('火场持续灼烧站在里面的敌兵', r1.hit2 > r1.hit1, r1);

// 2) 英发：火烧死敌兵攒 1 点；满 20 点刮东风，火场顺风推进
const r2 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await settle();
  const t = mk('infantry', pl.x + 200, pl.y, 5); await fire(); const r0 = Date.now(); while (t.active && Date.now() - r0 < 3000) await wait(10);
  const stack = pl.passive.snapshot(s.combatNow).stacks;
  const f0 = D().field0, cast0 = s.heroCastFx?.stats.passive ?? 0; pl.heading.x = 0; pl.heading.y = 1;
  for (let i = 0; i < 20; i++) pl.passive.onFireKill(s.combatNow);
  await waitG(1000); const f1 = D().field0;
  return { stack, windOn: D().windOn, winds: D().winds, f0, f1, moved: f0 && f1 ? f1.y - f0.y : null, cast: (s.heroCastFx?.stats.passive ?? 0) - cast0 };
})()`);
ck('英发：火船烧死敌兵攒 1 点', r2.stack === 1, r2);
ck('英发满 20 点：刮东风、放起手特效', r2.windOn && r2.winds === 1 && r2.cast >= 1, r2);
ck('东风：火场顺风（主将朝向）推进', r2.moved !== null && r2.moved > 40, r2);
await p.evaluate(`(async () => { ${H} await settle(); })()`);

// 3) 分支「火烧赤壁」：一艘撞上，同轮另一艘跟着连锁爆燃；飞行中拉火索
const r3 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; w.branch = 'zy_chibi'; w.over = 0; await settle();
  mk('infantry', pl.x + 160, pl.y + 30); const b0 = D().blasts; await fire(); await waitG(80);
  const rope = s.children.list.filter(o => o.name === 'zy-rope').length;
  const r0 = Date.now(); while (D().blasts < b0 + 1 && Date.now() - r0 < 3000) await wait(5); const tFirst = s.combatNow;
  while (D().blasts < b0 + 2 && Date.now() - r0 < 3000) await wait(5);
  const gap = Math.round(s.combatNow - tFirst); w.branch = undefined; await settle();
  return { rope, gap, blasts: D().blasts - b0 };
})()`);
ck('火烧赤壁：同轮火船之间拉起火索', r3.rope >= 1, r3);
ck('火烧赤壁：一艘爆燃，另一艘随即连锁爆燃（没驶到尽头）', r3.blasts === 2 && r3.gap < 400, r3);

// 4) 分支「曲有误」：琴音环减速身边敌兵、给部曲加攻速
const r4 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; w.branch = 'zy_quyouwu'; await settle();
  let hasted = 0; const host = s.weaponHost, orig = host.hasteAllies; host.hasteAllies = (...a) => { hasted++; return orig(...a); };
  const e = mk('infantry', pl.x + 120, pl.y); e.stunUntil = 0; await waitG(300);
  const slow = e.martialSlowUntil > s.combatNow ? +e.martialSlow.toFixed(2) : 1, on = D().quOn, ring = !!s.children.list.find(o => o.name === 'zy-qin');
  host.hasteAllies = orig; w.branch = undefined; await waitG(50);
  return { on, ring, slow, hasted };
})()`);
ck('曲有误：琴音环出现，身边敌兵减速 30%', r4.on && r4.ring && r4.slow === .7, r4);
ck('曲有误：琴音环期间给身边部曲加攻速', r4.hasted > 0, r4);

// 5) 武艺：连环 +1 艘；雅量少攒
const r5 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await settle(); pl.growth.masteries.lianchuan = 1; pl.growth.masteries.yaliang = 1;
  mk('infantry', pl.x + 220, pl.y); await fire(); const ships = D().ships; const need = pl.passive.zyNeed;
  pl.growth.masteries.lianchuan = 0; pl.growth.masteries.yaliang = 0; await settle(); return { ships, need };
})()`);
ck('连环：一轮火船 +1 艘（3 艘）', r5.ships === 3, r5);
ck('雅量：英发满层 20 → 17', r5.need === 17, r5);

if (process.env.SHOT) {
  mkdirSync('.tmp-zy', { recursive: true });
  await p.evaluate(`(async () => { ${H} clear(); w.branch = 'zy_chibi'; pl.growth.masteries.lianchuan = 1; for (let i = 0; i < 14; i++) { const e = mk('infantry', pl.x + 140 + (i % 5) * 40, pl.y - 80 + Math.floor(i / 5) * 70); e.stunUntil = 0; } w.cooldownLeft = 0; })()`);
  await p.waitForTimeout(450); await p.screenshot({ path: '.tmp-zy/zhouyu_ships.png' });
  await p.evaluate(`(async () => { ${H} pl.heading.x = 1; pl.heading.y = 0; for (let i = 0; i < 20; i++) pl.passive.onFireKill(s.combatNow); })()`);
  await p.waitForTimeout(900); await p.screenshot({ path: '.tmp-zy/zhouyu_wind.png' });
}
ck('无报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} pass / ${fail} fail`); await b.close(); process.exit(fail ? 1 : 0);
