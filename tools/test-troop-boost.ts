// 张飞「燕人怒吼」部曲加伤刷新不叠加（systems/TroopBoost.ts，2026-11-21 武将数值体检）。
// 用法：node tools/hero-audit/build.mjs tools/test-troop-boost.ts tools/hero-audit/troop.out.mjs && node tools/hero-audit/troop.out.mjs
import { makeTroopBoost } from '../src/systems/TroopBoost';
let now = 0; const timers: { at: number; fn: () => void; dead: boolean }[] = [];
const delay = (ms: number, fn: () => void) => { const t = { at: now + ms, fn, dead: false }; timers.push(t); return { remove: () => { t.dead = true; } }; };
const run = (to: number) => { while (true) { const t = timers.filter(x => !x.dead && x.at <= to).sort((a, b) => a.at - b.at)[0]; if (!t) break; t.dead = true; now = t.at; t.fn(); } now = to; };
let pass = 0, fail = 0; const ck = (n: string, ok: boolean, d?: unknown) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const L = { drillMultiplier: 1.3 }; /* 营寨练兵倍率 1.3 */ const boost = makeTroopBoost(() => L, delay);
for (let k = 0; k < 5; k++) { boost(1.2, 5000); run(now + 1300); }
ck('每 1.3 秒喝断一次连喝 5 次：部曲倍率只 ×1.2 一层（原来叠到 ×1.2^4）', Math.abs(L.drillMultiplier - 1.3 * 1.2) < 1e-9, L.drillMultiplier);
run(now + 3800); ck('最后一喝 5 秒后恢复练兵倍率', Math.abs(L.drillMultiplier - 1.3) < 1e-9, L.drillMultiplier);
boost(1.2, 5000); run(now + 1000); boost(1.4, 6000); ck('进阶后倍率取大（1.4），不相乘', Math.abs(L.drillMultiplier - 1.3 * 1.4) < 1e-9, L.drillMultiplier);
run(now + 5500); ck('计时按最后一次刷新（6 秒）：5.5 秒时仍在', Math.abs(L.drillMultiplier - 1.3 * 1.4) < 1e-9, L.drillMultiplier);
run(now + 600); ck('6 秒后恢复', Math.abs(L.drillMultiplier - 1.3) < 1e-9, L.drillMultiplier);
console.log(`\n${pass} pass / ${fail} fail`); process.exit(fail ? 1 : 0);
