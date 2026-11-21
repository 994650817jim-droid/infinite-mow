import { readFileSync } from 'node:fs';
const { rows, levels } = JSON.parse(readFileSync('tools/hero-audit/audit.json', 'utf8'));
const med = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const tag = process.argv[2] ?? '第8章';
const keys = ['st', 'boss', 'c30', 'c80', 'hp'];
const groups = ['melee', 'ranged', 'strat'];
const medians = {}; for (const g of groups) { medians[g] = {}; for (const k of keys) medians[g][k] = med(rows.filter(r => r.grp === g).map(r => r.at[tag][k])); }
const allMed = {}; for (const k of keys) allMed[k] = med(rows.map(r => r.at[tag][k]));
const mark = x => x >= 1.4 || x <= 1 / 1.4 ? '🔴' : x >= 1.25 || x <= .8 ? '🟡' : '';
console.log(`== ${tag} Lv${rows[0].at[tag].L} 点数 ${rows[0].at[tag].pts}；组中位数`, JSON.stringify(Object.fromEntries(groups.map(g => [g, Object.fromEntries(keys.map(k => [k, Math.round(medians[g][k])]))]))), '全体', JSON.stringify(Object.fromEntries(keys.map(k => [k, Math.round(allMed[k])]))));
for (const g of groups) for (const r of rows.filter(r => r.grp === g)) {
  const a = r.at[tag];
  console.log([r.grp.padEnd(6), r.id.padEnd(14), ...keys.map(k => { const x = a[k] / medians[g][k]; return `${k}=${Math.round(a[k])}(${x.toFixed(2)}${mark(x)})`; }), `attr×${a.attr.toFixed(2)}`, `全局st×${(a.st / allMed.st).toFixed(2)} c80×${(a.c80 / allMed.c80).toFixed(2)}`].join(' '));
}
