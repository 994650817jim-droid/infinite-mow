// 貂蝉「离间」倒戈的兵要有动作（2026-11-20 用户「关于貂蝉离间后，离间的兵没有动作」）：
// ① 离间倒戈：转身走向最近的同伴（播行走帧、朝向目标）、贴身出手（攻击帧 / 前冲）、打中同伴掉血；身上有倒戈标记；倒戈结束恢复追主将。
// ② 闭月分支魅惑（charmTurn）：同样走倒戈驱动；进阶「被魅惑的精锐会攻击首领」：精锐倒戈先去打首领、分支伤害打得到首领。
// 用法：BASE=http://127.0.0.1:5187/ [GIF=1] node tools/test-diaochan-turn.mjs [截图目录]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = process.argv[2] ?? 'assets/review/diaochan-turn'; mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
await p.goto(base + '?dev=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
await p.evaluate(() => { const g = window.__game, s0 = g.scene.getScene('MenuScene'); s0.registry.set('runConfig', { chapter: 'huangjin', stage: 1, character: 'diaochan', weapon: 'diaochan_fans' }); for (const s of g.scene.getScenes(true)) s.scene.stop(); s0.scene.start('GameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && window.__game.scene.isActive('GameScene') && s.elapsed > 1.5; }, null, { timeout: 120000 });
const S = "window.__game.scene.getScene('GameScene')";
// 清场、停刷兵、主将不受伤、飞扇不出手（免得把测试兵打乱）；在主将右侧摆两个步兵（相距 140）
const setup = (kinds) => p.evaluate(([S0, kinds]) => { const s = eval(S0); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; if (s.mode !== 'none') s.setMode('none');
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); s.player.weapons.forEach(w => { w.cooldownLeft = 1e9; w.cd = 1e9; });
  const px = s.player.x, py = s.player.y, made = kinds.map(([k, dx, dy]) => { const e = s.spawnEnemy(k, px + dx, py + dy, 1, true); e.hp = e.maxHp = 1e6; return e; });
  window.__T = made; return made.map(e => ({ kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), sheet: e.walkSheet })); }, [S, kinds]);
const sample = () => p.evaluate(S0 => { const s = eval(S0), now = s.combatNow; return window.__T.map(e => ({ x: Math.round(e.x), y: Math.round(e.y), frame: String(e.sprite.frame?.name ?? ''), tex: e.sprite.texture.key, dir: e.direction, atk: e.attackUntil > now, hp: Math.round(e.hp), turned: s.player.passive.isTurned(e, now), mark: s.children.list.some(o => o.name === 'diaochan-mark' && o.visible && Math.abs(o.x - e.x) < 4) })); }, S);
// GIF=1：倒戈过程逐帧截图（裁主将右侧一块）到 <截图目录>/frames，之后用 ffmpeg 合成 GIF
const GIF = !!process.env.GIF; let gifN = 0; if (GIF) mkdirSync(out + '/frames', { recursive: true });
const run = async (ms) => { const seen = []; const t0 = Date.now(); while (Date.now() - t0 < ms) { seen.push(await sample()); if (GIF) await p.screenshot({ path: `${out}/frames/f${String(gifN++).padStart(3, '0')}.png`, clip: { x: 760, y: 220, width: 520, height: 300 } }); else await p.waitForTimeout(80); } return seen; };

// ① 离间倒戈（forceTurn，3 秒）
const placed = await setup([['infantry', 260, 0], ['infantry', 400, 0]]);
await p.evaluate(S0 => { const s = eval(S0); s.player.passive.forceTurn(window.__T[0], s.combatNow, 3000); }, S);
const seen = await run(2200);
const a = seen.map(x => x[0]), t = seen.map(x => x[1]);
const frames = new Set(a.map(x => x.frame)), moved = a.at(-1).x - a[0].x;
ck('倒戈的兵走向同伴（向右移动），朝向目标', moved > 40 && a.some(x => x.dir === 'right'), { moved, dirs: [...new Set(a.map(x => x.dir))], placed });
ck('倒戈期间播放行走帧（帧在变，不是定格平移）', frames.size >= 3, { frames: [...frames].slice(0, 8) });
ck('贴身后出手：攻击状态 / 攻击帧出现', a.some(x => x.atk), { atk: a.filter(x => x.atk).length });
ck('打中同伴：同伴掉血', t.at(-1).hp < 1e6, { hp: t.at(-1).hp });
ck('倒戈中头顶有倒戈标记（离间断锁链）', a.some(x => x.turned && x.mark), { marks: a.filter(x => x.mark).length });
await p.screenshot({ path: `${out}/turned-strike.png` });
// 倒戈结束：恢复追主将（走向主将，即向左）
await p.waitForTimeout(1600);
const back0 = (await sample())[0]; await p.waitForTimeout(900); const back1 = (await sample())[0];
ck('倒戈结束后恢复正常：不再倒戈、转回去追主将', !back1.turned && back1.x < back0.x, { back0, back1 });

// ② 闭月分支：精锐被魅惑后先去打首领，分支伤害打得到首领
await setup([['elite', 260, 0], ['infantry', 330, 60]]);
const boss = await p.evaluate(S0 => { const s = eval(S0); s.spawnBoss(); const bo = s.boss; bo.sprite.setPosition(s.player.x + 430, s.player.y - 10); bo.hp = bo.maxHp = 1e7; bo.def = { ...bo.def, speed: 0 }; window.__B = bo; window.__strikes = 0;
  const elite = window.__T[0]; const ok = s.player.passive.charmTurn(elite, s.combatNow, 4000, { huntBoss: true, strike: tg => { window.__strikes++; window.__lastTarget = tg.kind; s.hitEnemy(tg, 500, s.combatNow, 'melee', true, false); } });
  return { ok, bossHp: bo.hp }; }, S);
// 首领出场会补发三选一 / 出场卡：等待期间把弹出的三选一选掉、剧情卡点掉（不然战斗暂停、精锐不动）
for (let i = 0; i < 18; i++) { await p.evaluate(S0 => { const s = eval(S0); if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade(0); else if (s.mode === 'branch') s.chooseBranch?.(0); else if (s.mode !== 'none' && !s.over) s.setMode('none'); }, S); await p.waitForTimeout(200); }
const br = await p.evaluate(S0 => { const s = eval(S0), e = window.__T[0], bo = window.__B; return { mode: s.mode, turned: s.player.passive.isTurned(e, s.combatNow), immune: !!e.controlImmune, stun: e.stunUntil > s.combatNow, strikes: window.__strikes, target: window.__lastTarget ?? null, bossHp: Math.round(bo.hp), dBoss: Math.round(Math.hypot(bo.x - e.x, bo.y - e.y)), infantryHp: Math.round(window.__T[1].hp) }; }, S);
ck('闭月分支：精锐被魅惑（charmTurn 成功）后走向首领并出手打首领（进阶「被魅惑的精锐会攻击首领」）', boss.ok && br.strikes > 0 && br.target === 'boss' && br.bossHp < 1e7, { ...br, boss });
await p.screenshot({ path: `${out}/charmed-elite-boss.png` });

ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
