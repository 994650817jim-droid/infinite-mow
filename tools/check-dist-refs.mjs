// 发布包引用检查：扫 src/ 里所有写死的 assets/… 路径（字符串 / 模板字符串），确认在 dist 里都存在（没被瘦身误剔）。
// 模板路径（含 ${…}）取 ${ 之前的目录前缀，检查该目录存在且不是空的。用法：node tools/check-dist-refs.mjs [dist 目录]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const dist = process.argv[2] ?? 'dist';
const files = []; const walk = d => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|tsx|js|mjs|html|css)$/.test(e.name)) files.push(p); } };
walk('src'); files.push('index.html');
const lit = new Map(), tpl = new Map();
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/['"`](assets\/[^'"`\s\\]+?)['"`]/g)) { const v = m[1]; if (v.includes('${')) { const pre = v.slice(0, v.indexOf('${')), dir = pre.includes('/') ? pre.slice(0, pre.lastIndexOf('/')) : pre; if (!tpl.has(dir)) tpl.set(dir, f); } else if (/\.[a-z0-9]{2,5}$/i.test(v)) { if (!lit.has(v)) lit.set(v, f); } }
}
const absent = [...lit].filter(([v]) => !existsSync(join(dist, v))), missing = absent.filter(([v]) => existsSync(join('public', v))), neverExisted = absent.filter(([v]) => !existsSync(join('public', v))), emptyDirs = [...tpl].filter(([d]) => { const p = join(dist, d); return !existsSync(p) || (statSync(p).isDirectory() && readdirSync(p).length === 0); });
console.log(`写死路径 ${lit.size} 个，被瘦身误剔 ${missing.length} 个（public 里有、dist 里没有）；public 里本来就没有 ${neverExisted.length} 个（待出图 / 有存在性判断）；模板路径目录 ${tpl.size} 个，缺失 / 空目录 ${emptyDirs.length} 个`);
for (const [v, f] of neverExisted.slice(0, 20)) console.log('  本来就没有', v, ' ←', f.split('\\').join('/'));
for (const [v, f] of missing.slice(0, 60)) console.log('  被误剔', v, ' ←', f.split('\\').join('/'));
for (const [d, f] of emptyDirs.slice(0, 30)) console.log('  模板目录缺失', d, ' ←', f.split('\\').join('/'));
process.exitCode = missing.length ? 1 : 0;
