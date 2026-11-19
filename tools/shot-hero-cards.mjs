// 构筑总览左栏武将卡头像（水墨立绘头肩裁切）逐将截图：战斗内「战法构筑」面板（与将帅帐同一组件），换 12 位武将各截一张卡片。
// BEFORE=1：拦掉 assets/ink-scroll/ 请求，组件退回旧的立绘贴图（改前的样子），只截 HEROES 里前 4 位。
// 用法：BASE=http://127.0.0.1:5173/ [BEFORE=1] node tools/shot-hero-cards.mjs   → assets/review/build-overview/cards-{after,before}.png（拼图）
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', before = !!process.env.BEFORE, out = 'assets/review/build-overview';
mkdirSync(out, { recursive: true });
const ALL = ['zhaoyun', 'guanyu', 'zhangfei', 'machao', 'huangzhong', 'zhuge', 'liubei', 'weiyan', 'pangtong', 'huangyueying', 'sunshangxiang', 'diaochan'];
const HEROES = before ? ['zhaoyun', 'guanyu', 'zhuge', 'diaochan'] : ALL;
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errors = [];
p.on('pageerror', e => errors.push(e.message));
if (before) await p.route('**/assets/ink-scroll/**', r => r.abort());
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop', { timeout: 180000 });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const G = "window.__game.scene.getScene('GameScene')", shots = [], info = [];
for (const id of HEROES) {
  await p.evaluate(([G0, id]) => { const s = eval(G0); s.__DEV_ACTIONS.closePopup?.(); s.children.getByName('build-panel')?.destroy(); s.player.growth.character = id; if (s.mode !== 'pause') s.setMode('pause'); s.openBuildPanel(); }, [G, id]);
  await p.waitForTimeout(900);
  const r = await p.evaluate(G0 => { const s = eval(G0), all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(s.children.list); const im = all.find(o => o.name === 'build-panel-hero-portrait'); return { src: im?.getData('src') ?? null, key: im?.texture.key ?? null }; }, G);
  info.push({ id, ...r });
  const f = `${out}/card-${before ? 'before' : 'after'}-${id}.png`; await p.screenshot({ path: f, clip: { x: 60, y: 90, width: 330, height: 190 } }); shots.push(f);
}
// 拼图（每行 4 张）
const url = await p.evaluate(async srcs => { const cols = 4, w = 330, h = 190, c = document.createElement('canvas'); c.width = cols * w; c.height = Math.ceil(srcs.length / cols) * h; const g = c.getContext('2d');
  for (let i = 0; i < srcs.length; i++) { const im = new Image(); im.src = srcs[i]; await im.decode(); g.drawImage(im, (i % cols) * w, Math.floor(i / cols) * h); } return c.toDataURL('image/png'); }, shots.map(f => 'data:image/png;base64,' + readFileSync(f).toString('base64')));
writeFileSync(`${out}/cards-${before ? 'before' : 'after'}.png`, Buffer.from(url.split(',')[1], 'base64'));
console.log(JSON.stringify(info)); console.log('errors', JSON.stringify(errors.slice(0, 3)));
await b.close();
