// 用 esbuild 把读数据的入口打成一个 node 能直接跑的 ESM（Phaser 换空壳）；输出由 node 写，不让 esbuild 自己写盘（本机 esbuild 写 Temp 会 Access is denied）
import { build } from 'esbuild'; import { writeFileSync } from 'node:fs';
const [entry, out] = process.argv.slice(2);
const r = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', write: false, outfile: out, alias: { phaser: './tools/hero-audit/phaser-stub.js' }, define: { 'import.meta.env.DEV': 'false', 'import.meta.env': '{}' }, logLevel: 'error', loader: { '.png': 'empty', '.webp': 'empty' } });
writeFileSync(out, r.outputFiles[0].text);
