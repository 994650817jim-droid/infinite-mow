// 守城止血（用户 11-21「士兵四面八方围攻中心，和守城不关联」）：纯 node，不开浏览器。
// 1) 墙内不刷兵：守城里一切刷兵（环形刷兵、精锐、特色兵、敌阵小队、首领召唤）都挪到墙外敌营；只有云梯爬上来的（defInside）在墙内；
// 2) 敌营刷兵口在墙外、且在封闭场地里（关墙两端接崖壁 / 角楼、南北封边，只有城门可通）；
// 3) 云梯爬进城里的兵同时最多 climberCap 个（原来每架梯子每 3.2 秒一个、不封顶）。重做方案见共享笔记 defense-redesign-v2.md。
// 用法：node tools/test-defense-spawn.mjs（NODE_PATH 指向有 esbuild 的 node_modules）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let esbuild; try { esbuild = require('esbuild'); } catch { esbuild = require(join(process.env.NODE_PATH ?? '', 'esbuild')); }
const root = process.cwd();
const load = async entry => { const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const src = p => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const S = src('src/scenes/SiegeGameScene.ts'), DB = src('src/systems/DefenseBattle.ts'), SP = src('src/systems/SishuiPass.ts');

ck('守城：经 spawnEnemy 的兵（除首领、云梯爬上来的）落点在墙内的一律挪到墙外敌营', /if \(this\.defend && kind !== 'boss' && !this\.defInside && y > this\.defend\.gatePos\.y - 20\) \{ const sp = this\.defend\.spawnPoint\(\); x = sp\.x; y = sp\.y; \}/.test(S));
ck('守城：环形刷兵（含精英计时）不按主将四周，改从墙外敌营出', /if \(this\.defend\) \{ const p = this\.defend\.spawnPoint\(\); return this\.spawnEnemy\(kind, p\.x, p\.y, undefined, force\); \}/.test(S));
ck('守城：野战布景的敌营帐篷不要（会在城里出兵）；喘息时主刷兵停', /this\.enemyCamps\?\.clear\(\); this\.enemyCamps = undefined;/.test(S) && S.includes('protected updateSpawner(dt: number, time: number) { if (this.defend?.resting || this.assault?.resting) return; super.updateSpawner(dt, time); }'));
ck('其他刷兵入口（特色兵、敌阵小队、首领招式召唤）都走场景的 spawnEnemy（会被上面这条挪出去）', /spawn:\(k,x,y\)=>this\.spawnEnemy\(k,x,y,undefined,true\)/.test(src('src/scenes/GameScene.ts')));
const D = (await load('src/data/defenseBattle.ts')).DEFENSE, P = SP.match(/northReach: (\d+)/);
const north = P ? +P[1] : 0, spawnTop = D.spawn.y - 60, spawnBot = D.spawn.y + 60;
ck('敌营刷兵口在墙外（北 ' + (D.wallY - D.spawn.y) + ' 处）、在封闭场地里（关墙往北 ' + north + '）', spawnBot < D.wallY - 300 && spawnTop > D.wallY - north, { wallY: D.wallY, spawn: D.spawn.y, north });
ck('场地封闭：关墙两端接崖壁 / 角楼，南北封边，只有城门可通', /private sealFlanks\(px: number, py: number, wy: number\): void \{/.test(SP) && /this\.slab\(px - W - T, bot, px \+ W \+ T, bot \+ T\); this\.slab\(px - W - T, top - T, px \+ W \+ T, top\);/.test(SP));
ck('云梯爬进城的兵同时最多 ' + D.climberCap + ' 个（各梯子合计；满了等 0.8 秒）', D.climberCap === 5 && /if \(this\.climbing\.size >= D\.climberCap\) \{ g\.next = now \+ 800; continue; \}/.test(DB) && /if \(c\) \{ this\.stats\.climbers\+\+; this\.climbing\.add\(c\); \}/.test(DB));
{ // 一波 70 秒、3 架梯子：原来最多进来多少、现在同时最多多少（假设都没被打死）
  const before = 3 * Math.floor(D.attackSec * 1000 / D.climbMs); ck('后档一波 3 架梯子：原来城里最多堆 ' + before + ' 个，现在同时最多 ' + D.climberCap + ' 个', before > 50 && D.climberCap <= 6, { before, cap: D.climberCap }); }
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
