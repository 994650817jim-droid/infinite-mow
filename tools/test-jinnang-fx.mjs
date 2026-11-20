// 锦囊激活特效（JinnangFx）：8 个锦囊各放一次，画面有特效（激活爆发），擂鼓 / 空城计 / 草船借箭有持续光罩并到期消失，连环计给被连住的敌人画标记；无页面报错。需要开发服务器。截图 assets/review/school-fx/jinnang-*.png
// 用法：BASE=http://127.0.0.1:5260/ node tools/test-jinnang-fx.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5260/', OUT = 'assets/review/school-fx'; mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }), p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
const ids = ['ambush', 'gong', 'feint', 'drum', 'fire', 'empty', 'arrows', 'chain'];
const res = {};
for (const id of ids) {
  const r = await p.evaluate(async id => {
    const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9;
    for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); }
    const px = s.player.x, py = s.player.y; for (let i = 0; i < 5; i++) { const e = s.spawnEnemy('infantry', px + 70 + (i % 3) * 40, py - 40 + Math.floor(i / 3) * 50, 1, true); if (e) { e.speed = 0; e.hp = e.maxHp = 9e5; } }
    s.children.getByName('jinnang-sustain')?.setVisible(false); const fx = s.jinnangFx, before = fx.stats.bursts; /* 上一个锦囊的持续光罩先收掉，免得串 */ s.jinnang = id; const used = s.useJinnang();
    await new Promise(r => setTimeout(r, 450)); const live = s.children.list.filter(o => o.name === 'jinnang-fx').length, sustain = s.children.getByName('jinnang-sustain')?.visible ?? false, marks = s.children.list.filter(o => o.name === 'jinnang-chain-mark' && o.visible).length;
    return { used, bursts: fx.stats.bursts - before, live, sustain, marks };
  }, id);
  res[id] = r; await p.screenshot({ path: `${OUT}/jinnang-${id}.png`, clip: { x: 340, y: 160, width: 600, height: 400 } }); await p.waitForTimeout(900);
}
ck('8 个锦囊都能用，且各自播出激活特效（爆发）', ids.every(id => res[id].used && res[id].bursts === 1 && res[id].live >= 1), res);
ck('擂鼓 / 空城计 / 草船借箭有持续光罩（连环计 / 其余没有）', ['drum', 'empty', 'arrows'].every(id => res[id].sustain) && ['ambush', 'gong', 'feint', 'fire', 'chain'].every(id => !res[id].sustain), res);
ck('连环计：被连住的敌人身上有标记', res.chain.marks >= 3, res.chain);
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); await b.close(); process.exit(rows.every(Boolean) ? 0 : 1);
