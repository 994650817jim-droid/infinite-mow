// 录马超冲锋方向 GIF（电脑布局，2026-11-17 方案 A）：
//  ① 往右走，右前方有敌 → 朝头前（右）冲；② 面朝右但敌人只在左边 → 转向目标（左）冲。
// 输出 assets/review/machao-charge/<NAME>.gif。用法：BASE=http://127.0.0.1:5173/ node tools/record-machao-charge-gif.mjs（需要 ffmpeg）
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/machao-charge', vid = out + '/video', NAME = process.env.NAME ?? 'charge-direction';
mkdirSync(vid, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 60000 });
await p.waitForTimeout(1200);
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'machao', weapon: undefined }); s.scene.restart(); }, G);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'machao' && s.__DEV_ACTIONS; }, null, { timeout: 30000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); s.player.weapons[0].cooldownLeft = 99; }, G);
await p.mouse.click(640, 40).catch(() => {});
const t0 = Date.now();
// ① 键盘往右走，右前方有敌（左边更近也有一名）
await p.evaluate(G0 => { const s = eval(G0), pl = s.player; const mk = (x, y) => { const e = s.spawnEnemy('infantry', x, y, 1); e.hp = e.maxHp = 99999; e.stunUntil = 1e12; }; mk(pl.x - 90, pl.y); mk(pl.x + 220, pl.y + 20); }, G);
await p.keyboard.down('KeyD'); await p.waitForTimeout(400); await p.keyboard.up('KeyD');
await p.evaluate(G0 => { const s = eval(G0), pl = s.player; pl.passive.stacks = 0; setTimeout(() => { pl.weapons[0].cooldownLeft = 0; pl.passive.stacks = 6; }, 80); }, G);
await p.waitForTimeout(2200);
// ② 面朝右，敌人只在左边 → 转向目标冲
await p.evaluate(G0 => { const s = eval(G0), pl = s.player; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); pl.weapons[0].cooldownLeft = 99; const e = s.spawnEnemy('infantry', pl.x - 120, pl.y, 1); e.hp = e.maxHp = 99999; e.stunUntil = 1e12; }, G);
await p.keyboard.down('KeyD'); await p.waitForTimeout(250); await p.keyboard.up('KeyD');
await p.evaluate(G0 => { const s = eval(G0), pl = s.player; pl.passive.stacks = 0; setTimeout(() => { pl.weapons[0].cooldownLeft = 0; pl.passive.stacks = 6; }, 80); }, G);
await p.waitForTimeout(2400);
const dur = (Date.now() - t0) / 1000;
await p.close(); await ctx.close(); await b.close();
const webm = readdirSync(vid).filter(f => f.endsWith('.webm')).map(f => vid + '/' + f).pop();
const gif = `${out}/${NAME}.gif`;
execFileSync('ffmpeg', ['-y', '-sseof', String(-dur - .3), '-i', webm, '-vf', 'fps=10,crop=880:500:200:110,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', gif], { stdio: 'ignore' });
renameSync(webm, `${vid}/${NAME}.webm`);
console.log('GIF:', gif, '时长', dur.toFixed(1), '秒');
