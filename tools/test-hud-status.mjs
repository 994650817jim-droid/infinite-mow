// 战斗左上主将状态框（2026-11-19 用户「这里ui做一下」）：电脑版漆底金边框 + 圆形头像 + 名字 / 等级印 / 主属性印，
// 朱红血条（铜框、残血拖尾、低血脉动、数字在条中央），细金经验条（升级闪一下）。
// 用法：BASE=http://127.0.0.1:5180/ TAG=before|after node tools/test-hud-status.mjs   截图 assets/review/hud-status/<TAG>-*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'after', out = 'assets/review/hud-status';
mkdirSync(out, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&story=off', { timeout: 180000 });
await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && s.elapsed > 2; }, null, { timeout: 180000 });
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); s.player.hp = Math.round(s.player.maxHp * .72); s.player.xp = Math.round(s.player.xpNext * .55); });
await p.waitForTimeout(1500);
const crop = name => p.screenshot({ path: `${out}/${tag}-${name}.png`, clip: { x: 0, y: 0, width: 420, height: 140 } });
await crop('normal');
const f = () => p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), fr = s.statusFrame; return fr ? { ...fr.stats, hpText: s.hudTexts.hp.text, hpPos: [Math.round(s.hudTexts.hp.x), Math.round(s.hudTexts.hp.y)], name: s.children.getByName('hud-status-name')?.text, level: s.children.getByName('hud-status-level')?.text, legacy: s.hudTexts.level.text } : null; });
const a = await f();
// 掉血：拖尾在实际血量之后
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.hp = Math.round(s.player.maxHp * .45); });
await p.waitForTimeout(120); const hit = await f(); await crop('hit-trail');
await p.waitForTimeout(1200); const settled = await f();
// 低血
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.hp = Math.round(s.player.maxHp * .2); }); await p.waitForTimeout(400); const low = await f(); await crop('low-hp');
// 升级闪
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.level += 1; }); await p.waitForTimeout(120); const lv = await f(); await crop('level-flash');
if (tag === 'after') {
  ck('状态框建好：头像、名字「赵云」、等级印「N级」，旧的「赵云 Lv.N」文字仍可读（测试兼容）', !!a && a.portrait && a.name === '赵云' && /^\d+级$/.test(a.level ?? '') && /^赵云 Lv\.\d+$/.test(a.legacy ?? ''), a);
  ck('血条数字压在条中央（框内）', !!a && /^\d+\/\d+$/.test(a.hpText) && a.hpPos[0] > 100 && a.hpPos[0] < 240 && a.hpPos[1] > 40 && a.hpPos[1] < 62, a?.hpPos);
  ck('掉血后残血拖尾停在旧血量，之后追上', !!hit && hit.trail > hit.ratio + .2 && !!settled && Math.abs(settled.trail - settled.ratio) < .02, { hit: [hit?.trail, hit?.ratio], settled: [settled?.trail, settled?.ratio] });
  ck('低于 30% 血：低血脉动', !!low && low.low, low);
  ck('升级：经验条闪一下（计数 +1）', !!lv && lv.flashes >= 1, lv);
}
ck('无页面报错', errors.length === 0, errors.slice(0, 4));
await b.close();
process.exit(fail ? 1 : 0);
