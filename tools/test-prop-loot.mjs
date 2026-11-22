// 障碍物按类别掉落（src/data/propLoot.ts，BattlefieldSupplies.onPropLoot → GameScene.propLoot）：
// ① 掉落表：兵器架 → 攻击类兵装、甲胄架 → 护具、木箱 / 钱袋 → 宝石 + 极低概率兵装、粮袋 / 粮车 → 随军粮；军旗 / 营帐 / 栅栏 / 景物 / 别的图 → 不掉；兵装封顶蓝色；
// ② 实战：打碎兵器架掉攻击类兵装（光柱）+ 斗志；每关障碍物最多掉 2 件；打碎甲胄架掉护具 + 减伤；粮袋给随军粮；砍倒军旗、打塌营帐不掉兵装也不掉宝箱。
// 电脑布局 1280×720，截图存 assets/review/prop-loot/。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5197/ node tools/test-prop-loot.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/prop-loot';
mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 460) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::|ERR_/.test(m.text())) errors.push(m.text()); });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
await p.waitForTimeout(1500);

// ---------- ① 掉落表（纯数据） ----------
const t = await p.evaluate(async () => {
  const L = await import('/src/data/propLoot.ts'), I = await import('/src/data/items.ts');
  let s = 7; const rng = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const prim = id => I.BASE_ITEMS.find(b => b.id === id)?.primary, slot = id => I.BASE_ITEMS.find(b => b.id === id)?.slot;
  const w = Array.from({ length: 150 }, () => L.rollPropItem('weapons', rng)), a = Array.from({ length: 150 }, () => L.rollPropItem('armor', rng));
  const allQ = [...w, ...a, ...Array.from({ length: 100 }, () => L.rollPropItem('crate', rng))].map(i => i.quality);
  return {
    kinds: { rack: L.propLootKind('yellow_props', 19), bow: L.propLootKind('yellow_props', 22), shield: L.propLootKind('yellow_props', 23), crate: L.propLootKind('yellow_props', 14), coins: L.propLootKind('yellow_props', 17), sack: L.propLootKind('yellow_props', 16), cart: L.propLootKind('yellow_props', 24), heal: L.propLootKind('yellow_props', 18, true),
      tent: L.propLootKind('yellow_props', 0), banner: L.propLootKind('yellow_props', 4), fence: L.propLootKind('yellow_props', 10), wreck: L.propLootKind('yellow_props', 26), stele: L.propLootKind('yellow_props', 32), envBanner: L.propLootKind('env_props', 0), sishui: L.propLootKind('sishui_props_refined', 3), unknown: L.propLootKind('some_new_prop', 0) },
    weaponsAttack: w.every(i => i && L.ATTACK_AFFIXES.includes(prim(i.base))), armorSlots: a.every(i => i && L.ARMOR_SLOTS.includes(slot(i.base))),
    maxQ: Math.max(...allQ.map(q => I.QUALITY_ORDER.indexOf(q))), blue: I.QUALITY_ORDER.indexOf('blue'), capPurple: L.capQuality('purple'), capOrange: L.capQuality('orange'), noneItem: L.rollPropItem('grain', rng) === null,
  };
});
const K = t.kinds;
ck('掉落表：兵器架 / 弓架 → 攻击类；盾牌堆 → 护具；木箱 → 宝石；钱袋 → 钱；粮袋 / 粮车 → 随军钱币；酒罐 → 回血', K.rack === 'weapons' && K.bow === 'weapons' && K.shield === 'armor' && K.crate === 'crate' && K.coins === 'coins' && K.sack === 'grain' && K.cart === 'grain' && K.heal === 'heal', K);
ck('掉落表：营帐 / 军旗 / 栅栏 / 残骸 / 石碑 / 环境军旗 / 汜水关物件 / 没登记的新图 → 什么也不掉', ['tent', 'banner', 'fence', 'wreck', 'stele', 'envBanner', 'sishui', 'unknown'].every(k => K[k] === 'none'), K);
ck('兵器架只出攻击类兵装（主词条伤害 / 攻速 / 暴击）；甲胄架只出甲 / 盔 / 靴', t.weaponsAttack && t.armorSlots, { w: t.weaponsAttack, a: t.armorSlots });
ck('障碍物兵装封顶蓝色（紫 / 金只从首领、精锐来）', t.maxQ <= t.blue && t.capPurple === 'blue' && t.capOrange === 'blue' && t.noneItem, t);

