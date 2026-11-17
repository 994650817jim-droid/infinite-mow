// 本局遗物 + 本局宝物并进信物库（2026-11-17，relic-to-token-proposal.md「最终转换表」）。电脑布局 1280×720。
// 需要开发服务器 5173。用法：node tools/test-charms.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
await p.addInitScript(() => {
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
  window.__find = (root, name) => { const walk = o => { if (!o) return null; if (o.name === name) return o; for (const c of o.list ?? []) { const r = walk(c); if (r) return r; } return null; }; return walk(root); };
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); }
});
const battle = async stage => {
  await p.goto(base + `?dev=1&autostart=1&stage=${stage}&layout=desktop`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; });
  await p.waitForTimeout(400);
};
await p.goto(base + '?dev=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive(), null, { timeout: 120000 });

// 1) 数据
const data = await p.evaluate(async () => {
  const ch = await window.__mod('/src/data/charms.ts'), it = await window.__mod('/src/data/items.ts'), out = {};
  out.count = ch.CHARMS.length; out.ids = ch.CHARMS.map(c => c.id);
  out.noWine = !ch.CHARMS.some(c => /wine|wind_boots|torch/.test(c.id));
  out.mechWhite = it.rollCharm('white', Math.random, 'charm_iron_mirror'); out.mechBlue = !!it.rollCharm('blue', Math.random, 'charm_iron_mirror');
  out.legendBlue = it.rollCharm('blue', Math.random, 'charm_human_seal'); out.revivalBlue = it.rollCharm('blue', Math.random, 'charm_revival_jade'); out.mirrorBlue = it.rollCharm('blue', Math.random, 'charm_heart_mirror');
  out.statWhite = !!it.rollCharm('white', Math.random, 'charm_whetstone');
  const o = it.rollCharm('orange', Math.random, 'charm_whetstone'); out.orangeAffixes = o.affixes.length; out.slot = it.itemSlot(o); out.name = it.itemName(o);
  out.text = { w: ch.charmText({ base: 'charm_whetstone', quality: 'white' }), o: ch.charmText({ base: 'charm_whetstone', quality: 'orange' }), m: ch.charmText({ base: 'charm_iron_mirror', quality: 'blue' }), seal: ch.charmText({ base: 'charm_human_seal', quality: 'purple' }) };
  let charms = 0, tokens = 0; for (let i = 0; i < 2000; i++) { const x = it.rollItem('green', Math.random, 'token'); tokens++; if (ch.charmDef(x.base)) charms++; } out.share = charms / tokens;
  let seal = 0; for (let i = 0; i < 400; i++) { const x = it.rollItem('purple', Math.random, 'token'); if (x.base === 'tiger_seal') seal = Math.max(seal, x.affixes[0].value); } out.sealMax = seal;
  return out;
});
ck('信物库新增 23 件（A 9 + B 14），酒壶、疾风靴已删，火折子并入火油囊', data.count === 23 && data.noWine, data.ids);
ck('品质限制：机制类只出蓝紫橙；传奇类、回生玉佩、护心镜只出紫橙；属性类白起', data.mechWhite === null && data.mechBlue && data.legendBlue === null && data.revivalBlue === null && data.mirrorBlue === null && data.statWhite, data);
ck('数值按最终表：磨刀石白 +2.9% / 橙 +8%，玄铁镜蓝反震 +20%，人公将印紫每 14 次震 3 敌', /2\.9%/.test(data.text.w) && /\+8%/.test(data.text.o) && /\+20%/.test(data.text.m) && /14 次/.test(data.text.seal) && /3 名/.test(data.text.seal), data.text);
ck('信物是信物栏道具，橙色带 3 条随机小词条；抽信物栏约一半出新信物', data.slot === 'token' && data.orangeAffixes === 3 && data.share > .4 && data.share < .6, { slot: data.slot, n: data.orangeAffixes, share: data.share });
ck('虎钮印（并入虎符）友军伤害主词条上限提高（紫色可超过普通上限 9.7%）', data.sealMax > .1, data.sealMax);

// 2) 升级卡池不再出遗物 / 宝物 / 饰品卡
await battle(1);
const pool = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), up = await window.__mod('/src/data/upgrades.ts'), kinds = new Set();
  s.player.level = 8; for (let i = 0; i < 400; i++) for (const o of up.buildUpgradeOptions(s.player, s.player.weapons, s.player.growth)) kinds.add(o.kind);
  return { kinds: [...kinds], hud: s.hudTexts.relics?.text ?? '', relicsField: 'relics' in s.player };
});
ck('升级三选一不再出遗物卡、宝物卡、饰品卡；人物身上没有本局遗物', !pool.kinds.some(k => ['relic', 'treasure', 'trinket'].includes(k)) && !pool.relicsField, pool);

