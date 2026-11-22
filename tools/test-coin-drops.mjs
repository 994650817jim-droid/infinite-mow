// 钱币掉落（data/coinDrops.ts、systems/CoinDropField.ts、GameScene.dropCoins；设计见共享笔记 coin-drops.md）：纯 node，不开浏览器。
// ① 掉率与每杀期望在大样本下与表一致；② 保底（连续 15 个不掉下一个必掉）；③ 面值小数的余数累积（没有取整偏差）；
// ④ 精锐 / 首领必掉、首领 4 堆；⑤ 兵种归档；⑥ 首领阶段防刷（额度用完不掉、保底不计数，首领 / 副将照掉）；
// ⑦ 掉落物对象池上限 60、降级阈值 140、12 秒自动入囊、入账时机（碰到主将那一刻）、一关打完全部收走；
// ⑧ 总开关：关闭时走旧的 Legion.onKill，旧代码与接入前（git 里的 BASE 提交）一字不差。
// 用法：node tools/test-coin-drops.mjs      （COIN_BASE=<提交号> 可换对照的提交，默认 fdc833e2 = 接入前的 main）
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASE = process.env.COIN_BASE ?? 'fdc833e2';
const r = await build({ stdin: { contents: "export * as CD from './src/data/coinDrops'; export * as CF from './src/systems/CoinDropField'; export * as BS from './src/data/bossStall'; export { GEM_FX } from './src/data/gemFx';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error' });
const { CD, CF, BS, GEM_FX } = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
let pass = 0, fail = 0;
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// 固定种子的 mulberry32（32 位整数运算，不会像「大数相乘再取模」那样在双精度里丢位而偏）
let seed = 20261121; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const NORMAL = ['fodder', 'infantry', 'shield', 'archer', 'cavalry', 'special'];

ck('总开关默认开', CD.COIN_DROPS_DEFAULT === true && CD.coinDropsOn() === true);

// ① ② ③ 每个兵种单独抽 40 万次
{
  const N = 400000, rows = {};
  let allOk = true, pityOk = true, carryOk = true, intOk = true; const drift = {};
  for (const kind of NORMAL) {
    const R = new CD.CoinRoller(), d = CD.COIN_DROP[kind]; let sum = 0, drops = 0, run = 0, maxRun = 0, valueSum = 0;
    for (let i = 0; i < N; i++) {
      const p = R.roll(kind, rnd);
      if (!p) { run++; maxRun = Math.max(maxRun, run); continue; }
      run = 0; drops++; valueSum += CD.coinValue(kind); for (const v of p) { sum += v; if (!Number.isInteger(v) || v <= 0) intOk = false; } if (p.length !== 1) intOk = false;
      if (R.carry < -1e-6 || R.carry >= 1) carryOk = false;
    }
    // 表规定的两件事：不靠保底时的掉率 = chance；每次掉落的面值 = expect ÷ chance × PITY_COMP（平均每次掉落的入账额应等于它）
    const natural = (drops - R.stats.pity) / (N - R.stats.pity), perDrop = sum / drops, perKill = sum / N;
    rows[kind] = { chance: d.chance, naturalRate: +natural.toFixed(4), faceValue: +CD.coinValue(kind).toFixed(3), perDrop: +perDrop.toFixed(3), pityShare: +(R.stats.pity / drops * 100).toFixed(1) + '%', maxMissRun: maxRun, expect: d.expect, perKillWithPity: +perKill.toFixed(4), vsTable: (perKill / d.expect >= 1 ? '+' : '') + ((perKill / d.expect - 1) * 100).toFixed(1) + '%' };
    if (Math.abs(natural / d.chance - 1) > .015 || Math.abs(perDrop / CD.coinValue(kind) - 1) > .001) allOk = false;
    if (maxRun > CD.COIN_PITY.misses) pityOk = false;
    if (Math.abs(sum - (valueSum - R.carry)) > 1e-6 * N || sum !== R.stats.total || drops !== R.stats.drops) carryOk = false;
    // 单一兵种连续刷时，含保底的每杀期望相对表的偏差（面值已乘 PITY_COMP = .975）
    drift[kind] = perKill / d.expect - 1;
  }
  ck('每个普通兵种 40 万次：不靠保底时的掉率与表一致（±1.5%），每次掉落的平均入账额 = 表里的面值（±0.1%）', allOk, Object.fromEntries(NORMAL.map(k => [k, [rows[k].naturalRate, rows[k].perDrop]])));
  ck('【实测，供平衡参考】单一兵种连续刷时含保底的每杀期望相对表：流民 +17～22%（掉率 10%，保底触发多，.975 补不回来）；刀兵 0～+4%；刀盾 / 弓手 / 骑兵 / 特性兵 −3～+1%', drift.fodder > .17 && drift.fodder < .22 && drift.infantry > 0 && drift.infantry < .04 && ['shield', 'archer', 'cavalry', 'special'].every(k => drift[k] > -.03 && drift[k] < .01), Object.fromEntries(NORMAL.map(k => [k, rows[k].vsTable])));
  ck('保底：任何兵种都不会连续超过 15 个不掉', pityOk && parseFloat(rows.fodder.pityShare) > 5, Object.fromEntries(NORMAL.map(k => [k, rows[k].maxMissRun])));
  ck('余数累积：每次发出去的都是正整数，小数攒在 carry（0 ≤ carry < 1），发出的总额 = 面值之和 − carry，没有取整偏差', carryOk && intOk);
}
// 保底的精确行为：前 15 个都不中，第 16 个必掉而且不掷骰
{
  const R = new CD.CoinRoller(); let calls = 0; const never = () => { calls++; return .9999; };
  const first = Array.from({ length: 15 }, () => R.roll('infantry', never)), sixteenth = R.roll('infantry', never);
  ck('连续 15 个没掉，第 16 个必掉（这一下不掷骰），之后重新计数', first.every(x => x === null) && Array.isArray(sixteenth) && calls === 15 && R.misses === 0 && R.stats.pity === 1 && R.roll('infantry', never) === null && R.misses === 1, { sixteenth, calls });
  const R2 = new CD.CoinRoller(); for (let i = 0; i < 7; i++) R2.roll('infantry', never); R2.roll('elite', never); R2.roll('boss', never);
  ck('精锐 / 首领不参与保底计数（不清零也不累加）', R2.misses === 7);
}
// ④ 精锐、首领
{
  const R = new CD.CoinRoller(), e = Array.from({ length: 50 }, () => R.roll('elite', rnd)), b = Array.from({ length: 50 }, () => R.roll('boss', rnd));
  ck('精锐必掉 1 堆 5；首领必掉 4 堆各 5（合计 20），与原来的 +5 / +20 对齐', e.every(p => same(p, [5])) && b.every(p => same(p, [5, 5, 5, 5])) && CD.coinValue('elite') === 5 && CD.coinValue('boss') === 20);
}
// 典型兵种比例的每杀平均（只报数：第一章刀兵 / 流民多，后期骑兵 / 特性兵多）
{
  const mix = (w, n = 300000) => { const R = new CD.CoinRoller(), ks = Object.keys(w), tot = ks.reduce((s, k) => s + w[k], 0); let sum = 0; for (let i = 0; i < n; i++) { let x = rnd() * tot, k = ks[0]; for (const c of ks) { if (x < w[c]) { k = c; break; } x -= w[c]; } const p = R.roll(k, rnd); if (p) sum += p[0]; } return +(sum / n).toFixed(3); };
  const ch1 = mix({ infantry: 70, fodder: 12, shield: 12, archer: 6 }), late = mix({ infantry: 35, shield: 20, archer: 18, cavalry: 15, special: 10, fodder: 2 });
  const t1 = .7 * 1 + .12 * .45 + .12 * 1.1 + .06 * 1.1, t2 = .35 * 1 + .2 * 1.1 + .18 * 1.1 + .15 * 1.25 + .1 * 1.6 + .02 * .45;
  ck('【实测，供平衡参考】混合兵种（保底计数各兵种共用）的每杀平均：两组我假设的比例下与按表加权的期望相差不超过 3%（第一章那组约 0.97，比原来每杀固定 1 少约 3%；后期那组约 1.12）', Math.abs(ch1 / t1 - 1) < .03 && Math.abs(late / t2 - 1) < .03, { ch1, tableCh1: +t1.toFixed(3), late, tableLate: +t2.toFixed(3) });
}
// ⑤ 兵种归档
ck('归档：首领 / 精锐按兵种；role fodder = 炮灰档；pack / swim 按基础兵种；其余 role = 特性兵；没配特性的按兵种',
  same([CD.coinKindOf('boss'), CD.coinKindOf('elite', 'heavy'), CD.coinKindOf('infantry', 'fodder'), CD.coinKindOf('infantry', 'pack'), CD.coinKindOf('archer', 'swim'), CD.coinKindOf('infantry', 'support'), CD.coinKindOf('shield', 'heavy'), CD.coinKindOf('infantry'), CD.coinKindOf('shield'), CD.coinKindOf('archer'), CD.coinKindOf('cavalry'), CD.coinKindOf('whatever')],
    ['boss', 'elite', 'fodder', 'infantry', 'archer', 'special', 'special', 'infantry', 'shield', 'archer', 'cavalry', 'infantry']));

// ⑥ 首领阶段防刷：和随军粮同一套 killGrant
{
  const G = fs => readFileSync('src/scenes/GameScene.ts', 'utf8');
  const src = G();
  const within = BS.killGrant('infantry', 1, 60, false), over = BS.killGrant('infantry', 9999, 60, false), overElite = BS.killGrant('elite', 9999, 60, false), boss = BS.killGrant('boss', 9999, 60, false), lt = BS.killGrant('elite', 9999, 60, true);
  ck('killGrant：额度内普通兵给钱；额度用完普通兵 / 精锐不给；首领、副将任何时候都给', within.food === true && over.food === false && overElite.food === false && boss.food === true && lt.food === true);
  ck('GameScene.killEnemy：掉钱币与旧的入账走同一个 grant.food 闸门——额度用完时既不掉、也不调判定（保底不计数）', /if \(coinDropsOn\(\) && !ch1TrialOn\(this\.hardKey\(\)\)\) \{ if \(grant\.food\) this\.dropCoins\(enemy\); \}\r?\n    else if \(grant\.food\) this\.legion\.onKill\(enemy\);/.test(src) && (src.match(/this\.dropCoins\(/g) ?? []).length === 1 && (src.match(/coinRoller\.roll\(/g) ?? []).length === 1);
  ck('攻城：不给战利品的敌人（noLoot）也不掉钱币', /protected dropCoins\(enemy: Enemy\) \{ if \(!this\.noLoot\) super\.dropCoins\(enemy\); \}/.test(readFileSync('src/scenes/SiegeGameScene.ts', 'utf8')));
  ck('击杀给钱只有 GameScene.killEnemy 这一处（各章 / 攻城 / 守城 / 军情 / 支线 / 名将连战都是它的子类，没有别处调 legion.onKill）', execFileSync('git', ['grep', '-n', 'legion\\.onKill(', '--', 'src'], { encoding: 'utf8' }).trim().split('\n').length === 1);
}

// ⑦ 掉落物对象池
{
  const views = []; let credited = [], other = 0;
  const mk = (extra = {}) => new CF.CoinDropField({ view: () => { const v = { x: 0, y: 0, f: 0, on: false, place(x, y, f) { this.x = x; this.y = y; this.f = f; }, show(on) { this.on = on; } }; views.push(v); return v; }, onCollect: (value, x, y) => credited.push({ value, x, y }), otherLive: () => other, rnd, ...extra });
  const landMs = GEM_FX.dropMs + GEM_FX.bounceMs, R = 95;
  // 上限
  { const F = mk(); let ok = 0; for (let i = 0; i < 70; i++) if (F.spawn(1000 + i, 1000, 5, 0)) ok++;
    ck('对象池上限 60：第 61 个起 spawn 返回 false（调用方直接入账），池里不会多造', ok === 60 && F.live === 60 && F.drops.length === CD.COIN_PICKUP.cap && F.stats.overflow === 10 && views.length === 60 && F.list().length === 60, { ok, overflow: F.stats.overflow });
    F.update(landMs + 1, .016, 0, 0, R); const before = credited.length, sum = F.collectAll();
    ck('一关打完 collectAll：地上的全部收走并返回总额（60 × 5 = 300），本身不触发表现', sum === 300 && F.live === 0 && credited.length === before && views.slice(0, 60).every(v => !v.on));
    ck('收走后槽位复用，不再新造', F.spawn(0, 0, 3, 5000) && F.drops.length === 60 && views.length === 60); }
  // 入账时机 + 吸取
  { credited = []; const F = mk(); F.spawn(200, 0, 7, 0);
    let t = 0; const step = (ms, px = 0, py = 0) => { for (let k = 0; k < ms / 16; k++) { t += 16; F.update(t, .016, px, py, R); } };
    step(landMs + 20, 2000, 2000); const landed = F.list()[0];
    ck('落地：抛物线 + 轻弹之后停在落点附近（离掉落点不超过散布范围），状态 rest', landed.phase === 'rest' && Math.abs(landed.x - 200) <= GEM_FX.spread + 1 && Math.abs(landed.y) <= GEM_FX.spread && credited.length === 0, landed);
    step(2000, 2000, 2000); ck('主将在吸取范围外：一直躺着，不入账', F.list()[0].phase === 'rest' && credited.length === 0);
    F.update(t += 16, .016, landed.x + 60, landed.y, R); const flying = F.list()[0].phase;
    ck('主将走进吸取范围（和经验信物同一个半径）：开始飞，但还没入账', flying === 'fly' && credited.length === 0);
    let frames = 0; while (F.live && frames++ < 400) F.update(t += 16, .016, landed.x + 60, landed.y, R);
    ck('碰到主将的那一刻入账：只入一次、数额就是面值、位置是主将处', credited.length === 1 && credited[0].value === 7 && credited[0].x === landed.x + 60 && F.stats.collected === 1 && F.stats.auto === 0 && frames < 60, { frames, credited });
    ck('全场吸取（鸣金 / 搜集辎重：半径无限大）：再远也飞过来', (() => { credited = []; const F2 = mk(); F2.spawn(5000, 5000, 4, 0); let tt = 0, n = 0; while (F2.live && n++ < 3000) F2.update(tt += 16, .016, 0, 0, tt > landMs + 20 ? 1e9 : R); return credited.length === 1 && credited[0].value === 4; })()); }
  // 12 秒自动入囊
  { credited = []; const F = mk(); F.spawn(900, 0, 6, 0); let t = 0; const far = [0, 0];
    while (t < landMs + CD.COIN_PICKUP.lifeMs - 100) F.update(t += 16, .016, ...far, R);
    const still = F.list()[0].phase, none = credited.length;
    while (t < landMs + CD.COIN_PICKUP.lifeMs + 100) F.update(t += 16, .016, ...far, R);
    const flying = F.list()[0]?.phase; let n = 0; while (F.live && n++ < 3000) F.update(t += 16, .016, ...far, R);
    ck('落地 12 秒没捡：自己飞向主将，到了才入账（不是到点就凭空加）', still === 'rest' && none === 0 && flying === 'fly' && credited.length === 1 && credited[0].value === 6 && F.stats.auto === 1 && t > landMs + CD.COIN_PICKUP.lifeMs, { arrivedAtMs: t }); }
  // 降级阈值：两种掉落物合计超过 140
  { other = 100; const F = mk(); for (let i = 0; i < 45; i++) F.spawn(i, 0, 5, 0); const liteBefore = F.drops.filter(c => c.lite).length;
    other = 135; const F2 = mk(); for (let i = 0; i < 10; i++) F2.spawn(i, 0, 5, 0); const lites = F2.drops.map(c => c.lite);
    ck('降级：经验信物 + 钱币合计超过 140 时新掉的降级（不浮动、不翻面），之前掉的不变；手机布局一律降级', liteBefore === 4 && same(lites, [false, false, false, false, false, false, true, true, true, true]) && (() => { other = 0; const F3 = mk({ alwaysLite: true }); F3.spawn(0, 0, 1, 0); return F3.drops[0].lite; })(), { liteBefore, lites }); other = 0;
    const F4 = mk(); F4.spawn(300, 300, 5, 0); F4.drops[0].lite = true; let t = 0; while (t < landMs + 3000) F4.update(t += 16, .016, 0, 0, R); const v = views[views.length - 1];
    ck('降级的钱币落地后是静止的正面（第 0 帧、不动）', v.f === 0 && v.y === F4.drops[0].ly && v.on); }
  ck('常量：池 60、12 秒、合计 140；保底 15', CD.COIN_PICKUP.cap === 60 && CD.COIN_PICKUP.lifeMs === 12000 && CD.COIN_PICKUP.liteAbove === 140 && CD.COIN_PITY.misses === 15);
}

// ⑧ 总开关关闭 = 旧行为
{
  CD.setCoinDrops(false); const off = CD.coinDropsOn(); CD.setCoinDrops(true); const on = CD.coinDropsOn(); CD.setCoinDrops(null);
  ck('setCoinDrops(false / true / null)：强制关、强制开、还给默认', off === false && on === true && CD.coinDropsOn() === true);
  let haveBase = true; try { execFileSync('git', ['cat-file', '-e', BASE + '^{commit}'], { stdio: 'ignore' }); } catch { haveBase = false; }
  if (!haveBase) ck(`对照提交 ${BASE} 不在本仓库里（COIN_BASE 可改）`, false);
  else {
    const norm = s => s.replace(/\r\n/g, '\n'), old = f => norm(execFileSync('git', ['show', `${BASE}:${f}`], { encoding: 'utf8', maxBuffer: 1 << 28 })), cur = f => norm(readFileSync(f, 'utf8'));
    ck(`开关关闭走的旧入账 Legion.onKill（杂兵 +1、精锐 +5、首领 +20）：src/systems/Legion.ts 与 ${BASE} 一字不差`, old('src/systems/Legion.ts') === cur('src/systems/Legion.ts') && /this\.food \+= enemy\.kind === 'boss' \? 20 : enemy\.kind === 'elite' \? 5 : 1;/.test(cur('src/systems/Legion.ts')));
    ck(`首领阶段额度 data/bossStall.ts 与 ${BASE} 一字不差`, old('src/data/bossStall.ts') === cur('src/data/bossStall.ts'));
    const o = old('src/scenes/GameScene.ts'), c = cur('src/scenes/GameScene.ts');
    ck('GameScene.killEnemy 里原来那一行「if (grant.food) this.legion.onKill(enemy);」只是前面加了开关分支：关着时执行的就是它', o.includes('    if (grant.food) this.legion.onKill(enemy); // 首领阶段超额：随军粮 0') && c.includes('    else if (grant.food) this.legion.onKill(enemy);') && !c.includes('\n    if (grant.food) this.legion.onKill(enemy);'));
    ck('经验信物的吸取半径算法没变（只是提成了 pickupRadiusNow，钱币共用）', o.includes('this.combatNow < this.gemMagnetUntil ? 1e9 : this.player.stats.pickupRadius * this.player.growth.pickupMultiplier()') && c.includes('protected pickupRadiusNow(): number { return this.combatNow < this.gemMagnetUntil ? 1e9 : this.player.stats.pickupRadius * this.player.growth.pickupMultiplier(); }'));
    ck(`数值表（COIN_DROP / COIN_PITY / PITY_COMP / COIN_PICKUP / coinValue）与平衡会话提交的原文一致，只在文件末尾追加了接入代码`, cur('src/data/coinDrops.ts').startsWith(norm(execFileSync('git', ['show', '19f8cf3d:src/data/coinDrops.ts'], { encoding: 'utf8' })).trimEnd()));
  }
}
console.log(`\n${fail ? 'FAILED' : 'OK'} · ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
