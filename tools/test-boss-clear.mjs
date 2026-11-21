// 首领登场「鸣金让道」（data/bossClear.ts，平衡会话配兵审计 wave-mix-audit.md）：纯 node，不开浏览器。
// 1) pickWithdraw：只撤普通小兵（精锐 / 副将 / 特殊兵种不撤）、撤到 ≤ keep、离主将最远的先撤（平衡会话 11-21）、往外略向两侧退；
// 2) withdrawXp：撤走的兵经验折一半；quietMs 6–8 秒（平衡会话 11-21）；
// 3) 接线静态检查：GameScene.spawnBoss 里调、跳过攻城 / 守城与目标型关卡、退开中的兵不出手且到点撤走（不算击杀）、
//    静场期间主刷兵与刷兵帐篷都不出、撤完时经验一次性给并出「敌军溃退」横幅。
// 用法：node tools/test-boss-clear.mjs（NODE_PATH 指向有 esbuild 的 node_modules）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let esbuild; try { esbuild = require('esbuild'); } catch { esbuild = require(join(process.env.NODE_PATH ?? '', 'esbuild')); }
const root = process.cwd();
const load = async entry => { const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const C = await load('src/data/bossClear.ts'), K = C.BOSS_CLEAR.keep;

// 场景：主将 (0,0)，首领在正上方 (0,-430)；60 个兵（平衡会话：首领段开始时同屏平均 50–75 人）：50 普通（步 / 盾 / 弓 / 骑）+ 6 精锐（含副将）+ 4 特殊兵种
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const units = [];
for (let i = 0; i < 50; i++) units.push({ x: (rnd() - .5) * 900, y: (rnd() - .8) * 700, kind: ['infantry', 'shield', 'archer', 'cavalry'][i % 4] });
for (let i = 0; i < 6; i++) units.push({ x: (rnd() - .5) * 600, y: -200 + (rnd() - .5) * 300, kind: 'elite' });
for (let i = 0; i < 4; i++) units.push({ x: (rnd() - .5) * 600, y: -150, kind: 'infantry', special: true });
const P = { x: 0, y: 0 }, B = { x: 0, y: -430 }, picks = C.pickWithdraw(units, P, B);
const picked = picks.map(p => units[p.index]);
ck(`60 个兵 → 撤 ${picks.length} 个（${Math.round(picks.length / units.length * 100)}%），留 ${units.length - picks.length} 个（12–15）`, units.length - picks.length <= 15 && units.length - picks.length >= 12 && picks.length / units.length >= .75, { picks: picks.length, keep: K });
ck('只撤普通小兵：精锐 / 副将、特殊兵种一个不撤', picked.every(u => u.kind !== 'elite' && !u.special));
const dist = u => Math.hypot(u.x, u.y);
const keptNormal = units.filter((u, i) => !picks.some(p => p.index === i) && u.kind !== 'elite' && !u.special);
ck('离主将最远的残兵先撤：撤走的都比留下的普通兵离主将远（身边正在打的留着）', keptNormal.every(k => picked.every(p => dist(p) >= dist(k) - 1e-6)), { minPicked: Math.min(...picked.map(dist)).toFixed(1), maxKept: keptNormal.length ? Math.max(...keptNormal.map(dist)).toFixed(1) : null });
ck('往外撤：方向是单位向量、背离主将，横向分量朝自己所在的一侧（略向两边分开）', picks.every(p => { const u = units[p.index], d = dist(u) || 1; return Math.abs(Math.hypot(p.dx, p.dy) - 1) < 1e-6 && (p.dx * u.x + p.dy * u.y) / d > 0 && (u.x === 0 || Math.sign(p.dx) === Math.sign(u.x)); }));
ck('场上本来就不多（≤ keep）：一个不撤', C.pickWithdraw(units.slice(0, K), P, B).length === 0);
const fewNormal = [...units.slice(50, 60), ...units.slice(50, 56).map(u => ({ ...u, x: u.x + 40 })), ...units.slice(0, 6)], fp = C.pickWithdraw(fewNormal, P, B); // 22 个里只有 6 个普通兵，要撤 8 个也只能撤 6 个
ck('普通兵不够撤（多是精锐 / 特殊）：只撤普通兵，精锐留着（总数可以超 keep）', fp.length === 6 && fp.every(p => !fewNormal[p.index].special && fewNormal[p.index].kind !== 'elite'), { n: fp.length });

ck('撤走的兵经验折一半：46 个各 2 点 → 46；没撤 → 0；零头四舍五入、至少 1', C.withdrawXp(Array(46).fill(2)) === 46 && C.withdrawXp([]) === 0 && C.withdrawXp([1, 2]) === 2 && C.withdrawXp([.4]) === 1 && C.BOSS_CLEAR.xpShare === .5, { a: C.withdrawXp(Array(46).fill(2)), b: C.withdrawXp([1, 2]) });
ck('静场 quietMs 6–8 秒、比退开时间长', C.BOSS_CLEAR.quietMs >= 6000 && C.BOSS_CLEAR.quietMs <= 8000 && C.BOSS_CLEAR.quietMs > C.BOSS_CLEAR.ms, C.BOSS_CLEAR.quietMs);

const G = readFileSync(join(root, 'src/scenes/GameScene.ts'), 'utf8');
ck('GameScene.spawnBoss：首领一出场就调 bossClearStage', /this\.boss = boss;\s*\n(?:\s*this\.battleHeal\?\.bossEntryAid\([^\n]*\n)?\s*this\.bossClearStage\(boss\);/.test(G));
ck('跳过：攻城 / 守城（SiegeGameScene）、目标没完成的目标型关卡；双首领不跳过', /bossClearAllowed\(\): string \{ if \(this\.scene\.key === 'SiegeGameScene'\) return '攻城 \/ 守城'; if \(this\.objective && !this\.objective\.done\) return '目标型关卡'; return ''; \}/.test(G));
ck('退开中的兵：不出手、往两侧走、最后淡出、到点撤走（deactivate，不走击杀结算）', /if \(enemy\.withdrawUntil\) \{[^}]*left <= 0\) \{ enemy\.sprite\.setAlpha\(1\); enemy\.deactivate\(\); continue; \}[^\n]*contactCd = Math\.max\(enemy\.contactCd, \.3\)/.test(G));
ck('有撤兵才静场：bossQuietUntil = combatNow + quietMs，经验按撤走的兵算、退开结束时结算', /if \(picks\.length\) \{[^}]*this\.bossQuietUntil = this\.combatNow \+ BOSS_CLEAR\.quietMs;[^}]*withdrawXp\(picks\.map\(p => list\[p\.index\]\.def\.xp\)\)[^}]*this\.bossClearPending = \{ at: this\.combatNow \+ BOSS_CLEAR\.ms/.test(G));
ck('静场期间主刷兵不出（updateSpawner 的刷兵条件带 bossQuietUntil）', /this\.spawnTimer <= 0 && this\.activeEnemyCount\(\) < cap && this\.combatNow >= this\.bossQuietUntil\)/.test(G));
ck('静场期间刷兵帐篷不出（tentCtx.crowd 静场时报满）', /crowd:\(\)=>this\.combatNow<this\.bossQuietUntil\?Infinity:this\.activeEnemyCount\(\)/.test(G));
ck('撤完时：经验一次性给（走 gainXp / scaleXp，会升级）、出「敌军溃退」横幅；新开一局清零', /const c = this\.bossClearPending; if \(c && this\.combatNow >= c\.at && !this\.over\) \{ this\.bossClearPending = null; const gained = [^;]*this\.player\.gainXp\(this\.player\.growth\.scaleXp\(c\.xp, this\.heroXpRate\(\)\)\)[^}]*onHeroLevelUp\(gained\); this\.showWaveBanner\('敌军溃退'/.test(G) && /this\.bossQuietUntil=0;this\.bossClearPending=null;/.test(G));
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
