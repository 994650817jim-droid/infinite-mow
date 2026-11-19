// 祝融夫人投掷飞刀（游戏内）：她走近 → 投掷姿势 → 扇形 3 把火焰飞刀飞出 → 命中火花；录 GIF + 3 张静帧（行走 / 投掷 / 飞刀）。需要 ffmpeg、开发服务器。
// 用法：BASE=http://127.0.0.1:5260/ NAME=zhurong-throw SLOW=1 node tools/record-zhurong-throw.mjs → assets/review/zhurong/<NAME>.gif（SLOW=0.3 是慢放）+ <NAME>-*.png
import { chromium } from 'playwright';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
const E = process.env, BASE = E.BASE ?? 'http://127.0.0.1:5260/', NAME = E.NAME ?? 'zhurong-throw', SLOW = +(E.SLOW ?? 1), OUT = 'assets/review/zhurong', vid = `${OUT}/video-${NAME}`, FF = E.FFMPEG ?? 'ffmpeg';
mkdirSync(OUT, { recursive: true }); rmSync(vid, { recursive: true, force: true }); mkdirSync(vid, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } }), tCtx = Date.now(), p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.addInitScript(() => { window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, ''))); if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop&art=v2`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); }
  await new Promise(res => { s.load.spritesheet('zr', 'assets/bosses-v2/nz_zhurong.png', { frameWidth: 288, frameHeight: 288 }); s.load.once('complete', res); s.load.start(); });
  window.__m = await window.__mod('systems/KnifeFx.ts');
});
await p.waitForTimeout(500);
await p.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;width:14px;height:14px;background:#f0f;z-index:99999'; document.body.appendChild(d); setTimeout(() => d.remove(), 250); });   // 对齐用的洋红标记块
await p.waitForTimeout(150);
await p.evaluate(async slow => {
  const s = window.__game.scene.getScene('GameScene'), kf = new window.__m.KnifeFx(s), px = s.player.x, py = s.player.y; s.devTimeScale = slow;
  const z = s.add.image(px - 230, py + 20, 'zr', 8).setOrigin(.5, 256 / 288).setScale(.7).setDepth(99999), wait = ms => new Promise(r => setTimeout(r, ms / slow));
  s.player.sprite.setPosition(px, py);
  for (let i = 0; i < 8; i++) { z.setFrame(8 + i % 4).x += 14; await wait(150); }                      // 向右行走（行走帧 8–11）
  z.setFrame(24); await wait(220); z.setFrame(25); kf.fan(z.x + 34, z.y - 70, px, py - 20, 3, 18, 300, {}); await wait(170); z.setFrame(26); await wait(220); z.setFrame(27); await wait(260); z.setFrame(8);   // 投掷姿势 24–27，在 25 出手
  await wait(1800);
}, SLOW);
await ctx.close(); await b.close();
const f = readdirSync(vid).find(n => n.endsWith('.webm')), st = spawnSync(FF, ['-v', 'error', '-i', `${vid}/${f}`, '-vf', 'crop=12:12:0:0,signalstats,metadata=print:file=-', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1e8 });
let tt = 0, start = null; for (const l of st.stdout.split('\n')) { const m = l.match(/pts_time:([\d.]+)/); if (m) tt = +m[1]; const u = l.match(/lavfi.signalstats.VAVG=([\d.]+)/); if (u && +u[1] > 170 && start === null) start = tt; }
if (start === null) throw new Error('没找到标记');
execFileSync(FF, ['-y', '-loglevel', 'error', '-ss', start.toFixed(2), '-t', String(Math.ceil(5 / SLOW)), '-i', `${vid}/${f}`, '-vf', 'crop=860:400:210:160,fps=12,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', `${OUT}/${NAME}.gif`]);
console.log('marker', start); if (!process.env.KEEP) rmSync(vid, { recursive: true, force: true }); console.log('gif', `${OUT}/${NAME}.gif`, errs.slice(0, 2));
