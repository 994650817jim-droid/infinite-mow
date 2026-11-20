// 回血事件不刷在脸上（用户 11-20「和回血的事件不要刷在脸上」第二轮；data/battleHeal drop、BattleHeal.findAround / landing、BattlefieldSupplies.landing）：
// 每种回血来源刷 20 次（随机掉落源位置 / 随机移动方向），统计落点离主将的最小距离（全部 ≥ 250 才过）、刷点落在移动方向正前方 ±35° 的次数（应为 0）。
// 场地：1-1（开阔）、3-1（城池型营寨关，有墙有边界，夹进场地后最容易被挤近）。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-heal-distance.mjs   结果表 assets/review/heal-distance/table.json
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/heal-distance'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [], table = {};
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
async function open(key, reg, cfg) {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0&story=off');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
  if (key !== 'GameScene' || cfg) await p.evaluate(([key, reg, cfg]) => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.remove('thirdTransfer'); if (reg) s0.registry.set(reg[0], reg[1]); s0.registry.set('runConfig', { character: 'zhaoyun', ...(cfg ?? {}) }); for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'GameScene') s.scene.stop(); s0.scene.start(key); }, [key, reg, cfg]);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.battleHeal && s.supplies && s.elapsed > 1 && s.elapsed < 10; }, key, { timeout: 120000 });
  await p.evaluate(k => { const s = window.__game.scene.getScene(k); window.__S = s; s.player.damageImmune = true; s.updateSpawner = () => {}; if (s.traits) s.traits.pick = () => null; s.player.weapons.forEach(w => { w.cooldownLeft = 1e9; });
    window.__calm = () => { for (let i = 0; i < 16 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } } }; window.__calm(); }, key);
  await p.waitForTimeout(800);
  return p;
}
const N = 20;
async function measure(p, where) {
  const r = await p.evaluate(async N => {
    const s = window.__S, P = s.player, H = s.battleHeal, S = s.supplies, wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
    // 距离按「刷出 / 掉落那一刻」主将的位置量（mark() 记下）；之后主将被挤动不算
    let at0 = null; const mark = () => { at0 = { x: P.x, y: P.y }; }; const dist = (x, y) => Math.round(Math.hypot(x - (at0?.x ?? P.x), y - (at0?.y ?? P.y)));
    const rndDir = () => { const a = Math.random() * Math.PI * 2; return { x: Math.cos(a), y: Math.sin(a) }; };
    const aheadOf = (m, x, y) => { if (!m) return false; const dx = x - P.x, dy = y - P.y, d = Math.hypot(dx, dy) || 1; return (dx * m.x + dy * m.y) / d > Math.cos(35 * Math.PI / 180); };
    const rec = (k, d, ahead = false) => { const o = out[k] ??= { n: 0, min: 1e9, ahead: 0 }; o.n++; o.min = Math.min(o.min, d); if (ahead) o.ahead++; };
    const nearSrc = () => { const a = Math.random() * Math.PI * 2, r = Math.random() * 220; return { x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r }; };
    const clearAll = () => { for (const f of H.foods) { f.active = false; f.img.setVisible(false); } for (const q of S.potions) { q.active = false; q.image.setVisible(false); } S.pouch.length = 0; };
    P.hp = P.maxHp * .95;
    // 1 回血点刷点（含首领段前那一处，同一个刷点函数）：随机移动方向
    for (let i = 0; i < N; i++) { const m = rndDir(); s.moveDir = m; const q = H.spotPoint(); rec('回血点（泉眼 / 水井 / 药草丛，含首领前）', dist(q.x, q.y), aheadOf(m, q.x, q.y)); }
    s.moveDir = null;
    // 2 干粮（粮袋）/ 3 酒肉（木箱）：掉落源在主将身边 0–220
    for (const [kind, name] of [['grain', '干粮（打粮袋）'], ['crate', '酒肉（打木箱）']]) for (let i = 0; i < N; i++) { clearAll(); mark(); const src = nearSrc(); H.onPropBroken(kind, src.x, src.y, () => 0); const f = H.foods.find(o => o.active); if (f) rec(name, dist(f.x, f.y)); }
    // 4 拆营奖励的干粮（刷兵帐篷 / 营寨攻坚）
    for (let i = 0; i < N; i++) { clearAll(); mark(); const src = nearSrc(); s.tentCtx().reward(src.x, src.y, 0, true); const f = H.foods.find(o => o.active); if (f) rec('拆营掉的干粮', dist(f.x, f.y)); }
    // 5 精锐 / 6 副将的军中伤药：落点（蹦完以后）
    // 取最新掉的那一份；等它真的落地（蹦是按游戏时间走的，画面卡时比现实慢，不能只等固定毫秒）
    const potionAt = async () => { await wait(150); for (let i = 0; i < 60; i++) { const q = S.potions.filter(o => o.active).sort((a, b) => b.until - a.until)[0]; if (!q) return null; if (!q.landAt || s.combatNow >= q.landAt + 30) return dist(q.image.x, q.image.y); await wait(50); } return null; };
    for (let i = 0; i < N; i++) { clearAll(); H.eliteMiss = 0; mark(); const src = nearSrc(); H.onEliteDown(src.x, src.y, () => 0); const d = await potionAt(); if (d !== null) rec('精锐掉的军中伤药', d); }
    for (let i = 0; i < N; i++) { clearAll(); mark(); const src = nearSrc(); H.onLieutenantDown(src.x, src.y); const d = await potionAt(); if (d !== null) rec('副将掉的军中伤药', d); }
    // 7 低血保护
    for (let i = 0; i < N; i++) { clearAll(); H.lowHpAt = -1e9; H.lowHpUsed = 0; H.wasLow = false; mark(); P.hp = P.maxHp * .2; await wait(250); const q = S.potions.filter(o => o.active).sort((a, b) => b.until - a.until)[0]; if (q) rec('低血保护的伤药', dist(q.image.x, q.image.y)); P.hp = P.maxHp * .95; await wait(80); }
    P.hp = P.maxHp * .95;
    // 8 营帐打塌掉的草药包（EnvInteractions → supplies.dropHeal）
    for (let i = 0; i < N; i++) { clearAll(); mark(); const src = nearSrc(); S.dropHeal(src.x, src.y); const d = await potionAt(); if (d !== null) rec('营帐打塌掉的草药包', d); }
    // 9 酒罐 / 药篓（回血道具）打碎掉的酒葫芦 / 草药包：道具就在主将身边
    for (let i = 0; i < N; i++) { clearAll(); mark(); const a = Math.random() * Math.PI * 2, e = S.spawnHealForTest(i % 2 ? 'wine' : 'herb', Math.cos(a) * 90, Math.sin(a) * 70); if (!e) continue; e.hp = 0; s.killEnemy(e); const d = await potionAt(); if (d !== null) rec('酒罐 / 药篓打碎掉的回血', d); }
    // 10 机缘（带回血 / 降将）：事件刷点
    if (s.fortunes) for (const k of ['beacon', 'cart', 'rescue', 'defector']) for (let i = 0; i < N; i++) { const n0 = s.fortunes.live.length; s.fortunes.force(k); const L = s.fortunes.live[s.fortunes.live.length - 1]; if (L && s.fortunes.live.length > n0) rec(k === 'beacon' ? '机缘 · 烽燧（回 25%）' : k === 'cart' ? '机缘 · 粮车（回春丹）' : k === 'rescue' ? '机缘 · 义军被围' : '机缘 · 降将来投', L.dist ?? dist(L.x, L.y)); s.fortunes.clear(); }
    clearAll();
    return out;
  }, N);
  for (const [k, v] of Object.entries(r)) { (table[k] ??= {})[where] = v; }
  await p.screenshot({ path: `${OUT}/${where}.png` });
}
{ const p = await open('GameScene', null, null); await measure(p, '1-1'); await p.close(); }
{ const p = await open('ThirdGameScene', ['thirdStage', 1], { thirdStage: 1 }); await measure(p, '3-1'); await p.close(); }
console.log('\n来源 | 1-1 最小距离 | 3-1 最小距离 | 正前方次数');
for (const [k, v] of Object.entries(table)) {
  const a = v['1-1'], c = v['3-1'], ahead = (a?.ahead ?? 0) + (c?.ahead ?? 0);
  console.log(`${k} | ${a ? a.min + '（' + a.n + ' 次）' : '—'} | ${c ? c.min + '（' + c.n + ' 次）' : '—'} | ${ahead}`);
  ck(`${k}：离主将最小 ≥ 250、不在移动方向正前方`, [a, c].filter(Boolean).every(o => o.min >= 250 && o.n >= 10) && ahead === 0, v);
}
writeFileSync(`${OUT}/table.json`, JSON.stringify(table, null, 1));
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${fail} failed`);
await b.close();