// 3) 穿信物进战斗：属性、套装、机制类注入构筑并按品质缩放
await p.evaluate(async () => {
  const st = await window.__mod('/src/systems/ItemStore.ts'), it = await window.__mod('/src/data/items.ts'), ws = await window.__mod('/src/world/WorldStore.ts');
  ws.loadWorld(); ws.saveWorld(); const raw = JSON.parse(localStorage.getItem('im_world_v1')); raw.cleared.hulao = true; localStorage.setItem('im_world_v1', JSON.stringify(raw)); st.resetItemCache();
  st.setAutoSalvageWhite(false); const a = it.rollCharm('orange', Math.random, 'charm_whetstone'), b2 = it.rollCharm('purple', Math.random, 'charm_human_seal');
  st.addItems([a, b2]); st.equipItem('zhaoyun', a.uid); st.equipItem('zhaoyun', b2.uid);
});
await battle(1);
const fx = await p.evaluate(async () => { const s = window.__game.scene.getScene('GameScene'), g = s.player.growth, ce = await window.__mod('/src/systems/CharmEffects.ts'), b0 = ce.statsWithoutCharms(s.player);
  return { base: b0.damageMul, dmg: s.player.stats.damageMul / b0.damageMul, melee: s.player.stats.meleeMul / b0.meleeMul, legend: g.charmLegend, treasures: [...g.build.treasures], sets: s.charmInfo?.schools, hud: s.hudTexts.relics?.text };
});
ck('属性类 + 传奇类：磨刀石橙 ×1.08、人公将印紫 ×1.09，两件同属无双触发套装近战 +8%', Math.abs(fx.dmg - 1.08 * 1.09) < .002 && Math.abs(fx.melee - 1.08) < .002 && fx.legend.human_seal === 0, fx);
ck('HUD「信物」行列出穿着的信物与套装', /磨刀石/.test(fx.hud ?? '') && /无双套装/.test(fx.hud ?? ''), fx.hud);

await p.evaluate(b => { window.__base = b; }, fx.base);
const mech = await p.evaluate(async () => {
  const st = await window.__mod('/src/systems/ItemStore.ts'), it = await window.__mod('/src/data/items.ts'), s = window.__game.scene.getScene('GameScene');
  const m = it.rollCharm('blue', Math.random, 'charm_iron_mirror'), h = it.rollCharm('orange', Math.random, 'charm_heart_mirror'); st.addItems([m, h]);
  st.unequipSlot('zhaoyun', 'token'); st.unequipSlot('zhaoyun', 'token2'); st.equipItem('zhaoyun', m.uid); st.equipItem('zhaoyun', h.uid); s.refreshGear();
  const g = s.player.growth;
  return { treasures: [...g.build.treasures], power: g.build.power('iron_mirror'), bulwark: g.build.tags().bulwark, dmg: s.player.stats.damageMul / window.__base, melee: s.player.stats.meleeMul, taken: s.player.stats.damageTakenMul, legend: g.charmLegend };
});
ck('换装后撤掉旧信物效果：伤害 / 近战倍率回到 1、传奇触发撤掉', Math.abs(mech.dmg - 1) < .002 && Math.abs(mech.melee - 1) < .002 && mech.legend.human_seal === undefined, mech);
ck('机制类注入构筑宝物（玄铁镜蓝 = 强度 0.8），护心镜也计铁壁：铁壁 2 件；护心镜橙受伤 −15%', mech.treasures.join() === 'iron_mirror' && mech.power === .8 && mech.bulwark === 2 && Math.abs(mech.taken - .85) < .002, mech);

// 4) 征程构筑：存档不含信物加成、不含宝物字段；读档后不重复叠加
const camp = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), c = await window.__mod('/src/systems/Campaign.ts'), it = await window.__mod('/src/data/items.ts'), st = await window.__mod('/src/systems/ItemStore.ts');
  const w = it.rollCharm('orange', Math.random, 'charm_whetstone'); st.addItems([w]); st.unequipSlot('zhaoyun', 'token2'); st.equipItem('zhaoyun', w.uid); s.refreshGear();
  const before = s.player.stats.damageMul / window.__base, packed = c.packCampaign('zhaoyun', s.player, s.legion);
  c.saveCampaignBuild('zhaoyun', packed); const raw = JSON.parse(localStorage.getItem('im_campaign_v1')).heroes.zhaoyun;
  return { before, saved: packed.player.stats.damageMul / window.__base, hasTreasures: 'treasures' in (raw.player.build ?? {}), hasRelics: 'relics' in raw.player, hasTrinkets: 'trinkets' in (raw.player.growth ?? {}) };
});
await battle(2);
await p.evaluate(b => { window.__base = b; }, fx.base);
const camp2 = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { loaded: s.campaignLoaded, dmg: s.player.stats.damageMul / window.__base, treasures: [...s.player.growth.build.treasures] }; });
ck('征程构筑：存的属性不含信物加成；没有 relics / trinkets / build.treasures 字段', Math.abs(camp.saved - 1) < .002 && Math.abs(camp.before - 1.08) < .002 && !camp.hasTreasures && !camp.hasRelics && !camp.hasTrinkets, camp);
ck('读档进下一关：信物加成只算一次（×1.08，不叠成 ×1.17），宝物来自穿着的信物', camp2.loaded && Math.abs(camp2.dmg - 1.08) < .002 && camp2.treasures.join() === 'iron_mirror', camp2);

