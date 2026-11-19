// 战法流派重做（2026-11-19，设计稿 tactic-schools-redesign.md；数值 data/schools.ts）第 1 期验收：电脑布局，需要开发服务器。
// 检查：
//  1. 势 = 本派战法等级之和 + 亲和 / 随行 / 信物 / 名马；卸力 / 以战养战不占战法格、不算流派；
//  2. 三选一 = 1 张本命 / 武艺 + 2 张战法；到 2 势后每次必有一张本派战法；卡面写「火攻 · 势 3 → 4　解锁【燎原】」；
//  3. 2 / 4 势档位真的在打：火攻燎原、猛将震荡、弓弩破甲、骑突冲阵、奇谋乱阵眩晕、兵阵援军；新战法火油罐、疾风会放；
//  4. 军需商人的战法卷轴偏向势最高的两派；
//  5. 截图：三选一卡面、战斗中流派图标、战法构筑面板。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-schools.mjs   → assets/review/schools/*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/schools'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
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
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return window.__game.scene.isActive('GameScene') && s?.player && s.buildCombat; }, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const ev = (fn, a) => p.evaluate(([f, a]) => { const s = window.__game.scene.getScene('GameScene'); window.__S = s; for (let i = 0; i < 8 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result' && s.mode !== 'story') s.setMode?.('none'); } } return eval('(' + f + ')')(s, a); }, [String(fn), a]);
const fresh = () => ev(s => { const b = s.player.growth.build; b.tactics = {}; b.treasures = []; b.extraTags = []; s.player.damageImmune = true; return true; });

// 1. 势
await fresh();
const shi = await ev(s => { const b = s.player.growth.build; b.learn('ember'); b.learn('ember'); b.learn('spread'); b.learn('deflect'); b.learn('warfeed');
  return { tags: b.tags(), slots: b.slots(), notes: b.bonusNotes, cavBonus: b.bonus.cavalry ?? 0, fireTier: b.tier('fire'), canGust: b.canLearn('gust'), rebound: b.canLearn('rebound') }; });
ck('势 = 本派战法等级之和（火种 2 级 + 蔓延 1 级 = 火攻 3 势），卸力 / 以战养战不占格不算派；反震不再出卡', shi.tags.fire === 3 && shi.slots === 2 && shi.fireTier === 2 && shi.canGust && !shi.rebound, shi);
ck('亲和：赵云开局骑突 +1 势（构筑里写明来源）', shi.cavBonus >= 1 && (shi.notes.cavalry ?? []).some(n => n.includes('亲和')), { cav: shi.tags.cavalry, notes: shi.notes });

// 2. 三选一
const offers = await p.evaluate(async () => {
  const s = window.__S, up = await window.__mod('data/upgrades.ts'), hands = [];
  for (let i = 0; i < 300; i++) hands.push(up.buildUpgradeOptions(s.player, s.player.weapons, s.player.growth).map(o => ({ id: o.id, kind: o.kind, cat: o.categoryLabel ?? '' })));
  const tacticCount = hands.map(h => h.filter(o => o.kind === 'tactic' && !o.cat.startsWith('基础成长')).length);
  const coreFirst = hands.filter(h => h.some(o => o.kind === 'weapon' || o.kind === 'martial')).length;
  const fireHands = hands.filter(h => h.some(o => o.kind === 'tactic' && o.cat.startsWith('火攻'))).length;
  const sample = hands.flat().find(o => o.cat.startsWith('火攻'))?.cat;
  return { two: tacticCount.filter(n => n === 2).length, core: coreFirst, fireHands, sample, n: hands.length };
});
ck('三选一 = 1 张本命 / 武艺 + 2 张战法', offers.two >= offers.n * .95 && offers.core >= offers.n * .95, offers);
ck('火攻到 3 势（≥2）后每次三选一必有一张火攻战法；卡面写势与下一档', offers.fireHands === offers.n && /火攻 · 势 3 → 4　解锁【燎原】/.test(offers.sample ?? ''), { fireHands: offers.fireHands, sample: offers.sample });
await ev(s => { s.pendingLevels = 1; s.openUpgrade(); }); await p.waitForTimeout(600);
await p.screenshot({ path: `${OUT}/levelup-cards.png` });
await ev(s => { s.chooseUpgrade(0); });

// 3. 档位效果：六派都给到 4 势（bonus 模拟），学火油罐 / 疾风 / 绊阵 / 鹰眼 / 蓄势冲锋 / 火种
await fresh();
await ev(s => { const b = s.player.growth.build; for (const id of ['ember', 'napalm', 'gust', 'snare', 'eagle', 'stored_edge']) b.learn(id);
  b.bonus = { fire: 3, stratagem: 3, archery: 3, cavalry: 3, warrior: 4, formation: 4 }; b.bonusNotes = {};
  window.__t0 = { ...s.buildCombat.stats }; window.__st0 = s.controlBuild?.stuns ?? 0; return b.tags(); });
const tags4 = await ev(s => s.player.growth.build.tags());
ck('六派都到 4 势', Object.values(tags4).every(n => n >= 4), tags4);
for (let i = 0; i < 16; i++) { await ev(s => { s.buildCombat.movement(260); s.player.hp = s.player.maxHp; for (const e of s.enemies) if (e.active && !e.isSupplySlot && Math.hypot(e.x - s.player.x, e.y - s.player.y) > 500 && e.kind !== 'boss') e.sprite.setPosition(s.player.x + (Math.random() - .5) * 260, s.player.y + (Math.random() - .5) * 200); }); await p.waitForTimeout(1000); if (i === 8) await p.screenshot({ path: `${OUT}/battle-hud.png` }); }
const fx = await ev(s => { const d = {}, a = s.buildCombat.stats, b0 = window.__t0; for (const k of Object.keys(a)) d[k] = a[k] - (b0[k] ?? 0); return { ...d, stuns: (s.controlBuild?.stuns ?? 0) - window.__st0, reinforce: s.reinforce?.stats.spawned ?? 0, hud: s.children.list.some(o => o.list?.some?.(c => c.name === 'buff-school_fire' || c.getData?.('id') === 'school_fire')) }; });
ck('火攻：火油罐会扔、灼烧在烧（燎原见下一条）', fx.napalm >= 1 && fx.burnTicks > 0, fx);
ck('火攻 4 势「燎原」：燃烧的敌人死时爆火传火', fx.liaoyuan >= 1, fx);
ck('猛将 4 势「震荡」：每第 6 次命中一圈冲击波', fx.shock >= 1, fx);
ck('弓弩 4 势「破甲穿云」：暴击打上破甲', fx.sunder >= 1, fx);
ck('骑突：攒满冲势后一击打出（蓄势冲锋 + 4 势冲阵）', fx.charge >= 1, fx);
ck('奇谋 4 势「乱阵」：每第 3 次控制附带眩晕；疾风会吹', fx.stuns >= 1 && fx.gust >= 1, fx);
ck('兵阵 4 势「援军」：后方冲来义军', fx.reinforce >= 3, fx);

// 4. 军需商人
const shop = await p.evaluate(async () => {
  const cm = await window.__mod('systems/CampMarket.ts'), builds = await window.__mod('data/builds.ts');
  const lv = { ember: 2, spread: 1, chain: 1 }, book = { canLearn: id => (lv[id] ?? 0) < 3 && (lv[id] > 0 || Object.keys(lv).length < 6) && !builds.TACTICS[id].hidden, level: id => lv[id] ?? 0 };
  let fire = 0, warrior = 0, n = 0; for (let i = 0; i < 2000; i++) { const o = cm.rollMerchantTactic(book, Math.random, 1); if (!o) continue; n++; const sc = builds.tacticSchool(o.id); if (sc === 'fire') fire++; if (sc === 'warrior') warrior++; }
  return { fire: fire / n, warrior: warrior / n, n };
});
ck('军需商人：战法卷轴偏向势最高的两派（火攻、猛将各明显高于 1/6）', shop.fire > .22 && shop.warrior > .22, shop);

// 5. 战法构筑面板
await p.evaluate(() => { const s = window.__S; s.setMode('pause'); s.openBuildPanel(); }); await p.waitForTimeout(700);
const ov = await p.evaluate(() => { const s = window.__S; const names = []; const walk = l => { for (const o of l) { if (o.name) names.push([o.name, o.text ?? '']); if (o.list) walk(o.list); } }; walk(s.children.list); const t = Object.fromEntries(names.filter(([n]) => /build-panel-tag-(fire|warrior)$|build-panel-tag-tier-fire|build-panel-next-0/.test(n))); return t; });
await p.screenshot({ path: `${OUT}/build-panel.png` });
ck('战法构筑面板：六派势条、档位名、下一步', /势 \d/.test(ov['build-panel-tag-fire'] ?? '') && /燎原/.test(ov['build-panel-tag-tier-fire'] ?? '') && !!ov['build-panel-next-0'], ov);
ck('无页面报错', errors.length === 0, errors.slice(0, 3));
await b.close();
console.log(fail ? `FAILED ${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
