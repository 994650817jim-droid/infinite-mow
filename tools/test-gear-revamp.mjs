// 兵装改版（2026-11-16，gear-revamp-proposal.md）：旧档迁移、背包容量、保底、马厩（解锁 / 赠马 / 换马限制）、
// 战斗中换装（HUD 行囊、穿上缴获、生命按比例）、宝物栏、拖拽穿戴 / 卸下、主页角标。手机 390×844 与电脑 1280×720 截图。
// 需要开发服务器 5173。用法：node tools/test-gear-revamp.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/items';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')", M = "window.__game.scene.getScene('MenuScene')";
const FIND = `window.__find=(root,name)=>{const list=root.list??root.getChildren?.()??[];for(const o of list){if(o.name===name)return o;if(o.list){const r=window.__find(o,name);if(r)return r;}}return null;};
window.__tap=o=>{o.emit('pointerdown');o.emit('pointerup');};
window.__mod=async part=>import(performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes(part))??('/src/'+part.replace(/^\\//,'')));`;
async function page(layout, viewport) {
  const p = await b.newPage({ viewport, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(layout + ' console ' + m.text()); });
  await p.addInitScript(FIND);
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
  return p;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const p = await page('mobile', { width: 390, height: 844 });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=mobile');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 60000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; }, G);
await p.waitForTimeout(400);

// 1) 旧档迁移（纯函数）
const mig = await p.evaluate(async () => {
  const st = await window.__mod('/src/systems/ItemStore.ts');
  const it = (uid, base, quality) => ({ uid, base, quality, affixes: [{ id: 'move', value: .02 }] });
  const v1 = { version: 1, salvaged: 5, bag: [it('w1', 'sword_tassel', 'white'), it('w2', 'blade_ring', 'purple'), it('q1', 'qinggang', 'orange'), it('y1', 'yitian', 'orange'), it('t1', 'gold_seal', 'blue'),
    it('h1', 'chitu', 'orange'), it('h2', 'chitu', 'purple'), it('h3', 'nag', 'white'), it('a1', 'lamellar', 'green'), { uid: 'bad', base: 'nope', quality: 'blue', affixes: [] }],
    loadouts: { zhaoyun: { weapon: 'q1', armor: 'a1', mount: 'h2' }, guanyu: { weapon: 'y1', token: 't1', mount: 'h1' }, machao: { weapon: 'w2', mount: 'h3' } } };
  const m = st.migrateV1(v1), s = m.save;
  return { legacyN: m.legacy, legacy: s.legacy.map(i => i.uid).sort(), weapons: m.weapons, horses: m.horses, bag: s.bag.map(i => i.uid).sort(), zhao: s.loadouts.zhaoyun, guan: s.loadouts.guanyu, ma: s.loadouts.machao ?? null,
    owned: s.stable.owned, riders: s.stable.riders, salvaged: s.salvaged, notice: s.notice };
});
ck('迁移无损：普通兵刃和重复的赤兔原样收进「旧物」，不折钱', mig.weapons === 2 && mig.legacyN === 3 && JSON.stringify(mig.legacy) === '["h2","w1","w2"]' || JSON.stringify(mig.legacy) === '["h1","w1","w2"]', mig);
ck('迁移：青釭剑转到赵云信物槽；关羽信物已有，倚天剑退回行囊', mig.zhao?.token === 'q1' && mig.zhao?.armor === 'a1' && mig.guan?.token === 't1' && mig.bag.includes('y1') && !mig.bag.includes('w1') && !mig.bag.includes('bad'), mig);
ck('迁移：坐骑转入马厩（同种一匹），原骑者继续骑', JSON.stringify(mig.owned) === '["chitu","nag"]' && mig.riders.zhaoyun === 'chitu' && mig.riders.machao === 'nag' && !mig.riders.guanyu && mig.ma === null, mig);
ck('迁移：生成一次性提示', /旧兵刃 2 件收进「旧物」/.test(mig.notice ?? '') && /2 匹马已转入马厩/.test(mig.notice ?? ''), mig.notice);
const mig2 = await p.evaluate(async () => {
  const st = await window.__mod('/src/systems/ItemStore.ts'), ws = await window.__mod('/src/world/WorldStore.ts');
  localStorage.setItem('im_items_v1', JSON.stringify({ version: 1, bag: [{ uid: 'w9', base: 'jade_hilt', quality: 'blue', affixes: [] }, { uid: 'a9', base: 'lamellar', quality: 'green', affixes: [] }], loadouts: {}, salvaged: 0 }));
  localStorage.removeItem('im_items_v2'); localStorage.removeItem('im_chapter1_cleared'); st.resetItemCache();
  const money0 = ws.loadWorld().town.money, s = st.loadItems();
  const v2 = JSON.parse(localStorage.getItem('im_items_v2') ?? 'null'), v1 = JSON.parse(localStorage.getItem('im_items_v1') ?? 'null');
  const notice = st.takeItemNotice(), again = st.takeItemNotice(), noMoney = ws.loadWorld().town.money - money0, legacy = st.loadItems().legacy.length, value = st.legacyValue();
  const got = st.salvageLegacy();
  return { bag: s.bag.length, v2: v2?.version, v1kept: v1?.bag?.length, noMoney, legacy, value, got, moneyDelta: ws.loadWorld().town.money - money0, after: st.loadItems().legacy.length, notice, again: again ?? null };
});
ck('读档：只有 v1 时自动迁移写入 im_items_v2，v1 原样保留', mig2.bag === 1 && mig2.v2 === 2 && mig2.v1kept === 2, mig2);
ck('读档迁移的提示只给一次', !!mig2.notice && mig2.again === null, mig2);
ck('旧物由玩家决定分解：迁移时不加钱，分解时按双倍价（蓝 12×2）', mig2.noMoney === 0 && mig2.legacy === 1 && mig2.value === 24 && mig2.got === 24 && mig2.moneyDelta === 24 && mig2.after === 0, mig2);

// 2) 背包容量、自动分解白色
const cap = await p.evaluate(async () => {
  const st = await window.__mod('/src/systems/ItemStore.ts'), items = await window.__mod('/src/data/items.ts');
  localStorage.removeItem('im_items_v2'); localStorage.removeItem('im_items_v1'); st.resetItemCache();
  const out = {};
  st.addItems([items.rollItem('white'), items.rollItem('green')]); out.autoWhite = st.loadItems().bag.map(i => i.quality);
  const helm = items.rollItem('blue', Math.random, 'helm'); st.addItems([helm]); st.equipItem('zhaoyun', helm.uid);
  st.addItems(Array.from({ length: 70 }, () => items.rollItem('blue'))); out.blue = [st.looseCount(), st.loadItems().bag.length];
  st.addItems(Array.from({ length: 30 }, () => items.rollItem('purple'))); const s1 = st.loadItems(); out.purple = [st.looseCount(), s1.bag.filter(i => i.quality === 'purple').length, s1.bag.filter(i => i.quality === 'blue').length];
  st.addItems(Array.from({ length: 30 }, () => items.rollItem('orange'))); const s2 = st.loadItems(); out.orange = [st.looseCount(), s2.bag.filter(i => i.quality === 'orange').length, s2.bag.filter(i => i.quality === 'blue').length];
  st.addItems(Array.from({ length: 30 }, () => items.rollItem('orange'))); const s3 = st.loadItems(); out.over = [st.looseCount(), s3.bag.filter(i => i.quality === 'orange').length, s3.bag.filter(i => i.quality === 'purple').length];
  out.wornKept = st.loadItems().bag.some(i => i.uid === helm.uid);
  return out;
});
ck('自动分解白色默认开：白色收入时直接折钱', JSON.stringify(cap.autoWhite) === '["green"]', cap);
ck('穿着的不占格：未穿戴超过 60 件时分解最低品质（蓝）', cap.blue[0] === 60 && cap.blue[1] === 61, cap);
ck('满了先分解白 / 绿 / 蓝，紫 / 橙保留', cap.purple[1] === 30 && cap.purple[0] === 60 && cap.orange[0] === 60 && cap.orange[1] === 30 && cap.orange[2] === 1 && cap.wornKept, cap);
ck('只剩紫 / 橙时可超出上限，最多超 20 格（再多才分解最低的紫）', cap.over[0] === 80 && cap.over[1] === 60 && cap.over[2] === 20, cap);

// 3) 品级表与保底
const pity = await p.evaluate(async () => {
  const m = await window.__mod('/src/data/items.ts'), out = {};
  const ps = { sincePurple: 0, sinceOrange: 0 }, seq = []; for (let i = 0; i < 40; i++) seq.push(m.rollDropQuality('normal', 0, ps, () => 0));
  out.p15 = seq[14]; out.before = seq.slice(0, 14).every(q => q === 'white'); out.p30 = seq[29]; out.o40 = seq[39]; out.state = ps;
  const cnt = (src, tier) => { const c = {}; for (let i = 0; i < 20000; i++) { const q = m.rollQuality(src, tier); c[q] = (c[q] ?? 0) + 1; } return c; };
  out.final1 = cnt('finalBoss', 1); out.boss0 = cnt('boss', 0); out.normal4 = cnt('normal', 4);
  return out;
});
ck('保底：连续 14 件没出紫，第 15 件必紫；第 40 件必橙', pity.before && pity.p15 === 'purple' && pity.p30 === 'purple' && pity.o40 === 'orange' && pity.state.sinceOrange === 0, pity);
ck('第一章首领必蓝；第二章章末首领必紫；第五章单独一档（无白）', !pity.boss0.white && !pity.boss0.green && !pity.final1.blue && !pity.final1.green && !pity.normal4.white && pity.normal4.orange > 1800, pity);

// 4) 马厩：解锁、赠马、加成
const stable = await p.evaluate(async () => {
  const st = await window.__mod('/src/systems/ItemStore.ts'), fx = await window.__mod('/src/systems/ItemEffects.ts'), mo = await window.__mod('/src/data/mounts.ts'), out = {};
  localStorage.removeItem('im_items_v2'); localStorage.removeItem('im_chapter1_cleared'); st.resetItemCache();
  out.lockedOwned = st.loadItems().stable.owned.length; out.locked = st.stableUnlocked(); out.announceLocked = st.takeStableAnnouncement();
  st.grantHorse('chitu'); st.rideHorse('guanyu', 'chitu'); out.lockedHorse = !!st.heroHorse('guanyu');
  localStorage.setItem('im_chapter1_cleared', 'true'); st.resetItemCache();
  out.owned = st.loadItems().stable.owned; out.horse = st.heroHorse('guanyu')?.id; out.gear = fx.gearFor('guanyu'); out.badge = st.bagBadgeCount();
  out.announce = [st.takeStableAnnouncement(), st.takeStableAnnouncement()];
  st.rideHorse('zhaoyun', 'chitu'); out.moved = [st.heroHorse('zhaoyun')?.id, st.heroHorse('guanyu')?.id ?? null];
  out.again = st.grantHorse('chitu'); out.reward = ['huangjin-3', 'hulao-1', 'hulao-3', 'third-3', 'guandu-3', 'chibi-3'].map(k => mo.horseForReward(k)?.id);
  out.all = new Set(mo.HORSES.map(h => h.reward)).size === mo.HORSES.length && mo.HORSES.length === 11;
  return out;
});
ck('马厩：第一章通关前不开放（有马也不骑），无公告', stable.lockedOwned === 0 && !stable.locked && !stable.lockedHorse && !stable.announceLocked, stable);
ck('第一章通关：送驽马、马的固定加成计入兵装、角标提示一次', JSON.stringify(stable.owned) === '["nag","chitu"]' && stable.horse === 'chitu' && stable.gear.move > 0 && stable.gear.damage > 0 && stable.badge >= 1 && stable.announce[0] && !stable.announce[1], stable);
ck('一匹马同时只归一名武将；已有的马不重复赠送', stable.moved[0] === 'chitu' && stable.moved[1] === null && stable.again === false, stable);
ck('11 匹马各对应一个首领首次击杀（一章送驽马、虎牢吕布送赤兔……）', stable.all && JSON.stringify(stable.reward) === '["nag","grey_horse","chitu","white_horse","jueying","dilu"]', stable);

// 5) 战斗中：HUD 行囊、宝物栏、穿上缴获、换马限制
const hud = await p.evaluate(async G0 => {
  const s = eval(G0), st = await window.__mod('/src/systems/ItemStore.ts'), items = await window.__mod('/src/data/items.ts'), out = {};
  s.player.growth.build.treasures.push('iron_mirror');
  const btn = s.hudTexts.bag; out.btn = !!btn?.visible && btn.text;
  window.__tap(btn); await new Promise(r => setTimeout(r, 200));
  let bag = s.children.getByName('item-bag'); out.open = !!bag; out.mode = s.mode;
  out.treasure = window.__find(bag, 'item-treasure-label-0')?.text; out.treasure2 = window.__find(bag, 'item-treasure-label-1')?.text;
  window.__tap(window.__find(bag, 'item-treasure-0')); await new Promise(r => setTimeout(r, 120)); bag = s.children.getByName('item-bag');
  out.treasureCard = window.__find(bag, 'item-detail-name')?.text; window.__find(bag, 'item-detail-close').emit('pointerdown'); await new Promise(r => setTimeout(r, 100));
  bag = s.children.getByName('item-bag'); window.__tap(window.__find(bag, 'item-slot-mount')); await new Promise(r => setTimeout(r, 120)); bag = s.children.getByName('item-bag');
  out.stableHint = window.__find(bag, 'stable-hint')?.text; out.noRide = !window.__find(bag, 'stable-ride-nag') && !window.__find(bag, 'stable-dismount');
  return out;
}, G);
ck('战斗 HUD 右上常驻「行囊」，点开自动暂停', hud.btn === '行囊' && hud.open && hud.mode === 'pause', hud);
ck('行囊里显示本局宝物（玄铁镜），空格写「空」，点开看效果', hud.treasure === '玄铁镜' && hud.treasure2 === '空' && hud.treasureCard === '玄铁镜', hud);
ck('战斗中点坐骑位：马厩只看不能换', /战斗中不可换马/.test(hud.stableHint ?? '') && hud.noRide, hud);
await p.screenshot({ path: `${out}/mobile-battle-stable-locked.png` });
const claim = await p.evaluate(async G0 => {
  const s = eval(G0), st = await window.__mod('/src/systems/ItemStore.ts'), items = await window.__mod('/src/data/items.ts'), out = {};
  window.__find(s.children.getByName('item-bag'), 'item-detail-close').emit('pointerdown'); await new Promise(r => setTimeout(r, 80));
  window.__find(s.children.getByName('item-bag'), 'item-bag-close').emit('pointerdown'); await new Promise(r => setTimeout(r, 120));
  out.closedMode = s.mode;
  const armor = { uid: 'loot-armor', base: 'bright_plate', quality: 'purple', affixes: [{ id: 'hp', value: .3 }] };
  s.itemDrops.runLoot.push(armor); st.unequipSlot('zhaoyun', 'armor'); s.refreshGear(); s.player.hp = Math.round(s.player.maxHp / 2);
  const max0 = s.player.maxHp;
  out.claimed = st.claimRunLoot('zhaoyun', armor); s.itemDrops.takeLoot(armor.uid); s.refreshGear();
  out.max = [max0, s.player.maxHp]; out.ratio = Math.round(s.player.hp / s.player.maxHp * 100); out.inLoot = s.itemDrops.runLoot.some(i => i.uid === armor.uid);
  out.worn = st.loadout('zhaoyun').armor?.uid;
  s.openBattleBag(true); await new Promise(r => setTimeout(r, 150)); let bag = s.children.getByName('item-bag');
  window.__tap(window.__find(bag, 'item-slot-mount')); await new Promise(r => setTimeout(r, 120)); bag = s.children.getByName('item-bag');
  out.rideBtn = !!window.__find(bag, 'stable-ride-nag'); window.__find(bag, 'stable-ride-nag')?.emit('pointerdown'); await new Promise(r => setTimeout(r, 120));
  out.rode = st.heroHorse('zhaoyun')?.id; out.notice = window.__find(s.children.getByName('item-bag'), 'item-notice')?.text;
  return out;
}, G);
ck('关掉行囊继续战斗', claim.closedMode === 'none', claim);
ck('战斗中穿上缴获：立刻收入行囊并穿上，离开本局缴获（败退不丢）', claim.claimed && claim.worn === 'loot-armor' && !claim.inLoot, claim);
ck('换装后生命上限变化、生命按原比例换算（不回满）', claim.max[1] > claim.max[0] && claim.ratio >= 49 && claim.ratio <= 51, claim);
ck('行营休整时可以换马（下一关出征生效）', claim.rideBtn && claim.rode === 'nag' && /下一关出征生效/.test(claim.notice ?? ''), claim);
await p.screenshot({ path: `${out}/mobile-rest-stable.png` });
await p.evaluate(G0 => { const s = eval(G0); window.__find(s.children.getByName('item-bag'), 'item-bag-close').emit('pointerdown'); }, G);
await p.waitForTimeout(150);
await p.screenshot({ path: `${out}/mobile-battle-hud-bag.png` });

// 6) 主页：角标、纸娃娃、拖拽
await p.evaluate(async () => { const st = await window.__mod('/src/systems/ItemStore.ts'), items = await window.__mod('/src/data/items.ts'); st.setAutoSalvageWhite(false);
  { const raw = JSON.parse(localStorage.getItem('im_items_v2')); raw.legacy = [{ uid: 'old-1', base: 'sword_tassel', quality: 'green', affixes: [{ id: 'attackSpeed', value: .02 }] }]; localStorage.setItem('im_items_v2', JSON.stringify(raw)); st.resetItemCache(); } st.addItems(['blue', 'purple', 'green', 'orange'].map((q, i) => items.rollItem(q, Math.random, ['helm', 'boots', 'token', 'armor'][i]))); });
await p.goto(base + '?layout=mobile');
await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive() && window.__game.scene.getScene('MenuScene').children.getByName('home-bag-plaque'), null, { timeout: 60000 });
await p.waitForTimeout(800);
const badge = await p.evaluate(M0 => eval(M0).children.getByName('home-bag-badge')?.text, M);
ck('主页行囊角标显示新收入件数', Number(badge) >= 4, badge);
await p.screenshot({ path: `${out}/mobile-home-badge.png` });
const drag = await p.evaluate(async M0 => {
  const m = eval(M0), st = await window.__mod('/src/systems/ItemStore.ts'), items = await window.__mod('/src/data/items.ts'), out = {};
  const plaque = m.children.getByName('home-bag-plaque'), hit = m.children.getByName('home-bag') ?? window.__find(plaque, 'home-bag'); hit.emit('pointerdown'); await new Promise(r => setTimeout(r, 300));
  out.badgeGone = !m.children.getByName('home-bag-badge')?.active; out.badgeCount = st.bagBadgeCount();
  { let bg = m.children.getByName('item-bag'); out.legacyBtn = window.__find(bg, 'item-legacy')?.text; window.__find(bg, 'item-legacy')?.emit('pointerdown'); await new Promise(r => setTimeout(r, 120)); bg = m.children.getByName('item-bag');
    out.legacyList = window.__find(bg, 'item-legacy-list')?.text; await window.__shot?.(); window.__find(bg, 'item-legacy-salvage')?.emit('pointerdown'); await new Promise(r => setTimeout(r, 120)); out.legacySalvaged = st.loadItems().legacy.length === 0 && !window.__find(m.children.getByName('item-bag'), 'item-legacy'); }
  let bag = m.children.getByName('item-bag'); out.portrait = !!window.__find(bag, 'item-portrait');
  st.unequipSlot('zhaoyun', 'helm'); window.__tap(window.__find(bag, 'item-filter-helm')); await new Promise(r => setTimeout(r, 100)); bag = m.children.getByName('item-bag');
  window.__find(bag, 'item-filter-helm').emit('pointerdown'); await new Promise(r => setTimeout(r, 100)); bag = m.children.getByName('item-bag');
  const cell = window.__find(bag, 'item-cell-0'), uid = cell.getData('uid'), slot = window.__find(bag, 'item-slot-helm'), boots = window.__find(bag, 'item-slot-boots');
  const dragTo = (o, x, y) => { o.emit('dragstart', {}, o.x, o.y); o.emit('drag', {}, x, y); const tip = window.__find(m.children.getByName('item-bag'), 'item-drag-tip'); out.tip = out.tip ?? (tip?.visible ? tip.text : ''); o.emit('dragend', {}, x, y, true); };
  dragTo(cell, boots.x, boots.y); await new Promise(r => setTimeout(r, 250)); out.wrong = st.loadout('zhaoyun').helm?.uid ?? null;
  bag = m.children.getByName('item-bag'); out.wrongNotice = window.__find(bag, 'item-notice')?.text;
  const cell2 = window.__find(bag, 'item-cell-0'); out.tip = undefined; dragTo(cell2, slot.x, slot.y); await new Promise(r => setTimeout(r, 200));
  out.worn = st.loadout('zhaoyun').helm?.uid === uid;
  bag = m.children.getByName('item-bag'); const slot2 = window.__find(bag, 'item-slot-helm'), grid = window.__find(bag, 'item-cell-0') ?? window.__find(bag, 'item-page');
  dragTo(slot2, grid.x, grid.y); await new Promise(r => setTimeout(r, 200)); out.off = !st.loadout('zhaoyun').helm;
  bag = m.children.getByName('item-bag'); window.__tap(window.__find(bag, 'item-filter-all'));
  window.__find(m.children.getByName('item-bag'), 'item-filter-all').emit('pointerdown'); await new Promise(r => setTimeout(r, 100));
  bag = m.children.getByName('item-bag'); window.__tap(window.__find(bag, 'item-slot-mount')); await new Promise(r => setTimeout(r, 150));
  bag = m.children.getByName('item-bag'); out.homeRide = !!window.__find(bag, 'stable-ride-chitu') || !!window.__find(bag, 'stable-dismount');
  return out;
}, M);
ck('打开行囊后角标清零', drag.badgeGone && drag.badgeCount === 0, drag);
ck('有旧物时行囊顶部有「旧物」按钮，卡片列出旧兵刃并可全部分解', drag.legacyBtn === '旧物 1' && /剑穗/.test(drag.legacyList ?? '') && drag.legacySalvaged, drag);
ck('拖到不对应的槽：弹回并提示', drag.wrong === null && /只能放进头盔槽/.test(drag.wrongNotice ?? ''), drag);
ck('从行囊拖到头盔槽：穿上', drag.worn, drag);
ck('从装备槽拖回行囊：卸下', drag.off, drag);
ck('主页（休整）可在马厩换马', drag.homeRide, drag);
await p.screenshot({ path: `${out}/mobile-home-stable.png` });
await p.evaluate(M0 => { const bag = eval(M0).children.getByName('item-bag'); window.__find(bag, 'item-detail-close').emit('pointerdown'); }, M);
await p.waitForTimeout(150);
await p.screenshot({ path: `${out}/mobile-home-doll.png` });
await p.close();

