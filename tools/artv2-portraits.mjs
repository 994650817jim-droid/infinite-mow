// 人物画风 v2：兵种胸像（战地招募卡）与营地「招兵营」页的 v1 / v2 对比截图（电脑布局 1920×1080）。
// 检查 v2 加载 troop-portraits-v2 的 8 张胸像、招募卡用上胸像、页签图标换成 v2。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5201/ OUTDIR=assets/review/artv2 node tools/artv2-portraits.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', outDir = process.env.OUTDIR ?? 'assets/review/artv2';
mkdirSync(outDir, { recursive: true });
const KINDS = ['swordsman', 'spearman', 'archer', 'crossbowman', 'guardian', 'rider', 'halberdier', 'medic'];
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true });
const res = {};
for (const art of ['v1', 'v2']) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const reqs = []; p.on('request', r => reqs.push(r.url()));
  p.on('pageerror', e => errors.push(art + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(art + ' ' + m.text()); });
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=desktop&hd=2&art=${art}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  // 战地招募卡：两组各 3 种（卡片一次 3 张）
  const shots = [['swordsman', 'spearman', 'archer'], ['rider', 'halberdier', 'medic']];
  for (const [i, kinds] of shots.entries()) {
    await p.evaluate(([G0, kinds]) => { const s = eval(G0); s.__DEV_ACTIONS.closePopup?.(); s.recruitOptions = kinds.map(k => ({ kind: k, upgrade: false })); s.setMode('recruit'); s.renderRecruit(); }, [G, kinds]);
    await p.waitForTimeout(2500);
    await p.evaluate(G0 => { const s = eval(G0); s.renderRecruit(); }, G);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${outDir}/portraits-${art}-wave${i + 1}.png` });
  }
  const info = await p.evaluate(([G0, kinds]) => { const s = eval(G0), t = s.textures;
    return { have: kinds.filter(k => t.exists('troop_portrait_' + k)).length }; }, [G, KINDS]);
  // 营地「招兵营」页
  await p.evaluate(G0 => { const s = eval(G0); s.resting = true; s.setMode('rest'); s.renderRecruit(); }, G);
  await p.waitForTimeout(5000); // 等营地水墨转场播完
  await p.screenshot({ path: `${outDir}/portraits-${art}-camp.png` });
  res[art] = { ...info, src: reqs.filter(u => /troop-portraits/.test(u) && /swordsman_portrait/.test(u)).join(" "), icon: reqs.filter(u => /icon_(shu_)?swordsman/.test(u)).join(" ") };
  await p.close();
}
ck('v2 招募卡胸像来自 troop-portraits-v2', /troop-portraits-v2\//.test(res.v2.src), res.v2.src.slice(-50));
ck('v2 胸像 8 张都已加载（v1 只有 3 张）', res.v2.have === 8 && res.v1.have === 3, [res.v2.have, res.v1.have]);
ck('v2「招兵营」页签图标换成 v2 头像', /troop-portraits-v2\/icon_swordsman/.test(res.v2.icon), res.v2.icon.slice(-50));
ck('v1 仍用旧胸像与旧图标', /troop-portraits\//.test(res.v1.src) && !/v2/.test(res.v1.src) && /processed\/icon_shu_swordsman/.test(res.v1.icon), [res.v1.src.slice(-40), res.v1.icon.slice(-40)]);
ck('无页面报错', errors.length === 0, errors.slice(0, 5));
await b.close();
console.log(`\n${pass} passed, ${fail} failed · 截图 ${outDir}/portraits-{v1,v2}-{wave1,wave2,camp}.png`);
process.exit(fail ? 1 : 0);
