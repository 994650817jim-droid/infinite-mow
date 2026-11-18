// 真实战斗里看死亡特效（伤害数字、军功令牌、击杀音效都开着）：主将用自己的武器一路砍，敌人自己走过来；录像 + 合成 GIF（需要 ffmpeg）。
import { chromium } from 'playwright';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5260/', out = 'assets/review/deathfx', FF = process.env.FFMPEG ?? 'ffmpeg', q = process.env.Q ?? '';
fs.mkdirSync(out, { recursive: true }); fs.rmSync(`${out}/live-raw`, { recursive: true, force: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: `${out}/live-raw`, size: { width: 1280, height: 720 } } }), p = await ctx.newPage();
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=desktop${q}`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.player.xpNext = 1e9; s.spawnTimer = s.eliteTimer = 1e9; s.player.stats.damageMul = 60; for (const id of ['crossbow', 'guandao', 'flame_banner']) window.__IM.giveWeapon(id); // 多配几把武器、伤害拉高：主将自己的真实攻击一砍就倒一片
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); }
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;width:14px;height:14px;background:#f0f;z-index:99999'; document.body.appendChild(d); setTimeout(() => d.remove(), 300); });
await p.waitForTimeout(150);
for (let wave = 0; wave < 5; wave++) {
  await p.evaluate(wave => { const s = window.__game.scene.getScene('GameScene'); const n = 26; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + wave, r = 120 + (i % 4) * 30; const e = s.spawnEnemy(i % 11 === 0 ? 'elite' : 'infantry', s.player.x + Math.cos(a) * r * 1.5, s.player.y + Math.sin(a) * r, 1, true); if (e) e.hp = e.maxHp = 40; } }, wave);
  await p.waitForTimeout(1300);
}
await p.waitForTimeout(800); await p.screenshot({ path: `${out}/live-still.png` });
await ctx.close(); await b.close();
const raw = fs.readdirSync(`${out}/live-raw`).find(f => f.endsWith('.webm')), file = `${out}/live-raw/${raw}`;
// 找标记（洋红块）出现的时刻，从那里开始截 7 秒
const r = spawnSync(FF, ['-v', 'error', '-i', file, '-vf', 'crop=12:12:0:0,signalstats,metadata=print:file=-', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1e8 });
let t = 0, start = null; for (const l of r.stdout.split('\n')) { const m = l.match(/pts_time:([\d.]+)/); if (m) t = +m[1]; const u = l.match(/lavfi.signalstats.VAVG=([\d.]+)/); if (u && +u[1] > 170 && start === null) start = t; }
if (start === null) throw new Error('没找到标记');
execFileSync(FF, ['-y', '-loglevel', 'error', '-ss', (start + .2).toFixed(2), '-t', '7', '-i', file, '-vf', 'crop=880:495:200:100,fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', `${out}/live.mp4`]);
execFileSync(FF, ['-y', '-loglevel', 'error', '-i', `${out}/live.mp4`, '-vf', 'fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', `${out}/live.gif`]);
fs.rmSync(`${out}/live-raw`, { recursive: true, force: true }); console.log('done', start);
