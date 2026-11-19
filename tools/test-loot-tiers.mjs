// 掉落品质随章节（2026-11-19 用户：「前期不应该掉落这么好的装备，随着章节推动才会增加掉落品级」；data/items.ts lootBand / LOOT_CAP / WEIGHTS / MERCHANT_WEIGHTS）。
// 在页面里直接调掉落函数抽样：第 1 / 5 / 11 章各来源各抽 20000 次（带保底），看品质分布与封顶；乱世 +1 段；商人货架不出白 / 橙；词条随章节放大。
// 用法：BASE=http://127.0.0.1:5195/ node tools/test-loot-tiers.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '?layout=desktop');
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 });
  const r = await p.evaluate(async () => {
    const I = await import('/src/data/items.ts'), P = await import('/src/data/propLoot.ts');
    let seed = 12345; const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const N = 20000, Q = I.QUALITY_ORDER, out = {};
    const dist = (fn) => { const c = Object.fromEntries(Q.map(q => [q, 0])); for (let i = 0; i < N; i++) c[fn()]++; return Object.fromEntries(Q.map(q => [q, +(c[q] / N * 100).toFixed(2)])); };
    for (const ch of [1, 5, 11]) {
      const band = I.lootBand(ch), row = { band, cap: I.LOOT_CAP[band] };
      for (const src of ['normal', 'elite', 'chest', 'boss', 'finalBoss']) { const pity = { sincePurple: 0, sinceOrange: 0 }; row[src] = dist(() => I.rollDropQuality(src, band, pity, rng)); }
      row.merchant = dist(() => I.rollQuality('merchant', band, rng));
      row.prop = dist(() => P.rollPropQuality(rng, band));
      row.hardBand = I.lootBand(ch, true);
      out['ch' + ch] = row;
    }
    // 词条随章节：同一品质同一随机序列，第十一章 / 第一章 = affixChapterMul(11)
    seed = 7; const a1 = I.rollItem('blue', rng, 'armor', 1); seed = 7; const a11 = I.rollItem('blue', rng, 'armor', 11);
    out.affix = { ch1: a1.affixes[0].value, ch11: a11.affixes[0].value, mul: I.affixChapterMul(11) };
    out.bands = Array.from({ length: 12 }, (_, i) => I.lootBand(i + 1));
    return out;
  });
  const at = q => ['white', 'green', 'blue', 'purple', 'orange'].indexOf(q), over = (d, cap) => Object.entries(d).filter(([q, v]) => at(q) > at(cap) && v > 0);
  for (const ch of ['ch1', 'ch5', 'ch11']) {
    const R = r[ch]; console.log(ch, JSON.stringify(R));
    ck(`${ch}：所有来源都不超过封顶（${R.cap}，含保底）`, ['normal', 'elite', 'chest', 'boss', 'finalBoss', 'merchant', 'prop'].every(s => over(R[s], R.cap).length === 0), ['normal', 'elite', 'chest', 'boss', 'finalBoss', 'merchant'].map(s => [s, over(R[s], R.cap)]));
    ck(`${ch}：商人货架不出白、不出橙`, R.merchant.white === 0 && R.merchant.orange === 0, R.merchant);
  }
  const c1 = r.ch1, c5 = r.ch5, c11 = r.ch11;
  ck('第一章：小兵 / 宝箱以白绿为主（白+绿 ≥ 85%），蓝很少（小兵 ≤ 5%），没有紫橙', c1.normal.white + c1.normal.green >= 85 && c1.chest.white + c1.chest.green >= 85 && c1.normal.blue <= 5 && c1.normal.purple === 0 && c1.boss.purple === 0 && c1.finalBoss.orange === 0, { normal: c1.normal, chest: c1.chest });
  ck('第一章：首领最多蓝（绿 / 蓝各约一半）', c1.boss.blue >= 35 && c1.boss.blue <= 55 && c1.boss.purple === 0, c1.boss);
  ck('第五章：蓝紫为主、橙少（宝箱橙 1～8%、首领橙 2～12%）', c5.chest.blue + c5.chest.purple >= 55 && c5.chest.orange >= 1 && c5.chest.orange <= 8 && c5.boss.orange >= 2 && c5.boss.orange <= 12, { chest: c5.chest, boss: c5.boss });
  ck('第十一章：紫橙为主（首领紫+橙 ≥ 85%、章末首领橙 ≥ 25%）', c11.boss.purple + c11.boss.orange >= 85 && c11.finalBoss.orange >= 25, { boss: c11.boss, finalBoss: c11.finalBoss });
  ck('品质随章节单调上升：宝箱紫+橙 第一章 < 第五章 < 第十一章', (c1.chest.purple + c1.chest.orange) < (c5.chest.purple + c5.chest.orange) && (c5.chest.purple + c5.chest.orange) < (c11.chest.purple + c11.chest.orange), [c1.chest, c5.chest, c11.chest]);
  ck('分段：一二章 0、三四章 1、五～七章 2、八～十章 3、十一十二章 4', JSON.stringify(r.bands) === '[0,0,1,1,2,2,2,3,3,3,4,4]', r.bands);
  ck('乱世：段 +1（第一章 → 1，第十一章封到 4）', c1.hardBand === 1 && c11.hardBand === 4, [c1.hardBand, c11.hardBand]);
  ck('词条随章节：第十一章同品质词条 = 第一章 × affixChapterMul(11)（1.25）', Math.abs(r.affix.ch11 - r.affix.ch1 * r.affix.mul) <= .0015 && r.affix.ch11 > r.affix.ch1, r.affix); /* 词条四舍五入到 0.001 */
} catch (e) { console.log('ERROR', String(e)); fail++; }
finally { await b.close(); }
ck('没有页面报错', errors.length === 0, errors.slice(0, 3));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
