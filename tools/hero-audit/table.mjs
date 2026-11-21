// 体检总表（markdown）：node tools/hero-audit/table.mjs [audit.json]
import { readFileSync } from 'node:fs';
const { rows } = JSON.parse(readFileSync(process.argv[2] ?? 'tools/hero-audit/audit.json', 'utf8'));
const med = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const gm = (a, b) => Math.sqrt(a * b);
// 常驻减伤估计（有效生命 = 生命 ÷ 平均承伤）：敏捷主属性 7 点「游刃」闪避 10%；刘备统御每点 −1%（最多 10）；典韦恶来 −40% 约 4 成时间；魏延谁敢杀我 −30% 约 4 成；马超铁骑余威 −30% 约 3 成；孙权守势 −15% 三分之一
const MIT = { liubei: 1 / .9, dianwei: 1 / (1 - .4 * .4), weiyan: 1 / (1 - .3 * .4), machao: 1 / (1 - .3 * .3), sunquan: 1 / (1 - .15 / 3) };
const SIM = { zhouyu: .76, lvbu: .96, zhangliao: 1.27, huangzhong: .65, zhuge: .51, guanyu: .69, huangyueying: .71, pangtong: .81, diaochan: .88, machao: 1.00, zhaoyun: 1.10, weiyan: 1.16, taishici: 1.26, zhangfei: 1.30, mengde: 1.29, sunshangxiang: 1.08, liubei: 1.42, dianwei: .90, sunquan: 1.26, menghuo: .71, ganning: .58, zhurong: .95 };
const GN = { melee: '近战', ranged: '远程', strat: '谋士' };
const mk = x => x >= 1.4 || x <= 1 / 1.4 ? '🔴' : x >= 1.25 || x <= .8 ? '🟡' : '';
const f = (v, m) => `${Math.round(v)} ×${(v / m).toFixed(2)}${mk(v / m)}`;
for (const r of rows) { const a = r.at['第8章']; r.clear = gm(a.c30, a.c80); r.ehp = a.hp * (MIT[r.id] ?? 1) * (['agility'].includes(r.prim) ? 1 / .9 : 1); }
const M = {}; for (const g of Object.keys(GN)) { const rs = rows.filter(r => r.grp === g); M[g] = { b1: med(rs.map(r => r.at.Lv1.boss)), b4: med(rs.map(r => r.at['第4章'].boss)), b8: med(rs.map(r => r.at['第8章'].boss)), b12: med(rs.map(r => r.at['第12章'].boss)), c30: med(rs.map(r => r.at['第8章'].c30)), c80: med(rs.map(r => r.at['第8章'].c80)), ehp: med(rs.map(r => r.ehp)) }; }
console.log('| 武将 | 组 | 主属性 | 打首领 Lv1 | 第 4 章 | 第 8 章 | 第 12 章 | 清杂 30 敌（第 8 章） | 80 敌 | 有效生命（第 8 章） | 四维全加主属性（第 8 章） | 模拟首领用时 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const g of Object.keys(GN)) for (const r of rows.filter(r => r.grp === g)) {
  const A = r.at, m = M[g];
  console.log(`| ${r.name} | ${GN[g]} | ${{ strength: '力', agility: '敏', intellect: '智', command: '统' }[r.prim]} | ${f(A.Lv1.boss, m.b1)} | ${f(A['第4章'].boss, m.b4)} | ${f(A['第8章'].boss, m.b8)} | ${f(A['第12章'].boss, m.b12)} | ${f(A['第8章'].c30, m.c30)} | ${f(A['第8章'].c80, m.c80)} | ${f(r.ehp, m.ehp)} | ×${(r.alt8[r.prim] / r.zero8).toFixed(2)} | ${SIM[r.id].toFixed(2)} |`);
}