// ---------- ② 实战 ----------
await p.evaluate(() => {
  const g = window.__game, s = g.scene.getScene('GameScene'); window.__S = s; s.__DEV_ACTIONS.closePopup?.();
  s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  g.loop.sleep(); window.__T = performance.now(); s.readMove = () => new Phaser.Math.Vector2(0, 0);
  window.__step = n => { for (let i = 0; i < n; i++) { if (s.mode !== 'none' && !s.over) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode('none'); } window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); } };
  // 打碎一个补给格子里的物件：返回打碎前后的地上兵装 / 宝箱 / 随军粮
  window.__break = (frame) => {
    const sup = s.supplies; sup.spawnForTest(frame); const c = sup.crates.filter(c => c.enemy.active).slice(-1)[0], e = c.enemy;
    const g0 = s.itemDrops.ground.length, ch0 = s.itemDrops.chests.length, f0 = s.legion.food;
    s.hitEnemy(e, 1e6, s.combatNow, 'melee', false, false); window.__step(2);
    const items = s.itemDrops.ground.slice(g0).map(g => ({ base: g.item.base, q: g.item.quality }));
    return { tex: e.sprite.texture.key, items, chests: s.itemDrops.chests.length - ch0, food: s.legion.food - f0 };
  };
});
await p.evaluate(() => window.__step(5));
const r1 = await p.evaluate(async () => {
  const s = window.__S, I = await import('/src/data/items.ts'), L = await import('/src/data/propLoot.ts'); s.propRng = () => 0; s.propItems = 0; s.player.growth.berserkUntil = 0;
  const a = window.__break(19); const prim = id => I.BASE_ITEMS.find(b => b.id === id)?.primary;
  return { ...a, attack: a.items.every(i => L.ATTACK_AFFIXES.includes(prim(i.base))), berserk: s.player.growth.berserkUntil > s.combatNow };
});
await p.evaluate(() => window.__step(20)); await p.screenshot({ path: `${OUT}/1-weapon-rack-drop.png` });
ck('打碎兵器架：掉一件攻击类兵装（带品质光柱），偶得斗志（短时伤害提升）', r1.items.length === 1 && r1.attack && r1.chests === 0 && r1.berserk, r1);
const r2 = await p.evaluate(() => { const s = window.__S; const out = []; for (let i = 0; i < 4; i++) out.push(window.__break(21).items.length); return { per: out, propItems: s.propItems }; });
ck('每关障碍物最多掉 2 件兵装（再打兵器架只给宝石 / 斗志）', r2.propItems === 2 && r2.per.reduce((a, b) => a + b, 0) === 1, r2);
const r3 = await p.evaluate(async () => { const s = window.__S, I = await import('/src/data/items.ts'), L = await import('/src/data/propLoot.ts'); s.propItems = 0; s.player.propGuardUntil = 0; const a = window.__break(23); const slot = id => I.BASE_ITEMS.find(b => b.id === id)?.slot; return { ...a, armor: a.items.every(i => L.ARMOR_SLOTS.includes(slot(i.base))), guard: s.player.propGuardUntil > s.combatNow, mul: s.player.propGuardMul }; });
ck('打碎盾牌堆（甲胄架过渡图）：掉一件护具，偶得短时减伤', r3.items.length === 1 && r3.armor && r3.guard && r3.mul < 1, r3);
const r4 = await p.evaluate(() => window.__break(16));
ck('打碎粮袋：随军钱币增加、不掉兵装', r4.food === 6 && r4.items.length === 0 && r4.chests === 0, r4);
// 军旗 / 营帐：环境互动物件，砍倒 / 打塌都不掉兵装和宝箱（随机源全给 0 也一样）
const r5 = await p.evaluate(() => {
  const s = window.__S, env = s.env; if (!env) return { env: false };
  s.propItems = 0; const g0 = s.itemDrops.ground.length, ch0 = s.itemDrops.chests.length, out = {};
  for (const [kind, dx] of [['banner', 160], ['tent', -200]]) { const e = env.spawnForTest(kind, dx, 40); if (!e) { out[kind] = 'no-spawn'; continue; } s.hitEnemy(e, 1e7, s.combatNow, 'melee', false, false); window.__step(30); out[kind] = e.active ? 'alive' : 'down'; }
  return { env: true, ...out, items: s.itemDrops.ground.length - g0, chests: s.itemDrops.chests.length - ch0 };
});
await p.screenshot({ path: `${OUT}/2-banner-tent-no-loot.png` });
ck('砍倒军旗、打塌营帐：不掉兵装、不掉宝箱', r5.env && r5.banner === 'down' && r5.tent === 'down' && r5.items === 0 && r5.chests === 0, r5);
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
