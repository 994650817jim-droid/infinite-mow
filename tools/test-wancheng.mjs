// 3-2 宛城夜袭（11-19 用户「这一关有很多bug 友军也不动，穿模」）：带 12 名友军开打，检查
// ① 友军边走边换帧、不滑步 ② 没人站进营帐里 / 典韦身上 ③ 典韦友军名牌 + 血条、军令「保护典韦」（带舆图位置）④ 典韦挥戟播攻击帧。
// 截图 assets/review/wancheng/<TAG>-*.png。用法：BASE=http://127.0.0.1:5197/ TAG=after node tools/test-wancheng.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'test', OUT = 'assets/review/wancheng';
mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' · ' + JSON.stringify(d).slice(0, 3000))); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
await p.evaluate(() => { const s0 = window.__game.scene.getScene('GameScene'); s0.registry.set('thirdStage', 2); s0.registry.set('runConfig', { character: 'zhaoyun', thirdStage: 2 }); s0.scene.start('ThirdGameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('ThirdGameScene'); return window.__game.scene.isActive('ThirdGameScene') && s?.player && s.elapsed < 6; }, null, { timeout: 120000 });
const S = "window.__game.scene.getScene('ThirdGameScene')";
const clr = () => p.evaluate(S0 => { const s = eval(S0); for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup') s.chooseUpgrade?.(0); else s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } s.player.damageImmune = true; }, S);
await p.evaluate(S0 => { const s = eval(S0); for (const k of ['spearman', 'swordsman', 'archer']) s.legion.recruit(k, 4, true, true); }, S);
for (let i = 0; i < 25; i++) { await clr(); await p.waitForTimeout(200); }
// ① 友军走路换帧（5 秒、每 250ms 采样）
const T = {};
for (let i = 0; i < 20; i++) { await clr(); await p.waitForTimeout(250); const r = await p.evaluate(S0 => { const s = eval(S0); return s.allies.filter(a => a.active && a.view).map((a, i) => ({ id: i, x: a.x, y: a.y, f: a.view.sprite.texture.key + a.view.sprite.frame.name, atk: /attack/.test(a.view.sprite.texture.key) })); }, S); for (const u of r) (T[u.id] ??= []).push(u); }
let walk = 0, slide = 0, idle = 0; const slid = [];
for (const s of Object.values(T)) { let path = 0; for (let i = 1; i < s.length; i++) path += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y); let sl = 0; for (let i = 3; i < s.length; i++) { const w = s.slice(i - 3, i + 1); if (Math.hypot(w[3].x - w[0].x, w[3].y - w[0].y) > 25 && new Set(w.map(z => z.f)).size === 1 && !w.some(z => z.atk)) sl++; } if (path < 15) idle++; else if (sl) { slide++; slid.push(s.map(z => [Math.round(z.x), Math.round(z.y), z.f.replace(/iffA_ally_shu_|_sheet/g, '')])); } else walk++; }
ck('友军边走边换帧、不滑步（12 名友军）', walk >= 6 && slide === 0, { walk, slide, idle, slid });
// 把主将放到典韦旁边、跑一会儿（敌兵围典韦）
await p.evaluate(S0 => { const s = eval(S0); s.player.sprite.setPosition(s.dianwei.x + 70, s.dianwei.y - 30); s.devTimeScale = 2; }, S);
let worst = { inTent: 0, onDw: 0 }, swingFrames = 0;
for (let i = 0; i < 40; i++) {
  await clr(); await p.waitForTimeout(200);
  const r = await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei, A = s.arena, T = { up: 30, rx: 78, ry: 34 };
    const units = [s.player, ...s.allies.filter(a => a.active), ...s.enemies.filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss')];
    const inTent = units.filter(u => (A?.tents ?? []).some(t => Math.hypot((u.x - t.x) / (T.rx - 4), (u.y - (t.y - T.up)) / (T.ry - 4)) < 1)).length;
    const onDw = d.down ? 0 : units.filter(u => Math.hypot(u.x - d.x, u.y - d.y) < 20).length;
    return { inTent, onDw, atk: d.stats.attackFrames, swings: d.stats.swings }; }, S);
  worst = { inTent: Math.max(worst.inTent, r.inTent), onDw: Math.max(worst.onDw, r.onDw) }; swingFrames = r.atk;
  if (i === 20) await p.screenshot({ path: `${OUT}/${TAG}-dianwei.png` });
}
await p.evaluate(S0 => { eval(S0).devTimeScale = 1; }, S);
ck('没人站进营帐里（帐底椭圆）', worst.inTent === 0, worst);
ck('没人站在典韦身上（身体半径内）', worst.onDw === 0, worst);
const dw = await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei, o = s.orders?.get?.('dianwei') ?? s.__orders?.get?.('dianwei'); const lb = s.children.getByName('dianwei-label'), bar = s.children.getByName('dianwei-hpbar');
  const ord = (() => { for (const k of Object.keys(s)) { const v = s[k]; if (v && typeof v.get === 'function' && typeof v.patch === 'function') return v.get('dianwei'); } return null; })();
  return { label: lb?.text, color: lb?.style?.color, bar: !!bar, order: ord ? { label: ord.label, state: ord.state, at: !!ord.at?.(), prog: ord.progress } : null, swings: d.stats.swings, pushed: d.stats.pushed }; }, S);
ck('典韦：碧色友军名牌 + 血条', /典韦/.test(dw.label ?? '') && dw.bar && /#b8f5c4|#b9a99a/.test(dw.color ?? ''), dw);
ck('军令「（可选）保护典韦」（带血量、舆图位置）', dw.order?.label === '（可选）保护典韦' && !!dw.order.prog && (dw.order.at || dw.order.state === 'failed'), dw.order);
ck('典韦挥戟播攻击帧', dw.swings >= 1 && swingFrames >= 1, { swings: dw.swings, frames: swingFrames });
await p.screenshot({ path: `${OUT}/${TAG}-end.png` });
// —— 11-19「典韦可以动和有自己技能」+ 台词 ——
// 场面清空、主将挪远（不帮打）；典韦回满血、回营门；台词改成记录调用（测试默认剧情关）
await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei; s.spawnTimer = s.eliteTimer = 1e9; s.enemyCamps && (s.enemyCamps.update = () => {}); for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); for (const a of s.allies) if (a.active) a.setPosition(d.home.x - 600, d.home.y - 700);
  s.player.sprite.setPosition(d.home.x - 700, d.home.y - 700); for (const w of s.player.weapons) w.cooldownLeft = 1e9; d.hp = 1500; d.x = d.home.x; d.y = d.home.y; d.stats.barks.length = 0; d.said.clear(); for (const k of ['throws', 'throwHits', 'whirls', 'knocked', 'rage', 'walkFrames', 'walked']) d.stats[k] = 0; window.__lines = []; d.h.line = id => { window.__lines.push(id); return true; };
  window.__still = (x, y, k = 'infantry') => { const e = s.spawnEnemy(k, x, y, 1, true); e.def = { ...e.def, speed: 0, damage: 1 }; e.speed = 0; e.hp = e.maxHp = 5000; return e; }; }, S);