// 5) 旧档迁移：征程构筑里的本局宝物 / 饰品换成橙色信物放进行囊
const mig = await p.evaluate(async () => {
  const c = await window.__mod('/src/systems/Campaign.ts'), st = await window.__mod('/src/systems/ItemStore.ts'), ch = await window.__mod('/src/data/charms.ts');
  const raw = JSON.parse(localStorage.getItem('im_campaign_v1')); const z = raw.heroes.zhaoyun;
  z.player.build = { tactics: { pursuit: 1 }, treasures: ['soul_bell', 'revival_jade'] }; z.player.growth.trinkets = ['tiger_tally', 'wind_boots']; z.player.relics = ['drum'];
  localStorage.setItem('im_campaign_v1', JSON.stringify(raw)); st.resetItemCache();
  const before = st.loadItems().bag.length, b = c.loadCampaignBuild('zhaoyun'), bag = st.loadItems().bag, added = bag.slice(before);
  const again = c.loadCampaignBuild('zhaoyun'), after2 = st.loadItems().bag.length, worn = st.loadout('zhaoyun');
  return { added: added.map(i => i.base + ':' + i.quality), allOrange: added.every(i => i.quality === 'orange'), tactic: b?.player.build?.tactics?.pursuit, stripped: !b.player.build.treasures && !b.player.growth.trinkets && !b.player.relics,
    once: after2 === bag.length, notWorn: !added.some(i => Object.values(worn).some(w => w?.uid === i.uid)), charmCount: added.filter(i => ch.charmDef(i.base)).length, notice: st.loadItems().notice };
});
ck('旧档迁移：宝物 / 饰品换成同名橙色信物进行囊（追魂铃、回生玉佩、虎符→虎钮印、疾风靴→随机信物），不自动穿', mig.added.length === 4 && mig.allOrange && mig.added.includes('charm_soul_bell:orange') && mig.added.includes('charm_revival_jade:orange') && mig.added.includes('tiger_seal:orange') && mig.charmCount === 3 && mig.notWorn, mig);
ck('迁移只做一次、战法保留、旧字段清掉，行囊提示一次', mig.once && mig.tactic === 1 && mig.stripped && /本局宝物 4 件/.test(mig.notice ?? ''), mig);

// 6) 首领宝箱不再发本局遗物；伪帝玺改送 1 张战法
const chest = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); const loot = s.grantBossChest(); return loot.map(l => l.tag); });
ck('首领宝箱不再发本局遗物', !chest.some(t => /本局遗物/.test(t)), chest);
const weixi = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), b = s.player.growth.build; b.tactics = {}; s.player.growth.gear.specials.push('weixi'); s.grantWeixiTreasures(); return { tactics: Object.values(b.tactics), treasures: b.treasures.length }; });
ck('伪帝玺：开局送 1 张随机战法 Lv1', weixi.tactics.length === 1 && weixi.tactics[0] === 1, weixi);

// 7) 行囊：详情卡写出信物效果，人像下没有本局宝物格
const bag = await p.evaluate(async () => {
  const UI = await window.__mod('/src/ui/ItemBagUI.ts'), st = await window.__mod('/src/systems/ItemStore.ts'), s = window.__game.scene.getScene('GameScene');
  const ui = new UI.ItemBagUI(s, { hero: 'zhaoyun', battle: true }); await new Promise(r => setTimeout(r, 200));
  const uid = st.loadout('zhaoyun').token.uid; ui.selected = uid; ui.render(); await new Promise(r => setTimeout(r, 200));
  return { charm: window.__find(ui.root, 'item-detail-charm')?.text, treasure: !!window.__find(ui.root, 'item-treasure-0') };
});
ck('行囊详情卡写出信物效果；本局宝物格已撤', /◆/.test(bag.charm ?? '') && !bag.treasure, bag);
await p.screenshot({ path: 'assets/review/charms-bag-detail-1280x720.png' });

ck('控制台无报错', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
