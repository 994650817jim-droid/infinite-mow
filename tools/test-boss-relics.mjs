// 首领遗珍（2026-11-16，boss-drops-proposal.md 首批 10 件）：数据、掉落规则（首杀必掉 / 拥有后改掉紫装）、永不分解、
// 十件专属机制在战斗中逐个触发、行囊「珍」角标与悬停提示。电脑布局 1280×720。
// 需要开发服务器 5173。用法：node tools/test-boss-relics.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/boss-relics';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
await p.addInitScript(() => {
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
  window.__find = (root, name) => { for (const o of root.list ?? root.getChildren?.() ?? []) { if (o.name === name) return o; if (o.list) { const r = window.__find(o, name); if (r) return r; } } return null; };
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_items_v2', JSON.stringify({ version: 2, bag: [], loadouts: {}, autoSalvageWhite: false })); sessionStorage.setItem('seeded', '1'); }
});
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; });
await p.waitForTimeout(500);

// 1) 数据
const data = await p.evaluate(async () => {
  const it = await window.__mod('/src/data/items.ts'), out = {};
  out.n = it.BOSS_RELICS.length; out.stages = it.BOSS_RELICS.map(r => r.stage); out.q = it.BOSS_RELICS.map(r => r.quality);
  out.slots = [...new Set(it.BOSS_RELICS.map(r => it.itemDef(r.id).slot))].sort();
  const r = it.rollRelic('relic_jiujie', () => .5); out.roll = { base: r.base, q: r.quality, special: r.special, affixes: r.affixes.length, name: it.itemName(r) };
  out.noDup = it.BOSS_RELICS.every(x => !it.BASE_ITEMS.some(b => b.id === x.id) && !it.LEGENDS.some(l => l.id === x.id));
  return out;
});
ck('首批 10 件遗珍：第一章紫、其余橙；都在 4 个兵装槽里；不与现有 66 件重名', data.n === 10 && data.q.slice(0, 2).every(q => q === 'purple') && data.q.slice(2).every(q => q === 'orange') && JSON.stringify(data.slots) === '["helm","token"]' && data.noDup, data);
ck('关卡键覆盖张梁、张角、华雄、董卓、吕布挑战、张绣、袁术、淳于琼、曹纯、蔡瑁', JSON.stringify(data.stages) === JSON.stringify(['huangjin-1', 'huangjin-3', 'hulao-1', 'hulao-3', 'lubu', 'third-2', 'third-3', 'guandu-3', 'chibi-1', 'chibi-2']), data.stages);
ck('生成遗珍：固定 2 条词条 + 1 条随机小词条 + 专属机制', data.roll.base === 'relic_jiujie' && data.roll.q === 'purple' && data.roll.special === 'jiujie' && data.roll.affixes === 3 && data.roll.name === '九节杖', data.roll);

// 2) 掉落规则
const drop = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), d = s.itemDrops, out = {}; d.runLoot.length = 0; d.rng = () => .5;
  d.relicStage = () => 'huangjin-3'; const first = d.bossRelicDrop(); out.first = first?.base;
  d.runLoot.push(first); const again = d.bossRelicDrop(); out.again = [again?.base, again?.quality];
  d.relicStage = () => 'hulao-2'; out.none = d.bossRelicDrop();
  d.relicStage = () => 'huangjin-1'; d.runLoot.length = 0; const before = d.runLoot.length; d.onKill({ kind: 'boss', x: s.player.x, y: s.player.y }); out.killOnly = d.runLoot.slice(before).map(i => i.base); d.claimBossRelic(); out.bossKill = d.runLoot.slice(before).map(i => i.base);
  out.lubuKey = window.__game.scene.getScene('LubuGameScene')?.bossRelicKey?.call({}) ?? 'missing';
  d.rng = Math.random; d.relicStage = () => s.bossRelicKey(); return out;
});
ck('首杀必掉核心遗珍（张角 → 九节杖）', drop.first === 'relic_jiujie', drop);
ck('已拥有后再击败：改为多掉一件至少紫色的兵装', drop.again[0] !== 'relic_jiujie' && ['purple', 'orange'].includes(drop.again[1]), drop.again);
ck('没有遗珍的关（徐荣）不额外掉；张梁的人公符水不在击杀瞬间给、捡首领宝箱时才给（2026-11-17 宝箱流程）；吕布挑战关键为 lubu', drop.none === null && !drop.killOnly.includes('relic_fushui') && drop.bossKill.includes('relic_fushui') && drop.bossKill.length >= 2 && drop.lubuKey === 'lubu', drop);

