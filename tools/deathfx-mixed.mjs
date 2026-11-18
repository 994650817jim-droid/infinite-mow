// 混编兵种被清屏 + 一次暴击击飞的 GIF（死亡特效 B + 兵器脱手 / 按兵种变化 / 重击击飞；需要 ffmpeg）。
// 先实时清一次（普通击杀），再 0.25 倍慢放重播一次（其中每 3 个是暴击击杀 → 击飞）。兵器 / 头巾小图没到位时只显示其余变化。
import { chromium } from 'playwright';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5260/', out = 'assets/review/deathfx', FF = process.env.FFMPEG ?? 'ffmpeg', q = process.env.Q ?? '';
fs.mkdirSync(out, { recursive: true }); fs.rmSync(`${out}/mixed-raw`, { recursive: true, force: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: `${out}/mixed-raw`, size: { width: 1280, height: 720 } } }), p = await ctx.newPage();
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=desktop${q}`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.player.xpNext = 1e9; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); } });
const mark = () => p.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;width:14px;height:14px;background:#f0f;z-index:99999'; document.body.appendChild(d); setTimeout(() => d.remove(), 250); });
const spawn = () => p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), kinds = ['infantry', 'infantry', 'archer', 'shield', 'cavalry', 'infantry', 'shield', 'archer', 'cavalry', 'elite'], list = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) { const k = kinds[(r * 9 + c) % kinds.length], e = s.spawnEnemy(k, s.player.x + 150 + c * 46, s.player.y - 80 + r * 44, 1, true); if (e) { e.speed = 0; e.hp = e.maxHp = 9999; list.push(e); } } window.__t = list; return list.length; });
const sweep = (heavyEvery, ms) => p.evaluate(([he, ms]) => { const s = window.__game.scene.getScene('GameScene'), list = [...window.__t].sort((a, b) => a.x - b.x); list.forEach((e, i) => setTimeout(() => { if (!e.active) return; e.hp = 0; e.lastHitHeavy = he > 0 && i % he === 0; e.lastHitFromAlly = false; s.killEnemy(e); }, (i / list.length) * ms)); }, [heavyEvery, ms]);
await spawn(); await p.waitForTimeout(2500);             // 等骑兵的马匹图按需载完
await mark(); await p.waitForTimeout(120); await sweep(0, 160); await p.waitForTimeout(1300);
await spawn(); await p.waitForTimeout(500); await p.evaluate(() => { window.__game.scene.getScene('GameScene').devTimeScale = .25; });
await mark(); await p.waitForTimeout(120); await sweep(3, 40); await p.waitForTimeout(2600);
await ctx.close(); await b.close();
const raw = fs.readdirSync(`${out}/mixed-raw`).find(f => f.endsWith('.webm')), file = `${out}/mixed-raw/${raw}`;
const r = spawnSync(FF, ['-v', 'error', '-i', file, '-vf', 'crop=12:12:0:0,signalstats,metadata=print:file=-', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1e8 });
let t = 0, start = null; for (const l of r.stdout.split('\n')) { const m = l.match(/pts_time:([\d.]+)/); if (m) t = +m[1]; const u = l.match(/lavfi.signalstats.VAVG=([\d.]+)/); if (u && +u[1] > 170 && start === null) start = t; }
if (start === null) throw new Error('没找到标记');
execFileSync(FF, ['-y', '-loglevel', 'error', '-ss', (start - .5).toFixed(2), '-t', '6.5', '-i', file, '-vf', 'crop=900:506:190:80,fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', `${out}/mixed.mp4`]);
execFileSync(FF, ['-y', '-loglevel', 'error', '-i', `${out}/mixed.mp4`, '-vf', 'fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', `${out}/mixed.gif`]);
fs.rmSync(`${out}/mixed-raw`, { recursive: true, force: true }); console.log('done', start);
