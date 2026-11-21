// 总制作人第四轮试玩 · 守城（许昌，曹操反攻）：纯 node，不开浏览器。
// 1) 府衙失守 ≠ 阵亡：结局「府衙失守」，不给主将 / 随行负伤、部曲折损（只主将阵亡才给）；守城自己的后果（城池被围、营寨军粮）照旧；
// 2) 结算时收掉「喘息 · 布防」面板；3) 布防按章 / 喘息次数涨价、同项再买更贵、做不成不扣粮；
// 4) 第一次守城第一次喘息弹引导卡（强调修城门），每次喘息横幅带城门 %；5) 单场收益上限（精锐战功 / 残卷 / 非首领兵装）。
// 用法：node tools/test-defense-r6.mjs（NODE_PATH 指向有 esbuild 的 node_modules）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let esbuild; try { esbuild = require('esbuild'); } catch { esbuild = require(join(process.env.NODE_PATH ?? '', 'esbuild')); }
const root = process.cwd();
const load = async entry => { const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const src = p => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const G = src('src/scenes/GameScene.ts'), S = src('src/scenes/SiegeGameScene.ts'), DB = src('src/systems/DefenseBattle.ts'), ID = src('src/systems/ItemDrops.ts');

// ———— 1)
ck('结局类型多一种 keep（府衙失守，主将还活着）', /export type RunEndReason = 'boss' \| 'death' \| 'timeout' \| 'keep';/.test(src('src/types.ts')));
ck('守城府衙被破 → finish(false, \'keep\')（原来按阵亡）；结算「结局 府衙失守」', /lose: \(\) => \{ if \(!this\.over\) this\.finish\(false, 'keep'\); \}/.test(S) && /reason === 'keep' \? '府衙失守' : '阵亡'/.test(G));
ck('主将 / 随行负伤、部曲折损只在主将阵亡（death）时给；营寨军粮照扣；守城自己的后果（城池被围）由 settleDefense 照旧', /if \(!victory\) this\.runDefeatFlow\(reason\);/.test(G) && /protected runDefeatFlow\(reason: RunEndReason = 'death'\): void \{/.test(G) && /camp = reason !== 'death' \? null : patchCampaignDefeat\(/.test(G) && /loseProvisionsPct\(DEFEAT\.grainPct, DEFEAT\.grainCap\)/.test(G) && /守城失利 · \$\{this\.city\.name\}已被围/.test(S));

// ———— 2)
ck('结算时收掉喘息布防面板：失守 / 守住时 DefenseBattle 自己收，主将阵亡时 SiegeGameScene.finish 收', /if \(this\.keep\.hp <= 0\) \{ this\.done = true; this\.closePrep\(\); this\.h\.lose\(\); return; \}/.test(DB) && /this\.done = true; this\.closePrep\(\); this\.h\.win\(\); return; \}/.test(DB) && /if \(this\.over\) return;\s*\n\s*this\.defend\?\.closePrep\(\);/.test(S) && /closePrep\(\): void \{ this\.ui\?\.destroy\(\); this\.ui = null; \}/.test(DB));

// ———— 3)
const D = await load('src/data/defenseBattle.ts'), P = D.DEFENSE.prep;
const c = (b, ch, w, n) => D.prepCost(b, ch, w, n);
ck('底价：修城门 120 / 补滚木热油 80 / 补弓手 100（原 30 / 20 / 25）', P.repairCost === 120 && P.refillCost === 80 && P.archerCost === 100, P);
ck('按章、按喘息次数涨：第二章第 1 次喘息修门 120；第五章第 3 次 420；同一次喘息再修一次 ×1.6', c(120, 2, 0, 0) === 120 && c(120, 5, 2, 0) === 420 && c(120, 2, 0, 1) === 192 && c(120, 2, 0, 2) === 307, [c(120, 2, 0, 0), c(120, 5, 2, 0), c(120, 2, 0, 1), c(120, 2, 0, 2)]);
{ let food = 4344, spent = 0; for (let w = 0; w < 3; w++) for (const [b, k] of [[120, 3], [80, 2], [100, 2]]) for (let n = 0; n < k; n++) { const x = c(b, 3, w, n); if (food >= x) { food -= x; spent += x; } }
  ck('第三章守城每次喘息修门 3 次、补设施 2 次、补弓手 2 次：三次喘息要花 4000 粮上下（原来不到 300）', spent > 3000, { spent, left: food }); }
ck('按钮价钱随时刷新；先看做不做得成（门已破 / 没有阵亡弓手）再扣粮；「修城门 +N%」按实际修的比例写', /if \(this\.h\.food\(\) >= c && fn\(\) && this\.h\.spend\(c\)\)/.test(DB) && /btn\(W \/ 2 - 180, '修城门 \+' \+ Math\.round\(P\.repair \* 100\) \+ '%', P\.repairCost,/.test(DB) && /chapter: this\.lootChapter\(\)\}\);/.test(S));

// ———— 4)
ck('第一次守城的第一次喘息：引导卡（城门 %、门内读条免费修、花粮修门、不修撑不过第三波）；每次喘息横幅带城门 %', /if \(first && !this\.gate\.open\) this\.h\.guide\?\.\(defensePrepGuide\(pct\)\);/.test(DB) && /'城门 ' \+ pct \+ '% · 修城门、补设施、补弓手'/.test(DB) && /guide: t => showBarkCard\(this, \{ side: 'left', name: '守城 · 喘息布防', text: t \}\),/.test(S) && /撑不过第三波/.test(D.defensePrepGuide(61)) && /61%/.test(D.defensePrepGuide(61)));

// ———— 5)
const C = await load('src/data/battleLootCap.ts'), cap = C.BATTLE_LOOT_CAP;
ck('单场上限：主线一关 / 攻城 战功 25、残卷 3、兵装 6；守城 20 / 2 / 5', cap.stage.merit === 25 && cap.siege.drops === 6 && cap.defense.merit === 20 && cap.defense.scrolls === 2 && cap.defense.drops === 5, cap);
ck('接线：精锐战功按上限记；ItemDrops 残卷 / 非首领兵装按上限掉；守城 / 攻城场景各取一档；首领、宝箱不受影响', /else if\(enemy\.kind==='elite'&&grant\.merit&&this\.runMerit\.elite<BATTLE_LOOT_CAP\[this\.battleCapKind\(\)\]\.merit\)this\.runMerit\.elite\+\+;/.test(G) && /this\.itemDrops\.cap=\{scrolls:c\.scrolls,drops:c\.drops\}/.test(G) && /protected battleCapKind\(\): BattleCapKind \{ return this\.defense \? 'defense' : 'siege'; \}/.test(S) && /this\.capped\.scrolls < this\.cap\.scrolls && this\.rng\(\) < SCROLL\.eliteChance/.test(ID) && /if \(this\.capped\.drops >= this\.cap\.drops\) return;/.test(ID) && /if \(enemy\.kind === 'boss'\) this\.gainScrolls\(SCROLL\.boss\);/.test(ID));
{ const elites = 83, merit = Math.min(elites, cap.defense.merit); ck('一场守城精锐 83 个：战功 +83 → +20', merit === 20, { merit }); }
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
