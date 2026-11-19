// 骑兵死亡后马的奔跑动画（0.3 倍慢放）GIF；需要 ffmpeg。输出 assets/review/deathfx/<NAME>.gif；SCALE=时间倍率（1 = 实时，.25 = 慢放）NAME=输出名 WAIT=录制毫秒
import { chromium } from 'playwright';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
const SCALE = +(process.env.SCALE ?? .3), NAME = process.env.NAME ?? 'horse', WAIT = +(process.env.WAIT ?? 6500), base = process.env.BASE ?? 'http://127.0.0.1:5260/', out = 'assets/review/deathfx', FF = process.env.FFMPEG ?? 'ffmpeg', q = process.env.Q ?? '';
fs.mkdirSync(out, { recursive: true }); fs.rmSync(`${out}/${NAME}-raw`, { recursive: true, force: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: `${out}/${NAME}-raw`, size: { width: 1280, height: 720 } } }), p = await ctx.newPage();
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=desktop${q}`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.player.xpNext = 1e9; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); } });
const mark = () => p.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;width:14px;height:14px;background:#f0f;z-index:99999'; document.body.appendChild(d); setTimeout(() => d.remove(), 250); });
const spawn = () => p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), list = []; for (let r = 0; r < 4; r++) { const e = s.spawnEnemy('cavalry', s.player.x + 140 + r * 70, s.player.y - 70 + r * 70, 1, true); if (e) { e.speed = 0; e.hp = e.maxHp = 9999; list.push(e); } } window.__t = list; return list.length; });
const kill = () => p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); window.__t.slice(0, 3).forEach((e, i) => setTimeout(() => { if (!e.active) return; e.hp = 0; e.lastHitHeavy = false; e.lastHitFromAlly = false; s.killEnemy(e); }, i * 120)); });
await spawn(); await p.waitForTimeout(2500);                 // 等马图按需载完
if (process.env.NOGALLOP) await p.evaluate(() => { window.__game.scene.getScene('GameScene').textures.remove('horse_v2_enemy_brown_gallop'); });   // 对比用：退回行走图的旧动画
await p.evaluate(sc => { window.__game.scene.getScene('GameScene').devTimeScale = sc; }, SCALE);
await mark(); await p.waitForTimeout(120); await kill(); await p.waitForTimeout(WAIT);
await ctx.close(); await b.close();
const raw = fs.readdirSync(`${out}/${NAME}-raw`).find(f => f.endsWith('.webm')), file = `${out}/${NAME}-raw/${raw}`;
const r = spawnSync(FF, ['-v', 'error', '-i', file, '-vf', 'crop=12:12:0:0,signalstats,metadata=print:file=-', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1e8 });
let t = 0, start = null; for (const l of r.stdout.split('\n')) { const m = l.match(/pts_time:([\d.]+)/); if (m) t = +m[1]; const u = l.match(/lavfi.signalstats.VAVG=([\d.]+)/); if (u && +u[1] > 170 && start === null) start = t; }
if (start === null) throw new Error('没找到标记');
execFileSync(FF, ['-y', '-loglevel', 'error', '-ss', (start - .3).toFixed(2), '-t', String(Math.ceil(WAIT / 1000 + .6)), '-i', file, '-vf', 'crop=900:506:190:80,fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', `${out}/${NAME}.mp4`]);
execFileSync(FF, ['-y', '-loglevel', 'error', '-i', `${out}/${NAME}.mp4`, '-vf', 'fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', `${out}/${NAME}.gif`]);
fs.rmSync(`${out}/${NAME}-raw`, { recursive: true, force: true }); console.log('done', start);
