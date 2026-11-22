// 资源显示（11-21 用户试玩「我第一关-1-1看不到自己军粮」）：纯 node，不开浏览器。
// 原则：资源和状态数字尽量显示，没开放的操作按钮才隐藏——随军粮从 1-1 起显示；兵力 / 阵亡、护阵 / 出击按钮等部曲（1-2）开放。
// 1) data/legion.ts legionStatusText 的输出（esbuild 打包到内存再载入）；2) 接线的静态检查（GameScene / LegionUI / 结算页）。
// 用法：node tools/test-hud-resources.mjs（NODE_PATH 指向有 esbuild 的 node_modules）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let esbuild; try { esbuild = require('esbuild'); } catch { esbuild = require(join(process.env.NODE_PATH ?? '', 'esbuild')); }
const root = process.cwd();
const load = async entry => { const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };

const L = await load('src/data/legion.ts');
// 2026-11-21 钱币改到右上「行囊」旁边显示（hud-coin-count），左上部曲行只写兵力
const a = L.legionStatusText(0, 0, false), b = L.legionStatusText(5, 0, true), c = L.legionStatusText(5, 2, true);
ck('部曲没开放（1-1）：左上部曲行空着（钱币在行囊旁）', a === '', a);
ck('部曲开放后：「兵力 N」，有阵亡再加「· 阵亡 N」', b === '兵力 5' && c === '兵力 5 · 阵亡 2', { b, c });

const G = readFileSync(join(root, 'src/scenes/GameScene.ts'), 'utf8'), U = readFileSync(join(root, 'src/ui/LegionUI.ts'), 'utf8');
const call = G.match(/this\.legionUI\?\.update\(this\.legion,([^;]*)\);/)?.[1] ?? '';
ck('战斗 HUD：状态行不再跟部曲开放一起藏（只把 mechOpen(squad) 作为第三个参数传给按钮 / 兵力）', /,\s*mechOpen\('squad'\)\s*\)?$/.test(call.trim()) && !/&&\s*mechOpen\('squad'\)/.test(call), call.trim());
ck('LegionUI：部曲没开放时只藏护阵 / 出击按钮（含快捷键角标），并关掉点击', /for \(const o of \[this\.orderPlate, this\.orderIcon, this\.order, this\.keyHint\]\) o\?\.setVisible\(squad\)/.test(U) && /disableInteractive\(\)/.test(U) && /legionStatusText\(army\.count, army\.dead, squad\)/.test(U));
ck('结算页：有「随军钱币」一行（不看玩法开放）；「部曲战损」等部曲开放再写', /row\('随军钱币', String\(this\.legion\.food\)\)/.test(G) && /mechOpen\('squad'\) \? \[row\('部曲战损'/.test(G));
ck('E / F（护阵 / 出击快捷键）部曲开放前无反应', /cycleOrder: \(\) => \{ if \(mechOpen\('squad'\)\) this\.legion\.cycleOrder\(\); \}/.test(G));
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