// 电脑
const d = await page('desktop', { width: 1280, height: 720 });
await d.goto(base + '?layout=desktop');
await d.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive() && window.__game.scene.getScene('MenuScene').children.getByName('home-bag-plaque'), null, { timeout: 60000 });
await d.waitForTimeout(800);
await d.evaluate(async M0 => { const m = eval(M0), st = await window.__mod('/src/systems/ItemStore.ts'), items = await window.__mod('/src/data/items.ts');
  localStorage.setItem('im_chapter1_cleared', 'true'); st.resetItemCache(); st.setAutoSalvageWhite(false); st.grantHorse('chitu'); st.grantHorse('white_horse'); st.rideHorse('guanyu', 'chitu');
  st.addItems(Array.from({ length: 24 }, (_, i) => items.rollItem(['green', 'blue', 'purple', 'orange'][i % 4])));
  for (const slot of items.SLOT_ORDER) { const it = st.loadItems().bag.find(x => items.itemSlot(x) === slot); if (it) st.equipItem('guanyu', it.uid); }
  const plaque = m.children.getByName('home-bag-plaque'), hit = m.children.getByName('home-bag') ?? window.__find(plaque, 'home-bag'); hit.emit('pointerdown'); await new Promise(r => setTimeout(r, 300));
  window.__find(m.children.getByName('item-bag'), 'item-hero-guanyu').emit('pointerdown'); await new Promise(r => setTimeout(r, 200)); }, M);