// 3) 永不分解
const keep = await p.evaluate(async () => {
  const st = await window.__mod('/src/systems/ItemStore.ts'), it = await window.__mod('/src/data/items.ts'), out = {};
  const r = it.rollRelic('relic_chize'); st.addItems([r]); out.salvage = st.salvageItems([r.uid]); out.upTo = (st.salvageUpTo('orange'), st.loadItems().bag.some(i => i.uid === r.uid));
  st.addItems(Array.from({ length: 90 }, () => it.rollItem('orange'))); out.overflow = st.loadItems().bag.some(i => i.uid === r.uid);
  st.salvageUpTo('orange'); return out;
});
ck('遗珍永不分解：单件分解、一键分解、行囊超上限都不会动它', keep.salvage === 0 && keep.upTo && keep.overflow, keep);

// 4) 十件机制
const mech = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), st = await window.__mod('/src/systems/ItemStore.ts'), it = await window.__mod('/src/data/items.ts'), HM = (await window.__mod('/src/systems/HeroMount.ts')).HeroMount, R = (await window.__mod('/src/systems/BossRelics.ts')).RELIC, out = {}, pl = s.player, now = () => s.combatNow;
  const wear = id => { const r = it.rollRelic(id); r.affixes = r.affixes.filter(x => !x.minor); /* 去掉随机小词条，免得干扰倍率检查 */ st.addItems([r]); st.equipItem('zhaoyun', r.uid); s.refreshGear(); return r; };
  const take = slot => { st.unequipSlot('zhaoyun', slot); s.refreshGear(); };
  const foe = (kind, dx, dy, hp = 9999) => { const e = s.spawnEnemy(kind, pl.x + dx, pl.y + dy, 1, true); e.speed = 0; e.hp = e.maxHp = hp; return e; };
  const clearFoes = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0, e.deactivate?.(); };
  // 斩将赤帻
  wear('relic_chize'); clearFoes(); const el = foe('elite', 80, 0); s.player.stats.critChance = 0;
  const h0 = el.hp; s.hitEnemy(el, 10, now(), 'melee', false, true); const d1 = h0 - el.hp; const h1 = el.hp; s.hitEnemy(el, 10, now(), 'melee', false, true); const d2 = h1 - el.hp;
  out.zhanjiang = { d1, d2, first: s.relics.metrics.firstStrikes }; take('helm');
  // 辕门戟影：第 8 次命中贯穿直线
  wear('relic_jiying'); clearFoes(); const t = foe('infantry', 60, 0), behind = foe('infantry', 300, 4), off = foe('infantry', 200, 150);
  const hb = behind.hp, ho = off.hp; for (let i = 0; i < 8; i++) s.relics.onWeaponHit(t, 20, now());
  out.jiying = { n: s.relics.metrics.jiying, behind: hb - behind.hp, off: ho - off.hp };
  // 百鸟朝凤缨：同一目标连击 5 次
  wear('relic_bainiao'); clearFoes(); const tt = foe('infantry', 50, 0), side = foe('infantry', 90, 30), back = foe('infantry', -90, 0); const hs = side.hp, hbk = back.hp;
  for (let i = 0; i < 5; i++) s.relics.onWeaponHit(tt, 20, now()); out.bainiao = { n: s.relics.metrics.bainiao, side: hs - side.hp, back: hbk - back.hp }; take('helm');
  // 九节杖：落雷劈生命最多的敌人
  wear('relic_jiujie'); clearFoes(); const big = foe('infantry', 100, 0, 5000), small = foe('infantry', 120, 0, 200); const hbig = big.hp;
  s.relics.nextBolt = now(); s.relics.update(now()); out.jiujie = { bolts: s.relics.metrics.bolts, big: hbig - big.hp };
  // 人公符水：40 颗宝石召出力士
  wear('relic_fushui'); for (let i = 0; i < 40; i++) s.relics.onGem(now()); out.fushui = { n: s.relics.metrics.lishi, img: !!s.children.getByName('relic-lishi') };
  // 相国印：120 杀后下一次升级连选两张、免费换一批
  wear('relic_xiangguo'); for (let i = 0; i < 120; i++) s.relics.onKill();
  s.pendingLevels = 1; s.openUpgrade(); await new Promise(r => setTimeout(r, 200));
  out.xiangguo = { hint: s.levelPanel.getByName('upgrade-points-hint')?.text, reroll: s.rerollButton?.text, food0: s.legion.food };
  s.rerollUpgrades(); out.xiangguo.foodAfter = s.legion.food; out.xiangguo.rerollAfter = s.rerollButton?.text;
  s.chooseUpgrade(0); out.xiangguo.after1 = [s.mode, s.upgradeOptions.length]; s.chooseUpgrade(0); out.xiangguo.after2 = [s.mode, s.pendingLevels];
  // 传国玉玺（伪）：受伤 +15%，开局送宝物
  const in0 = pl.growth.incomingDamageMultiplier(); wear('relic_weixi'); out.weixi = { taken: Math.round(pl.growth.incomingDamageMultiplier() / in0 * 100) / 100 };
  pl.growth.build.treasures.length = 0; pl.growth.trinkets.length = 0; s.grantWeixiTreasures(); out.weixi.treasures = pl.growth.build.treasures.length;
  // 乌巢酒葫：酒后伤害 +40%、走路踉跄
  wear('relic_jiuhu'); const dm0 = pl.growth.damageMultiplier(now()); s.relics.onWine(now()); const dm1 = pl.growth.damageMultiplier(now());
  const v = new Phaser.Math.Vector2(1, 0); s.relics.jitterAt = 0; s.relics.sway(v, now()); out.jiuhu = { ratio: Math.round(dm1 / dm0 * 100) / 100, angle: Math.round(Math.abs(v.angle() > Math.PI ? v.angle() - 2 * Math.PI : v.angle()) * 1000) / 1000 };
  // 楼船令旗：穿上开火船，脱下停
  wear('relic_louchuan'); out.louchuan = { on: !!s.relicShips, interval: s.relicShips?.interval }; take('token'); out.louchuan.off = !s.relicShips;
  // 虎豹铁面：坐骑践踏 ×2、6 秒上马
  const m1 = new HM({ scene: s, player: pl, enemies: s.enemies, hit: () => {}, notice: () => {} }, { base: 'nag', name: '驽马' }, 'liubei', { trampleMul: R.hubaoTrample, remountMs: R.hubaoRemountMs });
  const m0 = new HM({ scene: s, player: pl, enemies: s.enemies, hit: () => {}, notice: () => {} }, { base: 'nag', name: '驽马' }, 'liubei');
  out.hubao = { t: m1.trampleMul / m0.trampleMul, r: [m1.remountMs, m0.remountMs] }; m1.clear(); m0.clear(); pl.mountSpeedMul = 1; pl.riseY = 0;
  st.unequipSlot('zhaoyun', 'token'); st.unequipSlot('zhaoyun', 'helm'); s.refreshGear(); clearFoes(); s.setMode('none');
  return out;
});
ck('斩将赤帻：对精锐的第一击必暴击并再 ×2，第二击恢复正常', mech.zhanjiang.first === 1 && mech.zhanjiang.d1 >= mech.zhanjiang.d2 * 3, mech.zhanjiang);
ck('辕门戟影：第 8 次命中甩出戟影，打中直线后方的敌人、不打偏离直线的', mech.jiying.n === 1 && mech.jiying.behind > 0 && mech.jiying.off === 0, mech.jiying);
ck('百鸟朝凤缨：同一目标连击 5 次扇形刺出，打前方扇区、不打身后', mech.bainiao.n === 1 && mech.bainiao.side > 0 && mech.bainiao.back === 0, mech.bainiao);
ck('九节杖：落雷劈中生命最多的敌人', mech.jiujie.bolts === 1 && mech.jiujie.big > 0, mech.jiujie);
ck('人公符水：拾取 40 颗宝石召出黄巾力士', mech.fushui.n === 1 && mech.fushui.img, mech.fushui);
ck('相国印：120 杀后升级提示「连选两张」、换一批免费；选第一张后还能再选一张，第二张后结束', /相国印/.test(mech.xiangguo.hint ?? '') && /免费/.test(mech.xiangguo.reroll ?? '') && mech.xiangguo.foodAfter === mech.xiangguo.food0 && mech.xiangguo.after1[0] === 'levelup' && mech.xiangguo.after1[1] === 2 && mech.xiangguo.after2[1] === 0, mech.xiangguo);
ck('传国玉玺（伪）：受到伤害 ×1.15，开局补满 2 件宝物', mech.weixi.taken === 1.15 && mech.weixi.treasures === 2, mech.weixi);
ck('乌巢酒葫：拾取酒后伤害 ×1.4，移动方向被随机偏转', mech.jiuhu.ratio === 1.4 && mech.jiuhu.angle > 0 && mech.jiuhu.angle <= Math.PI / 12 + .001, mech.jiuhu);
ck('楼船令旗：穿上即开 12 秒一列的火船，脱下停止', mech.louchuan.on && mech.louchuan.interval === 12000 && mech.louchuan.off, mech.louchuan);
ck('虎豹铁面：践踏伤害 ×2，上马间隔 6 秒（原 15 秒）', mech.hubao.t === 2 && JSON.stringify(mech.hubao.r) === '[6000,15000]', mech.hubao);
await p.screenshot({ path: `${out}/desktop-battle.png` });

