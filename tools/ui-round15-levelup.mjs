// 升级三选一：字体统一（默认）与水墨预览（?levelup=ink）并排对比（电脑 1280×720）。
// 用法：BASE=http://127.0.0.1:5180/ node tools/ui-round15-levelup.mjs <tag>
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url'; import { resolve } from 'node:path';
const tag = process.argv[2] ?? 'after', base = process.env.BASE ?? 'http://127.0.0.1:5180/', out = 'assets/review/ui-round15';
mkdirSync(out, { recursive: true });
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true }); const errors = []; let fail = 0;
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const shots = [];
for (const [label, q] of [['default', ''], ['ink', '&levelup=ink']]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load|Texture key already in use/.test(m.text())) errors.push(m.text()); });
  await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=desktop${q}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 90000 }); await p.waitForTimeout(800);
  const info = await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; s.player.growth.build.learn('pursuit'); s.pendingLevels = 1; s.openUpgrade();
    const t = s.levelPanel.getByName('upgrade-title'), sub = s.levelPanel.getByName('upgrade-subtitle'), v = s.cardViews[0];
    return { title: t.style.fontFamily.split(',')[0], sub: sub.visible, name: v.name.style.fontFamily.split(',')[0], desc: v.desc.style.fontFamily.split(',')[0], tag: v.tag.style.fontFamily.split(',')[0], hint: v.hint.style.fontFamily.split(',')[0], reroll: s.rerollButton.style.fontFamily.split(',')[0] }; }, G);
  await p.waitForTimeout(700);
  await p.evaluate(G0 => { const s = eval(G0); s.cardViews[1].bg.emit('pointerover'); }, G); await p.waitForTimeout(250);
  const path = `${out}/${tag}-levelup-${label}-1280x720.png`; await p.screenshot({ path }); shots.push([label, path]);
  if (tag !== 'before') {
    ck(`${label}：标题书法字、卡名 / 标签 / 提示 / 换一批标题字、正文正文字`, /IMWarTitle/.test(info.title) && [info.name, info.tag, info.hint, info.reroll].every(f => /IMWarHeading/.test(f)) && !/IMWar/.test(info.desc), info);
    ck(`${label}：去掉副标题`, !info.sub, info.sub);
  }
  // 能正常选卡
  const ok = await p.evaluate(G0 => { const s = eval(G0); s.chooseUpgrade(0); return s.mode; }, G);
  if (tag !== 'before') ck(`${label}：点选后回到战斗`, ok === 'none', ok);
  await p.close();
}
await b.close();
// 并排对比图
if (shots.length === 2) {
  const html = `<body style="margin:0;background:#111;display:flex;gap:12px;padding:12px;font:20px 'Microsoft YaHei';color:#e8d8b2">${shots.map(([l, p]) => `<div><div style="padding:0 0 8px">${l === 'default' ? '现版（字体统一）' : '水墨预览（?levelup=ink）'}</div><img src="${pathToFileURL(resolve(p)).href}" width="1280" height="720"></div>`).join('')}</body>`;
  writeFileSync(`${out}/compare.html`, html);
  const c = await chromium.launch({ channel: 'chrome', headless: true }); const p = await c.newPage({ viewport: { width: 2596, height: 780 } });
  await p.goto(pathToFileURL(resolve(`${out}/compare.html`)).href); await p.waitForTimeout(600); await p.screenshot({ path: `${out}/${tag}-compare-default-vs-ink.png` }); await c.close();
}
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 3));
process.exit(fail ? 1 : 0);
