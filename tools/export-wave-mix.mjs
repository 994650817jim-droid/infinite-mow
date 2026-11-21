// 配兵审计导出（2026-11-21 平衡会话）：纯 node，不开浏览器。按运行时逻辑重放主线 36 关的刷兵，逐段统计兵种占比、刷兵密度、同屏人数。
// 用法：node tools/export-wave-mix.mjs [runs=150] > out.json
// 重放规则与假设写在 tools/wave-mix/wavemix.ts 文件头；报表 / 问题扫描见共享笔记 wave-mix-audit.md。
import { build } from 'esbuild';
const banner = 'const __mem={};globalThis.window=globalThis;globalThis.localStorage={getItem:k=>__mem[k]??null,setItem:(k,v)=>{__mem[k]=String(v)},removeItem:k=>{delete __mem[k]}};globalThis.sessionStorage=globalThis.localStorage;globalThis.document={createElement:()=>({getContext:()=>null,style:{}}),addEventListener(){},body:{}};globalThis.location={search:"?dev=1",href:""};globalThis.navigator=globalThis.navigator??{userAgent:"node"};';
const res = await build({ entryPoints: ['tools/wave-mix/wavemix.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'error', alias: { phaser: './tools/wave-mix/phaser-stub.cjs' }, banner: { js: banner } });
process.env.RUNS = process.argv[2] ?? process.env.RUNS ?? '150';
const code = res.outputFiles[0].text, mod = { exports: {} };
new Function('module', 'exports', 'require', code)(mod, mod.exports, (await import('node:module')).createRequire(import.meta.url));