// 5) 行囊：珍角标、详情不可分解、悬停提示
await p.goto(base + '?layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive() && window.__game.scene.getScene('MenuScene').children.length > 5, null, { timeout: 120000 });
await p.waitForTimeout(600);
const ui = await p.evaluate(async () => {
  const m = window.__game.scene.getScene('MenuScene'), st = await window.__mod('/src/systems/ItemStore.ts'), it = await window.__mod('/src/data/items.ts'), out = {};
  for (const id of ['relic_xiangguo', 'relic_bainiao']) st.addItems([it.rollRelic(id)]);
  /* 主页已不放行囊匾（用户要求），行囊界面本身照旧，直接打开 */ { const UI = await window.__mod('/src/ui/ItemBagUI.ts'); new UI.ItemBagUI(m, { hero: 'zhaoyun' }); } await new Promise(r => setTimeout(r, 300));
  const bag = m.children.getByName('item-bag'), cells = [0, 1, 2, 3, 4, 5].map(k => window.__find(bag, 'item-cell-' + k)).filter(Boolean);
  const rc = cells.find(c => /^relic_/.test(st.loadItems().bag.find(i => i.uid === c.getData('uid'))?.base ?? '')); out.badge = !!rc && !!window.__find(rc, 'item-relic-badge');
  const rs = m.cameras.main.zoom; rc.emit('pointerover', { x: 200 * rs, y: 200 * rs }); const tip = m.children.getByName('item-tooltip'); out.tip = tip.list.filter(o => o.type === 'Text').map(o => o.text).join('|'); rc.emit('pointerout');
  rc.emit('pointerdown'); rc.emit('pointerup'); await new Promise(r => setTimeout(r, 150));
  const card = window.__find(m.children.getByName('item-bag'), 'item-detail'); out.detail = window.__find(card, 'item-detail-quality')?.text; out.salvage = window.__find(card, 'item-salvage')?.text; out.salvageOff = !window.__find(card, 'item-salvage')?.input?.enabled;
  return out;
});
ck('行囊里遗珍有「珍」角标；悬停提示写明「首领遗珍（首领名）」', ui.badge && /首领遗珍（(董卓|张绣)）/.test(ui.tip ?? ''), ui);
ck('遗珍详情卡：标明首领遗珍，分解按钮为「遗珍不可分解」且不可点', /首领遗珍 · (董卓|张绣)/.test(ui.detail ?? '') && ui.salvage === '遗珍不可分解' && ui.salvageOff, ui);
await p.screenshot({ path: `${out}/desktop-bag-relic.png` });

ck('控制台无报错', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
