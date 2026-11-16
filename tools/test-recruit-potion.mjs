// 战地招募第 4 张血药卡：默认出现、点了回 25% 最大生命并结束本波招募；休整界面不出现；?recruit=v1 回到 3 张。
// 用法：BASE=http://127.0.0.1:5180/ node tools/test-recruit-potion.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const b = await chromium.launch({ channel: 'chrome', headless: true }); let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' · ' + JSON.stringify(d) : '')); };
const G = "window.__game.scene.getScene('GameScene')";
async function open(p, q) {
  await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=mobile${q}`);
  await p.waitForFunction(() => window.__game?.scene.isActive('GameScene'), null, { timeout: 90000 });
  await p.waitForTimeout(1000);
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.waveIndex = 1; s.scheduleRecruit?.(); s.openRecruit(); }, G);
  await p.waitForTimeout(300);
}
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load/.test(m.text())) errors.push(m.text()); });
await open(p, '');
const r = await p.evaluate(G0 => {
  const s = eval(G0), card = s.legionUI.panel.list.find(o => o.name === 'recruit-potion-card');
  const vis = !!card?.visible, mode0 = s.mode;
  s.player.hp = Math.round(s.player.maxHp * .4); const before = s.player.hp;
  card.list.find(o => o.name === 'recruit-potion').emit('pointerdown');
  return { vis, mode0, before, after: s.player.hp, max: s.player.maxHp, mode1: s.mode, recruited: s.recruitedWaves.has(s.waveIndex) };
}, G);
ck('默认显示第 4 张血药卡', r.vis && r.mode0 === 'recruit', r);
ck('点血药：回复 25% 最大生命', r.after - r.before === Math.round(r.max * .25), r);
ck('点血药后本波招募结束、回到战斗', r.mode1 !== 'recruit' && r.recruited, r);
// 休整界面不显示血药卡
const rest = await p.evaluate(G0 => { const s = eval(G0); s.legionUI.render(s.legion, 'rest'); return s.legionUI.panel.list.find(o => o.name === 'recruit-potion-card').visible; }, G);
ck('休整界面不显示血药卡', rest === false);
// ?recruit=v1 回到 3 张
await open(p, '&recruit=v1');
ck('?recruit=v1 不显示血药卡', await p.evaluate(G0 => !eval(G0).legionUI.panel.list.find(o => o.name === 'recruit-potion-card').visible, G));
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 3));
process.exit(fail ? 1 : 0);
