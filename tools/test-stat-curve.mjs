// 武将四维本色 / 等效点 / 分段折扣 / 擅长倍率（data/heroStats.ts）+ 局内 RunGrowth.pts 生效 + 去上限。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5260/ node tools/test-stat-curve.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5260/';
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const near = (a, b, eps = .01) => Math.abs(a - b) <= eps;
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'guanyu'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop&story=off`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS; }, null, { timeout: 180000, polling: 500 }); await p.waitForTimeout(1200);
  const r = await p.evaluate(async () => {
    const H = await import('/src/data/heroStats.ts'), A = await import('/src/data/attributes.ts'), o = {};
    const gy = H.statSource('guanyu'), zg = H.statSource('zhuge');
    o.base = { gyE: H.baseEquiv(gy, 'strength', 1), zgInt: H.baseEquiv(zg, 'intellect', 1), zgStr: H.baseEquiv(zg, 'strength', 1) };
    o.disc = [H.discount(5), H.discount(10), H.discount(20), H.discount(30)];
    o.mult = { gy: H.statMultiplier(gy, 'strength'), gyInt: H.statMultiplier(gy, 'intellect'), gyAgi: H.statMultiplier(gy, 'agility'), zgStr: H.statMultiplier(zg, 'strength'), tag: [H.statTag(gy, 'strength'), H.statTag(gy, 'intellect'), H.statTag(gy, 'agility')] };
    o.lv54 = { gy: H.statEffective(gy, 'strength', 25, 54), eq: H.statEquiv(gy, 'strength', 25, 54) };
    o.all17 = Object.keys(H.HERO_STATS).length; o.generals = Object.keys(H.GENERAL_STATS).length; o.cap = A.attributeCap(54);
    o.gen = H.statSource('许褚').base.join('/'); o.tmpl = H.statSource('blade', { quality: 'purple' }).base.join('/');
    // 局内：关羽 Lv1 力量 0 点 → pts = 1.25 × 4.333
    const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); const g = s.player.growth;
    g.heroLevel = 1; g.attributes.strength = 0; o.ptsLv1 = g.pts('strength'); o.want = H.statEffective(H.statSource(g.character), 'strength', 0, 1); g.attributes.strength = 25; g.heroLevel = 54; o.ptsLv54 = g.pts('strength');
    g.unallocated = 3; g.attributes.strength = 40; o.noCap = g.allocate(s.player, 'strength') ? g.attributes.strength : -1;
    return o; });
  ck('关羽力量本色折算 (97−45)/12=4.33；诸葛亮智力 (100−45)/12=4.58、力量 0', near(r.base.gyE, 4.3333) && near(r.base.zgInt, 4.5833) && r.base.zgStr === 0, r.base);
  ck('分段折扣：5→5、10→10、20→15、30→17.5', near(r.disc[0], 5) && near(r.disc[1], 10) && near(r.disc[2], 15) && near(r.disc[3], 17.5), r.disc);
  ck('擅长 ×1.25（关羽力）/ 熟练 ×1.1（关羽智 75）/ 其余 ×1；诸葛亮力量 ×1；称号 擅 熟 空', r.mult.gy === 1.25 && r.mult.gyInt === 1.1 && r.mult.gyAgi === 1 && r.mult.zgStr === 1 && r.mult.tag.join() === '擅,熟,', r.mult);
  ck('Lv54 关羽加 25 点力量：等效点含成长，折扣后×1.25', r.lv54.eq > 25 + 4.33 && near(r.lv54.gy, 1.25 * (10 + .5 * 10 + .25 * (r.lv54.eq - 20)), .05), r.lv54);
  ck('17 位可玩武将、38 位 + 孟获 / 祝融史事名将、模板 / 品质、取消上限', r.all17 === 17 && r.generals >= 38 && r.gen === '98/70/32/72' && r.tmpl === '68/58/46/56' && r.cap >= 99, r);
  ck('局内 pts()：Lv1 力量 0 点 = 该武将本色折算后；加到 40 点以上仍可再加（无上限）', near(r.ptsLv1, r.want, .001) && r.ptsLv1 > 4 && r.ptsLv54 > 1 && r.noCap === 41, { a: r.ptsLv1, b: r.ptsLv54, c: r.noCap });
  ck('无页面报错', errs.length === 0, errs.slice(0, 3));
  console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); process.exitCode = rows.every(Boolean) ? 0 : 1;
} finally { await b.close(); }
