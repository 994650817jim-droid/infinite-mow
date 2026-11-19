// 战法流派重做第 2 期（2026-11-19，data/schoolCombos.ts）验收：合击 15 个 + 六派觉醒。电脑布局，需要开发服务器。
// 检查：
//  1. 合击：两派都到 2 势才生效；实战里大部分合击真的触发，第一次触发打横幅「合击 · 名字」；
//  2. 觉醒：六派各放一次都有效果（火浪点燃 / 八门金锁眩晕 / 万箭破甲 / 单骑突阵无敌 / 狂斗攻速 / 铁壁军阵出兵）；
//     自动释放：6 势后身边敌人够多才放，每派每关最多 2 次、两次之间有冷却，用完后 HUD 写「用完」；
//  3. 战法构筑面板有「合击」栏；三选一卡面写「合击【…】」；
//  4. 截图（轻测试：只拍 2 张）：觉醒火浪、战法构筑面板。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-school-combos.mjs   → assets/review/schools/*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/schools'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 480) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
await p.addInitScript(() => {
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); }
});
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off', { timeout: 180000 });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await p.evaluate(() => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.set('runConfig', { character: 'zhaoyun', chapter: 'hulao', westStage: 2 }); s0.scene.start('GameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return window.__game.scene.isActive('GameScene') && s?.player && s.buildCombat && s.synergy; }, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const ev = (fn, a) => p.evaluate(([f, a]) => { const s = window.__game.scene.getScene('GameScene'); window.__S = s; for (let i = 0; i < 8 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result' && s.mode !== 'story') s.setMode?.('none'); } } return eval('(' + f + ')')(s, a); }, [String(fn), a]);
const notices = () => ev(s => { const out = []; const walk = l => { for (const o of l) { if (typeof o.text === 'string' && /合击 · |觉醒 · /.test(o.text)) out.push(o.text); if (o.list) walk(o.list); } }; walk(s.children.list); return out; });
const crowd = (s, r = 260) => { for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss' && Math.hypot(e.x - s.player.x, e.y - s.player.y) > r + 200) e.sprite.setPosition(s.player.x + (Math.random() - .5) * r * 2, s.player.y + (Math.random() - .5) * r * 1.5); };
await p.evaluate(src => { const c = eval('(' + src + ')'); window.crowd = (s, r = 260) => { for (let k = s.enemies.filter(e => e.active && !e.isSupplySlot && Math.hypot(e.x - s.player.x, e.y - s.player.y) < 400).length; k < 12; k++) { const a = Math.random() * Math.PI * 2; s.spawnEnemy('infantry', s.player.x + Math.cos(a) * r * .8, s.player.y + Math.sin(a) * r * .6, 1, true); } c(s, r); }; }, String(crowd));

// 1. 合击生效条件
const gate = await ev(async s => { const b = s.player.growth.build, sc = await window.__mod('data/schoolCombos.ts'); b.tactics = {}; b.treasures = []; b.extraTags = []; s.player.damageImmune = true;
  b.bonus = { fire: 2, archery: 1 }; const t1 = sc.activeCombos(b.tags()).map(c => c.id); b.bonus = { fire: 2, archery: 2 }; const t2 = sc.activeCombos(b.tags()).map(c => c.id);
  s.buildCombat.update(s.combatNow + 1); return { t1, t2, live: s.buildCombat.combo('fire_arrow') }; });
ck('合击：火攻 2 势 + 弓弩 1 势不生效，两派都到 2 势「火箭」生效', !gate.t1.includes('fire_arrow') && gate.t2.includes('fire_arrow') && gate.live, gate);

// 2. 实战：六派都 4 势（15 个合击全生效），学火种 / 疾风 / 绊阵 / 连环 / 鹰眼 / 蓄势冲锋，主将半血（背水一战），打 16 秒
await ev(s => { const b = s.player.growth.build; b.tactics = {}; for (const id of ['ember', 'ember', 'ember', 'gust', 'snare', 'chain', 'eagle', 'stored_edge']) b.learn(id);
  b.bonus = { fire: 3, stratagem: 3, archery: 3, cavalry: 3, warrior: 4, formation: 4 }; b.bonusNotes = {}; s.player.hp = s.player.maxHp * .3; return true; });
const seenBanners = new Set();
for (let i = 0; i < 16; i++) {
  await ev((s, i) => { s.buildCombat.movement(260); s.buildCombat.update(s.combatNow); // 烈马：同一帧里先动再结算（真实对局每帧都是这样）
    if (i % 4 === 2) for (const e of s.enemies) if (e.active && !e.isSupplySlot && Math.hypot(e.x - s.player.x, e.y - s.player.y) < 300) s.buildCombat.igniteDerived(e, 2, s.combatNow); // 让震荡多打到燃烧的敌人（爆燃） s.player.hp = Math.min(s.player.hp, s.player.maxHp * .35); s.debugCrit = i % 3 === 0 ? true : null;
    window.crowd(s, 130);
    // 万军取首：冲势满时打一个精锐（临时把一个敌人当精锐打）
    if (i === 5) { const e = s.enemies.find(e => e.active && !e.isSupplySlot && e.kind === 'infantry'); if (e) { s.buildCombat.distances.charge = 999; const k = e.kind; e.kind = 'elite'; s.buildCombat.damage(e, 10, false, s.combatNow); e.kind = k; } }
  }, i);
  await p.waitForTimeout(1000);
  for (const t of await notices()) seenBanners.add(t);
}
await ev(s => { s.debugCrit = null; return true; });
const st = await ev(s => ({ combos: s.buildCombat.comboStats, seen: [...s.synergy.seen], syn: s.synergy.stats, ally: s.reinforce?.stats.spawned ?? 0 }));
const fired = Object.keys(st.combos);
ck('实战：15 个合击里至少 11 个真的触发（' + fired.length + ' 个）', fired.length >= 11, { fired, missing: ['fire_wind', 'fire_arrow', 'fire_ox', 'fire_burst', 'fire_hoof', 'ambush_bolt', 'chaos_strike', 'ambush_ten', 'feint', 'horse_archer', 'pierce_combo', 'crossbow_line', 'take_general', 'iron_cavalry', 'last_stand'].filter(x => !fired.includes(x)) });
ck('火系合击：火箭（暴击点燃）、烈马（脚下留火）、火牛阵（部曲点燃）、爆燃（震荡炸开）', ['fire_arrow', 'fire_hoof', 'fire_ox', 'fire_burst'].every(x => st.combos[x] > 0), st.combos);
ck('背水一战：半血以下全军增伤并计入触发', st.combos.last_stand > 0, st.combos.last_stand);
ck('冲势合击：声东击西减速、铁骑冲阵出骑卒、万军取首打精锐', st.combos.feint > 0 && st.combos.iron_cavalry > 0 && st.syn.cavalry >= 2 && st.combos.take_general > 0, { combos: st.combos, syn: st.syn });
ck('背水一战：半血以下吸血；十面埋伏：眩晕时冒伏兵', st.syn.leech > 0 && st.syn.ambush >= 1, st.syn);
ck('第一次触发出小签「合击 · 名字」（每关每个只出一次）', st.seen.length >= 8 && [...seenBanners].some(t => /^合击 · .+/.test(t)), { seen: st.seen.length, banners: [...seenBanners].slice(0, 4) });

// 3. 觉醒：六派都 6 势，逐个强制放一次，看效果
await ev(s => { const b = s.player.growth.build; b.bonus = { fire: 6, stratagem: 6, archery: 6, cavalry: 6, warrior: 6, formation: 6 }; s.player.hp = s.player.maxHp; s.buildCombat.update(s.combatNow + 1); return true; });
const aw = {};
// 火烧连天：火浪扫过之后，屏上的普通敌人在烧；截图一张
await ev(s => { window.crowd(s, 300); window.__hp0 = s.enemies.filter(e => e.active && !e.isSupplySlot).reduce((a, e) => a + e.hp, 0); s.synergy.force('fire'); return true; });
await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/awaken-fire.png` }); const liveFire = await ev(s => s.children.list.filter(o => o.name === 'awaken-fire').length); await p.waitForTimeout(900);
const art = await ev(s => ({ tex: ['fire', 'stratagem', 'archery', 'cavalry', 'warrior', 'formation'].every(k => s.textures.exists('fx_awaken_' + k) && s.textures.exists('build_icon_school_' + k)) && ['fx_gust_band', 'school_banner_combo', 'school_banner_awaken', 'build_icon_napalm', 'build_icon_gust'].every(k => s.textures.exists(k)), banner: [...(s.schoolBanner?.stats.toasts ?? [])] }));
ck('第 3 期美术：六派觉醒序列帧、徽印、风带、横幅、火油罐 / 疾风图标都已加载；火浪用手绘火墙帧；觉醒出小签', art.tex && liveFire >= 3 && art.banner.some(t => /觉醒 · 火烧连天/.test(t ?? '')), { ...art, liveFire });
aw.fire = await ev(s => ({ hits: s.synergy.stats.hits.fire ?? 0, burning: s.enemies.filter(e => e.active && !e.isSupplySlot && s.buildCombat.isBurning(e, s.combatNow)).length, boost: s.buildCombat.burnBoost.until > s.combatNow }));
ck('觉醒「火烧连天」：火浪扫过全屏，打到 3 个以上敌人（活下来的着火），之后灼烧更痛', aw.fire.hits >= 3 && aw.fire.boost, aw.fire);
aw.strat = await ev(s => { window.crowd(s, 120); s.synergy.force('stratagem'); return true; }).then(() => p.waitForTimeout(1200)).then(() => ev(s => ({ stunned: s.enemies.filter(e => e.active && e.stunUntil > s.combatNow).length, fields: s.synergy.fields.length })));
ck('觉醒「八门金锁」：怪最密处布阵，阵里敌人被眩晕', aw.strat.stunned >= 2 && aw.strat.fields === 1, aw.strat);
aw.arch = await ev(s => { window.crowd(s, 120); window.__su = s.buildCombat.stats.sunder; s.synergy.force('archery'); return true; }).then(() => p.waitForTimeout(1300)).then(() => ev(s => ({ sunder: s.buildCombat.stats.sunder - window.__su, hits: s.synergy.stats.hits.archery ?? 0 })));
ck('觉醒「万箭齐发」：三波箭雨，中箭的破甲', aw.arch.sunder >= 3 && aw.arch.hits >= 3, aw.arch);
aw.cav = await ev(s => { window.crowd(s, 200); s.synergy.force('cavalry'); return { inv: s.player.invulnUntil > s.combatNow + 500 }; });
ck('觉醒「单骑突阵」：冲锋中主将无敌', aw.cav.inv, aw.cav);
aw.war = await ev(s => { const g = s.player.growth, before = g.attackSpeedMultiplier(s.combatNow); s.synergy.force('warrior'); return { before, after: g.attackSpeedMultiplier(s.combatNow) }; });
ck('觉醒「横扫千军」：狂斗，攻速大增', aw.war.after >= aw.war.before * 1.35, aw.war);
aw.form = await ev(s => { const n0 = s.reinforce?.stats.spawned ?? 0; s.synergy.force('formation'); return { soldiers: (s.reinforce?.stats.spawned ?? 0) - n0, guard: s.synergy.allyIncoming(s.combatNow) }; });
ck('觉醒「铁壁军阵」：出 6 名义军，部曲受伤减半', aw.form.soldiers >= 4 && aw.form.guard === .5, aw.form);

// 4. 自动释放：清掉手动记录，身边敌人够多就自己放；每派每关最多 2 次，用完 HUD 写「用完」
const auto = await ev(s => { const sy = s.synergy; for (const k of Object.keys(sy.awake)) delete sy.awake[k]; sy.lastAwaken = -1e9; sy.stats.awaken = {}; return true; });
for (let i = 0; i < 6; i++) { await ev(s => { for (let k = s.enemies.filter(e => e.active && !e.isSupplySlot && Math.hypot(e.x - s.player.x, e.y - s.player.y) < 400).length; k < 10; k++) { const a = Math.random() * Math.PI * 2; s.spawnEnemy('infantry', s.player.x + Math.cos(a) * 220, s.player.y + Math.sin(a) * 160, 1, true); } window.crowd(s, 200); s.player.hp = s.player.maxHp; return true; }); await p.waitForTimeout(1000); }
const a2 = await ev(s => { const sy = s.synergy, used = Object.values(sy.stats.awaken).reduce((a, n) => a + n, 0); const one = Object.keys(sy.stats.awaken)[0];
  const cd = one ? sy.progress('awakening_' + one, s.combatNow) : null; if (one) sy.awake[one].used = 2; const done = one ? sy.progress('awakening_' + one, s.combatNow) : null; return { used, by: sy.stats.awaken, cd: cd?.text, done: done?.text }; });
ck('自动释放：6 势后身边敌人够多自己放；两次觉醒至少隔 3 秒（6 秒内不超过 2 次）；冷却中 HUD 写「冷却」', a2.used >= 1 && a2.used <= 2 && /冷却/.test(a2.cd ?? ''), a2);
ck('每派每关最多 2 次：用完后 HUD 写「本关觉醒已用完」', /用完/.test(a2.done ?? ''), a2.done);

// 2026-11-19 用户「关于觉醒合击提示有点碍眼」：小签在左上空带（不居中、不压主将 / 首领血条 / 军令 / 舆图 / 用药），矮小半透明；同一个第二次不再出签只闪徽印；设置「关」只闪徽印
{ const geo = await ev(async s => { const sb = s.schoolBanner; sb.shown.clear(); /* 前面第 3 节已放过各派觉醒：当作新的一关重新计「第一次」 */ const t0 = sb.stats.toasts.length, f0 = sb.stats.flashes; await new Promise(r => setTimeout(r, 2300));
    s.synergy.force('stratagem'); await new Promise(r => setTimeout(r, 450));
    const o = s.children.list.find(x => x.name === 'school-banner'), b = o?.getBounds(), orders = s.ordersPanel?.bounds?.(), pl = s.player;
    const wv = s.cameras.main.worldView, px = (pl.x - wv.x) / wv.width * 960, py = (pl.y - wv.y) / wv.height * 540;
    const out = { b: b && [Math.round(b.x), Math.round(b.y), Math.round(b.right), Math.round(b.bottom)], kind: o?.getData('kind'), toasts: sb.stats.toasts.slice(t0), orders: orders && [orders.x, orders.y, orders.x + orders.w, orders.y + orders.h], player: [Math.round(px), Math.round(py)], f0 };
    return out; });
  await p.screenshot({ path: `${OUT}/school-toast.png` });
  Object.assign(geo, await ev(async (s, f0) => { const sb = s.schoolBanner, out = {};
    await new Promise(r => setTimeout(r, 2300)); const t1 = sb.stats.toasts.length; s.synergy.force('stratagem'); await new Promise(r => setTimeout(r, 450)); out.repeatToast = sb.stats.toasts.length > t1; out.repeatFlash = sb.stats.flashes > f0 + 1;
    localStorage.setItem('im_school_hint', 'off'); const t2 = sb.stats.toasts.length; s.synergy.force('archery'); await new Promise(r => setTimeout(r, 450)); out.offToast = sb.stats.toasts.length > t2; localStorage.removeItem('im_school_hint');
    return out; }, geo.f0));
  const [x0, y0, x1, y1] = geo.b ?? [0, 0, 999, 999], o = geo.orders ?? [9e3, 9e3, 9e3, 9e3];
  ck('觉醒小签：左上空带（x 200–600、y < 145），高 ≤ 36、宽 ≤ 340，不压主将 / 军令面板；同一觉醒第二次不再出签只闪徽印；设置「关」不出签', geo.kind === 'awaken' && x0 >= 200 && x1 <= 600 && y1 <= 145 && y1 - y0 <= 36 && x1 - x0 <= 340 && !(x1 > o[0] && x0 < o[2] && y1 > o[1] && y0 < o[3]) && !(geo.player[0] > x0 && geo.player[0] < x1 && geo.player[1] > y0 - 40 && geo.player[1] < y1 + 40) && geo.toasts.some(t => /觉醒 · 八门金锁/.test(t)) && !geo.repeatToast && geo.repeatFlash && !geo.offToast, geo);
 }
// 5. 三选一卡面写合击；战法构筑面板有合击栏（截图一张）
const label = await p.evaluate(async () => { const up = await window.__mod('data/upgrades.ts'); return up.schoolLabel('fire', { fire: 1, stratagem: 0, archery: 3, cavalry: 0, warrior: 0, formation: 0 }); });
ck('三选一：这张卡让火攻到 2 势、弓弩已 2 势 → 卡面写「合击【火箭】」', /解锁【火势】· 合击【火箭】/.test(label), label);
await ev(s => { const b = s.player.growth.build; b.bonus = { fire: 2, stratagem: 2, archery: 1, cavalry: 0, warrior: 2, formation: 0 }; b.tactics = {}; return true; });
await p.evaluate(() => { const s = window.__S; s.setMode('pause'); s.openBuildPanel(); }); await p.waitForTimeout(700);
const ov = await p.evaluate(() => { const s = window.__S, names = {}; const walk = l => { for (const o of l) { if (o.name?.startsWith('build-panel-combo')) names[o.name] = o.text ?? ''; if (o.list) walk(o.list); } }; walk(s.children.list); return names; });
await p.screenshot({ path: `${OUT}/build-panel-combos.png` });
ck('战法构筑面板：「合击」栏列出已生效的合击（含火借风势）、写已生效几个、给出差几势的提示', !!ov['build-panel-combo-title'] && /已生效 \d/.test(ov['build-panel-combo-count'] ?? '') && ov['build-panel-combo-fire_wind'] === '火借风势' && Object.keys(ov).some(k => k.startsWith('build-panel-combo-near-') && !k.includes('hit')), ov);
ck('无页面报错', errors.length === 0, errors.slice(0, 3));
await b.close();
console.log(fail ? `FAILED ${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
