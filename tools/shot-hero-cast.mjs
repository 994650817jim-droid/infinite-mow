// 武将出招起手特效总览（2026-11-19）：12 名可玩武将各开一局，在主将身上放一次「被动触发」版起手特效（大一号 + 脚下法阵），
// 特效最亮时截主将周围一块，拼成 4×3 总览：assets/review/hero-cast/contact.png（单张在 tiles/）。
// 用法：BASE=http://127.0.0.1:5173/ node tools/shot-hero-cast.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/hero-cast', HEROES0 = ['guanyu', 'zhangfei', 'zhaoyun', 'huangzhong', 'machao', 'weiyan', 'liubei', 'zhuge', 'pangtong', 'huangyueying', 'sunshangxiang', 'diaochan'], HEROES = process.env.ONLY ? process.env.ONLY.split(',') : HEROES0;
mkdirSync(out + '/tiles', { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message));
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 60000 }); await p.waitForTimeout(1200);
const res = [];
for (const hero of HEROES) {
  await p.evaluate(([G0, id]) => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: undefined }); s.scene.restart(); }, [G, hero]);
  await p.waitForTimeout(400);
  await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === id && s.__DEV_ACTIONS && s.heroCastFx?.owner === s.player; }, hero, { timeout: 30000 });
  const r = await p.evaluate(async G0 => {
    const s = eval(G0), wait = ms => new Promise(r => setTimeout(r, ms)); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9;
    for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); for (const w of s.player.weapons) w.cooldownLeft = 1e9;
    await wait(300); s.heroCastFx.play('passive'); await wait(170);
    const cam = s.cameras.main, k = 1280 / cam.worldView.width; return { wv: [cam.worldView.x, cam.worldView.y, cam.width, cam.zoom], p: [s.player.x, s.player.y], x: Math.round((s.player.x - cam.worldView.x) * k), y: Math.round((s.player.y - cam.worldView.y) * k), has: s.textures.exists('fx_cast_' + s.runConfig.character) };
  }, G);
  await p.screenshot({ path: `${out}/tiles/${hero}.png`, clip: { x: Math.max(0, r.x - 170), y: Math.max(0, r.y - 200), width: 340, height: 300 } });
  res.push({ hero, ...r }); if (process.env.DBG) console.log(hero, JSON.stringify(r));
}
await b.close();
const tiles = HEROES.map(h => `${out}/tiles/${h}.png`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...tiles.flatMap(t => ['-i', t]), '-filter_complex', tiles.map((_, i) => `[${i}]`).join('') + 'xstack=inputs=12:layout=0_0|w0_0|w0+w1_0|w0+w1+w2_0|0_h0|w0_h0|w0+w1_h0|w0+w1+w2_h0|0_h0+h4|w0_h0+h4|w0+w1_h0+h4|w0+w1+w2_h0+h4', '-frames:v', '1', `${out}/contact.png`]);
console.log(JSON.stringify(res.map(r => r.hero + (r.has ? '' : '(缺图)'))), 'errors', JSON.stringify(errors.slice(0, 3)), '→', `${out}/contact.png`);
