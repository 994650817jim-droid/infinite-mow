// 录打击感对比 GIF（电脑布局）：1-1 关羽，先砍一群步兵（含暴击），再打首领到破势、半血、击杀。
// 输出 assets/review/hit-feel/<NAME>.gif。用法：BASE=http://127.0.0.1:5173/ NAME=before node tools/record-hit-feel-gif.mjs（需要 ffmpeg）
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', NAME = process.env.NAME ?? 'hit-feel', out = 'assets/review/hit-feel', vid = `${out}/video-${NAME}`;
mkdirSync(vid, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 60000 });
await p.waitForTimeout(1200);
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'guanyu', weapon: undefined }); s.scene.restart(); }, G);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'guanyu' && s.__DEV_ACTIONS; }, null, { timeout: 30000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); }, G);
const t0 = Date.now();
await p.evaluate(async G0 => {
  const s = eval(G0), pl = s.player, wait = ms => new Promise(r => setTimeout(r, ms));
  pl.stats.critChance = .35; s.spawnGem = () => {}; setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); }, 40); // 不掉宝石；万一升级三选一，自动选第一张，免得挡住画面
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, e = s.spawnEnemy(i % 5 ? 'infantry' : 'elite', pl.x + Math.cos(a) * 70, pl.y + Math.sin(a) * 60, 1); if (e) { e.hp = e.maxHp = i % 5 ? 60 : 200; } }
  await wait(3000);
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  s.spawnBoss(); const boss = s.boss; boss.sprite.setPosition(pl.x + 80, pl.y); boss.maxHp = boss.hp = 2600; boss.stunUntil = 0;
  await wait(4200);
  if (boss.active) { boss.hp = Math.min(boss.hp, 40); }
  await wait(2500);
}, G);
const dur = (Date.now() - t0) / 1000;
await p.close(); await ctx.close(); await b.close();
const webm = readdirSync(vid).filter(f => f.endsWith('.webm')).map(f => vid + '/' + f).pop();
const gif = `${out}/${NAME}.gif`;
execFileSync('ffmpeg', ['-y', '-sseof', String(-dur - .3), '-i', webm, '-vf', 'fps=12,crop=880:560:200:80,scale=520:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=110:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', gif], { stdio: 'ignore' });
renameSync(webm, `${vid}/${NAME}.webm`);
console.log('GIF:', gif, '时长', dur.toFixed(1), '秒');
