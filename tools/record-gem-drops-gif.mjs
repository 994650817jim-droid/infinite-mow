// 录军功信物掉落 / 浮动 / 吸取 GIF（电脑布局，2026-11-18）：主将身边一圈敌人被打倒 → 信物弹出落地浮动 → 拾取范围放大后加速飞向主将、闪光。
// 输出 assets/review/gems/<NAME>.gif（主将附近放大 1.5 倍）。用法：BASE=http://127.0.0.1:5173/ NAME=gem-drops node tools/record-gem-drops-gif.mjs（需要 ffmpeg）
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', NAME = process.env.NAME ?? 'gem-drops', out = 'assets/review/gems', vid = `${out}/video-${NAME}`;
rmSync(vid, { recursive: true, force: true }); mkdirSync(vid, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS && window.__game.scene.getScene('GameScene').player, null, { timeout: 60000 });
await p.waitForTimeout(1200);
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); }, 40); }, G);
const t0 = Date.now();
await p.evaluate(async G0 => {
  const s = eval(G0), pl = s.player, wait = ms => new Promise(r => setTimeout(r, ms));
  for (let round = 0; round < 2; round++) {
    pl.stats.pickupRadius = 20;
    const es = [];
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + round * .3, e = s.spawnEnemy(i % 4 ? 'infantry' : 'elite', pl.x + Math.cos(a) * 95, pl.y + Math.sin(a) * 75, 1); if (e) { e.stunUntil = 1e12; es.push(e); } }
    await wait(500);
    for (const [i, e] of es.entries()) { if (e.active) s.hitEnemy(e, e.maxHp + 1, s.combatNow, 'melee', false, true); if (i % 3 === 2) await wait(90); }
    // 精英掉大号令牌之外，再补几枚大号让画面里两种都有
    for (let i = 0; i < 3; i++) s.spawnGem(pl.x + 60 - i * 60, pl.y - 70, 12);
    await wait(2300);
    pl.stats.pickupRadius = 400; await wait(1300);
  }
}, G);
const dur = (Date.now() - t0) / 1000;
await p.close(); await ctx.close(); await b.close();
const webm = readdirSync(vid).filter(f => f.endsWith('.webm')).map(f => vid + '/' + f).pop();
const gif = `${out}/${NAME}.gif`;
execFileSync('ffmpeg', ['-y', '-sseof', String(-dur - .3), '-i', webm, '-vf', 'fps=15,crop=560:320:360:150,scale=780:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', gif], { stdio: 'ignore' });
renameSync(webm, `${vid}/${NAME}.webm`);
console.log('GIF:', gif, '时长', dur.toFixed(1), '秒');
