// 战斗支援（战地招募）弹窗：字体统一、少字、水墨按钮（电脑 1280×720 / 1920×1080）。
// 用法：BASE=http://127.0.0.1:5180/ node tools/ui-round13-recruit.mjs <tag>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const tag = process.argv[2] ?? 'after', base = process.env.BASE ?? 'http://127.0.0.1:5180/', out = 'assets/review/ui-round13';
mkdirSync(out, { recursive: true });
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true }); const errors = []; let fail = 0;
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
for (const vp of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  const p = await b.newPage({ viewport: vp });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load|Texture key already in use/.test(m.text())) errors.push(m.text()); });
  await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=desktop`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 90000 }); await p.waitForTimeout(1000);
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; s.waveIndex = 1; s.scheduleRecruit?.(); s.openRecruit(); }, G);
  await p.waitForTimeout(800);
  const info = await p.evaluate(G0 => { const s = eval(G0), ui = s.legionUI, texts = []; const walk = l => { for (const o of l) { if (o.visible === false) continue; if (o.type === 'Text' && o.text && o.alpha > 0) { const g = o.getBounds(); texts.push({ t: o.text, f: o.style.fontFamily.split(',')[0].replace(/"/g, ''), bg: o.style.backgroundColor, x: g.x, y: g.y, w: g.width, h: g.height }); } if (o.list) walk(o.list); } }; walk(ui.panel.list);
    const ink = ui.rows.filter(r => r.root.visible && r.ink?.visible).length; return { mode: s.mode, texts, ink, closeInk: !!ui.closeInk?.visible, potionInk: !!ui.potionInk }; }, G);
  console.log(vp.width, JSON.stringify(info.texts.map(t => `${t.t.replace(/\n/g, '/')}|${t.f}${t.bg && t.bg !== 'rgba(0,0,0,0)' ? '|bg' : ''}`)));
  if (tag !== 'before') {
    // 标题、标签、按钮用标题字；正文（顶部「免费 ×N · 兵力 N」、血药「回复 30% 生命」）另用正文字
    const sans = info.texts.filter(t => /Lv\d|招募入队|领取血药|主将满血|跳过|血药 · 回春|战斗支援|^补给$|^近战|^长枪|^远程/.test(t.t) && t.f !== 'IMWarHeading' && t.f !== 'IMWarTitle');
    ck(`${vp.width}×${vp.height} 标题 / 标签 / 按钮都是标题字（正文另用一种）`, sans.length === 0, sans.map(t => t.t + '|' + t.f));
    // 2026-11-18 用户「这里水墨特效太多了」：战斗支援面板的招募 / 血药 / 跳过不再用泼墨按钮，改成漆底细描金小牌 / 灰色小字 / 细线框
    ck(`${vp.width}×${vp.height} 招募 / 血药 / 跳过按钮不用泼墨（无水墨底板），文字也没有色块底`, info.ink === 0 && !info.closeInk && !info.potionInk && !info.texts.some(t => t.bg && t.bg !== 'rgba(0,0,0,0)' && t.t.length > 1) /* 单字兵种印（刀 / 枪 / 弓）本来就是朱底印 */, info);
    ck(`${vp.width}×${vp.height} 顶部只剩「免费 ×N · 兵力 N」`, info.texts.some(t => /^免费 ×\d+ · 兵力 \d+$/.test(t.t)), info.texts.map(t => t.t).slice(0, 3));
  }
  await p.screenshot({ path: `${out}/${tag}-recruit-${vp.width}x${vp.height}.png` });
  await p.close();
}
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 3));
process.exit(fail ? 1 : 0);