const dk = await d.evaluate(M0 => { const bag = eval(M0).children.getByName('item-bag'); return { mount: window.__find(bag, 'item-slot-label-mount')?.text, t0: window.__find(bag, 'item-treasure-label-0')?.text }; }, M);
ck('电脑纸娃娃：关羽骑赤兔，宝物栏写「出征后获得」', dk.mount === '赤兔' && dk.t0 === '出征后获得', dk);
await d.screenshot({ path: `${out}/desktop-home-doll.png` });
await d.evaluate(async M0 => { const bag = eval(M0).children.getByName('item-bag'); window.__tap(window.__find(bag, 'item-slot-mount')); await new Promise(r => setTimeout(r, 150)); }, M);
await d.screenshot({ path: `${out}/desktop-home-stable.png` });
await d.evaluate(M0 => { const bag = eval(M0).children.getByName('item-bag'); window.__find(bag, 'item-bag-close')?.emit('pointerdown'); }, M);
// 主城临时「马厩」入口（全景右上角，不挡页眉 / 返回）
await d.evaluate(() => { const w = JSON.parse(localStorage.getItem('im_world_v1') ?? 'null'); return !!w; });
await d.goto(base + '?layout=desktop&dev=1');
await d.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive() || window.__game?.scene.getScene('CityScene')?.sys.isActive(), null, { timeout: 60000 });
const city = await d.evaluate(async () => { const g = window.__game; g.scene.getScenes(true).forEach(s => s.scene.key !== 'CityScene' && s.scene.stop()); g.scene.start('CityScene'); await new Promise(r => setTimeout(r, 2500));
  const c = g.scene.getScene('CityScene'); for (let i = 0; i < 3; i++) { const close = c.children.list.flatMap(o => [o, ...(o.list ?? [])]).find(o => /-close$/.test(o.name ?? '') && o.input?.enabled); if (!close) break; close.emit('pointerdown'); await new Promise(r => setTimeout(r, 300)); }
  const btn = c.children.getByName('city-stable'); if (!btn) return { btn: false };
  const b = btn.getBounds(), others = c.children.list.filter(o => o !== btn && o.input?.enabled && o.name && o.getBounds && o.depth < 600).map(o => [o.name, o.getBounds()]).filter(([, r]) => !(r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom)).map(([n]) => n);
  window.__tap(btn); await new Promise(r => setTimeout(r, 300)); const bag = c.children.getByName('item-bag');
  return { btn: true, overlap: others, open: !!bag, stable: !!(bag && window.__find(bag, 'stable-hint')) }; });
ck('主城右上「马厩」入口：不与其他按钮重叠，点开直接是马厩', city.btn && city.open && city.stable && !city.overlap?.length, city);
await d.screenshot({ path: `${out}/desktop-city-stable.png` });
await d.close();

ck('控制台无报错', errors.length === 0, errors.slice(0, 8));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