const frame = async n => { for (let i = 0; i < n; i++) { await clr(); await p.waitForTimeout(90); } }; // 短片见 tools/gif-dianwei.mjs
// ① 走位：圈内 160px 处一个敌人 → 典韦走过去（换走路帧），不出圈
await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei; d.nextWhirl = d.nextThrow = 1e12; window.__e1 = window.__still(d.home.x + 170, d.home.y + 20); }, S);
await frame(14);
const mv = await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei; return { dx: Math.round(d.x - d.home.x), walkFrames: d.stats.walkFrames, maxFromHome: d.stats.maxFromHome, zone: 220 }; }, S);
ck('典韦守区走位：走向圈内敌人、换走路帧、不出圈', mv.dx > 50 && mv.walkFrames >= 2 && mv.maxFromHome <= mv.zone + 1, mv);
// ② 掷戟：圈内远处的敌人
await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei; window.__e1.deactivate(); d.x = d.home.x; d.y = d.home.y; window.__e2 = window.__still(d.home.x - 40, d.home.y - 190); d.nextThrow = 0; }, S);
await frame(14);
const th = await p.evaluate(S0 => { const d = eval(S0).dianwei; return { throws: d.stats.throws, hits: d.stats.throwHits, maxFromHome: d.stats.maxFromHome }; }, S);
ck('掷戟：圈内远处敌人，飞戟命中', th.throws >= 1 && th.hits >= 1, th);
// ③ 双戟旋风：身边 4 个敌人
await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei; window.__e2.deactivate(); d.nextThrow = 1e12; window.__ring = [0, 1, 2, 3].map(i => window.__still(d.x + Math.cos(i * 1.57) * 62, d.y + Math.sin(i * 1.57) * 50)); d.nextWhirl = 0; }, S);
await frame(14);
const wh = await p.evaluate(S0 => { const d = eval(S0).dianwei; return { whirls: d.stats.whirls, knocked: d.stats.knocked, far: window.__ring.filter(e => e.active && Math.hypot(e.x - d.x, e.y - d.y) > 100).length }; }, S);
ck('双戟旋风：身边 ≥3 敌 → 旋扫、击退', wh.whirls >= 1 && wh.knocked >= 3, wh);
// ④ 恶来死战：血 < 30%
await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei; for (const e of window.__ring) e.active && e.deactivate(); d.hp = 1500 * .55; d.hurt(1500 * .1, s.combatNow); d.hurt(1500 * .3, s.combatNow); }, S);
await frame(10);
const rg = await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei; return { rage: d.stats.rage, raging: d.raging, label: s.children.getByName('dianwei-label')?.text }; }, S);
ck('恶来死战：血低于三成触发（一次）、名牌「死战」', rg.rage === 1 && rg.raging && /死战/.test(rg.label ?? ''), rg);
// ⑤ 主将来援 → 台词；战死 → 台词、军令失败但战斗继续
await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei; s.player.sprite.setPosition(d.x + 120, d.y); }, S); for (let i = 0; i < 4; i++) { await clr(); await p.waitForTimeout(150); }
await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei; d.hurt(99999, s.combatNow); }, S); await p.waitForTimeout(500);
const end = await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei; const ord = (() => { for (const k of Object.keys(s)) { const v = s[k]; if (v && typeof v.get === 'function' && typeof v.patch === 'function') return v.get('dianwei'); } return null; })(); return { lines: window.__lines, down: d.down, over: s.over, state: ord?.state }; }, S);
const want = ['dw_start', 'dw_cao', 'dw_throw', 'dw_whirl', 'dw_hp50', 'dw_hp20', 'dw_rage', 'dw_help', 'dw_fall'];
ck('典韦台词：开场 / 曹操 / 掷戟 / 旋风 / 血过半 / 两成 / 死战 / 来援 / 战死', want.every(w => end.lines.includes('qunxiong-2.' + w)), { got: end.lines });
ck('典韦战死：军令（可选）标失败、不判负，战斗继续', end.down && !end.over && end.state === 'failed', end);
ck('无页面报错', errs.length === 0, errs);
console.log(`${fail ? 'FAIL' : 'PASS'} ${pass}/${pass + fail}`);
await b.close();
process.exit(fail ? 1 : 0);
